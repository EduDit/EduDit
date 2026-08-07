// Zero-dependency test harness for the browser test page (test.html).
// Matches the rest of the app: no build step, no framework, no node_modules.

export const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (err) {
    results.push({ name, pass: false, error: err.message });
  }
}

export function assert(condition, message = "assertion failed") {
  if (!condition) throw new Error(message);
}

export function assertEqual(actual, expected, message = "") {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  if (!same) {
    const prefix = message ? `${message}: ` : "";
    throw new Error(`${prefix}expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}
