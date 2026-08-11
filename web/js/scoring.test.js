import { test, assert, assertEqual } from "./testkit.js";
import {
  calculateResponseScore,
  sessionScore,
  scoreLabel,
  updateFluencyEma,
  EXCELLENT_MS,
  GOOD_MS,
  SLOW_MS,
  VERY_SLOW_MS,
} from "./scoring.js";

test("instant correct answer scores very high", () => {
  assert(calculateResponseScore({ correct: true, responseMs: 0 }) >= 95);
});

test("normal-speed correct answer scores good", () => {
  const s = calculateResponseScore({ correct: true, responseMs: GOOD_MS });
  assert(s >= 70 && s < 95, `expected a good-band score, got ${s}`);
});

test("slow correct answer scores reduced", () => {
  const s = calculateResponseScore({ correct: true, responseMs: SLOW_MS });
  assert(s >= 40 && s < 70, `expected a reduced score, got ${s}`);
});

test("extremely slow correct answer scores low but floored above any incorrect score", () => {
  assertEqual(calculateResponseScore({ correct: true, responseMs: VERY_SLOW_MS * 5 }), 25);
});

test("fast incorrect answer scores low", () => {
  const s = calculateResponseScore({ correct: false, responseMs: 100 });
  assert(s <= 20, `expected a low score, got ${s}`);
});

test("slow incorrect answer scores very low", () => {
  const s = calculateResponseScore({ correct: false, responseMs: VERY_SLOW_MS });
  assert(s <= 5, `expected a very low score, got ${s}`);
});

test("score always stays within 0-100", () => {
  for (const ms of [-100, 0, 500, EXCELLENT_MS, GOOD_MS, SLOW_MS, VERY_SLOW_MS, 999999]) {
    for (const correct of [true, false]) {
      const s = calculateResponseScore({ correct, responseMs: ms });
      assert(s >= 0 && s <= 100, `score ${s} out of range for correct=${correct} ms=${ms}`);
    }
  }
});

test("a faster correct response never scores lower than an otherwise-identical slower one", () => {
  const fast = calculateResponseScore({ correct: true, responseMs: 500 });
  const slow = calculateResponseScore({ correct: true, responseMs: 4000 });
  assert(fast >= slow, `fast (${fast}) should be >= slow (${slow})`);
});

test("a faster incorrect response never scores lower than an otherwise-identical slower one", () => {
  const fast = calculateResponseScore({ correct: false, responseMs: 200 });
  const slow = calculateResponseScore({ correct: false, responseMs: 8000 });
  assert(fast >= slow, `fast (${fast}) should be >= slow (${slow})`);
});

test("no incorrect response ever outscores any correct response", () => {
  const worstCorrect = calculateResponseScore({ correct: true, responseMs: VERY_SLOW_MS * 10 });
  const bestIncorrect = calculateResponseScore({ correct: false, responseMs: 0 });
  assert(worstCorrect > bestIncorrect, `worst correct (${worstCorrect}) should beat best incorrect (${bestIncorrect})`);
});

test("a fast wrong guess never scores as high as a legitimate slow-but-correct answer", () => {
  const fastWrong = calculateResponseScore({ correct: false, responseMs: 50 });
  const slowCorrect = calculateResponseScore({ correct: true, responseMs: SLOW_MS });
  assert(fastWrong < slowCorrect, `fast wrong (${fastWrong}) must not outscore slow correct (${slowCorrect})`);
});

test("boundary values match each anchor exactly", () => {
  assertEqual(calculateResponseScore({ correct: true, responseMs: 0 }), 100);
  assertEqual(calculateResponseScore({ correct: true, responseMs: EXCELLENT_MS }), 95);
  assertEqual(calculateResponseScore({ correct: true, responseMs: GOOD_MS }), 80);
  assertEqual(calculateResponseScore({ correct: true, responseMs: SLOW_MS }), 50);
  assertEqual(calculateResponseScore({ correct: true, responseMs: VERY_SLOW_MS }), 25);
  assertEqual(calculateResponseScore({ correct: false, responseMs: 0 }), 18);
  assertEqual(calculateResponseScore({ correct: false, responseMs: GOOD_MS }), 10);
  assertEqual(calculateResponseScore({ correct: false, responseMs: VERY_SLOW_MS }), 2);
});

test("sessionScore averages a session's scores", () => {
  const scores = [92, 88, 95, 42, 97, 8, 91];
  const expected = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  assertEqual(sessionScore(scores), expected);
});

test("sessionScore returns null for an empty/unscored session, never 0", () => {
  assertEqual(sessionScore([]), null);
  assertEqual(sessionScore(undefined), null);
});

test("scoreLabel buckets scores into quiet qualitative feedback", () => {
  assertEqual(scoreLabel(95), "Excellent");
  assertEqual(scoreLabel(75), "Good");
  assertEqual(scoreLabel(40), "Keep practicing");
});

test("updateFluencyEma seeds from the first sample, then blends recency-weighted", () => {
  assertEqual(updateFluencyEma(null, 2000), 2000);
  const blended = updateFluencyEma(2000, 1000);
  assert(blended < 2000 && blended > 1000, `expected a blend between 1000-2000, got ${blended}`);
});
