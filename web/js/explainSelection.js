// Plain-language explanations for why a character came up — powers an
// always-available, on-demand "Why this character?" control during
// practice. Reads only existing seen/mistake counts; never changes what
// gets selected (charWeight/pickWeighted in learning.js remain the actual
// selection logic, completely unchanged).

import { charWeight } from "./learning.js";

export function explainCharacter(ch, seenCount, mistakeCount) {
  const attempts = seenCount || 0;
  const misses = mistakeCount || 0;

  if (attempts === 0) {
    return `${ch} is a character you haven't practiced yet.`;
  }
  if (charWeight(attempts, misses) > 1.5) {
    return `You're seeing ${ch} more often because you've missed it recently.`;
  }
  if (misses === 0 && attempts >= 3) {
    return `You've got ${ch} down — it won't come up as often now.`;
  }
  return `${ch} comes up about as often as any other unlocked character right now.`;
}
