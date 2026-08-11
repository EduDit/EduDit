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

// `fluency[ch]` (from combinedFluency() below) is threaded into isStrong()
// so a character that's accurate but still slow to recognize lands in
// gettingBetter instead of strong — see characterState.js's isStrong() for
// the accuracy/fluency distinction itself. Rows carry `fluencyMs` too, for
// Progress's small per-character fluency note.
export function tierLetters(profile) {
  const seen = combinedSeen(profile);
  const mistakes = profile.mistakes || {};
  const fluency = combinedFluency(profile);

  const needsWork = [];
  const gettingBetter = [];
  const strong = [];

  for (const [ch, attempts] of Object.entries(seen)) {
    if (attempts < MIN_ATTEMPTS_TO_RANK) continue;
    const misses = mistakes[ch] || 0;
    const pct = Math.round(((attempts - misses) / attempts) * 100);
    const fluencyMs = fluency[ch] ?? null;
    const row = { ch, attempts, misses, pct, fluencyMs };
    if (isStrong(attempts, misses, fluencyMs)) strong.push(row);
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

// Attempts-weighted average of a character's Receive/Send fluency EMAs
// (scoring.js's updateFluencyEma) — mirrors combinedSeen's "merge both
// modes" shape, but averages rather than sums since these are already
// per-mode averages, not raw counts. A character with fluency data in only
// one mode just uses that mode's value.
export function combinedFluency(profile) {
  const receiveMs = profile.receive_fluency_ms || {};
  const sendMs = profile.send_fluency_ms || {};
  const receiveSeen = profile.receive_seen || {};
  const sendSeen = profile.send_seen || {};

  const combined = {};
  for (const ch of new Set([...Object.keys(receiveMs), ...Object.keys(sendMs)])) {
    const r = receiveMs[ch];
    const s = sendMs[ch];
    if (r == null && s == null) continue;
    if (r == null) { combined[ch] = s; continue; }
    if (s == null) { combined[ch] = r; continue; }
    const rWeight = receiveSeen[ch] || 1;
    const sWeight = sendSeen[ch] || 1;
    combined[ch] = (r * rWeight + s * sWeight) / (rWeight + sWeight);
  }
  return combined;
}
