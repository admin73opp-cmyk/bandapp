-- ============================================================================
-- Ritovo — App Store demo data seed
-- Creates one fully-fake band ("Velvet Static") with 8 fake members, songs,
-- a setlist, rehearsals, concerts, and availability — for App Store
-- screenshots and the App Review demo login. No real user data is touched.
-- Idempotent: safe to re-run (guarded by a fixed band UUID).
-- ============================================================================

do $$
declare
  v_band_id   uuid := '11111111-1111-4111-8111-111111111111';
  v_setlist   uuid := '11111111-1111-4111-8111-111111111112';

  -- fake members [user_id, first, last, instrument, instrument2, vocals, color, availability]
  u_alex      uuid := '21111111-1111-4111-8111-111111111101'; -- admin / reviewer login
  u_jordan    uuid := '21111111-1111-4111-8111-111111111102';
  u_morgan    uuid := '21111111-1111-4111-8111-111111111103';
  u_casey     uuid := '21111111-1111-4111-8111-111111111104';
  u_taylor    uuid := '21111111-1111-4111-8111-111111111105';
  u_sam       uuid := '21111111-1111-4111-8111-111111111106';
  u_riley     uuid := '21111111-1111-4111-8111-111111111107';
  u_drew      uuid := '21111111-1111-4111-8111-111111111108';

  s_neon      uuid := 'a1111111-0000-4111-8111-111111111001';
  s_paper     uuid := 'a1111111-0000-4111-8111-111111111002';
  s_slow      uuid := 'a1111111-0000-4111-8111-111111111003';
  s_harbor    uuid := 'a1111111-0000-4111-8111-111111111004';
  s_static    uuid := 'a1111111-0000-4111-8111-111111111005';
  s_glass     uuid := 'a1111111-0000-4111-8111-111111111006';
  s_amber     uuid := 'a1111111-0000-4111-8111-111111111007';
  s_echoes    uuid := 'a1111111-0000-4111-8111-111111111008';
  s_wildfire  uuid := 'a1111111-0000-4111-8111-111111111009';
  s_midnight  uuid := 'a1111111-0000-4111-8111-111111111010';
  s_lowtide   uuid := 'a1111111-0000-4111-8111-111111111011';
  s_afterglow uuid := 'a1111111-0000-4111-8111-111111111012';
begin

  -- ── Auth users (fake, confirmed, direct-insert) ──────────────────────────
  insert into auth.users
    (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
     raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values
    ('00000000-0000-0000-0000-000000000000', u_alex,   'authenticated', 'authenticated', 'ritovo.demo@73opp.com',        crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Alex","last_name":"Rivera"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_jordan, 'authenticated', 'authenticated', 'ritovo.demo.jordan@73opp.com', crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Jordan","last_name":"Kim"}',    now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_morgan, 'authenticated', 'authenticated', 'ritovo.demo.morgan@73opp.com', crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Morgan","last_name":"Reyes"}',  now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_casey,  'authenticated', 'authenticated', 'ritovo.demo.casey@73opp.com',  crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Casey","last_name":"Nolan"}',   now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_taylor, 'authenticated', 'authenticated', 'ritovo.demo.taylor@73opp.com', crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Taylor","last_name":"Brooks"}', now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_sam,    'authenticated', 'authenticated', 'ritovo.demo.sam@73opp.com',    crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Sam","last_name":"Okafor"}',    now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_riley,  'authenticated', 'authenticated', 'ritovo.demo.riley@73opp.com', crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Riley","last_name":"Chen"}',    now(), now()),
    ('00000000-0000-0000-0000-000000000000', u_drew,   'authenticated', 'authenticated', 'ritovo.demo.drew@73opp.com',   crypt('RitovoDemo2026!', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"first_name":"Drew","last_name":"Whitfield"}', now(), now())
  on conflict (id) do nothing;

  -- GoTrue chokes on NULL varchar tokens (vs. '') when querying the schema
  update auth.users set
    confirmation_token = coalesce(confirmation_token, ''),
    recovery_token = coalesce(recovery_token, ''),
    email_change_token_new = coalesce(email_change_token_new, ''),
    email_change = coalesce(email_change, '')
  where id in (u_alex,u_jordan,u_morgan,u_casey,u_taylor,u_sam,u_riley,u_drew);

  insert into auth.identities (id, provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
  select gen_random_uuid(), u.id::text, u.id, jsonb_build_object('sub', u.id::text, 'email', u.email), 'email', now(), now(), now()
  from auth.users u
  where u.id in (u_alex,u_jordan,u_morgan,u_casey,u_taylor,u_sam,u_riley,u_drew)
  on conflict do nothing;

  -- ── Profiles ──────────────────────────────────────────────────────────────
  insert into public.profiles (id, first_name, last_name, initials, instrument, instrument2, vocals, availability, color, country, bio)
  values
    (u_alex,   'Alex',   'Rivera',    'AR', 'Guitar',      null,          'Lead vocals',    '{1,1,1,1,1,1,0}', '#7C6CF6', 'United States', 'Founder & frontperson of Velvet Static.'),
    (u_jordan, 'Jordan', 'Kim',       'JK', 'Bass Guitar', null,          'Backing vocals', '{1,1,1,1,1,1,1}', '#4ECCA3', 'United States', null),
    (u_morgan, 'Morgan', 'Reyes',     'MR', 'Drums',       null,          null,             '{0,1,1,1,1,1,1}', '#F6B93B', 'United States', null),
    (u_casey,  'Casey',  'Nolan',     'CN', 'Piano / Keys', 'Percussion', 'Backing vocals', '{1,1,1,1,1,1,0}', '#E15A97', 'United States', null),
    (u_taylor, 'Taylor', 'Brooks',    'TB', 'Saxophone',   null,          null,             '{1,1,1,1,1,1,1}', '#3AA6D9', 'United States', null),
    (u_sam,    'Sam',    'Okafor',    'SO', 'Percussion',  'Piano / Keys','Backing vocals', '{1,1,1,0,1,1,0}', '#9C6ADE', 'United States', null),
    (u_riley,  'Riley',  'Chen',      'RC', 'Guitar',      null,          'Backing vocals', '{1,0,1,1,1,1,1}', '#5AD1B8', 'United States', null),
    (u_drew,   'Drew',   'Whitfield', 'DW', 'Accordion',   'Guitar',      null,             '{1,1,0,1,1,1,1}', '#F27D51', 'United States', null)
  on conflict (id) do nothing;

  -- ── Band ──────────────────────────────────────────────────────────────────
  insert into public.bands (id, name, initials, color, city, country, genre, formed, bio)
  values (v_band_id, 'Velvet Static', 'VS', '#7C6CF6', 'Austin', 'United States', 'Indie Rock / Pop', '2019',
          'Six-piece indie rock outfit playing original songs and reworked covers around the Austin circuit.')
  on conflict (id) do nothing;

  insert into public.band_members (id, band_id, user_id, role)
  values
    (gen_random_uuid(), v_band_id, u_alex,   'admin'),
    (gen_random_uuid(), v_band_id, u_jordan, 'admin'),
    (gen_random_uuid(), v_band_id, u_morgan, 'member'),
    (gen_random_uuid(), v_band_id, u_casey,  'member'),
    (gen_random_uuid(), v_band_id, u_taylor, 'member'),
    (gen_random_uuid(), v_band_id, u_sam,    'member'),
    (gen_random_uuid(), v_band_id, u_riley,  'member'),
    (gen_random_uuid(), v_band_id, u_drew,   'guest')
  on conflict do nothing;

  -- ── Songs ─────────────────────────────────────────────────────────────────
  insert into public.songs (id, band_id, title, artist, genre, key, duration, notes)
  values
    (s_neon,      v_band_id, 'Neon Backroads',   'Velvet Static', 'Indie Rock', 'E',  212, 'Set opener — high energy'),
    (s_paper,     v_band_id, 'Paper Crown',      'Velvet Static', 'Indie Rock', 'A',  198, null),
    (s_slow,      v_band_id, 'Slow Burn Sunday', 'Velvet Static', 'Pop',        'C',  231, 'Acoustic intro'),
    (s_harbor,    v_band_id, 'Harbor Lights',    'Velvet Static', 'Indie Pop',  'G',  205, null),
    (s_static,    v_band_id, 'Static & Gold',    'Velvet Static', 'Rock',       'D',  188, 'Extended guitar solo'),
    (s_glass,     v_band_id, 'Glass Houses',     'Velvet Static', 'Indie Rock', 'Bm', 220, null),
    (s_amber,     v_band_id, 'Amber Skyline',    'Velvet Static', 'Pop Rock',   'F',  199, null),
    (s_echoes,    v_band_id, 'Echoes in Motion', 'Velvet Static', 'Indie Rock', 'Am', 240, null),
    (s_wildfire,  v_band_id, 'Wildfire Hearts',  'Velvet Static', 'Rock',       'E',  215, 'Set closer'),
    (s_midnight,  v_band_id, 'Midnight Radio',   'Velvet Static', 'Indie Pop',  'C',  203, null),
    (s_lowtide,   v_band_id, 'Low Tide',         'Velvet Static', 'Alt Rock',   'G',  227, null),
    (s_afterglow, v_band_id, 'Afterglow',        'Velvet Static', 'Pop',        'D',  195, 'Encore')
  on conflict (id) do nothing;

  -- ── Setlist ───────────────────────────────────────────────────────────────
  insert into public.setlists (id, band_id, name, date, type, venue, duration, audience, paid, total, price)
  values (v_setlist, v_band_id, 'Friday Night Live Set', current_date + 12, 'Live Show', 'The Continental Club', 60, 250, true, '400', '400')
  on conflict (id) do nothing;

  insert into public.setlist_songs (setlist_id, song_id, position)
  values
    (v_setlist, s_neon, 1), (v_setlist, s_paper, 2), (v_setlist, s_harbor, 3),
    (v_setlist, s_static, 4), (v_setlist, s_amber, 5), (v_setlist, s_glass, 6),
    (v_setlist, s_midnight, 7), (v_setlist, s_lowtide, 8), (v_setlist, s_echoes, 9),
    (v_setlist, s_wildfire, 10)
  on conflict do nothing;

  -- ── Rehearsals ────────────────────────────────────────────────────────────
  insert into public.rehearsals (id, band_id, title, location, date, start_time, end_time, notes, setlist_id, cancelled)
  values
    (gen_random_uuid(), v_band_id, 'Full Band Rehearsal', 'Riverside Studio B', current_date + 3, '19:00', '21:30', 'Run the Friday set start to finish, focus on transitions.', v_setlist, false),
    (gen_random_uuid(), v_band_id, 'New Material Session', 'Riverside Studio B', current_date + 10, '18:30', '20:30', 'Working on two new songs for next month.', null, false),
    (gen_random_uuid(), v_band_id, 'Acoustic Rehearsal',  'Alex''s Garage',      current_date - 5, '19:00', '21:00', 'Stripped-back arrangements.', null, false)
  on conflict (id) do nothing;

  -- ── Concerts ──────────────────────────────────────────────────────────────
  insert into public.concerts (id, band_id, title, venue, date, time, duration, audience, paid, total, price, notes, cancelled)
  values
    (gen_random_uuid(), v_band_id, 'Friday Night Live', 'The Continental Club', current_date + 12, '21:00', 60, 250, true, '400', '400', 'Headline slot, doors at 8.', false),
    (gen_random_uuid(), v_band_id, 'Summer Block Party', 'Congress Ave Plaza',   current_date - 20, '18:00', 75, 600, true, '650', '650', 'Outdoor stage, great turnout.', false)
  on conflict (id) do nothing;

end $$;
