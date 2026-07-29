-- Add bpm column to songs table (idempotent)
-- Tempo in beats per minute. Optional — most songs never get one.
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS bpm int;

-- Range guard so a typo like 3000 cannot be stored. NULL stays allowed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'songs_bpm_range' AND conrelid = 'songs'::regclass
  ) THEN
    ALTER TABLE songs
      ADD CONSTRAINT songs_bpm_range
      CHECK (bpm IS NULL OR (bpm BETWEEN 20 AND 300));
  END IF;
END $$;
