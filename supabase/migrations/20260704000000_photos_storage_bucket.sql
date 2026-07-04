-- Photo storage bucket (idempotent — run in Dashboard → SQL Editor).
-- Moves member/band/event photos out of base64-in-DB-rows and into Supabase
-- Storage. Until this runs, the client falls back to storing compressed base64
-- inline (current behaviour), so deploying the client before this is safe.
--
-- Bucket is public-read: photos render via public URLs (getPublicUrl), so no
-- SELECT policy is needed for rendering. Writes are limited to authenticated
-- users — consistent with the app's "auth is the real protection" posture.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'photos', 'photos', true, 3145728,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 3145728,
      allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif'];

-- storage.objects RLS: public read + authenticated write, scoped to this bucket.
drop policy if exists "photos_public_read"   on storage.objects;
drop policy if exists "photos_auth_insert"   on storage.objects;
drop policy if exists "photos_auth_update"   on storage.objects;
drop policy if exists "photos_auth_delete"   on storage.objects;

create policy "photos_public_read" on storage.objects
  for select using (bucket_id = 'photos');

create policy "photos_auth_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'photos');

create policy "photos_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'photos') with check (bucket_id = 'photos');

create policy "photos_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'photos');
