/**
 * Regression tests for utils/model-validator.js's buildPrefixPattern() generator
 * and MODEL_VALIDATION_RULES (Round 4 in issues.md).
 *
 * Bug history: validation regexes were hand-enumerated per vendor (e.g.
 * minimax required /^minimax-[0-9]+$/) and went stale as soon as a vendor
 * shipped a model whose ID didn't match last year's naming convention —
 * `gpt-4o` didn't match openai's old pattern, `claude-4.5-sonnet` didn't
 * match anthropic's, real minimax IDs like `minimax-m2.5-highspeed` never
 * matched at all. That silently made real, currently-selectable models
 * fail validation and become unselectable/unsaveable.
 *
 * This was previously checked only via an ad-hoc standalone script run once
 * during that session. This file formalizes that check as a permanent,
 * always-run regression test: every real model ID currently listed under
 * PROVIDERS[id].models in utils/storage.js must validate successfully
 * against its own provider's rule in model-validator.js.
 */

import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { installChromeMock } from './helpers/chrome-mock.js'

installChromeMock()

const { PROVIDERS } = await import('../../utils/storage.js')
const { validateModel, getModelValidationRules } = await import('../../utils/model-validator.js')

describe('model-validator: every real model ID validates against its own provider pattern', () => {
  const providerIds = Object.keys(PROVIDERS).filter(id => (PROVIDERS[id].models || []).length > 0)

  for (const providerId of providerIds) {
    const models = PROVIDERS[providerId].models

    test(`${providerId}: all ${models.length} catalog model IDs pass validation`, () => {
      const failures = []
      for (const model of models) {
        const result = validateModel(model.id, providerId)
        if (!result.isValid) {
          failures.push({ id: model.id, errors: result.errors.map(e => e.message) })
        }
      }
      assert.deepEqual(
        failures,
        [],
        `Expected all ${providerId} model IDs to validate; failing IDs: ${JSON.stringify(failures, null, 2)}`
      )
    })
  }
})

describe('model-validator: OpenAI o1-preview/o3-mini edge case (prefix immediately followed by hyphenated suffix)', () => {
  // These IDs don't have an alphanumeric char right after the bare prefix ("o1", "o3") —
  // the suffix starts straight with a hyphen ("-preview", "-mini"). A naive
  // "prefix + required-alphanumeric" pattern rejects these; buildPrefixPattern's
  // `[a-z0-9]*` (zero-or-more, not one-or-more) is what makes them pass.
  const cases = ['o1-preview', 'o1-mini', 'o3-preview', 'o3-mini']

  for (const id of cases) {
    test(`"${id}" is valid for openai`, () => {
      const result = validateModel(id, 'openai')
      assert.equal(result.isValid, true, `expected ${id} to be valid, got errors: ${JSON.stringify(result.errors)}`)
    })
  }

  test('bare "o1" and "o3" (no suffix at all) are also valid', () => {
    assert.equal(validateModel('o1', 'openai').isValid, true)
    assert.equal(validateModel('o3', 'openai').isValid, true)
  })

  test('gpt- prefixed IDs still require the standard prefix+suffix shape', () => {
    assert.equal(validateModel('gpt-4o', 'openai').isValid, true)
    assert.equal(validateModel('gpt-4o-mini', 'openai').isValid, true)
  })
})

describe('model-validator: buildPrefixPattern sanity — rejects unrelated / garbage IDs', () => {
  test('an anthropic-shaped ID is rejected under the openai provider', () => {
    const result = validateModel('claude-4.5-sonnet', 'openai')
    assert.equal(result.isValid, false)
  })

  test('a completely unrelated string is rejected', () => {
    const result = validateModel('not-a-real-model-xyz', 'anthropic')
    assert.equal(result.isValid, false)
  })

  test('empty string is rejected', () => {
    const result = validateModel('', 'openai')
    assert.equal(result.isValid, false)
  })
})

describe('model-validator: getModelValidationRules exposes per-provider rules', () => {
  test('openai rules include gpt-, o1, o3, chatgpt- style examples', () => {
    const rules = getModelValidationRules('openai')
    assert.ok(rules.pattern instanceof RegExp)
    assert.ok(rules.examples.includes('o1-preview'))
  })

  test('unknown provider falls back to the "custom" rule set', () => {
    const rules = getModelValidationRules('totally-unknown-provider')
    assert.equal(rules, getModelValidationRules('custom'))
  })
})
