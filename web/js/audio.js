// Tone playback via the Web Audio API — the browser equivalent of morse/audio.py's
// winsound.Beep calls. PARIS timing: one unit = 1200 / wpm ms, a dot is one unit,
// a dash is three, and the gap between elements within a character is one unit.

export class AudioPlayer {
  constructor() {
    this._ctx = null;
    this._activeOsc = null;
    this._stopFlag = false;
    this._playToken = 0;
    this._keepAliveOsc = null;
  }

  /** Create/resume the AudioContext ahead of the first real tone, so a
   *  Bluetooth headset's wake-up latency doesn't clip it. Call from a
   *  user-gesture handler. */
  warmUp() {
    this._ensureCtx();
  }

  _ensureCtx() {
    if (!this._ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this._ctx = new Ctx();
    }
    if (this._ctx.state === "suspended") {
      this._ctx.resume();
    }
    return this._ctx;
  }

  /** Play a dot/dash pattern (e.g. ".-") asynchronously; returns without waiting. */
  playPattern(pattern, wpm, freq, volume = 70) {
    this.playPatternAsync(pattern, wpm, freq, volume);
  }

  /** Same as playPattern, but returns a promise that resolves once playback
   *  finishes (or is cut short by a newer call/stop()) — lets callers chain
   *  repeats without racing the tone's actual duration. */
  playPatternAsync(pattern, wpm, freq, volume = 70) {
    this.stop();
    const token = ++this._playToken;
    this._stopFlag = false;
    return this._runPattern(pattern, wpm, freq, volume, token);
  }

  /** Play a single continuous tone (used by Settings). */
  testTone(freq, volume = 70, durationMs = 400) {
    this.stop();
    this._playToken += 1;
    this._beep(freq, durationMs, volume);
  }

  /** Ask any in-progress playback to stop after the current element. */
  stop() {
    this._stopFlag = true;
    if (this._activeOsc) {
      try { this._activeOsc.stop(); } catch (e) { /* already stopped */ }
      this._activeOsc = null;
    }
  }

  /** Feed a near-silent, sub-audible tone continuously in the background so
   *  Bluetooth headphones don't idle-sleep between beeps and clip the start
   *  of the next real tone waking them back up. Independent of the normal
   *  playback path (playPattern/testTone/stop) so it isn't interrupted by it. */
  startKeepAlive() {
    if (this._keepAliveOsc) return;
    const ctx = this._ensureCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 20; // below normal hearing range
    gain.gain.value = 0.0005; // effectively silent but non-zero output
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    this._keepAliveOsc = osc;
  }

  stopKeepAlive() {
    if (this._keepAliveOsc) {
      try { this._keepAliveOsc.stop(); } catch (e) { /* already stopped */ }
      this._keepAliveOsc = null;
    }
  }

  async _runPattern(pattern, wpm, freq, volume, token) {
    const unitMs = 1200.0 / Math.max(1, wpm);
    for (let i = 0; i < pattern.length; i++) {
      if (this._stopFlag || token !== this._playToken) return;
      const symbol = pattern[i];
      const duration = symbol === "." ? unitMs : unitMs * 3;
      await this._beep(freq, duration, volume);
      if (this._stopFlag || token !== this._playToken) return;
      if (i !== pattern.length - 1) {
        await this._sleep(unitMs);
      }
    }
  }

  _beep(freq, durationMs, volume = 70) {
    const ctx = this._ensureCtx();
    freq = Math.max(37, Math.min(20000, freq));
    durationMs = Math.max(1, durationMs);
    // 0.9 ceiling leaves a little headroom to avoid digital clipping even
    // at max volume, while still being audibly much louder than a faint tone.
    const peak = Math.max(0, Math.min(1, volume / 100)) * 0.9;
    return new Promise((resolve) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;

      const now = ctx.currentTime;
      const dur = durationMs / 1000;
      const fade = Math.min(0.005, dur / 4); // avoid clicks at edges
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + fade);
      gain.gain.setValueAtTime(peak, Math.max(now + fade, now + dur - fade));
      gain.gain.linearRampToValueAtTime(0, now + dur);

      osc.connect(gain).connect(ctx.destination);
      this._activeOsc = osc;
      osc.start(now);
      osc.stop(now + dur);
      osc.onended = () => {
        if (this._activeOsc === osc) this._activeOsc = null;
        resolve();
      };
    });
  }

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
