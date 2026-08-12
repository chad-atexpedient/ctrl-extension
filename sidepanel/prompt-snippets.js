import { SnippetStore } from '../utils/snippet-store.js'

class PromptSnippets {
  constructor() {
    this.store = new SnippetStore()
    this.initialized = false
  }

  async init() {
    await this.store.load()
    this.initialized = true
  }

  /** Returns snippet suggestions matching the current input for autocomplete. */
  getSuggestions(query) {
    if (!this.initialized) return []
    const snippets = this.store.findByTrigger(query)
    return snippets.map(s => ({
      id: `snippet:${s.id}`,
      type: 'snippet',
      label: s.trigger,
      description: s.name,
      category: 'Snippets',
      icon: '📝',
      action: () => s.content,
    }))
  }

  /** Checks if the input starts with a snippet trigger and returns the expanded content. */
  expandTrigger(input) {
    if (!this.initialized || !input) return null
    const trimmed = input.trim()
    return this.store.resolveTrigger(trimmed)
  }
}

export { PromptSnippets }
