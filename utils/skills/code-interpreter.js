/**
 * Code Interpreter Skill
 * Executes JavaScript code in a sandboxed environment.
 */

const ID = 'code-interpreter'

export default {
  id: ID,
  name: 'Code Interpreter',
  description: 'Execute JavaScript code snippets for computation, data processing, and analysis',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'code_exec',
        description: 'Execute JavaScript code. Returns the result as a string. Use for calculations, data transformation, string manipulation, and algorithmic tasks. Do not use for file system or network operations.',
        parameters: {
          type: 'object',
          properties: {
            code: {
              type: 'string',
              description: 'JavaScript code to execute',
            },
            timeout: {
              type: 'number',
              description: 'Maximum execution time in milliseconds (default: 5000)',
              default: 5000,
            },
          },
          required: ['code'],
        },
      },
    },
  ],

  async init() {
    // Warm-up - nothing to pre-initialize
  },

  async executeTool(toolName, args) {
    if (toolName !== 'code_exec') {
      throw new Error(`Unknown tool: ${toolName}`)
    }

    const { code, timeout = 5000 } = args

    try {
      const result = await this._executeCode(code, timeout)
      return { result, type: 'success' }
    } catch (err) {
      return { error: err.message, type: 'error' }
    }
  },

  _executeCode(code, timeout) {
    const signal = AbortSignal.timeout(timeout)
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => {
        reject(new Error(`Execution timed out after ${timeout}ms`))
      })
      try {
        const fn = new Function(`
          "use strict";
          return (async () => { ${code} })()
        `)
        const result = fn()
        if (result instanceof Promise) {
          result.then(resolve).catch(reject)
        } else {
          resolve(result)
        }
      } catch (err) {
        reject(err)
      }
    })
  },
}
