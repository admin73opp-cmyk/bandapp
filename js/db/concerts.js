// ── Concerts data layer — ConcertsDB namespace ───────────────
// DB stores date as ISO "2026-06-07"; app also uses derived month/day/year
// for display. Both are kept on the returned objects.

const MO_NAMES_DB = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function concertFromRow(row) {
  const d = row.date ? new Date(row.date + 'T12:00:00') : null;
  return {
    ...row,
    // derived display fields
    month: d ? MO_NAMES_DB[d.getMonth()] : '',
    day:   d ? String(d.getDate())        : '',
    year:  d ? String(d.getFullYear())    : '',
    // setlist links from junction table
    setlistIds: (row.concert_setlists || []).map(cs => cs.setlist_id),
    // photos migrated to Supabase Storage separately; start empty from DB
    photos: [],
  };
}

const ConcertsDB = {

  async fetch(bandId) {
    const { data, error } = await supabase
      .from('concerts')
      .select('*, concert_setlists(setlist_id)')
      .eq('band_id', bandId)
      .order('date', { ascending: false });
    if (error) { handleDbError(error); return []; }
    return (data || []).map(concertFromRow);
  },

  async upsert(concert) {
    const { month, day, year, photos, setlistIds, concert_setlists, ...fields } = concert;
    if (!fields.band_id) fields.band_id = activeBandId;
    const { data, error } = await supabase
      .from('concerts')
      .upsert(fields)
      .select('*, concert_setlists(setlist_id)')
      .single();
    if (error) { handleDbError(error); return null; }
    return concertFromRow(data);
  },

  async delete(id) {
    const { error } = await supabase.from('concerts').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  async linkSetlist(concertId, setlistId) {
    const { error } = await supabase
      .from('concert_setlists')
      .upsert({ concert_id: concertId, setlist_id: setlistId });
    if (error) { handleDbError(error); }
  },

  async unlinkSetlist(concertId, setlistId) {
    const { error } = await supabase
      .from('concert_setlists')
      .delete()
      .eq('concert_id', concertId)
      .eq('setlist_id', setlistId);
    if (error) { handleDbError(error); }
  },

};
