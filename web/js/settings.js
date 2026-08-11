// Settings: per-profile WPM and tone pitch, light PIN, and a progress reset.

import * as storage from "./storage.js";
import { el, button, keyLabel, attachArrowNav } from "./dom.js";
import { confirmDialog, alertDialog } from "./dialog.js";
import { showShortcutsHelp } from "./shortcutsHelp.js";
import { APP_VERSION } from "./version.js";
import { serializeProfile, parseImportedProfile } from "./backup.js";

export class Settings {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Settings" }));
    wrap.appendChild(top);

    const s = this.app.profile.settings;

    wrap.appendChild(this._sectionTitle("Audio"));
    wrap.appendChild(this._slider("Character Speed (WPM)", s.wpm, 5, 35, (v) => this._onWpm(v)));
    wrap.appendChild(this._farnsworthSection());
    wrap.appendChild(this._slider("Tone pitch (Hz)", s.freq, 300, 1000, (v) => this._onFreq(v)));
    wrap.appendChild(this._slider("Volume", s.volume ?? 70, 10, 100, (v) => this._onVolume(v)));
    wrap.appendChild(button("Test tone  ♪", () => this._testTone(), "btn-block btn-accent"));

    wrap.appendChild(this._sectionTitle("Appearance & Behavior"));
    wrap.appendChild(this._themeSection());
    wrap.appendChild(this._keepAwakeSection());

    wrap.appendChild(this._sectionTitle("Controls"));
    wrap.appendChild(this._sendKeysSection());
    wrap.appendChild(
      button("Keyboard Shortcuts", () => showShortcutsHelp(this.app), "btn-block btn-panel")
    );

    wrap.appendChild(this._sectionTitle("Profile & Data"));
    wrap.appendChild(this._pinSection());
    wrap.appendChild(this._backupSection());
    wrap.appendChild(
      button("Reset this profile's progress", () => this._reset(), "btn-block btn-danger")
    );

    wrap.appendChild(this._sectionTitle("About"));
    wrap.appendChild(this._versionSection());

    this.root.appendChild(wrap);
  }

  _sectionTitle(text) {
    return el("div", { class: "settings-section-title", text });
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

  // Farnsworth spacing: slows the gaps between characters/words while
  // dot/dash timing stays at full Character Speed — see farnsworth.js.
  // Off by default (farnsworthWpm: null). Dragging up to (or past)
  // Character Speed is treated as "off" rather than needing the slider's
  // own max to track the Character Speed slider live.
  _farnsworthSection() {
    const s = this.app.profile.settings;
    const isOff = !s.farnsworthWpm;
    const value = s.farnsworthWpm || s.wpm;

    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Spacing Speed (WPM)" }));
    const valueLbl = el("span", {
      class: "good",
      text: isOff ? `${value} (same as character speed)` : String(value),
    });
    row.appendChild(valueLbl);
    frame.appendChild(row);
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Characters are sent at your Character Speed above, while the gaps between " +
          "characters and words can be slowed down separately to make listening easier.",
      })
    );

    const input = el("input", { type: "range", min: "5", max: "35", value: String(value) });
    input.addEventListener("input", () => {
      const v = Number(input.value);
      const off = v >= s.wpm;
      valueLbl.textContent = off ? `${v} (same as character speed)` : String(v);
      this._onFarnsworth(off ? null : v);
    });
    frame.appendChild(input);

    if (!isOff) {
      frame.appendChild(
        button("Match character speed", () => this._resetFarnsworth(), "btn-block btn-panel")
      );
    }

    return frame;
  }

  _onFarnsworth(v) {
    this.app.profile.settings.farnsworthWpm = v;
    this.app.saveProfile();
  }

  _resetFarnsworth() {
    this.app.profile.settings.farnsworthWpm = null;
    this.app.saveProfile();
    this._rebuild();
  }

  _themeSection() {
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Appearance" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text: "System follows your device's light/dark setting.",
      })
    );

    const current = storage.getTheme();
    const tabs = el("div", { class: "tabs" });
    for (const [value, label] of [
      ["system", "System"],
      ["light", "Light"],
      ["dark", "Dark"],
    ]) {
      const tab = el("button", {
        class: `tab-btn ${value === current ? "tab-btn-active" : ""}`.trim(),
        text: label,
        "aria-pressed": String(value === current),
        onclick: () => this._onTheme(value),
      });
      tabs.appendChild(tab);
    }
    attachArrowNav(tabs);
    frame.appendChild(tabs);
    return frame;
  }

  _onTheme(theme) {
    this.app.setTheme(theme);
    this._rebuild();
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

  // Progress lives only in this browser's localStorage — export/import
  // protects against losing it to a cleared cache, a browser switch, or a
  // reinstall. `profile` is written/read exactly as storage.js already
  // stores it (see backup.js); this never creates a second storage system.
  _backupSection() {
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Backup & Restore" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Your progress is only saved in this browser. Export a backup so clearing your " +
          "browser data or switching devices doesn't lose it.",
      })
    );

    const row = el("div", { class: "button-row" });
    row.appendChild(button("Export Profile", () => this._exportProfile(), "btn-panel"));

    const fileInput = el("input", {
      type: "file",
      accept: ".json,application/json",
      style: { display: "none" },
    });
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      fileInput.value = "";
      if (file) this._importProfile(file);
    });
    row.appendChild(button("Import Profile", () => fileInput.click(), "btn-panel"));
    frame.appendChild(row);
    frame.appendChild(fileInput);

    return frame;
  }

  _exportProfile() {
    const name = this.app.profileName;
    const json = serializeProfile(name, this.app.profile);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = el("a", { href: url, download: `ditdash-${name}.json` });
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async _importProfile(file) {
    let text;
    try {
      text = await file.text();
    } catch (e) {
      await alertDialog("Couldn't read that file.");
      return;
    }

    let imported;
    try {
      imported = parseImportedProfile(text);
    } catch (e) {
      await alertDialog(e.message);
      return;
    }

    const { name, profile } = imported;
    const isActiveProfile = name === this.app.profileName;
    const alreadyExists = storage.listProfiles().includes(name);

    if (alreadyExists) {
      const message = isActiveProfile
        ? "This will overwrite your current profile with the imported backup — your session will reload immediately."
        : `A profile named "${name}" already exists — overwrite it with this backup?`;
      const ok = await confirmDialog(message);
      if (!ok) return;
    }

    storage.saveProfile(name, profile);

    if (isActiveProfile) {
      this.app.loadProfile(name);
      this._rebuild();
      await alertDialog("Profile restored.");
    } else {
      await alertDialog(`Profile "${name}" restored. Switch to it from Profile Select to use it.`);
    }
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

  goBack() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
