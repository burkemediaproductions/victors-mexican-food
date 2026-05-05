const MENU_ENDPOINT = '/.netlify/functions/menu';

const categoryContainer = document.querySelector('[data-menu-categories]');
const itemsContainer = document.querySelector('[data-menu-items]');
const cartPanel = document.querySelector('[data-cart-panel]');

const BUSINESS_TIME_ZONE = 'America/Los_Angeles';
const BREAKFAST_START_HOUR = 7;
const BREAKFAST_END_HOUR = 11;
const BREAKFAST_CATEGORY_NAMES = ['breakfast burritos', 'breakfast plates'];

const DESKTOP_PRIMARY_CATEGORY_NAMES = [
  'burritos',
  'soft tacos',
  'combination plates',
  'quesadillas',
  'taco salad',
  'tortas',
  'nachos',
  'carne asada fries',
  'drinks',
  'aguas frescas'
];

const MOBILE_QUICK_CATEGORY_NAMES = [
  'burritos',
  'soft tacos',
  'combination plates',
  'quesadillas',
  'drinks'
];

const DESKTOP_MAX_PRIMARY_CATEGORIES = 10;
const MOBILE_MAX_QUICK_CATEGORIES = 5;
const MOBILE_NAV_QUERY = '(max-width: 980px)';

let menuData = null;
let cart = [];
let activeCategoryIndex = -1;
let searchTerm = '';
let featuredCategoryIndexes = [];
let orderingAvailable = true;
let orderingStatusMessage = '';
let breakfastWindowActive = isBreakfastWindowActive();
let navMode = getNavMode();
let cloverPayment = null;
let mobileCategoriesCollapsed = false;
let mobileCartDock = null;
let mobileCartDockOpen = false;
let cartToast = null;
let cartToastTimer = null;

const navModeMedia = window.matchMedia(MOBILE_NAV_QUERY);

async function loadMenu() {
  if (!categoryContainer || !itemsContainer) return;

  try {
    const res = await fetch(MENU_ENDPOINT);
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message || data.error || 'Menu request failed');
    }

    menuData = {
      ...data,
      categories: Array.isArray(data.categories) ? data.categories : []
    };

    orderingAvailable = resolveOrderingAvailability(data);
    orderingStatusMessage = resolveOrderingStatusMessage(data);

    if (!menuData.categories.length) {
      categoryContainer.innerHTML = '';
      itemsContainer.innerHTML = '<p class="menu-empty">Menu is temporarily unavailable. Please try again soon.</p>';
      renderCart();
      return;
    }

    activeCategoryIndex = getInitialCategoryIndex();
    searchTerm = '';

    renderCategories();
    renderItems(menuData.categories[activeCategoryIndex]);
    renderCart();
  } catch (err) {
    console.error('Menu load failed', err);
    categoryContainer.innerHTML = '';
    itemsContainer.innerHTML = '<p class="menu-empty">Menu is temporarily unavailable. Please try again soon.</p>';
    renderCart();
  }
}

function getNavMode() {
  return window.matchMedia(MOBILE_NAV_QUERY).matches ? 'mobile' : 'desktop';
}

function normalizeCategoryName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();

  if (['true', '1', 'yes', 'y', 'on', 'open', 'enabled'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off', 'closed', 'disabled'].includes(normalized)) return false;

  return null;
}

function resolveOrderingAvailability(data) {
  const cfg = window.VICTORS_CONFIG || {};
  const candidates = [
    data?.orderingAvailable,
    data?.onlineOrderingAvailable,
    data?.orderingEnabled,
    cfg.orderingAvailable,
    cfg.onlineOrderingAvailable,
    cfg.orderingEnabled
  ];

  for (const candidate of candidates) {
    const parsed = parseBoolean(candidate);
    if (parsed !== null) return parsed;
  }

  return true;
}

function resolveOrderingStatusMessage(data) {
  const cfg = window.VICTORS_CONFIG || {};

  return data?.orderingMessage ||
    cfg.orderingMessage ||
    'Online ordering is currently unavailable. You can still browse the menu, and return during our operating hours to order.';
}

function getBusinessHour(date = new Date()) {
  try {
    const hourPart = new Intl.DateTimeFormat('en-US', {
      timeZone: BUSINESS_TIME_ZONE,
      hour: 'numeric',
      hourCycle: 'h23'
    })
      .formatToParts(date)
      .find(part => part.type === 'hour');

    const hour = Number(hourPart?.value);
    return Number.isFinite(hour) ? hour : date.getHours();
  } catch (error) {
    return date.getHours();
  }
}

function isBreakfastWindowActive(date = new Date()) {
  const hour = getBusinessHour(date);
  return hour >= BREAKFAST_START_HOUR && hour < BREAKFAST_END_HOUR;
}

function isBreakfastCategoryName(name) {
  const normalized = normalizeCategoryName(name);
  return BREAKFAST_CATEGORY_NAMES.some(breakfastName => normalized === normalizeCategoryName(breakfastName));
}

function getVisibleCategoryEntries() {
  if (!menuData?.categories?.length) return [];

  const breakfastOpen = isBreakfastWindowActive();

  return menuData.categories
    .map((category, index) => ({ category, index }))
    .filter(({ category }) => breakfastOpen || !isBreakfastCategoryName(category.name));
}

function getFeaturedNameList() {
  const primaryNames = navMode === 'mobile'
    ? MOBILE_QUICK_CATEGORY_NAMES
    : DESKTOP_PRIMARY_CATEGORY_NAMES;

  return isBreakfastWindowActive()
    ? [...BREAKFAST_CATEGORY_NAMES, ...primaryNames]
    : [...primaryNames];
}

function getFeaturedLimit() {
  return navMode === 'mobile'
    ? MOBILE_MAX_QUICK_CATEGORIES
    : DESKTOP_MAX_PRIMARY_CATEGORIES;
}

function getFeaturedCategoryIndexes(entries = getVisibleCategoryEntries()) {
  const selected = [];
  const featuredNames = getFeaturedNameList();
  const maxFeatured = getFeaturedLimit();

  featuredNames.forEach(featuredName => {
    if (selected.length >= maxFeatured) return;

    const target = normalizeCategoryName(featuredName);

    const exact = entries.find(({ category, index }) =>
      normalizeCategoryName(category.name) === target && !selected.includes(index)
    );

    const partial = entries.find(({ category, index }) =>
      normalizeCategoryName(category.name).includes(target) && !selected.includes(index)
    );

    const match = exact || partial;
    if (match) selected.push(match.index);
  });

  entries.forEach(({ index }) => {
    if (selected.length >= maxFeatured) return;
    if (!selected.includes(index)) selected.push(index);
  });

  return selected;
}

function getInitialCategoryIndex() {
  const entries = getVisibleCategoryEntries();
  const featured = getFeaturedCategoryIndexes(entries);
  return featured[0] ?? entries[0]?.index ?? 0;
}

function ensureActiveCategoryIsVisible() {
  const entries = getVisibleCategoryEntries();
  const activeIsVisible = entries.some(({ index }) => index === activeCategoryIndex);

  if (activeIsVisible) return;

  const featured = getFeaturedCategoryIndexes(entries);
  activeCategoryIndex = featured[0] ?? entries[0]?.index ?? 0;
}

function renderCategories() {
  if (!categoryContainer || !menuData?.categories?.length) return;

  navMode = getNavMode();
  ensureActiveCategoryIsVisible();

  const entries = getVisibleCategoryEntries();
  featuredCategoryIndexes = getFeaturedCategoryIndexes(entries);

  const visibleCategoryIndexes = entries.map(({ index }) => index);
  const moreCategoryIndexes = visibleCategoryIndexes.filter(index => !featuredCategoryIndexes.includes(index));
  const activeIsInMore = !searchTerm && moreCategoryIndexes.includes(activeCategoryIndex);

  categoryContainer.innerHTML = '';

  const nav = document.createElement('div');
  nav.className = 'menu-category-nav';
  nav.setAttribute('data-menu-category-nav', '');

  const header = document.createElement('div');
  header.className = 'menu-category-header';
  header.innerHTML = `
    <span class="menu-category-eyebrow">${orderingAvailable ? 'Order Online' : 'Browse Menu'}</span>
    <strong>Menu Categories</strong>
  `;

  if (navMode === 'mobile' && mobileCategoriesCollapsed) {
    nav.classList.add('is-collapsed');
  }

  const activeCategoryName = menuData.categories[activeCategoryIndex]?.name || 'Menu Categories';
  const mobileCollapseToggle = document.createElement('button');
  mobileCollapseToggle.className = 'menu-mobile-category-toggle';
  mobileCollapseToggle.type = 'button';
  mobileCollapseToggle.setAttribute('data-mobile-category-toggle', '');
  mobileCollapseToggle.setAttribute('aria-expanded', mobileCategoriesCollapsed ? 'false' : 'true');
  mobileCollapseToggle.innerHTML = `
    <span>${mobileCategoriesCollapsed ? 'Show Categories' : 'Hide Categories'}</span>
    <strong>${escapeHtml(activeCategoryName)}</strong>
    <em aria-hidden="true">${mobileCategoriesCollapsed ? 'v' : '^'}</em>
  `;

  const searchLabel = document.createElement('label');
  searchLabel.className = 'menu-search-label';
  searchLabel.innerHTML = `
    <span class="sr-only">Search menu</span>
    <input class="menu-search-input" data-menu-search type="search" placeholder="Search menu..." autocomplete="off" value="${escapeHtml(searchTerm)}">
  `;

  const quickLabel = document.createElement('div');
  quickLabel.className = 'menu-category-label';
  quickLabel.textContent = navMode === 'mobile' ? 'Quick picks' : 'Featured categories';

  const featuredBar = document.createElement('div');
  featuredBar.className = 'menu-category-bar';
  featuredBar.setAttribute('data-featured-categories', '');

  featuredCategoryIndexes.forEach(index => {
    featuredBar.appendChild(createCategoryButton(menuData.categories[index], index));
  });

  let moreToggle = null;
  let moreWrap = null;

  if (moreCategoryIndexes.length) {
    moreToggle = document.createElement('button');
    moreToggle.className = 'menu-more-toggle';
    moreToggle.type = 'button';
    moreToggle.setAttribute('data-menu-more-toggle', '');
    moreToggle.setAttribute('aria-expanded', 'false');
    moreToggle.setAttribute('aria-controls', 'menu-category-more-panel');

    const moreText = document.createElement('span');
    moreText.textContent = activeIsInMore ? menuData.categories[activeCategoryIndex].name : 'More Categories';

    const moreIcon = document.createElement('span');
    moreIcon.setAttribute('aria-hidden', 'true');
    moreIcon.textContent = 'v';

    moreToggle.append(moreText, moreIcon);

    if (activeIsInMore) moreToggle.classList.add('active');


    moreWrap = document.createElement('div');
    moreWrap.className = 'menu-category-more';
    moreWrap.setAttribute('data-menu-more', '');
    moreWrap.id = 'menu-category-more-panel';
    moreWrap.hidden = true;

    const morePanel = document.createElement('div');
    morePanel.className = 'menu-more-panel';
    morePanel.setAttribute('role', 'dialog');
    morePanel.setAttribute('aria-label', 'More menu categories');

    const moreHeader = document.createElement('div');
    moreHeader.className = 'menu-more-header';
    moreHeader.innerHTML = `
      <div>
        <span class="menu-category-eyebrow">Full Menu</span>
        <strong>More Categories</strong>
      </div>
      <button class="menu-more-close" type="button" data-menu-more-close aria-label="Close category menu">Close</button>
    `;

    const moreGrid = document.createElement('div');
    moreGrid.className = 'menu-more-grid';

    moreCategoryIndexes.forEach(index => {
      moreGrid.appendChild(createCategoryButton(menuData.categories[index], index, 'menu-tab-more'));
    });

    morePanel.append(moreHeader, moreGrid);
    moreWrap.appendChild(morePanel);
  }

  nav.append(header, mobileCollapseToggle, searchLabel);
  nav.append(quickLabel, featuredBar);
  if (moreToggle) nav.appendChild(moreToggle);
  if (moreWrap) nav.appendChild(moreWrap);

  categoryContainer.appendChild(nav);

  const searchInput = categoryContainer.querySelector('[data-menu-search]');
  searchInput?.addEventListener('input', event => {
    searchTerm = event.currentTarget.value.trim();

    if (searchTerm) {
      renderSearchResults(searchTerm);
    } else {
      renderItems(menuData.categories[activeCategoryIndex]);
    }

    updateCategoryActiveStates();
  });

  categoryContainer.querySelector('[data-mobile-category-toggle]')?.addEventListener('click', () => {
    mobileCategoriesCollapsed = !mobileCategoriesCollapsed;
    toggleMoreCategories(false);
    renderCategories();
  });

  const moreToggleButton = categoryContainer.querySelector('[data-menu-more-toggle]');
  moreToggleButton?.addEventListener('click', () => {
    const more = categoryContainer.querySelector('[data-menu-more]');
    toggleMoreCategories(more?.hidden);
  });

  categoryContainer.querySelector('[data-menu-more-close]')?.addEventListener('click', () => {
    toggleMoreCategories(false, true);
  });

  categoryContainer.querySelector('[data-menu-more]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) toggleMoreCategories(false);
  });
}

function createCategoryButton(category, index, extraClass = '') {
  const btn = document.createElement('button');
  btn.className = `menu-tab ${extraClass}`.trim();
  btn.type = 'button';
  btn.textContent = category.name;
  btn.dataset.categoryIndex = String(index);
  btn.setAttribute('aria-pressed', !searchTerm && index === activeCategoryIndex ? 'true' : 'false');

  if (!searchTerm && index === activeCategoryIndex) btn.classList.add('active');

  btn.addEventListener('click', () => setActiveCategory(index));

  return btn;
}

function setActiveCategory(index) {
  if (!menuData?.categories?.[index]) return;

  const visible = getVisibleCategoryEntries().some(entry => entry.index === index);
  if (!visible) return;

  activeCategoryIndex = index;
  searchTerm = '';

  renderCategories();
  renderItems(menuData.categories[activeCategoryIndex]);
  toggleMoreCategories(false);
}

function toggleMoreCategories(open, returnFocus = false) {
  const more = categoryContainer?.querySelector('[data-menu-more]');
  const toggle = categoryContainer?.querySelector('[data-menu-more-toggle]');

  if (!more || !toggle) return;

  more.hidden = !open;
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    const activeButton = more.querySelector('.menu-tab.active') || more.querySelector('.menu-tab');
    activeButton?.focus({ preventScroll: true });
  } else if (returnFocus) {
    toggle.focus({ preventScroll: true });
  }
}

function updateCategoryActiveStates() {
  const hasSearch = Boolean(searchTerm);

  categoryContainer?.querySelectorAll('.menu-tab').forEach(btn => {
    const index = Number(btn.dataset.categoryIndex);
    const active = !hasSearch && index === activeCategoryIndex;

    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  });

  const moreToggle = categoryContainer?.querySelector('[data-menu-more-toggle]');
  if (moreToggle) {
    const visibleCategoryIndexes = getVisibleCategoryEntries().map(({ index }) => index);
    const moreIndexes = visibleCategoryIndexes.filter(index => !featuredCategoryIndexes.includes(index));

    moreToggle.classList.toggle('active', !hasSearch && moreIndexes.includes(activeCategoryIndex));
  }
}

function renderItems(category) {
  if (!itemsContainer || !category) return;

  ensureActiveCategoryIsVisible();

  const visible = getVisibleCategoryEntries().some(entry => entry.index === activeCategoryIndex);
  const categoryToRender = visible ? menuData.categories[activeCategoryIndex] : category;

  itemsContainer.innerHTML = '';
  itemsContainer.appendChild(createResultsHeading('Menu Category', categoryToRender.name));

  const items = Array.isArray(categoryToRender.items) ? categoryToRender.items : [];

  if (!items.length) {
    itemsContainer.appendChild(createEmptyMessage('No items are currently available in this category.'));
    return;
  }

  items.forEach(item => itemsContainer.appendChild(createMenuItemCard(item)));
}

function renderSearchResults(term) {
  if (!itemsContainer || !menuData?.categories) return;

  const normalizedTerm = term.toLowerCase();
  const matches = [];

  getVisibleCategoryEntries().forEach(({ category }) => {
    const items = Array.isArray(category.items) ? category.items : [];

    items.forEach(item => {
      const haystack = `${item.name || ''} ${item.description || ''} ${category.name || ''}`.toLowerCase();
      if (haystack.includes(normalizedTerm)) {
        matches.push({ item, categoryName: category.name });
      }
    });
  });

  itemsContainer.innerHTML = '';
  itemsContainer.appendChild(createResultsHeading('Search Results', `${matches.length} item${matches.length === 1 ? '' : 's'} for "${term}"`));

  if (!matches.length) {
    itemsContainer.appendChild(createEmptyMessage('No menu items matched your search. Try another keyword or choose a category.'));
    return;
  }

  matches.forEach(match => itemsContainer.appendChild(createMenuItemCard(match.item, match.categoryName)));
}

function createResultsHeading(label, title) {
  const heading = document.createElement('div');
  heading.className = 'menu-results-heading';
  heading.innerHTML = `
    <span>${escapeHtml(label)}</span>
    <h3>${escapeHtml(title)}</h3>
  `;

  return heading;
}

function createEmptyMessage(message) {
  const empty = document.createElement('p');
  empty.className = 'menu-empty';
  empty.textContent = message;

  return empty;
}

function createMenuItemCard(item, categoryName = '') {
  const card = document.createElement('article');
  card.className = item.imageUrl ? 'menu-item-card has-image' : 'menu-item-card';

  const addControl = orderingAvailable
    ? `<button class="button order-button" type="button" data-add-item>Add</button>`
    : `<button class="button order-button menu-add-disabled" type="button" disabled aria-disabled="true">Browse Only</button>`;

  const imageMarkup = item.imageUrl
    ? `
      <div class="menu-item-photo-wrap">
        <img class="menu-item-photo" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">
      </div>
    `
    : '';

  card.innerHTML = `
    ${imageMarkup}
    <div class="menu-item-card-body">
      <div class="menu-item-card-copy">
        ${categoryName ? `<span class="menu-item-category">${escapeHtml(categoryName)}</span>` : ''}
        <h3>${escapeHtml(item.name)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      </div>
      <div class="menu-item-card-footer">
        <strong>${escapeHtml(item.priceFormatted || formatMoney(item.price))}</strong>
        ${addControl}
      </div>
    </div>
  `;

  card.querySelector('.menu-item-photo')?.addEventListener('error', () => {
    card.querySelector('.menu-item-photo-wrap')?.remove();
    card.classList.remove('has-image');
  }, { once: true });

  card.querySelector('[data-add-item]')?.addEventListener('click', () => addToCart(item));
  return card;
}

function addToCart(item) {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  const existing = cart.find(cartItem => cartItem.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price || 0,
      priceFormatted: item.priceFormatted,
      imageUrl: item.imageUrl || '',
      quantity: 1
    });
  }

  renderCart();
  showCartToast(`${item.name} added to cart`);
}

function updateQuantity(itemId, quantity) {
  if (!orderingAvailable) return;

  cart = cart
    .map(item => item.id === itemId ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);

  renderCart();
}

function removeFromCart(itemId) {
  cart = cart.filter(item => item.id !== itemId);
  renderCart();
}

function getCartSubtotal() {
  return cart.reduce((total, item) => total + item.price * item.quantity, 0);
}

function renderCart() {
  if (!cartPanel) return;

  if (!orderingAvailable) {
    cart = [];
    cartPanel.innerHTML = `
      <h3>Browse Menu</h3>
      <p class="cart-empty">${escapeHtml(orderingStatusMessage)}</p>
      <p class="cart-empty cart-empty-secondary">Need help? Call <a href="tel:+17603413553">(760) 341-3553</a>.</p>
    `;
    renderMobileCartDock();
    return;
  }

  if (!cart.length) {
    cartPanel.innerHTML = `
      <h3>Your Order</h3>
      <p class="cart-empty">Your cart is empty. Add an item to get started.</p>
    `;
    renderMobileCartDock();
    return;
  }

  cartPanel.innerHTML = `
    <h3>Your Order</h3>

    <div class="cart-items">
      ${cart.map(item => `
        <div class="cart-item">
          <div>
            <strong>${escapeHtml(item.name)}</strong>
            <span>${formatMoney(item.price)} each</span>
          </div>

          <div class="cart-controls">
            <button type="button" data-decrease="${escapeHtml(item.id)}" aria-label="Decrease ${escapeHtml(item.name)}">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-increase="${escapeHtml(item.id)}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
          </div>

          <div class="cart-line-total">
            ${formatMoney(item.price * item.quantity)}
          </div>

          <button class="cart-remove" type="button" data-remove="${escapeHtml(item.id)}">
            Remove
          </button>
        </div>
      `).join('')}
    </div>

    <div class="cart-summary">
      <div><span>Subtotal</span><strong>${formatMoney(getCartSubtotal())}</strong></div>
    </div>

    <button class="button order-button cart-checkout" type="button" data-checkout>
      Continue to Checkout
    </button>
  `;

  cartPanel.querySelectorAll('[data-increase]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cart.find(i => i.id === btn.dataset.increase);
      if (item) updateQuantity(item.id, item.quantity + 1);
    });
  });

  cartPanel.querySelectorAll('[data-decrease]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cart.find(i => i.id === btn.dataset.decrease);
      if (item) updateQuantity(item.id, item.quantity - 1);
    });
  });

  cartPanel.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
  });

  cartPanel.querySelector('[data-checkout]')?.addEventListener('click', () => {
    renderCheckout();
    scrollCartPanelIntoView();
  });

  renderMobileCartDock();
}

function getCartItemCount() {
  return cart.reduce((total, item) => total + (Number(item.quantity) || 0), 0);
}

function ensureMobileCartDock() {
  if (mobileCartDock) return mobileCartDock;

  mobileCartDock = document.createElement('div');
  mobileCartDock.className = 'mobile-cart-dock';
  mobileCartDock.setAttribute('data-mobile-cart-dock', '');
  mobileCartDock.hidden = true;
  document.body.appendChild(mobileCartDock);

  return mobileCartDock;
}

function renderMobileCartDock() {
  const dock = ensureMobileCartDock();
  const showDock = orderingAvailable && cart.length > 0 && getNavMode() === 'mobile';

  document.body.classList.toggle('has-mobile-cart-dock', showDock);

  if (!showDock) {
    mobileCartDockOpen = false;
    dock.hidden = true;
    dock.innerHTML = '';
    dock.classList.remove('is-open');
    return;
  }

  const itemCount = getCartItemCount();
  const subtotal = getCartSubtotal();
  const itemLabel = `${itemCount} item${itemCount === 1 ? '' : 's'}`;

  dock.hidden = false;
  dock.classList.toggle('is-open', mobileCartDockOpen);

  dock.innerHTML = `
    ${mobileCartDockOpen ? `
      <div class="mobile-cart-sheet" role="dialog" aria-label="Your order summary">
        <div class="mobile-cart-sheet-header">
          <div>
            <span>Your Order</span>
            <strong>${escapeHtml(itemLabel)} • ${formatMoney(subtotal)}</strong>
          </div>
          <button type="button" data-mobile-cart-close aria-label="Collapse cart summary">Close</button>
        </div>
        <div class="mobile-cart-sheet-items">
          ${cart.map(item => `
            <div class="mobile-cart-sheet-item">
              <span>${escapeHtml(item.name)}</span>
              <strong>${item.quantity} × ${formatMoney(item.price)}</strong>
            </div>
          `).join('')}
        </div>
        <div class="mobile-cart-sheet-actions">
          <button class="button-outline" type="button" data-mobile-cart-view>View Full Cart</button>
          <button class="button order-button" type="button" data-mobile-cart-checkout>Checkout</button>
        </div>
      </div>
    ` : ''}
    <button class="mobile-cart-bar" type="button" data-mobile-cart-toggle aria-expanded="${mobileCartDockOpen ? 'true' : 'false'}">
      <span>
        <strong>Your Order</strong>
        <em>${escapeHtml(itemLabel)} • ${formatMoney(subtotal)}</em>
      </span>
      <b>${mobileCartDockOpen ? 'Hide' : 'View Cart'}</b>
    </button>
  `;

  dock.querySelector('[data-mobile-cart-toggle]')?.addEventListener('click', () => {
    mobileCartDockOpen = !mobileCartDockOpen;
    renderMobileCartDock();
  });

  dock.querySelector('[data-mobile-cart-close]')?.addEventListener('click', () => {
    mobileCartDockOpen = false;
    renderMobileCartDock();
  });

  dock.querySelector('[data-mobile-cart-view]')?.addEventListener('click', () => {
    mobileCartDockOpen = false;
    renderMobileCartDock();
    scrollCartPanelIntoView();
  });

  dock.querySelector('[data-mobile-cart-checkout]')?.addEventListener('click', () => {
    mobileCartDockOpen = false;
    renderCheckout();
    renderMobileCartDock();
    scrollCartPanelIntoView();
  });
}

function ensureCartToast() {
  if (cartToast) return cartToast;

  cartToast = document.createElement('div');
  cartToast.className = 'cart-toast';
  cartToast.setAttribute('role', 'status');
  cartToast.setAttribute('aria-live', 'polite');
  document.body.appendChild(cartToast);

  return cartToast;
}

function showCartToast(message) {
  if (getNavMode() !== 'mobile') return;

  const toast = ensureCartToast();
  toast.textContent = message;
  toast.classList.add('is-visible');

  if (cartToastTimer) clearTimeout(cartToastTimer);
  cartToastTimer = setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 2200);
}

function scrollCartPanelIntoView() {
  cartPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function formatMoney(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function renderCheckout() {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  cartPanel.innerHTML = `
    <h3>Checkout</h3>

    <form class="checkout-form" data-checkout-form>
      <label>
        Name
        <input name="customerName" type="text" autocomplete="name" required>
      </label>

      <label>
        Phone
        <input name="phone" type="tel" autocomplete="tel" required>
      </label>

      <label>
        Email
        <input name="email" type="email" autocomplete="email">
      </label>

      <label>
        Order Notes
        <textarea name="orderNotes" rows="3" placeholder="Anything we should know?"></textarea>
      </label>

      <div class="cart-summary">
        <div><span>Subtotal</span><strong>${formatMoney(getCartSubtotal())}</strong></div>
      </div>

      <button class="button order-button cart-checkout" type="submit">
        Place Order
      </button>

      <button class="cart-remove" type="button" data-back-to-cart>
        Back to Cart
      </button>
    </form>
  `;

  cartPanel.querySelector('[data-back-to-cart]')?.addEventListener('click', renderCart);

  renderMobileCartDock();

  cartPanel.querySelector('[data-checkout-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!orderingAvailable) {
      renderCart();
      return;
    }

    const formData = new FormData(event.currentTarget);

    const checkoutData = {
      customerName: formData.get('customerName'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      orderNotes: formData.get('orderNotes'),
      cart
    };

    try {
      const submitButton = event.currentTarget.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Creating Order...';

      const response = await fetch('/.netlify/functions/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutData)
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || result.error || 'Order failed');
      }

      console.log('Clover order created:', result);

      cartPanel.innerHTML = `
        <h3>Order Created</h3>
        <p>Your order was created successfully.</p>
        <p><strong>Order ID:</strong> ${escapeHtml(result.orderId)}</p>
        <button class="button order-button cart-checkout" type="button" data-next-payment>
          Continue to Payment
        </button>
      `;

      cartPanel.querySelector('[data-next-payment]')?.addEventListener('click', () => {
        renderPayment(result.orderId, getCartSubtotal());
      });
    } catch (error) {
      alert(error.message);
      renderCart();
    }
  });
}

function renderPayment(orderId, amount) {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  const cfg = window.VICTORS_CONFIG || {};

  cartPanel.innerHTML = `
    <h3>Payment</h3>
    <p>Order ID: <strong>${escapeHtml(orderId)}</strong></p>
    <p>Total due: <strong>${formatMoney(amount)}</strong></p>

    <form class="checkout-form" id="clover-payment-form">
      <label>
        Card Number
        <div id="card-number" class="clover-field"></div>
        <small id="card-number-error" class="clover-error"></small>
      </label>

      <label>
        Expiration
        <div id="card-date" class="clover-field"></div>
        <small id="card-date-error" class="clover-error"></small>
      </label>

      <label>
        CVV
        <div id="card-cvv" class="clover-field"></div>
        <small id="card-cvv-error" class="clover-error"></small>
      </label>

      <label>
        ZIP
        <div id="card-postal-code" class="clover-field"></div>
        <small id="card-postal-code-error" class="clover-error"></small>
      </label>

      <p class="ordering-state" data-payment-status></p>

      <button class="button order-button cart-checkout" type="submit">
        Pay ${formatMoney(amount)}
      </button>
    </form>
  `;

  renderMobileCartDock();

  if (!window.Clover || !cfg.cloverPublicKey || !cfg.cloverMerchantId) {
    cartPanel.querySelector('[data-payment-status]').textContent =
      'Payment setup is missing Clover public configuration.';
    return;
  }

  cloverPayment = new Clover(cfg.cloverPublicKey, {
    merchantId: cfg.cloverMerchantId
  });

  const elements = cloverPayment.elements();

  const styles = {
    body: {
      fontFamily: 'Inter, Segoe UI, sans-serif',
      fontSize: '16px'
    },
    input: {
      fontSize: '16px'
    }
  };

  elements.create('CARD_NUMBER', styles).mount('#card-number');
  elements.create('CARD_DATE', styles).mount('#card-date');
  elements.create('CARD_CVV', styles).mount('#card-cvv');
  elements.create('CARD_POSTAL_CODE', styles).mount('#card-postal-code');

  const form = document.getElementById('clover-payment-form');
  const status = cartPanel.querySelector('[data-payment-status]');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!orderingAvailable) {
      renderCart();
      return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Processing...';
    status.textContent = 'Tokenizing card...';

    try {
      const tokenResult = await cloverPayment.createToken();

      console.log('Clover token result:', tokenResult);

      if (tokenResult.errors) {
        throw new Error(Object.values(tokenResult.errors).join(' '));
      }

      const source = tokenResult.token;

      if (!source) {
        throw new Error('No Clover payment token returned');
      }

      const paymentPayload = {
        orderId: orderId,
        source: source,
        amount: Number(amount)
      };

      console.log('Sending payment payload:', paymentPayload);

      const response = await fetch('/.netlify/functions/pay-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentPayload)
      });

      const paymentResult = await response.json();

      if (!response.ok) {
        throw new Error(paymentResult.message || paymentResult.error || 'Payment failed');
      }

      cart = [];

      cartPanel.innerHTML = `
        <h3>Payment Received</h3>
        <p>Thank you! Your order has been paid successfully.</p>
        <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      `;
      renderMobileCartDock();
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
      button.textContent = `Pay ${formatMoney(amount)}`;
    }
  });
}

function refreshTimeSensitiveMenu() {
  if (!menuData?.categories?.length) return;

  const nextBreakfastState = isBreakfastWindowActive();
  const nextNavMode = getNavMode();
  const breakfastChanged = nextBreakfastState !== breakfastWindowActive;
  const navModeChanged = nextNavMode !== navMode;

  if (!breakfastChanged && !navModeChanged) return;

  breakfastWindowActive = nextBreakfastState;
  navMode = nextNavMode;
  ensureActiveCategoryIsVisible();
  renderCategories();

  if (searchTerm) {
    renderSearchResults(searchTerm);
  } else {
    renderItems(menuData.categories[activeCategoryIndex]);
  }

  renderMobileCartDock();
}

document.addEventListener('click', event => {
  if (!categoryContainer || categoryContainer.contains(event.target)) return;
  toggleMoreCategories(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') toggleMoreCategories(false, true);
});

if (typeof navModeMedia.addEventListener === 'function') {
  navModeMedia.addEventListener('change', refreshTimeSensitiveMenu);
} else if (typeof navModeMedia.addListener === 'function') {
  navModeMedia.addListener(refreshTimeSensitiveMenu);
}

setInterval(refreshTimeSensitiveMenu, 60000);

loadMenu();
