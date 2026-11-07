/* ============================================================
   Гибрид: комната — сгенерированная фотография (CSS-фон),
   поверх неё — настоящая 3D-геометрия: стойка Poly Haven (CC0)
   и стеклянные витрины с экранами кейса.
   Окружение для отражений — HDRI Poly Haven (CC0).
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
  renderer.toneMappingExposure = 1.05;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 60);
  camera.position.set(0.4, 1.6, 6.6);
  const target = new THREE.Vector3(1.95, 1.5, 0);
  camera.lookAt(target);

  scene.environment = await loadEnvironment(renderer);

  /* ---------- свет, повторяющий печь на фотографии ---------- */

  scene.add(new THREE.AmbientLight(0x2a1d14, 0.9));

  const furnaceLight = new THREE.PointLight(0xff8a3d, 40, 20, 2);
  furnaceLight.position.set(4.2, 1.6, 0.2);
  scene.add(furnaceLight);

  const fill = new THREE.DirectionalLight(0xffd9b0, 0.35);
  fill.position.set(2.4, 2.6, 3.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xa8bccd, 0.5);
  rim.position.set(-3, 3.4, 2);
  scene.add(rim);

  /* ---------- настоящая стойка из CC0-модели ---------- */

  try {
    const rack = await loadRack();
    scene.add(rack);
  } catch (e) {
    console.warn('Модель стойки не загрузилась:', e);
  }

  /* ---------- витрины со скриншотами ---------- */

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

    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, 0.03),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        metalness: 0.2,
        roughness: 0.04,
        transparent: true,
        opacity: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
        envMapIntensity: 1.3,
        depthWrite: false
      })
    );
    group.add(glass);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, 0.05)),
      new THREE.LineBasicMaterial({ color: 0xffc894, transparent: true, opacity: 0.85 })
    );
    group.add(edge);

    return group;
  }

  const caseA = glassCase(texHero, 2.45, 1.53);
  const caseB = glassCase(texShelf, 1.72, 1.29);
  const caseC = glassCase(texPhone, 0.62, 1.34);

  caseA.position.set(2.95, 2.18, 0.15);
  caseA.rotation.set(-0.03, -0.1, 0.03);

  caseB.position.set(3.78, 1.28, 0.5);
  caseB.rotation.set(0.02, -0.17, -0.04);

  caseC.position.set(4.35, 1.04, 0.82);
  caseC.rotation.set(0.02, -0.24, 0.06);

  const cases = [caseA, caseB, caseC];
  cases.forEach((c) => scene.add(c));

  /* Перекладина и зажимы: витрины должны висеть, а не парить. */
  const barMat = new THREE.MeshStandardMaterial({ color: 0x5a4630, metalness: 0.95, roughness: 0.45 });
  const crossbar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.6, 16), barMat);
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(3.15, 3.02, 0.02);
  scene.add(crossbar);

  function clamp(x, y, z) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.11, 0.075), barMat);
    c.position.set(x, y, z);
    return c;
  }
  [caseA, caseB, caseC].forEach((c) => {
    const w = c === caseA ? 2.45 : c === caseB ? 1.72 : 0.62;
    const h = c === caseA ? 1.53 : c === caseB ? 1.29 : 1.34;
    [-0.34, 0.34].forEach((k) => {
      const x = c.position.x + k * w;
      const y = c.position.y + h / 2;
      scene.add(clamp(x, 3.0, c.position.z));
      const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, Math.max(0.05, 3.02 - y), 8), barMat);
      wire.position.set(x, (3.02 + y) / 2, c.position.z);
      scene.add(wire);
    });
  });

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
    camera.position.y = 1.6 - eased.y * 0.12 + Math.sin(t * 0.32) * 0.012;
    camera.lookAt(target);

    const bases = [
      { y: 2.18, ry: -0.1 },
      { y: 1.28, ry: -0.17 },
      { y: 1.02, ry: -0.24 }
    ];
    cases.forEach((c, i) => {
      c.position.y = bases[i].y - (1 - intro) * 0.4 + Math.sin(t * 0.42 + i * 1.5) * 0.02;
      c.rotation.y = bases[i].ry + eased.x * 0.06;
    });

    furnaceLight.intensity = 38 + Math.sin(t * 1.6) * 2.5 + Math.sin(t * 4.1) * 1.1;

    renderer.render(scene, camera);
  }

  document.documentElement.classList.add('has-3d');
  frame();
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

async function loadRack() {
  const gltf = await new GLTFLoader().loadAsync('assets/model/steel_frame_shelves_01.gltf');
  const model = gltf.scene;

  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const targetHeight = 4.1;
  const k = targetHeight / size.y;
  model.scale.setScalar(k);

  const box2 = new THREE.Box3().setFromObject(model);
  const centre = box2.getCenter(new THREE.Vector3());
  model.position.x += 3.35 - centre.x;
  model.position.z += -0.62 - centre.z;
  model.position.y += -box2.min.y;

  model.traverse((o) => {
    if (o.isMesh) {
      o.material.envMapIntensity = 1.4;
      if (o.material.color) o.material.color.multiplyScalar(0.85);
    }
  });

  return model;
}
