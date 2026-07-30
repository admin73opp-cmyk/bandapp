-- ============================================================
-- Bandapp – Lyrics / Sheet Music feature
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

-- 1. Add lyrics_url column to songs
alter table songs
  add column if not exists lyrics_url text;

-- 2. Add lyrics repository preference to bands
alter table bands
  add column if not exists lyrics_repo text default 'any';

-- 3. Create the song-attachments storage bucket + policies
--    (PostgREST Storage API — safe to run even if bucket already exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'song-attachments',
  'song-attachments',
  true,         -- public: view links open in-browser without auth tokens
  10485760,     -- 10 MB per file
  array[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/octet-stream',         -- .mxl (compressed MusicXML)
    'text/xml',
    'application/xml',
    'application/vnd.recordare.musicxml+xml'
  ]
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4. Storage policies
--    Drop first so re-running is idempotent
drop policy if exists "song_attachments_select" on storage.objects;
drop policy if exists "song_attachments_insert" on storage.objects;
drop policy if exists "song_attachments_delete" on storage.objects;

-- Anyone can read (bucket is public; URLs contain UUIDs so they are effectively secret)
create policy "song_attachments_select" on storage.objects
  for select using (bucket_id = 'song-attachments');

-- Any authenticated user can upload
create policy "song_attachments_insert" on storage.objects
  for insert with check (
    bucket_id = 'song-attachments'
    and auth.role() = 'authenticated'
  );

-- Any authenticated user can delete their own uploads
create policy "song_attachments_delete" on storage.objects
  for delete using (
    bucket_id = 'song-attachments'
    and auth.role() = 'authenticated'
  );
