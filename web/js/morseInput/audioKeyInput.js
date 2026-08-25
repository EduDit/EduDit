// A MorseInput source for a bare Morse key/paddle wired directly into a
// mic/aux input (no external tone-generating keyer in the signal path).
//
// This is deliberately broadband level (RMS) detection, not tone/frequency
// detection — there is no oscillator anywhere for this hardware, so there is
// no tone to look for. Closing the contact interacts with the sound card's
// mic-bias circuit and typically produces either a broadband click/transient
// or a shift toward near-silence; which direction reads as "louder" is
// hardware-dependent (see keyAudioPolarity) and cannot be assumed.

import { DebounceFilter } from "./debounce.js";
import { unitMs } from "../timing.js";

const RAF_FLOOR_MS = 17; // requestAnimationFrame's practical polling granularity
const FFT_SIZE = 2048;

// WPM above which the clamp in effectiveMinToneMs() stops scaling down and
// audio input's contact-bounce filtering becomes less precise (the rAF+
// AnalyserNode approach can no longer both sit above its own polling floor
// and below a real dit's duration). Surfaced as a plain-language advisory
// in Settings/Calibration, not a silent failure. A future AudioWorklet
// rewrite removes this ceiling without changing the morsekey contract.
export const AUDIO_RELIABLE_WPM_CEILING = 28;

// Effective minimum tone/silence duration for debounce, when the user
// hasn't set an explicit override. Must sit above the rAF polling floor (or
// bounce filtering becomes unreliable) and below a real dit's duration at
// the configured WPM (or legitimate fast keying gets swallowed) — those two
// constraints only both hold up to roughly AUDIO_RELIABLE_WPM_CEILING; above
// that this clamps to the rAF floor rather than shrinking further.
export function effectiveMinToneMs(wpm, override) {
  if (override != null) return override;
  return Math.max(RAF_FLOOR_MS, Math.min(20, unitMs(wpm) * 0.4));
}

// RMS (root-mean-square) level of a Float32Array time-domain buffer — the
// one broadband loudness measure this module reads on every tick. Ranges
// roughly 0-1 for audio sample data.
export function rmsLevel(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// Maps the friendly 0-100 Sensitivity slider onto a raw RMS threshold, used
// whenever keyAudioThresholdLevel is null (not manually overridden) — see
// settings.js's Sensitivity/Advanced interaction rule. Calibration
// generally supersedes this with a threshold derived from real measured
// levels; this is only the pre-calibration/no-override fallback.
export function thresholdFromSensitivity(sensitivity) {
  const s = Math.max(0, Math.min(100, sensitivity ?? 50));
  return 0.3 - (s / 100) * 0.28;
}

export class AudioKeyInput extends EventTarget {
  constructor(settings) {
    super();
    this._s = settings;
    this._raf = null;
    this._ctx = null;
    this._stream = null;
    this._analyser = null;
    this._buf = null;
    this._isOn = false;
    // sendWpm, not wpm — this debounce window tracks the physical keying
    // speed the user actually produces, not the Character Speed used for
    // Receive/Listen. See the matching comment in sendPractice.js.
    this._debounce = new DebounceFilter(effectiveMinToneMs(settings.sendWpm, settings.keyAudioMinToneMs));
  }

  // Refuses to start until Calibration has determined a polarity — there is
  // no safe default to guess (the wrong direction would make every press
  // read as a release and vice versa, worse than not starting at all).
  // Every caller (KeyPractice, KeyTestMode, Settings' Input Monitor,
  // Calibration's own "confirm current settings" step) catches this and
  // prompts the user to calibrate, mirroring how permission-denied is
  // handled — a blocking-but-clear state, never a silent guess.
  // `allowUncalibrated` is for keyCalibration.js only: calibration's whole
  // job is to *determine* keyAudioPolarity, so it needs a real level stream
  // before that value exists. In that mode, raw "level" events (rmsLevel is
  // independent of polarity) still flow normally, but "morsekey" detection
  // — which would be meaningless without a real polarity — is suppressed.
  async start({ allowUncalibrated = false } = {}) {
    if (!this._s.keyAudioPolarity && !allowUncalibrated) {
      const err = new Error("Audio key input needs calibration before it can start.");
      err.code = "NEEDS_CALIBRATION";
      throw err;
    }
    this._calibrating = allowUncalibrated;

    try {
      this._stream = await this._openStream(this._s.keyAudioDeviceId);
    } catch (err) {
      // A previously-selected device can vanish (unplugged, permissions
      // changed) — fall back to the default input rather than making the
      // whole feature unusable because of one stale device ID.
      if (this._s.keyAudioDeviceId && (err.name === "OverconstrainedError" || err.name === "NotFoundError")) {
        this._stream = await this._openStream(null);
      } else {
        throw err;
      }
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this._ctx = new Ctx();
    const src = this._ctx.createMediaStreamSource(this._stream);
    this._analyser = this._ctx.createAnalyser();
    this._analyser.fftSize = FFT_SIZE;
    src.connect(this._analyser);
    this._buf = new Float32Array(this._analyser.fftSize);

    const track = this._stream.getAudioTracks()[0];
    if (track) track.addEventListener("ended", () => this.dispatchEvent(new CustomEvent("disconnected")));

    this._tick();
  }

  _openStream(deviceId) {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
  }

  _tick() {
    this._analyser.getFloatTimeDomainData(this._buf);
    const level = rmsLevel(this._buf);
    const ts = performance.now();
    const s = this._s;

    const threshold = s.keyAudioThresholdLevel ?? thresholdFromSensitivity(s.keySensitivity);
    const hysteresis = s.keyAudioHysteresis ?? 0.02;
    const louder = s.keyAudioPolarity === "keyDownLouder";

    // Schmitt-trigger style hysteresis: which side of the threshold counts
    // as "still on" depends on the currently-held state, so noise sitting
    // right at the threshold can't chatter the detector back and forth.
    const rawOn = louder
      ? this._isOn
        ? level > threshold - hysteresis
        : level > threshold
      : this._isOn
        ? level < threshold + hysteresis
        : level < threshold;

    this._debounce.setMinMs(effectiveMinToneMs(s.sendWpm, s.keyAudioMinToneMs));
    if (!this._calibrating && rawOn !== this._isOn && this._debounce.accept(rawOn ? "down" : "up", ts)) {
      this._isOn = rawOn;
      this.dispatchEvent(
        new CustomEvent("morsekey", { detail: { action: rawOn ? "down" : "up", element: "generic", ts } })
      );
    }
    // Consumed only by the Input Monitor (keyInputMonitor.js) — AudioKeyInput
    // is the single source of truth for both detection and its own display,
    // so the monitor never runs a second, possibly-disagreeing analysis.
    this.dispatchEvent(new CustomEvent("level", { detail: { level, ts, isOn: this._isOn, threshold } }));

    this._raf = requestAnimationFrame(() => this._tick());
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    if (this._stream) this._stream.getTracks().forEach((t) => t.stop());
    if (this._ctx) this._ctx.close();
    this._raf = null;
    this._stream = null;
    this._ctx = null;
    this._analyser = null;
    this._buf = null;
  }
}
