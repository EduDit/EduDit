import { test, assertEqual } from "./testkit.js";
import { isNewer } from "./updateCheck.js";

test("a higher patch version is newer", () => {
  assertEqual(isNewer("1.0.1", "1.0.0"), true);
});

test("a higher minor or major version is newer", () => {
  assertEqual(isNewer("1.1.0", "1.0.9"), true);
  assertEqual(isNewer("2.0.0", "1.9.9"), true);
});

test("an equal version is not newer", () => {
  assertEqual(isNewer("1.0.0", "1.0.0"), false);
});

test("an older version is not newer", () => {
  assertEqual(isNewer("1.0.0", "1.0.1"), false);
});

test("a leading 'v' in the GitHub tag is ignored", () => {
  assertEqual(isNewer("v1.2.0", "1.1.0"), true);
});

test("missing trailing segments default to 0", () => {
  assertEqual(isNewer("1.1", "1.0.5"), true);
  assertEqual(isNewer("1.0", "1.0.0"), false);
});
