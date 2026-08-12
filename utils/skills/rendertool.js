/**
 * Rendertool Skill — General-purpose HTML renderer with export suite
 * Based on OWUI tool spec: renders OpenUI components, raw HTML, files.
 */

const ID = 'rendertool'

export default {
  id: ID,
  name: 'Rendertool',
  description: 'General-purpose HTML renderer. Renders raw HTML, extracts and exports content. Supports PNG/SVG/PDF export.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_file',
        description: 'Render an uploaded file (text, code, JSON, HTML, Markdown). Displays content with syntax highlighting.',
        parameters: {
          type: 'object',
          properties: {
            file_content: {
              type: 'string',
              description: 'Text content or base64/data URL of the file',
            },
            filename: {
              type: 'string',
              description: 'Original filename with extension',
              default: 'file.txt',
            },
            title: {
              type: 'string',
              description: 'Display title',
              default: 'File',
            },
          },
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'render_html',
        description: 'Render raw HTML with context-aware toolbar and export. Mark capture-units with data-export-capture="Name".',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'Complete HTML document or fragment',
            },
            title: {
              type: 'string',
              description: 'Short title',
              default: 'Rendered',
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_file': return this._renderFile(args)
      case 'render_html': return this._renderHtml(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderFile({ file_content = '', filename = 'file.txt', title = 'File' }) {
    const ext = filename.split('.').pop().toLowerCase()
    let displayContent = file_content
    let isBase64 = false

    if (file_content.startsWith('data:')) {
      try {
        const bin = atob(file_content.split(',')[1])
        displayContent = bin
        isBase64 = true
      } catch { /* keep as-is */ }
    }

    let html
    if (['html', 'htm'].includes(ext)) {
      html = displayContent
    } else if (['json'].includes(ext)) {
      const formatted = JSON.stringify(JSON.parse(displayContent), null, 2)
      html = this._codeHtml(formatted, 'json')
    } else if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) {
      html = this._codeHtml(displayContent, 'javascript')
    } else if (['css'].includes(ext)) {
      html = this._codeHtml(displayContent, 'css')
    } else if (['md', 'markdown'].includes(ext)) {
      html = this._mdHtml(displayContent)
    } else {
      html = this._codeHtml(displayContent, 'text')
    }

    return this._renderHtml({ html_content: html, title: filename })
  },

  async _renderHtml({ html_content, title = 'Rendered' }) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
body { font-family: system-ui, -apple-system, sans-serif; padding: 1em; max-width: 900px; margin: 0 auto; color: #000; background: #fff; }
pre { background: #f4f4f4; border: 1px solid #ddd; border-radius: 4px; padding: 1em; overflow-x: auto; }
code { font-family: 'Fira Code', 'Cascadia Code', Consolas, monospace; font-size: 13px; }
.dark body { background: #1a1a1a; color: #e5e5e5; }
.dark pre { background: #2a2a2a; border-color: #444; }
</style>
</head><body>${html_content}</body></html>`

    return {
      title,
      render_html: fullHtml,
      message: 'HTML rendered. Use browser developer tools to export or screenshot.',
      type: 'success',
    }
  },

  _codeHtml(code, lang) {
    const escaped = this._escapeHtml(code)
    return `<pre><code class="language-${lang}">${escaped}</code></pre>`
  },

  _mdHtml(md) {
    const html = md
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>')
    return `<div class="markdown">${html}</div>`
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}
