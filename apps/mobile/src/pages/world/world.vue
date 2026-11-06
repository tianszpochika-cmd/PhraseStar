<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import B12RewardsCard from '../../components/b12/B12RewardsCard.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getB4Profile, getB4Season, getB4Streak, listB4Quests } from '../../api/b4'
import { B4_PERFORMANCE_LEVELS, type B4PerformanceLevel } from '../../domain/b4'
import { b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'
import {
  formatWorldDate,
  isEmptyWorldPayload,
  isSameWorldIdentity,
  isWorldFeatureClosed,
  questPeriodKey,
  seasonStatusKey,
  streakStatusKey,
  toWorldFailure,
  toWorldQuests,
  toWorldSeason,
  toWorldStreak,
  toWorldSummary,
  type WorldQuest,
  type WorldQuests,
  type WorldSeason,
  type WorldStreak,
  type WorldSummary,
} from './world-page'

const PAGE_PATH = '/pages/world/world'
const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const b4 = useB4Store()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const uiLocale = computed(() => b10UiLocale.value)

type PageStatus = 'loading' | 'ready' | 'partial' | 'error' | 'offline' | 'permission' | 'closed'
type SectionState = 'loading' | 'ready' | 'empty' | 'error'

const status = ref<PageStatus>('loading')
const statusKey = ref('loading')
const summary = ref<WorldSummary | null>(null)
const streak = ref<WorldStreak | null>(null)
const season = ref<WorldSeason | null>(null)
const quests = ref<WorldQuests>({ quests: [], invalidCount: 0 })
const summaryState = ref<SectionState>('loading')
const streakState = ref<SectionState>('loading')
const seasonState = ref<SectionState>('loading')
const questsState = ref<SectionState>('loading')
const accessBlocked = ref(false)

let visible = false
let pageEpoch = 0
let showEpoch = 0

const featureClosed = computed(() => isWorldFeatureClosed(summary.value))
const rewardsConfirmed = computed(() => summary.value?.featureEnabled === true)
const hasSummaryFacts = computed(() => Boolean(summary.value && (summary.value.xp !== null || summary.value.level !== null)))
const activeStreak = computed(() => streak.value !== null)
const showStatusRetry = computed(() => ['partial', 'error', 'offline'].includes(status.value))
const levelText = computed(() => summary.value?.level !== null && summary.value?.level !== undefined ? wt('levelShort', { level: summary.value.level }) : null)
const xpText = computed(() => summary.value?.xp !== null && summary.value?.xp !== undefined ? `${summary.value.xp} ${wt('xp')}` : null)
const qualityLabels = computed(() => B4_PERFORMANCE_LEVELS.map((level) => wt(`quality${level}`)))
const qualityIndex = computed(() => Math.max(0, B4_PERFORMANCE_LEVELS.indexOf(b4.performanceLevel)))
const statusText = computed(() => wt(statusKey.value))

function wt(key: string, values: Record<string, string | number> = {}): string {
  return mobileT(`worldPage.${key}`).replace(/\{(\w+)\}/g, (_, name: string) => (
    values[name] === undefined ? `{${name}}` : String(values[name])
  ))
}

function currentIdentity(): { subject: string; revision: number } | null {
  return session.getMobileApiIdentity()
}

function isCurrent(run: number, identity: { subject: string; revision: number } | null): boolean {
  return visible
    && pageEpoch === run
    && session.isAuthenticated
    && session.isLearningReady
    && isSameWorldIdentity(identity, session.getMobileApiIdentity())
}

function resetData(): void {
  summary.value = null
  streak.value = null
  season.value = null
  quests.value = { quests: [], invalidCount: 0 }
  summaryState.value = 'loading'
  streakState.value = 'loading'
  seasonState.value = 'loading'
  questsState.value = 'loading'
  status.value = 'loading'
  statusKey.value = 'loading'
  accessBlocked.value = false
}

function sectionFailure(error: unknown): { permission: boolean; offline: boolean; key: string } {
  const failure = toWorldFailure(error)
  if (failure.kind === 'unauthorized' || failure.kind === 'forbidden') {
    accessBlocked.value = true
    return { permission: true, offline: false, key: 'permission' }
  }
  return { permission: false, offline: failure.kind === 'offline', key: failure.kind === 'offline' ? 'offline' : 'error' }
}

function applySummary(result: PromiseSettledResult<unknown>): { ok: boolean; error?: unknown } {
  if (result.status === 'rejected') {
    summaryState.value = 'error'
    sectionFailure(result.reason)
    return { ok: false, error: result.reason }
  }
  if (isEmptyWorldPayload(result.value)) {
    summaryState.value = 'empty'
    return { ok: false }
  }
  const parsed = toWorldSummary(result.value)
  if (!parsed.ok) {
    summaryState.value = 'error'
    return { ok: false }
  }
  summary.value = parsed.data
  summaryState.value = parsed.data.xp !== null || parsed.data.level !== null || parsed.data.currentSeason !== null || parsed.data.featureEnabled !== null ? 'ready' : 'empty'
  return { ok: true }
}

function applyStreak(result: PromiseSettledResult<unknown>): { ok: boolean; error?: unknown } {
  if (result.status === 'rejected') {
    streakState.value = 'error'
    sectionFailure(result.reason)
    return { ok: false, error: result.reason }
  }
  if (isEmptyWorldPayload(result.value)) {
    streakState.value = 'empty'
    return { ok: false }
  }
  const parsed = toWorldStreak(result.value)
  if (!parsed.ok) {
    streakState.value = 'error'
    return { ok: false }
  }
  streak.value = parsed.data
  streakState.value = 'ready'
  return { ok: true }
}

function applySeason(result: PromiseSettledResult<unknown>): { ok: boolean; error?: unknown } {
  if (result.status === 'rejected') {
    seasonState.value = 'error'
    sectionFailure(result.reason)
    return { ok: false, error: result.reason }
  }
  if (isEmptyWorldPayload(result.value)) {
    seasonState.value = 'empty'
    return { ok: false }
  }
  const parsed = toWorldSeason(result.value)
  if (!parsed.ok) {
    seasonState.value = 'empty'
    return { ok: false }
  }
  season.value = parsed.data
  seasonState.value = 'ready'
  return { ok: true }
}

function applyQuests(result: PromiseSettledResult<unknown>): { ok: boolean; error?: unknown } {
  if (result.status === 'rejected') {
    questsState.value = 'error'
    sectionFailure(result.reason)
    return { ok: false, error: result.reason }
  }
  if (isEmptyWorldPayload(result.value)) {
    questsState.value = 'empty'
    return { ok: false }
  }
  const parsed = toWorldQuests(result.value)
  if (!parsed.ok) {
    questsState.value = 'error'
    return { ok: false }
  }
  quests.value = parsed.data
  questsState.value = parsed.data.quests.length ? 'ready' : 'empty'
  return { ok: true }
}

async function load(): Promise<void> {
  if (!visible) return
  const identity = currentIdentity()
  if (!session.isAuthenticated || !session.isLearningReady || !identity) {
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  const run = ++pageEpoch
  status.value = 'loading'
  statusKey.value = 'loading'
  summaryState.value = 'loading'
  streakState.value = 'loading'
  seasonState.value = 'loading'
  questsState.value = 'loading'
  const summarySettled = await Promise.allSettled([getB4Profile()])
  if (!isCurrent(run, identity)) return
  const summaryResult = applySummary(summarySettled[0])
  if (accessBlocked.value) {
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  if (summary.value && summary.value.featureEnabled === false) {
    status.value = 'closed'
    statusKey.value = 'featureClosedTitle'
    return
  }
  const results = await Promise.allSettled([getB4Streak(), listB4Quests(), getB4Season()])
  if (!isCurrent(run, identity)) return
  const streakResult = applyStreak(results[0])
  const questsResult = applyQuests(results[1])
  const seasonResult = applySeason(results[2])
  const failures = [summaryResult, streakResult, questsResult, seasonResult].filter((item) => !item.ok && item.error !== undefined)
  const sectionErrors = [summaryState.value, streakState.value, seasonState.value, questsState.value].filter((item) => item === 'error').length
  const firstFailure = failures[0]?.error
  if (accessBlocked.value) {
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  if (summary.value && summary.value.featureEnabled === false) {
    status.value = 'closed'
    statusKey.value = 'featureClosedTitle'
    return
  }
  if (sectionErrors === 0) {
    const anyReady = summaryState.value === 'ready' || streakState.value === 'ready' || seasonState.value === 'ready' || questsState.value === 'ready'
    status.value = anyReady ? 'ready' : 'partial'
    statusKey.value = anyReady ? 'lastUpdated' : 'summaryNoFacts'
    return
  }
  const offline = failures.length > 0 && toWorldFailure(firstFailure).kind === 'offline'
  if (sectionErrors === 4) {
    status.value = offline ? 'offline' : 'error'
    statusKey.value = offline ? 'offline' : 'error'
    return
  }
  status.value = 'partial'
  statusKey.value = offline ? 'offline' : 'partial'
}

async function initialise(token: number): Promise<void> {
  const allowed = await ensureMobilePageAccess(PAGE_PATH)
  if (token !== showEpoch || !visible) return
  if (!allowed) {
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  if (!session.isAuthenticated || !session.isLearningReady || !currentIdentity()) {
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  await load()
}

function retry(): void {
  if (status.value === 'loading') return
  void load()
}

function returnToLearning(): void {
  openUniPage('/pages/home/home')
}

function navigate(url: string): void {
  openUniPage(url)
}

function changeQuality(event: { detail: { value: number | string } }): void {
  const level = B4_PERFORMANCE_LEVELS[Number(event.detail.value)]
  if (level) b4.setPerformance(level)
}

function questTitle(quest: WorldQuest): string {
  return quest.title ?? wt('questUnknown')
}

function questProgress(quest: WorldQuest): string {
  if (quest.claimed === true) return wt('questClaimed')
  if (quest.completed === true) return wt('questCompleted')
  if (quest.progress !== null && quest.target !== null) return wt('questProgress', { progress: quest.progress, target: quest.target })
  return wt('unavailable')
}

function streakLastValid(value: WorldStreak): string {
  const date = formatWorldDate(value.lastValidDate, uiLocale.value)
  return date ? wt('streakLastValid', { date }) : wt('dateUnknown')
}

function seasonPoints(value: WorldSeason): string | null {
  return value.points === null ? null : wt('seasonPoints', { count: value.points })
}

onShow(() => {
  visible = true
  b4.restore()
  const token = ++showEpoch
  void initialise(token)
})

onHide(() => {
  visible = false
  showEpoch += 1
  pageEpoch += 1
})

watch(() => session.identityRevision, () => {
  if (!visible) return
  pageEpoch += 1
  resetData()
  if (!session.isAuthenticated) {
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  void initialise(++showEpoch)
})
</script>

<template>
  <view class="yx-page world-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <view class="world-glow" aria-hidden="true">
      <image class="world-glow-image" src="/static/figma-world-core/imgGlow-a1692313.svg" mode="scaleToFill" />
    </view>
    <view class="world-header">
      <MobilePageHeader
        page="world"
        :title="wt('title')"
        :description="wt('subtitle')"
        :show-settings="false"
      />
    </view>

    <view v-if="accessBlocked" class="world-body">
      <view class="world-alert" role="alert">
        <image class="world-mascot" src="/static/figma-world-core/imgMascot-d54a4be0.svg" mode="aspectFit" aria-hidden="true" />
        <view class="world-alert-copy">
          <text class="world-alert-title">{{ wt('permission') }}</text>
          <text class="world-alert-body">{{ wt('loadingHint') }}</text>
        </view>
        <view class="world-alert-actions">
          <button class="world-link" type="button" @click="returnToLearning">{{ wt('safeExit') }}</button>
        </view>
      </view>
    </view>

    <view v-else class="world-body">
      <view class="world-status" role="status">
        <view class="world-status-copy">
          <text class="world-status-title">{{ statusText }}</text>
          <text class="world-status-hint">{{ wt('loadingHint') }}</text>
        </view>
        <view class="world-status-actions">
          <button v-if="showStatusRetry" class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
          <picker :range="qualityLabels" :value="qualityIndex" @change="changeQuality">
            <view class="world-quality">{{ wt('quality') }} · {{ qualityLabels[qualityIndex] }}</view>
          </picker>
        </view>
      </view>

      <view v-if="featureClosed" class="world-closed" role="status">
        <image class="world-mascot" src="/static/figma-world-core/imgMascot-d54a4be0.svg" mode="aspectFit" aria-hidden="true" />
        <view class="world-closed-copy">
          <text class="world-closed-title">{{ wt('featureClosedTitle') }}</text>
          <text class="world-note">{{ wt('featureClosedBody') }}</text>
          <view class="world-closed-actions">
            <button class="world-link" type="button" @click="navigate('/pages/b4-avatar/b4-avatar')">{{ wt('avatar') }}</button>
            <button class="world-link" type="button" @click="navigate('/pages/b4-offline/b4-offline')">{{ wt('offlineEntry') }}</button>
            <button class="world-link" type="button" @click="returnToLearning">{{ wt('safeExit') }}</button>
          </view>
        </view>
      </view>

      <template v-else>
        <view v-if="summaryState === 'error'" class="world-section-error" role="alert">
          <text>{{ wt('summaryUnavailable') }}</text>
          <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
        </view>

        <view v-if="hasSummaryFacts" class="world-hero">
          <view class="world-hero-copy">
            <text v-if="levelText" class="world-hero-level">{{ levelText }}</text>
            <text v-if="xpText" class="world-hero-xp">{{ xpText }}</text>
          </view>
          <view class="world-hero-art">
            <image class="world-hero-rocket" src="/static/figma-world-core/imgIconRocket-df0018e9.svg" mode="aspectFit" aria-hidden="true" />
          </view>
        </view>

        <view v-if="levelText || activeStreak" class="world-stats">
          <view v-if="levelText" class="world-stat">
            <text class="world-stat-value">{{ levelText }}</text>
            <text class="world-stat-label">{{ wt('level') }}</text>
          </view>
          <view v-if="activeStreak" class="world-stat">
            <text class="world-stat-value">{{ wt('days', { count: streak?.currentStreak ?? 0 }) }}</text>
            <text class="world-stat-label">{{ wt('streak') }}</text>
          </view>
        </view>

        <view class="world-card world-map-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('growthMap') }}</text>
            <image class="world-inline-icon" src="/static/figma-world-core/imgIconSparkles-d3d305c0.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <view class="world-map-art" aria-hidden="true">
            <image class="world-star world-star--1" src="/static/figma-world-core/imgS-8aa360df.svg" mode="aspectFit" />
            <image class="world-star world-star--2" src="/static/figma-world-core/imgS1-49835748.svg" mode="aspectFit" />
            <image class="world-star world-star--3" src="/static/figma-world-core/imgS2-4d7cc3f6.svg" mode="aspectFit" />
            <image class="world-star world-star--4" src="/static/figma-world-core/imgS3-8c27187b.svg" mode="aspectFit" />
          </view>
          <text class="world-note">{{ wt('growthMapUnavailable') }}</text>
        </view>

        <view class="world-card world-season-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('season') }}</text>
            <image class="world-inline-icon" src="/static/figma-world-core/imgIconTrophy-1571c4ce.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <view v-if="seasonState === 'error'" class="world-section-error" role="alert">
            <text>{{ wt('seasonUnavailable') }}</text>
            <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
          </view>
          <template v-else-if="season">
            <text class="world-season-title">{{ season.title ?? season.seasonId }}</text>
            <text class="world-meta">{{ wt(seasonStatusKey(season.status)) }}<template v-if="seasonPoints(season)"> · {{ seasonPoints(season) }}</template></text>
          </template>
          <text v-else-if="seasonState === 'empty'" class="world-empty">{{ wt('noSeason') }}</text>
        </view>

        <view class="world-entry-grid">
          <button class="world-entry" type="button" @click="navigate('/pages/b4-games/b4-games')">
            <image class="world-entry-icon" src="/static/figma-world-core/imgIconGame-d3e0367c.svg" mode="aspectFit" aria-hidden="true" />
            <text class="world-entry-title">{{ wt('games') }}</text>
            <text class="world-meta">{{ wt('gamesDesc') }}</text>
          </button>
          <button class="world-entry" type="button" @click="navigate('/pages/b4-social/b4-social')">
            <image class="world-entry-icon" src="/static/figma-world-core/imgIconUsers-a47ef190.svg" mode="aspectFit" aria-hidden="true" />
            <text class="world-entry-title">{{ wt('social') }}</text>
            <text class="world-meta">{{ wt('socialDesc') }}</text>
          </button>
          <button class="world-entry" type="button" @click="navigate('/pages/b4-avatar/b4-avatar')">
            <image class="world-entry-icon" src="/static/figma-world-core/imgIconShirt-4ea65edd.svg" mode="aspectFit" aria-hidden="true" />
            <text class="world-entry-title">{{ wt('avatar') }}</text>
            <text class="world-meta">{{ wt('avatarDesc') }}</text>
          </button>
          <button class="world-entry" type="button" @click="navigate('/pages/b4-offline/b4-offline')">
            <image class="world-entry-icon" src="/static/figma-world-core/imgIconDownload-8e6deb40.svg" mode="aspectFit" aria-hidden="true" />
            <text class="world-entry-title">{{ wt('offlineEntry') }}</text>
            <text class="world-meta">{{ wt('offlineEntryDesc') }} · {{ wt('offlineClosed') }}</text>
          </button>
        </view>

        <view class="world-card world-streak-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('streak') }}</text>
            <image class="world-inline-icon" src="/static/figma-world-core/imgIconFlame-2c1c73a2.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <view v-if="streakState === 'error'" class="world-section-error" role="alert">
            <text>{{ wt('streakUnavailable') }}</text>
            <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
          </view>
          <template v-else-if="streak">
            <text class="world-streak-number">{{ wt('days', { count: streak.currentStreak }) }}</text>
            <text class="world-meta">{{ wt(streakStatusKey(streak.status)) }}<template v-if="streak.timeZone"> · {{ wt('streakTimeZone', { zone: streak.timeZone }) }}</template></text>
            <text class="world-meta">{{ streakLastValid(streak) }}</text>
            <text class="world-note">{{ wt('streakCalendarUnavailable') }}</text>
            <text v-if="streak.status === 'AT_RISK' || streak.status === 'BROKEN' || streak.status === 'FROZEN'" class="world-note">{{ wt('rescueClosed') }}</text>
          </template>
          <text v-else-if="streakState === 'empty'" class="world-empty">{{ wt('streakNoRecord') }}</text>
        </view>

        <view class="world-card world-quests-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('quests') }}</text>
            <text v-if="quests.quests.length" class="world-tag">{{ wt('questsCount', { count: quests.quests.length }) }}</text>
          </view>
          <view v-if="questsState === 'error'" class="world-section-error" role="alert">
            <text>{{ wt('questsUnavailable') }}</text>
            <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
          </view>
          <template v-else-if="quests.quests.length">
            <view v-for="quest in quests.quests" :key="quest.questId" class="world-quest">
              <view class="world-quest-copy">
                <text class="world-quest-title">{{ questTitle(quest) }}</text>
                <text class="world-meta">{{ wt(questPeriodKey(quest.period)) }}</text>
              </view>
              <text class="world-tag">{{ questProgress(quest) }}</text>
            </view>
            <text v-if="quests.invalidCount" class="world-note">{{ wt('partial') }}</text>
          </template>
          <text v-else-if="questsState === 'empty'" class="world-empty">{{ wt('noQuests') }}</text>
        </view>

        <B12RewardsCard v-if="rewardsConfirmed" />
        <view v-else class="world-rewards">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('rewardsTitle') }}</text>
            <image class="world-inline-icon" src="/static/figma-world-core/imgIconGift-b89f33ab.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <text class="world-note">{{ wt('rewardsNote') }}</text>
          <text class="world-note">{{ wt('rewardsUnconfirmed') }}</text>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.world-page.yx-page.yx-page {
  position: relative;
  box-sizing: border-box;
  max-width: 860px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 0 calc(96px + env(safe-area-inset-bottom));
  overflow-x: hidden;
  background-color: var(--yx-surface-page);
  background-image: var(--yx-r4-home-image);
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-family: var(--v2-font);
}
.world-glow { position: absolute; top: -140px; right: -120px; width: min(360px, 92vw); height: 300px; overflow: hidden; pointer-events: none; }
.world-glow-image { display: block; width: 100%; height: 100%; }
.world-header { position: relative; z-index: 2; padding: calc(18px + env(safe-area-inset-top)) 16px 0 8px; }
.world-header :deep(.mobile-intro--world) { padding: 0; border-radius: 0; background: none; overflow: visible; }
.world-header :deep(.mobile-intro--world .mobile-intro-copy) { max-width: 100%; }
.world-header :deep(.mobile-intro--world .mobile-page-title) { font-size: 28px; }
.world-header :deep(.mobile-intro--world .mobile-book-art) { display: none; }
.world-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; padding: 8px 24px 0; }
.world-status {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 14px; border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 16px; background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 10px)); -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
.world-status-copy { display: grid; gap: 2px; min-width: 0; }
.world-status-title { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 13px; font-weight: 700; line-height: 19px; }
.world-status-hint { color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 12px; line-height: 18px; }
.world-status-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
.world-quality { display: inline-flex; align-items: center; min-height: 44px; padding: 0 10px; border: 1px solid var(--v2-line); border-radius: 10px; color: var(--v2-brand); background: var(--v2-card); font-size: 12px; font-weight: 700; white-space: nowrap; }
.world-page .world-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 6px 8px; border: 0; border-radius: 8px; color: var(--v2-brand); background: transparent; font-family: var(--v2-font); font-size: 13px; font-weight: 700; }
.world-page .world-link::after { border: 0; }
.world-page .world-link--start { justify-self: start; padding-left: 0; }
.world-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 20px 22px; border-radius: 28px; color: var(--yx-r4-on-cta, var(--v2-inverse));
  background-color: var(--v2-brand); background-image: var(--yx-r4-cta-image);
  box-shadow: var(--yx-r4-shadow-cta, var(--v2-shadow));
}
.world-hero-copy { display: grid; gap: 4px; min-width: 0; }
.world-hero-level { color: color-mix(in srgb, var(--v2-inverse) 82%, transparent); font-size: 13px; font-weight: 600; line-height: 20px; }
.world-hero-xp { color: var(--yx-r4-on-cta, var(--v2-inverse)); font-size: 26px; font-weight: 700; line-height: 34px; overflow-wrap: anywhere; }
.world-hero-art { display: flex; flex: 0 0 72px; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 24px; background: color-mix(in srgb, var(--v2-inverse) 18%, transparent); }
.world-hero-rocket { display: block; width: 34px; height: 34px; }
.world-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.world-stat { display: grid; gap: 2px; justify-items: center; padding: 14px 12px; border-radius: 18px; background: var(--v2-card); box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow)); }
.world-stat-value { color: var(--v2-brand); font-size: 22px; font-weight: 700; line-height: 30px; }
.world-stat-label { color: var(--v2-mut); font-size: 12px; line-height: 18px; }
.world-card {
  display: grid; gap: 8px; box-sizing: border-box; min-width: 0; padding: 18px 20px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border)); border-radius: 24px;
  background: var(--yx-r4-glass, var(--v2-card)); box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 10px)); -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
@supports (background: color-mix(in srgb, white 50%, transparent)) {
  .world-card { background: color-mix(in srgb, var(--v2-card) 62%, transparent); border-color: color-mix(in srgb, var(--v2-card) 90%, transparent); }
}
.world-card-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.world-card-title { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 18px; font-weight: 700; line-height: 26px; }
.world-inline-icon { display: block; width: 20px; height: 20px; margin-left: auto; }
.world-map-card { gap: 6px; }
.world-map-art {
  position: relative; height: 94px; margin-top: 2px; overflow: hidden; border-radius: 18px;
  background: linear-gradient(153deg, var(--v2-side), var(--v2-brand));
}
.world-star { position: absolute; display: block; opacity: .9; }
.world-star--1 { top: 34px; left: 22%; width: 22px; height: 22px; }
.world-star--2 { top: 18px; left: 44%; width: 30px; height: 30px; }
.world-star--3 { top: 46px; left: 64%; width: 22px; height: 22px; }
.world-star--4 { top: 12px; left: 78%; width: 26px; height: 26px; }
.world-meta { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
.world-note { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.world-empty { display: block; padding: 6px 0; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 22px; }
.world-season-title { color: var(--yx-r4-ink, var(--yx-text-primary)); font-size: 17px; font-weight: 700; line-height: 24px; }
.world-entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.world-page .world-entry {
  display: grid; grid-template-columns: 34px minmax(0, 1fr); grid-template-rows: auto auto; gap: 2px 10px;
  align-items: center; min-height: 78px; padding: 14px; border: 1px solid var(--v2-line);
  border-radius: 18px; background: var(--v2-card); color: var(--v2-ink); font-family: var(--v2-font); text-align: left;
}
.world-page .world-entry::after { border: 0; }
.world-entry-icon { grid-row: 1 / 3; display: block; width: 30px; height: 30px; }
.world-entry-title { color: var(--v2-ink); font-size: 14px; font-weight: 700; line-height: 20px; }
.world-streak-number { color: var(--v2-brand); font-size: 34px; font-weight: 800; line-height: 42px; }
.world-quest { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid var(--v2-line); }
.world-quest:first-of-type { border-top: 0; }
.world-quest-copy { display: grid; gap: 2px; min-width: 0; }
.world-quest-title { color: var(--v2-ink); font-size: 14px; font-weight: 700; line-height: 20px; }
.world-tag { flex: 0 0 auto; padding: 3px 9px; border-radius: 999px; color: var(--v2-brand); background: var(--v2-soft); font-size: 12px; font-weight: 700; line-height: 18px; white-space: nowrap; }
.world-section-error { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 4px 0; color: var(--v2-bad); font-size: 13px; line-height: 20px; }
.world-alert, .world-closed {
  display: grid; grid-template-columns: 54px minmax(0, 1fr); gap: 12px; align-items: center;
  padding: 16px; border: 1px solid var(--yx-r4-glass-border, var(--yx-border)); border-radius: 22px;
  background: var(--yx-r4-glass, var(--v2-card)); box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
}
.world-closed { align-items: start; }
.world-mascot { display: block; width: 54px; height: 54px; }
.world-alert-copy, .world-closed-copy { display: grid; gap: 4px; min-width: 0; }
.world-alert-actions, .world-closed-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; justify-content: flex-start; gap: 4px; }
.world-alert-title, .world-closed-title { color: var(--v2-ink); font-size: 16px; font-weight: 700; line-height: 22px; }
.world-alert-body { color: var(--v2-mut); font-size: 13px; line-height: 19px; }
.world-rewards { display: grid; gap: 6px; min-width: 0; }
.world-rewards .b12-card { margin-top: 0; }
@media (max-width: 360px) {
  .world-body { padding-right: 16px; padding-left: 16px; }
  .world-header { padding-right: 12px; padding-left: 8px; }
  .world-status { display: grid; }
  .world-status-actions { justify-content: flex-start; }
  .world-entry-grid { grid-template-columns: 1fr; }
}
@media (prefers-contrast: more) {
  .world-status, .world-card, .world-alert, .world-closed { background: var(--v2-card); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
}
.world-page.b10-theme--high-contrast .world-status,
.world-page.b10-theme--high-contrast .world-card,
.world-page.b10-theme--high-contrast .world-alert,
.world-page.b10-theme--high-contrast .world-closed { background: var(--v2-card); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.world-page.b10-theme--dark .world-hero,
.world-page.b10-theme--high-contrast .world-hero { color: var(--v2-ink); background-image: none; background-color: var(--v2-side); }
.world-page.b10-theme--dark .world-hero-level,
.world-page.b10-theme--high-contrast .world-hero-level { color: var(--v2-mut); }
.world-page.b10-theme--dark .world-hero-xp,
.world-page.b10-theme--high-contrast .world-hero-xp { color: var(--v2-ink); }
.world-page.b10-theme--dark .world-hero-rocket,
.world-page.b10-theme--high-contrast .world-hero-rocket { filter: brightness(0) invert(1); }
</style>
