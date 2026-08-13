// Continuous, non-scoring Morse decoder — the engine behind Free Keying and
// Test Key Mode. Both need the same thing: accumulate a pattern from
// down/up/dit/dah events, decode it live into characters as gaps occur, play
// a sidetone, and touch nothing in the profile. Deliberately has no
// reference to profile.send_*, saveProfile(), scoring, characterState, or
// weakLetters — a structural guarantee, not just a convention, that neither
// consumer can accidentally affect learning stats.
//
// Reuses exactly the same decode primitive and timing constants Send
// Practice uses (codes.charFromPattern, timing.js) — no second Morse
// timing/decoding system.

import * as codes from "./codes.js";
import { el, button, morseGlyphs, keyLabel } from "./dom.js";
import { unitMs, DOT_THRESHOLD_UNITS, decodeGapMs } from "./timing.js";

export class LiveKeyDecoder {
  constructor({ app, onPatternChange, onCharacter } = {}) {
    this.app = app;
    this.onPatternChange = onPatternChange || (() => {});
    this.onCharacter = onCharacter || (() => {});
    this.pattern = "";
    this._pressTime = null;
    this._timer = null;
  }

  _wpm() {
    return this.app.profile.settings.wpm;
  }

  // Straight-key/audio path: duration since press determines dot vs dash —
  // identical classifier to sendPractice.js's onRelease().
  onDown() {
    this._pressTime = performance.now();
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  onUp() {
    if (this._pressTime == null) return;
    const heldMs = performance.now() - this._pressTime;
    this._pressTime = null;
    const unit = unitMs(this._wpm());
    this._append(heldMs < DOT_THRESHOLD_UNITS * unit ? "." : "-");
  }

  // Double-paddle path: the input source already knows which symbol —
  // identical to sendPractice.js's dedicated dotKey/dashKey tap path.
  onDit() {
    this._append(".");
  }

  onDah() {
    this._append("-");
  }

  _append(symbol) {
    this.pattern += symbol;
    this.onPatternChange(this.pattern);

    const s = this.app.profile.settings;
    this.app.audio.playPattern(symbol, s.wpm, s.freq, s.volume);

    if (this._timer) clearTimeout(this._timer);
    this._timer = setTimeout(() => this._decode(), decodeGapMs(this._wpm()));
  }

  _decode() {
    this._timer = null;
    if (!this.pattern) return;
    const ch = codes.charFromPattern(this.pattern) || "?";
    this.onCharacter(ch);
    this.pattern = "";
    this.onPatternChange(this.pattern);
  }

  destroy() {
    if (this._timer) clearTimeout(this._timer);
  }
}

// Shared UI for Free Keying (keyPractice.js) and Test Key Mode
// (keyTestMode.js) — same decode/render logic either way, only the
// diagnostic chrome differs: `showKeyState` adds a raw key-state readout,
// `showMonitor` embeds the Input Monitor (waveform for audio, event log for
// keyboard/HID). Free Keying uses neither; Test Key Mode uses both. This
// keeps the two entry points from duplicating decode/UI logic — only the
// navigation entry points are duplicated, not the implementation.
export function mountLiveKeyingUI(container, app, morseInput, { showMonitor = false, showKeyState = false } = {}) {
  let history = "";

  const wrap = el("div", { class: "slider-frame" });
  wrap.appendChild(
    el("p", { class: "small muted", text: "Key naturally — decoded characters appear here as you go." })
  );

  // Mouse-mode physical key: makes clear this is normal operation, not a
  // malfunction, when a click doesn't land on a button the way expected.
  const s = app.profile.settings;
  if (s.keyConnection === "hid" && s.keyHidEventSource === "mouse") {
    const label = s.keyType === "straight" && s.keyHidCode ? keyLabel(s.keyHidCode) : "mouse button";
    wrap.appendChild(
      el("p", { class: "small muted", text: `Morse key: ${label} · Esc releases the mouse` })
    );
  }

  const textLine = el("p", { class: "heading", "aria-live": "polite", text: "" });
  wrap.appendChild(textLine);

  const patternLbl = el("p", { class: "pattern" });
  patternLbl.appendChild(el("span", { class: "muted", text: "—" }));
  wrap.appendChild(patternLbl);

  let keyStateEl = null;
  if (showKeyState) {
    keyStateEl = el("p", { class: "small muted center", "aria-live": "polite", text: "Key up" });
    wrap.appendChild(keyStateEl);
  }

  wrap.appendChild(
    button(
      "Clear",
      () => {
        history = "";
        textLine.textContent = "";
      },
      "btn-panel btn-block-inline"
    )
  );

  const monitorMount = el("div", { style: { marginTop: "16px" } });
  if (showMonitor) wrap.appendChild(monitorMount);

  container.appendChild(wrap);

  const decoder = new LiveKeyDecoder({
    app,
    onPatternChange: (pattern) => {
      patternLbl.innerHTML = "";
      patternLbl.appendChild(pattern ? morseGlyphs(pattern) : el("span", { class: "muted", text: "—" }));
    },
    onCharacter: (ch) => {
      history += ch;
      textLine.textContent = history;
    },
  });

  let monitorHandle = null;
  if (showMonitor) {
    import("./keyInputMonitor.js").then((m) => {
      monitorHandle = m.mountInputMonitor(monitorMount, morseInput, {
        mode: app.profile.settings.keyConnection === "audio" ? "audio" : "hid",
      });
    });
  }

  const onKey = (e) => {
    const { action, element } = e.detail;
    if (keyStateEl) {
      keyStateEl.textContent = action === "down" ? `Key down — ${element}` : "Key up";
    }
    if (element === "generic") {
      if (action === "down") decoder.onDown();
      else decoder.onUp();
    } else if (action === "down") {
      element === "dit" ? decoder.onDit() : decoder.onDah();
    }
  };
  morseInput.addEventListener("morsekey", onKey);

  return {
    destroy() {
      morseInput.removeEventListener("morsekey", onKey);
      decoder.destroy();
      if (monitorHandle) monitorHandle.destroy();
    },
  };
}
