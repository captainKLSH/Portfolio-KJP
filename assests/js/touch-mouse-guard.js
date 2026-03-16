/**
 * touch-mouse-guard.js
 *
 * Globally suppresses synthetic mouse events (mousemove, mouseenter,
 * mouseleave, mouseover, mouseout) that iOS / iPadOS fires after touch
 * interactions. Attach once — protects every listener on the page.
 *
 * How it works:
 *   Browsers fire a "compatibility mouse event" sequence after touch ends.
 *   These arrive 300 ms after touchend and have the same coordinates as
 *   the last touch point. Any code listening for mousemove (e.g. a dock
 *   magnification effect) will receive them and behave as if a real mouse
 *   is present, leaving springs / animations stuck at a hover state.
 *
 *   This guard patches EventTarget.prototype.addEventListener globally so
 *   that every mousemove / mouseenter / mouseleave / mouseover / mouseout
 *   handler added anywhere on the page is wrapped with a check: if the
 *   most recent pointer interaction was a touch, the event is swallowed
 *   before the handler runs.
 *
 * Usage:
 *   Load this script once, as early as possible — before any other JS.
 *   <script src="touch-mouse-guard.js"></script>
 *
 *   No configuration or API needed. Works transparently with existing code.
 *   On non-touch devices the script exits immediately — zero overhead,
 *   nothing is patched, mouse behaviour is completely unaffected.
 *
 * Compatibility:
 *   All modern browsers. Detects touch capability via maxTouchPoints,
 *   msMaxTouchPoints, and ontouchstart before doing anything.
 */
(function () {
  'use strict';

  /* ── Touch device detection ─────────────────────────────────────────
     Exit immediately on devices with no touch capability.
     Nothing is patched and no overhead is added for desktop users.

     Three signals checked in combination:
       1. navigator.maxTouchPoints > 0   W3C standard (Chrome, FF, Safari 13+)
       2. navigator.msMaxTouchPoints     Legacy IE / early Edge
       3. 'ontouchstart' in window       Older Android / iOS WebViews          */
  var isTouchDevice = (
    navigator.maxTouchPoints   > 0 ||
    navigator.msMaxTouchPoints > 0 ||
    ('ontouchstart' in window)
  );

  if (!isTouchDevice) { return; }

  /* ── State ── */
  var lastPointerType = 'mouse';   /* 'mouse' | 'touch' | 'pen' */
  var resetTimer      = null;

  /* Set of event types to guard */
  var GUARDED = {
    mousemove:   true,
    mouseenter:  true,
    mouseleave:  true,
    mouseover:   true,
    mouseout:    true
  };

  /* ── Track the most recent pointer interaction type globally ── */
  document.addEventListener('pointerdown', function (e) {
    lastPointerType = e.pointerType || 'mouse';
  }, true /* capture — runs before any bubbling handler */);

  /* Reset back to 'mouse' after a short delay following touchend.
     This allows the 300 ms synthetic event window to pass, then
     restores normal mouse behaviour if the user picks up a mouse. */
  document.addEventListener('pointerup', function (e) {
    if (e.pointerType === 'touch') {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        lastPointerType = 'mouse';
      }, 400);
    }
  }, true);

  /* Also reset on touchcancel (e.g. scroll interrupted the touch) */
  document.addEventListener('touchcancel', function () {
    clearTimeout(resetTimer);
    lastPointerType = 'mouse';
  }, true);

  /* ── Patch addEventListener globally ── */
  var _nativeAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, handler, options) {
    if (!GUARDED[type] || typeof handler !== 'function') {
      /* Not a guarded event type — attach as normal */
      return _nativeAddEventListener.call(this, type, handler, options);
    }

    /* Wrap the handler: skip if last interaction was touch */
    var guarded = function (e) {
      if (lastPointerType === 'touch') return;
      handler.call(this, e);
    };

    /* Store the mapping so removeEventListener can find the wrapper */
    if (!handler._touchGuardWrapped) {
      handler._touchGuardWrapped = {};
    }
    handler._touchGuardWrapped[type] = guarded;

    return _nativeAddEventListener.call(this, type, guarded, options);
  };

  /* ── Patch removeEventListener to match ── */
  var _nativeRemoveEventListener = EventTarget.prototype.removeEventListener;

  EventTarget.prototype.removeEventListener = function (type, handler, options) {
    if (GUARDED[type] && handler && handler._touchGuardWrapped && handler._touchGuardWrapped[type]) {
      return _nativeRemoveEventListener.call(this, type, handler._touchGuardWrapped[type], options);
    }
    return _nativeRemoveEventListener.call(this, type, handler, options);
  };

}());
