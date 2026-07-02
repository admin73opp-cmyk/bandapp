-- Pin search_path on all SECURITY DEFINER functions (idempotent).
-- Fixes the Supabase "Function Search Path Mutable" lint: a definer function
-- resolving unqualified names against a caller-influenced search_path can be
-- hijacked by a shadowed table. Newer functions already pin it; these predate
-- the convention. Safe to re-run.

do $$
declare
  f text;
begin
  foreach f in array array[
    'join_band_by_code(uuid)',
    'find_user_by_email(text)',
    'add_band_member_direct(uuid, uuid, text, date, date, text)',
    'get_invite_by_token(uuid)',
    'mark_invite_used(uuid)',
    'is_band_member(uuid)',
    'is_band_admin(uuid)'
  ]
  loop
    begin
      execute format('alter function %s set search_path = public, pg_temp', f);
    exception
      when undefined_function then
        raise notice 'skipped (not deployed): %', f;
    end;
  end loop;
end $$;
