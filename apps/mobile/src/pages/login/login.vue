<script setup lang="ts">
import FigmaAsset from '../../components/FigmaAsset.vue'
import { loginAssets, loginDarkAssets } from '../../theme/figma-r4-assets'
import { openPublicDocument } from '../../platform/public-documents'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onReady } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { authT } from '../../auth/i18n'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const assets = computed(() => (theme.value === 'light' ? loginAssets : loginDarkAssets))
const session = useSessionStore()
type Field = 'identifier' | 'password'
type FieldEvent = { detail?: { value?: string } }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const showPassword = ref(false)
const identifier = ref('')
const password = ref('')
const returnTo = ref('/pages/home/home')
const submitting = ref(false)
const initialized = ref(false)
const error = ref<string | null>(null)
const lastErrorText = ref<string | null>(null)
const requiredError = ref(false)
const validationAttempted = ref(false)
const identifierMissing = computed(() => validationAttempted.value && !identifier.value.trim())
const passwordMissing = computed(() => validationAttempted.value && !password.value)
const identifierFocused = ref(false)
const passwordFocused = ref(false)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
watch(error, (value) => { if (value) lastErrorText.value = value }, { flush: 'sync' })
let passwordControls = 'mobile-login-password-host'
// #ifdef H5
passwordControls = 'mobile-login-password'
// #endif

watch([identifier, password], () => {
  if (requiredError.value && identifier.value.trim() && password.value) {
    requiredError.value = false
    error.value = null
  }
})

// Keep uni-input and its focus/model handling on every platform. This version of
// uni-h5 passes ARIA to the wrapper and limits native autocomplete to off/code.
// The H5-only bridge supplies semantics to the actual input, without reading values.
// #ifdef H5
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: 'identifier' | 'password'): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const missing = kind === 'identifier' ? identifierMissing.value : passwordMissing.value
  const attributes: Record<string, string | null> = {
    id: `mobile-login-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : 'current-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    'aria-label': authT(`login.${kind}`),
    'aria-labelledby': `mobile-login-${kind}-label`,
    'aria-invalid': missing ? 'true' : null,
    'aria-describedby': missing && error.value ? 'mobile-login-error' : null,
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }
}
function syncNativeInputs(): void {
  syncNativeInput(identifierField.value, 'identifier')
  syncNativeInput(passwordField.value, 'password')
}
// Uni's view/form slots can update without updating the page component itself.
// Watch the semantic state explicitly, after their render flush, and synchronize
// after the child input patch; a page onUpdated hook does not cover these slots.
watch([
  identifier, password, identifierMissing, passwordMissing, error, submitting,
  showPassword, identifierFocused, passwordFocused,
  () => authT('login.identifier'), () => authT('login.password'),
], async () => {
  await nextTick()
  syncNativeInputs()
}, { flush: 'post' })
// #endif

async function focusField(kind: 'identifier' | 'password'): Promise<void> {
  if (submitting.value) return
  identifierFocused.value = false
  passwordFocused.value = false
  await nextTick()
  if (submitting.value) return
  if (kind === 'identifier') identifierFocused.value = true
  else passwordFocused.value = true
}

function timeout<T>(promise: Promise<T>, milliseconds: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const expired = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds)
  })
  return Promise.race([promise, expired]).finally(() => clearTimeout(timer))
}

async function initialize(options?: { returnTo?: string; redirect?: string }): Promise<void> {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  try {
    await timeout(session.restore(), 1500, '会话恢复超时')
    if (session.isAuthenticated) await continueAfterLogin(session.consumeReturnTo())
  } catch {
    // An unavailable existing session leaves the public login form usable.
  }
}

onLoad((options) => { void initialize(options) })
onReady(() => { uni.setNavigationBarTitle({ title: mobileT('auth.login.start') }) })
onMounted(() => {
  void initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})

function navigate(path: string): void {
  if (!submitting.value) openUniPage(path)
}

function openLegal(kind: 'terms' | 'privacy'): void {
  if (submitting.value) return
  try {
    openPublicDocument(kind)
  } catch {
    error.value = mobileT('auth.login.legalFailed')
  }
}

function togglePassword(): void {
  if (!submitting.value) showPassword.value = !showPassword.value
}

function syncField(kind: Field, value: unknown): void {
  if (submitting.value || typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else password.value = value
}

function blurField(kind: Field, event: FieldEvent): void {
  // Uni's model update may be throttled; its field events carry the current value.
  syncField(kind, event.detail?.value)
  if (kind === 'identifier') identifierFocused.value = false
  else passwordFocused.value = false
}

function confirmNext(event: FieldEvent): void {
  syncField('identifier', event.detail?.value)
  void focusField('password')
}

async function confirmSubmit(event: FieldEvent): Promise<void> {
  syncField('password', event.detail?.value)
  await submit()
}

async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value) return
  // Named uni-form values are current even before a pending model update arrives.
  for (const kind of ['identifier', 'password'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  error.value = null
  requiredError.value = false
  if (!identifier.value.trim() || !password.value) {
    requiredError.value = true
    error.value = authT('login.required')
    await focusField(!identifier.value.trim() ? 'identifier' : 'password')
    return
  }
  submitting.value = true
  try {
    // The IAM and permission requests already have bounded client timeouts.
    // A separate page race could unlock this form while the login still runs.
    const success = await session.login(identifier.value, password.value)
    if (!success) {
      error.value = mobileAuthFailureCopy('login', session.lastError, mobileT)
      return
    }
    password.value = ''
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    error.value = mobileAuthFailureCopy('login', cause, mobileT)
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <view class="yx-page yx-r4-screen v2-login" :style="experienceStyle" :data-motion="experienceMotion" :data-theme="theme">
    <view class="login-fx" aria-hidden="true">
      <view class="login-fx__mesh"><FigmaAsset :src="assets.mesh" :width="630" :height="615" /></view>
      <view class="login-fx__blob login-fx__blob--a"><FigmaAsset :src="assets.blobA" :width="320" :height="320" /></view>
      <view class="login-fx__blob login-fx__blob--b"><FigmaAsset :src="assets.blobB" :width="400" :height="400" /></view>
      <view class="login-fx__blob login-fx__blob--c"><FigmaAsset :src="assets.blobC" :width="440" :height="440" /></view>
      <view class="login-fx__particles"><FigmaAsset :src="assets.particles" :width="180" :height="140" /></view>
    </view>
    <view class="login-column">
    <view class="login-hero">
      <view class="login-copy">
        <view class="login-brand">
          <view class="login-logo">
            <view class="login-logo__glow"><FigmaAsset :src="assets.logoGlow" :width="88" :height="88" /></view>
            <FigmaAsset :src="assets.logo" :width="54" :height="54" />
          </view>
          <view class="login-wordmark">
            <text>{{ mobileT('brand') }}</text>
            <text class="login-wordmark__en">{{ mobileT('brandEnglish') }}</text>
          </view>
        </view>
        <text id="mobile-login-title" class="login-title" role="heading" aria-level="1">{{ mobileT('auth.login.title') }}</text>
        <text class="login-description">{{ mobileT('auth.login.description') }}</text>
      </view>
      <view class="login-mascot" aria-hidden="true"><FigmaAsset :src="assets.sparkle" :width="25" :height="25" /></view>
    </view>
    <view class="login-content" aria-labelledby="mobile-login-title">
      <text class="login-panel__title">{{ mobileT('auth.login.panelTitle') }}</text>
      <!-- Uni submit is a component event, not a native form event. -->
      <form class="login-form" :aria-busy="submitting" @submit="submit">
        <!-- uni-form wraps the slot in one span, so this view is the 18px stack. -->
        <view class="login-form__body">
        <view class="login-fields">
        <view class="login-field">
          <label id="mobile-login-identifier-label" class="login-label" for="mobile-login-identifier-host" @click="focusField('identifier')">{{ authT('login.identifier') }}</label>
          <view class="login-control">
            <FigmaAsset :src="assets.user" :width="20" :height="20" />
          <input
            id="mobile-login-identifier-host"
            ref="identifierField"
            v-model="identifier"
            name="identifier"
            class="login-input"
            :class="{ 'is-invalid': identifierMissing, 'is-focused': identifierFocused }"
            type="text"
            text-content-type="username"
            confirm-type="next"
            :focus="identifierFocused"
            :placeholder="authT('login.identifierPlaceholder')"
            :disabled="submitting"
            :aria-invalid="identifierMissing || undefined"
            :aria-describedby="identifierMissing && error ? 'mobile-login-error' : undefined"
            @focus="identifierFocused = true"
            @blur="blurField('identifier', $event)"
            @confirm="confirmNext"
          />
          </view>
        </view>
        <view class="login-field login-password-block">
          <view class="login-field-body">
          <label id="mobile-login-password-label" class="login-label" for="mobile-login-password-host" @click="focusField('password')">{{ authT('login.password') }}</label>
          <view class="login-password">
            <view class="login-control">
              <FigmaAsset :src="assets.lock" :width="20" :height="20" />
            <input
              id="mobile-login-password-host"
              ref="passwordField"
              v-model="password"
              name="password"
              class="login-input"
              :class="{ 'is-invalid': passwordMissing, 'is-focused': passwordFocused }"
              :password="!showPassword"
              type="text"
              text-content-type="password"
              confirm-type="go"
              :focus="passwordFocused"
              :placeholder="authT('login.passwordPlaceholder')"
              :disabled="submitting"
              :aria-invalid="passwordMissing || undefined"
              :aria-describedby="passwordMissing && error ? 'mobile-login-error' : undefined"
              @focus="passwordFocused = true"
              @blur="blurField('password', $event)"
              @confirm="confirmSubmit"
            />
            <button
              class="login-password-toggle"
              tabindex="0"
              role="button"
              :aria-controls="passwordControls"
              :aria-label="mobileT(showPassword ? 'auth.login.hidePassword' : 'auth.login.showPassword')"
              :aria-pressed="showPassword"
              :disabled="submitting"
              :aria-disabled="submitting"
              @click="togglePassword"
            ><FigmaAsset :src="assets.eye" :width="20" :height="20" /></button>
            </view>
          </view>
          </view>
          <view class="login-recovery"><button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="navigate('/pages/reset-password/reset-password')">{{ mobileT('auth.login.forgotAction') }}</button></view>
        </view>
        </view>
        <view class="login-privacy"><FigmaAsset :src="assets.dot" :width="8" :height="8" /><text>{{ mobileT('auth.login.privacyNote') }}</text></view>
        <text v-if="lastErrorText" :id="error ? 'mobile-login-error' : undefined" class="login-error" :class="{ 'is-cleared': !error }" :role="error ? 'alert' : undefined" :aria-hidden="!error || undefined">{{ error || lastErrorText }}</text>
        <button class="login-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="submit()" @keydown.space.stop.prevent @keyup.space.stop.prevent="submit()">{{ submitting ? authT('login.submitting') : mobileT('auth.login.continueAction') }}</button>
        </view>
      </form>
      <view class="login-follow">
      <view class="login-register"><text>{{ mobileT('auth.login.noAccount') }}</text><button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="navigate('/pages/register/register')">{{ mobileT('auth.login.registerLink') }}</button></view>
      <view class="login-legal">
        <text class="login-legal__lead">{{ mobileT('auth.login.legalLead') }}</text>
        <view class="login-legal__links">
          <button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="openLegal('terms')">{{ mobileT('auth.login.terms') }}</button>
          <button class="login-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="openLegal('privacy')">{{ mobileT('auth.login.privacyPolicy') }}</button>
        </view>
      </view>
      </view>
    </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
/* Inner screen only. The 59px Figma offset is the demo status bar, replaced by the real safe area. */
.yx-page.v2-login {
  position: relative;
  max-width: none;
  min-height: 100vh;
  min-height: 100dvh;
  overflow-x: hidden;
  padding: calc(8px + env(safe-area-inset-top)) 0 calc(24px + env(safe-area-inset-bottom));
  background-color: var(--yx-auth-page-color, var(--yx-surface-page));
  background-image: var(--yx-auth-page-image, none);
  color: var(--yx-auth-ink, var(--yx-text-primary));
  font-family: var(--v2-font);
  line-height: 1.6;
}
.login-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.login-fx__mesh { position: absolute; left: -130px; top: -170px; }
.login-fx__blob { position: absolute; }
.login-fx__blob--a { right: -80px; top: 12px; }
.login-fx__blob--b { right: -150px; top: -80px; }
.login-fx__blob--c { left: -180px; top: -160px; }
.login-fx__particles { position: absolute; left: 194px; top: 8px; opacity: .9; }
.v2-login[data-motion="reduced"] .login-fx,
.v2-login[data-motion="off"] .login-fx,
.v2-login[data-theme="high-contrast"] .login-fx { display: none; }
.login-column { position: relative; width: 100%; max-width: 390px; margin: 0 auto; }
.login-hero, .login-content { position: relative; width: 100%; }
.login-hero { min-height: 0; padding: 8px 24px 12px; }
.login-copy { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 14px; padding-right: 72px; }
.login-brand { display: flex; min-height: 54px; align-items: center; gap: 10px; min-width: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 30px; font-weight: 700; line-height: 1.2; }
.login-logo { position: relative; width: 54px; height: 54px; flex: 0 0 54px; }
.login-logo__glow { position: absolute; left: -17px; top: -17px; }
.login-wordmark { display: flex; min-width: 0; flex-direction: column; }
.login-wordmark__en { color: var(--yx-auth-wordmark, var(--yx-auth-ink)); font-size: 11px; font-weight: 500; line-height: 16px; }
.login-title { display: block; margin: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); text-align: left; font-size: 24px; line-height: 40px; font-weight: 700; letter-spacing: .5px; overflow-wrap: anywhere; }
.login-description { display: block; color: var(--yx-auth-subtitle, var(--yx-text-primary)); text-align: left; font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.login-mascot { position: absolute; top: 5px; right: 24px; display: flex; width: 60px; height: 60px; align-items: center; justify-content: center; border: 2.5px solid var(--yx-auth-mascot-border, transparent); border-radius: 30px; background-color: var(--yx-auth-mascot-color, transparent); background-image: var(--yx-auth-mascot-image, none); box-shadow: var(--yx-auth-shadow-mascot, none); }
.login-content { margin-top: 0; padding: 28px 24px; border: 1px solid var(--yx-auth-glass-border, var(--yx-border)); border-radius: 28px 28px 20px 20px; background: var(--yx-auth-glass, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-card, none); backdrop-filter: blur(var(--yx-auth-blur, 0px)); -webkit-backdrop-filter: blur(var(--yx-auth-blur, 0px)); }
.login-panel__title { display: block; margin: 0 0 18px; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 20px; font-weight: 700; line-height: 1.4; }
.login-form { display: flex; flex-direction: column; min-width: 0; }
.login-form__body { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 18px; }
.login-fields { display: grid; gap: 18px; }
.login-field, .login-field-body { display: grid; gap: 8px; min-width: 0; }
.login-password-block { gap: 4px; }
.login-label { color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 14px; line-height: 1.6; font-weight: 500; }
.login-control { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 4px 0 14px; border: 1px solid var(--yx-auth-field-border, var(--yx-border)); border-radius: 14px; background: var(--yx-auth-field, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-field, none); }
.v2-login .login-control:has(.is-invalid) { border-color: var(--yx-danger); }
.v2-login .login-input { width: auto; flex: 1 1 auto; height: 48px; min-width: 0; min-height: 48px; padding: 0; border: 0; border-radius: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); background: transparent; font-size: 16px; line-height: 1.5; font-weight: 400; }
.login-input :deep(.uni-input-input), .login-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.login-input :deep(.uni-input-placeholder) { color: var(--yx-auth-muted, var(--yx-text-secondary)); }
.v2-login .login-input.is-invalid { border-color: var(--yx-danger); }
.v2-login .login-input.is-focused, .v2-login .login-input:focus-within { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 2px; }
.login-password { position: relative; min-width: 0; }
.v2-login .login-password .login-input { padding-right: 48px; }
.v2-login .login-password-toggle { position: absolute; top: 50%; right: 0; z-index: 1; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; }
.v2-login .login-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.login-recovery { display: flex; justify-content: flex-end; padding-right: 4px; }
.v2-login .login-text-button { display: inline-flex; width: auto; min-width: 44px; min-height: 44px; margin: 0; padding: 12px 8px; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--yx-auth-brand, var(--yx-brand)); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; }
.login-privacy { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 12px; background: var(--yx-auth-tip, var(--yx-surface-soft)); color: var(--yx-auth-tip-ink, var(--yx-text-primary)); font-size: 12px; line-height: 1.6; }
.login-privacy text { min-width: 0; overflow-wrap: anywhere; }
.login-error { display: block; margin: -10px 0; color: var(--yx-danger); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.login-error.is-cleared { visibility: hidden; }
.v2-login .login-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 14px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 14px; background-color: var(--yx-auth-cta-color, var(--yx-brand)); background-image: var(--yx-auth-cta-image, none); color: var(--yx-auth-on-cta, var(--yx-on-brand)); box-shadow: var(--yx-auth-shadow-cta, none); font-size: 16px; line-height: 1.5; font-weight: 700; }
.v2-login .login-submit:active:not([disabled]) { transform: none; }
.v2-login button[disabled] { cursor: default; }
.v2-login .login-submit[disabled] { opacity: .6; }
.v2-login button:focus-visible { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 3px; }
.login-follow { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
.login-register { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; min-height: 44px; color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; }
.login-legal { display: flex; flex-direction: column; align-items: center; }
.login-legal__lead { color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.6; text-align: center; overflow-wrap: anywhere; }
.login-legal__links { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: center; }
@media (max-width: 359px) {
  .login-hero { padding-right: 16px; padding-left: 16px; }
  .login-content { padding-right: 16px; padding-left: 16px; }
  .login-copy { padding-right: 64px; }
  .login-mascot { right: 16px; }
  .login-brand { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-login .login-fx { display: none; }
  .v2-login * { transition: none; animation: none; }
}
</style>
