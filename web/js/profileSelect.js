// Launch screen: pick an existing profile or create a new one.
//
// Profiles may optionally carry a light PIN — not real security, just a
// soft deterrent so one person's profile isn't casually poked at by
// another person using the same device.

import * as storage from "./storage.js";
import { el, button, emptyState } from "./dom.js";
import { streakDays } from "./dailyPractice.js";

export class ProfileSelect {
  // Pre-profile state — renders its own centered layout, not the app shell.
  static chromeless = true;

  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen view-focused center" });

    wrap.appendChild(el("div", { class: "title", text: "DitDash" }));
    wrap.appendChild(el("p", { class: "small muted", text: "Morse code trainer" }));
    wrap.appendChild(el("h2", { class: "heading", text: "Who's practicing?", style: { margin: "28px 0 4px" } }));

    const list = el("div", { class: "profile-list" });
    const profiles = storage.listProfiles();
    if (profiles.length) {
      for (const name of profiles) {
        list.appendChild(this._profileRow(name));
      }
    } else {
      list.appendChild(emptyState("No profiles yet — create one below."));
    }
    wrap.appendChild(list);

    this.pinPrompt = el("div", { class: "pin-prompt", style: { display: "none" } });
    wrap.appendChild(this.pinPrompt);

    wrap.appendChild(el("div", { class: "divider" }));

    wrap.appendChild(el("h2", { class: "heading", text: "New profile" }));
    const entryRow = el("div", { class: "entry-row" });
    const input = el("input", {
      class: "text-input",
      type: "text",
      placeholder: "Name",
      "aria-label": "New profile name",
    });
    const pinInput = el("input", {
      class: "text-input pin-field",
      type: "password",
      inputmode: "numeric",
      maxlength: "8",
      placeholder: "PIN (optional)",
      "aria-label": "New profile PIN, optional",
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._create();
    });
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this._create();
    });
    entryRow.appendChild(input);
    entryRow.appendChild(pinInput);
    entryRow.appendChild(button("Create", () => this._create(), "btn-accent"));
    wrap.appendChild(entryRow);

    this.error = el("p", { class: "small error", "aria-live": "polite" });
    wrap.appendChild(this.error);

    this.root.appendChild(wrap);
    this.input = input;
    this.pinInput = pinInput;
  }

  // Each row shows enough of the profile's own progress to recognize it at
  // a glance — level/streak, not just a bare name — so picking one feels
  // like "continue where I left off," not a technical login screen.
  _profileRow(name) {
    const profile = storage.loadProfile(name);
    const level = Math.max(profile.receive_level, profile.send_level);
    const streak = streakDays(profile.daily_practice);
    const hasProgress = level > 1 || streak > 0;
    const desc = hasProgress ? `Level ${level}${streak > 0 ? `   ·   ${streak}-day streak` : ""}` : "New profile";

    return el(
      "button",
      { class: "option-row", onclick: () => this._choose(name) },
      [
        el("span", {}, [
          el("span", { class: "option-row-title", text: profile.pin ? `${name}  🔒` : name }),
          el("span", { class: "option-row-desc", text: desc }),
        ]),
        el("span", { class: "option-row-arrow", "aria-hidden": "true", text: "›" }),
      ]
    );
  }

  _choose(name) {
    const profile = storage.loadProfile(name);
    if (profile.pin) {
      this._showPinPrompt(name, profile);
    } else {
      this._enter(name);
    }
  }

  _showPinPrompt(name, profile) {
    this.pinPrompt.innerHTML = "";
    this.pinPrompt.style.display = "flex";

    this.pinPrompt.appendChild(el("span", { class: "small", text: `PIN for ${name}` }));
    const input = el("input", {
      class: "text-input pin-field",
      type: "password",
      inputmode: "numeric",
      maxlength: "8",
    });
    const errorLbl = el("span", { class: "small error", "aria-live": "polite" });

    const submit = () => {
      if (storage.verifyPin(profile, input.value)) {
        this.pinPrompt.style.display = "none";
        this._enter(name);
      } else {
        errorLbl.textContent = "Wrong PIN.";
        input.value = "";
        input.focus();
      }
    };
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });

    this.pinPrompt.appendChild(input);
    this.pinPrompt.appendChild(button("Unlock", submit, "btn-accent"));
    this.pinPrompt.appendChild(errorLbl);
    input.focus();
  }

  _enter(name) {
    // Goes through app.loadProfile() rather than assigning profileName/profile
    // directly, so it also syncs the "Keep headphones awake" keep-alive tone
    // — otherwise a profile with that setting on would enter silent every
    // time until the toggle was flipped again in Settings.
    this.app.loadProfile(name);
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  _create() {
    const name = this.input.value.trim();
    if (!name) {
      this.error.textContent = "Please enter a name.";
      return;
    }
    if (storage.listProfiles().includes(name)) {
      this.error.textContent = "That profile already exists.";
      return;
    }
    storage.createProfile(name, this.pinInput.value);
    // New profiles only — existing profiles always skip straight to
    // MainMenu via _enter()/_choose() below, regardless of their
    // `onboarded` value, since profiles saved before this feature existed
    // have no `onboarded` field and would otherwise default to false.
    this.app.loadProfile(name);
    import("./onboarding.js").then((m) => this.app.show(m.Onboarding));
  }

  destroy() {}
}
