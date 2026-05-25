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

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pw    = document.getElementById('loginPassword').value;
  if (!email || !pw) { toast2('Enter email and password', 'w'); return; }

  const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
  if (error) { toast2(error.message, 'w'); }
  // onAuthStateChange handles the rest
}

async function doSignUp() {
  const firstName = document.getElementById('signupFirst').value.trim();
  const lastName  = document.getElementById('signupLast').value.trim();
  const email     = document.getElementById('signupEmail').value.trim();
  const pw        = document.getElementById('signupPassword').value;

  if (!email || !pw) { toast2('Enter email and password', 'w'); return; }
  if (pw.length < 6) { toast2('Password must be at least 6 characters', 'w'); return; }

  const pendingBandId   = sessionStorage.getItem('pendingBandId')   || new URLSearchParams(window.location.search).get('band') || '';
  const pendingPhone    = sessionStorage.getItem('invitePhone')      || '';
  const pendingInstrument = sessionStorage.getItem('inviteInstrument') || '';
  const baseUrl = localStorage.getItem('appUrl') || (window.location.origin + window.location.pathname);
  // Embed all invite params in the confirmation-email redirect URL so they survive new-tab opens
  const _rp = new URLSearchParams();
  if (pendingBandId)    _rp.set('band',       pendingBandId);
  if (pendingPhone)     _rp.set('phone',       pendingPhone);
  if (pendingInstrument) _rp.set('instrument', pendingInstrument);
  const redirectTo = _rp.toString() ? `${baseUrl}?${_rp.toString()}` : baseUrl;

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pw,
    options: {
      data: {
        first_name: firstName,
        last_name:  lastName,
        ...(pendingBandId     ? { pending_band_id:     pendingBandId }     : {}),
        ...(pendingPhone      ? { pending_phone:        pendingPhone }      : {}),
        ...(pendingInstrument ? { pending_instrument:   pendingInstrument } : {}),
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

async function doDemo() {
  const { error } = await supabase.auth.signInWithPassword({
    email:    'demo@bandapp.com',
    password: 'demo1234',
  });
  if (error) {
    console.error('[bandapp] demo login error:', error?.status, error?.message, error);
    toast2(error.message, 'w');
  }
}

async function doLogout() {
  await supabase.auth.signOut();
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
  await loadCurrentUser(session.user.id, session.user.email);

  // Restore invite params from confirmation-email URL into sessionStorage (new-tab safe)
  const _urlParams = new URLSearchParams(window.location.search);
  if (_urlParams.get('phone'))      sessionStorage.setItem('invitePhone',      _urlParams.get('phone'));
  if (_urlParams.get('instrument')) sessionStorage.setItem('inviteInstrument', _urlParams.get('instrument'));
  // Also fall back to user metadata (set during signup) if sessionStorage is empty
  const _meta = session.user.user_metadata || {};
  if (!sessionStorage.getItem('invitePhone')      && _meta.pending_phone)      sessionStorage.setItem('invitePhone',      _meta.pending_phone);
  if (!sessionStorage.getItem('inviteInstrument') && _meta.pending_instrument) sessionStorage.setItem('inviteInstrument', _meta.pending_instrument);

  // Auto-join band from invite link (?band=UUID) or sessionStorage or user metadata
  const _pendingBandId = _urlParams.get('band') || sessionStorage.getItem('pendingBandId') || _meta.pending_band_id || '';
  if (_pendingBandId) {
    const { data: joinData, error: joinErr } = await supabase.rpc('join_band_by_code', { p_code: _pendingBandId });
    if (joinData?.success) {
      currentUser._memberships = [...(currentUser._memberships || []), { band_id: joinData.band_id, role: 'member' }];
      activeBandId = joinData.band_id;
      localStorage.setItem('activeBandId', joinData.band_id);
      sessionStorage.removeItem('pendingBandId');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (joinData?.error === 'already_member') {
      sessionStorage.removeItem('pendingBandId');
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // RPC not deployed or network error — clean URL but keep pendingBandId for retry on next login
      window.history.replaceState({}, '', window.location.pathname);
      if (joinErr) console.warn('[bandapp] join_band_by_code failed:', joinErr?.message);
    }
  }

  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').classList.add('vis');
  initSbState();
  await initApp();

  // Invited users land with needs_onboarding=true — show password-setup overlay
  if (_meta.needs_onboarding) {
    if (typeof showOnboarding === 'function') showOnboarding();
  }
});

// On first load, restore an existing session without waiting for the event
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    document.getElementById('authScreen').style.display = 'flex';
    // Pre-fill signup form from invite URL params
    const p = new URLSearchParams(window.location.search);
    // Store all invite params in sessionStorage so they survive the email confirmation redirect
    if (p.get('bandname'))   sessionStorage.setItem('inviteBandName',   p.get('bandname'));
    if (p.get('fname'))      sessionStorage.setItem('inviteFirst',      p.get('fname'));
    if (p.get('lname'))      sessionStorage.setItem('inviteLast',       p.get('lname'));
    if (p.get('email'))      sessionStorage.setItem('inviteEmail',      p.get('email'));
    if (p.get('phone'))      sessionStorage.setItem('invitePhone',      p.get('phone'));
    if (p.get('instrument')) sessionStorage.setItem('inviteInstrument', p.get('instrument'));
    if (p.get('band'))       sessionStorage.setItem('pendingBandId',    p.get('band'));

    // Switch to signup and show invite UI if ANY invite param is present
    const _hasInvite = ['bandname','fname','lname','email','phone','instrument','band'].some(k => p.get(k));
    if (_hasInvite) {
      if (typeof switchTab === 'function') switchTab('signup');
      if (p.get('fname')) { const el = document.getElementById('signupFirst'); if (el) el.value = p.get('fname'); }
      if (p.get('lname')) { const el = document.getElementById('signupLast');  if (el) el.value = p.get('lname'); }
      if (p.get('email')) { const el = document.getElementById('signupEmail'); if (el) el.value = p.get('email'); }
      // Show invite banner with band name
      const _banner   = document.getElementById('sf-invite-banner');
      const _bandEl   = document.getElementById('sf-invite-band');
      const _bandField = document.getElementById('sfBandField');
      const _bandName = p.get('bandname') || '';
      if (_banner) _banner.style.display = '';
      if (_bandEl && _bandName) _bandEl.textContent = _bandName;
      if (_bandField) _bandField.style.display = 'none'; // hide "create band" field for invitees
    }
  }
  // If session exists, onAuthStateChange fires automatically
})();
