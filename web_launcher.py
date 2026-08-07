"""Standalone launcher for the DitDash web app.

Serves web/ locally and opens it in the default browser, same as
web/serve.py, but built into a single .exe via build_web_exe.bat so the
target machine needs no Python install of its own.
"""
import http.server
import os
import socketserver
import sys
import threading
import webbrowser

PORT = 8000


def _web_dir():
    if getattr(sys, "frozen", False):
        return os.path.join(sys._MEIPASS, "web")
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=_web_dir(), **kwargs)

    def do_POST(self):
        if self.path == "/__shutdown":
            self.send_response(204)
            self.end_headers()
            threading.Thread(target=self.server.shutdown, daemon=True).start()
        else:
            self.send_error(404)

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
