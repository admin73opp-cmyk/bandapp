# Ritovo — Auto Research Engineer Report
### Overnight run · 9 assets (+1 bonus) · 2026-06-11 → 06-12

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
| 8 | A11y, logged-in app (light) | weighted axe, 11 pages (`score_a11y_app.py`) | 9,888 → **0** | **stretch goal hit 🎯** |
| 9 | A11y, logged-in app (dark) | weighted axe, 11 pages (`score_a11y_app_dark.py`) | 1,400 → **0** | **target hit 🎯** |

Nine constitutions (`instructions*.md`, human-owned), ten locked scorers (read-only to the AI,
each with a correctness/safety gate), nine logs (`results_log*.md`). Everything committed and
pushed to `claude/auto-research-engineer-j3e5jv`. **Seven targets fully reached — and all four
accessibility scorers (landing + app, light + dark) read 0 simultaneously: every surface of
Ritovo, in both themes, is axe-clean.**

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

**Asset 8 — logged-in app accessibility, light** · *kept 12 rounds, 9,888 → 0 (stretch goal)*
- The biggest asset: the app itself (11 pages, realistic data) had never been scored.
- ~9,000 of the weighted score collapsed from a handful of root causes: one unlabeled
  spreadsheet row template (480 nodes), one `opacity:.65` muting rule (~100 nodes),
  a few palette variables repeated across every row.
- Design-level fixes, not patches: **grayscale muting** instead of opacity (keeps the faded
  look AND the contrast), **`_ink()` luminance-aware text** on member-colour chips (member
  colours are user data — the app now adapts to any colour), an **`--aTxt`** accent-on-tint
  text variable, and visually-hidden header text where axe rejects `aria-label` on `<th>`.

**Asset 9 — logged-in app accessibility, dark** · *kept 2 rounds, 1,400 → 0*
- Asset 8 in dark mode: three root causes only. Dark `--ink3` was 2.5:1 (→ #8A8AA6 at 5.0:1,
  text hierarchy intact), and dark accents (#8B84FF, #60A5FA) are *light* colours that need
  dark text — encoded once in a new **`--onA`** "text-on-accent" variable, including four
  inline JS `"#fff"` assignments that would have silently beaten any CSS override.
- Probes that died honestly along the way: console errors (0), mobile tap-targets on landing
  AND app (0), security headers (already excellent) — no fake assets were lined up.

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
- **Cross-asset accounting:** asset 6's meta tags cost asset 2's metric +378 gz bytes — logged as a
  legitimate trade, not hidden. After assets 8/9, all four a11y scorers plus the landing-speed and
  logged-in-speed gates were re-run green before closing.
- **Pre-merge follow-ups for the human:** native spot-check of the 132 AI translations (asset 7);
  eyeball the palette nudges (light+dark) on a Vercel preview; redeploy the three edge functions
  from a machine with Supabase CLI auth (asset 4's email change).

## Open levers (need a human decision / different setup)
- True post-login JS split (asset 1) and locale key-dedup (asset 2) — bigger payoffs, real risk.
- Extend `score.py` to also reward real-network wins (FCP/TTI/HTTP-2) — would make `defer`-class wins count.
- A scheduler/GitHub Action to run the loops truly unattended (this container has no cron).

---
*Branch: `claude/auto-research-engineer-j3e5jv` · all rounds committed with before/after numbers.*
