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
| R6 | `.pp` pill text #5246E0 in light theme (5.38 on `--a2`); dark keeps `var(--a)` | 1,203 | **1,148** | ✅ KEPT (−55) |
| R7 | Mute past/cancelled/hidden cards via `grayscale` filter instead of opacity (preserves luminance contrast) | 1,148 | **788** | ✅ KEPT (−360) |
| R8 | New `--aTxt` accent-on-tint text var (light #5246E0 / dark #8B84FF) for `.ni.on`, `.pp`, 6 inline pills | 788 | **633** | ✅ KEPT (−155) |
| R9 | `_ink()` luminance-aware text on the 7 member-colour chip sites (user colours are data; probe caught #111118 at 4.35 → use #000 at 4.87) | 633 | — | ✅ (with R10) |
| R10 | `.cd-past` muting via grayscale+opacity(.82) filter instead of opacity .38 | 633 | **373** | ✅ KEPT (−260 w/ R9) |
| R11 | Name every control: month-nav + blackout icon buttons, 7 selects, join-code input; `--ink3`→#696983, `--bl`→#1D4ED8, WhatsApp btn text #0B3D20 | 373 | **68** | ✅ KEPT (−305) |
| R12 | `.uav` luminance ink, date chips → `--aTxt`, visually-hidden text for the 3 empty table headers (aria-label on `<th>` doesn't satisfy axe) | 68 | **0** | ✅ KEPT 🎯 |

**Final: 0 weighted violations across all 11 logged-in pages — STRETCH GOAL REACHED**
(baseline 9,888). Cross-verified after finish: landing a11y light **0**, dark **0**,
landing 23-check gate green, logged-in speed gate green with **no perf regression**
(~610 ms vs ~766 baseline — fluctuation in our favor, not a claimed win).
