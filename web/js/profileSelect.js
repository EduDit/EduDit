// Launch screen: pick an existing profile or create a new one.
//
// Profiles may optionally carry a light PIN — not real security, just a
// soft deterrent so one person's profile isn't casually poked at by
// another person using the same device.

import * as storage from "./storage.js";
import { el, button } from "./dom.js";

export class ProfileSelect {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen center" });

    wrap.appendChild(el("div", { class: "title", text: "DitDash" }));
    wrap.appendChild(el("p", { class: "small muted", text: "Morse code trainer" }));
    wrap.appendChild(el("h2", { class: "heading", text: "Choose a profile" }));

    const list = el("div", { class: "profile-list" });
    const profiles = storage.listProfiles();
    if (profiles.length) {
      for (const name of profiles) {
        const locked = !!storage.loadProfile(name).pin;
        const label = locked ? `${name}  🔒` : name;
        list.appendChild(button(label, () => this._choose(name), "btn-block btn-left"));
      }
    } else {
      list.appendChild(el("p", { class: "small muted", text: "No profiles yet — create one below." }));
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
