-- Add persistence columns to bands table
alter table bands add column if not exists wa_link        text;
alter table bands add column if not exists cover_url      text;
alter table bands add column if not exists logo_url       text;
alter table bands add column if not exists notif_pref     text;
alter table bands add column if not exists rehearsal_days int4[];
alter table bands add column if not exists platforms      jsonb default '[]';
