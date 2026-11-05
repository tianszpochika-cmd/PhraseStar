<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import { B4_PERFORMANCE_LEVELS, type B4GameCode, type B4PerformanceLevel } from '../../domain/b4'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { useSessionStore } from '../../stores/session'
import { useB4Store } from '../../stores/b4'

const session = useSessionStore()
const b4 = useB4Store()
const settlementDismissed = ref(false)
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)

const GAME_TITLE_KEYS: Record<B4GameCode, string> = {
  SENTENCE_TRAIN: 'games.label.sentenceTrain',
  WORD_MATCH: 'games.label.wordMatch',
  WORD_DEFENSE: 'games.label.wordDefense',
  WORD_PUZZLE: 'games.label.wordPuzzle',
  GRAMMAR_BLASTER: 'games.label.grammarBlaster',
  CATCH_MEANING: 'games.label.catchMeaning',
}
const GAME_ICON_SOURCES: Record<B4GameCode, string> = {
  SENTENCE_TRAIN: '/static/figma-games-catalog-169-5353/ec4ac7e1-b7d8-47ab-adb7-e5ebb04e680d.svg',
  WORD_MATCH: '/static/figma-games-catalog-169-5353/049e6bcd-8d05-48cf-995e-11a10c6f1545.svg',
  WORD_DEFENSE: '/static/figma-games-catalog-169-5353/6f5a2737-3612-48da-9a06-f9bbc3b93674.svg',
  WORD_PUZZLE: '/static/figma-games-catalog-169-5353/44675a19-02d8-4b97-8faf-d44b75993cfe.svg',
  GRAMMAR_BLASTER: '/static/figma-games-catalog-169-5353/3c5bb6ac-ca3c-4fd6-b33c-650bc119c227.svg',
  CATCH_MEANING: '/static/figma-games-catalog-169-5353/d75fd8c4-4fe2-4378-92a4-8e6c466c32de.svg',
}
const GAME_TONE_CLASSES: Record<B4GameCode, string> = {
  SENTENCE_TRAIN: 'v2-games-tile--sentence',
  WORD_MATCH: 'v2-games-tile--match',
  WORD_DEFENSE: 'v2-games-tile--defense',
  WORD_PUZZLE: 'v2-games-tile--puzzle',
  GRAMMAR_BLASTER: 'v2-games-tile--grammar',
  CATCH_MEANING: 'v2-games-tile--meaning',
}
const GAME_STATUS_KEYS: Record<string, string> = {
  READY: 'games.status.ready',
  IN_PROGRESS: 'games.status.inProgress',
  PAUSED: 'games.status.paused',
  FINISHED: 'games.status.finished',
  COMPLETED: 'games.status.completed',
  EXPIRED: 'games.status.expired',
}
const QUALITY_KEYS: Record<B4PerformanceLevel, string> = {
  Ultra: 'qualityUltra',
  High: 'qualityHigh',
  Medium: 'qualityMedium',
  Performance: 'qualityPerformance',
}
const qualityLabels = computed(() => B4_PERFORMANCE_LEVELS.map((level) => mobileT(QUALITY_KEYS[level])))
const qualityIndex = computed(() => Math.max(0, B4_PERFORMANCE_LEVELS.indexOf(b4.performanceLevel as B4PerformanceLevel)))
const queueLabel = computed(() => interpolate(mobileT('games.utility.queue'), { count: b4.queueCount }))
const isPaused = computed(() => b4.activeGame?.status === 'PAUSED')
const showLoading = computed(() => b4.status === 'loading')
const showFailed = computed(() => ['error', 'offline', 'permission'].includes(b4.status) && b4.games.length === 0)
const showSettlement = computed(() => !b4.activeGame && Boolean(b4.lastGameResult) && !settlementDismissed.value)
const showCatalog = computed(() => !b4.activeGame && !showSettlement.value && !showLoading.value && !showFailed.value && b4.games.length > 0)
const showEmpty = computed(() => !b4.activeGame && !showSettlement.value && !showLoading.value && !showFailed.value && b4.games.length === 0)
const showIntro = computed(() => !b4.activeGame && !showSettlement.value)
const showBottomCta = computed(() => !showLoading.value && !showFailed.value)
const stateName = computed(() => {
  if (b4.activeGame) return isPaused.value ? 'paused-no-items' : 'active-no-items'
  if (showSettlement.value) return 'settlement'
  if (showLoading.value) return 'loading'
  if (showFailed.value) return 'error'
  if (showCatalog.value) return 'catalog'
  return 'empty'
})
const glowSrc = computed(() => {
  if (b4.activeGame) return isPaused.value
    ? '/static/figma-games-paused-169-5637/a231f701-d20a-4b35-97a8-c84d2a6a3b22.svg'
    : '/static/figma-games-no-items-169-5811/92031080-c911-4049-9a71-a8b30e2bd73c.svg'
  if (showSettlement.value) return '/static/figma-games-settlement-169-5726/27d5d44b-e0d7-40e3-b993-f70065b638ba.svg'
  if (showLoading.value || showFailed.value) return '/static/figma-games-loading-169-5279/f55fe0b7-2f4d-4616-a752-f3d7005a212c.svg'
  if (showEmpty.value) return '/static/figma-games-empty-169-5475/5a39c062-43c0-4f73-8a34-7d48751de671.svg'
  return '/static/figma-games-catalog-169-5353/22806d99-c3c8-4573-b60d-dbc4ce94fc5a.svg'
})

watch(() => b4.lastGameResult, () => { settlementDismissed.value = false }, { flush: 'sync' })

onShow(async () => {
  await session.restore()
  if (!await ensureMobilePageAccess('/pages/b4-games/b4-games')) return
  b4.restore()
  void b4.loadWorld()
})

function gameTitle(code: B4GameCode): string { return mobileT(GAME_TITLE_KEYS[code] ?? 'games.label.unknown') }
function gameIcon(code: B4GameCode): string { return GAME_ICON_SOURCES[code] ?? '/static/figma-games-empty-169-5475/2529c60e-f1dd-4920-83bf-31e9d9f53fe0.svg' }
function gameTone(code: B4GameCode): string { return GAME_TONE_CLASSES[code] ?? 'v2-games-tile--fallback' }
function gameStatusLabel(value: string): string { return mobileT(GAME_STATUS_KEYS[value] ?? 'games.status.unknown') }
function gameClosedReason(enabled: boolean): string { return mobileT(enabled ? 'games.catalog.closedReason' : 'games.catalog.openReason') }
function qualityLabel(level: B4PerformanceLevel): string { return mobileT(QUALITY_KEYS[level]) }
function selectPerformance(event: { detail: { value: number } }): void {
  const level = B4_PERFORMANCE_LEVELS[Number(event.detail.value)]
  if (level) b4.setPerformance(level)
}
function syncQueue(): void { void b4.syncOffline() }
function openPractice(): void { getUniRuntime().navigateTo({ url: '/pages/practice/practice' }) }
function openLogin(): void { getUniRuntime().navigateTo({ url: '/pages/login/login' }) }
function recover(): void { if (b4.status === 'permission') { openLogin(); return } void b4.loadWorld() }
function dismissSettlement(): void { settlementDismissed.value = true }
function primaryAction(): void {
  if (b4.activeGame) { if (isPaused.value) void b4.resumeGame(); else void b4.refreshGame(); return }
  if (showSettlement.value) { dismissSettlement(); return }
  openPractice()
}
</script>

<template>
  <view class="yx-page v2-games-page" :style="experienceStyle" :data-motion="experienceMotion" :class="themeClass">
    <MobilePageHeader page="b4-games" compact :title="mobileT('games.navTitle')" back-icon-src="/static/figma-games-catalog-169-5353/73e64094-9ca5-43cf-bfb9-5229b88801de.svg" :show-settings="false" />
    <image class="v2-games-glow" :src="glowSrc" mode="scaleToFill" aria-hidden="true" />

    <view class="v2-games-body" :data-games-state="stateName">
      <view v-if="showIntro" class="v2-games-intro">
        <text class="v2-games-intro__title">{{ mobileT('games.title') }}</text>
        <text class="v2-games-intro__subtitle">{{ mobileT('games.subtitle') }}</text>
      </view>

      <view class="v2-games-utility">
        <view class="v2-games-quality" role="group" :aria-label="mobileT('games.utility.quality')">
          <text class="v2-games-quality__label">{{ mobileT('games.utility.quality') }}</text>
          <picker :range="qualityLabels" :value="qualityIndex" @change="selectPerformance">
            <view class="v2-games-quality__value">{{ qualityLabel(b4.performanceLevel as B4PerformanceLevel) }}</view>
          </picker>
        </view>
        <view v-if="b4.queueCount" class="v2-games-queue" role="status">
          <text class="v2-games-queue__label">{{ queueLabel }}</text>
          <button tabindex="0" role="button" class="v2-games-queue__action" type="button" @click="syncQueue">{{ mobileT('games.actions.sync') }}</button>
        </view>
      </view>

      <view v-if="showLoading" class="v2-games-state" role="status" data-state="loading">
        <image class="v2-games-mascot" src="/static/figma-games-loading-169-5279/7faf25d2-f041-4b2f-9fb0-c38246059244.svg" mode="aspectFit" aria-hidden="true" />
        <text class="v2-games-state__title">{{ mobileT('games.state.loadingTitle') }}</text>
        <text class="v2-games-state__desc">{{ mobileT('games.state.loadingDesc') }}</text>
        <button tabindex="0" role="button" class="v2-games-button v2-games-button--primary" type="button" disabled>{{ mobileT('games.actions.loading') }}</button>
      </view>

      <view v-else-if="showFailed" class="v2-games-state" role="status" data-state="error">
        <image class="v2-games-mascot" src="/static/figma-games-loading-169-5279/7faf25d2-f041-4b2f-9fb0-c38246059244.svg" mode="aspectFit" aria-hidden="true" />
        <text class="v2-games-state__title">{{ mobileT(b4.status === 'permission' ? 'games.state.permissionTitle' : 'games.state.errorTitle') }}</text>
        <text class="v2-games-state__desc">{{ mobileT(b4.status === 'permission' ? 'games.state.permissionDesc' : 'games.state.errorDesc') }}</text>
        <text v-if="b4.lastError" class="v2-games-state__detail">{{ b4.lastError }}</text>
        <button tabindex="0" role="button" class="v2-games-button v2-games-button--primary" type="button" @click="recover">{{ mobileT(b4.status === 'permission' ? 'games.actions.login' : 'games.actions.retry') }}</button>
      </view>

      <view v-else-if="b4.activeGame" class="v2-games-active" data-state="active">
        <view class="v2-games-board">
          <view class="v2-games-board__head">
            <view class="v2-games-tile v2-games-tile--small" :class="gameTone(b4.activeGame.gameCode)">
              <image class="v2-games-tile__icon" :src="gameIcon(b4.activeGame.gameCode)" mode="aspectFit" aria-hidden="true" />
            </view>
            <view class="v2-games-board__copy">
              <text class="v2-games-board__name">{{ gameTitle(b4.activeGame.gameCode) }}</text>
              <text class="v2-games-board__meta">{{ interpolate(mobileT('games.active.rounds'), { count: b4.activeGame.attemptCount }) }}</text>
            </view>
            <text class="v2-games-status" :class="isPaused ? 'v2-games-status--warn' : 'v2-games-status--ok'">{{ gameStatusLabel(b4.activeGame.status) }}</text>
          </view>

          <view class="v2-games-no-items" role="status">
            <view class="v2-games-badge">
              <image class="v2-games-badge__icon" src="/static/figma-games-no-items-169-5811/1666888b-37cb-491a-8721-f60d75b3b68a.svg" mode="aspectFit" aria-hidden="true" />
            </view>
            <text class="v2-games-no-items__title">{{ mobileT('games.noItems.title') }}</text>
            <text class="v2-games-no-items__desc" data-closed-reason>{{ mobileT('games.noItems.desc') }}</text>
          </view>

          <view class="v2-games-actions">
            <button v-if="b4.activeGame.status === 'IN_PROGRESS' || b4.activeGame.status === 'READY'" tabindex="0" role="button" class="v2-games-button" type="button" @click="b4.pauseGame">{{ mobileT('games.actions.pause') }}</button>
            <button v-if="isPaused" tabindex="0" role="button" class="v2-games-button" type="button" @click="b4.resumeGame">{{ mobileT('games.actions.resume') }}</button>
            <button tabindex="0" role="button" class="v2-games-button" type="button" @click="b4.refreshGame">{{ mobileT('games.actions.refresh') }}</button>
            <button tabindex="0" role="button" class="v2-games-button v2-games-button--danger" type="button" @click="b4.finishGame">{{ mobileT('games.actions.finish') }}</button>
          </view>
        </view>

        <text v-if="isPaused" class="v2-games-note">{{ mobileT('games.paused.note') }}</text>

        <view class="v2-games-tips">
          <view class="v2-games-tip">
            <image class="v2-games-tip__dot" src="/static/figma-games-no-items-169-5811/0d6fa31c-6c03-4359-9e5f-9ee9b72f43d8.svg" mode="aspectFit" aria-hidden="true" />
            <view class="v2-games-tip__copy"><text class="v2-games-tip__title">{{ mobileT(isPaused ? 'games.paused.tipProgressTitle' : 'games.noItems.tipTodayTitle') }}</text><text class="v2-games-tip__desc">{{ mobileT(isPaused ? 'games.paused.tipProgressDesc' : 'games.noItems.tipTodayDesc') }}</text></view>
          </view>
          <view class="v2-games-tip">
            <image class="v2-games-tip__dot" src="/static/figma-games-no-items-169-5811/018fa2ef-96d4-46cf-b3e9-5afa6d8a77a5.svg" mode="aspectFit" aria-hidden="true" />
            <view class="v2-games-tip__copy"><text class="v2-games-tip__title">{{ mobileT(isPaused ? 'games.paused.tipBreakTitle' : 'games.noItems.tipCoursesTitle') }}</text><text class="v2-games-tip__desc">{{ mobileT(isPaused ? 'games.paused.tipBreakDesc' : 'games.noItems.tipCoursesDesc') }}</text></view>
          </view>
          <view v-if="!isPaused" class="v2-games-tip">
            <image class="v2-games-tip__dot" src="/static/figma-games-no-items-169-5811/73c59544-664d-49be-98b9-7db6bf986f54.svg" mode="aspectFit" aria-hidden="true" />
            <view class="v2-games-tip__copy"><text class="v2-games-tip__title">{{ mobileT('games.noItems.tipModulesTitle') }}</text><text class="v2-games-tip__desc">{{ mobileT('games.noItems.tipModulesDesc') }}</text></view>
          </view>
        </view>
      </view>

      <view v-else-if="showSettlement" class="v2-games-settlement" data-state="settlement">
        <view class="v2-games-result">
          <view class="v2-games-result__tile">
            <image class="v2-games-result__trophy" src="/static/figma-games-settlement-169-5726/0f94cabc-1908-482b-898a-18086998a59c.svg" mode="aspectFit" aria-hidden="true" />
          </view>
          <text class="v2-games-result__title">{{ mobileT(b4.lastGameResult?.passed ? 'games.settlement.passed' : 'games.settlement.retry') }}</text>
          <text class="v2-games-result__subtitle">{{ mobileT('games.settlement.subtitle') }}</text>
          <view class="v2-games-stats">
            <view class="v2-games-stat"><text class="v2-games-stat__value v2-games-stat__value--ok">{{ b4.lastGameResult?.accuracyPercent }}%</text><text class="v2-games-stat__label">{{ mobileT('games.settlement.accuracy') }}</text></view>
            <view class="v2-games-stat"><text class="v2-games-stat__value v2-games-stat__value--brand">{{ b4.lastGameResult?.completionPercent }}%</text><text class="v2-games-stat__label">{{ mobileT('games.settlement.completion') }}</text></view>
            <view class="v2-games-stat"><text class="v2-games-stat__value v2-games-stat__value--warn">{{ b4.lastGameResult?.serverScore }}</text><text class="v2-games-stat__label">{{ mobileT('games.settlement.score') }}</text></view>
          </view>
          <view class="v2-games-reward">
            <image class="v2-games-reward__icon" src="/static/figma-games-settlement-169-5726/f5f3ca60-5b1d-4c03-a5e4-90321f52faa1.svg" mode="aspectFit" aria-hidden="true" />
            <text class="v2-games-reward__copy">{{ mobileT(b4.lastGameResult?.rewardEligible ? 'games.settlement.reward' : 'games.settlement.noReward') }}</text>
          </view>
        </view>

        <view class="v2-games-tips">
          <view class="v2-games-tip">
            <image class="v2-games-tip__dot" src="/static/figma-games-settlement-169-5726/f8cddec0-cfad-46e7-9411-7baf2906931b.svg" mode="aspectFit" aria-hidden="true" />
            <view class="v2-games-tip__copy"><text class="v2-games-tip__title">{{ mobileT('games.settlement.tipReviewTitle') }}</text><text class="v2-games-tip__desc">{{ mobileT('games.settlement.tipReviewDesc') }}</text></view>
          </view>
          <view class="v2-games-tip">
            <image class="v2-games-tip__dot" src="/static/figma-games-settlement-169-5726/b58084ac-ea82-4f36-a95f-6a478c404ac8.svg" mode="aspectFit" aria-hidden="true" />
            <view class="v2-games-tip__copy"><text class="v2-games-tip__title">{{ mobileT('games.settlement.tipOtherTitle') }}</text><text class="v2-games-tip__desc">{{ mobileT('games.settlement.tipOtherDesc') }}</text></view>
          </view>
        </view>
      </view>

      <template v-else-if="showCatalog">
        <view class="v2-games-banner">
          <image class="v2-games-banner__icon" src="/static/figma-games-catalog-169-5353/bd20b178-9580-43ff-9989-6e59b54d526d.svg" mode="aspectFit" aria-hidden="true" />
          <text class="v2-games-banner__copy">{{ mobileT('games.catalog.banner') }}</text>
        </view>
        <view class="v2-games-grid">
          <view v-for="game in b4.games" :key="game.gameCode" class="v2-games-card" :data-game-code="game.gameCode">
            <view class="v2-games-tile" :class="gameTone(game.gameCode)">
              <image class="v2-games-tile__icon" :src="gameIcon(game.gameCode)" mode="aspectFit" aria-hidden="true" />
            </view>
            <text class="v2-games-card__name">{{ gameTitle(game.gameCode) }}</text>
            <text class="v2-games-tag" data-coming-soon>{{ mobileT('games.status.comingSoon') }}</text>
            <text class="v2-games-card__reason" data-closed-reason>{{ gameClosedReason(game.enabled) }}</text>
          </view>
        </view>
      </template>

      <view v-else class="v2-games-state" role="status" data-state="empty">
        <view class="v2-games-badge v2-games-badge--large">
          <image class="v2-games-badge__icon v2-games-badge__icon--large" src="/static/figma-games-empty-169-5475/2529c60e-f1dd-4920-83bf-31e9d9f53fe0.svg" mode="aspectFit" aria-hidden="true" />
        </view>
        <text class="v2-games-state__title">{{ mobileT('games.catalog.emptyTitle') }}</text>
        <text class="v2-games-state__desc">{{ mobileT('games.catalog.emptyDesc') }}</text>
      </view>

      <view v-if="showBottomCta" class="v2-games-cta-wrap">
        <button tabindex="0" role="button" class="v2-games-button v2-games-button--primary v2-games-cta" type="button" @click="primaryAction">
          {{ mobileT(b4.activeGame ? (isPaused ? 'games.actions.resume' : 'games.actions.refresh') : showSettlement ? 'games.settlement.backToHall' : showEmpty ? 'games.actions.emptyPractice' : 'games.actions.practice') }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-games-page{--games-tile-fallback-from:var(--v2-brand2);--games-tile-fallback-to:var(--v2-brand)}
.v2-games-page.v2-games-page{position:relative;box-sizing:border-box;max-width:100%;min-width:0;overflow-x:hidden;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 45%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-games-glow{position:absolute;top:-140px;right:-300px;display:block;width:540px;height:480px;pointer-events:none;opacity:.85}
.v2-games-body{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-height:calc(100vh - 190px);width:100%;min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-games-intro{display:flex;flex-direction:column;gap:var(--v2-space-1);padding-top:var(--v2-space-2)}
.v2-games-intro__title{display:block;color:var(--v2-ink);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-games-intro__subtitle{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:22px;overflow-wrap:anywhere}
.v2-games-utility{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);flex-wrap:wrap;box-sizing:border-box;min-width:0;max-width:100%}
.v2-games-quality{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-xs);line-height:1.5}
.v2-games-quality__value{display:inline-flex;align-items:center;min-height:44px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700}
.v2-games-queue{display:flex;align-items:center;gap:var(--v2-space-2);min-width:0;max-width:100%;color:var(--v2-warn);font-size:var(--v2-text-xs)}
.v2-games-queue__action{min-height:36px;margin:0;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700;line-height:1.5}
.v2-games-state{display:flex;flex-direction:column;align-items:center;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;margin:auto 0;padding:24px 20px;border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow);text-align:center}
.v2-games-mascot{display:block;width:120px;height:120px;flex:none}
.v2-games-state__title{display:block;color:var(--v2-ink);font-size:22px;font-weight:700;line-height:32px;text-align:center;overflow-wrap:anywhere}
.v2-games-state__desc{display:block;color:var(--v2-mut);font-size:15px;line-height:24px;text-align:center;overflow-wrap:anywhere}
.v2-games-state__detail{display:block;max-width:100%;color:var(--v2-bad);font-size:var(--v2-text-xs);line-height:1.5;overflow-wrap:anywhere}
.v2-games-badge{display:flex;align-items:center;justify-content:center;flex:none;width:56px;height:56px;border-radius:28px;background:var(--v2-surface)}
.v2-games-badge--large{width:96px;height:96px;border-radius:48px}
.v2-games-badge__icon{display:block;width:26px;height:26px}
.v2-games-badge__icon--large{width:44px;height:44px}
.v2-games-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:48px;margin:0;padding:14px 20px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-soft);color:var(--v2-brand);font-size:16px;font-weight:700;line-height:1.5;white-space:normal}
.v2-games-button--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-games-button--danger{color:var(--v2-bad);background:var(--v2-bad-soft);border-color:var(--v2-bad-soft)}
.v2-games-button:disabled{opacity:.6}
.v2-games-button:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-games-cta-wrap{position:fixed;left:50%;bottom:0;z-index:3;display:flex;box-sizing:border-box;width:100%;max-width:860px;transform:translateX(-50%);padding:var(--v2-space-3) var(--v2-space-5) calc(var(--v2-space-2) + env(safe-area-inset-bottom));border-top:1px solid var(--v2-line);background:var(--v2-card)}
.v2-games-cta{width:100%}
.v2-games-active,.v2-games-settlement{display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-width:0;max-width:100%}
.v2-games-board,.v2-games-result{display:flex;flex-direction:column;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;padding:18px 20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-games-board__head{display:flex;align-items:center;gap:var(--v2-space-3);min-width:0;max-width:100%}
.v2-games-board__copy{display:flex;flex-direction:column;gap:2px;flex:1 1 auto;min-width:0}
.v2-games-board__name{display:block;color:var(--v2-ink);font-size:17px;font-weight:700;line-height:24px;overflow-wrap:anywhere}
.v2-games-board__meta{display:block;color:var(--v2-mut);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.v2-games-status{display:inline-flex;align-items:center;flex:none;padding:3px 10px;border-radius:var(--v2-radius-pill);font-size:12px;font-weight:700;line-height:18px;white-space:nowrap}
.v2-games-status--ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-games-status--warn{background:var(--v2-warn-soft);color:var(--v2-warn)}
.v2-games-tile{display:flex;align-items:center;justify-content:center;flex:none;width:48px;height:48px;border-radius:15px;background:linear-gradient(128.66deg,var(--games-tile-from,var(--games-tile-fallback-from)) 7.4%,var(--games-tile-to,var(--games-tile-fallback-to)) 81.5%)}
.v2-games-tile--small{width:40px;height:40px;border-radius:13px}
.v2-games-tile__icon{display:block;width:24px;height:24px}
.v2-games-tile--small .v2-games-tile__icon{width:20px;height:20px}
.v2-games-tile--sentence{--games-tile-from:var(--games-tile-sentence-from,var(--v2-brand2));--games-tile-to:var(--games-tile-sentence-to,var(--v2-brand))}
.v2-games-tile--match{--games-tile-from:var(--games-tile-match-from,var(--v2-brand2));--games-tile-to:var(--games-tile-match-to,var(--v2-bad))}
.v2-games-tile--defense{--games-tile-from:var(--games-tile-defense-from,var(--v2-ok));--games-tile-to:var(--games-tile-defense-to,var(--v2-info))}
.v2-games-tile--puzzle{--games-tile-from:var(--games-tile-puzzle-from,var(--v2-warn));--games-tile-to:var(--games-tile-puzzle-to,var(--v2-bad))}
.v2-games-tile--grammar{--games-tile-from:var(--games-tile-grammar-from,var(--v2-info));--games-tile-to:var(--games-tile-grammar-to,var(--v2-brand))}
.v2-games-tile--meaning{--games-tile-from:var(--games-tile-meaning-from,var(--v2-warn));--games-tile-to:var(--games-tile-meaning-to,var(--v2-brand2))}
.v2-games-no-items{display:flex;flex-direction:column;align-items:center;gap:var(--v2-space-2);padding:18px 14px;border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-surface);text-align:center}
.v2-games-no-items__title{display:block;color:var(--v2-ink);font-size:16px;font-weight:700;line-height:22px}
.v2-games-no-items__desc{display:block;color:var(--v2-mut);font-size:12px;line-height:18px}
.v2-games-actions{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-games-actions .v2-games-button{flex:1 1 140px;min-width:0}
.v2-games-note{display:block;color:var(--v2-mut);font-size:12px;line-height:18px}
.v2-games-tips{display:flex;flex-direction:column;gap:var(--v2-space-3);min-width:0;max-width:100%}
.v2-games-tip{display:flex;align-items:flex-start;gap:10px;box-sizing:border-box;min-width:0;padding:14px 16px;border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-games-tip__dot{display:block;flex:none;width:8px;height:8px;margin-top:6px}
.v2-games-tip__copy{display:flex;flex-direction:column;gap:4px;min-width:0}
.v2-games-tip__title{display:block;color:var(--v2-ink);font-size:14px;font-weight:700;line-height:20px;overflow-wrap:anywhere}
.v2-games-tip__desc{display:block;color:var(--v2-mut);font-size:13px;line-height:18px;overflow-wrap:anywhere}
.v2-games-result{align-items:center;text-align:center;padding:24px 20px 20px}
.v2-games-result__tile{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:23px;background:linear-gradient(128.66deg,var(--games-result-from,var(--v2-warn)) 7.4%,var(--games-result-to,var(--v2-bad)) 81.5%)}
.v2-games-result__trophy{display:block;width:36px;height:36px}
.v2-games-result__title{display:block;color:var(--v2-ink);font-size:24px;font-weight:700;line-height:32px}
.v2-games-result__subtitle{display:block;color:var(--v2-mut);font-size:12px;line-height:18px}
.v2-games-stats{display:flex;gap:10px;width:100%;min-width:0}
.v2-games-stat{display:flex;flex:1 1 0;flex-direction:column;align-items:center;gap:2px;min-width:0;padding:14px 12px;border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-games-stat__value{display:block;font-size:22px;font-weight:700;line-height:30px}
.v2-games-stat__value--ok{color:var(--v2-ok)}
.v2-games-stat__value--brand{color:var(--v2-brand)}
.v2-games-stat__value--warn{color:var(--v2-warn)}
.v2-games-stat__label{display:block;color:var(--v2-mut);font-size:12px;line-height:18px;text-align:center}
.v2-games-reward{display:flex;align-items:center;justify-content:center;gap:6px;width:100%;min-width:0}
.v2-games-reward__icon{display:block;flex:none;width:16px;height:16px}
.v2-games-reward__copy{display:block;color:var(--v2-brand);font-size:13px;line-height:20px;text-align:left;overflow-wrap:anywhere}
.v2-games-banner{display:flex;align-items:center;gap:10px;box-sizing:border-box;min-height:44px;min-width:0;padding:12px 14px;border-radius:16px;background:var(--v2-soft)}
.v2-games-banner__icon{display:block;flex:none;width:18px;height:18px}
.v2-games-banner__copy{display:block;color:var(--v2-brand);font-size:13px;line-height:20px;overflow-wrap:anywhere}
.v2-games-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;min-width:0;max-width:100%}
.v2-games-card{display:flex;flex-direction:column;align-items:flex-start;gap:10px;box-sizing:border-box;min-width:0;padding:16px 14px;border:1px solid var(--v2-line);border-radius:22px;background:var(--v2-card)}
.v2-games-card__name{display:block;color:var(--v2-ink);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-games-tag{display:inline-flex;align-items:center;padding:3px 10px;border-radius:var(--v2-radius-pill);background:var(--v2-bg);color:var(--v2-mut);font-size:12px;font-weight:700;line-height:18px;white-space:nowrap}
.v2-games-card__reason{display:block;color:var(--v2-mut);font-size:11px;line-height:16px;overflow-wrap:anywhere}
.v2-games-body{padding-bottom:calc(76px + env(safe-area-inset-bottom))}
.v2-games-body .v2-games-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:48px;margin:0;padding:14px 20px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-soft);color:var(--v2-brand);font-size:16px;font-weight:700;line-height:1.5;white-space:normal}
.v2-games-body .v2-games-button--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-games-body .v2-games-button--danger{color:var(--v2-bad);background:var(--v2-bad-soft);border-color:var(--v2-bad-soft)}
.v2-games-body .v2-games-button:disabled{opacity:.6}
.v2-games-body .v2-games-button:focus-visible{box-shadow:var(--v2-focus);outline:none}
.v2-games-body .v2-games-cta{width:100%}
@media(max-width:360px){.v2-games-page.yx-page{padding-inline:16px}.v2-games-intro__title{font-size:24px;line-height:32px}.v2-games-grid{grid-template-columns:minmax(0,1fr)}.v2-games-state{padding:20px 14px}.v2-games-mascot{width:96px;height:96px}.v2-games-stats{gap:6px}.v2-games-stat{padding:12px 6px}.v2-games-stat__value{font-size:20px}}
:global(:root[data-theme="high-contrast"] .v2-games-button--primary), :global(:root[data-theme="high-contrast"] .v2-social-button--primary){color:var(--v2-side)}
@media(prefers-contrast:more){.v2-games-card,.v2-games-board,.v2-games-result,.v2-games-state,.v2-games-tip{border-color:var(--v2-ink)}}
@media(prefers-reduced-motion:reduce){.v2-games-button{transition:none}}
</style>
