#!/usr/bin/env python3
# ============================================================================
#  score_i18n.py  —  MEASURING STICK FOR ASSET 7  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 7: the count of MISSING
#  (UI key × locale) translation entries. LOWER IS BETTER (0 = full coverage).
#  Output: integer, or "INVALID".
#
#  RULES (see instructions-i18n.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  HOW IT MEASURES:
#    1. Extracts every UI key used by the app from index.html:
#       data-i18n="..." attributes and t('...') / t("...") calls.
#    2. Evaluates each of the 6 locale files (nl, de, fr, es, it, pt-BR) in
#       Node with a fake `window`, reading the actual translation object.
#    3. Score = sum over locales of app keys absent from that locale.
#
#  ANTI-CHEAT GATES (any miss → INVALID):
#    * index.html must still contain ≥ 385 distinct UI keys — coverage cannot
#      be "won" by deleting UI text. (The asset is the locale files ONLY.)
#    * Every locale file must evaluate cleanly, expose its window.XX object,
#      contain ≥ 749 entries (no deleting existing translations), and every
#      value must be a non-empty string.
#  NOTE: presence ≠ quality. The scorer cannot judge translation quality —
#  the instructions require real translations and a human spot-check.
# ============================================================================

import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
LOCALES = [("nl", "NL"), ("de", "DE"), ("fr", "FR"), ("es", "ES"), ("it", "IT"), ("pt-BR", "PT_BR")]
MIN_APP_KEYS = 385
MIN_LOCALE_ENTRIES = 749


def app_keys():
    h = open(os.path.join(ROOT, "index.html"), encoding="utf-8").read()
    keys = set(re.findall(r'data-i18n="([^"]+)"', h))
    keys |= set(re.findall(r"\bt\('((?:[^'\\]|\\.)+)'\)", h))
    keys |= set(re.findall(r'\bt\("((?:[^"\\]|\\.)+)"\)', h))
    return {k.replace("\\'", "'").replace('\\"', '"') for k in keys}


def locale_entries(loc, var):
    js = (
        "const window = {};"
        + open(os.path.join(ROOT, "locales", loc + ".js"), encoding="utf-8").read()
        + f";\nif (typeof window.{var} !== 'object' || !window.{var}) throw new Error('missing window.{var}');"
        + f"\nprocess.stdout.write(JSON.stringify(window.{var}));"
    )
    fd, tmp = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(js)
    try:
        p = subprocess.run(["node", tmp], capture_output=True, text=True, timeout=30)
        if p.returncode != 0:
            return None, "eval failed: " + p.stderr.strip().splitlines()[-1][:120]
        return json.loads(p.stdout), None
    finally:
        os.unlink(tmp)


def main():
    keys = app_keys()
    if len(keys) < MIN_APP_KEYS:
        sys.stderr.write(f"GATE FAILED: only {len(keys)} app keys in index.html (min {MIN_APP_KEYS}) — UI text was removed?\n")
        print("INVALID")
        return 1
    total_missing = 0
    for loc, var in LOCALES:
        entries, err = locale_entries(loc, var)
        if err:
            sys.stderr.write(f"GATE FAILED: locales/{loc}.js {err}\n"); print("INVALID"); return 1
        if len(entries) < MIN_LOCALE_ENTRIES:
            sys.stderr.write(f"GATE FAILED: locales/{loc}.js has {len(entries)} entries (min {MIN_LOCALE_ENTRIES}) — translations deleted?\n")
            print("INVALID"); return 1
        bad = [k for k, v in entries.items() if not isinstance(v, str) or not v.strip()]
        if bad:
            sys.stderr.write(f"GATE FAILED: locales/{loc}.js has empty/non-string values, e.g. {bad[:3]}\n")
            print("INVALID"); return 1
        missing = sorted(keys - set(entries))
        total_missing += len(missing)
        sys.stderr.write(f"  {loc:6} entries={len(entries):4}  missing={len(missing):3}" +
                         (("  e.g. " + "; ".join(repr(m) for m in missing[:3])) if missing else "") + "\n")
    sys.stderr.write(f"gates: ALL PASS (app keys={len(keys)})\n")
    print(total_missing)
    return 0


if __name__ == "__main__":
    sys.exit(main())
