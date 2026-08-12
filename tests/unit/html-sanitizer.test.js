/**
 * Unit tests for utils/html-sanitizer.js
 *
 * Covers the four public functions:
 *   - escapeHtml(text)              : escapes &, <, >, ", ', /
 *   - safeSetText(el, text)         : sets textContent safely; no-op on
 *                                     nullish element or text
 *   - sanitizeHtml(html)            : strips <script>, on* handlers,
 *                                     javascript:/vbscript:/data: protocols
 *                                     (preserves data: for images)
 *   - createElementSafe(tag, attrs, content) : creates an element with
 *                                     safely-escaped attributes, skips
 *                                     on* handlers
 */

import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, uninstallDomStub } from './helpers/dom-stub.js'

import {
  escapeHtml,
  safeSetText,
  sanitizeHtml,
  createElementSafe,
} from '../../utils/html-sanitizer.js'

let origWarn

describe('html-sanitizer', () => {
  beforeEach(() => {
    installDomStub()
    // Silence the [HTML Sanitizer] warning emitted by createElementSafe
    // when it drops an on* attribute.
    origWarn = console.warn
    console.warn = () => {}
  })

  afterEach(() => {
    console.warn = origWarn
    uninstallDomStub()
  })

  describe('escapeHtml()', () => {
    it('escapes < and >', () => {
      assert.equal(escapeHtml('<script>'), '&lt;script&gt;')
    })

    it('escapes &', () => {
      assert.equal(escapeHtml('a & b'), 'a &amp; b')
    })

    it('escapes double quotes', () => {
      assert.equal(escapeHtml('"hi"'), '&quot;hi&quot;')
    })

    it("escapes single quotes", () => {
      assert.equal(escapeHtml("it's"), 'it&#039;s')
    })

    it('escapes forward slash', () => {
      assert.equal(escapeHtml('</close>'), '&lt;&#x2F;close&gt;')
    })

    it('escapes a complete attribute-context string', () => {
      const input = `<a href="x" onclick='alert(1)'>&`
      const out = escapeHtml(input)
      assert.ok(out.includes('&lt;a'))
      assert.ok(out.includes('&quot;x&quot;'))
      assert.ok(out.includes('&amp;'))
    })

    it('coerces numbers to strings', () => {
      assert.equal(escapeHtml(123), '123')
      assert.equal(escapeHtml(0), '0')
    })

    it('coerces null to the string "null"', () => {
      assert.equal(escapeHtml(null), 'null')
    })

    it('coerces undefined to the string "undefined"', () => {
      assert.equal(escapeHtml(undefined), 'undefined')
    })

    it('returns an empty string for empty input', () => {
      assert.equal(escapeHtml(''), '')
    })
  })

  describe('safeSetText()', () => {
    it('sets textContent on a valid element', () => {
      const el = document.createElement('p')
      safeSetText(el, 'hello')
      assert.equal(el.textContent, 'hello')
    })

    it('is a no-op when the element is null', () => {
      assert.doesNotThrow(() => safeSetText(null, 'hello'))
    })

    it('is a no-op when the element is undefined', () => {
      assert.doesNotThrow(() => safeSetText(undefined, 'hello'))
    })

    it('is a no-op when the text is null', () => {
      const el = document.createElement('p')
      el.textContent = 'unchanged'
      safeSetText(el, null)
      assert.equal(el.textContent, 'unchanged')
    })

    it('is a no-op when the text is undefined', () => {
      const el = document.createElement('p')
      el.textContent = 'unchanged'
      safeSetText(el, undefined)
      assert.equal(el.textContent, 'unchanged')
    })

    it('coerces non-string text to string', () => {
      const el = document.createElement('p')
      safeSetText(el, 42)
      assert.equal(el.textContent, '42')
    })
  })

  describe('sanitizeHtml()', () => {
    it('strips <script>...</script> blocks entirely', () => {
      assert.equal(sanitizeHtml('<script>alert(1)</script>'), '')
    })

    it('strips <script> blocks but keeps surrounding markup', () => {
      assert.equal(
        sanitizeHtml('before<script>alert(1)</script>after'),
        'beforeafter'
      )
    })

    it('strips onload="..." attributes', () => {
      const out = sanitizeHtml('<img src="x" onload="alert(1)">')
      assert.ok(!out.includes('onload'), `expected no onload in: ${out}`)
      assert.ok(out.includes('src="x"'), 'src should remain')
    })

    it("strips onload='...' attributes", () => {
      const out = sanitizeHtml(`<img src="x" onload='alert(1)'>`)
      assert.ok(!out.includes('onload'))
    })

    it('strips unquoted on* attributes', () => {
      const out = sanitizeHtml('<img src="x" onerror=alert(1)>')
      assert.ok(!out.includes('onerror'), `expected no onerror in: ${out}`)
    })

    it('strips javascript: protocol', () => {
      const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
      assert.ok(!out.includes('javascript:'), `expected no javascript: in: ${out}`)
    })

    it('strips vbscript: protocol', () => {
      const out = sanitizeHtml('<a href="vbscript:msgbox(1)">x</a>')
      assert.ok(!out.includes('vbscript:'))
    })

    it('strips data: protocol for non-image uses', () => {
      const out = sanitizeHtml('<a href="data:text/html,<script>1</script>">x</a>')
      assert.ok(!out.includes('data:text/html'))
    })

    it('preserves data: URLs for images', () => {
      const out = sanitizeHtml('<img src="data:image/png;base64,iVBORw0KGgo=">')
      assert.ok(out.includes('data:image/png;base64'), `expected data: image preserved in: ${out}`)
    })

    it('returns "" for non-string input', () => {
      assert.equal(sanitizeHtml(null), '')
      assert.equal(sanitizeHtml(undefined), '')
      assert.equal(sanitizeHtml(123), '')
    })

    it('leaves safe markup untouched', () => {
      const safe = '<p class="lead">hello <strong>world</strong></p>'
      assert.equal(sanitizeHtml(safe), safe)
    })
  })

  describe('createElementSafe()', () => {
    it('creates an element of the requested tag', () => {
      const el = createElementSafe('a')
      assert.equal(el.tagName, 'A')
    })

    it('sets non-event attributes with escaped values', () => {
      const el = createElementSafe('a', { href: '/foo?a=1&b=2' }, 'link')
      assert.equal(el.getAttribute('href'), '&#x2F;foo?a=1&amp;b=2')
    })

    it('skips on* event handler attributes entirely', () => {
      const el = createElementSafe('a', {
        onclick: 'alert(1)',
        onmouseover: 'alert(2)',
        href: '/safe',
      }, 'link')
      assert.equal(el.getAttribute('onclick'), null)
      assert.equal(el.getAttribute('onmouseover'), null)
      assert.equal(el.getAttribute('href'), '&#x2F;safe')
    })

    it('sets the text content from the content argument (escaped)', () => {
      // .textContent is assigned directly (the correct, safe approach — it's
      // never parsed as markup), so reading it back gives the raw string,
      // same as real DOM. The "escaped" guarantee is about how it serializes
      // to HTML, so check .innerHTML instead of .textContent here.
      const el = createElementSafe('p', {}, '<script>')
      assert.equal(el.textContent, '<script>')
      assert.equal(el.innerHTML, '&lt;script&gt;')
    })

    it('handles missing attrs and content', () => {
      const el = createElementSafe('div')
      assert.equal(el.tagName, 'DIV')
      assert.equal(el.children.length, 0)
    })

    it('treats empty content as no content (does not set textContent)', () => {
      const el = createElementSafe('div', { id: 'x' }, '')
      assert.equal(el.getAttribute('id'), 'x')
      // No text was set, so children stays empty.
      assert.equal(el.children.length, 0)
    })
  })
})