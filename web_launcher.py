"""Standalone launcher for the DitDash web app.

Serves web/ locally and opens it in the default browser, same as
web/serve.py, but built into a single .exe via build_web_exe.bat so the
target machine needs no Python install of its own.
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
import webbrowser
import zipfile

PORT = 8000
REPO = "Screen4639/DitDash"


def _web_dir():
    if getattr(sys, "frozen", False):
        # --onefile re-extracts bundled data to a fresh temp folder on every
        # launch, so a self-update written there wouldn't survive a
        # relaunch. Keep a persistent copy next to the exe instead, seeded
        # from the bundled copy the first time the app runs.
        persistent = os.path.join(os.path.dirname(sys.executable), "DitDashWeb_app")
        if not os.path.isdir(persistent):
            shutil.copytree(os.path.join(sys._MEIPASS, "web"), persistent)
        return persistent
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


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
        super().__init__(*args, directory=_web_dir(), **kwargs)

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
            tag = apply_update(_web_dir())
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
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    with Server(("localhost", PORT), Handler) as httpd:
        webbrowser.open(f"http://localhost:{PORT}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
