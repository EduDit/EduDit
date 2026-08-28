import { test, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";
import { getRecommendation } from "./recommendation.js";

function baseProfile(extra = {}) {
  return {
    receive_level: 1,
    send_level: 1,
    receive_streak: 0,
    send_streak: 0,
    receive_seen: {},
    send_seen: {},
    mistakes: {},
    ...extra,
  };
}

test("a brand-new profile is recommended to continue its current level", () => {
  const rec = getRecommendation(baseProfile());
  assertEqual(rec.reason, "level");
  assertEqual(rec.lessonChars, null);
});

test("a profile with low accuracy on enough attempts is recommended a weak-letters review", () => {
  // Same tierLetters() definition the Home dashboard's own stat uses: 30%
  // and 40% accuracy, both well under the 70% needsWork cutoff.
  const rec = getRecommendation(
    baseProfile({ receive_seen: { E: 10, T: 10 }, mistakes: { E: 7, T: 6 } })
  );
  assertEqual(rec.reason, "weak");
  assertEqual(rec.lessonChars.slice().sort(), ["E", "T"]);
});

test("a character with too few attempts to be meaningful doesn't trigger a weak-letters review", () => {
  const rec = getRecommendation(baseProfile({ receive_seen: { E: 2 }, mistakes: { E: 2 } }));
  assertEqual(rec.reason, "level");
});

test("a character with plenty of attempts but solid accuracy doesn't trigger a weak-letters review", () => {
  const rec = getRecommendation(baseProfile({ receive_seen: { E: 10 }, mistakes: { E: 1 } }));
  assertEqual(rec.reason, "level");
});

test("with everything unlocked and no weak letters, recommends a general keep-going round", () => {
  const rec = getRecommendation(baseProfile({ receive_level: codes.MAX_LEVEL, send_level: codes.MAX_LEVEL }));
  assertEqual(rec.reason, "keep-going");
});
