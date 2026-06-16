#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getCloverMenu } = require('../netlify/functions/menu-data');

const ROOT = path.resolve(__dirname, '..');
const EN_MENU_PATH = path.join(ROOT, 'menu', 'index.html');
const ES_MENU_PATH = path.join(ROOT, 'es', 'menu', 'index.html');
const SNAPSHOT_START = '<!-- STATIC_MENU_SEO_START -->';
const SNAPSHOT_END = '<!-- STATIC_MENU_SEO_END -->';
const SCHEMA_START = '<!-- MENU_SCHEMA_START -->';
const SCHEMA_END = '<!-- MENU_SCHEMA_END -->';

const SETTINGS = {
  en: {
    lang: 'en',
    pageUrl: 'https://victorsmexicanfood.com/menu/',
    heading: "Current Victor's Mexican Food menu snapshot",
    eyebrow: 'Clover menu snapshot',
    intro: "This crawlable menu snapshot is generated from Victor's Clover menu and refreshed during site builds. For live availability, customizations, and ordering, use the online ordering menu on this page.",
    emptyHeading: 'Menu snapshot pending',
    emptyText: "The live Clover menu remains available below. This static SEO snapshot will populate automatically on Netlify when Clover credentials are available during the build.",
    pricePrefix: '',
    sectionClass: 'section white static-menu-seo divider',
    updatedLabel: 'Last Clover sync',
    noDescription: 'Fresh Mexican food prepared by Victor’s Mexican Food in Palm Desert.',
    fallbackCategory: 'Menu Items'
  },
  es: {
    lang: 'es',
    pageUrl: 'https://victorsmexicanfood.com/es/menu/',
    heading: 'Resumen actual del menú de Victor’s Mexican Food',
    eyebrow: 'Resumen del menú de Clover',
    intro: 'Este resumen rastreable del menú se genera desde el menú de Clover de Victor’s y se actualiza durante las compilaciones del sitio. Para disponibilidad en vivo, personalizaciones y pedidos, usa el menú de pedidos en línea en esta página.',
    emptyHeading: 'Resumen del menú pendiente',
    emptyText: 'El menú en vivo de Clover sigue disponible abajo. Este resumen estático para SEO se completará automáticamente en Netlify cuando las credenciales de Clover estén disponibles durante la compilación.',
    pricePrefix: '',
    sectionClass: 'section white static-menu-seo divider',
    updatedLabel: 'Última sincronización de Clover',
    noDescription: 'Comida mexicana fresca preparada por Victor’s Mexican Food en Palm Desert.',
    fallbackCategory: 'Artículos del menú'
  }
};

main().catch((error) => {
  console.error('[static-menu] Unexpected failure:', error);
  process.exitCode = 1;
});

async function main() {
  const menu = await loadMenuSafely();

  updateMenuPage(EN_MENU_PATH, menu, SETTINGS.en);
  updateMenuPage(ES_MENU_PATH, menu, SETTINGS.es);

  if (menu?.categories?.length) {
    const itemCount = menu.categories.reduce((total, category) => total + category.items.length, 0);
    console.log(`[static-menu] Generated static menu snapshots for ${menu.categories.length} categories and ${itemCount} items.`);
  } else {
    console.log('[static-menu] Clover credentials unavailable or menu empty. Marker sections were added with fallback copy.');
  }
}

async function loadMenuSafely() {
  if (!process.env.CLOVER_MERCHANT_ID || !process.env.CLOVER_ACCESS_TOKEN) {
    return null;
  }

  try {
    return await getCloverMenu();
  } catch (error) {
    console.warn('[static-menu] Could not fetch Clover menu:', error.message);
    return null;
  }
}

function updateMenuPage(filePath, menu, options) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[static-menu] Skipping missing page: ${path.relative(ROOT, filePath)}`);
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');
  const snapshot = renderStaticMenuSection(menu, options);
  const schema = renderMenuSchema(menu, options);

  html = replaceOrInsertBlock(
    html,
    SNAPSHOT_START,
    SNAPSHOT_END,
    snapshot,
    '<section class="section soft divider" id="ordering">'
  );

  html = replaceOrInsertBlock(
    html,
    SCHEMA_START,
    SCHEMA_END,
    schema,
    '</head>'
  );

  fs.writeFileSync(filePath, html);
}

function replaceOrInsertBlock(html, startMarker, endMarker, replacement, beforeNeedle) {
  const block = `${startMarker}\n${replacement}\n${endMarker}`;
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);

  if (start !== -1 && end !== -1 && end > start) {
    return html.slice(0, start) + block + html.slice(end + endMarker.length);
  }

  const insertAt = html.indexOf(beforeNeedle);
  if (insertAt === -1) {
    return `${html}\n${block}\n`;
  }

  return html.slice(0, insertAt) + `${block}\n` + html.slice(insertAt);
}

function renderStaticMenuSection(menu, options) {
  if (!menu?.categories?.length) {
    return `<section class="${options.sectionClass}" aria-labelledby="static-menu-heading">
<div class="container">
<div class="section-top" data-reveal="">
<div><span class="eyebrow">${escapeHtml(options.eyebrow)}</span><h2 class="section-title" id="static-menu-heading">${escapeHtml(options.emptyHeading)}</h2></div>
<p class="section-intro">${escapeHtml(options.emptyText)}</p>
</div>
</div>
</section>`;
  }

  const updatedAt = menu.updatedAt ? formatDate(menu.updatedAt, options.lang) : '';
  const categoryHtml = menu.categories.map((category) => renderCategory(category, options)).join('\n');
  const updatedHtml = updatedAt ? `<p class="static-menu-updated"><strong>${escapeHtml(options.updatedLabel)}:</strong> ${escapeHtml(updatedAt)}</p>` : '';

  return `<section class="${options.sectionClass}" aria-labelledby="static-menu-heading">
<div class="container">
<div class="section-top" data-reveal="">
<div><span class="eyebrow">${escapeHtml(options.eyebrow)}</span><h2 class="section-title" id="static-menu-heading">${escapeHtml(options.heading)}</h2></div>
<p class="section-intro">${escapeHtml(options.intro)}</p>
</div>
${updatedHtml}
<div class="static-menu-sections" data-reveal="">
${categoryHtml}
</div>
</div>
</section>`;
}

function renderCategory(category, options) {
  const items = Array.isArray(category.items) ? category.items : [];
  if (!items.length) return '';

  return `<section class="static-menu-category" aria-labelledby="static-menu-category-${escapeAttribute(slugify(category.name || options.fallbackCategory))}">
<h3 id="static-menu-category-${escapeAttribute(slugify(category.name || options.fallbackCategory))}">${escapeHtml(category.name || options.fallbackCategory)}</h3>
<div class="grid-3 static-menu-grid">
${items.map((item) => renderItem(item, options)).join('\n')}
</div>
</section>`;
}

function renderItem(item, options) {
  const description = cleanText(item.description) || options.noDescription;
  const price = formatPrice(item.price);
  const priceHtml = price ? `<p class="menu-item-price">${escapeHtml(price)}</p>` : '';

  return `<article class="card static-menu-item">
<h4>${escapeHtml(item.name || 'Menu item')}</h4>
<p>${escapeHtml(description)}</p>
${priceHtml}
</article>`;
}

function renderMenuSchema(menu, options) {
  if (!menu?.categories?.length) return '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${options.pageUrl}#menu`,
    name: options.lang === 'es' ? "Menú de Victor's Mexican Food" : "Victor's Mexican Food Menu",
    url: options.pageUrl,
    inLanguage: options.lang === 'es' ? 'es-US' : 'en-US',
    provider: {
      '@id': 'https://victorsmexicanfood.com/#restaurant'
    },
    hasMenuSection: menu.categories
      .filter((category) => Array.isArray(category.items) && category.items.length)
      .map((category) => ({
        '@type': 'MenuSection',
        name: category.name || options.fallbackCategory,
        hasMenuItem: category.items.map((item) => menuItemToSchema(item, options))
      }))
  };

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2).replace(/<\//g, '<\\/')}</script>`;
}

function menuItemToSchema(item, options) {
  const schema = {
    '@type': 'MenuItem',
    name: item.name || 'Menu item'
  };

  const description = cleanText(item.description);
  if (description) schema.description = description;

  const price = formatSchemaPrice(item.price);
  if (price) {
    schema.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: 'USD',
      availability: 'https://schema.org/InStock'
    };
  }

  return schema;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function formatPrice(cents) {
  const value = Number(cents || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return `$${(value / 100).toFixed(2)}`;
}

function formatSchemaPrice(cents) {
  const value = Number(cents || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  return (value / 100).toFixed(2);
}

function formatDate(value, lang) {
  try {
    return new Intl.DateTimeFormat(lang === 'es' ? 'es-US' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'America/Los_Angeles',
      timeZoneName: 'short'
    }).format(new Date(value));
  } catch (_error) {
    return value;
  }
}

function slugify(value) {
  return String(value || 'menu')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'menu';
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, '&#96;');
}
