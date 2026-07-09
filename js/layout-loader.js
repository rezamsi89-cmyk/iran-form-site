(() => {
  'use strict';

  const API_BASE_URL = 'https://iran-form-api.reza-msi89.workers.dev';

  const PUBLIC_PAGES = ['index.html', 'register.html', 'forgot.html', 'reset.html'];

  const pages = {
    dashboard: 'pages/dashboard.html',
    'user-management': 'pages/user-management.html',
    profile: 'pages/profile.html',
    files: 'pages/files.html',
    reports: 'pages/reports.html',
    settings: 'pages/settings.html'
  };

  const layout = {
    headerMount: null,
    sidebarMount: null,
    spaContainer: null,
    sidebar: null,
    sidebarOverlay: null,
    menuToggle: null,
    sidebarToggleBtn: null,
    logoutBtns: [],
    navLinks: [],
    headerUserName: null
  };

  let isLayoutInitialized = false;
  let isRouteLoading = false;
  let eventsBound = false;

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
      return null;
    }
  }

  function getCurrentFileName() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function isPublicPage() {
    return PUBLIC_PAGES.includes(getCurrentFileName());
  }

  function getCurrentPageKey() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return 'dashboard';
    return Object.prototype.hasOwnProperty.call(pages, hash) ? hash : 'dashboard';
  }

  function isMobileView() {
    return window.innerWidth < 992;
  }

  function setActiveMenu(pageKey) {
    layout.navLinks.forEach((link) => {
      const linkPage = link.getAttribute('data-page') || link.getAttribute('data-route');
      link.classList.toggle('active', linkPage === pageKey);
    });
  }

  function updateHeaderUser() {
    if (!layout.headerUserName) return;

    const user = getUser();
    layout.headerUserName.textContent = user?.fullName || user?.username || 'کاربر سیستم';
  }

  function closeSidebar() {
    if (layout.sidebar) {
      layout.sidebar.classList.remove('show');
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.classList.remove('show');
    }

    document.body.classList.remove('sidebar-open');
  }

  function openSidebar() {
    if (layout.sidebar) {
      layout.sidebar.classList.add('show');
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.classList.add('show');
    }

    document.body.classList.add('sidebar-open');
  }

  function toggleSidebar() {
    if (!layout.sidebar) return;

    if (layout.sidebar.classList.contains('show')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function setDesktopExpanded() {
    document.body.classList.remove('sidebar-desktop-mini', 'sidebar-hover-expanded');
    document.body.classList.add('sidebar-desktop-expanded');
  }

  function setDesktopMini() {
    document.body.classList.remove('sidebar-desktop-expanded', 'sidebar-hover-expanded');
    document.body.classList.add('sidebar-desktop-mini');
  }

  function isDesktopMini() {
    return document.body.classList.contains('sidebar-desktop-mini');
  }

  function isDesktopExpanded() {
    return document.body.classList.contains('sidebar-desktop-expanded');
  }

  function toggleDesktopSidebarMode() {
    if (isDesktopExpanded()) {
      setDesktopMini();
    } else {
      setDesktopExpanded();
    }
  }

  function handleSidebarToggleAction() {
    if (isMobileView()) {
      toggleSidebar();
    } else {
      toggleDesktopSidebarMode();
    }
  }

  function ensureDesktopSidebarState() {
    if (isMobileView()) {
      closeSidebar();
      document.body.classList.remove('sidebar-hover-expanded');
      return;
    }

    closeSidebar();

    if (
      !document.body.classList.contains('sidebar-desktop-expanded') &&
      !document.body.classList.contains('sidebar-desktop-mini')
    ) {
      setDesktopExpanded();
    }
  }

  function bindSidebarHoverEvents() {
    if (!layout.sidebar) return;

    layout.sidebar.addEventListener('mouseenter', () => {
      if (!isMobileView() && isDesktopMini()) {
        document.body.classList.add('sidebar-hover-expanded');
      }
    });

    layout.sidebar.addEventListener('mouseleave', () => {
      if (!isMobileView() && isDesktopMini()) {
        document.body.classList.remove('sidebar-hover-expanded');
      }
    });
  }

  function showLoading() {
    if (!layout.spaContainer) return;

    layout.spaContainer.innerHTML = `
      <div class="d-flex justify-content-center align-items-center py-5">
        <div class="spinner-border text-primary" role="status" aria-label="در حال بارگذاری"></div>
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

  async function loadLayoutPart(selector, filePath) {
    const target = qs(selector);

    if (!target) {
      throw new Error(`Container not found for selector: ${selector}`);
    }

    const response = await fetch(filePath, { cache: 'no-store' });

    if (!response.ok) {
      throw new Error(`Failed to load layout file: ${filePath}`);
    }

    target.innerHTML = await response.text();
  }

  function cacheLayoutElements() {
    layout.headerMount = qs('#headerMount');
    layout.sidebarMount = qs('#sidebarMount');
    layout.spaContainer = qs('#spaContainer');

    layout.sidebar = qs('#appSidebar') || qs('.sidebar') || qs('#sidebarMount');
    layout.sidebarOverlay = qs('#sidebarOverlay') || qs('.sidebar-overlay');

    layout.menuToggle = qs('#menuToggle');
    layout.sidebarToggleBtn = qs('#sidebarToggleBtn');

    layout.logoutBtns = qsa('#logoutBtn, .logout-btn');
    layout.navLinks = qsa('[data-page], [data-route]', layout.sidebar || document);
    layout.headerUserName = qs('#headerUserName');
  }

  function redirectToLogin() {
    window.location.replace('index.html');
  }

  function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn');
  }

  async function handleLogout(event) {
    if (event) {
      event.preventDefault();
    }

    try {
      const token = getToken();

      if (token && API_BASE_URL !== 'YOUR_API_BASE_URL_HERE') {
        await fetch(`${API_BASE_URL}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {});
      }
    } finally {
      clearAuth();
      redirectToLogin();
    }
  }

  function handleNavClick(link, event) {
    const page = link.getAttribute('data-page') || link.getAttribute('data-route');

    if (!page || !pages[page]) {
      return;
    }

    event.preventDefault();

    if (window.location.hash.replace('#', '') === page) {
      handleRouteChange();
    } else {
      window.location.hash = page;
    }

    if (isMobileView()) {
      closeSidebar();
    }
  }

  function bindLayoutEvents() {
    if (eventsBound) return;

    if (layout.menuToggle) {
      layout.menuToggle.addEventListener('click', handleSidebarToggleAction);
    }

    if (layout.sidebarToggleBtn) {
      layout.sidebarToggleBtn.addEventListener('click', handleSidebarToggleAction);
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    document.addEventListener('click', (event) => {
      if (!layout.sidebar) return;

      if (isMobileView()) {
        const isOpen = layout.sidebar.classList.contains('show');

        if (
          isOpen &&
          !layout.sidebar.contains(event.target) &&
          !(
            (layout.menuToggle && layout.menuToggle.contains(event.target)) ||
            (layout.sidebarToggleBtn && layout.sidebarToggleBtn.contains(event.target))
          )
        ) {
          closeSidebar();
        }

        return;
      }

      if (
        isDesktopMini() &&
        document.body.classList.contains('sidebar-hover-expanded') &&
        !layout.sidebar.contains(event.target)
      ) {
        document.body.classList.remove('sidebar-hover-expanded');
      }
    });

    layout.logoutBtns.forEach((btn) => {
      btn.addEventListener('click', handleLogout);
    });

    layout.navLinks.forEach((link) => {
      link.addEventListener('click', (event) => handleNavClick(link, event));
    });

    window.addEventListener('resize', ensureDesktopSidebarState);
    window.addEventListener('hashchange', handleRouteChange);

    bindSidebarHoverEvents();

    eventsBound = true;
  }

  async function initializeLayout() {
    if (isLayoutInitialized) {
      return;
    }

    await Promise.all([
      loadLayoutPart('#headerMount', 'components/header.html'),
      loadLayoutPart('#sidebarMount', 'components/sidebar.html')
    ]);

    cacheLayoutElements();
    updateHeaderUser();
    bindLayoutEvents();

    isLayoutInitialized = true;
  }

  async function loadPage(pageKey) {
    const pagePath = pages[pageKey];

    if (!pagePath) {
      showError('صفحه مورد نظر پیدا نشد.');
      return;
    }

    showLoading();

    try {
      const response = await fetch(pagePath, { cache: 'no-store' });

      if (!response.ok) {
        throw new Error(`Failed to load page: ${pagePath}`);
      }

      layout.spaContainer.innerHTML = await response.text();
      setActiveMenu(pageKey);

      if (typeof window.initializePage === 'function') {
        try {
          window.initializePage(pageKey);
        } catch (error) {
          console.error('Page initialization error:', error);
        }
      }
    } catch (error) {
      console.error(error);
      showError('خطا در بارگذاری صفحه. لطفاً دوباره تلاش کنید.');
    }
  }

  async function handleRouteChange() {
    if (isRouteLoading) {
      return;
    }

    isRouteLoading = true;

    try {
      const token = getToken();

      if (!token) {
        clearAuth();
        redirectToLogin();
        return;
      }

      const pageKey = getCurrentPageKey();
      await loadPage(pageKey);
    } finally {
      isRouteLoading = false;
    }
  }

  function enforceAuth() {
    const token = getToken();

    if (!token) {
      clearAuth();
      redirectToLogin();
      return false;
    }

    return true;
  }

  async function bootstrap() {
    if (isPublicPage()) {
      return;
    }

    if (!enforceAuth()) return;

    try {
      await initializeLayout();
      ensureDesktopSidebarState();
      await handleRouteChange();
    } catch (error) {
      console.error('Bootstrap error:', error);
      showError('خطا در بارگذاری قالب اصلی.');
    }
  }

  document.addEventListener('DOMContentLoaded', bootstrap);
})();
