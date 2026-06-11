# Auto Research Engineer — Instructions, ASSET 4 (HUMAN-OWNED)

> Locked to the AI: only the human edits this file. The AI reads and obeys it.

## The Goal (plain English)
Keep the Ritovo **invite email** as small and as client-safe as possible, so it
renders reliably everywhere (Gmail, Apple Mail, Outlook), never gets clipped, and
loads instantly. Smaller + safer = better deliverability and first impression.

One honest number: the **raw byte size of the rendered invite email**. **Lower is
better.** (Raw, not gzip — email clients like Gmail's 102KB clip measure raw HTML.)

> Reality check from setup: this asset is already well-built (2,852 bytes, 36× under
> the clip limit, no external images, inline styles, table layout). Headroom is small.

## The Three Files
1. **`instructions-email.md`** (this file) — goal + rules. Human-owned.
2. **THE ASSET** — `supabase/functions/_shared/email.ts` (the shared layout / button /
   escaping used by every transactional email; highest leverage).
3. **`score_email.py`** — the measuring stick. Locked. RUN, never edit.

## The Metric (defined by score_email.py)
- Renders the invite email (emailLayout + a fixed representative body + btn) and
  reports its raw UTF-8 byte length.
- **Email-safety gate:** the rendered HTML must keep the CTA + invite URL, greeting,
  brand mark, footer link, table layout and full-document structure, and must have
  NO `<img>`, NO `<style>`/`<link>`, and stay under 102,400 bytes — else INVALID.
  You cannot win by stripping content or breaking email-client compatibility.

## The Rules
1. **Change ONE thing per round.**
2. **Score with `score_email.py` ONLY.** Deterministic — one run is enough.
3. **Keep if the number goes down and the gate passes; otherwise revert.**
4. **INVALID = automatic revert.**
5. **Keep source readable** (CLAUDE.md / karpathy). Prefer a small helper that
   minifies output over hand-mangling the template into one unreadable line.
6. **Don't sacrifice rendering for bytes.** Email whitespace can affect layout in some
   clients; collapse only inter-tag whitespace, never text-adjacent whitespace. When a
   change could affect rendering, say so — it should be visually verified before merge.
7. **Log every round** in `results_log_email.md`.
8. Run in ~5-min loops until the goal is hit or the human stops.

## Done / Stop Conditions
- Human says stop, OR
- Diminishing returns: 5 consecutive rounds with no kept improvement → pause/report
  (lower threshold than other assets because headroom is known to be small), OR
- Judged already-optimal and safe → declare done.

## Human Notes (edit me)
- _Baseline at setup: 2,852 bytes, 10/10 safety checks — 2026-06-11._
