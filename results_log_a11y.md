# Auto Research Engineer — Results Log, ASSET 3 (accessibility)

**Asset:** `index.html` · **Metric:** impact-weighted axe-core violations via
`score_a11y.py` — **lower is better** (deterministic). **Correctness:** 23 structural
checks must pass or score = INVALID.

| Baseline | Score | Date |
|---|---|---|
| Setup baseline | **25** | 2026-06-11 |

> Breakdown at setup: serious `color-contrast` ×3 (=15) · moderate `region` ×5 (=10).

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 25 | — |
| A1 | Add `role="main"` to auth card wrapper (landmark) | 25 | **17** | ✅ KEPT (−8, region ×5→×1) |
| A2 | Add `role="status"` aria-live to `#toast` | 17 | **15** | ✅ KEPT (−2, region cleared) |
| A3 | Darken light-theme `--a` #6C63FF→#685FF6 (4.31→4.61 vs white) | 15 | **0** | ✅ KEPT (−15, all 3 contrast fixed) |

**Current baseline: 0 — TARGET REACHED** (zero axe violations on the landing page).

> A3 note: `--a` is the brand primary. #685FF6 is a 4% darkening — visually the same purple
> but WCAG-AA compliant (4.61:1 on white). Applied to both light-theme declarations; dark
> theme (#8B84FF) untouched. Trivial to revert if you prefer the exact original hex.


---

## Dark-theme bonus (asset 7 follow-up) — scorer: `score_a11y_dark.py`

A probe found asset 3's light-only scorer had missed dark mode. Added a sibling locked
scorer (`score_a11y_dark.py` = `score_a11y.py` with `colorScheme:'dark'`).

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _dark-mode baseline_ | — | 10 | — |
| AD1 | Dark-mode override: primary buttons (`.btn-p`, `.stb.on`) use #685FF6 bg (white text 4.61:1) | 10 | **0** | ✅ KEPT |

> Dark `--a` (#8B84FF) is intentionally light (it's also accent text on dark bg), so white-on-#8B84FF
> buttons were 3.06:1. Couldn't darken `--a` globally without breaking accents — so the override
> targets only the button background, in both dark paths (OS-preference + explicit `data-theme=dark`).
> **Light theme re-verified 0 (no regression).** Landing page now WCAG-AA in BOTH themes.
