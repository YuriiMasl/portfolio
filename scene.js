/* ============================================================
   Гибрид: комната — сгенерированная фотография (CSS-фон),
   поверх — 3D: трубная стойка, настоящая CC0-модель трубы
   (Poly Haven), три стеклянные витрины с экранами кейса,
   тёплое зарево и отражения от HDRI.
   Без WebGL остаётся обычная вёрстка.
   ============================================================ */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/three-addons/loaders/GLTFLoader.js';

const HERO = document.querySelector('.hero');
const CANVAS = document.getElementById('stage-canvas');

if (HERO && CANVAS && window.innerWidth >= 900 &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
    CANVAS.getContext('webgl2')) {
  start().catch((err) => {
    console.warn('3D-сцена не запустилась:', err);
    document.documentElement.classList.remove('has-3d');
  });
}

async function start() {
  const renderer = new THREE.WebGLRenderer({ canvas: CANVAS, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 7.4);
  camera.lookAt(0, 0, 0);

  scene.environment = await loadEnvironment(renderer);

  /* ---------- свет: печь справа, холодный контровой слева ---------- */

  scene.add(new THREE.AmbientLight(0x2b1e14, 1.0));

  const furnace = new THREE.PointLight(0xff8a3d, 55, 26, 2);
  furnace.position.set(5.2, 0.9, 1.6);
  scene.add(furnace);

  const topLight = new THREE.PointLight(0xffd0a0, 22, 16, 2);
  topLight.position.set(2.2, 4.2, 2.2);
  scene.add(topLight);

  const rim = new THREE.DirectionalLight(0x9fb4c9, 0.65);
  rim.position.set(-4, 3.4, 2.4);
  scene.add(rim);

  /* ---------- стойка из труб ---------- */

  const ironMat = new THREE.MeshStandardMaterial({ color: 0x6b5236, metalness: 0.95, roughness: 0.42 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x33291f, metalness: 0.9, roughness: 0.55 });

  const rack = new THREE.Group();
  scene.add(rack);

  function pipe(x1, y1, x2, y2, r, mat, z = -0.4) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    return m;
  }

  function joint(x, y, r, mat, z = -0.4) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat);
    m.position.set(x, y, z);
    return m;
  }

  function flange(x, y, r, mat, z = -0.4) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.055, 22), mat);
    m.position.set(x, y, z);
    m.rotation.z = Math.PI / 2;
    return m;
  }

  const L = -0.85;
  const R = 4.55;
  const FLOOR = -1.72;
  const TOP = 2.78;

  rack.add(pipe(L, FLOOR, L, TOP, 0.055, ironMat));
  rack.add(pipe(R, FLOOR, R, TOP, 0.055, ironMat));
  rack.add(pipe(L - 0.14, TOP - 0.06, R + 0.14, TOP - 0.06, 0.05, ironMat));
  rack.add(pipe(L - 0.14, 2.34, R + 0.14, 2.34, 0.03, darkMat));
  rack.add(pipe(L - 0.2, FLOOR + 0.04, R + 0.2, FLOOR + 0.04, 0.06, ironMat));

  [L, R].forEach((x) => {
    [TOP - 0.06, 2.34].forEach((y) => {
      rack.add(joint(x, y, 0.085, darkMat));
      rack.add(flange(x, y - 0.12, 0.1, ironMat));
    });
    [FLOOR + 0.04].forEach((y) => {
      rack.add(joint(x, y, 0.09, darkMat));
      rack.add(flange(x, y + 0.1, 0.11, ironMat));
    });
    for (let i = 1; i < 4; i++) {
      rack.add(flange(x, FLOOR + i * 1.1, 0.1, darkMat));
    }
  });

  /* вентиль на правой стойке */
  const valve = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20), ironMat);
  valve.position.set(R, 1.55, -0.34);
  rack.add(valve);
  rack.add(pipe(R - 0.16, 1.55, R + 0.16, 1.55, 0.012, ironMat, -0.34));

  /* ---------- реальная CC0-модель труб как фон сцены ---------- */

  try {
    const kit = await new GLTFLoader().loadAsync('assets/model-pipes/pipes.gltf');
    const model = kit.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = 3.2 / Math.max(size.x, size.y);
    model.scale.setScalar(k);
    const box2 = new THREE.Box3().setFromObject(model);
    const c = box2.getCenter(new THREE.Vector3());
    model.position.set(2.4 - c.x, -0.2 - c.y, -1.9);
    model.rotation.y = -0.35;
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.envMapIntensity = 1.1;
        if (o.material.color) o.material.color.multiplyScalar(0.7);
      }
    });
    scene.add(model);
  } catch (e) {
    console.warn('Трубная модель не загрузилась:', e);
  }

  /* ---------- витрины ---------- */

  const loader = new THREE.TextureLoader();
  async function texture(url) {
    const tex = await loader.loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  const [texHero, texShelf, texPhone] = await Promise.all([
    texture('assets/lyublyu-hero.webp'),
    texture('assets/lyublyu-shelf.webp'),
    texture('assets/lyublyu-mobile.webp')
  ]);

  const glowTex = radialTexture();

  function glassCase(tex, w, h) {
    const group = new THREE.Group();

    /* ореол вокруг плиты — свет проходит сквозь стекло */
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xff8f4a,
      transparent: true,
      opacity: 0.26,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    halo.scale.set(w * 1.35, h * 1.5, 1);
    halo.position.z = -0.05;
    group.add(halo);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.955, h * 0.955),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, toneMapped: false })
    );
    screen.position.z = 0.012;
    group.add(screen);

    /* толща стекла: передняя пластина и подсвеченная кромка */
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.075),
      new THREE.MeshPhysicalMaterial({
        color: 0xfff1e0,
        metalness: 0.1,
        roughness: 0.03,
        transparent: true,
        opacity: 0.07,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.7,
        depthWrite: false
      })
    );
    glass.position.z = 0.075;
    group.add(glass);

    /* диагональный блик по стеклу */
    const sheen = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({
        map: sheenTexture(),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    sheen.position.z = 0.1;
    group.add(sheen);

    /* светящаяся кромка: четыре бруска по периметру */
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xffa96a, toneMapped: false });
    const t = 0.006;
    const edges = [
      [w, t, 0, h / 2],
      [w, t, 0, -h / 2],
      [t, h, -w / 2, 0],
      [t, h, w / 2, 0]
    ];
    edges.forEach(([ew, eh, ex, ey]) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(ew, eh, 0.085), edgeMat);
      e.position.set(ex, ey, 0.04);
      group.add(e);
    });

    return group;
  }

  const caseA = glassCase(texHero, 3.55, 2.22);
  caseA.position.set(1.0, 0.85, 0.15);
  caseA.rotation.set(0, -0.24, 0.03);

  const caseB = glassCase(texShelf, 2.6, 1.95);
  caseB.position.set(1.28, -0.62, 0.55);
  caseB.rotation.set(0, -0.28, -0.03);

  const caseC = glassCase(texPhone, 0.86, 1.86);
  caseC.position.set(2.25, -0.78, 0.95);
  caseC.rotation.set(0, -0.32, 0.05);

  const cases = [caseA, caseB, caseC];
  cases.forEach((c) => scene.add(c));

  /* подвесы: зажим на верхней трубе и трос к плите */
  function hang(x, yTop, yBottom, z) {
    const g = new THREE.Group();
    const clampMesh = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.09), darkMat);
    clampMesh.position.set(x, yTop - 0.05, -0.36);
    g.add(clampMesh);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, Math.max(0.05, yTop - yBottom), 6), darkMat);
    wire.position.set(x, (yTop + yBottom) / 2, z);
    g.add(wire);
    return g;
  }
  scene.add(hang(1.15 - 4.65 * 0.3, TOP - 0.06, 2.5, 0.15));
  scene.add(hang(1.15 + 4.65 * 0.3, TOP - 0.06, 2.5, 0.15));
  scene.add(hang(1.62 + 1.0, TOP - 0.06, 0.85, 0.55));
  scene.add(hang(3.05 + 0.4, TOP - 0.06, 0.25, 0.9));

  /* мягкая тень на полу под плитами */
  const shadow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex,
    color: 0x000000,
    transparent: true,
    opacity: 0.32,
    depthWrite: false
  }));
  shadow.scale.set(6, 1.3, 1);
  shadow.position.set(2.2, -2.75, 0.6);
  scene.add(shadow);

  /* ---------- кадр ---------- */

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let intro = 0;

  function resize() {
    const w = HERO.clientWidth;
    const h = HERO.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  HERO.addEventListener('pointermove', (e) => {
    const r = HERO.getBoundingClientRect();
    pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
  });
  HERO.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; });

  let visible = true;
  new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; }, { threshold: 0.01 }).observe(HERO);

  const clock = new THREE.Clock();

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    intro = Math.min(1, intro + 0.008);

    eased.x += (pointer.x - eased.x) * 0.045;
    eased.y += (pointer.y - eased.y) * 0.045;

    camera.position.x = -eased.x * 0.2;
    camera.position.y = -eased.y * 0.12 + Math.sin(t * 0.3) * 0.01;
    camera.lookAt(0, 0, 0);

    const bases = [
      { y: 1.02, ry: -0.16 },
      { y: -0.55, ry: -0.2 },
      { y: -1.05, ry: -0.26 }
    ];
    cases.forEach((c, i) => {
      c.position.y = bases[i].y - (1 - intro) * 0.55 + Math.sin(t * 0.4 + i * 1.4) * 0.018;
      c.rotation.y = bases[i].ry + eased.x * 0.05;
    });

    furnace.intensity = 52 + Math.sin(t * 1.5) * 3 + Math.sin(t * 4.2) * 1.2;

    renderer.render(scene, camera);
  }

  document.documentElement.classList.add('has-3d');
  frame();
}

function sheenTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 256, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.34, 'rgba(255,240,220,0.04)');
  g.addColorStop(0.46, 'rgba(255,248,235,0.30)');
  g.addColorStop(0.54, 'rgba(255,248,235,0.10)');
  g.addColorStop(0.72, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function radialTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

async function loadEnvironment(renderer) {
  const tex = await new THREE.TextureLoader().loadAsync('assets/env-workshop.jpg');
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
