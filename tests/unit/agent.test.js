/**
 * Unit tests for sidepanel/agent.js — the pure logic that previously had
 * zero coverage: parseJSONSafely (regex JSON extraction), validateSlides
 * (allowlisting), _normalizeSlideDeck (cap/clean), cleanHTML, getSandboxCsp,
 * and getModelConfig.
 *
 * The constructor touches document (cacheElements) and chrome.*, so install
 * both stubs before importing.
 */

import { describe, test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { installDomStub, uninstallDomStub } from './helpers/dom-stub.js'
import { installChromeMock, uninstallChromeMock } from './helpers/chrome-mock.js'

installChromeMock()

const MOD = await import('../../sidepanel/agent.js')
const { AgentHandler } = MOD

function makeHandler() {
  // Bypass the constructor (cacheElements/bindEvents touch the real DOM and
  // chrome APIs); the pure-logic methods under test don't need them.
  const handler = Object.create(AgentHandler.prototype)
  handler.chatUI = {}
  handler.slides = []
  return handler
}

describe('AgentHandler.parseJSONSafely', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('extracts a JSON array wrapped in markdown fences', () => {
    const out = handler.parseJSONSafely('```json\n[{"title": "A"}]\n```', 'slides')
    assert.deepEqual(out, [{ title: 'A' }])
  })

  test('extracts a bare JSON array', () => {
    const out = handler.parseJSONSafely('[{"title": "A"}, {"title": "B"}]', 'slides')
    assert.equal(out.length, 2)
  })

  test('extracts JSON array surrounded by prose', () => {
    const out = handler.parseJSONSafely('Here is the deck: [{"title": "A"}] hope that helps', 'slides')
    assert.deepEqual(out, [{ title: 'A' }])
  })

  test('throws when no JSON array can be found', () => {
    assert.throws(() => handler.parseJSONSafely('no json here', 'slides'))
  })

  test('returns empty array for empty arrays', () => {
    const out = handler.parseJSONSafely('[]', 'slides')
    assert.deepEqual(out, [])
  })
})

describe('AgentHandler.validateSlides', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('allowlists theme, visualStyle, layout; rejects unknown values', () => {
    const out = handler.validateSlides([
      { type: 'content', title: 'x', theme: 'corporate', visualStyle: 'gradient-dark', layout: 'content-left' },
      { type: 'content', title: 'y', theme: 'EVIL-THEME', visualStyle: 'broken', layout: 'bad-layout' }
    ])
    assert.equal(out[0].theme, 'corporate')
    assert.equal(out[1].theme, 'corporate', 'unknown theme falls back to default')
    assert.equal(out[1].visualStyle, 'gradient-dark')
    assert.equal(out[1].layout, 'content-left')
  })

  test('validates accentColor as hex only', () => {
    const out = handler.validateSlides([
      { type: 'content', title: 'x', accentColor: '#ff0000' },
      { type: 'content', title: 'y', accentColor: 'red" onmouseover="alert(1)' }
    ])
    assert.equal(out[0].accentColor, '#ff0000')
    assert.equal(out[1].accentColor, '#3b82f6', 'injection attempt falls back to default')
  })

  test('rejects slides without a title and non-array input', () => {
    assert.deepEqual(handler.validateSlides([{ type: 'content', content: 'no title' }]), [])
    assert.deepEqual(handler.validateSlides('not an array'), [])
    assert.deepEqual(handler.validateSlides([]), [])
  })

  test('rejects non-http imageUrl values', () => {
    const out = handler.validateSlides([
      { type: 'content', title: 'x', imageUrl: 'https://example.com/img.png' },
      { type: 'content', title: 'y', imageUrl: 'javascript:alert(1)' }
    ])
    assert.equal(out[0].imageUrl, 'https://example.com/img.png')
    assert.equal(out[1].imageUrl, '')
  })
})

describe('AgentHandler._normalizeSlideDeck', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('cleans and caps bullets per slide', () => {
    const deck = handler._normalizeSlideDeck([
      { title: 'Slide 1', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
      { title: 'Slide 2', bullets: 'single string' }
    ], 'topic')
    assert.equal(deck.slides[0].bullets.length, 6)
    assert.deepEqual(deck.slides[1].bullets, ['single string'])
  })

  test('drops malformed entries and caps deck at 12 slides', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ title: `S${i}`, bullets: [] }))
    const deck = handler._normalizeSlideDeck(many, 'topic')
    assert.equal(deck.slides.length, 12)
  })

  test('throws when nothing usable survives', () => {
    assert.throws(() => handler._normalizeSlideDeck([{ noTitle: true }], 'topic'))
  })

  test('uses first slide title as deck title', () => {
    const deck = handler._normalizeSlideDeck([{ title: 'My Deck', bullets: [] }], 'topic')
    assert.equal(deck.title, 'My Deck')
  })
})

describe('AgentHandler.getSandboxCsp', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('includes connect-src none to block exfiltration', () => {
    const csp = handler.getSandboxCsp()
    assert.match(csp, /connect-src 'none'/)
    assert.match(csp, /Content-Security-Policy/)
  })
})

describe('AgentHandler.cleanHTML', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('strips markdown code fences', () => {
    const out = handler.cleanHTML('```html\n<p>hi</p>\n```')
    assert.equal(out.trim(), '<p>hi</p>')
  })

  test('removes CDN script/link references', () => {
    const out = handler.cleanHTML('<script src="https://cdn.example.com/x.js"></script><p>ok</p>')
    assert.ok(!out.includes('cdn.example.com'))
    assert.ok(out.includes('<p>ok</p>'))
  })
})

describe('AgentHandler.getModelConfig', () => {
  let handler
  beforeEach(() => { installDomStub(); handler = makeHandler() })
  afterEach(() => { uninstallDomStub() })

  test('returns a config object with temperature and maxTokens', () => {
    const cfg = handler.getModelConfig('')
    assert.ok(cfg.temperature >= 0 && cfg.temperature <= 2)
    assert.ok(cfg.maxTokens > 0)
  })
})
