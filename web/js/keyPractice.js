// Key Practice: send Morse using a real physical key/paddle instead of the
// keyboard/mouse/touch.
//
// Guided mode composes the existing SendPractice completely unchanged (see
// the small additive `morseInput` option added there) — decode, scoring,
// fluency, streak/level, weak letters all stay exactly as they already are
// for keyboard Send Practice, since a correctly-sent character is a
// correctly-sent character regardless of what device sent it.
//
// Free Keying is a separate, deliberately non-scoring mode for open-ended
// practice — see liveKeyDecoder.js, which has no reference to profile/
// scoring state at all, a structural guarantee it can't affect learning
// stats.

import { el, button, pageHeader, tabBar } from "./dom.js";
import { alertDialog, confirmDialog } from "./dialog.js";
import { createMorseInput } from "./morseInput/morseInput.js";

const MODES = [
  { id: "guided", label: "Guided" },
  { id: "free", label: "Free Keying" },
];

export class KeyPractice {
  static navId = "practice";

  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    this.mode = "guided";
    this.embedded = !!options.embedded;
    this.returnTo = options.returnTo || null;
    this.child = null;
    this._loadToken = 0;
    // Owned here for the screen's full lifetime — switching Guided <->
    // Free Keying does NOT recreate this (see _switchMode()), so audio
    // mode never re-prompts for microphone permission or interrupts an
    // in-progress stream on a tab switch. Destroyed exactly once, in
    // destroy() below — SendPractice (Guided mode's child) only ever
    // subscribes to it, never owns it.
    this.morseInput = createMorseInput(app.profile.settings);
    this._build();
    this._start();
  }

  _build() {
    const wrap = el("div", { class: this.embedded ? "screen" : "screen view-focused" });

    if (!this.embedded) {
      wrap.appendChild(
        pageHeader({
          eyebrow: "Practice",
          title: "Key Practice",
          actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
        })
      );
    }

    wrap.appendChild(tabBar(MODES, this.mode, (id) => this._switchMode(id)));

    const statusRow = el("div", { class: "row", style: { margin: "10px 0" } });
    this.statusEl = el("p", { class: "small muted", "aria-live": "polite" });
    statusRow.appendChild(this.statusEl);
    statusRow.appendChild(
      button(
        "Key Settings",
        () => import("./settings.js").then((m) => this.app.show(m.Settings)),
        "btn-panel btn-block-inline"
      )
    );
    wrap.appendChild(statusRow);

    this.childMount = el("div", {});
    wrap.appendChild(this.childMount);

    this.root.innerHTML = "";
    this.root.appendChild(wrap);
    this._renderStatus();
  }

  _renderStatus() {
    const s = this.app.profile.settings;
    if (s.keyConnection === "audio") {
      this.statusEl.textContent = s.keyAudioPolarity
        ? "Audio key input — calibrated"
        : "Audio key input needs calibration before it can detect your key.";
    } else {
      const mapped = s.keyType === "straight" ? !!s.keyHidCode : !!(s.keyHidDitCode && s.keyHidDahCode);
      this.statusEl.textContent = mapped
        ? "Keyboard/HID key — ready"
        : "No key mapped yet — set one in Key Settings.";
    }
  }

  async _start() {
    const token = this._loadToken;
    try {
      await this.morseInput.start();
    } catch (err) {
      if (token !== this._loadToken) return;
      await this._handleMorseInputError(err);
    }
    if (token !== this._loadToken) return;
    this._mountChild();
  }

  // Every failure here leaves keyboard/mouse/touch Send Practice fully
  // usable (morseInput is optional/additive to SendPractice — see its
  // constructor) — this only ever explains why the *physical* key isn't
  // working, never blocks the screen.
  async _handleMorseInputError(err) {
    if (err && err.code === "NEEDS_CALIBRATION") {
      const goCalibrate = await confirmDialog(
        "Audio key input hasn't been calibrated yet, so DitDash doesn't know which direction means " +
          '"key down" for your hardware. Calibrate now?'
      );
      if (goCalibrate) {
        import("./keyCalibration.js").then((m) => this.app.show(m.KeyCalibration));
      }
      return;
    }
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      await alertDialog(
        "DitDash couldn't access the microphone — permission was denied. Allow microphone access in " +
          "your browser settings, or switch to a Keyboard/HID key in Key Settings."
      );
      return;
    }
    if (err && err.name === "NotFoundError") {
      await alertDialog(
        "No microphone was found. Switch to a Keyboard/HID key in Key Settings, or connect an audio input."
      );
      return;
    }
    await alertDialog(
      "DitDash couldn't start audio key input. You can still use the keyboard, or switch to a " +
        "Keyboard/HID key in Key Settings."
    );
  }

  _mountChild() {
    const token = this._loadToken;
    if (this.mode === "guided") {
      import("./sendPractice.js").then((m) => {
        if (token !== this._loadToken) return;
        this.child = new m.SendPractice(this.childMount, this.app, {
          embedded: true,
          morseInput: this.morseInput,
          returnTo: this.returnTo || undefined,
        });
      });
    } else {
      import("./liveKeyDecoder.js").then((m) => {
        if (token !== this._loadToken) return;
        this.child = m.mountLiveKeyingUI(this.childMount, this.app, this.morseInput, {
          showMonitor: false,
          showKeyState: false,
        });
      });
    }
  }

  _switchMode(id) {
    if (id === this.mode) return;
    this._loadToken++;
    if (this.child && typeof this.child.destroy === "function") this.child.destroy();
    this.child = null;
    this.mode = id;
    this._build();
    this._mountChild();
  }

  // Guided mode delegates to SendPractice's own goBack() (session-summary-
  // if-3+-rounds logic keeps working unchanged); Free Keying has no round-
  // based session to summarize, so it just navigates directly, matching
  // Listen Practice's convention for a non-scored mode.
  goBack() {
    if (this.mode === "guided" && this.child && typeof this.child.goBack === "function") {
      this.child.goBack();
      return;
    }
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {
    this._loadToken++;
    if (this.child && typeof this.child.destroy === "function") this.child.destroy();
    this.morseInput.destroy();
  }
}
