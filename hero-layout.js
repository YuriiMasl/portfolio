/**
 * Раскладка первого экрана из assets/hero-layout.json.
 * Правка — в editor.html (мышкой), значения те же.
 */
(function () {
  if (window.__HERO_EDITOR__) return;

  const URL_LAYOUT = 'assets/hero-layout.json';
  const mqDesktop = window.matchMedia('(min-width: 881px)');
  const KEYS = ['exhibit', 'stand', 'main', 'catalog', 'phone', 'copy'];
  let layout = null;

  const pick = () => {
    const out = {};
    KEYS.forEach((key) => {
      out[key] = document.querySelector(`[data-layer="${key}"]`);
    });
    return out;
  };

  const clear = (els) => {
    Object.values(els).forEach((el) => {
      if (!el) return;
      ['width', 'right', 'bottom', 'left', 'top', 'transform', 'filter'].forEach((prop) => {
        el.style.removeProperty(prop);
      });
    });
  };

  const apply = () => {
    const els = pick();
    if (!layout || !mqDesktop.matches) {
      clear(els);
      return;
    }
    const ex = layout.exhibit || {};
    if (els.exhibit) {
      if (ex.width != null) els.exhibit.style.width = ex.width + '%';
      if (ex.right != null) els.exhibit.style.right = ex.right + '%';
      if (ex.bottom != null) els.exhibit.style.bottom = ex.bottom + '%';
      if (ex.rot) els.exhibit.style.transform = `rotate(${ex.rot}deg)`;
    }
    const st = layout.stand || {};
    if (els.stand && (st.scale || st.dx || st.dy || st.brightness)) {
      const scale = st.scale ?? 1;
      els.stand.style.transform = `translate(${st.dx || 0}%, ${st.dy || 0}%) scale(${scale})`;
      if (st.brightness != null) els.stand.style.filter = `brightness(${st.brightness}) drop-shadow(8px 18px 16px rgba(0,0,0,.55))`;
    }
    ['main', 'catalog', 'phone'].forEach((key) => {
      const el = els[key];
      const val = layout[key];
      if (!el || !val) return;
      if (val.left != null) el.style.left = val.left + '%';
      if (val.top != null) el.style.top = val.top + '%';
      if (val.width != null) el.style.width = val.width + '%';
      el.style.transform = `perspective(1200px) rotateY(${val.rotY || 0}deg) rotateZ(${val.rotZ || 0}deg)`;
    });
    const cp = layout.copy || {};
    if (els.copy) {
      if (cp.left != null) els.copy.style.left = cp.left + '%';
      if (cp.top != null) els.copy.style.top = cp.top + '%';
      if (cp.width != null) els.copy.style.width = cp.width + '%';
    }
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
