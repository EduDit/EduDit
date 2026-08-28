// Per-profile load/save backed by localStorage — the browser equivalent of
// morse/storage.py's per-file JSON layout. Everything lives under one key:
//   { profiles: ["Alice", "Bob"], data: { "Alice": {...}, "Bob": {...} } }

const STORAGE_KEY = "edudit";
const THEME_KEY = "edudit-theme";

// Data saved before the app was renamed from DitDash lives under the old
// keys; move it across once so existing users keep their profiles.
const LEGACY_STORAGE_KEY = "ditdash";
const LEGACY_THEME_KEY = "ditdash-theme";

function _migrateLegacyKey(oldKey, newKey) {
  try {
    if (localStorage.getItem(newKey) === null) {
      const legacy = localStorage.getItem(oldKey);
      if (legacy !== null) {
        localStorage.setItem(newKey, legacy);
        localStorage.removeItem(oldKey);
      }
    }
  } catch (e) {
    // Storage unavailable — nothing to migrate.
  }
}

_migrateLegacyKey(LEGACY_STORAGE_KEY, STORAGE_KEY);
_migrateLegacyKey(LEGACY_THEME_KEY, THEME_KEY);

function _readAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profiles: [], data: {} };
    const parsed = JSON.parse(raw);
    return {
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      data: typeof parsed.data === "object" && parsed.data ? parsed.data : {},
    };
  } catch (e) {
    return { profiles: [], data: {} };
  }
}

function _storageFailed(action, error) {
  window.dispatchEvent(new CustomEvent("edudit-storage-error", {
    detail: { action, message: error && error.message ? error.message : String(error) },
  }));
}

function _writeAll(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    _storageFailed("save progress", error);
    return false;
  }
}

// Appearance is a device preference, not a per-profile one — stored outside
// the profile blob so it applies immediately at boot, before any profile is
// chosen (Profile Select included), and stays consistent across profiles on
// the same device.
export function getTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch (error) {
    return "system";
  }
}

export function setTheme(theme) {
  try {
    if (theme === "light" || theme === "dark") {
      localStorage.setItem(THEME_KEY, theme);
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  } catch (error) {
    _storageFailed("save appearance settings", error);
  }
}

export function defaultProfile() {
  return {
    receive_level: 1,
    send_level: 1,
    receive_streak: 0,
    send_streak: 0,
    receive_seen: {},
    receive_miss_streak: {},
    receive_mistakes: {},
    // { char: count } — "I don't know" uses on Receive Practice. Neutral by
    // design (never a mistake, never a streak penalty), but still needs to
    // be excluded from accuracy/achievement math or it would inflate
    // "correct" — see achievements.js and mainMenu.js's _overallAccuracy.
    receive_dont_know: {},
    // { char: exponential-moving-average response ms } — Receive-mode
    // "blind" rounds only (auto-hint/brand-new/"I don't know" rounds are
    // excluded, see receivePractice.js). Read by characterState.js's
    // isStrong() as fluency, kept entirely separate from accuracy — see
    // scoring.js.
    receive_fluency_ms: {},
    send_seen: {},
    send_miss_streak: {},
    send_mistakes: {},
    // Send-mode counterpart of receive_fluency_ms above.
    send_fluency_ms: {},
    mistakes: {},
    custom_lessons: [],
    pin: null,
    // Set true after the first-run intro is shown or skipped, so it only
    // ever appears once per profile.
    onboarded: false,
    // { achievementId: unlockedAtISOString } — see achievements.js.
    achievements: {},
    // { "YYYY-MM-DD": activeMsPracticedThatDay } — see dailyPractice.js.
    daily_practice: {},
    // Callsign/QSO Practice's own counters — kept separate from
    // receive_seen/mistakes (see callsignPractice.js): a wrong whole-
    // callsign guess doesn't identify which single character was wrong, so
    // folding it into per-letter accuracy would misrepresent that stat.
    callsign_stats: { attempts: 0, correct: 0 },
    settings: {
      wpm: 15,
      freq: 600,
      volume: 70,
      // Governs everything about *producing* Morse (Send Practice, Key
      // Practice, Free Keying): the dot/dash hold-time threshold, the
      // decode gap, and physical-key debounce timing. Deliberately
      // independent of `wpm` (which drives Receive/Listen/Callsigns) — a
      // beginner can only physically key a fraction of the speed they can
      // already recognize by ear, so defaulting well below the recommended
      // 22 WPM receiving speed keeps Send Practice attainable from day one.
      sendWpm: 10,
      // null = off, spacing matches character speed. See farnsworth.js.
      farnsworthWpm: null,
      dotKey: null,
      dashKey: null,
      keepAwake: false,
      listenRepeats: 3,
      listenRepeatGapUnits: 6,
      listenGapUnits: 7,
      listenSpeakLetters: false,
      // null | "new" | "some" | "experienced" — asked once during
      // onboarding, purely informational (copy/emphasis only, never the
      // learning order or adaptive weighting).
      priorExperience: null,

      // Physical Morse key input — see morseInput/*.js, keyPractice.js,
      // keyCalibration.js. Flat fields (not a nested object) so loadProfile()'s
      // shallow Object.assign(profile.settings, stored.settings) merge keeps
      // giving old profiles a default for any field added here later, the
      // same way dotKey/dashKey above already work.
      keyType: "straight", // "straight" | "paddle"
      keyConnection: "hid", // "hid" (keyboard/HID-emulating interface) | "audio"
      keyHidEventSource: "keyboard", // "keyboard" | "mouse" — which DOM events the "hid" interface actually sends
      // Mouse mode only: a mapped click is treated as a real mouse click
      // (not Morse input) if it follows recent cursor movement — the
      // adapter never moves the cursor itself. Best-effort, not device
      // identification — see morseInput/deviceEventKeyInput.js.
      keyHidMovePassthrough: true,
      keyHidCode: null, // straight key: KeyboardEvent.code, or "MouseN" (see morseInput/deviceEventKeyInput.js)
      keyHidDitCode: null, // double paddle: dit contact's KeyboardEvent.code
      keyHidDahCode: null, // double paddle: dah contact's KeyboardEvent.code
      keyHidDebounceMs: null, // null = derive from keySensitivity
      swapDitDah: false, // reversed paddle orientation
      keyAudioDeviceId: null, // null = browser default input
      keySensitivity: 50, // 0-100, drives keyHidDebounceMs / keyAudioThresholdLevel when unset
      keyAudioThresholdLevel: null, // null = derive from keySensitivity + calibrated background level
      keyAudioHysteresis: 0.02, // small fixed margin, same units as the RMS level signal (0-1)
      keyAudioMinToneMs: null, // null = derive per the WPM-scaled floor/ceiling formula in morseInput/audioKeyInput.js
      keyAudioPolarity: null, // "keyDownLouder" | "keyDownQuieter" — null until Calibration measures it
      keyLastCalibration: null, // diagnostic snapshot only, never required for normal operation
      // Named snapshots of the key* fields above, so a learner with
      // multiple keys/paddles/interfaces can switch between them without
      // re-mapping/re-calibrating each time — see keyPresets.js.
      keyPresets: [],
      activeKeyPresetId: null, // which saved preset (if any) the fields above currently match
    },
  };
}

// A light, client-side-only PIN gate — not real security (anyone with
// devtools can read localStorage directly), just a soft deterrent so one
// person's profile isn't casually poked at by another person on the same
// device. Never store the PIN itself, only this hash.
function _hashPin(pin) {
  const str = String(pin ?? "").trim();
  if (!str) return null;
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function verifyPin(profile, pin) {
  if (!profile.pin) return true;
  return profile.pin === _hashPin(pin);
}

export function setPin(profile, pin) {
  profile.pin = _hashPin(pin);
}

export function listProfiles() {
  return _readAll().profiles;
}

export function loadProfile(name) {
  const profile = defaultProfile();
  const stored = _readAll().data[name];
  if (stored) {
    for (const key of Object.keys(stored)) {
      if (key === "settings" && typeof stored.settings === "object") {
        Object.assign(profile.settings, stored.settings);
      } else {
        profile[key] = stored[key];
      }
    }
  }
  return profile;
}

export function saveProfile(name, profile) {
  const state = _readAll();
  state.data[name] = profile;
  if (!state.profiles.includes(name)) {
    state.profiles.push(name);
  }
  _writeAll(state);
}

export function createProfile(name, pin) {
  const profile = defaultProfile();
  if (pin) profile.pin = _hashPin(pin);
  saveProfile(name, profile);
  return profile;
}

export function renameProfile(oldName, newName) {
  const state = _readAll();
  const index = state.profiles.indexOf(oldName);
  if (index === -1 || Object.prototype.hasOwnProperty.call(state.data, newName)) return false;
  state.data[newName] = state.data[oldName];
  delete state.data[oldName];
  state.profiles[index] = newName;
  return _writeAll(state);
}

export function deleteProfile(name) {
  const state = _readAll();
  if (!state.profiles.includes(name)) return false;
  state.profiles = state.profiles.filter((profileName) => profileName !== name);
  delete state.data[name];
  return _writeAll(state);
}
