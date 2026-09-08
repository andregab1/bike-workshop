(function inventoryUiModule() {
  const physicalMovementTypes = new Set(['STOCK_ENTRY', 'WORK_ORDER_USE', 'WORK_ORDER_REVERSAL', 'MANUAL_ADJUSTMENT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'MANUAL_EXIT']);
  const quantity = (value) => Number(value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

  function stockState(item) {
    if (item.available <= 0) return { key: 'zero', label: 'Sem estoque' };
    if (item.available <= item.minimum) return { key: 'low', label: 'Baixo' };
    return { key: 'normal', label: 'Normal' };
  }

  function createInventoryCard(item, options) {
    const state = stockState(item);
    const card = document.createElement('article');
    card.className = `inventory-product-card ${state.key}`;
    card.innerHTML = `
      <header class="inventory-card-head">
        <div><h3></h3><p class="inventory-card-sku"></p></div>
        <span class="inventory-status-badge"></span>
      </header>
      <p class="inventory-card-meta"></p>
      <p class="inventory-card-location"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 21s6-5.3 6-11a6 6 0 1 0-12 0c0 5.7 6 11 6 11Z"/><circle cx="12" cy="10" r="2"/></svg><span></span></p>
      <div class="inventory-card-values">
        <div><span>Disponível</span><strong class="available"></strong><small></small></div>
        <div><span>Venda</span><strong class="sale"></strong></div>
      </div>
      <footer class="inventory-card-actions">
        <button class="inventory-action exit" type="button">− Usar peça</button>
        <button class="inventory-action entry" type="button">+ Entrada</button>
        <button class="inventory-action details" type="button">Detalhes</button>
      </footer>`;
    card.querySelector('h3').textContent = item.shortName || item.name;
    const sku = card.querySelector('.inventory-card-sku');
    sku.textContent = item.sku || '';
    sku.hidden = !item.sku;
    card.querySelector('.inventory-card-meta').textContent = [item.brand || 'Sem marca', item.category].filter(Boolean).join(' · ');
    card.querySelector('.inventory-card-location span').textContent = item.location || 'Local não informado';
    const badge = card.querySelector('.inventory-status-badge');
    badge.textContent = state.label;
    badge.classList.add(state.key);
    card.querySelector('.available').textContent = quantity(item.available);
    card.querySelector('.inventory-card-values small').textContent = item.unit === 'un' ? 'unidades' : item.unit;
    card.querySelector('.sale').textContent = options.money(item.price);
    const exitButton = card.querySelector('.exit');
    exitButton.disabled = item.available <= 0;
    exitButton.title = item.available <= 0 ? 'Sem saldo disponível para saída' : 'Registrar saída desta peça';
    exitButton.onclick = () => options.onMovement(item, 'exit');
    card.querySelector('.entry').onclick = () => options.onMovement(item, 'entry');
    card.querySelector('.details').onclick = () => options.onDetails(item);
    return card;
  }

  function renderCards(root, items, options) {
    root.innerHTML = '';
    items.forEach((item) => root.append(createInventoryCard(item, options)));
    if (!items.length) root.innerHTML = '<div class="inventory-empty">Nenhuma peça encontrada com estes filtros.</div>';
  }

  function renderSummary(page, summary, money) {
    page.querySelectorAll('[data-stock-summary]').forEach((element) => {
      const key = element.dataset.stockSummary;
      const value = summary[key] ?? 0;
      element.textContent = key === 'totalCostCents' ? money(value) : Number(value).toLocaleString('pt-BR');
    });
  }

  function movementWhen(value) {
    const date = new Date(value);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const movementDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const days = Math.round((today.getTime() - movementDay.getTime()) / 86_400_000);
    const day = days === 0 ? 'Hoje' : days === 1 ? 'Ontem' : date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${day} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  }

  function renderPanels(page, data) {
    const lowList = page.querySelector('[data-low-stock-list]');
    lowList.innerHTML = '<div class="inventory-panel-table-head"><span>Peça</span><span>Disponível</span><span>Mínimo</span></div>';
    data.lowItems.forEach((item) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'inventory-low-row';
      row.innerHTML = '<span></span><strong></strong><b></b>';
      row.children[0].textContent = item.shortName || item.name;
      row.children[1].textContent = quantity(item.available);
      row.children[1].className = item.available <= 0 ? 'critical' : 'warning';
      row.children[2].textContent = quantity(item.minimum);
      row.onclick = () => data.onDetails(item);
      lowList.append(row);
    });
    if (!data.lowItems.length) lowList.innerHTML = '<p class="inventory-panel-empty">Nenhuma peça precisa de reposição.</p>';
    page.querySelector('[data-reorder-count]').textContent = `(${Number(data.summary.reorder || 0).toLocaleString('pt-BR')})`;

    const usedList = page.querySelector('[data-most-used-list]');
    usedList.innerHTML = '';
    data.usedItems.filter((item) => item.usageCount > 0).forEach((item, index) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'inventory-used-row';
      row.innerHTML = '<span class="rank"></span><span class="name"></span><strong></strong>';
      row.querySelector('.rank').textContent = String(index + 1);
      row.querySelector('.name').textContent = item.shortName || item.name;
      row.querySelector('strong').textContent = `${quantity(item.usageCount)} ${item.usageCount === 1 ? 'saída' : 'saídas'}`;
      row.onclick = () => data.onDetails(item);
      usedList.append(row);
    });
    if (!usedList.children.length) usedList.innerHTML = '<p class="inventory-panel-empty">Ainda não há saídas registradas.</p>';

    const recentList = page.querySelector('[data-recent-movements]');
    recentList.innerHTML = '';
    data.movements.filter((movement) => physicalMovementTypes.has(movement.type)).slice(0, 3).forEach((movement) => {
      const incoming = movement.delta > 0;
      const row = document.createElement('div');
      row.className = 'inventory-movement-row';
      row.innerHTML = '<span class="movement-direction"></span><div><strong></strong><p></p></div><div class="movement-context"><time></time><small></small></div>';
      const direction = row.querySelector('.movement-direction');
      direction.textContent = incoming ? '↑' : '↓';
      direction.classList.add(incoming ? 'in' : 'out');
      row.querySelector('strong').textContent = `${incoming ? 'Entrada' : 'Saída'} ${quantity(Math.abs(movement.delta))} ${movement.item?.unit || 'un'}.`;
      row.querySelector('p').textContent = movement.item?.shortName || movement.item?.name || 'Item arquivado';
      row.querySelector('time').textContent = movementWhen(movement.createdAt);
      row.querySelector('small').textContent = movement.orderId ? `OS #${movement.orderId}` : (movement.document || movement.origin || '');
      recentList.append(row);
    });
    if (!recentList.children.length) recentList.innerHTML = '<p class="inventory-panel-empty">Nenhuma movimentação registrada.</p>';
  }

  function paginationItems(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    const values = new Set([1, total, current - 1, current, current + 1].filter((value) => value >= 1 && value <= total));
    const sorted = [...values].sort((a, b) => a - b);
    const result = [];
    sorted.forEach((value, index) => {
      if (index && value - sorted[index - 1] > 1) result.push('ellipsis');
      result.push(value);
    });
    return result;
  }

  function renderPagination(page, meta, onPage) {
    const range = page.querySelector('[data-inventory-range]');
    const start = meta.total ? (meta.page - 1) * meta.size + 1 : 0;
    const end = Math.min(meta.total, start + meta.itemsLength - 1);
    range.textContent = `Mostrando ${start} a ${Math.max(end, 0)} de ${meta.total.toLocaleString('pt-BR')} peças`;
    const nav = page.querySelector('.inventory-pagination');
    nav.innerHTML = '';
    if (meta.pageCount <= 1) return;
    const makeButton = (label, target, disabled, ariaLabel) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.disabled = disabled;
      button.setAttribute('aria-label', ariaLabel);
      button.onclick = () => onPage(target);
      return button;
    };
    nav.append(makeButton('‹', meta.page - 1, meta.page <= 1, 'Página anterior'));
    paginationItems(meta.page, meta.pageCount).forEach((item) => {
      if (item === 'ellipsis') {
        const span = document.createElement('span');
        span.textContent = '…';
        nav.append(span);
        return;
      }
      const button = makeButton(String(item), item, false, `Página ${item}`);
      if (item === meta.page) { button.classList.add('active'); button.setAttribute('aria-current', 'page'); }
      nav.append(button);
    });
    nav.append(makeButton('›', meta.page + 1, meta.page >= meta.pageCount, 'Próxima página'));
  }

  window.InventoryUI = { renderCards, renderSummary, renderPanels, renderPagination, stockState };
})();
