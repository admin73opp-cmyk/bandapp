-- Harden find_user_by_email (idempotent — run in Dashboard → SQL Editor).
-- Before: any admin of any (self-created) band could look up ANY email
-- platform-wide and receive that user's full name, instrument, initials and
-- color — email enumeration + PII disclosure beyond the invite-lookup need.
-- After: rate-limited (20/hour per caller, logged), and returns only id,
-- first name and a last-name initial — what the invite UI actually renders.

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
  if auth.uid() is null then
    return jsonb_build_object('error', 'unauthenticated');
  end if;

  if not exists(select 1 from band_members where user_id = auth.uid() and role = 'admin') then
    return jsonb_build_object('error', 'forbidden', 'message', 'Only band admins can look up members by email');
  end if;

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

  return jsonb_build_array(jsonb_build_object(
    'id',          v_uid,
    'first_name',  coalesce(v_profile.first_name, ''),
    'last_name',   case when coalesce(v_profile.last_name, '') = '' then ''
                        else left(v_profile.last_name, 1) || '.' end
  ));
end;
$$;
