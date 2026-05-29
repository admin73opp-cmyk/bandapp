-- ============================================================
-- Bandapp – Calendar Change Log
-- Run in Supabase Dashboard → SQL Editor → New query
-- ============================================================

create table if not exists calendar_changelog (
  id            uuid primary key default gen_random_uuid(),
  band_id       uuid not null references bands(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null,
  action        text not null,          -- 'created' | 'updated' | 'deleted' | 'cancelled'
  entity_type   text not null,          -- 'rehearsal' | 'concert' | 'blackout' | 'availability'
  entity_id     uuid,                   -- ID of the changed entity (null for availability)
  description   text not null,          -- human-readable summary
  impacts_event boolean not null default false, -- true → show amber indicator
  created_at    timestamptz not null default now()
);

-- Index for fast per-band chronological queries (the most common read pattern)
create index if not exists calendar_changelog_band_created_idx
  on calendar_changelog(band_id, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────

alter table calendar_changelog enable row level security;

create policy "changelog_select" on calendar_changelog
  for select using (is_band_member(band_id));

create policy "changelog_insert" on calendar_changelog
  for insert with check (
    is_band_member(band_id) and user_id = auth.uid()
  );

-- Only admins can bulk-delete old entries
create policy "changelog_delete" on calendar_changelog
  for delete using (is_band_admin(band_id));
