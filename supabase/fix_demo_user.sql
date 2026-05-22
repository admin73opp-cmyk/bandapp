-- ============================================================
-- Fix demo user — run this in Supabase SQL Editor if
-- "database error querying schema" appears on demo login.
--
-- What this does:
--   1. Shows you what's currently in auth.users for demo@bandapp.com
--   2. Deletes any broken/incomplete demo user row
--   3. Re-inserts the demo user with all required columns
--   4. Upserts the matching profile row
-- ============================================================

-- Step 1: See what exists now (read-only — always safe to run)
select id, email, email_confirmed_at, created_at
from auth.users
where email = 'demo@bandapp.com';

select id, first_name, last_name
from profiles
where id = 'b0000000-0000-0000-0000-000000000001';
