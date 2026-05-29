-- ============================================================
-- Bandapp – Band Invites (opaque token invite flow)
-- Replaces PII-in-URL invite links with short-lived UUID tokens.
-- Token is stored server-side; the invite URL only ever carries
-- the UUID, never names, email, or phone.
-- Safe to re-run (uses IF NOT EXISTS / OR REPLACE / DROP IF EXISTS).
-- ============================================================

-- ── Table ────────────────────────────────────────────────────

create table if not exists band_invites (
  id           uuid primary key default gen_random_uuid(),
  band_id      uuid not null references bands(id) on delete cascade,
  email        text,
  first_name   text,
  last_name    text,
  instrument   text,
  phone_dial   text,
  phone_number text,
  role         text not null default 'member',
  invited_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '7 days'),
  used_at      timestamptz
);

create index if not exists band_invites_band_id_idx on band_invites(band_id);

-- ── RLS ──────────────────────────────────────────────────────

alter table band_invites enable row level security;

drop policy if exists "band_invites_insert" on band_invites;
create policy "band_invites_insert" on band_invites
  for insert with check (is_band_admin(band_id));

drop policy if exists "band_invites_select" on band_invites;
create policy "band_invites_select" on band_invites
  for select using (is_band_admin(band_id));

drop policy if exists "band_invites_update" on band_invites;
create policy "band_invites_update" on band_invites
  for update using (is_band_admin(band_id));

-- ── get_invite_by_token ──────────────────────────────────────
-- Callable by the anon key so the signup page can look up
-- invite metadata before the user is authenticated.
-- Returns null if token is unknown, or {error} if expired/used.

drop function if exists get_invite_by_token(uuid);
create function get_invite_by_token(p_token uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_invite    band_invites%rowtype;
  v_band_name text;
begin
  select * into v_invite from band_invites where id = p_token;
  if not found then return null; end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'expired');
  end if;
  if v_invite.used_at is not null then
    return jsonb_build_object('error', 'already_used');
  end if;

  select name into v_band_name from bands where id = v_invite.band_id;

  return jsonb_build_object(
    'band_id',      v_invite.band_id,
    'band_name',    coalesce(v_band_name, ''),
    'email',        coalesce(v_invite.email, ''),
    'first_name',   coalesce(v_invite.first_name, ''),
    'last_name',    coalesce(v_invite.last_name, ''),
    'instrument',   coalesce(v_invite.instrument, ''),
    'phone_dial',   coalesce(v_invite.phone_dial, ''),
    'phone_number', coalesce(v_invite.phone_number, ''),
    'role',         v_invite.role
  );
end;
$$;

-- Allow unauthenticated clients (anon key) to call this function
grant execute on function get_invite_by_token(uuid) to anon, authenticated;

-- ── mark_invite_used ─────────────────────────────────────────
-- Called after the invited user signs in and the band join succeeds.

drop function if exists mark_invite_used(uuid);
create function mark_invite_used(p_token uuid)
returns void language sql security definer as $$
  update band_invites set used_at = now()
  where id = p_token and used_at is null;
$$;

grant execute on function mark_invite_used(uuid) to authenticated;
