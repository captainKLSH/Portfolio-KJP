
// ABOUT TOggel Section
const modeToggle = document.getElementById("abtToggle");
const official = document.querySelector(".about_block_official");
const unofficial = document.querySelector(".about_block_unofficial");

// Start with Official
official.classList.add("active");

modeToggle.addEventListener("click", () => {
  const isOfficial = official.classList.contains("active");

  if (isOfficial) {
    official.classList.remove("active");
    unofficial.classList.add("active");
    modeToggle.textContent = "Mode: FUN!!!";
  } else {
    unofficial.classList.remove("active");
    official.classList.add("active");
    modeToggle.textContent = "Mode: Official";
  }
});
// profile 

const buttons = document.querySelectorAll('.profile__btn');
const contents = document.querySelectorAll('.profile__content');

buttons.forEach(button => {
  button.addEventListener('click', () => {
    // Toggle active button
    buttons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');

    // Get target content ID
    const tab = button.getAttribute('data-tab');

    // Hide all content
    contents.forEach(content => {
      content.classList.remove('active-tab');
      content.style.display = 'none';
    });

    // Show selected content with slight delay for transition
    const target = document.getElementById(`${tab}-content`);
    target.style.display = 'block';
    requestAnimationFrame(() => {
      target.classList.add('active-tab');
    });
  });
});
// ROAD
document.addEventListener("DOMContentLoaded", function () {
    gsap.to(".road-line", {
      backgroundPosition: "-200px 0", // speed & direction
      duration: 2,
      ease: "none",
      repeat: -1
    });
  });

const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        
        // If the user scrolls to the graphic
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-path');
        } 
        // If the user scrolls away from the graphic
        else {
          entry.target.classList.remove('animate-path');
        }
        
      });
    }, {
      threshold: 0.5 // Triggers when 50% of the SVG is visible
    });

    // Find the graphic and tell the observer to watch it
    const elementsToWatch = document.querySelectorAll('.scroll-trigger');
    elementsToWatch.forEach((element) => {
      observer.observe(element);
    });

