// Decides the Home dashboard's single "Start Today's Training" action.
// This module only picks *which* screen and pool to open — the existing
// weighted character selection inside ReceivePractice/SendPractice
// (charWeight/pickWeighted in learning.js) is what actually chooses
// characters within that pool, completely unchanged.

import * as codes from "./codes.js";
import { streakToClear } from "./learning.js";
import { tierLetters } from "./weakLetters.js";

export function getRecommendation(profile) {
  const mode = pickMode(profile);
  const level = mode === "receive" ? profile.receive_level : profile.send_level;
  const pool = codes.poolForLevel(level);

  // Same "needs work" definition Home's own stat tile and the Lessons
  // screen use (weakLetters.js) — so the hero card's recommendation and
  // the dashboard's "Needs Attention" number can never disagree.
  const needsWork = tierLetters(profile).needsWork.filter((r) => pool.includes(r.ch));

  if (needsWork.length > 0) {
    const chars = needsWork.map((r) => r.ch);
    return {
      mode,
      lessonChars: chars,
      title: `Practice ${chars.length} Weak Letter${chars.length === 1 ? "" : "s"}`,
      subtitle: `Your weakest right now: ${chars.join(", ")}.`,
      reason: "weak",
    };
  }

  if (level < codes.MAX_LEVEL) {
    return {
      mode,
      lessonChars: null,
      title: `Continue Level ${level}`,
      subtitle: `${pool.length} character${pool.length === 1 ? "" : "s"} unlocked so far — keep going.`,
      reason: "level",
    };
  }

  return {
    mode,
    lessonChars: null,
    title: "Keep Practicing",
    subtitle: "You've unlocked every character. A quick round keeps you sharp.",
    reason: "keep-going",
  };
}

// Alternates between Receive and Send based on whichever mode's current
// streak is furthest from clearing its level, so "Start Today's Training"
// naturally balances both instead of only ever recommending one. Ties
// favor Receive, the more common starting point for new learners.
function pickMode(profile) {
  const receiveProgress = profile.receive_streak / streakToClear(profile.receive_level);
  const sendProgress = profile.send_streak / streakToClear(profile.send_level);
  return sendProgress < receiveProgress ? "send" : "receive";
}

// Opens whichever practice screen a recommendation (from getRecommendation()
// above, or a caller-built object with the same {mode, lessonChars, title}
// shape) points at — shared by Home's "Start Today's Training" and Session
// Summary's "Continue Training" so both buttons behave identically instead
// of each screen duplicating this dispatch.
export function startRecommendedTraining(app, rec, { returnTo = "mainMenu" } = {}) {
  const options = { returnTo };
  if (rec.lessonChars) {
    options.lessonChars = rec.lessonChars;
    options.lessonLabel = rec.title;
  }
  if (rec.mode === "receive") {
    import("./receivePractice.js").then((m) => app.show(m.ReceivePractice, options));
  } else {
    import("./sendPractice.js").then((m) => app.show(m.SendPractice, options));
  }
}
