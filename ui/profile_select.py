"""Launch screen: pick an existing profile or create a new one."""

import tkinter as tk

from morse import storage
from ui import theme


class ProfileSelect(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=theme.BG)
        self.app = app
        self._build()

    def _build(self):
        tk.Label(
            self, text="EduDit", font=theme.TITLE_FONT, bg=theme.BG, fg=theme.ACCENT
        ).pack(pady=(40, 4))
        tk.Label(
            self,
            text="Morse code trainer",
            font=theme.SMALL,
            bg=theme.BG,
            fg=theme.MUTED,
        ).pack(pady=(0, 24))

        tk.Label(
            self, text="Choose a profile", font=theme.HEADING, bg=theme.BG, fg=theme.FG
        ).pack(pady=(0, 8))

        list_frame = tk.Frame(self, bg=theme.BG)
        list_frame.pack(fill="x", padx=48)

        profiles = storage.list_profiles()
        if profiles:
            for name in profiles:
                theme.button(
                    list_frame,
                    name,
                    lambda n=name: self._choose(n),
                    anchor="w",
                ).pack(fill="x", pady=4)
        else:
            tk.Label(
                list_frame,
                text="No profiles yet — create one below.",
                font=theme.SMALL,
                bg=theme.BG,
                fg=theme.MUTED,
            ).pack(pady=8)

        tk.Frame(self, bg=theme.BTN_BG, height=1).pack(fill="x", padx=48, pady=24)

        tk.Label(
            self, text="New profile", font=theme.HEADING, bg=theme.BG, fg=theme.FG
        ).pack()
        entry_row = tk.Frame(self, bg=theme.BG)
        entry_row.pack(pady=8)
        self.name_var = tk.StringVar()
        entry = tk.Entry(
            entry_row,
            textvariable=self.name_var,
            font=theme.FONT,
            width=18,
            bg=theme.PANEL,
            fg=theme.FG,
            insertbackground=theme.FG,
            relief="flat",
        )
        entry.pack(side="left", ipady=6, padx=(0, 8))
        entry.bind("<Return>", lambda _e: self._create())
        theme.button(entry_row, "Create", self._create, bg=theme.ACCENT, fg=theme.BG).pack(
            side="left"
        )

        self.error = tk.Label(self, text="", font=theme.SMALL, bg=theme.BG, fg=theme.BAD)
        self.error.pack(pady=6)

    def _choose(self, name):
        self.app.load_profile(name)
        from ui.main_menu import MainMenu

        self.app.show(MainMenu)

    def _create(self):
        name = self.name_var.get().strip()
        if not name:
            self.error.config(text="Please enter a name.")
            return
        if name in storage.list_profiles():
            self.error.config(text="That profile already exists.")
            return
        storage.create_profile(name)
        self._choose(name)
