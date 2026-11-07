/* ============================================================
   Мастерская: сравнение «было/стало» и одно выверенное движение.
   Без JavaScript страница читается: ничего не спрятано в CSS.
   GSAP — прогрессивное улучшение, при ошибке просто не включается.
   ============================================================ */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  /* ---------- Сравнение «было / стало» ---------- */

  document.querySelectorAll('.compare').forEach(function (box) {
    var range = box.querySelector('.cmp-range');
    if (!range) return;

    function paint() {
      box.style.setProperty('--split', range.value + '%');
    }

    range.addEventListener('input', paint);
    range.addEventListener('change', paint);
    paint();
  });

  /* ---------- Движение ---------- */

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  if (!window.gsap || !window.ScrollTrigger) return;

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  var panels = gsap.utils.toArray('.panel');
  var heat = gsap.utils.toArray('.panel-heat');
  var rises = gsap.utils.toArray('[data-rise]');
  var bloom = document.querySelector('.bloom');

  gsap.set(heat, { opacity: 1 });

  var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });

  /* Первое движение страницы: стекло остывает после печи.
     Сначала тёплый отсвет, затем он гаснет и проступает сама работа. */
  intro
    .from(panels, {
      y: 46,
      opacity: 0,
      duration: 1.15,
      stagger: 0.12,
    })
    .to(heat, {
      opacity: 0,
      duration: 2.1,
      ease: 'power2.inOut',
      stagger: 0.16,
    }, '-=0.85');

  rises.forEach(function (el) {
    gsap.from(el, {
      y: 20,
      opacity: 0,
      duration: 0.9,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });

  /* Панели живут на стойке: лёгкий ход по вертикали на прокрутке. */
  if (panels.length) {
    gsap.to(panels[0], {
      yPercent: -4,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }
  if (panels[1]) {
    gsap.to(panels[1], {
      yPercent: -8,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }
  if (bloom) {
    gsap.to(bloom, {
      yPercent: 6,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
    });
  }

  window.ScrollTrigger.refresh();
}());
