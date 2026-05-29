-- ============================================================
-- Bandapp – Database Schema
-- Run in Supabase SQL editor (Dashboard → SQL editor → New query)
-- ============================================================

-- Enable UUID generation (already available on Supabase by default)
-- create extension if not exists "pgcrypto";

-- ── BANDS ────────────────────────────────────────────────────
create table if not exists bands (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  initials   text,
  color      text,
  city       text,
  country    text,
  genre      text,
  formed     text,
  bio        text,
  created_at timestamptz not null default now()
);

-- ── PROFILES (extends auth.users 1:1) ────────────────────────
create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  first_name   text,
  last_name    text,
  initials     text,
  instrument   text,
  instrument2  text,
  vocals       text,
  -- 7-element array: Mon=0 … Sun=6, 1=available 0=unavailable
  availability int4[] not null default '{1,1,1,1,1,1,1}',
  color        text,
  bday         date,
  nationality  text,
  country      text,
  lang         text not null default 'en',
  bio          text,
  gear         text,
  phone_dial   text,
  phone_number text,
  spotify_url  text,
  apple_url    text,
  youtube_url  text,
  instagram_url text,
  facebook_url  text,
  website_url   text,
  photo_url     text,
  created_at    timestamptz not null default now()
);

-- ── BAND_MEMBERS (many:many bands ↔ profiles) ─────────────────
create table if not exists band_members (
  id           uuid primary key default gen_random_uuid(),
  band_id      uuid not null references bands(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  -- 'admin' | 'member' | 'guest'
  role         text not null default 'member',
  guest_start  date,
  guest_end    date,
  guest_band   text,
  guest_status text,
  created_at   timestamptz not null default now(),
  unique(band_id, user_id)
);

create index if not exists band_members_band_id_idx  on band_members(band_id);
create index if not exists band_members_user_id_idx  on band_members(user_id);

-- ── SONGS ────────────────────────────────────────────────────
create table if not exists songs (
  id          uuid primary key default gen_random_uuid(),
  band_id     uuid not null references bands(id) on delete cascade,
  title       text not null,
  artist      text,
  genre       text,
  key         text,
  duration    int,       -- seconds
  notes       text,
  spotify_url text,
  youtube_url text,
  apple_url   text,
  hidden      bool not null default false,
  -- kept during migration to map legacy integer ids; drop after cutover
  legacy_id   int,
  created_at  timestamptz not null default now()
);

create index if not exists songs_band_id_idx on songs(band_id);

-- ── SONG_NOTES (per-user notes on a song) ────────────────────
create table if not exists song_notes (
  id         uuid primary key default gen_random_uuid(),
  song_id    uuid not null references songs(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  unique(song_id, user_id)
);

-- ── SETLISTS ─────────────────────────────────────────────────
create table if not exists setlists (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references bands(id) on delete cascade,
  name       text not null,
  date       date,
  type       text,
  venue      text,
  duration   int,
  audience   int,
  paid       bool not null default false,
  total      text,
  price      text,
  legacy_id  int,
  created_at timestamptz not null default now()
);

create index if not exists setlists_band_id_idx on setlists(band_id);

-- ── SETLIST_SONGS (ordered songs within a setlist) ───────────
create table if not exists setlist_songs (
  id          uuid primary key default gen_random_uuid(),
  setlist_id  uuid not null references setlists(id) on delete cascade,
  song_id     uuid not null references songs(id) on delete cascade,
  position    int not null,
  created_at  timestamptz not null default now(),
  unique(setlist_id, position)
);

create index if not exists setlist_songs_setlist_id_idx on setlist_songs(setlist_id);

-- ── CONCERTS ─────────────────────────────────────────────────
create table if not exists concerts (
  id         uuid primary key default gen_random_uuid(),
  band_id    uuid not null references bands(id) on delete cascade,
  title      text not null,
  venue      text,
  date       date,
  time       text,
  duration   int,
  audience   int,
  paid       bool not null default false,
  total      text,
  price      text,
  notes      text,
  cancelled  bool not null default false,
  legacy_id  int,
  created_at timestamptz not null default now()
);

create index if not exists concerts_band_id_idx on concerts(band_id);

-- ── CONCERT_SETLISTS (many:many concerts ↔ setlists) ─────────
create table if not exists concert_setlists (
  concert_id  uuid not null references concerts(id) on delete cascade,
  setlist_id  uuid not null references setlists(id) on delete cascade,
  primary key (concert_id, setlist_id)
);

-- ── REHEARSALS ───────────────────────────────────────────────
create table if not exists rehearsals (
  id          uuid primary key default gen_random_uuid(),
  band_id     uuid not null references bands(id) on delete cascade,
  title       text not null,
  location    text,
  date        date,
  start_time  text,
  end_time    text,
  notes       text,
  setlist_id  uuid references setlists(id) on delete set null,
  cancelled   bool not null default false,
  legacy_id   int,
  created_at  timestamptz not null default now()
);

create index if not exists rehearsals_band_id_idx on rehearsals(band_id);

-- ── BLACKOUTS ────────────────────────────────────────────────
create table if not exists blackouts (
  id          uuid primary key default gen_random_uuid(),
  band_id     uuid not null references bands(id) on delete cascade,
  label       text not null,
  from_date   date not null,
  to_date     date not null,
  -- 'band' | 'members'
  scope       text not null default 'band',
  -- profile UUIDs when scope = 'members'
  member_ids  uuid[] not null default '{}',
  created_at  timestamptz not null default now()
);

create index if not exists blackouts_band_id_idx on blackouts(band_id);

-- ── EVENT_PHOTOS ─────────────────────────────────────────────
create table if not exists event_photos (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null check (event_type in ('concert','rehearsal','band')),
  event_id     uuid not null,
  url          text not null,   -- Supabase Storage path
  uploaded_by  uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists event_photos_event_idx on event_photos(event_type, event_id);
