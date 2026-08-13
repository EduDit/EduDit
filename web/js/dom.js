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
// people recognize, e.g. "1" or "Q" — or a "MouseN" binding (see
// morseInput/deviceEventKeyInput.js) into a mouse-button name.
const MOUSE_BUTTON_NAMES = ["Left Click", "Middle Click", "Right Click", "Back Button", "Forward Button"];
export function keyLabel(code) {
  if (!code) return "";
  if (code.startsWith("Mouse")) {
    const n = Number(code.slice(5));
    return MOUSE_BUTTON_NAMES[n] || `Mouse Button ${n}`;
  }
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

// A segmented tab bar — builds on the .tabs/.tab-btn CSS already used by
// Settings' theme picker and Scoreboard's Receive/Send switch. `items` is
// `[{ id, label }]`; `onChange(id)` fires on selection. Callers own
// re-rendering (same pattern as the rest of the app — no internal state).
export function tabBar(items, activeId, onChange) {
  const wrap = el("div", { class: "tabs", role: "tablist" });
  for (const item of items) {
    const active = item.id === activeId;
    wrap.appendChild(
      el("button", {
        class: `tab-btn${active ? " tab-btn-active" : ""}`,
        text: item.label,
        role: "tab",
        "aria-selected": String(active),
        onclick: () => onChange(item.id),
      })
    );
  }
  attachArrowNav(wrap);
  return wrap;
}

// An optional small "Practice / Receive"-style eyebrow + title row — used
// where a breadcrumb genuinely helps orientation. Not a mandatory template;
// several screens (Home, focused Practice sub-screens) compose their own
// header instead because a breadcrumb wouldn't add anything there.
export function pageHeader({ eyebrow, title, actions } = {}) {
  const wrap = el("div", { class: "page-header row" });
  const textWrap = el("div", { style: { minWidth: "0" } });
  if (eyebrow) textWrap.appendChild(el("p", { class: "eyebrow", text: eyebrow }));
  textWrap.appendChild(el("h1", { class: "title", text: title }));
  wrap.appendChild(textWrap);
  if (actions && actions.length) {
    const actionsWrap = el("div", { class: "page-header-actions" });
    for (const a of actions) actionsWrap.appendChild(a);
    wrap.appendChild(actionsWrap);
  }
  return wrap;
}

// Roving arrow-key navigation for a dense group of buttons (a character
// grid, an on-screen keyboard, a tab pair) — Left/Right move focus to the
// previous/next enabled match in DOM order, Up/Down move by `columns` (if
// given) or behave like Left/Right otherwise, wrapping at the ends. Purely
// additive: only acts (and only calls preventDefault()) when the focused
// element inside `container` actually matches `selector` and focus actually
// moves, so it never interferes with normal Tab order, the app-wide Esc
// handler, or typing in a text field.
export function attachArrowNav(container, { selector = "button:not(:disabled)", columns } = {}) {
  container.addEventListener("keydown", (e) => {
    const ARROW_STEPS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -(columns || 1), ArrowDown: columns || 1 };
    const step = ARROW_STEPS[e.key];
    if (!step) return;

    const items = Array.from(container.querySelectorAll(selector));
    const current = document.activeElement;
    const index = items.indexOf(current);
    if (index === -1) return;

    const next = items[(index + step + items.length) % items.length];
    if (!next || next === current) return;

    e.preventDefault();
    next.focus();
  });
}
