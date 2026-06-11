#!/usr/bin/env python3
# ============================================================================
#  score_applogin.py  —  MEASURING STICK FOR ASSET 5  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 5: time (ms) from navigation
#  until the LOGGED-IN dashboard is rendered & interactive (the #appLoader is
#  hidden and #app is visible). LOWER IS BETTER. Output: median ms, or INVALID.
#
#  RULES (see instructions-applogin.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  HOW IT MEASURES (consistent measuring stick):
#    1. Serves the repo locally; stubs Supabase with a LOGGED-IN mock (a fixed
#       session + minimal seed: one band "Demo Band", the user as admin, empty
#       song/rehearsal/etc. lists) so the dashboard renders deterministically.
#    2. CPU throttled 4x to lift render/init cost above the noise.
#    3. An init-script poller records performance.now() the moment the dashboard
#       is ready (#appLoader display:none AND #app visible).
#    4. 7 loads, drop the warm-up, report the MEDIAN.
#
#  CORRECTNESS GATE (so speed can't be "won" by breaking the logged-in app):
#    At ready time the page MUST show the dashboard: #appLoader hidden, #app
#    visible, #authScreen hidden, the band name "Demo Band" present, and all 9
#    *DB namespaces defined. Any miss → INVALID.
# ============================================================================

import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = "/opt/node22/lib/node_modules"

MEASURE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const RUNS = 7, WARMUP = 1, CPU = 4;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};

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

const STUB = `(function(){
  var UID='u-1';
  var SESSION={access_token:'tok',refresh_token:'r',expires_at:9999999999,user:{id:UID,email:'demo@ritovo.app',user_metadata:{first_name:'Demo'},app_metadata:{}}};
  var profile={id:UID,first_name:'Demo',last_name:'User',email:'demo@ritovo.app',initials:'DU',instrument:'Guitar',vocals:'None',availability:[1,1,1,1,1,1,1],color:'#6C63FF',lang:'en'};
  function dataFor(table){
    if(table==='bands') return [{id:'b-1',name:'Demo Band',platforms:[],band_members:[{role:'admin',user_id:UID}]}];
    if(table==='band_members') return [{role:'admin',guest_start:null,guest_end:null,guest_band:null,guest_status:null,user_id:UID,band_id:'b-1',profiles:profile}];
    if(table==='profiles') return [profile];
    return [];
  }
  function qchain(table){
    var state={table:table,single:false};
    function mk(){
      return new Proxy(function(){return mk();},{get:function(t,p){
        if(p==='single'){state.single=true;return function(){return mk();};}
        if(p==='then'){return function(res){var d=dataFor(state.table);res({data:state.single?(d[0]||null):d,error:null,count:d.length});};}
        if(p==='catch'||p==='finally')return function(){return mk();};
        return function(){return mk();};
      }});
    }
    return mk();
  }
  var client={
    auth:{
      getSession:function(){return Promise.resolve({data:{session:SESSION},error:null});},
      getUser:function(){return Promise.resolve({data:{user:SESSION.user},error:null});},
      onAuthStateChange:function(cb){setTimeout(function(){cb('INITIAL_SESSION',SESSION);},0);return {data:{subscription:{unsubscribe:function(){}}}};},
      signInWithPassword:function(){return Promise.resolve({data:{session:SESSION,user:SESSION.user},error:null});},
      signOut:function(){return Promise.resolve({error:null});},
      updateUser:function(){return Promise.resolve({data:{user:SESSION.user},error:null});},
      setSession:function(){return Promise.resolve({data:{session:SESSION},error:null});},
      exchangeCodeForSession:function(){return Promise.resolve({data:{session:SESSION},error:null});},
      resetPasswordForEmail:function(){return Promise.resolve({data:{},error:null});},
      resend:function(){return Promise.resolve({data:{},error:null});}
    },
    from:function(t){return qchain(t);},
    rpc:function(){return Promise.resolve({data:null,error:null});},
    channel:function(){var ch={on:function(){return ch;},subscribe:function(){return ch;},unsubscribe:function(){return ch;}};return ch;},
    removeChannel:function(){},removeAllChannels:function(){},
    storage:{from:function(){return {upload:function(){return Promise.resolve({data:{},error:null});},getPublicUrl:function(){return {data:{publicUrl:''}};},remove:function(){return Promise.resolve({data:{},error:null});}};}}
  };
  window.supabase={createClient:function(){return client;}};
})();`;

const POLLER = `(function(){
  var iv=setInterval(function(){
    var l=document.getElementById('appLoader'), a=document.getElementById('app');
    if(l&&a&&getComputedStyle(l).display==='none'&&getComputedStyle(a).display!=='none'){
      window.__dashReady=performance.now(); clearInterval(iv);
    }
  },8);
  setTimeout(function(){clearInterval(iv);},20000);
})();`;

const CHECK = () => {
  const cs=(el)=>el?getComputedStyle(el):null;
  const l=document.getElementById('appLoader'), a=document.getElementById('app'), au=document.getElementById('authScreen');
  const ok={};
  ok.loaderHidden = !!l && cs(l).display==='none';
  ok.appVisible   = !!a && cs(a).display!=='none';
  ok.authHidden   = !!au && cs(au).display==='none';
  ok.bandName     = document.body.innerText.indexOf('Demo Band')>=0;
  ok.db = (typeof BandsDB==='object'&&typeof SongsDB==='object'&&typeof SetlistsDB==='object'&&typeof ConcertsDB==='object'&&typeof RehearsalsDB==='object'&&typeof MembersDB==='object'&&typeof BlackoutsDB==='object'&&typeof ChangelogDB==='object'&&typeof RsvpDB==='object');
  return ok;
};

async function once(browser, url, withCheck){
  const ctx = await browser.newContext({ bypassCSP:true });
  await ctx.addInitScript(POLLER);
  await ctx.route('**/*',(route)=>{
    const u=route.request().url();
    if(u.startsWith('http://127.0.0.1')||u.startsWith('http://localhost')) return route.continue();
    if(/supabase-js/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:STUB});
    if(/xlsx/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:'window.XLSX={};'});
    return route.abort();
  });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:CPU});
  await page.goto(url,{waitUntil:'load',timeout:60000});
  await page.waitForFunction(()=>typeof window.__dashReady==='number',{timeout:20000});
  const ms = await page.evaluate(()=>window.__dashReady);
  let checks=null;
  if(withCheck){ checks = await page.evaluate(CHECK); }
  await ctx.close();
  return { ms, checks };
}

(async()=>{
  const server=await startServer();
  const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const browser=await chromium.launch({args:['--no-sandbox']});
  try{
    const runs=[]; let checks=null;
    for(let i=0;i<RUNS;i++){ const last=i===RUNS-1; const r=await once(browser,url,last); runs.push(r.ms); if(last)checks=r.checks; }
    const scored=runs.slice(WARMUP).sort((a,b)=>a-b);
    const m=Math.floor(scored.length/2);
    const median=scored.length%2?scored[m]:(scored[m-1]+scored[m])/2;
    console.log('RESULT:'+JSON.stringify({median_ms:median,runs,checks}));
  }catch(e){ console.log('RESULT:'+JSON.stringify({error:String(e&&e.message||e)})); }
  finally{ await browser.close(); server.close(); }
})();
'''


def main():
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(MEASURE_JS)
    try:
        env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", measure, ROOT], capture_output=True, text=True, env=env, timeout=300)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("measure error: " + data["error"] + "\n"); print("INVALID"); return 1
        checks = data.get("checks") or {}
        failed = [k for k, v in checks.items() if not v]
        if failed or not data.get("median_ms"):
            sys.stderr.write("CORRECTNESS GATE FAILED -> " + (", ".join(failed) or "no median") + "\n"); print("INVALID"); return 1
        sys.stderr.write("runs(ms): " + ", ".join(f"{x:.1f}" for x in data["runs"]) + "\n")
        sys.stderr.write("dashboard rendered: ALL PASS (%d checks)\n" % len(checks))
        print(f"{data['median_ms']:.1f}")
        return 0
    finally:
        os.unlink(measure)


if __name__ == "__main__":
    sys.exit(main())
