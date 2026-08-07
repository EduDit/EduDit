import { test, assert, assertEqual } from "./testkit.js";
import {
  shouldAutoHint,
  SEEN_THRESHOLD,
  MISS_STREAK_THRESHOLD,
  streakToClear,
  BASE_STREAK_TO_CLEAR,
  MAX_STREAK_TO_CLEAR,
  charWeight,
  TROUBLE_WEIGHT_CAP,
  pickWeighted,
  clamp,
  rankedMistakes,
} from "./learning.js";

test("documented thresholds: 2 free appearances, 3 misses in a row to re-trigger", () => {
  assertEqual(SEEN_THRESHOLD, 2);
  assertEqual(MISS_STREAK_THRESHOLD, 3);
});

test("a brand new letter (0 appearances) auto-hints", () => {
  assertEqual(shouldAutoHint(0, 0), true);
});

test("the second appearance still auto-hints", () => {
  assertEqual(shouldAutoHint(1, 0), true);
});

test("the third appearance is a blind quiz", () => {
  assertEqual(shouldAutoHint(2, 0), false);
});

test("later appearances stay blind while the miss streak is under 3", () => {
  assertEqual(shouldAutoHint(50, 0), false);
  assertEqual(shouldAutoHint(50, 1), false);
  assertEqual(shouldAutoHint(50, 2), false);
});

test("three misses in a row bring the hint back, however long it's been unlocked", () => {
  assertEqual(shouldAutoHint(50, 3), true);
  assertEqual(shouldAutoHint(50, 4), true);
});

// Walks through a simulated round-by-round session the same way
// ReceivePractice does: check the hint, then update seen/miss counters
// based on whether that round was answered correctly.
test("simulated session: hints for rounds 1-2, blind quiz after, hint returns after 3 misses in a row", () => {
  let seen = 0;
  let misses = 0;
  const hints = [];
  function round(correct) {
    hints.push(shouldAutoHint(seen, misses));
    seen += 1;
    misses = correct ? 0 : misses + 1;
  }

  round(true); // 1st appearance
  round(true); // 2nd appearance
  round(true); // 3rd appearance, answered correctly anyway
  round(false); // miss 1
  round(false); // miss 2
  round(false); // miss 3 (hint not shown yet — this one was still blind)
  round(false); // hint should be back for this round

  assertEqual(hints, [true, true, false, false, false, false, true]);
});

test("a single correct answer resets the miss streak", () => {
  let seen = 10;
  let misses = 0;
  const hints = [];
  function round(correct) {
    hints.push(shouldAutoHint(seen, misses));
    seen += 1;
    misses = correct ? 0 : misses + 1;
  }

  round(false); // miss 1
  round(false); // miss 2
  round(true); // correct — streak resets
  round(false); // miss 1 again, still blind

  assertEqual(hints, [false, false, false, false]);
});

test("level 1 needs the base streak to clear", () => {
  assertEqual(streakToClear(1), BASE_STREAK_TO_CLEAR);
});

test("streak-to-clear grows with level, so harder levels take longer", () => {
  assert(streakToClear(5) > streakToClear(1), "level 5 should require a longer streak than level 1");
  assert(streakToClear(10) > streakToClear(5), "level 10 should require a longer streak than level 5");
});

test("streak-to-clear never exceeds the cap, even at very high levels", () => {
  assertEqual(streakToClear(1000), MAX_STREAK_TO_CLEAR);
});

test("a letter never seen or missed has the baseline weight", () => {
  assertEqual(charWeight(0, 0), 1);
});

test("a letter missed every time it's shown gets the maximum trouble weight", () => {
  assertEqual(charWeight(10, 10), TROUBLE_WEIGHT_CAP);
});

test("a letter missed half the time it's shown sits halfway to the cap", () => {
  assertEqual(charWeight(10, 5), 1 + 0.5 * (TROUBLE_WEIGHT_CAP - 1));
});

test("miss rate is clamped at 100% even if mistakes somehow exceed appearances", () => {
  assertEqual(charWeight(5, 50), TROUBLE_WEIGHT_CAP);
});

test("pickWeighted always returns an entry from the pool", () => {
  const pool = ["A", "B", "C"];
  for (let i = 0; i < 20; i++) {
    const pick = pickWeighted(pool, () => 1, () => i / 20);
    assert(pool.includes(pick), `${pick} should be a member of the pool`);
  }
});

test("pickWeighted with injected rng picks deterministically along the weighted ranges", () => {
  // Weights [1, 1, 2] -> total 4 -> ranges: A [0,1), B [1,2), C [2,4)
  const pool = ["A", "B", "C"];
  const weightFn = (ch) => ({ A: 1, B: 1, C: 2 }[ch]);
  assertEqual(pickWeighted(pool, weightFn, () => 0), "A");
  assertEqual(pickWeighted(pool, weightFn, () => 0.26), "B"); // 0.26 * 4 = 1.04
  assertEqual(pickWeighted(pool, weightFn, () => 0.99), "C");
});

test("pickWeighted favors a heavily-weighted trouble letter over many draws", () => {
  const pool = ["easy", "trouble"];
  const weightFn = (ch) => (ch === "trouble" ? TROUBLE_WEIGHT_CAP : 1);
  let troubleCount = 0;
  const trials = 2000;
  for (let i = 0; i < trials; i++) {
    if (pickWeighted(pool, weightFn) === "trouble") troubleCount += 1;
  }
  // Expected share is TROUBLE_WEIGHT_CAP / (TROUBLE_WEIGHT_CAP + 1) = 80%;
  // allow generous slack since this is a real random draw, not seeded.
  const share = troubleCount / trials;
  assert(share > 0.65, `expected the trouble letter to dominate draws, got ${share}`);
});

test("clamp passes values through unchanged when already in range", () => {
  assertEqual(clamp(5, 2, 30), 5);
});

test("clamp holds the floor and ceiling", () => {
  assertEqual(clamp(0, 2, 30), 2);
  assertEqual(clamp(999, 2, 30), 30);
});

test("rankedMistakes sorts worst-first and drops letters with no misses", () => {
  const ranked = rankedMistakes({ A: 1, B: 5, C: 0, D: 2 });
  assertEqual(ranked, [["B", 5], ["D", 2], ["A", 1]]);
});

test("rankedMistakes respects the limit", () => {
  const ranked = rankedMistakes({ A: 1, B: 5, D: 2 }, 2);
  assertEqual(ranked, [["B", 5], ["D", 2]]);
});

test("rankedMistakes is empty for a missing or empty mistakes map", () => {
  assertEqual(rankedMistakes(undefined), []);
  assertEqual(rankedMistakes({}), []);
});
