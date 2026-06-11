# Ritovo — Auto Research Engineer Report
### Run 1 · Asset: auth/landing page load time · 2026-06-11

---

## The deal
Pick ONE thing, turn "is it good?" into a single honest number, then change it all
night — keep what wins, trash what loses, never touch the measuring stick.

| | |
|---|---|
| **Asset optimized** | `index.html` (Ritovo auth / landing page) |
| **Metric (locked `score.py`)** | median `loadEventEnd` in headless Chromium — **lower is better** |
| **Fairness controls** | local server · external CDN stubbed · CPU throttled 4× · 7 loads, median |
| **Anti-cheat** | 23-check correctness gate — auth screen, logo, i18n, all 9 `*DB`, locales, supabase must survive, or the run scores **INVALID** |

---

## Rounds

| # | Hypothesis / change | Result | Kept? |
|---|---|---|---|
| 0 | baseline | original `index.html` (506,771 B) | — |
| 1 | `defer` on the 10 `<head>` scripts | no gain (metric stubs the network) | ❌ revert |
| 2 | **Lazy-load 317 KB of locale tables on `load`** | off the critical path | ✅ **keep** |
| 3 | Collapse inline `<style>` whitespace | 585 B — below noise floor | ❌ revert |
| 4 | **Minify 4 inline JS blocks — terser, semantics-only** | −38.6 KB (−12.9% JS) | ✅ **keep** |
| 5 | **terser `compress` + mangle locals (globals preserved)** | −22.6 KB more | ✅ **keep** |
| B | Lazy-load post-login app code | scoped → not safely/honestly tractable | ⏹ declined |

**3 wins kept · 2 losers reverted · 1 big lever investigated and walked away from.**

---

## Total improvement (paired A/B, drift-controlled)

| | Before | After | Δ |
|---|---|---|---|
| First-load time | ~517 ms | ~476 ms | **≈ −8%** |
| Document size | 506,771 B | 442,662 B | **−64,109 B (−12.6%)** |
| Correctness | — | 23/23 every round | ✅ |

> Absolute ms drifts with machine load, so mid-run I switched from single scores to
> **paired A/B** (score baseline and candidate back-to-back, repeat) — the honest arbiter.

---

## Integrity notes (what I refused to do)
- Never edited `score.py` or `instructions.md`.
- Reverted round 3 instead of logging a 585-byte "win."
- **Declined lever B's easy path**: deferring the 215 KB app block would have improved
  the *number* more than real time-to-interactive (the scorer stubs the network) — a
  metric-game — and the auth code is tangled into the monolith, so a clean split isn't
  surgical here. Banked the honest ~8% instead.

## Next legitimate levers (need a human decision / different setup)
1. **Live-backend test env** → unlocks the true post-login split (biggest remaining win).
2. **`build.js` minify step** for external `js/` files → smaller, safe gain.
3. **Evolve `score.py`** to also reward real-network wins (FCP / TTI / HTTP-2) — the one
   change that would make `defer`-class optimizations count. Owner's call, never mine.

---
*Branch: `claude/auto-research-engineer-j3e5jv` · all rounds committed & pushed · `results_log.md` has the full play-by-play.*
