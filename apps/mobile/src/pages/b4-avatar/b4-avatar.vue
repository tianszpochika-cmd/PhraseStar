<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBackPress, onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { MobileApiError } from '../../api/client'
import { getB4AvatarProfile, getB4AvatarResources, listB4AvatarItems, listB4Loadouts } from '../../api/b4'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { B4_PERFORMANCE_LEVELS, type B4PerformanceLevel } from '../../domain/b4'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { mobileThemeController } from '../../platform/v2-foundation'
import { useB4Store } from '../../stores/b4'
import { useSessionStore } from '../../stores/session'
import {
  currentLoadoutId, loadoutSlots, ownedKey, parseAvatarItems, parseAvatarLoadouts,
  parseAvatarProfile, parseAvatarResources, qualityKey, slotKey,
  type AvatarItemView, type AvatarLoadoutView, type AvatarProfileView, type AvatarResourcesView,
} from './avatar-page'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const b4 = useB4Store()
const PAGE_PATH = '/pages/b4-avatar/b4-avatar'
const QUALITY_KEYS: Record<B4PerformanceLevel, string> = { Ultra: 'qualityUltra', High: 'qualityHigh', Medium: 'qualityMedium', Performance: 'qualityPerformance' }
const SET_ICONS = [
  '/static/figma-avatar-sets-169-8100/769c7f85-d9fe-46ba-923c-7b17512a0cd2.svg',
  '/static/figma-avatar-sets-169-8100/e9529593-8425-4155-9723-43ddbc053cd3.svg',
  '/static/figma-avatar-sets-169-8100/64e0b908-aa93-4f93-90b3-a98fbcef931a.svg',
]
const PREVIEW_GLOW = '/static/figma-avatar-preview-169-8026/93ad538f-c264-4361-9fd2-f7bf070790df.svg'
const PREVIEW_MASCOT = '/static/figma-avatar-preview-169-8026/f4b60518-3a5d-4a34-bafd-25771c0b91f6.svg'
const PREVIEW_DOT = '/static/figma-avatar-preview-169-8026/0059402e-43f9-49bf-b94f-17bc68b06133.svg'
const SETS_GLOW = '/static/figma-avatar-sets-169-8100/1e0352f2-82f3-43eb-8c77-aca71ee16bd7.svg'
const SETS_MASCOT = '/static/figma-avatar-sets-169-8100/fe5ca419-5bd9-4428-96ca-5f507227ccf4.svg'
const SET_CHEVRON = '/static/figma-avatar-sets-169-8100/00cb52af-4b25-4157-92e3-7cd84abb3249.svg'
const EMPTY_GLOW = '/static/figma-avatar-empty-169-8202/6ac157bd-8217-476b-8edd-595d3702e4f1.svg'
const EMPTY_MASCOT = '/static/figma-avatar-empty-169-8202/2493ae21-23fc-4d6c-a29a-96b5edecb91f.svg'
const EMPTY_DOTS = [
  '/static/figma-avatar-empty-169-8202/4f3f7208-9708-43d0-9cd5-73807acec134.svg',
  '/static/figma-avatar-empty-169-8202/72ffec8d-f808-49bc-9285-52d6d7cd3f8e.svg',
  '/static/figma-avatar-empty-169-8202/7a067c82-1169-4ba2-9428-f1034fa1ca23.svg',
]
const EMPTY_TIPS = [
  { dot: EMPTY_DOTS[0], title: 'emptyTipTodayTitle', body: 'emptyTipTodayBody' },
  { dot: EMPTY_DOTS[1], title: 'emptyTipCourseTitle', body: 'emptyTipCourseBody' },
  { dot: EMPTY_DOTS[2], title: 'emptyTipPracticeTitle', body: 'emptyTipPracticeBody' },
]
const UNAVAILABLE_GLOW = '/static/figma-avatar-unavailable-169-7955/b2e9c4e4-3537-4cf6-8f75-237f137fdf8e.svg'
const UNAVAILABLE_ICON = '/static/figma-avatar-unavailable-169-7955/70395da5-c6e3-44d1-8d19-344481ab25e3.svg'
const accessGranted = ref(false)
const surface = ref<'preview' | 'wardrobe'>('preview')
const pageState = ref<'permission' | 'loading' | 'ready' | 'unavailable'>('loading')
const permissionForbidden = ref(false)
const profile = ref<AvatarProfileView | null>(null)
const items = ref<AvatarItemView[]>([])
const loadouts = ref<AvatarLoadoutView[]>([])
const resources = ref<AvatarResourcesView | null>(null)
const loadoutsError = ref(false)
const itemsError = ref(false)
const previewLoadout = ref<AvatarLoadoutView | null>(null)
const previewCard = ref<unknown>(null)
const lastFocus = ref<HTMLElement | null>(null)
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
let epoch = 0
let request = 0
let visible = false
let showSerial = 0
let showActive = 0
let activeLoad: { epoch: number; promise: Promise<void> } | null = null
let unsubscribeTheme: (() => void) | undefined
let escapeListener: ((event: KeyboardEvent) => void) | undefined
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)

function avatarT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`avatarPage.${key}`)
  return values ? interpolate(message, values) : message
}
const qualityLabels = computed(() => B4_PERFORMANCE_LEVELS.map((level) => mobileT(QUALITY_KEYS[level])))
const qualityIndex = computed(() => Math.max(0, B4_PERFORMANCE_LEVELS.indexOf(b4.performanceLevel as B4PerformanceLevel)))
const currentId = computed(() => currentLoadoutId(profile.value, loadouts.value))
const currentName = computed(() => {
  const loadout = loadouts.value.find((item) => item.loadoutId === currentId.value)
  return loadout ? loadoutTitle(loadout, loadouts.value.indexOf(loadout)) : null
})
const previewSlots = computed(() => previewLoadout.value ? loadoutSlots(previewLoadout.value, items.value) : [])
const manifestReady = computed(() => resources.value?.manifestAvailable === true)
const wardrobeEmpty = computed(() => surface.value === 'wardrobe' && !loadoutsError.value && loadouts.value.length === 0)
const glowSrc = computed(() => {
  if (pageState.value === 'unavailable') return UNAVAILABLE_GLOW
  if (wardrobeEmpty.value) return EMPTY_GLOW
  return surface.value === 'wardrobe' ? SETS_GLOW : PREVIEW_GLOW
})
const stageMascot = computed(() => {
  if (wardrobeEmpty.value) return EMPTY_MASCOT
  return surface.value === 'wardrobe' ? SETS_MASCOT : PREVIEW_MASCOT
})

function accountSnapshot(): { subject: string; revision: number } | null {
  return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
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
  // Compiled H5 can resume this show after the top page has changed without calling onHide.
  if (routeStillThisPage()) return false
  if (visible) {
    visible = false
    epoch += 1
    request += 1
    activeLoad = null
    accessGranted.value = false
    pageState.value = 'loading'
    resetSurface()
    clearFacts()
  }
  return true
}
function isCurrent(runEpoch: number, owner: { subject: string; revision: number }): boolean {
  return pageEpochCurrent(runEpoch) && routeStillThisPage() && Boolean(session.isAuthenticated && session.verifiedSubject === owner.subject && session.identityRevision === owner.revision)
}
function pageEpochCurrent(runEpoch: number): boolean { return visible && epoch === runEpoch }
function clearFacts(): void {
  profile.value = null
  items.value = []
  loadouts.value = []
  resources.value = null
  loadoutsError.value = false
  itemsError.value = false
  previewLoadout.value = null
}
function selectPerformance(event: { detail: { value: number } }): void {
  const level = B4_PERFORMANCE_LEVELS[Number(event.detail.value)]
  if (level) b4.setPerformance(level)
}
function qualityLabel(level: B4PerformanceLevel): string { return mobileT(QUALITY_KEYS[level]) }
function loadoutTitle(loadout: AvatarLoadoutView, index: number): string {
  return loadout.name !== loadout.loadoutId ? loadout.name : avatarT('setFallback', { count: index + 1 })
}
function itemTitle(item: AvatarItemView): string { return avatarT(slotKey(item.slot)) }
function itemQuality(item: AvatarItemView): string { return avatarT(qualityKey(item.quality)) }
function setIcon(index: number): string { return SET_ICONS[index % SET_ICONS.length] ?? SET_ICONS[0] }
function setTone(index: number): string { return (['brand', 'warn', 'neutral'] as const)[index % 3] ?? 'neutral' }
function scrollAvatarTop(): void {
  if (typeof document !== 'undefined' && document.scrollingElement) document.scrollingElement.scrollTop = 0
  if (typeof window !== 'undefined') window.scrollTo(0, 0)
}
function resetSurface(): void { surface.value = 'preview' }
function goWardrobe(): void {
  if (pageState.value !== 'ready' || surface.value === 'wardrobe') return
  surface.value = 'wardrobe'
  previewLoadout.value = null
  scrollAvatarTop()
}
function leaveWardrobe(): void {
  if (surface.value !== 'wardrobe') return
  surface.value = 'preview'
  scrollAvatarTop()
}
function returnAvatarStep(): boolean {
  if (surface.value !== 'wardrobe') return false
  leaveWardrobe()
  return true
}
onBackPress(() => returnAvatarStep())
function backToGrowth(): void { void Promise.resolve(openUniPage('/pages/world/world')) }
function openLogin(): void { void Promise.resolve(openUniPage('/pages/login/login')) }
function retry(): void {
  if (!accessGranted.value) { openLogin(); return }
  const owner = accountSnapshot()
  if (!owner) { pageState.value = 'permission'; return }
  void loadAvatarPage(epoch, owner)
}
function openPreview(loadout: AvatarLoadoutView): void {
  lastFocus.value = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  previewLoadout.value = loadout
  void nextTick(() => { const card = previewCard.value as { focus?: () => void } | null; card?.focus?.() })
}
function closePreview(): void {
  previewLoadout.value = null
  void nextTick(() => lastFocus.value?.focus?.())
}

function applyProfile(value: unknown): void { profile.value = parseAvatarProfile(value) }
function applyItems(value: unknown): void { items.value = parseAvatarItems(value); itemsError.value = false }
function applyLoadouts(value: unknown): void { loadouts.value = parseAvatarLoadouts(value); loadoutsError.value = false }
function applyResources(value: unknown): void { resources.value = parseAvatarResources(value) }
function isAuthFailure(error: unknown): error is MobileApiError {
  return error instanceof MobileApiError && (error.status === 401 || error.status === 403)
}

function loadAvatarPage(runEpoch = ++epoch, owner = accountSnapshot()): Promise<void> {
  if (dropIfRouteLeft() || !visible || !owner || !pageEpochCurrent(runEpoch)) return Promise.resolve()
  if (activeLoad && activeLoad.epoch === runEpoch) return activeLoad.promise
  const promise = (async () => {
    pageState.value = 'loading'
    permissionForbidden.value = false
    clearFacts()
    if (dropIfRouteLeft() || !isCurrent(runEpoch, owner)) return
    const settled = await Promise.allSettled([
      getB4AvatarProfile(), listB4AvatarItems(), listB4Loadouts(), getB4AvatarResources(),
    ])
    if (dropIfRouteLeft() || !isCurrent(runEpoch, owner)) return
    const denied = settled.find((result): result is PromiseRejectedResult => result.status === 'rejected' && isAuthFailure(result.reason))
    if (denied) {
      permissionForbidden.value = (denied.reason as MobileApiError).status === 403
      pageState.value = 'permission'
      return
    }
    if (settled.every((result) => result.status === 'rejected')) { pageState.value = 'unavailable'; return }
    const [profileResult, itemsResult, loadoutsResult, resourcesResult] = settled
    if (profileResult.status === 'fulfilled') applyProfile(profileResult.value)
    if (itemsResult.status === 'fulfilled') applyItems(itemsResult.value)
    else itemsError.value = true
    if (loadoutsResult.status === 'fulfilled') applyLoadouts(loadoutsResult.value)
    else loadoutsError.value = true
    if (resourcesResult.status === 'fulfilled') applyResources(resourcesResult.value)
    if (isCurrent(runEpoch, owner)) pageState.value = 'ready'
  })()
  activeLoad = { epoch: runEpoch, promise }
  void promise.finally(() => { if (activeLoad?.promise === promise) activeLoad = null })
  return promise
}

onShow(async () => {
  visible = true
  resetSurface()
  const serial = ++showSerial
  showActive += 1
  let runEpoch = ++epoch
  let loadOwner: { subject: string; revision: number } | null = null
  const owns = () => !dropIfRouteLeft() && visible && serial === showSerial
  try {
    accessGranted.value = false
    pageState.value = 'loading'
    permissionForbidden.value = false
    clearFacts()
    try { await session.restore() } catch { if (owns() && epoch === runEpoch) pageState.value = 'permission'; return }
    if (!owns()) return
    runEpoch = epoch
    let owner = accountSnapshot()
    if (!owner) { pageState.value = 'permission'; return }
    const allowed = await ensureMobilePageAccess(PAGE_PATH)
    if (!owns()) return
    runEpoch = epoch
    owner = accountSnapshot()
    if (!owner) { pageState.value = 'permission'; return }
    if (!allowed) { pageState.value = 'permission'; return }
    if (session.status !== 'authenticated') { pageState.value = 'permission'; return }
    try { await session.refreshGateFromServer() } catch { if (owns() && epoch === runEpoch) pageState.value = 'permission'; return }
    if (!owns()) return
    runEpoch = epoch
    owner = accountSnapshot()
    if (!owner || session.status !== 'authenticated') { pageState.value = 'permission'; return }
    if (session.adultGate !== 'PASSED' || !session.isLearningReady) { pageState.value = 'permission'; return }
    if (!isCurrent(runEpoch, owner)) { pageState.value = 'permission'; return }
    accessGranted.value = true
    b4.restore()
    loadOwner = owner
  } finally { showActive -= 1 }
  if (loadOwner && owns() && epoch === runEpoch) await loadAvatarPage(runEpoch, loadOwner)
})
onHide(() => {
  visible = false
  epoch += 1
  request += 1
  activeLoad = null
  accessGranted.value = false
  pageState.value = 'loading'
  resetSurface()
  clearFacts()
})
watch(() => session.identityRevision, () => {
  epoch += 1
  request += 1
  activeLoad = null
  clearFacts()
  permissionForbidden.value = false
  accessGranted.value = false
  if (dropIfRouteLeft()) return
  if (!visible) return
  if (showActive > 0) { pageState.value = 'loading'; return }
  if (!session.isAuthenticated || !session.verifiedSubject) { pageState.value = 'permission'; return }
  const runEpoch = epoch
  const owner = accountSnapshot()
  if (!owner) { pageState.value = 'permission'; return }
  pageState.value = 'loading'
  void (async () => {
    try { await session.refreshGateFromServer() } catch { if (!dropIfRouteLeft() && pageEpochCurrent(runEpoch) && isCurrent(runEpoch, owner)) pageState.value = 'permission'; return }
    if (dropIfRouteLeft() || !isCurrent(runEpoch, owner)) return
    if (session.status !== 'authenticated' || session.adultGate !== 'PASSED' || !session.isLearningReady) { pageState.value = 'permission'; return }
    accessGranted.value = true
    await loadAvatarPage(runEpoch, owner)
  })()
}, { flush: 'sync' })

onMounted(() => {
  unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })
  if (typeof document !== 'undefined') {
    escapeListener = (event: KeyboardEvent) => { if (event.key === 'Escape' && previewLoadout.value) { event.preventDefault(); closePreview() } }
    document.addEventListener('keydown', escapeListener)
  }
})
onUnmounted(() => {
  visible = false
  epoch += 1
  request += 1
  activeLoad = null
  accessGranted.value = false
  resetSurface()
  clearFacts()
  unsubscribeTheme?.()
  unsubscribeTheme = undefined
  if (typeof document !== 'undefined' && escapeListener) document.removeEventListener('keydown', escapeListener)
  escapeListener = undefined
})
</script>

<template>
  <view class="yx-page b4-avatar v2-avatar-page" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="resolvedTheme" :data-avatar-state="pageState" :data-avatar-surface="surface" :data-current-known="currentName ? 'true' : 'false'" :data-manifest-ready="manifestReady ? 'true' : 'false'" :class="themeClass">
    <MobilePageHeader page="b4-avatar" compact :title="avatarT('navTitle')" back-icon-src="/static/figma-avatar-preview-169-8026/ee6ed16d-99b1-45e0-843e-92221e68344a.svg" :show-settings="false" :on-back="returnAvatarStep" />
    <view class="v2-avatar-glow-wrap" aria-hidden="true"><image class="v2-avatar-glow" :src="glowSrc" mode="scaleToFill" /></view>

    <view class="v2-avatar-body">

      <view v-if="pageState === 'permission' && !permissionForbidden" class="v2-avatar-loading" role="status" aria-busy="true">
        <text class="v2-avatar-muted">{{ avatarT('permissionChecking') }}</text>
        <view class="v2-avatar-skeleton v2-avatar-skeleton--stage"></view>
        <view class="v2-avatar-skeleton"></view>
        <text class="v2-avatar-state-title">{{ avatarT('permissionTitle') }}</text>
        <text class="v2-avatar-state-body">{{ avatarT('permissionBody') }}</text>
        <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="openLogin">{{ avatarT('permissionAction') }}</button>
      </view>

      <view v-else-if="pageState === 'permission'" class="v2-avatar-state v2-avatar-glass" role="alert">
        <view class="v2-avatar-state-icon"><image :src="UNAVAILABLE_ICON" mode="aspectFit" /></view>
        <text class="v2-avatar-state-title">{{ avatarT('forbidden') }}</text>
        <text class="v2-avatar-state-body">{{ avatarT('permissionBody') }}</text>
        <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="backToGrowth">{{ avatarT('backToGrowth') }}</button>
      </view>

      <view v-else-if="pageState === 'loading'" class="v2-avatar-loading" role="status" aria-busy="true">
        <text class="v2-avatar-muted">{{ avatarT('loading') }}</text>
        <view class="v2-avatar-skeleton v2-avatar-skeleton--stage"></view>
        <view class="v2-avatar-skeleton"></view>
        <view class="v2-avatar-skeleton"></view>
      </view>

      <view v-else-if="pageState === 'unavailable'" class="v2-avatar-failure">
        <view class="v2-avatar-hero">
          <text class="v2-avatar-title">{{ avatarT('pageTitle') }}</text>
          <text class="v2-avatar-subtitle">{{ avatarT('pageSubtitle') }}</text>
        </view>
        <view class="v2-avatar-spacer" aria-hidden="true"></view>
        <view class="v2-avatar-state v2-avatar-glass" role="alert">
          <view class="v2-avatar-state-icon"><image :src="UNAVAILABLE_ICON" mode="aspectFit" /></view>
          <text class="v2-avatar-state-title">{{ avatarT('unavailableTitle') }}</text>
          <text class="v2-avatar-state-body">{{ avatarT('unavailableBody') }}</text>
          <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button>
        </view>
      </view>

      <template v-else-if="surface === 'preview'">
        <view class="v2-avatar-hero">
          <text class="v2-avatar-title">{{ avatarT('pageTitle') }}</text>
          <text class="v2-avatar-subtitle">{{ avatarT('pageSubtitle') }}</text>
        </view>
        <view class="v2-avatar-stage v2-avatar-stage--preview" role="img" :aria-label="avatarT('render2D')">
          <image class="v2-avatar-mascot" :src="stageMascot" mode="aspectFit" />
        </view>
        <view class="v2-avatar-card v2-avatar-glass v2-avatar-quality-card">
          <view class="v2-avatar-card-head">
            <text class="v2-avatar-card-title">{{ avatarT('localQuality') }}</text>
            <picker :range="qualityLabels" :value="qualityIndex" @change="selectPerformance"><view class="v2-avatar-quality-chip">{{ qualityLabel(b4.performanceLevel as B4PerformanceLevel) }}</view></picker>
          </view>
          <text class="v2-avatar-hint v2-avatar-muted">{{ avatarT('qualityHint') }}</text>
        </view>
        <view class="v2-avatar-tip v2-avatar-glass">
          <view class="v2-avatar-tip-row">
            <image class="v2-avatar-dot" :src="PREVIEW_DOT" mode="aspectFit" />
            <text class="v2-avatar-tip-title">{{ avatarT('appearanceNoteTitle') }}</text>
          </view>
          <text class="v2-avatar-tip-body">{{ avatarT('appearanceNoteBody') }}</text>
        </view>
      </template>

      <template v-else>
        <view class="v2-avatar-stage v2-avatar-stage--wardrobe" role="img" :aria-label="avatarT('render2D')">
          <image class="v2-avatar-mascot" :src="stageMascot" mode="aspectFit" />
        </view>
        <view v-if="loadoutsError" class="v2-avatar-card v2-avatar-glass" role="alert">
          <text class="v2-avatar-card-title">{{ avatarT('wardrobeTitle') }}</text>
          <text class="v2-avatar-error-text">{{ avatarT('error') }}</text>
          <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button>
        </view>
        <template v-else-if="loadouts.length">
          <view class="v2-avatar-section-head">
            <text class="v2-avatar-section-title">{{ avatarT('wardrobeTitle') }}</text>
            <text class="v2-avatar-section-count">{{ avatarT('setsCount', { count: loadouts.length }) }}</text>
          </view>
          <view class="v2-avatar-card v2-avatar-glass v2-avatar-sets">
            <template v-for="(loadout, index) in loadouts" :key="loadout.loadoutId">
              <view v-if="index > 0" class="v2-avatar-divider"></view>
              <button tabindex="0" role="button" class="v2-avatar-set-row" type="button" :data-set-id="loadout.loadoutId" @click="openPreview(loadout)">
                <view class="v2-avatar-set-icon" :class="`v2-avatar-set-icon--${setTone(index)}`" aria-hidden="true"><image :src="setIcon(index)" mode="aspectFit" /></view>
                <view class="v2-avatar-set-copy"><text class="v2-avatar-set-name">{{ loadoutTitle(loadout, index) }}</text><text class="v2-avatar-set-meta">{{ avatarT('itemCount', { count: loadout.items.length }) }}</text></view>
                <text v-if="loadout.loadoutId === currentId" class="v2-avatar-badge">{{ avatarT('currentTag') }}</text>
                <image v-else class="v2-avatar-chevron" :src="SET_CHEVRON" mode="aspectFit" />
              </button>
            </template>
          </view>
          <text class="v2-avatar-ownership v2-avatar-muted">{{ avatarT('ownershipNote') }}</text>
          <view v-if="itemsError" class="v2-avatar-card v2-avatar-glass" role="alert">
            <text class="v2-avatar-error-text">{{ avatarT('error') }}</text>
            <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button>
          </view>
          <view v-else-if="items.length" class="v2-avatar-card v2-avatar-glass">
            <view class="v2-avatar-card-head"><text class="v2-avatar-card-title">{{ avatarT('itemsTitle') }}</text><text class="v2-avatar-section-count">{{ avatarT('itemsCount', { count: items.length }) }}</text></view>
            <view class="v2-avatar-item-grid">
              <view v-for="item in items" :key="item.itemCode" class="v2-avatar-item" :data-owned="item.owned === null ? 'unknown' : item.owned ? 'true' : 'false'">
                <text class="v2-avatar-item-quality">{{ itemQuality(item) }}</text>
                <text class="v2-avatar-item-slot">{{ itemTitle(item) }}</text>
                <text class="v2-avatar-badge" :class="item.owned === true ? 'v2-avatar-badge--owned' : item.owned === false ? 'v2-avatar-badge--muted' : 'v2-avatar-badge--warn'">{{ avatarT(ownedKey(item.owned)) }}</text>
              </view>
            </view>
          </view>
        </template>
        <template v-else>
          <view class="v2-avatar-card v2-avatar-glass v2-avatar-empty-card">
            <text class="v2-avatar-card-title">{{ avatarT('wardrobeTitle') }}</text>
            <text class="v2-avatar-empty-body">{{ avatarT('noSets') }}</text>
          </view>
          <view class="v2-avatar-tips">
            <view v-for="tip in EMPTY_TIPS" :key="tip.title" class="v2-avatar-tip v2-avatar-glass">
              <view class="v2-avatar-tip-row">
                <image class="v2-avatar-dot" :src="tip.dot" mode="aspectFit" />
                <text class="v2-avatar-tip-title">{{ avatarT(tip.title) }}</text>
              </view>
              <text class="v2-avatar-tip-body">{{ avatarT(tip.body) }}</text>
            </view>
          </view>
          <view v-if="itemsError" class="v2-avatar-card v2-avatar-glass" role="alert">
            <text class="v2-avatar-error-text">{{ avatarT('error') }}</text>
            <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button>
          </view>
          <view v-else-if="items.length" class="v2-avatar-card v2-avatar-glass">
            <view class="v2-avatar-card-head"><text class="v2-avatar-card-title">{{ avatarT('itemsTitle') }}</text><text class="v2-avatar-section-count">{{ avatarT('itemsCount', { count: items.length }) }}</text></view>
            <view class="v2-avatar-item-grid">
              <view v-for="item in items" :key="item.itemCode" class="v2-avatar-item" :data-owned="item.owned === null ? 'unknown' : item.owned ? 'true' : 'false'">
                <text class="v2-avatar-item-slot">{{ itemTitle(item) }}</text>
                <text class="v2-avatar-badge" :class="item.owned === true ? 'v2-avatar-badge--owned' : item.owned === false ? 'v2-avatar-badge--muted' : 'v2-avatar-badge--warn'">{{ avatarT(ownedKey(item.owned)) }}</text>
              </view>
            </view>
          </view>
        </template>
      </template>
    </view>

    <view v-if="pageState === 'ready' && surface === 'preview' && !previewLoadout" class="v2-avatar-fixed"><button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--primary" type="button" @click="goWardrobe">{{ avatarT('goWardrobe') }}</button></view>
    <view v-else-if="pageState === 'ready' && surface === 'wardrobe' && loadouts.length && !loadoutsError && !previewLoadout" class="v2-avatar-fixed">
      <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--closed" type="button" disabled aria-disabled="true">{{ avatarT('setCurrent') }}</button>
      <text class="v2-avatar-fixed-note">{{ avatarT('equipUnavailable') }}</text>
    </view>
    <view v-else-if="pageState === 'unavailable'" class="v2-avatar-fixed"><button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--primary" type="button" @click="backToGrowth">{{ avatarT('backToGrowth') }}</button></view>

    <view v-if="previewLoadout" class="v2-avatar-modal" role="dialog" aria-modal="true" @click="closePreview">
      <view ref="previewCard" class="v2-avatar-modal-card" tabindex="-1" @click.stop>
        <view class="v2-avatar-modal-head"><text class="v2-avatar-card-title">{{ avatarT('loadoutPreview') }}</text><button tabindex="0" role="button" class="v2-avatar-close" type="button" :aria-label="avatarT('close')" @click="closePreview">×</button></view>
        <text class="v2-avatar-muted">{{ loadoutTitle(previewLoadout, loadouts.indexOf(previewLoadout)) }} · {{ avatarT('itemCount', { count: previewLoadout.items.length }) }}</text>
        <view v-if="previewSlots.length" class="v2-avatar-preview-slots"><text v-for="(slot, index) in previewSlots" :key="`${slot.itemCode}-${index}`" class="v2-avatar-preview-slot">{{ avatarT(slotKey(slot.slot)) }}</text></view>
        <text v-else class="v2-avatar-muted">{{ avatarT('noSetItems') }}</text>
        <text class="v2-avatar-ownership">{{ avatarT('loadoutPreviewNote') }}</text>
        <view class="v2-avatar-modal-actions">
          <button tabindex="0" role="button" class="v2-avatar-btn" type="button" disabled aria-disabled="true">{{ avatarT('setCurrent') }}</button>
          <text class="v2-avatar-muted">{{ avatarT('equipUnavailable') }}</text>
          <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="closePreview">{{ avatarT('close') }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-avatar-page.v2-avatar-page{position:relative;box-sizing:border-box;max-width:720px;min-height:100vh;margin:0 auto;overflow-x:clip;padding:calc(8px + env(safe-area-inset-top)) 24px 24px;background-color:var(--yx-r4-page-color, var(--v2-bg));background-image:var(--yx-profile-page-image, none);color:var(--yx-r4-ink, var(--v2-ink));font-family:var(--v2-font)}
.v2-avatar-glow-wrap{position:absolute;top:-140px;left:150px;z-index:0;width:360px;height:300px;overflow:visible;pointer-events:none;opacity:.85}
.v2-avatar-glow{position:absolute;top:-90px;left:-90px;display:block;width:540px;height:480px;max-width:none}
.v2-avatar-page[data-resolved-theme="high-contrast"] .v2-avatar-glow-wrap,
.v2-avatar-page[data-motion="reduced"] .v2-avatar-glow-wrap,
.v2-avatar-page[data-motion="off"] .v2-avatar-glow-wrap{display:none}
.v2-avatar-page :deep(.mobile-page-header--nav-title .mobile-topbar){margin-bottom:8px}
.v2-avatar-body{position:relative;z-index:1;display:flex;flex-direction:column;gap:16px;box-sizing:border-box;width:100%;min-width:0;padding-top:8px;padding-bottom:calc(132px + env(safe-area-inset-bottom))}
.v2-avatar-hero{display:flex;flex-direction:column;gap:4px;padding-top:8px}
.v2-avatar-title{display:block;color:var(--yx-r4-ink, var(--v2-ink));font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-avatar-subtitle{display:block;color:var(--yx-r4-muted, var(--v2-mut));font-size:14px;line-height:22px;overflow-wrap:anywhere}
.v2-avatar-muted{display:block;color:var(--yx-text-tertiary, var(--v2-mut));font-size:12px;line-height:18px;overflow-wrap:anywhere}
.v2-avatar-glass{position:relative;border:1px solid var(--yx-profile-glass-border, var(--v2-line));background:var(--yx-profile-glass, var(--v2-card));box-shadow:var(--yx-profile-card-shadow, var(--v2-shadow));backdrop-filter:blur(var(--yx-profile-blur, 10px));-webkit-backdrop-filter:blur(var(--yx-profile-blur, 10px))}
.v2-avatar-page[data-resolved-theme="light"] .v2-avatar-glass{box-shadow:var(--yx-profile-card-shadow), var(--yx-settings-card-inset, none)}
.v2-avatar-card{display:flex;flex-direction:column;gap:6px;box-sizing:border-box;width:100%;min-width:0;padding:18px 20px;border-radius:24px}
.v2-avatar-sets{gap:0;padding:6px 20px}
.v2-avatar-empty-card{gap:8px}
.v2-avatar-stage{display:flex;align-items:center;justify-content:center;width:100%;overflow:hidden;border-radius:28px;background-color:var(--yx-r4-mascot-color, var(--v2-soft));background-image:var(--yx-r4-mascot-image, none)}
.v2-avatar-stage--preview{height:220px}
.v2-avatar-stage--wardrobe{height:160px}
.v2-avatar-stage--preview .v2-avatar-mascot{width:132px;height:132px}
.v2-avatar-stage--wardrobe .v2-avatar-mascot{width:96px;height:96px}
.v2-avatar-mascot{display:block;flex:none}
.v2-avatar-card-head,.v2-avatar-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
.v2-avatar-section-head{padding-top:4px}
.v2-avatar-card-title{display:block;min-width:0;color:var(--yx-r4-ink, var(--v2-ink));font-size:18px;font-weight:700;line-height:26px;overflow-wrap:anywhere}
.v2-avatar-section-title{display:block;min-width:0;color:var(--yx-r4-ink, var(--v2-ink));font-size:20px;font-weight:700;line-height:28px;overflow-wrap:anywhere}
.v2-avatar-section-count,.v2-avatar-hint,.v2-avatar-set-meta{color:var(--yx-text-tertiary, var(--v2-mut));font-size:12px;font-weight:500;line-height:18px}
.v2-avatar-section-count{flex:none;font-size:13px;line-height:20px}
.v2-avatar-quality-chip{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;min-width:44px;min-height:44px;padding:0 4px;border:0;background:transparent;color:var(--yx-text-tertiary, var(--v2-mut));font-size:13px;font-weight:500;line-height:20px;white-space:nowrap}
.v2-avatar-page :deep(uni-picker){min-height:44px}
.v2-avatar-divider{height:1px;background:var(--yx-border, var(--v2-line))}
.v2-avatar-page .v2-avatar-set-row{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:56px;margin:0;padding:10px 0;border:0;border-radius:18px;background:transparent;background-image:none;box-shadow:none;color:var(--yx-r4-ink, var(--v2-ink));font:inherit;font-weight:400;line-height:22px;text-align:left}
.v2-avatar-set-icon{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:var(--v2-soft)}
.v2-avatar-set-icon--brand{background:var(--v2-soft, var(--yx-brand-soft))}
.v2-avatar-set-icon--warn{background:var(--yx-warning-soft, var(--v2-soft))}
.v2-avatar-set-icon--neutral{background:var(--yx-profile-tile-neutral, var(--v2-surface))}
.v2-avatar-set-icon image{display:block;width:22px;height:22px}
.v2-avatar-set-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.v2-avatar-set-name{display:block;color:var(--yx-r4-ink, var(--v2-ink));font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-avatar-set-meta{display:block;font-weight:400}
.v2-avatar-chevron{display:block;flex:none;width:20px;height:20px}
.v2-avatar-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;max-width:46%;padding:3px 10px;border-radius:999px;background:var(--v2-soft);color:var(--yx-r4-brand, var(--v2-brand));font-size:12px;font-weight:700;line-height:18px;text-align:center;overflow-wrap:anywhere}
.v2-avatar-badge--owned{color:var(--v2-ok)}
.v2-avatar-badge--muted{color:var(--yx-text-tertiary, var(--v2-mut))}
.v2-avatar-badge--warn{color:var(--v2-warn)}
.v2-avatar-tip{display:flex;flex-direction:column;gap:6px;box-sizing:border-box;width:100%;min-width:0;padding:14px 16px;border-radius:18px}
.v2-avatar-tips{display:flex;flex-direction:column;gap:12px;width:100%}
.v2-avatar-tip-row{display:flex;align-items:center;gap:10px;min-width:0}
.v2-avatar-dot{display:block;flex:none;width:8px;height:8px}
.v2-avatar-tip-title{display:block;min-width:0;flex:1 1 auto;color:var(--yx-r4-ink, var(--v2-ink));font-size:14px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-avatar-tip-body,.v2-avatar-empty-body{display:block;color:var(--yx-r4-muted, var(--v2-mut));font-size:13px;line-height:22px;overflow-wrap:anywhere}
.v2-avatar-empty-body{font-size:15px}
.v2-avatar-spacer{width:100%;height:92px}
.v2-avatar-item-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.v2-avatar-item{display:flex;flex-direction:column;gap:4px;min-width:0;padding:14px;border:1px solid var(--v2-line);border-radius:16px;background:var(--v2-card)}
.v2-avatar-item-quality{color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em}
.v2-avatar-item-slot{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-avatar-ownership{display:block;color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-avatar-empty,.v2-avatar-error{display:grid;gap:8px;padding:14px;border:1px dashed var(--v2-line);border-radius:14px}
.v2-avatar-error-text{color:var(--v2-bad);font-size:15px;line-height:24px}
.v2-avatar-page .v2-avatar-btn{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:14px 20px;border:1px solid transparent;border-radius:14px;background:var(--yx-surface-card, var(--v2-card));color:var(--yx-r4-ink, var(--v2-ink));font:inherit;font-size:16px;font-weight:700;line-height:22px;white-space:normal;text-align:center}
.v2-avatar-page .v2-avatar-btn--primary{border-color:transparent;background-color:var(--yx-r4-cta-color, var(--v2-brand));background-image:var(--yx-r4-cta-image, none);color:var(--yx-r4-on-cta, var(--v2-side-ink));box-shadow:var(--yx-profile-cta-shadow, none)}
.v2-avatar-page[data-resolved-theme="light"] .v2-avatar-btn--primary{box-shadow:var(--closed-cta-shadow, var(--yx-profile-cta-shadow, none))}
.v2-avatar-page .v2-avatar-btn--soft{border-color:transparent;background:var(--v2-soft);background-image:none;color:var(--yx-r4-brand, var(--v2-brand));box-shadow:none}
.v2-avatar-page .v2-avatar-btn--closed,.v2-avatar-page .v2-avatar-btn[disabled]{background:var(--yx-surface-page, var(--v2-surface));background-image:none;color:var(--yx-text-tertiary, var(--v2-mut));border:1px dashed var(--yx-border, var(--v2-line));box-shadow:none;opacity:1}
.v2-avatar-btn:focus-visible,.v2-avatar-close:focus-visible,.v2-avatar-set-row:focus-visible,.v2-avatar-quality-chip:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-avatar-page .v2-avatar-btn:active:not([disabled]){transform:scale(.99)}
.v2-avatar-state{display:grid;justify-items:center;gap:12px;padding:24px 18px;border-radius:18px;text-align:center}
.v2-avatar-state-icon{display:flex;align-items:center;justify-content:center;width:96px;height:96px;border-radius:48px;background:var(--yx-profile-tile-neutral, var(--v2-surface))}
.v2-avatar-state-icon image{display:block;width:44px;height:44px}
.v2-avatar-state-title{color:var(--yx-r4-ink, var(--v2-ink));font-size:22px;font-weight:700;line-height:32px;overflow-wrap:anywhere}
.v2-avatar-state-body{color:var(--yx-r4-muted, var(--v2-mut));font-size:15px;line-height:24px;overflow-wrap:anywhere}
.v2-avatar-loading{display:grid;gap:10px;padding:14px 0}
.v2-avatar-skeleton{height:56px;border-radius:14px;background:var(--v2-surface)}
.v2-avatar-skeleton--stage{height:220px;border-radius:24px}
.v2-avatar-fixed{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);display:flex;flex-direction:column;gap:8px;box-sizing:border-box;width:min(100%,720px);padding:12px 24px calc(30px + env(safe-area-inset-bottom));background:var(--yx-surface-card, var(--v2-card));box-shadow:var(--yx-settings-bottom-bar-shadow, none)}
.v2-avatar-page[data-resolved-theme="high-contrast"] .v2-avatar-fixed{box-shadow:none;border-top:1px solid var(--yx-border)}
.v2-avatar-fixed .v2-avatar-btn{width:100%}
.v2-avatar-fixed-note{display:block;color:var(--yx-text-tertiary, var(--v2-mut));font-size:12px;line-height:18px;text-align:center}
.v2-avatar-modal{position:fixed;z-index:50;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.36)}
.v2-avatar-modal-card{display:flex;flex-direction:column;gap:10px;box-sizing:border-box;width:min(100%,720px);max-height:86vh;overflow:auto;padding:20px 20px calc(22px + env(safe-area-inset-bottom));border-radius:24px 24px 0 0;background:var(--v2-card);box-shadow:var(--v2-shadow);outline:none}
.v2-avatar-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.v2-avatar-page .v2-avatar-close{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;min-width:44px;min-height:44px;margin:0;padding:0;border:0;border-radius:50%;background:var(--v2-surface);background-image:none;box-shadow:none;color:var(--yx-r4-ink, var(--v2-ink));font-size:24px;line-height:1}
.v2-avatar-preview-slots{display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--v2-line);border-bottom:1px solid var(--v2-line)}
.v2-avatar-preview-slot{display:block;color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:600;line-height:1.6}
.v2-avatar-modal-actions{display:grid;gap:8px;margin-top:4px}
@media(max-width:360px){.v2-avatar-page.v2-avatar-page{padding-inline:16px}.v2-avatar-title{font-size:24px;line-height:32px}.v2-avatar-card,.v2-avatar-tip{padding-inline:16px}.v2-avatar-item-grid{grid-template-columns:1fr}.v2-avatar-fixed{padding-inline:16px}.v2-avatar-badge{max-width:50%}}
@media(prefers-reduced-motion:reduce){.v2-avatar-btn:active{transform:none}}
</style>
