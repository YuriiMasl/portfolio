"""Make a single visual contact sheet; originals are never modified."""
from pathlib import Path
from PIL import Image, ImageOps, ImageDraw
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'ассеты'
canvas = Image.new('RGB', (2000, 1420), '#ddd8d0')
draw = ImageDraw.Draw(canvas)
for name, rect in [
    ('референс.png', (0, 30, 1400, 900)),
    ('стойка.png', (0, 940, 800, 500)),
    ('стеклянные панели.png', (1420, 30, 560, 840)),
]:
    image = Image.open(SOURCE / name)
    print(name, image.size, image.mode)
    image = ImageOps.contain(image.convert('RGB'), (rect[2], rect[3]))
    canvas.paste(image, (rect[0], rect[1]))
    draw.text((rect[0] + 8, rect[1] - 22), name, fill='#111')
output = ROOT / 'tools' / 'source-sheet.jpg'
canvas.save(output, quality=94)
print(sys.version)
print(output)
