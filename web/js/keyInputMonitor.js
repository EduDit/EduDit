// Input Monitor: a live diagnostic view of what MorseInput is actually
// detecting.
//
// Audio: a scrolling level trace + threshold line, built entirely from
// AudioKeyInput's own "level" events — no independent analysis of its own,
// so the monitor can never show a different interpretation of the signal
// than the actual detector uses (single source of truth).
//
// Keyboard/HID: a text event log built from "morsekeyraw" events. There is
// no real waveform for keyboard events — showing a fake one would be less
// accurate, not more, so this shows exactly what happened instead: which
// element, which edge, and whether contact-bounce filtering rejected it.
// Text-based, not color-only, per the accessibility requirement.

import { el } from "./dom.js";

const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 90;
const MAX_LOG_ROWS = 50;

export function mountInputMonitor(container, morseInput, { mode } = {}) {
  return mode === "audio" ? _mountWaveform(container, morseInput) : _mountEventLog(container, morseInput);
}

function _cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function _mountWaveform(container, morseInput) {
  const wrap = el("div", { class: "key-monitor" });
  const statusLbl = el("p", { class: "small muted", "aria-live": "polite", text: "Waiting for signal…" });
  wrap.appendChild(statusLbl);
  const canvas = el("canvas", {
    width: String(CANVAS_WIDTH),
    height: String(CANVAS_HEIGHT),
    class: "key-monitor-canvas",
  });
  wrap.appendChild(canvas);
  container.appendChild(wrap);

  const ctx2d = canvas.getContext("2d");
  const history = []; // { level, threshold, isOn }

  const onLevel = (e) => {
    history.push(e.detail);
    if (history.length > CANVAS_WIDTH) history.shift();
    statusLbl.textContent = e.detail.isOn ? "Key down" : "Key up";
    _draw(ctx2d, history);
  };
  morseInput.addEventListener("level", onLevel);

  return {
    destroy() {
      morseInput.removeEventListener("level", onLevel);
    },
  };
}

function _draw(ctx, history) {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = _cssVar("--panel-2", "#efeeec");
  ctx.fillRect(0, 0, w, h);
  if (!history.length) return;

  // RMS levels normally sit well under 0.5 for this hardware — scale that
  // range to the canvas height; anything louder just clamps to the top.
  const scale = h / 0.5;
  const toY = (level) => h - Math.min(h, level * scale);

  const last = history[history.length - 1];
  ctx.strokeStyle = _cssVar("--muted", "#6e6e73");
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  const thresholdY = toY(last.threshold);
  ctx.moveTo(0, thresholdY);
  ctx.lineTo(w, thresholdY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.lineWidth = 1.5;
  const onColor = _cssVar("--accent", "#007aff");
  const offColor = _cssVar("--fg", "#1d1d1f");
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const cur = history[i];
    ctx.strokeStyle = cur.isOn ? onColor : offColor;
    ctx.beginPath();
    ctx.moveTo(i - 1, toY(prev.level));
    ctx.lineTo(i, toY(cur.level));
    ctx.stroke();
  }
}

function _mountEventLog(container, morseInput) {
  const wrap = el("div", { class: "key-monitor" });
  const list = el("ul", { class: "key-monitor-log", "aria-live": "polite" });
  wrap.appendChild(list);
  container.appendChild(wrap);

  const onRaw = (e) => {
    const { edge, element, filtered } = e.detail;
    const row = el("li", {
      class: filtered ? "muted" : "",
      text: `${edge.toUpperCase()} ${element}${filtered ? " (filtered — bounce)" : ""}`,
    });
    list.prepend(row);
    while (list.children.length > MAX_LOG_ROWS) list.lastChild.remove();
  };
  morseInput.addEventListener("morsekeyraw", onRaw);

  return {
    destroy() {
      morseInput.removeEventListener("morsekeyraw", onRaw);
    },
  };
}
