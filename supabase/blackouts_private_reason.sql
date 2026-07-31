-- Private blackout reasons — run in Supabase Dashboard → SQL Editor (idempotent).
-- Adds a "Make reason private" flag: the label/reason is masked server-side for
-- everyone except the person who created the block. The app reads from the
-- blackouts_visible view (falls back to the raw table until this is applied).

alter table blackouts add column if not exists reason_private boolean not null default false;
alter table blackouts add column if not exists created_by uuid;

-- Backfill: existing single-member personal blocks belong to that member, so
-- their reasons stay visible to them if they later mark one private.
update blackouts set created_by = member_ids[1]
where created_by is null and scope = 'members' and array_length(member_ids, 1) = 1;

-- security_invoker: the view runs with the caller's permissions, so the base
-- table's RLS policies still apply. Only the label is conditionally masked.
create or replace view blackouts_visible with (security_invoker = true) as
select id,
       band_id,
       case when reason_private and created_by is distinct from auth.uid()
            then null
            else label
       end as label,
       from_date,
       to_date,
       scope,
       member_ids,
       created_at,
       source_concert_id,
       reason_private,
       created_by
from blackouts;

grant select on blackouts_visible to authenticated;
