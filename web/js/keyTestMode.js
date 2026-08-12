// Test Key Mode: press the physical key/paddle and see DitDash recognize
// it — a diagnostic tool, separate from actual learning. Built on the same
// mountLiveKeyingUI() as Free Keying (see liveKeyDecoder.js), just with the
// key-state readout and Input Monitor turned on — no duplicated decode/UI
// logic, only a second navigation entry point for a setup/troubleshooting
// context (reached from Settings' Key Input panel and from Calibration's
// results screen) rather than a practice context.

import { el, button, pageHeader } from "./dom.js";
import { alertDialog, confirmDialog } from "./dialog.js";
import { createMorseInput } from "./morseInput/morseInput.js";

export class KeyTestMode {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.morseInput = createMorseInput(app.profile.settings);
    this.handle = null;
    this._build();
    this._start();
  }

  _build() {
    const wrap = el("div", { class: "screen view-focused" });
    wrap.appendChild(
      pageHeader({
        eyebrow: "Key Input",
        title: "Test Key Mode",
        actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Press your physical key/paddle — this never affects your scores or learning progress.",
      })
    );
    this.mount = el("div", {});
    wrap.appendChild(this.mount);
    this.root.innerHTML = "";
    this.root.appendChild(wrap);
  }

  async _start() {
    try {
      await this.morseInput.start();
    } catch (err) {
      await this._handleError(err);
      return;
    }
    const m = await import("./liveKeyDecoder.js");
    this.handle = m.mountLiveKeyingUI(this.mount, this.app, this.morseInput, {
      showMonitor: true,
      showKeyState: true,
    });
  }

  async _handleError(err) {
    if (err && err.code === "NEEDS_CALIBRATION") {
      const go = await confirmDialog("Audio key input hasn't been calibrated yet. Calibrate now?");
      if (go) {
        import("./keyCalibration.js").then((m) => this.app.show(m.KeyCalibration));
      } else {
        this.goBack();
      }
      return;
    }
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      await alertDialog(
        "DitDash couldn't access the microphone — permission was denied. Allow microphone access in " +
          "your browser settings, or switch to a Keyboard/HID key in Key Settings."
      );
    } else {
      await alertDialog("DitDash couldn't start your physical key input. Check Key Settings and try again.");
    }
    this.goBack();
  }

  goBack() {
    import("./settings.js").then((m) => this.app.show(m.Settings));
  }

  destroy() {
    if (this.handle) this.handle.destroy();
    this.morseInput.destroy();
  }
}
