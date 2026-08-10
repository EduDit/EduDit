// Main menu: choose a practice mode, open settings, or switch profile.

import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { rankedMistakes } from "./learning.js";

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
    header.appendChild(button("Switch profile", () => this._switch()));
    wrap.appendChild(header);

    wrap.appendChild(
      this._modeCard(
        "Receive Practice",
        "Hear a tone, tap the character.",
        p.receive_level,
        () => this._receive()
      )
    );
    wrap.appendChild(
      this._modeCard(
        "Send Practice",
        "See a character, key it out.",
        p.send_level,
        () => this._send()
      )
    );

    wrap.appendChild(this._weakLettersCard());

    const bottomRow = el("div", { class: "button-row" });
    bottomRow.appendChild(button("Listen  🎧", () => this._listen(), "btn-panel"));
    bottomRow.appendChild(button("Lessons  📖", () => this._lessons(), "btn-panel"));
    bottomRow.appendChild(button("Scoreboard  🏆", () => this._scoreboard(), "btn-panel"));
    bottomRow.appendChild(button("Settings", () => this._settings(), "btn-panel"));
    wrap.appendChild(bottomRow);

    const customRow = el("div", { class: "button-row" });
    customRow.appendChild(button("Custom Lesson  🔤", () => this._customLesson(), "btn-panel btn-block"));
    wrap.appendChild(customRow);

    this.root.appendChild(wrap);
  }

  _weakLettersCard() {
    const card = el("div", { class: "card" });
    card.appendChild(el("span", { class: "heading", text: "Weak letters" }));

    const ranked = rankedMistakes(this.app.profile.mistakes, 5);

    if (ranked.length === 0) {
      card.appendChild(
        el("p", { class: "small muted", text: "None yet — keep practicing!" })
      );
    } else {
      const list = el("p", { class: "mono pool" });
      list.textContent = ranked.map(([ch, count]) => `${ch} (${count})`).join("   ");
      card.appendChild(list);

      const startRow = el("div", { class: "row end" });
      startRow.appendChild(button("Review  ▶", () => this._lessons(), "btn-block-inline"));
      card.appendChild(startRow);
    }
    return card;
  }

  _modeCard(title, subtitle, level, onStart) {
    const card = el("div", { class: "card" });

    const row = el("div", { class: "row" });
    row.appendChild(el("span", { class: "heading", text: title }));
    row.appendChild(el("span", { class: "level-tag", text: `Level ${level}` }));
    card.appendChild(row);

    card.appendChild(el("p", { class: "small muted", text: subtitle }));
    card.appendChild(el("p", { class: "mono pool", text: codes.poolForLevel(level).join(" ") }));

    const startRow = el("div", { class: "row end" });
    startRow.appendChild(button("Start  ▶", onStart, "btn-block-inline"));
    card.appendChild(startRow);

    return card;
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

  _customLesson() {
    // Go to the Lessons screen's Custom Lessons section rather than straight
    // to the "new lesson" editor — otherwise anyone with an existing custom
    // lesson never sees it from this button, only the blank creation form.
    import("./lessons.js").then((m) => this.app.show(m.Lessons));
  }

  _listen() {
    import("./listenPractice.js").then((m) => this.app.show(m.ListenPractice));
  }

  _switch() {
    this.app.profileName = null;
    this.app.profile = null;
    import("./profileSelect.js").then((m) => this.app.show(m.ProfileSelect));
  }

  destroy() {}
}
