"""Prepare the supplied hero layers. Run: skpy tools/build_hero_assets.py.
All coordinates are art-directed from the supplied reference, not inferred
from pixel colours. Source files in ../ассеты are never modified.
"""
from pathlib import Path
from collections import deque
from PIL import Image, ImageChops, ImageDraw, ImageEnhance

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / 'ассеты'
OUT = ROOT / 'assets' / 'hero'
OUT.mkdir(parents=True, exist_ok=True)


def save(image, name, quality=91):
    image.save(OUT / name, 'WEBP', quality=quality, method=6)
    print(name, image.size, (OUT / name).stat().st_size)


def remove_backdrop(image):
    """Remove a boundary-connected neutral white matte, keep interior whites."""
    image = image.convert('RGBA')
    width, height = image.size
    pixels = image.load()
    seen = bytearray(width * height)
    queue = deque((x, y) for x in range(width) for y in (0, height - 1))
    queue.extend((x, y) for y in range(height) for x in (0, width - 1))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index]:
            continue
        seen[index] = 1
        r, g, b, a = pixels[x, y]
        if min(r, g, b) < 224 or max(r, g, b) - min(r, g, b) > 18:
            continue
        pixels[x, y] = (r, g, b, 0)
        for xx, yy in ((x-1, y), (x+1, y), (x, y-1), (x, y+1)):
            if 0 <= xx < width and 0 <= yy < height:
                queue.append((xx, yy))
    return image


reference = Image.open(SOURCE / 'референс.png')
reference.thumbnail((1100, 690))
reference.save(ROOT / 'tools' / 'reference-preview.jpg', quality=95)
save(Image.open(SOURCE / 'фон.png').convert('RGB'), 'workshop.webp', 93)
# Isolate the frame from the full reference-sized transparent canvas.
stand = remove_backdrop(Image.open(SOURCE / 'стойка.png'))
save(stand.crop((330, 0, 1320, 992)), 'stand.webp', 95)
# The supplied texture contains two glass blanks. Preserve the glowing border.
glass = remove_backdrop(Image.open(SOURCE / 'стеклянные панели.png'))
save(glass.crop((0, 65, 1024, 765)), 'glass.webp', 94)
for source, target in [('lyublyu-hero.webp', 'screen-main.webp'),
                       ('lyublyu-shelf.webp', 'screen-catalog.webp')]:
    save(Image.open(SOURCE / source), target, 94)

# Remove ONLY the white background connected to the image boundary. Whites
# inside the phone are retained. This is asset editing, not visual analysis.
phone = Image.open(SOURCE / 'на айфоне.png').convert('RGBA')
w, h = phone.size
pixels = phone.load()
seen = bytearray(w * h)
queue = deque()
for x in range(w):
    queue.extend(((x, 0), (x, h - 1)))
for y in range(h):
    queue.extend(((0, y), (w - 1, y)))
while queue:
    x, y = queue.popleft()
    index = y * w + x
    if seen[index]:
        continue
    seen[index] = 1
    r, g, b, a = pixels[x, y]
    if min(r, g, b) < 237:
        continue
    pixels[x, y] = (r, g, b, 0)
    if x > 0:
        queue.append((x - 1, y))
    if x + 1 < w:
        queue.append((x + 1, y))
    if y > 0:
        queue.append((x, y - 1))
    if y + 1 < h:
        queue.append((x, y + 1))

# Map the real mobile screenshot onto the supplied phone, retaining its metal
# case, glass perimeter and camera island. The four points follow the screen.
quad = [(412, 132), (920, 93), (708, 1417), (165, 1374)]
source = Image.open(ROOT / 'assets' / 'lyublyu-mobile.webp').convert('RGBA')
sw, sh = source.size
# Solve the 8 perspective coefficients with Gaussian elimination (no numpy).
matrix = []
values = []
for (x, y), (u, v) in zip(quad, [(0, 0), (sw, 0), (sw, sh), (0, sh)]):
    matrix.extend([[x, y, 1, 0, 0, 0, -u*x, -u*y],
                   [0, 0, 0, x, y, 1, -v*x, -v*y]])
    values.extend([u, v])
rows = [row + [value] for row, value in zip(matrix, values)]
for column in range(8):
    pivot = max(range(column, 8), key=lambda row: abs(rows[row][column]))
    rows[column], rows[pivot] = rows[pivot], rows[column]
    divisor = rows[column][column]
    rows[column] = [value / divisor for value in rows[column]]
    for row in range(8):
        if row != column:
            factor = rows[row][column]
            rows[row] = [a - factor*b for a, b in zip(rows[row], rows[column])]
coefficients = [row[-1] for row in rows]
warped = source.transform(phone.size, Image.Transform.PERSPECTIVE,
                          coefficients, Image.Resampling.BICUBIC)
mask = Image.new('L', phone.size)
draw = ImageDraw.Draw(mask)
draw.polygon(quad, fill=255)
# Camera cutout remains above the new screen.
draw.rounded_rectangle((567, 123, 733, 189), radius=32, fill=0)
warped.putalpha(ImageChops.multiply(warped.getchannel('A'), mask))
phone = Image.alpha_composite(phone, warped)
phone = phone.crop((132, 58, 989, 1478))
phone.thumbnail((600, 1000), Image.Resampling.LANCZOS)
save(phone, 'phone.webp', 95)
print('Hero assets prepared; source images unchanged.')
