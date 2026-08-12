/**
 * Conversation memory for CTRL Extension — provides Maintains a TF-IDF-style
 * lexical index over all saved conversations so past discussion snippets can
 * be retrieved as additional RAG context for the current chat.
 *
 * The embeddings are produced by a deterministic pure-JS tokenizer +
 * hashed unigram/bigram vectors stored in chrome.storage.local. This avoids
 * any external dependency, model download, or network call.
 *
 * Storage keys:
 *   conversation_index   — { [conversationName]: { tf: {}, size, updatedAt } }
 *   conversation_corpus  — { df: { term: docCount }, N: number, updatedAt }
 */

import { storage } from './storage.js'

const INDEX_KEY = 'conversation_index'
const CORPUS_KEY = 'conversation_corpus'
const MIGRATION_FLAGS = 'ctrl_migration_flags'

/** Tokenize a piece of text into normalized terms (unigrams + bigrams). */
function tokenize (text) {
  if (!text) return []
  const tokens = String(text)
    .toLowerCase()
    // Split on non-alphanumeric while preserving code identifiers somewhat
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/[^\s)]+/g, ' ')
    .split(/[^a-z0-9_.]+/i)
    .filter(t => t && t.length > 1 && t.length < 40)

  const out = []
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i])
    if (i + 1 < tokens.length) out.push(`${tokens[i]}_${tokens[i + 1]}`)
  }
  return out
}

/** Hash a term into a 32-bit unsigned int (FNV-1a). */
function hashTerm (term) {
  let h = 0x811c9dc5
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Convert a list of tokens into a sparse TF vector keyed by hashed term id. */
function vectorize (tokens) {
  const vec = {}
  const seen = new Set()
  for (const tok of tokens) {
    const h = hashTerm(tok)
    seen.add(h)
    vec[h] = (vec[h] || 0) + 1
  }
  // L2 normalize the term-frequency so longer documents don't dominate.
  let norm = 0
  for (const k of Object.keys(vec)) norm += vec[k] * vec[k]
  norm = Math.sqrt(norm) || 1
  for (const k of Object.keys(vec)) vec[k] /= norm
  return vec
}

function cosine (a, b) {
  let dot = 0
  const shortest = a._size < b._size ? a : b
  const longest = a._size < b._size ? b : a
  for (const k of Object.keys(shortest)) {
    if (k === '_size') continue
    if (longest[k] !== undefined) dot += shortest[k] * longest[k]
  }
  return dot
}

/**
 * Build per-message text snippets and a single document TF vector for a
 * saved conversation's message history.
 */
function conversationToDocument (history) {
  if (!Array.isArray(history)) history = []
  const buf = []
  for (const msg of history) {
    if (!msg || typeof msg.content !== 'string') continue
    buf.push(`${msg.role || 'user'}: ${msg.content}`)
  }
  const tokens = tokenize(buf.join('\n'))
  const vec = vectorize(tokens)
  vec._size = tokens.length
  return { text: buf.join('\n'), vec, tokens }
}

/**
 * Rebuild the entire corpus index from scratch. Call on first install or
 * after a bulk import.
 */
async function rebuildIndex () {
  const conversations = await storage.getConversations()
  const index = {}
  const df = {}
  let N = 0
  for (const [name, data] of Object.entries(conversations)) {
    const doc = conversationToDocument(data.history)
    if (doc.tokens.length === 0) continue
    index[name] = {
      tf: doc.vec,
      size: doc.tokens.length,
      updatedAt: data.timestamp || Date.now(),
      preview: doc.text.slice(0, 200)
    }
    N++
    for (const h of Object.keys(doc.vec)) {
      if (h === '_size') continue
      df[h] = (df[h] || 0) + 1
    }
  }
  await setStorage([INDEX_KEY, CORPUS_KEY], {
    [INDEX_KEY]: index,
    [CORPUS_KEY]: { df, N, updatedAt: Date.now() }
  })
  return { indexed: N }
}

/**
 * Helper that wraps chrome.storage.local.set and treats any missing storage
 * as a no-op (for tests).
 */
function setStorage (keys, values) {
  try {
    if (chrome?.storage?.local?.set) {
      return new Promise((resolve) => {
        chrome.storage.local.set(values, () => resolve())
      })
    }
  } catch {}
  return Promise.resolve()
}

function getStorage (keys) {
  try {
    if (chrome?.storage?.local?.get) {
      return new Promise((resolve) => {
        chrome.storage.local.get(keys, (r) => resolve(r || {}))
      })
    }
  } catch {}
  return Promise.resolve({})
}

/**
 * Incrementally update the index for one conversation. Call after save.
 */
async function indexConversation (name, history) {
  const storeData = await getStorage([INDEX_KEY, CORPUS_KEY])
  const index = storeData[INDEX_KEY] || {}
  const corpus = storeData[CORPUS_KEY] || { df: {}, N: 0 }

  // Remove old doc frequencies for this conversation
  const oldEntry = index[name]
  if (oldEntry) {
    for (const h of Object.keys(oldEntry.tf || {})) {
      if (h === '_size') continue
      if (corpus.df[h] !== undefined) {
        corpus.df[h] = Math.max(0, corpus.df[h] - 1)
        if (corpus.df[h] === 0) delete corpus.df[h]
      }
    }
  }

  const doc = conversationToDocument(history)
  if (doc.tokens.length === 0) {
    delete index[name]
    if (oldEntry) corpus.N = Math.max(0, corpus.N - 1)
  } else {
    index[name] = {
      tf: doc.vec,
      size: doc.tokens.length,
      updatedAt: Date.now(),
      preview: doc.text.slice(0, 200)
    }
    if (!oldEntry) corpus.N += 1
    for (const h of Object.keys(doc.vec)) {
      if (h === '_size') continue
      corpus.df[h] = (corpus.df[h] || 0) + 1
    }
  }

  await setStorage([INDEX_KEY, CORPUS_KEY], {
    [INDEX_KEY]: index,
    [CORPUS_KEY]: { ...corpus, updatedAt: Date.now() }
  })
}

/**
 * Remove a conversation from the index.
 */
async function unindexConversation (name) {
  const storeData = await getStorage([INDEX_KEY, CORPUS_KEY])
  const index = storeData[INDEX_KEY] || {}
  const corpus = storeData[CORPUS_KEY] || { df: {}, N: 0 }
  const old = index[name]
  if (old) {
    for (const h of Object.keys(old.tf || {})) {
      if (h === '_size') continue
      if (corpus.df[h] !== undefined) {
        corpus.df[h] = Math.max(0, corpus.df[h] - 1)
        if (corpus.df[h] === 0) delete corpus.df[h]
      }
    }
    delete index[name]
    corpus.N = Math.max(0, corpus.N - 1)
    await setStorage([INDEX_KEY, CORPUS_KEY], {
      [INDEX_KEY]: index,
      [CORPUS_KEY]: { ...corpus, updatedAt: Date.now() }
    })
  }
}

/**
 * Compute a TF-IDF weighted query vector using corpus statistics.
 * @param {string} query
 * @param {object} corpus { df, N }
 * @returns {object} query vector
 */
function queryVector (query, corpus) {
  const tokens = tokenize(query)
  const tfVec = vectorize(tokens)
  const N = corpus?.N || 1
  const df = corpus?.df || {}
  const idfVec = {}
  for (const h of Object.keys(tfVec)) {
    if (h === '_size') continue
    const dfCount = df[h] || 0
    const idf = Math.log((N + 1) / (dfCount + 1)) + 1
    idfVec[h] = (tfVec[h] || 0) * idf
  }
  // Normalize
  let norm = 0
  for (const k of Object.keys(idfVec)) norm += idfVec[k] * idfVec[k]
  norm = Math.sqrt(norm) || 1
  for (const k of Object.keys(idfVec)) idfVec[k] /= norm
  idfVec._size = Object.keys(idfVec).length
  return idfVec
}

/**
 * Search past conversations for the most relevant snippets to a query.
 * @param {string} query - Current user message
 * @param {{k?:number, minScore?:number}} [opts]
 * @returns {Promise<Array<{name:string, score:number, preview:string, snippet:string}>>}
 */
async function search (query, opts = {}) {
  const k = opts.k ?? 3
  const minScore = opts.minScore ?? 0.01
  if (!query || !query.trim()) return []

  const index = (await getStorage(INDEX_KEY))[INDEX_KEY] || {}
  const corpus = (await getStorage(CORPUS_KEY))[CORPUS_KEY] || { df: {}, N: 0 }
  const qvec = queryVector(query, corpus)

  const results = []
  // Apply IDF weighting to each document TF so cosine is comparable to the query.
  for (const [name, entry] of Object.entries(index)) {
    const tf = entry.tf || {}
    const docVec = {}
    for (const h of Object.keys(tf)) {
      if (h === '_size') continue
      const dfCount = corpus.df[h] || 0
      const idf = Math.log((corpus.N + 1) / (dfCount + 1)) + 1
      docVec[h] = tf[h] * idf
    }
    let norm = 0
    for (const kk of Object.keys(docVec)) norm += docVec[kk] * docVec[kk]
    norm = Math.sqrt(norm) || 1
    for (const kk of Object.keys(docVec)) docVec[kk] /= norm
    docVec._size = Object.keys(docVec).length

    const score = cosine(qvec, docVec)
    if (score >= minScore) {
      const conversations = await storage.getConversations()
      const conv = conversations[name]
      const snippet = await pickBestSnippet(query, conv?.history || [])
      results.push({ name, score, preview: entry.preview || '', snippet })
    }
  }

  results.sort((a, b) => b.score - a.score)
  return results.slice(0, k)
}

/** Find the single message pair (user + assistant reply) most similar to the query. */
async function pickBestSnippet (query, history) {
  if (!Array.isArray(history) || history.length === 0) return ''
  const qVec = queryVector(query, { N: 1, df: {} })
  let best = null
  let bestScore = 0
  for (let i = 0; i < history.length - 1; i++) {
    const userMsg = history[i]
    const assistMsg = history[i + 1]
    if (userMsg.role !== 'user' || assistMsg.role !== 'assistant') continue
    const text = `user: ${userMsg.content}\nassistant: ${assistMsg.content}`
    const docVec = vectorize(tokenize(text))
    docVec._size = Object.keys(docVec).length
    const sc = cosine(qVec, docVec)
    if (sc > bestScore) { bestScore = sc; best = text }
  }
  return best || ''
}

/** Render memory results into a system message the AI can read. */
function formatForPrompt (results) {
  if (!results || results.length === 0) return ''
  const lines = results.map((r, i) =>
    `[Memory ${i + 1}] (from "${r.name}", score=${r.score.toFixed(3)})\n${r.snippet || r.preview}`
  )
  return `You may find these snippets from previous conversations useful:\n\n${lines.join('\n\n')}\n\nSkip mentioning them unless clearly relevant.`
}

export const conversationMemory = {
  rebuildIndex,
  indexConversation,
  unindexConversation,
  search,
  formatForPrompt,
  tokenize,
  hashTerm,
  vectorize,
  cosine,
  MIGRATION_FLAGS
}
