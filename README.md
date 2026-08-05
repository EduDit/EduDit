# DitDash

A Windows desktop Morse code trainer. Python 3 + tkinter for the UI and the built-in `winsound` module for
tones — **Windows only**.

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

## Run from source

```bat
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
python main.py
```

In VS Code, open this folder and press **F5** (the interpreter is preset to
`./.venv`). No third-party packages are needed to run — only the standard
library.

## Build an executable

```bat
build_exe.bat
```

This creates `dist\DitDash.exe` via PyInstaller.

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
main.py                 entry point (Profile Select -> Main Menu)
morse/codes.py          Morse table, learning order, level helpers
morse/audio.py          tone playback via winsound
morse/storage.py        per-profile JSON load/save
ui/theme.py             shared colors and fonts
ui/profile_select.py    pick or create a profile
ui/main_menu.py         mode selection
ui/receive_practice.py  listen-and-tap drill
ui/send_practice.py     key-it-out drill
ui/settings_screen.py   per-profile settings
```
