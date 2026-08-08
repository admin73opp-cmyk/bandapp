// ── Blackouts data layer — BlackoutsDB namespace ──────────────
// DB uses from_date/to_date and member_ids (uuid[]); UI uses from/to and mids.

function blackoutFromRow(row) {
  return {
    ...row,
    from:  row.from_date  || '',
    to:    row.to_date    || '',
    mids:  row.member_ids || [],
  };
}

const BlackoutsDB = {

  async fetch(bandId) {
    // blackouts_visible masks private reasons server-side for non-creators.
    // Fall back to the raw table until the blackouts_private_reason.sql
    // migration has been applied.
    let { data, error } = await supabase
      .from('blackouts_visible')
      .select('*')
      .eq('band_id', bandId)
      .order('from_date');
    if (error && /blackouts_visible/.test(error.message || '')) {
      ({ data, error } = await supabase
        .from('blackouts')
        .select('*')
        .eq('band_id', bandId)
        .order('from_date'));
    }
    if (error) { handleDbError(error); return []; }
    return (data || []).map(blackoutFromRow);
  },

  async upsert(blackout) {
    const { from, to, mids, ...fields } = blackout;
    fields.from_date  = from   || null;
    fields.to_date    = to     || null;
    fields.member_ids = mids   || [];
    if (!fields.band_id) fields.band_id = activeBandId;
    const run = (f) => {
      if (f.id) {
        const { id, ...updateFields } = f;
        return supabase.from('blackouts').update(updateFields).eq('id', id).select().single();
      }
      return supabase.from('blackouts').insert(f).select().single();
    };
    let { data, error } = await run(fields);
    // Pre-migration DBs lack reason_private/created_by — drop only the column
    // the error explicitly names and retry (never drop columns speculatively).
    if (error) {
      const msg = error.message || '';
      const retry = { ...fields };
      let dropped = false;
      ['reason_private', 'created_by'].forEach(col => {
        if (msg.includes(col) && col in retry) { delete retry[col]; dropped = true; }
      });
      if (dropped) ({ data, error } = await run(retry));
    }
    if (error) { handleDbError(error); return null; }
    return blackoutFromRow(data);
  },

  // Batch insert for weekday-filtered "Block Days" — one request for the
  // whole series instead of one per run. Returns the inserted rows, or
  // null on error.
  async insertMany(list) {
    const rows = list.map(blackout => {
      const { from, to, mids, ...fields } = blackout;
      fields.from_date  = from || null;
      fields.to_date    = to   || null;
      fields.member_ids = mids || [];
      if (!fields.band_id) fields.band_id = activeBandId;
      return fields;
    });
    const run = (rs) => supabase.from('blackouts').insert(rs).select();
    let { data, error } = await run(rows);
    // Same pre-migration fallback as upsert(): drop only the column the
    // error explicitly names and retry.
    if (error) {
      const msg = error.message || '';
      let dropped = false;
      const retry = rows.map(r => ({ ...r }));
      ['reason_private', 'created_by'].forEach(col => {
        if (msg.includes(col)) { retry.forEach(r => delete r[col]); dropped = true; }
      });
      if (dropped) ({ data, error } = await run(retry));
    }
    if (error) { handleDbError(error); return null; }
    return (data || []).map(blackoutFromRow);
  },

  async delete(id) {
    const { error } = await supabase.from('blackouts').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  async deleteByConcertId(concertId) {
    const { error } = await supabase
      .from('blackouts')
      .delete()
      .eq('source_concert_id', concertId);
    if (error) { console.error('[bandapp] BlackoutsDB.deleteByConcertId error:', error); }
  },

};
