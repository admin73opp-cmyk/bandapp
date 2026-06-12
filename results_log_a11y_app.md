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
| R1 | Landmarks: `role=main` on `.mc`, `role=heading` lvl-1 on `#pgT` (sidebar already `<nav>`) | 9,888 | **7,628** | ✅ KEPT (−2,260: all region/landmark/h1 cleared) |
| R2 | aria-label all 14 per-row song-sheet fields (with song-title context) | 7,628 | **2,828** | ✅ KEPT (−4,800: library 6,655 → 151) |
| R3 | `--ink3` #9A9AB0 → #6B6B85 light theme (4.8:1 white, 4.4+ on bg; also fixes opacity-composited grays) | 2,828 | **1,903** | ✅ KEPT (−925) |
| R4 | `--g` #16A34A → #15803D (4.57 on `--g2` tint, 5.02 under white) | 1,903 | **1,288** | ✅ KEPT (−615) |
| R5 | `--amb` #D97706 → #B45309 (5.02 on white) | 1,288 | **1,203** | ✅ KEPT (−85) |
