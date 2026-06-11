#!/usr/bin/env python3
# ============================================================================
#  score.py  —  THE OBJECTIVE MEASURING STICK  (LOCKED)
# ============================================================================
#  This file defines the ONE number we optimize: the auth/landing page's
#  load time in milliseconds, measured in a real headless Chromium.
#
#  RULES (see instructions.md):
#    * The Auto Research Engineer may RUN this file to score the asset.
#    * The Auto Research Engineer must NEVER edit this file. The definition
#      of "better" is frozen here. No moving the goalposts.
#    * LOWER IS BETTER. Output is a single float (ms), or the literal
#      string "INVALID" if the page failed the correctness gate.
#
#  HOW IT MEASURES (consistent, repeatable measuring stick):
#    1. Serves the repo over a local HTTP server (no real internet).
#    2. Stubs ALL external requests (Supabase / XLSX CDN, etc.) with tiny
#       local fakes, so we measure THIS document's parse+render+script cost
#       — the part the asset controls — not CDN/network weather.
#    3. Throttles CPU 4x so parse/eval differences rise above the noise.
#    4. Loads the page 7 times, discards the 1st (warm-up), and reports the
#       MEDIAN of `loadEventEnd` from the Navigation Timing API.
#
#  CORRECTNESS GATE (so speed can't be "won" by deleting the page):
#    After a fully-settled load, the page MUST still contain the auth
#    screen, logo, title, the i18n t() helper, all 6 locale tables, all 9
#    *DB namespaces, and the supabase client. If any are missing -> INVALID.
# ============================================================================

import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = "/opt/node22/lib/node_modules"   # global playwright lives here

MEASURE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const RUNS = 7;
const WARMUP = 1;
const CPU_THROTTLE = 4;

const MIME = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml',
  '.json':'application/json', '.ico':'image/x-icon', '.png':'image/png',
  '.jpg':'image/jpeg', '.webp':'image/webp', '.woff2':'font/woff2', '.woff':'font/woff'
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
    server.listen(0, '127.0.0.1', ()=> resolve(server));
  });
}

// Permissive Supabase stub: createClient() returns a Proxy that answers any
// property access with another chainable Proxy, and resolves (when awaited)
// to a realistic { data:{...}, error:null } shape so the app initialises
// without throwing — no real network involved.
const SUPA_STUB = `(function(){
  function chain(){
    var target = function(){ return chain(); };
    return new Proxy(target, {
      get: function(t, prop){
        if(prop === 'then') return function(resolve){
          resolve({ data:{ session:null, user:null, subscription:{ unsubscribe:function(){} } }, error:null, count:0 });
        };
        if(prop === 'catch' || prop === 'finally') return function(){ return chain(); };
        if(prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') return function(){ return ''; };
        return chain();
      },
      apply: function(){ return chain(); }
    });
  }
  window.supabase = { createClient: function(){ return chain(); } };
})();`;

async function setupRoutes(context){
  await context.route('**/*', (route)=>{
    const url = route.request().url();
    if(url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) return route.continue();
    if(/supabase-js/.test(url)) return route.fulfill({ status:200, contentType:'text/javascript', body:SUPA_STUB });
    if(/xlsx/.test(url))        return route.fulfill({ status:200, contentType:'text/javascript', body:'window.XLSX={};' });
    return route.abort();
  });
}

const CORRECTNESS = () => {
  const ok = {};
  const has = (id) => !!document.getElementById(id);
  ok.dom_authScreen = has('authScreen');
  ok.dom_authTabs   = has('auth-tabs');
  ok.dom_app        = has('app');
  ok.dom_appLoader  = has('appLoader');
  ok.dom_logo       = !!document.querySelector('.al-logo');
  ok.title          = document.title === 'Ritovo';
  ok.i18n_t         = (typeof t === 'function');
  ok.loc_NL = (typeof NL==='object'&&!!NL); ok.loc_DE=(typeof DE==='object'&&!!DE);
  ok.loc_FR = (typeof FR==='object'&&!!FR); ok.loc_ES=(typeof ES==='object'&&!!ES);
  ok.loc_IT = (typeof IT==='object'&&!!IT); ok.loc_PT_BR=(typeof PT_BR==='object'&&!!PT_BR);
  ok.db_Bands=(typeof BandsDB==='object'); ok.db_Songs=(typeof SongsDB==='object');
  ok.db_Setlists=(typeof SetlistsDB==='object'); ok.db_Concerts=(typeof ConcertsDB==='object');
  ok.db_Rehearsals=(typeof RehearsalsDB==='object'); ok.db_Members=(typeof MembersDB==='object');
  ok.db_Blackouts=(typeof BlackoutsDB==='object'); ok.db_Changelog=(typeof ChangelogDB==='object');
  ok.db_Rsvp=(typeof RsvpDB==='object');
  ok.supabase_client=(typeof supabase!=='undefined'&&supabase!==null);
  return ok;
};

async function measureOnce(browser, base, url, withChecks){
  const context = await browser.newContext();
  await setupRoutes(context);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE });
  await page.goto(url, { waitUntil:'load', timeout:60000 });
  const ms = await page.evaluate(()=>{
    const n = performance.getEntriesByType('navigation')[0];
    return n ? n.loadEventEnd : (performance.timing.loadEventEnd - performance.timing.navigationStart);
  });
  let checks = null;
  if(withChecks){
    await page.waitForTimeout(400); // let any async/deferred init settle
    checks = await page.evaluate(CORRECTNESS);
  }
  await context.close();
  return { ms, checks };
}

(async () => {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://127.0.0.1:${port}/index.html`;
  const browser = await chromium.launch({ args:['--no-sandbox'] });
  try{
    const runs = [];
    let checks = null;
    for(let i=0;i<RUNS;i++){
      const last = (i === RUNS-1);
      const r = await measureOnce(browser, port, url, last);
      runs.push(r.ms);
      if(last) checks = r.checks;
    }
    const scored = runs.slice(WARMUP).sort((a,b)=>a-b);
    const mid = Math.floor(scored.length/2);
    const median = scored.length % 2 ? scored[mid] : (scored[mid-1]+scored[mid])/2;
    console.log('RESULT:' + JSON.stringify({ median_ms: median, runs, checks }));
  }catch(e){
    console.log('RESULT:' + JSON.stringify({ error: String(e && e.message || e) }));
  }finally{
    await browser.close();
    server.close();
  }
})();
'''


def main():
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(MEASURE_JS)
    try:
        env = dict(os.environ)
        env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", measure, ROOT],
                           capture_output=True, text=True, env=env, timeout=300)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n")
            print("INVALID")
            return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("measure error: " + data["error"] + "\n")
            print("INVALID")
            return 1
        checks = data.get("checks") or {}
        failed = [k for k, v in checks.items() if not v]
        if failed or not data.get("median_ms"):
            sys.stderr.write("CORRECTNESS GATE FAILED -> " + (", ".join(failed) or "no median") + "\n")
            print("INVALID")
            return 1
        sys.stderr.write("runs(ms): " + ", ".join(f"{x:.1f}" for x in data["runs"]) + "\n")
        sys.stderr.write("correctness: ALL PASS (%d checks)\n" % len(checks))
        print(f"{data['median_ms']:.1f}")
        return 0
    finally:
        os.unlink(measure)


if __name__ == "__main__":
    sys.exit(main())
