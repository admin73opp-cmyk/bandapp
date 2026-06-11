# Auto Research Engineer — Results Log, ASSET 5 (logged-in app speed)

**Asset:** `index.html` (inline boot/render) · **Metric:** ms to logged-in dashboard
ready via `score_applogin.py` — **lower is better** (median of 7, CPU throttled 4x).
**Correctness:** dashboard must really render (loader hidden, app visible, auth hidden,
"Demo Band" present, 9 `*DB` defined) or score = INVALID.

| Baseline | Score (ms) | Date |
|---|---|---|
| Setup baseline (empty data) | 733.4 | 2026-06-11 |
| **Re-baseline (realistic data)** | **956.2** | 2026-06-11 |

> Harness: Supabase stubbed logged-in (session + 1 band, user as admin, empty lists).
> The dashboard renders first try, 0 console errors. Use paired A/B for keep decisions
> (timing drifts with machine load).
>
> Finding: with empty seed data the cost is dominated by document parse + app-shell
> construction (already minimized by assets 1 & 2). The logged-in-specific list-render
> cost only appears with a realistic dataset — see the open question in instructions.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline (realistic data: 15 members, 60 songs, 20 rehearsals, 8 concerts, 12 setlists)_ | — | 956.2 | — |
