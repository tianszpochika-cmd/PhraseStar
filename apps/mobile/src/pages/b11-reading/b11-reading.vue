<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import type { B10ReadingArticle } from '../../domain/b10'
import {
  READING_BODY_BASE_PX,
  READING_BODY_MAX_PX,
  READING_FONT_MAX_PERCENT,
  READING_FONT_MIN_PERCENT,
  READING_TRANSLATION_BASE_PX,
  READING_TRANSLATION_MAX_PX,
  articleViewState,
  chooseListedArticleId,
  clampBlockIndex,
  classifyReadingStatus,
  denialCanRender,
  localPositionRecord,
  localReadPercent,
  nextWordSelection,
  paragraphPieces,
  readableQuestionCount,
  readStillCurrent,
  readingFontPx,
  readingRouteActive,
  readingShell,
  readingStorageKey,
  restoreLocalPosition,
  selectionMatches,
  stepReadingFont,
  visibleBlocks,
  type LocalWordSelection,
  type ReadPermit,
  type ReadingArticleInput,
  type ReadingViewState,
} from '../../domain/reading-page'
import { b10LearningApi } from '../../api/b10'
import { MobileApiError } from '../../api/client'
import { currentMobilePagePath, ensureMobilePageAccess } from '../../auth/navigation'
import { b10ContentLocale, b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { backMobile, mobileExperienceEngine, mobileT, useMobileExperience } from '../../platform/experience'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { mobileI18n } from '../../platform/v2-foundation'
import { useSessionStore } from '../../stores/session'

const graded = true
const ROUTE_ID = 'b11-reading' as const
const ROUTE_PATH = '/pages/b11-reading/b11-reading'
const titleKey = 'titleGraded'
const practiceChev = '/static/figma-reading-core/reading-article-168-1313/imgIconChevL.svg'
const gradedChev = '/static/figma-reading-core/reading-graded-168-2513/imgIconChevL.svg'
const chevSrc = graded ? gradedChev : practiceChev
const chevClass = graded ? 'reading-icon-20' : 'reading-icon-22'
const trackSrc = '/static/figma-reading-core/reading-article-168-1313/imgTrack.svg'
const moreSrc = '/static/figma-reading-core/reading-graded-168-2513/imgIconMore.svg'
const checkSrc = '/static/figma-reading-core/reading-graded-168-2513/imgIconCheckSq.svg'
const chevRightSrc = '/static/figma-reading-core/reading-graded-168-2513/imgIconChevR.svg'
const bookSrc = '/static/figma-reading-core/reading-empty-168-1246/imgIconBook.svg'
const lockSrc = '/static/figma-reading-core/reading-rights-withdrawn-168-2607/imgIconLock.svg'
const mascotRestrictedSrc = '/static/figma-reading-core/reading-restricted-168-2234/imgMascot.svg'
const mascotErrorSrc = '/static/figma-reading-core/reading-error-168-3333/imgMascot.svg'
const glowArticle = '/static/figma-reading-core/reading-article-168-1313/imgGlow.svg'
const glowEmpty = '/static/figma-reading-core/reading-empty-168-1246/imgGlow.svg'
const glowGraded = '/static/figma-reading-core/reading-graded-168-2513/imgGlow.svg'
const glowRestricted = '/static/figma-reading-core/reading-restricted-168-2234/imgGlow.svg'
const glowWithdrawn = '/static/figma-reading-core/reading-rights-withdrawn-168-2607/imgGlow.svg'
const glowError = '/static/figma-reading-core/reading-error-168-3333/imgGlow.svg'

const session = useSessionStore()
const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const state = ref<ReadingViewState>('idle')
const article = ref<ReadingArticleInput | null>(null)
const blockIndex = ref(0)
const questionCount = ref(0)
const fontPercent = ref(READING_FONT_MIN_PERCENT)
const showTranslation = ref(false)
const selection = ref<LocalWordSelection | null>(null)
const selectionGeneration = ref(0)
const pageVisible = ref(false)
const pageRoot = ref<{ $el?: HTMLElement } | null>(null)
const paragraphNavId = ROUTE_ID + '-paragraph-nav'
const quality = ref(mobileExperienceEngine.state.level)
let pageEpoch = 0
let loadRequest = 0
const stopQuality = mobileExperienceEngine.subscribe((next) => { quality.value = next.level })

function t(key: string, values?: Record<string, string | number>): string {
  b10UiLocale.value
  const message = mobileT(`readingPage.${key}`)
  return values ? interpolate(message, values) : message
}
function documentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden === true
}
function routeStillCurrent(): boolean {
  return readingRouteActive(currentMobilePagePath(), ROUTE_PATH)
}
function abandonIfLeft(): boolean {
  if (routeStillCurrent()) return false
  hidePage()
  return true
}
function privateReadAllowed(requestEpoch: number, requestId: number, subject: string, revision: number): boolean {
  if (abandonIfLeft()) return false
  return readStillCurrent(livePermit(requestEpoch, requestId, subject, revision))
}
function livePermit(requestEpoch: number, requestId: number, subject: string, revision: number): ReadPermit {
  return {
    visible: pageVisible.value && !documentHidden() && routeStillCurrent(),
    epoch: pageEpoch,
    requestEpoch,
    requestId,
    activeRequestId: loadRequest,
    subject,
    liveSubject: session.verifiedSubject ?? '',
    revision,
    liveRevision: session.identityRevision,
    adultPassed: session.adultGate === 'PASSED' && session.adultLearningAccess === 'ELIGIBLE',
    consentAllowsLearning: session.learningConsentWithdrawn !== true,
    learningReady: session.isLearningReady === true,
  }
}
function concealContent(): void {
  pageEpoch += 1
  loadRequest += 1
  state.value = 'idle'
  article.value = null
  questionCount.value = 0
  blockIndex.value = 0
  selection.value = null
  selectionGeneration.value += 1
}
function hidePage(): void {
  pageVisible.value = false
  concealContent()
}
function statusOf(error: unknown): number {
  return error instanceof MobileApiError ? error.status : -1
}
function applyFailure(error: unknown, requestEpoch: number, requestId: number, subject: string, revision: number): boolean {
  const status = statusOf(error)
  const next = classifyReadingStatus(status)
  const permit = livePermit(requestEpoch, requestId, subject, revision)
  const allowed = next === 'auth-401' || next === 'auth-403' ? denialCanRender(permit) : readStillCurrent(permit)
  if (!allowed) return false
  article.value = null
  questionCount.value = 0
  selection.value = null
  state.value = next
  return true
}
function readRawPosition(): unknown {
  const key = readingStorageKey(ROUTE_ID)
  let stored: unknown
  try { stored = getUniRuntime().getStorageSync(key) } catch { return null }
  if (stored == null || stored === '') return null
  if (typeof stored === 'string') {
    try { return JSON.parse(stored) as unknown } catch {
      try { getUniRuntime().removeStorageSync(key) } catch { /* local cache is optional */ }
      return null
    }
  }
  if (typeof stored === 'object') return stored
  try { getUniRuntime().removeStorageSync(key) } catch { /* local cache is optional */ }
  return null
}
function clearPosition(): void {
  try { getUniRuntime().removeStorageSync(readingStorageKey(ROUTE_ID)) } catch { /* local cache is optional */ }
}
function toInput(source: B10ReadingArticle): ReadingArticleInput {
  return {
    articleId: source.articleId,
    title: source.title,
    cefrLevel: source.cefrLevel,
    wordCount: source.wordCount,
    estimatedMinutes: source.estimatedMinutes,
    blocks: source.blocks.map((block) => ({ blockId: block.blockId, blockIndex: block.blockIndex, text: block.text, translation: block.translation })),
    rightsStatus: source.rightsStatus,
    availability: null,
    contentVersionId: source.contentVersionId,
    contentEpoch: source.contentEpoch,
  }
}
function persistLocal(): void {
  const current = article.value
  const subject = session.verifiedSubject ?? ''
  if (state.value !== 'ready' || !current || !subject) return
  const record = localPositionRecord({
    routeId: ROUTE_ID,
    subject,
    articleId: current.articleId,
    contentVersionId: current.contentVersionId,
    contentEpoch: current.contentEpoch,
  }, clampBlockIndex(blockIndex.value, visibleBlocks(current, 'ready').length))
  try { getUniRuntime().setStorageSync(readingStorageKey(ROUTE_ID), JSON.stringify(record)) } catch { /* position stays in memory */ }
}
async function load(): Promise<void> {
  if (documentHidden()) return
  if (!routeStillCurrent()) {
    if (pageVisible.value || article.value) hidePage()
    return
  }
  if (!pageVisible.value) return
  const requestEpoch = pageEpoch
  const requestId = ++loadRequest
  state.value = 'loading'
  article.value = null
  questionCount.value = 0
  selection.value = null
  selectionGeneration.value += 1
  try { await session.restore() } catch { /* restore closes the session itself */ }
  if (abandonIfLeft()) return
  if (!denialCanRender(livePermit(requestEpoch, requestId, session.verifiedSubject ?? '', session.identityRevision))) return
  const allowed = await ensureMobilePageAccess(ROUTE_PATH)
  if (abandonIfLeft()) return
  if (!denialCanRender(livePermit(requestEpoch, requestId, session.verifiedSubject ?? '', session.identityRevision))) return
  const subject = session.verifiedSubject ?? ''
  const revision = session.identityRevision
  if (!allowed || !readStillCurrent(livePermit(requestEpoch, requestId, subject, revision))) {
    if (!denialCanRender(livePermit(requestEpoch, requestId, subject, revision))) return
    article.value = null
    questionCount.value = 0
    state.value = session.isAuthenticated ? 'auth-403' : 'auth-401'
    return
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  const context = { uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }
  let listed: B10ReadingArticle[]
  try {
    listed = await b10LearningApi.listReadingArticles(context)
  } catch (error) {
    if (abandonIfLeft()) return
    applyFailure(error, requestEpoch, requestId, subject, revision)
    return
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  const articleId = chooseListedArticleId(listed.map((item) => ({ articleId: item.articleId, rightsStatus: item.rightsStatus })))
  if (articleId == null) {
    article.value = null
    questionCount.value = 0
    state.value = 'empty'
    return
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  let detail: B10ReadingArticle
  try {
    detail = await b10LearningApi.getReadingArticle(context, articleId)
  } catch (error) {
    if (abandonIfLeft()) return
    applyFailure(error, requestEpoch, requestId, subject, revision)
    return
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  const input = toInput(detail)
  const view = articleViewState(input)
  if (view !== 'ready') {
    article.value = null
    questionCount.value = 0
    selection.value = null
    state.value = view
    return
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  let count = 0
  try {
    const questions = await b10LearningApi.listReadingQuestions(context, input.articleId)
    if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
    count = readableQuestionCount(questions)
  } catch (error) {
    if (abandonIfLeft()) return
    const kind = classifyReadingStatus(statusOf(error))
    if (kind === 'auth-401' || kind === 'auth-403' || kind === 'stale') {
      applyFailure(error, requestEpoch, requestId, subject, revision)
      return
    }
    if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
    count = 0
  }
  if (!privateReadAllowed(requestEpoch, requestId, subject, revision)) return
  const raw = readRawPosition()
  const restored = restoreLocalPosition(raw, {
    routeId: ROUTE_ID,
    subject,
    articleId: input.articleId,
    contentVersionId: input.contentVersionId,
    contentEpoch: input.contentEpoch,
  })
  if (raw && !restored) clearPosition()
  article.value = input
  questionCount.value = count
  blockIndex.value = clampBlockIndex(restored?.blockIndex ?? 0, visibleBlocks(input, 'ready').length)
  selection.value = null
  state.value = 'ready'
  persistLocal()
}
function changeFont(direction: -1 | 1): void {
  fontPercent.value = stepReadingFont(fontPercent.value, direction)
}
function moveParagraph(direction: -1 | 1): void {
  const count = blocks.value.length
  const next = clampBlockIndex(safeIndex.value + direction, count)
  if (next === safeIndex.value) return
  blockIndex.value = next
  selection.value = null
  selectionGeneration.value += 1
  persistLocal()
}
function chooseWord(blockId: string, word: string): void {
  const next = nextWordSelection(selectionGeneration.value, blockId, word)
  if (!next) return
  selectionGeneration.value = next.generation
  selection.value = selectionMatches(next, selectionGeneration.value) ? next : null
}
function wordSelected(blockId: string, word: string): boolean {
  return selectionMatches(selection.value, selectionGeneration.value) && selection.value?.blockId === blockId && selection.value.word === word.trim()
}
function h5TabIndex(enabled: boolean): '0' | '-1' | undefined {
  // #ifdef H5
  return enabled ? '0' : '-1'
  // #endif
  // #ifndef H5
  return enabled ? undefined : undefined
  // #endif
}
function h5ButtonRole(): 'button' | undefined {
  // #ifdef H5
  return 'button'
  // #endif
  // #ifndef H5
  return undefined
  // #endif
}
function h5AriaDisabled(enabled: boolean): 'true' | undefined {
  // #ifdef H5
  return enabled ? undefined : 'true'
  // #endif
  // #ifndef H5
  return enabled ? undefined : undefined
  // #endif
}
function readingKeysReady(): boolean {
  // #ifdef H5
  return pageVisible.value && !documentHidden() && routeStillCurrent()
  // #endif
  // #ifndef H5
  return false
  // #endif
}
function activateWord(blockId: string, word: string): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  chooseWord(blockId, word)
  // #endif
}
function activateParagraph(direction: -1 | 1): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  const enabled = direction < 0 ? safeIndex.value > 0 : safeIndex.value < blocks.value.length - 1
  if (!enabled) return
  moveParagraph(direction)
  // #endif
}
function activateBack(): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  backMobile()
  // #endif
}
function activateLoad(): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  void load()
  // #endif
}
function activatePractice(): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  backToPractice()
  // #endif
}
function activateFont(direction: -1 | 1): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  const enabled = direction < 0 ? fontPercent.value > READING_FONT_MIN_PERCENT : fontPercent.value < READING_FONT_MAX_PERCENT
  if (!enabled) return
  changeFont(direction)
  // #endif
}
function activateSegment(translated: boolean): void {
  // #ifdef H5
  if (!readingKeysReady()) return
  showTranslation.value = translated
  // #endif
}
function focusParagraphNav(event: { preventDefault?: () => void }): void {
  // #ifdef H5
  // Hidden uni pages stay mounted. Move focus only inside this visible page root.
  event.preventDefault?.()
  if (!pageVisible.value || documentHidden() || !routeStillCurrent()) return
  pageRoot.value?.$el?.querySelector<HTMLElement>('#' + paragraphNavId)?.focus()
  // #endif
}
function backToPractice(): void { openUniPage('/pages/practice/practice') }
function onVisibility(): void {
  if (typeof document === 'undefined') return
  if (documentHidden()) {
    if (pageVisible.value) hidePage()
    return
  }
  if (!routeStillCurrent()) {
    hidePage()
    return
  }
  if (!pageVisible.value) {
    pageVisible.value = true
    void load()
  }
}
function onRouteChange(): void {
  if (!routeStillCurrent()) {
    hidePage()
    return
  }
  if (!pageVisible.value && !documentHidden()) {
    pageVisible.value = true
    void load()
  }
}

const blocks = computed(() => visibleBlocks(article.value, state.value))
const safeIndex = computed(() => clampBlockIndex(blockIndex.value, blocks.value.length))
const current = computed(() => blocks.value[safeIndex.value] ?? null)
const pieces = computed(() => current.value ? paragraphPieces(current.value.text) : [])
const percent = computed(() => localReadPercent(safeIndex.value, blocks.value.length))
const bodyPx = computed(() => readingFontPx(fontPercent.value, READING_BODY_BASE_PX, READING_BODY_MAX_PX))
const translationPx = computed(() => readingFontPx(fontPercent.value, READING_TRANSLATION_BASE_PX, READING_TRANSLATION_MAX_PX))
const shell = computed(() => readingShell(state.value))
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const pageStyle = computed(() => ({ ...experienceStyle.value, '--reading-body-size': `${bodyPx.value}px`, '--reading-translation-size': `${translationPx.value}px` }))
const glowSrc = computed(() => {
  if (shell.value === 'withdrawn') return glowWithdrawn
  if (shell.value === 'error') return glowError
  if (shell.value === 'restricted') return glowRestricted
  if (shell.value === 'empty') return graded ? glowGraded : glowEmpty
  return graded ? glowGraded : glowArticle
})
const restrictedBody = computed(() => {
  if (state.value === 'auth-401') return t('auth401')
  if (state.value === 'auth-403') return t('auth403')
  if (state.value === 'stale') return t('stale')
  if (state.value === 'unpublished') return t('unpublished')
  if (state.value === 'unauthorized-content') return t('unauthorized')
  return t('offline')
})
const activeSelection = computed(() => selectionMatches(selection.value, selectionGeneration.value) ? selection.value : null)

watch(
  () => [session.identityRevision, session.verifiedSubject, session.adultGate, session.adultLearningAccess, session.learningConsentWithdrawn, session.isLearningReady] as const,
  () => {
    if (!routeStillCurrent()) {
      hidePage()
      return
    }
    concealContent()
    if (pageVisible.value && !documentHidden()) void load()
  },
  { flush: 'sync' },
)
onShow(() => {
  if (!routeStillCurrent()) {
    hidePage()
    return
  }
  pageVisible.value = true
  void load()
})
onHide(() => { hidePage() })
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility)
if (typeof window !== 'undefined') window.addEventListener('hashchange', onRouteChange)
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') window.removeEventListener('hashchange', onRouteChange)
  stopQuality()
})
</script>

<template>
  <view
    ref="pageRoot"
    class="reading-page"
    :class="themeClass"
    :style="pageStyle"
    :data-route="ROUTE_ID"
    :data-state="state"
    :data-shell="shell"
    :data-quality="quality"
    :data-motion="experienceMotion"
    :data-theme="theme"
    :data-content-locale="b10ContentLocale"
    :data-ui-locale="b10UiLocale"
    data-write-capability="closed"
    data-server-receipt="none"
    :data-access="state === 'auth-401' || state === 'auth-403' ? 'forbidden' : 'allowed'"
    :data-font-percent="fontPercent"
    :data-body-px="bodyPx"
    :data-translation-px="translationPx"
    :data-translation="showTranslation ? 'on' : 'off'"
    :data-block-index="safeIndex"
    :data-block-count="blocks.length"
    :data-graded="graded ? 'true' : 'false'"
    data-selection-persisted="false"
  >
    <view class="reading-glow" aria-hidden="true">
      <image class="reading-glow-image" :src="glowSrc" mode="aspectFit" />
    </view>
    <view class="reading-canvas">
      <view class="reading-nav">
        <button type="button" class="reading-hit" data-action="back" :aria-label="t('back')" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="backMobile" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateBack" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateBack">
          <image :class="['reading-mono', chevClass]" :src="chevSrc" mode="aspectFit" />
        </button>
        <text class="reading-nav-title" role="heading" aria-level="1">{{ t(titleKey) }}</text>
        <view v-if="graded" class="reading-hit" role="img" :aria-label="t('moreClosed')">
          <image class="reading-mono reading-icon-20" :src="moreSrc" mode="aspectFit" />
        </view>
        <view v-else class="reading-hit" aria-hidden="true"></view>
      </view>

      <view v-if="shell === 'loading'" class="reading-loading" role="status">{{ t('loading') }}</view>

      <view v-else-if="shell === 'empty'" class="reading-state">
        <view class="reading-card reading-card--center" role="status">
          <view class="reading-badge reading-badge--book" aria-hidden="true">
            <image class="reading-icon-44" :src="bookSrc" mode="aspectFit" />
          </view>
          <text class="reading-state-title">{{ t('emptyTitle') }}</text>
          <text class="reading-state-body">{{ t('emptyBody') }}</text>
        </view>
        <button type="button" class="reading-cta" data-action="refresh" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="load" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateLoad" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateLoad">{{ t('refresh') }}</button>
      </view>

      <view v-else-if="shell === 'withdrawn'" class="reading-state">
        <view class="reading-card reading-card--center" role="alert">
          <view class="reading-badge reading-badge--lock" aria-hidden="true">
            <image class="reading-icon-44" :src="lockSrc" mode="aspectFit" />
          </view>
          <text class="reading-state-title">{{ t('revokedTitle') }}</text>
          <text class="reading-state-body">{{ t('revokedBody') }}</text>
        </view>
        <button type="button" class="reading-cta" data-action="reread" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="load" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateLoad" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateLoad">{{ t('reread') }}</button>
      </view>

      <view v-else-if="shell === 'error'" class="reading-state">
        <view class="reading-card reading-card--center" role="alert">
          <image class="reading-mascot" :src="mascotErrorSrc" mode="aspectFit" alt="" />
          <text class="reading-state-title">{{ t('errorTitle') }}</text>
          <text class="reading-state-body">{{ t('errorBody') }}</text>
        </view>
        <button type="button" class="reading-cta" data-action="retry" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="load" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateLoad" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateLoad">{{ t('retry') }}</button>
      </view>

      <view v-else-if="shell === 'restricted'" class="reading-state">
        <view class="reading-card reading-card--center" role="alert">
          <image class="reading-mascot" :src="mascotRestrictedSrc" mode="aspectFit" alt="" />
          <text class="reading-state-title">{{ t('restrictedTitle') }}</text>
          <text class="reading-state-body">{{ restrictedBody }}</text>
        </view>
        <button type="button" class="reading-cta" data-action="retry" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="load" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateLoad" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateLoad">{{ t('retry') }}</button>
        <button type="button" class="reading-link" data-action="back-practice" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="backToPractice" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activatePractice" @keydown.space.stop.prevent @keyup.space.stop.prevent="activatePractice">{{ t('backPractice') }}</button>
      </view>

      <view v-else-if="shell === 'ready' && current" class="reading-ready">
        <view class="reading-tools">
          <button type="button" class="reading-font" data-action="font-down" :aria-label="t('fontDown')" :tabindex="h5TabIndex(fontPercent > READING_FONT_MIN_PERCENT)" :role="h5ButtonRole()" :aria-disabled="h5AriaDisabled(fontPercent > READING_FONT_MIN_PERCENT)" :disabled="fontPercent <= READING_FONT_MIN_PERCENT" @click="changeFont(-1)" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateFont(-1)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateFont(-1)">A−</button>
          <text class="reading-font-value">{{ fontPercent }}%</text>
          <button type="button" class="reading-font" data-action="font-up" :aria-label="t('fontUp')" :tabindex="h5TabIndex(fontPercent < READING_FONT_MAX_PERCENT)" :role="h5ButtonRole()" :aria-disabled="h5AriaDisabled(fontPercent < READING_FONT_MAX_PERCENT)" :disabled="fontPercent >= READING_FONT_MAX_PERCENT" @click="changeFont(1)" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateFont(1)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateFont(1)">A＋</button>
          <view class="reading-tools-gap" aria-hidden="true"></view>
          <button v-if="!graded" type="button" class="reading-toggle" data-action="translation" :aria-pressed="showTranslation ? 'true' : 'false'" :aria-label="showTranslation ? t('translationHide') : t('translationShow')" @click="showTranslation = !showTranslation">
            <text>{{ showTranslation ? t('translationHide') : t('translationShow') }}</text>
            <image class="reading-track" :src="trackSrc" mode="aspectFit" alt="" />
          </button>
        </view>

        <view class="reading-card">
          <view class="reading-meta">
            <text class="reading-tag">{{ article?.cefrLevel }}</text>
            <text class="reading-meta-text">{{ t('words', { count: article?.wordCount ?? 0 }) }} · {{ t('minutes', { count: article?.estimatedMinutes ?? 0 }) }}</text>
          </view>
          <text class="reading-article-title" role="heading" aria-level="2">{{ article?.title }}</text>
          <view class="reading-progress">
            <view class="reading-bar" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100" :aria-label="t('noServerReceipt')" data-local-only="true">
              <view class="reading-bar-fill" :style="{ width: percent + '%' }"></view>
            </view>
            <text class="reading-meta-text">{{ t('localPercent', { percent }) }}</text>
          </view>
          <view v-if="graded" class="reading-segment" role="group" :aria-label="t('translationShow')">
            <button type="button" class="reading-segment-btn" data-action="original" :aria-pressed="showTranslation ? 'false' : 'true'" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="showTranslation = false" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateSegment(false)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateSegment(false)">{{ t('original') }}</button>
            <button type="button" class="reading-segment-btn" data-action="bilingual" :aria-pressed="showTranslation ? 'true' : 'false'" :tabindex="h5TabIndex(true)" :role="h5ButtonRole()" @click="showTranslation = true" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateSegment(true)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateSegment(true)">{{ t('bilingual') }}</button>
          </view>
          <!-- #ifdef H5 -->
          <button type="button" class="reading-word-bypass" tabindex="0" role="button" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="focusParagraphNav" @keydown.space.stop.prevent @keyup.space.stop.prevent="focusParagraphNav">{{ t('skipWords') }}</button>
          <!-- #endif -->
          <view class="reading-body" :style="{ fontSize: bodyPx + 'px' }">
            <template v-for="(piece, index) in pieces" :key="`${current.blockId}-${index}`">
              <button
                v-if="piece.kind === 'word'"
                type="button"
                class="reading-word"
                data-action="select-word"
                :data-selected="wordSelected(current.blockId, piece.value) ? 'true' : 'false'"
                :aria-pressed="wordSelected(current.blockId, piece.value) ? 'true' : 'false'"
                :tabindex="h5TabIndex(true)"
                :role="h5ButtonRole()"
                @click="chooseWord(current.blockId, piece.value)"
                @keydown.enter.stop.prevent
                @keyup.enter.stop.prevent="activateWord(current.blockId, piece.value)"
                @keydown.space.stop.prevent
                @keyup.space.stop.prevent="activateWord(current.blockId, piece.value)"
              >{{ piece.value }}</button>
              <text v-else class="reading-space">{{ piece.value }}</text>
            </template>
          </view>
          <text v-if="showTranslation && current.translation" class="reading-translation" :style="{ fontSize: translationPx + 'px' }">{{ current.translation }}</text>
          <text v-if="activeSelection" class="reading-selection" role="status">{{ t('selectedLocal', { word: activeSelection.word }) }}</text>
        </view>

        <view class="reading-para">
          <!-- #ifdef H5 -->
          <view :id="paragraphNavId" class="reading-paragraph-target" data-reading-paragraph-target="" tabindex="-1" role="navigation" :aria-label="t('paragraphNav')"></view>
          <!-- #endif -->
          <button type="button" class="reading-link" data-action="prev" :tabindex="h5TabIndex(safeIndex > 0)" :role="h5ButtonRole()" :aria-disabled="h5AriaDisabled(safeIndex > 0)" :disabled="safeIndex <= 0" @click="moveParagraph(-1)" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateParagraph(-1)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateParagraph(-1)">{{ t('prev') }}</button>
          <text class="reading-meta-text">{{ t('localPosition', { index: safeIndex + 1, count: blocks.length }) }}</text>
          <button type="button" class="reading-link" data-action="next" :tabindex="h5TabIndex(safeIndex < blocks.length - 1)" :role="h5ButtonRole()" :aria-disabled="h5AriaDisabled(safeIndex < blocks.length - 1)" :disabled="safeIndex >= blocks.length - 1" @click="moveParagraph(1)" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="activateParagraph(1)" @keydown.space.stop.prevent @keyup.space.stop.prevent="activateParagraph(1)">{{ t('next') }}</button>
        </view>

        <view v-if="graded" class="reading-check" role="status">
          <view class="reading-check-tile" aria-hidden="true">
            <image class="reading-icon-22" :src="checkSrc" mode="aspectFit" />
          </view>
          <view class="reading-check-copy">
            <text class="reading-check-title">{{ t('comprehensionClosed') }}</text>
            <text class="reading-meta-text">{{ t('comprehensionCount', { count: questionCount }) }}</text>
          </view>
          <image class="reading-mono reading-icon-20" :src="chevRightSrc" mode="aspectFit" alt="" />
        </view>

        <view class="reading-closed" role="status">
          <text>{{ t('writesClosed') }}</text>
          <text>{{ t('noServerReceipt') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.reading-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background-color: var(--yx-surface-page);
  background-image: var(--yx-profile-page-image);
  color: var(--yx-text-primary);
}
.reading-glow {
  position: absolute;
  top: -140px;
  left: 50%;
  width: 540px;
  height: 480px;
  transform: translateX(-50%);
  pointer-events: none;
}
.reading-glow-image {
  width: 540px;
  height: 480px;
}
.reading-canvas {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  padding: 12px 24px 32px;
}
.reading-nav {
  display: flex;
  align-items: center;
  min-height: 52px;
}
.reading-nav-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 17px;
  font-weight: 700;
  line-height: 24px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.reading-hit,
.reading-font,
.reading-toggle,
.reading-link,
.reading-cta,
.reading-word,
.reading-segment-btn {
  margin: 0;
  color: inherit;
  font: inherit;
}
.reading-hit,
.reading-font,
.reading-link,
.reading-cta,
.reading-segment-btn {
  min-width: 44px;
  min-height: 44px;
}
.reading-hit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 22px;
}
.reading-icon-22 { width: 22px; height: 22px; }
.reading-icon-20 { width: 20px; height: 20px; }
.reading-icon-44 { width: 44px; height: 44px; }
.reading-mascot { width: 120px; height: 120px; }
.reading-track { width: 52px; height: 32px; }
.reading-page[data-theme="dark"] .reading-mono,
.reading-page[data-theme="high-contrast"] .reading-mono { filter: invert(1); }
.reading-tools,
.reading-meta,
.reading-progress,
.reading-para,
.reading-check {
  display: flex;
  align-items: center;
  gap: 8px;
}
.reading-tools { margin-top: 8px; }
.reading-tools-gap { flex: 1; }
.reading-font {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  padding: 0;
  font-size: 15px;
  font-weight: 700;
  background: var(--yx-surface-card);
  border: 1px solid var(--yx-border);
  border-radius: 14px;
}
.reading-font-value {
  min-width: 44px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--yx-text-secondary);
  text-align: center;
}
.reading-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 44px;
  padding: 0 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--yx-text-secondary);
  background: transparent;
  border: 0;
}
.reading-card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  margin-top: 16px;
  padding: 22px 24px;
  background: var(--closed-card-bg);
  border: 1px solid var(--closed-card-border);
  border-radius: 28px;
  box-shadow: var(--closed-card-shadow);
}
.reading-card--center {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  text-align: center;
  border-radius: 18px;
}
.reading-state { display: flex; flex-direction: column; gap: 16px; }
.reading-state-title {
  margin-top: 8px;
  font-size: 22px;
  font-weight: 700;
  line-height: 32px;
}
.reading-state-body {
  margin-top: 4px;
  font-size: 15px;
  line-height: 24px;
  color: var(--yx-text-secondary);
}
.reading-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 96px;
  height: 96px;
  border-radius: 48px;
}
.reading-badge--book { background: var(--yx-profile-tile-neutral, #ecedf3); }
.reading-badge--lock { background: #fff6e8; }
.reading-loading {
  margin-top: 24px;
  font-size: 15px;
  line-height: 24px;
}
.reading-tag {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  color: var(--yx-brand);
  background: var(--yx-brand-soft);
  border-radius: 999px;
}
.reading-meta-text {
  font-size: 12px;
  line-height: 18px;
  color: var(--yx-text-secondary);
}
.reading-article-title {
  display: block;
  margin-top: 12px;
  font-size: 24px;
  font-weight: 700;
  line-height: 32px;
  overflow-wrap: anywhere;
}
.reading-progress { margin-top: 12px; }
.reading-bar {
  flex: 1;
  height: 6px;
  overflow: hidden;
  background: var(--yx-brand-soft);
  border-radius: 3px;
}
.reading-bar-fill {
  height: 6px;
  background: var(--yx-brand);
  border-radius: 3px;
}
.reading-page[data-motion="on"] .reading-bar-fill { transition: width var(--yx-motion-fast, 180ms) linear; }
.reading-segment {
  display: flex;
  width: 100%;
  margin-top: 12px;
  padding: 4px;
  background: var(--yx-brand-soft);
  border-radius: 16px;
}
.reading-segment-btn {
  flex: 1;
  height: 44px;
  font-size: 14px;
  font-weight: 500;
  color: var(--yx-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 12px;
}
.reading-segment-btn[aria-pressed="true"] {
  font-weight: 700;
  color: var(--yx-brand);
  background: var(--yx-surface-card);
}
.reading-body {
  display: block;
  margin-top: 16px;
  font-size: var(--reading-body-size);
  line-height: 1.7;
  color: var(--yx-text-primary);
  text-align: left;
  white-space: normal;
  overflow-wrap: anywhere;
}
.reading-space { white-space: pre-wrap; }
.reading-word {
  display: inline;
  min-width: 0;
  min-height: 0;
  margin: 0;
  padding: 0;
  font: inherit;
  line-height: inherit;
  color: inherit;
  text-align: left;
  vertical-align: baseline;
  white-space: normal;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  overflow-wrap: anywhere;
}
.reading-word::after { display: none; border: 0; }
.reading-word[data-selected="true"] {
  text-decoration: underline;
  text-decoration-thickness: 2px;
  text-underline-offset: 0.15em;
  background: var(--yx-brand-soft);
  border: 0;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.reading-translation {
  display: block;
  margin-top: 8px;
  font-size: var(--reading-translation-size);
  line-height: 1.5;
  color: var(--yx-text-secondary);
  overflow-wrap: anywhere;
}
.reading-selection {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 20px;
}
.reading-para { justify-content: space-between; margin-top: 8px; }
.reading-link {
  padding: 12px 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--yx-text-primary);
  text-decoration: underline;
  background: transparent;
  border: 0;
}
.reading-check {
  margin-top: 16px;
  padding: 12px 10px 12px 14px;
  background: var(--closed-card-bg);
  border: 1px solid var(--closed-card-border);
  border-radius: 20px;
}
.reading-check-tile {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--yx-brand-soft);
  border-radius: 14px;
}
.reading-check-copy { flex: 1; min-width: 0; }
.reading-check-title {
  display: block;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}
.reading-closed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 16px;
  padding: 12px 0 8px;
  font-size: 14px;
  line-height: 22px;
  color: var(--yx-text-secondary);
}
.reading-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 14px 20px;
  font-size: 16px;
  font-weight: 700;
  color: var(--closed-cta-on);
  background: var(--closed-cta-background);
  border: 0;
  border-radius: 14px;
  box-shadow: var(--closed-cta-shadow);
}
.reading-hit:focus-visible,
.reading-font:focus-visible,
.reading-toggle:focus-visible,
.reading-link:focus-visible,
.reading-cta:focus-visible,
.reading-word:focus-visible,
.reading-segment-btn:focus-visible {
  outline: 2px solid var(--yx-focus);
  outline-offset: 2px;
}
/* #ifdef H5 */
.reading-word-bypass {
  position: absolute;
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.reading-word-bypass::after,
.reading-word-bypass :deep(button)::after { display: none; border: 0; }
.reading-word-bypass :deep(button) {
  width: 1px;
  height: 1px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  margin: 0;
  overflow: hidden;
  border: 0;
  background: transparent;
  box-shadow: none;
}
.reading-word-bypass:focus,
.reading-word-bypass:focus-visible,
.reading-word-bypass:focus-within {
  position: absolute;
  z-index: 1;
  top: 16px;
  right: 16px;
  left: 16px;
  display: flex;
  align-items: center;
  box-sizing: border-box;
  width: auto;
  height: auto;
  min-width: 44px;
  min-height: 44px;
  margin: 0;
  padding: 3px 0;
  overflow: visible;
  clip: auto;
  white-space: normal;
  color: var(--yx-text-primary);
  background: var(--yx-surface-card);
  border: 2px solid var(--yx-text-primary);
  border-radius: 12px;
  outline: 3px solid var(--yx-focus);
  outline-offset: 2px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.25;
  text-align: left;
  overflow-wrap: anywhere;
  box-shadow: none;
}
.reading-word-bypass:focus :deep(button),
.reading-word-bypass:focus-visible :deep(button),
.reading-word-bypass:focus-within :deep(button) {
  position: relative;
  box-sizing: border-box;
  display: block;
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  height: auto;
  min-width: 0;
  min-height: 0;
  padding: 0 12px;
  margin: 0;
  overflow: visible;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: inherit;
  white-space: normal;
  overflow-wrap: anywhere;
  background: transparent;
  border: 0;
  box-shadow: none;
}
.reading-page[data-theme="high-contrast"] .reading-word-bypass:focus,
.reading-page[data-theme="high-contrast"] .reading-word-bypass:focus-visible,
.reading-page[data-theme="high-contrast"] .reading-word-bypass:focus-within {
  color: var(--yx-text-primary);
  background: var(--yx-surface-page);
  border-color: var(--yx-text-primary);
  outline: 3px solid var(--yx-text-primary);
}
.reading-paragraph-target {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.reading-paragraph-target:focus { outline: none; }
/* #endif */
.reading-page[data-theme="high-contrast"] .reading-tag,
.reading-page[data-theme="high-contrast"] .reading-segment-btn[aria-pressed="true"],
.reading-page[data-theme="high-contrast"] .reading-word[data-selected="true"] {
  color: var(--yx-surface-page);
  background: var(--yx-text-primary);
  border: 1px solid var(--yx-border);
}
.reading-page[data-motion="off"] .reading-bar-fill,
.reading-page[data-motion="reduced"] .reading-bar-fill { transition: none; }
@media (max-width: 359px) {
  .reading-canvas { padding-right: 16px; padding-left: 16px; }
  .reading-card { padding-right: 16px; padding-left: 16px; }
}
@media (min-width: 768px) {
  .reading-canvas { max-width: 720px; padding-right: 32px; padding-left: 32px; }
}
@media (prefers-reduced-motion: reduce) {
  .reading-bar-fill { transition: none; }
}
</style>
