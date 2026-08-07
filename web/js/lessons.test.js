import { test, assert, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";
import { Lessons } from "./lessons.js";

function fakeApp(receiveLevel, sendLevel, extra = {}) {
  return {
    profile: {
      receive_level: receiveLevel,
      send_level: sendLevel,
      mistakes: {},
      custom_lessons: [],
      ...extra,
    },
    profileName: "Test",
    show: () => {},
    saveProfile: () => {},
  };
}

test("Lessons renders one lesson-card per lesson up to the higher of receive/send level", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(2, 1));
  assertEqual(root.querySelectorAll(".lesson-card").length, 2);
});

test("a lesson beyond a mode's level shows that mode's button locked and disabled", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(2, 1));
  const cards = root.querySelectorAll(".lesson-card");
  const lesson2Buttons = cards[1].querySelectorAll("button");
  assertEqual(lesson2Buttons[0].disabled, false); // receive: lesson 2 <= receive_level 2
  assertEqual(lesson2Buttons[1].disabled, true); // send: lesson 2 > send_level 1
});

test("each rendered lesson lists exactly its own CHARS_PER_LEVEL letters", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(3, 3));
  const cards = root.querySelectorAll(".lesson-card");
  cards.forEach((card, i) => {
    const lessonNumber = i + 1;
    const pool = card.querySelector(".pool").textContent.split(" ");
    assertEqual(pool, codes.lessonChars(lessonNumber));
  });
});

test("Weak Point Review shows a placeholder when nothing has been missed yet", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(1, 1, { mistakes: {} }));
  const card = root.querySelector(".weak-review-card");
  assert(card, "expected a .weak-review-card");
  assertEqual(card.querySelectorAll("button").length, 0);
});

test("Weak Point Review ranks missed letters worst-first and offers Receive/Send", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(1, 1, { mistakes: { A: 1, B: 5 } }));
  const card = root.querySelector(".weak-review-card");
  assertEqual(card.querySelector(".pool").textContent, "B (5)   A (1)");
  const buttons = [...card.querySelectorAll("button")].map((b) => b.textContent);
  assertEqual(buttons, ["Receive", "Send"]);
});

test("with no custom lessons, only the 'New custom lesson' button shows", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(1, 1));
  assertEqual(root.querySelectorAll(".custom-lesson-card").length, 0);
  const newBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("New custom lesson"));
  assert(newBtn, "expected a 'New custom lesson' button");
});

test("each custom lesson renders its name, characters, and practice/manage buttons", () => {
  const root = document.createElement("div");
  const lesson = { id: "1", name: "Confusables", chars: ["M", "N"] };
  new Lessons(root, fakeApp(1, 1, { custom_lessons: [lesson] }));
  const card = root.querySelector(".custom-lesson-card");
  assert(card, "expected a .custom-lesson-card");
  assertEqual(card.querySelector(".heading").textContent, "Confusables");
  assertEqual(card.querySelector(".pool").textContent, "M N");
  const buttons = [...card.querySelectorAll("button")].map((b) => b.textContent);
  assertEqual(buttons, ["Receive", "Send", "Edit", "Delete"]);
});
