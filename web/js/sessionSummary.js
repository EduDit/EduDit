// Session Summary: the missing piece that closes the training loop. Shown
// after a Receive/Send Practice session ends — a level-up (always), or a
// manual exit once a real session happened (receivePractice.js/
// sendPractice.js gate that at sessionTotal >= 3, so an accidental
// open-then-leave never produces an empty recap).
//
// Answers three questions without the user having to piece them together:
// "How did I do?", "What should I work on?", "What should I do next?" —
// then hands off to exactly one obvious primary action.

import * as codes from "./codes.js";
import { el, button, animateNumber } from "./dom.js";
import { tierLetters } from "./weakLetters.js";
import { getRecommendation, startRecommendedTraining } from "./recommendation.js";
import { newCharacterCard } from "./teachingCard.js";
import { sessionScore, scoreLabel } from "./scoring.js";

// Session Summary can be shown after very few rounds when a level-up
// triggered it early (see the matching SUMMARY_MIN_ROUNDS in
// receivePractice.js/sendPractice.js) — "no misses" only reads as a real
// accomplishment once a handful of rounds actually happened.
const CLEAN_ROUND_MIN_TOTAL = 3;

export class SessionSummary {
  static navId = "practice";

  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    this.mode = options.mode; // "receive" | "send"
    this.stats = {
      correct: 0,
      total: 0,
      chars: new Set(),
      misses: {},
      scores: [],
      leveledUp: false,
      unlockedChars: [],
      ...options.stats,
    };
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen view-focused" });

    wrap.appendChild(el("div", { class: "title", text: "Session Complete", style: { margin: "26px 0 4px" } }));

    if (this.stats.leveledUp) {
      wrap.appendChild(this._levelUpSection());
      wrap.appendChild(el("div", { class: "divider" }));
    }

    const scoreSection = this._scoreSection();
    if (scoreSection) {
      wrap.appendChild(scoreSection);
      wrap.appendChild(el("div", { class: "divider" }));
    }

    wrap.appendChild(this._statsSection(p));
    wrap.appendChild(el("div", { class: "divider" }));

    const rec = this._recommendation(p);
    wrap.appendChild(this._recommendationSection(p, rec));

    this.root.appendChild(wrap);
  }

  // If a level just unlocked new characters, that's a more useful "what's
  // next" than the generic Home recommendation would give right this
  // moment — otherwise defers entirely to getRecommendation() so Home and
  // Session Summary can never disagree.
  _recommendation(p) {
    if (this.stats.leveledUp && this.stats.unlockedChars.length) {
      const chars = this.stats.unlockedChars;
      return {
        mode: this.mode,
        lessonChars: chars,
        title: "Practice New Characters",
        subtitle: `Get comfortable with ${chars.join(" and ")} before moving on.`,
        reason: "new-characters",
      };
    }
    return getRecommendation(p);
  }

  _levelUpSection() {
    const s = this.app.profile.settings;
    const wrap = el("div", {});
    wrap.appendChild(el("span", { class: "badge", text: "Level Up!" }));
    const count = this.stats.unlockedChars.length;
    wrap.appendChild(
      el("p", {
        class: "heading",
        text: `You unlocked ${count} new character${count === 1 ? "" : "s"}`,
        style: { margin: "8px 0 10px" },
      })
    );
    const row = el("div", { class: "unlocked-chars-row" });
    for (const ch of this.stats.unlockedChars) {
      row.appendChild(
        newCharacterCard(ch, {
          onPlay: () => this.app.audio.playPattern(codes.MORSE[ch], s.wpm, s.freq, s.volume),
        })
      );
    }
    wrap.appendChild(row);
    return wrap;
  }

  // Omitted entirely (not shown as a misleading 0) when the session had no
  // scoreable rounds — e.g. a short review that was all auto-hint/new
  // characters. Accuracy still shows in _statsSection() below either way.
  _scoreSection() {
    const score = sessionScore(this.stats.scores);
    if (score == null) return null;

    const wrap = el("div", { class: "center" });
    wrap.appendChild(el("p", { class: "small muted", text: "Session Score" }));
    const scoreEl = el("div", { class: "hero-number" });
    wrap.appendChild(scoreEl);
    animateNumber(scoreEl, 0, score, { duration: 500 });
    wrap.appendChild(
      el("p", { class: "small muted", text: `Response speed: ${scoreLabel(score)}` })
    );
    return wrap;
  }

  _statsSection(p) {
    const wrap = el("div", {});
    const level = this.mode === "receive" ? p.receive_level : p.send_level;
    const streak = this.mode === "receive" ? p.receive_streak : p.send_streak;
    const { correct, total } = this.stats;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    // One group fade for the whole grid (not a per-tile staggered pop —
    // several competing entrance animations reads as busy, not polished),
    // plus a count-up on each individual clean number. Score stays a plain
    // "x/y" fraction, not tweened — there's no single number to animate.
    const grid = el("div", { class: "stat-grid fade-in" });
    grid.appendChild(this._statTile("Score", `${correct}/${total}`));

    const accTile = this._statTile("Accuracy", total > 0 ? "0%" : "—");
    grid.appendChild(accTile);
    if (total > 0) animateNumber(accTile.querySelector(".stat-value"), 0, pct, { format: (n) => `${Math.round(n)}%` });

    const levelTile = this._statTile("Level", "0");
    grid.appendChild(levelTile);
    animateNumber(levelTile.querySelector(".stat-value"), 0, level);

    const streakTile = this._statTile("Streak", "0");
    grid.appendChild(streakTile);
    animateNumber(streakTile.querySelector(".stat-value"), 0, streak);

    wrap.appendChild(grid);

    const chars = Array.from(this.stats.chars).sort();
    if (chars.length) {
      wrap.appendChild(
        el("p", { class: "small muted", text: `Characters practiced: ${chars.join(" ")}` })
      );
    }

    const missed = Object.entries(this.stats.misses).sort((a, b) => b[1] - a[1]);
    if (missed.length) {
      const text = missed.slice(0, 5).map(([ch, n]) => `${ch} (${n})`).join(", ");
      wrap.appendChild(el("p", { class: "small bad", text: `Most missed: ${text}` }));
    }

    return wrap;
  }

  _statTile(label, value) {
    return el("div", { class: "stat-tile" }, [
      el("span", { class: "stat-value", text: value }),
      el("span", { class: "stat-label", text: label }),
    ]);
  }

  // One obvious primary action; everything else is visibly secondary
  // (smaller, panel-styled) rather than competing with it for attention.
  _recommendationSection(p, rec) {
    const card = el("div", { class: "card hero-card" });
    const encouragement = this._encouragementLine();
    if (encouragement) card.appendChild(encouragement);
    card.appendChild(el("span", { class: "badge", text: "Up Next" }));
    card.appendChild(el("p", { class: "heading", text: rec.title, style: { margin: "8px 0 2px" } }));
    if (rec.subtitle) card.appendChild(el("p", { class: "small muted", text: rec.subtitle }));
    card.appendChild(
      button("Continue Training  ▶", () => startRecommendedTraining(this.app, rec), "btn-accent btn-block")
    );

    const secondary = el("div", { class: "button-row" });
    const otherMode = this.mode === "receive" ? "send" : "receive";
    if (rec.reason !== "weak" && tierLetters(p).needsWork.length > 0) {
      secondary.appendChild(button("Practice Weak Letters", () => this._practiceWeak(p), "btn-panel"));
    }
    secondary.appendChild(
      button(otherMode === "receive" ? "Try Receive Practice" : "Try Send Practice", () => this._openPractice(otherMode, {}), "btn-panel")
    );
    card.appendChild(secondary);

    card.appendChild(button("Return to Home", () => this._returnHome(), "btn-block btn-panel"));
    return card;
  }

  // A small, honest note — shown only when the session data itself supports
  // it, never invented. The one case with zero ambiguity: no misses at all
  // across a real number of rounds. Deliberately not trying to detect
  // subtler things like "a character just became reliable," since Session
  // Summary has no before/after snapshot to prove that actually just
  // happened (see the redesign plan's discussion of this trade-off).
  _encouragementLine() {
    const { misses, total } = this.stats;
    if (total < CLEAN_ROUND_MIN_TOTAL || Object.keys(misses).length > 0) return null;
    return el("p", { class: "small muted", text: "Clean round — no misses this session.", style: { margin: "0 0 10px" } });
  }

  _practiceWeak(p) {
    const chars = tierLetters(p).needsWork.map((r) => r.ch);
    this._openPractice(this.mode, { lessonChars: chars, lessonLabel: "Weak Letters" });
  }

  _openPractice(mode, options) {
    const opts = { returnTo: "mainMenu", ...options };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, opts));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, opts));
    }
  }

  _returnHome() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  goBack() {
    this._returnHome();
  }

  destroy() {}
}
