#!/usr/bin/env node
/** Offline reproduction of G455 feedback-not-rendered. No live runtime. */
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const repoRoot = process.argv[2] || process.cwd()
const appRoot = path.join(repoRoot, 'apps/mobile')
const req = createRequire(path.join(appRoot, 'package.json'))
const ts = req('typescript')
const vue = req('vue')
const { parse, compileTemplate } = req('@vue/compiler-sfc')
const { renderToString } = req('vue/server-renderer')
const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8')

function loadLoop() {
  const compiled = ts.transpileModule(read('apps/mobile/src/domain/practice-loop.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error('loop import') }, module, module.exports)
  return module.exports
}

function compilePage(store) {
  const source = read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const compiled = ts.transpileModule(`${script}
export const __test = { answer }
export const __refs = { accessGranted, viewState, answerFeedback, exercise, finished }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const quality = { state: { level: 'High' }, subscribe(listener) { listener(this.state); return () => {} } }
  new Function('require', 'module', 'exports', compiled)((name) => ({
    vue: { ...vue, onUnmounted() {} },
    '@dcloudio/uni-app': { onShow() {}, onHide() {} },
    '../../components/MobilePageHeader.vue': {},
    '../../components/AppIcon.vue': {},
    '../../components/b10/B10ExerciseCard.vue': {},
    '../../components/b10/B10StatusPanel.vue': {},
    '../../domain/practice-loop': loadLoop(),
    '../../auth/navigation': { ensureMobilePageAccess: async () => true },
    '../../platform/experience': {
      mobileExperienceEngine: quality,
      setMobileQuality() {},
      mobileT: (key) => key,
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }),
    },
    '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light'), b10T: (key) => key },
    '../../stores/b10-learning': { useB10LearningStore: () => store },
    '../../platform/uni-runtime': { openUniPage() {}, consumePendingNavigationQuery() { return {} }, getUniRuntime: () => ({ navigateTo() {} }) },
    '../../stores/session': { useSessionStore: () => vue.reactive({ identityRevision: 1, isAuthenticated: true }) },
  }[name]), module, module.exports)
  return module.exports
}

const loop = loadLoop()
assert.equal(loop.acceptedPracticeReceipt({ scoreBucket: 'FULL' }), null)
assert.equal(loop.acceptedPracticeReceipt({ savedReceipt: '已保存' }).savedReceipt, '已保存')

const store = vue.reactive({
  practiceStatus: 'ready',
  practiceMessage: null,
  practice: { exercises: [{ exerciseId: 9, questionType: 'CHOICE' }] },
  answerResults: {},
  async submitAnswer(exerciseId) {
    const result = {
      exerciseId,
      isCorrect: true,
      scoringStatus: 'SCORED',
      savedReceipt: '已保存',
      feedbackText: '正确',
      scoreBucket: 'FULL',
      nextQuestion: '本次练习已完成',
    }
    this.answerResults[String(exerciseId)] = result
    return result
  },
  async saveCheckpoint() {},
  async loadPractice() {},
})
const page = compilePage(store)
page.__refs.accessGranted.value = true
assert.equal(page.__refs.viewState.value, 'exercise')
await page.__test.answer({ selectedOptionKeys: ['A'] })
assert.equal(page.__refs.exercise.value, null)
assert.equal(page.__refs.viewState.value, 'finished')
assert.equal(page.__refs.answerFeedback.value.savedReceipt, '已保存')
assert.equal(page.__refs.answerFeedback.value.feedbackText, '正确')

const source = read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
const parsed = parse(source, { filename: 'b2-practice.vue' })
const compiled = compileTemplate({
  source: parsed.descriptor.template.content,
  filename: 'b2-practice.vue',
  id: 'offline-repro',
  compilerOptions: { isCustomElement: () => true },
})
const wrapped = compiled.code
  .replace(/import \{([^}]+)\} from ['"]vue['"]/, (_m, inner) => {
    const bindings = inner.split(',').map((part) => {
      const [left, right] = part.trim().split(/\s+as\s+/)
      return right ? `${left.trim()}: ${right.trim()}` : left.trim()
    }).join(', ')
    return `const { ${bindings} } = Vue`
  })
  .replace(/export function render/, 'return function render')
const render = new Function('Vue', wrapped)(vue)
const html = await renderToString(vue.createSSRApp({
  setup() {
    return {
      themeClass: '',
      viewState: 'finished',
      theme: 'light',
      experienceStyle: {},
      experienceMotion: 'on',
      glowSrc: '',
      mobileT: (key) => key,
      b10T: (key) => key,
      showEngineChrome: false,
      store: { practiceStatus: 'ready', practiceMessage: null, practice: { exercises: [{ exerciseId: 9 }] }, answerResults: { 9: {} } },
      performanceLevel: 'High',
      load() {},
      setPerformance() {},
      showGate: false,
      resume: { stopped: false, copy: '', index: 1 },
      exercise: null,
      answeredCount: 1,
      submitting: false,
      answer() {},
      checkpoint() {},
      lastResult: { isCorrect: true, scoringStatus: 'SCORED', savedReceipt: '已保存' },
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
    }
  },
  render,
}))
assert.match(html, /data-panel="finished"/)
assert.match(html, /data-save-receipt/)
assert.match(html, /已保存/)
assert.match(html, /data-feedback-text/)
assert.match(html, /正确/)
assert.doesNotMatch(html, /data-panel="exercise"/)

console.log(JSON.stringify({
  status: 'PASS',
  cause: 'last-question answerResults write unmounted exercise-panel feedback; finished panel now keeps server receipt',
  viewState: page.__refs.viewState.value,
  savedReceipt: page.__refs.answerFeedback.value.savedReceipt,
  feedbackText: page.__refs.answerFeedback.value.feedbackText,
  htmlHasSave: html.includes('data-save-receipt'),
  liveRuntime: 'NOT_RUN',
}, null, 2))
