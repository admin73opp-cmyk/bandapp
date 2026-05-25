// Supabase anon key is safe to expose in client-side code.
// RLS policies (rls.sql) enforce all data access rules.
// Replace the placeholder values below with your project credentials
// from: Supabase Dashboard → Project Settings → API
const SUPABASE_URL      = 'https://yhnoxgoibtbwcavzwddj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlobm94Z29pYnRid2Nhdnp3ZGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNjQyNDQsImV4cCI6MjA5NDk0MDI0NH0.gisqe_pVf9oB3-hCTZeAQBZCtNA4I1T0ep8PcywTrgo';

// Fine-grained PAT with issues:write scope — used by the in-app feedback button
const GITHUB_FEEDBACK_TOKEN = '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';

// Use var (not const) so it coexists with the CDN's own 'supabase' global
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
