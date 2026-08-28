// Callsign/QSO Practice: copies real-format callsigns and short exchanges
// by ear — the bridge between recognizing single characters and copying
// real on-air Morse. A peer of Receive/Send/Listen, not a replacement for
// any of them: deliberately uses the full alphabet and digits regardless
// of receive_level, since realistic callsigns need full coverage — framed
// clearly as an optional stretch mode rather than gated progress.

import * as codes from "./codes.js";
import { el, button, pageHeader } from "./dom.js";
import { buildTimeline } from "./farnsworth.js";
import { randomCallsign, randomExchange } from "./callsigns.js";
import { recordActivity } from "./dailyPractice.js";

export class CallsignPractice {
  static navId = "practice";

  constructor(root, app, options = {}) {
    this.root = root;
    this.app = app;
    this.returnTo = options.returnTo || "mainMenu";
    // See the matching field in receivePractice.js — same reasoning.
    this.embedded = !!options.embedded;
    this.contentType = "callsign"; // "callsign" | "exchange"
    this.target = null;
    this.answered = false;
    this.sessionCorrect = 0;
    this.sessionTotal = 0;
    this._timers = [];
    this._visitStart = Date.now();
    this._build();
    this.nextRound();
  }

  _build() {
    const wrap = el("div", { class: this.embedded ? "screen" : "screen view-focused" });

    if (!this.embedded) {
      wrap.appendChild(
        pageHeader({
          eyebrow: "Practice",
          title: "Callsigns",
          actions: [button("Back", () => this.goBack(), "btn-panel btn-block-inline")],
        })
      );
      wrap.appendChild(
        el("p", {
          class: "small muted",
          text: "Practice copying callsigns and short exchanges like you would hear on the air.",
        })
      );
    }
    wrap.appendChild(
      el("p", {
        class: "small muted",
        text:
          "This uses the full alphabet and numbers, beyond what you've unlocked so far — " +
          "an optional stretch mode, not a test.",
      })
    );

    wrap.appendChild(this._tabs());

    this.status = el("p", { class: "heading status center", "aria-live": "polite" });
    wrap.appendChild(this.status);

    wrap.appendChild(button("Replay  ▶", () => this.play(), "btn-accent btn-block"));

    const answerRow = el("div", { class: "entry-row" });
    this.answerInput = el("input", {
      class: "text-input mono",
      type: "text",
      autocomplete: "off",
      autocapitalize: "characters",
      placeholder: "Type what you heard",
      "aria-label": "Your answer",
    });
    this.answerInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.submit();
    });
    answerRow.appendChild(this.answerInput);
    answerRow.appendChild(button("Submit", () => this.submit(), "btn-accent"));
    wrap.appendChild(answerRow);

    this.sessionLbl = el("p", { class: "small muted center" });
    wrap.appendChild(this.sessionLbl);

    this.root.appendChild(wrap);
  }

  _tabs() {
    const tabs = el("div", { class: "tabs" });
    tabs.appendChild(this._tabButton("Callsign", "callsign"));
    tabs.appendChild(this._tabButton("Exchange", "exchange"));
    this.tabsEl = tabs;
    return tabs;
  }

  _tabButton(label, type) {
    const active = this.contentType === type;
    const btn = button(label, () => this._setContentType(type), `tab-btn${active ? " tab-btn-active" : ""}`);
    btn.setAttribute("aria-pressed", String(active));
    return btn;
  }

  _setContentType(type) {
    if (type === this.contentType) return;
    this.contentType = type;
    this.tabsEl.replaceWith(this._tabs());
    this.nextRound();
  }

  nextRound() {
    this.answered = false;
    this.target = this.contentType === "callsign" ? randomCallsign() : randomExchange();
    this.answerInput.value = "";
    this.status.textContent = "";
    this.status.className = "heading status center";
    this._updateSessionLbl();
    this._timers.push(setTimeout(() => this.play(), 350));
    this.answerInput.focus();
  }

  play() {
    const s = this.app.profile.settings;
    const steps = buildTimeline(this.target, codes.MORSE, s.wpm, s.farnsworthWpm);
    this.app.audio.playTimelineAsync(steps, s.freq, s.volume);
  }

  submit() {
    if (this.answered) return;
    const guess = this._normalize(this.answerInput.value);
    if (!guess) return;
    this.answered = true;

    const p = this.app.profile;
    p.callsign_stats = p.callsign_stats || { attempts: 0, correct: 0 };
    p.callsign_stats.attempts += 1;
    this.sessionTotal += 1;

    if (guess === this._normalize(this.target)) {
      p.callsign_stats.correct += 1;
      this.sessionCorrect += 1;
      this._setStatus("Correct!", "good");
      this.app.saveProfile();
      this._updateSessionLbl();
      this._timers.push(setTimeout(() => this.nextRound(), 1000));
    } else {
      this._setStatus(`It was:  ${this.target}`, "bad");
      this.app.audio.playIncorrectCue(p.settings.volume);
      this.app.saveProfile();
      this._updateSessionLbl();
      this._timers.push(setTimeout(() => this.nextRound(), 1800));
    }
  }

  _normalize(text) {
    return text.trim().toUpperCase().replace(/\s+/g, " ");
  }

  _setStatus(text, kind) {
    this.status.textContent = text;
    this.status.className = `heading status center ${kind}`;
    const cls = kind === "good" ? "pulse-good" : "shake-bad";
    this.status.classList.remove(cls);
    void this.status.offsetWidth;
    this.status.classList.add(cls);
  }

  _updateSessionLbl() {
    this.sessionLbl.textContent = `${this.sessionCorrect} / ${this.sessionTotal} correct this session`;
  }

  goBack() {
    if (this.returnTo === "lessons") {
      import("./lessons.js").then((m) => this.app.show(m.Lessons));
    } else {
      import("./mainMenu.js").then((m) => this.app.show(m.MainMenu));
    }
  }

  destroy() {
    for (const t of this._timers) clearTimeout(t);
    this.app.audio.stop();
    recordActivity(this.app.profile, Date.now() - this._visitStart);
    this.app.saveProfile();
  }
}
