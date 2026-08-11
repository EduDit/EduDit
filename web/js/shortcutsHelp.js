// Keyboard shortcuts overlay — reuses dialog.js's .dialog-overlay/.dialog-box
// classes (which the app-wide Esc handler already treats as "something's
// open, don't also navigate back"). Lists only bindings that actually exist
// right now, including the learner's own custom dot/dash keys if set.

import { el, button, keyLabel } from "./dom.js";

export function showShortcutsHelp(app) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve();
    };
    const onKey = (e) => {
      if (e.key === "Escape" || e.key === "?") {
        e.stopPropagation();
        finish();
      }
    };

    const s = (app.profile && app.profile.settings) || {};
    // R is only really Replay when it isn't already claimed as a custom
    // dot/dash key — sendPractice.js checks dotKey/dashKey first, so a
    // custom binding on KeyR always wins over the Replay fallback there.
    const rIsCustomBound = s.dotKey === "KeyR" || s.dashKey === "KeyR";
    const rows = [
      ["Esc", "Go back"],
      ["?", "Show this help"],
      ["A–Z, 0–9", "Answer the current character (Receive Practice)"],
      ["Space (tap)", "Replay the tone (Receive Practice)"],
      ["Space (hold)", "Send Morse — short = dot, long = dash (Send Practice)"],
    ];
    if (!rIsCustomBound) rows.push(["R", "Replay the tone (Send Practice)"]);
    if (s.dotKey) rows.push([keyLabel(s.dotKey), "Send a dot instantly (Send Practice)"]);
    if (s.dashKey) rows.push([keyLabel(s.dashKey), "Send a dash instantly (Send Practice)"]);

    const list = el("div", { class: "shortcut-list" });
    for (const [key, desc] of rows) {
      const row = el("div", { class: "shortcut-row" });
      row.appendChild(el("span", { class: "mono shortcut-key", text: key }));
      row.appendChild(el("span", { class: "small muted", text: desc }));
      list.appendChild(row);
    }

    const closeBtn = button("Close", finish, "btn-accent btn-block");
    const box = el("div", { class: "dialog-box" }, [
      el("p", { class: "heading", text: "Keyboard Shortcuts", style: { margin: "0 0 10px" } }),
      list,
      closeBtn,
    ]);
    const overlay = el("div", { class: "dialog-overlay" }, [box]);

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    closeBtn.focus();
  });
}
