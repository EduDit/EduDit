// Themed confirm/alert modal — replaces window.confirm/alert, which render
// as an unstyled native dialog that clashes with the rest of the app. Returns
// a Promise so call sites can just `await` it like the built-ins would block.

import { el, button } from "./dom.js";

function open(message, buttons) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      resolve(value);
    };

    const onKey = (e) => {
      if (e.key === "Escape") finish(false);
      else if (e.key === "Enter") finish(buttons[buttons.length - 1].value);
    };

    const row = el("div", { class: "button-row" });
    let lastBtn = null;
    for (const b of buttons) {
      lastBtn = button(b.label, () => finish(b.value), b.cls || "btn-panel");
      row.appendChild(lastBtn);
    }

    const box = el("div", { class: "dialog-box" }, [
      el("p", { class: "dialog-message", text: message }),
      row,
    ]);
    const overlay = el("div", { class: "dialog-overlay" }, [box]);

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    lastBtn.focus();
  });
}

export function confirmDialog(message) {
  return open(message, [
    { label: "Cancel", value: false, cls: "btn-panel" },
    { label: "OK", value: true, cls: "btn-accent" },
  ]);
}

export function alertDialog(message) {
  return open(message, [{ label: "OK", value: true, cls: "btn-accent" }]);
}
