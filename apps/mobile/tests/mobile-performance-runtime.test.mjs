import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { test } from 'node:test'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const mobileRoot = path.resolve(testDir, '..')
const repoRoot = path.resolve(mobileRoot, '../..')
const experiencePath = path.join(mobileRoot, 'src/platform/experience.ts')
const observerPath = path.join(mobileRoot, 'src/platform/mobile-performance-runtime.ts')
const appPath = path.join(mobileRoot, 'src/App.vue')
const b4Path = path.join(mobileRoot, 'src/stores/b4.ts')
const settingsPath = path.join(mobileRoot, 'src/pages/settings/settings.vue')
const loaderReady = register(new URL('./helpers/mobile-experience-runtime-loader.mjs', import.meta.url), import.meta.url)
if (loaderReady && typeof loaderReady.then === 'function') await loaderReady
// Vue runtime-dom reads document while the module evaluates. Load the real vendor
// modules before a test installs a document that has no createElement.
const vendorRequire = createRequire(path.join(mobileRoot, 'package.json'))
vendorRequire('vue')
vendorRequire('@dcloudio/uni-app')

const QUALITY_KEY = 'yx.performance.level'
const MOTION_KEY = 'yx.mobile.motion'
const LEVELS = ['Ultra', 'High', 'Medium', 'Performance']

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

function rank(level) {
  const index = LEVELS.indexOf(level)
  assert.ok(index >= 0, `unknown level ${level}`)
  return index
}

function installUni(store, controls, info) {
  const runtime = {
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
    getSystemInfoSync() { return info },
  }
  globalThis.uni = runtime
  return runtime
}

function installWindow() {
  globalThis.window = {
    location: { protocol: 'https:' },
    matchMedia() {
      return { matches: false, media: '', addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }
    },
  }
}

async function loadExperience() {
  instance += 1
  return import(`${pathToFileURL(experiencePath).href}?instance=${instance}`)
}

function useHost(setup) {
  const previous = {
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
    uni: globalThis.uni,
    window: globalThis.window,
    document: globalThis.document,
    plus: globalThis.plus,
  }
  delete globalThis.plus
  const host = setup()
  return {
    host,
    async finish() {
      globalThis.setTimeout = previous.setTimeout
      globalThis.clearTimeout = previous.clearTimeout
      if (previous.requestAnimationFrame === undefined) delete globalThis.requestAnimationFrame
      else globalThis.requestAnimationFrame = previous.requestAnimationFrame
      if (previous.cancelAnimationFrame === undefined) delete globalThis.cancelAnimationFrame
      else globalThis.cancelAnimationFrame = previous.cancelAnimationFrame
      if (previous.uni === undefined) delete globalThis.uni
      else globalThis.uni = previous.uni
      if (previous.window === undefined) delete globalThis.window
      else globalThis.window = previous.window
      if (previous.document === undefined) delete globalThis.document
      else globalThis.document = previous.document
      if (previous.plus === undefined) delete globalThis.plus
      else globalThis.plus = previous.plus
    },
  }
}

function installFrameHost() {
  const raf = []
  const timers = []
  const listeners = []
  let frameSeq = 0
  let timerSeq = 0
  const doc = {
    visibilityState: 'visible',
    addEventListener(type, fn) {
      if (type === 'visibilitychange' && !listeners.includes(fn)) listeners.push(fn)
    },
    removeEventListener(type, fn) {
      if (type !== 'visibilitychange') return
      const index = listeners.indexOf(fn)
      if (index >= 0) listeners.splice(index, 1)
    },
  }
  globalThis.document = doc
  globalThis.requestAnimationFrame = (callback) => {
    const id = ++frameSeq
    raf.push({ id, callback })
    return id
  }
  globalThis.cancelAnimationFrame = (id) => {
    const index = raf.findIndex((item) => item.id === id)
    if (index >= 0) raf.splice(index, 1)
  }
  globalThis.setTimeout = (callback, delay) => {
    const id = ++timerSeq
    timers.push({ id, callback, delay })
    return id
  }
  globalThis.clearTimeout = (id) => {
    const index = timers.findIndex((item) => item.id === id)
    if (index >= 0) timers.splice(index, 1)
  }
  return {
    doc,
    raf,
    timers,
    listeners,
    pump(ts) {
      const batch = raf.splice(0, raf.length)
      for (const item of batch) item.callback(ts)
    },
    fireTimer() {
      assert.equal(timers.length, 1)
      const timer = timers.shift()
      timer.callback()
    },
    emitVisibility() {
      for (const listener of [...listeners]) listener()
    },
  }
}

function runWindow(host, step) {
  let ts = 0
  host.pump(ts)
  while (ts < 1000) {
    ts += step
    host.pump(ts)
  }
}

function runGap(host) {
  let ts = 0
  let guard = 0
  host.pump(ts)
  host.pump(16)
  host.pump(32)
  host.pump(400)
  while (host.raf.length > 0 && guard < 200) {
    ts = ts === 0 ? 416 : ts + 16
    host.pump(ts)
    guard += 1
  }
}

serial('two consecutive low H5 windows drop one level; one low, a healthy window, one gap, or a hidden tab does not', async () => {
  const session = useHost(() => {
    installWindow()
    const store = new Map([['yx.account.subject', 'keep']])
    const uni = installUni(store, { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'h5' })
    let memoryOn = 0
    uni.onMemoryWarning = () => { memoryOn += 1 }
    uni.offMemoryWarning = () => { memoryOn += 1 }
    const host = installFrameHost()
    host.store = store
    host.memoryOn = () => memoryOn
    const foreign = () => {}
    host.doc.addEventListener('visibilitychange', foreign)
    host.foreign = foreign
    return host
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    assert.equal(mod.MOBILE_FRAME_WINDOW_MS, 1000)
    assert.equal(mod.MOBILE_FRAME_CADENCE_MS, 4000)
    assert.equal(mod.MOBILE_FRAME_MAX_GAP_MS, 250)
    mod.setMobileQuality('Ultra')
    mod.startMobilePerformanceRuntime()
    mod.startMobilePerformanceRuntime()
    assert.equal(host.listeners.length, 2)
    assert.equal(host.memoryOn(), 0)
    runWindow(host, 16)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    assert.equal(host.raf.length, 0)
    assert.equal(host.timers.length, 1)
    assert.equal(host.timers[0].delay, 4000)
    host.fireTimer()
    runGap(host)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    host.fireTimer()
    runWindow(host, 50)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    host.fireTimer()
    runWindow(host, 16)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    host.fireTimer()
    runWindow(host, 100)
    host.fireTimer()
    runWindow(host, 20)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    host.fireTimer()
    runWindow(host, 50)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    mod.setMobileQuality('Ultra')
    runWindow(host, 50)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    host.fireTimer()
    const stale = host.raf[0]
    host.doc.visibilityState = 'hidden'
    host.emitVisibility()
    assert.equal(host.raf.length, 0)
    assert.equal(host.timers.length, 0)
    host.doc.visibilityState = 'visible'
    host.emitVisibility()
    assert.equal(host.raf.length, 1)
    stale.callback(50_000)
    assert.equal(host.raf.length, 1)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    runWindow(host, 50)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    host.fireTimer()
    runWindow(host, 50)
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    assert.equal(host.raf.length, 0)
    assert.equal(host.timers.length, 1)
    mod.passiveRestoreMobileQuality()
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    assert.equal(host.store.get('yx.account.subject'), 'keep')
    assert.equal(host.memoryOn(), 0)
    mod.stopMobilePerformanceRuntime()
    assert.equal(host.listeners.length, 1)
    assert.equal(host.listeners[0], host.foreign)
    assert.equal(host.timers.length, 0)
    assert.equal(host.raf.length, 0)
  } finally {
    await session.finish()
  }
})

serial('sustained about 3fps foreground windows stay valid and drop one level after two of them', async () => {
  const session = useHost(() => {
    installWindow()
    installUni(new Map(), { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'h5' })
    return installFrameHost()
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    mod.setMobileQuality('Ultra')
    mod.startMobilePerformanceRuntime()
    runWindow(host, 333)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    assert.equal(host.raf.length, 0)
    assert.equal(host.timers.length, 1)
    host.fireTimer()
    runWindow(host, 333)
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.equal(host.raf.length, 0)
    assert.equal(host.timers.length, 1)
    mod.stopMobilePerformanceRuntime()
  } finally {
    await session.finish()
  }
})

serial('repeated sustained windows drop one level and stop scheduling at the floor', async () => {
  const session = useHost(() => {
    installWindow()
    installUni(new Map(), { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'h5' })
    return installFrameHost()
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    mod.setMobileQuality('Ultra')
    mod.startMobilePerformanceRuntime()
    const seen = ['Ultra']
    for (let step = 0; step < 8; step += 1) {
      runWindow(host, 50)
      const level = mod.mobileExperienceEngine.state.level
      if (level !== seen[seen.length - 1]) {
        assert.equal(rank(level), rank(seen[seen.length - 1]) + 1)
        seen.push(level)
      }
      if (level === 'Performance') {
        assert.equal(host.timers.length, 0)
        assert.equal(host.raf.length, 0)
        break
      }
      assert.equal(host.raf.length, 0)
      assert.equal(host.timers.length, 1)
      assert.equal(host.timers[0].delay, 4000)
      host.fireTimer()
    }
    assert.deepEqual(seen, ['Ultra', 'High', 'Medium', 'Performance'])
    assert.equal(host.timers.length, 0)
    assert.equal(host.raf.length, 0)
    mod.stopMobilePerformanceRuntime()
  } finally {
    await session.finish()
  }
})

serial('native memory warnings subscribe once, degrade one step, and remove only the owned callback', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra']])
    const uni = installUni(store, { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'app' })
    const owned = []
    const offArgs = []
    const foreign = () => {}
    owned.push(foreign)
    let rafCalls = 0
    globalThis.requestAnimationFrame = () => { rafCalls += 1; return 1 }
    globalThis.cancelAnimationFrame = () => {}
    globalThis.document = new Proxy({}, { get() { throw new Error('native DOM read') } })
    uni.onMemoryWarning = (callback) => { owned.push(callback) }
    uni.offMemoryWarning = (callback) => {
      offArgs.push(callback)
      const index = owned.indexOf(callback)
      if (index >= 0) owned.splice(index, 1)
    }
    return { store, owned, offArgs, foreign, rafCalls: () => rafCalls }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    mod.startMobilePerformanceRuntime()
    mod.startMobilePerformanceRuntime()
    assert.equal(host.owned.length, 2)
    assert.equal(host.rafCalls(), 0)
    const callback = host.owned[1]
    let previous = 'Ultra'
    for (let step = 0; step < 3; step += 1) {
      callback({ level: 15 })
      assert.equal(rank(mod.mobileExperienceEngine.state.level), rank(previous) + 1)
      previous = mod.mobileExperienceEngine.state.level
    }
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    callback({ level: 5 })
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.stopMobilePerformanceRuntime()
    mod.stopMobilePerformanceRuntime()
    assert.deepEqual(host.offArgs, [callback])
    assert.deepEqual(host.owned, [host.foreign])
    assert.equal(host.rafCalls(), 0)
    mod.disposeMobilePerformanceRuntime()
    assert.deepEqual(host.offArgs, [callback])
  } finally {
    await session.finish()
  }
})

serial('a runtime without both memory register and unregister stays inert', async () => {
  const session = useHost(() => {
    const uni = installUni(new Map(), { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'app' })
    let onCount = 0
    uni.onMemoryWarning = () => { onCount += 1 }
    return { onCount: () => onCount }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    const before = mod.mobileExperienceEngine.state.level
    assert.doesNotThrow(() => mod.startMobilePerformanceRuntime())
    assert.equal(host.onCount(), 0)
    assert.doesNotThrow(() => mod.stopMobilePerformanceRuntime())
    assert.equal(mod.mobileExperienceEngine.state.level, before)
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
  } finally {
    await session.finish()
  }
})

serial('saved manual quality survives a session downgrade, retried hydration, and B4 restore without DOM', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra'], [MOTION_KEY, 'REDUCED'], ['yx.account.subject', 'keep']])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls, { uniPlatform: 'app' })
    let rafCalls = 0
    globalThis.requestAnimationFrame = () => { rafCalls += 1; return 1 }
    globalThis.document = new Proxy({}, { get() { throw new Error('native DOM read') } })
    return { store, controls, rafCalls: () => rafCalls }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    assert.notEqual(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileMotionMode.value, 'FULL')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    const before = mod.mobileExperienceEngine.state.level
    mod.reportMobilePerformanceSignal({ frameRate: 20 })
    const degraded = mod.mobileExperienceEngine.state.level
    assert.equal(rank(degraded), rank(before) + 1)
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    host.controls.getThrows = false
    host.controls.setThrows = false
    host.controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()
    mod.hydrateMobileExperienceRuntime()
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.level, degraded)
    assert.equal(mod.mobileMotionMode.value, 'REDUCED')
    assert.equal(host.store.get(MOTION_KEY), 'REDUCED')
    mod.passiveRestoreMobileQuality()
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, degraded)
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    assert.equal(host.store.get('yx.account.subject'), 'keep')
    mod.startMobilePerformanceRuntime()
    assert.equal(host.rafCalls(), 0)
    mod.stopMobilePerformanceRuntime()
  } finally {
    await session.finish()
  }
})

serial('a choice made before storage returns is kept when a later downgrade retries hydration', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra'], [MOTION_KEY, 'REDUCED']])
    const controls = { getThrows: true, setThrows: true, removeThrows: true }
    installUni(store, controls, { uniPlatform: 'app' })
    return { store, controls }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    mod.setMobileQuality('Medium')
    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.reportMobilePerformanceSignal({ frameRate: 10 })
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    host.controls.getThrows = false
    host.controls.setThrows = false
    host.controls.removeThrows = false
    mod.hydrateMobileExperienceRuntime()
    assert.equal(host.store.get(QUALITY_KEY), 'Medium')
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(host.store.get(MOTION_KEY), 'REDUCED')
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Performance')
    assert.equal(host.store.get(QUALITY_KEY), 'Medium')
  } finally {
    await session.finish()
  }
})

serial('explicit manual choice and automatic reset still own persistence', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra']])
    const controls = { getThrows: false, setThrows: false, removeThrows: false }
    installUni(store, controls, { uniPlatform: 'app' })
    return { store, controls }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    host.controls.removeThrows = true
    let returned = ''
    assert.doesNotThrow(() => { returned = mod.restoreMobileQualityDefault() })
    assert.equal(returned, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    host.controls.removeThrows = false
    mod.reportMobilePerformanceSignal({ frameRate: 20 })
    const degraded = mod.mobileExperienceEngine.state.level
    assert.equal(rank(degraded), rank('Ultra') + 1)
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.setMobileQuality('High')
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(mod.mobileExperienceEngine.state.source, 'manual')
    assert.equal(host.store.get(QUALITY_KEY), 'High')
    mod.hydrateMobileExperienceRuntime()
    assert.equal(host.store.get(QUALITY_KEY), 'High')
    mod.reportMobilePerformanceSignal({ frameRate: 20 })
    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    assert.equal(host.store.get(QUALITY_KEY), 'High')
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Medium')
    const reset = mod.restoreMobileQualityDefault()
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    assert.equal(reset, mod.mobileExperienceEngine.state.level)
    assert.equal(host.store.has(QUALITY_KEY), false)
    assert.notEqual(reset, 'Ultra')
    mod.hydrateMobileExperienceRuntime()
    mod.passiveRestoreMobileQuality()
    assert.equal(host.store.has(QUALITY_KEY), false)
    assert.notEqual(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
  } finally {
    await session.finish()
  }
})

serial('an automatic downgrade does not create a quality key when nothing was saved', async () => {
  const session = useHost(() => {
    const store = new Map([['yx.account.subject', 'keep']])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'app' })
    return { store }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    const before = mod.mobileExperienceEngine.state.level
    mod.reportMobilePerformanceSignal({ frameRate: 20 })
    const degraded = mod.mobileExperienceEngine.state.level
    assert.equal(rank(degraded), rank(before) + 1)
    mod.hydrateMobileExperienceRuntime()
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, degraded)
    assert.equal(host.store.has(QUALITY_KEY), false)
    assert.equal(host.store.has(MOTION_KEY), false)
    assert.equal(host.store.get('yx.account.subject'), 'keep')
  } finally {
    await session.finish()
  }
})

serial('a stale frame or cadence callback does not clear the live handle', async () => {
  const session = useHost(() => {
    installWindow()
    installUni(new Map(), { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'h5' })
    return installFrameHost()
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    mod.setMobileQuality('Ultra')
    mod.startMobilePerformanceRuntime()
    const staleFrame = host.raf[0].callback
    host.doc.visibilityState = 'hidden'
    host.emitVisibility()
    host.doc.visibilityState = 'visible'
    host.emitVisibility()
    const liveFrameId = host.raf[0].id
    staleFrame(1)
    assert.equal(host.raf.length, 1)
    assert.equal(host.raf[0].id, liveFrameId)
    mod.stopMobilePerformanceRuntime()
    assert.equal(host.raf.length, 0)
    mod.startMobilePerformanceRuntime()
    runWindow(host, 16)
    const staleTimer = host.timers[0].callback
    host.doc.visibilityState = 'hidden'
    host.emitVisibility()
    host.doc.visibilityState = 'visible'
    host.emitVisibility()
    runWindow(host, 16)
    const liveTimerId = host.timers[0].id
    staleTimer()
    assert.equal(host.timers.length, 1)
    assert.equal(host.timers[0].id, liveTimerId)
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    mod.stopMobilePerformanceRuntime()
    assert.equal(host.timers.length, 0)
    assert.equal(host.raf.length, 0)
  } finally {
    await session.finish()
  }
})

serial('a delayed native warning after hide, failed unregister, or rebind does not degrade the active session', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra']])
    const uni = installUni(store, { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'app' })
    const owned = []
    const offArgs = []
    const controls = { offThrows: true }
    globalThis.document = new Proxy({}, { get() { throw new Error('native DOM read') } })
    uni.onMemoryWarning = (callback) => { owned.push(callback) }
    uni.offMemoryWarning = (callback) => {
      offArgs.push(callback)
      if (controls.offThrows) throw new Error('off failed')
      const index = owned.indexOf(callback)
      if (index >= 0) owned.splice(index, 1)
    }
    return { store, owned, offArgs, controls }
  })
  try {
    const host = session.host
    const first = await loadExperience()
    assert.equal(first.mobileExperienceEngine.state.level, 'Ultra')
    first.startMobilePerformanceRuntime()
    first.startMobilePerformanceRuntime()
    assert.equal(host.owned.length, 1)
    const stale = host.owned[0]
    first.stopMobilePerformanceRuntime()
    assert.deepEqual(host.offArgs, [stale])
    stale({ level: 1 })
    assert.equal(first.mobileExperienceEngine.state.level, 'Ultra')
    host.controls.offThrows = false
    const second = await loadExperience()
    second.setMobileQuality('Ultra')
    second.startMobilePerformanceRuntime()
    second.startMobilePerformanceRuntime()
    const live = host.owned[host.owned.length - 1]
    assert.notEqual(live, stale)
    stale({ level: 1 })
    assert.equal(second.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(first.mobileExperienceEngine.state.level, 'Ultra')
    live({ level: 1 })
    assert.equal(second.mobileExperienceEngine.state.level, 'High')
    assert.equal(first.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    second.passiveRestoreMobileQuality()
    assert.equal(second.mobileExperienceEngine.state.level, 'High')
    second.stopMobilePerformanceRuntime()
    assert.deepEqual(host.offArgs, [stale, live])
    assert.deepEqual(host.owned, [stale])
  } finally {
    await session.finish()
  }
})

serial('raw engine observe and restore stay unwrapped', async () => {
  const session = useHost(() => {
    const store = new Map([[QUALITY_KEY, 'Ultra']])
    installUni(store, { getThrows: false, setThrows: false, removeThrows: false }, { uniPlatform: 'app' })
    return { store }
  })
  try {
    const host = session.host
    const mod = await loadExperience()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    mod.mobileExperienceEngine.observe({ frameRate: 20 })
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    mod.reportMobilePerformanceSignal({ frameRate: 20 })
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(mod.mobileExperienceEngine.state.source, 'auto')
    mod.passiveRestoreMobileQuality()
    assert.equal(mod.mobileExperienceEngine.state.level, 'High')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
    mod.mobileExperienceEngine.restore()
    assert.equal(mod.mobileExperienceEngine.state.level, 'Ultra')
    assert.equal(mod.mobileExperienceEngine.state.source, 'restore')
    assert.equal(host.store.get(QUALITY_KEY), 'Ultra')
  } finally {
    await session.finish()
  }
})

test('runtime wiring stays on the app foreground seam and does not retarget preference or telemetry', () => {
  const app = readFileSync(appPath, 'utf8')
  const experience = readFileSync(experiencePath, 'utf8')
  const observer = readFileSync(observerPath, 'utf8')
  const b4 = readFileSync(b4Path, 'utf8')
  const settings = readFileSync(settingsPath, 'utf8')
  const launchStart = app.indexOf('onLaunch((options) => {')
  const launchEnd = app.indexOf('onBeforeUnmount', launchStart)
  const launch = app.slice(launchStart, launchEnd)
  const showAt = app.indexOf('onShow(() => { startMobilePerformanceRuntime() })')
  const hideAt = app.indexOf('onHide(() => { stopMobilePerformanceRuntime() })')

  assert.equal(launch.includes('onShow'), false)
  assert.equal(launch.includes('bootstrapMobileAuth(initialPath)'), true)
  assert.ok(launch.indexOf('hydrateMobileExperienceRuntime()') >= 0)
  assert.ok(launch.indexOf('hydrateMobileExperienceRuntime()') < launch.indexOf('installMobileNavigationGuard()'))
  assert.equal(app.split('hydrateMobileExperienceRuntime(').length - 1, 1)
  assert.equal(app.split('bootstrapMobileAuth(').length - 1, 1)
  assert.ok(showAt > launchEnd)
  assert.ok(hideAt > showAt)
  assert.match(app, /disposeMobilePerformanceRuntime\(\)/)
  assert.equal(experience.split('createAdaptivePerformanceEngine(').length - 1, 1)
  assert.equal(experience.includes('setInterval'), false)
  assert.equal(experience.includes('setTimeout'), false)
  assert.equal(experience.includes('requestAnimationFrame'), false)
  assert.equal(experience.includes('onMemoryWarning'), false)
  assert.match(b4, /function restore\(\): void \{ passiveRestoreMobileQuality\(\) \}/)
  assert.doesNotMatch(b4, /mobileExperienceEngine\.restore\(\)/)
  assert.doesNotMatch(experience, /engine\.observe\s*=/)
  assert.doesNotMatch(experience, /engine\.restore\s*=/)
  assert.match(experience, /export function passiveRestoreMobileQuality/)
  assert.match(experience, /export function reportMobilePerformanceSignal/)
  assert.equal(observer.includes('< 30'), false)
  assert.equal(observer.includes('frameRate <'), false)
  assert.match(observer, /MOBILE_FRAME_CADENCE_MS = 4000/)
  assert.doesNotMatch(b4, /createAdaptivePerformanceEngine/)
  assert.match(settings, /savePreferences\(\{ themeMode: themeMode\.value, highContrast: highContrast\.value, motionMode: motionMode\.value \}\)/)
  assert.doesNotMatch(observer, /networkQuality|deviceMemory|performance\.memory|offlineStoragePressure|fetch\(|XMLHttpRequest|WebSocket|setInterval/)
  assert.match(observer, /onMemoryWarning/)
  assert.match(observer, /offMemoryWarning/)
  assert.match(observer, /visibilitychange/)
  assert.equal(readFileSync(path.join(repoRoot, 'packages/performance/src/index.ts'), 'utf8').includes('signal.frameRate < 30'), true)
})
