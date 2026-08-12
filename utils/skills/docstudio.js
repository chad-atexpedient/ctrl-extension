/**
 * Docstudio Skill — Multi-page document with Print PDF export
 * Based on OWUI tool spec: takes JSON page specs or raw HTML, exports via print dialog.
 */

const ID = 'docstudio'

export default {
  id: ID,
  name: 'Docstudio',
  description: 'Build multi-page documents from JSON page specs. Exports via browser Print-to-PDF. Supports cover, section, and custom page types.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_document',
        description: 'Build a multi-page document from a JSON array of page specs and open print dialog for PDF export. Page types: cover (title page), section (heading + body), custom (raw HTML).',
        parameters: {
          type: 'object',
          properties: {
            pages: {
              type: 'string',
              description: 'JSON array of page specs: [{"type":"cover","title":"...","subtitle":"...","meta":"..."},{"type":"section","title":"...","body":"<p>HTML</p>"},{"type":"custom","html":"<section>...</section>"}]',
            },
            title: {
              type: 'string',
              description: 'Document title',
              default: 'Document',
            },
          },
          required: ['pages'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'render_html',
        description: 'Render raw document HTML with page-break control. Mark sections with data-export-capture="Name" for page break control in Print-PDF.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'HTML document or fragment',
            },
            title: {
              type: 'string',
              description: 'Document title',
              default: 'Document',
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_document': return this._renderDocument(args)
      case 'render_html': return this._renderHtml(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderDocument({ pages, title = 'Document' }) {
    try {
      let pageSpecs = typeof pages === 'string' ? JSON.parse(pages) : pages
      if (!Array.isArray(pageSpecs)) {
        return { error: 'pages must be a JSON array', type: 'error' }
      }

      const html = this._buildDocHtml(pageSpecs, title)
      return this._openPrintDialog(html, title)
    } catch (err) {
      return { error: `Docstudio failed: ${err.message}`, type: 'error' }
    }
  },

  async _renderHtml({ html_content, title = 'Document' }) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
@media print {
  @page { margin: 1in; size: letter; }
  section { page-break-after: always; }
  section[data-export-capture] { page-break-after: always; }
  section:last-child { page-break-after: avoid; }
}
body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;color:#000;max-width:7in;margin:0 auto;padding:1in}
h1{font-size:24pt;font-weight:bold;margin-bottom:0.3em}
h2{font-size:18pt;font-weight:bold;margin-top:1em;margin-bottom:0.2em}
h3{font-size:14pt;font-weight:bold;margin-top:0.8em}
p{margin:0 0 0.5em 0}
</style>
</head><body>${html_content}</body></html>`

    return this._openPrintDialog(fullHtml, title)
  },

  _buildDocHtml(pages, title) {
    const body = pages.map(p => {
      switch (p.type) {
        case 'cover':
          return `<div style="text-align:center;padding-top:3in;page-break-after:always">
<h1 style="font-size:36pt">${this._escapeHtml(p.title || title)}</h1>
${p.subtitle ? `<p style="font-size:16pt;color:#666;margin-top:0.5em">${this._escapeHtml(p.subtitle)}</p>` : ''}
${p.meta ? `<p style="font-size:12pt;color:#999;margin-top:2em">${this._escapeHtml(p.meta)}</p>` : ''}
</div>`
        case 'section':
          return `<section>
<h2>${this._escapeHtml(p.title || '')}</h2>
${p.body || ''}
</section>`
        case 'custom':
          return `<section data-export-capture="custom">${p.html || ''}</section>`
        default:
          return `<section>${p.html || p.title ? `<h2>${this._escapeHtml(p.title || '')}</h2>` : ''}${p.body || ''}</section>`
      }
    }).join('\n')

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
@media print {
  @page { margin: 0.75in; size: letter; }
  section { page-break-after: always; }
  section[data-export-capture] { page-break-after: always; }
  section:last-child { page-break-after: avoid; }
}
body{font-family:Georgia,serif;font-size:12pt;line-height:1.6;color:#000;max-width:7in;margin:0 auto;padding:0.5in}
h1{font-size:28pt;font-weight:bold;margin-bottom:0.3em}
h2{font-size:18pt;font-weight:bold;margin-top:1em;margin-bottom:0.2em}
h3{font-size:14pt;font-weight:bold}
p{margin:0 0 0.5em 0}
</style>
</head><body>${body}</body></html>`
  },

  async _openPrintDialog(html, title) {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:8.5in;height:11in;top:-9999px;left:-9999px;border:none'
    document.body.appendChild(iframe)
    const idoc = iframe.contentDocument || iframe.contentWindow.document
    idoc.open(); idoc.write(html); idoc.close()

    await new Promise(r => setTimeout(r, 500))

    iframe.contentWindow.focus()
    iframe.contentWindow.print()

    document.body.removeChild(iframe)
    return {
      message: `Print dialog opened for "${title}". Choose "Save as PDF" in your print dialog.`,
      title,
      page_count: html.split('<section').length - 1,
      type: 'success',
    }
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}
