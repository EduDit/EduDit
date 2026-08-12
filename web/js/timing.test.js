import { test, assertEqual } from "./testkit.js";
import { unitMs, decodeGapMs, DECODE_GAP_UNITS, DECODE_GAP_MIN_MS } from "./timing.js";

test("unitMs: PARIS formula, 1200/wpm", () => {
  assertEqual(unitMs(60), 20);
  assertEqual(unitMs(20), 60);
  assertEqual(unitMs(5), 240);
});

test("unitMs: guards against zero/negative wpm", () => {
  assertEqual(unitMs(0), 1200);
  assertEqual(unitMs(-5), 1200);
});

test("decodeGapMs: uses DECODE_GAP_UNITS * unitMs when that exceeds the floor", () => {
  assertEqual(decodeGapMs(5), DECODE_GAP_UNITS * unitMs(5));
});

test("decodeGapMs: floors at DECODE_GAP_MIN_MS for fast wpm", () => {
  assertEqual(decodeGapMs(60), DECODE_GAP_MIN_MS);
});
