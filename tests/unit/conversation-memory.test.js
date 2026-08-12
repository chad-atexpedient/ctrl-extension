/**
 * Unit tests for utils/conversation-memory.js
 *
 * Strategy: install a chrome.* stub before importing the module so its
 * top-level imports of storage.js resolve. Then test pure functions
 * (tokenize, hashTerm, vectorize, cosine) directly and integration
 * behavior (search, indexConversation, unindexConversation) end-to-end.
 */

import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

// Chrome mock must be installed before the module is loaded.
const { store } = installChromeMock()

// Use a URL-style import so ESM loader is happy on Windows.
const MOD = await import('../../utils/conversation-memory.js')
const cm = MOD.conversationMemory
const {
  tokenize,
  hashTerm,
  vectorize,
  cosine,
  search,
  indexConversation,
  unindexConversation,
  rebuildIndex,
  formatForPrompt,
  MIGRATION_FLAGS
} = cm

// Reset storage.js in-memory cache between tests so cross-test state is clean
const { storage } = await import('../../utils/storage.js')

describe('conversation-memory: pure helpers', () => {
  test('tokenize returns unigrams and bigrams, lowercased', () => {
    const tokens = tokenize('TypeScript and JavaScript are different')
    assert.ok(tokens.includes('typescript'))
    assert.ok(tokens.includes('javascript'))
    assert.ok(tokens.includes('typescript_and'))
    assert.ok(tokens.includes('and_javascript'))
  })

  test('tokenize strips code fences, urls, and short tokens', () => {
    const tokens = tokenize('See https://example.com/foo ```js\nconsole.log("a")``` a I')
    assert.ok(!tokens.some(t => t.includes('https')))
    assert.ok(!tokens.some(t => t.includes('console')))
    assert.equal(tokens.includes('a'), false) // too short
  })

  test('hashTerm returns deterministic 32-bit integer', () => {
    const a = hashTerm('typescript')
    const b = hashTerm('typescript')
    const c = hashTerm('javascript')
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.ok(a > 0 && a <= 0xffffffff)
    assert.equal(hashTerm(''), 0x811c9dc5) // FNV-1a offset basis
  })

  test('vectorize produces an L2-normalized sparse vector', () => {
    const v = vectorize(['foo', 'foo', 'bar'])
    let norm = 0
    for (const k of Object.keys(v)) norm += v[k] * v[k]
    assert.ok(Math.abs(Math.sqrt(norm) - 1) < 0.001, 'should be L2 normalized')
    const foo = v[hashTerm('foo')]
    const bar = v[hashTerm('bar')]
    assert.ok(foo > bar, 'foo should weight more than bar')
  })

  test('cosine of identical vectors is 1', () => {
    const v = vectorize(['alpha', 'beta'])
    v._size = Object.keys(v).length
    const u = vectorize(['alpha', 'beta'])
    u._size = Object.keys(u).length
    const sim = cosine(v, u)
    assert.ok(Math.abs(sim - 1) < 0.001)
  })

  test('cosine of orthogonal vectors is 0', () => {
    const v = vectorize(['alpha'])
    v._size = 1
    const u = vectorize(['beta'])
    u._size = 1
    assert.equal(cosine(v, u), 0)
  })

  test('cosine handles asymmetric vectors gracefully', () => {
    const v = vectorize(['alpha', 'beta'])
    v._size = 2
    const u = vectorize(['alpha', 'gamma', 'delta'])
    u._size = 3
    const sim = cosine(v, u)
    assert.ok(sim > 0 && sim < 1)
  })
})

describe('conversation-memory: integration', () => {
  beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k]
    if (storage?.cache?.clear) storage.cache.clear()
  })

  test('indexConversation + search ranks relevant docs first', async () => {
    await indexConversation('ts-discussion', [
      { role: 'user', content: 'TypeScript is great for large projects. It catches errors early.' },
      { role: 'assistant', content: 'Agreed, TypeScript static typing helps refactoring.' }
    ])
    await indexConversation('python-discussion', [
      { role: 'user', content: 'Python is great for data science and machine learning.' },
      { role: 'assistant', content: 'Python has rich libraries like numpy and pandas.' }
    ])
    await indexConversation('cooking', [
      { role: 'user', content: 'How do I make sourdough bread?' },
      { role: 'assistant', content: 'You need flour, water, salt, and a starter.' }
    ])

    const r1 = await search('static types refactoring')
    assert.ok(r1.length > 0, 'should return at least one match')
    assert.equal(r1[0].name, 'ts-discussion')

    // Cooking should rank lowest for an unrelated query
    const r2 = await search('pasta recipe for dinner', { k: 3 })
    const cookingHit = r2.find(r => r.name === 'cooking')
    assert.equal(cookingHit, undefined, 'cooking discussion should not match pasta query')

    const r3 = await search('data science libraries')
    assert.equal(r3[0].name, 'python-discussion')
    assert.ok(r3[0].score > 0.1, 'python-discussion should score highly')
  })

  test('search filters results below minScore', async () => {
    await indexConversation('typescript', [
      { role: 'user', content: 'TypeScript type system and generics.' },
      { role: 'assistant', content: 'Generics provide type-safe code reuse.' }
    ])
    const r = await search('zzzzz nonsense query zzz', { k: 5, minScore: 0.5 })
    assert.equal(r.length, 0)
  })

  test('unindexConversation removes docs from results', async () => {
    await indexConversation('ts', [{ role: 'user', content: 'TypeScript is great' }])
    await indexConversation('py', [{ role: 'user', content: 'Python is great' }])
    let r = await search('great')
    assert.equal(r.length, 2)
    await unindexConversation('ts')
    r = await search('great')
    assert.equal(r.length, 1)
    assert.equal(r[0].name, 'py')
  })

  test('rebuildIndex rebuilds the index from stored conversations', async () => {
    // Seed the underlying conversations storage directly
    store.conversations = {
      a: { history: [{ role: 'user', content: 'apple banana' }], timestamp: Date.now() },
      b: { history: [{ role: 'user', content: 'cherry date' }], timestamp: Date.now() }
    }
    await rebuildIndex()
    const idx = store.conversation_index
    assert.equal(Object.keys(idx).length, 2)
    assert.ok(idx.a || idx.b)
  })

  test('formatForPrompt returns "" for empty input', () => {
    assert.equal(formatForPrompt([]), '')
    assert.equal(formatForPrompt(null), '')
  })

  test('formatForPrompt produces readable markdown', () => {
    const out = formatForPrompt([
      { name: 'foo', score: 0.123, preview: 'preview text', snippet: 'snippet text' }
    ])
    assert.ok(out.includes('Memory 1'))
    assert.ok(out.includes('foo'))
    assert.ok(out.includes('0.123'))
    assert.ok(out.includes('snippet text'))
  })

  test('indexConversation with empty history removes the entry', async () => {
    await indexConversation('a', [{ role: 'user', content: 'real content' }])
    await indexConversation('a', [])
    const idx = store.conversation_index || {}
    assert.equal(idx.a, undefined)
  })

  test('MIGRATION_FLAGS is exported and stable', () => {
    assert.equal(typeof MIGRATION_FLAGS, 'string')
    assert.ok(MIGRATION_FLAGS.length > 0)
  })

  test('search returns up to k results', async () => {
    for (let i = 0; i < 5; i++) {
      await indexConversation(`c-${i}`, [{ role: 'user', content: `topic ${i}` }])
    }
    const r = await search('topic', { k: 2 })
    assert.ok(r.length <= 2)
  })
})