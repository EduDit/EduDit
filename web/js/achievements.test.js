import { test, assert, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";
import { evaluateAchievements } from "./achievements.js";

function baseProfile(extra = {}) {
  return {
    receive_level: 1,
    send_level: 1,
    receive_seen: {},
    receive_mistakes: {},
    send_seen: {},
    send_mistakes: {},
    mistakes: {},
    daily_practice: {},
    achievements: {},
    ...extra,
  };
}

test("no achievements unlock for a brand-new profile", () => {
  assertEqual(evaluateAchievements(baseProfile()).length, 0);
});

test("first 10 correct unlocks once combined correct answers reach 10", () => {
  const p = baseProfile({ receive_seen: { E: 10 }, receive_mistakes: {} });
  const ids = evaluateAchievements(p).map((a) => a.id);
  assert(ids.includes("first_10_correct"), "expected first_10_correct to unlock");
});

test("an already-unlocked achievement doesn't unlock again", () => {
  const p = baseProfile({
    receive_seen: { E: 10 },
    receive_mistakes: {},
    achievements: { first_10_correct: "2020-01-01T00:00:00.000Z" },
  });
  const ids = evaluateAchievements(p).map((a) => a.id);
  assert(!ids.includes("first_10_correct"), "expected first_10_correct not to re-unlock");
});

test("all characters unlocked only unlocks once both modes reach MAX_LEVEL", () => {
  const p = baseProfile({ receive_level: codes.MAX_LEVEL, send_level: codes.MAX_LEVEL - 1 });
  let ids = evaluateAchievements(p).map((a) => a.id);
  assert(!ids.includes("all_characters_unlocked"), "expected no unlock while send_level is behind");

  p.send_level = codes.MAX_LEVEL;
  ids = evaluateAchievements(p).map((a) => a.id);
  assert(ids.includes("all_characters_unlocked"), "expected unlock once both modes reach MAX_LEVEL");
});
