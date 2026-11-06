import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue = require('vue')
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const appRoot = path.resolve(import.meta.dirname, '..')
const PAGE = 'src/pages/report-share/report-share.vue'

function read(relativePath) { return fs.readFileSync(path.join(appRoot, relativePath), 'utf8') }
function loadTsModule(relativePath) {
  const source = read(relativePath)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error(`unexpected import in ${relativePath}`) }, module, module.exports)
  return module.exports
}
function flatten(value, prefix = '', out = {}) { for (const [key, item] of Object.entries(value)) { const next = prefix ? `${prefix}.${key}` : key; if (item && typeof item === 'object') flatten(item, next, out); else out[next] = item } return out }
function getPath(root, key) { let value = root; for (const part of key.split('.')) value = value?.[part]; return value }
const copyZh = loadTsModule('../../packages/i18n/src/mobile-resources/report-share-page.ts').reportSharePageCopy(false)
const copyEn = loadTsModule('../../packages/i18n/src/mobile-resources/report-share-page.ts').reportSharePageCopy(true)

function loadPage(options = {}) {
  const locale = options.locale || 'zh-CN'
  const copy = locale === 'en-US' ? copyEn : copyZh
  function mobileT(key) {
    const value = getPath(copy, key.replace(/^reportSharePage\./, ''))
    return typeof value === 'string' ? value : key
  }
  const calls = { requests: [], pages: [], shown: 0, hidden: 0 }
  const behaviors = { navReject: false }
  const lifecycle = {}
  const b10ThemeMode = vue.ref(options.theme || 'light')
  const requests = []
  const storage = { request: (request) => { requests.push(request) }, openUniPage: (url) => { calls.pages.push(url); return behaviors.navReject ? Promise.reject(new Error('synthetic navigation failure')) : undefined } }
  const source = read(PAGE)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'report-share.vue exposes script setup')
  const exports = `
module.exports.__fixture = { status, publicShare, error: actionError, requesting, shareRef, periodText, availabilityTag, copyText, showStats, newItemsText, reviewItemsText, durationText, durationNote, basisText, showSuggestion, showBottomBar, isPartial, glowSrc, loadShare, retry, returnHome }
`
  const compiled = ts.transpileModule(`${script}\n${exports}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const vuePort = { ...vue, onBeforeUnmount() {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        vue: vuePort,
        '@dcloudio/uni-app': { onLoad(cb) { lifecycle.load = cb }, onShow(cb) { lifecycle.show = cb }, onHide(cb) { lifecycle.hide = cb } },
        '../../components/MobilePageHeader.vue': {},
        '../../platform/experience': { mobileT, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }) },
        '../../platform/gateway': { getGatewayBaseUrl: () => 'https://gateway.test/api/v1' },
        '../../platform/uni-runtime': { getUniRuntime: () => storage, openUniPage: (url) => storage.openUniPage(url) },
        '../../platform/b10-foundation': { b10ThemeMode },
        '../../platform/v2-foundation': { mobileI18n: { formatNumber: (value) => new Intl.NumberFormat(locale === 'en-US' ? 'en-US' : 'zh-CN').format(value), formatDate: (value, opts) => new Intl.DateTimeFormat(locale === 'en-US' ? 'en-US' : 'zh-CN', { timeZone: 'America/Los_Angeles', ...opts }).format(value) } },
        '@englishflow/i18n': { interpolate: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key])) },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name} in ${PAGE}`)
      return modules[name]
    }, module, module.exports)
  })
  return {
    fixture: module.exports.__fixture, calls, behaviors, lifecycle, requests, b10ThemeMode,
    respond(index, statusCode, data) { const request = requests[index]; assert.ok(request, `missing request ${index}`); request.success({ statusCode, data }) },
    fail(index) { const request = requests[index]; assert.ok(request, `missing request ${index}`); request.fail(new Error('network')) },
    dispose: () => scope.stop(),
  }
}

function active(overrides = {}) {
  return {
    status: 'ACTIVE',
    availability: 'READY',
    copy: '这段统计来自已记录的学习活动。',
    periodStart: '2026-10-12',
    periodEndExclusive: '2026-10-19',
    newItems: 126,
    reviewItems: 240,
    durationStatus: 'COUNTED',
    durationCopy: '只统计已记录的有效学习时段。',
    activeMillis: 11_520_000,
    suggestion: '先订正这段时间里答错的练习。',
    suggestionBasis: 'MISTAKES',
    subject: 'must-not-leak',
    principalId: 'must-not-leak',
    owner: 'must-not-leak',
    reportId: 'must-not-leak',
    score: 99,
    privateReport: { must: 'not leak' },
    ...overrides,
  }
}
const refA = 'a'.repeat(32), refB = 'b'.repeat(32)

test('report-share resource module has the complete bilingual key set', () => {
  const zh = flatten(copyZh), en = flatten(copyEn)
  assert.equal(Object.keys(zh).length, Object.keys(en).length)
  assert.ok(Object.keys(zh).length >= 50, String(Object.keys(zh).length))
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const key of ['title', 'loading', 'errorTitle', 'revokedTitle', 'expiredTitle', 'partialNote', 'retry', 'returnHome', 'basis.MISTAKES']) assert.equal(typeof zh[key], 'string', key)
})

test('report-share SFC compiles and all original assets are non-empty with root geometry', () => {
  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename: PAGE })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'report-share-page' })
  const template = compileTemplate({ source: descriptor.template.content, filename: PAGE, id: 'report-share-page', scoped: true, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename: PAGE, id: 'report-share-page', scoped: true })
  assert.deepEqual(style.errors, [])
  const refs = new Set([...source.matchAll(/\/static\/figma-report-share-[a-z0-9-]+\/[A-Za-z0-9]+\.svg/g)].map((match) => match[0]))
  assert.ok(refs.size >= 8, String(refs.size))
  for (const ref of refs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    assert.ok(fs.existsSync(file), `missing ${ref}`)
    assert.ok(fs.statSync(file).size > 0, `empty ${ref}`)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<svg[^>]+width="[\d.]+"[^>]+height="[\d.]+"/, `root geometry ${ref}`)
    if (ref.includes('imgGlow')) assert.match(svg, /width="540"[^>]+height="480"/, `glow root ${ref}`)
  }
})

test('report-share active reads only public fields and formats inclusive end date', () => {
  const page = loadPage()
  try {
    page.lifecycle.load({ ref: refA })
    assert.equal(page.requests.length, 1)
    assert.ok(page.requests[0].url.endsWith(`/api/v1/public/learning/report-shares/${refA}`))
    assert.equal(page.requests[0].method, 'GET')
    assert.equal(page.requests[0].header, undefined, 'public request must not attach Authorization')
    assert.equal(page.fixture.status.value, 'LOADING')
    assert.equal(page.fixture.requesting.value, true)
    page.respond(0, 200, active())
    assert.equal(page.fixture.status.value, 'ACTIVE')
    assert.equal(page.fixture.requesting.value, false)
    assert.equal(page.fixture.publicShare.value.newItems, 126)
    assert.equal(page.fixture.newItemsText.value, '126')
    assert.equal(page.fixture.reviewItemsText.value, '240')
    assert.equal(page.fixture.durationText.value, '3h12m')
    assert.match(page.fixture.periodText.value, /10月12日/)
    assert.match(page.fixture.periodText.value, /10月18日/)
    assert.doesNotMatch(page.fixture.periodText.value, /10月19日/)
    assert.equal(page.fixture.basisText.value, '这段时间有答错的练习。')
    assert.equal(page.fixture.availabilityTag.value, '已汇总')
    assert.equal(page.fixture.showStats.value, true)
    assert.equal('subject' in page.fixture.publicShare.value, false)
    assert.equal('principalId' in page.fixture.publicShare.value, false)
    assert.equal('owner' in page.fixture.publicShare.value, false)
    assert.equal('reportId' in page.fixture.publicShare.value, false)
    assert.equal('score' in page.fixture.publicShare.value, false)
    assert.equal('privateReport' in page.fixture.publicShare.value, false)
  } finally { page.dispose() }
})

test('report-share period is UTC calendar-date stable and rejects invalid/reversed ranges', () => {
  const page = loadPage()
  try {
    page.lifecycle.load({ ref: refA }); page.respond(0, 200, active())
    assert.match(page.fixture.periodText.value, /10月12日/)
    assert.match(page.fixture.periodText.value, /10月18日/)
    page.respond(0, 200, active({ periodStart: '2026-02-31', periodEndExclusive: '2026-03-02' }))
    assert.equal(page.fixture.periodText.value, '')
    page.respond(0, 200, active({ periodStart: '2026-10-20', periodEndExclusive: '2026-10-19' }))
    assert.equal(page.fixture.periodText.value, '')
  } finally { page.dispose() }
})

test('report-share partial and duration NOT_RECORDED never become zero or verified', () => {
  const page = loadPage()
  try {
    page.lifecycle.load({ ref: refA }); page.respond(0, 200, active({ availability: 'PARTIAL', newItems: 3, reviewItems: null, durationStatus: 'NOT_RECORDED', durationCopy: '有效时长还没有记录，不会用间隔冒充。', activeMillis: null }))
    assert.equal(page.fixture.status.value, 'ACTIVE')
    assert.equal(page.fixture.availabilityTag.value, '部分汇总')
    assert.equal(page.fixture.newItemsText.value, '3')
    assert.equal(page.fixture.reviewItemsText.value, '—')
    assert.equal(page.fixture.durationText.value, '—')
    assert.equal(page.fixture.durationNote.value, '有效时长还没有记录，不会用间隔冒充。')
    assert.equal(page.fixture.isPartial.value, true)
  } finally { page.dispose() }
})

test('report-share revoked and expired stay distinct from not found', () => {
  const page = loadPage()
  try {
    page.lifecycle.load({ ref: refA }); page.respond(0, 200, { status: 'REVOKED' }); assert.equal(page.fixture.status.value, 'REVOKED'); assert.equal(page.fixture.publicShare.value, null)
    page.lifecycle.load({ ref: refB }); page.respond(1, 200, { status: 'EXPIRED' }); assert.equal(page.fixture.status.value, 'EXPIRED'); assert.equal(page.fixture.publicShare.value, null)
  } finally { page.dispose() }
})

test('report-share invalid ref sends zero requests', () => {
  const page = loadPage()
  try { page.lifecycle.load({ ref: 'bad-ref' }); assert.equal(page.requests.length, 0); assert.equal(page.fixture.status.value, 'NOT_FOUND') } finally { page.dispose() }
})

test('report-share 404 is NOT_FOUND and 5xx/403/unknown are ERROR with retry', () => {
  for (const [code, expected] of [[404, 'NOT_FOUND'], [500, 'ERROR'], [403, 'ERROR']]) {
    const page = loadPage()
    try { page.lifecycle.load({ ref: refA }); page.respond(0, code, {}); assert.equal(page.fixture.status.value, expected) } finally { page.dispose() }
  }
  const page = loadPage()
  try { page.lifecycle.load({ ref: refA }); page.respond(0, 200, { status: 'MYSTERY' }); assert.equal(page.fixture.status.value, 'ERROR') } finally { page.dispose() }
})

test('report-share retry is single-flight and generation ignores late A after B/hide', () => {
  const page = loadPage()
  try {
    page.lifecycle.load({ ref: refA }); page.fixture.retry(); page.fixture.retry(); assert.equal(page.requests.length, 1)
    page.respond(0, 500, {}); assert.equal(page.fixture.status.value, 'ERROR'); page.fixture.retry(); assert.equal(page.requests.length, 2)
    page.respond(1, 200, active({ copy: 'B' })); assert.equal(page.fixture.publicShare.value.copy, 'B')
    page.lifecycle.load({ ref: refB }); page.lifecycle.load({ ref: refA }); assert.equal(page.requests.length, 4)
    page.respond(2, 200, active({ copy: 'B-late' })); assert.equal(page.fixture.status.value, 'LOADING'); assert.equal(page.fixture.publicShare.value, null)
    page.respond(3, 200, active({ copy: 'A-current' })); assert.equal(page.fixture.publicShare.value.copy, 'A-current')
    page.lifecycle.load({ ref: refB }); page.lifecycle.hide(); page.respond(4, 200, active({ copy: 'hidden-late' })); assert.equal(page.fixture.publicShare.value, null); assert.equal(page.fixture.status.value, 'LOADING')
    page.lifecycle.show(); assert.equal(page.requests.length, 6)
  } finally { page.dispose() }
})

test('report-share safe exit calls the existing guarded home route and reports rejection', async () => {
  const page = loadPage()
  try {
    await page.fixture.returnHome(); assert.deepEqual(page.calls.pages, ['/pages/home/home']); assert.equal(page.fixture.error.value, '')
    page.behaviors.navReject = true; await page.fixture.returnHome(); assert.equal(page.fixture.error.value, '暂时无法打开首页，请重试。')
  } finally { page.dispose() }
})

test('report-share state copy is bilingual and no private fields are rendered by the model', () => {
  const en = loadPage({ locale: 'en-US' })
  try {
    en.lifecycle.load({ ref: refA }); en.respond(0, 200, active())
    assert.equal(en.fixture.availabilityTag.value, 'Summary ready')
    assert.equal(en.fixture.newItemsText.value, '126')
    assert.equal(en.fixture.periodText.value.includes('Oct 18'), true)
  } finally { en.dispose() }
})
