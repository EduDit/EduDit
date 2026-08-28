"""Send Practice: see a character, key it out with the spacebar or the circle.

A hold shorter than two units is a dot, longer is a dash. After a pause of
about three units (at least 600 ms) with nothing held, the entered pattern is
decoded and checked against the target.
"""

import random
import time
import tkinter as tk

from morse import codes
from ui import theme

STREAK_TO_CLEAR = 10
WRONG_PENALTY = 2
DOT_THRESHOLD_UNITS = 2  # hold >= this many units counts as a dash
DECODE_GAP_UNITS = 3
DECODE_GAP_MIN_MS = 600


class SendPractice(tk.Frame):
    def __init__(self, parent, app):
        super().__init__(parent, bg=theme.BG)
        self.app = app
        self.target = None
        self.pattern = ""
        self.key_down = False
        self.press_time = 0.0
        self.decode_job = None
        self.answered = False
        self._key_bindings = []
        self._build()
        self._bind_keys()
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

        tk.Label(
            self, text="Send this character", font=theme.SMALL, bg=theme.BG, fg=theme.MUTED
        ).pack(pady=(4, 0))
        self.target_lbl = tk.Label(
            self, text="", font=theme.BIG_CHAR, bg=theme.BG, fg=theme.ACCENT
        )
        self.target_lbl.pack(pady=(0, 8))

        # Lit indicator / clickable key.
        self.key_canvas = tk.Canvas(
            self, width=120, height=120, bg=theme.BG, highlightthickness=0
        )
        self.key_circle = self.key_canvas.create_oval(
            12, 12, 108, 108, fill=theme.PANEL, outline=theme.BTN_BG, width=3
        )
        self.key_canvas.pack()
        self.key_canvas.bind("<ButtonPress-1>", self.on_press)
        self.key_canvas.bind("<ButtonRelease-1>", self.on_release)

        tk.Label(
            self,
            text="Hold SPACE or the circle — short = dot, long = dash",
            font=theme.SMALL,
            bg=theme.BG,
            fg=theme.MUTED,
        ).pack(pady=(8, 4))

        self.pattern_lbl = tk.Label(
            self, text=" ", font=theme.MONO, bg=theme.BG, fg=theme.FG
        )
        self.pattern_lbl.pack(pady=8)

        self.status = tk.Label(
            self, text="", font=theme.HEADING, bg=theme.BG, fg=theme.FG
        )
        self.status.pack(pady=6)

        self.streak_lbl = tk.Label(
            self, text="", font=theme.SMALL, bg=theme.BG, fg=theme.MUTED
        )
        self.streak_lbl.pack(pady=(12, 0))

    def _bind_keys(self):
        root = self.app
        self._key_bindings = [
            ("<KeyPress-space>", root.bind("<KeyPress-space>", self.on_press, add="+")),
            (
                "<KeyRelease-space>",
                root.bind("<KeyRelease-space>", self.on_release, add="+"),
            ),
        ]

    def destroy(self):
        if self.decode_job:
            self.after_cancel(self.decode_job)
        for seq, funcid in self._key_bindings:
            try:
                self.app.unbind(seq, funcid)
            except tk.TclError:
                pass
        super().destroy()

    # ---- keying ----------------------------------------------------------
    def _unit_ms(self):
        return 1200.0 / max(1, self.app.profile["settings"]["wpm"])

    def on_press(self, _event=None):
        if self.answered or self.key_down:
            return "break"
        self.key_down = True
        self.press_time = time.time()
        if self.decode_job:
            self.after_cancel(self.decode_job)
            self.decode_job = None
        self.key_canvas.itemconfig(self.key_circle, fill=theme.ACCENT, outline=theme.ACCENT)
        return "break"

    def on_release(self, _event=None):
        if not self.key_down:
            return "break"
        self.key_down = False
        held_ms = (time.time() - self.press_time) * 1000.0
        unit = self._unit_ms()
        symbol = "." if held_ms < DOT_THRESHOLD_UNITS * unit else "-"
        self.pattern += symbol
        self.pattern_lbl.config(text=self.pattern, fg=theme.FG)
        self.key_canvas.itemconfig(
            self.key_circle, fill=theme.PANEL, outline=theme.BTN_BG
        )

        # Brief audible echo of the element just keyed.
        s = self.app.profile["settings"]
        self.app.audio.play_pattern(symbol, s["wpm"], s["freq"])

        gap = max(DECODE_GAP_UNITS * unit, DECODE_GAP_MIN_MS)
        self.decode_job = self.after(int(gap), self.decode)
        return "break"

    # ---- game loop -------------------------------------------------------
    def next_round(self):
        self.answered = False
        self.pattern = ""
        pool = codes.pool_for_level(self.app.profile["send_level"])
        self.target = random.choice(pool)
        self.target_lbl.config(text=self.target)
        self.pattern_lbl.config(text=" ", fg=theme.FG)
        self.status.config(text="", fg=theme.FG)
        self._update_meta()

    def decode(self):
        self.decode_job = None
        if self.answered or not self.pattern:
            return
        self.answered = True
        p = self.app.profile
        guess = codes.char_from_pattern(self.pattern)
        correct_pattern = codes.MORSE[self.target]
        if self.pattern == correct_pattern:
            p["send_streak"] += 1
            if p["send_streak"] >= STREAK_TO_CLEAR:
                p["send_streak"] = 0
                if p["send_level"] < codes.MAX_LEVEL:
                    p["send_level"] += 1
                    self.status.config(
                        text="Level up! New characters unlocked.", fg=theme.GOOD
                    )
                else:
                    self.status.config(text="All characters mastered!", fg=theme.GOOD)
            else:
                self.status.config(text=f"Correct!  {self.pattern}", fg=theme.GOOD)
            self.app.save_profile()
            self._update_meta()
            self.after(900, self.next_round)
        else:
            p["send_streak"] = max(0, p["send_streak"] - WRONG_PENALTY)
            sent = self.pattern + (f" = {guess}" if guess else "")
            self.status.config(
                text=f"You sent {sent}\n{self.target} is {correct_pattern}",
                fg=theme.BAD,
            )
            self.app.save_profile()
            self._update_meta()
            self.after(1600, self.next_round)

    def _update_meta(self):
        p = self.app.profile
        self.level_lbl.config(text=f"Level {p['send_level']}")
        self.streak_lbl.config(text=f"Streak {p['send_streak']} / {STREAK_TO_CLEAR}")

    def _back(self):
        from ui.main_menu import MainMenu

        self.app.show(MainMenu)
