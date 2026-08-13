// A MorseInput source for hardware that presents a real Morse key/paddle
// through ordinary browser input events — either keyboard events (the
// common case for USB "keyer" adapters that emulate a keyboard) or mouse
// button events (some simpler interfaces, e.g. foot-pedal-style adapters,
// emulate a mouse button instead — same digital on/off contact signal,
// just read through a different DOM event pair). Named
// "DeviceEventKeyInput", not "HidKeyInput" — it only ever sees standard
// DOM keyboard/mouse events, never a real navigator.hid device. A future
// WebHID-based source for interfaces that emulate neither would be a
// separate class behind the same "morsekey"/"morsekeyraw" event contract
// this module defines, not a variant of this one.
//
// Which event source is active is controlled by
// profile.settings.keyHidEventSource ("keyboard" | "mouse", default
// "keyboard") — set once per keyer preset, not mixed per-binding, since a
// real adapter is consistently one or the other, never a mix.
//
// Generalizes the keyboard-handling sendPractice.js already has (e.repeat
// guard, e.code matching, preventDefault-to-claim-the-key) into a
// standalone source with per-element contact-bounce filtering.

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

// Mouse-button bindings are stored as "MouseN" (N = MouseEvent.button,
// 0=left/1=middle/2=right/3=back/4=forward) rather than a bare number, so
// they can never collide with a KeyboardEvent.code string sharing the same
// keyHidCode/keyHidDitCode/keyHidDahCode field, and dom.js's keyLabel()
// can recognize the prefix to show a human label.
export function mouseBindingCode(button) {
  return `Mouse${button}`;
}

export class DeviceEventKeyInput extends EventTarget {
  constructor(settings) {
    super();
    this._s = settings;
    const ms = settings.keyHidDebounceMs ?? debounceMsFromSensitivity(settings.keySensitivity);
    this._generic = new DebounceFilter(ms);
    this._dit = new DebounceFilter(ms);
    this._dah = new DebounceFilter(ms);
    this._onKeyDown = (e) => this._handleKeyboard(e, "down");
    this._onKeyUp = (e) => this._handleKeyboard(e, "up");
    this._onMouseDown = (e) => this._handleMouse(e, "down");
    this._onMouseUp = (e) => this._handleMouse(e, "up");
    this._onContextMenu = (e) => this._maybeSuppressContextMenu(e);
  }

  // Synchronous — matches AudioKeyInput's async start() at the call-site
  // contract level (every caller does `await morseInput.start()`), but
  // neither event source here ever needs a permission prompt.
  start() {
    if (this._s.keyHidEventSource === "mouse") {
      document.addEventListener("mousedown", this._onMouseDown);
      document.addEventListener("mouseup", this._onMouseUp);
      // Right-click (button 2) normally opens the browser's context menu —
      // suppressed only while button 2 is actually mapped, so an unrelated
      // right-click elsewhere still behaves normally.
      document.addEventListener("contextmenu", this._onContextMenu);
    } else {
      document.addEventListener("keydown", this._onKeyDown);
      document.addEventListener("keyup", this._onKeyUp);
    }
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

  _emit(edge, element, ts) {
    const filter = this._filterFor(element);
    const accepted = filter.accept(edge, ts);
    this.dispatchEvent(new CustomEvent("morsekeyraw", { detail: { edge, element, ts, filtered: !accepted } }));
    if (accepted) {
      this.dispatchEvent(new CustomEvent("morsekey", { detail: { action: edge, element, ts } }));
    }
  }

  _handleKeyboard(e, edge) {
    if (edge === "down" && e.repeat) return;
    const element = this._resolveElement(e.code);
    if (!element) return;
    e.preventDefault();
    this._emit(edge, element, performance.now());
  }

  _handleMouse(e, edge) {
    const element = this._resolveElement(mouseBindingCode(e.button));
    if (!element) return;
    // Suppress the browser's own handling of this button while it's bound
    // as a Morse key — most importantly Back/Forward (buttons 3/4), which
    // otherwise navigate the page away.
    e.preventDefault();
    this._emit(edge, element, performance.now());
  }

  _maybeSuppressContextMenu(e) {
    if (this._resolveElement(mouseBindingCode(2))) e.preventDefault();
  }

  destroy() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("contextmenu", this._onContextMenu);
  }
}
