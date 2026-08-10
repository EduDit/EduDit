// Per-profile load/save backed by localStorage — the browser equivalent of
// morse/storage.py's per-file JSON layout. Everything lives under one key:
//   { profiles: ["Alice", "Bob"], data: { "Alice": {...}, "Bob": {...} } }

const STORAGE_KEY = "ditdash";

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

function _writeAll(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
    send_seen: {},
    send_miss_streak: {},
    send_mistakes: {},
    mistakes: {},
    custom_lessons: [],
    pin: null,
    settings: {
      wpm: 15,
      freq: 600,
      volume: 70,
      dotKey: null,
      dashKey: null,
      keepAwake: false,
      listenRepeats: 3,
      listenRepeatGapUnits: 6,
      listenGapUnits: 7,
      listenSpeakLetters: false,
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
