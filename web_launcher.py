"""Standalone launcher for the DitDash web app.

Serves web/ locally and opens it in the default browser, same as web/serve.py.
It can be packaged as a Windows executable or a macOS application so the
target machine needs no Python installation of its own.
"""
import http.server
import json
import os
import re
import shutil
import socketserver
import sys
import tempfile
import threading
import urllib.request
import webbrowser
import zipfile

REPO = "Screen4639/DitDash"
SHUTDOWN_GRACE_SECONDS = 1.5


def _read_version(web_root):
    try:
        with open(os.path.join(web_root, "js", "version.js"), encoding="utf-8") as f:
            m = re.search(r'APP_VERSION\s*=\s*"([^"]+)"', f.read())
    except OSError:
        return []
    return [int(n) for n in re.findall(r"\d+", m.group(1))] if m else []


def _web_dir():
    if getattr(sys, "frozen", False):
        # --onefile re-extracts bundled data to a fresh temp folder on every
        # launch, so a self-update written there wouldn't survive a
        # relaunch. Keep a persistent copy next to the exe instead, seeded
        # from the bundled copy the first time the app runs.
        bundled = os.path.join(sys._MEIPASS, "web")
        if sys.platform == "darwin":
            # A macOS .app bundle is commonly installed in /Applications and
            # must be treated as read-only. Keep the updateable web assets in
            # the conventional per-user Application Support directory.
            persistent = os.path.join(
                os.path.expanduser("~/Library/Application Support"),
                "DitDash",
                "web",
            )
        else:
            persistent = os.path.join(
                os.path.dirname(sys.executable), "DitDashWeb_app"
            )
        if not os.path.isdir(persistent):
            shutil.copytree(bundled, persistent)
        elif _read_version(bundled) > _read_version(persistent):
            # The packaged app was replaced with a newer build since the persistent
            # copy was seeded (e.g. a fresh release replacing an older
            # copy was created — reseed so js modules can't end
            # up mismatched. Only reseed forward: an in-app self-update can
            # leave the persistent copy newer than this exe's bundle, and
            # that must not be clobbered.
            shutil.rmtree(persistent)
            shutil.copytree(bundled, persistent)
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
            self._schedule_shutdown()
        elif self.path == "/__update":
            self._cancel_shutdown()
            self._handle_update()
        else:
            self.send_error(404)

    def do_GET(self):
        self._cancel_shutdown()
        super().do_GET()

    def do_HEAD(self):
        self._cancel_shutdown()
        super().do_HEAD()

    def _schedule_shutdown(self):
        self._cancel_shutdown()
        timer = threading.Timer(
            SHUTDOWN_GRACE_SECONDS,
            lambda: threading.Thread(
                target=self.server.shutdown, daemon=True
            ).start(),
        )
        timer.daemon = True
        self.server.shutdown_timer = timer
        timer.start()

    def _cancel_shutdown(self):
        timer = getattr(self.server, "shutdown_timer", None)
        if timer:
            timer.cancel()
            self.server.shutdown_timer = None

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
    shutdown_timer = None


def main():
    # Port 0 asks the OS for a free port, avoiding a startup failure when
    # another local program already owns the old fixed port 8000.
    with Server(("localhost", 0), Handler) as httpd:
        port = httpd.server_address[1]
        webbrowser.open(f"http://localhost:{port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()
