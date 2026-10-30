"""Structural regression: portfolio must not regress to a CSS-only document."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent


class Page(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.tags = []
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        self.tags.append((tag, dict(attrs)))


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        self.source = (ROOT / 'index.html').read_text(encoding='utf-8')
        self.page = Page(self.source)

    def test_real_content_not_placeholder(self):
        self.assertNotIn('<!--CONTENT-->', self.source)
        for tag in ('main', 'h1', 'nav', 'footer'):
            self.assertTrue(any(t == tag for t, _ in self.page.tags), tag)

    def test_local_resources_and_script_order(self):
        scripts = [a['src'] for t, a in self.page.tags if t == 'script' and 'src' in a]
        self.assertEqual(scripts, ['projects.js', 'portfolio.js'])
        for script in scripts:
            self.assertTrue((ROOT / script).is_file(), script)
        self.assertTrue((ROOT / 'assets/lyublyu-hero.webp').is_file())

    def test_owner_photo_is_connected(self):
        photos = [a for t, a in self.page.tags
                  if t == 'img' and 'profile-photo' in a.get('class', '').split()]
        self.assertEqual(len(photos), 1)
        photo = photos[0]
        self.assertEqual(photo.get('src'), 'w2K7lKvhrwA.jpg')
        self.assertTrue((ROOT / photo['src']).is_file())
        self.assertTrue(photo.get('alt', '').strip())
        self.assertNotIn('class="profile-monogram"', self.source)

    def test_navigation_targets_exist(self):
        ids = [a['id'] for _, a in self.page.tags if 'id' in a]
        self.assertEqual(len(ids), len(set(ids)), 'Duplicate IDs')
        for tag, attrs in self.page.tags:
            href = attrs.get('href', '')
            if tag == 'a' and href.startswith('#'):
                self.assertIn(href[1:], ids)
        for target in ('case-list', 'contact-slot'):
            self.assertIn(target, ids)

    def test_data_contract_and_accessibility(self):
        renderer = (ROOT / 'portfolio.js').read_text(encoding='utf-8')
        self.assertIn('window.PORTFOLIO_DATA', renderer)
        self.assertNotIn('innerHTML', renderer)
        self.assertIn('prefers-reduced-motion', self.source)
        self.assertIn('<noscript>', self.source)


if __name__ == '__main__':
    unittest.main(verbosity=2)
