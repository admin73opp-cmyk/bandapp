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
    const { data, error } = await supabase
      .from('bands')
      .upsert(fields)
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return data;
  },

  // Creates a new band and adds the caller as admin atomically via SECURITY DEFINER RPC.
  // Returns the new band's UUID, or null on error.
  async createWithAdmin(fields) {
    const { data, error } = await supabase.rpc('create_band_with_admin', {
      p_name:     fields.name     || '',
      p_initials: fields.initials || null,
      p_color:    fields.color    || '#6C63FF',
      p_city:     fields.city     || null,
      p_country:  fields.country  || null,
      p_genre:    fields.genre    || null,
      p_bio:      fields.bio      || null,
    });
    if (error) { handleDbError(error); return null; }
    return data; // UUID string
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

};
