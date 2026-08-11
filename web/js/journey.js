// Morse Journey: a simple visual walk through the Morse alphabet in the
// order it's learned — not a data table. Each character shows an icon+color
// state (never color alone) so the state reads even without knowing the
// internal terminology. Tapping one reveals its details.

import * as codes from "./codes.js";
import { el, button, morseGlyphs } from "./dom.js";
import { stateFor } from "./characterState.js";
import { combinedSeen, tierLetters } from "./weakLetters.js";

const ICONS = { strong: "✓", practicing: "●", learning: "○", locked: "🔒" };
const STATE_LABEL = {
  strong: "You know this well",
  practicing: "Still practicing",
  learning: "Not started yet",
  locked: "Not unlocked yet",
};

export class Journey {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.selected = null;
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Morse Journey" }));
    wrap.appendChild(top);

    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Your path through the Morse alphabet, in the order you learn it. Tap a character for details.",
      })
    );

    const level = Math.max(p.receive_level, p.send_level);
    const seen = combinedSeen(p);
    const mistakes = p.mistakes || {};
    const weakChars = new Set(tierLetters(p).needsWork.map((r) => r.ch));

    const grid = el("div", { class: "journey-grid" });
    for (const ch of codes.LEARNING_ORDER) {
      const state = stateFor(ch, level, seen, mistakes);
      const isSelected = this.selected === ch;
      grid.appendChild(
        el("button", {
          class: `state-badge state-${state}${isSelected ? " state-selected" : ""}`,
          "aria-label": `${ch}: ${STATE_LABEL[state]}`,
          "aria-pressed": String(isSelected),
          text: state === "locked" ? ICONS.locked : `${ICONS[state]} ${ch}`,
          onclick: () => this._select(ch),
        })
      );
    }
    wrap.appendChild(grid);

    if (this.selected) {
      wrap.appendChild(this._detail(this.selected, level, seen, mistakes, weakChars));
    }

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(button("Open Lessons  ▶", () => this._lessons(), "btn-panel btn-block"));

    this.root.appendChild(wrap);
  }

  _detail(ch, level, seen, mistakes, weakChars) {
    const state = stateFor(ch, level, seen, mistakes);
    const attempts = seen[ch] || 0;
    const misses = mistakes[ch] || 0;
    const pct = attempts > 0 ? Math.round(((attempts - misses) / attempts) * 100) : null;

    const card = el("div", { class: "card pop-in" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { class: "heading mono", text: ch }));
    row.appendChild(morseGlyphs(codes.MORSE[ch]));
    card.appendChild(row);

    card.appendChild(el("p", { class: "small muted", text: STATE_LABEL[state] }));

    if (attempts > 0) {
      card.appendChild(
        el("p", {
          class: "small",
          text: `Accuracy: ${pct}%  •  ${attempts} attempt${attempts === 1 ? "" : "s"}  •  ${misses} miss${misses === 1 ? "" : "es"}`,
        })
      );
      if (weakChars.has(ch)) {
        card.appendChild(el("p", { class: "small bad", text: "Currently one of your weaker characters." }));
      }
    } else if (state !== "locked") {
      card.appendChild(el("p", { class: "small muted", text: "Not attempted yet." }));
    }

    if (state !== "locked") {
      const actionRow = el("div", { class: "button-row" });
      actionRow.appendChild(button("Practice Receiving", () => this._practice("receive", ch), "btn-panel"));
      actionRow.appendChild(button("Practice Sending", () => this._practice("send", ch), "btn-panel"));
      card.appendChild(actionRow);
    }

    return card;
  }

  _select(ch) {
    this.selected = this.selected === ch ? null : ch;
    this.root.innerHTML = "";
    this._build();
  }

  _practice(mode, ch) {
    const options = { lessonChars: [ch], lessonLabel: `Practicing ${ch}`, returnTo: "journey" };
    if (mode === "receive") {
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
