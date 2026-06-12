const MENU_ENDPOINT = '/.netlify/functions/menu';
const ORDER_FULFILLMENT_ENDPOINT = '/.netlify/functions/order-fulfillment';
const CART_STORAGE_KEY = 'victors-order-cart-v1';

const categoryContainer = document.querySelector('[data-menu-categories]');
const itemsContainer = document.querySelector('[data-menu-items]');
const cartPanel = document.querySelector('[data-cart-panel]');

const BUSINESS_TIME_ZONE = 'America/Los_Angeles';
const BREAKFAST_START_HOUR = 7;
const BREAKFAST_END_HOUR = 11;
const BREAKFAST_CATEGORY_NAMES = ['breakfast burritos', 'breakfast plates', 'american breakfast'];

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
let cart = loadSavedCart();
let activeCategoryIndex = -1;
let searchTerm = '';
let featuredCategoryIndexes = [];
let orderingAvailable = true;
let orderingStatusMessage = '';
let breakfastWindowActive = isBreakfastWindowActive();
let navMode = getNavMode();
let cloverPayment = null;
let mobileCategoriesCollapsed = false;
let mobileSearchOpen = false;
let mobileCartDock = null;
let mobileCartDockOpen = false;
let cartToast = null;
let cartToastTimer = null;
let modifierDialog = null;

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

  if (navMode === 'mobile') {
    renderMobileCategoryControls(nav, header, entries);
    categoryContainer.appendChild(nav);
    return;
  }

  const searchLabel = document.createElement('label');
  searchLabel.className = 'menu-search-label';
  searchLabel.innerHTML = `
    <span class="sr-only">Search menu</span>
    <input class="menu-search-input" data-menu-search type="search" placeholder="Search menu..." autocomplete="off" value="${escapeHtml(searchTerm)}">
  `;

  const quickLabel = document.createElement('div');
  quickLabel.className = 'menu-category-label';
  quickLabel.textContent = 'Featured categories';

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
    moreIcon.className = 'category-toggle-icon menu-more-toggle-icon';
    moreIcon.setAttribute('aria-hidden', 'true');

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

  nav.append(header, searchLabel);
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

function renderMobileCategoryControls(nav, header, entries) {
  const activeCategoryName = menuData.categories[activeCategoryIndex]?.name || entries[0]?.category?.name || 'Menu Categories';

  header.classList.add('menu-category-header-mobile');
  header.innerHTML = `
    <span class="menu-category-eyebrow">${searchTerm ? 'Search Results' : 'Menu Category'}</span>
    <strong>${escapeHtml(searchTerm ? `Searching "${searchTerm}"` : activeCategoryName)}</strong>
  `;

  const controls = document.createElement('div');
  controls.className = 'mobile-menu-controls';

  const selectLabel = document.createElement('label');
  selectLabel.className = 'mobile-category-select-label';
  selectLabel.innerHTML = `
    <span class="sr-only">Choose a menu category</span>
    <select class="mobile-category-select" data-mobile-category-select>
      ${entries.map(({ category, index }) => `
        <option value="${escapeHtml(index)}" ${index === activeCategoryIndex ? 'selected' : ''}>
          ${escapeHtml(category.name)}
        </option>
      `).join('')}
    </select>
  `;

  const searchToggle = document.createElement('button');
  searchToggle.className = 'mobile-search-toggle';
  searchToggle.type = 'button';
  searchToggle.setAttribute('data-mobile-search-toggle', '');
  searchToggle.setAttribute('aria-expanded', mobileSearchOpen || Boolean(searchTerm) ? 'true' : 'false');
  searchToggle.innerHTML = `
    <span aria-hidden="true" class="mobile-search-icon"></span>
    <span>Search</span>
  `;

  controls.append(selectLabel, searchToggle);

  const searchWrap = document.createElement('label');
  searchWrap.className = `menu-search-label mobile-search-panel${mobileSearchOpen || searchTerm ? ' is-open' : ''}`;
  searchWrap.innerHTML = `
    <span class="sr-only">Search menu</span>
    <input class="menu-search-input" data-menu-search type="search" placeholder="Search menu..." autocomplete="off" value="${escapeHtml(searchTerm)}">
  `;

  nav.append(controls, searchWrap);

  const select = nav.querySelector('[data-mobile-category-select]');
  select?.addEventListener('change', event => {
    const nextIndex = Number(event.currentTarget.value);
    if (!menuData?.categories?.[nextIndex]) return;

    activeCategoryIndex = nextIndex;
    searchTerm = '';
    mobileSearchOpen = false;

    renderCategories();
    renderItems(menuData.categories[activeCategoryIndex]);
    toggleMoreCategories(false);
    requestAnimationFrame(() => scrollCategorySectionIntoView(activeCategoryIndex));
  });

  const searchInput = nav.querySelector('[data-menu-search]');
  nav.querySelector('[data-mobile-search-toggle]')?.addEventListener('click', () => {
    mobileSearchOpen = !mobileSearchOpen;

    if (!mobileSearchOpen && searchTerm) {
      searchTerm = '';
      renderCategories();
      renderItems(menuData.categories[activeCategoryIndex]);
      return;
    }

    renderCategories();

    if (mobileSearchOpen) {
      requestAnimationFrame(() => {
        const nextInput = categoryContainer?.querySelector('[data-menu-search]');
        nextInput?.focus({ preventScroll: true });
      });
    }
  });

  searchInput?.addEventListener('input', event => {
    searchTerm = event.currentTarget.value.trim();

    if (searchTerm) {
      renderSearchResults(searchTerm);
    } else {
      renderItems(menuData.categories[activeCategoryIndex]);
    }

    updateCategoryActiveStates();
    renderCategories();

    if (mobileSearchOpen || searchTerm) {
      requestAnimationFrame(() => {
        const nextInput = categoryContainer?.querySelector('[data-menu-search]');
        if (!nextInput) return;
        nextInput.focus({ preventScroll: true });
        const length = nextInput.value.length;
        nextInput.setSelectionRange(length, length);
      });
    }
  });
}

function scrollItemsHeadingIntoView() {
  if (getNavMode() !== 'mobile') return;

  const heading = itemsContainer?.querySelector('.menu-results-heading');
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function scrollCategorySectionIntoView(index) {
  if (getNavMode() !== 'mobile') return;

  const heading = itemsContainer?.querySelector(`[data-menu-category-section="${cssEscape(index)}"]`);
  heading?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function updateMobileCategorySelect() {
  if (getNavMode() !== 'mobile') return;

  const select = categoryContainer?.querySelector('[data-mobile-category-select]');
  if (select && String(select.value) !== String(activeCategoryIndex)) {
    select.value = String(activeCategoryIndex);
  }
}

function updateActiveMobileCategoryFromScroll() {
  if (getNavMode() !== 'mobile' || searchTerm || !itemsContainer || !menuData?.categories?.length) return;

  const headings = Array.from(itemsContainer.querySelectorAll('[data-menu-category-section]'));
  if (!headings.length) return;

  const stickyOffset = categoryContainer?.getBoundingClientRect().bottom || 0;
  const targetLine = stickyOffset + 24;
  let currentIndex = Number(headings[0].dataset.menuCategorySection);

  headings.forEach(heading => {
    if (heading.getBoundingClientRect().top <= targetLine) {
      currentIndex = Number(heading.dataset.menuCategorySection);
    }
  });

  if (!Number.isFinite(currentIndex) || currentIndex === activeCategoryIndex) return;

  activeCategoryIndex = currentIndex;
  updateMobileCategorySelect();
}

let mobileScrollSpyFrame = null;
function requestMobileScrollSpyUpdate() {
  if (mobileScrollSpyFrame) return;

  mobileScrollSpyFrame = requestAnimationFrame(() => {
    mobileScrollSpyFrame = null;
    updateActiveMobileCategoryFromScroll();
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

  if (getNavMode() === 'mobile') {
    renderMobileCategorySections();
    return;
  }

  const visible = getVisibleCategoryEntries().some(entry => entry.index === activeCategoryIndex);
  const categoryToRender = visible ? menuData.categories[activeCategoryIndex] : category;

  itemsContainer.innerHTML = '';
  itemsContainer.appendChild(createResultsHeading('Menu Category', categoryToRender.name, activeCategoryIndex));

  const items = Array.isArray(categoryToRender.items) ? categoryToRender.items : [];

  if (!items.length) {
    itemsContainer.appendChild(createEmptyMessage('No items are currently available in this category.'));
    return;
  }

  items.forEach(item => itemsContainer.appendChild(createMenuItemCard(item)));
}

function renderMobileCategorySections() {
  if (!itemsContainer || !menuData?.categories?.length) return;

  const entries = getVisibleCategoryEntries();
  itemsContainer.innerHTML = '';

  entries.forEach(({ category, index }) => {
    itemsContainer.appendChild(createResultsHeading('Menu Category', category.name, index));

    const items = Array.isArray(category.items) ? category.items : [];

    if (!items.length) {
      itemsContainer.appendChild(createEmptyMessage('No items are currently available in this category.'));
      return;
    }

    items.forEach(item => itemsContainer.appendChild(createMenuItemCard(item)));
  });

  updateMobileCategorySelect();
}

function renderSearchResults(term) {
  if (!itemsContainer || !menuData?.categories) return;

  const normalizedTerm = term.toLowerCase();
  const matches = [];

  getVisibleCategoryEntries().forEach(({ category }) => {
    const items = Array.isArray(category.items) ? category.items : [];

    items.forEach(item => {
      const haystack = getItemSearchText(item, category.name);
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

function createResultsHeading(label, title, categoryIndex = null) {
  const heading = document.createElement('div');
  heading.className = 'menu-results-heading';

  if (categoryIndex !== null && categoryIndex !== undefined) {
    heading.dataset.menuCategorySection = String(categoryIndex);
  }

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
  const displayName = getItemDisplayName(item);

  const hasModifiers = getItemModifierGroups(item).length > 0;
  const hasBasePrice = Number(item.price || 0) > 0;

  let addControl = '';

  if (!orderingAvailable) {
    addControl = `<button class="button order-button menu-add-disabled" type="button" disabled aria-disabled="true">Browse Only</button>`;
  } else if (hasModifiers && hasBasePrice) {
    addControl = `
      <div class="menu-item-card-actions">
        <button class="red-button button menu-options-button" type="button" data-options-item>Customize</button>
        <button class="button order-button" type="button" data-add-item>Add to Order</button>
      </div>
    `;
  } else if (hasModifiers) {
    addControl = `<button class="button order-button" type="button" data-options-item>Options</button>`;
  } else {
    addControl = `<button class="button order-button" type="button" data-add-item>Add</button>`;
  }

  const imageMarkup = item.imageUrl
    ? `
      <div class="menu-item-photo-wrap">
        <img class="menu-item-photo" src="${escapeHtml(item.imageUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async">
      </div>
    `
    : '';

  card.innerHTML = `
    ${imageMarkup}
    <div class="menu-item-card-body">
      <div class="menu-item-card-copy">
        ${categoryName ? `<span class="menu-item-category">${escapeHtml(categoryName)}</span>` : ''}
        <h3>${escapeHtml(displayName)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      </div>
      <div class="menu-item-card-footer">
        ${hasBasePrice ? `<strong>${escapeHtml(item.priceFormatted || formatMoney(item.price))}</strong>` : ''}
        ${addControl}
      </div>
    </div>
  `;

  card.querySelector('.menu-item-photo')?.addEventListener('error', () => {
    card.querySelector('.menu-item-photo-wrap')?.remove();
    card.classList.remove('has-image');
  }, { once: true });

  card.querySelector('[data-add-item]')?.addEventListener('click', () => addToCart(item));
  card.querySelector('[data-options-item]')?.addEventListener('click', () => startAddToCart(item));
  return card;
}

function getItemModifierGroups(item) {
  return (Array.isArray(item.modifierGroups) ? item.modifierGroups : [])
    .map(group => ({
      ...group,
      modifiers: Array.isArray(group.modifiers) ? group.modifiers.filter(isVisibleModifierOption) : []
    }))
    .filter(group => group.modifiers.length);
}


function isVisibleModifierOption(modifier) {
  if (!modifier || !modifier.id) return false;

  const name = String(modifier.name || '').trim();
  const normalizedName = name.toLowerCase();

  if (!name) return false;
  if (/^-+$/.test(name.replace(/\s+/g, ''))) return false;
  if (!/[a-z0-9]/i.test(name)) return false;
  if (normalizedName.includes('refill')) return false;

  return true;
}

function getModifierSummary(modifiers = []) {
  return modifiers.map(modifier => modifier.name).filter(Boolean).join(', ');
}

function getCartLineKey(itemId, modifiers = [], note = '') {
  const modifierKey = modifiers
    .map(modifier => `${modifier.groupId || ''}:${modifier.id}`)
    .sort()
    .join('|');

  return `${itemId}::${modifierKey}::${String(note || '').trim()}`;
}

function getCartItemUnitPrice(item) {
  const modifierTotal = (Array.isArray(item.modifiers) ? item.modifiers : [])
    .reduce((total, modifier) => total + Number(modifier.price || 0), 0);

  return Number(item.price || 0) + modifierTotal;
}

function getItemDisplayName(item) {
  return String(item?.onlineName || item?.name || item?.cloverName || '').trim();
}

function getItemSearchText(item, categoryName = '') {
  return [
    getItemDisplayName(item),
    item?.onlineName,
    item?.name,
    item?.cloverName,
    item?.description,
    categoryName
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getCartItemDisplayName(item) {
  const baseName = getItemDisplayName(item);
  const summary = getModifierSummary(item.modifiers);
  return summary ? `${baseName} (${summary})` : baseName;
}

function startAddToCart(item) {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  const modifierGroups = getItemModifierGroups(item);

  if (!modifierGroups.length) {
    addToCart(item);
    return;
  }

  openModifierDialog(item, modifierGroups);
}

function ensureModifierDialog() {
  if (modifierDialog) return modifierDialog;

  modifierDialog = document.createElement('div');
  modifierDialog.className = 'modifier-dialog';
  modifierDialog.setAttribute('data-modifier-dialog', '');
  modifierDialog.hidden = true;
  document.body.appendChild(modifierDialog);

  modifierDialog.addEventListener('click', event => {
    if (event.target === modifierDialog) closeModifierDialog();
  });

  return modifierDialog;
}

function closeModifierDialog() {
  if (!modifierDialog) return;

  modifierDialog.hidden = true;
  modifierDialog.classList.remove('is-open');
  modifierDialog.innerHTML = '';
  document.body.classList.remove('modifier-dialog-open');
}

function openModifierDialog(item, modifierGroups, options = {}) {
  const dialog = ensureModifierDialog();
  const submitLabel = options.submitLabel || 'Add to Order';
  const initialModifiers = Array.isArray(options.initialModifiers) ? options.initialModifiers : [];
  const initialNote = String(options.initialNote || '');

  dialog.innerHTML = `
    <div class="modifier-dialog-card" role="dialog" aria-modal="true" aria-labelledby="modifier-dialog-title">
      <div class="modifier-dialog-header">
        <div>
          <span class="menu-category-eyebrow">Item Options</span>
          <h3 id="modifier-dialog-title">${escapeHtml(getItemDisplayName(item))}</h3>
          <p>${escapeHtml(item.description || 'Choose any options for this item.')}</p>
        </div>
        <button class="modifier-dialog-close" type="button" data-modifier-close aria-label="Close item options">×</button>
      </div>

      <form class="modifier-form" data-modifier-form>
       
        ${modifierGroups.map(group => createModifierGroupMarkup(group)).join('')}

        <label class="modifier-note-label">
          <span>Special Instructions</span>
          <textarea name="itemNote" rows="2" placeholder="Optional note for this item"></textarea>
        </label>

        <p class="modifier-error" data-modifier-error hidden></p>

        <div class="modifier-dialog-footer">
          <button class="button-outline" type="button" data-modifier-cancel>Cancel</button>
          <button class="button order-button" type="submit">${escapeHtml(submitLabel)}</button>
        </div>
      </form>
    </div>
  `;

  dialog.hidden = false;
  document.body.classList.add('modifier-dialog-open');
  requestAnimationFrame(() => dialog.classList.add('is-open'));

  dialog.querySelector('[data-modifier-close]')?.addEventListener('click', closeModifierDialog);
  dialog.querySelector('[data-modifier-cancel]')?.addEventListener('click', closeModifierDialog);
  dialog.querySelector('[data-modifier-form]')?.addEventListener('submit', event => {
    event.preventDefault();

    const selected = getSelectedModifiersFromForm(event.currentTarget, modifierGroups);
    const errorNode = dialog.querySelector('[data-modifier-error]');

    if (selected.error) {
      errorNode.textContent = selected.error;
      errorNode.hidden = false;
      errorNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    if (typeof options.onSubmit === 'function') {
      options.onSubmit(selected);
    } else {
      addToCart(item, selected.modifiers, selected.note);
    }

    closeModifierDialog();
  });

  hydrateModifierDialogSelections(dialog, initialModifiers, initialNote);
  dialog.querySelector('input, textarea, button')?.focus({ preventScroll: true });
}


function hydrateModifierDialogSelections(dialog, modifiers = [], note = '') {
  modifiers.forEach(modifier => {
    if (!modifier?.id) return;

    const groupId = modifier.groupId ? cssEscape(modifier.groupId) : '';
    const modifierId = cssEscape(modifier.id);
    const selector = groupId
      ? `input[data-group-id="${groupId}"][value="${modifierId}"]`
      : `input[value="${modifierId}"]`;
    const input = dialog.querySelector(selector);

    if (input) input.checked = true;
  });

  const noteField = dialog.querySelector('textarea[name="itemNote"]');
  if (noteField) noteField.value = note;
}

function createModifierGroupMarkup(group) {
  const minRequired = Number(group.minRequired || 0);
  const maxAllowed = group.maxAllowed === null || group.maxAllowed === undefined ? 0 : Number(group.maxAllowed || 0);
  const isSingleChoice = maxAllowed === 1;
  const inputType = isSingleChoice ? 'radio' : 'checkbox';
  const requirement = minRequired > 0
    ? `Choose at least ${minRequired}`
    : 'Optional';
  const maxText = maxAllowed > 1 ? ` • up to ${maxAllowed}` : '';

  return `
    <fieldset class="modifier-group" data-modifier-group="${escapeHtml(group.id)}" data-min="${escapeHtml(minRequired)}" data-max="${escapeHtml(maxAllowed)}">
      <legend>
        <strong>${escapeHtml(group.name || 'Options')}</strong>
        <span>${escapeHtml(requirement + maxText)}</span>
      </legend>
      <div class="modifier-options">
        ${group.modifiers.map(modifier => `
          <label class="modifier-option">
            <input
              type="${inputType}"
              name="modifier-${escapeHtml(group.id)}"
              value="${escapeHtml(modifier.id)}"
              data-group-id="${escapeHtml(group.id)}"
            >
            <span>
              <strong>${escapeHtml(modifier.name)}</strong>
              ${Number(modifier.price || 0) ? `<em>+${formatMoney(modifier.price)}</em>` : ''}
            </span>
          </label>
        `).join('')}
      </div>
    </fieldset>
  `;
}

function getSelectedModifiersFromForm(form, modifierGroups) {
  const selectedModifiers = [];

  for (const group of modifierGroups) {
    const checkedInputs = Array.from(form.querySelectorAll(`input[data-group-id="${cssEscape(group.id)}"]:checked`));
    const minRequired = Number(group.minRequired || 0);
    const maxAllowed = group.maxAllowed === null || group.maxAllowed === undefined ? 0 : Number(group.maxAllowed || 0);

    if (checkedInputs.length < minRequired) {
      return { error: `Please choose ${minRequired} option${minRequired === 1 ? '' : 's'} for ${group.name}.` };
    }

    if (maxAllowed > 0 && checkedInputs.length > maxAllowed) {
      return { error: `Please choose no more than ${maxAllowed} option${maxAllowed === 1 ? '' : 's'} for ${group.name}.` };
    }

    checkedInputs.forEach(input => {
      const modifier = group.modifiers.find(option => option.id === input.value);
      if (!modifier) return;

      selectedModifiers.push({
        id: modifier.id,
        name: modifier.name,
        price: Number(modifier.price || 0),
        groupId: group.id,
        groupName: group.name || ''
      });
    });
  }

  return {
    modifiers: selectedModifiers,
    note: String(new FormData(form).get('itemNote') || '').trim(),
    error: ''
  };
}

function addToCart(item, modifiers = [], note = '') {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  const normalizedModifiers = Array.isArray(modifiers) ? modifiers : [];
  const normalizedNote = String(note || '').trim();
  const lineId = getCartLineKey(item.id, normalizedModifiers, normalizedNote);
  const existing = cart.find(cartItem => cartItem.lineId === lineId);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      lineId,
      id: item.id,
      name: getItemDisplayName(item),
      onlineName: item.onlineName || '',
      cloverName: item.cloverName || item.name || '',
      price: Number(item.price || 0),
      priceFormatted: item.priceFormatted,
      imageUrl: item.imageUrl || '',
      quantity: 1,
      modifiers: normalizedModifiers,
      note: normalizedNote
    });
  }

  saveCart();
  renderCart();
  showCartToast(`${getItemDisplayName(item)} added to cart`);
}


function findMenuItemById(itemId) {
  if (!menuData?.categories?.length || !itemId) return null;

  for (const category of menuData.categories) {
    const match = (Array.isArray(category.items) ? category.items : []).find(item => item.id === itemId);
    if (match) return match;
  }

  return null;
}

function getCartSourceItem(cartItem) {
  const menuItem = findMenuItemById(cartItem?.id);

  if (!menuItem) return cartItem;

  return {
    ...menuItem,
    name: menuItem.name || cartItem.name,
    onlineName: menuItem.onlineName || cartItem.onlineName || '',
    cloverName: menuItem.cloverName || cartItem.cloverName || cartItem.name || '',
    price: Number(menuItem.price ?? cartItem.price ?? 0),
    priceFormatted: menuItem.priceFormatted || cartItem.priceFormatted || formatMoney(cartItem.price)
  };
}

function canCustomizeCartItem(cartItem) {
  const sourceItem = getCartSourceItem(cartItem);
  return getItemModifierGroups(sourceItem).length > 0;
}

function startEditCartItem(lineId) {
  if (!orderingAvailable) return;

  const cartItem = cart.find(item => (item.lineId || item.id) === lineId);
  if (!cartItem) return;

  const sourceItem = getCartSourceItem(cartItem);
  const modifierGroups = getItemModifierGroups(sourceItem);

  if (!modifierGroups.length) return;

  openModifierDialog(sourceItem, modifierGroups, {
    submitLabel: 'Update Order',
    initialModifiers: cartItem.modifiers || [],
    initialNote: cartItem.note || '',
    onSubmit: selected => updateCartItemOptions(lineId, sourceItem, selected.modifiers, selected.note)
  });
}

function updateCartItemOptions(lineId, sourceItem, modifiers = [], note = '') {
  const currentIndex = cart.findIndex(item => (item.lineId || item.id) === lineId);
  if (currentIndex < 0) return;

  const currentItem = cart[currentIndex];
  const normalizedModifiers = Array.isArray(modifiers) ? modifiers : [];
  const normalizedNote = String(note || '').trim();
  const nextLineId = getCartLineKey(currentItem.id, normalizedModifiers, normalizedNote);

  const existingIndex = cart.findIndex((item, index) =>
    index !== currentIndex && (item.lineId || item.id) === nextLineId
  );

  if (existingIndex >= 0) {
    cart[existingIndex].quantity += currentItem.quantity;
    cart.splice(currentIndex, 1);
  } else {
    cart[currentIndex] = {
      ...currentItem,
      lineId: nextLineId,
      name: getItemDisplayName(sourceItem) || currentItem.name,
      onlineName: sourceItem.onlineName || currentItem.onlineName || '',
      cloverName: sourceItem.cloverName || currentItem.cloverName || currentItem.name || '',
      price: Number(sourceItem.price ?? currentItem.price ?? 0),
      priceFormatted: sourceItem.priceFormatted || currentItem.priceFormatted,
      imageUrl: sourceItem.imageUrl || currentItem.imageUrl || '',
      modifiers: normalizedModifiers,
      note: normalizedNote
    };
  }

  saveCart();
  renderCart();
  showCartToast(`${getItemDisplayName(sourceItem) || currentItem.name} updated`);
}

function updateQuantity(lineId, quantity) {
  if (!orderingAvailable) return;

  cart = cart
    .map(item => item.lineId === lineId ? { ...item, quantity } : item)
    .filter(item => item.quantity > 0);

  saveCart();
  renderCart();
}

function removeFromCart(lineId) {
  cart = cart.filter(item => item.lineId !== lineId);
  saveCart();
  renderCart();
}


function loadSavedCart() {
  try {
    const saved = window.localStorage?.getItem(CART_STORAGE_KEY);
    if (!saved) return [];

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item && item.id && item.name && Number(item.quantity) > 0)
      .map(item => ({
        ...item,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
        note: String(item.note || ''),
        lineId: item.lineId || getCartLineKey(item.id, item.modifiers || [], item.note || '')
      }));
  } catch (error) {
    console.warn('Unable to restore saved cart', error);
    return [];
  }
}

function saveCart() {
  try {
    if (!window.localStorage) return;

    if (!cart.length) {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch (error) {
    console.warn('Unable to save cart', error);
  }
}

function clearSavedCart() {
  cart = [];
  try {
    window.localStorage?.removeItem(CART_STORAGE_KEY);
  } catch (error) {
    console.warn('Unable to clear saved cart', error);
  }
}

function getCartSubtotal() {
  return cart.reduce((total, item) => total + getCartItemUnitPrice(item) * item.quantity, 0);
}

function getCheckoutTotalsFromOrderResult(result) {
  const subtotal = getCartSubtotal();
  const rawTotals = result?.checkoutTotals || {};
  const cloverOrder = result?.cloverOrder || {};
  const cloverTotal = Number(rawTotals.total || cloverOrder.total || 0);
  const total = cloverTotal > 0 ? cloverTotal : subtotal;
  const tax = Math.max(0, Number(rawTotals.tax ?? (total - subtotal)) || 0);

  return {
    subtotal,
    tax,
    total
  };
}

function normalizeCheckoutTotals(value) {
  if (typeof value === 'number') {
    return {
      subtotal: value,
      tax: 0,
      total: value
    };
  }

  const subtotal = Number(value?.subtotal || 0);
  const total = Number(value?.total || subtotal);
  const tax = Math.max(0, Number(value?.tax ?? (total - subtotal)) || 0);

  return {
    subtotal,
    tax,
    total
  };
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
            <strong>${escapeHtml(getItemDisplayName(item))}</strong>
            ${item.modifiers?.length ? `<span class="cart-modifiers">${escapeHtml(getModifierSummary(item.modifiers))}</span>` : ''}
            ${item.note ? `<span class="cart-modifiers">Note: ${escapeHtml(item.note)}</span>` : ''}
            <span>${formatMoney(getCartItemUnitPrice(item))} each</span>
          </div>

          <div class="cart-controls">
            <button type="button" data-decrease="${escapeHtml(item.lineId || item.id)}" aria-label="Decrease ${escapeHtml(getCartItemDisplayName(item))}">-</button>
            <span>${item.quantity}</span>
            <button type="button" data-increase="${escapeHtml(item.lineId || item.id)}" aria-label="Increase ${escapeHtml(getCartItemDisplayName(item))}">+</button>
          </div>

          <div class="cart-line-total">
            ${formatMoney(getCartItemUnitPrice(item) * item.quantity)}
          </div>

          <div class="cart-item-actions">
            ${canCustomizeCartItem(item) ? `
              <button class="cart-customize" type="button" data-customize="${escapeHtml(item.lineId || item.id)}">
                Customize
              </button>
            ` : ''}
            <button class="cart-remove" type="button" data-remove="${escapeHtml(item.lineId || item.id)}">
              Remove
            </button>
          </div>
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
      const item = cart.find(i => (i.lineId || i.id) === btn.dataset.increase);
      if (item) updateQuantity(item.lineId || item.id, item.quantity + 1);
    });
  });

  cartPanel.querySelectorAll('[data-decrease]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = cart.find(i => (i.lineId || i.id) === btn.dataset.decrease);
      if (item) updateQuantity(item.lineId || item.id, item.quantity - 1);
    });
  });

  cartPanel.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.remove));
  });

  cartPanel.querySelectorAll('[data-customize]').forEach(btn => {
    btn.addEventListener('click', () => startEditCartItem(btn.dataset.customize));
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
              <span>${escapeHtml(getCartItemDisplayName(item))}</span>
              <strong>${item.quantity} × ${formatMoney(getCartItemUnitPrice(item))}</strong>
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

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value || ''));
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '\\$&');
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


async function fetchOrderFulfillment(orderId) {
  if (!orderId) return null;

  try {
    const response = await fetch(`${ORDER_FULFILLMENT_ENDPOINT}?orderId=${encodeURIComponent(orderId)}`);
    const result = await response.json();

    if (!response.ok) {
      console.warn('Pickup estimate unavailable', result);
      return null;
    }

    return result;
  } catch (error) {
    console.warn('Pickup estimate request failed', error);
    return null;
  }
}

function getConfiguredPickupPrepMinutes() {
  const cfg = window.VICTORS_CONFIG || {};
  const value = Number(cfg.pickupPrepMinutes || cfg.pickupEstimateMinutes || 0);
  return Number.isFinite(value) && value > 0 ? value : 15;
}

function getEstimatedReadyAtFromFallback() {
  const prepMinutes = getConfiguredPickupPrepMinutes();
  return new Date(Date.now() + prepMinutes * 60 * 1000).toISOString();
}

function resolvePickupEstimate(fulfillment = null) {
  const cfg = window.VICTORS_CONFIG || {};
  const fallbackEnabled = cfg.pickupEstimateFallbackEnabled !== false;

  const timestamp = Number(
    fulfillment?.pickupTime ||
    fulfillment?.cloverFulfillmentTime ||
    fulfillment?.clientCreatedTime ||
    0
  );

  if (Number.isFinite(timestamp) && timestamp > 0) {
    return {
      source: fulfillment?.source || 'clover',
      readyAt: new Date(timestamp).toISOString(),
      label: 'Ready for pickup around'
    };
  }

  if (!fallbackEnabled) return null;

  return {
    source: 'estimated',
    readyAt: getEstimatedReadyAtFromFallback(),
    label: 'Estimated pickup around'
  };
}

function formatPickupTime(isoDate) {
  if (!isoDate) return '';

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit'
  });
}

function createPickupEstimateMarkup(estimate) {
  if (!estimate?.readyAt) {
    return `
      <div class="pickup-estimate pickup-estimate-muted">
        <span>Pickup</span>
        <strong>We will confirm your pickup time after payment.</strong>
      </div>
    `;
  }

  const time = formatPickupTime(estimate.readyAt);
  const sourceText = estimate.source === 'clover'
    ? 'Timing provided by Victor’s ordering system.'
    : 'Estimated timing based on Victor’s current pickup window.';

 return `
  <div class="pickup-estimate">
    <strong>${escapeHtml(time ? `${estimate.label || 'Estimated pickup around'} ${time}` : 'Pickup time will be confirmed after payment.')}</strong>
  </div>
`;
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
        Continue to Payment
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
      submitButton.textContent = 'Preparing Payment...';

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

      submitButton.textContent = 'Checking pickup time...';

      const fulfillment = await fetchOrderFulfillment(result.orderId);
      const pickupEstimate = resolvePickupEstimate(fulfillment);

      const checkoutTotals = getCheckoutTotalsFromOrderResult(result);

      renderPayment(result.orderId, checkoutTotals, pickupEstimate);
    } catch (error) {
      alert(error.message);
      renderCart();
    }
  });
}

function renderPayment(orderId, amount, pickupEstimate = null) {
  if (!orderingAvailable) {
    renderCart();
    return;
  }

  const totals = normalizeCheckoutTotals(amount);
  const cfg = window.VICTORS_CONFIG || {};

  cartPanel.innerHTML = `
    <h3>Payment</h3>
    ${createPickupEstimateMarkup(pickupEstimate)}
    <p class="checkout-order-id">Order ID: <strong>${escapeHtml(orderId)}</strong></p>

    <div class="cart-summary">
      <div><span>Subtotal</span><strong>${formatMoney(totals.subtotal)}</strong></div>
      <div><span>Estimated Tax</span><strong>${formatMoney(totals.tax)}</strong></div>
      <div><span>Total due</span><strong>${formatMoney(totals.total)}</strong></div>
    </div>

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
        Pay ${formatMoney(totals.total)}
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
        amount: Number(totals.total)
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

      clearSavedCart();

      cartPanel.innerHTML = `
        <h3>Payment Received</h3>
        <p>Thank you! Your order has been paid successfully.</p>
        ${createPickupEstimateMarkup(pickupEstimate)}
        <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      `;
      renderMobileCartDock();
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
      button.textContent = `Pay ${formatMoney(totals.total)}`;
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
  if (event.key === 'Escape') {
    toggleMoreCategories(false, true);
    closeModifierDialog();
  }
});

if (typeof navModeMedia.addEventListener === 'function') {
  navModeMedia.addEventListener('change', refreshTimeSensitiveMenu);
} else if (typeof navModeMedia.addListener === 'function') {
  navModeMedia.addListener(refreshTimeSensitiveMenu);
}

window.addEventListener('scroll', requestMobileScrollSpyUpdate, { passive: true });
window.addEventListener('resize', requestMobileScrollSpyUpdate);

setInterval(refreshTimeSensitiveMenu, 60000);

loadMenu();
