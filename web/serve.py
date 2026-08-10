"""Local static server for the DitDash web app.

Serves web/ over HTTP and shuts itself down when the browser sends a
beacon on tab/window close (see js/shutdown.js). This is a personal,
run-it-and-close-it dev server, not meant for production use.
"""
import http.server
import json
import os
import shutil
import socketserver
import sys
import tempfile
import threading
import urllib.request
import zipfile

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
REPO = "Screen4639/DitDash"


def apply_update(target_dir):
    """Download the latest GitHub release and copy its web/ folder over
    target_dir. Raises on any failure (network, bad zip, etc.) — the
    caller turns that into a 500 for the banner's "Update failed" state.
    """
    with urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/releases/latest", timeout=15) as resp:
        release = json.load(resp)
    with urllib.request.urlopen(release["zipball_url"], timeout=60) as resp:
        zip_bytes = resp.read()

    with tempfile.TemporaryDirectory() as tmp:
        zip_path = os.path.join(tmp, "release.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(tmp)

        # GitHub zipballs contain a single top-level "<owner>-<repo>-<sha>" folder.
        extracted_root = next(
            os.path.join(tmp, name) for name in os.listdir(tmp)
            if os.path.isdir(os.path.join(tmp, name))
        )
        new_web_dir = os.path.join(extracted_root, "web")
        for name in os.listdir(new_web_dir):
            src = os.path.join(new_web_dir, name)
            dst = os.path.join(target_dir, name)
            if os.path.isdir(src):
                shutil.rmtree(dst, ignore_errors=True)
                shutil.copytree(src, dst)
            else:
                shutil.copy2(src, dst)

    return release.get("tag_name", "")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_POST(self):
        if self.path == "/__shutdown":
            self.send_response(204)
            self.end_headers()
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        elif self.path == "/__update":
            self._handle_update()
        else:
            self.send_error(404)

    def _handle_update(self):
        try:
            tag = apply_update(DIRECTORY)
        except Exception as exc:
            body = str(exc).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        body = json.dumps({"version": tag}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # This is a dev server for source files that change between runs —
        # never let the browser cache them, or edits appear to "not work".
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("localhost", PORT), Handler) as httpd:
        print(f"Serving DitDash at http://localhost:{PORT}")
        httpd.serve_forever()
