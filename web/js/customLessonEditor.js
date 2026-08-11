// Create or edit a Custom Lesson: a name plus a hand-picked set of
// characters to drill, saved on the profile so it survives between
// sessions. Practicing one works exactly like the built-in Lessons —
// session-only scoring, no effect on level/streak.

import * as codes from "./codes.js";
import { el, button, QWERTY_ROWS } from "./dom.js";

const MIN_CHARS = 1;

export class CustomLessonEditor {
  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    const p = this.app.profile;
    this.lessonId = options.lessonId || null;
    this.existing = this.lessonId
      ? (p.custom_lessons || []).find((l) => l.id === this.lessonId) || null
      : null;
    this.selected = new Set(this.existing ? this.existing.chars : []);
    this.charButtons = {};
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Lessons", () => this.goBack()));
    top.appendChild(el("span", { class: "heading", text: this.existing ? "Edit Lesson" : "New Lesson" }));
    wrap.appendChild(top);

    wrap.appendChild(
      el("p", { class: "small muted", text: "Name it, then tap the letters and numbers to include." })
    );

    this.nameInput = el("input", {
      class: "text-input",
      type: "text",
      placeholder: "Lesson name",
      value: this.existing ? this.existing.name : "",
    });
    this.nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._save();
    });
    wrap.appendChild(el("div", { class: "entry-row" }, [this.nameInput]));

    wrap.appendChild(this._buildPicker());

    this.error = el("p", { class: "small error", "aria-live": "polite" });
    wrap.appendChild(this.error);

    const actionRow = el("div", { class: "button-row" });
    actionRow.appendChild(button("Save", () => this._save(), "btn-accent"));
    wrap.appendChild(actionRow);

    this.root.appendChild(wrap);
  }

  _buildPicker() {
    const picker = el("div", { class: "keyboard" });
    for (const row of QWERTY_ROWS) {
      const rowEl = el("div", { class: "keyboard-row" });
      for (const ch of row) {
        const key = button(ch, () => this._toggle(ch), "key mono");
        if (this.selected.has(ch)) key.classList.add("key-selected");
        this.charButtons[ch] = key;
        rowEl.appendChild(key);
      }
      picker.appendChild(rowEl);
    }
    return picker;
  }

  _toggle(ch) {
    if (this.selected.has(ch)) {
      this.selected.delete(ch);
      this.charButtons[ch].classList.remove("key-selected");
    } else {
      this.selected.add(ch);
      this.charButtons[ch].classList.add("key-selected");
    }
  }

  _save() {
    const name = this.nameInput.value.trim();
    if (!name) {
      this.error.textContent = "Please name this lesson.";
      return;
    }
    // Keep the saved order matching LEARNING_ORDER (easiest patterns first)
    // rather than picker click order, same as the built-in lessons.
    const chars = codes.LEARNING_ORDER.filter((ch) => this.selected.has(ch));
    if (chars.length < MIN_CHARS) {
      this.error.textContent = "Pick at least one character.";
      return;
    }

    const p = this.app.profile;
    p.custom_lessons = p.custom_lessons || [];
    if (this.existing) {
      this.existing.name = name;
      this.existing.chars = chars;
    } else {
      p.custom_lessons.push({ id: this._makeId(), name, chars });
    }
    this.app.saveProfile();
    this.goBack();
  }

  _makeId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  goBack() {
    import("./lessons.js").then((m) => this.app.show(m.Lessons));
  }

  destroy() {}
}
