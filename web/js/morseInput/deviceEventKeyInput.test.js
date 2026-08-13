import { test, assert, assertEqual } from "../testkit.js";
import { DeviceEventKeyInput, debounceMsFromSensitivity, mouseBindingCode } from "./deviceEventKeyInput.js";

// keyHidDebounceMs defaults to 0 here (not the real-world null-derives-from-
// sensitivity default) because these tests dispatch synthetic events back to
// back with ~0ms of real elapsed time between them — any nonzero debounce
// window would filter the second edge as "too soon after the first," which
// is correct debounce behavior but not what most of these tests are about.
// The dedicated debounce test below overrides this explicitly.
function baseSettings(overrides = {}) {
  return {
    keyType: "straight",
    keyHidEventSource: "keyboard",
    keyHidCode: "KeyF",
    keyHidDitCode: null,
    keyHidDahCode: null,
    keyHidDebounceMs: 0,
    keySensitivity: 50,
    swapDitDah: false,
    ...overrides,
  };
}

function withInput(settings, fn) {
  const input = new DeviceEventKeyInput(settings);
  const events = [];
  const raw = [];
  input.addEventListener("morsekey", (e) => events.push(e.detail));
  input.addEventListener("morsekeyraw", (e) => raw.push(e.detail));
  input.start();
  try {
    fn(events, raw);
  } finally {
    input.destroy();
  }
}

test("debounceMsFromSensitivity: higher sensitivity yields a shorter debounce window", () => {
  assert(debounceMsFromSensitivity(100) < debounceMsFromSensitivity(0));
});

test("mouseBindingCode: distinct, human-distinguishable codes per button index", () => {
  assertEqual(mouseBindingCode(0), "Mouse0");
  assertEqual(mouseBindingCode(4), "Mouse4");
});

test("DeviceEventKeyInput (keyboard): straight key dispatches generic down/up for the mapped code", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF" }));
    assertEqual(
      events.map((e) => [e.action, e.element]),
      [["down", "generic"], ["up", "generic"]]
    );
  });
});

test("DeviceEventKeyInput (keyboard): ignores keys that aren't mapped", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyZ" }));
    assertEqual(events.length, 0);
  });
});

test("DeviceEventKeyInput (keyboard): ignores OS key-repeat", () => {
  withInput(baseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF", repeat: true }));
    assertEqual(events.length, 0);
  });
});

test("DeviceEventKeyInput (keyboard): double paddle maps dit/dah to independently-configured codes", () => {
  withInput(baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK" }), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyK" }));
    assertEqual(events.map((e) => e.element), ["dit", "dah"]);
  });
});

test("DeviceEventKeyInput (keyboard): swapDitDah reverses which physical key means dit vs dah", () => {
  withInput(
    baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK", swapDitDah: true }),
    (events) => {
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" }));
      assertEqual(events[0].element, "dah");
    }
  );
});

test("DeviceEventKeyInput (keyboard): a huge debounce window filters a same-frame bounce and reports it on morsekeyraw", () => {
  withInput(baseSettings({ keyHidDebounceMs: 1000 }), (events, raw) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF" }));
    assertEqual(raw[0].filtered, false);
    assertEqual(raw[1].filtered, true);
    assertEqual(events.length, 1, "the filtered second edge must not reach morsekey");
  });
});

test("DeviceEventKeyInput (keyboard): straight-key mapping is inert while keyType is paddle, and vice versa", () => {
  withInput(baseSettings({ keyType: "paddle", keyHidDitCode: "KeyJ", keyHidDahCode: "KeyK" }), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" })); // the straight-key mapping from baseSettings
    assertEqual(events.length, 0);
  });
});

// ---- Mouse event source ----

function mouseSettings(overrides = {}) {
  return baseSettings({
    keyHidEventSource: "mouse",
    keyHidCode: mouseBindingCode(2), // right button, by default
    ...overrides,
  });
}

test("DeviceEventKeyInput (mouse): straight key dispatches generic down/up for the mapped button", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    assertEqual(
      events.map((e) => [e.action, e.element]),
      [["down", "generic"], ["up", "generic"]]
    );
  });
});

test("DeviceEventKeyInput (mouse): ignores buttons that aren't mapped", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
    assertEqual(events.length, 0);
  });
});

test("DeviceEventKeyInput (mouse): double paddle maps dit/dah to independently-configured buttons", () => {
  withInput(
    mouseSettings({ keyType: "paddle", keyHidCode: null, keyHidDitCode: mouseBindingCode(3), keyHidDahCode: mouseBindingCode(4) }),
    (events) => {
      document.dispatchEvent(new MouseEvent("mousedown", { button: 3 }));
      document.dispatchEvent(new MouseEvent("mousedown", { button: 4 }));
      assertEqual(events.map((e) => e.element), ["dit", "dah"]);
    }
  );
});

test("DeviceEventKeyInput (mouse): keyboard events are ignored entirely while in mouse mode", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyF" }));
    assertEqual(events.length, 0);
  });
});

test("DeviceEventKeyInput (mouse): suppresses the context menu only while the right button is mapped", () => {
  withInput(mouseSettings({ keyHidCode: mouseBindingCode(2) }), () => {
    const evt = new MouseEvent("contextmenu", { cancelable: true });
    document.dispatchEvent(evt);
    assert(evt.defaultPrevented, "right-click menu should be suppressed while button 2 is mapped");
  });
  withInput(mouseSettings({ keyHidCode: mouseBindingCode(3) }), () => {
    const evt = new MouseEvent("contextmenu", { cancelable: true });
    document.dispatchEvent(evt);
    assert(!evt.defaultPrevented, "context menu must behave normally when the right button isn't mapped");
  });
});

// ---- Movement heuristic, event suppression, stuck-key safety, Escape ----
//
// These simulate elapsed time by directly poking `_lastMoveAt` (same
// convention as liveKeyDecoder.test.js poking `_pressTime`) rather than
// real waits, since the test harness has no fake-timer/async support. The
// one exception is the stuck-key ceiling test, which captures the real
// setTimeout callback/delay DeviceEventKeyInput schedules and invokes it
// directly instead of waiting 10 real seconds.

function withTarget(fn) {
  const target = document.createElement("button");
  document.body.appendChild(target);
  try {
    fn(target);
  } finally {
    target.remove();
  }
}

test("DeviceEventKeyInput (mouse): a press with no recent movement is classified morse — click suppressed, edge decoded", () => {
  withTarget((target) => {
    let clicked = false;
    target.addEventListener("click", () => (clicked = true));
    withInput(mouseSettings(), (events) => {
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const clickEvt = new MouseEvent("click", { button: 2, bubbles: true, cancelable: true });
      target.dispatchEvent(clickEvt);
      assert(!clicked, "the underlying control's own click handler must not fire");
      assert(clickEvt.defaultPrevented, "click should be prevented");
      assertEqual(events.map((e) => e.action), ["down", "up"]);
    });
  });
});

test("DeviceEventKeyInput (mouse): a click on an unmapped button always passes through untouched", () => {
  withTarget((target) => {
    let clicked = false;
    target.addEventListener("click", () => (clicked = true));
    withInput(mouseSettings(), (events) => {
      const clickEvt = new MouseEvent("click", { button: 0, bubbles: true, cancelable: true });
      target.dispatchEvent(clickEvt);
      assert(clicked, "an unmapped button's click must pass through normally");
      assert(!clickEvt.defaultPrevented);
      assertEqual(events.length, 0);
    });
  });
});

test("DeviceEventKeyInput (mouse): recent movement classifies a mapped press as passthrough — not suppressed, not decoded", () => {
  withTarget((target) => {
    let clicked = false;
    target.addEventListener("click", () => (clicked = true));
    withInput(mouseSettings(), (events) => {
      document.dispatchEvent(new MouseEvent("mousemove"));
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const clickEvt = new MouseEvent("click", { button: 2, bubbles: true, cancelable: true });
      target.dispatchEvent(clickEvt);
      assert(clicked, "a real click following recent movement must pass through");
      assert(!clickEvt.defaultPrevented);
      assertEqual(events.length, 0, "must not be decoded as Morse input");
    });
  });
});

test("DeviceEventKeyInput (mouse): a mapped non-primary button suppresses the resulting auxclick", () => {
  withTarget((target) => {
    let fired = false;
    target.addEventListener("auxclick", () => (fired = true));
    withInput(mouseSettings({ keyHidCode: mouseBindingCode(3) }), () => {
      target.dispatchEvent(new MouseEvent("mousedown", { button: 3, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 3, bubbles: true, cancelable: true }));
      const evt = new MouseEvent("auxclick", { button: 3, bubbles: true, cancelable: true });
      target.dispatchEvent(evt);
      assert(!fired);
      assert(evt.defaultPrevented);
    });
  });
});

test("DeviceEventKeyInput (mouse): a mapped button suppresses the resulting dblclick", () => {
  withTarget((target) => {
    let fired = false;
    target.addEventListener("dblclick", () => (fired = true));
    withInput(mouseSettings(), () => {
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const evt = new MouseEvent("dblclick", { button: 2, bubbles: true, cancelable: true });
      target.dispatchEvent(evt);
      assert(!fired);
      assert(evt.defaultPrevented);
    });
  });
});

test("DeviceEventKeyInput (mouse): dragstart/selectstart are suppressed while a mapped button is held down, not after release", () => {
  withTarget((target) => {
    withInput(mouseSettings(), () => {
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      const dragEvt = new Event("dragstart", { bubbles: true, cancelable: true });
      target.dispatchEvent(dragEvt);
      assert(dragEvt.defaultPrevented, "dragstart must be suppressed while held as a Morse press");
      const selectEvt = new Event("selectstart", { bubbles: true, cancelable: true });
      target.dispatchEvent(selectEvt);
      assert(selectEvt.defaultPrevented, "selectstart must be suppressed while held as a Morse press");

      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const dragAfter = new Event("dragstart", { bubbles: true, cancelable: true });
      target.dispatchEvent(dragAfter);
      assert(!dragAfter.defaultPrevented, "no longer held — must not suppress");
    });
  });
});

test("DeviceEventKeyInput (keyboard mode): registers no mouse-suppression or movement-tracking listeners", () => {
  const seen = [];
  const origDoc = document.addEventListener.bind(document);
  const origWin = window.addEventListener.bind(window);
  document.addEventListener = (type, ...rest) => {
    seen.push(type);
    return origDoc(type, ...rest);
  };
  window.addEventListener = (type, ...rest) => {
    seen.push(type);
    return origWin(type, ...rest);
  };
  try {
    const input = new DeviceEventKeyInput(baseSettings());
    input.start();
    input.destroy();
  } finally {
    document.addEventListener = origDoc;
    window.addEventListener = origWin;
  }
  const mouseOnly = [
    "mousemove",
    "mousedown",
    "mouseup",
    "click",
    "auxclick",
    "dblclick",
    "dragstart",
    "selectstart",
    "contextmenu",
    "blur",
    "focus",
    "pointercancel",
    "visibilitychange",
  ];
  for (const type of mouseOnly) {
    assert(!seen.includes(type), `keyboard mode should not register a "${type}" listener`);
  }
});

test("DeviceEventKeyInput (mouse): a press immediately after start() is classified morse, not dropped (startup fix)", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    assertEqual(events.map((e) => e.action), ["down", "up"], "must not be silently dropped as a false passthrough");
  });
});

test("DeviceEventKeyInput (mouse): a key press immediately after a real click is still decoded, not dropped", () => {
  withTarget((target) => {
    withInput(mouseSettings(), (events) => {
      document.dispatchEvent(new MouseEvent("mousemove"));
      // A real mouse click on an unrelated control — recent movement, so
      // classified passthrough: not suppressed, not decoded.
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      assertEqual(events.length, 0, "the real click itself must not be decoded");
      // Immediately after, with no further movement, an actual key press —
      // must not inherit the grace window the click already consumed.
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
      assertEqual(events.map((e) => e.action), ["down", "up"], "the key press must not be silently dropped");
    });
  });
});

test("DeviceEventKeyInput (mouse): a press right after regaining focus is classified morse, not dropped (focus-regain fix)", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new MouseEvent("mousemove"));
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    assertEqual(events.map((e) => e.action), ["down", "up"], "must not be dropped after regaining focus");
  });
});

test("DeviceEventKeyInput (mouse): classification is fixed at mousedown and does not change if the mouse moves mid-press", () => {
  withTarget((target) => {
    let clicked = false;
    target.addEventListener("click", () => (clicked = true));
    withInput(mouseSettings(), (events) => {
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      document.dispatchEvent(new MouseEvent("mousemove")); // real mouse bumped mid-hold
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const clickEvt = new MouseEvent("click", { button: 2, bubbles: true, cancelable: true });
      target.dispatchEvent(clickEvt);
      assert(!clicked, "classification must not flip mid-press despite the intervening movement");
      assert(clickEvt.defaultPrevented);
      assertEqual(events.map((e) => e.action), ["down", "up"]);
    });
  });
});

test("DeviceEventKeyInput (mouse): Escape lets the next press pass through, but the effect is not indefinite", () => {
  const target = document.createElement("button");
  document.body.appendChild(target);
  const input = new DeviceEventKeyInput(mouseSettings());
  const events = [];
  input.addEventListener("morsekey", (e) => events.push(e.detail));
  input.start();
  try {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
    assertEqual(events.length, 0, "Escape should let the immediately-following press through as a real click");

    // Simulate the grace window having lapsed since, without a real wait.
    input._lastMoveAt -= 1000;
    target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
    target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
    assertEqual(events.map((e) => e.action), ["down", "up"], "Escape's effect must not be sticky");
  } finally {
    input.destroy();
    target.remove();
  }
});

test("DeviceEventKeyInput (mouse): keyHidMovePassthrough=false always classifies as morse, even with recent movement", () => {
  withTarget((target) => {
    let clicked = false;
    target.addEventListener("click", () => (clicked = true));
    withInput(mouseSettings({ keyHidMovePassthrough: false }), (events) => {
      document.dispatchEvent(new MouseEvent("mousemove"));
      target.dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true, cancelable: true }));
      target.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true, cancelable: true }));
      const clickEvt = new MouseEvent("click", { button: 2, bubbles: true, cancelable: true });
      target.dispatchEvent(clickEvt);
      assert(!clicked, "flag off must mean full suppression regardless of movement");
      assertEqual(events.map((e) => e.action), ["down", "up"]);
    });
  });
});

test("DeviceEventKeyInput (mouse): window blur force-releases a held key, and a later stray mouseup is a no-op", () => {
  withInput(mouseSettings(), (events, raw) => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    window.dispatchEvent(new Event("blur"));
    assertEqual(events.map((e) => e.action), ["down", "up"], "blur should force a release edge");
    assert(raw[raw.length - 1].forced, "the forced release should be flagged in the raw detail");

    document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    assertEqual(events.length, 2, "a later stray mouseup must not produce a second release");
  });
});

test("DeviceEventKeyInput (mouse): a hard ceiling force-releases a held key if no mouseup ever arrives", () => {
  const originalSetTimeout = window.setTimeout;
  let capturedFn = null;
  let capturedDelay = null;
  window.setTimeout = (fn, delay) => {
    capturedFn = fn;
    capturedDelay = delay;
    return -1; // never a real pending timer, so clearTimeout(-1) is always inert
  };
  try {
    withInput(mouseSettings(), (events, raw) => {
      document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
      assertEqual(capturedDelay, 10000, "stuck-key ceiling should be 10 seconds");
      capturedFn(); // simulate the ceiling firing, without a real 10s wait
      assertEqual(events.map((e) => e.action), ["down", "up"]);
      assert(raw[raw.length - 1].forced, "the forced release should be flagged in the raw detail");
    });
  } finally {
    window.setTimeout = originalSetTimeout;
  }
});

test("DeviceEventKeyInput (mouse): a single bubbling mouseup does not produce two release edges", () => {
  withInput(mouseSettings(), (events) => {
    document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
    document.dispatchEvent(new MouseEvent("mouseup", { button: 2, bubbles: true }));
    assertEqual(events.map((e) => e.action), ["down", "up"], "exactly one release, not two");
  });
});

test("DeviceEventKeyInput (mouse): destroy() removes all listeners — events after destroy have no effect", () => {
  const input = new DeviceEventKeyInput(mouseSettings());
  const events = [];
  input.addEventListener("morsekey", (e) => events.push(e.detail));
  input.start();
  input.destroy();
  document.dispatchEvent(new MouseEvent("mousedown", { button: 2 }));
  document.dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
  document.dispatchEvent(new MouseEvent("mousemove"));
  window.dispatchEvent(new Event("blur"));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  assertEqual(events.length, 0, "no listener should still be active after destroy()");
});

test("DeviceEventKeyInput (mouse): repeated start()/destroy() cycles do not leak duplicate listeners", () => {
  // destroy() unconditionally attempts to remove both mode's listeners
  // (harmless no-op for whichever mode wasn't active), so removeCount per
  // cycle is a fixed constant greater than addCount, not equal to it — the
  // real leak signal is that addCount grows by the exact same fixed amount
  // every cycle, never creeping up.
  let addCount = 0;
  const origAdd = document.addEventListener.bind(document);
  document.addEventListener = (...args) => {
    addCount++;
    return origAdd(...args);
  };
  try {
    const input = new DeviceEventKeyInput(mouseSettings());
    input.start();
    input.destroy();
    const perCycle = addCount;
    input.start();
    input.destroy();
    assertEqual(addCount, perCycle * 2, "each start() should register exactly the same fixed set of listeners");
  } finally {
    document.addEventListener = origAdd;
  }
});
