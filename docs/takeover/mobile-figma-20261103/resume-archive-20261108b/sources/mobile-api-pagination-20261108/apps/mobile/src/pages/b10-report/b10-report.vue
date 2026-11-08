<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { useMobileExperience, mobileT } from '../../platform/experience'
import { b10ContentLocale, b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { mobileI18n } from '../../platform/v2-foundation'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { useSessionStore } from '../../stores/session'
import { useB10LearningStore } from '../../stores/b10-learning'
import { b10LearningApi } from '../../api/b10'
import type { B10Mistake } from '../../domain/b10'
import { createClientId } from '../../platform/client-id'
import { availabilityKind, confirmedReportSharePeriodChanged, inclusivePeriod, maskRef, publicSharePageUrl, reportShareDate, reportSharePeriodToken, shareReceipt } from './report-page'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const store = useB10LearningStore()
const PATH = '/pages/b10-report/b10-report'
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
type View = 'mistakes' | 'daily' | 'weekly'
type PageState = 'loading' | 'content' | 'empty' | 'error' | 'offline' | 'permission'

const view = ref<View>('mistakes')
const initialized = ref(false)
const accessDenied = ref(false)
const retryingId = ref<number | null>(null)
const retryNotice = ref('')
const detailOpen = ref(false)
const detailBusy = ref(false)
const detailError = ref('')
const detailMistake = ref<B10Mistake | null>(null)
const detailCloseButton = ref<{ focus?: () => void } | null>(null)
let detailPreviousFocus: HTMLElement | null = null
const shareRef = ref('')
const shareBusy = ref(false)
const shareNote = ref('')
const shareError = ref('')
interface ShareAttempt { key: string; kind: 'daily' | 'weekly'; token: string; date: string | null }
interface RevokeAttempt { ref: string; key: string }
let shareAttempt: ShareAttempt | null = null
let revokeAttempt: RevokeAttempt | null = null
let detailGeneration = 0
let shareGeneration = 0
let pageGeneration = 0
let retryGeneration = 0

function reportT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`reportPage.${key}`)
  return values ? interpolate(message, values) : message
}
function statusText(value: string): string {
  const key = `status.${value}`
  const label = mobileT(`reportPage.${key}`)
  return label === `reportPage.${key}` ? reportT('availability.unknown') : label
}
function masteryText(value: string): string {
  const key = `mastery.${value}`
  const label = mobileT(`reportPage.${key}`)
  return label === `reportPage.${key}` ? '' : label
}
function basisText(value: string): string {
  if (!value) return ''
  const key = `basis.${value}`
  const label = mobileT(`reportPage.${key}`)
  return label === `reportPage.${key}` ? reportT('suggestion.unknownBasis') : label
}
function minutesText(value: number): string {
  return reportT('stats.minutes', { count: mobileI18n.formatNumber(Math.round(value)) })
}

const pageState = computed<PageState>(() => {
  if (!initialized.value) return 'loading'
  if (accessDenied.value) return 'permission'
  if (view.value === 'mistakes') {
    if (store.status === 'forbidden') return 'permission'
    if (store.status === 'loading' && retryingId.value !== null) return 'content'
    if (store.status === 'loading' || store.status === 'idle') return 'loading'
    if (store.status === 'error' || store.status === 'offline' || store.status === 'stale') return 'error'
    if (store.status === 'empty') return 'empty'
    return 'content'
  }
  if (store.reportStatus === 'forbidden') return 'permission'
  if (store.reportStatus === 'loading' || store.reportStatus === 'idle') return 'loading'
  if (store.reportStatus === 'error' || store.reportStatus === 'offline' || store.reportStatus === 'stale') return 'error'
  return store.report ? 'content' : 'empty'
})
const period = computed(() => store.report?.period ?? null)
const availability = computed(() => availabilityKind(period.value?.availability))
const reportTitle = computed(() => view.value === 'weekly' ? reportT('report.weeklyTitle') : reportT('report.dailyTitle'))
const periodText = computed(() => {
  const value = inclusivePeriod(period.value?.periodStart, period.value?.periodEndExclusive)
  if (!value) return ''
  const start = mobileI18n.formatDate(value.start, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const end = mobileI18n.formatDate(value.end, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  return reportT('period.range', { start, end })
})
const periodZone = computed(() => {
  const zone = period.value?.learningDayZone
  if (!zone) return ''
  return zone === 'Asia/Shanghai' ? reportT('period.zoneShanghai') : reportT('period.zone', { zone })
})
const availabilityLabel = computed(() => reportT(`availability.${availability.value.toLowerCase()}`))
const copyText = computed(() => period.value?.copy || reportT('report.copyUnavailable'))
const showStats = computed(() => (availability.value === 'READY' || availability.value === 'PARTIAL') && Boolean(period.value))
const newItemsText = computed(() => period.value?.newItems === null || period.value?.newItems === undefined ? reportT('stats.notAvailable') : mobileI18n.formatNumber(period.value.newItems))
const reviewItemsText = computed(() => period.value?.reviewItems === null || period.value?.reviewItems === undefined ? reportT('stats.notAvailable') : mobileI18n.formatNumber(period.value.reviewItems))
const durationText = computed(() => {
  const value = period.value
  if (!value || value.durationStatus !== 'COUNTED' || value.activeMillis === null || value.activeMillis === undefined) return reportT('stats.notAvailable')
  return minutesText(value.activeMillis / 60000)
})
const durationNote = computed(() => {
  const value = period.value
  if (!value) return ''
  if (value.durationStatus !== 'COUNTED' || value.activeMillis === null || value.activeMillis === undefined) return reportT('duration.notCounted')
  return value.durationCopy || reportT('duration.missing')
})
const suggestionText = computed(() => period.value?.suggestion || '')
const basisLabel = computed(() => basisText(period.value?.suggestionBasis || ''))
const isPartial = computed(() => availability.value === 'PARTIAL')
const glowSrc = computed(() => {
  if (pageState.value === 'permission') return '/static/figma-report-noaccess-169-991/imgGlow.svg'
  if (pageState.value === 'error' || pageState.value === 'offline') return '/static/figma-report-mistakes-169-667/imgGlow.svg'
  if (pageState.value === 'loading') return '/static/figma-report-daily-169-1058/imgGlow.svg'
  if (view.value !== 'mistakes' && availability.value === 'PARTIAL') return '/static/figma-report-partial-169-1392/imgGlow.svg'
  if (view.value !== 'mistakes') return '/static/figma-report-daily-169-1058/imgGlow.svg'
  return '/static/figma-report-mistakes-169-667/imgGlow.svg'
})
const showShare = computed(() => (availability.value === 'READY') && Boolean(period.value))
const shareMasked = computed(() => shareRef.value ? reportT('share.masked', { ref: maskRef(shareRef.value) }) : '')
const publicOrigin = typeof window !== 'undefined' && window.location ? window.location.origin : ''
const sharePageUrl = computed(() => publicSharePageUrl(shareRef.value, publicOrigin))
const primaryAction = computed<null | 'login' | 'retry' | 'practice' | 'share' | 'copy'>(() => {
  if (pageState.value === 'loading') return null
  if (pageState.value === 'permission') return !session.isAuthenticated || !session.isLearningReady ? 'login' : 'retry'
  if (pageState.value === 'error' || pageState.value === 'offline') return 'retry'
  if (pageState.value === 'empty') return 'practice'
  if (view.value === 'mistakes') return 'practice'
  if (showShare.value && shareRef.value) return 'copy'
  if (showShare.value) return 'share'
  return 'practice'
})
const primaryLabel = computed(() => {
  if (shareBusy.value && primaryAction.value === 'share') return reportT('share.issueBusy')
  if (primaryAction.value === 'login') return reportT('actions.login')
  if (primaryAction.value === 'retry') return reportT('actions.retry')
  if (primaryAction.value === 'share') return reportT('share.issue')
  if (primaryAction.value === 'copy') return reportT('share.copy')
  return reportT('actions.practice')
})
const primaryDisabled = computed(() => shareBusy.value || retryingId.value !== null || (primaryAction.value === 'copy' && !sharePageUrl.value))

function clearShare(): void {
  shareGeneration += 1
  shareAttempt = null
  revokeAttempt = null
  shareRef.value = ''
  shareNote.value = ''
  shareError.value = ''
  shareBusy.value = false
}
function retainShareForConfirmedPeriod(): void {
  if (!shareAttempt) return
  if (!confirmedReportSharePeriodChanged({
    boundToken: shareAttempt.token,
    status: store.reportStatus,
    kind: view.value,
    period: store.report?.period,
  })) return
  clearShare()
}
function ensureShareAttempt(kind: 'daily' | 'weekly', period: { periodStart?: unknown; periodEndExclusive?: unknown }): ShareAttempt | null {
  const token = reportSharePeriodToken(kind, period)
  if (!token) return null
  if (shareAttempt && shareAttempt.kind === kind && shareAttempt.token === token) return shareAttempt
  shareAttempt = { key: createClientId('mb016-report-share'), kind, token, date: reportShareDate(period.periodStart) }
  return shareAttempt
}
function pageCurrent(generation: number, revision: number): boolean {
  return generation === pageGeneration && revision === session.identityRevision
}
function loadCurrent(): void {
  const generation = ++pageGeneration
  const revision = session.identityRevision
  initialized.value = false
  const task = view.value === 'mistakes' ? store.loadMistakes() : store.loadReport(view.value)
  void task.finally(() => {
    if (!pageCurrent(generation, revision)) return
    retainShareForConfirmedPeriod()
    initialized.value = true
  })
}
async function showPage(): Promise<void> {
  const generation = ++pageGeneration
  initialized.value = false
  accessDenied.value = false
  try { await session.restore() } catch { /* session clears itself */ }
  if (generation !== pageGeneration) return
  if (!session.isAuthenticated || !session.isLearningReady) {
    clearShare()
    accessDenied.value = true
    initialized.value = true
    return
  }
  const revision = session.identityRevision
  if (!(await ensureMobilePageAccess(PATH))) {
    if (pageCurrent(generation, revision)) { clearShare(); accessDenied.value = true; initialized.value = true }
    return
  }
  if (!pageCurrent(generation, revision)) return
  try {
    await Promise.all([store.loadMistakes(), store.loadReport(view.value === 'weekly' ? 'weekly' : 'daily')])
  } finally {
    if (pageCurrent(generation, revision)) {
      retainShareForConfirmedPeriod()
      initialized.value = true
    }
  }
}
function selectView(next: View): void {
  if (next === view.value) return
  const generation = ++pageGeneration
  const revision = session.identityRevision
  clearShare()
  retryNotice.value = ''
  detailOpen.value = false
  view.value = next
  if (next === 'mistakes') { initialized.value = true; return }
  initialized.value = false
  void store.loadReport(next).finally(() => {
    if (!pageCurrent(generation, revision)) return
    retainShareForConfirmedPeriod()
    initialized.value = true
  })
}
function retryPage(): void { loadCurrent() }
function retryMistake(mistake: B10Mistake): void {
  if (retryingId.value !== null || mistake.mistakeStatus === 'MASTERED') return
  const generation = ++retryGeneration
  const revision = session.identityRevision
  retryingId.value = mistake.mistakeId
  retryNotice.value = ''
  const current = () => generation === retryGeneration && revision === session.identityRevision
  void store.startMistakeRetry(mistake.mistakeId).then(() => {
    if (!current()) return
    retryNotice.value = store.status === 'error' || store.status === 'offline' ? reportT('mistakes.retryFailed') : reportT('mistakes.retryAccepted')
  }).catch(() => { if (current()) retryNotice.value = reportT('mistakes.retryFailed') }).finally(() => { if (current()) retryingId.value = null })
}
async function openDetail(mistake: B10Mistake): Promise<void> {
  const generation = ++detailGeneration
  detailPreviousFocus = typeof document !== 'undefined' ? document.activeElement as HTMLElement : null
  detailOpen.value = true
  detailBusy.value = true
  detailError.value = ''
  detailMistake.value = null
  await nextTick()
  if (typeof document !== 'undefined') document.querySelector<HTMLElement>('.report-detail-sheet .report-text-button')?.focus()
  try {
    const detail = await b10LearningApi.getMistakeDetail({ uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value }, mistake.mistakeId)
    if (generation !== detailGeneration) return
    detailMistake.value = detail
  } catch {
    if (generation === detailGeneration) detailError.value = reportT('mistakes.detailFailed')
  } finally {
    if (generation === detailGeneration) detailBusy.value = false
  }
}
function closeDetail(): void {
  detailGeneration += 1
  detailOpen.value = false
  detailBusy.value = false
  detailError.value = ''
  detailMistake.value = null
  const previous = detailPreviousFocus
  detailPreviousFocus = null
  if (previous && typeof previous.focus === 'function') void nextTick().then(() => previous.focus())
}
function onDetailKey(event: KeyboardEvent): void {
  if (!detailOpen.value) return
  if (event.key === 'Escape') { event.preventDefault(); closeDetail(); return }
  if (event.key !== 'Tab' || typeof document === 'undefined') return
  const sheet = document.querySelector('.report-detail-sheet')
  if (!sheet) return
  const focusable = Array.from(sheet.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')).filter((element) => element.offsetParent !== null)
  if (!focusable.length) return
  const first = focusable[0], last = focusable[focusable.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !sheet.contains(active))) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && (active === last || !sheet.contains(active))) { event.preventDefault(); first.focus() }
}
onMounted(() => { if (typeof window !== 'undefined') window.addEventListener('keydown', onDetailKey) })
onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', onDetailKey)
  shareGeneration += 1
  shareAttempt = null
  revokeAttempt = null
  shareBusy.value = false
})
async function issueShare(): Promise<void> {
  if (shareBusy.value || view.value === 'mistakes' || !store.report?.period) return
  if (!session.isAuthenticated || !session.isLearningReady) return
  if (availability.value !== 'READY') return
  const kind = view.value
  const attempt = ensureShareAttempt(kind, store.report.period)
  if (!attempt) return
  const generation = ++shareGeneration
  const revision = session.identityRevision
  shareBusy.value = true
  shareError.value = ''
  shareNote.value = ''
  try {
    const response = await b10LearningApi.issueReportShare(kind, { idempotencyKey: attempt.key, date: attempt.date })
    if (generation !== shareGeneration || revision !== session.identityRevision || shareAttempt !== attempt) return
    const receipt = shareReceipt(response)
    if (!receipt) { shareError.value = reportT('share.invalid'); return }
    shareRef.value = receipt.ref
    shareNote.value = reportT('share.issued')
  } catch {
    if (generation === shareGeneration && revision === session.identityRevision && shareAttempt === attempt) shareError.value = reportT('share.failed')
  } finally {
    if (generation === shareGeneration && shareAttempt === attempt) shareBusy.value = false
  }
}
async function revokeShare(): Promise<void> {
  if (shareBusy.value || !shareRef.value) return
  const generation = ++shareGeneration
  const revision = session.identityRevision
  const attempt = shareAttempt
  const ref = shareRef.value
  if (!revokeAttempt || revokeAttempt.ref !== ref) {
    revokeAttempt = { ref, key: createClientId('mb016-report-share-revoke') }
  }
  const revokeKey = revokeAttempt.key
  shareBusy.value = true
  shareError.value = ''
  try {
    await b10LearningApi.revokeReportShare(ref, { idempotencyKey: revokeKey })
    if (generation !== shareGeneration || revision !== session.identityRevision) return
    shareRef.value = ''
    if (shareAttempt === attempt) shareAttempt = null
    if (revokeAttempt?.ref === ref) revokeAttempt = null
    shareNote.value = reportT('share.revoked')
  } catch {
    if (generation === shareGeneration && revision === session.identityRevision) shareError.value = reportT('share.revokeFailed')
  } finally {
    if (generation === shareGeneration) shareBusy.value = false
  }
}
function copyTextToClipboard(value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    getUniRuntime().setClipboardData({ data: value, success: () => resolve(), fail: () => reject(new Error('copy failed')) })
  })
}
async function copyShare(): Promise<void> {
  if (!sharePageUrl.value || shareBusy.value) return
  const generation = shareGeneration
  shareBusy.value = true
  try {
    await copyTextToClipboard(sharePageUrl.value)
    if (generation === shareGeneration) shareNote.value = reportT('share.copied')
  } catch {
    if (generation === shareGeneration) shareError.value = reportT('share.copyFailed')
  } finally {
    if (generation === shareGeneration) shareBusy.value = false
  }
}
function previewShare(): void {
  if (!shareRef.value) return
  void openUniPage(`/pages/report-share/report-share?ref=${shareRef.value}`)
}
function primaryClick(): void {
  const action = primaryAction.value
  if (action === 'login') {
    session.setReturnTo(PATH)
    void openUniPage('/pages/login/login')
    return
  }
  if (action === 'retry') { retryPage(); return }
  if (action === 'practice') { void openUniPage('/pages/b2-practice/b2-practice'); return }
  if (action === 'share') { void issueShare(); return }
  if (action === 'copy') { void copyShare() }
}
watch(() => session.identityRevision, () => {
  pageGeneration += 1
  retryGeneration += 1
  clearShare()
  closeDetail()
  retryingId.value = null
  retryNotice.value = ''
  view.value = 'mistakes'
  initialized.value = false
  if (session.isAuthenticated) void showPage()
})
watch(() => session.isAuthenticated, (authenticated) => {
  if (authenticated) return
  pageGeneration += 1
  retryGeneration += 1
  clearShare()
  closeDetail()
  retryingId.value = null
  retryNotice.value = ''
  accessDenied.value = true
  initialized.value = true
})
onShow(() => { void showPage() })
onHide(() => {
  pageGeneration += 1
  retryGeneration += 1
  detailGeneration += 1
  // Preview hides the page. Invalidate late share, revoke, and copy replies.
  // The attempt key, its period, and a ref already confirmed stay for this page.
  shareGeneration += 1
  shareBusy.value = false
  detailOpen.value = false
  detailBusy.value = false
  retryingId.value = null
  retryNotice.value = ''
  initialized.value = false
})
</script>

<template>
  <view id="private-report-page" class="yx-page report-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion" :data-report-state="pageState">
    <view class="report-glow-wrap" aria-hidden="true"><image class="report-glow" :src="glowSrc" mode="aspectFit" /></view>
    <MobilePageHeader page="b10-report" compact :title="reportT('title')" :show-settings="false" back-icon-src="/static/figma-report-mistakes-169-667/imgIconChevL.svg" />
    <view class="report-body">
      <view v-if="view === 'mistakes'" class="report-title-block"><text class="report-title" role="heading" aria-level="1">{{ reportT('mistakes.title') }}</text><text class="report-subtitle">{{ reportT('mistakes.subtitle') }}</text></view>
      <view class="report-tabs" role="tablist" :aria-label="reportT('tabs.aria')">
        <button tabindex="0" type="button" role="tab" class="report-tab" :class="{ active: view === 'mistakes' }" :aria-selected="view === 'mistakes'" @click="selectView('mistakes')">{{ reportT('tabs.mistakes') }}</button>
        <button tabindex="0" type="button" role="tab" class="report-tab" :class="{ active: view === 'daily' }" :aria-selected="view === 'daily'" @click="selectView('daily')">{{ reportT('tabs.daily') }}</button>
        <button tabindex="0" type="button" role="tab" class="report-tab" :class="{ active: view === 'weekly' }" :aria-selected="view === 'weekly'" @click="selectView('weekly')">{{ reportT('tabs.weekly') }}</button>
      </view>

      <view v-if="pageState === 'loading'" class="report-loading" role="status" aria-live="polite">
        <text class="report-loading-copy">{{ view === 'mistakes' ? reportT('mistakes.loading') : reportT('report.loading') }}</text>
        <view class="report-skeleton" aria-hidden="true"><view class="report-skeleton-title"></view><view class="report-skeleton-row"><view></view><view></view><view></view></view><view class="report-skeleton-line"></view></view>
        <view class="report-loading-tips"><view class="report-dot-row"><image class="report-dot" src="/static/figma-report-daily-169-1058/imgDot.svg" mode="aspectFit" /><image class="report-dot" src="/static/figma-report-daily-169-1058/imgDot1.svg" mode="aspectFit" /><image class="report-dot" src="/static/figma-report-partial-169-1392/imgDot2.svg" mode="aspectFit" /></view><text class="report-muted">{{ reportT('loading') }}</text></view>
      </view>

      <view v-else-if="pageState === 'permission'" class="report-state-card" role="status">
        <view class="report-state-badge"><image class="report-state-icon" src="/static/figma-report-noaccess-169-991/imgIconLock.svg" mode="aspectFit" aria-hidden="true" /></view>
        <text class="report-state-title">{{ session.isAuthenticated ? reportT('error.permissionTitle') : reportT('noAccess.title') }}</text>
        <text class="report-state-body">{{ session.isAuthenticated ? reportT('error.permissionBody') : reportT('noAccess.body') }}</text>
      </view>
      <view v-else-if="pageState === 'error' || pageState === 'offline'" class="report-state-card" role="alert">
        <image class="report-mascot" src="/static/figma-report-error-169-921/imgMascot.svg" mode="aspectFit" aria-hidden="true" />
        <text class="report-state-title">{{ pageState === 'offline' ? reportT('error.offlineTitle') : reportT('error.title') }}</text>
        <text class="report-state-body">{{ pageState === 'offline' ? reportT('error.offlineBody') : reportT('error.body') }}</text>
      </view>
      <view v-else-if="view === 'mistakes'" class="report-mistakes">
        <view v-if="pageState === 'empty'" class="report-empty-card">
          <image class="report-info-icon" src="/static/figma-report-mistakes-169-667/imgIconInfo.svg" mode="aspectFit" aria-hidden="true" />
          <text class="report-empty-title">{{ reportT('mistakes.emptyTitle') }}</text>
          <text class="report-state-body">{{ reportT('mistakes.emptyBody') }}</text>
        </view>
        <view v-else>

          <view class="report-mistake-list">
            <view v-for="mistake in store.mistakes" :key="mistake.mistakeId" class="report-mistake-card">
              <view class="report-mistake-top"><text class="report-closure">{{ mistake.closureCopy || statusText(mistake.mistakeStatus) }}</text><text v-if="mistake.masteryStatus" class="report-mastery">{{ masteryText(mistake.masteryStatus) }}</text></view>
              <text class="report-mistake-category">{{ mistake.errorCategory }}</text>
              <text class="report-mistake-prompt">{{ mistake.prompt || mistake.errorCategory }}</text>
              <view class="report-reasons"><text v-for="reason in mistake.reasonTrace" :key="reason.code" class="report-reason">{{ reason.label }}<template v-if="reason.evidence"> · {{ reason.evidence }}</template></text></view>
              <view class="report-mistake-actions"><button type="button" tabindex="0" class="report-text-button" @click="openDetail(mistake)">{{ reportT('mistakes.detail') }}</button><button type="button" tabindex="0" class="report-secondary-button" :disabled="mistake.mistakeStatus === 'MASTERED' || retryingId !== null" :aria-busy="retryingId === mistake.mistakeId ? 'true' : 'false'" @click="retryMistake(mistake)">{{ retryingId === mistake.mistakeId ? reportT('mistakes.retrying') : reportT('mistakes.retry') }}</button></view>
            </view>
          </view>
          <text v-if="retryNotice" class="report-notice" role="status">{{ retryNotice }}</text>
        </view>
      </view>

      <view v-else class="report-detail-view">
        <view v-if="pageState === 'empty'" class="report-empty-card">
          <text class="report-empty-title">{{ reportT('report.emptyTitle') }}</text>
          <text class="report-state-body">{{ reportT('report.emptyBody') }}</text>
        </view>
        <view v-else class="report-card report-summary-card">
          <view class="report-summary-head"><text class="report-section-title">{{ reportTitle }}</text><text class="report-tag" :class="`tag-${availability.toLowerCase()}`">{{ availabilityLabel }}</text></view>
          <text v-if="periodText" class="report-period">{{ periodText }}<text v-if="periodZone" class="report-zone">{{ periodZone }}</text></text>
          <text class="report-copy">{{ copyText }}</text>
          <view v-if="showStats" class="report-stats">
            <view class="report-stat"><text class="report-stat-value">{{ newItemsText }}</text><text class="report-stat-label">{{ reportT('stats.new') }}</text></view>
            <view class="report-stat"><text class="report-stat-value">{{ reviewItemsText }}</text><text class="report-stat-label">{{ reportT('stats.review') }}</text></view>
            <view class="report-stat"><text class="report-stat-value">{{ durationText }}</text><text class="report-stat-label">{{ reportT('stats.duration') }}</text></view>
          </view>
          <text v-if="isPartial" class="report-notice report-partial-note">{{ reportT('availability.partial') }}</text>
        </view>
        <view v-if="period" class="report-card report-duration-card"><text class="report-card-title">{{ reportT('stats.duration') }} {{ durationText }}</text><text class="report-muted">{{ durationNote }}</text></view>
        <view v-if="suggestionText" class="report-card report-suggestion-card">
          <text class="report-card-title">{{ reportT('suggestion.prefix') }}{{ suggestionText }}</text>
          <text v-if="period?.suggestionBasis" class="report-muted">{{ reportT('suggestion.basis') }}{{ basisLabel }}</text>
          <text class="report-muted">{{ reportT('report.ruleNote') }}</text>
        </view>
        <view v-if="showShare" class="report-card report-share-card">
          <view class="report-share-head"><text class="report-card-title">{{ reportT('share.title') }}</text><image class="report-info-icon report-share-icon" src="/static/figma-report-mistakes-169-667/imgIconInfo.svg" mode="aspectFit" aria-hidden="true" /></view>
          <text class="report-muted">{{ reportT('share.explainer') }}</text>
          <view v-if="shareRef" class="report-share-generated">
            <text class="report-share-mask">{{ shareMasked }}</text>
            <text class="report-muted">{{ reportT('share.copyHint') }}</text>
            <text v-if="!sharePageUrl" class="report-muted">{{ reportT('share.copyUnavailable') }}</text>
            <view class="report-share-actions"><button type="button" tabindex="0" class="report-text-button" @click="previewShare">{{ reportT('share.preview') }}</button><button type="button" tabindex="0" class="report-text-button report-revoke" :disabled="shareBusy" @click="revokeShare">{{ shareBusy ? reportT('share.revokeBusy') : reportT('share.revoke') }}</button></view>
          </view>
          <text v-if="shareNote" class="report-notice" role="status">{{ shareNote }}</text>
          <text v-if="shareError" class="report-error-copy" role="alert">{{ shareError }}</text>
        </view>
      </view>
    </view>

    <view v-if="primaryAction" class="report-action-bar">
      <text v-if="retryNotice && view === 'mistakes'" class="report-action-note">{{ retryNotice }}</text>
      <button type="button" tabindex="0" class="report-primary" :disabled="primaryDisabled" :aria-busy="shareBusy || retryingId !== null ? 'true' : 'false'" @click="primaryClick">{{ primaryLabel }}</button>
    </view>

    <view v-if="detailOpen" class="report-detail-overlay" role="dialog" aria-modal="true" :aria-label="reportT('mistakes.detailTitle')" @click.self="closeDetail">
      <view class="report-detail-sheet">
        <view class="report-detail-head"><text class="report-detail-title">{{ reportT('mistakes.detailTitle') }}</text><button ref="detailCloseButton" type="button" tabindex="0" class="report-text-button" @click="closeDetail">{{ reportT('mistakes.close') }}</button></view>
        <text v-if="detailBusy" class="report-muted">{{ reportT('mistakes.detailLoading') }}</text>
        <text v-else-if="detailError" class="report-error-copy" role="alert">{{ detailError }}</text>
        <view v-else-if="detailMistake" class="report-detail-content">
          <text class="report-mistake-category">{{ detailMistake.errorCategory }}</text>
          <text class="report-mistake-prompt">{{ detailMistake.prompt || detailMistake.errorCategory }}</text>
          <text class="report-closure">{{ detailMistake.closureCopy || statusText(detailMistake.mistakeStatus) }}</text>
          <view class="report-reasons"><text v-for="reason in detailMistake.reasonTrace" :key="reason.code" class="report-reason">{{ reason.label }}<template v-if="reason.evidence"> · {{ reason.evidence }}</template></text></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
#private-report-page { position: relative; box-sizing: border-box; min-height: 100vh; padding: 0; overflow-x: clip; background-color: var(--v2-bg); color: var(--v2-ink); font-family: var(--v2-font); }
#private-report-page * { box-sizing: border-box; }
.report-glow-wrap { position: absolute; top: -140px; right: -120px; z-index: 0; width: 360px; height: 300px; overflow: visible; pointer-events: none; }
.report-glow { position: absolute; top: -90px; left: -90px; width: 540px; height: 480px; max-width: none; }
.b10-theme--dark .report-glow { opacity: .24; }
.b10-theme--high-contrast .report-glow-wrap { display: none; }
.report-body { position: relative; z-index: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 8px 24px calc(160px + env(safe-area-inset-bottom)); display: grid; gap: 16px; }
.report-title-block { display: grid; gap: 4px; padding-top: 8px; }
.report-title { display: block; color: var(--v2-ink); font-size: var(--v2-text-2xl); font-weight: 700; line-height: 1.3; }
.report-subtitle { display: block; color: var(--v2-mut); font-size: var(--v2-text-sm); line-height: 1.5; }
.report-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; border: 1px solid var(--v2-line); border-radius: 16px; background: var(--v2-surface); }
.report-tab { min-height: 44px; padding: 8px 6px; border: 1px solid transparent; border-radius: 12px; background: transparent; color: var(--v2-mut); font: inherit; font-size: var(--v2-text-sm); font-weight: 600; line-height: 1.3; }
.report-tab.active { border-color: var(--v2-brand); background: var(--v2-soft); color: var(--v2-brand); }
.report-tab:focus-visible { outline: 2px solid var(--v2-focus); outline-offset: 2px; }
.report-loading { display: grid; gap: 12px; }
.report-loading-copy { color: var(--v2-mut); font-size: var(--v2-text-sm); }
.report-skeleton { display: grid; gap: 10px; padding: 20px; border: 1px solid var(--v2-line); border-radius: 22px; background: var(--v2-card); }
.report-skeleton-title { width: 150px; height: 24px; border-radius: 8px; background: var(--v2-surface); }
.report-skeleton-row { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.report-skeleton-row view { height: 64px; border-radius: 14px; background: var(--v2-surface); }
.report-skeleton-line { height: 16px; border-radius: 8px; background: var(--v2-surface); }
.report-loading-tips { display: flex; align-items: center; gap: 10px; color: var(--v2-mut); }
.report-dot-row { display: flex; align-items: center; gap: 4px; }
.report-dot { width: 8px; height: 8px; }
.report-state-card, .report-empty-card { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 20px; border: 1px solid var(--v2-line); border-radius: 22px; background: var(--v2-card); text-align: center; }
.report-state-badge { display: flex; align-items: center; justify-content: center; width: 96px; height: 96px; border-radius: 50%; background: var(--v2-surface); }
.report-state-icon { width: 44px; height: 44px; }
.report-mascot { width: 120px; height: 120px; }
.report-state-title, .report-empty-title { color: var(--v2-ink); font-size: 22px; font-weight: 700; line-height: 1.4; }
.report-state-body { color: var(--v2-mut); font-size: 15px; line-height: 1.55; }
.report-empty-card { margin-top: 8px; }
.report-info-icon { width: 28px; height: 28px; }
.report-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.report-section-title { color: var(--v2-ink); font-size: 18px; font-weight: 700; line-height: 1.4; }
.report-count { color: var(--v2-mut); font-size: 13px; }
.report-muted { display: block; color: var(--v2-mut); font-size: 13px; line-height: 1.6; }
.report-section-subtitle { margin-top: 4px; }
.report-mistake-list { display: grid; gap: 12px; margin-top: 12px; }
.report-mistake-card, .report-card { display: grid; gap: 8px; padding: 18px; border: 1px solid var(--v2-line); border-radius: 22px; background: var(--v2-card); box-shadow: var(--v2-shadow); }
.report-mistake-top, .report-summary-head, .report-share-head, .report-mistake-actions, .report-detail-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.report-closure { display: inline-flex; width: fit-content; padding: 3px 10px; border-radius: 999px; background: var(--v2-warn-soft); color: var(--v2-warn); font-size: 12px; font-weight: 700; line-height: 1.4; }
.report-mastery { color: var(--v2-mut); font-size: 12px; }
.report-mistake-category { color: var(--v2-ink); font-size: 17px; font-weight: 700; line-height: 1.45; }
.report-mistake-prompt { color: var(--v2-ink); font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.report-reasons { display: grid; gap: 3px; }
.report-reason { color: var(--v2-mut); font-size: 12px; line-height: 1.5; }
.report-secondary-button, .report-primary { display: flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 16px; border: 0; border-radius: 12px; background: var(--v2-brand); color: var(--v2-inverse); font: inherit; font-size: 14px; font-weight: 700; line-height: 1.4; }
.report-secondary-button { min-height: 40px; font-size: 13px; }
.report-secondary-button:disabled, .report-primary:disabled { opacity: .55; }
.report-text-button { padding: 6px 0; border: 0; background: transparent; color: var(--v2-brand); font: inherit; font-size: 13px; font-weight: 600; line-height: 1.4; }
.report-text-button:disabled { opacity: .55; }
.report-notice { display: block; padding: 9px 12px; border-radius: 10px; background: var(--v2-soft); color: var(--v2-brand); font-size: 12px; line-height: 1.5; }
.report-partial-note { background: var(--v2-warn-soft); color: var(--v2-warn); }
.report-error-copy { color: var(--v2-bad); font-size: 12px; line-height: 1.5; }
.report-summary-card { gap: 10px; }
.report-tag { display: inline-flex; flex: none; padding: 3px 10px; border-radius: 999px; background: var(--v2-ok-soft); color: var(--v2-ok); font-size: 12px; font-weight: 700; line-height: 1.4; }
.report-tag.tag-partial, .report-tag.tag-generating { background: var(--v2-warn-soft); color: var(--v2-warn); }
.report-tag.tag-failed, .report-tag.tag-unknown { background: var(--v2-bad-soft); color: var(--v2-bad); }
.report-period { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; }
.report-zone { color: var(--v2-mut); }
.report-copy { display: block; color: var(--v2-mut); font-size: 14px; line-height: 1.6; }
.report-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-top: 4px; }
.report-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 0; padding: 12px 8px; border-radius: 16px; background: var(--v2-surface); text-align: center; }
.report-stat-value { color: var(--v2-brand); font-size: 20px; font-weight: 700; line-height: 1.3; overflow-wrap: anywhere; }
.report-stat-label { color: var(--v2-mut); font-size: 12px; line-height: 1.4; }
.report-card-title { color: var(--v2-ink); font-size: 15px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.report-duration-card, .report-suggestion-card, .report-share-card { gap: 6px; }
.report-share-icon { width: 18px; height: 18px; }
.report-share-generated { display: grid; gap: 6px; padding-top: 4px; border-top: 1px solid var(--v2-line); }
.report-share-actions { display: flex; align-items: center; gap: 16px; }
.report-share-mask { color: var(--v2-ink); font-size: 14px; font-weight: 600; line-height: 1.5; overflow-wrap: anywhere; }
.report-revoke { justify-self: start; color: var(--v2-bad); }
.report-action-bar { position: fixed; right: 0; bottom: 0; left: 0; z-index: 20; display: grid; gap: 6px; padding: 12px 24px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--v2-line); background: var(--v2-card); box-shadow: var(--v2-shadow); }
.report-action-note { color: var(--v2-mut); font-size: 11px; line-height: 1.4; text-align: center; }
.report-primary { width: 100%; min-height: 48px; font-size: 16px; }
.report-detail-overlay { position: fixed; inset: 0; z-index: 40; display: flex; align-items: flex-end; justify-content: center; padding: 24px; background: color-mix(in srgb, var(--v2-ink) 35%, transparent); }
.report-detail-sheet { display: grid; gap: 12px; width: 100%; max-width: 520px; padding: 20px; border-radius: 22px; background: var(--v2-card); box-shadow: var(--v2-shadow); }
.report-detail-title { color: var(--v2-ink); font-size: 18px; font-weight: 700; }
.report-detail-content { display: grid; gap: 8px; }
.b10-theme--high-contrast .report-card, .b10-theme--high-contrast .report-mistake-card, .b10-theme--high-contrast .report-state-card, .b10-theme--high-contrast .report-empty-card, .b10-theme--high-contrast .report-detail-sheet { border-width: 2px; box-shadow: none; }
.b10-theme--high-contrast .report-action-bar { border-top-width: 2px; box-shadow: none; }
@media (max-width: 359px) { .report-body { padding-inline: 16px; } .report-action-bar { padding-inline: 16px; } .report-state-card, .report-empty-card, .report-card, .report-mistake-card { padding: 16px; } }
@media (prefers-reduced-motion: reduce) { #private-report-page * { animation: none !important; transition: none !important; } }
</style>
