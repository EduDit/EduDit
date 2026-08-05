"""DitDash — a Windows Morse code trainer. Entry point.

Launches the Profile Select screen and holds shared state (the active profile
and the audio player) that every screen reads through the App controller.
"""

import tkinter as tk

from morse import storage
from morse.audio import AudioPlayer
from ui import theme
from ui.profile_select import ProfileSelect


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("DitDash")
        self.geometry("480x760")
        self.minsize(440, 680)
        self.configure(bg=theme.BG)

        self.audio = AudioPlayer()
        self.profile_name = None
        self.profile = None

        self._container = tk.Frame(self, bg=theme.BG)
        self._container.pack(fill="both", expand=True)
        self._current = None

        storage.ensure_dirs()
        storage.maybe_import_legacy()
        self.show(ProfileSelect)

    def show(self, screen_cls, **kwargs):
        """Swap the visible screen, tearing down the previous one."""
        self.audio.stop()
        if self._current is not None:
            self._current.destroy()
        self._current = screen_cls(self._container, self, **kwargs)
        self._current.pack(fill="both", expand=True)

    def load_profile(self, name):
        self.profile_name = name
        self.profile = storage.load_profile(name)

    def save_profile(self):
        if self.profile_name and self.profile is not None:
            storage.save_profile(self.profile_name, self.profile)


def main():
    App().mainloop()


if __name__ == "__main__":
    main()
