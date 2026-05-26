-- Performance indexes: cover FK columns used by RLS policies and common filters

-- band_members: user_id is used in RLS policies on nearly every table
create index if not exists band_members_user_id_idx on band_members(user_id);

-- song_notes: RLS policy joins through songs(band_id) — index song_id for that join
create index if not exists song_notes_song_id_idx on song_notes(song_id);
create index if not exists song_notes_user_id_idx on song_notes(user_id);

-- setlist_songs: RLS policy reads setlist_id; song_id used in lookups
create index if not exists setlist_songs_song_id_idx on setlist_songs(song_id);

-- concert_setlists: both FK directions used in queries
create index if not exists concert_setlists_concert_id_idx on concert_setlists(concert_id);
create index if not exists concert_setlists_setlist_id_idx on concert_setlists(setlist_id);

-- rehearsals: date column is the primary sort/filter key
create index if not exists rehearsals_date_idx on rehearsals(band_id, date desc);

-- concerts: date used for ordering
create index if not exists concerts_date_idx on concerts(band_id, date desc);

-- blackouts: date range lookups
create index if not exists blackouts_band_date_idx on blackouts(band_id, from_date, to_date);

-- event_photos: queried by event_type + event_id on every load
create index if not exists event_photos_event_idx on event_photos(event_type, event_id);
