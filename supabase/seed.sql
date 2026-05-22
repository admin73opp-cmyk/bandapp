-- ============================================================
-- Bandapp – Demo Seed Data
-- Run in Supabase SQL editor AFTER schema.sql and rls.sql.
-- Creates the full Jazz Cats / BFC demo dataset.
--
-- Auth users are inserted directly into auth.users — this is
-- valid when run via the SQL editor (service role) or
-- `supabase db seed`. Never do this in application code.
-- ============================================================

-- ── Stable demo UUIDs ────────────────────────────────────────
-- Bands
-- Jazz Cats:                  a0000000-0000-0000-0000-000000000001
-- Brussels Funk Collective:   a0000000-0000-0000-0000-000000000002

-- Profiles / auth users
-- Marco Rossi (demo login):   b0000000-0000-0000-0000-000000000001
-- Sophie Vandenberghe:        b0000000-0000-0000-0000-000000000002
-- Lucas Martens:              b0000000-0000-0000-0000-000000000003
-- Kim De Smedt:               b0000000-0000-0000-0000-000000000004
-- Antoine Blanchard:          b0000000-0000-0000-0000-000000000005
-- Thomas Müller (guest):      b0000000-0000-0000-0000-000000000006
-- Celine Dupont (ex-guest):   b0000000-0000-0000-0000-000000000007

-- ── Auth users ───────────────────────────────────────────────
insert into auth.users
  (id, instance_id, aud, role, email, encrypted_password,
   email_confirmed_at, created_at, updated_at,
   raw_app_meta_data, raw_user_meta_data)
values
  ('b0000000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'demo@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Marco","last_name":"Rossi"}'),

  ('b0000000-0000-0000-0000-000000000002',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'sophie@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Sophie","last_name":"Vandenberghe"}'),

  ('b0000000-0000-0000-0000-000000000003',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'lucas@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Lucas","last_name":"Martens"}'),

  ('b0000000-0000-0000-0000-000000000004',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'kim@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Kim","last_name":"De Smedt"}'),

  ('b0000000-0000-0000-0000-000000000005',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'antoine@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Antoine","last_name":"Blanchard"}'),

  ('b0000000-0000-0000-0000-000000000006',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'thomas@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Thomas","last_name":"Müller"}'),

  ('b0000000-0000-0000-0000-000000000007',
   '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated',
   'celine@bandapp.com',
   crypt('demo1234', gen_salt('bf')),
   now(), now(), now(),
   '{"provider":"email","providers":["email"]}',
   '{"first_name":"Celine","last_name":"Dupont"}')
on conflict (id) do nothing;

-- ── Auth identities (required by GoTrue for email sign-in) ───
-- Newer Supabase versions require a matching row in auth.identities
-- or signInWithPassword returns "Database error querying schema".
insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  ('b0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001',
   '{"sub":"b0000000-0000-0000-0000-000000000001","email":"demo@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000002',
   '{"sub":"b0000000-0000-0000-0000-000000000002","email":"sophie@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000003',
   '{"sub":"b0000000-0000-0000-0000-000000000003","email":"lucas@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000004',
   '{"sub":"b0000000-0000-0000-0000-000000000004","email":"kim@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000005',
   '{"sub":"b0000000-0000-0000-0000-000000000005","email":"antoine@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000006',
   '{"sub":"b0000000-0000-0000-0000-000000000006","email":"thomas@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now()),
  ('b0000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000007',
   '{"sub":"b0000000-0000-0000-0000-000000000007","email":"celine@bandapp.com","email_verified":true,"phone_verified":false}',
   'email',now(),now(),now())
on conflict do nothing;

-- ── Profiles ─────────────────────────────────────────────────
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
   'https://youtube.com/@marcojazz', 'https://instagram.com/marcorossi_guitar'),

  ('b0000000-0000-0000-0000-000000000002',
   'Sophie','Vandenberghe','SV','Piano / Keys','Vocals','Backing',
   '{1,1,0,0,1,1,0}','#2563EB',
   '1991-07-22','BE','BE','nl',
   'Keys, vocals, and all-round musical backbone of the band.',
   'Nord Stage 3, Roland FP-90', '', ''),

  ('b0000000-0000-0000-0000-000000000003',
   'Lucas','Martens','LM','Bass Guitar','','None',
   '{0,0,1,0,1,0,0}','#16A34A',
   '1993-11-05','BE','BE','nl',
   'Groove merchant. Holds the low end together.',
   'Fender Jazz Bass 1975 RI, Darkglass B7K', '', ''),

  ('b0000000-0000-0000-0000-000000000004',
   'Kim','De Smedt','KD','Drums','Percussion','None',
   '{1,1,1,0,1,0,0}','#DC2626',
   '1990-02-17','BE','BE','nl',
   'Drummer, percussionist, and keeper of the tempo.',
   'Pearl Masters Custom, Zildjian A Custom', '', ''),

  ('b0000000-0000-0000-0000-000000000005',
   'Antoine','Blanchard','AB','Saxophone','Clarinet','None',
   '{0,0,0,0,1,1,0}','#9333EA',
   '1985-09-30','FR','BE','fr',
   'Saxophonist with a bebop heart and a funk soul.',
   'Selmer Mark VI Alto, Vandoren V16 mouthpiece', '', ''),

  ('b0000000-0000-0000-0000-000000000006',
   'Thomas','Müller','TM','Trumpet','','None',
   '{1,0,0,1,1,0,0}','#0891B2',
   '1995-04-12','DE','BE','de',
   'Guest trumpeter. Touring musician based in Brussels.',
   'Bach Stradivarius 37, Denis Wick 5C mouthpiece', '', ''),

  ('b0000000-0000-0000-0000-000000000007',
   'Celine','Dupont','CD','Violin','','None',
   '{1,1,1,1,1,1,0}','#F59E0B',
   '1992-06-08','BE','BE','fr',
   'Violinist, formerly with The Jazz Cats for a winter residency.',
   'Stentor Student II violin', '', '')
on conflict (id) do nothing;

-- ── Bands ────────────────────────────────────────────────────
insert into bands (id, name, initials, color, city, country, genre, formed, bio)
values
  ('a0000000-0000-0000-0000-000000000001',
   'The Jazz Cats','JC','var(--a)','Brussels','Belgium','Jazz','2019',
   'A Brussels-based jazz ensemble playing everything from bebop to soul-jazz. Founded in 2019, known for energetic live performances and tight arrangements.'),

  ('a0000000-0000-0000-0000-000000000002',
   'Brussels Funk Collective','BF','var(--bl)','Brussels','Belgium','Funk','2021',
   'High-energy funk collective bringing the groove to Brussels and beyond.')
on conflict (id) do nothing;

-- ── Band members ─────────────────────────────────────────────
insert into band_members (band_id, user_id, role, guest_start, guest_end)
values
  -- Jazz Cats
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','admin', null, null),
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000002','member',null, null),
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000003','member',null, null),
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000004','member',null, null),
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000005','member',null, null),
  -- Thomas is a guest (active)
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000006','guest','2026-05-20','2026-07-31'),
  -- Celine is an expired guest (kept in guest_directory via guest_status)
  ('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000007','guest','2025-11-01','2026-01-31'),

  -- Brussels Funk Collective — Marco and Antoine cross-band
  ('a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','admin', null, null),
  ('a0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000005','member',null, null)
on conflict (band_id, user_id) do nothing;

-- Update Celine's guest_status to 'expired'
update band_members
set guest_status = 'expired'
where band_id = 'a0000000-0000-0000-0000-000000000001'
  and user_id  = 'b0000000-0000-0000-0000-000000000007';

-- ── Songs (Jazz Cats — band 1) ────────────────────────────────
insert into songs
  (id, band_id, legacy_id, title, artist, genre, key, duration,
   notes, spotify_url, youtube_url, apple_url)
values
  ('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,
   'Autumn Leaves','Miles Davis','Jazz','Am',354,
   'Opening — slow build',
   'https://open.spotify.com/track/0M1lq50jGaTn2Hbm2CRQ9D',
   'https://www.youtube.com/watch?v=r-Z8KuwI7Gc',
   'https://music.apple.com/us/album/autumn-leaves/1452696571'),

  ('c0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',2,
   'So What','Miles Davis','Jazz','Dm',548,
   'Antoine sax solo feature',
   'https://open.spotify.com/track/7q3kkfAVpmcZ8g6JUThi3o',
   'https://www.youtube.com/watch?v=zqNTltOGh5c',
   'https://music.apple.com/us/album/so-what/1452696571'),

  ('c0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',3,
   'Fly Me to the Moon','Frank Sinatra','Jazz','C',147,
   'Venue request',
   'https://open.spotify.com/track/5b5ywsTkG3XobY7Dgkm8eD',
   'https://www.youtube.com/watch?v=ZEcqHA7dbwM', ''),

  ('c0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',4,
   'Take Five','Dave Brubeck','Jazz','Eb',324,
   '5/4 — Kim leads',
   'https://open.spotify.com/track/1YQWosTIljIvxAgHWTp7KP',
   'https://www.youtube.com/watch?v=vmDDOFXSgAs', ''),

  ('c0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001',5,
   'A Night in Tunisia','Dizzy Gillespie','Jazz','Dm',402,
   'High energy', '',
   'https://www.youtube.com/watch?v=t1XjL1j0mls', ''),

  ('c0000000-0000-0000-0000-000000000006','a0000000-0000-0000-0000-000000000001',6,
   'Watermelon Man','Herbie Hancock','Funk','F',299,
   'Crowd pleaser',
   'https://open.spotify.com/track/2bGPTQOBfKDRhhkzLQMqXi',
   'https://www.youtube.com/watch?v=G7bHMOSGHbU', ''),

  ('c0000000-0000-0000-0000-000000000007','a0000000-0000-0000-0000-000000000001',7,
   'Chameleon','Herbie Hancock','Funk','Bm',651,
   'Extended jam',
   'https://open.spotify.com/track/5e5JqNqGNMv4kNJMLlCWac',
   'https://www.youtube.com/watch?v=UbkqE4fpvdI', ''),

  ('c0000000-0000-0000-0000-000000000008','a0000000-0000-0000-0000-000000000001',8,
   'What''s Going On','Marvin Gaye','Soul','Eb',235,
   'Sophie on lead vocals',
   'https://open.spotify.com/track/3Um9toULmYFGCpvaIPFw7l',
   'https://www.youtube.com/watch?v=H-kA3UtBj4M', ''),

  ('c0000000-0000-0000-0000-000000000009','a0000000-0000-0000-0000-000000000001',9,
   'At Last','Etta James','Blues','F',202,
   'Wedding favourite',
   'https://open.spotify.com/track/3xKsf9qdS1CyvXSMEid6g8',
   'https://www.youtube.com/watch?v=CzNvEeZKP6I', ''),

  ('c0000000-0000-0000-0000-00000000000a','a0000000-0000-0000-0000-000000000001',10,
   'Cantaloupe Island','Herbie Hancock','Jazz','Fm',337,
   'Laid back groove',
   'https://open.spotify.com/track/3PG5EB2rOSMkKMQRPaFfPK',
   'https://www.youtube.com/watch?v=4iqiLGkCKFE', ''),

  ('c0000000-0000-0000-0000-00000000000b','a0000000-0000-0000-0000-000000000001',11,
   'My Favorite Things','John Coltrane','Jazz','E',473,
   'Energy builder',
   'https://open.spotify.com/track/0q5yTFV5pFqeIh8HjBcJF3',
   'https://www.youtube.com/watch?v=qSMqS_RxXBw', ''),

  ('c0000000-0000-0000-0000-00000000000c','a0000000-0000-0000-0000-000000000001',12,
   'Summertime','George Gershwin','Jazz','Am',268,
   'Encore option',
   'https://open.spotify.com/track/3SiRcHOPHjBSNjFVKVPuZH',
   'https://www.youtube.com/watch?v=rqt1nUjQWbw', '')
on conflict (id) do nothing;

-- Song notes for Marco (legacy myC object)
insert into song_notes (song_id, user_id, note)
values
  ('c0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','Capo 5 fingerpick'),
  ('c0000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','Stay back — Antoine''s solo'),
  ('c0000000-0000-0000-0000-000000000003','b0000000-0000-0000-0000-000000000001','Key +2'),
  ('c0000000-0000-0000-0000-000000000004','b0000000-0000-0000-0000-000000000001','Watch Kim tempo'),
  ('c0000000-0000-0000-0000-000000000005','b0000000-0000-0000-0000-000000000001','Rhythm tight'),
  ('c0000000-0000-0000-0000-000000000006','b0000000-0000-0000-0000-000000000001','Wah pedal on'),
  ('c0000000-0000-0000-0000-000000000007','b0000000-0000-0000-0000-000000000001','Let it breathe'),
  ('c0000000-0000-0000-0000-000000000008','b0000000-0000-0000-0000-000000000001','Comp lightly'),
  ('c0000000-0000-0000-0000-000000000009','b0000000-0000-0000-0000-000000000001','Soft ballad'),
  ('c0000000-0000-0000-0000-00000000000a','b0000000-0000-0000-0000-000000000001','Clean Rhodes'),
  ('c0000000-0000-0000-0000-00000000000b','b0000000-0000-0000-0000-000000000001','Build up'),
  ('c0000000-0000-0000-0000-00000000000c','b0000000-0000-0000-0000-000000000001','Back to Am')
on conflict (song_id, user_id) do nothing;

-- ── Setlists ─────────────────────────────────────────────────
insert into setlists (id, band_id, legacy_id, name, date, type, venue, duration, audience, paid, total, price)
values
  ('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,
   'Blue Note Summer Jazz Night','2026-06-07','Concert','Blue Note Brussels',90,120,true,'€3,000','€25/ticket'),
  ('d0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',2,
   'Antwerp Jazz Festival','2026-06-21','Concert','Zomerbar Antwerpen',60,500,false,null,null),
  ('d0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',3,
   'Wedding — Van den Berg','2026-07-04','Wedding','Château de Namur',120,80,true,'€2,000','Package'),
  ('d0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',4,
   'Practice Session',null,'Practice',null,60,0,false,null,null)
on conflict (id) do nothing;

-- Setlist songs (positions 1-based)
-- Setlist 1: songs [1,2,3,4,5,6,7,8,10,11,9,12] (legacy ids)
insert into setlist_songs (setlist_id, song_id, position)
select 'd0000000-0000-0000-0000-000000000001', s.id, ord.pos
from (values (1,1),(2,2),(3,3),(4,4),(5,5),(6,6),(7,7),(8,8),(9,10),(10,11),(11,9),(12,12)) as ord(pos, lid)
join songs s on s.legacy_id = ord.lid and s.band_id = 'a0000000-0000-0000-0000-000000000001'
on conflict (setlist_id, position) do nothing;

-- Setlist 2: songs [1,3,6,7,8,9,10,12]
insert into setlist_songs (setlist_id, song_id, position)
select 'd0000000-0000-0000-0000-000000000002', s.id, ord.pos
from (values (1,1),(2,3),(3,6),(4,7),(5,8),(6,9),(7,10),(8,12)) as ord(pos, lid)
join songs s on s.legacy_id = ord.lid and s.band_id = 'a0000000-0000-0000-0000-000000000001'
on conflict (setlist_id, position) do nothing;

-- Setlist 3: songs [3,8,9,12,1,6]
insert into setlist_songs (setlist_id, song_id, position)
select 'd0000000-0000-0000-0000-000000000003', s.id, ord.pos
from (values (1,3),(2,8),(3,9),(4,12),(5,1),(6,6)) as ord(pos, lid)
join songs s on s.legacy_id = ord.lid and s.band_id = 'a0000000-0000-0000-0000-000000000001'
on conflict (setlist_id, position) do nothing;

-- ── Concerts ─────────────────────────────────────────────────
insert into concerts (id, band_id, legacy_id, title, venue, date, time, duration, audience, paid, total, price, notes, cancelled)
values
  ('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,
   'Blue Note Summer Jazz Night','Blue Note Brussels','2026-06-07','21:00',90,120,true,'€3,000','€25/ticket','',false),
  ('e0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',2,
   'Antwerp Jazz Festival','Zomerbar Antwerpen','2026-06-21','18:00',60,500,false,null,null,
   'Outdoor stage — bring own backline',false),
  ('e0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',3,
   'Wedding — Van den Berg','Château de Namur','2026-07-04','19:00',120,80,true,'€2,000','Package','',false),
  ('e0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',4,
   'Spring Jazz Night','Café Central, Brussels','2026-03-15','21:00',90,80,true,'€1,200','€15/ticket',
   'Great crowd, encored twice.',false),
  ('e0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001',5,
   'Valentine''s Jazz Dinner','Le Loup Blanc','2026-02-08','20:00',75,60,true,'€900','Included in dinner',
   'Intimate setting, played all ballads.',false)
on conflict (id) do nothing;

-- Concert ↔ setlist links
insert into concert_setlists (concert_id, setlist_id)
values
  ('e0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001'),
  ('e0000000-0000-0000-0000-000000000002','d0000000-0000-0000-0000-000000000002'),
  ('e0000000-0000-0000-0000-000000000003','d0000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- ── Rehearsals ───────────────────────────────────────────────
insert into rehearsals (id, band_id, legacy_id, title, location, date, start_time, end_time, notes, setlist_id, cancelled)
values
  ('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001',1,
   'Full Band Rehearsal','Studio De Muziek, Brussels','2026-05-23','19:00','22:00',
   'Focus on Blue Note setlist','d0000000-0000-0000-0000-000000000001',false),
  ('f0000000-0000-0000-0000-000000000002','a0000000-0000-0000-0000-000000000001',2,
   'Rhythm Section Practice','Marco''s Studio, Brussels','2026-05-31','15:00','17:00',
   'Bass and drums tightening',null,false),
  ('f0000000-0000-0000-0000-000000000003','a0000000-0000-0000-0000-000000000001',3,
   'Full Band Rehearsal','Studio De Muziek, Brussels','2026-03-12','19:00','22:00',
   'Ran through full setlist twice.',null,false),
  ('f0000000-0000-0000-0000-000000000004','a0000000-0000-0000-0000-000000000001',4,
   'Horn Section Workshop','Antoine''s place, Brussels','2026-02-19','14:00','16:00',
   'Antoine led the session.',null,false),
  ('f0000000-0000-0000-0000-000000000005','a0000000-0000-0000-0000-000000000001',5,
   'Full Band Rehearsal','Studio De Muziek, Brussels','2026-01-28','19:00','22:00',
   'First rehearsal of the year.',null,false)
on conflict (id) do nothing;

-- ── Blackouts ────────────────────────────────────────────────
insert into blackouts (band_id, label, from_date, to_date, scope, member_ids)
values
  ('a0000000-0000-0000-0000-000000000001','Carnival Brussels',  '2026-03-01','2026-03-03','band','{}'),
  ('a0000000-0000-0000-0000-000000000001','Summer School Holiday','2026-07-01','2026-08-31','band','{}'),
  ('a0000000-0000-0000-0000-000000000001','Antoine — Paris tour','2026-06-10','2026-06-14','members',
   array['b0000000-0000-0000-0000-000000000005'::uuid]),
  ('a0000000-0000-0000-0000-000000000001','Ascension weekend',  '2026-05-14','2026-05-14','band','{}')
on conflict do nothing;
