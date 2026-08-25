// Settings: organized into Practice / Audio / Appearance / Data tabs
// instead of one long scroll, with the WPM/Farnsworth/tone/volume sliders
// collapsed behind an "Adjust" toggle (progressive disclosure) rather than
// all shown at once. About stays visible under every tab, not tabbed itself.

import * as storage from "./storage.js";
import { el, button, keyLabel, attachArrowNav, tabBar, pageHeader, showToast } from "./dom.js";
import { confirmDialog, alertDialog, promptDialog } from "./dialog.js";
import { showShortcutsHelp } from "./shortcutsHelp.js";
import { APP_VERSION } from "./version.js";
import { serializeProfile, parseImportedProfile } from "./backup.js";
import { debounceMsFromSensitivity, mouseBindingCode } from "./morseInput/deviceEventKeyInput.js";
import { thresholdFromSensitivity, AUDIO_RELIABLE_WPM_CEILING } from "./morseInput/audioKeyInput.js";
import { createMorseInput } from "./morseInput/morseInput.js";
import { createKeyPreset, applyKeyPreset, presetMatches } from "./keyPresets.js";

const TABS = [
  { id: "practice", label: "Practice" },
  { id: "audio", label: "Audio" },
  { id: "key", label: "Key Input" },
  { id: "appearance", label: "Appearance" },
  { id: "data", label: "Data" },
];

// Human labels for every currently-claimable KeyboardEvent.code binding —
// used by _captureKeyRow()'s cross-group conflict check so the same
// physical key can't accidentally be bound twice (e.g. once as a Send
// Practice tap-dot key, once as a Key Input Dit mapping). Both binding
// groups can be listening for keydown/keyup simultaneously once Key
// Practice wraps SendPractice with an attached MorseInput, so a real
// conflict here would double-fire a symbol on a single keypress.
const KEY_FIELD_LABELS = {
  dotKey: "the Send Practice dot key",
  dashKey: "the Send Practice dash key",
  keyHidCode: "your Key Input straight-key mapping",
  keyHidDitCode: "your Key Input Dit mapping",
  keyHidDahCode: "your Key Input Dah mapping",
};

export class Settings {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tab = "practice";
    // Which collapsed sliders are currently expanded — see _collapsible().
    this._expanded = new Set();
    // The Input Monitor's own MorseInput instance, created only while its
    // section is expanded — see _keyMonitorContent()/_teardownKeyMonitor().
    this._keyMonitorInput = null;
    this._keyMonitorHandle = null;
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
      key: () => this._keyInputPanel(),
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
    // Leaving the Key Input tab while its Input Monitor is expanded must
    // release the mic/listeners it may be holding — see _teardownKeyMonitor().
    if (this.tab === "key") this._teardownKeyMonitor();
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
    // Collapsing the Input Monitor must release whatever MorseInput/mic
    // resource it opened — see _teardownKeyMonitor(). Every other
    // collapsible has no such resource, so this is a no-op for them.
    if (key === "keyInputMonitor" && this._expanded.has(key)) this._teardownKeyMonitor();
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
    wrap.appendChild(this._sendWpmCollapsible());
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

  // Send speed: how fast you have to key dots/dashes in Send/Key Practice —
  // deliberately a separate setting from Character Speed above, which
  // trains listening/recognition. Most beginners can recognize characters
  // by ear well before they can physically key them that fast by hand, so
  // this defaults much lower (see storage.js) and is adjusted independently.
  _sendWpmCollapsible() {
    const s = this.app.profile.settings;
    return this._collapsible("sendWpm", "Send Speed", `${s.sendWpm} WPM`, (valueLbl) => {
      const frame = el("div", {});
      frame.appendChild(
        el("p", {
          class: "small muted",
          text:
            "How fast you need to key dots and dashes in Send/Key Practice. Independent of " +
            "Character Speed above — most people can recognize Morse by ear well before they " +
            "can send it that fast by hand, so it's fine to keep this much lower while it climbs.",
        })
      );
      const input = el("input", { type: "range", min: "5", max: "35", value: String(s.sendWpm) });
      input.addEventListener("input", () => {
        valueLbl.textContent = `${input.value} WPM`;
        this._onSendWpmLive(Number(input.value));
      });
      frame.appendChild(input);
      return frame;
    });
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
    frame.appendChild(this._captureKeyRow("Dot key ( . )", "dotKey", s.dotKey));
    frame.appendChild(this._captureKeyRow("Dash key ( - )", "dashKey", s.dashKey));

    return frame;
  }

  // Every KeyboardEvent.code currently claimed anywhere in Settings, keyed
  // by field name — see KEY_FIELD_LABELS above for why this spans both the
  // Send Practice tap-key section and the Key Input HID mapping section.
  _allKeyBindings() {
    const s = this.app.profile.settings;
    return {
      dotKey: s.dotKey,
      dashKey: s.dashKey,
      keyHidCode: s.keyHidCode,
      keyHidDitCode: s.keyHidDitCode,
      keyHidDahCode: s.keyHidDahCode,
    };
  }

  // Generalized "press a key (or click a mouse button) to bind it" capture
  // row, shared by the existing Send Practice dot/dash keys (always
  // keyboard) and the new Key Input HID mapping rows (keyboard or mouse,
  // per `source` — see settings.keyHidEventSource). SPACE is always
  // reserved (hold-to-send stays available regardless of what else is
  // bound), and a chosen binding is rejected if it's already claimed by
  // *any* other binding in the app, not just within the same section — see
  // _allKeyBindings().
  _captureKeyRow(label, field, currentCode, { source = "keyboard" } = {}) {
    const row = el("div", { class: "entry-row" });
    row.appendChild(el("span", { text: label }));
    const valueLbl = el("span", {
      class: currentCode ? "good" : "muted",
      text: currentCode ? keyLabel(currentCode) : "Not set",
    });
    row.appendChild(valueLbl);

    const finishCapture = async (code) => {
      delete setBtn.dataset.listening;
      setBtn.textContent = "Set";
      if (code === null) {
        this._rebuild(); // cancelled
        return;
      }
      if (code === "Space") {
        await alertDialog("SPACE is reserved for hold-to-send. Pick a different key.");
        this._rebuild();
        return;
      }
      const bindings = this._allKeyBindings();
      const conflictField = Object.keys(bindings).find((f) => f !== field && bindings[f] === code);
      if (conflictField) {
        await alertDialog(`That is already assigned to ${KEY_FIELD_LABELS[conflictField]}.`);
        this._rebuild();
        return;
      }
      this.app.profile.settings[field] = code;
      this.app.saveProfile();
      this._rebuild();
    };

    const setBtn = button("Set", () => {
      if (setBtn.dataset.listening) return;
      setBtn.dataset.listening = "1";
      valueLbl.textContent = "…";
      valueLbl.className = "muted";

      if (source === "mouse") {
        setBtn.textContent = "Click the button… (Esc to cancel)";
        const onMouseDown = (e) => {
          e.preventDefault();
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("keydown", onEscape, true);
          finishCapture(mouseBindingCode(e.button));
        };
        const onEscape = (e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          document.removeEventListener("mousedown", onMouseDown, true);
          document.removeEventListener("keydown", onEscape, true);
          finishCapture(null);
        };
        document.addEventListener("mousedown", onMouseDown, true);
        document.addEventListener("keydown", onEscape, true);
      } else {
        setBtn.textContent = "Press a key… (Esc to cancel)";
        const onKey = (e) => {
          e.preventDefault();
          document.removeEventListener("keydown", onKey, true);
          finishCapture(e.code === "Escape" ? null : e.code);
        };
        document.addEventListener("keydown", onKey, true);
      }
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

  // ---- Key Input tab ----

  _keyInputPanel() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});
    wrap.appendChild(this._keyIntroSection());
    wrap.appendChild(this._keyPresetsSection());
    wrap.appendChild(this._keyConnectionSection());
    wrap.appendChild(this._keyTypeSection());
    wrap.appendChild(this._keyMappingSection());
    if (s.keyConnection === "audio") {
      wrap.appendChild(this._keyAudioDeviceSection());
      wrap.appendChild(this._keyAudioPolaritySection());
    }
    wrap.appendChild(
      this._collapsible("keySensitivity", "Sensitivity", `${s.keySensitivity}%`, (valueLbl) =>
        this._keySensitivitySlider(valueLbl)
      )
    );
    wrap.appendChild(this._keyAdvancedSection());
    wrap.appendChild(
      button(
        "Calibrate Input",
        () => import("./keyCalibration.js").then((m) => this.app.show(m.KeyCalibration)),
        "btn-block btn-accent"
      )
    );
    wrap.appendChild(this._collapsible("keyInputMonitor", "Input Monitor", "", () => this._keyMonitorContent()));
    wrap.appendChild(
      button("Test Key Mode", () => import("./keyTestMode.js").then((m) => this.app.show(m.KeyTestMode)), "btn-block btn-panel")
    );
    if (s.keyConnection === "audio" && s.sendWpm > AUDIO_RELIABLE_WPM_CEILING) {
      wrap.appendChild(
        el("p", {
          class: "small muted",
          text: `Heads up — at ${s.sendWpm} WPM Send Speed, audio input's contact-bounce filtering is less reliable with this browser-based detector (it works best up to about ${AUDIO_RELIABLE_WPM_CEILING} WPM). A Keyboard/HID interface stays reliable at any speed.`,
        })
      );
    }
    return wrap;
  }

  _keyIntroSection() {
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Physical Morse Key" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "A real Morse key or paddle is a mechanical contact device — it needs a compatible " +
          "USB/keyboard interface or an audio/keyer interface to connect to DitDash.",
      })
    );
    return frame;
  }

  // Named snapshots of every key* field (see keyPresets.js's
  // KEY_PRESET_FIELDS) so a learner with more than one key/paddle/interface
  // can switch between full setups — mapping, sensitivity, calibration and
  // all — without redoing any of it each time. "Active" is computed from
  // `activeKeyPresetId` + presetMatches() rather than tracked by hand, so
  // it can never silently drift out of sync with the fields it describes.
  _keyPresetsSection() {
    const s = this.app.profile.settings;
    const presets = s.keyPresets || [];
    const activePreset = presets.find((p) => p.id === s.activeKeyPresetId) || null;
    const modified = activePreset && !presetMatches(s, activePreset);

    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Keyer Preset" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Save your current key setup so you can switch between multiple keys, paddles, or " +
          "interfaces without remapping or recalibrating each time.",
      })
    );

    const statusRow = el("div", { class: "row" });
    statusRow.appendChild(el("span", { text: "Active" }));
    statusRow.appendChild(
      el("span", {
        class: activePreset && !modified ? "good" : "muted",
        text: activePreset ? `${activePreset.name}${modified ? " (changed)" : ""}` : "Custom (not saved as a preset)",
      })
    );
    frame.appendChild(statusRow);

    if (presets.length) {
      const select = el("select", { class: "text-input" });
      select.appendChild(el("option", { value: "", text: "Load a saved preset…" }));
      for (const p of presets) {
        select.appendChild(el("option", { value: p.id, text: p.name }));
      }
      select.value = "";
      select.addEventListener("change", () => {
        if (select.value) this._onLoadKeyPreset(select.value);
      });
      frame.appendChild(select);
    }

    const row = el("div", { class: "button-row" });
    row.appendChild(button("Save as New…", () => this._promptSaveNewKeyPreset(), "btn-panel"));
    if (activePreset) {
      row.appendChild(button("Update", () => this._updateKeyPreset(activePreset.id), "btn-panel"));
      row.appendChild(button("Delete", () => this._deleteKeyPreset(activePreset.id), "btn-danger"));
    }
    frame.appendChild(row);

    return frame;
  }

  async _promptSaveNewKeyPreset() {
    const name = await promptDialog("Name this keyer preset:", { placeholder: "e.g. Desk paddle" });
    if (!name) return;
    const s = this.app.profile.settings;
    const preset = createKeyPreset(name, s);
    s.keyPresets = [...(s.keyPresets || []), preset];
    s.activeKeyPresetId = preset.id;
    this.app.saveProfile();
    this._rebuild();
  }

  _updateKeyPreset(id) {
    const s = this.app.profile.settings;
    const presets = s.keyPresets || [];
    const idx = presets.findIndex((p) => p.id === id);
    if (idx === -1) return;
    presets[idx] = { ...createKeyPreset(presets[idx].name, s), id };
    this.app.saveProfile();
    this._rebuild();
  }

  async _deleteKeyPreset(id) {
    const s = this.app.profile.settings;
    const preset = (s.keyPresets || []).find((p) => p.id === id);
    if (!preset) return;
    const ok = await confirmDialog(`Delete the "${preset.name}" preset? This can't be undone.`);
    if (!ok) return;
    s.keyPresets = s.keyPresets.filter((p) => p.id !== id);
    if (s.activeKeyPresetId === id) s.activeKeyPresetId = null;
    this.app.saveProfile();
    this._rebuild();
  }

  _onLoadKeyPreset(id) {
    const s = this.app.profile.settings;
    const preset = (s.keyPresets || []).find((p) => p.id === id);
    if (!preset) return;
    // A different preset can change connection type entirely — any live
    // Input Monitor was built against the old one and must be torn down.
    this._teardownKeyMonitor();
    applyKeyPreset(s, preset);
    s.activeKeyPresetId = id;
    this.app.saveProfile();
    this._rebuild();
    this._warnIfKeyPresetConflicts(preset);
  }

  // Presets store raw key codes captured (and conflict-checked) at save
  // time — but dotKey/dashKey can change afterward, so a saved preset could
  // theoretically reintroduce the exact double-fire risk _captureKeyRow's
  // conflict check exists to prevent (see KEY_FIELD_LABELS above). Loading
  // a preset is never blocked for this — the preset itself is still valid,
  // just flagged — so the fix is a visible, non-blocking warning rather
  // than refusing the load.
  _warnIfKeyPresetConflicts(preset) {
    const s = this.app.profile.settings;
    const claimed = [preset.keyHidCode, preset.keyHidDitCode, preset.keyHidDahCode].filter(Boolean);
    if (claimed.includes(s.dotKey) || claimed.includes(s.dashKey)) {
      showToast('This preset’s key mapping conflicts with your Send Practice dot/dash key — check Key Mapping below.');
    }
  }

  _keyConnectionSection() {
    const s = this.app.profile.settings;
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Connection" }));
    frame.appendChild(
      el("p", {
        class: "small muted",
        text: "How your key/paddle reaches this computer — through hardware that acts like a keyboard, or through an external keyer/interface that generates an audio tone.",
      })
    );
    frame.appendChild(
      tabBar(
        [
          { id: "hid", label: "Keyboard / HID" },
          { id: "audio", label: "Audio" },
        ],
        s.keyConnection,
        (id) => this._onKeyConnection(id)
      )
    );
    return frame;
  }

  _onKeyConnection(id) {
    if (id === this.app.profile.settings.keyConnection) return;
    // Any live Input Monitor was built against the old connection type's
    // MorseInput implementation — tear it down before switching.
    this._teardownKeyMonitor();
    this.app.profile.settings.keyConnection = id;
    this.app.saveProfile();
    this._rebuild();
  }

  // Key Type (straight/paddle) is deliberately a separate control from
  // Connection (hid/audio) above — see the design note in the plan: a
  // double paddle can reach DitDash over either connection, but audio can
  // never distinguish which paddle contact produced a tone burst (the
  // microphone only hears one channel), so "Double Paddle" is disabled
  // (not hidden — the reason is stated inline) whenever Audio is selected.
  _keyTypeSection() {
    const s = this.app.profile.settings;
    const audioSelected = s.keyConnection === "audio";
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Key Type" }));

    const options = [
      { id: "straight", label: "Straight Key" },
      { id: "paddle", label: "Double Paddle" },
    ];
    const tabs = el("div", { class: "tabs", role: "tablist" });
    for (const opt of options) {
      const disabled = audioSelected && opt.id === "paddle";
      const active = opt.id === s.keyType;
      tabs.appendChild(
        el("button", {
          class: `tab-btn${active ? " tab-btn-active" : ""}`.trim(),
          text: opt.label,
          role: "tab",
          "aria-selected": String(active),
          disabled: disabled ? "" : undefined,
          onclick: disabled ? undefined : () => this._onKeyType(opt.id),
        })
      );
    }
    attachArrowNav(tabs);
    frame.appendChild(tabs);

    if (audioSelected) {
      frame.appendChild(
        el("p", {
          class: "small muted",
          text:
            "Audio input can't tell which paddle contact produced a tone — it only measures a " +
            "single press/release, so Double Paddle isn't available here. Use a Keyboard/HID " +
            "interface for independent Dit/Dah detection.",
        })
      );
    } else if (s.keyType === "paddle") {
      frame.appendChild(
        el("p", {
          class: "small muted",
          text:
            "Manual paddle input — each paddle press sends one dit or dah directly. DitDash " +
            "does not yet emulate an electronic keyer's auto-repeat/squeeze (iambic) behavior; " +
            "if your hardware performs iambic keying itself, DitDash will follow whatever it sends.",
        })
      );
    }
    return frame;
  }

  _onKeyType(id) {
    if (id === this.app.profile.settings.keyType) return;
    this.app.profile.settings.keyType = id;
    this.app.saveProfile();
    this._rebuild();
  }

  _keyMappingSection() {
    const s = this.app.profile.settings;
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Key Mapping" }));

    if (s.keyConnection === "audio") {
      frame.appendChild(
        el("p", {
          class: "small muted",
          text:
            "Your keyer/interface already shapes dits and dahs in the tone itself — DitDash " +
            "measures the tone's timing directly, no key mapping needed.",
        })
      );
      return frame;
    }

    // Most USB keyer adapters emulate a keyboard, but some simpler
    // interfaces (e.g. foot-pedal-style adapters) emulate a mouse button
    // instead — same digital on/off contact, different DOM event pair.
    // This only changes HOW a binding is captured/read; nothing downstream
    // (decode/scoring/timing) knows or cares which it was.
    frame.appendChild(
      tabBar(
        [
          { id: "keyboard", label: "Keyboard" },
          { id: "mouse", label: "Mouse Button" },
        ],
        s.keyHidEventSource || "keyboard",
        (id) => this._onKeyHidEventSource(id)
      )
    );

    const isMouse = s.keyHidEventSource === "mouse";
    frame.appendChild(
      el("p", {
        class: "small muted",
        text:
          s.keyType === "straight"
            ? `Set which ${isMouse ? "mouse button" : "key"} your interface sends when the physical key is pressed.`
            : `Set which ${isMouse ? "mouse buttons" : "keys"} your interface sends for the Dit and Dah paddle contacts.`,
      })
    );

    const captureOpts = { source: isMouse ? "mouse" : "keyboard" };
    if (s.keyType === "straight") {
      frame.appendChild(this._captureKeyRow("Key", "keyHidCode", s.keyHidCode, captureOpts));
    } else {
      frame.appendChild(this._captureKeyRow("Dit key", "keyHidDitCode", s.keyHidDitCode, captureOpts));
      frame.appendChild(this._captureKeyRow("Dah key", "keyHidDahCode", s.keyHidDahCode, captureOpts));
      if (s.keyHidDitCode || s.keyHidDahCode) {
        frame.appendChild(
          button(
            s.swapDitDah ? "Swap Dit / Dah (currently swapped)" : "Swap Dit / Dah",
            () => this._toggleSwapDitDah(),
            "btn-block btn-panel"
          )
        );
      }
    }

    if (isMouse) {
      const leftMapped = [s.keyHidCode, s.keyHidDitCode, s.keyHidDahCode].includes(mouseBindingCode(0));
      if (leftMapped) {
        frame.appendChild(
          el("p", {
            class: "small muted",
            text:
              "Your Morse key behaves like a USB mouse and sends Left Click. DitDash can use that click " +
              "as Morse input while still allowing normal mouse clicks when possible. If a click doesn't " +
              "go through the way you expect, press Esc to release the mouse for a moment.",
          })
        );
      }
    }

    return frame;
  }

  _onKeyHidEventSource(id) {
    const s = this.app.profile.settings;
    if (id === (s.keyHidEventSource || "keyboard")) return;
    // A binding captured under the old event source lives in a different
    // code namespace (KeyboardEvent.code vs "MouseN") and would silently
    // never match under the new one — clear it so Key Mapping visibly
    // shows "Not set" rather than a stale, non-functional binding.
    s.keyHidEventSource = id;
    s.keyHidCode = null;
    s.keyHidDitCode = null;
    s.keyHidDahCode = null;
    this._teardownKeyMonitor();
    this.app.saveProfile();
    this._rebuild();
  }

  _toggleSwapDitDah() {
    const s = this.app.profile.settings;
    s.swapDitDah = !s.swapDitDah;
    this.app.saveProfile();
    this._rebuild();
  }

  _keySensitivitySlider(valueLbl) {
    const s = this.app.profile.settings;
    const input = el("input", { type: "range", min: "0", max: "100", value: String(s.keySensitivity) });
    input.addEventListener("input", () => {
      valueLbl.textContent = `${input.value}%`;
      this._onKeySensitivityLive(Number(input.value));
    });
    input.addEventListener("change", () => this._rebuild());
    return input;
  }

  // Moving Sensitivity always clears any Advanced override back to "derive
  // automatically" from Sensitivity; editing an Advanced field directly
  // (see _keyDebounceRow()) does the reverse — sets an explicit override
  // Sensitivity no longer drives until it's reset. One rule, two
  // directions, so the two controls can never silently diverge.
  _onKeySensitivityLive(v) {
    const s = this.app.profile.settings;
    s.keySensitivity = v;
    s.keyHidDebounceMs = null;
    s.keyAudioThresholdLevel = null;
    s.keyAudioMinToneMs = null;
    this.app.saveProfile();
  }

  _keyAdvancedSection() {
    const s = this.app.profile.settings;
    const overrideActive =
      s.keyConnection === "audio"
        ? s.keyAudioThresholdLevel != null || s.keyAudioMinToneMs != null
        : s.keyHidDebounceMs != null;
    return this._collapsible("keyAdvanced", "Advanced", overrideActive ? "Custom" : "Automatic", () =>
      this._keyAdvancedContent()
    );
  }

  _keyAdvancedContent() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});
    if (s.keyConnection === "audio") {
      wrap.appendChild(this._keyAudioAdvancedContent());
    } else {
      wrap.appendChild(this._keyDebounceRow());
      if (s.keyHidEventSource === "mouse") wrap.appendChild(this._keyMovePassthroughRow());
    }
    return wrap;
  }

  // Mouse mode only — a fallback knob for the rare case the movement
  // heuristic misbehaves for a given adapter/setup, not something a normal
  // user needs to understand to use their key. See deviceEventKeyInput.js.
  _keyMovePassthroughRow() {
    const s = this.app.profile.settings;
    const on = s.keyHidMovePassthrough !== false;
    const wrap = el("div", { style: { marginTop: "12px" } });
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Allow normal mouse clicks after recent cursor movement. This helps tell real mouse clicks " +
          "apart from a mouse-emulating Morse key, but it's a best-effort guess, not a guarantee.",
      })
    );
    wrap.appendChild(
      button(
        on ? "Movement pass-through: On" : "Movement pass-through: Off",
        () => this._toggleMovePassthrough(),
        "btn-block btn-panel"
      )
    );
    return wrap;
  }

  _toggleMovePassthrough() {
    const s = this.app.profile.settings;
    s.keyHidMovePassthrough = !(s.keyHidMovePassthrough !== false);
    this.app.saveProfile();
    this._rebuild();
  }

  _keyDebounceRow() {
    const s = this.app.profile.settings;
    const derived = debounceMsFromSensitivity(s.keySensitivity);
    const effective = s.keyHidDebounceMs ?? derived;
    const isOverride = s.keyHidDebounceMs != null;

    const wrap = el("div", {});
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text:
          "How long a contact transition must hold before DitDash treats it as real keying " +
          "rather than mechanical bounce. Lower is more responsive; higher filters more aggressively.",
      })
    );

    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Debounce" }));
    const valueLbl = el("span", {
      class: isOverride ? "good" : "muted",
      text: `${effective} ms${isOverride ? " · Custom" : ""}`,
    });
    row.appendChild(valueLbl);
    wrap.appendChild(row);

    const input = el("input", { type: "range", min: "1", max: "30", value: String(effective) });
    input.addEventListener("input", () => {
      valueLbl.textContent = `${input.value} ms · Custom`;
      valueLbl.className = "good";
      this._onKeyDebounceLive(Number(input.value));
    });
    input.addEventListener("change", () => this._rebuild());
    wrap.appendChild(input);

    if (isOverride) {
      wrap.appendChild(button("Reset to Sensitivity", () => this._resetKeyDebounce(), "btn-block btn-panel"));
    }
    return wrap;
  }

  _onKeyDebounceLive(ms) {
    this.app.profile.settings.keyHidDebounceMs = ms;
    this.app.saveProfile();
  }

  _resetKeyDebounce() {
    this.app.profile.settings.keyHidDebounceMs = null;
    this.app.saveProfile();
    this._rebuild();
  }

  // Owns a MorseInput only while this section is expanded — started here,
  // torn down by _teardownKeyMonitor() from every exit path (collapsing
  // this section, switching Settings tabs away from Key Input, switching
  // connection type, or destroying the whole Settings screen). Never
  // starts a second, independent analysis: the monitor itself (see
  // keyInputMonitor.js) only ever displays this instance's own events.
  _keyMonitorContent() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});

    if (s.keyConnection === "audio" && !s.keyAudioPolarity) {
      wrap.appendChild(
        el("p", {
          class: "small muted",
          text: "Audio input needs to be calibrated before the Input Monitor can show anything — use Calibrate Input below.",
        })
      );
      return wrap;
    }

    const mount = el("div", {});
    wrap.appendChild(mount);

    // A _rebuild() (e.g. dragging an unrelated slider elsewhere on this
    // panel) replaces this whole DOM subtree, which would otherwise call
    // this method again — reuse an already-running monitor input across
    // those incidental rebuilds instead of silently orphaning its mic
    // stream/listeners and opening a second one. Only a genuine exit path
    // (see _teardownKeyMonitor()) actually stops it.
    if (this._keyMonitorHandle) this._keyMonitorHandle.destroy();
    if (this._keyMonitorInput) {
      import("./keyInputMonitor.js").then((m) => {
        if (!this._keyMonitorInput) return;
        this._keyMonitorHandle = m.mountInputMonitor(mount, this._keyMonitorInput, {
          mode: s.keyConnection === "audio" ? "audio" : "hid",
        });
      });
      return wrap;
    }

    this._keyMonitorInput = createMorseInput(s);
    this._keyMonitorInput
      .start()
      .then(() => {
        import("./keyInputMonitor.js").then((m) => {
          if (!this._keyMonitorInput) return; // torn down before the import resolved
          this._keyMonitorHandle = m.mountInputMonitor(mount, this._keyMonitorInput, {
            mode: s.keyConnection === "audio" ? "audio" : "hid",
          });
        });
      })
      .catch(() => {
        this._keyMonitorInput = null;
        mount.appendChild(el("p", { class: "small error", text: "Couldn't start key input for the monitor." }));
      });

    return wrap;
  }

  _teardownKeyMonitor() {
    if (this._keyMonitorHandle) {
      this._keyMonitorHandle.destroy();
      this._keyMonitorHandle = null;
    }
    if (this._keyMonitorInput) {
      this._keyMonitorInput.destroy();
      this._keyMonitorInput = null;
    }
  }

  // enumerateDevices() only returns real device labels once microphone
  // permission has been granted at least once — this shows a "Grant
  // access" probe button until then instead of a blank/generic device
  // list. The probe stream itself is stopped immediately after unlocking
  // labels and is never handed to AudioKeyInput.
  _keyAudioDeviceSection() {
    const frame = el("div", { class: "slider-frame" });
    frame.appendChild(el("span", { text: "Audio Input" }));
    frame.appendChild(
      el("p", { class: "small muted", text: "Which microphone/audio input DitDash listens to for your key." })
    );

    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      frame.appendChild(
        el("p", { class: "small error", text: "This browser doesn't support audio input." })
      );
      return frame;
    }

    const body = el("div", {});
    frame.appendChild(body);
    this._renderAudioDeviceBody(body);
    return frame;
  }

  async _renderAudioDeviceBody(body) {
    let devices;
    try {
      devices = await navigator.mediaDevices.enumerateDevices();
    } catch (e) {
      body.innerHTML = "";
      body.appendChild(el("p", { class: "small error", text: "Couldn't list audio devices." }));
      return;
    }

    const inputs = devices.filter((d) => d.kind === "audioinput");
    const hasLabels = inputs.some((d) => d.label);
    body.innerHTML = "";

    if (!hasLabels) {
      body.appendChild(
        button(
          "Grant microphone access",
          async () => {
            let probe;
            try {
              probe = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (e) {
              await alertDialog(
                "Microphone access was denied. Allow microphone access in your browser settings to select an audio input."
              );
              return;
            }
            probe.getTracks().forEach((t) => t.stop());
            this._renderAudioDeviceBody(body);
          },
          "btn-block btn-panel"
        )
      );
      return;
    }

    const s = this.app.profile.settings;
    const select = el("select", { class: "text-input" });
    select.appendChild(el("option", { value: "", text: "System default" }));
    for (const d of inputs) {
      select.appendChild(el("option", { value: d.deviceId, text: d.label || d.deviceId }));
    }
    select.value = s.keyAudioDeviceId || "";
    select.addEventListener("change", () => {
      s.keyAudioDeviceId = select.value || null;
      this.app.saveProfile();
    });
    body.appendChild(select);
  }

  _keyAudioPolaritySection() {
    const s = this.app.profile.settings;
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Calibration" }));
    row.appendChild(
      el("span", {
        class: s.keyAudioPolarity ? "good" : "muted",
        text: s.keyAudioPolarity ? "Calibrated" : "Not calibrated",
      })
    );
    frame.appendChild(row);
    frame.appendChild(
      el("p", {
        class: "small muted",
        text: s.keyAudioPolarity
          ? "Audio input is calibrated and ready to use."
          : "Audio input needs to be calibrated before it can detect your key — every audio interface's " +
            "hardware behaves a little differently, so there's no safe default to guess from. Use Calibrate " +
            "Input below.",
      })
    );
    return frame;
  }

  _keyAudioAdvancedContent() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});

    const derivedThreshold = thresholdFromSensitivity(s.keySensitivity);
    const thresholdOverride = s.keyAudioThresholdLevel != null;
    const effectiveThreshold = s.keyAudioThresholdLevel ?? derivedThreshold;
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text:
          "How large a level change DitDash treats as a real key press versus background noise. " +
          "Lower is more sensitive; higher requires a stronger signal.",
      })
    );
    const thresholdRow = el("div", { class: "row" });
    thresholdRow.appendChild(el("span", { text: "Detection threshold" }));
    const thresholdLbl = el("span", {
      class: thresholdOverride ? "good" : "muted",
      text: `${effectiveThreshold.toFixed(3)}${thresholdOverride ? " · Custom" : ""}`,
    });
    thresholdRow.appendChild(thresholdLbl);
    wrap.appendChild(thresholdRow);
    const thresholdInput = el("input", {
      type: "range",
      min: "0.005",
      max: "0.5",
      step: "0.005",
      value: String(effectiveThreshold),
    });
    thresholdInput.addEventListener("input", () => {
      const v = Number(thresholdInput.value);
      thresholdLbl.textContent = `${v.toFixed(3)} · Custom`;
      thresholdLbl.className = "good";
      s.keyAudioThresholdLevel = v;
      this.app.saveProfile();
    });
    thresholdInput.addEventListener("change", () => this._rebuild());
    wrap.appendChild(thresholdInput);
    if (thresholdOverride) {
      wrap.appendChild(
        button(
          "Reset to Sensitivity",
          () => {
            s.keyAudioThresholdLevel = null;
            this.app.saveProfile();
            this._rebuild();
          },
          "btn-block btn-panel"
        )
      );
    }

    wrap.appendChild(el("div", { class: "divider" }));

    const hysteresisRow = el("div", { class: "row" });
    hysteresisRow.appendChild(el("span", { text: "Hysteresis" }));
    const hysteresisLbl = el("span", { text: (s.keyAudioHysteresis ?? 0.02).toFixed(3) });
    hysteresisRow.appendChild(hysteresisLbl);
    wrap.appendChild(hysteresisRow);
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "A small margin around the threshold so noise sitting right at the edge can't rapidly flicker the detector.",
      })
    );
    const hysteresisInput = el("input", {
      type: "range",
      min: "0",
      max: "0.1",
      step: "0.005",
      value: String(s.keyAudioHysteresis ?? 0.02),
    });
    hysteresisInput.addEventListener("input", () => {
      const v = Number(hysteresisInput.value);
      hysteresisLbl.textContent = v.toFixed(3);
      s.keyAudioHysteresis = v;
      this.app.saveProfile();
    });
    wrap.appendChild(hysteresisInput);

    wrap.appendChild(el("div", { class: "divider" }));

    const minToneOverride = s.keyAudioMinToneMs != null;
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text:
          "Minimum tone/silence duration before DitDash accepts it as real keying rather than noise. " +
          "Automatically scaled to your Character Speed unless set here.",
      })
    );
    const minToneRow = el("div", { class: "row" });
    minToneRow.appendChild(el("span", { text: "Min. tone duration" }));
    const minToneLbl = el("span", {
      class: minToneOverride ? "good" : "muted",
      text: minToneOverride ? `${s.keyAudioMinToneMs} ms · Custom` : "Automatic",
    });
    minToneRow.appendChild(minToneLbl);
    wrap.appendChild(minToneRow);
    const minToneInput = el("input", {
      type: "range",
      min: "17",
      max: "40",
      value: String(s.keyAudioMinToneMs ?? 17),
    });
    minToneInput.addEventListener("input", () => {
      const v = Number(minToneInput.value);
      minToneLbl.textContent = `${v} ms · Custom`;
      minToneLbl.className = "good";
      s.keyAudioMinToneMs = v;
      this.app.saveProfile();
    });
    minToneInput.addEventListener("change", () => this._rebuild());
    wrap.appendChild(minToneInput);
    if (minToneOverride) {
      wrap.appendChild(
        button(
          "Reset to Automatic",
          () => {
            s.keyAudioMinToneMs = null;
            this.app.saveProfile();
            this._rebuild();
          },
          "btn-block btn-panel"
        )
      );
    }

    return wrap;
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

  _onSendWpmLive(v) {
    this.app.profile.settings.sendWpm = v;
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

  destroy() {
    this._teardownKeyMonitor();
  }
}
