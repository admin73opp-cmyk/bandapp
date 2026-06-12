# Auto Research Engineer — Instructions, ASSET 9 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Complete the accessibility story: asset 8 made the logged-in app axe-clean in
light mode; dark-mode users (the OS default for many) still get ~230 low-contrast
text nodes. Make the dark theme WCAG-AA across all 11 app pages.

One honest number: **impact-weighted axe violations across all 11 logged-in pages
in dark mode** (`colorScheme:'dark'`), same weights as asset 8. **Lower is better.**

## The Three Files
1. **`instructions-a11y-app-dark.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html` (the dark-theme palette + dark overrides).
3. **`score_a11y_app_dark.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric / Gates
Identical to asset 8 (same stub, same 11 pages, same weights, same
must-render gates) but with dark color scheme. INVALID on any page failing.

## The Rules
1. One root cause per round; score with the locked scorer only; keep/revert by
   the number; INVALID = revert.
2. **Both themes must stay clean:** after every kept round, `score_a11y_app.py`
   (light) must still be 0 and the landing scorers (light+dark) must stay 0.
3. Minimal same-hue palette nudges; respect the dark design's text hierarchy
   (`--ink` > `--ink2` > `--ink3` must remain visually distinct).
4. Real fixes only; no suppression. Surgical changes per CLAUDE.md.
5. Log every round in `results_log_a11y_app_dark.md`.

## Done / Stop Conditions
Human stop, OR **0 violations**, OR 5 rounds with no kept improvement.

## Human Notes (edit me)
- _Baseline at setup: 1,400 (all color-contrast: dark --ink3 ×233, white-on---a ×36, white-on---bl ×11) — 2026-06-12._
