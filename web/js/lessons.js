// Lessons: "what should I work on?" leads the page as one hero (not a tab —
// Recommended and Weak Letters are the same underlying question, so they're
// folded together using the same recommendation engine Home and Session
// Summary already use), then Unlocked/Custom as the two genuinely distinct
// browsing actions a learner would go looking for separately. Practice here
// is scored only for the current session — it never touches level/streak.

import * as codes from "./codes.js";
import { el, button, tabBar, pageHeader, emptyState } from "./dom.js";
import { tierLetters } from "./weakLetters.js";
import { getRecommendation, startRecommendedTraining } from "./recommendation.js";
import { confirmDialog } from "./dialog.js";

const TABS = [
  { id: "unlocked", label: "Unlocked" },
  { id: "custom", label: "Custom" },
];

export class Lessons {
  static navId = "lessons";

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.tab = "unlocked";
    this._build();
  }

  _build() {
    const p = this.app.profile;
    const wrap = el("div", { class: "screen view-standard" });

    wrap.appendChild(
      pageHeader({
        title: "Lessons",
        actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
      })
    );
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Practice specific characters without affecting your level.",
      })
    );

    wrap.appendChild(this._focusHero(p));

    wrap.appendChild(el("div", { class: "divider" }));
    wrap.appendChild(tabBar(TABS, this.tab, (id) => this._setTab(id)));
    wrap.appendChild(this.tab === "unlocked" ? this._unlockedPanel(p) : this._customPanel(p));

    this.root.appendChild(wrap);
  }

  // "What should I work on?" — the same recommendation engine Home and
  // Session Summary use, so all three can never disagree. Weak letters are
  // already folded into rec.subtitle when any exist (see recommendation.js)
  // rather than presented as a separate destination.
  _focusHero(p) {
    const rec = getRecommendation(p);
    const card = el("div", { class: "card hero-card" });
    card.appendChild(el("span", { class: "badge", text: "Focus On This Next" }));
    card.appendChild(el("p", { class: "heading", text: rec.title, style: { margin: "8px 0 2px" } }));
    card.appendChild(el("p", { class: "small muted", text: rec.subtitle }));
    card.appendChild(
      button("Start Practice  ▶", () => startRecommendedTraining(this.app, rec, { returnTo: "lessons" }), "btn-accent btn-block")
    );

    const tiers = tierLetters(p);
    const toReview = [...tiers.needsWork, ...tiers.gettingBetter];
    if (toReview.length > 0 && rec.reason !== "weak") {
      // The recommendation alternates Receive/Send and may be about level
      // progress rather than weak letters right now — still surface a
      // direct shortcut to drill them if any exist.
      card.appendChild(
        button(
          "Practice Weak Letters  ▶",
          () => this._weakPractice("receive", toReview.map((r) => r.ch)),
          "btn-panel btn-block"
        )
      );
    }
    return card;
  }

  _weakPractice(mode, chars) {
    const options = { lessonChars: chars, lessonLabel: "Weak Letters", returnTo: "lessons" };
    if (mode === "receive") {
      import("./receivePractice.js").then((m) => this.app.show(m.ReceivePractice, options));
    } else {
      import("./sendPractice.js").then((m) => this.app.show(m.SendPractice, options));
    }
  }

  _setTab(id) {
    if (id === this.tab) return;
    this.tab = id;
    this.root.innerHTML = "";
    this._build();
  }

  _unlockedPanel(p) {
    const wrap = el("div", {});
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Review any lesson you've already reached — this won't affect your level.",
      })
    );
    const highestUnlocked = Math.max(p.receive_level, p.send_level);
    for (let n = 1; n <= highestUnlocked; n++) {
      wrap.appendChild(this._lessonRow(n, p));
    }
    return wrap;
  }

  _customPanel(p) {
    const wrap = el("div", {});
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text: "Pick your own set of letters to drill — good for one stubborn character or a random mix.",
      })
    );
    const customLessons = p.custom_lessons || [];
    if (customLessons.length === 0) {
      wrap.appendChild(emptyState("No custom lessons yet."));
    } else {
      for (const lesson of customLessons) {
        wrap.appendChild(this._customLessonRow(lesson));
      }
    }
    wrap.appendChild(button("+ New custom lesson", () => this._newCustomLesson(), "btn-panel btn-block"));
    return wrap;
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
