<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import AppIcon from '../../components/AppIcon.vue'
import FigmaAsset from '../../components/FigmaAsset.vue'
import { homeAssets, homeDarkAssets } from '../../theme/figma-r4-assets'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n } from '../../platform/v2-foundation'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess, currentMobilePagePath } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { homeContentHref, homeGuidePath, homePrivateReadAllowed, homeProgressPercent, homeStillOnPage, homeTaskHref } from '../../domain/home-page'
import { hasPlacementEntryReached, isPlacementSatisfied, onboardingRemainingStepLabels, selectOnboardingResumeStep, showOnboardingGuide } from '../../domain/onboarding-resume'
import { isAccessibleContent, shelfSearchState, type EmptyReason, type ShelfSearchState } from '../../domain/plan-today'
import { shelfNote } from '../../domain/content-release'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const art = computed(() => theme.value === 'dark' ? homeDarkAssets : homeAssets)
const store = useLearnerContentStore()
const session = useSessionStore()

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
  try {
    const result = openUniPage(url)
    if (isThenable(result)) await result
  } catch {
    if (actionCurrent(token) && currentMobilePagePath() === '/pages/home/home') navError.value = tr('navFailed')
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
  if (session.isAuthenticated) maybeEnter()
  else void recoverLogin()
})

function leavePage(): void {
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
onBeforeUnmount(leavePage)

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
  void nextTick(syncSearchAccessibility)
})
</script>

<template>
  <view class="yx-page yx-r4-screen home-page" :style="experienceStyle" :data-motion="experienceMotion" :data-theme="theme">
    <view class="home-fx yx-r4-fx" aria-hidden="true">
      <FigmaAsset class="home-fx__glow" :src="art.glow" :width="540" :height="480" />
      <FigmaAsset class="home-fx__blob-a" :src="art.blobA" :width="460" :height="460" />
      <FigmaAsset class="home-fx__blob-c" :src="art.blobC" :width="300" :height="300" />
      <FigmaAsset class="home-fx__blob-d" :src="art.blobD" :width="340" :height="340" />
    </view>
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

    <text class="home-title" role="heading" aria-level="1">{{ tr('h1') }}</text>

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
                <text v-if="heroRemain" class="home-hero__remain">{{ heroRemain }}</text>
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
                <FigmaAsset :src="art.track" :width="96" :height="96" />
                <view v-if="ringStyle" class="home-ring__value" :style="{ backgroundImage: ringStyle }"></view>
                <text v-if="progressPercent !== null" class="home-ring__pct">{{ progressValue }}%</text>
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
            </button>
            <view v-if="heroMeta" class="home-hero__meta">
              <FigmaAsset :src="art.schedule" :width="17" :height="17" />
              <text>{{ heroMeta }}</text>
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
          <view class="home-section home-card home-glass">
            <view class="home-section__head">
              <text class="home-section__title" role="heading" aria-level="2">{{ tr('tasks') }}</text>
              <text v-if="(store.home?.tasks.length ?? 0) > 0" class="home-section__count">{{ tr('taskCount', { count: store.home?.tasks.length ?? 0 }) }}</text>
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
              <template v-for="task in store.home.tasks" :key="task.id">
                <button
                  v-if="isActionable(task)"
                  tabindex="0"
                  role="button"
                  type="button"
                  class="home-task home-task__secondary"
                  :class="{ 'home-task--first': isFirstTask(task) }"
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
                <view v-else class="home-task">
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
            <text id="course-heading" class="home-section__title" role="heading" aria-level="2" tabindex="-1">{{ tr('courses') }}</text>
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
@media (max-width: 359px) {
  :root .home-page { padding-left: 16px; padding-right: 16px; }
  .home-task { flex-wrap: wrap; }
  .home-hero__top { align-items: flex-start; }
}
@media (min-width: 768px) {
  :root .home-page { max-width: 1024px; padding-left: 28px; padding-right: 28px; }
  .home-columns { display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr); gap: 16px; align-items: start; }
}
@media (min-width: 1024px) {
  :root .home-page { max-width: 1180px; }
}
</style>
