<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import type { B8Device } from '@englishflow/contracts'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { listMobileDevices, kickoutMobileDevice } from '../../api/devices'
import { canRevokeMobileDevice, isCurrentMobileDevice } from '../../domain/devices'
import { useSessionStore } from '../../stores/session'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n, mobileThemeController } from '../../platform/v2-foundation'
import { sameMobilePreferenceIdentity } from '../../domain/mobile-preference-sync'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()

/* Original cached Figma assets, copied byte-for-byte from
   mobile-supervision/figma-reference/devices-assets-manifest.json.
   The UUID filename is the manifest source name; the variable name is kept here. */
const A = {
  chevL: '/static/figma-devices-358-6788/40e69fea-ad37-4654-8494-5beb023bec1a.svg', // imgIconChevL
  phone: '/static/figma-devices-358-6788/038db1b4-d7c0-4362-91c7-fd53347cbcc2.svg', // imgIconPhone
  phoneAlt: '/static/figma-devices-358-6788/a558df4e-08bc-4bf9-9d2c-b73cc6204d2e.svg', // imgIconPhone1
  monitor: '/static/figma-devices-358-6788/6eccda75-ee0b-4049-870a-e9ed1c3d7fea.svg', // imgIconMonitor
  chevR: '/static/figma-devices-169-12835/c5662358-827d-4cdf-bd04-a4370756bc41.svg', // imgIconChevR
  inbox: '/static/figma-devices-169-12665/46daffe4-1393-4572-9691-9df6a850d6d6.svg', // imgIconInbox
  check: '/static/figma-devices-358-7264/1f86ced8-df83-4775-a4ea-6af7c6c95879.svg', // imgIconCheckCircle
  materialError: '/static/figma-devices-358-7072/e193f456-4945-4b95-99b6-33c2a2a473d2.svg', // imgMaterialError
  materialInfo: '/static/figma-devices-169-12835/94788030-aa5f-42ce-8f89-0b626d7f06c9.svg', // imgMaterialInfo
  mascot: '/static/figma-devices-169-12591/c7d0c106-38ec-42eb-83dc-d47eb753faae.svg', // imgMascot
  dot: '/static/figma-devices-358-6788/2f1b5590-3fa8-4989-97d2-3eda52ec02c5.svg', // imgDot
  dotAlt: '/static/figma-devices-358-6788/61861281-89ce-4d9e-acf5-977f99d3469d.svg', // imgDot1
  dotGreen: '/static/figma-devices-169-12665/41e10610-dc91-443c-9f8f-95ff6e9fc90e.svg', // imgDot2
  glowLoading: '/static/figma-devices-169-12516/b6bfd7b4-2930-47e9-9c10-d6436bf1183b.svg', // imgGlow
  glowError: '/static/figma-devices-169-12591/534f02db-03d7-4e6e-8943-bb00232b0a0e.svg', // imgGlow
  glowEmpty: '/static/figma-devices-169-12665/7b3dab5f-9add-492c-992a-8a40dbda523e.svg', // imgGlow
  glowReady: '/static/figma-devices-358-6788/1c011da0-ff9e-4bc0-bb25-789d6d65bac1.svg', // imgGlow
  glowPending: '/static/figma-devices-358-7072/971065fe-5bba-491b-8346-ebb1813d2286.svg', // imgGlow
  glowRevoked: '/static/figma-devices-358-7264/31e8a0bc-621e-4e0f-8e8d-fc02fa9959f8.svg', // imgGlow
} as const

type LoadState = 'loading' | 'ready' | 'empty' | 'error'
type ErrorKind = 'load' | 'session' | 'forbidden'
type OutcomeKind = 'revoked' | 'bulk-revoked' | 'still-active' | 'bulk-partial' | 'readback-failed' | 'query-failed'

interface Outcome {
  kind: OutcomeKind
  deviceName?: string
  revoked?: number
  failed?: number
  stillActive?: number
}

const devices = ref<B8Device[]>([])
const status = ref<LoadState>('loading')
const errorKind = ref<ErrorKind>('load')
const errorMessage = ref('')
const actionError = ref('')
const busyAction = ref<string | null>(null)
const outcome = ref<Outcome | null>(null)
const pendingIds = ref<string[]>([])
const pendingNames = ref<Record<string, string>>({})
const pendingBulk = ref(false)
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
let devicesVisible = false
let loadEpoch = 0
let actionEpoch = 0

const confirmOpen = ref(false)
const confirmBulk = ref(false)
const confirmTarget = ref<B8Device | null>(null)
const cancelButton = ref<{ $el?: HTMLElement } | null>(null)
const dialogEl = ref<{ $el?: HTMLElement } | null>(null)
let confirmGeneration = 0
let previousFocus: HTMLElement | null = null

const unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })

function t(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`devicesPage.${key}`)
  return values ? interpolate(message, values) : message
}

function currentAccount(identity: { subject: string; revision: number } | null): boolean {
  return sameMobilePreferenceIdentity(identity, session.getMobileApiIdentity())
}

const revocableDevices = computed(() => devices.value.filter((device) => canRevokeMobileDevice(device, session.deviceId)))
const noIdentity = computed(() => !session.deviceId)
const busy = computed(() => busyAction.value !== null)
const dialogBusy = computed(() => (confirmBulk.value ? busyAction.value === 'others' : Boolean(confirmTarget.value && busyAction.value === confirmTarget.value?.deviceId)))

const glowSrc = computed(() => {
  if (status.value === 'loading') return A.glowLoading
  if (status.value === 'error') return A.glowError
  if (status.value === 'empty') return A.glowEmpty
  if (outcome.value?.kind === 'revoked' || outcome.value?.kind === 'bulk-revoked') return A.glowRevoked
  if (outcome.value) return A.glowPending
  return A.glowReady
})

const notice = computed(() => {
  const value = outcome.value
  if (!value) return null
  if (value.kind === 'revoked') return { tone: 'ok', title: '', text: t('outcomeRevoked', { device: value.deviceName ?? '' }), action: '' }
  if (value.kind === 'bulk-revoked') return { tone: 'ok', title: '', text: t('outcomeBulkRevoked', { count: mobileI18n.formatNumber(value.revoked ?? 0) }), action: '' }
  if (value.kind === 'still-active') return { tone: 'bad', title: t('noticePendingTitle'), text: t('noticePendingText', { device: value.deviceName ?? '' }), action: t('noticeActionRefresh') }
  if (value.kind === 'bulk-partial') {
    const parts: string[] = []
    if (value.revoked) parts.push(t('outcomeBulkConfirmed', { count: mobileI18n.formatNumber(value.revoked) }))
    if (value.failed) parts.push(t('outcomeBulkRejected', { count: mobileI18n.formatNumber(value.failed) }))
    if (value.stillActive) parts.push(t('outcomeBulkStillActive', { count: mobileI18n.formatNumber(value.stillActive) }))
    return { tone: value.failed || value.stillActive ? 'bad' : 'ok', title: t('tipStillActiveTitle'), text: parts.join(' '), action: t('noticeActionRefresh') }
  }
  if (value.kind === 'query-failed') return { tone: 'bad', title: t('noticeQueryFailedTitle'), text: t('noticeQueryFailedText'), action: t('noticeActionQuery') }
  const pending = value.stillActive ?? 0
  return {
    tone: 'bad',
    title: t('noticeReadbackTitle'),
    text: pending ? `${t('noticeReadbackText')} ${t('outcomeBulkUnknown', { count: mobileI18n.formatNumber(pending) })}` : t('noticeReadbackText'),
    action: t('noticeActionRefresh'),
  }
})

function deviceTypeLabel(type: string): string {
  switch (type.toUpperCase()) {
    case 'IOS': return t('typeIos')
    case 'ANDROID': return t('typeAndroid')
    case 'H5': return t('typeH5')
    case 'WEB': return t('typeWeb')
    case 'WEB_COOKIE': return t('typeWebCookie')
    default: return t('typeOther')
  }
}

function deviceName(device: B8Device): string { return deviceTypeLabel(device.deviceType) }

function deviceIcon(device: B8Device): string {
  switch (device.deviceType.toUpperCase()) {
    case 'IOS': return A.phone
    case 'ANDROID':
    case 'H5': return A.phoneAlt
    case 'WEB':
    case 'WEB_COOKIE': return A.monitor
    default: return A.phoneAlt
  }
}

function shortDeviceId(deviceId: string): string {
  return deviceId.length > 10 ? `…${deviceId.slice(-8)}` : deviceId
}

function lastLoginLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return t('unknownTime')
  const now = new Date()
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate()
  const time = mobileI18n.formatDate(date, { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `${t('todayLabel')} ${time}` : `${mobileI18n.formatDate(date, { month: 'short', day: 'numeric' })} ${time}`
}

function rowTag(device: B8Device): { label: string; tone: string } | null {
  if (isCurrentMobileDevice(device, session.deviceId)) return { label: t('tagCurrent'), tone: 'brand' }
  if (pendingIds.value.includes(device.deviceId)) return { label: t('tagPending'), tone: 'warn' }
  if (device.status === 'REVOKED') return { label: t('tagRevoked'), tone: 'muted' }
  if (canRevokeMobileDevice(device, session.deviceId)) return null
  return { label: t('tagActive'), tone: 'muted' }
}

function showExit(device: B8Device): boolean {
  return !noIdentity.value && !isCurrentMobileDevice(device, session.deviceId) && !pendingIds.value.includes(device.deviceId) && canRevokeMobileDevice(device, session.deviceId)
}

function errorText(error: unknown): { kind: ErrorKind; message: string } {
  const code = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : 0
  if (code === 401) return { kind: 'session', message: t('sessionExpired') }
  if (code === 403) return { kind: 'forbidden', message: t('forbidden') }
  return { kind: 'load', message: t('loadFailed') }
}

async function loadDevices(inline = false): Promise<boolean> {
  const identity = session.getMobileApiIdentity()
  if (!identity) { applyAccessFailure('session'); return false }
  const epoch = ++loadEpoch
  if (inline) busyAction.value = 'refresh'
  else {
    status.value = 'loading'
    devices.value = []
  }
  errorMessage.value = ''
  actionError.value = ''
  try {
    const nextDevices = await listMobileDevices()
    if (epoch !== loadEpoch || !currentAccount(identity)) return false
    devices.value = nextDevices
    status.value = nextDevices.length ? 'ready' : 'empty'
    pendingIds.value = pendingIds.value.filter((id) => nextDevices.some((device) => device.deviceId === id && device.status === 'ACTIVE'))
    if (outcome.value?.kind === 'query-failed') outcome.value = null
    return true
  } catch (error) {
    if (epoch !== loadEpoch || !currentAccount(identity)) return false
    const mapped = errorText(error)
    if (mapped.kind !== 'load') { applyAccessFailure(mapped.kind); return false }
    if (inline) actionError.value = t('refreshFailed')
    else {
      devices.value = []
      status.value = 'error'
      errorKind.value = 'load'
      errorMessage.value = mapped.message
    }
    return false
  } finally {
    if (epoch === loadEpoch && busyAction.value === 'refresh') busyAction.value = null
  }
}

interface ReadBack { ok: boolean; sessionExpired: boolean; forbidden: boolean; list: B8Device[] }

async function readBack(identity: { subject: string; revision: number }): Promise<ReadBack> {
  try {
    const list = await listMobileDevices()
    if (!currentAccount(identity)) return { ok: false, sessionExpired: false, forbidden: false, list: [] }
    return { ok: true, sessionExpired: false, forbidden: false, list }
  } catch (error) {
    const code = (error as { status?: number })?.status
    return { ok: false, sessionExpired: code === 401, forbidden: code === 403, list: [] }
  }
}

function applyAccessFailure(kind: 'session' | 'forbidden'): void {
  actionEpoch += 1
  loadEpoch += 1
  confirmGeneration += 1
  confirmOpen.value = false
  confirmTarget.value = null
  devices.value = []
  pendingIds.value = []
  pendingNames.value = {}
  pendingBulk.value = false
  busyAction.value = null
  outcome.value = null
  status.value = 'error'
  errorKind.value = kind
  errorMessage.value = kind === 'session' ? t('sessionExpired') : t('forbidden')
}

function focusable(instance: { $el?: HTMLElement } | null): HTMLElement | null {
  const host = instance?.$el
  if (!host) return null
  const inner = typeof host.querySelector === 'function'
    ? host.querySelector<HTMLElement>('button, [tabindex], input, a[href]')
    : null
  if (inner && typeof inner.focus === 'function') return inner
  return typeof host.focus === 'function' ? host : null
}

function restoreFocus(target: HTMLElement | null): void {
  if (!target) return
  if (typeof target.focus === 'function') { target.focus(); return }
  const inner = typeof target.querySelector === 'function' ? target.querySelector<HTMLElement>('button, [tabindex]') : null
  if (inner && typeof inner.focus === 'function') inner.focus()
}

function openConfirm(device: B8Device): void {
  if (busy.value || !canRevokeMobileDevice(device, session.deviceId)) return
  previousFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  confirmBulk.value = false
  confirmTarget.value = device
  confirmOpen.value = true
  nextTick(() => { const el = focusable(cancelButton.value); if (el) el.focus() })
}

function openBulkConfirm(): void {
  if (busy.value || !session.deviceId || !revocableDevices.value.length) return
  previousFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  confirmBulk.value = true
  confirmTarget.value = null
  confirmOpen.value = true
  nextTick(() => { const el = focusable(cancelButton.value); if (el) el.focus() })
}

function closeConfirm(force = false): void {
  if (confirmOpen.value && dialogBusy.value && !force) return
  confirmGeneration += 1
  confirmOpen.value = false
  confirmTarget.value = null
  const target = force ? null : previousFocus
  previousFocus = null
  if (target) restoreFocus(target)
}

async function confirmAndRevoke(): Promise<void> {
  if (!confirmOpen.value || dialogBusy.value) return
  const generation = ++confirmGeneration
  if (confirmBulk.value) await revokeOtherDevices(generation)
  else if (confirmTarget.value) await revokeDevice(confirmTarget.value, generation)
  if (generation === confirmGeneration && confirmOpen.value) closeConfirm(true)
}

async function revokeDevice(device: B8Device, generation: number): Promise<void> {
  if (busyAction.value || !canRevokeMobileDevice(device, session.deviceId)) return
  const identity = session.getMobileApiIdentity()
  if (!identity) { applyAccessFailure('session'); return }
  const epoch = actionEpoch
  busyAction.value = device.deviceId
  actionError.value = ''
  outcome.value = null
  try {
    await kickoutMobileDevice(device.deviceId)
    if (epoch !== actionEpoch || !currentAccount(identity) || generation !== confirmGeneration) return
    const rb = await readBack(identity)
    if (epoch !== actionEpoch || !currentAccount(identity) || generation !== confirmGeneration) return
    if (rb.sessionExpired) { applyAccessFailure('session'); return }
    if (rb.forbidden) { applyAccessFailure('forbidden'); return }
    if (!rb.ok) {
      if (!pendingIds.value.includes(device.deviceId)) pendingIds.value.push(device.deviceId)
      pendingNames.value[device.deviceId] = deviceName(device)
      pendingBulk.value = false
      outcome.value = { kind: 'readback-failed', deviceName: deviceName(device), stillActive: 1 }
      return
    }
    devices.value = rb.list
    status.value = rb.list.length ? 'ready' : 'empty'
    const still = rb.list.find((row) => row.deviceId === device.deviceId)
    if (still && still.status === 'ACTIVE') {
      if (!isCurrentMobileDevice(still, session.deviceId) && !pendingIds.value.includes(device.deviceId)) pendingIds.value.push(device.deviceId)
      pendingNames.value[device.deviceId] = deviceName(device)
      pendingBulk.value = false
      outcome.value = { kind: 'still-active', deviceName: deviceName(device) }
    } else {
      pendingIds.value = pendingIds.value.filter((id) => id !== device.deviceId)
      outcome.value = { kind: 'revoked', deviceName: deviceName(device) }
    }
  } catch (error) {
    if (epoch !== actionEpoch || !currentAccount(identity)) return
    const code = (error as { status?: number })?.status
    if (code === 401) { applyAccessFailure('session'); return }
    if (code === 403) { applyAccessFailure('forbidden'); return }
    actionError.value = t('kickoutFailed')
  } finally {
    if (epoch === actionEpoch && currentAccount(identity)) busyAction.value = null
  }
}

async function revokeOtherDevices(generation: number): Promise<void> {
  const targets = revocableDevices.value.slice()
  const identity = session.getMobileApiIdentity()
  if (!session.deviceId || !targets.length) return
  if (!identity) { applyAccessFailure('session'); return }
  const epoch = actionEpoch
  busyAction.value = 'others'
  actionError.value = ''
  outcome.value = null
  const targetIds = targets.map((device) => device.deviceId)
  let acceptedCount = 0
  let rejectedCount = 0
  try {
    for (const device of targets) {
      if (epoch !== actionEpoch || !currentAccount(identity) || generation !== confirmGeneration) return
      if (!canRevokeMobileDevice(device, session.deviceId)) continue
      try {
        await kickoutMobileDevice(device.deviceId)
        acceptedCount += 1
      } catch (error) {
        const code = (error as { status?: number })?.status
        if (code === 401) { applyAccessFailure('session'); return }
        if (code === 403) { applyAccessFailure('forbidden'); return }
        rejectedCount += 1
      }
    }
    if (epoch !== actionEpoch || !currentAccount(identity) || generation !== confirmGeneration) return
    const rb = await readBack(identity)
    if (epoch !== actionEpoch || !currentAccount(identity) || generation !== confirmGeneration) return
    if (rb.sessionExpired) { applyAccessFailure('session'); return }
    if (rb.forbidden) { applyAccessFailure('forbidden'); return }
    if (!rb.ok) {
      pendingIds.value = targetIds.slice()
      pendingBulk.value = true
      for (const device of targets) pendingNames.value[device.deviceId] = deviceName(device)
      outcome.value = { kind: 'readback-failed', revoked: 0, failed: rejectedCount, stillActive: acceptedCount }
      return
    }
    devices.value = rb.list
    status.value = rb.list.length ? 'ready' : 'empty'
    // Only a read-back that no longer shows the target signed in confirms the exit.
    const stillRows = rb.list.filter((device) => targetIds.includes(device.deviceId) && device.status === 'ACTIVE')
    // Pending actions are only tracked for devices this page may revoke; the current
    // device stays protected. Any target that is still ACTIVE, including one the server
    // marks current, blocks an overall success result.
    pendingIds.value = stillRows
      .filter((device) => !isCurrentMobileDevice(device, session.deviceId))
      .map((device) => device.deviceId)
    const confirmedCount = targetIds.filter((id) => !stillRows.some((device) => device.deviceId === id)).length
    pendingBulk.value = stillRows.length > 0
    if (rejectedCount > 0 || stillRows.length > 0) {
      outcome.value = { kind: 'bulk-partial', revoked: confirmedCount, failed: rejectedCount, stillActive: stillRows.length }
    } else {
      outcome.value = { kind: 'bulk-revoked', revoked: confirmedCount }
    }
  } finally {
    if (epoch === actionEpoch && currentAccount(identity)) busyAction.value = null
  }
}

async function refreshFromNotice(): Promise<void> {
  if (busy.value) return
  const identity = session.getMobileApiIdentity()
  if (!identity) { applyAccessFailure('session'); return }
  const epoch = ++actionEpoch
  const pendingBefore = pendingIds.value.slice()
  busyAction.value = 'refresh'
  actionError.value = ''
  try {
    const ok = await loadDevices(true)
    if (epoch !== actionEpoch || !currentAccount(identity)) return
    if (!ok) {
      pendingIds.value = pendingBefore
      if (status.value !== 'error') outcome.value = { kind: 'query-failed' }
      return
    }
    const stillActive = pendingBefore.filter((id) => devices.value.some((device) => device.deviceId === id && device.status === 'ACTIVE'))
    const confirmed = pendingBefore.filter((id) => !stillActive.includes(id))
    const bulk = pendingBulk.value
    pendingIds.value = stillActive
    if (!stillActive.length) pendingBulk.value = false
    if (stillActive.length && pendingBefore.length > 1) {
      outcome.value = { kind: 'bulk-partial', revoked: confirmed.length, failed: 0, stillActive: stillActive.length }
    } else if (stillActive.length) {
      const target = devices.value.find((device) => device.deviceId === stillActive[0])
      outcome.value = { kind: 'still-active', deviceName: target ? deviceName(target) : '' }
    } else if (bulk || pendingBefore.length > 1) {
      // All pending targets are confirmed gone: report the confirmed count, do not clear silently.
      outcome.value = { kind: 'bulk-revoked', revoked: confirmed.length }
    } else if (pendingBefore.length === 1) {
      const target = devices.value.find((device) => device.deviceId === pendingBefore[0])
      outcome.value = { kind: 'revoked', deviceName: target ? deviceName(target) : (pendingNames.value[pendingBefore[0]] ?? '') }
    } else {
      outcome.value = null
    }
  } finally {
    if (epoch === actionEpoch && busyAction.value === 'refresh') busyAction.value = null
  }
}

function retryLoad(): void { void loadDevices(false) }
function refreshList(): void { if (busy.value) return; void loadDevices(false) }

function onDocumentKeydown(event: KeyboardEvent): void {
  if (!confirmOpen.value) return
  if (event.key === 'Escape') { if (!dialogBusy.value) closeConfirm(); return }
  if (event.key !== 'Tab') return
  const root = dialogEl.value?.$el
  if (!root || typeof root.querySelectorAll !== 'function') return
  const selector = 'button, uni-button, [role="button"], input, a[href], [tabindex]'
  const nodes = Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((node) => {
    if (node.hasAttribute('disabled') || node.getAttribute('aria-disabled') === 'true') return false
    if (node.getAttribute('tabindex') === '-1') return false
    if (typeof node.getClientRects === 'function' && node.getClientRects().length === 0) return false
    return typeof node.focus === 'function'
  })
  if (!nodes.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

watch(() => session.identityRevision, () => {
  loadEpoch += 1
  actionEpoch += 1
  devices.value = []
  status.value = 'loading'
  errorMessage.value = ''
  actionError.value = ''
  outcome.value = null
  pendingIds.value = []
  pendingNames.value = {}
  pendingBulk.value = false
  busyAction.value = null
  confirmGeneration += 1
  confirmOpen.value = false
  confirmTarget.value = null
  if (devicesVisible && session.getMobileApiIdentity()) void loadDevices(false)
}, { flush: 'sync' })

onMounted(() => { if (typeof document !== 'undefined') document.addEventListener('keydown', onDocumentKeydown) })
onBeforeUnmount(() => {
  unsubscribeTheme()
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onDocumentKeydown)
})

onShow(async () => {
  if (await ensureMobilePageAccess('/pages/devices/devices')) {
    devicesVisible = true
    await loadDevices(false)
  }
})

onHide(() => {
  devicesVisible = false
  loadEpoch += 1
  actionEpoch += 1
  confirmGeneration += 1
  confirmOpen.value = false
  confirmTarget.value = null
  busyAction.value = null
})
</script>

<template>
  <view
    id="devices-shell"
    class="yx-page dev-shell"
    :class="`dev-shell--${status}`"
    :style="experienceStyle"
    :data-motion="experienceMotion"
    :data-resolved-theme="resolvedTheme"
    :data-devices-state="status"
  >
    <view class="dev-glow" aria-hidden="true">
      <image class="dev-glow-image" :src="glowSrc" mode="scaleToFill" />
    </view>

    <view class="dev-canvas">
      <MobilePageHeader page="settings" compact :title="t('navTitle')" :show-settings="false" :back-icon-src="A.chevL" />

      <view class="dev-heading">
        <text class="dev-title" role="heading" aria-level="1">{{ t('pageTitle') }}</text>
        <text class="dev-subtitle">{{ t('pageSubtitle') }}</text>
      </view>

      <text v-if="actionError" class="dev-inline-error" role="alert">{{ actionError }}</text>

      <!-- Loading -->
      <template v-if="status === 'loading'">
        <view class="dev-card dev-skeleton-card" aria-hidden="true">
          <view class="dev-skeleton-line dev-skeleton-line--title"></view>
          <view class="dev-skeleton-row"><view class="dev-skeleton-tile"></view><view class="dev-skeleton-copy"><view class="dev-skeleton-line"></view><view class="dev-skeleton-line dev-skeleton-line--short"></view></view></view>
          <view class="dev-skeleton-row"><view class="dev-skeleton-tile"></view><view class="dev-skeleton-copy"><view class="dev-skeleton-line"></view><view class="dev-skeleton-line dev-skeleton-line--short"></view></view></view>
          <view class="dev-skeleton-row"><view class="dev-skeleton-tile"></view><view class="dev-skeleton-copy"><view class="dev-skeleton-line"></view><view class="dev-skeleton-line dev-skeleton-line--short"></view></view></view>
        </view>
        <text class="dev-state-note" role="status" aria-live="polite">{{ t('loading') }}</text>
        <view class="dev-tips">
          <view class="dev-tip"><image class="dev-dot" :src="A.dot" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('loadingTip1Title') }}</text><text class="dev-tip-text">{{ t('loadingTip1Text') }}</text></view></view>
          <view class="dev-tip"><image class="dev-dot" :src="A.dotAlt" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('loadingTip2Title') }}</text><text class="dev-tip-text">{{ t('loadingTip2Text') }}</text></view></view>
          <view class="dev-tip"><image class="dev-dot" :src="A.dotGreen" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('loadingTip3Title') }}</text><text class="dev-tip-text">{{ t('loadingTip3Text') }}</text></view></view>
        </view>
      </template>

      <!-- Error -->
      <template v-else-if="status === 'error'">
        <view class="dev-card dev-error-card" role="alert">
          <image class="dev-mascot" :src="A.mascot" mode="aspectFit" aria-hidden="true" />
          <text class="dev-error-title" role="heading" aria-level="2">{{ errorKind === 'session' ? t('sessionExpired') : errorKind === 'forbidden' ? t('forbidden') : t('errorTitle') }}</text>
          <text class="dev-error-text">{{ errorKind === 'load' ? errorMessage : t('errorFallback') }}</text>
        </view>
      </template>

      <!-- Empty -->
      <template v-else-if="status === 'empty'">
        <view class="dev-card">
          <view class="dev-card-head">
            <text class="dev-card-title" role="heading" aria-level="2">{{ t('cardTitle') }}</text>
            <button tabindex="0" role="button" type="button" class="dev-text-link" :disabled="busy" :aria-busy="busyAction === 'refresh' ? 'true' : 'false'" @click="refreshList"><text>{{ busyAction === 'refresh' ? t('refreshing') : t('refresh') }}</text></button>
          </view>
          <view class="dev-divider"></view>
          <view class="dev-empty-row">
            <image class="dev-empty-icon" :src="A.inbox" mode="aspectFit" aria-hidden="true" />
            <text class="dev-empty-text">{{ t('emptyText') }}</text>
          </view>
          <button tabindex="0" role="button" type="button" class="dev-soft-button" :disabled="busy" @click="refreshList"><text>{{ t('refresh') }}</text></button>
        </view>
        <view class="dev-tips">
          <view class="dev-tip"><image class="dev-dot" :src="A.dot" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('emptyTip1Title') }}</text><text class="dev-tip-text">{{ t('emptyTip1Text') }}</text></view></view>
          <view class="dev-tip"><image class="dev-dot" :src="A.dotAlt" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('emptyTip2Title') }}</text><text class="dev-tip-text">{{ t('emptyTip2Text') }}</text></view></view>
          <view class="dev-tip"><image class="dev-dot" :src="A.dotGreen" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('emptyTip3Title') }}</text><text class="dev-tip-text">{{ t('emptyTip3Text') }}</text></view></view>
        </view>
      </template>

      <!-- Ready -->
      <template v-else>
        <view v-if="noIdentity" class="dev-card dev-safety-card" role="alert">
          <view class="dev-safety-head"><image class="dev-safety-icon" :src="A.materialInfo" mode="aspectFit" aria-hidden="true" /><text class="dev-safety-title">{{ t('noIdentityTitle') }}</text></view>
          <text class="dev-safety-text">{{ t('noIdentityText') }}</text>
        </view>

        <view class="dev-card">
          <view class="dev-card-head">
            <text class="dev-card-title" role="heading" aria-level="2">{{ t('cardTitle') }}</text>
            <button tabindex="0" role="button" type="button" class="dev-text-link" :disabled="busy" :aria-busy="busyAction === 'refresh' ? 'true' : 'false'" @click="refreshList"><text>{{ busyAction === 'refresh' ? t('refreshing') : t('refresh') }}</text></button>
          </view>
          <view class="dev-divider"></view>
          <template v-for="(device, index) in devices" :key="device.deviceId">
            <view v-if="index > 0" class="dev-divider"></view>
            <view class="dev-row" :class="{ 'dev-row--current': isCurrentMobileDevice(device, session.deviceId) }">
              <view class="dev-tile" :class="{ 'dev-tile--brand': isCurrentMobileDevice(device, session.deviceId) }" aria-hidden="true">
                <image class="dev-tile-icon" :src="deviceIcon(device)" mode="aspectFit" />
              </view>
              <view class="dev-row-copy">
                <text class="dev-row-title">{{ deviceName(device) }}</text>
                <text class="dev-row-meta">{{ t('lastLoginLabel') }} {{ lastLoginLabel(device.lastActiveAt) }}</text>
              </view>
              <text v-if="busyAction === device.deviceId" class="dev-row-busy" role="status" aria-live="polite">{{ t('rowExiting') }}</text>
              <text v-else-if="rowTag(device)" class="dev-tag" :class="`dev-tag--${rowTag(device)?.tone}`">{{ rowTag(device)?.label }}</text>
              <button v-else-if="showExit(device)" tabindex="0" role="button" type="button" class="dev-row-action" :disabled="busy" :aria-label="`${t('rowExit')} ${deviceName(device)}`" @click="openConfirm(device)"><text>{{ t('rowExit') }}</text></button>
              <image v-else-if="noIdentity" class="dev-row-chevron" :src="A.chevR" mode="aspectFit" aria-hidden="true" />
            </view>
          </template>
        </view>

        <text class="dev-footer-note">{{ t('footerNote') }}</text>

        <view v-if="notice" class="dev-notice" :class="`dev-notice--${notice.tone}`" :role="notice.tone === 'bad' ? 'alert' : 'status'" aria-live="polite">
          <image v-if="notice.tone === 'ok'" class="dev-notice-icon" :src="A.check" mode="aspectFit" aria-hidden="true" />
          <image v-else class="dev-notice-icon" :src="A.materialError" mode="aspectFit" aria-hidden="true" />
          <view class="dev-notice-copy">
            <text v-if="notice.title" class="dev-notice-title">{{ notice.title }}</text>
            <text class="dev-notice-text">{{ notice.text }}</text>
          </view>
          <button v-if="notice.action" tabindex="0" role="button" type="button" class="dev-notice-action" :disabled="busy" @click="refreshFromNotice"><text>{{ notice.action }}</text></button>
        </view>

        <view class="dev-tips">
          <view class="dev-tip"><image class="dev-dot" :src="A.dot" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('tipCurrentTitle') }}</text><text class="dev-tip-text">{{ t('tipCurrentText') }}</text></view></view>
          <view class="dev-tip"><image class="dev-dot" :src="A.dotAlt" mode="aspectFit" aria-hidden="true" /><view class="dev-tip-copy"><text class="dev-tip-title">{{ t('tipUnknownTitle') }}</text><text class="dev-tip-text">{{ t('tipUnknownText') }}</text></view></view>
        </view>
      </template>
    </view>

    <view v-if="status === 'ready' || status === 'error'" class="dev-cta-bar">
      <button v-if="status === 'error'" tabindex="0" role="button" type="button" class="dev-cta" :disabled="busy" @click="retryLoad"><text>{{ t('retry') }}</text></button>
      <button
        v-else
        tabindex="0"
        role="button"
        type="button"
        class="dev-cta"
        :disabled="busy || noIdentity || !revocableDevices.length"
        :aria-busy="busyAction === 'others' ? 'true' : 'false'"
        @click="openBulkConfirm"
      ><text>{{ busyAction === 'others' ? t('ctaOthersBusy') : noIdentity || !revocableDevices.length ? t('ctaOthersDisabled') : t('ctaOthers', { count: mobileI18n.formatNumber(revocableDevices.length) }) }}</text></button>
    </view>

    <view v-if="confirmOpen" class="dev-overlay">
      <view ref="dialogEl" class="dev-dialog" role="dialog" aria-modal="true" :aria-labelledby="t('dialogTitleId')" :aria-describedby="t('dialogTextId')">
        <text :id="t('dialogTitleId')" class="dev-dialog-title" role="heading" aria-level="2">{{ confirmBulk ? t('confirmBulkTitle') : t('confirmSingleTitle') }}</text>
        <text :id="t('dialogTextId')" class="dev-dialog-text">{{ confirmBulk ? t('confirmBulkText', { count: mobileI18n.formatNumber(revocableDevices.length) }) : t('confirmSingleText', { device: confirmTarget ? `${deviceName(confirmTarget)} ${shortDeviceId(confirmTarget.deviceId)}` : '' }) }}</text>
        <button tabindex="0" role="button" type="button" class="dev-danger" :disabled="dialogBusy" :aria-busy="dialogBusy ? 'true' : 'false'" @click="confirmAndRevoke"><text>{{ dialogBusy ? t('confirmBusy') : t('confirmAction') }}</text></button>
        <button ref="cancelButton" tabindex="0" role="button" type="button" class="dev-cancel" :disabled="dialogBusy" @click="closeConfirm()"><text>{{ t('cancel') }}</text></button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.dev-shell {
  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 0 0 calc(140px + env(safe-area-inset-bottom));
  overflow: hidden;
  background-color: var(--yx-r4-page-color, #fcfaff);
  background-image: var(--yx-profile-page-image, var(--yx-r4-home-image));
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--yx-r4-ink, var(--v2-ink));
  font-family: var(--v2-font);
}

.dev-glow { position: absolute; left: 60px; top: -230px; width: 540px; height: 480px; z-index: 0; pointer-events: none; }
.dev-glow-image { display: block; width: 540px; height: 480px; }

.dev-canvas {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  max-width: 430px;
  min-width: 0;
  margin: 0 auto;
  padding: 0 24px;
}

.dev-heading { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dev-title { display: block; margin: 0; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 28px; line-height: 1.2857; font-weight: 700; overflow-wrap: anywhere; }
.dev-subtitle { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 14px; line-height: 1.5714; overflow-wrap: anywhere; }

.dev-inline-error { display: block; padding: 10px 14px; border: 1px solid var(--v2-bad); border-radius: 14px; background: var(--v2-bad-soft); color: var(--v2-bad); font-size: 13px; line-height: 1.5; }

.dev-card {
  position: relative;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  min-width: 0;
  padding: 6px 20px;
  border: 1px solid var(--yx-profile-glass-border, var(--yx-r4-glass-border));
  border-radius: 24px;
  background: var(--yx-profile-glass, var(--yx-r4-glass));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
  backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
}

.dev-card-head { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 2px 0; }
.dev-card-title { flex: 1 1 auto; min-width: 0; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 18px; line-height: 1.4444; font-weight: 700; overflow-wrap: anywhere; }
.dev-text-link { flex: none; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; margin: 0; padding: 12px 8px; border: 0; background: transparent; color: var(--yx-r4-brand, var(--v2-brand)); font-size: 14px; line-height: 1.4; font-weight: 500; }
.dev-text-link text, .dev-row-action text, .dev-notice-action text, .dev-cancel text, .dev-soft-button text, .dev-cta text, .dev-danger text { color: inherit; }
.dev-text-link:disabled { opacity: .55; }
.dev-text-link:focus-visible, .dev-row-action:focus-visible, .dev-notice-action:focus-visible, .dev-cancel:focus-visible, .dev-soft-button:focus-visible, .dev-cta:focus-visible, .dev-danger:focus-visible { outline: none; box-shadow: var(--v2-focus); border-radius: 12px; }

.dev-divider { height: 1px; background: var(--v2-line); }

.dev-row { display: flex; align-items: center; gap: 12px; box-sizing: border-box; min-height: 56px; padding: 10px 0; min-width: 0; }
.dev-tile { flex: none; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; background: var(--yx-profile-tile-neutral, #ecedf3); }
.dev-tile--brand { background: var(--v2-soft); }
.dev-tile-icon { width: 22px; height: 22px; }
.dev-row-copy { flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dev-row-title { display: block; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 15px; line-height: 1.4667; font-weight: 700; overflow-wrap: anywhere; }
.dev-row-meta { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.3846; overflow-wrap: anywhere; }
.dev-row-busy { flex: none; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.4; }
.dev-row-action { flex: none; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; min-width: 44px; margin: 0; padding: 12px 8px; border: 0; background: transparent; color: var(--yx-r4-brand, var(--v2-brand)); font-size: 14px; line-height: 1.4; font-weight: 500; }
.dev-row-action:disabled { opacity: .55; }
.dev-row-chevron { flex: none; width: 16px; height: 16px; opacity: .7; }

.dev-tag { flex: none; display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5; font-weight: 700; white-space: nowrap; }
.dev-tag--brand { background: var(--v2-soft); color: var(--yx-r4-brand, var(--v2-brand)); }
.dev-tag--warn { background: var(--v2-warn-soft); color: var(--v2-warn); }
.dev-tag--muted { background: var(--v2-surface); color: var(--yx-r4-muted, var(--v2-mut)); }

.dev-footer-note { display: block; margin-top: -4px; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 12px; line-height: 1.5; }

.dev-tips { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
.dev-tip {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--yx-profile-glass-border, var(--yx-r4-glass-border));
  border-radius: 18px;
  background: var(--yx-profile-glass, var(--yx-r4-glass));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
  backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
}
.dev-dot { flex: none; width: 8px; height: 8px; margin-top: 6px; }
.dev-tip-copy { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.dev-tip-title { display: block; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 14px; line-height: 1.4; font-weight: 700; }
.dev-tip-text { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.45; }

.dev-state-note { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.5; }

.dev-skeleton-card { gap: 14px; padding: 20px; }
.dev-skeleton-line { height: 12px; border-radius: 6px; background: var(--v2-surface); }
.dev-skeleton-line--title { width: 38%; height: 16px; }
.dev-skeleton-line--short { width: 60%; }
.dev-skeleton-row { display: flex; align-items: center; gap: 12px; }
.dev-skeleton-tile { width: 44px; height: 44px; border-radius: 14px; background: var(--v2-surface); }
.dev-skeleton-copy { flex: 1 1 auto; display: flex; flex-direction: column; gap: 8px; }

.dev-error-card { align-items: center; gap: 10px; padding: 28px 20px; text-align: center; }
.dev-mascot { width: 96px; height: 96px; }
.dev-error-title { display: block; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 20px; line-height: 1.4; font-weight: 700; overflow-wrap: anywhere; }
.dev-error-text { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 14px; line-height: 1.5; overflow-wrap: anywhere; }

.dev-empty-row { display: flex; align-items: center; gap: 12px; padding: 14px 0; }
.dev-empty-icon { flex: none; width: 22px; height: 22px; }
.dev-empty-text { color: var(--yx-r4-muted, var(--v2-mut)); font-size: 14px; line-height: 1.5; }
.dev-soft-button { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; margin: 6px 0 14px; padding: 12px 16px; border: 0; border-radius: 12px; background: var(--v2-soft); color: var(--yx-r4-brand, var(--v2-brand)); font-size: 14px; font-weight: 600; }

.dev-safety-card { gap: 6px; padding: 14px 16px; border-radius: 18px; }
.dev-safety-head { display: flex; align-items: center; gap: 10px; }
.dev-safety-icon { flex: none; width: 22px; height: 22px; }
.dev-safety-title { color: var(--yx-r4-ink, var(--v2-ink)); font-size: 14px; line-height: 1.4; font-weight: 700; }
.dev-safety-text { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.45; }

.dev-notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--yx-profile-glass-border, var(--yx-r4-glass-border));
  border-radius: 18px;
  background: var(--yx-profile-glass, var(--yx-r4-glass));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
  backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
}
.dev-notice--ok { border-color: var(--v2-ok); }
.dev-notice--bad { border-color: var(--v2-bad); }
.dev-notice-icon { flex: none; width: 22px; height: 22px; margin-top: 1px; }
.dev-notice-copy { flex: 1 1 auto; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.dev-notice-title { display: block; font-size: 14px; line-height: 1.4; font-weight: 700; }
.dev-notice--ok .dev-notice-title, .dev-notice--ok .dev-notice-text { color: var(--v2-ok); }
.dev-notice--bad .dev-notice-title { color: var(--v2-bad); }
.dev-notice-text { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 13px; line-height: 1.45; }
.dev-notice-action { flex: none; display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 8px; border: 0; background: transparent; color: var(--yx-r4-brand, var(--v2-brand)); font-size: 13px; font-weight: 600; }

.dev-cta-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  box-sizing: border-box;
  width: 100%;
  max-width: 430px;
  margin: 0 auto;
  padding: 12px 24px calc(30px + env(safe-area-inset-bottom));
  background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
}
.dev-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 14px 20px;
  border: 0;
  border-radius: 14px;
  background-color: var(--yx-r4-cta-color, var(--v2-brand));
  background-image: var(--yx-r4-cta-image, linear-gradient(172deg, #4f2dae 14.3%, #6a45c6 53.6%, #8a55cc 85.7%));
  box-shadow: var(--yx-r4-shadow-cta, var(--yx-profile-cta-shadow));
  color: var(--yx-r4-on-cta, var(--v2-inverse));
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
}
.dev-cta:disabled { box-shadow: none; opacity: .55; }

.dev-overlay::before { content: ""; position: absolute; inset: 0; background: var(--yx-profile-scrim, #1a1435); opacity: var(--yx-profile-scrim-opacity, .4); }
.dev-dialog { position: relative; z-index: 1; }
.dev-overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  backdrop-filter: blur(2px);
}
.dev-dialog {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 342px;
  padding: 24px 24px 16px;
  border: 1px solid var(--yx-profile-glass-border, var(--yx-r4-glass-border));
  border-radius: 28px;
  background: var(--yx-profile-glass, var(--yx-r4-glass));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
  backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  text-align: center;
}
.dev-dialog-title { display: block; color: var(--yx-r4-ink, var(--v2-ink)); font-size: 20px; line-height: 1.4; font-weight: 700; }
.dev-dialog-text { display: block; color: var(--yx-r4-muted, var(--v2-mut)); font-size: 15px; line-height: 1.5; }
.dev-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin-top: 6px;
  padding: 14px 20px;
  border: 0;
  border-radius: 14px;
  background: var(--v2-bad);
  color: var(--v2-inverse);
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
}
.dev-danger:disabled { opacity: .6; }
.dev-cancel { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 12px 8px; border: 0; background: transparent; color: var(--yx-r4-brand, var(--v2-brand)); font-size: 14px; font-weight: 500; }

/* High contrast: no glow, 2px borders, text carries state, no color-only signal. */
#devices-shell[data-resolved-theme="high-contrast"] .dev-glow { display: none; }
#devices-shell[data-resolved-theme="high-contrast"] .dev-card,
#devices-shell[data-resolved-theme="high-contrast"] .dev-tip,
#devices-shell[data-resolved-theme="high-contrast"] .dev-notice,
#devices-shell[data-resolved-theme="high-contrast"] .dev-dialog { border-width: 2px; border-color: var(--yx-border); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
#devices-shell[data-resolved-theme="high-contrast"] .dev-cta,
#devices-shell[data-resolved-theme="high-contrast"] .dev-danger { border: 2px solid var(--yx-border); background-image: none; box-shadow: none; }
/* HC brand is a light lavender; keep text on the dark surface token, not white-on-lavender. */
#devices-shell[data-resolved-theme="high-contrast"] .dev-cta { color: var(--yx-surface-page); }
#devices-shell[data-resolved-theme="high-contrast"] .dev-tag { border: 1px solid var(--yx-border); }
#devices-shell[data-resolved-theme="high-contrast"] .dev-divider { height: 2px; }
#devices-shell[data-resolved-theme="high-contrast"] .dev-notice--ok .dev-notice-title::before { content: "✓ "; }
#devices-shell[data-resolved-theme="high-contrast"] .dev-notice--bad .dev-notice-title::before { content: "! "; }

/* Reduced motion: keep state changes immediate. */
#devices-shell[data-motion="reduced"] .dev-cta,
#devices-shell[data-motion="reduced"] .dev-danger,
#devices-shell[data-motion="reduced"] .dev-card,
#devices-shell[data-motion="reduced"] .dev-tip { transition: none; }
#devices-shell[data-motion="off"] .dev-glow { display: none; }

@media (max-width: 340px) {
  .dev-canvas { padding: 0 16px; }
  .dev-cta-bar { padding-left: 16px; padding-right: 16px; }
  .dev-title { font-size: 24px; line-height: 1.3333; }
  .dev-card { padding-left: 14px; padding-right: 14px; }
  .dev-tag { white-space: normal; }
  .dev-row { gap: 10px; }
}

@media (min-width: 700px) {
  .dev-canvas { max-width: 430px; }
  .dev-cta-bar { max-width: 430px; }
}
</style>
