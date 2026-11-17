#!/usr/bin/env python3
"""Проверка перед коммитом: ловит те же ошибки, что мы уже ловили руками.

Запуск:  python tools/selfcheck.py
Код возврата 1, если есть блокирующие замечания — тогда коммит не проходит.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_FILES = [p for p in ROOT.glob("*.html")]
BLOCK: list[str] = []
WARN: list[str] = []


def block(msg: str) -> None:
    BLOCK.append(msg)


def warn(msg: str) -> None:
    WARN.append(msg)


def check_html(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    name = path.name

    # 1. Телефон в ссылке: только плюс и цифры, без звёздочек и пробелов.
    for href in re.findall(r'href="(tel:[^"]*)"', text):
        number = href[4:]
        if not re.fullmatch(r"\+?\d{10,15}", number):
            block(f"{name}: телефон в ссылке испорчен — {href}")

    # 2. Картинки без alt — скринридер и поиск их не увидят.
    for tag in re.findall(r"<img\b[^>]*>", text):
        if "alt=" not in tag:
            block(f"{name}: <img> без alt — {tag[:70]}")

    # 3. Ссылки на локальные файлы должны существовать.
    for src in re.findall(r'(?:src|href)="(?!https?:|//|#|tel:|mailto:)([^"?]+)', text):
        if src.startswith(("data:", "about:", "blob:", "javascript:")):
            continue
        target = (path.parent / src).resolve()
        if not target.exists() and not src.endswith("/"):
            block(f"{name}: файла нет — {src}")

    # 4. Незакрытые заготовки в продакшене.
    for marker in ("TODO", "FIXME", "XXX", "lorem ipsum"):
        if marker.lower() in text.lower():
            warn(f"{name}: осталось «{marker}»")

    # 5. Один h1 на страницу.
    h1 = len(re.findall(r"<h1\b", text))
    if h1 != 1:
        warn(f"{name}: заголовков h1 — {h1}, ожидался один")

    # 6. Абсолютный http:// — блокируется браузером на https-странице.
    for link in re.findall(r'(?:src|href)="(http://[^"]+)"', text):
        block(f"{name}: http:// вместо https:// — {link}")

    # 7. Кеш-версия у своих стилей и скриптов.
    for tag in re.findall(r'<(?:link|script)\b[^>]*(?:href|src)="([^"]+\.(?:css|js))"', text):
        if "?v=" not in tag:
            warn(f"{name}: без версии в ссылке (кеш) — {tag}")


def check_json() -> None:
    for path in ROOT.rglob("*.json"):
        if any(part in {"node_modules", "graphify-out", ".git"} for part in path.parts):
            continue
        try:
            json.loads(path.read_text(encoding="utf-8-sig"))
        except Exception as exc:  # noqa: BLE001
            block(f"{path.relative_to(ROOT)}: битый JSON — {exc}")

    layout = ROOT / "assets" / "hero-layout.json"
    if layout.exists():
        data = json.loads(layout.read_text(encoding="utf-8-sig"))
        for layer in ("exhibit", "main"):
            if layer not in data:
                block(f"hero-layout.json: нет слоя «{layer}»")
                continue
            anchor = data[layer]
            if not any(isinstance(anchor.get(k), (int, float)) for k in ("top", "bottom")):
                warn(f"hero-layout.json: у слоя «{layer}» нет top или bottom")


def check_assets() -> None:
    heavy = [
        p for p in (ROOT / "assets").rglob("*")
        if p.is_file() and p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and p.stat().st_size > 400_000
    ]
    for p in heavy:
        warn(f"{p.relative_to(ROOT)}: {p.stat().st_size // 1024} КБ — стоит сжать")


def main() -> int:
    for path in HTML_FILES:
        check_html(path)
    check_json()
    check_assets()

    for line in BLOCK:
        print(f"БЛОК  {line}")
    for line in WARN:
        print(f"совет {line}")
    if not BLOCK and not WARN:
        print("чисто")
    print(f"\nитог: блокирующих {len(BLOCK)}, советов {len(WARN)}")
    return 1 if BLOCK else 0


if __name__ == "__main__":
    sys.exit(main())
