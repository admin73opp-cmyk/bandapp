/* i18n — translation helper.
 * Keys are English strings; values are the target-language equivalents.
 * Falls back to the key itself (English) when no translation exists.
 */

function t(key) {
  if (!key && key !== 0) return '';
  const lang = (typeof currentUser !== 'undefined' && currentUser.lang) || 'en';
  if (lang === 'nl' && window.NL) {
    const val = window.NL[key];
    if (val !== undefined) return val;
  }
  if (lang === 'fr' && window.FR) {
    const val = window.FR[key];
    if (val !== undefined) return val;
  }
  if (lang === 'es' && window.ES) {
    const val = window.ES[key];
    if (val !== undefined) return val;
  }
  if (lang === 'de' && window.DE) {
    const val = window.DE[key];
    if (val !== undefined) return val;
  }
  if (lang === 'it' && window.IT) {
    const val = window.IT[key];
    if (val !== undefined) return val;
  }
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
      // Container — try known child selectors in priority order, then fall back
      const sbLabel = el.querySelector(':scope > .sb-label');
      const label   = el.querySelector(':scope > label');
      const ct      = el.querySelector(':scope > .ct');
      const mpLbl   = el.querySelector(':scope > .mp-lbl');
      // First direct child element that has no sub-children and some text
      const firstLeaf = [...el.children].find(c => c.children.length === 0 && c.textContent.trim());
      if (sbLabel && sbLabel.children.length === 0) {
        sbLabel.textContent = t(key);
      } else if (label && label.children.length === 0) {
        label.textContent = t(key);
      } else if (ct && ct.children.length === 0) {
        ct.textContent = t(key);
      } else if (mpLbl && mpLbl.children.length === 0) {
        mpLbl.textContent = t(key);
      } else if (firstLeaf) {
        firstLeaf.textContent = t(key);
      } else {
        // Final fallback: replace last direct text node
        // (handles <div data-i18n="X"><span class="icon"></span>X</div>)
        for (let i = el.childNodes.length - 1; i >= 0; i--) {
          const node = el.childNodes[i];
          if (node.nodeType === 3 && node.textContent.trim()) {
            node.textContent = t(key);
            break;
          }
        }
      }
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
