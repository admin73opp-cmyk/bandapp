// ── Rehearsals data layer — RehearsalsDB namespace ───────────
// DB uses start_time/end_time and setlist_id; UI uses start/end/setlistId.

const MO_NAMES_REH = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function rehearsalFromRow(row) {
  const d = row.date ? new Date(row.date + 'T12:00:00') : null;
  return {
    ...row,
    month:     d ? MO_NAMES_REH[d.getMonth()] : '',
    day:       d ? String(d.getDate())         : '',
    year:      d ? String(d.getFullYear())     : '',
    start:     row.start_time || '',
    end:       row.end_time   || '',
    setlistId: row.setlist_id || null,
    photos: [],
  };
}

const RehearsalsDB = {

  async fetch(bandId) {
    const { data, error } = await supabase
      .from('rehearsals')
      .select('*')
      .eq('band_id', bandId)
      .order('date', { ascending: false });
    if (error) { handleDbError(error); return []; }
    return (data || []).map(rehearsalFromRow);
  },

  async upsert(rehearsal) {
    const { month, day, year, photos, start, end, setlistId, ...fields } = rehearsal;
    fields.start_time = start;
    fields.end_time   = end;
    fields.setlist_id = setlistId || null;
    if (!fields.band_id) fields.band_id = activeBandId;
    const { data, error } = await supabase
      .from('rehearsals')
      .upsert(fields)
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return rehearsalFromRow(data);
  },

  async delete(id) {
    const { error } = await supabase.from('rehearsals').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

};
