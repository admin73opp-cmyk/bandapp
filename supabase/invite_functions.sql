-- join_band_by_code: joins current user to a band by its UUID (used as the invite code)
create or replace function join_band_by_code(p_code uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_band bands%rowtype;
  v_uid  uuid := auth.uid();
begin
  select * into v_band from bands where id = p_code;
  if not found then
    return jsonb_build_object('error', 'band_not_found', 'message', 'Band not found. Check the code and try again.');
  end if;

  -- Already a member — idempotent, not an error, but signal it so client cleans up
  if exists(select 1 from band_members where band_id = p_code and user_id = v_uid) then
    return jsonb_build_object(
      'success',   true,
      'band_id',   p_code,
      'band_name', v_band.name,
      'error',     'already_member'
    );
  end if;

  insert into band_members(band_id, user_id, role) values(p_code, v_uid, 'member');

  return jsonb_build_object(
    'success',   true,
    'band_id',   p_code,
    'band_name', v_band.name
  );
end;
$$;

-- find_user_by_email: looks up a user by email address (for the "already on Bandapp?" lookup).
-- Restricted to authenticated band admins to prevent open email enumeration.
-- Lookup audit/rate-limit log (touched only by find_user_by_email; RLS locked
-- with no policies so clients can't read it)
create table if not exists email_lookup_log (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists email_lookup_log_user_at on email_lookup_log(user_id, at);
alter table email_lookup_log enable row level security;

create or replace function find_user_by_email(p_email text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid     uuid;
  v_profile profiles%rowtype;
begin
  -- Must be authenticated
  if auth.uid() is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  -- Caller must be an admin of at least one band
  if not exists(select 1 from band_members where user_id = auth.uid() and role = 'admin') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only band admins can look up members by email');
  end if;

  -- Rate-limit: this looks up ANY account platform-wide, so cap enumeration.
  if (select count(*) from email_lookup_log
      where user_id = auth.uid() and at > now() - interval '1 hour') >= 20 then
    return jsonb_build_object('error', 'rate_limited', 'message', 'Too many lookups — try again in an hour.');
  end if;
  insert into email_lookup_log(user_id) values (auth.uid());
  delete from email_lookup_log where at < now() - interval '2 days';

  select id into v_uid
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if not found then return '[]'::jsonb; end if;

  select * into v_profile from profiles where id = v_uid;

  -- Minimal disclosure: only what the invite-lookup UI renders. Last name is
  -- reduced to an initial — enough for the admin to confirm identity.
  return jsonb_build_array(jsonb_build_object(
    'id',          v_uid,
    'first_name',  coalesce(v_profile.first_name, ''),
    'last_name',   case when coalesce(v_profile.last_name, '') = '' then ''
                        else left(v_profile.last_name, 1) || '.' end
  ));
end;
$$;

-- add_band_member_direct: adds an existing Bandapp user to a band by their UUID
-- Used by the "Already on Bandapp?" flow after finding them via find_user_by_email.
create or replace function add_band_member_direct(
  p_band_id    uuid,
  p_user_id    uuid,
  p_role       text    default 'member',
  p_guest_start date   default null,
  p_guest_end   date   default null,
  p_guest_band  text   default null
)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_caller_role text;
  v_profile     profiles%rowtype;
begin
  -- Verify caller is admin of this band
  select role into v_caller_role
  from band_members
  where band_id = p_band_id and user_id = auth.uid();

  if v_caller_role <> 'admin' then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only band admins can add members');
  end if;

  -- Already a member?
  if exists(select 1 from band_members where band_id = p_band_id and user_id = p_user_id) then
    return jsonb_build_object('error', 'already_member', 'message', 'This user is already in the band');
  end if;

  insert into band_members(band_id, user_id, role, guest_start, guest_end, guest_band)
  values(p_band_id, p_user_id, p_role, p_guest_start, p_guest_end, p_guest_band);

  select * into v_profile from profiles where id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'name',    trim(coalesce(v_profile.first_name, '') || ' ' || coalesce(v_profile.last_name, ''))
  );
end;
$$;
