import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const appRoot = path.resolve(import.meta.dirname, '..')
const PAGE = 'src/pages/b10-report/b10-report.vue'
const MAPPER = 'src/pages/b10-report/report-page.ts'
const RESOURCE = '../../packages/i18n/src/mobile-resources/report-page.ts'

function read(relativePath) { return fs.readFileSync(path.join(appRoot, relativePath), 'utf8') }
function loadTs(relativePath) {
  const compiled = ts.transpileModule(read(relativePath), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error(`unexpected import ${relativePath}`) }, module, module.exports)
  return module.exports
}
function flat(value, prefix = '', out = {}) {
  for (const [key, item] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (item && typeof item === 'object') flat(item, next, out)
    else out[next] = item
  }
  return out
}
const mapper = loadTs(MAPPER)
const resource = loadTs(RESOURCE)
const zh = flat(resource.reportPageCopy(false))
const en = flat(resource.reportPageCopy(true))

test('calendar period uses UTC and rejects invalid/reversed half-open ends', () => {
  const period = mapper.inclusivePeriod('2026-10-12', '2026-10-19')
  assert.ok(period)
  assert.equal(period.start.toISOString(), '2026-10-12T00:00:00.000Z')
  assert.equal(period.end.toISOString(), '2026-10-18T00:00:00.000Z')
  assert.equal(period.end.toISOString().slice(0, 10), '2026-10-18')
  assert.equal(mapper.inclusivePeriod('2026-02-31', '2026-03-02'), null)
  assert.equal(mapper.inclusivePeriod('2026-10-20', '2026-10-19'), null)
  assert.equal(mapper.inclusivePeriod('2026-10-12', '2026-10-12'), null)
  assert.equal(mapper.inclusivePeriod('10/12/2026', '2026-10-19'), null)
})

test('availability is mapped only from exact public facts and unknown stays unknown', () => {
  for (const value of ['READY', 'PARTIAL', 'GENERATING', 'EMPTY', 'FAILED']) assert.equal(mapper.availabilityKind(value), value)
  for (const value of ['PARTIALISH', 'ready', '', null, undefined, 'OPEN']) assert.equal(mapper.availabilityKind(value), 'UNKNOWN')
})

test('share receipt rejects arbitrary 200 and arbitrary public paths without inventing an origin', () => {
  const ref = 'a'.repeat(32)
  const valid = mapper.shareReceipt({ ref, publicPath: `/api/v1/public/learning/report-shares/${ref}` })
  assert.deepEqual(valid, { ref, publicPath: `/api/v1/public/learning/report-shares/${ref}` })
  assert.equal(mapper.shareReceipt({ ref, publicPath: `https://example.test/api/v1/public/learning/report-shares/${ref}` }), null)
  assert.equal(mapper.shareReceipt({ ref, publicPath: `/api/v1/public/learning/report-shares/${'b'.repeat(32)}` }), null)
  assert.equal(mapper.shareReceipt({ ref: 'not-hex', publicPath: `/api/v1/public/learning/report-shares/${ref}` }), null)
  assert.equal(mapper.shareReceipt({ ref, publicPath: '' }), null)
  assert.equal(mapper.shareReceipt({ ref, publicPath: `/api/v1/public/learning/report-shares/extra/${ref}` }), null)
  assert.equal(mapper.shareReceipt({ ref, publicPath: `/api/v1/public/learning/report-shares/${ref}?x=1` }), null)
  assert.equal(mapper.shareReceipt({}), null)
  assert.equal(mapper.shareReceipt(null), null)
  assert.equal(mapper.publicSharePageUrl(ref, 'https://report-share-ui.synthetic.invalid'), `https://report-share-ui.synthetic.invalid/#/pages/report-share/report-share?ref=${ref}`)
  assert.equal(mapper.publicSharePageUrl(ref, 'https://report-share-ui.synthetic.invalid/'), `https://report-share-ui.synthetic.invalid/#/pages/report-share/report-share?ref=${ref}`)
  assert.equal(mapper.publicSharePageUrl(ref, 'file:///tmp/report.html'), null)
  assert.equal(mapper.publicSharePageUrl(ref, 'https://report-share-ui.synthetic.invalid/path'), null)
  assert.equal(mapper.publicSharePageUrl(ref, ''), null)
  assert.equal(mapper.publicSharePageUrl(ref, null), null)
  assert.equal(mapper.publicSharePageUrl('not-hex', 'https://report-share-ui.synthetic.invalid'), null)
  assert.equal(mapper.maskRef(ref), 'aaaa…aaaa')
  assert.notEqual(mapper.maskRef(ref), ref)
})

test('reportPage resources are complete in both locales and contain no empty UI strings', () => {
  assert.ok(Object.keys(zh).length >= 65, String(Object.keys(zh).length))
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const [key, value] of Object.entries(zh)) {
    assert.equal(typeof value, 'string', key)
    assert.ok(value.trim().length > 0, key)
    assert.equal(typeof en[key], 'string', key)
    assert.ok(en[key].trim().length > 0, key)
  }
  for (const key of ['title', 'tabs.mistakes', 'tabs.daily', 'tabs.weekly', 'mistakes.retry', 'report.ruleNote', 'share.issue', 'share.failed', 'share.copy', 'share.preview', 'share.copyUnavailable', 'noAccess.title', 'error.offlineTitle', 'status.PENDING_RETRY', 'mastery.NEW', 'basis.MISTAKES']) assert.equal(typeof zh[key], 'string', key)
})

test('report page SFC compiles, uses reportPage copy and all original assets', () => {
  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename: PAGE })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'b10-report-page' })
  const template = compileTemplate({ source: descriptor.template.content, filename: PAGE, id: 'b10-report-page', scoped: true, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename: PAGE, id: 'b10-report-page', scoped: true })
  assert.deepEqual(style.errors, [])
  assert.match(source, /reportPage\./)
  assert.match(source, /ensureMobilePageAccess/)
  assert.match(source, /isLearningReady/)
  assert.match(source, /identityRevision/)
  assert.match(source, /onHide/)
  assert.match(source, /inclusivePeriod/)
  assert.match(source, /shareReceipt/)
  assert.match(source, /publicSharePageUrl/)
  assert.match(source, /previewShare/)
  assert.match(source, /getMistakeDetail/)
  assert.match(source, /issueReportShare/)
  assert.match(source, /revokeReportShare/)
  assert.match(source, /setClipboardData/)
  assert.doesNotMatch(source, /AppIcon/)
  assert.doesNotMatch(source, /[\u4e00-\u9fff]/)
  assert.doesNotMatch(source, /score|percentile|aiScore|correctRate/)
  assert.doesNotMatch(source, /sharePath\s*\}\}/)
  const refs = new Set([...source.matchAll(/\/static\/figma-report-[a-z0-9-]+\/[A-Za-z0-9]+\.svg/g)].map((match) => match[0]))
  assert.ok(refs.size >= 8, String(refs.size))
  for (const ref of refs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    assert.ok(fs.existsSync(file), `missing ${ref}`)
    assert.ok(fs.statSync(file).size > 0, `empty ${ref}`)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<svg[^>]+width="[\d.]+"[^>]+height="[\d.]+"/, `root geometry ${ref}`)
  }
})

test('share date is an exact calendar day and a loading report is not a new period', () => {
  assert.equal(mapper.reportShareDate('2026-10-12'), '2026-10-12')
  assert.equal(mapper.reportShareDate('2026-10-14'), '2026-10-14')
  for (const value of ['2026-02-31', '2026-10-12T00:00:00Z', ' 2026-10-12', '10/12/2026', '', null, undefined]) {
    assert.equal(mapper.reportShareDate(value), null, String(value))
  }
  const same = { periodStart: '2026-10-12', periodEndExclusive: '2026-10-13' }
  const boundToken = 'daily|2026-10-12|2026-10-13'
  assert.equal(mapper.reportSharePeriodToken('daily', same), boundToken)
  assert.equal(mapper.reportSharePeriodToken('weekly', { periodStart: '2026-10-14', periodEndExclusive: '2026-10-21' }), 'weekly|2026-10-14|2026-10-21')
  for (const status of ['loading', 'idle', 'offline', 'error', 'stale', 'forbidden']) {
    assert.equal(mapper.confirmedReportSharePeriodChanged({
      boundToken,
      status,
      kind: 'daily',
      period: { periodStart: '2026-10-13', periodEndExclusive: '2026-10-14' },
    }), false, status)
  }
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'ready', kind: 'daily', period: same }), false)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'empty', kind: 'daily', period: same }), false)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'ready', kind: 'daily', period: { periodStart: '2026-10-13', periodEndExclusive: '2026-10-14' } }), true)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'empty', kind: 'weekly', period: { periodStart: '2026-10-14', periodEndExclusive: '2026-10-21' } }), true)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'ready', kind: 'daily', period: null }), true)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken: null, status: 'ready', kind: 'daily', period: null }), false)
  assert.equal(mapper.confirmedReportSharePeriodChanged({ boundToken, status: 'ready', kind: 'mistakes', period: null }), false)
})

test('hide invalidates late share replies and a confirmed replacement still clears the attempt', () => {
  const source = read(PAGE)
  const hideAt = source.indexOf('onHide(() => {')
  assert.ok(hideAt > 0)
  const hide = source.slice(hideAt, source.indexOf('\n})', hideAt))
  assert.match(hide, /shareGeneration \+= 1/)
  assert.doesNotMatch(hide, /shareAttempt|shareRef|clearShare|issueShare|revokeShare|copyShare/)
  assert.match(source, /function clearShare\(\): void \{\n  shareGeneration \+= 1\n  shareAttempt = null\n  shareRef\.value = ''/)
  assert.match(source, /if \(!confirmedReportSharePeriodChanged\(\{/)
  assert.match(source, /date: reportShareDate\(period\.periodStart\)/)
  assert.match(source, /idempotencyKey: attempt\.key, date: attempt\.date/)
  assert.match(source, /if \(availability\.value !== 'READY'\) return/)
  assert.match(source, /generation !== shareGeneration \|\| revision !== session\.identityRevision \|\| shareAttempt !== attempt/)
  const revoke = source.slice(source.indexOf('async function revokeShare'), source.indexOf('function copyTextToClipboard'))
  assert.match(revoke, /generation !== shareGeneration \|\| revision !== session\.identityRevision/)
  const copy = source.slice(source.indexOf('async function copyShare'), source.indexOf('function previewShare'))
  assert.match(copy, /generation === shareGeneration/)
  assert.match(source, /onBeforeUnmount\(\(\) => \{[\s\S]*?shareGeneration \+= 1\n  shareAttempt = null/)
  assert.doesNotMatch(read('src/api/b10.ts'), /optionalReportShareDate|optionalReportShareKey/)
})

function loadIssueApi() {
  const requests = []
  let respond = async () => ({ ref: 'a'.repeat(32), publicPath: `/api/v1/public/learning/report-shares/${'a'.repeat(32)}` })
  const compiled = ts.transpileModule(read('src/api/b10.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  class MobileApiError extends Error {
    constructor(message, status, details) {
      super(message)
      this.status = status
      this.details = details
    }
  }
  const stubs = {
    './client': { MobileApiError, mobileApiClient: { request: async (requestPath, options) => { requests.push({ path: requestPath, options }); return respond() } } },
    './unavailable': { unavailableOperation: async () => { throw new Error('closed') } },
    '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
    './b3': { listGrammarExercises: async () => [] },
    '../domain/grammar-page': { grammarPreviewItems: () => [], grammarQuestionItemId: () => null, parseGrammarPointContent: () => null },
    '../platform/client-id': { createClientId: (prefix = 'client') => `${prefix}-test` },
  }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in stubs)) throw new Error(`unexpected import ${name}`)
    return stubs[name]
  }, module, module.exports)
  return { api: module.exports.b10LearningApi, requests, setRespond(next) { respond = next }, MobileApiError }
}

test('a supplied share key is sent or rejected before the network, and a typed date is not reinterpreted', async () => {
  const api = loadIssueApi()
  const key = 'mb016-report-share-1234567890abcdef'
  const legacy = await api.api.issueReportShare('daily')
  assert.equal(legacy.ref, 'a'.repeat(32))
  assert.equal(api.requests[0].path, '/learning/reports/DAILY/shares')
  assert.equal(api.requests[0].options.method, 'POST')
  assert.deepEqual(api.requests[0].options.data, {})
  assert.equal(api.requests[0].options.header, undefined)

  await api.api.issueReportShare('weekly', { idempotencyKey: key, date: '2026-10-14' })
  assert.equal(api.requests[1].path, '/learning/reports/WEEKLY/shares?date=2026-10-14')
  assert.equal(api.requests[1].options.header['Idempotency-Key'], key)
  assert.deepEqual(api.requests[1].options.data, {})

  await api.api.issueReportShare('daily', { idempotencyKey: key, date: '2026-02-31' })
  assert.equal(api.requests[2].path, '/learning/reports/DAILY/shares?date=2026-02-31')
  assert.equal(api.requests[2].options.header['Idempotency-Key'], key)

  await api.api.issueReportShare('daily', { idempotencyKey: key, date: null })
  assert.equal(api.requests[3].path, '/learning/reports/DAILY/shares')
  assert.equal(api.requests[3].options.header['Idempotency-Key'], key)

  const beforeReject = api.requests.length
  await assert.rejects(
    () => api.api.issueReportShare('daily', { idempotencyKey: 'short', date: 'not-a-date' }),
    (error) => error instanceof api.MobileApiError && error.status === 400 && error.message === 'Idempotency-Key must contain 16-128 safe characters' && error.details.code === 'IDEMPOTENCY_KEY_INVALID',
  )
  await assert.rejects(() => api.api.issueReportShare('daily', { idempotencyKey: '' }), (error) => error.status === 400 && api.requests.length === beforeReject)
  await assert.rejects(() => api.api.issueReportShare('daily', {}), (error) => error.status === 400)
  assert.equal(api.requests.length, beforeReject)

  api.setRespond(async () => { throw Object.assign(new Error('unavailable'), { status: 503 }) })
  await assert.rejects(() => api.api.issueReportShare('daily', { idempotencyKey: key, date: '2026-10-12' }), (error) => error.status === 503 && error.message === 'unavailable')
  api.setRespond(async () => ({ ref: 'not-a-ref' }))
  await assert.rejects(() => api.api.issueReportShare('daily'), /分享链接没有生成/)

  const web = fs.readFileSync(path.resolve(appRoot, '../learner-web/src/api/b10.ts'), 'utf8')
  const webIssue = web.slice(web.indexOf('export async function issueReportShare'), web.indexOf('export async function revokeReportShare'))
  assert.doesNotMatch(webIssue, /Idempotency-Key|idempotencyKey/)
  assert.match(webIssue, /\/learning\/reports\/\$\{reportType\}\/shares`, \{\}, withB10Headers\(\)/)
})
