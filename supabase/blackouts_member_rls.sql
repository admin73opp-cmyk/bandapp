-- ============================================================
-- Patch: allow band members to create/delete their own personal blackouts
-- Run in Supabase Dashboard → SQL Editor
-- ============================================================

drop policy if exists "blackouts_insert" on blackouts;
drop policy if exists "blackouts_delete" on blackouts;

create policy "blackouts_insert" on blackouts
  for insert with check (
    is_band_admin(band_id)
    or (
      -- Members can block their own days only (scope='members', only their own UID)
      is_band_member(band_id)
      and scope = 'members'
      and member_ids @> ARRAY[auth.uid()]
      and cardinality(member_ids) = 1
    )
    or (
      -- Concert-generated cross-band blackout
      is_band_member(band_id)
      and source_concert_id is not null
      and exists(select 1 from concerts c where c.id = source_concert_id and c.band_id = band_id)
    )
  );

create policy "blackouts_delete" on blackouts
  for delete using (
    is_band_admin(band_id)
    or (is_band_member(band_id) and source_concert_id is not null)
    or (
      -- Member can delete their own personal blackout
      is_band_member(band_id)
      and scope = 'members'
      and member_ids @> ARRAY[auth.uid()]
      and cardinality(member_ids) = 1
    )
  );
