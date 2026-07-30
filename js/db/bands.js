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
        platforms:     b.platforms     || [],
        photos:        [],
      };
    });
  },

  async upsert(band) {
    // join_code is owned by assign_join_code() database function and must not be written here
    const { role, memberCount, songCount, setlistCount, upcomingCount, pastCount,
            nextGig, photos, band_members, join_code, ...fields } = band;
    if (fields.id) {
      // Existing band — UPDATE only
      const { id, ...updateFields } = fields;
      const { data, error } = await supabase.from('bands').update(updateFields).eq('id', id).select().single();
      if (error) { handleDbError(error); return null; }
      return data;
    }
    // New band — generate UUID client-side so we never need to SELECT the row back
    // before adding the band_member (which would fail: SELECT policy requires is_band_member).
    const id = crypto.randomUUID();
    const { error } = await supabase.from('bands').insert({ id, ...fields });
    if (error) { handleDbError(error); return null; }
    return { id, ...fields };
  },

  async addMember(bandId, userId, role = 'admin') {
    // Use plain INSERT — upsert evaluates both INSERT and UPDATE policies even without a
    // conflict; the UPDATE policy (is_band_admin) would block a user adding themselves to
    // a brand-new band where they are not yet admin.
    const { error } = await supabase
      .from('band_members')
      .insert({ band_id: bandId, user_id: userId, role });
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
    if (error) { console.error('[bandapp] removePhoto error:', error); return false; }
    return true;
  },

};
