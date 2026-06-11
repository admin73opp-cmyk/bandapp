# Auto Research Engineer — Instructions, ASSET 6 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
When someone shares Ritovo in WhatsApp, iMessage, Slack, or socials — or Google
crawls it — the link should unfurl with a proper title, description, and brand
image, and crawlers should get complete page metadata. Today the page has almost
none of this, so shared links look bare and search snippets are improvised.

One honest number: **failed checks on a fixed 15-item SEO/social metadata
checklist** (defined in `score_seo.py`). **Lower is better; 0 = fully covered.**

> Honest scope note: this measures "crawlers and link previews get everything
> they need" — a proxy for SEO/share quality. Actual search ranking is not
> measurable in a fast loop and is NOT the metric.

## The Three Files
1. **`instructions-seo.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html` `<head>` metadata, plus any image files the tags
   reference (e.g. `logo/og-image.png`) and, if needed, `build.js` to ship them.
3. **`score_seo.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_seo.py)
- Renders the page in headless Chromium and evaluates 15 fixed checks: title,
  description (50–160 chars), canonical, og:title/description/type/url/image/
  site_name, twitter:card, theme-color, html lang, favicon, apple-touch-icon,
  no noindex.
- **Anti-cheat:** og:image and apple-touch-icon must resolve to REAL raster
  files in this repo (domain stripped, file must exist, non-SVG, minimum size).
  No imaginary URLs.
- **Structural gate:** the same 23 checks as asset 1 must pass or INVALID.

## The Rules
1. **One hypothesis / one change per round.** A coherent tag group (e.g. "the
   Open Graph set") counts as one change.
2. **Score with `score_seo.py` ONLY.** Deterministic — one run is enough.
3. Keep if failures go down and the gate passes; otherwise revert. INVALID = revert.
4. **Truthful content only.** Descriptions must describe the real product
   (Ritovo, music-group management). No keyword stuffing.
5. Canonical/og:url use the live URL `https://bandapp-six.vercel.app`.
   User-visible brand text says "Ritovo" (never "bandapp").
6. **Log every round** in `results_log_seo.md`.
7. Surgical changes per CLAUDE.md / karpathy-guidelines.

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **0 failed checks**, OR
- 5 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 11 failed / 15 — 2026-06-11._
