import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const appRoot = path.join(repoRoot, 'apps/mobile')
const publicationPath = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/practice-publication.json'
const req = createRequire(path.join(appRoot, 'package.json'))
const vue = req('vue')
const { parse, compileTemplate } = req('@vue/compiler-sfc')
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8')
const sha256 = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, relative))).digest('hex')

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
  const publication = JSON.parse(fs.readFileSync(publicationPath, 'utf8'))
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
  for (const file of publication.files) {
    const actual = sha256(file.relative)
    if (file.relative.endsWith('/practice-page.ts') || file.relative.endsWith('/legacy-practice-page.ts')) {
      assert.notEqual(actual, file.sha256, `${file.relative} is still the empty stub`)
      assert.doesNotMatch(read(file.relative), /return en \? \{\} : \{\}/)
    } else {
      assert.equal(actual, file.sha256, file.relative)
    }
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
