import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const pagePath = 'src/pages/b4-games/b4-games.vue'

function loadPage({ authenticated = true } = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'Missing B4 games page script setup')
  const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1] ?? ''
  const calls = {
    navigate: [],
    restore: 0,
    loadWorld: 0,
    pause: 0,
    resume: 0,
    refresh: 0,
    finish: 0,
    sync: 0,
    performance: [],
    ensure: [],
  }
  const session = {
    isAuthenticated: authenticated,
    verifiedSubject: 'subject-1',
    identityRevision: 1,
    async restore() { calls.restore += 1 },
  }
  const runtime = { navigateTo(options) { calls.navigate.push(options.url) } }
  const b4 = {
    status: 'ready',
    online: true,
    lastError: null,
    games: [],
    activeGame: null,
    lastGameResult: null,
    queueCount: 0,
    performanceLevel: 'High',
    restore() {},
    loadWorld() { calls.loadWorld += 1; return Promise.resolve() },
    setPerformance(level) { calls.performance.push(level); b4.performanceLevel = level },
    pauseGame() { calls.pause += 1; return Promise.resolve() },
    resumeGame() { calls.resume += 1; return Promise.resolve() },
    refreshGame() { calls.refresh += 1; return Promise.resolve() },
    finishGame() { calls.finish += 1; return Promise.resolve() },
    syncOffline() { calls.sync += 1; return Promise.resolve() },
  }
  const mounted = []
  const modules = {
    vue: {
      ref: (value) => ({ value }),
      computed: (getter) => ({ get value() { return getter() } }),
      watch: () => () => {},
    },
    '@dcloudio/uni-app': { onShow: (callback) => mounted.push(callback) },
    '@englishflow/i18n': {
      interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? `{${key}}`)),
    },
    '../../components/MobilePageHeader.vue': {},
    '../../platform/experience': {
      mobileT: (key) => `mobile.${key}`,
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
    },
    '../../domain/b4': { B4_PERFORMANCE_LEVELS: ['Ultra', 'High', 'Medium', 'Performance'] },
    '../../auth/navigation': { ensureMobilePageAccess: async (target) => { calls.ensure.push(target); return authenticated } },
    '../../platform/uni-runtime': { getUniRuntime: () => runtime },
    '../../platform/b10-foundation': { b10ThemeMode: { value: 'light' } },
    '../../stores/session': { useSessionStore: () => session },
    '../../stores/b4': { useB4Store: () => b4 },
  }
  const names = ['primaryAction', 'recover', 'selectPerformance', 'syncQueue', 'openPractice', 'openLogin', 'dismissSettlement']
  const refs = ['stateName', 'showCatalog', 'showEmpty', 'showSettlement', 'showLoading', 'showFailed', 'showIntro', 'showBottomCta', 'isPaused', 'settlementDismissed', 'queueLabel', 'qualityIndex']
  const exported = `${script}\nexport const __test = { ${names.join(', ')} };\nexport const __refs = { ${refs.join(', ')} };\n`
  const compiled = ts.transpileModule(exported, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
    return modules[name]
  }, module, module.exports)
  return {
    source,
    template,
    calls,
    session,
    b4,
    mounted,
    test: module.exports.__test ?? {},
    refs: module.exports.__refs ?? {},
  }
}

test('B4 games reloads the protected world each time the page is shown again', async () => {
  const page = loadPage()
  assert.equal(page.mounted.length, 1)
  await page.mounted[0]()
  await page.mounted[0]()
  assert.equal(page.calls.restore, 2)
  assert.equal(page.calls.loadWorld, 2)
  assert.deepEqual(page.calls.ensure, ['/pages/b4-games/b4-games', '/pages/b4-games/b4-games'])
  assert.equal(page.source.includes('void b4.loadWorld()'), true)
})

test('B4 games uses the shared guard and does not load the world when access is denied', async () => {
  const page = loadPage({ authenticated: false })
  const show = page.source.slice(page.source.indexOf('onShow('), page.source.indexOf('function gameTitle'))
  assert.match(show, /ensureMobilePageAccess\('\/pages\/b4-games\/b4-games'\)/)
  assert.equal(show.includes('navigateTo'), false)
  await page.mounted[0]()
  assert.deepEqual(page.calls.ensure, ['/pages/b4-games/b4-games'])
  assert.deepEqual(page.calls.navigate, [])
  assert.equal(page.calls.loadWorld, 0)
  assert.equal(page.calls.restore, 1)
})

test('B4 games maps loading, error, catalog, empty, active and settlement states to store facts', () => {
  const page = loadPage()
  assert.equal(page.refs.stateName.value, 'empty')

  page.b4.status = 'loading'
  assert.equal(page.refs.stateName.value, 'loading')
  page.b4.status = 'permission'
  assert.equal(page.refs.stateName.value, 'error')

  page.b4.status = 'ready'
  page.b4.games = [{ gameCode: 'SENTENCE_TRAIN', enabled: false }]
  assert.equal(page.refs.stateName.value, 'catalog')

  page.b4.games = []
  assert.equal(page.refs.stateName.value, 'empty')

  page.b4.activeGame = { gameCode: 'SENTENCE_TRAIN', status: 'IN_PROGRESS', attemptCount: 3, challenges: [] }
  assert.equal(page.refs.stateName.value, 'active-no-items')
  page.b4.activeGame.status = 'PAUSED'
  assert.equal(page.refs.stateName.value, 'paused-no-items')
  assert.equal(page.refs.isPaused.value, true)

  page.b4.activeGame = null
  page.b4.games = [{ gameCode: 'SENTENCE_TRAIN', enabled: false }]
  page.b4.lastGameResult = { passed: true, accuracyPercent: 86, completionPercent: 100, serverScore: 860, rewardEligible: true }
  assert.equal(page.refs.stateName.value, 'settlement')
  page.test.dismissSettlement()
  assert.equal(page.refs.stateName.value, 'catalog')
})

test('B4 games keeps progress and settlement actions wired to the store only', () => {
  const page = loadPage()
  page.b4.games = [{ gameCode: 'SENTENCE_TRAIN', enabled: false }]
  page.b4.activeGame = { gameCode: 'SENTENCE_TRAIN', status: 'PAUSED', attemptCount: 3, challenges: [] }
  page.test.primaryAction()
  assert.equal(page.calls.resume, 1)
  page.b4.activeGame.status = 'IN_PROGRESS'
  page.test.primaryAction()
  assert.equal(page.calls.refresh, 1)

  page.b4.activeGame = null
  page.b4.lastGameResult = { passed: true, accuracyPercent: 86, completionPercent: 100, serverScore: 860, rewardEligible: true }
  page.test.dismissSettlement()
  page.test.openPractice()
  assert.deepEqual(page.calls.navigate, ['/pages/practice/practice'])

  page.test.selectPerformance({ detail: { value: 2 } })
  assert.deepEqual(page.calls.performance, ['Medium'])
  page.test.syncQueue()
  assert.equal(page.calls.sync, 1)

  page.b4.status = 'permission'
  page.test.recover()
  assert.deepEqual(page.calls.navigate, ['/pages/practice/practice', '/pages/login/login'])
  page.b4.status = 'error'
  page.test.recover()
  assert.equal(page.calls.loadWorld, 1)

  assert.match(page.template, /@click="b4\.pauseGame"/u)
  assert.match(page.template, /@click="b4\.resumeGame"/u)
  assert.match(page.template, /@click="b4\.refreshGame"/u)
  assert.match(page.template, /@click="b4\.finishGame"/u)
  assert.match(page.template, /b4\.lastGameResult\?\.accuracyPercent/u)
  assert.match(page.template, /b4\.lastGameResult\?\.completionPercent/u)
  assert.match(page.template, /b4\.lastGameResult\?\.serverScore/u)
  assert.match(page.template, /b4\.lastGameResult\?\.rewardEligible/u)
  assert.doesNotMatch(page.template, /startGame|开始游戏/u)
  assert.doesNotMatch(page.template, /I like reading|books every day/u)
  assert.doesNotMatch(page.template, />86%<|>100%<|>860</u)
})
