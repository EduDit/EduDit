// A MorseInput source for hardware that presents a real Morse key/paddle as
// ordinary keyboard events (the common case for cheap USB "keyer" adapters).
// Named "KeyboardKeyInput", not "HidKeyInput" — it only ever sees standard
// KeyboardEvents, never a real navigator.hid device. A future WebHID-based
// source for interfaces that *don't* emulate a keyboard would be a separate
// class behind the same "morsekey"/"morsekeyraw" event contract this module
// defines, not a variant of this one.
//
// Generalizes the keyboard-handling sendPractice.js already has (e.repeat
// guard, e.code matching, preventDefault-to-claim-the-key) into a standalone
// source with per-element contact-bounce filtering.

import { DebounceFilter } from "./debounce.js";

// Higher sensitivity -> shorter debounce window (more responsive to fast
// legitimate keying, less protection against bounce); lower sensitivity ->
// longer window (safer against bounce, at the cost of possibly swallowing
// very fast legitimate transitions). Only used when `keyHidDebounceMs` is
// null — see settings.js's Sensitivity/Advanced override rule.
export function debounceMsFromSensitivity(sensitivity) {
  const s = Math.max(0, Math.min(100, sensitivity ?? 50));
  return Math.round(15 - (s / 100) * 12);
}

export class KeyboardKeyInput extends EventTarget {
  constructor(settings) {
    super();
    this._s = settings;
    const ms = settings.keyHidDebounceMs ?? debounceMsFromSensitivity(settings.keySensitivity);
    this._generic = new DebounceFilter(ms);
    this._dit = new DebounceFilter(ms);
    this._dah = new DebounceFilter(ms);
    this._onKeyDown = (e) => this._handle(e, "down");
    this._onKeyUp = (e) => this._handle(e, "up");
  }

  // Synchronous — matches AudioKeyInput's async start() at the call-site
  // contract level (every caller does `await morseInput.start()`), but a
  // keyboard source never needs a permission prompt.
  start() {
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
    return Promise.resolve();
  }

  _resolveElement(code) {
    const s = this._s;
    if (s.keyType === "straight") {
      return s.keyHidCode && code === s.keyHidCode ? "generic" : null;
    }
    const ditCode = s.swapDitDah ? s.keyHidDahCode : s.keyHidDitCode;
    const dahCode = s.swapDitDah ? s.keyHidDitCode : s.keyHidDahCode;
    if (ditCode && code === ditCode) return "dit";
    if (dahCode && code === dahCode) return "dah";
    return null;
  }

  _filterFor(element) {
    if (element === "dit") return this._dit;
    if (element === "dah") return this._dah;
    return this._generic;
  }

  _handle(e, edge) {
    if (edge === "down" && e.repeat) return;
    const element = this._resolveElement(e.code);
    if (!element) return;
    e.preventDefault();
    const ts = performance.now();
    const filter = this._filterFor(element);
    const accepted = filter.accept(edge, ts);
    this.dispatchEvent(new CustomEvent("morsekeyraw", { detail: { edge, element, ts, filtered: !accepted } }));
    if (accepted) {
      this.dispatchEvent(new CustomEvent("morsekey", { detail: { action: edge, element, ts } }));
    }
  }

  destroy() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
  }
}
