import { test, assert, assertEqual } from "../testkit.js";
import {
  rmsLevel,
  thresholdFromSensitivity,
  effectiveMinToneMs,
  AUDIO_RELIABLE_WPM_CEILING,
} from "./audioKeyInput.js";
import { unitMs } from "../timing.js";

// AudioKeyInput itself needs a real microphone (getUserMedia) to run, which
// isn't available in this zero-dependency browser test harness — these
// tests cover the pure math it's built on instead. Manual hardware QA (see
// the plan's verification section) covers the real getUserMedia/AnalyserNode
// path end to end.

test("rmsLevel: silence (all zeros) is 0", () => {
  assertEqual(rmsLevel(new Float32Array(8)), 0);
});

test("rmsLevel: a constant-amplitude buffer equals that amplitude", () => {
  assertEqual(rmsLevel(new Float32Array(4).fill(0.5)), 0.5);
});

test("rmsLevel: alternating +1/-1 has RMS 1", () => {
  assertEqual(rmsLevel(Float32Array.from([1, -1, 1, -1])), 1);
});

test("thresholdFromSensitivity: higher sensitivity gives a lower (easier to trigger) threshold", () => {
  assert(thresholdFromSensitivity(100) < thresholdFromSensitivity(0));
});

test("thresholdFromSensitivity: clamps out-of-range input", () => {
  assertEqual(thresholdFromSensitivity(150), thresholdFromSensitivity(100));
  assertEqual(thresholdFromSensitivity(-50), thresholdFromSensitivity(0));
});

test("effectiveMinToneMs: an explicit override always wins", () => {
  assertEqual(effectiveMinToneMs(20, 12), 12);
});

test("effectiveMinToneMs: below the WPM ceiling, stays above the rAF floor and below a real dit", () => {
  const wpm = 20;
  const ms = effectiveMinToneMs(wpm, null);
  assert(ms < unitMs(wpm), "must stay below a real dit's duration so it isn't swallowed");
  assert(ms >= 17, "must stay at/above the rAF polling floor");
});

test("effectiveMinToneMs: at 30 WPM the floor clamp has already engaged", () => {
  assertEqual(effectiveMinToneMs(30, null), 17);
});

test("effectiveMinToneMs: never drops below the 17ms rAF floor at any WPM", () => {
  for (const wpm of [5, 10, 20, 28, 30, 40, 60, 100]) {
    assert(effectiveMinToneMs(wpm, null) >= 17, `wpm=${wpm} dropped below the rAF floor`);
  }
});

test("AUDIO_RELIABLE_WPM_CEILING: documents where the floor clamp starts to bind", () => {
  // Just below the documented ceiling, the WPM-scaled value should still be
  // at or above the floor without clamping; this is a sanity check on the
  // documented constant, not a strict boundary requirement.
  assert(unitMs(AUDIO_RELIABLE_WPM_CEILING) * 0.4 >= 17);
});
