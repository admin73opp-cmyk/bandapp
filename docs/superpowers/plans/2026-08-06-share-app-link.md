# Share App Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every outgoing WhatsApp message and email carries one canonical link back to Ritovo that opens the web app for everyone except iOS, where it opens the native app or the App Store.

**Architecture:** A static `/go` resolver page decides the destination client-side. Because `.well-known/apple-app-site-association` already claims `/*`, iOS devices with the app installed never load the page — the OS intercepts the tap. A shared `js/share-link.js` exposes one hardcoded URL constant and an idempotent `withAppLink()` used by the four browser-composed messages; the three edge functions append `/go` at their existing link sites.

**Tech Stack:** Vanilla ES5-style browser JS (no bundler), Node 22 built-in test runner (`node --test`) with `node:vm` for loading browser globals, `html-validate` v11, Deno/TypeScript for Supabase edge functions, Vercel static hosting.

**Spec:** `docs/superpowers/specs/2026-08-06-share-app-link-design.md`

## Global Constraints

- The shared origin is the **hardcoded literal** `https://ritovo.net`. Never derive it from `location.origin` — that is `capacitor://localhost` inside the iOS shell and a throwaway hostname on Vercel previews.
- `IOS_STORE_URL` ships as an **empty string**. Do not invent an App Store ID; Ritovo is not listed yet. Empty means every device falls through to the web app.
- The appended link is a **bare URL on its own line after one blank line**, no prose. These messages bypass `t()`, so prose would create translation debt across the six files in `locales/`.
- No new npm dependencies. `node --test` and `html-validate` are already available.
- Do **not** touch the RSVP token links (`_shared/email.ts:94`) or the `?band=` join URL (`invite-member/index.ts:131`). They carry credentials in query params.
- All edits to `index.html` must anchor on the full unique line shown in each task. This file is 631 KB of long minified-style lines; a substring replace will hit the wrong place.
- Run every command from the repo root `/Users/73opp/bandapp`.
- Per the repo's RTK convention, prefix shell commands with `rtk` (e.g. `rtk git add ...`).

---

### Task 1: Shared link helper

**Files:**
- Create: `js/share-link.js`
- Create: `test/share-link.test.js`
- Modify: `index.html:23-27` (script tag block)

**Interfaces:**
- Consumes: nothing.
- Produces: two globals used by Task 3 — `APP_SHARE_URL` (string, `'https://ritovo.net/go'`) and `withAppLink(text: string) => string`.

- [ ] **Step 1: Write the failing test**

Create `test/share-link.test.js`:

```js
const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const vm       = require('node:vm');
const path     = require('path');

const ROOT = path.join(__dirname, '..');

// js/share-link.js is a plain browser script that declares globals, matching the
// pattern in js/capacitor-bridge.js. Run it in a vm context and read them back.
function load(origin) {
  const ctx = { location: { origin: origin || 'https://ritovo.net' } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/share-link.js'), 'utf8'), ctx);
  return ctx;
}

test('APP_SHARE_URL is the canonical /go link', () => {
  assert.strictEqual(load().APP_SHARE_URL, 'https://ritovo.net/go');
});

test('ignores location.origin inside the iOS Capacitor shell', () => {
  // Regression guard: confirmCancel used to share capacitor://localhost/ from the native app.
  assert.strictEqual(load('capacitor://localhost').APP_SHARE_URL, 'https://ritovo.net/go');
});

test('ignores location.origin on a Vercel preview deploy', () => {
  assert.strictEqual(load('https://bandapp-git-abc123.vercel.app').APP_SHARE_URL, 'https://ritovo.net/go');
});

test('appends the link after one blank line', () => {
  const { withAppLink } = load();
  assert.strictEqual(withAppLink('Rehearsal Friday'), 'Rehearsal Friday\n\nhttps://ritovo.net/go');
});

test('is idempotent - never appends the link twice', () => {
  const { withAppLink } = load();
  const once = withAppLink('Rehearsal Friday');
  assert.strictEqual(withAppLink(once), once);
});

test('trims trailing whitespace before appending', () => {
  const { withAppLink } = load();
  assert.strictEqual(withAppLink('Rehearsal Friday\n\n'), 'Rehearsal Friday\n\nhttps://ritovo.net/go');
});

test('empty or missing text yields the bare link', () => {
  const { withAppLink } = load();
  assert.strictEqual(withAppLink(''), 'https://ritovo.net/go');
  assert.strictEqual(withAppLink(undefined), 'https://ritovo.net/go');
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: FAIL — `ENOENT: no such file or directory, open '.../js/share-link.js'`.

- [ ] **Step 3: Write the implementation**

Create `js/share-link.js`:

```js
// Canonical outbound link for every message Ritovo sends (WhatsApp + email).
//
// The origin is a hardcoded literal on purpose. Inside the iOS Capacitor shell
// location.origin is "capacitor://localhost", and on a Vercel preview it is a
// throwaway deploy hostname — neither is shareable with a recipient.
//
// /go is a static resolver page. On iOS with the app installed the OS intercepts
// the tap via the /* universal-link claim in .well-known/apple-app-site-association
// and the page never loads; everyone else lands on it and is routed from there.

var RITOVO_URL    = 'https://ritovo.net';
var APP_SHARE_URL = RITOVO_URL + '/go';

// Append the app link to a composed message. Idempotent, so re-sending or a
// future second call site cannot produce the link twice.
function withAppLink(text) {
  if (!text) return APP_SHARE_URL;
  if (text.indexOf(APP_SHARE_URL) !== -1) return text;
  return text.replace(/\s+$/, '') + '\n\n' + APP_SHARE_URL;
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: PASS, `# pass 7`, `# fail 0`.

- [ ] **Step 5: Load the script in the app**

In `index.html`, find this exact block at lines 23-27:

```html
  <script src="js/supabase-client.js"></script>
  <script src="js/capacitor-bridge.js"></script>
```

Insert the new script immediately after the `capacitor-bridge.js` line, so the block becomes:

```html
  <script src="js/supabase-client.js"></script>
  <script src="js/capacitor-bridge.js"></script>
  <script src="js/share-link.js"></script>
```

No `build.js` change is needed — `findJs('js')` walks the directory recursively and content-hashes whatever it finds, and the `src="js/..."` rewrite at build.js:71 is generic.

- [ ] **Step 6: Verify the build picks up the new file**

```bash
rtk node build.js
```

Expected: the log contains a line `js/share-link.js → js/share-link.<8 hex chars>.js`, and `dist/index.html` references the hashed path. Confirm with:

```bash
rtk grep -c 'share-link\.[0-9a-f]\{8\}\.js' dist/index.html
```

Expected: `1`.

- [ ] **Step 7: Commit**

```bash
rtk git add js/share-link.js test/share-link.test.js index.html
rtk git commit -m "Add shared app-link helper for outgoing messages"
```

---

### Task 2: The /go resolver page

**Files:**
- Create: `go.html`
- Create: `test/go-resolver.test.js`
- Modify: `build.js:128`
- Modify: `vercel.json` (rewrites array)
- Modify: `.claude/preview-server.js`

**Interfaces:**
- Consumes: nothing from Task 1. This task is independent and can be built in parallel.
- Produces: the URL `https://ritovo.net/go`, which Task 1's `APP_SHARE_URL` and Task 4's edge functions both point at. Exposes `window.resolveTarget(ua, maxTouchPoints, storeUrl) => string` for testing.

**Deviation from the spec, applied deliberately:** the spec sketched `resolveTarget(ua, storeUrl)` reading `navigator.maxTouchPoints` from the enclosing scope. Taking `maxTouchPoints` as a third parameter instead makes the function pure and therefore directly testable, which is the whole reason the spec asked for a named function. The driver line passes `navigator.maxTouchPoints` in.

- [ ] **Step 1: Write the failing test**

Create `test/go-resolver.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: the Task 2 tests FAIL with `ENOENT: ... go.html`. Task 1's tests still pass.

- [ ] **Step 3: Create the resolver page**

Create `go.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Opening Ritovo</title>
<noscript><meta http-equiv="refresh" content="0;url=/"></noscript>
<style>
body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;
background:#0C6E6A;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
p{font-size:15px}
</style>
</head>
<body>
<p>Opening Ritovo&hellip; <a href="/" style="color:#fff">continue in your browser</a></p>
<script>
// Where a tap on https://ritovo.net/go actually goes.
//
// On iOS WITH the app installed this file never runs: the OS intercepts the tap
// via the /* universal-link claim in .well-known/apple-app-site-association and
// opens the native app. Only iOS-without-the-app and non-iOS devices get here.
//
// Set IOS_STORE_URL once the App Store listing is live. While it is empty every
// device falls through to the web app — that is the intended shipping state.
var IOS_STORE_URL = '';
var WEB_APP_URL   = '/';

// Pure so it can be exercised directly from test/go-resolver.test.js.
// maxTouchPoints is a parameter because since iPadOS 13 an iPad reports the
// desktop macOS user-agent string; touch points are the only way to tell them apart.
function resolveTarget(ua, maxTouchPoints, storeUrl) {
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && maxTouchPoints > 1);
  return (isIOS && storeUrl) ? storeUrl : WEB_APP_URL;
}

// replace(), not href — the resolver must not enter history or Back bounces here again.
location.replace(resolveTarget(navigator.userAgent, navigator.maxTouchPoints || 0, IOS_STORE_URL));
</script>
</body>
</html>
```

- [ ] **Step 4: Route /go in vercel.json**

In `vercel.json`, the `rewrites` array currently holds one entry. Replace this exact line:

```json
  "rewrites": [{ "source": "/((?!api/)(?!\\.well-known/)(?!.*\\.[a-zA-Z0-9]+$).*)", "destination": "/index.html" }]
```

with:

```json
  "rewrites": [
    { "source": "/go", "destination": "/go.html" },
    { "source": "/((?!api/)(?!\\.well-known/)(?!.*\\.[a-zA-Z0-9]+$).*)", "destination": "/index.html" }
  ]
```

Order matters: `/go` carries no file extension, so the catch-all's `(?!.*\.[a-zA-Z0-9]+$)` guard does not exclude it and it would otherwise be rewritten to `/index.html`.

- [ ] **Step 5: Copy go.html into the build output**

In `build.js`, find this exact line (line 128):

```js
  for (const legalFile of ['privacy.html', 'support.html']) {
```

Replace with:

```js
  for (const legalFile of ['privacy.html', 'support.html', 'go.html']) {
```

- [ ] **Step 6: Mirror the rewrite in the local preview server**

`.claude/preview-server.js` reproduces Vercel's catch-all: any extensionless path
falls back to `index.html`. Without a matching special case `/go` is unreachable
locally, and the rewrite could only be tested by deploying.

Replace this exact line:

```js
  if (urlPath === '/' || !path.extname(filePath) || !fs.existsSync(filePath)) {
```

with:

```js
  if (urlPath === '/go') {
    filePath = path.join(ROOT, 'go.html');            // mirrors the vercel.json /go rewrite
  } else if (urlPath === '/' || !path.extname(filePath) || !fs.existsSync(filePath)) {
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: PASS, `# pass 16`, `# fail 0`.

- [ ] **Step 8: Validate the markup**

```bash
rtk npx html-validate go.html
```

Expected: exit 0 with no output. Read the whole report, not just the tail — html-validate output has truncated in this repo before.

- [ ] **Step 9: Verify go.html reaches dist and /go resolves locally**

```bash
rtk node build.js && rtk ls dist/go.html
```

Expected: the build log contains `go.html → dist/go.html`, and the file exists.

Then start the `ritovo-preview` launch configuration (port 4317, serves `dist/`) using the preview tooling — never `npm`/`node` in a background shell — and confirm the extensionless route now resolves:

```bash
rtk curl -s http://localhost:4317/go | rtk grep -c 'resolveTarget'
```

Expected: `1`. A `0` means the SPA fallback is still swallowing `/go` — recheck Step 6.

- [ ] **Step 10: Commit**

```bash
rtk git add go.html test/go-resolver.test.js vercel.json build.js .claude/preview-server.js
rtk git commit -m "Add /go resolver that routes iOS to the App Store and everyone else to the web app"
```

---

### Task 3: Wire the four browser-composed messages

**Files:**
- Modify: `index.html` at lines 6381, 7081, 9312, 9474
- Create: `test/message-sites.test.js`

**Interfaces:**
- Consumes: `APP_SHARE_URL` and `withAppLink(text)` from Task 1.
- Produces: nothing consumed by later tasks.

These four edits sit inside a 631 KB file of long single-line statements. Each step below quotes the **entire** line to anchor on. Match the full line; do not substring-replace.

- [ ] **Step 1: Write the failing test**

Create `test/message-sites.test.js`:

```js
const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const path     = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// These are structural assertions, not behavioural ones: the four call sites live
// inside one enormous inline <script> that cannot be imported. withAppLink's actual
// behaviour is covered by test/share-link.test.js; these guard the wiring.

test('share-link.js is loaded before the inline app code', () => {
  assert.match(html, /<script src="js\/share-link\.js"><\/script>/);
});

test('shareRehearsal wraps its message in withAppLink', () => {
  assert.match(html, /const a = withAppLink\(`🎵 Rehearsal:/);
});

test('confReh wraps its WhatsApp message in withAppLink', () => {
  assert.match(html, /: withAppLink\(`🎸 \$\{n\} confirmed!/);
});

test('the invite message carries the link above the sign-off', () => {
  assert.match(html, /on Ritovo\.\\n\\n\$\{APP_SHARE_URL\}\\n\\nCheers,/);
});

test('confirmCancel uses the shared constant, not location.origin', () => {
  assert.match(html, /\} = cancelTarget, o = APP_SHARE_URL;/);
  assert.doesNotMatch(html, /window\.location\.origin \+ "\/"/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: four of the five new tests FAIL (the `share-link.js` one already passes from Task 1).

- [ ] **Step 3: Wire shareRehearsal**

In `index.html` line 6381, replace this exact line:

```js
      const a = `🎵 Rehearsal: ${t.title}\n📅 ${t.day} ${t.month} ${t.year} · ${t.start}–${t.end}\n📍 ${t.location}${t.notes?"\n📝 "+t.notes:""}`;
```

with:

```js
      const a = withAppLink(`🎵 Rehearsal: ${t.title}\n📅 ${t.day} ${t.month} ${t.year} · ${t.start}–${t.end}\n📍 ${t.location}${t.notes?"\n📝 "+t.notes:""}`);
```

- [ ] **Step 4: Wire the invitation message**

In `index.html` line 7081, replace this exact line:

```js
        n = `Dear ${[(document.getElementById("invFirstName")?.value||"Musician").trim(),(document.getElementById("invLastName")?.value||"").trim()].filter(Boolean).join(" ")},\n\nI am very happy to invite you to join group "${e?e.name:"our group"}" on Ritovo.\n\nCheers,\n${t}`;
```

with:

```js
        n = `Dear ${[(document.getElementById("invFirstName")?.value||"Musician").trim(),(document.getElementById("invLastName")?.value||"").trim()].filter(Boolean).join(" ")},\n\nI am very happy to invite you to join group "${e?e.name:"our group"}" on Ritovo.\n\n${APP_SHARE_URL}\n\nCheers,\n${t}`;
```

This is the one site that inserts rather than appends: the message ends in a signature, and a URL after "Cheers, <name>" reads as a stray fragment.

`sendInvitation` at line 7088 needs **no** edit. It sends whatever sits in the `invMsgText` textarea, so this single change covers both the WhatsApp branch and the `mailto:` branch — and the sender sees the link before pressing send.

- [ ] **Step 5: Wire confReh**

In `index.html` line 9312, replace this exact line:

```js
        d = "whatsapp" !== e && "both" !== e || !t ? null : `🎸 ${n} confirmed!\n📅 ${pendKey}${o?" ⏰ "+o:""}${s?"\n📍 "+s:""}${r?"\n♩ "+r:""}${i?"\n📝 "+i:""}`;
```

with:

```js
        d = "whatsapp" !== e && "both" !== e || !t ? null : withAppLink(`🎸 ${n} confirmed!\n📅 ${pendKey}${o?" ⏰ "+o:""}${s?"\n📍 "+s:""}${r?"\n♩ "+r:""}${i?"\n📝 "+i:""}`);
```

`d` is also passed to `navigator.clipboard.writeText(d)` further down the same function, so the link rides into the clipboard copy for free.

- [ ] **Step 6: Wire confirmCancel**

In `index.html` line 9474, replace this exact line:

```js
      } = cancelTarget, o = (window.location.origin + "/").replace(/[?#].*/, "").replace(/\/+$/, "");
```

with:

```js
      } = cancelTarget, o = APP_SHARE_URL;
```

Do **not** use `withAppLink` here. `o` is interpolated mid-sentence in three separate message variants (the generic one at line 9475, the concert one at 9481, the rehearsal one at 9494) which all read `...Please check Ritovo for updates: ${o}`. `withAppLink` appends, which would be wrong. Reassigning `o` fixes all three at once and is what retires the `capacitor://localhost` bug.

- [ ] **Step 7: Run the tests to verify they pass**

```bash
rtk node --test 'test/**/*.test.js'
```

Expected: PASS, `# pass 21`, `# fail 0`.

- [ ] **Step 8: Confirm the build still succeeds**

The inline app code is minified by `html-minifier-terser` with `mangle.toplevel: false`, so the global names `withAppLink` and `APP_SHARE_URL` survive. Confirm:

```bash
rtk node build.js && rtk grep -c 'APP_SHARE_URL\|withAppLink' dist/index.html
```

Expected: build exits 0, and the count is at least 1. A count of 0 means terser dropped or renamed the globals — stop and investigate rather than proceeding.

- [ ] **Step 9: Commit**

```bash
rtk git add index.html test/message-sites.test.js
rtk git commit -m "Add the app link to all four browser-composed messages"
```

---

### Task 4: Point the edge-function emails at /go

**Files:**
- Modify: `supabase/functions/_shared/email.ts:59`
- Modify: `supabase/functions/notify-rehearsal/index.ts:147,149`
- Modify: `supabase/functions/rsvp-remind/index.ts:164,268`

**Interfaces:**
- Consumes: the `/go` path from Task 2.
- Produces: nothing consumed by later tasks.

These are Deno/TypeScript files with no local test runner. Verification is by reading the rendered HTML string, covered in Task 5.

- [ ] **Step 1: Fix the shared footer**

In `supabase/functions/_shared/email.ts`, replace this exact line (line 59):

```
              © Ritovo · <a href="${base}" style="color:#aaa;text-decoration:none">ritovo.app</a>
```

with:

```
              © Ritovo · <a href="${base}/go" style="color:#aaa;text-decoration:none">${base.replace(/^https?:\/\//, '')}</a>
```

Two changes in one line. The `href` gains `/go`, which is what reaches all three functions at once — `invite-member` has no "Open in Ritovo" button, so the footer is its only generic app link. The visible label was the hardcoded string `ritovo.app` while `base` resolves to ritovo.net; deriving it stops the two drifting again. The label shows the bare domain and must **not** show the `/go` path.

- [ ] **Step 2: Update the notify-rehearsal button**

In `supabase/functions/notify-rehearsal/index.ts`, replace this exact line (line 147):

```
      ${btn('Open in Ritovo', appUrl)}
```

with:

```
      ${btn('Open in Ritovo', `${appUrl}/go`)}
```

- [ ] **Step 3: Update the notify-rehearsal fallback link**

In the same file, replace this exact line (line 149):

```
        If the button doesn't work, visit <a href="${appUrl}" style="color:#6C63FF">${appUrl.replace(/\/$/, '')}</a>
```

with:

```
        If the button doesn't work, visit <a href="${appUrl}/go" style="color:#6C63FF">${appUrl.replace(/\/$/, '')}</a>
```

Only the `href` changes. The visible text stays the bare domain — people read and retype that line, so it must stay clean.

- [ ] **Step 4: Update the two rsvp-remind buttons**

In `supabase/functions/rsvp-remind/index.ts`, replace this exact line (line 164):

```
            ${btn('Open in Ritovo', appUrl)}`
```

with:

```
            ${btn('Open in Ritovo', `${appUrl}/go`)}`
```

Then replace this exact line (line 268):

```
          ${btn('View attendance', appUrl)}`
```

with:

```
          ${btn('View attendance', `${appUrl}/go`)}`
```

Note the differing label: line 268 is the admin digest's "View attendance", not "Open in Ritovo". Keep the label; change only the target.

- [ ] **Step 5: Confirm the credential-bearing links are untouched**

```bash
rtk grep -n 'rsvpButtons\|joinUrl' supabase/functions/_shared/email.ts supabase/functions/invite-member/index.ts
```

Expected: `_shared/email.ts:94` still builds `${base}/rsvp?token=...` with no `/go`, and `invite-member/index.ts:131` still builds `${appUrl}/?band=${band_id}` with no `/go`. Both carry credentials in query params and a redirect hop risks stripping them.

- [ ] **Step 6: Type-check the edge functions**

```bash
rtk npx deno check supabase/functions/notify-rehearsal/index.ts supabase/functions/rsvp-remind/index.ts supabase/functions/invite-member/index.ts
```

Expected: no errors. If `deno` is not installed on this machine, skip this step and say so explicitly in the task report rather than claiming it passed.

- [ ] **Step 7: Commit**

```bash
rtk git add supabase/functions/_shared/email.ts supabase/functions/notify-rehearsal/index.ts supabase/functions/rsvp-remind/index.ts
rtk git commit -m "Point transactional email links at the /go resolver"
```

---

### Task 5: End-to-end verification

**Files:**
- Modify: `package.json` (add a `test` script)

**Interfaces:**
- Consumes: everything from Tasks 1-4.
- Produces: the evidence required before any completion claim.

- [ ] **Step 1: Add a test script**

In `package.json`, the `scripts` block currently starts:

```json
  "scripts": {
    "build": "node build.js",
```

Insert a `test` entry so the suite is discoverable:

```json
  "scripts": {
    "test": "node --test 'test/**/*.test.js'",
    "build": "node build.js",
```

- [ ] **Step 2: Run the whole suite**

```bash
rtk npm test
```

Expected: `# pass 21`, `# fail 0`. Paste the real output into the task report. Do not claim it passed without it.

- [ ] **Step 3: Build and serve**

```bash
rtk node build.js
```

Then start the preview with the `ritovo-preview` launch configuration (port 4317, serves `dist/`) using the preview tooling — never `npm`/`node` in a background shell.

- [ ] **Step 4: Verify /go redirects in a real browser**

Navigate the preview to `http://localhost:4317/go`. Expected: the URL becomes `/`
and the Ritovo app loads. The teal "Opening Ritovo…" splash may flash briefly.

This exercises the local mirror of the rewrite added in Task 2 Step 6, not the
Vercel rewrite itself. The two are configured separately, so a passing local
check is evidence the resolver and its ordering assumption are right, **not**
proof that `vercel.json` is correct. State that distinction in the report and
confirm the deployed `/go` after the first production deploy.

- [ ] **Step 5: Drive the branch table in the browser console**

With `/go.html` loaded, run in the console:

```js
const S = 'https://apps.apple.com/app/id0000000000';
const UA = {
  iPhone:  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  iPad13:  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  android: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
};
JSON.stringify({
  iPhone_empty:  resolveTarget(UA.iPhone,  0, ''),
  iPhone_store:  resolveTarget(UA.iPhone,  0, S),
  iPad13_store:  resolveTarget(UA.iPad13,  5, S),
  macOS_store:   resolveTarget(UA.iPad13,  0, S),
  android_store: resolveTarget(UA.android, 5, S),
  windows_store: resolveTarget(UA.windows, 0, S),
});
```

Expected exactly:

```json
{"iPhone_empty":"/","iPhone_store":"https://apps.apple.com/app/id0000000000","iPad13_store":"https://apps.apple.com/app/id0000000000","macOS_store":"/","android_store":"/","windows_store":"/"}
```

- [ ] **Step 6: Confirm no origin-derived links survive**

```bash
rtk grep -n 'window.location.origin' index.html
```

Expected: no hit inside `confirmCancel`. Hits elsewhere (`js/auth.js` builds redirect URLs from the live origin, which is correct there) are fine and must not be changed.

- [ ] **Step 7: Commit**

```bash
rtk git add package.json
rtk git commit -m "Add test script for the share-link suite"
```

- [ ] **Step 8: Report honestly**

State in the final report: which steps ran and passed, with real pasted output;
that the local `/go` check exercises `.claude/preview-server.js` rather than the
Vercel rewrite, which stays unproven until deployed; whether `deno check` ran or
was skipped; and that the iOS App Store branch is dormant by design because
`IOS_STORE_URL` is intentionally empty, so no behaviour change is visible on iOS
until that constant is set.

---

## Follow-ups recorded, not done here

- Set `IOS_STORE_URL` in `go.html` the day the App Store listing goes live. That single constant activates the iOS branch.
- Fix `.well-known/assetlinks.json`: `com.bandapp.app` → `com.ritovo.app`, and replace `PLACEHOLDER_REPLACE_WITH_RELEASE_CERT_SHA256` with the real release-cert fingerprint. Android App Links cannot verify until both are correct.
