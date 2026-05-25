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
    const { data, error } = await supabase
      .from('blackouts')
      .select('*')
      .eq('band_id', bandId)
      .order('from_date');
    if (error) { handleDbError(error); return []; }
    return (data || []).map(blackoutFromRow);
  },

  async upsert(blackout) {
    const { from, to, mids, ...fields } = blackout;
    fields.from_date  = from   || null;
    fields.to_date    = to     || null;
    fields.member_ids = (mids || []).filter(id => id && id !== 'null');
    if (!fields.band_id) fields.band_id = activeBandId;
    const { data, error } = await supabase
      .from('blackouts')
      .upsert(fields)
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return blackoutFromRow(data);
  },

  async delete(id) {
    const { error } = await supabase.from('blackouts').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

};
