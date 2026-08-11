// Listen Practice: select any number of letters, then let them cycle
// continuously — say the letter, play its CW pattern a set number of times,
// move to the next selected letter, and loop for as long as it's left
// running. No answering, no scoring — pure ear training in the background.

import * as codes from "./codes.js";
import { el, button, morseGlyphs, isDigit, attachArrowNav } from "./dom.js";
import { clamp } from "./learning.js";

const MIN_REPEATS = 1;
const MAX_REPEATS = 10;
// Pause between repeats of the same letter — fixed, not adjustable in the
// UI. Needs to stay well above 1 unit: a dot-dot-dot with only an
// intra-character gap between reps is indistinguishable from S, so a
// too-short repeat gap makes E sound like S, N sound like T-T (or worse),
// and so on.
const DEFAULT_REPEAT_GAP_UNITS = 6;
// Pause between two different letters — adjustable in the UI below.
const DEFAULT_LETTER_GAP_UNITS = 7;
const MIN_GAP_UNITS = 2;
const MAX_GAP_UNITS = 30;

// Fixed QWERTY layout so keys never move between rounds — only which keys
// are enabled changes, based on the profile's currently unlocked pool. Also
// defines the order letters play in during a cycle.
const KEYBOARD_ROWS = [
  "1234567890".split(""),
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
];

export class ListenPractice {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.selected = new Set();
    this.running = false;
    this._cycleId = 0;
    this.keyButtons = {};
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Listen Practice" }));
    wrap.appendChild(top);

    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Tap letters to select them, then Start to cycle through them continuously.",
      })
    );

    this.bigChar = el("div", { class: "big-char", text: "?" });
    wrap.appendChild(this.bigChar);

    this.glyphWrap = el("div", { class: "hint-viz" });
    wrap.appendChild(this.glyphWrap);

    this.status = el("p", { class: "heading status center", "aria-live": "polite" });
    wrap.appendChild(this.status);

    wrap.appendChild(this._repeatStepper());
    wrap.appendChild(this._gapStepper());
    wrap.appendChild(this._speakToggleRow());

    const controlsRow = el("div", { class: "button-row" });
    this.toggleBtn = button("Start  ▶", () => this._toggleRunning(), "btn-accent");
    this.toggleBtn.disabled = true;
    controlsRow.appendChild(this.toggleBtn);
    wrap.appendChild(controlsRow);

    this.keyboard = this._buildKeyboard();
    wrap.appendChild(this.keyboard);

    this.root.appendChild(wrap);
    this._updateKeyboard();
  }

  _repeatStepper() {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Repeats per letter" }));

    const stepRow = el("div", { class: "entry-row" });
    const minus = button("−", () => this._changeRepeats(-1), "btn-panel");
    minus.setAttribute("aria-label", "Decrease repeats per letter");
    this.repeatLbl = el("span", { class: "good mono", text: String(this._repeats()) });
    const plus = button("+", () => this._changeRepeats(1), "btn-panel");
    plus.setAttribute("aria-label", "Increase repeats per letter");
    stepRow.appendChild(minus);
    stepRow.appendChild(this.repeatLbl);
    stepRow.appendChild(plus);
    row.appendChild(stepRow);

    frame.appendChild(row);
    return frame;
  }

  _repeats() {
    return this.app.profile.settings.listenRepeats || 3;
  }

  _changeRepeats(delta) {
    const s = this.app.profile.settings;
    const next = clamp(this._repeats() + delta, MIN_REPEATS, MAX_REPEATS);
    s.listenRepeats = next;
    this.app.saveProfile();
    this.repeatLbl.textContent = String(next);
  }

  // The gap between two plays of the SAME letter — separate from the pause
  // between different letters below. Too short and repeated dots/dashes
  // blur into a different character entirely (three "E"s with no real gap
  // between them just sounds like "S"), so this stays fixed rather than
  // being user-adjustable.
  _repeatGapUnits() {
    return this.app.profile.settings.listenRepeatGapUnits || DEFAULT_REPEAT_GAP_UNITS;
  }

  _gapStepper() {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Pause between letters" }));

    const stepRow = el("div", { class: "entry-row" });
    const minus = button("−", () => this._changeGap(-1), "btn-panel");
    minus.setAttribute("aria-label", "Decrease pause between letters");
    this.gapLbl = el("span", { class: "good mono", text: String(this._gapUnits()) });
    const plus = button("+", () => this._changeGap(1), "btn-panel");
    plus.setAttribute("aria-label", "Increase pause between letters");
    stepRow.appendChild(minus);
    stepRow.appendChild(this.gapLbl);
    stepRow.appendChild(plus);
    row.appendChild(stepRow);

    frame.appendChild(row);
    return frame;
  }

  _gapUnits() {
    return this.app.profile.settings.listenGapUnits || DEFAULT_LETTER_GAP_UNITS;
  }

  _changeGap(delta) {
    const s = this.app.profile.settings;
    const next = clamp(this._gapUnits() + delta, MIN_GAP_UNITS, MAX_GAP_UNITS);
    s.listenGapUnits = next;
    this.app.saveProfile();
    this.gapLbl.textContent = String(next);
  }

  // Off by default: the spoken name's length varies with the browser's TTS
  // voice and isn't controlled by the pause setting above, so leaving it on
  // makes that pause hard to judge by ear. Letting learners opt in keeps the
  // announcement available without it muddying the plain tone-then-pause
  // rhythm by default.
  _speakToggleRow() {
    const frame = el("div", { class: "slider-frame" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: "Say letter name first" }));
    this.speakToggleBtn = button(this._speakEnabled() ? "On" : "Off", () => this._toggleSpeak(), "btn-panel");
    row.appendChild(this.speakToggleBtn);
    frame.appendChild(row);
    return frame;
  }

  _speakEnabled() {
    return !!this.app.profile.settings.listenSpeakLetters;
  }

  _toggleSpeak() {
    const s = this.app.profile.settings;
    s.listenSpeakLetters = !s.listenSpeakLetters;
    this.app.saveProfile();
    this.speakToggleBtn.textContent = s.listenSpeakLetters ? "On" : "Off";
  }

  _buildKeyboard() {
    const keyboard = el("div", { class: "keyboard" });
    for (const row of KEYBOARD_ROWS) {
      const rowEl = el("div", { class: "keyboard-row" });
      for (const ch of row) {
        const key = button(ch, () => this._toggleSelect(ch), "key mono");
        this.keyButtons[ch] = key;
        rowEl.appendChild(key);
      }
      keyboard.appendChild(rowEl);
      if (row.every(isDigit)) this.digitsRow = rowEl;
    }
    attachArrowNav(keyboard);
    return keyboard;
  }

  _updateKeyboard() {
    const pool = codes.poolForLevel(this.app.profile.receive_level);
    const unlocked = new Set(pool);
    for (const [ch, key] of Object.entries(this.keyButtons)) {
      const enabled = unlocked.has(ch);
      key.disabled = !enabled;
      key.classList.toggle("key-disabled", !enabled);
    }
    if (this.digitsRow) {
      this.digitsRow.style.display = pool.some(isDigit) ? "" : "none";
    }
  }

  _orderedSelected() {
    return KEYBOARD_ROWS.flat().filter((ch) => this.selected.has(ch));
  }

  _toggleSelect(ch) {
    if (this.selected.has(ch)) {
      this.selected.delete(ch);
    } else {
      this.selected.add(ch);
    }
    this.keyButtons[ch].classList.toggle("key-selected", this.selected.has(ch));
    this.toggleBtn.disabled = this.selected.size === 0;
    if (this.selected.size === 0 && this.running) {
      this._stop();
    }
  }

  _toggleRunning() {
    if (this.running) {
      this._stop();
    } else {
      this._start();
    }
  }

  _start() {
    if (this.selected.size === 0) return;
    this.running = true;
    this._cycleId++;
    // A cycle can sit in silence for a while between letters, especially at
    // low WPM with a long "pause between letters" — long enough for
    // Bluetooth headphones to idle-sleep and clip (or drop entirely) the
    // next tone. Force the near-silent keep-alive tone on for the duration
    // of the cycle, on top of whatever the profile's own setting is.
    this.app.audio.startKeepAlive();
    this._updateToggleBtn();
    this._runCycle(this._cycleId);
  }

  _stop() {
    this.running = false;
    this._cycleId++;
    this.app.audio.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    // Only tear the keep-alive tone back down if it wasn't already meant to
    // be running independently of this screen (Settings > Keep headphones
    // awake) — otherwise leaving here would silently turn that off too.
    if (!this.app.profile.settings.keepAwake) {
      this.app.audio.stopKeepAlive();
    }
    for (const key of Object.values(this.keyButtons)) key.classList.remove("key-hint");
    this._updateToggleBtn();
    this._setStatus("Stopped");
  }

  _updateToggleBtn() {
    this.toggleBtn.textContent = this.running ? "Stop  ■" : "Start  ▶";
    this.toggleBtn.className = `btn ${this.running ? "btn-danger" : "btn-accent"}`;
  }

  async _runCycle(id) {
    while (this.running && id === this._cycleId) {
      for (const ch of this._orderedSelected()) {
        if (!this.running || id !== this._cycleId) return;
        await this._playLetter(ch, id);
        if (!this.running || id !== this._cycleId) return;
        const unitMs = 1200.0 / Math.max(1, this.app.profile.settings.wpm);
        await this._sleep(unitMs * this._gapUnits());
      }
    }
  }

  async _playLetter(ch, id) {
    const s = this.app.profile.settings;
    const pattern = codes.MORSE[ch];
    const times = this._repeats();
    const unitMs = 1200.0 / Math.max(1, s.wpm);

    this._showCurrent(ch);
    if (this._speakEnabled()) {
      this._setStatus(`Saying "${ch}"…`);
      await this._speakLetter(ch, s.volume);
      if (id !== this._cycleId || !this.running) return;
    }

    for (let i = 0; i < times; i++) {
      if (id !== this._cycleId || !this.running) return;
      this._setStatus(`Playing ${ch}  ${i + 1} / ${times}`);
      await this.app.audio.playPatternAsync(pattern, s.wpm, s.freq, s.volume);
      if (id !== this._cycleId || !this.running) return;
      if (i !== times - 1) await this._sleep(unitMs * this._repeatGapUnits());
    }
  }

  _showCurrent(ch) {
    this.bigChar.textContent = ch;
    this.glyphWrap.innerHTML = "";
    this.glyphWrap.appendChild(morseGlyphs(codes.MORSE[ch]));
    for (const [k, key] of Object.entries(this.keyButtons)) {
      key.classList.toggle("key-hint", k === ch);
    }
  }

  // Speaks the letter name once via the browser's TTS voice before the CW
  // tones start, so a learner hears "S" and then what S actually sounds
  // like in Morse — not supported by every browser, so a missing API just
  // skips straight to the tones instead of failing.
  _speakLetter(text, volume) {
    if (!("speechSynthesis" in window)) return Promise.resolve();
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.volume = Math.max(0, Math.min(1, (volume ?? 70) / 100));
      utter.onend = resolve;
      utter.onerror = resolve;
      window.speechSynthesis.speak(utter);
    });
  }

  _setStatus(text) {
    this.status.textContent = text;
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  goBack() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {
    this.running = false;
    this._cycleId++;
    this.app.audio.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    if (!this.app.profile.settings.keepAwake) {
      this.app.audio.stopKeepAlive();
    }
  }
}
