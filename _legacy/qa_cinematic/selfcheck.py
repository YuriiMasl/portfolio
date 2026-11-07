"""Самопроверка check_contract.py на синтетических фикстурах (stdlib, tempdir).

Не трогает проектные файлы: собирает эталонную «хорошую» страницу во временной
папке, убеждается, что проверка не даёт FAIL, затем по одной ломает контракт и
требует конкретного FAIL. Запуск:
    py portfolio/qa_cinematic/selfcheck.py
Код выхода 0 — все мутации пойманы, 1 — проверка не заметила поломку.
"""
from __future__ import annotations

import contextlib
import io
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_contract as cc  # noqa: E402

SECTIONS = ["hero", "services", "cases", "about", "contact"]

HTML = """<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Фикстура</title>
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="cinematic.css">
</head><body>
<main>
{body}
</main>
<script src="projects.js" defer></script>
<script src="portfolio.js" defer></script>
<script src="vendor/gsap.min.js" defer></script>
<script src="vendor/ScrollTrigger.min.js" defer></script>
<script src="cinematic.js" defer></script>
</body></html>
"""

SCENE = """<section id="{sid}" class="cinematic-scene"><div class="scene-inner">
<h2 data-reveal>{sid}</h2>{extra}</div></section>"""

EXTRA = {
    "cases": '<div id="case-list" aria-live="polite"></div>'
             '<noscript><a href="https://yuriimasl.github.io/lyublyu-demo/">'
             'демо-макет</a></noscript>',
    "about": '<img class="profile-photo" src="w2K7lKvhrwA.jpg" alt="Юрий">',
    "hero": '<p data-parallax data-reveal>Первый экран</p>',
}

CSS = """[data-reveal]{opacity:1}
.scene-inner{position:relative}
.case-card{display:grid}
@media (prefers-reduced-motion: reduce){
  [data-reveal]{opacity:1!important}
}
"""

JS = """(function () {
  'use strict';
  function init() {
    if (!window.gsap || !window.ScrollTrigger) { return; }
    window.gsap.registerPlugin(window.ScrollTrigger);
    var mm = window.gsap.matchMedia();
    mm.add('(min-width: 768px)', function () {
      return window.gsap.timeline({ scrollTrigger: { trigger: '.cinematic-scene' } });
    });
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
    document.addEventListener('portfolio:ready', function () {
      window.ScrollTrigger.refresh();
    });
  }
  document.addEventListener('DOMContentLoaded', init);
}());
"""

PORTFOLIO_JS = """var node = document.createElement('p');
node.className = 'case-card';
node.textContent = 'ok';
document.dispatchEvent(new CustomEvent('portfolio:ready'));
"""

PROJECTS_JS = """window.PORTFOLIO_DATA = {
  projects: [{
    title: "Кейс", category: "категория", description: "описание",
    image: "shot.webp", imageAlt: "скриншот",
    href: "https://yuriimasl.github.io/lyublyu-demo/", linkLabel: "Демо"
  }],
  contact: { label: "", href: "" }
};
"""


def build(root: Path) -> None:
    body = "\n".join(SCENE.format(sid=s, extra=EXTRA.get(s, "")) for s in SECTIONS)
    files = {
        "index.html": HTML.format(body=body),
        "base.css": "body{margin:0}\n",
        "cinematic.css": CSS,
        "cinematic.js": JS,
        "portfolio.js": PORTFOLIO_JS,
        "projects.js": PROJECTS_JS,
        "vendor/gsap.min.js": "/* gsap */\n" + "var gsap=1;\n" * 2000,
        "vendor/ScrollTrigger.min.js": "/* ScrollTrigger */\n" + "var st=1;\n" * 2000,
    }
    for rel, text in files.items():
        path = root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
    (root / "w2K7lKvhrwA.jpg").write_bytes(b"\xff\xd8\xff\xe0demo")
    (root / "shot.webp").write_bytes(b"RIFFdemo")


def fail_text(root: Path) -> str:
    rep = cc.audit(root)
    return " | ".join(f"{k}: {m}" for _, k, m in rep.fails())


def exit_code(root: Path) -> tuple[int, str]:
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        code = cc.main([str(root)])
    return code, buf.getvalue()


def mutate(root: Path, kind: str) -> None:
    def edit(rel: str, old: str, new: str) -> None:
        p = root / rel
        p.write_text(p.read_text(encoding="utf-8").replace(old, new), encoding="utf-8")

    if kind == "missing-lib":
        (root / "vendor/gsap.min.js").unlink()
    elif kind == "wrong-order":
        edit("index.html", '<script src="portfolio.js" defer></script>\n'
                            '<script src="vendor/gsap.min.js" defer></script>',
             '<script src="vendor/gsap.min.js" defer></script>\n'
             '<script src="portfolio.js" defer></script>')
    elif kind == "no-defer":
        edit("index.html", '<script src="cinematic.js" defer>', '<script src="cinematic.js">')
    elif kind == "photo":
        (root / "w2K7lKvhrwA.jpg").unlink()
    elif kind == "demo":
        edit("index.html", "https://yuriimasl.github.io/lyublyu-demo/", "https://example.com/")
        edit("projects.js", "https://yuriimasl.github.io/lyublyu-demo/", "https://example.com/")
    elif kind == "reduce":
        edit("cinematic.css", "@media (prefers-reduced-motion: reduce){", "@media (max-width: 1px){")
        edit("cinematic.css", "prefers-reduced-motion: reduce", "max-width: 1px")
    elif kind == "guard":
        edit("cinematic.js", "if (!window.gsap || !window.ScrollTrigger) { return; }", "")
    elif kind == "hide":
        edit("cinematic.css", "[data-reveal]{opacity:1}", "[data-reveal]{opacity:0}")
    elif kind == "remote":
        edit("index.html", 'src="vendor/gsap.min.js"',
             'src="https://cdn.jsdelivr.net/npm/gsap@3/gsap.min.js"')
    elif kind == "scene":
        edit("index.html", '<section id="about" class="cinematic-scene">',
             '<div id="about">')
    else:
        raise SystemExit(f"неизвестная мутация {kind}")


CASES = [
    ("missing-lib", "gsap.min.js"),
    ("wrong-order", "позиция"),
    ("no-defer", "без defer"),
    ("photo", "фото"),
    ("demo", "демо"),
    ("reduce", "reduced-motion"),
    ("guard", "защит"),
    ("hide", "видимость"),
    ("remote", "внешние"),
    ("scene", "секции"),
]


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    with tempfile.TemporaryDirectory(prefix="qa_cinematic_") as tmp:
        base = Path(tmp) / "good"
        base.mkdir()
        build(base)
        ok = fail_text(base)
        if ok:
            print("FAIL  эталонная фикстура не проходит проверку:", ok)
            return 1
        print("PASS  эталонная фикстура проходит без FAIL")
        code, out = exit_code(base)
        if code == 0 and not re.search(r"(?m)^FAIL\b", out):
            print("PASS  эталон: код выхода 0 и ни одного FAIL в выводе")
        else:
            print(f"FAIL  эталон: код выхода {code}, "
                  f"строк FAIL: {len(re.findall(r'(?m)^FAIL', out))}")
            return 1

    failed = 0
    for kind, needle in CASES:
        with tempfile.TemporaryDirectory(prefix=f"qa_{kind}_") as tmp:
            root = Path(tmp) / "portfolio"
            root.mkdir()
            build(root)
            mutate(root, kind)
            text = fail_text(root)
            if needle.lower() in text.lower():
                print(f"PASS  поломка «{kind}» обнаружена: {text[:110]}")
            else:
                print(f"FAIL  поломка «{kind}» НЕ обнаружена (FAIL: {text or 'нет'})")
                failed += 1
    print(f"\nМутации пойманы: {len(CASES) - failed}/{len(CASES)}")
    with tempfile.TemporaryDirectory(prefix="qa_exit_") as tmp:
        root = Path(tmp) / "portfolio"
        root.mkdir()
        build(root)
        mutate(root, "wrong-order")
        code, out = exit_code(root)
        if code != 0 and re.search(r"(?m)^FAIL\b", out):
            print(f"PASS  поломка: код выхода {code}, в выводе есть строка FAIL")
        else:
            print(f"FAIL  поломка: код выхода {code}, "
                  f"строк FAIL: {len(re.findall(r'(?m)^FAIL', out))}")
            failed += 1
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
