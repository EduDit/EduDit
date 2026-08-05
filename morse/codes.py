"""Morse code table, learning order, and level helpers."""

# Standard International Morse for A-Z and 0-9.
MORSE = {
    "A": ".-",    "B": "-...",  "C": "-.-.",  "D": "-..",   "E": ".",
    "F": "..-.",  "G": "--.",   "H": "....",  "I": "..",    "J": ".---",
    "K": "-.-",   "L": ".-..",  "M": "--",    "N": "-.",    "O": "---",
    "P": ".--.",  "Q": "--.-",  "R": ".-.",   "S": "...",   "T": "-",
    "U": "..-",   "V": "...-",  "W": ".--",   "X": "-..-",  "Y": "-.--",
    "Z": "--..",
    "0": "-----", "1": ".----", "2": "..---", "3": "...--", "4": "....-",
    "5": ".....", "6": "-....", "7": "--...", "8": "---..", "9": "----.",
}

# Reverse lookup: pattern -> character.
PATTERN_TO_CHAR = {pattern: char for char, pattern in MORSE.items()}

# Characters unlock in this order: letters by shortest pattern first, then digits.
LEARNING_ORDER = list("ETIANMSURWDKGOHVFLPJBXCYZQ") + list("0123456789")

# Each level adds this many new characters to the practice pool.
CHARS_PER_LEVEL = 2

# Highest reachable level (whole pool unlocked).
MAX_LEVEL = len(LEARNING_ORDER) // CHARS_PER_LEVEL


def pool_for_level(level):
    """Return the list of characters unlocked at the given (1-based) level."""
    count = max(1, level) * CHARS_PER_LEVEL
    count = min(count, len(LEARNING_ORDER))
    return LEARNING_ORDER[:count]


def char_from_pattern(pattern):
    """Return the character for a dot/dash pattern, or None if it is not valid."""
    return PATTERN_TO_CHAR.get(pattern)
