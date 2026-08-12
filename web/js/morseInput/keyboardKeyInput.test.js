import { test, assert, assertEqual } from "../testkit.js";
import { KeyboardKeyInput, debounceMsFromSensitivity } from "./keyboardKeyInput.js";

// keyHidDebounceMs defaults to 0 here (not the real-world null-derives-from-
// sensitivity default) because these tests dispatch synthetic events back to
// back with ~0ms of real elapsed time between them — any nonzero debounce
// window would filter the second edge as "too soon after the first," which
// is correct debounce behavior but not what most of these tests are about.
// The dedicated debounce test below overrides this explicitly.
function baseSettings(overrides = {}) {
  return {
    keyType: "straight",
    keyHidCode: "KeyF",
    keyHidDitCode: null,
    keyHidDahCode: null,
    keyHidDebounceMs: 0,
    keySensitivity: 50,
    swapDitDah: false,
    ...overrides,
  };
}

function withInput(settings, fn) {
  const input = new KeyboardKeyInput(settings);
  const events = [];
  const raw = [];
  input.addEventListener("morsekey", (e) => events.push(e.detail));
  input.addEventListener("morsekeyraw", (e) => raw.push(e.detail));
  input.start();
  try {
    fn(events, raw);
  } finally {
    input.destroy();
  }
}

test("debounceMsFromSensitivity: higher sensitivity yields a shorter debounce window", () => {
  assert(debounceMsFromSensitivity(100) < debounceMsFromSensitivity(0));
});

test("KeyboardKeyInput: straight key dispatches generic down/up for the mapped code", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF" }));
    assertEqual(
      events.map((e) => [e.action, e.element]),
      [["down", "generic"], ["up", "generic"]]
    );
  });
});

test("KeyboardKeyInput: ignores keys that aren't mapped", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyZ" }));
    assertEqual(events.length, 0);
  });
});

test("KeyboardKeyInput: ignores OS key-repeat", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", repeat: true }));
    assertEqual(events.length, 0);
  });
});

test("KeyboardKeyInput: double paddle maps dit/dah to independently-configured codes", () => {
  withInput(baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK" }), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK" }));
    assertEqual(events.map((e) => e.element), ["dit", "dah"]);
  });
});

test("KeyboardKeyInput: swapDitDah reverses which physical key means dit vs dah", () => {
  withInput(
    baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK", swapDitDah: true }),
    (events) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" }));
      assertEqual(events[0].element, "dah");
    }
  );
});

test("KeyboardKeyInput: a huge debounce window filters a same-frame bounce and reports it on morsekeyraw", () => {
  withInput(baseSettings({ keyHidDebounceMs: 1000 }), (events, raw) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF" }));
    assertEqual(raw[0].filtered, false);
    assertEqual(raw[1].filtered, true);
    assertEqual(events.length, 1, "the filtered second edge must not reach morsekey");
  });
});

test("KeyboardKeyInput: straight-key mapping is inert while keyType is paddle, and vice versa", () => {
  withInput(baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK" }), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" })); // the straight-key mapping from baseSettings
    assertEqual(events.length, 0);
  });
});
