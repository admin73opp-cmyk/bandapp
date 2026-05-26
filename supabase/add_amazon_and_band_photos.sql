-- ── Migration: Amazon Music URL + Band Photos ─────────────────
-- Run in Supabase SQL editor (safe to re-run).

-- 1. Add Amazon Music URL to songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS amazon_url text;

-- 2. Allow 'band' event type in event_photos so band gallery persists
ALTER TABLE event_photos DROP CONSTRAINT IF EXISTS event_photos_event_type_check;
ALTER TABLE event_photos ADD CONSTRAINT event_photos_event_type_check
  CHECK (event_type IN ('concert', 'rehearsal', 'band'));

-- 3. Update RLS select policy to cover band photos
DROP POLICY IF EXISTS "event_photos_select" ON event_photos;
CREATE POLICY "event_photos_select" ON event_photos
  FOR SELECT USING (
    (event_type = 'concert'   AND EXISTS (SELECT 1 FROM concerts   c WHERE c.id = event_photos.event_id AND is_band_member(c.band_id)))
    OR
    (event_type = 'rehearsal' AND EXISTS (SELECT 1 FROM rehearsals r WHERE r.id = event_photos.event_id AND is_band_member(r.band_id)))
    OR
    (event_type = 'band'      AND is_band_member(event_photos.event_id))
  );
