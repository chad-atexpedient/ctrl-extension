/**
 * Request optional network access for a user-supplied provider endpoint.
 * Known catalog hosts are required in the target manifest and do not prompt.
 */
const CATALOG_HOSTS = new Set([
  'api.openai.com',
  'api.anthropic.com',
  'api.z.ai',
  'api.meta.ai',
  'api.mistral.ai',
  'api.deepseek.com',
  'api.minimax.io',
  'generativelanguage.googleapis.com',
  'dashscope.aliyuncs.com',
  'openrouter.ai',
  'api.groq.com',
])

export async function requestProviderOriginPermission(baseURL) {
  const permissions = globalThis.chrome?.permissions
  if (!baseURL || !permissions?.request) return true

  let url
  try {
    url = new URL(baseURL)
  } catch {
    return true
  }

  if (!['https:', 'http:'].includes(url.protocol)) return false
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return true
  if (CATALOG_HOSTS.has(url.hostname)) return true

  return permissions.request({
    origins: [`${url.protocol}//${url.host}/*`],
  })
}
