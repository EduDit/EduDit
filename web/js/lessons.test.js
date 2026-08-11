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

test("no Weak Letters tiers or Practice button show when nothing has been attempted yet", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(1, 1, { mistakes: {} }));
  assertEqual(root.querySelectorAll(".accuracy-list").length, 0);
  const practiceBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Practice Weak Letters"));
  assert(!practiceBtn, "expected no 'Practice Weak Letters' button");
});

test("Weak Letters groups characters into Needs Work / Getting Better / Strong tiers", () => {
  const root = document.createElement("div");
  new Lessons(
    root,
    fakeApp(1, 1, {
      mistakes: { B: 7, F: 3 },
      receive_seen: { B: 5, F: 5, E: 8 },
      send_seen: { B: 5, F: 5, E: 7 },
    })
  );
  const tierLabels = [...root.querySelectorAll(".accuracy-list")]
    .map((list) => list.previousElementSibling.textContent);
  assertEqual(tierLabels, ["NEEDS WORK", "GETTING BETTER", "STRONG"]);

  const needsWork = root.querySelectorAll(".accuracy-list")[0];
  assertEqual(needsWork.querySelector(".accuracy-char").textContent, "B");
  assertEqual(needsWork.querySelector(".accuracy-pct").textContent, "30%");

  const gettingBetter = root.querySelectorAll(".accuracy-list")[1];
  assertEqual(gettingBetter.querySelector(".accuracy-char").textContent, "F");
  assertEqual(gettingBetter.querySelector(".accuracy-pct").textContent, "70%");

  const strong = root.querySelectorAll(".accuracy-list")[2];
  assertEqual(strong.querySelector(".accuracy-char").textContent, "E");

  // Exactly one action — no per-tier Receive/Send pair like the old design.
  const practiceBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Practice Weak Letters"));
  assert(practiceBtn, "expected a single 'Practice Weak Letters' button");
});

test("with no custom lessons and no mistakes, only the 'New custom lesson' button shows", () => {
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
