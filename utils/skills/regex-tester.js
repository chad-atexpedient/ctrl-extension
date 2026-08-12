/**
 * Regex Tester Skill
 * Test, build, explain, and validate regular expressions.
 */

const ID = 'regex-tester'

export default {
  id: ID,
  name: 'Regex Tester',
  description: 'Test, build, explain, and validate regular expressions. Find all matches in text with positions.',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'regex_test',
        description: 'Test a regex pattern against text and return all matches with positions.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regular expression pattern (without leading/trailing slashes)',
            },
            flags: {
              type: 'string',
              description: 'Regex flags: g (global), i (case-insensitive), m (multiline)',
              default: 'g',
            },
            test_string: {
              type: 'string',
              description: 'Text to search in',
            },
          },
          required: ['pattern', 'test_string'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'regex_build',
        description: 'Build a regex pattern from a natural language description.',
        parameters: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Natural language description of the pattern (e.g. "email address", "US phone number")',
            },
          },
          required: ['description'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'regex_replace',
        description: 'Find and replace using regex pattern.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regex pattern to find',
            },
            flags: {
              type: 'string',
              description: 'Regex flags',
              default: 'g',
            },
            replacement: {
              type: 'string',
              description: 'Replacement string (use $1, $2 for capture groups)',
            },
            text: {
              type: 'string',
              description: 'Text to perform replacement on',
            },
          },
          required: ['pattern', 'replacement', 'text'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'regex_split',
        description: 'Split text by a regex pattern.',
        parameters: {
          type: 'object',
          properties: {
            pattern: {
              type: 'string',
              description: 'Regex pattern to split on',
            },
            text: {
              type: 'string',
              description: 'Text to split',
            },
          },
          required: ['pattern', 'text'],
        },
      },
    },
  ],

  executeTool(toolName, args) {
    switch (toolName) {
      case 'regex_test': return this._test(args)
      case 'regex_build': return this._build(args)
      case 'regex_replace': return this._replace(args)
      case 'regex_split': return this._split(args)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  _test({ pattern, flags = 'g', test_string }) {
    try {
      const re = new RegExp(pattern, flags)
      const matches = []
      if (flags.includes('g')) {
        let m
        while ((m = re.exec(test_string)) !== null) {
          matches.push({
            match: m[0],
            index: m.index,
            groups: m.slice(1),
            named_groups: m.groups || {},
          })
          if (m[0].length === 0) re.lastIndex++
        }
      } else {
        const m = re.exec(test_string)
        if (m) matches.push({
          match: m[0],
          index: m.index,
          groups: m.slice(1),
          named_groups: m.groups || {},
        })
      }
      return {
        pattern,
        flags,
        is_valid: true,
        match_count: matches.length,
        matches: matches.slice(0, 50),
        type: 'success',
      }
    } catch (err) {
      return { pattern, is_valid: false, error: err.message, type: 'error' }
    }
  },

  _build({ description }) {
    const desc = description.toLowerCase()
    const patterns = {
      'email': { pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}', desc: 'Email address' },
      'url': { pattern: 'https?:\\/\\/[\\w\\-]+(\\.[\\w\\-]+)+[\\w\\-.,@?^=%&:/~+#]*', desc: 'URL (HTTP/HTTPS)' },
      'phone': { pattern: '\\+?1?[-.]?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}', desc: 'US phone number' },
      'ip': { pattern: '\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b', desc: 'IPv4 address' },
      'date iso': { pattern: '\\d{4}-\\d{2}-\\d{2}', desc: 'ISO date (YYYY-MM-DD)' },
      'date us': { pattern: '\\d{1,2}\\/\\d{1,2}\\/\\d{2,4}', desc: 'US date (MM/DD/YYYY)' },
      'hex color': { pattern: '#[0-9A-Fa-f]{3,6}\\b', desc: 'Hex color code' },
      'uuid': { pattern: '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', desc: 'UUID' },
      'zip': { pattern: '\\b\\d{5}(?:-\\d{4})?\\b', desc: 'US ZIP code' },
      'credit card': { pattern: '\\b(?:\\d{4}[- ]?){3}\\d{4}\\b', desc: 'Credit card number' },
      'html tag': { pattern: '<([a-z]+)[^>]*>([^<]+)<\\/\\1>', desc: 'HTML tag with content' },
      'password strong': { pattern: '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*]).{8,}', desc: 'Strong password (8+ chars, upper, lower, digit, special)' },
    }

    for (const [key, val] of Object.entries(patterns)) {
      if (desc.includes(key)) {
        return {
          description,
          suggested_pattern: val.pattern,
          flags: 'gi',
          explanation: val.desc,
          type: 'success',
        }
      }
    }

    return {
      description,
      suggested_pattern: null,
      message: 'No pattern found for this description. Try: email, url, phone, ip address, date, hex color, uuid, zip code, credit card, html tag, strong password',
      type: 'info',
    }
  },

  _replace({ pattern, flags = 'g', replacement, text }) {
    try {
      const re = new RegExp(pattern, flags)
      const result = text.replace(re, replacement)
      const matches = [...text.matchAll(new RegExp(pattern, flags.includes('g') ? flags : flags + 'g'))]
      return {
        original: text,
        result,
        replacement,
        match_count: matches.length,
        type: 'success',
      }
    } catch (err) {
      return { error: err.message, type: 'error' }
    }
  },

  _split({ pattern, text }) {
    try {
      const re = new RegExp(pattern, 'g')
      const parts = text.split(re).filter(Boolean)
      return {
        parts: parts.slice(0, 100),
        count: parts.length,
        type: 'success',
      }
    } catch (err) {
      return { error: err.message, type: 'error' }
    }
  },
}
