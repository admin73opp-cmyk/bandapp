// ── Members data layer ───────────────────────────────────────
// Returns combined profile + band_members rows for a band,
// shaped to match the prototype's members[] + extraData[] arrays.

async function fetchMembers(bandId) {
  const { data, error } = await supabase
    .from('band_members')
    .select(`
      role,
      guest_start,
      guest_end,
      guest_band,
      guest_status,
      profiles(*)
    `)
    .eq('band_id', bandId);
  if (error) { handleDbError(error); return []; }

  return (data || []).map(row => {
    const p = row.profiles;
    return {
      // Auth / membership
      id:          p.id,
      role:        row.role,
      guestStart:  row.guest_start,
      guestEnd:    row.guest_end,
      guestBand:   row.guest_band,
      guestStatus: row.guest_status,
      // Profile fields (matches prototype member shape)
      init:        p.initials,
      name:        [p.first_name, p.last_name].filter(Boolean).join(' '),
      firstName:   p.first_name,
      lastName:    p.last_name,
      instrument:  p.instrument,
      inst2:       p.instrument2,
      vocals:      p.vocals,
      avail:       p.availability || [1,1,1,1,1,1,1],
      color:       p.color,
      // Extra data (formerly extraData[])
      bday:        p.bday,
      nat:         p.nationality,
      country:     p.country,
      lang:        p.lang,
      bio:         p.bio,
      gear:        p.gear,
      phoneDial:   p.phone_dial,
      phoneNum:    p.phone_number,
      spotify:     p.spotify_url,
      apple:       p.apple_url,
      youtube:     p.youtube_url,
      instagram:   p.instagram_url,
      facebook:    p.facebook_url,
      website:     p.website_url,
      photo:       p.photo_url,
    };
  });
}

async function upsertProfile(profile) {
  const {
    id, init, name, firstName, lastName, instrument, inst2, vocals,
    avail, color, bday, nat, country, lang, bio, gear,
    phoneDial, phoneNum, spotify, apple, youtube, instagram, facebook, website, photo,
  } = profile;

  const { error } = await supabase.from('profiles').upsert({
    id,
    initials:      init,
    first_name:    firstName,
    last_name:     lastName,
    instrument,
    instrument2:   inst2,
    vocals,
    availability:  avail,
    color,
    bday:          bday || null,
    nationality:   nat,
    country,
    lang:          lang || 'en',
    bio,
    gear,
    phone_dial:    phoneDial,
    phone_number:  phoneNum,
    spotify_url:   spotify,
    apple_url:     apple,
    youtube_url:   youtube,
    instagram_url: instagram,
    facebook_url:  facebook,
    website_url:   website,
    photo_url:     photo,
  });
  if (error) { handleDbError(error); }
}

// Upload a profile photo to Supabase Storage and update the profile row
async function uploadProfilePhoto(userId, file) {
  const path = `avatars/${userId}/${Date.now()}-${file.name}`;
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true });
  if (upErr) { handleDbError(upErr); return null; }

  const { error } = await supabase
    .from('profiles')
    .update({ photo_url: path })
    .eq('id', userId);
  if (error) { handleDbError(error); return null; }
  return path;
}

// Returns a public URL for displaying a profile photo
function getAvatarUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return data.publicUrl;
}
