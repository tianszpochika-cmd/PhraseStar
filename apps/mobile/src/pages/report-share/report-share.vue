<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide, onLoad, onShow } from '@dcloudio/uni-app'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { getGatewayBaseUrl } from '../../platform/gateway'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { mobileI18n } from '../../platform/v2-foundation'
import { interpolate } from '@englishflow/i18n'

const { experienceStyle, experienceMotion } = useMobileExperience()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const status = ref<'LOADING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR'>('LOADING')
const publicShare = ref<PublicShare | null>(null)
const shareRef = ref('')
const requesting = ref(false)
const retrying = ref(false)
const actionError = ref('')
let generation = 0
let visible = true

type ShareAvailability = 'READY' | 'PARTIAL' | 'GENERATING' | 'FAILED' | 'NEVER_STUDIED' | 'NOT_READY' | 'EMPTY' | 'UNKNOWN'
type DurationStatus = 'COUNTED' | 'NOT_RECORDED' | 'UNKNOWN'
interface PublicShare {
  readonly availability: ShareAvailability
  readonly copy: string
  readonly periodStart: string
  readonly periodEndExclusive: string
  readonly newItems: number | null
  readonly reviewItems: number | null
  readonly durationStatus: DurationStatus
  readonly durationCopy: string
  readonly activeMillis: number | null
  readonly suggestion: string
  readonly suggestionBasis: string
}
type ParsedShare = { readonly kind: 'ACTIVE'; readonly share: PublicShare } | { readonly kind: 'REVOKED' } | { readonly kind: 'EXPIRED' }

function shareT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`reportSharePage.${key}`)
  return values ? interpolate(message, values) : message
}
function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function text(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function count(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null }
function availability(value: unknown): ShareAvailability {
  const normalized = text(value).toUpperCase()
  return normalized === 'READY' || normalized === 'PARTIAL' || normalized === 'GENERATING' || normalized === 'FAILED' || normalized === 'NEVER_STUDIED' || normalized === 'NOT_READY' || normalized === 'EMPTY' ? normalized : 'UNKNOWN'
}
function durationStatus(value: unknown): DurationStatus {
  const normalized = text(value).toUpperCase()
  return normalized === 'COUNTED' || normalized === 'NOT_RECORDED' ? normalized : 'UNKNOWN'
}
function parseShare(value: unknown): ParsedShare | null {
  const envelope = record(value)
  if (!envelope) return null
  const source = record(envelope.data) ?? envelope
  const next = text(source.status).toUpperCase()
  if (next === 'REVOKED') return { kind: 'REVOKED' }
  if (next === 'EXPIRED') return { kind: 'EXPIRED' }
  if (next !== 'ACTIVE') return null
  return {
    kind: 'ACTIVE',
    share: {
      availability: availability(source.availability),
      copy: text(source.copy),
      periodStart: text(source.periodStart),
      periodEndExclusive: text(source.periodEndExclusive),
      newItems: count(source.newItems),
      reviewItems: count(source.reviewItems),
      durationStatus: durationStatus(source.durationStatus),
      durationCopy: text(source.durationCopy),
      activeMillis: count(source.activeMillis),
      suggestion: text(source.suggestion),
      suggestionBasis: text(source.suggestionBasis),
    },
  }
}
function invalidate(): void {
  generation += 1
  requesting.value = false
  retrying.value = false
  shareRef.value = ''
  publicShare.value = null
  status.value = 'NOT_FOUND'
  actionError.value = ''
}
function loadShare(keepRetry = false): void {
  if (!shareRef.value) { invalidate(); return }
  const currentGeneration = ++generation
  visible = true
  if (!keepRetry) retrying.value = false
  status.value = 'LOADING'
  publicShare.value = null
  actionError.value = ''
  requesting.value = true
  try {
    getUniRuntime().request({
      url: `${getGatewayBaseUrl()}/public/learning/report-shares/${shareRef.value}`,
      method: 'GET',
      success: (response) => {
        if (currentGeneration !== generation || !visible) return
        requesting.value = false
        retrying.value = false
        if (response.statusCode === 404) { status.value = 'NOT_FOUND'; return }
        if (response.statusCode < 200 || response.statusCode >= 300) { status.value = 'ERROR'; return }
        const parsed = parseShare(response.data as unknown)
        if (!parsed) { status.value = 'ERROR'; return }
        if (parsed.kind === 'ACTIVE') { publicShare.value = parsed.share; status.value = 'ACTIVE' }
        else status.value = parsed.kind
      },
      fail: () => {
        if (currentGeneration !== generation || !visible) return
        requesting.value = false
        retrying.value = false
        status.value = 'ERROR'
      },
    })
  } catch {
    if (currentGeneration !== generation) return
    requesting.value = false
    retrying.value = false
    status.value = 'ERROR'
  }
}
function retry(): void { if (!requesting.value && shareRef.value) { retrying.value = true; loadShare(true) } }
async function returnHome(): Promise<void> {
  actionError.value = ''
  try { await Promise.resolve(openUniPage('/pages/home/home')) }
  catch { actionError.value = shareT('navigationFailed') }
}

onLoad((query) => {
  const next = String(query?.ref ?? '').trim()
  if (!/^[0-9a-f]{32}$/.test(next)) { invalidate(); return }
  if (next !== shareRef.value) {
    shareRef.value = next
    loadShare()
    return
  }
  if (!requesting.value && status.value === 'LOADING') loadShare()
})
onShow(() => {
  visible = true
  if (shareRef.value && !requesting.value) loadShare()
})
onHide(() => {
  visible = false
  generation += 1
  requesting.value = false
  retrying.value = false
})
onBeforeUnmount(() => {
  visible = false
  generation += 1
})

function dateValue(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return date
}
function formatDate(value: string, minusOneDay = false): string {
  const date = dateValue(value)
  if (!date) return ''
  if (minusOneDay) date.setUTCDate(date.getUTCDate() - 1)
  return mobileI18n.formatDate(date, { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
const periodText = computed(() => {
  const share = publicShare.value
  if (!share) return ''
  const startDate = dateValue(share.periodStart)
  const endDate = dateValue(share.periodEndExclusive)
  if (!startDate || !endDate || endDate <= startDate) return ''
  const start = formatDate(share.periodStart)
  const end = formatDate(share.periodEndExclusive, true)
  if (!start || !end) return ''
  return shareT('periodRange', { start, end })
})
const availabilityTag = computed(() => {
  const value = publicShare.value?.availability
  if (value === 'READY') return shareT('ready')
  if (value === 'PARTIAL') return shareT('partial')
  if (value === 'GENERATING') return shareT('generating')
  if (value === 'FAILED') return shareT('failed')
  if (value === 'NEVER_STUDIED') return shareT('never')
  if (value === 'NOT_READY') return shareT('notReady')
  if (value === 'EMPTY') return shareT('empty')
  return shareT('unknown')
})
const copyText = computed(() => publicShare.value?.copy || shareT('copyUnavailable'))
const showStats = computed(() => {
  const share = publicShare.value
  return Boolean(share && (share.availability === 'READY' || share.availability === 'PARTIAL'))
})
const newItemsText = computed(() => {
  const value = publicShare.value?.newItems
  return value === null || value === undefined ? shareT('notAvailable') : mobileI18n.formatNumber(value)
})
const reviewItemsText = computed(() => {
  const value = publicShare.value?.reviewItems
  return value === null || value === undefined ? shareT('notAvailable') : mobileI18n.formatNumber(value)
})
const durationText = computed(() => {
  const share = publicShare.value
  if (!share) return shareT('notAvailable')
  if (share.durationStatus !== 'COUNTED' || share.activeMillis === null) return shareT('notAvailable')
  const totalMinutes = Math.round(share.activeMillis / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return shareT('durationMinutes', { count: mobileI18n.formatNumber(minutes) })
  return shareT('durationCompact', { hours: mobileI18n.formatNumber(hours), minutes: mobileI18n.formatNumber(minutes) })
})
const durationNote = computed(() => {
  const share = publicShare.value
  if (!share) return ''
  if (share.durationStatus === 'NOT_RECORDED') return share.durationCopy || shareT('durationUnverified')
  if (share.durationStatus === 'UNKNOWN') return shareT('durationUnverified')
  return share.durationCopy || ''
})
const basisText = computed(() => {
  const share = publicShare.value
  if (!share) return ''
  const key = `basis.${share.suggestionBasis}`
  const mapped = mobileT(`reportSharePage.${key}`)
  return mapped === `reportSharePage.${key}` ? share.suggestionBasis : mapped
})
const showSuggestion = computed(() => Boolean(publicShare.value?.suggestion))
const showBottomBar = computed(() => status.value !== 'LOADING' || retrying.value)
const isPartial = computed(() => publicShare.value?.availability === 'PARTIAL')
const glowSrc = computed(() => {
  if (status.value === 'ACTIVE') return '/static/figma-report-share-169-1714/imgGlow.svg'
  if (status.value === 'REVOKED' || status.value === 'EXPIRED') return '/static/figma-report-share-169-1799/imgGlow.svg'
  if (status.value === 'ERROR') return '/static/figma-report-share-169-1863/imgGlow.svg'
  if (status.value === 'NOT_FOUND') return '/static/figma-report-share-169-1799/imgGlow.svg'
  return '/static/figma-report-share-169-1652/imgGlow.svg'
})
const iconLink = '/static/figma-report-share-169-1799/imgIconLink.svg'
const iconMascot = '/static/figma-report-share-169-1863/imgMascot.svg'
const iconLightbulb = '/static/figma-report-share-169-1714/imgIconLightbulb.svg'
const loadingTips = [
  { title: 'loadingTip1Title', body: 'loadingTip1Body', dot: '/static/figma-report-share-169-1652/imgDot.svg' },
  { title: 'loadingTip2Title', body: 'loadingTip2Body', dot: '/static/figma-report-share-169-1652/imgDot1.svg' },
  { title: 'loadingTip3Title', body: 'loadingTip3Body', dot: '/static/figma-report-share-169-1652/imgDot2.svg' },
] as const
</script>

<template>
  <view id="report-share-page" class="yx-page share-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion" :data-share-status="status">
    <view class="share-glow-wrap" aria-hidden="true"><image class="share-glow" :src="glowSrc" mode="aspectFit" /></view>
    <MobilePageHeader page="report-share" compact :title="shareT('title')" :show-settings="false" />
    <view class="share-body" :class="{ 'share-body--state': status !== 'LOADING' && status !== 'ACTIVE' }">
      <view v-if="status === 'LOADING' || status === 'ACTIVE'" class="share-title-block">
        <text class="share-page-title" role="heading" aria-level="1">{{ shareT('title') }}</text>
        <text class="share-page-subtitle">{{ shareT('subtitle') }}</text>
      </view>

      <view v-if="status === 'LOADING'" class="share-loading" role="status" aria-live="polite">
        <text class="share-loading-label">{{ shareT('loading') }}</text>
        <view class="share-skeleton-card" aria-hidden="true"><view class="share-skeleton-title"></view><view class="share-skeleton-row"><view class="share-skeleton-stat"></view><view class="share-skeleton-stat"></view><view class="share-skeleton-stat"></view></view><view class="share-skeleton-line"></view></view>
        <view class="share-tips">
          <view v-for="tip in loadingTips" :key="tip.title" class="share-tip-card">
            <view class="share-tip-head"><image class="share-dot" :src="tip.dot" mode="aspectFit" aria-hidden="true" /><text class="share-tip-title">{{ shareT(tip.title) }}</text></view>
            <text class="share-note">{{ shareT(tip.body) }}</text>
          </view>
        </view>
      </view>

      <view v-else-if="status === 'ERROR'" class="share-state-card" role="alert">
        <image class="share-mascot" :src="iconMascot" mode="aspectFit" aria-hidden="true" />
        <text class="share-state-title">{{ shareT('errorTitle') }}</text>
        <text class="share-state-body">{{ shareT('errorBody') }}</text>
      </view>
      <view v-else-if="status === 'NOT_FOUND'" class="share-state-card" role="status">
        <view class="share-badge"><image class="share-link-icon" :src="iconLink" mode="aspectFit" aria-hidden="true" /></view>
        <text class="share-state-title">{{ shareT('notFoundTitle') }}</text>
        <text class="share-state-body">{{ shareT('notFoundBody') }}</text>
      </view>
      <view v-else-if="status === 'REVOKED'" class="share-state-card" role="status">
        <view class="share-badge"><image class="share-link-icon" :src="iconLink" mode="aspectFit" aria-hidden="true" /></view>
        <text class="share-state-title">{{ shareT('revokedTitle') }}</text>
        <text class="share-state-body">{{ shareT('revokedBody') }}</text>
      </view>
      <view v-else-if="status === 'EXPIRED'" class="share-state-card" role="status">
        <view class="share-badge"><image class="share-link-icon" :src="iconLink" mode="aspectFit" aria-hidden="true" /></view>
        <text class="share-state-title">{{ shareT('expiredTitle') }}</text>
        <text class="share-state-body">{{ shareT('expiredBody') }}</text>
      </view>
      <view v-else-if="status === 'ACTIVE'" class="share-report">
        <view class="share-report-card">
          <view class="share-report-head"><text class="share-report-title">{{ shareT('reportHeading') }}</text><text class="share-tag">{{ availabilityTag }}</text></view>
          <text v-if="periodText" class="share-period">{{ periodText }}</text>
          <text class="share-copy">{{ copyText }}</text>
          <view v-if="showStats" class="share-stats">
            <view class="share-stat"><text class="share-stat-value">{{ newItemsText }}</text><text class="share-stat-label">{{ shareT('newItems') }}</text></view>
            <view class="share-stat"><text class="share-stat-value">{{ reviewItemsText }}</text><text class="share-stat-label">{{ shareT('reviewItems') }}</text></view>
            <view class="share-stat"><text class="share-stat-value">{{ durationText }}</text><text class="share-stat-label">{{ shareT('effectiveStudy') }}</text></view>
          </view>
          <text v-if="isPartial" class="share-note share-partial-note">{{ shareT('partialNote') }}</text>
        </view>
        <view v-if="publicShare" class="share-duration-card">
          <text class="share-card-title">{{ shareT('effectiveStudy') }} {{ durationText }}</text>
          <text class="share-note">{{ durationNote }}</text>
        </view>
        <view v-if="showSuggestion" class="share-suggestion-card">
          <view class="share-suggestion-head"><image class="share-lightbulb" :src="iconLightbulb" mode="aspectFit" aria-hidden="true" /><text class="share-card-title">{{ shareT('suggestionPrefix') }}{{ publicShare?.suggestion }}</text></view>
          <text v-if="publicShare?.suggestionBasis" class="share-note">{{ shareT('basisPrefix') }}{{ basisText }}</text>
        </view>
      </view>
    </view>

    <view v-if="showBottomBar" class="share-bottom-bar" role="region">
      <text v-if="actionError" class="share-error" role="alert">{{ actionError }}</text>
      <button v-if="status === 'ERROR' || retrying" tabindex="0" role="button" type="button" class="share-action" :disabled="requesting" :aria-busy="requesting ? 'true' : 'false'" @click="retry">{{ retrying ? shareT('retrying') : shareT('retry') }}</button>
      <button v-else tabindex="0" role="button" type="button" class="share-action" @click="returnHome">{{ shareT('returnHome') }}</button>
    </view>
  </view>
</template>

<style scoped>
#report-share-page { position: relative; box-sizing: border-box; min-height: 100vh; max-width: none; padding: 0; overflow-x: clip; background-color: var(--v2-bg); background-image: var(--yx-profile-page-image, none); background-repeat: no-repeat; background-size: cover; color: var(--v2-ink); font-family: var(--v2-font); }
#report-share-page * { box-sizing: border-box; }
#report-share-page :deep(.mobile-back) { display: flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
.share-glow-wrap { position: absolute; top: -140px; right: -120px; z-index: 0; width: 360px; height: 300px; overflow: visible; pointer-events: none; }
.share-glow { position: absolute; top: -90px; left: -90px; width: 540px; height: 480px; max-width: none; }
.b10-theme--dark .share-glow { opacity: .24; }
.b10-theme--high-contrast .share-glow-wrap { display: none; }
.share-body { position: relative; z-index: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 8px 24px calc(118px + env(safe-area-inset-bottom)); display: grid; gap: 16px; }
.share-title-block { display: grid; gap: 4px; padding: 8px 0 0; }
.share-body--state { min-height: calc(100vh - 160px); align-content: center; }
.share-page-title { display: block; color: var(--v2-ink); font-size: var(--v2-text-2xl); font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.share-page-subtitle { display: block; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.5; }
.share-loading { display: grid; gap: 12px; }
.share-loading-label { display: block; color: var(--v2-mut); font-size: var(--v2-text-sm); }
.share-skeleton-card { display: grid; gap: 10px; padding: 19px 21px; border: 1px solid var(--yx-profile-glass-border, var(--v2-line)); border-radius: 24px; background: var(--yx-profile-glass, var(--v2-card)); box-shadow: var(--yx-profile-card-shadow, none); }
.share-skeleton-title { width: 160px; height: 24px; border-radius: 8px; background: var(--v2-surface); }
.share-skeleton-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.share-skeleton-stat { height: 64px; border-radius: 12px; background: var(--v2-surface); }
.share-skeleton-line { width: 100%; height: 16px; border-radius: 8px; background: var(--v2-surface); }
.share-tips { display: grid; gap: 12px; }
.share-tip-card { display: grid; gap: 6px; padding: 14px 16px; border: 1px solid var(--v2-line); border-radius: 18px; background: var(--v2-card); box-shadow: var(--yx-profile-card-shadow, none); }
.share-tip-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
.share-dot { display: block; flex: none; width: 8px; height: 8px; }
.share-tip-title { color: var(--v2-ink); font-size: var(--v2-text-sm); font-weight: 600; }
.share-note { display: block; color: var(--v2-mut); font-size: var(--v2-text-xs); line-height: 1.6; overflow-wrap: anywhere; }
.share-state-card { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; padding: 24px; border: 1px solid var(--v2-line); border-radius: 18px; background: var(--v2-card); box-shadow: var(--yx-profile-card-shadow, none); text-align: center; }
.share-badge { display: flex; align-items: center; justify-content: center; width: 96px; height: 96px; border-radius: 48px; background: var(--v2-surface); }
.share-link-icon { display: block; width: 44px; height: 44px; }
.share-mascot { display: block; width: 120px; height: 120px; }
.share-state-title { display: block; color: var(--v2-ink); font-size: 22px; font-weight: 700; line-height: 1.4; text-align: center; }
.share-state-body { display: block; color: var(--v2-mut); font-size: 15px; line-height: 1.5; text-align: center; }
.share-report { display: grid; gap: 16px; }
.share-report-card { display: grid; gap: 8px; padding: 20px; border: 1px solid var(--yx-profile-glass-border, var(--v2-line)); border-radius: 24px; background: var(--yx-profile-glass, var(--v2-card)); box-shadow: var(--yx-profile-card-shadow, none); }
.share-report-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.share-report-title { color: var(--v2-ink); font-size: 18px; font-weight: 700; line-height: 1.4; }
.share-tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; background: var(--v2-ok-soft); color: var(--v2-ok); font-size: 12px; font-weight: 700; line-height: 1.5; }
.share-period { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; }
.share-copy { display: block; color: var(--v2-mut); font-size: 14px; line-height: 1.6; }
.share-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.share-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 14px 10px; border-radius: 18px; background: var(--v2-card); box-shadow: var(--v2-shadow); text-align: center; }
.share-stat-value { display: block; color: var(--v2-brand); font-size: 22px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.share-stat-label { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; }
.share-duration-card, .share-suggestion-card { display: grid; gap: 6px; padding: 18px 20px; border: 1px solid var(--v2-line); border-radius: 24px; background: var(--v2-card); box-shadow: var(--yx-profile-card-shadow, none); }
.share-card-title { display: block; color: var(--v2-ink); font-size: 16px; font-weight: 600; line-height: 1.4; overflow-wrap: anywhere; }
.share-suggestion-head { display: flex; align-items: flex-start; gap: 8px; }
.share-lightbulb { display: block; flex: none; width: 18px; height: 18px; margin-top: 2px; }
.share-bottom-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; display: grid; gap: 8px; padding: 12px 24px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--v2-line); background: var(--v2-card); box-shadow: var(--yx-settings-bottom-bar-shadow, var(--yx-profile-card-shadow, none)); }
#report-share-page .share-action { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; padding: 12px 18px; border: 0; border-radius: 14px; background: var(--v2-brand); color: var(--v2-inverse); font: inherit; font-size: 16px; font-weight: 700; line-height: 1.5; }
.share-error { display: block; color: var(--v2-bad); font-size: 12px; line-height: 1.5; text-align: center; }
#report-share-page .share-action:focus-visible { outline: 2px solid var(--v2-focus); outline-offset: 2px; }
.b10-theme--high-contrast .share-report-card, .b10-theme--high-contrast .share-tip-card, .b10-theme--high-contrast .share-state-card, .b10-theme--high-contrast .share-duration-card, .b10-theme--high-contrast .share-suggestion-card { border-width: 2px; background: var(--v2-card); box-shadow: none; }
.b10-theme--high-contrast .share-bottom-bar { border-top-width: 2px; box-shadow: none; }
.b10-theme--high-contrast .share-skeleton-card { border-width: 2px; box-shadow: none; }
@media (max-width: 359px) { .share-body { padding-inline: 16px; } .share-bottom-bar { padding-inline: 16px; } .share-report-card, .share-state-card { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { #report-share-page * { animation: none !important; transition: none !important; } }
</style>
