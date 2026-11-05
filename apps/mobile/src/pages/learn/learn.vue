<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import { mobileLearnerContentApi } from '../../api/learner-content'
import { MobileApiError } from '../../api/client'
import type { MobileB18ReviewQueueItem } from '../../api/b18-learning'
import type { MobileContentCard, MobileContentDetail } from '../../domain/learner-content'
import { shelfNote } from '../../domain/content-release'
import { isAccessibleContent } from '../../domain/plan-today'
import { weaknessView } from '../../domain/mistake-book'
import { reviewFailureCopy } from '../../domain/review-stage'
import { reviewEmpty } from '../../domain/review-history'
import { STAGE_PROJECTION } from '../../domain/stage-projection'
import {
  accessibleShelf,
  classifyLearnShelf,
  contentMetaLabel,
  learnerUnits,
  learnSurface,
  matchShelf,
  readStatusKind,
  reviewFacing,
  rightsBlocked,
  stageFacing,
  versionBlocked,
  type LearnShelfKind,
} from './learn-page'
import { currentMobilePagePath, ensureMobilePageAccess } from '../../auth/navigation'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n } from '../../platform/v2-foundation'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { consumePendingNavigationQuery, openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useB18LearningStore } from '../../stores/b18-learning'

const shelfGlow = '/static/figma-learn-shelf-167-1933/imgGlow.svg'
const shelfBook = '/static/figma-learn-shelf-167-1933/imgIconBook.svg'
const shelfChevron = '/static/figma-learn-shelf-167-1933/imgWeightRegular.svg'
const practiceBasicIcon = '/static/figma-learn-shelf-167-1933/imgFeatIconSolarAll.svg'
const practiceReadingIcon = '/static/figma-learn-shelf-167-1933/imgFeatIconSolarBook.svg'
const practiceGrammarIcon = '/static/figma-learn-shelf-167-1933/imgFeatIconSolarGrammar.svg'
const detailGlow = '/static/figma-learn-detail-167-2065/imgGlow.svg'
const detailBook = '/static/figma-learn-detail-167-2065/imgIconBook.svg'
const unitBook = '/static/figma-learn-detail-167-2065/imgIconBook1.svg'

const session = useSessionStore()
const store = useLearnerContentStore()
const learning = useB18LearningStore()
const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const uiLocale = ref(mobileI18n.locale)
const stopLocale = mobileI18n.subscribe((state) => { uiLocale.value = state.locale })
onBeforeUnmount(stopLocale)
const english = computed(() => uiLocale.value.toLowerCase().startsWith('en'))

const contentCode = ref('')
const taskId = ref('')
const content = ref<MobileContentDetail | null>(null)
const contentState = ref<'idle' | 'loading' | 'ready' | 'error' | 'auth' | 'denial' | 'unavailable' | 'rights' | 'version'>('idle')
const contentError = ref<string | null>(null)
const catalog = ref<MobileContentCard[]>([])
const catalogPhase = ref<'idle' | 'loading' | 'ready' | 'error' | 'unavailable' | 'denial'>('idle')
const courseQuery = ref('')
const pageVisible = ref(false)
const gateReady = ref(false)
let pageEpoch = 0
let readSeq = 0
let shelfSeq = 0
let activeSync = 0
let loadedContentCode = ''
let initialIntent: { contentCode: string; taskId: string } | null = null
let initialConsumed = false
let lastOwnerSubject: string | null = session.verifiedSubject

function learnT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`learnPage.${key}`)
  return values ? interpolate(message, values) : message
}
function currentOwner(): string {
  return session.isAuthenticated && session.verifiedSubject ? `${session.verifiedSubject}:${session.identityRevision}` : ''
}
function onLearnRoute(): boolean {
  if (typeof window === 'undefined') return pageVisible.value
  const hash = window.location.hash
  if (!hash) return pageVisible.value
  return currentMobilePagePath() === '/pages/learn/learn'
}
function hashQueryValue(key: string): string {
  if (typeof window === 'undefined') return ''
  const hash = window.location.hash
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return ''
  return new URLSearchParams(hash.slice(queryIndex + 1)).get(key)?.trim() ?? ''
}
function hashContentCode(): string {
  return hashQueryValue('contentCode')
}
function open(path: string): void {
  openUniPage(path === '/pages/b2-practice/b2-practice' ? '/pages/assessment/assessment' : path)
}
function completeReview(item: Parameters<typeof learning.complete>[0]): void {
  if (!item.completable || learning.busyItemId === item.queueItemId) return
  void learning.complete(item)
}
function reviewActionLabel(item: MobileB18ReviewQueueItem): string {
  if (item.completable) return learnT('startReview')
  return item.source === 'NEW' ? learnT('goLearn') : learnT('goPractice')
}
function reviewReason(item: MobileB18ReviewQueueItem): string {
  return item.source === 'NEW' ? learnT('reviewNewReason') : learnT('reviewAnswerReason')
}
function reviewAction(item: MobileB18ReviewQueueItem): void {
  if (item.completable) { completeReview(item); return }
  openUniPage(item.source === 'NEW' ? '/pages/b2-vocabulary/b2-vocabulary' : '/pages/practice/practice')
}
function reviewLabel(item: MobileB18ReviewQueueItem): string {
  return reviewFacing(item.source, item.state, english.value)
}
function stageLabel(state: string): string {
  return stageFacing(state, english.value)
}

const surface = computed(() => learnSurface(contentCode.value))
const publishedContent = computed(() => accessibleShelf(catalog.value))
const visibleContent = computed(() => matchShelf(publishedContent.value, courseQuery.value))
const shelfKind = computed((): LearnShelfKind => classifyLearnShelf({
  denied: catalogPhase.value === 'denial',
  offline: catalogPhase.value === 'error',
  unavailable: catalogPhase.value === 'unavailable',
  accessibleCount: publishedContent.value.length,
  matchCount: visibleContent.value.length,
}))
const featured = computed(() => (shelfKind.value === 'results' ? visibleContent.value[0] ?? null : null))
const releaseNote = computed(() => shelfNote(publishedContent.value))
const showResultCount = computed(() => Boolean(courseQuery.value.trim()) && (shelfKind.value === 'results' || shelfKind.value === 'no-matches'))
const units = computed(() => content.value ? learnerUnits(content.value.items) : [])
const contentMeta = computed(() => content.value ? contentMetaLabel(content.value.contentLocale, content.value.contentType, english.value) : '')
const reviewCountKnown = computed(() => ['ready', 'empty', 'partial', 'success'].includes(learning.state))
const reviewRows = computed(() => reviewCountKnown.value ? learning.queue.slice(0, 4) : [])
const reviewNotice = computed(() => {
  if (reviewCountKnown.value || learning.state === 'idle' || learning.state === 'loading') return null
  return learning.lastError || (learning.state === 'permission' ? learnT('shelfDenial') : learnT('contentError'))
})
const historySummary = computed(() => {
  const done = learning.history.filter((row) => row.disposition !== 'DEFERRED').length
  const deferred = learning.history.length - done
  return deferred ? learnT('historyDeferred', { done, deferred }) : learnT('historyDone', { done })
})
const reviewTitle = computed(() => reviewCountKnown.value ? learnT('reviewCount', { count: learning.queue.length }) : learnT('reviewHeading'))
const pinnedVersion = computed(() => {
  if (!taskId.value) return null
  const task = store.home?.tasks.find((item) => item.id === taskId.value)
  return typeof task?.contentVersionPin === 'number' ? task.contentVersionPin : null
})

function takeIntent(): { contentCode: string; taskId: string } | null {
  const pending = consumePendingNavigationQuery('/pages/learn/learn')
  if (pending.contentCode) {
    initialConsumed = true
    return { contentCode: pending.contentCode, taskId: pending.taskId ?? '' }
  }
  if (initialConsumed) return null
  if (initialIntent) {
    initialConsumed = true
    return initialIntent
  }
  const code = hashContentCode()
  if (!code) return null
  initialConsumed = true
  return { contentCode: code, taskId: hashQueryValue('taskId') }
}
function catalogCard(code: string): MobileContentCard | undefined {
  return catalog.value.find((item) => item.contentCode === code)
}
async function loadShelf(): Promise<void> {
  if (!pageVisible.value || !gateReady.value || !onLearnRoute()) return
  const token = ++shelfSeq
  const epoch = pageEpoch
  const owner = currentOwner()
  const current = (): boolean => pageVisible.value && gateReady.value && onLearnRoute() && token === shelfSeq && epoch === pageEpoch && owner !== '' && owner === currentOwner()
  catalogPhase.value = 'loading'
  await store.loadHome()
  if (!current()) return
  if (store.homeStatus === 'forbidden') {
    catalog.value = []
    catalogPhase.value = 'denial'
    return
  }
  if (store.homeStatus === 'offline' || store.homeStatus === 'error') {
    catalog.value = []
    catalogPhase.value = 'error'
    return
  }
  const remote = store.home
  if (store.homeStatus === 'unavailable' || remote?.contentStatus === 'UNAVAILABLE') {
    catalog.value = []
    catalogPhase.value = 'unavailable'
    return
  }
  catalog.value = remote?.content ?? []
  catalogPhase.value = 'ready'
}
async function loadContent(code: string, force = false): Promise<void> {
  const normalized = code.trim()
  if (!normalized) return
  if (!force && normalized === loadedContentCode && contentState.value === 'ready' && content.value?.contentCode === normalized) return
  const token = ++readSeq
  const epoch = pageEpoch
  const owner = currentOwner()
  const current = (): boolean => pageVisible.value && gateReady.value && onLearnRoute() && token === readSeq && epoch === pageEpoch && owner !== '' && owner === currentOwner()
  contentCode.value = normalized
  content.value = null
  contentError.value = null
  const known = catalogCard(normalized)
  if (known && (rightsBlocked(known.availability) || !isAccessibleContent(known))) {
    contentState.value = 'rights'
    loadedContentCode = ''
    return
  }
  contentState.value = 'loading'
  try {
    const detail = await mobileLearnerContentApi.readContent(normalized)
    if (!current()) return
    const pin = pinnedVersion.value
    if (versionBlocked(pin, detail.contentVersionId)) {
      content.value = null
      loadedContentCode = ''
      contentState.value = 'version'
      return
    }
    const afterRead = catalogCard(detail.contentCode || normalized)
    if (afterRead && rightsBlocked(afterRead.availability)) {
      content.value = null
      loadedContentCode = ''
      contentState.value = 'rights'
      return
    }
    content.value = detail
    loadedContentCode = detail.contentCode || normalized
    contentState.value = 'ready'
  } catch (error) {
    if (!current()) return
    content.value = null
    loadedContentCode = ''
    const status = error instanceof MobileApiError ? error.status : 0
    contentState.value = readStatusKind(status) ?? 'error'
    contentError.value = error instanceof Error ? error.message : null
  }
}
function applyIntent(intent: { contentCode: string; taskId: string }): void {
  // taskId belongs to this intent only; a new course without a task clears it.
  taskId.value = intent.taskId || ''
  void loadContent(intent.contentCode, true)
}
function openCourse(code: string): void {
  if (!pageVisible.value || !gateReady.value || !onLearnRoute()) return
  const card = publishedContent.value.find((item) => item.contentCode === code)
  if (!card) return
  initialConsumed = true
  initialIntent = null
  courseQuery.value = ''
  applyIntent({ contentCode: card.contentCode, taskId: '' })
}
function returnToShelf(): void {
  readSeq += 1
  initialConsumed = true
  initialIntent = null
  contentCode.value = ''
  taskId.value = ''
  content.value = null
  loadedContentCode = ''
  contentState.value = 'idle'
  contentError.value = null
  if (typeof window === 'undefined') return
  const hash = window.location.hash
  const path = hash.split('?')[0]
  if (hash !== path) window.location.hash = path
}
function onCourseInput(event: unknown): void {
  const detail = (event as { detail?: { value?: unknown } } | null)?.detail
  courseQuery.value = typeof detail?.value === 'string' ? detail.value : ''
}
function clearSearch(): void {
  courseQuery.value = ''
}
function failClosed(): void {
  if (!pageVisible.value) return
  gateReady.value = false
  content.value = null
  contentState.value = 'error'
  contentError.value = null
}
function startSync(): void {
  void syncPage().catch(() => { failClosed() })
}
async function syncPage(): Promise<void> {
  if (!pageVisible.value) return
  const attempt = ++activeSync
  const epoch = ++pageEpoch
  gateReady.value = false
  readSeq += 1
  shelfSeq += 1
  let allowed = false
  try {
    await session.restore()
    if (!pageVisible.value || attempt !== activeSync || epoch !== pageEpoch || !onLearnRoute()) return
    // Login, return path, and duplicate navigation belong to the shared gate.
    allowed = await ensureMobilePageAccess('/pages/learn/learn')
  } catch {
    if (pageVisible.value && attempt === activeSync && epoch === pageEpoch) failClosed()
    return
  }
  if (!pageVisible.value || attempt !== activeSync || epoch !== pageEpoch || !onLearnRoute()) return
  if (!allowed) {
    if (session.isAuthenticated) failClosed()
    return
  }
  if (!currentOwner()) return
  gateReady.value = true
  await loadShelf()
  if (!pageVisible.value || attempt !== activeSync || epoch !== pageEpoch || !onLearnRoute()) return
  const intent = takeIntent()
  if (intent?.contentCode) applyIntent(intent)
  else if (contentCode.value) void loadContent(contentCode.value, true)
  if (pageVisible.value && onLearnRoute()) void learning.load()
}
function invalidateOwner(): void {
  pageEpoch += 1
  activeSync += 1
  readSeq += 1
  shelfSeq += 1
  gateReady.value = false
  content.value = null
  contentState.value = 'idle'
  contentError.value = null
  contentCode.value = ''
  taskId.value = ''
  loadedContentCode = ''
  catalog.value = []
  catalogPhase.value = 'idle'
  courseQuery.value = ''
}
onLoad((options) => {
  if (initialConsumed) return
  const optionCode = typeof options?.contentCode === 'string' ? options.contentCode.trim() : ''
  if (optionCode) {
    initialIntent = { contentCode: optionCode, taskId: typeof options?.taskId === 'string' ? options.taskId : '' }
    contentCode.value = optionCode
    taskId.value = initialIntent.taskId
  }
})
if (!contentCode.value) {
  const hashed = hashContentCode()
  if (hashed) {
    contentCode.value = hashed
    taskId.value = hashQueryValue('taskId')
  }
}
onShow(() => { pageVisible.value = true; startSync() })
onHide(() => {
  pageVisible.value = false
  gateReady.value = false
  pageEpoch += 1
  activeSync += 1
  readSeq += 1
  shelfSeq += 1
})
onBeforeUnmount(() => {
  pageVisible.value = false
  gateReady.value = false
  pageEpoch += 1
  activeSync += 1
  readSeq += 1
  shelfSeq += 1
})
watch(() => session.identityRevision, () => {
  const subject = session.verifiedSubject
  const switched = Boolean(subject && lastOwnerSubject && subject !== lastOwnerSubject)
  if (subject) lastOwnerSubject = subject
  // A real account change must not replay the previous owner's initial intent
  // or taskId. A restoring session may briefly null the subject; keep the
  // first-load intent until the page gate resolves it.
  if (switched || (subject === null && session.status !== 'restoring')) {
    initialIntent = null
    initialConsumed = true
    taskId.value = ''
  }
  invalidateOwner()
  if (pageVisible.value) startSync()
}, { flush: 'sync' })
</script>

<template>
  <view
    id="learn-shell"
    class="yx-page learn-shell"
    :class="themeClass"
    :style="experienceStyle"
    :data-motion="experienceMotion"
    :data-resolved-theme="theme"
    :data-learn-surface="surface"
    :data-shelf-state="surface === 'shelf' ? shelfKind : undefined"
  >
    <view class="learn-glow-wrap" aria-hidden="true">
      <image class="learn-glow" :src="surface === 'detail' ? detailGlow : shelfGlow" mode="aspectFit" />
    </view>
    <view class="learn-canvas">
      <view class="learn-heading">
        <text class="learn-title mobile-page-title" role="heading" aria-level="1">{{ learnT('title') }}</text>
        <text class="learn-subtitle">{{ surface === 'detail' ? learnT('detailSubtitle') : learnT('shelfSubtitle') }}</text>
      </view>

      <view v-if="surface === 'shelf'" class="learn-shelf" data-learn-shelf>
        <view v-if="catalogPhase === 'loading' || catalogPhase === 'idle'" class="learn-card" role="status">
          <text>{{ learnT('loading') }}</text>
        </view>
        <view v-else-if="shelfKind === 'denial'" class="learn-card" role="alert">
          <text class="learn-state-title">{{ learnT('explore') }}</text>
          <text>{{ learnT('shelfDenial') }}</text>
        </view>
        <view v-else-if="shelfKind === 'error'" class="learn-card" role="alert">
          <text class="learn-state-title">{{ learnT('explore') }}</text>
          <text>{{ learnT('shelfError') }}</text>
          <button tabindex="0" role="button" type="button" class="learn-primary" @click="startSync">{{ learnT('retry') }}</button>
        </view>
        <view v-else-if="shelfKind === 'unavailable'" class="learn-card" role="alert">
          <text class="learn-state-title">{{ learnT('explore') }}</text>
          <text>{{ learnT('shelfUnavailable') }}</text>
          <button tabindex="0" role="button" type="button" class="learn-primary" @click="startSync">{{ learnT('retry') }}</button>
        </view>
        <template v-else>
          <view class="learn-card learn-explore">
            <view class="learn-badge" aria-hidden="true"><image class="learn-badge-icon learn-icon" :src="shelfBook" mode="aspectFit" /></view>
            <text class="learn-state-title" role="heading" aria-level="2">{{ learnT('explore') }}</text>
            <text v-if="featured" class="learn-copy">{{ learnT('featuredBody', { title: featured.title }) }}</text>
            <text v-else-if="shelfKind === 'no-matches'" class="learn-copy">{{ learnT('noMatches') }}</text>
            <text v-else class="learn-copy">{{ learnT('catalogEmpty') }}</text>
            <button v-if="featured" tabindex="0" role="button" type="button" class="learn-primary" data-action="open-featured" @click="openCourse(featured.contentCode)">{{ learnT('openCourse') }}</button>
            <button v-else-if="shelfKind === 'no-matches'" tabindex="0" role="button" type="button" class="learn-secondary" @click="clearSearch">{{ learnT('searchClear') }}</button>
          </view>

          <view class="learn-search">
            <input
              class="learn-search-input"
              type="search"
              data-learn-query
              :value="courseQuery"
              :aria-label="learnT('searchLabel')"
              :placeholder="learnT('searchPlaceholder')"
              placeholder-style="color: var(--yx-text-secondary); opacity: 1; font-family: inherit; font-size: inherit; font-weight: inherit;"
              @input="onCourseInput"
            />
            <button v-if="courseQuery" tabindex="0" role="button" type="button" class="learn-search-clear" :aria-label="learnT('searchClear')" @click="clearSearch">{{ learnT('searchClear') }}</button>
          </view>
          <text v-if="showResultCount" class="learn-count">{{ learnT('resultCount', { count: visibleContent.length, total: publishedContent.length }) }}</text>
          <text v-if="releaseNote" class="learn-note">{{ releaseNote }}</text>

          <view v-if="shelfKind === 'results'" class="learn-list-card">
            <view class="learn-section-head">
              <text class="learn-section-title" role="heading" aria-level="2">{{ learnT('featuredHeading') }}</text>
              <text class="learn-section-count">{{ learnT('featuredCount', { count: visibleContent.length }) }}</text>
            </view>
            <button
              v-for="item in visibleContent"
              :key="item.contentCode"
              tabindex="0"
              role="button"
              type="button"
              class="learn-row"
              :data-content-code="item.contentCode"
              @click="openCourse(item.contentCode)"
            >
              <view class="learn-row-copy">
                <text class="learn-row-title">{{ item.title }}</text>
                <text class="learn-row-desc">{{ item.summary || learnT('noSummary') }}</text>
              </view>
              <image class="learn-chevron learn-icon" :src="shelfChevron" mode="aspectFit" aria-hidden="true" />
            </button>
          </view>

          <view class="learn-practice">
            <text class="learn-section-title" role="heading" aria-level="2">{{ learnT('practiceTitle') }}</text>
            <view class="learn-tiles">
              <button tabindex="0" role="button" type="button" class="learn-tile" data-practice="basic" @click="open('/pages/b2-practice/b2-practice')">
                <view class="learn-tile-well learn-tile-well--basic"><image class="learn-tile-icon" :src="practiceBasicIcon" mode="aspectFit" aria-hidden="true" /></view>
                <text>{{ learnT('practiceBasic') }}</text>
              </button>
              <button tabindex="0" role="button" type="button" class="learn-tile" data-practice="reading" @click="open('/pages/b11-reading/b11-reading')">
                <view class="learn-tile-well learn-tile-well--reading"><image class="learn-tile-icon" :src="practiceReadingIcon" mode="aspectFit" aria-hidden="true" /></view>
                <text>{{ learnT('practiceReading') }}</text>
              </button>
              <button tabindex="0" role="button" type="button" class="learn-tile" data-practice="grammar" @click="open('/pages/b3-grammar/b3-grammar')">
                <view class="learn-tile-well learn-tile-well--grammar"><image class="learn-tile-icon" :src="practiceGrammarIcon" mode="aspectFit" aria-hidden="true" /></view>
                <text>{{ learnT('practiceGrammar') }}</text>
              </button>
            </view>
          </view>
        </template>
      </view>

      <view v-else class="learn-detail" data-learn-detail>
        <button tabindex="0" role="button" type="button" class="learn-return" data-action="return-shelf" @click="returnToShelf">{{ learnT('returnShelf') }}</button>
        <view v-if="contentState === 'loading' || contentState === 'idle' || (!gateReady && contentState !== 'error' && contentState !== 'auth' && contentState !== 'denial')" class="learn-card" role="status">
          <text>{{ learnT('detailLoading') }}</text>
        </view>
        <view v-else-if="contentState === 'auth'" class="learn-card" role="alert">
          <text>{{ learnT('contentAuth') }}</text>
        </view>
        <view v-else-if="contentState === 'denial'" class="learn-card" role="alert">
          <text>{{ learnT('contentDenial') }}</text>
        </view>
        <view v-else-if="contentState === 'rights'" class="learn-card" role="alert">
          <text>{{ learnT('contentRights') }}</text>
          <text v-if="catalogCard(contentCode)">{{ mobileT(`availability.${catalogCard(contentCode)?.availability}`) }}</text>
        </view>
        <view v-else-if="contentState === 'version'" class="learn-card" role="alert">
          <text>{{ learnT('contentVersion') }}</text>
          <button tabindex="0" role="button" type="button" class="learn-primary" @click="startSync">{{ learnT('retry') }}</button>
        </view>
        <view v-else-if="contentState === 'unavailable'" class="learn-card" role="alert">
          <text>{{ contentError || learnT('contentError') }}</text>
          <button tabindex="0" role="button" type="button" class="learn-primary" @click="startSync">{{ learnT('retry') }}</button>
        </view>
        <view v-else-if="contentState === 'error'" class="learn-card" role="alert">
          <text>{{ contentError || learnT('contentError') }}</text>
          <button tabindex="0" role="button" type="button" class="learn-primary" @click="startSync">{{ learnT('retry') }}</button>
        </view>
        <template v-else-if="content">
          <view class="learn-hero">
            <view class="learn-hero-copy">
              <text v-if="contentMeta" class="learn-hero-meta">{{ contentMeta }}</text>
              <text class="learn-hero-title" role="heading" aria-level="2">{{ content.title }}</text>
              <text v-if="content.summary" class="learn-hero-summary">{{ content.summary }}</text>
              <text v-if="units.length" class="learn-hero-count">{{ learnT('unitCount', { count: units.length }) }}</text>
            </view>
            <image class="learn-hero-book learn-icon" :src="detailBook" mode="aspectFit" aria-hidden="true" />
          </view>
          <text v-if="taskId" class="learn-note" role="status">{{ learnT('taskClosed') }}</text>
          <view class="learn-card learn-units">
            <view class="learn-section-head">
              <text class="learn-section-title" role="heading" aria-level="2">{{ learnT('units') }}</text>
              <text v-if="units.length" class="learn-section-count">{{ units.length }}</text>
            </view>
            <view v-for="unit in units" :key="unit.itemId" class="learn-unit">
              <view class="learn-unit-well" aria-hidden="true"><image class="learn-unit-icon learn-icon" :src="unitBook" mode="aspectFit" /></view>
              <text class="learn-unit-text">{{ unit.text }}</text>
            </view>
            <text v-if="!units.length" class="learn-copy">{{ learnT('noUnits') }}</text>
          </view>
        </template>

        <view class="learn-card review-card">
          <text class="learn-section-title" role="heading" aria-level="2">{{ reviewTitle }}</text>
          <text v-if="learning.queue.length === 0" class="learn-copy" data-weakness-unknown>{{ weaknessView(0).copy }}</text>
          <text v-else class="learn-copy" data-weakness-evidence>{{ learnT('reviewEvidence') }}</text>
          <text v-if="learning.state === 'idle' || learning.state === 'loading'" class="learn-copy" role="status">{{ learnT('reviewLoading') }}</text>
          <text v-else-if="learning.state === 'empty'" class="learn-copy">{{ learnT('reviewEmpty') }}</text>
          <text class="learn-internal" data-stage-projection>{{ learning.projectionVersion || STAGE_PROJECTION }}</text>
          <text v-if="learning.queue[0]" class="learn-copy" data-stage>{{ stageLabel(learning.queue[0].state) }}</text>
          <text v-if="learning.queue.length === 0 && learning.state !== 'loading'" class="learn-copy" data-review-empty>{{ learning.emptyCopy || reviewEmpty(learning.state === 'error' || learning.state === 'offline', true, false).copy }}</text>
          <text v-if="learning.history.length" class="learn-copy" data-review-history>{{ historySummary }}</text>
          <text v-if="reviewFailureCopy(learning.lastError)" class="learn-copy" data-review-illegal>{{ reviewFailureCopy(learning.lastError) }}</text>
          <template v-else-if="reviewNotice">
            <text class="learn-alert" role="alert">{{ reviewFailureCopy(learning.lastError) || reviewNotice }}</text>
            <button v-if="learning.state !== 'permission' && learning.state !== 'recovery'" tabindex="0" role="button" type="button" class="learn-secondary" @click="learning.load()">{{ learnT('retry') }}</button>
          </template>
          <view v-for="item in reviewRows" :key="item.queueItemId" class="learn-review-row">
            <text class="learn-row-title">{{ reviewLabel(item) }}</text>
            <button tabindex="0" role="button" type="button" class="learn-secondary" :disabled="learning.busyItemId === item.queueItemId" :aria-disabled="learning.busyItemId === item.queueItemId" @click="reviewAction(item)">{{ reviewActionLabel(item) }}</button>
            <text v-if="!item.completable" class="learn-copy" data-review-reason>{{ reviewReason(item) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
#learn-shell {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background-color: var(--yx-r4-page-color, var(--yx-surface-page));
  background-image: var(--yx-r4-home-image, var(--yx-r4-page-image, none));
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-family: var(--v2-font);
  line-height: 1.5;
  overflow-wrap: anywhere;
}
#learn-shell * { box-sizing: border-box; }
#learn-shell button,
#learn-shell input {
  min-width: 0;
  margin: 0;
  border: 0;
  font: inherit;
  line-height: inherit;
}
#learn-shell button { background: transparent; color: inherit; text-align: left; white-space: normal; }
#learn-shell button::after { border: 0; }
#learn-shell button:focus-visible,
#learn-shell input:focus-visible { outline: none; box-shadow: var(--v2-focus); }
#learn-shell button[disabled] { cursor: default; opacity: .72; }
.learn-glow-wrap { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.learn-glow { position: absolute; top: -120px; right: -80px; width: min(540px, 100%); height: 320px; }
.learn-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: calc(24px + env(safe-area-inset-top)) clamp(16px, 5vw, 24px) calc(112px + env(safe-area-inset-bottom));
}
.learn-heading { display: grid; gap: 6px; margin-bottom: 16px; }
.learn-title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 28px; line-height: 1.29; font-weight: 700; }
.learn-subtitle,
.learn-copy,
.learn-note,
.learn-count,
.learn-row-desc,
.learn-hero-summary,
.learn-hero-count { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.5; }
.learn-note { margin: 8px 0; }
.learn-card,
.learn-list-card,
.learn-hero {
  min-width: 0;
  margin-bottom: 16px;
  padding: 20px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 24px;
  background: var(--yx-r4-glass, var(--yx-surface-card));
  box-shadow: var(--yx-r4-shadow-card, var(--yx-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 0px));
  -webkit-backdrop-filter: blur(var(--yx-r4-blur, 0px));
}
.learn-explore { display: grid; justify-items: center; gap: 10px; text-align: center; }
.learn-explore .learn-copy,
.learn-explore .learn-state-title { text-align: center; }
.learn-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: var(--yx-brand-soft, var(--v2-soft));
}
.learn-badge-icon { width: 26px; height: 26px; }
.learn-state-title,
.learn-section-title,
.learn-row-title,
.learn-hero-title { display: block; color: var(--yx-r4-ink, var(--yx-text-primary)); font-weight: 700; overflow-wrap: anywhere; }
.learn-state-title,
.learn-section-title,
.learn-hero-title { font-size: 18px; line-height: 1.35; }
.learn-row-title { font-size: 16px; }
.learn-primary,
.learn-secondary,
.learn-return {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 12px 16px;
  border-radius: 999px;
  text-align: center;
  font-weight: 700;
}
#learn-shell .learn-primary {
  width: 100%;
  min-height: 48px;
  padding: 14px 20px;
  border-radius: 14px;
  background-color: var(--yx-r4-cta-color, var(--yx-brand));
  background-image: var(--yx-r4-cta-image, var(--closed-cta-background));
  box-shadow: var(--yx-r4-shadow-cta, var(--closed-cta-shadow));
  color: var(--yx-r4-on-cta, var(--yx-on-brand));
  font-size: 16px;
  text-align: center;
}
#learn-shell .learn-secondary,
#learn-shell .learn-return {
  width: auto;
  background: var(--yx-brand-soft, var(--v2-soft));
  color: var(--yx-r4-brand, var(--yx-brand));
  text-align: center;
}
.learn-return { margin-bottom: 12px; }
.learn-search { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.learn-search-input {
  flex: 1 1 auto;
  min-height: 48px;
  padding: 12px 14px;
  border: 1px solid var(--yx-r4-field-border, var(--yx-border));
  border-radius: 16px;
  background: var(--yx-r4-field, var(--yx-surface-card));
  box-shadow: var(--yx-r4-shadow-field, none);
  color: var(--yx-r4-ink, var(--yx-text-primary));
}
.learn-search-clear { flex: 0 0 auto; min-height: 44px; padding: 8px 12px; border-radius: 12px; background: var(--v2-soft); color: var(--v2-brand); }
.learn-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.learn-section-count { flex: 0 0 auto; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; }
.learn-row,
.learn-unit,
.learn-review-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 64px;
  margin-top: 10px;
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--yx-r4-tip, var(--yx-surface-soft));
}
.learn-row-copy { flex: 1 1 auto; min-width: 0; }
.learn-chevron { width: 24px; height: 24px; flex: 0 0 24px; }
.learn-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
#learn-shell .learn-tile {
  display: grid;
  justify-items: center;
  gap: 8px;
  min-height: 92px;
  padding: 0 4px;
  border-radius: 18px;
  background: transparent;
  color: var(--yx-r4-ink, var(--yx-text-primary));
  text-align: center;
  font-size: 13px;
  font-weight: 650;
}
.learn-tile-well {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 18px;
  box-shadow: var(--yx-r4-shadow-field, none);
}
.learn-tile-well--basic { background: var(--yx-profile-tile-neutral, var(--yx-surface-soft)); }
.learn-tile-well--reading { background: var(--yx-success-soft); }
.learn-tile-well--grammar { background: var(--yx-brand-soft); }
.learn-tile-icon { width: 28px; height: 28px; }
#learn-shell .learn-hero {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 22px;
  border-color: transparent;
  border-radius: 28px;
  background-color: var(--yx-r4-cta-color, var(--yx-brand));
  background-image: var(--yx-r4-cta-image, var(--closed-cta-background));
  box-shadow: var(--yx-r4-shadow-cta, var(--closed-cta-shadow));
  color: var(--yx-r4-on-cta, var(--yx-on-brand));
}
.learn-hero-copy { flex: 1 1 auto; min-width: 0; }
.learn-hero-meta,
.learn-hero-title,
.learn-hero-summary,
.learn-hero-count { color: var(--yx-r4-on-cta, var(--yx-on-brand)); }
.learn-hero-meta { font-size: 13px; line-height: 20px; opacity: 0.8; }
.learn-hero-title { font-size: 24px; line-height: 1.33; }
.learn-hero-summary { font-size: 14px; line-height: 22px; opacity: 0.9; }
.learn-hero-count { font-size: 12px; line-height: 18px; opacity: 0.85; }
.learn-hero-book {
  width: 72px;
  height: 72px;
  flex: 0 0 72px;
  padding: 19px;
  border-radius: 24px;
  background: color-mix(in srgb, var(--yx-r4-on-cta, var(--yx-on-brand)) 18%, transparent);
}
.learn-units { padding-top: 8px; padding-bottom: 8px; }
.learn-unit {
  align-items: center;
  margin-top: 0;
  border-radius: 0;
  background: transparent;
  border-top: 1px solid var(--yx-border, var(--v2-line));
}
.learn-unit-well {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border-radius: 14px;
  background: var(--yx-brand-soft, var(--v2-soft));
}
.learn-unit-icon { width: 22px; height: 22px; }
.learn-unit-text { flex: 1 1 auto; min-width: 0; color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 15px; line-height: 22px; font-weight: 700; }
.learn-review-row { flex-wrap: wrap; }
.learn-review-row .learn-row-title { flex: 1 1 auto; }
.learn-alert { display: block; color: var(--v2-danger, var(--yx-danger)); }
.learn-internal { display: none !important; }
.learn-hero .learn-icon { filter: brightness(0) invert(1); }
#learn-shell[data-resolved-theme="dark"] .learn-hero .learn-icon { filter: brightness(0); }
#learn-shell[data-resolved-theme="dark"] .learn-badge-icon,
#learn-shell[data-resolved-theme="high-contrast"] .learn-badge-icon,
#learn-shell[data-resolved-theme="dark"] .learn-chevron,
#learn-shell[data-resolved-theme="dark"] .learn-unit-icon,
#learn-shell[data-resolved-theme="high-contrast"] .learn-chevron,
#learn-shell[data-resolved-theme="high-contrast"] .learn-unit-icon,
#learn-shell[data-resolved-theme="high-contrast"] .learn-hero .learn-icon { filter: brightness(0) invert(1); }
#learn-shell[data-resolved-theme="high-contrast"] .learn-glow-wrap { display: none; }
#learn-shell[data-resolved-theme="high-contrast"] .learn-card,
#learn-shell[data-resolved-theme="high-contrast"] .learn-list-card,
#learn-shell[data-resolved-theme="high-contrast"] .learn-hero,
#learn-shell[data-resolved-theme="high-contrast"] .learn-row,
#learn-shell[data-resolved-theme="high-contrast"] .learn-unit,
#learn-shell[data-resolved-theme="high-contrast"] .learn-tile,
#learn-shell[data-resolved-theme="high-contrast"] .learn-tile-well,
#learn-shell[data-resolved-theme="high-contrast"] .learn-unit-well,
#learn-shell[data-resolved-theme="high-contrast"] .learn-primary,
#learn-shell[data-resolved-theme="high-contrast"] .learn-search-input { border: 2px solid var(--v2-ink); }
@media (max-width: 360px) {
  .learn-title { font-size: 26px; }
  .learn-hero-title { font-size: 22px; }
  .learn-tiles { gap: 8px; }
  #learn-shell .learn-tile { font-size: 12px; }
  .learn-tile-well { width: 48px; height: 48px; }
  #learn-shell .learn-hero { flex-wrap: wrap; }
}
@media (min-width: 768px) {
  .learn-canvas { max-width: 720px; padding-top: 32px; padding-right: 32px; padding-left: 32px; }
  .learn-list-card .learn-row { min-height: 72px; }
}
</style>
