import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  use: {
    baseURL: "http://127.0.0.1:8000",
    // Developers can use their installed Chrome; CI installs Playwright's
    // pinned Chromium build for a reproducible deployment gate.
    channel: process.env.CI ? undefined : "chrome",
  },
  webServer: {
    command: "python web/serve.py",
    url: "http://127.0.0.1:8000",
    reuseExistingServer: !process.env.CI,
  },
});
