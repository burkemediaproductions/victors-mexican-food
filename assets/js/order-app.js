const MENU_ENDPOINT = '/.netlify/functions/menu';

const categoryContainer = document.querySelector('[data-menu-categories]');
const itemsContainer = document.querySelector('[data-menu-items]');
const cartPanel = document.querySelector('[data-cart-panel]');

let menuData = null;
let cart = [];
let activeCategoryIndex = 0;
let searchTerm = '';
let featuredCategoryIndexes = [];

const FEATURED_CATEGORY_NAMES = [
  'breakfast burritos',
  'breakfast plates',
  'burritos',
  'soft tacos',
  'combination plates',
  'quesadillas',
  'drinks'
];

async function loadMenu() {
  if (!categoryContainer || !itemsContainer) return;

  try {
    const res = await fetch(MENU_ENDPOINT);
    const data = await res.json();

    menuData = {
      ...data,
      categories: Array.isArray(data.categories) ? data.categories : []
    };

    if (!menuData.categories.length) {
      categoryContainer.innerHTML = '';
      itemsContainer.innerHTML = '<p class="menu-empty">Menu is temporarily unavailable. Please try again soon.</p>';
      renderCart();
      return;
    }

    activeCategoryIndex = 0;
    searchTerm = '';

    renderCategories();
    renderItems(menuData.categories[activeCategoryIndex]);
    renderCart();
  } catch (err) {
    console.error('Menu load failed', err);
    itemsContainer.innerHTML = '<p class="menu-empty">Menu is temporarily unavailable. Please try again soon.</p>';
  }
}

function normalizeCategoryName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function getFeaturedCategoryIndexes(categories) {
  const selected = [];
  const normalizedNames = categories.map(cat => normalizeCategoryName(cat.name));

  FEATURED_CATEGORY_NAMES.forEach(featuredName => {
    const target = normalizeCategoryName(featuredName);
    const exactIndex = normalizedNames.findIndex((name, index) => name === target && !selected.includes(index));
    const includesIndex = normalizedNames.findIndex((name, index) => name.includes(target) && !selected.includes(index));
    const index = exactIndex >= 0 ? exactIndex : includesIndex;

    if (index >= 0) selected.push(index);
  });

  categories.forEach((cat, index) => {
    if (selected.length >= 7) return;
    if (!selected.includes(index)) selected.push(index);
  });

  return selected;
}

function renderCategories() {
  if (!categoryContainer || !menuData?.categories?.length) return;

  const categories = menuData.categories;
  featuredCategoryIndexes = getFeaturedCategoryIndexes(categories);
  const moreCategoryIndexes = categories
    .map((_, index) => index)
    .filter(index => !featuredCategoryIndexes.includes(index));
  const activeIsInMore = !searchTerm && moreCategoryIndexes.includes(activeCategoryIndex);

  categoryContainer.innerHTML = '';

  const nav = document.createElement('div');
  nav.className = 'menu-category-nav';
  nav.setAttribute('data-menu-category-nav', '');

  const header = document.createElement('div');
  header.className = 'menu-category-header';
  header.innerHTML = `
    <span class="menu-category-eyebrow">Order Online</span>
    <strong>Menu Categories</strong>
  `;

  const searchLabel = document.createElement('label');
  searchLabel.className = 'menu-search-label';
  searchLabel.innerHTML = `
    <span class="sr-only">Search menu</span>
    <input class="menu-search-input" data-menu-search type="search" placeholder="Search menu..." autocomplete="off" value="${escapeHtml(searchTerm)}">
  `;

  const quickLabel = document.createElement('div');
  quickLabel.className = 'menu-category-label';
  quickLabel.textContent = 'Quick picks';

  const featuredBar = document.createElement('div');
  featuredBar.className = 'menu-category-bar';
  featuredBar.setAttribute('data-featured-categories', '');

  featuredCategoryIndexes.forEach(index => {
    featuredBar.appendChild(createCategoryButton(categories[index], index));
  });

  let moreWrap = null;

  if (moreCategoryIndexes.length) {
    const moreToggle = document.createElement('button');
    moreToggle.className = 'menu-more-toggle';
    moreToggle.type = 'button';
    moreToggle.setAttribute('data-menu-more-toggle', '');
    moreToggle.setAttribute('aria-expanded', 'false');
    moreToggle.setAttribute('aria-controls', 'menu-category-more-panel');

    const moreText = document.createElement('span');
    moreText.textContent = activeIsInMore ? categories[activeCategoryIndex].name : 'More Categories';

    const moreIcon = document.createElement('span');
    moreIcon.setAttribute('aria-hidden', 'true');
    moreIcon.textContent = 'v';

    moreToggle.append(moreText, moreIcon);

    if (activeIsInMore) moreToggle.classList.add('active');

    featuredBar.appendChild(moreToggle);

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
      moreGrid.appendChild(createCategoryButton(categories[index], index, 'menu-tab-more'));
    });

    morePanel.append(moreHeader, moreGrid);
    moreWrap.appendChild(morePanel);
  }

  nav.append(header, searchLabel, quickLabel, featuredBar);
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

  const moreToggle = categoryContainer.querySelector('[data-menu-more-toggle]');
  moreToggle?.addEventListener('click', () => {
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

  activeCategoryIndex = index;
  searchTerm = '';

  renderCategories();
  renderItems(menuData.categories[activeCategoryIndex]);
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
    const moreIndexes = menuData.categories
      .map((_, index) => index)
      .filter(index => !featuredCategoryIndexes.includes(index));

    moreToggle.classList.toggle('active', !hasSearch && moreIndexes.includes(activeCategoryIndex));
  }
}

function renderItems(category) {
  if (!itemsContainer || !category) return;

  itemsContainer.innerHTML = '';
  itemsContainer.appendChild(createResultsHeading('Menu Category', category.name));

  const items = Array.isArray(category.items) ? category.items : [];

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

  menuData.categories.forEach(category => {
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
  card.className = 'menu-item-card';

  card.innerHTML = `
    <div>
      ${categoryName ? `<span class="menu-item-category">${escapeHtml(categoryName)}</span>` : ''}
      <h3>${escapeHtml(item.name)}</h3>
      ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
    </div>
    <div class="menu-item-card-footer">
      <strong>${escapeHtml(item.priceFormatted || formatMoney(item.price))}</strong>
      <button class="button order-button" type="button" data-add-item>
        Add
      </button>
    </div>
  `;

  card.querySelector('[data-add-item]').addEventListener('click', () => addToCart(item));
  return card;
}

function addToCart(item) {
  const existing = cart.find(cartItem => cartItem.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price || 0,
      priceFormatted: item.priceFormatted,
      quantity: 1
    });
  }

  renderCart();
}

function updateQuantity(itemId, quantity) {
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

  if (!cart.length) {
    cartPanel.innerHTML = `
      <h3>Your Order</h3>
      <p class="cart-empty">Your cart is empty. Add an item to get started.</p>
    `;
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
  });
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

  cartPanel.querySelector('[data-checkout-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();

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
    }
  });
}

let cloverPayment = null;

function renderPayment(orderId, amount) {
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
    } catch (error) {
      status.textContent = error.message;
      button.disabled = false;
      button.textContent = `Pay ${formatMoney(amount)}`;
    }
  });
}

document.addEventListener('click', event => {
  if (!categoryContainer || categoryContainer.contains(event.target)) return;
  toggleMoreCategories(false);
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') toggleMoreCategories(false, true);
});

loadMenu();
