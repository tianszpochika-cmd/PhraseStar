import { computed, onBeforeUnmount, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { mobileExperienceVariables } from '@englishflow/design-tokens/mobile'
import { mobileExperienceMessages } from '@englishflow/i18n/mobile-experience'
import { createAdaptivePerformanceEngine, type PerformanceLevel } from '@englishflow/performance'
import { mobileI18n, mobileThemeController } from './v2-foundation'
import { getUniRuntime, openUniPage } from './uni-runtime'
import { resolveMobileMotion } from '../domain/experience'

for (const [locale, messages] of Object.entries(mobileExperienceMessages)) mobileI18n.registerMessages(locale, messages)
const uiLocale = ref(mobileI18n.locale)
mobileI18n.subscribe((state) => { uiLocale.value = state.locale })
export function mobileT(key: string): string { uiLocale.value; return mobileI18n.t(`mobile.${key}`) }

const QUALITY_KEY = 'yx.performance.level'
const MOTION_KEY = 'yx.mobile.motion'

type StorageRead = { status: 'unavailable' } | { status: 'missing' } | { status: 'value'; value: string }

function readStorage(key: string): StorageRead {
  try {
    const raw = getUniRuntime().getStorageSync(key)
    if (raw === undefined || raw === null || raw === '') return { status: 'missing' }
    return { status: 'value', value: String(raw) }
  } catch {
    return { status: 'unavailable' }
  }
}

const storage = {
  getItem(key: string): string | null {
    const read = readStorage(key)
    return read.status === 'value' ? read.value : null
  },
  setItem(key: string, value: string): void {
    try { getUniRuntime().setStorageSync(key, value) } catch { /* Runtime or storage is unavailable. */ }
  },
  removeItem(key: string): void { getUniRuntime().removeStorageSync(key) },
}

function confirmWrite(key: string, value: string): boolean {
  storage.setItem(key, value)
  const read = readStorage(key)
  return read.status === 'value' && read.value === value
}

function isMotionMode(value: string): value is 'FULL' | 'REDUCED' | 'OFF' {
  return value === 'FULL' || value === 'REDUCED' || value === 'OFF'
}

function isQualityLevel(value: string): value is PerformanceLevel {
  return value === 'Ultra' || value === 'High' || value === 'Medium' || value === 'Performance'
}

let runtimeHydrated = false
let hydrating = false
let motionChosen = false
let qualityChosen = false
let qualitySettled = false
let persistNeedsRetry = false

export const mobileExperienceEngine = createAdaptivePerformanceEngine({ storage })
mobileExperienceEngine.restore()
export const mobileMotionMode = ref('FULL')

function markUnstored(): void {
  persistNeedsRetry = true
  runtimeHydrated = false
}

function applyMotionValue(mode: string, chosen: boolean): boolean {
  const normalized = mode === 'REDUCED' || mode === 'OFF' ? mode : 'FULL'
  if (chosen) motionChosen = true
  mobileMotionMode.value = normalized
  mobileExperienceEngine.setMotionDisabled(normalized === 'OFF' || mobileExperienceEngine.state.reducedMotion)
  const stored = confirmWrite(MOTION_KEY, normalized)
  if (!stored) markUnstored()
  return stored
}

export function setMobileMotion(mode: string): void {
  applyMotionValue(mode, true)
}

export function setMobileQuality(level: PerformanceLevel): void {
  mobileExperienceEngine.setLevel(level, 'manual')
  qualityChosen = true
  qualitySettled = false
  if (!confirmWrite(QUALITY_KEY, level)) markUnstored()
}

export function restoreMobileQualityDefault(): PerformanceLevel {
  try {
    mobileExperienceEngine.resetLevelToAutomatic()
  } catch {
    return mobileExperienceEngine.state.level
  }
  const read = readStorage(QUALITY_KEY)
  if (read.status !== 'missing') {
    if (read.status === 'value' && isQualityLevel(read.value)) mobileExperienceEngine.setLevel(read.value, 'restore')
    return mobileExperienceEngine.state.level
  }
  qualityChosen = false
  qualitySettled = true
  return mobileExperienceEngine.state.level
}

function applyStoredMotion(): boolean {
  const read = readStorage(MOTION_KEY)
  if (read.status === 'unavailable') return false
  if (read.status !== 'value' || !isMotionMode(read.value)) {
    mobileMotionMode.value = 'FULL'
    return true
  }
  return applyMotionValue(read.value, false)
}

/** Read saved quality and motion once storage is reachable. Later calls do not replay a stale snapshot. */
export function hydrateMobileExperienceRuntime(): void {
  if (runtimeHydrated || hydrating) return
  if (readStorage(QUALITY_KEY).status === 'unavailable') return
  hydrating = true
  persistNeedsRetry = false
  try {
    let ok = true
    if (qualityChosen) ok = confirmWrite(QUALITY_KEY, mobileExperienceEngine.state.level) && ok
    else if (!qualitySettled) mobileExperienceEngine.restore()
    if (motionChosen) ok = applyMotionValue(mobileMotionMode.value, true) && ok
    else ok = applyStoredMotion() && ok
    if (ok && !persistNeedsRetry) runtimeHydrated = true
  } finally {
    hydrating = false
  }
}

const initialMotion = readStorage(MOTION_KEY)
if (initialMotion.status === 'unavailable') mobileMotionMode.value = 'FULL'
else if (initialMotion.status === 'value' && isMotionMode(initialMotion.value)) runtimeHydrated = applyMotionValue(initialMotion.value, false)
else {
  mobileMotionMode.value = 'FULL'
  runtimeHydrated = true
}

function syncMobileTabBar(): void {
  const theme = mobileThemeController.resolvedTheme
  const variables = mobileExperienceVariables(theme)
  uni.setTabBarStyle({ color: variables['--yx-text-secondary'], selectedColor: variables['--yx-brand'], backgroundColor: variables['--yx-surface-card'], borderStyle: theme === 'light' ? 'white' : 'black', fail: () => {} })
  const tabs = ['home', 'b2-practice', 'world', 'learn', 'profile']
  const icons = ['home', 'practice', 'world', 'learn', 'profile']
  tabs.forEach((page, index) => uni.setTabBarItem({ index, text: mobileT(`pages.${page}.short`), iconPath: `/static/navigation/${icons[index]}${theme === 'light' ? '' : '-dark'}.png`, selectedIconPath: `/static/navigation/${icons[index]}${theme === 'light' ? '-active' : '-dark-active'}.png`, fail: () => {} }))
}

/** Bind at each page root: native uni-app pages are not descendants of App.vue. */
export function useMobileExperience() {
  const theme = ref(mobileThemeController.resolvedTheme)
  const performance = ref(mobileExperienceEngine.state)
  const unsubscribeTheme = mobileThemeController.subscribe((state) => { theme.value = state.resolvedTheme; syncMobileTabBar() })
  const unsubscribePerformance = mobileExperienceEngine.subscribe((state) => { performance.value = state })
  onBeforeUnmount(() => { unsubscribeTheme(); unsubscribePerformance() })
  onShow(syncMobileTabBar)
  const experienceStyle = computed(() => mobileExperienceVariables(theme.value))
  const experienceMotion = computed(() => resolveMobileMotion(mobileMotionMode.value as 'FULL' | 'REDUCED' | 'OFF', performance.value))
  return { experienceStyle, experienceMotion, theme }
}

export function backMobile(): void {
  if (typeof getCurrentPages === 'function' && getCurrentPages().length > 1) uni.navigateBack({ delta: 1 })
  else openUniPage('/pages/home/home')
}

/** uni-button is a custom element on H5; supply keyboard activation without affecting native taps. */
let keyboardInstalled = false
export function installMobileKeyboard(): void {
  if (typeof document === 'undefined' || keyboardInstalled) return
  keyboardInstalled = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!(target instanceof HTMLElement) || target.tagName !== 'UNI-BUTTON') return
    if (target.hasAttribute('disabled') || target.getAttribute('aria-disabled') === 'true') return
    event.preventDefault()
    target.click()
  })
}
