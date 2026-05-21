// ── Setlists data layer ──────────────────────────────────────

async function fetchSetlists(bandId) {
  const { data, error } = await supabase
    .from('setlists')
    .select('*')
    .eq('band_id', bandId)
    .order('created_at', { ascending: false });
  if (error) { handleDbError(error); return []; }
  return data;
}

// Returns ordered array of song UUIDs for a setlist
async function fetchSetlistSongs(setlistId) {
  const { data, error } = await supabase
    .from('setlist_songs')
    .select('song_id, position')
    .eq('setlist_id', setlistId)
    .order('position');
  if (error) { handleDbError(error); return []; }
  return (data || []).map(r => r.song_id);
}

async function upsertSetlist(setlist) {
  const { data, error } = await supabase
    .from('setlists')
    .upsert(setlist)
    .select()
    .single();
  if (error) { handleDbError(error); return null; }
  return data;
}

async function deleteSetlist(id) {
  const { error } = await supabase.from('setlists').delete().eq('id', id);
  if (error) { handleDbError(error); }
}

// Replace all songs in a setlist with an ordered array of song UUIDs
async function saveSetlistSongs(setlistId, songIds) {
  // Delete existing then insert new order
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
  if (error) { handleDbError(error); }
}

async function addSongToSetlist(setlistId, songId) {
  // Find the current max position
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
}

async function removeSongFromSetlist(setlistId, songId) {
  const { error } = await supabase
    .from('setlist_songs')
    .delete()
    .eq('setlist_id', setlistId)
    .eq('song_id', songId);
  if (error) { handleDbError(error); }
}
