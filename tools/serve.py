"""Local static preview, loopback only, chooses a free port."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

root = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
print(f'Portfolio preview: http://127.0.0.1:{server.server_port}/', flush=True)
server.serve_forever()
