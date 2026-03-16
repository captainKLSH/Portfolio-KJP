/**
 * Lightning.js — Standalone vanilla JS port of the React Lightning component.
 * No dependencies. Uses raw WebGL — no Three.js needed.
 *
 * Usage:
 *   new Lightning(mountElement, options)
 *
 *   // Full-page fixed background (like #fluid-bg):
 *   new Lightning(null, { fullPage: true, hue: 260 })
 *
 *   // Scoped to a specific element:
 *   new Lightning(document.getElementById('hero'), { hue: 260 })
 *
 * Options:
 *   hue        number  (230)   Colour hue 0–360
 *   xOffset    number  (0)     Horizontal position offset
 *   speed      number  (1)     Animation speed multiplier
 *   intensity  number  (1)     Brightness multiplier
 *   size       number  (1)     Noise scale
 *   fullPage   bool    (false) Fixed full-viewport background (z-index:-1)
 *
 * Instance methods:
 *   .destroy()   cancel RAF, remove canvas, lose GL context
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) { module.exports = factory(); }
  else if (typeof define === 'function' && define.amd) { define(factory); }
  else { root.Lightning = factory(); }
}(typeof self !== 'undefined' ? self : this, function () {

  var VS = `
    attribute vec2 aPosition;
    void main() {
      gl_Position = vec4(aPosition, 0.0, 1.0);
    }
  `;

  var FS = `
    precision mediump float;
    uniform vec2  iResolution;
    uniform float iTime;
    uniform float uHue;
    uniform float uXOffset;
    uniform float uSpeed;
    uniform float uIntensity;
    uniform float uSize;

    #define OCTAVE_COUNT 10

    vec3 hsv2rgb(vec3 c) {
      vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
      return c.z * mix(vec3(1.0), rgb, c.y);
    }

    float hash11(float p) {
      p = fract(p * .1031);
      p *= p + 33.33;
      p *= p + p;
      return fract(p);
    }

    float hash12(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * .1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }

    mat2 rotate2d(float theta) {
      float c = cos(theta);
      float s = sin(theta);
      return mat2(c, -s, s, c);
    }

    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 fp = fract(p);
      float a = hash12(ip);
      float b = hash12(ip + vec2(1.0, 0.0));
      float c = hash12(ip + vec2(0.0, 1.0));
      float d = hash12(ip + vec2(1.0, 1.0));
      vec2 t = smoothstep(0.0, 1.0, fp);
      return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
    }

    float fbm(vec2 p) {
      float value = 0.0;
      float amplitude = 0.5;
      for (int i = 0; i < OCTAVE_COUNT; ++i) {
        value += amplitude * noise(p);
        p *= rotate2d(0.45);
        p *= 2.0;
        amplitude *= 0.5;
      }
      return value;
    }

    void mainImage(out vec4 fragColor, in vec2 fragCoord) {
      vec2 uv = fragCoord / iResolution.xy;
      uv = 2.0 * uv - 1.0;
      uv.x *= iResolution.x / iResolution.y;
      uv.x += uXOffset;
      uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;
      float dist = abs(uv.x);
      vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
      vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
      fragColor = vec4(col, 1.0);
    }

    void main() {
      mainImage(gl_FragColor, gl_FragCoord.xy);
    }
  `;

  function Lightning(mountEl, opts) {
    var cfg = Object.assign({
      hue:       230,
      xOffset:   0,
      speed:     1,
      intensity: 1,
      size:      1,
      fullPage:  false
    }, opts || {});

    if (!cfg.fullPage && !mountEl)
      throw new Error('Lightning: pass a DOM element or set fullPage:true.');

    /* ── Canvas ── */
    var canvas = document.createElement('canvas');

    if (cfg.fullPage) {
      canvas.style.cssText =
        'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
        'z-index:-1;display:block;pointer-events:none;';
      document.body.insertBefore(canvas, document.body.firstChild);
    } else {
      canvas.style.cssText =
        'position:absolute;inset:0;width:100%;height:100%;display:block;';
      mountEl.appendChild(canvas);
    }

    /* ── WebGL ── */
    var gl = canvas.getContext('webgl')
           || canvas.getContext('experimental-webgl');
    if (!gl) { console.error('Lightning: WebGL not supported'); return; }

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        console.error('Lightning shader error:', gl.getShaderInfoLog(s));
      return s;
    }

    var prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      console.error('Lightning link error:', gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    /* Full-screen quad (2 triangles) */
    var verts = new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPosition');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var U = {
      iResolution: gl.getUniformLocation(prog, 'iResolution'),
      iTime:       gl.getUniformLocation(prog, 'iTime'),
      uHue:        gl.getUniformLocation(prog, 'uHue'),
      uXOffset:    gl.getUniformLocation(prog, 'uXOffset'),
      uSpeed:      gl.getUniformLocation(prog, 'uSpeed'),
      uIntensity:  gl.getUniformLocation(prog, 'uIntensity'),
      uSize:       gl.getUniformLocation(prog, 'uSize')
    };

    /* Set static uniforms */
    gl.uniform1f(U.uHue,       cfg.hue);
    gl.uniform1f(U.uXOffset,   cfg.xOffset);
    gl.uniform1f(U.uSpeed,     cfg.speed);
    gl.uniform1f(U.uIntensity, cfg.intensity);
    gl.uniform1f(U.uSize,      cfg.size);

    /* ── Resize ── */
    var self = this;
    function resize() {
      var w = cfg.fullPage ? window.innerWidth  : (mountEl ? mountEl.clientWidth  : canvas.clientWidth);
      var h = cfg.fullPage ? window.innerHeight : (mountEl ? mountEl.clientHeight : canvas.clientHeight);
      if (!w || !h) return;
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    this.resize = resize;

    if (cfg.fullPage) {
      window.addEventListener('resize', resize);
    } else if (window.ResizeObserver) {
      var ro = new ResizeObserver(resize);
      ro.observe(mountEl);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    /* ── RAF loop ── */
    var rafId    = null;
    var destroyed = false;
    var startTime = performance.now();

    function render() {
      if (destroyed) return;
      rafId = requestAnimationFrame(render);
      resize();
      gl.useProgram(prog);
      gl.uniform2f(U.iResolution, canvas.width, canvas.height);
      gl.uniform1f(U.iTime, (performance.now() - startTime) / 1000.0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    rafId = requestAnimationFrame(render);

    /* ── Destroy ── */
    this.destroy = function () {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (cfg.fullPage) window.removeEventListener('resize', resize);
      else if (ro) ro.disconnect();
      gl.getExtension('WEBGL_lose_context') &&
        gl.getExtension('WEBGL_lose_context').loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };
  }

  return Lightning;
}));