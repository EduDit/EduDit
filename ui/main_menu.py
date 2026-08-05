"""Main menu: choose a practice mode, open settings, or switch profile."""

import tkinter as tk

from morse import codes
from ui import theme


class MainMenu(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=theme.BG)
        self.app = app
        self._build()

    def _build(self):
        p = self.app.profile

        header = tk.Frame(self, bg=theme.BG)
        header.pack(fill="x", padx=24, pady=(24, 8))
        tk.Label(
            header,
            text=self.app.profile_name,
            font=theme.TITLE_FONT,
            bg=theme.BG,
            fg=theme.ACCENT,
        ).pack(side="left")
        theme.button(header, "Switch profile", self._switch).pack(side="right")

        self._mode_card(
            "Receive Practice",
            "Hear a tone, tap the character.",
            p["receive_level"],
            self._receive,
        )
        self._mode_card(
            "Send Practice",
            "See a character, key it out.",
            p["send_level"],
            self._send,
        )

        theme.button(
            self, "Settings", self._settings, bg=theme.PANEL
        ).pack(fill="x", padx=24, pady=(20, 24))

    def _mode_card(self, title, subtitle, level, command):
        card = tk.Frame(self, bg=theme.PANEL)
        card.pack(fill="x", padx=24, pady=8)

        row = tk.Frame(card, bg=theme.PANEL)
        row.pack(fill="x", padx=16, pady=(14, 4))
        tk.Label(row, text=title, font=theme.HEADING, bg=theme.PANEL, fg=theme.FG).pack(
            side="left"
        )
        tk.Label(
            row,
            text=f"Level {level}",
            font=theme.FONT,
            bg=theme.PANEL,
            fg=theme.GOOD,
        ).pack(side="right")

        tk.Label(
            card, text=subtitle, font=theme.SMALL, bg=theme.PANEL, fg=theme.MUTED
        ).pack(anchor="w", padx=16)

        pool = " ".join(codes.pool_for_level(level))
        tk.Label(
            card,
            text=pool,
            font=theme.MONO,
            bg=theme.PANEL,
            fg=theme.ACCENT,
            wraplength=380,
            justify="left",
        ).pack(anchor="w", padx=16, pady=(8, 4))

        theme.button(card, "Start  ▶", command, bg=theme.BTN_BG).pack(
            anchor="e", padx=16, pady=(4, 14)
        )

    def _receive(self):
        from ui.receive_practice import ReceivePractice

        self.app.show(ReceivePractice)

    def _send(self):
        from ui.send_practice import SendPractice

        self.app.show(SendPractice)

    def _settings(self):
        from ui.settings_screen import SettingsScreen

        self.app.show(SettingsScreen)

    def _switch(self):
        from ui.profile_select import ProfileSelect

        self.app.profile_name = None
        self.app.profile = None
        self.app.show(ProfileSelect)
