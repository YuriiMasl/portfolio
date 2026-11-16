/* СМЕНА — интерфейсные механики: часы, смена, меню, появление секций */
(() => {
  "use strict";

  document.documentElement.classList.add("js");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- часы работы ---------- */
  const schedule = {
    0: ["09:00", "22:00"],
    1: ["08:00", "21:00"],
    2: ["08:00", "21:00"],
    3: ["08:00", "21:00"],
    4: ["08:00", "21:00"],
    5: ["08:00", "21:00"],
    6: ["09:00", "22:00"],
  };
  const dayNames = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

  const toMinutes = (value) => {
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };

  function openStatus(now) {
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const [open, close] = schedule[day];
    const openM = toMinutes(open);
    const closeM = toMinutes(close);

    if (minutes >= openM && minutes < closeM) {
      return { open: true, text: `Открыто до ${close}` };
    }
    if (minutes < openM) {
      return { open: false, text: `Закрыто · откроемся в ${open}` };
    }
    const nextDay = (day + 1) % 7;
    return { open: false, text: `Закрыто · ${dayNames[nextDay]}, в ${schedule[nextDay][0]}` };
  }

  function paintStatus() {
    const state = openStatus(new Date());
    document.querySelectorAll("[data-status]").forEach((node) => {
      node.textContent = state.text;
      node.classList.toggle("is-closed", !state.open);
    });
  }
  paintStatus();
  window.setInterval(paintStatus, 60_000);

  /* ---------- номер смены и дата ---------- */
  const OPENING = new Date(2023, 3, 1);
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

  function paintShift() {
    const now = new Date();
    const days = Math.floor((now - OPENING) / 86_400_000) + 1;
    const date = `${now.getDate()} ${MONTHS[now.getMonth()]}`;
    document.querySelectorAll("[data-shift]").forEach((node) => {
      node.textContent = `Смена № ${days}`;
    });
    document.querySelectorAll("[data-date]").forEach((node) => {
      node.textContent = date;
    });
  }
  paintShift();

  /* ---------- фильтры меню ---------- */
  const filters = [...document.querySelectorAll("[data-filter]")];
  const items = [...document.querySelectorAll("[data-menu] > li")];
  const countOut = document.querySelector("[data-count]");

  const plural = (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "позиция";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "позиции";
    return "позиций";
  };

  function applyFilter(category) {
    let shown = 0;
    items.forEach((item) => {
      const match = item.dataset.cat === category;
      item.hidden = !match;
      if (match) shown += 1;
    });
    if (countOut) countOut.textContent = `${shown} ${plural(shown)}`;
  }

  filters.forEach((button) => {
    button.addEventListener("click", () => {
      filters.forEach((other) => {
        const active = other === button;
        other.classList.toggle("is-on", active);
        other.setAttribute("aria-pressed", String(active));
      });
      applyFilter(button.dataset.filter);
    });
  });

  if (filters.length) {
    const active = filters.find((button) => button.classList.contains("is-on"));
    if (active) applyFilter(active.dataset.filter);
  }

  /* ---------- появление секций ---------- */
  const revealItems = [...document.querySelectorAll("[data-reveal]")];

  function markIn(node) {
    if (!node.classList.contains("is-in")) node.classList.add("is-in");
  }

  function sweep() {
    const limit = window.innerHeight * 0.94;
    revealItems.forEach((node) => {
      const top = node.getBoundingClientRect().top;
      if (top < limit) markIn(node);
    });
  }

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach(markIn);
  } else {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          markIn(entry.target);
          io.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.05 }
    );
    revealItems.forEach((node) => io.observe(node));

    // запасной проход: IO не срабатывает в фоновой/скрытой вкладке и у элементов,
    // которые в момент старта уже были в кадре
    sweep();
    window.addEventListener("scroll", () => window.requestAnimationFrame(sweep), { passive: true });
    window.addEventListener("resize", sweep);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) sweep();
    });
  }

  /* ---------- полоса прогресса ---------- */
  const bar = document.querySelector("[data-progress]");
  let ticking = false;

  function paintProgress() {
    if (!bar) return;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const ratio = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    bar.style.transform = `scaleY(${ratio.toFixed(4)})`;
    ticking = false;
  }

  if (bar) {
    paintProgress();
    window.addEventListener(
      "scroll",
      () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(paintProgress);
      },
      { passive: true }
    );
    window.addEventListener("resize", paintProgress);
  }

  /* ---------- мобильное меню ---------- */
  const burger = document.querySelector(".masthead__burger");
  const drawer = document.querySelector("#drawer");
  const pageMain = document.querySelector("main");
  const pageFoot = document.querySelector("footer");

  function setPageInert(value) {
    if (pageMain) pageMain.inert = value;
    if (pageFoot) pageFoot.inert = value;
  }

  function closeDrawer() {
    if (!drawer || !burger) return;
    drawer.hidden = true;
    burger.setAttribute("aria-expanded", "false");
    document.body.style.overflow = "";
    setPageInert(false);
  }

  if (burger && drawer) {
    burger.addEventListener("click", () => {
      const willOpen = drawer.hidden;
      drawer.hidden = !willOpen;
      burger.setAttribute("aria-expanded", String(willOpen));
      document.body.style.overflow = willOpen ? "hidden" : "";
      setPageInert(willOpen);
      if (willOpen) {
        const first = drawer.querySelector("a");
        if (first) first.focus({ preventScroll: true });
      }
    });

    drawer.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeDrawer();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !drawer.hidden) {
        closeDrawer();
        burger.focus({ preventScroll: true });
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 980 && !drawer.hidden) closeDrawer();
    });
  }
})();
