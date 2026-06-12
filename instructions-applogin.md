# Auto Research Engineer — Instructions, ASSET 5 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Make the **logged-in dashboard appear faster** after sign-in. When a member opens
Ritovo and is already authenticated, the time from load until they can see and use
their dashboard should be as short as possible. Faster = the app feels instant,
especially on mobile / the Capacitor shell.

One honest number: **ms from navigation until the dashboard is rendered & interactive**
(the `#appLoader` is hidden and `#app` is visible), median of repeated runs.
**Lower is better.**

## The Three Files
1. **`instructions-applogin.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html` (the inline app boot/render code) and, if needed for a
   render-path change, `js/auth.js`.
3. **`score_applogin.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_applogin.py)
- Serves the repo; stubs Supabase **logged-in** (fixed session + seed: one band
  "Demo Band", user as admin, empty lists) so the dashboard renders deterministically.
- CPU throttled 4x; an init-script poller timestamps when the dashboard is ready;
  7 loads, drop warm-up, report the median.
- **Correctness gate:** at ready time the dashboard must really be shown — loader
  hidden, `#app` visible, auth hidden, "Demo Band" present, all 9 `*DB` defined —
  else INVALID. You cannot win by hiding the loader before the app is usable.

## The Rules
1. **Change ONE thing per round.**
2. **Score with `score_applogin.py` ONLY.**
3. Timing drifts with machine load → confirm a win with a **paired A/B** re-score
   (baseline vs candidate back-to-back) before keeping.
4. Keep if it's faster and the gate passes; otherwise revert. INVALID = revert.
5. **Real perceived-speed wins only.** Hiding the loader before the dashboard is
   actually interactive is gaming — the gate guards against it; don't try to dodge it.
6. **Log every round** in `results_log_applogin.md`.
7. **Surgical changes** (CLAUDE.md / karpathy). Respect all "do not rename/break" rules.
8. Run in ~5-min loops until the goal is hit or the human stops.

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **median < 550 ms** (≈ −25% from the 733 ms baseline), OR
- 10 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 733.4 ms (empty seed data) — 2026-06-11._
- _Open question: optimize with empty data (cost = parse+boot, limited fresh headroom),
  or extend the stub to a realistic dataset to expose list-render headroom?_
