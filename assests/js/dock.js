/**
 * Dock.js — standalone vanilla JS port of the React Dock component
 * No React, no Framer Motion / motion/react required.
 *
 * Usage:
 *   new Dock(mountElement, items, options)
 *
 * items: Array of:
 *   { iconHTML, label, onClick, href, className }
 *   iconHTML — raw SVG / HTML string for the icon
 *   label    — tooltip text
 *   onClick  — click handler (optional)
 *   href     — navigate to URL instead (optional)
 *
 * Options:
 *   panelHeight   number  (68)   px height of the dock bar
 *   baseItemSize  number  (50)   px default item size
 *   magnification number  (70)   px max magnified item size
 *   distance      number  (200)  px radius of magnification influence
 *   gap           number  (16)   px gap between items (CSS gap)
 *   spring        object         { mass, stiffness, damping } — feel of the spring
 *
 * Instance methods:
 *   .destroy()
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { root.Dock = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ── Tiny spring simulation ─────────────────────────────────────────
     Euler integration; good-enough for 60 fps UI springs.              */
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
    var f = -this.stiffness * (this.value - this.target);
    var d = -this.damping * this._vel;
    var a = (f + d) / this.mass;
    this._vel  += a * dt;
    this.value += this._vel * dt;
    /* settled? */
    return Math.abs(this.value - this.target) < 0.05 && Math.abs(this._vel) < 0.05;
  };

  /* ── Dock factory ───────────────────────────────────────────────── */
  function Dock(mountEl, items, opts) {
    if (!mountEl || !items) throw new Error('Dock: mountEl and items required.');

    /* Responsive size scale matching CSS breakpoints */
    var vw = window.innerWidth;
    var scale =
      vw >= 1000 ? { base: 50, mag: 70,  panel: 68, dist: 140 } :
      vw >= 768  ? { base: 44, mag: 62,  panel: 60, dist: 120 } :
      vw >= 480  ? { base: 38, mag: 38,  panel: 52, dist: 0   } :
                   { base: 32, mag: 32,  panel: 44, dist: 0   };

    var cfg = Object.assign({
      panelHeight:   scale.panel,
      baseItemSize:  scale.base,
      magnification: scale.mag,
      distance:      scale.dist,
      gap:           vw >= 768 ? 16 : vw >= 480 ? 10 : 6,
      spring: { mass: 0.1, stiffness: 150, damping: 12 }
    }, opts || {});

    /* ── Outer wrapper ── */
    var outer = document.createElement('div');
    outer.className = 'dock-outer';
    /* Only add magnification headroom when magnification is actually enabled */
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
    var itemEls   = [];
    var springs   = [];
    var hovered   = [];
    var rafId     = null;
    var mousePageX = null;

    items.forEach(function (item, i) {
      /* Container */
      var el = document.createElement(item.href ? 'a' : 'div');
      el.className  = 'dock-item'
        + (item.active    ? ' active'           : '')
        + (item.className ? ' ' + item.className : '');
      el.tabIndex   = 0;
      el.setAttribute('role', 'button');
      if (item.href) { el.href = item.href; }

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
      el.addEventListener('mouseenter', function () {
        showLabel(label);
        hovered[i] = true;
      });
      el.addEventListener('mouseleave', function () {
        hideLabel(label);
        hovered[i] = false;
      });
      el.addEventListener('focus', function ()  { showLabel(label); });
      el.addEventListener('blur',  function ()  { hideLabel(label); });
      el.addEventListener('click', function (e) {
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
      springs.push(sp);
      hovered.push(false);
    });

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

    /* ── Mouse tracking ── */
    function onMouseMove(e) {
      mousePageX = e.pageX;
    }
    function onMouseLeave() {
      mousePageX = null;
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

      itemEls.forEach(function (el, i) {
        var target = cfg.baseItemSize;

        if (mousePageX !== null && cfg.distance > 0) {
          var rect = el.getBoundingClientRect();
          var center = rect.left + rect.width / 2;
          /* pageX vs clientX: account for scroll */
          var cx = mousePageX - window.scrollX;
          var dist = Math.abs(cx - center);
          if (dist < cfg.distance) {
            var t = 1 - dist / cfg.distance;           /* 0→1 as cursor approaches */
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

      /* Stop the loop when everything is at rest and mouse is away */
      if (allSettled && mousePageX === null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    /* Restart loop on any mouse activity */
    panel.addEventListener('mousemove', function () {
      if (!rafId) { last = null; rafId = requestAnimationFrame(loop); }
    });
    panel.addEventListener('mouseleave', function () {
      if (!rafId) { last = null; rafId = requestAnimationFrame(loop); }
    });

    /* ── Resize: recalculate scale on viewport change ── */
    var resizeTimer = null;
    function onResize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var nvw = window.innerWidth;
        var nscale =
          nvw >= 1000 ? { base: 50, mag: 70,  panel: 68, dist: 140 } :
          nvw >= 768  ? { base: 44, mag: 62,  panel: 60, dist: 120 } :
          nvw >= 480  ? { base: 38, mag: 38,  panel: 52, dist: 0   } :
                        { base: 32, mag: 32,  panel: 44, dist: 0   };
        cfg.baseItemSize  = nscale.base;
        cfg.magnification = nscale.mag;
        cfg.panelHeight   = nscale.panel;
        cfg.distance      = nscale.dist;
        cfg.gap           = nvw >= 768 ? 16 : nvw >= 480 ? 10 : 6;

        var nExtra = cfg.distance > 0 ? Math.round((cfg.magnification - cfg.panelHeight) * 0.5) : 0;
        outer.style.height = (cfg.panelHeight + nExtra + 4) + 'px';
        panel.style.height = cfg.panelHeight + 'px';
        panel.style.gap    = cfg.gap + 'px';

        itemEls.forEach(function (el, i) {
          springs[i].value  = cfg.baseItemSize;
          springs[i].target = cfg.baseItemSize;
          el.style.width    = cfg.baseItemSize + 'px';
          el.style.height   = cfg.baseItemSize + 'px';
        });
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