/* project.js — parallax scroll for project sections only
   Requires GSAP + ScrollTrigger loaded before this script.  */

gsap.registerPlugin(ScrollTrigger);

/* Target only sections inside <main>, not the hero */
var sections = gsap.utils.toArray('main section');

var getRatio = function (el) {
  return window.innerHeight / (window.innerHeight + el.offsetHeight);
};

sections.forEach(function (section, i) {
  var bg = section.querySelector('.bg');
  if (!bg) return;

  /* Apply background image from data-bg attribute */
  var image = bg.dataset.bg;
  if (image) {
    bg.style.backgroundImage = 'url(' + image + ')';
  }

  /* Parallax: scroll background slower than content */
  gsap.fromTo(bg, {
    backgroundPosition: function () {
      return i
        ? '50% ' + (-window.innerHeight * getRatio(section)) + 'px'
        : '50% 0px';
    }
  }, {
    backgroundPosition: function () {
      return '50% ' + (window.innerHeight * (1 - getRatio(section))) + 'px';
    },
    ease: 'none',
    scrollTrigger: {
      trigger:           section,
      start:             function () { return i ? 'top bottom' : 'top top'; },
      end:               'bottom top',
      scrub:             true,
      invalidateOnRefresh: true
    }
  });
});