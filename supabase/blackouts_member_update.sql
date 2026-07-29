-- ============================================================
-- Patch: allow band members to edit their own personal blackouts
-- Run in Supabase Dashboard → SQL Editor
--
-- Before this patch blackouts_update was admin-only, so a member who
-- blocked their own days could delete them but never correct the dates
-- or the label. Idempotent — safe to run more than once.
-- ============================================================

drop policy if exists "blackouts_update" on blackouts;

create policy "blackouts_update" on blackouts
  for update
  -- which rows a member may target
  using (
    is_band_admin(band_id)
    or (
      -- Member can edit their own personal blackout
      is_band_member(band_id)
      and scope = 'members'
      and member_ids @> ARRAY[auth.uid()]
      and cardinality(member_ids) = 1
    )
  )
  -- what the row is still allowed to look like afterwards, so a member
  -- cannot reassign the block to someone else or widen it to the whole group
  with check (
    is_band_admin(band_id)
    or (
      is_band_member(band_id)
      and scope = 'members'
      and member_ids @> ARRAY[auth.uid()]
      and cardinality(member_ids) = 1
    )
  );
