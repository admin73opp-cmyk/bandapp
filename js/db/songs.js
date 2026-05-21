// ── Songs data layer — SongsDB namespace ─────────────────────
// Translates between DB column names and the UI field names used
// throughout index.html (duration↔dur, notes↔note).

const SongsDB = {

  async fetch(bandId) {
    console.log('[bandapp] SongsDB.fetch — bandId:', bandId);
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('band_id', bandId)
      .order('title');
    if (error) { handleDbError(error); return []; }
    console.log('[bandapp] SongsDB.fetch — returned', (data||[]).length, 'rows');
    return (data || []).map(s => ({ ...s, dur: s.duration, note: s.notes }));
  },

  // Returns {songUUID: noteText} map for the current user in a band
  async fetchNotes(bandId) {
    const { data, error } = await supabase
      .from('song_notes')
      .select('song_id, note, songs!inner(band_id)')
      .eq('user_id', currentUser.id)
      .eq('songs.band_id', bandId);
    if (error) { handleDbError(error); return {}; }
    return Object.fromEntries((data || []).map(r => [r.song_id, r.note]));
  },

  async upsert(song) {
    // Strip UI aliases and derived fields; map back to DB column names
    const { dur, note, legacy_id, band_members, ...rest } = song;
    const payload = { ...rest, duration: dur, notes: note };
    if (!payload.band_id) payload.band_id = activeBandId;

    const { data, error } = await supabase
      .from('songs')
      .upsert(payload)
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return { ...data, dur: data.duration, note: data.notes };
  },

  async delete(id) {
    const { error } = await supabase.from('songs').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  async upsertNote(songId, note) {
    const { error } = await supabase
      .from('song_notes')
      .upsert({ song_id: songId, user_id: currentUser.id, note });
    if (error) { handleDbError(error); }
  },

  async deleteNote(songId) {
    const { error } = await supabase
      .from('song_notes')
      .delete()
      .eq('song_id', songId)
      .eq('user_id', currentUser.id);
    if (error) { handleDbError(error); }
  },

};
