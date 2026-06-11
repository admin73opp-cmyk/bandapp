# Auto Research Engineer — Instructions, ASSET 3 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Make the Ritovo landing/auth page **more accessible** — usable by people relying on
screen readers, keyboard navigation, and sufficient colour contrast. Better
accessibility = more users served, fewer barriers, and smoother App Store / WCAG review.

One honest number: the **impact-weighted count of axe-core accessibility violations**
on the rendered landing page. **Lower is better.** Deterministic — one run is enough.

## The Three Files
1. **`instructions-a11y.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html` (the markup/ARIA/contrast lives here).
3. **`score_a11y.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_a11y.py)
- Loads the page in headless Chromium, runs axe-core, and sums per violating node:
  **critical = 10, serious = 5, moderate = 2, minor = 1.**
- **Correctness gate:** the page must still pass the same 23 structural checks as
  asset 1 (auth screen, logo, title, i18n, 6 locales, 9 `*DB`, supabase) after a
  settled load, or the score is **INVALID**. You cannot win by deleting content —
  fewer elements is not "more accessible."

## The Rules
1. **Change ONE thing per round.** One hypothesis, one variation.
2. **Score with `score_a11y.py` ONLY.** Deterministic — one run is enough.
3. **Keep if the number goes down and the gate passes; otherwise revert.**
4. **INVALID = automatic revert.**
5. **Real fixes only.** Improve actual accessibility (contrast, landmarks, labels,
   roles, alt text, focus order). Do NOT suppress/exclude rules or hide content to
   dodge axe — that games the metric without helping users.
6. **Log every round** in `results_log_a11y.md`.
7. **Surgical changes** (CLAUDE.md / karpathy-guidelines). Keep UI text "Ritovo"/"Group";
   never rename internal identifiers; respect the brand colours in `:root` — adjust the
   specific failing colours minimally rather than restyling the app.
8. Run in ~5-min loops, indefinitely, until the goal is hit or the human stops.

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **weighted score = 0** (no axe violations on the landing page), OR
- 10 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 25 (serious color-contrast ×3, moderate region ×5) — 2026-06-11._
