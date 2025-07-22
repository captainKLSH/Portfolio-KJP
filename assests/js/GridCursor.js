// Dot grid
let cols = 0;
let rows = 0;
let animationFrameId;

function fillGrid() {
  const grid = document.getElementById('grid');
  cols = Math.floor(window.innerWidth / 20);
  rows = Math.floor(window.innerHeight / 20);
  grid.style.gridTemplateColumns = `repeat(${cols}, 20px)`;
  grid.style.gridTemplateRows = `repeat(${rows}, 20px)`;
  grid.innerHTML = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dot = document.createElement('div');
      dot.className = 'dot';
      dot.dataset.x = x;
      dot.dataset.y = y;
      grid.appendChild(dot);
    }
  }
}

window.addEventListener('resize', fillGrid);
window.addEventListener('DOMContentLoaded', fillGrid);

document.addEventListener('mousemove', (e) => {
  const grid = document.getElementById('grid');
  if (!grid) return;
  const dots = document.querySelectorAll('.dot');
  const gridRect = grid.getBoundingClientRect();

  dots.forEach(dot => {
    const x = parseInt(dot.dataset.x);
    const y = parseInt(dot.dataset.y);
    // Calculate dot's center position
    const dotX = gridRect.left + (x + 0.5) * (gridRect.width / cols);
    const dotY = gridRect.top + (y + 0.5) * (gridRect.height / rows);
    // Vector from dot to mouse
    const dx = e.clientX - dotX;
    const dy = e.clientY - dotY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    // Warp strength: closer dots move more
    const maxDist = 80; // pixels
    const strength = Math.max(0, 1 - dist / maxDist);
    // Apply transform (warp more near cursor)
    dot.style.transform = `translate(${dx * 0.8  * strength}px, ${dy *0.8 * strength}px) scale(${1 + 2 * strength})`;
  });
});

// Trailing cursor circles
const coords = { x: 0, y: 0 };
const circles = document.querySelectorAll(".circle");
const circle3 = document.querySelector(".circle1");
circles.forEach(function (circle, index) {
  circle.x = 0;
  circle.y = 0;
});
window.addEventListener('mousemove', function(e) {
  const x = e.clientX;
  const y = e.clientY;
  circle3.style.left = (x - 12) + "px";
  circle3.style.top = (y - 12) + "px";
});
window.addEventListener("mousemove", function(e){
  coords.x = e.clientX;
  coords.y = e.clientY;
});

function animateCircles() {
  let x = coords.x;
  let y = coords.y;

  circles.forEach(function (circle, index) {
    circle.style.left = x - 12 + "px";
    circle.style.top = y - 12 + "px";

    circle.style.scale = (circles.length - index) / circles.length;

    circle.x = x;
    circle.y = y;

    const nextCircle = circles[index + 1] || circles[0];
    x += (nextCircle.x - x) * 0.3;
    y += (nextCircle.y - y) * 0.3;
  });

  requestAnimationFrame(animateCircles);
}
animateCircles();