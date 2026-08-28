import { test, assertEqual } from "./testkit.js";
import { explainCharacter } from "./explainSelection.js";

test("an unattempted character explains it hasn't been practiced yet", () => {
  assertEqual(explainCharacter("B", 0, 0), "B is a character you haven't practiced yet.");
});

test("a heavily-weighted trouble character explains it's shown more often", () => {
  assertEqual(explainCharacter("B", 10, 5), "You're seeing B more often because you've missed it recently.");
});

test("a clean, well-attempted character explains it's under control", () => {
  assertEqual(explainCharacter("B", 5, 0), "You've got B down — it won't come up as often now.");
});

test("a middling character gets a neutral explanation", () => {
  assertEqual(explainCharacter("B", 10, 1), "B comes up about as often as any other unlocked character right now.");
});
