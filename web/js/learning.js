// Decides when a letter's Morse demonstration (audible hint + highlighted
// key) should play automatically versus being a blind quiz.
//
// Every letter demonstrates itself the first two times it's presented. After
// that the learner is quizzed blind — unless they've missed that letter
// three times in a row, in which case it demonstrates once more as a
// refresher before going blind again.

export const SEEN_THRESHOLD = 2;
export const MISS_STREAK_THRESHOLD = 3;

export function shouldAutoHint(seenCount, missStreak) {
  return seenCount < SEEN_THRESHOLD || missStreak >= MISS_STREAK_THRESHOLD;
}

// How many correct answers in a row clear a level. Early levels are quick;
// later ones (more characters to tell apart) take a longer streak, capped so
// it never becomes a grind.
export const BASE_STREAK_TO_CLEAR = 10;
export const STREAK_TO_CLEAR_STEP = 1;
export const MAX_STREAK_TO_CLEAR = 20;

export function streakToClear(level) {
  const raw = BASE_STREAK_TO_CLEAR + Math.max(0, level - 1) * STREAK_TO_CLEAR_STEP;
  return Math.min(raw, MAX_STREAK_TO_CLEAR);
}

// Weights a character by how often it's missed, so trouble letters come up
// more often than ones the learner already has down. A letter missed every
// time it's shown is up to TROUBLE_WEIGHT_CAP times as likely to be picked as
// one that's never missed.
export const TROUBLE_WEIGHT_CAP = 4;

export function charWeight(seenCount, mistakeCount) {
  const attempts = seenCount || 0;
  const misses = mistakeCount || 0;
  const missRate = attempts > 0 ? Math.min(1, misses / attempts) : 0;
  return 1 + missRate * (TROUBLE_WEIGHT_CAP - 1);
}

// Picks one entry from `pool` at random, weighted by `weightFn(entry)`.
// `rng` is injectable (must return a value in [0, 1)) so callers can test
// the selection deterministically.
export function pickWeighted(pool, weightFn, rng = Math.random) {
  const weights = pool.map(weightFn);
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return pool[Math.floor(rng() * pool.length)];

  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r < 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// Constrains a value to [min, max]. Shared by the various +/- steppers
// (repeats per letter, pause between letters, etc.) so they all clamp the
// same way.
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Ranks a profile's mistake counts worst-first, dropping letters that have
// never been missed. Shared by the main menu's "Weak letters" card and the
// Lessons screen's Weak Point Review section, so both agree on what counts
// as a weak letter.
export function rankedMistakes(mistakes, limit = Infinity) {
  return Object.entries(mistakes || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// How many of the worst letters Weak Point Review pulls in at once — enough
// to be a real drill without diluting in letters that are only mildly shaky.
export const WEAK_REVIEW_POOL_SIZE = 8;

// Per-letter accuracy for one practice mode (Receive or Send), worst-first —
// backs the Scoreboard's letter-by-letter breakdown. Only includes letters
// that have actually been attempted; `order` (typically LEARNING_ORDER) just
// controls tie-break order for letters attempted an equal number of times.
export function accuracyRows(seen, mistakes, order) {
  return order
    .filter((ch) => (seen[ch] || 0) > 0)
    .map((ch) => {
      const attempts = seen[ch] || 0;
      const misses = mistakes[ch] || 0;
      const pct = Math.round(((attempts - misses) / attempts) * 100);
      return { ch, attempts, misses, pct };
    })
    .sort((a, b) => a.pct - b.pct || b.attempts - a.attempts);
}
