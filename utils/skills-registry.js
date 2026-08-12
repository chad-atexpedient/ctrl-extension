/**
 * Skills Registry - Plugin system for CTRL Extension
 *
 * Skills are modules that contribute tools to the AI function-calling loop.
 * Tool priority: Native -> Skill -> MCP
 *
 * Each skill exports:
 *   - id: string
 *   - name: string
 *   - description: string
 *   - version: string
 *   - tools: ToolDefinition[]
 *   - init(): Promise<void>
 *   - executeTool(name, args): Promise<any>
 */

const REGISTERED_SKILLS = new Map()
const SKILL_TOOLS = new Map() // toolName -> skillId

export const SKILL_DEFINITIONS = {
  CODE_INTERPRETER: 'code-interpreter',
  FILE_TOOLS: 'file-tools',
  CLI_BRIDGE: 'cli-bridge',
  WEB_FETCH: 'web-fetch',
  CHART_SMITH: 'chartsmith',
  SLIDEFORGE: 'slideforge',
  DOCSTUDIO: 'docstudio',
  SCENEFORGE: 'sceneforge',
  PALETTEFORGE: 'paletteforge',
  SKETCHPAD: 'sketchpad',
  FORMFORGE: 'formforge',
  REACT_PDF_TOOL: 'react-pdf-tool',
  RENDERTOOL: 'rendertool',
  EXCEL_EDITOR: 'excel-editor',
  CSV_PROCESSOR: 'csv-processor',
  JSON_MANAGER: 'json-manager',
  REGEX_TESTER: 'regex-tester',
  DATA_CLEANER: 'data-cleaner',
  WEB_SCRAPER: 'web-scraper',
  BACKUP_MANAGER: 'backup-manager',
  GIT_AUTOMATION: 'git-automation',
}

const BUILT_IN_SKILLS = {
  [SKILL_DEFINITIONS.CODE_INTERPRETER]: () => import('./skills/code-interpreter.js'),
  [SKILL_DEFINITIONS.FILE_TOOLS]: () => import('./skills/file-tools.js'),
  [SKILL_DEFINITIONS.CLI_BRIDGE]: () => import('./skills/cli-bridge.js'),
  [SKILL_DEFINITIONS.WEB_FETCH]: () => import('./skills/web-fetch.js'),
  [SKILL_DEFINITIONS.CHART_SMITH]: () => import('./skills/chartsmith.js'),
  [SKILL_DEFINITIONS.SLIDEFORGE]: () => import('./skills/slideforge.js'),
  [SKILL_DEFINITIONS.DOCSTUDIO]: () => import('./skills/docstudio.js'),
  [SKILL_DEFINITIONS.SCENEFORGE]: () => import('./skills/sceneforge.js'),
  [SKILL_DEFINITIONS.PALETTEFORGE]: () => import('./skills/paletteforge.js'),
  [SKILL_DEFINITIONS.SKETCHPAD]: () => import('./skills/sketchpad.js'),
  [SKILL_DEFINITIONS.FORMFORGE]: () => import('./skills/formforge.js'),
  [SKILL_DEFINITIONS.REACT_PDF_TOOL]: () => import('./skills/react-pdf-tool.js'),
  [SKILL_DEFINITIONS.RENDERTOOL]: () => import('./skills/rendertool.js'),
  [SKILL_DEFINITIONS.EXCEL_EDITOR]: () => import('./skills/excel-editor.js'),
  [SKILL_DEFINITIONS.CSV_PROCESSOR]: () => import('./skills/csv-processor.js'),
  [SKILL_DEFINITIONS.JSON_MANAGER]: () => import('./skills/json-manager.js'),
  [SKILL_DEFINITIONS.REGEX_TESTER]: () => import('./skills/regex-tester.js'),
  [SKILL_DEFINITIONS.DATA_CLEANER]: () => import('./skills/data-cleaner.js'),
  [SKILL_DEFINITIONS.WEB_SCRAPER]: () => import('./skills/web-scraper.js'),
  [SKILL_DEFINITIONS.BACKUP_MANAGER]: () => import('./skills/backup-manager.js'),
  [SKILL_DEFINITIONS.GIT_AUTOMATION]: () => import('./skills/git-automation.js'),
}

function isNodeEnvironment() {
  return typeof process !== 'undefined' && process.versions?.node
}

export async function loadSkill(skillId) {
  if (REGISTERED_SKILLS.has(skillId)) {
    return REGISTERED_SKILLS.get(skillId)
  }

  const loader = BUILT_IN_SKILLS[skillId]
  if (!loader) {
    throw new Error(`Unknown skill: ${skillId}`)
  }

  const mod = await loader()
  const skill = mod.default || mod

  if (!skill.id || !skill.tools) {
    throw new Error(`Skill ${skillId} is missing id or tools`)
  }

  for (const tool of skill.tools) {
    SKILL_TOOLS.set(tool.function.name, skillId)
  }

  if (skill.init) {
    await skill.init()
  }

  REGISTERED_SKILLS.set(skillId, skill)
  console.debug(`[skills] Loaded skill: ${skill.name} v${skill.version} with ${skill.tools.length} tools`)
  return skill
}

export async function loadAllSkills(enabledSkillIds = Object.keys(BUILT_IN_SKILLS)) {
  const loaded = []
  for (const id of enabledSkillIds) {
    try {
      await loadSkill(id)
      loaded.push(id)
    } catch (err) {
      console.warn(`[skills] Failed to load skill ${id}:`, err.message)
    }
  }
  return loaded
}

export async function getAllSkillTools() {
  const tools = []
  for (const [skillId, skill] of REGISTERED_SKILLS) {
    for (const tool of skill.tools) {
      tools.push({
        ...tool,
        _skill: skillId,
      })
    }
  }
  return tools
}

export async function executeSkillTool(toolName, args) {
  const skillId = SKILL_TOOLS.get(toolName)
  if (!skillId) {
    throw new Error(`No skill registered for tool: ${toolName}`)
  }

  const skill = REGISTERED_SKILLS.get(skillId)
  if (!skill) {
    throw new Error(`Skill ${skillId} not loaded`)
  }

  return skill.executeTool(toolName, args)
}

export function isSkillTool(toolName) {
  return SKILL_TOOLS.has(toolName)
}

export function getLoadedSkills() {
  return Array.from(REGISTERED_SKILLS.values()).map(s => ({
    id: s.id,
    name: s.name,
    version: s.version,
    toolCount: s.tools.length,
  }))
}
