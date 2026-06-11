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

**Current baseline: 15** (color-contrast ×3 remaining).
