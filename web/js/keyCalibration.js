// Calibration workflow — drives the SAME MorseInput implementations runtime
// uses (a fresh instance owned by this screen, never a second, parallel
// measurement path), so whatever it recommends matches what actually
// happens afterward. Every reported number comes from a real measurement
// taken during the flow — nothing here is fabricated.
//
// Audio: there's no oscillator in this hardware's signal path (see
// audioKeyInput.js), so calibration compares a resting level against a
// pressed level to determine both the polarity (which direction of level
// change means "key down" — hardware-dependent, no safe default to guess)
// and a threshold between the two.
//
// Keyboard/HID: measures real contact-bounce clustering on raw transitions
// to recommend a debounce window.

import { el, button, pageHeader } from "./dom.js";
import { AudioKeyInput } from "./morseInput/audioKeyInput.js";
import { KeyboardKeyInput } from "./morseInput/keyboardKeyInput.js";

const AUDIO_SAMPLE_MS = 2000;
const HID_BOUNCE_TEST_MS = 3000;
const BOUNCE_CLUSTER_GAP_MS = 20;

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class KeyCalibration {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.audioInput = null;
    this.hidInput = null;
    this._samples = [];
    this._rawEvents = [];
    this.result = null;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen view-focused" });
    wrap.appendChild(
      pageHeader({
        eyebrow: "Key Input",
        title: "Calibrate Input",
        actions: [button("Cancel", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );
    this.mount = el("div", {});
    wrap.appendChild(this.mount);
    this.root.innerHTML = "";
    this.root.appendChild(wrap);

    if (this.app.profile.settings.keyConnection === "audio") this._renderAudioIntro();
    else this._renderHidIntro();
  }

  _renderMount(...children) {
    this.mount.innerHTML = "";
    for (const c of children) this.mount.appendChild(c);
  }

  // ---- Audio flow ----

  _renderAudioIntro() {
    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", {
          text:
            "This measures your key's actual electrical signal so DitDash can tell key-down from " +
            "key-up reliably. Two short steps.",
        }),
        el("p", { class: "small muted", text: "Step 1 of 2 — leave your key untouched." }),
        button("Start", () => this._runAudioRest(), "btn-block btn-accent"),
      ])
    );
  }

  async _runAudioRest() {
    this._renderMount(
      el("div", { class: "slider-frame center" }, [
        el("p", { text: "Recording background level…" }),
        el("p", { class: "small muted", text: "Leave your key untouched for a couple of seconds." }),
      ])
    );

    this.audioInput = new AudioKeyInput(this.app.profile.settings);
    try {
      await this.audioInput.start({ allowUncalibrated: true });
    } catch (err) {
      this._renderError(this._describeAudioError(err));
      return;
    }

    this._samples = [];
    const onLevel = (e) => this._samples.push(e.detail.level);
    this.audioInput.addEventListener("level", onLevel);
    await this._sleep(AUDIO_SAMPLE_MS);
    this.audioInput.removeEventListener("level", onLevel);

    this._restSamples = this._samples;
    this._renderAudioPressPrompt();
  }

  _renderAudioPressPrompt() {
    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", { class: "small muted", text: "Step 2 of 2 — press and hold your key." }),
        el("p", { text: "Press and hold your key, then click Start and keep holding until it finishes." }),
        button("Start", () => this._runAudioPress(), "btn-block btn-accent"),
      ])
    );
  }

  async _runAudioPress() {
    this._renderMount(
      el("div", { class: "slider-frame center" }, [
        el("p", { text: "Recording pressed level…" }),
        el("p", { class: "small muted", text: "Keep holding your key down." }),
      ])
    );

    this._samples = [];
    const onLevel = (e) => this._samples.push(e.detail.level);
    this.audioInput.addEventListener("level", onLevel);
    await this._sleep(AUDIO_SAMPLE_MS);
    this.audioInput.removeEventListener("level", onLevel);

    const pressSamples = this._samples;
    this._finishAudioCalibration(this._restSamples, pressSamples);
  }

  _finishAudioCalibration(restSamples, pressSamples) {
    if (this.audioInput) {
      this.audioInput.destroy();
      this.audioInput = null;
    }

    const restLevel = median(restSamples);
    const pressLevel = median(pressSamples);
    const diff = pressLevel - restLevel;
    const restRange = restSamples.length ? Math.max(...restSamples) - Math.min(...restSamples) : 0;
    const relativeChange = Math.abs(diff) / Math.max(restLevel, 0.005);

    // No safe default to fall back to here — if the two samples aren't
    // meaningfully different, calibration says so plainly rather than
    // producing a threshold that won't actually detect anything.
    if (Math.abs(diff) < 0.01 && relativeChange < 0.15) {
      this._renderMount(
        el("div", { class: "slider-frame" }, [
          el("p", { class: "heading", text: "No detectable difference" }),
          el("p", {
            text:
              "DitDash couldn't find a reliable difference between your key untouched and pressed. " +
              "This may not work well with your current wiring/hardware.",
          }),
          el("p", {
            class: "small muted",
            text:
              "If bare-contact detection isn't reliable for your setup, wiring the key through a small " +
              "inline oscillator/tone circuit is usually a more reliable fallback.",
          }),
          button("Try Again", () => this._renderAudioIntro(), "btn-block btn-panel"),
        ])
      );
      return;
    }

    const polarity = diff > 0 ? "keyDownLouder" : "keyDownQuieter";
    const recommendedThreshold = (restLevel + pressLevel) / 2;
    const snr = Math.abs(diff) / Math.max(restRange, 0.002);
    const signalQuality = snr > 6 ? "Excellent" : snr > 3 ? "Good" : snr > 1.2 ? "Fair" : "Poor";
    const backgroundNoise = restRange < 0.01 ? "Low" : restRange < 0.03 ? "Moderate" : "High";

    this.result = {
      connection: "audio",
      at: new Date().toISOString(),
      polarity,
      recommendedThreshold,
      signalQuality,
      backgroundNoise,
    };

    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", { class: "heading", text: "Calibration complete" }),
        this._resultRow("Signal quality", signalQuality, signalQuality === "Poor"),
        this._resultRow("Background noise", backgroundNoise, backgroundNoise === "High"),
        this._resultRow("Direction", polarity === "keyDownLouder" ? "Key press is louder" : "Key press is quieter"),
        el("div", { class: "button-row" }, [
          button("Apply", () => this._applyAudioResult(), "btn-accent"),
          button("Try Again", () => this._renderAudioIntro(), "btn-panel"),
        ]),
      ])
    );
  }

  _applyAudioResult() {
    const s = this.app.profile.settings;
    s.keyAudioPolarity = this.result.polarity;
    s.keyAudioThresholdLevel = this.result.recommendedThreshold;
    s.keyLastCalibration = this.result;
    this.app.saveProfile();
    this._renderDone();
  }

  _describeAudioError(err) {
    if (err && (err.name === "NotAllowedError" || err.name === "SecurityError")) {
      return "Microphone access was denied. Allow microphone access in your browser settings and try again.";
    }
    if (err && err.name === "NotFoundError") {
      return "No microphone was found. Connect an audio input and try again.";
    }
    return "DitDash couldn't start audio input for calibration.";
  }

  // ---- Keyboard/HID flow ----

  _renderHidIntro() {
    const s = this.app.profile.settings;
    const mapped = s.keyType === "straight" ? !!s.keyHidCode : !!(s.keyHidDitCode && s.keyHidDahCode);
    if (!mapped) {
      this._renderMount(
        el("div", { class: "slider-frame" }, [
          el("p", { text: "Set your key's mapping in Key Settings before calibrating." }),
          button(
            "Open Key Settings",
            () => import("./settings.js").then((m) => this.app.show(m.Settings)),
            "btn-block btn-panel"
          ),
        ])
      );
      return;
    }

    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", {
          text: "This checks your key's contact for bounce (rapid, unintended extra transitions) so DitDash can filter it correctly.",
        }),
        el("p", { class: "small muted", text: "Tap your key normally, several times, once you click Start." }),
        button("Start", () => this._runHidBounceTest(), "btn-block btn-accent"),
      ])
    );
  }

  async _runHidBounceTest() {
    this._renderMount(
      el("div", { class: "slider-frame center" }, [
        el("p", { text: "Recording…" }),
        el("p", { class: "small muted", text: "Tap your key normally, several times." }),
      ])
    );

    // A near-zero debounce window during the test itself so genuine bounce
    // shows up in the raw stream instead of being filtered before we can
    // measure it — the real, filtered detection settings are unaffected
    // until Apply below.
    this.hidInput = new KeyboardKeyInput({ ...this.app.profile.settings, keyHidDebounceMs: 0 });
    this._rawEvents = [];
    const onRaw = (e) => this._rawEvents.push(e.detail);
    this.hidInput.addEventListener("morsekeyraw", onRaw);
    this.hidInput.start();
    await this._sleep(HID_BOUNCE_TEST_MS);
    this.hidInput.removeEventListener("morsekeyraw", onRaw);
    this.hidInput.destroy();
    this.hidInput = null;

    this._finishHidCalibration(this._rawEvents);
  }

  _finishHidCalibration(events) {
    // Cluster consecutive raw transitions that land within
    // BOUNCE_CLUSTER_GAP_MS of each other — a mechanical contact settling
    // produces exactly this pattern (several rapid flickers right after the
    // real edge), a deliberate second tap does not.
    let bounceClusters = 0;
    let maxGapMs = 0;
    for (let i = 1; i < events.length; i++) {
      const gap = events[i].ts - events[i - 1].ts;
      if (gap < BOUNCE_CLUSTER_GAP_MS) {
        bounceClusters++;
        if (gap > maxGapMs) maxGapMs = gap;
      }
    }

    const contactBounce = bounceClusters === 0 ? "None" : bounceClusters <= 2 ? "Minor" : "Significant";
    const recommendedDebounceMs =
      bounceClusters === 0 ? null : Math.max(3, Math.min(20, Math.round(maxGapMs * 1.5)));

    this.result = {
      connection: "hid",
      at: new Date().toISOString(),
      contactBounce,
      recommendedDebounceMs,
      transitionsObserved: events.length,
    };

    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", { class: "heading", text: "Calibration complete" }),
        this._resultRow("Key mapping", "Confirmed"),
        this._resultRow("Contact bounce", contactBounce, contactBounce === "Significant"),
        this._resultRow(
          "Recommended debounce",
          recommendedDebounceMs != null ? `${recommendedDebounceMs} ms` : "No change needed"
        ),
        el("div", { class: "button-row" }, [
          button("Apply", () => this._applyHidResult(), "btn-accent"),
          button("Try Again", () => this._renderHidIntro(), "btn-panel"),
        ]),
      ])
    );
  }

  _applyHidResult() {
    const s = this.app.profile.settings;
    if (this.result.recommendedDebounceMs != null) {
      s.keyHidDebounceMs = this.result.recommendedDebounceMs;
    }
    s.keyLastCalibration = this.result;
    this.app.saveProfile();
    this._renderDone();
  }

  // ---- Shared ----

  _resultRow(label, value, warn = false) {
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { text: label }));
    row.appendChild(el("span", { class: warn ? "error" : "good", text: value }));
    return row;
  }

  _renderError(message) {
    this._renderMount(
      el("div", { class: "slider-frame" }, [
        el("p", { class: "small error", text: message }),
        button("Try Again", () => this._build(), "btn-block btn-panel"),
      ])
    );
  }

  _renderDone() {
    this._renderMount(
      el("div", { class: "slider-frame center" }, [
        el("p", { class: "heading", text: "Input calibration complete." }),
        button("Done", () => this.goBack(), "btn-block btn-accent"),
        button(
          "Test Key Mode",
          () => import("./keyTestMode.js").then((m) => this.app.show(m.KeyTestMode)),
          "btn-block btn-panel"
        ),
      ])
    );
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  goBack() {
    import("./settings.js").then((m) => this.app.show(m.Settings));
  }

  destroy() {
    if (this.audioInput) this.audioInput.destroy();
    if (this.hidInput) this.hidInput.destroy();
  }
}
