// The opening 3D scene: a ribbon of Herbert's work loops past the camera, then, as you scroll,
// the pieces fall into a grid of soft cloth sheets that ripple under the cursor. Click a sheet to open it.
// Loaded only when WebGL works and reduced motion is off (app.js decides); otherwise the page shows as usual.
import * as THREE from "/vendor/three.module.min.js";

const VERT = `
uniform float uTime, uHover, uBend, uCloth;
uniform vec2 uPointer;
varying vec2 vUv;
varying float vShade;
void main() {
  vUv = uv;
  vec3 p = position;
  // A slow breath of wind across the sheet.
  float wind = sin(p.x * 3.1 + uTime * 1.4) * 0.035 + sin(p.y * 4.3 + uTime * 1.1) * 0.025;
  // Ripples spreading from the cursor.
  float d = distance(uv, uPointer);
  float ripple = sin(d * 26.0 - uTime * 7.0) * exp(-d * 5.5) * 0.11 * uHover;
  // The sheet curls while it falls into the grid.
  float curl = uBend * (p.x * p.x * 0.9 - p.y * 0.25);
  p.z += wind * uCloth + ripple + curl;
  vShade = 1.0 + (ripple + wind * uCloth) * 1.6 - abs(curl) * 0.35;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FRAG = `
uniform sampler2D uMap;
uniform vec2 uUvScale, uUvOffset;
uniform float uReady, uLift;
varying vec2 vUv;
varying float vShade;
void main() {
  vec3 base = vec3(0.10, 0.11, 0.14);
  vec3 c = texture2D(uMap, vUv * uUvScale + uUvOffset).rgb;
  c = mix(base, c, uReady) * clamp(vShade, 0.72, 1.18) + uLift * 0.06;
  gl_FragColor = vec4(c, 1.0);
}`;

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function start({ tiles, onOpen }) {
  const wrap = document.getElementById("reel");
  const canvas = document.getElementById("reel-canvas");
  const hint = document.getElementById("reel-hint");
  if (!wrap || !canvas || !tiles.length) return false;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch {
    return false;
  }
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // the shader passes image colors straight through
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  const TILE_ASPECT = 4 / 3; // every sheet is 4:3; photos are cropped to fit (like object-fit: cover)
  const geo = new THREE.PlaneGeometry(TILE_ASPECT, 1, 28, 21);
  const loader = new THREE.TextureLoader();
  const meshes = tiles.map((t, i) => {
    const uniforms = {
      uMap: { value: null }, uUvScale: { value: new THREE.Vector2(1, 1) }, uUvOffset: { value: new THREE.Vector2(0, 0) },
      uTime: { value: 0 }, uHover: { value: 0 }, uBend: { value: 0 }, uCloth: { value: 1 }, uReady: { value: 0 },
      uLift: { value: 0 }, uPointer: { value: new THREE.Vector2(0.5, 0.5) },
    };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData = { tile: t, i, ready: 0, hover: 0 };
    loader.load(t.src, (tex) => {
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      const a = tex.image.width / tex.image.height;
      if (a > TILE_ASPECT) { uniforms.uUvScale.value.set(TILE_ASPECT / a, 1); uniforms.uUvOffset.value.set((1 - TILE_ASPECT / a) / 2, 0); }
      else { uniforms.uUvScale.value.set(1, a / TILE_ASPECT); uniforms.uUvOffset.value.set(0, (1 - a / TILE_ASPECT) / 2); }
      uniforms.uMap.value = tex;
      mesh.userData.loaded = true;
    });
    scene.add(mesh);
    return mesh;
  });

  // Layout targets, recomputed on resize.
  let grid = [], cols = 4, view = { w: 1, h: 1 }, ribbonR = 4, ribbonX = 0, narrow = false;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.w = view.h * camera.aspect;
    narrow = camera.aspect < 0.9;
    cols = narrow ? 2 : camera.aspect < 1.4 ? 3 : 4;
    const rows = Math.ceil(meshes.length / cols);
    const cellW = Math.min((view.w * (narrow ? 0.9 : 0.8)) / cols, (view.h * 0.74) / rows * TILE_ASPECT);
    const scale = cellW * 0.9 / TILE_ASPECT;
    // On wide screens the ribbon loops on the right, behind and beside the name; on phones it sits low.
    ribbonR = narrow ? view.w * 0.55 : Math.min(view.w * 0.26, 3.2);
    ribbonX = narrow ? 0 : view.w * 0.22;
    grid = meshes.map((m, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const lastRow = Math.floor((meshes.length - 1) / cols) === r;
      const inRow = lastRow ? meshes.length - r * cols : cols; // center a short last row
      const x = (c - (inRow - 1) / 2) * cellW;
      const y = ((rows - 1) / 2 - r) * (cellW / TILE_ASPECT);
      return { pos: new THREE.Vector3(x, y - view.h * 0.05, 0), scale };
    });
  }
  layout();
  addEventListener("resize", layout);

  // Scroll: 0 at the top of the page, 1 when the stage is about to scroll away.
  let progress = 0;
  const readScroll = () => {
    const r = wrap.getBoundingClientRect();
    const travel = Math.max(1, wrap.offsetHeight - innerHeight);
    progress = clamp01(-r.top / travel);
    // Dark top bar while the dark stage is under it; light again once the summary panel reaches the top.
    const panel = document.querySelector(".hero-panel-bg");
    document.documentElement.classList.toggle("over-reel", (panel ? panel.getBoundingClientRect().top : r.bottom) > 72);
  };
  readScroll();
  addEventListener("scroll", readScroll, { passive: true });

  // Pointer: ripple the sheet under the cursor; click opens the piece.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-9, -9);
  let hovered = null;
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  });
  canvas.addEventListener("pointerleave", () => ndc.set(-9, -9));
  canvas.addEventListener("click", () => { if (hovered && gridT > 0.85) onOpen(hovered.userData.tile.item, hovered.userData.tile.index); });

  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), e0 = new THREE.Euler();
  const tmp = new THREE.Vector3();
  let gridT = 0, running = true, last = performance.now(), clock = 0;

  // Only animate while the stage is on screen and the tab is visible.
  new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(frame); } }).observe(wrap);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && running) { last = performance.now(); requestAnimationFrame(frame); } });

  function frame(now) {
    if (!running || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    // Ribbon until 22% of the way down, fall between 22% and 70%, then the grid holds.
    gridT = clamp01((progress - 0.12) / 0.36); // the grid is complete by about half way and holds
    const spin = clock * 0.16 + progress * 1.4;
    const n = meshes.length;

    ray.setFromCamera(ndc, camera);
    const hit = gridT > 0.85 ? ray.intersectObjects(meshes, false)[0] : null;
    hovered = hit ? hit.object : null;
    canvas.style.cursor = hovered ? "pointer" : "";

    meshes.forEach((m, i) => {
      // Ribbon: a tilted loop that swings the pieces past the camera.
      const a = (i / n) * Math.PI * 2 + spin;
      const rx = ribbonX + Math.sin(a) * ribbonR;
      const rz = Math.cos(a) * ribbonR * 0.9 - (narrow ? 3.2 : 1.8);
      const ry = Math.sin(a * 2 + clock * 0.3) * 0.5 + Math.cos(a) * 0.3 + (narrow ? -view.h * 0.22 : 0);
      e0.set(0.12 * Math.sin(a * 2), a, 0.08 * Math.cos(a));
      q0.setFromEuler(e0);
      // Each piece starts falling a little after the one before it.
      const local = ease(clamp01(gridT * 1.5 - (i / n) * 0.5));
      const g = grid[i];
      tmp.set(rx, ry, rz).lerp(g.pos, local);
      tmp.y += Math.sin(local * Math.PI) * 0.9; // a small lift before it settles
      m.position.copy(tmp);
      q1.identity();
      m.quaternion.copy(q0).slerp(q1, local);
      const s = THREE.MathUtils.lerp(0.95, g.scale, local);
      m.scale.set(s, s, 1);

      const u = m.material.uniforms;
      u.uTime.value = clock + i * 0.37;
      u.uBend.value = Math.sin(local * Math.PI) * 0.55;
      u.uCloth.value = 1 - local * 0.6;
      m.userData.ready = Math.min(1, m.userData.ready + (m.userData.loaded ? dt * 2 : 0));
      u.uReady.value = m.userData.ready;
      const target = hovered === m ? 1 : 0;
      m.userData.hover += (target - m.userData.hover) * Math.min(1, dt * 6);
      u.uHover.value = m.userData.hover;
      u.uLift.value = m.userData.hover;
      if (hit && hovered === m) u.uPointer.value.copy(hit.uv);
    });
    if (hint) hint.style.opacity = String(1 - clamp01(progress * 6));
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
}
