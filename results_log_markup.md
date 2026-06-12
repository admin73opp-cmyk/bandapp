# Auto Research Engineer — Results Log, ASSET 10 (markup correctness)

**Asset:** `index.html` · **Metric:** `no-dup-attr` errors + i18n canary misses via
`score_markup.py` — **lower is better, 0 = clean** (deterministic).
**Gate:** 23 structural checks must pass or INVALID.

| Baseline | Score | Date |
|---|---|---|
| Setup baseline | **54** (32 dup-attr + 22 canary) | 2026-06-12 |

> Root cause: 23 elements carry a duplicated `data-i18n` (browser keeps the first,
> so the 2nd/3rd label key never translates) + 1 duplicated `style` (intended
> `display:none` on `#bpAdminActions` ignored). Fix = relocate each key onto the
> child element that should show it; the canary forbids "delete to silence".

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 54 | — |
