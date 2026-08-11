// Derives a per-character learning-journey state and a "strong" threshold.
// Presentation layer only — reads seen/mistake counts that already exist on
// the profile, never touches the adaptive weighting or accuracy math in
// learning.js, and never changes what gets selected during practice.

import * as codes from "./codes.js";

// Deliberately higher than a token pass: five lucky answers shouldn't read
// as "strong." This is a display threshold, tuned for what reads as
// sustained accuracy rather than a lucky streak — not tied to any level or
// weighting constant elsewhere in the app.
export const STRONG_MIN_ATTEMPTS = 10;
export const STRONG_MIN_PCT = 90;

export function isStrong(attempts, misses) {
  if (!attempts || attempts < STRONG_MIN_ATTEMPTS) return false;
  const pct = ((attempts - misses) / attempts) * 100;
  return pct >= STRONG_MIN_PCT;
}

// `level` gates which characters are unlocked (typically the higher of
// receive_level/send_level, so a character counts as unlocked once either
// mode has reached it). `seen`/`mistakes` are combined-across-modes maps.
export function stateFor(ch, level, seen, mistakes) {
  const pool = codes.poolForLevel(level);
  if (!pool.includes(ch)) return "locked";
  const attempts = seen[ch] || 0;
  if (attempts === 0) return "learning";
  if (isStrong(attempts, mistakes[ch] || 0)) return "strong";
  return "practicing";
}
