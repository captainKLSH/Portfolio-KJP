document.addEventListener("DOMContentLoaded", function() {
  const lines = ["t1","t2","t3","t4","t5"].map(id => document.getElementById(id));
  let repeatCount = 0;
  const maxRepeats = 2; // Will play 3 times total

  function setupLines() {
    lines.forEach(line => {
      const length = line.getTotalLength();
      line.style.strokeDasharray = length;
      line.style.strokeDashoffset = length;
      line.style.opacity = 1;
      line.style.transform = "scale(1)";
    });
  }

  function animatePreloader() {
    setupLines();
    const tl = gsap.timeline({
      defaults: {ease: "power2.inOut"},
      onComplete: () => {
        repeatCount++;
        if (repeatCount < maxRepeats) {
          setTimeout(animatePreloader, 400);
        } else {
          // Final expansion and hide preloader
          gsap.to(lines[4], {
            scale: 2.5,
            duration: 0.8,
            transformOrigin: "50% 50%",
            ease: "power2.inOut",
            onComplete: () => {
              gsap.to(".preloader", {
                opacity: 0,
                duration: 0.5,
                pointerEvents: "none",
                onComplete: () => {
                  document.querySelector(".preloader").style.display = "none";
                  document.querySelector(".main").style.display = "block";
                }
              });
            }
          });
        }
      }
    });

    // Animate first 4 lines
    lines.slice(0,4).forEach(line => {
      tl.to(line, {strokeDashoffset: 0, duration: 0.3}, "+=0.1");
    });

    // Animate 5th line
    tl.to(lines[4], {strokeDashoffset: 0, duration: 0.4}, "+=0.1");
    // Fade out all lines before next repeat (if not last)
    if (repeatCount < maxRepeats - 1) {
      tl.to(lines, {opacity: 0, duration: 0.3}, "+=0.2");
    }
  }

  animatePreloader();
});
