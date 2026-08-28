// A MorseInput source for hardware that presents a real Morse key/paddle
// through ordinary browser input events — either keyboard events (the
// common case for USB "keyer" adapters that emulate a keyboard) or mouse
// button events (some simpler interfaces, e.g. foot-pedal-style adapters,
// emulate a mouse button instead — same digital on/off contact signal,
// just read through a different DOM event pair). Named
// "DeviceEventKeyInput", not "HidKeyInput" — it only ever sees standard
// DOM keyboard/mouse events, never a real navigator.hid device. A future
// WebHID-based source for interfaces that emulate neither would be a
// separate class behind the same "morsekey"/"morsekeyraw" event contract
// this module defines, not a variant of this one.
//
// Which event source is active is controlled by
// profile.settings.keyHidEventSource ("keyboard" | "mouse", default
// "keyboard") — set once per keyer preset, not mixed per-binding, since a
// real adapter is consistently one or the other, never a mix.
//
// Generalizes the keyboard-handling sendPractice.js already has (e.repeat
// guard, e.code matching, preventDefault-to-claim-the-key) into a
// standalone source with per-element contact-bounce filtering.
//
// Mouse mode has one extra problem keyboard mode doesn't: a mouse-emulating
// adapter's left-click is byte-for-byte identical to the user's real
// mouse's left-click — there is no device identity a browser page can read
// (Raw Input is OS-only, and WebHID blocklists anything that identifies as
// a Generic Desktop "Mouse"). MOVE_GRACE_MS below is a best-effort guess,
// not device identification, and it is deliberately biased toward never
// silently dropping a deliberate key press: a mistakenly-suppressed real
// click is recoverable in one Escape keystroke, a silently-dropped dit/dash
// is invisible and unrecoverable. See the comments on _handleMouseDown and
// _staleMove for how that bias is implemented.

import { DebounceFilter } from "./debounce.js";

// Higher sensitivity -> shorter debounce window (more responsive to fast
// legitimate keying, less protection against bounce); lower sensitivity ->
// longer window (safer against bounce, at the cost of possibly swallowing
// very fast legitimate transitions). Only used when `keyHidDebounceMs` is
// null — see settings.js's Sensitivity/Advanced override rule.
export function debounceMsFromSensitivity(sensitivity) {
  const s = Math.max(0, Math.min(100, sensitivity ?? 50));
  return Math.round(15 - (s / 100) * 12);
}

// Mouse-button bindings are stored as "MouseN" (N = MouseEvent.button,
// 0=left/1=middle/2=right/3=back/4=forward) rather than a bare number, so
// they can never collide with a KeyboardEvent.code string sharing the same
// keyHidCode/keyHidDitCode/keyHidDahCode field, and dom.js's keyLabel()
// can recognize the prefix to show a human label.
export function mouseBindingCode(button) {
  return `Mouse${button}`;
}

// A mousemove within this many ms of a mapped mousedown is treated as
// evidence the press came from the user's real mouse rather than the
// adapter (which never moves the OS cursor). Kept as an internal constant,
// not a tunable UI field — see settings.js's keyHidMovePassthrough toggle
// for the one user-facing knob.
const MOVE_GRACE_MS = 400;

// Hard ceiling on how long a single mapped button can be held before it's
// force-released even with no mouseup at all — guards against a missed
// mouseup (window lost focus mid-press, cursor released outside the
// window) wedging the input in a permanently-"down" state.
const STUCK_KEY_TIMEOUT_MS = 10000;

export class DeviceEventKeyInput extends EventTarget {
  constructor(settings) {
    super();
    this._s = settings;
    const ms = settings.keyHidDebounceMs ?? debounceMsFromSensitivity(settings.keySensitivity);
    this._generic = new DebounceFilter(ms);
    this._dit = new DebounceFilter(ms);
    this._dah = new DebounceFilter(ms);

    // button (MouseEvent.button) -> { down, classification, element, timeoutId }.
    // Entries persist after release (down: false) so the click/auxclick
    // that immediately follows a mouseup can still read the classification
    // that press was given — see _maybeSuppressClick.
    this._buttons = new Map();
    this._lastMoveAt = -Infinity;

    this._onKeyDown = (e) => this._handleKeyboard(e, "down");
    this._onKeyUp = (e) => this._handleKeyboard(e, "up");
    this._onMouseMove = () => {
      this._lastMoveAt = performance.now();
    };
    this._onMouseDown = (e) => this._handleMouseDown(e);
    this._onMouseUp = (e) => this._release(e.button, { timeStamp: e.timeStamp });
    this._onClick = (e) => this._maybeSuppressClick(e);
    this._onAuxClick = (e) => this._maybeSuppressClick(e);
    this._onDblClick = (e) => this._maybeSuppressClick(e);
    this._onDragStart = (e) => this._maybeSuppressHeld(e);
    this._onSelectStart = (e) => this._maybeSuppressHeld(e);
    this._onContextMenu = (e) => this._maybeSuppressContextMenu(e);
    this._onEscape = (e) => {
      if (e.key === "Escape") this._lastMoveAt = performance.now();
    };
    this._onBlur = () => this._forceReleaseAll();
    this._onPointerCancel = () => this._forceReleaseAll();
    this._onVisibilityChange = () => {
      if (document.hidden) this._forceReleaseAll();
      else this._staleMove();
    };
    this._onWindowFocus = () => this._staleMove();
  }

  // Synchronous — matches AudioKeyInput's async start() at the call-site
  // contract level (every caller does `await morseInput.start()`), but
  // neither event source here ever needs a permission prompt.
  start() {
    if (this._s.keyHidEventSource === "mouse") {
      // Stale on mount, not "just moved" — otherwise the mousemove that
      // preceded the click that navigated into this screen (e.g. "Start
      // Practice") would grant a false passthrough window to the very
      // first physical key press, silently dropping it. See _staleMove.
      this._staleMove();
      document.addEventListener("mousemove", this._onMouseMove);
      document.addEventListener("mousedown", this._onMouseDown);
      document.addEventListener("mouseup", this._onMouseUp);
      // A safety net for releases that land outside the window — paired
      // with the idempotency check in _release() so an ordinary in-window
      // release (which bubbles from document up to window) is never
      // double-counted.
      window.addEventListener("mouseup", this._onMouseUp);
      // Capture-phase, not bubble: these must be intercepted before they
      // reach whatever page element the OS cursor happens to be resting
      // over (Hint, Back, a link, …) when a press is classified as a
      // genuine Morse key-down rather than a real click.
      document.addEventListener("click", this._onClick, true);
      document.addEventListener("auxclick", this._onAuxClick, true);
      document.addEventListener("dblclick", this._onDblClick, true);
      document.addEventListener("dragstart", this._onDragStart, true);
      document.addEventListener("selectstart", this._onSelectStart, true);
      // Right-click (button 2) normally opens the browser's context menu —
      // suppressed only while button 2 is actually mapped, so an unrelated
      // right-click elsewhere still behaves normally.
      document.addEventListener("contextmenu", this._onContextMenu);
      document.addEventListener("keydown", this._onEscape, true);
      window.addEventListener("blur", this._onBlur);
      window.addEventListener("focus", this._onWindowFocus);
      window.addEventListener("pointercancel", this._onPointerCancel);
      document.addEventListener("visibilitychange", this._onVisibilityChange);
    } else {
      document.addEventListener("keydown", this._onKeyDown);
      document.addEventListener("keyup", this._onKeyUp);
    }
    return Promise.resolve();
  }

  _resolveElement(code) {
    const s = this._s;
    if (s.keyType === "straight") {
      return s.keyHidCode && code === s.keyHidCode ? "generic" : null;
    }
    const ditCode = s.swapDitDah ? s.keyHidDahCode : s.keyHidDitCode;
    const dahCode = s.swapDitDah ? s.keyHidDitCode : s.keyHidDahCode;
    if (ditCode && code === ditCode) return "dit";
    if (dahCode && code === dahCode) return "dah";
    return null;
  }

  _filterFor(element) {
    if (element === "dit") return this._dit;
    if (element === "dah") return this._dah;
    return this._generic;
  }

  _emit(edge, element, ts, forced = false) {
    const filter = this._filterFor(element);
    const accepted = filter.accept(edge, ts);
    const detail = { edge, element, ts, filtered: !accepted };
    if (forced) detail.forced = true;
    this.dispatchEvent(new CustomEvent("morsekeyraw", { detail }));
    if (accepted) {
      this.dispatchEvent(new CustomEvent("morsekey", { detail: { action: edge, element, ts } }));
    }
  }

  _handleKeyboard(e, edge) {
    if (edge === "down" && e.repeat) return;
    const element = this._resolveElement(e.code);
    if (!element) return;
    e.preventDefault();
    this._emit(edge, element, e.timeStamp);
  }

  // A "recent movement" reading is only trustworthy immediately after the
  // movement that produced it. Called on start() (nothing has moved yet in
  // this session) and on regaining focus/visibility (a movement recorded
  // right before the tab was backgrounded shouldn't still count once the
  // user returns) — the same rule enforced a third way in
  // _handleMouseDown, which re-stales this the instant a passthrough
  // classification consumes it.
  _staleMove() {
    this._lastMoveAt = performance.now() - MOVE_GRACE_MS - 1;
  }

  _handleMouseDown(e) {
    const element = this._resolveElement(mouseBindingCode(e.button));
    if (!element) return;
    const existing = this._buttons.get(e.button);
    if (existing && existing.down) return; // already tracked — ignore a duplicate mousedown

    // Best-effort, not device identification (see file header). When
    // genuinely unsure, this must lean "morse" — a dropped click is
    // recoverable via Escape, a dropped dit/dash is not.
    const passthrough =
      this._s.keyHidMovePassthrough !== false && performance.now() - this._lastMoveAt < MOVE_GRACE_MS;

    if (passthrough) {
      // One-shot: this movement earned exactly this one pass-through, not
      // a rolling 400ms window that could also protect the next, unrelated
      // mapped-button press (e.g. a real click on Hint immediately
      // followed by an actual key press with no mouse movement between
      // them — without this, that key press would silently vanish).
      this._staleMove();
    } else {
      // Suppress the browser's own handling of this button while it's held
      // as a Morse key — most importantly Back/Forward (buttons 3/4),
      // which otherwise navigate the page away.
      e.preventDefault();
    }

    const timeoutId = setTimeout(() => this._release(e.button, { forced: true }), STUCK_KEY_TIMEOUT_MS);
    this._buttons.set(e.button, {
      down: true,
      classification: passthrough ? "passthrough" : "morse",
      element,
      timeoutId,
    });

    if (!passthrough) this._emit("down", element, e.timeStamp);
  }

  // Shared by the normal mouseup listener, the window-level out-of-window
  // safety net (both of which see an ordinary in-window release, since
  // mouseup bubbles from document to window), and every forced-release
  // path (blur, hidden, pointercancel, the stuck-key ceiling). Idempotent
  // — a button already marked released is a no-op — so none of those can
  // ever double-fire a release edge for one physical release.
  _release(button, { forced = false, timeStamp } = {}) {
    const entry = this._buttons.get(button);
    if (!entry || !entry.down) return;
    clearTimeout(entry.timeoutId);
    entry.down = false;
    entry.timeoutId = null;
    if (entry.classification === "morse") {
      this._emit("up", entry.element, timeStamp ?? performance.now(), forced);
    }
  }

  _forceReleaseAll() {
    for (const button of [...this._buttons.keys()]) this._release(button, { forced: true });
  }

  // click/auxclick/dblclick all resolve to whichever button the underlying
  // press used; a press classified "morse" must never also activate
  // whatever page element the cursor happened to be resting on.
  _maybeSuppressClick(e) {
    const entry = this._buttons.get(e.button);
    if (entry && entry.classification === "morse") {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }

  // dragstart/selectstart don't carry a reliable `button`, so these gate on
  // "is any mapped button currently down and classified morse" instead of
  // resolving a specific button the way click/auxclick do.
  _maybeSuppressHeld(e) {
    for (const entry of this._buttons.values()) {
      if (entry.down && entry.classification === "morse") {
        e.preventDefault();
        return;
      }
    }
  }

  _maybeSuppressContextMenu(e) {
    if (this._resolveElement(mouseBindingCode(2))) e.preventDefault();
  }

  destroy() {
    document.removeEventListener("keydown", this._onKeyDown);
    document.removeEventListener("keyup", this._onKeyUp);
    document.removeEventListener("mousemove", this._onMouseMove);
    document.removeEventListener("mousedown", this._onMouseDown);
    document.removeEventListener("mouseup", this._onMouseUp);
    window.removeEventListener("mouseup", this._onMouseUp);
    document.removeEventListener("click", this._onClick, true);
    document.removeEventListener("auxclick", this._onAuxClick, true);
    document.removeEventListener("dblclick", this._onDblClick, true);
    document.removeEventListener("dragstart", this._onDragStart, true);
    document.removeEventListener("selectstart", this._onSelectStart, true);
    document.removeEventListener("contextmenu", this._onContextMenu);
    document.removeEventListener("keydown", this._onEscape, true);
    window.removeEventListener("blur", this._onBlur);
    window.removeEventListener("focus", this._onWindowFocus);
    window.removeEventListener("pointercancel", this._onPointerCancel);
    document.removeEventListener("visibilitychange", this._onVisibilityChange);
    for (const entry of this._buttons.values()) clearTimeout(entry.timeoutId);
    this._buttons.clear();
  }
}
