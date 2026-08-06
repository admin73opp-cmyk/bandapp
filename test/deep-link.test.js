const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const vm       = require('node:vm');
const path     = require('path');

const ROOT = path.join(__dirname, '..');
const SRC  = fs.readFileSync(path.join(ROOT, 'js/capacitor-bridge.js'), 'utf8');

// js/capacitor-bridge.js declares _handleDeepLink as a top-level function.
// The IIFE at the top of the file returns immediately when window.Capacitor
// is undefined, so a bare `window` stub is safe to run in a vm context —
// matching the pattern in test/share-link.test.js and test/go-resolver.test.js.
//
// Real display values don't matter here; the sentinel lets "untouched" be
// asserted precisely rather than just "not 'flex'".
const UNTOUCHED = '__untouched__';

function makeEl() {
  return { style: { display: UNTOUCHED } };
}

function load() {
  const authScreenEl = makeEl();
  const loadingEl    = makeEl();
  const tabsEl       = makeEl();
  const elements = { authScreen: authScreenEl, authLoading: loadingEl, 'auth-tabs': tabsEl };

  const store = {};
  const sessionStorageStub = {
    setItem(k, v) { store[k] = v; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
  };

  const exchangeCodeForSessionCalls = [];
  const setSessionCalls             = [];
  const switchTabCalls              = [];

  const supabaseStub = {
    auth: {
      exchangeCodeForSession(code) {
        exchangeCodeForSessionCalls.push(code);
        return Promise.resolve();
      },
      setSession(opts) {
        setSessionCalls.push(opts);
        return Promise.resolve();
      },
    },
  };

  const ctx = {
    window: {},
    document: { getElementById(id) { return elements[id] || null; } },
    sessionStorage: sessionStorageStub,
    supabase: supabaseStub,
    switchTab(tab) { switchTabCalls.push(tab); },
    console,
    URL,
    URLSearchParams,
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);

  return {
    ctx,
    authScreenEl,
    loadingEl,
    tabsEl,
    store,
    exchangeCodeForSessionCalls,
    setSessionCalls,
    switchTabCalls,
  };
}

test('a plain /go universal-link tap does not touch the auth screen', () => {
  // This is exactly what a warm-started, already-signed-in app sees when a
  // band member taps the new https://ritovo.net/go link from WhatsApp/email.
  const t = load();
  t.ctx._handleDeepLink('https://ritovo.net/go');

  assert.strictEqual(t.authScreenEl.style.display, UNTOUCHED);
  assert.strictEqual(t.loadingEl.style.display, UNTOUCHED);
  assert.strictEqual(t.tabsEl.style.display, UNTOUCHED);
  assert.deepStrictEqual(t.store, {});
  assert.deepStrictEqual(t.exchangeCodeForSessionCalls, []);
  assert.deepStrictEqual(t.setSessionCalls, []);
  assert.deepStrictEqual(t.switchTabCalls, []);
});

test('?code= shows the auth screen and exchanges the code', () => {
  const t = load();
  t.ctx._handleDeepLink('https://ritovo.net/go?code=abc');

  assert.strictEqual(t.authScreenEl.style.display, 'flex');
  assert.deepStrictEqual(t.exchangeCodeForSessionCalls, ['abc']);
});

test('#access_token= shows the auth screen and calls setSession', () => {
  const t = load();
  t.ctx._handleDeepLink('https://ritovo.net/go#access_token=xyz&refresh_token=rst');

  assert.strictEqual(t.authScreenEl.style.display, 'flex');
  // Objects built inside the vm context carry a different realm's
  // Object.prototype, so compare fields rather than deepStrictEqual on the
  // whole object (which also checks prototype identity).
  assert.strictEqual(t.setSessionCalls.length, 1);
  assert.strictEqual(t.setSessionCalls[0].access_token, 'xyz');
  assert.strictEqual(t.setSessionCalls[0].refresh_token, 'rst');
});

test('?invite= stashes the invite token and still shows the auth screen', () => {
  const t = load();
  t.ctx._handleDeepLink('https://ritovo.net/go?invite=TOKEN');

  assert.strictEqual(t.store.inviteToken, 'TOKEN');
  assert.strictEqual(t.authScreenEl.style.display, 'flex');
  assert.deepStrictEqual(t.switchTabCalls, ['signup']);
});

test('?band= stashes the pending band id and still shows the auth screen', () => {
  const t = load();
  t.ctx._handleDeepLink('https://ritovo.net/go?band=123');

  assert.strictEqual(t.store.pendingBandId, '123');
  assert.strictEqual(t.authScreenEl.style.display, 'flex');
  assert.deepStrictEqual(t.switchTabCalls, ['signup']);
});
