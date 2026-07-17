import * as THREE from "three";

let renderer;
let scene;
let camera;
let points;
let material;
let uniforms;
let basePositions;
let particleMeta;
let renderOptions;

window.__initScene = (options) => {
  renderOptions = options;
  renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: true
  });
  renderer.setSize(options.width, options.height, false);
  renderer.setClearColor(0x061018, 1);
  document.body.replaceChildren(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;

  const background = createBackground();
  scene.add(background);

  const rng = createRng(options.seed);
  const count = Math.max(1, Math.floor(options.params.particleCount));
  basePositions = new Float32Array(count * 3);
  particleMeta = new Float32Array(count * 4);

  for (let index = 0; index < count; index += 1) {
    basePositions[index * 3] = rng() * 2 - 1;
    basePositions[index * 3 + 1] = rng() * 2 - 1;
    basePositions[index * 3 + 2] = 0;
    particleMeta[index * 4] = rng() * Math.PI * 2;
    particleMeta[index * 4 + 1] = 0.25 + rng() * 0.75;
    particleMeta[index * 4 + 2] = 0.08 + rng() * 0.25;
    particleMeta[index * 4 + 3] = 1 + Math.floor(rng() * 4);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(basePositions.slice(), 3));
  material = new THREE.PointsMaterial({
    color: new THREE.Color(0.45, 0.78, 0.82),
    size: 0.0045 + options.params.brightness * 0.006,
    transparent: true,
    opacity: 0.18 + options.params.brightness * 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  points = new THREE.Points(geometry, material);
  scene.add(points);
};

window.__renderFrame = (frameIndex) => {
  if (!renderer || !points || !renderOptions) {
    throw new Error("シーンが初期化されていません。");
  }

  const denominator = Math.max(1, renderOptions.frameCount - 1);
  const phase = frameIndex / denominator;
  const position = points.geometry.getAttribute("position");
  const drift = renderOptions.params.drift;

  for (let index = 0; index < position.count; index += 1) {
    const baseX = basePositions[index * 3];
    const baseY = basePositions[index * 3 + 1];
    const angle = particleMeta[index * 4] + phase * Math.PI * 2 * particleMeta[index * 4 + 3];
    const radius = particleMeta[index * 4 + 2] * drift;
    const fall = Math.sin(phase * Math.PI * 2 + particleMeta[index * 4]) * 0.03 * particleMeta[index * 4 + 1];
    const x = wrapUnit(baseX + Math.cos(angle) * radius);
    const y = wrapUnit(baseY + Math.sin(angle) * radius + fall);
    position.setXYZ(index, x, y, 0);
  }

  position.needsUpdate = true;
  updateBackground(phase, renderOptions.params.brightness);
  material.opacity = 0.18 + renderOptions.params.brightness * 0.42;
  renderer.render(scene, camera);
};

function createBackground() {
  const geometry = new THREE.PlaneGeometry(2, 2);
  uniforms = {
    topColor: { value: new THREE.Color(0.02, 0.07, 0.12) },
    bottomColor: { value: new THREE.Color(0.04, 0.14, 0.18) }
  };
  const backgroundMaterial = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      void main() {
        float band = smoothstep(0.0, 1.0, vUv.y);
        vec3 color = mix(bottomColor, topColor, band);
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  return new THREE.Mesh(geometry, backgroundMaterial);
}

function updateBackground(phase, brightness) {
  const pulse = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
  uniforms.topColor.value.setRGB(0.02 + brightness * 0.02, 0.07 + pulse * 0.025, 0.12 + brightness * 0.04);
  uniforms.bottomColor.value.setRGB(0.04, 0.14 + brightness * 0.035, 0.18 + pulse * 0.03);
}

function wrapUnit(value) {
  let wrapped = value;
  while (wrapped > 1) wrapped -= 2;
  while (wrapped < -1) wrapped += 2;
  return wrapped;
}

function createRng(seed) {
  let state = hashSeed(seed);
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 4294967296);
  };
}

function hashSeed(seed) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 1;
}
