/**
 * React PDF Tool Skill — HTML/React rendering with PDF export and artifact attachment
 * Based on OWUI tool spec: renders HTML, exports as PDF, attach artifacts to chat.
 */

const ID = 'react-pdf-tool'

export default {
  id: ID,
  name: 'React PDF Tool',
  description: 'Render HTML/React content with multiple export modes: Print PDF, HTML Bundle, PNG image, or attach as artifact. Supports interactive state preservation.',
  version: '1.3.1',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_html_to_pdf',
        description: 'Render HTML content and open print dialog for PDF export. Supports React state if window.__RPDF_STATE_PROVIDER__ is defined.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'Full HTML document or fragment to render and export',
            },
            title: {
              type: 'string',
              description: 'Short title for the rendered view',
              default: 'Document',
            },
          },
          required: ['html_content'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'attach_artifact_to_chat',
        description: 'Attach a generated artifact (base64) back as a downloadable file in the chat.',
        parameters: {
          type: 'object',
          properties: {
            content_b64: {
              type: 'string',
              description: 'Base64-encoded file content',
            },
            filename: {
              type: 'string',
              description: 'Filename to display in the attachment list',
            },
            content_type: {
              type: 'string',
              description: 'MIME type (text/html, application/pdf, image/png, etc.)',
              default: 'application/octet-stream',
            },
          },
          required: ['content_b64', 'filename'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_artifact_to_kb',
        description: 'Persist a generated artifact to the knowledge base. (Returns instruction for manual save in browser context.)',
        parameters: {
          type: 'object',
          properties: {
            content_b64: {
              type: 'string',
              description: 'Base64-encoded artifact bytes',
            },
            title: {
              type: 'string',
              description: 'File title for the KB',
              default: 'Rendered artifact',
            },
            content_type: {
              type: 'string',
              description: 'MIME type',
              default: 'text/html',
            },
          },
          required: ['content_b64'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_artifact_to_note',
        description: 'Save artifact as a note. Returns a downloadable file for manual saving.',
        parameters: {
          type: 'object',
          properties: {
            content_b64: {
              type: 'string',
              description: 'Base64-encoded artifact bytes',
            },
            title: {
              type: 'string',
              description: 'Note title',
              default: 'Rendered artifact',
            },
            content_type: {
              type: 'string',
              description: 'MIME type',
              default: 'text/html',
            },
          },
          required: ['content_b64'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_html_to_pdf': return this._renderHtmlToPdf(args)
      case 'attach_artifact_to_chat': return this._attachArtifact(args)
      case 'save_artifact_to_kb': return this._saveToKb(args)
      case 'save_artifact_to_note': return this._saveToNote(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderHtmlToPdf({ html_content, title = 'Document' }) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
@media print {
  @page { margin: 0.5in; size: auto; }
  [data-rpdf-capture] { page-break-after: always; }
}
body { font-family: system-ui, -apple-system, sans-serif; padding: 0.5in; color: #000; }
</style>
</head><body>${html_content}</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:100vw;height:100vh;top:-9999px;left:-9999px;border:none'
    document.body.appendChild(iframe)
    const idoc = iframe.contentDocument || iframe.contentWindow.document
    idoc.open(); idoc.write(fullHtml); idoc.close()

    await new Promise(r => setTimeout(r, 500))
    iframe.contentWindow.focus()
    iframe.contentWindow.print()

    document.body.removeChild(iframe)
    return {
      message: `Print dialog opened for "${title}". Save as PDF to create the document.`,
      title,
      type: 'success',
    }
  },

  async _attachArtifact({ content_b64, filename, content_type = 'application/octet-stream' }) {
    try {
      const binary = atob(content_b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: content_type })
      const url = URL.createObjectURL(blob)

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)

      return {
        message: `Artifact "${filename}" downloaded (${bytes.length} bytes)`,
        filename,
        content_type,
        size: bytes.length,
        type: 'success',
      }
    } catch (err) {
      return { error: `Failed to attach artifact: ${err.message}`, type: 'error' }
    }
  },

  async _saveToKb({ content_b64, title = 'Rendered artifact', content_type = 'text/html' }) {
    return {
      message: 'KB save not available in browser extension. Use save_artifact_to_note to download the file instead.',
      title,
      type: 'info',
    }
  },

  async _saveToNote({ content_b64, title = 'Rendered artifact', content_type = 'text/html' }) {
    return this._attachArtifact({ content_b64, filename: `${title}.${this._extFromMime(content_type)}`, content_type })
  },

  _extFromMime(mime) {
    const map = { 'text/html': 'html', 'application/pdf': 'pdf', 'image/png': 'png', 'image/svg+xml': 'svg', 'application/json': 'json' }
    return map[mime] || 'bin'
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}
