// ── Bands data layer — BandsDB namespace ─────────────────────

const BandsDB = {

  async fetch() {
    const { data, error } = await supabase
      .from('bands')
      .select('*, band_members(role, user_id)')
      .order('name');
    if (error) { handleDbError(error); return []; }
    return (data || []).map(b => {
      const myRow = (b.band_members || []).find(m => m.user_id === currentUser.id);
      const rawRole = myRow?.role || 'member';
      return {
        ...b,
        role:        rawRole.charAt(0).toUpperCase() + rawRole.slice(1), // 'Admin'|'Member'|'Guest'
        memberCount: (b.band_members || []).length,
        // Derived stats (computed from loaded arrays after initApp)
        songCount:     0,
        setlistCount:  0,
        upcomingCount: 0,
        pastCount:     0,
        nextGig:       { label: '—', sub: 'No gigs yet' },
        platforms:     [],
        photos:        [],
      };
    });
  },

  async upsert(band) {
    const { role, memberCount, songCount, setlistCount, upcomingCount, pastCount,
            nextGig, platforms, photos, band_members, ...fields } = band;
    let query;
    if (fields.id) {
      // Existing band — UPDATE only (INSERT…ON CONFLICT also triggers UPDATE RLS)
      const { id, ...updateFields } = fields;
      query = supabase.from('bands').update(updateFields).eq('id', id).select().single();
    } else {
      // New band — plain INSERT so only the INSERT policy is evaluated
      query = supabase.from('bands').insert(fields).select().single();
    }
    const { data, error } = await query;
    if (error) { handleDbError(error); return null; }
    return data;
  },

  async addMember(bandId, userId, role = 'admin') {
    const { error } = await supabase
      .from('band_members')
      .upsert({ band_id: bandId, user_id: userId, role });
    if (error) { handleDbError(error); }
  },

  async delete(id) {
    const { error } = await supabase.from('bands').delete().eq('id', id);
    if (error) { handleDbError(error); }
  },

  async fetchPhotos(bandId) {
    const { data, error } = await supabase
      .from('event_photos')
      .select('id, url')
      .eq('event_type', 'band')
      .eq('event_id', bandId);
    if (error) { console.error('[bandapp] BandsDB.fetchPhotos error:', error); return []; }
    return (data || []).map(p => ({ id: p.id, url: p.url }));
  },

  async addPhoto(bandId, url) {
    const { data, error } = await supabase
      .from('event_photos')
      .insert({ event_type: 'band', event_id: bandId, url, uploaded_by: currentUser.id })
      .select('id, url')
      .single();
    if (error) { console.error('[bandapp] BandsDB.addPhoto error:', error); throw error; }
    return { id: data.id, url: data.url };
  },

  async removePhoto(photoId) {
    const { error } = await supabase.from('event_photos').delete().eq('id', photoId);
    if (error) { console.error('[bandapp] BandsDB.removePhoto error:', error); }
  },

};
