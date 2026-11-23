// The opening 3D scene: five photos, one per skill, turn slowly in a carousel beside Herbert's name; as you
// scroll they settle into a labeled row (a 2-column grid on phones). Click a photo or its label to open that
// skill's work. Loaded only when WebGL works and reduced motion is off (app.js decides).
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
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function start({ tiles, onOpen, label }) {
  const wrap = document.getElementById("reel");
  const stage = wrap && wrap.querySelector(".reel-stage");
  const canvas = document.getElementById("reel-canvas");
  const hint = document.getElementById("reel-hint");
  if (!wrap || !stage || !canvas || !tiles.length) return false;

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

  // Labels: real links (keyboard and screen readers), placed under each photo every frame.
  const labelBox = document.createElement("div");
  labelBox.className = "reel-labels";
  labelBox.setAttribute("aria-label", "My work by skill");
  const labels = tiles.map((t) => {
    const el = label(t, onOpen);
    el.addEventListener("focus", () => el.classList.add("is-focus"));
    el.addEventListener("blur", () => el.classList.remove("is-focus"));
    labelBox.append(el);
    return el;
  });
  stage.append(labelBox);

  // Layout, recomputed on resize. Sizes are worked out in screen pixels from where the hero text ends,
  // so the photos never cross the name, title, or buttons.
  const textBox = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rg = document.createRange();
    rg.selectNodeContents(el);
    const r = rg.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  };
  let grid = [], view = { w: 1, h: 1 }, px = 1, side = true, ring = { x: 0, y: 0, rx: 1, rz: 2.4, s: 1 }, startY = 0;
  function layout() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    view.h = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    view.w = view.h * camera.aspect;
    px = view.h / h; // world units per screen pixel at depth 0
    const reelTop = wrap.getBoundingClientRect().top;
    const boxes = [".hero-name", ".hero-role", ".hero-specialties", ".hero-tagline", ".hero-cta"].map(textBox).filter(Boolean);
    const textRight = Math.max(...boxes.map((b) => b.right));
    const textBottom = Math.max(...boxes.map((b) => b.bottom)) - reelTop; // in page space, at the top of the reel
    const free = w - textRight - 56;
    let sheetW = Math.min(420, free / 1.45);
    side = sheetW >= 250 && w >= 900;
    let cx, cy;
    if (side) {
      cx = Math.min((textRight + w) / 2 + 8, w - 32 - sheetW * 0.72);
      cy = clamp((Math.min(...boxes.map((b) => b.top)) - reelTop + textBottom) / 2, h * 0.38, h * 0.62);
    } else {
      sheetW = Math.min(w * 0.64, 320);
      cx = w / 2;
      cy = textBottom + 36 + (sheetW / TILE_ASPECT) / 2;
    }
    startY = cy;
    ring = { x: (cx - w / 2) * px, y: 0, rx: sheetW * 0.3 * px, rz: 3.4, s: (sheetW * px) / TILE_ASPECT };

    // The settled grid: one row on wide screens, two columns on phones.
    const n = meshes.length;
    const cols = w >= 900 ? n : w >= 600 ? 3 : 2;
    const rows = Math.ceil(n / cols);
    const labelH = 64 * px; // room for the label under each photo
    const gap = 22 * px;
    const cellW = Math.min((view.w * 0.88 - gap * (cols - 1)) / cols, ((view.h * 0.7 - rows * labelH) / rows) * TILE_ASPECT, 300 * px);
    const cellH = cellW / TILE_ASPECT;
    const totalH = rows * (cellH + labelH) + (rows - 1) * gap * 0.5;
    labelBox.style.setProperty("--lw", Math.max(140, Math.round(cellW / px)) + "px");
    grid = meshes.map((m, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const inRow = r === rows - 1 ? n - r * cols : cols; // center a short last row
      const x = (c - (inRow - 1) / 2) * (cellW + gap);
      const y = totalH / 2 - cellH / 2 - r * (cellH + labelH + gap * 0.5) + 12 * px;
      return { pos: new THREE.Vector3(x, y, 0), scale: cellH };
    });
  }
  layout();
  addEventListener("resize", layout);
  document.fonts?.ready.then(layout);

  // Scroll: 0 at the top of the page, 1 when the stage is about to scroll away.
  let progress = 0, scrolled = 0;
  const readScroll = () => {
    const r = wrap.getBoundingClientRect();
    scrolled = -r.top;
    const travel = Math.max(1, wrap.offsetHeight - innerHeight);
    progress = clamp01(scrolled / travel);
    // Dark top bar while the dark stage is under it; light again once the summary panel reaches the top.
    const panel = document.querySelector(".hero-panel-bg");
    document.documentElement.classList.toggle("over-reel", (panel ? panel.getBoundingClientRect().top : r.bottom) > 72);
  };
  readScroll();
  addEventListener("scroll", readScroll, { passive: true });

  // Pointer: ripple the photo under the cursor; click opens that skill.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-9, -9);
  let hovered = null;
  canvas.addEventListener("pointermove", (e) => {
    const b = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1);
  });
  canvas.addEventListener("pointerleave", () => ndc.set(-9, -9));
  canvas.addEventListener("click", () => { if (hovered) onOpen(hovered.userData.tile.category); });

  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), e0 = new THREE.Euler();
  const tmp = new THREE.Vector3(), under = new THREE.Vector3();
  let gridT = 0, running = true, last = performance.now(), clock = 0;

  // Only animate while the stage is on screen and the tab is visible.
  new IntersectionObserver(([en]) => { running = en.isIntersecting; if (running) { last = performance.now(); requestAnimationFrame(frame); } }).observe(wrap);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && running) { last = performance.now(); requestAnimationFrame(frame); } });

  function frame(now) {
    if (!running || document.hidden) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock += dt;
    // Carousel first; the photos settle into the grid over the next stretch of scrolling, then hold.
    gridT = clamp01((progress - 0.1) / 0.4);
    const spin = clock * 0.22 + progress * 2.2;
    const n = meshes.length;
    const h = canvas.clientHeight;
    // On phones the carousel sits under the buttons and rides up with the page until it reaches the middle.
    const cyPx = side ? startY : Math.max(h * 0.5, startY - scrolled);
    const ringY = (h / 2 - cyPx) * px;

    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(meshes, false)[0];
    hovered = hit && (gridT > 0.85 || hit.object.userData.front > 0.8) ? hit.object : null;
    canvas.style.cursor = hovered ? "pointer" : "";

    let frontIdx = 0;
    meshes.forEach((m, i) => { if (Math.cos((i / n) * Math.PI * 2 + spin) > Math.cos((frontIdx / n) * Math.PI * 2 + spin)) frontIdx = i; });
    meshes.forEach((m, i) => {
      // Carousel: a slow ring seen from the front; the front photo is full size, the others sit behind it.
      const a = (i / n) * Math.PI * 2 + spin;
      const front = (Math.cos(a) + 1) / 2; // 1 = facing you
      m.userData.front = front;
      const rx = ring.x + Math.sin(a) * ring.rx;
      const rz = (Math.cos(a) - 1) * ring.rz;
      const ry = ringY + Math.sin(clock * 0.6 + i) * 0.05;
      e0.set(0, -Math.sin(a) * 0.3, 0);
      q0.setFromEuler(e0);
      // Each photo starts settling a little after the one before it.
      const local = ease(clamp01(gridT * 1.4 - (i / n) * 0.4));
      const g = grid[i];
      tmp.set(rx, ry, rz).lerp(g.pos, local);
      tmp.y += Math.sin(local * Math.PI) * 0.5; // a small lift before it settles
      m.position.copy(tmp);
      q1.identity();
      m.quaternion.copy(q0).slerp(q1, local);
      const s = THREE.MathUtils.lerp(ring.s, g.scale, local);
      m.scale.set(s, s, 1);
      m.renderOrder = Math.round(front * 10);

      const u = m.material.uniforms;
      u.uTime.value = clock + i * 0.37;
      u.uBend.value = Math.sin(local * Math.PI) * 0.45;
      u.uCloth.value = 1 - local * 0.6;
      m.userData.ready = Math.min(1, m.userData.ready + (m.userData.loaded ? dt * 2 : 0));
      // Photos behind the front one are dimmed so the carousel reads as one picture at a time.
      u.uReady.value = m.userData.ready * THREE.MathUtils.lerp(0.16 + 0.84 * Math.pow(front, 2.5), 1, local);
      const target = hovered === m ? 1 : 0;
      m.userData.hover += (target - m.userData.hover) * Math.min(1, dt * 6);
      u.uHover.value = m.userData.hover;
      u.uLift.value = m.userData.hover;
      if (hit && hovered === m) u.uPointer.value.copy(hit.uv);

      // Its label sits just under the photo: only the front one shows in the carousel, all of them in the grid.
      m.updateMatrixWorld();
      under.set(0, -0.5, 0).applyMatrix4(m.matrixWorld).project(camera);
      const lx = (under.x + 1) / 2 * canvas.clientWidth, ly = (1 - under.y) / 2 * h;
      const lead = i === frontIdx ? clamp01((front - 0.86) / 0.12) : 0; // only the photo facing you is labeled
      const op = Math.max(local, lead * (1 - clamp01(gridT * 2)));
      const el = labels[i];
      el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
      el.style.opacity = el.classList.contains("is-focus") ? "1" : op.toFixed(3);
      el.style.pointerEvents = op > 0.6 ? "auto" : "none";
      el.classList.toggle("is-carousel", local < 0.92);
    });
    if (hint) hint.style.opacity = String(1 - clamp01(progress * 6));
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return true;
}
