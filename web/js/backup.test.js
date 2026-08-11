import { test, assert, assertEqual } from "./testkit.js";
import { serializeProfile, parseImportedProfile } from "./backup.js";
import { defaultProfile } from "./storage.js";

test("serializeProfile -> parseImportedProfile round-trips a profile exactly", () => {
  const profile = defaultProfile();
  profile.receive_level = 4;
  profile.mistakes = { A: 3, B: 1 };
  const json = serializeProfile("Alice", profile);
  const { name, profile: restored } = parseImportedProfile(json);
  assertEqual(name, "Alice");
  assertEqual(restored, profile);
});

test("parseImportedProfile rejects invalid JSON with a clear message", () => {
  let threw = false;
  try {
    parseImportedProfile("{not valid json");
  } catch (e) {
    threw = true;
    assert(e.message.length > 0, "error should have a message");
  }
  assert(threw, "expected parseImportedProfile to throw");
});

test("parseImportedProfile rejects unrelated JSON (missing export marker)", () => {
  let threw = false;
  try {
    parseImportedProfile(JSON.stringify({ some: "other", file: true }));
  } catch (e) {
    threw = true;
  }
  assert(threw, "expected parseImportedProfile to reject a non-backup JSON file");
});

test("parseImportedProfile rejects a backup missing a profile name", () => {
  let threw = false;
  try {
    parseImportedProfile(JSON.stringify({ ditdash_profile_export: 1, profile: defaultProfile() }));
  } catch (e) {
    threw = true;
  }
  assert(threw, "expected parseImportedProfile to reject a missing name");
});

test("parseImportedProfile rejects a backup missing profile data", () => {
  let threw = false;
  try {
    parseImportedProfile(JSON.stringify({ ditdash_profile_export: 1, name: "Alice" }));
  } catch (e) {
    threw = true;
  }
  assert(threw, "expected parseImportedProfile to reject missing profile data");
});
