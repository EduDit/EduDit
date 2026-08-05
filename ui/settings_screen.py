"""Settings: per-profile WPM and tone pitch, plus a progress reset."""

import tkinter as tk
from tkinter import messagebox

from ui import theme


class SettingsScreen(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=theme.BG)
        self.app = app
        self._build()

    def _build(self):
        top = tk.Frame(self, bg=theme.BG)
        top.pack(fill="x", padx=16, pady=12)
        theme.button(top, "< Menu", self._back).pack(side="left")
        tk.Label(
            top, text="Settings", font=theme.HEADING, bg=theme.BG, fg=theme.FG
        ).pack(side="right")

        s = self.app.profile["settings"]

        self.wpm_var = tk.IntVar(value=int(s.get("wpm", 15)))
        self._slider("Speed (WPM)", self.wpm_var, 5, 35, self._on_wpm)

        self.freq_var = tk.IntVar(value=int(s.get("freq", 600)))
        self._slider("Tone pitch (Hz)", self.freq_var, 300, 1000, self._on_freq)

        theme.button(
            self, "Test tone  ♪", self._test_tone, bg=theme.ACCENT, fg=theme.BG
        ).pack(fill="x", padx=32, pady=(24, 8))

        theme.button(
            self, "Reset this profile's progress", self._reset, fg=theme.BAD
        ).pack(fill="x", padx=32, pady=8)

    def _slider(self, label, var, lo, hi, command):
        frame = tk.Frame(self, bg=theme.BG)
        frame.pack(fill="x", padx=32, pady=(18, 0))
        row = tk.Frame(frame, bg=theme.BG)
        row.pack(fill="x")
        tk.Label(row, text=label, font=theme.FONT, bg=theme.BG, fg=theme.FG).pack(
            side="left"
        )
        value_lbl = tk.Label(
            row, textvariable=var, font=theme.FONT, bg=theme.BG, fg=theme.GOOD
        )
        value_lbl.pack(side="right")
        scale = tk.Scale(
            frame,
            variable=var,
            from_=lo,
            to=hi,
            orient="horizontal",
            command=command,
            bg=theme.BG,
            fg=theme.FG,
            troughcolor=theme.PANEL,
            highlightthickness=0,
            activebackground=theme.ACCENT,
            showvalue=False,
            sliderrelief="flat",
            bd=0,
        )
        scale.pack(fill="x")

    def _on_wpm(self, _value):
        self.app.profile["settings"]["wpm"] = int(self.wpm_var.get())
        self.app.save_profile()

    def _on_freq(self, _value):
        self.app.profile["settings"]["freq"] = int(self.freq_var.get())
        self.app.save_profile()

    def _test_tone(self):
        self.app.audio.test_tone(int(self.freq_var.get()))

    def _reset(self):
        if not messagebox.askyesno(
            "Reset progress",
            f"Reset all levels and streaks for '{self.app.profile_name}'?\n"
            "Speed and pitch settings are kept.",
        ):
            return
        p = self.app.profile
        p["receive_level"] = 1
        p["send_level"] = 1
        p["receive_streak"] = 0
        p["send_streak"] = 0
        self.app.save_profile()
        messagebox.showinfo("Reset", "Progress reset.")

    def _back(self):
        from ui.main_menu import MainMenu

        self.app.show(MainMenu)
