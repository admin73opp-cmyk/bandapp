-- Add email column to profiles, synced from auth.users
alter table profiles add column if not exists email text;

-- Trigger: when a profile row is inserted/updated without an email,
-- pull the email from auth.users automatically.
create or replace function sync_profile_email()
returns trigger language plpgsql security definer as $$
begin
  if new.email is null or new.email = '' then
    select email into new.email from auth.users where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists profile_email_sync on profiles;
create trigger profile_email_sync
  before insert or update on profiles
  for each row execute function sync_profile_email();

-- Backfill existing profiles that have no email yet
update profiles p
set email = u.email
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');
