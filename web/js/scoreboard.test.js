import { test, assert, assertEqual } from "./testkit.js";
import * as storage from "./storage.js";
import { Scoreboard } from "./scoreboard.js";

function resetStorage() {
  localStorage.removeItem("ditdash");
}

function seedProfile(name, overrides = {}) {
  const p = storage.defaultProfile();
  Object.assign(p, overrides);
  storage.saveProfile(name, p);
  return p;
}

function fakeApp(profileName) {
  const shown = [];
  return {
    profileName,
    show: (cls, options) => shown.push({ cls, options }),
    _shown: shown,
  };
}

test("shows a placeholder when there are no profiles yet", () => {
  resetStorage();
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Anyone"));
  assert(root.textContent.includes("No profiles yet."), "expected the empty-state message");
});

test("renders one row per profile, sorted by score, current profile marked", () => {
  resetStorage();
  seedProfile("Low", { receive_level: 1, send_level: 1 });
  seedProfile("High", { receive_level: 5, send_level: 4 });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Low"));

  const entries = root.querySelectorAll(".scoreboard-entry");
  assertEqual(entries.length, 2);
  assert(entries[0].textContent.includes("High"), "expected the higher score first");
  assert(entries[1].classList.contains("scoreboard-current"), "expected Low (the active profile) marked current");
});

test("defaults the detail panel to the current profile and the Receive tab", () => {
  resetStorage();
  seedProfile("Me", { receive_seen: { A: 4 }, receive_mistakes: { A: 1 } });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Me"));

  assertEqual(root.querySelector(".detail-heading").textContent, "Me — letter accuracy");
  const rows = root.querySelectorAll(".accuracy-row");
  assertEqual(rows.length, 1);
  assertEqual(rows[0].querySelector(".accuracy-char").textContent, "A");
  assertEqual(rows[0].querySelector(".accuracy-pct").textContent, "75%");
});

test("clicking a profile row switches the detail panel to that profile", () => {
  resetStorage();
  seedProfile("Me", { receive_seen: { A: 2 }, receive_mistakes: {} });
  seedProfile("Friend", { receive_seen: { B: 2 }, receive_mistakes: {} });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Me"));

  const friendRow = [...root.querySelectorAll(".scoreboard-entry")].find((e) => e.textContent.includes("Friend"));
  friendRow.click();

  assert(root.querySelector(".detail-heading").textContent.includes("Friend"), "expected the detail heading to switch");
  assertEqual(root.querySelector(".accuracy-char").textContent, "B");
});

test("the Send tab shows send accuracy instead of receive", () => {
  resetStorage();
  seedProfile("Me", {
    receive_seen: { A: 2 },
    receive_mistakes: {},
    send_seen: { B: 4 },
    send_mistakes: { B: 4 },
  });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Me"));

  const sendTab = [...root.querySelectorAll(".tab-btn")].find((b) => b.textContent === "Send");
  sendTab.click();

  const rows = root.querySelectorAll(".accuracy-row");
  assertEqual(rows.length, 1);
  assertEqual(rows[0].querySelector(".accuracy-char").textContent, "B");
  assertEqual(rows[0].querySelector(".accuracy-pct").textContent, "0%");
});

test("Practice button only appears when viewing the active profile's own weak letters", () => {
  resetStorage();
  seedProfile("Me", { receive_seen: { A: 4, E: 4 }, receive_mistakes: { A: 3 } });
  seedProfile("Other", { receive_seen: { A: 4 }, receive_mistakes: { A: 3 } });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Me"));

  const practiceBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Practice these"));
  assert(practiceBtn, "expected a Practice button for the active profile");

  const otherRow = [...root.querySelectorAll(".scoreboard-entry")].find((e) => e.textContent.includes("Other"));
  otherRow.click();
  const practiceBtnForOther = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Practice these"));
  assert(!practiceBtnForOther, "expected no Practice button when viewing another profile");
});

test("only letters actually missed are offered for weak-letter practice", () => {
  resetStorage();
  seedProfile("Me", { receive_seen: { A: 4, E: 4 }, receive_mistakes: { A: 3 } });
  const root = document.createElement("div");
  new Scoreboard(root, fakeApp("Me"));

  const rows = [...root.querySelectorAll(".accuracy-row")];
  const missedChars = rows.filter((r) => !r.querySelector(".accuracy-count").textContent.startsWith("4/4"));
  assertEqual(missedChars.length, 1);
  assertEqual(missedChars[0].querySelector(".accuracy-char").textContent, "A");
});
