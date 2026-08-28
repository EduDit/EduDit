"""Per-profile load/save backed by JSON files under data/.

Layout:
    data/profiles.json            -> {"profiles": ["Alice", "Bob"]}
    data/profiles/<name>.json     -> that profile's state
"""

import json
import os

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(_ROOT, "data")
PROFILES_DIR = os.path.join(DATA_DIR, "profiles")
PROFILES_INDEX = os.path.join(DATA_DIR, "profiles.json")
LEGACY_FILE = os.path.join(_ROOT, "legacy_progress.json")


def default_profile():
    return {
        "receive_level": 1,
        "send_level": 1,
        "receive_streak": 0,
        "send_streak": 0,
        "settings": {"wpm": 15, "freq": 600},
    }


def ensure_dirs():
    os.makedirs(PROFILES_DIR, exist_ok=True)
    if not os.path.exists(PROFILES_INDEX):
        _write_json(PROFILES_INDEX, {"profiles": []})


def list_profiles():
    if not os.path.exists(PROFILES_INDEX):
        return []
    data = _read_json(PROFILES_INDEX) or {}
    return list(data.get("profiles", []))


def _profile_path(name):
    return os.path.join(PROFILES_DIR, name + ".json")


def load_profile(name):
    """Load a profile, filling in any missing fields with defaults."""
    profile = default_profile()
    stored = _read_json(_profile_path(name)) or {}
    for key, value in stored.items():
        if key == "settings" and isinstance(value, dict):
            profile["settings"].update(value)
        else:
            profile[key] = value
    return profile


def save_profile(name, profile):
    ensure_dirs()
    _write_json(_profile_path(name), profile)
    names = list_profiles()
    if name not in names:
        names.append(name)
        _write_json(PROFILES_INDEX, {"profiles": names})


def create_profile(name):
    profile = default_profile()
    save_profile(name, profile)
    return profile


def maybe_import_legacy():
    """On first run with no profiles, import an old single-user file as 'Player 1'."""
    if list_profiles():
        return None
    if not os.path.exists(LEGACY_FILE):
        return None
    legacy = _read_json(LEGACY_FILE) or {}
    profile = default_profile()
    for key in ("receive_level", "send_level", "receive_streak", "send_streak"):
        if isinstance(legacy.get(key), int):
            profile[key] = legacy[key]
    if isinstance(legacy.get("settings"), dict):
        profile["settings"].update(legacy["settings"])
    save_profile("Player 1", profile)
    return "Player 1"


def _read_json(path):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def _write_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
