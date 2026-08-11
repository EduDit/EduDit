// Practice: one destination, four ways to train — switched with a tab bar
// instead of feeling like four separate screens. Each tab mounts the
// existing screen class completely unchanged (same
// constructor(root, app, options) / destroy() contract app.show() itself
// uses), just nested inside this hub's own container instead of taking
// over the whole shell content area directly.
//
// Deep links bypass this hub entirely and keep calling
// app.show(ReceivePractice/SendPractice, options) directly — Journey's
// "Practice this letter", Lessons' per-lesson/weak-letter practice, Session
// Summary's "Continue Training", and Home's hero CTA all still work exactly
// as before. Only the persistent nav's "Practice" destination and Home's
// "choose what to practice" links route through here.

import { el, pageHeader, tabBar } from "./dom.js";

const TABS = [
  {
    id: "receive",
    label: "Receive",
    description: "Hear Morse and identify the character.",
    loader: () => import("./receivePractice.js").then((m) => m.ReceivePractice),
  },
  {
    id: "send",
    label: "Send",
    description: "See a character and key it.",
    loader: () => import("./sendPractice.js").then((m) => m.SendPractice),
  },
  {
    id: "listen",
    label: "Listen",
    description: "Build your ear without answering.",
    loader: () => import("./listenPractice.js").then((m) => m.ListenPractice),
  },
  {
    id: "callsigns",
    label: "Callsigns",
    description: "Practice realistic radio exchanges.",
    loader: () => import("./callsignPractice.js").then((m) => m.CallsignPractice),
  },
];

export class PracticeHub {
  static navId = "practice";

  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    this.tab = TABS.some((t) => t.id === options.tab) ? options.tab : "receive";
    this.child = null;
    this._loadToken = 0;
    this._build();
    this._mountChild();
  }

  _build() {
    const wrap = el("div", { class: "screen view-focused" });
    wrap.appendChild(pageHeader({ title: "Practice" }));
    wrap.appendChild(
      el("p", { class: "small muted", text: "Choose how you want to get better at Morse." })
    );
    wrap.appendChild(
      tabBar(
        TABS.map((t) => ({ id: t.id, label: t.label })),
        this.tab,
        (id) => this._switchTab(id)
      )
    );
    wrap.appendChild(el("p", { class: "small muted", text: this._activeTab().description, style: { margin: "4px 0 0" } }));

    this.childMount = el("div", {});
    wrap.appendChild(this.childMount);

    this.root.innerHTML = "";
    this.root.appendChild(wrap);
  }

  _activeTab() {
    return TABS.find((t) => t.id === this.tab);
  }

  _mountChild() {
    const tab = this._activeTab();
    const token = ++this._loadToken;
    tab.loader().then((ViewClass) => {
      // A fast tab switch can resolve out of order — only mount if nothing
      // newer has been requested since.
      if (token !== this._loadToken) return;
      this.child = new ViewClass(this.childMount, this.app, { embedded: true });
    });
  }

  _switchTab(id) {
    if (id === this.tab) return;
    if (this.child && typeof this.child.destroy === "function") this.child.destroy();
    this.child = null;
    this.tab = id;
    this._build();
    this._mountChild();
  }

  // Delegates to the active child's goBack() (Receive/Send's "3+ rounds ->
  // Session Summary" logic keeps working unchanged this way); falls back to
  // Home if the child has none or hasn't finished loading yet.
  goBack() {
    if (this.child && typeof this.child.goBack === "function") {
      this.child.goBack();
      return;
    }
    import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
  }

  destroy() {
    this._loadToken++;
    if (this.child && typeof this.child.destroy === "function") this.child.destroy();
  }
}

export { TABS as PRACTICE_TABS };
