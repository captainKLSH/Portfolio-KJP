/**
 * Dock.js — standalone vanilla JS port of the React Dock component
 * Optimized for performance, numerical stability, and accessibility.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { root.Dock = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ── Tiny spring simulation ───────────────────────────────────────── */
  function Spring(cfg) {
    this.mass      = cfg.mass      || 0.1;
    this.stiffness = cfg.stiffness || 150;
    this.damping   = cfg.damping   || 12;
    this.value     = 0;
    this.target    = 0;
    this._vel      = 0;
  }
  Spring.prototype.setTarget = function (t) { this.target = t; };
  Spring.prototype.tick = function (dt) {
    /* OPTIMIZATION: Sub-stepping prevents physics explosions on frame drops */
    var MAX_STEP = 0.005; 
    var steps = Math.ceil(dt / MAX_STEP);
    var safeStep = dt / steps; 

    for (var i = 0; i < steps; i++) {
      var f = -this.stiffness * (this.value - this.target);
      var d = -this.damping * this._vel;
      var a = (f + d) / this.mass;
      this._vel  += a * safeStep;
      this.value += this._vel * safeStep;
    }
    return Math.abs(this.value - this.target) < 0.05 && Math.abs(this._vel) < 0.05;
  };

  /* ── Dock factory ───────────────────────────────────────────────── */
  function Dock(mountEl, items, opts) {
    if (!mountEl || !items) throw new Error('Dock: mountEl and items required.');

    /* OPTIMIZATION: Centralized responsive breakpoints (DRY) */
    function getScaleConfig() {
      var vw = window.innerWidth;
      return vw >= 1000 ? { base: 50, mag: 70,  panel: 68, dist: 140, gap: 16 } :
             vw >= 768  ? { base: 44, mag: 62,  panel: 60, dist: 120, gap: 16 } :
             vw >= 480  ? { base: 38, mag: 38,  panel: 52, dist: 0,   gap: 10 } :
                          { base: 32, mag: 32,  panel: 44, dist: 0,   gap: 6  };
    }

    var scale = getScaleConfig();
    var cfg = Object.assign({
      spring: { mass: 0.1, stiffness: 150, damping: 12 }
    }, opts || {}, {
      gap:           scale.gap,
      panelHeight:   scale.panel,
      baseItemSize:  scale.base,
      magnification: scale.mag,
      distance:      scale.dist
    });

    /* ── Outer wrapper ── */
    var outer = document.createElement('div');
    outer.className = 'dock-outer';
    var extraHeight = cfg.distance > 0 ? Math.round((cfg.magnification - cfg.panelHeight) * 0.5) : 0;
    outer.style.height = (cfg.panelHeight + extraHeight + 4) + 'px';
    mountEl.appendChild(outer);

    /* ── Panel ── */
    var panel = document.createElement('div');
    panel.className = 'dock-panel';
    panel.setAttribute('role', 'toolbar');
    panel.setAttribute('aria-label', 'Navigation dock');
    panel.style.height = cfg.panelHeight + 'px';
    panel.style.gap    = cfg.gap + 'px';
    outer.appendChild(panel);

    /* ── Per-item state ── */
    var itemEls     = [];
    var itemCenters = [];   
    var springs     = [];
    var hovered     = [];
    var rafId       = null;
    var mouseClientX = null; /* OPTIMIZATION: Using ClientX instead of PageX */

    items.forEach(function (item, i) {
      /* Container */
      var el = document.createElement(item.href ? 'a' : 'div');
      el.className  = 'dock-item' + (item.active ? ' active' : '') + (item.className ? ' ' + item.className : '');
      el.tabIndex   = 0;
      el.setAttribute('role', 'button');
      if (item.label) el.setAttribute('aria-label', item.label); /* OPTIMIZATION: a11y */
      if (item.href) el.href = item.href;

      /* Icon */
      var iconWrap = document.createElement('div');
      iconWrap.className = 'dock-icon';
      iconWrap.innerHTML = item.iconHTML || '';
      el.appendChild(iconWrap);

      /* Label */
      var label = document.createElement('div');
      label.className = 'dock-label';
      label.setAttribute('role', 'tooltip');
      label.textContent = item.label || '';
      label.style.opacity   = '0';
      label.style.transform = 'translateX(-50%) translateY(0px)';
      el.appendChild(label);

      /* Events */
      el.addEventListener('mouseenter', function () { showLabel(label); hovered[i] = true;  });
      el.addEventListener('mouseleave', function () { hideLabel(label); hovered[i] = false; });
      el.addEventListener('focus',   function ()  { showLabel(label); });
      el.addEventListener('blur',    function ()  { hideLabel(label); });
      el.addEventListener('click',   function (e) {
        if (item.onClick) { e.preventDefault(); item.onClick(e); }
      });
      el.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && item.onClick) {
          e.preventDefault(); item.onClick(e);
        }
      });

      /* Size spring */
      var sp = new Spring(cfg.spring);
      sp.value  = cfg.baseItemSize;
      sp.target = cfg.baseItemSize;
      el.style.width  = cfg.baseItemSize + 'px';
      el.style.height = cfg.baseItemSize + 'px';

      panel.appendChild(el);
      itemEls.push(el);
      itemCenters.push(0);
      springs.push(sp);
      hovered.push(false);
    });

    /* OPTIMIZATION: Batch DOM Writes, then Batch DOM Reads */
    function cacheItemCenters() {
      itemEls.forEach(function (el) {
        el.style.width  = cfg.baseItemSize + 'px';
        el.style.height = cfg.baseItemSize + 'px';
      });
      itemEls.forEach(function (el, i) {
        var rect = el.getBoundingClientRect();
        itemCenters[i] = rect.left + rect.width / 2;
      });
    }
    requestAnimationFrame(cacheItemCenters);

    /* ── Label helpers ── */
    function showLabel(lbl) {
      lbl.style.transition = 'opacity 0.15s, transform 0.15s';
      lbl.style.opacity    = '1';
      lbl.style.transform  = 'translateX(-50%) translateY(-10px)';
    }
    function hideLabel(lbl) {
      lbl.style.opacity    = '0';
      lbl.style.transform  = 'translateX(-50%) translateY(0px)';
    }

    /* ── Hard-reset all springs instantly ── */
    function resetSprings(size) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      mouseClientX = null;
      itemEls.forEach(function (el, i) {
        springs[i].value  = size;
        springs[i].target = size;
        springs[i]._vel   = 0;
        el.style.width    = size + 'px';
        el.style.height   = size + 'px';
      });
    }

    /* ── Mouse tracking + loop restart ── */
    function onMouseMove(e) {
      mouseClientX = e.clientX; 
      if (!rafId) { last = null; rafId = requestAnimationFrame(loop); }
    }
    function onMouseLeave() {
      mouseClientX = null;
      if (!rafId) { last = null; rafId = requestAnimationFrame(loop); }
    }
    panel.addEventListener('mousemove',  onMouseMove);
    panel.addEventListener('mouseleave', onMouseLeave);

    /* ── Animation loop ── */
    var last = null;
    function loop(ts) {
      rafId = requestAnimationFrame(loop);
      var dt = last ? Math.min((ts - last) / 1000, 0.05) : 0.016;
      last = ts;

      var allSettled = true;
      var cx = mouseClientX;

      itemEls.forEach(function (el, i) {
        var target = cfg.baseItemSize;

        if (cx !== null && cfg.distance > 0) {
          var dist = Math.abs(cx - itemCenters[i]);
          if (dist < cfg.distance) {
            var t = 1 - dist / cfg.distance;
            target = cfg.baseItemSize + (cfg.magnification - cfg.baseItemSize) * t;
          }
        }

        springs[i].setTarget(target);
        var settled = springs[i].tick(dt);
        if (!settled) allSettled = false;

        var sz = Math.round(springs[i].value);
        el.style.width  = sz + 'px';
        el.style.height = sz + 'px';
      });

      if (allSettled && mouseClientX === null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    /* ── Resize ── */
    var resizeTimer = null;
    function onResize() {
      resetSprings(cfg.baseItemSize);
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var nscale = getScaleConfig(); /* Re-use DRY config */
        
        cfg.baseItemSize  = nscale.base;
        cfg.magnification = nscale.mag;
        cfg.panelHeight   = nscale.panel;
        cfg.distance      = nscale.dist;
        cfg.gap           = nscale.gap;

        var nExtra = cfg.distance > 0 ? Math.round((cfg.magnification - cfg.panelHeight) * 0.5) : 0;
        outer.style.height = (cfg.panelHeight + nExtra + 4) + 'px';
        panel.style.height = cfg.panelHeight + 'px';
        panel.style.gap    = cfg.gap + 'px';

        resetSprings(cfg.baseItemSize);
        cacheItemCenters(); 
      }, 150);
    }
    window.addEventListener('resize', onResize);

    /* ── Public API ── */
    this.destroy = function () {
      if (rafId) cancelAnimationFrame(rafId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      panel.removeEventListener('mousemove',  onMouseMove);
      panel.removeEventListener('mouseleave', onMouseLeave);
      if (outer.parentNode) mountEl.removeChild(outer);
    };
  }

  return Dock;
}));