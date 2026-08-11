// Send Practice: see a character, key it out with the spacebar or the circle.
//
// A hold shorter than two units is a dot, longer is a dash. After a pause of
// about three units (at least 600 ms) with nothing held, the entered pattern is
// decoded and checked against the target.

import * as codes from "./codes.js";
import { el, button, keyLabel, morseGlyphs, showToast } from "./dom.js";
import { shouldAutoHint, streakToClear, charWeight, pickWeighted } from "./learning.js";
import { explainCharacter } from "./explainSelection.js";
import { evaluateAchievements } from "./achievements.js";
import { recordActivity } from "./dailyPractice.js";

const WRONG_PENALTY = 2;
const DOT_THRESHOLD_UNITS = 2; // hold >= this many units counts as a dash
const DECODE_GAP_UNITS = 3;
const DECODE_GAP_MIN_MS = 600;
// See the matching constant in receivePractice.js — same reasoning.
const GETTING_STRONGER_THRESHOLD = 2;

export class SendPractice {
  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    // When set, practice is scoped to one lesson's letters for review —
    // no leveling, just a session-local tally — instead of the full
    // cumulative pool for the profile's current level.
    this.lessonChars = options.lessonChars || null;
    this.lessonNumber = options.lessonNumber || null;
    this.lessonLabel = options.lessonLabel || null;
    // See the matching field in receivePractice.js — same reasoning: which
    // screen "< Menu"/Esc returns to, explicit rather than inferred from
    // lessonChars now that Home and Journey also launch practice with
    // lessonChars set.
    this.returnTo = options.returnTo || (this.lessonChars ? "lessons" : "mainMenu");
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    this.target = null;
    this.pattern = "";
    this.keyDown = false;
    this.pressTime = 0;
    this.decodeTimer = null;
    this.roundTimer = null;
    this.hintTimer = null;
    this.answered = false;
    this.autoHint = false;
    this._visitStart = Date.now();
    this._build();
    this._bindKeys();
    this.nextRound();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Send Morse" }));
    this.levelLbl = el("span", { class: "level-tag" });
    top.appendChild(this.levelLbl);
    wrap.appendChild(top);

    wrap.appendChild(el("p", { class: "small muted center", text: "Send this character" }));
    this.targetLbl = el("div", { class: "big-char" });
    wrap.appendChild(this.targetLbl);

    this.hintViz = el("div", { class: "hint-viz" });
    wrap.appendChild(this.hintViz);

    this.teachCard = el("div", { style: { display: "none" } });
    wrap.appendChild(this.teachCard);

    wrap.appendChild(el("p", { class: "small muted center", text: "Hold to send" }));

    this.keyCircle = el("div", {
      class: "key-circle",
      role: "button",
      tabindex: "0",
      "aria-label": "Morse key — hold Space, or hold this key, to send",
    });
    const keyWrap = el("div", { class: "key-wrap" }, [this.keyCircle]);
    wrap.appendChild(keyWrap);

    this.keyCircle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      this.onPress();
    });
    this.keyCircle.addEventListener("mouseup", (e) => {
      e.preventDefault();
      this.onRelease();
    });
    this.keyCircle.addEventListener("mouseleave", () => {
      if (this.keyDown) this.onRelease();
    });
    this.keyCircle.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this.onPress();
    });
    this.keyCircle.addEventListener("touchend", (e) => {
      e.preventDefault();
      this.onRelease();
    });

    this.keyBindLbl = el("p", { class: "small muted center" });
    this._updateKeyBindHint();
    wrap.appendChild(this.keyBindLbl);

    const hintRow = el("div", { class: "button-row" });
    hintRow.appendChild(button("Hear it  ▶", () => this._playTarget(), "btn-panel"));
    hintRow.appendChild(button("Hint  ?", () => this.showHint(), "btn-panel"));
    hintRow.appendChild(button("Why this?", () => this._toggleWhy(), "btn-panel"));
    wrap.appendChild(hintRow);

    this.whyText = el("p", {
      class: "small muted center",
      style: { display: "none" },
      "aria-live": "polite",
    });
    wrap.appendChild(this.whyText);

    this.patternLbl = el("p", { class: "pattern" });
    wrap.appendChild(this.patternLbl);

    this.status = el("p", { class: "heading status center", "aria-live": "polite" });
    wrap.appendChild(this.status);

    this.streakLbl = el("p", { class: "small muted center" });
    wrap.appendChild(this.streakLbl);

    this.root.appendChild(wrap);
  }

  _bindKeys() {
    this._onKeyDown = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.onPress();
        return;
      }
      const s = this.app.profile.settings;
      if (e.repeat) return;
      if (s.dotKey && e.code === s.dotKey) {
        e.preventDefault();
        this._flashKey();
        this.registerSymbol(".");
      } else if (s.dashKey && e.code === s.dashKey) {
        e.preventDefault();
        this._flashKey();
        this.registerSymbol("-");
      } else if (e.code === "KeyR") {
        // Only reachable when R isn't already claimed as a custom dot/dash
        // key above — Replay is a convenience, not a reserved binding.
        e.preventDefault();
        this._playTarget();
      }
    };
    this._onKeyUp = (e) => {
      if (e.code === "Space") {
        e.preventDefault();
        this.onRelease();
      }
    };
    document.addEventListener("keydown", this._onKeyDown);
    document.addEventListener("keyup", this._onKeyUp);
  }

  _updateKeyBindHint() {
    const s = this.app.profile.settings;
    let text = "Hold SPACE or the circle — short = dot, long = dash";
    if (s.dotKey || s.dashKey) {
      const dotName = s.dotKey ? keyLabel(s.dotKey) : "?";
      const dashName = s.dashKey ? keyLabel(s.dashKey) : "?";
      text += `, or tap ${dotName} for dot / ${dashName} for dash`;
    }
    this.keyBindLbl.textContent = text;
  }

  // Reveals the target's dot/dash pattern as glyphs — used both for the
  // on-demand Hint button and for auto-demonstrating new/struggling letters.
  showHint() {
    if (this.answered) return;
    this._revealHintViz();
  }

  _revealHintViz() {
    this.hintViz.innerHTML = "";
    this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "good"));
  }

  _playTarget() {
    const s = this.app.profile.settings;
    this.app.audio.playPattern(codes.MORSE[this.target], s.wpm, s.freq, s.volume);
  }

  _renderPattern() {
    this.patternLbl.innerHTML = "";
    if (this.pattern) {
      this.patternLbl.appendChild(morseGlyphs(this.pattern));
    } else {
      this.patternLbl.appendChild(el("span", { class: "muted", text: "—" }));
    }
  }

  _flashKey() {
    this.keyCircle.classList.add("active");
    setTimeout(() => this.keyCircle.classList.remove("active"), 120);
  }

  _unitMs() {
    return 1200.0 / Math.max(1, this.app.profile.settings.wpm);
  }

  onPress() {
    if (this.answered || this.keyDown) return;
    this.keyDown = true;
    this.pressTime = performance.now();
    if (this.decodeTimer) {
      clearTimeout(this.decodeTimer);
      this.decodeTimer = null;
    }
    this.keyCircle.classList.add("active");
  }

  onRelease() {
    if (!this.keyDown) return;
    this.keyDown = false;
    const heldMs = performance.now() - this.pressTime;
    const unit = this._unitMs();
    const symbol = heldMs < DOT_THRESHOLD_UNITS * unit ? "." : "-";
    this.keyCircle.classList.remove("active");
    this.registerSymbol(symbol);
  }

  // Adds one dot or dash to the pattern, plays its tone, and (re)schedules
  // the decode. Shared by spacebar release and the dedicated dot/dash keys.
  registerSymbol(symbol) {
    if (this.answered) return;
    if (this.decodeTimer) {
      clearTimeout(this.decodeTimer);
      this.decodeTimer = null;
    }
    this.pattern += symbol;
    this._renderPattern();

    const s = this.app.profile.settings;
    this.app.audio.playPattern(symbol, s.wpm, s.freq, s.volume);

    const unit = this._unitMs();
    const gap = Math.max(DECODE_GAP_UNITS * unit, DECODE_GAP_MIN_MS);
    this.decodeTimer = setTimeout(() => this.decode(), gap);
  }

  nextRound() {
    this.answered = false;
    this.pattern = "";
    if (this.hintTimer) {
      clearTimeout(this.hintTimer);
      this.hintTimer = null;
    }
    const pool = this.lessonChars || codes.poolForLevel(this.app.profile.send_level);
    const p = this.app.profile;
    const seen = p.send_seen || (p.send_seen = {});
    const missStreaks = p.send_miss_streak || (p.send_miss_streak = {});
    const mistakes = p.mistakes || {};
    this.target = pickWeighted(pool, (ch) => charWeight(seen[ch] || 0, mistakes[ch] || 0));
    this.targetLbl.textContent = this.target;
    this.hintViz.innerHTML = "";
    this.teachCard.innerHTML = "";
    this.teachCard.style.display = "none";
    this.whyText.style.display = "none";
    this._renderPattern();
    this.status.textContent = "";
    this.status.className = "heading status center";

    const seenCount = seen[this.target] || 0;
    const isBrandNew = seenCount === 0;
    this.autoHint = shouldAutoHint(seenCount, missStreaks[this.target] || 0);
    seen[this.target] = seenCount + 1;
    this.app.saveProfile();

    this._updateMeta();

    if (isBrandNew) {
      // A real teaching moment for a character's very first appearance —
      // see the matching card in receivePractice.js for the same reasoning.
      this._setStatus("New character", "good");
      this.teachCard.style.display = "";
      this.teachCard.appendChild(this._newCharacterCard(this.target));
      this.hintTimer = setTimeout(() => {
        if (!this.answered) this._playTarget();
      }, 350);
    } else if (this.autoHint) {
      this._setStatus(`This is ${this.target}`, "good");
      this._revealHintViz();
      this.hintTimer = setTimeout(() => {
        if (!this.answered) this._playTarget();
      }, 350);
    }
  }

  // See the matching card in receivePractice.js — same idea, presented for
  // Send Practice's "see it, then key it" flow.
  _newCharacterCard(ch) {
    const card = el("div", { class: "card pop-in" });
    card.appendChild(el("span", { class: "badge", text: "New Character" }));
    card.appendChild(el("div", { class: "big-char", text: ch, style: { margin: "6px 0" } }));
    const glyphRow = el("div", { class: "hint-viz" });
    glyphRow.appendChild(morseGlyphs(codes.MORSE[ch], "good"));
    card.appendChild(glyphRow);
    card.appendChild(
      el("p", { class: "small muted center", text: codes.rhythmPhrase(codes.MORSE[ch]) })
    );
    const row = el("div", { class: "button-row" });
    row.appendChild(button("Hear it  ▶", () => this._playTarget(), "btn-panel"));
    row.appendChild(button(`Practice ${ch}`, () => this._practiceThisChar(ch), "btn-accent"));
    card.appendChild(row);
    return card;
  }

  _practiceThisChar(ch) {
    // Inherits the parent session's returnTo — see the matching method in
    // receivePractice.js.
    const options = { lessonChars: [ch], lessonLabel: `Practicing ${ch}`, returnTo: this.returnTo };
    import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
  }

  // Always available, non-interrupting — reveals why the current character
  // came up without ending the round.
  _toggleWhy() {
    const showing = this.whyText.style.display !== "none";
    if (showing) {
      this.whyText.style.display = "none";
      return;
    }
    const p = this.app.profile;
    const seen = p.send_seen || {};
    const mistakes = p.mistakes || {};
    this.whyText.textContent = explainCharacter(this.target, seen[this.target] || 0, mistakes[this.target] || 0);
    this.whyText.style.display = "";
  }

  decode() {
    this.decodeTimer = null;
    if (this.answered || !this.pattern) return;
    this.answered = true;
    const p = this.app.profile;
    const missStreaks = p.send_miss_streak || (p.send_miss_streak = {});
    const guess = codes.charFromPattern(this.pattern);
    const correctPattern = codes.MORSE[this.target];
    if (this.pattern === correctPattern) {
      const priorMissStreak = missStreaks[this.target] || 0;
      missStreaks[this.target] = 0;
      if (priorMissStreak >= GETTING_STRONGER_THRESHOLD) {
        showToast(`${this.target} is getting stronger — nice work!`);
      }
      if (this.lessonChars) {
        this.sessionCorrect += 1;
        this.sessionTotal += 1;
        this._setStatus(`Correct!  ${this.pattern}`, "good");
      } else {
        p.send_streak += 1;
        const target = streakToClear(p.send_level);
        if (p.send_streak >= target) {
          p.send_streak = 0;
          if (p.send_level < codes.MAX_LEVEL) {
            p.send_level += 1;
            this._setStatus("Level up! New characters unlocked.", "good");
          } else {
            this._setStatus("All characters mastered!", "good");
          }
        } else {
          this._setStatus(`Correct!  ${this.pattern}`, "good");
        }
      }
      this._checkAchievements();
      this.app.saveProfile();
      this._updateMeta();
      this.roundTimer = setTimeout(() => this.nextRound(), 900);
    } else {
      missStreaks[this.target] = (missStreaks[this.target] || 0) + 1;
      p.mistakes = p.mistakes || {};
      p.mistakes[this.target] = (p.mistakes[this.target] || 0) + 1;
      p.send_mistakes = p.send_mistakes || {};
      p.send_mistakes[this.target] = (p.send_mistakes[this.target] || 0) + 1;
      if (this.lessonChars) {
        this.sessionTotal += 1;
      } else {
        p.send_streak = Math.max(0, p.send_streak - WRONG_PENALTY);
      }
      const decodedNote = guess ? `  (you sent ${guess})` : "  (not a valid pattern)";
      this._setStatus(`${this.target} is:${decodedNote}`, "bad");
      this.hintViz.innerHTML = "";
      this.hintViz.appendChild(morseGlyphs(correctPattern, "bad"));
      this._checkAchievements();
      this.app.saveProfile();
      this._updateMeta();
      this.roundTimer = setTimeout(() => this.nextRound(), 1600);
    }
  }

  // Checks for newly-earned achievements, records any into profile.achievements
  // and toasts them. Does NOT call saveProfile() itself — every caller
  // already makes its own single save right after, so a round only ever
  // persists once regardless of whether an achievement also unlocked.
  _checkAchievements() {
    const p = this.app.profile;
    const newly = evaluateAchievements(p);
    if (newly.length === 0) return;
    p.achievements = p.achievements || {};
    const now = new Date().toISOString();
    for (const a of newly) p.achievements[a.id] = now;
    for (const a of newly) showToast(`🏅 Achievement unlocked: ${a.label}`);
  }

  _setStatus(text, kind) {
    this.status.textContent = text;
    this.status.className = `heading status center ${kind}`;
    if (kind === "good") {
      this.status.classList.remove("pulse-good");
      void this.status.offsetWidth;
      this.status.classList.add("pulse-good");
    }
  }

  _updateMeta() {
    const p = this.app.profile;
    if (this.lessonChars) {
      this.levelLbl.textContent = this.lessonLabel || `Lesson ${this.lessonNumber} review`;
      this.streakLbl.textContent = `${this.sessionCorrect} / ${this.sessionTotal} correct this session`;
    } else {
      this.levelLbl.textContent = `Level ${p.send_level}`;
      this.streakLbl.textContent = `Streak ${p.send_streak} / ${streakToClear(p.send_level)}`;
    }
  }

  goBack() {
    if (this.returnTo === "journey") {
      import("./journey.js").then((m) => this.app.show(m.Journey));
    } else if (this.returnTo === "lessons") {
      import("./lessons.js").then((m) => this.app.show(m.Lessons));
    } else {
      import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
    }
  }

  destroy() {
    if (this.decodeTimer) clearTimeout(this.decodeTimer);
    if (this.roundTimer) clearTimeout(this.roundTimer);
    if (this.hintTimer) clearTimeout(this.hintTimer);
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    this.app.audio.stop();
    recordActivity(this.app.profile, Date.now() - this._visitStart);
    // See the matching call in receivePractice.js's destroy() — catches
    // five_minute_practice_day in the same visit that earns it.
    this._checkAchievements();
    this.app.saveProfile();
  }
}
