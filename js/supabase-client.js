// Supabase anon key is safe to expose in client-side code.
// RLS policies (rls.sql) enforce all data access rules.
// Replace the placeholder values below with your project credentials
// from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = 'https://YOUR_PROJECT_REF.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
