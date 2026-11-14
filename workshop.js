/* Native scrolling. Artwork stays attached to the frame; no floating layers.
   The comparison works without animation libraries and with reduced motion. */
(function () {
  'use strict';
  document.querySelectorAll('.compare').forEach(function (box) {
    var range = box.querySelector('.cmp-range');
    if (!range) return;
    function paint() { box.style.setProperty('--split', range.value + '%'); }
    range.addEventListener('input', paint);
    range.addEventListener('change', paint);
    paint();
  });

  var bar = document.querySelector('.scroll-progress span');
  var scheduled = false;
  function updateProgress() {
    var total = document.documentElement.scrollHeight - window.innerHeight;
    if (bar) bar.style.width = (total > 0 ? window.scrollY / total * 100 : 0) + '%';
    scheduled = false;
  }
  window.addEventListener('scroll', function () {
    if (!scheduled) { scheduled = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  window.addEventListener('resize', updateProgress);
  updateProgress();

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.gsap || !window.ScrollTrigger) return;
  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);
  // Hero text and mounted glass are immediately readable, without a fade.
  gsap.utils.toArray('.fade').forEach(function (element) {
    gsap.from(element, {
      y: 18, opacity: 0, duration: .6, ease: 'power2.out', clearProps: 'all',
      scrollTrigger: { trigger: element, start: 'top 95%', once: true }
    });
  });
}());
