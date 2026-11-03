<script setup lang="ts">
import FigmaAsset from '../../components/FigmaAsset.vue'
import { loginDarkAssets } from '../../theme/figma-r4-assets'
import { openPublicDocument } from '../../platform/public-documents'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { usePointerFeedback } from '../../platform/pointer-feedback'
import { continueAfterLogin } from '../../auth/navigation'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const registerRoot = '/static/figma-register-98-2169'
const registerAssets = {
  eye: `${registerRoot}/2bc6b8cc-1111-461e-974a-a1acbdfe4c31.svg`,
  logo: `${registerRoot}/02775667-c477-47ad-8c16-e40ab684d37d.png`,
  mesh: `${registerRoot}/4f1867c9-6a7e-489a-b45e-af8fb3387e68.svg`,
  blobA: `${registerRoot}/f7b499cc-fd9c-4bee-81ce-5b57d696273a.svg`,
  blobB: `${registerRoot}/f29df247-3aff-43a8-8a3d-b680bc23c3ae.svg`,
  blobC: `${registerRoot}/d032a755-ad2f-4d83-87ae-80c7aa616f58.svg`,
  particles: `${registerRoot}/bd178784-7408-4045-8893-5b82830e0c42.svg`,
  logoGlow: `${registerRoot}/cda03eb9-6976-4787-9637-6ffe089f9949.svg`,
  user: `${registerRoot}/5994b664-5600-4a49-85dc-1ae42b4fb6d1.svg`,
  lock: `${registerRoot}/a294dcef-2313-4614-a958-99fce5503507.svg`,
} as const

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
// Resolved dark, high contrast, and system-dark use the published login dark glyphs.
// Light keeps the register files. Those dark pigments already clear 3:1, so this page adds no mask.
const fieldIcons = computed(() => (theme.value === 'light'
  ? { user: registerAssets.user, lock: registerAssets.lock, eye: registerAssets.eye }
  : { user: loginDarkAssets.user, lock: loginDarkAssets.lock, eye: loginDarkAssets.eye }))
const session = useSessionStore()
type Field = 'identifier' | 'password' | 'confirm'
type FieldEvent = { detail?: { value?: string } }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const identifier = ref('')
const password = ref('')
const confirm = ref('')
const showPassword = ref(false)
const showConfirm = ref(false)
const focusedField = ref<Field | null>(null)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
const confirmField = ref<{ $el?: HTMLElement } | null>(null)
const returnTo = ref('/pages/home/home')
const initialized = ref(false)
const submitting = ref(false)
const validationAttempted = ref(false)
const serverFailure = ref<unknown | null>(null)
const legalError = ref<string | null>(null)
const serverError = computed(() => serverFailure.value === null ? null : mobileAuthFailureCopy('register', serverFailure.value, mobileT))
const identifierError = computed(() => {
  if (!validationAttempted.value) return null
  const length = identifier.value.trim().length
  if (!length) return mobileT('auth.register.requiredIdentifier')
  return length < 3 || length > 128 ? mobileT('auth.register.identifierLength') : null
})
const passwordError = computed(() => {
  if (!validationAttempted.value) return null
  if (!password.value) return mobileT('auth.register.requiredPassword')
  if (password.value.length < 12) return mobileT('auth.register.shortPassword')
  return password.value.length > 128 ? mobileT('auth.register.passwordLength') : null
})
const confirmError = computed(() => {
  if (!validationAttempted.value) return null
  if (!confirm.value) return mobileT('auth.register.requiredConfirm')
  return password.value !== confirm.value ? mobileT('auth.register.mismatch') : null
})
// Keep reported errors at their natural height during editing. Blur or submit
// reports current messages; corrected fields hide text while retaining space.
const lastIdentifierError = ref('')
const lastPasswordError = ref('')
const lastConfirmError = ref('')
function reportFieldErrors(): void {
  if (submitting.value) return
  if (identifierError.value) lastIdentifierError.value = identifierError.value
  if (passwordError.value) lastPasswordError.value = passwordError.value
  if (confirmError.value) lastConfirmError.value = confirmError.value
}
watch([identifierError, passwordError, confirmError], () => { if (focusedField.value === null) reportFieldErrors() })
function currentFeedback() {
  return {
    active: validationAttempted.value,
    fields: {
      identifier: { current: identifierError.value ? lastIdentifierError.value || null : null, last: lastIdentifierError.value },
      password: { current: passwordError.value ? lastPasswordError.value || null : null, last: lastPasswordError.value },
      confirm: { current: confirmError.value ? lastConfirmError.value || null : null, last: lastConfirmError.value },
    },
    server: serverError.value,
  }
}
const pageRoot = ref<{ $el?: HTMLElement } | null>(null)
const pointerFeedback = usePointerFeedback({
  root: () => pageRoot.value?.$el ?? null,
  actions: '.register-submit,.register-text-button,.register-password-toggle',
  capture: currentFeedback,
  disabled: () => submitting.value,
  afterRelease: () => {
    // #ifdef H5
    syncNativeInputs()
    // #endif
  },
})
const visualFeedback = computed(() => pointerFeedback.value ?? currentFeedback())
let passwordControls = 'mobile-register-password-host'
let confirmControls = 'mobile-register-confirm-host'
// #ifdef H5
passwordControls = 'mobile-register-password'
confirmControls = 'mobile-register-confirm'

// uni-h5 puts ARIA on the wrapper; keep uni's model/focus handling and supply
// semantics to the actual input after the child render. Never read its value.
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: Field): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const fieldError = visualFeedback.value.fields[kind].current
  const description = [kind === 'password' ? 'mobile-register-password-hint' : null, fieldError ? `mobile-register-${kind}-error` : null].filter(Boolean).join(' ')
  const attributes: Record<string, string | null> = {
    id: `mobile-register-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : 'new-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    minlength: kind === 'identifier' ? '3' : kind === 'password' ? '12' : null,
    'aria-label': mobileT(`auth.register.${kind === 'confirm' ? 'confirmPassword' : kind}`),
    'aria-labelledby': `mobile-register-${kind}-label`,
    'aria-invalid': fieldError ? 'true' : null,
    'aria-describedby': description || null,
  }
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) input.removeAttribute(name)
    else input.setAttribute(name, value)
  }
}
function syncNativeInputs(): void {
  syncNativeInput(identifierField.value, 'identifier')
  syncNativeInput(passwordField.value, 'password')
  syncNativeInput(confirmField.value, 'confirm')
}
watch([
  identifier, password, confirm, identifierError, passwordError, confirmError,
  showPassword, showConfirm, focusedField, submitting, visualFeedback,
  () => mobileT('auth.register.identifier'), () => mobileT('auth.register.password'), () => mobileT('auth.register.confirmPassword'),
], async () => { await nextTick(); syncNativeInputs() }, { flush: 'post' })
// #endif

function initialize(options?: { returnTo?: string; redirect?: string }): void {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
}
onLoad((options) => { initialize(options) })
onShow(() => { uni.setNavigationBarTitle({ title: mobileT('auth.register.start') }) })
onMounted(() => {
  initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})

async function focusField(kind: Field): Promise<void> {
  if (submitting.value) return
  focusedField.value = null
  await nextTick()
  if (!submitting.value) focusedField.value = kind
}
function syncField(kind: Field, value: unknown): void {
  if (submitting.value) return
  if (typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else if (kind === 'password') password.value = value
  else confirm.value = value
}
function blurField(kind: Field, event: FieldEvent): void {
  // uni-h5 throttles model updates; blur/confirm and named form values carry
  // the current component value, even when the user submits immediately.
  syncField(kind, event.detail?.value)
  if (focusedField.value === kind) focusedField.value = null
  reportFieldErrors()
}
function confirmNext(kind: Field, next: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  void focusField(next)
}
async function confirmSubmit(event: FieldEvent): Promise<void> {
  syncField('confirm', event.detail?.value)
  await submit()
}
function togglePassword(kind: 'password' | 'confirm'): void {
  if (submitting.value) return
  if (kind === 'password') showPassword.value = !showPassword.value
  else showConfirm.value = !showConfirm.value
}
function signIn(): void {
  if (!submitting.value) openUniPage(`/pages/login/login?returnTo=${encodeURIComponent(returnTo.value)}`)
}
function openLegal(kind: 'terms' | 'privacy'): void {
  if (submitting.value) return
  legalError.value = null
  try {
    openPublicDocument(kind)
  } catch {
    legalError.value = mobileT('auth.login.legalFailed')
  }
}
async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value) return
  legalError.value = null
  for (const kind of ['identifier', 'password', 'confirm'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  serverFailure.value = null
  reportFieldErrors()
  const firstError = identifierError.value ? 'identifier' : passwordError.value ? 'password' : confirmError.value ? 'confirm' : null
  if (firstError) { await focusField(firstError); return }
  submitting.value = true
  try {
    // IAM registration and permission lookup already use bounded client requests.
    // Keep the form locked until the complete existing flow resolves.
    const success = await session.register(identifier.value, password.value)
    if (!success) { serverFailure.value = session.lastError ?? 'UNKNOWN_AUTH_ERROR'; return }
    password.value = ''
    confirm.value = ''
    validationAttempted.value = false
    await continueAfterLogin(session.consumeReturnTo())
  } catch (cause) {
    serverFailure.value = cause ?? 'UNKNOWN_AUTH_ERROR'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view ref="pageRoot" class="yx-page yx-r4-screen v2-register" :style="experienceStyle" :data-motion="experienceMotion" :data-theme="theme">
    <view class="register-fx" aria-hidden="true">
      <view class="register-fx__mesh"><FigmaAsset :src="registerAssets.mesh" :width="630" :height="615" /></view>
      <view class="register-fx__blob register-fx__blob--a"><FigmaAsset :src="registerAssets.blobA" :width="320" :height="320" /></view>
      <view class="register-fx__blob register-fx__blob--b"><FigmaAsset :src="registerAssets.blobB" :width="400" :height="400" /></view>
      <view class="register-fx__blob register-fx__blob--c"><FigmaAsset :src="registerAssets.blobC" :width="440" :height="440" /></view>
      <view class="register-fx__particles"><FigmaAsset :src="registerAssets.particles" :width="180" :height="140" /></view>
    </view>
    <view class="register-column">
      <view class="register-hero">
        <view class="register-brand">
          <view class="register-logo">
            <view class="register-logo__glow"><FigmaAsset :src="registerAssets.logoGlow" :width="88" :height="88" /></view>
            <FigmaAsset :src="registerAssets.logo" :width="54" :height="54" />
          </view>
          <view class="register-wordmark">
            <text>{{ mobileT('brand') }}</text>
            <text class="register-wordmark__en">{{ mobileT('brandEnglish') }}</text>
          </view>
        </view>
        <text id="mobile-register-title" class="register-title" role="heading" aria-level="1">{{ mobileT('auth.register.title') }}</text>
        <text class="register-audience">{{ mobileT('auth.register.audience') }}</text>
      </view>
      <view class="register-panel" aria-labelledby="mobile-register-title">
        <text class="register-panel__title">{{ mobileT('auth.register.panelTitle') }}</text>
        <!-- Uni submit is a component event. The inner view carries the stack because uni-form wraps the slot in one span. -->
        <form class="register-form" :aria-busy="submitting" @submit="submit">
          <view class="register-form__body">
            <view class="register-fields">
              <view class="register-field">
                <label id="mobile-register-identifier-label" class="register-label" for="mobile-register-identifier-host" @click="focusField('identifier')">{{ mobileT('auth.register.identifier') }}</label>
                <view class="register-control" :class="{ 'is-invalid': visualFeedback.fields.identifier.current }">
                  <FigmaAsset :src="fieldIcons.user" :width="20" :height="20" />
                  <input id="mobile-register-identifier-host" ref="identifierField" v-model="identifier" name="identifier" :maxlength="-1" class="register-input" :class="{ 'is-invalid': visualFeedback.fields.identifier.current, 'is-focused': focusedField === 'identifier' }" type="text" text-content-type="username" confirm-type="next" :focus="focusedField === 'identifier'" :placeholder="mobileT('auth.register.frameIdentifierPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.identifier.current ? true : undefined" :aria-describedby="visualFeedback.fields.identifier.current ? 'mobile-register-identifier-error' : undefined" @focus="focusedField = 'identifier'" @blur="blurField('identifier', $event)" @confirm="confirmNext('identifier', 'password', $event)" />
                </view>
                <text v-if="visualFeedback.active && visualFeedback.fields.identifier.last" id="mobile-register-identifier-error" class="register-field-error" :class="{ 'is-clear': !visualFeedback.fields.identifier.current }" :role="visualFeedback.fields.identifier.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.identifier.current">{{ visualFeedback.fields.identifier.current || visualFeedback.fields.identifier.last }}</text>
              </view>
              <view class="register-field">
                <label id="mobile-register-password-label" class="register-label" for="mobile-register-password-host" @click="focusField('password')">{{ mobileT('auth.register.password') }}</label>
                <view class="register-password">
                  <view class="register-control register-control--secret" :class="{ 'is-invalid': visualFeedback.fields.password.current }">
                    <FigmaAsset :src="fieldIcons.lock" :width="20" :height="20" />
                    <input id="mobile-register-password-host" ref="passwordField" v-model="password" name="password" :maxlength="-1" class="register-input" :class="{ 'is-invalid': visualFeedback.fields.password.current, 'is-focused': focusedField === 'password' }" type="text" :password="!showPassword" text-content-type="newPassword" confirm-type="next" :focus="focusedField === 'password'" :placeholder="mobileT('auth.register.framePasswordPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.password.current ? true : undefined" :aria-describedby="visualFeedback.fields.password.current ? 'mobile-register-password-hint mobile-register-password-error' : 'mobile-register-password-hint'" @focus="focusedField = 'password'" @blur="blurField('password', $event)" @confirm="confirmNext('password', 'confirm', $event)" />
                    <button class="register-password-toggle" tabindex="0" role="button" :aria-controls="passwordControls" :aria-label="mobileT(showPassword ? 'auth.register.hidePassword' : 'auth.register.showPassword')" :aria-pressed="showPassword" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword('password')"><FigmaAsset :src="fieldIcons.eye" :width="20" :height="20" /></button>
                  </view>
                </view>
                <text id="mobile-register-password-hint" class="register-password-hint" :data-requirement="mobileT('auth.register.passwordHint')">{{ mobileT('auth.register.framePasswordHint') }}</text>
                <text v-if="visualFeedback.active && visualFeedback.fields.password.last" id="mobile-register-password-error" class="register-field-error" :class="{ 'is-clear': !visualFeedback.fields.password.current }" :role="visualFeedback.fields.password.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.password.current">{{ visualFeedback.fields.password.current || visualFeedback.fields.password.last }}</text>
              </view>
              <view class="register-field">
                <label id="mobile-register-confirm-label" class="register-label" for="mobile-register-confirm-host" @click="focusField('confirm')">{{ mobileT('auth.register.confirmPassword') }}</label>
                <view class="register-password">
                  <view class="register-control register-control--secret" :class="{ 'is-invalid': visualFeedback.fields.confirm.current }">
                    <FigmaAsset :src="fieldIcons.lock" :width="20" :height="20" />
                    <input id="mobile-register-confirm-host" ref="confirmField" v-model="confirm" name="confirm" :maxlength="-1" class="register-input" :class="{ 'is-invalid': visualFeedback.fields.confirm.current, 'is-focused': focusedField === 'confirm' }" type="text" :password="!showConfirm" text-content-type="newPassword" confirm-type="go" :focus="focusedField === 'confirm'" :placeholder="mobileT('auth.register.frameConfirmPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.confirm.current ? true : undefined" :aria-describedby="visualFeedback.fields.confirm.current ? 'mobile-register-confirm-error' : undefined" @focus="focusedField = 'confirm'" @blur="blurField('confirm', $event)" @confirm="confirmSubmit" />
                    <button class="register-password-toggle" tabindex="0" role="button" :aria-controls="confirmControls" :aria-label="mobileT(showConfirm ? 'auth.register.hideConfirm' : 'auth.register.showConfirm')" :aria-pressed="showConfirm" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword('confirm')"><FigmaAsset :src="fieldIcons.eye" :width="20" :height="20" /></button>
                  </view>
                </view>
                <text v-if="visualFeedback.active && visualFeedback.fields.confirm.last" id="mobile-register-confirm-error" class="register-field-error" :class="{ 'is-clear': !visualFeedback.fields.confirm.current }" :role="visualFeedback.fields.confirm.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.confirm.current">{{ visualFeedback.fields.confirm.current || visualFeedback.fields.confirm.last }}</text>
              </view>
            </view>
            <text class="register-legal-note">{{ mobileT('auth.register.legalNote') }}</text>
            <view class="register-legal">
              <button class="register-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="openLegal('terms')">{{ mobileT('auth.login.terms') }}</button>
              <button class="register-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="openLegal('privacy')">{{ mobileT('auth.login.privacyPolicy') }}</button>
            </view>
            <text v-if="legalError || visualFeedback.server" class="register-server-error" role="alert">{{ legalError || visualFeedback.server }}</text>
            <button class="register-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="submit()" @keydown.space.stop.prevent @keyup.space.stop.prevent="submit()">{{ submitting ? mobileT('auth.register.submitting') : mobileT('auth.register.continueAction') }}</button>
          </view>
        </form>
        <view class="register-signin"><text>{{ mobileT('auth.register.hasAccount') }}</text><button class="register-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="signIn">{{ mobileT('auth.register.backToLogin') }}</button></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.v2-register, .yx-page.v2-register * { box-sizing: border-box; }
.yx-page.v2-register {
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
.register-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.register-fx__mesh { position: absolute; left: -130px; top: -170px; }
.register-fx__blob { position: absolute; }
.register-fx__blob--a { left: 144px; top: -50px; }
.register-fx__blob--b { left: 150px; top: -130px; }
.register-fx__blob--c { left: -240px; top: -250px; }
.register-fx__particles { position: absolute; left: 194px; top: 40px; opacity: .9; }
.v2-register[data-motion="reduced"] .register-fx,
.v2-register[data-motion="off"] .register-fx,
.v2-register[data-theme="dark"] .register-fx,
.v2-register[data-theme="high-contrast"] .register-fx,
.v2-register[data-motion="reduced"] .register-logo__glow,
.v2-register[data-motion="off"] .register-logo__glow,
.v2-register[data-theme="dark"] .register-logo__glow,
.v2-register[data-theme="high-contrast"] .register-logo__glow { display: none; }
.register-column { position: relative; display: flex; width: 100%; max-width: 390px; margin: 0 auto; flex-direction: column; gap: 14px; }
.register-hero { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 14px; padding: 8px 24px 0; }
.register-brand { display: flex; min-width: 0; min-height: 54px; align-items: center; gap: 10px; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 30px; font-weight: 700; line-height: 1.2; }
.register-logo { position: relative; width: 54px; height: 54px; flex: 0 0 54px; }
.register-logo__glow { position: absolute; left: -17px; top: -17px; }
.register-wordmark { display: flex; min-width: 0; flex-direction: column; }
.register-wordmark text { overflow-wrap: anywhere; }
.register-wordmark__en { color: var(--yx-auth-wordmark, var(--yx-auth-ink)); font-size: 11px; font-weight: 500; line-height: 16px; }
.register-title { display: block; margin: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); text-align: left; font-size: 24px; line-height: 40px; font-weight: 700; letter-spacing: .5px; overflow-wrap: anywhere; }
.register-audience { display: block; color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.register-panel { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 14px; padding: 24px; border: 1px solid var(--yx-auth-glass-border, var(--yx-border)); border-radius: 28px 28px 20px 20px; background: var(--yx-auth-glass, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-card, none); backdrop-filter: blur(var(--yx-auth-blur, 0px)); -webkit-backdrop-filter: blur(var(--yx-auth-blur, 0px)); }
.register-panel__title { display: block; margin: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 20px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.register-form { display: flex; min-width: 0; flex-direction: column; }
.register-form__body, .register-fields { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 14px; }
.register-field { display: grid; gap: 8px; min-width: 0; }
.register-label { color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 14px; line-height: 1.6; font-weight: 500; }
.register-control { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border: 1px solid var(--yx-auth-field-border, var(--yx-border)); border-radius: 14px; background: var(--yx-auth-field, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-field, none); }
.register-control--secret { padding-right: 4px; }
.register-control.is-invalid { border-color: var(--yx-danger, var(--v2-bad)); }
.v2-register .register-input { width: auto; flex: 1 1 auto; height: 48px; min-width: 0; min-height: 48px; padding: 0; border: 0; border-radius: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); background: transparent; font-size: 16px; line-height: 1.5; font-weight: 400; }
.register-input :deep(.uni-input-input), .register-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.register-input :deep(.uni-input-placeholder) { color: var(--yx-auth-muted, var(--yx-text-secondary)); }
.v2-register .register-input.is-focused, .v2-register .register-input:focus-within { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 2px; }
.register-password { position: relative; min-width: 0; }
.v2-register .register-password .register-input { padding-right: 44px; }
.v2-register .register-password-toggle { position: absolute; top: 50%; right: 0; z-index: 1; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; }
.v2-register .register-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.register-password-hint, .register-legal-note { color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.register-legal { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.register-field-error, .register-server-error { display: block; color: var(--yx-danger, var(--v2-bad)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.register-field-error.is-clear { visibility: hidden; }
.v2-register .register-text-button { display: inline-flex; width: auto; min-width: 44px; min-height: 44px; margin: 0; padding: 12px 8px; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--yx-auth-brand, var(--yx-brand)); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; overflow-wrap: anywhere; }
.v2-register .register-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 14px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 14px; background-color: var(--yx-auth-cta-color, var(--yx-brand)); background-image: var(--yx-auth-cta-image, none); color: var(--yx-auth-on-cta, var(--yx-inverse)); box-shadow: var(--yx-auth-shadow-cta, none); font-size: 16px; line-height: 1.5; font-weight: 700; }
.v2-register .register-submit:active:not([disabled]) { transform: none; }
.v2-register button[disabled] { cursor: default; }
.v2-register .register-submit[disabled] { opacity: .6; }
.v2-register button:focus-visible { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 3px; }
.register-signin { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 4px; min-height: 44px; color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; }
@media (max-width: 359px) {
  .register-hero { padding-right: 16px; padding-left: 16px; }
  .register-panel { padding-right: 16px; padding-left: 16px; }
  .register-brand { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-register .register-fx, .v2-register .register-logo__glow { display: none; }
  .v2-register * { transition: none; animation: none; }
}
</style>
