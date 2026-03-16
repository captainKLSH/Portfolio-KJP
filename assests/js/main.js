/* ============== Theme toggle ============== */
const html = document.documentElement;

function toggleTheme() {
  html.classList.toggle('dark-theme');
  localStorage.setItem('theme', html.classList.contains('dark-theme') ? 'dark' : 'light');
  /* Let the dock (and any other resize-aware components) recalculate after repaint */
  window.dispatchEvent(new Event('resize'));
}

/* Guard — these buttons only exist on pages that have the full nav */
const themeToggle       = document.getElementById('theme-toggle');
const themeToggleMobile = document.getElementById('theme-toggle-mobile');
if (themeToggle)       themeToggle.addEventListener('click', toggleTheme);
if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);

/* On page load, apply saved theme */
if (localStorage.getItem('theme') === 'dark') {
  html.classList.add('dark-theme');
}

/* =============== SHOW MENU =============== */
const navMenu   = document.getElementById('nav-menu');
const navToggle = document.getElementById('nav-toggle');
const navClose  = document.getElementById('nav-close');

if (navToggle) {
  navToggle.addEventListener('click', () => navMenu.classList.add('show-menu'));
}
if (navClose) {
  navClose.addEventListener('click', () => navMenu.classList.remove('show-menu'));
}

/* =============== REMOVE MENU MOBILE =============== */
document.querySelectorAll('.nav__link').forEach(n =>
  n.addEventListener('click', () => {
    const navMenu = document.getElementById('nav-menu');
    if (navMenu) navMenu.classList.remove('show-menu');
  })
);

/* =============== Footer year =============== */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* =============== Scroll-to-top =============== */
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
if (scrollToTopBtn) {
  window.addEventListener('scroll', () => {
    scrollToTopBtn.classList.toggle('visible', window.scrollY > 300);
  });
  scrollToTopBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}