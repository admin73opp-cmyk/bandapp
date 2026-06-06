// ── Rehearsal RSVPs data layer — RsvpDB namespace ────────────
// status is 'yes' | 'no' | 'maybe'. No row for a member = "pending".
// RLS (see 20260607000000_rehearsal_rsvps.sql): members read/write their own
// row; admins read all rows for rehearsals in bands they administer.

const RsvpDB = {

  // Returns a map: rehearsal_id -> [{ user_id, status, note, responded_at }]
  // Admins get every member's row; members get only their own (RLS-filtered).
  async fetchForRehearsals(rehearsalIds) {
    if (!rehearsalIds.length) return {};
    const { data, error } = await supabase
      .from('rehearsal_rsvps')
      .select('rehearsal_id, user_id, status, note, responded_at')
      .in('rehearsal_id', rehearsalIds);
    if (error) { console.error('[bandapp] RsvpDB.fetch error:', error); return {}; }
    const map = {};
    (data || []).forEach(row => {
      (map[row.rehearsal_id] = map[row.rehearsal_id] || []).push(row);
    });
    return map;
  },

  // Upsert the current user's RSVP for a rehearsal (in-app path).
  async upsertMine(rehearsalId, status, note) {
    const { data, error } = await supabase
      .from('rehearsal_rsvps')
      .upsert({
        rehearsal_id: rehearsalId,
        user_id:      currentUser.id,
        status,
        note:         (note || '').trim() || null,
        responded_at: new Date().toISOString(),
      }, { onConflict: 'rehearsal_id,user_id' })
      .select()
      .single();
    if (error) { handleDbError(error); return null; }
    return data;
  },

  // One-click path: validate an opaque token and upsert (works logged-out).
  async submitByToken(token, status, note) {
    const { data, error } = await supabase.rpc('submit_rsvp_by_token', {
      p_token:  token,
      p_status: status,
      p_note:   (note || '').trim() || null,
    });
    if (error) return { error: error.message };
    return data;
  },

};
