/**
 * JSON Manager Skill
 * Parse, validate, transform, diff, and prettify JSON data.
 */

const ID = 'json-manager'

export default {
  id: ID,
  name: 'JSON Manager',
  description: 'Parse, validate, format, diff, merge, and transform JSON data. Query JSON with path expressions.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'json_parse',
        description: 'Parse a JSON string and return structured data with validation.',
        parameters: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'JSON string to parse',
            },
            pretty: {
              type: 'boolean',
              description: 'Pretty print the output',
              default: true,
            },
          },
          required: ['json_string'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'json_validate',
        description: 'Validate JSON string and check for syntax errors.',
        parameters: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'JSON string to validate',
            },
          },
          required: ['json_string'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'json_query',
        description: 'Query a JSON object using a dot-path (e.g. data.users[0].name) or JSONPath expression.',
        parameters: {
          type: 'object',
          properties: {
            json_string: {
              type: 'string',
              description: 'JSON string to query',
            },
            path: {
              type: 'string',
              description: 'Dot-path or JSONPath query (e.g. $.data[0].name or data.users[0].name)',
            },
          },
          required: ['json_string', 'path'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'json_diff',
        description: 'Compare two JSON objects and return the differences.',
        parameters: {
          type: 'object',
          properties: {
            json_a: {
              type: 'string',
              description: 'First JSON string',
            },
            json_b: {
              type: 'string',
              description: 'Second JSON string',
            },
          },
          required: ['json_a', 'json_b'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'json_merge',
        description: 'Deep merge multiple JSON objects (last-wins for conflicts).',
        parameters: {
          type: 'object',
          properties: {
            json_list: {
              type: 'string',
              description: 'JSON array of JSON objects to merge',
            },
          },
          required: ['json_list'],
        },
      },
    },
  ],

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'json_parse': return this._parse(args)
      case 'json_validate': return this._validate(args)
      case 'json_query': return this._query(args)
      case 'json_diff': return this._diff(args)
      case 'json_merge': return this._merge(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  _safeParse(str) {
    try { return JSON.parse(str) } catch { return null }
  },

  _parse({ json_string, pretty = true }) {
    const data = this._safeParse(json_string)
    if (data === null) {
      return { error: 'Invalid JSON', type: 'error' }
    }
    return {
      data,
      formatted: JSON.stringify(data, null, pretty ? 2 : 0),
      type: typeof data,
      type: 'success',
    }
  },

  _validate({ json_string }) {
    const data = this._safeParse(json_string)
    if (data !== null) {
      const analyzed = this._analyze(data)
      return {
        valid: true,
        ...analyzed,
        type: 'success',
      }
    }
    try {
      JSON.parse(json_string)
    } catch (err) {
      const match = err.message.match(/position (\d+)/)
      const pos = match ? parseInt(match[1]) : null
      const snippet = pos !== null ? json_string.substring(Math.max(0, pos - 20), pos + 20) : null
      return {
        valid: false,
        error: err.message,
        position: pos,
        context: snippet,
        type: 'error',
      }
    }
  },

  _query({ json_string, path }) {
    const data = this._safeParse(json_string)
    if (data === null) return { error: 'Invalid JSON', type: 'error' }
    try {
      let result
      if (path.startsWith('$')) {
        result = this._jsonPath(data, path)
      } else {
        result = this._dotPath(data, path)
      }
      return {
        path,
        result,
        found: result !== undefined,
        type: 'success',
      }
    } catch (err) {
      return { error: `Query failed: ${err.message}`, type: 'error' }
    }
  },

  _dotPath(obj, path) {
    return path.split('.').reduce((o, k) => {
      const m = k.match(/^(\w+)\[(\d+)\]$/)
      if (m) return o ? o[m[1]][parseInt(m[2])] : undefined
      return o ? o[k] : undefined
    }, obj)
  },

  _jsonPath(obj, path) {
    // Simplified JSONPath: $.foo.bar, $[0], $.foo[0]
    const tokens = path.replace(/^\$\.?/, '').split(/\.|\[|\]/).filter(Boolean)
    let current = obj
    for (const t of tokens) {
      if (t.match(/^\d+$/)) { current = current[parseInt(t)]; continue }
      if (current && typeof current === 'object') current = current[t]
      else return undefined
    }
    return current
  },

  _diff({ json_a, json_b }) {
    const a = this._safeParse(json_a)
    const b = this._safeParse(json_b)
    if (a === null || b === null) return { error: 'Invalid JSON in one of the inputs', type: 'error' }
    const diffs = this._deepDiff(a, b)
    return {
      are_equal: diffs.length === 0,
      differences: diffs,
      count: diffs.length,
      type: 'success',
    }
  },

  _deepDiff(a, b, path = '') {
    const diffs = []
    if (typeof a !== typeof b) {
      diffs.push({ path: path || '(root)', type: 'type_mismatch', a: typeof a, b: typeof b })
      return diffs
    }
    if (a === null || b === null || typeof a !== 'object') {
      if (a !== b) diffs.push({ path: path || '(root)', type: 'value_changed', a, b })
      return diffs
    }
    const aIsArray = Array.isArray(a), bIsArray = Array.isArray(b)
    if (aIsArray !== bIsArray) {
      diffs.push({ path, type: 'array_vs_object' })
      return diffs
    }
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of keys) {
      if (!(k in a)) diffs.push({ path: `${path}.${k}`, type: 'added_in_b', value: b[k] })
      else if (!(k in b)) diffs.push({ path: `${path}.${k}`, type: 'removed_from_b', value: a[k] })
      else diffs.push(...this._deepDiff(a[k], b[k], `${path}.${k}`))
    }
    return diffs
  },

  _merge({ json_list }) {
    const objs = typeof json_list === 'string' ? JSON.parse(json_list) : json_list
    if (!Array.isArray(objs)) return { error: 'json_list must be an array', type: 'error' }
    const result = objs.reduce((acc, obj) => this._deepMerge(acc, obj), {})
    return {
      merged: JSON.stringify(result, null, 2),
      input_count: objs.length,
      type: 'success',
    }
  },

  _deepMerge(a, b) {
    const result = { ...a }
    for (const key in b) {
      if (Object.prototype.hasOwnProperty.call(b, key) &&
          !['__proto__', 'constructor', 'prototype'].includes(key)) {
        if (b[key] && typeof b[key] === 'object' && !Array.isArray(b[key]) && a[key] && typeof a[key] === 'object' && !Array.isArray(a[key])) {
          result[key] = this._deepMerge(a[key], b[key])
        } else {
          result[key] = b[key]
        }
      }
    }
    return result
  },

  _analyze(data) {
    const count = (obj) => {
      if (obj === null || typeof obj !== 'object') return 1
      if (Array.isArray(obj)) return obj.reduce((s, i) => s + count(i), 0)
      return Object.values(obj).reduce((s, v) => s + count(v), 0)
    }
    return {
      keys: Object.keys(data || {}).slice(0, 20),
      key_count: Object.keys(data || {}).length,
      estimated_values: count(data),
    }
  },
}
