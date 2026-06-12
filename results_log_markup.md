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
| M1 | Clean relocations: `.ch` headers (`.ct`+button), `.fr` First/Last labels, `<option>` placeholders (Country/Instrument/affect), + fix duplicated `style` on `#bpAdminActions` (display:none now wins) | 54 | 42 | ✅ KEPT |
| M2 | Span-wrap label words + hint spans (Password/New password/Email/Secondary/Gear/Notes×2), paragraph splits around `<strong>` (confirm/reset/invite/guest), legend `<strong>`+text, and **fixed wrong keys** on the "Links & Social" header (was `data-i18n="Set Lists"`) | 42 | 19→**10*** | ✅ KEPT |
| ⟂ | **Scorer correction (committed separately):** canary now snapshots body-level `.mod` modals (was #app+#authScreen only). Symmetric — pre-asset-10 baseline re-measures **54 → 48** under the corrected scorer; cannot enable gaming. *M2 re-reads 10 under corrected scorer. | — | — | — |
| M3 | Relocate the 10 table-header keys onto each `<th>` (slTbl + myBody), strip from `#vMain` / overflow wrapper | 10 | **0** | ✅ KEPT 🎯 |
| +i18n | Added `'(all optional)'` to all 6 locales (the one new key M2 introduced) so the asset-7 coverage scorer stays at 0 | — | — | ✅ |

**Final: 0 — TARGET REACHED.** 32 duplicated attributes removed, all orphaned strings now
translate (verified by the Dutch canary), and `#bpAdminActions` is correctly hidden by default.

> Corrected baseline is **48** (the original scorer over-counted 6 body-level-modal canaries).
> Cross-verified after finish, all green: i18n coverage 0, the four a11y scorers 0 (light+dark,
> landing+app), and the landing/logged-in structural gates pass. No visible English text changed —
> only WHERE the existing `data-i18n` keys live (+ one corrected key + one new locale entry).
