/* portfolio/cinematic.js
   ---------------------------------------------------------------------------
   Клиентский движок cinematic-scroll для /portfolio/.
   Зависимости: window.gsap и window.ScrollTrigger из локальных
   vendor/gsap.min.js и vendor/ScrollTrigger.min.js. Серверной части нет.

   Договорённости (см. общий контракт проекта):
   - без библиотек движок молча завершается: содержимое остаётся видимым;
   - скрытие и смещение задаются только внутри уже созданной GSAP-анимации,
     в CSS и разметке ничего не прячется;
   - prefers-reduced-motion: ни закрепления, ни параллакса, ни scrub;
   - ширина < 768px: нативная прокрутка, появление по scroll-триггерам,
     без закрепления, параллакса и scrub;
   - portfolio:ready только обновляет ScrollTrigger и добавляет анимации
     действительно новым узлам — уже анимированные не трогаются;
   - нативная прокрутка: нет Lenis, нет перехвата колеса и собственного
     rAF-цикла; в частых обновлениях участвуют только transform и opacity.
   --------------------------------------------------------------------------- */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;

  var MQ_DESKTOP = '(min-width: 768px)';
  var MQ_MOBILE = '(max-width: 767.98px)';
  var MQ_REDUCE = '(prefers-reduced-motion: reduce)';

  var REVEAL_SEL = '[data-reveal]';
  var CARD_SEL = '.case-card, .case';
  var PARALLAX_SEL = '[data-parallax]';
  var SCENE_SEL = '.cinematic-scene';

  var gsap = null;
  var ScrollTrigger = null;
  var mm = null;
  var booted = false;
  var activeMode = '';
  var claimed = [];   // элементы, у которых уже есть владелец анимации
  var tweens = [];    // твины и таймлайны, созданные движком
  var triggers = [];  // отдельные ScrollTrigger (закрепление)
  var refreshTimer = 0;
  var pinToken = 0;      // отсекает позднее закрепление после смены режима
  var pinCreated = false;

  /* ── служебное ───────────────────────────────────────────── */

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || doc).querySelectorAll(selector));
  }

  function isClaimed(el) {
    return claimed.indexOf(el) !== -1;
  }

  function claim(nodes) {
    for (var i = 0; i < nodes.length; i++) {
      if (claimed.indexOf(nodes[i]) === -1) claimed.push(nodes[i]);
    }
  }

  function track(tween) {
    if (tween) tweens.push(tween);
    return tween;
  }

  function closest(el, selector) {
    var node = el;
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  // Сброс всего, чем владеет движок: пины, твины, инлайн-стили.
  function teardown() {
    var i;
    for (i = 0; i < triggers.length; i++) {
      try { triggers[i].kill(true); } catch (e) { /* уже снят */ }
    }
    // Откатываем в обратном порядке: поздний tween мог сохранить transform
    // от более раннего gsap.set(). Иначе после ресайза остаётся его scale.
    for (i = tweens.length - 1; i >= 0; i--) {
      try {
        if (tweens[i] && typeof tweens[i].revert === 'function') tweens[i].revert();
        else if (tweens[i]) tweens[i].kill();
      } catch (e) { /* ничего не осталось */ }
    }
    triggers = [];
    tweens = [];
    claimed = [];
    activeMode = '';
    pinToken += 1;
    pinCreated = false;
    if (refreshTimer) {
      window.clearTimeout(refreshTimer);
      refreshTimer = 0;
    }
  }

  // Пересчёт координат без собственного цикла: только по событиям.
  function refresh(immediate) {
    if (!ScrollTrigger || typeof ScrollTrigger.refresh !== 'function') return;
    if (immediate) {
      ScrollTrigger.refresh();
      return;
    }
    if (refreshTimer) return; // повторное portfolio:ready не множит пересчёты
    refreshTimer = window.setTimeout(function () {
      refreshTimer = 0;
      ScrollTrigger.refresh();
    }, 90);
  }

  // Геометрия меняется после шрифтов и картинок — обновляем ровно тогда.
  function watchLoad() {
    var images = all('img');
    var pending = 0;
    function done() {
      pending -= 1;
      if (pending <= 0) refresh();
    }
    for (var i = 0; i < images.length; i++) {
      if (images[i].complete) continue;
      pending += 1;
      images[i].addEventListener('load', done, { once: true });
      images[i].addEventListener('error', done, { once: true });
    }
    if (doc.fonts && doc.fonts.ready && typeof doc.fonts.ready.then === 'function') {
      doc.fonts.ready.then(function () { refresh(); }).catch(function () {});
    }
    window.addEventListener('load', function () { refresh(); }, { once: true });
  }

  /* ── инициализация ───────────────────────────────────────── */

  function init() {
    gsap = window.gsap;
    ScrollTrigger = window.ScrollTrigger;

    if (!gsap || !ScrollTrigger || typeof gsap.matchMedia !== 'function' ||
        typeof ScrollTrigger.create !== 'function') {
      // Библиотек нет: страница остаётся статичной и полностью читаемой.
      gsap = null;
      ScrollTrigger = null;
      root.setAttribute('data-cinematic', 'off');
      return false;
    }

    gsap.registerPlugin(ScrollTrigger);
    if (typeof ScrollTrigger.config === 'function') {
      // Адресная строка на телефоне не должна вызывать лишний refresh.
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    root.setAttribute('data-cinematic', 'on');

    mm = gsap.matchMedia();

    // Настольный режим: появление, параллакс, постановка сцен и один короткий пин.
    mm.add(MQ_DESKTOP + ' and (prefers-reduced-motion: no-preference)', function () {
      activeMode = 'desktop';
      // Если разметка неожиданная и построение падает — откатываем всё,
      // чтобы страница осталась читаемой без анимаций.
      try { build('desktop'); } catch (e) { teardown(); }
      return teardown;
    });

    // Телефон: только появление элементов, всё остальное — нативный поток.
    mm.add(MQ_MOBILE + ' and (prefers-reduced-motion: no-preference)', function () {
      activeMode = 'compact';
      try { build('compact'); } catch (e) { teardown(); }
      return teardown;
    });

    // reduced-motion: ничего не создаём, композиция из CSS остаётся как есть.
    mm.add(MQ_REDUCE, function () {
      activeMode = 'static';
      return function () { activeMode = ''; };
    });

    refresh(true);
    watchLoad();
    return true;
  }

  function boot() {
    if (booted) return;
    booted = true;
    init();
  }

  // portfolio.js отправляет событие из своего defer-скрипта — то есть до
  // инициализации. Тогда карточки уже в DOM и попадут в первую сборку.
  function onPortfolioReady() {
    if (!booted) {
      if (doc.readyState !== 'loading') boot();
      return;
    }
    if (!gsap || !activeMode || activeMode === 'static') return;
    boltOn();
    // Кейс мог появиться после загрузки — тогда пин ещё ни разу не ставился.
    if (activeMode === 'desktop' && !pinCreated && doc.readyState === 'complete') {
      var candidate = pinCandidate();
      if (candidate) deferPin(candidate);
    }
    refresh();
  }

  // Только новые узлы: ничего из уже анимированного не пересоздаётся.
  function boltOn() {
    if (activeMode === 'compact') {
      revealTargets('compact', []);
      return;
    }
    revealTargets('desktop', []);
    parallaxTargets();
  }

  doc.addEventListener('portfolio:ready', onPortfolioReady);
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  /* ── построение сцен ─────────────────────────────────────── */

  function build(mode) {
    // Закрепление решаем до появления, но создаём после загрузки — когда
    // высоты окончательные. До этого карточка живёт обычным появлением.
    var pinned = mode === 'desktop' ? pinCandidate() : null;

    heroIntro(mode);
    revealTargets(mode, []);
    if (mode === 'desktop') {
      parallaxTargets();
      stageScenes(pinned);
    }
    if (pinned) deferPin(pinned);
  }

  // Первый экран собирается сразу, без прокрутки: одна спокойная очередь.
  function heroIntro(mode) {
    var hero = doc.getElementById('hero');
    if (!hero) return;
    var nodes = all(REVEAL_SEL, hero).filter(function (el) { return !isClaimed(el); });
    if (!nodes.length) return;
    claim(nodes);

    var wide = mode === 'desktop';
    var tl = gsap.timeline({
      delay: 0.06,
      defaults: { ease: 'power3.out', duration: wide ? 1 : 0.72 }
    });
    tl.from(nodes, {
      y: wide ? 34 : 20,
      opacity: 0,
      stagger: wide ? 0.09 : 0.06,
      clearProps: 'transform,opacity'
    });
    track(tl);
  }

  // Появление по мере прокрутки. Элемент, который уже в кадре или выше него,
  // не прячем вообще — иначе переход по якорю оставлял бы пустоту.
  function revealTargets(mode, skip) {
    var line = window.innerHeight * 0.9;
    var step = mode === 'desktop' ? 0.08 : 0.055;
    var counts = [];
    var nodes = all(REVEAL_SEL + ', ' + CARD_SEL);

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isClaimed(el) || skip.indexOf(el) !== -1) continue;
      if (el.getBoundingClientRect().top <= line) continue;
      claim([el]);
      track(gsap.from(el, {
        y: mode === 'desktop' ? 28 : 16,
        opacity: 0,
        duration: mode === 'desktop' ? 0.95 : 0.7,
        ease: 'power3.out',
        delay: Math.min(nextIndex(counts, el), 4) * step,
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      }));
    }
  }

  // Порядковый номер элемента внутри его сцены — мягкая очерёдность.
  function nextIndex(counts, el) {
    var scene = closest(el, SCENE_SEL) || doc.body;
    for (var i = 0; i < counts.length; i++) {
      if (counts[i].scene === scene) {
        counts[i].n += 1;
        return counts[i].n - 1;
      }
    }
    counts.push({ scene: scene, n: 1 });
    return 0;
  }

  // Параллакс декоративных слоёв и изображений кейсов.
  // Портрет владельца не трансформируем: пропорции и кадрирование сохраняются.
  function parallaxTargets() {
    var nodes = all(PARALLAX_SEL);

    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (isClaimed(el)) continue;
      if (el.tagName === 'IMG' && el.classList.contains('profile-photo')) continue;

      var style = window.getComputedStyle(el);
      if (style.position === 'sticky' || style.position === 'fixed') continue;

      claim([el]);
      var isImage = el.tagName === 'IMG';
      var amplitude = isImage ? 5 : 8;

      // object-fit: cover — сдвиг без запаса открыл бы кромку контейнера.
      if (isImage && style.objectFit === 'cover') {
        track(gsap.set(el, { scale: 1.1 }));
      }
      track(gsap.fromTo(el, { yPercent: -amplitude }, {
        yPercent: amplitude,
        ease: 'none',
        scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 0.6 }
      }));
    }
  }

  // Постановка сцены: холст входит в кадр чуть приглушённым и приподнятым.
  // Только opacity и лёгкий сдвиг — текст остаётся читаемым в любой момент.
  function stageScenes(pinned) {
    var scenes = all(SCENE_SEL);

    for (var i = 0; i < scenes.length; i++) {
      var scene = scenes[i];
      var inner = scene.querySelector('.scene-inner');
      if (!inner || isClaimed(inner)) continue;
      // Сцену с закреплённым элементом не двигаем: сдвиг предка сбивает
      // расчёт позиции пина.
      if (pinned && (scene === pinned || scene.contains(pinned))) continue;

      var style = window.getComputedStyle(inner);
      if (style.position === 'sticky' || style.position === 'fixed') continue;

      claim([inner]);
      track(gsap.fromTo(inner, {
        opacity: 0.86,
        yPercent: 1.6
      }, {
        opacity: 1,
        yPercent: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: scene,
          start: 'top 88%',
          end: 'top 42%',
          scrub: 0.5
        }
      }));
    }
  }

  /* ── единственное закрепление ────────────────────────────── */

  // Кандидат на пин — сцена работ. Берём наименьший элемент, который целиком
  // помещается под шапку: карточку кейса, иначе внутренний контейнер сцены.
  // Если не помещается ничего — закрепления нет, прокрутка остаётся нативной.
  function pinCandidate() {
    var scene = doc.getElementById('cases');
    if (!scene) return null;
    var viewport = window.innerHeight;
    if (viewport < 520) return null;

    var fit = viewport - headerOffset() - 96;
    var list = all(CARD_SEL, scene);
    var inner = scene.querySelector('.scene-inner');
    if (inner) list.push(inner);

    for (var i = 0; i < list.length; i++) {
      if (list[i].offsetHeight > fit) continue;
      if (clippedAncestor(list[i])) continue;
      return list[i];
    }
    return null;
  }

  // Отступ под закреплённую шапку, если она есть; иначе спокойные 72px.
  function headerOffset() {
    var head = doc.querySelector('.site-head, header');
    var height = 0;
    if (head) {
      var style = window.getComputedStyle(head);
      if ((style.position === 'sticky' || style.position === 'fixed') && head.offsetHeight) {
        height = head.offsetHeight;
      }
    }
    return Math.max(72, Math.min(height + 16, 140));
  }

  function clippedAncestor(el) {
    var node = el.parentElement;
    while (node && node !== doc.body && node !== root) {
      var style = window.getComputedStyle(node);
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') return true;
      node = node.parentElement;
    }
    return false;
  }

  // Пин создаём один раз и только когда вёрстка окончательная: до загрузки
  // шрифтов и картинки высота кейса ещё врёт, а закреплять «на глаз» нельзя.
  function deferPin(target) {
    var token = ++pinToken;

    function arm() {
      if (token !== pinToken || activeMode !== 'desktop' || pinCreated) return;
      if (target.offsetHeight > window.innerHeight - headerOffset() - 96) return;
      pinCreated = true;
      try {
        pinScene(target);
      } catch (e) {
        // Пин не удался — отпускаем элемент, прокрутка остаётся нативной.
        pinCreated = false;
        if (gsap) gsap.set(target, { clearProps: 'all' });
        return;
      }
      refresh(true);
    }

    if (doc.readyState === 'complete') {
      window.setTimeout(arm, 0);
      return;
    }
    window.addEventListener('load', function () { window.setTimeout(arm, 0); }, { once: true });
  }

  // Короткий пин: кейс задерживается в кадре, пока идёт прокрутка, а
  // изображение внутри него медленно наезжает. Одно движение — один владелец.
  // pinType: transform — на body стоит overflow-x: clip, и фиксированный пин
  // внутри такого контекста может обрезаться.
  function pinScene(target) {
    // Если появление ещё в полёте (очень быстрая прокрутка), забираем элемент
    // себе: у закреплённого узла должен быть один владелец transform.
    // Отложенный reveal ещё не isTweening(), но уже записал opacity: 0.
    // Убираем и ожидающие твины до того, как пин заберёт transform.
    gsap.killTweensOf(target);
    gsap.set(target, { clearProps: 'transform,opacity' });
    claim([target]);

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: target,
        start: function () { return 'top ' + headerOffset() + 'px'; },
        end: function () { return '+=' + Math.round(Math.min(window.innerHeight * 0.42, 360)); },
        pin: true,
        pinSpacing: true,
        pinType: 'transform',
        scrub: 0.5,
        invalidateOnRefresh: true
      }
    });

    var images = all('img', target).filter(function (img) { return !isClaimed(img); });
    if (images.length) {
      claim(images);
      tl.fromTo(images, { scale: 1 }, {
        scale: 1.045,
        transformOrigin: '50% 50%',
        ease: 'none'
      });
    } else {
      tl.to({}, { duration: 1 });
    }

    track(tl);
    if (tl.scrollTrigger) triggers.push(tl.scrollTrigger);
  }
}());
