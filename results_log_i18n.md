# Auto Research Engineer — Results Log, ASSET 7 (i18n coverage)

**Asset:** `locales/{nl,de,fr,es,it,pt-BR}.js` ONLY · **Metric:** missing (key × locale)
entries via `score_i18n.py` — **lower is better, 0 = done** (deterministic).
**Gates:** index.html keys ≥ 385 (no deleting UI text); each locale ≥ 749 entries,
valid JS, non-empty strings.

| Baseline | Missing entries | Date |
|---|---|---|
| Setup baseline | **132** (22 keys × 6 locales) | 2026-06-11 |

> The 22 missing keys range from form hints ('(optional)', '(min. 8 chars)') to whole
> sentences ('Permission denied — only group admins can link concerts'). Terminology
> anchors taken from existing entries: "setlist" untranslated; Song = nl Nummer /
> de Song / fr Morceau / es Canción / it Brano / pt Música; 'Lead &amp; backing'
> reuses the existing 'Lead & backing' translations.

---

## Rounds

| # | Hypothesis / change | Before | After | Kept? |
|---|---|---|---|---|
| — | _baseline established_ | — | 132 | — |
