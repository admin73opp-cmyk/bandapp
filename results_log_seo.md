# Auto Research Engineer — Results Log, ASSET 6 (SEO / social meta)

**Asset:** `index.html` `<head>` (+ referenced image files) · **Metric:** failed checks on
the fixed 15-item checklist via `score_seo.py` — **lower is better, 0 = done** (deterministic).
**Gates:** images must be real repo files; 23 structural checks must pass or INVALID.

| Baseline | Failed checks | Date |
|---|---|---|
| Setup baseline | **11 / 15** | 2026-06-11 |

> Passing at setup: title, html lang, favicon, no-noindex. Missing: description, canonical,
> all 6 Open Graph tags, twitter:card, theme-color, apple-touch-icon.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 11 | — |
| S1 | Add meta description (138 chars) + canonical | 11 | **9** | ✅ KEPT |
| S2 | Full Open Graph set + generate real brand og-image.png (1200×630, sharp from logomark/wordmark; first render had a font-fallback misalignment — caught by eyeballing, fixed with text-anchor=middle layout) | 9 | **3** | ✅ KEPT |
| S3 | twitter:card, theme-color (#685FF6, matches a11y-fixed brand purple), apple-touch-icon (180×180 PNG from logomark-dark, flattened) | 3 | **0** | ✅ KEPT |

**Final: 0 failed checks — TARGET REACHED** (deterministic, confirmed twice; gate 23/23).

> Cross-asset note: the new tags cost +378 gz bytes on asset 2's payload metric
> (197,440 → 197,818, +0.19%) — a legitimate trade, crawlers need this content.
> Both images verified shipping in dist/logo/ via build.js.
