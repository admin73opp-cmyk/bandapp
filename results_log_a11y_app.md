# Auto Research Engineer — Results Log, ASSET 8 (logged-in app a11y)

**Asset:** `index.html` · **Metric:** weighted axe violations across 11 logged-in pages
via `score_a11y_app.py` — **lower is better** (deterministic). **Gates:** dashboard +
all 11 pages must render or INVALID.

| Baseline | Score | Date |
|---|---|---|
| Setup baseline | **9,888** | 2026-06-12 |

> Per page at setup: library 6,655 (240 critical unlabeled inputs!) · rehearsals 886 ·
> members 825 · concerts 295 · bandprofile 284 · calendar 262 · dashboard 171 ·
> myprofile 167 · settings 141 · setlists 138 · guestdir 64.
> Contrast root causes (probe): --g on --g2 ×114 · --ink3 ×56 · literal grays ×72 ·
> white on member-color chips ×33 · --a on --a2 ×15 · --amb ×8.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 9,888 | — |
