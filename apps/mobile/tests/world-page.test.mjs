import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const appRoot = path.resolve(import.meta.dirname, '..')
const PAGE = 'src/pages/world/world.vue'
const MODULE = 'src/pages/world/world-page.ts'
const COPY = '../../packages/i18n/src/mobile-resources/world-page.ts'

function source(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath) {
  const compiled = ts.transpileModule(source(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    throw new Error(`Unexpected import ${name} in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

const world = loadTs(MODULE)
const copy = loadTs(COPY)
const zh = copy.worldPageCopy(false)
const en = copy.worldPageCopy(true)
const pageSource = source(PAGE)
const moduleSource = source(MODULE)

test('worldPage copy is bilingual with identical non-empty keys and status labels', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const key of Object.keys(zh)) {
    assert.equal(typeof zh[key], 'string', key)
    assert.equal(typeof en[key], 'string', key)
    assert.ok(zh[key].trim(), `zh ${key}`)
    assert.ok(en[key].trim(), `en ${key}`)
  }
  for (const key of ['streakActive', 'streakAtRisk', 'streakBroken', 'streakFrozen', 'streakUnknown', 'seasonActive', 'seasonEnded', 'seasonUpcoming', 'seasonUnknown', 'questDaily', 'questWeekly', 'questSeason', 'questUnknown', 'qualityUltra', 'qualityHigh', 'qualityMedium', 'qualityPerformance', 'levelShort']) {
    assert.ok(zh[key] && en[key], key)
  }
})

test('summary keeps real serverScore zero, real level, feature gate, and never invents coins/rank/growth', () => {
  const summary = world.toWorldSummary({ data: { subjectRef: 'A', level: 4, serverScore: 1280, streakDays: 7, currentSeason: 'S', featureEnabled: true } })
  assert.equal(summary.ok, true)
  assert.equal(summary.data.xp, 1280)
  assert.equal(summary.data.level, 4)
  assert.equal(summary.data.streakDays, 7)
  assert.equal(summary.data.featureEnabled, true)
  assert.equal('coins' in summary.data, false)
  assert.equal('rank' in summary.data, false)
  assert.equal('growth' in summary.data, false)

  const zero = world.toWorldSummary({ data: { subjectRef: 'A', level: 1, serverScore: 0 } })
  assert.equal(zero.ok, true)
  assert.equal(zero.data.xp, 0)

  const missing = world.toWorldSummary({ data: { subjectRef: 'A', level: 1 } })
  assert.equal(missing.ok, true)
  assert.equal(missing.data.xp, null)

  assert.equal(world.toWorldSummary({ data: {} }).ok, false)
  assert.equal(world.isEmptyWorldPayload({ data: null }), true)
  assert.equal(world.isEmptyWorldPayload(null), true)
  assert.equal(world.isEmptyWorldPayload({ data: {} }), false)
  assert.equal(world.toWorldSummary({ data: { level: 0 } }).ok, false)
  const closed = world.toWorldSummary({ data: { subjectRef: 'A', level: 1, featureEnabled: false } })
  assert.equal(world.isWorldFeatureClosed(closed.data), true)
  assert.equal(world.isWorldFeatureClosed(missing.data), false)
})

test('streak mapping preserves zero, normalizes status, and rejects missing/unknown shape', () => {
  const zero = world.toWorldStreak({ data: { currentStreak: 0, status: 'AT_RISK', timeZone: 'Asia/Shanghai' } })
  assert.equal(zero.ok, true)
  assert.equal(zero.data.currentStreak, 0)
  assert.equal(zero.data.status, 'AT_RISK')
  assert.equal(world.streakStatusKey(zero.data.status), 'streakAtRisk')

  const active = world.toWorldStreak({ currentStreak: 4, status: 'IN_PROGRESS' })
  assert.equal(active.ok, true)
  assert.equal(active.data.status, 'ACTIVE')
  assert.equal(world.toWorldStreak({}).ok, false)
  assert.equal(world.toWorldStreak({ data: {} }).ok, false)
})

test('season mapping keeps missing points distinct from zero and never invents a title', () => {
  const zero = world.toWorldSeason({ data: { seasonId: 'SEASON_2026_Q4', status: 'ACTIVE', points: 0 } })
  assert.equal(zero.ok, true)
  assert.equal(zero.data.points, 0)
  assert.equal(zero.data.status, 'ACTIVE')

  const missing = world.toWorldSeason({ data: { seasonId: 'SEASON_2026_Q4' } })
  assert.equal(missing.ok, true)
  assert.equal(missing.data.points, null)
  assert.equal(missing.data.title, null)

  assert.equal(world.toWorldSeason({ data: {} }).ok, false)
  assert.equal(world.toWorldSeason({ data: { seasonId: 'S', status: 'COMPLETED' } }).data.status, 'ENDED')
})

test('quests mapping accepts empty, counts bad rows, preserves missing progress as null, and has no claim path', () => {
  const empty = world.toWorldQuests({ items: [] })
  assert.equal(empty.ok, true)
  assert.equal(empty.data.quests.length, 0)
  assert.equal(empty.data.invalidCount, 0)

  const items = world.toWorldQuests({ items: [
    { questId: 'q1', title: 'Read', period: 'DAILY', target: 2, progress: 1, completed: false, claimed: false },
    { questId: 'q2' },
    { title: 'missing-id' },
  ] })
  assert.equal(items.ok, true)
  assert.equal(items.data.quests.length, 2)
  assert.equal(items.data.invalidCount, 1)
  assert.equal(items.data.quests[1].progress, null)
  assert.equal(world.questPeriodKey(items.data.quests[0].period), 'questDaily')

  assert.equal(world.toWorldQuests({ items: 'bad' }).ok, false)
})

test('failure mapping separates 401/403/offline/conflict/server and retryability', () => {
  const unauthorized = Object.assign(new Error('unauthorized'), { status: 401, details: { error: { code: 'UNAUTHORIZED' } } })
  const forbidden = Object.assign(new Error('forbidden'), { status: 403 })
  const offline = Object.assign(new Error('offline'), { status: 0 })
  const conflict = Object.assign(new Error('conflict'), { status: 409 })
  const server = Object.assign(new Error('server'), { status: 503 })
  assert.equal(world.toWorldFailure(unauthorized).kind, 'unauthorized')
  assert.equal(world.toWorldFailure(forbidden).kind, 'forbidden')
  assert.equal(world.toWorldFailure(offline).kind, 'offline')
  assert.equal(world.toWorldFailure(conflict).kind, 'conflict')
  assert.equal(world.toWorldFailure(server).kind, 'server')
  assert.equal(world.toWorldFailure(server).retryable, true)
})

test('identity comparison rejects A/B late responses', () => {
  assert.equal(world.isSameWorldIdentity({ subject: 'a', revision: 1 }, { subject: 'a', revision: 1 }), true)
  assert.equal(world.isSameWorldIdentity({ subject: 'a', revision: 1 }, { subject: 'b', revision: 1 }), false)
  assert.equal(world.isSameWorldIdentity({ subject: 'a', revision: 1 }, { subject: 'a', revision: 2 }), false)
})

test('SFC compiles and the page uses real GET facts, shared rewards, original assets, and no false facts', () => {
  const { descriptor, errors } = parse(pageSource, { filename: PAGE })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup)
  assert.ok(descriptor.template)
  assert.equal(descriptor.styles.length, 1)
  const script = compileScript(descriptor, { id: 'world-page' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename: PAGE,
    id: 'world-page',
    scoped: true,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename: PAGE, id: 'world-page', scoped: true })
  assert.deepEqual(style.errors, [])

  const page = `${descriptor.scriptSetup.content}\n${descriptor.template.content}\n${descriptor.styles[0].content}`
  assert.match(script.content, /ensureMobilePageAccess\(PAGE_PATH\)/)
  assert.match(script.content, /getB4Profile|getB4Streak|getB4Season|listB4Quests/)
  assert.match(script.content, /onHide/)
  assert.match(script.content, /identityRevision/)
  assert.match(script.content, /b4\.setPerformance/)
  assert.doesNotMatch(page, /b4\.loadWorld|rescueStreak|requestRescue|claimB4Quest|openChest|createAdaptivePerformanceEngine|mobileExperienceEngine/)
  assert.doesNotMatch(page, /coins|rank|growth\.nodes|nextLevelXp/)
  assert.doesNotMatch(page, /AppIcon|✦/)
  assert.doesNotMatch(page, /<input|<textarea/)
  assert.match(descriptor.template.content, /B12RewardsCard/)
  assert.match(descriptor.template.content, /imgIconRocket-df0018e9\.svg/)
  assert.match(descriptor.template.content, /imgIconFlame-2c1c73a2\.svg/)
  assert.match(descriptor.template.content, /imgIconGift-b89f33ab\.svg/)
  assert.match(descriptor.template.content, /imgMascot-d54a4be0\.svg/)
  assert.match(descriptor.template.content, /imgS-8aa360df\.svg/)
  assert.match(descriptor.template.content, /imgS1-49835748\.svg/)
  assert.match(descriptor.template.content, /imgS2-4d7cc3f6\.svg/)
  assert.match(descriptor.template.content, /imgS3-8c27187b\.svg/)
  assert.match(script.content, /worldPage/)
  assert.match(script.content, /featureClosed/)
  assert.match(script.content, /rewardsConfirmed/)
  assert.match(script.content, /sectionFailure\(result\.reason\)/)
  assert.match(script.content, /isEmptyWorldPayload/)
  assert.match(descriptor.template.content, /summaryState === 'error'/)
  assert.match(descriptor.template.content, /streakState === 'error'/)
  assert.match(descriptor.template.content, /questsState === 'error'/)
  assert.match(descriptor.template.content, /seasonState === 'error'/)
  assert.doesNotMatch(descriptor.template.content, /class="world-status"/)
  assert.match(descriptor.template.content, /status === 'ready'/)
  assert.match(descriptor.template.content, /world-live--quiet/)
  assert.match(descriptor.template.content, /role="status"/)
  assert.match(descriptor.template.content, /class="world-state"/)
  assert.match(descriptor.template.content, /class="world-quality"/)
  assert.match(script.content, /pageFailure/)

  const used = new Set(Array.from(page.matchAll(/wt\('([^']+)'/g), (match) => match[1]))
  for (const key of used) assert.ok(key in zh, `missing copy key ${key}`)
  for (const key of ['qualityUltra', 'qualityHigh', 'qualityMedium', 'qualityPerformance', 'levelShort']) assert.ok(key in zh)
  assert.doesNotMatch(moduleSource, /:\s*any\b|<any>|as any/)
})

test('world date keeps the same calendar day under negative and positive device zones', () => {
  assert.equal(world.formatWorldDate('2026-11-03', 'en-US'), 'Nov 3')
  assert.equal(world.formatWorldDate('2026-11-03', 'zh-CN'), '11月3日')
  assert.equal(world.formatWorldDate('2026-03-08', 'en-US'), 'Mar 8')
  assert.equal(world.formatWorldDate('2026-11-01', 'en-US'), 'Nov 1')
})

test('world date accepts a real leap day and rejects impossible/reversed/unsupported values', () => {
  assert.equal(world.formatWorldDate('2028-02-29', 'en-US'), 'Feb 29')
  assert.equal(world.formatWorldDate('2027-02-29', 'en-US'), null)
  assert.equal(world.formatWorldDate('2026-02-31', 'en-US'), null)
  assert.equal(world.formatWorldDate('2026-13-01', 'en-US'), null)
  assert.equal(world.formatWorldDate('11-03-2026', 'en-US'), null)
  assert.equal(world.formatWorldDate('2026-11-03T00:00:00Z', 'en-US'), null)
  assert.equal(world.formatWorldDate('2026-11-03', 'not-a-locale'), 'Nov 3')
})

test('streak mapping does not keep an impossible calendar date', () => {
  const impossible = world.toWorldStreak({ data: { currentStreak: 4, lastValidDate: '2026-02-31', streakStatus: 'ACTIVE' } })
  assert.equal(impossible.ok, true)
  assert.equal(impossible.data.lastValidDate, null)
  const leap = world.toWorldStreak({ data: { currentStreak: 4, lastValidDate: '2028-02-29', streakStatus: 'ACTIVE' } })
  assert.equal(leap.ok, true)
  assert.equal(leap.data.lastValidDate, '2028-02-29')
})
