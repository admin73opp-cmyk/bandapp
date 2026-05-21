// Supabase anon key is safe to expose in client-side code.
// RLS policies (rls.sql) enforce all data access rules.
// Replace the placeholder values below with your project credentials
// from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = 'https://supabase.com/dashboard/project/yhnoxgoibtbwcavzwddj';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlobm94Z29pYnRid2Nhdnp3ZGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjQyNDQsImV4cCI6MjA5NDk0MDI0NH0.gisqe_pVf9oB3-hCTZeAQBZCtNA4I1T0ep8PcywTrgoYOUR_ANON_KEY';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
