// A character's first-exposure teaching moment: pattern, glyphs, a rhythm
// phrasing, and optional actions. Shared by Receive/Send Practice (a
// character's very first appearance) and Session Summary (newly unlocked
// characters after a level-up) so the same "meaningful reveal" looks and
// behaves identically in both places instead of being duplicated.

import * as codes from "./codes.js";
import { el, button, morseGlyphs } from "./dom.js";

export function newCharacterCard(ch, { onPlay, onPractice, practiceLabel } = {}) {
  const card = el("div", { class: "card pop-in" });
  card.appendChild(el("span", { class: "badge", text: "New Character" }));
  card.appendChild(el("div", { class: "big-char", text: ch, style: { margin: "6px 0" } }));
  const glyphRow = el("div", { class: "hint-viz" });
  glyphRow.appendChild(morseGlyphs(codes.MORSE[ch], "good"));
  card.appendChild(glyphRow);
  card.appendChild(
    el("p", { class: "small muted center", text: codes.rhythmPhrase(codes.MORSE[ch]) })
  );

  if (onPlay || onPractice) {
    const row = el("div", { class: "button-row" });
    if (onPlay) row.appendChild(button("Hear it  ▶", onPlay, "btn-panel"));
    if (onPractice) row.appendChild(button(practiceLabel || `Practice ${ch}`, onPractice, "btn-accent"));
    card.appendChild(row);
  }

  return card;
}
