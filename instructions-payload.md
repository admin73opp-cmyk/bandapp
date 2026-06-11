# Auto Research Engineer — Instructions, ASSET 2 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Shrink what a Ritovo user has to **download** to load the app. Smaller payload =
faster loads on slow/mobile connections, less data used, snappier first paint —
especially for the iOS/Android Capacitor shell and first-time visitors.

One honest number: **total gzipped first-party download bytes** (the built
`dist/index.html` + every first-party JS it pulls + the locale files). **Lower is
better.** Gzip size is deterministic, so every reduction is real — no noise.

## The Three Files
1. **`instructions-payload.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `build.js` (primary lever: minify/compress the output) and
   `index.html`. The AI may also minify source `js/*.js` / `locales/*.js` **only
   via the build step** (don't hand-mangle committed source into unreadable blobs
   unless that's the only way; prefer doing it in `build.js` so source stays clean).
3. **`score_payload.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_payload.py)
- Runs `node build.js`, then sums gzip(9) of `dist/index.html` + referenced
  first-party `/js/*` + all `dist/locales/*.js`. External CDN excluded (not ours).
- **Correctness gate:** loads the BUILT `dist/index.html` in real headless Chromium
  and runs the same 23 structural checks as asset 1 (auth screen, logo, title,
  `t()`, 6 locales, 9 `*DB`, supabase). Any miss → **INVALID** → revert. You cannot
  win by deleting scripts or shipping a broken build.

## The Rules
1. **Change ONE thing per round.** One hypothesis, one variation.
2. **Score with `score_payload.py` ONLY.** It's deterministic — one run is enough.
3. **Keep if the number goes down and the gate passes; otherwise revert.**
4. **INVALID = automatic revert.**
5. **Log every round** in `results_log_payload.md`.
6. **Surgical changes** (CLAUDE.md / karpathy-guidelines). Respect all "do not
   rename / do not break" rules. Keep committed source readable where reasonable —
   prefer build-time minification over committing mangled source.
7. Run in ~5-min loops, indefinitely, until the goal is hit or the human stops.

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **gzipped payload < 150,000 bytes** (≈ −29% from 211,089), OR
- 10 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 211,089 gzipped bytes (2026-06-11)._
