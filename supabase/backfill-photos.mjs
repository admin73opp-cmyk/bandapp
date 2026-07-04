#!/usr/bin/env node
// One-time backfill: move existing base64 photos out of DB rows into the
// Supabase Storage 'photos' bucket, replacing each column with its public URL.
//
// Prereqs: run supabase/migrations/20260704000000_photos_storage_bucket.sql
// first (creates the bucket). Then:
//
//   SERVICE_ROLE_KEY='eyJ...service-role-key...' node supabase/backfill-photos.mjs
//
// Get the service role key from Dashboard → Project Settings → API →
// service_role (NOT the anon key). It bypasses RLS — keep it secret, never
// commit it. Safe to re-run: rows already converted to URLs are skipped.

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://yhnoxgoibtbwcavzwddj.supabase.co';
const KEY = process.env.SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('ERROR: set SERVICE_ROLE_KEY (Dashboard → Settings → API → service_role).');
  process.exit(1);
}

const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// [table, id column, value column, path builder(row)]
const TARGETS = [
  ['profiles', 'id', 'photo_url', r => `avatars/${r.id}.jpg`],
  ['profiles', 'id', 'cover_url', r => `covers/member-${r.id}.jpg`],
  ['bands', 'id', 'cover_url', r => `covers/band-${r.id}.jpg`],
  ['bands', 'id', 'logo_url', r => `logos/${r.id}.jpg`],
  ['event_photos', 'id', 'url', r => `events/${r.event_type}/${r.event_id}/${r.id}.jpg`],
];

const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/photos/${path}`;

async function uploadDataUrl(dataUrl, path) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  if (!m) throw new Error('not a base64 data URL');
  const contentType = m[1] || 'image/jpeg';
  const bytes = Buffer.from(m[2], 'base64');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/photos/${path}`, {
    method: 'POST',
    headers: { ...H, 'Content-Type': contentType, 'x-upsert': 'true' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`storage upload ${res.status}: ${await res.text()}`);
}

async function fetchRows(table, idCol, col, extra) {
  const sel = [idCol, col, ...extra].join(',');
  // PostgREST wildcard is * (maps to SQL %)
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${sel}&${col}=like.data:*`;
  const res = await fetch(url, { headers: H });
  if (!res.ok) throw new Error(`select ${table}.${col} ${res.status}: ${await res.text()}`);
  return res.json();
}

async function patchRow(table, idCol, id, col, value) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${idCol}=eq.${id}`, {
    method: 'PATCH',
    headers: { ...H, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ [col]: value }),
  });
  if (!res.ok) throw new Error(`patch ${table}.${col} ${res.status}: ${await res.text()}`);
}

(async () => {
  let migrated = 0, failed = 0;
  for (const [table, idCol, col, pathOf] of TARGETS) {
    const extra = table === 'event_photos' ? ['event_type', 'event_id'] : [];
    let rows;
    try {
      rows = await fetchRows(table, idCol, col, extra);
    } catch (e) {
      console.error(`  ! skip ${table}.${col}: ${e.message}`);
      continue;
    }
    if (!rows.length) { console.log(`  ${table}.${col}: nothing to migrate`); continue; }
    console.log(`  ${table}.${col}: ${rows.length} to migrate`);
    for (const row of rows) {
      const path = pathOf(row);
      try {
        await uploadDataUrl(row[col], path);
        await patchRow(table, idCol, row[idCol], col, publicUrl(path));
        migrated++;
        process.stdout.write('.');
      } catch (e) {
        failed++;
        console.error(`\n  ! ${table}.${col} ${row[idCol]}: ${e.message}`);
      }
    }
    process.stdout.write('\n');
  }
  console.log(`\nDone. Migrated ${migrated} photo(s)${failed ? `, ${failed} failed` : ''}.`);
  process.exit(failed ? 1 : 0);
})();
