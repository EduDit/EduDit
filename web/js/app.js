// Entry point: owns app-wide state (audio player, active profile) and
// switches between screens, mirroring main.py's DitDashApp.

import { AudioPlayer } from "./audio.js";
import * as storage from "./storage.js";
import { ProfileSelect } from "./profileSelect.js";

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

    this.show(ProfileSelect);
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
