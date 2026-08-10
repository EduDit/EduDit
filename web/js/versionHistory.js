// Version History: lists published GitHub Releases, newest first, and
// offers the same one-click self-update as the startup banner — reachable
// from Settings instead of only appearing when an update is already found.

import { el, button } from "./dom.js";
import { APP_VERSION } from "./version.js";
import { fetchReleaseHistory, canSelfUpdate, applyUpdate } from "./updateCheck.js";

export class VersionHistory {
  constructor(root, app) {
    this.root = root;
    this.app = app;
    this._build();
  }

  _build() {
    const wrap = el("div", { class: "screen" });

    const top = el("div", { class: "row header-row" });
    top.appendChild(button("< Settings", () => this._back()));
    top.appendChild(el("span", { class: "heading", text: "Version History" }));
    wrap.appendChild(top);

    wrap.appendChild(el("p", { class: "small muted", text: `You're running version ${APP_VERSION}.` }));

    this.list = el("div", { class: "version-list" });
    wrap.appendChild(this.list);

    this.root.appendChild(wrap);
    this._load();
  }

  async _load() {
    this.list.replaceChildren(el("p", { class: "small muted", text: "Checking GitHub for releases…" }));
    try {
      const releases = await fetchReleaseHistory();
      this._render(releases);
    } catch {
      this.list.replaceChildren(
        el("p", { class: "small muted", text: "Couldn't reach GitHub to check for releases." }),
        button("Try again", () => this._load(), "btn-block btn-panel")
      );
    }
  }

  _render(releases) {
    this.list.replaceChildren();

    if (releases.length === 0) {
      this.list.appendChild(el("p", { class: "small muted", text: "No releases published yet." }));
      return;
    }

    const newest = releases.find((r) => r.isNewer);
    if (newest) {
      this.list.appendChild(this._updateCard(newest));
    }

    for (const r of releases) {
      this.list.appendChild(this._releaseCard(r));
    }
  }

  _updateCard(info) {
    const status = el("span", { class: "update-status small" });
    const actionBtn = canSelfUpdate()
      ? button("Update now", async () => {
          actionBtn.disabled = true;
          status.textContent = "Updating…";
          try {
            await applyUpdate();
            status.textContent = "Updated — reloading…";
            location.reload();
          } catch {
            status.textContent = "Update failed — try again, or use the link below.";
            actionBtn.disabled = false;
          }
        }, "btn-block btn-good")
      : el("a", { class: "btn btn-block btn-good", href: info.url, target: "_blank", rel: "noopener", text: "View on GitHub" });

    return el("div", { class: "card" }, [
      el("span", { class: "heading", text: `${info.version} is available` }),
      actionBtn,
      status,
    ]);
  }

  _releaseCard(r) {
    const row = el("div", { class: "row" });
    row.appendChild(el("span", { class: "heading mono", text: r.version }));
    row.appendChild(
      el("span", {
        class: r.version === `v${APP_VERSION}` || r.version === APP_VERSION ? "good small" : "muted small",
        text: r.version === `v${APP_VERSION}` || r.version === APP_VERSION ? "Installed" : this._formatDate(r.publishedAt),
      })
    );

    const card = el("div", { class: "card" }, [row]);
    if (r.name && r.name !== r.version) {
      card.appendChild(el("p", { class: "small", text: r.name }));
    }
    if (r.body) {
      card.appendChild(el("p", { class: "small muted version-notes", text: r.body }));
    }
    return card;
  }

  _formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  _back() {
    import("./settings.js").then((m) => this.app.show(m.Settings));
  }

  destroy() {}
}
