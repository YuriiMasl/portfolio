/**
 * Раскладка первого экрана из assets/hero-layout.json.
 * Правка — в editor.html (мышкой), значения те же.
 */
(function () {
  if (window.__HERO_EDITOR__) return;

  const URL_LAYOUT = 'assets/hero-layout.json';
  const mqDesktop = window.matchMedia('(min-width: 881px)');
  const FIXED = ['exhibit', 'stand', 'main', 'catalog', 'phone', 'copy'];
  const PANELS = ['main', 'catalog', 'phone'];
  let layout = null;
  let extras = [];

  const pick = (key) => document.querySelector(`[data-layer="${key}"]`);

  const clearAll = () => {
    extras.forEach((node) => node.remove());
    extras = [];
    FIXED.forEach((key) => {
      const el = pick(key);
      if (!el) return;
      ['width', 'right', 'bottom', 'left', 'top', 'transform', 'filter', 'z-index', 'opacity'].forEach((prop) => {
        el.style.removeProperty(prop);
      });
    });
  };

  const transform3d = (v) =>
    `perspective(1200px) rotateX(${v.rotX || 0}deg) rotateY(${v.rotY || 0}deg) rotateZ(${v.rotZ || 0}deg)`;

  const apply = () => {
    if (!layout || !mqDesktop.matches) {
      clearAll();
      return;
    }
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
      el.style.transform = transform3d(val);
      if (val.z != null) el.style.zIndex = String(val.z);
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
        transform: transform3d(layer),
        zIndex: String(layer.z ?? 5),
        pointerEvents: 'none'
      });
      host.appendChild(img);
      extras.push(img);
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
