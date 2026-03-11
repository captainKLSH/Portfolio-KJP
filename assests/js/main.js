/* ============== Theme toggle ============== */
const html = document.documentElement;

function toggleTheme() {
  html.classList.toggle('dark-theme');
  localStorage.setItem('theme', html.classList.contains('dark-theme') ? 'dark' : 'light');
}

document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-mobile').addEventListener('click', toggleTheme);

// FIX #4: Single source of truth for theme init — removed duplicate from rain.js
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

/* =============== REMOVE MENU ON LINK CLICK (mobile) =============== */
document.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    document.getElementById('nav-menu').classList.remove('show-menu');
  });
});

/* =============== FOOTER — year =============== */
document.getElementById('year').textContent = new Date().getFullYear();

/* =============== SCROLL-TO-TOP ===============
   FIX #5: Removed duplicate scroll listener and inline style.display toggling.
   Visibility is now handled entirely via CSS .visible class (opacity + pointer-events).
   The .scroll-to-top base rule in styles.css must use opacity:0, not display:none. */
const scrollToTopBtn = document.getElementById('scrollToTopBtn');

window.addEventListener('scroll', () => {
  scrollToTopBtn.classList.toggle('visible', window.scrollY > 300);
});

scrollToTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});