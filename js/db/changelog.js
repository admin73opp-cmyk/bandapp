// ── Calendar Change Log — ChangelogDB namespace ──────────────
// Lightweight, fire-and-forget logging for rehearsal, concert,
// blackout and availability mutations visible on the calendar.

const ChangelogDB = {

  // Write one entry — non-blocking; caller does not await.
  // On failure logs to console.error so the browser console shows the real reason.
  async log(bandId, userId, action, entityType, entityId, description, impactsEvent = false) {
    const { error } = await supabase
      .from('calendar_changelog')
      .insert({
        band_id:       bandId,
        user_id:       userId,
        action,
        entity_type:   entityType,
        entity_id:     entityId || null,
        description,
        impacts_event: impactsEvent,
      });
    if (error) {
      console.error('[bandapp] changelog insert failed:', error.code, error.message);
    }
  },

  // Fetch entries for the active band within `days` days, newest first.
  // Returns:
  //   null  — table does not exist (run supabase/calendar_changelog.sql)
  //   []    — table exists but no entries match the filter
  //   [...] — list of entries with synthetic user_name resolved
  async fetch(bandId, days = 10, userId = null) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    let q = supabase
      .from('calendar_changelog')
      .select('*, profiles(first_name, last_name)')
      .eq('band_id', bandId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })
      .limit(200);

    if (userId) q = q.eq('user_id', userId);

    const { data, error } = await q;
    if (error) {
      // 42P01 = "relation does not exist" — table hasn't been created yet
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('[bandapp] calendar_changelog table missing — run supabase/calendar_changelog.sql');
        return null; // sentinel: table not found
      }
      console.error('[bandapp] changelog fetch failed:', error.code, error.message);
      return [];
    }

    return (data || []).map(r => ({
      ...r,
      user_name: r.profiles
        ? [r.profiles.first_name, r.profiles.last_name].filter(Boolean).join(' ')
        : 'Unknown',
    }));
  },

  // Admin only — remove all entries older than 60 days for this band.
  async deleteOlderThan60Days(bandId) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const { error } = await supabase
      .from('calendar_changelog')
      .delete()
      .eq('band_id', bandId)
      .lt('created_at', cutoff.toISOString());
    if (error) { console.warn('[bandapp] changelog cleanup failed:', error.message); }
    return !error;
  },
};
