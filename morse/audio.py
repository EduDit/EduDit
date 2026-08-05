"""Tone playback for Morse patterns via winsound (Windows only).

Playback runs on a daemon thread so the UI never blocks. PARIS timing:
one unit = 1200 / wpm ms, a dot is one unit, a dash is three, and the gap
between elements within a character is one unit.
"""

import threading
import time

try:
    import winsound
except ImportError:  # allows the module to import on non-Windows for testing
    winsound = None


class AudioPlayer:
    def __init__(self):
        self._thread = None
        self._stop = threading.Event()

    def play_pattern(self, pattern, wpm, freq):
        """Play a dot/dash pattern (e.g. ".-") asynchronously."""
        self.stop()
        self._stop = threading.Event()
        self._thread = threading.Thread(
            target=self._run_pattern,
            args=(pattern, wpm, freq, self._stop),
            daemon=True,
        )
        self._thread.start()

    def test_tone(self, freq, duration_ms=400):
        """Play a single continuous tone (used by Settings)."""
        self.stop()
        threading.Thread(
            target=self._beep, args=(freq, duration_ms), daemon=True
        ).start()

    def stop(self):
        """Ask any in-progress playback to stop after the current element."""
        if self._thread and self._thread.is_alive():
            self._stop.set()

    def _run_pattern(self, pattern, wpm, freq, stop):
        unit_ms = 1200.0 / max(1, wpm)
        for i, symbol in enumerate(pattern):
            if stop.is_set():
                return
            duration = unit_ms if symbol == "." else unit_ms * 3
            self._beep(freq, duration)
            if i != len(pattern) - 1:
                time.sleep(unit_ms / 1000.0)  # intra-character gap

    @staticmethod
    def _beep(freq, duration_ms):
        freq = int(max(37, min(32767, freq)))
        duration_ms = int(max(1, duration_ms))
        if winsound is not None:
            winsound.Beep(freq, duration_ms)
        else:  # silent fallback keeps timing roughly right off-Windows
            time.sleep(duration_ms / 1000.0)
