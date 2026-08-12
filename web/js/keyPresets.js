// Keyer presets: named snapshots of the physical-key-related settings
// fields, so a learner with multiple keys/paddles/interfaces (e.g. a
// straight key at one desk, a paddle-through-a-keyer-interface at another)
// can switch between them without re-mapping or re-calibrating each time.
//
// Pure data functions only — no DOM, no profile-saving side effects.
// Callers (settings.js) own writing the result into profile.settings and
// calling app.saveProfile().

export const KEY_PRESET_FIELDS = [
  "keyType",
  "keyConnection",
  "keyHidCode",
  "keyHidDitCode",
  "keyHidDahCode",
  "keyHidDebounceMs",
  "swapDitDah",
  "keyAudioDeviceId",
  "keySensitivity",
  "keyAudioThresholdLevel",
  "keyAudioHysteresis",
  "keyAudioMinToneMs",
  "keyAudioPolarity",
  "keyLastCalibration",
];

export function snapshotKeySettings(settings) {
  const snap = {};
  for (const f of KEY_PRESET_FIELDS) snap[f] = settings[f];
  return snap;
}

export function applyKeyPreset(settings, preset) {
  for (const f of KEY_PRESET_FIELDS) settings[f] = preset[f];
}

let _idCounter = 0;
export function makePresetId() {
  return `${Date.now().toString(36)}-${(_idCounter++).toString(36)}`;
}

export function createKeyPreset(name, settings) {
  return { id: makePresetId(), name, ...snapshotKeySettings(settings) };
}

// True if `settings`'s current key fields exactly match `preset`'s saved
// snapshot — computed on demand rather than tracked as a separate "dirty"
// flag that could drift out of sync with the fields it's describing.
export function presetMatches(settings, preset) {
  return KEY_PRESET_FIELDS.every((f) => JSON.stringify(settings[f]) === JSON.stringify(preset[f]));
}
