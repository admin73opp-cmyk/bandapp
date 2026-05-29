-- ============================================================
-- Bandapp – Row Level Security
-- Run after schema.sql — safe to re-run (idempotent).
-- ============================================================

-- ── Helper functions ─────────────────────────────────────────

create or replace function is_band_member(bid uuid)
returns bool language sql security definer as
$$select exists(select 1 from band_members where band_id = bid and user_id = auth.uid())$$;

create or replace function is_band_admin(bid uuid)
returns bool language sql security definer as
$$select exists(select 1 from band_members where band_id = bid and user_id = auth.uid() and role = 'admin')$$;

-- ── Enable RLS on all tables ──────────────────────────────────

alter table bands            enable row level security;
alter table profiles         enable row level security;
alter table band_members     enable row level security;
alter table songs            enable row level security;
alter table song_notes       enable row level security;
alter table setlists         enable row level security;
alter table setlist_songs    enable row level security;
alter table concerts         enable row level security;
alter table concert_setlists enable row level security;
alter table rehearsals       enable row level security;
alter table blackouts        enable row level security;
alter table event_photos     enable row level security;

-- ── Drop existing policies before recreating ─────────────────

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies
           where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

-- ── BANDS ────────────────────────────────────────────────────

create policy "bands_select" on bands
  for select using (is_band_member(id));

create policy "bands_insert" on bands
  for insert with check (true);

create policy "bands_update" on bands
  for update using (is_band_admin(id));

create policy "bands_delete" on bands
  for delete using (is_band_admin(id));

-- ── PROFILES ─────────────────────────────────────────────────

create policy "profiles_select" on profiles
  for select using (
    id = auth.uid()
    or exists(
      select 1 from band_members bm1
      join band_members bm2 on bm1.band_id = bm2.band_id
      where bm1.user_id = auth.uid() and bm2.user_id = profiles.id
    )
  );

create policy "profiles_insert" on profiles
  for insert with check (id = auth.uid());

create policy "profiles_update" on profiles
  for update using (id = auth.uid());

create policy "profiles_delete" on profiles
  for delete using (id = auth.uid());

-- ── BAND_MEMBERS ─────────────────────────────────────────────

create policy "band_members_select" on band_members
  for select using (is_band_member(band_id));

create policy "band_members_insert" on band_members
  for insert with check (is_band_admin(band_id) or user_id = auth.uid());

create policy "band_members_update" on band_members
  for update using (is_band_admin(band_id));

create policy "band_members_delete" on band_members
  for delete using (is_band_admin(band_id) or user_id = auth.uid());

-- ── SONGS ────────────────────────────────────────────────────

create policy "songs_select" on songs
  for select using (is_band_member(band_id));

create policy "songs_insert" on songs
  for insert with check (is_band_member(band_id));

create policy "songs_update" on songs
  for update using (is_band_member(band_id));

create policy "songs_delete" on songs
  for delete using (is_band_member(band_id));

-- ── SONG_NOTES ───────────────────────────────────────────────

create policy "song_notes_select" on song_notes
  for select using (
    exists(select 1 from songs s where s.id = song_notes.song_id and is_band_member(s.band_id))
  );

create policy "song_notes_insert" on song_notes
  for insert with check (user_id = auth.uid());

create policy "song_notes_update" on song_notes
  for update using (user_id = auth.uid());

create policy "song_notes_delete" on song_notes
  for delete using (user_id = auth.uid());

-- ── SETLISTS ─────────────────────────────────────────────────

create policy "setlists_select" on setlists
  for select using (is_band_member(band_id));

create policy "setlists_insert" on setlists
  for insert with check (is_band_admin(band_id));

create policy "setlists_update" on setlists
  for update using (is_band_admin(band_id));

create policy "setlists_delete" on setlists
  for delete using (is_band_admin(band_id));

-- ── SETLIST_SONGS ────────────────────────────────────────────

create policy "setlist_songs_select" on setlist_songs
  for select using (
    exists(select 1 from setlists sl where sl.id = setlist_songs.setlist_id and is_band_member(sl.band_id))
  );

create policy "setlist_songs_insert" on setlist_songs
  for insert with check (
    exists(select 1 from setlists sl where sl.id = setlist_songs.setlist_id and is_band_admin(sl.band_id))
  );

create policy "setlist_songs_update" on setlist_songs
  for update using (
    exists(select 1 from setlists sl where sl.id = setlist_songs.setlist_id and is_band_admin(sl.band_id))
  );

create policy "setlist_songs_delete" on setlist_songs
  for delete using (
    exists(select 1 from setlists sl where sl.id = setlist_songs.setlist_id and is_band_admin(sl.band_id))
  );

-- ── CONCERTS ─────────────────────────────────────────────────

create policy "concerts_select" on concerts
  for select using (is_band_member(band_id));

create policy "concerts_insert" on concerts
  for insert with check (is_band_admin(band_id));

create policy "concerts_update" on concerts
  for update using (is_band_admin(band_id));

create policy "concerts_delete" on concerts
  for delete using (is_band_admin(band_id));

-- ── CONCERT_SETLISTS ─────────────────────────────────────────

create policy "concert_setlists_select" on concert_setlists
  for select using (
    exists(select 1 from concerts c where c.id = concert_setlists.concert_id and is_band_member(c.band_id))
  );

create policy "concert_setlists_insert" on concert_setlists
  for insert with check (
    exists(select 1 from concerts c where c.id = concert_setlists.concert_id and is_band_admin(c.band_id))
  );

create policy "concert_setlists_delete" on concert_setlists
  for delete using (
    exists(select 1 from concerts c where c.id = concert_setlists.concert_id and is_band_admin(c.band_id))
  );

-- ── REHEARSALS ───────────────────────────────────────────────

create policy "rehearsals_select" on rehearsals
  for select using (is_band_member(band_id));

create policy "rehearsals_insert" on rehearsals
  for insert with check (is_band_admin(band_id));

create policy "rehearsals_update" on rehearsals
  for update using (is_band_admin(band_id));

create policy "rehearsals_delete" on rehearsals
  for delete using (is_band_admin(band_id));

-- ── BLACKOUTS ────────────────────────────────────────────────

create policy "blackouts_select" on blackouts
  for select using (is_band_member(band_id));

create policy "blackouts_insert" on blackouts
  for insert with check (
    is_band_admin(band_id)
    or (is_band_member(band_id) and source_concert_id is not null)
  );

create policy "blackouts_update" on blackouts
  for update using (is_band_admin(band_id));

create policy "blackouts_delete" on blackouts
  for delete using (
    is_band_admin(band_id)
    or (is_band_member(band_id) and source_concert_id is not null)
  );

-- ── EVENT_PHOTOS ─────────────────────────────────────────────

create policy "event_photos_select" on event_photos
  for select using (
    (event_type = 'concert'   and exists(select 1 from concerts   c where c.id = event_photos.event_id and is_band_member(c.band_id)))
    or
    (event_type = 'rehearsal' and exists(select 1 from rehearsals r where r.id = event_photos.event_id and is_band_member(r.band_id)))
    or
    (event_type = 'band'      and is_band_member(event_photos.event_id))
  );

create policy "event_photos_insert" on event_photos
  for insert with check (uploaded_by = auth.uid());

create policy "event_photos_delete" on event_photos
  for delete using (uploaded_by = auth.uid());
