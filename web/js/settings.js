// Settings: organized into Practice / Audio / Appearance / Data tabs
// instead of one long scroll, with the WPM/Farnsworth/tone/volume sliders
// collapsed behind an "Adjust" toggle (progressive disclosure) rather than
// all shown at once. About stays visible under every tab, not tabbed itself.

import * as storage from "./storage.js";
import { el, button, keyLabel, attachArrowNav, tabBar, pageHeader } from "./dom.js";
import { confirmDialog, alertDialog } from "./dialog.js";
import { showShortcutsHelp } from "./shortcutsHelp.js";
import { APP_VERSION } from "./version.js";
import { serializeProfile, parseImportedProfile } from "./backup.js";

const TABS = [
  { id: "practice", label: "Practice" },
  { id: "audio", label: "Audio" },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Data" },
];

export class Settings {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tab = "practice";
    // Which collapsed sliders are currently expanded — see _collapsible().
    this._expanded = new Set();
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen view-standard" });

    wrap.appendChild(
      pageHeader({
        title: "Settings",
        actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );

    wrap.appendChild(tabBar(TABS, this.tab, (id) => this._setTab(id)));

    const panels = {
      practice: () => this._practicePanel(),
      audio: () => this._audioPanel(),
      appearance: () => this._appearancePanel(),
      data: () => this._dataPanel(),
    };
    wrap.appendChild(panels[this.tab]());

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(this._versionSection());

    this.root.appendChild(wrap);
  }

  _setTab(id) {
    if (id === this.tab) return;
    this.tab = id;
    this._rebuild();
  }

  // A collapsed "Label · value [Adjust]" row that expands into whatever
  // `renderExpanded()` returns — the progressive-disclosure pattern shared
  // by every slider on this screen, so a first-time visitor sees one
  // current value per setting instead of five sliders at once.
  // `renderExpanded(valueLbl)` gets the collapsed row's own value label, so
  // its slider can update it directly while dragging (matching the
  // original sliders' live feedback) instead of needing a full _rebuild()
  // on every input event.
  _collapsible(key, label, valueText, renderExpanded) {
    const expanded = this._expanded.has(key);
    const frame = el("div", { class: "slider-frame" });

    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: label }));
    const right = el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } });
    const valueLbl = el("span", { class: "good", text: valueText });
    right.appendChild(valueLbl);
    right.appendChild(
      button(expanded ? "Done" : "Adjust", () => this._toggleExpand(key), "btn-panel btn-block-inline")
    );
    row.appendChild(right);
    frame.appendChild(row);

    if (expanded) frame.appendChild(renderExpanded(valueLbl));
    return frame;
  }

  _toggleExpand(key) {
    if (this._expanded.has(key)) this._expanded.delete(key);
    else this._expanded.add(key);
    this._rebuild();
  }

  // ---- Practice tab ----

  _practicePanel() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});
    wrap.appendChild(
      this._collapsible("wpm", "Character Speed", `${s.wpm} WPM`, (valueLbl) => this._wpmSlider(valueLbl))
    );
    wrap.appendChild(this._farnsworthCollapsible());
    wrap.appendChild(this._sendKeysSection());
    wrap.appendChild(
      button("Keyboard Shortcuts", () => showShortcutsHelp(this.app), "btn-block btn-panel")
    );
    return wrap;
  }

  _wpmSlider(valueLbl) {
    const s = this.app.profile.settings;
    const input = el("input", { type: "range", min: "5", max: "35", value: String(s.wpm) });
    input.addEventListener("input", () => {
      valueLbl.textContent = `${input.value} WPM`;
      this._onWpmLive(Number(input.value));
    });
    return input;
  }

  // Farnsworth spacing: slows the gaps between characters/words while
  // dot/dash timing stays at full Character Speed — see farnsworth.js. Off
  // by default (farnsworthWpm: null). Dragging up to (or past) Character
  // Speed is treated as "off" rather than needing the slider's own max to
  // track the Character Speed slider live.
  _farnsworthCollapsible() {
    const s = this.app.profile.settings;
    const isOff = !s.farnsworthWpm;
    const value = s.farnsworthWpm || s.wpm;
    const valueText = isOff ? `${value} WPM (same as character speed)` : `${value} WPM`;

    return this._collapsible("farnsworth", "Spacing Speed", valueText, (valueLbl) => {
      const frame = el("div", {});
      frame.appendChild(
        el("p", {
          class: "small muted",
          text:
            "Characters are sent at your Character Speed above, while the gaps between " +
            "characters and words can be slowed down separately to make listening easier.",
        })
      );
      const input = el("input", { type: "range", min: "5", max: "35", value: String(value) });
      // Live value + save while dragging (input); a full rebuild only on
      // release (change) — rebuilding mid-drag would replace this input's
      // own DOM node and abort the drag gesture partway through.
      input.addEventListener("input", () => {
        const v = Number(input.value);
        const off = v >= s.wpm;
        valueLbl.textContent = off ? `${v} WPM (same as character speed)` : `${v} WPM`;
        this._onFarnsworth(off ? null : v);
      });
      input.addEventListener("change", () => this._rebuild());
      frame.appendChild(input);
      if (!isOff) {
        frame.appendChild(
          button("Match character speed", () => this._resetFarnsworth(), "btn-block btn-panel")
        );
      }
      return frame;
    });
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

  // ---- Audio tab ----

  _audioPanel() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});
    wrap.appendChild(
      this._collapsible("freq", "Tone Pitch", `${s.freq} Hz`, (valueLbl) => this._freqSlider(valueLbl))
    );
    wrap.appendChild(
      this._collapsible("volume", "Volume", `${s.volume ?? 70}%`, (valueLbl) => this._volumeSlider(valueLbl))
    );
    wrap.appendChild(button("Test tone  ♪", () => this._testTone(), "btn-block btn-accent"));
    wrap.appendChild(this._keepAwakeSection());
    return wrap;
  }

  _freqSlider(valueLbl) {
    const s = this.app.profile.settings;
    const input = el("input", { type: "range", min: "300", max: "1000", value: String(s.freq) });
    input.addEventListener("input", () => {
      valueLbl.textContent = `${input.value} Hz`;
      this._onFreqLive(Number(input.value));
    });
    return input;
  }

  _volumeSlider(valueLbl) {
    const s = this.app.profile.settings;
    const input = el("input", { type: "range", min: "10", max: "100", value: String(s.volume ?? 70) });
    input.addEventListener("input", () => {
      valueLbl.textContent = `${input.value}%`;
      this._onVolumeLive(Number(input.value));
    });
    return input;
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

  // ---- Appearance tab ----

  _appearancePanel() {
    const wrap = el("div", {});
    wrap.appendChild(this._themeSection());
    return wrap;
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

  // ---- Data tab ----

  _dataPanel() {
    const wrap = el("div", {});
    wrap.appendChild(this._pinSection());
    wrap.appendChild(this._backupSection());
    wrap.appendChild(button("Reset this profile's progress", () => this._reset(), "btn-block btn-danger"));
    return wrap;
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

  // Live-update while dragging (matches the original sliders' feel) without
  // a full _rebuild() on every input event — only the value text needs to
  // change, and _collapsible() already keeps the slider itself mounted.
  _onWpmLive(v) {
    this.app.profile.settings.wpm = v;
    this.app.saveProfile();
  }

  _onFreqLive(v) {
    this.app.profile.settings.freq = v;
    this.app.saveProfile();
  }

  _onVolumeLive(v) {
    this.app.profile.settings.volume = v;
    this.app.saveProfile();
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
    // Fluency (scoring.js) is a learning signal derived from the same
    // practice history as the counters above — reset it alongside them so
    // a character can't stay "mastered by speed" after its accuracy data
    // has been wiped.
    p.receive_fluency_ms = {};
    p.send_fluency_ms = {};
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
