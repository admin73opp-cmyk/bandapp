---
name: bandapp-context
description: Project context for the Bandapp codebase. Use proactively at the start of any session working on this project to quickly understand the architecture, data layer, database schema, and conventions before making changes.
---

# Bandapp — Project Context

## What this app is

A mobile-first band management web app (single `index.html`, vanilla JS, no build step). It lets musicians manage bands, members, songs, set lists, concerts, rehearsals, blackouts, and availability. Backend is Supabase (Postgres + Auth + Storage).

## File Structure

```
bandapp/
├── index.html              # All UI: HTML, inline CSS, all JS app logic (~6000 lines)
├── js/
│   ├── supabase-client.js  # createClient (loads first)
│   ├── auth.js             # login/logout/session restore, handleDbError(), loadCurrentUser()
│   ├── i18n.js             # t() translation helper
│   └── db/
│       ├── bands.js        # BandsDB namespace
│       ├── songs.js        # SongsDB namespace
│       ├── setlists.js     # SetlistsDB namespace
│       ├── concerts.js     # ConcertsDB namespace
│       ├── rehearsals.js   # RehearsalsDB namespace
│       ├── members.js      # MembersDB namespace + memberFromRow()
│       └── blackouts.js    # BlackoutsDB namespace
├── locales/
│   └── pt-BR.js            # Brazilian Portuguese translations (key→value object)
├── supabase/
│   ├── schema.sql          # DDL: all tables, indexes, FK constraints
│   ├── rls.sql             # Row-Level Security policies + helper functions
│   ├── seed.sql            # Demo data (The Jazz Cats + BFC bands)
│   ├── fix_demo_user.sql   # One-off fix scripts
│   └── functions/
│       └── invite-member/  # Edge Function: invite new members by email
└── vercel.json             # Static deploy: all routes → index.html
```

## Supabase Project

- **URL:** `https://yhnoxgoibtbwcavzwddj.supabase.co`
- **Anon key:** in `js/supabase-client.js` (safe to expose; RLS enforces access)
- **Demo user:** `demo@bandapp.com` / `demo1234`

## Database Schema (key tables)

| Table | Key columns |
|-------|-------------|
| `bands` | `id uuid PK`, `name`, `initials`, `color`, `city`, `country`, `genre`, `bio`, `whatsapp_link`, `cover_url`, `logo_url`, `*_url` platform links, `photos text[]`, `notification_pref` |
| `profiles` | `id uuid PK → auth.users`, `first_name`, `last_name`, `initials`, `instrument`, `instrument2`, `vocals`, `availability int4[]`, `color`, `bday`, `lang`, platform links, `photo_url` |
| `band_members` | `band_id → bands`, `user_id → profiles`, `role` ('admin'/'member'/'guest'), `guest_start`, `guest_end`, `guest_band`, `guest_status` |
| `songs` | `band_id → bands`, `title`, `artist`, `key`, `duration int`, `notes`, platform links, `hidden bool` |
| `song_notes` | `song_id → songs`, `user_id → profiles`, `note` (per-user notes) |
| `setlists` | `band_id → bands`, `name`, `date`, `type`, `venue`, `duration`, `paid bool` |
| `setlist_songs` | `setlist_id → setlists`, `song_id → songs`, `position int` |
| `concerts` | `band_id → bands`, `title`, `venue`, `date`, `time`, `cancelled bool` |
| `concert_setlists` | `concert_id → concerts`, `setlist_id → setlists` |
| `rehearsals` | `band_id → bands`, `title`, `location`, `date`, `start_time`, `end_time`, `setlist_id`, `cancelled bool` |
| `blackouts` | `band_id → bands`, `label`, `from_date`, `to_date`, `scope` ('band'/'members'), `member_ids uuid[]` |
| `event_photos` | `event_type` ('concert'/'rehearsal'), `event_id uuid`, `url`, `uploaded_by → profiles` |

## Key Global Variables (in index.html)

```js
currentUser        // { id, email, firstName, lastName, instrument, color, lang, avail, _profile, _memberships }
activeBandId       // UUID of the currently selected band (persisted in localStorage)
bandWaLinks        // { [bandId]: whatsappLink } in-memory cache
bandNotifPref      // { [bandId]: 'email'|'whatsapp'|'both' } in-memory cache
songs[]            // current band's songs (fetched from SongsDB)
setlists[]         // current band's setlists
concerts[]         // current band's concerts
rehearsals[]       // current band's rehearsals
members[]          // current band's members (fetched from MembersDB)
blackouts[]        // current band's blackouts
```

## Data Layer Conventions

Each `js/db/*.js` file exports a namespace object (e.g., `BandsDB`, `SongsDB`):

- **`fetch(bandId)`** — SELECT rows, return mapped array
- **`upsert(obj)`** — INSERT OR UPDATE, return saved row (or null on error)
- **`delete(id)`** — DELETE by UUID
- **`handleDbError(err)`** — defined in `auth.js`; calls `toast2(msg, 'w')`

Field name aliases (SongsDB maps DB columns → UI names):
- `duration` ↔ `dur`
- `notes` ↔ `note`
- `spotify_url` / `youtube_url` / `apple_url` ↔ `spotify` / `youtube` / `apple`

MembersDB uses `memberFromRow(row)` to flatten `band_members JOIN profiles` into a flat member object with camelCase fields (`firstName`, `lastName`, `phoneDial`, `phoneNum`, etc.).

## RLS Pattern

- `is_band_member(bid uuid)` — SECURITY DEFINER fn; checks `band_members`
- `is_band_admin(bid uuid)` — same but requires `role = 'admin'`
- Most tables: SELECT for members, INSERT/UPDATE/DELETE for admins only
- `profiles`: each user can read/write their own row
- `song_notes`: each user manages their own notes (`user_id = auth.uid()`)

## Authentication Flow

1. Page loads → `supabase.auth.onAuthStateChange` fires
2. If session: `loadCurrentUser(uid, email)` populates `currentUser`, then `initApp()`
3. `initApp()` fetches all data for the active band and renders the dashboard
4. Login: `doLogin()` → `signInWithPassword` → `onAuthStateChange` fires → `initApp()`
5. Demo: `doDemo()` → same flow with `demo@bandapp.com` / `demo1234`

## Internationalization

- `js/i18n.js` exports `t(key)` — looks up key in `locales/pt-BR.js` when `currentUser.lang === 'pt-BR'`, otherwise returns key as-is
- UI strings are wrapped in `t('...')` calls in index.html JS and `data-i18n="..."` attributes on static HTML elements
- `locales/pt-BR.js` is a plain JS object exported as `window.PTBR = { ... }`
- When adding new UI strings, wrap them in `t('...')` and add the key to `locales/pt-BR.js`

## Navigation

- `nav(page)` — switches the visible page (dashboard, songs, setlists, concerts, rehearsals, members, calendar, bandProfile, myProfile, settings)
- Sidebar links call `nav()`; active state managed via CSS class `act`
- Modals: `openMod(id)` / `closeMod(id)` toggle `display:flex`

## Storage Buckets

- `band-assets` — public; band cover images (`cover/`) and logos (`logo/`)
- `event-photos` — concert/rehearsal photos
- `avatars` — profile photos

## Invite Flow

- Admin copies invite link from Band Profile page (band join code in URL)
- New user opens link → signup form pre-fills name/instrument/band
- After email confirmation → `auth.js` detects `pendingBandId` in sessionStorage/metadata → auto-joins band as member
- Edge Function `invite-member` in `supabase/functions/invite-member/` handles email-based invites

## Common Patterns When Making Changes

1. **New DB column:** Add `alter table ... add column if not exists ...` to `schema.sql`; update relevant `js/db/*.js` fetch/upsert to include it; update seed.sql if needed
2. **New UI string:** Wrap in `t('...')`, add to `locales/pt-BR.js`
3. **New page:** Add HTML section in index.html, wire up in `nav()`, add sidebar link
4. **New modal:** Add `<div id="xyzMod" class="mod-bg">` structure, call `openMod('xyzMod')`
5. **RLS issue:** Check `rls.sql`; use `is_band_member()` / `is_band_admin()` predicates
