// ── Members data layer — MembersDB namespace ─────────────────
// Fetches band_members JOIN profiles, returning flat member objects
// that match the shape expected by the prototype's members[] and extraData[].

function memberFromRow(row) {
  const p = row.profiles || {};  // null when profiles_select RLS blocks the join
  return {
    id:          p.id || null,
    role:        row.role,
    guestStart:  row.guest_start  || null,
    guestEnd:    row.guest_end    || null,
    guestBand:   row.guest_band   || null,
    guestStatus: row.guest_status || null,
    // Prototype member shape
    init:        p.initials       || '',
    name:        [p.first_name, p.last_name].filter(Boolean).join(' '),
    firstName:   p.first_name     || '',
    lastName:    p.last_name      || '',
    instrument:  p.instrument     || '',
    inst2:       p.instrument2    || '',
    vocals:      p.vocals         || 'None',
    avail:       p.availability   || [1,1,1,1,1,1,1],
    color:       p.color          || '#6C63FF',
    // Extended profile (formerly extraData[])
    bday:        p.bday           || '',
    nat:         p.nationality    || '',
    country:     p.country        || '',
    lang:        p.lang           || 'en',
    bio:         p.bio            || '',
    gear:        p.gear           || '',
    phoneDial:   p.phone_dial     || '+32',
    phoneNum:    p.phone_number   || '',
    spotify:     p.spotify_url    || '',
    apple:       p.apple_url      || '',
    youtube:     p.youtube_url    || '',
    instagram:   p.instagram_url  || '',
    facebook:    p.facebook_url   || '',
    website:     p.website_url    || '',
    photo:       p.photo_url      || null,
  };
}

const MembersDB = {

  // Returns all band members (active, expired-natural, removed)
  async fetchAll(bandId) {
    const { data, error } = await supabase
      .from('band_members')
      .select('role, guest_start, guest_end, guest_band, guest_status, profiles(*)')
      .eq('band_id', bandId);
    if (error) { handleDbError(error); return []; }
    return (data || []).map(memberFromRow);
  },

  async upsertProfile(userId, fields) {
    const { error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...fields });
    if (error) { handleDbError(error); }
  },

  // Update role / guest dates on a band_members row
  async upsertBandMember(bandId, userId, fields) {
    const { error } = await supabase
      .from('band_members')
      .update(fields)
      .eq('band_id', bandId)
      .eq('user_id', userId);
    if (error) { handleDbError(error); }
  },

  // Remove a member: guests are archived (guest_status='removed'); others are deleted
  async removeBandMember(bandId, userId, asArchive) {
    if (asArchive) {
      const { error } = await supabase
        .from('band_members')
        .update({ guest_status: 'removed' })
        .eq('band_id', bandId)
        .eq('user_id', userId);
      if (error) { handleDbError(error); }
    } else {
      const { error } = await supabase
        .from('band_members')
        .delete()
        .eq('band_id', bandId)
        .eq('user_id', userId);
      if (error) { handleDbError(error); }
    }
  },

};
