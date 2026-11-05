<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { onHide, onReady, onShow } from '@dcloudio/uni-app'
import { mobileForbiddenRoles } from '@englishflow/design-tokens/mobile'
import FigmaAsset from '../../components/FigmaAsset.vue'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { getUniRuntime } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

type SessionStore = ReturnType<typeof useSessionStore>
type Identity = NonNullable<ReturnType<SessionStore['getMobileApiIdentity']>>
type Action = 'read' | 'account' | 'help' | 'logout' | 'login'
const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const forbiddenStyle = computed(() => ({ ...experienceStyle.value, ...mobileForbiddenRoles(theme.value) }))
const forbiddenRoot = '/static/figma-forbidden-270-3110'
const forbiddenGlow = `${forbiddenRoot}/2d5ef976-9cf8-4009-ab82-25cc08972ab5.svg`
const forbiddenStar = `${forbiddenRoot}/58acf21e-1d4e-4951-95cb-f9cb7ab83774.svg`
const forbiddenLock = `${forbiddenRoot}/7e7a30be-58d2-4996-8a79-c66b7d718b71.svg`
const session = useSessionStore()
const pending = ref<Action | null>(null)
const verifiedOwner = ref<Identity | null>(null)
const readFailed = ref(false)
const actionError = ref<string | null>(null)
let active = false
let operation = 0
let restoringOperation: number | null = null
let navigationReady = false
const busy = computed(() => pending.value !== null)
const canManageAccount = computed(() => session.isAuthenticated)
function sameOwner(owner: Identity): boolean {
  const current = session.getMobileApiIdentity()
  return session.isAuthenticated && current?.subject === owner.subject && current.revision === owner.revision
}
function current(request: number): boolean { return active && operation === request }
const reason = computed(() => {
  if (readFailed.value || !verifiedOwner.value || !sameOwner(verifiedOwner.value) || session.adultGate === 'UNKNOWN') return 'unknown'
  if (session.adultGate === 'REJECTED') return 'adult'
  // A sticky safety marker does not establish an owner-scoped withdrawal.
  if (session.learningConsentWithdrawn) return 'paused'
  return 'generic'
})
const title = computed(() => mobileT('forbidden.' + reason.value + 'Title'))
const description = computed(() => mobileT('forbidden.' + reason.value + 'Description'))
const pendingLabel = computed(() => mobileT('forbidden.' + (pending.value === 'read' ? 'checking' : pending.value === 'logout' ? 'signingOut' : 'opening')))
watch(title, () => { if (active && navigationReady) uni.setNavigationBarTitle({ title: title.value }) })
onReady(() => { navigationReady = true; uni.setNavigationBarTitle({ title: title.value }) })

function leave(): void {
  active = false; operation++; restoringOperation = null
  pending.value = null; verifiedOwner.value = null; readFailed.value = false; actionError.value = null
}
onHide(leave)
onBeforeUnmount(leave)
onBeforeUnmount(() => { navigationReady = false })
onShow(() => { active = true; void readCurrent() })

watch(() => session.identityRevision, () => {
  verifiedOwner.value = null
  if (restoringOperation === operation) return
  // logout intentionally clears this owner's identity before its request settles.
  if (pending.value === 'logout' && !session.getMobileApiIdentity() && !session.isAuthenticated) return
  operation++; pending.value = null; readFailed.value = false; actionError.value = null
  if (active) void nextTick().then(() => { if (active && !pending.value) void readCurrent() })
}, { flush: 'sync' })

async function readCurrent(): Promise<void> {
  if (!active || busy.value) return
  const request = ++operation
  pending.value = 'read'; verifiedOwner.value = null; readFailed.value = false; actionError.value = null
  try {
    restoringOperation = request
    await session.restore()
    if (restoringOperation === request) restoringOperation = null
    if (!current(request)) return
    const owner = session.getMobileApiIdentity()
    if (!session.isAuthenticated || !owner) return
    await session.refreshGateFromServer()
    if (current(request) && sameOwner(owner)) verifiedOwner.value = owner
  } catch {
    if (current(request)) { readFailed.value = true; actionError.value = 'readFailed' }
  } finally {
    if (restoringOperation === request) restoringOperation = null
    if (current(request)) pending.value = null
  }
}
class NavigationUnconfirmedError extends Error {}
async function navigate(url: string, publicExit = false): Promise<void> {
  const runtime = getUniRuntime()
  // Bound the local wait when a uni interceptor leaves its Promise pending.
  // An already dispatched platform navigation cannot be cancelled here.
  await new Promise<void>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => finish(new NavigationUnconfirmedError()), 4000)
    function finish(error?: unknown): void {
      if (settled) return
      settled = true; clearTimeout(timer)
      if (error) reject(error); else resolve()
    }
    try {
      const result = publicExit && runtime.reLaunch ? runtime.reLaunch({ url }) : runtime.navigateTo({ url })
      void Promise.resolve(result).then(() => finish(), error => finish(error))
    } catch (error) { finish(error) }
  })
}
const loginPath = '/pages/login/login?returnTo=%2Fpages%2Fsettings%2Fsettings'
async function open(action: 'account' | 'help' | 'login'): Promise<void> {
  if (!active || busy.value) return
  const owner = session.getMobileApiIdentity()
  if (action !== 'login' && (!owner || !session.isAuthenticated)) return
  const request = ++operation
  pending.value = action; actionError.value = null
  try {
    await session.restore()
    if (!current(request)) return
    if (action === 'login') {
      if (session.isAuthenticated || session.getMobileApiIdentity()) {
        pending.value = null; void readCurrent(); return
      }
      await navigate(loginPath, true)
    } else {
      if (!owner || !sameOwner(owner)) return
      await navigate(action === 'account' ? '/pages/settings/settings' : '/pages/support/support')
    }
  } catch (error) { if (current(request)) actionError.value = error instanceof NavigationUnconfirmedError ? 'navigationUnconfirmed' : 'navigationFailed' }
  finally { if (current(request)) pending.value = null }
}
async function logout(): Promise<void> {
  if (!active || busy.value || !session.isAuthenticated || !session.getMobileApiIdentity()) return
  const request = ++operation
  pending.value = 'logout'; actionError.value = null
  try {
    const acknowledged = await session.logout()
    if (!current(request) || session.getMobileApiIdentity() || session.status !== 'unauthenticated') return
    if (!acknowledged) { actionError.value = 'logoutUnconfirmed'; return }
    try { await navigate(loginPath, true) }
    catch (error) { if (current(request)) actionError.value = error instanceof NavigationUnconfirmedError ? 'navigationUnconfirmed' : 'navigationFailed' }
  } catch {
    if (current(request)) actionError.value = 'logoutFailed'
  } finally { if (current(request)) pending.value = null }
}
</script>

<template>
  <view class="yx-page forbidden-page" :style="forbiddenStyle" :data-motion="experienceMotion" :data-theme="theme" :aria-busy="busy">
    <view class="forbidden-glow" aria-hidden="true"><view class="forbidden-glow-art"><FigmaAsset :src="forbiddenGlow" :width="540" :height="480" /></view></view>
    <view class="forbidden-nav">
      <view class="forbidden-nav-pad" aria-hidden="true" />
      <text class="forbidden-nav-title">{{ mobileT('pages.forbidden.short') }}</text>
      <view class="forbidden-nav-pad" aria-hidden="true" />
    </view>
    <view class="forbidden-shell">
      <view class="forbidden-main">
        <view class="forbidden-brand">
          <view class="forbidden-logo"><FigmaAsset :src="forbiddenStar" :width="16" :height="16" /></view>
          <text class="forbidden-brand-name">{{ mobileT('brand') }}</text>
          <text class="forbidden-mark">{{ mobileT('brandEnglish') }}</text>
        </view>
        <view class="forbidden-gap" aria-hidden="true" />
        <view class="forbidden-card" aria-labelledby="mobile-forbidden-title" aria-describedby="mobile-forbidden-description">
          <view class="forbidden-badge"><view class="forbidden-lock"><FigmaAsset :src="forbiddenLock" :width="44" :height="44" /></view></view>
          <view class="forbidden-card-gap forbidden-card-gap-short" aria-hidden="true" />
          <text id="mobile-forbidden-title" class="forbidden-title" role="heading" aria-level="1">{{ title }}</text>
          <text id="mobile-forbidden-description" class="forbidden-description">{{ description }}</text>
          <view class="forbidden-card-gap forbidden-card-gap-end" aria-hidden="true" />
        </view>
        <view class="forbidden-spacer" aria-hidden="true" />
      </view>
      <view class="forbidden-actions">
        <template v-if="canManageAccount">
          <button class="forbidden-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('account')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('account')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('account')">{{ mobileT('forbidden.account') }}</button>
          <button class="forbidden-secondary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('help')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('help')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('help')">{{ mobileT('forbidden.help') }}</button>
        </template>
        <button v-else class="forbidden-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="open('login')" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="open('login')" @keydown.space.stop.prevent @keyup.space.stop.prevent="open('login')">{{ mobileT('forbidden.login') }}</button>
        <text v-if="pending" class="forbidden-status" role="status" aria-live="polite">{{ pendingLabel }}</text>
        <text v-if="actionError" class="forbidden-error" role="alert">{{ mobileT('forbidden.' + actionError) }}</text>
        <button v-if="readFailed" class="forbidden-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="readCurrent" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="readCurrent()" @keydown.space.stop.prevent @keyup.space.stop.prevent="readCurrent()">{{ mobileT('forbidden.reload') }}</button>
        <view v-if="canManageAccount" class="forbidden-exit">
          <button class="forbidden-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="logout" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="logout()" @keydown.space.stop.prevent @keyup.space.stop.prevent="logout()">{{ mobileT('forbidden.logout') }}</button>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.yx-page.forbidden-page { position: relative; display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: none; min-width: 0; min-height: 100vh; min-height: 100dvh; margin: 0; padding: 0; overflow-x: clip; background-color: var(--yx-forbidden-page, var(--v2-bg)); background-image: var(--yx-forbidden-page-image, none); color: var(--v2-ink); font-family: var(--v2-font); }
.forbidden-page[data-theme="high-contrast"] { background-color: var(--v2-bg); background-image: none; }
.forbidden-glow { position: absolute; top: -140px; left: calc(50% - 45px); width: 360px; height: 300px; pointer-events: none; z-index: 0; }
.forbidden-glow-art { position: absolute; top: -30%; left: -25%; width: 540px; height: 480px; }
.forbidden-nav, .forbidden-shell { position: relative; z-index: 1; }
.forbidden-nav { display: flex; align-items: center; box-sizing: border-box; width: 100%; min-height: 52px; padding: env(safe-area-inset-top) 8px 0; }
.forbidden-nav-pad { width: 44px; height: 44px; flex: none; }
.forbidden-nav-title { flex: 1 1 auto; min-width: 0; color: var(--v2-ink); font-size: 17px; font-weight: 700; line-height: 24px; text-align: center; overflow-wrap: anywhere; }
.forbidden-shell { display: flex; flex: 1 0 auto; flex-direction: column; width: 100%; max-width: 420px; min-width: 0; margin: 0 auto; }
.forbidden-main { display: flex; flex: 1 0 auto; flex-direction: column; gap: 16px; min-width: 0; padding: 8px 24px 0; }
.forbidden-brand { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; min-height: 28px; }
.forbidden-logo { display: flex; width: 28px; height: 28px; flex: none; align-items: center; justify-content: center; overflow: hidden; border-radius: 8px; background-color: var(--yx-forbidden-logo, var(--v2-brand)); background-image: var(--yx-forbidden-logo-image, none); }
.forbidden-brand-name { color: var(--v2-ink); font-size: 15px; font-weight: 700; line-height: 22px; overflow-wrap: anywhere; }
.forbidden-mark { color: var(--yx-forbidden-mark, var(--v2-brand)); font-size: 11px; font-weight: 500; line-height: 15px; overflow-wrap: anywhere; }
.forbidden-gap { height: 115px; flex: none; }
.forbidden-card { display: flex; flex-direction: column; align-items: center; gap: 12px; box-sizing: border-box; width: 100%; min-width: 0; padding: 0; border: 1px solid var(--yx-forbidden-card-border, var(--v2-line)); border-radius: 18px; background-color: var(--yx-forbidden-card, var(--v2-card)); box-shadow: var(--yx-forbidden-card-shadow, var(--v2-shadow)); backdrop-filter: var(--yx-forbidden-backdrop, none); -webkit-backdrop-filter: var(--yx-forbidden-backdrop, none); }
.forbidden-card-gap { width: 1px; flex: none; }
.forbidden-card-gap-short { height: 4px; }
.forbidden-card-gap-end { height: 12px; }
.forbidden-badge { display: flex; width: 96px; height: 96px; flex: none; align-items: center; justify-content: center; border-radius: 48px; background: var(--v2-soft); }
.forbidden-lock { width: 44px; height: 44px; flex: none; overflow: hidden; }
.forbidden-title { display: block; width: 100%; margin: 0; color: var(--v2-ink); font-size: 22px; font-weight: 700; line-height: 32px; text-align: center; overflow-wrap: anywhere; }
.forbidden-description { display: block; width: 100%; margin: 0; color: var(--v2-mut); font-size: 15px; font-weight: 400; line-height: 24px; text-align: center; overflow-wrap: anywhere; }
.forbidden-spacer { flex: 1 1 auto; min-height: 16px; }
.forbidden-actions { display: flex; flex-direction: column; align-items: stretch; gap: 4px; box-sizing: border-box; width: 100%; min-width: 0; padding: 12px 24px calc(12px + env(safe-area-inset-bottom)); background-color: var(--v2-card); box-shadow: var(--yx-forbidden-actions-shadow, none); }
.forbidden-primary, .forbidden-secondary, .forbidden-text { box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 100%; min-width: 0; margin: 0; white-space: normal; overflow-wrap: anywhere; }
.forbidden-primary, .forbidden-secondary { min-height: 48px; padding: 14px 20px; border: 0; border-radius: 14px; font: inherit; font-size: 16px; font-weight: 700; line-height: 1.5; }
.forbidden-primary { background-color: var(--yx-forbidden-cta, var(--v2-brand)); background-image: var(--yx-forbidden-cta-image, var(--v2-grad)); color: var(--yx-forbidden-on-cta, var(--v2-inverse)); box-shadow: var(--yx-forbidden-cta-shadow, none); }
.forbidden-secondary { background-color: var(--v2-soft); color: var(--v2-brand); }
.forbidden-exit { display: flex; justify-content: center; width: 100%; min-width: 0; padding-top: 6px; }
.forbidden-text { min-height: 44px; min-width: 44px; padding: 12px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--v2-brand); font: inherit; font-size: 14px; font-weight: 500; line-height: 1.5; }
.forbidden-error, .forbidden-status { display: block; font-size: 13px; line-height: 1.6; text-align: center; overflow-wrap: anywhere; }
.forbidden-error { color: var(--v2-bad); }
.forbidden-status { color: var(--v2-mut); }
.yx-page.forbidden-page button[disabled] { opacity: .6; cursor: default; }
.yx-page.forbidden-page button:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
.forbidden-page[data-theme="high-contrast"] .forbidden-logo { background-image: none; background-color: var(--v2-brand); }
.forbidden-page[data-theme="high-contrast"] .forbidden-card,
.forbidden-page[data-theme="high-contrast"] .forbidden-actions,
.forbidden-page[data-theme="high-contrast"] .forbidden-primary { background-image: none; box-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; }
.forbidden-page[data-theme="high-contrast"] .forbidden-card { background-color: var(--v2-card); border-color: var(--v2-line); }
.forbidden-page[data-theme="high-contrast"] .forbidden-primary { background-color: var(--v2-brand); color: var(--v2-inverse); }
.forbidden-page[data-motion="reduced"] .forbidden-glow,
.forbidden-page[data-motion="off"] .forbidden-glow,
.forbidden-page[data-theme="high-contrast"] .forbidden-glow,
.forbidden-page[data-motion="reduced"] .forbidden-card,
.forbidden-page[data-motion="off"] .forbidden-card { backdrop-filter: none; -webkit-backdrop-filter: none; }
.forbidden-page[data-motion="reduced"] .forbidden-glow,
.forbidden-page[data-motion="off"] .forbidden-glow,
.forbidden-page[data-theme="high-contrast"] .forbidden-glow { display: none; }
.forbidden-page[data-motion="reduced"] .forbidden-primary,
.forbidden-page[data-motion="off"] .forbidden-primary,
.forbidden-page[data-theme="high-contrast"] .forbidden-actions { box-shadow: none; }
@media (max-width: 359px) {
  .forbidden-main { padding-left: 16px; padding-right: 16px; }
  .forbidden-actions { padding-left: 16px; padding-right: 16px; }
}
@media (max-height: 700px) { .forbidden-gap { height: 24px; } }
@media (prefers-reduced-motion: reduce) {
  .forbidden-glow { display: none; }
  .forbidden-card, .forbidden-primary { backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: none; }
}
</style>
