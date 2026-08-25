import os
import sys
import tempfile
import unittest
from unittest import mock

import web_launcher


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

            self.assertEqual(actual, os.path.join(app_support, "DitDash", "web"))
            self.assertTrue(os.path.isfile(os.path.join(actual, "js", "version.js")))


class ServerTests(unittest.TestCase):
    def test_server_can_select_an_available_port(self):
        with web_launcher.Server(("localhost", 0), web_launcher.Handler) as server:
            self.assertGreater(server.server_address[1], 0)


if __name__ == "__main__":
    unittest.main()
