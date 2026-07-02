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

  select id into v_uid
  from auth.users
  where lower(email) = lower(p_email)
  limit 1;

  if not found then return '[]'::jsonb; end if;

  select * into v_profile from profiles where id = v_uid;

  return jsonb_build_array(jsonb_build_object(
    'id',          v_uid,
    'first_name',  coalesce(v_profile.first_name, ''),
    'last_name',   coalesce(v_profile.last_name, ''),
    'instrument',  coalesce(v_profile.instrument, ''),
    'initials',    coalesce(v_profile.initials, ''),
    'color',       coalesce(v_profile.color, '#6C63FF')
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
