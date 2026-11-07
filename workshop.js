/* ============================================================
   Мастерская: жидкое движение.
   - сравнение «было / стало» работает всегда;
   - плавный скролл и анимации — только если есть GSAP и не reduce;
   - без JS страница видна целиком: в CSS ничего не спрятано.
   ============================================================ */
(function () {
  'use strict';

  var doc = document.documentElement;
  doc.classList.add('js');

  /* ---------- Сравнение «было / стало» ---------- */

  Array.prototype.forEach.call(document.querySelectorAll('.compare'), function (box) {
    var range = box.querySelector('.cmp-range');
    if (!range) return;
    var paint = function () { box.style.setProperty('--split', range.value + '%'); };
    range.addEventListener('input', paint);
    range.addEventListener('change', paint);
    paint();
  });

  /* ---------- Дальше только движение ---------- */

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  if (!window.gsap || !window.ScrollTrigger) return;

  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  /* Плавный скролл: на тач-устройствах оставляем нативную инерцию. */
  var lenis = null;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (window.Lenis && finePointer) {
    lenis = new window.Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 1, touchMultiplier: 1.4 });
    lenis.on('scroll', window.ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;
        var target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -96, duration: 1.2 });
      });
    });
  }

  /* ---------- Полоса прогресса ---------- */

  var bar = document.querySelector('.scroll-progress span');
  if (bar) {
    window.ScrollTrigger.create({
      trigger: document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: function (self) { bar.style.width = (self.progress * 100).toFixed(2) + '%'; }
    });
  }

  /* ---------- Первый экран: стекло остывает ---------- */

  var lines = gsap.utils.toArray('.hero h1 .line-in');
  var panels = gsap.utils.toArray('.panel');
  var heat = gsap.utils.toArray('.panel-heat');
  var bloom = document.querySelector('.bloom');

  gsap.set(heat, { opacity: 1 });

  var intro = gsap.timeline({ defaults: { ease: 'expo.out' } });

  if (lines.length) {
    intro.from(lines, { yPercent: 118, opacity: 0, duration: 1.15, stagger: 0.09 }, 0.05);
  }
  if (panels.length) {
    intro.from(panels, {
      y: 70,
      scale: 0.94,
      opacity: 0,
      filter: 'blur(10px)',
      duration: 1.25,
      stagger: 0.11
    }, 0.2);
    intro.to(heat, { opacity: 0, duration: 2.2, ease: 'power2.inOut', stagger: 0.16 }, 1.15);
  }
  if (bloom) {
    intro.fromTo(bloom, { opacity: 0, scale: 0.9, y: 30 }, { opacity: 1, scale: 1, y: 0, duration: 1.4 }, 0.75);
  }

  /* ---------- Появление блоков ---------- */

  gsap.utils.toArray('.fade').forEach(function (el) {
    gsap.from(el, {
      y: 26,
      opacity: 0,
      duration: 0.95,
      ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 90%', once: true }
    });
  });

  /* ---------- Параллакс стойки ---------- */

  if (panels.length) {
    gsap.to(panels[0], {
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }
  if (panels[1]) {
    gsap.to(panels[1], {
      yPercent: -12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }
  if (bloom) {
    gsap.to(bloom, {
      yPercent: 12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  var heroBg = document.querySelector('.hero-bg');
  if (heroBg) {
    gsap.to(heroBg, {
      yPercent: 8,
      scale: 1.06,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });
  }

  var contactBg = document.querySelector('.contact-bg');
  if (contactBg) {
    gsap.fromTo(contactBg, { yPercent: -8 }, {
      yPercent: 8,
      ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true }
    });
  }

  /* ---------- Свободное парение панелей ---------- */

  Array.prototype.forEach.call(panels, function (panel, i) {
    gsap.to(panel, {
      y: i === 1 ? -9 : 9,
      rotate: i === 2 ? -1.8 : i === 1 ? 1.4 : -1.2,
      duration: 6 + i * 1.4,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      delay: 1.2 + i * 0.3
    });
  });

  /* ---------- Наклон панели за курсором ---------- */

  if (finePointer && panels.length) {
    Array.prototype.forEach.call(panels, function (panel) {
      var rx = gsap.quickTo(panel, 'rotationX', { duration: 0.6, ease: 'power3.out' });
      var ry = gsap.quickTo(panel, 'rotationY', { duration: 0.6, ease: 'power3.out' });

      panel.addEventListener('pointermove', function (e) {
        var r = panel.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        ry(px * 12);
        rx(-py * 10);
      });
      panel.addEventListener('pointerleave', function () { rx(0); ry(0); });
    });
  }

  /* ---------- Магнитные кнопки ---------- */

  if (finePointer) {
    Array.prototype.forEach.call(document.querySelectorAll('.btn, .tab'), function (el) {
      var mx = gsap.quickTo(el, 'x', { duration: 0.45, ease: 'power3.out' });
      var my = gsap.quickTo(el, 'y', { duration: 0.45, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        mx(((e.clientX - r.left) / r.width - 0.5) * 8);
        my(((e.clientY - r.top) / r.height - 0.5) * 6);
      });
      el.addEventListener('pointerleave', function () { mx(0); my(0); });
    });
  }

  /* ---------- Картинка кейса подъезжает при входе ---------- */

  var compare = document.querySelector('.compare');
  if (compare) {
    var cmpImgs = compare.querySelectorAll('img');
    gsap.from(cmpImgs, {
      scale: 1.08,
      duration: 1.5,
      ease: 'expo.out',
      stagger: 0.08,
      scrollTrigger: { trigger: compare, start: 'top 85%', once: true }
    });
  }

  window.ScrollTrigger.refresh();
}());
