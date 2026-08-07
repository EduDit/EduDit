// Receive Practice: hear a tone, tap the matching character.

import * as codes from "./codes.js";
import { el, button, morseGlyphs, QWERTY_ROWS } from "./dom.js";
import { shouldAutoHint, streakToClear, charWeight, pickWeighted } from "./learning.js";

const WRONG_PENALTY = 2;

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
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    this.target = null;
    this.answered = false;
    this.autoHint = false;
    this._timers = [];
    this.keyButtons = {};
    this._build();
    this._bindKeys();
    this.nextRound();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this._back()));
    this.levelLbl = el("span", { class: "level-tag" });
    top.appendChild(this.levelLbl);
    wrap.appendChild(top);

    this.status = el("p", { class: "heading status center" });
    wrap.appendChild(this.status);

    this.hintViz = el("div", { class: "hint-viz" });
    wrap.appendChild(this.hintViz);

    const progressWrap = el("div", { class: "progress" });
    this.progressFill = el("div", { class: "progress-fill" });
    progressWrap.appendChild(this.progressFill);
    wrap.appendChild(progressWrap);

    this.streakLbl = el("p", { class: "small muted center" });
    wrap.appendChild(this.streakLbl);

    const controlsRow = el("div", { class: "button-row" });
    controlsRow.appendChild(button("Replay  ▶", () => this.play(), "btn-accent"));
    controlsRow.appendChild(button("Hint  ?", () => this.showHint(), "btn-panel"));
    wrap.appendChild(controlsRow);

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
    }
    return keyboard;
  }

  // Lets a physical keyboard answer too, not just the on-screen keys —
  // same enabled/disabled rules, so locked characters can't be typed either.
  _bindKeys() {
    this._onKeyDown = (e) => {
      if (e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
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
    this.autoHint = shouldAutoHint(seenCount, missStreaks[this.target] || 0);
    seen[this.target] = seenCount + 1;
    this.app.saveProfile();

    this._updateKeyboard(pool);
    this._updateMeta();

    this.hintViz.innerHTML = "";
    if (this.autoHint) {
      this.status.textContent = `New letter — this is ${this.target}`;
      this.status.className = "heading status center good";
      this.keyButtons[this.target].classList.add("key-hint");
      this.hintViz.appendChild(morseGlyphs(codes.MORSE[this.target], "good"));
    } else {
      this.status.textContent = "Listen…";
      this.status.className = "heading status center";
    }
    this._timers.push(setTimeout(() => this.play(), 350));
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
  }

  play() {
    const s = this.app.profile.settings;
    this.app.audio.playPattern(codes.MORSE[this.target], s.wpm, s.freq, s.volume);
  }

  answer(ch) {
    if (this.answered) return;
    this.answered = true;
    const p = this.app.profile;
    if (ch === this.target) {
      p.receive_miss_streak[this.target] = 0;
      if (this.lessonChars) {
        this.sessionCorrect += 1;
        this.sessionTotal += 1;
        this._setStatus("Correct!", "good");
      } else {
        p.receive_streak += 1;
        const target = streakToClear(p.receive_level);
        if (p.receive_streak >= target) {
          p.receive_streak = 0;
          if (p.receive_level < codes.MAX_LEVEL) {
            p.receive_level += 1;
            this._setStatus("Level up! New characters unlocked.", "good");
          } else {
            this._setStatus("All characters mastered!", "good");
          }
        } else {
          this._setStatus("Correct!", "good");
        }
      }
      this.app.saveProfile();
      this._updateMeta();
      this._timers.push(setTimeout(() => this.nextRound(), 750));
    } else {
      p.receive_miss_streak[this.target] = (p.receive_miss_streak[this.target] || 0) + 1;
      p.mistakes = p.mistakes || {};
      p.mistakes[this.target] = (p.mistakes[this.target] || 0) + 1;
      if (this.lessonChars) {
        this.sessionTotal += 1;
      } else {
        p.receive_streak = Math.max(0, p.receive_streak - WRONG_PENALTY);
      }
      this._setStatus(`It was  ${this.target}  (${codes.MORSE[this.target]})`, "bad");
      this.app.saveProfile();
      this._updateMeta();
      this._timers.push(setTimeout(() => this.nextRound(), 1300));
    }
  }

  _setStatus(text, kind) {
    this.status.textContent = text;
    this.status.className = `heading status center ${kind}`;
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

  _back() {
    if (this.lessonChars) {
      import("./lessons.js").then((m) => this.app.show(m.Lessons));
    } else {
      import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
    }
  }

  destroy() {
    for (const t of this._timers) clearTimeout(t);
    document.removeEventListener("keydown", this._onKeyDown);
    this.app.audio.stop();
  }
}
