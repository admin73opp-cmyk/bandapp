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
| P1 | Minify locale files at build (terser, mangle off) | 211,089 | **205,943** | ✅ KEPT (−5,146 / −2.4%) |
| P2 | Minify `js/` files at build (terser compress, mangle off) | 205,943 | **197,544** | ✅ KEPT (−8,399 / −4.1%) |
| P3 | Aggressive html-minifier opts (removeComments, sortAttrs/Class, etc.) | 197,544 | **197,475** | ✅ kept (−69, marginal — HTML already tight) |

**Current baseline: 197,475 gz bytes.** Cumulative: −13,614 (−6.5%).
