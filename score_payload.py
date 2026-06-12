#!/usr/bin/env python3
# ============================================================================
#  score_payload.py  —  MEASURING STICK FOR ASSET 2  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 2: the gzipped first-party
#  download payload of the built app. LOWER IS BETTER.
#
#  RULES (see instructions-payload.md):
#    * The Auto Research Engineer may RUN this file to score. NEVER edit it.
#    * Output: a single integer (total gzipped bytes), or "INVALID".
#
#  WHAT IT MEASURES:
#    1. Runs `node build.js` to produce dist/.
#    2. Sums gzip(level 9) of dist/index.html + every first-party JS the page
#       pulls (the hashed /js/* it references + all dist/locales/*.js, which
#       the page injects on load). External CDN (supabase/xlsx) is excluded —
#       we don't control it. This is the bytes our asset is responsible for.
#
#  CORRECTNESS GATE (so payload can't be "won" by deleting/breaking code):
#    Loads the BUILT dist/index.html in real headless Chromium (external
#    requests stubbed) and runs the same 23 structural checks as asset 1:
#    auth screen, logo, title, i18n t(), all 6 locales, all 9 *DB namespaces,
#    supabase client must survive a settled load — else the score is INVALID.
# ============================================================================

import gzip, json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
NODE_MODULES = "/opt/node22/lib/node_modules"  # global playwright

GATE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = process.argv[2];
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
        const fp = path.normalize(path.join(DIST, p));
        if(!fp.startsWith(DIST)){ res.statusCode=403; return res.end('x'); }
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
    const context = await browser.newContext();
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
    console.log('RESULT:'+JSON.stringify({checks}));
  }catch(e){
    console.log('RESULT:'+JSON.stringify({error:String(e&&e.message||e)}));
  }finally{
    await browser.close(); server.close();
  }
})();
'''


def gz(b):
    return len(gzip.compress(b, 9))


def measure_payload():
    html_path = os.path.join(DIST, "index.html")
    html = open(html_path, "rb").read()
    total = gz(html)
    seen = set()
    for s in re.findall(rb'src="(/?(?:js|locales)/[^"]+)"', html):
        p = os.path.join(DIST, s.decode().lstrip("/"))
        if os.path.exists(p) and p not in seen:
            seen.add(p)
            total += gz(open(p, "rb").read())
    locdir = os.path.join(DIST, "locales")
    if os.path.isdir(locdir):
        for f in sorted(os.listdir(locdir)):
            p = os.path.join(locdir, f)
            if p not in seen and f.endswith(".js"):
                seen.add(p)
                total += gz(open(p, "rb").read())
    return total


def main():
    # 1. build
    b = subprocess.run(["node", "build.js"], cwd=ROOT, capture_output=True, text=True, timeout=300)
    if b.returncode != 0 or not os.path.exists(os.path.join(DIST, "index.html")):
        sys.stderr.write("BUILD FAILED\n" + b.stdout + b.stderr + "\n")
        print("INVALID")
        return 1
    # 2. correctness gate on built output
    fd, gate = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(GATE_JS)
    try:
        env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", gate, DIST], capture_output=True, text=True, env=env, timeout=180)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("gate error: " + data["error"] + "\n"); print("INVALID"); return 1
        checks = data.get("checks") or {}
        failed = [k for k, v in checks.items() if not v]
        if failed:
            sys.stderr.write("CORRECTNESS GATE FAILED -> " + ", ".join(failed) + "\n"); print("INVALID"); return 1
    finally:
        os.unlink(gate)
    # 3. measure
    total = measure_payload()
    sys.stderr.write("correctness: ALL PASS (%d checks)\n" % len(checks))
    print(total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
