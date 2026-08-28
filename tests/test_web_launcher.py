import os
import sys
import tempfile
import unittest
from unittest import mock

import web_launcher
from web import serve


class WebDirectoryTests(unittest.TestCase):
    def test_source_checkout_uses_repo_web_directory(self):
        with mock.patch.object(sys, "frozen", False, create=True):
            expected = os.path.join(os.path.dirname(web_launcher.__file__), "web")
            self.assertEqual(web_launcher._web_dir(), expected)

    def test_frozen_macos_uses_application_support(self):
        with tempfile.TemporaryDirectory() as bundled_root:
            bundled_web = os.path.join(bundled_root, "web")
            os.makedirs(os.path.join(bundled_web, "js"))
            with open(
                os.path.join(bundled_web, "js", "version.js"),
                "w",
                encoding="utf-8",
            ) as version_file:
                version_file.write('export const APP_VERSION = "1.0.0";')

            app_support = os.path.join(bundled_root, "Application Support")
            with (
                mock.patch.object(sys, "frozen", True, create=True),
                mock.patch.object(sys, "_MEIPASS", bundled_root, create=True),
                mock.patch.object(sys, "platform", "darwin"),
                mock.patch("os.path.expanduser", return_value=app_support),
            ):
                actual = web_launcher._web_dir()

            self.assertEqual(actual, os.path.join(app_support, "EduDit", "web"))
            self.assertTrue(os.path.isfile(os.path.join(actual, "js", "version.js")))


class ServerTests(unittest.TestCase):
    def test_server_can_select_an_available_port(self):
        with web_launcher.Server(("localhost", 0), web_launcher.Handler) as server:
            self.assertGreater(server.server_address[1], 0)


class UpdateTests(unittest.TestCase):
    def test_update_replaces_complete_app_and_removes_stale_files(self):
        with tempfile.TemporaryDirectory() as root:
            target = os.path.join(root, "web")
            os.makedirs(os.path.join(target, "js"))
            with open(os.path.join(target, "stale.txt"), "w", encoding="utf-8") as f:
                f.write("old")

            archive_root = os.path.join(root, "release", "EduDit-EduDit-sha", "web")
            os.makedirs(os.path.join(archive_root, "js"))
            for relative, content in (("index.html", "new"), ("styles.css", "css"), (os.path.join("js", "app.js"), "js")):
                with open(os.path.join(archive_root, relative), "w", encoding="utf-8") as f:
                    f.write(content)

            import io
            import json
            import zipfile

            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, "w") as zf:
                for current, _, names in os.walk(os.path.join(root, "release")):
                    for name in names:
                        path = os.path.join(current, name)
                        zf.write(path, os.path.relpath(path, os.path.join(root, "release")))
            responses = [io.BytesIO(json.dumps({"zipball_url": "https://example/update.zip", "tag_name": "v9.9.9"}).encode()), io.BytesIO(zip_buffer.getvalue())]
            with mock.patch("urllib.request.urlopen", side_effect=responses):
                version = serve.apply_update(target)

            self.assertEqual(version, "v9.9.9")
            with open(os.path.join(target, "index.html"), encoding="utf-8") as updated_index:
                self.assertEqual(updated_index.read(), "new")
            self.assertFalse(os.path.exists(os.path.join(target, "stale.txt")))


if __name__ == "__main__":
    unittest.main()
