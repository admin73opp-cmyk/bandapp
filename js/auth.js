// ── Auth helpers ─────────────────────────────────────────────

function showAuthErr(id, msg) {
  const box = document.getElementById(id);
  if (!box) { toast2(msg, 'w'); return; }
  const msgEl = box.querySelector('.auth-err-msg');
  if (msgEl) msgEl.textContent = msg;
  box.style.display = 'flex';
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function clearAuthErr(id) {
  const box = document.getElementById(id);
  if (box) box.style.display = 'none';
}

function handleDbError(err) {
  console.error('[bandapp] DB error:', err?.code, err?.message, err?.details, err?.hint, err);
  toast2(err.message || 'Something went wrong', 'w');
}

async function loadCurrentUser(uid, email) {
  currentUser.id    = uid;
  currentUser.email = email || '';

  // Fire both queries concurrently — they have no dependency on each other
  const [
    { data: profile, error },
    { data: memberships },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', uid).single(),
    supabase.from('band_members').select('band_id, role').eq('user_id', uid),
  ]);

  if (error) {
    console.error('[bandapp] profiles query failed — code:', error?.code, 'message:', error?.message);
    // Profile row missing (common for new users if RLS blocked the insert at signup).
    // Fall back to auth metadata and create the row now that the user is authenticated.
    const { data: _authData } = await supabase.auth.getUser();
    const authUser = _authData?.user;
    const meta = authUser?.user_metadata || {};
    const fn = meta.first_name || '';
    const ln = meta.last_name || '';
    currentUser.firstName = fn;
    currentUser.lastName  = ln;
    currentUser._memberships = [];
    // Restore pending band from metadata if sessionStorage was cleared (e.g. after page refresh)
    if (meta.pending_band_id && !sessionStorage.getItem('pendingBandId')) {
      sessionStorage.setItem('pendingBandId', meta.pending_band_id);
    }
    if (fn || ln) {
      await supabase.from('profiles').upsert({
        id:         uid,
        first_name: fn,
        last_name:  ln,
        initials:   ((fn[0] || '') + (ln[0] || '')).toUpperCase(),
      });
    }
    return;
  }

  currentUser.firstName  = profile.first_name  || '';
  currentUser.lastName   = profile.last_name   || '';
  currentUser.instrument = profile.instrument  || '';
  currentUser.color      = profile.color       || '#6C63FF';
  currentUser.lang       = profile.lang        || 'en';
  currentUser.avail      = profile.availability || [1,1,1,1,1,1,1];
  currentUser._profile   = profile; // full row — used as fallback in populateMpPage

  currentUser._memberships = memberships || [];

  // Restore previously active band from localStorage, or default to first
  const saved = localStorage.getItem('activeBandId');
  const validIds = (memberships || []).map(m => m.band_id);
  activeBandId = (saved && validIds.includes(saved)) ? saved : (validIds[0] || null);

  const activeMembership = (memberships || []).find(m => m.band_id === activeBandId);
  currentUser.role = activeMembership?.role || 'member';
}

// ── Login / logout ───────────────────────────────────────────

// Safety timer: if onAuthStateChange never completes (e.g. DB query hangs on mobile),
// reset the button so the user can try again.
let _loginSafetyTimer = null;
function _clearLoginTimer() { clearTimeout(_loginSafetyTimer); _loginSafetyTimer = null; }
function _resetLoginBtn() {
  const b = document.getElementById('loginBtn');
  if (b) { b.disabled = false; b.textContent = 'Sign in'; }
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  if (!email || !pw) { showAuthErr('loginErr', 'Enter email and password'); return; }

  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }
  clearAuthErr('loginErr');

  _clearLoginTimer();
  _loginSafetyTimer = setTimeout(() => {
    _resetLoginBtn();
    showAuthErr('loginErr', 'Sign-in timed out — please try again');
  }, 20000);

  const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) {
    _clearLoginTimer();
    _resetLoginBtn();
    showAuthErr('loginErr', error.message);
  }
  // onAuthStateChange handles the rest on success; it clears _loginSafetyTimer
}

async function doSignUp() {
  const firstName = document.getElementById('signupFirst').value.trim();
  const lastName  = document.getElementById('signupLast').value.trim();
  const email     = document.getElementById('signupEmail').value.trim();
  const pw        = document.getElementById('signupPassword').value;
  const groupName = (document.getElementById('signupGroup')?.value || '').trim();

  if (!email || !pw) { showAuthErr('signupErr', 'Enter email and password'); return; }
  if (pw.length < 8) { showAuthErr('signupErr', 'Password must be at least 8 characters'); return; }

  const pendingBandId     = sessionStorage.getItem('pendingBandId')   || new URLSearchParams(window.location.search).get('band') || '';
  const pendingPhone      = sessionStorage.getItem('invitePhone')      || '';
  const pendingInstrument = sessionStorage.getItem('inviteInstrument') || '';
  const baseUrl = (window.Capacitor && window.Capacitor.isNativePlatform())
    ? 'https://bandapp.app'
    : (window.location.origin + window.location.pathname);
  // Only embed the band UUID in the confirmation redirect — no PII in URLs.
  // Phone and instrument are stored in sessionStorage and survive across tabs without URL exposure.
  const redirectTo = pendingBandId ? `${baseUrl}?band=${pendingBandId}` : baseUrl;

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pw,
    options: {
      data: {
        first_name: firstName,
        last_name:  lastName,
        ...(pendingBandId     ? { pending_band_id:    pendingBandId }     : {}),
        ...(pendingPhone      ? { pending_phone:       pendingPhone }      : {}),
        ...(pendingInstrument ? { pending_instrument:  pendingInstrument } : {}),
        ...(groupName         ? { pending_group_name:  groupName }         : {}),
      },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) { showAuthErr('signupErr', error.message); return; }

  // Supabase returns a success response with an empty identities array when the
  // email already belongs to an existing account (it avoids leaking existence).
  // Detect that instead of showing a "check your inbox" screen for an email that
  // will never arrive.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    showAuthErr('signupErr', 'An account with this email already exists — try signing in or resetting your password.');
    return;
  }

  // Carry the optional group name to the onboarding wizard so a cold user isn't
  // asked for it twice. Metadata covers cross-device confirm; localStorage
  // prefills instantly in the same browser.
  if (groupName) { try { localStorage.setItem('pendingGroupName', groupName); } catch (e) {} }

  // Create profile row immediately (trigger may also do this — belt-and-suspenders)
  if (data.user) {
    await supabase.from('profiles').upsert({
      id:         data.user.id,
      first_name: firstName,
      last_name:  lastName,
      initials:   ((firstName[0] || '') + (lastName[0] || '')).toUpperCase(),
    });
  }

  // If session is null, a confirmation email was sent — show the confirmation screen
  if (!data.session) {
    document.getElementById('sf').style.display = 'none';
    const tabs = document.getElementById('auth-tabs');
    if (tabs) tabs.style.display = 'none';
    const emailEl = document.getElementById('sf-confirm-email');
    if (emailEl) emailEl.textContent = email;
    const confirmEl = document.getElementById('sf-confirm');
    if (confirmEl) confirmEl.style.display = '';
  }
  // If session exists (email confirmation disabled), onAuthStateChange fires → app loads
}

async function doForgotPassword() {
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showAuthErr('forgotErr', 'Enter your email address'); return; }

  const resetRedirect = (window.Capacitor && window.Capacitor.isNativePlatform())
    ? 'https://bandapp.app'
    : (window.location.origin + window.location.pathname);
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: resetRedirect,
  });

  if (error) { showAuthErr('forgotErr', error.message); return; }

  document.getElementById('ff').style.display = 'none';
  const sentEl = document.getElementById('ff-sent');
  if (sentEl) {
    const em = document.getElementById('ff-sent-email');
    if (em) em.textContent = email;
    sentEl.style.display = '';
  }
}

async function doChangePassword() {
  const newPw     = document.getElementById('settNewPw')?.value || '';
  const confirmPw = document.getElementById('settConfirmPw')?.value || '';
  if (!newPw || newPw.length < 8) { toast2('Password must be at least 8 characters', 'w'); return; }
  if (newPw !== confirmPw) { toast2('Passwords do not match', 'w'); return; }

  const { error } = await supabase.auth.updateUser({ password: newPw });
  if (error) { toast2(error.message, 'w'); return; }

  document.getElementById('settNewPw').value = '';
  document.getElementById('settConfirmPw').value = '';
  toast2('Password updated!');
}

async function doResetPassword() {
  const newPw     = document.getElementById('resetNewPw')?.value || '';
  const confirmPw = document.getElementById('resetConfirmPw')?.value || '';
  if (!newPw || newPw.length < 8) { showAuthErr('resetErr', 'Password must be at least 8 characters'); return; }
  if (newPw !== confirmPw) { showAuthErr('resetErr', 'Passwords do not match'); return; }

  // Keep _inPasswordRecovery = true so the SIGNED_IN that fires after updateUser
  // does not auto-load the app — the user must sign in explicitly with the new password.
  const { error } = await supabase.auth.updateUser({ password: newPw });
  if (error) {
    showAuthErr('resetErr', error.message);
    return;
  }

  // Sign out the recovery session, then land on the Sign In screen.
  // SIGNED_OUT is blocked by the _inPasswordRecovery guard, so we transition manually.
  try { await supabase.auth.signOut(); } catch (_) {}
  _inPasswordRecovery = false;
  // Remove the recovery URL params so that a page refresh doesn't re-activate
  // the _inPasswordRecovery guard and block the next normal sign-in.
  window.history.replaceState({}, '', window.location.pathname);
  if (typeof switchTab === 'function') switchTab('login');
  toast2('Password updated! Please sign in with your new password.');
}

async function doLogout() {
  // Show the auth screen immediately so the button always feels responsive,
  // regardless of network latency or whether signOut() eventually times out.
  document.getElementById('app').classList.remove('vis');
  document.getElementById('authScreen').style.display = 'flex';
  if (typeof switchTab === 'function') switchTab('login');
  // Invalidate the server-side session in the background.
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.warn('[bandapp] signOut error:', e?.message);
    try { await supabase.auth.signOut({ scope: 'local' }); } catch (_) {}
  }
}

// ── Auth state listener — wires everything together ───────────

// Initialised synchronously from the URL — BEFORE onAuthStateChange is
// registered — so that if Supabase replays INITIAL_SESSION immediately on
// listener registration (race condition with fast PKCE code exchange), the
// guard is already in place.  Cleared by doResetPassword just before calling
// updateUser so the subsequent SIGNED_IN can proceed normally.
let _inPasswordRecovery = (function () {
  const p = new URLSearchParams(window.location.search);
  const h = window.location.hash;
  return p.get('type') === 'recovery' || h.includes('type=recovery');
}());

supabase.auth.onAuthStateChange(async (event, session) => {
  // The one-click RSVP page (/rsvp?token=…) is fully self-contained and must
  // never be replaced by the app shell or sign-in screen, logged in or not.
  if (window.RSVP_ONECLICK) return;

  if (event === 'PASSWORD_RECOVERY') {
    _inPasswordRecovery = true;
    // User clicked the reset-password link in their email — show the reset form
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    ['lf','sf','sf-confirm','ff','ff-sent','authLoading'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const tabs = document.getElementById('auth-tabs');
    if (tabs) tabs.style.display = 'none';
    const rpf = document.getElementById('reset-pw-form');
    if (rpf) rpf.style.display = '';
    return;
  }

  if (event === 'SIGNED_OUT') {
    // Don't disrupt the reset-password form, and don't call switchTab('login')
    // while a token exchange is still in progress (?code= or #access_token in URL).
    if (_inPasswordRecovery) return;
    const _soParams = new URLSearchParams(window.location.search);
    if (_soParams.get('code') || window.location.hash.includes('access_token')) return;
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    const fbBtn = document.getElementById('fbBtn');
    if (fbBtn) fbBtn.style.display = 'none';
    if (typeof switchTab === 'function') switchTab('login');
    return;
  }

  // While the recovery form is open, suppress any automatic sign-in events so the
  // user isn't pushed into the app before they've set their new password.
  if (_inPasswordRecovery) {
    _clearLoginTimer(); // auth succeeded — don't let the safety timer fire as a timeout
    return;
  }

  // Only run full init on login / session restore — not on token refreshes
  if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;

  // Auth call succeeded — clear the safety timer immediately.
  // The timer only guards the auth round-trip; DB queries below are not its concern.
  _clearLoginTimer();

  if (!session || !session.user) {
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    return;
  }

  // Snapshot metadata before the try block so the catch can use it for invited-user recovery
  const _sessionMeta = session.user.user_metadata || {};

  try {
    await loadCurrentUser(session.user.id, session.user.email);

    // Restore invite params from confirmation-email URL into sessionStorage (new-tab safe)
    const _urlParams = new URLSearchParams(window.location.search);
    const _meta = session.user.user_metadata || {};

    // If an invite token is in user metadata (set by the invite-member edge function),
    // mark it as used. Token can also come from the URL (?invite=) for manual share links.
    const _inviteToken = _meta.invite_token || _urlParams.get('invite') || sessionStorage.getItem('inviteToken') || '';
    if (_inviteToken) {
      supabase.rpc('mark_invite_used', { p_token: _inviteToken }).then(null, () => {});
      sessionStorage.removeItem('inviteToken');
    }

    // Auto-join band from invite link (?band=UUID) or sessionStorage or user metadata
    const _pendingBandId = _urlParams.get('band') || sessionStorage.getItem('pendingBandId') || _meta.pending_band_id || _meta.invited_band_id || '';
    if (_pendingBandId) {
      const { data: joinData, error: joinErr } = await supabase.rpc('join_band_by_code', { p_code: _pendingBandId });
      if (joinData?.success) {
        currentUser._memberships = [...(currentUser._memberships || []), { band_id: joinData.band_id, role: 'member' }];
        activeBandId = joinData.band_id;
        localStorage.setItem('activeBandId', joinData.band_id);
        sessionStorage.removeItem('pendingBandId');
        window.history.replaceState({}, '', window.location.pathname);
      } else if (joinData?.error === 'already_member') {
        // User was pre-enrolled by the invite edge function — still navigate to the invited band
        activeBandId = _pendingBandId;
        localStorage.setItem('activeBandId', _pendingBandId);
        sessionStorage.removeItem('pendingBandId');
        sessionStorage.removeItem('inviteToken');
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        // RPC not deployed or network error — clean URL but keep pendingBandId for retry on next login
        window.history.replaceState({}, '', window.location.pathname);
        if (joinErr) console.warn('[bandapp] join_band_by_code failed:', joinErr?.message);
      }
    }

    // Hide auth screen and show the app shell immediately — data loads in the background
    ['lf','sf','sf-confirm','ff','ff-sent','auth-tabs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.getElementById('authScreen').style.display = 'none';
    initSbState();
    document.getElementById('app').classList.add('vis');

    // Show the password-setup modal BEFORE initApp for invited users —
    // initApp may take a moment to load data and the user must set their
    // password first regardless. The app data loads in the background.
    // IMPORTANT: hide the appLoader first — it sits at z-index 9999 which
    // would completely cover the onboarding modal (z-index 500).
    if (_meta.needs_onboarding) {
      const _loader = document.getElementById('appLoader');
      if (_loader) _loader.style.display = 'none';
      if (typeof showOnboarding === 'function') showOnboarding();
    }

    try {
      await initApp();
    } catch (e) {
      console.error('[bandapp] initApp error:', e);
      const _el = document.getElementById('appLoader');
      if (_el) _el.style.display = 'none';
    }
  } catch (e) {
    console.error('[bandapp] sign-in error:', e);
    _clearLoginTimer();
    _resetLoginBtn();

    // Invited users must set a password before anything else works.
    // If init threw for any reason, still show the onboarding modal rather than
    // dumping them on the sign-in screen with no way to proceed.
    if (_sessionMeta.needs_onboarding) {
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('app').classList.add('vis');
      const _loader = document.getElementById('appLoader');
      if (_loader) _loader.style.display = 'none';
      if (typeof showOnboarding === 'function') showOnboarding();
      return;
    }

    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    if (typeof switchTab === 'function') switchTab('login');
    const _errMsg = e?.message ? `Sign-in error: ${e.message}` : 'Sign-in error — please try again';
    if (typeof showAuthErr === 'function') showAuthErr('loginErr', _errMsg);
    else if (typeof toast2 === 'function') toast2(_errMsg, 'w');
  }
});

// On first load, restore an existing session without waiting for the event
// Capture URL params synchronously here — getSession() may trigger a PKCE code exchange
// which calls history.replaceState to remove ?code= before we get to check it below.
const _initUrlParams = new URLSearchParams(window.location.search);
const _initHash = window.location.hash;
(async () => {
  // Skip session restore entirely on the one-click RSVP page.
  if (window.RSVP_ONECLICK) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const p = _initUrlParams;

    // If the URL contained a Supabase auth token (PKCE ?code= or implicit #access_token),
    // the client is in the middle of exchanging an invite/magic-link.
    // Show the loading spinner and bail — onAuthStateChange will handle sign-in and
    // the onboarding modal once the exchange completes.
    const _hash = _initHash;
    if (p.get('code') || _hash.includes('access_token')) {
      // A token exchange is in progress — show only the loading spinner.
      // Hide everything else so no Sign In form bleeds through while we wait.
      document.getElementById('authScreen').style.display = 'flex';
      ['lf','sf','sf-confirm','ff','ff-sent','auth-tabs'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      document.getElementById('authLoading').style.display = 'flex';
      return;
    }

    document.getElementById('authScreen').style.display = 'flex';

    // Opaque invite token — look up all metadata server-side so no PII travels in the URL.
    if (p.get('invite')) {
      sessionStorage.setItem('inviteToken', p.get('invite'));
      try {
        const { data: _invData } = await supabase.rpc('get_invite_by_token', { p_token: p.get('invite') });
        if (_invData && !_invData.error) {
          if (_invData.band_id)    sessionStorage.setItem('pendingBandId',    _invData.band_id);
          if (_invData.band_name)  sessionStorage.setItem('inviteBandName',   _invData.band_name);
          if (_invData.first_name) sessionStorage.setItem('inviteFirst',      _invData.first_name);
          if (_invData.last_name)  sessionStorage.setItem('inviteLast',       _invData.last_name);
          if (_invData.email)      sessionStorage.setItem('inviteEmail',      _invData.email);
          if (_invData.instrument) sessionStorage.setItem('inviteInstrument', _invData.instrument);
        }
      } catch (_) { /* non-fatal */ }
    }

    // Legacy plain-band join link (?band=UUID) — no PII, just the band identifier
    if (p.get('band')) sessionStorage.setItem('pendingBandId', p.get('band'));

    // Switch to signup and show invite UI if ANY invite param is present
    const _hasInvite = ['bandname','fname','lname','email','phone','instrument','band'].some(k => p.get(k));
    if (_hasInvite) {
      if (typeof switchTab === 'function') switchTab('signup');
      if (p.get('fname')) { const el = document.getElementById('signupFirst'); if (el) el.value = p.get('fname'); }
      if (p.get('lname')) { const el = document.getElementById('signupLast');  if (el) el.value = p.get('lname'); }
      if (p.get('email')) { const el = document.getElementById('signupEmail'); if (el) el.value = p.get('email'); }
      // Show invite banner with band name
      const _banner    = document.getElementById('sf-invite-banner');
      const _bandEl    = document.getElementById('sf-invite-group');
      const _bandField = document.getElementById('sfGroupField');
      const _bandName  = p.get('bandname') || '';
      if (_banner) _banner.style.display = '';
      if (_bandEl && _bandName) _bandEl.textContent = _bandName;
      if (_bandField) _bandField.style.display = 'none'; // hide "create band" field for invitees
    }
  }
  // If session exists, onAuthStateChange fires automatically
})();
