(() => {
  'use strict';

  const API_BASE_URL = 'YOUR_API_BASE_URL_HERE';

  const pages = {
    dashboard: 'pages/dashboard.html',
    'user-management': 'pages/user-management.html',
    profile: 'pages/profile.html',
    files: 'pages/files.html',
    reports: 'pages/reports.html',
    settings: 'pages/settings.html'
  };

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

  let isLayoutInitialized = false;
  let isRouteLoading = false;

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
    return Object.prototype.hasOwnProperty.call(pages, hash) ? hash : 'dashboard';
  }

  function setActiveMenu(pageKey) {
    layout.navLinks.forEach((link) => {
      const linkPage = link.getAttribute('data-page');
      link.classList.toggle('active', linkPage === pageKey);
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
      closeSidebar();
    }
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
      layout.menuToggle.addEventListener('click', toggleSidebar);
    }

    if (layout.sidebarOverlay) {
      layout.sidebarOverlay.addEventListener('click', closeSidebar);
    }

    if (layout.logoutBtn) {
      layout.logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();

        try {
          const token = getToken();

          if (token) {
            await fetch(`${API_BASE_URL}/logout`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
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

    layout.navLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        const page = link.getAttribute('data-page');

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
      });
    });

    window.addEventListener('resize', ensureDesktopSidebarState);
    window.addEventListener('hashchange', handleRouteChange);
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

      const html = await response.text();
      layout.spaContainer.innerHTML = html;
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
      const pageKey = getCurrentPageKey();
      await loadPage(pageKey);
    } finally {
      isRouteLoading = false;
    }
  }

  function enforceAuth() {
    const token = getToken();

    if (!token) {
      window.location.href = 'index.html';
      return false;
    }

    return true;
  }

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
