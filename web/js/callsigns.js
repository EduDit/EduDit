// Realistic-format callsign and short-exchange generation for Callsign/QSO
// Practice — content only, no timing/audio/DOM here. Only ever emits
// letters, digits, and spaces (everything already in codes.MORSE), kept
// deliberately short and beginner-friendly (a bridge toward real on-air
// copy, not a simulated back-and-forth radio interface).

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const DIGITS = "0123456789".split("");

function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

function letters(rng, count) {
  let s = "";
  for (let i = 0; i < count; i++) s += pick(rng, LETTERS);
  return s;
}

// A registry of self-contained callsign formats, so a legitimate new format
// can be added later by appending an entry here — randomCallsign() and the
// rest of Callsign Practice don't need to change.
const CALLSIGN_FORMATS = [
  {
    id: "us_1x2_or_2x3",
    // 1-2 letter prefix + one digit + 2-3 letter suffix, e.g. "W1AW",
    // "K5ABC", "N0XYZ" — the common shape of a US amateur-radio callsign.
    generate(rng) {
      const prefixLen = rng() < 0.5 ? 1 : 2;
      const suffixLen = rng() < 0.5 ? 2 : 3;
      return `${letters(rng, prefixLen)}${pick(rng, DIGITS)}${letters(rng, suffixLen)}`;
    },
  },
];

export function randomCallsign(rng = Math.random) {
  return pick(rng, CALLSIGN_FORMATS).generate(rng);
}

// Short, beginner-friendly exchange templates — the bridge between copying
// single characters and copying a real (if abbreviated) on-air exchange.
// More templates can be appended the same way as CALLSIGN_FORMATS above.
const EXCHANGE_TEMPLATES = [
  (c1) => `CQ CQ DE ${c1}`,
  (c1, c2) => `${c1} DE ${c2}`,
  () => "UR RST 599",
  () => "TNX FER QSO 73",
  () => "GL GE",
  (c1) => `${c1} K`,
];

export function randomExchange(rng = Math.random) {
  const template = pick(rng, EXCHANGE_TEMPLATES);
  return template(randomCallsign(rng), randomCallsign(rng));
}
