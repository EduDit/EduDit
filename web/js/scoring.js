// Time+accuracy response scoring — a per-round 0-100 score that captures
// not just "got it right" but "recognized it correctly and quickly," plus a
// per-character exponential moving average of raw response time (fluency)
// that mastery/recommendation can read separately from accuracy. See
// characterState.js's isStrong() for how fluency feeds back into "mastered."
//
// Deliberately pure/DOM-free — every call site is a plain function call
// from receivePractice.js/sendPractice.js, and the whole model is
// independently testable (scoring.test.js) without touching audio, timers,
// or a real profile. Score and fluency are kept as separate signals: this
// module never derives one from the other, and callers must not either —
// see the redesign plan's "score vs. fluency stay separate" invariant.

// Response-time anchors are fixed milliseconds, not WPM-scaled: once a
// character has finished playing (Receive) or the prompt has appeared
// (Send), recognizing it and reacting is a human-reaction-speed question,
// not a code-speed one — WPM already governs how long the character took to
// play, which callers exclude from the measured interval before calling in.
export const EXCELLENT_MS = 1200;
export const GOOD_MS = 2500;
export const SLOW_MS = 5000;
export const VERY_SLOW_MS = 10000;

// Piecewise-linear anchors as [responseMs, score]. Kept sorted by
// responseMs ascending and non-increasing in score, which is what makes
// "faster never scores lower" hold by construction — scoring.test.js
// checks that property directly rather than only spot-checking bands.
const CORRECT_ANCHORS = [
  [0, 100],
  [EXCELLENT_MS, 95],
  [GOOD_MS, 80],
  [SLOW_MS, 50],
  [VERY_SLOW_MS, 25],
];
// A wrong answer never scores above CORRECT_ANCHORS' lowest point (25) — the
// gap (18 max vs. 25 min) is deliberate headroom, not a rounding accident,
// so "every correct answer beats every incorrect answer" survives future
// retuning of either curve independently. Within incorrect answers, score
// still decreases as responseMs increases: a snap wrong guess scores "low,"
// a slow-and-still-wrong answer scores "very low" — struggling and still
// missing it is treated as worse than a quick slip, not rewarded for speed.
const INCORRECT_ANCHORS = [
  [0, 18],
  [GOOD_MS, 10],
  [VERY_SLOW_MS, 2],
];

function interpolate(anchors, ms) {
  const t = Math.max(0, ms);
  if (t <= anchors[0][0]) return anchors[0][1];
  for (let i = 1; i < anchors.length; i++) {
    const [x0, y0] = anchors[i - 1];
    const [x1, y1] = anchors[i];
    if (t <= x1) {
      const frac = (t - x0) / (x1 - x0);
      return y0 + (y1 - y0) * frac;
    }
  }
  return anchors[anchors.length - 1][1];
}

// { correct, responseMs } -> 0-100. `responseMs` is the caller-measured
// recognition interval — see receivePractice.js/sendPractice.js for exactly
// what start/stop events that spans (deliberately excludes playback
// duration, the post-keying decode gap, and anything measured while the
// tab was hidden).
export function calculateResponseScore({ correct, responseMs }) {
  const anchors = correct ? CORRECT_ANCHORS : INCORRECT_ANCHORS;
  return Math.round(Math.max(0, Math.min(100, interpolate(anchors, responseMs))));
}

// Plain mean of a session's per-round scores — reproduces "one bad round
// among several good ones still nets a healthy session score" without a
// bespoke weighting/decay scheme. Returns null for an empty/unscored
// session (e.g. all rounds were auto-hint) so callers can omit the Session
// Score section instead of showing a misleading 0.
export function sessionScore(scores) {
  if (!scores || scores.length === 0) return null;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.round(sum / scores.length);
}

// Quiet, qualitative in-round/session feedback — no visible formula, no
// countdown timer in the UI.
export function scoreLabel(score) {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  return "Keep practicing";
}

// Exponential moving average for a character's fluency (raw response ms,
// never derived from 0-100 scores). Recency-weighted so a character that's
// recently gotten faster reflects that quickly rather than being dragged
// down by old slow attempts — the per-character analogue of "session score
// rewards improvement over time."
const FLUENCY_EMA_ALPHA = 0.3;
export function updateFluencyEma(previousMs, sampleMs) {
  if (previousMs == null) return sampleMs;
  return previousMs * (1 - FLUENCY_EMA_ALPHA) + sampleMs * FLUENCY_EMA_ALPHA;
}
