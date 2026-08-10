// Checks GitHub Releases for a newer version and, when running against the
// local server (serve.py / DitDashWeb.exe — not the read-only GitHub Pages
// hosted copy, which is already always latest), offers a one-click update
// that has the server pull and apply it without the user visiting GitHub.

import { el, button } from "./dom.js";
import { APP_VERSION, REPO } from "./version.js";

const DISMISSED_KEY = "ditdash_dismissed_update";

function parseVersion(v) {
  return (v || "")
    .replace(/^v/i, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

export function isNewer(remoteVersion, localVersion) {
  const remote = parseVersion(remoteVersion);
  const local = parseVersion(localVersion);
  const len = Math.max(remote.length, local.length);
  for (let i = 0; i < len; i++) {
    const r = remote[i] || 0;
    const l = local[i] || 0;
    if (r !== l) return r > l;
  }
  return false;
}

export async function checkForUpdate() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.tag_name && isNewer(data.tag_name, APP_VERSION)) {
      return { version: data.tag_name, url: data.html_url };
    }
  } catch {
    // Offline, rate-limited, or blocked — an update check is a nicety, not
    // something worth surfacing an error for.
  }
  return null;
}

// Every published release, newest first, for the Version History screen.
// Throws on failure (offline, rate-limited) so that screen can show its own
// "couldn't check" state instead of silently looking empty.
export async function fetchReleaseHistory(limit = 15) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=${limit}`);
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  const data = await res.json();
  return data.map((r) => ({
    version: r.tag_name,
    name: r.name || r.tag_name,
    body: r.body || "",
    url: r.html_url,
    publishedAt: r.published_at,
    isNewer: isNewer(r.tag_name, APP_VERSION),
  }));
}

// Only the app's own local server (serve.py / DitDashWeb.exe) can write
// files to update itself; the GitHub Pages copy is static and read-only.
export function canSelfUpdate() {
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
}

export async function applyUpdate() {
  const res = await fetch("/__update", { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export function showUpdateBanner(info) {
  if (sessionStorage.getItem(DISMISSED_KEY) === info.version) return;

  const status = el("span", { class: "update-status small" });
  const updateBtn = canSelfUpdate()
    ? button("Update now", async () => {
        updateBtn.disabled = true;
        status.textContent = "Updating…";
        try {
          await applyUpdate();
          status.textContent = "Updated — reloading…";
          location.reload();
        } catch {
          status.textContent = "Update failed — try again, or use the link.";
          updateBtn.disabled = false;
        }
      }, "btn-accent")
    : el("a", { class: "btn btn-accent", href: info.url, target: "_blank", rel: "noopener", text: "View on GitHub" });

  const dismiss = button("✕", () => {
    sessionStorage.setItem(DISMISSED_KEY, info.version);
    banner.remove();
  }, "update-dismiss");

  const banner = el("div", { class: "update-banner" }, [
    el("span", { class: "small", text: `DitDash ${info.version} is available.` }),
    status,
    updateBtn,
    dismiss,
  ]);

  document.body.insertBefore(banner, document.body.firstChild);
}
