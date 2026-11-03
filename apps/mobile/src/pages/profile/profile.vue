<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import { interpolate } from '@englishflow/i18n'
import AppIcon from '../../components/AppIcon.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { authT } from '../../auth/i18n'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { mobileI18n, mobileThemeController } from '../../platform/v2-foundation'
import { openUniPage } from '../../platform/uni-runtime'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const store = useLearnerContentStore()
const resolvedTheme = ref(mobileThemeController.resolvedTheme)
const unsubscribeTheme = mobileThemeController.subscribe((state) => { resolvedTheme.value = state.resolvedTheme })

const PROFILE_PATH = '/pages/profile/profile'
const LOGIN_PATH = '/pages/login/login'
const glowLoading = '/static/figma-profile-169-9356/imgGlow.svg'
const glowError = '/static/figma-profile-169-9446/imgGlow.svg'
const glowGuest = '/static/figma-profile-169-9707/imgGlow.svg'
const glowReady = '/static/figma-profile-169-9544/imgGlow.svg'
const glowDark = '/static/figma-profile-248-4123/imgGlow.svg'
const errorMascot = '/static/figma-profile-169-9446/imgMascot.svg'
const guestInfo = '/static/figma-profile-169-9707/imgMaterialInfo.svg'
const iconChart = '/static/figma-profile-169-9544/imgIconChart.svg'
const iconCrown = '/static/figma-profile-169-9544/imgIconCrown.svg'
const iconShirt = '/static/figma-profile-169-9544/imgIconShirt.svg'
const iconSettings = '/static/figma-profile-169-9544/imgIconSettings.svg'
const iconHelp = '/static/figma-profile-169-9544/imgIconHelp.svg'
const iconChevron = '/static/figma-profile-169-9544/imgIconChevR.svg'

function profileT(key: string, values?: Record<string, unknown>): string {
  const message = mobileT(key)
  return values ? interpolate(message, values) : message
}

const initialized = ref(false)
const hasLoadedAccount = ref(false)
const accountError = ref('')
const retrying = ref(false)
const navError = ref('')
const activeRow = ref('')
const goalBusy = ref(false)
const logoutOpen = ref(false)
const logoutBusy = ref(false)
const logoutError = ref('')
const logoutConfirmRef = ref<{ $el?: HTMLElement; focus?: () => void } | null>(null)
let loadGeneration = 0
let dialogGeneration = 0
let previousFocus: HTMLElement | null = null

const pageTitle = computed(() => mobileT('pages.profile.short'))
const pageSubtitle = computed(() => profileT('profile.pageSubtitle'))
const authPending = computed(() => !session.isAuthenticated && ['unknown', 'restoring', 'refreshing'].includes(session.status))
const showGuest = computed(() => initialized.value && !authPending.value && !logoutBusy.value && !session.isAuthenticated)
const showReady = computed(() => !showGuest.value && hasLoadedAccount.value)
const showError = computed(() => initialized.value && !authPending.value && !showGuest.value && !hasLoadedAccount.value && Boolean(accountError.value))
const showLoading = computed(() => !showReady.value && !showError.value && !showGuest.value)
const navBusy = computed(() => Boolean(activeRow.value) || goalBusy.value)
const glowSrc = computed(() => {
  if (showError.value) return glowError
  if (showGuest.value) return glowGuest
  if (showReady.value) return glowReady
  return glowLoading
})

const GOAL_KEYS: Record<string, string> = {
  FOUNDATION: 'FOUNDATION',
  ZERO_BASIS: 'FOUNDATION',
  COLLEGE_CET: 'COLLEGE_CET',
  CET_4_6: 'COLLEGE_CET',
  POSTGRADUATE_ENGLISH: 'POSTGRADUATE_ENGLISH',
  POSTGRADUATE: 'POSTGRADUATE_ENGLISH',
  WORKPLACE_DAILY: 'WORKPLACE_DAILY',
}
const goalLabel = computed(() => {
  const code = store.account.goal
  if (!code) return profileT('profile.goalUnset')
  const key = GOAL_KEYS[code]
  if (key) return mobileT(`onboarding.goals.${key}.label`)
  return store.goals.find((item) => item.value === code)?.label ?? profileT('profile.goalUnknown')
})
const dailyGoal = computed(() => {
  const quota = store.account.quota
  return quota && quota > 0 ? profileT('profile.minutesPerDay', { count: mobileI18n.formatNumber(quota) }) : ''
})
const goalMeta = computed(() => dailyGoal.value ? `${goalLabel.value} · ${dailyGoal.value}` : goalLabel.value)

const LOCALE_KEYS: Record<string, string> = {
  'zh-CN': 'profile.localeZhCN',
  'en-US': 'profile.localeEnUS',
  'en-GB': 'profile.localeEnUS',
  'de-DE': 'profile.localeDeDE',
  'fr-FR': 'profile.localeFrFR',
  'es-ES': 'profile.localeEsES',
}
function localeLabel(code: string): string {
  const key = LOCALE_KEYS[code]
  return key ? profileT(key) : profileT('profile.localeUnknown')
}
const uiLocaleLabel = computed(() => localeLabel(store.account.uiLocale))
const contentLocaleLabel = computed(() => localeLabel(store.account.contentLocale))
const adultStatus = computed(() => {
  if (session.adultGate === 'PASSED') return { label: profileT('profile.adultPassed'), tone: 'ok' }
  if (session.adultGate === 'REJECTED') return { label: profileT('profile.adultRejected'), tone: 'bad' }
  return { label: profileT('profile.adultPending'), tone: 'warn' }
})
const adultNote = computed(() => {
  if (session.adultGate === 'REJECTED') return { tone: 'bad', text: profileT('profile.adultRejectedNote'), action: profileT('profile.viewHelp'), path: '/pages/support/support', key: 'adult-help' }
  if (session.adultGate === 'PASSED') return null
  return { tone: 'warn', text: profileT('profile.adultRequiredNote'), action: profileT('profile.verify'), path: '/pages/onboarding/onboarding', key: 'adult-verify' }
})

type ServiceIcon = 'calendar' | 'inbox' | 'grid'
interface ServiceRow {
  key: string
  path: string
  titleKey: string
  descKey: string
  iconSrc?: string
  icon?: ServiceIcon
  tone: 'brand' | 'warn' | 'ok' | 'neutral'
}
const primaryServices: readonly ServiceRow[] = [
  { key: 'report', path: '/pages/b10-report/b10-report', titleKey: 'pages.b10-report.short', descKey: 'profile.reportDesc', iconSrc: iconChart, tone: 'brand' },
  { key: 'commerce', path: '/pages/b5-commerce/b5-commerce', titleKey: 'pages.b5-commerce.short', descKey: 'profile.commerceDesc', iconSrc: iconCrown, tone: 'warn' },
  { key: 'avatar', path: '/pages/b4-avatar/b4-avatar', titleKey: 'pages.b4-avatar.short', descKey: 'profile.avatarDesc', iconSrc: iconShirt, tone: 'ok' },
  { key: 'today', path: '/pages/today/today', titleKey: 'pages.today.short', descKey: 'profile.todayDesc', icon: 'calendar', tone: 'brand' },
  { key: 'offline', path: '/pages/b4-offline/b4-offline', titleKey: 'pages.b4-offline.short', descKey: 'profile.offlineDesc', icon: 'inbox', tone: 'neutral' },
  { key: 'platform', path: '/pages/b6-platform/b6-platform', titleKey: 'pages.b6-platform.short', descKey: 'profile.platformDesc', icon: 'grid', tone: 'neutral' },
]
const settingsServices: readonly ServiceRow[] = [
  { key: 'settings', path: '/pages/settings/settings', titleKey: 'pages.settings.short', descKey: 'profile.settingsDesc', iconSrc: iconSettings, tone: 'neutral' },
  { key: 'support', path: '/pages/support/support', titleKey: 'pages.support.short', descKey: 'profile.helpDesc', iconSrc: iconHelp, tone: 'neutral' },
]

function closeLogout(force = false): void {
  if (logoutBusy.value && !force) return
  if (force) {
    dialogGeneration += 1
    logoutBusy.value = false
  }
  logoutOpen.value = false
  const target = force ? null : previousFocus
  previousFocus = null
  if (target && typeof target.focus === 'function') target.focus()
}

function openLogout(): void {
  if (!session.isAuthenticated || logoutBusy.value || logoutOpen.value) return
  previousFocus = typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  logoutError.value = ''
  logoutOpen.value = true
  void nextTick(() => {
    const target = logoutConfirmRef.value?.$el ?? logoutConfirmRef.value
    if (target && typeof target.focus === 'function') target.focus()
  })
}

async function confirmLogout(): Promise<void> {
  if (logoutBusy.value) return
  const generation = ++dialogGeneration
  logoutBusy.value = true
  logoutError.value = ''
  try {
    const signedOut = await session.logout()
    if (generation !== dialogGeneration) return
    logoutOpen.value = false
    if (signedOut) {
      await Promise.resolve(openUniPage(LOGIN_PATH))
    } else {
      logoutError.value = mobileT('forbidden.logoutFailed')
    }
  } catch {
    if (generation !== dialogGeneration) return
    logoutOpen.value = false
    logoutError.value = mobileT('forbidden.logoutFailed')
  } finally {
    if (generation === dialogGeneration) logoutBusy.value = false
  }
}

function onDocumentKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || !logoutOpen.value || logoutBusy.value) return
  event.preventDefault()
  closeLogout()
}

onMounted(() => {
  if (typeof document !== 'undefined') document.addEventListener('keydown', onDocumentKeydown)
})
onUnmounted(() => {
  if (typeof document !== 'undefined') document.removeEventListener('keydown', onDocumentKeydown)
  unsubscribeTheme()
  dialogGeneration += 1
})

async function openPath(path: string, key: string): Promise<void> {
  if (navBusy.value) return
  navError.value = ''
  activeRow.value = key
  try {
    await Promise.resolve(openUniPage(path))
  } catch {
    navError.value = mobileT('forbidden.navigationFailed')
  } finally {
    if (activeRow.value === key) activeRow.value = ''
  }
}

async function openGoal(): Promise<void> {
  if (navBusy.value) return
  navError.value = ''
  goalBusy.value = true
  try {
    await Promise.resolve(openUniPage('/pages/onboarding/onboarding'))
  } catch {
    navError.value = mobileT('forbidden.navigationFailed')
  } finally {
    goalBusy.value = false
  }
}

async function openLogin(): Promise<void> {
  if (navBusy.value) return
  navError.value = ''
  activeRow.value = 'login'
  try {
    session.setReturnTo(PROFILE_PATH)
    await Promise.resolve(openUniPage(LOGIN_PATH))
  } catch {
    navError.value = mobileT('forbidden.navigationFailed')
  } finally {
    if (activeRow.value === 'login') activeRow.value = ''
  }
}

async function refreshAccount(): Promise<void> {
  const generation = ++loadGeneration
  const subject = session.verifiedSubject
  const revision = session.identityRevision
  accountError.value = ''
  hasLoadedAccount.value = false
  if (!session.isAuthenticated) {
    initialized.value = true
    return
  }
  try {
    await store.loadAccount()
  } catch {
    if (generation !== loadGeneration) return
    accountError.value = profileT('profile.errorFallback')
    return
  }
  if (generation !== loadGeneration) return
  if (!session.isAuthenticated || session.verifiedSubject !== subject || session.identityRevision !== revision) return
  if (store.accountStatus === 'ready') {
    hasLoadedAccount.value = true
  } else {
    accountError.value = store.lastError || profileT('profile.errorFallback')
  }
}

async function retryAccount(): Promise<void> {
  if (retrying.value) return
  retrying.value = true
  try {
    await refreshAccount()
  } finally {
    retrying.value = false
  }
}

async function showProfile(): Promise<void> {
  const generation = ++loadGeneration
  initialized.value = false
  hasLoadedAccount.value = false
  accountError.value = ''
  navError.value = ''
  logoutError.value = ''
  retrying.value = false
  closeLogout(true)
  let allowed = false
  try {
    allowed = await ensureMobilePageAccess(PROFILE_PATH)
  } catch {
    allowed = false
  }
  if (generation !== loadGeneration) return
  initialized.value = true
  if (!allowed) {
    if (session.isAuthenticated) accountError.value = profileT('profile.accessUnconfirmed')
    return
  }
  if (!session.isAuthenticated) return
  await refreshAccount()
}

onShow(() => { void showProfile() })
onHide(() => {
  loadGeneration += 1
  initialized.value = false
  hasLoadedAccount.value = false
  accountError.value = ''
  navError.value = ''
  logoutError.value = ''
  activeRow.value = ''
  goalBusy.value = false
  retrying.value = false
  closeLogout(true)
})

watch(() => `${session.status}:${session.identityRevision}`, () => {
  loadGeneration += 1
  if (!logoutBusy.value) {
    hasLoadedAccount.value = false
    accountError.value = ''
    navError.value = ''
    logoutError.value = ''
    closeLogout(true)
  }
  if (initialized.value && session.isAuthenticated) void refreshAccount()
})
</script>

<template>
  <view id="profile-shell" class="yx-page profile-shell" :style="experienceStyle" :data-motion="experienceMotion" :data-resolved-theme="resolvedTheme" :data-profile-state="showLoading ? 'loading' : showError ? 'error' : showGuest ? 'guest' : 'ready'">
    <view class="profile-glow-wrap" aria-hidden="true">
      <image class="profile-glow profile-glow--light" :src="glowSrc" mode="aspectFit" />
      <image class="profile-glow profile-glow--dark" :src="glowDark" mode="aspectFit" />
    </view>

    <view class="profile-canvas">
      <view class="profile-heading">
        <text class="profile-title" role="heading" aria-level="1">{{ pageTitle }}</text>
        <text class="profile-subtitle">{{ pageSubtitle }}</text>
      </view>

      <text v-if="navError" class="profile-inline-error" role="alert">{{ navError }}</text>

      <view v-if="showLoading" class="profile-state" aria-busy="true">
        <view class="profile-card profile-skeleton-card" aria-hidden="true">
          <view class="profile-skeleton-avatar"></view>
          <view class="profile-skeleton-copy">
            <view class="profile-skeleton-line profile-skeleton-line--title"></view>
            <view class="profile-skeleton-line profile-skeleton-line--meta"></view>
          </view>
        </view>
        <text class="profile-state-note" role="status" aria-live="polite">{{ profileT('profile.loading') }}</text>
        <view class="profile-skeleton-block profile-skeleton-block--tall" aria-hidden="true"></view>
        <view class="profile-skeleton-block" aria-hidden="true"></view>
      </view>

      <view v-else-if="showError" class="profile-state">
        <view class="profile-error-spacer" aria-hidden="true"></view>
        <view class="profile-card profile-error-card" role="alert">
          <image class="profile-mascot" :src="errorMascot" mode="aspectFit" aria-hidden="true" />
          <text class="profile-error-title" role="heading" aria-level="2">{{ profileT('profile.errorTitle') }}</text>
          <text class="profile-error-text">{{ accountError }}</text>
          <button tabindex="0" role="button" type="button" class="profile-primary" :disabled="retrying" :aria-busy="retrying ? 'true' : 'false'" @click="retryAccount">
            <text>{{ retrying ? profileT('profile.retrying') : profileT('profile.retry') }}</text>
          </button>
        </view>
      </view>

      <view v-else class="profile-ready">
        <view class="profile-grid">
          <view class="profile-card profile-summary profile-area-summary">
            <view class="profile-avatar" aria-hidden="true"><text>{{ showGuest ? '客' : '学' }}</text></view>
            <view class="profile-summary-copy">
              <text class="profile-summary-title" role="heading" aria-level="2">{{ showGuest ? profileT('profile.guestName') : profileT('profile.summaryTitle') }}</text>
              <text class="profile-summary-meta">{{ showGuest ? profileT('profile.goalUnset') : goalMeta }}</text>
            </view>
            <button v-if="showReady" tabindex="0" role="button" type="button" class="profile-text-link profile-goal-link" :disabled="navBusy" :aria-busy="goalBusy ? 'true' : 'false'" @click="openGoal">
              <text>{{ goalBusy ? mobileT('forbidden.opening') : (store.account.goal ? profileT('profile.modifyGoal') : profileT('profile.setGoal')) }}</text>
            </button>
          </view>

          <view v-if="showGuest" class="profile-card profile-guest-alert profile-area-account">
            <view class="profile-info-badge" aria-hidden="true"><image :src="guestInfo" mode="aspectFit" /></view>
            <view class="profile-guest-copy">
              <text class="profile-guest-title">{{ profileT('profile.guestTitle') }}</text>
              <text class="profile-guest-text">{{ profileT('profile.guestText') }}</text>
            </view>
            <button tabindex="0" role="button" type="button" class="profile-text-link profile-guest-action" :disabled="navBusy" @click="openLogin">
              <text>{{ activeRow === 'login' ? mobileT('forbidden.opening') : profileT('profile.guestAction') }}</text>
            </button>
          </view>

          <view v-else class="profile-card profile-account profile-area-account">
            <view class="profile-card-head">
              <text class="profile-card-title" role="heading" aria-level="2">{{ profileT('profile.accountTitle') }}</text>
              <button tabindex="0" role="button" type="button" class="profile-text-link" :disabled="navBusy" @click="openPath('/pages/settings/settings', 'settings-link')">
                <text>{{ profileT('profile.accountSettings') }}</text>
              </button>
            </view>
            <view class="profile-facts">
              <view class="profile-fact">
                <text class="profile-fact-label">{{ profileT('profile.adultLabel') }}</text>
                <text class="profile-badge" :class="`profile-badge--${adultStatus.tone}`">{{ adultStatus.label }}</text>
              </view>
              <view class="profile-fact">
                <text class="profile-fact-label">{{ profileT('profile.uiLocale') }}</text>
                <text class="profile-fact-value">{{ uiLocaleLabel }}</text>
              </view>
              <view class="profile-fact">
                <text class="profile-fact-label">{{ profileT('profile.contentLocale') }}</text>
                <text class="profile-fact-value">{{ contentLocaleLabel }}</text>
              </view>
            </view>
            <view v-if="adultNote" class="profile-note" :class="`profile-note--${adultNote.tone}`">
              <AppIcon :name="adultNote.tone === 'bad' ? 'alert' : 'shield'" :size="18" />
              <text class="profile-note-text">{{ adultNote.text }}</text>
              <button tabindex="0" role="button" type="button" class="profile-note-action" :disabled="navBusy" @click="openPath(adultNote.path, adultNote.key)">
                <text>{{ adultNote.action }}</text>
              </button>
            </view>
          </view>

          <view class="profile-card profile-services profile-area-services">
            <view class="profile-card-head profile-card-head--services">
              <text class="profile-card-title" role="heading" aria-level="2">{{ mobileT('profileLinks') }}</text>
            </view>
            <view class="profile-rows">
              <button v-for="row in primaryServices" :key="row.key" tabindex="0" role="button" type="button" class="profile-row" :disabled="navBusy" :aria-busy="activeRow === row.key ? 'true' : 'false'" @click="openPath(row.path, row.key)">
                <view class="profile-tile" :class="`profile-tile--${row.tone}`" aria-hidden="true">
                  <image v-if="row.iconSrc" class="profile-row-icon" :src="row.iconSrc" mode="aspectFit" />
                  <AppIcon v-else :name="row.icon ?? 'me'" :size="22" />
                </view>
                <view class="profile-row-copy">
                  <text class="profile-row-title">{{ mobileT(row.titleKey) }}</text>
                  <text class="profile-row-desc">{{ activeRow === row.key ? mobileT('forbidden.opening') : profileT(row.descKey) }}</text>
                </view>
                <image class="profile-chevron" :src="iconChevron" mode="aspectFit" aria-hidden="true" />
              </button>
            </view>
          </view>

          <view class="profile-card profile-settings profile-area-settings">
            <view class="profile-rows">
              <button v-for="row in settingsServices" :key="row.key" tabindex="0" role="button" type="button" class="profile-row" :disabled="navBusy" :aria-busy="activeRow === row.key ? 'true' : 'false'" @click="openPath(row.path, row.key)">
                <view class="profile-tile" :class="`profile-tile--${row.tone}`" aria-hidden="true">
                  <image v-if="row.iconSrc" class="profile-row-icon" :src="row.iconSrc" mode="aspectFit" />
                  <AppIcon v-else :name="row.icon ?? 'me'" :size="22" />
                </view>
                <view class="profile-row-copy">
                  <text class="profile-row-title">{{ mobileT(row.titleKey) }}</text>
                  <text class="profile-row-desc">{{ activeRow === row.key ? mobileT('forbidden.opening') : profileT(row.descKey) }}</text>
                </view>
                <image class="profile-chevron" :src="iconChevron" mode="aspectFit" aria-hidden="true" />
              </button>
            </view>
          </view>

          <view v-if="showReady" class="profile-logout-wrap profile-area-logout">
            <button tabindex="0" role="button" type="button" class="profile-logout" :disabled="logoutBusy" :aria-busy="logoutBusy ? 'true' : 'false'" @click="openLogout">
              <text>{{ logoutBusy ? mobileT('forbidden.signingOut') : authT('session.logout') }}</text>
            </button>
            <text v-if="logoutError" class="profile-inline-error" role="alert">{{ logoutError }}</text>
          </view>
        </view>
        <text v-if="showGuest && logoutError" class="profile-inline-error" role="alert">{{ logoutError }}</text>
      </view>
    </view>

    <view v-if="logoutOpen" class="profile-overlay">
      <view class="profile-scrim" aria-hidden="true" @click="closeLogout()"></view>
      <view class="profile-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-logout-title" aria-describedby="profile-logout-text">
        <text id="profile-logout-title" class="profile-dialog-title" role="heading" aria-level="2">{{ mobileT('profile.logoutConfirmTitle') }}</text>
        <text id="profile-logout-text" class="profile-dialog-text">{{ mobileT('profile.logoutConfirmText') }}</text>
        <text v-if="logoutError" class="profile-inline-error" role="alert">{{ logoutError }}</text>
        <button ref="logoutConfirmRef" tabindex="0" role="button" type="button" class="profile-danger" :disabled="logoutBusy" :aria-busy="logoutBusy ? 'true' : 'false'" @click="confirmLogout">
          <text>{{ logoutBusy ? mobileT('forbidden.signingOut') : mobileT('profile.logoutConfirm') }}</text>
        </button>
        <button tabindex="0" role="button" type="button" class="profile-cancel" :disabled="logoutBusy" @click="closeLogout()">
          <text>{{ mobileT('profile.cancel') }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
#profile-shell {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  max-width: none;
  min-height: 100vh;
  margin: 0;
  padding: 0;
  overflow-x: clip;
  background-color: var(--v2-bg);
  background-image: var(--yx-profile-page-image, var(--yx-r4-page-image));
  background-repeat: no-repeat;
  background-size: cover;
  color: var(--yx-r4-ink);
  font-family: var(--v2-font);
  line-height: 1.65;
  overflow-wrap: anywhere;
}
#profile-shell * { box-sizing: border-box; }
#profile-shell button {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: left;
  white-space: normal;
}
#profile-shell button::after { border: 0; }
#profile-shell button:active:not([disabled]) { transform: none; }
#profile-shell button:focus-visible { outline: none; box-shadow: var(--v2-focus); }
#profile-shell button[disabled] { cursor: default; opacity: .72; }

.profile-glow-wrap { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; }
.profile-glow { position: absolute; top: -140px; right: -120px; width: 360px; height: 300px; }
.profile-glow--dark { display: none; }

.profile-canvas {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 760px;
  margin: 0 auto;
  padding: calc(24px + env(safe-area-inset-top)) clamp(16px, 6vw, 24px) calc(112px + env(safe-area-inset-bottom));
}
.profile-heading { display: grid; gap: 4px; padding: 8px 0 0; margin-bottom: 16px; }
.profile-title { display: block; color: var(--yx-r4-ink); font-size: 28px; line-height: 1.29; font-weight: 700; }
.profile-subtitle { display: block; color: var(--yx-r4-muted); font-size: 14px; line-height: 1.5; }

.profile-state { display: grid; gap: 16px; }
.profile-ready { display: block; }
.profile-grid { display: grid; gap: 16px; align-items: start; }
.profile-area-summary, .profile-area-account, .profile-area-services, .profile-area-settings, .profile-area-logout { min-width: 0; }

.profile-card {
  position: relative;
  min-width: 0;
  border: 1px solid var(--yx-profile-glass-border, var(--yx-r4-glass-border));
  border-radius: 24px;
  background: var(--yx-profile-glass, var(--yx-r4-glass));
  box-shadow: var(--yx-profile-card-shadow, var(--yx-r4-shadow-card));
  backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  -webkit-backdrop-filter: blur(var(--yx-profile-blur, var(--yx-r4-blur)));
  overflow: hidden;
}
.profile-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 14px; padding: 18px 20px; }
.profile-avatar {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background-image: var(--yx-profile-avatar-image, linear-gradient(128.66deg, var(--v2-brand2) 7.4%, var(--v2-brand) 81.5%));
  color: var(--yx-on-brand);
  font-size: 22px;
  line-height: 1.4;
  font-weight: 700;
}
.profile-avatar text { color: inherit; }
.profile-summary-copy { display: grid; flex: 1 1 140px; gap: 2px; min-width: 0; }
.profile-summary-title { display: block; color: var(--yx-r4-ink); font-size: 18px; line-height: 1.44; font-weight: 700; }
.profile-summary-meta { display: block; color: var(--yx-r4-muted); font-size: 12px; line-height: 1.5; }

.profile-text-link {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px;
  color: var(--yx-r4-brand);
  font-size: 14px;
  line-height: 1.5;
  font-weight: 500;
  text-align: center;
}
.profile-text-link text { color: inherit; }
.profile-text-link:hover { color: var(--v2-brand2); }
.profile-goal-link { margin-left: auto; }

.profile-account { padding: 18px 20px; }
.profile-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 12px; min-width: 0; }
.profile-card-title { display: block; color: var(--yx-r4-ink); font-size: 18px; line-height: 1.44; font-weight: 700; }
.profile-card-head--services { padding: 2px 0 6px; border-bottom: 1px solid var(--v2-line); }
.profile-facts { display: grid; gap: 0; margin-top: 6px; }
.profile-fact { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; min-height: 44px; padding: 6px 0; border-top: 1px solid var(--v2-line); }
.profile-fact:first-child { border-top: 0; }
.profile-fact-label { color: var(--yx-r4-muted); font-size: 14px; line-height: 1.5; }
.profile-fact-value { color: var(--yx-r4-ink); font-size: 14px; line-height: 1.5; font-weight: 500; text-align: right; }
.profile-badge { display: inline-flex; align-items: center; min-height: 24px; padding: 2px 10px; border-radius: 999px; font-size: 12px; line-height: 1.5; font-weight: 700; }
.profile-badge--ok { background: var(--v2-ok-soft); color: var(--v2-ok); }
.profile-badge--warn { background: var(--v2-warn-soft); color: var(--v2-warn); }
.profile-badge--bad { background: var(--v2-bad-soft); color: var(--v2-bad); }

.profile-note { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-top: 12px; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
.profile-note--warn { background: var(--v2-warn-soft); color: var(--v2-warn); }
.profile-note--bad { background: var(--v2-bad-soft); color: var(--v2-bad); }
.profile-note > :first-child { flex: none; }
.profile-note-text { flex: 1 1 140px; min-width: 0; color: inherit; }
.profile-note-action { display: inline-flex; flex: none; align-items: center; justify-content: center; min-height: 44px; padding: 0 4px; color: inherit; font-size: 13px; line-height: 1.5; font-weight: 700; text-decoration: underline; text-underline-offset: 2px; }
.profile-note-action text { color: inherit; }

.profile-services, .profile-settings { padding: 6px 20px; }
.profile-rows { display: grid; min-width: 0; }
.profile-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) 20px;
  align-items: center;
  gap: 12px;
  width: 100%;
  min-height: 56px;
  padding: 10px 0;
  border-radius: 18px;
  color: var(--yx-r4-ink);
  text-align: left;
}
.profile-row + .profile-row { border-top: 1px solid var(--v2-line); }
.profile-tile { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 14px; }
.profile-tile--brand { background: var(--v2-soft); color: var(--v2-brand); }
.profile-tile--warn { background: var(--v2-warn-soft); color: var(--v2-warn); }
.profile-tile--ok { background: var(--v2-ok-soft); color: var(--v2-ok); }
.profile-tile--neutral { background: var(--yx-profile-tile-neutral, var(--yx-on-brand)); color: var(--v2-side); }
.profile-row-icon { display: block; width: 22px; height: 22px; }
.profile-row-copy { display: grid; gap: 2px; min-width: 0; }
.profile-row-title { display: block; color: var(--yx-r4-ink); font-size: 15px; line-height: 1.5; font-weight: 700; }
.profile-row-desc { display: block; color: var(--yx-r4-muted); font-size: 12px; line-height: 1.5; }
.profile-chevron { display: block; width: 20px; height: 20px; }

.profile-logout-wrap { display: grid; gap: 8px; }
.profile-logout {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 14px 20px;
  border-radius: 14px;
  background: var(--v2-soft);
  color: var(--yx-r4-brand);
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
  text-align: center;
}
.profile-logout text { color: inherit; }

.profile-inline-error { display: flex; align-items: flex-start; gap: 6px; margin: 0; padding: 6px 2px; color: var(--v2-bad); font-size: 13px; line-height: 1.5; }

.profile-state-note { display: block; margin: 0; color: var(--yx-r4-muted); font-size: 12px; line-height: 1.5; }
.profile-skeleton-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
.profile-skeleton-avatar { flex: none; width: 56px; height: 56px; border-radius: 28px; background: var(--v2-surface); }
.profile-skeleton-copy { display: grid; flex: 1 1 auto; gap: 8px; min-width: 0; }
.profile-skeleton-line { height: 18px; max-width: 100%; border-radius: 6px; background: var(--v2-surface); }
.profile-skeleton-line--title { width: 120px; }
.profile-skeleton-line--meta { width: 160px; height: 14px; }
.profile-skeleton-block { width: 100%; height: 120px; border-radius: 24px; background: var(--v2-surface); }
.profile-skeleton-block--tall { height: 200px; }

.profile-error-spacer { height: 70px; }
.profile-error-card { display: grid; justify-items: center; gap: 12px; padding: 24px; text-align: center; }
.profile-mascot { display: block; width: 120px; height: 120px; }
.profile-error-title { display: block; color: var(--yx-r4-ink); font-size: 22px; line-height: 1.45; font-weight: 700; text-align: center; }
.profile-error-text { display: block; color: var(--yx-r4-muted); font-size: 15px; line-height: 1.5; text-align: center; }
.profile-primary {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  padding: 14px 20px;
  border-radius: 14px;
  background: var(--v2-grad);
  box-shadow: var(--yx-profile-cta-shadow, var(--yx-r4-shadow-cta));
  color: var(--yx-on-brand);
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
  text-align: center;
}
.profile-primary text { color: inherit; }

.profile-guest-alert { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 8px 12px 14px; }
.profile-info-badge { display: flex; flex: none; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 8px; background: var(--v2-grad); }
.profile-info-badge image { display: block; width: 17px; height: 17px; }
.profile-guest-copy { display: grid; flex: 1 1 160px; gap: 2px; min-width: 0; }
.profile-guest-title { display: block; color: var(--yx-r4-brand); font-size: 14px; line-height: 1.5; font-weight: 700; }
.profile-guest-text { display: block; color: var(--yx-r4-muted); font-size: 13px; line-height: 1.5; }
.profile-guest-action { margin-left: auto; padding: 0 10px; }

.profile-overlay { position: fixed; inset: 0; z-index: 40; display: flex; align-items: center; justify-content: center; padding: 24px; }
.profile-scrim { position: absolute; inset: 0; background: var(--yx-profile-scrim, var(--v2-side)); opacity: var(--yx-profile-scrim-opacity, .45); }
.profile-dialog {
  position: relative;
  z-index: 1;
  display: grid;
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
.profile-dialog-title { display: block; color: var(--yx-r4-ink); font-size: 20px; line-height: 1.4; font-weight: 700; text-align: center; }
.profile-dialog-text { display: block; color: var(--yx-r4-muted); font-size: 15px; line-height: 1.5; text-align: center; }
.profile-dialog .profile-inline-error { justify-content: center; text-align: center; }
.profile-danger {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 48px;
  margin-top: 6px;
  padding: 14px 20px;
  border-radius: 14px;
  background: var(--v2-bad);
  box-shadow: var(--yx-profile-danger-shadow, var(--yx-r4-shadow-cta));
  color: var(--v2-inverse);
  font-size: 16px;
  line-height: 1.5;
  font-weight: 700;
  text-align: center;
}
.profile-danger text { color: inherit; }
.profile-cancel { display: flex; align-items: center; justify-content: center; width: 100%; min-height: 44px; padding: 12px 8px; color: var(--yx-r4-brand); font-size: 14px; line-height: 1.5; font-weight: 500; text-align: center; }
.profile-cancel text { color: inherit; }

#profile-shell[data-resolved-theme="dark"] .profile-glow--light { display: none; }
#profile-shell[data-resolved-theme="dark"] .profile-glow--dark { display: block; }
#profile-shell[data-resolved-theme="high-contrast"] .profile-glow-wrap { display: none; }

@media (min-width: 700px) {
  .profile-grid {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, .8fr);
    grid-template-areas:
      "summary summary"
      "account account"
      "services settings"
      "logout logout";
  }
  .profile-area-summary { grid-area: summary; }
  .profile-area-account { grid-area: account; }
  .profile-area-services { grid-area: services; }
  .profile-area-settings { grid-area: settings; }
  .profile-area-logout { grid-area: logout; }
  .profile-facts { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0 16px; }
  .profile-fact { display: grid; align-content: start; justify-content: start; gap: 2px; min-height: 0; padding: 8px 0; border-top: 0; }
  .profile-fact + .profile-fact { padding-left: 16px; border-left: 1px solid var(--v2-line); }
  .profile-fact-value { text-align: left; }
}

@media (max-width: 359px) {
  .profile-canvas { padding-inline: 16px; }
  .profile-summary { padding: 16px; gap: 10px; }
  .profile-account { padding: 16px; }
  .profile-services, .profile-settings { padding-inline: 16px; }
  .profile-row { grid-template-columns: 44px minmax(0, 1fr) 18px; gap: 10px; }
  .profile-dialog { padding: 20px 20px 12px; }
}

@media (prefers-reduced-motion: reduce) {
  #profile-shell * { animation: none !important; transition: none !important; }
}
</style>
