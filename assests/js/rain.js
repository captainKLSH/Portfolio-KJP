/**
 * rain-hero.js — Water ripple effect scoped to a single hero section.
 * Requires Three.js (r128+) to be loaded before this script.
 *
 * Usage:
 *   new RainHero(heroElement, options)
 *
 * Options:
 *   bgColor      string  CSS value or var(--name)   Canvas background colour
 *   textContent  string                              Watermark text
 *   textColor    string  CSS value or var(--name)   Watermark text colour
 *   textFont     string  CSS value or var(--name)   Font string (size in px required)
 *
 * Instance methods:
 *   .destroy()              cancel RAF, disconnect observers, dispose GL
 *   .resize()               manually trigger resize (auto via ResizeObserver)
 *   .updateText(str, color) redraw background texture
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { root.RainHero = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  /* ── Shaders ─────────────────────────────────────────────────── */

  var SIM_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  var SIM_FRAG = `
    uniform sampler2D textureA;
    uniform vec2      mouse;
    uniform vec2      resolution;
    uniform float     time;
    uniform int       frame;
    varying vec2      vUv;
    const float delta = 1.4;

    void main() {
      vec2 uv = vUv;
      if (frame == 0) { gl_FragColor = vec4(0.0); return; }

      vec4  data     = texture2D(textureA, uv);
      float pressure = data.x;
      float pVel     = data.y;
      vec2  texel    = 1.0 / resolution;

      float p_right = texture2D(textureA, uv + vec2(texel.x, 0.0)).x;
      float p_left  = texture2D(textureA, uv - vec2(texel.x, 0.0)).x;
      float p_up    = texture2D(textureA, uv + vec2(0.0, texel.y)).x;
      float p_down  = texture2D(textureA, uv - vec2(0.0, texel.y)).x;

      if (uv.x <= texel.x)        p_left  = p_right;
      if (uv.x >= 1.0 - texel.x)  p_right = p_left;
      if (uv.y <= texel.y)        p_down  = p_up;
      if (uv.y >= 1.0 - texel.y)  p_up    = p_down;

      pVel += delta * (-2.0 * pressure + p_right + p_left) / 4.0;
      pVel += delta * (-2.0 * pressure + p_up    + p_down) / 4.0;
      pressure += delta * pVel;
      pVel     -= 0.005 * delta * pressure;
      pVel     *= 1.0 - 0.002 * delta;
      pressure *= 0.999;

      vec2 mouseUV = mouse / resolution;
      if (mouse.x > 0.0) {
        float dist = distance(uv, mouseUV);
        if (dist <= 0.02) {
          pressure += 2.0 * (1.0 - dist / 0.02);
        }
      }

      gl_FragColor = vec4(
        pressure, pVel,
        (p_right - p_left) / 2.0,
        (p_up    - p_down) / 2.0
      );
    }
  `;

  var RENDER_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  var RENDER_FRAG = `
    uniform sampler2D textureA;
    uniform sampler2D textureB;
    varying vec2 vUv;

    void main() {
      vec4 data       = texture2D(textureA, vUv);
      vec2 distortion = 0.3 * data.zw;
      vec4 color      = texture2D(textureB, vUv + distortion);

      vec3 normal   = normalize(vec3(-data.z * 2.0, 0.5, -data.w * 2.0));
      vec3 lightDir = normalize(vec3(-3.0, 10.0, 3.0));
      float specular = pow(max(0.0, dot(normal, lightDir)), 60.0) * 1.5;

      gl_FragColor = color + vec4(specular);
    }
  `;

  /* ── CSS variable resolver ───────────────────────────────────── */
  /* Resolves var(--name) strings to their computed values.
     Falls back to the raw value if not a CSS variable.           */
  function resolveVar(value) {
    if (typeof value !== 'string') return value;
    var v = value.trim();
    if (!v.startsWith('var(')) return v;
    var match = v.match(/var\(\s*(--[\w-]+)\s*\)/);
    if (!match) return v;
    return getComputedStyle(document.documentElement)
             .getPropertyValue(match[1]).trim() || v;
  }

  /* ── Constructor ─────────────────────────────────────────────── */

  function RainHero(heroEl, opts) {
    if (!heroEl)
      throw new Error('RainHero: first argument must be a DOM element.');
    if (typeof THREE === 'undefined')
      throw new Error('RainHero: Three.js must be loaded before rain-hero.js.');

    var cfg = Object.assign({
      bgColor:     '#0a0e17',
      textContent: 'Kiran Prasad JP',
      textColor:   'rgba(255, 56, 92, 0.18)',
      textFont:    '700 90px "Fraunces", serif'
    }, opts || {});

    /* ── Canvas: use existing #rain-canvas or inject one ── */
    var canvasEl = heroEl.querySelector('#rain-canvas');
    if (!canvasEl) {
      canvasEl = document.createElement('canvas');
      canvasEl.id = 'rain-canvas';
      heroEl.insertBefore(canvasEl, heroEl.firstChild);
    }

    /* ── Three.js renderer ── */
    var renderer = new THREE.WebGLRenderer({
      canvas:                canvasEl,
      antialias:             true,
      alpha:                 true,
      preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    /* ── Scenes & camera ── */
    var scene    = new THREE.Scene();
    var simScene = new THREE.Scene();
    var camera   = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* ── Mouse state ── */
    var mouse = new THREE.Vector2(-1000, -1000);

    /* ── Initial dimensions ── */
    var dpr    = Math.min(window.devicePixelRatio, 2);
    var width  = heroEl.offsetWidth  * dpr;
    var height = heroEl.offsetHeight * dpr;
    renderer.setSize(heroEl.offsetWidth, heroEl.offsetHeight);

    /* ── Render targets ── */
    var rtOpts = {
      format:        THREE.RGBAFormat,
      type:          THREE.FloatType,
      minFilter:     THREE.LinearFilter,
      magFilter:     THREE.LinearFilter,
      stencilBuffer: false,
      depthBuffer:   false
    };
    var rtA = new THREE.WebGLRenderTarget(width, height, rtOpts);
    var rtB = new THREE.WebGLRenderTarget(width, height, rtOpts);

    /* ── Shader materials ── */
    var simMat = new THREE.ShaderMaterial({
      uniforms: {
        textureA:   { value: null },
        mouse:      { value: mouse },
        resolution: { value: new THREE.Vector2(width, height) },
        time:       { value: 0 },
        frame:      { value: 0 }
      },
      vertexShader:   SIM_VERT,
      fragmentShader: SIM_FRAG
    });

    var renderMat = new THREE.ShaderMaterial({
      uniforms: {
        textureA: { value: null },
        textureB: { value: null }
      },
      vertexShader:   RENDER_VERT,
      fragmentShader: RENDER_FRAG,
      transparent:    true
    });

    /* ── Geometry ── */
    var plane = new THREE.PlaneGeometry(2, 2);
    simScene.add(new THREE.Mesh(plane, simMat));
    scene.add(new THREE.Mesh(plane, renderMat));

    /* ── Background texture canvas ── */
    var texCanvas = document.createElement('canvas');
    texCanvas.width  = width;
    texCanvas.height = height;
    var ctx2d = texCanvas.getContext('2d', { alpha: true });

    /* drawBackground resolves CSS variables fresh on every call
       so theme changes and breakpoint changes are picked up      */
    function drawBackground() {
      ctx2d.clearRect(0, 0, texCanvas.width, texCanvas.height);

      /* Background fill */
      ctx2d.fillStyle = resolveVar(cfg.bgColor);
      ctx2d.fillRect(0, 0, texCanvas.width, texCanvas.height);

      /* Watermark text */
      if (cfg.textContent) {
        /* Resolve font (may be a CSS variable) */
        var font   = resolveVar(cfg.textFont);

        /* Extract px size and scale by dpr for sharp rendering */
        var fMatch = font.match(/(\d+\.?\d*)px/);
        var fSize  = fMatch ? parseFloat(fMatch[1]) : 90;
        var scaledFont = font.replace(
          /(\d+\.?\d*)px/,
          Math.round(fSize * dpr) + 'px'
        );

        ctx2d.font         = scaledFont;
        ctx2d.fillStyle    = resolveVar(cfg.textColor);
        ctx2d.textAlign    = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText(
          cfg.textContent,
          texCanvas.width  / 2,
          texCanvas.height / 2
        );
      }
    }

    drawBackground();

    var texB = new THREE.CanvasTexture(texCanvas);
    texB.minFilter   = THREE.LinearFilter;
    texB.magFilter   = THREE.LinearFilter;
    texB.needsUpdate = true;
    renderMat.uniforms.textureB.value = texB;

    /* ── Resize ── */
    var self = this;

    this.resize = function () {
      dpr    = Math.min(window.devicePixelRatio, 2);
      width  = heroEl.offsetWidth  * dpr;
      height = heroEl.offsetHeight * dpr;

      renderer.setSize(heroEl.offsetWidth, heroEl.offsetHeight);
      rtA.setSize(width, height);
      rtB.setSize(width, height);
      simMat.uniforms.resolution.value.set(width, height);

      /* Resize texture canvas then redraw — re-resolves CSS vars
         so the current breakpoint font size is used             */
      texCanvas.width  = width;
      texCanvas.height = height;
      drawBackground();
      texB.needsUpdate = true;
    };

    /* ResizeObserver watches the hero element specifically */
    var ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () { self.resize(); });
      ro.observe(heroEl);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }

    /* ── Mouse: listen on whole hero so content overlay doesn't
       block ripples when cursor is over text / links            ── */
    function onMouseMove(e) {
      var rect = heroEl.getBoundingClientRect();
      mouse.x = (e.clientX - rect.left)          * dpr;
      mouse.y = (rect.height - (e.clientY - rect.top)) * dpr;
    }
    function onMouseLeave() {
      mouse.set(-1000, -1000);
    }
    heroEl.addEventListener('mousemove',  onMouseMove);
    heroEl.addEventListener('mouseleave', onMouseLeave);

    /* ── Animation loop ── */
    var frameCount = 0;
    var rafId      = null;
    var destroyed  = false;

    function animate() {
      if (destroyed) return;
      rafId = requestAnimationFrame(animate);

      simMat.uniforms.frame.value    = frameCount++;
      simMat.uniforms.time.value     = performance.now() / 1000;
      simMat.uniforms.textureA.value = rtA.texture;

      renderer.setRenderTarget(rtB);
      renderer.render(simScene, camera);

      renderMat.uniforms.textureA.value = rtB.texture;
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);

      var tmp = rtA; rtA = rtB; rtB = tmp;
    }

    animate();

    /* ── Public: updateText ── */
    this.updateText = function (content, color) {
      if (content !== undefined) cfg.textContent = content;
      if (color   !== undefined) cfg.textColor   = color;
      drawBackground();
      texB.needsUpdate = true;
    };
    /* ── Public: redraw ── */
    this.redraw = function () {
      drawBackground();
      texB.needsUpdate = true;
      renderMat.uniforms.textureB.value = texB;
    };

    /* ── Public: destroy ── */
    this.destroy = function () {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (ro)    ro.disconnect();
      else       window.removeEventListener('resize', self.resize);
      heroEl.removeEventListener('mousemove',  onMouseMove);
      heroEl.removeEventListener('mouseleave', onMouseLeave);
      renderer.dispose();
      renderer.forceContextLoss();
      rtA.dispose();
      rtB.dispose();
      plane.dispose();
      simMat.dispose();
      renderMat.dispose();
      texB.dispose();
      if (canvasEl.parentNode) canvasEl.parentNode.removeChild(canvasEl);
    };
  }

  return RainHero;
}));