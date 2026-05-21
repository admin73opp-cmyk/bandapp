// ── Auth helpers ─────────────────────────────────────────────

function handleDbError(err) {
  console.error('[bandapp]', err);
  toast2(err.message || 'Something went wrong', 'w');
}

async function loadCurrentUser(uid) {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', uid)
    .single();

  if (error) { handleDbError(error); return; }

  currentUser.id         = uid;
  currentUser.firstName  = profile.first_name  || '';
  currentUser.lastName   = profile.last_name   || '';
  currentUser.instrument = profile.instrument  || '';
  currentUser.color      = profile.color       || '#6C63FF';
  currentUser.lang       = profile.lang        || 'en';

  // Load band membership for this user to determine role in active band
  const { data: memberships } = await supabase
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

  toast2('Account created! Check your email to confirm.');
}

async function doDemo() {
  const { error } = await supabase.auth.signInWithPassword({
    email:    'demo@bandapp.com',
    password: 'demo1234',
  });
  if (error) { toast2(error.message, 'w'); }
}

async function doLogout() {
  if (!confirm('Log out of Bandapp?')) return;
  await supabase.auth.signOut();
}

// ── Auth state listener — wires everything together ───────────

supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    return;
  }
  // Only run full init on login / session restore — not on token refreshes
  if (event !== 'SIGNED_IN' && event !== 'INITIAL_SESSION') return;
  if (!session) {
    document.getElementById('app').classList.remove('vis');
    document.getElementById('authScreen').style.display = 'flex';
    return;
  }
  await loadCurrentUser(session.user.id);
  if (!activeBandId) {
    console.warn('[bandapp] activeBandId is null after loadCurrentUser — user may have no band memberships');
  }
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
