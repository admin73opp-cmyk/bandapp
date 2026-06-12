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
| P4 | clean-css level 2 (structural CSS merging) | 197,475 | **197,440** | ✅ kept (−35, marginal — CSS already tight) |

### Build-level ceiling reached (after P4)
Meaningful wins were P1 (locales −5.1KB) + P2 (js −8.4KB). P3/P4 are tens of bytes — the
HTML/CSS were already minified. **Cumulative: 211,089 → 197,440 gz (−13,649 / −6.5%), gate
23/23 every round.** Remaining levers need a human decision (out of "surgical" scope):
  • **Concatenate the 6 locales into one file** so gzip dedupes shared structure: tested
    = −3,781 gz (−1.9%), but needs a fragile build-time rewrite of the locale injector.
  • **Dedupe the English keys across locales** (store keys once, values per language):
    potentially much larger, but an i18n data-format + i18n.js refactor whose translation
    correctness the gate can't fully verify.
  • Both are the asset-2 equivalent of asset-1's "lever B" — bigger payoff, real risk.

| P5 | **Lever B — locale key-dedup** (build emits one `dist/locales/all.<hash>.js`: shared English keys once + 6 value arrays reconstructing `window.XX`; injector rewritten to load it) | 200,761* | **160,602** | ✅ KEPT (−40,159 / −20.0%) |

*P5 "before" reflects interim growth from asset 6 (SEO tags) + asset 10 (i18n/markup) on top of the 197,440 asset-2 close.

### Lever B landed (the parked big win)
Locale wire bytes 91,072 → 50,180 gz (−45% of locales): the English keys — ~half of each
file and identical across languages — were repeated 6× in separate files (gzip's 32KB window
can't dedup across files). Now stored once. **Source `locales/*.js` and `i18n.js` are UNCHANGED**
(human-editable objects, all source-based scorers untouched); only the built output ships the
deduped file. Verified in dist: all 4,632 key-values across 6 languages reconstruct byte-identical
to source (0 mismatches), `t()` correct, payload gate 23/23.

**Current baseline: 160,602 gz bytes.** Cumulative vs original: 211,089 → 160,602 = **−50,487 (−23.9%)**.
