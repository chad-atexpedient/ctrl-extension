/**
 * HTML Sanitizer Utility
 * Prevents XSS attacks by escaping HTML special characters
 */

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} text - The text to escape
 * @returns {string} The escaped text safe for use in HTML
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text);
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
    '/': '&#x2F;'
  };

  return text.replace(/[&<>"'/]/g, char => map[char]);
}

/**
 * Safely sets text content on an element (preferred over innerHTML)
 * @param {HTMLElement} element - The element to set text on
 * @param {string} text - The text content
 */
export function safeSetText(element, text) {
  if (element && text !== undefined && text !== null) {
    element.textContent = String(text);
  }
}

// Tags whose entire contents are dangerous and must be dropped along with
// the tag itself (not just have the tag stripped, leaving inline content
// behind) — kept in sync with the DOMPurify FORBID_TAGS list below.
const FALLBACK_FORBIDDEN_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'];

/**
 * Best-effort regex sanitizer used only when DOMPurify isn't available (see
 * sanitizeHtml() below). Strips dangerous tags, event handler attributes,
 * and javascript:/vbscript:/non-image-data: URLs while leaving ordinary
 * markup untouched. This is intentionally conservative rather than
 * exhaustive — regex can't fully understand HTML parsing edge cases
 * (mXSS, malformed markup, encoding tricks) the way a real parser can.
 */
function fallbackSanitize(html) {
  let out = html;

  for (const tag of FALLBACK_FORBIDDEN_TAGS) {
    // Paired tags with their (potentially dangerous) content, e.g. <script>...</script>.
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi'), '');
    // Any remaining stray/self-closing/unclosed open or close tag of this name.
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }

  // Event handler attributes: onload="...", onload='...', onload=bare.
  out = out.replace(/\son\w+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son\w+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son\w+\s*=\s*[^\s>]+/gi, '');

  // javascript:/vbscript: URLs in URL-bearing attributes.
  out = out.replace(/(href|src|action|formaction)(\s*=\s*)"(?:javascript|vbscript):[^"]*"/gi, '$1$2"#"');
  out = out.replace(/(href|src|action|formaction)(\s*=\s*)'(?:javascript|vbscript):[^']*'/gi, "$1$2'#'");

  // data: URLs, except data:image/... which is how pasted/generated images
  // are commonly previewed inline.
  out = out.replace(/(href|src)(\s*=\s*)"data:(?!image\/)[^"]*"/gi, '$1$2"#"');
  out = out.replace(/(href|src)(\s*=\s*)'data:(?!image\/)[^']*'/gi, "$1$2'#'");

  return out;
}

/**
 * Sanitizes HTML content by removing script tags and dangerous attributes.
 *
 * In browser contexts (where DOMPurify is loaded globally as window.DOMPurify,
 * e.g. the sidepanel page) this delegates to DOMPurify's parser-based
 * sanitizer, which is robust against mXSS and entity-encoded protocol tricks.
 * Outside the browser (unit tests, non-DOM contexts) it falls back to
 * fallbackSanitize() above. Regex sanitization is NOT a substitute for
 * DOMPurify — never rely on the fallback for untrusted HTML in a DOM context;
 * it exists so this module has sane, testable behavior outside a browser.
 *
 * @param {string} html - The HTML to sanitize
 * @param {Object} [options] - Optional DOMPurify options (used only when DOMPurify is available)
 * @returns {string} The sanitized HTML
 */
export function sanitizeHtml(html, options = {}) {
  if (typeof html !== 'string') {
    return '';
  }

  const purify = typeof window !== 'undefined' ? window.DOMPurify : null;
  if (purify && typeof purify.sanitize === 'function') {
    return purify.sanitize(html, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'select', 'textarea'],
      FORBID_ATTR: ['style', 'srcdoc', 'ping', 'formaction', 'action', 'xlink:href'],
      ...options
    });
  }

  return fallbackSanitize(html);
}

/**
 * Creates a safe HTML element with escaped content
 * @param {string} tag - The HTML tag name
 * @param {Object} attributes - Optional attributes (values will be escaped)
 * @param {string} content - Optional text content (will be escaped)
 * @returns {HTMLElement} The created element
 */
const FORBID_ATTR_SET = new Set(['style', 'srcdoc', 'ping', 'formaction', 'action', 'xlink:href', 'data'])

export function createElementSafe(tag, attributes = {}, content = '') {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([key, value]) => {
    if (key.startsWith('on')) return
    if (FORBID_ATTR_SET.has(key.toLowerCase())) return
    if (value == null) return
    element.setAttribute(key, escapeHtml(String(value)))
  });

  if (content) {
    element.textContent = content
  }

  return element
}
