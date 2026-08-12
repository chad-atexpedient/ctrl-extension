const DEFAULT_SNIPPETS = [
  {
    id: 'summarize',
    trigger: '/summarize',
    name: 'Summarize',
    content: 'Summarize the following text in 3-5 bullet points, focusing on the key takeaways:\n\n',
    category: 'writing',
    builtin: true,
  },
  {
    id: 'explain',
    trigger: '/explain',
    name: 'Explain Like I\'m 5',
    content: 'Explain the following concept in simple terms, as if teaching a beginner:\n\n',
    category: 'writing',
    builtin: true,
  },
  {
    id: 'review-code',
    trigger: '/review',
    name: 'Code Review',
    content: 'Review this code for bugs, performance issues, and best practices. Provide specific suggestions:\n\n',
    category: 'code',
    builtin: true,
  },
  {
    id: 'refactor',
    trigger: '/refactor',
    name: 'Refactor Code',
    content: 'Refactor this code to improve readability, performance, and maintainability. Explain each change:\n\n',
    category: 'code',
    builtin: true,
  },
  {
    id: 'debug',
    trigger: '/debug',
    name: 'Debug Help',
    content: 'Help me debug this issue. Analyze the error, identify the root cause, and suggest a fix:\n\n',
    category: 'code',
    builtin: true,
  },
  {
    id: 'translate',
    trigger: '/translate',
    name: 'Translate',
    content: 'Translate the following text to English. Preserve the original tone and meaning:\n\n',
    category: 'writing',
    builtin: true,
  },
  {
    id: 'email-draft',
    trigger: '/email',
    name: 'Draft Email',
    content: 'Draft a professional email with the following context. Keep it concise and clear:\n\nRecipient: \nSubject: \nKey points:\n',
    category: 'writing',
    builtin: true,
  },
  {
    id: 'brainstorm',
    trigger: '/brainstorm',
    name: 'Brainstorm',
    content: 'Brainstorm 5-7 creative ideas for the following. Include pros and cons for each:\n\n',
    category: 'general',
    builtin: true,
  },
]

class SnippetStore {
  constructor() {
    this.snippets = []
    this._loaded = false
  }

  async load() {
    try {
      const data = await chrome.storage.local.get('promptSnippets')
      const stored = data.promptSnippets || []
      const builtinById = new Map(DEFAULT_SNIPPETS.map(s => [s.id, s]))
      // Built-ins always win over anything in storage that shadows their id
      // (e.g. a corrupted export/import) — only genuinely custom entries from
      // storage get merged in alongside the full set of defaults.
      const custom = stored.filter(s => !builtinById.has(s.id))
      // Clone each default so per-instance edits (see update()) never mutate
      // the shared DEFAULT_SNIPPETS objects that other instances/tests read.
      this.snippets = [...DEFAULT_SNIPPETS.map(s => ({ ...s })), ...custom]
      this._loaded = true
    } catch (e) {
      this.snippets = DEFAULT_SNIPPETS.map(s => ({ ...s }))
      this._loaded = true
    }
    return this.snippets
  }

  async save() {
    try {
      // Persist the full current list, including built-ins (e.g. a session's
      // edited built-in content). This is safe: load() always re-derives
      // built-ins from DEFAULT_SNIPPETS and ignores any stored entry whose id
      // shadows one, so a stored built-in copy is inert on the next load —
      // edits to built-in content are intentionally session-only.
      await chrome.storage.local.set({ promptSnippets: this.snippets })
    } catch (e) {
      console.warn('Failed to save snippets:', e)
    }
  }

  getAll() {
    return this.snippets
  }

  getByCategory(category) {
    return this.snippets.filter(s => s.category === category)
  }

  findByTrigger(query) {
    if (!query) return []
    const lower = query.toLowerCase()
    return this.snippets.filter(s =>
      s.trigger.toLowerCase().startsWith(lower) ||
      s.name.toLowerCase().includes(lower)
    )
  }

  async add(snippet) {
    const id = snippet.id || `custom-${Date.now()}`
    const newSnippet = {
      id,
      trigger: snippet.trigger || `/${id}`,
      name: snippet.name || id,
      content: snippet.content || '',
      category: snippet.category || 'general',
      builtin: false,
    }
    this.snippets.push(newSnippet)
    await this.save()
    return newSnippet
  }

  async update(id, updates) {
    const idx = this.snippets.findIndex(s => s.id === id)
    if (idx === -1) return null
    if (this.snippets[idx].builtin) {
      // Allow editing content but not trigger/name of built-ins
      if (updates.content !== undefined) this.snippets[idx].content = updates.content
    } else {
      Object.assign(this.snippets[idx], updates)
    }
    await this.save()
    return this.snippets[idx]
  }

  async remove(id) {
    const idx = this.snippets.findIndex(s => s.id === id)
    if (idx === -1) return false
    if (this.snippets[idx].builtin) return false // Can't delete built-ins
    this.snippets.splice(idx, 1)
    await this.save()
    return true
  }

  resolveTrigger(trigger) {
    const snippet = this.snippets.find(s => s.trigger === trigger)
    return snippet ? snippet.content : null
  }
}

export { SnippetStore, DEFAULT_SNIPPETS }
