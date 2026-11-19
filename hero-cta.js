/**
 * Стеклянная кнопка на первом экране: блик и наклон идут за курсором.
 * Без JS кнопка просто стоит ровно — стили работают сами.
 */
(function () {
  const btn = document.querySelector('.hero .glass-cta');
  if (!btn || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  let raf = 0;
  const set = (x, y) => {
    btn.style.setProperty('--mx', x + '%');
    btn.style.setProperty('--my', y + '%');
    btn.style.setProperty('--ry', ((x - 50) / 30).toFixed(2) + 'deg');
    btn.style.setProperty('--rx', ((50 - y) / 40).toFixed(2) + 'deg');
  };

  const onMove = (e) => {
    const r = btn.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100));
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => set(x, y));
  };

  const reset = () => {
    btn.style.setProperty('--mx', '18%');
    btn.style.setProperty('--my', '0%');
    btn.style.setProperty('--ry', '0deg');
    btn.style.setProperty('--rx', '0deg');
  };

  btn.addEventListener('pointermove', onMove);
  btn.addEventListener('pointerleave', reset);
  btn.addEventListener('blur', reset);
})();
