"""Focused hero contract + all local resource checks.
Run: skpy tools/check_portfolio.py [http://127.0.0.1:PORT/]
"""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote
from urllib.request import urlopen
import json
import re
import sys
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / 'index.html').read_text(encoding='utf-8')
CSS = (ROOT / 'hero.css').read_text(encoding='utf-8')
JS = (ROOT / 'workshop.js').read_text(encoding='utf-8')
BASE_URL = sys.argv.pop(1) if len(sys.argv) > 1 else None


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = []
        self.feed(HTML)

    def handle_starttag(self, tag, attributes):
        self.elements.append((tag, dict(attributes)))


DOCUMENT = Document()


def local_resources():
    resources = set()
    for tag, attrs in DOCUMENT.elements:
        key = 'href' if tag == 'link' else 'src'
        value = attrs.get(key, '')
        if value and not urlsplit(value).scheme:
            resources.add(urlsplit(value).path)
    for filename in ('workshop.css', 'hero.css'):
        text = (ROOT / filename).read_text(encoding='utf-8')
        for value in re.findall(r'url\([\"\']?([^\)\"\']+)', text):
            if not urlsplit(value).scheme and not unquote(value).startswith('#'):
                resources.add(value)
    return sorted(resources)


class PortfolioChecks(unittest.TestCase):
    def test_resources_are_self_contained(self):
        for resource in local_resources():
            with self.subTest(resource=resource):
                path = (ROOT / unquote(resource)).resolve()
                self.assertTrue(path.is_relative_to(ROOT))
                self.assertTrue(path.is_file(), resource)
                self.assertGreater(path.stat().st_size, 0)
                if path.suffix in ('.webp', '.png', '.jpg'):
                    with Image.open(path) as image:
                        image.verify()

    def test_hero_has_one_action_and_no_telegram(self):
        hero = HTML.split('<section class="hero"', 1)[1].split('</section>', 1)[0]
        links = re.findall(r'<a\b[^>]+href="([^"]+)"', hero)
        self.assertEqual(links, ['#work'])
        self.assertNotIn('Написать в Telegram', hero)
        self.assertEqual(hero.count('class="line-in"'), 2)
        self.assertIn('Это образцы, а не заказы клиентов', hero)
        layout = json.loads((ROOT / 'assets' / 'hero-layout.json').read_text(encoding='utf-8'))
        self.assertEqual(layout['text']['cta'], 'Потрогать стекло')
        self.assertIn('Два макета', layout['text']['facts'])

    def test_hero_frame_is_one_16_9_picture(self):
        """Сцена и фон — один кадр 16:9, иначе стойка уезжает с пола."""
        self.assertIn('aspect-ratio: 16 / 9', CSS)
        self.assertIn('min-height: 0', CSS)
        self.assertIn('hero.clientWidth / 1600', HTML)
        self.assertNotIn('window.innerHeight / 900', HTML)

    def test_real_screen_and_supplied_layers(self):
        for name in ('workshop', 'stand', 'glass', 'screen-main'):
            self.assertIn('assets/hero/' + name + '.webp', HTML)
        self.assertEqual(HTML.count('<figure class="exhibit-panel '), 1)
        self.assertNotIn('has-plate', HTML)
        self.assertNotIn('stage-canvas', HTML)
        self.assertNotIn('hero-plate-v3', HTML)
        # The main screen is the supplied screenshot, not a fake UI.
        for new, original in [('screen-main', 'lyublyu-hero')]:
            with Image.open(ROOT / 'assets' / 'hero' / (new + '.webp')) as image:
                with Image.open(ROOT.parent / 'ассеты' / (original + '.webp')) as source:
                    self.assertEqual(image.size, source.size)

    def test_anchor_destinations_and_contacts_preserved(self):
        ids = [attrs['id'] for _, attrs in DOCUMENT.elements if 'id' in attrs]
        self.assertEqual(len(ids), len(set(ids)))
        for tag, attrs in DOCUMENT.elements:
            href = attrs.get('href', '')
            if tag == 'a' and href.startswith('#'):
                self.assertIn(href[1:], ids)
        telegram = [a for t, a in DOCUMENT.elements if t == 'a' and a.get('href') == 'https://t.me/IOpaWho']
        self.assertEqual(len(telegram), 2)  # header + contact, not hero copy
        self.assertIn('tel:+79292322074', HTML)
        self.assertIn('https://yuriimasl.github.io/lyublyu-demo/', HTML)

    def test_motion_fallback_and_native_scrolling(self):
        self.assertIn('prefers-reduced-motion: reduce', JS)
        self.assertIn("range.addEventListener('input', paint)", JS)
        self.assertNotIn('Lenis', JS)
        self.assertNotIn('preventDefault', JS)
        self.assertNotIn('repeat: -1', JS)
        self.assertIn('@media (max-width: 560px)', CSS)
        self.assertIn('min-height: 44px', CSS)
        self.assertNotRegex(CSS, r'\.hero-copy\s*\{[^}]*opacity:\s*0')

    def test_smena_case_is_presented(self):
        self.assertIn('id="smena"', HTML)
        self.assertIn('href="cases/smena/"', HTML)
        self.assertIn('assets/smena-hero.webp', HTML)
        self.assertIn('assets/smena-mobile.webp', HTML)
        self.assertIn('два демо-макета', HTML)
        self.assertIn('Цветочный салон', HTML)
        self.assertIn('Кофейня и обжарка', HTML)
        self.assertIn('придуманы', HTML)

    def test_smena_case_files_exist(self):
        case = ROOT / 'cases' / 'smena'
        html = case / 'index.html'
        self.assertTrue(html.is_file(), html)
        self.assertGreater(html.stat().st_size, 0)
        text = html.read_text(encoding='utf-8')
        self.assertIn('<h1', text)
        self.assertIn('Смена', text)
        for rel in (
            'styles.css',
            'script.js',
            'assets/fonts/fonts.css',
            'assets/img/hero.jpg',
            'assets/img/bar2.jpg',
            'assets/img/table2.jpg',
        ):
            path = case / rel
            self.assertTrue(path.is_file(), path)
            self.assertGreater(path.stat().st_size, 0)
        for name, size in (('smena-hero.webp', (1430, 900)), ('smena-mobile.webp', (390, 844))):
            path = ROOT / 'assets' / name
            self.assertTrue(path.is_file(), path)
            with Image.open(path) as image:
                self.assertEqual(image.size, size)

    @unittest.skipUnless(BASE_URL, 'Pass the live preview URL to check HTTP resources')
    def test_http_all_resources(self):
        for resource in [''] + local_resources():
            with self.subTest(resource=resource):
                with urlopen(urljoin(BASE_URL, resource), timeout=8) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        print(f'HTTP resources: {len(local_resources()) + 1} OK')

    @unittest.skipUnless(BASE_URL, 'Pass the live preview URL to check HTTP resources')
    def test_smena_http(self):
        for rel in (
            'cases/smena/',
            'cases/smena/styles.css',
            'cases/smena/script.js',
            'cases/smena/assets/img/hero.jpg',
            'cases/smena/assets/img/bar2.jpg',
            'cases/smena/assets/img/table2.jpg',
        ):
            with self.subTest(rel=rel):
                with urlopen(urljoin(BASE_URL, rel), timeout=8) as response:
                    self.assertEqual(response.status, 200)
                    self.assertTrue(response.read())
        print('Smena HTTP resources: 6 OK')


if __name__ == '__main__':
    unittest.main(verbosity=2)
