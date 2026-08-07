// Tells the local dev server (serve.py) to stop when this tab/window is
// actually closed. Skipped on reload, since that's a real navigation away
// and back, not the user being done — checked via the Navigation Timing
// API's entry type rather than the older performance.navigation.type.
const [navEntry] = performance.getEntriesByType("navigation");
const isReload = navEntry && navEntry.type === "reload";

if (!isReload) {
  window.addEventListener("pagehide", () => {
    navigator.sendBeacon("/__shutdown");
  });
}
