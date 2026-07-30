CREATE OR REPLACE FUNCTION assign_join_code(p_band_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  candidate text;
  attempt int := 0;
BEGIN
  IF NOT is_band_admin(p_band_id) THEN
    RAISE EXCEPTION 'not permitted';
  END IF;
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

GRANT EXECUTE ON FUNCTION assign_join_code(uuid) TO authenticated;
