// Persistent app chrome: a slim top nav (desktop/tablet) that collapses to a
// bottom tab bar (mobile), wrapped around a content mount (#view). Built
// once per profile session by App.show() and reused across every
// shell-view screen change — see app.js.
//
// Five primary destinations, same set/order in both the top nav and the
// bottom tab bar (decided against a left nav rail in the redesign plan,
// specifically to keep desktop and mobile navigation feeling like the same
// product). Profile + Settings are secondary — smaller, right-aligned icons
// rather than additional primary items.

import { el } from "./dom.js";

export const NAV_ITEMS = [
  { id: "home", label: "Home", icon: "🏠", loader: () => import("./mainMenu.js").then((m) => m.MainMenu) },
  { id: "practice", label: "Practice", icon: "🎯", loader: () => import("./practiceHub.js").then((m) => m.PracticeHub) },
  { id: "journey", label: "Journey", icon: "🧭", loader: () => import("./journey.js").then((m) => m.Journey) },
  { id: "lessons", label: "Lessons", icon: "📘", loader: () => import("./lessons.js").then((m) => m.Lessons) },
  { id: "progress", label: "Progress", icon: "📈", loader: () => import("./scoreboard.js").then((m) => m.Scoreboard) },
];

export class AppShell {
  constructor(root, app) {
    this.app = app;
    this._navButtons = [];
    this._bottomNavButtons = [];

    this.el = el("div", { class: "app-shell" });
    this.el.appendChild(this._buildNav());
    this.bannerSlot = el("div", {});
    this.el.appendChild(this.bannerSlot);
    this.contentEl = el("main", { id: "view" });
    this.el.appendChild(this.contentEl);
    this.bottomNav = this._buildBottomNav();
    this.el.appendChild(this.bottomNav);

    root.appendChild(this.el);
  }

  _buildNav() {
    const nav = el("div", { class: "app-nav" });
    nav.appendChild(
      el("button", { class: "app-nav-brand", text: "DitDash", onclick: () => this.navigate("home") })
    );

    const primary = el("div", { class: "app-nav-primary" });
    for (const item of NAV_ITEMS) {
      const btn = el("button", {
        class: "app-nav-link",
        text: item.label,
        onclick: () => this.navigate(item.id),
      });
      this._navButtons.push({ id: item.id, el: btn });
      primary.appendChild(btn);
    }
    nav.appendChild(primary);

    const secondary = el("div", { class: "app-nav-secondary" });
    secondary.appendChild(
      el("button", {
        class: "app-nav-profile",
        text: this.app.profileName || "",
        title: "Switch profile",
        onclick: () => this._switchProfile(),
      })
    );
    secondary.appendChild(
      el("button", {
        class: "app-nav-icon-btn",
        text: "⚙",
        "aria-label": "Settings",
        title: "Settings",
        onclick: () => import("./settings.js").then((m) => this.app.show(m.Settings)),
      })
    );
    nav.appendChild(secondary);

    return nav;
  }

  _buildBottomNav() {
    const nav = el("div", { class: "bottom-nav" });
    for (const item of NAV_ITEMS) {
      const btn = el(
        "button",
        { class: "bottom-nav-link", onclick: () => this.navigate(item.id) },
        [
          el("span", { class: "bottom-nav-link-icon", "aria-hidden": "true", text: item.icon }),
          el("span", { text: item.label }),
        ]
      );
      this._bottomNavButtons.push({ id: item.id, el: btn });
      nav.appendChild(btn);
    }
    return nav;
  }

  navigate(id) {
    const item = NAV_ITEMS.find((n) => n.id === id);
    if (!item) return;
    item.loader().then((ViewClass) => this.app.show(ViewClass));
  }

  // Highlights whichever primary destination the current screen belongs to
  // (screens opt in via a static `navId`, e.g. `MainMenu.navId = "home"`).
  // Screens with no navId (Settings, dialogs-as-screens, etc.) simply leave
  // every item unhighlighted — that's correct, not a bug, for secondary
  // screens that aren't one of the five primary destinations.
  setActive(navId) {
    for (const { id, el: navEl } of this._navButtons) {
      navEl.classList.toggle("app-nav-link-active", id === navId);
    }
    for (const { id, el: navEl } of this._bottomNavButtons) {
      navEl.classList.toggle("bottom-nav-link-active", id === navId);
    }
  }

  // Keeps the profile pill in sync after a rename/switch without rebuilding
  // the whole shell.
  refreshProfile() {
    const pill = this.el.querySelector(".app-nav-profile");
    if (pill) pill.textContent = this.app.profileName || "";
  }

  _switchProfile() {
    this.app.profileName = null;
    this.app.profile = null;
    import("./profileSelect.js").then((m) => this.app.show(m.ProfileSelect));
  }

  destroy() {
    this.el.remove();
  }
}
