<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { onHide, onShow, onUnload } from '@dcloudio/uni-app'
import type { PerformanceLevel } from '@englishflow/performance'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getMobileB6AccessibilityChecklist, getMobileB6ReleaseMatrix } from '../../api/b6'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { mobileExperienceEngine, mobileT, setMobileQuality, useMobileExperience } from '../../platform/experience'
import {
  mapAccessibility,
  mapDeviceSupport,
  type PlatformAccessibility,
  type PlatformDeviceCode,
  type PlatformDeviceRow,
  type PlatformDeviceSupport,
  type PlatformRowStatus,
} from './platform-page'

const { experienceStyle, experienceMotion } = useMobileExperience()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)

const A = {
  chevL: '/static/figma-platform-169-11915/cbfee287-d3de-460b-ba26-7c5283027089.svg',
  refresh: '/static/figma-platform-169-11915/217bc5b6-dbf9-4818-a096-08437599a4ba.svg',
  phone: '/static/figma-platform-169-11915/ed65bf0a-535a-4862-9c5f-39238762ac13.svg',
  monitor: '/static/figma-platform-169-11915/1284c006-b245-425b-946c-213d01904fae.svg',
  eye: '/static/figma-platform-169-11915/a47ee5e6-e735-4070-a6f4-78692db5c6ca.svg',
  chevR: '/static/figma-platform-169-11915/740be94e-dc88-4954-8d44-340fff1bd592.svg',
  glow: '/static/figma-platform-169-11915/4d001dc4-0a0c-47cb-bcb9-341762f1234c.svg',
} as const

const QUALITY_LEVELS: readonly PerformanceLevel[] = ['Ultra', 'High', 'Medium', 'Performance']
const qualityLevel = ref<PerformanceLevel>(mobileExperienceEngine.level)
const unsubscribeQuality = mobileExperienceEngine.subscribe((state) => { qualityLevel.value = state.level })

const device = ref<PlatformDeviceSupport>({ kind: 'unknown', rows: [] })
const accessibility = ref<PlatformAccessibility>({ kind: 'unknown', count: 0 })
const loading = ref(true)
const loadError = ref('')
const partial = ref(false)
const helpOpen = ref(false)
const qualityError = ref('')

let loadEpoch = 0
let pageVisible = false
let released = false

function t(key: string): string { return mobileT(`platformPage.${key}`) }

const QUALITY_KEYS: Record<PerformanceLevel, string> = {
  Ultra: 'qualityUltra',
  High: 'qualityHigh',
  Medium: 'qualityMedium',
  Performance: 'qualityPerformance',
}

const DEVICE_KEYS: Record<PlatformDeviceCode, string> = {
  IOS_ANDROID: 'deviceIosAndroid',
  TABLET_MINI: 'deviceTabletMini',
  IOS: 'deviceIos',
  ANDROID: 'deviceAndroid',
  IPAD: 'deviceIpad',
  H5: 'deviceH5',
  WEB: 'deviceWeb',
  WECHAT_MINI_PROGRAM: 'deviceMini',
  WINDOWS_PWA: 'deviceWindows',
  UNKNOWN: 'deviceOther',
}

function qualityLabel(level: PerformanceLevel): string { return t(QUALITY_KEYS[level]) }
function deviceLabel(code: PlatformDeviceCode): string { return t(DEVICE_KEYS[code] ?? 'deviceOther') }
function statusLabel(status: PlatformRowStatus): string {
  if (status === 'verified') return t('statusVerified')
  if (status === 'unavailable') return t('statusUnavailable')
  if (status === 'unknown') return t('statusUnknown')
  return t('statusUnverified')
}
function deviceDetail(row: PlatformDeviceRow): string {
  if (row.detail === 'evidence') return t('deviceEvidence')
  if (row.detail === 'target') return t('deviceTarget')
  return t('deviceUnavailable')
}
function deviceIcon(code: PlatformDeviceCode): string {
  if (code === 'IOS' || code === 'ANDROID' || code === 'IOS_ANDROID' || code === 'H5') return A.phone
  return A.monitor
}
function deviceStatusClass(status: PlatformRowStatus): string { return `platform-tag--${status}` }

function chooseQuality(level: PerformanceLevel): void {
  qualityError.value = ''
  try {
    setMobileQuality(level)
  } catch {
    qualityError.value = t('qualityError')
  }
}

function toggleHelp(): void { helpOpen.value = !helpOpen.value }
function releaseSubscription(): void {
  if (released) return
  released = true
  unsubscribeQuality()
}

async function load(): Promise<void> {
  const epoch = ++loadEpoch
  loading.value = true
  loadError.value = ''
  try {
    const [deviceResult, accessibilityResult] = await Promise.allSettled([
      getMobileB6ReleaseMatrix(),
      getMobileB6AccessibilityChecklist(),
    ])
    if (epoch !== loadEpoch || !pageVisible) return
    device.value = mapDeviceSupport(deviceResult.status === 'fulfilled' ? deviceResult.value : null)
    accessibility.value = mapAccessibility(accessibilityResult.status === 'fulfilled' ? accessibilityResult.value : null)
    partial.value = device.value.kind !== 'matrix' || accessibility.value.kind !== 'checks'
    if (deviceResult.status === 'rejected' && accessibilityResult.status === 'rejected') loadError.value = t('loadError')
  } catch {
    if (epoch === loadEpoch) {
      device.value = { kind: 'unknown', rows: [] }
      accessibility.value = { kind: 'unknown', count: 0 }
      loadError.value = t('loadError')
    }
  } finally {
    if (epoch === loadEpoch) loading.value = false
  }
}

const accessibilityDetail = computed(() => {
  if (accessibility.value.kind === 'checks' && accessibility.value.count > 0) return `${accessibility.value.count} ${t('a11yChecksUnit')}`
  if (accessibility.value.kind === 'evidence') return t('a11yEvidence')
  return t('a11yNone')
})

onShow(async () => {
  const epoch = ++loadEpoch
  if (!(await ensureMobilePageAccess('/pages/b6-platform/b6-platform'))) return
  if (epoch !== loadEpoch) return
  pageVisible = true
  await load()
})

onHide(() => {
  pageVisible = false
  loadEpoch += 1
  loading.value = false
})

onUnload(() => {
  pageVisible = false
  loadEpoch += 1
  releaseSubscription()
})

onBeforeUnmount(() => { releaseSubscription() })
</script>

<template>
  <view
    class="yx-page platform-page b6-platform-page"
    :class="themeClass"
    :style="experienceStyle"
    :data-motion="experienceMotion"
    :data-resolved-theme="b10ThemeMode"
  >
    <view class="platform-glow" aria-hidden="true"><image class="platform-glow-image" :src="A.glow" mode="scaleToFill" /></view>

    <MobilePageHeader
      page="b6-platform"
      compact
      :show-settings="false"
      :title="t('navTitle')"
      :back-icon-src="A.chevL"
    >
      <template #trail>
        <button
          tabindex="0"
          role="button"
          type="button"
          class="platform-refresh"
          :aria-label="t('refresh')"
          :disabled="loading"
          @click="load"
        >
          <image class="platform-refresh-icon" :src="A.refresh" mode="aspectFit" aria-hidden="true" />
        </button>
      </template>
    </MobilePageHeader>

    <view class="platform-canvas">
      <view class="platform-hero">
        <text class="platform-title" role="heading" aria-level="2">{{ t('heroTitle') }}</text>
        <text class="platform-subtitle">{{ t('heroSubtitle') }}</text>
      </view>

      <view v-if="loading" class="platform-loading" role="status" aria-live="polite">
        <text>{{ t('loading') }}</text>
      </view>

      <view v-else-if="loadError" class="platform-alert" role="alert">
        <text>{{ loadError }}</text>
        <button tabindex="0" role="button" type="button" class="platform-retry" @click="load">{{ t('retry') }}</button>
      </view>

      <template v-else>
        <text v-if="partial" class="platform-partial-note" role="status">{{ t('partialNote') }}</text>

        <view class="platform-card">
          <view class="platform-card-head">
            <text class="platform-card-title" role="heading" aria-level="2">{{ t('deviceTitle') }}</text>
            <text class="platform-chip platform-chip--muted">{{ t('deviceBadge') }}</text>
          </view>
          <view v-if="device.kind === 'unknown' || device.rows.length === 0" class="platform-empty">
            <text>{{ t('deviceEmpty') }}</text>
          </view>
          <view v-else class="platform-rows">
            <view v-for="row in device.rows" :key="row.code" class="platform-row">
              <view class="platform-tile" aria-hidden="true">
                <image class="platform-tile-icon" :src="deviceIcon(row.code)" mode="aspectFit" />
              </view>
              <view class="platform-copy">
                <text class="platform-row-title">{{ deviceLabel(row.code) }}</text>
                <text class="platform-row-detail">{{ deviceDetail(row) }}</text>
              </view>
              <text class="platform-tag" :class="deviceStatusClass(row.status)">{{ statusLabel(row.status) }}</text>
            </view>
          </view>
          <text class="platform-source">{{ t('sourceNote') }}</text>
        </view>

        <view class="platform-card">
          <view class="platform-card-head">
            <text class="platform-card-title" role="heading" aria-level="2">{{ t('qualityTitle') }}</text>
            <text class="platform-local">{{ t('qualityLocal') }}</text>
          </view>
          <view class="platform-chips" role="group" :aria-label="t('qualityTitle')">
            <button
              v-for="level in QUALITY_LEVELS"
              :key="level"
              tabindex="0"
              role="button"
              type="button"
              class="platform-choice"
              :class="{ 'platform-choice--active': qualityLevel === level }"
              :aria-pressed="qualityLevel === level"
              @click="chooseQuality(level)"
            >
              <text>{{ qualityLabel(level) }}</text>
            </button>
          </view>
          <text class="platform-quality-note">{{ t('qualityNote') }}</text>
          <text v-if="qualityError" class="platform-inline-error" role="alert">{{ qualityError }}</text>
          <button
            tabindex="0"
            role="button"
            type="button"
            class="platform-help"
            :aria-expanded="helpOpen"
            @click="toggleHelp"
          >
            <text>{{ t('helpLink') }}</text>
            <text class="platform-help-chevron" aria-hidden="true">›</text>
          </button>
          <view v-if="helpOpen" class="platform-help-body" role="status">
            <text>{{ t('helpBody') }}</text>
          </view>
        </view>

        <view class="platform-card">
          <view class="platform-card-head">
            <text class="platform-card-title" role="heading" aria-level="2">{{ t('a11yTitle') }}</text>
            <text class="platform-chip platform-chip--muted">{{ t('a11yBadge') }}</text>
          </view>
          <view class="platform-row platform-row--last">
            <view class="platform-tile platform-tile--brand" aria-hidden="true">
              <image class="platform-tile-icon" :src="A.eye" mode="aspectFit" />
            </view>
            <view class="platform-copy">
              <text class="platform-row-title">{{ t('a11yRow') }}</text>
              <text class="platform-row-detail">{{ accessibilityDetail }}</text>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.platform-page {
  position: relative;
  box-sizing: border-box;
  min-height: 100vh;
  padding: 0 0 calc(24px + env(safe-area-inset-bottom));
  overflow: hidden;
  color: var(--v2-ink);
  background: var(--yx-r4-page-color, #fcfaff);
  font-family: var(--v2-font);
}

.platform-glow { position: absolute; left: 60px; top: -230px; width: 540px; height: 480px; pointer-events: none; z-index: 0; }
.platform-glow-image { display: block; width: 540px; height: 480px; }

.platform-refresh { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; min-width: 44px; min-height: 44px; padding: 0; border: 0; background: transparent; }
.platform-refresh-icon { width: 20px; height: 20px; }
.platform-refresh:disabled { opacity: .5; }
/* The Figma refresh asset is a fixed dark stroke; invert it wherever the shared
   Header already inverts its back icon so the 44×44 control stays visible. */
:global(:root[data-theme="dark"] .platform-refresh-icon),
:global(:root[data-theme="high-contrast"] .platform-refresh-icon) { filter: invert(1) brightness(1.15); }

.platform-canvas {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  width: 100%;
  max-width: 430px;
  min-width: 0;
  margin: 0 auto;
  padding: 0 24px;
}

.platform-hero { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.platform-title { display: block; margin: 0; color: var(--v2-ink); font-size: 28px; line-height: 1.2857; font-weight: 700; overflow-wrap: anywhere; }
.platform-subtitle { display: block; color: var(--v2-mut); font-size: 14px; line-height: 1.5714; overflow-wrap: anywhere; }

.platform-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  min-width: 0;
  padding: 16px 20px;
  border: 1px solid var(--v2-line);
  border-radius: 24px;
  background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--v2-shadow);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.platform-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; min-width: 0; }
.platform-card-title { display: block; min-width: 0; color: var(--v2-ink); font-size: 18px; line-height: 1.4444; font-weight: 700; overflow-wrap: anywhere; }
.platform-chip { display: inline-flex; align-items: center; flex: none; box-sizing: border-box; padding: 3px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5; font-weight: 700; white-space: nowrap; }
.platform-chip--muted { color: var(--v2-mut); background: var(--v2-surface); }

.platform-rows { display: flex; flex-direction: column; }
.platform-row { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; box-sizing: border-box; min-width: 0; min-height: 56px; padding: 10px 0; border-top: 1px solid var(--v2-line); }
.platform-row--last { border-top: 1px solid var(--v2-line); }
.platform-tile { display: flex; align-items: center; justify-content: center; flex: none; width: 44px; height: 44px; border-radius: 14px; background: var(--v2-soft); }
.platform-tile--brand { background: var(--v2-soft); }
.platform-tile-icon { width: 22px; height: 22px; }
.platform-copy { display: flex; flex-direction: column; gap: 2px; flex: 1 1 160px; min-width: 0; }
.platform-row-title { display: block; color: var(--v2-ink); font-size: 15px; line-height: 1.4667; font-weight: 700; overflow-wrap: anywhere; }
.platform-row-detail { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }

.platform-tag { display: inline-flex; align-items: center; flex: none; padding: 3px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5; font-weight: 700; white-space: nowrap; }
.platform-tag--verified { color: var(--v2-ok); background: var(--v2-ok-soft); }
.platform-tag--unverified { color: var(--v2-warn); background: var(--v2-warn-soft); }
.platform-tag--unavailable, .platform-tag--unknown { color: var(--v2-mut); background: var(--v2-surface); }

.platform-source { display: block; color: var(--v2-mut); font-size: 12px; line-height: 1.5; overflow-wrap: anywhere; }
.platform-empty { display: block; padding: 12px 0; color: var(--v2-mut); font-size: 13px; line-height: 1.5; }
.platform-partial-note { display: block; color: var(--v2-mut); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.platform-loading { display: block; padding: 24px 0; color: var(--v2-mut); font-size: 14px; line-height: 1.5; }

.platform-chips { display: flex; flex-wrap: wrap; gap: 8px; min-width: 0; }
.platform-choice { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 72px; min-height: 44px; padding: 10px 14px; border: 1px solid var(--v2-line); border-radius: 22px; color: var(--v2-mut); background: var(--v2-card); font-size: 14px; line-height: 1.4; font-weight: 500; }
.platform-choice--active { border-color: var(--v2-brand); color: var(--v2-inverse); background: var(--v2-brand); font-weight: 700; }
.platform-choice:focus-visible, .platform-help:focus-visible, .platform-refresh:focus-visible, .platform-retry:focus-visible { outline: none; box-shadow: var(--v2-focus); }
.platform-choice:active { transform: scale(.97); }

.platform-local { display: block; flex: none; color: var(--v2-mut); font-size: 13px; line-height: 1.5; }
.platform-quality-note { display: block; color: var(--v2-mut); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }
.platform-inline-error { display: block; color: var(--v2-bad); font-size: 13px; line-height: 1.5; }

.platform-help { display: flex; align-items: center; justify-content: space-between; gap: 8px; box-sizing: border-box; width: 100%; min-height: 44px; padding: 10px 0; border: 0; background: transparent; color: var(--v2-brand); font-size: 14px; line-height: 1.4; font-weight: 600; text-align: left; }
.platform-help-chevron { flex: none; font-size: 18px; line-height: 1; }
.platform-help-body { display: block; padding: 12px 14px; border-radius: 12px; color: var(--v2-mut); background: var(--v2-surface); font-size: 13px; line-height: 1.5; overflow-wrap: anywhere; }

.platform-alert { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 16px; border: 1px solid var(--v2-bad); border-radius: 16px; color: var(--v2-bad); background: var(--v2-bad-soft); font-size: 14px; line-height: 1.5; }
.platform-retry { min-height: 44px; padding: 10px 16px; border: 1px solid var(--v2-bad); border-radius: 12px; color: var(--v2-bad); background: transparent; font-size: 14px; font-weight: 600; }

.platform-page .platform-glow { display: block; }
.b10-theme--high-contrast .platform-glow { display: none; }
.b10-theme--high-contrast .platform-card { border-width: 2px; border-color: var(--v2-line); box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.b10-theme--high-contrast .platform-choice { border-width: 2px; }
[data-motion="off"] .platform-glow { display: none; }
[data-motion="reduced"] .platform-choice, [data-motion="reduced"] .platform-help { transition: none; }

@media (max-width: 340px) {
  .platform-canvas { padding: 0 16px; }
  .platform-title { font-size: 24px; }
  .platform-card { padding-left: 14px; padding-right: 14px; }
  .platform-chip { max-width: 100%; white-space: normal; overflow-wrap: anywhere; }
  .platform-choice { min-width: 64px; }
}
</style>
