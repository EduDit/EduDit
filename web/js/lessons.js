// Lessons: three ways to drill specific characters without touching level
// or streak progress — practice here is scored only for the current
// session.
//
// - Weak Letters: a tiered, auto-updating view (Needs Work / Getting
//   Better / Strong) built from tierLetters() in weakLetters.js — nothing
//   to edit or delete, it just recomputes on every visit.
// - Custom Lessons: hand-picked sets of characters the learner saved.
// - Unlocked Lessons: every batch of letters introduced so far — lets a
//   learner jump back into any of them for review.

import * as codes from "./codes.js";
import { el, button } from "./dom.js";
import { tierLetters } from "./weakLetters.js";
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
    top.appendChild(button("< Menu", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: "Lessons" }));
    wrap.appendChild(top);

    wrap.appendChild(el("p", { class: "small muted", text: "Practice specific characters." }));
    wrap.appendChild(button("View Morse Journey  ▶", () => this._journey(), "btn-panel btn-block"));
    wrap.appendChild(
      button("Callsign & QSO Practice  ▶", () => this._callsigns(), "btn-panel btn-block")
    );

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(this._weakLettersSection(p));

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(el("p", { class: "heading", text: "Custom Lessons" }));
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Pick your own set of letters to drill — good for one stubborn character or a random mix.",
      })
    );
    const customLessons = p.custom_lessons || [];
    if (customLessons.length === 0) {
      wrap.appendChild(el("p", { class: "small muted", text: "No custom lessons yet." }));
    } else {
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

  // Auto-updating, tiered ranking — recomputed from tierLetters() on every
  // visit rather than saved, so it can't drift out of date and there's
  // nothing to edit or delete.
  _weakLettersSection(p) {
    const wrap = el("div", {});
    wrap.appendChild(el("p", { class: "heading", text: "Weak Letters" }));

    const tiers = tierLetters(p);
    const toReview = [...tiers.needsWork, ...tiers.gettingBetter];

    if (toReview.length === 0) {
      const hasAnyData = tiers.strong.length > 0;
      wrap.appendChild(
        el("p", {
          class: "small muted",
          text: hasAnyData
            ? "Nothing needs work right now — nice and steady. Ready for more characters?"
            : "Keep practicing and your weak letters will show up here.",
        })
      );
      return wrap;
    }

    wrap.appendChild(
      el("p", { class: "small muted", text: "Ranked worst to best — spend a few minutes on the top group." })
    );
    if (tiers.needsWork.length) wrap.appendChild(this._tierGroup("Needs Work", tiers.needsWork, "bad"));
    if (tiers.gettingBetter.length) wrap.appendChild(this._tierGroup("Getting Better", tiers.gettingBetter, ""));
    if (tiers.strong.length) wrap.appendChild(this._tierGroup("Strong", tiers.strong, "good"));

    const chars = toReview.map((r) => r.ch);
    wrap.appendChild(
      button("Practice Weak Letters  ▶", () => this._weakPractice("receive", chars), "btn-accent btn-block")
    );

    return wrap;
  }

  _tierGroup(label, rows, kind) {
    const group = el("div", { class: "card" });
    group.appendChild(el("span", { class: "small muted", text: label.toUpperCase() }));
    const list = el("div", { class: "accuracy-list" });
    for (const r of rows) {
      const item = el("div", { class: "accuracy-row" });
      item.appendChild(el("span", { class: "mono accuracy-char", text: r.ch }));
      const bar = el("div", { class: "accuracy-bar" });
      bar.appendChild(el("div", { class: `accuracy-bar-fill ${kind}`.trim(), style: { width: `${r.pct}%` } }));
      item.appendChild(bar);
      item.appendChild(el("span", { class: `mono accuracy-pct ${kind}`.trim(), text: `${r.pct}%` }));
      item.appendChild(el("span", { class: "small muted accuracy-count", text: `${r.attempts - r.misses}/${r.attempts}` }));
      list.appendChild(item);
    }
    group.appendChild(list);
    return group;
  }

  _weakPractice(mode, chars) {
    const options = { lessonChars: chars, lessonLabel: "Weak Letters", returnTo: "lessons" };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _journey() {
    import("./journey.js").then((m) => this.app.show(m.Journey));
  }

  _callsigns() {
    import("./callsignPractice.js").then((m) => this.app.show(m.CallsignPractice, { returnTo: "lessons" }));
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
    const options = { lessonChars: lesson.chars, lessonLabel: lesson.name, returnTo: "lessons" };
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
    const options = { lessonChars: chars, lessonNumber, returnTo: "lessons" };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  goBack() {
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {}
}
