/* ==========================================================
   Roast & Origin — application logic (Vanilla JS, no build step)
   Sections:
     1. Config & state
     2. Helpers
     3. Persistence (localStorage)
     4. Taste profile + grind selector renderers
     5. Catalog (filters, search, render)
     6. Product modal
     7. Cart (state, drawer, shipping progress)
     8. Subscription wizard
     9. Global events & init
   ========================================================== */
(() => {
  'use strict';

  /* ---------- 1. Config & state ---------- */
  const FREE_SHIPPING_THRESHOLD = 40;
  const FLAT_SHIPPING = 5.95;
  const STORAGE_KEYS = {
    cart: 'roast-origin:cart:v1',
    subscription: 'roast-origin:subscription:v1'
  };
  const GRINDS = ['Whole Bean', 'Espresso', 'Pour Over', 'French Press', 'Drip'];
  const DEFAULT_GRIND = GRINDS[0];
  const TASTE_DIMENSIONS = [
    { key: 'acidity',    label: 'Acidity' },
    { key: 'body',       label: 'Body' },
    { key: 'roast',      label: 'Roast' },
    { key: 'bitterness', label: 'Bitterness' }
  ];

  const state = {
    products: Array.isArray(window.PRODUCTS) ? window.PRODUCTS : [],
    cart: [],                       // [{ id, grind, qty }]
    grinds: {},                     // { [productId]: selected grind }
    filters: { origin: 'all', process: 'all', query: '', sort: 'featured' },
    modal: { productId: null, qty: 1 },
    wizard: null
  };

  /* ---------- 2. Helpers ---------- */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = (n) => `$${n.toFixed(2)}`;
  const escapeHtml = (str) =>
    String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const getProduct = (id) => state.products.find((p) => p.id === id);
  const getGrind = (id) => state.grinds[id] || DEFAULT_GRIND;
  const cartKey = (id, grind) => `${id}|${grind}`;
  const debounce = (fn, ms = 180) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function syncBodyScroll() {
    const anyOpen = $('.drawer-root.is-open') || $('.modal.is-open');
    document.body.classList.toggle('no-scroll', Boolean(anyOpen));
  }

  function setOpen(el, open) {
    el.classList.toggle('is-open', open);
    el.setAttribute('aria-hidden', String(!open));
    syncBodyScroll();
  }

  /* ---------- 3. Persistence ---------- */
  function saveCart() {
    try { localStorage.setItem(STORAGE_KEYS.cart, JSON.stringify(state.cart)); }
    catch (err) { console.warn('Could not save cart:', err); }
  }

  function loadCart() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.cart);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Validate: drop unknown products / bad data
      return parsed
        .filter((i) => i && getProduct(i.id) && GRINDS.includes(i.grind) && Number.isInteger(i.qty) && i.qty > 0)
        .map((i) => ({ id: i.id, grind: i.grind, qty: Math.min(i.qty, 99) }));
    } catch (err) {
      console.warn('Could not load cart:', err);
      return [];
    }
  }

  /* ---------- 4. Taste profile + grind selector renderers ---------- */
  function tasteHTML(taste, large = false) {
    const rows = TASTE_DIMENSIONS.map(({ key, label }) => {
      const value = Math.max(0, Math.min(5, taste[key] || 0));
      const segs = Array.from({ length: 5 }, (_, i) => `<span class="seg ${i < value ? 'on' : ''}"></span>`).join('');
      return `
        <div class="taste-row" role="img" aria-label="${label}: ${value} out of 5">
          <span class="taste-label">${label}</span>
          <div class="segments">${segs}</div>
        </div>`;
    }).join('');
    return `<div class="taste ${large ? 'lg' : ''}">${rows}</div>`;
  }

  function flavorPillsHTML(flavors) {
    return flavors.map((f) => `<span class="pill">${escapeHtml(f)}</span>`).join('');
  }

  function grindSelectorHTML(productId) {
    const selected = getGrind(productId);
    const buttons = GRINDS.map((g) => `
      <button type="button" class="grind-btn ${g === selected ? 'is-active' : ''}"
              data-action="select-grind" data-grind="${escapeHtml(g)}" aria-pressed="${g === selected}">
        ${escapeHtml(g)}
      </button>`).join('');
    return `
      <p class="grind-title">Grind</p>
      <div class="grind-options" role="group" aria-label="Grind size">${buttons}</div>`;
  }

  // Update every grind selector for a product (card + modal) without re-rendering
  function updateGrindUI(productId) {
    const selected = getGrind(productId);
    $$(`[data-product-id="${productId}"] .grind-btn`).forEach((btn) => {
      const active = btn.dataset.grind === selected;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  /* ---------- 5. Catalog ---------- */
  function buildFilterChips() {
    const unique = (key) => [...new Set(state.products.map((p) => p[key]))].sort();
    const make = (container, type, values) => {
      const chips = ['all', ...values].map((v) => `
        <button type="button" class="chip" data-action="set-filter" data-type="${type}" data-value="${escapeHtml(v)}">
          ${v === 'all' ? 'All' : escapeHtml(v)}
        </button>`).join('');
      container.insertAdjacentHTML('beforeend', chips);
    };
    make($('#origin-filters'), 'origin', unique('origin'));
    make($('#process-filters'), 'process', unique('process'));
    updateChipStates();
  }

  function updateChipStates() {
    $$('[data-action="set-filter"]').forEach((chip) => {
      const active = state.filters[chip.dataset.type] === chip.dataset.value;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  function getFilteredProducts() {
    const { origin, process, query, sort } = state.filters;
    const q = query.trim().toLowerCase();

    let list = state.products.filter((p) => {
      if (origin !== 'all' && p.origin !== origin) return false;
      if (process !== 'all' && p.process !== process) return false;
      if (!q) return true;
      const haystack = [p.name, p.origin, p.region, p.process, p.variety, p.notes, ...p.flavors]
        .join(' ').toLowerCase();
      return q.split(/\s+/).every((word) => haystack.includes(word));
    });

    if (sort === 'price-asc')  list = [...list].sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
    if (sort === 'name')       list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }

  function renderProducts() {
    const grid = $('#product-grid');
    const tpl = $('#tpl-product-card');
    const list = getFilteredProducts();

    grid.replaceChildren();
    list.forEach((p, index) => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.productId = p.id;
      node.style.animationDelay = `${Math.min(index, 8) * 50}ms`;

      const visual = $('.card-visual', node);
      visual.dataset.origin = p.origin;
      visual.setAttribute('aria-label', `View details for ${p.name}`);
      $('.badge', node).textContent = p.badge || '';
      $('.bag-label', node).innerHTML = `${escapeHtml(p.origin)}<br>${escapeHtml(p.name.split(' ')[0])}`;

      $('.card-origin', node).textContent = `${p.origin} · ${p.process}`;
      $('.card-name', node).textContent = p.name;
      $('.card-notes', node).textContent = p.notes;
      $('.card-taste', node).innerHTML = tasteHTML(p.taste);
      $('.card-flavors', node).innerHTML = flavorPillsHTML(p.flavors);
      $('.card-grinds', node).innerHTML = grindSelectorHTML(p.id);
      $('.card-price', node).textContent = money(p.price);
      grid.appendChild(node);
    });

    $('#empty-state').hidden = list.length > 0;
    $('#result-count').textContent =
      `${list.length} ${list.length === 1 ? 'coffee' : 'coffees'}${list.length !== state.products.length ? ` of ${state.products.length}` : ''}`;
  }

  function setFilter(type, value) {
    state.filters[type] = value;
    updateChipStates();
    renderProducts();
  }

  function resetFilters() {
    state.filters = { origin: 'all', process: 'all', query: '', sort: 'featured' };
    $('#search-input').value = '';
    $('#sort-select').value = 'featured';
    updateChipStates();
    renderProducts();
  }

  /* ---------- 6. Product modal ---------- */
  function openProductModal(productId) {
    const p = getProduct(productId);
    if (!p) return;
    state.modal = { productId, qty: 1 };

    $('#product-modal-body').innerHTML = `
      <div data-product-id="${p.id}">
        <div class="modal-hero bean-art" data-origin="${escapeHtml(p.origin)}">
          <span class="bag" aria-hidden="true">
            <span class="bag-label">${escapeHtml(p.origin)}<br>${escapeHtml(p.name.split(' ')[0])}</span>
          </span>
        </div>
        <div class="grid gap-8 p-6 sm:p-8 md:grid-cols-2">
          <div>
            <p class="eyebrow">${escapeHtml(p.origin)} · ${escapeHtml(p.process)}</p>
            <h3 class="font-display mt-1 text-3xl font-bold leading-tight">${escapeHtml(p.name)}</h3>
            <p class="mt-3 text-ink/70">${escapeHtml(p.notes)}</p>
            <dl class="stat-grid mt-5">
              <div class="stat"><dt>Region</dt><dd>${escapeHtml(p.region)}</dd></div>
              <div class="stat"><dt>Altitude</dt><dd>${escapeHtml(p.altitude)}</dd></div>
              <div class="stat"><dt>Variety</dt><dd>${escapeHtml(p.variety)}</dd></div>
              <div class="stat"><dt>Roast</dt><dd>${escapeHtml(p.roastLabel)}</dd></div>
            </dl>
          </div>
          <div>
            <h4 class="grind-title">Taste profile</h4>
            ${tasteHTML(p.taste, true)}
            <div class="mt-4 flex flex-wrap gap-1.5">${flavorPillsHTML(p.flavors)}</div>
            <div class="mt-6">${grindSelectorHTML(p.id)}</div>
            <div class="mt-6 flex items-center gap-3">
              <div class="qty">
                <button data-action="modal-qty-dec" aria-label="Decrease quantity">−</button>
                <span id="modal-qty" aria-live="polite">1</span>
                <button data-action="modal-qty-inc" aria-label="Increase quantity">+</button>
              </div>
              <button class="btn btn-primary btn-lg flex-1" data-action="add-to-cart" data-from-modal="true">
                Add to cart · <span id="modal-total">${money(p.price)}</span>
              </button>
            </div>
          </div>
        </div>
      </div>`;
    setOpen($('#product-modal'), true);
  }

  function changeModalQty(delta) {
    const p = getProduct(state.modal.productId);
    if (!p) return;
    state.modal.qty = Math.max(1, Math.min(20, state.modal.qty + delta));
    $('#modal-qty').textContent = state.modal.qty;
    $('#modal-total').textContent = money(p.price * state.modal.qty);
  }

  /* ---------- 7. Cart ---------- */
  function addToCart(productId, grind, qty = 1) {
    const key = cartKey(productId, grind);
    const existing = state.cart.find((i) => cartKey(i.id, i.grind) === key);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else state.cart.push({ id: productId, grind, qty });
    saveCart();
    renderCart();
    bumpCartCount();
  }

  function changeQty(key, delta) {
    const item = state.cart.find((i) => cartKey(i.id, i.grind) === key);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) return removeItem(key);
    item.qty = Math.min(99, item.qty);
    saveCart();
    renderCart();
  }

  function removeItem(key) {
    state.cart = state.cart.filter((i) => cartKey(i.id, i.grind) !== key);
    saveCart();
    renderCart();
  }

  function clearCart() {
    state.cart = [];
    saveCart();
    renderCart();
  }

  function cartTotals() {
    const subtotal = state.cart.reduce((sum, i) => sum + getProduct(i.id).price * i.qty, 0);
    const count = state.cart.reduce((sum, i) => sum + i.qty, 0);
    const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
    const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);
    const shipping = count === 0 ? 0 : remaining === 0 ? 0 : FLAT_SHIPPING;
    return { subtotal, count, remaining, progress, shipping };
  }

  function renderCart() {
    const container = $('#cart-items');
    const tpl = $('#tpl-cart-item');
    const { subtotal, count, remaining, progress, shipping } = cartTotals();

    container.replaceChildren();
    state.cart.forEach((item) => {
      const p = getProduct(item.id);
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.key = cartKey(item.id, item.grind);
      $('.cart-thumb', node).dataset.origin = p.origin;
      $('.ci-name', node).textContent = p.name;
      $('.ci-grind', node).textContent = `${p.origin} · 12 oz · ${item.grind}`;
      $('.ci-line', node).textContent = money(p.price * item.qty);
      $('.ci-qty', node).textContent = item.qty;
      container.appendChild(node);
    });

    const isEmpty = count === 0;
    container.hidden = isEmpty;
    $('#cart-empty').hidden = !isEmpty;
    $('#cart-footer').hidden = isEmpty;

    // Header badge
    const badge = $('#cart-count');
    badge.textContent = count;
    badge.hidden = isEmpty;

    // Totals
    $('#cart-subtotal').textContent = money(subtotal);
    $('#cart-shipping').textContent = isEmpty ? '—' : shipping === 0 ? 'Free' : money(shipping);

    // Free shipping progress
    const fill = $('#shipping-progress-fill');
    fill.style.width = `${progress}%`;
    fill.classList.toggle('done', remaining === 0 && !isEmpty);
    $('#shipping-progressbar').setAttribute('aria-valuenow', Math.round(progress));
    $('#shipping-message').textContent =
      isEmpty ? `Free shipping on orders over ${money(FREE_SHIPPING_THRESHOLD)}`
      : remaining === 0 ? '🎉 You’ve unlocked free shipping!'
      : `You’re ${money(remaining)} away from free shipping`;
  }

  function bumpCartCount() {
    const badge = $('#cart-count');
    badge.classList.remove('bump');
    void badge.offsetWidth; // restart animation
    badge.classList.add('bump');
  }

  const openCart  = () => setOpen($('#cart-root'), true);
  const closeCart = () => setOpen($('#cart-root'), false);

  /* ---------- 8. Subscription wizard ---------- */
  const SURPRISE_PRICE = 17.5;
  const SIZES = [
    { id: '12oz', label: '12 oz bag',      desc: 'Standard retail bag (340 g)',     mult: 1 },
    { id: '2lb',  label: '2 lb bulk bag',  desc: 'About 2.7× the coffee — best value', mult: 2.2, tag: 'Best value' }
  ];
  const FREQUENCIES = [
    { id: 'weekly',   label: 'Every week',    desc: 'For heavy drinkers & households', discount: 0.15, perMonth: 52 / 12 },
    { id: 'biweekly', label: 'Every 2 weeks', desc: 'Our most popular cadence',        discount: 0.10, perMonth: 26 / 12, tag: 'Popular' },
    { id: 'monthly',  label: 'Every month',   desc: 'A fresh bag to start each month', discount: 0.05, perMonth: 1 }
  ];
  const WIZARD_STEPS = [
    { id: 'coffee',    title: 'Choose your coffee' },
    { id: 'grind',     title: 'How do you brew?' },
    { id: 'size',      title: 'Pick a size & quantity' },
    { id: 'frequency', title: 'How often?' },
    { id: 'review',    title: 'Review your plan' }
  ];

  const defaultWizard = () => ({
    step: 0, done: false,
    productId: state.products[0]?.id || 'surprise',
    grind: DEFAULT_GRIND, size: '12oz', bags: 1, frequency: 'biweekly'
  });

  function calcSubscription(w) {
    const product = w.productId === 'surprise' ? null : getProduct(w.productId);
    const size = SIZES.find((s) => s.id === w.size);
    const freq = FREQUENCIES.find((f) => f.id === w.frequency);
    const unit = (product ? product.price : SURPRISE_PRICE) * size.mult;
    const gross = unit * w.bags;
    const discount = gross * freq.discount;
    const subtotal = gross - discount;
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const perDelivery = subtotal + shipping;
    const monthly = perDelivery * freq.perMonth;
    return { product, size, freq, unit, gross, discount, subtotal, shipping, perDelivery, monthly };
  }

  function openWizard() {
    state.wizard = defaultWizard();
    renderWizard();
    setOpen($('#wizard-modal'), true);
  }

  function optionHTML({ field, value, title, desc, selected, tag }) {
    return `
      <button type="button" class="opt ${selected ? 'is-selected' : ''}" data-action="wizard-pick"
              data-field="${field}" data-value="${escapeHtml(value)}" aria-pressed="${selected}">
        <span class="opt-title"><span>${escapeHtml(title)}</span>${tag ? `<span class="opt-tag">${escapeHtml(tag)}</span>` : ''}</span>
        ${desc ? `<span class="opt-desc block">${escapeHtml(desc)}</span>` : ''}
      </button>`;
  }

  function renderWizard() {
    const w = state.wizard;
    const body = $('#wizard-body');
    const footer = $('#wizard-footer');
    const stepDef = WIZARD_STEPS[w.step];

    // Success screen
    if (w.done) {
      const c = calcSubscription(w);
      $('#wizard-title').textContent = 'You’re all set!';
      $('#wizard-progress').innerHTML = WIZARD_STEPS.map(() => '<span class="on"></span>').join('');
      body.innerHTML = `
        <div class="wizard-step py-6 text-center">
          <div class="text-5xl" aria-hidden="true">🎉</div>
          <p class="font-display mt-4 text-2xl font-bold">Subscription saved</p>
          <p class="mx-auto mt-2 max-w-sm text-ink/70">
            ${w.bags} × ${escapeHtml(c.size.label)} of ${escapeHtml(c.product ? c.product.name : 'our Roaster’s Choice')},
            ${escapeHtml(c.freq.label.toLowerCase())}, for ${money(c.perDelivery)} per delivery.
          </p>
          <p class="mt-4 text-xs text-ink/50">Demo only — your plan is stored in this browser’s localStorage.</p>
        </div>`;
      footer.innerHTML = `<span></span><button class="btn btn-primary" data-action="close-modal">Done</button>`;
      return;
    }

    $('#wizard-title').textContent = stepDef.title;
    $('#wizard-progress').innerHTML = WIZARD_STEPS.map((_, i) => `<span class="${i <= w.step ? 'on' : ''}"></span>`).join('');

    let html = '';
    switch (stepDef.id) {
      case 'coffee':
        html = `<div class="opt-grid cols-2">
          ${state.products.map((p) => optionHTML({
            field: 'productId', value: p.id, title: p.name,
            desc: `${p.origin} · ${p.process} · ${money(p.price)}`, selected: w.productId === p.id
          })).join('')}
          ${optionHTML({ field: 'productId', value: 'surprise', title: 'Roaster’s Choice',
            desc: `We pick a seasonal coffee for you · ${money(SURPRISE_PRICE)}`, selected: w.productId === 'surprise', tag: 'Surprise me' })}
        </div>`;
        break;

      case 'grind':
        html = `<div class="opt-grid cols-2">
          ${GRINDS.map((g) => optionHTML({
            field: 'grind', value: g, title: g,
            desc: ({ 'Whole Bean': 'Grind at home for max freshness', 'Espresso': 'Fine — espresso machines',
              'Pour Over': 'Medium-fine — V60, Chemex', 'French Press': 'Coarse — press & cold brew',
              'Drip': 'Medium — automatic drip machines' })[g],
            selected: w.grind === g
          })).join('')}
        </div>`;
        break;

      case 'size':
        html = `
          <div class="opt-grid cols-2">
            ${SIZES.map((s) => optionHTML({ field: 'size', value: s.id, title: s.label, desc: s.desc, selected: w.size === s.id, tag: s.tag })).join('')}
          </div>
          <div class="mt-6 flex items-center justify-between rounded-2xl bg-white p-4" style="border:1px solid rgba(42,29,21,.08)">
            <div>
              <p class="font-semibold">Bags per delivery</p>
              <p class="text-xs text-ink/60">Up to 4 bags each time</p>
            </div>
            <div class="qty">
              <button data-action="wizard-bags" data-delta="-1" aria-label="Fewer bags">−</button>
              <span aria-live="polite">${w.bags}</span>
              <button data-action="wizard-bags" data-delta="1" aria-label="More bags">+</button>
            </div>
          </div>`;
        break;

      case 'frequency':
        html = `<div class="opt-grid">
          ${FREQUENCIES.map((f) => optionHTML({
            field: 'frequency', value: f.id, title: `${f.label} — save ${Math.round(f.discount * 100)}%`,
            desc: f.desc, selected: w.frequency === f.id, tag: f.tag
          })).join('')}
        </div>`;
        break;

      case 'review': {
        const c = calcSubscription(w);
        html = `
          <div class="summary">
            <div class="summary-row"><span class="muted">Coffee</span><strong>${escapeHtml(c.product ? c.product.name : 'Roaster’s Choice')}</strong></div>
            <div class="summary-row"><span class="muted">Grind</span><strong>${escapeHtml(w.grind)}</strong></div>
            <div class="summary-row"><span class="muted">Size</span><strong>${w.bags} × ${escapeHtml(c.size.label)}</strong></div>
            <div class="summary-row"><span class="muted">Frequency</span><strong>${escapeHtml(c.freq.label)}</strong></div>
            <div class="summary-row"><span class="muted">Price (${money(c.unit)} × ${w.bags})</span><span>${money(c.gross)}</span></div>
            <div class="summary-row"><span class="muted">Subscriber discount (${Math.round(c.freq.discount * 100)}%)</span><span class="save">−${money(c.discount)}</span></div>
            <div class="summary-row"><span class="muted">Shipping</span><span>${c.shipping === 0 ? 'Free' : money(c.shipping)}</span></div>
            <div class="summary-row total"><span>Per delivery</span><span>${money(c.perDelivery)}</span></div>
            <p class="mt-2 text-right text-xs text-ink/55">≈ ${money(c.monthly)} / month</p>
          </div>`;
        break;
      }
    }
    body.innerHTML = `<div class="wizard-step">${html}</div>`;

    // Footer: running price + navigation
    const c = calcSubscription(w);
    const last = w.step === WIZARD_STEPS.length - 1;
    footer.innerHTML = `
      <div class="text-sm">
        <span class="text-ink/55">Per delivery</span>
        <strong class="ml-1 text-base">${money(c.perDelivery)}</strong>
      </div>
      <div class="flex gap-2">
        ${w.step > 0 ? '<button class="btn btn-ghost" data-action="wizard-back">Back</button>' : ''}
        <button class="btn btn-primary" data-action="${last ? 'wizard-finish' : 'wizard-next'}">
          ${last ? 'Start subscription' : 'Continue'}
        </button>
      </div>`;
  }

  function wizardPick(field, value) {
    state.wizard[field] = value;
    renderWizard();
  }

  function wizardFinish() {
    const w = state.wizard;
    const c = calcSubscription(w);
    try {
      localStorage.setItem(STORAGE_KEYS.subscription, JSON.stringify({
        productId: w.productId, grind: w.grind, size: w.size, bags: w.bags,
        frequency: w.frequency, perDelivery: +c.perDelivery.toFixed(2), createdAt: new Date().toISOString()
      }));
    } catch (err) { console.warn('Could not save subscription:', err); }
    w.done = true;
    renderWizard();
  }

  /* ---------- 9. Global events & init ---------- */
  function handleAction(el, event) {
    const action = el.dataset.action;
    const scope = el.closest('[data-product-id]');
    const productId = scope?.dataset.productId;
    const cartItemKey = el.closest('[data-key]')?.dataset.key;

    switch (action) {
      // Catalog
      case 'set-filter':    return setFilter(el.dataset.type, el.dataset.value);
      case 'reset-filters': return resetFilters();
      case 'open-product':  return openProductModal(productId);

      // Grind selector (cards + modal)
      case 'select-grind':
        state.grinds[productId] = el.dataset.grind;
        return updateGrindUI(productId);

      // Add to cart (cards + modal)
      case 'add-to-cart': {
        const p = getProduct(productId);
        if (!p) return;
        const qty = el.dataset.fromModal ? state.modal.qty : 1;
        const grind = getGrind(productId);
        addToCart(productId, grind, qty);
        toast(`Added ${qty} × ${p.name} (${grind})`);
        el.classList.add('is-added');
        const original = el.innerHTML;
        if (!el.dataset.fromModal) el.textContent = 'Added ✓';
        setTimeout(() => { el.classList.remove('is-added'); if (!el.dataset.fromModal) el.innerHTML = original; }, 1100);
        return;
      }

      // Product modal quantity
      case 'modal-qty-inc': return changeModalQty(1);
      case 'modal-qty-dec': return changeModalQty(-1);

      // Cart
      case 'open-cart':  return openCart();
      case 'close-cart': return closeCart();
      case 'qty-inc':    return changeQty(cartItemKey, 1);
      case 'qty-dec':    return changeQty(cartItemKey, -1);
      case 'remove-item':return removeItem(cartItemKey);
      case 'clear-cart': return clearCart();
      case 'checkout':
        toast('Demo store — checkout isn’t connected 🙂');
        return;

      // Modals
      case 'close-modal': {
        const modal = el.closest('.modal');
        if (modal) setOpen(modal, false);
        return;
      }

      // Wizard
      case 'open-wizard':   return openWizard();
      case 'wizard-pick':   return wizardPick(el.dataset.field, el.dataset.value);
      case 'wizard-next':   state.wizard.step = Math.min(state.wizard.step + 1, WIZARD_STEPS.length - 1); return renderWizard();
      case 'wizard-back':   state.wizard.step = Math.max(state.wizard.step - 1, 0); return renderWizard();
      case 'wizard-bags':
        state.wizard.bags = Math.max(1, Math.min(4, state.wizard.bags + Number(el.dataset.delta)));
        return renderWizard();
      case 'wizard-finish': return wizardFinish();
    }
  }

  function bindEvents() {
    document.addEventListener('click', (e) => {
      const el = e.target.closest('[data-action]');
      if (el) handleAction(el, e);
    });

    $('#search-input').addEventListener('input', debounce((e) => {
      state.filters.query = e.target.value;
      renderProducts();
    }));

    $('#sort-select').addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      renderProducts();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      $$('.modal.is-open').forEach((m) => setOpen(m, false));
      closeCart();
    });
  }

  function init() {
    if (!state.products.length) {
      console.error('No products found — make sure data/products.js loads before app.js');
    }
    state.cart = loadCart();
    $('#year').textContent = new Date().getFullYear();
    buildFilterChips();
    renderProducts();
    renderCart();
    bindEvents();
  }

  document.addEventListener('DOMContentLoaded', init);
})();