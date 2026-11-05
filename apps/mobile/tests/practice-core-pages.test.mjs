import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const appRoot = path.join(repoRoot, 'apps/mobile')
const req = createRequire(path.join(appRoot, 'package.json'))
const vue = req('vue')
const { parse, compileTemplate } = req('@vue/compiler-sfc')
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8')
const sha256 = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relative))).digest('hex')

const PRACTICE_SVG_SHA256 = {
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/f3b4e192-cee4-4253-8f13-8fa8c92b6992.svg': '819512d1511baad55921d73af858aa02dbc9ce4967beda5430ec1c1a3d1c453c',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/6ced3a16-0487-445c-a872-4b76848a705f.svg': 'aba4c22d8caec9aa7e66d74ea7c71c71693748c82177ede9cc09d225de9daeae',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/add2c580-5ceb-485a-8f65-77873f3651b9.svg': '0524de650187a8c541f94e820606e5c185f8af8736d0b42dbb8a579b5a3c35ae',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/03dd37eb-95fb-47a0-80b3-4aa1394e0f2d.svg': '619ec98870e3000ed76f55872af1805521edba288d36998dd1165a572bc94d69',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/84c069ed-a1ee-471b-be7a-65178d10e515.svg': '73af029af96053c3fb6d80fa31e7b075cec99b2b92b808bb9720a7c8d3c18bad',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/aec7d4b8-83b2-40af-ae6b-5f21e1a51dd5.svg': 'b9db54f8b47a312600a4263a8e49ee042280a048d5727f44729f52154a580a20',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/1b033e60-bd08-475b-8d93-c5aaec006bc4.svg': 'bf42fb6a37a2ddf539e6314b11e1bbe42605ffb2326001838927e1ab2aba0ecb',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/e95a8a4c-d6d2-4e79-a269-7bccb93b11c5.svg': '404a3754c7054e96443c359a9846af71a63d9040081e22e72480910f475bb141',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/e03b706c-0677-415d-81f2-6d4ef9441f0d.svg': '80f2e7e311c11871771d523ff73650bfcebfa95c099c91d7a56e34e30acacf1e',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/33ee40cc-5218-47f7-a47a-dce6d42d6b11.svg': '2c64a1a2eb56e44bb1430f99a57ec149a5551efbc7429490ec358648e2774e11',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/077ccc78-a51f-428d-b0c4-200338e1619d.svg': 'aa00e11698cf49549238cd8e0e3a3a811411ae29d0e2ccc5e27165490cc28e26',
  'apps/mobile/src/static/figma-practice-core/practice-hub-167-4008/28489a76-1d1c-45ac-9249-14590fa12965.svg': '38b284122373050681d51af4065e7b00cba1d60f84a9e511db804b8998ff3dd4',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/397a0e7c-11ea-484c-b1f0-fe1385096df2.svg': 'dcc19980d7024d5fbe7dfb2b6716c0df4bd38a197befdf212bdf3dd58ed25751',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/855cdefa-2dc7-4b82-82a0-64426fbc7293.svg': '13dc734fc1932cace14f44dacaca4c24730fe6d7abc2540c62e83b458b571497',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/741a70b6-f6a4-4991-aa48-b3710b4ef763.svg': 'd1b9bdd7baa91c7e7d33b80a06709f8b6623a78225e9b61f3bc65f7f2c8fe226',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/30313a8e-dc17-4dda-be08-c9e542c92f4a.svg': '404a3754c7054e96443c359a9846af71a63d9040081e22e72480910f475bb141',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/c373e119-ee84-4cd7-8139-65db989e503e.svg': '7270a68f8b62609c2566cd002f534af2b725ecd80daa541de165eafe4a291eb1',
  'apps/mobile/src/static/figma-practice-core/practice-legacy-167-5317/a99dacf5-be89-4544-b38b-2af9e40ecec8.svg': 'e796f8c53f909921e710cd574a39e5fd29abcf1aa2301334f04239b5514909db',
  'apps/mobile/src/static/figma-practice-core/practice-dark-offline-270-3004/a1983f1f-bd1f-459a-b997-caf66ba0137e.svg': '7a5d56ddfca4704b73df47e598000f374d48a612e6a16ec7c41c60cc340faf8f',
  'apps/mobile/src/static/figma-practice-core/practice-dark-offline-270-3004/619cb08d-1a66-4bfb-a20a-6841b39f7c8f.svg': '39daf43336618a061d90340b0ab4a0a959d061ad13e748f043ccdded5d92a5d7',
}

const OPEN_SKILLS = ['b2-vocabulary', 'b3-grammar', 'b11-reading']
const CLOSED_SKILLS = ['b3-listening', 'b3-speaking']
const OPEN_ENTRIES = ['assessment', 'b10-report', 'b3-reading']
const CLOSED_ENTRIES = ['b3-listening', 'b3-speaking']
const EMPTY_ROUTES = ['b2-vocabulary', 'b11-reading', 'b3-grammar']
const ENGINE_COPY = ['练习状态', '规则命中', '需要修复', '加载中', '本次练习已完成。']

function compileView(filename, source) {
  const parsed = parse(source, { filename })
  assert.deepEqual(parsed.errors, [], `${filename} parse errors`)
  const compiled = compileTemplate({ source: parsed.descriptor.template.content, filename, id: filename })
  assert.deepEqual(compiled.errors.map(String), [], `${filename} template errors`)
  return { template: parsed.descriptor.template.content, code: compiled.code }
}

function visibleCopy(template) {
  return template.replace(/\{\{[\s\S]*?\}\}/g, ' ')
}

function loadModule(relative) {
  const compiled = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relative}`)
  }, module, module.exports)
  return module.exports
}

function compilePage(relative, modules, names, refs) {
  const source = read(relative)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, `missing script in ${relative}`)
  const exported = `${script}\nexport const __test = { ${names.join(', ')} }\nexport const __refs = { ${refs.join(', ')} }\n`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relative}`)
    return modules[name]
  }, module, module.exports)
  return { source, test: module.exports.__test, refs: module.exports.__refs }
}

function hubPage() {
  const calls = { ensure: 0, navigate: [] }
  const shown = []
  const page = compilePage('apps/mobile/src/pages/practice/practice.vue', {
    vue,
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback) },
    '@englishflow/i18n': { interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? `{${key}}`)) },
    '../../components/MobilePageHeader.vue': {},
    '../../auth/navigation': { ensureMobilePageAccess: async () => { calls.ensure += 1; return true } },
    '../../platform/experience': { mobileT: (key) => key, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }) },
    '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light') },
    '../../platform/uni-runtime': { openUniPage: (url) => { calls.navigate.push(url) } },
  }, ['openHubTarget'], [])
  return { ...page, calls, shown }
}

function legacyPage({ allowed = true } = {}) {
  const calls = { ensure: 0, load: 0, submit: 0, checkpoint: 0, complete: 0, navigate: [], report: [] }
  const shown = []
  const store = vue.reactive({
    practiceStatus: 'idle',
    practiceMessage: null,
    practice: null,
    answerResults: {},
    async loadPractice() { calls.load += 1 },
    async submitAnswer() {
      calls.submit += 1
      return { isCorrect: true, scoringStatus: 'SCORED', savedReceipt: '已保存', feedbackText: '正确', nextQuestion: '下一题：第 2 题', scoreBucket: 'FULL' }
    },
    async saveCheckpoint() { calls.checkpoint += 1 },
    async completePractice() { calls.complete += 1 },
  })
  const session = vue.reactive({ identityRevision: 1, isAuthenticated: allowed })
  const page = compilePage('apps/mobile/src/pages/b2-practice/b2-practice.vue', {
    vue: { ...vue, onUnmounted: (callback) => { callback?.dispose?.() } },
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback) },
    '@englishflow/performance': { createAdaptivePerformanceEngine: () => ({ level: 'High', setLevel() {}, dispose() {} }) },
    '../../components/MobilePageHeader.vue': {},
    '../../components/AppIcon.vue': {},
    '../../components/b10/B10ExerciseCard.vue': {},
    '../../components/b10/B10StatusPanel.vue': {},
    '../../domain/practice-loop': loadModule('apps/mobile/src/domain/practice-loop.ts'),
    '../../auth/navigation': { ensureMobilePageAccess: async () => { calls.ensure += 1; return allowed } },
    '../../platform/experience': { mobileT: (key) => key, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }) },
    '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light'), b10T: (key) => key },
    '../../stores/b10-learning': { useB10LearningStore: () => store },
    '../../platform/uni-runtime': {
      openUniPage: (url) => { calls.navigate.push(url) },
      getUniRuntime: () => ({ navigateTo: (options) => { calls.report.push(options.url) } }),
    },
    '../../stores/session': { useSessionStore: () => session },
  }, ['answer', 'checkpoint', 'openReport', 'openLegacyAlternative', 'retryLegacyLoad', 'backLegacyHome', 'reopenLegacyAccess'], ['accessGranted', 'viewState', 'authKind', 'answerFeedback'])
  return { ...page, calls, shown, store }
}

function assertNoWrites(page) {
  assert.equal(page.calls.load, 0)
  assert.equal(page.calls.submit, 0)
  assert.equal(page.calls.checkpoint, 0)
  assert.equal(page.calls.complete, 0)
  assert.deepEqual(page.calls.report, [])
}

test('published practice copy is populated in the mobile namespace and assets stay exact', () => {
  const practice = loadModule('packages/i18n/src/mobile-resources/practice-page.ts')
  const legacy = loadModule('packages/i18n/src/mobile-resources/legacy-practice-page.ts')
  for (const locale of [false, true]) {
    assert.equal(Object.keys(practice.practicePageCopy(locale)).length > 0, true)
    assert.equal(Object.keys(legacy.legacyPracticePageCopy(locale)).length > 0, true)
  }
  assert.equal(practice.practicePageCopy(false).entryCount, '共 {count} 个练习入口')
  assert.equal(legacy.legacyPracticePageCopy(false).retiredTitle, '旧的综合练习已经下线')
  assert.equal(legacy.legacyPracticePageCopy(false).unavailableTitle, '练习暂时打不开')
  assert.equal(legacy.legacyPracticePageCopy(true).backHome, 'Back to home')
  const catalog = read('packages/i18n/src/mobile-experience.ts')
  assert.match(catalog, /practicePage: practicePageCopy\(false\)/)
  assert.match(catalog, /legacyPracticePage: legacyPracticePageCopy\(false\)/)
  assert.match(catalog, /practicePage: practicePageCopy\(true\)/)
  assert.match(catalog, /legacyPracticePage: legacyPracticePageCopy\(true\)/)
  assert.doesNotMatch(read('packages/i18n/src/mobile-resources/practice-page.ts'), /return en \? \{\} : \{\}/)
  assert.doesNotMatch(read('packages/i18n/src/mobile-resources/legacy-practice-page.ts'), /return en \? \{\} : \{\}/)
  const practiceAssets = Object.entries(PRACTICE_SVG_SHA256)
  assert.equal(practiceAssets.length, 20)
  for (const [relative, expected] of practiceAssets) {
    assert.equal(relative.startsWith('apps/mobile/src/static/figma-practice-core/'), true, relative)
    assert.equal(relative.endsWith('.svg'), true, relative)
    assert.equal(sha256(relative), expected, relative)
  }
})

test('practice hub template compiles and gates the registered route table', async () => {
  const source = read('apps/mobile/src/pages/practice/practice.vue')
  const pages = JSON.parse(read('apps/mobile/src/pages.json'))
  const registered = new Set(pages.pages.map((page) => page.path))
  const tabs = pages.tabBar.list.map((item) => item.pagePath)
  const view = compileView('practice.vue', source)
  assert.match(view.code, /openHubTarget/)
  assert.equal((source.match(/ensureMobilePageAccess\('/g) ?? []).length, 1)
  assert.match(source, /mobileT\('practicePage\.entryCount'\)/)
  assert.match(source, /mobileT\(`pages\.\$\{skill\.page\}\.short`\)/)
  assert.match(source, /mobileT\('closed\.comingSoon'\)/)
  assert.doesNotMatch(visibleCopy(view.template), /[\u4e00-\u9fff]/)
  assert.doesNotMatch(source, /MobileFeatureGrid|tabBar|\/pages\/login\/login/)
  assert.equal(registered.has('pages/practice/practice'), true)
  assert.equal(tabs.includes('pages/practice/practice'), false)
  assert.equal(tabs.includes('pages/b2-practice/b2-practice'), true)
  for (const page of [...OPEN_SKILLS, ...CLOSED_SKILLS, ...OPEN_ENTRIES]) assert.equal(registered.has(`pages/${page}/${page}`), true, page)
  const runtime = read('apps/mobile/src/platform/uni-runtime.ts')
  assert.match(runtime, /'\/pages\/home\/home'/)
  assert.match(runtime, /'\/pages\/b2-practice\/b2-practice'/)
  assert.doesNotMatch(runtime, /'\/pages\/b2-vocabulary\/b2-vocabulary'/)
  const page = hubPage()
  await page.shown[0]()
  assert.equal(page.calls.ensure, 1)
  for (const target of CLOSED_SKILLS) page.test.openHubTarget(target, 'skill')
  for (const target of CLOSED_ENTRIES) page.test.openHubTarget(target, 'entry')
  assert.deepEqual(page.calls.navigate, [])
  for (const target of OPEN_SKILLS) page.test.openHubTarget(target, 'skill')
  for (const target of OPEN_ENTRIES) page.test.openHubTarget(target, 'entry')
  assert.deepEqual(page.calls.navigate, [...OPEN_SKILLS, ...OPEN_ENTRIES].map((item) => `/pages/${item}/${item}`))
})

test('legacy empty, failure and forbidden states keep real practice callers closed', async () => {
  const source = read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const view = compileView('b2-practice.vue', source)
  assert.match(view.code, /openLegacyAlternative/)
  assert.match(view.code, /retryLegacyLoad/)
  assert.match(view.code, /reopenLegacyAccess/)
  assert.match(source, /mobileT\('legacyPracticePage\.retiredTitle'\)/)
  assert.match(source, /mobileT\('legacyPracticePage\.unavailableTitle'\)/)
  assert.match(source, /mobileT\('legacyPracticePage\.backHome'\)/)
  assert.match(source, /b10T\('status\.retry'\)/)
  assert.match(source, /b10T\('status\.forbidden'\)/)
  assert.match(source, /store\.practiceStatus === 'loading'/)
  assert.match(source, /store\.submitAnswer/)
  assert.match(source, /lastResult\?\.scoringStatus|lastResult\.scoringStatus/)
  assert.match(source, /data-save-receipt/)
  assert.match(source, /data-feedback-text/)
  assert.match(source, /data-next-question/)
  assert.match(source, /data-single-submit/)
  assert.match(source, /data-resume/)
  assert.match(source, /data-offline-exit/)
  assert.match(source, /data-reward-hidden/)
  assert.match(source, /acceptSubmission/)
  assert.match(source, /showPracticeReward/)
  assert.equal(source.includes('奖励'), false)
  assert.doesNotMatch(source, /\/pages\/login\/login|MobileFeatureGrid/)
  const outside = visibleCopy(view.template)
  for (const token of outside.match(/[\u4e00-\u9fff]+/g) ?? []) assert.equal(ENGINE_COPY.some((item) => item.includes(token)), true, token)
  for (const item of ENGINE_COPY) assert.equal(source.includes(item), true, item)
  const saved = source.indexOf('data-save-receipt')
  const words = source.indexOf('data-feedback-text')
  const next = source.indexOf('data-next-question')
  assert.ok(saved < words && words < next)

  const denied = legacyPage({ allowed: false })
  await denied.shown[0]()
  assert.equal(denied.refs.viewState.value, 'gate')
  await denied.test.reopenLegacyAccess()
  denied.test.openLegacyAlternative('b2-vocabulary')
  denied.test.retryLegacyLoad()
  denied.test.backLegacyHome()
  await denied.test.answer({ value: 'A' })
  denied.test.checkpoint()
  denied.test.openReport()
  assertNoWrites(denied)
  assert.deepEqual(denied.calls.navigate, [])

  const page = legacyPage({ allowed: true })
  page.refs.accessGranted.value = true
  page.store.practiceStatus = 'empty'
  page.store.practice = { exercises: [] }
  page.store.practiceMessage = '这个旧版练习入口的题组已下线，请从底部「练习」进入今天的练习。'
  assert.equal(page.refs.viewState.value, 'empty')
  page.test.openLegacyAlternative('b3-listening')
  page.test.openLegacyAlternative('b3-speaking')
  for (const route of EMPTY_ROUTES) page.test.openLegacyAlternative(route)
  page.test.retryLegacyLoad()
  page.test.backLegacyHome()
  await page.test.reopenLegacyAccess()
  await page.test.answer({ value: 'A' })
  page.test.checkpoint()
  page.test.openReport()
  assertNoWrites(page)
  assert.deepEqual(page.calls.navigate, EMPTY_ROUTES.map((route) => `/pages/${route}/${route}`))

  for (const [status, message, state] of [
    ['offline', '网络暂时不可用', 'unavailable'],
    ['error', '练习会话暂时无法创建。', 'unavailable'],
    ['stale', '内容版本已失效，请重新读取当前版本。', 'unavailable'],
  ]) {
    page.store.practice = null
    page.store.practiceStatus = status
    page.store.practiceMessage = message
    assert.equal(page.refs.viewState.value, state)
    assert.equal(page.store.practiceStatus, status)
    assert.equal(page.store.practiceMessage, message)
  }
  const writesBeforeRetry = page.calls.load
  page.test.backLegacyHome()
  page.test.retryLegacyLoad()
  assert.deepEqual(page.calls.navigate.at(-1), '/pages/home/home')
  assert.equal(page.calls.load, writesBeforeRetry + 1)
  assert.equal(page.calls.submit, 0)
  assert.equal(page.calls.checkpoint, 0)
  assert.equal(page.calls.complete, 0)

  page.refs.accessGranted.value = true
  page.store.practiceStatus = 'forbidden'
  page.store.practiceMessage = '请先登录后再继续学习。'
  page.store.practice = null
  assert.equal(page.refs.authKind.value, 'unauthorized')
  assert.equal(page.refs.viewState.value, 'unauthorized')
  const loadAt401 = page.calls.load
  await page.test.reopenLegacyAccess()
  page.test.retryLegacyLoad()
  await page.test.answer({ value: 'A' })
  page.test.checkpoint()
  page.test.openReport()
  assert.equal(page.calls.load, loadAt401)
  assert.equal(page.calls.submit, 0)
  assert.equal(page.calls.checkpoint, 0)

  page.refs.accessGranted.value = true
  page.store.practiceMessage = '当前账号不能打开这项练习。'
  assert.equal(page.refs.authKind.value, 'forbidden')
  assert.equal(page.refs.viewState.value, 'forbidden')
  await page.test.reopenLegacyAccess()
  assert.equal(page.calls.load, loadAt401)
  assert.equal(page.calls.complete, 0)
})

test('legacy exercise callers still submit, checkpoint and open the report', async () => {
  const page = legacyPage({ allowed: true })
  await page.shown[0]()
  assert.equal(page.calls.ensure, 1)
  assert.equal(page.calls.load, 1)
  assert.equal(page.refs.viewState.value, 'loading')
  page.store.practiceStatus = 'ready'
  page.store.practice = { exercises: [{ exerciseId: 7, questionType: 'SINGLE' }] }
  assert.equal(page.refs.viewState.value, 'exercise')
  await page.test.answer({ value: 'A' })
  page.test.checkpoint()
  assert.equal(page.calls.submit, 1)
  assert.equal(page.calls.checkpoint, 1)
  assert.equal(page.refs.answerFeedback.value.savedReceipt, '已保存')
  assert.equal(page.refs.answerFeedback.value.feedbackText, '正确')
  assert.equal(page.refs.answerFeedback.value.nextQuestion, '下一题：第 2 题')
  page.test.openLegacyAlternative('b2-vocabulary')
  page.test.retryLegacyLoad()
  assert.equal(page.calls.load, 1)
  assert.deepEqual(page.calls.navigate, [])
  page.store.answerResults['7'] = { scoringStatus: 'SCORED' }
  assert.equal(page.refs.viewState.value, 'finished')
  page.test.openReport()
  assert.deepEqual(page.calls.report, ['/pages/b10-report/b10-report'])
  page.store.practice = { exercises: [{ exerciseId: 7, questionType: 'SINGLE' }], contentOffline: true }
  assert.equal(page.refs.viewState.value, 'stopped')
  const loadAtStop = page.calls.load
  await page.test.answer({ value: 'A' })
  page.test.checkpoint()
  page.test.openReport()
  assert.equal(page.calls.load, loadAtStop)
  assert.equal(page.calls.submit, 1)
  assert.equal(page.calls.checkpoint, 1)
})
