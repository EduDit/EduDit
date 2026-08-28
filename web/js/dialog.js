// Themed confirm/alert modal — replaces window.confirm/alert, which render
// as an unstyled native dialog that clashes with the rest of the app. Returns
// a Promise so call sites can just `await` it like the built-ins would block.

import { el, button } from "./dom.js";

function open(message, buttons) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) previousFocus.focus();
      resolve(value);
    };

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        finish(false);
      } else if (e.key === "Enter") {
        finish(buttons[buttons.length - 1].value);
      } else if (e.key === "Tab") {
        const focusable = Array.from(box.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])"));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    const row = el("div", { class: "button-row" });
    let lastBtn = null;
    for (const b of buttons) {
      lastBtn = button(b.label, () => finish(b.value), b.cls || "btn-panel");
      row.appendChild(lastBtn);
    }

    const messageId = `dialog-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const box = el("div", { class: "dialog-box", role: "dialog", "aria-modal": "true", "aria-labelledby": messageId }, [
      el("p", { id: messageId, class: "dialog-message", text: message }),
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

// Themed text-input prompt — same overlay/Escape-to-cancel/Enter-to-confirm
// shape as confirmDialog/alertDialog above, plus a single text field.
// Resolves the trimmed input, or null if cancelled/left blank.
export function promptDialog(message, { placeholder = "", defaultValue = "" } = {}) {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      document.removeEventListener("keydown", onKey);
      overlay.remove();
      if (previousFocus && typeof previousFocus.focus === "function" && previousFocus.isConnected) previousFocus.focus();
      resolve(value);
    };

    const input = el("input", { class: "text-input", type: "text", placeholder, value: defaultValue });

    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        finish(null);
      } else if (e.key === "Enter") {
        e.preventDefault();
        finish(input.value.trim() || null);
      } else if (e.key === "Tab") {
        const focusable = Array.from(box.querySelectorAll("button, input"));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    const row = el("div", { class: "button-row" });
    row.appendChild(button("Cancel", () => finish(null), "btn-panel"));
    row.appendChild(button("OK", () => finish(input.value.trim() || null), "btn-accent"));

    const messageId = `dialog-message-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const box = el("div", { class: "dialog-box", role: "dialog", "aria-modal": "true", "aria-labelledby": messageId }, [el("p", { id: messageId, class: "dialog-message", text: message }), input, row]);
    const overlay = el("div", { class: "dialog-overlay" }, [box]);

    document.addEventListener("keydown", onKey);
    document.body.appendChild(overlay);
    input.focus();
  });
}
