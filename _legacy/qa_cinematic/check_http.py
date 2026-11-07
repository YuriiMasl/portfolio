"""HTTP resource smoke check; does not execute JS or prove browser rendering."""
import sys
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import urlopen


class Resources(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag in ('script', 'img') and attrs.get('src'):
            self.urls.add(attrs['src'])
        if tag == 'link' and attrs.get('rel') == 'stylesheet':
            self.urls.add(attrs['href'])


def main():
    base = sys.argv[1]
    with urlopen(base, timeout=10) as response:
        assert response.status == 200
        html = response.read().decode('utf-8')
    parser = Resources()
    parser.feed(html)
    assert len(parser.urls) >= 8, 'Missing expected local resources'
    for path in sorted(parser.urls):
        url = urljoin(base, path)
        assert urlparse(url).netloc == urlparse(base).netloc
        with urlopen(url, timeout=10) as response:
            data = response.read()
            assert response.status == 200 and data, path
            mime = response.headers.get_content_type()
            if path.endswith('.webp'):
                assert data[:4] == b'RIFF' and data[8:12] == b'WEBP', path
                if mime == 'application/octet-stream':
                    print('WARN Windows http.server serves WebP as octet-stream; valid WebP signature')
                else:
                    assert mime == 'image/webp', (path, mime)
            elif path.endswith('.jpg'):
                assert mime == 'image/jpeg' and data[:2] == b'\xff\xd8', (path, mime)
            elif path.endswith('.css'):
                assert mime == 'text/css', (path, mime)
            elif path.endswith('.js'):
                assert 'javascript' in mime, (path, mime)
            print(f'PASS {path}: HTTP 200; {mime}; {len(data)} bytes')
    print('PASS HTTP resources. NOT CHECKED: JavaScript execution or visual layout.')


if __name__ == '__main__':
    main()
