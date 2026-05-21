// ── Blackouts data layer ─────────────────────────────────────

async function fetchBlackouts(bandId) {
  const { data, error } = await supabase
    .from('blackouts')
    .select('*')
    .eq('band_id', bandId)
    .order('from_date');
  if (error) { handleDbError(error); return []; }
  return data || [];
}

async function upsertBlackout(blackout) {
  const { data, error } = await supabase
    .from('blackouts')
    .upsert(blackout)
    .select()
    .single();
  if (error) { handleDbError(error); return null; }
  return data;
}

async function deleteBlackout(id) {
  const { error } = await supabase.from('blackouts').delete().eq('id', id);
  if (error) { handleDbError(error); }
}
