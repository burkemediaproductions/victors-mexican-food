const MENU_ENDPOINT = '/.netlify/functions/menu';

const categoryContainer = document.querySelector('[data-menu-categories]');
const itemsContainer = document.querySelector('[data-menu-items]');
const cartPanel = document.querySelector('[data-cart-panel]');

let menuData = null;
let cart = [];

async function loadMenu() {
  try {
    const res = await fetch(MENU_ENDPOINT);
    const data = await res.json();

    menuData = data;

    renderCategories(data.categories);
    renderItems(data.categories[0]);
    renderCart();
  } catch (err) {
    console.error('Menu load failed', err);
    itemsContainer.innerHTML = '<p>Menu is temporarily unavailable. Please try again soon.</p>';
  }
}

function renderCategories(categories) {
  categoryContainer.innerHTML = '';

  categories.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'menu-tab';
    btn.textContent = cat.name;

    if (index === 0) btn.classList.add('active');

    btn.addEventListener('click', () => {
      document.querySelectorAll('.menu-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderItems(cat);
    });

    categoryContainer.appendChild(btn);
  });
}

function renderItems(category) {
  itemsContainer.innerHTML = '';

  category.items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'menu-item-card';

    card.innerHTML = `
      <div>
        <h3>${escapeHtml(item.name)}</h3>
        ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ''}
      </div>
      <div class="menu-item-card-footer">
        <strong>${item.priceFormatted}</strong>
        <button class="button order-button" type="button" data-add-item="${item.id}">
          Add
        </button>
      </div>
    `;

    card.querySelector('[data-add-item]').addEventListener('click', () => addToCart(item));
    itemsContainer.appendChild(card);
  });
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
            <button type="button" data-decrease="${item.id}" aria-label="Decrease ${escapeHtml(item.name)}">−</button>
            <span>${item.quantity}</span>
            <button type="button" data-increase="${item.id}" aria-label="Increase ${escapeHtml(item.name)}">+</button>
          </div>

          <div class="cart-line-total">
            ${formatMoney(item.price * item.quantity)}
          </div>

          <button class="cart-remove" type="button" data-remove="${item.id}">
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

loadMenu();


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
        Review Order
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
        alert('Payment iframe is next.');
    });
    } catch (error) {
    alert(error.message);
    }
  });
}