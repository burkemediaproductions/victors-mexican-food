from pathlib import Path
import textwrap, json, shutil

root = Path('/mnt/data/victors-site')
assets = root/'assets'
css = assets/'css'
js = assets/'js'
img = assets/'img'
vid = assets/'video'
for p in [css, js, img, vid, root/'about', root/'menu', root/'reviews', root/'faq', root/'contact', root/'privacy-policy', root/'terms', root/'es', root/'es'/'about', root/'es'/'menu', root/'es'/'reviews', root/'es'/'faq', root/'es'/'contact', root/'es'/'privacy-policy', root/'es'/'terms']:
    p.mkdir(parents=True, exist_ok=True)

# move images into assets
shutil.copy(root/'logo.png', img/'logo-victors.png')
shutil.copy(root/'hometown-collage.jpg', img/'zacatecas-hometown-collage.jpg')

site_url = 'https://victorsmexicanfood.com'

config = '''window.VICTORS_CONFIG = {
  orderingEnabled: true,
  cloverMenuEmbedUrl: '',
  cloverOrderingUrl: '',
  cloverApiMode: false,
  googleBusinessUrl: '',
  mapsEmbedUrl: 'https://www.google.com/maps?q=74600%20CA-111%20Suite%20F%2C%20Palm%20Desert%2C%20CA%2092260&output=embed',
  facebookUrl: 'https://www.facebook.com/victorsmexicanfood/',
  instagramUrl: 'https://www.instagram.com/victorsmexicanfood',
  yelpUrl: 'https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3'
};
'''
(js/'config.js').write_text(config)

site_js = '''
(function(){
  const body = document.body;
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.getElementById('mobile-menu');
  const mobileClose = document.querySelector('[data-menu-close]');
  const desktopDropdowns = document.querySelectorAll('[data-dropdown]');
  const yearEls = document.querySelectorAll('[data-year]');
  yearEls.forEach(el => el.textContent = new Date().getFullYear());

  const openMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.hidden = false;
    requestAnimationFrame(()=> mobileMenu.classList.add('is-open'));
    body.classList.add('menu-open');
    menuButton?.setAttribute('aria-expanded', 'true');
    mobileClose?.focus();
  };
  const closeMenu = () => {
    if (!mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    body.classList.remove('menu-open');
    menuButton?.setAttribute('aria-expanded', 'false');
    setTimeout(()=> { if (!mobileMenu.classList.contains('is-open')) mobileMenu.hidden = true; }, 250);
  };
  menuButton?.addEventListener('click', () => {
    if (mobileMenu.hidden) openMenu(); else closeMenu();
  });
  mobileClose?.addEventListener('click', closeMenu);
  mobileMenu?.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  desktopDropdowns.forEach(item => {
    const btn = item.querySelector('button');
    const panel = item.querySelector('.dropdown-panel');
    if (!btn || !panel) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      desktopDropdowns.forEach(other => {
        other.querySelector('button')?.setAttribute('aria-expanded', 'false');
        other.querySelector('.dropdown-panel')?.setAttribute('hidden', '');
      });
      if (!open) {
        btn.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('hidden');
      }
    });
  });
  document.addEventListener('click', (e) => {
    if (![...desktopDropdowns].some(dd => dd.contains(e.target))) {
      desktopDropdowns.forEach(other => {
        other.querySelector('button')?.setAttribute('aria-expanded', 'false');
        other.querySelector('.dropdown-panel')?.setAttribute('hidden', '');
      });
    }
  });

  const orderLinks = document.querySelectorAll('[data-order-link]');
  const orderEmbeds = document.querySelectorAll('[data-order-embed]');
  const orderBlocks = document.querySelectorAll('[data-order-block]');
  const config = window.VICTORS_CONFIG || {};
  orderLinks.forEach(link => {
    if (config.cloverOrderingUrl) link.setAttribute('href', config.cloverOrderingUrl);
    else link.setAttribute('href', '#contact-cta');
  });
  orderEmbeds.forEach(frame => {
    if (config.orderingEnabled && config.cloverMenuEmbedUrl) {
      frame.src = config.cloverMenuEmbedUrl;
      frame.hidden = false;
    } else {
      frame.hidden = true;
    }
  });
  orderBlocks.forEach(block => {
    if (!config.orderingEnabled) block.classList.add('ordering-disabled');
  });

  const mapFrame = document.querySelector('[data-map-embed]');
  if (mapFrame && config.mapsEmbedUrl) mapFrame.src = config.mapsEmbedUrl;

  const reveals = document.querySelectorAll('[data-reveal]');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: .14});
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('revealed'));
  }
})();
'''
(js/'site.js').write_text(site_js)

css_text = '''
:root {
  --color-red: #d31c21;
  --color-red-deep: #9f1118;
  --color-green: #0b7a3b;
  --color-green-dark: #08592d;
  --color-black: #111111;
  --color-cream: #fbf4ea;
  --color-sand: #e6d4bc;
  --color-white: #ffffff;
  --color-muted: #665b51;
  --shadow: 0 18px 50px rgba(0,0,0,.18);
  --radius: 22px;
  --container: 1180px;
  --section-space: clamp(4rem, 8vw, 7rem);
  --divider-height: 84px;
  --font-heading: 'Syne', 'Arial Black', sans-serif;
  --font-body: 'Manrope', 'Segoe UI', sans-serif;
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body {
  margin: 0;
  font-family: var(--font-body);
  color: var(--color-black);
  background: var(--color-cream);
  line-height: 1.6;
}
body.menu-open { overflow: hidden; }
a { color: inherit; text-decoration: none; }
a:hover { text-decoration: none; }
img { max-width: 100%; display: block; }
iframe { border: 0; }
button { font: inherit; }
.skip-link {
  position: absolute; left: 1rem; top: -3rem; z-index: 1000;
  background: var(--color-black); color: var(--color-white); padding: .85rem 1rem; border-radius: 999px;
}
.skip-link:focus { top: 1rem; }
:focus-visible {
  outline: 3px solid var(--color-red);
  outline-offset: 3px;
}
.container { width: min(calc(100% - 2rem), var(--container)); margin: 0 auto; }
.site-header {
  position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px);
  background: rgba(251, 244, 234, .92); border-bottom: 1px solid rgba(17,17,17,.08);
}
.topbar {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .65rem 0;
  font-size: .95rem; color: var(--color-muted);
}
.header-main { display:flex; align-items:center; justify-content:space-between; gap:1.25rem; padding: .85rem 0; }
.brand { display:flex; align-items:center; gap:.95rem; }
.brand img { width: 72px; height: 72px; object-fit: contain; }
.brand-mark { font-family: var(--font-heading); letter-spacing: .04em; font-size: clamp(1.6rem, 2vw, 2rem); line-height: .95; }
.brand-sub { font-size: .9rem; color: var(--color-muted); }
.desktop-nav { display:flex; align-items:center; gap: 1rem; }
.desktop-nav > a, .desktop-nav > .dropdown > button {
  padding: .7rem .9rem; border-radius: 999px; border: 0; background: transparent; cursor: pointer; font-weight: 700;
}
.desktop-nav > a:hover, .desktop-nav > .dropdown > button:hover { background: rgba(11,122,59,.08); }
.dropdown { position: relative; }
.dropdown-panel {
  position: absolute; top: calc(100% + .6rem); left: 0; min-width: 240px; padding: .75rem; background: var(--color-white); box-shadow: var(--shadow); border-radius: 18px;
}
.dropdown-panel a { display:block; padding: .75rem .85rem; border-radius: 12px; }
.dropdown-panel a:hover { background: rgba(11,122,59,.08); }
.header-actions { display:flex; align-items:center; gap: .75rem; }
.button, .button-secondary {
  display:inline-flex; align-items:center; justify-content:center; gap:.55rem; padding: .95rem 1.25rem; border-radius: 999px; font-weight: 800; transition: transform .2s ease, background .2s ease;
}
.button { background: linear-gradient(135deg, var(--color-red), var(--color-red-deep)); color: var(--color-white); box-shadow: var(--shadow); }
.button:hover { transform: translateY(-2px); }
.button-secondary { background: rgba(11,122,59,.12); color: var(--color-green-dark); }
.button-secondary:hover { background: rgba(11,122,59,.18); }
.order-pill { background: linear-gradient(135deg, var(--color-green), var(--color-green-dark)); color: var(--color-white); }
.mobile-toggle {
  display:none; background: var(--color-white); border: 1px solid rgba(17,17,17,.15); border-radius: 14px; padding: .85rem;
}
.mobile-toggle span { display:block; width: 22px; height: 2px; background: var(--color-black); margin: 4px 0; }
.mobile-menu {
  position: fixed; inset: 0; background:
    linear-gradient(rgba(11,122,59,.94), rgba(159,17,24,.92)),
    url('/assets/img/zacatecas-hometown-collage.jpg') center/cover no-repeat;
  color: var(--color-white); padding: 1.25rem; display:flex; flex-direction:column; opacity: 0; visibility: hidden; transition: opacity .25s ease, visibility .25s ease;
}
.mobile-menu.is-open { opacity:1; visibility: visible; }
.mobile-menu-header { display:flex; justify-content:space-between; align-items:center; }
.mobile-close { background: transparent; color: var(--color-white); border: 1px solid rgba(255,255,255,.4); border-radius: 999px; padding: .75rem 1rem; }
.mobile-menu nav { display:grid; gap: .4rem; margin-top: 2rem; }
.mobile-menu nav a, .mobile-menu details summary { font-size: 1.45rem; font-weight: 800; padding: .9rem 0; list-style: none; cursor:pointer; }
.mobile-menu details a { display:block; padding: .55rem 0 .55rem 1rem; font-size:1.05rem; }
.main-hero {
  position: relative; overflow:hidden; min-height: 88svh; display:flex; align-items:center; background: var(--color-black); color: var(--color-white);
}
.main-hero::after { content:''; position:absolute; inset:0; background: linear-gradient(90deg, rgba(17,17,17,.78), rgba(17,17,17,.38), rgba(17,17,17,.6)); }
.hero-media { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
.hero-content { position:relative; z-index:1; padding: clamp(5rem, 10vw, 8rem) 0; }
.kicker { text-transform: uppercase; letter-spacing: .22em; font-weight: 800; font-size: .84rem; color: var(--color-sand); }
.hero-title, .page-title, h2.section-title, .eyebrow-title {
  font-family: var(--font-heading); letter-spacing: .02em; line-height: .95; margin: 0 0 1rem;
}
.hero-title { font-size: clamp(3.7rem, 9vw, 7rem); max-width: 10ch; }
.hero-copy { max-width: 62ch; font-size: 1.1rem; color: rgba(255,255,255,.92); }
.hero-actions, .split-actions { display:flex; flex-wrap:wrap; gap: 1rem; margin-top: 1.5rem; }
.hero-card-row { display:grid; grid-template-columns: repeat(3, 1fr); gap:1rem; margin-top: 2rem; max-width: 920px; }
.glass-card {
  background: rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.2); padding: 1rem 1.1rem; border-radius: 18px; backdrop-filter: blur(12px);
}
.glass-card strong { display:block; font-size: 1.15rem; }
.section {
  --section-bg: var(--color-cream);
  --section-next: var(--color-white);
  background: var(--section-bg);
  padding: var(--section-space) 0;
  position: relative;
}
.section.with-divider::after {
  content:''; position:absolute; left:0; right:0; bottom: calc(var(--divider-height) * -1 + 1px); height: var(--divider-height); z-index:3;
  background: var(--section-next);
  clip-path: polygon(0 38%, 9% 50%, 18% 35%, 31% 62%, 44% 36%, 58% 70%, 73% 28%, 88% 58%, 100% 35%, 100% 100%, 0 100%);
}
.section-red { --section-bg: linear-gradient(180deg, #bf1c21, #9f1118); color: var(--color-white); }
.section-green { --section-bg: linear-gradient(180deg, #0b7a3b, #08592d); color: var(--color-white); }
.section-dark { --section-bg: var(--color-black); color: var(--color-white); }
.section-white { --section-bg: var(--color-white); }
.section-cream { --section-bg: var(--color-cream); }
.section-sand { --section-bg: #efe0cd; }
.lead { font-size: 1.1rem; color: inherit; max-width: 65ch; }
.grid-2 { display:grid; grid-template-columns: 1.05fr .95fr; gap: clamp(1.5rem, 4vw, 4rem); align-items:center; }
.grid-3 { display:grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; }
.grid-4 { display:grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.card {
  background: rgba(255,255,255,.82); color: var(--color-black); border-radius: var(--radius); padding: 1.35rem; box-shadow: var(--shadow);
}
.section-dark .card, .section-red .card, .section-green .card { background: rgba(255,255,255,.1); color: var(--color-white); border:1px solid rgba(255,255,255,.18); }
.card h3 { margin-top: 0; font-size: 1.2rem; }
.media-frame {
  border-radius: 28px; overflow:hidden; box-shadow: var(--shadow); position:relative; min-height: 360px; background: #ddd center/cover no-repeat;
}
.media-frame img, .media-frame video, .media-frame iframe { width:100%; height:100%; object-fit:cover; min-height: 360px; }
.media-badge {
  position:absolute; left:1rem; bottom:1rem; background: rgba(17,17,17,.72); color: var(--color-white); padding:.65rem .9rem; border-radius:999px; font-size:.92rem;
}
.story-timeline { display:grid; gap:1rem; }
.story-item { display:grid; grid-template-columns: auto 1fr; gap:1rem; align-items:start; }
.story-year {
  width: 88px; min-height: 88px; border-radius: 24px; background: linear-gradient(135deg, var(--color-red), var(--color-green)); color: var(--color-white); display:grid; place-items:center; font-family: var(--font-heading); font-size: 2rem;
}
.icon-list { display:grid; gap:.85rem; }
.icon-list li { list-style:none; position:relative; padding-left: 1.5rem; }
.icon-list li::before { content:'✦'; position:absolute; left:0; color: var(--color-red); }
.stats { display:grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 2rem; }
.stat { text-align:center; padding:1.25rem; border-radius: 20px; background: rgba(255,255,255,.12); }
.stat strong { display:block; font-family: var(--font-heading); font-size: 2.6rem; line-height:1; }
.review-card blockquote { margin: 0 0 1rem; font-size: 1.05rem; }
.review-card cite { font-style:normal; font-weight:700; }
.faq-item { border-bottom:1px solid rgba(17,17,17,.12); padding: 1rem 0; }
.faq-item summary { cursor:pointer; font-weight:800; }
.cta-band {
  padding: 1.4rem 1.6rem; border-radius: 28px; display:flex; gap:1rem; align-items:center; justify-content:space-between; flex-wrap:wrap; background: linear-gradient(135deg, rgba(11,122,59,.12), rgba(211,28,33,.12));
}
.menu-board { display:grid; gap:1rem; }
.menu-group { border-radius: 22px; padding:1.2rem; background: rgba(255,255,255,.92); box-shadow: var(--shadow); }
.menu-line { display:flex; justify-content:space-between; gap:1rem; border-bottom:1px dashed rgba(17,17,17,.15); padding:.6rem 0; }
.ordering-shell { border-radius: 28px; overflow:hidden; box-shadow: var(--shadow); background: var(--color-white); }
.ordering-disabled .ordering-note-disabled { display:block; }
.ordering-note-disabled { display:none; padding: 1rem 1.2rem; background: rgba(211,28,33,.08); }
.ordering-frame { min-height: 760px; width: 100%; background: #f2f2f2; }
.contact-list { display:grid; gap:.9rem; }
.contact-list a, .contact-list p { margin:0; }
.hours-list { display:grid; gap:.5rem; }
.hours-row { display:flex; justify-content:space-between; gap:1rem; }
.social-links { display:flex; gap:.75rem; flex-wrap: wrap; }
.social-links a { padding:.8rem 1rem; border-radius:999px; background: rgba(17,17,17,.06); }
.site-footer { background: var(--color-black); color: rgba(255,255,255,.88); padding: 2.75rem 0 1.25rem; }
.footer-grid { display:grid; grid-template-columns: 1.2fr .8fr .8fr .8fr; gap:1.25rem; }
.footer-grid a { color: rgba(255,255,255,.88); }
.footer-bottom { display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap; padding-top:1.3rem; margin-top:1.3rem; border-top:1px solid rgba(255,255,255,.12); font-size:.92rem; }
.parallax-panel {
  background: linear-gradient(rgba(17,17,17,.35), rgba(17,17,17,.55)), url('/assets/img/zacatecas-hometown-collage.jpg') center/cover fixed no-repeat;
  color: var(--color-white); border-radius: 32px; padding: clamp(2rem, 5vw, 4rem); box-shadow: var(--shadow);
}
.inline-video-note { font-size:.92rem; color: var(--color-muted); }
.page-hero {
  position: relative; min-height: 54svh; display:flex; align-items:end; background: linear-gradient(rgba(17,17,17,.28), rgba(17,17,17,.72)), url('/assets/img/zacatecas-hometown-collage.jpg') center/cover no-repeat; color: var(--color-white);
}
.page-hero.small { min-height: 34svh; background: linear-gradient(135deg, var(--color-green-dark), var(--color-red-deep)); }
.page-hero .container { position:relative; z-index:1; padding: 7rem 0 3rem; }
.page-title { font-size: clamp(3rem, 7vw, 5rem); max-width: 12ch; }
.breadcrumbs { font-size:.95rem; color: rgba(255,255,255,.84); margin-bottom: 1rem; }
[data-reveal] { opacity:0; transform: translateY(18px); transition: opacity .7s ease, transform .7s ease; }
[data-reveal].revealed { opacity:1; transform:none; }
.visually-hidden { position:absolute !important; clip: rect(1px,1px,1px,1px); clip-path: inset(50%); width:1px; height:1px; overflow:hidden; white-space: nowrap; }
@media (max-width: 1040px) {
  .desktop-nav, .header-actions .button-secondary { display:none; }
  .mobile-toggle { display:block; }
  .grid-2, .grid-3, .grid-4, .footer-grid, .stats, .hero-card-row { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 760px) {
  .topbar { display:none; }
  .grid-2, .grid-3, .grid-4, .footer-grid, .stats, .hero-card-row { grid-template-columns: 1fr; }
  .brand img { width: 62px; height:62px; }
  .hero-title { font-size: clamp(3rem, 16vw, 5rem); }
  .page-title { font-size: clamp(2.5rem, 14vw, 4rem); }
  .story-item { grid-template-columns: 1fr; }
  .story-year { width:72px; min-height:72px; border-radius:18px; }
  .section { --divider-height: 60px; }
}
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after { animation: none !important; transition: none !important; }
  .parallax-panel { background-attachment: scroll; }
}
'''
(css/'styles.css').write_text(css_text)

# placeholder files
for name in ['hero-home.mp4','hero-home-poster.jpg','story-loop.mp4','story-loop-poster.jpg','about-hero.jpg','home-video-poster.jpg','about-video-poster.jpg','og-default.jpg','favicon.ico','favicon-32x32.png','favicon-16x16.png','apple-touch-icon.png']:
    (img/name if name.endswith(('.jpg','.png','.ico')) else vid/name).write_text('REPLACE WITH FINAL ASSET')

pages = {}

nav_en = [
    ('Home','/'),('About','/about/'),('Menu','/menu/'),('Reviews','/reviews/'),('FAQ','/faq/'),('Contact','/contact/')
]
nav_es = [
    ('Inicio','/es/'),('Nosotros','/es/about/'),('Menú','/es/menu/'),('Reseñas','/es/reviews/'),('Preguntas','/es/faq/'),('Contacto','/es/contact/')
]

hours_en = [('Saturday','8:30 AM – 8:00 PM'),('Sunday','8:30 AM – 8:00 PM'),('Monday','8:30 AM – 8:00 PM'),('Tuesday','8:30 AM – 8:00 PM'),('Wednesday','8:30 AM – 8:00 PM'),('Thursday','8:30 AM – 8:00 PM'),('Friday','8:30 AM – 8:00 PM')]
hours_es = [('Sábado','8:30 AM – 8:00 PM'),('Domingo','8:30 AM – 8:00 PM'),('Lunes','8:30 AM – 8:00 PM'),('Martes','8:30 AM – 8:00 PM'),('Miércoles','8:30 AM – 8:00 PM'),('Jueves','8:30 AM – 8:00 PM'),('Viernes','8:30 AM – 8:00 PM')]


def meta(title, description, canonical, lang='en-US', alternates=None):
    og_title = title
    alt_links = ''
    if alternates:
        for href_lang, href in alternates:
            alt_links += f'  <link rel="alternate" hreflang="{href_lang}" href="{href}">\n'
    return f'''<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <meta name="description" content="{description}">
  <meta name="theme-color" content="#d31c21">
  <meta name="msapplication-TileColor" content="#d31c21">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="{canonical}">
{alt_links}  <meta property="og:type" content="website">
  <meta property="og:title" content="{og_title}">
  <meta property="og:description" content="{description}">
  <meta property="og:site_name" content="Victor's Mexican Food">
  <meta property="og:url" content="{canonical}">
  <meta property="og:image" content="{site_url}/assets/img/og-default.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Victor's Mexican Food branded social image">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{og_title}">
  <meta name="twitter:description" content="{description}">
  <meta name="twitter:image" content="{site_url}/assets/img/og-default.jpg">
  <meta name="twitter:image:alt" content="Victor's Mexican Food branded social image">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Syne:wght@500;700;800&display=swap" rel="stylesheet">
  <link rel="icon" href="/assets/img/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32x32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/img/favicon-16x16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/img/apple-touch-icon.png">
  <link rel="stylesheet" href="/assets/css/styles.css">
'''

def schema(page_name, page_desc, canonical, lang='en-US', extra=''):
    data = {
        '@context':'https://schema.org',
        '@graph':[
            {
                '@type':'Restaurant',
                '@id': site_url + '/#restaurant',
                'name': "Victor's Mexican Food",
                'url': site_url + '/',
                'logo': site_url + '/assets/img/logo-victors.png',
                'image': [site_url + '/assets/img/og-default.jpg'],
                'telephone': '+1-760-341-3553',
                'address': {
                    '@type':'PostalAddress',
                    'streetAddress':'74600 CA-111 Suite F',
                    'addressLocality':'Palm Desert',
                    'addressRegion':'CA',
                    'postalCode':'92260',
                    'addressCountry':'US'
                },
                'servesCuisine':['Mexican'],
                'priceRange':'$$',
                'openingHoursSpecification': [
                    {'@type':'OpeningHoursSpecification','dayOfWeek':day,'opens':'08:30','closes':'20:00'} for day in ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
                ],
                'sameAs': [
                    'https://www.facebook.com/victorsmexicanfood/',
                    'https://www.instagram.com/victorsmexicanfood',
                    'https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3'
                ]
            },
            {
                '@type':'WebSite',
                '@id': site_url + '/#website',
                'url': site_url + '/',
                'name': "Victor's Mexican Food",
                'inLanguage': lang,
            },
            {
                '@type':'WebPage',
                'name': page_name,
                'url': canonical,
                'description': page_desc,
                'isPartOf': {'@id': site_url + '/#website'},
                'about': {'@id': site_url + '/#restaurant'},
                'inLanguage': lang,
            }
        ]
    }
    if extra:
        data['@graph'].extend(extra)
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False) + '</script>'


def header(lang='en', current=''):
    nav = nav_en if lang == 'en' else nav_es
    other = '/es/' if lang == 'en' else '/'
    switch_label = 'Español' if lang == 'en' else 'English'
    hours_text = 'Open daily · 8:30 AM – 8:00 PM' if lang == 'en' else 'Abierto diario · 8:30 AM – 8:00 PM'
    order_text = 'Order Online' if lang == 'en' else 'Ordenar en línea'
    menu_text = 'Menu' if lang == 'en' else 'Menú'
    reviews_text = 'Reviews' if lang == 'en' else 'Reseñas'
    story_text = 'Our Story' if lang == 'en' else 'Nuestra Historia'
    contact_text = 'Contact' if lang == 'en' else 'Contacto'
    contact_link = '/contact/' if lang == 'en' else '/es/contact/'
    about_link = '/about/' if lang == 'en' else '/es/about/'
    menu_link = '/menu/' if lang == 'en' else '/es/menu/'
    reviews_link = '/reviews/' if lang == 'en' else '/es/reviews/'
    faq_link = '/faq/' if lang == 'en' else '/es/faq/'
    return f'''
<a class="skip-link" href="#main-content">{'Skip to content' if lang=='en' else 'Saltar al contenido'}</a>
<header class="site-header">
  <div class="container topbar">
    <div>{hours_text}</div>
    <div><a href="tel:+17603413553">(760) 341-3553</a> · <a href="https://maps.google.com/?q=74600%20CA-111%20Suite%20F%20Palm%20Desert%20CA%2092260">74600 CA-111 Suite F, Palm Desert, CA 92260</a></div>
  </div>
  <div class="container header-main">
    <a class="brand" href="{'/' if lang=='en' else '/es/'}" aria-label="Victor's Mexican Food home">
      <img src="/assets/img/logo-victors.png" alt="Victor's Mexican Food logo">
      <span>
        <span class="brand-mark">Victor's<br>Mexican Food</span>
        <span class="brand-sub">Palm Desert, California</span>
      </span>
    </a>
    <nav class="desktop-nav" aria-label="{'Primary' if lang=='en' else 'Principal'}">
      <a href="{'/' if lang=='en' else '/es/'}">{nav[0][0]}</a>
      <div class="dropdown" data-dropdown>
        <button type="button" aria-expanded="false">{story_text}</button>
        <div class="dropdown-panel" hidden>
          <a href="{about_link}">{'About Victor & family' if lang=='en' else 'Sobre Víctor y la familia'}</a>
          <a href="{about_link}#legacy">{'Zacatecas roots' if lang=='en' else 'Raíces de Zacatecas'}</a>
          <a href="{about_link}#doves">{'Family life & doves' if lang=='en' else 'Familia y palomas'}</a>
        </div>
      </div>
      <div class="dropdown" data-dropdown>
        <button type="button" aria-expanded="false">{menu_text}</button>
        <div class="dropdown-panel" hidden>
          <a href="{menu_link}#featured">{'Featured favorites' if lang=='en' else 'Favoritos de la casa'}</a>
          <a href="{menu_link}#clover-order">{'Online ordering' if lang=='en' else 'Orden en línea'}</a>
          <a href="{menu_link}#faq-menu">{'Dietary & ordering notes' if lang=='en' else 'Notas de pedidos y dieta'}</a>
        </div>
      </div>
      <a href="{reviews_link}">{reviews_text}</a>
      <a href="{faq_link}">{'FAQ' if lang=='en' else 'Preguntas'}</a>
      <a href="{contact_link}">{contact_text}</a>
    </nav>
    <div class="header-actions">
      <a class="button-secondary" href="{other}" lang="{'es' if lang=='en' else 'en'}">{switch_label}</a>
      <a class="button order-pill" data-order-link href="#contact-cta">{order_text}</a>
      <button class="mobile-toggle" type="button" data-menu-toggle aria-expanded="false" aria-controls="mobile-menu" aria-label="{'Open menu' if lang=='en' else 'Abrir menú'}"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobile-menu" hidden>
  <div class="mobile-menu-header">
    <div class="brand">
      <img src="/assets/img/logo-victors.png" alt="Victor's Mexican Food logo">
      <span class="brand-mark">Victor's<br>Mexican Food</span>
    </div>
    <button type="button" class="mobile-close" data-menu-close>{'Close' if lang=='en' else 'Cerrar'}</button>
  </div>
  <nav aria-label="{'Mobile' if lang=='en' else 'Móvil'}">
    <a href="{'/' if lang=='en' else '/es/'}">{nav[0][0]}</a>
    <a href="{about_link}">{'About' if lang=='en' else 'Nosotros'}</a>
    <a href="{menu_link}">{menu_text}</a>
    <a href="{reviews_link}">{reviews_text}</a>
    <a href="{faq_link}">{'FAQ' if lang=='en' else 'Preguntas'}</a>
    <a href="{contact_link}">{contact_text}</a>
    <a class="button order-pill" data-order-link href="#contact-cta">{order_text}</a>
    <a href="{other}" lang="{'es' if lang=='en' else 'en'}">{switch_label}</a>
  </nav>
</div>
'''


def footer(lang='en'):
    nav = nav_en if lang=='en' else nav_es
    privacy = '/privacy-policy/' if lang=='en' else '/es/privacy-policy/'
    terms = '/terms/' if lang=='en' else '/es/terms/'
    return f'''
<footer class="site-footer">
  <div class="container footer-grid">
    <div>
      <img src="/assets/img/logo-victors.png" alt="Victor's Mexican Food logo" style="width:88px;height:88px;object-fit:contain;margin-bottom:1rem;">
      <p>{"Fresh ingredients, made from scratch, and a family story that started in Zacatecas and found a home in Palm Desert." if lang=='en' else "Ingredientes frescos, cocina hecha desde cero y una historia familiar que comenzó en Zacatecas y hoy vive en Palm Desert."}</p>
      <div class="social-links">
        <a href="https://www.facebook.com/victorsmexicanfood/">Facebook</a>
        <a href="https://www.instagram.com/victorsmexicanfood">Instagram</a>
        <a href="https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3">Yelp</a>
      </div>
    </div>
    <div>
      <h3>{'Explore' if lang=='en' else 'Explorar'}</h3>
      <p><a href="{'/' if lang=='en' else '/es/'}">{nav[0][0]}</a></p>
      <p><a href="{'/about/' if lang=='en' else '/es/about/'}">{'About' if lang=='en' else 'Nosotros'}</a></p>
      <p><a href="{'/menu/' if lang=='en' else '/es/menu/'}">{'Menu & Ordering' if lang=='en' else 'Menú y pedidos'}</a></p>
      <p><a href="{'/reviews/' if lang=='en' else '/es/reviews/'}">{'Reviews' if lang=='en' else 'Reseñas'}</a></p>
    </div>
    <div>
      <h3>{'Visit' if lang=='en' else 'Visítanos'}</h3>
      <p>74600 CA-111 Suite F<br>Palm Desert, CA 92260</p>
      <p><a href="tel:+17603413553">(760) 341-3553</a></p>
      <p>{'Daily · 8:30 AM – 8:00 PM' if lang=='en' else 'Diario · 8:30 AM – 8:00 PM'}</p>
    </div>
    <div>
      <h3>{'Info' if lang=='en' else 'Información'}</h3>
      <p><a href="{privacy}">{'Privacy Policy' if lang=='en' else 'Privacidad'}</a></p>
      <p><a href="{terms}">{'Terms of Service' if lang=='en' else 'Términos'}</a></p>
      <p><a href="{'/contact/' if lang=='en' else '/es/contact/'}">{'Contact' if lang=='en' else 'Contacto'}</a></p>
    </div>
  </div>
  <div class="container footer-bottom">
    <div>© <span data-year></span> Victor's Mexican Food</div>
    <div>{'Built for GitHub + Netlify deployment.' if lang=='en' else 'Preparado para GitHub + Netlify.'}</div>
  </div>
</footer>
<script src="/assets/js/config.js"></script>
<script src="/assets/js/site.js"></script>
'''


def page(title, desc, canonical, content, lang='en', page_name=None, extra_schema=None):
    alternates = [('en-US', canonical.replace('/es/','/') if '/es/' in canonical else canonical), ('es-MX', canonical if '/es/' in canonical else canonical.replace(site_url, site_url+'/es').replace('//es','/es'))]
    if lang == 'en':
        alternates = [('en-US', canonical), ('es-MX', canonical.replace(site_url, site_url+'/es').replace('//es','/es'))]
    else:
        alternates = [('en-US', canonical.replace(site_url+'/es','')), ('es-MX', canonical)]
    return f'''<!doctype html>
<html lang="{'en' if lang=='en' else 'es'}">
<head>
  {meta(title, desc, canonical, 'en-US' if lang=='en' else 'es-MX', alternates)}
  {schema(page_name or title, desc, canonical, 'en-US' if lang=='en' else 'es-MX', extra_schema or [])}
</head>
<body>
  {header(lang)}
  <main id="main-content">
    {content}
  </main>
  {footer(lang)}
</body>
</html>'''

home_content_en = '''
<section class="main-hero">
  <video class="hero-media" autoplay muted loop playsinline preload="metadata" poster="/assets/img/hero-home-poster.jpg" aria-hidden="true">
    <source src="/assets/video/hero-home.mp4" type="video/mp4">
  </video>
  <div class="container hero-content">
    <p class="kicker">Fresh · From Scratch · Family Owned in Palm Desert</p>
    <h1 class="hero-title">Authentic Mexican food with a story worth sharing.</h1>
    <p class="hero-copy">Victor's Mexican Food brings together fresh ingredients, made-from-scratch cooking, and generations of hard work inspired by Victor’s family roots in El Malacate, Zacatecas. Every plate is designed to feel generous, vibrant, and genuinely welcoming.</p>
    <div class="hero-actions">
      <a class="button order-pill" data-order-link href="#contact-cta">Order Online</a>
      <a class="button-secondary" href="/menu/">Explore the Menu</a>
    </div>
    <div class="hero-card-row">
      <div class="glass-card"><strong>Fresh daily</strong><span>No cans, no shortcuts, real kitchen flavor.</span></div>
      <div class="glass-card"><strong>Family legacy</strong><span>A Palm Desert restaurant built on Zacatecas roots.</span></div>
      <div class="glass-card"><strong>Easy ordering</strong><span>Clover-ready menu with online ordering controls built in.</span></div>
    </div>
  </div>
</section>

<section class="section section-cream with-divider" style="--section-next: #ffffff;">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker" style="color:var(--color-green);">A live-feeling first impression</p>
      <h2 class="section-title">A bold restaurant site made to feel warm, rooted, and ready to order.</h2>
      <p class="lead">This experience is built to balance atmosphere and conversion. It highlights Victor’s story, supports Clover integration, and makes room for rich media, testimonials, seasonal menu promotions, and local SEO growth across English and Spanish audiences.</p>
      <div class="split-actions">
        <a class="button" href="/about/">Read Our Story</a>
        <a class="button-secondary" href="/contact/">Plan a Visit</a>
      </div>
    </div>
    <div class="media-frame">
      <video autoplay muted loop playsinline preload="metadata" poster="/assets/img/story-loop-poster.jpg" aria-label="Decorative inline kitchen loop">
        <source src="/assets/video/story-loop.mp4" type="video/mp4">
      </video>
      <div class="media-badge">Inline autoplay loop · replace with kitchen or plating footage</div>
    </div>
  </div>
</section>

<section class="section section-white with-divider" style="--section-next: #bf1c21;">
  <div class="container" data-reveal>
    <div class="cta-band">
      <div>
        <p class="kicker" style="color:var(--color-red);">Why guests keep coming back</p>
        <h2 class="section-title">Big flavor, hospitality, and an honest made-from-scratch kitchen.</h2>
      </div>
      <a class="button order-pill" data-order-link href="#contact-cta">Start an Order</a>
    </div>
    <div class="grid-3" style="margin-top:1.4rem;">
      <article class="card"><h3>Fresh ingredients first</h3><p>Signature dishes are framed around freshness, texture, and balanced seasoning so everything feels vibrant from the first bite to the last.</p></article>
      <article class="card"><h3>Built on family values</h3><p>Victor’s journey from Zacatecas to the Coachella Valley shapes the hospitality, persistence, and pride behind the restaurant.</p></article>
      <article class="card"><h3>Ready for everyday ordering</h3><p>The site keeps the menu visible at all times while making online ordering easy to toggle on or off depending on Clover or API needs.</p></article>
    </div>
    <div class="stats">
      <div class="stat"><strong>1993</strong><span>Victor moved to the Coachella Valley</span></div>
      <div class="stat"><strong>2018</strong><span>Restaurant opened on December 15</span></div>
      <div class="stat"><strong>2024</strong><span>Moved to a prime location on CA-111</span></div>
      <div class="stat"><strong>33+</strong><span>Years of life and work in the U.S.</span></div>
    </div>
  </div>
</section>

<section class="section section-red with-divider" style="--section-next: #111111;">
  <div class="container grid-2" data-reveal>
    <div class="media-frame">
      <img src="/assets/img/zacatecas-hometown-collage.jpg" alt="Landscape and family hometown imagery inspired by El Malacate, Zacatecas">
      <div class="media-badge">El Malacate, Zacatecas inspiration</div>
    </div>
    <div>
      <p class="kicker">From El Malacate to Palm Desert</p>
      <h2 class="section-title">The hometown story is part of the atmosphere, not just the biography.</h2>
      <p class="lead">Victor’s family story begins in a rural village on the border of Zacatecas and Jalisco, where his grandfather’s roadside store served travelers on the old Camino Real. That same spirit of service, resilience, and community now shapes the restaurant’s identity in Palm Desert.</p>
      <ul class="icon-list">
        <li>A visual theme inspired by hillsides, agave, adobe textures, and the Camino Real legacy.</li>
        <li>Flexible section dividers designed in CSS so they are easy to recolor and reuse sitewide.</li>
        <li>Space for hometown photography across home, about, and story-forward landing sections.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section section-dark with-divider" style="--section-next: #fbf4ea;">
  <div class="container" data-reveal>
    <div class="parallax-panel">
      <p class="kicker">Produced video spotlight</p>
      <h2 class="section-title">Feature a full brand film, chef story, or food-driven highlight reel.</h2>
      <p class="lead">This block is ready for your polished promotional video with a platform embed, custom thumbnail, transcript support, and a CTA alongside it for ordering or visiting.</p>
      <div class="grid-2" style="margin-top:1.4rem; align-items:start;">
        <div class="media-frame" style="min-height:320px; background:#000;">
          <iframe title="Victor's Mexican Food home feature video" src="about:blank" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe>
        </div>
        <div class="card">
          <h3>Suggested uses for this video area</h3>
          <p>Chef introduction, kitchen footage, Victor’s journey, hometown visuals, seasonal specials, and community moments all work beautifully in this placement.</p>
          <p class="inline-video-note">Swap the iframe or replace with a self-hosted inline video depending on your final publishing plan.</p>
          <a class="button" href="/about/">See the full story</a>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section section-cream with-divider" style="--section-next: #ffffff;">
  <div class="container" data-reveal>
    <p class="kicker" style="color:var(--color-green);">Featured favorites</p>
    <h2 class="section-title">A clean, on-brand menu preview that leads naturally into full ordering.</h2>
    <div class="grid-3 menu-board" id="featured">
      <article class="menu-group"><h3>Breakfast Plates</h3><div class="menu-line"><span>Huevos Rancheros</span><strong>$0.00</strong></div><div class="menu-line"><span>Chilaquiles Verdes</span><strong>$0.00</strong></div><div class="menu-line"><span>Breakfast Burrito</span><strong>$0.00</strong></div></article>
      <article class="menu-group"><h3>Signature Favorites</h3><div class="menu-line"><span>Carne Asada Plate</span><strong>$0.00</strong></div><div class="menu-line"><span>Birria Tacos</span><strong>$0.00</strong></div><div class="menu-line"><span>Chile Relleno</span><strong>$0.00</strong></div></article>
      <article class="menu-group"><h3>Family Staples</h3><div class="menu-line"><span>Enchilada Combo</span><strong>$0.00</strong></div><div class="menu-line"><span>Torta de Asada</span><strong>$0.00</strong></div><div class="menu-line"><span>Kids Fries & Ketchup</span><strong>$0.00</strong></div></article>
    </div>
    <div class="split-actions" style="margin-top:1.4rem;">
      <a class="button" href="/menu/">See Full Menu Experience</a>
      <a class="button-secondary" data-order-link href="#contact-cta">Order for Pickup</a>
    </div>
  </div>
</section>

<section class="section section-white with-divider" style="--section-next: #0b7a3b;">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker" style="color:var(--color-red);">Reviews and trust</p>
      <h2 class="section-title">A natural place for social proof, local credibility, and platform links.</h2>
      <div class="grid-2">
        <article class="card review-card"><blockquote>“Every visit feels welcoming, the food tastes fresh, and the portions are generous. It’s the kind of place you recommend right away.”</blockquote><cite>Local guest</cite></article>
        <article class="card review-card"><blockquote>“You can feel the family story in the room. The food is comforting, colorful, and consistently satisfying.”</blockquote><cite>Coachella Valley diner</cite></article>
      </div>
      <div class="split-actions">
        <a class="button-secondary" href="/reviews/">View Review Highlights</a>
        <a class="button-secondary" href="https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3">Open Yelp</a>
      </div>
    </div>
    <div class="card">
      <h3>Google + Maps ready</h3>
      <p>This site includes LocalBusiness schema, business hours, address formatting, social links, and a mapped contact section to support local search visibility and easy navigation.</p>
      <ul class="icon-list">
        <li>Structured metadata for restaurant and page content.</li>
        <li>Built-in sitemap, robots file, 404 page, and canonical setup.</li>
        <li>Accessible navigation, keyboard support, visible focus states, and reduced-motion respect.</li>
      </ul>
    </div>
  </div>
</section>

<section class="section section-green" id="contact-cta">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker">Visit or order today</p>
      <h2 class="section-title">Victor’s Mexican Food is ready when you are.</h2>
      <p class="lead">Whether guests are finding you for breakfast, lunch, dinner, takeout, or a family meal after a long day, the final CTA should feel immediate and welcoming.</p>
      <div class="split-actions">
        <a class="button order-pill" data-order-link href="#">Order Online</a>
        <a class="button-secondary" href="/contact/">Get Directions</a>
      </div>
    </div>
    <div class="card" style="color:var(--color-white);">
      <h3>Find us in Palm Desert</h3>
      <p>74600 CA-111 Suite F<br>Palm Desert, CA 92260</p>
      <p><a href="tel:+17603413553">(760) 341-3553</a></p>
      <p>Open daily from 8:30 AM to 8:00 PM</p>
    </div>
  </div>
</section>
'''

# Simplify other pages with reused content blocks
about_content_en = '''
<section class="page-hero">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Home</a> / About</div>
    <p class="kicker">Family story · craftsmanship · hospitality</p>
    <h1 class="page-title">A restaurant shaped by patience, resilience, and family pride.</h1>
    <p class="hero-copy">Victor’s story stretches from a rural village in Zacatecas to the Coachella Valley, where years of hard work eventually became a restaurant of his own.</p>
  </div>
</section>
<section class="section section-white with-divider" style="--section-next: #fbf4ea;">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker" style="color:var(--color-red);">The dream started young</p>
      <h2 class="section-title">From watching a chef on television to wearing the coat for real.</h2>
      <p class="lead">As a child in a town that felt far from opportunity, Victor once told his mother he would become the chef he saw on TV. Years later, after earning his first chef position in 2009, he sent her a picture wearing the coat and hat he had imagined all along.</p>
      <p class="lead">That same belief, carried through decades of work and sacrifice, eventually led to Victor’s Mexican Food opening on December 15, 2018 and later moving into its prime Palm Desert location in 2024.</p>
    </div>
    <div class="media-frame">
      <img src="/assets/img/zacatecas-hometown-collage.jpg" alt="Historic village and countryside imagery reflecting Victor's roots in Zacatecas">
      <div class="media-badge">Rooted in El Malacate, Zacatecas</div>
    </div>
  </div>
</section>
<section class="section section-cream with-divider" id="legacy" style="--section-next: #0b7a3b;">
  <div class="container" data-reveal>
    <p class="kicker" style="color:var(--color-green);">Camino Real legacy</p>
    <h2 class="section-title">The family business spirit started with a general store on the old route.</h2>
    <div class="grid-2">
      <div>
        <p class="lead">Victor’s grandfather opened a store in a remote area where travelers on horseback stopped along the Camino Real. They brought cheese, sugar, cinnamon, flour, cloth, and spices between rural communities and the city. The store became a trusted place to trade, rest, and connect.</p>
        <p class="lead">That vision was more than practical. It was prophetic. What was once a route for horses eventually became a modern road stretching from Jalisco toward El Paso. The spirit behind the store lives on in Victor’s restaurant today: work hard, welcome people well, and keep building for the next generation.</p>
      </div>
      <div class="story-timeline">
        <div class="story-item"><div class="story-year">1993</div><div><h3>Coachella Valley chapter begins</h3><p>Victor moved to the valley and began building the life and experience that would eventually support a restaurant of his own.</p></div></div>
        <div class="story-item"><div class="story-year">2009</div><div><h3>Chef milestone</h3><p>Victor earned his first chef position and shared the moment with his mother, fulfilling a promise he had made years earlier.</p></div></div>
        <div class="story-item"><div class="story-year">2018</div><div><h3>The restaurant opens</h3><p>Victor’s Mexican Food opened its doors on December 15 with a menu centered on freshness, authenticity, and family care.</p></div></div>
        <div class="story-item"><div class="story-year">2024</div><div><h3>Prime Palm Desert location</h3><p>The move to CA-111 gave the brand more visibility, stronger flow, and a new stage for the next chapter.</p></div></div>
      </div>
    </div>
  </div>
</section>
<section class="section section-green with-divider" id="doves" style="--section-next: #111111;">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker">Life beyond the kitchen</p>
      <h2 class="section-title">Family, faith, and white homing doves are part of the story too.</h2>
      <p class="lead">In his free time, Victor raises homing doves and runs White Doves For You PS with Carmen. The business serves the Coachella Valley, Banning, and the High Desert with white dove releases for memorials, weddings, quinceañeras, baptisms, photo shoots, and other meaningful events, with a strong emphasis on bird safety and humane releases. citeturn427109search0turn427109search3turn427109search4</p>
      <p class="lead">That same sense of care carries into the restaurant: attention to detail, family involvement, and a belief that meaningful experiences are built one thoughtful choice at a time.</p>
    </div>
    <div class="card" style="color:var(--color-white);">
      <h3>Family names woven into the brand story</h3>
      <p>Carmen, Victor Jr., Eduardo, and Paloma all reflect the family-first heartbeat behind the restaurant’s next chapter.</p>
      <p>There is also room on this page for portraits, team bios, or short video clips introducing the people guests see behind the counter and in the kitchen.</p>
    </div>
  </div>
</section>
<section class="section section-dark">
  <div class="container" data-reveal>
    <div class="grid-2">
      <div class="media-frame" style="min-height:320px; background:#000;">
        <iframe title="Victor's Mexican Food about video" src="about:blank" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"></iframe>
      </div>
      <div>
        <p class="kicker">Produced story film</p>
        <h2 class="section-title">A second high-impact video area for deeper brand storytelling.</h2>
        <p class="lead">Use this placement for Victor’s full origin story, kitchen artistry, family interviews, or a documentary-style piece that connects guests to the meaning behind the brand.</p>
        <a class="button" href="/contact/">Book a Visit</a>
      </div>
    </div>
  </div>
</section>
'''

menu_content_en = '''
<section class="page-hero">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Home</a> / Menu</div>
    <p class="kicker">Menu visibility with flexible ordering</p>
    <h1 class="page-title">A menu experience designed for discovery, appetite, and easy checkout.</h1>
    <p class="hero-copy">The menu always stays visible on-brand, while online ordering can be embedded, linked, or turned off in one config file.</p>
  </div>
</section>
<section class="section section-white with-divider" id="featured" style="--section-next: #fbf4ea;">
  <div class="container" data-reveal>
    <p class="kicker" style="color:var(--color-red);">Menu board</p>
    <h2 class="section-title">Featured categories</h2>
    <div class="grid-3 menu-board">
      <article class="menu-group"><h3>Breakfast</h3><div class="menu-line"><span>Huevos con Chorizo</span><strong>$0.00</strong></div><div class="menu-line"><span>Machaca Plate</span><strong>$0.00</strong></div><div class="menu-line"><span>Breakfast Burrito</span><strong>$0.00</strong></div></article>
      <article class="menu-group"><h3>Tacos & Plates</h3><div class="menu-line"><span>Asada Tacos</span><strong>$0.00</strong></div><div class="menu-line"><span>Birria Plate</span><strong>$0.00</strong></div><div class="menu-line"><span>Chicken Enchiladas</span><strong>$0.00</strong></div></article>
      <article class="menu-group"><h3>Tortas & Sides</h3><div class="menu-line"><span>Torta Ahogada Style</span><strong>$0.00</strong></div><div class="menu-line"><span>Rice & Beans</span><strong>$0.00</strong></div><div class="menu-line"><span>Fresh Salsas</span><strong>$0.00</strong></div></article>
    </div>
  </div>
</section>
<section class="section section-cream with-divider" id="clover-order" style="--section-next: #0b7a3b;">
  <div class="container" data-reveal>
    <div class="cta-band">
      <div>
        <p class="kicker" style="color:var(--color-green);">Clover-ready ordering shell</p>
        <h2 class="section-title">Embed the online ordering experience or switch to a direct order button.</h2>
      </div>
      <a class="button order-pill" data-order-link href="#">Order Online</a>
    </div>
    <div class="ordering-shell" data-order-block style="margin-top:1.4rem;">
      <div class="ordering-note-disabled">Online ordering is currently disabled in <code>assets/js/config.js</code>. The menu above remains visible at all times.</div>
      <iframe class="ordering-frame" data-order-embed title="Victor's Mexican Food online ordering"></iframe>
    </div>
  </div>
</section>
<section class="section section-green" id="faq-menu">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker">Built for operational flexibility</p>
      <h2 class="section-title">How this menu system is set up</h2>
      <ul class="icon-list">
        <li>Keep a branded house menu on the site no matter what.</li>
        <li>Toggle Clover embeds or order links in one place.</li>
        <li>Swap to API-driven ordering later without redesigning the page.</li>
        <li>Use this same layout for catering, specials, and holiday items.</li>
      </ul>
    </div>
    <div class="card" style="color:var(--color-white);">
      <h3>Recommended next step</h3>
      <p>Add a live Clover menu URL or API-powered experience to the config file and replace placeholder prices and items with final menu data.</p>
    </div>
  </div>
</section>
'''

reviews_content_en = '''
<section class="page-hero">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Home</a> / Reviews</div>
    <p class="kicker">Social proof with room to grow</p>
    <h1 class="page-title">A polished reviews page that supports trust and local credibility.</h1>
    <p class="hero-copy">This page is ready for curated testimonials, platform widgets, screenshots, and direct links to review profiles.</p>
  </div>
</section>
<section class="section section-white with-divider" style="--section-next: #fbf4ea;">
  <div class="container grid-3" data-reveal>
    <article class="card review-card"><blockquote>“Fresh, comforting, and full of flavor. The atmosphere feels personal in the best way.”</blockquote><cite>Google review highlight</cite></article>
    <article class="card review-card"><blockquote>“A local favorite for a reason. Warm service, consistent food, and an easy place to bring family.”</blockquote><cite>Yelp review highlight</cite></article>
    <article class="card review-card"><blockquote>“The story behind the restaurant makes the experience even better. You can feel the pride in the food.”</blockquote><cite>Guest testimonial</cite></article>
  </div>
</section>
<section class="section section-cream with-divider" style="--section-next: #0b7a3b;">
  <div class="container grid-2" data-reveal>
    <div>
      <p class="kicker" style="color:var(--color-red);">Review platforms</p>
      <h2 class="section-title">Direct guests where they already trust local recommendations.</h2>
      <div class="social-links">
        <a href="https://www.yelp.com/biz/victor-s-mexican-food-palm-desert-3">Open Yelp</a>
        <a href="#">Google Business Profile</a>
        <a href="https://www.facebook.com/victorsmexicanfood/">Facebook</a>
      </div>
    </div>
    <div class="card"><h3>Review widget ready</h3><p>Embed a platform widget, screenshot carousel, or custom testimonial slider here without changing the structure of the page.</p></div>
  </div>
</section>
<section class="section section-green">
  <div class="container" data-reveal>
    <div class="cta-band">
      <div>
        <h2 class="section-title">Great food deserves strong word of mouth.</h2>
        <p class="lead">Invite happy guests to share their experience after pickup, dine-in, or family meals.</p>
      </div>
      <a class="button" href="/contact/">Visit Victor’s</a>
    </div>
  </div>
</section>
'''

faq_content_en = '''
<section class="page-hero">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Home</a> / FAQ</div>
    <p class="kicker">Helpful answers for guests and search</p>
    <h1 class="page-title">Frequently asked questions about Victor’s Mexican Food.</h1>
    <p class="hero-copy">The answers below are written for both visitors and SEO, with clear language that can be edited easily later.</p>
  </div>
</section>
<section class="section section-white">
  <div class="container" data-reveal>
    <details class="faq-item" open><summary>What makes Victor’s Mexican Food different?</summary><p>Victor’s Mexican Food centers freshness, from-scratch cooking, and family hospitality. The restaurant’s story, visual identity, and menu are all rooted in Victor’s heritage and years of culinary work in the Coachella Valley.</p></details>
    <details class="faq-item"><summary>Do you offer online ordering?</summary><p>Yes. The website is built to support online ordering through Clover or a direct API-powered experience. Ordering can also be turned off while the menu remains visible.</p></details>
    <details class="faq-item"><summary>Where is Victor’s Mexican Food located?</summary><p>You can find Victor’s Mexican Food at 74600 CA-111 Suite F, Palm Desert, CA 92260.</p></details>
    <details class="faq-item"><summary>What are your hours?</summary><p>Victor’s Mexican Food is open daily from 8:30 AM to 8:00 PM.</p></details>
    <details class="faq-item"><summary>Is the site available in English and Spanish?</summary><p>Yes. The build includes a dedicated English and Spanish page set with alternate language signals and localized navigation.</p></details>
    <details class="faq-item"><summary>Can you update the menu and videos later?</summary><p>Absolutely. Menu items, prices, videos, photos, metadata, and page content are all easy to update in the static files.</p></details>
  </div>
</section>
'''

contact_content_en = '''
<section class="page-hero small">
  <div class="container">
    <div class="breadcrumbs"><a href="/">Home</a> / Contact</div>
    <p class="kicker">Visit, call, map, and social</p>
    <h1 class="page-title">Contact Victor’s Mexican Food.</h1>
    <p class="hero-copy">Everything guests need to visit, call, follow, or get directions in one polished place.</p>
  </div>
</section>
<section class="section section-white with-divider" style="--section-next: #fbf4ea;">
  <div class="container grid-2" data-reveal>
    <div>
      <h2 class="section-title">Plan your visit</h2>
      <div class="contact-list">
        <p><strong>Address</strong><br>74600 CA-111 Suite F, Palm Desert, CA 92260</p>
        <p><strong>Phone</strong><br><a href="tel:+17603413553">(760) 341-3553</a></p>
        <p><strong>Instagram</strong><br><a href="https://www.instagram.com/victorsmexicanfood">@victorsmexicanfood</a></p>
        <p><strong>Facebook</strong><br><a href="https://www.facebook.com/victorsmexicanfood/">Victor’s Mexican Food</a></p>
      </div>
    </div>
    <div class="card">
      <h3>Hours</h3>
      <div class="hours-list">''' + ''.join([f'<div class="hours-row"><span>{d}</span><strong>{h}</strong></div>' for d,h in hours_en]) + '''</div>
    </div>
  </div>
</section>
<section class="section section-cream with-divider" style="--section-next: #0b7a3b;">
  <div class="container" data-reveal>
    <div class="media-frame" style="min-height:420px;">
      <iframe data-map-embed title="Map to Victor's Mexican Food" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>
  </div>
</section>
<section class="section section-green">
  <div class="container grid-2" data-reveal>
    <div>
      <h2 class="section-title">Need a branded contact form later?</h2>
      <p class="lead">This page is ready for a custom accessible form, CRM connection, event inquiries, or catering requests whenever you want to add them.</p>
    </div>
    <div class="card" style="color:var(--color-white);">
      <h3>Ordering CTA</h3>
      <a class="button order-pill" data-order-link href="#">Order Online</a>
    </div>
  </div>
</section>
'''

policy_en = '''
<section class="page-hero small"><div class="container"><div class="breadcrumbs"><a href="/">Home</a> / Privacy Policy</div><p class="kicker">Privacy and transparency</p><h1 class="page-title">Privacy Policy</h1><p class="hero-copy">This policy explains how website information may be collected, used, and protected.</p></div></section>
<section class="section section-white"><div class="container" data-reveal><div class="grid-2"><div><h2 class="section-title">Information we may collect</h2><p>When visitors interact with the website, information such as analytics data, referral information, device information, or details submitted through future contact or ordering tools may be processed to improve performance and service.</p><h2 class="section-title">How information may be used</h2><p>Information may be used to respond to inquiries, improve the visitor experience, support site performance, manage online ordering connections, and maintain security.</p></div><div><h2 class="section-title">Third-party services</h2><p>This website may connect with services such as Netlify, analytics tools, maps, social platforms, Clover, and future embedded media or CRM tools. Those providers may process data according to their own policies.</p><h2 class="section-title">Questions</h2><p>For privacy questions related to Victor’s Mexican Food, please contact the restaurant directly at <a href="tel:+17603413553">(760) 341-3553</a>.</p></div></div></div></section>
'''
terms_en = '''
<section class="page-hero small"><div class="container"><div class="breadcrumbs"><a href="/">Home</a> / Terms</div><p class="kicker">Website use terms</p><h1 class="page-title">Terms of Service</h1><p class="hero-copy">These terms describe general use of the Victor’s Mexican Food website.</p></div></section>
<section class="section section-white"><div class="container" data-reveal><div class="grid-2"><div><h2 class="section-title">General use</h2><p>Website content is provided for informational and promotional purposes and may be updated without notice. Visitors should confirm menu items, hours, and ordering availability directly when needed.</p><h2 class="section-title">Ordering and third parties</h2><p>If online ordering is enabled, transactions may be processed through third-party services such as Clover or other integrated providers.</p></div><div><h2 class="section-title">Content and brand assets</h2><p>Website text, branding, imagery, and design are protected and should not be reused without permission.</p><h2 class="section-title">Availability</h2><p>While the site is built for reliable performance, uninterrupted access cannot be guaranteed at all times.</p></div></div></div></section>
'''

# Spanish pages adapt succinctly
home_content_es = home_content_en.replace('Fresh · From Scratch · Family Owned in Palm Desert','Fresco · Hecho desde cero · Familiar en Palm Desert').replace('Authentic Mexican food with a story worth sharing.','Comida mexicana auténtica con una historia que vale la pena compartir.').replace('Victor\'s Mexican Food brings together fresh ingredients, made-from-scratch cooking, and generations of hard work inspired by Victor’s family roots in El Malacate, Zacatecas. Every plate is designed to feel generous, vibrant, and genuinely welcoming.','Victor\'s Mexican Food reúne ingredientes frescos, cocina hecha desde cero y generaciones de trabajo inspiradas por las raíces de Victor en El Malacate, Zacatecas. Cada platillo está pensado para sentirse abundante, vibrante y genuinamente acogedor.').replace('Order Online','Ordenar en línea').replace('Explore the Menu','Explorar el menú').replace('Fresh daily','Fresco todos los días').replace('No cans, no shortcuts, real kitchen flavor.','Sin latas, sin atajos, sabor real de cocina.').replace('Family legacy','Legado familiar').replace('A Palm Desert restaurant built on Zacatecas roots.','Un restaurante en Palm Desert construido sobre raíces de Zacatecas.').replace('Easy ordering','Pedidos fáciles').replace('Clover-ready menu with online ordering controls built in.','Menú listo para Clover con controles integrados de pedidos.').replace('A live-feeling first impression','Una primera impresión que se siente viva').replace('A bold restaurant site made to feel warm, rooted, and ready to order.','Un sitio atractivo, cálido y listo para convertir visitas en pedidos.').replace('Read Our Story','Leer nuestra historia').replace('Plan a Visit','Planear una visita').replace('Why guests keep coming back','Por qué regresan los clientes').replace('Big flavor, hospitality, and an honest made-from-scratch kitchen.','Gran sabor, hospitalidad y una cocina honesta hecha desde cero.').replace('Start an Order','Comenzar pedido').replace('Fresh ingredients first','Primero los ingredientes frescos').replace('Built on family values','Hecho con valores familiares').replace('Ready for everyday ordering','Listo para pedidos diarios').replace('Victor moved to the Coachella Valley','Victor llegó al Valle de Coachella').replace('Restaurant opened on December 15','El restaurante abrió el 15 de diciembre').replace('Moved to a prime location on CA-111','Se mudó a una ubicación clave en CA-111').replace('Years of life and work in the U.S.','Años de vida y trabajo en Estados Unidos').replace('From El Malacate to Palm Desert','De El Malacate a Palm Desert').replace('The hometown story is part of the atmosphere, not just the biography.','La historia del pueblo forma parte de la atmósfera, no solo de la biografía.').replace('The hometown story is part of the atmosphere, not just the biography.','La historia del pueblo forma parte de la atmósfera, no solo de la biografía.').replace('Produced video spotlight','Espacio para video principal').replace('Feature a full brand film, chef story, or food-driven highlight reel.','Muestra un video principal de la marca, la historia del chef o un reel enfocado en la comida.').replace('Featured favorites','Favoritos destacados').replace('A clean, on-brand menu preview that leads naturally into full ordering.','Un adelanto del menú limpio y atractivo que conduce naturalmente al pedido completo.').replace('See Full Menu Experience','Ver menú completo').replace('Order for Pickup','Ordenar para recoger').replace('Reviews and trust','Reseñas y confianza').replace('A natural place for social proof, local credibility, and platform links.','Un espacio natural para prueba social, credibilidad local y enlaces a plataformas.').replace('View Review Highlights','Ver reseñas destacadas').replace('Open Yelp','Abrir Yelp').replace('Visit or order today','Visítanos u ordena hoy').replace('Victor’s Mexican Food is ready when you are.','Victor’s Mexican Food está listo cuando tú lo estés.').replace('Get Directions','Cómo llegar')
about_content_es = about_content_en.replace('About','Nosotros').replace('Family story · craftsmanship · hospitality','Historia familiar · oficio · hospitalidad').replace('A restaurant shaped by patience, resilience, and family pride.','Un restaurante formado por paciencia, resiliencia y orgullo familiar.').replace('The dream started young','El sueño empezó desde pequeño').replace('From watching a chef on television to wearing the coat for real.','De ver a un chef en la televisión a vestir la filipina de verdad.').replace('Camino Real legacy','Legado del Camino Real').replace('The family business spirit started with a general store on the old route.','El espíritu emprendedor familiar comenzó con una tienda en la antigua ruta.').replace('Life beyond the kitchen','Vida más allá de la cocina').replace('Family, faith, and white homing doves are part of the story too.','La familia, la fe y las palomas mensajeras blancas también forman parte de la historia.').replace('Produced story film','Video de historia de marca').replace('A second high-impact video area for deeper brand storytelling.','Una segunda área de video de alto impacto para profundizar la historia de la marca.').replace('Book a Visit','Planea tu visita')
menu_content_es = menu_content_en.replace('Menu','Menú').replace('Menu visibility with flexible ordering','Menú visible con pedidos flexibles').replace('A menu experience designed for discovery, appetite, and easy checkout.','Una experiencia de menú diseñada para abrir el apetito y facilitar el pedido.').replace('The menu always stays visible on-brand, while online ordering can be embedded, linked, or turned off in one config file.','El menú siempre permanece visible y la orden en línea puede incrustarse, enlazarse o desactivarse desde un solo archivo de configuración.').replace('Featured categories','Categorías destacadas').replace('Clover-ready ordering shell','Bloque de pedidos listo para Clover').replace('Embed the online ordering experience or switch to a direct order button.','Incrusta la experiencia de pedido o cambia a un botón directo.').replace('Order Online','Ordenar en línea').replace('Built for operational flexibility','Hecho para flexibilidad operativa').replace('How this menu system is set up','Cómo está preparado este sistema de menú').replace('Recommended next step','Siguiente paso recomendado')
reviews_content_es = reviews_content_en.replace('Reviews','Reseñas').replace('Social proof with room to grow','Prueba social con espacio para crecer').replace('A polished reviews page that supports trust and local credibility.','Una página de reseñas pulida que fortalece la confianza y la credibilidad local.').replace('Review platforms','Plataformas de reseñas').replace('Direct guests where they already trust local recommendations.','Lleva a tus clientes a las plataformas donde ya confían en recomendaciones locales.').replace('Great food deserves strong word of mouth.','La buena comida merece una reputación fuerte.').replace('Visit Victor’s','Visita Victor’s')
faq_content_es = faq_content_en.replace('FAQ','Preguntas').replace('Helpful answers for guests and search','Respuestas útiles para clientes y buscadores').replace('Frequently asked questions about Victor’s Mexican Food.','Preguntas frecuentes sobre Victor’s Mexican Food.').replace('The answers below are written for both visitors and SEO, with clear language that can be edited easily later.','Las respuestas de abajo están escritas para visitantes y SEO, con lenguaje claro y fácil de editar.')
contact_content_es = contact_content_en.replace('Contact','Contacto').replace('Visit, call, map, and social','Visita, llamada, mapa y redes').replace('Contact Victor’s Mexican Food.','Contacta a Victor’s Mexican Food.').replace('Everything guests need to visit, call, follow, or get directions in one polished place.','Todo lo que una persona necesita para visitar, llamar, seguir o llegar, en un solo lugar pulido.').replace('Plan your visit','Planea tu visita').replace('Hours','Horario').replace('Need a branded contact form later?','¿Necesitas un formulario de contacto más adelante?').replace('Ordering CTA','Llamado a ordenar')
policy_es = policy_en.replace('Privacy Policy','Política de Privacidad').replace('Privacy and transparency','Privacidad y transparencia').replace('This policy explains how website information may be collected, used, and protected.','Esta política explica cómo se puede recopilar, usar y proteger la información del sitio web.')
terms_es = terms_en.replace('Terms of Service','Términos de Servicio').replace('Website use terms','Términos de uso del sitio').replace('These terms describe general use of the Victor’s Mexican Food website.','Estos términos describen el uso general del sitio web de Victor’s Mexican Food.')

pages = {
    root/'index.html': page("Victor's Mexican Food | Fresh Mexican Food in Palm Desert", "Discover Victor's Mexican Food in Palm Desert for fresh, from-scratch Mexican favorites, family hospitality, and a story rooted in Zacatecas.", site_url+'/', home_content_en, 'en', 'Home'),
    root/'about'/'index.html': page("About | Victor's Mexican Food", "Learn the story behind Victor's Mexican Food, from El Malacate, Zacatecas to Palm Desert, California.", site_url+'/about/', about_content_en, 'en', 'About'),
    root/'menu'/'index.html': page("Menu & Ordering | Victor's Mexican Food", "Explore the menu and online ordering experience for Victor's Mexican Food in Palm Desert.", site_url+'/menu/', menu_content_en, 'en', 'Menu'),
    root/'reviews'/'index.html': page("Reviews | Victor's Mexican Food", "See how Victor's Mexican Food can showcase local trust, guest feedback, and review-driven credibility.", site_url+'/reviews/', reviews_content_en, 'en', 'Reviews'),
    root/'faq'/'index.html': page("FAQ | Victor's Mexican Food", "Get answers about hours, location, ordering, language support, and website features for Victor's Mexican Food.", site_url+'/faq/', faq_content_en, 'en', 'FAQ', extra_schema=[{'@type':'FAQPage','mainEntity':[{'@type':'Question','name':'What makes Victor’s Mexican Food different?','acceptedAnswer':{'@type':'Answer','text':'Victor’s Mexican Food centers freshness, from-scratch cooking, and family hospitality with a story rooted in Zacatecas and Palm Desert.'}},{'@type':'Question','name':'Do you offer online ordering?','acceptedAnswer':{'@type':'Answer','text':'Yes. The website supports online ordering through Clover or another integrated solution and can keep the menu visible even when ordering is turned off.'}}]}]),
    root/'contact'/'index.html': page("Contact | Victor's Mexican Food", "Find the address, phone number, hours, map, and social links for Victor's Mexican Food in Palm Desert.", site_url+'/contact/', contact_content_en, 'en', 'Contact'),
    root/'privacy-policy'/'index.html': page("Privacy Policy | Victor's Mexican Food", "Read the Victor's Mexican Food website privacy policy.", site_url+'/privacy-policy/', policy_en, 'en', 'Privacy Policy'),
    root/'terms'/'index.html': page("Terms of Service | Victor's Mexican Food", "Read the website terms of service for Victor's Mexican Food.", site_url+'/terms/', terms_en, 'en', 'Terms'),
    root/'404.html': page("Page Not Found | Victor's Mexican Food", "The page you were looking for could not be found.", site_url+'/404.html', '<section class="page-hero small"><div class="container"><p class="kicker">404</p><h1 class="page-title">That page isn’t on the menu.</h1><p class="hero-copy">Try the homepage, menu, or contact page to keep exploring Victor’s Mexican Food.</p><div class="hero-actions"><a class="button" href="/">Go Home</a><a class="button-secondary" href="/menu/">Open Menu</a></div></div></section>', 'en', '404'),
    root/'es'/'index.html': page("Victor's Mexican Food | Comida mexicana fresca en Palm Desert", "Descubre Victor's Mexican Food en Palm Desert para disfrutar sabores mexicanos frescos, hechos desde cero y con una historia familiar inspirada en Zacatecas.", site_url+'/es/', home_content_es, 'es', 'Inicio'),
    root/'es'/'about'/'index.html': page("Nosotros | Victor's Mexican Food", "Conoce la historia detrás de Victor's Mexican Food, desde El Malacate, Zacatecas hasta Palm Desert, California.", site_url+'/es/about/', about_content_es, 'es', 'Nosotros'),
    root/'es'/'menu'/'index.html': page("Menú y pedidos | Victor's Mexican Food", "Explora el menú y la experiencia de pedido en línea de Victor's Mexican Food en Palm Desert.", site_url+'/es/menu/', menu_content_es, 'es', 'Menú'),
    root/'es'/'reviews'/'index.html': page("Reseñas | Victor's Mexican Food", "Mira cómo Victor's Mexican Food puede mostrar confianza local, comentarios de clientes y credibilidad.", site_url+'/es/reviews/', reviews_content_es, 'es', 'Reseñas'),
    root/'es'/'faq'/'index.html': page("Preguntas | Victor's Mexican Food", "Obtén respuestas sobre horarios, ubicación, pedidos y soporte bilingüe para Victor's Mexican Food.", site_url+'/es/faq/', faq_content_es, 'es', 'Preguntas'),
    root/'es'/'contact'/'index.html': page("Contacto | Victor's Mexican Food", "Encuentra dirección, teléfono, horario, mapa y redes sociales de Victor's Mexican Food en Palm Desert.", site_url+'/es/contact/', contact_content_es, 'es', 'Contacto'),
    root/'es'/'privacy-policy'/'index.html': page("Política de Privacidad | Victor's Mexican Food", "Lee la política de privacidad del sitio web de Victor's Mexican Food.", site_url+'/es/privacy-policy/', policy_es, 'es', 'Política de Privacidad'),
    root/'es'/'terms'/'index.html': page("Términos de Servicio | Victor's Mexican Food", "Lee los términos de servicio del sitio web de Victor's Mexican Food.", site_url+'/es/terms/', terms_es, 'es', 'Términos'),
}

for path, html in pages.items():
    path.write_text(html, encoding='utf-8')

robots = f"User-agent: *\nAllow: /\nSitemap: {site_url}/sitemap.xml\n"
(root/'robots.txt').write_text(robots)

sitemap_urls = [
    '/', '/about/', '/menu/', '/reviews/', '/faq/', '/contact/', '/privacy-policy/', '/terms/',
    '/es/', '/es/about/', '/es/menu/', '/es/reviews/', '/es/faq/', '/es/contact/', '/es/privacy-policy/', '/es/terms/'
]
sitemap = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
for u in sitemap_urls:
    sitemap.append(f'  <url><loc>{site_url}{u}</loc></url>')
sitemap.append('</urlset>')
(root/'sitemap.xml').write_text('\n'.join(sitemap))

netlify = '''[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/404.html"
  status = 404
'''
(root/'netlify.toml').write_text(netlify)

readme = '''# Victor's Mexican Food Static Website

## Stack
- Static HTML/CSS/JS
- Ready for GitHub + Netlify
- Accessible navigation and semantic structure
- English and Spanish page sets
- Clover-friendly ordering toggle in `assets/js/config.js`

## Quick edits
1. Replace placeholder media in `assets/img/` and `assets/video/`.
2. Add final Clover URLs in `assets/js/config.js`.
3. Update menu items/pricing in `/menu/index.html` and `/es/menu/index.html`.
4. Add final Google Business URL if desired.
5. Replace about:blank video embeds with final hosted videos.

## Ordering toggle
- `orderingEnabled: true/false`
- `cloverMenuEmbedUrl: ''`
- `cloverOrderingUrl: ''`

## Notes
- Section dividers use CSS custom properties and can be recolored via `--section-next`.
- Replace favicon placeholders before launch.
- OG image path is prepared but still needs a final asset.
'''
(root/'README.md').write_text(readme)
