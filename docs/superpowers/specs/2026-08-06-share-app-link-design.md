# Share-app-link design

**Date:** 2026-08-06
**Status:** Approved, not yet implemented

## Problem

Ritovo composes outgoing messages at seven code sites: four in the browser (one of
which, the member invitation, fans out to both WhatsApp and `mailto:`) and three
Supabase edge functions that send transactional email. Most carry no link back to
the app at all — `shareRehearsal`, `confReh` and `openInviteMessage` send pure
prose. A recipient who does not already have Ritovo has nothing to tap.

The two places that *do* emit a URL emit the wrong one:

- `confirmCancel` builds its link from `window.location.origin`. Inside the iOS
  Capacitor shell that origin is `capacitor://localhost`, so a cancellation sent
  from the native app shares a dead `capacitor://localhost/` link into WhatsApp.
- The three edge-function emails point at the bare `APP_URL`, which always lands
  on the web app — an iOS recipient without the app is never offered it.

## Goal

Every outgoing WhatsApp message and email carries one canonical link back to
Ritovo. That link opens the **web app** for everyone, **except** on iOS, where it
opens the native app if installed and the App Store listing if not.

## Non-goals

Explicitly out of scope, and not to be added opportunistically during
implementation:

- Analytics, click tracking, or any per-recipient link identity.
- Per-item deep links ("open *this* rehearsal"). The SPA has exactly one real
  route (`/rsvp?token=`); everything else rewrites to `index.html`. Item routing
  is separate work.
- Repairing Android App Links. `.well-known/assetlinks.json` currently declares
  `package_name: com.bandapp.app` while `capacitor.config.json` declares
  `com.ritovo.app`, and its SHA-256 is still `PLACEHOLDER_REPLACE_WITH_...`.
  App Links cannot verify in that state. Android therefore gets the web app,
  which is the specified behaviour, so this is recorded as a known defect rather
  than fixed here.
- Registering a custom iOS URL scheme. `ios/App/App/Info.plist` has no
  `CFBundleURLTypes`; universal links are the only native-open mechanism. See
  "Accepted limitation" below.

## Constraint discovered during design

Apple's lookup API returns `resultCount: 0` for bundle id `com.ritovo.app` in
both the BE and US storefronts, so Ritovo is not publicly on the App Store yet.
The App Store redirect is therefore built now but gated behind a single empty
constant, and falls through to the web app until that constant is set.

---

## Component 1 — the `/go` resolver

New file `go.html` at the repo root, served at `https://ritovo.net/go`.

### Why it is reachable

Three small changes, no new infrastructure:

1. **`vercel.json`** gains `{"source": "/go", "destination": "/go.html"}` as the
   **first** entry in `rewrites`. `/go` carries no file extension, so the existing
   catch-all `/((?!api/)(?!\.well-known/)(?!.*\.[a-zA-Z0-9]+$).*)` would otherwise
   rewrite it to `/index.html`. Vercel evaluates rewrites in order, so placing it
   first is what makes it win.
2. **`build.js`** — the standalone-page loop at line 128 grows from
   `['privacy.html', 'support.html']` to `['privacy.html', 'support.html', 'go.html']`.
   That loop exists for precisely this case.
3. **No AASA change.** `.well-known/apple-app-site-association` already claims
   `{"/": "/*"}` for `L2898ZW7WP.com.ritovo.app`, so `/go` is a universal link
   with no edit.

### Behaviour

On iOS **with the app installed**, the OS intercepts the tap and opens the native
app — `go.html` never loads. Only iOS-without-the-app and every non-iOS device
actually execute it.

```js
var IOS_STORE_URL = '';   // set to 'https://apps.apple.com/app/id<ID>' when the listing is live
var WEB_APP_URL   = '/';

function resolveTarget(ua, storeUrl) {
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);  // iPadOS 13+ desktop UA
  return (isIOS && storeUrl) ? storeUrl : WEB_APP_URL;
}

location.replace(resolveTarget(navigator.userAgent, IOS_STORE_URL));
```

Requirements on this file:

- `location.replace`, never `location.href` — the resolver must not enter history,
  or Back bounces the user straight out again.
- `<noscript><meta http-equiv="refresh" content="0;url=/"></noscript>` for JS-off.
- `resolveTarget` assigned to `window.resolveTarget` so it can be exercised
  directly with UA strings. This is the sole reason the logic is a named pure
  function rather than an inline conditional; it is what makes the branch table
  in "Verification" testable without an iPhone.

Every failure mode lands on the web app: store URL unset, JS disabled, or an
unrecognised user agent. Reaching the App Store requires iOS *and* a configured
URL.

The global CSP in `vercel.json` is `script-src 'self' 'unsafe-inline'`, so the
inline script needs no CSP edit.

### Accepted limitation

If an iOS user has previously tapped the "ritovo.net" breadcrumb in Safari to opt
out of universal links for the domain, they reach `/go` despite having the app
installed, and are sent to the App Store page. That page shows **OPEN** rather
than **GET** for an installed app, so the journey still completes — it costs one
extra tap. There is no way to detect this without a custom URL scheme, which is a
non-goal.

## Component 2 — the shared client helper

New file `js/share-link.js`, added to the `<script src="js/...">` block at
index.html:23-27. `build.js` walks `js/` recursively and content-hashes whatever
it finds, so this needs no build change.

```js
var RITOVO_URL    = 'https://ritovo.net';
var APP_SHARE_URL = RITOVO_URL + '/go';

function withAppLink(text) {
  if (!text) return APP_SHARE_URL;
  if (text.indexOf(APP_SHARE_URL) !== -1) return text;   // idempotent
  return text.replace(/\s+$/, '') + '\n\n' + APP_SHARE_URL;
}
```

Two decisions worth stating, because both look arbitrary and are not:

**The origin is a hardcoded constant, never `location.origin`.** In the native iOS
shell `location.origin` is `capacitor://localhost`; on a Vercel preview it is a
throwaway deploy URL. Neither is shareable. Hardcoding is what makes the shared
link correct in all three contexts, and it is what retires the
`confirmCancel` defect described under Problem.

**The link is a bare URL on its own line after a blank line, with no prose.** All
four client messages are hand-built English template literals that do not pass
through `t()`. Prose would create translation debt across the six locales in
`locales/`; a bare URL creates none. WhatsApp and mail clients auto-link it.

`withAppLink` is idempotent so that re-sending, or a future second call site,
cannot append the link twice.

## Component 3 — the four client call sites

| Site | Line | Change |
|---|---|---|
| `shareRehearsal` | index.html:6381 | wrap the message const in `withAppLink(...)` |
| `confReh` | index.html:9312 | wrap `d`; the link then rides into the `clipboard.writeText(d)` copy as well |
| `confirmCancel` | index.html:9474-9476 | delete the hand-rolled `window.location.origin` expression, build the message with `withAppLink` |
| `openInviteMessage` | index.html:7080 | insert `\n\n${APP_SHARE_URL}` **before** the `Cheers,` sign-off, not appended after it |

`openInviteMessage` is the exception to the append-at-end rule because its message
ends in a signature; a URL after "Cheers, <name>" reads as a stray fragment.

`sendInvitation` (index.html:7088) needs **no** edit. It sends whatever sits in the
`invMsgText` textarea, so writing the link into the composed text covers the
WhatsApp branch and the `mailto:` branch in one change — and the sender sees and
can edit the link before pressing send.

## Component 4 — the three edge-function emails

`invite-member` has no "Open in Ritovo" button; its only CTA is the functional
`joinUrl`. The shared footer is what reaches all three functions.

- **`supabase/functions/_shared/email.ts:59`** — footer `href` becomes
  `${base}/go`. Its visible label is currently the hardcoded string `ritovo.app`
  while `base` resolves to ritovo.net; derive the label instead, as
  `base.replace(/^https?:\/\//, '')`, so the two cannot drift again. The label
  shows the bare domain — it must **not** show the `/go` path.
- **`notify-rehearsal/index.ts:147`** and **`rsvp-remind/index.ts:164,268`** —
  `btn('Open in Ritovo', appUrl)` becomes `` btn('Open in Ritovo', `${appUrl}/go`) ``.
- **`notify-rehearsal/index.ts:149`** — the "if the button doesn't work" fallback
  line. Change the `href` to `${appUrl}/go` for consistency with the button
  directly above it, but leave the visible link text as the existing bare
  `appUrl.replace(/\/$/, '')`. Users read and retype that text; it should stay a
  clean domain.

**Left deliberately untouched:** `rsvpButtons`' three token links
(`_shared/email.ts:94`) and `invite-member`'s `${appUrl}/?band=${band_id}` join
URL. Both carry credentials in query parameters, and routing them through a
redirect hop risks stripping or leaking those parameters.

The `APP_URL` env var itself does not change; `/go` is appended at each call site.

## Verification

No completion claim before this runs and its real output is pasted.

1. `node build.js` exits 0, and `dist/go.html` exists.
2. `npx html-validate go.html` passes. (Note: html-validate output has truncated
   in this repo before — read the full report, do not trust a short tail.)
3. Serve `dist/` with the `ritovo-preview` launch config, load `/go`, and drive
   `window.resolveTarget` from the console against this table, once with
   `IOS_STORE_URL` empty and once with it set to a dummy store URL:

   | User agent | store URL empty | store URL set |
   |---|---|---|
   | iPhone Safari | `/` | store URL |
   | iPad (iPadOS 13+ desktop UA) | `/` | store URL |
   | Android Chrome | `/` | `/` |
   | macOS Safari | `/` | `/` |
   | Windows Chrome | `/` | `/` |

4. Confirm `/go` is not swallowed by the SPA rewrite — it must serve `go.html`,
   not `index.html`.
5. Confirm the `confirmCancel` body in `index.html` no longer derives a URL from
   `window.location.origin`, and that all four client messages contain the literal
   `https://ritovo.net/go`. Grepping the built `dist/index.html` for
   `capacitor://` proves nothing — that value only appears at runtime inside the
   native shell — so check the source expression, not the bundle.

## Files touched

```
go.html                                    new
js/share-link.js                           new
index.html                                 5 edits (1 script tag, 4 call sites)
vercel.json                                1 rewrite added, placed first
build.js                                   1 array entry
supabase/functions/_shared/email.ts        footer href + label
supabase/functions/notify-rehearsal/index.ts   2 links
supabase/functions/rsvp-remind/index.ts        2 links
```

## Follow-ups recorded, not done here

- Set `IOS_STORE_URL` in `go.html` the day the App Store listing goes live. That
  is the single switch that activates the iOS branch.
- Fix `.well-known/assetlinks.json`: `com.bandapp.app` → `com.ritovo.app`, and
  replace the placeholder SHA-256 with the real release-cert fingerprint.
