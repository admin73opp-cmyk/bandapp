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

  // ── Minify + copy locales (cache-busted by index.html) ──
  // Locale files are pure data objects (window.XX = {...}); mangle is kept OFF
  // so the window.XX global names survive, but whitespace/comments are stripped.
  if (fs.existsSync('locales')) {
    const dst = path.join(OUT, 'locales');
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync('locales')) {
      const src = fs.readFileSync(path.join('locales', e), 'utf8');
      let out = src;
      if (e.endsWith('.js')) {
        try {
          const r = await minifyJS(src, { compress: true, mangle: { toplevel: false }, format: { comments: false } });
          if (r.code) out = r.code;
        } catch (err) { console.error('  locale minify skip', e, err.message); }
      }
      fs.writeFileSync(path.join(dst, e), out);
    }
    console.log('  locales/ → dist/locales/ (minified)');
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
