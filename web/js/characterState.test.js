import { test, assert, assertEqual } from "./testkit.js";
import { isStrong, stateFor, FLUENT_MS_THRESHOLD } from "./characterState.js";

test("isStrong requires both a minimum attempt count and 90%+ accuracy", () => {
  assert(!isStrong(5, 0), "5 attempts should not count as strong even at 100%");
  assert(!isStrong(10, 2), "80% accuracy should not count as strong");
  assert(isStrong(10, 1), "90% accuracy at 10 attempts should count as strong");
  assert(isStrong(20, 0), "100% accuracy well above the minimum should count as strong");
});

test("isStrong ignores fluency entirely when avgResponseMs is omitted", () => {
  assert(isStrong(20, 0), "accuracy-only call (no 3rd arg) keeps its original behavior");
});

test("a highly accurate but slow-to-recognize character is not yet strong", () => {
  assert(
    !isStrong(20, 0, FLUENT_MS_THRESHOLD + 1000),
    "99%+ accuracy alone should not count as strong once fluency data says it's still slow"
  );
});

test("a highly accurate and fast-to-recognize character is strong", () => {
  assert(isStrong(20, 0, FLUENT_MS_THRESHOLD - 500));
});

test("stateFor returns locked for a character outside the unlocked pool", () => {
  assertEqual(stateFor("M", 1, {}, {}), "locked");
});

test("stateFor returns learning for an unlocked character with no attempts yet", () => {
  assertEqual(stateFor("E", 1, {}, {}), "learning");
});

test("stateFor returns practicing for an unlocked, attempted, not-yet-strong character", () => {
  assertEqual(stateFor("E", 1, { E: 3 }, { E: 1 }), "practicing");
});

test("stateFor returns strong once a character meets the strong threshold", () => {
  assertEqual(stateFor("E", 1, { E: 10 }, { E: 0 }), "strong");
});
