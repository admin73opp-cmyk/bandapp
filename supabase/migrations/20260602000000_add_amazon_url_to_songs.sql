-- Add amazon_url column to songs table (idempotent)
ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS amazon_url text;
