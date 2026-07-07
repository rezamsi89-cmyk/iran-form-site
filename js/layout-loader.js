(() => {
  'use strict';

  // =========================
  // Config
  // =========================
  const API_BASE_URL = 'YOUR_API_BASE_URL_HERE';

  const pages = {
    dashboard: 'pages/dashboard.html',
    user_management: 'pages/user_management.html',
    profile: 'pages/profile.html',
    files: 'pages/files.html',
    reports: 'pages/reports.html',
    settings: 'pages/settings.html'
  };

  // =========================
  // State
  // =========================
  let layout = {
    headerMount: null,
    sidebarMount: null,
    spaContainer: null,
    sidebar: null,
    sidebarOverlay: null,
    menuToggle: null,
    logoutBtn: null,
    navLinks: []
  };

  // =========================
  // Utils
  // =========================
  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function qsa(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function getCurrentPageKey() {
    const hash = window.location.hash.replace('#', '').trim();
    if (!hash) return 'dashboard';
    return pages[hash] ? hash : 'dashboard';
  }

  function setActiveMenu(pageKey) {
    layout.navLinks.forEach(link => {
      const linkPage = link.getAttribute('data-page');
      if (linkPage === pageKey) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
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
    const isOpen = layout.sidebar.classList.contains('show');
    if (isOpen) {
      closeSidebar();
    } else {
      openSidebar();
    }
  }

  function isMobileView() {
    return window.innerWidth < 992;
  }

  function ensureDesktopSidebarState() {
    if (!isMobileView()) {
      if (layout.sidebar) layout.sidebar.classList.remove('show');
      if (layout.sidebarOverlay) layout.sidebarOverlay.classList.remove('show');
      document.body.classList.remove('sidebar-open');
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

  // =========================
  // Layout Loader
  // =========================
  async function loadLayoutPart(selector, filePath) {
    const target = qs(selector);
    if (!target) {
      throw new Error(`Container not found for selector: ${selector}`);
    }

    const response = await fetch(filePath, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to load layout file: ${filePath}`);
    }

    const html = await response.text();
    target.innerHTML = html;
  }

  function cacheLayoutElements() {
    layout.headerMount = qs('#headerMount');
    layout.sidebarMount = qs('#sidebarMount');
    layout.spaContainer = qs('#spaContainer');

    layout.sidebar = qs('#appSidebar');
    layout.sidebarOverlay = qs('#sidebarOverlay');
    layout.menuToggle = qs('#menuToggle');
    layout.logoutBtn = qs('#logoutBtn');
    layout.navLinks = qsa('[data-page]');
  }

  function bindLayoutEvents() {
    if (layout.menuToggle) {
      layout.menuToggle.addEventListener('click', () => {
        toggleSidebar();
      });
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.addEventListener('click', () => {
        closeSidebar();
      });
    }

    if (layout.logoutBtn) {
      layout.logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();

        try {
          const token = getToken();

          if (token) {
            await fetch(`${API_BASE_URL}/logout`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`
              }
            }).catch(() => {});
          }
        } finally {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = 'index.html';
        }
      });
    }

    layout.navLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        const page = link.getAttribute('data-page');
        if (!page || !pages[page]) return;

        e.preventDefault();
        window.location.hash = page;

        if (isMobileView()) {
          closeSidebar();
        }
      });
    });

    window.addEventListener('resize', ensureDesktopSidebarState);
    window.addEventListener('hashchange', handleRouteChange);
  }

  async function initializeLayout() {
    await Promise.all([
      loadLayoutPart('#headerMount', 'components/header.html'),
      loadLayoutPart('#sidebarMount', 'components/sidebar.html')
    ]);

    cacheLayoutElements();
    bindLayoutEvents();
  }

  // =========================
  // SPA Loader
  // =========================
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

      const html = await response.text();
      layout.spaContainer.innerHTML = html;
      setActiveMenu(pageKey);

      if (typeof window.initializePage === 'function') {
        try {
          window.initializePage(pageKey);
        } catch (err) {
          console.error('Page initialization error:', err);
        }
      }
    } catch (error) {
      console.error(error);
      showError('خطا در بارگذاری صفحه. لطفاً دوباره تلاش کنید.');
    }
  }

  async function handleRouteChange() {
    const pageKey = getCurrentPageKey();
    await loadPage(pageKey);
  }

  // =========================
  // Auth Guard
  // =========================
  function enforceAuth() {
    const token = getToken();
    if (!token) {
      window.location.href = 'index.html';
      return false;
    }
    return true;
  }

  // =========================
  // Bootstrap
  // =========================
  async function bootstrap() {
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
