<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileExperienceEngine, mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { mapVocabularyPage, type VocabularyNotice, type VocabularyPageView } from '../../domain/vocabulary-page'
import { useB10LearningStore } from '../../stores/b10-learning'
import { useSessionStore } from '../../stores/session'
import { b10ContentLocale, b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { getUniRuntime, openUniPage, type UniAudioContext } from '../../platform/uni-runtime'
import { currentMobilePagePath, ensureMobilePageAccess } from '../../auth/navigation'
import { vocabPlayable } from '../../domain/closed-practice'

const store = useB10LearningStore()
const session = useSessionStore()
const asset = {
  chev: '/static/figma-vocabulary-core/vocab-front-167-6151/56241daf-28ee-4ed6-95c7-f9e8a7ab7eac.svg',
  glowFront: '/static/figma-vocabulary-core/vocab-front-167-6151/5049469a-71df-4f14-a6d6-5578f1ef0e8f.svg',
  volume: '/static/figma-vocabulary-core/vocab-front-167-6151/603828ac-fbae-4fc2-9643-8185f44cd4c8.svg',
  dot: '/static/figma-vocabulary-core/vocab-front-167-6151/8c893a6b-672e-4bd2-a608-b76b63a49ad8.svg',
  glowBack: '/static/figma-vocabulary-core/vocab-back-167-6396/123337de-a571-469c-81d7-46d763dd9135.svg',
  volumeBack: '/static/figma-vocabulary-core/vocab-back-167-6396/3fdb6f26-b853-4e11-9dd7-c3d983d7ec85.svg',
  calendar: '/static/figma-vocabulary-core/vocab-back-167-6396/105f1e1d-8a0b-4bbb-802d-f0280a27c185.svg',
  volumeX: '/static/figma-vocabulary-core/vocab-audio-167-6316/5d4371f4-7ffa-4533-bd86-2e0c20b19328.svg',
  glowAudio: '/static/figma-vocabulary-core/vocab-audio-167-6316/6604364c-8fb0-4ad6-9be2-15dda01af4e1.svg',
  glowDone: '/static/figma-vocabulary-core/vocab-complete-167-6927/c6ec15d8-f987-40a0-9cda-232e90222e5e.svg',
  track: '/static/figma-vocabulary-core/vocab-complete-167-6927/c9666ad3-f22f-44ae-b401-37f1e5c2fdc0.svg',
  arc: '/static/figma-vocabulary-core/vocab-complete-167-6927/5f5a80c3-c2ea-4eea-9403-c7b2634b6bb0.svg',
  chart: '/static/figma-vocabulary-core/vocab-complete-167-6927/ec034b5f-f7ea-4dbb-b837-35d2943c09b3.svg',
  chevR: '/static/figma-vocabulary-core/vocab-complete-167-6927/a4cfe528-73e0-4035-9e86-be19a2826e43.svg',
  list: '/static/figma-vocabulary-core/vocab-complete-167-6927/b9a6b0b4-7e51-482f-af9d-271990e14dd4.svg',
  dotDone: '/static/figma-vocabulary-core/vocab-complete-167-6927/d802b28d-9a6e-4900-990a-6135ceb64f42.svg',
  dotDoneAlt: '/static/figma-vocabulary-core/vocab-complete-167-6927/c27a197c-0abe-4272-a96e-29532bb973a6.svg',
}
const ratingOptions = [
  { value: 0 as const, zh: '忘了', en: 'Forgot', tone: 'bad' },
  { value: 1 as const, zh: '模糊', en: 'Unsure', tone: 'warn' },
  { value: 2 as const, zh: '记得', en: 'Remember', tone: 'brand' },
  { value: 3 as const, zh: '很熟', en: 'Known', tone: 'ok' },
]
const doneCopy = { zh: '今日复习已完成', en: "Today's review is complete" }
const contentLocale = b10ContentLocale
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const audioFailed = ref(false)
const ownerRevision = ref(0)
const qualityLevel = ref(mobileExperienceEngine.state.level)
let generation = 0
let audio: UniAudioContext | null = null
let audioCardId: string | null = null
let stoppingAudio = false

const VOCAB_ROUTE = '/pages/b2-vocabulary/b2-vocabulary'
const frontGate = ref('')
const frontBlocked = ref(false)
let presentEpoch = 0
// Visibility only. A pre-auth identity revision bump must not retire this show.
let showEpoch = 0

function onVocabularyRoute(): boolean {
  if (typeof window !== 'undefined' && window.location) {
    const raw = window.location.hash.replace(/^#/, '').trim()
    const path = raw.split(/[?#]/, 1)[0] ?? ''
    // Canonical Home is `#/`. The shared helper treats that hash as missing and would trust a stale native stack.
    if (path === '/') return false
  }
  return currentMobilePagePath('') === VOCAB_ROUTE
}

const view = computed(() => {
  if (!onVocabularyRoute()) {
    return mapVocabularyPage({ status: 'idle', batchStatus: null, items: [], current: null, queueCount: 0, message: null })
  }
  const current = store.currentCard
  const holdFront = Boolean(current && current.revealed !== true && frontGate.value !== current.id)
  const visibleCurrent = current && holdFront
    ? { ...current, title: null, phonetic: null, phoneticUs: null, phoneticUk: null, audio: null, audioUrl: null, hint: null, meaningCn: null, definitionEn: null, examples: [], exampleItems: [], revealed: false }
    : current
  return mapVocabularyPage({
    status: store.status,
    batchStatus: store.batch?.status ?? null,
    reasonCode: store.batch?.reasonCode ?? null,
    items: store.batch?.items ?? [],
    current: visibleCurrent,
    queueCount: store.srsQueueCount,
    message: store.message,
    audioFailed: audioFailed.value,
    frontPending: holdFront && !frontBlocked.value && (store.status === 'ready' || store.status === 'loading'),
    frontBlocked: frontBlocked.value && holdFront,
  })
})
const completed = computed(() => view.value.completed)
const doneTitle = computed(() => uiEnglish() ? doneCopy.en : doneCopy.zh)
const statusFlags = computed(() => ({
  idle: store.status === 'idle',
  loading: store.status === 'loading',
  empty: store.status === 'empty',
  offline: store.status === 'offline',
  forbidden: store.status === 'forbidden',
  stale: store.status === 'stale',
}))
const progressPercent = computed(() => view.value.totalCount > 0 ? Math.round((view.value.acceptedCount / view.value.totalCount) * 100) : 0)
const glowSrc = computed(() => {
  if (view.value.phase === 'complete') return asset.glowDone
  if (view.value.phase === 'back') return asset.glowBack
  if (view.value.audioMode !== 'play') return asset.glowAudio
  return asset.glowFront
})
const volumeSrc = computed(() => {
  if (view.value.audioMode !== 'play') return asset.volumeX
  return view.value.phase === 'back' ? asset.volumeBack : asset.volume
})

function uiEnglish(): boolean { return String(b10UiLocale.value).toLowerCase().startsWith('en') }
function ratingLabel(option: (typeof ratingOptions)[number]): string { return uiEnglish() ? option.en : option.zh }
function sourceText(page: VocabularyPageView): string {
  if (page.source === 'new') return mobileT('vocabularyPage.sourceNew')
  if (page.source === 'review') return mobileT('vocabularyPage.sourceReview')
  return ''
}
function masteryText(page: VocabularyPageView): string {
  if (page.mastery === 'new') return mobileT('vocabularyPage.masteryNew')
  if (page.mastery === 'learning') return mobileT('vocabularyPage.masteryLearning')
  if (page.mastery === 'mastered') return mobileT('vocabularyPage.masteryMastered')
  if (page.mastery === 'hold') return mobileT('vocabularyPage.masteryHold')
  return ''
}
function noticeStem(notice: VocabularyNotice): string {
  if (notice === 'recovery') return 'recovery'
  if (notice === 'untrusted') return 'untrusted'
  if (notice === 'queued') return 'queued'
  if (notice === 'offline') return 'offline'
  if (notice === 'forbidden') return 'forbidden'
  if (notice === 'stale') return 'stale'
  if (notice === 'failed') return 'failed'
  if (notice === 'missing-version') return 'missingVersion'
  if (notice === 'missing-snapshot') return 'missingSnapshot'
  if (notice === 'submitting') return 'submitting'
  if (notice === 'none') return 'idle'
  return 'error'
}
function noticeTitle(notice: VocabularyNotice): string { return mobileT(`vocabularyPage.${noticeStem(notice)}Title`) }
function noticeBody(notice: VocabularyNotice): string { return mobileT(`vocabularyPage.${noticeStem(notice)}Body`) }
function tipTitle(page: VocabularyPageView): string {
  if (page.phase === 'back') return mobileT('vocabularyPage.tipRateTitle')
  if (page.audioMode !== 'play') return mobileT('vocabularyPage.tipSilentTitle')
  return mobileT('vocabularyPage.tipRecallTitle')
}
function tipBody(page: VocabularyPageView): string {
  if (page.phase === 'back') return mobileT('vocabularyPage.tipRateBody')
  if (page.audioMode !== 'play') return mobileT('vocabularyPage.tipSilentBody')
  return mobileT('vocabularyPage.tipRecallBody')
}
function sameOwner(request: number, revision: number): boolean {
  return request === generation && revision === session.identityRevision
}
function stopAudio(): void {
  if (stoppingAudio) return
  stoppingAudio = true
  const current = audio
  audio = null
  audioCardId = null
  try {
    const stopper = current as (UniAudioContext & { stop?: () => void }) | null
    if (stopper && typeof stopper.stop === 'function') stopper.stop()
    current?.pause()
    current?.destroy()
  } catch { /* The adapter may already be gone. */ }
  finally { stoppingAudio = false }
}
function cardAudioUrl(): string | null {
  const card = store.currentCard
  if (!card) return null
  if (typeof card.audioUrl === 'string' && vocabPlayable(card.audioUrl)) return card.audioUrl
  if (card.revealed !== true) return null
  const nested = card.audio?.us ?? card.audio?.uk ?? null
  return typeof nested === 'string' && vocabPlayable(nested) ? nested : null
}
function playAudio(): void {
  if (view.value.audioMode !== 'play') return
  const card = store.currentCard
  const src = cardAudioUrl()
  const request = generation
  const revision = session.identityRevision
  if (!card || typeof src !== 'string' || !vocabPlayable(src) || !sameOwner(request, revision)) return
  stopAudio()
  if (!sameOwner(request, revision) || view.value.audioMode !== 'play') return
  const context = getUniRuntime().createInnerAudioContext?.()
  if (!context) { audioFailed.value = true; return }
  audio = context
  audioCardId = card.id
  const candidate = context as UniAudioContext & { onError?: (callback: () => void) => void }
  if (typeof candidate.onError === 'function') {
    candidate.onError(() => {
      if (audioCardId !== card.id) return
      audioFailed.value = true
      stopAudio()
    })
  }
  try {
    context.src = src
    context.play()
  } catch {
    audioFailed.value = true
    stopAudio()
  }
}
function retryAudio(): void {
  audioFailed.value = false
  playAudio()
}
function reveal(): void {
  if (!view.value.revealEnabled) return
  if (!onVocabularyRoute()) return
  const request = generation
  const revision = session.identityRevision
  const epoch = presentEpoch
  void store.revealCard().then(() => {
    if (!sameOwner(request, revision) || epoch !== presentEpoch || !onVocabularyRoute()) return
    ownerRevision.value = session.identityRevision
  })
}
function rate(value: 0 | 1 | 2 | 3): void {
  if (!view.value.ratingEnabled) return
  if (!onVocabularyRoute()) return
  stopAudio()
  const request = generation
  const revision = session.identityRevision
  const epoch = presentEpoch
  void store.rateCard(value).then(() => {
    if (!sameOwner(request, revision) || epoch !== presentEpoch || !onVocabularyRoute()) return
    ownerRevision.value = session.identityRevision
  })
}
function clearFrontPresentation(): number {
  presentEpoch += 1
  frontGate.value = ''
  frontBlocked.value = false
  stopAudio()
  audioFailed.value = false
  return presentEpoch
}
async function presentFront(request: number, revision: number, epoch: number): Promise<void> {
  const card = store.currentCard
  if (!sameOwner(request, revision) || epoch !== presentEpoch || !onVocabularyRoute()) return
  if (!card || store.status !== 'ready' || store.batch?.status === 'RECOVERY_REQUIRED') return
  if (card.revealed === true) {
    if (epoch === presentEpoch && onVocabularyRoute()) frontGate.value = card.id
    return
  }
  await store.loadCurrentFront(card)
  if (!sameOwner(request, revision) || epoch !== presentEpoch || !onVocabularyRoute() || store.currentCard?.id !== card.id) return
  if (store.status !== 'ready') {
    frontBlocked.value = true
    frontGate.value = ''
    return
  }
  frontBlocked.value = false
  frontGate.value = card.id
}
function verifiedOwner(): { subject: string; revision: number } | null {
  if (session.isAuthenticated !== true) return null
  const identity = session.getMobileApiIdentity()
  if (!identity?.subject) return null
  return { subject: identity.subject, revision: identity.revision }
}
async function reloadOwned(activeEpoch: number, owner: { subject: string; revision: number } | null): Promise<void> {
  if (activeEpoch !== showEpoch || !onVocabularyRoute() || !owner) return
  const request = ++generation
  const revision = owner.revision
  clearFrontPresentation()
  if (activeEpoch !== showEpoch || !onVocabularyRoute() || !sameOwner(request, revision)) return
  const current = verifiedOwner()
  if (!current || current.subject !== owner.subject || current.revision !== revision) return
  await store.loadSrs()
  if (!sameOwner(request, revision) || activeEpoch !== showEpoch || !onVocabularyRoute()) return
  await presentFront(request, revision, presentEpoch)
  if (!sameOwner(request, revision) || activeEpoch !== showEpoch || !onVocabularyRoute()) return
  ownerRevision.value = revision
}
async function reload(): Promise<void> {
  await reloadOwned(showEpoch, verifiedOwner())
}
function syncQueue(): void {
  if (!view.value.syncWaiting) return
  const request = generation
  const revision = session.identityRevision
  void store.syncSrs().then(() => {
    if (!sameOwner(request, revision)) return
    ownerRevision.value = session.identityRevision
  })
}
function open(path: string): void { openUniPage(path) }

watch(() => `${store.batch?.snapshotId ?? ''}:${store.currentCard?.id ?? ''}:${store.batch?.status ?? ''}`, (next, previous) => {
  if (previous === undefined || next === previous) return
  const epoch = clearFrontPresentation()
  const request = generation
  const revision = session.identityRevision
  if (!onVocabularyRoute() || store.status !== 'ready') return
  void presentFront(request, revision, epoch)
}, { flush: 'sync' })
watch(() => session.identityRevision, () => {
  generation += 1
  presentEpoch += 1
  frontGate.value = ''
  frontBlocked.value = false
  stopAudio()
  audioFailed.value = false
  ownerRevision.value = session.identityRevision
}, { flush: 'sync' })

const unsubscribeQuality = mobileExperienceEngine.subscribe((state) => { qualityLevel.value = state.level })
onShow(async () => {
  const epoch = ++showEpoch
  const prior = verifiedOwner()
  const allowed = await ensureMobilePageAccess(VOCAB_ROUTE)
  if (epoch !== showEpoch || !allowed || !onVocabularyRoute()) return
  const owner = verifiedOwner()
  if (!owner) return
  if (prior && (prior.subject !== owner.subject || prior.revision !== owner.revision)) return
  ownerRevision.value = owner.revision
  await reloadOwned(epoch, owner)
})
onHide(() => { showEpoch += 1; generation += 1; clearFrontPresentation() })
onUnmounted(() => { showEpoch += 1; generation += 1; clearFrontPresentation(); unsubscribeQuality() })
</script>

<template>
  <view
    class="yx-page vocab-page"
    :class="themeClass"
    :style="experienceStyle"
    :data-motion="experienceMotion"
    :data-content-locale="contentLocale"
    data-c2-dependency="front"
    :data-owner-revision="ownerRevision"
    :data-quality="qualityLevel"
    :data-phase="view.phase"
    :data-front-missing="view.frontMissing ? 'true' : 'false'"
    :data-idle="statusFlags.idle"
    :data-loading="statusFlags.loading"
    :data-empty="statusFlags.empty"
    :data-offline="statusFlags.offline"
    :data-forbidden="statusFlags.forbidden"
    :data-stale="statusFlags.stale"
    :aria-busy="statusFlags.loading"
  >
    <image v-if="experienceMotion !== 'off'" class="vocab-glow" :src="glowSrc" mode="aspectFit" aria-hidden="true" />
    <MobilePageHeader page="b2-vocabulary" compact :title="mobileT('vocabularyPage.navTitle')" :show-settings="false" :back-icon-src="asset.chev" />

    <view class="vocab-body">
      <view v-if="view.totalCount > 0" class="vocab-progress">
        <text class="vocab-progress-label">{{ mobileT('vocabularyPage.progressDone') }} {{ view.acceptedCount }} / {{ view.totalCount }}</text>
        <view class="vocab-track" aria-hidden="true"><view class="vocab-track-fill" :style="{ width: progressPercent + '%' }"></view></view>
      </view>

      <view v-if="view.phase === 'front' || view.phase === 'back'" class="vocab-card vocab-glass">
        <view v-if="view.notice !== 'none'" class="vocab-notice" role="status">
          <text class="vocab-title">{{ noticeTitle(view.notice) }}</text>
          <text class="vocab-copy">{{ noticeBody(view.notice) }}</text>
        </view>
        <view class="vocab-meta">
          <text v-if="masteryText(view)" class="vocab-tag">{{ masteryText(view) }}</text>
          <text v-if="sourceText(view) && sourceText(view) !== masteryText(view)" class="vocab-source">{{ sourceText(view) }}</text>
        </view>
        <view v-if="view.phase === 'back'" class="vocab-back-head">
          <text v-if="view.frontTitle" class="vocab-word">{{ view.frontTitle }}</text>
          <text v-if="view.phonetic" class="vocab-phonetic">{{ view.phonetic }}</text>
          <view class="vocab-grow"></view>
          <button v-if="view.audioMode === 'play'" tabindex="0" role="button" class="vocab-icon-button" type="button" :aria-label="mobileT('vocabularyPage.playAudio')" @click="playAudio">
            <image class="vocab-icon" :src="volumeSrc" mode="aspectFit" aria-hidden="true" />
          </button>
          <view v-else class="vocab-silent-mark" aria-hidden="true"><image class="vocab-icon" :src="volumeSrc" mode="aspectFit" /></view>
        </view>
        <template v-else>
          <text v-if="view.frontTitle" class="vocab-word">{{ view.frontTitle }}</text>
          <view v-else class="vocab-missing">
            <text class="vocab-title">{{ mobileT('vocabularyPage.missingFrontTitle') }}</text>
            <text class="vocab-copy">{{ mobileT('vocabularyPage.missingFrontBody') }}</text>
          </view>
          <view class="vocab-sound-row">
            <text v-if="view.phonetic" class="vocab-phonetic">{{ view.phonetic }}</text>
            <button v-if="view.audioMode === 'play'" tabindex="0" role="button" class="vocab-icon-button" type="button" :aria-label="mobileT('vocabularyPage.playAudio')" @click="playAudio">
              <image class="vocab-icon" :src="volumeSrc" mode="aspectFit" aria-hidden="true" />
            </button>
            <view v-else class="vocab-silent-mark" aria-hidden="true"><image class="vocab-icon" :src="volumeSrc" mode="aspectFit" /></view>
          </view>
        </template>
        <view v-if="view.audioMode !== 'play'" class="vocab-silent">
          <text class="vocab-copy">{{ view.audioMode === 'failed' ? mobileT('vocabularyPage.audioFailed') : mobileT('vocabularyPage.noAudio') }}</text>
          <button v-if="view.audioMode === 'failed'" tabindex="0" role="button" class="vocab-retry" type="button" @click="retryAudio">{{ mobileT('vocabularyPage.retryAudio') }}</button>
        </view>
        <view v-if="view.showAnswer" class="vocab-answer">
          <text class="vocab-meaning">{{ view.meaning ?? mobileT('vocabularyPage.noMeaning') }}</text>
          <text v-if="view.definition" class="vocab-copy">{{ view.definition }}</text>
          <view v-if="view.examples && view.examples.length" class="vocab-examples">
            <view v-for="(example, index) in view.examples" :key="index" class="vocab-example">
              <text v-if="example.sentenceEn" class="vocab-copy">{{ example.sentenceEn }}</text>
              <text v-if="example.sentenceCn" class="vocab-copy">{{ example.sentenceCn }}</text>
            </view>
          </view>
          <view v-if="view.due" class="vocab-due">
            <image class="vocab-due-icon" :src="asset.calendar" mode="aspectFit" aria-hidden="true" />
            <text class="vocab-copy">{{ mobileT('vocabularyPage.nextReview') }} {{ view.due }}</text>
          </view>
        </view>
      </view>

      <view v-if="view.phase === 'front' || view.phase === 'back'" class="vocab-tip">
        <view class="vocab-tip-row">
          <image class="vocab-dot" :src="asset.dot" mode="aspectFit" aria-hidden="true" />
          <text class="vocab-tip-title">{{ tipTitle(view) }}</text>
        </view>
        <text class="vocab-copy">{{ tipBody(view) }}</text>
      </view>

      <view v-else-if="completed" class="vocab-done">
        <button tabindex="0" role="button" class="vocab-report-shortcut" type="button" @click="open('/pages/b10-report/b10-report')">{{ mobileT('vocabularyPage.reportCta') }}</button>
        <view class="vocab-hero">
          <view class="vocab-hero-copy">
            <text class="vocab-kicker">{{ mobileT('vocabularyPage.doneKicker') }}</text>
            <text class="vocab-title">{{ doneTitle }}</text>
            <text class="vocab-copy">{{ mobileT('vocabularyPage.doneBody') }}</text>
          </view>
          <view class="vocab-ring" aria-hidden="true">
            <image class="vocab-ring-art" :src="asset.track" mode="aspectFit" />
            <image class="vocab-ring-art" :src="asset.arc" mode="aspectFit" />
            <text class="vocab-count">{{ view.acceptedCount }} / {{ view.totalCount }}</text>
            <text class="vocab-copy">{{ mobileT('vocabularyPage.reviewed') }}</text>
          </view>
        </view>
        <view v-if="view.notice !== 'none'" class="vocab-notice vocab-receipt" role="status">
          <text class="vocab-title">{{ noticeTitle(view.notice) }}</text>
          <text class="vocab-copy">{{ noticeBody(view.notice) }}</text>
        </view>
        <view class="vocab-next">
          <button tabindex="0" role="button" class="vocab-link" type="button" @click="open('/pages/assessment/assessment')">
            <image class="vocab-link-icon" :src="asset.chart" mode="aspectFit" aria-hidden="true" />
            <view class="vocab-link-copy"><text class="vocab-link-title">{{ mobileT('vocabularyPage.practiceCta') }}</text><text class="vocab-copy">{{ mobileT('vocabularyPage.practiceBody') }}</text></view>
            <image class="vocab-link-chev" :src="asset.chevR" mode="aspectFit" aria-hidden="true" />
          </button>
          <button tabindex="0" role="button" class="vocab-link" type="button" @click="open('/pages/b10-report/b10-report')">
            <image class="vocab-link-icon" :src="asset.list" mode="aspectFit" aria-hidden="true" />
            <view class="vocab-link-copy"><text class="vocab-link-title">{{ mobileT('vocabularyPage.reportCta') }}</text><text class="vocab-copy">{{ mobileT('vocabularyPage.reportBody') }}</text></view>
            <image class="vocab-link-chev" :src="asset.chevR" mode="aspectFit" aria-hidden="true" />
          </button>
        </view>
      </view>

      <view v-else-if="view.phase === 'loading'" class="vocab-card vocab-notice" role="status">
        <text class="vocab-title">{{ mobileT('vocabularyPage.loadingTitle') }}</text>
        <text class="vocab-copy">{{ mobileT('vocabularyPage.loadingBody') }}</text>
      </view>

      <view v-else-if="view.phase === 'empty'" class="vocab-card vocab-notice">
        <text class="vocab-title">{{ mobileT('vocabularyPage.emptyTitle') }}</text>
        <text class="vocab-copy">{{ mobileT('vocabularyPage.emptyBody') }}</text>
        <button tabindex="0" role="button" class="vocab-cta" type="button" @click="reload">{{ mobileT('vocabularyPage.retry') }}</button>
      </view>

      <view v-else-if="view.phase === 'idle'" class="vocab-card vocab-notice">
        <text class="vocab-title">{{ mobileT('vocabularyPage.idleTitle') }}</text>
        <text class="vocab-copy">{{ mobileT('vocabularyPage.idleBody') }}</text>
      </view>

      <view v-else class="vocab-card vocab-notice" role="status">
        <text class="vocab-title">{{ noticeTitle(view.notice) }}</text>
        <text class="vocab-copy">{{ noticeBody(view.notice) }}</text>
        <button tabindex="0" role="button" class="vocab-cta" type="button" @click="reload">{{ mobileT('vocabularyPage.retry') }}</button>
        <button v-if="view.syncWaiting" tabindex="0" role="button" class="vocab-cta vocab-cta-secondary" type="button" @click="syncQueue">{{ mobileT('vocabularyPage.syncRetry') }}</button>
      </view>

    </view>

    <view v-if="view.phase === 'front' || view.phase === 'back'" class="vocab-dock">
      <view class="vocab-dock-inner">
        <text v-if="statusFlags.loading && view.phase === 'front'" class="vocab-copy" role="status">{{ mobileT('vocabularyPage.revealing') }}</text>
        <button v-if="view.phase === 'front'" tabindex="0" role="button" class="vocab-cta" type="button" :disabled="!view.revealEnabled" @click="reveal">{{ mobileT('vocabularyPage.showAnswer') }}</button>
        <template v-if="view.phase === 'back'">
          <text class="vocab-rate-prompt">{{ mobileT('vocabularyPage.ratePrompt') }}</text>
          <view class="vocab-ratings" role="group" :aria-label="mobileT('vocabularyPage.ratePrompt')">
            <button
              v-for="option in ratingOptions"
              :key="option.value"
              tabindex="0"
              role="button"
              class="vocab-rate"
              :class="'vocab-rate-' + option.tone"
              type="button"
              :disabled="!view.ratingEnabled"
              @click="rate(option.value)"
            >{{ ratingLabel(option) }}</button>
          </view>
        </template>
        <button v-if="view.syncWaiting" tabindex="0" role="button" class="vocab-cta vocab-cta-secondary" type="button" @click="syncQueue">{{ mobileT('vocabularyPage.syncRetry') }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.vocab-page { position: relative; box-sizing: border-box; display: flex; flex-direction: column; min-height: 100%; padding: calc(12px + env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); overflow-wrap: anywhere; }
:root .yx-page.vocab-page { background-color: var(--yx-r4-page-color); background-image: var(--yx-r4-home-image); color: var(--yx-r4-ink, var(--yx-text-primary)); }
.vocab-page[data-phase="front"] { padding-bottom: calc(168px + env(safe-area-inset-bottom)); }
.vocab-page[data-phase="back"] { padding-bottom: calc(248px + env(safe-area-inset-bottom)); }
.vocab-page, .vocab-page text, .vocab-page button { overflow-wrap: anywhere; white-space: normal; }
.vocab-glow { position: absolute; top: 0; left: 50%; width: min(540px, 100%); height: 240px; transform: translateX(-50%); pointer-events: none; z-index: 0; }
.vocab-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: var(--v2-space-4); width: 100%; max-width: 720px; margin: 0 auto; font-family: var(--v2-font); }
.vocab-progress { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v2-space-3); min-height: 44px; }
.vocab-progress-label { color: var(--v2-brand); font-family: var(--v2-font); font-size: var(--v2-text-sm); font-weight: 700; line-height: 1.4; }
.vocab-copy, .vocab-phonetic, .vocab-kicker { color: var(--v2-mut); font-family: var(--v2-font); font-size: var(--v2-text-sm); line-height: 1.6; }
.vocab-track { flex: 1 1 96px; height: 8px; min-width: 96px; border-radius: var(--v2-radius-pill); background: var(--v2-soft); overflow: hidden; }
.vocab-track-fill { height: 8px; border-radius: var(--v2-radius-pill); background: var(--v2-brand); }
.vocab-glass, .vocab-tip, .vocab-next { position: relative; box-sizing: border-box; width: 100%; border: 1px solid var(--v2-line); background: var(--yx-r4-glass, var(--v2-card)); box-shadow: var(--v2-shadow); backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur, 0px))); }
.vocab-card { display: flex; flex-direction: column; align-items: stretch; gap: var(--v2-space-3); padding: var(--v2-space-5); border-radius: 24px; }
.vocab-meta, .vocab-back-head, .vocab-sound-row, .vocab-tip-row, .vocab-due { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v2-space-2); width: 100%; min-width: 0; }
.vocab-meta { justify-content: space-between; min-height: 28px; }
.vocab-sound-row { justify-content: center; gap: var(--v2-space-3); }
.vocab-grow { flex: 1 1 auto; min-width: var(--v2-space-2); }
.vocab-tag { display: inline-flex; align-items: center; min-height: 28px; padding: var(--v2-space-1) var(--v2-space-3); border-radius: var(--v2-radius-pill); background: var(--v2-warn-soft); color: var(--v2-warn); font-size: var(--v2-text-xs); font-weight: 700; }
.vocab-source { margin-left: auto; color: var(--v2-mut); font-size: var(--v2-text-xs); line-height: 1.4; }
.vocab-word { color: var(--v2-ink); font-family: var(--v2-font); font-size: var(--v2-text-xl); font-weight: 700; line-height: 1.25; text-align: center; }
.vocab-back-head .vocab-word { font-size: var(--v2-text-lg); text-align: left; }
.vocab-title, .vocab-rate-prompt, .vocab-tip-title, .vocab-link-title { color: var(--v2-ink); font-family: var(--v2-font); font-size: var(--v2-text-lg); font-weight: 700; line-height: 1.4; }
.vocab-meaning { color: var(--v2-ink); font-family: var(--v2-font); font-size: var(--v2-text-lg); font-weight: 700; line-height: 1.4; text-align: left; }
.vocab-phonetic { text-align: center; }
.vocab-back-head .vocab-phonetic, .vocab-answer, .vocab-answer .vocab-copy, .vocab-answer .vocab-meaning, .vocab-tip, .vocab-tip .vocab-copy, .vocab-tip-title { text-align: left; }
.vocab-missing, .vocab-silent, .vocab-tip, .vocab-answer, .vocab-examples, .vocab-notice, .vocab-done, .vocab-hero-copy { display: flex; flex-direction: column; gap: var(--v2-space-2); min-width: 0; }
.vocab-tip { gap: var(--v2-space-2); padding: var(--v2-space-4); border-radius: 18px; }
.vocab-dot { width: 8px; height: 8px; flex: 0 0 8px; }
.vocab-icon-button, .vocab-silent-mark { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; width: 48px; min-width: 48px; min-height: 48px; padding: var(--v2-space-2); border-radius: var(--v2-radius-pill); background: var(--v2-soft); }
.vocab-icon-button { border: 0; }
.vocab-icon, .vocab-due-icon, .vocab-link-icon, .vocab-link-chev { width: 22px; height: 22px; flex: 0 0 22px; }
.vocab-due { justify-content: flex-start; min-height: 44px; }
.vocab-examples { padding-top: var(--v2-space-3); border-top: 1px solid var(--v2-line); }
.vocab-example { display: flex; flex-direction: column; gap: var(--v2-space-1); }
.vocab-retry { align-self: flex-start; min-height: 44px; padding: var(--v2-space-2) var(--v2-space-3); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-card); color: var(--v2-ink); font-family: var(--v2-font); font-size: var(--v2-text-sm); font-weight: 700; }
.vocab-dock { position: fixed; right: 0; bottom: 0; left: 0; z-index: 3; box-sizing: border-box; padding: var(--v2-space-3) max(24px, env(safe-area-inset-right)) calc(var(--v2-space-6) + env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); background: var(--v2-card); box-shadow: var(--v2-shadow); }
.vocab-dock-inner { display: flex; flex-direction: column; gap: var(--v2-space-2); width: 100%; max-width: 720px; margin: 0 auto; }
.vocab-cta, .vocab-link { box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: var(--v2-space-3); width: 100%; min-height: 48px; padding: var(--v2-space-3) var(--v2-space-4); border: 0; border-radius: var(--v2-radius-md); background: var(--v2-brand); color: var(--v2-inverse); font-family: var(--v2-font); font-size: var(--v2-text-sm); font-weight: 700; line-height: 1.5; }
.vocab-cta-secondary { border: 1px solid var(--v2-line); background: var(--v2-card); color: var(--v2-ink); }
.vocab-next { display: flex; flex-direction: column; padding: var(--v2-space-2) var(--v2-space-5); border-radius: 24px; }
.vocab-link { justify-content: flex-start; min-height: 56px; border: 0; border-radius: 0; background: transparent; color: var(--v2-ink); text-align: left; box-shadow: none; }
.vocab-link + .vocab-link { border-top: 1px solid var(--v2-line); }
.vocab-link-icon { padding: var(--v2-space-2); border-radius: var(--v2-radius-md); background: var(--v2-soft); }
.vocab-link-copy { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }
.vocab-link-copy .vocab-copy, .vocab-link-title { text-align: left; }
.vocab-ratings { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--v2-space-2); width: 100%; }
.vocab-rate { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; min-height: 56px; padding: var(--v2-space-2); border: 1px solid var(--v2-line); border-radius: var(--v2-radius-md); background: var(--v2-card); color: var(--v2-ink); font-family: var(--v2-font); font-size: var(--v2-text-sm); font-weight: 700; line-height: 1.4; }
.vocab-rate-bad { color: var(--v2-bad); }
.vocab-rate-warn { color: var(--v2-warn); }
.vocab-rate-brand { color: var(--v2-brand); }
.vocab-rate-ok { color: var(--v2-ok); }
.vocab-rate:disabled, .vocab-cta:disabled, .vocab-retry:disabled { opacity: 0.55; }
.vocab-hero { display: flex; flex-wrap: wrap; align-items: center; gap: var(--v2-space-4); width: 100%; padding: var(--v2-space-6); border-radius: 28px; background: var(--v2-brand); color: var(--v2-inverse); box-shadow: var(--v2-shadow); }
.vocab-hero .vocab-kicker, .vocab-hero .vocab-title, .vocab-hero .vocab-copy, .vocab-hero .vocab-count { color: var(--v2-inverse); text-align: left; }
.vocab-ring { position: relative; display: flex; flex: 0 0 96px; flex-direction: column; align-items: center; justify-content: center; width: 96px; height: 96px; }
.vocab-ring-art { position: absolute; inset: 0; width: 96px; height: 96px; }
.vocab-count { position: relative; z-index: 1; font-size: var(--v2-text-lg); font-weight: 700; line-height: 1.2; }
.vocab-page button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; box-shadow: var(--v2-focus); }
.vocab-page button:active { transform: scale(0.98); }
:root .yx-page.vocab-page .vocab-glass,
:root .yx-page.vocab-page .vocab-tip,
:root .yx-page.vocab-page .vocab-next { border-color: var(--yx-r4-glass-border, var(--yx-border)); background: var(--yx-r4-glass, var(--yx-surface-card)); box-shadow: var(--yx-r4-shadow-card); backdrop-filter: blur(var(--yx-r4-blur, 0px)); }
:root .yx-page.vocab-page .vocab-dock { padding: 12px max(24px, env(safe-area-inset-right)) calc(30px + env(safe-area-inset-bottom)) max(24px, env(safe-area-inset-left)); background: var(--yx-surface-card); box-shadow: var(--yx-r4-shadow-card); }
:root .yx-page.vocab-page .vocab-cta { min-height: 48px; height: auto; padding: 14px 20px; border: 0; background-color: var(--yx-r4-cta-color); background-image: var(--yx-r4-cta-image); box-shadow: var(--yx-r4-shadow-cta); color: var(--yx-r4-on-cta); }
:root .yx-page.vocab-page .vocab-cta-secondary { border: 1px solid var(--yx-border); background-color: var(--yx-surface-card); background-image: none; box-shadow: none; color: var(--yx-text-primary); }
:root .yx-page.vocab-page .vocab-icon-button { width: 48px; min-width: 48px; min-height: 48px; height: 48px; padding: 0; border: 0; background: var(--yx-brand-soft); background-image: none; box-shadow: none; }
:root .yx-page.vocab-page .vocab-rate { height: auto; border-color: var(--yx-border); background-color: var(--yx-surface-card); background-image: none; }
:root .yx-page.vocab-page .vocab-rate-bad { color: var(--yx-danger); }
:root .yx-page.vocab-page .vocab-rate-warn { color: var(--yx-warning); }
:root .yx-page.vocab-page .vocab-rate-brand { color: var(--yx-brand); }
:root .yx-page.vocab-page .vocab-rate-ok { color: var(--yx-success); }
:root .yx-page.vocab-page .vocab-hero { background-color: var(--yx-r4-cta-color); background-image: var(--yx-r4-cta-image); color: var(--yx-r4-on-cta); box-shadow: var(--yx-r4-shadow-cta); }
:root .yx-page.vocab-page .vocab-hero .vocab-kicker,
:root .yx-page.vocab-page .vocab-hero .vocab-title,
:root .yx-page.vocab-page .vocab-hero .vocab-copy,
:root .yx-page.vocab-page .vocab-hero .vocab-count { color: var(--yx-r4-on-cta); }
:root .yx-page.vocab-page .vocab-report-shortcut { align-self: flex-start; width: auto; min-height: 44px; margin: 0; padding: 12px 8px; border: 0; background: transparent; background-image: none; box-shadow: none; color: var(--yx-brand); font-weight: 650; }
:root .yx-page.vocab-page .vocab-link { border: 0; background: transparent; background-image: none; box-shadow: none; color: var(--yx-text-primary); }
:root .yx-page.vocab-page .vocab-progress-label { color: var(--yx-brand); }
:root .yx-page.vocab-page .vocab-track { background: var(--yx-brand-soft); }
:root .yx-page.vocab-page .vocab-track-fill { background: var(--yx-brand); }
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-glass,
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-tip,
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-next,
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-dock,
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-hero,
:root .yx-page.vocab-page.b10-theme--high-contrast .vocab-cta { border: 2px solid var(--yx-border); box-shadow: none; backdrop-filter: none; background-image: none; }
@media (max-width: 389px) { .vocab-rate { padding: var(--v2-space-1); font-size: var(--v2-text-xs); } .vocab-hero { padding: var(--v2-space-4); } .vocab-back-head { align-items: flex-start; } }
@media (min-width: 768px) { .vocab-card { padding: var(--v2-space-6); } .vocab-dock-inner, .vocab-body { max-width: 720px; } }
@media (prefers-reduced-motion: reduce) {
  .vocab-page button:active { transform: none; }
  .vocab-page, .vocab-page * { animation: none; transition: none; }
}
.vocab-page[data-motion="off"] .vocab-glow, .vocab-page[data-motion="reduced"] .vocab-glow { animation: none; }
.vocab-page[data-motion="off"] button:active, .vocab-page[data-motion="reduced"] button:active { transform: none; }
.vocab-page[data-motion="off"] *, .vocab-page[data-motion="reduced"] * { animation: none; transition: none; }
</style>
