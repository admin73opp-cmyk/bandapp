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

-- ── Band creation helper (bypasses RLS so any authenticated user can create a band) ──

create or replace function create_band_with_admin(
  p_name      text,
  p_initials  text default null,
  p_color     text default '#6C63FF',
  p_city      text default null,
  p_country   text default null,
  p_genre     text default null,
  p_bio       text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into bands (name, initials, color, city, country, genre, bio)
  values (p_name, p_initials, p_color, p_city, p_country, p_genre, p_bio)
  returning id into v_id;

  insert into band_members (band_id, user_id, role)
  values (v_id, auth.uid(), 'admin');

  return v_id;
end;
$$;

-- ── Member management helpers ─────────────────────────────────

-- Look up an existing Bandapp user by email (bypasses profiles RLS)
create or replace function find_user_by_email(p_email text)
returns table(id uuid, first_name text, last_name text)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select p.id, p.first_name, p.last_name
    from profiles p
    join auth.users u on u.id = p.id
    where lower(u.email) = lower(p_email)
    limit 1;
end;
$$;

-- Add an existing user to a band by user_id (admin only, bypasses RLS)
create or replace function add_band_member_direct(
  p_band_id   uuid,
  p_user_id   uuid,
  p_role      text    default 'member',
  p_guest_start date  default null,
  p_guest_end   date  default null,
  p_guest_band  text  default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_name text;
begin
  if not is_band_admin(p_band_id) then raise exception 'Not authorized'; end if;
  if exists (select 1 from band_members where band_id=p_band_id and user_id=p_user_id) then
    return jsonb_build_object('error','already_member');
  end if;
  select coalesce(first_name||' '||last_name, '') into v_name from profiles where id=p_user_id;
  insert into band_members (band_id, user_id, role, guest_start, guest_end, guest_band)
  values (p_band_id, p_user_id, p_role, p_guest_start, p_guest_end, p_guest_band);
  return jsonb_build_object('success',true,'name',v_name);
end;
$$;

-- Join a band using its UUID as the "band code" (any authenticated user)
create or replace function join_band_by_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bid uuid; v_bname text;
begin
  begin v_bid := trim(p_code)::uuid;
  exception when others then return jsonb_build_object('error','invalid_code','message','Invalid band code'); end;
  select name into v_bname from bands where id=v_bid;
  if v_bname is null then return jsonb_build_object('error','not_found','message','Band not found'); end if;
  if exists (select 1 from band_members where band_id=v_bid and user_id=auth.uid()) then
    return jsonb_build_object('error','already_member','message','You are already a member of '||v_bname);
  end if;
  insert into band_members (band_id, user_id, role) values (v_bid, auth.uid(), 'member');
  return jsonb_build_object('success',true,'band_id',v_bid,'band_name',v_bname);
end;
$$;

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
  for insert with check (is_band_admin(band_id));

create policy "songs_update" on songs
  for update using (is_band_admin(band_id));

create policy "songs_delete" on songs
  for delete using (is_band_admin(band_id));

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
  for insert with check (is_band_admin(band_id));

create policy "blackouts_update" on blackouts
  for update using (is_band_admin(band_id));

create policy "blackouts_delete" on blackouts
  for delete using (is_band_admin(band_id));

-- ── EVENT_PHOTOS ─────────────────────────────────────────────

create policy "event_photos_select" on event_photos
  for select using (
    (event_type = 'concert'   and exists(select 1 from concerts   c where c.id = event_photos.event_id and is_band_member(c.band_id)))
    or
    (event_type = 'rehearsal' and exists(select 1 from rehearsals r where r.id = event_photos.event_id and is_band_member(r.band_id)))
  );

create policy "event_photos_insert" on event_photos
  for insert with check (uploaded_by = auth.uid());

create policy "event_photos_delete" on event_photos
  for delete using (uploaded_by = auth.uid());
