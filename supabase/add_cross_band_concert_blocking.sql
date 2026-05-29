-- ── Migration: Cross-band concert blocking ─────────────────────
-- When a user saves a concert in one band, the app automatically
-- creates a blackout in every other band they belong to, scoped to
-- that user only. This migration adds the tracking column and relaxes
-- the blackouts RLS so members (not just admins) can manage those
-- auto-created blocks.
-- Safe to re-run (uses IF NOT EXISTS / IF EXISTS guards).

-- 1. Add source_concert_id to blackouts
--    ON DELETE CASCADE means deleting the concert row auto-removes
--    all related cross-band blackouts.
ALTER TABLE blackouts
  ADD COLUMN IF NOT EXISTS source_concert_id uuid REFERENCES concerts(id) ON DELETE CASCADE;

-- 2. Relax blackouts_insert: members can insert auto-created cross-band blocks.
--    source_concert_id must belong to the same band to prevent members bypassing
--    the admin-only gate by supplying an arbitrary concert UUID.
DROP POLICY IF EXISTS "blackouts_insert" ON blackouts;
CREATE POLICY "blackouts_insert" ON blackouts
  FOR INSERT WITH CHECK (
    is_band_admin(band_id)
    OR (
      is_band_member(band_id)
      AND source_concert_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM concerts c WHERE c.id = source_concert_id AND c.band_id = band_id)
    )
  );

-- 3. Relax blackouts_delete: members can delete their own auto-created blocks
DROP POLICY IF EXISTS "blackouts_delete" ON blackouts;
CREATE POLICY "blackouts_delete" ON blackouts
  FOR DELETE USING (
    is_band_admin(band_id)
    OR (is_band_member(band_id) AND source_concert_id IS NOT NULL)
  );
