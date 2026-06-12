# Auto Research Engineer — Instructions (HUMAN-OWNED)

> This file is the constitution. It is **locked to the AI**: only the human
> edits it. The AI reads it and obeys it. If a rule here conflicts with
> anything the AI wants to do, this file wins.

## The Goal (plain English)
Make the **Ritovo auth / landing page load faster**. When a new or returning
user opens the app, the first screen they see (sign-in / sign-up) should paint
and finish loading as quickly as possible. Faster first load = fewer bounces,
better first impression, snappier feel on mobile.

We turn "is it fast?" into **one honest number**: the page's `loadEventEnd`
in milliseconds, measured in a real headless Chromium. **Lower is better.**

## The Three Files
1. **`instructions.md`** (this file) — the goal + rules. Human-owned. AI never edits.
2. **`index.html`** — THE ASSET. The only file the AI may change. *(The AI may
   also touch files it directly inlines/removes as part of a load-time change —
   e.g. `js/*.js` or `locales/*.js` — but only in service of the metric, and
   never in a way that breaks the correctness gate. Prefer changing `index.html`.)*
3. **`score.py`** — the measuring stick. Locked. The AI may RUN it but NEVER
   edit it. It defines "better." No moving the goalposts.

## The Metric (defined by score.py — do not restate/alter elsewhere)
- Serves the repo locally, stubs all external CDN/network so we measure the
  document's own parse + render + script cost (the part this asset controls).
- Throttles CPU 4x to lift signal above noise.
- 7 loads, drops the warm-up, reports the **median `loadEventEnd` (ms)**.
- **Correctness gate:** the auth screen, logo, title, `t()`, all 6 locales,
  all 9 `*DB` namespaces and the supabase client must still be present after a
  settled load — otherwise the score is **INVALID** and the variation is thrown
  out. You cannot win by deleting or breaking the page.

## The Rules
1. **Change ONE thing per round.** One hypothesis, one variation.
2. **Score with `score.py` ONLY.** Never eyeball it, never invent a number.
3. **Keep-or-revert by the number:**
   - A variation is **kept** only if it beats the current baseline median AND
     a confirmation re-score also beats the previous baseline (to rule out the
     ~3–4% measurement noise). The kept variation becomes the new baseline.
   - Otherwise **revert** `index.html` to the previous baseline and try a
     different idea.
4. **INVALID = automatic revert.** A broken page never counts, no matter how fast.
5. **Log every round** in `results_log.md`: round #, hypothesis/change,
   score before → after, kept or reverted.
6. **Surgical changes only** (per CLAUDE.md / karpathy-guidelines). No drive-by
   refactors. Respect every "do not rename / do not break" rule in CLAUDE.md
   (e.g. `js/db/bands.js` filename, `bandapp` internal identifiers, UI says
   "Ritovo"/"Group").
7. **Run in ~5-minute loops, overnight, indefinitely**, until the goal is hit
   or the human says stop.

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **median load < 250 ms** (≈ half of the 492.7 ms baseline)
  with all correctness checks passing, OR
- Diminishing returns: 10 consecutive rounds with no kept improvement → pause
  and report.

## Human Notes (edit me)
- _Baseline at setup: 492.7 ms (2026-06-11)._
- _(add any constraints here, e.g. "don't touch the dark-mode CSS", and the AI will obey)_
