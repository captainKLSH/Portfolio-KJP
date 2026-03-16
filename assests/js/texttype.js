/**
 * TextType.js — standalone typewriter module
 * No dependencies. Drop in any HTML page.
 *
 * Usage:
 *   new TextType(element, options)
 *
 * Options mirror the React component props:
 *   text               string | string[]   Text(s) to type
 *   typingSpeed        number  (50)        ms per character while typing
 *   deletingSpeed      number  (30)        ms per character while deleting
 *   initialDelay       number  (0)         ms before first character
 *   pauseDuration      number  (2000)      ms to pause at end of each string
 *   loop               bool    (true)      loop through text array
 *   showCursor         bool    (true)      show blinking cursor
 *   hideCursorWhileTyping bool (false)     hide cursor during active typing
 *   cursorCharacter    string  ('|')       cursor glyph
 *   cursorClassName    string  ('')        extra class(es) on cursor span
 *   cursorBlinkDuration number (500)       ms for one blink half-cycle
 *   textColors         string[]([])        per-string colours (cycles)
 *   variableSpeed      {min,max} | null    random speed range overrides typingSpeed
 *   startOnVisible     bool    (false)     defer start until element scrolls in
 *   reverseMode        bool    (false)     type each string in reverse character order
 *   onSentenceComplete function(text,idx)  callback fired when a string finishes typing
 *
 * Instance methods:
 *   .destroy()   — remove DOM nodes, clear timers, disconnect observers
 *   .pause()     — freeze animation
 *   .resume()    — resume animation
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();                  // CommonJS / Node
  } else if (typeof define === 'function' && define.amd) {
    define(factory);                             // AMD
  } else {
    root.TextType = factory();                   // Browser global
  }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ─── tiny GSAP-free blink helper ──────────────────────────────────── */
  function Blinker(el, halfCycleMs) {
    let visible = true;
    let id = null;
    function tick() {
      visible = !visible;
      el.style.opacity = visible ? '1' : '0';
      id = setTimeout(tick, halfCycleMs);
    }
    id = setTimeout(tick, halfCycleMs);
    this.stop = function () { clearTimeout(id); el.style.opacity = '1'; };
  }

  /* ─── main class ────────────────────────────────────────────────────── */
  function TextType(el, opts) {
    if (!el) throw new Error('TextType: first argument must be a DOM element.');

    /* ── defaults ─────────────────────────────────────────────────────── */
    var cfg = Object.assign({
      text:                 'TextType',
      typingSpeed:          50,
      deletingSpeed:        30,
      initialDelay:         0,
      pauseDuration:        2000,
      loop:                 true,
      showCursor:           true,
      hideCursorWhileTyping:false,
      cursorCharacter:      '|',
      cursorClassName:      '',
      cursorBlinkDuration:  500,
      textColors:           [],
      variableSpeed:        null,
      startOnVisible:       false,
      reverseMode:          false,
      onSentenceComplete:   null,
    }, opts || {});

    /* ── normalise text to array ──────────────────────────────────────── */
    var textArray = Array.isArray(cfg.text) ? cfg.text : [cfg.text];

    /* ── state ────────────────────────────────────────────────────────── */
    var displayedText   = '';
    var charIndex       = 0;
    var textIndex       = 0;
    var isDeleting      = false;
    var paused          = false;
    var destroyed       = false;
    var timer           = null;
    var blinker         = null;
    var observer        = null;

    /* ── build DOM ────────────────────────────────────────────────────── */
    el.classList.add('text-type');

    var contentSpan = document.createElement('span');
    contentSpan.className = 'text-type__content';
    el.appendChild(contentSpan);

    var cursorSpan = null;
    if (cfg.showCursor) {
      cursorSpan = document.createElement('span');
      cursorSpan.className = 'text-type__cursor' +
        (cfg.cursorClassName ? ' ' + cfg.cursorClassName : '');
      cursorSpan.textContent = cfg.cursorCharacter;
      el.appendChild(cursorSpan);
      blinker = new Blinker(cursorSpan, cfg.cursorBlinkDuration);
    }

    /* ── helpers ──────────────────────────────────────────────────────── */
    function getSpeed() {
      if (cfg.variableSpeed) {
        var lo = cfg.variableSpeed.min, hi = cfg.variableSpeed.max;
        return Math.random() * (hi - lo) + lo;
      }
      return cfg.typingSpeed;
    }

    function updateColor() {
      if (!cfg.textColors.length) {
        contentSpan.style.color = '';
        return;
      }
      contentSpan.style.color = cfg.textColors[textIndex % cfg.textColors.length];
    }

    function updateCursorVisibility() {
      if (!cursorSpan) return;
      var activelyTyping = isDeleting
        ? true
        : charIndex < textArray[textIndex].length;
      var hide = cfg.hideCursorWhileTyping && activelyTyping;
      cursorSpan.classList.toggle('text-type__cursor--hidden', hide);
    }

    /* ── core tick ────────────────────────────────────────────────────── */
    function tick() {
      if (destroyed || paused) return;

      var currentText    = textArray[textIndex];
      var processedText  = cfg.reverseMode
        ? currentText.split('').reverse().join('')
        : currentText;

      updateColor();
      updateCursorVisibility();

      if (isDeleting) {
        if (displayedText === '') {
          /* finished deleting */
          isDeleting = false;

          if (cfg.onSentenceComplete)
            cfg.onSentenceComplete(textArray[textIndex], textIndex);

          if (!cfg.loop && textIndex === textArray.length - 1) return;

          textIndex  = (textIndex + 1) % textArray.length;
          charIndex  = 0;
          timer = setTimeout(tick, cfg.pauseDuration);
        } else {
          displayedText = displayedText.slice(0, -1);
          contentSpan.textContent = displayedText;
          timer = setTimeout(tick, cfg.deletingSpeed);
        }

      } else {
        if (charIndex < processedText.length) {
          /* still typing */
          displayedText += processedText[charIndex];
          contentSpan.textContent = displayedText;
          charIndex += 1;
          timer = setTimeout(tick, getSpeed());

        } else {
          /* finished typing */
          if (!cfg.loop && textIndex === textArray.length - 1) return;
          timer = setTimeout(function () {
            isDeleting = true;
            tick();
          }, cfg.pauseDuration);
        }
      }
    }

    /* ── start ────────────────────────────────────────────────────────── */
    function start() {
      timer = setTimeout(tick, cfg.initialDelay);
    }

    if (cfg.startOnVisible && 'IntersectionObserver' in window) {
      observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            observer.disconnect();
            observer = null;
            start();
          }
        });
      }, { threshold: 0.1 });
      observer.observe(el);
    } else {
      start();
    }

    /* ── public API ───────────────────────────────────────────────────── */
    this.pause = function () { paused = true; clearTimeout(timer); };

    this.resume = function () {
      if (destroyed) return;
      paused = false;
      tick();
    };

    this.destroy = function () {
      destroyed = true;
      clearTimeout(timer);
      if (blinker)   blinker.stop();
      if (observer)  observer.disconnect();
      if (contentSpan.parentNode) el.removeChild(contentSpan);
      if (cursorSpan && cursorSpan.parentNode) el.removeChild(cursorSpan);
      el.classList.remove('text-type');
    };
  }

  return TextType;
}));

new TextType(document.getElementById('title-container'), {
  text: [
    "Data Scientist",
    "Data Analyst",
    "Machine Learning Engineer",
    "Artificial Intelligence Engineer",
    "Chemical Engineer"
  ],
  typingSpeed: 70,
  deletingSpeed: 35,
  pauseDuration: 1800,
  cursorCharacter: "_",
  showCursor: true
});