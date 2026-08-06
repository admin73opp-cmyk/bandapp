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
