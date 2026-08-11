// Home dashboard: answers "what should I do next?" with one dominant
// action, a compact progress summary, and quick access to everything else
// for returning/experienced users who already know what they want.

import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { streakToClear } from "./learning.js";
import { getRecommendation, startRecommendedTraining } from "./recommendation.js";
import { tierLetters, combinedSeen } from "./weakLetters.js";
import { todayMs, streakDays } from "./dailyPractice.js";

const DAILY_GOAL_MINUTES = 5;

export class MainMenu {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen" });

    const header = el("div", { class: "row header-row" });
    header.appendChild(el("div", { class: "title", text: this.app.profileName, style: { margin: "0" } }));
    header.appendChild(button("Switch profile", () => this._switch(), "btn-panel"));
    wrap.appendChild(header);

    const rec = getRecommendation(p);
    wrap.appendChild(this._heroCard(rec));
    wrap.appendChild(this._statsSection(p, rec));
    wrap.appendChild(this._todaysPracticeCard(p));
    wrap.appendChild(this._quickAccess());

    this.root.appendChild(wrap);
  }

  // One dominant action, always labeled the same way — what changes is the
  // explanation underneath, generated fresh from the profile's real state
  // every time this screen loads.
  _heroCard(rec) {
    const card = el("div", { class: "card hero-card" });
    card.appendChild(el("span", { class: "badge", text: "Today's Focus" }));
    card.appendChild(el("p", { class: "heading", text: rec.title, style: { margin: "8px 0 2px" } }));
    card.appendChild(el("p", { class: "small muted", text: rec.subtitle }));
    card.appendChild(
      button("Start Today's Training  ▶", () => this._startTraining(rec), "btn-accent btn-block")
    );
    return card;
  }

  _statsSection(p, rec) {
    const wrap = el("div", {});
    const level = rec.mode === "receive" ? p.receive_level : p.send_level;
    const streak = rec.mode === "receive" ? p.receive_streak : p.send_streak;
    const target = streakToClear(level);
    const pool = codes.poolForLevel(level);

    const { attempts, misses } = this._overallAccuracy(p);
    const accuracyText = attempts > 0 ? `${Math.round(((attempts - misses) / attempts) * 100)}%` : "—";
    const needsAttention = tierLetters(p).needsWork.length;

    const grid = el("div", { class: "stat-grid" });
    grid.appendChild(this._statTile("Level", String(level)));
    grid.appendChild(this._statTile("Characters", `${pool.length}/${codes.LEARNING_ORDER.length}`));
    grid.appendChild(this._statTile("Accuracy", accuracyText));
    grid.appendChild(this._statTile("Streak", String(streak)));
    grid.appendChild(this._statTile("Needs Attention", String(needsAttention)));
    wrap.appendChild(grid);

    const progressWrap = el("div", { class: "progress" });
    progressWrap.appendChild(el("div", { class: "progress-fill", style: { width: `${Math.min(100, (streak / target) * 100)}%` } }));
    wrap.appendChild(progressWrap);
    wrap.appendChild(
      el("p", { class: "small muted", text: `Level ${level}: ${streak} / ${target} toward your next level` })
    );

    return wrap;
  }

  // Encouraging, never punishing — a missed day just isn't counted; there's
  // no "goal missed" language and the streak simply resumes once practice
  // does.
  _todaysPracticeCard(p) {
    const minutes = todayMs(p) / 60000;
    const pct = Math.min(100, (minutes / DAILY_GOAL_MINUTES) * 100);
    const streak = streakDays(p.daily_practice);

    const card = el("div", {});
    card.appendChild(el("span", { class: "small muted", text: "Today's Practice" }));
    const progressWrap = el("div", { class: "progress" });
    progressWrap.appendChild(el("div", { class: "progress-fill", style: { width: `${pct}%` } }));
    card.appendChild(progressWrap);

    const minutesText = minutes >= 1 ? `${minutes.toFixed(1).replace(/\.0$/, "")} min today` : "Not yet today — any time counts";
    const streakText = streak > 0 ? `  •  ${streak}-day streak` : "";
    card.appendChild(el("p", { class: "small muted", text: `${minutesText}${streakText}` }));

    return card;
  }

  _statTile(label, value) {
    return el("div", { class: "stat-tile" }, [
      el("span", { class: "stat-value", text: value }),
      el("span", { class: "stat-label", text: label }),
    ]);
  }

  _overallAccuracy(p) {
    const seen = combinedSeen(p);
    // "I don't know" (Receive Practice) is neutral — never a mistake — but
    // it's also not a demonstrated correct answer, so it's excluded from
    // both sides of the percentage rather than silently counting as
    // correct. Same exclusion as achievements.js's totalCorrect().
    const dontKnow = Object.values(p.receive_dont_know || {}).reduce((sum, n) => sum + n, 0);
    const attempts = Object.values(seen).reduce((sum, n) => sum + n, 0) - dontKnow;
    const misses = Object.values(p.mistakes || {}).reduce((sum, n) => sum + n, 0);
    return { attempts, misses };
  }

  // Secondary, clearly less prominent than the hero card — this is what
  // keeps a returning/experienced user fast: one click to any mode without
  // going through the recommendation at all.
  _quickAccess() {
    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "small muted", text: "Or choose what to practice:" }));

    const row1 = el("div", { class: "button-row" });
    row1.appendChild(button("Receive Morse", () => this._receive(), "btn-panel"));
    row1.appendChild(button("Send Morse", () => this._send(), "btn-panel"));
    wrap.appendChild(row1);

    const row2 = el("div", { class: "button-row" });
    row2.appendChild(button("Journey", () => this._journey(), "btn-panel"));
    row2.appendChild(button("Lessons", () => this._lessons(), "btn-panel"));
    wrap.appendChild(row2);

    // Listen and Callsigns sit together — both are exploratory, non-leveling
    // modes, unlike the leveled Receive/Send practice above.
    const row3 = el("div", { class: "button-row" });
    row3.appendChild(button("Listen", () => this._listen(), "btn-panel"));
    row3.appendChild(button("Callsigns", () => this._callsigns(), "btn-panel"));
    wrap.appendChild(row3);

    const row4 = el("div", { class: "button-row" });
    row4.appendChild(button("Progress", () => this._scoreboard(), "btn-panel"));
    row4.appendChild(button("Settings", () => this._settings(), "btn-panel"));
    wrap.appendChild(row4);

    return wrap;
  }

  _startTraining(rec) {
    startRecommendedTraining(this.app, rec);
  }

  _receive() {
    import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice));
  }

  _send() {
    import("./sendPractice.js").then((m) => this.app.show(m.SendPractice));
  }

  _settings() {
    import("./settings.js").then((m) => this.app.show(m.Settings));
  }

  _scoreboard() {
    import("./scoreboard.js").then((m) => this.app.show(m.Scoreboard));
  }

  _lessons() {
    import("./lessons.js").then((m) => this.app.show(m.Lessons));
  }

  _journey() {
    import("./journey.js").then((m) => this.app.show(m.Journey));
  }

  _listen() {
    import("./listenPractice.js").then((m) => this.app.show(m.ListenPractice));
  }

  _callsigns() {
    import("./callsignPractice.js").then((m) => this.app.show(m.CallsignPractice));
  }

  _switch() {
    this.app.profileName = null;
    this.app.profile = null;
    import("./profileSelect.js").then((m) => this.app.show(m.ProfileSelect));
  }

  destroy() {}
}
