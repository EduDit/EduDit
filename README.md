# DitDash

A Windows desktop Morse code trainer. Python 3 + tkinter for the UI and the
built-in `winsound` module for tones — **Windows only**.

## Features

- **Profiles** — pick or create a named profile (no passwords). Progress and
  settings are saved per profile.
- **Receive Practice** — hear a tone, tap the matching character. Ten correct
  in a row clears the level and unlocks two more characters.
- **Send Practice** — see a character and key it out with the spacebar or the
  on-screen circle. Short hold = dot, long hold = dash; pause to decode.
- **Settings** — per-profile speed (5–35 WPM) and tone pitch (300–1000 Hz), a
  test-tone button, and a progress reset.

Characters unlock shortest-Morse-first, then digits:
`E T I A N M S U R W D K G O H V F L P J B X C Y Z Q 0 1 2 3 4 5 6 7 8 9`.

Timing follows standard PARIS units: `unit = 1200 / wpm` ms, a dash is three
dots, and gaps between elements are one unit.

## Getting started

There are two versions of the app — the original tkinter desktop app and a
browser-based rebuild (`web/`) with the same features. Pick whichever fits:

**Desktop app, from source** (Windows, needs Python):

```bat
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python main.py
```

In VS Code, open this folder and press **F5** (the interpreter is preset to
`./.venv`). No third-party packages are needed to run — only the standard
library. Entry point: [`main.py`](main.py).

**Web app, from source** (any OS, needs Python to serve it locally):

Double-click [`run_web.bat`](run_web.bat) or [`run_web.vbs`](run_web.vbs) at
the repo root — it starts a local server and opens the app in your browser.
To run it by hand instead: `python web/serve.py`, then open
`http://localhost:8000`. Entry point: [`web/index.html`](web/index.html).
See [`web/README.md`](web/README.md) for more (deploying, tests, etc.).

**Web app, hosted, no install** — live at
[`https://screen4639.github.io/DitDash/`](https://screen4639.github.io/DitDash/).
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) auto-deploys
`web/` to GitHub Pages on every push to `main` that touches it.

**Either app, as a standalone .exe** (no Python needed on the target
machine) — see [Build an executable](#build-an-executable) below.

## Build an executable

```bat
build_exe.bat
```

This creates `dist\DitDash.exe` via PyInstaller — the tkinter desktop app,
fully self-contained (no Python needed on the target machine).

There's also a web version (see `web/`) for running in a browser instead.
`run_web.vbs` / `run_web.bat` launch it locally but need Python installed
on that machine. For a device without Python, build a standalone launcher
instead:

```bat
build_web_exe.bat
```

This creates `dist\DitDashWeb.exe`, which bundles the web app and a Python
runtime together — copy just that one file to another Windows PC and
double-click it; no Python install needed there. It serves the app at
`http://localhost:8000` and opens it in the default browser. The first run
also creates a `DitDashWeb_app` folder next to the `.exe` — a writable copy
of the web app used so the in-app update button (see
[Update checks](web/README.md#update-checks)) has somewhere persistent to
write to; safe to delete to reset to the bundled version.

## Data & layout

Profiles live under `data/` (created at runtime, not tracked in git):

```
data/profiles.json          list of profile names
data/profiles/<name>.json   per-profile levels, streaks, and settings
```

On first run, if an old single-user `legacy_progress.json` sits next to
the app and no profiles exist yet, it is imported as a profile named
**Player 1**.

## Project structure

```
main.py                        desktop entry point (Profile Select -> Main Menu)
web_launcher.py                standalone web launcher, packaged into DitDashWeb.exe
build_exe.bat                  build dist\DitDash.exe (desktop app)
build_web_exe.bat              build dist\DitDashWeb.exe (web app, bundled Python)
run_web.bat / run_web.vbs      run the web app locally (needs Python installed)
assets/icon.ico                app icon used by both .exe builds

morse/                         desktop app: game logic
  codes.py                     Morse table, learning order, level helpers
  audio.py                     tone playback via winsound
  storage.py                   per-profile JSON load/save (data/)

ui/                            desktop app: tkinter screens
  theme.py                     shared colors and fonts
  profile_select.py            pick or create a profile
  main_menu.py                 mode selection
  receive_practice.py          listen-and-tap drill
  send_practice.py             key-it-out drill
  settings_screen.py           per-profile settings

web/                           browser rebuild of the app (see web/README.md)
  index.html                   page shell / entry point
  serve.py                     local static file server (also used by web_launcher.py)
  styles.css                   all styling
  test.html                    in-browser test runner (no Node/build step)
  js/
    app.js                     app entry point, screen switching
    codes.js                   Morse table (mirrors morse/codes.py)
    learning.js                level/lesson pools, streaks, weak-letter weighting
    lessons.js                 Lessons screen (weak point review, custom, unlocked)
    customLessonEditor.js      create/edit a custom lesson
    storage.js                 per-profile load/save via localStorage
    profileSelect.js           pick or create a profile
    mainMenu.js                mode selection
    receivePractice.js         listen-and-tap drill
    sendPractice.js            key-it-out drill
    listenPractice.js          "listen only" playback mode
    settings.js                per-profile settings
    scoreboard.js              session score tracking
    audio.js                   tone playback via Web Audio
    dom.js                     shared DOM-building helpers
    version.js                 app version, compared against GitHub Releases
    updateCheck.js             checks GitHub for a newer release, shows update banner
    versionHistory.js          Version History screen (release list + one-click update), from Settings
    shutdown.js                tells serve.py to stop when the tab closes
    *.test.js                  unit tests for the module of the same name

.github/workflows/pages.yml    auto-deploys web/ to GitHub Pages on push to main
```
