import { test, assert } from "../testkit.js";
import { DebounceFilter } from "./debounce.js";

test("DebounceFilter: accepts the first transition immediately", () => {
  const f = new DebounceFilter(5);
  assert(f.accept("down", 0), "first edge should never be delayed");
});

test("DebounceFilter: rejects a bounce burst, real release still accepted once settled", () => {
  const f = new DebounceFilter(5);
  assert(f.accept("down", 0), "down@0 accepted (real press)");
  assert(!f.accept("up", 1), "up@1 rejected (bounce)");
  assert(!f.accept("down", 2), "down@2 rejected (duplicate of held level)");
  assert(!f.accept("up", 3), "up@3 rejected (bounce)");
  assert(f.accept("up", 40), "up@40 accepted (real release after settling)");
});

test("DebounceFilter: rejects a duplicate of the currently-held level regardless of timing", () => {
  const f = new DebounceFilter(5);
  assert(f.accept("down", 0));
  assert(!f.accept("down", 100), "same level again is not a real transition");
});

test("DebounceFilter: a legitimate fast edge above minMs is not swallowed", () => {
  const f = new DebounceFilter(5);
  assert(f.accept("down", 0));
  assert(f.accept("up", 20), "a 20ms hold with a 5ms debounce window must not be filtered");
});

test("DebounceFilter: setMinMs changes the window for subsequent transitions", () => {
  const f = new DebounceFilter(5);
  assert(f.accept("down", 0));
  f.setMinMs(50);
  assert(!f.accept("up", 20), "20ms gap now below the new 50ms window");
  assert(f.accept("up", 60), "60ms gap now above the new 50ms window");
});
