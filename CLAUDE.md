# Ritovo — CLAUDE.md

## Coding Guidelines (always active)
Apply **`/karpathy-guidelines`** on every coding task in this project — writing, reviewing, or refactoring.
Key principles:
- Make surgical, minimal changes. Don't refactor unrelated code in the same pass.
- Surface assumptions explicitly before acting.
- Prefer simple, direct solutions over clever abstractions.
- Define verifiable success criteria before writing code.
- Avoid overcomplication: if a fix touches more than ~3 files, pause and confirm scope.

## Project Overview
Music group management web app. Members share set lists, rehearsals, concerts, song library, availability, and group profile. Multi-group, multi-role (Admin / Member / Guest per group). Deployed at **bandapp-six.vercel.app**.

**Brand / product name: Ritovo.** All user-visible text says "Ritovo". The internal codebase, repo, and Supabase project still use `bandapp`/`band` identifiers — see Naming Conventions below.

## Tech Stack
- **Frontend**: Vanilla JS, HTML, CSS — no framework, no bundler
- **Backend/Auth/DB**: Supabase (Postgres + Auth + RLS + Edge Functions + Storage)
- **Hosting**: Vercel (auto-deploys on `git push` to `main`)
- **Mobile**: Capacitor (iOS/Android shell around the PWA)
- **Email**: Resend (via `invite-member` and `notify-rehearsal` edge functions)
- **CDN scripts** (loaded in `<head>`):
  - `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`
  - `https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js` (end of body)

## Repository & Identifiers
- **Repo**: `admin73opp-cmyk/bandapp`, branch `main`
- **Local path**: `~/bandapp`
- **Supabase project ref**: `yhnoxgoibtbwcavzwddj`
- **Supabase URL**: `https://yhnoxgoibtbwcavzwddj.supabase.co`
- **App bundle ID**: `com.bandapp.app`
- **Supabase CLI**: `/Users/73opp/.hermes/node/bin/supabase`

## Folder Structure
```
bandapp/
├── index.html          # ENTIRE app — ~7,300 lines of HTML + inline CSS + inline JS
├── build.js            # Content-hash build script (no npm deps)
├── js/
│   ├── auth.js         # Auth flow, session, invite, onAuthStateChange
│   ├── supabase-client.js  # createClient() — SUPABASE_URL + ANON_KEY hardcoded
│   ├── i18n.js         # t() translation helper
│   ├── capacitor-bridge.js # Deep-link handler (no-op on web)
│   └── db/             # Data-layer namespaces (one file per entity)
│       ├── bands.js    # BandsDB — NEVER rename to groups.js
│       ├── songs.js    # SongsDB
│       ├── members.js  # MembersDB
│       ├── rehearsals.js  # RehearsalsDB
│       ├── concerts.js # ConcertsDB
│       ├── setlists.js # SetlistsDB
│       ├── blackouts.js  # BlackoutsDB
│       └── changelog.js  # ChangelogDB
├── locales/            # Translation files: nl.js de.js fr.js es.js it.js pt-BR.js
├── api/
│   └── feedback.js     # Vercel serverless — feedback → GitHub issues
├── supabase/
│   ├── schema.sql      # Full DB schema (run once)
│   ├── rls.sql         # All RLS policies (idempotent — safe to re-run)
│   ├── *.sql           # Individual migration files
│   ├── config.toml     # Auth email templates + redirect URL config (push via `supabase config push`)
│   ├── templates/      # Ritovo-branded HTML email templates for Supabase system emails
│   └── functions/      # Deno edge functions (invite-member, notify-rehearsal, create-github-issue)
│       └── _shared/email.ts  # Shared emailLayout(), btn(), h() helpers for all transactional emails
├── logo/files/         # Brand SVGs: ritovo-logomark-{dark,light}.svg, ritovo-wordmark-{dark,light}.svg
└── dist/               # Build output (gitignored) — served by Vercel
```

## Build & Deploy
```bash
# Build locally (produces dist/)
node build.js

# Deploy — just push; Vercel auto-builds
git add <files> && git commit -m "message" && git push

# Deploy edge function
/Users/73opp/.hermes/node/bin/supabase functions deploy <function-name> --project-ref yhnoxgoibtbwcavzwddj

# Run SQL migrations (NO CLI migration system — paste into Supabase Dashboard → SQL Editor)
# Each .sql file in supabase/ must be run manually
```

## How the Build Works
`build.js` (pure Node, no deps):
1. Finds every `.js` file under `js/`
2. Copies each to `dist/js/<name>.<sha8>.js`
3. Rewrites `src="js/foo.js"` → `src="/js/foo.<hash>.js"` in `index.html`
4. Copies `locales/` and `.well-known/` unchanged
5. Outputs `dist/index.html` + hashed JS files

**Critical**: `js/db/bands.js` → hashed as `bands.<hash>.js`. Never rename the file itself; only UI text can say "group".

## Architecture Patterns

### State Management
All app state is plain JS globals in `index.html`:
```js
let BANDS = [];           // loaded by loadBands()
let activeBandId = null;  // persisted in localStorage
let songs = [];           // loadSongs()
let members = [];         // loadMembers()
let rehearsals = [];      // loadRehearsals()
let concerts = [];        // loadConcerts()
let setlists = [];        // loadSetlists()
let blackouts = [];       // loadBlackouts()
const currentUser = { id, email, firstName, role, ... };
```

### Data Layer Convention (js/db/*.js)
Each DB file exports a namespace object (e.g. `SongsDB`, `BandsDB`):
- `fetch(bandId)` → array
- `upsert(obj)` → saved object or `null` on error
- Field aliases: DB column names ↔ UI names mapped in fetch/upsert (e.g. `duration` ↔ `dur`, `lyrics_url` ↔ `lyrics`)
- Errors: `handleDbError(err)` (defined in auth.js) — shows toast, logs to console
- Upsert returns `null` silently on RLS failure; callers must check

### Async Pattern — CRITICAL
**Never `await` a reload inside a `try` block before closing a modal.** This freezes the UI. Instead:
```js
// ✅ Correct pattern
closeMod('someMod');
toast2('Saved!');
loadRehearsals().then(() => { renderRehearsals(); renderCal(); }).catch(() => {});

// ❌ Wrong — blocks the UI
await loadRehearsals();
closeMod('someMod');
```

### Rendering
Pure DOM mutation — no virtual DOM. Pattern:
1. Load data → update global array
2. Call `render*()` function → sets `element.innerHTML`
3. Re-render whole section on any change (no partial updates except targeted DOM tweaks)

`renderSL()` and `renderSheet()` must stay in sync — if a field is added to one, add to the other.

### Navigation
Single-page app via `nav(pageId)` — shows/hides `.pg-area` divs by ID (`pg-dashboard`, `pg-bandprofile`, etc.). Internal routing string is always `bandprofile` not `groupprofile`.

### Modal System
```js
showMod('modalId')   // sets display:flex
closeMod('modalId')  // sets display:none
closeMB(e, 'id')     // closes only if click is on backdrop (e.target === e.currentTarget)
```

## CSS System
- **All CSS** is in the `<style>` block inside `index.html`
- **Theme**: `html[data-theme="dark"]` / `html[data-theme="light"]`; defaults to OS preference
- **Key CSS variables** (defined in `:root`):
  - `--a` (#6C63FF purple — primary/brand colour)
  - `--a2` (purple tint background)
  - `--g` / `--g2` (green), `--r` / `--r2` (red), `--amb` / `--amb2` (amber)
  - `--ink` / `--ink2` / `--ink3` (text hierarchy)
  - `--bg` / `--bg2` / `--w` (background hierarchy)
  - `--bd` (border), `--rad` (10px radius), `--radl` (16px), `--sh` / `--shl` (shadows)
  - `--font` (system sans), `--mono` (monospace)
- **Key utility classes**: `.btn .btn-p .btn-g .btn-sm`, `.pill .pp .pg .pamb .pgray`, `.mod .mov`, `.fg .fr`, `.card`, `.ccrd`, `.svb`
- **`unsafe-inline`** is required for `<style>` — CSP already allows it

## Logo & Branding

### SVG source files
Stored in `logo/files/` (not deployed — not in `dist/`):
- `ritovo-logomark-{dark,light}.svg` — 120×120 square icon (bar + serif "r" + dot)
- `ritovo-wordmark-{dark,light}.svg` — 520×120 horizontal wordmark ("ritovo" + bar + dot)

### Inline SVG approach
Logos are embedded **directly in `index.html`** as inline `<svg>` elements:
- Background `<rect>` is **omitted** — no opaque background
- All fills/strokes use **`currentColor`** — inherit `color: var(--ink)` from their container
- This means dark/light switching is **automatic via CSS** — no JS, no duplicate image elements needed
- SVG font: `'Garamond','Georgia','Times New Roman',serif` at `font-weight:300`

### CSS classes & logo locations
| Class | Description | Used in |
|---|---|---|
| `.rit-mark` | Logomark SVG | Sidebar minimized, auth loading, app loader |
| `.rit-word` | Wordmark SVG | Sidebar expanded, auth header |
| `.sb-logo-mark` | Hidden when sidebar is **expanded** (`.sb:not(.minimized)`) | Sidebar |
| `.sb-logo-word` + `.sb-logo-text` | Hidden when sidebar is **minimized** | Sidebar |
| `.al-logo` | App loader logo — 198×198px, animated | `#appLoader` |
| `@keyframes rit-pulse` | Opacity breathing: 0.9 → 0.35 → 0.9 over 2.4s | Auth loading, app loader |

### Current logo sizes
| Location | Element | Size |
|---|---|---|
| Auth screen header | Wordmark | `width="100%"` — fills container, responsive |
| Auth loading state | Logomark | 40×40, pulse animation |
| App loader (`#appLoader`) | Logomark | 198×198 (CSS), pulse animation |
| Sidebar expanded | Wordmark | 147×34 |
| Sidebar minimized | Logomark | 29×29 |

### Auth screen sizing approach
The auth wordmark uses `width="100%"` with a **trimmed viewBox `"38 0 482 120"`** — this crops the
38px of empty space before the bar, so the bar appears flush with the container's left edge without
any `margin-left` offset. The logo scales to fill the full card width on any screen size (~94px tall
on a 380px card). The dot (cx=468 in original coords → cx=430 in trimmed coords) remains visible at
~339px from the left edge.

**Do not revert to fixed pixel dimensions for the auth wordmark** — `width="100%"` is intentional
and gives the best result across mobile and desktop.

### Removed
`.ld` class (purple animated circle placeholder) has been **deleted** from the CSS and all HTML.

## Naming Conventions — Three-layer split (do not collapse)

### Band → Group (UI only)
- **User-facing UI text**: "Group", "Music Group", "Group Profile", etc.
- **Internal code**: `band`, `bandId`, `BandsDB`, `band_members`, `activeBandId`, `band_id`, etc.
- **Reason**: mass-rename broke the app (JS file `bands.js` got renamed to `groups.js` in script tags)
- **Rule**: only change visible UI strings, never JS identifiers, CSS class names, DB columns, or file names

### Bandapp → Ritovo (UI + copy only)
- **User-facing text** says "Ritovo" everywhere (page title, invite emails, SMS messages, member lookup, bug reports, file downloads)
- The following **internal** `bandapp` identifiers must stay as-is — do NOT rename:
  - `localStorage` key `bandapp_sheetColOrder`
  - `console.error('[bandapp] ...')` log prefixes throughout index.html
  - `<option value="bandapp">` in the lyrics-repo `<select>` (data value, not label)
  - `_repoHints.bandapp` hint object key in JS

## i18n
- `t('English string')` → translated string for `currentUser.lang`
- Languages: `en` (default), `nl`, `de`, `fr`, `es`, `it`, `pt-BR`
- New UI strings **must** be added to all 6 locale files in `locales/`
- Translation keys are the exact English strings
- `data-i18n="key"` on HTML elements for `applyI18n()` to process

## Roles & Auth
- **Roles**: `admin`, `member`, `guest` (per band, stored in `band_members.role`)
- **Guest**: time-boxed (`guest_start`, `guest_end`); inactive guests excluded from notifications
- **RLS helper functions**: `is_band_admin(bid)`, `is_band_member(bid)` (SECURITY DEFINER in Supabase)
- **`currentUser.role`** is lowercase (`'admin'`); `getActiveBand()?.role` returns Title Case (`'Admin'`) — don't mix them
- Admins get delete/cancel/edit controls; regular members can add songs, edit availability
- Songs update/insert allowed for all members; delete is admin-only

## Supabase
- **Schema changes**: edit `schema.sql` + create a `supabase/*.sql` migration file + run manually in Dashboard
- **RLS changes**: edit `rls.sql` + run in Dashboard (idempotent — drops and recreates all policies)
- **Storage bucket**: `song-attachments` (public, 10MB limit) — must exist before lyrics/sheet-music upload works
- **Edge function secrets**: `APP_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `FROM_EMAIL`, `GITHUB_FEEDBACK_TOKEN`
- **Upsert pattern**: always use `{ onConflict: 'column' }` explicitly to avoid silent INSERT-only behaviour
- **Auth email templates**: managed via `supabase/config.toml` + `supabase/templates/*.html`. Push with `supabase config push --project-ref yhnoxgoibtbwcavzwddj`. The sender display name ("Ritovo") must be set manually in Supabase Dashboard → Authentication → SMTP Settings.
- **Allowed redirect URLs**: `supabase/config.toml` lists both slash and no-slash variants of the app URLs. `APP_URL` secret must NOT have a trailing slash (the edge function strips it, but keep it consistent).
- **Supabase JS v2 quirk**: `supabase.rpc(...).catch()` does NOT exist — the query builder is `PromiseLike` (has `.then()`) but not a full Promise. Use `.then(null, () => {})` to swallow errors from fire-and-forget RPCs.

## Pending SQL Migrations (not yet applied to live DB)
These files exist in `supabase/` but may not be in the live DB — verify before using the features:
- `lyrics_setup.sql` — adds `songs.lyrics_url`, `bands.lyrics_repo`, creates `song-attachments` bucket
- `sheet_music_setup.sql` — adds `songs.sheet_music_url`
- `calendar_changelog.sql` — adds `calendar_changelog` table + RLS
- `blackouts_member_rls.sql` — allows non-admin members to block their own days

## Invite Flow
- **Edge function**: `invite-member` uses `generateLink({ type: 'invite' })` (NOT `inviteUserByEmail`) to create the auth user + get the invite URL, then sends a branded email via Resend. This gives full control over email content.
- **Pre-check**: Before `generateLink`, the function calls the GoTrue REST API (`/auth/v1/admin/users?email=...`) to detect already-confirmed users. If confirmed, returns 409 `already_registered` — admin should use the "Already on Ritovo?" lookup flow instead.
- **Do NOT invite already-confirmed emails** via the new-user form — use the lookup flow to add existing Ritovo members directly to a band.
- **`needs_onboarding: true`** in `user_metadata` triggers `showOnboarding()` modal on first sign-in. After `updateUserById`, this flag is explicitly set (not just from `generateLink`) to handle re-invites of existing users.
- **PKCE timing fix**: `_initUrlParams` and `_initHash` are captured synchronously (module-level in `auth.js`) BEFORE the async `getSession()` call — Supabase JS clears `?code=` from the URL during `getSession()`, so reading the URL after the `await` would always miss it.
- **`#appLoader` z-index**: `z-index: 9999` — always hide it before calling `showOnboarding()` (which is `z-index: 500`).
- **`already_member` branch** in `onAuthStateChange`: sets `activeBandId = _pendingBandId` so the user lands in the invited band, not whichever band is first in their memberships.
- **`mark_invite_used` RPC** is fire-and-forget: `supabase.rpc('mark_invite_used', {...}).then(null, () => {})` — NOT `.catch()`.
- **`invited_band_id` in metadata** persists across sessions; `join_band_by_code` is called on every sign-in for users who have it set. This is intentional and safe.
- **`APP_URL` trailing slash**: `invite-member` strips it with `.replace(/\/$/, '')` before passing to `redirectTo`. The `config.toml` lists both slash/no-slash URL variants in `additional_redirect_urls`.

## Email System
- All transactional emails use `supabase/functions/_shared/email.ts` — `emailLayout()`, `btn()`, `h()`.
- The Ritovo logo in emails is **pure HTML/CSS** (vertical bar + serif "ritovo" + dot span) — NOT an `<img>` tag. Gmail blocks external images and doesn't render SVG via `<img>`.
- Supabase system emails (password reset, change, magic link, etc.) are managed via `supabase/config.toml` + HTML templates in `supabase/templates/`. Re-push with `supabase config push --project-ref yhnoxgoibtbwcavzwddj` after any template changes.
- **Sender display name** ("Ritovo") is set in Supabase Dashboard → Authentication → SMTP Settings — cannot be changed via `config.toml`.

## Key Gotchas & Constraints
1. **`js/db/bands.js` must keep that filename** — the build script hashes it; renaming = 404 = app breaks
2. **`await` before `closeMod()`** causes frozen modals on second use — always close modals before async reloads
3. **`_rehGen` / `_boGen` generation counters** in `loadRehearsals()` / `loadBlackouts()` — concurrent calls cancel each other; this is intentional
4. **Inline `<script>` + `unsafe-inline`** — required architecture; no workaround
5. **`loadSongs()` returns in parallel**: `SongsDB.fetch()` + `SongsDB.fetchNotes()` via `Promise.all`
6. **Notification filtering**: `notify-rehearsal` edge function filters out expired guests and `guest_status='removed'` guests
7. **`confirmCancel()` uses `finally {}`** to always close the modal regardless of success/failure
8. **No ORM, no migrations runner** — SQL must be pasted into Supabase Dashboard manually
9. **Locale files use `window.XX = {...}`** — valid browser JS, not Node modules
10. **WhatsApp "group"** in strings = WhatsApp feature, NOT the music group concept — never rename these
11. **`setSheetTblWidth()`** must call `outer.style.width = availW + 'px'` explicitly to prevent flex-column expansion overriding the scroll container
12. **`loadBands()` must be called** after any operation that changes the user's band memberships — it reconciles `activeBandId` (resets stale/deleted band IDs, picks first band if `activeBandId` is null).
13. **`supabase.rpc().catch()` doesn't exist** — use `.then(null, () => {})` for fire-and-forget RPCs.
14. **`MembersDB` method names**: `removeBandMember` (not `removeGroupMember`), `upsertBandMember`, `upsertProfile`, `fetchAll`.
15. **`#appLoader` covers everything** at `z-index: 9999` — hide it explicitly before showing any modal (`z-index: 500`) during early auth flow.
