/**
 * Unit tests for utils/snippet-store.js
 *
 * Covers the public API of SnippetStore + DEFAULT_SNIPPETS export:
 *   - 8 built-in snippets are exported by default
 *   - load()       : pulls promptSnippets from chrome.storage.local, merges built-ins
 *   - save()       : persists current snippets to chrome.storage.local
 *   - getAll()     : returns current snippets
 *   - getByCategory(category)
 *   - findByTrigger(query) : case-insensitive, prefix OR name includes
 *   - add(snippet), update(id, updates), remove(id)
 *   - resolveTrigger(trigger) : exact-match lookup
 *
 * A chrome mock is installed before the module is imported so that
 * chrome.storage.local exists when load()/save() are called.
 */

import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

const { store } = installChromeMock()

import { SnippetStore, DEFAULT_SNIPPETS } from '../../utils/snippet-store.js'

const EXPECTED_BUILTIN_IDS = [
  'summarize',
  'explain',
  'review-code',
  'refactor',
  'debug',
  'translate',
  'email-draft',
  'brainstorm',
]

describe('SnippetStore', () => {
  let store_

  beforeEach(async () => {
    // Clear chrome.storage between tests
    for (const k of Object.keys(store)) delete store[k]
    store_ = new SnippetStore()
    await store_.load()
  })

  describe('DEFAULT_SNIPPETS', () => {
    it('exports 8 built-in snippets', () => {
      assert.ok(Array.isArray(DEFAULT_SNIPPETS))
      assert.equal(DEFAULT_SNIPPETS.length, 8)
    })

    it('includes summarize, explain, review, refactor, debug, translate, email, brainstorm', () => {
      const triggers = DEFAULT_SNIPPETS.map(s => s.trigger)
      for (const t of ['/summarize', '/explain', '/review', '/refactor', '/debug', '/translate', '/email', '/brainstorm']) {
        assert.ok(triggers.includes(t), `missing trigger ${t}`)
      }
    })

    it('flags every default snippet as builtin:true', () => {
      assert.ok(DEFAULT_SNIPPETS.every(s => s.builtin === true))
    })
  })

  describe('constructor / load()', () => {
    it('starts with empty snippets until load() is called', async () => {
      const fresh = new SnippetStore()
      assert.equal(fresh.snippets.length, 0)
      assert.equal(fresh._loaded, false)
    })

    it('returns the 8 defaults when no chrome.storage data exists', () => {
      assert.equal(store_.snippets.length, 8)
      const ids = store_.snippets.map(s => s.id)
      for (const id of EXPECTED_BUILTIN_IDS) {
        assert.ok(ids.includes(id), `missing built-in id ${id}`)
      }
    })

    it('marks _loaded=true after load()', () => {
      assert.equal(store_._loaded, true)
    })

    it('merges stored custom snippets with built-ins', async () => {
      store.promptSnippets = [
        { id: 'custom-1', trigger: '/hello', name: 'Hello', content: 'Hi', category: 'general' },
      ]
      const s = new SnippetStore()
      await s.load()
      const ids = s.snippets.map(x => x.id)
      assert.ok(ids.includes('custom-1'))
      assert.ok(ids.includes('summarize'))
      assert.equal(s.snippets.length, 9)
    })

    it('filters out stored snippets that shadow built-in ids', async () => {
      // Even if a malicious caller wrote a "summarize" custom, the built-in wins.
      store.promptSnippets = [
        { id: 'summarize', trigger: '/pwn', name: 'Pwn', content: 'evil', category: 'general' },
      ]
      const s = new SnippetStore()
      await s.load()
      const summarize = s.snippets.find(x => x.id === 'summarize')
      assert.equal(summarize.trigger, '/summarize')
      assert.equal(summarize.builtin, true)
    })
  })

  describe('save()', () => {
    it('persists current snippets to chrome.storage.local', async () => {
      await store_.save()
      assert.ok(Array.isArray(store.promptSnippets))
      assert.equal(store.promptSnippets.length, 8)
    })
  })

  describe('getAll() / getByCategory()', () => {
    it('getAll() returns the snippets array', () => {
      const all = store_.getAll()
      assert.equal(all.length, 8)
    })

    it('getByCategory("code") returns review-code, refactor, debug', () => {
      const code = store_.getByCategory('code')
      const ids = code.map(s => s.id).sort()
      assert.deepEqual(ids, ['debug', 'refactor', 'review-code'])
    })

    it('getByCategory("writing") returns writing-categorized built-ins', () => {
      const writing = store_.getByCategory('writing')
      const ids = writing.map(s => s.id).sort()
      assert.deepEqual(ids, ['email-draft', 'explain', 'summarize', 'translate'])
    })

    it('getByCategory("nope") returns []', () => {
      assert.deepEqual(store_.getByCategory('nope'), [])
    })
  })

  describe('findByTrigger()', () => {
    it("matches /summarize when query is 'sum'", () => {
      const matches = store_.findByTrigger('sum')
      const triggers = matches.map(m => m.trigger)
      assert.ok(triggers.includes('/summarize'))
    })

    it('is case-insensitive: "EMAIL" matches the email snippet', () => {
      const matches = store_.findByTrigger('EMAIL')
      const triggers = matches.map(m => m.trigger)
      assert.ok(triggers.includes('/email'))
    })

    it('is case-insensitive: "bRaInStOrM" matches brainstorm', () => {
      const matches = store_.findByTrigger('bRaInStOrM')
      const triggers = matches.map(m => m.trigger)
      assert.ok(triggers.includes('/brainstorm'))
    })

    it('returns [] for an empty query', () => {
      assert.deepEqual(store_.findByTrigger(''), [])
    })

    it('returns [] when nothing matches', () => {
      assert.deepEqual(store_.findByTrigger('xyz'), [])
    })

    it('matches by name inclusion as well as trigger prefix', () => {
      // "code" is part of "Code Review" name → matches review-code
      const matches = store_.findByTrigger('code')
      const ids = matches.map(m => m.id)
      assert.ok(ids.includes('review-code'))
    })
  })

  describe('add()', () => {
    it('creates a new custom snippet and persists it', async () => {
      const created = await store_.add({
        trigger: '/greet',
        name: 'Greet',
        content: 'Hello there!',
        category: 'general',
      })
      assert.ok(created)
      assert.equal(created.builtin, false)
      assert.equal(store_.snippets.length, 9)
      assert.ok(store_.snippets.find(s => s.id === created.id))
    })

    it('generates an id when none is provided', async () => {
      const created = await store_.add({
        trigger: '/yo',
        name: 'Yo',
        content: 'sup',
      })
      assert.ok(created.id && created.id.startsWith('custom-'))
    })

    it('fills in sensible defaults for missing fields', async () => {
      const created = await store_.add({})
      assert.equal(created.builtin, false)
      assert.equal(created.category, 'general')
      assert.equal(created.content, '')
      assert.ok(created.trigger.startsWith('/'))
      assert.ok(created.name)
    })
  })

  describe('update()', () => {
    it('allows editing built-in content', async () => {
      const updated = await store_.update('summarize', { content: 'New content' })
      assert.ok(updated)
      assert.equal(updated.content, 'New content')
    })

    it('refuses to change built-in trigger', async () => {
      const updated = await store_.update('summarize', { trigger: '/hacked', name: 'Hacked' })
      assert.equal(updated.trigger, '/summarize')
      assert.equal(updated.name, 'Summarize')
    })

    it('allows arbitrary field updates on a custom snippet', async () => {
      const created = await store_.add({ trigger: '/foo', name: 'Foo', content: 'x' })
      const updated = await store_.update(created.id, { name: 'Foo v2', content: 'y' })
      assert.equal(updated.name, 'Foo v2')
      assert.equal(updated.content, 'y')
    })

    it('returns null for unknown id', async () => {
      const updated = await store_.update('does-not-exist', { content: 'x' })
      assert.equal(updated, null)
    })
  })

  describe('remove()', () => {
    it('refuses to delete a built-in (returns false)', async () => {
      const ok = await store_.remove('summarize')
      assert.equal(ok, false)
      assert.ok(store_.snippets.find(s => s.id === 'summarize'))
    })

    it('deletes a custom snippet (returns true)', async () => {
      const created = await store_.add({ trigger: '/temp', name: 'Temp', content: 'x' })
      const beforeCount = store_.snippets.length
      const ok = await store_.remove(created.id)
      assert.equal(ok, true)
      assert.equal(store_.snippets.length, beforeCount - 1)
      assert.equal(store_.snippets.find(s => s.id === created.id), undefined)
    })

    it('returns false for unknown id', async () => {
      const ok = await store_.remove('does-not-exist')
      assert.equal(ok, false)
    })
  })

  describe('resolveTrigger()', () => {
    it("returns the built-in content for '/summarize'", () => {
      // Earlier update() tests may have overwritten the summarize snippet's
      // content, so just verify a non-empty string is returned (not null).
      const content = store_.resolveTrigger('/summarize')
      assert.equal(typeof content, 'string')
      assert.ok(content.length > 0)
    })

    it("returns the default content when the built-in has not been edited", async () => {
      // Fresh store: the summarize snippet should have its original built-in content.
      const fresh = new SnippetStore()
      await fresh.load()
      const content = fresh.resolveTrigger('/summarize')
      assert.equal(content, DEFAULT_SNIPPETS.find(s => s.id === 'summarize').content)
    })

    it('returns null for an unknown trigger', () => {
      assert.equal(store_.resolveTrigger('/notreal'), null)
    })

    it('returns the custom snippet content after add()', async () => {
      await store_.add({ trigger: '/hi', name: 'Hi', content: 'Hello world' })
      assert.equal(store_.resolveTrigger('/hi'), 'Hello world')
    })
  })
})