// Mechanical-contact-bounce filter, shared by every MorseInput source
// (keyboard/HID edges, and the audio level-crossing edges built on top of
// the same idea). A single physical transition (a key closing, or a level
// crossing a threshold) can produce several rapid electrical flickers before
// settling — this rejects those flickers without delaying the first, real
// edge, and without needing a live clock (every call takes an explicit
// timestamp, which is what makes this deterministic and unit-testable).
export class DebounceFilter {
  constructor(minMs) {
    this.minMs = minMs;
    this._lastLevel = null;
    this._lastTs = null;
  }

  // `level` is any comparable value representing the new state ("down"/"up",
  // or true/false — callers decide). Returns true if this transition should
  // be treated as real Morse input, false if it's a duplicate/repeat of the
  // currently-held level or arrived too soon after the last *accepted*
  // transition to be legitimate.
  accept(level, ts) {
    if (level === this._lastLevel) return false;
    if (this._lastTs != null && ts - this._lastTs < this.minMs) return false;
    this._lastLevel = level;
    this._lastTs = ts;
    return true;
  }

  setMinMs(ms) {
    this.minMs = ms;
  }
}
