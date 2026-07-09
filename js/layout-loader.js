(() => {
  'use strict';

  const API_BASE_URL = 'https://iran-form-api.reza-msi89.workers.dev';

  const routes = {
    dashboard: {
      path: 'pages/dashboard.html',
      title: 'داشبورد'
    },
    users: {
      path: 'pages/users.html',
      title: 'کاربران'
    },
    settings: {
      path: 'pages/settings.html',
      title: 'تنظیمات'
    },
    'settings-sidebar-menu': {
      path: 'pages/settings-sidebar-menu.html',
      title: 'مدیریت منوی سایدبار'
    }
  };

  const pageScripts = {
    'settings-sidebar-menu': 'js/pages/settings-sidebar-menu.js'
  };

  const loadedPageScripts = new Set();

  const state = {
    layoutInitialized: false,
    currentPageKey: null,
    sidebarMenuCache: null,
    sidebarMenuLoaded: false
  };

  const els = {
    appShell: null,
    topbar: null,
    sidebar: null,
    pageTitle: null,
    pageContent: null,
    sidebarNavMenu: null,
    sidebarMenuLoading: null
  };

  function qs(selector, parent = document) {
    return parent.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeRoute(route) {
    if (!route) return '';
    return String(route).replace(/^#/, '').replace(/^\/+/, '').trim();
  }

  function getToken() {
    return localStorage.getItem('token');
  }

  function getAuthHeaders(contentType = false) {
    const headers = {};
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    if (contentType) {
      headers['Content-Type'] = 'application/json';
    }

    return headers;
  }

  function getCurrentHash() {
    return window.location.hash || '#dashboard';
  }

  function getCurrentPageKey() {
    const hash = getCurrentHash();
    const raw = hash.replace(/^#/, '').trim();
    return routes[raw] ? raw : 'dashboard';
  }

  async function fetchHtml(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch HTML: ${path}`);
    }
    return response.text();
  }

  async function ensurePageScript(pageKey) {
    const scriptPath = pageScripts[pageKey];
    if (!scriptPath || loadedPageScripts.has(pageKey)) {
      return;
    }

    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptPath;
      script.async = true;

      script.onload = () => {
        loadedPageScripts.add(pageKey);
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load page script: ${scriptPath}`));
      };

      document.body.appendChild(script);
    });
  }

  function getDefaultSidebarMenuFallback() {
    return [
      {
        id: 'fallback-dashboard',
        title: 'داشبورد',
        route: 'dashboard',
        item_type: 'link',
        icon: 'bi bi-grid-1x2-fill',
        sort_order: 1,
        parent_id: null,
        is_active: 1,
        children: []
      },
      {
        id: 'fallback-settings-group',
        title: 'تنظیمات',
        route: '',
        item_type: 'group',
        icon: 'bi bi-gear-fill',
        sort_order: 2,
        parent_id: null,
        is_active: 1,
        children: [
          {
            id: 'fallback-settings-sidebar-menu',
            title: 'مدیریت منوی سایدبار',
            route: 'settings-sidebar-menu',
            item_type: 'link',
            icon: 'bi bi-list-ul',
            sort_order: 1,
            parent_id: 'fallback-settings-group',
            is_active: 1,
            children: []
          }
        ]
      },
      {
        id: 'fallback-users',
        title: 'کاربران',
        route: 'users',
        item_type: 'link',
        icon: 'bi bi-people-fill',
        sort_order: 3,
        parent_id: null,
        is_active: 1,
        children: []
      },
      {
        id: 'fallback-logout',
        title: 'خروج',
        route: 'logout',
        item_type: 'link',
        icon: 'bi bi-box-arrow-right',
        sort_order: 4,
        parent_id: null,
        is_active: 1,
        target: '_self',
        children: []
      }
    ];
  }

  function isUsableSidebarMenu(items) {
    return Array.isArray(items) && items.length > 0;
  }

  async function fetchSidebarMenu() {
    const response = await fetch(`${API_BASE_URL}/api/sidebar-menu`, {
      method: 'GET',
      headers: getAuthHeaders(false)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sidebar menu.');
    }

    const result = await response.json();
    const items = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];

    return isUsableSidebarMenu(items) ? items : getDefaultSidebarMenuFallback();
  }

  function buildSidebarTree(items) {
    const map = new Map();
    const roots = [];

    items.forEach((item, index) => {
      const normalizedId = item?.id ?? `fallback-${index}`;
      map.set(String(normalizedId), {
        ...item,
        id: normalizedId,
        children: Array.isArray(item.children) ? item.children : []
      });
    });

    map.forEach((item) => {
      const parentId = item.parent_id == null || item.parent_id === '' ? null : String(item.parent_id);

      if (parentId && map.has(parentId)) {
        const parent = map.get(parentId);
        parent.children = Array.isArray(parent.children) ? parent.children : [];
        parent.children.push(item);
      } else {
        roots.push(item);
      }
    });

    const sortItems = (list) => {
      list.sort((a, b) => {
        const orderA = Number(a.sort_order ?? 0);
        const orderB = Number(b.sort_order ?? 0);

        if (orderA !== orderB) {
          return orderA - orderB;
        }

        return String(a.title || '').localeCompare(String(b.title || ''), 'fa');
      });

      list.forEach((item) => {
        if (Array.isArray(item.children) && item.children.length) {
          sortItems(item.children);
        }
      });

      return list;
    };

    return sortItems(roots);
  }

  function hasActiveChild(item, currentPageKey) {
    if (!item || !Array.isArray(item.children)) return false;

    return item.children.some((child) => {
      const childRoute = normalizeRoute(child.route);
      if (childRoute === currentPageKey) return true;
      return hasActiveChild(child, currentPageKey);
    });
  }

  function renderSidebarMenuItems(items, currentPageKey) {
    return items
      .filter((item) => Number(item.is_active ?? 1) !== 0)
      .map((item) => {
        const itemType = item.item_type;
        const title = escapeHtml(item.title || '');
        const icon = item.icon ? `<i class="${escapeHtml(item.icon)}"></i>` : '';
        const isGroup = itemType === 'group';
        const route = normalizeRoute(item.route);
        const isActive = route && route === currentPageKey;
        const childActive = hasActiveChild(item, currentPageKey);

        if (isGroup) {
          const groupId = `sidebar-group-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;
          const expanded = childActive ? 'true' : 'false';
          const showClass = childActive ? 'show' : '';
          const childHtml = renderSidebarMenuItems(item.children || [], currentPageKey);

          return `
            <li class="nav-item sidebar-group">
              <button
                class="nav-link sidebar-group-toggle ${childActive ? 'active' : ''}"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#${groupId}"
                aria-expanded="${expanded}"
                aria-controls="${groupId}"
              >
                <span class="sidebar-link-content">
                  ${icon}
                  <span>${title}</span>
                </span>
                <span class="sidebar-group-arrow">⌄</span>
              </button>
              <div class="collapse ${showClass}" id="${groupId}">
                <ul class="nav flex-column ms-3">
                  ${childHtml}
                </ul>
              </div>
            </li>
          `;
        }

        return `
          <li class="nav-item">
            <a
              href="#${escapeHtml(route || '')}"
              class="nav-link ${isActive ? 'active' : ''} ${route === 'logout' ? 'text-danger' : ''}"
              data-route="${escapeHtml(route || '')}"
              target="${escapeHtml(item.target || '_self')}"
            >
              <span class="sidebar-link-content">
                ${icon}
                <span>${title}</span>
              </span>
            </a>
          </li>
        `;
      }).join('');
  }

  function bindSidebarGroupToggles() {
    if (!els.sidebarNavMenu) return;

    const toggles = els.sidebarNavMenu.querySelectorAll('.sidebar-group-toggle');
    toggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const arrow = qs('.sidebar-group-arrow', toggle);
        if (!arrow) return;

        window.setTimeout(() => {
          const expanded = toggle.getAttribute('aria-expanded') === 'true';
          arrow.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
        }, 0);
      });

      const arrow = qs('.sidebar-group-arrow', toggle);
      if (arrow) {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        arrow.style.transform = expanded ? 'rotate(180deg)' : 'rotate(0deg)';
      }
    });
  }

  function bindDynamicNavLinks() {
    if (!els.sidebarNavMenu) return;

    const links = els.sidebarNavMenu.querySelectorAll('a.nav-link[data-route]');
    links.forEach((link) => {
      link.addEventListener('click', (event) => {
        const target = link.getAttribute('target') || '_self';
        const route = link.dataset.route;

        if (target && target !== '_self') {
          return;
        }

        if (route === 'logout') {
          event.preventDefault();
          localStorage.removeItem('token');
          window.location.href = '/';
          return;
        }

        event.preventDefault();
        window.location.hash = `#${route}`;
      });
    });
  }

  function renderSidebarMenu() {
    if (!els.sidebarNavMenu) return;

    const menuItems = isUsableSidebarMenu(state.sidebarMenuCache)
      ? state.sidebarMenuCache
      : getDefaultSidebarMenuFallback();

    const currentPageKey = getCurrentPageKey();
    const tree = buildSidebarTree(menuItems);
    els.sidebarNavMenu.innerHTML = renderSidebarMenuItems(tree, currentPageKey);

    bindSidebarGroupToggles();
    bindDynamicNavLinks();
  }

  async function loadAndRenderSidebarMenu(forceReload = false) {
    if (!els.sidebarNavMenu) return;

    if (els.sidebarMenuLoading) {
      els.sidebarMenuLoading.classList.remove('d-none');
    }

    try {
      if (!state.sidebarMenuLoaded || forceReload) {
        try {
          state.sidebarMenuCache = await fetchSidebarMenu();
        } catch (error) {
          console.warn('[layout-loader] Sidebar API unavailable. Using fallback menu.', error);
          state.sidebarMenuCache = getDefaultSidebarMenuFallback();
        }

        if (!isUsableSidebarMenu(state.sidebarMenuCache)) {
          console.warn('[layout-loader] Sidebar menu empty. Using fallback menu.');
          state.sidebarMenuCache = getDefaultSidebarMenuFallback();
        }

        state.sidebarMenuLoaded = true;
      }

      renderSidebarMenu();
    } catch (error) {
      console.error('[layout-loader] Failed to render sidebar menu. Using emergency fallback.', error);
      state.sidebarMenuCache = getDefaultSidebarMenuFallback();
      renderSidebarMenu();
    } finally {
      if (els.sidebarMenuLoading) {
        els.sidebarMenuLoading.classList.add('d-none');
      }
    }
  }

  async function initializeLayout() {
    if (state.layoutInitialized) {
      return;
    }

    const appShell = qs('#appShell');
    if (!appShell) {
      throw new Error('#appShell not found.');
    }

    const [topbarHtml, sidebarHtml] = await Promise.all([
      fetchHtml('components/topbar.html'),
      fetchHtml('components/sidebar.html')
    ]);

    appShell.innerHTML = `
      <div id="layoutWrapper">
        <div id="topbarContainer">${topbarHtml}</div>
        <div class="layout-body d-flex">
          <aside id="sidebarContainer">${sidebarHtml}</aside>
          <main class="flex-grow-1 p-3">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h1 id="pageTitle" class="h4 m-0"></h1>
            </div>
            <div id="pageContent"></div>
          </main>
        </div>
      </div>
    `;

    els.appShell = appShell;
    els.topbar = qs('#topbarContainer');
    els.sidebar = qs('#sidebarContainer');
    els.pageTitle = qs('#pageTitle');
    els.pageContent = qs('#pageContent');
    els.sidebarNavMenu = qs('#sidebarNavMenu');
    els.sidebarMenuLoading = qs('#sidebarMenuLoading');

    state.layoutInitialized = true;

    window.loadAndRenderSidebarMenu = loadAndRenderSidebarMenu;

    await loadAndRenderSidebarMenu();
  }

  async function loadPage(pageKey) {
    const route = routes[pageKey] || routes.dashboard;

    if (!els.pageContent || !els.pageTitle) {
      throw new Error('Layout elements are not initialized.');
    }

    els.pageTitle.textContent = route.title;
    els.pageContent.innerHTML = '<div class="text-center py-5">در حال بارگذاری...</div>';

    try {
      const html = await fetchHtml(route.path);
      els.pageContent.innerHTML = html;

      await ensurePageScript(pageKey);

      if (typeof window.initializePage === 'function') {
        await window.initializePage(pageKey);
      }

      state.currentPageKey = pageKey;
    } catch (error) {
      console.error(error);
      els.pageContent.innerHTML = `
        <div class="alert alert-danger">
          خطا در بارگذاری صفحه.
        </div>
      `;
    }
  }

  async function handleRouteChange() {
    const pageKey = getCurrentPageKey();
    await loadPage(pageKey);
    renderSidebarMenu();
  }

  async function bootstrap() {
    try {
      await initializeLayout();
      await handleRouteChange();
      window.addEventListener('hashchange', handleRouteChange);
    } catch (error) {
      console.error(error);
      const appShell = qs('#appShell');
      if (appShell) {
        appShell.innerHTML = `
          <div class="container py-5">
            <div class="alert alert-danger">
              خطا در راه‌اندازی لایه اصلی برنامه.
            </div>
          </div>
        `;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
