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
| I1 | Translate the 22 missing keys → Dutch (nl) | 132 | **110** | ✅ KEPT |
| I2 | → German (de) | 110 | **88** | ✅ KEPT |
| I3 | → French (fr) | 88 | **66** | ✅ KEPT |
| I4 | → Spanish (es) | 66 | **44** | ✅ KEPT |
| I5 | → Italian (it) | 44 | **22** | ✅ KEPT |
| I6 | → Brazilian Portuguese (pt-BR) | 22 | **0** | ✅ KEPT |

**Final: 0 missing entries — TARGET REACHED.** Each locale 749 → 771 entries; all gates
pass; browser-verified that all 6 locale objects still load (asset-1 23-check gate green).

> ⚠️ Human spot-check requested before merge (per instructions rule 5): the 132 new
> entries are AI translations. Terminology was matched to each file's existing choices
> ("setlist" untranslated; Song = Nummer/Song/Morceau/Canción/Brano/Música; 'Lead &amp;
> backing' reuses existing 'Lead & backing' values). Judgment calls: 'RSVP' kept as-is in
> NL/DE/FR (common usage) but translated in ES ('Confirmar asistencia'), IT ('Conferma
> presenza'), PT-BR ('Confirmar presença').
