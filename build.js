#!/usr/bin/env node
// Content-hash build script — no npm dependencies required.
// Hashes every file under js/, copies them with the hash in the filename,
// rewrites <script src="js/..."> references in index.html, and copies
// locales/ as-is. Output goes to dist/.

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const { minify } = require('html-minifier-terser');
const { minify: minifyJS } = require('terser');

const OUT = 'dist';

function sha8(filePath) {
  return crypto.createHash('sha256')
    .update(fs.readFileSync(filePath))
    .digest('hex')
    .slice(0, 8);
}

function findJs(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...findJs(full));
    else if (e.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

// ── Clean output ────────────────────────────────────────────
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// ── Minify + hash + copy JS files ───────────────────────────
const fileMap = {}; // 'js/auth.js' → 'js/auth.a1b2c3d4.js'

(async () => {
  for (const file of findJs('js')) {
    const rel    = file.replace(/\\/g, '/');          // normalise on Windows too
    const dir    = path.dirname(rel);
    const base   = path.basename(rel, '.js');
    let code = fs.readFileSync(file, 'utf8');
    // mangle toplevel OFF so const BandsDB / function names referenced from
    // the inline app code (across files) keep their names.
    try {
      const r = await minifyJS(code, { compress: true, mangle: { toplevel: false }, format: { comments: false } });
      if (r.code) code = r.code;
    } catch (err) { console.error('  js minify skip', rel, err.message); }
    const h      = crypto.createHash('sha256').update(code).digest('hex').slice(0, 8);
    const hashed = `${dir}/${base}.${h}.js`;
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
    fs.writeFileSync(path.join(OUT, hashed), code);
    fileMap[rel] = hashed;
    console.log(`  ${rel} → ${hashed}`);
  }

  // ── Rewrite index.html (hash-bust external js/ refs) ────────
  let html = fs.readFileSync('index.html', 'utf8');
  for (const [orig, hashed] of Object.entries(fileMap)) {
    // src="js/auth.js"  →  src="/js/auth.a1b2c3d4.js"
    html = html.split(`src="${orig}"`).join(`src="/${hashed}"`);
  }

  // ── Locales: dedupe shared keys into ONE built file ─────────
  // Source locales/*.js stay human-editable `window.XX = {...}` objects. For the
  // build we eval them, store each English key ONCE, and ship one minified
  // dist/locales/all.<hash>.js that reconstructs all six window.XX objects from
  // a shared key list + per-language value arrays (0 = "absent" → keeps t()'s
  // English fallback). The wire payload drops a lot because the keys — ~half of
  // each file and identical across languages — are no longer repeated 6×.
  if (fs.existsSync('locales')) {
    const LOC = [['nl','NL'],['de','DE'],['fr','FR'],['es','ES'],['it','IT'],['pt-BR','PT_BR']];
    const objs = {};
    for (const [f, v] of LOC) {
      const w = {};
      new Function('window', fs.readFileSync(`locales/${f}.js`, 'utf8'))(w);
      objs[v] = w[v] || {};
    }
    // union of all keys (NL order first, then any extras), stable
    const KEYS = [], seen = new Set();
    for (const [, v] of LOC) for (const k of Object.keys(objs[v])) if (!seen.has(k)) { seen.add(k); KEYS.push(k); }
    const J = (x) => JSON.stringify(x);
    let all = `(function(){var K=${J(KEYS)};function b(V){var o={};for(var i=0;i<K.length;i++){if(V[i]!==0)o[K[i]]=V[i]}return o}`;
    for (const [, v] of LOC) {
      const vals = KEYS.map(k => (k in objs[v] ? objs[v][k] : 0));
      all += `window.${v}=b(${J(vals)});`;
    }
    all += '})();';
    try {
      const r = await minifyJS(all, { compress: true, mangle: true, format: { comments: false } });
      if (r.code) all = r.code;
    } catch (err) { console.error('  locale dedupe minify skip:', err.message); }
    const lh = crypto.createHash('sha256').update(all).digest('hex').slice(0, 8);
    fs.mkdirSync(path.join(OUT, 'locales'), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'locales', `all.${lh}.js`), all);
    console.log(`  locales/*.js → dist/locales/all.${lh}.js (deduped, ${KEYS.length} keys)`);

    // rewrite the lazy-load injector to fetch the single deduped file
    const INJ_OLD = '<script>addEventListener("load",function(){["nl","fr","es","de","it","pt-BR"].forEach(function(e){var n=document.createElement("script");n.src="locales/"+e+".js",document.head.appendChild(n)})});</script>';
    const INJ_NEW = `<script>addEventListener("load",function(){var n=document.createElement("script");n.src="/locales/all.${lh}.js",document.head.appendChild(n)});</script>`;
    if (!html.includes(INJ_OLD)) { console.error('  ✗ locale injector not found — aborting (dist would not load locales)'); process.exit(1); }
    html = html.replace(INJ_OLD, INJ_NEW);
  }

  // ── Copy .well-known/ for Universal Links (iOS) and App Links (Android) ──
  if (fs.existsSync('.well-known')) {
    copyDir('.well-known', path.join(OUT, '.well-known'));
    console.log('  .well-known/ → dist/.well-known/');
  }

  // ── Copy logo/ so edge functions can reference hosted SVG assets ──
  if (fs.existsSync('logo')) {
    copyDir('logo', path.join(OUT, 'logo'));
    console.log('  logo/ → dist/logo/');
  }

  // ── Minify inline CSS/JS + collapse whitespace, then write index.html ──
  // minifyJS uses terser defaults; toplevel mangle is kept OFF so global
  // functions referenced from inline onclick="" handlers keep their names.
  try {
    const minified = await minify(html, {
      collapseWhitespace: true,
      minifyCSS: { level: 2 },
      minifyJS: { compress: true, mangle: { toplevel: false } },
      removeComments: true,
      collapseBooleanAttributes: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      useShortDoctype: true,
      decodeEntities: true,
      sortAttributes: true,   // reorders attrs/classes for better gzip — semantics-safe
      sortClassName: true,
    });
    fs.writeFileSync(path.join(OUT, 'index.html'), minified);
    console.log('  index.html → dist/index.html (minified)');
    console.log(`\n✓ Build complete → ${OUT}/`);
  } catch (err) {
    console.error('✗ Minify failed:', err);
    process.exit(1);
  }
})();
