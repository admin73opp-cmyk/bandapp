-- Add persistence columns to bands table
alter table bands add column if not exists wa_link    text;
alter table bands add column if not exists cover_url  text;
alter table bands add column if not exists logo_url   text;
