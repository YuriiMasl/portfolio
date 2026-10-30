/* ============================================================
   Наполнение портфолио данными projects.js.
   - данные вставляются только как текст, ссылки проверяются до попадания в DOM;
   - разметка карточек соответствует cinematic.css (.case-card и др.);
   - появление и параллакс — в cinematic.js (GSAP), здесь их нет;
   - после наполнения отправляется событие portfolio:ready.
   ============================================================ */
(function () {
  'use strict';

  var list = document.getElementById('case-list');
  var slot = document.getElementById('contact-slot');
  var data = window.PORTFOLIO_DATA;

  function text(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  /* Пустой адрес означает «ссылки нет». Протоколы проверяются по allowlist. */
  function safeUrl(value, contact) {
    value = text(value);
    if (!value) return '';
    try {
      var url = new URL(value, document.baseURI);
      var allowed = contact
        ? ['https:', 'http:', 'mailto:', 'tel:']
        : ['https:', 'http:', 'file:'];
      return allowed.indexOf(url.protocol) !== -1 ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function label(index) {
    var n = String(index + 1);
    return n.length < 2 ? '0' + n : n;
  }

  function projectCard(project, index) {
    var card = element('article', 'case-card');
    card.setAttribute('data-reveal', '');

    var media = element('div', 'case-media');
    var imageSrc = safeUrl(project.image, false);
    var imageAlt = text(project.imageAlt) || text(project.title);

    if (imageSrc) {
      var img = document.createElement('img');
      img.src = imageSrc;
      img.alt = imageAlt;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.setAttribute('data-parallax', '0.05');
      img.addEventListener('error', function () {
        var fallback = element('p', 'case-empty');
        fallback.textContent = 'Изображение кейса не загрузилось.';
        media.replaceChildren(fallback);
      });
      media.append(img);
    } else {
      var placeholder = element('p', 'case-empty');
      placeholder.textContent = 'Изображение кейса недоступно.';
      media.append(placeholder);
    }

    var body = element('div', 'case-body');
    var kicker = element('p', 'case-kicker');
    kicker.textContent = 'Кейс ' + label(index);
    body.append(kicker);

    var title = text(project.title);
    if (title) {
      var heading = element('h3', 'case-title');
      heading.textContent = title;
      body.append(heading);
    }

    var category = text(project.category);
    if (category) {
      var categoryNode = element('p', 'case-category');
      categoryNode.textContent = category;
      body.append(categoryNode);
    }

    var description = text(project.description);
    if (description) {
      var descriptionNode = element('p', 'case-desc');
      descriptionNode.textContent = description;
      body.append(descriptionNode);
    }

    var foot = element('div', 'case-foot');
    var href = safeUrl(project.href, false);
    var linkText = text(project.linkLabel) || 'Открыть кейс';
    if (href) {
      var link = element('a', 'btn btn--primary');
      link.href = href;
      link.rel = 'noopener';
      link.append(document.createTextNode(linkText + ' '));
      var arrow = element('span', 'arrow');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '→';
      link.append(arrow);
      foot.append(link);
    }

    var stage = element('span', 'case-stage');
    stage.textContent = 'Демонстрационный макет';
    foot.append(stage);
    body.append(foot);

    card.append(media, body);
    return card;
  }

  function renderCases() {
    if (!list) return 0;
    if (!data || !Array.isArray(data.projects)) {
      var error = element('p', 'case-error');
      error.textContent = 'Не удалось загрузить работы. Обновите страницу или попробуйте позже.';
      list.replaceChildren(error);
      return 0;
    }

    var cards = [];
    data.projects.forEach(function (project, index) {
      if (!project || !text(project.title)) return;
      cards.push(projectCard(project, index));
    });

    if (!cards.length) {
      var empty = element('p', 'case-empty');
      empty.textContent = 'Подтверждённых кейсов пока нет. Страница не выдумывает работы вместо реальных.';
      list.replaceChildren(empty);
      return 0;
    }

    list.replaceChildren.apply(list, cards);
    return cards.length;
  }

  /* Контактный блок заполняется только подтверждённым способом связи.
     Пока контакта нет, честное сообщение и ссылка на демо остаются в HTML. */
  function renderContact() {
    if (!slot || !data || !data.contact) return;
    var contactLabel = text(data.contact.label);
    var contactHref = safeUrl(data.contact.href, true);
    if (!contactLabel || !contactHref) return;

    var link = element('a', 'contact-link');
    link.href = contactHref;
    link.textContent = contactLabel;
    slot.replaceChildren(link);
  }

  function announce(count) {
    try {
      document.dispatchEvent(new CustomEvent('portfolio:ready', {
        detail: { count: count },
      }));
    } catch (_) {
      /* Старые браузеры: событие не критично для содержимого страницы. */
    }
  }

  var rendered = renderCases();
  renderContact();
  announce(rendered);
}());
