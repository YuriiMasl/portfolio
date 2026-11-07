/* ============================================================
   Сцена мастерской на WebGL: железная стойка, стеклянные витрины
   с экранами кейса, тёплый свет печи.
   Грузится лениво; без WebGL остаётся обычная вёрстка.
   ============================================================ */
import * as THREE from './vendor/three.module.min.js';

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
  const renderer = new THREE.WebGLRenderer({ canvas: CANVAS, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0908);
  scene.fog = new THREE.FogExp2(0x0a0908, 0.02);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0.4, 1.6, 6.6);
  const target = new THREE.Vector3(1.95, 1.5, 0);
  camera.lookAt(target);

  scene.environment = makeEnvironment(renderer);

  /* ---------- свет ---------- */

  scene.add(new THREE.AmbientLight(0x2a1d14, 1.2));

  const furnaceLight = new THREE.PointLight(0xff8a3d, 34, 18, 2);
  furnaceLight.position.set(3.4, 1.7, -0.6);
  scene.add(furnaceLight);

  const emberLight = new THREE.PointLight(0xff4d12, 12, 10, 2);
  emberLight.position.set(1.8, 0.2, 1.4);
  scene.add(emberLight);

  const rim = new THREE.DirectionalLight(0xa9bccd, 0.7);
  rim.position.set(-3.5, 3.4, 2);
  scene.add(rim);

  /* ---------- тёплое зарево печи ---------- */

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture(),
    color: 0xff8a3e,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  }));
  glow.scale.set(7, 6, 1);
  glow.position.set(3.2, 1.0, -2.6);
  scene.add(glow);

  /* ---------- пол ---------- */

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 18),
    new THREE.MeshStandardMaterial({ color: 0x15100c, roughness: 0.38, metalness: 0.62 })
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* ---------- стойка ---------- */

  const iron = new THREE.MeshStandardMaterial({ color: 0x6d5439, roughness: 0.5, metalness: 0.94 });
  const ironDark = new THREE.MeshStandardMaterial({ color: 0x382c21, roughness: 0.62, metalness: 0.88 });
  const rack = new THREE.Group();
  scene.add(rack);

  function bar(x1, y1, x2, y2, z, radius, material) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 16), material);
    mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
    mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    return mesh;
  }

  const L = 1.32;
  const R = 5.35;
  rack.add(bar(L, 0, L, 3.05, -0.02, 0.05, iron));
  rack.add(bar(R, 0, R, 3.05, -0.02, 0.05, iron));
  rack.add(bar(L - 0.12, 3.06, R + 0.12, 3.06, -0.02, 0.045, iron));
  rack.add(bar(L - 0.12, 2.72, R + 0.12, 2.72, -0.02, 0.03, ironDark));
  rack.add(bar(L - 0.18, 0.06, R + 0.18, 0.06, -0.02, 0.055, iron));

  [L, R].forEach((x) => {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.1, 16), ironDark);
    foot.position.set(x, 0.06, -0.02);
    rack.add(foot);
  });

  /* подсветка верхней перекладины, чтобы железо не читалось чёрными пятнами */
  const rackLight = new THREE.PointLight(0xffb070, 6, 6, 2);
  rackLight.position.set(1.9, 2.9, 1.2);
  scene.add(rackLight);

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

  function glassCase(tex, w, h) {
    const group = new THREE.Group();

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.94, h * 0.94),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff })
    );
    screen.position.z = -0.02;
    group.add(screen);

    /* Стекло поверх экрана: даёт блики и глубину, но не размывает работу. */
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.03),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.1,
        roughness: 0.05,
        transparent: true,
        opacity: 0.12,
        ior: 1.45,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        envMapIntensity: 1.6,
        depthWrite: false
      })
    );
    group.add(glass);

    /* толща стекла по краю: подсвеченная грань */
    const rimGeo = new THREE.BoxGeometry(w, h, 0.05);
    const rimMesh = new THREE.Mesh(rimGeo, new THREE.MeshPhysicalMaterial({
      color: 0xffc08a,
      metalness: 0.45,
      roughness: 0.22,
      transparent: true,
      opacity: 0.1,
      envMapIntensity: 1.2,
      depthWrite: false
    }));
    rimMesh.position.z = 0.012;
    group.add(rimMesh);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.055)),
      new THREE.LineBasicMaterial({ color: 0xffd2a6, transparent: true, opacity: 0.9 })
    );
    group.add(edge);

    return group;
  }

  const caseA = glassCase(texHero, 2.45, 1.53);
  const caseB = glassCase(texShelf, 1.72, 1.29);
  const caseC = glassCase(texPhone, 0.62, 1.34);

  caseA.position.set(2.95, 2.18, 0);
  caseA.rotation.set(-0.03, -0.1, 0.03);

  caseB.position.set(3.78, 1.28, 0.42);
  caseB.rotation.set(0.02, -0.17, -0.04);

  caseC.position.set(4.55, 1.02, 0.78);
  caseC.rotation.set(0.02, -0.24, 0.06);

  const cases = [caseA, caseB, caseC];
  cases.forEach((c) => scene.add(c));

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
    intro = Math.min(1, intro + 0.01);

    eased.x += (pointer.x - eased.x) * 0.045;
    eased.y += (pointer.y - eased.y) * 0.045;

    camera.position.x = 0.4 - eased.x * 0.22;
    camera.position.y = 1.52 - eased.y * 0.12 + Math.sin(t * 0.32) * 0.015;
    camera.lookAt(target);

    const bases = [
      { y: 2.05, ry: -0.1 },
      { y: 1.28, ry: -0.17 },
      { y: 1.02, ry: -0.24 }
    ];
    cases.forEach((c, i) => {
      c.position.y = bases[i].y - (1 - intro) * 0.4 + Math.sin(t * 0.42 + i * 1.5) * 0.02;
      c.rotation.y = bases[i].ry + eased.x * 0.06;
      c.rotation.z = [-0.03, 0.04, -0.06][i] * (0.4 + intro * 0.6);
    });

    furnaceLight.intensity = 32 + Math.sin(t * 1.6) * 2 + Math.sin(t * 4.1) * 0.9;
    emberLight.intensity = 11 + Math.sin(t * 2.2 + 1) * 0.9;

    renderer.render(scene, camera);
  }

  document.documentElement.classList.add('has-3d');
  frame();
}

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,210,160,0.95)');
  g.addColorStop(0.25, 'rgba(255,140,70,0.55)');
  g.addColorStop(0.55, 'rgba(200,70,20,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeEnvironment(renderer) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 128);
  g.addColorStop(0, '#080706');
  g.addColorStop(0.45, '#20170f');
  g.addColorStop(0.72, '#6b3d1e');
  g.addColorStop(0.88, '#ffa860');
  g.addColorStop(1, '#2a1a10');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromEquirectangular(tex).texture;
  pmrem.dispose();
  tex.dispose();
  return env;
}
