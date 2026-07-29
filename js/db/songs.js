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

  // UI fields → DB columns (strip aliases and derived fields)
  _toPayload(song) {
    const {
      dur, note, spotify, youtube, apple, amazon,
      lyrics, sheet_music,
      legacy_id, band_members, ...rest
    } = song;
    const payload = {
      ...rest,
      duration:        dur          ?? null,
      notes:           note,
      spotify_url:     spotify      || null,
      youtube_url:     youtube      || null,
      apple_url:       apple        || null,
      amazon_url:      amazon       || null,
      lyrics_url:      lyrics       || null,
      sheet_music_url: sheet_music  || null,
    };
    if (!payload.band_id) payload.band_id = activeBandId;
    // Drop undefined keys. For a batch upsert, supabase-js builds the
    // PostgREST `columns` list from Object.keys() of every row, so an
    // undefined `id` (import) would be listed as a column but omitted from
    // the JSON body — PostgREST then inserts NULL and the songs.id primary
    // key rejects it. Single-row upserts never hit this because
    // JSON.stringify already drops undefined and no `columns` list is sent.
    // duration is coerced to null above rather than dropped — the sheet
    // editor sets dur to undefined to mean "cleared", which must persist.
    for (const k of Object.keys(payload)) if (payload[k] === undefined) delete payload[k];
    return payload;
  },

  // DB row → UI fields
  _fromRow(data) {
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

  _isColumnError(error) {
    return !!error && (error.code === '42703'
      || error.message?.includes('column')
      || error.message?.includes('does not exist'));
  },

  // Drop only the offending column(s) so a missing migration doesn't block
  // ALL saves. amazon_url (newest field) is dropped on any column error;
  // lyrics_url/sheet_music_url only if explicitly named. Never guesses.
  _stripMissingCols(payload, msg) {
    const fb = { ...payload };
    if ((msg || '').includes('lyrics_url'))      delete fb.lyrics_url;
    if ((msg || '').includes('sheet_music_url')) delete fb.sheet_music_url;
    if ((msg || '').includes('bpm'))             delete fb.bpm;
    delete fb.amazon_url;
    return fb;
  },

  async upsert(song) {
    const payload = this._toPayload(song);
    let { data, error } = await supabase.from('songs').upsert(payload).select().single();
    if (this._isColumnError(error)) {
      console.warn('[bandapp] songs.upsert — column missing, retrying without new fields:', error.message);
      ({ data, error } = await supabase.from('songs')
        .upsert(this._stripMissingCols(payload, error.message)).select().single());
    }
    if (error) { console.error('[bandapp] songs.upsert error:', error); throw error; }
    return this._fromRow(data);
  },

  // Batched upsert — one round-trip for many songs (import / sheet save)
  // instead of N. Same column-missing fallback as upsert(): if the batch
  // fails on a missing column, the offending column is stripped from every
  // row and the batch is retried once.
  async upsertMany(songs) {
    if (!songs.length) return [];
    let payloads = songs.map(s => this._toPayload(s));
    let { data, error } = await supabase.from('songs').upsert(payloads).select();
    if (this._isColumnError(error)) {
      console.warn('[bandapp] songs.upsertMany — column missing, retrying without new fields:', error.message);
      payloads = payloads.map(p => this._stripMissingCols(p, error.message));
      ({ data, error } = await supabase.from('songs').upsert(payloads).select());
    }
    if (error) { console.error('[bandapp] songs.upsertMany error:', error); throw error; }
    return (data || []).map(r => this._fromRow(r));
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
