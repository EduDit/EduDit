// Farnsworth spacing: lets a learner slow down the gaps between characters
// and words while keeping each dot/dash at full character speed — the
// standard way beginners learn to recognize characters at real speed. Pure
// timing math only; no DOM/audio here, and it never touches dit/dah timing
// itself (that stays exactly as audio.js's playPattern/_runPattern already
// compute it for every existing single-character call site).

export { unitMs } from "./timing.js";
import { unitMs } from "./timing.js";

// Spacing can never be faster than character speed — that would mean gaps
// shorter than the characters they separate, which isn't Farnsworth, it's
// just a different (invalid) character speed. `null`/0/undefined means
// "off," i.e. spacing matches character speed.
export function resolveFarnsworthWpm(wpm, farnsworthWpm) {
  if (!farnsworthWpm) return wpm;
  return Math.min(farnsworthWpm, wpm);
}

const INTRA_CHAR_GAP_UNITS = 1;
const INTER_CHAR_GAP_UNITS = 3;
const INTER_WORD_GAP_UNITS = 7;

// Builds a flat timeline of `{ tone, durationMs }` steps for `text` (a
// string of characters found in `morseTable`, plus spaces for word breaks).
// Dot/dash durations and the gap between elements *within* one character
// are always computed at full `wpm`. Only the gap *between* characters and
// *between* words uses the (resolved, never-faster-than-wpm) Farnsworth
// unit instead. Characters not present in `morseTable` are skipped.
export function buildTimeline(text, morseTable, wpm, farnsworthWpm) {
  const charUnit = unitMs(wpm);
  const spaceUnit = unitMs(resolveFarnsworthWpm(wpm, farnsworthWpm));
  const steps = [];
  const chars = text.split("");

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " ") {
      steps.push({ tone: false, durationMs: spaceUnit * INTER_WORD_GAP_UNITS });
      continue;
    }

    const pattern = morseTable[ch.toUpperCase()];
    if (!pattern) continue;

    for (let j = 0; j < pattern.length; j++) {
      const symbol = pattern[j];
      steps.push({ tone: true, durationMs: symbol === "." ? charUnit : charUnit * 3 });
      if (j !== pattern.length - 1) {
        steps.push({ tone: false, durationMs: charUnit * INTRA_CHAR_GAP_UNITS });
      }
    }

    const next = chars[i + 1];
    if (next !== undefined && next !== " ") {
      steps.push({ tone: false, durationMs: spaceUnit * INTER_CHAR_GAP_UNITS });
    }
  }

  return steps;
}
