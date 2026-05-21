// ── Songs data layer ─────────────────────────────────────────

async function fetchSongs(bandId) {
  const { data, error } = await supabase
    .from('songs')
    .select('*')
    .eq('band_id', bandId)
    .order('title');
  if (error) { handleDbError(error); return []; }
  return data;
}

// Returns {songId: note} map for the current user in a band
async function fetchSongNotes(bandId) {
  const { data, error } = await supabase
    .from('song_notes')
    .select('song_id, note, songs!inner(band_id)')
    .eq('user_id', currentUser.id)
    .eq('songs.band_id', bandId);
  if (error) { handleDbError(error); return {}; }
  return Object.fromEntries((data || []).map(r => [r.song_id, r.note]));
}

async function upsertSong(song) {
  const { data, error } = await supabase
    .from('songs')
    .upsert(song)
    .select()
    .single();
  if (error) { handleDbError(error); return null; }
  return data;
}

async function deleteSong(id) {
  const { error } = await supabase.from('songs').delete().eq('id', id);
  if (error) { handleDbError(error); }
}

async function upsertSongNote(songId, note) {
  const { error } = await supabase
    .from('song_notes')
    .upsert({ song_id: songId, user_id: currentUser.id, note });
  if (error) { handleDbError(error); }
}

async function deleteSongNote(songId) {
  const { error } = await supabase
    .from('song_notes')
    .delete()
    .eq('song_id', songId)
    .eq('user_id', currentUser.id);
  if (error) { handleDbError(error); }
}
