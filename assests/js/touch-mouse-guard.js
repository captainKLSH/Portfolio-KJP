(function () {
  'use strict';

  var isTouchDevice = (
    navigator.maxTouchPoints   > 0 ||
    navigator.msMaxTouchPoints > 0 ||
    ('ontouchstart' in window)
  );

  if (!isTouchDevice) { return; }

  var lastPointerType = 'mouse';
  var resetTimer      = null;

  var GUARDED = {
    mousemove:   true,
    mouseenter:  true,
    mouseleave:  true,
    mouseover:   true,
    mouseout:    true
  };

  /* Set pointer type based on modern Pointer Events */
  function setTouch() { lastPointerType = 'touch'; }
  document.addEventListener('pointerdown', function (e) {
    lastPointerType = e.pointerType || 'mouse';
  }, true);

  /* Fallback for iOS 12 and older which don't support pointerdown */
  document.addEventListener('touchstart', setTouch, true);

  function resetToMouse(e) {
    /* If it's a pointer event, ensure it was actually a touch */
    if (e && e.pointerType && e.pointerType !== 'touch') return;
    
    clearTimeout(resetTimer);
    resetTimer = setTimeout(function () {
      lastPointerType = 'mouse';
    }, 400);
  }

  document.addEventListener('pointerup', resetToMouse, true);
  document.addEventListener('touchend', resetToMouse, true);
  document.addEventListener('touchcancel', function () {
    clearTimeout(resetTimer);
    lastPointerType = 'mouse';
  }, true);

  /* ── Patch addEventListener globally ── */
  var _nativeAddEventListener = EventTarget.prototype.addEventListener;

  EventTarget.prototype.addEventListener = function (type, handler, options) {
    if (!GUARDED[type] || typeof handler !== 'function') {
      return _nativeAddEventListener.call(this, type, handler, options);
    }

    if (!handler._touchGuardWrapped) {
      handler._touchGuardWrapped = {};
    }

    /* FIX: Only create the wrapper ONCE per original handler/type combination. 
       Because we use `this` inside the wrapper, the browser will correctly 
       bind it to the specific element triggering the event dynamically. */
    if (!handler._touchGuardWrapped[type]) {
      handler._touchGuardWrapped[type] = function (e) {
        if (lastPointerType === 'touch') return;
        handler.call(this, e);
      };
    }

    return _nativeAddEventListener.call(this, type, handler._touchGuardWrapped[type], options);
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