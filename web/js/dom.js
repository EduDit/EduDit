// Tiny DOM-building helpers shared by every screen module.

// Fixed QWERTY layout so on-screen character grids never move between
// renders — Receive Practice's keyboard and the custom lesson character
// picker both use it, so key positions stay consistent across the app.
export const QWERTY_ROWS = [
  "1234567890".split(""),
  "QWERTYUIOP".split(""),
  "ASDFGHJKL".split(""),
  "ZXCVBNM".split(""),
];

// The digit row (row 0) doesn't unlock until deep into the learning order —
// showing 10 dead keys the whole time forces every other row to shrink to
// match on narrow screens for no benefit. Callers that build a keyboard
// gated by an unlocked pool can check this before rendering that row.
export function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

export function el(tag, opts = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(opts)) {
    if (value === undefined || value === null) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else {
      node.setAttribute(key, value);
    }
  }
  for (const child of children) {
    if (child === null || child === undefined) continue;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function button(text, onClick, extraClass = "") {
  return el("button", { class: `btn ${extraClass}`.trim(), text, onclick: onClick });
}

// Turns a KeyboardEvent.code like "Digit1" or "KeyQ" into a short label
// people recognize, e.g. "1" or "Q".
export function keyLabel(code) {
  if (!code) return "";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code === "Space") return "Space";
  return code;
}

// Non-blocking, auto-dismissing notice — for occasional adaptive-learning
// asides and achievement unlocks. Distinct from dialog.js's blocking modal:
// never steals focus, never requires a response. Multiple toasts stack.
let _toastWrap = null;
export function showToast(text, { duration = 4500 } = {}) {
  if (!_toastWrap) {
    _toastWrap = el("div", { class: "toast-wrap" });
    document.body.appendChild(_toastWrap);
  }
  const toast = el("div", { class: "toast", role: "status", "aria-live": "polite", text });
  _toastWrap.appendChild(toast);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    toast.classList.add("toast-out");
    setTimeout(() => toast.remove(), 200);
  };
  setTimeout(remove, duration);
  return remove;
}

// Renders a dot/dash pattern (e.g. ".-") as a row of round/oblong glyphs
// instead of punctuation, so it reads as Morse at a glance. Pass kind "good"
// to render it in the "this is the answer" color instead of the default.
export function morseGlyphs(pattern, kind = "") {
  const wrap = el("span", { class: "morse-viz" });
  for (const ch of pattern) {
    const base = ch === "." ? "glyph-dot" : "glyph-dash";
    wrap.appendChild(el("span", { class: kind ? `${base} ${kind}` : base }));
  }
  return wrap;
}
