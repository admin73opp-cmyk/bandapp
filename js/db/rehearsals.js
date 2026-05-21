// ── Rehearsals data layer ────────────────────────────────────

async function fetchRehearsals(bandId) {
  const { data, error } = await supabase
    .from('rehearsals')
    .select('*')
    .eq('band_id', bandId)
    .order('date', { ascending: false });
  if (error) { handleDbError(error); return []; }
  return data || [];
}

async function upsertRehearsal(rehearsal) {
  const { photos, ...fields } = rehearsal;
  const { data, error } = await supabase
    .from('rehearsals')
    .upsert(fields)
    .select()
    .single();
  if (error) { handleDbError(error); return null; }
  return data;
}

async function deleteRehearsal(id) {
  const { error } = await supabase.from('rehearsals').delete().eq('id', id);
  if (error) { handleDbError(error); }
}
