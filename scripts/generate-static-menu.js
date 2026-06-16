#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { getCloverMenu } = require('../netlify/functions/menu-data');

const ROOT = path.resolve(__dirname, '..');
const EN_MENU_PATH = path.join(ROOT, 'menu', 'index.html');
const ES_MENU_PATH = path.join(ROOT, 'es', 'menu', 'index.html');
const EN_STATIC_MENU_PATH = path.join(ROOT, 'full-menu', 'index.html');
const ES_STATIC_MENU_PATH = path.join(ROOT, 'es', 'menu-completo', 'index.html');

const SNAPSHOT_START = '<!-- STATIC_MENU_SEO_START -->';
const SNAPSHOT_END = '<!-- STATIC_MENU_SEO_END -->';
const SCHEMA_START = '<!-- MENU_SCHEMA_START -->';
const SCHEMA_END = '<!-- MENU_SCHEMA_END -->';

const SETTINGS = {
  en: {
    lang: 'en',
    liveMenuUrl: 'https://victorsmexicanfood.com/menu/',
    staticMenuUrl: 'https://victorsmexicanfood.com/full-menu/',
    liveMenuPath: '/menu/',
    staticMenuPath: '/full-menu/',
    staticTitle: "Full Menu | Victor's Mexican Food",
    staticDescription: "Browse Victor's Mexican Food menu in Palm Desert, including tacos, burritos, breakfast favorites, combination plates, drinks, and house favorites.",
    staticHeading: "Victor's Mexican Food Full Menu",
    staticEyebrow: 'Full menu',
    staticIntro: "Browse a simple, easy-to-read version of Victor's Mexican Food menu. For current availability, customizations, and online ordering, use the online ordering menu.",
    liveLinkText: 'Use live online ordering',
    emptyHeading: 'Full menu coming soon',
    emptyText: "Our full menu is being prepared for this page. You can still browse the live online ordering menu for current items and availability.",
    updatedLabel: 'Menu updated',
    noDescription: 'Fresh Mexican food prepared by Victor’s Mexican Food in Palm Desert.',
    fallbackCategory: 'Menu Items',
    schemaName: "Victor's Mexican Food Menu",
    homeLabel: 'Home',
    menuLabel: 'Menu',
    staticLabel: 'Full Menu'
  },
  es: {
    lang: 'es',
    liveMenuUrl: 'https://victorsmexicanfood.com/es/menu/',
    staticMenuUrl: 'https://victorsmexicanfood.com/es/menu-completo/',
    liveMenuPath: '/es/menu/',
    staticMenuPath: '/es/menu-completo/',
    staticTitle: "Menú completo | Victor's Mexican Food",
    staticDescription: "Explora el menú de Victor's Mexican Food en Palm Desert, incluyendo tacos, burritos, desayunos, platos combinados, bebidas y favoritos de la casa.",
    staticHeading: 'Menú completo de Victor’s Mexican Food',
    staticEyebrow: 'Menú completo',
    staticIntro: 'Explora una versión sencilla y fácil de leer del menú de Victor’s Mexican Food. Para disponibilidad actual, personalizaciones y pedidos en línea, usa el menú de pedidos en línea.',
    liveLinkText: 'Usar pedidos en línea en vivo',
    emptyHeading: 'Menú completo próximamente',
    emptyText: 'Estamos preparando el menú completo para esta página. También puedes explorar el menú de pedidos en línea para ver los artículos y la disponibilidad actuales.',
    updatedLabel: 'Menú actualizado',
    noDescription: 'Comida mexicana fresca preparada por Victor’s Mexican Food en Palm Desert.',
    fallbackCategory: 'Artículos del menú',
    schemaName: "Menú de Victor's Mexican Food",
    homeLabel: 'Inicio',
    menuLabel: 'Menú',
    staticLabel: 'Menú completo'
  }
};

main().catch((error) => {
  console.error('[static-menu] Unexpected failure:', error);
  process.exitCode = 1;
});

async function main() {
  const menu = await loadMenuSafely();

  updateLiveMenuPage(EN_MENU_PATH, menu, SETTINGS.en);
  updateLiveMenuPage(ES_MENU_PATH, menu, SETTINGS.es);
  updateStaticMenuPage(EN_STATIC_MENU_PATH, EN_MENU_PATH, menu, SETTINGS.en);
  updateStaticMenuPage(ES_STATIC_MENU_PATH, ES_MENU_PATH, menu, SETTINGS.es);

  if (menu?.categories?.length) {
    const itemCount = menu.categories.reduce((total, category) => total + category.items.length, 0);
    console.log(`[static-menu] Generated Menu schema and crawlable static pages for ${menu.categories.length} categories and ${itemCount} items.`);
  } else {
    console.log('[static-menu] Clover credentials unavailable or menu empty. Schema blocks were kept empty and static pages include fallback copy.');
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

function updateLiveMenuPage(filePath, menu, options) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[static-menu] Skipping missing live menu page: ${path.relative(ROOT, filePath)}`);
    return;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // The live /menu/ page should keep only hidden machine-readable Menu schema.
  // The large visible SEO menu snapshot now lives on /full-menu/ and /es/menu-completo/.
  html = removeMarkedBlock(html, SNAPSHOT_START, SNAPSHOT_END);
  html = replaceOrInsertBlock(html, SCHEMA_START, SCHEMA_END, renderMenuSchema(menu, options.liveMenuUrl, options), '</head>');
  html = ensureStaticMenuLink(html, options);

  fs.writeFileSync(filePath, html);
}

function updateStaticMenuPage(filePath, sourceTemplatePath, menu, options) {
  if (!fs.existsSync(sourceTemplatePath)) {
    console.warn(`[static-menu] Skipping missing static menu template source: ${path.relative(ROOT, sourceTemplatePath)}`);
    return;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  let html = fs.readFileSync(sourceTemplatePath, 'utf8');
  html = removeMarkedBlock(html, SNAPSHOT_START, SNAPSHOT_END);
  html = replaceOrInsertBlock(html, SCHEMA_START, SCHEMA_END, renderMenuSchema(menu, options.staticMenuUrl, options), '</head>');
  html = convertTemplateToStaticPage(html, menu, options);

  fs.writeFileSync(filePath, html);
}

function convertTemplateToStaticPage(html, menu, options) {
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(options.staticTitle)}</title>`);
  html = replaceMetaContent(html, 'description', options.staticDescription);
  html = replaceMetaProperty(html, 'og:title', options.staticTitle);
  html = replaceMetaProperty(html, 'og:description', options.staticDescription);
  html = replaceMetaProperty(html, 'og:url', options.staticMenuUrl);
  html = replaceMetaContent(html, 'twitter:title', options.staticTitle);
  html = replaceMetaContent(html, 'twitter:description', options.staticDescription);
  html = html.replace(/<link\s+href="https:\/\/victorsmexicanfood\.com\/[^\"]*"\s+rel="canonical"\s*\/?>(\s*)/i, `<link href="${options.staticMenuUrl}" rel="canonical"/>$1`);

  // Update copied WebPage/Breadcrumb JSON-LD from the live menu URL to the static full-menu URL.
  html = html.replace(/("@type": "WebPage",\n\s+"name": )"[^"]+"(,\n\s+"url": )"https:\/\/victorsmexicanfood\.com\/(?:es\/)?menu\/"(,\n\s+"description": )"[^"]+"/i, `$1"${escapeJsonString(options.staticTitle)}"$2"${options.staticMenuUrl}"$3"${escapeJsonString(options.staticDescription)}"`);
  html = html.replace(/"@id": "https:\/\/victorsmexicanfood\.com\/(?:es\/)?menu\/#breadcrumb"/i, `"@id": "${options.staticMenuUrl}#breadcrumb"`);
  html = html.replace(/("position": 2,\n\s+"name": )"[^"]+"(,\n\s+"item": )"https:\/\/victorsmexicanfood\.com\/(?:es\/)?menu\/"/i, `$1"${escapeJsonString(options.staticLabel)}"$2"${options.staticMenuUrl}"`);

  const hreflang = options.lang === 'es'
    ? `<link href="https://victorsmexicanfood.com/full-menu/" hreflang="en" rel="alternate"/><link href="https://victorsmexicanfood.com/es/menu-completo/" hreflang="es" rel="alternate"/><link href="https://victorsmexicanfood.com/full-menu/" hreflang="x-default" rel="alternate"/>`
    : `<link href="https://victorsmexicanfood.com/full-menu/" hreflang="en" rel="alternate"/><link href="https://victorsmexicanfood.com/es/menu-completo/" hreflang="es" rel="alternate"/><link href="https://victorsmexicanfood.com/full-menu/" hreflang="x-default" rel="alternate"/>`;
  html = html.replace(/<link\s+href="https:\/\/victorsmexicanfood\.com\/[^\"]*"\s+hreflang="en"\s+rel="alternate"\s*\/?><link\s+href="https:\/\/victorsmexicanfood\.com\/[^\"]*"\s+hreflang="es"\s+rel="alternate"\s*\/?><link\s+href="https:\/\/victorsmexicanfood\.com\/[^\"]*"\s+hreflang="x-default"\s+rel="alternate"\s*\/?>/i, hreflang);

  html = html.replace(/<p><a class="text-link" href="\/full-menu\/">View crawlable menu<\/a><\/p>\s*/i, "");
  html = html.replace(/<p><a class="text-link" href="\/es\/menu-completo\/">Ver menú rastreable<\/a><\/p>\s*/i, "");

  const snapshot = renderStaticMenuSection(menu, options);
  const liveOrderingSection = /<section class="section soft divider" id="ordering">[\s\S]*?<\/section>\s*(?=<\/main>)/i;
  if (liveOrderingSection.test(html)) {
    html = html.replace(liveOrderingSection, snapshot);
  } else {
    html = replaceOrInsertBlock(html, SNAPSHOT_START, SNAPSHOT_END, snapshot, '</main>');
  }

  html = html.replace(/<h1>(.*?)<\/h1>/i, `<h1>${escapeHtml(options.staticHeading)}</h1>`);
  html = html.replace(/<p class="hero-copy">[\s\S]*?<\/p>/i, `<p class="hero-copy">${escapeHtml(options.staticIntro)}</p>`);
  html = html.replace(/<a class="button red-button" href="#ordering">.*?<\/a>/i, `<a class="button red-button" href="${options.liveMenuPath}#ordering">${escapeHtml(options.liveLinkText)}</a>`);
  html = html.replace(/<a class="button ghost-button" href="\/visit\/">(.*?)<\/a>/i, `<a class="button ghost-button" href="${options.liveMenuPath}">${escapeHtml(options.menuLabel)}</a>`);

  return html;
}

function ensureStaticMenuLink(html, options) {
  const linkText = options.lang === 'es' ? 'Explora Nuestro Menú' : 'Browse Our Menu';
  const href = options.staticMenuPath;

  // Remove older wording/placement from previous revisions.
  html = html.replace(/<p><a class="text-link" href="\/full-menu\/">View crawlable menu<\/a><\/p>\s*/i, '');
  html = html.replace(/<p><a class="text-link" href="\/es\/menu-completo\/">Ver menú rastreable<\/a><\/p>\s*/i, '');
  html = html.replace(/<p class="menu-static-link"><a class="text-link" href="[^"]+">(?:Browse Our Menu|Explora Nuestro Menú)<\/a><\/p>\s*/i, '');

  const linkHtml = `<p class="menu-static-link"><a class="text-link" href="${href}">${escapeHtml(linkText)}</a></p>`;

  // Place the link near the bottom of the live menu/ordering area so it is useful but not distracting.
  const orderShellEnd = /(<\/div>\s*<\/div>\s*<\/section>\s*<\/main>)/i;
  if (orderShellEnd.test(html)) {
    return html.replace(orderShellEnd, `${linkHtml}\n$1`);
  }

  const orderSectionEnd = /(<\/section>\s*<\/main>)/i;
  if (orderSectionEnd.test(html)) {
    return html.replace(orderSectionEnd, `${linkHtml}\n$1`);
  }

  return html;
}

function replaceMetaContent(html, name, content) {
  const re = new RegExp(`<meta\\s+content="[^"]*"\\s+name="${escapeRegex(name)}"\\s*\\/?>`, 'i');
  return html.replace(re, `<meta content="${escapeAttribute(content)}" name="${name}"/>`);
}

function replaceMetaProperty(html, property, content) {
  const re = new RegExp(`<meta\\s+content="[^"]*"\\s+property="${escapeRegex(property)}"\\s*\\/?>`, 'i');
  return html.replace(re, `<meta content="${escapeAttribute(content)}" property="${property}"/>`);
}

function removeMarkedBlock(html, startMarker, endMarker) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end <= start) return html;
  return html.slice(0, start) + html.slice(end + endMarker.length).replace(/^\s*\n/, '');
}

function replaceOrInsertBlock(html, startMarker, endMarker, replacement, beforeNeedle) {
  const block = replacement ? `${startMarker}\n${replacement}\n${endMarker}` : `${startMarker}\n${endMarker}`;
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
    return `<section class="section white static-menu-seo divider" aria-labelledby="static-menu-heading">
<div class="container">
<div class="section-top">
<div><span class="eyebrow">${escapeHtml(options.staticEyebrow)}</span><h2 class="section-title" id="static-menu-heading">${escapeHtml(options.emptyHeading)}</h2></div>
<p class="section-intro">${escapeHtml(options.emptyText)}</p>
</div>
<p><a class="button red-button" href="${options.liveMenuPath}#ordering">${escapeHtml(options.liveLinkText)}</a></p>
</div>
</section>`;
  }

  const updatedAt = menu.updatedAt ? formatDate(menu.updatedAt, options.lang) : '';
  const categoryHtml = menu.categories.map((category) => renderCategory(category, options)).join('\n');
  const updatedHtml = updatedAt ? `<p class="static-menu-updated"><strong>${escapeHtml(options.updatedLabel)}:</strong> ${escapeHtml(updatedAt)}</p>` : '';

  return `<section class="section white static-menu-seo divider" aria-labelledby="static-menu-heading">
<div class="container">
<div class="section-top">
<div><span class="eyebrow">${escapeHtml(options.staticEyebrow)}</span><h2 class="section-title" id="static-menu-heading">${escapeHtml(options.staticHeading)}</h2></div>
<p class="section-intro">${escapeHtml(options.staticIntro)}</p>
</div>
${updatedHtml}
<p><a class="button red-button" href="${options.liveMenuPath}#ordering">${escapeHtml(options.liveLinkText)}</a></p>
<div class="static-menu-sections">
${categoryHtml}
</div>
</div>
</section>`;
}

function renderCategory(category, options) {
  const items = Array.isArray(category.items) ? category.items : [];
  if (!items.length) return '';

  const id = `static-menu-category-${slugify(category.name || options.fallbackCategory)}`;
  return `<section class="static-menu-category" aria-labelledby="${escapeAttribute(id)}">
<h3 id="${escapeAttribute(id)}">${escapeHtml(category.name || options.fallbackCategory)}</h3>
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

function renderMenuSchema(menu, pageUrl, options) {
  if (!menu?.categories?.length) return '';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    '@id': `${pageUrl}#menu`,
    name: options.schemaName,
    url: pageUrl,
    inLanguage: options.lang === 'es' ? 'es-US' : 'en-US',
    provider: {
      '@id': 'https://victorsmexicanfood.com/#restaurant'
    },
    hasMenuSection: menu.categories
      .filter((category) => Array.isArray(category.items) && category.items.length)
      .map((category) => ({
        '@type': 'MenuSection',
        name: category.name || options.fallbackCategory,
        hasMenuItem: category.items.map((item) => menuItemToSchema(item))
      }))
  };

  return `<script type="application/ld+json">${JSON.stringify(schema, null, 2).replace(/<\//g, '<\\/')}</script>`;
}

function menuItemToSchema(item) {
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
      day: 'numeric'
    }).format(new Date(value));
  } catch {
    return '';
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'menu-section';
}

function escapeJsonString(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
