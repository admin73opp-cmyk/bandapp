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
    handleDbError(error);
    // Continue without profile data; memberships will also be empty
    return;
  }

  currentUser.firstName  = profile.first_name  || '';
  currentUser.lastName   = profile.last_name   || '';
  currentUser.instrument = profile.instrument  || '';
  currentUser.color      = profile.color       || '#6C63FF';
  currentUser.lang       = profile.lang        || 'en';

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password: pw,
    options: { data: { first_name: firstName, last_name: lastName } },
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
  if (!confirm('Log out of Bandapp?')) return;
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
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').classList.add('vis');
  initSbState();
  await initApp();
});

// On first load, restore an existing session without waiting for the event
(async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    document.getElementById('authScreen').style.display = 'flex';
  }
  // If session exists, onAuthStateChange fires automatically
})();
