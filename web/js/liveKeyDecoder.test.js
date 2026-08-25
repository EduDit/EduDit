import { test, assert, assertEqual } from "./testkit.js";
import { LiveKeyDecoder } from "./liveKeyDecoder.js";

function fakeApp(sendWpm = 20) {
  return {
    profile: { settings: { sendWpm, freq: 600, volume: 70 } },
    audio: { playPattern() {} },
  };
}

test("LiveKeyDecoder: onDit/onDah append symbols directly, no timing involved", () => {
  const patterns = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onPatternChange: (p) => patterns.push(p) });
  d.onDit();
  d.onDah();
  assertEqual(patterns, [".", ".-"]);
  d.destroy();
});

test("LiveKeyDecoder: a near-instant press/release (straight key) classifies as a dot", () => {
  const patterns = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onPatternChange: (p) => patterns.push(p) });
  d.onDown();
  d.onUp();
  assertEqual(patterns, ["."]);
  d.destroy();
});

test("LiveKeyDecoder: a long simulated hold classifies as a dash", () => {
  const patterns = [];
  const d = new LiveKeyDecoder({ app: fakeApp(20), onPatternChange: (p) => patterns.push(p) });
  d.onDown();
  // Simulate a hold well past the dot/dash threshold without a real wait.
  d._pressTime = performance.now() - 1000;
  d.onUp();
  assertEqual(patterns, ["-"]);
  d.destroy();
});

test("LiveKeyDecoder: onUp() with no prior onDown() is a no-op", () => {
  const patterns = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onPatternChange: (p) => patterns.push(p) });
  d.onUp();
  assertEqual(patterns.length, 0);
  d.destroy();
});

test("LiveKeyDecoder: _decode() resolves a completed pattern to a character and resets", () => {
  const chars = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onCharacter: (c) => chars.push(c) });
  d.onDit(); // "." = E
  d._decode();
  assertEqual(chars, ["E"]);
  assertEqual(d.pattern, "");
  d.destroy();
});

test("LiveKeyDecoder: an unrecognized pattern decodes to '?' rather than throwing", () => {
  const chars = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onCharacter: (c) => chars.push(c) });
  for (let i = 0; i < 9; i++) d.onDit();
  d._decode();
  assertEqual(chars, ["?"]);
  d.destroy();
});

test("LiveKeyDecoder: never touches profile fields — structurally non-scoring", () => {
  const app = fakeApp();
  app.profile.send_seen = { A: 3 };
  app.profile.mistakes = { B: 1 };
  const before = JSON.stringify(app.profile);
  const d = new LiveKeyDecoder({ app });
  d.onDit();
  d._decode();
  d.onDah();
  d._decode();
  assertEqual(JSON.stringify(app.profile), before, "profile must be unchanged by LiveKeyDecoder");
  d.destroy();
});

test("LiveKeyDecoder: destroy() cancels a pending decode timer without firing onCharacter", () => {
  const chars = [];
  const d = new LiveKeyDecoder({ app: fakeApp(), onCharacter: (c) => chars.push(c) });
  d.onDit(); // arms the decode timer
  d.destroy();
  assertEqual(chars.length, 0);
});
