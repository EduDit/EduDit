// Scoreboard: an informational hub, not just a leaderboard. Compares every
// profile saved on this device/browser, then lets you drill into one
// profile's letter-by-letter Receive/Send accuracy — the same data that
// used to live only on the main menu's "Weak letters" card — and jump
// straight into practicing the letters giving it trouble.

import * as storage from "./storage.js";
import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { accuracyRows, WEAK_REVIEW_POOL_SIZE } from "./learning.js";

export class Scoreboard {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.selectedName = app.profileName;
    this.tab = "receive";
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this._back()));
    top.appendChild(el("span", { class: "heading", text: "Scoreboard" }));
    wrap.appendChild(top);

    const names = storage.listProfiles();
    if (names.length === 0) {
      wrap.appendChild(el("p", { class: "small muted", text: "No profiles yet." }));
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

    wrap.appendChild(this._table(rows));
    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(this._detail(rows.find((r) => r.name === this.selectedName)));

    this.root.appendChild(wrap);
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

  _select(name) {
    if (name === this.selectedName) return;
    this.selectedName = name;
    this.tab = "receive";
    this.root.innerHTML = "";
    this._build();
  }

  _setTab(tab) {
    if (tab === this.tab) return;
    this.tab = tab;
    this.root.innerHTML = "";
    this._build();
  }

  _detail(entry) {
    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "heading detail-heading", text: `${entry.name} — letter accuracy` }));

    const tabs = el("div", { class: "tabs" });
    tabs.appendChild(this._tabButton("Receive", "receive"));
    tabs.appendChild(this._tabButton("Send", "send"));
    wrap.appendChild(tabs);

    const p = entry.profile;
    const seen = this.tab === "receive" ? p.receive_seen : p.send_seen;
    const mistakes = this.tab === "receive" ? p.receive_mistakes : p.send_mistakes;
    const rows = accuracyRows(seen || {}, mistakes || {}, codes.LEARNING_ORDER);

    if (rows.length === 0) {
      wrap.appendChild(
        el("p", { class: "small muted", text: `No ${this.tab} practice recorded yet.` })
      );
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

  _tabButton(label, tab) {
    const cls = `tab-btn${this.tab === tab ? " tab-btn-active" : ""}`;
    return button(label, () => this._setTab(tab), cls);
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

  _practiceWeak(chars) {
    const options = { lessonChars: chars, lessonLabel: "Weak letters" };
    if (this.tab === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _lessons() {
    import("./lessons.js").then((m) => this.app.show(m.Lessons));
  }

  _back() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
