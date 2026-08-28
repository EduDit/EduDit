// Shared Morse timing math (PARIS standard: one unit = 1200 / wpm ms).
// Previously duplicated independently in sendPractice.js, audio.js, and
// farnsworth.js — this is the single source of truth all of them (and the
// new physical-key input layer) now import from.

export function unitMs(wpm) {
  return 1200 / Math.max(1, wpm);
}

// A held symbol shorter than this many units is a dot, longer is a dash —
// see sendPractice.js's onRelease() for where this is applied.
export const DOT_THRESHOLD_UNITS = 2;

// After this many units (or DECODE_GAP_MIN_MS, whichever is larger) with
// nothing held, an accumulated pattern is decoded — see sendPractice.js's
// registerSymbol().
export const DECODE_GAP_UNITS = 3;
export const DECODE_GAP_MIN_MS = 600;

export function decodeGapMs(wpm) {
  return Math.max(DECODE_GAP_UNITS * unitMs(wpm), DECODE_GAP_MIN_MS);
}
