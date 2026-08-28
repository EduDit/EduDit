import { test, assertEqual } from "./testkit.js";
import { recordActivity, todayMs, streakDays } from "./dailyPractice.js";

// Local-date formatting, matching dailyPractice.js's own todayKey() — using
// toISOString() here would mismatch the implementation outside UTC.
function localKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function todayKey() {
  return localKey(new Date());
}
function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localKey(d);
}

test("recordActivity accumulates elapsed time under today's key", () => {
  const profile = { daily_practice: {} };
  recordActivity(profile, 60000);
  recordActivity(profile, 30000);
  assertEqual(profile.daily_practice[todayKey()], 90000);
  assertEqual(todayMs(profile), 90000);
});

test("recordActivity caps a single visit at 30 minutes", () => {
  const profile = { daily_practice: {} };
  recordActivity(profile, 90 * 60 * 1000);
  assertEqual(profile.daily_practice[todayKey()], 30 * 60 * 1000);
});

test("streakDays counts consecutive days ending today", () => {
  const data = {
    [todayKey()]: 1000,
    [daysAgoKey(1)]: 1000,
    [daysAgoKey(2)]: 1000,
  };
  assertEqual(streakDays(data), 3);
});

test("streakDays keeps counting from yesterday if today has no activity yet", () => {
  const data = {
    [daysAgoKey(1)]: 1000,
    [daysAgoKey(2)]: 1000,
  };
  assertEqual(streakDays(data), 2);
});

test("streakDays stops at the first gap", () => {
  const data = {
    [todayKey()]: 1000,
    [daysAgoKey(2)]: 1000,
  };
  assertEqual(streakDays(data), 1);
});
