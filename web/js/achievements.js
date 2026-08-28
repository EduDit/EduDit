// Fixed achievement list and unlock-checking — kept deliberately secondary
// (toast + a small Progress-screen section), never a Home-screen feature.
// Reads only existing profile counters; never changes learning behavior.

// Labels avoid overclaiming: "10 Characters Strong" rather than "Mastered
// 10 characters" (isStrong already means sustained accuracy, not luck), and
// "All Characters Unlocked" rather than "Mastered the Alphabet" (reaching
// MAX_LEVEL means everything's been introduced, not that every character is
// perfected).
import * as codes from "./codes.js";
import { isStrong } from "./characterState.js";
import { combinedSeen } from "./weakLetters.js";

// "I don't know" (Receive Practice) is neutral by design — it must not
// touch mistakes/streak — but a naive attempts-minus-misses count would
// still read it as "correct," inflating both the accuracy percentage and
// "First 10 Correct"/"90%/95% Accuracy." Both places that derive a
// "correct" count below exclude it from the numerator and denominator, so
// clicking through with "I don't know" never looks like real accuracy.
function totalCorrect(profile) {
  const receiveAttempts = sumValues(profile.receive_seen);
  const receiveDontKnow = sumValues(profile.receive_dont_know);
  const receiveGraded = receiveAttempts - receiveDontKnow;
  const receiveMisses = sumValues(profile.receive_mistakes);
  const sendAttempts = sumValues(profile.send_seen);
  const sendMisses = sumValues(profile.send_mistakes);
  return {
    receiveCorrect: receiveGraded - receiveMisses,
    sendCorrect: sendAttempts - sendMisses,
    receiveAttempts, // raw — still right for "100 received," a volume milestone
    sendAttempts,
    receiveGraded,
  };
}

function sumValues(map) {
  return Object.values(map || {}).reduce((sum, n) => sum + n, 0);
}

// Exported for Progress's Overview hero ("are you improving?"), which wants
// the exact same accuracy definition achievements already use here — never
// a second, slightly different accuracy calculation.
export function overallAccuracyPct(profile) {
  const { receiveGraded, sendAttempts, receiveCorrect, sendCorrect } = totalCorrect(profile);
  const gradedAttempts = receiveGraded + sendAttempts;
  if (gradedAttempts === 0) return null;
  return ((receiveCorrect + sendCorrect) / gradedAttempts) * 100;
}

function strongCharCount(profile) {
  const seen = combinedSeen(profile);
  const dontKnow = profile.receive_dont_know || {};
  const mistakes = profile.mistakes || {};
  return Object.keys(seen).filter((ch) => {
    const graded = seen[ch] - (dontKnow[ch] || 0);
    return isStrong(graded, mistakes[ch] || 0);
  }).length;
}

export const ACHIEVEMENTS = [
  {
    id: "first_10_correct",
    label: "First 10 Correct",
    check: (p) => {
      const { receiveCorrect, sendCorrect } = totalCorrect(p);
      return receiveCorrect + sendCorrect >= 10;
    },
  },
  {
    id: "first_level_complete",
    label: "First Level Complete",
    check: (p) => p.receive_level >= 2 || p.send_level >= 2,
  },
  {
    id: "100_received",
    label: "100 Characters Received",
    check: (p) => totalCorrect(p).receiveAttempts >= 100,
  },
  {
    id: "100_sent",
    label: "100 Characters Sent",
    check: (p) => totalCorrect(p).sendAttempts >= 100,
  },
  {
    id: "accuracy_90",
    label: "90% Accuracy",
    check: (p) => (overallAccuracyPct(p) ?? 0) >= 90,
  },
  {
    id: "accuracy_95",
    label: "95% Accuracy",
    check: (p) => (overallAccuracyPct(p) ?? 0) >= 95,
  },
  {
    id: "five_minute_practice_day",
    label: "First 5-Minute Practice Day",
    // No formal "session" concept exists yet (deferred — see the plan's
    // Phase 6), so this uses daily_practice's per-day total as the nearest
    // honest proxy: any single day with 5+ minutes of recorded activity.
    check: (p) => Object.values(p.daily_practice || {}).some((ms) => ms >= 5 * 60 * 1000),
  },
  {
    id: "10_characters_strong",
    label: "10 Characters Strong",
    check: (p) => strongCharCount(p) >= 10,
  },
  {
    id: "all_characters_unlocked",
    label: "All Characters Unlocked",
    check: (p) => p.receive_level >= codes.MAX_LEVEL && p.send_level >= codes.MAX_LEVEL,
  },
];

// Returns the achievements newly earned this check — diffed against
// profile.achievements so each one only fires once. Does not mutate the
// profile; callers persist the result themselves alongside their own save.
export function evaluateAchievements(profile) {
  const unlocked = profile.achievements || {};
  const newly = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    if (a.check(profile)) newly.push(a);
  }
  return newly;
}
