// ── Songs data layer — SongsDB namespace ─────────────────────
// Translates between DB column names and the UI field names used
// throughout index.html (duration↔dur, notes↔note,
// spotify_url↔spotify, youtube_url↔youtube, apple_url↔apple,
// lyrics_url↔lyrics, sheet_music_url↔sheet_music).

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
      dur:         s.duration,
      note:        s.notes,
      spotify:     s.spotify_url      || '',
      youtube:     s.youtube_url      || '',
      apple:       s.apple_url        || '',
      amazon:      s.amazon_url       || '',
      lyrics:      s.lyrics_url       || '',
      sheet_music: s.sheet_music_url  || '',
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
    const {
      dur, note, spotify, youtube, apple, amazon,
      lyrics, sheet_music,
      legacy_id, band_members, ...rest
    } = song;
    const payload = {
      ...rest,
      duration:        dur,
      notes:           note,
      spotify_url:     spotify      || null,
      youtube_url:     youtube      || null,
      apple_url:       apple        || null,
      amazon_url:      amazon       || null,
      lyrics_url:      lyrics       || null,
      sheet_music_url: sheet_music  || null,
    };
    if (!payload.band_id) payload.band_id = activeBandId;

    // Remove columns that may not yet exist in the live DB so a missing
    // migration doesn't silently block ALL saves.  The retry without those
    // columns is a fallback; running the SQL migration is the proper fix.
    const tryUpsert = async (p) => {
      const { data, error } = await supabase
        .from('songs')
        .upsert(p)
        .select()
        .single();
      return { data, error };
    };

    let { data, error } = await tryUpsert(payload);

    // If the error is a missing column (42703), retry dropping only the
    // specific column that caused the failure — never drop lyrics_url or
    // sheet_music_url unless they are explicitly the missing column.
    if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
      console.warn('[bandapp] songs.upsert — column missing, retrying without new fields:', error.message);
      const msg = error.message || '';
      // Build a fallback payload by removing only the offending columns.
      // Priority: amazon_url is the most recently added field and the most
      // likely culprit; remove it first.  Only strip lyrics_url /
      // sheet_music_url if they are explicitly named in the error.
      let fallback = { ...payload };
      // Only drop a column if it is explicitly named in the error message.
      // amazon_url is removed on any column error because it is the newest
      // field and the most likely culprit when the exact column isn't named.
      if (msg.includes('lyrics_url'))      delete fallback.lyrics_url;
      if (msg.includes('sheet_music_url')) delete fallback.sheet_music_url;
      delete fallback.amazon_url;
      ({ data, error } = await tryUpsert(fallback));
    }

    if (error) { console.error('[bandapp] songs.upsert error:', error); throw error; }
    return {
      ...data,
      dur:         data.duration,
      note:        data.notes,
      spotify:     data.spotify_url      || '',
      youtube:     data.youtube_url      || '',
      apple:       data.apple_url        || '',
      amazon:      data.amazon_url       || '',
      lyrics:      data.lyrics_url       || '',
      sheet_music: data.sheet_music_url  || '',
    };
  },

  async delete(id) {
    const { error } = await supabase.from('songs').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  async upsertNote(songId, note) {
    const { error } = await supabase
      .from('song_notes')
      .upsert({ song_id: songId, user_id: currentUser.id, note },
               { onConflict: 'song_id,user_id' });
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
