// ── Concerts data layer ──────────────────────────────────────

async function fetchConcerts(bandId) {
  const { data, error } = await supabase
    .from('concerts')
    .select(`
      *,
      concert_setlists(setlist_id)
    `)
    .eq('band_id', bandId)
    .order('date', { ascending: false });
  if (error) { handleDbError(error); return []; }

  // Flatten setlist ids into an array to match prototype shape
  return (data || []).map(c => ({
    ...c,
    setlistIds: (c.concert_setlists || []).map(cs => cs.setlist_id),
  }));
}

async function upsertConcert(concert) {
  const { setlistIds, concert_setlists, photos, ...fields } = concert;
  const { data, error } = await supabase
    .from('concerts')
    .upsert(fields)
    .select()
    .single();
  if (error) { handleDbError(error); return null; }

  // Sync concert_setlists if provided
  if (setlistIds !== undefined) {
    await supabase.from('concert_setlists').delete().eq('concert_id', data.id);
    if (setlistIds.length) {
      const rows = setlistIds.map(sid => ({ concert_id: data.id, setlist_id: sid }));
      await supabase.from('concert_setlists').insert(rows);
    }
  }
  return data;
}

async function deleteConcert(id) {
  const { error } = await supabase.from('concerts').delete().eq('id', id);
  if (error) { handleDbError(error); }
}

// ── Concert photos ───────────────────────────────────────────

async function fetchEventPhotos(eventType, eventId) {
  const { data, error } = await supabase
    .from('event_photos')
    .select('id, url, created_at')
    .eq('event_type', eventType)
    .eq('event_id', eventId)
    .order('created_at');
  if (error) { handleDbError(error); return []; }
  return data || [];
}

async function uploadEventPhoto(eventType, eventId, file) {
  const path = `${eventType}s/${eventId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from('event-photos')
    .upload(path, file, { upsert: false });
  if (upErr) { handleDbError(upErr); return null; }

  const { error: rowErr } = await supabase.from('event_photos').insert({
    event_type:  eventType,
    event_id:    eventId,
    url:         path,
    uploaded_by: currentUser.id,
  });
  if (rowErr) { handleDbError(rowErr); return null; }
  return path;
}

async function deleteEventPhoto(photoId, storagePath) {
  await supabase.storage.from('event-photos').remove([storagePath]);
  const { error } = await supabase.from('event_photos').delete().eq('id', photoId);
  if (error) { handleDbError(error); }
}

// Returns a public/signed URL for displaying a stored photo
function getPhotoUrl(path) {
  const { data } = supabase.storage.from('event-photos').getPublicUrl(path);
  return data.publicUrl;
}
