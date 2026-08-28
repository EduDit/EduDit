"""Local static server for the EduDit web app.

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

DIRECTORY = os.path.dirname(os.path.abspath(__file__))
REPO = "EduDit/EduDit"

# A reload also fires the "tab closing" beacon (see js/shutdown.js) — the
# unloading page has no reliable way to tell "I'm about to reload" from "I'm
# closing for good" apart from timing. So a shutdown request doesn't shut
# down immediately: it waits this long, and any other request arriving in
# the meantime (e.g. the reloaded page re-requesting index.html) cancels it.
SHUTDOWN_GRACE_SECONDS = 1.5


def apply_update(target_dir):
    """Download the latest GitHub release and copy its web/ folder over
    target_dir. Raises on any failure (network, bad zip, etc.) — the
    caller turns that into a 500 for the banner's "Update failed" state.
    """
    with urllib.request.urlopen(f"https://api.github.com/repos/{REPO}/releases/latest", timeout=15) as resp:
        release = json.load(resp)
    with urllib.request.urlopen(release["zipball_url"], timeout=60) as resp:
        zip_bytes = resp.read()

    target_dir = os.path.abspath(target_dir)
    target_parent = os.path.dirname(target_dir)
    with tempfile.TemporaryDirectory(dir=target_parent) as tmp:
        zip_path = os.path.join(tmp, "release.zip")
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path) as zf:
            safe_root = os.path.realpath(tmp) + os.sep
            for member in zf.infolist():
                destination = os.path.realpath(os.path.join(tmp, member.filename))
                if not destination.startswith(safe_root):
                    raise ValueError("Update archive contains an unsafe path")
            zf.extractall(tmp)

        # GitHub zipballs contain a single top-level "<owner>-<repo>-<sha>" folder.
        extracted_root = next(
            os.path.join(tmp, name) for name in os.listdir(tmp)
            if os.path.isdir(os.path.join(tmp, name))
        )
        new_web_dir = os.path.join(extracted_root, "web")
        required = ("index.html", "styles.css", os.path.join("js", "app.js"))
        if not os.path.isdir(new_web_dir) or any(not os.path.isfile(os.path.join(new_web_dir, path)) for path in required):
            raise ValueError("Update archive does not contain a complete web app")

        stage_dir = tempfile.mkdtemp(prefix="edudit-stage-", dir=target_parent)
        backup_dir = tempfile.mkdtemp(prefix="edudit-backup-", dir=target_parent)
        os.rmdir(stage_dir)
        os.rmdir(backup_dir)
        shutil.copytree(new_web_dir, stage_dir)
        moved_current = False
        try:
            os.replace(target_dir, backup_dir)
            moved_current = True
            os.replace(stage_dir, target_dir)
        except Exception:
            if moved_current and not os.path.exists(target_dir):
                os.replace(backup_dir, target_dir)
            raise
        finally:
            if os.path.exists(stage_dir):
                shutil.rmtree(stage_dir, ignore_errors=True)
            if os.path.exists(backup_dir):
                shutil.rmtree(backup_dir, ignore_errors=True)

    return release.get("tag_name", "")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        self._cancel_shutdown()
        super().do_GET()

    def do_HEAD(self):
        self._cancel_shutdown()
        super().do_HEAD()

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

    def _schedule_shutdown(self):
        self._cancel_shutdown()
        timer = threading.Timer(
            SHUTDOWN_GRACE_SECONDS,
            lambda: threading.Thread(target=self.server.shutdown, daemon=True).start(),
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
    shutdown_timer = None


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    with Server(("localhost", port), Handler) as httpd:
        print(f"Serving EduDit at http://localhost:{port}")
        httpd.serve_forever()
