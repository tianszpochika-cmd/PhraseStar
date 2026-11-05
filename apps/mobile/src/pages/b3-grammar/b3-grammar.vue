<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import type { PerformanceLevel } from '@englishflow/performance'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import B10ExerciseCard from '../../components/b10/B10ExerciseCard.vue'
import type { B10AnswerInput, B10AssessmentSession, B10GrammarPoint, B10RuleFeedback, B10SyntaxGraph } from '../../domain/b10'
import { b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../../api/b10'
import { grammarClosedDraftKey, grammarExerciseProgress, grammarGraphState, grammarPointExamples, isLocalGrammarSession } from '../../domain/grammar-page'
import { grammarAssets, grammarExamplePage, grammarGlowAsset, grammarInitialView, grammarPointIcon, grammarPrerequisiteTitles, grammarRouteMatches, grammarShowsPractice, grammarViewBack, type GrammarViewName } from '../../domain/grammar-view'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { b10ContentLocale, b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { mobileExperienceEngine, mobileT, useMobileExperience } from '../../platform/experience'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const PAGE_PATH = '/pages/b3-grammar/b3-grammar'
const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const performanceLevel = ref<PerformanceLevel>(mobileExperienceEngine.level)
const unsubscribePerformance = mobileExperienceEngine.subscribe((state) => { performanceLevel.value = state.level })
const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
const message = ref<string | null>(null)
const points = ref<B10GrammarPoint[]>([])
const activePoint = ref<B10GrammarPoint | null>(null)
const graph = ref<B10SyntaxGraph | null>(null)
const graphFailed = ref(false)
const graphNotice = ref<string | null>(null)
const grammarSession = ref<B10AssessmentSession | null>(null)
const feedback = ref<B10RuleFeedback | null>(null)
const selectedOption = ref<string | null>(null)
const exerciseIndex = ref(0)
const exampleIndex = ref(0)
const submitting = ref(false)
const completed = ref(false)
const visible = ref(false)
const screen = ref<GrammarViewName>(grammarInitialView())
const catalogOnly = ref(false)
let grammarSelectionRequest = 0
let deeplinkPointId: number | null = null
let backCaptureBound = false
const sessionCache = new Map<number, B10AssessmentSession>()
let draft: MobileGrammarDraft = emptyGrammarDraft()
interface MobileGrammarDraft { selectedPointId: number | null; contentVersions: Record<string, number | null> }
const GRAMMAR_DRAFT_KEY = 'yx.b10.mobile.grammar-draft.v1'
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const context = computed(() => ({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }))
const exercises = computed(() => grammarSession.value?.exercises ?? [])
const exercise = computed(() => exercises.value[exerciseIndex.value] ?? null)
const total = computed(() => exercises.value.length)
const localSession = computed(() => isLocalGrammarSession(grammarSession.value))
const linearMode = computed(() => performanceLevel.value === 'Performance' || graph.value?.graphStatus === 'DEGRADED')
const graphState = computed(() => grammarGraphState(graph.value, activePoint.value?.sentenceId ?? null, graphFailed.value))
const answerBusy = computed(() => submitting.value || feedback.value !== null)
const progressText = computed(() => grammarExerciseProgress(exerciseIndex.value, total.value))
const closedDraftKey = computed(() => grammarClosedDraftKey(draft))
const pointExamples = computed(() => grammarPointExamples(activePoint.value))
const examplePage = computed(() => grammarExamplePage(pointExamples.value, exampleIndex.value))
const prerequisiteTitles = computed(() => grammarPrerequisiteTitles(activePoint.value?.prerequisites ?? [], points.value))
const practiceVisible = computed(() => grammarShowsPractice(screen.value))
const glowSrc = computed(() => grammarGlowAsset(screen.value, status.value === 'empty'))
const answerEventIds = ref<Record<string, string>>({})
const helpNotes = computed(() => [
  { title: grammarT('tipLowTitle'), body: grammarT('tipLowBody'), dot: grammarAssets.dotLow },
  { title: grammarT('tipContainsTitle'), body: grammarT('tipContainsBody'), dot: grammarAssets.dotContains },
  { title: grammarT('tipUpdatesTitle'), body: grammarT('tipUpdatesBody'), dot: grammarAssets.dotUpdates },
])
let grammarHeadingScreen: GrammarViewName | null = null
function bindGrammarFocus(): void {
  if (typeof document === 'undefined') return
  for (const el of document.querySelectorAll('.v2-grammar-page .grammar-button, .v2-grammar-page .grammar-option, .v2-grammar-page .grammar-point')) {
    if (el instanceof HTMLElement && el.tabIndex < 0) el.tabIndex = 0
  }
  const heading = document.querySelector('.v2-grammar-page .grammar-heading')
  if (!(heading instanceof HTMLElement) || grammarHeadingScreen === screen.value) return
  grammarHeadingScreen = screen.value
  heading.focus({ preventScroll: true })
}
function grammarT(key: string, values?: Record<string, unknown>): string { const text = mobileT(`grammarPage.${key}`); return values ? interpolate(text, values) : text }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function emptyGrammarDraft(): MobileGrammarDraft { return { selectedPointId: null, contentVersions: {} } }
type AccountScope = { subject: string; revision: number }
function accountScope(): AccountScope | null { return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision } : null }
function routeAllowsPaint(): boolean {
  if (typeof getCurrentPages !== 'function') return true
  const pages = getCurrentPages()
  if (!pages.length) return true
  const route = pages[pages.length - 1]?.route
  return grammarRouteMatches(typeof route === 'string' ? route : '', PAGE_PATH)
}
function isCurrent(scope: AccountScope | null): scope is AccountScope {
  return Boolean(scope && visible.value && routeAllowsPaint() && session.isAuthenticated && session.verifiedSubject === scope.subject && session.identityRevision === scope.revision)
}
function clearTransient(): void {
  grammarSession.value = null; activePoint.value = null; graph.value = null; graphFailed.value = false; graphNotice.value = null
  feedback.value = null; selectedOption.value = null; exerciseIndex.value = 0; exampleIndex.value = 0; submitting.value = false; completed.value = false
  screen.value = grammarInitialView(); catalogOnly.value = false
}
function clearPage(): void { grammarSelectionRequest += 1; points.value = []; sessionCache.clear(); clearTransient(); draft = emptyGrammarDraft(); status.value = 'idle'; message.value = null }
function readDraft(): MobileGrammarDraft {
  const next = emptyGrammarDraft(); const scope = accountScope(); if (!isCurrent(scope)) return next
  try {
    const raw = getUniRuntime().getStorageSync(GRAMMAR_DRAFT_KEY)
    if (typeof raw !== 'string') return next
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.subject !== scope.subject) { getUniRuntime().removeStorageSync(GRAMMAR_DRAFT_KEY); return next }
    next.selectedPointId = typeof parsed.selectedPointId === 'number' && Number.isInteger(parsed.selectedPointId) ? parsed.selectedPointId : null
    if (isRecord(parsed.contentVersions)) for (const [key, value] of Object.entries(parsed.contentVersions)) if (value === null || (typeof value === 'number' && Number.isSafeInteger(value))) next.contentVersions[key] = value as number | null
  } catch { try { getUniRuntime().removeStorageSync(GRAMMAR_DRAFT_KEY) } catch { /* ignore */ } }
  return next
}
function persistDraft(): void { const scope = accountScope(); if (!isCurrent(scope)) return; try { getUniRuntime().setStorageSync(GRAMMAR_DRAFT_KEY, JSON.stringify({ subject: scope.subject, ...draft })) } catch { /* best effort */ } }
function failure(error: unknown, fallback: string): void { const info = b10ErrorInfo(error, fallback); status.value = info.kind; message.value = info.message }
function eventIdFor(key: string): string { if (!answerEventIds.value[key]) answerEventIds.value[key] = createB10ClientEventId(key); return answerEventIds.value[key] }
function pointStill(scope: AccountScope, pointId: number): boolean {
  return isCurrent(scope) && activePoint.value?.grammarPointId === pointId
}
function openDetail(point: B10GrammarPoint): void {
  const scope = accountScope(); if (!isCurrent(scope)) return
  grammarSelectionRequest += 1
  activePoint.value = point
  draft.selectedPointId = point.grammarPointId
  persistDraft()
  graph.value = null; graphFailed.value = false; graphNotice.value = null
  feedback.value = null; selectedOption.value = null; exerciseIndex.value = 0; exampleIndex.value = 0; completed.value = false
  grammarSession.value = sessionCache.get(point.grammarPointId) ?? null
  screen.value = 'detail'; status.value = 'ready'; message.value = null
}
async function load(): Promise<void> {
  const scope = accountScope(); if (!isCurrent(scope)) return
  const requestId = ++grammarSelectionRequest
  status.value = 'loading'; message.value = null; points.value = []; sessionCache.clear(); clearTransient()
  try {
    if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
    const nextPoints = await b10LearningApi.listGrammarPoints(context.value)
    if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
    points.value = nextPoints
    if (!points.value.length) {
      if (!isCurrent(scope)) return
      const loose = await b10LearningApi.createGrammarSession(context.value, 0, null, createB10ClientEventId('grammar-unbound'))
      if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return
      grammarSession.value = loose
      catalogOnly.value = loose.exercises.length > 0
      screen.value = loose.exercises.length ? 'practice' : 'list'
      status.value = loose.exercises.length ? 'ready' : 'empty'
      return
    }
    screen.value = 'list'
    status.value = 'ready'
    const linked = deeplinkPointId == null ? null : points.value.find((point) => point.grammarPointId === deeplinkPointId) ?? null
    deeplinkPointId = null
    if (linked && isCurrent(scope)) openDetail(linked)
  } catch (error) { if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return; failure(error, grammarT('error')) }
}
async function openStructure(): Promise<void> {
  const scope = accountScope(); if (!isCurrent(scope) || !activePoint.value) return
  const point = activePoint.value
  const requestId = ++grammarSelectionRequest
  graph.value = null; graphFailed.value = false; graphNotice.value = null
  if (point.sentenceId) {
    try {
      if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return
      const nextGraph = await b10LearningApi.getSentenceGraph(context.value, point.sentenceId)
      if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return
      graph.value = nextGraph
      if (nextGraph.graphStatus === 'DEGRADED') graphNotice.value = grammarT('structureUnavailable')
    } catch { if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return; graphFailed.value = true; graphNotice.value = grammarT('structureUnavailable') }
  }
  if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return
  screen.value = 'structure'
  status.value = 'ready'
}
async function startPractice(): Promise<void> {
  const scope = accountScope(); if (!isCurrent(scope) || !activePoint.value || screen.value === 'list') return
  const point = activePoint.value
  const cached = sessionCache.get(point.grammarPointId)
  if (cached) { grammarSession.value = cached; screen.value = 'practice'; status.value = cached.exercises.length ? 'ready' : 'empty'; return }
  const requestId = ++grammarSelectionRequest
  status.value = 'loading'; message.value = null
  try {
    if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return
    const nextSession = await b10LearningApi.createGrammarSession(context.value, point.grammarPointId, point.contentVersionId, createB10ClientEventId(`grammar-session-${point.grammarPointId}`))
    if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return
    sessionCache.set(point.grammarPointId, nextSession)
    grammarSession.value = nextSession
    screen.value = 'practice'
    status.value = nextSession.exercises.length ? 'ready' : 'empty'
  } catch (error) { if (requestId !== grammarSelectionRequest || !pointStill(scope, point.grammarPointId)) return; failure(error, grammarT('error')) }
}
async function submitChoice(): Promise<void> {
  const scope = accountScope(); if (!isCurrent(scope) || !practiceVisible.value || !grammarSession.value || !exercise.value || submitting.value || feedback.value) return
  if (!selectedOption.value) { message.value = grammarT('answerRequired'); return }
  const requestId = grammarSelectionRequest; const current = exercise.value; const key = `exercise-${current.exerciseId}`
  submitting.value = true; message.value = null
  try {
    if (!isCurrent(scope)) return
    const result = await b10LearningApi.submitGrammarAnswer(context.value, grammarSession.value.sessionId, current.exerciseId, { selectedOptionKeys: [selectedOption.value] }, activePoint.value?.contentVersionId ?? null, eventIdFor(key))
    if (requestId !== grammarSelectionRequest || !isCurrent(scope) || !result.savedReceipt) return
    feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready'
  } catch (error) { if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return; failure(error, grammarT('error')) }
  finally { if (requestId === grammarSelectionRequest) submitting.value = false }
}
async function submitExerciseAnswer(answer: B10AnswerInput): Promise<void> {
  const scope = accountScope(); if (!isCurrent(scope) || !practiceVisible.value || !grammarSession.value || !exercise.value || submitting.value || feedback.value) return
  const requestId = grammarSelectionRequest; const current = exercise.value; const key = `exercise-${current.exerciseId}`
  submitting.value = true; message.value = null
  try {
    if (!isCurrent(scope)) return
    const result = await b10LearningApi.submitGrammarAnswer(context.value, grammarSession.value.sessionId, current.exerciseId, answer, activePoint.value?.contentVersionId ?? null, eventIdFor(key))
    if (requestId !== grammarSelectionRequest || !isCurrent(scope) || !result.savedReceipt) return
    feedback.value = result; status.value = result.contentVersionStale ? 'stale' : 'ready'
  } catch (error) { if (requestId !== grammarSelectionRequest || !isCurrent(scope)) return; failure(error, grammarT('error')) }
  finally { if (requestId === grammarSelectionRequest) submitting.value = false }
}
function nextExercise(): void { if (exerciseIndex.value + 1 < total.value) { exerciseIndex.value += 1; selectedOption.value = null; feedback.value = null; message.value = null } else completed.value = true }
function shiftExample(step: number): void { if (!examplePage.value || examplePage.value.total < 2) return; exampleIndex.value = examplePage.value.index + step }
function retreat(): void {
  const next = grammarViewBack(screen.value, catalogOnly.value)
  if (next === 'navigate') return
  grammarSelectionRequest += 1
  submitting.value = false
  screen.value = next
  message.value = null
}
function interceptHeaderBack(event: Event): void {
  if (grammarViewBack(screen.value, catalogOnly.value) === 'navigate') return
  const target = event.target
  if (!(target instanceof Element) || !target.closest('.mobile-back')) return
  event.preventDefault()
  event.stopPropagation()
  retreat()
}
function bindBackCapture(): void {
  if (typeof document === 'undefined' || backCaptureBound) return
  document.addEventListener('click', interceptHeaderBack, true)
  backCaptureBound = true
}
function unbindBackCapture(): void {
  if (typeof document === 'undefined' || !backCaptureBound) return
  document.removeEventListener('click', interceptHeaderBack, true)
  backCaptureBound = false
}
function retry(): void { if (status.value === 'forbidden') { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return } void load() }
watch(() => session.identityRevision, () => { clearPage(); if (visible.value && session.isAuthenticated) void load() }, { flush: 'sync' })
watch([status, screen, () => exercise.value?.exerciseId ?? 0, () => points.value.length], () => { void nextTick(bindGrammarFocus) })
onLoad((query) => {
  const source = query as { grammarPointId?: unknown } | undefined
  const raw = typeof source?.grammarPointId === 'string' ? source.grammarPointId : ''
  deeplinkPointId = /^[1-9]\d*$/u.test(raw) ? Number(raw) : null
})
onShow(async () => {
  visible.value = true
  bindBackCapture()
  status.value = 'loading'; message.value = null
  if (!await ensureMobilePageAccess(PAGE_PATH)) { status.value = 'forbidden'; return }
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); status.value = 'forbidden'; return }
  if (!routeAllowsPaint()) { status.value = 'idle'; return }
  draft = readDraft()
  await load()
})
onHide(() => { visible.value = false; unbindBackCapture(); grammarSelectionRequest += 1; sessionCache.clear(); clearTransient(); status.value = 'idle'; message.value = null })
onUnmounted(() => { grammarSelectionRequest += 1; unbindBackCapture(); unsubscribePerformance() })
</script>

<template>
  <view class="yx-page v2-grammar-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion" :data-grammar-state="status" :data-grammar-view="screen" :data-grammar-catalog="catalogOnly ? 'true' : 'false'">
    <image class="grammar-glow" :src="glowSrc" mode="scaleToFill" aria-hidden="true" />
    <MobilePageHeader page="b3-grammar" compact :title="grammarT('navTitle')" :back-icon-src="grammarAssets.chevronBack" :show-settings="false" />
    <view class="grammar-scroll">
      <view v-if="status === 'loading'" class="grammar-skeleton" role="status"><text>{{ grammarT('loading') }}</text><view class="grammar-skeleton-block"/><view class="grammar-skeleton-block"/></view>
      <view v-else-if="status === 'forbidden'" class="grammar-state grammar-glass" role="alert"><text class="grammar-state-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ grammarT('permission') }}</text><button class="grammar-button" type="button" tabindex="0" role="button" @click="retry">{{ grammarT('back') }}</button></view>
      <view v-else-if="status === 'offline' || status === 'error' || status === 'stale'" class="grammar-state grammar-glass" role="alert"><text class="grammar-state-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ status === 'offline' ? grammarT('offline') : status === 'stale' ? grammarT('stale') : message ?? grammarT('error') }}</text><button class="grammar-button" type="button" tabindex="0" role="button" @click="retry">{{ grammarT('retry') }}</button></view>

      <template v-else>
        <template v-if="screen === 'list' && points.length">
          <view class="grammar-hero"><text class="grammar-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ grammarT('heroTitle') }}</text><text class="grammar-subtitle">{{ grammarT('heroSubtitle') }}</text></view>
          <view class="grammar-glass grammar-list-card">
            <view class="grammar-card-head"><text class="grammar-card-title">{{ grammarT('pointsTitle') }}</text><text class="grammar-count">{{ grammarT('pointsCount', { count: points.length }) }}</text></view>
            <view class="grammar-point-list">
              <button v-for="(point, index) in points" :key="point.grammarPointId" type="button" tabindex="0" role="button" class="grammar-point" @click="openDetail(point)">
                <view class="grammar-point-icon" :class="`grammar-point-icon--${index % 3}`"><image :src="grammarPointIcon(index)" mode="aspectFit" aria-hidden="true" /></view>
                <view class="grammar-point-copy"><text class="grammar-point-title">{{ point.title }}</text><text class="grammar-meta">{{ point.cefrLevel }} · {{ point.masteryPercent === null ? grammarT('notStarted') : grammarT('mastery', { percent: point.masteryPercent }) }}</text></view>
                <image class="grammar-chev" :src="grammarAssets.chevronForward" mode="aspectFit" aria-hidden="true" />
              </button>
            </view>
          </view>
          <view class="grammar-notes">
            <view v-for="note in helpNotes" :key="note.title" class="grammar-glass grammar-note">
              <view class="grammar-note-title"><image class="grammar-dot" :src="note.dot" mode="aspectFit" aria-hidden="true" /><text>{{ note.title }}</text></view>
              <text class="grammar-note-body">{{ note.body }}</text>
            </view>
          </view>
        </template>

        <template v-else-if="screen === 'detail' && activePoint">
          <view class="grammar-glass grammar-rule">
            <view class="grammar-detail-kicker"><text v-if="activePoint.cefrLevel" class="grammar-level">{{ activePoint.cefrLevel }}</text><text v-if="prerequisiteTitles.length" class="grammar-meta">{{ grammarT('prerequisite', { value: prerequisiteTitles.join('、') }) }}</text></view>
            <text class="grammar-detail-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ activePoint.title }}</text>
            <text v-if="activePoint.meaningCn" class="grammar-detail-copy">{{ activePoint.meaningCn }}</text>
            <text v-if="activePoint.ruleFormula" class="grammar-formula">{{ activePoint.ruleFormula }}</text>
            <view v-if="activePoint.masteryPercent !== null" class="grammar-mastery"><text class="grammar-meta">{{ grammarT('masteryLabel') }}</text><view class="grammar-mastery-track"><view class="grammar-mastery-fill" :style="{ width: `${Math.max(0, Math.min(100, activePoint.masteryPercent))}%` }"/></view><text class="grammar-mastery-value">{{ grammarT('masteryValue', { percent: activePoint.masteryPercent }) }}</text></view>
          </view>
          <view class="grammar-glass grammar-examples">
            <text class="grammar-card-title">{{ grammarT('exampleTitle') }}</text>
            <text v-if="examplePage" class="grammar-example">{{ examplePage.text }}</text>
            <text v-else class="grammar-meta">{{ grammarT('exampleMissing') }}</text>
            <view v-if="examplePage && examplePage.total > 1" class="grammar-example-pager">
              <button class="grammar-button grammar-pager" type="button" tabindex="0" role="button" @click="shiftExample(-1)">{{ grammarT('examplePrevious') }}</button>
              <text class="grammar-meta">{{ grammarT('examplePage', { current: examplePage.index + 1, total: examplePage.total }) }}</text>
              <button class="grammar-button grammar-pager" type="button" tabindex="0" role="button" @click="shiftExample(1)">{{ grammarT('exampleNext') }}</button>
            </view>
          </view>
          <button class="grammar-glass grammar-structure" type="button" tabindex="0" role="button" @click="openStructure">
            <view class="grammar-point-icon grammar-point-icon--1"><image :src="grammarAssets.grid" mode="aspectFit" aria-hidden="true" /></view>
            <view class="grammar-point-copy"><text class="grammar-point-title">{{ grammarT('structureTitle') }}</text><text class="grammar-meta">{{ grammarT('structureHint') }}</text></view>
            <image class="grammar-chev" :src="grammarAssets.chevronForward" mode="aspectFit" aria-hidden="true" />
          </button>
        </template>

        <template v-else-if="screen === 'structure' && activePoint">
          <view class="grammar-glass grammar-rule">
            <view class="grammar-detail-kicker"><text v-if="activePoint.cefrLevel" class="grammar-level">{{ activePoint.cefrLevel }}</text></view>
            <text class="grammar-detail-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ activePoint.title }}</text>
            <text v-if="activePoint.meaningCn" class="grammar-detail-copy">{{ activePoint.meaningCn }}</text>
            <text v-if="activePoint.ruleFormula" class="grammar-formula">{{ activePoint.ruleFormula }}</text>
          </view>
          <view v-if="graph && graphState === 'READY'" class="grammar-glass grammar-examples">
            <text class="grammar-card-title">{{ grammarT('structureTitle') }} <text class="grammar-meta">{{ linearMode ? '2D / Linear' : performanceLevel }}</text></text>
            <text v-if="graph.text" class="grammar-example">{{ graph.text }}</text>
            <text v-if="graph.translation" class="grammar-meta">{{ graph.translation }}</text>
            <view v-for="node in graph.nodes" :key="node.nodeId" class="grammar-node"><text class="grammar-node-role">{{ node.role }}</text><text class="grammar-node-text">{{ node.text }}</text></view>
          </view>
          <view v-else class="grammar-glass grammar-examples">
            <text class="grammar-card-title">{{ grammarT('graphClosedTitle') }}</text>
            <text v-if="examplePage" class="grammar-example">{{ examplePage.text }}</text>
            <view class="grammar-graph-note" role="status">
              <image class="grammar-hourglass" :src="grammarAssets.hourglass" mode="aspectFit" aria-hidden="true" />
              <text class="grammar-meta">{{ graphNotice ?? grammarT('structureUnavailable') }}</text>
            </view>
            <text class="grammar-meta">{{ grammarT(closedDraftKey) }}</text>
          </view>
        </template>

        <template v-else-if="practiceVisible && exercise">
          <view v-if="localSession" class="grammar-local"><text class="grammar-local-title">{{ grammarT('localPreview') }}</text><text class="grammar-meta">{{ grammarT('localPreviewNote') }}</text></view>
          <view class="grammar-exercise-head"><text class="grammar-exercise-progress">{{ grammarT('exerciseProgress', { current: exerciseIndex + 1, total }) }}</text><text class="grammar-meta">{{ progressText }}</text></view>
          <view class="grammar-progress" aria-hidden="true"><view :style="{ width: `${total ? ((exerciseIndex + 1) / total) * 100 : 0}%` }"/></view>
          <view id="grammar-exercise" class="grammar-glass grammar-exercise">
            <text class="grammar-level">{{ grammarT('questionLabel') }}</text>
            <text class="grammar-question grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ exercise.prompt }}</text>
            <text v-if="exercise.sourceText" class="grammar-source">{{ exercise.sourceText }}</text>
            <view v-if="exercise.options.length" class="grammar-options">
              <button v-for="option in exercise.options" :key="option.key" type="button" tabindex="0" role="button" class="grammar-option" :class="{ selected: selectedOption === option.key }" :aria-pressed="selectedOption === option.key" :aria-disabled="answerBusy" @click="selectedOption = option.key">
                <view class="grammar-option-mark"><image v-if="selectedOption === option.key" :src="grammarAssets.check" mode="aspectFit" aria-hidden="true" /></view>
                <text class="grammar-option-key">{{ option.key }}</text><text class="grammar-option-text">{{ option.text }}</text>
              </button>
            </view>
            <B10ExerciseCard v-else :exercise="exercise" :disabled="answerBusy" @answer="submitExerciseAnswer" />
            <text v-if="message" class="grammar-inline-error" role="alert">{{ message }}</text>
            <view v-if="feedback" class="grammar-feedback" role="status">
              <text class="grammar-feedback-title">{{ grammarT('feedbackConfirmed') }}</text>
              <text v-if="feedback.correct !== null" class="grammar-meta">{{ feedback.correct ? grammarT('feedbackCorrect') : grammarT('feedbackIncorrect') }}</text>
              <text v-if="feedback.score !== null" class="grammar-meta">{{ grammarT('feedbackScore', { score: feedback.score }) }}</text>
              <text v-if="feedback.feedbackText" class="grammar-meta">{{ feedback.feedbackText }}</text>
              <text v-if="feedback.savedReceipt" class="grammar-meta">{{ grammarT('feedbackReceipt') }} · {{ feedback.savedReceipt }}</text>
            </view>
            <text v-if="completed" class="grammar-completed">{{ grammarT('completed') }}</text>
          </view>
        </template>

        <view v-else-if="status === 'empty'" class="grammar-glass grammar-state" role="status">
          <view class="grammar-closed-icon"><image :src="grammarAssets.closedGrid" mode="aspectFit" aria-hidden="true" /></view>
          <text class="grammar-state-title grammar-heading" role="heading" aria-level="2" tabindex="-1">{{ grammarT('emptyTitle') }}</text><text class="grammar-meta">{{ grammarT('emptyBody') }}</text>
          <button class="grammar-button" type="button" tabindex="0" role="button" @click="retry">{{ grammarT('retry') }}</button>
        </view>
      </template>
    </view>
    <view v-if="status === 'ready' && screen === 'detail' && activePoint" class="grammar-footer"><button class="grammar-button grammar-primary" type="button" tabindex="0" role="button" @click="startPractice">{{ grammarT('startPractice') }}</button></view>
    <view v-else-if="status === 'ready' && screen === 'structure' && activePoint" class="grammar-footer"><button class="grammar-button grammar-primary" type="button" tabindex="0" role="button" @click="startPractice">{{ grammarT('startPractice') }}</button></view>
    <view v-else-if="status === 'ready' && practiceVisible && exercise && exercise.options.length" class="grammar-footer">
      <button v-if="feedback" class="grammar-button grammar-primary" type="button" tabindex="0" role="button" @click="nextExercise">{{ completed ? grammarT('done') : grammarT('next') }}</button>
      <button v-else class="grammar-button grammar-primary" type="button" tabindex="0" role="button" :aria-disabled="answerBusy || !selectedOption" @click="submitChoice">{{ submitting ? grammarT('submitting') : grammarT('submit') }}</button>
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-grammar-page.v2-grammar-page{position:relative;display:flex;flex-direction:column;box-sizing:border-box;width:100%;max-width:720px;height:100vh;height:100dvh;max-height:100dvh;min-height:0;margin:0 auto;overflow:hidden;padding:calc(18px + env(safe-area-inset-top)) 24px 0;background-color:var(--yx-r4-page-color);background-image:var(--yx-r4-home-image);background-repeat:no-repeat;background-size:cover;font-family:var(--v2-font)}
.grammar-glow{position:absolute;top:-140px;left:150px;width:360px;height:300px;max-width:none;opacity:.85;pointer-events:none}
.grammar-scroll{position:relative;z-index:1;display:flex;flex:1 1 auto;flex-direction:column;gap:16px;box-sizing:border-box;width:100%;min-width:0;min-height:0;overflow-x:hidden;overflow-y:auto;padding-bottom:16px;-webkit-overflow-scrolling:touch}
.grammar-hero{display:grid;gap:4px;padding-top:8px}.grammar-title{display:block;color:var(--v2-ink);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}.grammar-subtitle{display:block;color:var(--v2-mut);font-size:14px;line-height:22px;overflow-wrap:anywhere}.grammar-heading{outline:none}
.grammar-glass{position:relative;box-sizing:border-box;width:100%;min-width:0;border:1px solid var(--yx-profile-glass-border);border-radius:24px;background:var(--yx-profile-glass);box-shadow:var(--yx-profile-card-shadow);backdrop-filter:blur(var(--yx-profile-blur));-webkit-backdrop-filter:blur(var(--yx-profile-blur))}
.grammar-list-card{display:flex;flex-direction:column;padding:6px 20px}.grammar-card-head{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:8px 0}.grammar-card-title{color:var(--v2-ink);font-size:18px;font-weight:700;line-height:26px;overflow-wrap:anywhere}.grammar-count{color:var(--v2-mut);font-size:13px;line-height:20px;white-space:nowrap}.grammar-meta{display:block;color:var(--v2-mut);font-size:13px;line-height:18px;overflow-wrap:anywhere}
.grammar-point-list{display:grid}.grammar-point,.grammar-structure{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:56px;margin:0;padding:10px 0;color:var(--v2-ink);font:inherit;text-align:left;cursor:pointer}.grammar-point{border:0;border-top:1px solid var(--v2-line);background:transparent}.grammar-point:first-child{border-top:0}.grammar-structure{min-height:64px;padding:10px 20px;border-radius:24px}
.grammar-point-icon{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:var(--yx-surface-page)}.grammar-point-icon--0{background:var(--yx-success-soft)}.grammar-point-icon--1{background:var(--yx-brand-soft)}.grammar-point-icon--2{background:var(--yx-surface-page)}.grammar-point-icon image{display:block;width:22px;height:22px}.grammar-point-copy{display:grid;gap:2px;min-width:0;flex:1 1 auto}.grammar-point-title{color:var(--v2-ink);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}.grammar-chev{display:block;flex:none;width:20px;height:20px}
.grammar-point:focus-visible,.grammar-structure:focus-visible,.grammar-button:focus-visible,.grammar-option:focus-visible{outline:3px solid var(--v2-brand);outline-offset:3px}
.grammar-notes{display:grid;gap:12px;padding:4px 0}.grammar-note{display:grid;gap:6px;padding:14px 16px;border-radius:18px}.grammar-note-title{display:flex;align-items:center;gap:10px;color:var(--v2-ink);font-size:14px;font-weight:700;line-height:20px}.grammar-note-title text{min-width:0;overflow-wrap:anywhere}.grammar-dot{flex:none;width:8px;height:8px}.grammar-note-body{color:var(--v2-mut);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.grammar-rule,.grammar-examples,.grammar-exercise{display:flex;flex-direction:column;gap:10px;padding:18px 20px}.grammar-detail-kicker{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.grammar-level{display:inline-flex;align-self:flex-start;padding:3px 10px;border-radius:999px;background:var(--yx-brand-soft);color:var(--v2-brand);font-size:12px;font-weight:700;line-height:18px}.grammar-detail-title{color:var(--v2-ink);font-size:22px;font-weight:700;line-height:30px;overflow-wrap:anywhere}.grammar-detail-copy{color:var(--v2-mut);font-size:14px;line-height:22px;overflow-wrap:anywhere}.grammar-formula{padding:10px 14px;border-radius:14px;background:var(--yx-brand-soft);color:var(--v2-brand);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.grammar-mastery{display:flex;align-items:center;gap:10px}.grammar-mastery-track{flex:1 1 auto;height:6px;border-radius:999px;overflow:hidden;background:var(--yx-brand-soft)}.grammar-mastery-fill{height:100%;border-radius:inherit;background-color:var(--yx-r4-cta-color);background-image:var(--yx-r4-cta-image)}.grammar-mastery-value{flex:none;color:var(--v2-brand);font-size:12px;font-weight:700;line-height:18px}
.grammar-example{color:var(--v2-ink);font-size:17px;font-weight:600;line-height:26px;overflow-wrap:anywhere}.grammar-example-pager{display:flex;align-items:center;gap:8px}.grammar-pager{width:auto;min-height:44px;flex:1 1 auto}
.grammar-graph-note{display:flex;gap:8px;align-items:flex-start;padding:12px 14px;border-radius:18px;background:var(--yx-surface-card)}.grammar-hourglass{flex:none;width:18px;height:18px;margin-top:2px}.grammar-node{display:grid;gap:2px;padding:10px 0;border-top:1px solid var(--v2-line)}.grammar-node-role{color:var(--v2-brand);font-size:12px;font-weight:700;line-height:18px}.grammar-node-text{color:var(--v2-ink);font-size:14px;line-height:20px;overflow-wrap:anywhere}
.grammar-local{display:grid;gap:2px;padding:12px 14px;border-radius:14px;background:var(--yx-brand-soft)}.grammar-local-title{color:var(--v2-brand);font-size:12px;font-weight:700;line-height:18px}
.grammar-exercise-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.grammar-exercise-progress{color:var(--v2-brand);font-size:13px;font-weight:700;line-height:20px}.grammar-progress{height:8px;border-radius:999px;overflow:hidden;background:var(--yx-brand-soft)}.grammar-progress>view{height:100%;border-radius:inherit;background-color:var(--yx-r4-cta-color);background-image:var(--yx-r4-cta-image)}
.grammar-question{color:var(--v2-ink);font-size:18px;font-weight:700;line-height:27px;overflow-wrap:anywhere}.grammar-source{padding:12px 14px;border-radius:14px;background:var(--yx-brand-soft);color:var(--v2-ink);font-size:15px;line-height:22px;overflow-wrap:anywhere}
.grammar-options{display:grid;gap:10px}.grammar-option{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:14px;border:1px solid var(--v2-line);border-radius:12px;background:var(--yx-surface-card);color:var(--v2-ink);font:inherit;text-align:left;cursor:pointer}.grammar-option.selected{border:2px solid var(--v2-brand);background:var(--yx-brand-soft)}.grammar-option-mark{display:flex;align-items:center;justify-content:center;flex:none;width:26px;height:26px;border-radius:50%;background:var(--yx-brand-soft)}.grammar-option-mark image{width:16px;height:16px}.grammar-option-key{flex:none;color:var(--v2-mut);font-size:12px;font-weight:700}.grammar-option-text{color:var(--v2-ink);font-size:14px;line-height:20px;overflow-wrap:anywhere}
.grammar-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:14px 20px;border:1px solid var(--v2-line);border-radius:14px;background:var(--yx-surface-card);color:var(--v2-ink);font:inherit;font-size:16px;font-weight:700;line-height:1.4;text-align:center;white-space:normal;cursor:pointer}.grammar-button.grammar-primary{border-color:transparent;background-color:var(--yx-r4-cta-color);background-image:var(--yx-r4-cta-image);color:var(--yx-r4-on-cta);box-shadow:var(--yx-r4-shadow-cta)}.grammar-button[aria-disabled="true"]{cursor:default}.v2-grammar-page.b10-theme--high-contrast .grammar-button.grammar-primary{background-color:var(--closed-cta-background);background-image:none;color:var(--closed-cta-on);box-shadow:none}
.grammar-inline-error{color:var(--v2-bad);font-size:13px;line-height:20px}.grammar-feedback{display:grid;gap:4px;padding:14px;border:1px solid var(--v2-line);border-radius:16px;background:var(--yx-brand-soft)}.grammar-feedback-title{color:var(--v2-ink);font-size:14px;font-weight:700;line-height:20px}.grammar-completed{color:var(--v2-brand);font-size:14px;font-weight:700;line-height:20px}
.grammar-state{display:grid;justify-items:center;gap:12px;padding:28px 20px;text-align:center}.grammar-state-title{color:var(--v2-ink);font-size:22px;font-weight:700;line-height:30px;overflow-wrap:anywhere}.grammar-closed-icon{display:flex;align-items:center;justify-content:center;width:88px;height:88px;border-radius:28px;background:var(--yx-brand-soft)}.grammar-closed-icon image{width:40px;height:40px}
.grammar-skeleton{display:grid;gap:10px;padding:16px 0}.grammar-skeleton-block{height:120px;border-radius:20px;background:var(--v2-surface)}
.grammar-footer{position:relative;z-index:2;flex:none;box-sizing:border-box;width:auto;margin-inline:-24px;padding:12px 24px calc(30px + env(safe-area-inset-bottom));background:var(--yx-surface-card);box-shadow:var(--yx-shadow)}
.v2-grammar-page[data-motion="reduced"] .grammar-button,.v2-grammar-page[data-motion="off"] .grammar-button{transition:none}
@media(max-width:360px){.v2-grammar-page.v2-grammar-page{padding-inline:16px}.grammar-footer{margin-inline:-16px;padding-inline:16px}.grammar-detail-title{font-size:22px;line-height:30px}.grammar-list-card,.grammar-rule,.grammar-examples,.grammar-exercise{padding-inline:16px}}
@media(prefers-reduced-motion:reduce){.grammar-button,.grammar-point,.grammar-option,.grammar-structure{transition:none}.grammar-button:active{transform:none}}
</style>
