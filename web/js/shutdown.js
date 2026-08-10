// Tells the local dev server (serve.py) to stop when this tab/window is
// actually closed. A reload also fires pagehide, and there's no reliable
// way to tell "closing" from "reloading" from this side alone — so this
// always sends the beacon, and serve.py is the one that actually decides:
// it holds off shutting down for a moment, and cancels if a new request
// (the reloaded page re-requesting index.html) shows up in the meantime.
window.addEventListener("pagehide", () => {
  navigator.sendBeacon("/__shutdown");
});
