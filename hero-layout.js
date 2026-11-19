/**
 * Раскладка и тексты первого экрана из assets/hero-layout.json.
 * Правка — в editor.html (мышкой), значения те же.
 */
(function () {
  if (window.__HERO_EDITOR__) return;

  const URL_LAYOUT = 'assets/hero-layout.json';
  const bust = (u) => u + (u.includes('?') ? '&' : '?') + 't=' + Date.now();
  const mqDesktop = window.matchMedia('(min-width: 881px)');
  const FIXED = ['exhibit', 'stand', 'main', 'copy'];
  const PANELS = ['main'];
  const IDENTITY = [[0, 0], [1, 0], [1, 1], [0, 1]];
  let layout = null;
  let extras = [];

  const pick = (key) => document.querySelector(`[data-layer="${key}"]`);

  function homography(corners, boxW, boxH) {
    const dst = corners.map(([u, v]) => [u * boxW, v * boxH]);
    const src = [[0, 0], [boxW, 0], [boxW, boxH], [0, boxH]];
    const A = [];
    const B = [];
    src.forEach(([x, y], i) => {
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

  const t3d = (v) =>
    `perspective(1200px) rotateX(${v.rotX || 0}deg) rotateY(${v.rotY || 0}deg) rotateZ(${v.rotZ || 0}deg)`;

  // Искажение накладываем на внутренности слоя: у панели это стекло и экран,
  // у добавленной картинки — сама картинка. Внешний слой остаётся свободным
  // для поворота и размера.
  function warpTargets(node, key) {
    if (key.startsWith('x:')) {
      const img = node.querySelector('img') || node;
      return [img];
    }
    return [...node.children].filter((el) => el.tagName !== 'IMG' || el.classList.contains('exhibit-glass'));
  }

  function applyWarp(node, layer, key) {
    if (!layer || !layer.warp) return false;
    const targets = warpTargets(node, key);
    const ref = targets[0] || node;
    const matrix = homography(layer.warp, ref.offsetWidth || node.offsetWidth || 1, ref.offsetHeight || node.offsetHeight || 1);
    if (!matrix) return false;
    targets.forEach((el) => {
      el.style.transformOrigin = '0 0';
      el.style.transform = matrix;
    });
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
      if (PANELS.includes(key)) {
        [...el.children].forEach((ch) => {
          ch.style.removeProperty('transform');
          ch.style.removeProperty('transform-origin');
        });
      }
    });
  };

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
    if (cta && text.cta) {
      const arrow = '<svg class="arrow-solid " viewBox="0 0 24 24" aria-hidden="true"><path d="M22.6 1.9 2.6 10.4a1.15 1.15 0 0 0 .05 2.2l6.55 2.35 -1.9 6.55a1.15 1.15 0 0 0 2.1.95L22.6 1.9Z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>';
      cta.innerHTML = `${text.cta} ${arrow}`;
    }
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
      el.style.transformOrigin = '';
      el.style.transform = t3d(val);
      applyWarp(el, val, key);
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
      const wrap = document.createElement('div');
      wrap.dataset.extra = layer.id;
      Object.assign(wrap.style, {
        position: 'absolute',
        left: (layer.left ?? 0) + '%',
        top: (layer.top ?? 0) + '%',
        width: (layer.width ?? 30) + '%',
        borderRadius: (layer.radius ?? 10) + 'px',
        opacity: layer.opacity ?? 1,
        zIndex: String(layer.z ?? 5),
        pointerEvents: 'none',
        transform: t3d(layer)
      });
      const img = document.createElement('img');
      img.src = layer.src;
      img.alt = layer.alt || '';
      img.loading = 'lazy';
      img.decoding = 'async';
      Object.assign(img.style, { display: 'block', width: '100%', height: 'auto', borderRadius: 'inherit' });
      wrap.appendChild(img);
      host.appendChild(wrap);
      extras.push(wrap);
      applyWarp(wrap, layer, 'x:' + layer.id);
    });
  };

  fetch(bust(URL_LAYOUT), { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      layout = data;
      apply();
      const retry = () => apply();
      extras.forEach((node) => {
        const img = node.querySelector('img');
        if (img && !img.complete) img.addEventListener('load', retry, { once: true });
      });
    })
    .catch(() => {});

  mqDesktop.addEventListener('change', apply);
})();
