import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'
import { describe, test } from 'node:test'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(testDir, '..')
const experiencePath = path.join(mobileRoot, 'src/platform/experience.ts')
const appPath = path.join(mobileRoot, 'src/App.vue')
const domainUrl = pathToFileURL(path.join(mobileRoot, 'src/domain/experience.ts')).href
const loaderReady = register(new URL('./helpers/mobile-experience-runtime-loader.mjs', import.meta.url), import.meta.url)
if (loaderReady && typeof loaderReady.then === 'function') await loaderReady
const { resolveMobileMotion } = await import(domainUrl)

const QUALITY_KEY = 'yx.performance.level'
const MOTION_KEY = 'yx.mobile.motion'
const MOTION_FLAG_KEY = 'yx.performance.level:motion'
const OWNED_KEYS = new Set([QUALITY_KEY, MOTION_KEY, MOTION_FLAG_KEY])

let instance = 0
let chain = Promise.resolve()

function serial(name, fn) {
  const previous = chain
  let release
  const gate = new Promise((resolve) => { release = resolve })
  chain = gate
  test(name, async () => {
    await previous
    try { await fn() } finally { release() }
  })
}

function resetGlobals() {
  delete globalThis.uni
  delete globalThis.window
}

function installReducedMotion() {
  globalThis.window = {
    matchMedia(query) {
      return {
        matches: String(query).includes('prefers-reduced-motion'),
        media: String(query),
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }
    },
  }
}

function installUni(store, controls) {
  globalThis.uni = {
    getStorageSync(key) {
      if (controls.getThrows) throw new Error('getStorageSync unavailable')
      return store.has(key) ? store.get(key) : ''
    },
    setStorageSync(key, value) {
      if (controls.setThrows) throw new Error('setStorageSync failed')
      store.set(key, String(value))
    },
    removeStorageSync(key) {
      if (controls.removeThrows) throw new Error('removeStorageSync failed')
      store.delete(key)
    },
    navigateTo() {},
    switchTab() {},
  }
}

async function loadExperience() {
  instance += 1
  return import(`${pathToFileURL(experiencePath).href}?instance=${instance}`)
}

function motionOf(mod) {
  return resolveMobileMotion(mod.mobileMotionMode.value, mod.mobileExperienceEngine.state)
}

function assertForeignKeys(store, seeded) {
  for (const key of store.keys()) {
    if (seeded.has(key)) continue
    assert.ok(OWNED_KEYS.has(key), `unexpected storage key ${key}`)
  }
  for (const [key, value] of seeded) {
    if (OWNED_KEYS.has(key)) continue
    assert.equal(store.get(key), value)
  }
}

describe('mobile experience runtime hydration', { concurrency: false }, () => {
  serial('delayed runtime keeps saved Ultra/REDUCED out of the engine until hydrate', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
      ['yx.account.subject', 'keep'],
    ])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls)
    const mod = await loadExperience()
    const engine = mod.mobileExperienceEngine

    assert.notEqual(engine.state.level, 'Ultra')
    assert.equal(engine.state.source, 'auto')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'on')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
    assert.equal(store.get(MOTION_KEY), 'REDUCED')
    assert.equal(store.has(MOTION_FLAG_KEY), false)
    assert.equal(store.get('yx.account.subject'), 'keep')
    assert.equal(typeof mod.hydrateMobileExperienceRuntime, 'function')

    assert.doesNotThrow(() => mod.hydrateMobileExperienceRuntime())
    assert.notEqual(engine.state.level, 'Ultra')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
    assert.equal(store.get(MOTION_KEY), 'REDUCED')

    controls.getThrows = false
    controls.setThrows = false
    controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine, engine)
    assert.equal(engine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'REDUCED')
    assert.equal(motionOf(mod), 'reduced')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
    assert.equal(store.get(MOTION_KEY), 'REDUCED')
    assertForeignKeys(store, new Map([['yx.account.subject', 'keep']]))
  })

  serial('delayed runtime restores saved Performance/OFF', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Performance'],
      [MOTION_KEY, 'OFF'],
    ])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls)
    const mod = await loadExperience()

    assert.notEqual(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'on')
    assert.equal(store.get(QUALITY_KEY), 'Performance')
    assert.equal(store.get(MOTION_KEY), 'OFF')

    controls.getThrows = false
    controls.setThrows = false
    controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(mod.mobileExperienceEngine.state.motionDisabled, true)
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.get(QUALITY_KEY), 'Performance')
    assert.equal(store.get(MOTION_KEY), 'OFF')
    assert.equal(store.get(MOTION_FLAG_KEY), 'off')
  })

  serial('saved Performance without a motion key stays off without inventing a motion key', async () => {
    resetGlobals()
    const store = new Map([[QUALITY_KEY, 'Performance']])
    const controls = { getThrows: true, setThrows: false, removeThrows: false }
    installUni(store, controls)
    const mod = await loadExperience()
    controls.getThrows = false
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.has(MOTION_KEY), false)
    assert.equal(store.get(QUALITY_KEY), 'Performance')
  })

  serial('saved Ultra without a motion key stays on without inventing a motion key', async () => {
    resetGlobals()
    const store = new Map([[QUALITY_KEY, 'Ultra']])
    const controls = { getThrows: true, setThrows: false, removeThrows: false }
    installUni(store, controls)
    const mod = await loadExperience()
    controls.getThrows = false
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'on')
    assert.equal(store.has(MOTION_KEY), false)
    assert.equal(store.has(MOTION_FLAG_KEY), false)
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
  })

  serial('no saved values stay automatic and do not write default keys', async () => {
    resetGlobals()
    const store = new Map([['ef.theme', 'dark']])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()
    const state = mod.mobileExperienceEngine.state

    assert.equal(state.source, 'auto')
    assert.equal(state.reducedMotion, false)
    assert.notEqual(state.level, 'Performance')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'on')
    assert.equal(store.has(QUALITY_KEY), false)
    assert.equal(store.has(MOTION_KEY), false)
    assert.equal(store.has(MOTION_FLAG_KEY), false)
    assert.equal(store.get('ef.theme'), 'dark')

    mod.hydrateMobileExperienceRuntime()
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.equal(store.has(QUALITY_KEY), false)
    assert.equal(store.has(MOTION_KEY), false)
    assert.equal(store.has(MOTION_FLAG_KEY), false)
  })

  serial('a manual choice survives a later hydrate', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
    ])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls)
    const mod = await loadExperience()
    controls.getThrows = false
    controls.setThrows = false
    controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()
    mod.setMobileQuality('Medium')
    mod.setMobileMotion('OFF')
    mod.hydrateMobileExperienceRuntime()
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.get(QUALITY_KEY), 'Medium')
    assert.equal(store.get(MOTION_KEY), 'OFF')
  })

  serial('a choice made before storage works is persisted instead of the stale snapshot', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
    ])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls)
    const mod = await loadExperience()

    assert.doesNotThrow(() => mod.setMobileQuality('Medium'))
    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')

    controls.getThrows = false
    controls.setThrows = false
    controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    assert.equal(store.get(QUALITY_KEY), 'Medium')
    assert.equal(mod.mobileMotionMode.value, 'REDUCED')
    assert.equal(store.get(MOTION_KEY), 'REDUCED')
  })

  serial('a later FULL motion choice wins over a hydrated REDUCED value', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
    ])
    const controls = { getThrows: true, setThrows: false, removeThrows: false }
    installUni(store, controls)
    const mod = await loadExperience()
    controls.getThrows = false
    mod.hydrateMobileExperienceRuntime()
    mod.setMobileMotion('FULL')
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'on')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
    assert.equal(store.get(MOTION_KEY), 'FULL')
  })

  serial('OS reduced motion keeps a saved Ultra level and does not rewrite the motion key to OFF', async () => {
    resetGlobals()
    installReducedMotion()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'FULL'],
    ])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()

    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.reducedMotion, true)
    assert.equal(mod.mobileExperienceEngine.state.motionDisabled, true)
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.get(MOTION_KEY), 'FULL')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')

    mod.hydrateMobileExperienceRuntime()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(store.get(MOTION_KEY), 'FULL')
  })

  serial('OS reduced motion with no saved values stays automatic Performance and writes nothing', async () => {
    resetGlobals()
    installReducedMotion()
    const store = new Map()
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()
    const state = mod.mobileExperienceEngine.state

    assert.equal(state.source, 'auto')
    assert.equal(state.level, 'Performance')
    assert.equal(state.reducedMotion, true)
    assert.equal(state.motionDisabled, true)
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.size, 0)

    mod.hydrateMobileExperienceRuntime()
    assert.equal(store.size, 0)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
  })

  serial('explicit OFF disables motion when the OS is not requesting reduced motion', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'High'],
      [MOTION_KEY, 'OFF'],
    ])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()

    assert.equal(mod.mobileExperienceEngine.state.reducedMotion, false)
    assert.equal(mod.mobileExperienceEngine.state.motionDisabled, true)
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(motionOf(mod), 'off')
    assert.equal(store.get(MOTION_KEY), 'OFF')
    assert.equal(store.get(MOTION_FLAG_KEY), 'off')
  })

  serial('reset to automatic clears a saved level and a later hydrate does not restore it', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
    ])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')

    const reset = mod.restoreMobileQualityDefault()
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.equal(reset, mod.mobileExperienceEngine.state.level)
    assert.notEqual(reset, 'Ultra')
    assert.equal(store.has(QUALITY_KEY), false)

    mod.hydrateMobileExperienceRuntime()
    assert.equal(store.has(QUALITY_KEY), false)
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.notEqual(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'REDUCED')
  })

  serial('a failed quality clear does not claim the automatic default', async () => {
    resetGlobals()
    const store = new Map([[QUALITY_KEY, 'Ultra'], [MOTION_KEY, 'FULL']])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: true })
    const mod = await loadExperience()
    let returned
    assert.doesNotThrow(() => { returned = mod.restoreMobileQualityDefault() })
    assert.equal(returned, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')

    mod.hydrateMobileExperienceRuntime()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(store.get(QUALITY_KEY), 'Ultra')
  })

  serial('a failed motion write does not claim persistence and a later hydrate retries it', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'High'],
      [MOTION_KEY, 'REDUCED'],
    ])
    const controls = { getThrows: false, setThrows: true, removeThrows: false }
    installUni(store, controls)
    const mod = await loadExperience()

    assert.doesNotThrow(() => mod.setMobileMotion('OFF'))
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(store.get(MOTION_KEY), 'REDUCED')

    controls.setThrows = false
    mod.hydrateMobileExperienceRuntime()
    assert.equal(store.get(MOTION_KEY), 'OFF')
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
  })

  serial('storage that is already readable restores immediately and a later choice is kept', async () => {
    resetGlobals()
    const store = new Map([
      [QUALITY_KEY, 'Ultra'],
      [MOTION_KEY, 'REDUCED'],
    ])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false })
    const mod = await loadExperience()
    const engine = mod.mobileExperienceEngine

    assert.equal(engine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'REDUCED')
    assert.equal(motionOf(mod), 'reduced')

    mod.setMobileQuality('Medium')
    mod.setMobileMotion('OFF')
    mod.hydrateMobileExperienceRuntime()

    assert.equal(mod.mobileExperienceEngine, engine)
    assert.equal(engine.state.level, 'Medium')
    assert.equal(mod.mobileMotionMode.value, 'OFF')
    assert.equal(store.get(QUALITY_KEY), 'Medium')
    assert.equal(store.get(MOTION_KEY), 'OFF')
  })

  serial('App launches hydration once and pages do not restore on show', () => {
    const app = readFileSync(appPath, 'utf8')
    const experience = readFileSync(experiencePath, 'utf8')
    const launchStart = app.indexOf('onLaunch((options) => {')
    const launchEnd = app.indexOf('onBeforeUnmount', launchStart)
    const launch = app.slice(launchStart, launchEnd)
    const hydrateAt = launch.indexOf('hydrateMobileExperienceRuntime()')
    const guardAt = launch.indexOf('installMobileNavigationGuard()')
    const useStart = experience.indexOf('export function useMobileExperience')
    const useEnd = experience.indexOf('export function backMobile')
    const useBody = experience.slice(useStart, useEnd)

    assert.equal(app.split('hydrateMobileExperienceRuntime(').length - 1, 1)
    assert.ok(hydrateAt >= 0 && guardAt >= 0 && hydrateAt < guardAt)
    assert.equal(launch.includes('onShow'), false)
    assert.equal(useBody.includes('hydrateMobileExperienceRuntime'), false)
    assert.match(experience, /onShow\(syncMobileTabBar\)/)
    assert.equal(experience.split('createAdaptivePerformanceEngine(').length - 1, 1)
    assert.equal(experience.includes('setInterval'), false)
    assert.equal(experience.includes('setTimeout'), false)
  })
})
