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
let showInFlight = false
let loadFlight: Promise<void> | null = null
let reloadAfterFlight = false
let adoptedKey = ''

const featureClosed = computed(() => isWorldFeatureClosed(summary.value))
const rewardsConfirmed = computed(() => summary.value?.featureEnabled === true)
const hasSummaryFacts = computed(() => Boolean(summary.value && (summary.value.xp !== null || summary.value.level !== null)))
const activeStreak = computed(() => streak.value !== null)
const showStatusRetry = computed(() => ['partial', 'error', 'offline'].includes(status.value))
const pageFailure = computed(() => status.value === 'error' || status.value === 'offline')
const levelText = computed(() => summary.value?.level !== null && summary.value?.level !== undefined ? wt('levelShort', { level: summary.value.level }) : null)
const xpText = computed(() => {
  const xp = summary.value?.xp
  if (xp === null || xp === undefined) return null
  let amount = String(xp)
  try { amount = new Intl.NumberFormat(uiLocale.value).format(xp) } catch { amount = String(xp) }
  return `${amount} ${wt('xp')}`
})
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

function identityKey(): string {
  const identity = currentIdentity()
  return identity ? `${identity.subject}\0${identity.revision}` : ''
}

function observedTopPath(): string | null {
  if (typeof window !== 'undefined' && window.location) {
    const raw = window.location.hash.replace(/^#/, '').trim()
    if (raw) {
      const path = raw.split(/[?#]/, 1)[0] ?? ''
      if (path) return path.startsWith('/') ? path : `/${path}`
    }
  }
  const reader = (globalThis as { getCurrentPages?: () => Array<{ route?: string }> }).getCurrentPages
  if (typeof reader !== 'function') return null
  const pages = reader() ?? []
  const route = pages.length > 0 ? pages[pages.length - 1]?.route : undefined
  if (typeof route !== 'string' || !route.trim()) return null
  const path = route.trim().split(/[?#]/, 1)[0] ?? ''
  return path.startsWith('/') ? path : `/${path}`
}

function routeStillThisPage(): boolean {
  const path = observedTopPath()
  return path === null || path === PAGE_PATH
}

function dropIfRouteLeft(): boolean {
  // Compiled H5 can keep this tab alive without onHide while the hash or top page is elsewhere.
  if (routeStillThisPage()) return false
  if (visible) {
    visible = false
    showEpoch += 1
    pageEpoch += 1
    reloadAfterFlight = false
    adoptedKey = ''
    resetData()
  }
  return true
}

function isCurrent(run: number, identity: { subject: string; revision: number } | null): boolean {
  return visible
    && routeStillThisPage()
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

function isLegacyEmptySeason(value: unknown): boolean {
  if (isEmptyWorldPayload(value)) return true
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  if (!Object.prototype.hasOwnProperty.call(value, 'data')) return false
  const data = Reflect.get(value, 'data')
  return typeof data === 'object' && data !== null && !Array.isArray(data) && Object.keys(data).length === 0
}

function applySeason(result: PromiseSettledResult<unknown>): { ok: boolean; error?: unknown } {
  if (result.status === 'rejected') {
    season.value = null
    seasonState.value = 'error'
    sectionFailure(result.reason)
    return { ok: false, error: result.reason }
  }
  // null, {data:null}, and {data:{}} are legacy empty envelopes. The current season read is a non-null seasonId.
  if (isLegacyEmptySeason(result.value)) {
    season.value = null
    seasonState.value = 'empty'
    return { ok: false }
  }
  const parsed = toWorldSeason(result.value)
  if (!parsed.ok) {
    season.value = null
    seasonState.value = 'error'
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
  if (dropIfRouteLeft() || !visible) return
  if (loadFlight) return loadFlight
  const identity = currentIdentity()
  if (!session.isAuthenticated || !session.isLearningReady || !identity) {
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    return
  }
  reloadAfterFlight = false
  adoptedKey = `${identity.subject}\0${identity.revision}`
  const run = ++pageEpoch
  status.value = 'loading'
  statusKey.value = 'loading'
  summaryState.value = 'loading'
  streakState.value = 'loading'
  seasonState.value = 'loading'
  questsState.value = 'loading'
  const flight = (async () => {
  if (dropIfRouteLeft() || !isCurrent(run, identity)) return
  const summarySettled = await Promise.allSettled([getB4Profile()])
  if (dropIfRouteLeft() || !isCurrent(run, identity)) return
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
  if (!summaryResult.ok && summaryResult.error === undefined && summaryState.value === 'error') {
    streak.value = null
    season.value = null
    quests.value = { quests: [], invalidCount: 0 }
    status.value = 'error'
    statusKey.value = 'error'
    return
  }
  if (dropIfRouteLeft() || !isCurrent(run, identity)) return
  const results = await Promise.allSettled([getB4Streak(), listB4Quests(), getB4Season()])
  if (dropIfRouteLeft() || !isCurrent(run, identity)) return
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
  })()
  loadFlight = flight
  try {
    await flight
  } finally {
    if (loadFlight === flight) loadFlight = null
  }
  if (reloadAfterFlight && visible && routeStillThisPage()) {
    reloadAfterFlight = false
    await load()
  }
}

async function initialise(token: number): Promise<void> {
  showInFlight = true
  let started = false
  try {
    const allowed = await ensureMobilePageAccess(PAGE_PATH)
    if (token !== showEpoch || dropIfRouteLeft() || !visible) return
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
    started = true
    await load()
  } finally {
    showInFlight = false
  }
  if (!started && reloadAfterFlight && visible && routeStillThisPage()) {
    reloadAfterFlight = false
    await initialise(++showEpoch)
  }
}

function retry(): void {
  if (status.value === 'loading' || loadFlight) return
  adoptedKey = ''
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

function seasonMeta(value: WorldSeason): string {
  const status = wt(seasonStatusKey(value.status))
  const points = seasonPoints(value)
  return points ? `${points} · ${status}` : status
}

function streakTone(status: WorldStreak['status']): string {
  if (status === 'ACTIVE') return 'ok'
  if (status === 'AT_RISK') return 'warn'
  if (status === 'BROKEN') return 'bad'
  return 'neutral'
}

onShow(() => {
  if (dropIfRouteLeft()) return
  const wasVisible = visible
  visible = true
  b4.restore()
  if (wasVisible && (showInFlight || loadFlight || adoptedKey)) return
  reloadAfterFlight = false
  const token = ++showEpoch
  void initialise(token)
})

onHide(() => {
  visible = false
  showEpoch += 1
  pageEpoch += 1
  reloadAfterFlight = false
  adoptedKey = ''
})

watch(() => session.identityRevision, () => {
  if (dropIfRouteLeft()) return
  if (!visible) return
  const key = identityKey()
  if (!session.isAuthenticated) {
    pageEpoch += 1
    resetData()
    accessBlocked.value = true
    status.value = 'permission'
    statusKey.value = 'permission'
    reloadAfterFlight = false
    adoptedKey = ''
    return
  }
  if (showInFlight || loadFlight) {
    pageEpoch += 1
    resetData()
    reloadAfterFlight = true
    return
  }
  if (key && key === adoptedKey) return
  pageEpoch += 1
  resetData()
  adoptedKey = ''
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
      <text v-if="status === 'ready'" class="world-live world-live--quiet" role="status">{{ statusText }}</text>
      <view class="world-quality-dock">
        <picker :range="qualityLabels" :value="qualityIndex" @change="changeQuality">
          <view class="world-quality">{{ wt('quality') }} · {{ qualityLabels[qualityIndex] }}</view>
        </picker>
      </view>
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
      <view v-if="pageFailure" class="world-state" role="alert">
        <image class="world-state-mascot" src="/static/figma-world-core/imgMascot-d54a4be0.svg" mode="aspectFit" aria-hidden="true" />
        <text class="world-state-title">{{ statusText }}</text>
        <text class="world-state-body">{{ wt('loadingHint') }}</text>
        <button class="world-state-retry" type="button" @click="retry">{{ wt('retry') }}</button>
      </view>

      <view v-else-if="featureClosed" class="world-closed" role="status">
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
        <view v-if="status === 'loading' || status === 'partial'" class="world-inline-status" role="status">
          <view class="world-inline-copy">
            <text class="world-inline-title">{{ statusText }}</text>
            <text class="world-inline-hint">{{ wt('loadingHint') }}</text>
          </view>
          <button v-if="showStatusRetry" class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
        </view>
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
          <view v-if="activeStreak" class="world-stat world-stat--streak">
            <text class="world-stat-value">{{ wt('days', { count: streak?.currentStreak ?? 0 }) }}</text>
            <text class="world-stat-label">{{ wt('streak') }}</text>
          </view>
        </view>

        <view class="world-card world-map-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('growthMap') }}</text>
            <text class="world-head-note">{{ wt('growthMapUnavailable') }}</text>
          </view>
          <view class="world-map-art" aria-hidden="true">
            <image class="world-star world-star--1" src="/static/figma-world-core/imgS-8aa360df.svg" mode="aspectFit" />
            <image class="world-star world-star--2" src="/static/figma-world-core/imgS1-49835748.svg" mode="aspectFit" />
            <image class="world-star world-star--3" src="/static/figma-world-core/imgS2-4d7cc3f6.svg" mode="aspectFit" />
            <image class="world-star world-star--4" src="/static/figma-world-core/imgS3-8c27187b.svg" mode="aspectFit" />
          </view>
        </view>

        <view class="world-card world-season-card">
          <view v-if="season" class="world-season-row">
            <view class="world-season-tile" aria-hidden="true">
              <image class="world-season-trophy" src="/static/figma-world-core/imgIconTrophy-1571c4ce.svg" mode="aspectFit" />
            </view>
            <view class="world-season-copy">
              <text class="world-season-title">{{ season.title ?? season.seasonId }}</text>
              <text class="world-meta world-season-meta">{{ seasonMeta(season) }}</text>
            </view>
          </view>
          <template v-else>
            <view class="world-card-head">
              <text class="world-card-title">{{ wt('season') }}</text>
              <image class="world-inline-icon" src="/static/figma-world-core/imgIconTrophy-1571c4ce.svg" mode="aspectFit" aria-hidden="true" />
            </view>
            <view v-if="seasonState === 'error'" class="world-section-error" role="alert">
              <text>{{ wt('seasonUnavailable') }}</text>
              <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
            </view>
            <text v-else-if="seasonState === 'empty'" class="world-empty">{{ wt('noSeason') }}</text>
          </template>
        </view>

        <view class="world-card world-space-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('space') }}</text>
          </view>
          <view class="world-entry-grid">
            <button class="world-entry" type="button" @click="navigate('/pages/b4-games/b4-games')">
              <view class="world-entry-well world-entry-well--brand" aria-hidden="true">
                <image class="world-entry-icon" src="/static/figma-world-core/imgIconGame-d3e0367c.svg" mode="aspectFit" />
              </view>
              <text class="world-entry-title">{{ wt('games') }}</text>
              <text class="world-entry-desc">{{ wt('gamesDesc') }}</text>
            </button>
            <button class="world-entry" type="button" @click="navigate('/pages/b4-social/b4-social')">
              <view class="world-entry-well world-entry-well--ok" aria-hidden="true">
                <image class="world-entry-icon" src="/static/figma-world-core/imgIconUsers-a47ef190.svg" mode="aspectFit" />
              </view>
              <text class="world-entry-title">{{ wt('social') }}</text>
              <text class="world-entry-desc">{{ wt('socialDesc') }}</text>
            </button>
            <button class="world-entry" type="button" @click="navigate('/pages/b4-avatar/b4-avatar')">
              <view class="world-entry-well world-entry-well--warn" aria-hidden="true">
                <image class="world-entry-icon" src="/static/figma-world-core/imgIconShirt-4ea65edd.svg" mode="aspectFit" />
              </view>
              <text class="world-entry-title">{{ wt('avatar') }}</text>
              <text class="world-entry-desc">{{ wt('avatarDesc') }}</text>
            </button>
            <button class="world-entry" type="button" @click="navigate('/pages/b4-offline/b4-offline')">
              <view class="world-entry-well world-entry-well--neutral" aria-hidden="true">
                <image class="world-entry-icon" src="/static/figma-world-core/imgIconDownload-8e6deb40.svg" mode="aspectFit" />
              </view>
              <text class="world-entry-title">{{ wt('offlineEntry') }}</text>
              <text class="world-entry-desc">{{ wt('offlineEntryDesc') }} · {{ wt('offlineClosed') }}</text>
            </button>
          </view>
        </view>

        <view class="world-card world-streak-card">
          <view class="world-card-head">
            <text class="world-card-title">{{ wt('streak') }}</text>
            <text v-if="streak" class="world-tag" :class="`world-tag--${streakTone(streak.status)}`">{{ wt(streakStatusKey(streak.status)) }}</text>
            <image class="world-inline-icon" src="/static/figma-world-core/imgIconFlame-2c1c73a2.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <view v-if="streakState === 'error'" class="world-section-error" role="alert">
            <text>{{ wt('streakUnavailable') }}</text>
            <button class="world-link" type="button" @click="retry">{{ wt('retry') }}</button>
          </view>
          <template v-else-if="streak">
            <text class="world-streak-number">{{ wt('days', { count: streak.currentStreak }) }}</text>
            <text v-if="streak.timeZone" class="world-meta">{{ wt('streakTimeZone', { zone: streak.timeZone }) }}</text>
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
        <view v-else class="world-card world-rewards">
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
  background-color: var(--v2-bg);
  background-image: linear-gradient(180deg, var(--v2-soft), var(--v2-bg));
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--v2-ink);
  font-family: var(--v2-font);
}
.world-glow { position: absolute; top: -140px; right: -120px; width: min(360px, 92vw); height: 300px; overflow: hidden; pointer-events: none; }
.world-glow-image { display: block; width: 100%; height: 100%; }
.world-header { position: relative; z-index: 2; padding: calc(8px + env(safe-area-inset-top)) 24px 0; }
.world-header :deep(.mobile-topbar),
.world-header :deep(.mobile-kicker),
.world-header :deep(.mobile-book-art) { display: none; }
.world-header :deep(.mobile-intro--world) { padding: 8px 0 0; border-radius: 0; background: none; overflow: visible; }
.world-header :deep(.mobile-intro--world .mobile-intro-copy) { display: flex; flex-direction: column; gap: 4px; max-width: 100%; }
.world-header :deep(.mobile-page-title) { margin: 0; color: var(--v2-ink); font-size: 28px; font-weight: 700; line-height: 36px; letter-spacing: 0; }
.world-header :deep(.mobile-page-description) { max-width: none; margin: 0; color: var(--v2-mut); font-size: 14px; font-weight: 400; line-height: 22px; }
.world-body { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 16px; padding: 16px 24px 0; }
.world-live--quiet {
  position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap; border: 0;
}
.world-quality-dock { position: absolute; z-index: 3; top: calc(16px + env(safe-area-inset-top)); right: 24px; }
.world-quality {
  display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;
  min-width: 44px; min-height: 44px; padding: 0 2px; border: 0; background: transparent;
  color: var(--v2-brand); font-size: 12px; font-weight: 700; line-height: 18px; white-space: nowrap;
}
.world-inline-status { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; }
.world-inline-copy { display: grid; gap: 2px; min-width: 0; }
.world-inline-title { color: var(--v2-ink); font-size: 13px; font-weight: 700; line-height: 20px; }
.world-inline-hint { color: var(--v2-mut); font-size: 12px; line-height: 18px; }
.world-state {
  display: flex; flex-direction: column; align-items: center; gap: 12px; box-sizing: border-box;
  width: 100%; margin-top: 58px; padding: 24px 20px; border: 1px solid var(--v2-line); border-radius: 18px;
  background: var(--v2-card); box-shadow: var(--v2-shadow); text-align: center;
}
.world-state-mascot { display: block; width: 120px; height: 120px; }
.world-state-title { color: var(--v2-ink); font-size: 22px; font-weight: 700; line-height: 32px; }
.world-state-body { color: var(--v2-mut); font-size: 15px; line-height: 24px; }
.world-page .world-state-retry {
  display: flex; align-items: center; justify-content: center; box-sizing: border-box; width: 100%;
  min-height: 44px; height: auto; margin: 12px 0 0; padding: 12px 20px; border: 0; border-radius: 14px;
  background-color: var(--v2-brand); background-image: var(--v2-grad); color: var(--v2-inverse);
  font-family: var(--v2-font); font-size: 16px; font-weight: 700; line-height: 1.5;
}
.world-page .world-state-retry::after { border: 0; }
.world-page .world-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 6px 8px; border: 0; border-radius: 8px; color: var(--v2-brand); background: transparent; font-family: var(--v2-font); font-size: 13px; font-weight: 700; }
.world-page .world-link::after { border: 0; }
.world-page .world-link--start { justify-self: start; padding-left: 0; }
.world-hero {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 22px 22px 20px; border-radius: 28px; color: var(--v2-inverse);
  background-color: var(--v2-brand); background-image: var(--v2-grad);
  box-shadow: var(--v2-shadow);
}
.world-hero-copy { display: grid; gap: 4px; min-width: 0; }
.world-hero-level { color: color-mix(in srgb, var(--v2-inverse) 82%, transparent); font-size: 13px; font-weight: 600; line-height: 20px; }
.world-hero-xp { color: var(--v2-inverse); font-size: 26px; font-weight: 700; line-height: 34px; overflow-wrap: anywhere; }
.world-hero-art { display: flex; flex: 0 0 72px; align-items: center; justify-content: center; width: 72px; height: 72px; border-radius: 24px; background: color-mix(in srgb, var(--v2-inverse) 18%, transparent); }
.world-hero-rocket { display: block; width: 34px; height: 34px; }
.world-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.world-stat { display: grid; gap: 2px; justify-items: center; padding: 14px 12px; border-radius: 18px; background: var(--v2-card); box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow)); }
.world-stat-value { color: var(--v2-brand); font-size: 22px; font-weight: 700; line-height: 30px; }
.world-stat--streak .world-stat-value { color: var(--v2-ok); }
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
.world-card-title { color: var(--v2-ink); font-size: 18px; font-weight: 700; line-height: 26px; }
.world-head-note { margin-left: auto; max-width: 58%; color: var(--v2-mut); font-size: 13px; font-weight: 500; line-height: 20px; text-align: right; }
.world-inline-icon { display: block; width: 20px; height: 20px; margin-left: auto; }
.world-map-card { gap: 10px; }
.world-map-art {
  display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;
  height: 120px; padding: 0 24px; overflow: hidden; border-radius: 20px;
  background: linear-gradient(153deg, var(--v2-side), var(--v2-brand));
}
.world-star { display: block; flex: 0 0 auto; opacity: .95; }
.world-star--1, .world-star--3 { width: 22px; height: 22px; }
.world-star--2, .world-star--4 { width: 30px; height: 30px; }
.world-meta { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 19px; overflow-wrap: anywhere; }
.world-note { display: block; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.world-empty { display: block; padding: 6px 0; color: var(--yx-r4-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 22px; }
.world-season-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.world-season-tile { display: flex; flex: 0 0 44px; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; background: var(--v2-warn-soft); }
.world-season-trophy { display: block; width: 22px; height: 22px; }
.world-season-copy { display: grid; gap: 2px; min-width: 0; }
.world-season-title { color: var(--v2-ink); font-size: 17px; font-weight: 700; line-height: 24px; overflow-wrap: anywhere; }
.world-season-meta { color: var(--v2-mut); font-size: 12px; line-height: 18px; }
.world-space-card { gap: 10px; }
.world-entry-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.world-page .world-entry {
  display: flex; flex-direction: column; align-items: flex-start; gap: 8px;
  min-height: 0; margin: 0; padding: 14px; border: 0; border-radius: 20px;
  background: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); text-align: left;
}
.world-page .world-entry::after { border: 0; }
.world-entry-well { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 13px; background: var(--v2-soft); }
.world-entry-well--brand { background: var(--v2-soft); }
.world-entry-well--ok { background: var(--v2-ok-soft); }
.world-entry-well--warn { background: var(--v2-warn-soft); }
.world-entry-well--neutral { background: var(--v2-surface); }
.world-entry-icon { display: block; width: 20px; height: 20px; }
.world-entry-title { color: var(--v2-ink); font-size: 15px; font-weight: 700; line-height: 22px; }
.world-entry-desc { color: var(--v2-mut); font-size: 12px; line-height: 18px; overflow-wrap: anywhere; }
.world-streak-card .world-tag { margin-left: auto; }
.world-streak-card .world-inline-icon { margin-left: 0; }
.world-streak-number { color: var(--v2-ink); font-size: 28px; font-weight: 700; line-height: 34px; }
.world-quest { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 0; border-top: 1px solid var(--v2-line); }
.world-quest:first-of-type { border-top: 0; }
.world-quest-copy { display: grid; gap: 2px; min-width: 0; }
.world-quest-title { color: var(--v2-ink); font-size: 14px; font-weight: 700; line-height: 20px; }
.world-tag { flex: 0 0 auto; padding: 3px 10px; border-radius: 999px; color: var(--v2-brand); background: var(--v2-soft); font-size: 12px; font-weight: 700; line-height: 18px; white-space: nowrap; }
.world-tag--ok { color: var(--v2-ok); background: var(--v2-ok-soft); }
.world-tag--warn { color: var(--v2-warn); background: var(--v2-warn-soft); }
.world-tag--bad { color: var(--v2-bad); background: var(--v2-bad-soft); }
.world-tag--neutral { color: var(--v2-mut); background: var(--v2-surface); }
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
.world-quests-card { padding-top: 8px; padding-bottom: 8px; }
.world-rewards { display: grid; gap: 10px; min-width: 0; }
.world-rewards .b12-card { margin-top: 0; }
@media (max-width: 360px) {
  .world-body { padding-right: 16px; padding-left: 16px; }
  .world-header { padding-right: 16px; padding-left: 16px; }
  .world-map-card .world-card-head { align-items: flex-start; flex-wrap: wrap; }
  .world-head-note { max-width: 100%; margin-left: 0; text-align: left; }
  .world-quality-dock { right: 16px; }
  .world-inline-status { align-items: flex-start; }
  .world-entry-grid { grid-template-columns: 1fr; }
}
@media (prefers-contrast: more) {
  .world-page .world-state,
  .world-page .world-card,
  .world-page .world-alert,
  .world-page .world-closed,
  .world-page .world-stat,
  .world-page .world-entry,
  .world-page .world-season-tile {
    border: 2px solid var(--v2-ink);
    background: var(--v2-card);
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
.world-page.b10-theme--high-contrast .world-state,
.world-page.b10-theme--high-contrast .world-card,
.world-page.b10-theme--high-contrast .world-alert,
.world-page.b10-theme--high-contrast .world-closed,
.world-page.b10-theme--high-contrast .world-stat,
.world-page.b10-theme--high-contrast .world-entry,
.world-page.b10-theme--high-contrast .world-season-tile {
  border: 2px solid var(--v2-ink);
  background: var(--v2-card);
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
.world-page.b10-theme--dark .world-hero,
.world-page.b10-theme--high-contrast .world-hero { color: var(--v2-ink); background-image: none; background-color: var(--v2-side); }
.world-page.b10-theme--dark .world-hero-level,
.world-page.b10-theme--high-contrast .world-hero-level { color: var(--v2-mut); }
.world-page.b10-theme--dark .world-hero-xp,
.world-page.b10-theme--high-contrast .world-hero-xp { color: var(--v2-ink); }
.world-page.b10-theme--dark .world-hero-rocket,
.world-page.b10-theme--high-contrast .world-hero-rocket { filter: brightness(0) invert(1); }
</style>
