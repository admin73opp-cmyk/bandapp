#!/usr/bin/env python3
# ============================================================================
#  score_markup.py  —  MEASURING STICK FOR ASSET 10  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 10: real markup-correctness
#  defects in the Ritovo page. LOWER IS BETTER (0 = clean). Output: an
#  integer, or "INVALID".
#
#  RULES (see instructions-markup.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  SCORE = (A) + (B):
#    (A) html-validate `no-dup-attr` errors on the built dist/index.html.
#        Duplicated attributes are unambiguous bugs: the browser keeps only the
#        FIRST, silently dropping the rest (a duplicated data-i18n key never
#        translates; a duplicated style is ignored). Only this rule is scored —
#        the project's inline-style architecture (no-inline-style) and the
#        a11y rules (covered by the axe scorers, already 0) are intentionally
#        NOT counted; no-raw-characters is excluded because it false-flags `&&`
#        in inline JS.
#    (B) i18n canary misses: render the page in Dutch, run applyI18n(), and for
#        each of a FIXED list of UI strings currently orphaned by a duplicated
#        data-i18n, count how many do NOT appear translated in the UI text.
#
#  WHY (B) EXISTS — ANTI-CHEAT:
#    (A) alone could be "won" by DELETING a duplicated data-i18n instead of
#        relocating it to the right child element — the attribute disappears but
#        the label stays English. (B) only drops when the Dutch translation
#        actually reaches the DOM, so deletion does not help: it trades an (A)
#        point for a standing (B) point. Only a correct relocation lowers both.
#
#  STRUCTURAL GATE (INVALID on miss): the same 23 checks as asset 1 — auth
#  screen, logo, title, i18n, 6 locales, 9 *DB, supabase — must pass.
# ============================================================================

import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
NODE_MODULES = "/opt/node22/lib/node_modules"

# Fixed canary list: UI strings currently carried on a duplicated data-i18n.
CANARY = [
 "(cannot be changed here)", "(min. 8 chars)", "(optional)", "+ Add Period",
 "+ Add Photo", "All changes are for this send only.", "Artist",
 "Blackout Periods & Closures", "Check your inbox at",
 "Click it to activate your account, then sign in.", "Country of Residence",
 "Edit the message before sending via", "Email", "Equipment & Gear",
 "First name", "Group Notes", "Group Photos", "Key", "Last name",
 "Main Instrument", "New password", "None", "Notes", "Password", "Secondary",
 "Set Lists", "Set the active date range for", "Specific members",
 "Specific members only", "Time", "Title", "Who does this affect?",
 "Whole group", "and click the link to reset your password.", "blocks everyone",
 "selected people only", "— Select country —", "— Select —",
]

CANARY_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const CANARY = JSON.parse(process.argv[3]);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png'};
function startServer(){
  return new Promise((resolve)=>{
    const server = http.createServer((req,res)=>{
      try{
        let p = decodeURIComponent(req.url.split('?')[0]);
        if(p==='/'||p==='') p='/index.html';
        const fp = path.normalize(path.join(ROOT,p));
        if(!fp.startsWith(ROOT)){res.statusCode=403;return res.end('x');}
        if(!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.statusCode=404;return res.end('nf');}
        res.setHeader('Content-Type',MIME[path.extname(fp)]||'application/octet-stream');
        res.end(fs.readFileSync(fp));
      }catch(e){res.statusCode=500;res.end('err');}
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}
const SUPA_STUB = `(function(){
  function chain(){var target=function(){return chain();};
    return new Proxy(target,{get:function(t,prop){
      if(prop==='then')return function(resolve){resolve({data:{session:null,user:null,subscription:{unsubscribe:function(){}}},error:null,count:0});};
      if(prop==='catch'||prop==='finally')return function(){return chain();};
      if(prop===Symbol.toPrimitive||prop==='toString'||prop==='valueOf')return function(){return '';};
      return chain();},apply:function(){return chain();}});}
  window.supabase={createClient:function(){return chain();}};})();`;
const CORRECTNESS = () => {
  const ok={}; const has=(id)=>!!document.getElementById(id);
  ok.dom_authScreen=has('authScreen'); ok.dom_authTabs=has('auth-tabs');
  ok.dom_app=has('app'); ok.dom_appLoader=has('appLoader');
  ok.dom_logo=!!document.querySelector('.al-logo'); ok.title=document.title==='Ritovo';
  ok.i18n_t=(typeof t==='function');
  ok.loc_NL=(typeof NL==='object'&&!!NL); ok.loc_DE=(typeof DE==='object'&&!!DE);
  ok.loc_FR=(typeof FR==='object'&&!!FR); ok.loc_ES=(typeof ES==='object'&&!!ES);
  ok.loc_IT=(typeof IT==='object'&&!!IT); ok.loc_PT_BR=(typeof PT_BR==='object'&&!!PT_BR);
  ok.db_Bands=(typeof BandsDB==='object'); ok.db_Songs=(typeof SongsDB==='object');
  ok.db_Setlists=(typeof SetlistsDB==='object'); ok.db_Concerts=(typeof ConcertsDB==='object');
  ok.db_Rehearsals=(typeof RehearsalsDB==='object'); ok.db_Members=(typeof MembersDB==='object');
  ok.db_Blackouts=(typeof BlackoutsDB==='object'); ok.db_Changelog=(typeof ChangelogDB==='object');
  ok.db_Rsvp=(typeof RsvpDB==='object');
  ok.supabase_client=(typeof supabase!=='undefined'&&supabase!==null);
  return ok;
};
(async () => {
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ args:['--no-sandbox'] });
  try{
    const context = await browser.newContext({ bypassCSP:true });
    await context.route('**/*',(route)=>{
      const u=route.request().url();
      if(u.startsWith('http://127.0.0.1')||u.startsWith('http://localhost')) return route.continue();
      if(/supabase-js/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:SUPA_STUB});
      if(/xlsx/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:'window.XLSX={};'});
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(url,{waitUntil:'load',timeout:60000});
    await page.waitForTimeout(500);
    const checks = await page.evaluate(CORRECTNESS);
    const misses = await page.evaluate((canary)=>{
      try{ currentUser.lang='nl'; }catch(e){}
      if(typeof applyI18n==='function') applyI18n();
      // UI text only (exclude trailing <script> text)
      // UI text from the WHOLE document (body-level modals included), minus
      // <script>/<style> text. (Corrected 2026-06-12: the earlier snapshot used
      // only #app + #authScreen and so mis-counted correctly-translated
      // body-level modals as misses — a false negative, not a gaming vector.)
      const clone=document.body.cloneNode(true);
      clone.querySelectorAll('script,style').forEach(e=>e.remove());
      const txt=clone.textContent;
      let miss=[];
      for(const k of canary){
        const nl=(window.NL||{})[k];
        if(nl===undefined||nl===k) continue;       // no distinct Dutch → not a usable canary
        if(txt.indexOf(nl)<0) miss.push(k);
      }
      return miss;
    }, CANARY);
    console.log('RESULT:'+JSON.stringify({checks, misses}));
  }catch(e){
    console.log('RESULT:'+JSON.stringify({error:String(e&&e.message||e)}));
  }finally{
    await browser.close(); server.close();
  }
})();
'''


def main():
    # 1. build
    b = subprocess.run(["node", "build.js"], cwd=ROOT, capture_output=True, text=True, timeout=300)
    if b.returncode != 0 or not os.path.exists(os.path.join(DIST, "index.html")):
        sys.stderr.write("BUILD FAILED\n" + b.stdout + b.stderr + "\n"); print("INVALID"); return 1

    # 2. (A) html-validate no-dup-attr on dist
    cfg = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False)
    cfg.write(json.dumps({"extends": [], "rules": {"no-dup-attr": "error"}})); cfg.close()
    out = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False); out.close()
    env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
    with open(out.name, "w") as fh:
        subprocess.run(["npx", "html-validate", "--config", cfg.name, "--formatter", "json",
                        os.path.join(DIST, "index.html")], cwd=ROOT, stdout=fh, stderr=subprocess.DEVNULL, timeout=180)
    try:
        data = json.load(open(out.name))
        dup_attr = sum(len(r["messages"]) for r in data)
    except Exception as e:
        sys.stderr.write("html-validate parse failed: %s\n" % e); print("INVALID"); return 1
    finally:
        os.unlink(cfg.name); os.unlink(out.name)

    # 3. (B) i18n canary + structural gate
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(CANARY_JS)
    try:
        p = subprocess.run(["node", measure, ROOT, json.dumps(CANARY)],
                           capture_output=True, text=True, env=env, timeout=180)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        res = json.loads(lines[-1][len("RESULT:"):])
        if res.get("error"):
            sys.stderr.write("canary error: " + res["error"] + "\n"); print("INVALID"); return 1
        gate = res.get("checks") or {}
        gfail = [k for k, v in gate.items() if not v]
        if gfail:
            sys.stderr.write("STRUCTURAL GATE FAILED -> " + ", ".join(gfail) + "\n"); print("INVALID"); return 1
        misses = res.get("misses") or []
    finally:
        os.unlink(measure)

    sys.stderr.write("no-dup-attr: %d   i18n canary misses: %d %s\n" % (
        dup_attr, len(misses), ("(" + ", ".join(repr(m) for m in misses[:6]) + ("…" if len(misses) > 6 else "") + ")") if misses else ""))
    sys.stderr.write("structural gate: ALL PASS (%d checks)\n" % len(gate))
    print(dup_attr + len(misses))
    return 0


if __name__ == "__main__":
    sys.exit(main())
