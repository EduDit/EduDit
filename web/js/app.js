// Entry point: owns app-wide state (audio player, active profile) and
// switches between screens, mirroring main.py's DitDashApp.

import { AudioPlayer } from "./audio.js";
import * as storage from "./storage.js";
import { ProfileSelect } from "./profileSelect.js";
import { checkForUpdate, showUpdateBanner } from "./updateCheck.js";

class App {
  constructor(root) {
    this.root = root;
    this.audio = new AudioPlayer();
    this.profileName = null;
    this.profile = null;
    this._view = null;

    // Prime the AudioContext on the first tap/click/keypress anywhere, so a
    // Bluetooth headset has already woken up by the time a real tone plays.
    const primeAudio = () => this.audio.warmUp();
    document.addEventListener("pointerdown", primeAudio, { once: true });
    document.addEventListener("keydown", primeAudio, { once: true });

    this._applyTheme();
    this.show(ProfileSelect);
    checkForUpdate().then((info) => info && showUpdateBanner(info));

    // Global Esc-to-go-back and "?"-for-shortcuts-help, so every screen gets
    // both for free from one place instead of each wiring its own. Both
    // share the same guard: skipped while typing in a text field, while a
    // dialog.js/shortcutsHelp.js overlay is open (checked directly since
    // it's a same-phase document listener too — added after this one, so it
    // would otherwise fire second and too late to stop this from also
    // firing), and naturally skipped during Settings' key-rebind capture
    // (that one uses a capture-phase listener and calls preventDefault()
    // first, which always runs before this bubble-phase listener regardless
    // of add order).
    document.addEventListener("keydown", (e) => {
      if (e.defaultPrevented) return;
      if (e.key !== "Escape" && e.key !== "?") return;
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (document.querySelector(".dialog-overlay")) return;

      if (e.key === "Escape") {
        if (this._view && typeof this._view.goBack === "function") this._view.goBack();
      } else {
        import("./shortcutsHelp.js").then((m) => m.showShortcutsHelp(this));
      }
    });
  }

  show(ViewClass, options) {
    if (this._view && typeof this._view.destroy === "function") {
      this._view.destroy();
    }
    this.root.innerHTML = "";
    this._view = new ViewClass(this.root, this, options);
  }

  loadProfile(name) {
    this.profileName = name;
    this.profile = storage.loadProfile(name);
    this._syncKeepAwake();
  }

  saveProfile() {
    storage.saveProfile(this.profileName, this.profile);
  }

  setTheme(theme) {
    storage.setTheme(theme);
    this._applyTheme();
  }

  _applyTheme() {
    const theme = storage.getTheme();
    if (theme === "light" || theme === "dark") {
      document.documentElement.dataset.theme = theme;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }

  setKeepAwake(enabled) {
    if (!this.profile) return;
    this.profile.settings.keepAwake = enabled;
    this.saveProfile();
    this._syncKeepAwake();
  }

  _syncKeepAwake() {
    if (this.profile && this.profile.settings.keepAwake) {
      this.audio.startKeepAlive();
    } else {
      this.audio.stopKeepAlive();
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new App(document.getElementById("app"));
});
