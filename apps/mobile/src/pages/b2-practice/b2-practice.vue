<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import type { PerformanceLevel } from '@englishflow/performance'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import AppIcon from '../../components/AppIcon.vue'
import B10ExerciseCard from '../../components/b10/B10ExerciseCard.vue'
import B10StatusPanel from '../../components/b10/B10StatusPanel.vue'
import type { B10AnswerInput, B10AnswerResult } from '../../domain/b10'
import { acceptSubmission, practiceFeedback, resumeView, showPracticeReward } from '../../domain/practice-loop'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { mobileExperienceEngine, mobileT, setMobileQuality, useMobileExperience } from '../../platform/experience'
import { b10ThemeMode, b10T } from '../../platform/b10-foundation'
import { useB10LearningStore } from '../../stores/b10-learning'
import { consumePendingNavigationQuery, getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

const UNAUTHORIZED_MESSAGE = '请先登录后再继续学习。'
const LEGACY_ALTERNATIVES = ['b2-vocabulary', 'b11-reading', 'b3-grammar'] as const
const legacy = '/static/figma-practice-core/practice-legacy-167-5317'
const offline = '/static/figma-practice-core/practice-dark-offline-270-3004'
const legacyGlow = `${legacy}/397a0e7c-11ea-484c-b1f0-fe1385096df2.svg`
const offlineGlow = `${offline}/a1983f1f-bd1f-459a-b997-caf66ba0137e.svg`
const mascotIcon = `${offline}/619cb08d-1a66-4bfb-a20a-6841b39f7c8f.svg`
const inboxIcon = `${legacy}/855cdefa-2dc7-4b82-82a0-64426fbc7293.svg`
const chevronIcon = `${legacy}/30313a8e-dc17-4dda-be08-c9e542c92f4a.svg`
const alternatives = [
  { page: 'b2-vocabulary', icon: `${legacy}/741a70b6-f6a4-4991-aa48-b3710b4ef763.svg`, tone: 'sentence' },
  { page: 'b11-reading', icon: `${legacy}/c373e119-ee84-4cd7-8139-65db989e503e.svg`, tone: 'meaning' },
  { page: 'b3-grammar', icon: `${legacy}/a99dacf5-be89-4544-b38b-2af9e40ecec8.svg`, tone: 'defense' },
]

const session = useSessionStore()
const store = useB10LearningStore()
const readingRoute = ref(false)
let practiceShowToken = 0
const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const performanceLevel = ref<PerformanceLevel>(mobileExperienceEngine.state.level)
const unsubscribeQuality = mobileExperienceEngine.subscribe((state) => { performanceLevel.value = state.level })
const lastResult = ref<B10AnswerResult | null>(null)
const submitting = ref(false)
const accessGranted = ref(false)
watch(() => session.identityRevision, () => { lastResult.value = null }, { flush: 'sync' })
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const resume = computed(() => resumeView(store.practice))
const exercise = computed(() => {
  const list = store.practice?.exercises ?? []
  if (resume.value.stopped) return null
  const start = Math.max(0, resume.value.index - 1)
  return list.find((item, index) => index >= start && !store.answerResults[String(item.exerciseId)]) ?? null
})
const answeredCount = computed(() => Object.keys(store.answerResults).length)
const answerFeedback = computed(() => lastResult.value ? practiceFeedback({
  correct: lastResult.value.isCorrect,
  savedReceipt: lastResult.value.savedReceipt,
  feedbackText: lastResult.value.feedbackText,
  nextQuestion: lastResult.value.nextQuestion,
  scoreBucket: lastResult.value.scoreBucket,
  received: answeredCount.value,
  total: store.practice?.exercises.length ?? 0,
}) : null)
const finished = computed(() => (store.practice?.exercises.length ?? 0) > 0 && !exercise.value && !resume.value.stopped)
const authKind = computed(() => {
  if (!accessGranted.value) return 'gate'
  if (store.practiceStatus !== 'forbidden') return 'open'
  if (store.practiceMessage === UNAUTHORIZED_MESSAGE) return 'unauthorized'
  if (!store.practiceMessage) return 'gate'
  return 'forbidden'
})
const showGate = computed(() => !accessGranted.value || (store.practiceStatus === 'forbidden' && authKind.value === 'gate'))
const viewState = computed(() => {
  if (!accessGranted.value) return 'gate'
  if (resume.value.stopped) return 'stopped'
  if (exercise.value) return 'exercise'
  if ((store.practice?.exercises.length ?? 0) > 0) return 'finished'
  const status = store.practiceStatus
  if (status === 'loading' || status === 'idle') return 'loading'
  if (status === 'empty') return 'empty'
  if (status === 'forbidden') return authKind.value === 'unauthorized' ? 'unauthorized' : authKind.value === 'gate' ? 'gate' : 'forbidden'
  if (status === 'offline' || status === 'stale' || status === 'error') return 'unavailable'
  return 'unavailable'
})
const showEngineChrome = computed(() => accessGranted.value && (resume.value.stopped || Boolean(exercise.value) || finished.value || store.practiceStatus === 'loading' || store.practiceStatus === 'idle'))
const glowSrc = computed(() => viewState.value === 'unavailable' ? offlineGlow : legacyGlow)

function setPerformance(level: PerformanceLevel): void { setMobileQuality(level) }
function practiceEntryMarked(query: Record<string, string>): boolean {
  return query.entry === 'reading'
}
function takePracticeEntryQuery(): Record<string, string> {
  if (typeof consumePendingNavigationQuery !== 'function') return {}
  return consumePendingNavigationQuery('/pages/b2-practice/b2-practice')
}
function load(): void {
  lastResult.value = null
  if (readingRoute.value && typeof store.loadReadingPractice === 'function') { void store.loadReadingPractice(); return }
  void store.loadPractice()
}
async function answer(value: B10AnswerInput): Promise<void> {
  if (!accessGranted.value || !exercise.value || !acceptSubmission(submitting.value)) return
  submitting.value = true
  try { lastResult.value = await store.submitAnswer(exercise.value.exerciseId, value) }
  finally { submitting.value = false }
}
function checkpoint(): void {
  if (!accessGranted.value || !exercise.value) return
  void store.saveCheckpoint(exercise.value.exerciseId ?? null)
}
function openReport(): void {
  if (!finished.value) return
  getUniRuntime().navigateTo({ url: '/pages/b10-report/b10-report' })
}
function isLegacyAlternative(page: string): page is typeof LEGACY_ALTERNATIVES[number] {
  return (LEGACY_ALTERNATIVES as readonly string[]).includes(page)
}
function openLegacyAlternative(page: string): void {
  if (viewState.value !== 'empty' || !isLegacyAlternative(page)) return
  openUniPage(`/pages/${page}/${page}`)
}
function retryLegacyLoad(): void {
  if (!accessGranted.value || viewState.value !== 'unavailable') return
  load()
}
function backLegacyHome(): void {
  if (viewState.value !== 'unavailable') return
  openUniPage('/pages/home/home')
}
async function reopenLegacyAccess(): Promise<void> {
  const allowed = await ensureMobilePageAccess('/pages/b2-practice/b2-practice')
  accessGranted.value = allowed === true
  if (!allowed || store.practiceStatus === 'empty' || store.practiceStatus === 'forbidden') return
  load()
}
if (typeof onHide === 'function') onHide(() => { practiceShowToken += 1; store.abandonReadingPracticeRead?.() })
onShow(async () => {
  const token = ++practiceShowToken
  const allowed = await ensureMobilePageAccess('/pages/b2-practice/b2-practice')
  if (token !== practiceShowToken) return
  accessGranted.value = allowed === true
  if (!allowed) return
  const query = takePracticeEntryQuery()
  const marked = practiceEntryMarked(query)
  const visible = typeof store.readingPracticeVisible === 'function' && store.readingPracticeVisible()
  if (marked || readingRoute.value || visible) {
    readingRoute.value = true
    if (!marked && visible) return
    load()
    return
  }
  readingRoute.value = false
  load()
})
onUnmounted(() => { unsubscribeQuality() })
</script>

<template>
  <view class="yx-page practice-legacy" :class="themeClass" :data-performance="performanceLevel" :data-state="viewState" :data-resolved-theme="theme" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="practice-glow" aria-hidden="true"><image class="practice-glow__img" :src="glowSrc" mode="aspectFit" /></view>
    <view class="practice-shell">
      <MobilePageHeader page="b2-practice" kicker="" :title="mobileT('pages.b2-practice.short')" :description="mobileT('pages.b2-practice.title')" />
      <B10StatusPanel v-if="showEngineChrome" class="v2-b2p-status" :status="store.practiceStatus" :message="store.practiceMessage" :performance-level="performanceLevel" @retry="load" @performance="setPerformance" />

      <view v-if="showGate" class="practice-glass practice-state" data-panel="gate" role="status">
        <text class="practice-state__title">{{ b10T('status.forbidden') }}</text>
        <text class="practice-state__body">{{ mobileT('pages.forbidden.description') }}</text>
        <button type="button" class="practice-link" tabindex="0" @click="reopenLegacyAccess">{{ b10T('status.login') }}</button>
      </view>
      <view v-else-if="resume.stopped" class="yx-card v2-b2p-card card" role="status" data-offline-exit>
        <view class="v2-b2p-eyebrow eyebrow"><AppIcon name="alert" :size="14" /><text>练习状态</text></view>
        <text class="v2-b2p-title">{{ resume.copy }}</text>
      </view>
      <view v-else-if="exercise" class="yx-card b10-practice-card v2-b2p-card card" data-panel="exercise">
        <view class="v2-b2p-eyebrow eyebrow"><AppIcon name="target" :size="14" /><text data-resume>{{ resume.copy }}</text></view>
        <view class="b10-practice-card__progress v2-b2p-meta meta"><text>{{ answeredCount }} / {{ store.practice?.exercises.length ?? 0 }}</text><text>{{ exercise.questionType }}</text></view>
        <B10ExerciseCard :exercise="exercise" :disabled="store.practiceStatus === 'loading' || submitting" data-single-submit @answer="answer" />
        <view class="b10-practice-card__actions v2-b2p-actions row">
          <button tabindex="0" role="button" class="yx-button yx-button--secondary v2-b2p-btn btn" type="button" @click="checkpoint">{{ b10T('practice.checkpoint') }}</button>
          <button tabindex="0" role="button" v-if="lastResult" class="yx-button yx-button--secondary v2-b2p-btn btn" type="button" @click="lastResult = null">{{ b10T('practice.next') }}<AppIcon name="chev" :size="14" /></button>
        </view>
        <view v-if="answerFeedback" class="b10-result v2-b2p-fb fb" role="alert">
          <text class="b10-result__title v2-b2p-title">{{ lastResult?.isCorrect === true ? '规则命中' : lastResult?.isCorrect === false ? '需要修复' : '' }}</text>
          <text v-if="lastResult?.scoringStatus" class="v2-b2p-d d">{{ lastResult.scoringStatus }}</text>
          <text data-save-receipt class="v2-b2p-d d">{{ answerFeedback.savedReceipt }}</text>
          <text data-feedback-text class="v2-b2p-d d">{{ answerFeedback.feedbackText }}</text>
          <text data-next-question class="v2-b2p-d d">{{ answerFeedback.nextQuestion }}</text>
          <text v-if="lastResult?.contentVersionStale" class="b10-result__stale v2-b2p-d d">{{ b10T('common.stale') }}</text>
        </view>
      </view>
      <view v-else-if="finished" class="yx-card v2-b2p-card card" data-panel="finished">
        <text v-if="!showPracticeReward()" data-reward-hidden class="v2-b2p-d d">本次练习已完成。</text>
        <button tabindex="0" role="button" class="yx-button v2-b2p-btn v2-b2p-submit btn" type="button" @click="openReport">{{ b10T('practice.complete') }}<AppIcon name="chev" :size="14" /></button>
      </view>
      <view v-else-if="store.practiceStatus === 'loading' || store.practiceStatus === 'idle'" class="yx-card b10-empty v2-b2p-card card" data-panel="loading">
        <view class="v2-b2p-eyebrow eyebrow"><AppIcon name="refresh" :size="14" /><text>加载中</text></view>
        <text class="v2-b2p-d d">{{ b10T('practice.loading') }}</text>
      </view>
      <view v-else-if="store.practiceStatus === 'empty'" data-panel="empty">
        <view class="practice-glass practice-retired" role="status">
          <view class="practice-badge" aria-hidden="true"><image :src="inboxIcon" mode="aspectFit" /></view>
          <text class="practice-retired__title">{{ mobileT('legacyPracticePage.retiredTitle') }}</text>
          <text class="practice-retired__body">{{ mobileT('legacyPracticePage.retiredBody') }}</text>
          <text v-if="store.practiceMessage" class="practice-retired__note">{{ store.practiceMessage }}</text>
        </view>
        <view class="practice-glass practice-alts">
          <view class="practice-alts__head">
            <text class="practice-alts__title">{{ mobileT('practiceHeading') }}</text>
            <text class="practice-alts__note">{{ mobileT('practiceNote') }}</text>
          </view>
          <button v-for="item in alternatives" :key="item.page" type="button" class="practice-alt" tabindex="0" @click="openLegacyAlternative(item.page)">
            <view class="practice-alt__icon" :class="`practice-alt__icon--${item.tone}`" aria-hidden="true"><image :src="item.icon" mode="aspectFit" /></view>
            <view class="practice-alt__copy">
              <text class="practice-alt__title">{{ mobileT(`pages.${item.page}.short`) }}</text>
              <text class="practice-alt__desc">{{ mobileT(`pages.${item.page}.description`) }}</text>
            </view>
            <image class="practice-chevron" :src="chevronIcon" mode="aspectFit" aria-hidden="true" />
          </button>
        </view>
      </view>
      <view v-else-if="authKind === 'unauthorized'" class="practice-glass practice-state" data-panel="unauthorized" role="status">
        <text class="practice-state__title">{{ mobileT('pages.login.short') }}</text>
        <text class="practice-state__body">{{ store.practiceMessage }}</text>
        <button type="button" class="practice-link" tabindex="0" @click="reopenLegacyAccess">{{ b10T('status.login') }}</button>
      </view>
      <view v-else-if="authKind === 'forbidden'" class="practice-glass practice-state" data-panel="forbidden" role="status">
        <text class="practice-state__title">{{ b10T('status.forbidden') }}</text>
        <text class="practice-state__body">{{ store.practiceMessage || b10T('status.forbidden') }}</text>
      </view>
      <view v-else class="practice-spacer-wrap" data-panel="unavailable">
        <view class="practice-spacer" aria-hidden="true" />
        <view class="practice-glass practice-state" role="status">
          <image class="practice-mascot" :src="mascotIcon" mode="aspectFit" />
          <text class="practice-state__title">{{ mobileT('legacyPracticePage.unavailableTitle') }}</text>
          <text class="practice-state__body">{{ store.practiceMessage || mobileT('legacyPracticePage.unavailableBody') }}</text>
          <button type="button" class="practice-retry" tabindex="0" @click="retryLegacyLoad">{{ b10T('status.retry') }}</button>
          <button type="button" class="practice-link" tabindex="0" @click="backLegacyHome">{{ mobileT('legacyPracticePage.backHome') }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.b10-practice-card{display:grid;gap:18rpx}.b10-practice-card__progress,.b10-practice-card__actions{display:flex;align-items:center;justify-content:space-between;gap:12rpx;color:var(--yx-text-secondary);font-size:23rpx}.b10-practice-card__actions{align-items:stretch}.b10-practice-card__actions .yx-button{flex:1}.b10-result{display:grid;gap:8rpx;padding:18rpx;border:1rpx solid var(--yx-success-border);border-radius:14rpx;background:var(--yx-success-soft);color:var(--yx-text-secondary);font-size:23rpx;line-height:1.5}.b10-result__title{color:var(--yx-success-strong);font-size:30rpx;font-weight:750}.b10-result__stale{color:var(--yx-warning-strong)}.b10-empty{display:grid;gap:16rpx;color:var(--yx-text-secondary);font-size:24rpx}.b10-empty__title{color:var(--yx-text-primary);font-size:32rpx;font-weight:750}
.practice-legacy.yx-page { position: relative; overflow-x: clip; padding-inline: 24px; padding-bottom: calc(112px + env(safe-area-inset-bottom)); background-color: var(--yx-r4-page-color, var(--yx-surface-page)); background-image: var(--yx-profile-page-image); }
.practice-shell { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; width: 100%; max-width: 720px; margin: 0 auto; }
.practice-glow { position: absolute; left: 150px; top: -140px; width: 360px; height: 300px; pointer-events: none; }
.practice-glow__img { position: absolute; inset: -30% -25%; width: 150%; height: 160%; }
.practice-legacy[data-motion="reduced"] .practice-glow,
.practice-legacy[data-motion="off"] .practice-glow,
.practice-legacy[data-resolved-theme="high-contrast"] .practice-glow,
.practice-legacy[data-performance="Performance"] .practice-glow { display: none; }
.practice-glass { position: relative; overflow: hidden; border: 1px solid var(--yx-profile-glass-border); background: var(--yx-profile-glass); box-shadow: var(--yx-profile-card-shadow), var(--yx-settings-card-inset, none); backdrop-filter: blur(var(--yx-profile-blur)); }
.practice-retired { display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 20px; border-radius: 24px; text-align: center; }
.practice-badge { display: flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: 28px; background: var(--yx-surface-page); }
.practice-badge image { width: 26px; height: 26px; }
.practice-retired__title { color: var(--yx-text-primary); font-size: 17px; font-weight: 700; line-height: 24px; }
.practice-retired__body, .practice-retired__note { color: var(--yx-text-secondary); font-size: 14px; line-height: 22px; }
.practice-alts { display: flex; flex-direction: column; margin-top: 16px; padding: 14px 20px 8px; border-radius: 24px; }
.practice-alts__head { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 2px 0; }
.practice-alts__title { color: var(--yx-text-primary); font-size: 18px; font-weight: 700; line-height: 26px; }
.practice-alts__note { color: var(--yx-text-tertiary); font-size: 13px; line-height: 20px; }
.practice-legacy.yx-page button.practice-alt { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 56px; margin: 0; padding: 10px 0; border: 0; background: transparent; color: var(--yx-text-primary); font: inherit; line-height: 1.4; text-align: left; white-space: normal; }
.practice-alt__icon { display: flex; flex: 0 0 44px; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; }
.practice-alt__icon image { width: 22px; height: 22px; }
.practice-alt__icon--sentence { background-image: linear-gradient(128.66deg, var(--games-tile-sentence-from) 7.4%, var(--games-tile-sentence-to) 81.5%); }
.practice-alt__icon--meaning { background-image: linear-gradient(128.66deg, var(--games-tile-meaning-from) 7.4%, var(--games-tile-meaning-to) 81.5%); }
.practice-alt__icon--defense { background-image: linear-gradient(128.66deg, var(--games-tile-defense-from) 7.4%, var(--games-tile-defense-to) 81.5%); }
.practice-alt__copy { display: flex; flex: 1 1 auto; flex-direction: column; gap: 2px; min-width: 0; }
.practice-alt__title { color: var(--yx-text-primary); font-size: 15px; font-weight: 700; line-height: 22px; }
.practice-alt__desc { color: var(--yx-text-tertiary); font-size: 13px; line-height: 18px; }
.practice-chevron { flex: 0 0 20px; width: 20px; height: 20px; }
.practice-spacer { height: 30px; }
.practice-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; border-radius: 18px; text-align: center; }
.practice-mascot { width: 120px; height: 120px; }
.practice-state__title { color: var(--yx-text-primary); font-size: 22px; font-weight: 700; line-height: 32px; }
.practice-state__body { color: var(--yx-text-secondary); font-size: 15px; line-height: 24px; }
.practice-legacy.yx-page button.practice-retry { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; margin: 0; padding: 14px 20px; border: 0; border-radius: 14px; background-color: var(--yx-r4-cta-color); background-image: var(--yx-r4-cta-image); color: var(--yx-r4-on-cta); box-shadow: var(--closed-cta-shadow, var(--yx-profile-cta-shadow, none)); font: inherit; font-size: 16px; font-weight: 700; }
.practice-legacy.yx-page button.practice-link { display: flex; align-items: center; justify-content: center; width: auto; min-height: 44px; margin: 0; padding: 12px 8px; border: 0; background: transparent; color: var(--yx-brand); font: inherit; font-size: 14px; font-weight: 650; }
.v2-b2p-status{display:grid;gap:var(--v2-space-2);font-family:var(--v2-font)}
.v2-b2p-card{display:grid;gap:var(--v2-space-2);padding:var(--v2-space-5);border:1px solid var(--v2-line);border-radius:var(--v2-radius-lg);background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-b2p-eyebrow{display:flex;align-items:center;gap:var(--v2-space-2);margin:0 0 var(--v2-space-2);color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700}
.v2-b2p-title{display:block;margin:var(--v2-space-1) 0 0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-lg);font-weight:700;line-height:1.45}
.v2-b2p-meta{display:flex;justify-content:space-between;align-items:center;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.7}
.v2-b2p-actions{display:flex;align-items:stretch;gap:var(--v2-space-2)}
.v2-b2p-actions .v2-b2p-btn{flex:1}
.practice-legacy.yx-page button.v2-b2p-btn{box-sizing:border-box;display:flex;align-items:center;justify-content:center;width:100%;min-height:44px;margin-top:0;padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5}
.practice-legacy.yx-page button.v2-b2p-submit{border-color:transparent;background:var(--v2-brand);color:var(--v2-inverse);font-weight:700}
.v2-b2p-d{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.7}
@media (max-width: 359px) {
  .practice-legacy.yx-page { padding-inline: 16px; }
}
@media (min-width: 768px) {
  .practice-legacy.yx-page { padding-inline: 24px; }
}
</style>
