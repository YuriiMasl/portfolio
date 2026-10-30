"""Статическая проверка контракта cinematic-портфолио (только stdlib).

Проверяются ФАЙЛЫ: разметка, CSS, JS и локальные ресурсы. Это не браузерная
проверка: видимость, закрепление сцен, reduced-motion и клавиатура требуют
ручного прогона в Chrome (см. REPORT.md).

Запуск:  py portfolio/qa_cinematic/check_contract.py [папка-portfolio]
Код выхода: 0 — нарушений нет, 1 — есть FAIL (или WARN при --strict),
2 — не найдена папка portfolio / index.html.
"""
from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

DEFAULT_ROOT = Path(__file__).resolve().parent.parent

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}

SECTION_IDS = ["hero", "services", "cases", "about", "contact"]
SCRIPT_ORDER = ["projects.js", "portfolio.js", "vendor/gsap.min.js",
                "vendor/ScrollTrigger.min.js", "cinematic.js"]
DEMO_URL = "https://yuriimasl.github.io/lyublyu-demo/"
PHOTO = "w2K7lKvhrwA.jpg"

PASS, FAIL, WARN = "PASS", "FAIL", "WARN"


def strip_js_comments(text: str) -> str:
    """Убирает комментарии, чтобы слова «Lenis»/«wheel» в пояснениях не были FAIL."""
    text = re.sub(r"/\*[\s\S]*?\*/", " ", text)
    return re.sub(r"(?m)(^|[^:\\])//[^\n]*", r"\1 ", text)


def strip_html_comments(text: str) -> str:
    return re.sub(r"<!--[\s\S]*?-->", " ", text)


class Doc(HTMLParser):
    """Плоский список элементов с порядком, глубиной и родителем."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.els: list[dict] = []
        self.stack: list[dict] = []
        self.styles: list[str] = []
        self.noscripts: list[str] = []
        self._mode: str | None = None
        self._buf: list[str] = []

    def handle_starttag(self, tag, attrs):
        attrs = {k: (v if v is not None else "") for k, v in attrs}
        el = {"tag": tag, "attrs": attrs, "order": len(self.els),
              "depth": len(self.stack),
              "parent": self.stack[-1] if self.stack else None}
        self.els.append(el)
        if tag in VOID:
            return
        self.stack.append(el)
        if tag in ("style", "noscript"):
            self._mode, self._buf = tag, []

    def handle_startendtag(self, tag, attrs):
        attrs = {k: (v if v is not None else "") for k, v in attrs}
        self.els.append({"tag": tag, "attrs": attrs, "order": len(self.els),
                         "depth": len(self.stack),
                         "parent": self.stack[-1] if self.stack else None})

    def handle_data(self, data):
        if self._mode:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if tag == self._mode:
            text = "".join(self._buf)
            (self.styles if tag == "style" else self.noscripts).append(text)
            self._mode = None
        while self.stack:
            if self.stack.pop()["tag"] == tag:
                break

    def with_tag(self, tag):
        return [e for e in self.els if e["tag"] == tag]

    def ids(self):
        return [e["attrs"]["id"] for e in self.els if e["attrs"].get("id")]

    def descendants(self, el):
        out = []
        for e in self.els[el["order"] + 1:]:
            if e["depth"] <= el["depth"]:
                break
            out.append(e)
        return out

    def ancestors(self, el):
        node = el.get("parent")
        while node is not None:
            yield node
            node = node.get("parent")


class Report:
    def __init__(self):
        self.rows: list[tuple[str, str, str]] = []

    def add(self, status, key, msg):
        self.rows.append((status, key, msg))

    def ok(self, key, msg):
        self.add(PASS, key, msg)

    def fail(self, key, msg):
        self.add(FAIL, key, msg)

    def warn(self, key, msg):
        self.add(WARN, key, msg)

    def count(self, status):
        return sum(1 for r in self.rows if r[0] == status)

    def fails(self):
        return [r for r in self.rows if r[0] == FAIL]


def local_path(root: Path, url: str) -> Path | None:
    """Локальный путь из src/href; None для внешних ссылок и data:."""
    if not url or url.startswith(("#", "data:")):
        return None
    if re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", url) or url.startswith("//"):
        return None
    clean = url.split("?")[0].split("#")[0]
    return (root / clean).resolve()


def looks_remote(url: str) -> bool:
    return bool(re.match(r"^(https?:)?//", url or "", re.I))


def exists(root: Path, rel: str) -> bool:
    p = root / rel
    if p.is_file():
        return True
    parent = p.parent
    if not parent.is_dir():
        return False
    return any(c.is_file() and c.name.lower() == p.name.lower()
               for c in parent.iterdir())


def media_block(css: str, start_text: str) -> tuple[int, int] | None:
    """Границы @media-блока по началу условия (без учёта вложенности at-rules)."""
    idx = css.find(start_text)
    if idx < 0:
        return None
    start = css.find("{", idx)
    if start < 0:
        return None
    depth = 0
    for pos in range(start, len(css)):
        if css[pos] == "{":
            depth += 1
        elif css[pos] == "}":
            depth -= 1
            if depth == 0:
                return idx, pos + 1
    return idx, len(css)


def hiding_rules(css: str) -> list[tuple[str, str]]:
    """Правила вне @media (prefers-reduced-motion: reduce), скрывающие контент."""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    block = media_block(css, "@media (prefers-reduced-motion")
    if block:
        css = css[:block[0]] + css[block[1]:]
    found = []
    for sel, body in re.findall(r"([^{}]+)\{([^{}]*)\}", css):
        if re.search(r"opacity\s*:\s*0(?:[;\s}]|$)", body) or \
           re.search(r"visibility\s*:\s*hidden", body):
            found.append((sel.strip(), " ".join(body.split())))
    return found


CONTENT_SELECTOR = re.compile(
    r"\[data-reveal\]|\.cinematic-scene|\.scene-inner|\.case-card|#case-list|"
    r"\.case\b|img|h1|h2|p\b", re.I)


def audit(root: Path) -> Report:
    rep = Report()
    index = root / "index.html"
    if not index.is_file():
        rep.fail("файлы", f"нет {index}")
        return rep

    html = index.read_text(encoding="utf-8")
    doc = Doc()
    doc.feed(html)

    # 1. файлы контракта
    required = ["index.html", "projects.js", "portfolio.js", "cinematic.css",
                "cinematic.js", "vendor/gsap.min.js",
                "vendor/ScrollTrigger.min.js", PHOTO]
    missing = [f for f in required if not exists(root, f)]
    if missing:
        rep.fail("файлы", "отсутствуют локальные файлы: " + ", ".join(missing))
    else:
        rep.ok("файлы", "все файлы контракта на месте")
    for lib, marker in (("vendor/gsap.min.js", "gsap"),
                        ("vendor/ScrollTrigger.min.js", "ScrollTrigger")):
        p = root / lib
        if not p.is_file():
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        if len(text) < 10_000:
            rep.warn("файлы", f"{lib} подозрительно мал ({len(text)} символов)")
        if marker.lower() not in text.lower():
            rep.fail("файлы", f"{lib} не содержит признак библиотеки «{marker}»")

    # 2. секции, якоря, разметка сцен
    ids = doc.ids()
    dups = sorted({i for i in ids if ids.count(i) > 1})
    if dups:
        rep.fail("якоря", "повторяющиеся id: " + ", ".join(dups))
    else:
        rep.ok("якоря", f"id уникальны ({len(ids)} шт.)")

    section_els = {e["attrs"]["id"]: e for e in doc.with_tag("section")
                   if e["attrs"].get("id")}
    scene_problems = []
    for sid in SECTION_IDS:
        el = section_els.get(sid)
        if el is None:
            scene_problems.append(f"нет <section id=\"{sid}\">")
            continue
        classes = el["attrs"].get("class", "").split()
        if "cinematic-scene" not in classes:
            scene_problems.append(f"#{sid} без класса cinematic-scene")
            continue
        kids = doc.descendants(el)
        if not any("scene-inner" in k["attrs"].get("class", "").split()
                   for k in kids):
            scene_problems.append(f"#{sid}: внутри нет .scene-inner")
    if scene_problems:
        rep.fail("секции", "; ".join(scene_problems))
    else:
        rep.ok("секции", "hero/services/cases/about/contact — сцены со .scene-inner")

    if any(e["attrs"].get("id") == "case-list" for e in doc.els):
        rep.ok("кейсы", "#case-list присутствует")
    else:
        rep.fail("кейсы", "нет контейнера #case-list для карточек")

    for attr in ("data-reveal", "data-parallax"):
        count = sum(1 for e in doc.els if attr in e["attrs"])
        if count:
            rep.ok("разметка", f"{attr}: {count} элементов")
        else:
            rep.fail("разметка", f"в index.html нет [{attr}] — контрактный селектор не используется")
    if re.search(r"case-card", html) or (
            (root / "portfolio.js").is_file()
            and "case-card" in (root / "portfolio.js").read_text(encoding="utf-8")):
        if re.search(r"case-card", html):
            rep.ok("кейсы", ".case-card есть в разметке")
        else:
            rep.warn("кейсы", ".case-card есть только в JS — итоговую разметку "
                              "нужно проверить в Chrome")
    else:
        rep.fail("кейсы", "селектор .case-card нигде не используется")

    broken = []
    for e in doc.with_tag("a"):
        href = e["attrs"].get("href", "")
        if href.startswith("#") and len(href) > 1 and href[1:] not in ids:
            broken.append(href)
    if broken:
        rep.fail("якоря", "ссылки на несуществующие id: " + ", ".join(sorted(set(broken))))
    elif doc.with_tag("a"):
        rep.ok("якоря", "все внутренние ссылки ведут на существующие id")

    # 3. фото владельца
    photos = [e for e in doc.with_tag("img")
              if "profile-photo" in e["attrs"].get("class", "").split()]
    if len(photos) != 1:
        rep.fail("фото", f"ожидался один img.profile-photo, найдено {len(photos)}")
    else:
        src = photos[0]["attrs"].get("src", "")
        alt = photos[0]["attrs"].get("alt", "").strip()
        if Path(src).name.lower() != PHOTO.lower():
            rep.fail("фото", f"img.profile-photo src={src!r}, ожидался {PHOTO}")
        elif not exists(root, src):
            rep.fail("фото", f"файл фото не найден: {src}")
        elif not alt:
            rep.fail("фото", "у img.profile-photo пустой alt")
        else:
            rep.ok("фото", f"{src} найден, alt заполнен")

    # 4. стили: cinematic.css последним, локальные пути, видимость
    sheets = []
    for e in doc.with_tag("link"):
        rel = e["attrs"].get("rel", "").lower().split()
        href = e["attrs"].get("href", "")
        if "stylesheet" in rel:
            sheets.append((e["order"], href))
    names = [Path(h).name for _, h in sheets]
    if "cinematic.css" not in names:
        rep.fail("стили", "cinematic.css не подключён через <link rel=stylesheet>")
    elif names[-1] != "cinematic.css":
        rep.fail("стили", "cinematic.css должен идти последним; порядок: " + ", ".join(names))
    else:
        rep.ok("стили", "cinematic.css подключён после остальных стилей")
    if not sheets:
        rep.warn("стили", "внешних таблиц стилей нет — проверьте, что оформление вынесено")

    remote = [h for _, h in sheets if looks_remote(h)]
    remote += [e["attrs"].get("src", "") for e in doc.with_tag("script")
               if looks_remote(e["attrs"].get("src", ""))]
    if remote:
        rep.fail("локальность", "внешние стили/скрипты недопустимы: " + ", ".join(remote))
    else:
        rep.ok("локальность", "нет внешних CSS/JS (только локальные файлы)")

    last_sheet_order = sheets[-1][0] if sheets else 0
    if any(e["order"] > last_sheet_order for e in doc.els if e["tag"] == "style"):
        rep.warn("стили", "есть inline <style> после cinematic.css — проверьте каскад")

    css_path = root / "cinematic.css"
    if css_path.is_file():
        css = css_path.read_text(encoding="utf-8")
        hard = [(s, b) for s, b in hiding_rules(css)
                if CONTENT_SELECTOR.search(s)
                and "::before" not in s and "::after" not in s]
        if hard:
            rep.fail("видимость", "cinematic.css скрывает контент вне GSAP: "
                     + "; ".join(f"{s} {{{b}}}" for s, b in hard[:3]))
        else:
            rep.ok("видимость", "cinematic.css не прячет контент статически")
        if "prefers-reduced-motion" in css:
            rep.ok("reduced-motion", "в cinematic.css есть prefers-reduced-motion")
        else:
            rep.fail("reduced-motion", "в cinematic.css нет @media (prefers-reduced-motion)")
        if re.search(r"scroll-behavior\s*:\s*smooth", css):
            rep.warn("прокрутка", "scroll-behavior: smooth может мешать якорям при "
                                  "закреплённых сценах")
    for block in doc.styles:
        for sel, _body in hiding_rules(block):
            if "has-motion" in sel:
                rep.warn("видимость", "inline CSS прячет контент под классом has-motion: "
                         "если JS упадёт после добавления класса, контент останется невидим")

    # 5. скрипты: порядок, defer, локальные файлы, отсутствие module
    scripts = [(e["attrs"].get("src", ""), "defer" in e["attrs"],
                e["attrs"].get("type", "")) for e in doc.with_tag("script")
               if e["attrs"].get("src")]
    got = [Path(s).as_posix() for s, _, _ in scripts]
    if got == SCRIPT_ORDER:
        rep.ok("скрипты", "порядок подключений совпадает с контрактом")
    else:
        idx = next((i for i, _ in enumerate(max(got, SCRIPT_ORDER, key=len))
                    if i >= len(got) or i >= len(SCRIPT_ORDER)
                    or got[i] != SCRIPT_ORDER[i]), 0)
        want = SCRIPT_ORDER[idx] if idx < len(SCRIPT_ORDER) else "конца списка"
        have = got[idx] if idx < len(got) else "ничего"
        rep.fail("скрипты", f"порядок {got} не соответствует контракту; "
                            f"позиция {idx + 1}: ожидался {want}, получен {have}")
    no_defer = [s for s, d, _ in scripts if not d]
    if no_defer:
        rep.fail("скрипты", "подключены без defer: " + ", ".join(no_defer))
    elif scripts:
        rep.ok("скрипты", "все внешние скрипты с defer")
    modules = [s for s, _, t in scripts if "module" in t.lower()]
    if modules:
        rep.fail("скрипты", "type=module нарушает порядок defer-контракта: " + ", ".join(modules))

    gone = []
    for s, _, _ in scripts:
        if looks_remote(s):
            continue
        p = local_path(root, s)
        if p is None or not p.is_file():
            gone.append(f"{s} подключён в index.html, но файла нет ({p})")
    if gone:
        rep.fail("локальность", "; ".join(gone))
    bad_sheets = [h for _, h in sheets
                  if not looks_remote(h)
                  and not (local_path(root, h) and local_path(root, h).is_file())]
    if bad_sheets:
        rep.fail("локальность", "не найдены файлы стилей: " + ", ".join(bad_sheets))

    # 6. cinematic.js: библиотеки, инициализация, reduced-motion, прокрутка
    cjs = root / "cinematic.js"
    js = cjs.read_text(encoding="utf-8") if cjs.is_file() else ""
    if js:
        if "window.gsap" in js and "window.ScrollTrigger" in js:
            rep.ok("библиотеки", "cinematic.js берёт window.gsap и window.ScrollTrigger")
        else:
            missing_ref = [n for n in ("window.gsap", "window.ScrollTrigger") if n not in js]
            rep.fail("библиотеки", "cinematic.js не обращается к " + ", ".join(missing_ref))
        guard = re.search(
            r"if\s*\([^\n]{0,300}(?:!\s*\(?\s*window\.(?:gsap|ScrollTrigger)|"
            r"typeof\s+(?:window\.)?(?:gsap|ScrollTrigger))[^\n]{0,300}\)", js)
        if guard and "return" in js[guard.start():guard.start() + 400]:
            rep.ok("библиотеки", "есть guard с return при отсутствии GSAP/ScrollTrigger")
        elif guard:
            rep.fail("библиотеки", "guard есть, но без return: страница продолжит работу "
                                   "с неинициализированными библиотеками")
        else:
            rep.fail("библиотеки", "нет явной защиты вида if (!window.gsap || "
                                   "!window.ScrollTrigger) return")
        if "DOMContentLoaded" in js:
            rep.ok("инициализация", "инициализация на DOMContentLoaded")
        else:
            rep.fail("инициализация", "cinematic.js не инициализируется на DOMContentLoaded")
        ready = re.search(r"addEventListener\(\s*['\"]portfolio:ready['\"][\s\S]{0,300}", js)
        if "portfolio:ready" in js:
            if "ScrollTrigger.refresh" in js:
                rep.ok("инициализация", "portfolio:ready вызывает ScrollTrigger.refresh()")
            else:
                rep.fail("инициализация", "portfolio:ready не вызывает ScrollTrigger.refresh()")
            if ready and re.search(r"gsap\.(?:timeline|fromTo|from|to|set)\s*\(|"
                                   r"ScrollTrigger\.create\s*\(", ready.group(0)):
                rep.fail("инициализация", "обработчик portfolio:ready создаёт анимации повторно")
        else:
            rep.fail("инициализация", "cinematic.js не слушает portfolio:ready")
        reduce_query = re.search(r"['\"`]\(prefers-reduced-motion[^'\"`]*['\"`]", js)
        if reduce_query and "matchMedia" in js:
            rep.ok("reduced-motion", "cinematic.js задаёт prefers-reduced-motion через "
                                     "matchMedia/gsap.matchMedia")
        elif re.search(r"matchMedia\(\s*['\"`][^'\"`]*prefers-reduced-motion", js):
            rep.ok("reduced-motion", "cinematic.js учитывает reduced-motion через matchMedia")
        else:
            rep.fail("reduced-motion", "cinematic.js не задаёт media-query "
                                       "prefers-reduced-motion для matchMedia")
        if "768" not in js and "767" not in js:
            rep.warn("адаптив", "в cinematic.js нет порога 768px для закрепления сцен")
        if "gsap.matchMedia" not in js:
            rep.warn("адаптив", "не найден gsap.matchMedia — очистка при смене режима "
                                "статически не подтверждена")
        probe = strip_js_comments(js)
        low = probe.lower()
        if "lenis" in low or re.search(r"addEventListener\(\s*['\"]wheel", probe) \
                or re.search(r"preventDefault\(\)[^\n]{0,80}(?:wheel|touchmove)", low):
            rep.fail("прокрутка", "Lenis/перехват wheel запрещены контрактом")
        else:
            rep.ok("прокрутка", "нет Lenis и перехвата wheel")
        if "pin:" in js and "768" not in js and "767" not in js:
            rep.fail("адаптив", "pin используется без ограничения 768px")

    if (root / "portfolio.js").is_file():
        pjs = (root / "portfolio.js").read_text(encoding="utf-8")
        if "portfolio:ready" in pjs and "CustomEvent" in pjs:
            rep.ok("инициализация", "portfolio.js отправляет portfolio:ready")
        else:
            rep.fail("инициализация", "portfolio.js не отправляет CustomEvent('portfolio:ready')")
        if "portfolio:ready" in pjs and "DOMContentLoaded" not in pjs:
            rep.warn("инициализация", "portfolio:ready отправляется сразу при выполнении "
                     "portfolio.js; cinematic.js подключается позже и на первичной загрузке "
                     "может не успеть подписаться — начальный ScrollTrigger.refresh должен "
                     "быть в DOMContentLoaded")
        if "innerHTML" in pjs:
            rep.fail("безопасность", "portfolio.js использует innerHTML вместо textContent")
        elif "textContent" in pjs:
            rep.ok("безопасность", "portfolio.js собирает текст через textContent")
    if "lenis" in strip_html_comments(html).lower():
        rep.fail("прокрутка", "в index.html упоминается Lenis")

    # 7. данные projects.js, фото работ, контакт
    pj_path = root / "projects.js"
    if pj_path.is_file():
        pj = pj_path.read_text(encoding="utf-8")
        if "window.PORTFOLIO_DATA" in pj and "projects:" in pj and "contact:" in pj:
            rep.ok("данные", "projects.js сохраняет window.PORTFOLIO_DATA {projects, contact}")
        else:
            rep.fail("данные", "projects.js не соответствует формату window.PORTFOLIO_DATA")
        if re.search(r"^\s*(?:import|export)\s", pj, re.M):
            rep.fail("данные", "projects.js использует import/export — обычный script "
                               "не сможет его загрузить")
        keys = ["title", "category", "description", "image", "imageAlt", "href", "linkLabel"]
        absent = [k for k in keys if not re.search(rf"\b{k}\s*:", pj)]
        if absent:
            rep.fail("данные", "в проекте нет полей: " + ", ".join(absent))
        images = re.findall(r"\bimage\s*:\s*['\"]([^'\"]+)['\"]", pj)
        miss_img = [i for i in images if not looks_remote(i) and not exists(root, i)]
        if miss_img:
            rep.fail("фото", "нет изображений работ: " + ", ".join(miss_img))
        elif images:
            rep.ok("фото", f"изображения работ найдены ({len(images)} шт.)")
        contacts = re.findall(r"contact\s*:\s*\{([^{}]*)\}", pj, re.S)
        contact = next((b for b in contacts if "label" in b), None)
        if contact is not None and re.search(r"label\s*:\s*['\"]['\"]", contact) \
                and re.search(r"href\s*:\s*['\"]['\"]", contact):
            rep.ok("контакт", "контакт остаётся пустым (честный статус)")
        elif contact is not None:
            rep.warn("контакт", "contact заполнен — подтвердите у владельца, что это "
                                "публичный контакт")
        if DEMO_URL.rstrip("/") not in pj and DEMO_URL.rstrip("/") not in html:
            rep.fail("демо", f"ссылка на демо {DEMO_URL} потеряна")

    # 8. демо-ссылка и доступность без JS
    noscript = " ".join(doc.noscripts)
    anchors = [e for e in doc.with_tag("a")
               if DEMO_URL.rstrip("/") in e["attrs"].get("href", "")]
    demo_noscript = [e for e in anchors
                     if any(a["tag"] == "noscript" for a in doc.ancestors(e))]
    demo_static = [e for e in anchors if e not in demo_noscript]
    demo_known = DEMO_URL.rstrip("/") in (html + (pj_path.read_text(encoding="utf-8")
                                                  if pj_path.is_file() else ""))
    if not demo_known:
        rep.fail("демо", f"ссылка на демо {DEMO_URL} нигде не найдена")
    elif demo_static or demo_noscript:
        where = "разметке" if demo_static else "<noscript>"
        rep.ok("демо", f"ссылка на демо доступна без JS (в {where})")
    else:
        rep.fail("демо", "ссылка на демо есть только в JS-данных: без JavaScript "
                         "посетитель её не получит")
    if not doc.with_tag("noscript"):
        rep.warn("без JS", "нет <noscript>: проверьте, что видно при отключённом JS")
    slot = re.search(r'<div[^>]*id="case-list"[^>]*>(.*?)</div>', html, re.S)
    placeholder = ""
    if slot:
        placeholder = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", slot.group(1))).strip()
    if placeholder and not doc.with_tag("noscript"):
        rep.fail("без JS", "в #case-list статический плейсхолдер без <noscript>-фолбэка")
    elif placeholder:
        rep.warn("без JS", f"без JS в #case-list останется «{placeholder[:90]}» рядом с "
                           "<noscript>; проверьте в Chrome, что это читается как фолбэк")
    return rep


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(
        description="Статическая проверка контракта cinematic-портфолио")
    ap.add_argument("root", nargs="?", default=str(DEFAULT_ROOT),
                    help="папка portfolio (по умолчанию — родитель qa_cinematic)")
    ap.add_argument("--strict", action="store_true", help="WARN считать нарушением")
    args = ap.parse_args(argv)
    root = Path(args.root).resolve()
    if not (root / "index.html").is_file():
        print(f"FAIL  корень: в {root} нет index.html")
        return 2

    print("Проверка контракта portfolio (статические файлы, не браузер)")
    print(f"Корень: {root}\n")
    rep = audit(root)
    width = max((len(k) for _, k, _ in rep.rows), default=10)
    for status, key, msg in rep.rows:
        print(f"{status:<4} {key:<{width}}  {msg}")
    print(f"\nИтог: PASS {rep.count(PASS)}, WARN {rep.count(WARN)}, FAIL {rep.count(FAIL)}")
    print("Статические проверки не подтверждают поведение в браузере: сцены, "
          "закрепление, reduced-motion и клавиатуру проверяйте в Chrome (REPORT.md).")
    bad = rep.count(FAIL) or (args.strict and rep.count(WARN))
    if bad:
        print("КОНТРАКТ НАРУШЕН")
        return 1
    print("КОНТРАКТ СОБЛЮДЁН (по статическим проверкам)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
