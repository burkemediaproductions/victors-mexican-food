const MENU_ENDPOINT = '/.netlify/functions/menu';

const categoryContainer = document.querySelector('[data-menu-categories]');
const itemsContainer = document.querySelector('[data-menu-items]');

let menuData = null;

async function loadMenu() {
  try {
    const res = await fetch(MENU_ENDPOINT);
    const data = await res.json();

    menuData = data;

    renderCategories(data.categories);
    renderItems(data.categories[0]); // default first category
  } catch (err) {
    console.error('Menu load failed', err);
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
    const card = document.createElement('div');
    card.className = 'menu-item-card';

    card.innerHTML = `
      <h3>${item.name}</h3>
      <p>${item.description || ''}</p>
      <strong>${item.priceFormatted}</strong>
      <button class="button order-button">Add</button>
    `;

    itemsContainer.appendChild(card);
  });
}

loadMenu();