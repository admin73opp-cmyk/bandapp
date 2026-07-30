-- join_band_by_code now takes text: either the 6-char join code or the band
-- UUID. The UUID form is kept so existing ?band=<uuid> share links and the old
-- copied "group code" still work.

DROP FUNCTION IF EXISTS join_band_by_code(uuid);
DROP FUNCTION IF EXISTS join_band_by_code(text);

CREATE FUNCTION join_band_by_code(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_band bands%rowtype;
  v_uid  uuid := auth.uid();
  v_norm text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('error', 'not_signed_in', 'message', 'Please sign in first.');
  END IF;

  -- Check UUID shape BEFORE stripping punctuation — a UUID contains dashes.
  IF p_code ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    SELECT * INTO v_band FROM bands WHERE id = p_code::uuid;
  ELSE
    v_norm := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
    IF length(v_norm) <> 6 THEN
      RETURN jsonb_build_object('error', 'band_not_found',
        'message', 'That code should be 6 characters. Check it and try again.');
    END IF;
    SELECT * INTO v_band FROM bands WHERE join_code = v_norm;
  END IF;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'band_not_found',
      'message', 'No group found with that code. Check it and try again.');
  END IF;

  IF EXISTS (SELECT 1 FROM band_members WHERE band_id = v_band.id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('success', true, 'band_id', v_band.id,
      'band_name', v_band.name, 'error', 'already_member');
  END IF;

  INSERT INTO band_members(band_id, user_id, role) VALUES (v_band.id, v_uid, 'member');

  RETURN jsonb_build_object('success', true, 'band_id', v_band.id, 'band_name', v_band.name);
END $$;

GRANT EXECUTE ON FUNCTION join_band_by_code(text) TO authenticated;
