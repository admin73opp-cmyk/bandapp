#!/usr/bin/env python3
# ============================================================================
#  score_email.py  —  MEASURING STICK FOR ASSET 4  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 4: the raw byte size of the
#  rendered Ritovo invite email. LOWER IS BETTER. Output: an integer, or
#  "INVALID".  (Raw bytes, because email clients — notably Gmail's 102KB clip
#   — measure raw HTML, not gzip.)
#
#  RULES (see instructions-email.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  HOW IT MEASURES:
#    Renders the invite email by importing _shared/email.ts (emailLayout/btn/h)
#    via Node type-stripping and wrapping a fixed, representative invite body.
#    Reports len(html.encode('utf-8')).
#
#  EMAIL-SAFETY GATE (so size can't be "won" by breaking the email):
#    The rendered HTML MUST:
#      - render without error
#      - contain the CTA button with the invite URL + its label
#      - contain the recipient greeting and the "ritovo" brand mark
#      - contain the footer link to the app
#      - use table-based layout (<table>) and be a full doc (<!doctype/<body/</html>)
#      - have NO external images (<img), NO <style>/<link> (clients strip them)
#      - stay under Gmail's 102,400-byte clip limit
#    Any miss → INVALID.
# ============================================================================

import os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
EMAIL_TS = os.path.join(ROOT, "supabase", "functions", "_shared", "email.ts")

# Fixed, representative invite body (mirrors invite-member/index.ts buildInviteEmail).
RENDERER = r'''
import { emailLayout, btn, h } from %s;
const body = `<h1 style="margin:0 0 16px;font-size:22px;color:#1a1a2e">Hi Alex,</h1>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#3a3a4a"><strong>${h('Sam')}</strong> has invited you to join <strong>${h('The Night Owls')}</strong> on Ritovo — the band management app for rehearsals, setlists and gigs.</p>
${btn('Accept Invitation →','https://bandapp-six.vercel.app/invite?token=abc123')}`;
const html = emailLayout({ appUrl:'https://bandapp-six.vercel.app', body, footer:'You received this because an admin of The Night Owls invited you.' });
process.stdout.write(html);
'''


def main():
    fd, rend = tempfile.mkstemp(suffix=".mjs")
    with os.fdopen(fd, "w") as f:
        f.write(RENDERER % ("'" + EMAIL_TS.replace("\\", "/") + "'"))
    try:
        p = subprocess.run(["node", "--experimental-strip-types", rend],
                           capture_output=True, text=True, timeout=60)
        if p.returncode != 0 or not p.stdout:
            sys.stderr.write("RENDER FAILED\n" + p.stderr[-800:] + "\n")
            print("INVALID")
            return 1
        html = p.stdout
    finally:
        os.unlink(rend)

    raw = len(html.encode("utf-8"))
    checks = {
        "cta_url": "invite?token=abc123" in html,
        "cta_label": "Accept Invitation" in html,
        "greeting": "Hi Alex," in html,
        "brand": "ritovo" in html,
        "footer_link": "bandapp-six.vercel.app" in html,
        "table_layout": "<table" in html,
        "full_doc": ("<!doctype" in html.lower()) and ("<body" in html.lower()) and ("</html>" in html.lower()),
        "no_external_img": len(re.findall(r"<img", html, re.I)) == 0,
        "no_style_link": len(re.findall(r"<style|<link", html, re.I)) == 0,
        "under_gmail_clip": raw < 102400,
    }
    failed = [k for k, v in checks.items() if not v]
    if failed:
        sys.stderr.write("EMAIL-SAFETY GATE FAILED -> " + ", ".join(failed) + "\n")
        print("INVALID")
        return 1
    sys.stderr.write("safety: ALL PASS (%d checks)\n" % len(checks))
    print(raw)
    return 0


if __name__ == "__main__":
    sys.exit(main())
