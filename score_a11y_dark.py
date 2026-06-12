#!/usr/bin/env python3
# ============================================================================
#  score_a11y_dark.py  —  MEASURING STICK FOR ASSET 7-BONUS  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 3: the impact-weighted count
#  of axe-core accessibility violations on the Ritovo landing page IN DARK MODE
#  (colorScheme:'dark'). Complements score_a11y.py (light).
#  LOWER IS BETTER.  Output: a single integer, or "INVALID".
#
#  RULES (see instructions-a11y.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  SCORE = sum over every axe violation node of weight(impact):
#            critical = 10,  serious = 5,  moderate = 2,  minor = 1
#  (Severity-weighted so fixing critical issues counts most; deterministic —
#   axe gives stable results on the rendered page, so one run is enough.)
#
#  CORRECTNESS GATE (so violations can't be "won" by deleting the page):
#    The page must still pass the same 23 structural checks as asset 1
#    (auth screen, logo, title, i18n, 6 locales, 9 *DB, supabase) after a
#    settled load, or the score is INVALID. Fewer elements != better.
# ============================================================================

import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = "/opt/node22/lib/node_modules"  # global playwright

MEASURE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.css':'text/css', '.svg':'image/svg+xml', '.json':'application/json',
  '.ico':'image/x-icon', '.png':'image/png', '.woff2':'font/woff2'
};
function startServer(){
  return new Promise((resolve)=>{
    const server = http.createServer((req,res)=>{
      try{
        let p = decodeURIComponent(req.url.split('?')[0]);
        if(p === '/' || p === '') p = '/index.html';
        const fp = path.normalize(path.join(ROOT, p));
        if(!fp.startsWith(ROOT)){ res.statusCode=403; return res.end('x'); }
        if(!fs.existsSync(fp) || fs.statSync(fp).isDirectory()){ res.statusCode=404; return res.end('nf'); }
        res.setHeader('Content-Type', MIME[path.extname(fp)] || 'application/octet-stream');
        res.end(fs.readFileSync(fp));
      }catch(e){ res.statusCode=500; res.end('err'); }
    });
    server.listen(0,'127.0.0.1',()=>resolve(server));
  });
}
const SUPA_STUB = `(function(){
  function chain(){
    var target=function(){return chain();};
    return new Proxy(target,{
      get:function(t,prop){
        if(prop==='then')return function(resolve){resolve({data:{session:null,user:null,subscription:{unsubscribe:function(){}}},error:null,count:0});};
        if(prop==='catch'||prop==='finally')return function(){return chain();};
        if(prop===Symbol.toPrimitive||prop==='toString'||prop==='valueOf')return function(){return '';};
        return chain();
      },
      apply:function(){return chain();}
    });
  }
  window.supabase={createClient:function(){return chain();}};
})();`;
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
    const context = await browser.newContext({ bypassCSP: true, colorScheme: 'dark' });
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
    // inject axe-core (local) and run
    const axeSrc = fs.readFileSync(path.join(ROOT,'node_modules','axe-core','axe.min.js'),'utf8');
    await page.addScriptTag({ content: axeSrc });
    const violations = await page.evaluate(async () => {
      const r = await axe.run(document, { resultTypes:['violations'] });
      return r.violations.map(v => ({ id:v.id, impact:v.impact, nodes:v.nodes.length }));
    });
    console.log('RESULT:'+JSON.stringify({ checks, violations }));
  }catch(e){
    console.log('RESULT:'+JSON.stringify({ error:String(e&&e.message||e) }));
  }finally{
    await browser.close(); server.close();
  }
})();
'''

WEIGHTS = {"critical": 10, "serious": 5, "moderate": 2, "minor": 1, None: 1}


def main():
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(MEASURE_JS)
    try:
        env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", measure, ROOT], capture_output=True, text=True, env=env, timeout=240)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("measure error: " + data["error"] + "\n"); print("INVALID"); return 1
        checks = data.get("checks") or {}
        failed = [k for k, v in checks.items() if not v]
        if failed:
            sys.stderr.write("CORRECTNESS GATE FAILED -> " + ", ".join(failed) + "\n"); print("INVALID"); return 1
        violations = data.get("violations") or []
        score = sum(WEIGHTS.get(v.get("impact"), 1) * int(v.get("nodes", 0)) for v in violations)
        for v in sorted(violations, key=lambda v: -WEIGHTS.get(v.get("impact"), 1) * int(v.get("nodes", 0))):
            sys.stderr.write("  %-9s x%-3d %s\n" % (v.get("impact"), v.get("nodes"), v.get("id")))
        sys.stderr.write("correctness: ALL PASS (%d checks)\n" % len(checks))
        print(score)
        return 0
    finally:
        os.unlink(measure)


if __name__ == "__main__":
    sys.exit(main())
