# Auto Research Engineer — Instructions, ASSET 8 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
The logged-in Ritovo app — where members actually live — should be usable with a
screen reader and readable by everyone. Assets 3/7b fixed the landing page; the
app itself (dashboard, calendar, song library spreadsheet, member lists…) was
never scored and has hundreds of real violations: unlabeled inputs, icon buttons
with no name, low-contrast text, missing landmarks.

One honest number: **impact-weighted axe violations summed across all 11 app
pages** (critical=10, serious=5, moderate=2, minor=1), rendered logged-in with
realistic data. **Lower is better.** Deterministic.

## The Three Files
1. **`instructions-a11y-app.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html` (app markup, render functions, CSS).
3. **`score_a11y_app.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_a11y_app.py)
- Logs in via the asset-5 stub (1 band, 15 members, 60 songs, 20 rehearsals,
  8 concerts, 12 setlists), navigates to each of the 11 pages, runs axe, sums.
- **Gates (INVALID on miss):** dashboard must truly render (loader hidden, app
  visible, band name, 9 `*DB`); every page must navigate and be visible —
  violations cannot be removed by breaking or emptying pages.
- Member colors in the stub include legacy #6C63FF deliberately: user-chosen
  colors are data; the app must render them accessibly (e.g. luminance-aware
  text color), not demand the data change.

## The Rules
1. **One root cause per round** (e.g. "label the sheet inputs", "fix --g/--g2
   contrast") — not one node per round.
2. **Score with `score_a11y_app.py` ONLY.** Deterministic — one run is enough.
3. Keep if the number drops and gates pass; otherwise revert. INVALID = revert.
4. **Real fixes only** — labels, roles, contrast, names. No `aria-hidden` to
   silence content users need, no rule suppression.
5. Color changes: minimal nudges that keep the brand palette recognizable
   (the asset-3 precedent: #6C63FF→#685FF6). Verify light AND dark themes
   (`score_a11y.py` + `score_a11y_dark.py` must stay 0). New visible strings
   (e.g. aria-labels are NOT visible — exempt from i18n; visible text is not).
6. This is minified inline code — verify beyond the gate when editing render
   functions (the asset-5 lesson).
7. **Log every round** in `results_log_a11y_app.md`.

## Done / Stop Conditions
- Human says stop, OR
- Target: **< 500** (≈ −95%); stretch goal 0, OR
- 10 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 9,888 (library alone 6,655) — 2026-06-12._
