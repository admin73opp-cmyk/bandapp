-- ============================================================
-- Fix / recreate the demo auth user
-- Run in Supabase SQL Editor (safe to re-run).
-- ============================================================

begin;

-- 1. Remove any existing demo user rows (cascades to profiles → band_members)
delete from auth.users where email = 'demo@bandapp.com';

-- 2. Re-insert auth user with all columns modern Supabase requires
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data,
   is_sso_user, is_anonymous)
values
  ('b0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'demo@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Marco","last_name":"Rossi"}',
   false, false);

-- 3. Re-insert Marco's profile (was cascade-deleted in step 1)
insert into profiles
  (id, first_name, last_name, initials, instrument, instrument2, vocals,
   availability, color, bday, nationality, country, lang, bio, gear,
   youtube_url, instagram_url)
values
  ('b0000000-0000-0000-0000-000000000001',
   'Marco','Rossi','MR','Guitar','','Lead',
   '{1,0,1,0,1,0,0}','#6C63FF',
   '1988-03-14','IT','BE','en',
   'Guitarist and founder of The Jazz Cats. Playing jazz since age 14.',
   'Fender Stratocaster, Boss RC-500, Line 6 HX Stomp',
   'https://youtube.com/@marcojazz','https://instagram.com/marcorossi_guitar')
on conflict (id) do update
  set first_name = excluded.first_name,
      last_name  = excluded.last_name;

-- 4. Make sure band_members links exist for Marco
--    (only insert if bands exist — harmless if bands table is empty)
insert into band_members (band_id, user_id, role)
select 'a0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'admin'
where exists (select 1 from bands where id = 'a0000000-0000-0000-0000-000000000001')
on conflict (band_id, user_id) do nothing;

insert into band_members (band_id, user_id, role)
select 'a0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'admin'
where exists (select 1 from bands where id = 'a0000000-0000-0000-0000-000000000002')
on conflict (band_id, user_id) do nothing;

commit;

-- Verify
select id, email, email_confirmed_at from auth.users where email = 'demo@bandapp.com';
select id, first_name, last_name from profiles where id = 'b0000000-0000-0000-0000-000000000001';
