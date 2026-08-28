// Tracks how much active practice time happened each calendar day, so Home
// can show "Today's Practice" and a simple streak. Encouraging language
// only — a missed day never resets or punishes anything, it just isn't
// counted until practice happens again.
//
// Elapsed time is captured once per practice-screen visit (a start
// timestamp in the screen's constructor, a delta computed in its existing
// destroy()) rather than per round, so this never touches the round-by-
// round timing/decoding logic in receivePractice.js/sendPractice.js.

// Caps a single visit's contribution so an idle browser tab left open on a
// practice screen can't inflate the total.
const MAX_MS_PER_VISIT = 30 * 60 * 1000;

// Local calendar day, not UTC — "today" means the learner's own today. Using
// toISOString() here would misfile any practice done in the evening in a
// timezone west of UTC as "tomorrow," breaking both today's total and the
// streak right when it's checked.
// Exported so Progress's Activity tab can build the same local-day keys for
// a multi-day bar strip, rather than a second date-formatting implementation.
export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function recordActivity(profile, elapsedMs) {
  if (!elapsedMs || elapsedMs <= 0) return;
  const capped = Math.min(elapsedMs, MAX_MS_PER_VISIT);
  const key = todayKey();
  profile.daily_practice = profile.daily_practice || {};
  profile.daily_practice[key] = (profile.daily_practice[key] || 0) + capped;
}

export function todayMs(profile) {
  return (profile.daily_practice || {})[todayKey()] || 0;
}

// Consecutive calendar days with any recorded activity, counting backward
// from today. If today has no activity yet, counting starts from yesterday
// instead — otherwise every streak would read as broken the moment a new
// day begins, even with a long unbroken history behind it.
export function streakDays(dailyPractice) {
  const data = dailyPractice || {};
  const cursor = new Date();
  if (!data[todayKey(cursor)]) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (data[todayKey(cursor)]) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
