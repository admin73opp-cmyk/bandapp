#!/usr/bin/env node
// Content-hash build script — no npm dependencies required.
// Hashes every file under js/, copies them with the hash in the filename,
// rewrites <script src="js/..."> references in index.html, and copies
// locales/ as-is. Output goes to dist/.

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

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

// ── Hash + copy JS files ────────────────────────────────────
const fileMap = {}; // 'js/auth.js' → 'js/auth.a1b2c3d4.js'

for (const file of findJs('js')) {
  const h        = sha8(file);
  const rel      = file.replace(/\\/g, '/');          // normalise on Windows too
  const dir      = path.dirname(rel);
  const base     = path.basename(rel, '.js');
  const hashed   = `${dir}/${base}.${h}.js`;

  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.copyFileSync(file, path.join(OUT, hashed));
  fileMap[rel] = hashed;
  console.log(`  ${rel} → ${hashed}`);
}

// ── Rewrite index.html ──────────────────────────────────────
let html = fs.readFileSync('index.html', 'utf8');
for (const [orig, hashed] of Object.entries(fileMap)) {
  // src="js/auth.js"  →  src="/js/auth.a1b2c3d4.js"
  html = html.split(`src="${orig}"`).join(`src="/${hashed}"`);
}
fs.writeFileSync(path.join(OUT, 'index.html'), html);
console.log('  index.html → dist/index.html');

// ── Copy locales unchanged (no hashing — cache-busted by index.html) ──
if (fs.existsSync('locales')) {
  copyDir('locales', path.join(OUT, 'locales'));
  console.log('  locales/ → dist/locales/');
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

console.log(`\n✓ Build complete → ${OUT}/`);
