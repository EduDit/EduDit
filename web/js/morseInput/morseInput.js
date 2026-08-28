// Factory: picks the right MorseInput implementation for the profile's
// configured connection type. Both implementations share the same
// EventTarget-based { start(), destroy(), addEventListener } surface, so
// every consumer (keyPractice.js, keyTestMode.js, Settings' Input Monitor,
// keyCalibration.js) is written against this one function and never
// imports DeviceEventKeyInput/AudioKeyInput directly.

import { DeviceEventKeyInput } from "./deviceEventKeyInput.js";
import { AudioKeyInput } from "./audioKeyInput.js";

export function createMorseInput(settings) {
  return settings.keyConnection === "audio" ? new AudioKeyInput(settings) : new DeviceEventKeyInput(settings);
}
