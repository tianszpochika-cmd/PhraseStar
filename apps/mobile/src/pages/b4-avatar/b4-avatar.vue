<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
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
const accessGranted = ref(false)
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

function accountSnapshot(): { subject: string; revision: number } | null {
  return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision } : null
}
function isCurrent(runEpoch: number, owner: { subject: string; revision: number }): boolean {
  return pageEpochCurrent(runEpoch) && Boolean(session.isAuthenticated && session.verifiedSubject === owner.subject && session.identityRevision === owner.revision)
}
function pageEpochCurrent(runEpoch: number): boolean { return epoch === runEpoch }
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
function goWardrobe(): void {
  if (typeof document !== 'undefined') document.getElementById('avatar-wardrobe')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
function backToGrowth(): void { void Promise.resolve(openUniPage('/pages/world/world')) }
function openLogin(): void { void Promise.resolve(openUniPage('/pages/login/login')) }
function retry(): void {
  if (!accessGranted.value) { openLogin(); return }
  void loadAvatarPage()
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

async function loadAvatarPage(): Promise<void> {
  const owner = accountSnapshot()
  const runEpoch = ++epoch
  const runRequest = ++request
  pageState.value = 'loading'
  permissionForbidden.value = false
  clearFacts()
  if (!owner) { pageState.value = 'permission'; return }
  const settled = await Promise.allSettled([
    getB4AvatarProfile(), listB4AvatarItems(), listB4Loadouts(), getB4AvatarResources(),
  ])
  if (!isCurrent(runEpoch, owner) || runRequest !== request) return
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
  pageState.value = 'ready'
}

onShow(async () => {
  accessGranted.value = false
  pageState.value = 'loading'
  permissionForbidden.value = false
  clearFacts()
  try { await session.restore() } catch { pageState.value = 'permission'; return }
  if (!await ensureMobilePageAccess(PAGE_PATH)) { pageState.value = 'permission'; return }
  if (session.status !== 'authenticated') { pageState.value = 'permission'; return }
  try { await session.refreshGateFromServer() } catch { pageState.value = 'permission'; return }
  if (session.adultGate !== 'PASSED' || !session.isLearningReady) { pageState.value = 'permission'; return }
  accessGranted.value = true
  b4.restore()
  await loadAvatarPage()
})
onHide(() => {
  epoch += 1
  request += 1
  accessGranted.value = false
  pageState.value = 'loading'
  clearFacts()
})
watch(() => session.identityRevision, () => {
  epoch += 1
  request += 1
  clearFacts()
  permissionForbidden.value = false
  accessGranted.value = false
  if (!session.isAuthenticated || !session.verifiedSubject) { pageState.value = 'permission'; return }
  void (async () => {
    try { await session.refreshGateFromServer() } catch { pageState.value = 'permission'; return }
    if (session.status !== 'authenticated' || session.adultGate !== 'PASSED' || !session.isLearningReady) { pageState.value = 'permission'; return }
    accessGranted.value = true
    await loadAvatarPage()
  })()
})
onMounted(() => {
  unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })
  if (typeof document !== 'undefined') {
    escapeListener = (event: KeyboardEvent) => { if (event.key === 'Escape' && previewLoadout.value) { event.preventDefault(); closePreview() } }
    document.addEventListener('keydown', escapeListener)
  }
})
onUnmounted(() => {
  unsubscribeTheme?.()
  unsubscribeTheme = undefined
  if (typeof document !== 'undefined' && escapeListener) document.removeEventListener('keydown', escapeListener)
  escapeListener = undefined
})
</script>

<template>
  <view class="yx-page b4-avatar v2-avatar-page" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="resolvedTheme" :data-avatar-state="pageState" :data-manifest-ready="manifestReady ? 'true' : 'false'" :class="themeClass">
    <MobilePageHeader page="b4-avatar" compact :title="avatarT('navTitle')" back-icon-src="/static/figma-avatar-preview-169-8026/ee6ed16d-99b1-45e0-843e-92221e68344a.svg" :show-settings="false" />
    <view class="v2-avatar-glow-wrap" aria-hidden="true"><image class="v2-avatar-glow" src="/static/figma-avatar-preview-169-8026/93ad538f-c264-4361-9fd2-f7bf070790df.svg" mode="scaleToFill" /></view>

    <view class="v2-avatar-body">
      <view class="v2-avatar-hero">
        <text class="v2-avatar-title">{{ avatarT('pageTitle') }}</text>
        <text class="v2-avatar-subtitle">{{ avatarT('pageSubtitle') }}</text>
      </view>

      <view v-if="pageState === 'permission' && !permissionForbidden" class="v2-avatar-loading" role="status" aria-busy="true">
        <text class="v2-avatar-muted">{{ avatarT('permissionChecking') }}</text>
        <view class="v2-avatar-skeleton v2-avatar-skeleton--stage"></view>
        <view class="v2-avatar-skeleton"></view>
        <text class="v2-avatar-state-title">{{ avatarT('permissionTitle') }}</text>
        <text class="v2-avatar-state-body">{{ avatarT('permissionBody') }}</text>
        <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="openLogin">{{ avatarT('permissionAction') }}</button>
      </view>

      <view v-else-if="pageState === 'permission'" class="v2-avatar-state" role="alert">
        <view class="v2-avatar-state-icon"><image src="/static/figma-avatar-unavailable-169-7955/70395da5-c6e3-44d1-8d19-344481ab25e3.svg" mode="aspectFit" /></view>
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

      <view v-else-if="pageState === 'unavailable'" class="v2-avatar-state" role="alert">
        <view class="v2-avatar-state-icon"><image src="/static/figma-avatar-unavailable-169-7955/70395da5-c6e3-44d1-8d19-344481ab25e3.svg" mode="aspectFit" /></view>
        <text class="v2-avatar-state-title">{{ avatarT('unavailableTitle') }}</text>
        <text class="v2-avatar-state-body">{{ avatarT('unavailableBody') }}</text>
        <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button>
      </view>

      <template v-else>
        <view class="v2-avatar-stage-card">
          <view class="v2-avatar-stage"><image class="v2-avatar-mascot" src="/static/figma-avatar-preview-169-8026/f4b60518-3a5d-4a34-bafd-25771c0b91f6.svg" mode="aspectFit" /><text class="v2-avatar-stage-label">{{ avatarT('render2D') }}</text></view>
          <view v-if="currentName" class="v2-avatar-current"><text class="v2-avatar-current-label">{{ avatarT('currentLoadout') }}</text><text class="v2-avatar-current-name">{{ currentName }}</text></view>
        </view>

        <view class="v2-avatar-card v2-avatar-quality-card">
          <view class="v2-avatar-card-head"><text class="v2-avatar-card-title">{{ avatarT('localQuality') }}</text><picker :range="qualityLabels" :value="qualityIndex" @change="selectPerformance"><view class="v2-avatar-quality-chip">{{ qualityLabel(b4.performanceLevel as B4PerformanceLevel) }}</view></picker></view>
          <text class="v2-avatar-muted">{{ avatarT('qualityHint') }}</text>
        </view>

        <view id="avatar-wardrobe" class="v2-avatar-card">
          <view class="v2-avatar-card-head"><view class="v2-avatar-heading"><text class="v2-avatar-eyebrow">{{ avatarT('wardrobeEyebrow') }}</text><text class="v2-avatar-card-title">{{ avatarT('wardrobeTitle') }}</text></view><text class="v2-avatar-muted">{{ avatarT('setsCount', { count: loadouts.length }) }}</text></view>
          <view v-if="loadoutsError" class="v2-avatar-error" role="alert"><text>{{ avatarT('error') }}</text><button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button></view>
          <view v-else-if="loadouts.length" class="v2-avatar-set-list">
            <button v-for="(loadout, index) in loadouts" :key="loadout.loadoutId" tabindex="0" role="button" class="v2-avatar-set-row" type="button" :data-set-id="loadout.loadoutId" @click="openPreview(loadout)">
              <view class="v2-avatar-set-icon" aria-hidden="true"><image :src="setIcon(index)" mode="aspectFit" /></view>
              <view class="v2-avatar-set-copy"><text class="v2-avatar-set-name">{{ loadoutTitle(loadout, index) }}</text><text class="v2-avatar-muted">{{ avatarT('itemCount', { count: loadout.items.length }) }}</text></view>
              <text v-if="loadout.loadoutId === currentId" class="v2-avatar-badge v2-avatar-badge--ok">{{ avatarT('currentTag') }}</text>
              <text v-else class="v2-avatar-preview-label">{{ avatarT('previewAction') }} ›</text>
            </button>
          </view>
          <view v-else class="v2-avatar-empty"><text class="v2-avatar-muted">{{ avatarT('noSets') }}</text><text class="v2-avatar-muted">{{ avatarT('noSetsHint') }}</text></view>
        </view>

        <view class="v2-avatar-card">
          <view class="v2-avatar-card-head"><view class="v2-avatar-heading"><text class="v2-avatar-eyebrow">{{ avatarT('itemsEyebrow') }}</text><text class="v2-avatar-card-title">{{ avatarT('itemsTitle') }}</text></view><text class="v2-avatar-muted">{{ avatarT('itemsCount', { count: items.length }) }}</text></view>
          <view v-if="itemsError" class="v2-avatar-error" role="alert"><text>{{ avatarT('error') }}</text><button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="retry">{{ avatarT('retry') }}</button></view>
          <template v-else-if="items.length">
            <view class="v2-avatar-item-grid">
              <view v-for="item in items" :key="item.itemCode" class="v2-avatar-item" :data-owned="item.owned === null ? 'unknown' : item.owned ? 'true' : 'false'">
                <text class="v2-avatar-item-quality">{{ itemQuality(item) }}</text>
                <text class="v2-avatar-item-slot">{{ itemTitle(item) }}</text>
                <text class="v2-avatar-badge" :class="item.owned === true ? 'v2-avatar-badge--ok' : item.owned === false ? 'v2-avatar-badge--muted' : 'v2-avatar-badge--warn'">{{ avatarT(ownedKey(item.owned)) }}</text>
              </view>
            </view>
            <text class="v2-avatar-ownership">{{ avatarT('ownershipNote') }}</text>
          </template>
          <view v-else class="v2-avatar-empty"><text class="v2-avatar-muted">{{ avatarT('noItems') }}</text></view>
          <button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--soft" type="button" @click="backToGrowth">{{ avatarT('viewRewards') }}</button>
        </view>
      </template>
    </view>

    <view v-if="pageState === 'ready' && loadouts.length && !previewLoadout" class="v2-avatar-fixed"><button tabindex="0" role="button" class="v2-avatar-btn v2-avatar-btn--primary" type="button" @click="goWardrobe">{{ avatarT('goWardrobe') }}</button></view>
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
.v2-avatar-page.v2-avatar-page{position:relative;box-sizing:border-box;max-width:720px;min-height:100vh;margin:0 auto;overflow-x:clip;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 45%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-avatar-glow-wrap{position:absolute;top:-140px;left:150px;z-index:0;width:360px;height:300px;overflow:visible;pointer-events:none;opacity:.85}
.v2-avatar-glow{position:absolute;top:-90px;left:-90px;display:block;width:540px;height:480px;max-width:none}
.v2-avatar-page[data-resolved-theme="high-contrast"] .v2-avatar-glow-wrap{display:none}
.v2-avatar-body{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;width:100%;min-width:0;padding-bottom:calc(120px + env(safe-area-inset-bottom))}
.v2-avatar-hero{display:flex;flex-direction:column;gap:var(--v2-space-1);padding-top:var(--v2-space-2)}
.v2-avatar-title{display:block;color:var(--v2-ink);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-avatar-subtitle{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:22px;overflow-wrap:anywhere}
.v2-avatar-muted{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6;overflow-wrap:anywhere}
.v2-avatar-card,.v2-avatar-stage-card{display:flex;flex-direction:column;gap:var(--v2-space-2);box-sizing:border-box;width:100%;min-width:0;padding:18px 20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-avatar-stage-card{padding:12px 20px 18px}
.v2-avatar-stage{display:grid;place-items:center;align-content:center;gap:6px;width:100%;min-height:220px;border-radius:24px;background:var(--v2-soft);overflow:hidden}
.v2-avatar-mascot{display:block;width:132px;height:132px}
.v2-avatar-stage-label{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-avatar-current{display:flex;align-items:center;gap:var(--v2-space-2);flex-wrap:wrap;padding-top:2px}
.v2-avatar-current-label{color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-avatar-current-name{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:700}
.v2-avatar-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-2);flex-wrap:wrap;min-width:0}
.v2-avatar-heading{display:grid;gap:2px;min-width:0}
.v2-avatar-eyebrow{display:block;color:var(--v2-mut);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em;text-transform:uppercase}
.v2-avatar-card-title{display:block;color:var(--v2-ink);font-size:18px;font-weight:700;line-height:1.4;overflow-wrap:anywhere}
.v2-avatar-quality-chip{display:inline-flex;align-items:center;min-height:44px;padding:0 12px;border:1px solid var(--v2-line);border-radius:999px;background:var(--v2-card);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;white-space:nowrap}
.v2-avatar-set-list{display:grid;gap:0}
.v2-avatar-set-row{display:flex;align-items:center;gap:12px;box-sizing:border-box;width:100%;min-height:64px;margin:0;padding:10px 0;border:0;border-top:1px solid var(--v2-line);background:transparent;color:var(--v2-ink);font:inherit;text-align:left}
.v2-avatar-set-row:first-child{border-top:0}
.v2-avatar-set-icon{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:var(--v2-soft)}
.v2-avatar-set-icon image{display:block;width:22px;height:22px}
.v2-avatar-set-copy{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 auto}
.v2-avatar-set-name{display:block;color:var(--v2-ink);font-size:15px;font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-avatar-preview-label{color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;white-space:nowrap}
.v2-avatar-badge{display:inline-flex;align-items:center;justify-content:center;flex:none;max-width:46%;padding:3px 10px;border-radius:999px;background:var(--v2-soft);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:18px;text-align:center;overflow-wrap:anywhere}
.v2-avatar-badge--ok{color:var(--v2-ok)}
.v2-avatar-badge--muted{color:var(--v2-mut)}
.v2-avatar-badge--warn{color:var(--v2-warn)}
.v2-avatar-item-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
.v2-avatar-item{display:flex;flex-direction:column;gap:4px;min-width:0;padding:14px;border:1px solid var(--v2-line);border-radius:16px;background:var(--v2-card)}
.v2-avatar-item-quality{color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;letter-spacing:.06em}
.v2-avatar-item-slot{color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:700;line-height:1.45;overflow-wrap:anywhere}
.v2-avatar-ownership{display:block;color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-avatar-empty,.v2-avatar-error{display:grid;gap:8px;padding:14px;border:1px dashed var(--v2-line);border-radius:14px}
.v2-avatar-error{color:var(--v2-bad)}
.v2-avatar-error text{color:var(--v2-bad);font-size:var(--v2-text-sm);line-height:1.6}
.v2-avatar-btn{display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 16px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-card);color:var(--v2-ink);font:inherit;font-size:var(--v2-text-sm);font-weight:600;line-height:1.5;white-space:normal;text-align:center}
.v2-avatar-btn--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-avatar-btn--soft{border-color:transparent;background:var(--v2-soft);color:var(--v2-brand)}
.v2-avatar-btn:focus-visible,.v2-avatar-close:focus-visible,.v2-avatar-set-row:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-avatar-btn:active{transform:scale(.99)}
.v2-avatar-btn[disabled]{background:var(--v2-surface);color:var(--v2-mut);border:1px dashed var(--v2-line);box-shadow:none}
.v2-avatar-state{display:grid;justify-items:center;gap:10px;padding:34px 18px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow);text-align:center}
.v2-avatar-state-icon{display:flex;align-items:center;justify-content:center;width:96px;height:96px;border-radius:48px;background:var(--v2-surface)}
.v2-avatar-state-icon image{display:block;width:44px;height:44px}
.v2-avatar-state-title{color:var(--v2-ink);font-size:22px;font-weight:700;line-height:32px;overflow-wrap:anywhere}
.v2-avatar-state-body{color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:24px;overflow-wrap:anywhere}
.v2-avatar-loading{display:grid;gap:10px;padding:14px 0}
.v2-avatar-skeleton{height:56px;border-radius:14px;background:var(--v2-surface)}
.v2-avatar-skeleton--stage{height:220px;border-radius:24px}
.v2-avatar-fixed{position:fixed;z-index:30;left:50%;bottom:0;transform:translateX(-50%);display:flex;box-sizing:border-box;width:min(100%,720px);padding:12px 20px calc(30px + env(safe-area-inset-bottom));background:var(--v2-card);border-top:1px solid var(--v2-line);box-shadow:0 -4px 16px var(--v2-line)}
.v2-avatar-fixed .v2-avatar-btn{width:100%}
.v2-avatar-modal{position:fixed;z-index:50;inset:0;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.36)}
.v2-avatar-modal-card{display:flex;flex-direction:column;gap:10px;box-sizing:border-box;width:min(100%,720px);max-height:86vh;overflow:auto;padding:20px 20px calc(22px + env(safe-area-inset-bottom));border-radius:24px 24px 0 0;background:var(--v2-card);box-shadow:var(--v2-shadow);outline:none}
.v2-avatar-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.v2-avatar-close{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;margin:0;padding:0;border:0;border-radius:50%;background:var(--v2-surface);color:var(--v2-ink);font-size:24px;line-height:1}
.v2-avatar-preview-slots{display:grid;gap:8px;padding:10px 0;border-top:1px solid var(--v2-line);border-bottom:1px solid var(--v2-line)}
.v2-avatar-preview-slot{display:block;color:var(--v2-ink);font-size:var(--v2-text-sm);font-weight:600;line-height:1.6}
.v2-avatar-modal-actions{display:grid;gap:8px;margin-top:4px}
@media(max-width:360px){.v2-avatar-page.v2-avatar-page{padding-inline:16px}.v2-avatar-title{font-size:24px;line-height:32px}.v2-avatar-card,.v2-avatar-stage-card{padding:16px}.v2-avatar-item-grid{grid-template-columns:1fr}.v2-avatar-fixed{padding-inline:16px}.v2-avatar-badge{max-width:50%}}
@media(prefers-reduced-motion:reduce){.v2-avatar-btn:active{transform:none}}
</style>
