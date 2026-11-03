<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { MobileApiError } from '../../api/client'
import { loadMobileSupportDesk, readMobileSupportTicket, type MobileSupportList, type MobileSupportTicket } from '../../api/support'
import type { ClosureBoard } from '../../domain/it7-closure'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { mobileI18n, mobileThemeController } from '../../platform/v2-foundation'
import { openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

type ListState = 'loading' | 'ready' | 'empty' | 'error'
type DetailState = 'idle' | 'loading' | 'ready' | 'unauthorized' | 'forbidden' | 'notfound' | 'error'
type MoreState = 'idle' | 'loading' | 'error'
type MoreErrorKind = 'cursor' | 'error'

const SUPPORT_PATH = '/pages/support/support'
const session = useSessionStore()
const tickets = ref<MobileSupportTicket[]>([])
const board = ref<ClosureBoard | null>(null)
const listState = ref<ListState>('loading')
const listErrorKind = ref<'unauthorized' | 'forbidden' | 'notfound' | 'error'>('error')
const detailId = ref<string | null>(null)
const detailState = ref<DetailState>('idle')
const detailErrorKind = ref<'unauthorized' | 'forbidden' | 'notfound' | 'error'>('error')
const selectedTicket = ref<MobileSupportTicket | null>(null)
const hasMore = ref(false)
const nextCursor = ref<string | null>(null)
const pageSize = ref(20)
const moreState = ref<MoreState>('idle')
const moreErrorKind = ref<MoreErrorKind>('error')
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
let listRequest = 0
let moreRequest = 0
let detailRequest = 0
let pageEpoch = 0
let seenCursors = new Set<string>()
let unsubscribeTheme: (() => void) | undefined

const supportT = (key: string, values?: Record<string, unknown>): string => {
  const message = mobileT(`supportPage.${key}`)
  return values ? interpolate(message, values) : message
}
const supportNumber = computed(() => board.value?.supportNumber ? supportT('supportNumber', { number: board.value.supportNumber }) : '')
const stateName = computed(() => {
  if (detailId.value) return detailState.value === 'ready' ? 'detail' : `detail-${detailState.value}`
  return listState.value
})
const detailOpen = computed(() => Boolean(detailId.value))
const listErrorText = computed(() => errorCopy(listErrorKind.value))
const detailErrorText = computed(() => errorCopy(detailErrorKind.value))
const moreErrorText = computed(() => supportT(moreErrorKind.value === 'cursor' ? 'moreStale' : 'moreError'))
const fixedPrimaryLabel = computed(() => {
  if (detailOpen.value) {
    if (detailState.value === 'loading') return supportT('querying')
    if (detailState.value === 'unauthorized') return supportT('login')
    if (detailState.value === 'ready') return supportT('query')
    return supportT('retry')
  }
  if (listState.value === 'loading') return supportT('refresh')
  if (listState.value === 'error') return listErrorKind.value === 'unauthorized' ? supportT('login') : supportT('retry')
  if (moreState.value === 'error') return moreErrorKind.value === 'cursor' ? supportT('refresh') : supportT('retry')
  return supportT('refresh')
})
const fixedPrimaryDisabled = computed(() => detailOpen.value ? detailState.value === 'loading' : listState.value === 'loading' || moreState.value === 'loading')
const fixedPrimaryStrong = computed(() => {
  if (detailOpen.value) return detailState.value !== 'ready' && detailState.value !== 'loading'
  return listState.value === 'error' || (moreState.value === 'error' && moreErrorKind.value === 'error')
})

function isCurrent(epoch: number, subject: string, revision: number): boolean {
  return pageEpoch === epoch && session.isAuthenticated && session.verifiedSubject === subject && session.identityRevision === revision
}
function accountSnapshot(): { subject: string; revision: number } | null {
  return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function errorKind(error: unknown): 'unauthorized' | 'forbidden' | 'notfound' | 'error' {
  if (!(error instanceof MobileApiError)) return 'error'
  if (error.status === 401) return 'unauthorized'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notfound'
  return 'error'
}
function errorCopy(kind: 'unauthorized' | 'forbidden' | 'notfound' | 'error'): string {
  return supportT(kind === 'notfound' ? 'notFound' : kind === 'unauthorized' ? 'unauthorized' : kind === 'forbidden' ? 'forbidden' : 'unavailable')
}
function categoryLabel(ticket: MobileSupportTicket): string {
  if (ticket.legacy) {
    const legacy: Record<string, string> = {
      TECHNICAL: 'technical', CONTENT_CORRECTION: 'contentCorrection', ACCOUNT_ACCESS: 'accountAccess',
      BILLING: 'billing', LEARNING_DATA: 'learningData', PRIVACY_REQUEST: 'privacyRequest',
    }
    return supportT(`legacyCategories.${legacy[ticket.categoryCode] ?? 'unknown'}`)
  }
  const key: Record<string, string> = {
    ACCOUNT_SECURITY: 'accountSecurity', CONTENT_CORRECTION: 'contentCorrection', LEARNING_SYNC: 'learningSync',
    MEDIA_DEVICE: 'mediaDevice', ENTITLEMENT_ORDER: 'entitlementOrder', PRIVACY: 'privacy', OTHER: 'other',
  }
  return supportT(`categories.${key[ticket.categoryCode] ?? 'unknown'}`)
}
function stateLabel(ticket: MobileSupportTicket): string {
  if (ticket.legacy) {
    const legacy: Record<string, string> = {
      OPEN: 'open', ACKNOWLEDGED: 'acknowledged', IN_PROGRESS: 'inProgress', WAITING_CUSTOMER: 'waitingCustomer',
      RESOLVED: 'resolved', CLOSED: 'closed',
    }
    return supportT(`legacyStates.${legacy[ticket.state] ?? 'unknown'}`)
  }
  const key: Record<string, string> = {
    OPEN: 'open', ASSIGNED: 'assigned', WAITING_USER: 'waitingUser', WAITING_INTERNAL: 'waitingInternal',
    RESOLVED: 'resolved', CLOSED: 'closed', REOPENED: 'reopened',
  }
  return supportT(`states.${key[ticket.state] ?? 'unknown'}`)
}
function priorityLabel(value: string): string {
  const key: Record<string, string> = { LOW: 'low', NORMAL: 'normal', HIGH: 'high', URGENT: 'urgent' }
  return supportT(`priorities.${key[value] ?? 'unknown'}`)
}
function statusTone(ticket: MobileSupportTicket): string {
  if (ticket.state === 'RESOLVED') return 'v2-support-badge--ok'
  if (ticket.state === 'CLOSED') return 'v2-support-badge--muted'
  if (ticket.state === 'WAITING_USER' || ticket.state === 'WAITING_INTERNAL' || ticket.state === 'WAITING_CUSTOMER' || ticket.state === 'ACKNOWLEDGED') return 'v2-support-badge--warn'
  return 'v2-support-badge--brand'
}
function formatDate(value: string | null): string {
  if (!value) return supportT('unknown')
  const time = Date.parse(value)
  return Number.isFinite(time) ? mobileI18n.formatDate(time, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : supportT('unknown')
}
function clearDetail(): void {
  detailRequest += 1
  detailId.value = null
  detailState.value = 'idle'
  selectedTicket.value = null
}
function resetPagination(): void {
  moreRequest += 1
  seenCursors = new Set<string>()
  hasMore.value = false
  nextCursor.value = null
  pageSize.value = 20
  moreState.value = 'idle'
  moreErrorKind.value = 'error'
}
function resetPrivateState(): void {
  pageEpoch += 1
  listRequest += 1
  tickets.value = []
  board.value = null
  clearDetail()
  resetPagination()
}
function applyDeskPage(desk: MobileSupportList, append: boolean): void {
  const existing = new Set(tickets.value.map((ticket) => ticket.ticketId))
  const incoming = append ? desk.tickets.filter((ticket) => !existing.has(ticket.ticketId)) : desk.tickets
  tickets.value = append ? [...tickets.value, ...incoming] : incoming
  if (!append || desk.board) board.value = desk.board
  hasMore.value = desk.hasMore === true
  nextCursor.value = typeof desk.nextCursor === 'string' && desk.nextCursor ? desk.nextCursor : null
  const size = desk.pageSize
  pageSize.value = typeof size === 'number' && Number.isInteger(size) && size >= 1 && size <= 100 ? size : 20
}
async function loadList(): Promise<void> {
  const epoch = ++pageEpoch
  const request = ++listRequest
  const owner = accountSnapshot()
  resetPagination()
  tickets.value = []
  board.value = null
  clearDetail()
  listState.value = 'loading'
  if (!owner) { listState.value = 'error'; listErrorKind.value = 'unauthorized'; return }
  try {
    const desk = await loadMobileSupportDesk(undefined, pageSize.value)
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== listRequest) return
    applyDeskPage(desk, false)
    listState.value = desk.tickets.length || hasMore.value ? 'ready' : 'empty'
  } catch (error) {
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== listRequest) return
    tickets.value = []
    board.value = null
    listErrorKind.value = errorKind(error)
    listState.value = 'error'
  }
}
async function loadMore(): Promise<void> {
  if (moreState.value === 'loading' || !hasMore.value) return
  if (moreState.value === 'error' && moreErrorKind.value === 'cursor') return
  const owner = accountSnapshot()
  if (!owner) {
    resetPrivateState()
    listState.value = 'error'
    listErrorKind.value = 'unauthorized'
    return
  }
  const cursor = nextCursor.value
  if (!cursor || seenCursors.has(cursor)) {
    moreErrorKind.value = 'cursor'
    moreState.value = 'error'
    return
  }
  const epoch = pageEpoch
  const request = ++moreRequest
  moreState.value = 'loading'
  try {
    const desk = await loadMobileSupportDesk(cursor, pageSize.value)
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== moreRequest) return
    applyDeskPage(desk, true)
    if ((hasMore.value && !nextCursor.value) || (!hasMore.value && nextCursor.value !== null) || (nextCursor.value !== null && (nextCursor.value === cursor || seenCursors.has(nextCursor.value)))) {
      moreErrorKind.value = 'cursor'
      moreState.value = 'error'
      return
    }
    seenCursors.add(cursor)
    moreState.value = 'idle'
  } catch (error) {
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== moreRequest) return
    const kind = errorKind(error)
    if (kind === 'unauthorized' || kind === 'forbidden') {
      resetPrivateState()
      listState.value = 'error'
      listErrorKind.value = kind
      return
    }
    moreErrorKind.value = 'error'
    moreState.value = 'error'
  }
}
async function openTicket(ticketId: string): Promise<void> {
  const owner = accountSnapshot()
  if (!owner || !ticketId) return
  const epoch = pageEpoch
  const request = ++detailRequest
  detailId.value = ticketId
  selectedTicket.value = null
  detailState.value = 'loading'
  try {
    const ticket = await readMobileSupportTicket(ticketId)
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== detailRequest) return
    if (ticket.ticketId !== ticketId) {
      selectedTicket.value = null
      detailErrorKind.value = 'error'
      detailState.value = 'error'
      return
    }
    selectedTicket.value = ticket
    detailState.value = 'ready'
  } catch (error) {
    if (!isCurrent(epoch, owner.subject, owner.revision) || request !== detailRequest) return
    selectedTicket.value = null
    detailErrorKind.value = errorKind(error)
    detailState.value = detailErrorKind.value === 'notfound' ? 'notfound' : detailErrorKind.value
  }
}
function backToList(): void {
  clearDetail()
  listState.value = tickets.value.length || hasMore.value ? 'ready' : 'empty'
}
function retry(): void {
  if (detailId.value) { void openTicket(detailId.value); return }
  void loadList()
}
function openLogin(): void { void Promise.resolve(openUniPage('/pages/login/login')) }
function fixedPrimaryAction(): void {
  if (detailOpen.value) {
    if (detailState.value === 'loading') return
    if (detailState.value === 'unauthorized') { openLogin(); return }
    retry()
    return
  }
  if (listState.value === 'loading') return
  if (listState.value === 'error') {
    if (listErrorKind.value === 'unauthorized') openLogin()
    else retry()
    return
  }
  if (moreState.value === 'error') {
    if (moreErrorKind.value === 'cursor') void loadList()
    else void loadMore()
    return
  }
  void loadList()
}

onShow(async () => {
  if (!await ensureMobilePageAccess(SUPPORT_PATH)) return
  await loadList()
})
onHide(() => {
  pageEpoch += 1
  listRequest += 1
  clearDetail()
  resetPagination()
})
watch(() => session.identityRevision, () => {
  resetPrivateState()
  if (!session.isAuthenticated || !session.verifiedSubject) {
    listState.value = 'error'
    listErrorKind.value = 'unauthorized'
    return
  }
  void loadList()
})
onMounted(() => { unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme }) })
onUnmounted(() => { unsubscribeTheme?.(); unsubscribeTheme = undefined })
</script>

<template>
  <view class="yx-page v2-support-page" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="resolvedTheme" :data-support-state="stateName" :class="themeClass">
    <MobilePageHeader page="support" compact :title="supportT('navTitle')" back-icon-src="/static/figma-support-169-13903/e7767604-ee86-4801-9dc5-20c00d5027cb.svg" :show-settings="false" />
    <view class="v2-support-glow-wrap" aria-hidden="true"><image class="v2-support-glow" src="/static/figma-support-169-13903/4a33f481-cd16-4c61-bea1-96193f56fe8e.svg" mode="scaleToFill" /></view>

    <view class="v2-support-body">
      <view class="v2-support-intro">
        <text class="v2-support-title">{{ supportT('pageTitle') }}</text>
        <text class="v2-support-subtitle">{{ supportT('pageSubtitle') }}</text>
      </view>

      <view v-if="!detailOpen" class="v2-support-info" role="status">
        <view class="v2-support-info-badge" aria-hidden="true"><image src="/static/figma-support-169-13602/dbca4a4d-8dfc-42bd-9a81-6e11a78a15a4.svg" mode="aspectFit" /></view>
        <view class="v2-support-info-copy">
          <text class="v2-support-info-title">{{ supportT('infoTitle') }}</text>
          <text class="v2-support-muted">{{ supportT('infoDesc') }}</text>
          <text v-if="supportNumber" class="v2-support-muted">{{ supportNumber }}</text>
        </view>
      </view>

      <view v-if="!detailOpen" class="v2-support-card v2-support-tickets" data-section="tickets">
        <view class="v2-support-head"><text class="v2-support-card-title">{{ supportT('listTitle') }}</text></view>
        <view v-if="listState === 'loading'" class="v2-support-state" role="status">
          <text class="v2-support-muted">{{ supportT('loading') }}</text>
          <view class="v2-support-skeleton" aria-hidden="true"></view>
          <view class="v2-support-skeleton" aria-hidden="true"></view>
        </view>
        <view v-else-if="listState === 'error'" class="v2-support-notice" role="alert">
          <text class="v2-support-error">{{ listErrorText }}</text>
        </view>
        <view v-else-if="listState === 'empty'" class="v2-support-notice">
          <text class="v2-support-muted">{{ supportT('empty') }}</text>
        </view>
        <view v-else class="v2-support-list">
          <text v-if="!tickets.length && hasMore" class="v2-support-muted">{{ supportT('moreAvailable') }}</text>
          <button v-for="ticket in tickets" :key="ticket.ticketId" tabindex="0" role="button" class="v2-support-row" type="button" :data-ticket-id="ticket.ticketId" @click="openTicket(ticket.ticketId)">
            <view class="v2-support-row-icon" aria-hidden="true"><image src="/static/figma-support-169-13903/f4b24b66-c6a7-44a6-9023-1c2ac9fcf8b7.svg" mode="aspectFit" /></view>
            <view class="v2-support-row-copy">
              <text class="v2-support-row-title">{{ supportT('ticket', { id: ticket.ticketId }) }}</text>
              <text class="v2-support-muted">{{ categoryLabel(ticket) }} · {{ stateLabel(ticket) }}</text>
              <text v-if="ticket.legacy" class="v2-support-legacy">{{ supportT('legacyTag') }}</text>
            </view>
          </button>
          <view v-if="moreState === 'error'" class="v2-support-notice" role="alert">
            <text class="v2-support-error">{{ moreErrorText }}</text>
          </view>
          <button v-if="hasMore && moreState !== 'error'" tabindex="0" role="button" class="v2-support-btn" type="button" :disabled="moreState === 'loading'" @click="loadMore">{{ moreState === 'loading' ? supportT('loadingMore') : supportT('loadMore') }}</button>
        </view>
      </view>

      <view v-else class="v2-support-card v2-support-detail" data-section="detail">
        <view class="v2-support-head">
          <text class="v2-support-card-title">{{ supportT('detailTitle') }}</text>
        </view>
        <view v-if="detailState === 'loading'" class="v2-support-state" role="status"><text class="v2-support-muted">{{ supportT('querying') }}</text></view>
        <view v-else-if="detailState !== 'ready'" class="v2-support-notice" role="alert">
          <text class="v2-support-error">{{ detailErrorText }}</text>
        </view>
        <template v-else-if="selectedTicket">
          <text class="v2-support-muted">{{ supportT('detailNote') }}</text>
          <text v-if="selectedTicket.legacy" class="v2-support-legacy">{{ supportT('legacyTag') }}</text>
          <view class="v2-support-ticket-rows">
            <view class="v2-support-ticket-row">
              <view class="v2-support-ticket-icon" aria-hidden="true"><image src="/static/figma-support-169-13903/f4b24b66-c6a7-44a6-9023-1c2ac9fcf8b7.svg" mode="aspectFit" /></view>
              <view class="v2-support-ticket-copy">
                <text class="v2-support-ticket-title">{{ supportT('ticket', { id: selectedTicket.ticketId }) }}</text>
                <text class="v2-support-muted">{{ categoryLabel(selectedTicket) }}</text>
              </view>
              <text class="v2-support-badge" :class="statusTone(selectedTicket)">{{ stateLabel(selectedTicket) }}</text>
            </view>
            <view class="v2-support-ticket-row">
              <view class="v2-support-ticket-icon" aria-hidden="true"><image src="/static/figma-support-169-13903/9924ab81-25e6-4306-9d0f-c8ea170e93c1.svg" mode="aspectFit" /></view>
              <view class="v2-support-ticket-copy">
                <text class="v2-support-ticket-title">{{ supportT('createdAt') }}</text>
                <text class="v2-support-muted">{{ formatDate(selectedTicket.createdAt) }}</text>
              </view>
              <text class="v2-support-badge v2-support-badge--muted">{{ priorityLabel(selectedTicket.priority) }}</text>
            </view>
            <view v-if="selectedTicket.resolutionCode" class="v2-support-ticket-row">
              <view class="v2-support-ticket-icon" aria-hidden="true"><image src="/static/figma-support-169-13903/f4b24b66-c6a7-44a6-9023-1c2ac9fcf8b7.svg" mode="aspectFit" /></view>
              <view class="v2-support-ticket-copy">
                <text class="v2-support-ticket-title">{{ supportT('resolution') }}</text>
                <text class="v2-support-muted">{{ selectedTicket.resolutionCode }}</text>
              </view>
            </view>
          </view>
        </template>
      </view>
    </view>

    <view class="v2-support-fixed" role="group" :aria-label="supportT('supportActions')">
      <button v-if="detailOpen" tabindex="0" role="button" class="v2-support-btn v2-support-btn--ghost" type="button" @click="backToList">{{ supportT('back') }}</button>
      <button tabindex="0" role="button" class="v2-support-btn" :class="fixedPrimaryStrong ? 'v2-support-btn--primary' : 'v2-support-btn--soft'" type="button" :disabled="fixedPrimaryDisabled" @click="fixedPrimaryAction">{{ fixedPrimaryLabel }}</button>
    </view>
  </view>
</template>

<style scoped>
.v2-support-page.v2-support-page{position:relative;box-sizing:border-box;max-width:100%;min-width:0;overflow-x:clip;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 45%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-support-glow-wrap{position:absolute;top:-140px;left:150px;z-index:0;display:block;width:360px;height:300px;overflow:visible;pointer-events:none;opacity:.85;background:transparent}
.v2-support-glow{position:absolute;top:-90px;left:-90px;display:block;width:540px;height:480px;max-width:none;pointer-events:none;background:transparent}
.v2-support-page[data-resolved-theme="high-contrast"] .v2-support-glow-wrap{display:none}
.v2-support-page[data-resolved-theme="high-contrast"] .v2-support-card,.v2-support-page[data-resolved-theme="high-contrast"] .v2-support-info{box-shadow:none}
.v2-support-body{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;width:100%;min-width:0;max-width:100%;padding-bottom:calc(150px + env(safe-area-inset-bottom));font-family:var(--v2-font)}
.v2-support-intro{display:flex;flex-direction:column;gap:var(--v2-space-1);padding-top:var(--v2-space-2)}
.v2-support-title{display:block;color:var(--v2-ink);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-support-subtitle{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:22px;overflow-wrap:anywhere}
.v2-support-info,.v2-support-card{box-sizing:border-box;width:100%;min-width:0;max-width:100%;border:1px solid var(--v2-line);background:var(--v2-card);font-family:var(--v2-font)}
.v2-support-info{display:flex;align-items:center;gap:var(--v2-space-3);padding:12px 14px;border-radius:18px;box-shadow:var(--v2-shadow)}
.v2-support-info-badge{display:flex;align-items:center;justify-content:center;flex:none;width:24px;height:24px;border-radius:8px;background:var(--v2-grad)}
.v2-support-info-badge image{display:block;width:17px;height:17px}
.v2-support-info-copy{display:flex;flex-direction:column;gap:2px;min-width:0}
.v2-support-info-title{color:var(--v2-brand);font-size:14px;font-weight:700;line-height:20px}
.v2-support-card{display:flex;flex-direction:column;gap:10px;padding:18px 20px;border-radius:24px;box-shadow:var(--v2-shadow)}
.v2-support-head{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0}
.v2-support-card-title{color:var(--v2-ink);font-size:18px;font-weight:700;line-height:26px}
.v2-support-status{color:var(--v2-ok);font-size:12px;font-weight:700;line-height:18px}
.v2-support-muted{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6;overflow-wrap:anywhere}
.v2-support-state{display:grid;gap:10px;padding:8px 0}
.v2-support-skeleton{height:56px;border-radius:14px;background:var(--v2-surface)}
.v2-support-notice{display:grid;gap:10px;padding:14px;border:1px dashed var(--v2-line);border-radius:14px}
.v2-support-legacy{display:inline-block;color:var(--v2-warn);font-size:var(--v2-text-xs);line-height:1.5}
.v2-support-error{display:block;color:var(--v2-bad);font-size:var(--v2-text-sm);line-height:1.6;overflow-wrap:anywhere}
.v2-support-list{display:grid;gap:0}
.v2-support-row{display:flex;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-height:56px;margin:0;padding:10px 0;border:0;border-top:1px solid var(--v2-line);background:transparent;color:var(--v2-ink);font:inherit;text-align:left}
.v2-support-row:first-child{border-top:0}
.v2-support-row-icon{display:flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:12px;background:var(--v2-surface)}
.v2-support-row-icon image{display:block;width:22px;height:22px}
.v2-support-row-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.v2-support-row-title{color:var(--v2-ink);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-support-btn{display:flex;align-items:center;justify-content:center;gap:var(--v2-space-2);box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 16px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-card);color:var(--v2-ink);font:inherit;font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:nowrap}
.v2-support-btn--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-support-btn--soft{border-color:transparent;background:var(--v2-soft);color:var(--v2-brand)}
.v2-support-btn--ghost{background:var(--v2-card);color:var(--v2-brand);border-color:var(--v2-line)}
.v2-support-btn:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-support-btn:active{transform:scale(.99)}
.v2-support-btn[disabled]{opacity:.6}
.v2-support-ticket-rows{display:grid;gap:0;margin:2px 0 0}
.v2-support-ticket-row{display:flex;align-items:center;gap:var(--v2-space-3);min-height:64px;padding:10px 0;border-top:1px solid var(--v2-line)}
.v2-support-ticket-row:first-child{border-top:0}
.v2-support-ticket-icon{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:var(--v2-soft)}
.v2-support-ticket-icon image{display:block;width:22px;height:22px}
.v2-support-ticket-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.v2-support-ticket-title{color:var(--v2-ink);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-support-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;max-width:42%;padding:3px 10px;border-radius:999px;background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:18px;text-align:center;overflow-wrap:anywhere}
.v2-support-badge--ok{color:var(--v2-ok)}
.v2-support-badge--warn{color:var(--v2-warn)}
.v2-support-badge--muted{color:var(--v2-mut)}
.v2-support-actions{display:flex;flex-direction:column;gap:var(--v2-space-2);margin-top:var(--v2-space-2)}
.v2-support-fixed{position:fixed;z-index:30;left:0;right:0;bottom:0;display:flex;align-items:stretch;gap:var(--v2-space-2);box-sizing:border-box;padding:12px 20px calc(30px + env(safe-area-inset-bottom));background:var(--v2-card);border-top:1px solid var(--v2-line);box-shadow:0 -4px 16px var(--v2-line)}
.v2-support-fixed .v2-support-btn{width:auto;flex:1 1 0;min-width:0;white-space:normal;line-height:1.3}
.v2-support-fixed .v2-support-btn--ghost{flex:0 1 42%}
.v2-support-fields{display:grid;gap:8px;margin:2px 0 var(--v2-space-2)}
.v2-support-field{display:grid;grid-template-columns:minmax(88px,.35fr) minmax(0,1fr);gap:var(--v2-space-2);padding:10px 0;border-top:1px solid var(--v2-line)}
.v2-support-label{color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-support-value{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;overflow-wrap:anywhere}
.v2-support-page[data-resolved-theme="high-contrast"] .v2-support-btn--primary{color:var(--v2-side)}
@media(max-width:360px){.v2-support-page.yx-page{padding-inline:16px}.v2-support-title{font-size:24px;line-height:32px}.v2-support-card,.v2-support-info{padding:16px}.v2-support-fixed{padding-inline:16px}.v2-support-ticket-row{gap:var(--v2-space-2)}.v2-support-badge{max-width:46%}}
@media(prefers-reduced-motion:reduce){.v2-support-btn{transition:none}.v2-support-btn:active{transform:none}}
</style>
