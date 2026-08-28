// Progress: answers "are you improving?" first (Overview), then lets you
// drill into per-character accuracy (Letters) or daily consistency
// (Activity) — three tabs instead of one long scroll, merged down from an
// earlier four-tab draft since Accuracy/Characters would have shown the
// same per-letter data under two different labels. Also an informational
// hub, not just a leaderboard: compares every profile saved on this
// device/browser, then lets you drill into one profile's Receive/Send
// breakdown and jump straight into practicing the letters giving it trouble.

import * as storage from "./storage.js";
import * as codes from "./codes.js";
import { el, button, tabBar, pageHeader, attachArrowNav, emptyState } from "./dom.js";
import { accuracyRows, WEAK_REVIEW_POOL_SIZE } from "./learning.js";
import { ACHIEVEMENTS, overallAccuracyPct } from "./achievements.js";
import { streakDays, todayKey } from "./dailyPractice.js";

const OUTER_TABS = [
  { id: "overview", label: "Overview" },
  { id: "letters", label: "Letters" },
  { id: "activity", label: "Activity" },
];

// How many recent days the Activity bar strip shows.
const ACTIVITY_DAYS = 14;

export class Scoreboard {
  static navId = "progress";

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.selectedName = app.profileName;
    this.tab = "overview";
    // The Letters tab's own Receive/Send switch — separate from `tab`
    // above, which switches Overview/Letters/Activity.
    this.innerTab = "receive";
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen view-wide" });
    wrap.appendChild(
      pageHeader({
        title: "Progress",
        actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );
    wrap.appendChild(
      el("p", { class: "small muted", text: "See what you've mastered and what needs work." })
    );

    const names = storage.listProfiles();
    if (names.length === 0) {
      wrap.appendChild(emptyState("No profiles yet."));
      this.root.appendChild(wrap);
      return;
    }

    const rows = names
      .map((name) => {
        const p = storage.loadProfile(name);
        return { name, profile: p, receive: p.receive_level, send: p.send_level, score: p.receive_level + p.send_level };
      })
      .sort((a, b) => b.score - a.score);

    if (!names.includes(this.selectedName)) this.selectedName = rows[0].name;
    const selected = rows.find((r) => r.name === this.selectedName);

    wrap.appendChild(tabBar(OUTER_TABS, this.tab, (id) => this._setTab(id)));

    if (this.tab === "overview") wrap.appendChild(this._overviewPanel(rows, selected));
    else if (this.tab === "letters") wrap.appendChild(this._lettersPanel(selected));
    else wrap.appendChild(this._activityPanel(selected));

    this.root.appendChild(wrap);
  }

  // "Are you improving?" leads the page; the multi-profile comparison table
  // and achievements are real but secondary, pushed below it rather than
  // competing with it for attention.
  _overviewPanel(rows, selected) {
    const wrap = el("div", {});
    wrap.appendChild(this._improvingHero(selected));

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(el("p", { class: "section-title", text: "Compare Profiles" }));
    wrap.appendChild(this._table(rows));

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(this._achievementsSection(selected));

    return wrap;
  }

  // A status, not a fabricated trend — there's no session history to point
  // at "improved since last week," so this reports current accuracy and
  // streak plainly rather than overclaiming.
  _improvingHero(entry) {
    const pct = overallAccuracyPct(entry.profile);
    const dayStreak = streakDays(entry.profile.daily_practice);

    const card = el("div", { class: "card hero-card" });
    card.appendChild(el("span", { class: "badge", text: "Are You Improving?" }));

    if (pct == null) {
      card.appendChild(emptyState("Practice a little and your accuracy will show up here."));
      return card;
    }

    card.appendChild(
      el("div", { class: "hero-number", text: `${Math.round(pct)}%`, style: { margin: "8px 0 2px" } })
    );
    card.appendChild(
      el("p", {
        class: "small muted",
        text: `${entry.name}'s overall accuracy${dayStreak > 0 ? `   ·   ${dayStreak}-day streak` : ""}`,
      })
    );
    return card;
  }

  // Kept secondary — a small section, not a Home-screen feature.
  _achievementsSection(entry) {
    const earned = entry.profile.achievements || {};
    const earnedList = ACHIEVEMENTS.filter((a) => earned[a.id]);

    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "heading", text: "Achievements" }));
    wrap.appendChild(
      el("p", { class: "small muted", text: `${earnedList.length} / ${ACHIEVEMENTS.length} earned` })
    );

    if (earnedList.length === 0) {
      wrap.appendChild(emptyState("Keep practicing — your first achievement is closer than you think."));
    } else {
      const badgeRow = el("div", { class: "badge-row" });
      for (const a of earnedList) {
        badgeRow.appendChild(el("span", { class: "badge", text: `🏅 ${a.label}` }));
      }
      wrap.appendChild(badgeRow);
    }

    const cs = entry.profile.callsign_stats;
    if (cs && cs.attempts > 0) {
      wrap.appendChild(
        el("p", { class: "small muted", text: `Callsigns copied: ${cs.correct}/${cs.attempts} correct` })
      );
    }

    return wrap;
  }

  _table(rows) {
    const table = el("div", { class: "scoreboard" });

    const header = el("div", { class: "scoreboard-row scoreboard-header" });
    header.appendChild(el("span", { class: "small muted", text: "Name" }));
    header.appendChild(el("span", { class: "small muted", text: "Receive" }));
    header.appendChild(el("span", { class: "small muted", text: "Send" }));
    header.appendChild(el("span", { class: "small muted", text: "Score" }));
    table.appendChild(header);

    rows.forEach((r, i) => {
      const isCurrent = r.name === this.app.profileName;
      const isSelected = r.name === this.selectedName;
      const classes = ["scoreboard-entry"];
      if (isCurrent) classes.push("scoreboard-current");
      if (isSelected) classes.push("scoreboard-selected");
      const entry = el("button", { class: classes.join(" "), onclick: () => this._select(r.name) });

      const row = el("div", { class: "scoreboard-row" });
      row.appendChild(el("span", { text: `${i + 1}. ${r.name}` }));
      row.appendChild(el("span", { class: "mono", text: String(r.receive) }));
      row.appendChild(el("span", { class: "mono", text: String(r.send) }));
      row.appendChild(el("span", { class: "mono good", text: String(r.score) }));
      entry.appendChild(row);

      table.appendChild(entry);
    });

    return table;
  }

  // Selecting a profile from the comparison table jumps straight to its
  // Letters tab — the whole point of picking a different profile here is to
  // see its accuracy, so this avoids an extra "now click Letters" step.
  _select(name) {
    if (name === this.selectedName && this.tab === "letters") return;
    this.selectedName = name;
    this.tab = "letters";
    this.innerTab = "receive";
    this.root.innerHTML = "";
    this._build();
  }

  _setTab(id) {
    if (id === this.tab) return;
    this.tab = id;
    this.root.innerHTML = "";
    this._build();
  }

  _setInnerTab(tab) {
    if (tab === this.innerTab) return;
    this.innerTab = tab;
    this.root.innerHTML = "";
    this._build();
  }

  _lettersPanel(entry) {
    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "heading detail-heading", text: `${entry.name} — letter accuracy` }));

    const tabs = el("div", { class: "tabs" });
    tabs.appendChild(this._innerTabButton("Receive", "receive"));
    tabs.appendChild(this._innerTabButton("Send", "send"));
    attachArrowNav(tabs);
    wrap.appendChild(tabs);

    const p = entry.profile;
    const seen = this.innerTab === "receive" ? p.receive_seen : p.send_seen;
    const mistakes = this.innerTab === "receive" ? p.receive_mistakes : p.send_mistakes;
    const rows = accuracyRows(seen || {}, mistakes || {}, codes.LEARNING_ORDER);

    if (rows.length === 0) {
      wrap.appendChild(emptyState(`No ${this.innerTab} practice recorded yet.`));
      return wrap;
    }

    wrap.appendChild(this._accuracyList(rows));

    const isCurrentProfile = entry.name === this.app.profileName;
    const weak = rows.filter((r) => r.misses > 0).slice(0, WEAK_REVIEW_POOL_SIZE);
    if (isCurrentProfile && weak.length > 0) {
      const actionRow = el("div", { class: "button-row" });
      actionRow.appendChild(
        button(`Practice these  ▶`, () => this._practiceWeak(weak.map((r) => r.ch)), "btn-panel btn-block")
      );
      actionRow.appendChild(button("Custom Lessons  ▶", () => this._lessons(), "btn-panel btn-block"));
      wrap.appendChild(actionRow);
    }

    return wrap;
  }

  _innerTabButton(label, tab) {
    const active = this.innerTab === tab;
    const cls = `tab-btn${active ? " tab-btn-active" : ""}`;
    const btn = button(label, () => this._setInnerTab(tab), cls);
    btn.setAttribute("aria-pressed", String(active));
    return btn;
  }

  _accuracyList(rows) {
    const list = el("div", { class: "accuracy-list" });
    for (const r of rows) {
      const kind = r.pct >= 90 ? "good" : r.pct < 60 ? "bad" : "";
      const item = el("div", { class: "accuracy-row" });
      item.appendChild(el("span", { class: "mono accuracy-char", text: r.ch }));
      const bar = el("div", { class: "accuracy-bar" });
      bar.appendChild(el("div", { class: `accuracy-bar-fill ${kind}`.trim(), style: { width: `${r.pct}%` } }));
      item.appendChild(bar);
      item.appendChild(el("span", { class: `mono accuracy-pct ${kind}`.trim(), text: `${r.pct}%` }));
      item.appendChild(el("span", { class: "small muted accuracy-count", text: `${r.attempts - r.misses}/${r.attempts}` }));
      list.appendChild(item);
    }
    return list;
  }

  // Real data only — dailyPractice.js tracks per-day active minutes, not a
  // session log, so this is a recent-days bar strip + streak, not an
  // invented list of individual sessions.
  _activityPanel(entry) {
    const p = entry.profile;
    const dayStreak = streakDays(p.daily_practice);

    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "heading", text: `${entry.name} — activity` }));
    wrap.appendChild(
      dayStreak > 0
        ? el("p", { class: "small muted", text: `${dayStreak}-day practice streak.` })
        : emptyState("No recent activity streak yet.")
    );
    wrap.appendChild(this._activityBars(p.daily_practice || {}));
    return wrap;
  }

  _activityBars(dailyPractice) {
    const days = [];
    const cursor = new Date();
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i--) {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() - i);
      days.push(dailyPractice[todayKey(d)] || 0);
    }
    const maxMs = Math.max(1, ...days);

    const wrap = el("div", { class: "activity-bars" });
    for (const ms of days) {
      const pct = ms > 0 ? Math.max(6, Math.round((ms / maxMs) * 100)) : 3;
      const bar = el("div", { class: "activity-bar", title: `${Math.round(ms / 60000)} min` });
      bar.appendChild(el("div", { class: `activity-bar-fill${ms > 0 ? " good" : ""}`, style: { height: `${pct}%` } }));
      wrap.appendChild(bar);
    }
    return wrap;
  }

  _practiceWeak(chars) {
    const options = { lessonChars: chars, lessonLabel: "Weak letters", returnTo: "lessons" };
    if (this.innerTab === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _lessons() {
    import("./lessons.js").then((m) => this.app.show(m.Lessons));
  }

  goBack() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
