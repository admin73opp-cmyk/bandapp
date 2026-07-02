// ── Setlists data layer — SetlistsDB namespace ───────────────

const SetlistsDB = {

  async fetch(bandId) {
    const { data, error } = await supabase
      .from('setlists')
      .select('*')
      .eq('band_id', bandId)
      .order('created_at', { ascending: false });
    if (error) { handleDbError(error); return []; }
    // Attach empty concertIds; concert-setlist links are restored when
    // concerts are migrated and concert_setlists is queried.
    return (data || []).map(sl => ({ ...sl, concertIds: [] }));
  },

  // Returns ordered array of song UUIDs for a setlist
  async fetchSongs(setlistId) {
    const { data, error } = await supabase
      .from('setlist_songs')
      .select('song_id, position')
      .eq('setlist_id', setlistId)
      .order('position');
    if (error) { handleDbError(error); return []; }
    return (data || []).map(r => r.song_id);
  },

  async upsert(setlist) {
    const { concertIds, ...fields } = setlist;
    if (!fields.band_id) fields.band_id = activeBandId;
    const { data, error } = await supabase
      .from('setlists')
      .upsert(fields)
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return { ...data, concertIds: concertIds || [] };
  },

  async delete(id) {
    const { error } = await supabase.from('setlists').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  // Replace the full ordered song list for a setlist (used after any reorder).
  // Delete-then-insert against unique(setlist_id, position) means two
  // concurrent saves interleave and can leave the DB with a partial or empty
  // setlist. Serialize writes per setlist; because every save carries the
  // complete list, queued calls coalesce to the latest snapshot.
  _saveChains: {},
  _pendingSongs: {},

  saveSongs(setlistId, songIds) {
    this._pendingSongs[setlistId] = songIds.slice();
    const prev = this._saveChains[setlistId] || Promise.resolve();
    const run = prev.then(async () => {
      const ids = this._pendingSongs[setlistId];
      if (!ids) return; // a later queued call already flushed this snapshot
      delete this._pendingSongs[setlistId];
      await this._saveSongsNow(setlistId, ids);
    });
    this._saveChains[setlistId] = run.catch(() => {});
    return run;
  },

  async _saveSongsNow(setlistId, songIds) {
    const { error: delErr } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId);
    if (delErr) { handleDbError(delErr); return; }
    if (!songIds.length) return;
    const rows = songIds.map((songId, i) => ({
      setlist_id: setlistId,
      song_id:    songId,
      position:   i + 1,
    }));
    const { error } = await supabase.from('setlist_songs').insert(rows);
    if (error) {
      handleDbError(error);
      // The DB may now hold a partial list — re-sync the local cache to what
      // actually persisted so the UI doesn't show an order that will vanish.
      const actual = await this.fetchSongs(setlistId);
      if (typeof slSongs !== 'undefined') {
        slSongs[setlistId] = actual;
        if (typeof renderSL === 'function') try { renderSL(); } catch (e) {}
      }
    }
  },

  async addSong(setlistId, songId) {
    const { data } = await supabase
      .from('setlist_songs')
      .select('position')
      .eq('setlist_id', setlistId)
      .order('position', { ascending: false })
      .limit(1);
    const nextPos = ((data?.[0]?.position) || 0) + 1;
    const { error } = await supabase
      .from('setlist_songs')
      .insert({ setlist_id: setlistId, song_id: songId, position: nextPos });
    if (error) { handleDbError(error); }
  },

  async removeSong(setlistId, songId) {
    const { error } = await supabase
      .from('setlist_songs')
      .delete()
      .eq('setlist_id', setlistId)
      .eq('song_id', songId);
    if (error) { handleDbError(error); }
    // Re-number remaining positions so there are no gaps
    const remaining = slSongs[setlistId] || [];
    if (remaining.length) await SetlistsDB.saveSongs(setlistId, remaining);
  },
};
