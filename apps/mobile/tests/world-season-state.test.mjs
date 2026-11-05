import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repo = path.resolve(import.meta.dirname, '..', '..', '..')
const appRoot = path.join(repo, 'apps/mobile')
const pagePath = 'src/pages/world/world.vue'
const mapperPath = 'src/pages/world/world-page.ts'
const copyPath = path.join(repo, 'packages/i18n/src/mobile-resources/world-page.ts')
const req = createRequire(path.join(appRoot, 'package.json'))

function loadTs(file, modules = {}) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${file}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const mapper = loadTs(path.join(appRoot, mapperPath))
const copy = loadTs(copyPath)
const zh = copy.worldPageCopy(false)

function loadPage(api = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'world page script setup missing')
  const calls = { profile: 0, streak: 0, quests: 0, season: 0, names: [], subjects: [] }
  const session = req('vue').reactive({
    isAuthenticated: true,
    isLearningReady: true,
    identityRevision: 1,
    verifiedSubject: 'learner-a',
    getMobileApiIdentity() {
      return { subject: this.verifiedSubject, revision: this.identityRevision }
    },
  })
  const b4 = { performanceLevel: 'High', setPerformance() {}, restore() {} }
  const shown = []
  const hidden = []
  const access = { run: async () => true }
  const apiImpl = {
    getB4Profile: async () => {
      calls.profile += 1
      calls.names.push('GET /gamification/me/summary')
      return { data: { subjectRef: 'learner-a', level: 2, serverScore: 20, featureEnabled: true, currentSeason: 'SEASON_2026_Q4' } }
    },
    getB4Streak: async () => {
      calls.streak += 1
      calls.names.push('GET /gamification/streak')
      return { data: { currentStreak: 4, status: 'ACTIVE', lastValidDate: '2026-11-03', timeZone: 'Asia/Shanghai' } }
    },
    listB4Quests: async () => {
      calls.quests += 1
      calls.names.push('GET /gamification/quests')
      return { data: { items: [{ questId: 'q1', title: 'Read', period: 'DAILY', target: 2, progress: 1, completed: false, claimed: false }] } }
    },
    getB4Season: async () => {
      calls.season += 1
      calls.names.push('GET /gamification/season')
      return { data: { seasonId: 'SEASON_2026_Q4', title: '2026 年第四季度赛季', status: 'ACTIVE', points: 10, tiers: [] } }
    },
    ...api,
  }
  const wrapped = {}
  for (const [name, fn] of Object.entries(apiImpl)) {
    wrapped[name] = async (...args) => {
      if (!Object.prototype.hasOwnProperty.call(api, name)) return fn(...args)
      return api[name](calls, ...args)
    }
  }
  const modules = {
    vue: req('vue'),
    '@dcloudio/uni-app': {
      onShow: (callback) => shown.push(callback),
      onHide: (callback) => hidden.push(callback),
    },
    '../../components/MobilePageHeader.vue': {},
    '../../components/b12/B12RewardsCard.vue': {},
    '../../auth/navigation': { ensureMobilePageAccess: () => access.run() },
    '../../api/b4': wrapped,
    '../../domain/b4': { B4_PERFORMANCE_LEVELS: ['Ultra', 'High', 'Medium', 'Performance'] },
    '../../platform/b10-foundation': { b10ThemeMode: { value: 'light' }, b10UiLocale: { value: 'zh-CN' } },
    '../../platform/experience': {
      mobileT: (key) => {
        const name = key.startsWith('worldPage.') ? key.slice('worldPage.'.length) : key
        const value = zh[name]
        if (typeof value !== 'string') throw new Error(`missing world copy ${key}`)
        return value
      },
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
    },
    '../../platform/uni-runtime': { openUniPage() {} },
    '../../stores/session': { useSessionStore: () => session },
    '../../stores/b4': { useB4Store: () => b4 },
    './world-page': mapper,
  }
  const exported = `${script}
export const __test = { retry }
export const __refs = { status, statusKey, summary, streak, season, quests, summaryState, streakState, seasonState, questsState, accessBlocked }
export const __view = {
  seasonCard() {
    if (seasonState.value === 'error') return { kind: 'error', text: wt('seasonUnavailable'), retry: wt('retry') }
    if (season.value) {
      return {
        kind: 'content',
        title: season.value.title ?? season.value.seasonId,
        status: wt(seasonStatusKey(season.value.status)),
        points: seasonPoints(season.value),
        titleField: season.value.title,
        pointsField: season.value.points,
        statusField: season.value.status,
      }
    }
    if (seasonState.value === 'empty') return { kind: 'empty', text: wt('noSeason'), retry: null }
    return { kind: seasonState.value, text: null, retry: null }
  },
  statusText() { return wt(statusKey.value) },
}
`
  const compiled = ts.transpileModule(exported, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
    return modules[name]
  }, module, module.exports)
  return { calls, shown, hidden, session, access, test: module.exports.__test, refs: module.exports.__refs, view: module.exports.__view }
}

function routeBox() {
  const previousWindow = globalThis.window
  const previousPages = globalThis.getCurrentPages
  return {
    hash(value) {
      globalThis.window = { location: { hash: value } }
      delete globalThis.getCurrentPages
    },
    pages(routes) {
      delete globalThis.window
      globalThis.getCurrentPages = () => routes.map((route) => ({ route }))
    },
    restore() {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
      if (previousPages === undefined) delete globalThis.getCurrentPages
      else globalThis.getCurrentPages = previousPages
    },
  }
}

async function untilSettled(page, ready) {
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (page.refs.status.value !== 'loading' && ready(page)) return
  }
  throw new Error(`world page stayed ${page.refs.status.value} profile=${page.calls.profile} season=${page.calls.season}`)
}

async function settle(page) {
  page.shown.length ? page.shown[0]() : page.test.retry()
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (page.refs.status.value !== 'loading') return
  }
  throw new Error(`world page stayed ${page.refs.status.value}`)
}

async function open(api) {
  const page = loadPage(api)
  await settle(page)
  return page
}

function seasonApi(bodyOrThrow) {
  return {
    getB4Season: async (calls) => {
      calls.season += 1
      calls.names.push('GET /gamification/season')
      if (typeof bodyOrThrow === 'function') return bodyOrThrow(calls)
      return bodyOrThrow
    },
  }
}

test('mapper still rejects unrecognized seasons and keeps the calendar contract', () => {
  assert.equal(mapper.isEmptyWorldPayload({ data: {} }), false)
  assert.equal(mapper.isEmptyWorldPayload(null), true)
  assert.equal(mapper.isEmptyWorldPayload({ data: null }), true)
  assert.equal(mapper.toWorldSeason({ data: { unexpected: true } }).ok, false)
  assert.equal(mapper.toWorldSeason({}).ok, false)
  assert.equal(mapper.toWorldSeason({ data: {} }).ok, false)
  const java = mapper.toWorldSeason({ data: { seasonId: 'SEASON_2026_Q4', points: 0, factCount: 0 } })
  assert.equal(java.ok, true)
  assert.equal(java.data.title, null)
  assert.equal(java.data.points, 0)
  assert.equal(java.data.status, 'UNKNOWN')
  assert.equal(mapper.formatWorldDate('2026-11-03', 'en-US'), 'Nov 3')
  assert.equal(mapper.formatWorldDate('2026-11-03', 'zh-CN'), '11月3日')
  assert.equal(mapper.formatWorldDate('2026-02-31', 'en-US'), null)
  assert.equal(zh.seasonUnavailable, '赛季暂时无法读取。')
  assert.equal(zh.noSeason, '当前暂无赛季活动。')
  assert.equal(zh.seasonUnknown, '状态待确认')
  assert.equal(zh.retry, '重试')
})

test('unrecognized season object and missing outer envelope are errors with retry', async () => {
  const unexpected = await open(seasonApi({ data: { unexpected: true } }))
  assert.deepEqual(unexpected.view.seasonCard(), { kind: 'error', text: '赛季暂时无法读取。', retry: '重试' })
  assert.equal(unexpected.refs.season.value, null)
  assert.equal(unexpected.refs.status.value, 'partial')
  assert.equal(unexpected.view.statusText(), '部分成长数据暂时无法读取，已保留可读内容。')
  assert.equal(unexpected.refs.summary.value.level, 2)
  assert.equal(unexpected.refs.streak.value.currentStreak, 4)
  assert.equal(unexpected.refs.quests.value.quests.length, 1)
  assert.equal(unexpected.refs.accessBlocked.value, false)

  const missing = await open(seasonApi({}))
  assert.deepEqual(missing.view.seasonCard(), { kind: 'error', text: '赛季暂时无法读取。', retry: '重试' })
  assert.equal(missing.refs.season.value, null)
  assert.equal(missing.refs.status.value, 'partial')
  assert.equal(missing.calls.season, 1)
})

test('legacy null, data null, and explicit empty object stay empty', async () => {
  for (const body of [null, { data: null }, { data: {} }]) {
    const page = await open(seasonApi(body))
    assert.deepEqual(page.view.seasonCard(), { kind: 'empty', text: '当前暂无赛季活动。', retry: null })
    assert.equal(page.refs.season.value, null)
    assert.equal(page.refs.seasonState.value, 'empty')
    assert.equal(page.refs.streak.value.currentStreak, 4)
    assert.equal(page.refs.status.value, 'ready')
  }
})

test('Figma season and current Java seasonId shape render truthful content', async () => {
  const figma = await open(seasonApi({
    data: { seasonId: 'SEASON_2026_Q4', title: '2026 年第四季度赛季', status: 'ACTIVE', points: 10, tiers: [{ id: 't1' }] },
  }))
  assert.deepEqual(figma.view.seasonCard(), {
    kind: 'content',
    title: '2026 年第四季度赛季',
    status: '进行中',
    points: '10 赛季点',
    titleField: '2026 年第四季度赛季',
    pointsField: 10,
    statusField: 'ACTIVE',
  })

  const java = await open(seasonApi({ data: { seasonId: 'SEASON_2026_Q4', points: 0, factCount: 0 } }))
  const card = java.view.seasonCard()
  assert.equal(card.kind, 'content')
  assert.equal(card.title, 'SEASON_2026_Q4')
  assert.equal(card.titleField, null)
  assert.equal(card.status, '状态待确认')
  assert.equal(card.statusField, 'UNKNOWN')
  assert.equal(card.points, '0 赛季点')
  assert.equal(card.pointsField, 0)
  assert.equal(java.refs.season.value.tierCount, 0)

  const idOnly = await open(seasonApi({ data: { seasonId: 'SEASON_2026_Q4' } }))
  const bare = idOnly.view.seasonCard()
  assert.equal(bare.title, 'SEASON_2026_Q4')
  assert.equal(bare.titleField, null)
  assert.equal(bare.points, null)
  assert.equal(bare.pointsField, null)
  assert.equal(bare.status, '状态待确认')
})

test('season 500 keeps other feeds and one retry issues one new GET', async () => {
  let failed = true
  const page = await open(seasonApi(() => {
    if (failed) {
      failed = false
      throw Object.assign(new Error('season unavailable'), { status: 500 })
    }
    return { data: { seasonId: 'SEASON_2026_Q4', points: 0, factCount: 0 } }
  }))
  assert.equal(page.view.seasonCard().kind, 'error')
  assert.equal(page.view.seasonCard().text, '赛季暂时无法读取。')
  assert.equal(page.refs.status.value, 'partial')
  assert.equal(page.refs.summary.value.xp, 20)
  assert.equal(page.refs.streak.value.currentStreak, 4)
  assert.equal(page.calls.season, 1)
  assert.deepEqual(page.calls.names.filter((name) => !name.startsWith('GET ')), [])
  page.test.retry()
  page.test.retry()
  for (let i = 0; i < 40; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (page.refs.status.value !== 'loading' && page.calls.season >= 2) break
  }
  assert.equal(page.calls.season, 2)
  assert.equal(page.calls.profile, 2)
  assert.equal(page.calls.streak, 2)
  assert.equal(page.calls.quests, 2)
  assert.equal(page.view.seasonCard().title, 'SEASON_2026_Q4')
  assert.equal(page.view.seasonCard().pointsField, 0)
  assert.deepEqual(page.calls.names.filter((name) => !name.startsWith('GET ')), [])
})

test('closed and unrecognized summaries issue no private reads', async () => {
  const closed = await open({
    getB4Profile: async (calls) => {
      calls.profile += 1
      calls.names.push('GET /gamification/me/summary')
      return { data: { subjectRef: 'learner-a', level: 1, featureEnabled: false } }
    },
  })
  assert.equal(closed.refs.status.value, 'closed')
  assert.equal(closed.view.statusText(), '成长世界暂未开放')
  assert.equal(closed.calls.profile, 1)
  assert.equal(closed.calls.streak, 0)
  assert.equal(closed.calls.quests, 0)
  assert.equal(closed.calls.season, 0)

  for (const body of [{ data: { unexpected: true } }, {}]) {
    const page = await open({
      getB4Profile: async (calls) => {
        calls.profile += 1
        calls.names.push('GET /gamification/me/summary')
        return body
      },
    })
    assert.equal(page.refs.summaryState.value, 'error')
    assert.equal(page.refs.status.value, 'error')
    assert.equal(page.view.statusText(), '成长记录暂时打不开。')
    assert.equal(page.calls.streak, 0)
    assert.equal(page.calls.quests, 0)
    assert.equal(page.calls.season, 0)
    assert.equal(page.refs.season.value, null)
    assert.notEqual(page.refs.seasonState.value, 'empty')
    page.test.retry()
    page.test.retry()
    for (let i = 0; i < 40; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (page.refs.status.value !== 'loading' && page.calls.profile >= 2) break
    }
    assert.equal(page.calls.profile, 2)
    assert.equal(page.calls.streak, 0)
    assert.equal(page.calls.quests, 0)
    assert.equal(page.calls.season, 0)
  }
})

test('an omitted feature flag still reads the other feeds', async () => {
  const page = await open({
    getB4Profile: async (calls) => {
      calls.profile += 1
      calls.names.push('GET /gamification/me/summary')
      return { data: { subjectRef: 'learner-a', level: 3, serverScore: 5 } }
    },
    ...seasonApi({ data: { seasonId: 'SEASON_2026_Q4', points: 0, factCount: 0 } }),
  })
  assert.equal(page.refs.summary.value.featureEnabled, null)
  assert.equal(page.calls.season, 1)
  assert.equal(page.calls.streak, 1)
  assert.equal(page.view.seasonCard().title, 'SEASON_2026_Q4')
})

test('one visible entry stays one batch when onShow repeats or the same owner revision moves before access settles', async () => {
  const gate = deferredWorld()
  const page = loadPage({
    getB4Profile: async (calls) => {
      calls.profile += 1
      calls.subjects.push(page.session.verifiedSubject)
      calls.names.push('GET /gamification/me/summary')
      return { data: { subjectRef: page.session.verifiedSubject, level: 2, serverScore: 20, featureEnabled: true, currentSeason: 'SEASON_2026_Q4' } }
    },
  })
  page.access.run = () => gate.promise.then(() => true)
  const first = page.shown[0]()
  await new Promise((resolve) => setTimeout(resolve, 0))
  page.shown[0]()
  page.session.identityRevision += 1
  await new Promise((resolve) => setTimeout(resolve, 0))
  gate.resolve(true)
  await first
  await untilSettled(page, (item) => item.calls.profile >= 1 && item.calls.season >= 1)
  assert.equal(page.calls.profile, 1)
  assert.equal(page.calls.streak, 1)
  assert.equal(page.calls.quests, 1)
  assert.equal(page.calls.season, 1)
  assert.equal(page.refs.summary.value.subjectRef, 'learner-a')
  page.shown[0]()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(page.calls.profile, 1)
  assert.equal(page.calls.season, 1)
  page.test.retry()
  page.test.retry()
  await untilSettled(page, (item) => item.calls.season >= 2)
  assert.equal(page.calls.profile, 2)
  assert.equal(page.calls.streak, 2)
  assert.equal(page.calls.quests, 2)
  assert.equal(page.calls.season, 2)
})

test('a changed owner before access settles paints one new batch and no old owner', async () => {
  const gate = deferredWorld()
  const page = loadPage({
    getB4Profile: async (calls) => {
      calls.profile += 1
      calls.subjects.push(page.session.verifiedSubject)
      calls.names.push('GET /gamification/me/summary')
      return { data: { subjectRef: page.session.verifiedSubject, level: 2, serverScore: 20, featureEnabled: true, currentSeason: 'SEASON_2026_Q4' } }
    },
  })
  page.access.run = () => gate.promise.then(() => true)
  const first = page.shown[0]()
  await new Promise((resolve) => setTimeout(resolve, 0))
  page.session.verifiedSubject = 'learner-b'
  page.session.identityRevision += 1
  await new Promise((resolve) => setTimeout(resolve, 0))
  gate.resolve(true)
  await first
  await untilSettled(page, (item) => item.calls.profile >= 1)
  assert.deepEqual(page.calls.subjects, ['learner-b'])
  assert.equal(page.calls.profile, 1)
  assert.equal(page.calls.season, 1)
  assert.equal(page.refs.summary.value.subjectRef, 'learner-b')
  assert.equal(page.refs.status.value, 'ready')
})

test('leaving the route before load, without onHide, issues no private read and a later show is one batch', async () => {
  const route = routeBox()
  try {
    const gate = deferredWorld()
    const page = loadPage()
    route.hash('#/pages/world/world')
    page.access.run = () => gate.promise.then(() => true)
    const first = page.shown[0]()
    await new Promise((resolve) => setTimeout(resolve, 0))
    route.hash('#/pages/login/login')
    gate.resolve(true)
    await first
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(page.calls.profile, 0)
    assert.equal(page.calls.streak, 0)
    assert.equal(page.calls.quests, 0)
    assert.equal(page.calls.season, 0)
    assert.equal(page.refs.summary.value, null)
    assert.equal(page.refs.season.value, null)
    route.hash('#/pages/world/world')
    page.shown[0]()
    await untilSettled(page, (item) => item.calls.season >= 1)
    assert.equal(page.calls.profile, 1)
    assert.equal(page.calls.season, 1)
    assert.equal(page.refs.status.value, 'ready')
  } finally {
    route.restore()
  }
})

test('native top page change and manual hide both block the held read', async () => {
  const route = routeBox()
  try {
    const gate = deferredWorld()
    const page = loadPage()
    route.pages(['pages/world/world'])
    page.access.run = () => gate.promise.then(() => true)
    const first = page.shown[0]()
    await new Promise((resolve) => setTimeout(resolve, 0))
    route.pages(['pages/profile/profile'])
    gate.resolve(true)
    await first
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(page.calls.profile, 0)
    assert.equal(page.calls.season, 0)
    assert.equal(page.refs.season.value, null)

    route.restore()
    const hiddenGate = deferredWorld()
    const hidden = loadPage()
    hidden.access.run = () => hiddenGate.promise.then(() => true)
    const shown = hidden.shown[0]()
    await new Promise((resolve) => setTimeout(resolve, 0))
    hidden.hidden[0]()
    hiddenGate.resolve(true)
    await shown
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(hidden.calls.profile, 0)
    assert.equal(hidden.calls.streak, 0)
    assert.equal(hidden.calls.quests, 0)
    assert.equal(hidden.calls.season, 0)
    assert.equal(globalThis.window, undefined)
    assert.equal(globalThis.getCurrentPages, undefined)
  } finally {
    route.restore()
  }
})

function deferredWorld() {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

test('season 403 stays a permission failure and does not look empty', async () => {
  const page = await open(seasonApi(() => {
    throw Object.assign(new Error('forbidden'), { status: 403 })
  }))
  assert.equal(page.refs.accessBlocked.value, true)
  assert.equal(page.refs.status.value, 'permission')
  assert.equal(page.refs.seasonState.value, 'error')
  assert.equal(page.refs.season.value, null)
  assert.notEqual(page.view.seasonCard().text, '当前暂无赛季活动。')
})
