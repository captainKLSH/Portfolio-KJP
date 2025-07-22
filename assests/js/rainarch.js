
import {
  simulationVertexShader,
  simulationFragmentShader,
  renderVertexShader,
  renderFragmentShader
} from "./shaders.js";

let drawText; // Declare globally
let textTexture; // Declare globally

function updateTextTexture() {
  if (typeof drawText === 'function' && textTexture) {
    drawText();
    textTexture.needsUpdate = true;
  }
}

// Listen for theme changes
const observer = new MutationObserver(updateTextTexture);
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
});

// Apply saved theme on load
const html = document.documentElement;
if (localStorage.getItem('theme') === 'dark') {
  html.classList.add('dark-theme');
}

document.addEventListener("DOMContentLoaded", () => {
  const scene = new THREE.Scene();
  const simScene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.insertBefore(renderer.domElement, document.body.firstChild);

  const mouse = new THREE.Vector2(-1000, -1000);
  let frame = 0;

  let width = window.innerWidth * window.devicePixelRatio;
  let height = window.innerHeight * window.devicePixelRatio;

  const options = {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    stencilBuffer: false,
    depthBuffer: false,
  };

  let rtA = new THREE.WebGLRenderTarget(width, height, options);
  let rtB = new THREE.WebGLRenderTarget(width, height, options);

  const simMaterial = new THREE.ShaderMaterial({
    uniforms: {
      textureA: { value: null },
      mouse: { value: mouse },
      resolution: { value: new THREE.Vector2(width, height) },
      time: { value: 0 },
      frame: { value: 0 },
    },
    vertexShader: simulationVertexShader,
    fragmentShader: simulationFragmentShader,
  });

  const renderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      textureA: { value: null },
      textureB: { value: null },
    },
    vertexShader: renderVertexShader,
    fragmentShader: renderFragmentShader,
    transparent: true,
  });

  const plane = new THREE.PlaneGeometry(2, 2);
  const simQuad = new THREE.Mesh(plane, simMaterial);
  const renderQuad = new THREE.Mesh(plane, renderMaterial);
  simScene.add(simQuad);
  scene.add(renderQuad);

  // Canvas for text
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });

  drawText = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const styles = getComputedStyle(document.documentElement);
    const bgColor = styles.getPropertyValue('--white-color').trim();
    const textColor = styles.getPropertyValue('--black-color').trim();

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const fontSize = Math.round(130 * window.devicePixelRatio);
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px "Ubuntu"`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    ctx.fillText("Chaos into Pattern", canvas.width / 2, canvas.height / 2);
  };

  drawText();

  textTexture = new THREE.CanvasTexture(canvas);
  textTexture.minFilter = THREE.LinearFilter;
  textTexture.magFilter = THREE.LinearFilter;
  textTexture.needsUpdate = true;
  renderMaterial.uniforms.textureB.value = textTexture;

  window.addEventListener("resize", () => {
    width = window.innerWidth * window.devicePixelRatio;
    height = window.innerHeight * window.devicePixelRatio;

    renderer.setSize(window.innerWidth, window.innerHeight);
    rtA.setSize(width, height);
    rtB.setSize(width, height);
    simMaterial.uniforms.resolution.value.set(width, height);

    canvas.width = width;
    canvas.height = height;
    drawText();
    textTexture.needsUpdate = true;
  });

  renderer.domElement.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX * window.devicePixelRatio;
    mouse.y = (window.innerHeight - e.clientY) * window.devicePixelRatio;
  });

  renderer.domElement.addEventListener("mouseleave", () => {
    mouse.set(-1000, -1000);
  });

  const animate = () => {
    simMaterial.uniforms.frame.value = frame++;
    simMaterial.uniforms.time.value = performance.now() / 1000;
    simMaterial.uniforms.textureA.value = rtA.texture;

    renderer.setRenderTarget(rtB);
    renderer.render(simScene, camera);

    renderMaterial.uniforms.textureA.value = rtB.texture;

    renderer.setRenderTarget(null);
    renderer.render(scene, camera);

    [rtA, rtB] = [rtB, rtA];

    requestAnimationFrame(animate);
  };

  animate();
});
