-- ── Calendar subscription feeds ──────────────────────────────
-- One opaque token per band. The token is a bearer secret embedded in a
-- universal .ics feed URL that members subscribe to from Google Calendar,
-- Apple Calendar, Outlook, or any app that supports calendar subscriptions.
-- The `calendar-feed` edge function resolves token → band with the service
-- role (bypassing RLS), so calendar apps can fetch it unauthenticated.

create table if not exists band_calendar_feeds (
  band_id    uuid primary key references bands(id) on delete cascade,
  token      uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create unique index if not exists band_calendar_feeds_token_idx
  on band_calendar_feeds(token);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- No direct client access. Tokens are minted and rotated only through the
-- security-definer RPCs below, which enforce membership / admin checks.
alter table band_calendar_feeds enable row level security;

drop policy if exists band_calendar_feeds_no_access on band_calendar_feeds;
create policy band_calendar_feeds_no_access on band_calendar_feeds
  for all using (false) with check (false);

-- ── RPCs ─────────────────────────────────────────────────────

-- Return the band's feed token, creating it on first use. Any band member.
create or replace function get_or_create_calendar_feed(p_band uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_token uuid;
begin
  if not is_band_member(p_band) then
    raise exception 'not a band member';
  end if;
  insert into band_calendar_feeds(band_id)
    values (p_band)
    on conflict (band_id) do nothing;
  select token into v_token from band_calendar_feeds where band_id = p_band;
  return v_token;
end;
$$;

-- Rotate (invalidate) the band's feed token. Admins only.
create or replace function rotate_calendar_feed(p_band uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_token uuid;
begin
  if not is_band_admin(p_band) then
    raise exception 'admin only';
  end if;
  insert into band_calendar_feeds(band_id, token)
    values (p_band, gen_random_uuid())
    on conflict (band_id) do update set token = gen_random_uuid();
  select token into v_token from band_calendar_feeds where band_id = p_band;
  return v_token;
end;
$$;

grant execute on function get_or_create_calendar_feed(uuid) to authenticated;
grant execute on function rotate_calendar_feed(uuid)        to authenticated;
