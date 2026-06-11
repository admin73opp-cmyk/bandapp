# Auto Research Engineer — Instructions, ASSET 7 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Non-English members (Dutch, German, French, Spanish, Italian, Brazilian-Portuguese)
should never see raw English fall-through strings in the Ritovo UI. CLAUDE.md
already mandates that every UI string exists in all 6 locale files — this asset
closes the gap between that rule and reality.

One honest number: the **count of missing (UI key × locale) translation entries**.
**Lower is better; 0 = full coverage.** Deterministic.

## The Three Files
1. **`instructions-i18n.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — the 6 locale files in `locales/` ONLY (`nl de fr es it pt-BR`).
   `index.html` is explicitly NOT the asset: coverage must never be improved by
   removing UI text.
3. **`score_i18n.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_i18n.py)
- Extracts every UI key from `index.html` (`data-i18n` + `t()` calls), evaluates
  each locale file in Node, counts app keys absent from each locale, sums.
- **Anti-cheat gates (INVALID on miss):** index.html must keep ≥ 385 distinct
  keys (no deleting UI text); every locale must evaluate cleanly with ≥ 749
  entries (no deleting existing translations) and only non-empty string values.

## The Rules
1. **One change per round** — one locale file per round is the natural unit.
2. **Score with `score_i18n.py` ONLY.** Deterministic — one run is enough.
3. Keep if the count drops and gates pass; otherwise revert. INVALID = revert.
4. **Real translations only.** The scorer can only check presence, not quality —
   so quality is a RULE, not a metric: translations must be faithful, match the
   existing terminology in each file (e.g. "setlist" stays untranslated,
   nl "Nummer" / fr "Morceau" / it "Brano" for Song), and preserve any
   placeholders/HTML entities. Copy-pasting English as the "translation" to
   game presence is forbidden (except where the term is genuinely identical,
   e.g. "RSVP" in NL/DE/FR).
5. **Human spot-check before merge.** The AI translates; a native or fluent
   reader should skim the new entries before this reaches production.
6. **Log every round** in `results_log_i18n.md`.
7. Match each file's existing style (quoting, escaping, section comments).

## Done / Stop Conditions
- Human says stop, OR
- Target reached: **0 missing entries**, OR
- 5 consecutive rounds with no kept improvement → pause and report.

## Human Notes (edit me)
- _Baseline at setup: 132 missing (22 keys × 6 locales) — 2026-06-11._
