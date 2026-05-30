-- ============================================================
-- Bandapp – Sheet Music field for songs
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

-- Add sheet_music_url column to songs
alter table songs
  add column if not exists sheet_music_url text;

-- Note: the song-attachments storage bucket was already created in
-- supabase/lyrics_setup.sql — the same bucket is reused for both
-- Lyrics and Sheet Music uploads.
