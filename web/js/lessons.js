// Lessons: two ways to drill specific characters without touching level or
// streak progress — practice here is scored only for the current session.
//
// - Custom Lessons: hand-picked sets of characters, plus one pinned,
//   auto-generated entry ("Weak Letters") built from whichever letters have
//   the most recorded mistakes (see rankedMistakes in learning.js) — it
//   can't be edited or deleted, it just recomputes on every visit.
// - Unlocked Lessons: every batch of letters introduced so far, same as
//   before — lets a learner jump back into any of them for review.

import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { rankedMistakes, WEAK_REVIEW_POOL_SIZE } from "./learning.js";
import { confirmDialog } from "./dialog.js";

export class Lessons {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Menu", () => this._back()));
    top.appendChild(el("span", { class: "heading", text: "Lessons" }));
    wrap.appendChild(top);

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(el("p", { class: "heading", text: "Custom Lessons" }));
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Pick your own set of letters to drill — good for one stubborn character or a random mix.",
      })
    );
    const weakCard = this._weakLessonCard(p);
    const customLessons = p.custom_lessons || [];
    if (!weakCard && customLessons.length === 0) {
      wrap.appendChild(el("p", { class: "small muted", text: "No custom lessons yet." }));
    } else {
      if (weakCard) wrap.appendChild(weakCard);
      for (const lesson of customLessons) {
        wrap.appendChild(this._customLessonRow(lesson));
      }
    }
    wrap.appendChild(button("+ New custom lesson", () => this._newCustomLesson(), "btn-panel btn-block"));

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(el("p", { class: "heading", text: "Unlocked Lessons" }));
    wrap.appendChild(
      el("p", { class: "small muted", text: "Review any lesson you've already reached — this won't affect your level." })
    );

    const highestUnlocked = Math.max(p.receive_level, p.send_level);
    for (let n = 1; n <= highestUnlocked; n++) {
      wrap.appendChild(this._lessonRow(n, p));
    }

    this.root.appendChild(wrap);
  }

  // The pinned, auto-updating "Weak Letters" entry — recomputed from
  // rankedMistakes on every visit rather than saved, so it can't drift out
  // of date and there's nothing to edit or delete. Returns null once there
  // are no recorded mistakes yet, so it can be omitted entirely.
  _weakLessonCard(p) {
    const ranked = rankedMistakes(p.mistakes, WEAK_REVIEW_POOL_SIZE);
    if (ranked.length === 0) return null;

    const card = el("div", { class: "card custom-lesson-card auto-lesson-card" });
    const row = el("div", { class: "row" });
    const titleWrap = el("div", { class: "row title-wrap" });
    titleWrap.appendChild(el("span", { class: "heading", text: "Weak Letters" }));
    titleWrap.appendChild(el("span", { class: "badge", text: "Auto" }));
    row.appendChild(titleWrap);
    card.appendChild(row);
    card.appendChild(
      el("p", { class: "small muted", text: "Updates itself from whichever letters you miss most often." })
    );

    const list = el("p", { class: "mono pool" });
    list.textContent = ranked.map(([ch, count]) => `${ch} (${count})`).join("   ");
    card.appendChild(list);

    const chars = ranked.map(([ch]) => ch);
    const startRow = el("div", { class: "button-row" });
    startRow.appendChild(button("Receive", () => this._weakPractice("receive", chars), "btn-panel"));
    startRow.appendChild(button("Send", () => this._weakPractice("send", chars), "btn-panel"));
    card.appendChild(startRow);

    return card;
  }

  _weakPractice(mode, chars) {
    const options = { lessonChars: chars, lessonLabel: "Weak point review" };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _customLessonRow(lesson) {
    const card = el("div", { class: "card custom-lesson-card" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { class: "heading", text: lesson.name }));
    row.appendChild(el("span", { class: "mono pool", text: lesson.chars.join(" ") }));
    card.appendChild(row);

    const startRow = el("div", { class: "button-row" });
    startRow.appendChild(button("Receive", () => this._practiceCustom("receive", lesson), "btn-panel"));
    startRow.appendChild(button("Send", () => this._practiceCustom("send", lesson), "btn-panel"));
    card.appendChild(startRow);

    const manageRow = el("div", { class: "button-row" });
    manageRow.appendChild(button("Edit", () => this._editCustomLesson(lesson), "btn-panel"));
    manageRow.appendChild(button("Delete", () => this._deleteCustomLesson(lesson), "btn-panel btn-danger"));
    card.appendChild(manageRow);

    return card;
  }

  _practiceCustom(mode, lesson) {
    const options = { lessonChars: lesson.chars, lessonLabel: lesson.name };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _newCustomLesson() {
    import("./customLessonEditor.js").then((m) => this.app.show(m.CustomLessonEditor));
  }

  _editCustomLesson(lesson) {
    import("./customLessonEditor.js").then((m) => this.app.show(m.CustomLessonEditor, { lessonId: lesson.id }));
  }

  async _deleteCustomLesson(lesson) {
    const ok = await confirmDialog(`Delete custom lesson '${lesson.name}'?`);
    if (!ok) return;
    const p = this.app.profile;
    p.custom_lessons = (p.custom_lessons || []).filter((l) => l.id !== lesson.id);
    this.app.saveProfile();
    this.root.innerHTML = "";
    this._build();
  }

  _lessonRow(n, p) {
    const chars = codes.lessonChars(n);
    const receiveUnlocked = n <= p.receive_level;
    const sendUnlocked = n <= p.send_level;

    const card = el("div", { class: "card lesson-card" });
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { class: "heading", text: `Lesson ${n}` }));
    row.appendChild(el("span", { class: "mono pool", text: chars.join(" ") }));
    card.appendChild(row);

    const startRow = el("div", { class: "button-row" });
    startRow.appendChild(
      this._practiceButton("Receive", receiveUnlocked, () => this._practice("receive", n, chars))
    );
    startRow.appendChild(
      this._practiceButton("Send", sendUnlocked, () => this._practice("send", n, chars))
    );
    card.appendChild(startRow);

    return card;
  }

  _practiceButton(label, unlocked, onClick) {
    const btn = button(unlocked ? label : `${label} 🔒`, onClick, "btn-panel");
    btn.disabled = !unlocked;
    return btn;
  }

  _practice(mode, lessonNumber, chars) {
    const options = { lessonChars: chars, lessonNumber };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _back() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
