const { test } = require('node:test');
const assert   = require('node:assert');
const fs       = require('node:fs');
const path     = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

// These are structural assertions, not behavioural ones: the four call sites live
// inside one enormous inline <script> that cannot be imported. withAppLink's actual
// behaviour is covered by test/share-link.test.js; these guard the wiring.

test('share-link.js is loaded before the inline app code', () => {
  assert.match(html, /<script src="js\/share-link\.js"><\/script>/);
});

test('shareRehearsal wraps its message in withAppLink', () => {
  assert.match(html, /const a = withAppLink\(`🎵 Rehearsal:/);
});

test('confReh wraps its WhatsApp message in withAppLink', () => {
  assert.match(html, /: withAppLink\(`🎸 \$\{n\} confirmed!/);
});

test('the invite message carries the link above the sign-off', () => {
  assert.match(html, /on Ritovo\.\\n\\n\$\{APP_SHARE_URL\}\\n\\nCheers,/);
});

test('confirmCancel uses the shared constant, not location.origin', () => {
  assert.match(html, /\} = cancelTarget, o = APP_SHARE_URL;/);
  assert.doesNotMatch(html, /window\.location\.origin \+ "\/"/);
});
