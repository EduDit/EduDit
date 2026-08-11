// Receive Practice: hear a tone, tap the matching character.

import * as codes from "./codes.js";
import { el, button, morseGlyphs, showToast, QWERTY_ROWS, isDigit, attachArrowNav } from "./dom.js";
import { shouldAutoHint, streakToClear, charWeight, pickWeighted } from "./learning.js";
import { explainCharacter } from "./explainSelection.js";
import { evaluateAchievements } from "./achievements.js";
import { recordActivity } from "./dailyPractice.js";
import { newCharacterCard } from "./teachingCard.js";

// A session recap only means something once a few rounds have actually
// happened — below this, a manual exit ("< Menu"/Esc) just navigates back
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
  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    // When set, practice is scoped to one lesson's letters for review —
    // no leveling, just a session-local tally — instead of the full
    // cumulative pool for the profile's current level.
    this.lessonChars = options.lessonChars || null;
    this.lessonNumber = options.lessonNumber || null;
    this.lessonLabel = options.lessonLabel || null;
    // Which screen "< Menu" (and Esc) returns to. Explicit rather than
    // inferred from lessonChars — Home and Journey both launch practice
    // with lessonChars set too now (for weak-letter/single-character
    // drills), so "lessonChars truthy -> came from Lessons" no longer
    // holds. Falls back to the old inference for any caller that doesn't
    // pass it.
    this.returnTo = options.returnTo || (this.lessonChars ? "lessons" : "mainMenu");
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    // Tracked in every round (not just lesson-mode) so Session Summary has
    // something real to show regardless of how the session ends.
    this.sessionChars = new Set();
    this.sessionMisses = {};
    this.target = null;
    this.answered = false;
    this.autoHint = false;
    this._timers = [];
    this.keyButtons = {};
    this._visitStart = Date.now();
    this._build();
    this._bindKeys();
    this.nextRound();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Receive Morse" }));
    this.levelLbl = el("span", { class: "level-tag" });
    top.appendChild(this.levelLbl);
    wrap.appendChild(top);

    wrap.appendChild(
      el("p", { class: "small muted", text: "Listen to the tone and identify the character." })
    );

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

  _pool() {
    return this.lessonChars || codes.poolForLevel(this.app.profile.receive_level);
  }

  nextRound() {
    this.answered = false;
    const pool = this._pool();
    const p = this.app.profile;
    const seen = p.receive_seen || (p.receive_seen = {});
    const missStreaks = p.receive_miss_streak || (p.receive_miss_streak = {});
    const mistakes = p.mistakes || {};
    this.target = pickWeighted(pool, (ch) => charWeight(seen[ch] || 0, mistakes[ch] || 0));

    const seenCount = seen[this.target] || 0;
    const isBrandNew = seenCount === 0;
    this.autoHint = shouldAutoHint(seenCount, missStreaks[this.target] || 0);
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
    }
    this._timers.push(setTimeout(() => this.play(), 350));
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

  play() {
    const s = this.app.profile.settings;
    this.app.audio.playPattern(codes.MORSE[this.target], s.wpm, s.freq, s.volume);
  }

  answer(ch) {
    if (this.answered) return;
    this.answered = true;
    const p = this.app.profile;
    const s = p.settings;
    this.sessionTotal += 1;
    this.sessionChars.add(this.target);
    if (ch === this.target) {
      this.sessionCorrect += 1;
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
      leveledUp: false,
      unlockedChars: [],
      ...extra,
    };
    import("./sessionSummary.js").then((m) => this.app.show(m.SessionSummary, { mode: "receive", stats }));
  }

  destroy() {
    for (const t of this._timers) clearTimeout(t);
    document.removeEventListener("keydown", this._onKeyDown);
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
