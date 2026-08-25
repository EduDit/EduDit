// Receive Practice: hear a tone, tap the matching character.

import * as codes from "./codes.js";
import { el, button, morseGlyphs, showToast, signalPulse, QWERTY_ROWS, isDigit, attachArrowNav, pageHeader } from "./dom.js";
import { shouldAutoHint, streakToClear, charWeight, pickWeighted } from "./learning.js";
import { explainCharacter } from "./explainSelection.js";
import { evaluateAchievements } from "./achievements.js";
import { recordActivity } from "./dailyPractice.js";
import { newCharacterCard } from "./teachingCard.js";
import { calculateResponseScore, updateFluencyEma } from "./scoring.js";

// A session recap only means something once a few rounds have actually
// happened — below this, a manual exit (Back/Esc) just navigates back
// directly instead of showing Session Summary. A level-up always shows it
// regardless of this threshold (streakToClear can be as low as 2 at early
// levels, so a legitimate level-up can happen in fewer rounds than this).
const SUMMARY_MIN_ROUNDS = 3;

const WRONG_PENALTY = 2;
// A miss streak has to reach this length before clearing it counts as a
// real "getting stronger" moment worth an automatic toast — one lucky
// recovery after a single slip isn't a pattern, and the toast is meant to
// stay rare, not fire after every correct answer.
const GETTING_STRONGER_THRESHOLD = 2;

export class ReceivePractice {
  static navId = "practice";

  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    // When set, practice is scoped to one lesson's letters for review —
    // no leveling, just a session-local tally — instead of the full
    // cumulative pool for the profile's current level.
    this.lessonChars = options.lessonChars || null;
    this.lessonNumber = options.lessonNumber || null;
    this.lessonLabel = options.lessonLabel || null;
    // Which screen Back (and Esc) returns to. Explicit rather than
    // inferred from lessonChars — Home and Journey both launch practice
    // with lessonChars set too now (for weak-letter/single-character
    // drills), so "lessonChars truthy -> came from Lessons" no longer
    // holds. Falls back to the old inference for any caller that doesn't
    // pass it.
    this.returnTo = options.returnTo || (this.lessonChars ? "lessons" : "mainMenu");
    // Set when mounted inside PracticeHub — suppresses this screen's own
    // breadcrumb/description, since the hub already shows "Practice" plus
    // the active tab's description right above where this mounts.
    this.embedded = !!options.embedded;
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    // Tracked in every round (not just lesson-mode) so Session Summary has
    // something real to show regardless of how the session ends.
    this.sessionChars = new Set();
    this.sessionMisses = {};
    // Per-round response-time scoring (see scoring.js) — a session-local
    // list of 0-100 scores for Session Summary, kept separate from
    // sessionCorrect/sessionTotal above (accuracy) and from the
    // per-character fluency EMA persisted on the profile (automaticity).
    this.sessionScores = [];
    this.target = null;
    this.answered = false;
    this.autoHint = false;
    // Timing state is fully reset at the top of every nextRound() — see
    // there — so a value can never leak from one round into the next.
    this._roundToken = 0;
    this._roundScoreable = false;
    this._recognitionStartMs = null;
    this._timingInterrupted = false;
    this._timers = [];
    this.keyButtons = {};
    this._visitStart = Date.now();
    this._build();
    this._bindKeys();
    this._bindVisibility();
    this.nextRound();
  }

  _build() {
    const wrap = el("div", { class: this.embedded ? "screen" : "screen view-focused" });

    if (!this.embedded) {
      wrap.appendChild(
        pageHeader({
          eyebrow: "Practice",
          title: "Receive",
          actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
        })
      );
      wrap.appendChild(
        el("p", { class: "small muted", text: "Listen to the tone and identify the character." })
      );
    }
    this.levelLbl = el("p", { class: "level-tag", style: { margin: "0 0 10px" } });
    wrap.appendChild(this.levelLbl);

    this.status = el("p", { class: "heading status center", "aria-live": "polite" });
    wrap.appendChild(this.status);

    this.hintViz = el("div", { class: "hint-viz" });
    wrap.appendChild(this.hintViz);

    this.teachCard = el("div", { style: { display: "none" } });
    wrap.appendChild(this.teachCard);

    const progressWrap = el("div", { class: "progress" });
    this.progressFill = el("div", { class: "progress-fill" });
    progressWrap.appendChild(this.progressFill);
    wrap.appendChild(progressWrap);

    this.streakLbl = el("p", { class: "small muted center" });
    wrap.appendChild(this.streakLbl);

    const controlsRow = el("div", { class: "button-row" });
    controlsRow.appendChild(button("Replay  ▶", () => this.play(), "btn-accent"));
    controlsRow.appendChild(button("Hint  ?", () => this.showHint(), "btn-panel"));
    controlsRow.appendChild(button("Why this?", () => this._toggleWhy(), "btn-panel"));
    wrap.appendChild(controlsRow);

    this.whyText = el("p", {
      class: "small muted center",
      style: { display: "none" },
      "aria-live": "polite",
    });
    wrap.appendChild(this.whyText);

    wrap.appendChild(
      button("I don't know  →  show me", () => this._dontKnow(), "btn-panel btn-block")
    );

    this.keyboard = this._buildKeyboard();
    wrap.appendChild(this.keyboard);

    this.root.appendChild(wrap);
  }

  _buildKeyboard() {
    const keyboard = el("div", { class: "keyboard" });
    for (const row of QWERTY_ROWS) {
      const rowEl = el("div", { class: "keyboard-row" });
      for (const ch of row) {
        const key = button(ch, () => this.answer(ch), "key mono");
        this.keyButtons[ch] = key;
        rowEl.appendChild(key);
      }
      keyboard.appendChild(rowEl);
      if (row.every(isDigit)) this.digitsRow = rowEl;
    }
    attachArrowNav(keyboard);
    return keyboard;
  }

  // Lets a physical keyboard answer too, not just the on-screen keys —
  // same enabled/disabled rules, so locked characters can't be typed either.
  _bindKeys() {
    this._onKeyDown = (e) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
      // Space isn't a valid answer character on this screen (it's not in
      // QWERTY_ROWS), so it's free to reuse as a Replay shortcut here —
      // unlike Send Practice, where Space is already the send key.
      if (e.code === "Space") {
        e.preventDefault();
        this.play();
        return;
      }
      const ch = e.key.toUpperCase();
      const key = this.keyButtons[ch];
      if (!key || key.disabled) return;
      e.preventDefault();
      this._flashKeyButton(key);
      this.answer(ch);
    };
    document.addEventListener("keydown", this._onKeyDown);
  }

  _flashKeyButton(key) {
    key.classList.add("active");
    setTimeout(() => key.classList.remove("active"), 120);
  }

  // A background tab must invalidate response timing, not silently count
  // the hidden time as "response speed" — see the redesign plan's
  // visibility-loss safeguard. Correctness/streak/mistakes are unaffected;
  // only the score/fluency sample for the round in progress is skipped.
  _bindVisibility() {
    this._onVisibilityChange = () => {
      if (document.hidden) this._timingInterrupted = true;
    };
    document.addEventListener("visibilitychange", this._onVisibilityChange);
  }

  _pool() {
    return this.lessonChars || codes.poolForLevel(this.app.profile.receive_level);
  }

  nextRound() {
    this.answered = false;
    // Every round's timer starts clean — reset unconditionally, before the
    // auto-hint/brand-new decision below, so a value can never leak from a
    // previous round (including one abandoned via goBack()/Esc mid-round).
    this._roundToken += 1;
    this._roundScoreable = false;
    this._recognitionStartMs = null;
    this._timingInterrupted = false;

    const pool = this._pool();
    const p = this.app.profile;
    const seen = p.receive_seen || (p.receive_seen = {});
    const missStreaks = p.receive_miss_streak || (p.receive_miss_streak = {});
    const mistakes = p.mistakes || {};
    this.target = pickWeighted(pool, (ch) => charWeight(seen[ch] || 0, mistakes[ch] || 0));

    const seenCount = seen[this.target] || 0;
    const isBrandNew = seenCount === 0;
    this.autoHint = shouldAutoHint(seenCount, missStreaks[this.target] || 0);
    // Only a genuine "hear it, then answer blind" round is scoreable — a
    // round where the app is already demonstrating the answer (new
    // character, auto-hint refresher) can't measure recognition speed.
    this._roundScoreable = !isBrandNew && !this.autoHint;
    seen[this.target] = seenCount + 1;
    this.app.saveProfile();

    this._updateKeyboard(pool);
    this._updateMeta();

    this.hintViz.innerHTML = "";
    this.teachCard.innerHTML = "";
    this.teachCard.style.display = "none";
    this.whyText.style.display = "none";

    if (isBrandNew) {
      // A real teaching moment for a character's very first appearance —
      // richer than the plain hint a miss-streak refresher gets below,
      // since this is the learner's first exposure to it at all.
      this.status.textContent = "New character";
      this.status.className = "heading status center good";
      this.keyButtons[this.target].classList.add("key-hint");
      this.teachCard.style.display = "";
      this.teachCard.appendChild(
        newCharacterCard(this.target, {
          onPlay: () => this.play(),
          onPractice: () => this._practiceThisChar(this.target),
        })
      );
    } else if (this.autoHint) {
      this.status.textContent = `This is ${this.target}`;
      this.status.className = "heading status center good";
      this.keyButtons[this.target].classList.add("key-hint");
      this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "good"));
    } else {
      this.status.textContent = "Listen…";
      this.status.className = "heading status center";
      this._setListening(true);
    }
    this._timers.push(setTimeout(() => this.play(), 350));
  }

  // Toggles the small ambient "signal" indicator (dom.js's signalPulse())
  // for exactly the window audio is actually playing — per the redesign
  // plan's restraint guardrail, it must never linger past that into the
  // answering phase.
  _setListening(on) {
    if (on) {
      this.hintViz.innerHTML = "";
      this.hintViz.appendChild(signalPulse());
    } else if (this.hintViz.querySelector(".signal-pulse")) {
      this.hintViz.innerHTML = "";
    }
  }

  _practiceThisChar(ch) {
    // Inherits the parent session's returnTo, so a nested "practice just
    // this letter" drill still backs out to wherever the learner actually
    // started (Home, Journey, or Lessons), not always Lessons.
    const options = { lessonChars: [ch], lessonLabel: `Practicing ${ch}`, returnTo: this.returnTo };
    import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
  }

  // Always available, non-interrupting — reveals why the current character
  // came up without ending the round. Reason text is generated fresh each
  // time so it reflects the profile's real state, not a canned message.
  _toggleWhy() {
    const showing = this.whyText.style.display !== "none";
    if (showing) {
      this.whyText.style.display = "none";
      return;
    }
    const p = this.app.profile;
    const seen = p.receive_seen || {};
    const mistakes = p.mistakes || {};
    this.whyText.textContent = explainCharacter(this.target, seen[this.target] || 0, mistakes[this.target] || 0);
    this.whyText.style.display = "";
  }

  // A non-punishing way to say "I don't recognize this one" — reveals the
  // answer and pattern, replays the tone, then continues normally. Treated
  // as neutral: unlike a genuine wrong tap, it does NOT touch mistakes,
  // receive_mistakes, receive_miss_streak, or receive_streak. seen[target]
  // already incremented above, exactly as it does for every round. Recorded
  // separately in receive_dont_know so accuracy/achievement math (which
  // would otherwise read "attempts minus misses" as correct) can exclude
  // it — see achievements.js and mainMenu.js's _overallAccuracy.
  _dontKnow() {
    if (this.answered) return;
    this.answered = true;
    this._setListening(false);
    const p = this.app.profile;
    p.receive_dont_know = p.receive_dont_know || {};
    p.receive_dont_know[this.target] = (p.receive_dont_know[this.target] || 0) + 1;
    this._setStatus(`It's ${this.target}`, "good");
    this.keyButtons[this.target].classList.add("key-hint");
    this.hintViz.innerHTML = "";
    this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "good"));
    this.play();
    this.app.saveProfile();
    this._updateMeta();
    this._timers.push(setTimeout(() => this.nextRound(), 1600));
  }

  showHint() {
    if (this.answered) return;
    // Requesting a hint is the app revealing the answer mid-round, same as
    // an auto-hint round — whatever the learner answers next isn't blind
    // recognition anymore, so this round is no longer scoreable.
    this._roundScoreable = false;
    this._setListening(false);
    this.status.textContent = `Hint: it's ${this.target}`;
    this.status.className = "heading status center good";
    this.keyButtons[this.target].classList.add("key-hint");
    this.hintViz.innerHTML = "";
    this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "good"));
  }

  _updateKeyboard(pool) {
    const unlocked = new Set(pool);
    for (const [ch, key] of Object.entries(this.keyButtons)) {
      const enabled = unlocked.has(ch);
      key.disabled = !enabled;
      key.classList.toggle("key-disabled", !enabled);
      key.classList.remove("key-hint");
    }
    if (this.digitsRow) {
      this.digitsRow.style.display = pool.some(isDigit) ? "" : "none";
    }
  }

  // On a scoreable round, the recognition clock starts when the tone
  // finishes playing (not when play() is called) — starting at call time
  // would conflate playback duration, which scales with the character's
  // pattern length and WPM, with how fast the learner actually recognized
  // it. A Replay mid-round resets the clock too: asking to hear it again is
  // itself part of "not yet recognized," so timing from the most recent
  // full playback is the fairer measurement each time.
  play() {
    const s = this.app.profile.settings;
    if (!this._roundScoreable || this.answered) {
      this.app.audio.playPattern(codes.MORSE[this.target], s.wpm, s.freq, s.volume);
      return;
    }
    const token = this._roundToken;
    this._setListening(true);
    this.app.audio.playPatternAsync(codes.MORSE[this.target], s.wpm, s.freq, s.volume).then(() => {
      this._setListening(false);
      if (token !== this._roundToken || this.answered || this._timingInterrupted) return;
      this._recognitionStartMs = performance.now();
      // Hand off from "the app is speaking" to "you're up" — reuses the
      // existing pop-in keyframe rather than adding a new one. Skipped if a
      // hint was requested while playback was still in flight (roundScoreable
      // already flipped false in that case) — don't clobber the hint text.
      if (this._roundScoreable) {
        this.status.textContent = "Your turn";
        this.status.className = "heading status center";
        this.status.classList.remove("pop-in");
        void this.status.offsetWidth;
        this.status.classList.add("pop-in");
      }
    });
  }

  answer(ch) {
    if (this.answered) return;
    this.answered = true;
    this._setListening(false);
    const p = this.app.profile;
    const s = p.settings;
    this.sessionTotal += 1;
    this.sessionChars.add(this.target);

    // Response-time scoring — see scoring.js and play() above for exactly
    // what this interval does/doesn't include. Skipped entirely (no score,
    // no fluency sample) for a non-scoreable round or one interrupted by a
    // tab/window visibility change.
    const responseMs =
      this._roundScoreable && this._recognitionStartMs != null && !this._timingInterrupted
        ? performance.now() - this._recognitionStartMs
        : null;
    const correct = ch === this.target;
    if (responseMs != null) {
      this.sessionScores.push(calculateResponseScore({ correct, responseMs }));
    }

    if (correct) {
      this.sessionCorrect += 1;
      if (responseMs != null) {
        // Fluency (automaticity) only updates on a correct, scored round —
        // a fast wrong guess isn't "fast recognition," so it must never
        // make a character look more fluent than it is. Kept entirely
        // separate from the 0-100 score computed just above.
        const fluencyMap = p.receive_fluency_ms || (p.receive_fluency_ms = {});
        fluencyMap[this.target] = updateFluencyEma(fluencyMap[this.target] ?? null, responseMs);
      }
      const priorMissStreak = p.receive_miss_streak[this.target] || 0;
      p.receive_miss_streak[this.target] = 0;
      if (priorMissStreak >= GETTING_STRONGER_THRESHOLD) {
        showToast(`${this.target} is getting stronger — nice work!`);
      }
      let leveledUp = false;
      let unlockedChars = [];
      if (this.lessonChars) {
        this._setStatus("Correct!", "good");
      } else {
        p.receive_streak += 1;
        const target = streakToClear(p.receive_level);
        if (p.receive_streak >= target) {
          p.receive_streak = 0;
          const priorLevel = p.receive_level;
          if (p.receive_level < codes.MAX_LEVEL) {
            p.receive_level += 1;
            leveledUp = true;
            unlockedChars = codes
              .poolForLevel(p.receive_level)
              .slice(codes.poolForLevel(priorLevel).length);
            this._setStatus("Level up! New characters unlocked.", "good");
          } else {
            this._setStatus("All characters mastered!", "good");
          }
        } else {
          this._setStatus("Correct!", "good");
        }
      }
      this._checkAchievements();
      this.app.saveProfile();
      this._updateMeta();
      if (leveledUp) {
        this._timers.push(setTimeout(() => this._showSummary({ leveledUp, unlockedChars }), 900));
      } else {
        this._timers.push(setTimeout(() => this.nextRound(), 750));
      }
    } else {
      p.receive_miss_streak[this.target] = (p.receive_miss_streak[this.target] || 0) + 1;
      p.mistakes = p.mistakes || {};
      p.mistakes[this.target] = (p.mistakes[this.target] || 0) + 1;
      p.receive_mistakes = p.receive_mistakes || {};
      p.receive_mistakes[this.target] = (p.receive_mistakes[this.target] || 0) + 1;
      this.sessionMisses[this.target] = (this.sessionMisses[this.target] || 0) + 1;
      if (!this.lessonChars) {
        p.receive_streak = Math.max(0, p.receive_streak - WRONG_PENALTY);
      }
      this._setStatus(`It was  ${this.target}`, "bad");
      this.app.audio.playIncorrectCue(s.volume);
      this.hintViz.innerHTML = "";
      this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "bad"));
      this._checkAchievements();
      this.app.saveProfile();
      this._updateMeta();
      this._timers.push(setTimeout(() => this.nextRound(), 1300));
    }
  }

  // Checks for newly-earned achievements, records any into profile.achievements
  // and toasts them — kept deliberately quiet (a toast, not a dialog) and
  // secondary to training itself. Does NOT call saveProfile() itself — every
  // caller already makes its own single save right after, so a round only
  // ever persists once regardless of whether an achievement also unlocked.
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
      // Force the animation to restart even if it was already mid-pulse
      // from the previous round (className already excludes it above, so
      // removing here is a no-op — the reflow is what actually matters).
      this.status.classList.remove("pulse-good");
      void this.status.offsetWidth;
      this.status.classList.add("pulse-good");
    } else if (kind === "bad") {
      // Same restart trick as pulse-good above, for the wrong-answer shake.
      this.status.classList.remove("shake-bad");
      void this.status.offsetWidth;
      this.status.classList.add("shake-bad");
    }
  }

  _updateMeta() {
    const p = this.app.profile;
    if (this.lessonChars) {
      this.levelLbl.textContent = this.lessonLabel || `Lesson ${this.lessonNumber} review`;
      const pct = this.sessionTotal ? (this.sessionCorrect / this.sessionTotal) * 100 : 0;
      this.progressFill.style.width = `${pct}%`;
      this.streakLbl.textContent = `${this.sessionCorrect} / ${this.sessionTotal} correct this session`;
    } else {
      const target = streakToClear(p.receive_level);
      this.levelLbl.textContent = `Level ${p.receive_level}`;
      this.progressFill.style.width = `${(p.receive_streak / target) * 100}%`;
      this.streakLbl.textContent = `Streak ${p.receive_streak} / ${target}`;
    }
  }

  goBack() {
    if (this.sessionTotal >= SUMMARY_MIN_ROUNDS) {
      this._showSummary();
    } else {
      this._navigateBack();
    }
  }

  _navigateBack() {
    if (this.returnTo === "journey") {
      import("./journey.js").then((m) => this.app.show(m.Journey));
    } else if (this.returnTo === "lessons") {
      import("./lessons.js").then((m) => this.app.show(m.Lessons));
    } else {
      import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
    }
  }

  // extra.leveledUp bypasses the SUMMARY_MIN_ROUNDS check entirely — a
  // level-up is always shown, since streakToClear can be as low as 2 at
  // early levels, so goBack()'s "was this a real session?" threshold
  // doesn't apply to it.
  _showSummary(extra = {}) {
    const stats = {
      correct: this.sessionCorrect,
      total: this.sessionTotal,
      chars: this.sessionChars,
      misses: this.sessionMisses,
      scores: this.sessionScores,
      leveledUp: false,
      unlockedChars: [],
      ...extra,
    };
    import("./sessionSummary.js").then((m) => this.app.show(m.SessionSummary, { mode: "receive", stats }));
  }

  destroy() {
    for (const t of this._timers) clearTimeout(t);
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    this.app.audio.stop();
    recordActivity(this.app.profile, Date.now() - this._visitStart);
    // Re-check achievements here too — five_minute_practice_day is only
    // knowable after recordActivity() just above updates today's total, so
    // checking only from answer() would miss it in the very session that
    // earns it (it'd only unlock next visit).
    this._checkAchievements();
    this.app.saveProfile();
  }
}
