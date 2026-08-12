/**
 * CLI Bridge Skill
 * Bridges to local CLI tools: Claude CLI, Codex CLI, OpenCode CLI
 * Uses stdin/stdout communication where available.
 */

const ID = 'cli-bridge'

const CLI_PATHS = {
  claude: [
    'C:\\Users\\maris\\.claude\\bin\\claude.cmd',
    'C:\\Users\\maris\\AppData\\Local\\Programs\\Claude\\bin\\claude.cmd',
    'claude',
  ],
  codex: [
    'C:\\Users\\maris\\codex\\bin\\codex.cmd',
    'C:\\Users\\maris\\AppData\\Local\\codex\\bin\\codex.cmd',
    'codex',
  ],
  opencode: [
    'C:\\Users\\maris\\opencode\\bin\\opencode.cmd',
    'C:\\Users\\maris\\.opencode\\bin\\opencode.cmd',
    'opencode',
  ],
}

export default {
  id: ID,
  name: 'CLI Bridge',
  description: 'Execute commands via local AI CLI tools (Claude, Codex, OpenCode)',
  version: '1.0.0',

  tools: [
    {
      type: 'function',
      function: {
        name: 'cli_check',
        description: 'Check which CLI tools are available (Claude, Codex, OpenCode)',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cli_exec',
        description: 'Execute a command via a local CLI tool and return its output. Available CLIs: claude, codex, opencode.',
        parameters: {
          type: 'object',
          properties: {
            cli: {
              type: 'string',
              description: 'Which CLI to use: claude, codex, or opencode',
              enum: ['claude', 'codex', 'opencode'],
            },
            prompt: {
              type: 'string',
              description: 'Prompt or command to send to the CLI',
            },
            args: {
              type: 'string',
              description: 'Additional CLI arguments as a single string',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
              default: 30000,
            },
          },
          required: ['cli', 'prompt'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cli_query',
        description: 'Send a query to a CLI tool in chat/Q&A mode and get a response. Best for questions and discussions.',
        parameters: {
          type: 'object',
          properties: {
            cli: {
              type: 'string',
              description: 'Which CLI to use: claude, codex, or opencode',
              enum: ['claude', 'codex', 'opencode'],
            },
            query: {
              type: 'string',
              description: 'Question or query to send to the CLI',
            },
            timeout: {
              type: 'number',
              description: 'Timeout in milliseconds (default: 30000)',
              default: 30000,
            },
          },
          required: ['cli', 'query'],
        },
      },
    },
  ],

  _availableCLIs: new Set(),
  _checked: false,

  async init() {
    await this._detectCLIs()
  },

  async _detectCLIs() {
    if (this._checked) return
    this._checked = true

    try {
      const { exec } = await import('child_process')
      const { promisify } = await import('util')
      const execAsync = promisify(exec)

      for (const [name, paths] of Object.entries(CLI_PATHS)) {
        for (const cmd of paths) {
          try {
            await execAsync(`${cmd} --version`, { timeout: 5000 })
            this._availableCLIs.add(name)
            console.debug(`[cli-bridge] Detected: ${name} at ${cmd}`)
            break
          } catch {
            // Try next path
          }
        }
      }
      console.debug(`[cli-bridge] Available CLIs:`, [...this._availableCLIs])
    } catch (err) {
      console.warn('[cli-bridge] CLI detection failed (child_process not available):', err.message)
    }
  },

  async executeTool(toolName, args) {
    switch (toolName) {
      case 'cli_check': return this._check()
      case 'cli_exec': return this._exec(args.cli, args.prompt, args.args, args.timeout)
      case 'cli_query': return this._query(args.cli, args.query, args.timeout)
      default: throw new Error(`Unknown tool: ${toolName}`)
    }
  },

  async _check() {
    await this._detectCLIs()
    return {
      available: [...this._availableCLIs],
      type: 'success',
    }
  },

  async _exec(cli, prompt, args, timeout = 30000) {
    if (!this._availableCLIs.has(cli)) {
      return { error: `${cli} CLI is not available on this system`, type: 'error', cli }
    }

    try {
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      const argv = (() => {
        const baseArgs = (args && typeof args === 'string') ? args.split(' ').filter(Boolean) : []
        switch (cli) {
          case 'claude':
            return ['claude', ...baseArgs, '--print', prompt]
          case 'codex':
            return ['codex', ...baseArgs, prompt]
          case 'opencode':
            return ['opencode', 'ask', prompt]
          default:
            return null
        }
      })()

      if (!argv) return { error: `Unknown CLI: ${cli}`, type: 'error' }

      const { stdout, stderr } = await execFileAsync(argv[0], argv.slice(1), { timeout, shell: false })
      return {
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: 0,
        cli,
        type: 'success',
      }
    } catch (err) {
      return {
        error: err.message,
        stdout: err.stdout?.trim(),
        stderr: err.stderr?.trim(),
        exitCode: err.code,
        cli,
        type: 'error',
      }
    }
  },

  async _query(cli, query, timeout = 30000) {
    if (!this._availableCLIs.has(cli)) {
      return { error: `${cli} CLI is not available on this system`, type: 'error', cli }
    }

    try {
      const { execFile } = await import('child_process')
      const { promisify } = await import('util')
      const execFileAsync = promisify(execFile)

      const argv = (() => {
        switch (cli) {
          case 'claude':
            return ['claude', '-p', query]
          case 'codex':
            return ['codex', 'ask', query]
          case 'opencode':
            return ['opencode', 'ask', query]
          default:
            return null
        }
      })()

      if (!argv) return { error: `Unknown CLI: ${cli}`, type: 'error' }

      const { stdout, stderr } = await execFileAsync(argv[0], argv.slice(1), { timeout, shell: false })
      return {
        response: stdout.trim(),
        cli,
        type: 'success',
      }
    } catch (err) {
      return {
        error: err.message,
        response: err.stdout?.trim(),
        stderr: err.stderr?.trim(),
        cli,
        type: 'error',
      }
    }
  },
}
