// Home dashboard: answers exactly one question — "what should I do now?" —
// with one dominant hero action, full stop. Everything else (accuracy,
// streak, level, today's practice) is deliberately secondary: a single
// quiet stat line rather than a tile grid, linking out to Progress for
// detail instead of restating it here. A short list of descriptive rows
// lets a returning learner jump straight into a specific practice mode
// without going through the recommendation at all.

import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { getRecommendation, startRecommendedTraining } from "./recommendation.js";
import { combinedSeen } from "./weakLetters.js";
import { todayMs, streakDays } from "./dailyPractice.js";

const DAILY_GOAL_MINUTES = 5;

const PRACTICE_OPTIONS = [
  { tab: "receive", title: "Receive", desc: "Hear Morse and identify the character." },
  { tab: "send", title: "Send", desc: "See a character and key it." },
  { tab: "listen", title: "Listen", desc: "Build your ear without answering." },
  { tab: "key", title: "Key Practice", desc: "Send Morse with a real physical key or paddle." },
  { tab: "callsigns", title: "Callsigns", desc: "Practice realistic radio exchanges." },
];

export class MainMenu {
  static navId = "home";

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen view-wide" });

    wrap.appendChild(this._greeting());

    const rec = getRecommendation(p);
    const grid = el("div", { class: "home-grid" });
    const main = el("div", { class: "home-main" });
    main.appendChild(this._heroCard(rec));
    main.appendChild(this._quietStatLine(p, rec));
    main.appendChild(this._todaysPracticeLine(p));
    grid.appendChild(main);
    grid.appendChild(this._journeyTeaser(p));
    wrap.appendChild(grid);

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(this._practiceOptions());

    this.root.appendChild(wrap);
  }

  _greeting() {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    return el("div", { style: { margin: "4px 0 24px" } }, [
      el("h1", { class: "title", text: greeting, style: { margin: "0 0 4px" } }),
      el("p", { class: "small muted", text: "Ready for another session?" }),
    ]);
  }

  // One dominant action, always framed the same way — what changes is the
  // explanation underneath, generated fresh from the profile's real state
  // every time this screen loads. Nothing else on the page competes with it.
  _heroCard(rec) {
    const card = el("div", { class: "card hero-card" });
    card.appendChild(el("span", { class: "badge", text: "Continue Your Journey" }));
    card.appendChild(el("p", { class: "heading", text: rec.title, style: { margin: "8px 0 2px" } }));
    card.appendChild(el("p", { class: "small muted", text: rec.subtitle }));
    card.appendChild(
      button("Start Practice  ▶", () => this._startTraining(rec), "btn-accent btn-block")
    );
    return card;
  }

  // A single quiet line, not a stat grid — Home doesn't need to own this
  // data, it just needs to point at where the full picture lives.
  _quietStatLine(p, rec) {
    const level = rec.mode === "receive" ? p.receive_level : p.send_level;
    const { attempts, misses } = this._overallAccuracy(p);
    const dayStreak = streakDays(p.daily_practice);

    const parts = [`Level ${level}`];
    if (attempts > 0) parts.push(`${Math.round(((attempts - misses) / attempts) * 100)}% accuracy`);
    if (dayStreak > 0) parts.push(`${dayStreak}-day streak`);

    const line = el("div", { class: "quiet-stat-line" });
    line.appendChild(el("span", { text: parts.join("   ·   ") }));
    line.appendChild(
      el("button", { class: "link-btn", text: "See full progress →", onclick: () => this._scoreboard() })
    );
    return line;
  }

  // Encouraging, never punishing — a missed day just isn't counted; there's
  // no "goal missed" language and the streak simply resumes once practice
  // does. The day-streak itself is already in the quiet stat line above, so
  // this line stays about today specifically.
  _todaysPracticeLine(p) {
    const minutes = todayMs(p) / 60000;
    const pct = Math.min(100, (minutes / DAILY_GOAL_MINUTES) * 100);

    const wrap = el("div", { style: { margin: "18px 0 0" } });
    const progressWrap = el("div", { class: "progress" });
    progressWrap.appendChild(el("div", { class: "progress-fill", style: { width: `${pct}%` } }));
    wrap.appendChild(progressWrap);
    const minutesText =
      minutes >= 1 ? `${minutes.toFixed(1).replace(/\.0$/, "")} min today` : "Not yet today — any time counts";
    wrap.appendChild(el("p", { class: "small muted", text: minutesText, style: { margin: "4px 0 0" } }));
    return wrap;
  }

  // Secondary, visually lighter than the hero — "show me what I've learned
  // and what's next," in Journey's own words, not a duplicate stat block.
  _journeyTeaser(p) {
    const level = Math.max(p.receive_level, p.send_level);
    const pool = codes.poolForLevel(level);
    const aside = el("div", { class: "home-aside section" });
    aside.appendChild(el("p", { class: "section-title", text: "Your Journey" }));
    aside.appendChild(
      el("p", {
        class: "small muted",
        text: `${pool.length} of ${codes.LEARNING_ORDER.length} characters learned so far.`,
      })
    );
    aside.appendChild(button("View Journey  ▶", () => this._journey(), "btn-panel btn-block"));
    return aside;
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

  // Descriptive rows, not a wall of buttons (item 16) — each names the mode
  // and what it's for, so a first-time visitor understands Receive vs. Send
  // vs. Listen vs. Callsigns without having to try each one. Routes through
  // PracticeHub (not a direct deep link) since this is open-ended browsing,
  // not a contextual "practice this one thing and come back" flow.
  _practiceOptions() {
    const wrap = el("div", { class: "section" });
    wrap.appendChild(el("p", { class: "section-title", text: "Or choose what to practice" }));

    for (const opt of PRACTICE_OPTIONS) {
      wrap.appendChild(
        el(
          "button",
          { class: "option-row", onclick: () => this._practice(opt.tab) },
          [
            el("span", {}, [
              el("span", { class: "option-row-title", text: opt.title }),
              el("span", { class: "option-row-desc", text: opt.desc }),
            ]),
            el("span", { class: "option-row-arrow", "aria-hidden": "true", text: "›" }),
          ]
        )
      );
    }
    return wrap;
  }

  _startTraining(rec) {
    startRecommendedTraining(this.app, rec);
  }

  _practice(tab) {
    import("./practiceHub.js").then((m) => this.app.show(m.PracticeHub, { tab }));
  }

  _scoreboard() {
    import("./scoreboard.js").then((m) => this.app.show(m.Scoreboard));
  }

  _journey() {
    import("./journey.js").then((m) => this.app.show(m.Journey));
  }

  destroy() {}
}
