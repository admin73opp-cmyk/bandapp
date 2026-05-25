-- Add cover_url column to profiles for cross-device cover photo persistence
alter table profiles add column if not exists cover_url text;
