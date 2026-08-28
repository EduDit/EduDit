// Morse Journey: a visual walk through the Morse alphabet, grouped into
// Learn / Practice / Master / Advance bands by how far along each character
// is — not a flat data table, and not one undifferentiated grid. Each
// character shows an icon+color state (never color alone) so the state
// reads even without knowing the internal terminology. Tapping one reveals
// its details in a side panel (desktop) or inline below (mobile).

import * as codes from "./codes.js";
import { el, button, morseGlyphs, attachArrowNav, pageHeader } from "./dom.js";
import { stateFor } from "./characterState.js";
import { combinedSeen, combinedFluency, tierLetters } from "./weakLetters.js";

const ICONS = { strong: "✓", practicing: "●", learning: "○", locked: "🔒" };
const STATE_LABEL = {
  strong: "You know this well",
  practicing: "Still practicing",
  learning: "Not started yet",
  locked: "Not unlocked yet",
};

// Reading order matches the brief's own framing: a character starts
// unlocked-but-untouched (Learn), gets attempted (Practice), becomes
// accurate and fast (Master) — and everything still locked is what's
// coming up (Advance). Bands with nothing in them are simply skipped.
const BANDS = [
  { state: "learning", title: "Learn", desc: "Unlocked, not started yet." },
  { state: "practicing", title: "Practice", desc: "You've started — keep going." },
  { state: "strong", title: "Master", desc: "You know these well." },
  { state: "locked", title: "Advance", desc: "Coming up next." },
];

export class Journey {
  static navId = "journey";

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.selected = null;
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen view-standard" });

    wrap.appendChild(
      pageHeader({
        title: "Journey",
        actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "See what you've learned and what's next. Tap a character for details.",
      })
    );

    const level = Math.max(p.receive_level, p.send_level);
    const seen = combinedSeen(p);
    const mistakes = p.mistakes || {};
    const fluency = combinedFluency(p);
    const weakChars = new Set(tierLetters(p).needsWork.map((r) => r.ch));

    const grouped = { learning: [], practicing: [], strong: [], locked: [] };
    for (const ch of codes.LEARNING_ORDER) {
      grouped[stateFor(ch, level, seen, mistakes, fluency[ch])].push(ch);
    }

    const layout = el("div", { class: "journey-layout" });

    const bandsWrap = el("div", { class: "journey-bands" });
    for (const band of BANDS) {
      const chars = grouped[band.state];
      if (chars.length === 0) continue;
      bandsWrap.appendChild(this._band(band, chars));
    }
    layout.appendChild(bandsWrap);

    const detailWrap = el("div", { class: "journey-detail-panel" });
    if (this.selected) {
      detailWrap.appendChild(this._detail(this.selected, level, seen, mistakes, weakChars, fluency));
    } else {
      detailWrap.appendChild(
        el("p", { class: "journey-detail-placeholder", text: "Tap a character above to see its details." })
      );
    }
    layout.appendChild(detailWrap);

    wrap.appendChild(layout);

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(button("Open Lessons  ▶", () => this._lessons(), "btn-panel btn-block"));

    this.root.appendChild(wrap);
  }

  _band(band, chars) {
    const section = el("div", { class: "journey-band" });
    section.appendChild(el("p", { class: "journey-band-title", text: band.title }));
    section.appendChild(el("p", { class: "journey-band-desc", text: band.desc }));

    const grid = el("div", { class: "journey-grid" });
    for (const ch of chars) {
      const isSelected = this.selected === ch;
      grid.appendChild(
        el("button", {
          class: `state-badge state-${band.state}${isSelected ? " state-selected" : ""}`,
          "aria-label": `${ch}: ${STATE_LABEL[band.state]}`,
          "aria-pressed": String(isSelected),
          text: band.state === "locked" ? ICONS.locked : `${ICONS[band.state]} ${ch}`,
          onclick: () => this._select(ch),
        })
      );
    }
    attachArrowNav(grid);
    section.appendChild(grid);
    return section;
  }

  _detail(ch, level, seen, mistakes, weakChars, fluency) {
    const state = stateFor(ch, level, seen, mistakes, fluency[ch]);
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
