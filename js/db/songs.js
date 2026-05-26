// ── Songs data layer — SongsDB namespace ─────────────────────
// Translates between DB column names and the UI field names used
// throughout index.html (duration↔dur, notes↔note,
// spotify_url↔spotify, youtube_url↔youtube, apple_url↔apple).

const SongsDB = {

  async fetch(bandId) {
    const { data, error } = await supabase
      .from('songs')
      .select('*')
      .eq('band_id', bandId)
      .order('title');
    if (error) { handleDbError(error); return []; }
    return (data || []).map(s => ({
      ...s,
      dur:     s.duration,
      note:    s.notes,
      spotify: s.spotify_url || '',
      youtube: s.youtube_url || '',
      apple:   s.apple_url   || '',
      amazon:  s.amazon_url  || '',
    }));
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
    const { dur, note, spotify, youtube, apple, amazon, legacy_id, band_members, ...rest } = song;
    const payload = {
      ...rest,
      duration:    dur,
      notes:       note,
      spotify_url: spotify || null,
      youtube_url: youtube || null,
      apple_url:   apple   || null,
      amazon_url:  amazon  || null,
    };
    if (!payload.band_id) payload.band_id = activeBandId;

    const { data, error } = await supabase
      .from('songs')
      .upsert(payload)
      .select()
      .single();
    if (error) { console.error('[bandapp] songs.upsert error:', error); throw error; }
    return {
      ...data,
      dur:     data.duration,
      note:    data.notes,
      spotify: data.spotify_url || '',
      youtube: data.youtube_url || '',
      apple:   data.apple_url   || '',
      amazon:  data.amazon_url  || '',
    };
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
