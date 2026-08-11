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
import { el, button } from "./dom.js";
import { tierLetters } from "./weakLetters.js";
import { getRecommendation, startRecommendedTraining } from "./recommendation.js";
import { newCharacterCard } from "./teachingCard.js";

export class SessionSummary {
  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    this.mode = options.mode; // "receive" | "send"
    this.stats = {
      correct: 0,
      total: 0,
      chars: new Set(),
      misses: {},
      leveledUp: false,
      unlockedChars: [],
      ...options.stats,
    };
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen" });

    wrap.appendChild(el("div", { class: "title", text: "Session Complete", style: { margin: "26px 0 4px" } }));

    if (this.stats.leveledUp) {
      wrap.appendChild(this._levelUpSection());
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

  _statsSection(p) {
    const wrap = el("div", {});
    const level = this.mode === "receive" ? p.receive_level : p.send_level;
    const streak = this.mode === "receive" ? p.receive_streak : p.send_streak;
    const { correct, total } = this.stats;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

    const grid = el("div", { class: "stat-grid" });
    grid.appendChild(this._statTile("Score", `${correct}/${total}`));
    grid.appendChild(this._statTile("Accuracy", total > 0 ? `${pct}%` : "—"));
    grid.appendChild(this._statTile("Level", String(level)));
    grid.appendChild(this._statTile("Streak", String(streak)));
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
