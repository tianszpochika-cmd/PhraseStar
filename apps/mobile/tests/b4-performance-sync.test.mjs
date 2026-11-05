import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const { reactive } = require('vue')
const root = path.resolve(import.meta.dirname, '..')
const storePath = 'src/stores/b4.ts'

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function storage(map = new Map()) {
  return {
    map,
    getItem(key) { return map.get(key) ?? null },
    setItem(key, value) { map.set(key, value) },
    removeItem(key) { map.delete(key) },
  }
}

function loadPerformance() {
  return load('../../packages/performance/src/index.ts', {})
}

function loadStore({ engine, session, qualityCalls = [] }) {
  const domain = load('src/domain/b4.ts', { '../platform/client-id': { createClientId: (prefix) => `${prefix}-fixture` } })
  const api = {
    getB4Profile: async () => ({}), getB4Streak: async () => ({}), listB4Quests: async () => ({ items: [] }), getB4Season: async () => ({}),
    getB4AvatarProfile: async () => ({}), listB4AvatarItems: async () => ({ items: [] }), listB4Loadouts: async () => ({ items: [] }), getB4AvatarResources: async () => ({}),
    listB4Games: async () => ({ items: [] }), listB4Rooms: async () => ({ items: [] }), listB4Notifications: async () => ({ items: [] }), listB4OfflinePackages: async () => ({ items: [] }),
    listB4Chests: async () => ({ items: [] }), pushB4SyncEvents: async () => ({ accepted: true }),
  }
  class MobileApiError extends Error { constructor(status, message) { super(message ?? String(status)); this.status = status } }
  const modules = {
    vue: require('vue'), pinia: require('pinia'),
    '@englishflow/performance': {},
    '../api/client': { MobileApiError },
    '../api/b4': api,
    '../domain/b4': domain,
    '../platform/b4-offline': { createB4OfflineQueue: () => ({ subject: null, records: [], bindSubject(subject) { this.subject = subject }, markFailed() {}, markSyncing() {}, clear() {} }) },
    '../platform/experience': {
      mobileExperienceEngine: engine,
      setMobileQuality(level) { qualityCalls.push(level); engine.setLevel(level, 'manual') },
      passiveRestoreMobileQuality() { return engine.restore() },
    },
    './session': { useSessionStore: () => session },
  }
  return load(storePath, modules).useB4Store
}

function makeStore(useStore) {
  setActivePinia(createPinia())
  return useStore()
}

test('b4 and a second store consume the same quality singleton and manual levels persist under one key', () => {
  const performance = loadPerformance()
  const persistence = storage()
  const engine = performance.createAdaptivePerformanceEngine({ storage: persistence, storageKey: 'yx.performance.level', reducedMotion: false, motionDisabled: false, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  const qualityCalls = []
  const session = reactive({ verifiedSubject: 'A', identityRevision: 1, isAuthenticated: true })
  const useStore = loadStore({ engine, session, qualityCalls })
  const first = makeStore(useStore)
  const second = makeStore(useStore)

  assert.equal(first.performanceLevel, engine.level)
  for (const level of ['Ultra', 'High', 'Medium', 'Performance']) {
    first.setPerformance(level)
    assert.equal(first.performanceLevel, level)
    assert.equal(second.performanceLevel, level)
    assert.equal(engine.level, level)
    assert.equal(persistence.getItem('yx.performance.level'), level)
    assert.equal(qualityCalls.at(-1), level)
  }
  assert.deepEqual([...persistence.map.keys()].sort(), ['yx.performance.level'])
  assert.ok(first.performanceStrategy && first.performanceStrategy.level === 'Performance')
  assert.equal(typeof first.restore, 'function')
  assert.equal(typeof first.dispose, 'function')
})

test('identity revision and dispose do not reset or dispose the shared manual quality', () => {
  const performance = loadPerformance()
  const persistence = storage()
  const engine = performance.createAdaptivePerformanceEngine({ storage: persistence, storageKey: 'yx.performance.level', reducedMotion: false, motionDisabled: false, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  const session = reactive({ verifiedSubject: 'A', identityRevision: 1, isAuthenticated: true })
  const useStore = loadStore({ engine, session })
  const store = makeStore(useStore)
  store.setPerformance('Performance')
  session.identityRevision += 1
  assert.equal(store.performanceLevel, 'Performance')
  assert.equal(engine.level, 'Performance')
  store.dispose()
  assert.equal(engine.level, 'Performance')
  assert.equal(persistence.getItem('yx.performance.level'), 'Performance')

  const secondEngine = performance.createAdaptivePerformanceEngine({ storage: persistence, storageKey: 'yx.performance.level', reducedMotion: false, motionDisabled: false, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  const secondUseStore = loadStore({ engine: secondEngine, session })
  const restored = makeStore(secondUseStore)
  restored.restore()
  assert.equal(restored.performanceLevel, 'Performance')
  assert.equal(secondEngine.level, 'Performance')
})

test('shared engine auto degradation, motion-off and reduced motion are reflected without a local engine', () => {
  const performance = loadPerformance()
  const persistence = storage()
  const engine = performance.createAdaptivePerformanceEngine({ storage: persistence, storageKey: 'yx.performance.level', reducedMotion: false, motionDisabled: false, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  const session = reactive({ verifiedSubject: 'A', identityRevision: 1, isAuthenticated: true })
  const useStore = loadStore({ engine, session })
  const store = makeStore(useStore)
  store.setPerformance('High')
  engine.observe({ frameRate: 20 })
  assert.equal(engine.level, 'Medium')
  assert.equal(store.performanceLevel, 'Medium')
  engine.setMotionDisabled(true)
  assert.equal(store.performanceStrategy.motionScale, 0)
  engine.setMotionDisabled(false)
  assert.ok(store.performanceStrategy.motionScale > 0)

  const reduced = performance.createAdaptivePerformanceEngine({ storage: storage(), storageKey: 'yx.performance.level', reducedMotion: true, deviceMemoryGb: 8, hardwareConcurrency: 8 })
  const reducedStore = makeStore(loadStore({ engine: reduced, session }))
  assert.equal(reduced.state.reducedMotion, true)
  assert.equal(reducedStore.performanceLevel, 'Performance')
  assert.equal(reducedStore.performanceStrategy.motionScale, 0)
})

test('b4 source no longer owns a local performance engine or disposes the global engine', () => {
  const source = fs.readFileSync(path.join(root, storePath), 'utf8')
  assert.doesNotMatch(source, /createAdaptivePerformanceEngine/u)
  assert.match(source, /mobileExperienceEngine/u)
  assert.match(source, /passiveRestoreMobileQuality\(\)/u)
  assert.doesNotMatch(source, /mobileExperienceEngine\.restore\(\)/u)
  assert.match(source, /setMobileQuality/u)
  assert.doesNotMatch(source, /engine\.dispose/u)
  assert.match(source, /dispose: \(\) => \{ unsubscribe\(\) \}/u)
})
