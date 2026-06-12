# Ritovo — Auto Research Engineer Report
### Overnight run · 7 assets (+1 bonus) · 2026-06-11

> The deal: pick ONE thing, turn "is it good?" into a single honest number, then change it —
> keep what wins, trash what loses, and **never touch or game the measuring stick.**

---

## Scoreboard

| # | Asset | Metric (locked scorer) | Baseline → Best | Result |
|---|---|---|---|---|
| 1 | Landing/auth page | median load ms (`score.py`) | — | **~8% faster, −12.6% size** |
| 2 | Download payload | gzipped bytes (`score_payload.py`) | 211,089 → 197,440 | **−6.5%** |
| 3 | Accessibility (light) | axe violations (`score_a11y.py`) | 25 → **0** | **target hit 🎯** |
| 4 | Invite email | raw bytes (`score_email.py`) | 2,852 → 2,422 | **−15.1%** (all emails) |
| 5 | Logged-in app speed | render ms (`score_applogin.py`) | ~1,137 → ~766 | **−33% (~370ms)** |
| 6 | SEO / social meta | failed checks (`score_seo.py`) | 11 → **0** | **target hit 🎯** |
| 7 | i18n coverage | missing translations (`score_i18n.py`) | 132 → **0** | **target hit 🎯** |
| 7b | Accessibility (dark) | axe violations (`score_a11y_dark.py`) | 10 → **0** | **target hit 🎯** |

Seven constitutions (`instructions*.md`, human-owned), eight locked scorers (read-only to the AI,
each with a correctness/safety gate), seven logs (`results_log*.md`). Everything committed and
pushed to `claude/auto-research-engineer-j3e5jv`. **Five targets fully reached.**

---

## Per-asset rounds

**Asset 1 — landing speed** · *kept 2 of 4*
- ✅ Lazy-load 317KB of locales on `load` · ✅ minify inline JS (terser ×2)
- ❌ `defer` head scripts (metric stubs the network) · ❌ CSS whitespace (below noise)
- Declined "lever B" (defer post-login JS): auth code is tangled in the monolith; the easy
  version would game `loadEventEnd` without improving real time-to-interactive.

**Asset 2 — payload** · *kept all 4*
- ✅ minify locales at build · ✅ minify `js/` at build · ✅ aggressive HTML-minifier opts · ✅ clean-css L2
- Hit the build-level ceiling; bigger gains need locale-structure changes (flagged, not forced).

**Asset 3 — accessibility** · *kept all 3, target reached*
- ✅ `role="main"` landmark · ✅ `role="status"` on toast · ✅ brand purple #6C63FF→#685FF6 (WCAG-AA)
- No rules suppressed, nothing hidden — all real fixes. 25 → 0.

**Asset 4 — invite email** · *kept 1, judged near-optimal*
- ✅ `min()` helper collapsing inter-tag whitespace in the shared layout (−15.1%, benefits every email)
- Already best-practice (no external imgs, inline styles, 36× under Gmail's clip limit).

**Asset 5 — logged-in app speed** · *kept 1 (the big one)*
- ✅ defer off-screen tab renders to `requestIdleCallback`; dashboard paints first (−33%)
- **Caught a measurement bug honestly:** the first realistic dataset gave songs a `name` field,
  but the app renders by `title`+`artist`, so `renderLib` was throwing and the baseline was on a
  broken render. Corrected the data, re-baselined, verified all tabs populate (0 errors), *then*
  measured the win.

**Asset 6 — SEO / social meta** · *kept all 3, target reached*
- ✅ description + canonical · ✅ full Open Graph set + a real 1200×630 brand `og-image.png`
  (rendered from the logomark with sharp) · ✅ twitter:card, theme-color, apple-touch-icon
- First OG render had the brand dot floating loose (serif fallback narrower than Garamond) —
  caught by *looking* at the image, fixed with a font-robust centered layout.

**Asset 7 — i18n coverage** · *kept all 6, target reached*
- ✅ translated 22 previously-missing UI keys into all 6 locales (132 → 0 missing entries)
- Quality is a rule the scorer can't measure → flagged for native spot-check before merge.

**Bonus 7b — dark-theme accessibility** · *kept 1, target reached*
- A probe found asset 3's scorer was light-only; dark mode had 2 serious contrast fails.
- ✅ dark-mode override so primary buttons use a 4.61:1 purple; light theme re-verified (no
  regression). Landing page now WCAG-AA in **both** themes.

---

## Methodology notes (the honest bits)
- **Paired A/B** for timing metrics: absolute ms drifts with machine load, so wins are confirmed by
  scoring baseline vs candidate back-to-back, not by cross-time single numbers.
- **Correctness/safety gates** in every scorer so "faster/smaller" can never mean "broken/deleted":
  a 23-check structural gate (assets 1/2/3/5), a 10-check email-safety gate (asset 4), and for the
  minified-code change (asset 5) an extra out-of-band verification that every deferred tab renders.
- **Integrity:** no scorer was ever edited to score better; round 3 (asset 1) was reverted rather
  than logged as a 585-byte "win"; asset-1 lever B and the asset-5 dataset change were surfaced to
  the human rather than slipped in.

## Open levers (need a human decision / different setup)
- True post-login JS split (asset 1) and locale key-dedup (asset 2) — bigger payoffs, real risk.
- Extend `score.py` to also reward real-network wins (FCP/TTI/HTTP-2) — would make `defer`-class wins count.
- A scheduler/GitHub Action to run the loops truly unattended (this container has no cron).

---
*Branch: `claude/auto-research-engineer-j3e5jv` · all rounds committed with before/after numbers.*
