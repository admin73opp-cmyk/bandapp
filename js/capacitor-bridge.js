// Capacitor deep-link bridge — only active when running inside the native app shell.
// Handles incoming URLs (invite links, password resets, magic-link callbacks) that iOS
// and Android redirect into the app via Universal Links / App Links.
//
// Web context: this file is a no-op (window.Capacitor is undefined).
// Native context: Capacitor injects its JS runtime before page scripts, making
//   window.Capacitor and window.Capacitor.Plugins available when this runs.

(function () {
  if (typeof window === 'undefined') return;
  if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return;

  function registerUrlListener() {
    var App = (window.Capacitor.Plugins || {}).App;
    if (!App || typeof App.addListener !== 'function') {
      setTimeout(registerUrlListener, 50);
      return;
    }

    // Warm-start: app already running, OS hands us a new URL
    App.addListener('appUrlOpen', function (data) {
      if (data && data.url) _handleDeepLink(data.url);
    });

    // Cold-start: app launched *from* a deep-link tap
    App.getLaunchUrl().then(function (result) {
      if (result && result.url) _handleDeepLink(result.url);
    }).catch(function () {});
  }

  registerUrlListener();
})();

// Exported as a plain global so auth.js can also call it after a manual redirect.
function _handleDeepLink(url) {
  if (!url) return;

  var parsed;
  try { parsed = new URL(url); } catch (e) { return; }

  var params = new URLSearchParams(parsed.search);
  var hash   = parsed.hash; // e.g. "#access_token=xxx&refresh_token=yyy&type=recovery"

  // ── Stash invite / band params so the auth flow picks them up ────────────
  var inviteToken = params.get('invite');
  var bandId      = params.get('band');
  if (inviteToken) sessionStorage.setItem('inviteToken',   inviteToken);
  if (bandId)      sessionStorage.setItem('pendingBandId', bandId);

  // ── Nothing to act on — leave the UI alone ────────────────────────────────
  // A plain https://ritovo.net/go universal-link tap (e.g. from a WhatsApp
  // rehearsal notification) carries no code, no access_token, no invite, and
  // no band param. On a warm start the app is already running and already
  // signed in, so there is nothing here for auth.js's onAuthStateChange to
  // clean up (that only fires on SIGNED_IN / INITIAL_SESSION, not for an
  // already-authenticated session). Do NOT remove this: without it, every
  // such tap forces the auth screen on top of a live session and nothing
  // ever dismisses it again.
  var hasCode        = !!params.get('code');
  var hasAccessToken = !!(hash && hash.includes('access_token'));
  if (!hasCode && !hasAccessToken && !inviteToken && !bandId) return;

  // Show the auth loading screen while we exchange the token
  var authScreenEl = document.getElementById('authScreen');
  var loadingEl    = document.getElementById('authLoading');
  var tabsEl       = document.getElementById('auth-tabs');
  if (authScreenEl) authScreenEl.style.display = 'flex';
  if (loadingEl)    loadingEl.style.display    = 'flex';
  if (tabsEl)       tabsEl.style.display       = 'none';

  // ── PKCE code exchange (?code=…) ─────────────────────────────────────────
  var code = params.get('code');
  if (code) {
    supabase.auth.exchangeCodeForSession(code).catch(function (e) {
      console.warn('[bandapp] exchangeCodeForSession failed:', e && e.message);
      if (loadingEl)    loadingEl.style.display    = 'none';
      if (authScreenEl) authScreenEl.style.display = 'flex';
      if (tabsEl)       tabsEl.style.display       = '';
    });
    return;
  }

  // ── Implicit / magic-link flow (#access_token=…) ─────────────────────────
  if (hash && hash.includes('access_token')) {
    var hp           = new URLSearchParams(hash.replace(/^#/, ''));
    var accessToken  = hp.get('access_token')  || '';
    var refreshToken = hp.get('refresh_token') || '';

    if (accessToken) {
      supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        .catch(function (e) {
          console.warn('[bandapp] setSession failed:', e && e.message);
          if (loadingEl)    loadingEl.style.display    = 'none';
          if (authScreenEl) authScreenEl.style.display = 'flex';
          if (tabsEl)       tabsEl.style.display       = '';
        });
    }
    return;
  }

  // ── No auth token — just an invite/band link opened cold ─────────────────
  // Hide the loader and let the normal auth screen handle it
  if (loadingEl)    loadingEl.style.display    = 'none';
  if (authScreenEl) authScreenEl.style.display = 'flex';
  if (tabsEl)       tabsEl.style.display       = '';

  // If the invite sessionStorage items were just set, show the signup tab
  if (inviteToken || bandId) {
    if (typeof switchTab === 'function') switchTab('signup');
  }
}
