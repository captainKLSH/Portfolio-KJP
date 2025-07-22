const titles = [
    "Data Scientist",
    "Data Analyst",
    "Machine Learning Engineer",
    "Artificial Intelligence Engineer",
    "Chemical Engineer"
];

let currentTitleIndex = 0;

// Custom scramble function
function scrambleWord(element, finalText, duration = 20, scrambleChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*") {
    const length = finalText.length;
    let frame = 0;
    const totalFrames = Math.floor(duration * 60); // 60fps
    let scrambleInterval;

    function randomChar() {
    return scrambleChars[Math.floor(Math.random() * scrambleChars.length)];
    }

    function scrambleStep() {
    frame++;
    let displayed = '';
    for (let i = 0; i < length; i++) {
        if (frame < totalFrames && Math.random() > frame / totalFrames) {
        displayed += randomChar();
        } else {
        displayed += finalText[i];
        }
    }
    element.textContent = displayed;
    if (frame >= totalFrames) {
        clearInterval(scrambleInterval);
        element.textContent = finalText;
    }
    }

    scrambleInterval = setInterval(scrambleStep, 1000 / 60);
}

function getUniqueWords(currentTitle, previousTitle) {
    const currentWords = currentTitle.toLowerCase().split(' ');
    const previousWords = previousTitle ? previousTitle.toLowerCase().split(' ') : [];
    return currentWords.filter(word => !previousWords.includes(word));
}

function createWordElements(title, uniqueWords) {
    const container = document.getElementById('title-container');
    container.innerHTML = '';
    title.split(' ').forEach((word, index, arr) => {
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = word;
    if (uniqueWords.includes(word.toLowerCase())) {
        span.dataset.scramble = "true";
    }
    container.appendChild(span);
    if (index < arr.length - 1) {
        container.appendChild(document.createTextNode(' '));
    }
    });

    // Add the cursor as the last child
    const cursor = document.createElement('div');
    cursor.id = 'scramble-cursor';
    container.appendChild(cursor);

    // Animate cursor blink
    gsap.to(cursor, {
    opacity: 0,
    repeat: -1,
    yoyo: true,
    duration: 0.8,
    ease: "power2.inOut"
    });
}

function animateTitle() {
    const currentTitle = titles[currentTitleIndex];
    const previousTitle = currentTitleIndex > 0 ? titles[currentTitleIndex - 1] : null;
    const uniqueWords = getUniqueWords(currentTitle, previousTitle);

    createWordElements(currentTitle, uniqueWords);

    // Animate scramble for unique words only
    document.querySelectorAll('.word').forEach((wordEl, index) => {
    if (wordEl.dataset.scramble) {
        setTimeout(() => {
        scrambleWord(wordEl, wordEl.textContent, 0.9 + index * 0.1);
        }, index * 100);
    }
    });

    currentTitleIndex = (currentTitleIndex + 1) % titles.length;
    setTimeout(animateTitle, 3000);
}

// Start animation
animateTitle();
document.addEventListener("DOMContentLoaded", function () {
    const aboutTitle = document.querySelector(".about__title");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("animate-path");
          } else {
            entry.target.classList.remove("animate-path"); // Reset on exit
          }
        });
      },
      {
        threshold: 0.5,
      }
    );

    if (aboutTitle) {
      observer.observe(aboutTitle);
    }
  });

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


