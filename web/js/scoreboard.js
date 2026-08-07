// Scoreboard: compares every profile saved on this device/browser.
// Score is simply receive level + send level — higher means more unlocked
// characters mastered in both modes.

import * as storage from "./storage.js";
import { el, button } from "./dom.js";

export class Scoreboard {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this._back()));
    top.appendChild(el("span", { class: "heading", text: "Scoreboard" }));
    wrap.appendChild(top);

    const rows = storage
      .listProfiles()
      .map((name) => {
        const p = storage.loadProfile(name);
        return {
          name,
          receive: p.receive_level,
          send: p.send_level,
          score: p.receive_level + p.send_level,
          weak: this._topWeak(p.mistakes),
        };
      })
      .sort((a, b) => b.score - a.score);

    if (rows.length === 0) {
      wrap.appendChild(el("p", { class: "small muted", text: "No profiles yet." }));
      this.root.appendChild(wrap);
      return;
    }

    const table = el("div", { class: "scoreboard" });

    const header = el("div", { class: "scoreboard-row scoreboard-header" });
    header.appendChild(el("span", { class: "small muted", text: "Name" }));
    header.appendChild(el("span", { class: "small muted", text: "Receive" }));
    header.appendChild(el("span", { class: "small muted", text: "Send" }));
    header.appendChild(el("span", { class: "small muted", text: "Score" }));
    table.appendChild(header);

    rows.forEach((r, i) => {
      const isCurrent = r.name === this.app.profileName;
      const entry = el("div", { class: `scoreboard-entry${isCurrent ? " scoreboard-current" : ""}` });

      const row = el("div", { class: "scoreboard-row" });
      row.appendChild(el("span", { text: `${i + 1}. ${r.name}` }));
      row.appendChild(el("span", { class: "mono", text: String(r.receive) }));
      row.appendChild(el("span", { class: "mono", text: String(r.send) }));
      row.appendChild(el("span", { class: "mono good", text: String(r.score) }));
      entry.appendChild(row);

      entry.appendChild(
        el("p", { class: "small muted weak-line", text: `Weak letters: ${r.weak}` })
      );

      table.appendChild(entry);
    });

    wrap.appendChild(table);
    this.root.appendChild(wrap);
  }

  _topWeak(mistakes) {
    const ranked = Object.entries(mistakes || {})
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (ranked.length === 0) return "none yet";
    return ranked.map(([ch, count]) => `${ch} (${count})`).join(", ");
  }

  _back() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
