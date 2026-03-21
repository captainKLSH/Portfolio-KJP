/**
 * fluid-cursor.js — Vanilla JS port of SplashCursor React component
 *
 * Usage:
 *   import FluidCursor from './fluid-cursor.js';
 *
 *   const cursor = new FluidCursor({
 *     // all options are optional — defaults shown below
 *     SIM_RESOLUTION:      128,
 *     DYE_RESOLUTION:      1440,
 *     DENSITY_DISSIPATION: 3.5,
 *     VELOCITY_DISSIPATION: 2,
 *     PRESSURE:            0.1,
 *     PRESSURE_ITERATIONS: 20,
 *     CURL:                3,
 *     SPLAT_RADIUS:        0.2,
 *     SPLAT_FORCE:         6000,
 *     SHADING:             true,
 *     COLOR_UPDATE_SPEED:  10,
 *     BACK_COLOR:          { r: 0.5, g: 0, b: 0 },
 *     TRANSPARENT:         true,
 *   });
 *
 *   // To stop and remove:
 *   cursor.destroy();
 */

export default class FluidCursor {
  constructor(opts = {}) {
    this._cfg = Object.assign({
      SIM_RESOLUTION:       128,
      DYE_RESOLUTION:       1440,
      CAPTURE_RESOLUTION:   512,
      DENSITY_DISSIPATION:  3.5,
      VELOCITY_DISSIPATION: 2,
      PRESSURE:             0.1,
      PRESSURE_ITERATIONS:  20,
      CURL:                 3,
      SPLAT_RADIUS:         0.2,
      SPLAT_FORCE:          6000,
      SHADING:              true,
      COLOR_UPDATE_SPEED:   10,
      BACK_COLOR:           { r: 0.5, g: 0, b: 0 },
      TRANSPARENT:          true,
      PAUSED:               false,
    }, opts);

    this._rafId    = null;
    this._active   = true;

    /* ── DOM ── */
    this._wrapper = document.createElement('div');
    Object.assign(this._wrapper.style, {
      position:      'fixed',
      top:           '0',
      left:          '0',
      zIndex:        '70',
      pointerEvents: 'none',
      width:         '100%',
      height:        '100%',
    });

    this._canvas = document.createElement('canvas');
    this._canvas.id = 'fluid-cursor-canvas';
    Object.assign(this._canvas.style, {
      width:   '100vw',
      height:  '100vh',
      display: 'block',
    });

    this._wrapper.appendChild(this._canvas);
    document.body.appendChild(this._wrapper);

    this._init();
  }

  /* ─────────────────────────────────────────── public ── */

  destroy() {
    this._active = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    window.removeEventListener('mousedown',  this._onMouseDown);
    window.removeEventListener('mousemove',  this._onMouseMove);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove',  this._onTouchMove);
    window.removeEventListener('touchend',   this._onTouchEnd);
    if (this._wrapper.parentNode) this._wrapper.parentNode.removeChild(this._wrapper);
  }

  /* ─────────────────────────────────────────── private ── */

  _init() {
    const canvas = this._canvas;
    const config = this._cfg;

    /* ── WebGL ── */
    const { gl, ext } = this._getWebGLContext(canvas);
    this._gl  = gl;
    this._ext = ext;

    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
      config.SHADING = false;
    }

    /* ── Pointer state ── */
    function PointerProto() {
      this.id = -1;
      this.texcoordX = 0; this.texcoordY = 0;
      this.prevTexcoordX = 0; this.prevTexcoordY = 0;
      this.deltaX = 0; this.deltaY = 0;
      this.down = false; this.moved = false;
      this.color = [0, 0, 0];
    }
    this._pointers = [new PointerProto()];
    this._PointerProto = PointerProto;

    /* ── Shaders ── */
    this._buildShaders();

    /* ── Blit quad ── */
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,-1,1,1,1,1,-1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0,1,2,0,2,3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    this._blit = (target, clear = false) => {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) { gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT); }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };

    /* ── FBOs ── */
    this._dye = this._velocity = this._divergence = this._curl = this._pressure = null;
    this._updateKeywords();
    this._initFramebuffers();

    /* ── Timing ── */
    this._lastUpdateTime   = Date.now();
    this._colorUpdateTimer = 0;
    this._firstMouseMove   = false;

    /* ── Events ── */
    this._onMouseDown  = this._handleMouseDown.bind(this);
    this._onMouseMove  = this._handleMouseMove.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove  = this._handleTouchMove.bind(this);
    this._onTouchEnd   = this._handleTouchEnd.bind(this);

    window.addEventListener('mousedown',  this._onMouseDown);
    window.addEventListener('mousemove',  this._onMouseMove);
    window.addEventListener('touchstart', this._onTouchStart);
    window.addEventListener('touchmove',  this._onTouchMove, false);
    window.addEventListener('touchend',   this._onTouchEnd);

    this._updateFrame();
  }

  /* ── WebGL context ── */
  _getWebGLContext(canvas) {
    const params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    let gl = canvas.getContext('webgl2', params);
    const isWebGL2 = !!gl;
    if (!isWebGL2) gl = canvas.getContext('webgl', params) || canvas.getContext('experimental-webgl', params);

    let halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      gl.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = gl.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = gl.getExtension('OES_texture_half_float');
      supportLinearFiltering = gl.getExtension('OES_texture_half_float_linear');
    }
    gl.clearColor(0, 0, 0, 1);
    const halfFloatTexType = isWebGL2 ? gl.HALF_FLOAT : halfFloat && halfFloat.HALF_FLOAT_OES;
    const formatRGBA = isWebGL2
      ? this._getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, halfFloatTexType)
      : this._getSupportedFormat(gl, gl.RGBA,    gl.RGBA, halfFloatTexType);
    const formatRG = isWebGL2
      ? this._getSupportedFormat(gl, gl.RG16F, gl.RG,   halfFloatTexType)
      : this._getSupportedFormat(gl, gl.RGBA,  gl.RGBA, halfFloatTexType);
    const formatR = isWebGL2
      ? this._getSupportedFormat(gl, gl.R16F, gl.RED,  halfFloatTexType)
      : this._getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
    return { gl, ext: { formatRGBA, formatRG, formatR, halfFloatTexType, supportLinearFiltering } };
  }

  _getSupportedFormat(gl, internalFormat, format, type) {
    if (!this._supportRenderTextureFormat(gl, internalFormat, format, type)) {
      if (internalFormat === gl.R16F)  return this._getSupportedFormat(gl, gl.RG16F,   gl.RG,   type);
      if (internalFormat === gl.RG16F) return this._getSupportedFormat(gl, gl.RGBA16F, gl.RGBA, type);
      return null;
    }
    return { internalFormat, format };
  }

  _supportRenderTextureFormat(gl, internalFormat, format, type) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  }

  /* ── Shader helpers ── */
  _compileShader(type, source, keywords) {
    const gl = this._gl;
    if (keywords) source = keywords.map(k => '#define ' + k).join('\n') + '\n' + source;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(shader));
    return shader;
  }

  _createProgram(vs, fs) {
    const gl = this._gl;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) console.error(gl.getProgramInfoLog(prog));
    return prog;
  }

  _getUniforms(program) {
    const gl = this._gl;
    const uniforms = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return uniforms;
  }

  _buildShaders() {
    const gl  = this._gl;
    const ext = this._ext;
    const cs  = this._compileShader.bind(this);
    const cp  = this._createProgram.bind(this);
    const gu  = this._getUniforms.bind(this);

    const makeProgram = (vs, fs) => { const p = cp(vs, fs); return { program: p, uniforms: gu(p), bind() { gl.useProgram(p); } }; };

    const baseVS = cs(gl.VERTEX_SHADER, `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv, vL, vR, vT, vB;
      uniform vec2 texelSize;
      void main(){
        vUv = aPosition * 0.5 + 0.5;
        vL  = vUv - vec2(texelSize.x, 0.0);
        vR  = vUv + vec2(texelSize.x, 0.0);
        vT  = vUv + vec2(0.0, texelSize.y);
        vB  = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }`);

    const copyFS       = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv; uniform sampler2D uTexture; void main(){ gl_FragColor = texture2D(uTexture, vUv); }`);
    const clearFS      = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv; uniform sampler2D uTexture; uniform float value; void main(){ gl_FragColor = value * texture2D(uTexture, vUv); }`);
    const splatFS      = cs(gl.FRAGMENT_SHADER, `precision highp float; precision highp sampler2D; varying vec2 vUv; uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius; void main(){ vec2 p = vUv - point.xy; p.x *= aspectRatio; vec3 splat = exp(-dot(p,p)/radius)*color; vec3 base = texture2D(uTarget,vUv).xyz; gl_FragColor = vec4(base+splat,1.0); }`);
    const divergenceFS = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).x,R=texture2D(uVelocity,vR).x,T=texture2D(uVelocity,vT).y,B=texture2D(uVelocity,vB).y; vec2 C=texture2D(uVelocity,vUv).xy; if(vL.x<0.0){L=-C.x;} if(vR.x>1.0){R=-C.x;} if(vT.y>1.0){T=-C.y;} if(vB.y<0.0){B=-C.y;} gl_FragColor=vec4(0.5*(R-L+T-B),0.0,0.0,1.0); }`);
    const curlFS       = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity; void main(){ float L=texture2D(uVelocity,vL).y,R=texture2D(uVelocity,vR).y,T=texture2D(uVelocity,vT).x,B=texture2D(uVelocity,vB).x; gl_FragColor=vec4(0.5*(R-L-T+B),0.0,0.0,1.0); }`);
    const vorticityFS  = cs(gl.FRAGMENT_SHADER, `precision highp float; precision highp sampler2D; varying vec2 vUv,vL,vR,vT,vB; uniform sampler2D uVelocity,uCurl; uniform float curl,dt; void main(){ float L=texture2D(uCurl,vL).x,R=texture2D(uCurl,vR).x,T=texture2D(uCurl,vT).x,B=texture2D(uCurl,vB).x,C=texture2D(uCurl,vUv).x; vec2 force=0.5*vec2(abs(T)-abs(B),abs(R)-abs(L)); force/=length(force)+0.0001; force*=curl*C; force.y*=-1.0; vec2 vel=texture2D(uVelocity,vUv).xy+force*dt; vel=min(max(vel,-1000.0),1000.0); gl_FragColor=vec4(vel,0.0,1.0); }`);
    const pressureFS   = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uDivergence; void main(){ float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x,div=texture2D(uDivergence,vUv).x; gl_FragColor=vec4((L+R+B+T-div)*0.25,0.0,0.0,1.0); }`);
    const gradSubFS    = cs(gl.FRAGMENT_SHADER, `precision mediump float; precision mediump sampler2D; varying highp vec2 vUv,vL,vR,vT,vB; uniform sampler2D uPressure,uVelocity; void main(){ float L=texture2D(uPressure,vL).x,R=texture2D(uPressure,vR).x,T=texture2D(uPressure,vT).x,B=texture2D(uPressure,vB).x; vec2 vel=texture2D(uVelocity,vUv).xy; vel.xy-=vec2(R-L,T-B); gl_FragColor=vec4(vel,0.0,1.0); }`);
    const advectionFS  = cs(gl.FRAGMENT_SHADER, `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv; uniform sampler2D uVelocity,uSource;
      uniform vec2 texelSize,dyeTexelSize; uniform float dt,dissipation;
      vec4 bilerp(sampler2D sam,vec2 uv,vec2 tsize){
        vec2 st=uv/tsize-0.5; vec2 iuv=floor(st); vec2 fuv=fract(st);
        vec4 a=texture2D(sam,(iuv+vec2(0.5,0.5))*tsize);
        vec4 b=texture2D(sam,(iuv+vec2(1.5,0.5))*tsize);
        vec4 c=texture2D(sam,(iuv+vec2(0.5,1.5))*tsize);
        vec4 d=texture2D(sam,(iuv+vec2(1.5,1.5))*tsize);
        return mix(mix(a,b,fuv.x),mix(c,d,fuv.x),fuv.y);
      }
      void main(){
        #ifdef MANUAL_FILTERING
          vec2 coord=vUv-dt*bilerp(uVelocity,vUv,texelSize).xy*texelSize;
          vec4 result=bilerp(uSource,coord,dyeTexelSize);
        #else
          vec2 coord=vUv-dt*texture2D(uVelocity,vUv).xy*texelSize;
          vec4 result=texture2D(uSource,coord);
        #endif
        gl_FragColor=result/(1.0+dissipation*dt);
      }`, ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']);

    const displayFS = `
      precision highp float; precision highp sampler2D;
      varying vec2 vUv,vL,vR,vT,vB;
      uniform sampler2D uTexture; uniform vec2 texelSize;
      void main(){
        vec3 c=texture2D(uTexture,vUv).rgb;
        #ifdef SHADING
          vec3 lc=texture2D(uTexture,vL).rgb,rc=texture2D(uTexture,vR).rgb,
               tc=texture2D(uTexture,vT).rgb,bc=texture2D(uTexture,vB).rgb;
          float dx=length(rc)-length(lc),dy=length(tc)-length(bc);
          vec3 n=normalize(vec3(dx,dy,length(texelSize)));
          float diffuse=clamp(dot(n,vec3(0,0,1))+0.7,0.7,1.0);
          c*=diffuse;
        #endif
        float a=max(c.r,max(c.g,c.b));
        gl_FragColor=vec4(c,a);
      }`;

    /* Material — supports keyword recompilation for SHADING toggle */
    const self = this;
    class Material {
      constructor(vs, fsSource) {
        this._vs = vs; this._fsSource = fsSource;
        this._programs = {}; this.activeProgram = null; this.uniforms = {};
      }
      setKeywords(keywords) {
        const hash = keywords.reduce((h, k) => h + self._hashCode(k), 0);
        if (!this._programs[hash]) {
          const fs = self._compileShader(gl.FRAGMENT_SHADER, this._fsSource, keywords);
          const p  = self._createProgram(this._vs, fs);
          this._programs[hash] = { program: p, uniforms: self._getUniforms(p) };
        }
        const entry = this._programs[hash];
        if (entry.program === this.activeProgram) return;
        this.activeProgram = entry.program;
        this.uniforms = entry.uniforms;
      }
      bind() { gl.useProgram(this.activeProgram); }
    }

    this._prog = {
      copy:       makeProgram(baseVS, copyFS),
      clear:      makeProgram(baseVS, clearFS),
      splat:      makeProgram(baseVS, splatFS),
      advection:  makeProgram(baseVS, advectionFS),
      divergence: makeProgram(baseVS, divergenceFS),
      curl:       makeProgram(baseVS, curlFS),
      vorticity:  makeProgram(baseVS, vorticityFS),
      pressure:   makeProgram(baseVS, pressureFS),
      gradSub:    makeProgram(baseVS, gradSubFS),
      display:    new Material(baseVS, displayFS),
    };
  }

  /* ── FBOs ── */
  _updateKeywords() {
    const kw = this._cfg.SHADING ? ['SHADING'] : [];
    this._prog.display.setKeywords(kw);
  }

  _initFramebuffers() {
    const gl  = this._gl;
    const ext = this._ext;
    const cfg = this._cfg;
    const simRes = this._getResolution(cfg.SIM_RESOLUTION);
    const dyeRes = this._getResolution(cfg.DYE_RESOLUTION);
    const type   = ext.halfFloatTexType;
    const rgba   = ext.formatRGBA;
    const rg     = ext.formatRG;
    const r      = ext.formatR;
    const filter = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);

    this._dye      = !this._dye ? this._createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filter)
                                : this._resizeDoubleFBO(this._dye, dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, type, filter);
    this._velocity = !this._velocity ? this._createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, type, filter)
                                     : this._resizeDoubleFBO(this._velocity, simRes.width, simRes.height, rg.internalFormat, rg.format, type, filter);
    this._divergence = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    this._curl       = this._createFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
    this._pressure   = this._createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, type, gl.NEAREST);
  }

  _createFBO(w, h, internalFormat, format, type, param) {
    const gl = this._gl;
    gl.activeTexture(gl.TEXTURE0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return { texture: tex, fbo, width: w, height: h,
      texelSizeX: 1/w, texelSizeY: 1/h,
      attach(id) { gl.activeTexture(gl.TEXTURE0 + id); gl.bindTexture(gl.TEXTURE_2D, tex); return id; } };
  }

  _createDoubleFBO(w, h, iF, f, t, p) {
    let a = this._createFBO(w, h, iF, f, t, p);
    let b = this._createFBO(w, h, iF, f, t, p);
    return { width: w, height: h, texelSizeX: a.texelSizeX, texelSizeY: a.texelSizeY,
      get read()  { return a; }, set read(v)  { a = v; },
      get write() { return b; }, set write(v) { b = v; },
      swap() { const tmp = a; a = b; b = tmp; } };
  }

  _resizeFBO(target, w, h, iF, f, t, p) {
    const newFBO = this._createFBO(w, h, iF, f, t, p);
    const prog = this._prog.copy;
    prog.bind();
    this._gl.uniform1i(prog.uniforms.uTexture, target.attach(0));
    this._blit(newFBO);
    return newFBO;
  }

  _resizeDoubleFBO(target, w, h, iF, f, t, p) {
    if (target.width === w && target.height === h) return target;
    target.read  = this._resizeFBO(target.read, w, h, iF, f, t, p);
    target.write = this._createFBO(w, h, iF, f, t, p);
    target.width = w; target.height = h;
    target.texelSizeX = 1/w; target.texelSizeY = 1/h;
    return target;
  }

  /* ── Frame loop ── */
  _updateFrame() {
    if (!this._active) return;
    const dt = this._calcDt();
    if (this._resizeCanvas()) this._initFramebuffers();
    this._updateColors(dt);
    this._applyInputs();
    this._step(dt);
    this._render(null);
    this._rafId = requestAnimationFrame(this._updateFrame.bind(this));
  }

  _calcDt() {
    const now = Date.now();
    const dt  = Math.min((now - this._lastUpdateTime) / 1000, 0.016666);
    this._lastUpdateTime = now;
    return dt;
  }

  _resizeCanvas() {
    const canvas = this._canvas;
    const w = this._scaleByPixelRatio(canvas.clientWidth);
    const h = this._scaleByPixelRatio(canvas.clientHeight);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; return true; }
    return false;
  }

  _updateColors(dt) {
    this._colorUpdateTimer += dt * this._cfg.COLOR_UPDATE_SPEED;
    if (this._colorUpdateTimer >= 1) {
      this._colorUpdateTimer = this._wrap(this._colorUpdateTimer, 0, 1);
      this._pointers.forEach(p => { p.color = this._generateColor(); });
    }
  }

  _applyInputs() {
    this._pointers.forEach(p => {
      if (p.moved) { p.moved = false; this._splatPointer(p); }
    });
  }

  _step(dt) {
    const gl   = this._gl;
    const cfg  = this._cfg;
    const prog = this._prog;
    const blit = this._blit;
    const vel  = this._velocity;
    const dye  = this._dye;

    gl.disable(gl.BLEND);

    prog.curl.bind();
    gl.uniform2f(prog.curl.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    gl.uniform1i(prog.curl.uniforms.uVelocity, vel.read.attach(0));
    blit(this._curl);

    prog.vorticity.bind();
    gl.uniform2f(prog.vorticity.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    gl.uniform1i(prog.vorticity.uniforms.uVelocity, vel.read.attach(0));
    gl.uniform1i(prog.vorticity.uniforms.uCurl, this._curl.attach(1));
    gl.uniform1f(prog.vorticity.uniforms.curl, cfg.CURL);
    gl.uniform1f(prog.vorticity.uniforms.dt, dt);
    blit(vel.write); vel.swap();

    prog.divergence.bind();
    gl.uniform2f(prog.divergence.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    gl.uniform1i(prog.divergence.uniforms.uVelocity, vel.read.attach(0));
    blit(this._divergence);

    prog.clear.bind();
    gl.uniform1i(prog.clear.uniforms.uTexture, this._pressure.read.attach(0));
    gl.uniform1f(prog.clear.uniforms.value, cfg.PRESSURE);
    blit(this._pressure.write); this._pressure.swap();

    prog.pressure.bind();
    gl.uniform2f(prog.pressure.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    gl.uniform1i(prog.pressure.uniforms.uDivergence, this._divergence.attach(0));
    for (let i = 0; i < cfg.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(prog.pressure.uniforms.uPressure, this._pressure.read.attach(1));
      blit(this._pressure.write); this._pressure.swap();
    }

    prog.gradSub.bind();
    gl.uniform2f(prog.gradSub.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    gl.uniform1i(prog.gradSub.uniforms.uPressure, this._pressure.read.attach(0));
    gl.uniform1i(prog.gradSub.uniforms.uVelocity, vel.read.attach(1));
    blit(vel.write); vel.swap();

    prog.advection.bind();
    gl.uniform2f(prog.advection.uniforms.texelSize, vel.texelSizeX, vel.texelSizeY);
    if (!this._ext.supportLinearFiltering)
      gl.uniform2f(prog.advection.uniforms.dyeTexelSize, vel.texelSizeX, vel.texelSizeY);
    const velId = vel.read.attach(0);
    gl.uniform1i(prog.advection.uniforms.uVelocity, velId);
    gl.uniform1i(prog.advection.uniforms.uSource, velId);
    gl.uniform1f(prog.advection.uniforms.dt, dt);
    gl.uniform1f(prog.advection.uniforms.dissipation, cfg.VELOCITY_DISSIPATION);
    blit(vel.write); vel.swap();

    if (!this._ext.supportLinearFiltering)
      gl.uniform2f(prog.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    gl.uniform1i(prog.advection.uniforms.uVelocity, vel.read.attach(0));
    gl.uniform1i(prog.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(prog.advection.uniforms.dissipation, cfg.DENSITY_DISSIPATION);
    blit(dye.write); dye.swap();
  }

  _render(target) {
    const gl = this._gl;
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.BLEND);
    const prog  = this._prog.display;
    const w = target ? target.width  : gl.drawingBufferWidth;
    const h = target ? target.height : gl.drawingBufferHeight;
    prog.bind();
    if (this._cfg.SHADING) gl.uniform2f(prog.uniforms.texelSize, 1/w, 1/h);
    gl.uniform1i(prog.uniforms.uTexture, this._dye.read.attach(0));
    this._blit(target);
  }

  /* ── Splat ── */
  _splatPointer(p) {
    this._splat(p.texcoordX, p.texcoordY,
      p.deltaX * this._cfg.SPLAT_FORCE,
      p.deltaY * this._cfg.SPLAT_FORCE,
      p.color);
  }

  _clickSplat(p) {
    const c = this._generateColor();
    c.r *= 10; c.g *= 10; c.b *= 10;
    this._splat(p.texcoordX, p.texcoordY,
      10 * (Math.random() - 0.5),
      30 * (Math.random() - 0.5), c);
  }

  _splat(x, y, dx, dy, color) {
    const gl   = this._gl;
    const prog = this._prog.splat;
    const vel  = this._velocity;
    const dye  = this._dye;
    prog.bind();
    gl.uniform1i(prog.uniforms.uTarget, vel.read.attach(0));
    gl.uniform1f(prog.uniforms.aspectRatio, this._canvas.width / this._canvas.height);
    gl.uniform2f(prog.uniforms.point, x, y);
    gl.uniform3f(prog.uniforms.color, dx, dy, 0);
    gl.uniform1f(prog.uniforms.radius, this._correctRadius(this._cfg.SPLAT_RADIUS / 100));
    this._blit(vel.write); vel.swap();
    gl.uniform1i(prog.uniforms.uTarget, dye.read.attach(0));
    gl.uniform3f(prog.uniforms.color, color.r, color.g, color.b);
    this._blit(dye.write); dye.swap();
  }

  _correctRadius(r) {
    const ar = this._canvas.width / this._canvas.height;
    return ar > 1 ? r * ar : r;
  }

  /* ── Pointer update helpers ── */
  _updatePointerDown(p, id, posX, posY) {
    p.id = id; p.down = true; p.moved = false;
    p.texcoordX = posX / this._canvas.width;
    p.texcoordY = 1 - posY / this._canvas.height;
    p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
    p.deltaX = 0; p.deltaY = 0; p.color = this._generateColor();
  }

  _updatePointerMove(p, posX, posY, color) {
    p.prevTexcoordX = p.texcoordX; p.prevTexcoordY = p.texcoordY;
    p.texcoordX = posX / this._canvas.width;
    p.texcoordY = 1 - posY / this._canvas.height;
    p.deltaX = this._correctDeltaX(p.texcoordX - p.prevTexcoordX);
    p.deltaY = this._correctDeltaY(p.texcoordY - p.prevTexcoordY);
    p.moved  = Math.abs(p.deltaX) > 0 || Math.abs(p.deltaY) > 0;
    p.color  = color;
  }

  _correctDeltaX(d) { const ar = this._canvas.width / this._canvas.height; return ar < 1 ? d * ar : d; }
  _correctDeltaY(d) { const ar = this._canvas.width / this._canvas.height; return ar > 1 ? d / ar : d; }

  /* ── Event handlers ── */
  _handleMouseDown(e) {
    const p = this._pointers[0];
    const x = this._scaleByPixelRatio(e.clientX);
    const y = this._scaleByPixelRatio(e.clientY);
    this._updatePointerDown(p, -1, x, y);
    this._clickSplat(p);
  }

  _handleMouseMove(e) {
    const p = this._pointers[0];
    const x = this._scaleByPixelRatio(e.clientX);
    const y = this._scaleByPixelRatio(e.clientY);
    const color = this._firstMouseMove ? p.color : this._generateColor();
    this._firstMouseMove = true;
    this._updatePointerMove(p, x, y, color);
  }

  _handleTouchStart(e) {
    const p = this._pointers[0];
    for (const t of e.targetTouches) {
      this._updatePointerDown(p, t.identifier,
        this._scaleByPixelRatio(t.clientX),
        this._scaleByPixelRatio(t.clientY));
    }
  }

  _handleTouchMove(e) {
    const p = this._pointers[0];
    for (const t of e.targetTouches) {
      this._updatePointerMove(p,
        this._scaleByPixelRatio(t.clientX),
        this._scaleByPixelRatio(t.clientY), p.color);
    }
  }

  _handleTouchEnd(e) {
    for (const t of e.changedTouches) { this._pointers[0].down = false; void t; }
  }

  /* ── Utils ── */
  _generateColor() {
    const c = this._HSVtoRGB(Math.random(), 1, 1);
    c.r *= 0.15; c.g *= 0.15; c.b *= 0.15;
    return c;
  }

  _HSVtoRGB(h, s, v) {
    const i = Math.floor(h * 6), f = h * 6 - i;
    const p = v*(1-s), q = v*(1-f*s), t = v*(1-(1-f)*s);
    const cases = [[v,t,p],[q,v,p],[p,v,t],[p,q,v],[t,p,v],[v,p,q]];
    const [r,g,b] = cases[i % 6];
    return { r, g, b };
  }

  _wrap(v, min, max) { const r = max - min; return r === 0 ? min : ((v - min) % r) + min; }

  _getResolution(res) {
    const gl = this._gl;
    let ar = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (ar < 1) ar = 1 / ar;
    const min = Math.round(res), max = Math.round(res * ar);
    return gl.drawingBufferWidth > gl.drawingBufferHeight
      ? { width: max, height: min }
      : { width: min, height: max };
  }

  _scaleByPixelRatio(v) { return Math.floor(v * (window.devicePixelRatio || 1)); }

  _hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) { h = (h << 5) - h + s.charCodeAt(i); h |= 0; }
    return h;
  }
}