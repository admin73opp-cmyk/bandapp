-- Human-readable band join code (idempotent).
-- 6 chars from a 31-char alphabet with no I/L/O/0/1, so it can be read aloud
-- and typed without ambiguity. ~887 million combinations.

ALTER TABLE bands ADD COLUMN IF NOT EXISTS join_code text;

CREATE UNIQUE INDEX IF NOT EXISTS bands_join_code_key ON bands(join_code);

CREATE OR REPLACE FUNCTION gen_join_code()
RETURNS text LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  out_code text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    out_code := out_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  END LOOP;
  RETURN out_code;
END $$;

-- Retries on collision. The unique index is the real backstop.
CREATE OR REPLACE FUNCTION assign_join_code(p_band_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  candidate text;
  attempt int := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    candidate := gen_join_code();
    BEGIN
      UPDATE bands SET join_code = candidate WHERE id = p_band_id;
      RETURN candidate;
    EXCEPTION WHEN unique_violation THEN
      IF attempt >= 12 THEN RAISE EXCEPTION 'could not allocate join_code'; END IF;
    END;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION bands_set_join_code()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public, pg_temp AS $$
DECLARE
  candidate text;
  attempt int := 0;
BEGIN
  IF NEW.join_code IS NOT NULL THEN RETURN NEW; END IF;
  LOOP
    attempt := attempt + 1;
    candidate := gen_join_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM bands WHERE join_code = candidate);
    IF attempt >= 12 THEN RAISE EXCEPTION 'could not allocate join_code'; END IF;
  END LOOP;
  NEW.join_code := candidate;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS bands_join_code_trg ON bands;
CREATE TRIGGER bands_join_code_trg
  BEFORE INSERT ON bands
  FOR EACH ROW EXECUTE FUNCTION bands_set_join_code();

-- Backfill existing bands
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM bands WHERE join_code IS NULL LOOP
    PERFORM assign_join_code(r.id);
  END LOOP;
END $$;
