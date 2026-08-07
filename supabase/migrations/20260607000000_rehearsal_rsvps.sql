-- ============================================================
-- Ritovo — Rehearsal RSVPs / Attendance Confirmation
-- Run in Supabase Dashboard → SQL Editor. Idempotent — safe to re-run.
-- ============================================================

-- ── TABLES ───────────────────────────────────────────────────

-- One row per (rehearsal, member) once they respond. No row = "pending".
create table if not exists rehearsal_rsvps (
  id           uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  user_id      uuid not null references profiles(id)   on delete cascade,
  status       text not null check (status in ('yes','no','maybe')),
  note         text,
  responded_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  unique(rehearsal_id, user_id)
);

create index if not exists rehearsal_rsvps_rehearsal_idx on rehearsal_rsvps(rehearsal_id);
create index if not exists rehearsal_rsvps_user_idx      on rehearsal_rsvps(user_id);

-- One opaque UUID token per (rehearsal, member) for one-click email links.
-- Created lazily by the notify-rehearsal / rsvp-remind edge functions — NOT at
-- rehearsal-creation time — so the existing creation flow is untouched.
create table if not exists rehearsal_rsvp_tokens (
  token        uuid primary key default gen_random_uuid(),
  rehearsal_id uuid not null references rehearsals(id) on delete cascade,
  user_id      uuid not null references profiles(id)   on delete cascade,
  expires_at   timestamptz not null,
  created_at   timestamptz not null default now(),
  unique(rehearsal_id, user_id)
);

create index if not exists rehearsal_rsvp_tokens_rehearsal_idx on rehearsal_rsvp_tokens(rehearsal_id);

-- Track the one-time "everyone has responded" admin notification (spec 4.2).
alter table rehearsals add column if not exists rsvp_complete_notified bool not null default false;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- Relies on is_band_member(bid) / is_band_admin(bid) from rls.sql.

alter table rehearsal_rsvps       enable row level security;
alter table rehearsal_rsvp_tokens enable row level security;

-- rehearsal_rsvps: members write their OWN row, but the whole group READS every
-- row — attendance is group coordination, not admin data, and the UI renders it
-- for everyone. Superseded the original admin-only read; kept in sync here so
-- re-running this file cannot revert 20260807000000_rehearsal_rsvps_member_visibility.sql.
drop policy if exists rehearsal_rsvps_select on rehearsal_rsvps;
create policy rehearsal_rsvps_select on rehearsal_rsvps
  for select using (
    user_id = auth.uid()
    or exists(
      select 1 from rehearsals r
      where r.id = rehearsal_rsvps.rehearsal_id and is_band_member(r.band_id)
    )
  );

drop policy if exists rehearsal_rsvps_insert on rehearsal_rsvps;
create policy rehearsal_rsvps_insert on rehearsal_rsvps
  for insert with check (
    user_id = auth.uid()
    and exists(
      select 1 from rehearsals r
      where r.id = rehearsal_rsvps.rehearsal_id and is_band_member(r.band_id)
    )
  );

drop policy if exists rehearsal_rsvps_update on rehearsal_rsvps;
create policy rehearsal_rsvps_update on rehearsal_rsvps
  for update using (user_id = auth.uid());

drop policy if exists rehearsal_rsvps_delete on rehearsal_rsvps;
create policy rehearsal_rsvps_delete on rehearsal_rsvps
  for delete using (user_id = auth.uid());

-- rehearsal_rsvp_tokens: no client access. RLS enabled with NO policies = deny
-- all. Only the service role (edge functions) and the SECURITY DEFINER RPC below
-- touch this table.

-- ── ONE-CLICK RSVP RPC ───────────────────────────────────────
-- Validates an opaque token and upserts the RSVP. SECURITY DEFINER so it works
-- for logged-out users (the token IS the authorization). Granted to anon.
create or replace function submit_rsvp_by_token(p_token uuid, p_status text, p_note text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  tok rehearsal_rsvp_tokens%rowtype;
  reh rehearsals%rowtype;
  bnd bands%rowtype;
begin
  if p_status not in ('yes','no','maybe') then
    return json_build_object('error', 'invalid_status');
  end if;

  select * into tok from rehearsal_rsvp_tokens where token = p_token;
  if not found then
    return json_build_object('error', 'invalid_token');
  end if;
  if tok.expires_at < now() then
    return json_build_object('error', 'expired');
  end if;

  insert into rehearsal_rsvps (rehearsal_id, user_id, status, note, responded_at)
  values (tok.rehearsal_id, tok.user_id, p_status,
          nullif(btrim(coalesce(p_note, '')), ''), now())
  on conflict (rehearsal_id, user_id)
  do update set status = excluded.status,
                note   = excluded.note,
                responded_at = now();

  select * into reh from rehearsals where id = tok.rehearsal_id;
  select * into bnd from bands       where id = reh.band_id;

  return json_build_object(
    'success',         true,
    'rehearsal_id',    reh.id,
    'rehearsal_title', reh.title,
    'rehearsal_date',  reh.date,
    'rehearsal_start', reh.start_time,
    'band_name',       bnd.name,
    'status',          p_status
  );
end;
$$;

grant execute on function submit_rsvp_by_token(uuid, text, text) to anon, authenticated;

-- ── DAILY REMINDER (pg_cron → rsvp-remind edge function) ─────
-- Requires the pg_cron and pg_net extensions:
--   Dashboard → Database → Extensions → enable "pg_cron" and "pg_net".
--
-- The edge function authorizes the cron path with a shared secret. Set the SAME
-- value as the CRON_SECRET edge-function secret below (replace REPLACE_WITH_CRON_SECRET).
--   supabase secrets set CRON_SECRET=<random-string>
--
-- Re-running this block is safe: the job is unscheduled first if it exists.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then

    -- Remove any prior schedule with this name before re-creating it.
    perform cron.unschedule('rsvp-daily-reminder')
    where exists (select 1 from cron.job where jobname = 'rsvp-daily-reminder');

    perform cron.schedule(
      'rsvp-daily-reminder',
      '0 10 * * *',  -- every day at 10:00 (cron runs in UTC)
      $cron$
      select net.http_post(
        url     := 'https://yhnoxgoibtbwcavzwddj.supabase.co/functions/v1/rsvp-remind',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', 'REPLACE_WITH_CRON_SECRET'
        ),
        body    := jsonb_build_object('mode', 'cron')
      );
      $cron$
    );
  end if;
end $$;
