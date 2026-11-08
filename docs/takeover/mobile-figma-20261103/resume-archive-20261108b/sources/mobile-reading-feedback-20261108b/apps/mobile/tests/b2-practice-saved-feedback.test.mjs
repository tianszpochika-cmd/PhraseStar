import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const appRoot = path.join(repoRoot, 'apps/mobile')
const req = createRequire(path.join(appRoot, 'package.json'))
const vue = req('vue')
const { parse, compileTemplate } = req('@vue/compiler-sfc')
const { renderToString } = req('vue/server-renderer')
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8')

function loadModule(relative) {
  const compiled = ts.transpileModule(read(relative), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relative}`)
  }, module, module.exports)
  return module.exports
}

function compilePage(store, { allowed = true, fail = false, omitReceipt = false } = {}) {
  const calls = { load: 0, submit: 0, checkpoint: 0, report: [] }
  const shown = []
  const source = read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'missing script')
  const exported = `${script}
export const __test = { answer, checkpoint, openReport }
export const __refs = { accessGranted, viewState, answerFeedback, lastResult, exercise, finished }
`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const quality = {
    level: 'High',
    state: { level: 'High' },
    subscribe(listener) {
      listener(this.state)
      return () => {}
    },
  }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      vue: { ...vue, onUnmounted() {} },
      '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback), onHide() {} },
      '../../components/MobilePageHeader.vue': {},
      '../../components/AppIcon.vue': {},
      '../../components/b10/B10ExerciseCard.vue': {},
      '../../components/b10/B10StatusPanel.vue': {},
      '../../domain/practice-loop': loadModule('apps/mobile/src/domain/practice-loop.ts'),
      '../../auth/navigation': { ensureMobilePageAccess: async () => allowed },
      '../../platform/experience': {
        mobileExperienceEngine: quality,
        setMobileQuality() {},
        mobileT: (key) => key,
        useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }),
      },
      '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light'), b10T: (key) => key },
      '../../stores/b10-learning': { useB10LearningStore: () => store },
      '../../platform/uni-runtime': {
        openUniPage() {},
        consumePendingNavigationQuery() { return {} },
        getUniRuntime: () => ({ navigateTo: (options) => { calls.report.push(options.url) } }),
      },
      '../../stores/session': { useSessionStore: () => vue.reactive({ identityRevision: 1, isAuthenticated: allowed }) },
    }
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  store._calls = calls
  store._submitImpl = async (exerciseId) => {
    calls.submit += 1
    if (fail) return null
    const result = {
      exerciseId,
      isCorrect: true,
      scoringStatus: 'SCORED',
      feedbackText: '正确',
      scoreBucket: 'FULL',
      nextQuestion: store.practice.exercises.length <= Object.keys(store.answerResults).length + 1 ? '本次练习已完成' : '下一题：第 2 题',
    }
    if (!omitReceipt) result.savedReceipt = '已保存'
    store.answerResults[String(exerciseId)] = result
    return result
  }
  if (!store.submitAnswer) {
    store.submitAnswer = (exerciseId, answer) => store._submitImpl(exerciseId, answer)
  }
  if (!store.saveCheckpoint) store.saveCheckpoint = async () => { calls.checkpoint += 1 }
  if (!store.loadPractice) store.loadPractice = async () => { calls.load += 1 }
  return { source, test: module.exports.__test, refs: module.exports.__refs, calls, shown }
}

function readyStore(exercises) {
  return vue.reactive({
    practiceStatus: 'ready',
    practiceMessage: null,
    practice: { exercises },
    answerResults: {},
    async submitAnswer(exerciseId, answer) { return this._submitImpl(exerciseId, answer) },
    async saveCheckpoint() { this._calls.checkpoint += 1 },
    async loadPractice() { this._calls.load += 1 },
  })
}

function compileView() {
  const source = read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const parsed = parse(source, { filename: 'b2-practice.vue' })
  const compiled = compileTemplate({
    source: parsed.descriptor.template.content,
    filename: 'b2-practice.vue',
    id: 'b2-practice-saved-feedback',
    compilerOptions: { isCustomElement: () => true },
  })
  assert.deepEqual(compiled.errors.map(String), [], 'template errors')
  return { source, template: parsed.descriptor.template.content, code: compiled.code }
}

function pageRender(state) {
  const view = compileView()
  const wrapped = view.code
    .replace(/import \{([^}]+)\} from ['"]vue['"]/, (_match, inner) => {
      const bindings = inner.split(',').map((part) => {
        const [left, right] = part.trim().split(/\s+as\s+/)
        return right ? `${left.trim()}: ${right.trim()}` : left.trim()
      }).join(', ')
      return `const { ${bindings} } = Vue`
    })
    .replace(/export function render/, 'return function render')
  const render = new Function('Vue', wrapped)(vue)
  return vue.createSSRApp({
    setup() {
      return state
    },
    render,
  })
}

test('acceptedPracticeReceipt only keeps a named server save', () => {
  const loop = loadModule('apps/mobile/src/domain/practice-loop.ts')
  assert.equal(loop.acceptedPracticeReceipt(null), null)
  assert.equal(loop.acceptedPracticeReceipt({ scoreBucket: 'FULL', isCorrect: true }), null)
  assert.equal(loop.acceptedPracticeReceipt({ savedReceipt: '   ' }), null)
  const kept = loop.acceptedPracticeReceipt({ savedReceipt: '已保存', scoreBucket: 'FULL' })
  assert.equal(kept.savedReceipt, '已保存')
  const view = loop.practiceFeedback({ savedReceipt: '已保存', scoreBucket: 'FULL', received: 1, total: 1 })
  assert.equal(view.savedReceipt, '已保存')
  assert.equal(view.feedbackText, '正确')
  assert.equal(view.nextQuestion, '本次练习已完成')
})

test('terminal last-question success keeps the server save and words after the exercise panel unmounts', async () => {
  const store = readyStore([{ exerciseId: 9, questionType: 'CHOICE' }])
  const page = compilePage(store)
  page.refs.accessGranted.value = true
  assert.equal(page.refs.viewState.value, 'exercise')
  assert.equal(page.refs.exercise.value.exerciseId, 9)
  await page.test.answer({ selectedOptionKeys: ['A'] })
  assert.equal(page.calls.submit, 1)
  assert.equal(store.answerResults['9'].savedReceipt, '已保存')
  assert.equal(page.refs.exercise.value, null)
  assert.equal(page.refs.finished.value, true)
  assert.equal(page.refs.viewState.value, 'finished')
  assert.equal(page.refs.answerFeedback.value.savedReceipt, '已保存')
  assert.equal(page.refs.answerFeedback.value.feedbackText, '正确')
  assert.equal(page.refs.answerFeedback.value.nextQuestion, '本次练习已完成')
  page.test.openReport()
  assert.deepEqual(page.calls.report, ['/pages/b10-report/b10-report'])
})

test('nonterminal success keeps the next unanswered item and the last server feedback', async () => {
  const store = readyStore([
    { exerciseId: 9, questionType: 'CHOICE' },
    { exerciseId: 10, questionType: 'CHOICE' },
  ])
  const page = compilePage(store)
  page.refs.accessGranted.value = true
  await page.test.answer({ selectedOptionKeys: ['A'] })
  assert.equal(page.calls.submit, 1)
  assert.equal(page.refs.viewState.value, 'exercise')
  assert.equal(page.refs.finished.value, false)
  assert.equal(page.refs.exercise.value.exerciseId, 10)
  assert.equal(page.refs.answerFeedback.value.savedReceipt, '已保存')
  assert.equal(page.refs.answerFeedback.value.feedbackText, '正确')
  assert.equal(page.refs.answerFeedback.value.nextQuestion, '下一题：第 2 题')
  assert.deepEqual(page.calls.report, [])
})

test('failed submit and a score without a receipt do not claim a save', async () => {
  const failedStore = readyStore([{ exerciseId: 9, questionType: 'CHOICE' }])
  const failed = compilePage(failedStore, { fail: true })
  failed.refs.accessGranted.value = true
  await failed.test.answer({ selectedOptionKeys: ['A'] })
  assert.equal(failed.calls.submit, 1)
  assert.deepEqual(failedStore.answerResults, {})
  assert.equal(failed.refs.lastResult.value, null)
  assert.equal(failed.refs.answerFeedback.value, null)
  assert.equal(failed.refs.viewState.value, 'exercise')
  assert.equal(failed.refs.exercise.value.exerciseId, 9)

  const unsignedStore = readyStore([{ exerciseId: 9, questionType: 'CHOICE' }])
  const unsigned = compilePage(unsignedStore, { omitReceipt: true })
  unsigned.refs.accessGranted.value = true
  await unsigned.test.answer({ selectedOptionKeys: ['A'] })
  assert.equal(unsigned.calls.submit, 1)
  assert.equal(unsignedStore.answerResults['9'].scoreBucket, 'FULL')
  assert.equal(unsigned.refs.lastResult.value, null)
  assert.equal(unsigned.refs.answerFeedback.value, null)
  assert.equal(unsigned.refs.viewState.value, 'finished')
})

test('template still compiles and the finished panel owns the same save and feedback markers', async () => {
  const view = compileView()
  const exerciseAt = view.template.indexOf('data-panel="exercise"')
  const finishedAt = view.template.indexOf('data-panel="finished"')
  assert.ok(exerciseAt >= 0 && finishedAt > exerciseAt)
  const exerciseSave = view.template.indexOf('data-save-receipt', exerciseAt)
  const exerciseWords = view.template.indexOf('data-feedback-text', exerciseAt)
  const exerciseNext = view.template.indexOf('data-next-question', exerciseAt)
  const finishedSave = view.template.indexOf('data-save-receipt', finishedAt)
  const finishedWords = view.template.indexOf('data-feedback-text', finishedAt)
  const finishedNext = view.template.indexOf('data-next-question', finishedAt)
  assert.ok(exerciseSave > exerciseAt && exerciseSave < exerciseWords && exerciseWords < exerciseNext && exerciseNext < finishedAt)
  assert.ok(finishedSave > finishedAt && finishedSave < finishedWords && finishedWords < finishedNext)
  assert.match(view.source, /acceptedPracticeReceipt/)
  assert.match(view.source, /data-single-submit/)
  assert.doesNotMatch(view.template.slice(exerciseAt, finishedAt), /v2-b2p-submit|b10-submit/)
  assert.match(view.code, /data-save-receipt/)
  assert.match(view.code, /data-feedback-text/)

  const html = await renderToString(pageRender({
    themeClass: '',
    viewState: 'finished',
    theme: 'light',
    experienceStyle: {},
    experienceMotion: 'on',
    glowSrc: '',
    mobileT: (key) => key,
    b10T: (key) => key,
    showEngineChrome: true,
    store: { practiceStatus: 'ready', practiceMessage: null, practice: { exercises: [{ exerciseId: 9 }] }, answerResults: { 9: { savedReceipt: '已保存' } } },
    performanceLevel: 'High',
    load() {},
    setPerformance() {},
    showGate: false,
    resume: { stopped: false, copy: '上次学到第 1 题，继续', index: 1 },
    exercise: null,
    answeredCount: 1,
    submitting: false,
    answer() {},
    checkpoint() {},
    lastResult: { isCorrect: true, scoringStatus: 'SCORED', savedReceipt: '已保存', contentVersionStale: false },
    answerFeedback: { savedReceipt: '已保存', feedbackText: '正确', nextQuestion: '本次练习已完成' },
    finished: true,
    showPracticeReward() { return false },
    openReport() {},
    authKind: 'open',
    reopenLegacyAccess() {},
    alternatives: [],
    openLegacyAlternative() {},
    retryLegacyLoad() {},
    backLegacyHome() {},
  }))
  assert.match(html, /data-panel="finished"/)
  assert.match(html, /data-save-receipt/)
  assert.match(html, /已保存/)
  assert.match(html, /data-feedback-text/)
  assert.match(html, /正确/)
  assert.doesNotMatch(html, /data-panel="exercise"/)
  assert.doesNotMatch(html, /b10-option/)
})
