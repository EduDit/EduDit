// First-run intro for a brand-new profile: a few short, skippable screens
// explaining how EduDit works, plus one familiarity question used only to
// tune copy/emphasis later (never the learning order or adaptive weighting).
// Shown once — profile.onboarded gates it in profileSelect.js.

import { el, button } from "./dom.js";

const STEPS = 3;

export class Onboarding {
  // Pre-profile-home state — renders its own centered layout, not the app shell.
  static chromeless = true;

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this.step = 0;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen view-focused center" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(el("span", { class: "heading", text: "Welcome to EduDit" }));
    top.appendChild(button("Skip", () => this._finish(), "btn-panel"));
    wrap.appendChild(top);

    if (this.step === 0) wrap.appendChild(this._introStep());
    else if (this.step === 1) wrap.appendChild(this._experienceStep());
    else wrap.appendChild(this._readyStep());

    this.root.appendChild(wrap);
  }

  _introStep() {
    const card = el("div", { class: "card" });
    card.appendChild(el("p", { class: "heading", text: "How EduDit works" }));
    const list = el("div", { class: "onboarding-points" });
    for (const text of [
      "You'll learn Morse a few characters at a time.",
      "EduDit automatically gives you more practice on characters you struggle with.",
      "You can practice Receiving Morse (listening) or Sending Morse (keying it yourself).",
      "Your progress is saved automatically.",
    ]) {
      list.appendChild(el("p", { class: "small", text: `•  ${text}` }));
    }
    card.appendChild(list);
    card.appendChild(button("Next  ▶", () => this._go(1), "btn-accent btn-block"));
    return card;
  }

  _experienceStep() {
    const card = el("div", { class: "card" });
    card.appendChild(el("p", { class: "heading", text: "One quick question" }));
    card.appendChild(el("p", { class: "small muted", text: "Are you:" }));

    for (const [value, label] of [
      ["new", "Brand new to Morse"],
      ["some", "I know some characters already"],
      ["experienced", "I already know Morse"],
    ]) {
      card.appendChild(
        button(label, () => this._chooseExperience(value), "btn-panel btn-block")
      );
    }
    return card;
  }

  _readyStep() {
    const card = el("div", { class: "card" });
    card.appendChild(el("p", { class: "heading", text: "Ready to start?" }));
    card.appendChild(
      el("p", {
        class: "small muted",
        text: "EduDit will recommend what to practice each time you open it — just follow along.",
      })
    );
    card.appendChild(button("Start Learning  ▶", () => this._finish(), "btn-accent btn-block"));
    return card;
  }

  _chooseExperience(value) {
    this.app.profile.settings.priorExperience = value;
    this.app.saveProfile();
    this._go(2);
  }

  _go(step) {
    this.step = Math.min(step, STEPS - 1);
    this.root.innerHTML = "";
    this._build();
  }

  _finish() {
    this.app.profile.onboarded = true;
    this.app.saveProfile();
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  goBack() {
    if (this.step > 0) this._go(this.step - 1);
    else this._finish();
  }

  destroy() {}
}
