# DitDash — Web

A browser rebuild of the DitDash Morse trainer, matching the desktop app's
design and behavior (same character learning order, PARIS timing, streak
leveling, Receive/Send practice modes, and settings). Pure static HTML/CSS/
vanilla JS — no build step, no framework, no backend.

Profile data (levels, streaks, WPM/pitch settings) is stored in the
browser's `localStorage`, one entry per device/browser — there are no
accounts or passwords, same as the desktop app's "local, same-PC" model.

## Run locally

Any static file server works, since the app uses ES modules (`import`),
which browsers refuse to load from a `file://` URL. From this `web/`
folder:

```
python -m http.server 8000
```

then open `http://localhost:8000`.

## Update checks

On startup the app checks the repo's [latest GitHub Release](https://github.com/Screen4639/DitDash/releases/latest)
against the version in `js/version.js` (`js/updateCheck.js`) and shows a
dismissible banner if a newer one exists. This only fires against real
releases — pushes to `main` alone don't trigger it, so tag one when you
want users to be notified:

```
git tag v1.2.0
git push origin v1.2.0
```

then turn that tag into a Release on GitHub (Releases → Draft a new
release, pick the tag). Also bump `APP_VERSION` in `js/version.js` to
match, so the running app doesn't immediately re-flag its own release.

The banner's behavior depends on how the app is being served:
- **`serve.py` / `DitDashWeb.exe`** (served from `localhost`) — an
  "Update now" button calls `POST /__update`, which has the server
  download the latest release's `web/` folder and copy it over the
  running one; the page then reloads. For the packaged exe, the first
  run seeds a writable `DitDashWeb_app` folder next to the `.exe` (since
  `--onefile` re-extracts a fresh temp copy on every launch, which
  wouldn't persist an update) — that folder is what gets updated and
  served from on subsequent launches.
- **GitHub Pages / Cloudflare Pages** (hosted, static, read-only) — the
  button is a "View on GitHub" link instead, since there's no server to
  ask, and the hosted copy is already always current after Pages'
  auto-deploy on push to `main`.

Settings also has a green **Check for Updates** button above the current
version number, which opens **Version History** (`js/versionHistory.js`) —
every published release with its notes, the same one-click update button
when a newer one exists, and "Installed" marking whichever release matches
the running version. Unlike the startup banner, this is reachable any time,
not just when an update happens to be available.

## Deploy to GitHub Pages

`.github/workflows/pages.yml` auto-builds and deploys this folder to
GitHub Pages on every push to `main` that touches `web/`. One-time setup:
in the repo's **Settings → Pages**, set **Build and deployment → Source**
to **GitHub Actions**. After that, the workflow runs automatically and
the app is live at `https://<owner>.github.io/<repo>/` — no download, no
Python, works from any browser (phone, Mac, Chromebook, etc.).

## Deploy to Cloudflare Pages

**Option A — dashboard:**
1. Push this repo to GitHub/GitLab.
2. In the Cloudflare dashboard: Workers & Pages → Create → Pages → Connect
   to Git → select this repo.
3. Build settings: no build command, output directory `web`.
4. Deploy — Cloudflare serves `web/index.html` and friends as-is.

**Option B — Wrangler CLI:**
```
npm install -g wrangler
wrangler pages deploy web --project-name=ditdash
```

No environment variables, secrets, or backend services are required.

## Lessons

Levels still unlock characters in small batches and require a streak of
correct answers to clear (see `js/learning.js` — the streak needed grows
with level, capped at `MAX_STREAK_TO_CLEAR`). The **Lessons** screen (from
the main menu's Custom Lessons card, or the bottom-row Lessons button) has
two ways to drill specific characters — neither touches your level or
streak, and both score only for the current session:

- **Custom Lessons** — name a set of characters yourself (a stubborn letter,
  a random mix, anything) via the on-screen character picker, and it's
  saved to your profile for reuse, edit, or delete. The first entry, **Weak
  Letters**, is a pinned, auto-updating lesson built from whichever letters
  you've missed most (`rankedMistakes` in `js/learning.js`) — it can't be
  edited or deleted, since it just recomputes from your mistake history on
  every visit.
- **Unlocked Lessons** — every batch of letters unlocked so far, same as
  before, for jumping back into any of them.

In all practice modes, letters you've been missing more often are weighted
to come up more frequently than ones you already have down (`charWeight` /
`pickWeighted` in `js/learning.js`).

## Scoreboard

Beyond comparing profiles' levels (`js/scoreboard.js`), the Scoreboard is
also where per-letter accuracy lives: pick a profile from the comparison
table, then switch between the **Receive** and **Send** tabs (they're
scored independently — `receive_mistakes`/`receive_seen` vs.
`send_mistakes`/`send_seen` on the profile) to see every attempted letter's
hit rate, worst-first (`accuracyRows` in `js/learning.js`). For the profile
you're currently signed in as, a **Practice these** button jumps straight
into Receive/Send practice scoped to that tab's worst letters, and a
**Custom Lessons** button links over to the Weak Letters lesson described
above.

## Tests

`test.html` is a small dependency-free test page covering the pure game
logic — Morse lookup tables, level/lesson pool sizing, the new-letter hint
rules, streak-to-clear scaling, trouble-letter weighting, and per-letter
accuracy ranking, all in `js/learning.js` and `js/codes.js` — plus the
Lessons screen's rendering (including the auto Weak Letters lesson and
user-made Custom Lessons), the custom lesson editor's save/validate/edit
behavior, and the Scoreboard's profile comparison and accuracy tabs.
Serve this folder as above, then open `http://localhost:8000/test.html` —
it runs in-browser and lists each assertion as PASS/FAIL, no Node or build
step required.
