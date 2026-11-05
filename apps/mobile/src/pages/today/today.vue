<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { backMobile, mobileT, useMobileExperience } from '../../platform/experience'
import { getUniRuntime, openUniPage } from '../../platform/uni-runtime'
import { ensureMobilePageAccess } from '../../auth/navigation'
import type { MobileTask } from '../../domain/learner-content'
import { arrangementLabel, emptyStateView, firstLearningGuideCopy, type EmptyStateView } from '../../domain/plan-today'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'
import {
  TODAY_ASSETS,
  canLaunchTask,
  confirmedDeferredCount,
  continueTask,
  emptyMessageKey,
  frameAssets,
  launchUrl,
  progressFacts,
  routeStillToday,
  taskCopyKey,
  taskIconSrc,
  todayVisual,
  visualDesign,
} from './today-view'

const { experienceStyle, experienceMotion } = useMobileExperience()
const store = useLearnerContentStore()
const session = useSessionStore()
let pageEpoch = 0
let visible = false
let activeEntry: { epoch: number; promise: Promise<void> } | null = null

function todayT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(`todayPage.${key}`)
  return values ? interpolate(message, values) : message
}

const visual = computed(() => todayVisual({
  homeStatus: store.homeStatus,
  planStatus: store.planQueueStatus,
  taskCount: store.home?.tasks.length ?? 0,
  emptyReason: store.planQueue?.emptyReason ?? null,
}))
const design = computed(() => visualDesign(visual.value))
const frame = computed(() => frameAssets(visual.value))
const measured = computed(() => progressFacts(store.home))
const deferredCount = computed(() => confirmedDeferredCount(store.planQueueStatus, store.planQueue?.deferredCount))
const summary = computed(() => {
  const parts: string[] = []
  if (measured.value) parts.push(todayT('remaining', { count: measured.value.remaining }))
  if (deferredCount.value !== null && deferredCount.value > 0) parts.push(todayT('deferred', { count: deferredCount.value }))
  return parts.join('；')
})
const message = computed(() => emptyMessageKey(visual.value))
const launchTask = computed(() => continueTask(store.home?.tasks ?? []))
const planExplanation = computed(() => store.planQueue?.explanation ?? null)
const firstLearningCopy = computed(() => {
  const first = store.planQueue?.firstLearning
  return first?.guideVisible ? firstLearningGuideCopy(first.reason) : null
})
const planEmpty = computed((): EmptyStateView | null => {
  if ((store.home?.tasks.length ?? 0) > 0) return null
  if (store.planQueueStatus === 'error') return emptyStateView({ failed: true, reason: null, hasTasks: false })
  if (store.planQueueStatus !== 'ready' && store.planQueueStatus !== 'empty') return null
  return emptyStateView({ failed: false, reason: store.planQueue?.emptyReason ?? null, hasTasks: false })
})
const showFacts = computed(() => visual.value === 'ready' || visual.value === 'no-plan' || visual.value === 'completed' || visual.value === 'no-content' || visual.value === 'no-due' || visual.value === 'no-tasks')
const visiblePlanFacts = computed(() => showFacts.value && ((store.planQueue?.arrangements.length ?? 0) > 0 || Boolean(planExplanation.value) || Boolean(firstLearningCopy.value) || Boolean(store.planNotice)))

function leaveRoute(): boolean {
  if (routeStillToday()) return false
  visible = false
  pageEpoch += 1
  activeEntry = null
  return true
}

async function enterToday(runEpoch: number): Promise<void> {
  if (leaveRoute() || !visible || runEpoch !== pageEpoch) return
  if (activeEntry && activeEntry.epoch === runEpoch) return activeEntry.promise
  const entry: { epoch: number; promise: Promise<void> } = {
    epoch: runEpoch,
    promise: (async () => {
      const allowed = await ensureMobilePageAccess('/pages/today/today')
      if (leaveRoute() || !visible || runEpoch !== pageEpoch) return
      if (!allowed) return
      await store.loadHome()
    })(),
  }
  activeEntry = entry
  try {
    await entry.promise
  } finally {
    if (activeEntry === entry) activeEntry = null
  }
}

onShow(() => {
  visible = true
  const runEpoch = ++pageEpoch
  void enterToday(runEpoch)
})
onHide(() => {
  visible = false
  pageEpoch += 1
  activeEntry = null
})
onUnmounted(() => {
  visible = false
  pageEpoch += 1
  activeEntry = null
})
watch(() => session.identityRevision, () => {
  pageEpoch += 1
  activeEntry = null
  if (leaveRoute() || !visible) return
  void enterToday(pageEpoch)
}, { flush: 'sync' })

function openPlanEmpty(view: EmptyStateView): void {
  if (view.to === 'retry') { void store.loadHome(); return }
  if (view.to === 'onboarding') { openUniPage('/pages/onboarding/onboarding'); return }
  getUniRuntime().switchTab({ url: '/pages/home/home' })
}
function viewTask(task: MobileTask): void {
  const url = launchUrl(task)
  if (!url) return
  openUniPage(url)
}
function backHome(): void { getUniRuntime().switchTab({ url: '/pages/home/home' }) }
function taskMeta(task: MobileTask): string {
  const key = taskCopyKey(task.status, task.minutes)
  return key.startsWith('meta') ? todayT(key, { count: task.minutes }) : todayT(key)
}
</script>

<template>
  <view class="today" :style="experienceStyle" :data-motion="experienceMotion" :data-visual="visual" :data-design="design" :data-algorithm-version="store.planQueue?.algorithmVersion || undefined">
    <image class="today-glow" :src="frame.glow" mode="aspectFit" aria-hidden="true" />
    <view class="today-column">
      <view class="today-pad">
        <MobilePageHeader page="today" compact :title="todayT('navTitle')" :back-icon-src="frame.chev" :show-settings="false" />
        <view v-if="visual === 'loading'" class="today-scroll" role="status"><text>{{ todayT('loading') }}</text></view>
        <view v-else-if="message && (visual === 'offline' || visual === 'error' || visual === 'forbidden' || visual === 'plan-failed')" class="today-scroll today-scroll--center">
          <view class="today-center">
            <view class="today-state" role="alert">
              <image v-if="frame.mascot" class="today-mascot" :src="frame.mascot" mode="aspectFit" aria-hidden="true" />
              <text class="today-state-title">{{ todayT(message.title) }}</text>
              <text class="today-state-body">{{ todayT(message.body) }}</text>
              <button tabindex="0" role="button" type="button" class="today-link" @click="backMobile">{{ mobileT('back') }}</button>
            </view>
          </view>
        </view>
        <view v-else class="today-scroll" :class="{ 'today-scroll--center': visual !== 'ready' && visual !== 'no-tasks' }">
          <text v-if="visual === 'ready' && summary" class="today-summary">{{ summary }}</text>
          <view v-if="store.homeStatus === 'unavailable'" class="today-note unavailable" role="status">
            <text class="state-title">课程列表暂不可用</text>
            <text class="state-description">{{ todayT('catalogUnavailableBody') }}</text>
            <button tabindex="0" role="button" type="button" class="today-link" @click="store.loadHome()">{{ todayT('reload') }}</button>
          </view>
          <view v-if="visual === 'ready'" class="today-ready">
            <view v-if="measured" class="today-card today-progress">
              <view class="today-ring" :style="{ '--today-pct': String(measured.percent) }">
                <image class="today-ring-track" :src="TODAY_ASSETS.track" mode="aspectFit" aria-hidden="true" />
                <view class="today-ring-arc" aria-hidden="true"></view>
                <text class="today-ring-value">{{ measured.percent }}%</text>
              </view>
              <view class="today-progress-copy">
                <text class="today-card-title">{{ todayT('durationTitle') }}</text>
                <text class="today-card-meta">{{ todayT('durationMeta', { target: measured.target, done: measured.done }) }}</text>
              </view>
            </view>
            <view class="today-card">
              <view class="today-list-head">
                <text class="today-card-title">{{ todayT('listTitle') }}</text>
                <text class="today-count">{{ todayT('itemCount', { count: store.home?.tasks.length ?? 0 }) }}</text>
              </view>
              <template v-for="task in store.home?.tasks" :key="task.id">
                <button v-if="canLaunchTask(task)" tabindex="0" role="button" type="button" class="today-row" :data-task-id="task.id" @click="viewTask(task)">
                  <view class="today-tile"><image v-if="taskIconSrc(task.status)" class="today-tile-icon" :src="taskIconSrc(task.status) || ''" mode="aspectFit" aria-hidden="true" /></view>
                  <view class="today-row-copy"><text class="today-row-title">{{ task.title }}</text><text class="today-row-meta">{{ taskMeta(task) }}</text></view>
                  <image class="today-chev" :src="TODAY_ASSETS.chevR" mode="aspectFit" aria-hidden="true" />
                </button>
                <view v-else class="today-row" :data-task-id="task.id">
                  <view class="today-tile"><image v-if="taskIconSrc(task.status)" class="today-tile-icon" :src="taskIconSrc(task.status) || ''" mode="aspectFit" aria-hidden="true" /></view>
                  <view class="today-row-copy"><text class="today-row-title">{{ task.title }}</text><text class="today-row-meta">{{ taskMeta(task) }}</text></view>
                  <image v-if="task.status === 'COMPLETED'" class="today-check" :src="TODAY_ASSETS.check" mode="aspectFit" aria-hidden="true" />
                </view>
              </template>
            </view>
          </view>
          <view v-else-if="visual === 'no-tasks'" class="today-state">
            <view v-if="store.home && !store.home.tasks.length" class="empty">今天还没有安排任务。</view>
          </view>
          <view v-else-if="message" class="today-center">
            <view class="today-state" role="status">
              <view v-if="frame.calendar" class="today-badge"><image class="today-badge-icon" :src="frame.calendar" mode="aspectFit" aria-hidden="true" /></view>
              <text class="today-state-title">{{ todayT(message.title) }}</text>
              <text class="today-state-body">{{ todayT(message.body) }}</text>
              <button tabindex="0" role="button" type="button" class="today-link" @click="backHome">{{ todayT('backHome') }}</button>
            </view>
          </view>
          <view v-if="visiblePlanFacts" class="today-facts">
            <text v-for="item in store.planQueue?.arrangements ?? []" :key="item.itemId" data-arrangement class="today-fact">{{ arrangementLabel(item.arrangement, item.arrangementCopy) }}</text>
            <text v-if="planExplanation" class="today-fact" role="status">{{ planExplanation }}</text>
            <text v-if="firstLearningCopy" class="today-fact" role="status">{{ firstLearningCopy }}</text>
            <text v-if="store.planNotice" class="today-fact" role="status">{{ store.planNotice }}</text>
          </view>
        </view>
      </view>
      <view v-if="message && (visual === 'offline' || visual === 'error' || visual === 'forbidden' || visual === 'plan-failed')" class="today-bar">
        <button tabindex="0" role="button" type="button" class="today-cta" @click="store.loadHome()">{{ todayT(message.action) }}</button>
      </view>
      <view v-else-if="visual === 'ready' && launchTask" class="today-bar">
        <button tabindex="0" role="button" type="button" class="today-cta" @click="viewTask(launchTask)">{{ todayT('continueLabel', { title: launchTask.title }) }}</button>
      </view>
      <view v-else-if="message && planEmpty" class="today-bar">
        <button tabindex="0" role="button" type="button" class="today-cta" @click="openPlanEmpty(planEmpty)">{{ todayT(message.action) }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.today { position: relative; display: flex; flex-direction: column; min-height: 100vh; min-height: 100dvh; overflow-x: clip; background: linear-gradient(180deg, var(--v2-soft), var(--v2-bg)); color: var(--v2-ink); font-family: var(--v2-font); }
.today-glow { position: absolute; top: -140px; right: -40px; width: 360px; height: 300px; pointer-events: none; }
.today-column { position: relative; display: flex; flex: 1 1 auto; flex-direction: column; width: 100%; min-height: 100vh; min-height: 100dvh; box-sizing: border-box; }
.today-pad { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; padding: 8px 24px 0; box-sizing: border-box; }
.today-scroll { display: flex; flex: 1 1 auto; flex-direction: column; gap: 16px; min-width: 0; padding-bottom: 24px; box-sizing: border-box; }
.today-scroll--center { padding-bottom: 0; }
.today-center { display: flex; flex: 1 1 auto; flex-direction: column; align-items: center; justify-content: center; width: 100%; min-width: 0; }
.today-ready { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.today-state { display: flex; flex-direction: column; align-items: center; width: 100%; padding: 24px 0; text-align: center; }
.today-mascot { width: 120px; height: 120px; }
.today-badge { display: flex; align-items: center; justify-content: center; width: 96px; height: 96px; border-radius: 48px; background: var(--v2-soft); }
.today-badge-icon { width: 44px; height: 44px; }
.today-state-title, .today-state-body, .today-summary, .today-card-title, .today-card-meta, .today-row-title, .today-row-meta, .today-fact, .state-title, .state-description { display: block; overflow-wrap: anywhere; }
.today-state-title { margin-top: 16px; color: var(--v2-ink); font-size: 22px; font-weight: 700; line-height: 32px; }
.today-state-body, .state-description { margin-top: 8px; color: var(--v2-mut); font-size: 15px; line-height: 24px; }
.today-summary { color: var(--v2-mut); font-size: 14px; line-height: 22px; }
.today-note, .today-card { border: 1px solid var(--v2-line); border-radius: 24px; background: color-mix(in srgb, var(--v2-card) 82%, transparent); box-shadow: var(--v2-shadow); }
.today-note { display: grid; gap: 8px; padding: 16px 20px; }
.state-title { color: var(--v2-ink); font-weight: 700; }
.today-card { padding: 16px 20px; }
.today-progress { display: flex; align-items: center; gap: 16px; }
.today-ring { position: relative; width: 72px; height: 72px; flex: 0 0 72px; }
.today-ring-track, .today-ring-arc { position: absolute; inset: 0; width: 72px; height: 72px; }
.today-ring-arc { border-radius: 50%; background: conic-gradient(from -90deg, var(--v2-brand) calc(var(--today-pct) * 1%), transparent 0); mask: radial-gradient(farthest-side, transparent calc(100% - 5px), var(--v2-ink) 0); }
.today-ring-value { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; color: var(--v2-ink); font-size: 17px; font-weight: 700; line-height: 22px; }
.today-progress-copy { min-width: 0; }
.today-card-title { color: var(--v2-ink); font-size: 18px; font-weight: 700; line-height: 26px; }
.today-card-meta, .today-count, .today-row-meta, .today-fact { color: var(--v2-mut); font-size: 14px; line-height: 22px; }
.today-list-head, .today-row { display: flex; align-items: center; gap: 12px; width: 100%; min-width: 0; }
.today-list-head { padding: 2px 0 8px; }
.today-count { margin-left: auto; font-size: 13px; line-height: 20px; }
.today-row { min-height: 44px; padding: 10px 0; border: 0; background: transparent; color: inherit; text-align: left; }
.today-tile { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: 0 0 44px; border: 1px solid var(--v2-card); border-radius: 14px; background: var(--v2-soft); }
.today-tile-icon { width: 26px; height: 26px; }
.today-row-copy { flex: 1 1 auto; min-width: 0; }
.today-row-title { color: var(--v2-ink); font-size: 15px; font-weight: 700; line-height: 22px; }
.today-check { width: 14px; height: 14px; padding: 5px; border-radius: 12px; background: var(--v2-ok); box-sizing: content-box; }
.today-chev { width: 20px; height: 20px; flex: 0 0 20px; }
.today-link, .today-cta { box-sizing: border-box; overflow-wrap: anywhere; white-space: normal; }
.today-link { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; margin: 0; padding: 10px 8px; border: 0; background: transparent; color: var(--v2-brand); font-size: 14px; font-weight: 600; line-height: 1.5; }
.today-bar { flex: 0 0 auto; box-sizing: border-box; width: 100%; padding: 12px 24px calc(30px + env(safe-area-inset-bottom)); background: var(--v2-card); box-shadow: 0 -4px 16px color-mix(in srgb, var(--v2-ink) 8%, transparent); }
.today-cta {
  display: flex; align-items: center; justify-content: center; width: 100%; height: auto; margin: 0;
  min-height: 44px; min-height: max(44px, 3em); padding: 12px 20px; border: 0; border-radius: 14px;
  background-color: var(--v2-brand); background-image: var(--v2-grad); color: var(--v2-inverse);
  font-size: 16px; font-weight: 700; line-height: 1.5;
}
.today-link::after { border: 0; }
.today-cta::after { border: 0; }
.today :deep(.mobile-back) {
  width: 44px; min-width: 44px; height: 44px; min-height: 44px; margin: 0; padding: 0;
  border: 0; border-radius: 0; background: transparent; line-height: 1; box-shadow: none;
}
.today :deep(.mobile-back)::after { border: 0; }
.today-link:focus-visible, .today-cta:focus-visible, .today-row:focus-visible { outline: none; box-shadow: var(--v2-focus); }
.today-facts { display: grid; gap: 8px; }
.empty { color: var(--v2-mut); font-size: 15px; line-height: 24px; overflow-wrap: anywhere; }
@media (max-width: 360px) {
  .today-pad { padding-right: 16px; padding-left: 16px; }
  .today-bar { padding-right: 16px; padding-left: 16px; }
}
@media (min-width: 768px) { .today-column { max-width: 720px; margin: 0 auto; } }
.today[data-motion='reduced'] .today-cta:active, .today[data-motion='off'] .today-cta:active { transform: none; }
:global(:root[data-theme='high-contrast']) .today-card, :global(:root[data-theme='high-contrast']) .today-note, :global(:root[data-theme='high-contrast']) .today-cta { border: 2px solid var(--v2-ink); }
</style>
