import { test, assert, assertEqual } from "./testkit.js";
import * as codes from "./codes.js";
import { CustomLessonEditor } from "./customLessonEditor.js";

function fakeApp(customLessons = []) {
  const saved = [];
  return {
    profile: { custom_lessons: customLessons },
    profileName: "Test",
    show: () => {},
    saveProfile() {
      saved.push(JSON.parse(JSON.stringify(this.profile.custom_lessons)));
    },
    _saved: saved,
  };
}

function clickChar(root, ch) {
  const btn = [...root.querySelectorAll(".key")].find((b) => b.textContent === ch);
  btn.click();
  return btn;
}

test("saving without a name shows an error and does not save", () => {
  const root = document.createElement("div");
  const app = fakeApp();
  new CustomLessonEditor(root, app);
  clickChar(root, "M");
  root.querySelector(".btn-accent").click();
  assertEqual(app._saved.length, 0);
  assert(root.querySelector(".error").textContent.length > 0, "expected an error message");
});

test("saving without any characters selected shows an error and does not save", () => {
  const root = document.createElement("div");
  const app = fakeApp();
  new CustomLessonEditor(root, app);
  root.querySelector(".text-input").value = "Confusables";
  root.querySelector(".btn-accent").click();
  assertEqual(app._saved.length, 0);
  assert(root.querySelector(".error").textContent.length > 0, "expected an error message");
});

test("saving a new lesson stores it in LEARNING_ORDER order, not click order", () => {
  const root = document.createElement("div");
  const app = fakeApp();
  new CustomLessonEditor(root, app);
  root.querySelector(".text-input").value = "Confusables";
  clickChar(root, "M"); // clicked before N, but N comes first in LEARNING_ORDER
  clickChar(root, "N");
  root.querySelector(".btn-accent").click();

  assertEqual(app.profile.custom_lessons.length, 1);
  const lesson = app.profile.custom_lessons[0];
  assertEqual(lesson.name, "Confusables");
  assertEqual(lesson.chars, ["N", "M"]);
  assert(lesson.id, "expected a generated id");
});

test("clicking a selected character deselects it", () => {
  const root = document.createElement("div");
  const app = fakeApp();
  new CustomLessonEditor(root, app);
  root.querySelector(".text-input").value = "Solo";
  const btn = clickChar(root, "K");
  assert(btn.classList.contains("key-selected"), "expected K to be selected after one click");
  clickChar(root, "K");
  assert(!btn.classList.contains("key-selected"), "expected K to be deselected after a second click");
});

test("editing an existing lesson pre-selects its characters and updates in place", () => {
  const root = document.createElement("div");
  const lesson = { id: "abc", name: "Old name", chars: ["K", "G"] };
  const app = fakeApp([lesson]);
  new CustomLessonEditor(root, app, { lessonId: "abc" });

  assertEqual(root.querySelector(".text-input").value, "Old name");
  const kBtn = [...root.querySelectorAll(".key")].find((b) => b.textContent === "K");
  assert(kBtn.classList.contains("key-selected"), "expected K to start pre-selected");

  root.querySelector(".text-input").value = "New name";
  root.querySelector(".btn-accent").click();

  assertEqual(app.profile.custom_lessons.length, 1); // updated in place, not appended
  assertEqual(app.profile.custom_lessons[0].name, "New name");
  assertEqual(app.profile.custom_lessons[0].chars, codes.LEARNING_ORDER.filter((ch) => ["K", "G"].includes(ch)));
});
