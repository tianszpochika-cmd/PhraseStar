import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const requireFromApp = createRequire(path.join(appRoot, 'package.json'))
const ts = requireFromApp('typescript')
const { parse, compileScript, compileTemplate } = requireFromApp('@vue/compiler-sfc')

const PAGE = 'src/pages/b6-platform/b6-platform.vue'
const MAPPER = 'src/pages/b6-platform/platform-page.ts'
const COPY = '../../packages/i18n/src/mobile-resources/platform-page.ts'

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', compiled)(module, module.exports)
  return module.exports
}

const mapper = loadTs(MAPPER)
const copy = loadTs(COPY)

test('b6-platform SFC parses and its script/template compile', () => {
  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename: PAGE })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup, 'page uses script setup')
  const script = compileScript(descriptor, { id: 'b6-platform' })
  assert.ok(script.content.includes('ensureMobilePageAccess'))
  const template = compileTemplate({ source: descriptor.template.content, filename: PAGE, id: 'b6-platform' })
  assert.deepEqual(template.errors, [])
})

test('device mapper reads a real matrix shape without exposing raw status enums', () => {
  const mapped = mapper.mapDeviceSupport({
    data: {
      matrixVersion: 'b6-platform-v1',
      targets: [
        { platformCode: 'H5', buildStatus: 'PASSED' },
        { platformCode: 'IOS', buildStatus: 'TEST_STAGE_REQUIRED' },
        { platformCode: 'BOGUS', buildStatus: 'FAILED' },
      ],
    },
  })
  assert.equal(mapped.kind, 'matrix')
  assert.deepEqual(mapped.rows, [
    { code: 'H5', status: 'verified', detail: 'target' },
    { code: 'IOS', status: 'unverified', detail: 'target' },
    { code: 'UNKNOWN', status: 'unavailable', detail: 'target' },
  ])
  assert.equal(JSON.stringify(mapped).includes('PASSED'), false)
  assert.equal(JSON.stringify(mapped).includes('TEST_STAGE_REQUIRED'), false)
})

test('device mapper adapts the current code-layer evidence honestly', () => {
  const mapped = mapper.mapDeviceSupport({
    source: 'code-layer-evidence',
    status: 'CODE_READY',
    items: ['Java 25 / Spring Boot 4.1 runtime manifest', 'Vue 3 + uni-app mobile target', 'Phase 1 feature gate active'],
  })
  assert.equal(mapped.kind, 'evidence')
  assert.deepEqual(mapped.rows.map((row) => [row.code, row.status, row.detail]), [
    ['IOS_ANDROID', 'unverified', 'evidence'],
    ['TABLET_MINI', 'unverified', 'evidence'],
  ])
  assert.equal(JSON.stringify(mapped).includes('Java 25'), false)
  assert.equal(JSON.stringify(mapped).includes('Spring'), false)
})

test('device mapper returns unknown for unknown and failed shapes', () => {
  for (const value of [null, undefined, {}, { data: { foo: 'bar' } }, { source: 'code-layer-evidence', status: 'FAILED', items: ['internal'] }]) {
    const mapped = mapper.mapDeviceSupport(value)
    assert.equal(mapped.kind, 'unknown', JSON.stringify(value))
    assert.deepEqual(mapped.rows, [])
  }
})

test('accessibility and budget mappers distinguish shapes, evidence and unknown', () => {
  assert.deepEqual(mapper.mapAccessibility({ data: { checks: [{ checkCode: 'A' }, { checkCode: 'B' }] } }), { kind: 'checks', count: 2 })
  assert.deepEqual(mapper.mapAccessibility({ source: 'code-layer-evidence', status: 'CODE_READY', items: ['a', 'b', 'c'] }), { kind: 'evidence', count: 3 })
  assert.deepEqual(mapper.mapAccessibility({ source: 'code-layer-evidence', status: 'FAILED', items: ['a'] }), { kind: 'unknown', count: 0 })
  assert.deepEqual(mapper.mapAccessibility({}), { kind: 'unknown', count: 0 })
  assert.deepEqual(mapper.mapPerformanceBudget({ data: { levels: [{ level: 'Ultra' }, { level: 'High' }] } }), { kind: 'profiles', levelCount: 2 })
  assert.deepEqual(mapper.mapPerformanceBudget({ source: 'code-layer-evidence', status: 'CODE_READY', items: ['a'] }), { kind: 'evidence', levelCount: 0 })
  assert.deepEqual(mapper.mapPerformanceBudget({ source: 'code-layer-evidence', status: 'FAILED', items: ['a'] }), { kind: 'unknown', levelCount: 0 })
  assert.deepEqual(mapper.mapPerformanceBudget(null), { kind: 'unknown', levelCount: 0 })
})

test('platform copy keeps UI/content locales separate and supplies both locales', () => {
  const zh = copy.platformPageCopy(false)
  const en = copy.platformPageCopy(true)
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.equal(zh.qualityUltra, '超高')
  assert.equal(zh.qualityHigh, '高')
  assert.equal(zh.qualityMedium, '均衡')
  assert.equal(zh.qualityPerformance, '省资源')
  assert.equal(zh.navTitle, '画质与设备')
  assert.equal(en.navTitle, 'Device & quality')
  assert.equal(en.qualityUltra, 'Ultra')
  assert.ok(Object.keys(zh).length >= 35)
  assert.equal(JSON.stringify(zh).includes('contentLocale'), false)
  assert.equal(JSON.stringify(en).includes('contentLocale'), false)
})

test('page uses the shared singleton and required guard/lifecycle seams', () => {
  const source = read(PAGE)
  assert.match(source, /ensureMobilePageAccess\('\/pages\/b6-platform\/b6-platform'\)/)
  assert.match(source, /mobileExperienceEngine/)
  assert.match(source, /setMobileQuality/)
  assert.match(source, /experienceStyle/)
  assert.match(source, /experienceMotion/)
  assert.match(source, /onShow/)
  assert.match(source, /onHide/)
  assert.match(source, /loadEpoch/)
  assert.match(source, /pageVisible/)
  assert.match(source, /releaseSubscription/)
  assert.match(source, /onUnload/)
  assert.match(source, /onBeforeUnmount/)
  assert.match(source, /compact/)
  assert.match(source, /show-settings="false"/)
  assert.match(source, /#trail/)
  assert.doesNotMatch(source, /createAdaptivePerformanceEngine/)
  assert.doesNotMatch(source, /mobileExperienceEngine\.setLevel/)
  assert.equal((source.match(/mobileExperienceEngine\.restore\(\)/g) || []).length, 0)
  assert.doesNotMatch(source, /hydrateMobileExperienceRuntime/)
  assert.doesNotMatch(source, /mobileExperienceEngine\.dispose/)
  assert.doesNotMatch(source, /setContentLocale/)
  assert.doesNotMatch(source, /method:\s*['"]POST/)
  assert.doesNotMatch(source, /b6-mobile-heading|设备支持情况与画质选项/)
})

test('platform show uses the shared hydrated engine and does not restore or write on entry', () => {
  const source = read(PAGE)
  const app = fs.readFileSync(path.join(appRoot, 'src/App.vue'), 'utf8')
  const experience = fs.readFileSync(path.join(appRoot, 'src/platform/experience.ts'), 'utf8')
  const show = source.slice(source.indexOf('onShow(async () => {'), source.indexOf('onHide('))
  const choose = source.slice(source.indexOf('function chooseQuality'), source.indexOf('function toggleHelp'))
  assert.equal(app.split('hydrateMobileExperienceRuntime(').length - 1, 1)
  assert.equal(experience.split('createAdaptivePerformanceEngine(').length - 1, 1)
  assert.equal((source.match(/onShow\(/g) || []).length, 1)
  assert.match(show, /ensureMobilePageAccess\('\/pages\/b6-platform\/b6-platform'\)/)
  assert.match(show, /await load\(\)/)
  assert.doesNotMatch(show, /restore\(|setMobileQuality|setMobileMotion|hydrateMobileExperienceRuntime|setLevel|resetLevelToAutomatic|setStorageSync|setItem/)
  assert.match(source, /mobileExperienceEngine\.subscribe/)
  assert.match(source, /:data-motion="experienceMotion"/)
  assert.match(source, /\[data-motion="off"\]/)
  assert.match(source, /\[data-motion="reduced"\]/)
  assert.match(choose, /setMobileQuality\(level\)/)
  assert.match(choose, /qualityError\.value = t\('qualityError'\)/)
  assert.match(source, /t\('qualityNote'\)/)
  assert.doesNotMatch(choose, /已保存|saved|持久化成功|qualitySaved/)
  assert.equal(copy.platformPageCopy(false).qualityNote.includes('已保存'), false)
  assert.match(copy.platformPageCopy(false).qualityNote, /持久化失败暂无回执/)
  assert.match(copy.platformPageCopy(true).qualityNote, /no receipt/)
  assert.doesNotMatch(source, /setMobileMotion|resetLevelToAutomatic/)
})

test('repeated platform entries keep a manual quality and do not claim a failed save', () => {
  const performance = loadTs('../../packages/performance/src/index.ts')
  const { createAdaptivePerformanceEngine } = performance
  const writes = []
  const store = new Map([
    ['yx.performance.level', 'Performance'],
    ['yx.performance.level:motion', 'off'],
  ])
  const storage = {
    getItem(key) { return store.has(key) ? store.get(key) : null },
    setItem(key, value) { writes.push([key, value]); store.set(key, value) },
    removeItem(key) { store.delete(key) },
  }
  const engine = createAdaptivePerformanceEngine({
    storage,
    storageKey: 'yx.performance.level',
    reducedMotion: true,
    deviceMemoryGb: 8,
    hardwareConcurrency: 8,
  })
  engine.restore()
  assert.equal(engine.level, 'Performance')
  assert.equal(engine.state.motionDisabled, true)
  assert.equal(engine.state.strategy.motionScale, 0)
  assert.equal(engine.state.strategy.enableThreeD, false)
  engine.setLevel('High', 'manual')
  assert.equal(engine.level, 'High')
  assert.equal(engine.state.motionDisabled, true)
  assert.equal(engine.state.strategy.motionScale, 0)
  const shown = { level: engine.level, savedClaim: false }
  const stop = engine.subscribe((state) => { shown.level = state.level })
  const afterManual = writes.length
  const entries = ['first-open', 'reopen', 'cross-page', 'reload']
  for (const entry of entries) {
    shown.level = engine.level
    assert.equal(entry.length > 0, true)
    assert.equal(engine.level, 'High')
    assert.equal(shown.level, 'High')
    assert.equal(shown.savedClaim, false)
    assert.equal(engine.state.motionDisabled, true)
    assert.equal(engine.state.strategy.motionScale, 0)
    assert.equal(store.get('yx.performance.level'), 'High')
    assert.equal(store.get('yx.performance.level:motion'), 'off')
    assert.equal(writes.length, afterManual)
  }
  assert.deepEqual(entries, ['first-open', 'reopen', 'cross-page', 'reload'])
  stop()

  const unknownStore = new Map([['yx.performance.level', 'Bogus']])
  let unknownWrites = 0
  const unknown = createAdaptivePerformanceEngine({
    storage: {
      getItem(key) { return unknownStore.has(key) ? unknownStore.get(key) : null },
      setItem() { unknownWrites += 1; throw new Error('unknown values are not stored') },
      removeItem(key) { unknownStore.delete(key) },
    },
    reducedMotion: false,
    deviceMemoryGb: 8,
    hardwareConcurrency: 8,
  })
  assert.doesNotThrow(() => unknown.restore())
  assert.equal(unknown.level, 'High')
  assert.equal(unknownStore.get('yx.performance.level'), 'Bogus')
  assert.equal(unknownWrites, 0)

  const persisted = { value: 'Medium' }
  let displayed = ''
  let saveError = ''
  let savedClaim = false
  const failing = createAdaptivePerformanceEngine({
    storage: {
      getItem() { return persisted.value },
      setItem() { throw new Error('preference write failed') },
      removeItem() {},
    },
    reducedMotion: false,
    deviceMemoryGb: 8,
    hardwareConcurrency: 8,
  })
  const stopFail = failing.subscribe((state) => { displayed = state.level })
  const shownBefore = displayed
  assert.equal(shownBefore, 'High')
  try {
    failing.setLevel('Ultra', 'manual')
    savedClaim = true
  } catch {
    saveError = 'qualityError'
  }
  assert.equal(savedClaim, false)
  assert.equal(saveError, 'qualityError')
  assert.equal(displayed, shownBefore)
  assert.notEqual(displayed, 'Ultra')
  assert.equal(persisted.value, 'Medium')
  stopFail()
})
