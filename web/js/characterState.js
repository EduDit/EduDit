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

// A character above this average response time (see scoring.js's fluency
// EMA) reads as accurate-but-not-yet-automatic rather than "strong" — this
// is the mastery-side half of the accuracy/fluency distinction; the score
// itself lives entirely in scoring.js and is never read here. Kept as its
// own constant (not imported from scoring.js) to keep the two modules
// decoupled — this is a mastery threshold, not a scoring-curve anchor, and
// the two are allowed to be tuned independently.
export const FLUENT_MS_THRESHOLD = 2500;

// `avgResponseMs` is optional — omit it (or pass undefined/null) and this
// behaves exactly as it always has, pure accuracy math. Pass a character's
// fluency EMA and an otherwise-90%+-accurate character that's still slow to
// recognize is no longer reported as "strong" (see stateFor below, which
// falls it through to "practicing" instead).
export function isStrong(attempts, misses, avgResponseMs) {
  if (!attempts || attempts < STRONG_MIN_ATTEMPTS) return false;
  const pct = ((attempts - misses) / attempts) * 100;
  if (pct < STRONG_MIN_PCT) return false;
  if (avgResponseMs != null && avgResponseMs > FLUENT_MS_THRESHOLD) return false;
  return true;
}

// `level` gates which characters are unlocked (typically the higher of
// receive_level/send_level, so a character counts as unlocked once either
// mode has reached it). `seen`/`mistakes` are combined-across-modes maps.
// `avgResponseMs` is optional, same as isStrong() above — omit it for the
// original accuracy-only behavior.
export function stateFor(ch, level, seen, mistakes, avgResponseMs) {
  const pool = codes.poolForLevel(level);
  if (!pool.includes(ch)) return "locked";
  const attempts = seen[ch] || 0;
  if (attempts === 0) return "learning";
  if (isStrong(attempts, mistakes[ch] || 0, avgResponseMs)) return "strong";
  return "practicing";
}
