/**
 * Раскладка и тексты первого экрана из assets/hero-layout.json.
 * Правка — в editor.html (мышкой), значения те же.
 */
(function () {
  if (window.__HERO_EDITOR__) return;

  const URL_LAYOUT = 'assets/hero-layout.json';
  const mqDesktop = window.matchMedia('(min-width: 881px)');
  const FIXED = ['exhibit', 'stand', 'main', 'copy'];
  const PANELS = ['main'];
  const IDENTITY = [[0, 0], [1, 0], [1, 1], [0, 1]];
  let layout = null;
  let extras = [];

  const pick = (key) => document.querySelector(`[data-layer="${key}"]`);

  function homography(corners, boxW, boxH) {
    const dst = corners.map(([u, v]) => [u * boxW, v * boxH]);
    const A = [];
    const B = [];
    IDENTITY.forEach(([x, y], i) => {
      const [X, Y] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -x * X, -y * X]); B.push(X);
      A.push([0, 0, 0, x, y, 1, -x * Y, -y * Y]); B.push(Y);
    });
    for (let col = 0; col < 8; col++) {
      let piv = col;
      for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r;
      if (Math.abs(A[piv][col]) < 1e-9) return null;
      [A[col], A[piv]] = [A[piv], A[col]];
      [B[col], B[piv]] = [B[piv], B[col]];
      const d = A[col][col];
      for (let c = col; c < 8; c++) A[col][c] /= d;
      B[col] /= d;
      for (let r = 0; r < 8; r++) {
        if (r === col) continue;
        const f = A[r][col];
        if (!f) continue;
        for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c];
        B[r] -= f * B[col];
      }
    }
    const [a, b, c, d, e, f, g, hh] = B;
    return `matrix3d(${a},${d},0,${g},${b},${e},0,${hh},0,0,1,0,${c},${f},0,1)`;
  }

  function applyWarp(node, layer) {
    if (!layer || !layer.warp) return false;
    const m = homography(layer.warp, node.offsetWidth || 1, node.offsetHeight || 1);
    if (!m) return false;
    node.style.transformOrigin = '0 0';
    node.style.transform = m;
    return true;
  }

  const clearAll = () => {
    extras.forEach((node) => node.remove());
    extras = [];
    FIXED.forEach((key) => {
      const el = pick(key);
      if (!el) return;
      ['width', 'right', 'bottom', 'left', 'top', 'transform', 'transform-origin', 'filter', 'z-index', 'opacity']
        .forEach((prop) => el.style.removeProperty(prop));
    });
  };

  const t3d = (v) =>
    `perspective(1200px) rotateX(${v.rotX || 0}deg) rotateY(${v.rotY || 0}deg) rotateZ(${v.rotZ || 0}deg)`;

  function applyText(text) {
    if (!text) return;
    const intro = document.querySelector('[data-text="intro"]');
    if (intro && typeof text.intro === 'string') intro.innerHTML = text.intro.replace(/\n/g, '<br>');
    const title = document.querySelector('[data-text="title"]');
    if (title && Array.isArray(text.title)) {
      title.innerHTML = text.title
        .map((line) => `<span class="line"><span class="line-in">${line}</span></span>`)
        .join('');
    }
    const cta = document.querySelector('[data-text="cta"]');
    if (cta && text.cta) cta.innerHTML = `${text.cta} <span aria-hidden="true">→</span>`;
    const facts = document.querySelector('[data-text="facts"]');
    if (facts && typeof text.facts === 'string') facts.innerHTML = text.facts.replace(/\n/g, '<br>');
  }

  const apply = () => {
    if (!layout || !mqDesktop.matches) {
      clearAll();
      return;
    }
    applyText(layout.text);

    const ex = layout.exhibit || {};
    const exhibit = pick('exhibit');
    if (exhibit) {
      if (ex.width != null) exhibit.style.width = ex.width + '%';
      if (ex.right != null) exhibit.style.right = ex.right + '%';
      if (ex.bottom != null) exhibit.style.bottom = ex.bottom + '%';
      exhibit.style.transform = ex.rotZ ? `rotate(${ex.rotZ}deg)` : '';
    }

    const st = layout.stand || {};
    const stand = pick('stand');
    if (stand && (st.scale || st.dx || st.dy || st.brightness != null)) {
      stand.style.transform = `translate(${st.dx || 0}%, ${st.dy || 0}%) scale(${st.scale ?? 1})`;
      if (st.brightness != null) {
        stand.style.filter = `brightness(${st.brightness}) drop-shadow(8px 18px 16px rgba(0,0,0,.55))`;
      }
    }

    PANELS.forEach((key) => {
      const el = pick(key);
      const val = layout[key];
      if (!el || !val) return;
      if (val.left != null) el.style.left = val.left + '%';
      if (val.top != null) el.style.top = val.top + '%';
      if (val.width != null) el.style.width = val.width + '%';
      if (val.z != null) el.style.zIndex = String(val.z);
      if (!applyWarp(el, val)) {
        el.style.transformOrigin = '';
        el.style.transform = t3d(val);
      }
    });

    const cp = layout.copy || {};
    const copy = pick('copy');
    if (copy) {
      if (cp.left != null) copy.style.left = cp.left + '%';
      if (cp.top != null) copy.style.top = cp.top + '%';
      if (cp.width != null) copy.style.width = cp.width + '%';
    }

    extras.forEach((node) => node.remove());
    extras = [];
    const host = pick('exhibit');
    (layout.extra || []).forEach((layer) => {
      if (!host) return;
      const img = document.createElement('img');
      img.src = layer.src;
      img.alt = layer.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.dataset.extra = layer.id;
      Object.assign(img.style, {
        position: 'absolute',
        left: (layer.left ?? 0) + '%',
        top: (layer.top ?? 0) + '%',
        width: (layer.width ?? 30) + '%',
        borderRadius: (layer.radius ?? 10) + 'px',
        opacity: layer.opacity ?? 1,
        zIndex: String(layer.z ?? 5),
        pointerEvents: 'none'
      });
      host.appendChild(img);
      extras.push(img);
      if (!applyWarp(img, layer)) img.style.transform = t3d(layer);
    });
  };

  fetch(URL_LAYOUT, { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      layout = data;
      apply();
    })
    .catch(() => {});

  mqDesktop.addEventListener('change', apply);
})();
