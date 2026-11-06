<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import FigmaAsset from '../../components/FigmaAsset.vue'
import HomeTabletNav from './HomeTabletNav.vue'
import { mobileHomeTabletVariables } from '@englishflow/design-tokens/mobile'
import { homeAssets, homeDarkAssets } from '../../theme/figma-r4-assets'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n } from '../../platform/v2-foundation'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess, currentMobilePagePath } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { homeContentHref, homeGuidePath, homePrivateReadAllowed, homeProgressPercent, homeStillOnPage, homeTaskHref } from '../../domain/home-page'
import { homeTabletLayout, homeTabletMinuteGap, homeTabletRingSize, homeTabletTabBarAction, type HomeTabletLayout } from '../../domain/home-tablet'
import { hasPlacementEntryReached, isPlacementSatisfied, onboardingRemainingStepLabels, selectOnboardingResumeStep, showOnboardingGuide } from '../../domain/onboarding-resume'
import { isAccessibleContent, shelfSearchState, type EmptyReason, type ShelfSearchState } from '../../domain/plan-today'
import { shelfNote } from '../../domain/content-release'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const art = computed(() => theme.value === 'dark' ? homeDarkAssets : homeAssets)
const store = useLearnerContentStore()
const session = useSessionStore()

/**
 * Scoped tablet shell state. Phone widths keep the existing Home DOM and CSS;
 * the rail/sidebar and the native tab-bar handoff exist only above 768px.
 */
function readViewportWidth(): number {
  try {
    if (typeof window !== 'undefined' && Number.isFinite(window.innerWidth) && window.innerWidth > 0) return window.innerWidth
    const info = getUniRuntime().getSystemInfoSync?.() as { windowWidth?: number } | undefined
    return Number(info?.windowWidth) > 0 ? Number(info?.windowWidth) : 390
  } catch {
    return 390
  }
}
const tabletLayout = ref<HomeTabletLayout>(homeTabletLayout(readViewportWidth()))
const isTablet = computed(() => tabletLayout.value !== 'phone')
const isSidebar = computed(() => tabletLayout.value === 'sidebar')
const tabletRingSize = computed(() => homeTabletRingSize(tabletLayout.value))
const tabletBadge = computed(() => {
  if (theme.value === 'dark') return '/static/figma-home-ipad-dark-251-362/26cb2780-0ee1-4607-aea0-fb334476059f.svg'
  return isSidebar.value
    ? '/static/figma-home-ipad-landscape-251-2/7ec69c80-cc3b-45fb-93be-49bfbf76ce31.svg'
    : '/static/figma-home-ipad-portrait-251-215/d502c1bc-bbdd-41ac-8dd0-cc41ca2d3904.svg'
})
/** Tablet-only semantic roles; phone keeps the existing experience style object. */
const pageStyle = computed(() => isTablet.value
  ? { ...experienceStyle.value, ...mobileHomeTabletVariables(theme.value, isSidebar.value ? 'sidebar' : 'rail') }
  : experienceStyle.value)

const courseQuery = ref('')
const busy = ref<string | null>(null)
const navError = ref('')
const accessChecked = ref(false)
const pageVisible = ref(false)
const reading = ref(false)
const guideReady = ref(false)
const searchFocus = ref(false)
const courseJumpFailed = ref(false)
const searchField = ref<{ $el?: HTMLElement } | null>(null)
let pageEpoch = 0
let entrySeq = 0
let actionSeq = 0
let activeEntry: EntryToken | null = null
let enteredEpoch = -1
let pageOwnerKey = ''

const homeLocaleTick = computed(() => mobileT('home.h1'))
function tr(key: string, values?: Record<string, string | number>): string {
  void homeLocaleTick.value
  return mobileI18n.t(`mobile.home.${key}`, values)
}

function ownerKey(): string {
  return session.isAuthenticated && session.verifiedSubject ? `${session.verifiedSubject}:${session.identityRevision}` : ''
}
interface EntryToken { epoch: number; seq: number; owner: string }
interface ActionToken { epoch: number; op: number; owner: string }
function beginAction(): ActionToken {
  return { epoch: pageEpoch, op: ++actionSeq, owner: ownerKey() }
}
function actionCurrent(token: ActionToken): boolean {
  return pageVisible.value && token.epoch === pageEpoch && token.op === actionSeq && token.owner !== '' && token.owner === ownerKey()
}
function entryCurrent(token: EntryToken): boolean {
  return pageVisible.value && token.epoch === pageEpoch && token.seq === entrySeq && token.owner !== '' && token.owner === ownerKey()
}
function invalidatePage(): void {
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  pageOwnerKey = ''
  accessChecked.value = false
  reading.value = false
  busy.value = null
  navError.value = ''
  courseQuery.value = ''
  courseJumpFailed.value = false
  guideReady.value = false
}
function isThenable(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as { then?: unknown }).then === 'function'
}

const homeReady = computed(() => Boolean(store.home) && (store.homeStatus === 'ready' || store.homeStatus === 'empty' || store.homeStatus === 'unavailable'))
const progressPercent = computed(() => {
  const home = store.home
  if (!home) return null
  return homeProgressPercent({
    completedMinutes: home.completedMinutes,
    targetMinutes: home.targetMinutes,
    stale: home.stale,
    taskCount: home.tasks.length,
  })
})
const hasConfirmedProgress = computed(() => progressPercent.value !== null)
const progressValue = computed(() => progressPercent.value === null ? 0 : Math.round(progressPercent.value))
const progressStale = computed(() => Boolean(store.home?.stale && store.home.tasks.length))
const showProgress = computed(() => hasConfirmedProgress.value || progressStale.value)
const progressText = computed(() => {
  if (hasConfirmedProgress.value && store.home) return tr('progress', { done: store.home.completedMinutes, target: store.home.targetMinutes })
  if (progressStale.value) return tr('progressStale')
  return ''
})
const completedTaskCount = computed(() => store.home?.tasks.filter((task) => task.status === 'COMPLETED').length ?? 0)
const openTaskCount = computed(() => store.home?.tasks.filter((task) => task.status === 'AVAILABLE' || task.status === 'IN_PROGRESS').length ?? 0)
const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 5) return tr('greetingNight')
  if (hour < 11) return tr('greetingMorning')
  if (hour < 14) return tr('greetingNoon')
  if (hour < 18) return tr('greetingAfternoon')
  return tr('greetingEvening')
})
const heroMeta = computed(() => {
  const home = store.home
  if (!home || home.tasks.length === 0) return ''
  return tr('heroMeta', { done: completedTaskCount.value, total: home.tasks.length, minutes: home.targetMinutes })
})
const heroRemain = computed(() => openTaskCount.value > 0 ? tr('heroRemain', { count: openTaskCount.value }) : '')
const ringStyle = computed(() => {
  if (progressPercent.value === null) return ''
  return `conic-gradient(from -90deg, var(--yx-r4-brand, #5935b8) 0 ${progressPercent.value}%, transparent ${progressPercent.value}% 100%)`
})

/* Tablet presentation uses the same server projection as phone; no new facts. */
const tabletHeadline = computed(() => tr('tabletGreeting', { greeting: greeting.value }))
const tabletHeroHeadline = computed(() => isTablet.value ? (heroRemain.value || progressText.value || tr('h1')) : heroRemain.value)
const tabletStatsValue = computed(() => {
  const home = store.home
  if (!home || progressPercent.value === null) return '—'
  return tr('statsMinutes', { done: home.completedMinutes, target: home.targetMinutes })
})
const tabletStatsCaption = computed(() => {
  if (hasConfirmedProgress.value) return tr('statsEffective')
  return progressStale.value ? tr('progressStale') : tr('statsNoProgress')
})
const tabletStatsRemaining = computed(() => {
  if (progressPercent.value === null) return progressStale.value ? tr('progressStale') : tr('statsNoProgress')
  const gap = homeTabletMinuteGap(store.home?.completedMinutes ?? 0, store.home?.targetMinutes ?? 0)
  if (gap === null) return tr('statsNoProgress')
  return gap > 0 ? tr('statsRemaining', { minutes: gap }) : tr('statsGoalDone')
})
const tabletTasksValue = computed(() => {
  const total = store.home?.tasks.length ?? 0
  if (total <= 0) return tr('taskCount', { count: 0 })
  return tr('tabletTasksDone', { done: completedTaskCount.value, total })
})
const tabletStatsTasksValue = computed(() => {
  const total = store.home?.tasks.length ?? 0
  return total > 0 ? tr('statsTasksValue', { done: completedTaskCount.value, total }) : '—'
})
const tabletTaskCount = computed(() => isTablet.value ? tabletTasksValue.value : tr('taskCount', { count: store.home?.tasks.length ?? 0 }))

type ScopedTabBarRuntime = {
  hideTabBar?: (options?: { animation?: boolean; fail?: () => void }) => void
  showTabBar?: (options?: { animation?: boolean; fail?: () => void }) => void
}
function scopedTabBarRuntime(): ScopedTabBarRuntime | null {
  try { return getUniRuntime() as unknown as ScopedTabBarRuntime } catch { return null }
}
/** Scoped uni-app tab-bar handoff; never a global pages.json/style change. */
function applyTabletTabBar(): void {
  const runtime = scopedTabBarRuntime()
  if (!runtime) return
  const action = homeTabletTabBarAction(tabletLayout.value, pageVisible.value)
  if (action === 'hide') runtime.hideTabBar?.({ animation: false, fail: () => { /* Non-tab public pages have no bar. */ } })
  else runtime.showTabBar?.({ animation: false, fail: () => { /* The route may already be non-tab. */ } })
}
function restoreTabletTabBar(): void {
  const runtime = scopedTabBarRuntime()
  runtime?.showTabBar?.({ animation: false, fail: () => { /* The destination may be a non-tab page. */ } })
}
function syncTabletLayout(): void {
  tabletLayout.value = homeTabletLayout(readViewportWidth())
  applyTabletTabBar()
}
let viewportListening = false
function listenViewport(): void {
  if (viewportListening || typeof window === 'undefined') return
  viewportListening = true
  window.addEventListener('resize', syncTabletLayout, { passive: true })
  window.addEventListener('orientationchange', syncTabletLayout, { passive: true })
}
function unlistenViewport(): void {
  if (!viewportListening || typeof window === 'undefined') return
  viewportListening = false
  window.removeEventListener('resize', syncTabletLayout)
  window.removeEventListener('orientationchange', syncTabletLayout)
}
function navigateTablet(path: string): void {
  if (busy.value || path === '/pages/home/home') return
  void navigate(path, `tablet-nav-${path}`)
}

const publishedContent = computed(() => (store.home?.content ?? []).filter((item) => isAccessibleContent(item)))
const visibleContent = computed(() => {
  const needle = courseQuery.value.trim().toLowerCase()
  return publishedContent.value.filter((item) => !needle || `${item.title} ${item.summary}`.toLowerCase().includes(needle))
})
const releaseNote = computed(() => shelfNote(publishedContent.value))
const contentUnavailable = computed(() => store.home?.contentStatus === 'UNAVAILABLE')
const shelf = computed((): ShelfSearchState => shelfSearchState(
  publishedContent.value.length,
  visibleContent.value.length,
  contentUnavailable.value,
))
const resultCount = computed(() => tr('resultCount', { count: visibleContent.value.length, total: publishedContent.value.length }))
const tabletCourse = computed(() => publishedContent.value[0] ?? null)
const tabletCourseKicker = computed(() => {
  const locale = tabletCourse.value?.contentLocale ?? ''
  if (!locale) return ''
  return locale.toLowerCase().startsWith('en') ? 'ENGLISH' : locale.toUpperCase()
})
const tabletCourseHeading = computed(() => isTablet.value ? tr('courseTitle') : tr('courses'))

function isActionable(task: MobileTask): boolean {
  return homeTaskHref(task) !== null
}
const firstTaskId = computed(() => store.home?.tasks.find(isActionable)?.id ?? '')
function isFirstTask(task: MobileTask): boolean { return task.id === firstTaskId.value && isActionable(task) }
function primaryLabel(task: MobileTask): string { return task.status === 'IN_PROGRESS' ? tr('continueLearning') : tr('startLearning') }
function secondaryLabel(task: MobileTask): string { return task.status === 'IN_PROGRESS' ? tr('continueShort') : tr('viewShort') }
function taskDescription(task: MobileTask): string {
  if (task.status === 'UNAVAILABLE' && task.description === (task.unavailableReason ?? '')) return ''
  return task.description
}
function stateLabel(task: MobileTask): string {
  if (task.status === 'COMPLETED') return tr('statusCompleted')
  if (task.status === 'LOCKED') return tr('statusLocked')
  return task.unavailableReason || tr('statusUnavailable')
}
function stateIcon(task: MobileTask): 'check' | 'lock' | 'x' {
  if (task.status === 'COMPLETED') return 'check'
  if (task.status === 'LOCKED') return 'lock'
  return 'x'
}
const heroTask = computed(() => store.home?.tasks.find(isActionable) ?? null)
const heroLabel = computed(() => (heroTask.value ? primaryLabel(heroTask.value) : ''))
function openHero(): void {
  const task = heroTask.value
  if (task) openTask(task)
}
function taskArt(task: MobileTask): { src: string; size: number } {
  const assets = art.value
  if (task.status === 'COMPLETED') return { src: assets.taskDone, size: 26 }
  if (task.status === 'IN_PROGRESS') return { src: assets.taskPencil, size: 26 }
  return { src: assets.book, size: 28 }
}
function taskStatusLine(task: MobileTask): string {
  const minutes = task.minutes > 0 ? tr('minutes', { count: task.minutes }) : ''
  const status = task.status === 'COMPLETED'
    ? tr('statusCompleted')
    : task.status === 'IN_PROGRESS'
      ? tr('statusInProgress')
      : task.status === 'AVAILABLE'
        ? tr('statusNew')
        : ''
  if (!status) return stateLabel(task)
  return minutes ? `${status} · ${minutes}` : status
}

const PLAN_CONFLICT_NOTICE = '计划版本已变化，请重新读取。'
const PLAN_REPLAN_NOTICE = '目标已保存。计划还没有按新目标重排。'
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const planNoticeText = computed(() => {
  const notice = store.planNotice
  if (!notice) return ''
  if (notice === PLAN_CONFLICT_NOTICE) return tr('planConflict')
  if (notice === PLAN_REPLAN_NOTICE) return tr('planReplanFailed')
  return notice
})
const firstLearningText = computed(() => {
  const first = store.planQueue?.firstLearning
  if (!first?.guideVisible) return ''
  if (first.reason === 'NO_PLAN') return tr('fl.noPlan')
  if (first.reason === 'NO_CONTENT') return tr('fl.noContent')
  if (first.reason === 'INCOMPLETE') return tr('fl.incomplete')
  return ''
})

function emptyCopy(reason: EmptyReason | null, guideActive: boolean): { title: string; description: string; action: string; to: 'onboarding' | 'courses' } | null {
  const hasCourses = publishedContent.value.length > 0
  switch (reason) {
    case 'NO_PLAN':
      // The guide above owns the next setup/assessment step; keep the honest
      // title but do not repeat its description or add a second setup button.
      return guideActive
        ? { title: tr('empty.noPlan.title'), description: '', action: '', to: 'onboarding' }
        : { title: tr('empty.noPlan.title'), description: tr('empty.noPlan.description'), action: tr('empty.noPlan.action'), to: 'onboarding' }
    case 'COMPLETED':
      return { title: tr('empty.completed.title'), description: tr('empty.completed.description'), action: hasCourses ? tr('empty.completed.action') : '', to: 'courses' }
    case 'NO_CONTENT':
      return { title: tr('empty.noContent.title'), description: tr('empty.noContent.description'), action: hasCourses ? tr('empty.noContent.action') : '', to: 'courses' }
    case 'NO_DUE_REVIEW':
      return { title: tr('empty.noReview.title'), description: tr('empty.noReview.description'), action: hasCourses ? tr('empty.noReview.action') : '', to: 'courses' }
    default:
      return null
  }
}
const planSettled = computed(() => store.planQueueStatus === 'ready' || store.planQueueStatus === 'empty' || store.planQueueStatus === 'error')
const planReadFailed = computed(() => store.planQueueStatus === 'error')
const planEmpty = computed(() => {
  if (!store.home || store.home.tasks.length) return null
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyCopy(store.planQueue?.emptyReason ?? null, guideVisible.value)
})
const showNoTasks = computed(() => Boolean(store.home) && !store.home?.tasks.length && planSettled.value && !planReadFailed.value && !planEmpty.value)

const guideStep = computed(() => store.onboardingResume ? selectOnboardingResumeStep(store.onboardingResume) : null)
const placementDone = computed(() => {
  const storage = typeof sessionStorage === 'undefined' ? null : sessionStorage
  return isPlacementSatisfied({
    placementEntryReached: hasPlacementEntryReached(storage, session.verifiedSubject),
    planId: store.planQueue?.planId ?? null,
  })
})
const serverPlacementUnknown = computed(() => {
  const homePending = store.homeStatus === 'idle' || store.homeStatus === 'loading'
  const planPending = store.planQueueStatus === 'idle' || store.planQueueStatus === 'loading'
  return homePending || planPending
})
const guideVisible = computed(() => {
  if (!accessChecked.value || !pageVisible.value || !session.isAuthenticated || !guideReady.value) return false
  const facts = store.onboardingResume
  if (!facts || session.adultGate === 'REJECTED') return false
  return showOnboardingGuide(facts, placementDone.value, { serverPlacementUnknown: serverPlacementUnknown.value })
})
const guideLabel = computed(() => {
  const step = guideStep.value
  return step && step !== 'rejected' ? tr(`guideLabel.${step}`) : ''
})
const guideStepsText = computed(() => {
  const step = guideStep.value
  const facts = store.onboardingResume
  // Assessment keeps the ready line only. Do not list the single 定级 step.
  if (!facts || !step || step === 'rejected' || step === 'assessment') return ''
  const labels = onboardingRemainingStepLabels(facts, placementDone.value)
  if (!labels.length) return ''
  if (String(mobileI18n.locale).toLowerCase().startsWith('en')) return tr(`stepsText.${step}`)
  return labels.join('、')
})
const guideRemainingText = computed(() => {
  if (!guideStepsText.value) return ''
  if (String(mobileI18n.locale).toLowerCase().startsWith('en')) return tr('guideRemaining', { steps: guideStepsText.value })
  return `剩余步骤：${guideStepsText.value}`
})
const guidePath = computed(() => homeGuidePath(guideStep.value) ?? '/pages/onboarding/onboarding')
const assessmentGuideVisible = computed(() => guideVisible.value && guideStep.value === 'assessment')
const secondaryVisible = computed(() => accessChecked.value && session.isAuthenticated && (store.homeStatus === 'ready' || store.homeStatus === 'empty' || store.homeStatus === 'unavailable'))
const confirmedAnonymous = computed(() => pageVisible.value && !session.isAuthenticated && (session.status === 'unauthenticated' || session.status === 'error'))
const loginBusy = ref(false)
let loginSeq = 0

async function recoverLogin(): Promise<void> {
  if (!pageVisible.value || session.isAuthenticated || session.status === 'revoking' || loginBusy.value) return
  const epoch = ++pageEpoch
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  accessChecked.value = false
  reading.value = false
  busy.value = null
  guideReady.value = false
  navError.value = ''
  const token = ++loginSeq
  const revision = session.identityRevision
  const before = currentMobilePagePath()
  loginBusy.value = true
  try {
    const allowed = await ensureMobilePageAccess('/pages/home/home')
    if (token !== loginSeq || epoch !== pageEpoch || !pageVisible.value) return
    if (!homeStillOnPage(currentMobilePagePath())) return
    if (session.isAuthenticated) { maybeEnter(); return }
    if (allowed) { maybeEnter(); return }
    if (currentMobilePagePath() !== before) return
    if (session.identityRevision !== revision) return
    navError.value = tr('navFailed')
  } catch {
    if (token === loginSeq && epoch === pageEpoch && pageVisible.value && !session.isAuthenticated && currentMobilePagePath() === before) {
      navError.value = tr('navFailed')
    }
  } finally {
    if (token === loginSeq) loginBusy.value = false
  }
}

const statusMessages = computed(() => {
  const skip = new Set<string>()
  if (guideVisible.value) {
    skip.add(guideLabel.value)
    skip.add(guideStepsText.value)
    skip.add(tr('guideContinueSetup'))
    skip.add(tr('guideAssessmentReady'))
    skip.add(tr('takeAssessment'))
    skip.add(guideRemainingText.value)
  }
  const seen = new Set<string>()
  const list: Array<{ id: string; text: string }> = []
  for (const [id, value] of [['explanation', planExplanation.value ?? ''], ['notice', planNoticeText.value], ['first', firstLearningText.value]] as const) {
    const text = value.trim()
    // The guide already owns first-learning setup messaging; do not stack a
    // synonymous local first-learning line above it.
    if (id === 'first' && guideVisible.value) continue
    if (!text || seen.has(text) || skip.has(text)) continue
    seen.add(text)
    list.push({ id, text })
  }
  return list
})

async function loadGuide(token: EntryToken): Promise<void> {
  if (!homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true) || session.adultGate === 'REJECTED' || typeof store.loadOnboardingResume !== 'function') return
  guideReady.value = false
  try {
    await store.loadOnboardingResume()
    if (homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true)) guideReady.value = true
  } catch {
    if (entryCurrent(token)) guideReady.value = false
  }
}

async function readEntry(token: EntryToken, key: string): Promise<void> {
  if (!homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true)) {
    if (activeEntry?.seq === token.seq) activeEntry = null
    return
  }
  accessChecked.value = true
  pageOwnerKey = key
  reading.value = true
  try {
    await store.loadHome()
    if (homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true)) await loadGuide(token)
  } finally {
    if (entryCurrent(token)) {
      reading.value = false
      if (homeStillOnPage(currentMobilePagePath())) enteredEpoch = pageEpoch
      activeEntry = null
    } else if (activeEntry?.seq === token.seq) {
      activeEntry = null
    }
    if (pageVisible.value && ownerKey() !== key && homeStillOnPage(currentMobilePagePath())) maybeEnter()
  }
}

async function runEntry(): Promise<void> {
  if (!pageVisible.value) return
  const key = ownerKey()
  if (!key) {
    accessChecked.value = false
    return
  }
  // Only one live attempt per epoch; a new epoch may supersede it immediately.
  if (activeEntry && activeEntry.epoch === pageEpoch && activeEntry.owner === key) return
  const token: EntryToken = { epoch: pageEpoch, seq: ++entrySeq, owner: key }
  activeEntry = token
  accessChecked.value = false
  reading.value = false
  let allowed = false
  try { allowed = await ensureMobilePageAccess('/pages/home/home') } catch { allowed = false }
  // onHide can lag behind the hash. Do not read home after the top page has left.
  const mayRead = homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), allowed)
  if (!mayRead) {
    if (activeEntry?.seq === token.seq) activeEntry = null
    if (pageVisible.value && ownerKey() === key && (!allowed || !homeStillOnPage(currentMobilePagePath()))) return
    maybeEnter()
    return
  }
  await readEntry(token, key)
}

function maybeEnter(): void {
  if (!pageVisible.value) return
  const key = ownerKey()
  if (!key) return
  if (accessChecked.value && pageOwnerKey === key && enteredEpoch === pageEpoch && !reading.value) return
  if (activeEntry && activeEntry.epoch === pageEpoch && activeEntry.owner === key) return
  void runEntry()
}

async function navigate(url: string, key: string): Promise<void> {
  if (busy.value) return
  const token = beginAction()
  busy.value = key
  navError.value = ''
  // Restore the native bar while Home is still the current tab page. The
  // destination could be a tab page (Learn/Practice) or a non-tab page.
  if (isTablet.value) restoreTabletTabBar()
  try {
    const result = openUniPage(url)
    if (isThenable(result)) await result
  } catch {
    if (actionCurrent(token) && currentMobilePagePath() === '/pages/home/home') {
      navError.value = tr('navFailed')
      applyTabletTabBar()
    }
  } finally {
    if (actionCurrent(token)) busy.value = null
  }
}

function focusCourseHeading(): void {
  // #ifdef H5
  document.getElementById('course-heading')?.focus({ preventScroll: true })
  // #endif
  // #ifndef H5
  searchFocus.value = true
  // #endif
}

function scrollToCourses(): void {
  courseJumpFailed.value = false
  const epoch = pageEpoch
  const owner = ownerKey()
  const onPage = (): boolean => pageVisible.value && epoch === pageEpoch && owner !== '' && owner === ownerKey()
  const reduceMotion = experienceMotion.value !== 'on'
  const duration = reduceMotion ? 0 : 250
  const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth'
  const domFallback = (): boolean => {
    if (!onPage()) return false
    try {
      if (typeof document === 'undefined') return false
      const target = document.getElementById('course-shelf')
      if (!target) return false
      target.scrollIntoView({ behavior, block: 'start' })
      focusCourseHeading()
      return true
    } catch { return false }
  }
  try {
    const runtime = getUniRuntime() as unknown as { pageScrollTo?: (options: { selector?: string; duration?: number; success?: () => void; fail?: () => void }) => void }
    if (typeof runtime.pageScrollTo === 'function') {
      runtime.pageScrollTo({ selector: '#course-shelf', duration, success: () => { if (onPage()) focusCourseHeading() }, fail: () => { if (onPage() && !domFallback()) courseJumpFailed.value = true } })
      return
    }
  } catch { /* fall through to the DOM path */ }
  if (onPage() && !domFallback()) courseJumpFailed.value = true
}

async function runPlanEmpty(): Promise<void> {
  const view = planEmpty.value
  if (!view || busy.value) return
  if (view.to === 'onboarding') { await navigate('/pages/onboarding/onboarding', 'empty'); return }
  scrollToCourses()
}

function openTask(task: MobileTask): void {
  const href = homeTaskHref(task)
  if (!href || busy.value) return
  void navigate(href, `task-${task.id}`)
}

function openCourse(contentCode: string): void {
  const href = homeContentHref(contentCode)
  if (!href || busy.value) return
  void navigate(href, `course-${contentCode}`)
}

function onCourseInput(event: unknown): void {
  const detail = (event as { detail?: { value?: unknown } } | null)?.detail
  courseQuery.value = typeof detail?.value === 'string' ? detail.value : ''
}

function focusSearchInput(): void {
  const epoch = pageEpoch
  const owner = ownerKey()
  searchFocus.value = false
  void nextTick(() => {
    if (pageVisible.value && epoch === pageEpoch && owner !== '' && owner === ownerKey()) searchFocus.value = true
  })
}

function clearSearch(): void {
  courseQuery.value = ''
  focusSearchInput()
}

function syncSearchAccessibility(): void {
  // #ifdef H5
  if (!pageVisible.value || !accessChecked.value) return
  const host = searchField.value?.$el
  if (!host) return
  const input = host.matches('input') ? host as HTMLInputElement : host.querySelector<HTMLInputElement>('.uni-input-input, input')
  if (!input) return
  input.setAttribute('aria-label', tr('searchLabel'))
  input.setAttribute('placeholder', tr('searchPlaceholder'))
  input.setAttribute('type', 'search')
  input.setAttribute('autocomplete', 'off')
  // #endif
}

async function retryHome(): Promise<void> {
  if (busy.value) return
  const action = beginAction()
  if (!homeStillOnPage(currentMobilePagePath())) return
  busy.value = 'retry'
  reading.value = true
  const key = ownerKey()
  if (!key) {
    reading.value = false
    if (actionCurrent(action)) busy.value = null
    return
  }
  const token: EntryToken = { epoch: pageEpoch, seq: ++entrySeq, owner: key }
  activeEntry = token
  try {
    if (!homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true)) return
    await store.loadHome()
    if (homePrivateReadAllowed(currentMobilePagePath(), entryCurrent(token), true)) await loadGuide(token)
  } finally {
    if (entryCurrent(token)) {
      reading.value = false
      if (homeStillOnPage(currentMobilePagePath())) enteredEpoch = pageEpoch
      if (activeEntry?.seq === token.seq) activeEntry = null
    } else if (activeEntry?.seq === token.seq) {
      activeEntry = null
    }
    if (actionCurrent(action)) busy.value = null
  }
}

async function retryPlan(): Promise<void> {
  if (busy.value) return
  const action = beginAction()
  busy.value = 'plan'
  try {
    // Keep the existing owner/scope default; the optional predicate drops a
    // late plan read that belongs to an older epoch/owner/action.
    await store.refreshPlanQueue(undefined, () => actionCurrent(action))
  } finally {
    if (actionCurrent(action)) busy.value = null
  }
}

onShow(() => {
  pageVisible.value = true
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  accessChecked.value = false
  reading.value = false
  guideReady.value = false
  busy.value = null
  navError.value = ''
  courseJumpFailed.value = false
  syncTabletLayout()
  if (session.isAuthenticated) maybeEnter()
  else void recoverLogin()
})

function leavePage(): void {
  // Leave with the native bar restored even if the route change bypassed
  // navigate() (history/back or a direct hash change).
  restoreTabletTabBar()
  pageVisible.value = false
  pageEpoch += 1
  entrySeq += 1
  actionSeq += 1
  activeEntry = null
  enteredEpoch = -1
  reading.value = false
  busy.value = null
  guideReady.value = false
  accessChecked.value = false
}

onHide(leavePage)
onBeforeUnmount(() => {
  leavePage()
  unlistenViewport()
})

watch(() => session.identityRevision, () => {
  invalidatePage()
  if (session.isAuthenticated) maybeEnter()
  else void recoverLogin()
}, { flush: 'sync' })

watch(() => session.status, (status) => {
  if (status === 'authenticated') maybeEnter()
  else if (status === 'unauthenticated' || status === 'error') {
    if (!session.isAuthenticated) void recoverLogin()
  }
})

watch(homeLocaleTick, () => {
  void nextTick(syncSearchAccessibility)
})

watch([accessChecked, reading], ([checked, isLoading]) => {
  if (checked && !isLoading) void nextTick(syncSearchAccessibility)
})

onMounted(() => {
  syncTabletLayout()
  listenViewport()
  void nextTick(syncSearchAccessibility)
})
</script>

<template>
  <view class="yx-page yx-r4-screen home-page" :class="`home-page--${tabletLayout}`" :style="pageStyle" :data-motion="experienceMotion" :data-theme="theme">
    <view class="home-fx yx-r4-fx" aria-hidden="true">
      <FigmaAsset class="home-fx__glow" :src="art.glow" :width="540" :height="480" />
      <FigmaAsset class="home-fx__blob-a" :src="art.blobA" :width="460" :height="460" />
      <FigmaAsset class="home-fx__blob-c" :src="art.blobC" :width="300" :height="300" />
      <FigmaAsset class="home-fx__blob-d" :src="art.blobD" :width="340" :height="340" />
    </view>
    <HomeTabletNav
      v-if="isTablet"
      :variant="isSidebar ? 'sidebar' : 'rail'"
      :theme="theme"
      active="home"
      :disabled="busy !== null"
      @navigate="navigateTablet"
    />
    <view class="home-body">
    <view class="home-topbar">
      <view class="home-brandline">
        <FigmaAsset :src="art.sparkle" :width="22" :height="22" />
        <view class="home-logo" aria-hidden="true">
          <FigmaAsset class="home-logo__glow" :src="art.logoGlow" :width="64" :height="64" />
          <FigmaAsset :src="art.logo" :width="40" :height="40" />
        </view>
        <view class="home-wordmark">
          <text class="home-brand">{{ mobileT('brand') }}</text>
          <text class="home-brand-en">{{ mobileT('brandEnglish') }}</text>
        </view>
      </view>
      <button tabindex="0" role="button" type="button" class="home-settings" :aria-label="mobileT('settings')" :disabled="busy !== null || reading" @click="navigate('/pages/settings/settings', 'settings')">
        <AppIcon name="gear" :size="22" />
      </button>
    </view>

    <view class="home-heading">
      <text class="home-title" role="heading" aria-level="1">{{ tr('h1') }}</text>
      <text v-if="isTablet" class="home-tablet-headline">{{ tabletHeadline }}</text>
      <text v-if="isTablet" class="home-tablet-subtitle">{{ tr('tabletSubtitle') }}</text>
    </view>

    <view v-if="!accessChecked" class="home-line" role="status">
      <template v-if="confirmedAnonymous">
        <text>{{ tr('loginNote') }}</text>
        <button tabindex="0" role="button" type="button" class="home-text-action" @click="recoverLogin">{{ tr('loginAction') }}</button>
        <text v-if="navError" class="home-line--error">{{ navError }}</text>
      </template>
      <text v-else>{{ tr('checking') }}</text>
    </view>

    <template v-else>
      <view v-if="!session.isAuthenticated" class="home-line" role="status">
        <text>{{ tr('loginNote') }}</text>
        <button tabindex="0" role="button" type="button" class="home-text-action" @click="recoverLogin">{{ tr('loginAction') }}</button>
      </view>

      <template v-else>
        <view v-if="reading || store.homeStatus === 'idle' || store.homeStatus === 'loading'" class="home-line" role="status"><text>{{ tr('loading') }}</text></view>

        <view v-else-if="store.homeStatus === 'offline' || store.homeStatus === 'error'" class="home-block" role="alert">
          <text class="home-block__title">{{ tr('errorTitle') }}</text>
          <text class="home-block__desc">{{ tr('errorHint') }}</text>
          <button tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
        </view>

        <view v-else-if="store.homeStatus === 'forbidden'" class="home-block" role="alert">
          <text class="home-block__title">{{ tr('forbiddenTitle') }}</text>
          <text class="home-block__desc">{{ tr('forbiddenDesc') }}</text>
        </view>

        <template v-else>
          <view v-if="navError" class="home-line home-line--error" role="alert"><text>{{ navError }}</text></view>

          <view v-if="homeReady" class="home-hero home-glass">
            <view class="home-hero__fx yx-r4-fx" aria-hidden="true">
              <FigmaAsset class="home-hero__blob" :src="art.blobB" :width="440" :height="440" />
              <FigmaAsset class="home-hero__particles" :src="art.particles" :width="180" :height="140" />
            </view>
            <view class="home-hero__top">
              <view class="home-hero__copy">
                <text class="home-hero__greet">{{ greeting }}</text>
                <text v-if="tabletHeroHeadline" class="home-hero__remain">{{ tabletHeroHeadline }}</text>
                <text v-if="progressText" class="home-progress__text">{{ progressText }}</text>
              </view>
              <view
                v-if="showProgress"
                class="home-ring"
                :role="progressPercent !== null ? 'progressbar' : undefined"
                :aria-label="tr('progressLabel')"
                :aria-valuemin="progressPercent !== null ? 0 : undefined"
                :aria-valuemax="progressPercent !== null ? 100 : undefined"
                :aria-valuenow="progressPercent !== null ? progressValue : undefined"
              >
                <FigmaAsset :src="art.track" :width="tabletRingSize" :height="tabletRingSize" />
                <view v-if="ringStyle" class="home-ring__value" :style="{ backgroundImage: ringStyle }"></view>
                <text v-if="progressPercent !== null" class="home-ring__pct">{{ progressValue }}%</text>
                <text v-if="isTablet && progressPercent !== null" class="home-ring__label">{{ tr('statusCompleted') }}</text>
              </view>
            </view>
            <button
              v-if="heroTask"
              tabindex="0"
              role="button"
              type="button"
              class="home-primary home-hero__cta"
              :disabled="busy !== null"
              @click="openHero"
            >
              <text>{{ heroLabel }}</text>
              <FigmaAsset class="home-hero__arrow" :src="art.arrow" :width="18" :height="18" />
              <text v-if="isTablet" class="home-tablet-cta-arrow" aria-hidden="true">→</text>
            </button>
            <view v-if="heroMeta" class="home-hero__meta">
              <FigmaAsset :src="art.schedule" :width="17" :height="17" />
              <text>{{ heroMeta }}</text>
            </view>
          </view>

          <view v-if="isTablet && homeReady" class="home-stats" :class="{ 'home-stats--sidebar': isSidebar }">
            <text class="home-stats__title">{{ isSidebar ? tr('statsTitleOverview') : tr('statsTitle') }}</text>
            <text class="home-stats__value">{{ tabletStatsValue }}</text>
            <text class="home-stats__caption">{{ tabletStatsCaption }}</text>
            <view
              class="home-stats__track"
              :role="progressPercent !== null ? 'progressbar' : undefined"
              :aria-label="tr('progressLabel')"
              :aria-valuemin="progressPercent !== null ? 0 : undefined"
              :aria-valuemax="progressPercent !== null ? 100 : undefined"
              :aria-valuenow="progressPercent !== null ? progressValue : undefined"
            >
              <view v-if="progressPercent !== null" class="home-stats__fill" :style="{ width: `${progressValue}%` }"></view>
            </view>
            <view class="home-stats__foot">
              <template v-if="isSidebar">
                <text class="home-stats__foot-label">{{ tr('statsTasks') }}</text>
                <text class="home-stats__foot-value">{{ tabletStatsTasksValue }}</text>
              </template>
              <text v-else class="home-stats__note">{{ tabletStatsRemaining }}</text>
            </view>
          </view>

          <view v-if="statusMessages.length" class="home-status">
            <text v-for="message in statusMessages" :key="message.id" class="home-status__line" role="status">{{ message.text }}</text>
          </view>

          <view v-if="guideVisible" class="home-guide">
            <template v-if="assessmentGuideVisible">
              <text class="home-guide__label">{{ tr('guideAssessmentReady') }}</text>
              <button tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="navigate(guidePath, 'guide')">{{ tr('takeAssessment') }}</button>
            </template>
            <template v-else>
              <text class="home-guide__label">{{ guideLabel }}</text>
              <text v-if="guideRemainingText" class="home-guide__steps">{{ guideRemainingText }}</text>
              <button tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="navigate(guidePath, 'guide')">{{ tr('guideContinueSetup') }}</button>
            </template>
          </view>

          <view class="home-columns">
          <view class="home-section home-card home-glass home-tasks">
            <view class="home-section__head">
              <text class="home-section__title" role="heading" aria-level="2">{{ tr('tasks') }}</text>
              <text v-if="(store.home?.tasks.length ?? 0) > 0" class="home-section__count">{{ tabletTaskCount }}</text>
            </view>

            <view v-if="planReadFailed" class="home-line home-line--error" role="alert">
              <text>{{ tr('planReadFailed') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryPlan">{{ tr('retry') }}</button>
            </view>

            <view v-if="planEmpty" class="home-empty">
              <text class="home-empty__title">{{ planEmpty.title }}</text>
              <text v-if="planEmpty.description" class="home-empty__desc">{{ planEmpty.description }}</text>
              <button v-if="planEmpty.action" tabindex="0" role="button" type="button" class="home-ghost" :disabled="busy !== null" @click="runPlanEmpty">{{ planEmpty.action }}</button>
            </view>

            <view v-else-if="showNoTasks" class="home-empty">
              <text class="home-empty__desc">{{ tr('noTasks') }}</text>
              <text v-if="publishedContent.length" class="home-empty__desc">{{ tr('noTasksHint') }}</text>
            </view>

            <template v-else-if="store.home?.tasks.length">
              <template v-for="(task, taskIndex) in store.home.tasks" :key="task.id">
                <button
                  v-if="isActionable(task)"
                  tabindex="0"
                  role="button"
                  type="button"
                  class="home-task home-task__secondary"
                  :class="[
                    `home-task--${task.status.toLowerCase()}`,
                    { 'home-task--first': isFirstTask(task), 'home-task--alt': taskIndex % 2 === 1 },
                  ]"
                  :disabled="busy !== null"
                  @click="openTask(task)"
                >
                  <view class="home-task__tile">
                    <FigmaAsset :src="taskArt(task).src" :width="taskArt(task).size" :height="taskArt(task).size" />
                  </view>
                  <view class="home-task__copy">
                    <text class="home-task__title">{{ task.title }}</text>
                    <text v-if="taskStatusLine(task)" class="home-task__meta" :class="{ 'is-active': task.status === 'IN_PROGRESS' }">{{ taskStatusLine(task) }}</text>
                    <text v-if="taskDescription(task)" class="home-task__desc">{{ taskDescription(task) }}</text>
                  </view>
                  <view class="home-task__trail">
                    <text class="home-task__action">{{ secondaryLabel(task) }}</text>
                    <FigmaAsset :src="art.chevron" :width="20" :height="20" />
                  </view>
                </button>
                <view v-else class="home-task" :class="[`home-task--${task.status.toLowerCase()}`, { 'home-task--alt': taskIndex % 2 === 1 }]">
                  <view class="home-task__tile">
                    <FigmaAsset :src="taskArt(task).src" :width="taskArt(task).size" :height="taskArt(task).size" />
                  </view>
                  <view class="home-task__copy">
                    <text class="home-task__title">{{ task.title }}</text>
                    <text v-if="taskStatusLine(task)" class="home-task__meta" :class="{ 'is-active': task.status === 'IN_PROGRESS' }">{{ taskStatusLine(task) }}</text>
                    <text v-if="taskDescription(task)" class="home-task__desc">{{ taskDescription(task) }}</text>
                  </view>
                  <view class="home-task__state">
                    <view v-if="task.status === 'COMPLETED'" class="home-task__check">
                      <FigmaAsset class="home-task__check-art" :src="art.check" :width="14" :height="14" />
                      <view class="home-task__check-fallback"><AppIcon name="check" :size="16" /></view>
                    </view>
                    <AppIcon v-else :name="stateIcon(task)" :size="16" />
                    <text>{{ stateLabel(task) }}</text>
                  </view>
                </view>
              </template>
            </template>
          </view>

          <view id="course-shelf" class="home-section home-card home-glass">
            <text id="course-heading" class="home-section__title" role="heading" aria-level="2" tabindex="-1">{{ tabletCourseHeading }}</text>
            <view v-if="isTablet && tabletCourse && !contentUnavailable" class="home-tablet-course">
              <view class="home-tablet-course__art">
                <text class="home-tablet-course__kicker">{{ tabletCourseKicker }}</text>
                <text class="home-tablet-course__art-title">{{ tabletCourse.title }}</text>
                <text class="home-tablet-course__art-desc">{{ tabletCourse.summary || tr('noSummary') }}</text>
                <FigmaAsset class="home-tablet-course__spark" :src="homeAssets.sparkle" :width="isSidebar ? 67 : 50" :height="isSidebar ? 67 : 50" />
                <FigmaAsset class="home-tablet-course__badge" :src="tabletBadge" :width="isSidebar ? 85 : 78" :height="isSidebar ? 87 : 79" />
              </view>
              <view class="home-tablet-course__copy">
                <text class="home-tablet-course__title">{{ tabletCourse.title }}</text>
                <text class="home-tablet-course__desc">{{ tabletCourse.summary || tr('noSummary') }}</text>
                <button
                  tabindex="0"
                  role="button"
                  type="button"
                  class="home-tablet-course__cta"
                  :disabled="busy !== null"
                  @click="openCourse(tabletCourse.contentCode)"
                >
                  <text>{{ tr('courseCta') }}</text>
                  <text class="home-tablet-course__arrow" aria-hidden="true">→</text>
                </button>
              </view>
            </view>
            <view class="home-search">
              <FigmaAsset :src="art.search" :width="20" :height="20" />
              <input
                ref="searchField"
                class="home-search__input"
                type="search"
                placeholder-style="color: var(--yx-text-secondary); opacity: 1; font-family: inherit; font-size: inherit; font-weight: inherit;"
                :value="courseQuery"
                :focus="searchFocus"
                :aria-label="tr('searchLabel')"
                :placeholder="tr('searchPlaceholder')"
                @input="onCourseInput"
                @blur="searchFocus = false"
              />
              <button v-if="courseQuery" tabindex="0" role="button" type="button" class="home-search__clear" :aria-label="tr('searchClear')" @click="clearSearch">
                <AppIcon name="x" :size="16" />
              </button>
            </view>
            <text v-if="courseQuery.trim()" class="home-search__count">{{ resultCount }}</text>
            <view v-if="courseJumpFailed" class="home-line home-line--error" role="status"><text>{{ tr('coursesJumpFailed') }}</text></view>
            <text v-if="releaseNote" class="home-note">{{ releaseNote }}</text>

            <view v-if="contentUnavailable" class="home-line home-line--error" role="alert">
              <text>{{ tr('shelfUnavailable') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
            </view>
            <view v-else-if="shelf === 'error'" class="home-line home-line--error" role="alert">
              <text>{{ tr('shelfError') }}</text>
              <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="retryHome">{{ tr('retry') }}</button>
            </view>
            <view v-else-if="shelf === 'catalog-empty'" class="home-line"><text>{{ tr('catalogEmpty') }}</text></view>
            <view v-else-if="shelf === 'no-matches'" class="home-line"><text>{{ tr('noMatches') }}</text></view>
            <view v-else class="home-course-list">
              <button
                v-for="item in visibleContent"
                :key="item.contentCode"
                tabindex="0"
                role="button"
                type="button"
                class="home-course"
                :disabled="busy !== null"
                @click="openCourse(item.contentCode)"
              >
                <FigmaAsset :src="art.courseArt" :width="40" :height="40" />
                <view class="home-course__copy">
                  <text class="home-course__title">{{ item.title }}</text>
                  <text class="home-course__desc">{{ item.summary || tr('noSummary') }}</text>
                </view>
                <FigmaAsset :src="art.chevron" :width="20" :height="20" />
              </button>
            </view>
          </view>
          </view>

          <button tabindex="0" role="button" type="button" class="home-navrow home-glass" :disabled="busy !== null" @click="navigate('/pages/b10-report/b10-report', 'mistakes')">
            <view class="home-navrow__copy">
              <text class="home-navrow__title">{{ tr('mistakes') }}</text>
              <text class="home-navrow__desc">{{ tr('mistakesDesc') }}</text>
            </view>
            <FigmaAsset :src="art.chevron" :width="20" :height="20" />
          </button>

          <view v-if="secondaryVisible" class="home-secondary-row">
            <button tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="navigate('/pages/onboarding/onboarding', 'goal')">{{ tr('changeGoal') }}</button>
            <button v-if="!assessmentGuideVisible" tabindex="0" role="button" type="button" class="home-text-action" :disabled="busy !== null" @click="navigate('/pages/assessment/assessment', 'assessment')">{{ tr('takeAssessment') }}</button>
          </view>
        </template>
      </template>
    </template>
    </view>
  </view>
</template>

<style scoped>
/* Device node 166:7348 and its 59px demo status bar are not copied.
   The column is inner screen 166:7349 (390). Top inset is the real safe area. */
:root .home-page {
  box-sizing: border-box;
  position: relative;
  width: 100%;
  max-width: 390px;
  margin-left: auto;
  margin-right: auto;
  padding: calc(8px + env(safe-area-inset-top, 0px)) 24px calc(108px + env(safe-area-inset-bottom, 0px));
  overflow-x: hidden;
  color: var(--yx-r4-ink, var(--yx-text-primary));
  background-color: var(--yx-r4-page-color, var(--yx-surface-page));
  background-image: var(--yx-r4-home-image, none);
  font-family: var(--v2-font);
}
.home-page button,
.home-page input {
  font-family: var(--v2-font);
}
.home-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.home-fx__glow { position: absolute; top: -200px; right: -160px; }
.home-fx__blob-a { position: absolute; left: -240px; bottom: 80px; }
.home-fx__blob-c { position: absolute; right: -140px; top: 180px; }
.home-fx__blob-d { position: absolute; left: -80px; top: 420px; }
.home-body { position: relative; z-index: 1; }
.home-topbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
.home-brandline { display: flex; align-items: center; gap: 8px; min-width: 0; }
.home-logo { position: relative; width: 40px; height: 40px; flex: 0 0 auto; }
.home-logo__glow { position: absolute; left: -12px; top: -12px; }
.home-wordmark { display: flex; flex-direction: column; min-width: 0; }
.home-brand { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 15px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.home-brand-en { color: var(--yx-r4-wordmark, var(--yx-r4-muted, var(--yx-text-secondary))); font-size: 11px; line-height: 1.3; overflow-wrap: anywhere; }
.home-settings { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border: 1px solid var(--yx-r4-glass-border, var(--yx-border)); border-radius: 50%; background: var(--yx-r4-glass, var(--yx-surface-card)); color: var(--yx-r4-ink, var(--yx-text-primary)); }
.home-settings[disabled] { opacity: .55; }
.home-title { display: block; margin: 12px 0 0; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 22px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.home-glass { position: relative; border: 1px solid var(--yx-r4-glass-border, rgba(255, 255, 255, .72)); background-color: var(--yx-r4-glass, rgba(250, 247, 255, .74)); box-shadow: var(--yx-r4-shadow-card, none); backdrop-filter: blur(var(--yx-r4-blur, 0px)); -webkit-backdrop-filter: blur(var(--yx-r4-blur, 0px)); }
.home-page[data-motion="reduced"] .home-glass,
.home-page[data-motion="off"] .home-glass { backdrop-filter: none; -webkit-backdrop-filter: none; }
.home-hero { display: flex; flex-direction: column; gap: 18px; margin-top: 12px; padding: 22px 22px 20px; overflow: hidden; border-radius: 28px; }
.home-hero__fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.home-hero__blob { position: absolute; right: -180px; top: -120px; }
.home-hero__particles { position: absolute; right: 0; top: 0; }
.home-hero__top { position: relative; display: flex; align-items: center; gap: 12px; }
.home-hero__copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 4px; min-width: 0; }
.home-hero__greet { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 20px; }
.home-hero__remain,
.home-progress__text { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 22px; overflow-wrap: anywhere; }
.home-ring { position: relative; width: 96px; height: 96px; flex: 0 0 auto; }
.home-ring__value { position: absolute; inset: 0; border-radius: 50%; -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px)); mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 calc(100% - 7px)); }
.home-ring__pct { position: absolute; left: 0; top: 0; width: 96px; height: 96px; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 22px; font-weight: 700; line-height: 96px; text-align: center; }
.home-hero__meta { position: relative; display: flex; align-items: flex-start; gap: 8px; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 12px; line-height: 18px; }
.home-hero__meta text { min-width: 0; overflow-wrap: anywhere; }
.home-line { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px 0; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-line--error { color: var(--yx-danger); }
.home-block { display: grid; justify-items: start; gap: 8px; margin-top: 12px; padding: 16px; border: 1px solid var(--yx-r4-glass-border, var(--yx-border)); border-radius: 18px; background: var(--yx-r4-glass, var(--yx-surface-card)); }
.home-block__title { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.home-block__desc { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-status { display: grid; gap: 6px; margin: 12px 0 0; }
.home-status__line { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-guide { display: grid; justify-items: start; gap: 6px; margin: 16px 0 0; padding: 14px 16px; border: 1px solid var(--yx-r4-glass-border, var(--yx-border)); border-radius: 18px; background: var(--yx-r4-glass, transparent); }
.home-guide__label { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.home-guide__steps { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-section { margin-top: 16px; }
.home-card { padding: 12px 20px 10px; border-radius: 24px; }
#course-shelf.home-card { padding: 16px; border-radius: 18px; }
.home-section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.home-section__title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 18px; font-weight: 700; line-height: 26px; overflow-wrap: anywhere; }
.home-section__title:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-section__count { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.6; }
.home-empty { display: grid; justify-items: start; gap: 6px; padding: 12px 0 8px; }
.home-empty__title { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.home-empty__desc { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-task { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; margin: 0; padding: 10px 0; border: 0; background: transparent; color: inherit; text-align: left; }
.home-task__tile { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid var(--yx-r4-glass-border, rgba(255, 255, 255, .9)); border-radius: 14px; background: var(--yx-r4-field, rgba(255, 255, 255, .92)); }
.home-task__copy { flex: 1 1 auto; min-width: 0; }
.home-task__title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 15px; font-weight: 700; line-height: 22px; overflow-wrap: anywhere; }
.home-task__meta { display: block; margin-top: 2px; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.home-task__meta.is-active { color: var(--yx-r4-brand, var(--yx-brand)); }
.home-task__desc { display: block; margin-top: 2px; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 20px; overflow-wrap: anywhere; }
.home-task__trail { display: inline-flex; flex: 0 0 auto; align-items: center; gap: 4px; min-height: 44px; }
.home-task__action { color: var(--yx-r4-brand, var(--yx-brand)); font-size: 14px; font-weight: 650; line-height: 1.4; }
.home-task__state { display: inline-flex; flex: 0 1 auto; align-items: center; gap: 6px; max-width: 46%; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.4; overflow-wrap: anywhere; }
.home-task__check { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 12px; background: var(--yx-success); }
.home-task__check-fallback { display: none; }
.home-primary, .home-ghost { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; border-radius: var(--yx-radius-button); font-family: inherit; font-weight: 650; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
.home-primary.home-hero__cta { position: relative; width: 100%; min-height: 52px; height: auto; gap: 8px; padding: 12px 18px; border: 1px solid transparent; border-radius: 26px; background-color: var(--yx-r4-cta-color, var(--yx-brand)); background-image: var(--yx-r4-cta-image, none); box-shadow: var(--yx-r4-shadow-cta, none); color: var(--yx-r4-on-cta, var(--yx-on-brand)); font-size: 16px; font-weight: 700; }
.home-ghost { min-height: 44px; padding: 10px 16px; border: 1px solid var(--yx-r4-brand, var(--yx-brand)); background: var(--yx-r4-field, var(--yx-surface-card)); color: var(--yx-r4-brand, var(--yx-brand)); font-size: 16px; white-space: normal; }
.home-primary[disabled], .home-ghost[disabled], .home-text-action[disabled], .home-course[disabled], .home-navrow[disabled] { opacity: .55; }
.home-search { display: flex; align-items: center; gap: 8px; box-sizing: border-box; margin-top: 12px; padding: 0 8px 0 16px; min-height: 48px; border: 1px solid var(--yx-r4-field-border, var(--yx-border)); border-radius: 24px; background: var(--yx-r4-field, var(--yx-surface-card)); color: var(--yx-r4-muted, var(--yx-text-secondary)); }
.home-search__input { flex: 1 1 auto; min-width: 0; height: auto; min-height: 46px; padding: 10px 0; border: 0; border-radius: 0; background: transparent; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; line-height: 1.5; }
.home-search__input:focus-visible { outline: none; }
/* uni-h5 renders its own placeholder overlay inside the input component and
 * the native input has a UA ::placeholder. Both must use the semantic
 * secondary text color; host-only CSS leaves the inner placeholder gray. */
.home-search :deep(.uni-input-placeholder) {
  color: var(--yx-text-secondary);
  opacity: 1;
  font: inherit;
}
/* uni compiles `input` in a deep selector to `uni-input`, which never matches
 * the real native input. Target uni's own internal input class instead. */
.home-search :deep(.uni-input-input::placeholder) {
  color: var(--yx-text-secondary);
  opacity: 1;
  font: inherit;
}
.home-search:focus-within { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-search__clear { display: inline-flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--yx-text-secondary); }
.home-search__count { display: block; margin-top: 8px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; }
.home-note { display: block; margin-top: 8px; color: var(--yx-text-secondary); font-size: 14px; line-height: 1.6; overflow-wrap: break-word; }
.home-course-list { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
.home-course { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 64px; padding: 12px; border: 1px solid var(--yx-r4-glass-border, transparent); border-radius: 18px; background: var(--yx-r4-field, var(--yx-surface-card)); color: var(--yx-r4-muted, var(--yx-text-secondary)); text-align: left; }
.home-course__copy { flex: 1 1 auto; min-width: 0; }
.home-course__title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.home-course__desc { display: block; margin-top: 2px; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-navrow { display: flex; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-height: 72px; margin-top: 16px; padding: 16px; border-radius: 18px; color: var(--yx-r4-muted, var(--yx-text-secondary)); text-align: left; }
.home-navrow__copy { flex: 1 1 auto; min-width: 0; }
.home-navrow__title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 16px; font-weight: 650; line-height: 1.5; overflow-wrap: anywhere; }
.home-navrow__desc { display: block; margin-top: 2px; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.home-secondary-row { display: flex; flex-wrap: wrap; gap: 8px 24px; margin-top: 8px; padding-top: 8px; }
.home-text-action { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 4px; border: 0; border-radius: var(--yx-radius-button); background: transparent; color: var(--yx-r4-brand, var(--yx-brand)); font-size: 16px; font-weight: 650; line-height: 1.5; text-align: center; overflow-wrap: anywhere; }
.home-settings:focus-visible, .home-primary:focus-visible, .home-ghost:focus-visible, .home-text-action:focus-visible, .home-course:focus-visible, .home-navrow:focus-visible, .home-task:focus-visible, .home-search__clear:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
:root[data-theme="high-contrast"] .home-hero__arrow,
:root[data-theme="dark"] .home-task__check-art,
:root[data-theme="high-contrast"] .home-task__check-art { display: none; }
:root[data-theme="dark"] .home-task__check,
:root[data-theme="high-contrast"] .home-task__check { background: transparent; }
:root[data-theme="dark"] .home-task__check-fallback,
:root[data-theme="high-contrast"] .home-task__check-fallback { display: inline-flex; }
.home-columns { display: block; }
.home-columns > .home-section { min-width: 0; }
.home-heading { display: block; }
.home-tablet-headline,
.home-tablet-subtitle,
.home-stats,
.home-tablet-course,
.home-ring__label { display: none; }

/* ---------------------------------------------------------------------------
 * MB-007 tablet Home. Phone rules above are unchanged; these selectors only
 * apply when the scoped viewport state is rail/sidebar (>=768px). Geometry is
 * the confirmed 251:215 portrait and 251:2 / 251:362 landscape reference.
 * ------------------------------------------------------------------------- */
:root .home-page--rail,
:root .home-page--sidebar {
  box-sizing: border-box;
  position: relative;
  display: grid;
  width: 100%;
  max-width: 1194px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0;
  overflow-x: hidden;
  color: var(--home-tablet-ink);
  background-color: var(--home-tablet-page-bg);
  background-image: var(--home-tablet-page-image);
  font-family: var(--v2-font);
}
:root .home-page--rail {
  grid-template-columns: 86px minmax(0, 686px);
  column-gap: 30px;
  padding-right: 32px;
}
:root .home-page--sidebar {
  grid-template-columns: 244px minmax(0, 884px);
  column-gap: 32px;
  padding-right: 34px;
}
.home-page--rail::before,
.home-page--sidebar::before {
  content: '';
  position: absolute;
  z-index: 0;
  top: -135px;
  right: 0;
  width: 385px;
  height: 360px;
  border-radius: 180px;
  background: var(--home-tablet-glow);
  filter: blur(36px);
  pointer-events: none;
}

.home-page--rail .home-fx,
.home-page--sidebar .home-fx,
.home-page--rail .home-topbar,
.home-page--sidebar .home-topbar { display: none; }
.home-page--rail .home-title,
.home-page--sidebar .home-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}
.home-page--rail .home-heading,
.home-page--sidebar .home-heading { display: block; grid-column: 1 / -1; }
.home-page--rail .home-tablet-headline,
.home-page--sidebar .home-tablet-headline {
  display: block;
  color: var(--home-tablet-ink);
  font-size: 27px;
  font-weight: 900;
  line-height: 39px;
  letter-spacing: -.2px;
  overflow-wrap: anywhere;
}
.home-page--rail .home-tablet-subtitle,
.home-page--sidebar .home-tablet-subtitle {
  display: block;
  margin-top: 5px;
  color: var(--home-tablet-muted);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.home-page--sidebar .home-tablet-headline { font-size: 29px; line-height: 42px; }
.home-page--sidebar .home-tablet-subtitle { margin-top: 6px; }

.home-page--rail .home-body,
.home-page--sidebar .home-body {
  position: relative;
  z-index: 1;
  display: grid;
  align-items: start;
  min-width: 0;
}
.home-page--rail .home-body { grid-template-columns: minmax(0, 1fr); padding: 36px 0 28px; }
.home-page--sidebar .home-body { grid-template-columns: minmax(0, 572fr) minmax(0, 292fr); column-gap: 20px; padding: 32px 0 38px; }

.home-page--rail .home-hero,
.home-page--sidebar .home-hero {
  grid-column: 1;
  display: block;
  box-sizing: border-box;
  height: 227px;
  margin-top: 32px;
  padding: 25px 30px;
  overflow: hidden;
  border: 0;
  border-radius: 26px;
  background-color: var(--home-tablet-hero-color);
  background-image: var(--home-tablet-hero-image);
  box-shadow: var(--home-tablet-panel-shadow);
  color: var(--home-tablet-hero-ink);
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.home-page--sidebar .home-hero { height: 248px; margin-top: 24px; }
.home-page--rail .home-hero__top,
.home-page--sidebar .home-hero__top { position: static; display: block; }
.home-page--rail .home-hero__fx,
.home-page--sidebar .home-hero__fx { display: var(--home-tablet-hero-fx-display); opacity: .42; }
.home-page--rail .home-hero__copy,
.home-page--sidebar .home-hero__copy { display: block; }
.home-page--rail .home-hero__greet,
.home-page--sidebar .home-hero__greet,
.home-page--rail .home-hero__meta,
.home-page--sidebar .home-hero__meta { display: none; }
.home-page--rail .home-hero__remain,
.home-page--sidebar .home-hero__remain {
  display: block;
  margin: 0;
  color: var(--home-tablet-hero-ink);
  font-size: 28px;
  font-weight: 900;
  line-height: 41px;
  white-space: normal;
}
.home-page--rail .home-progress__text,
.home-page--sidebar .home-progress__text {
  display: block;
  margin-top: 14px;
  color: var(--home-tablet-hero-muted);
  font-size: 15px;
  line-height: 22px;
}
.home-page--sidebar .home-hero__remain { font-size: 27px; line-height: 39px; }
.home-page--sidebar .home-progress__text { margin-top: 10px; }

.home-page--rail .home-ring,
.home-page--sidebar .home-ring {
  position: absolute;
  z-index: 1;
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--home-tablet-ring-border);
  border-radius: 50%;
  background: var(--home-tablet-ring-bg);
  color: var(--home-tablet-ring-ink);
}
.home-page--rail .home-ring { top: 38px; right: 25px; width: 108px; height: 108px; }
.home-page--sidebar .home-ring { top: 53px; right: 39px; width: 112px; height: 112px; }
.home-page--rail .home-ring .figma-asset,
.home-page--sidebar .home-ring .figma-asset,
.home-page--rail .home-ring__value,
.home-page--sidebar .home-ring__value { display: none; }
.home-page--rail .home-ring__pct,
.home-page--sidebar .home-ring__pct {
  position: absolute;
  left: 0;
  top: 22px;
  width: 100%;
  height: 44px;
  color: var(--home-tablet-ring-ink);
  font-size: 30px;
  font-weight: 900;
  line-height: 44px;
  text-align: center;
}
.home-page--sidebar .home-ring__pct { font-size: 34px; line-height: 49px; height: 49px; }
.home-page--rail .home-ring__label,
.home-page--sidebar .home-ring__label {
  display: block;
  position: absolute;
  left: 0;
  right: 0;
  top: 65px;
  color: var(--home-tablet-ring-label);
  font-size: 13px;
  line-height: 19px;
  text-align: center;
}
.home-page--rail .home-primary.home-hero__cta,
.home-page--sidebar .home-primary.home-hero__cta {
  position: absolute;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  height: 50px;
  min-height: 50px;
  padding: 0 18px;
  border: var(--home-tablet-hero-cta-border);
  border-radius: 15px;
  background: var(--home-tablet-hero-cta-bg);
  background-image: none;
  box-shadow: none;
  color: var(--home-tablet-hero-cta-ink);
  font-size: 17px;
  font-weight: 700;
}
.home-page--rail .home-primary.home-hero__cta { left: 29px; top: 157px; width: 270px; }
.home-page--sidebar .home-primary.home-hero__cta { left: 28px; top: 174px; width: 224px; height: 52px; min-height: 52px; border-radius: 16px; color: var(--home-tablet-hero-cta-ink); font-size: 16px; }
.home-page--rail .home-hero__arrow,
.home-page--sidebar .home-hero__arrow { display: none; }
.home-page--rail .home-tablet-cta-arrow,
.home-page--sidebar .home-tablet-cta-arrow { display: inline; font-weight: 700; }
.home-page--phone .home-tablet-cta-arrow { display: none; }
.home-page--rail .home-primary.home-hero__cta:focus-visible,
.home-page--sidebar .home-primary.home-hero__cta:focus-visible { outline: 2px solid var(--home-tablet-hero-focus); outline-offset: 3px; }

.home-page--rail .home-stats,
.home-page--sidebar .home-stats {
  position: relative;
  box-sizing: border-box;
  display: block;
  grid-column: 2;
  overflow: hidden;
  border: 1px solid var(--home-tablet-panel-border);
  border-radius: 23px;
  background: var(--home-tablet-panel);
  box-shadow: var(--home-tablet-panel-shadow);
  color: var(--home-tablet-ink);
}
.home-page--rail .home-stats { grid-column: 1; height: 134px; margin-top: 22px; }
.home-page--sidebar .home-stats { height: 248px; margin-top: 24px; border-radius: 26px; }
.home-page--rail .home-stats__title,
.home-page--sidebar .home-stats__title {
  position: absolute;
  left: 22px;
  top: 20px;
  color: var(--home-tablet-ink);
  font-size: 17px;
  font-weight: 700;
  line-height: 25px;
  overflow-wrap: anywhere;
}
.home-page--rail .home-stats__value,
.home-page--sidebar .home-stats__value {
  position: absolute;
  left: 22px;
  top: 54px;
  color: var(--home-tablet-brand);
  font-size: 24px;
  font-weight: 900;
  line-height: 35px;
  overflow-wrap: anywhere;
}
.home-page--rail .home-stats__caption { display: none; }
.home-page--rail .home-stats__track,
.home-page--sidebar .home-stats__track {
  position: absolute;
  left: 339px;
  top: 60px;
  right: 32px;
  height: 12px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--home-tablet-track);
}
.home-page--rail .home-stats__fill,
.home-page--sidebar .home-stats__fill { height: 100%; border-radius: inherit; background: var(--home-tablet-fill); }
.home-page--rail .home-stats__foot {
  position: absolute;
  left: 339px;
  top: 85px;
  right: 32px;
}
.home-page--rail .home-stats__note { display: block; color: var(--home-tablet-muted); font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
.home-page--sidebar .home-stats__title { left: 21px; top: 21px; font-size: 19px; line-height: 28px; }
.home-page--sidebar .home-stats__value { left: 21px; top: 62px; font-size: 27px; line-height: 39px; }
.home-page--sidebar .home-stats__caption {
  display: block;
  position: absolute;
  left: 21px;
  top: 102px;
  color: var(--home-tablet-muted);
  font-size: 13px;
  line-height: 19px;
}
.home-page--sidebar .home-stats__track { left: 21px; top: 144px; right: 23px; height: 9px; border-radius: 5px; }
.home-page--sidebar .home-stats__foot {
  position: absolute;
  left: 21px;
  right: 21px;
  top: 176px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 15px;
  border-top: 1px solid var(--home-tablet-panel-border);
}
.home-page--sidebar .home-stats__foot-label { color: var(--home-tablet-muted); font-size: 13px; line-height: 19px; }
.home-page--sidebar .home-stats__foot-value { color: var(--home-tablet-brand); font-size: 16px; font-weight: 700; line-height: 23px; }

.home-page--rail .home-columns,
.home-page--sidebar .home-columns { display: contents; }
.home-page--rail .home-tasks,
.home-page--sidebar .home-tasks {
  box-sizing: border-box;
  grid-column: 1;
  margin-top: 20px;
  padding: 22px 23px 20px;
  overflow: hidden;
  border: 1px solid var(--home-tablet-panel-border);
  border-radius: 23px;
  background: var(--home-tablet-panel);
  box-shadow: var(--home-tablet-panel-shadow);
}
.home-page--rail .home-tasks { height: 343px; }
.home-page--sidebar .home-tasks { height: 398px; margin-top: 26px; padding: 21px 22px 20px; border-radius: 26px; }
.home-page--rail .home-tasks .home-section__head,
.home-page--sidebar .home-tasks .home-section__head {
  align-items: center;
  margin: 0 0 18px;
}
.home-page--rail .home-tasks .home-section__title,
.home-page--sidebar .home-tasks .home-section__title {
  color: var(--home-tablet-ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 32px;
}
.home-page--rail .home-tasks .home-section__count { display: none; }
.home-page--sidebar .home-tasks .home-section__count {
  box-sizing: border-box;
  min-height: 34px;
  padding: 7px 16px;
  border-radius: 17px;
  background: var(--home-tablet-soft);
  color: var(--home-tablet-brand);
  font-size: 13px;
  line-height: 19px;
}
.home-page--rail .home-task,
.home-page--sidebar .home-task {
  box-sizing: border-box;
  width: 100%;
  min-height: 76px;
  margin: 0 0 9px;
  padding: 10px 12px;
  border: 0;
  border-radius: 14px;
  background: var(--home-tablet-panel);
  color: var(--home-tablet-ink);
  gap: 14px;
  text-align: left;
}
.home-page--rail .home-task__tile,
.home-page--sidebar .home-task__tile {
  width: 47px;
  height: 47px;
  border: 0;
  border-radius: 14px;
  background: var(--home-tablet-soft);
}
.home-page--rail .home-task--alt,
.home-page--sidebar .home-task--alt { background: var(--home-tablet-soft); }
.home-page--rail .home-task--completed .home-task__tile,
.home-page--sidebar .home-task--completed .home-task__tile { background: var(--home-tablet-task-completed); }
.home-page--rail .home-task--in_progress .home-task__tile,
.home-page--sidebar .home-task--in_progress .home-task__tile { background: var(--home-tablet-task-progress); }
.home-page--rail .home-task--available .home-task__tile,
.home-page--sidebar .home-task--available .home-task__tile { background: var(--home-tablet-task-available); }
.home-page--rail .home-task__title,
.home-page--sidebar .home-task__title { color: var(--home-tablet-ink); font-size: 16px; line-height: 23px; }
.home-page--rail .home-task__meta,
.home-page--sidebar .home-task__meta { margin-top: 3px; color: var(--home-tablet-muted); font-size: 13px; line-height: 19px; }
.home-page--rail .home-task__desc,
.home-page--sidebar .home-task__desc { display: none; }
.home-page--rail .home-task__action,
.home-page--sidebar .home-task__action { display: none; }
.home-page--rail .home-task__trail,
.home-page--sidebar .home-task__trail { margin-left: auto; min-height: 24px; }
.home-page--rail .home-task__state,
.home-page--sidebar .home-task__state { margin-left: auto; max-width: 30%; }
.home-page--rail .home-task__state > text,
.home-page--sidebar .home-task__state > text { display: none; }
.home-page--sidebar .home-task { min-height: 67px; margin-bottom: 7px; padding: 10px 12px; border-radius: 15px; }
.home-page--sidebar .home-task__tile { width: 45px; height: 45px; }
.home-page--sidebar .home-task__title { font-size: 15px; line-height: 22px; }
.home-page--sidebar .home-task__meta { margin-top: 2px; font-size: 12px; line-height: 17px; }

.home-page--rail #course-shelf.home-card,
.home-page--sidebar #course-shelf.home-card {
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  border: 1px solid var(--home-tablet-panel-border);
  border-radius: 23px;
  background: var(--home-tablet-panel);
  box-shadow: var(--home-tablet-panel-shadow);
}
.home-page--rail #course-shelf.home-card { grid-column: 1; height: 266px; margin-top: 22px; padding: 0; }
.home-page--sidebar #course-shelf.home-card { grid-column: 2; height: 398px; margin-top: 26px; padding: 0; border-radius: 26px; }
.home-page--rail #course-shelf .home-section__title,
.home-page--sidebar #course-shelf .home-section__title {
  position: absolute;
  z-index: 1;
  left: 24px;
  top: 20px;
  color: var(--home-tablet-ink);
  font-size: 21px;
  font-weight: 700;
  line-height: 30px;
}
.home-page--sidebar #course-shelf .home-section__title { left: 20px; top: 21px; font-size: 20px; line-height: 29px; }
.home-page--rail .home-search,
.home-page--sidebar .home-search,
.home-page--rail .home-search__count,
.home-page--sidebar .home-search__count,
.home-page--rail .home-note,
.home-page--sidebar .home-note,
.home-page--rail .home-course-list,
.home-page--sidebar .home-course-list { display: none; }
.home-page--rail #course-shelf > .home-line,
.home-page--sidebar #course-shelf > .home-line { position: relative; margin: 70px 24px 0; color: var(--home-tablet-muted); }
.home-page--rail .home-tablet-course,
.home-page--sidebar .home-tablet-course { display: block; position: absolute; inset: 0; }
.home-page--rail .home-tablet-course__art,
.home-page--sidebar .home-tablet-course__art {
  position: absolute;
  box-sizing: border-box;
  overflow: hidden;
  border: var(--home-tablet-course-art-border);
  border-radius: 18px;
  background: var(--home-tablet-course-art);
  color: var(--home-tablet-course-art-ink);
}
.home-page--rail .home-tablet-course__art { left: 23px; top: 67px; width: min(228px, calc(100% - 40px)); height: 172px; }
.home-page--sidebar .home-tablet-course__art { left: 20px; top: 67px; width: min(250px, calc(100% - 40px)); height: 138px; border-radius: 19px; }
.home-page--rail .home-tablet-course__kicker,
.home-page--sidebar .home-tablet-course__kicker { position: absolute; left: 18px; top: 25px; color: var(--home-tablet-course-art-kicker); font-size: 12px; font-weight: 700; line-height: 17px; }
.home-page--rail .home-tablet-course__art-title,
.home-page--sidebar .home-tablet-course__art-title { position: absolute; left: 18px; top: 73px; width: 190px; color: var(--home-tablet-course-art-ink); font-size: 23px; font-weight: 900; line-height: 33px; overflow-wrap: anywhere; }
.home-page--rail .home-tablet-course__art-desc,
.home-page--sidebar .home-tablet-course__art-desc { position: absolute; left: 18px; top: 122px; width: 200px; color: var(--home-tablet-course-art-muted); font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
.home-page--rail .home-tablet-course__spark { position: absolute; left: 158px; top: 4px; display: var(--home-tablet-course-spark-display); }
.home-page--rail .home-tablet-course__badge { position: absolute; left: 144px; top: 87px; }
.home-page--sidebar .home-tablet-course__kicker { left: 15px; top: 19px; color: var(--home-tablet-course-art-kicker); font-size: 13px; line-height: 19px; }
.home-page--sidebar .home-tablet-course__art-title { left: 15px; top: 55px; width: 200px; font-size: 25px; line-height: 36px; }
.home-page--sidebar .home-tablet-course__art-desc { left: 15px; top: 97px; width: 200px; font-size: 13px; line-height: 19px; }
.home-page--sidebar .home-tablet-course__spark { position: absolute; left: 177px; top: 2px; display: var(--home-tablet-course-spark-display); }
.home-page--sidebar .home-tablet-course__badge { position: absolute; left: 159px; top: 45px; }
.home-page--rail .home-tablet-course__copy,
.home-page--sidebar .home-tablet-course__copy { position: absolute; inset: 0; }
.home-page--rail .home-tablet-course__title,
.home-page--sidebar .home-tablet-course__title {
  position: absolute;
  left: 277px;
  top: 81px;
  width: min(365px, calc(100% - 300px));
  color: var(--home-tablet-ink);
  font-size: 22px;
  font-weight: 700;
  line-height: 32px;
  overflow-wrap: anywhere;
}
.home-page--rail .home-tablet-course__desc,
.home-page--sidebar .home-tablet-course__desc {
  position: absolute;
  left: 278px;
  top: 121px;
  width: min(369px, calc(100% - 300px));
  color: var(--home-tablet-muted);
  font-size: 14px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.home-page--rail .home-tablet-course__cta,
.home-page--sidebar .home-tablet-course__cta {
  position: absolute;
  left: 278px;
  top: 196px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  width: min(362px, calc(100% - 300px));
  height: 47px;
  min-height: 47px;
  padding: 0 14px;
  border: 0;
  border-radius: 14px;
  background: var(--home-tablet-course-cta-bg);
  color: var(--home-tablet-course-cta-color);
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}
.home-page--rail .home-tablet-course__arrow,
.home-page--sidebar .home-tablet-course__arrow { font-weight: 700; }
.home-page--rail .home-tablet-course__cta:focus-visible,
.home-page--sidebar .home-tablet-course__cta:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-page--sidebar .home-tablet-course__title { left: 22px; top: 224px; width: min(244px, calc(100% - 48px)); font-size: 17px; line-height: 25px; }
.home-page--sidebar .home-tablet-course__desc { left: 22px; top: 255px; width: min(245px, calc(100% - 47px)); font-size: 13px; line-height: 19px; }
.home-page--sidebar .home-tablet-course__cta { left: 20px; top: 325px; width: min(250px, calc(100% - 40px)); height: 50px; min-height: 50px; }

.home-page--rail .home-status,
.home-page--sidebar .home-status,
.home-page--rail .home-guide,
.home-page--sidebar .home-guide,
.home-page--rail .home-block,
.home-page--sidebar .home-block,
.home-page--rail .home-line,
.home-page--sidebar .home-line { grid-column: 1 / -1; }
.home-page--rail .home-block,
.home-page--sidebar .home-block {
  margin-top: 24px;
  padding: 20px 22px;
  border: 1px solid var(--home-tablet-panel-border);
  border-radius: 23px;
  background: var(--home-tablet-panel);
  box-shadow: var(--home-tablet-panel-shadow);
  color: var(--home-tablet-ink);
}
.home-page--rail .home-block__title,
.home-page--sidebar .home-block__title { color: var(--home-tablet-ink); }
.home-page--rail .home-block__desc,
.home-page--sidebar .home-block__desc { color: var(--home-tablet-muted); }
.home-page--rail .home-guide,
.home-page--sidebar .home-guide {
  margin-top: 24px;
  padding: 16px 20px;
  border: 1px solid var(--home-tablet-panel-border);
  border-radius: 20px;
  background: var(--home-tablet-panel);
  box-shadow: var(--home-tablet-panel-shadow);
}
.home-page--rail .home-guide__label,
.home-page--sidebar .home-guide__label { color: var(--home-tablet-ink); }
.home-page--rail .home-guide__steps,
.home-page--sidebar .home-guide__steps { color: var(--home-tablet-muted); }
.home-page--rail .home-line,
.home-page--sidebar .home-line { color: var(--home-tablet-muted); }
.home-page--rail .home-line--error,
.home-page--sidebar .home-line--error { color: var(--yx-danger); }
.home-page--rail .home-empty__title,
.home-page--sidebar .home-empty__title { color: var(--home-tablet-ink); }
.home-page--rail .home-empty__desc,
.home-page--sidebar .home-empty__desc { color: var(--home-tablet-muted); }
.home-page--rail .home-navrow,
.home-page--sidebar .home-navrow,
.home-page--rail .home-secondary-row,
.home-page--sidebar .home-secondary-row { display: none; }
.home-page--rail .home-ghost,
.home-page--sidebar .home-ghost {
  border-color: var(--home-tablet-panel-border);
  background: var(--home-tablet-soft);
  color: var(--home-tablet-brand);
}
.home-page--rail .home-task:focus-visible,
.home-page--sidebar .home-task:focus-visible,
.home-page--rail .home-tablet-course__cta:focus-visible,
.home-page--sidebar .home-tablet-course__cta:focus-visible { outline: 2px solid var(--yx-focus); outline-offset: 2px; }
.home-page--rail[data-motion="reduced"] .home-glass,
.home-page--sidebar[data-motion="reduced"] .home-glass,
.home-page--rail[data-motion="off"] .home-glass,
.home-page--sidebar[data-motion="off"] .home-glass { backdrop-filter: none; -webkit-backdrop-filter: none; }
@media (max-width: 359px) {
  :root .home-page { padding-left: 16px; padding-right: 16px; }
  .home-task { flex-wrap: wrap; }
  .home-hero__top { align-items: flex-start; }
}
</style>
