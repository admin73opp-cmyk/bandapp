#!/usr/bin/env python3
# ============================================================================
#  score_a11y_app_dark.py  —  MEASURING STICK FOR ASSET 9  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 8: the impact-weighted count
#  of axe-core accessibility violations across the LOGGED-IN Ritovo app IN
#  DARK MODE — all 11 pages, realistic data. Completes asset 8 (light). LOWER IS BETTER. Output: an
#  integer, or "INVALID".
#
#  RULES (see instructions-a11y-app.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  HOW IT MEASURES:
#    1. Loads the app with the asset-5 logged-in Supabase stub (fixed session,
#       1 band, 15 members, 60 songs, 20 rehearsals, 8 concerts, 12 setlists,
#       5 blackouts) so every page renders realistic content.
#    2. Waits for idle renders, then for EACH page in the FIXED list
#       [dashboard, calendar, rehearsals, concerts, setlists, library,
#        members, guestdir, bandprofile, myprofile, settings]:
#       navigates via nav(), runs axe-core, and sums per violating node:
#       critical=10, serious=5, moderate=2, minor=1.
#    3. Score = total across all 11 pages. Deterministic.
#
#  ANTI-CHEAT GATES (any miss → INVALID):
#    * Dashboard must really render: loader hidden, #app visible, auth hidden,
#      "Demo Band" present, all 9 *DB namespaces defined.
#    * EVERY page in the list must navigate successfully and its pg-<id> div
#      must be visible — violations cannot be removed by breaking pages.
#    * Member colors in the stub include the legacy #6C63FF on purpose:
#      user-chosen colors are DATA; the app must render them accessibly.
# ============================================================================

import json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = "/opt/node22/lib/node_modules"
WEIGHTS = {"critical": 10, "serious": 5, "moderate": 2, "minor": 1, None: 1}

MEASURE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const PAGES = ["dashboard","calendar","rehearsals","concerts","setlists","library","members","guestdir","bandprofile","myprofile","settings"];
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
const STUB = `(function(){
  var UID='u-1';
  var SESSION={access_token:'tok',refresh_token:'r',expires_at:9999999999,user:{id:UID,email:'demo@ritovo.app',user_metadata:{first_name:'Demo'},app_metadata:{}}};
  var profile={id:UID,first_name:'Demo',last_name:'User',email:'demo@ritovo.app',initials:'DU',instrument:'Guitar',vocals:'None',availability:[1,1,1,1,1,1,1],color:'#6C63FF',lang:'en'};
  // Realistic seed: 15 members, 60 songs, 20 rehearsals, 8 concerts, 12 setlists, 5 blackouts.
  var MEMBERS=[]; for(var i=0;i<15;i++){var mid=i===0?UID:'u-'+i;
    MEMBERS.push({role:i===0?'admin':'member',guest_start:null,guest_end:null,guest_band:null,guest_status:null,user_id:mid,band_id:'b-1',
      profiles:{id:mid,first_name:'Member'+i,last_name:'Test',email:'m'+i+'@demo.co',initials:'M'+i,instrument:'Guitar',instrument2:'',vocals:'None',availability:[1,1,1,1,1,1,1],color:'#6C63FF',lang:'en'}});}
  var BANDMEM=MEMBERS.map(function(m){return {role:m.role,user_id:m.user_id};});
  var SONGS=[]; for(var i=1;i<=60;i++)SONGS.push({id:'s'+i,band_id:'b-1',title:'Song '+i,artist:'Artist '+(i%20),name:'Song '+i,duration:'3:'+(10+i%49),notes:'',spotify_url:null,youtube_url:null,apple_url:null,amazon_url:null,lyrics_url:null,sheet_music_url:null});
  var REH=[]; for(var i=1;i<=20;i++)REH.push({id:'r'+i,band_id:'b-1',date:'2026-0'+(1+i%9)+'-1'+(i%9),start_time:'19:00',end_time:'21:00',setlist_id:null});
  var CON=[]; for(var i=1;i<=8;i++)CON.push({id:'c'+i,band_id:'b-1',name:'Gig '+i,date:'2026-1'+(i%2)+'-0'+(1+i%9),concert_setlists:[]});
  var SL=[]; for(var i=1;i<=12;i++)SL.push({id:'sl'+i,band_id:'b-1',name:'Set '+i,created_at:'2026-01-0'+(1+i%9)});
  var BO=[]; for(var i=1;i<=5;i++)BO.push({id:'bo'+i,band_id:'b-1',from_date:'2026-0'+(1+i)+'-01',to_date:'2026-0'+(1+i)+'-05',member_ids:[UID]});
  function dataFor(table){
    switch(table){
      case 'bands': return [{id:'b-1',name:'Demo Band',platforms:[],band_members:BANDMEM}];
      case 'band_members': return MEMBERS;
      case 'profiles': return [profile];
      case 'songs': return SONGS;
      case 'rehearsals': return REH;
      case 'concerts': return CON;
      case 'setlists': return SL;
      case 'blackouts': return BO;
      default: return [];
    }
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
(async () => {
  const server = await startServer();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ args:['--no-sandbox'] });
  try{
    const context = await browser.newContext({ bypassCSP:true, colorScheme:'dark' });
    await context.route('**/*',(route)=>{
      const u=route.request().url();
      if(u.startsWith('http://127.0.0.1')||u.startsWith('http://localhost')) return route.continue();
      if(/supabase-js/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:STUB});
      if(/xlsx/.test(u)) return route.fulfill({status:200,contentType:'text/javascript',body:'window.XLSX={};'});
      return route.abort();
    });
    const page = await context.newPage();
    await page.goto(url,{waitUntil:'load',timeout:60000});
    await page.waitForTimeout(2500); // idle-deferred renders
    const gate = await page.evaluate(()=>{
      const cs=(el)=>el?getComputedStyle(el):null;
      const l=document.getElementById('appLoader'), a=document.getElementById('app'), au=document.getElementById('authScreen');
      const ok={};
      ok.loaderHidden = !!l && cs(l).display==='none';
      ok.appVisible   = !!a && cs(a).display!=='none';
      ok.authHidden   = !!au && cs(au).display==='none';
      ok.bandName     = document.body.innerText.indexOf('Demo Band')>=0;
      ok.db = (typeof BandsDB==='object'&&typeof SongsDB==='object'&&typeof SetlistsDB==='object'&&typeof ConcertsDB==='object'&&typeof RehearsalsDB==='object'&&typeof MembersDB==='object'&&typeof BlackoutsDB==='object'&&typeof ChangelogDB==='object'&&typeof RsvpDB==='object');
      return ok;
    });
    await page.addScriptTag({ content: fs.readFileSync(path.join(ROOT,'node_modules','axe-core','axe.min.js'),'utf8') });
    const results = [];
    for(const p of PAGES){
      const navOk = await page.evaluate((pp)=>{
        try{ if(typeof nav!=='function') return 'no-nav'; nav(pp); }catch(e){ return 'err:'+String(e.message||e).slice(0,80); }
        const div=document.getElementById('pg-'+pp);
        if(!div) return 'no-div';
        if(getComputedStyle(div).display==='none') return 'hidden';
        return true;
      }, p);
      if(navOk!==true){ results.push({page:p, navFail:String(navOk)}); continue; }
      await page.waitForTimeout(250);
      const violations = await page.evaluate(async ()=>{
        const r = await axe.run(document, { resultTypes:['violations'] });
        return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length}));
      });
      results.push({page:p, violations});
    }
    console.log('RESULT:'+JSON.stringify({gate, results}));
  }catch(e){
    console.log('RESULT:'+JSON.stringify({error:String(e&&e.message||e)}));
  }finally{
    await browser.close(); server.close();
  }
})();
'''


def main():
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(MEASURE_JS)
    try:
        env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", measure, ROOT], capture_output=True, text=True, env=env, timeout=420)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("measure error: " + data["error"] + "\n"); print("INVALID"); return 1
        gate = data.get("gate") or {}
        gfail = [k for k, v in gate.items() if not v]
        if gfail:
            sys.stderr.write("GATE FAILED -> " + ", ".join(gfail) + "\n"); print("INVALID"); return 1
        total = 0
        for r in data.get("results") or []:
            if r.get("navFail"):
                sys.stderr.write("GATE FAILED -> page '%s' did not render (%s)\n" % (r["page"], r["navFail"]))
                print("INVALID"); return 1
            score = sum(WEIGHTS.get(v.get("impact"), 1) * int(v.get("nodes", 0)) for v in r["violations"])
            total += score
            sys.stderr.write("  %-12s %4d   %s\n" % (r["page"], score,
                " | ".join("%s x%d %s" % (v["impact"], v["nodes"], v["id"]) for v in r["violations"][:4])))
        sys.stderr.write("gates: ALL PASS (dashboard + 11 pages rendered)\n")
        print(total)
        return 0
    finally:
        os.unlink(measure)


if __name__ == "__main__":
    sys.exit(main())
