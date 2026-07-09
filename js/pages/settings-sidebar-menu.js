(() => {
  'use strict';

  const SIDEBAR_API_BASE_URL = 'https://sidebar-menu-api.reza-msi89.workers.dev';

  const state = {
    items: [],
    filteredItems: [],
    editingId: null,
    isLoading: false,
    isSubmitting: false
  };

  const els = {
    pageRoot: null,
    form: null,
    itemId: null,
    title: null,
    itemType: null,
    route: null,
    routeGroup: null,
    icon: null,
    parentId: null,
    sortOrder: null,
    target: null,
    permissionKey: null,
    isActive: null,
    submitBtn: null,
    submitBtnText: null,
    resetBtn: null,
    cancelEditBtn: null,
    refreshBtn: null,
    newItemBtn: null,
    tableBody: null,
    emptyState: null,
    loadingState: null,
    formAlert: null,
    listAlert: null,
    filterType: null,
    filterStatus: null
  };

  function getToken() {
    return localStorage.getItem('token');
  }

  function getAuthHeaders(contentType = true) {
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

  function normalizeNullable(value) {
    if (value === undefined || value === null) return null;
    const normalized = String(value).trim();
    return normalized === '' ? null : normalized;
  }

  async function refreshSidebarIfAvailable() {
    if (typeof window.loadAndRenderSidebarMenu === 'function') {
      await window.loadAndRenderSidebarMenu(true);
    }
  }

  function sortMenuItems(items) {
    return [...items].sort((a, b) => {
      const parentA = a.parent_id ?? 0;
      const parentB = b.parent_id ?? 0;

      if (parentA !== parentB) {
        return parentA - parentB;
      }

      const orderA = Number(a.sort_order ?? 0);
      const orderB = Number(b.sort_order ?? 0);

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return String(a.title || '').localeCompare(String(b.title || ''), 'fa');
    });
  }

  function getParentTitle(parentId) {
    if (!parentId) return '—';
    const parent = state.items.find((item) => Number(item.id) === Number(parentId));
    return parent ? parent.title : '—';
  }

  function showFormAlert(message, type = 'danger') {
    if (!els.formAlert) return;
    els.formAlert.className = `alert alert-${type}`;
    els.formAlert.textContent = message;
    els.formAlert.classList.remove('d-none');
  }

  function hideFormAlert() {
    if (!els.formAlert) return;
    els.formAlert.classList.add('d-none');
    els.formAlert.textContent = '';
  }

  function showListAlert(message, type = 'danger') {
    if (!els.listAlert) return;
    els.listAlert.className = `alert alert-${type}`;
    els.listAlert.textContent = message;
    els.listAlert.classList.remove('d-none');
  }

  function hideListAlert() {
    if (!els.listAlert) return;
    els.listAlert.classList.add('d-none');
    els.listAlert.textContent = '';
  }

  function setFormSubmitting(isSubmitting) {
    state.isSubmitting = isSubmitting;

    if (els.submitBtn) {
      els.submitBtn.disabled = isSubmitting;
    }

    if (els.submitBtnText) {
      els.submitBtnText.textContent = isSubmitting
        ? 'در حال ذخیره...'
        : (state.editingId ? 'بروزرسانی آیتم' : 'ذخیره آیتم');
    }
  }

  function setLoading(isLoading) {
    state.isLoading = isLoading;

    if (els.loadingState) {
      els.loadingState.classList.toggle('d-none', !isLoading);
    }

    if (els.tableBody) {
      els.tableBody.classList.toggle('d-none', isLoading);
    }
  }

  function updateRouteVisibility() {
    if (!els.itemType || !els.routeGroup) return;

    const isLink = els.itemType.value === 'link';
    els.routeGroup.classList.toggle('d-none', !isLink);

    if (els.route) {
      els.route.disabled = !isLink;
      if (!isLink) {
        els.route.value = '';
      }
    }
  }

  function populateParentOptions() {
    if (!els.parentId) return;

    const currentId = state.editingId ? Number(state.editingId) : null;
    const parentCandidates = state.items.filter((item) => {
      if (item.item_type !== 'group') return false;
      if (currentId && Number(item.id) === currentId) return false;
      return true;
    });

    const options = ['<option value="">بدون والد (آیتم اصلی)</option>'].concat(
      sortMenuItems(parentCandidates).map((item) => (
        `<option value="${item.id}">${escapeHtml(item.title)}</option>`
      ))
    );

    els.parentId.innerHTML = options.join('');
  }

  function applyFiltersAndRender() {
    const filterType = els.filterType?.value || '';
    const filterStatus = els.filterStatus?.value || '';

    state.filteredItems = sortMenuItems(state.items).filter((item) => {
      const matchType = !filterType || item.item_type === filterType;
      const matchStatus =
        !filterStatus ||
        (filterStatus === 'active' && Number(item.is_active) === 1) ||
        (filterStatus === 'inactive' && Number(item.is_active) === 0);

      return matchType && matchStatus;
    });

    renderSidebarMenuAdminList();
    populateParentOptions();
  }

  function renderSidebarMenuAdminList() {
    if (!els.tableBody || !els.emptyState) return;

    if (!state.filteredItems.length) {
      els.tableBody.innerHTML = '';
      els.emptyState.classList.remove('d-none');
      return;
    }

    els.emptyState.classList.add('d-none');

    els.tableBody.innerHTML = state.filteredItems.map((item) => {
      const isActive = Number(item.is_active) === 1;
      const typeLabel = item.item_type === 'group' ? 'گروه' : 'لینک';
      const statusBadge = isActive
        ? '<span class="badge bg-success">فعال</span>'
        : '<span class="badge bg-secondary">غیرفعال</span>';

      return `
        <tr data-id="${item.id}">
          <td>${escapeHtml(item.title)}</td>
          <td>${escapeHtml(typeLabel)}</td>
          <td dir="ltr">${escapeHtml(item.route || '—')}</td>
          <td>${escapeHtml(getParentTitle(item.parent_id))}</td>
          <td>${escapeHtml(item.sort_order ?? 0)}</td>
          <td>${escapeHtml(item.permission_key || '—')}</td>
          <td>${statusBadge}</td>
          <td>
            <div class="d-flex flex-wrap gap-1">
              <button type="button" class="btn btn-sm btn-outline-primary" data-action="edit" data-id="${item.id}">ویرایش</button>
              <button type="button" class="btn btn-sm btn-outline-warning" data-action="toggle" data-id="${item.id}">
                ${isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}
              </button>
              <button type="button" class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${item.id}">حذف</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function fillForm(item) {
    if (!item) return;

    els.itemId.value = item.id ?? '';
    els.title.value = item.title ?? '';
    els.itemType.value = item.item_type ?? 'link';
    updateRouteVisibility();
    els.route.value = item.route ?? '';
    els.icon.value = item.icon ?? '';
    els.parentId.value = item.parent_id ?? '';
    els.sortOrder.value = item.sort_order ?? 0;
    els.target.value = item.target ?? '_self';
    els.permissionKey.value = item.permission_key ?? '';
    els.isActive.checked = Number(item.is_active) === 1;

    state.editingId = Number(item.id);

    if (els.submitBtnText) {
      els.submitBtnText.textContent = 'بروزرسانی آیتم';
    }

    if (els.cancelEditBtn) {
      els.cancelEditBtn.classList.remove('d-none');
    }

    hideFormAlert();
  }

  function resetForm() {
    state.editingId = null;

    if (els.form) {
      els.form.reset();
    }

    if (els.itemId) els.itemId.value = '';
    if (els.itemType) els.itemType.value = 'link';
    if (els.target) els.target.value = '_self';
    if (els.sortOrder) els.sortOrder.value = 0;
    if (els.isActive) els.isActive.checked = true;

    updateRouteVisibility();

    if (els.submitBtnText) {
      els.submitBtnText.textContent = 'ذخیره آیتم';
    }

    if (els.cancelEditBtn) {
      els.cancelEditBtn.classList.add('d-none');
    }

    hideFormAlert();
  }

  function getFormPayload() {
    const itemType = els.itemType.value;

    return {
      title: normalizeNullable(els.title.value),
      item_type: itemType,
      route: itemType === 'link' ? normalizeNullable(els.route.value) : null,
      icon: normalizeNullable(els.icon.value),
      parent_id: normalizeNullable(els.parentId.value) ? Number(els.parentId.value) : null,
      sort_order: Number(els.sortOrder.value || 0),
      target: normalizeNullable(els.target.value) || '_self',
      permission_key: normalizeNullable(els.permissionKey.value),
      is_active: els.isActive.checked ? 1 : 0
    };
  }

  function validatePayload(payload) {
    if (!payload.title) {
      return 'عنوان آیتم الزامی است.';
    }

    if (!['link', 'group'].includes(payload.item_type)) {
      return 'نوع آیتم معتبر نیست.';
    }

    if (payload.item_type === 'link' && !payload.route) {
      return 'برای آیتم نوع لینک، مسیر الزامی است.';
    }

    return null;
  }

  async function fetchSidebarMenuAdminList() {
    const response = await fetch(`${SIDEBAR_API_BASE_URL}/api/sidebar-menu/admin`, {
      method: 'GET',
      headers: getAuthHeaders(false)
    });

    if (!response.ok) {
      throw new Error('Failed to fetch sidebar menu admin list.');
    }

    return response.json();
  }

  async function createSidebarMenuItem(payload) {
    const response = await fetch(`${SIDEBAR_API_BASE_URL}/api/sidebar-menu`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to create sidebar menu item.');
    }

    return response.json();
  }

  async function updateSidebarMenuItem(id, payload) {
    const response = await fetch(`${SIDEBAR_API_BASE_URL}/api/sidebar-menu/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error('Failed to update sidebar menu item.');
    }

    return response.json();
  }

  async function deleteSidebarMenuItem(id) {
    const response = await fetch(`${SIDEBAR_API_BASE_URL}/api/sidebar-menu/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(false)
    });

    if (!response.ok) {
      throw new Error('Failed to delete sidebar menu item.');
    }

    return response.json().catch(() => ({}));
  }

  async function toggleSidebarMenuItem(id) {
    const response = await fetch(`${SIDEBAR_API_BASE_URL}/api/sidebar-menu/${id}/toggle`, {
      method: 'PATCH',
      headers: getAuthHeaders(true)
    });

    if (!response.ok) {
      throw new Error('Failed to toggle sidebar menu item.');
    }

    return response.json();
  }

  async function loadSidebarMenuAdminList() {
    setLoading(true);
    hideListAlert();

    try {
      const result = await fetchSidebarMenuAdminList();
      state.items = Array.isArray(result?.data) ? result.data : Array.isArray(result) ? result : [];
      applyFiltersAndRender();
    } catch (error) {
      console.error(error);
      state.items = [];
      state.filteredItems = [];
      renderSidebarMenuAdminList();
      showListAlert('خطا در دریافت لیست منوها.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMenuFormSubmit(event) {
    event.preventDefault();

    if (state.isSubmitting) return;

    hideFormAlert();

    const payload = getFormPayload();
    const validationError = validatePayload(payload);

    if (validationError) {
      showFormAlert(validationError);
      return;
    }

    setFormSubmitting(true);

    try {
      if (state.editingId) {
        await updateSidebarMenuItem(state.editingId, payload);
      } else {
        await createSidebarMenuItem(payload);
      }

      resetForm();
      await loadSidebarMenuAdminList();
      await refreshSidebarIfAvailable();
      showFormAlert('اطلاعات با موفقیت ذخیره شد.', 'success');
    } catch (error) {
      console.error(error);
      showFormAlert('ذخیره آیتم با خطا مواجه شد.');
    } finally {
      setFormSubmitting(false);
    }
  }

  function handleEditMenuItem(id) {
    const item = state.items.find((entry) => Number(entry.id) === Number(id));
    if (!item) return;
    fillForm(item);
  }

  async function handleToggleMenuItem(id) {
    try {
      hideListAlert();
      await toggleSidebarMenuItem(id);
      await loadSidebarMenuAdminList();
      await refreshSidebarIfAvailable();
    } catch (error) {
      console.error(error);
      showListAlert('تغییر وضعیت آیتم با خطا مواجه شد.');
    }
  }

  async function handleDeleteMenuItem(id) {
    const confirmed = window.confirm('آیا از حذف این آیتم مطمئن هستید؟');
    if (!confirmed) return;

    try {
      hideListAlert();
      await deleteSidebarMenuItem(id);

      if (state.editingId && Number(state.editingId) === Number(id)) {
        resetForm();
      }

      await loadSidebarMenuAdminList();
      await refreshSidebarIfAvailable();
    } catch (error) {
      console.error(error);
      showListAlert('حذف آیتم با خطا مواجه شد.');
    }
  }

  function handleTableActions(event) {
    const button = event.target.closest('[data-action][data-id]');
    if (!button) return;

    const { action, id } = button.dataset;

    if (action === 'edit') {
      handleEditMenuItem(id);
      return;
    }

    if (action === 'toggle') {
      handleToggleMenuItem(id);
      return;
    }

    if (action === 'delete') {
      handleDeleteMenuItem(id);
    }
  }

  function bindEvents() {
    if (els.form) {
      els.form.addEventListener('submit', handleMenuFormSubmit);
    }

    if (els.itemType) {
      els.itemType.addEventListener('change', updateRouteVisibility);
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener('click', resetForm);
    }

    if (els.cancelEditBtn) {
      els.cancelEditBtn.addEventListener('click', resetForm);
    }

    if (els.refreshBtn) {
      els.refreshBtn.addEventListener('click', async () => {
        await loadSidebarMenuAdminList();
        await refreshSidebarIfAvailable();
      });
    }

    if (els.newItemBtn) {
      els.newItemBtn.addEventListener('click', resetForm);
    }

    if (els.filterType) {
      els.filterType.addEventListener('change', applyFiltersAndRender);
    }

    if (els.filterStatus) {
      els.filterStatus.addEventListener('change', applyFiltersAndRender);
    }

    if (els.tableBody) {
      els.tableBody.addEventListener('click', handleTableActions);
    }
  }

  function cacheElements() {
    els.pageRoot = qs('[data-page-root="settings-sidebar-menu"]') || document;
    els.form = qs('#sidebarMenuForm', els.pageRoot);
    els.itemId = qs('#menuItemId', els.pageRoot);
    els.title = qs('#menuTitle', els.pageRoot);
    els.itemType = qs('#menuItemType', els.pageRoot);
    els.route = qs('#menuRoute', els.pageRoot);
    els.routeGroup = qs('#menuRouteGroup', els.pageRoot);
    els.icon = qs('#menuIcon', els.pageRoot);
    els.parentId = qs('#menuParentId', els.pageRoot);
    els.sortOrder = qs('#menuSortOrder', els.pageRoot);
    els.target = qs('#menuTarget', els.pageRoot);
    els.permissionKey = qs('#menuPermissionKey', els.pageRoot);
    els.isActive = qs('#menuIsActive', els.pageRoot);
    els.submitBtn = qs('#menuSubmitBtn', els.pageRoot);
    els.submitBtnText = qs('#menuSubmitBtnText', els.pageRoot);
    els.resetBtn = qs('#menuResetBtn', els.pageRoot);
    els.cancelEditBtn = qs('#menuCancelEditBtn', els.pageRoot);
    els.refreshBtn = qs('#menuRefreshBtn', els.pageRoot);
    els.newItemBtn = qs('#menuNewItemBtn', els.pageRoot);
    els.tableBody = qs('#sidebarMenuTableBody', els.pageRoot);
    els.emptyState = qs('#sidebarMenuEmptyState', els.pageRoot);
    els.loadingState = qs('#sidebarMenuLoadingState', els.pageRoot);
    els.formAlert = qs('#sidebarMenuFormAlert', els.pageRoot);
    els.listAlert = qs('#sidebarMenuListAlert', els.pageRoot);
    els.filterType = qs('#menuFilterType', els.pageRoot);
    els.filterStatus = qs('#menuFilterStatus', els.pageRoot);
  }

  async function initializeSidebarMenuPage() {
    cacheElements();

    if (!els.form || !els.tableBody) {
      console.warn('settings-sidebar-menu page elements not found.');
      return;
    }

    bindEvents();
    resetForm();
    await loadSidebarMenuAdminList();
  }

  const previousInitializePage = window.initializePage;

  window.initializePage = async function(pageKey) {
    if (typeof previousInitializePage === 'function') {
      await previousInitializePage(pageKey);
    }

    if (pageKey !== 'settings-sidebar-menu') {
      return;
    }

    await initializeSidebarMenuPage();
  };
})();
