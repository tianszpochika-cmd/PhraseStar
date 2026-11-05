import type { PerformanceLevel, PerformanceSignal } from '@englishflow/performance'
import { getUniRuntime, isNativeAppRuntime, type UniRuntime } from './uni-runtime'

/** Bounded H5 measurement window. The engine, not this sampler, decides whether the rate is low. */
export const MOBILE_FRAME_WINDOW_MS = 1000
/** Quiet gap between windows. About four seconds, not a tight loop. */
export const MOBILE_FRAME_CADENCE_MS = 4000
/** Each gap contributes at most this much time to the one-second measurement. */
export const MOBILE_FRAME_MAX_GAP_MS = 250
/** A window needs a run of frames so one timestamp cannot count as continuous time. */
export const MOBILE_FRAME_MIN_SAMPLES = 4

type MemoryCallback = (result: { level?: number }) => void
type FrameSignal = Pick<PerformanceSignal, 'frameRate' | 'memoryPressure'>

interface MemoryApi {
  on(callback: MemoryCallback): void
  off(callback: MemoryCallback): void
}

let observeSignal: (signal: FrameSignal) => void = () => {}
let readLevel: () => PerformanceLevel = () => 'Performance'
let foreground = false
let mode: 'idle' | 'sampling' | 'waiting' = 'idle'
let token = 0
let frames = 0
let lastTs = 0
let measuredMs = 0
let discarded = false
let frameHandle: number | null = null
let timerHandle: ReturnType<typeof setTimeout> | null = null
let visibilityHandler: (() => void) | null = null
let memoryCallback: MemoryCallback | null = null
let memoryApi: MemoryApi | null = null
/** First of two consecutive valid foreground windows. Hidden, stale, discarded, or manual reset clears it. */
let pendingFrameRate: number | null = null

function clearFrameEvidence(): void {
  pendingFrameRate = null
}

/** The engine owns the low-rate threshold. Two valid rates are combined by passing the higher one. */
function noteMeasuredFrameRate(fps: number): void {
  if (pendingFrameRate == null) {
    pendingFrameRate = fps
    return
  }
  const frameRate = Math.max(pendingFrameRate, fps)
  pendingFrameRate = null
  observeSignal({ frameRate })
}

function canSampleFrames(): boolean {
  if (isNativeAppRuntime()) return false
  if (typeof globalThis.requestAnimationFrame !== 'function' || typeof globalThis.cancelAnimationFrame !== 'function') return false
  const doc = globalThis.document
  return Boolean(doc && typeof doc.visibilityState === 'string' && typeof doc.addEventListener === 'function')
}

function isDocumentVisible(): boolean {
  const doc = globalThis.document
  return Boolean(doc && doc.visibilityState === 'visible')
}

function readMemoryApi(): MemoryApi | null {
  try {
    if (!isNativeAppRuntime()) return null
    const runtime = getUniRuntime() as UniRuntime & {
      onMemoryWarning?: (callback: MemoryCallback) => void
      offMemoryWarning?: (callback: MemoryCallback) => void
    }
    if (typeof runtime.onMemoryWarning !== 'function' || typeof runtime.offMemoryWarning !== 'function') return null
    const on = runtime.onMemoryWarning.bind(runtime)
    const off = runtime.offMemoryWarning.bind(runtime)
    return { on: (callback) => { on(callback) }, off: (callback) => { off(callback) } }
  } catch {
    return null
  }
}

function cancelScheduledSampling(): void {
  token += 1
  mode = 'idle'
  frames = 0
  lastTs = 0
  measuredMs = 0
  discarded = false
  clearFrameEvidence()
  if (frameHandle != null && typeof globalThis.cancelAnimationFrame === 'function') {
    try { globalThis.cancelAnimationFrame(frameHandle) } catch { /* The page can drop the frame callback first. */ }
  }
  frameHandle = null
  if (timerHandle != null) {
    globalThis.clearTimeout(timerHandle)
    timerHandle = null
  }
}

function queueFrame(current: number): void {
  if (current !== token || mode !== 'sampling') return
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    cancelScheduledSampling()
    return
  }
  frameHandle = globalThis.requestAnimationFrame((ts: number) => {
    if (current !== token || mode !== 'sampling') return
    frameHandle = null
    onFrame(current, ts)
  })
}

function armCadence(current: number): void {
  if (current !== token || typeof globalThis.setTimeout !== 'function') return
  mode = 'waiting'
  timerHandle = globalThis.setTimeout(() => {
    if (current !== token || mode !== 'waiting') return
    timerHandle = null
    mode = 'idle'
    beginWindow()
  }, MOBILE_FRAME_CADENCE_MS)
}

function onFrame(current: number, ts: number): void {
  if (current !== token || mode !== 'sampling') return
  if (!foreground || !isDocumentVisible() || readLevel() === 'Performance') {
    cancelScheduledSampling()
    return
  }
  if (frames === 0) {
    lastTs = ts
    frames = 1
    queueFrame(current)
    return
  }
  const gap = ts - lastTs
  if (!Number.isFinite(gap) || gap < 0) {
    discarded = true
    completeWindow(current)
    return
  }
  measuredMs += Math.min(gap, MOBILE_FRAME_MAX_GAP_MS)
  lastTs = ts
  frames += 1
  if (measuredMs < MOBILE_FRAME_WINDOW_MS) {
    queueFrame(current)
    return
  }
  completeWindow(current)
}

function completeWindow(current: number): void {
  if (current !== token || mode !== 'sampling') return
  const elapsed = measuredMs
  const report = !discarded && frames >= MOBILE_FRAME_MIN_SAMPLES && elapsed >= MOBILE_FRAME_WINDOW_MS
  const fps = report ? ((frames - 1) * 1000) / elapsed : 0
  mode = 'idle'
  frames = 0
  lastTs = 0
  measuredMs = 0
  discarded = false
  if (foreground && isDocumentVisible() && readLevel() !== 'Performance') armCadence(current)
  if (report && Number.isFinite(fps)) {
    noteMeasuredFrameRate(fps)
    if (readLevel() === 'Performance') cancelScheduledSampling()
  } else clearFrameEvidence()
}

function beginWindow(): void {
  if (mode !== 'idle' || !foreground || !canSampleFrames() || !isDocumentVisible() || readLevel() === 'Performance') return
  mode = 'sampling'
  frames = 0
  lastTs = 0
  measuredMs = 0
  discarded = false
  queueFrame(token)
}

function onVisibilityChange(): void {
  if (!foreground || !isDocumentVisible() || readLevel() === 'Performance') {
    cancelScheduledSampling()
    return
  }
  if (mode === 'idle') beginWindow()
}

function subscribeVisibility(): void {
  if (visibilityHandler || !canSampleFrames()) return
  const doc = globalThis.document
  if (!doc || typeof doc.addEventListener !== 'function') return
  visibilityHandler = onVisibilityChange
  doc.addEventListener('visibilitychange', visibilityHandler)
}

function unsubscribeVisibility(): void {
  const handler = visibilityHandler
  if (!handler) return
  visibilityHandler = null
  try { globalThis.document?.removeEventListener('visibilitychange', handler) } catch { /* The document can go away with the page. */ }
}

function ensureMemorySubscription(): void {
  if (memoryCallback) return
  const api = readMemoryApi()
  if (!api) return
  const callback: MemoryCallback = () => {
    if (!foreground || memoryCallback !== callback) return
    observeSignal({ memoryPressure: true })
    if (!foreground || memoryCallback !== callback) return
    if (readLevel() === 'Performance') cancelScheduledSampling()
  }
  memoryCallback = callback
  memoryApi = api
  try { api.on(callback) } catch {
    if (memoryCallback === callback) {
      memoryCallback = null
      memoryApi = null
    }
  }
}

function releaseMemorySubscription(): void {
  if (!memoryCallback || !memoryApi) return
  const callback = memoryCallback
  const api = memoryApi
  memoryCallback = null
  memoryApi = null
  try { api.off(callback) } catch { /* Unregister only the callback this runtime registered. */ }
}

export function bindMobilePerformanceRuntime(binding: {
  observe(signal: FrameSignal): void
  level(): PerformanceLevel
}): void {
  stopMobilePerformanceRuntime()
  observeSignal = (signal) => { binding.observe(signal) }
  readLevel = () => binding.level()
}

/** Foreground entry. Repeating this does not stack memory or visibility callbacks. */
export function startMobilePerformanceRuntime(): void {
  foreground = true
  ensureMemorySubscription()
  subscribeVisibility()
  beginWindow()
}

/** Drop an in-flight window after an explicit level change, then sample only while above the floor. */
export function syncMobilePerformanceSampling(): void {
  clearFrameEvidence()
  if (!foreground) return
  cancelScheduledSampling()
  if (readLevel() === 'Performance') return
  beginWindow()
}

/** Leave the foreground: stop the cadence and remove only callbacks owned here. */
export function stopMobilePerformanceRuntime(): void {
  foreground = false
  cancelScheduledSampling()
  unsubscribeVisibility()
  releaseMemorySubscription()
}

export function disposeMobilePerformanceRuntime(): void {
  stopMobilePerformanceRuntime()
}
