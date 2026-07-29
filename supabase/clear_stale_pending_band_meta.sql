-- ============================================================
-- One-off: clear stale invite band ids from auth metadata
-- Run in Supabase Dashboard → SQL Editor
--
-- pending_band_id / invited_band_id are one-shot join tokens, but nothing
-- ever cleared them. On every login the client fed them back into
-- join_band_by_code(), which unconditionally re-inserts a band_members row —
-- so any member an admin removed silently rejoined the next time they opened
-- the app, back at 'member' role.
--
-- The client now clears them after a successful join. This clears the ones
-- already stored, so nobody gets one final rejoin.
--
-- Safe to re-run. Does not touch memberships — remove anyone who has already
-- crept back in afterwards, and they will stay removed.
-- ============================================================

UPDATE auth.users
SET raw_user_meta_data = raw_user_meta_data - 'pending_band_id' - 'invited_band_id'
WHERE raw_user_meta_data ->> 'pending_band_id' IS NOT NULL
   OR raw_user_meta_data ->> 'invited_band_id' IS NOT NULL;
