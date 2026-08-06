// Canonical outbound link for every message Ritovo sends (WhatsApp + email).
//
// The origin is a hardcoded literal on purpose. Inside the iOS Capacitor shell
// location.origin is "capacitor://localhost", and on a Vercel preview it is a
// throwaway deploy hostname — neither is shareable with a recipient.
//
// /go is a static resolver page. On iOS with the app installed the OS intercepts
// the tap via the /* universal-link claim in .well-known/apple-app-site-association
// and the page never loads; everyone else lands on it and is routed from there.

var RITOVO_URL    = 'https://ritovo.net';
var APP_SHARE_URL = RITOVO_URL + '/go';

// Append the app link to a composed message. Idempotent, so re-sending or a
// future second call site cannot produce the link twice.
function withAppLink(text) {
  if (!text) return APP_SHARE_URL;
  if (text.indexOf(APP_SHARE_URL) !== -1) return text;
  return text.replace(/\s+$/, '') + '\n\n' + APP_SHARE_URL;
}
