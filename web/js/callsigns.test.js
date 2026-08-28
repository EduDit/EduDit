import { test, assert } from "./testkit.js";
import { randomCallsign, randomExchange } from "./callsigns.js";
import { MORSE } from "./codes.js";

const CALLSIGN_SHAPE = /^[A-Z]{1,2}[0-9][A-Z]{2,3}$/;

test("randomCallsign matches the documented US 1x2-or-2x3 shape", () => {
  for (let i = 0; i < 200; i++) {
    const call = randomCallsign();
    assert(CALLSIGN_SHAPE.test(call), `"${call}" doesn't match the expected callsign shape`);
  }
});

test("randomCallsign is deterministic with an injected rng", () => {
  const rng = () => 0; // always picks the first option at every branch
  const a = randomCallsign(rng);
  const b = randomCallsign(rng);
  assert(a === b, `expected deterministic output, got "${a}" and "${b}"`);
});

test("randomCallsign only emits characters present in the Morse table", () => {
  for (let i = 0; i < 100; i++) {
    const call = randomCallsign();
    for (const ch of call) {
      assert(MORSE[ch] !== undefined, `"${ch}" in "${call}" has no Morse pattern`);
    }
  }
});

test("randomExchange only emits letters, digits, and spaces", () => {
  for (let i = 0; i < 100; i++) {
    const exchange = randomExchange();
    for (const ch of exchange) {
      assert(ch === " " || MORSE[ch] !== undefined, `"${ch}" in "${exchange}" is not letters/digits/space`);
    }
  }
});

test("randomExchange stays short and beginner-friendly (no runaway templates)", () => {
  for (let i = 0; i < 100; i++) {
    const exchange = randomExchange();
    assert(exchange.length <= 30, `"${exchange}" is longer than expected (${exchange.length} chars)`);
  }
});
