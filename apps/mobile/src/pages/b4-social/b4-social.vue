<script setup lang="ts">
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n, mobileThemeController } from '../../platform/v2-foundation'
const { experienceStyle, experienceMotion } = useMobileExperience()

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import B12SocialExtensions from '../../components/b12/B12SocialExtensions.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { B4_PERFORMANCE_LEVELS, formatSeconds, type B4InteractionCode, type B4PerformanceLevel } from '../../domain/b4'
import { b10ThemeMode } from '../../platform/b10-foundation'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useB4Store } from '../../stores/b4'
import { useSessionStore } from '../../stores/session'

const session = useSessionStore()
const b4 = useB4Store()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
let unsubscribeTheme: (() => void) | undefined
const accessBlocked = ref(false)
const completedDismissed = ref(false)
const interactionCode = ref<B4InteractionCode>('CHEER_UP')
const focusMinutes = ref<25 | 45>(25)
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
const QUALITY_KEYS: Record<B4PerformanceLevel, string> = { Ultra: 'qualityUltra', High: 'qualityHigh', Medium: 'qualityMedium', Performance: 'qualityPerformance' }
const INTERACTION_KEYS: Record<B4InteractionCode, string> = { CHEER_UP: 'social.interaction.cheerUp', STUDY_TOGETHER: 'social.interaction.studyTogether', CONGRATS: 'social.interaction.congrats', TRY_AGAIN: 'social.interaction.tryAgain', TONIGHT_20_MIN: 'social.interaction.tonight20' }
const NOTICE_KEYS: Record<string, string> = { REVIEW_DUE: 'social.notifications.type.review', LEARNING_PLAN: 'social.notifications.type.plan', ROOM_INTERACTIONS: 'social.notifications.type.room', FOCUS_REMINDERS: 'social.notifications.type.focus', SYSTEM: 'social.notifications.type.system' }
const ROOM_TEMPLATE_KEYS: Record<string, string> = { FOCUS: 'social.rooms.template.focus', STUDY: 'social.rooms.template.study' }
const ROOM_CHAT_KEYS: Record<string, string> = { PRESET_ONLY: 'social.rooms.chat.preset', DISABLED: 'social.rooms.chat.disabled' }
const FOCUS_STATUS_KEYS: Record<string, string> = { RUNNING: 'social.focus.status.running', PAUSED: 'social.focus.status.paused', COMPLETED: 'social.focus.status.completed', FINISHED: 'social.focus.status.completed', EXPIRED: 'social.focus.status.expired' }
const qualityLabels = computed(() => B4_PERFORMANCE_LEVELS.map((level) => mobileT(QUALITY_KEYS[level])))
const qualityIndex = computed(() => Math.max(0, B4_PERFORMANCE_LEVELS.indexOf(b4.performanceLevel as B4PerformanceLevel)))
const queueLabel = computed(() => interpolate(mobileT('social.utility.queue'), { count: mobileI18n.formatNumber(b4.queueCount) }))
const unreadCount = computed(() => b4.notifications.filter((item) => !item.read).length)
const joinedRoom = computed(() => b4.rooms.find((room) => room.joined) ?? null)
const focusRoom = computed(() => b4.rooms.find((room) => room.roomId === b4.activeFocus?.roomId) ?? null)
const focusSeconds = computed(() => {
  const focus = b4.activeFocus
  if (!focus) return 0
  if (focus.status !== 'RUNNING' || !focus.startedAt) return focus.serverDurationSeconds
  const start = Date.parse(focus.startedAt)
  return Number.isFinite(start) ? Math.max(focus.serverDurationSeconds, Math.floor((now.value - start) / 1000)) : focus.serverDurationSeconds
})
const focusCompleted = computed(() => b4.activeFocus?.status === 'COMPLETED' || b4.activeFocus?.status === 'FINISHED')
const showGated = computed(() => accessBlocked.value || !session.isAuthenticated)
const showLoading = computed(() => !showGated.value && b4.status === 'loading' && !b4.rooms.length && !b4.notifications.length)
const showFatalError = computed(() => !showGated.value && ['error', 'offline', 'permission'].includes(b4.status) && !b4.rooms.length && !b4.notifications.length)
const showNoRooms = computed(() => !showGated.value && !showLoading.value && !showFatalError.value && b4.rooms.length === 0 && b4.notificationStatus === 'ready')
const showIntro = computed(() => !b4.activeFocus && !focusCompleted.value)
const showContent = computed(() => !showGated.value && !showLoading.value && !showFatalError.value && !showNoRooms.value)
const showFocusPanel = computed(() => Boolean(b4.activeFocus) && !completedDismissed.value)
const stateName = computed(() => {
  if (showGated.value) return 'gated'
  if (showLoading.value) return 'loading'
  if (showFatalError.value) return 'error'
  if (showNoRooms.value) return 'no-rooms'
  if (focusCompleted.value && !completedDismissed.value) return 'completed'
  if (b4.activeFocus?.status === 'PAUSED') return 'paused'
  if (b4.activeFocus?.status === 'RUNNING') return 'focus'
  if (joinedRoom.value) return 'joined'
  if (b4.rooms.length) return 'rooms'
  return 'notifications'
})
const glowSrc = computed(() => {
  if (showGated.value) return '/static/figma-social-gated-169-7496/8302e9dc-315b-4d4b-bc09-25b59fb896ba.svg'
  if (showLoading.value) return '/static/figma-social-loading-169-6359/43db01a4-e610-421b-a658-93fd6851f980.svg'
  if (showFatalError.value) return '/static/figma-social-error-169-6434/098b5ff2-ca00-4615-a1ce-91480700d999.svg'
  if (showNoRooms.value) return '/static/figma-social-no-rooms-169-6809/f7660161-4f74-4113-aa80-fa9f1b087041.svg'
  if (focusCompleted.value) return '/static/figma-social-completed-169-7228/a8ff0045-5a8f-4f1f-92a5-c8ff3e7c8b84.svg'
  if (b4.activeFocus) return '/static/figma-social-focus-169-7071/10fc40f1-29a3-478c-b43b-2b63b98efa39.svg'
  if (joinedRoom.value) return '/static/figma-social-joined-169-6985/c9620990-0cf7-4d93-ab37-97ab16b9e2d2.svg'
  return '/static/figma-social-rooms-169-6882/3c246442-ffcb-4e13-8fff-0e4fac010522.svg'
})

watch(() => b4.activeFocus?.sessionId, () => { completedDismissed.value = false }, { flush: 'sync' })
onShow(async () => {
  const allowed = await ensureMobilePageAccess('/pages/b4-social/b4-social')
  accessBlocked.value = !allowed
  if (!allowed) return
  b4.restore()
  if (!b4.rooms.length) void b4.loadWorld()
})
onMounted(() => {
  timer = setInterval(() => { now.value = Date.now() }, 1000)
  unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
  unsubscribeTheme?.()
  unsubscribeTheme = undefined
})

function selectPerformance(event: { detail: { value: number } }): void {
  const level = B4_PERFORMANCE_LEVELS[Number(event.detail.value)]
  if (level) b4.setPerformance(level)
}
function qualityLabel(level: B4PerformanceLevel): string { return mobileT(QUALITY_KEYS[level]) }
function syncQueue(): void { void b4.syncOffline() }
function openLogin(): void { getUniRuntime().navigateTo({ url: '/pages/login/login' }) }
function openPractice(): void { getUniRuntime().navigateTo({ url: '/pages/practice/practice' }) }
function noticeType(item: { category: string | null }): string { return mobileT(NOTICE_KEYS[item.category ?? ''] ?? 'social.notifications.type.system') }
function noticeMeta(item: { category: string | null; createdAt: string | null }): string {
  const time = item.createdAt ? Date.parse(item.createdAt) : NaN
  if (!Number.isFinite(time)) return noticeType(item)
  return `${noticeType(item)} · ${mobileI18n.formatDate(time, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}
function noticeIcon(category: string | null): string {
  if (category === 'REVIEW_DUE') return '/static/figma-social-notifications-169-6585/d708c33c-1bad-4a59-ad31-5c045c35da1d.svg'
  if (category === 'ROOM_INTERACTIONS') return '/static/figma-social-notifications-169-6585/44e4b26f-493d-4a2b-918e-fac21792fa4b.svg'
  if (category === 'SYSTEM') return '/static/figma-social-notifications-169-6585/a86af758-7618-4d9c-9f1c-638af0d5eb6a.svg'
  return '/static/figma-social-empty-169-6504/1749002f-0b22-47c4-961e-db8f108c75c5.svg'
}
function roomTemplate(value: string): string { return mobileT(ROOM_TEMPLATE_KEYS[value] ?? 'social.rooms.template.study') }
function roomChat(value: string): string { return mobileT(ROOM_CHAT_KEYS[value] ?? 'social.rooms.chat.preset') }
function roomMeta(room: { templateCode: string; memberCount: number; capacity: number; chatMode: string }): string {
  return `${roomTemplate(room.templateCode)} · ${mobileI18n.formatNumber(room.memberCount)} / ${mobileI18n.formatNumber(room.capacity)} · ${roomChat(room.chatMode)}`
}
function focusStatus(value: string): string { return mobileT(FOCUS_STATUS_KEYS[value] ?? 'social.focus.status.running') }
function interactionLabel(code: B4InteractionCode): string { return mobileT(INTERACTION_KEYS[code]) }
function send(roomId: string): void { void b4.sendInteraction(roomId, interactionCode.value) }
function finishFocus(): void { void b4.updateFocus('COMPLETE') }
function backToRooms(): void { completedDismissed.value = true }
function markRead(messageId: string): void { void b4.readNotification(messageId) }
function markAllRead(): void { void b4.readAllNotifications() }
</script>

<template>
  <view class="yx-page v2-social-page" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="resolvedTheme" :class="themeClass">
    <MobilePageHeader page="b4-social" compact :title="mobileT('social.navTitle')" back-icon-src="/static/figma-social-rooms-169-6882/14ab6b99-f06b-4dae-b2ca-46361c7db5e3.svg" :show-settings="false" />
    <view class="v2-social-glow-wrap" aria-hidden="true"><image class="v2-social-glow" :src="glowSrc" mode="scaleToFill" /></view>

    <view class="v2-social-body" :data-social-state="stateName">
      <view v-if="showIntro" class="v2-social-intro">
        <text class="v2-social-intro__title">{{ mobileT('social.title') }}</text>
        <text class="v2-social-intro__subtitle">{{ mobileT('social.subtitle') }}</text>
      </view>

      <view v-if="!showGated && !b4.activeFocus" class="v2-social-utility">
        <view class="v2-social-quality" role="group" :aria-label="mobileT('social.utility.quality')">
          <text class="v2-social-quality__label">{{ mobileT('social.utility.quality') }}</text>
          <picker :range="qualityLabels" :value="qualityIndex" @change="selectPerformance"><view class="v2-social-quality__value">{{ qualityLabel(b4.performanceLevel as B4PerformanceLevel) }}</view></picker>
        </view>
        <view v-if="b4.queueCount" class="v2-social-queue" role="status">
          <text>{{ queueLabel }}</text>
          <button tabindex="0" role="button" class="v2-social-button v2-social-button--small" type="button" @click="syncQueue">{{ mobileT('social.actions.sync') }}</button>
        </view>
      </view>

      <view v-if="showGated" class="v2-social-state" data-state="gated">
        <view class="v2-social-badge v2-social-badge--warn"><image class="v2-social-badge__icon" src="/static/figma-social-gated-169-7496/52b3a28b-a6cf-4e9e-bfcb-b8f7a8b195f0.svg" mode="aspectFit" aria-hidden="true" /></view>
        <text class="v2-social-state__title">{{ mobileT('social.gated.title') }}</text>
        <text class="v2-social-state__desc">{{ mobileT('social.gated.desc') }}</text>
        <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="openLogin">{{ mobileT('social.actions.login') }}</button>
      </view>

      <view v-else-if="showLoading" class="v2-social-state" data-state="loading">
        <text class="v2-social-state__title">{{ mobileT('social.loading.title') }}</text>
        <text class="v2-social-state__desc">{{ mobileT('social.loading.desc') }}</text>
        <text class="v2-social-state__hint">{{ mobileT('social.loading.hint') }}</text>
      </view>

      <view v-else-if="showFatalError" class="v2-social-state" data-state="error">
        <view class="v2-social-badge v2-social-badge--warn"><image class="v2-social-badge__icon" src="/static/figma-social-error-169-6434/9023a783-38d3-479f-b825-fc88302dc370.svg" mode="aspectFit" aria-hidden="true" /></view>
        <text class="v2-social-state__title">{{ mobileT('social.error.title') }}</text>
        <text class="v2-social-state__desc">{{ b4.lastError ?? mobileT('social.error.desc') }}</text>
        <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="b4.loadWorld">{{ mobileT('social.actions.retry') }}</button>
      </view>

      <view v-else-if="showNoRooms" class="v2-social-state" data-state="no-rooms">
        <view class="v2-social-badge"><image class="v2-social-badge__icon" src="/static/figma-social-no-rooms-169-6809/533b99da-b4bf-4e00-abae-b371a218267c.svg" mode="aspectFit" aria-hidden="true" /></view>
        <text class="v2-social-state__title">{{ mobileT('social.rooms.emptyTitle') }}</text>
        <text class="v2-social-state__desc">{{ mobileT('social.rooms.emptyDesc') }}</text>
        <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="openPractice">{{ mobileT('social.actions.practice') }}</button>
      </view>

      <template v-else-if="showContent">
        <view class="v2-social-card v2-social-notifications" data-section="notifications">
          <view class="v2-social-head">
            <text class="v2-social-card__title">{{ mobileT('social.notifications.title') }}</text>
            <view class="v2-social-head__actions">
              <text v-if="b4.notificationStatus === 'ready'" class="v2-social-muted">{{ interpolate(mobileT('social.notifications.unread'), { count: mobileI18n.formatNumber(unreadCount) }) }}</text>
              <button tabindex="0" role="button" v-if="b4.notificationStatus === 'ready' && unreadCount" class="v2-social-textbutton" type="button" @click="markAllRead">{{ mobileT('social.notifications.readAll') }}</button>
            </view>
          </view>
          <view v-if="b4.notificationStatus === 'loading'" class="v2-social-notice-state" role="status">{{ mobileT('social.notifications.loading') }}</view>
          <view v-else-if="b4.notificationStatus === 'error'" class="v2-social-notice-state" role="alert">
            <image class="v2-social-notice-state__icon" src="/static/figma-social-error-169-6434/9023a783-38d3-479f-b825-fc88302dc370.svg" mode="aspectFit" aria-hidden="true" />
            <text>{{ mobileT('social.notifications.error') }}</text>
            <button tabindex="0" role="button" class="v2-social-textbutton" type="button" @click="b4.loadWorld">{{ mobileT('social.actions.retry') }}</button>
          </view>
          <view v-else-if="b4.notifications.length" class="v2-social-list">
            <view v-for="item in b4.notifications" :key="item.messageId" class="v2-social-notice" :class="{ 'v2-social-notice--unread': !item.read }">
              <image class="v2-social-notice__icon" :src="noticeIcon(item.category)" mode="aspectFit" aria-hidden="true" />
              <view class="v2-social-notice__copy">
                <text class="v2-social-notice__title">{{ item.title }}</text>
                <text v-if="item.body" class="v2-social-muted">{{ item.body }}</text>
                <text class="v2-social-muted">{{ noticeMeta(item) }}</text>
              </view>
              <image v-if="!item.read" class="v2-social-unread" src="/static/figma-social-notifications-169-6585/ef1d816f-a569-4cb3-bd51-6dcc68d8d13d.svg" mode="aspectFit" aria-hidden="true" />
              <button v-if="!item.read" tabindex="0" role="button" class="v2-social-textbutton" type="button" @click="markRead(item.messageId)">{{ mobileT('social.notifications.markRead') }}</button>
            </view>
          </view>
          <view v-else class="v2-social-notice-state">
            <image class="v2-social-notice-state__icon" src="/static/figma-social-empty-169-6504/1749002f-0b22-47c4-961e-db8f108c75c5.svg" mode="aspectFit" aria-hidden="true" />
            <text>{{ mobileT('social.notifications.empty') }}</text>
          </view>
          <text v-if="b4.notificationStatus === 'ready' && !unreadCount && b4.notifications.length" class="v2-social-allread">{{ mobileT('social.notifications.allRead') }}</text>
        </view>

        <view v-if="joinedRoom && (!b4.activeFocus || (focusCompleted && completedDismissed))" class="v2-social-card v2-social-joined" data-section="joined">
          <view class="v2-social-roomhead">
            <view class="v2-social-tile"><image class="v2-social-tile__icon" src="/static/figma-social-joined-169-6985/4cbe8327-c227-4234-a471-21a19d2e04ca.svg" mode="aspectFit" aria-hidden="true" /></view>
            <view class="v2-social-roomcopy"><text class="v2-social-roomname">{{ joinedRoom.name }}</text><text class="v2-social-muted">{{ roomMeta(joinedRoom) }}</text></view>
            <text class="v2-social-status v2-social-status--ok">{{ mobileT('social.rooms.joined') }}</text>
          </view>
          <text class="v2-social-subtitle">{{ mobileT('social.interaction.title') }}</text>
          <text class="v2-social-muted">{{ mobileT('social.interaction.desc') }}</text>
          <view class="v2-social-chips">
            <button v-for="code in (['CHEER_UP', 'STUDY_TOGETHER', 'CONGRATS', 'TRY_AGAIN', 'TONIGHT_20_MIN'] as B4InteractionCode[])" :key="code" tabindex="0" role="button" class="v2-social-chip" :class="{ 'v2-social-chip--active': interactionCode === code }" type="button" @click="interactionCode = code">{{ interactionLabel(code) }}</button>
          </view>
          <view class="v2-social-actions">
            <button tabindex="0" role="button" class="v2-social-button" type="button" @click="send(joinedRoom.roomId)">{{ mobileT('social.actions.sendEncouragement') }}</button>
            <picker :range="[25, 45]" :value="focusMinutes === 25 ? 0 : 1" @change="focusMinutes = [25, 45][$event.detail.value] as 25 | 45"><view class="v2-social-button">{{ interpolate(mobileT('social.focus.minutes'), { count: mobileI18n.formatNumber(focusMinutes) }) }}</view></picker>
            <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="b4.startFocus(joinedRoom.roomId, focusMinutes)">{{ mobileT('social.actions.startFocus') }}</button>
          </view>
        </view>

        <view v-if="showFocusPanel" class="v2-social-card v2-social-focus" data-section="focus">
          <view class="v2-social-head">
            <text class="v2-social-card__title">{{ mobileT('social.focus.title') }}</text>
            <text class="v2-social-status" :class="b4.activeFocus?.status === 'PAUSED' ? 'v2-social-status--warn' : 'v2-social-status--ok'">{{ focusStatus(b4.activeFocus?.status ?? '') }}</text>
          </view>
          <view v-if="focusCompleted" class="v2-social-completed">
            <image class="v2-social-mascot" src="/static/figma-social-completed-169-7228/ec769a54-c207-40a0-b4ea-26cf65490040.svg" mode="aspectFit" aria-hidden="true" />
            <text class="v2-social-state__title">{{ mobileT('social.completed.title') }}</text>
            <text class="v2-social-state__desc">{{ interpolate(mobileT('social.completed.desc'), { count: mobileI18n.formatNumber(Math.max(1, Math.round(focusSeconds / 60))) }) }}</text>
            <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="backToRooms">{{ mobileT('social.actions.backToRooms') }}</button>
          </view>
          <template v-else>
            <view class="v2-social-timerwrap">
              <image class="v2-social-track" src="/static/figma-social-focus-169-7071/25824688-8635-454f-9eb3-a88753e220f1.svg" mode="aspectFit" aria-hidden="true" />
              <view class="v2-social-timercopy"><text class="v2-social-timer">{{ formatSeconds(focusSeconds) }}</text><text class="v2-social-muted">{{ focusRoom?.name ?? mobileT('social.focus.roomMissing') }}</text></view>
            </view>
            <text class="v2-social-muted">{{ mobileT('social.focus.serverNote') }}</text>
            <view class="v2-social-actions">
              <button tabindex="0" role="button" class="v2-social-button" type="button" @click="b4.updateFocus(b4.activeFocus?.status === 'PAUSED' ? 'RESUME' : 'PAUSE')">{{ mobileT(b4.activeFocus?.status === 'PAUSED' ? 'social.actions.resumeFocus' : 'social.actions.pauseFocus') }}</button>
              <button tabindex="0" role="button" class="v2-social-button v2-social-button--primary" type="button" @click="finishFocus">{{ mobileT('social.actions.completeFocus') }}</button>
            </view>
            <text class="v2-social-muted">{{ mobileT(b4.activeFocus?.status === 'PAUSED' ? 'social.focus.pausedNote' : 'social.focus.note') }}</text>
          </template>
        </view>

        <view v-if="b4.rooms.length && (!b4.activeFocus || (focusCompleted && completedDismissed))" class="v2-social-rooms" data-section="rooms">
          <view class="v2-social-head"><text class="v2-social-section-title">{{ mobileT('social.rooms.title') }}</text><text class="v2-social-muted">{{ interpolate(mobileT('social.rooms.count'), { count: mobileI18n.formatNumber(b4.rooms.length) }) }}</text></view>
          <view class="v2-social-list">
            <view v-for="room in b4.rooms" :key="room.roomId" class="v2-social-room">
              <view class="v2-social-tile"><image class="v2-social-tile__icon" src="/static/figma-social-rooms-169-6882/e1cb0915-5a9b-4562-a3c5-fa806aa0e2e0.svg" mode="aspectFit" aria-hidden="true" /></view>
              <view class="v2-social-roomcopy"><text class="v2-social-roomname">{{ room.name }}</text><text class="v2-social-muted">{{ roomMeta(room) }}</text></view>
              <button tabindex="0" role="button" class="v2-social-button v2-social-button--small" type="button" @click="room.joined ? b4.leaveRoom(room.roomId) : b4.joinRoom(room.roomId)">{{ mobileT(room.joined ? 'social.actions.leaveRoom' : 'social.actions.joinRoom') }}</button>
            </view>
          </view>
        </view>

        <view v-if="!b4.activeFocus" class="v2-social-tips">
          <view class="v2-social-tip"><image class="v2-social-tip__dot" src="/static/figma-social-rooms-169-6882/6326e752-11de-4f5f-8173-b6b2a977aba8.svg" mode="aspectFit" aria-hidden="true" /><view><text class="v2-social-tip__title">{{ mobileT('social.tips.roomTitle') }}</text><text class="v2-social-tip__desc">{{ mobileT('social.tips.roomDesc') }}</text></view></view>
          <view class="v2-social-tip"><image class="v2-social-tip__dot" src="/static/figma-social-rooms-169-6882/2d94bdea-f4f5-4d01-a391-c54fba8ed2c4.svg" mode="aspectFit" aria-hidden="true" /><view><text class="v2-social-tip__title">{{ mobileT('social.tips.notifyTitle') }}</text><text class="v2-social-tip__desc">{{ mobileT('social.tips.notifyDesc') }}</text></view></view>
        </view>

        <view class="v2-social-ext"><B12SocialExtensions /></view>
      </template>
    </view>
  </view>
</template>

<style scoped lang="scss">
.v2-social-page[data-resolved-theme="high-contrast"] .v2-social-glow-wrap{display:none}
.v2-social-page[data-resolved-theme="dark"] .v2-social-tile,.v2-social-page[data-resolved-theme="high-contrast"] .v2-social-tile{background:var(--yx-social-room-tile,var(--v2-ok-soft))}
.v2-social-page.v2-social-page{position:relative;box-sizing:border-box;max-width:100%;min-width:0;overflow-x:clip;background:linear-gradient(180deg,var(--v2-soft) 0%,var(--v2-bg) 45%,var(--v2-card) 100%);font-family:var(--v2-font)}
.v2-social-glow-wrap{position:absolute;top:-140px;left:150px;z-index:0;display:block;width:360px;height:300px;overflow:visible;pointer-events:none;opacity:.85;background:transparent}
.v2-social-glow{position:absolute;top:-90px;left:-90px;display:block;width:540px;height:480px;max-width:none;pointer-events:none;background:transparent}
.v2-social-body{position:relative;z-index:1;display:flex;flex-direction:column;gap:var(--v2-space-4);box-sizing:border-box;min-height:calc(100vh - 190px);width:100%;min-width:0;max-width:100%;font-family:var(--v2-font)}
.v2-social-intro{display:flex;flex-direction:column;gap:var(--v2-space-1);padding-top:var(--v2-space-2)}
.v2-social-intro__title{display:block;color:var(--v2-ink);font-size:28px;font-weight:700;line-height:36px;overflow-wrap:anywhere}
.v2-social-intro__subtitle{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:22px;overflow-wrap:anywhere}
.v2-social-utility{display:flex;align-items:center;justify-content:space-between;gap:var(--v2-space-2);flex-wrap:wrap;min-width:0;max-width:100%}
.v2-social-quality{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-mut);font-size:var(--v2-text-xs)}
.v2-social-quality__value{display:inline-flex;align-items:center;min-height:36px;padding:0 var(--v2-space-3);border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-brand);font-size:var(--v2-text-xs);font-weight:700}
.v2-social-queue{display:flex;align-items:center;gap:var(--v2-space-2);color:var(--v2-warn);font-size:var(--v2-text-xs)}
.v2-social-card,.v2-social-state{display:flex;flex-direction:column;gap:var(--v2-space-3);box-sizing:border-box;width:100%;min-width:0;padding:18px 20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-social-state{align-items:center;margin:auto 0;padding:24px 20px;text-align:center}
.v2-social-badge{display:flex;align-items:center;justify-content:center;width:72px;height:72px;border-radius:50%;background:var(--v2-soft)}
.v2-social-badge--warn{background:var(--v2-warn-soft)}
.v2-social-badge__icon{display:block;width:44px;height:44px}
.v2-social-state__title{display:block;color:var(--v2-ink);font-size:22px;font-weight:700;line-height:32px;text-align:center;overflow-wrap:anywhere}
.v2-social-state__desc{display:block;color:var(--v2-mut);font-size:15px;line-height:24px;text-align:center;overflow-wrap:anywhere}
.v2-social-state__hint{display:block;color:var(--v2-mut);font-size:12px;line-height:18px;text-align:center}
.v2-social-head{display:flex;align-items:flex-start;justify-content:space-between;gap:var(--v2-space-2);flex-wrap:wrap;min-width:0;max-width:100%}
.v2-social-head__actions{display:flex;align-items:center;gap:var(--v2-space-2);flex-wrap:wrap}
.v2-social-card__title,.v2-social-section-title{display:block;color:var(--v2-ink);font-size:18px;font-weight:700;line-height:26px;overflow-wrap:anywhere}
.v2-social-section-title{font-size:20px}
.v2-social-subtitle{display:block;color:var(--v2-ink);font-size:16px;font-weight:700;line-height:24px}
.v2-social-muted{display:block;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6;overflow-wrap:anywhere}
.v2-social-textbutton{min-height:36px;margin:0;padding:0;border:0;background:transparent;color:var(--v2-brand);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5}
.v2-social-list{display:flex;flex-direction:column;gap:0;min-width:0;max-width:100%}
.v2-social-notice{display:flex;align-items:center;gap:var(--v2-space-3);min-width:0;max-width:100%;padding:12px 0;border-top:1px solid var(--v2-line)}
.v2-social-notice .v2-social-textbutton{flex:none;white-space:nowrap;text-align:center}
.v2-social-notice:first-child{border-top:0}
.v2-social-notice__icon{display:block;flex:none;width:40px;height:40px;padding:9px;border-radius:14px;background:var(--v2-surface);box-sizing:border-box}
.v2-social-notice__copy{display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0}
.v2-social-notice__title{display:block;color:var(--v2-ink);font-size:15px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.v2-social-unread{display:block;flex:none;width:10px;height:10px}
.v2-social-notice-state{display:flex;align-items:center;gap:var(--v2-space-2);padding:18px 0;color:var(--v2-mut);font-size:var(--v2-text-sm);line-height:1.6}
.v2-social-notice-state__icon{display:block;flex:none;width:20px;height:20px}
.v2-social-allread{display:block;color:var(--v2-ok);font-size:12px;line-height:18px}
.v2-social-roomhead{display:flex;align-items:center;gap:var(--v2-space-3);min-width:0;max-width:100%}
.v2-social-tile{display:flex;align-items:center;justify-content:center;flex:none;width:44px;height:44px;border-radius:14px;background:var(--yx-social-room-tile,var(--v2-ok))}
.v2-social-tile__icon{display:block;width:22px;height:22px}
.v2-social-roomcopy{display:flex;flex:1 1 auto;flex-direction:column;gap:2px;min-width:0}
.v2-social-roomname{display:block;color:var(--v2-ink);font-size:17px;font-weight:700;line-height:24px;overflow-wrap:anywhere}
.v2-social-status{display:inline-flex;align-items:center;flex:none;padding:3px 10px;border-radius:var(--v2-radius-pill);font-size:12px;font-weight:700;line-height:18px;white-space:nowrap}
.v2-social-status--ok{background:var(--v2-ok-soft);color:var(--v2-ok)}
.v2-social-status--warn{background:var(--v2-warn-soft);color:var(--v2-warn)}
.v2-social-chips{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-social-chip{min-height:40px;margin:0;padding:0 14px;border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-ink);font-size:13px;line-height:1.4}
.v2-social-chip--active{border-color:transparent;background:var(--v2-brand);color:var(--v2-side-ink);font-weight:700}
.v2-social-actions{display:flex;flex-wrap:wrap;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-social-actions .v2-social-button{flex:1 1 140px}
.v2-social-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:48px;margin:0;padding:12px 16px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-soft);color:var(--v2-brand);font-size:15px;font-weight:700;line-height:1.5;text-align:center}
.v2-social-button--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-social-button--small{min-height:40px;padding:8px 12px;font-size:13px}
.v2-social-rooms{display:flex;flex-direction:column;gap:var(--v2-space-3);min-width:0;max-width:100%}
.v2-social-room{display:flex;align-items:center;gap:var(--v2-space-3);min-width:0;max-width:100%;padding:14px;border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-social-room .v2-social-button{flex:0 0 72px;width:72px;min-width:72px;padding:8px;white-space:nowrap;overflow-wrap:normal}
.v2-social-timerwrap{position:relative;display:flex;align-items:center;justify-content:center;width:168px;height:168px;margin:0 auto;flex:none}
.v2-social-track{position:absolute;inset:0;display:block;width:168px;height:168px}
.v2-social-timercopy{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:2px}
.v2-social-timer{display:block;color:var(--v2-ink);font-size:36px;font-weight:800;line-height:1.2;font-variant-numeric:tabular-nums}
.v2-social-completed{display:flex;flex-direction:column;align-items:center;gap:var(--v2-space-3);text-align:center}
.v2-social-mascot{display:block;width:120px;height:120px}
.v2-social-tips{display:flex;flex-direction:column;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-social-tip{display:flex;align-items:flex-start;gap:10px;padding:14px 16px;border:1px solid var(--v2-line);border-radius:18px;background:var(--v2-card);box-shadow:var(--v2-shadow)}
.v2-social-tip__dot{display:block;flex:none;width:8px;height:8px;margin-top:6px}
.v2-social-tip__title{display:block;color:var(--v2-ink);font-size:14px;font-weight:700;line-height:20px}
.v2-social-tip__desc{display:block;color:var(--v2-mut);font-size:13px;line-height:18px}
.v2-social-ext{display:grid;gap:var(--v2-space-2);min-width:0;max-width:100%}
.v2-social-body .v2-social-textbutton{min-height:36px;margin:0;padding:0;border:0;background:transparent;color:var(--v2-brand);font-size:var(--v2-text-sm);font-weight:700;line-height:1.5}
.v2-social-body .v2-social-chip{min-height:40px;margin:0;padding:0 14px;border:1px solid var(--v2-line);border-radius:var(--v2-radius-pill);background:var(--v2-card);color:var(--v2-ink);font-size:13px;line-height:1.4}
.v2-social-body .v2-social-chip--active{border-color:transparent;background:var(--v2-brand);color:var(--v2-side-ink);font-weight:700}
.v2-social-body .v2-social-button{display:flex;align-items:center;justify-content:center;box-sizing:border-box;min-height:48px;margin:0;padding:12px 16px;border:1px solid var(--v2-line);border-radius:14px;background:var(--v2-soft);color:var(--v2-brand);font-size:15px;font-weight:700;line-height:1.5;text-align:center}
.v2-social-body .v2-social-button--primary{border-color:transparent;background:var(--v2-grad);color:var(--v2-side-ink);box-shadow:var(--v2-shadow)}
.v2-social-body .v2-social-button--small{min-height:40px;padding:8px 12px;font-size:13px}
@media(max-width:360px){.v2-social-page.yx-page{padding-inline:16px}.v2-social-intro__title{font-size:24px;line-height:32px}.v2-social-card,.v2-social-state{padding:16px}.v2-social-timerwrap,.v2-social-track{width:144px;height:144px}.v2-social-timer{font-size:30px}.v2-social-room{flex-wrap:nowrap}.v2-social-room .v2-social-button{flex:0 0 72px;width:72px;min-width:72px}}
:global(:root[data-theme="high-contrast"] .v2-social-button--primary){color:var(--v2-side)}
@media(prefers-contrast:more){.v2-social-card,.v2-social-state,.v2-social-room,.v2-social-tip{border-color:var(--v2-ink)}}
@media(prefers-reduced-motion:reduce){.v2-social-button{transition:none}}
</style>
