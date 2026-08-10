// Settings: per-profile WPM and tone pitch, light PIN, and a progress reset.

import * as storage from "./storage.js";
import { el, button, keyLabel } from "./dom.js";
import { confirmDialog, alertDialog } from "./dialog.js";
import { APP_VERSION } from "./version.js";

export class Settings {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this._back()));
    top.appendChild(el("span", { class: "heading", text: "Settings" }));
    wrap.appendChild(top);

    const s = this.app.profile.settings;

    wrap.appendChild(this._slider("Speed (WPM)", s.wpm, 5, 35, (v) => this._onWpm(v)));
    wrap.appendChild(this._slider("Tone pitch (Hz)", s.freq, 300, 1000, (v) => this._onFreq(v)));
    wrap.appendChild(this._slider("Volume", s.volume ?? 70, 10, 100, (v) => this._onVolume(v)));
    wrap.appendChild(this._keepAwakeSection());

    wrap.appendChild(this._sendKeysSection());
    wrap.appendChild(this._pinSection());

    wrap.appendChild(button("Test tone  ♪", () => this._testTone(), "btn-block btn-accent"));
    wrap.appendChild(
      button("Reset this profile's progress", () => this._reset(), "btn-block btn-danger")
    );

    wrap.appendChild(this._versionSection());

    this.root.appendChild(wrap);
  }

  _slider(label, value, lo, hi, onInput) {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: label }));
    const valueLbl = el("span", { class: "good", text: String(value) });
    row.appendChild(valueLbl);
    frame.appendChild(row);

    const input = el("input", { type: "range", min: String(lo), max: String(hi), value: String(value) });
    input.addEventListener("input", () => {
      valueLbl.textContent = input.value;
      onInput(Number(input.value));
    });
    frame.appendChild(input);
    return frame;
  }

  _keepAwakeSection() {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Keep headphones awake" }));
    const s = this.app.profile.settings;
    const stateLbl = el("span", {
      class: s.keepAwake ? "good" : "muted",
      text: s.keepAwake ? "On" : "Off",
    });
    row.appendChild(stateLbl);
    frame.appendChild(row);
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Feeds a silent, inaudible tone in the background so Bluetooth headphones " +
          "don't fall asleep between beeps and clip the start of the next one.",
      })
    );
    frame.appendChild(
      button(
        s.keepAwake ? "Turn off" : "Turn on",
        () => this._toggleKeepAwake(),
        "btn-block btn-panel"
      )
    );
    return frame;
  }

  _toggleKeepAwake() {
    this.app.setKeepAwake(!this.app.profile.settings.keepAwake);
    this._rebuild();
  }

  _sendKeysSection() {
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Send practice keys" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "SPACE always works — hold it short for a dot, long for a dash. " +
          "You can also assign separate keys that send a dot or dash the instant you tap them.",
      })
    );

    const s = this.app.profile.settings;
    frame.appendChild(this._keyBindRow("Dot key ( . )", "dotKey", s.dotKey));
    frame.appendChild(this._keyBindRow("Dash key ( - )", "dashKey", s.dashKey));

    return frame;
  }

  _keyBindRow(label, field, currentCode) {
    const row = el("div", { class: "entry-row" });
    row.appendChild(el("span", { text: label }));
    const valueLbl = el("span", {
      class: currentCode ? "good" : "muted",
      text: currentCode ? keyLabel(currentCode) : "Not set",
    });
    row.appendChild(valueLbl);

    const setBtn = button("Set", () => {
      if (setBtn.dataset.listening) return;
      setBtn.dataset.listening = "1";
      setBtn.textContent = "Press a key… (Esc to cancel)";
      valueLbl.textContent = "…";
      valueLbl.className = "muted";
      const onKey = async (e) => {
        e.preventDefault();
        document.removeEventListener("keydown", onKey, true);
        delete setBtn.dataset.listening;
        setBtn.textContent = "Set";
        if (e.code === "Escape") {
          this._rebuild();
          return;
        }
        if (e.code === "Space") {
          await alertDialog("SPACE is reserved for hold-to-send. Pick a different key.");
          this._rebuild();
          return;
        }
        const other = field === "dotKey" ? "dashKey" : "dotKey";
        if (this.app.profile.settings[other] === e.code) {
          await alertDialog("That key is already assigned to the other symbol.");
          this._rebuild();
          return;
        }
        this.app.profile.settings[field] = e.code;
        this.app.saveProfile();
        this._rebuild();
      };
      document.addEventListener("keydown", onKey, true);
    });
    row.appendChild(setBtn);

    if (currentCode) {
      row.appendChild(
        button(
          "Clear",
          () => {
            this.app.profile.settings[field] = null;
            this.app.saveProfile();
            this._rebuild();
          },
          "btn-danger"
        )
      );
    }

    return row;
  }

  _pinSection() {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Profile PIN" }));
    row.appendChild(
      el("span", {
        class: this.app.profile.pin ? "good" : "muted",
        text: this.app.profile.pin ? "Set" : "None",
      })
    );
    frame.appendChild(row);
    frame.appendChild(
      el("p", {
        class: "small muted",
        text: "Light protection only — keeps others on this device from casually picking your profile.",
      })
    );

    const pinRow = el("div", { class: "entry-row" });
    const input = el("input", {
      class: "text-input pin-field",
      type: "password",
      inputmode: "numeric",
      maxlength: "8",
      placeholder: "New PIN",
    });
    pinRow.appendChild(input);
    pinRow.appendChild(button("Set", () => this._setPin(input.value), "btn-accent"));
    frame.appendChild(pinRow);

    if (this.app.profile.pin) {
      frame.appendChild(button("Remove PIN", () => this._removePin(), "btn-block btn-danger"));
    }

    return frame;
  }

  _setPin(value) {
    if (!value.trim()) return;
    storage.setPin(this.app.profile, value);
    this.app.saveProfile();
    this._rebuild();
  }

  _removePin() {
    storage.setPin(this.app.profile, null);
    this.app.saveProfile();
    this._rebuild();
  }

  _rebuild() {
    this.root.innerHTML = "";
    this._build();
  }

  _onWpm(v) {
    this.app.profile.settings.wpm = v;
    this.app.saveProfile();
  }

  _onFreq(v) {
    this.app.profile.settings.freq = v;
    this.app.saveProfile();
  }

  _onVolume(v) {
    this.app.profile.settings.volume = v;
    this.app.saveProfile();
  }

  _testTone() {
    const s = this.app.profile.settings;
    this.app.audio.testTone(s.freq, s.volume);
  }

  async _reset() {
    const ok = await confirmDialog(
      `Reset all levels and streaks for '${this.app.profileName}'?\nSpeed and pitch settings are kept.`
    );
    if (!ok) return;
    const p = this.app.profile;
    p.receive_level = 1;
    p.send_level = 1;
    p.receive_streak = 0;
    p.send_streak = 0;
    p.receive_seen = {};
    p.receive_miss_streak = {};
    p.send_seen = {};
    p.send_miss_streak = {};
    p.mistakes = {};
    this.app.saveProfile();
    await alertDialog("Progress reset.");
  }

  _versionSection() {
    const frame = el("div", { class: "slider-frame center" });
    frame.appendChild(
      button("Check for Updates", () => this._openVersionHistory(), "btn-block btn-good")
    );
    frame.appendChild(el("p", { class: "small muted center", text: `Version ${APP_VERSION}` }));
    return frame;
  }

  _openVersionHistory() {
    import("./versionHistory.js").then((m) => this.app.show(m.VersionHistory));
  }

  _back() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
