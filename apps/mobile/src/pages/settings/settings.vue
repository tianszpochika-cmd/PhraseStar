<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileThemeController, mobileI18n } from '../../platform/v2-foundation'
import { b10ContentLocale, b10UiLocale } from '../../platform/b10-foundation'
import { mobileExperienceEngine, mobileMotionMode, mobileT, restoreMobileQualityDefault, setMobileMotion, setMobileQuality, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { privacyNotices } from '../../domain/it7-closure'
import { readMobileClosureBoard } from '../../api/support'
import { withdrawLearningConsent } from '../../api/learning-consent-withdrawal'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import { listB12NotificationPreferences, updateB12NotificationPreference } from '../../api/b12'
import { DEFAULT_NOTIFICATION_DND_WINDOW, NOTIFICATION_CATEGORIES, NOTIFICATION_DND_OFF, isNotificationDndEnabled, makeNotificationPreferenceCommand, notificationPreferenceMatchesCommand, type NotificationCategory, type NotificationChannel } from '../../domain/notification-preferences'
import type { M1016NotificationPreference, M1016NotificationPreferenceCommand } from '@englishflow/contracts'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { interpolate } from '@englishflow/i18n'
import { hasPendingMobilePreferenceSync, sameMobilePreferenceIdentity, setPendingMobilePreferenceSync, transitionMobilePreferenceSubject } from '../../domain/mobile-preference-sync'
import type { PerformanceLevel } from '@englishflow/performance'
import type { MobileMotionMode, MobileThemeMode } from '../../domain/learner-content'

const store = useLearnerContentStore()
const privacyLines = ref<string[]>([])
const withdrawConfirming = ref(false)
const withdrawing = ref(false)
const withdrawNotice = ref('')
const session = useSessionStore()
function preferenceSyncStorage() { try { return getUniRuntime() } catch { return null } }
let preferenceSubject: string | null = null
let settingsVisible = false
let saveEpoch = 0
let notificationEpoch = 0
function syncPreferenceSubject(subject: string | null | undefined): void {
  const scope = transitionMobilePreferenceSubject(preferenceSubject, subject, preferenceSyncStorage())
  preferenceSubject = scope.subject
  preferenceDraftDirty.value = scope.pendingSync
}
const initialPreferenceScope = transitionMobilePreferenceSubject(null, session.verifiedSubject, preferenceSyncStorage())
preferenceSubject = initialPreferenceScope.subject

const resolvedTheme = ref(mobileThemeController.resolvedTheme)
const unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })
const restoreNotice = ref('')
const localeRetryIndex = ref(b10ContentLocale.value === 'zh-CN' ? 1 : 0)
const withdrawSucceeded = ref(false)
const profileNavError = ref('')
const profileNavBusy = ref(false)

type ElementRef = HTMLElement | { $el?: HTMLElement } | null
const withdrawDialogRef = ref<ElementRef>(null)
const withdrawCancelRef = ref<ElementRef>(null)
const withdrawResultRef = ref<ElementRef>(null)
const settingsRootRef = ref<ElementRef>(null)
let previousFocus: HTMLElement | null = null
let withdrawFocusGeneration = 0
let profileNavGeneration = 0

const iconGlow = '/static/figma-settings-169-10755/imgGlow.svg'
const iconBack = '/static/figma-settings-169-10755/imgIconChevL.svg'
const iconTrackOff = '/static/figma-settings-169-10755/imgTrackOff.svg'
const iconTrackOn = '/static/figma-settings-169-10852/imgTrackOn.svg'
const iconDot = '/static/figma-settings-169-11760/imgDot.svg'
const iconDot1 = '/static/figma-settings-169-11760/imgDot1.svg'
const iconDot2 = '/static/figma-settings-169-11760/imgDot2.svg'
const iconChevR = '/static/figma-settings-169-11915/imgIconChevR.svg'
const iconMaterialInfo = '/static/figma-settings-169-11760/imgMaterialInfo.svg'
const iconMaterialError = '/static/figma-settings-169-10652/imgMaterialError.svg'
const iconAlert = '/static/figma-settings-169-11619/imgIconAlert.svg'
const iconCheck = '/static/figma-settings-169-11343/imgIconCheckCircle.svg'

function settingsT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`settingsPage.${key}`)
  return values ? interpolate(message, values) : message
}

const themeMode = ref<MobileThemeMode>(mobileThemeController.theme === 'dark' ? 'DARK' : mobileThemeController.theme === 'light' ? 'LIGHT' : 'SYSTEM')
const motionMode = ref<MobileMotionMode>(mobileMotionMode.value as MobileMotionMode)
const highContrast = ref(mobileThemeController.theme === 'high-contrast')
const qualityLevel = ref<PerformanceLevel>(mobileExperienceEngine.state.level)
const preferenceDraftDirty = ref(initialPreferenceScope.pendingSync)
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')
const localeSaving = ref(false)
const localeSaved = ref(false)
const localeError = ref('')
let applyingAccountPreferences = false
type NotificationSetting = { category: NotificationCategory; label: string; enabled: boolean; unsupportedCadence: boolean }
type NotificationDndRetryTarget = { enabled: boolean; startLocalTime: string; endLocalTime: string }
const notificationSettings = ref<NotificationSetting[]>([])
const notificationRows = ref<M1016NotificationPreference[]>([])
const notificationStatus = ref<'loading' | 'ready' | 'error'>('loading')
const notificationBusy = ref<string | null>(null)
const notificationError = ref('')
const notificationSuccess = ref('')
const notificationDndEnabled = ref(false)
const notificationDndStart = ref(DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime)
const notificationDndEnd = ref(DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime)
const notificationDndDirty = ref(false)
const notificationDndConflict = ref(false)
const notificationDndRetryPending = ref(false)
const notificationDndRetryTarget = ref<NotificationDndRetryTarget | null>(null)
watch([themeMode, highContrast], () => mobileThemeController.setTheme(highContrast.value ? 'high-contrast' : themeMode.value.toLowerCase() as 'light' | 'dark' | 'system'))
watch(motionMode, (mode) => setMobileMotion(mode))
watch([themeMode, highContrast, motionMode], () => {
  if (applyingAccountPreferences) return
  const subject = session.verifiedSubject
  if (!subject || subject !== preferenceSubject) return
  preferenceDraftDirty.value = true
  saved.value = false
  saveError.value = ''
  setPendingMobilePreferenceSync(subject, true, preferenceSyncStorage())
}, { flush: 'sync' })
watch([() => session.verifiedSubject, () => session.identityRevision], ([subject]) => {
  syncPreferenceSubject(subject)
  saveEpoch += 1
  saving.value = false
  saved.value = false
  saveError.value = ''
  localeSaving.value = false
  localeSaved.value = false
  localeError.value = ''
  notificationEpoch += 1
  notificationSettings.value = []
  notificationRows.value = []
  notificationStatus.value = 'loading'
  notificationBusy.value = null
  notificationError.value = ''
  notificationSuccess.value = ''
  notificationDndEnabled.value = false
  notificationDndStart.value = DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime
  notificationDndEnd.value = DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime
  notificationDndDirty.value = false
  notificationDndConflict.value = false
  notificationDndRetryPending.value = false
  notificationDndRetryTarget.value = null
  withdrawing.value = false
  withdrawSucceeded.value = false
  withdrawNotice.value = ''
  restoreNotice.value = ''
  withdrawFocusGeneration += 1
  withdrawConfirming.value = false
  previousFocus = null
  profileNavGeneration += 1
  profileNavBusy.value = false
  profileNavError.value = ''
  applyingAccountPreferences = true
  try {
    themeMode.value = 'SYSTEM'
    highContrast.value = false
    motionMode.value = 'FULL'
  } finally { applyingAccountPreferences = false }
  if (settingsVisible && subject && session.getMobileApiIdentity()) {
    void loadAccountPreferences()
    void loadNotificationSettings()
  }
}, { flush: 'post' })
const unsubscribeQuality = mobileExperienceEngine.subscribe((state) => { qualityLevel.value = state.level })
const themeOptions: Array<{ value: MobileThemeMode; labelKey: string; descKey: string }> = [{ value: 'SYSTEM', labelKey: 'appearance.themeSystem', descKey: 'appearance.themeSystemDescription' }, { value: 'LIGHT', labelKey: 'appearance.themeLight', descKey: 'appearance.themeLightDescription' }, { value: 'DARK', labelKey: 'appearance.themeDark', descKey: 'appearance.themeDarkDescription' }]
const motionOptions: Array<{ value: MobileMotionMode; labelKey: string }> = [{ value: 'FULL', labelKey: 'appearance.motionFull' }, { value: 'REDUCED', labelKey: 'appearance.motionReduced' }, { value: 'OFF', labelKey: 'appearance.motionOff' }]
const qualityOptions: Array<{ value: PerformanceLevel; labelKey: string }> = [{ value: 'Ultra', labelKey: 'quality.ultra' }, { value: 'High', labelKey: 'quality.high' }, { value: 'Medium', labelKey: 'quality.medium' }, { value: 'Performance', labelKey: 'quality.performance' }]
const GOAL_KEYS: Record<string, string> = { FOUNDATION: 'FOUNDATION', ZERO_BASIS: 'FOUNDATION', COLLEGE_CET: 'COLLEGE_CET', CET_4_6: 'COLLEGE_CET', POSTGRADUATE_ENGLISH: 'POSTGRADUATE_ENGLISH', POSTGRADUATE: 'POSTGRADUATE_ENGLISH', WORKPLACE_DAILY: 'WORKPLACE_DAILY' }
const goalLabel = computed(() => {
  const code = store.account.goal
  if (!code) return settingsT('learning.notSet')
  const key = GOAL_KEYS[code]
  if (key) return mobileT(`onboarding.goals.${key}.label`)
  return store.goals.find((item) => item.value === code)?.label || mobileT('profile.goalUnknown')
})
const quotaLabel = computed(() => store.account.quota && store.account.quota > 0
  ? settingsT('learning.minutes', { count: mobileI18n.formatNumber(store.account.quota) })
  : settingsT('learning.notSet'))
const accountLoading = computed(() => store.accountStatus === 'idle' || store.accountStatus === 'loading')
const accountError = computed(() => !accountLoading.value && store.accountStatus !== 'ready' && !saveError.value && !localeError.value)
const LOCALE_KEYS: Record<string, string> = { 'zh-CN': 'language.localeZhCN', 'en-US': 'language.localeEnUS', 'en-GB': 'language.localeEnGB', 'de-DE': 'language.localeDeDE', 'fr-FR': 'language.localeFrFR', 'es-ES': 'language.localeEsES' }
function localeName(code: string): string { return settingsT(LOCALE_KEYS[code] || 'language.localeUnknown') }
function notificationLabel(category: string): string {
  const key = category === 'STUDY_ROOM' ? 'studyRoom' : category.toLowerCase()
  return settingsT(`notifications.category.${key}`)
}
function chooseTheme(value: MobileThemeMode): void {
  themeMode.value = value
  restoreNotice.value = ''
  saved.value = false
  saveError.value = ''
}
function chooseMotion(value: MobileMotionMode): void {
  motionMode.value = value
  restoreNotice.value = ''
  saved.value = false
  saveError.value = ''
}
function toggleHighContrast(): void {
  highContrast.value = !highContrast.value
  restoreNotice.value = ''
  saved.value = false
  saveError.value = ''
}
async function retryContentLocale(): Promise<void> {
  await selectContentLocale(localeRetryIndex.value)
}
function asElement(value: ElementRef): HTMLElement | null {
  const candidate = value && '$el' in value ? value.$el : value
  return typeof HTMLElement !== 'undefined' && candidate instanceof HTMLElement ? candidate : null
}
function focusElement(value: ElementRef): void {
  const target = asElement(value)
  if (target && typeof target.focus === 'function') target.focus()
}
function openWithdrawConfirm(): void {
  if (withdrawing.value || withdrawConfirming.value) return
  previousFocus = typeof document !== 'undefined' && typeof HTMLElement !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  withdrawConfirming.value = true
  const generation = ++withdrawFocusGeneration
  void nextTick(() => { if (generation === withdrawFocusGeneration && withdrawConfirming.value) focusElement(withdrawCancelRef.value) })
}
function closeWithdraw(force = false): void {
  if (withdrawing.value && !force) return
  withdrawFocusGeneration += 1
  withdrawConfirming.value = false
  const target = previousFocus
  previousFocus = null
  if (target && target.isConnected && typeof target.focus === 'function') target.focus()
}
function cancelWithdraw(): void { closeWithdraw() }
type FocusStyleSnapshot = { outline: string; outlinePriority: string; offset: string; offsetPriority: string; radius: string; radiusPriority: string }
const focusStyleSnapshots = new Map<HTMLElement, FocusStyleSnapshot>()
function settingsBackFrom(target: EventTarget | null, root: HTMLElement | null = asElement(settingsRootRef.value)): HTMLElement | null {
  const element = target as HTMLElement | null
  if (!element || !root || root.isConnected === false) return null
  return element.classList?.contains('mobile-back') && root.contains(element) ? element : null
}
function applyBackFocus(back: HTMLElement | null): void {
  const icon = back?.querySelector<HTMLElement>('.mobile-back-icon')
  if (!icon) return
  if (!focusStyleSnapshots.has(icon)) {
    focusStyleSnapshots.set(icon, {
      outline: icon.style.getPropertyValue('outline'), outlinePriority: icon.style.getPropertyPriority('outline'),
      offset: icon.style.getPropertyValue('outline-offset'), offsetPriority: icon.style.getPropertyPriority('outline-offset'),
      radius: icon.style.getPropertyValue('border-radius'), radiusPriority: icon.style.getPropertyPriority('border-radius'),
    })
  }
  icon.style.setProperty('outline', '2px solid currentColor', 'important')
  icon.style.setProperty('outline-offset', '2px')
  icon.style.setProperty('border-radius', '50%')
}
function restoreProperty(element: HTMLElement, name: string, value: string, priority: string): void {
  if (value) element.style.setProperty(name, value, priority)
  else element.style.removeProperty(name)
}
function restoreBackFocus(back: HTMLElement | null): void {
  const icon = back?.querySelector<HTMLElement>('.mobile-back-icon')
  if (!icon) return
  const saved = focusStyleSnapshots.get(icon)
  if (!saved) return
  restoreProperty(icon, 'outline', saved.outline, saved.outlinePriority)
  restoreProperty(icon, 'outline-offset', saved.offset, saved.offsetPriority)
  restoreProperty(icon, 'border-radius', saved.radius, saved.radiusPriority)
  focusStyleSnapshots.delete(icon)
}
function cleanupFocusDecorations(): void {
  for (const icon of Array.from(focusStyleSnapshots.keys())) {
    const saved = focusStyleSnapshots.get(icon)
    if (!saved) continue
    restoreProperty(icon, 'outline', saved.outline, saved.outlinePriority)
    restoreProperty(icon, 'outline-offset', saved.offset, saved.offsetPriority)
    restoreProperty(icon, 'border-radius', saved.radius, saved.radiusPriority)
    focusStyleSnapshots.delete(icon)
  }
}
function onSettingsFocusIn(event: FocusEvent): void { applyBackFocus(settingsBackFrom(event.target)) }
function onSettingsFocusOut(event: FocusEvent): void { restoreBackFocus(settingsBackFrom(event.target)) }
let focusListenersAttached = false
function attachSettingsFocus(): void {
  if (typeof document === 'undefined') return
  const root = asElement(settingsRootRef.value)
  if (!root || focusListenersAttached) return
  root.addEventListener('focusin', onSettingsFocusIn)
  root.addEventListener('focusout', onSettingsFocusOut)
  focusListenersAttached = true
}
function detachSettingsFocus(): void {
  const root = asElement(settingsRootRef.value)
  if (focusListenersAttached && root) {
    root.removeEventListener('focusin', onSettingsFocusIn)
    root.removeEventListener('focusout', onSettingsFocusOut)
  }
  focusListenersAttached = false
  cleanupFocusDecorations()
}
function focusableInDialog(): HTMLElement[] {
  const dialog = asElement(withdrawDialogRef.value)
  if (!dialog) return []
  return Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => element.tabIndex !== -1 && (element.offsetParent !== null || element === document.activeElement))
}
function onWithdrawKeydown(event: KeyboardEvent): void {
  if (!withdrawConfirming.value || typeof document === 'undefined') return
  if (event.key === 'Escape') {
    if (withdrawing.value) return
    event.preventDefault()
    closeWithdraw()
    return
  }
  if (event.key !== 'Tab') return
  const dialog = asElement(withdrawDialogRef.value)
  if (!dialog) return
  const items = focusableInDialog()
  if (!items.length) { event.preventDefault(); return }
  const first = items[0] as HTMLElement
  const last = items[items.length - 1] as HTMLElement
  const active = document.activeElement as HTMLElement | null
  const inside = Boolean(active && dialog.contains(active))
  if (event.shiftKey && (!inside || active === first)) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (!inside || active === last)) { event.preventDefault(); first.focus() }
}
async function returnToProfile(): Promise<void> {
  if (profileNavBusy.value) return
  const generation = ++profileNavGeneration
  profileNavError.value = ''
  profileNavBusy.value = true
  try {
    await Promise.resolve(openUniPage('/pages/profile/profile'))
  } catch {
    if (generation === profileNavGeneration) profileNavError.value = mobileT('forbidden.navigationFailed')
  } finally {
    if (generation === profileNavGeneration) profileNavBusy.value = false
  }
}

function restoreDisplayDefaults(): void {
  if (saving.value || localeSaving.value) return
  themeMode.value = 'SYSTEM'
  highContrast.value = false
  motionMode.value = 'FULL'
  restoreMobileQualityDefault()
  const subject = session.verifiedSubject
  preferenceDraftDirty.value = Boolean(subject && subject === preferenceSubject)
  saved.value = false
  saveError.value = ''
  restoreNotice.value = settingsT('appearance.restored')
  if (preferenceDraftDirty.value && subject) setPendingMobilePreferenceSync(subject, true, preferenceSyncStorage())
}

onShow(async () => {
  if (!await ensureMobilePageAccess('/pages/settings/settings')) { settingsVisible = false; return }
  settingsVisible = true
  attachSettingsFocus()
  syncPreferenceSubject(session.verifiedSubject)
  void loadNotificationSettings()
  privacyLines.value = privacyNotices(await readMobileClosureBoard().catch(() => null))
  await loadAccountPreferences()
})

async function confirmWithdrawLearningConsent(): Promise<void> {
  if (withdrawing.value) return
  withdrawing.value = true
  withdrawNotice.value = ''
  try {
    const result = await withdrawLearningConsent(`withdraw-adult-learning-${Date.now()}`)
    withdrawSucceeded.value = result.withdrawn
    withdrawNotice.value = result.withdrawn ? settingsT('privacy.revoked') : settingsT('privacy.revokeFailed')
    if (result.withdrawn) {
      withdrawConfirming.value = false
      previousFocus = null
      const generation = ++withdrawFocusGeneration
      void nextTick(() => { if (generation === withdrawFocusGeneration) { const result = asElement(withdrawResultRef.value); if (result) { result.focus({ preventScroll: true }); result.scrollIntoView({ block: 'center' }) } } })
      if (typeof session.markLearningConsentWithdrawn === 'function') session.markLearningConsentWithdrawn()
      if (typeof store.forgetOnboardingResume === 'function') store.forgetOnboardingResume()
    }
  } catch {
    withdrawSucceeded.value = false
    withdrawNotice.value = settingsT('privacy.revokeFailed')
  } finally {
    withdrawing.value = false
  }
}

onHide(() => {
  detachSettingsFocus()
  settingsVisible = false
  withdrawFocusGeneration += 1
  withdrawConfirming.value = false
  previousFocus = null
  profileNavGeneration += 1
  profileNavBusy.value = false
  profileNavError.value = ''
})
onMounted(() => {
  if (typeof document !== 'undefined') document.addEventListener('keydown', onWithdrawKeydown)
  attachSettingsFocus()
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onWithdrawKeydown)
  detachSettingsFocus()
  withdrawFocusGeneration += 1
  withdrawConfirming.value = false
  previousFocus = null
  profileNavGeneration += 1
  unsubscribeQuality()
  unsubscribeTheme()
})

async function loadAccountPreferences(): Promise<void> {
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  syncPreferenceSubject(identity.subject)
  await store.loadAccount()
  if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
  if (store.accountStatus !== 'ready' || store.lastError) return
  if (preferenceDraftDirty.value || hasPendingMobilePreferenceSync(identity.subject, preferenceSyncStorage())) {
    preferenceDraftDirty.value = true
    return
  }
  applyingAccountPreferences = true
  try {
    themeMode.value = store.account.themeMode
    motionMode.value = store.account.motionMode
    highContrast.value = store.account.highContrast
  } finally { applyingAccountPreferences = false }
}

async function loadNotificationSettings(): Promise<void> {
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  const epoch = ++notificationEpoch
  notificationStatus.value = 'loading'
  notificationError.value = ''
  notificationSuccess.value = ''
  try {
    const rows = await listB12NotificationPreferences()
    if (epoch !== notificationEpoch || !sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationRows.value = rows
    notificationSettings.value = NOTIFICATION_CATEGORIES.map(({ category, label }) => {
      const row = preferenceFor(category, 'IN_APP', rows)
      return {
        category,
        label,
        enabled: row?.enabled === true,
        unsupportedCadence: row?.frequencyPolicy === 'DAILY_DIGEST' || row?.frequencyPolicy === 'WEEKLY_DIGEST',
      }
    })
    const inAppRows = rows.filter(row => row.channel === 'IN_APP')
    const configuredWindow = inAppRows.find(row => isNotificationDndEnabled(row.dndWindow))?.dndWindow
    const distinctWindows = new Set(inAppRows.map(row => isNotificationDndEnabled(row.dndWindow)
      ? `${row.dndWindow.startLocalTime}/${row.dndWindow.endLocalTime}`
      : 'OFF'))
    notificationDndConflict.value = distinctWindows.size > 1
    const retryTarget = notificationDndRetryTarget.value
    if (retryTarget) {
      notificationDndEnabled.value = retryTarget.enabled
      notificationDndStart.value = retryTarget.startLocalTime
      notificationDndEnd.value = retryTarget.endLocalTime
      notificationDndDirty.value = true
    } else {
      notificationDndEnabled.value = Boolean(configuredWindow)
      notificationDndStart.value = configuredWindow?.startLocalTime ?? DEFAULT_NOTIFICATION_DND_WINDOW.startLocalTime
      notificationDndEnd.value = configuredWindow?.endLocalTime ?? DEFAULT_NOTIFICATION_DND_WINDOW.endLocalTime
      notificationDndDirty.value = false
    }
    notificationStatus.value = 'ready'
  } catch {
    if (epoch !== notificationEpoch || !sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationSettings.value = []
    notificationRows.value = []
    notificationStatus.value = 'error'
    notificationError.value = settingsT('notifications.errorInline')
  }
}

async function toggleNotification(setting: NotificationSetting): Promise<void> {
  if (notificationBusy.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  notificationBusy.value = setting.category
  notificationError.value = ''
  notificationSuccess.value = ''
  const current = preferenceFor(setting.category, 'IN_APP')
  const command = makeNotificationPreferenceCommand(
    setting.category,
    !setting.enabled,
    current,
    current?.dndWindow ?? (notificationDndEnabled.value
      ? { startLocalTime: notificationDndStart.value, endLocalTime: notificationDndEnd.value }
      : NOTIFICATION_DND_OFF),
    setting.enabled ? 'DISABLED' : 'IMMEDIATE',
  )
  try {
    await updateB12NotificationPreference(setting.category, 'IN_APP', command)
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (notificationStatus.value === 'ready'
      && notificationPreferenceMatchesCommand(preferenceFor(setting.category, 'IN_APP'), command)) {
      notificationSuccess.value = settingsT('notifications.currentSettings')
      return
    }
    notificationError.value = notificationStatus.value === 'ready'
      ? settingsT('notifications.saveFailedLatest')
      : settingsT('notifications.saveFailedUnreadable')
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) notificationBusy.value = null
  }
}

function preferenceFor(category: NotificationCategory, channel: NotificationChannel, rows = notificationRows.value): M1016NotificationPreference | undefined {
  return rows.find(row => row.category === category && row.channel === channel)
}

function onNotificationDndTimeChange(which: 'start' | 'end', value: string): void {
  if (which === 'start') notificationDndStart.value = value
  else notificationDndEnd.value = value
  notificationDndDirty.value = true
}

async function saveNotificationDnd(enabled: boolean): Promise<void> {
  if (notificationBusy.value) return
  if (enabled && notificationDndStart.value === notificationDndEnd.value) {
    notificationError.value = settingsT('notifications.startEndEqual')
    return
  }
  const identity = session.getMobileApiIdentity()
  if (!identity) return
  notificationBusy.value = 'dnd'
  notificationError.value = ''
  notificationSuccess.value = ''
  const window = enabled
    ? { startLocalTime: notificationDndStart.value, endLocalTime: notificationDndEnd.value }
    : NOTIFICATION_DND_OFF
  const retryTarget: NotificationDndRetryTarget = {
    enabled,
    startLocalTime: notificationDndStart.value,
    endLocalTime: notificationDndEnd.value,
  }
  notificationDndRetryTarget.value = retryTarget
  try {
    const updates: Array<Promise<M1016NotificationPreference>> = NOTIFICATION_CATEGORIES.map(({ category }) => {
      const current = preferenceFor(category, 'IN_APP')
      const command: M1016NotificationPreferenceCommand = makeNotificationPreferenceCommand(
        category,
        current?.enabled === true,
        current,
        window,
      )
      return updateB12NotificationPreference(category, 'IN_APP', command)
    })
    const results = await Promise.allSettled(updates)
    const failedCount = results.filter(result => result.status === 'rejected').length
    const savedCount = results.length - failedCount
    if (failedCount > 0) {
      await loadNotificationSettings()
      if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
      notificationDndRetryPending.value = true
      notificationDndDirty.value = true
      const result = savedCount > 0 ? settingsT('notifications.partial', { saved: mobileI18n.formatNumber(savedCount), failed: mobileI18n.formatNumber(failedCount) }) : settingsT('notifications.noneSaved')
      notificationError.value = notificationStatus.value === 'ready'
        ? `${result} ${settingsT('notifications.partialRetry')}`
        : `${result} ${settingsT('notifications.partialRetryFailed')}`
      return
    }
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationDndRetryTarget.value = null
    notificationDndRetryPending.value = false
    notificationDndEnabled.value = enabled
    notificationDndDirty.value = false
    await loadNotificationSettings()
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    await loadNotificationSettings()
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    notificationDndRetryPending.value = true
    notificationDndDirty.value = true
    notificationError.value = notificationStatus.value === 'ready'
      ? settingsT('notifications.saveError')
      : settingsT('notifications.saveErrorUnreadable')
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) notificationBusy.value = null
  }
}

async function save(): Promise<void> {
  if (saving.value || localeSaving.value || !preferenceDraftDirty.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity || identity.subject !== preferenceSubject) return
  const epoch = ++saveEpoch
  saving.value = true
  saved.value = false
  saveError.value = ''
  restoreNotice.value = ''
  try {
    await store.savePreferences({ themeMode: themeMode.value, highContrast: highContrast.value, motionMode: motionMode.value })
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (store.accountStatus === 'ready' && !store.lastError) {
      saved.value = true
      preferenceDraftDirty.value = false
      setPendingMobilePreferenceSync(identity.subject, false, preferenceSyncStorage())
    } else {
      saveError.value = settingsT('appearance.saveFailedLocalDetail')
    }
  } catch {
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    saveError.value = settingsT('appearance.saveFailedLocalDetail')
  } finally {
    if (epoch === saveEpoch) saving.value = false
  }
}

async function selectContentLocale(index: number): Promise<void> {
  if (saving.value || localeSaving.value) return
  const contentLocale = index === 1 ? 'zh-CN' : 'en-US'
  localeRetryIndex.value = index
  if (contentLocale === b10ContentLocale.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity || identity.subject !== preferenceSubject) return
  localeSaving.value = true
  localeSaved.value = false
  localeError.value = ''
  try {
    const savedLocale = await store.saveContentLocale(contentLocale)
    if (!sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) return
    if (savedLocale && store.accountStatus === 'ready' && store.account.contentLocale === contentLocale) {
      localeSaved.value = true
    } else {
      localeError.value = settingsT('language.contentFailedDetail')
    }
  } finally {
    if (sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())) localeSaving.value = false
  }
}
</script>

<template>
  <view
    id="settings-shell"
    ref="settingsRootRef"
    class="settings-shell"
    :style="experienceStyle"
    :data-motion="experienceMotion"
    :data-resolved-theme="resolvedTheme"
    :data-settings-state="accountError ? 'error' : accountLoading ? 'loading' : saved ? 'saved' : preferenceDraftDirty ? 'changed' : 'ready'"
  >
    <view class="settings-glow-wrap" aria-hidden="true"><image class="settings-glow" :src="iconGlow" mode="aspectFit" /></view>

    <view class="settings-canvas">
      <MobilePageHeader page="settings" compact :title="mobileT('settings')" :show-settings="false" :back-icon-src="iconBack" />

      <view class="settings-content">
        <view v-if="accountLoading" class="sp-status" role="status" aria-live="polite">
          <view class="sp-status-copy"><text class="sp-status-title">{{ settingsT('appearance.accountLoading') }}</text></view>
        </view>
        <view v-else-if="accountError" class="sp-status sp-status--bad" role="alert">
          <image class="sp-status-icon" :src="iconMaterialError" mode="aspectFit" aria-hidden="true" />
          <view class="sp-status-copy">
            <text class="sp-status-title">{{ settingsT('appearance.accountError') }}</text>
            <text class="sp-status-text">{{ store.lastError || settingsT('appearance.accountErrorDetail') }}</text>
          </view>
          <button tabindex="0" role="button" type="button" class="sp-text-btn" :disabled="accountLoading" @click="loadAccountPreferences">{{ settingsT('common.retryRead') }}</button>
        </view>

        <view class="sp-card sp-card--appearance">
          <view class="sp-card-head">
            <text class="sp-title" role="heading" aria-level="2">{{ settingsT('appearance.title') }}</text>
            <text class="sp-caption">{{ settingsT('appearance.previewHint') }}</text>
          </view>
          <text class="sp-label">{{ settingsT('appearance.theme') }}</text>
          <view class="sp-segments sp-segments--theme">
            <button
              v-for="option in themeOptions"
              :key="option.value"
              tabindex="0"
              role="button"
              type="button"
              class="sp-segment"
              :class="{ 'is-selected': themeMode === option.value }"
              :aria-pressed="themeMode === option.value"
              :disabled="saving || localeSaving"
              @click="chooseTheme(option.value)"
            >
              <text class="sp-segment-title">{{ settingsT(option.labelKey) }}</text>
              <text class="sp-segment-desc">{{ settingsT(option.descKey) }}</text>
              <text class="sp-segment-state">{{ themeMode === option.value ? settingsT('appearance.themeSelected') : settingsT('appearance.themeUnselected') }}</text>
            </button>
          </view>

          <text class="sp-label">{{ settingsT('appearance.motion') }}</text>
          <view class="sp-segments">
            <button
              v-for="option in motionOptions"
              :key="option.value"
              tabindex="0"
              role="button"
              type="button"
              class="sp-segment"
              :class="{ 'is-selected': motionMode === option.value }"
              :aria-pressed="motionMode === option.value"
              :disabled="saving || localeSaving"
              @click="chooseMotion(option.value)"
            >{{ settingsT(option.labelKey) }}</button>
          </view>
          <text class="sp-note">{{ settingsT('appearance.motionNote') }}</text>

          <button tabindex="0" role="switch" type="button" class="sp-toggle" :aria-checked="highContrast" :disabled="saving || localeSaving" @click="toggleHighContrast">
            <view class="sp-toggle-copy">
              <text class="sp-toggle-title">{{ settingsT('appearance.highContrast') }}</text>
              <text class="sp-caption">{{ highContrast ? settingsT('appearance.highContrastOn') : settingsT('appearance.highContrastOff') }}</text>
            </view>
            <image class="sp-track" :src="highContrast ? iconTrackOn : iconTrackOff" mode="aspectFit" aria-hidden="true" />
          </button>

          <view class="sp-restore">
            <button tabindex="0" role="button" type="button" class="sp-text-btn" :disabled="saving || localeSaving" @click="restoreDisplayDefaults">{{ settingsT('appearance.restore') }}</button>
            <text v-if="restoreNotice" class="sp-success" role="status">{{ restoreNotice }}</text>
          </view>
        </view>

        <view class="sp-card">
          <view class="sp-card-head">
            <text class="sp-title" role="heading" aria-level="2">{{ settingsT('quality.title') }}</text>
            <text class="sp-caption">{{ settingsT('common.localOnly') }}</text>
          </view>
          <view class="sp-chips">
            <button
              v-for="option in qualityOptions"
              :key="option.value"
              tabindex="0"
              role="button"
              type="button"
              class="sp-chip"
              :class="{ 'is-selected': qualityLevel === option.value }"
              :aria-pressed="qualityLevel === option.value"
              @click="setMobileQuality(option.value)"
            >{{ settingsT(option.labelKey) }}</button>
          </view>
          <text class="sp-note">{{ settingsT('quality.note') }}</text>
          <navigator class="sp-link" url="/pages/b6-platform/b6-platform">
            <text>{{ settingsT('quality.help') }}</text>
            <image class="sp-link-icon" :src="iconChevR" mode="aspectFit" aria-hidden="true" />
          </navigator>
        </view>

        <view class="sp-card">
          <text class="sp-title" role="heading" aria-level="2">{{ settingsT('language.title') }}</text>
          <view class="sp-row">
            <text class="sp-row-label">{{ settingsT('language.ui') }}</text>
            <text class="sp-row-value">{{ settingsT('language.followDevice') }} · {{ localeName(b10UiLocale) }}</text>
          </view>
          <text class="sp-note">{{ settingsT('language.uiFollowNote') }}</text>
          <view class="sp-row">
            <text class="sp-row-label">{{ settingsT('language.content') }}</text>
            <picker mode="selector" :disabled="saving || localeSaving" :range="['en-US', 'zh-CN']" :value="b10ContentLocale === 'zh-CN' ? 1 : 0" @change="selectContentLocale(Number($event.detail.value))">
              <view class="sp-picker">{{ localeSaving ? settingsT('common.saving') : localeName(b10ContentLocale) }}</view>
            </picker>
          </view>
          <view v-if="localeSaved" class="sp-success-row" role="status">
            <image class="sp-inline-icon sp-inline-icon--check" :src="iconCheck" mode="aspectFit" aria-hidden="true" />
            <text class="sp-success">{{ settingsT('language.contentSynced') }}</text>
          </view>
          <view v-if="localeError" class="sp-inline-error" role="alert">
            <text>{{ localeError }}</text>
            <button tabindex="0" role="button" type="button" class="sp-text-btn" :disabled="localeSaving" @click="retryContentLocale">{{ settingsT('common.retry') }}</button>
          </view>
        </view>

        <view class="sp-card">
          <text class="sp-title" role="heading" aria-level="2">{{ settingsT('learning.title') }}</text>
          <view class="sp-row"><text class="sp-row-label">{{ settingsT('learning.currentGoal') }}</text><text class="sp-row-value">{{ goalLabel }}</text></view>
          <view class="sp-row"><text class="sp-row-label">{{ settingsT('learning.dailyGoal') }}</text><text class="sp-row-value">{{ quotaLabel }}</text></view>
          <navigator class="sp-link" url="/pages/onboarding/onboarding">
            <text>{{ settingsT('learning.editGoal') }}</text>
            <image class="sp-link-icon" :src="iconChevR" mode="aspectFit" aria-hidden="true" />
          </navigator>
        </view>

        <view class="sp-card">
          <view class="sp-card-head">
            <text class="sp-title" role="heading" aria-level="2">{{ settingsT('notifications.title') }}</text>
            <text class="sp-caption">{{ settingsT('notifications.note') }}</text>
          </view>

          <view v-if="notificationStatus === 'loading'" class="sp-inline-status" role="status" aria-live="polite">
            <text class="sp-status-title">{{ settingsT('notifications.loading') }}</text>
            <text class="sp-note">{{ settingsT('notifications.loadingDetail') }}</text>
          </view>
          <view v-else-if="notificationStatus === 'error'" class="sp-inline-error" role="alert">
            <image class="sp-inline-icon sp-inline-icon--alert" :src="iconAlert" mode="aspectFit" aria-hidden="true" />
            <view class="sp-error-copy">
              <text class="sp-status-title">{{ settingsT('notifications.errorTitle') }}</text>
              <text>{{ notificationError || settingsT('notifications.errorHint') }}</text>
            </view>
            <button tabindex="0" role="button" type="button" class="sp-text-btn" @click="loadNotificationSettings">{{ settingsT('common.retry') }}</button>
          </view>
          <view v-else>
            <view v-for="setting in notificationSettings" :key="setting.category" class="sp-notification-row">
              <view class="sp-notification-copy">
                <text class="sp-row-title">{{ notificationLabel(setting.category) }}</text>
                <text v-if="setting.unsupportedCadence" class="sp-note">{{ settingsT('notifications.unsupported') }}</text>
              </view>
              <button tabindex="0" role="button" type="button" class="sp-mini" :aria-pressed="setting.enabled" :disabled="Boolean(notificationBusy)" @click="toggleNotification(setting)">
                {{ notificationBusy === setting.category ? settingsT('common.saving') : setting.enabled ? settingsT('notifications.disable') : settingsT('notifications.enable') }}
              </button>
            </view>

            <view class="sp-quiet">
              <view class="sp-row">
                <view class="sp-toggle-copy">
                  <text class="sp-row-title">{{ settingsT('notifications.dndTitle') }}</text>
                  <text class="sp-note">{{ settingsT('notifications.dndOnlyInApp') }}</text>
                </view>
                <button tabindex="0" role="switch" type="button" class="sp-toggle sp-toggle--compact" :aria-checked="notificationDndEnabled" :disabled="Boolean(notificationBusy)" @click="saveNotificationDnd(!notificationDndEnabled)">
                  <image class="sp-track" :src="notificationDndEnabled ? iconTrackOn : iconTrackOff" mode="aspectFit" aria-hidden="true" />
                </button>
              </view>
              <view v-if="notificationDndConflict" class="sp-inline-hint" role="status">
                <image class="sp-inline-icon" :src="iconMaterialInfo" mode="aspectFit" aria-hidden="true" />
                <text class="sp-note">{{ settingsT('notifications.conflict') }} {{ settingsT('notifications.conflictDetail') }}</text>
              </view>
              <view class="sp-row"><text class="sp-row-label">{{ settingsT('notifications.start') }}</text><picker mode="time" :value="notificationDndStart" :disabled="Boolean(notificationBusy)" @change="onNotificationDndTimeChange('start', String($event.detail.value))"><view class="sp-picker">{{ notificationDndStart }}</view></picker></view>
              <view class="sp-row"><text class="sp-row-label">{{ settingsT('notifications.end') }}</text><picker mode="time" :value="notificationDndEnd" :disabled="Boolean(notificationBusy)" @change="onNotificationDndTimeChange('end', String($event.detail.value))"><view class="sp-picker">{{ notificationDndEnd }}</view></picker></view>
              <button v-if="notificationDndDirty || notificationDndRetryPending" tabindex="0" role="button" type="button" class="sp-secondary" :disabled="Boolean(notificationBusy)" @click="saveNotificationDnd(notificationDndRetryPending ? notificationDndEnabled : true)">
                {{ notificationBusy === 'dnd' ? settingsT('common.saving') : notificationDndRetryPending ? settingsT('notifications.retryUnified') : settingsT('notifications.saveWindow') }}
              </button>
            </view>

            <text v-if="notificationError" class="sp-error" role="alert">{{ notificationError }}</text>
            <text v-if="notificationSuccess" class="sp-success" role="status">{{ notificationSuccess }}</text>
          </view>
        </view>

        <view class="sp-card">
          <text class="sp-title" role="heading" aria-level="2">{{ settingsT('privacy.title') }}</text>
          <text v-for="line in privacyLines" :key="line" class="sp-note">{{ line }}</text>
          <view class="sp-divider"></view>
          <text class="sp-label">{{ settingsT('privacy.consentTitle') }}</text>
          <text class="sp-note">{{ settingsT('privacy.revokeSummary') }}</text>

          <view v-if="withdrawSucceeded" ref="withdrawResultRef" tabindex="-1" class="sp-result" role="status">
            <text class="sp-badge">{{ settingsT('privacy.revokedBadge') }}</text>
            <text class="sp-result-title">{{ withdrawNotice || settingsT('privacy.revoked') }}</text>
            <view class="sp-dot-row">
              <image class="sp-dot" :src="iconDot" mode="aspectFit" aria-hidden="true" />
              <view class="sp-dot-copy"><text class="sp-row-title">{{ settingsT('privacy.accountRetained') }}</text><text class="sp-note">{{ settingsT('privacy.accountRetainedDetail') }}</text></view>
            </view>
            <view class="sp-dot-row">
              <image class="sp-dot" :src="iconDot1" mode="aspectFit" aria-hidden="true" />
              <view class="sp-dot-copy"><text class="sp-row-title">{{ settingsT('privacy.reconsent') }}</text><text class="sp-note">{{ settingsT('privacy.reconsentDetail') }}</text></view>
            </view>
            <view class="sp-dot-row">
              <image class="sp-dot" :src="iconDot2" mode="aspectFit" aria-hidden="true" />
              <view class="sp-dot-copy"><text class="sp-row-title">{{ settingsT('privacy.feedback') }}</text><text class="sp-note">{{ settingsT('privacy.feedbackDetail') }}</text></view>
            </view>
            <text v-if="profileNavError" class="sp-error" role="alert">{{ profileNavError }}</text>
            <button tabindex="0" role="button" type="button" class="sp-primary" :disabled="profileNavBusy" :aria-busy="profileNavBusy ? 'true' : 'false'" @click="returnToProfile">{{ profileNavBusy ? settingsT('common.saving') : settingsT('privacy.returnMe') }}</button>
          </view>
          <view v-else>
            <view v-if="withdrawNotice" class="sp-inline-error" role="alert">
              <text>{{ withdrawNotice }}</text>
              <button tabindex="0" role="button" type="button" class="sp-text-btn" :disabled="withdrawing" @click="openWithdrawConfirm">{{ settingsT('privacy.retry') }}</button>
            </view>
            <button tabindex="0" role="button" type="button" class="sp-danger-outline" :disabled="withdrawing" @click="openWithdrawConfirm">{{ settingsT('privacy.revoke') }}</button>
          </view>
        </view>

        <view class="sp-card">
          <text class="sp-title" role="heading" aria-level="2">{{ settingsT('devices.title') }}</text>
          <text class="sp-note">{{ settingsT('devices.description') }}</text>
          <navigator class="sp-link" url="/pages/devices/devices">
            <text>{{ settingsT('devices.manage') }}</text>
            <image class="sp-link-icon" :src="iconChevR" mode="aspectFit" aria-hidden="true" />
          </navigator>
        </view>
      </view>
    </view>

    <view class="settings-action-bar" role="region" :aria-label="settingsT('appearance.saveScope')">
      <view class="settings-action-inner">
        <view class="sp-action-copy" role="status" aria-live="polite">
          <text class="sp-action-title">{{ saving ? settingsT('appearance.savingTitle') : saved ? settingsT('appearance.saved') : saveError ? settingsT('appearance.saveFailed') : settingsT('appearance.saveScope') }}</text>
          <text class="sp-action-detail">{{ saving ? settingsT('appearance.savingDetail') : saved ? settingsT('appearance.savedDetail') : saveError || settingsT('appearance.saveScopeDetail') }}</text>
        </view>
        <button tabindex="0" role="button" type="button" class="sp-save" :class="{ 'is-busy': saving }" :disabled="saving || localeSaving || !preferenceDraftDirty" :aria-busy="saving ? 'true' : 'false'" @click="save">
          {{ saving ? settingsT('common.saving') : saveError ? settingsT('common.retrySave') : settingsT('common.save') }}
        </button>
      </view>
    </view>

    <view v-if="withdrawConfirming" class="sp-overlay">
      <view class="sp-scrim" aria-hidden="true" @click="cancelWithdraw"></view>
      <view ref="withdrawDialogRef" class="sp-dialog" role="dialog" aria-modal="true" aria-labelledby="settings-withdraw-title" aria-describedby="settings-withdraw-text">
        <text id="settings-withdraw-title" class="sp-dialog-title" role="heading" aria-level="2">{{ settingsT('privacy.revokeConfirmTitle') }}</text>
        <text id="settings-withdraw-text" class="sp-dialog-text">{{ settingsT('privacy.revokeSummary') }}</text>
        <text v-if="withdrawNotice && !withdrawSucceeded" class="sp-error" role="alert">{{ withdrawNotice }}</text>
        <button tabindex="0" role="button" type="button" class="sp-danger" :disabled="withdrawing" :aria-busy="withdrawing ? 'true' : 'false'" @click="confirmWithdrawLearningConsent">
          {{ withdrawing ? settingsT('privacy.withdrawing') : settingsT('privacy.revokeConfirm') }}
        </button>
        <button ref="withdrawCancelRef" tabindex="0" role="button" type="button" class="sp-cancel" :disabled="withdrawing" @click="cancelWithdraw">{{ settingsT('common.cancel') }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.settings-card{display:grid;gap:18rpx}.card-title{font-size:30rpx;font-weight:700}.setting-row{display:flex;justify-content:space-between;gap:20rpx;color:var(--yx-text-secondary);font-size:25rpx}.setting-row>text{color:var(--yx-text-primary)}.settings-link{color:var(--yx-brand);font-size:25rpx}.setting-label{color:var(--yx-text-secondary);font-size:24rpx}.setting-note{color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.setting-inline-note{font-size:21rpx}.setting-options{display:flex;flex-wrap:wrap;gap:12rpx}.setting-option{margin:0;padding:14rpx 18rpx;border:1rpx solid var(--yx-border);border-radius:12rpx;color:var(--yx-text-secondary);background:var(--yx-surface-card);font-size:24rpx}.setting-option:disabled{opacity:.6}.setting-option.selected{border-color:var(--yx-brand);color:var(--yx-brand);background:var(--yx-brand-soft)}.reset-defaults{justify-self:start}.setting-check{display:flex;align-items:center;color:var(--yx-text-secondary);font-size:24rpx}.preference-state{display:grid;gap:12rpx;color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.success{color:var(--yx-success);font-size:24rpx}.error{display:block;color:var(--yx-danger);font-size:24rpx}
.notification-row{display:flex;align-items:center;justify-content:space-between;gap:18rpx;padding:12rpx 0;border-top:1rpx solid var(--yx-border);font-size:25rpx}.notification-row .setting-option{min-width:106rpx}.notification-row>view{display:grid;gap:4rpx}.notification-state{display:flex;align-items:center;justify-content:space-between;gap:12rpx;color:var(--yx-danger);font-size:24rpx}.notification-quiet-hours{display:grid;gap:12rpx;margin-top:8rpx;padding-top:8rpx;border-top:1rpx solid var(--yx-border)}.quiet-hours-heading{border:0}.quiet-hours-times{display:grid;gap:10rpx}
/* v2 设置页换皮：对齐 practice.vue v2-practice-* 与 today.vue v2-today-* 卡片/eyebrow/标题/列表行/按钮同样数值，对齐 webDemo/mobile/styles.css、refine.css，仅用 var(--v2-*)。 */
.v2-settings-body{display:flex;flex-direction:column;gap:var(--v2-space-4);min-width:0;max-width:100%;box-sizing:border-box;font-family:var(--v2-font)}
.v2-settings-body>*{min-width:0;max-width:100%}
.v2-settings-card{display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;box-sizing:border-box;padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-settings-card:hover{border-color:var(--v2-brand)}
.v2-settings-card>*{min-width:0;max-width:100%}
.v2-settings-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase;overflow-wrap:anywhere}
.v2-settings-title,.v2-settings-h2{display:block;min-width:0;max-width:100%;margin:var(--v2-space-1) 0 0;overflow-wrap:anywhere;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-settings-d{display:block;min-width:0;max-width:100%;overflow-wrap:anywhere;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-settings-label{display:block;min-width:0;max-width:100%;margin:var(--v2-space-2) 0 0;overflow-wrap:anywhere;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-settings-inline{overflow-wrap:anywhere;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.7}
.v2-settings-row{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);font-family:var(--v2-font);flex-wrap:wrap;overflow-wrap:anywhere}
.v2-settings-row:hover{border-color:var(--v2-brand)}
.v2-settings-row>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-settings-check{box-sizing:border-box;display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;flex-wrap:wrap;overflow-wrap:anywhere}
.v2-settings-check>*{min-width:0;max-width:100%}
.v2-settings-list{box-sizing:border-box;display:flex;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-settings-list>*{min-width:0;max-width:100%}
.v2-settings-opt,.v2-settings-btn{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-width:0;max-width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.v2-settings-opt:hover,.v2-settings-btn:hover{border-color:var(--v2-brand)}
.v2-settings-opt.selected,.v2-settings-btn.selected,.v2-settings-opt.sel,.v2-settings-btn.sel{border-color:var(--v2-brand);background:var(--v2-soft);color:var(--v2-brand)}
.v2-settings-opt:active,.v2-settings-btn:active{transform:scale(.97)}
.v2-settings-opt:focus-visible,.v2-settings-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-settings-opt:disabled,.v2-settings-btn:disabled{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-settings-link{box-sizing:border-box;display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0;max-width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-brand);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;flex-wrap:wrap;overflow-wrap:anywhere}
.v2-settings-link:hover{border-color:var(--v2-brand)}
.v2-settings-link:active{transform:scale(.97)}
.v2-settings-link:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-settings-link>*{min-width:0;max-width:100%;overflow-wrap:anywhere}
.v2-settings-picker{box-sizing:border-box;display:inline-flex;align-items:center;min-width:0;max-width:100%;min-height:var(--v2-space-12);padding:var(--v2-space-2) var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.5;overflow-wrap:anywhere}
.v2-settings-fb{box-sizing:border-box;display:block;min-width:0;max-width:100%;margin-top:var(--v2-space-4);padding:var(--v2-space-3) var(--v2-space-4);border-radius:var(--v2-radius-md);background:var(--v2-surface);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7;overflow-wrap:anywhere}
.v2-settings-ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-settings-err{background:var(--v2-bad-soft);color:var(--v2-bad)}
.v2-settings-submit{width:100%;border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-weight:700}
.v2-settings-submit:hover{border-color:var(--v2-brand)}
.v2-settings-quiet{box-sizing:border-box;display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%;margin-top:var(--v2-space-2);padding-top:var(--v2-space-2);border-top:1px solid var(--v2-line);font-family:var(--v2-font)}
.v2-settings-quiet>*{min-width:0;max-width:100%}

/* MB-024 Figma settings skin. Decoration and control styles only; state/logic stays in the existing script. */
#settings-shell {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background-color: var(--v2-bg);
  background-image: var(--yx-profile-page-image, none);
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--v2-ink);
  font-family: var(--v2-font);
  line-height: 1.65;
  overflow-wrap: anywhere;
}
#settings-shell * { box-sizing: border-box; }
#settings-shell :deep(.mobile-back) { position: relative; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; border: 0; background: transparent; color: var(--yx-text-secondary); font-size: 13px; }
#settings-shell :deep(.mobile-back--icon) { width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0; flex: 0 0 44px; }
#settings-shell :deep(.mobile-back):focus .mobile-back-icon, #settings-shell :deep(.mobile-back--icon):focus .mobile-back-icon { outline: 2px solid var(--v2-focus) !important; outline-offset: 2px; border-radius: 50%; filter: drop-shadow(0 0 2px var(--v2-focus)); }
#settings-shell :deep(.mobile-back):focus, #settings-shell :deep(.mobile-back--icon):focus { background: var(--v2-soft) !important; }
#settings-shell :deep(.mobile-back)::after, #settings-shell :deep(.mobile-back--icon)::after { border: 0 !important; background: transparent !important; }
#settings-shell :deep(.mobile-back):focus, #settings-shell :deep(.mobile-back--icon):focus, #settings-shell :deep(.mobile-back):focus-visible, #settings-shell :deep(.mobile-back--icon):focus-visible, #settings-shell :deep(.mobile-back):focus-within, #settings-shell :deep(.mobile-back--icon):focus-within { outline: 2px solid var(--v2-focus) !important; outline-offset: 2px; box-shadow: 0 0 0 2px var(--v2-focus) !important; border: 2px solid var(--v2-focus) !important; border-radius: 50%; }
#settings-shell :deep(.mobile-back-icon) { display: block; width: 22px; height: 22px; }
.settings-glow-wrap { position: absolute; top: -140px; right: -120px; z-index: 0; width: 360px; height: 300px; overflow: visible; pointer-events: none; }
.settings-glow { position: absolute; top: -90px; left: -90px; width: 540px; height: 480px; max-width: none; }
#settings-shell[data-resolved-theme="dark"] .settings-glow { opacity: .24; }
#settings-shell[data-resolved-theme="high-contrast"] .settings-glow-wrap { display: none; }
.settings-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: calc(18px + env(safe-area-inset-top)) clamp(16px, 6vw, 24px) calc(200px + env(safe-area-inset-bottom));
}
.settings-content { display: grid; gap: 16px; min-width: 0; }
.sp-card {
  position: relative;
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--yx-profile-glass-border, var(--v2-line));
  border-radius: 24px;
  background: var(--yx-profile-glass, var(--v2-card));
  box-shadow: var(--yx-profile-card-shadow, none);
  backdrop-filter: blur(var(--yx-profile-blur, 0px));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, 0px));
  overflow: hidden;
}
.sp-card > * { position: relative; z-index: 1; min-width: 0; }
.sp-card-head { display: flex; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; gap: 4px 12px; }
.sp-title { display: block; color: var(--v2-ink); font-size: 18px; line-height: 1.45; font-weight: 700; }
.sp-caption { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; }
.sp-label { display: block; margin-top: 4px; color: var(--v2-mut); font-size: 13px; line-height: 1.5; }
.sp-note { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.6; }
.sp-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; min-width: 0; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--v2-line); }
.sp-row:first-of-type { border-top: 0; }
.sp-row-label { color: var(--v2-mut); font-size: 13px; line-height: 1.5; }
.sp-row-value { color: var(--v2-ink); font-size: 13px; line-height: 1.5; font-weight: 500; text-align: right; overflow-wrap: anywhere; }
.sp-row-title { display: block; color: var(--v2-ink); font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-segments { display: flex; flex-wrap: wrap; gap: 4px; min-width: 0; padding: 4px; border-radius: 16px; background: var(--v2-soft); }
.sp-segment { display: flex; flex: 1 1 auto; align-items: center; justify-content: center; min-width: max-content; max-width: 100%; min-height: 44px; padding: 8px 6px; border: 1px solid transparent; border-radius: 12px; color: var(--v2-mut); background: transparent; font: inherit; font-size: 13px; line-height: 1.5; text-align: center; }
.sp-segment.is-selected { border-color: var(--v2-card); background: var(--v2-card); color: var(--v2-brand); box-shadow: var(--yx-settings-segment-shadow, none); font-weight: 600; }
.sp-segment-desc, .sp-segment-state { display: none; }
.sp-segment-title { display: block; }
.sp-toggle { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; width: 100%; min-height: 44px; padding: 8px 0; border: 0; border-top: 1px solid var(--v2-line); color: var(--v2-ink); background: transparent; font: inherit; text-align: left; }
.sp-toggle--compact { width: auto; border-top: 0; padding: 0; }
.sp-toggle-copy { display: grid; gap: 2px; min-width: 0; }
.sp-toggle-title { display: block; color: var(--v2-ink); font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-track { display: block; flex: none; width: 52px; height: 32px; max-width: none; }
.sp-restore { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; margin-top: 2px; }
.sp-chips { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.sp-chip { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--v2-line); border-radius: 22px; color: var(--v2-ink); background: var(--v2-card); font: inherit; font-size: 13px; line-height: 1.5; }
.sp-chip.is-selected { border-color: var(--v2-brand); background: var(--v2-brand); color: var(--v2-inverse); font-weight: 600; }
.sp-link { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; padding: 8px 0; border-top: 1px solid var(--v2-line); color: var(--v2-brand); font-size: 13px; line-height: 1.5; text-decoration: none; }
#settings-shell .sp-link :deep(.navigator-wrap) { display: flex !important; flex-wrap: nowrap !important; align-items: center; justify-content: space-between; gap: 10px; width: 100% !important; min-width: 0; color: inherit; text-decoration: none; }
#settings-shell .sp-link :deep(.navigator-wrap uni-text) { flex: 1 1 auto; min-width: 0; }
.sp-link text { min-width: 0; overflow-wrap: anywhere; flex: 1 1 auto; }
.sp-link-icon { display: block; flex: 0 0 20px; width: 20px; height: 20px; }
.sp-picker { display: flex; align-items: center; justify-content: flex-end; min-height: 44px; padding: 0 12px; border: 1px solid var(--v2-line); border-radius: 12px; color: var(--v2-brand); background: var(--v2-card); font-size: 13px; line-height: 1.5; }
.sp-status { display: flex; align-items: flex-start; gap: 8px; padding: 12px 14px; border: 1px solid var(--yx-profile-glass-border, var(--v2-line)); border-radius: 18px; background: var(--yx-profile-glass, var(--v2-card)); color: var(--v2-mut); font-size: 13px; line-height: 1.5; }
.sp-status--bad { border-color: var(--v2-bad); background: var(--v2-bad-soft); color: var(--v2-bad); }
.sp-status-icon { display: block; flex: none; width: 17px; height: 17px; margin-top: 2px; }
.sp-status-copy { display: grid; flex: 1 1 160px; gap: 2px; min-width: 0; }
.sp-status-title { display: block; color: var(--v2-ink); font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-status--bad .sp-status-title { color: var(--v2-bad); }
.sp-status-text { display: block; color: inherit; font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.sp-text-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 8px; border: 0; color: var(--v2-brand); background: transparent; font: inherit; font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-notification-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; min-width: 0; padding: 8px 0; border-top: 1px solid var(--v2-line); }
.sp-notification-copy { display: grid; flex: 1 1 150px; gap: 2px; min-width: 0; }
.sp-mini { display: inline-flex; align-items: center; justify-content: center; min-width: 64px; min-height: 44px; padding: 0 12px; border: 1px solid var(--v2-line); border-radius: 12px; color: var(--v2-brand); background: var(--v2-card); font: inherit; font-size: 13px; line-height: 1.5; }
.sp-quiet { display: grid; gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--v2-line); }
.sp-secondary { display: inline-flex; align-items: center; justify-content: center; justify-self: start; min-height: 44px; padding: 0 14px; border: 1px solid var(--v2-line); border-radius: 12px; color: var(--v2-brand); background: var(--v2-card); font: inherit; font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-inline-status { display: grid; gap: 4px; padding: 8px 0; }
.sp-inline-hint { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.sp-inline-icon { display: block; flex: none; width: 17px; height: 17px; margin-top: 1px; }
.sp-inline-icon--alert { width: 20px; height: 20px; }
.sp-inline-icon--check { width: 16px; height: 16px; }
.sp-success-row { display: flex; align-items: flex-start; gap: 6px; min-width: 0; }
.sp-inline-error { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; color: var(--v2-bad); font-size: 13px; line-height: 1.5; }
.sp-error-copy { display: grid; flex: 1 1 160px; gap: 2px; min-width: 0; }
.sp-error { display: block; color: var(--v2-bad); font-size: 13px; line-height: 1.5; }
.sp-success { display: block; color: var(--v2-ok); font-size: 13px; line-height: 1.5; }
.sp-divider { height: 1px; margin: 4px 0; background: var(--v2-line); }
.sp-result { display: grid; gap: 8px; scroll-margin-bottom: 140px; padding: 12px; border: 1px solid var(--v2-line); border-radius: 16px; background: var(--v2-card); }
.sp-badge { display: inline-flex; justify-self: start; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 999px; background: var(--v2-ok-soft); color: var(--v2-ok); font-size: 12px; line-height: 1.5; font-weight: 700; }
.sp-result-title { display: block; color: var(--v2-ink); font-size: 14px; line-height: 1.5; font-weight: 600; }
.sp-dot-row { display: flex; align-items: flex-start; gap: 8px; min-width: 0; }
.sp-dot { display: block; flex: none; width: 8px; height: 8px; margin-top: 6px; }
.sp-dot-copy { display: grid; gap: 2px; min-width: 0; }
.sp-danger-outline { display: inline-flex; align-items: center; justify-content: center; justify-self: start; min-height: 44px; padding: 0 14px; border: 1px solid var(--v2-bad); border-radius: 14px; color: var(--v2-bad); background: transparent; font: inherit; font-size: 14px; line-height: 1.5; font-weight: 600; }
.sp-primary { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 12px 18px; border: 0; border-radius: 14px; background: var(--v2-brand); color: var(--v2-inverse); font: inherit; font-size: 14px; line-height: 1.5; font-weight: 700; }
.settings-action-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; padding: 10px 24px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid var(--v2-line); background: var(--v2-card); box-shadow: var(--yx-settings-bottom-bar-shadow, var(--yx-profile-card-shadow, none)); }
.settings-action-inner { display: flex; flex-direction: column; align-items: stretch; justify-content: flex-start; gap: 8px; max-width: 760px; margin: 0 auto; }
.sp-action-copy { display: grid; flex: 0 0 auto; gap: 2px; min-width: 0; }
.sp-action-title { display: block; color: var(--v2-ink); font-size: 13px; line-height: 1.5; font-weight: 600; }
.sp-action-detail { display: block; color: var(--v2-mut); font-size: 11px; line-height: 1.5; overflow-wrap: anywhere; }
.sp-save { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 0 18px; border: 1px solid transparent; border-radius: 14px; background: var(--v2-brand); color: var(--v2-inverse); font: inherit; font-size: 14px; line-height: 1.5; font-weight: 700; }
.sp-save[disabled] { opacity: .72; background: var(--v2-soft); color: var(--v2-mut); border-color: var(--v2-line); box-shadow: none; }
.sp-save.is-busy[disabled] { opacity: .72; background: var(--v2-brand); color: var(--v2-inverse); border-color: transparent; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-save[disabled] { opacity: 1; background: var(--v2-card); color: var(--v2-mut); border: 2px solid var(--v2-line); }
.sp-overlay { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 24px; }
.sp-scrim { position: absolute; inset: 0; background: var(--yx-profile-scrim, var(--v2-side)); opacity: var(--yx-profile-scrim-opacity, .45); }
.sp-dialog { position: relative; z-index: 1; display: grid; gap: 10px; width: 100%; max-width: 342px; padding: 24px 24px 16px; border: 1px solid var(--yx-profile-glass-border, var(--v2-line)); border-radius: 28px; background: var(--v2-card); box-shadow: var(--yx-profile-card-shadow, none); text-align: center; }
.sp-dialog-title { display: block; color: var(--v2-ink); font-size: 20px; line-height: 1.4; font-weight: 700; text-align: center; }
.sp-dialog-text { display: block; color: var(--v2-mut); font-size: 15px; line-height: 1.5; text-align: center; }
.sp-danger { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; margin-top: 6px; padding: 12px 18px; border: 0; border-radius: 14px; background: var(--v2-bad); color: var(--v2-inverse); font: inherit; font-size: 16px; line-height: 1.5; font-weight: 700; text-align: center; }
.sp-cancel { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 10px 8px; border: 0; color: var(--v2-brand); background: transparent; font: inherit; font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; }
#settings-shell .settings-content button, #settings-shell .settings-action-bar button, #settings-shell .sp-dialog button { margin: 0; font-family: var(--v2-font); white-space: normal; }
#settings-shell .settings-content button::after, #settings-shell .settings-action-bar button::after, #settings-shell .sp-dialog button::after { border: 0; }
#settings-shell .sp-segment:focus-visible, #settings-shell .sp-chip:focus-visible, #settings-shell .sp-mini:focus-visible, #settings-shell .sp-secondary:focus-visible, #settings-shell .sp-text-btn:focus-visible, #settings-shell .sp-toggle:focus-visible, #settings-shell .sp-save:focus-visible, #settings-shell .sp-primary:focus-visible, #settings-shell .sp-danger-outline:focus-visible, #settings-shell .sp-danger:focus-visible, #settings-shell .sp-cancel:focus-visible { outline: none; box-shadow: var(--v2-focus); }
#settings-shell .sp-button-disabled, #settings-shell button:disabled { cursor: default; }
#settings-shell[data-resolved-theme="high-contrast"] { background-color: var(--yx-settings-accessible-page, var(--v2-bg)); }
#settings-shell[data-resolved-theme="high-contrast"] .sp-card { border-width: 2px; border-color: var(--yx-settings-accessible-border, var(--v2-line)); background: var(--yx-settings-accessible-surface, var(--v2-card)); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-caption, #settings-shell[data-resolved-theme="high-contrast"] .sp-note, #settings-shell[data-resolved-theme="high-contrast"] .sp-label, #settings-shell[data-resolved-theme="high-contrast"] .sp-row-label { color: var(--yx-settings-accessible-muted, var(--v2-mut)); }
#settings-shell[data-resolved-theme="high-contrast"] .sp-segment { border-color: var(--v2-line); }
#settings-shell[data-resolved-theme="high-contrast"] .sp-segment.is-selected { border: 2px solid var(--v2-brand); box-shadow: none; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-chip.is-selected { border-width: 2px; }
#settings-shell[data-resolved-theme="high-contrast"] .settings-action-bar { border-top-width: 2px; box-shadow: none; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-status { border-width: 2px; }
@media (max-width: 359px) {
  .settings-canvas { padding-inline: 16px; }
  .settings-action-bar { padding-left: 16px; padding-right: 16px; }
  .sp-card { padding: 16px; border-radius: 20px; }
  .sp-segments--theme { display: grid; }
  .sp-segments--theme .sp-segment { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-flow: row; gap: 4px; width: 100%; min-width: 0; justify-content: flex-start; align-items: flex-start; min-height: 72px; padding: 12px; text-align: left; }
  .sp-segments--theme .sp-segment > .sp-segment-title, .sp-segments--theme .sp-segment > .sp-segment-desc, .sp-segments--theme .sp-segment > .sp-segment-state { display: block; width: 100%; min-width: 0; }
  .sp-segments--theme .sp-segment-desc, .sp-segments--theme .sp-segment-state { display: block; }
  .sp-segment-state { color: var(--v2-mut); font-size: 12px; }
  .sp-segment.is-selected .sp-segment-state { color: var(--v2-brand); }
  .settings-action-inner { align-items: stretch; }
}
#settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme { display: grid; grid-auto-flow: row; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-flow: row; gap: 4px; width: 100%; min-width: 0; justify-content: flex-start; align-items: flex-start; min-height: 72px; padding: 12px; text-align: left; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment > .sp-segment-title, #settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment > .sp-segment-desc, #settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment > .sp-segment-state { display: block; width: 100%; min-width: 0; }
#settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment-desc, #settings-shell[data-resolved-theme="high-contrast"] .sp-segments--theme .sp-segment-state { display: block; }
@media (prefers-reduced-motion: reduce) { #settings-shell * { animation: none !important; transition: none !important; } }
</style>
