// ── Auth helpers ─────────────────────────────────────────────

function handleDbError(err) {
  console.error('[bandapp] DB error:', err?.code, err?.message, err?.details, err?.hint, err);
  toast2(err.message || 'Something went wrong', 'w');
}

async function loadCurrentUser(uid, email) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  currentUser.id    = uid;
  currentUser.email = email || '';

  if (error) {
    console.error('[bandapp] profiles query failed — code:', error?.code, 'message:', error?.message);
    // Profile row missing (common for new users if RLS blocked the insert at signup).
    // Fall back to auth metadata and create the row now that the user is authenticated.
    const { data: { user: authUser } } = await supabase.auth.getUser();
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

  // Load band membership for this user to determine role in active band
  const { data: memberships, error: memErr } = await supabase
    .from('band_members')
    .select('band_id, role')
    .eq('user_id', uid);

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
  if (!email || !pw) { toast2('Enter email and password', 'w'); return; }

  const btn = document.getElementById('loginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  _clearLoginTimer();
  _loginSafetyTimer = setTimeout(() => {
    _resetLoginBtn();
    if (typeof toast2 === 'function') toast2('Sign-in timed out — please try again', 'w');
  }, 20000);

  const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) {
    _clearLoginTimer();
    _resetLoginBtn();
    toast2(error.message, 'w');
  }
  // onAuthStateChange handles the rest on success; it clears _loginSafetyTimer
}

async function doSignUp() {
  const firstName = document.getElementById('signupFirst').value.trim();
  const lastName  = document.getElementById('signupLast').value.trim();
  const email     = document.getElementById('signupEmail').value.trim();
  const pw        = document.getElementById('signupPassword').value;

  if (!email || !pw) { toast2('Enter email and password', 'w'); return; }
  if (pw.length < 8) { toast2('Password must be at least 8 characters', 'w'); return; }

  const pendingBandId = sessionStorage.getItem('pendingBandId') || new URLSearchParams(window.location.search).get('band') || '';
  const baseUrl = localStorage.getItem('appUrl') || (window.location.origin + window.location.pathname);
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
      },
      emailRedirectTo: redirectTo,
    },
  });

  if (error) { toast2(error.message, 'w'); return; }

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
  if (!email) { toast2('Enter your email address', 'w'); return; }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });

  if (error) { toast2(error.message, 'w'); return; }

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
  if (!newPw || newPw.length < 6) { toast2('Password must be at least 6 characters', 'w'); return; }
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
  if (!newPw || newPw.length < 6) { toast2('Password must be at least 6 characters', 'w'); return; }
  if (newPw !== confirmPw) { toast2('Passwords do not match', 'w'); return; }

  const { error } = await supabase.auth.updateUser({ password: newPw });
  if (error) { toast2(error.message, 'w'); return; }

  toast2('Password reset! Signing you in…');
  // onAuthStateChange will fire with SIGNED_IN after updateUser when in PASSWORD_RECOVERY state
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

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    // User clicked the reset-password link in their email — show the reset form
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    ['lf','sf','sf-confirm','ff','ff-sent'].forEach(id => {
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
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    const fbBtn = document.getElementById('fbBtn');
    if (fbBtn) fbBtn.style.display = 'none';
    if (typeof switchTab === 'function') switchTab('login');
    return;
  }

  // Only run full init on login / session restore — not on token refreshes
  if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
  if (!session) {
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    return;
  }

  try {
    await loadCurrentUser(session.user.id, session.user.email);

    // Restore invite params from confirmation-email URL into sessionStorage (new-tab safe)
    const _urlParams = new URLSearchParams(window.location.search);
    const _meta = session.user.user_metadata || {};

    // If an opaque invite token is in the URL, look up the metadata server-side
    // so no PII ever travels in query parameters.
    const _inviteToken = _urlParams.get('invite') || sessionStorage.getItem('inviteToken') || '';
    if (_inviteToken) {
      try {
        const { data: _invData } = await supabase.rpc('get_invite_by_token', { p_token: _inviteToken });
        if (_invData && !_invData.error) {
          if (_invData.band_id    && !sessionStorage.getItem('pendingBandId'))    sessionStorage.setItem('pendingBandId',    _invData.band_id);
          if (_invData.band_name  && !sessionStorage.getItem('inviteBandName'))   sessionStorage.setItem('inviteBandName',   _invData.band_name);
          if (_invData.first_name && !sessionStorage.getItem('inviteFirst'))      sessionStorage.setItem('inviteFirst',      _invData.first_name);
          if (_invData.last_name  && !sessionStorage.getItem('inviteLast'))       sessionStorage.setItem('inviteLast',       _invData.last_name);
          if (_invData.instrument && !sessionStorage.getItem('inviteInstrument')) sessionStorage.setItem('inviteInstrument', _invData.instrument);
          sessionStorage.setItem('inviteToken', _inviteToken);
        }
      } catch (_) { /* non-fatal — band join still works via invited_band_id in metadata */ }
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
        // Mark the invite token as used so it can't be replayed
        const _usedToken = sessionStorage.getItem('inviteToken');
        if (_usedToken) {
          supabase.rpc('mark_invite_used', { p_token: _usedToken }).catch(() => {});
          sessionStorage.removeItem('inviteToken');
        }
        window.history.replaceState({}, '', window.location.pathname);
      } else if (joinData?.error === 'already_member') {
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
    _clearLoginTimer();
    ['lf','sf','sf-confirm','ff','ff-sent','auth-tabs'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    document.getElementById('authScreen').style.display = 'none';
    initSbState();
    document.getElementById('app').classList.add('vis');

    try {
      await initApp();
    } catch (e) {
      console.error('[bandapp] initApp error:', e);
    }

    // Invited users land with needs_onboarding=true — show password-setup overlay
    if (_meta.needs_onboarding) {
      if (typeof showOnboarding === 'function') showOnboarding();
    }
  } catch (e) {
    console.error('[bandapp] sign-in error:', e);
    _clearLoginTimer();
    _resetLoginBtn();
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    // switchTab resets authLoading and shows the login form (handles invite-loading state too)
    if (typeof switchTab === 'function') switchTab('login');
    if (typeof toast2 === 'function') toast2('Sign-in error — please try again', 'w');
  }
});

// On first load, restore an existing session without waiting for the event
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    const p = new URLSearchParams(window.location.search);

    // If the URL contains a Supabase auth token (PKCE ?code= or implicit #access_token),
    // the client is in the middle of exchanging an invite/magic-link.
    // Show the loading spinner and bail — onAuthStateChange will handle sign-in and
    // the onboarding modal once the exchange completes.
    const _hash = window.location.hash;
    if (p.get('code') || _hash.includes('access_token')) {
      document.getElementById('authScreen').style.display = 'flex';
      document.getElementById('authLoading').style.display = 'flex';
      document.getElementById('auth-tabs').style.display = 'none';
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
      const _bandEl    = document.getElementById('sf-invite-band');
      const _bandField = document.getElementById('sfBandField');
      const _bandName  = p.get('bandname') || '';
      if (_banner) _banner.style.display = '';
      if (_bandEl && _bandName) _bandEl.textContent = _bandName;
      if (_bandField) _bandField.style.display = 'none'; // hide "create band" field for invitees
    }
  }
  // If session exists, onAuthStateChange fires automatically
})();
