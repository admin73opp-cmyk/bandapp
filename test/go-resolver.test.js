const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const vm       = require('node:vm');
const path     = require('path');

const ROOT = path.join(__dirname, '..');

// Real user-agent strings. Note that IPADOS13 and MACOS are byte-identical:
// since iPadOS 13, Safari on iPad reports the desktop Mac UA. maxTouchPoints is
// the ONLY way to tell them apart, which is why it is a parameter.
const IPHONE   = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPADOS13 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const MACOS    = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const ANDROID  = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const WINDOWS  = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const STORE = 'https://apps.apple.com/app/id0000000000';

// go.html keeps its logic in one inline <script> (it cannot use an external
// js/ file — build.js only rewrites hashed script paths inside index.html).
// Pull that block out and run it against fake browser globals.
function loadGo(ua, maxTouchPoints) {
  const html = fs.readFileSync(path.join(ROOT, 'go.html'), 'utf8');
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'go.html must contain exactly one inline <script> block');

  const replaced = [];
  const ctx = {
    navigator: { userAgent: ua, maxTouchPoints: maxTouchPoints },
    location:  { replace: (u) => replaced.push(u), href: '' },
  };
  vm.createContext(ctx);
  vm.runInContext(m[1], ctx);
  return { ctx, replaced };
}

test('ships with an empty IOS_STORE_URL', () => {
  // Guard: nobody may commit a guessed App Store id. The listing does not exist yet.
  const { ctx } = loadGo(WINDOWS, 0);
  assert.strictEqual(ctx.IOS_STORE_URL, '');
});

test('with no store URL configured, every device gets the web app', () => {
  const { ctx } = loadGo(WINDOWS, 0);
  assert.strictEqual(ctx.resolveTarget(IPHONE,   0, ''), '/');
  assert.strictEqual(ctx.resolveTarget(IPADOS13, 5, ''), '/');
  assert.strictEqual(ctx.resolveTarget(ANDROID,  5, ''), '/');
  assert.strictEqual(ctx.resolveTarget(MACOS,    0, ''), '/');
  assert.strictEqual(ctx.resolveTarget(WINDOWS,  0, ''), '/');
});

test('with a store URL configured, only iOS is diverted', () => {
  const { ctx } = loadGo(WINDOWS, 0);
  assert.strictEqual(ctx.resolveTarget(IPHONE,   0, STORE), STORE);
  assert.strictEqual(ctx.resolveTarget(IPADOS13, 5, STORE), STORE);
  assert.strictEqual(ctx.resolveTarget(ANDROID,  5, STORE), '/');
  assert.strictEqual(ctx.resolveTarget(MACOS,    0, STORE), '/');
  assert.strictEqual(ctx.resolveTarget(WINDOWS,  0, STORE), '/');
});

test('desktop Safari is not mistaken for an iPad', () => {
  // Same UA string as IPADOS13; only maxTouchPoints differs.
  const { ctx } = loadGo(MACOS, 0);
  assert.strictEqual(ctx.resolveTarget(MACOS, 0, STORE), '/');
});

test('the driver redirects exactly once, via replace not href', () => {
  // location.replace keeps the resolver out of history, so Back does not bounce.
  const { replaced } = loadGo(IPHONE, 0);
  assert.deepStrictEqual(replaced, ['/']);
});

test('go.html has a noscript fallback to the web app', () => {
  const html = fs.readFileSync(path.join(ROOT, 'go.html'), 'utf8');
  assert.match(html, /<noscript><meta http-equiv="refresh" content="0;url=\/"><\/noscript>/);
});

test('vercel.json routes /go before the SPA catch-all', () => {
  // /go has no file extension, so the catch-all rewrite would swallow it into
  // index.html. Vercel evaluates rewrites in order, so this must be first.
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.deepStrictEqual(cfg.rewrites[0], { source: '/go', destination: '/go.html' });
});

test('build.js copies go.html into dist', () => {
  const build = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
  assert.match(build, /\['privacy\.html', 'support\.html', 'go\.html'\]/);
});

test('the local preview server mirrors the /go rewrite', () => {
  // preview-server.js falls back to index.html for ANY extensionless path, which
  // is exactly what the production catch-all does. Without a matching special
  // case, /go is unreachable locally and the rewrite cannot be tested before deploy.
  const srv = fs.readFileSync(path.join(ROOT, '.claude/preview-server.js'), 'utf8');
  assert.match(srv, /urlPath === '\/go'/);
});
