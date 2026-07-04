# Ritovo — App Store Connect Submission Package

Everything needed to fill out App Store Connect and submit the iOS build for review.

**Status note on URLs:** the privacy and support pages are live now at the working
Vercel URL below. `ritovo.net` is currently a parked domain (not yet pointed at
Vercel) — once DNS is switched, redeploy and update these two URLs in App Store
Connect (Settings → App Information) to the `ritovo.net` versions. No other
resubmission is needed for that swap; URL fields update instantly.

---

## 1. App Information

| Field | Value |
|---|---|
| **App name** | Ritovo |
| **Subtitle** (30 chars max) | Band scheduling, made easy |
| **Bundle ID** | com.ritovo.app |
| **SKU** | ritovo-ios-001 (or your preferred internal SKU) |
| **Primary category** | Music |
| **Secondary category** | Productivity |
| **Version** | 1.0 (build 1) |
| **Copyright** | © 2026 [your legal name or company name — fill in before submitting] |

## 2. Pricing & Availability

- Price: Free (unless you're adding in-app purchases / subscriptions — not wired up yet based on the codebase, so leave Free for this submission)
- Availability: All territories, or restrict as you prefer

## 3. Store Listing Copy

### Promotional text (170 chars max — editable anytime without a new review)
```
Run your band like a pro. Set lists, rehearsals, gigs, and availability — all in one place, synced with everyone in the group.
```

### Description (4000 chars max)
```
Ritovo is the easiest way for bands and music groups to stay organized — rehearsals, set lists, gigs, and everyone's availability, all in one shared app.

STOP CHASING GROUP CHATS
No more scrolling through messages to find out who's free Thursday or what songs are in the set. Everything your band needs lives in one place, visible to everyone in the group.

SET LISTS & SONG LIBRARY
Build your song library with keys, durations, and links. Drag songs into set lists for upcoming shows, reorder on the fly, and keep notes on arrangements right on each song.

REHEARSALS, MADE SIMPLE
Schedule rehearsals, attach a set list to work on, and see who's actually coming with built-in RSVPs. Add photos from rehearsal to keep a record of your progress.

CONCERTS & GIGS
Track venues, times, pay, and attendance for every show — past and upcoming — in one calendar.

GROUP AVAILABILITY AT A GLANCE
See the whole band's availability side by side for the month, so you can find a rehearsal slot without twenty back-and-forth messages.

BUILT FOR THE WHOLE GROUP
Invite your bandmates by email or share your group code. Admins manage membership and roles; everyone sees the same shared calendar, set list, and song library.

Whether you're a weekend cover band, a touring act, or a rehearsal-space regular, Ritovo keeps everyone on the same page.
```

### Keywords (100 chars max, comma-separated)
```
band,music,setlist,rehearsal,gig,scheduling,concert,musician,group,calendar,availability,song
```

## 4. URLs

| Field | Value (current) | Final (after ritovo.net DNS) |
|---|---|---|
| **Support URL** | `https://bandapp-six.vercel.app/support.html` | `https://ritovo.net/support.html` |
| **Marketing URL** (optional) | leave blank, or same as support | `https://ritovo.net` |
| **Privacy Policy URL** | `https://bandapp-six.vercel.app/privacy.html` | `https://ritovo.net/privacy.html` |

## 5. Age Rating Questionnaire

Answer **None** / **No** to every content category — the app has no user-generated
public content, no chat with strangers, no violence/sexual/gambling content. Expected
result: **4+**.

| Question | Answer |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Sexual Content or Nudity | None |
| Profanity or Crude Humor | None |
| Alcohol, Tobacco, or Drug Use | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes | None |
| Medical/Treatment Info | None |
| Gambling (simulated) | None |
| Unrestricted Web Access | No |
| Contests | No |
| Gambling (real money) | No |

## 6. App Privacy ("Nutrition Label") — Data Collection

Answer these in App Store Connect → App Privacy. Based on the actual data the app
stores (see `CLAUDE.md` / Supabase schema):

| Data type | Collected? | Linked to identity? | Used for tracking? | Purpose |
|---|---|---|---|---|
| Email Address | Yes | Yes | No | Account creation & sign-in |
| Name | Yes | Yes | No | App functionality (shown to bandmates) |
| Phone Number | Yes (optional field) | Yes | No | App functionality |
| Photos or Videos | Yes (optional uploads) | Yes | No | App functionality (avatars, band/rehearsal photos) |
| Other User Content | Yes (songs, set lists, notes) | Yes | No | App functionality — core feature |
| User ID | Yes | Yes | No | App functionality (account identification) |
| Precise/Coarse Location | No | — | — | — |
| Contacts | No | — | — | — |
| Browsing/Search History | No | — | — | — |
| Identifiers (advertising) | No | — | — | — |
| Usage Data / Analytics | No | — | — | — |

Declare **no data used for tracking** (no cross-app/cross-site tracking, no ad
networks, no analytics SDKs). All categories above should be marked **"Used for
App Functionality"** only.

## 7. Export Compliance

`ITSAppUsesNonExemptEncryption` is already set to `false` in Info.plist (the app
only uses standard HTTPS/TLS, no custom or exportable encryption). In App Store
Connect, answer:

- "Does your app use encryption?" → **Yes** (HTTPS only)
- "Does your app qualify for any of the exemptions?" → **Yes** (standard encryption exemption — HTTPS/TLS only, no proprietary crypto)

This should auto-resolve with no export compliance documentation required.

## 8. App Review Information

| Field | Value |
|---|---|
| **First name / Last name** | (your name) |
| **Phone number** | (your number) |
| **Email** | admin73opp@gmail.com |
| **Sign-in required?** | Yes |
| **Demo account — email** | `ritovo.demo@73opp.com` |
| **Demo account — password** | `RitovoDemo2026!` |

### Notes for the reviewer
```
The demo account is pre-loaded with a sample band ("Velvet Static") that already
has members, songs, a set list, rehearsals, and concerts — no setup is required
to explore the app's features. All names and data shown are fictional demo data.

To see the group-creation flow: sign out and create a new account (or view the
onboarding wizard reachable from Settings → "Create a new group").
```

## 9. Screenshots

Located in `appstore-assets/output/`, already sized to Apple's exact
requirements — ready to drag into App Store Connect:

| File | Size | For display size |
|---|---|---|
| `*_6.5in.png` | 1242 × 2688 px | iPhone 6.5" (11 Pro Max, XS Max) |
| `*_6.7in.png` | 1284 × 2778 px | iPhone 6.7" (14/15 Plus, 15/16 Pro Max) |

Order to upload (App Store Connect lets you reorder — first shown is what
appears in search results):

1. `02-dashboard` — Dashboard overview
2. `04-library` — Song Library
3. `03-setlists` — Set Lists
4. `06-calendar` — Group availability calendar
5. `05-rehearsals` — Rehearsals
6. `07-concerts` — Concerts/gigs
7. `08-members` — Members
8. `09-bandprofile` — Group Profile
9. `10-myprofile` — My Profile
10. `01-signin` — Sign-in screen

All screenshots use the fake demo band "Velvet Static" with fictional member
names (Alex Rivera, Jordan Kim, Morgan Reyes, etc.) — no real user data appears
in any screenshot.

**App previews (video, optional):** not generated — see `appstore-assets/README.md`
for how to record one from the demo account if you want to add one.

## 10. Known pre-submission follow-ups

- **Domain:** `ritovo.net` is parked at Hostinger, not yet pointed at Vercel.
  Point it at Vercel (or add as a custom domain in the Vercel project), then
  swap the Support/Marketing/Privacy URLs above before or after this first
  submission (URL-only changes don't need a new binary review).
- **Android identity:** `com.bandapp.app` is still the Android
  `applicationId`/`namespace` and the app name inside `android/` — the iOS
  side is fully on `com.ritovo.app` / "Ritovo" now, but Android was left
  untouched since this task was scoped to iOS. Rename before an Android/Play
  Store submission.
- **Associated domains:** `App.entitlements` still points Universal Links at
  `applinks:bandapp.app`, which is currently a parked, unrelated page — deep
  links won't resolve until this points at the real production domain.
- **Screenshot content is a live production demo band** ("Velvet Static",
  seeded via `appstore-assets/seed-demo-band.sql`) — it will keep showing up
  in your production database indefinitely. Fine to leave (useful as a
  permanent reviewer/demo account), or delete later with a `DELETE FROM
  bands WHERE id = '11111111-1111-4111-8111-111111111111'` cascade cleanup
  if you'd rather not keep it.
