// Presents the profile's per-character accuracy as three plain-language
// tiers instead of a flat mistake count — shared by Home's "Today's Focus"
// card, the Lessons screen's Weak Letters section, and Scoreboard. Reads
// only existing seen/mistakes data; never changes what gets selected during
// practice.

import { isStrong } from "./characterState.js";

// A character needs at least this many combined attempts before its
// accuracy percentage means anything — one miss out of one attempt would
// otherwise land it in "Needs Work" on nothing more than bad luck.
const MIN_ATTEMPTS_TO_RANK = 3;

export function tierLetters(profile) {
  const seen = combinedSeen(profile);
  const mistakes = profile.mistakes || {};

  const needsWork = [];
  const gettingBetter = [];
  const strong = [];

  for (const [ch, attempts] of Object.entries(seen)) {
    if (attempts < MIN_ATTEMPTS_TO_RANK) continue;
    const misses = mistakes[ch] || 0;
    const pct = Math.round(((attempts - misses) / attempts) * 100);
    const row = { ch, attempts, misses, pct };
    if (isStrong(attempts, misses)) strong.push(row);
    else if (pct < 70) needsWork.push(row);
    else gettingBetter.push(row);
  }

  needsWork.sort((a, b) => a.pct - b.pct);
  gettingBetter.sort((a, b) => a.pct - b.pct);
  strong.sort((a, b) => a.ch.localeCompare(b.ch));

  return { needsWork, gettingBetter, strong };
}

export function combinedSeen(profile) {
  const combined = {};
  for (const [ch, count] of Object.entries(profile.receive_seen || {})) {
    combined[ch] = (combined[ch] || 0) + count;
  }
  for (const [ch, count] of Object.entries(profile.send_seen || {})) {
    combined[ch] = (combined[ch] || 0) + count;
  }
  return combined;
}
