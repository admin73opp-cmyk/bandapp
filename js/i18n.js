/* i18n — translation helper.
 * Keys are English strings; values are the target-language equivalents.
 * Falls back to the key itself (English) when no translation exists.
 */

function t(key) {
  if (!key && key !== 0) return '';
  const lang = (typeof currentUser !== 'undefined' && currentUser.lang) || 'en';
  if (lang === 'pt' && window.PT_BR) {
    const val = window.PT_BR[key];
    if (val !== undefined) return val;
  }
  return key;
}

/* Apply data-i18n / data-i18n-placeholder / data-i18n-title attributes
 * across the entire document. Call once on load and again when lang changes.
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (el.children.length === 0) {
      // Leaf element — safe to replace text directly
      el.textContent = t(key);
    } else {
      // Container — translate the most appropriate child text node
      // (.sb-label for sidebar nav items, <label> for form groups)
      const sbLabel = el.querySelector(':scope > .sb-label');
      const label = el.querySelector(':scope > label');
      if (sbLabel && sbLabel.children.length === 0) {
        sbLabel.textContent = t(key);
      } else if (label && label.children.length === 0) {
        label.textContent = t(key);
      }
      // else skip — don't clobber complex containers
    }
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    const raw = t(key);
    if (raw !== key) el.innerHTML = raw;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });
  document.querySelectorAll('[data-i18n-label]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-label')));
  });
}
