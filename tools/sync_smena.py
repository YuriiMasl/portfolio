"""Скопировать публичные файлы site_smena в cases/smena.

Источник: ../../site_smena (рядом с папкой _gh).
Не копируются .impeccable, PRODUCT.md, DESIGN.md, README.md.
"""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]          # _gh/portfolio
SRC = ROOT.parent.parent / 'site_smena'            # Цветочные магазины/site_smena
DST = ROOT / 'cases' / 'smena'

FILES = ('index.html', 'styles.css', 'script.js')
DIRS = ('assets/fonts', 'assets/img')

if not (SRC / 'index.html').is_file():
    raise SystemExit(f'Нет исходника: {SRC}')

if DST.exists():
    shutil.rmtree(DST)
DST.mkdir(parents=True)

for name in FILES:
    shutil.copy2(SRC / name, DST / name)
for rel in DIRS:
    shutil.copytree(SRC / rel, DST / rel)

print(f'Synced {len(FILES)} files + {len(DIRS)} dirs -> {DST}')
