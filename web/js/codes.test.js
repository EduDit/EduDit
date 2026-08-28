import { test, assert, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";

test("level 1 unlocks exactly the first CHARS_PER_LEVEL letters", () => {
  assertEqual(codes.poolForLevel(1).join(""), "ET");
});

test("each level adds CHARS_PER_LEVEL more characters", () => {
  assertEqual(codes.poolForLevel(2).length, 4);
  assertEqual(codes.poolForLevel(3).length, 6);
});

test("the pool never exceeds the full learning order, even past MAX_LEVEL", () => {
  assertEqual(codes.poolForLevel(codes.MAX_LEVEL).length, codes.LEARNING_ORDER.length);
  assertEqual(codes.poolForLevel(codes.MAX_LEVEL + 5).length, codes.LEARNING_ORDER.length);
});

test("every Morse pattern maps back to the character that produced it", () => {
  for (const [ch, pattern] of Object.entries(codes.MORSE)) {
    assertEqual(codes.charFromPattern(pattern), ch);
  }
});

test("an unrecognized pattern has no character", () => {
  assertEqual(codes.charFromPattern("......."), null);
});

test("lesson 1 is just its own first CHARS_PER_LEVEL letters, not the cumulative pool", () => {
  assertEqual(codes.lessonChars(1), codes.poolForLevel(1));
});

test("lesson 2 is the next batch, not lesson 1's letters again", () => {
  const lesson1 = codes.lessonChars(1);
  const lesson2 = codes.lessonChars(2);
  assertEqual(lesson2.length, codes.CHARS_PER_LEVEL);
  for (const ch of lesson2) {
    assert(!lesson1.includes(ch), `${ch} from lesson 2 should not also be in lesson 1`);
  }
});

test("every lesson's letters concatenate back into the full learning order", () => {
  let rebuilt = [];
  for (let n = 1; n <= codes.MAX_LEVEL; n++) {
    rebuilt = rebuilt.concat(codes.lessonChars(n));
  }
  assertEqual(rebuilt, codes.LEARNING_ORDER.slice(0, rebuilt.length));
});
