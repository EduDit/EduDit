// Morse code table, learning order, and level helpers.
// Mirrors morse/codes.py exactly so both the desktop and web apps agree.

export const MORSE = {
  A: ".-", B: "-...", C: "-.-.", D: "-..", E: ".",
  F: "..-.", G: "--.", H: "....", I: "..", J: ".---",
  K: "-.-", L: ".-..", M: "--", N: "-.", O: "---",
  P: ".--.", Q: "--.-", R: ".-.", S: "...", T: "-",
  U: "..-", V: "...-", W: ".--", X: "-..-", Y: "-.--",
  Z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-",
  5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----.",
};

export const PATTERN_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE).map(([ch, pattern]) => [pattern, ch])
);

// Characters unlock in this order: letters by shortest pattern first, then digits.
export const LEARNING_ORDER = "ETIANMSURWDKGOHVFLPJBXCYZQ0123456789".split("");

// Each level adds this many new characters to the practice pool.
export const CHARS_PER_LEVEL = 2;

// Highest reachable level (whole pool unlocked).
export const MAX_LEVEL = Math.floor(LEARNING_ORDER.length / CHARS_PER_LEVEL);

export function poolForLevel(level) {
  let count = Math.max(1, level) * CHARS_PER_LEVEL;
  count = Math.min(count, LEARNING_ORDER.length);
  return LEARNING_ORDER.slice(0, count);
}

// The batch of characters a single lesson introduces — e.g. lesson 1 is
// just its first CHARS_PER_LEVEL letters, not everything unlocked so far.
// Lets a learner revisit one lesson's letters on their own instead of the
// full cumulative pool.
export function lessonChars(lessonNumber) {
  const n = Math.max(1, lessonNumber);
  const start = (n - 1) * CHARS_PER_LEVEL;
  return LEARNING_ORDER.slice(start, start + CHARS_PER_LEVEL);
}

export function charFromPattern(pattern) {
  return PATTERN_TO_CHAR[pattern] || null;
}

// Speaks a dot/dash pattern as a short rhythm phrase (e.g. "-..." -> "dah,
// dit, dit, dit"), the conventional way Morse is voiced aloud when teaching
// it. Purely a presentation helper for the New Character teaching card —
// not used by any timing or decoding logic.
export function rhythmPhrase(pattern) {
  return pattern
    .split("")
    .map((s) => (s === "." ? "dit" : "dah"))
    .join(", ");
}
