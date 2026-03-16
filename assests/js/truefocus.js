/**
 * TrueFocus.js — standalone vanilla JS port of the TrueFocus React component
 * No React, no Motion/Framer-Motion required.
 *
 * Usage:
 *   new TrueFocus(element, options)
 *
 * Options:
 *   sentence               string   ('True Focus')       Space-separated words to display
 *   separator              string   (' ')                 Word separator
 *   manualMode             bool     (false)               Hover to focus, auto-cycle otherwise
 *   blurAmount             number   (5)                   px blur on inactive words
 *   borderColor            string   ('green')             Corner-bracket colour
 *   glowColor              string   ('rgba(0,255,0,0.6)') Drop-shadow glow colour
 *   animationDuration      number   (0.5)                 seconds for transitions
 *   pauseBetweenAnimations number   (1)                   seconds pause between auto-steps
 *
 * Instance methods:
 *   .destroy()   — remove all DOM nodes and clear timers
 *   .pause()     — stop auto-cycling
 *   .resume()    — restart auto-cycling (no-op in manualMode)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { root.TrueFocus = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  function TrueFocus(mountEl, opts) {
    if (!mountEl) throw new Error('TrueFocus: first argument must be a DOM element.');

    var cfg = Object.assign({
      sentence:               'True Focus',
      separator:              ' ',
      manualMode:             false,
      blurAmount:             5,
      borderColor:            'green',
      glowColor:              'rgba(0,255,0,0.6)',
      animationDuration:      0.5,
      pauseBetweenAnimations: 1
    }, opts || {});

    var words       = cfg.sentence.split(cfg.separator);
    var currentIdx  = 0;
    var lastIdx     = 0;
    var interval    = null;
    var destroyed   = false;

    /* ── Build container ───────────────────────────────────────────── */
    var container = document.createElement('div');
    container.className = 'focus-container';
    mountEl.appendChild(container);

    /* ── Build word spans ──────────────────────────────────────────── */
    var wordEls = words.map(function (word, i) {
      var span = document.createElement('span');
      span.className = 'focus-word' + (cfg.manualMode ? ' manual' : '');
      span.textContent = word;
      span.style.transition = 'filter ' + cfg.animationDuration + 's ease';
      span.style.setProperty('--border-color', cfg.borderColor);
      span.style.setProperty('--glow-color',   cfg.glowColor);

      if (cfg.manualMode) {
        span.addEventListener('mouseenter', function () { activate(i); lastIdx = i; });
        span.addEventListener('mouseleave', function () { activate(lastIdx); });
      }

      container.appendChild(span);
      return span;
    });

    /* ── Build focus frame ─────────────────────────────────────────── */
    var frame = document.createElement('div');
    frame.className = 'focus-frame';
    frame.style.setProperty('--border-color', cfg.borderColor);
    frame.style.setProperty('--glow-color',   cfg.glowColor);
    frame.style.transition =
      'left '   + cfg.animationDuration + 's ease, ' +
      'top '    + cfg.animationDuration + 's ease, ' +
      'width '  + cfg.animationDuration + 's ease, ' +
      'height ' + cfg.animationDuration + 's ease, ' +
      'opacity '+ cfg.animationDuration + 's ease';

    ['top-left','top-right','bottom-left','bottom-right'].forEach(function (cls) {
      var c = document.createElement('span');
      c.className = 'corner ' + cls;
      frame.appendChild(c);
    });
    container.appendChild(frame);

    /* ── Activate word ─────────────────────────────────────────────── */
    function activate(idx) {
      currentIdx = idx;
      wordEls.forEach(function (el, i) {
        el.style.filter = (i === idx) ? 'blur(0px)' : 'blur(' + cfg.blurAmount + 'px)';
        el.classList.toggle('active', i === idx && !cfg.manualMode);
      });
      moveFrame(idx);
    }

    function moveFrame(idx) {
      if (!wordEls[idx]) return;
      var parentRect = container.getBoundingClientRect();
      var wordRect   = wordEls[idx].getBoundingClientRect();
      frame.style.left    = (wordRect.left  - parentRect.left) + 'px';
      frame.style.top     = (wordRect.top   - parentRect.top)  + 'px';
      frame.style.width   = wordRect.width  + 'px';
      frame.style.height  = wordRect.height + 'px';
      frame.style.opacity = '1';
    }

    /* ── Auto-cycle ────────────────────────────────────────────────── */
    function startCycle() {
      if (cfg.manualMode) return;
      interval = setInterval(function () {
        activate((currentIdx + 1) % words.length);
      }, (cfg.animationDuration + cfg.pauseBetweenAnimations) * 1000);
    }

    /* ── Init ──────────────────────────────────────────────────────── */
    activate(0);

    /* Recalculate frame on resize */
    var resizeHandler = function () { moveFrame(currentIdx); };
    window.addEventListener('resize', resizeHandler);

    /* Small defer so layout is settled before first measurement */
    setTimeout(function () { moveFrame(currentIdx); }, 50);

    startCycle();

    /* ── Public API ────────────────────────────────────────────────── */
    this.pause = function () {
      clearInterval(interval);
      interval = null;
    };

    this.resume = function () {
      if (destroyed || cfg.manualMode || interval) return;
      startCycle();
    };

    this.destroy = function () {
      destroyed = true;
      clearInterval(interval);
      window.removeEventListener('resize', resizeHandler);
      if (container.parentNode) mountEl.removeChild(container);
    };
  }

  return TrueFocus;
}));

/* TrueFocus — animated name headline */
      new TrueFocus(document.getElementById('truefocus-container'), {
        sentence:               'Code Learn Predict Repeat',
        separator:              ' ',
        manualMode:             false,
        blurAmount:             5,
        borderColor:            '#1812c4',
        glowColor:              'rgba(231, 172, 35, 0.64)',
        animationDuration:      0.8,
        pauseBetweenAnimations: 1
      });