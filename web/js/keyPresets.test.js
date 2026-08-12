import { test, assert, assertEqual } from "./testkit.js";
import {
  KEY_PRESET_FIELDS,
  snapshotKeySettings,
  applyKeyPreset,
  createKeyPreset,
  presetMatches,
  makePresetId,
} from "./keyPresets.js";

function fakeSettings(overrides = {}) {
  const base = {};
  for (const f of KEY_PRESET_FIELDS) base[f] = null;
  return {
    ...base,
    keyType: "straight",
    keyConnection: "hid",
    keyHidCode: "KeyJ",
    wpm: 20, // a non-preset field, should never be touched by preset logic
    ...overrides,
  };
}

test("snapshotKeySettings: captures only the key-related fields, nothing else", () => {
  const snap = snapshotKeySettings(fakeSettings());
  assertEqual(Object.keys(snap).sort(), [...KEY_PRESET_FIELDS].sort());
  assert(!("wpm" in snap), "unrelated settings fields must not leak into a preset");
});

test("createKeyPreset: stores a name and a unique id alongside the snapshot", () => {
  const preset = createKeyPreset("Desk paddle", fakeSettings());
  assertEqual(preset.name, "Desk paddle");
  assert(!!preset.id, "preset must have an id");
  assertEqual(preset.keyHidCode, "KeyJ");
});

test("makePresetId: never returns the same id twice", () => {
  const ids = new Set();
  for (let i = 0; i < 20; i++) ids.add(makePresetId());
  assertEqual(ids.size, 20);
});

test("applyKeyPreset: overwrites only the preset fields on the target settings object", () => {
  const settings = fakeSettings({ keyHidCode: "KeyF", wpm: 25 });
  const preset = createKeyPreset("Paddle rig", fakeSettings({ keyType: "paddle", keyHidDitCode: "KeyN", keyHidDahCode: "KeyM" }));
  applyKeyPreset(settings, preset);
  assertEqual(settings.keyType, "paddle");
  assertEqual(settings.keyHidDitCode, "KeyN");
  assertEqual(settings.keyHidDahCode, "KeyM");
  assertEqual(settings.wpm, 25, "fields outside KEY_PRESET_FIELDS must be left alone");
});

test("presetMatches: true right after saving, false after any tracked field changes", () => {
  const settings = fakeSettings();
  const preset = createKeyPreset("Straight key", settings);
  assert(presetMatches(settings, preset));
  settings.keySensitivity = 90;
  assert(!presetMatches(settings, preset));
});

test("presetMatches: unrelated field changes don't count as a mismatch", () => {
  const settings = fakeSettings();
  const preset = createKeyPreset("Straight key", settings);
  settings.wpm = 40;
  assert(presetMatches(settings, preset), "changing a non-key field must not mark the preset as modified");
});
