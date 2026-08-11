import { test, assert, assertEqual } from "./testkit.js";
import { isStrong, stateFor } from "./characterState.js";

test("isStrong requires both a minimum attempt count and 90%+ accuracy", () => {
  assert(!isStrong(5, 0), "5 attempts should not count as strong even at 100%");
  assert(!isStrong(10, 2), "80% accuracy should not count as strong");
  assert(isStrong(10, 1), "90% accuracy at 10 attempts should count as strong");
  assert(isStrong(20, 0), "100% accuracy well above the minimum should count as strong");
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
