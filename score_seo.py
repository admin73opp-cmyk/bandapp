#!/usr/bin/env python3
# ============================================================================
#  score_seo.py  —  MEASURING STICK FOR ASSET 6  (LOCKED)
# ============================================================================
#  Defines the ONE number we optimize for asset 6: the count of FAILED checks
#  on a fixed 15-item SEO / social-share metadata checklist for the Ritovo
#  landing page. LOWER IS BETTER (0 = fully covered). Output: integer or
#  "INVALID".
#
#  RULES (see instructions-seo.md):
#    * The Auto Research Engineer may RUN this file. NEVER edit it.
#
#  WHAT IT MEASURES (the fixed checklist — page rendered in real Chromium):
#     1. <title> present, 5–70 chars
#     2. meta[name=description] present, 50–160 chars
#     3. link[rel=canonical] absolute https URL
#     4. og:title present
#     5. og:description present
#     6. og:type present
#     7. og:url absolute https URL
#     8. og:image absolute https URL AND resolves to a real raster file in
#        this repo (path after the domain must exist, non-SVG, ≥ 5 KB)
#     9. og:site_name present
#    10. twitter:card is "summary" or "summary_large_image"
#    11. meta[name=theme-color] present (valid #hex)
#    12. <html lang> set
#    13. favicon link present
#    14. apple-touch-icon link present AND resolves to a real PNG in this
#        repo (≥ 1 KB)
#    15. no meta robots noindex
#
#  ANTI-CHEAT:
#    * Image checks verify the referenced file EXISTS in the repo (domain
#      stripped, path resolved locally) — pointing at imaginary URLs fails.
#    * The same 23-check structural gate as asset 1 must pass (auth screen,
#      logo, title, i18n, locales, *DB, supabase) or the score is INVALID —
#      meta tags can't be "fixed" by breaking the page.
# ============================================================================

import json, os, re, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
NODE_MODULES = "/opt/node22/lib/node_modules"

MEASURE_JS = r'''
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon','.png':'image/png'};
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
const META = () => {
  const q=(s)=>document.querySelector(s);
  const c=(s)=>{const el=q(s);return el?(el.getAttribute('content')||''):null;};
  return {
    title: document.title||'',
    description: c('meta[name="description"]'),
    canonical: (q('link[rel="canonical"]')||{}).href||null,
    ogTitle: c('meta[property="og:title"]'),
    ogDescription: c('meta[property="og:description"]'),
    ogType: c('meta[property="og:type"]'),
    ogUrl: c('meta[property="og:url"]'),
    ogImage: c('meta[property="og:image"]'),
    ogSiteName: c('meta[property="og:site_name"]'),
    twitterCard: c('meta[name="twitter:card"]'),
    themeColor: c('meta[name="theme-color"]'),
    htmlLang: document.documentElement.getAttribute('lang'),
    favicon: !!q('link[rel="icon"],link[rel="shortcut icon"]'),
    appleTouch: (q('link[rel="apple-touch-icon"]')||{}).getAttribute ? (q('link[rel="apple-touch-icon"]')||{getAttribute:()=>null}).getAttribute('href') : null,
    robots: c('meta[name="robots"]')
  };
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
    await page.waitForTimeout(400);
    const checks = await page.evaluate(CORRECTNESS);
    const meta = await page.evaluate(META);
    console.log('RESULT:'+JSON.stringify({checks, meta}));
  }catch(e){
    console.log('RESULT:'+JSON.stringify({error:String(e&&e.message||e)}));
  }finally{
    await browser.close(); server.close();
  }
})();
'''


def repo_file_for(url):
    """Map an absolute https URL to a repo-local file path (domain stripped)."""
    m = re.match(r"https://[^/]+(/.*)$", url or "")
    if not m:
        return None
    rel = m.group(1).lstrip("/")
    p = os.path.normpath(os.path.join(ROOT, rel))
    if not p.startswith(ROOT) or not os.path.isfile(p):
        return None
    return p


def main():
    fd, measure = tempfile.mkstemp(suffix=".cjs")
    with os.fdopen(fd, "w") as f:
        f.write(MEASURE_JS)
    try:
        env = dict(os.environ); env["NODE_PATH"] = NODE_MODULES
        p = subprocess.run(["node", measure, ROOT], capture_output=True, text=True, env=env, timeout=180)
        lines = [l for l in p.stdout.splitlines() if l.startswith("RESULT:")]
        if not lines:
            sys.stderr.write(p.stdout + "\n" + p.stderr + "\n"); print("INVALID"); return 1
        data = json.loads(lines[-1][len("RESULT:"):])
        if data.get("error"):
            sys.stderr.write("measure error: " + data["error"] + "\n"); print("INVALID"); return 1
        gate = data.get("checks") or {}
        gfail = [k for k, v in gate.items() if not v]
        if gfail:
            sys.stderr.write("CORRECTNESS GATE FAILED -> " + ", ".join(gfail) + "\n"); print("INVALID"); return 1
        m = data.get("meta") or {}

        https_abs = lambda u: bool(u) and bool(re.match(r"https://[^/]+", u))
        og_img_file = repo_file_for(m.get("ogImage"))
        og_img_ok = (https_abs(m.get("ogImage")) and og_img_file is not None
                     and not og_img_file.lower().endswith(".svg")
                     and os.path.getsize(og_img_file) >= 5120)
        at_file = repo_file_for(m.get("appleTouch")) if https_abs(m.get("appleTouch")) else (
            os.path.isfile(os.path.join(ROOT, (m.get("appleTouch") or "").lstrip("/"))) and
            os.path.join(ROOT, (m.get("appleTouch") or "").lstrip("/")) or None)
        at_ok = (m.get("appleTouch") is not None and at_file is not None and isinstance(at_file, str)
                 and at_file.lower().endswith(".png") and os.path.getsize(at_file) >= 1024)

        checklist = {
            "title_5_70": 5 <= len(m.get("title") or "") <= 70,
            "description_50_160": m.get("description") is not None and 50 <= len(m["description"]) <= 160,
            "canonical_https": https_abs(m.get("canonical")),
            "og_title": bool(m.get("ogTitle")),
            "og_description": bool(m.get("ogDescription")),
            "og_type": bool(m.get("ogType")),
            "og_url_https": https_abs(m.get("ogUrl")),
            "og_image_real_raster": og_img_ok,
            "og_site_name": bool(m.get("ogSiteName")),
            "twitter_card_valid": (m.get("twitterCard") or "") in ("summary", "summary_large_image"),
            "theme_color_hex": bool(re.match(r"^#[0-9a-fA-F]{3,8}$", m.get("themeColor") or "")),
            "html_lang": bool(m.get("htmlLang")),
            "favicon": bool(m.get("favicon")),
            "apple_touch_icon_real_png": at_ok,
            "no_noindex": "noindex" not in (m.get("robots") or ""),
        }
        failed = [k for k, v in checklist.items() if not v]
        for k in checklist:
            sys.stderr.write(("  PASS " if checklist[k] else "  FAIL ") + k + "\n")
        sys.stderr.write("structural gate: ALL PASS (%d checks)\n" % len(gate))
        print(len(failed))
        return 0
    finally:
        os.unlink(measure)


if __name__ == "__main__":
    sys.exit(main())
