# Auto Research Engineer — Results Log, ASSET 4 (invite email size)

**Asset:** `supabase/functions/_shared/email.ts` · **Metric:** raw bytes of the rendered
invite email via `score_email.py` — **lower is better** (deterministic).
**Safety:** 10 email-client checks must pass or score = INVALID.

| Baseline | Score (bytes) | Date |
|---|---|---|
| Setup baseline | **2,852** | 2026-06-11 |

> Already safe at setup: 0 external images · 0 `<style>`/`<link>` · table layout · 36× under
> Gmail's 102KB clip. Known-low headroom (~17% collapsible whitespace).

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 2,852 | — |
