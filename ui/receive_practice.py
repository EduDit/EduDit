"""Receive Practice: hear a tone, tap the matching character."""

import random
import tkinter as tk
from tkinter import ttk

from morse import codes
from ui import theme

STREAK_TO_CLEAR = 10
WRONG_PENALTY = 2


class ReceivePractice(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=theme.BG)
        self.app = app
        self.target = None
        self.answered = False
        self._build()
        self.next_round()

    # ---- layout ----------------------------------------------------------
    def _build(self):
        top = tk.Frame(self, bg=theme.BG)
        top.pack(fill="x", padx=16, pady=12)
        theme.button(top, "< Menu", self._back).pack(side="left")
        self.level_lbl = tk.Label(
            top, text="", font=theme.FONT, bg=theme.BG, fg=theme.GOOD
        )
        self.level_lbl.pack(side="right")

        self.status = tk.Label(
            self, text="", font=theme.HEADING, bg=theme.BG, fg=theme.FG
        )
        self.status.pack(pady=(8, 4))

        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass
        style.configure(
            "Streak.Horizontal.TProgressbar",
            troughcolor=theme.PANEL,
            background=theme.GOOD,
            bordercolor=theme.PANEL,
            lightcolor=theme.GOOD,
            darkcolor=theme.GOOD,
        )
        self.progress = ttk.Progressbar(
            self,
            style="Streak.Horizontal.TProgressbar",
            maximum=STREAK_TO_CLEAR,
            length=360,
        )
        self.progress.pack(pady=(4, 2))
        self.streak_lbl = tk.Label(
            self, text="", font=theme.SMALL, bg=theme.BG, fg=theme.MUTED
        )
        self.streak_lbl.pack()

        theme.button(
            self, "Replay  ▶", self.play, bg=theme.ACCENT, fg=theme.BG
        ).pack(pady=14)

        self.btn_frame = tk.Frame(self, bg=theme.BG)
        self.btn_frame.pack(pady=8)

    # ---- game loop -------------------------------------------------------
    def _pool(self):
        return codes.pool_for_level(self.app.profile["receive_level"])

    def next_round(self):
        self.answered = False
        pool = self._pool()
        self.target = random.choice(pool)
        self._render_buttons(pool)
        self._update_meta()
        self.status.config(text="Listen…", fg=theme.FG)
        self.after(350, self.play)

    def _render_buttons(self, pool):
        for child in self.btn_frame.winfo_children():
            child.destroy()
        chars = list(pool)
        random.shuffle(chars)
        columns = 4
        for i, ch in enumerate(chars):
            btn = theme.button(
                self.btn_frame,
                ch,
                lambda c=ch: self.answer(c),
                font=theme.MONO,
                width=3,
            )
            btn.grid(row=i // columns, column=i % columns, padx=6, pady=6)

    def play(self):
        s = self.app.profile["settings"]
        self.app.audio.play_pattern(codes.MORSE[self.target], s["wpm"], s["freq"])

    def answer(self, ch):
        if self.answered:
            return
        self.answered = True
        p = self.app.profile
        if ch == self.target:
            p["receive_streak"] += 1
            if p["receive_streak"] >= STREAK_TO_CLEAR:
                p["receive_streak"] = 0
                if p["receive_level"] < codes.MAX_LEVEL:
                    p["receive_level"] += 1
                    self.status.config(
                        text="Level up! New characters unlocked.", fg=theme.GOOD
                    )
                else:
                    self.status.config(text="All characters mastered!", fg=theme.GOOD)
            else:
                self.status.config(text="Correct!", fg=theme.GOOD)
            self.app.save_profile()
            self._update_meta()
            self.after(750, self.next_round)
        else:
            p["receive_streak"] = max(0, p["receive_streak"] - WRONG_PENALTY)
            self.status.config(
                text=f"It was  {self.target}  ({codes.MORSE[self.target]})",
                fg=theme.BAD,
            )
            self.app.save_profile()
            self._update_meta()
            self.after(1300, self.next_round)

    def _update_meta(self):
        p = self.app.profile
        self.level_lbl.config(text=f"Level {p['receive_level']}")
        self.progress["value"] = p["receive_streak"]
        self.streak_lbl.config(
            text=f"Streak {p['receive_streak']} / {STREAK_TO_CLEAR}"
        )

    def _back(self):
        from ui.main_menu import MainMenu

        self.app.show(MainMenu)
