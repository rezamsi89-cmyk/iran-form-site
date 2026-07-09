(() => {
  "use strict";

  const API_BASE_URL = "https://iran-form-api.reza-msi89.workers.dev";

  const pages = {
    dashboard: "pages/dashboard.html",
    user_management: "pages/user_management.html",
    profile: "pages/profile.html",
    files: "pages/files.html",
    reports: "pages/reports.html",
    settings: "pages/settings.html",
    "settings-sidebar-menu": "pages/settings-sidebar-menu.html",
  };

  let layout = {
    headerMount: null,
    sidebarMount: null,
    spaContainer: null,
    sidebar: null,
    sidebarOverlay: null,
    menuToggle: null,
    logoutBtn: null,
    navLinks: [],
  };

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  function getToken() {
    return localStorage.getItem("token");
  }

  function getCurrentPageKey() {
    const hash = window.location.hash.replace("#", "").trim();
    if (!hash || hash === "logout") {
      return "dashboard";
    }
    return pages[hash] ? hash : "dashboard";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isMobileView() {
    return window.innerWidth < 992;
  }

  function openSidebar() {
    if (layout.sidebar) {
      layout.sidebar.classList.add("show");
    }
    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.classList.add("show");
    }
    document.body.classList.add("sidebar-open");
  }

  function closeSidebar() {
    if (layout.sidebar) {
      layout.sidebar.classList.remove("show");
    }
    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.classList.remove("show");
    }
    document.body.classList.remove("sidebar-open");
  }

  function toggleSidebar() {
    if (!layout.sidebar) return;
    layout.sidebar.classList.contains("show") ? closeSidebar() : openSidebar();
  }

  function ensureDesktopSidebarState() {
    if (!isMobileView()) {
      closeSidebar();
    }
  }

  function showLoading() {
    if (!layout.spaContainer) return;
    layout.spaContainer.innerHTML = `
      <div class="d-flex justify-content-center align-items-center py-5">
        <div class="spinner-border text-primary" role="status"></div>
      </div>
    `;
  }

  function showError(message) {
    if (!layout.spaContainer) return;
    layout.spaContainer.innerHTML = `
      <div class="alert alert-danger m-3" role="alert">
        ${message}
      </div>
    `;
  }

  function setActiveMenu(pageKey) {
    layout.navLinks.forEach((link) => {
      const linkPage = link.getAttribute("data-page");
      link.classList.toggle("active", linkPage === pageKey);
    });
  }

  function cacheLayoutElements() {
    layout.headerMount = qs("#headerMount");
    layout.sidebarMount = qs("#sidebarMount");
    layout.spaContainer = qs("#spaContainer");
    layout.sidebar = qs("#appSidebar");
    layout.sidebarOverlay = qs("#sidebarOverlay");
    layout.menuToggle = qs("#menuToggle");
    layout.logoutBtn = qs("#logoutBtn");
    layout.navLinks = qsa("[data-page]");
  }

  async function loadLayoutPart(selector, filePath) {
    const target = qs(selector);
    if (!target) {
      throw new Error(`Container not found: ${selector}`);
    }

    const response = await fetch(filePath, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load layout file: ${filePath}`);
    }

    target.innerHTML = await response.text();
  }

  function renderSidebarMenu(items) {
    if (!Array.isArray(items) || items.length === 0) {
      return "";
    }

    return items.map(renderSidebarMenuItem).join("");
  }

  function renderSidebarMenuItem(item) {
    const icon = escapeHtml(item.icon || "bi bi-circle");
    const title = escapeHtml(item.title || "");
    const route = item.route ? String(item.route).trim() : "";
    const target = item.target ? String(item.target).trim() : "";
    const children = Array.isArray(item.children) ? item.children : [];
    const itemType = item.item_type || "link";

    if (itemType === "group") {
      return `
        <div class="sidebar-menu-group">
          <div class="sidebar-menu-group-title">
            <span class="sidebar-menu-group-icon"><i class="${icon}"></i></span>
            <span class="sidebar-menu-group-text">${title}</span>
          </div>
          <div class="sidebar-submenu">
            ${renderSidebarMenu(children)}
          </div>
        </div>
      `;
    }

    if (route === "logout") {
      return `
        <a href="#logout" class="sidebar-link sidebar-logout-link" id="logoutBtn" data-route="logout">
          <span class="sidebar-link-icon"><i class="${icon}"></i></span>
          <span class="sidebar-link-text">${title}</span>
        </a>
      `;
    }

    if (!route) {
      return "";
    }

    const targetAttr = target ? ` target="${escapeHtml(target)}"` : "";

    return `
      <a href="#${escapeHtml(route)}" class="sidebar-link" data-page="${escapeHtml(route)}"${targetAttr}>
        <span class="sidebar-link-icon"><i class="${icon}"></i></span>
        <span class="sidebar-link-text">${title}</span>
      </a>
    `;
  }

  async function loadAndRenderSidebarMenu(forceReload = false) {
    const menuContainer = qs("#sidebarNavMenu");
    const loadingEl = qs("#sidebarMenuLoading");

    if (!menuContainer) {
      throw new Error("Sidebar menu container not found.");
    }

    if (loadingEl) {
      loadingEl.classList.remove("d-none");
    }

    try {
      const token = getToken();
      const response = await fetch(`${API_BASE_URL}/api/sidebar-menu`, {
        method: "GET",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "X-User-Role": "admin",
        },
        cache: forceReload ? "no-store" : "default",
      });

      if (!response.ok) {
        throw new Error(`Sidebar menu API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !Array.isArray(data.menu)) {
        throw new Error("Invalid sidebar menu response.");
      }

      menuContainer.innerHTML = renderSidebarMenu(data.menu);

      cacheLayoutElements();
      bindSidebarMenuEvents();
      setActiveMenu(getCurrentPageKey());
    } finally {
      if (loadingEl) {
        loadingEl.classList.add("d-none");
      }
    }
  }

  async function handleLogout() {
    try {
      const token = getToken();

      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});

        await fetch(`${API_BASE_URL}/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch(() => {});
      }
    } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "index.html";
    }
  }

  function bindSidebarMenuEvents() {
    layout.logoutBtn = qs("#logoutBtn");
    layout.navLinks = qsa("[data-page]");

    if (layout.logoutBtn) {
      layout.logoutBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        await handleLogout();
      });
    }

    layout.navLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const page = link.getAttribute("data-page");
        if (!page || !pages[page]) {
          return;
        }

        event.preventDefault();
        window.location.hash = page;

        if (isMobileView()) {
          closeSidebar();
        }
      });
    });
  }

  function bindLayoutEvents() {
    if (layout.menuToggle) {
      layout.menuToggle.addEventListener("click", toggleSidebar);
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.addEventListener("click", closeSidebar);
    }

    window.addEventListener("resize", ensureDesktopSidebarState);
    window.addEventListener("hashchange", handleRouteChange);
  }

  async function loadPage(pageKey) {
    const pagePath = pages[pageKey];

    if (!pagePath) {
      showError("صفحه مورد نظر پیدا نشد.");
      return;
    }

    showLoading();

    try {
      const response = await fetch(pagePath, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Failed to load page: ${pagePath}`);
      }

      layout.spaContainer.innerHTML = await response.text();
      setActiveMenu(pageKey);

      if (typeof window.initializePage === "function") {
        try {
          window.initializePage(pageKey);
        } catch (error) {
          console.error("Page initialization error:", error);
        }
      }
    } catch (error) {
      console.error(error);
      showError("خطا در بارگذاری صفحه. لطفاً دوباره تلاش کنید.");
    }
  }

  async function handleRouteChange() {
    const rawHash = window.location.hash.replace("#", "").trim();

    if (rawHash === "logout") {
      await handleLogout();
      return;
    }

    const pageKey = getCurrentPageKey();
    await loadPage(pageKey);
  }

  function enforceAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = "index.html";
      return false;
    }
    return true;
  }

  async function initializeLayout() {
    await Promise.all([
      loadLayoutPart("#headerMount", "components/header.html"),
      loadLayoutPart("#sidebarMount", "components/sidebar.html"),
    ]);

    cacheLayoutElements();
    bindLayoutEvents();
    await loadAndRenderSidebarMenu();
  }

  window.loadAndRenderSidebarMenu = loadAndRenderSidebarMenu;

  async function bootstrap() {
    if (!enforceAuth()) return;

    try {
      await initializeLayout();
      ensureDesktopSidebarState();
      await handleRouteChange();
    } catch (error) {
      console.error("Bootstrap error:", error);
      showError("خطا در بارگذاری قالب اصلی.");
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
