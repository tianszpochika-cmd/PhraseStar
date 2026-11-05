import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const pagePath = 'src/pages/today/today.vue'
const helperPath = 'src/pages/today/today-view.ts'
const req = createRequire(path.join(appRoot, 'package.json'))
const vue = req('vue')

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function loadPage({ allowed = true, hash = '' } = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script)
  const calls = { ensure: 0, loadHome: 0, navigate: [], tabs: [] }
  let resolveGate = () => {}
  const gate = typeof allowed === 'boolean'
    ? Promise.resolve(allowed)
    : new Promise((resolve) => { resolveGate = resolve })
  const session = vue.reactive({ identityRevision: 1, isAuthenticated: true, verifiedSubject: 'subject-a' })
  const store = vue.reactive({
    homeStatus: 'idle',
    planQueueStatus: 'idle',
    home: null,
    planQueue: null,
    planNotice: null,
    loadHome: async () => { calls.loadHome += 1 },
  })
  const shown = []
  const hidden = []
  const unmounted = []
  globalThis.window = { location: { hash } }
  const helper = load(helperPath, {})
  const plan = load('src/domain/plan-today.ts', {})
  const modules = {
    vue: { ...vue, onUnmounted: (callback) => unmounted.push(callback) },
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback), onHide: (callback) => hidden.push(callback) },
    '@englishflow/i18n': { interpolate: (message, values = {}) => String(message).replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? '')) },
    '../../components/MobilePageHeader.vue': {},
    '../../platform/experience': {
      mobileT: (key) => `mobile.${key}`,
      backMobile: () => { calls.navigate.push('back') },
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'full' }),
    },
    '../../platform/uni-runtime': {
      getUniRuntime: () => ({ switchTab: ({ url }) => { calls.tabs.push(url) } }),
      openUniPage: (url) => { calls.navigate.push(url) },
    },
    '../../auth/navigation': { ensureMobilePageAccess: async (target) => { calls.ensure += 1; calls.target = target; return gate } },
    '../../domain/plan-today': plan,
    '../../stores/learner-content': { useLearnerContentStore: () => store },
    '../../stores/session': { useSessionStore: () => session },
    './today-view': helper,
  }
  const exported = `${script}\nexport const __refs = { visual, design, frame, measured, summary, launchTask, message };\nexport const __test = { viewTask, backHome, openPlanEmpty };\n`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const scope = vue.effectScope()
  const module = scope.run(() => {
    const current = { exports: {} }
    new Function('require', 'module', 'exports', compiled)((name) => {
      if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
      return modules[name]
    }, current, current.exports)
    return current
  })
  return { source, calls, session, store, shown, hidden, unmounted, resolveGate, scope, refs: module.exports.__refs, test: module.exports.__test }
}

test('today helper reads the route, launches only a real content pointer, and measures only confirmed minutes', () => {
  const helper = load(helperPath, {})
  const previousWindow = globalThis.window
  const previousPages = globalThis.getCurrentPages
  try {
    globalThis.window = { location: { hash: '' } }
    delete globalThis.getCurrentPages
    assert.equal(helper.observedTopPath(), null)
    assert.equal(helper.routeStillToday(), true)
    globalThis.window = { location: { hash: '#/pages/home/home?from=today' } }
    assert.equal(helper.routeStillToday(), false)
    globalThis.window = { location: { hash: '#/pages/today/today?task=1' } }
    assert.equal(helper.routeStillToday(), true)
    const blank = { id: 'blank', status: 'AVAILABLE', contentCode: '  ', practiceRef: 'dropped-ref' }
    assert.equal(helper.canLaunchTask(blank), false)
    assert.equal(helper.launchUrl(blank), null)
    const live = { id: 'live', status: 'IN_PROGRESS', contentCode: 'live-1' }
    assert.equal(helper.launchUrl(live), '/pages/learn/learn?contentCode=live-1&taskId=live')
    assert.equal(helper.progressFacts(null), null)
    assert.equal(helper.progressFacts({ stale: true, targetMinutes: 20, completedMinutes: 8 }), null)
    assert.equal(helper.progressFacts({ stale: false, targetMinutes: 0, completedMinutes: 8 }), null)
    assert.deepEqual(helper.progressFacts({ stale: false, targetMinutes: 20, completedMinutes: 8 }), { percent: 40, remaining: 12, target: 20, done: 8 })
    assert.equal(helper.confirmedDeferredCount('loading', 2), null)
    assert.equal(helper.confirmedDeferredCount('ready', 2), 2)
    assert.equal(helper.todayVisual({ homeStatus: 'offline', planStatus: 'empty', taskCount: 0, emptyReason: 'NO_PLAN' }), 'offline')
    assert.equal(helper.todayVisual({ homeStatus: 'error', planStatus: 'empty', taskCount: 0, emptyReason: null }), 'error')
    assert.equal(helper.todayVisual({ homeStatus: 'forbidden', planStatus: 'idle', taskCount: 0, emptyReason: null }), 'forbidden')
    assert.equal(helper.todayVisual({ homeStatus: 'ready', planStatus: 'loading', taskCount: 2, emptyReason: null }), 'ready')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'error', taskCount: 0, emptyReason: null }), 'plan-failed')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'empty', taskCount: 0, emptyReason: 'NO_PLAN' }), 'no-plan')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'empty', taskCount: 0, emptyReason: 'COMPLETED' }), 'completed')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'empty', taskCount: 0, emptyReason: 'NO_CONTENT' }), 'no-content')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'empty', taskCount: 0, emptyReason: 'NO_DUE_REVIEW' }), 'no-due')
    assert.equal(helper.todayVisual({ homeStatus: 'empty', planStatus: 'empty', taskCount: 0, emptyReason: null }), 'no-tasks')
    assert.equal(helper.frameAssets('offline').mascot.endsWith('/figma-today-355-5246/30fb0de0-e94b-4e24-9146-d82488c588f2.svg'), true)
    assert.equal(helper.frameAssets('error').glow.endsWith('/figma-today-355-5315/912fb261-3612-4e6f-b5a1-dc9136b1cacd.svg'), true)
    assert.equal(helper.frameAssets('forbidden').chev.endsWith('/figma-today-355-5453/0bdb70d3-3c91-4809-b937-c8ec6361efad.svg'), true)
    assert.equal(helper.frameAssets('no-plan').calendar.endsWith('/figma-today-166-11635/6497d25f-361a-4dc5-b0db-6a68b7de1f8e.svg'), true)
    assert.equal(JSON.stringify(helper.TODAY_ASSETS).includes('355-5384'), false)
    assert.equal(JSON.stringify(helper.TODAY_ASSETS).includes('7fa481fd'), false)
  } finally {
    globalThis.window = previousWindow
    globalThis.getCurrentPages = previousPages
  }
})

test('today page keeps the gate in front of the read and does not launch a blank pointer', async () => {
  const denied = loadPage({ allowed: false })
  await denied.shown[0]()
  assert.equal(denied.calls.ensure, 1)
  assert.equal(denied.calls.target, '/pages/today/today')
  assert.equal(denied.calls.loadHome, 0)
  denied.scope.stop()

  const held = loadPage({ allowed: null })
  const pending = held.shown[0]()
  await flush()
  held.hidden[0]()
  held.resolveGate(true)
  await pending
  await flush()
  assert.equal(held.calls.loadHome, 0)
  held.scope.stop()

  const away = loadPage({ hash: '#/pages/home/home' })
  await away.shown[0]()
  assert.equal(away.calls.ensure, 0)
  assert.equal(away.calls.loadHome, 0)
  away.scope.stop()

  const page = loadPage()
  await page.shown[0]()
  await flush()
  assert.equal(page.calls.loadHome, 1)
  page.store.homeStatus = 'ready'
  page.store.planQueueStatus = 'ready'
  page.store.planQueue = { emptyReason: 'READY', deferredCount: 2, explanation: null, firstLearning: null, arrangements: [], algorithmVersion: 'SM2_Q03_V1' }
  page.store.home = {
    stale: false,
    targetMinutes: 20,
    completedMinutes: 8,
    tasks: [
      { id: 'done', status: 'COMPLETED', title: '问候复习', minutes: 5, contentCode: 'greet' },
      { id: 'live', status: 'IN_PROGRESS', title: '服务端进行中的课', minutes: 8, contentCode: 'live-1' },
      { id: 'blank', status: 'AVAILABLE', title: '没有内容指针', minutes: 4, contentCode: ' ' },
    ],
  }
  await flush()
  assert.equal(page.refs.visual.value, 'ready')
  assert.equal(page.refs.measured.value.percent, 40)
  assert.equal(page.refs.summary.value, 'mobile.todayPage.remaining；mobile.todayPage.deferred')
  assert.equal(page.refs.launchTask.value.id, 'live')
  page.test.viewTask(page.store.home.tasks[2])
  page.test.viewTask(page.store.home.tasks[1])
  assert.deepEqual(page.calls.navigate, ['/pages/learn/learn?contentCode=live-1&taskId=live'])
  page.session.identityRevision += 1
  await flush()
  assert.equal(page.calls.loadHome, 2)
  page.scope.stop()
})

test('today source keeps the catalog and empty pins and does not mount the login frame', () => {
  const vueSource = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const helperSource = fs.readFileSync(path.join(appRoot, helperPath), 'utf8')
  const copySource = fs.readFileSync(path.join(repoRoot, 'packages/i18n/src/mobile-resources/today-page.ts'), 'utf8')
  const storeSource = fs.readFileSync(path.join(appRoot, 'src/stores/learner-content.ts'), 'utf8')
  assert.equal((vueSource.match(/ensureMobilePageAccess\('/g) ?? []).length, 1)
  assert.match(vueSource, /ensureMobilePageAccess\('\/pages\/today\/today'\)/)
  assert.match(vueSource, /store\.loadHome\(\)/)
  assert.match(vueSource, /viewTask\(task\)/)
  assert.doesNotMatch(vueSource, /store\.completeTask\(/)
  assert.match(vueSource, /store\.homeStatus === 'unavailable'[\s\S]*?role="status"/)
  assert.match(vueSource, /课程列表暂不可用/)
  assert.match(vueSource, /@click="store\.loadHome\(\)"/)
  assert.match(vueSource, /v-if="store\.home && !store\.home\.tasks\.length" class="empty">今天还没有安排任务。/)
  assert.match(vueSource, /v-for="task in store\.home\?\.tasks"/)
  assert.doesNotMatch(vueSource, /contentStatus === 'UNAVAILABLE'.*课程暂时不可用/)
  assert.doesNotMatch(`${vueSource}\n${helperSource}`, /355-5384|登录状态已失效|一般现在时|去做定级测评|67%|store\.progress|7fa481fd|网络已断开|SM2_Q03_V1/)
  assert.match(vueSource, /data-algorithm-version/)
  assert.match(vueSource, /\.today-ready \{[^}]*gap: 16px/)
  assert.match(vueSource, /\.today-cta \{[^}]*min-height: 44px/)
  assert.match(vueSource, /\.today-cta \{[^}]*line-height: 1\.5/)
  assert.match(vueSource, /\.today-cta \{[^}]*var\(--v2-grad\)/)
  assert.match(vueSource, /\.today-cta::after \{[^}]*border: 0/)
  assert.match(vueSource, /\.mobile-back\)::after \{[^}]*border: 0/)
  assert.doesNotMatch(vueSource, /position:\s*(sticky|fixed)/)
  assert.match(vueSource, /calc\(30px \+ env\(safe-area-inset-bottom\)\)/)
  assert.match(copySource, /offlineTitle: '今日任务暂时无法读取'/)
  assert.match(storeSource, /homeStatus\.value = 'offline'/)
  assert.doesNotMatch(storeSource, /homeStatus\.value = 'error'/)
  const helper = load(helperPath, {})
  for (const asset of Object.values(helper.TODAY_ASSETS)) {
    assert.equal(fs.existsSync(path.join(appRoot, 'src', asset.slice(1))), true, asset)
  }
  for (const asset of [
    'src/static/figma-today-355-5384/d7bc5516-cdd8-4a2b-9e0a-f261da7c3051.svg',
    'src/static/figma-today-355-5384/3811e537-8ab8-49e6-8d31-ac63b800c0ae.svg',
    'src/static/figma-today-355-5384/9c7e1df4-24e4-438b-aa3b-61fe645e1bca.svg',
  ]) {
    assert.equal(fs.existsSync(path.join(appRoot, asset)), true, asset)
  }
})
