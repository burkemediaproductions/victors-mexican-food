
(() => {
  const body = document.body;
  const menuToggle = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.getElementById('mobile-menu');
  const closeBtn = document.querySelector('[data-menu-close]');
  const yearNodes = document.querySelectorAll('[data-year]');
  yearNodes.forEach(n => n.textContent = new Date().getFullYear());

  const syncHeaderState = () => {
    body.classList.toggle('scrolled', window.scrollY > 24);
  };
  syncHeaderState();
  window.addEventListener('scroll', syncHeaderState, { passive: true });

  const setMenuState = (open) => {
    if (!mobileMenu || !menuToggle) return;
    menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    mobileMenu.hidden = !open;
    body.classList.toggle('menu-open', open);
    requestAnimationFrame(() => mobileMenu.classList.toggle('is-open', open));
    if (open) {
      mobileMenu.querySelector('a')?.focus();
    } else {
      menuToggle.focus();
    }
  };
  menuToggle?.addEventListener('click', () => setMenuState(menuToggle.getAttribute('aria-expanded') !== 'true'));
  closeBtn?.addEventListener('click', () => setMenuState(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenuState(false); });
  mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenuState(false)));

  const map = document.querySelector('[data-map]');
  if (map && window.VICTORS_CONFIG?.mapsEmbedUrl) map.src = window.VICTORS_CONFIG.mapsEmbedUrl;

  const orderLinks = document.querySelectorAll('[data-order-link]');
  const orderWraps = document.querySelectorAll('[data-order-wrap]');
  const orderFrames = document.querySelectorAll('[data-order-frame]');
  const cfg = window.VICTORS_CONFIG || {};

  orderLinks.forEach(link => {
    const href = link.getAttribute('href') || '';

    // Keep in-page ordering buttons pointed at the on-site menu app so the
    // Netlify ordering schedule can control whether users can add/checkout.
    if (href.startsWith('#')) return;

    if (cfg.orderingEnabled && cfg.cloverOrderingUrl) link.href = cfg.cloverOrderingUrl;
  });
  orderFrames.forEach(frame => {
    if (cfg.orderingEnabled && cfg.cloverMenuEmbedUrl) {
      frame.src = cfg.cloverMenuEmbedUrl;
      frame.hidden = false;
    } else {
      frame.hidden = true;
    }
  });
  orderWraps.forEach(wrap => {
    if (!cfg.orderingEnabled) wrap.classList.add('is-disabled');
  });

  const revealEls = document.querySelectorAll('[data-reveal]');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, {threshold: .15});
    revealEls.forEach(el => io.observe(el));
  } else {
    revealEls.forEach(el => el.classList.add('revealed'));
  }
})();


const heroVideo = document.querySelector('.hero-media');

if (heroVideo) {
  const heroMq = window.matchMedia('(max-width: 767px)');
  let activeVideoSrc = '';

  const setHeroVideoSource = () => {
    const desktopSrc = heroVideo.dataset.videoDesktop || '';
    const mobileSrc = heroVideo.dataset.videoMobile || '';
    const nextSrc = heroMq.matches ? mobileSrc : desktopSrc;

    if (!nextSrc || nextSrc === activeVideoSrc) return;

    const wasPlaying = !heroVideo.paused;

    heroVideo.pause();
    heroVideo.removeAttribute('src');
    while (heroVideo.firstChild) {
      heroVideo.removeChild(heroVideo.firstChild);
    }
    heroVideo.load();

    heroVideo.src = nextSrc;
    heroVideo.load();

    const playPromise = heroVideo.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }

    activeVideoSrc = nextSrc;
  };

  setHeroVideoSource();

  if (typeof heroMq.addEventListener === 'function') {
    heroMq.addEventListener('change', setHeroVideoSource);
  } else if (typeof heroMq.addListener === 'function') {
    heroMq.addListener(setHeroVideoSource);
  }
}


const normalizePath = (path) => {
  if (!path) return '/';
  try {
    const url = new URL(path, window.location.origin);
    let p = url.pathname;
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p || '/';
  } catch {
    return '/';
  }
};

const currentPath = normalizePath(window.location.pathname);

document.querySelectorAll('.nav-links a, .mobile-menu nav a').forEach((link) => {
  const linkPath = normalizePath(link.getAttribute('href'));

  if (linkPath === currentPath) {
    link.setAttribute('aria-current', 'page');
    link.classList.add('is-active');
  }
});

// ===== REVIEWS CAROUSEL =====
(() => {
  const carousel = document.querySelector('[data-reviews-carousel]');
  if (!carousel) return;

  const viewport = carousel.querySelector('[data-reviews-viewport]');
  const track = carousel.querySelector('.reviews-track');
  const slides = Array.from(track.children);
  const prevBtn = carousel.querySelector('[data-reviews-prev]');
  const nextBtn = carousel.querySelector('[data-reviews-next]');
  const dotsWrap = carousel.querySelector('[data-reviews-dots]');

  let currentIndex = 0;
  let slidesPerView = getSlidesPerView();
  let totalPages = Math.ceil(slides.length / slidesPerView);
  let autoplayInterval;

  function getSlidesPerView() {
    return window.innerWidth <= 980 ? 1 : 3;
  }

  function updateLayout() {
    slidesPerView = getSlidesPerView();
    totalPages = Math.ceil(slides.length / slidesPerView);
    goToSlide(0, false);
    buildDots();
  }

  function getSlideWidth() {
    const slide = slides[0];
    const style = window.getComputedStyle(track);
    const gap = parseFloat(style.columnGap || style.gap || 0);
    return slide.offsetWidth + gap;
  }

  function goToSlide(index, smooth = true) {
    currentIndex = Math.max(0, Math.min(index, totalPages - 1));

    const slideWidth = getSlideWidth();
    const scrollX = slideWidth * slidesPerView * currentIndex;

    viewport.scrollTo({
      left: scrollX,
      behavior: smooth ? 'smooth' : 'auto'
    });

    updateDots();
  }

  function next() {
    if (currentIndex >= totalPages - 1) {
      goToSlide(0);
    } else {
      goToSlide(currentIndex + 1);
    }
  }

  function prev() {
    if (currentIndex <= 0) {
      goToSlide(totalPages - 1);
    } else {
      goToSlide(currentIndex - 1);
    }
  }

  function buildDots() {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = '';

    for (let i = 0; i < totalPages; i++) {
      const dot = document.createElement('button');
      dot.className = 'reviews-dot';
      dot.setAttribute('aria-label', `Go to review page ${i + 1}`);
      dot.addEventListener('click', () => goToSlide(i));
      dotsWrap.appendChild(dot);
    }

    updateDots();
  }

  function updateDots() {
    if (!dotsWrap) return;
    const dots = dotsWrap.querySelectorAll('.reviews-dot');

    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === currentIndex);
    });
  }

  function startAutoplay() {
    stopAutoplay();
    autoplayInterval = setInterval(next, 5000);
  }

  function stopAutoplay() {
    if (autoplayInterval) clearInterval(autoplayInterval);
  }

  // Events
  nextBtn?.addEventListener('click', () => {
    next();
    stopAutoplay();
  });

  prevBtn?.addEventListener('click', () => {
    prev();
    stopAutoplay();
  });

  viewport.addEventListener('mouseenter', stopAutoplay);
  viewport.addEventListener('mouseleave', startAutoplay);
  viewport.addEventListener('focusin', stopAutoplay);
  viewport.addEventListener('focusout', startAutoplay);

  window.addEventListener('resize', () => {
    updateLayout();
  });

  // Init
  updateLayout();
  startAutoplay();

  // Randomize
  currentIndex = Math.floor(Math.random() * totalPages);
    goToSlide(currentIndex, false);
})();