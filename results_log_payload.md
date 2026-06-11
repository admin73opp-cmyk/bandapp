# Auto Research Engineer — Results Log, ASSET 2 (payload size)

**Asset:** `build.js` (+ `index.html`) · **Metric:** gzipped first-party download bytes via
`score_payload.py` — **lower is better** (deterministic, no noise).
**Correctness:** 23 browser checks on the built output must pass or score = INVALID.

| Baseline | Score (gzip bytes) | Date |
|---|---|---|
| Setup baseline | **211,089** | 2026-06-11 |

> Breakdown at setup: index.html 98,994 · 6 locales ~93,000 (copied raw!) · js ~19,000.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 211,089 | — |
