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
the main menu) has three ways to drill specific characters — none of them
touch your level or streak, and all score only for the current session:

- **Weak Point Review** — auto-built from whichever letters you've missed
  most (`rankedMistakes` in `js/learning.js`), with one tap into Receive or
  Send practice for just those letters. Also reachable via the "Review"
  button on the main menu's Weak letters card.
- **Custom Lessons** — name a set of characters yourself (a stubborn letter,
  a random mix, anything) via the on-screen character picker, and it's
  saved to your profile for reuse, edit, or delete.
- **Unlocked Lessons** — every batch of letters unlocked so far, same as
  before, for jumping back into any of them.

In all practice modes, letters you've been missing more often are weighted
to come up more frequently than ones you already have down (`charWeight` /
`pickWeighted` in `js/learning.js`).

## Tests

`test.html` is a small dependency-free test page covering the pure game
logic — Morse lookup tables, level/lesson pool sizing, the new-letter hint
rules, streak-to-clear scaling, and trouble-letter weighting, all in
`js/learning.js` and `js/codes.js` — plus the Lessons screen's rendering
(including Weak Point Review and Custom Lessons) and the custom lesson
editor's save/validate/edit behavior.
Serve this folder as above, then open `http://localhost:8000/test.html` —
it runs in-browser and lists each assertion as PASS/FAIL, no Node or build
step required.
