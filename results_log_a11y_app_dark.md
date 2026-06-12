# Auto Research Engineer — Results Log, ASSET 9 (logged-in app a11y, dark mode)

**Asset:** `index.html` dark palette · **Metric:** weighted axe violations across 11
logged-in pages in dark mode via `score_a11y_app_dark.py` — **lower is better**.
**Gates:** all 11 pages must render; light scorers must stay 0 after every kept round.

| Baseline | Score | Date |
|---|---|---|
| Setup baseline | **1,400** | 2026-06-12 |

> All color-contrast. Root causes: dark `--ink3` #5A5A78 (2.5–2.8:1) ×233 ·
> white on dark `--a` #8B84FF (3.06) ×36 · white on dark `--bl` #60A5FA (2.54) ×11.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 1,400 | — |
