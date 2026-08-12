/**
 * Chartsmith Skill — Data visualization with SVG/PNG export
 * Based on OWUI tool spec: takes SVG chart HTML, exports as PNG/SVG.
 * Uses Chart.js from lib/chart.umd.js
 */

const ID = 'chartsmith'

export default {
  id: ID,
  name: 'Chartsmith',
  description: 'Create and render data charts (line, bar, pie, scatter) with PNG/SVG export. Supports CSV/JSON data input.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'render_chart',
        description: 'Render a data chart. Provide either CSV/JSON data to auto-generate, or an HTML string with an SVG chart element. Exports as PNG and SVG.',
        parameters: {
          type: 'object',
          properties: {
            data: {
              type: 'string',
              description: 'JSON array of data objects or CSV string. E.g. [{"label":"Jan","value":10},{"label":"Feb","value":20}] or CSV with headers.',
            },
            chart_type: {
              type: 'string',
              description: 'Type of chart to generate if data is provided',
              default: 'bar',
              enum: ['bar', 'line', 'pie', 'doughnut', 'scatter', 'radar'],
            },
            title: {
              type: 'string',
              description: 'Chart title',
              default: 'Chart',
            },
            html_content: {
              type: 'string',
              description: 'Alternatively, provide complete HTML with an <svg> chart element to render directly',
            },
            export_format: {
              type: 'string',
              description: 'Export format',
              default: 'png',
              enum: ['png', 'svg', 'both'],
            },
          },
          required: [],
        },
      },
    },
  ],

  async init() {
    // Load Chart.js if not already loaded
    if (!window.Chart && document.querySelector('script[src*="chart"]')) {
      // Already loaded via page
    }
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'render_chart': return this._renderChart(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _renderChart({ data, chart_type = 'bar', title = 'Chart', html_content, export_format = 'png' }) {
    try {
      let chartHtml

      if (html_content) {
        chartHtml = html_content
      } else if (data) {
        chartHtml = this._buildChartHtml(data, chart_type, title)
      } else {
        return { error: 'Either data or html_content must be provided', type: 'error' }
      }

      const result = { title, type: 'success' }

      if (export_format === 'png' || export_format === 'both') {
        result.png = await this._toPNG(chartHtml, title)
      }
      if (export_format === 'svg' || export_format === 'both') {
        result.svg = await this._toSVG(chartHtml)
      }

      return result
    } catch (err) {
      return { error: `Chart render failed: ${err.message}`, type: 'error' }
    }
  },

  _buildChartHtml(data, chartType, title) {
    let parsedData = data
    if (typeof data === 'string') {
      if (data.trim().startsWith('[') || data.trim().startsWith('{')) {
        parsedData = JSON.parse(data)
      } else {
        parsedData = this._parseCSV(data)
      }
    }

    const labels = parsedData.map(d => d.label || d.x || d.name || Object.values(d)[0])
    const values = parsedData.map(d => d.value !== undefined ? d.value : d.y !== undefined ? d.y : Object.values(d)[1])

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
body{font-family:system-ui;padding:24px;background:#fff}
canvas{max-width:800px;margin:0 auto}
</style>
</head><body>
<h2 style="text-align:center;margin-bottom:16px;font-family:system-ui">${this._escapeHtml(title)}</h2>
<div style="max-width:900px;margin:0 auto">
<canvas id="chart"></canvas>
</div>
<script src="lib/chart.umd.js"><\/script>
<script>
const ctx=document.getElementById('chart').getContext('2d');
new Chart(ctx,{
  type:'${chartType}',
  data:{
    labels:${JSON.stringify(labels)},
    datasets:[{
      label:'${this._escapeHtml(title)}',
      data:${JSON.stringify(values)},
      backgroundColor:${this._getColors(chartType, values.length)},
      borderColor:${this._getBorderColors(chartType)},
      borderWidth:1
    }]
  },
  options:{
    responsive:true,
    plugins:{legend:{display:true},title:{display:true,text:'${this._escapeHtml(title)}'}},
    scales:{y:{beginAtZero:true}}
  }
});
<\/script>
</body></html>`
  },

  _getColors(type, n) {
    const palette = ['#4f46e5','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6']
    if (type === 'pie' || type === 'doughnut') {
      return JSON.stringify(palette.slice(0, n))
    }
    return JSON.stringify(palette[0])
  },

  _getBorderColors(type) {
    if (type === 'line' || type === 'radar') return JSON.stringify('rgba(79,70,229,1)')
    return JSON.stringify('transparent')
  },

  _parseCSV(csv) {
    const lines = csv.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''))
    return lines.slice(1).map(line => {
      const vals = line.split(',').map(v => v.trim().replace(/"/g, ''))
      const obj = {}
      headers.forEach((h, i) => { obj[h] = vals[i] })
      return obj
    })
  },

  async _toPNG(html, title) {
    return new Promise((resolve, reject) => {
      const iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;width:900px;height:600px;top:-9999px;left:-9999px;border:none'
      document.body.appendChild(iframe)
      const idoc = iframe.contentDocument || iframe.contentWindow.document
      idoc.open(); idoc.write(html); idoc.close()

      iframe.contentWindow.onload = () => {
        setTimeout(async () => {
          try {
            const chartjs = iframe.contentWindow.Chart
            if (chartjs) {
              const canvas = iframe.contentDocument.querySelector('canvas')
              if (canvas) {
                resolve(canvas.toDataURL('image/png'))
                document.body.removeChild(iframe)
                return
              }
            }
            // Fallback: rasterize via canvas draw
            const body = iframe.contentDocument.body
            const canvas = document.createElement('canvas')
            canvas.width = 900; canvas.height = 500
            const ctx = canvas.getContext('2d')
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, 900, 500)
            // Simple text rendering as fallback
            ctx.font = '24px system-ui'
            ctx.fillStyle = '#000'
            ctx.fillText(title, 20, 40)
            resolve(canvas.toDataURL('image/png'))
            document.body.removeChild(iframe)
          } catch (err) {
            document.body.removeChild(iframe)
            reject(err)
          }
        }, 1000)
      }
    })
  },

  async _toSVG(html) {
    const m = /<svg[^>]*>[\s\S]*?<\/svg>/i.exec(html)
    if (m) {
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m[0])
    }
    return { error: 'No SVG found in content', type: 'error' }
  },

  _escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])
  },
}
