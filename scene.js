/* ============================================================
   Витрина мастерской.
   Каркас — монолит: настоящий PBR-металл (Poly Haven, CC0),
   стоит на полу и не двигается.
   Витрины — стекло со скруглёнными углами, янтарной тонировкой,
   отражениями и живым покачиванием на подвесах.
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
  renderer.toneMappingExposure = 1.06;
  renderer.setClearAlpha(0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60);
  camera.position.set(0, 0, 7.6);
  camera.lookAt(0, 0, 0);

  scene.environment = await loadEnvironment(renderer);

  /* ---------- свет ---------- */

  scene.add(new THREE.AmbientLight(0x2b1e14, 0.9));

  const furnace = new THREE.PointLight(0xff8a3d, 46, 26, 2);
  furnace.position.set(5.4, 0.8, 1.8);
  scene.add(furnace);

  const key = new THREE.PointLight(0xffd0a0, 26, 18, 2);
  key.position.set(2.4, 3.6, 2.6);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x9fb4c9, 0.8);
  rim.position.set(-4.5, 2.6, 2.2);
  scene.add(rim);

  /* ---------- текстуры металла ---------- */

  const [diff, rough, nor] = await Promise.all([
    loadTex('assets/tex/rusty_diff.jpg', true),
    loadTex('assets/tex/rusty_rough.jpg', false),
    loadTex('assets/tex/rusty_nor.jpg', false)
  ]);

  function pipeMat(repeatY) {
    const d = diff.clone(); d.needsUpdate = true;
    const r = rough.clone(); r.needsUpdate = true;
    const n = nor.clone(); n.needsUpdate = true;
    [d, r, n].forEach((t) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, repeatY); });
    return new THREE.MeshStandardMaterial({
      map: d,
      roughnessMap: r,
      normalMap: n,
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: 0xb9a58c,
      metalness: 0.82,
      roughness: 0.72,
      envMapIntensity: 1.15
    });
  }

  /* ---------- монолитный каркас ---------- */

  const metal = pipeMat(5);
  const metalPlate = pipeMat(1);
  const rack = new THREE.Group();
  scene.add(rack);

  const L = -1.05;
  const R = 4.45;
  const FLOOR = -1.85;
  const TOP = 2.82;

  function tube(x1, y1, x2, y2, radius, mat, z = -0.45) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 28, 1, false), mat);
    m.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1) - Math.PI / 2;
    return m;
  }

  /* стойки и верхняя труба */
  rack.add(tube(L, FLOOR, L, TOP, 0.1, metal));
  rack.add(tube(R, FLOOR, R, TOP, 0.1, metal));
  rack.add(tube(L - 0.2, TOP - 0.02, R + 0.2, TOP - 0.02, 0.085, metal));


  /* опорные плиты с болтами */
  [L, R].forEach((x) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.09, 0.78), metalPlate);
    plate.position.set(x, FLOOR + 0.035, -0.45);
    rack.add(plate);

    for (let i = 0; i < 4; i++) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), metal);
      bolt.position.set(x + (i < 2 ? -0.2 : 0.2), FLOOR + 0.09, -0.45 + (i % 2 ? -0.2 : 0.2));
      rack.add(bolt);
    }

    /* хомут под верхней трубой */
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 22), metal);
    collar.position.set(x, TOP - 0.16, -0.45);
    rack.add(collar);
  });

  /* CC0-модель труб фоном */
  try {
    const kit = await new GLTFLoader().loadAsync('assets/model-pipes/pipes.gltf');
    const model = kit.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = 3.6 / Math.max(size.x, size.y);
    model.scale.setScalar(k);
    const box2 = new THREE.Box3().setFromObject(model);
    const c = box2.getCenter(new THREE.Vector3());
    model.position.set(2.6 - c.x, -0.1 - c.y, -2.1);
    model.rotation.y = -0.4;
    model.traverse((o) => {
      if (o.isMesh && o.material) {
        o.material.envMapIntensity = 1.0;
        if (o.material.color) o.material.color.multiplyScalar(0.72);
      }
    });
    scene.add(model);
  } catch (e) {
    console.warn('Трубная модель не загрузилась:', e);
  }

  /* ---------- витрины ---------- */

  const [texHero, texShelf, texPhone] = await Promise.all([
    loadTex('assets/lyublyu-hero.webp', true),
    loadTex('assets/lyublyu-shelf.webp', true),
    loadTex('assets/lyublyu-mobile.webp', true)
  ]);

  const streaks = streakTexture();
  const bottomGlow = gradientTexture();

  function roundedShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2;
    const y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function glassCase(tex, w, h) {
    const g = new THREE.Group();
    const shape = roundedShape(w, h, 0.07);

    /* стекло: объём с фаской */
    const glassGeo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.07,
      bevelEnabled: true,
      bevelThickness: 0.016,
      bevelSize: 0.016,
      bevelSegments: 2,
      curveSegments: 8
    });
    const glass = new THREE.Mesh(glassGeo, new THREE.MeshPhysicalMaterial({
      color: 0xffe8cf,
      metalness: 0.05,
      roughness: 0.05,
      transparent: true,
      opacity: 0.03,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.7,
      depthWrite: false
    }));
    glass.position.z = 0.02;
    g.add(glass);

    /* экран внутри стекла */
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.935, h * 0.935),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    screen.position.z = 0.008;
    g.add(screen);

    /* янтарная тонировка */
    const tint = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.935, h * 0.935),
      new THREE.MeshBasicMaterial({ color: 0xffe8c8, transparent: true, opacity: 0.18, blending: THREE.MultiplyBlending, depthWrite: false })
    );
    tint.position.z = 0.012;
    g.add(tint);

    /* вертикальные отражения комнаты */
    const reflect = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.96, h * 0.96),
      new THREE.MeshBasicMaterial({ map: streaks, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    reflect.position.z = 0.045;
    g.add(reflect);

    /* свечение у нижней кромки */
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.96, h * 0.34),
      new THREE.MeshBasicMaterial({ map: bottomGlow, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.position.set(0, -h * 0.31, 0.05);
    g.add(glow);

    /* плотность стекла у кромок */
    const vig = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.94, h * 0.94),
      new THREE.MeshBasicMaterial({ map: vignetteTexture(), transparent: true, opacity: 0.4, blending: THREE.MultiplyBlending, depthWrite: false })
    );
    vig.position.z = 0.03;
    g.add(vig);

    /* светящийся контур */
    const pts = shape.getPoints(48);
    const lineGeo = new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, p.y, 0.075)));
    const line = new THREE.LineLoop(lineGeo, new THREE.LineBasicMaterial({ color: 0xffb877, transparent: true, opacity: 0.95 }));
    g.add(line);

    return g;
  }

  const caseA = glassCase(texHero, 3.5, 2.19);
  caseA.position.set(0.95, 0.85, 0.2);
  caseA.rotation.set(-0.02, -0.24, 0.02);

  const caseB = glassCase(texShelf, 2.55, 1.91);
  caseB.position.set(1.35, -0.62, 0.55);
  caseB.rotation.set(0, -0.3, -0.015);

  const caseC = glassCase(texPhone, 0.85, 1.84);
  caseC.position.set(2.45, -0.8, 0.95);
  caseC.rotation.set(0, -0.34, 0.03);

  const cases = [caseA, caseB, caseC];
  cases.forEach((c) => scene.add(c));

  /* струбцины на верхней трубе */
  const clampMat = new THREE.MeshStandardMaterial({ map: diff, normalMap: nor, color: 0x8b7a66, metalness: 0.8, roughness: 0.7 });
  function clamp(x, z) {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.12), clampMat);
    body.position.set(x, TOP - 0.1, z);
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 8), clampMat);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(x, TOP - 0.1, z + 0.07);
    const grp = new THREE.Group();
    grp.add(body, bolt);
    return grp;
  }
  scene.add(clamp(0.95 - 1.05, 0.1), clamp(0.95 + 1.05, 0.1), clamp(2.2 + 0.3, 0.9));

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

    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;

    /* витрины живут: мягкое покачивание на подвесах и наклон за курсором */
    const bases = [
      { x: 0.95, y: 0.85, ry: -0.24, rz: 0.02, phase: 0 },
      { x: 1.35, y: -0.62, ry: -0.3, rz: -0.015, phase: 1.7 },
      { x: 2.45, y: -0.8, ry: -0.34, rz: 0.03, phase: 3.1 }
    ];
    cases.forEach((c, i) => {
      const b = bases[i];
      c.position.y = b.y - (1 - intro) * 0.35 + Math.sin(t * 0.55 + b.phase) * 0.012;
      c.position.x = b.x + Math.cos(t * 0.4 + b.phase) * 0.006;
      c.rotation.z = b.rz + Math.sin(t * 0.7 + b.phase) * 0.004;
      c.rotation.x = eased.y * 0.02;
      c.rotation.y = b.ry + eased.x * 0.05;
      c.rotation.x = eased.y * 0.02;
    });

    furnace.intensity = 44 + Math.sin(t * 1.5) * 2.6 + Math.sin(t * 4.3) * 1.1;

    renderer.render(scene, camera);
  }

  document.documentElement.classList.add('has-3d');
  frame();
}

function loadTex(url, srgb) {
  return new THREE.TextureLoader().loadAsync(url).then((t) => {
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  });
}

function vignetteTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(256, 256, 120, 256, 256, 330);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.62, 'rgba(236,222,204,1)');
  g.addColorStop(0.86, 'rgba(150,120,96,1)');
  g.addColorStop(1, 'rgba(90,70,56,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 512);
  /* отражения живут у краёв, центр остаётся чистым */
  for (let i = 0; i < 14; i++) {
    const edge = i % 2 === 0;
    const x = edge ? 8 + Math.random() * 90 : 414 + Math.random() * 90;
    const w = 8 + Math.random() * 34;
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, 'rgba(255,244,230,0)');
    g.addColorStop(0.5, 'rgba(255,244,230,' + (0.1 + Math.random() * 0.22).toFixed(3) + ')');
    g.addColorStop(1, 'rgba(255,244,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, 512);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gradientTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,190,130,0)');
  g.addColorStop(0.6, 'rgba(255,170,100,0.35)');
  g.addColorStop(1, 'rgba(255,200,150,0.9)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 256);
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
