-- Per-user Set List "My View" preferences (idempotent)
--
-- Shape: {"fields": ["title","artist","key","note","mynote"], "landscape": true}
--   fields    — which optional columns My View shows, in a fixed display order
--   landscape — whether the My View print opens in landscape
--
-- Stored on profiles so the choice follows the user across devices. No RLS
-- change needed: profiles_update already allows id = auth.uid(), and this is
-- always the user editing their own row.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS myview_prefs jsonb;
