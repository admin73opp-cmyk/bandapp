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
