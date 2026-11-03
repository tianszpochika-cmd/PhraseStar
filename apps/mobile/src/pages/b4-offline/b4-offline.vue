<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import MobileClosedPracticeNotice from '../../components/MobileClosedPracticeNotice.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'
import { b10ThemeMode } from '../../platform/b10-foundation'

const session = useSessionStore()
const b4 = useB4Store()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const queueCountLabel = computed(() => interpolate(mobileT('closed.offline.queue.count'), { count: b4.queueCount }))

onShow(async () => {
  await session.restore()
  if (!session.isAuthenticated) { getUniRuntime().navigateTo({ url: '/pages/login/login' }); return }
  b4.restore()
  void b4.loadWorld()
})

function backToLearning(): void { getUniRuntime().navigateTo({ url: '/pages/today/today' }) }
function queueStatusKey(value: string): string {
  return ({ PENDING: 'closed.offline.queue.status.pending', SYNCING: 'closed.offline.queue.status.syncing', FAILED: 'closed.offline.queue.status.failed' } as Record<string, string>)[value] ?? 'closed.offline.queue.status.unknown'
}
function syncPending(): void { void b4.syncOffline() }
</script>

<template>
  <view class="yx-page v2-closed-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
    <MobilePageHeader page="b4-offline" compact :title="mobileT('closed.offline.navTitle')" back-icon-src="/static/figma-closed-169-8610/7edc101f-d5d5-4cb8-a983-636b09d16b77.svg" :show-settings="false" />

    <MobileClosedPracticeNotice
      variant="offline"
      page-title-key="closed.offline.title"
      page-subtitle-key="closed.offline.subtitle"
      title-key="closed.offline.cardTitle"
      description-key="closed.offline.reason"
      aria-label-key="closed.offline.cardTitle"
      glow-src="/static/figma-closed-169-8610/c6ebc160-a569-4d54-8b8e-1e8d8c24e667.svg"
      icon-src="/static/figma-closed-169-8610/39d39cfd-9d9f-4a74-87dd-7d2afa230999.svg"
      @back="backToLearning"
    >
      <template #queue>
        <view v-if="b4.queueCount" class="v2-offline-queue" role="status">
          <view class="v2-offline-queue-head">
            <text class="v2-offline-queue-title">{{ mobileT('closed.offline.queue.title') }}</text>
            <text class="v2-offline-queue-meta">{{ queueCountLabel }}</text>
          </view>
          <text class="v2-offline-queue-copy">{{ mobileT('closed.offline.queue.reason') }}</text>
          <view v-for="item in b4.offlineRecords" :key="item.id" class="v2-offline-queue-row">
            <text class="v2-offline-queue-name">{{ mobileT('closed.offline.queue.item') }}</text>
            <text class="v2-offline-queue-state">{{ mobileT(queueStatusKey(item.status)) }}</text>
            <text v-if="item.lastError" class="v2-offline-queue-error">{{ item.lastError }}</text>
          </view>
          <button tabindex="0" role="button" class="v2-offline-sync" type="button" @click="syncPending">{{ mobileT('closed.offline.queue.syncNow') }}</button>
        </view>
      </template>
    </MobileClosedPracticeNotice>
  </view>
</template>

<style scoped lang="scss">
.v2-closed-page.v2-closed-page{box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 42%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-offline-queue{display:flex;flex-direction:column;gap:var(--v2-space-2);box-sizing:border-box;width:100%;min-width:0;max-width:520px;margin:0 auto;padding:var(--v2-space-4);border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font)}
.v2-offline-queue-head{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-offline-queue-title{display:block;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-md);font-weight:700;line-height:1.5}
.v2-offline-queue-meta{display:block;flex:none;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.5;white-space:nowrap}
.v2-offline-queue-copy{display:block;color:var(--v2-mut);font-family:var(--v2-font);font-size:var(--v2-text-sm);line-height:1.65;overflow-wrap:anywhere}
.v2-offline-queue-row{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--v2-space-2);box-sizing:border-box;min-width:0;max-width:100%;padding:var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-surface)}
.v2-offline-queue-name{display:block;min-width:0;color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5}
.v2-offline-queue-state{display:block;flex:none;color:var(--v2-warn);font-family:var(--v2-font);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5;white-space:nowrap}
.v2-offline-queue-error{display:block;flex:1 1 100%;color:var(--v2-bad);font-family:var(--v2-font);font-size:var(--v2-text-xs);line-height:1.5;overflow-wrap:anywhere}
.v2-offline-sync{display:flex;align-items:center;justify-content:center;width:100%;min-height:48px;margin:0;padding:var(--v2-space-3) var(--v2-space-4);border:1px solid var(--v2-line);border-radius:var(--v2-radius-md);background:var(--v2-card);color:var(--v2-ink);font-family:var(--v2-font);font-size:var(--v2-text-sm);font-weight:600;line-height:1.5}
.v2-offline-sync:hover{border-color:var(--v2-brand)}
.v2-offline-sync:focus-visible{box-shadow:var(--v2-focus);outline:none}
@media(max-width:360px){.v2-closed-page.yx-page{padding-inline:16px}}
</style>
