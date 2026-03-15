/*============== Theme toggle ============== */
const html = document.documentElement;
function toggleTheme() {
  html.classList.toggle('dark-theme');
  localStorage.setItem('theme', html.classList.contains('dark-theme') ? 'dark' : 'light');
}
document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
document.getElementById('theme-toggle-mobile').addEventListener('click', toggleTheme);

// On page load, apply saved theme
if (localStorage.getItem('theme') === 'dark') {
  html.classList.add('dark-theme');
}


/*=============== SHOW MENU ===============*/
const navMenu=document.getElementById('nav-menu'),
navToggle=document.getElementById('nav-toggle'),
navClose=document.getElementById('nav-close')
// Menu show
if(navToggle){
    navToggle.addEventListener('click',()=>{
        navMenu.classList.add('show-menu')
    })
}
// Menu hidden
if(navClose){
    navClose.addEventListener('click',()=>{
        navMenu.classList.remove('show-menu')
    })
}
/*=============== REMOVE MENU MOBILE ===============*/
const navLink = document.querySelectorAll('.nav__link')
const linkAction = () =>{
    const navMenu = document.getElementById('nav-menu')
    navMenu.classList.remove('show-menu')
}
navLink.forEach(n=>n.addEventListener('click', linkAction))

/*=============== Footer ===============*/ 
document.getElementById("year").textContent = new Date().getFullYear();
// Scroll to top button logic
  const scrollToTopBtn = document.getElementById("scrollToTopBtn");

  window.addEventListener("scroll", () => {
    scrollToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
  });
  window.addEventListener("scroll", () => {
    scrollToTopBtn.classList.toggle("visible", window.scrollY > 300);
  });

  scrollToTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });


