/**
 * StreamingMessage — manages an incrementally-rendered assistant message.
 *
 * Creates an empty assistant bubble, updates its content as stream chunks
 * arrive, and finalizes it (adds action buttons) when the stream ends.
 * For non-streaming responses, provides a "transcode" mode that simulates
 * incremental rendering for a consistent UX.
 */

class StreamingMessage {
  constructor(container, { formatContent, scrollToBottom }) {
    this.container = container
    this.formatContent = formatContent
    this.scrollToBottom = scrollToBottom
    this.messageDiv = null
    this.bubbleDiv = null
    this.cursorSpan = null
    this.fullContent = ''
    this.finalized = false
    this.startTime = Date.now()
  }

  /** Create the empty assistant bubble in the DOM. */
  create() {
    this.messageDiv = document.createElement('div')
    this.messageDiv.className = 'message assistant streaming'

    this.bubbleDiv = document.createElement('div')
    this.bubbleDiv.className = 'message-bubble'

    this.cursorSpan = document.createElement('span')
    this.cursorSpan.className = 'streaming-cursor'
    this.cursorSpan.textContent = ''

    this.bubbleDiv.appendChild(this.cursorSpan)
    this.messageDiv.appendChild(this.bubbleDiv)
    this.container.appendChild(this.messageDiv)

    this.scrollToBottom()
    return this
  }

  /** Append a raw text chunk from the stream. */
  appendChunk(chunk) {
    if (this.finalized) return
    this.fullContent += chunk
    this._render()
  }

  /** Set the full content at once (for non-streaming or transcode mode). */
  setContent(fullContent) {
    if (this.finalized) return
    this.fullContent = fullContent || ''
    this._render()
  }

  /** Transcode mode: simulate streaming by revealing characters progressively. */
  async transcode(fullContent, { charsPerTick = 8, tickMs = 16 } = {}) {
    this.fullContent = fullContent || ''
    let revealed = 0

    return new Promise((resolve) => {
      const tick = () => {
        if (this.finalized) { resolve(); return }
        revealed = Math.min(revealed + charsPerTick, this.fullContent.length)
        this._renderPartial(revealed)
        this.scrollToBottom()

        if (revealed < this.fullContent.length) {
          requestAnimationFrame(tick)
        } else {
          this._render()
          resolve()
        }
      }
      requestAnimationFrame(tick)
    })
  }

  /** Render the full content with markdown formatting. */
  _render() {
    if (!this.bubbleDiv) return
    const html = this.formatContent(this.fullContent)
    this.bubbleDiv.innerHTML = html
    this._highlightCode()
  }

  /** Render partial content (for transcode mode) — plain text, no markdown. */
  _renderPartial(charCount) {
    if (!this.bubbleDiv) return
    const partial = this.fullContent.slice(0, charCount)
    // For partial rendering, escape HTML and show plain text with cursor
    this.bubbleDiv.innerHTML = this._escapeHtml(partial)
    this._highlightCode()
  }

  /** Finalize the message: remove streaming state, add action buttons. */
  finalize(content) {
    if (this.finalized) return
    this.finalized = true

    if (content !== undefined) {
      this.fullContent = content
    }

    this.messageDiv.classList.remove('streaming')

    // Final render with full markdown
    const html = this.formatContent(this.fullContent)
    const encoded = encodeURIComponent(this.fullContent)

    this.bubbleDiv.innerHTML = html
    this._highlightCode()

    // Add action buttons
    const actionsDiv = document.createElement('div')
    actionsDiv.className = 'msg-actions'
    actionsDiv.innerHTML = `
      <button class="copy-msg-btn" data-content="${encoded}" aria-label="Copy message">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        Copy
      </button>
      <button class="insert-btn" data-content="${encoded}" aria-label="Insert message at cursor in page">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        Insert at Cursor
      </button>
      <button class="regenerate-btn" title="Regenerate response" aria-label="Regenerate response">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
        Regenerate
      </button>
      <button class="save-agent-btn" title="Save as Agent" aria-label="Save this response as an agent preset">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
        Save as Agent
      </button>
    `
    this.messageDiv.appendChild(actionsDiv)

    this.scrollToBottom()
    return this.fullContent
  }

  /** Abort: remove the message div entirely. */
  abort() {
    this.finalized = true
    this.messageDiv?.remove()
  }

  /** Apply syntax highlighting to code blocks within the bubble. */
  _highlightCode() {
    if (!this.bubbleDiv) return
    this.bubbleDiv.querySelectorAll('pre code').forEach(block => {
      if (window.hljs && !block.dataset.highlighted) {
        try { window.hljs.highlightElement(block) } catch {}
      }
    })
  }

  _escapeHtml(text) {
    const safe = text == null ? '' : String(text)
    const div = document.createElement('div')
    div.textContent = safe
    return div.innerHTML
  }
}

export { StreamingMessage }
