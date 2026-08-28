# EduDit — Web

A browser rebuild of the EduDit Morse trainer, matching the desktop app's
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

On startup the app checks the repo's [latest GitHub Release](https://github.com/EduDit/EduDit/releases/latest)
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
- **`serve.py` / packaged EduDitWeb app** (served from `localhost`) — an
  "Update now" button calls `POST /__update`, which has the server
  download the latest release's `web/` folder and copy it over the
  running one; the page then reloads. For the packaged exe, the first
  run seeds a writable copy of the web app (`EduDitWeb_app` beside the
  Windows `.exe`, or `~/Library/Application Support/EduDit/web` on macOS).
  That folder is what gets updated and served on subsequent launches.
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
wrangler pages deploy web --project-name=edudit
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

## Session Summary

Receive/Send Practice always ends somewhere useful instead of just looping
back into another round: leveling up (`js/receivePractice.js`/
`js/sendPractice.js`) always shows a **Session Summary**
(`js/sessionSummary.js`) with score, accuracy, streak, characters
practiced, and — if new characters unlocked — the same teaching-card
treatment a character's first appearance gets elsewhere (`js/teachingCard.js`).
Manually exiting ("< Menu"/Esc) shows the same summary once a real session
happened (3+ rounds; below that it's a quick accidental-open, so it just
navigates back directly). The summary's recommendation comes from the same
`getRecommendation()` (`js/recommendation.js`) Home uses, so the two never
disagree, and one **Continue Training** button (via the shared
`startRecommendedTraining()`) is always the obvious next step.

A wrong answer also gets a short, soft, low audio cue
(`AudioPlayer.playIncorrectCue`, `js/audio.js`) and a brief shake — distinct
from the correct-answer pulse and never relying on color alone — without
being punishing or interrupting the pace of practice.

## Callsign & QSO Practice

A peer of Receive/Send/Listen (`js/callsignPractice.js`, reachable from
Home next to Listen, or from Lessons): copies real-format callsigns
(`js/callsigns.js`, e.g. `W1AW`) and short beginner exchanges (`CQ CQ DE
W1AW`, `UR RST 599`) by ear, typed back as free text rather than picked
from a keyboard. Deliberately uses the full alphabet and digits regardless
of your unlocked level — framed clearly as an optional stretch mode, not
a test — and keeps its own `callsign_stats` counters separate from
per-letter Receive/Send accuracy, since a wrong whole-callsign guess
doesn't identify which single character was wrong.

## Farnsworth spacing

Settings' **Spacing Speed** slider (alongside **Character Speed**) slows
the gaps between characters and words while keeping every dot/dash at full
character speed — the standard way beginners learn to recognize characters
at real speed. Off by default (matches Character Speed). The timing math
lives in `js/farnsworth.js`; it only affects Callsign Practice's
multi-character playback (`AudioPlayer.playTimelineAsync`) — every existing
single-character Receive/Send/Listen call site is untouched.

## Backup & Restore

Since progress only lives in this browser's `localStorage`, Settings'
**Backup & Restore** section (`js/backup.js`) exports the active profile to
a downloadable `.json` file and can re-import one — a straight
serialization of the same profile object `js/storage.js` already stores,
just wrapped in a small versioned envelope. Importing validates the file
first (a clear rejection message for anything malformed) and always
confirms before overwriting an existing profile, with distinct wording if
that profile happens to be the one currently active (its session reloads
immediately after).

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
behavior, the Scoreboard's profile comparison and accuracy tabs,
Farnsworth's gap-only timing math (`js/farnsworth.js`), the callsign/
exchange content generator's format validity (`js/callsigns.js`), and
profile backup/restore's serialize/parse/validate round-trip
(`js/backup.js`). Serve this folder as above, then open
`http://localhost:8000/test.html` — it runs in-browser and lists each
assertion as PASS/FAIL, no Node or build step required.

Screen classes (`sessionSummary.js`, `callsignPractice.js`, and the
wrong-answer audio/visual cue and arrow-key navigation helper woven into
existing screens) intentionally have no dedicated test file, consistent
with every other screen module (`mainMenu.js`, `journey.js`, etc.) — only
the pure logic modules they call into are unit-tested.
