# Auto Research Engineer — Instructions, ASSET 10 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Fix real markup bugs in `index.html`. A probe found two genuine defect classes
hiding under the (intentional) inline-style architecture:
1. **Duplicated attributes.** The browser keeps only the FIRST and silently drops
   the rest. 23 elements carry a duplicated `data-i18n`, so a label's second/third
   translation key is never applied — those strings stay English in ALL six
   languages despite being in the locale files (this silently undermines asset 7).
   One element has a duplicated `style`, so its intended `display:none` is ignored.
2. These are correctness bugs, not style preferences.

One honest number: **`no-dup-attr` errors + i18n canary misses** (see scorer).
**Lower is better; 0 = clean.** Deterministic.

## The Three Files
1. **`instructions-markup.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `index.html`.
3. **`score_markup.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_markup.py)
- (A) `html-validate` `no-dup-attr` count on built `dist/index.html`. ONLY this
  rule — the inline-style architecture (CLAUDE.md) and the a11y rules (already 0
  via the axe scorers) are deliberately not counted.
- (B) i18n canary: render in Dutch, run `applyI18n()`, count fixed orphaned
  strings whose Dutch translation does not reach the UI.
- **Anti-cheat:** (B) is why deleting a duplicated `data-i18n` (instead of moving
  it onto the right child) does not help — you trade an (A) point for a (B) point.
- **Structural gate:** the 23 asset-1 checks must pass or INVALID.

## The Rules
1. **Fix correctly, don't delete.** Relocate each `data-i18n` onto the specific
   child element (`<label>`, hint `<span>`, header cell…) that should display it,
   so the string actually translates. Removing a key to silence the validator is
   forbidden (and the canary will catch it).
2. One coherent group of elements per round; score after each; keep/revert by the
   number; INVALID = revert.
3. Don't regress other assets: after kept rounds, the i18n-coverage scorer and the
   four a11y scorers must stay at their targets, and visible English text must not
   change (only WHERE the existing `data-i18n` keys live).
4. Surgical edits per CLAUDE.md; preserve the "Ritovo"/"Group" UI wording and all
   internal identifiers.
5. Log every round in `results_log_markup.md`.

## Done / Stop Conditions
Human stop, OR **0**, OR 5 rounds with no kept improvement.

## Human Notes (edit me)
- _Baseline at setup: 54 (32 no-dup-attr + 22 canary misses) — 2026-06-12._
