import { test, assert, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";
import { Lessons } from "./lessons.js";
import { getRecommendation } from "./recommendation.js";

function fakeApp(receiveLevel, sendLevel, extra = {}) {
  return {
    profile: {
      receive_level: receiveLevel,
      send_level: sendLevel,
      receive_streak: 0,
      send_streak: 0,
      mistakes: {},
      custom_lessons: [],
      ...extra,
    },
    profileName: "Test",
    show: () => {},
    saveProfile: () => {},
  };
}

// Lessons defaults to the Unlocked tab; Custom-tab content only renders
// after switching, same as a real click would trigger.
function switchToCustomTab(root) {
  const customTab = [...root.querySelectorAll(".tab-btn")].find((b) => b.textContent === "Custom");
  customTab.click();
}

test("Lessons renders one lesson-card per lesson up to the higher of receive/send level (Unlocked tab, the default)", () => {
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

// Lessons' "what to work on" hero reuses getRecommendation() (the same
// engine Home and Session Summary use) rather than inventing its own copy
// or re-deriving weak-letter tiering — this just confirms the wiring.
test("the hero shows getRecommendation()'s own title and subtitle", () => {
  const app = fakeApp(1, 1);
  const root = document.createElement("div");
  new Lessons(root, app);
  const rec = getRecommendation(app.profile);
  const hero = root.querySelector(".hero-card");
  assertEqual(hero.querySelector(".heading").textContent, rec.title);
  assert(hero.textContent.includes(rec.subtitle), "expected the hero to include the recommendation's subtitle");
});

test("when the recommendation is about weak letters, the hero's own Start Practice button covers it (no redundant second button)", () => {
  // E and T are the only characters unlocked at level 1 (codes.LEARNING_ORDER).
  const app = fakeApp(1, 1, {
    mistakes: { E: 7 },
    receive_seen: { E: 10 },
    send_seen: {},
  });
  const root = document.createElement("div");
  new Lessons(root, app);
  const rec = getRecommendation(app.profile);
  assertEqual(rec.reason, "weak");
  const redundantBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Practice Weak Letters"));
  assert(!redundantBtn, "the hero's Start Practice button already handles the weak-letters case");
});

test("with no custom lessons, the Custom tab shows only the 'New custom lesson' button", () => {
  const root = document.createElement("div");
  new Lessons(root, fakeApp(1, 1));
  switchToCustomTab(root);
  assertEqual(root.querySelectorAll(".custom-lesson-card").length, 0);
  const newBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("New custom lesson"));
  assert(newBtn, "expected a 'New custom lesson' button");
});

test("each custom lesson renders its name, characters, and practice/manage buttons on the Custom tab", () => {
  const root = document.createElement("div");
  const lesson = { id: "1", name: "Confusables", chars: ["M", "N"] };
  new Lessons(root, fakeApp(1, 1, { custom_lessons: [lesson] }));
  switchToCustomTab(root);
  const card = root.querySelector(".custom-lesson-card");
  assert(card, "expected a .custom-lesson-card");
  assertEqual(card.querySelector(".heading").textContent, "Confusables");
  assertEqual(card.querySelector(".pool").textContent, "M N");
  const buttons = [...card.querySelectorAll("button")].map((b) => b.textContent);
  assertEqual(buttons, ["Receive", "Send", "Edit", "Delete"]);
});
