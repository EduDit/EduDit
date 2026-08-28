import { test, assert, assertEqual } from "./testkit.js";
import { createProfile, deleteProfile, listProfiles, loadProfile, renameProfile, saveProfile } from "./storage.js";

function reset() {
  localStorage.removeItem("edudit");
}

test("storage: profile can be renamed without losing progress", () => {
  reset();
  const profile = createProfile("Before");
  profile.receive_level = 7;
  saveProfile("Before", profile);
  assert(renameProfile("Before", "After"));
  assertEqual(listProfiles(), ["After"]);
  assertEqual(loadProfile("After").receive_level, 7);
});

test("storage: deleting a profile removes its data", () => {
  reset();
  createProfile("Temporary");
  assert(deleteProfile("Temporary"));
  assertEqual(listProfiles(), []);
  assertEqual(JSON.parse(localStorage.getItem("edudit")).data, {});
});
