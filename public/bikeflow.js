const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const norm = (value) => value.toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
let customersData = [];
let selectedCustomerId = null;
const saveCustomers = () => {};
let ordersData = [];
let selectedOrderId = null;
const saveOrders = () => {};
const money = (cents) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const moneyToCents = (value) => {
  const raw = String(value ?? '').trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!raw) return null;
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
};
const lineGross = (line) => Math.round(Number(line.quantity) * Number(line.price));
const lineTotal = (line) => Math.max(0, lineGross(line) - Number(line.discountCents || 0) + Number(line.surchargeCents || 0));
const orderTotal = (order) => Math.max(0, [...order.services, ...order.parts].reduce((sum, line) => sum + lineTotal(line), 0) - Number(order.generalDiscountCents || 0) + Number(order.generalSurchargeCents || 0));
const deadlineTimestamp = (value) => { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || ''); if (!match) return null; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const date = new Date(year, month - 1, day); return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date.getTime() : null; };
const isOrderOverdue = (order) => { const deadline = deadlineTimestamp(order.expected); const today = new Date(); today.setHours(0, 0, 0, 0); return !['READY', 'COMPLETED', 'CANCELLED'].includes(order.status) && (order.overdue === true || (deadline !== null && deadline < today.getTime())); };
const formatDeadline = (value) => { const timestamp = deadlineTimestamp(value); return timestamp === null ? (value || 'Sem previsão') : new Date(timestamp).toLocaleDateString('pt-BR'); };
const displayDeadline = (order) => order.expected ? formatDeadline(order.expected) : (order.expectedNote || 'Sem previsão');
const mapWorkOrder = (order) => {
  const mapped = {
    id: order.id, number: order.number, version: order.version, workshopName: order.workshop?.name,
    workshop: order.workshop, customerId: order.customerSnapshotId || order.bike.customerId, customer: order.customerSnapshotData || order.customerSnapshot || order.bike?.customer,
    bikeId: order.bikeId, bike: order.bikeSnapshotData || order.bike, status: order.status, priority: order.priority || 'NORMAL', complaint: order.complaint,
    diagnosis: order.diagnosis || '', technicalRecommendations: order.technicalRecommendations || '', technicalNotes: order.technicalNotes || '',
    expected: order.expectedDate?.slice(0, 10) || '', expectedNote: order.expectedNote || '', createdAt: order.createdAt, startedAt: order.startedAt,
    readyAt: order.readyAt, completedAt: order.completedAt, executionPausedAt: order.executionPausedAt, stockConsumed: order.stockConsumed,
    assignedMechanicId: order.assignedMechanicId, assignedMechanicName: order.assignedMechanic?.user?.name || order.assignedMechanicName,
    approvalStatus: order.approvalStatus, approvalNote: order.approvalNote, approvalDecidedAt: order.approvalDecidedAt,
    services: (order.services || []).map((line) => ({ id: line.id, catalogId: line.serviceCatalogItemId, name: line.nameSnapshot, quantity: Number(line.quantity), price: line.unitPriceCents, discountCents: line.discountCents || 0, surchargeCents: line.surchargeCents || 0, status: line.status || 'PENDING', performedById: line.performedById, completedAt: line.completedAt })),
    parts: (order.parts || []).map((line) => ({ id: line.id, inventoryId: line.inventoryItemId, name: line.nameSnapshot, quantity: Number(line.quantity), price: line.unitPriceCents, discountCents: line.discountCents || 0, surchargeCents: line.surchargeCents || 0, status: line.status || 'PENDING', stock: Number(line.inventoryItem?.quantity || 0), reserved: Number(line.inventoryItem?.reservedQuantity || 0), available: Number(line.inventoryItem?.availableQuantity ?? Number(line.inventoryItem?.quantity || 0) - Number(line.inventoryItem?.reservedQuantity || 0)), location: line.locationSnapshot || line.inventoryItem?.location })),
    checklist: order.checklistSnapshot || undefined, checklists: order.checklists || [], quotes: order.quotes || [], pendings: order.pendings || [], timeline: order.timeline || [], attachments: order.attachments || [], workSessions: order.workSessions || [], activities: order.activities || [],
    laborSubtotalCents: order.laborSubtotalCents, partsSubtotalCents: order.partsSubtotalCents, totalCents: order.totalCents, paymentStatus: order.paymentStatus,
    generalDiscountCents: order.generalDiscountCents || 0, generalDiscountType: order.generalDiscountType || 'FIXED', generalDiscountValue: String(order.generalDiscountValue || 0), generalSurchargeCents: order.generalSurchargeCents || 0,
  };
  mapped.overdue = isOrderOverdue(mapped); return mapped;
};
const statusInfo = { OPEN: ['Aberta', 'open'], IN_PROGRESS: ['Em serviço', 'progress'], READY: ['Pronta', 'ready'], COMPLETED: ['Finalizada', 'ready'], CANCELLED: ['Cancelada', 'late'] };
let inventoryData = [];
let inventoryMeta = { total: 0, page: 1, size: 16, pageCount: 0, locations: [], summary: { registered: 0, available: 0, low: 0, zero: 0, reorder: 0, totalCostCents: 0, movementsToday: 0 } };
const inventoryFilters = { search: '', categoryId: '', brandId: '', location: '', status: 'all', sort: 'name_asc', page: 1, size: 16 };
let inventoryInsights = { lowItems: [], usedItems: [] };
let movementsData = [];
let catalogPartsData = [];
let catalogBrandsData = [];
let catalogCategoriesData = [];
const saveInventory = () => {};
const movementLabels = { STOCK_ENTRY: 'Entrada', STOCK_RESERVATION: 'Reserva', RESERVATION_RELEASE: 'Liberação de reserva', WORK_ORDER_USE: 'Baixa em OS', WORK_ORDER_REVERSAL: 'Reversão de OS', MANUAL_ADJUSTMENT: 'Ajuste manual', ADJUSTMENT_IN: 'Ajuste de entrada', ADJUSTMENT_OUT: 'Ajuste de saída', MANUAL_EXIT: 'Saída manual' };
const manualExitReasonLabels = { USO_INTERNO: 'Uso interno', PERDA: 'Perda', DANO: 'Dano', DEVOLUCAO: 'Devolução', OUTRO: 'Outro' };
const unitFromApi = { UNIT: 'un', METER: 'm', MILLILITER: 'ml', GRAM: 'g' };
const catalogPartDisplayName = (part) => part ? [part.name, part.model && !norm(part.name).includes(norm(part.model)) ? part.model : ''].filter(Boolean).join(' · ') : '';
const mapInventoryItem = (item) => ({ ...item, name: item.customName || catalogPartDisplayName(item.catalogPart), shortName: item.customName || catalogPartDisplayName(item.catalogPart), category: item.category?.name || item.catalogPart?.category?.name || 'Personalizada', categoryId: item.categoryId || item.catalogPart?.categoryId || '', brand: item.brand?.name || '', description: item.catalogPart?.description || '', quantity: Number(item.physicalQuantity ?? item.quantity), reserved: Number(item.reservedQuantity || 0), available: Number(item.availableQuantity ?? Number(item.quantity) - Number(item.reservedQuantity || 0)), minimum: Number(item.minimumQuantity), cost: Number(item.costPriceCents || 0), price: item.salePriceCents, unit: unitFromApi[item.unitOfMeasure] || 'un' });
let servicesData = [];
const saveServices = () => {};
let checklistsData = [];
let bikeChecklistsData = [];
let checklistSuggestionsData = [];
const saveChecklists = () => {};
let hydrationFailed = false;

function toast(message, type = '') {
  let stack = $('.toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.append(stack);
  }
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.textContent = message;
  stack.append(item);
  setTimeout(() => item.remove(), 3200);
}

const appHash = () => { try { return window.parent.location.hash.slice(1); } catch { return location.hash.slice(1); } };
const writeAppHash = (value, replace = false) => {
  const method = replace ? 'replaceState' : 'pushState';
  history[method](null, '', `#${value}`);
  try { window.parent.history[method](null, '', `/#${value}`); } catch {}
};
let modalReturnFocus = null;
function makeClickable(element, handler, label) {
  element.tabIndex = 0; element.setAttribute('role', 'button');
  if (label) element.setAttribute('aria-label', label);
  element.onclick = handler;
  element.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); handler(); } };
}
function trapModal(modal, event) {
  if (event.key !== 'Tab') return;
  const focusable = $$('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex="0"]', modal);
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

function showPage(id, hashValue = id, replace = false) {
  $$('.page').forEach((page) => page.classList.remove('active'));
  const page = document.getElementById(id);
  if (!page) return toast('Esta área entra na próxima etapa do respectivo módulo.');
  page.classList.add('active');
  $$('.nav-item').forEach((item) => item.classList.remove('active'));
  $$(`.nav-item[data-page="${id}"]`).forEach((item) => item.classList.add('active'));
  document.body.dataset.currentPage = id;
  const globalInput = $('.global-search input'); const scanButton = $('#inventory-scan'); const primaryAction = $('#context-primary-action');
  if (scanButton) scanButton.hidden = id !== 'inventory';
  if (globalInput) { globalInput.placeholder = id === 'inventory' ? 'Buscar peça, código, marca ou categoria...' : 'Buscar cliente, bike, OS ou peça...'; if (id === 'inventory') globalInput.value = inventoryFilters.search; else if (document.body.dataset.previousPage === 'inventory') globalInput.value = ''; }
  if (primaryAction) { primaryAction.textContent = id === 'inventory' ? '+ Adicionar peça' : '+ Nova OS'; primaryAction.onclick = id === 'inventory' ? () => window.openInventoryEntry?.() : () => openModal('new-order'); }
  document.body.dataset.previousPage = id;
  if (appHash() !== hashValue) writeAppHash(hashValue, replace);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modalReturnFocus = document.activeElement; modal.classList.add('show');
  modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
  modal.onkeydown = (event) => trapModal(modal, event);
  setTimeout(() => $('input,select,textarea,button', modal)?.focus(), 20);
}

function closeModal(id) { const modal = document.getElementById(id); modal?.classList.remove('show'); modalReturnFocus?.focus?.(); modalReturnFocus = null; }

function formModal({ title, description = '', fields = [], confirm = 'Salvar', action }) {
  modalReturnFocus = document.activeElement;
  $('#dynamic-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'dynamic-modal';
  wrap.className = 'modal-wrap show';
  wrap.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="dynamic-title"><div class="modal-head"><h2 id="dynamic-title"></h2><p></p></div><div class="modal-body"><div class="form-grid"></div></div><div class="modal-foot"><button class="btn" data-cancel>Cancelar</button><button class="btn primary" data-confirm></button></div></div>`;
  $('#dynamic-title', wrap).textContent = title;
  $('.modal-head p', wrap).textContent = description;
  $('[data-confirm]', wrap).textContent = confirm;
  const grid = $('.form-grid', wrap);
  fields.forEach((field) => {
    const holder = document.createElement('div'); holder.className = 'field';
    const label = document.createElement('label'); label.textContent = `${field.label}${field.required ? ' *' : ''}`;
    const control = field.type === 'textarea' ? document.createElement('textarea') : field.type === 'select' ? document.createElement('select') : document.createElement('input');
    control.name = field.name; control.required = !!field.required; control.id = `dynamic-${field.name}`; label.htmlFor = control.id;
    if (field.type && !['textarea', 'select'].includes(field.type)) control.type = field.type;
    if (field.inputMode) control.inputMode = field.inputMode;
    if (field.disabled) control.disabled = true;
    if (field.placeholder) control.placeholder = field.placeholder;
    (field.options || []).forEach((option) => control.add(new Option(typeof option === 'string' ? option : option.label, typeof option === 'string' ? option : option.value)));
    if (field.value) control.value = field.value;
    if (field.onChange) control.addEventListener('change', () => field.onChange(control, wrap));
    holder.append(label, control); grid.append(holder);
  });
  const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; };
  $('[data-cancel]', wrap).onclick = close;
  wrap.onclick = (event) => { if (event.target === wrap) close(); };
  wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
  $('[data-confirm]', wrap).onclick = async () => {
    $$('.field-error', wrap).forEach((error) => error.remove());
    const controls = $$('input,select,textarea', wrap);
    controls.forEach((control) => { control.classList.remove('invalid'); control.removeAttribute('aria-invalid'); control.removeAttribute('aria-describedby'); });
    const missing = controls.find((control) => control.required && !control.value.trim());
    if (missing) {
      missing.classList.add('invalid');
      missing.setAttribute('aria-invalid', 'true');
      const error = document.createElement('span'); error.className = 'field-error'; error.id = `${missing.id}-error`; error.textContent = `${missing.previousElementSibling?.textContent.replace(/\s\*$/, '') || 'Este campo'} é obrigatório.`; missing.setAttribute('aria-describedby', error.id);
      missing.parentElement.append(error); missing.focus(); return;
    }
    const values = Object.fromEntries(controls.map((control) => [control.name, control.value.trim()]));
    const confirmButton = $('[data-confirm]', wrap); confirmButton.disabled = true;
    try { if (await action(values) !== false) close(); } finally { confirmButton.disabled = false; }
  };
  document.body.append(wrap);
  setTimeout(() => $('input,select,textarea,button', wrap)?.focus(), 20);
}

const findButton = (text, root = document) => $$('button', root).find((button) => button.textContent.trim().includes(text));
async function api(path, options = {}) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(body.error || `Não foi possível concluir a operação (HTTP ${response.status}).`); error.code = body.code; error.status = response.status; throw error; }
  return body.data;
}
function filter(input, rows) {
  const query = norm(input.value.trim());
  rows.forEach((row) => row.classList.toggle('is-hidden', !!query && !norm(row.textContent).includes(query)));
}

function navigation() {
  $$('.nav-item[data-page]').forEach((item) => item.onclick = () => showPage(item.dataset.page));
  $$('[data-page-link]').forEach((item) => item.onclick = () => showPage(item.dataset.pageLink));
  $$('.nav-item:not([data-page])').forEach((item) => item.onclick = () => toast(`${item.textContent.trim()} será implementado na etapa desse módulo.`));
  const sync = async () => {
    const [page, id] = appHash().split('/');
    if (page === 'order-detail' && id) { await window.openOrder(id); return; }
    if (page && document.getElementById(page)) showPage(page, appHash(), true);
  };
  queueMicrotask(() => void sync());
  try { window.parent.addEventListener('popstate', () => void sync()); } catch {}
}

function globalSearch() {
  const input = $('.global-search input');
  const run = async () => {
    const query = norm(input.value.trim());
    if (query) {
      try {
        const result = await api(`/api/search?q=${encodeURIComponent(input.value.trim())}`);
        if (result.workOrders.length) { await window.openOrder(result.workOrders[0].id); return; }
        if (result.customers.length) { showPage('customers'); const local = $('#customers .searchbox input'); if (local) { local.value = input.value; local.dispatchEvent(new Event('input')); } return; }
        if (result.bikes.length) { showPage('customers'); const local = $('#customers .searchbox input'); if (local) { local.value = result.bikes[0].model; local.dispatchEvent(new Event('input')); } return; }
        if (result.inventory.length) { const inventoryQuery = input.value.trim(); showPage('inventory'); window.setInventorySearch?.(inventoryQuery); return; }
        return toast('Nenhum resultado encontrado.', 'error');
      } catch (error) { return toast(error.message, 'error'); }
    }
    if (!query) return toast('Digite um cliente, bike, OS ou peça.', 'error');
    const targets = [['orders', $$('#orders .table-row')], ['customers', $$('#customers .table-row')], ['inventory', $$('#inventory .stock-card')], ['catalog', $$('#catalog .part-row')]];
    for (const [page, rows] of targets) {
      if (rows.some((row) => norm(row.textContent).includes(query))) {
        showPage(page);
        const local = $(`#${page} .searchbox input`);
        if (local) { local.value = input.value; local.dispatchEvent(new Event('input')); }
        return toast('Resultados encontrados.', 'success');
      }
    }
    toast('Nenhum resultado encontrado.', 'error');
  };
  input.onkeydown = (event) => { if (event.key === 'Enter') run(); };
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); input.focus(); input.select(); }
    if (event.key === 'Escape') $$('.modal-wrap.show').forEach((modal) => closeModal(modal.id));
  });
}

function orders() {
  const page = $('#orders'); const table = $('.table', page); const search = $('.searchbox input', page); const rejectedToggle = $('#show-rejected-orders', page);
  let segmentFilter = 'ACTIVE'; let statusFilter = 'ALL'; let deadlineFilter = 'NONE';
  const statusLabels = { ALL: 'Todos', OPEN: 'Aberta', IN_PROGRESS: 'Em serviço', READY: 'Pronta', COMPLETED: 'Finalizada', CANCELLED: 'Cancelada', OVERDUE: 'Atrasada' };
  const deadlineLabels = { NONE: 'Prazo', NEAREST: 'Mais próximos', FARTHEST: 'Mais distantes', OVERDUE: 'Atrasados' };
  const segmentButtons = $$('.segment button', page);
  const setSegment = (value) => { segmentFilter = value; segmentButtons.forEach((button, index) => button.classList.toggle('active', ['ACTIVE', 'READY', 'FINISHED'][index] === value)); };
  const applyFilters = () => {
    const query = norm(search.value.trim()); const rows = $$('.table-row', table);
    rows.sort((left, right) => {
      const a = ordersData.find((order) => order.id === left.dataset.orderId); const b = ordersData.find((order) => order.id === right.dataset.orderId);
      if (deadlineFilter === 'NONE' || deadlineFilter === 'OVERDUE') return b.number - a.number;
      const missing = deadlineFilter === 'NEAREST' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
      const aTime = deadlineTimestamp(a.expected) ?? missing; const bTime = deadlineTimestamp(b.expected) ?? missing;
      return deadlineFilter === 'NEAREST' ? aTime - bTime || b.number - a.number : bTime - aTime || b.number - a.number;
    }).forEach((row) => table.append(row));
    rows.forEach((row) => {
      const order = ordersData.find((item) => item.id === row.dataset.orderId);
      const rejectionMatch = rejectedToggle.checked || order.approvalStatus !== 'REJECTED';
      const segmentMatch = rejectionMatch && (segmentFilter === 'ACTIVE' ? !['READY', 'COMPLETED', 'CANCELLED'].includes(order.status) : segmentFilter === 'READY' ? order.status === 'READY' : ['COMPLETED', 'CANCELLED'].includes(order.status));
      const statusMatch = statusFilter === 'ALL' || (statusFilter === 'OVERDUE' ? isOrderOverdue(order) : order.status === statusFilter);
      const deadlineMatch = deadlineFilter !== 'OVERDUE' || isOrderOverdue(order);
      row.classList.toggle('is-hidden', !(segmentMatch && statusMatch && deadlineMatch && (!query || norm(row.textContent).includes(query))));
    });
  };
  const render = () => {
    $$('.table-row', table).forEach((row) => row.remove());
    ordersData.sort((a, b) => b.number - a.number).forEach((order) => {
      const customer = customersData.find((item) => item.id === order.customerId); const bike = customer?.bikes.find((item) => item.id === order.bikeId);
      order.overdue = isOrderOverdue(order); const [label, css] = order.approvalStatus === 'REJECTED' ? ['Orçamento recusado', 'late'] : order.overdue ? ['Atrasada', 'late'] : statusInfo[order.status];
      const row = document.createElement('div'); row.className = 'table-row clickable'; row.dataset.status = order.status; row.dataset.orderId = order.id;
      row.innerHTML = `<div class="os-no">#${order.number}</div><div><b></b><div class="item-sub"></div></div><div></div><div><span class="status ${css}"><span class="dot"></span>${label}</span></div><div></div><div class="money"></div>`;
      $('b', row).textContent = bike ? `${bike.brand} ${bike.model}` : 'Bike arquivada'; $('.item-sub', row).textContent = bike ? `${bike.type || 'OTHER'} · aro ${bike.wheel || '—'}` : '';
      row.children[2].textContent = customer?.name || 'Cliente arquivado'; row.children[4].textContent = displayDeadline(order); if (order.overdue) row.children[4].style.color = 'var(--destructive)'; row.children[5].textContent = orderTotal(order) ? money(orderTotal(order)) : '—';
      makeClickable(row, () => openOrder(order.id), `Abrir OS ${order.number}`); table.append(row);
    });
    applyFilters(); updateDashboard();
  };
  const openOrder = async (id) => { try { const detail = mapWorkOrder(await api(`/api/work-orders/${id}`)); const index = ordersData.findIndex((item) => item.id === id); if (index >= 0) ordersData.splice(index, 1, detail); else ordersData.push(detail); selectedOrderId = id; renderOrderDetail(); showPage('order-detail', `order-detail/${id}`); } catch (error) { toast(error.message, 'error'); } };
  window.openOrder = openOrder;
  window.openOrder = openOrder; window.renderOrders = render;
  search.oninput = applyFilters;
  rejectedToggle.onchange = async () => {
    rejectedToggle.disabled = true;
    try { const remote = await api(`/api/work-orders?pageSize=100&includeRejected=${rejectedToggle.checked}`); ordersData = remote.items.map(mapWorkOrder); saveOrders(); render(); }
    catch (error) { rejectedToggle.checked = !rejectedToggle.checked; toast(error.message, 'error'); }
    finally { rejectedToggle.disabled = false; }
  };
  segmentButtons.forEach((button, index) => button.onclick = () => {
    segmentFilter = ['ACTIVE', 'READY', 'FINISHED'][index]; applyFilters();
  });
  const status = findButton('Status', page); const deadline = findButton('Prazo', page);
  status.onclick = () => {
    const choices = ['ALL', 'OPEN', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED', 'OVERDUE'];
    statusFilter = choices[(choices.indexOf(statusFilter) + 1) % choices.length]; status.textContent = `${statusLabels[statusFilter]} ▾`;
    if (['OPEN', 'IN_PROGRESS', 'OVERDUE'].includes(statusFilter)) setSegment('ACTIVE'); else if (statusFilter === 'READY') setSegment('READY'); else if (['COMPLETED', 'CANCELLED'].includes(statusFilter)) setSegment('FINISHED');
    applyFilters();
  };
  deadline.onclick = () => { const choices = ['NONE', 'NEAREST', 'FARTHEST', 'OVERDUE']; deadlineFilter = choices[(choices.indexOf(deadlineFilter) + 1) % choices.length]; deadline.textContent = `${deadlineLabels[deadlineFilter]} ▾`; if (deadlineFilter === 'OVERDUE') setSegment('ACTIVE'); applyFilters(); };
  render();
}

function newOrder() {
  const modal = $('#new-order'); const create = findButton('Criar OS', modal);
  const customerInput = $('input', modal); const bikeSelect = $('select', modal);
  const updateBikes = () => {
    const customer = customersData.find((item) => item.active && (norm(item.name) === norm(customerInput.value.trim()) || norm(item.phone) === norm(customerInput.value.trim())));
    bikeSelect.innerHTML = '<option>Selecione uma bike...</option>';
    (customer?.bikes || []).forEach((bike) => bikeSelect.add(new Option(`${bike.brand} ${bike.model}`, bike.id)));
  };
  customerInput.setAttribute('list', 'customer-options');
  const dataList = document.createElement('datalist'); dataList.id = 'customer-options';
  customersData.filter((item) => item.active).forEach((item) => { const option = document.createElement('option'); option.value = item.name; option.label = item.phone; dataList.append(option); });
  modal.append(dataList); customerInput.oninput = updateBikes;
  $('#quick-new-customer').onclick = () => window.openNewCustomer?.((customer) => {
    customerInput.value = customer.name;
    updateBikes();
    setTimeout(() => window.openNewBike?.(customer, (bike) => { updateBikes(); bikeSelect.value = bike.id; }), 0);
  });
  $('#quick-new-bike').onclick = () => {
    const customer = customersData.find((item) => item.active && (norm(item.name) === norm(customerInput.value.trim()) || norm(item.phone) === norm(customerInput.value.trim())));
    if (!customer) return toast('Selecione um cliente antes de cadastrar a bicicleta.', 'error');
    window.openNewBike?.(customer, (bike) => { updateBikes(); bikeSelect.value = bike.id; });
  };
  create.removeAttribute('onclick');
  create.onclick = async () => {
    const [customer, bikeId, complaint, date, note] = $$('input,select,textarea', modal).map((control) => control.value.trim());
    const customerRecord = customersData.find((item) => item.active && (norm(item.name) === norm(customer) || norm(item.phone) === norm(customer)));
    const bikeRecord = customerRecord?.bikes.find((bike) => bike.id === bikeId);
    if (!customerRecord || !bikeRecord || !complaint) return toast('Selecione um cliente cadastrado, uma bike e informe o problema.', 'error');
    let order; try { order = mapWorkOrder(await api('/api/work-orders', { method: 'POST', body: JSON.stringify({ bikeId: bikeRecord.id, complaint, expectedDate: date || null, expectedNote: note || undefined }) })); } catch (error) { return toast(error.message, 'error'); }
    ordersData.push(order); customerRecord.lastOrder = `#${order.number}`; saveOrders(); saveCustomers();
    $$('input,textarea', modal).forEach((control) => control.value = ''); $('select', modal).selectedIndex = 0;
    closeModal('new-order'); window.renderOrders(); window.openOrder(order.id); toast(`OS #${order.number} criada com sucesso.`, 'success');
  };
}

function orderDetail() {
  const page = $('#order-detail'); let timer;
  const reload = async () => { if (!selectedOrderId) return null; const mapped = mapWorkOrder(await api(`/api/work-orders/${selectedOrderId}`)); const index = ordersData.findIndex((item) => item.id === selectedOrderId); if (index >= 0) ordersData.splice(index, 1, mapped); else ordersData.push(mapped); saveOrders(); renderOrderDetail(); window.renderOrders?.(); return mapped; };
  const diagnosisFields = [$('#order-diagnosis'), $('#order-recommendations'), $('#order-technical-notes')];
  diagnosisFields.forEach((field) => field.oninput = () => { const state = $('#diagnosis-save-state'); state.textContent = 'Salvando…'; clearTimeout(timer); timer = setTimeout(async () => { const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return; try { await api(`/api/work-orders/${order.id}/diagnosis`, { method: 'PATCH', body: JSON.stringify({ diagnosis: diagnosisFields[0].value, recommendations: diagnosisFields[1].value || null, technicalNotes: diagnosisFields[2].value || null }) }); order.diagnosis = diagnosisFields[0].value; order.technicalRecommendations = diagnosisFields[1].value; order.technicalNotes = diagnosisFields[2].value; state.textContent = 'Todas as alterações salvas'; $('#order-save-state').textContent = 'Todas as alterações salvas'; } catch (error) { state.textContent = 'Erro ao salvar'; toast(error.message, 'error'); } }, 650); });
  findButton('Adicionar serviço', page).onclick = () => { const active = servicesData.filter((item) => item.active); if (!active.length) return toast('Nenhum serviço ativo cadastrado.', 'error'); formModal({ title: 'Adicionar serviço', description: 'Preço e garantia virão do catálogo e serão congelados nesta OS.', fields: [{ name: 'serviceCatalogItemId', label: 'Serviço', type: 'select', required: true, options: [{ label: 'Selecione', value: '' }, ...active.map((item) => ({ label: `${item.name} · ${money(item.price)}`, value: item.id }))] }, { name: 'quantity', label: 'Quantidade', type: 'number', required: true, value: '1' }], confirm: 'Adicionar serviço', action: async (values) => { try { await api(`/api/work-orders/${selectedOrderId}/services`, { method: 'POST', body: JSON.stringify({ serviceCatalogItemId: values.serviceCatalogItemId, quantity: Number(values.quantity) }) }); await reload(); toast('Serviço adicionado com preço do catálogo.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } }); };
  findButton('Adicionar peça', page).onclick = () => { const active = inventoryData.filter((item) => item.active !== false); if (!active.length) return toast('Nenhuma peça cadastrada no estoque.', 'error'); formModal({ title: 'Adicionar peça', description: 'Preço virá do estoque. Reserva ocorrerá conforme aprovação e política da oficina.', fields: [{ name: 'inventoryItemId', label: 'Peça', type: 'select', required: true, options: [{ label: 'Selecione', value: '' }, ...active.map((item) => ({ label: `${item.name}${item.brand ? ` · ${item.brand}` : ''} · ${item.available ?? item.quantity} disponível(is) · ${money(item.price)}`, value: item.id }))] }, { name: 'quantity', label: 'Quantidade', type: 'number', required: true, value: '1' }], confirm: 'Adicionar peça', action: async (values) => { try { await api(`/api/work-orders/${selectedOrderId}/parts`, { method: 'POST', body: JSON.stringify({ inventoryItemId: values.inventoryItemId, quantity: Number(values.quantity) }) }); await reload(); toast('Peça adicionada com preço do estoque.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } }); };
  window.applyChecklistToOrder = () => { const templates = checklistsData.filter((item) => item.active !== false); if (!templates.length) return toast('Nenhum template de checklist ativo.', 'error'); formModal({ title: 'Adicionar checklist', description: 'Template será copiado; alterações futuras não mudarão este checklist.', fields: [{ name: 'templateId', label: 'Checklist', type: 'select', required: true, options: [{ label: 'Selecione', value: '' }, ...templates.map((item) => ({ label: `${item.name} · ${item.items.length} itens`, value: item.id }))] }, { name: 'type', label: 'Tipo', type: 'select', options: [{ label: 'Técnico', value: 'TECHNICAL' }, { label: 'Entrada', value: 'ENTRY' }, { label: 'Entrega', value: 'DELIVERY' }] }, { name: 'required', label: 'Obrigatório para finalizar?', type: 'select', options: [{ label: 'Não', value: 'false' }, { label: 'Sim', value: 'true' }] }], confirm: 'Adicionar checklist', action: async (values) => { try { await api(`/api/work-orders/${selectedOrderId}/checklists`, { method: 'POST', body: JSON.stringify({ templateId: values.templateId, type: values.type, required: values.required === 'true' }) }); await reload(); toast('Checklist completo adicionado à OS.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } }); };
  $('#add-order-checklist').onclick = window.applyChecklistToOrder;
  $('#add-order-attachment').onclick = () => uploadOrderAttachment(reload);
  $('#create-order-checklist').onclick = () => showPage('checklists');
  $('#order-more').onclick = openOrderActions;
  const ready = findButton('Confirmar e marcar pronta', $('#ready'));
  ready.removeAttribute('onclick');
  ready.onclick = async () => { const label = ready.textContent; ready.disabled = true; ready.textContent = 'Processando...'; try { await markOrderReady(); } finally { ready.disabled = false; ready.textContent = label; } };
  $('#generate-quote').onclick = () => generateQuote(reload);
  $('#send-quote').onclick = () => sendLatestQuote(reload);
  $('#approve-quote').onclick = () => decideLatestQuote('APPROVED', reload);
  $('#partial-approve-quote').onclick = () => partiallyApproveLatestQuote(reload);
  $('#reject-quote').onclick = () => decideLatestQuote('REJECTED', reload);
  $('#pause-execution').onclick = () => pauseExecution(reload);
  $('#start-execution').onclick = async () => { const button = $('#start-execution'); button.disabled = true; try { await api(`/api/work-orders/${selectedOrderId}/start`, { method: 'POST' }); await reload(); toast('Execução iniciada.', 'success'); } catch (error) { toast(error.message, 'error'); } finally { const order = ordersData.find((item) => item.id === selectedOrderId); button.disabled = order?.status !== 'OPEN' || !['APPROVED', 'PARTIALLY_APPROVED'].includes(order?.approvalStatus); } };
  $('#resume-execution').onclick = async () => { try { await api(`/api/work-orders/${selectedOrderId}/resume`, { method: 'POST' }); await reload(); toast('Execução retomada.', 'success'); } catch (error) { toast(error.message, 'error'); } };
  $$('[data-order-tab]', page).forEach((button) => button.onclick = () => { const summary = button.dataset.orderTab === 'summary'; $$('[data-order-tab]', page).forEach((tab) => tab.classList.toggle('active', tab === button)); $('#order-content').classList.toggle('summary-filter', summary); $$('[data-order-panel]', page).forEach((panel) => panel.classList.toggle('is-hidden', !summary && panel.dataset.orderPanel !== button.dataset.orderTab)); });
  $('#print-order').onclick = async () => { if (!selectedOrderId) return; const order = ordersData.find((item) => item.id === selectedOrderId); const type = order?.status === 'COMPLETED' ? 'PICKUP_RECEIPT' : 'WORK_ORDER'; try { const document = await api(`/api/work-orders/${selectedOrderId}/documents`, { method: 'POST', body: JSON.stringify({ type }) }); window.open(`/api/documents/${document.id}`, '_blank', 'noopener'); toast('Documento oficial versionado.', 'success'); } catch (error) { toast(error.message, 'error'); } };
  $('#whatsapp-order').onclick = openWhatsAppMessage;
}

function uploadOrderAttachment(reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  modalReturnFocus = document.activeElement; const wrap = document.createElement('div'); wrap.className = 'modal-wrap show'; wrap.id = 'attachment-modal'; wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="attachment-title"><div class="modal-head"><h2 id="attachment-title">Adicionar anexo</h2><p>JPG, PNG, WebP ou PDF, até 10 MB.</p></div><div class="modal-body"><div class="form-grid"><div class="field"><label for="attachment-file">Arquivo *</label><input id="attachment-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></div><div class="field"><label for="attachment-type">Tipo</label><select id="attachment-type"><option value="ENTRY">Entrada</option><option value="DIAGNOSIS">Diagnóstico</option><option value="SERVICE">Serviço</option><option value="DAMAGE">Avaria</option><option value="DELIVERY">Entrega</option><option value="GENERAL">Geral</option></select></div><div class="field"><label for="attachment-description">Descrição</label><input id="attachment-description" maxlength="500"></div><div class="field-error is-hidden" data-error role="alert"></div></div></div><div class="modal-foot"><button class="btn" data-cancel>Cancelar</button><button class="btn primary" data-save>Enviar arquivo</button></div></div>';
  const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; }; $('[data-cancel]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
  $('[data-save]', wrap).onclick = async () => { const file = $('#attachment-file', wrap).files[0]; const errorBox = $('[data-error]', wrap); if (!file) { errorBox.textContent = 'Selecione um arquivo.'; errorBox.classList.remove('is-hidden'); return; } const button = $('[data-save]', wrap); button.disabled = true; const form = new FormData(); form.set('file', file); form.set('type', $('#attachment-type', wrap).value); form.set('description', $('#attachment-description', wrap).value); try { const response = await fetch(`/api/work-orders/${order.id}/attachments`, { method: 'POST', body: form }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Não foi possível enviar o arquivo.'); await reload(); close(); toast('Anexo armazenado e registrado no histórico.', 'success'); } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('is-hidden'); } finally { button.disabled = false; } };
  document.body.append(wrap); $('#attachment-file', wrap).focus();
}

function whatsappTemplates(order, customer, bike) {
  const firstName = customer.name.trim().split(/\s+/)[0]; const bikeName = `${bike.brand} ${bike.model}`; const total = money(orderTotal(order));
  return {
    'Enviar orçamento': `Olá, ${firstName}! Aqui é da ${order.workshopName || 'nossa oficina'}. O orçamento da sua ${bikeName}, OS #${order.number}, ficou em ${total}. Podemos iniciar o serviço com sua aprovação?`,
    'Pedir aprovação': `Olá, ${firstName}! O orçamento da OS #${order.number} está aguardando sua aprovação. Valor total: ${total}. Responda esta mensagem confirmando se podemos prosseguir.`,
    'Avisar que está pronta': `Olá, ${firstName}! Sua ${bikeName} está pronta. A OS #${order.number} foi concluída no valor de ${total}. Quando puder, combine a retirada conosco.`,
    'Lembrar da retirada': `Olá, ${firstName}! Passando para lembrar que sua ${bikeName}, OS #${order.number}, está aguardando retirada. Se precisar, fale conosco por aqui.`,
  };
}

function openWhatsAppMessage() {
  const order = ordersData.find((item) => item.id === selectedOrderId); const customer = customersData.find((item) => item.id === order?.customerId); const bike = customer?.bikes.find((item) => item.id === order?.bikeId); if (!order || !customer || !bike) return toast('Não foi possível localizar os dados do cliente.', 'error');
  const templates = whatsappTemplates(order, customer, bike); const recommended = order.status === 'READY' ? 'Avisar que está pronta' : order.status === 'COMPLETED' ? 'Lembrar da retirada' : order.approvalStatus === 'PENDING' ? 'Enviar orçamento' : 'Pedir aprovação';
  formModal({ title: 'Mensagem pelo WhatsApp', description: `${customer.name} · ${customer.phone}. Revise o texto antes de abrir a conversa.`, fields: [{ name: 'template', label: 'Modelo', type: 'select', options: [recommended, ...Object.keys(templates).filter((name) => name !== recommended)] }, { name: 'message', label: 'Mensagem', type: 'textarea', required: true, value: templates[recommended] }], confirm: 'Abrir WhatsApp', action: async ({ message }) => {
    const digits = customer.phone.replace(/\D/g, ''); const phone = digits.startsWith('55') ? digits : `55${digits}`; if (phone.length < 12 || phone.length > 13) { toast('Revise o telefone do cliente antes de enviar.', 'error'); return false; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener');
    try { const saved = mapWorkOrder(await api(`/api/work-orders/${order.id}/contact`, { method: 'POST', body: JSON.stringify({ channel: 'WHATSAPP', message }) })); ordersData.splice(ordersData.indexOf(order), 1, saved); saveOrders(); renderOrderDetail(); toast('WhatsApp aberto e contato registrado.', 'success'); } catch (error) { toast(`WhatsApp aberto, mas o histórico não foi salvo: ${error.message}`, 'error'); }
  } });
  const modal = $('#dynamic-modal'); const template = $('select[name="template"]', modal); const message = $('textarea[name="message"]', modal); template.onchange = () => { message.value = templates[template.value]; };
}

async function assignMechanic() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  try {
    const team = (await api('/api/team')).filter((member) => member.active && ['OWNER', 'MANAGER', 'MECHANIC'].includes(member.role));
    if (!team.length) return toast('Cadastre um mecânico ativo na equipe.', 'error');
    formModal({ title: 'Atribuir mecânico', description: `Responsável pela OS #${order.number}.`, fields: [{ name: 'mechanicId', label: 'Mecânico', type: 'select', required: true, options: team.map((member) => ({ label: member.user.name, value: member.id })), value: order.assignedMechanicId || '' }], confirm: 'Atribuir', action: async ({ mechanicId }) => { try { const saved = mapWorkOrder(await api(`/api/work-orders/${order.id}/assign`, { method: 'POST', body: JSON.stringify({ mechanicId }) })); ordersData.splice(ordersData.indexOf(order), 1, saved); saveOrders(); renderOrderDetail(); toast('Mecânico atribuído à OS.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  } catch (error) { toast(error.message, 'error'); }
}

function editDeadline() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  formModal({ title: 'Editar previsão de entrega', description: `Prazo da OS #${order.number}. Alteração será auditada.`, fields: [{ name: 'expectedDate', label: 'Data prevista', type: 'date', value: order.expected || '' }, { name: 'expectedNote', label: 'Observação do prazo', placeholder: 'Ex.: confirmar horário com o cliente', value: order.expectedNote || '' }, { name: 'reason', label: 'Motivo da alteração', required: true }], confirm: 'Salvar previsão', action: async ({ expectedDate, expectedNote, reason }) => { try { await api(`/api/work-orders/${order.id}/planning`, { method: 'PATCH', body: JSON.stringify({ expectedDate: expectedDate || null, expectedNote: expectedNote || null, reason }) }); await window.openOrder(order.id); toast('Previsão atualizada e auditada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

function editPriority() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  formModal({ title: 'Alterar prioridade', description: `Prioridade operacional da OS #${order.number}.`, fields: [{ name: 'priority', label: 'Prioridade', type: 'select', value: order.priority, options: [{ label: 'Normal', value: 'NORMAL' }, { label: 'Urgente', value: 'URGENT' }, { label: 'Garantia / retorno', value: 'WARRANTY_RETURN' }] }, { name: 'reason', label: 'Motivo', required: true }], confirm: 'Salvar prioridade', action: async ({ priority, reason }) => { try { await api(`/api/work-orders/${order.id}/planning`, { method: 'PATCH', body: JSON.stringify({ priority, reason }) }); await window.openOrder(order.id); toast('Prioridade atualizada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

function generateQuote(reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  formModal({ title: 'Gerar orçamento', description: 'Nova versão preserva todas as versões anteriores.', fields: [{ name: 'kind', label: 'Tipo', type: 'select', options: [{ label: 'Orçamento principal', value: 'BASE' }, { label: 'Adicional', value: 'ADDITIONAL' }] }, { name: 'validUntil', label: 'Validade', type: 'date' }], confirm: 'Gerar versão', action: async (values) => { try { await api(`/api/work-orders/${order.id}/quotes`, { method: 'POST', body: JSON.stringify({ kind: values.kind, validUntil: values.validUntil || null }) }); await reload(); toast('Nova versão do orçamento criada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

async function sendLatestQuote(reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); const quote = order?.quotes.find((item) => item.status === 'DRAFT'); if (!order || !quote) return toast('Gere um orçamento em rascunho primeiro.', 'error');
  try { await api(`/api/work-orders/${order.id}/quotes/${quote.id}/send`, { method: 'POST' }); await reload(); toast('Envio do orçamento registrado. Nenhuma mensagem foi marcada como enviada.', 'success'); } catch (error) { toast(error.message, 'error'); }
}

function decideLatestQuote(decision, reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); const quote = order?.quotes.find((item) => ['PENDING', 'DRAFT'].includes(item.status)); if (!order || !quote) return toast('Nenhum orçamento aguardando decisão.', 'error');
  const approve = decision === 'APPROVED';
  formModal({ title: approve ? 'Registrar aprovação' : 'Registrar recusa', description: `Orçamento v${quote.version} · ${money(quote.totalCents)}. A origem e a evidência ficarão na auditoria.`, fields: [{ name: 'channel', label: 'Origem', type: 'select', options: [{ label: 'Presencial', value: 'IN_PERSON' }, { label: 'WhatsApp', value: 'WHATSAPP' }, { label: 'Telefone', value: 'PHONE' }, { label: 'E-mail', value: 'EMAIL' }, { label: 'Outro', value: 'OTHER' }] }, { name: 'approvedByName', label: approve ? 'Aprovado por' : 'Recusado por' }, { name: 'evidence', label: 'Evidência / referência' }, { name: 'note', label: 'Observação', type: 'textarea', required: !approve }], confirm: approve ? 'Confirmar aprovação' : 'Registrar recusa', action: async (values) => { try { const refreshed = await reload(); const currentQuote = refreshed?.quotes.find((item) => ['PENDING', 'DRAFT'].includes(item.status)); if (!currentQuote) throw new Error('O orçamento foi alterado. Gere ou selecione a versão pendente.'); await api(`/api/work-orders/${order.id}/quotes/decide`, { method: 'POST', body: JSON.stringify({ ...values, quoteId: currentQuote.id, decision }) }); await reload(); await hydrateInventoryFromApi(false); toast(approve ? 'Orçamento aprovado e estoque reservado conforme política.' : 'Recusa registrada e reservas liberadas.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

function partiallyApproveLatestQuote(reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); const quote = order?.quotes.find((item) => ['PENDING', 'DRAFT'].includes(item.status)); if (!order || !quote) return toast('Nenhum orçamento aguardando decisão.', 'error');
  const items = [...order.services.map((line) => ({ ...line, kind: 'service' })), ...order.parts.map((line) => ({ ...line, kind: 'part' }))]; if (items.length < 2) return toast('Aprovação parcial exige ao menos dois itens.', 'error');
  modalReturnFocus = document.activeElement; const wrap = document.createElement('div'); wrap.className = 'modal-wrap show'; wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="partial-title"><div class="modal-head"><h2 id="partial-title">Registrar aprovação parcial</h2><p>Marque somente os itens aprovados pelo cliente.</p></div><div class="modal-body"><div class="stack" data-items></div><div class="form-grid"><div class="field"><label for="partial-channel">Origem</label><select id="partial-channel"><option value="IN_PERSON">Presencial</option><option value="WHATSAPP">WhatsApp</option><option value="PHONE">Telefone</option><option value="EMAIL">E-mail</option><option value="OTHER">Outro</option></select></div><div class="field"><label for="partial-name">Aprovado por</label><input id="partial-name"></div><div class="field"><label for="partial-note">Observação *</label><textarea id="partial-note"></textarea></div><div class="field-error is-hidden" data-error role="alert"></div></div></div><div class="modal-foot"><button class="btn" data-cancel>Cancelar</button><button class="btn primary" data-save>Confirmar itens</button></div></div>';
  const list = $('[data-items]', wrap); items.forEach((item) => { const label = document.createElement('label'); label.className = 'context-item clickable'; label.innerHTML = '<input type="checkbox"><span></span><b></b>'; $('input', label).dataset.id = item.id; $('input', label).dataset.kind = item.kind; $('span', label).textContent = item.name; $('b', label).textContent = money(lineTotal(item)); list.append(label); });
  const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; }; $('[data-cancel]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
  $('[data-save]', wrap).onclick = async () => { const selected = $$('input[type="checkbox"]:checked', wrap); const errorBox = $('[data-error]', wrap); if (!selected.length || selected.length === items.length) { errorBox.textContent = 'Marque ao menos um item, mas não todos.'; errorBox.classList.remove('is-hidden'); return; } if (!$('#partial-note', wrap).value.trim()) { errorBox.textContent = 'Informe uma observação sobre a decisão parcial.'; errorBox.classList.remove('is-hidden'); return; } const button = $('[data-save]', wrap); button.disabled = true; try { await api(`/api/work-orders/${order.id}/quotes/${quote.id}/approve`, { method: 'POST', body: JSON.stringify({ channel: $('#partial-channel', wrap).value, approvedByName: $('#partial-name', wrap).value || undefined, note: $('#partial-note', wrap).value, serviceLineIds: selected.filter((input) => input.dataset.kind === 'service').map((input) => input.dataset.id), partLineIds: selected.filter((input) => input.dataset.kind === 'part').map((input) => input.dataset.id) }) }); await reload(); await hydrateInventoryFromApi(false); close(); toast('Aprovação parcial registrada; somente peças aprovadas foram reservadas.', 'success'); } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('is-hidden'); } finally { button.disabled = false; } };
  document.body.append(wrap); $('input', wrap).focus();
}

function pauseExecution(reload) {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  formModal({ title: 'Pausar execução', description: 'Motivo ficará no histórico operacional.', fields: [{ name: 'reason', label: 'Motivo', type: 'textarea', required: true }], confirm: 'Pausar', action: async ({ reason }) => { try { await api(`/api/work-orders/${order.id}/pause`, { method: 'POST', body: JSON.stringify({ reason }) }); await reload(); toast('Execução pausada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

function editOrderLine(kind, line) {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  const original = Number(line.quantity) * Number(line.price);
  const percent = original > 0 ? (Number(line.discountCents || 0) / original) * 100 : 0;
  formModal({ title: `Editar ${kind === 'service' ? 'serviço' : 'peça'}`, description: `${line.name} · preço unitário ${money(line.price)}. O preço original vem do cadastro.`, fields: [{ name: 'quantity', label: 'Quantidade', type: 'number', required: true, value: String(line.quantity) }, { name: 'discountValue', label: 'Desconto em valor (R$)', value: (Number(line.discountCents || 0) / 100).toFixed(2).replace('.', ',') }, { name: 'discountPercent', label: 'Desconto em porcentagem (%)', type: 'number', value: percent.toFixed(2) }, { name: 'reason', label: 'Motivo da alteração', required: true }], confirm: 'Salvar alteração', action: async (values) => {
    const quantity = Number(values.quantity); const discountCents = moneyToCents(values.discountValue); if (!(quantity > 0)) return toast('Quantidade deve ser maior que zero.', 'error'), false; if (discountCents === null) return toast('Informe um desconto válido.', 'error'), false;
    try { await api(`/api/work-orders/${order.id}/${kind === 'part' ? 'parts' : 'services'}/${line.id}`, { method: 'PATCH', body: JSON.stringify({ quantity, discountCents, reason: values.reason }) }); await window.openOrder(order.id); await hydrateInventoryFromApi(false); toast('Item atualizado e alteração auditada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; }
  } });
  const modal = $('#dynamic-modal'); const value = $('[name="discountValue"]', modal); const percentage = $('[name="discountPercent"]', modal); const quantity = $('[name="quantity"]', modal); let syncing = false;
  const base = () => Math.max(0, Number(quantity.value || 0) * Number(line.price));
  value.oninput = () => { if (syncing) return; syncing = true; const cents = moneyToCents(value.value) || 0; percentage.value = base() ? Math.min(100, cents / base() * 100).toFixed(2) : '0.00'; syncing = false; };
  percentage.oninput = () => { if (syncing) return; syncing = true; const pct = Math.max(0, Math.min(100, Number(percentage.value || 0))); value.value = (Math.round(base() * pct / 100) / 100).toFixed(2).replace('.', ','); syncing = false; };
  quantity.oninput = () => percentage.dispatchEvent(new Event('input'));
}

function openOrderActions() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  if (['COMPLETED', 'CANCELLED'].includes(order.status)) return toast('Esta OS está encerrada e não possui novas ações.');
  if (order.status !== 'READY') return cancelOrder();
  formModal({ title: 'Ações da OS', description: 'Escolha como deseja tratar esta ordem pronta.', fields: [{ name: 'action', label: 'Ação', type: 'select', options: ['Reabrir para serviço', 'Cancelar OS'] }], confirm: 'Continuar', action: ({ action }) => { setTimeout(() => action === 'Reabrir para serviço' ? confirm('Reabrir esta OS e devolver as peças ao estoque?') && reopenOrder() : cancelOrder(), 0); } });
}

function cancelOrder() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  formModal({ title: `Cancelar OS #${order.number}`, description: order.status === 'READY' ? 'As peças consumidas serão devolvidas ao estoque. Esta ação ficará no histórico.' : 'A OS será encerrada e o motivo ficará no histórico.', fields: [{ name: 'reason', label: 'Motivo do cancelamento', type: 'textarea', required: true, placeholder: 'Ex.: cliente desistiu do serviço' }], confirm: 'Confirmar cancelamento', action: async ({ reason }) => { if (!confirm('Confirma o cancelamento desta OS?')) return false; try { const saved = mapWorkOrder(await api(`/api/work-orders/${order.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) })); ordersData.splice(ordersData.indexOf(order), 1, saved); saveOrders(); await hydrateInventoryFromApi(false); renderOrderDetail(); window.renderOrders(); toast('OS cancelada e histórico atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

function renderOrderDetail() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  const page = $('#order-detail'); const customer = order.customer || customersData.find((item) => item.id === order.customerId); const bike = order.bike || customer?.bikes?.find((item) => item.id === order.bikeId); const [statusLabel, statusClass] = statusInfo[order.status];
  $('#order-number').textContent = `OS #${order.number}`; $('#order-status').textContent = statusLabel; $('#order-status').className = `pill ${statusClass === 'progress' ? 'amber' : statusClass === 'ready' ? 'green' : ''}`; const priorities = { NORMAL: 'Normal', URGENT: 'Urgente', WARRANTY_RETURN: 'Garantia / retorno' }; $('#order-priority').textContent = priorities[order.priority] || 'Normal'; $('#order-priority').className = `pill ${order.priority === 'URGENT' ? 'red' : ''}`; $('#order-identity').textContent = `${customer?.name || 'Cliente preservado'} · ${bike ? `${bike.brand} ${bike.model}` : 'Bike preservada'}`;
  $('#order-complaint').textContent = `“${order.complaint}”`; $('#complaint-meta').textContent = order.createdAt ? `Registrado em ${new Date(order.createdAt).toLocaleString('pt-BR')}` : '';
  if (document.activeElement !== $('#order-diagnosis')) $('#order-diagnosis').value = order.diagnosis || ''; if (document.activeElement !== $('#order-recommendations')) $('#order-recommendations').value = order.technicalRecommendations || ''; if (document.activeElement !== $('#order-technical-notes')) $('#order-technical-notes').value = order.technicalNotes || '';
  const dateText = (value) => value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
  const progress = $('#order-progress'); progress.innerHTML = ''; (order.timeline || []).forEach((step) => { const node = document.createElement('div'); const current = !step.complete && !(order.timeline || []).some((candidate) => candidate.complete && (order.timeline || []).indexOf(candidate) > (order.timeline || []).indexOf(step)); node.className = `progress-step ${step.complete ? 'done' : current ? 'current' : ''}`; node.innerHTML = '<span class="progress-dot"></span><b></b><small></small>'; $('b', node).textContent = step.label; $('small', node).textContent = dateText(step.at); progress.append(node); });
  const pendings = order.pendings || []; const pendingCard = $('#order-pendings'); pendingCard.classList.toggle('is-hidden', !pendings.length); $('#pending-count').textContent = `${pendings.length} pendência${pendings.length === 1 ? '' : 's'}`; $('#pending-summary').textContent = pendings[0]?.message || ''; $('#view-pendings').onclick = () => formModal({ title: 'Pendências da OS', description: pendings.map((item) => `${item.blocking ? 'Bloqueia: ' : ''}${item.message}`).join('\n'), fields: [], confirm: 'Fechar', action: () => true });
  const statusLabels = { PENDING: 'Pendente', APPROVED: 'Aprovado', REJECTED: 'Recusado', IN_PROGRESS: 'Em execução', COMPLETED: 'Concluído', CANCELLED: 'Cancelado' };
  const renderLines = (kind, lines) => { const panel = kind === 'service' ? $('#order-services-panel') : $('#order-parts-panel'); const body = $('.order-lines-body', panel); body.innerHTML = ''; if (!lines.length) body.innerHTML = `<div class="order-empty">Nenhum${kind === 'service' ? ' serviço' : 'a peça'} adicionado.</div>`; lines.forEach((line) => { const row = document.createElement('div'); row.className = 'order-line'; const actions = '<div class="line-actions"><button class="btn ghost" data-edit aria-label="Editar item">Editar</button><button class="btn ghost" data-remove aria-label="Remover item">×</button></div>'; if (kind === 'service') row.innerHTML = `<div class="mobile-wide"><b></b><div class="stock-note"></div></div><span class="order-line-status"></span><span class="num"></span><span class="num"></span><span class="num"></span><span class="num"><b></b></span>${actions}`; else row.innerHTML = `<div class="mobile-wide"><b></b><div class="stock-note"></div></div><span class="num"></span><span class="order-line-status"></span><span class="num"></span><span class="num"></span><span class="num"><b></b></span>${actions}`; $('div b', row).textContent = line.name; $('.stock-note', row).textContent = kind === 'part' ? `${line.stock} físico · ${line.reserved} reservado · ${line.location || 'sem localização'}` : line.performedById ? 'Executor definido' : 'Executor pendente'; const status = $('.order-line-status', row); status.textContent = statusLabels[line.status] || line.status; status.className = `order-line-status ${String(line.status).toLowerCase()}`; const nums = $$('.num', row); if (kind === 'service') { nums[0].textContent = line.quantity; nums[1].textContent = money(line.price); nums[2].textContent = money(line.discountCents || 0); nums[3].textContent = money(lineTotal(line)); } else { nums[0].textContent = line.available; nums[1].textContent = line.quantity; nums[2].textContent = money(line.price); nums[3].textContent = money(lineTotal(line)); } const canEdit = ['OPEN', 'IN_PROGRESS'].includes(order.status); const edit = $('[data-edit]', row); const remove = $('[data-remove]', row); edit.disabled = remove.disabled = !canEdit; edit.onclick = () => editOrderLine(kind, line); remove.onclick = async () => { if (!confirm(`Remover ${line.name}?`)) return; try { await api(`/api/work-orders/${order.id}/${kind === 'part' ? 'parts' : 'services'}/${line.id}`, { method: 'DELETE' }); await window.openOrder(order.id); toast('Item removido e reservas conciliadas.', 'success'); } catch (error) { toast(error.message, 'error'); } }; body.append(row); }); $('.order-panel-total', panel).textContent = money(lines.reduce((sum, line) => sum + lineTotal(line), 0)); };
  renderLines('service', order.services); renderLines('part', order.parts);
  $('#summary-services').textContent = money(order.laborSubtotalCents ?? order.services.reduce((sum, line) => sum + lineTotal(line), 0)); $('#summary-parts').textContent = money(order.partsSubtotalCents ?? order.parts.reduce((sum, line) => sum + lineTotal(line), 0)); $('#summary-discount').textContent = `- ${money(order.generalDiscountCents || 0)}`; $('#summary-total').textContent = money(order.totalCents ?? orderTotal(order));
  const discountType = $('#discount-type'); const discountValue = $('#discount-value'); const discountButton = $('#save-discount'); discountType.value = order.generalDiscountType; if (document.activeElement !== discountValue) discountValue.value = Number(order.generalDiscountValue || 0).toLocaleString('pt-BR', { maximumFractionDigits: 4 }); const previewDiscount = () => { const parsed = Number(discountValue.value.replace(',', '.')); const subtotal = Number(order.laborSubtotalCents || 0) + Number(order.partsSubtotalCents || 0) + Number(order.generalSurchargeCents || 0); const cents = Number.isFinite(parsed) ? (discountType.value === 'PERCENT' ? Math.round(subtotal * parsed / 100) : Math.round(parsed * 100)) : 0; $('#discount-preview').textContent = `Prévia: ${money(Math.max(0, subtotal - cents))}`; }; discountType.onchange = previewDiscount; discountValue.oninput = previewDiscount; previewDiscount(); discountButton.disabled = !['OPEN', 'IN_PROGRESS'].includes(order.status); discountButton.onclick = async () => { discountButton.disabled = true; try { await api(`/api/work-orders/${order.id}/discount`, { method: 'PATCH', body: JSON.stringify({ version: order.version, type: discountType.value, value: discountValue.value || '0', reason: 'Desconto geral ajustado na tela da OS' }) }); await window.openOrder(order.id); toast('Desconto atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); } finally { discountButton.disabled = !['OPEN', 'IN_PROGRESS'].includes(order.status); } };
  $('#context-customer').textContent = customer?.name || 'Cliente preservado'; $('#context-phone').textContent = customer?.phone || ''; $('#context-bike').textContent = bike ? `${bike.brand} ${bike.model}` : 'Bike preservada'; $('#context-bike-details').textContent = bike ? [bike.type, bike.wheelSize && `aro ${bike.wheelSize}`, bike.color].filter(Boolean).join(' · ') : ''; $('#context-mechanic').textContent = order.assignedMechanicName || 'Atribuir mecânico'; $('#context-entry').textContent = dateText(order.createdAt) || '—'; $('#context-deadline').textContent = [order.expected && formatDeadline(order.expected), order.expectedNote].filter(Boolean).join(' · ') || 'Sem previsão'; $('#context-deadline-state').textContent = order.overdue ? 'Atrasada' : order.expected ? 'No prazo' : ''; $('#context-priority').textContent = priorities[order.priority] || 'Normal';
  const editable = ['OPEN', 'IN_PROGRESS'].includes(order.status); makeClickable($('#context-mechanic-wrap'), assignMechanic, 'Atribuir mecânico'); makeClickable($('#context-deadline-wrap'), editDeadline, 'Editar previsão'); makeClickable($('#context-priority-wrap'), editPriority, 'Editar prioridade'); $$('textarea', $('[data-order-panel="diagnosis"]')).forEach((field) => field.disabled = !editable); $$('.line-add button', page).forEach((button) => button.disabled = !editable);
  const quotePill = $('#quote-approval-panel .pill'); const approvalLabels = { PENDING: ['Aguardando aprovação', ''], PARTIALLY_APPROVED: ['Aprovado parcialmente', 'amber'], APPROVED: ['Aprovado', 'green'], REJECTED: ['Recusado', 'red'] }; const approval = approvalLabels[order.approvalStatus] || approvalLabels.PENDING; quotePill.textContent = approval[0]; quotePill.className = `pill ${approval[1]}`; const quoteVersions = $('#quote-versions'); quoteVersions.innerHTML = ''; (order.quotes || []).forEach((quote) => { const node = document.createElement('div'); node.className = 'quote-version'; node.innerHTML = '<div class="quote-version-row"><b></b><span class="pill"></span></div><div class="item-sub"></div>'; $('b', node).textContent = `${quote.kind === 'ADDITIONAL' ? `Adicional #${quote.additionalNumber}` : 'Orçamento'} · v${quote.version}`; $('.pill', node).textContent = quote.status; $('.item-sub', node).textContent = `${money(quote.totalCents)} · criado em ${dateText(quote.createdAt)}`; quoteVersions.append(node); }); if (!quoteVersions.children.length) quoteVersions.innerHTML = '<span class="muted">Nenhuma versão gerada.</span>';
  const execution = $('#execution-services'); execution.innerHTML = ''; order.services.filter((line) => !['REJECTED', 'CANCELLED'].includes(line.status)).forEach((line) => { const row = document.createElement('div'); row.className = 'checklist-row'; row.innerHTML = '<b></b><select class="selectlike" aria-label="Status do serviço"></select><span class="item-sub"></span>'; $('b', row).textContent = line.name; const select = $('select', row); ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].forEach((value) => select.add(new Option(statusLabels[value], value))); select.value = line.status === 'PENDING' ? 'APPROVED' : line.status; select.disabled = order.status !== 'IN_PROGRESS'; select.title = select.disabled ? 'Inicie a execução da OS para alterar este serviço.' : 'Alterar status do serviço'; select.onchange = async () => { try { await api(`/api/work-orders/${order.id}/services/${line.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: select.value }) }); await window.openOrder(order.id); toast('Status do serviço atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); } }; $('span', row).textContent = line.completedAt ? dateText(line.completedAt) : select.disabled ? 'Inicie a execução para atualizar' : ''; execution.append(row); }); if (!execution.children.length) execution.innerHTML = '<span class="muted">Nenhum serviço aprovado.</span>'; $('#execution-state').textContent = order.executionPausedAt ? 'Pausada' : order.status === 'IN_PROGRESS' ? 'Em andamento' : order.status === 'READY' ? 'Pronta' : order.status === 'COMPLETED' ? 'Entregue' : 'Não iniciada'; const canStart = order.status === 'OPEN' && ['APPROVED', 'PARTIALLY_APPROVED'].includes(order.approvalStatus); $('#start-execution').classList.toggle('is-hidden', order.status !== 'OPEN'); $('#start-execution').disabled = !canStart; $('#start-execution').title = canStart ? 'Iniciar execução da OS' : 'Aprove o orçamento e atribua um mecânico antes de iniciar.'; $('#execution-summary').textContent = order.status === 'OPEN' ? (canStart ? 'Orçamento aprovado. Inicie a execução para liberar os serviços.' : 'A execução será liberada após aprovação do orçamento e atribuição do mecânico.') : order.workSessions?.length ? `${order.workSessions.length} sessão(ões) registrada(s).` : 'Nenhuma sessão registrada.'; $('#pause-execution').classList.toggle('is-hidden', order.status !== 'IN_PROGRESS'); $('#resume-execution').classList.toggle('is-hidden', order.status !== 'IN_PROGRESS'); $('#pause-execution').disabled = order.status !== 'IN_PROGRESS' || Boolean(order.executionPausedAt); $('#resume-execution').disabled = order.status !== 'IN_PROGRESS' || !order.executionPausedAt;
  const checklistRoot = $('#order-checklists'); checklistRoot.innerHTML = ''; (order.checklists || []).forEach((checklist) => { const block = document.createElement('div'); block.className = 'checklist-block'; block.innerHTML = '<div class="checklist-block-head"><b></b><span class="pill"></span></div><div class="checklist-items"></div>'; $('b', block).textContent = checklist.title; $('.pill', block).textContent = `${checklist.type} · ${checklist.required ? 'Obrigatório' : 'Opcional'}`; const items = $('.checklist-items', block); checklist.items.forEach((item) => { const row = document.createElement('div'); row.className = 'checklist-row'; row.innerHTML = '<span></span><select class="selectlike" aria-label="Resultado do checklist"></select><input class="selectlike" aria-label="Observação do checklist" placeholder="Observação">'; $('span', row).textContent = `${item.labelSnapshot}${item.required ? ' *' : ''}`; const select = $('select', row); [['PENDING', 'Pendente'], ['OK', 'OK'], ['ATTENTION', 'Atenção'], ['REJECTED', 'Reprovado'], ['NOT_APPLICABLE', 'Não se aplica']].forEach(([value, label]) => select.add(new Option(label, value))); select.value = item.result; const notes = $('input', row); notes.value = item.notes || ''; select.disabled = notes.disabled = ['COMPLETED', 'CANCELLED'].includes(order.status); const save = async () => { try { await api(`/api/work-orders/${order.id}/checklists/items/${item.id}`, { method: 'PATCH', body: JSON.stringify({ result: select.value, notes: notes.value || null }) }); item.result = select.value; item.notes = notes.value; toast('Checklist salvo.', 'success'); } catch (error) { toast(error.message, 'error'); } }; select.onchange = save; notes.onchange = save; items.append(row); }); checklistRoot.append(block); }); if (!checklistRoot.children.length) checklistRoot.innerHTML = '<span class="muted">Nenhum checklist aplicado.</span>';
  const attachmentsRoot = $('#order-attachments'); attachmentsRoot.innerHTML = ''; (order.attachments || []).forEach((attachment) => { const link = document.createElement('a'); link.className = 'context-item clickable'; link.href = `/api/work-orders/${order.id}/attachments/${attachment.id}`; link.target = '_blank'; link.rel = 'noopener'; link.innerHTML = '<b></b><span></span>'; $('b', link).textContent = attachment.fileName; $('span', link).textContent = `${attachment.type} · ${(attachment.sizeBytes / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB${attachment.description ? ` · ${attachment.description}` : ''}`; attachmentsRoot.append(link); }); if (!attachmentsRoot.children.length) attachmentsRoot.innerHTML = '<span class="muted">Nenhum anexo registrado.</span>'; $('#add-order-attachment').disabled = !editable;
  const renderHistory = (root, activities) => { root.innerHTML = ''; activities.forEach((activity) => { const item = document.createElement('div'); item.className = 'timeline-item'; item.innerHTML = '<span class="timeline-dot"></span><b></b><p></p><div class="timeline-meta"></div>'; $('b', item).textContent = activity.title; $('p', item).textContent = activity.description || ''; $('p', item).hidden = !activity.description; $('.timeline-meta', item).textContent = `${dateText(activity.createdAt)} · ${activity.actorName || 'Equipe da oficina'}`; root.append(item); }); if (!root.children.length) root.innerHTML = '<span class="muted">Nenhuma atividade registrada.</span>'; }; renderHistory($('#order-history-panel .timeline'), order.activities || []); renderHistory($('#order-history-summary'), (order.activities || []).slice(0, 4));
  const confirmBox = $('#ready .confirm-box'); confirmBox.innerHTML = '<div class="stock-delta"><b>Peça</b><b>Físico</b><b>Depois</b></div>'; order.parts.filter((line) => line.status === 'APPROVED').forEach((line) => { const delta = document.createElement('div'); delta.className = 'stock-delta'; delta.innerHTML = '<span></span><b></b><b></b>'; $('span', delta).textContent = line.name; delta.children[1].textContent = line.stock; delta.children[2].textContent = line.stock - line.quantity; confirmBox.append(delta); }); $('#ready .summary-row.total span:last-child').textContent = money(order.totalCents ?? orderTotal(order));
  const action = $('#order-primary-action'); action.disabled = false; if (order.status === 'OPEN') { action.textContent = ['APPROVED', 'PARTIALLY_APPROVED'].includes(order.approvalStatus) ? 'Iniciar execução' : 'Aguardando cliente'; action.disabled = !['APPROVED', 'PARTIALLY_APPROVED'].includes(order.approvalStatus); action.onclick = () => transitionOrder('IN_PROGRESS'); } else if (order.status === 'IN_PROGRESS') { action.textContent = 'Marcar como pronta'; action.onclick = () => openModal('ready'); } else if (order.status === 'READY') { action.textContent = 'Registrar entrega'; action.onclick = completeOrder; } else { action.textContent = order.status === 'CANCELLED' ? 'OS cancelada' : 'OS entregue'; action.disabled = true; }
}

async function transitionOrder(status) {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return; const action = status === 'IN_PROGRESS' ? 'start' : 'complete'; try { await api(`/api/work-orders/${order.id}/${action}`, { method: 'POST' }); await window.openOrder(order.id); toast(`OS agora está ${statusInfo[status][0].toLowerCase()}.`, 'success'); } catch (error) { toast(error.message, 'error'); }
}

function completeOrder() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order) return;
  const customer = customersData.find((item) => item.id === order.customerId);
  formModal({ title: `Concluir retirada da OS #${order.number}`, description: 'Registre quem retirou e a situação operacional do pagamento.', fields: [{ name: 'pickedUpByName', label: 'Retirado por', required: true, value: customer?.name || '' }, { name: 'documentNumber', label: 'Documento (opcional)' }, { name: 'relationship', label: 'Relação com cliente (opcional)' }, { name: 'paymentStatus', label: 'Pagamento', type: 'select', options: [{ label: 'Pendente', value: 'PENDING' }, { label: 'Pago', value: 'PAID' }, { label: 'Dispensado', value: 'WAIVED' }] }, { name: 'notes', label: 'Observação', type: 'textarea' }], confirm: 'Registrar retirada', action: async (values) => { if (!confirm('Confirma entrega da bicicleta e aceite da retirada?')) return false; try { await api(`/api/work-orders/${order.id}/complete`, { method: 'POST', body: JSON.stringify({ ...values, accepted: true }) }); await window.openOrder(order.id); toast('Retirada concluída e registrada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
}

async function markOrderReady() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order || order.status !== 'IN_PROGRESS') return;
  try { await api(`/api/work-orders/${order.id}/ready`, { method: 'POST' }); closeModal('ready'); await hydrateInventoryFromApi(false); await window.openOrder(order.id); toast('OS pronta e estoque atualizado exatamente uma vez.', 'success'); } catch (error) { toast(error.message, 'error'); }
}

async function reopenOrder() {
  const order = ordersData.find((item) => item.id === selectedOrderId); if (!order || order.status !== 'READY') return;
  try { const saved = mapWorkOrder(await api(`/api/work-orders/${order.id}/reopen`, { method: 'POST' })); ordersData.splice(ordersData.indexOf(order), 1, saved); saveOrders(); await hydrateInventoryFromApi(false); renderOrderDetail(); window.renderOrders(); toast('OS reaberta e peças devolvidas ao estoque.', 'success'); } catch (error) { toast(error.message, 'error'); }
}

async function updateDashboard() {
  const active = ordersData.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status)); let counts = [0, 0, 0, 0];
  try { const dashboard = await api('/api/dashboard'); counts = [dashboard.statuses.OPEN || 0, dashboard.statuses.IN_PROGRESS || 0, dashboard.statuses.READY || 0, dashboard.overdue || 0]; } catch (error) { toast(`Dashboard indisponível: ${error.message}`, 'error'); }
  const activeCount = counts[0] + counts[1] + counts[2]; $$('#dashboard .metric .value').forEach((element, index) => element.textContent = counts[index]); const navCount = $('.nav-item[data-page="orders"] .count'); if (navCount) navCount.textContent = activeCount;
  $('#orders .page-head p').textContent = `${activeCount} ordens ativas · organização por trabalho, não por burocracia.`;
  const tabs = $$('#orders .segment button'); tabs[0].textContent = `Ativas ${activeCount}`; tabs[1].textContent = `Prontas ${counts[2]}`;
  const list = $('#dashboard .work-list'); list.innerHTML = '';
  active.filter((order) => order.status === 'IN_PROGRESS' || order.overdue).slice(0, 3).forEach((order) => {
    const customer = customersData.find((item) => item.id === order.customerId); const bike = customer?.bikes.find((item) => item.id === order.bikeId); const late = order.overdue;
    const row = document.createElement('div'); row.className = 'work-row clickable'; row.innerHTML = `<div class="os-no">#${order.number}</div><div><div class="item-title"></div><div class="item-sub"></div></div><div><span class="status ${late ? 'late' : 'progress'}"><span class="dot"></span>${late ? 'Atrasada' : 'Em serviço'}</span></div><div class="item-sub"></div><div class="money"></div>`;
    $('.item-title', row).textContent = bike ? `${bike.brand} ${bike.model}` : 'Bike arquivada'; $$('.item-sub', row)[0].textContent = `${customer?.name || 'Cliente'} · ${order.complaint}`; $$('.item-sub', row)[1].textContent = displayDeadline(order); $('.money', row).textContent = orderTotal(order) ? money(orderTotal(order)) : '—'; makeClickable(row, () => window.openOrder(order.id), `Abrir OS ${order.number}`); list.append(row);
  });
  if (!list.children.length) list.innerHTML = '<div style="padding:28px;text-align:center;color:var(--muted-foreground)">Nenhuma ordem exige atenção agora.</div>';
}

function inventory() {
  const page = $('#inventory'); const grid = $('.inventory-products-grid', page); const input = $('.global-search input'); const categoryFilter = $('#inventory-category-filter'); const brandFilter = $('#inventory-brand-filter'); const locationFilter = $('#inventory-location-filter'); const statusFilter = $('#inventory-status-filter'); const sort = $('#inventory-sort'); let searchTimer;
  const reload = () => hydrateInventoryFromApi(false);
  const render = () => {
    window.InventoryUI.renderCards(grid, inventoryData, { money, onMovement: openInventoryMovement, onDetails: openInventoryDrawer });
    window.InventoryUI.renderSummary(page, inventoryMeta.summary, money);
    window.InventoryUI.renderPanels(page, { ...inventoryInsights, movements: movementsData, summary: inventoryMeta.summary, onDetails: openInventoryDrawer });
    window.InventoryUI.renderPagination(page, { ...inventoryMeta, itemsLength: inventoryData.length }, (nextPage) => { inventoryFilters.page = nextPage; reload(); });
    renderMovements();
  };
  window.renderInventory = render;
  const fillFilter = (select, values, emptyLabel) => { const current = select.value; select.innerHTML = ''; select.add(new Option(emptyLabel, '')); values.forEach((item) => select.add(new Option(typeof item === 'string' ? item : item.name, typeof item === 'string' ? item : item.id))); select.value = current; };
  window.refreshInventoryFilters = () => { fillFilter(categoryFilter, catalogCategoriesData, 'Todas as categorias'); fillFilter(brandFilter, catalogBrandsData, 'Todas as marcas'); fillFilter(locationFilter, inventoryMeta.locations || [], 'Todas as localizações'); };
  window.refreshInventoryFilters();
  const setActiveQuick = (key) => $$('[data-stock-quick]', page).forEach((button) => button.classList.toggle('active', button.dataset.stockQuick === key));
  const setQuickFilter = (key) => {
    const values = { all: ['all', 'name_asc'], used: ['all', 'usage_desc'], low: ['low', 'stock_asc'], reorder: ['reorder', 'stock_asc'] }[key];
    inventoryFilters.status = values[0]; inventoryFilters.sort = values[1]; inventoryFilters.page = 1; statusFilter.value = values[0] === 'reorder' ? 'all' : values[0]; sort.value = values[1]; setActiveQuick(key); reload();
  };
  window.setInventorySearch = (value) => { input.value = value; inventoryFilters.search = value.trim(); inventoryFilters.page = 1; reload(); };
  input.addEventListener('input', () => { if (!page.classList.contains('active')) return; clearTimeout(searchTimer); searchTimer = setTimeout(() => { inventoryFilters.search = input.value.trim(); inventoryFilters.page = 1; reload(); }, 300); });
  categoryFilter.onchange = () => { inventoryFilters.categoryId = categoryFilter.value; inventoryFilters.page = 1; reload(); };
  brandFilter.onchange = () => { inventoryFilters.brandId = brandFilter.value; inventoryFilters.page = 1; reload(); };
  locationFilter.onchange = () => { inventoryFilters.location = locationFilter.value; inventoryFilters.page = 1; reload(); };
  statusFilter.onchange = () => { inventoryFilters.status = statusFilter.value; inventoryFilters.page = 1; setActiveQuick(statusFilter.value === 'low' ? 'low' : 'all'); reload(); };
  sort.onchange = () => { inventoryFilters.sort = sort.value; inventoryFilters.page = 1; setActiveQuick(sort.value === 'usage_desc' ? 'used' : inventoryFilters.status === 'low' ? 'low' : inventoryFilters.status === 'reorder' ? 'reorder' : 'all'); reload(); };
  $$('[data-stock-quick]', page).forEach((button) => button.onclick = () => setQuickFilter(button.dataset.stockQuick));
  $('.inventory-clear-filters', page).onclick = () => { Object.assign(inventoryFilters, { search: '', categoryId: '', brandId: '', location: '', status: 'all', sort: 'name_asc', page: 1 }); input.value = ''; categoryFilter.value = ''; brandFilter.value = ''; locationFilter.value = ''; statusFilter.value = 'all'; sort.value = 'name_asc'; setActiveQuick('all'); reload(); };
  $('#inventory-scan').onclick = () => toast('Leitor de código preparado para uma futura integração. Nenhum scanner está configurado.');
  $('.inventory-movements-link', page).onclick = () => showPage('inventory-movements');
  $('[data-open-movements]', page).onclick = () => showPage('inventory-movements');
  $$('[data-panel-filter]', page).forEach((button) => button.onclick = () => setQuickFilter(button.dataset.panelFilter));
  const entry = (initialPart = null) => {
    modalReturnFocus = document.activeElement; $('#dynamic-modal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'dynamic-modal'; wrap.className = 'modal-wrap show';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="inventory-entry-title"><div class="modal-head"><h2 id="inventory-entry-title">Adicionar peça</h2><p>Digite uma peça ou escolha na biblioteca. Marca é opcional e pode ser usada com qualquer peça.</p></div><div class="modal-body"><div class="form-grid"><div class="field"><label for="inventory-piece-search">Peça *</label><input id="inventory-piece-search" autocomplete="off" placeholder="Ex.: catraca 7 velocidades" aria-describedby="inventory-library-status"></div><div class="field"><label for="inventory-brand">Marca (opcional)</label><select id="inventory-brand"></select></div><div class="part-library"><div class="part-library-head" id="inventory-library-status" aria-live="polite">Biblioteca de peças</div><div class="part-library-list"></div></div><div class="field"><label for="inventory-document">Documento *</label><input id="inventory-document" placeholder="Nota, recibo ou controle interno"></div><div class="field"><label for="inventory-cost">Preço de custo (R$) *</label><input id="inventory-cost" inputmode="decimal" placeholder="0,00"></div><div class="field"><label for="inventory-sale">Preço de venda (R$) *</label><input id="inventory-sale" inputmode="decimal" placeholder="0,00"></div><div class="field"><label for="inventory-date">Data *</label><input id="inventory-date" type="date"></div><div class="field"><label for="inventory-quantity">Quantidade *</label><input id="inventory-quantity" type="number" min="0.001" step="0.001"></div><div class="field"><label for="inventory-minimum">Estoque mínimo</label><input id="inventory-minimum" type="number" min="0" step="0.001" value="0"></div><div class="field"><label for="inventory-location">Localização</label><input id="inventory-location"></div><div class="field"><label for="inventory-supplier">Fornecedor</label><input id="inventory-supplier"></div><div class="field"><label for="inventory-reason">Observação</label><textarea id="inventory-reason"></textarea></div></div><div class="field-error is-hidden" id="inventory-entry-error" role="alert"></div></div><div class="modal-foot"><button type="button" class="btn" data-cancel>Cancelar</button><button type="button" class="btn primary" data-save>Salvar peça</button></div></div>';
    const pieceInput = $('#inventory-piece-search', wrap); const brandSelect = $('#inventory-brand', wrap); const library = $('.part-library-list', wrap); const status = $('#inventory-library-status', wrap); const error = $('#inventory-entry-error', wrap); let selectedPartId = initialPart?.id || null; pieceInput.value = initialPart ? catalogPartDisplayName(initialPart) : '';
    brandSelect.add(new Option('Sem marca', '')); catalogBrandsData.forEach((brand) => brandSelect.add(new Option(brand.name, brand.id)));
    const categoryField = document.createElement('div'); categoryField.className = 'field'; const categoryLabel = document.createElement('label'); categoryLabel.htmlFor = 'inventory-category'; categoryLabel.textContent = 'Categoria'; const categorySelect = document.createElement('select'); categorySelect.id = 'inventory-category'; categorySelect.add(new Option('Sem categoria', '')); catalogCategoriesData.forEach((category) => categorySelect.add(new Option(category.name, category.id))); categoryField.append(categoryLabel, categorySelect); brandSelect.closest('.field').after(categoryField); const skuField = document.createElement('div'); skuField.className = 'field'; const skuLabel = document.createElement('label'); skuLabel.htmlFor = 'inventory-sku'; skuLabel.textContent = 'Código / SKU'; const skuInput = document.createElement('input'); skuInput.id = 'inventory-sku'; skuInput.placeholder = 'Ex.: SHI-SMRT66-180'; skuField.append(skuLabel, skuInput); categoryField.after(skuField);
    $('#inventory-date', wrap).value = new Date().toISOString().slice(0, 10);
    const uniqueParts = [...new Map(catalogPartsData.map((part) => [`${norm(part.name)}|${norm(part.model || '')}`, part])).values()];
    const renderLibrary = () => {
      const query = norm(pieceInput.value.trim()); const matches = uniqueParts.filter((part) => !query || norm([part.name, part.model, part.category?.name, ...(part.aliases || [])].filter(Boolean).join(' ')).includes(query));
      library.innerHTML = ''; status.textContent = `Biblioteca de peças · ${matches.length} resultado(s)`;
      matches.slice(0, 40).forEach((part) => { const button = document.createElement('button'); button.type = 'button'; button.className = `part-library-option${part.id === selectedPartId ? ' selected' : ''}`; button.innerHTML = '<b></b><div class="item-sub"></div>'; $('b', button).textContent = part.name; $('.item-sub', button).textContent = [part.category?.name, part.model].filter(Boolean).join(' · '); button.onclick = () => { selectedPartId = part.id; pieceInput.value = catalogPartDisplayName(part); categorySelect.value = part.categoryId || part.category?.id || ''; renderLibrary(); }; library.append(button); });
      if (!matches.length) library.innerHTML = '<div class="item-sub" style="padding:14px">Nenhuma peça igual. O texto digitado será cadastrado como peça personalizada.</div>';
    };
    pieceInput.oninput = () => { selectedPartId = null; renderLibrary(); }; renderLibrary();
    const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; }; $('[data-cancel]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
    $('[data-save]', wrap).onclick = async () => {
      error.classList.add('is-hidden'); const customName = pieceInput.value.trim().replace(/\s+/g, ' '); const brandId = brandSelect.value || undefined; const categoryId = categorySelect.value || undefined; const sku = skuInput.value.trim() || undefined; const quantity = Number($('#inventory-quantity', wrap).value); const minimumQuantity = Number($('#inventory-minimum', wrap).value || 0); const costPriceCents = moneyToCents($('#inventory-cost', wrap).value); const salePriceCents = moneyToCents($('#inventory-sale', wrap).value); const purchaseDocument = $('#inventory-document', wrap).value.trim(); const purchaseDate = $('#inventory-date', wrap).value; const supplierName = $('#inventory-supplier', wrap).value.trim() || undefined; const location = $('#inventory-location', wrap).value.trim() || undefined; const reason = $('#inventory-reason', wrap).value.trim() || undefined;
      if (customName.length < 2) error.textContent = 'Digite ou selecione a peça.'; else if (!purchaseDocument) error.textContent = 'Documento é obrigatório.'; else if (costPriceCents === null) error.textContent = 'Preço de custo inválido. Use, por exemplo, 19,90.'; else if (salePriceCents === null) error.textContent = 'Preço de venda inválido. Use, por exemplo, 29,90.'; else if (!purchaseDate) error.textContent = 'Data é obrigatória.'; else if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity * 1000)) error.textContent = 'Quantidade deve ser maior que zero e ter no máximo três casas decimais.'; else if (!Number.isFinite(minimumQuantity) || minimumQuantity < 0 || !Number.isInteger(minimumQuantity * 1000)) error.textContent = 'Estoque mínimo inválido.'; else {
        const sameBrand = (item) => (item.brandId || '') === (brandId || ''); const existing = selectedPartId ? inventoryData.find((item) => item.catalogPartId === selectedPartId && sameBrand(item)) : inventoryData.find((item) => !item.catalogPartId && norm(item.customName || '') === norm(customName) && sameBrand(item)); const button = $('[data-save]', wrap); button.disabled = true;
        try { if (existing) await api(`/api/inventory/${existing.id}/entry`, { method: 'POST', body: JSON.stringify({ quantity, unitCostCents: costPriceCents, salePriceCents, supplierName, purchaseDocument, purchaseDate, reason }) }); else { const common = { brandId, categoryId, sku, quantity, minimumQuantity, costPriceCents, salePriceCents, supplierName, purchaseDocument, purchaseDate, location, notes: reason }; await api(selectedPartId ? '/api/inventory/from-catalog' : '/api/inventory', { method: 'POST', body: JSON.stringify(selectedPartId ? { ...common, catalogPartId: selectedPartId } : { ...common, customName }) }); } await hydrateInventoryFromApi(false); close(); toast('Peça e entrada registradas no estoque.', 'success'); return; } catch (caught) { error.textContent = caught.message; } finally { button.disabled = false; }
      }
      error.classList.remove('is-hidden');
    };
    document.body.append(wrap); setTimeout(() => pieceInput.focus(), 20);
  };
  window.openInventoryEntry = entry;
  findButton('Entrada de estoque', $('#dashboard')).onclick = () => entry();
  render();
}

function openInventoryMovement(item, action) {
  if (action === 'adjust') return formModal({ title: `Ajustar · ${item.name}`, description: `Sistema: ${item.quantity}. Reservado: ${item.reserved}. Informe a contagem física correta.`, fields: [{ name: 'counted', label: 'Estoque físico correto *', type: 'number', required: true, value: String(item.quantity) }, { name: 'reason', label: 'Motivo *', type: 'textarea', required: true }], confirm: 'Salvar ajuste', action: async (values) => { try { await api(`/api/inventory/${item.id}/physical-count`, { method: 'POST', body: JSON.stringify({ countedQuantity: Number(values.counted), reason: values.reason }) }); await hydrateInventoryFromApi(false); toast('Estoque ajustado com sucesso.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  if (action === 'edit') return formModal({ title: `Editar · ${item.name}`, description: 'Quantidade não pode ser editada aqui. Use entrada, saída ou ajuste.', fields: [{ name: 'name', label: 'Nome', value: item.catalogPartId ? '' : item.name, disabled: Boolean(item.catalogPartId) }, { name: 'brandId', label: 'Marca', type: 'select', options: [{ value: '', label: 'Sem marca' }, ...catalogBrandsData.map((brand) => ({ value: brand.id, label: brand.name }))], value: item.brandId || '' }, { name: 'categoryId', label: 'Categoria', type: 'select', options: [{ value: '', label: 'Sem categoria' }, ...catalogCategoriesData.map((category) => ({ value: category.id, label: category.name }))], value: item.categoryId || '' }, { name: 'sku', label: 'Código / SKU', value: item.sku || '' }, { name: 'minimum', label: 'Estoque mínimo', type: 'number', value: String(item.minimum) }, { name: 'sale', label: 'Preço de venda (R$)', value: (item.price / 100).toFixed(2).replace('.', ',') }, { name: 'location', label: 'Localização', value: item.location || '' }, { name: 'supplier', label: 'Fornecedor', value: item.supplierName || '' }, { name: 'notes', label: 'Observação', type: 'textarea', value: item.notes || '' }], confirm: 'Salvar alterações', action: async (values) => { const salePriceCents = moneyToCents(values.sale); if (salePriceCents === null) return toast('Preço de venda inválido.', 'error'), false; try { await api(`/api/inventory/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...(!item.catalogPartId ? { name: values.name } : {}), brandId: values.brandId || null, categoryId: values.categoryId || null, sku: values.sku || null, minimumQuantity: Number(values.minimum), salePriceCents, location: values.location || null, supplierName: values.supplier || null, notes: values.notes || null }) }); await hydrateInventoryFromApi(false); toast('Peça atualizada.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  if (!['entry', 'exit'].includes(action)) return;
  const isEntry = action === 'entry'; modalReturnFocus = document.activeElement; $('#dynamic-modal')?.remove();
  const wrap = document.createElement('div'); wrap.id = 'dynamic-modal'; wrap.className = 'modal-wrap show';
  wrap.innerHTML = `<div class="modal stock-movement-modal" role="dialog" aria-modal="true" aria-labelledby="stock-movement-title"><div class="modal-head"><h2 id="stock-movement-title"></h2><p></p></div><div class="modal-body"><div class="stock-movement-identity"><strong></strong><span></span></div><div class="form-grid"><div class="field quantity-field"><label for="stock-movement-quantity">Quantidade *</label><div class="quantity-stepper"><button type="button" data-decrease aria-label="Diminuir quantidade">−</button><input id="stock-movement-quantity" type="number" min="0.001" step="0.001" value="1" required><button type="button" data-increase aria-label="Aumentar quantidade">+</button></div></div><div data-movement-fields></div></div><div class="field-error is-hidden" data-movement-error role="alert"></div></div><div class="modal-foot"><button type="button" class="btn" data-cancel>Cancelar</button><button type="button" class="btn primary" data-confirm></button></div></div>`;
  $('#stock-movement-title', wrap).textContent = isEntry ? 'Dar entrada' : 'Usar peça';
  $('.modal-head p', wrap).textContent = isEntry ? 'A entrada será registrada no histórico e atualizará o custo médio.' : 'A saída será registrada no histórico de movimentações.';
  $('.stock-movement-identity strong', wrap).textContent = [item.name, item.sku].filter(Boolean).join(' · ');
  $('.stock-movement-identity span', wrap).textContent = isEntry ? `Estoque físico atual: ${item.quantity}` : `Disponível: ${item.available} ${item.unit}`;
  const fields = $('[data-movement-fields]', wrap); fields.className = 'form-grid';
  fields.innerHTML = isEntry ? '<div class="field"><label for="stock-document">Documento *</label><input id="stock-document" placeholder="Nota, recibo ou controle interno"></div><div class="field"><label for="stock-date">Data *</label><input id="stock-date" type="date"></div><div class="field"><label for="stock-cost">Preço de custo (R$) *</label><input id="stock-cost" inputmode="decimal" placeholder="0,00"></div><div class="field"><label for="stock-sale">Preço de venda (R$)</label><input id="stock-sale" inputmode="decimal"></div><div class="field"><label for="stock-supplier">Fornecedor</label><input id="stock-supplier"></div><div class="field"><label for="stock-notes">Observação</label><textarea id="stock-notes"></textarea></div>' : '<div class="field"><label for="stock-reason">Motivo *</label><select id="stock-reason"></select></div><div class="field"><label for="stock-document">Documento</label><input id="stock-document"></div><div class="field"><label for="stock-notes">Observação</label><textarea id="stock-notes"></textarea></div>';
  const quantityInput = $('#stock-movement-quantity', wrap); const errorBox = $('[data-movement-error]', wrap); const confirmButton = $('[data-confirm]', wrap); confirmButton.textContent = isEntry ? 'Confirmar entrada' : 'Confirmar saída';
  if (isEntry) { $('#stock-date', wrap).value = new Date().toISOString().slice(0, 10); $('#stock-sale', wrap).value = (item.price / 100).toFixed(2).replace('.', ','); $('#stock-supplier', wrap).value = item.supplierName || ''; }
  else { quantityInput.max = String(item.available); const reason = $('#stock-reason', wrap); Object.entries(manualExitReasonLabels).forEach(([value, label]) => reason.add(new Option(label, value))); }
  $('[data-decrease]', wrap).onclick = () => { quantityInput.value = String(Math.max(0.001, Number(quantityInput.value || 1) - 1)); };
  $('[data-increase]', wrap).onclick = () => { quantityInput.value = String(Math.min(isEntry ? 999999999 : item.available, Number(quantityInput.value || 0) + 1)); };
  const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; };
  $('[data-cancel]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
  confirmButton.onclick = async () => {
    errorBox.classList.add('is-hidden'); const movementQuantity = Number(quantityInput.value);
    if (!(movementQuantity > 0) || !Number.isInteger(movementQuantity * 1000)) { errorBox.textContent = 'Informe uma quantidade válida, com no máximo três casas decimais.'; errorBox.classList.remove('is-hidden'); return; }
    if (!isEntry && movementQuantity > item.available) { errorBox.textContent = `A saída não pode ser maior que o saldo disponível (${item.available}).`; errorBox.classList.remove('is-hidden'); return; }
    confirmButton.disabled = true;
    try {
      if (isEntry) {
        const documentValue = $('#stock-document', wrap).value.trim(); const date = $('#stock-date', wrap).value; const unitCostCents = moneyToCents($('#stock-cost', wrap).value); const salePriceCents = moneyToCents($('#stock-sale', wrap).value);
        if (!documentValue || !date || unitCostCents === null || salePriceCents === null) throw new Error('Preencha documento, data e valores válidos para registrar a entrada.');
        await api(`/api/inventory/${item.id}/entry`, { method: 'POST', body: JSON.stringify({ quantity: movementQuantity, unitCostCents, salePriceCents, supplierName: $('#stock-supplier', wrap).value.trim() || undefined, purchaseDocument: documentValue, purchaseDate: date, reason: $('#stock-notes', wrap).value.trim() || undefined }) });
      } else {
        await api(`/api/inventory/${item.id}/exit`, { method: 'POST', body: JSON.stringify({ quantity: movementQuantity, reasonCode: $('#stock-reason', wrap).value, document: $('#stock-document', wrap).value.trim() || undefined, notes: $('#stock-notes', wrap).value.trim() || undefined }) });
      }
      await hydrateInventoryFromApi(false); close(); toast(isEntry ? 'Entrada registrada com sucesso.' : 'Saída registrada com sucesso.', 'success');
    } catch (error) { errorBox.textContent = error.message; errorBox.classList.remove('is-hidden'); } finally { confirmButton.disabled = false; }
  };
  document.body.append(wrap); setTimeout(() => quantityInput.focus(), 20);
}

async function openInventoryHistory(item) {
  try {
    const movements = await api(`/api/inventory/movements?inventoryItemId=${encodeURIComponent(item.id)}`); modalReturnFocus = document.activeElement; const wrap = document.createElement('div'); wrap.className = 'modal-wrap show'; wrap.id = 'inventory-history-modal'; wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="stock-history-title"><div class="modal-head"><h2 id="stock-history-title">Histórico de movimentações</h2><p></p></div><div class="modal-body"><div class="card table"><div class="table-head" style="grid-template-columns:140px 1fr 80px 1fr 1fr"><div>Data</div><div>Tipo</div><div>Qtd.</div><div>Documento / origem</div><div>Usuário</div></div><div data-history-rows></div></div><div class="stock-levels"><div class="stock-level"><span>Físico</span><b></b></div><div class="stock-level"><span>Reservado</span><b></b></div><div class="stock-level"><span>Disponível</span><b></b></div></div></div><div class="modal-foot"><button class="btn" data-close>Fechar</button></div></div>'; $('.modal-head p', wrap).textContent = item.name; const rows = $('[data-history-rows]', wrap); movements.forEach((movement) => { const row = document.createElement('div'); row.className = 'table-row'; row.style.gridTemplateColumns = '140px 1fr 80px 1fr 1fr'; row.innerHTML = '<div></div><div></div><div></div><div></div><div></div>'; row.children[0].textContent = new Date(movement.createdAt).toLocaleString('pt-BR'); row.children[1].textContent = movementLabels[movement.type] || movement.type; row.children[2].textContent = `${Number(movement.quantityDelta) > 0 ? '+' : ''}${Number(movement.quantityDelta)}`; row.children[3].textContent = [movement.purchaseDocument, movement.originDestination, movement.workOrder?.number ? `OS #${movement.workOrder.number}` : ''].filter(Boolean).join(' · ') || '—'; row.children[4].textContent = movement.createdBy?.name || 'Usuário preservado'; rows.append(row); }); if (!movements.length) rows.innerHTML = '<div class="inventory-empty">Nenhuma movimentação registrada.</div>'; $$('.stock-level b', wrap).forEach((element, index) => element.textContent = [item.quantity, item.reserved, item.available][index]); const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); }; $('[data-close]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); }; document.body.append(wrap); $('[data-close]', wrap).focus();
  } catch (error) { toast(error.message, 'error'); }
}

function openInventoryDrawer(item) {
  $('#inventory-drawer')?.remove(); modalReturnFocus = document.activeElement; const state = item.available === 0 ? 'zero' : item.available <= item.minimum ? 'low' : 'normal'; const label = state === 'zero' ? 'Zerado' : state === 'low' ? 'Estoque baixo' : 'Normal'; const margin = item.price > 0 ? Math.round(((item.price - item.cost) / item.price) * 100) : 0; const wrap = document.createElement('div'); wrap.id = 'inventory-drawer'; wrap.className = 'stock-drawer-wrap'; wrap.innerHTML = '<aside class="stock-drawer" role="dialog" aria-modal="true" aria-labelledby="stock-drawer-title"><div class="drawer-head"><div><h2 id="stock-drawer-title"></h2><div class="stock-tags"><span class="pill brand"></span><span class="pill category"></span><span class="stock-status"></span></div></div><button class="icon-btn" aria-label="Fechar detalhes">×</button></div><div class="drawer-section"><h3>Estoque</h3><div class="stock-levels"><div class="stock-level"><span>Físico</span><b></b></div><div class="stock-level"><span>Reservado</span><b></b></div><div class="stock-level"><span>Disponível</span><b></b></div></div><div class="item-sub minimum"></div></div><div class="drawer-section"><h3>Preços</h3><div class="price-grid"><div><span>Custo médio</span><b class="cost"></b></div><div><span>Venda</span><b class="sale"></b></div><div><span>Margem</span><b class="margin"></b></div></div></div><div class="drawer-section"><h3>Informações</h3><div class="info-grid"><div><span>Código / SKU</span><b class="sku"></b></div><div><span>Localização</span><b class="location-value"></b></div><div><span>Fornecedor</span><b class="supplier"></b></div><div><span>Categoria</span><b class="category-value"></b></div></div><p class="item-sub notes"></p></div><div class="drawer-section"><h3>Ações rápidas</h3><div class="drawer-actions"><button class="btn" data-action="history">Ver histórico</button><button class="btn primary" data-action="entry">Entrada</button><button class="btn" data-action="exit">Saída</button><button class="btn" data-action="adjust">Ajustar</button><button class="btn" data-action="edit">Editar</button></div></div></aside>'; $('#stock-drawer-title', wrap).textContent = item.name; $('.brand', wrap).textContent = item.brand || 'Sem marca'; $('.category', wrap).textContent = item.category; const badge = $('.stock-status', wrap); badge.textContent = label; badge.className = `stock-status ${state}`; $$('.stock-level b', wrap).forEach((element, index) => element.textContent = [item.quantity, item.reserved, item.available][index]); $('.minimum', wrap).textContent = `Mínimo: ${item.minimum} unidade(s)`; $('.cost', wrap).textContent = money(item.cost); $('.sale', wrap).textContent = money(item.price); $('.margin', wrap).textContent = `${money(item.price - item.cost)} (${margin}%)`; $('.sku', wrap).textContent = item.sku || 'Não informado'; $('.location-value', wrap).textContent = item.location || 'Não informada'; $('.supplier', wrap).textContent = item.supplierName || 'Não informado'; $('.category-value', wrap).textContent = item.category; $('.notes', wrap).textContent = item.notes || 'Sem observações.'; const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); }; $('.icon-btn', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); }; $$('[data-action]', wrap).forEach((button) => button.onclick = () => { close(); if (button.dataset.action === 'history') openInventoryHistory(item); else openInventoryMovement(item, button.dataset.action); }); document.body.append(wrap); $('.icon-btn', wrap).focus();
}

function renderMovements() {
  const page = $('#inventory-movements'); const table = $('#movement-table'); if (!page || !table) return; $$('.table-row', table).forEach((row) => row.remove());
  movementsData.forEach((movement) => { const item = movement.item || inventoryData.find((stock) => stock.id === movement.inventoryId); const row = document.createElement('div'); row.className = 'table-row'; row.style.gridTemplateColumns = '150px 1fr 160px 110px 1fr'; row.innerHTML = '<div></div><div><b></b></div><div></div><div class="money"></div><div></div>'; row.children[0].textContent = new Date(movement.createdAt).toLocaleString('pt-BR'); $('b', row).textContent = item?.shortName || 'Item arquivado'; row.children[2].textContent = movementLabels[movement.type] || movement.type; row.children[3].textContent = `${movement.delta > 0 ? '+' : ''}${movement.delta}`; row.children[3].style.color = movement.delta < 0 ? 'var(--destructive)' : 'var(--success)'; row.children[4].textContent = [manualExitReasonLabels[movement.reasonCode], movement.reason].filter(Boolean).join(' · ') || (movement.orderId ? `OS #${movement.orderId}` : '—'); table.append(row); });
  if (!movementsData.length) { const empty = document.createElement('div'); empty.className = 'table-row'; empty.style.gridTemplateColumns = '1fr'; empty.textContent = 'Nenhuma movimentação registrada.'; table.append(empty); }
  const search = $('.searchbox input', page); search.oninput = () => filter(search, $$('.table-row', table));
}

function catalog() {
  const livePage = $('#catalog'); const liveInput = $('.searchbox input', livePage); const liveList = $('.catalog-list', livePage); let liveTimer;
  const renderLiveCatalog = async () => {
    try {
      const query = liveInput.value.trim();
      const result = await api(`/api/catalog-parts?pageSize=50${query ? `&q=${encodeURIComponent(query)}` : ''}`); liveList.innerHTML = '';
      result.items.forEach((part) => {
        const stock = part.inventoryItems[0]; const row = document.createElement('div'); row.className = 'part-row'; row.innerHTML = '<div><h4></h4><div class="meta"></div><div class="tagrow"></div></div><div><span class="pill"></span></div><div><button class="btn"></button></div>';
        $('h4', row).textContent = part.name; $('.meta', row).textContent = `${part.category.name}${part.model ? ` · ${part.model}` : ''}${part.manufacturerCode ? ` · ${part.manufacturerCode}` : ''}`; $('.tagrow', row).textContent = 'Escolha qualquer marca ao adicionar'; const badge = $('.pill', row); badge.textContent = stock ? `Disponível: ${Number(stock.quantity) - Number(stock.reservedQuantity)}` : 'Fora do estoque'; if (stock) badge.classList.add('green'); const button = $('button', row); button.textContent = stock ? 'Ver peça' : 'Adicionar'; if (!stock) button.classList.add('primary'); button.onclick = () => stock ? showPage('inventory') : window.openInventoryEntry?.(part); liveList.append(row);
      });
      if (!result.items.length) liveList.innerHTML = '<div class="part-row"><div>Nenhuma peça encontrada no catálogo.</div></div>';
    } catch (error) { toast(error.message, 'error'); }
  };
  liveInput.value = ''; liveInput.oninput = () => { clearTimeout(liveTimer); liveTimer = setTimeout(renderLiveCatalog, 250); }; $$('input[type=checkbox]', livePage).forEach((box) => { box.checked = false; box.disabled = true; }); $$('.toolbar .pill', livePage).forEach((pill) => pill.remove()); window.renderCatalog = renderLiveCatalog; void renderLiveCatalog(); return;
  const page = $('#catalog'); const input = $('.searchbox input', page); const rows = $$('.part-row', page);
  const apply = () => filter(input, rows);
  input.oninput = apply;
  $$('input[type=checkbox]', page).forEach((box) => box.onchange = () => { const terms = $$('input:checked', page).map((item) => norm(item.closest('label').textContent).replace('correntes', 'corrente').replace('velocidades', 'v')); rows.forEach((row) => row.classList.toggle('is-hidden', terms.some((term) => !norm(row.textContent).includes(term)) || !norm(row.textContent).includes(norm(input.value)))); });
  $$('.part-row button', page).forEach((button) => button.onclick = () => {
    const row = button.closest('.part-row'); const shortName = $('h4', row).textContent; const existing = inventoryData.find((item) => norm(item.shortName) === norm(shortName));
    if (existing) return toast(`${shortName}: ${existing.quantity} em estoque · ${existing.location}.`);
    formModal({ title: `Adicionar ${shortName}`, description: 'Informe os dados locais da oficina. A vinculação ao catálogo global será preservada na próxima importação.', fields: [{ name: 'quantity', label: 'Quantidade inicial', type: 'number', required: true }, { name: 'minimum', label: 'Estoque mínimo', type: 'number', required: true }, { name: 'price', label: 'Preço de venda (R$)', type: 'number', required: true }, { name: 'location', label: 'Localização' }], action: async ({ quantity, minimum, price, location }) => { try { await api('/api/inventory', { method: 'POST', body: JSON.stringify({ customName: shortName, quantity: Number(quantity), minimumQuantity: Number(minimum), salePriceCents: Math.round(Number(price) * 100), location }) }); await hydrateInventoryFromApi(false); const item = inventoryData.find((stock) => norm(stock.name) === norm(shortName)); row.children[1].innerHTML = `<span class="pill green">No estoque: ${item?.quantity || 0}</span>`; button.textContent = 'Ver peça'; button.classList.remove('primary'); toast(`${shortName} adicionado ao banco.`, 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  });
  $$('.toolbar .pill', page).forEach((pill) => { pill.classList.add('clickable'); pill.onclick = () => { pill.remove(); input.value = ''; $$('input:checked', page).forEach((box) => box.checked = false); apply(); }; });
}

function services() {
  const page = $('#services'); const table = $('#service-table'); const search = $('.searchbox input', page); let showArchived = false;
  const categories = ['Diagnóstico', 'Revisão', 'Transmissão', 'Freios', 'Rodas e pneus', 'Rolamentos', 'Cockpit e direção', 'Suspensão', 'Limpeza', 'Montagem'];
  const edit = (service) => formModal({ title: service ? 'Editar serviço' : 'Novo serviço', fields: [{ name: 'name', label: 'Nome', required: true, value: service?.name || '' }, { name: 'category', label: 'Categoria', type: 'select', options: [{ label: 'Sem categoria', value: '' }, ...categories], value: service?.category || '' }, { name: 'price', label: 'Preço de venda (R$)', required: true, inputMode: 'decimal', placeholder: '0,00', value: service ? (service.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '' }, { name: 'duration', label: 'Duração estimada (min)', type: 'number', value: service?.estimatedDurationMinutes || '' }, { name: 'warranty', label: 'Garantia padrão (dias)', type: 'number', value: service?.warrantyDays || '' }], action: async ({ name, category, price, duration, warranty }) => { const cents = moneyToCents(price); if (cents === null) { toast('Informe um preço de venda válido, por exemplo 50,00.', 'error'); return false; } try { const saved = await api(service ? `/api/services/${service.id}` : '/api/services', { method: service ? 'PATCH' : 'POST', body: JSON.stringify({ name, category: category || undefined, priceCents: cents, estimatedDurationMinutes: duration ? Number(duration) : null, warrantyDays: warranty ? Number(warranty) : null }) }); const local = { ...saved, price: saved.priceCents }; if (service) Object.assign(service, local); else servicesData.push(local); saveServices(); render(); toast('Serviço salvo no banco.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  const render = () => {
    $$('.table-row', table).forEach((row) => row.remove());
    servicesData.filter((service) => service.active !== showArchived).forEach((service) => { const row = document.createElement('div'); row.className = 'table-row'; row.style.gridTemplateColumns = '1.4fr 1fr 150px 120px'; row.innerHTML = '<div><b></b></div><div></div><div class="money"></div><div><button class="btn"></button></div>'; $('b', row).textContent = service.name; row.children[1].textContent = service.category || 'Sem categoria'; row.children[2].textContent = money(service.price); const button = $('button', row); button.textContent = showArchived ? 'Reativar' : 'Editar'; button.onclick = async () => { if (!showArchived) return edit(service); try { const saved = await api(`/api/services/${service.id}`, { method: 'PATCH', body: JSON.stringify({ active: true }) }); Object.assign(service, saved, { price: saved.priceCents }); saveServices(); render(); toast('Serviço reativado no banco.', 'success'); } catch (error) { toast(error.message, 'error'); } }; if (!showArchived) { const archive = document.createElement('button'); archive.className = 'btn ghost'; archive.textContent = '×'; archive.title = 'Arquivar'; archive.onclick = async () => { if (!confirm(`Arquivar ${service.name}? As OS antigas não serão alteradas.`)) return; try { await api(`/api/services/${service.id}`, { method: 'DELETE' }); service.active = false; saveServices(); render(); toast('Serviço arquivado no banco; snapshots preservados.'); } catch (error) { toast(error.message, 'error'); } }; row.children[3].append(archive); } table.append(row); });
    if (!$$('.table-row', table).length) { const empty = document.createElement('div'); empty.className = 'table-row'; empty.style.gridTemplateColumns = '1fr'; empty.textContent = 'Nenhum serviço encontrado.'; table.append(empty); }
    search.dispatchEvent(new Event('input'));
  };
  search.oninput = () => filter(search, $$('.table-row', table)); findButton('Novo serviço', page).onclick = () => edit(null);
  $$('.segment button', page).forEach((button, index) => button.onclick = () => { showArchived = index === 1; $$('.segment button', page).forEach((item) => item.classList.remove('active')); button.classList.add('active'); render(); });
  window.renderServices = render; render();
}

// Mantido temporariamente para compatibilidade com snapshots de OS já existentes.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function checklistTemplatesLegacy() {
  const page = $('#checklists'); const grid = $('#checklist-grid');
  const edit = (template) => formModal({ title: template ? 'Editar checklist' : 'Novo checklist', description: 'Informe um item por linha, na ordem de execução.', fields: [{ name: 'name', label: 'Nome', required: true, value: template?.name || '' }, { name: 'description', label: 'Descrição', value: template?.description || '' }, { name: 'items', label: 'Itens', type: 'textarea', required: true, value: template?.items.join('\n') || '' }], action: async ({ name, description, items }) => { const lines = items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean); if (!lines.length) { toast('Adicione ao menos um item.', 'error'); return false; } try { const saved = await api(template ? `/api/checklists/${template.id}` : '/api/checklists', { method: template ? 'PATCH' : 'POST', body: JSON.stringify({ name, description, items: lines.map((label) => ({ label })) }) }); const local = { ...saved, items: saved.items.map((item) => item.label) }; if (template) Object.assign(template, local); else checklistsData.push(local); saveChecklists(); render(); toast('Checklist salvo no banco.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  const render = () => { grid.innerHTML = ''; checklistsData.filter((template) => template.active).forEach((template) => { const card = document.createElement('div'); card.className = 'stock-card'; card.innerHTML = '<div class="top"><div><h4></h4><div class="meta"></div></div><span class="pill blue"></span></div><div class="context" style="margin-top:16px"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn">Editar</button><button class="btn danger">Arquivar</button></div>'; $('h4', card).textContent = template.name; $('.meta', card).textContent = template.description; $('.pill', card).textContent = `${template.items.length} itens`; const preview = $('.context', card); template.items.slice(0, 4).forEach((item) => { const line = document.createElement('div'); line.className = 'item-sub'; line.textContent = `✓ ${item}`; preview.append(line); }); if (template.items.length > 4) { const more = document.createElement('div'); more.className = 'item-sub'; more.textContent = `+ ${template.items.length - 4} itens`; preview.append(more); } const [editButton, archiveButton] = $$('button', card); editButton.onclick = () => edit(template); archiveButton.onclick = async () => { if (!confirm(`Arquivar ${template.name}? Checklists já aplicados serão preservados.`)) return; try { await api(`/api/checklists/${template.id}`, { method: 'DELETE' }); template.active = false; saveChecklists(); render(); toast('Template arquivado no banco; snapshots preservados.'); } catch (error) { toast(error.message, 'error'); } }; grid.append(card); }); };
  window.renderChecklists = render; findButton('Novo checklist', page).onclick = () => edit(null); render();
}

function checklists() {
  const page = $('#checklists'); const grid = $('#checklist-grid');
  const editor = (checklist = null) => {
    modalReturnFocus = document.activeElement; $('#dynamic-modal')?.remove();
    const wrap = document.createElement('div'); wrap.id = 'dynamic-modal'; wrap.className = 'modal-wrap show';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="checklist-editor-title"><div class="modal-head"><h2 id="checklist-editor-title"></h2><p>Escolha cliente e bicicleta. Digite um item e pressione Enter.</p></div><div class="modal-body"><div class="form-grid"><div class="field"><label for="checklist-customer">Cliente *</label><select id="checklist-customer"></select></div><div class="field"><label for="checklist-bike">Bicicleta *</label><select id="checklist-bike"></select></div><div class="field"><label for="checklist-title">Título *</label><input id="checklist-title" required></div><div class="field"><label for="checklist-new-item">Novo item</label><div style="display:flex;gap:8px"><input id="checklist-new-item" list="checklist-suggestions"><button type="button" class="btn" data-add-item>Adicionar</button></div><datalist id="checklist-suggestions"></datalist></div></div><div id="checklist-items" class="stack" style="margin-top:18px"></div><div class="field-error is-hidden" id="checklist-editor-error" role="alert"></div></div><div class="modal-foot"><button type="button" class="btn" data-cancel>Cancelar</button><button type="button" class="btn primary" data-save>Salvar checklist</button></div></div>';
    $('#checklist-editor-title', wrap).textContent = checklist ? 'Editar checklist' : 'Novo checklist';
    const customerSelect = $('#checklist-customer', wrap); const bikeSelect = $('#checklist-bike', wrap); const title = $('#checklist-title', wrap); const newItem = $('#checklist-new-item', wrap); const itemList = $('#checklist-items', wrap); const error = $('#checklist-editor-error', wrap);
    customerSelect.add(new Option('Selecione o cliente', '')); customersData.filter((customer) => customer.active).forEach((customer) => customerSelect.add(new Option(`${customer.name} · ${customer.phone}`, customer.id)));
    checklistSuggestionsData.forEach((suggestion) => $('#checklist-suggestions', wrap).append(new Option(suggestion.label)));
    let items = (checklist?.items || []).map((item) => ({ label: item.label, checked: item.checked }));
    const refreshBikes = () => { const current = bikeSelect.value; bikeSelect.innerHTML = ''; bikeSelect.add(new Option(customerSelect.value ? 'Selecione a bicicleta' : 'Selecione primeiro o cliente', '')); const customer = customersData.find((item) => item.id === customerSelect.value); (customer?.bikes || []).filter((bike) => bike.active).forEach((bike) => bikeSelect.add(new Option(`${bike.brand} ${bike.model}`, bike.id))); if ([...bikeSelect.options].some((option) => option.value === current)) bikeSelect.value = current; };
    const normalized = (value) => norm(value.trim().replace(/\s+/g, ' '));
    const renderItems = () => { itemList.innerHTML = ''; items.forEach((item, index) => { const row = document.createElement('div'); row.className = 'field'; row.style.display = 'grid'; row.style.gridTemplateColumns = '32px 1fr auto'; row.style.gap = '8px'; row.style.alignItems = 'center'; row.innerHTML = '<input type="checkbox" aria-label="Marcar item"><input aria-label="Texto do item"><button type="button" class="btn danger" aria-label="Remover item">Remover</button>'; const [checked, label, remove] = row.children; checked.checked = item.checked; checked.onchange = () => { item.checked = checked.checked; }; label.value = item.label; label.oninput = () => { item.label = label.value; }; remove.onclick = () => { items.splice(index, 1); renderItems(); }; itemList.append(row); }); if (!items.length) itemList.innerHTML = '<div class="muted">Nenhum item. Digite o primeiro item acima.</div>'; };
    const addItem = () => { const label = newItem.value.trim().replace(/\s+/g, ' '); if (!label) return; if (items.some((item) => normalized(item.label) === normalized(label))) { error.textContent = 'Este item já está no checklist.'; error.classList.remove('is-hidden'); return; } items.push({ label, checked: false }); newItem.value = ''; error.classList.add('is-hidden'); renderItems(); newItem.focus(); };
    customerSelect.onchange = refreshBikes; $('[data-add-item]', wrap).onclick = addItem; newItem.onkeydown = (event) => { if (event.key === 'Enter') { event.preventDefault(); addItem(); } };
    if (checklist) { customerSelect.value = checklist.customerId; refreshBikes(); bikeSelect.value = checklist.bikeId; title.value = checklist.title; } else { refreshBikes(); title.value = 'Checklist da bicicleta'; }
    renderItems();
    const close = () => { wrap.remove(); modalReturnFocus?.focus?.(); modalReturnFocus = null; }; $('[data-cancel]', wrap).onclick = close; wrap.onclick = (event) => { if (event.target === wrap) close(); }; wrap.onkeydown = (event) => { if (event.key === 'Escape') close(); else trapModal(wrap, event); };
    $('[data-save]', wrap).onclick = async () => { error.classList.add('is-hidden'); const cleanItems = items.map((item) => ({ ...item, label: item.label.trim().replace(/\s+/g, ' ') })).filter((item) => item.label); if (!customerSelect.value) error.textContent = 'Selecione o cliente.'; else if (!bikeSelect.value) error.textContent = 'Selecione uma bicicleta deste cliente.'; else if (!title.value.trim()) error.textContent = 'Título é obrigatório.'; else if (!cleanItems.length) error.textContent = 'Adicione ao menos um item.'; else if (new Set(cleanItems.map((item) => normalized(item.label))).size !== cleanItems.length) error.textContent = 'Remova itens repetidos.'; else { const button = $('[data-save]', wrap); button.disabled = true; try { await api(checklist ? `/api/bike-checklists/${checklist.id}` : '/api/bike-checklists', { method: checklist ? 'PATCH' : 'POST', body: JSON.stringify({ customerId: customerSelect.value, bikeId: bikeSelect.value, title: title.value.trim(), items: cleanItems }) }); await load(); close(); toast('Checklist salvo no banco.', 'success'); return; } catch (caught) { error.textContent = caught.message; } finally { button.disabled = false; } } error.classList.remove('is-hidden'); };
    document.body.append(wrap); setTimeout(() => customerSelect.focus(), 20);
  };
  const render = () => { grid.innerHTML = ''; bikeChecklistsData.forEach((checklist) => { const card = document.createElement('div'); card.className = 'stock-card'; const done = checklist.items.filter((item) => item.checked).length; card.innerHTML = '<div class="top"><div><h4></h4><div class="meta"></div></div><span class="pill blue"></span></div><div class="context" style="margin-top:16px"></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn">Editar</button><button class="btn danger">Arquivar</button></div>'; $('h4', card).textContent = checklist.title; $('.meta', card).textContent = `${checklist.customer.name} · ${checklist.bike.brand} ${checklist.bike.model}`; $('.pill', card).textContent = `${done}/${checklist.items.length}`; checklist.items.slice(0, 5).forEach((item) => { const line = document.createElement('div'); line.className = 'item-sub'; line.textContent = `${item.checked ? '✓' : '○'} ${item.label}`; $('.context', card).append(line); }); const [editButton, archiveButton] = $$('button', card); editButton.onclick = () => editor(checklist); archiveButton.onclick = async () => { if (!confirm(`Arquivar ${checklist.title}?`)) return; try { await api(`/api/bike-checklists/${checklist.id}`, { method: 'DELETE' }); await load(); toast('Checklist arquivado.'); } catch (error) { toast(error.message, 'error'); } }; grid.append(card); }); if (!bikeChecklistsData.length) grid.innerHTML = '<div class="card" style="padding:28px;text-align:center;color:var(--muted-foreground)">Nenhum checklist criado. Selecione cliente e bicicleta para começar.</div>'; };
  const load = async () => { try { [bikeChecklistsData, checklistSuggestionsData] = await Promise.all([api('/api/bike-checklists'), api('/api/checklist-suggestions')]); render(); } catch (error) { grid.innerHTML = '<div class="card" style="padding:28px;color:var(--destructive)"></div>'; grid.firstElementChild.textContent = `Não foi possível carregar checklists: ${error.message}`; } };
  window.renderChecklists = render; findButton('Novo checklist', page).onclick = () => editor(); render(); void load();
}

function team() {
  const page = $('#team'); const table = $('#team-table'); const addButton = findButton('Adicionar membro', page); let members = [];
  const roleLabels = { OWNER: 'Proprietário', MANAGER: 'Gerente', ATTENDANT: 'Atendimento', MECHANIC: 'Mecânico', STOCKKEEPER: 'Estoque' };
  const availableRoles = () => (window.currentMembership?.role === 'OWNER' ? Object.keys(roleLabels) : Object.keys(roleLabels).filter((role) => role !== 'OWNER')).map((role) => ({ label: roleLabels[role], value: role }));
  const update = async (member, change) => { try { Object.assign(member, await api(`/api/team/${member.id}`, { method: 'PATCH', body: JSON.stringify(change) })); render(); toast('Acesso da equipe atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); } };
  const edit = (member) => {
    const editingSelf = member.id === window.currentMembership?.id;
    formModal({ title: `Editar membro · ${member.user.name}`, description: editingSelf ? 'Nome pode ser editado. Seu próprio papel é protegido para evitar perda de acesso.' : 'Altere nome e papel. Histórico anterior permanece vinculado ao usuário.', fields: [{ name: 'name', label: 'Nome', required: true, value: member.user.name }, { name: 'role', label: 'Papel', type: 'select', required: true, options: availableRoles(), value: member.role, disabled: editingSelf }], action: async ({ name, role }) => { const change = { name, ...(!editingSelf ? { role } : {}) }; try { Object.assign(member, await api(`/api/team/${member.id}`, { method: 'PATCH', body: JSON.stringify(change) })); render(); toast('Cadastro do membro atualizado.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
    const card = document.createElement('div'); card.className = 'audit-card'; card.innerHTML = '<b>Última edição por:</b><div class="item-sub"></div>'; $('.item-sub', card).textContent = member.lastEditedBy ? `${member.lastEditedBy} · ${new Date(member.lastEditedAt).toLocaleString('pt-BR')}` : 'Sem edição registrada'; $('.modal-body', $('#dynamic-modal')).append(card);
  };
  const render = () => {
    const canManage = ['OWNER', 'MANAGER'].includes(window.currentMembership?.role);
    addButton.classList.toggle('is-hidden', !canManage);
    $$('.table-row', table).forEach((row) => row.remove());
    members.forEach((member) => {
      const row = document.createElement('div'); row.className = 'table-row'; row.style.gridTemplateColumns = '1.4fr 1fr 150px 220px'; row.innerHTML = '<div><b></b><div class="item-sub"></div></div><div></div><div></div><div class="actions"></div>';
      $('b', row).textContent = member.user.name; $('.item-sub', row).textContent = `${member.active ? 'Acesso ativo' : 'Acesso desativado'}${member.lastEditedBy ? ` · última edição por ${member.lastEditedBy}` : ''}`; row.children[1].textContent = member.user.email; row.children[2].textContent = roleLabels[member.role] || member.role;
      const actions = $('.actions', row);
      if (canManage) { const role = document.createElement('button'); role.className = 'btn'; role.textContent = 'Editar membro'; role.disabled = !member.active || (window.currentMembership?.role !== 'OWNER' && member.role === 'OWNER'); role.onclick = () => edit(member); const active = document.createElement('button'); active.className = member.active ? 'btn danger' : 'btn'; active.textContent = member.active ? 'Desativar' : 'Reativar'; active.disabled = member.id === window.currentMembership?.id || (window.currentMembership?.role !== 'OWNER' && member.role === 'OWNER'); active.onclick = () => update(member, { active: !member.active }); actions.append(role, active); }
      else actions.textContent = 'Somente leitura';
      table.append(row);
    });
  };
  const load = async () => { try { members = await api('/api/team'); render(); } catch (error) { toast(error.message, 'error'); } };
  addButton.onclick = () => formModal({ title: 'Adicionar membro', description: 'Para conta nova, informe nome e senha inicial. Para usuário existente, somente e-mail e papel.', fields: [{ name: 'name', label: 'Nome da nova conta' }, { name: 'email', label: 'E-mail', type: 'email', required: true }, { name: 'password', label: 'Senha inicial (mínimo 12 caracteres)', type: 'password' }, { name: 'role', label: 'Papel', type: 'select', required: true, options: availableRoles(), value: 'MECHANIC' }], action: async (values) => { const payload = { email: values.email, role: values.role, ...(values.name ? { name: values.name, password: values.password } : {}) }; try { await api('/api/team', { method: 'POST', body: JSON.stringify(payload) }); await load(); toast('Usuário real adicionado à oficina.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  window.loadTeam = load; window.renderTeam = render; void load();
}

function customers() {
  const page = $('#customers'); const table = $('.table', page); const input = $('.searchbox input', page); let showArchived = false;
  const archiveToggle = document.createElement('button'); archiveToggle.className = 'btn'; archiveToggle.textContent = 'Ver arquivados'; $('.toolbar', page).append(archiveToggle);
  const activeBikeCount = (customer) => customer.bikes.filter((bike) => bike.active).length;
  const customerFields = (customer) => {
    const values = customer || {};
    return [
    { name: 'name', label: 'Nome', required: true }, { name: 'phone', label: 'Telefone', required: true },
    { name: 'email', label: 'E-mail', type: 'email' }, { name: 'cpfCnpj', label: 'CPF/CNPJ' },
    { name: 'postalCode', label: 'CEP' }, { name: 'street', label: 'Rua' }, { name: 'number', label: 'Número' },
    { name: 'complement', label: 'Complemento' }, { name: 'neighborhood', label: 'Bairro' },
    { name: 'city', label: 'Cidade' }, { name: 'state', label: 'UF' },
    { name: 'notes', label: 'Observações', type: 'textarea' },
    ].map((field) => ({ ...field, value: values[field.name] || '' }));
  };
  const customerPayload = (values) => values;
  const bikeFields = (bike = {}) => [
    { name: 'brand', label: 'Marca', required: true }, { name: 'model', label: 'Modelo', required: true },
    { name: 'year', label: 'Ano', type: 'number' }, { name: 'color', label: 'Cor' },
    { name: 'type', label: 'Modalidade', type: 'select', options: [{ label: 'Não definida', value: '' }, ...['MTB', 'ROAD', 'GRAVEL', 'BMX', 'URBAN', 'E_BIKE', 'OTHER']] },
    { name: 'wheelSize', label: 'Aro', placeholder: '29 ou 700C' }, { name: 'frameSize', label: 'Tamanho do quadro' },
    { name: 'serialNumber', label: 'Número de série' }, { name: 'notes', label: 'Observações', type: 'textarea' },
  ].map((field) => ({ ...field, value: bike[field.name] || '' }));
  const bikePayload = (values) => ({ ...values, year: values.year ? Number(values.year) : null, type: values.type || null });
  const renderList = () => {
    $$('.table-row', table).forEach((row) => row.remove());
    customersData.filter((customer) => customer.active !== showArchived).forEach((customer) => {
      const row = document.createElement('div'); row.className = 'table-row clickable'; row.style.gridTemplateColumns = '1.4fr 1fr 100px 130px';
      row.innerHTML = '<div><b></b><div class="item-sub">Abrir cadastro →</div></div><div></div><div></div><div></div>';
      $('b', row).textContent = customer.name; row.children[1].textContent = customer.phone; row.children[2].textContent = activeBikeCount(customer); row.children[3].textContent = customer.lastOrder || '—';
      makeClickable(row, () => openCustomer(customer.id), `Abrir cliente ${customer.name}`); table.append(row);
    });
    if (!$$('.table-row', table).length) { const empty = document.createElement('div'); empty.className = 'table-row'; empty.style.gridTemplateColumns = '1fr'; empty.textContent = showArchived ? 'Nenhum cliente arquivado.' : 'Nenhum cliente cadastrado.'; table.append(empty); }
    input.dispatchEvent(new Event('input'));
  };
  const refreshOptions = () => { const list = $('#customer-options'); if (!list) return; list.innerHTML = ''; customersData.filter((item) => item.active).forEach((item) => { const option = document.createElement('option'); option.value = item.name; option.label = item.phone; list.append(option); }); };
  const showBikeHistory = async (bike) => {
    try {
      const history = await api(`/api/bikes/${bike.id}/history`); const latest = history.workOrders[0];
      const details = latest ? [`Última manutenção: OS #${latest.number}`, new Date(latest.completedAt || latest.createdAt).toLocaleDateString('pt-BR'), ...latest.services.map((item) => item.nameSnapshot), ...latest.parts.map((item) => item.nameSnapshot)].join('\n') : 'Nenhuma manutenção registrada para esta bicicleta.';
      formModal({ title: `Histórico · ${bike.brand} ${bike.model}`, description: details, fields: [], confirm: 'Fechar', action: () => {} });
    } catch (error) { toast(error.message, 'error'); }
  };
  const transferBike = (customer, bike) => formModal({ title: 'Transferir proprietário', description: 'O histórico técnico continuará associado à bicicleta.', fields: [{ name: 'newCustomerId', label: 'Novo proprietário', type: 'select', required: true, options: customersData.filter((item) => item.active && item.id !== customer.id).map((item) => ({ label: `${item.name} · ${item.phone}`, value: item.id })) }, { name: 'reason', label: 'Motivo', type: 'textarea', required: true }], confirm: 'Transferir', action: async ({ newCustomerId, reason }) => { try { const saved = await api(`/api/bikes/${bike.id}/transfer`, { method: 'POST', body: JSON.stringify({ newCustomerId, reason }) }); customer.bikes.splice(customer.bikes.indexOf(bike), 1); const newCustomer = customersData.find((item) => item.id === newCustomerId); newCustomer.bikes.push({ ...saved, wheel: saved.wheelSize }); renderList(); openCustomer(newCustomerId); toast('Proprietário alterado; histórico preservado.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  const editBike = (customer, bike) => formModal({ title: 'Editar bicicleta', fields: bikeFields(bike), action: async (values) => { try { const saved = await api(`/api/bikes/${bike.id}`, { method: 'PATCH', body: JSON.stringify(bikePayload(values)) }); Object.assign(bike, saved, { wheel: saved.wheelSize }); openCustomer(customer.id); toast('Bicicleta atualizada no banco.', 'success'); } catch (error) { toast(error.message, 'error'); return false; } } });
  const openNewBike = (customer, onSaved) => formModal({ title: 'Nova bicicleta', description: `Cliente: ${customer.name}`, fields: bikeFields(), action: async (values) => { try { const saved = await api(`/api/customers/${customer.id}/bikes`, { method: 'POST', body: JSON.stringify(bikePayload(values)) }); const bike = { ...saved, wheel: saved.wheelSize }; customer.bikes.push(bike); renderList(); if (selectedCustomerId === customer.id) openCustomer(customer.id); toast('Bicicleta cadastrada no banco.', 'success'); onSaved?.(bike); } catch (error) { toast(error.message, 'error'); return false; } } });
  const openCustomer = (id) => {
    selectedCustomerId = id; const customer = customersData.find((item) => item.id === id); if (!customer) return;
    const address = [customer.street, customer.number, customer.neighborhood, customer.city, customer.state].filter(Boolean).join(', ');
    $('#customer-name').textContent = customer.name; $('#customer-contact').textContent = [customer.phone, customer.email, customer.cpfCnpj, address].filter(Boolean).join(' · ');
    $('#customer-bike-count').textContent = activeBikeCount(customer); $('#customer-last-order').textContent = customer.lastOrder || '—';
    $('#customer-status').textContent = customer.active ? 'Ativo' : 'Arquivado'; $('#customer-status').style.color = customer.active ? 'var(--success)' : 'var(--destructive)'; $('#customer-status-note').textContent = customer.active ? 'cadastro disponível para novas OS' : 'histórico preservado; novas OS bloqueadas';
    $('#edit-customer').disabled = !customer.active; $('#new-bike').disabled = !customer.active; $('#archive-customer').textContent = customer.active ? 'Arquivar' : 'Reativar';
    const grid = $('#customer-bikes'); grid.innerHTML = '';
    customer.bikes.forEach((bike) => {
      const card = document.createElement('div'); card.className = 'stock-card'; card.innerHTML = '<div class="top"><div><h4></h4><div class="meta"></div></div><span class="pill"></span></div><div class="bottom"><div><div class="item-sub">Identificação</div><b></b></div><div class="actions"></div></div>';
      $('h4', card).textContent = `${bike.brand} ${bike.model}`; $('.meta', card).textContent = [bike.type, bike.year, bike.wheelSize ? `aro ${bike.wheelSize}` : null, bike.frameSize ? `quadro ${bike.frameSize}` : null].filter(Boolean).join(' · ') || 'Dados básicos'; $('.pill', card).textContent = bike.active ? 'Ativa' : 'Arquivada'; $('.pill', card).classList.add(bike.active ? 'green' : 'red'); $('.bottom b', card).textContent = bike.serialNumber || bike.color || 'Sem número de série';
      const actions = $('.actions', card); const history = document.createElement('button'); history.className = 'btn'; history.textContent = 'Histórico'; history.onclick = () => showBikeHistory(bike); actions.append(history);
      if (customer.active && bike.active) { const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = 'Editar'; edit.onclick = () => editBike(customer, bike); const transfer = document.createElement('button'); transfer.className = 'btn'; transfer.textContent = 'Transferir'; transfer.onclick = () => transferBike(customer, bike); const archive = document.createElement('button'); archive.className = 'btn danger'; archive.textContent = 'Arquivar'; archive.onclick = async () => { if (!confirm(`Arquivar ${bike.brand} ${bike.model}?`)) return; try { await api(`/api/bikes/${bike.id}`, { method: 'DELETE' }); bike.active = false; openCustomer(customer.id); renderList(); } catch (error) { toast(error.message, 'error'); } }; actions.append(edit, transfer, archive); }
      else if (customer.active) { const reactivate = document.createElement('button'); reactivate.className = 'btn'; reactivate.textContent = 'Reativar'; reactivate.onclick = async () => { try { Object.assign(bike, await api(`/api/bikes/${bike.id}/reactivate`, { method: 'POST' })); openCustomer(customer.id); renderList(); } catch (error) { toast(error.message, 'error'); } }; actions.append(reactivate); }
      grid.append(card);
    });
    if (!customer.bikes.length) grid.innerHTML = '<div class="card" style="padding:28px;text-align:center;color:var(--muted-foreground)">Nenhuma bicicleta cadastrada.</div>';
    showPage('customer-detail', `customer-detail/${customer.id}`);
  };
  const openCustomerForm = (customer, onSaved) => formModal({ title: customer ? 'Editar cliente' : 'Novo cliente', description: customer ? 'Atualize os dados do cliente.' : 'Cadastre o cliente sem sair do fluxo da oficina.', fields: customerFields(customer), action: async (values) => {
    const payload = customerPayload(values);
    try {
      const duplicates = await api('/api/customers/duplicates', { method: 'POST', body: JSON.stringify({ phone: payload.phone, email: payload.email, cpfCnpj: payload.cpfCnpj, excludeCustomerId: customer?.id }) });
      if (duplicates.length && !confirm(`Já existe cliente semelhante: ${duplicates.map((item) => `${item.name} (${item.phone})${item.active ? '' : ' · arquivado'}`).join(', ')}. Deseja cadastrar mesmo assim?`)) return false;
      const saved = await api(customer ? `/api/customers/${customer.id}` : '/api/customers', { method: customer ? 'PATCH' : 'POST', body: JSON.stringify(payload) });
      if (customer) Object.assign(customer, saved); else customersData.push({ ...saved, lastOrder: '', bikes: saved.bikes || [] });
      renderList(); refreshOptions(); if (customer) openCustomer(customer.id); toast('Cliente salvo no banco.', 'success'); onSaved?.(customer || customersData.at(-1));
    } catch (error) { toast(error.message, 'error'); return false; }
  } });
  input.oninput = () => filter(input, $$('.table-row', table));
  archiveToggle.onclick = () => { showArchived = !showArchived; archiveToggle.textContent = showArchived ? 'Ver ativos' : 'Ver arquivados'; renderList(); };
  findButton('Novo cliente', page).onclick = () => openCustomerForm(null);
  $('#new-bike').onclick = () => { const customer = customersData.find((item) => item.id === selectedCustomerId); if (customer?.active) openNewBike(customer); };
  $('#edit-customer').onclick = () => { const customer = customersData.find((item) => item.id === selectedCustomerId); if (customer?.active) openCustomerForm(customer); };
  $('#archive-customer').onclick = async () => { const customer = customersData.find((item) => item.id === selectedCustomerId); if (!customer) return; try { if (customer.active) { if (!confirm(`Arquivar ${customer.name}? O histórico será preservado.`)) return; await api(`/api/customers/${customer.id}`, { method: 'DELETE' }); customer.active = false; } else { Object.assign(customer, await api(`/api/customers/${customer.id}/reactivate`, { method: 'POST' })); } renderList(); refreshOptions(); openCustomer(customer.id); } catch (error) { toast(error.message, 'error'); } };
  window.openCustomer = openCustomer; window.openNewCustomer = (onSaved) => openCustomerForm(null, onSaved); window.openNewBike = openNewBike; window.renderCustomers = renderList; window.refreshCustomerOptions = refreshOptions;
  renderList();
}

async function hydrateCustomersFromApi() {
  try {
    const remote = await api('/api/customers?active=all');
    customersData = remote.map((customer) => ({ ...customer, lastOrder: '', bikes: customer.bikes.map((bike) => ({ ...bike, wheel: bike.wheelSize })) }));
    saveCustomers(); saveOrders(); window.renderCustomers(); window.refreshCustomerOptions(); window.renderOrders();
    const [page, id] = appHash().split('/');
    if (page === 'customer-detail' && id) window.openCustomer(id);
    toast('Clientes e bicicletas sincronizados com PostgreSQL.', 'success');
  } catch (error) {
    toast(`Não foi possível carregar clientes. ${error.message}`, 'error');
  }
}

async function hydrateIdentityFromApi() {
  try {
    const me = await api('/api/me');
    const activeWorkshopId = me.user.activeWorkshopId;
    const membership = me.memberships.find((item) => item.workshop.id === activeWorkshopId) || me.memberships[0];
    window.currentMembership = { id: membership.id, role: membership.role, userId: me.user.id };
    window.renderTeam?.();
    const roleLabels = { OWNER: 'Proprietário', MANAGER: 'Gerente', ATTENDANT: 'Atendimento', MECHANIC: 'Mecânico', STOCKKEEPER: 'Estoque' };
    const initials = me.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase('pt-BR');
    $('.brand span').textContent = membership.workshop.name;
    $('.user b').textContent = me.user.name;
    $('.user small').textContent = roleLabels[membership.role] || membership.role;
    $('.avatar').textContent = initials;
    const date = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).format(new Date());
    $('#dashboard .page-head p').textContent = `${date} · visão rápida do que exige sua atenção.`;
  } catch (error) {
    toast(`Não foi possível carregar a oficina ativa. ${error.message}`, 'error');
  }
}

async function hydrateCatalogsFromApi() {
  const [partsResult, servicesResult, activeChecklistsResult, archivedChecklistsResult] = await Promise.allSettled([api('/api/catalog-parts?pageSize=100'), api('/api/services?active=all'), api('/api/checklists'), api('/api/checklists?active=false')]);
  if (partsResult.status === 'fulfilled') { const partsLibrary = partsResult.value; catalogPartsData = partsLibrary.items; catalogBrandsData = partsLibrary.brands; catalogCategoriesData = partsLibrary.categories; } else toast(`Não foi possível carregar peças. ${partsResult.reason.message}`, 'error');
  if (servicesResult.status === 'fulfilled') { servicesData = servicesResult.value.map((item) => ({ ...item, price: item.priceCents })); saveServices(); window.renderServices(); } else toast(`Não foi possível carregar serviços. ${servicesResult.reason.message}`, 'error');
  const templates = [...(activeChecklistsResult.status === 'fulfilled' ? activeChecklistsResult.value : []), ...(archivedChecklistsResult.status === 'fulfilled' ? archivedChecklistsResult.value : [])]; checklistsData = templates.map((template) => ({ ...template, items: template.items.map((item) => item.label) })); saveChecklists(); window.renderChecklists();
  if (activeChecklistsResult.status === 'rejected') toast(`Não foi possível carregar checklists ativos. ${activeChecklistsResult.reason.message}`, 'error');
  if (archivedChecklistsResult.status === 'rejected') toast(`Não foi possível carregar checklists arquivados. ${archivedChecklistsResult.reason.message}`, 'error');
}

async function hydrateInventoryFromApi(showSuccess = true) {
  try {
    const params = new URLSearchParams(Object.entries(inventoryFilters).filter(([, value]) => value !== '' && value !== undefined).map(([key, value]) => [key, String(value)]));
    const [remote, remoteMovements, lowStock, mostUsed] = await Promise.all([api(`/api/inventory?${params}`), api('/api/inventory/movements'), api('/api/inventory?status=reorder&sort=stock_asc&page=1&size=3'), api('/api/inventory?sort=usage_desc&page=1&size=3')]);
    inventoryMeta = remote; inventoryData = remote.items.map(mapInventoryItem); inventoryInsights = { lowItems: lowStock.items.map(mapInventoryItem), usedItems: mostUsed.items.map(mapInventoryItem) };
    window.refreshInventoryFilters?.();
    movementsData = remoteMovements.map((movement) => ({ id: movement.id, inventoryId: movement.inventoryItemId, item: movement.inventoryItem ? mapInventoryItem(movement.inventoryItem) : null, type: movement.type, delta: Number(movement.quantityDelta), reasonCode: movement.manualExitReason, reason: movement.reason, document: movement.purchaseDocument, origin: movement.originDestination, user: movement.createdBy?.name, orderId: movement.workOrder?.number, createdAt: movement.createdAt }));
    saveInventory(); window.renderInventory();
    if (showSuccess) toast('Estoque e ledger sincronizados com PostgreSQL.', 'success');
  } catch (error) {
    toast(`Não foi possível carregar estoque. ${error.message}`, 'error');
  }
}

async function hydrateWorkOrdersFromApi() {
  try {
    const remote = await api('/api/work-orders'); ordersData = remote.items.map(mapWorkOrder); saveOrders(); window.renderOrders(); window.renderInventory();
    const [page, id] = appHash().split('/');
    if (page === 'order-detail' && id) { const order = ordersData.find((item) => item.id === id); if (order) { selectedOrderId = id; renderOrderDetail(); showPage('order-detail', appHash(), true); } else { showPage('orders', 'orders', true); toast('A ordem informada no link não foi encontrada.', 'error'); } }
    toast('Ordens de serviço sincronizadas com PostgreSQL.', 'success');
  } catch (error) { toast(`Não foi possível carregar ordens. ${error.message}`, 'error'); }
}

function utilities() {
  const [help, settings] = $$('.top-actions .icon-btn');
  help.onclick = () => formModal({ title: 'Ajuda rápida', description: 'Use Ctrl+K para buscar. Navegue pelo menu e use Nova OS para registrar uma bicicleta.', fields: [], confirm: 'Entendi', action: () => {} });
  settings.onclick = () => formModal({ title: 'Preferências', fields: [{ name: 'theme', label: 'Tema', type: 'select', options: ['Claro', 'Escuro'] }], action: ({ theme }) => { document.documentElement.classList.toggle('dark', theme === 'Escuro'); localStorage.setItem('bikeflow-theme', theme); toast(`Tema ${theme.toLowerCase()} aplicado.`, 'success'); } });
  document.documentElement.classList.toggle('dark', localStorage.getItem('bikeflow-theme') !== 'Claro');
  $$('.modal-wrap').forEach((modal) => modal.onclick = (event) => { if (event.target === modal) closeModal(modal.id); });
}

navigation(); globalSearch(); orders(); newOrder(); orderDetail(); inventory(); catalog(); services(); checklists(); customers(); team(); utilities();
(async () => {
  await hydrateIdentityFromApi();
  await hydrateCustomersFromApi();
  await hydrateCatalogsFromApi();
  await hydrateInventoryFromApi();
  await hydrateWorkOrdersFromApi();
  const status = $('#app-status');
  if (hydrationFailed) {
    status.textContent = 'BikeFlow indisponível. Entre pelo sistema e verifique a conexão com o servidor.';
    status.setAttribute('role', 'alert');
    return;
  }
  status.remove();
  document.body.classList.remove('app-loading');
})();
