import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadB10(responses) {
  const source = fs.readFileSync(path.join(appRoot, 'src/api/b10.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const requests = []
  class MobileApiError extends Error {
    constructor(message, status = 0, details = null) { super(message); this.status = status; this.details = details }
  }
  const mobileApiClient = {
    async request(requestPath, options) {
      requests.push({ path: requestPath, options })
      const next = responses.shift()
      if (next instanceof Error) throw next
      if (next === undefined) throw new Error('No fixture response queued')
      return next
    },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      './unavailable': { unavailableOperation: async () => { throw new Error('unavailable fixture') } },
      './client': { mobileApiClient, MobileApiError },
      '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
      './b3': { listGrammarExercises: async () => [] },
      '../platform/client-id': { createClientId: () => 'fixture-client-event' },
    }
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  return { api: module.exports.b10LearningApi, requests }
}

const context = { uiLocale: 'zh-CN', contentLocale: 'en-US' }
const base = (overrides = {}) => ({
  mistakeId: 1,
  itemId: 2,
  questionId: 3,
  mistakeStatus: 'PENDING_RETRY',
  masteryStatus: 'NEW',
  errorCategory: 'GRAMMAR_RULE',
  reasonTrace: [{ code: 'RULE_RETRY', label: '服务端规则判定为待复习' }],
  ...overrides,
})

test('formal enum IDs pass through list and detail without changing values', async () => {
  const statuses = ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED']
  const masteries = ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED']
  const rows = statuses.map((mistakeStatus, index) => base({ mistakeId: 10 + index, itemId: 20 + index, mistakeStatus, masteryStatus: masteries[index % masteries.length] }))
  const page = loadB10([{ data: rows }])
  const result = await page.api.listMistakeBook(context)
  assert.equal(result.items.length, 5)
  assert.deepEqual(result.items.map((item) => item.mistakeStatus), statuses)
  assert.deepEqual(result.items.map((item) => item.masteryStatus), statuses.map((_, index) => masteries[index % masteries.length]))
  assert.equal(page.requests.length, 1)
  assert.match(page.requests[0].path, /\/mastery\/mistakes\?contentLocale=en-US/)

  const detail = loadB10([{ data: base({ mistakeId: 77, mistakeStatus: 'REOPENED', masteryStatus: 'CONSOLIDATED' }) }])
  const value = await detail.api.getMistakeDetail(context, 77)
  assert.equal(value.mistakeId, 77)
  assert.equal(value.mistakeStatus, 'REOPENED')
  assert.match(detail.requests[0].path, /\/mastery\/mistakes\/77$/)
  assert.equal(detail.requests[0].options.header['Accept-Language'], 'zh-CN')
})

test('a true empty list remains empty and does not throw', async () => {
  const page = loadB10([{ data: [] }])
  const result = await page.api.listMistakeBook(context)
  assert.deepEqual(result.items, [])
  assert.equal(result.attemptCount, 0)
})

test('string and non-integer mistake IDs reject instead of being coerced or dropped', async () => {
  for (const row of [base({ mistakeId: '1' }), base({ itemId: '2' }), base({ mistakeId: 1.5 }), base({ itemId: NaN }), base({ questionId: '3' }), base({ questionId: null })]) {
    const page = loadB10([{ data: [row] }])
    await assert.rejects(() => page.api.listMistakeBook(context), (error) => { assert.match(error.message, /接口契约/); return true })
  }
})

test('unknown top-level shapes reject; formal array and supported items/data envelopes stay empty', async () => {
  for (const response of [null, {}, { data: null }, { data: {} }, { items: {} }, { mistakes: 'not-an-array' }, { cards: [] }]) {
    const page = loadB10([response])
    await assert.rejects(() => page.api.listMistakeBook(context), (error) => { assert.match(error.message, /接口契约/); return true })
  }
  for (const response of [[], { data: [] }, { items: [] }, { mistakes: [] }, { data: { items: [] } }]) {
    const page = loadB10([response])
    const result = await page.api.listMistakeBook(context)
    assert.deepEqual(result.items, [])
  }
})

test('each required field rejects when missing', async () => {
  for (const field of ['mistakeId', 'itemId', 'mistakeStatus', 'masteryStatus', 'errorCategory']) {
    const row = base()
    delete row[field]
    const page = loadB10([{ data: [row] }])
    await assert.rejects(() => page.api.listMistakeBook(context), (error) => { assert.match(error.message, /接口契约/); return true })
  }
})

test('OPEN/REVIEW/unknown formal statuses reject instead of becoming PENDING_RETRY/NEW', async () => {
  const badRows = [
    base({ mistakeStatus: 'OPEN' }),
    base({ masteryStatus: 'REVIEW' }),
    base({ mistakeStatus: 'WHATEVER' }),
    base({ masteryStatus: 'UNKNOWN' }),
    base({ mistakeStatus: '' }),
    base({ mistakeStatus: ' PENDING_RETRY ' }),
  ]
  for (const row of badRows) {
    const page = loadB10([{ data: [row] }])
    await assert.rejects(() => page.api.listMistakeBook(context), (error) => {
      assert.match(error.message, /接口契约/)
      assert.doesNotMatch(error.message, /OPEN|REVIEW|WHATEVER|UNKNOWN/)
      return true
    })
  }
})

test('one malformed row rejects the whole read rather than returning a filtered empty list', async () => {
  const good = base({ mistakeId: 1 })
  const bad = base({ mistakeId: 2, itemId: 'not-an-integer' })
  const page = loadB10([{ data: [good, bad, base({ mistakeId: 3 })] }])
  await assert.rejects(() => page.api.listMistakeBook(context), (error) => {
    assert.match(error.message, /接口契约/)
    assert.doesNotMatch(error.message, /not-an-integer/)
    return true
  })
  assert.equal(page.requests.length, 1)
})

test('detail rejects malformed shape and does not present an empty substitute', async () => {
  for (const data of [null, {}, base({ mistakeStatus: 'OPEN' }), base({ itemId: '2' }), base({ masteryStatus: 'REVIEW' })]) {
    const page = loadB10([{ data }])
    await assert.rejects(() => page.api.getMistakeDetail(context, 1), (error) => { assert.match(error.message, /接口契约/); return true })
  }
})
