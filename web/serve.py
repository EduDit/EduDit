"""Local static server for the DitDash web app.

Serves web/ over HTTP and shuts itself down when the browser sends a
beacon on tab/window close (see js/shutdown.js). This is a personal,
run-it-and-close-it dev server, not meant for production use.
"""
import http.server
import os
import socketserver
import sys
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

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


if __name__ == "__main__":
    with Server(("localhost", PORT), Handler) as httpd:
        print(f"Serving DitDash at http://localhost:{PORT}")
        httpd.serve_forever()
