"""Shared colors and fonts (Catppuccin-ish dark palette)."""

BG = "#1e1e2e"
PANEL = "#181825"
FG = "#cdd6f4"
MUTED = "#9399b2"
ACCENT = "#89b4fa"
GOOD = "#a6e3a1"
BAD = "#f38ba8"
BTN_BG = "#313244"
BTN_ACTIVE = "#45475a"

FONT = ("Segoe UI", 12)
SMALL = ("Segoe UI", 10)
TITLE_FONT = ("Segoe UI", 24, "bold")
HEADING = ("Segoe UI", 16, "bold")
MONO = ("Consolas", 22, "bold")
BIG_CHAR = ("Consolas", 64, "bold")


def button(parent, text, command, **kwargs):
    """A consistently styled flat button."""
    import tkinter as tk

    opts = dict(
        text=text,
        command=command,
        font=FONT,
        bg=BTN_BG,
        fg=FG,
        activebackground=BTN_ACTIVE,
        activeforeground=FG,
        relief="flat",
        bd=0,
        padx=14,
        pady=8,
        cursor="hand2",
    )
    opts.update(kwargs)
    return tk.Button(parent, **opts)
