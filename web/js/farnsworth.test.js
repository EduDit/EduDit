import { test, assert, assertEqual } from "./testkit.js";
import { unitMs, resolveFarnsworthWpm, buildTimeline } from "./farnsworth.js";
import { MORSE } from "./codes.js";

test("resolveFarnsworthWpm: null/0 means off, matches character speed", () => {
  assertEqual(resolveFarnsworthWpm(20, null), 20);
  assertEqual(resolveFarnsworthWpm(20, 0), 20);
  assertEqual(resolveFarnsworthWpm(20, undefined), 20);
});

test("resolveFarnsworthWpm: never exceeds character speed", () => {
  assertEqual(resolveFarnsworthWpm(10, 20), 10);
  assertEqual(resolveFarnsworthWpm(20, 10), 10);
});

test("buildTimeline: dot/dash durations always use full character speed, regardless of Farnsworth", () => {
  const charUnit = unitMs(20);
  for (const farnsworthWpm of [null, 20, 10, 5]) {
    const steps = buildTimeline("E", MORSE, 20, farnsworthWpm); // E = "."
    assertEqual(steps, [{ tone: true, durationMs: charUnit }]);
  }
});

test("buildTimeline: intra-character gap always uses full character speed", () => {
  const charUnit = unitMs(15);
  const steps = buildTimeline("A", MORSE, 15, 5); // A = ".-"
  // dot, intra-char gap, dash — gap must be charUnit (15 wpm), not the 5 wpm spacing unit.
  assertEqual(steps[1], { tone: false, durationMs: charUnit });
});

test("buildTimeline: inter-character gap scales only with Farnsworth speed, not character speed", () => {
  const spaceUnit = unitMs(5);
  const expectedGap = { tone: false, durationMs: spaceUnit * 3 };
  const stepsSlowChar = buildTimeline("ET", MORSE, 12, 5); // E="." T="-"
  const stepsFastChar = buildTimeline("ET", MORSE, 30, 5);
  // Both target chars are single dot/dash, so index 1 is the inter-char gap.
  assertEqual(stepsSlowChar[1], expectedGap, "12 wpm char speed");
  assertEqual(stepsFastChar[1], expectedGap, "30 wpm char speed");
});

test("buildTimeline: word gap (space) uses the Farnsworth unit, 7 units", () => {
  const spaceUnit = unitMs(5);
  const steps = buildTimeline("E T", MORSE, 20, 5); // "." <word gap> "-"
  assertEqual(steps[1], { tone: false, durationMs: spaceUnit * 7 });
});

test("buildTimeline: Farnsworth off (null) makes spacing match character speed exactly", () => {
  const charUnit = unitMs(20);
  const steps = buildTimeline("ET", MORSE, 20, null);
  assertEqual(steps[1], { tone: false, durationMs: charUnit * 3 });
});

test("buildTimeline: unknown characters are skipped without throwing", () => {
  const withUnknown = buildTimeline("E#T", MORSE, 20, null);
  const withoutUnknown = buildTimeline("ET", MORSE, 20, null);
  assertEqual(withUnknown, withoutUnknown);
});

test("buildTimeline: every generated step has a positive duration", () => {
  const steps = buildTimeline("CQ DE W1AW", MORSE, 18, 10);
  assert(steps.length > 0, "should produce steps");
  for (const step of steps) {
    assert(step.durationMs > 0, `step duration must be positive, got ${step.durationMs}`);
  }
});
