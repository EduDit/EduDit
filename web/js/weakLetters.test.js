import { test, assertEqual } from "./testkit.js";
import { tierLetters, combinedSeen } from "./weakLetters.js";

function profile(receiveSeen, sendSeen, mistakes) {
  return { receive_seen: receiveSeen, send_seen: sendSeen, mistakes };
}

test("combinedSeen sums receive and send attempts per character", () => {
  assertEqual(combinedSeen(profile({ A: 3 }, { A: 2, B: 1 }, {})), { A: 5, B: 1 });
});

test("characters under the minimum attempt count are left out of every tier", () => {
  const tiers = tierLetters(profile({ A: 2 }, {}, { A: 2 }));
  assertEqual(tiers.needsWork.length + tiers.gettingBetter.length + tiers.strong.length, 0);
});

test("a character below 70% accuracy lands in needsWork", () => {
  const tiers = tierLetters(profile({ B: 5 }, { B: 5 }, { B: 7 }));
  assertEqual(tiers.needsWork.map((r) => r.ch), ["B"]);
});

test("a character between 70% and the strong threshold lands in gettingBetter", () => {
  const tiers = tierLetters(profile({ F: 5 }, { F: 5 }, { F: 3 }));
  assertEqual(tiers.gettingBetter.map((r) => r.ch), ["F"]);
});

test("a strong character requires both enough attempts and 90%+ accuracy", () => {
  const tiers = tierLetters(profile({ E: 8 }, { E: 7 }, {}));
  assertEqual(tiers.strong.map((r) => r.ch), ["E"]);
});
