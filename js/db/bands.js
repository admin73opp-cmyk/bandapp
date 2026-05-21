// ── Bands data layer ─────────────────────────────────────────

async function fetchBands() {
  const { data, error } = await supabase
    .from('bands')
    .select(`
      *,
      band_members(role, user_id)
    `)
    .order('name');
  if (error) { handleDbError(error); return []; }

  // Annotate each band with the current user's role in it
  return data.map(b => ({
    ...b,
    role: b.band_members.find(m => m.user_id === currentUser.id)?.role || 'member',
    memberCount: b.band_members.length,
  }));
}

async function upsertBand(band) {
  const { id, role, memberCount, band_members, ...fields } = band;
  const { data, error } = await supabase
    .from('bands')
    .upsert({ ...fields, ...(id ? { id } : {}) })
    .select()
    .single();
  if (error) { handleDbError(error); return null; }
  return data;
}

async function deleteBand(id) {
  const { error } = await supabase.from('bands').delete().eq('id', id);
  if (error) { handleDbError(error); }
}

// Add or update a member's role within a band
async function upsertBandMember(bandId, userId, role, guestFields = {}) {
  const { error } = await supabase
    .from('band_members')
    .upsert({ band_id: bandId, user_id: userId, role, ...guestFields });
  if (error) { handleDbError(error); }
}

async function removeBandMember(bandId, userId) {
  const { error } = await supabase
    .from('band_members')
    .delete()
    .eq('band_id', bandId)
    .eq('user_id', userId);
  if (error) { handleDbError(error); }
}
