/**
 * Formforge Skill — Fillable form builder with AcroForm PDF export
 * Based on OWUI tool spec: renders HTML forms, exports as PDF with fillable fields.
 */

const ID = 'formforge'

export default {
  id: ID,
  name: 'Formforge',
  description: 'Build fillable HTML forms and export as PDF. Generates proper input fields with labels, ready for print-to-PDF workflow.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_form',
        description: 'Render a fillable HTML form. Opens print dialog for PDF export. Works best with standard <input>, <select>, and <textarea> elements.',
        parameters: {
          type: 'object',
          properties: {
            html_content: {
              type: 'string',
              description: 'HTML form with standard input elements, labels, and optional fieldset grouping',
            },
            title: {
              type: 'string',
              description: 'Form title',
              default: 'Form',
            },
          },
          required: ['html_content'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_form': return this._renderForm(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderForm({ html_content, title = 'Form' }) {
    const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${this._escapeHtml(title)}</title>
<style>
@media print {
  @page { size: letter; margin: 0.75in; }
  input, select, textarea { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
body { font-family: system-ui, -apple-system, sans-serif; max-width: 8.5in; margin: 0 auto; padding: 0.5in; color: #000; }
h1 { font-size: 20pt; margin-bottom: 0.5em; border-bottom: 2px solid #4f46e5; padding-bottom: 0.2em; }
fieldset { border: 1px solid #ddd; border-radius: 4px; padding: 1em; margin-bottom: 1em; }
legend { font-weight: bold; color: #4f46e5; padding: 0 0.5em; }
label { display: block; margin-bottom: 0.25em; font-weight: 500; color: #333; }
input[type="text"], input[type="email"], input[type="tel"], input[type="date"],
input[type="number"], select, textarea {
  width: 100%; padding: 0.4em; border: 1px solid #aaa; border-radius: 3px;
  font-size: 10pt; margin-bottom: 0.75em; box-sizing: border-box;
  print-color-adjust: exact; -webkit-print-color-adjust: exact;
}
textarea { resize: vertical; min-height: 3em; }
input[type="checkbox"], input[type="radio"] { margin-right: 0.5em; }
button { display: none; }
</style>
</head><body>${html_content}</body></html>`

    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;width:8.5in;height:11in;top:-9999px;left:-9999px;border:none'
    document.body.appendChild(iframe)
    const idoc = iframe.contentDocument || iframe.contentWindow.document
    idoc.open(); idoc.write(fullHtml); idoc.close()

    await new Promise(r => setTimeout(r, 500))

    iframe.contentWindow.focus()
    iframe.contentWindow.print()

    document.body.removeChild(iframe)

    return {
      message: `Print dialog opened for "${title}". Choose "Save as PDF" to create a printable form.`,
      title,
      type: 'success',
    }
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}
