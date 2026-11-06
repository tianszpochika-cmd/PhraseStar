<script setup lang="ts">
import FigmaAsset from '../../components/FigmaAsset.vue'
import { loginAssets, loginDarkAssets } from '../../theme/figma-r4-assets'
import { openUniPage } from '../../platform/uni-runtime'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { usePointerFeedback } from '../../platform/pointer-feedback'
import { safeMobileRouteReturnTo } from '../../auth/gateway-auth'
import { mobileAuthFailureCopy } from '../../auth/auth-failure-copy'
import { useSessionStore } from '../../stores/session'

const requestRoot = '/static/figma-reset-request-98-3187'
const confirmRoot = '/static/figma-reset-confirm-98-3496'
const requestAssets = {
  logo: `${requestRoot}/c6b72e83-7579-49a6-8f77-93d0cf7a32b9.png`,
  mesh: `${requestRoot}/24ba3707-5595-45e0-8071-77974a83c135.svg`,
  blobA: `${requestRoot}/6e250af8-330c-474d-a954-30ab74ad665e.svg`,
  blobB: `${requestRoot}/fed73ed8-3c36-42c5-bcc2-ef2558a04904.svg`,
  blobC: `${requestRoot}/c3c1ce6a-1c7e-44b1-98b3-a99e23149ee2.svg`,
  particles: `${requestRoot}/b514a046-f64e-420f-9807-7670bd14cf22.svg`,
  logoGlow: `${requestRoot}/656c9112-1523-4f77-94a4-5003d2ce1090.svg`,
  user: `${requestRoot}/f183c114-f721-41cb-84f2-976e7007f9f7.svg`,
  dot: `${requestRoot}/06e3c1bf-175f-498b-82ed-b595f062df16.svg`,
} as const
const confirmAssets = {
  shield: `${confirmRoot}/ba66caf5-da10-4df3-806b-d921328d3ef2.svg`,
  logo: `${confirmRoot}/d4fd84fd-04b3-4a40-a677-cf3fb16e078e.png`,
  mesh: `${confirmRoot}/77f1647d-4413-4f8e-9f1c-85668a1f02a5.svg`,
  blobA: `${confirmRoot}/d942ba15-6d1f-4d90-88a0-52e0d00336de.svg`,
  blobB: `${confirmRoot}/cb97f0f2-6667-44b2-be3d-155535a4cd6f.svg`,
  blobC: `${confirmRoot}/e9fb5194-39d2-4ad5-bbcd-88a2d81d5833.svg`,
  particles: `${confirmRoot}/ff4f2f62-94a5-4562-9839-bcbbc39da0a1.svg`,
  logoGlow: `${confirmRoot}/50303499-2f0b-48b3-8a7a-faee5d8366ed.svg`,
  user: `${confirmRoot}/5e30a043-b716-4efd-8a7b-3339c910a35d.svg`,
  lock: `${confirmRoot}/2506ca91-7ee3-45d9-821c-61518014dcb3.svg`,
} as const

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const session = useSessionStore()
type Field = 'identifier' | 'token' | 'newPassword'
type FieldEvent = { detail?: { value?: string }; target?: EventTarget | null }
type SubmitEvent = { detail?: { value?: Partial<Record<Field, string>> } }
const step = ref<'request' | 'confirm'>('request')
const frameAssets = computed(() => (step.value === 'confirm' ? confirmAssets : requestAssets))
// Light field glyphs stay on the reset originals. The eye slot is empty in the confirm frame, so the published login eye fills it.
// Dark and high contrast reuse loginDarkAssets. The light shield is #1C1633 and stays off those fields.
const fieldIcons = computed(() => (theme.value === 'light'
  ? { user: frameAssets.value.user, lock: confirmAssets.lock, eye: loginAssets.eye, shield: confirmAssets.shield }
  : { user: loginDarkAssets.user, lock: loginDarkAssets.lock, eye: loginDarkAssets.eye, shield: '' }))
const identifier = ref('')
const token = ref('')
const newPassword = ref('')
const showPassword = ref(false)
const focusedField = ref<Field | null>(null)
const identifierField = ref<{ $el?: HTMLElement } | null>(null)
const tokenField = ref<{ $el?: HTMLElement } | null>(null)
const passwordField = ref<{ $el?: HTMLElement } | null>(null)
const returnTo = ref('/pages/home/home')
const initialized = ref(false)
const submitting = ref(false)
const requestSent = ref(false)
const receiptShown = ref(false)
const resetCompleted = ref(false)
const validationAttempted = ref(false)
const serverFailure = ref<unknown | null>(null)
const failureAction = ref<'resetRequest' | 'resetConfirm'>('resetRequest')
const serverError = computed(() => serverFailure.value === null ? null : mobileAuthFailureCopy(failureAction.value, serverFailure.value, mobileT))
const identifierError = computed(() => {
  if (!validationAttempted.value) return null
  const length = identifier.value.trim().length
  if (!length) return mobileT('auth.resetPassword.requiredIdentifier')
  return length < 3 || length > 128 ? mobileT('auth.resetPassword.identifierLength') : null
})
const tokenError = computed(() => {
  if (!validationAttempted.value || step.value !== 'confirm') return null
  const length = token.value.trim().length
  if (!length) return mobileT('auth.resetPassword.requiredToken')
  return length < 32 || length > 512 ? mobileT('auth.resetPassword.tokenLength') : null
})
const passwordError = computed(() => {
  if (!validationAttempted.value || step.value !== 'confirm') return null
  if (!newPassword.value) return mobileT('auth.resetPassword.requiredNewPassword')
  if (newPassword.value.length < 12) return mobileT('auth.resetPassword.shortPassword')
  return newPassword.value.length > 128 ? mobileT('auth.resetPassword.passwordLength') : null
})
// Preserve the natural height of a reported error after correction. A uni blur
// can flush input state between pointerdown and click; removing its error row
// then would move the button under the pointer. Initially there are no rows.
const lastIdentifierError = ref('')
const lastTokenError = ref('')
const lastPasswordError = ref('')
// Keep reported feedback geometry while any field is being edited, including
// dependent-field errors. Blur or explicit submit reports the current messages.
// Corrected fields hide their old text but retain its natural layout space.
function reportFieldErrors(): void {
  if (submitting.value) return
  if (identifierError.value) lastIdentifierError.value = identifierError.value
  if (tokenError.value) lastTokenError.value = tokenError.value
  if (passwordError.value) lastPasswordError.value = passwordError.value
}
watch([identifierError, tokenError, passwordError], () => { if (focusedField.value === null) reportFieldErrors() })
watch(identifier, () => { requestSent.value = false })
watch(requestSent, (value) => { if (value) receiptShown.value = true })
function currentFeedback() {
  return {
    active: validationAttempted.value,
    fields: {
      identifier: { current: identifierError.value ? lastIdentifierError.value || null : null, last: lastIdentifierError.value },
      token: { current: tokenError.value ? lastTokenError.value || null : null, last: lastTokenError.value },
      newPassword: { current: passwordError.value ? lastPasswordError.value || null : null, last: lastPasswordError.value },
    },
    server: serverError.value,
    receipt: receiptShown.value,
  }
}
const pageRoot = ref<{ $el?: HTMLElement } | null>(null)
const pointerFeedback = usePointerFeedback({
  root: () => pageRoot.value?.$el ?? null,
  actions: '.reset-submit,.reset-text-button,.reset-password-toggle',
  capture: currentFeedback,
  disabled: () => submitting.value || resetCompleted.value,
  afterRelease: () => {
    // #ifdef H5
    syncNativeInputs()
    // #endif
  },
})
const visualFeedback = computed(() => pointerFeedback.value ?? currentFeedback())
let passwordControls = 'mobile-reset-newPassword-host'
// #ifdef H5
passwordControls = 'mobile-reset-newPassword'
function syncNativeInput(host: { $el?: HTMLElement } | null, kind: Field): void {
  const input = host?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const fieldError = visualFeedback.value.fields[kind].current
  const description = [kind === 'newPassword' ? 'mobile-reset-password-hint' : null, fieldError ? `mobile-reset-${kind}-error` : null].filter(Boolean).join(' ')
  const attributes: Record<string, string | null> = {
    id: `mobile-reset-${kind}`,
    name: kind,
    autocomplete: kind === 'identifier' ? 'username' : kind === 'token' ? 'one-time-code' : 'new-password',
    autocapitalize: 'none',
    spellcheck: 'false',
    required: '',
    minlength: kind === 'newPassword' ? '12' : null,
    'aria-label': mobileT(`auth.resetPassword.${kind}`),
    'aria-labelledby': `mobile-reset-${kind}-label`,
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
  syncNativeInput(tokenField.value, 'token')
  syncNativeInput(passwordField.value, 'newPassword')
}
watch([
  step, identifier, token, newPassword, identifierError, tokenError, passwordError,
  showPassword, focusedField, submitting, resetCompleted, visualFeedback,
  () => mobileT('auth.resetPassword.identifier'), () => mobileT('auth.resetPassword.token'), () => mobileT('auth.resetPassword.newPassword'),
], async () => { await nextTick(); syncNativeInputs() }, { flush: 'post' })
// #endif

function initialize(options?: { token?: string; returnTo?: string; redirect?: string }): void {
  if (initialized.value) return
  initialized.value = true
  const requested = safeMobileRouteReturnTo(options?.returnTo ?? options?.redirect, '')
  returnTo.value = requested || safeMobileRouteReturnTo(session.peekReturnTo())
  session.setReturnTo(returnTo.value)
  if (typeof options?.token === 'string' && options.token.trim()) {
    token.value = options.token
    step.value = 'confirm'
  }
}
function syncNavigationTitle(): void {
  uni.setNavigationBarTitle({ title: mobileT(step.value === 'request' ? 'auth.resetPassword.title' : 'auth.resetPassword.confirmTitle') })
}
onLoad((options) => { initialize(options) })
onShow(() => { syncNavigationTitle() })
watch([step, () => mobileT('auth.resetPassword.title'), () => mobileT('auth.resetPassword.confirmTitle')], syncNavigationTitle)
onMounted(() => {
  initialize()
  // #ifdef H5
  syncNativeInputs()
  // #endif
})
async function focusField(kind: Field): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  focusedField.value = null
  await nextTick()
  if (!submitting.value && !resetCompleted.value) focusedField.value = kind
}
function syncField(kind: Field, value: unknown): void {
  if (submitting.value || resetCompleted.value || typeof value !== 'string') return
  if (kind === 'identifier') identifier.value = value
  else if (step.value === 'confirm' && kind === 'token') token.value = value
  else if (step.value === 'confirm') newPassword.value = value
}
function inputField(kind: Field, event: FieldEvent): void {
  const target = event.target as { value?: string } | null
  const value = typeof event.detail?.value === 'string' ? event.detail.value : typeof target?.value === 'string' ? target.value : undefined
  syncField(kind, value)
}
function blurField(kind: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  if (focusedField.value === kind) focusedField.value = null
  reportFieldErrors()
}
function confirmField(kind: Field, event: FieldEvent): void {
  syncField(kind, event.detail?.value)
  if (step.value === 'request' || kind === 'newPassword') void submit()
  else void focusField(kind === 'identifier' ? 'token' : 'newPassword')
}
function clearValidation(): void {
  validationAttempted.value = false
  lastIdentifierError.value = ''
  lastTokenError.value = ''
  lastPasswordError.value = ''
}
async function switchStep(): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  serverFailure.value = null
  requestSent.value = false
  receiptShown.value = false
  showPassword.value = false
  focusedField.value = null
  clearValidation()
  step.value = step.value === 'request' ? 'confirm' : 'request'
  if (step.value === 'request') { token.value = ''; newPassword.value = '' }
  await focusField(step.value === 'confirm' && identifier.value.trim() ? 'token' : 'identifier')
}
function togglePassword(): void { if (!submitting.value) showPassword.value = !showPassword.value }
function returnLogin(): void {
  if (!submitting.value) openUniPage(`/pages/login/login?returnTo=${encodeURIComponent(returnTo.value)}`)
}
function forgetDisplayedResetToken(): void {
  // #ifdef H5
  try {
    const hash = window.location.hash
    const queryAt = hash.indexOf('?')
    if (queryAt < 0) return
    const params = new URLSearchParams(hash.slice(queryAt + 1))
    if (!params.has('token')) return
    params.delete('token')
    const query = params.toString()
    const nextHash = `${hash.slice(0, queryAt)}${query ? `?${query}` : ''}`
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}${nextHash}`)
  } catch {
    // The confirmation receipt stays even if this page cannot rewrite its own hash.
  }
  // #endif
}
// A keydown activation can focus the first error before this key's keyup.
// uni-input would then treat that keyup as confirm and skip the first error.
function submitKeyDown(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
}
function submitKeyUp(event: KeyboardEvent): void {
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  event.stopPropagation()
  void submit()
}
async function submit(event?: SubmitEvent): Promise<void> {
  if (submitting.value || resetCompleted.value) return
  const activeStep = step.value
  for (const kind of ['identifier', 'token', 'newPassword'] as const) syncField(kind, event?.detail?.value?.[kind])
  validationAttempted.value = true
  serverFailure.value = null
  if (activeStep === 'request') { requestSent.value = false; receiptShown.value = false }
  reportFieldErrors()
  const firstError = identifierError.value ? 'identifier' : tokenError.value ? 'token' : passwordError.value ? 'newPassword' : null
  if (firstError) { await focusField(firstError); return }
  if (submitting.value || step.value !== activeStep) return
  submitting.value = true
  failureAction.value = activeStep === 'request' ? 'resetRequest' : 'resetConfirm'
  try {
    // Password reset stays on the existing IAM TLS client with bounded requests.
    // Any 2xx is still treated as accepted by that client. This page does not close that gap.
    const success = activeStep === 'request'
      ? await session.requestPasswordReset(identifier.value)
      : await session.confirmPasswordReset(identifier.value, token.value, newPassword.value)
    if (!success) { serverFailure.value = session.lastError ?? 'UNKNOWN_AUTH_ERROR'; return }
    if (activeStep === 'request') requestSent.value = true
    else {
      resetCompleted.value = true
      identifier.value = ''
      token.value = ''
      newPassword.value = ''
      showPassword.value = false
      focusedField.value = null
      requestSent.value = false
      receiptShown.value = false
      clearValidation()
      forgetDisplayedResetToken()
    }
  } catch (cause) {
    serverFailure.value = cause ?? 'UNKNOWN_AUTH_ERROR'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view ref="pageRoot" class="yx-page yx-r4-screen v2-reset" :style="experienceStyle" :data-motion="experienceMotion" :data-theme="theme">
    <view class="reset-fx" aria-hidden="true">
      <view class="reset-fx__mesh"><FigmaAsset :src="frameAssets.mesh" :width="630" :height="615" /></view>
      <view class="reset-fx__blob reset-fx__blob--a"><FigmaAsset :src="frameAssets.blobA" :width="320" :height="320" /></view>
      <view class="reset-fx__blob reset-fx__blob--b"><FigmaAsset :src="frameAssets.blobB" :width="400" :height="400" /></view>
      <view class="reset-fx__blob reset-fx__blob--c"><FigmaAsset :src="frameAssets.blobC" :width="440" :height="440" /></view>
      <view class="reset-fx__particles"><FigmaAsset :src="frameAssets.particles" :width="180" :height="140" /></view>
    </view>
    <view class="reset-column reset-content">
      <view class="reset-hero">
        <view class="reset-brand">
          <view class="reset-logo">
            <view class="reset-logo__glow"><FigmaAsset :src="frameAssets.logoGlow" :width="88" :height="88" /></view>
            <FigmaAsset :src="frameAssets.logo" :width="54" :height="54" />
          </view>
          <view class="reset-wordmark">
            <text>{{ mobileT('brand') }}</text>
            <text class="reset-wordmark__en">{{ mobileT('brandEnglish') }}</text>
          </view>
        </view>
        <text id="mobile-reset-title" class="reset-title" role="heading" aria-level="1">{{ mobileT(step === 'request' ? 'auth.resetPassword.title' : 'auth.resetPassword.confirmTitle') }}</text>
        <text v-if="!resetCompleted" class="reset-description">{{ mobileT(step === 'request' ? 'auth.resetPassword.requestSubtitle' : 'auth.resetPassword.confirmSubtitle') }}</text>
        <text class="reset-adult-note">{{ mobileT('auth.resetPassword.note') }}</text>
      </view>
      <view class="reset-panel" aria-labelledby="mobile-reset-title">
        <text class="reset-panel__title">{{ mobileT(step === 'request' ? 'auth.resetPassword.panelTitle' : 'auth.resetPassword.confirmPanelTitle') }}</text>
        <text v-if="!resetCompleted" class="reset-panel__hint">{{ mobileT(step === 'request' ? 'auth.resetPassword.requestPanelHint' : 'auth.resetPassword.confirmPanelHint') }}</text>
        <text v-if="resetCompleted" class="reset-success" role="status">{{ mobileT('auth.resetPassword.completedStatus') }}</text>
        <form v-else class="reset-form" :aria-busy="submitting" @submit="submit">
          <!-- Uni submit is a component event. The inner view carries the stack because uni-form wraps the slot in one span. -->
          <view class="reset-form__body">
            <view class="reset-fields">
              <view class="reset-field">
                <label id="mobile-reset-identifier-label" class="reset-label" for="mobile-reset-identifier-host" @click="focusField('identifier')">{{ mobileT('auth.resetPassword.identifier') }}</label>
                <view class="reset-control" :class="{ 'is-invalid': visualFeedback.fields.identifier.current }">
                  <FigmaAsset :src="fieldIcons.user" :width="20" :height="20" />
                  <input id="mobile-reset-identifier-host" ref="identifierField" v-model="identifier" name="identifier" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.identifier.current, 'is-focused': focusedField === 'identifier' }" type="text" text-content-type="username" :confirm-type="step === 'request' ? 'go' : 'next'" :focus="focusedField === 'identifier'" :placeholder="mobileT(step === 'request' ? 'auth.resetPassword.requestIdentifierPlaceholder' : 'auth.resetPassword.confirmIdentifierPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.identifier.current ? true : undefined" :aria-describedby="visualFeedback.fields.identifier.current ? 'mobile-reset-identifier-error' : undefined" @focus="focusedField = 'identifier'" @input="inputField('identifier', $event)" @blur="blurField('identifier', $event)" @confirm="confirmField('identifier', $event)" />
                </view>
                <text v-if="visualFeedback.active && visualFeedback.fields.identifier.last" id="mobile-reset-identifier-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.identifier.current }" :role="visualFeedback.fields.identifier.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.identifier.current">{{ visualFeedback.fields.identifier.current || visualFeedback.fields.identifier.last }}</text>
              </view>
              <view v-if="step === 'confirm'" class="reset-field">
                <label id="mobile-reset-token-label" class="reset-label" for="mobile-reset-token-host" @click="focusField('token')">{{ mobileT('auth.resetPassword.token') }}</label>
                <view class="reset-control reset-control--token" :class="{ 'is-invalid': visualFeedback.fields.token.current }">
                  <FigmaAsset v-if="fieldIcons.shield" :src="fieldIcons.shield" :width="20" :height="20" />
                  <input id="mobile-reset-token-host" ref="tokenField" v-model="token" name="token" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.token.current, 'is-focused': focusedField === 'token' }" type="text" text-content-type="oneTimeCode" confirm-type="next" :focus="focusedField === 'token'" :placeholder="mobileT('auth.resetPassword.tokenPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.token.current ? true : undefined" :aria-describedby="visualFeedback.fields.token.current ? 'mobile-reset-token-error' : undefined" @focus="focusedField = 'token'" @input="inputField('token', $event)" @blur="blurField('token', $event)" @confirm="confirmField('token', $event)" />
                </view>
                <text v-if="visualFeedback.active && visualFeedback.fields.token.last" id="mobile-reset-token-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.token.current }" :role="visualFeedback.fields.token.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.token.current">{{ visualFeedback.fields.token.current || visualFeedback.fields.token.last }}</text>
              </view>
              <view v-if="step === 'confirm'" class="reset-field">
                <label id="mobile-reset-newPassword-label" class="reset-label" for="mobile-reset-newPassword-host" @click="focusField('newPassword')">{{ mobileT('auth.resetPassword.newPassword') }}</label>
                <view class="reset-password">
                  <view class="reset-control reset-control--secret" :class="{ 'is-invalid': visualFeedback.fields.newPassword.current }">
                    <FigmaAsset :src="fieldIcons.lock" :width="20" :height="20" />
                    <input id="mobile-reset-newPassword-host" ref="passwordField" v-model="newPassword" name="newPassword" :maxlength="-1" class="reset-input" :class="{ 'is-invalid': visualFeedback.fields.newPassword.current, 'is-focused': focusedField === 'newPassword' }" type="text" :password="!showPassword" text-content-type="newPassword" confirm-type="go" :focus="focusedField === 'newPassword'" :placeholder="mobileT('auth.resetPassword.newPasswordPlaceholder')" :disabled="submitting" :aria-invalid="visualFeedback.fields.newPassword.current ? true : undefined" :aria-describedby="visualFeedback.fields.newPassword.current ? 'mobile-reset-password-hint mobile-reset-newPassword-error' : 'mobile-reset-password-hint'" @focus="focusedField = 'newPassword'" @input="inputField('newPassword', $event)" @blur="blurField('newPassword', $event)" @confirm="confirmField('newPassword', $event)" />
                    <button class="reset-password-toggle" tabindex="0" role="button" :aria-controls="passwordControls" :aria-label="mobileT(showPassword ? 'auth.resetPassword.hidePassword' : 'auth.resetPassword.showPassword')" :aria-pressed="showPassword" :disabled="submitting" :aria-disabled="submitting" @click="togglePassword"><FigmaAsset :src="fieldIcons.eye" :width="20" :height="20" /></button>
                  </view>
                </view>
                <text id="mobile-reset-password-hint" class="reset-password-hint">{{ mobileT('auth.resetPassword.passwordHint') }}</text>
                <text v-if="visualFeedback.active && visualFeedback.fields.newPassword.last" id="mobile-reset-newPassword-error" class="reset-field-error" :class="{ 'is-clear': !visualFeedback.fields.newPassword.current }" :role="visualFeedback.fields.newPassword.current ? 'alert' : undefined" :aria-hidden="!visualFeedback.fields.newPassword.current">{{ visualFeedback.fields.newPassword.current || visualFeedback.fields.newPassword.last }}</text>
              </view>
            </view>
            <view v-if="step === 'request'" class="reset-privacy"><FigmaAsset v-if="theme === 'light'" :src="requestAssets.dot" :width="8" :height="8" /><text>{{ mobileT('auth.login.privacyNote') }}</text></view>
            <text v-if="visualFeedback.server" class="reset-server-error" role="alert">{{ visualFeedback.server }}</text>
            <text v-if="visualFeedback.receipt && step === 'request'" class="reset-receipt" :class="{ 'is-clear': !requestSent }" :role="requestSent ? 'status' : undefined" :aria-hidden="!requestSent">{{ mobileT('resetSent') }}</text>
            <button class="reset-submit" tabindex="0" role="button" form-type="submit" :disabled="submitting" :aria-disabled="submitting" @keydown="submitKeyDown" @keyup="submitKeyUp">{{ mobileT(step === 'request' ? submitting ? 'auth.resetPassword.sending' : 'auth.resetPassword.sendInstructions' : submitting ? 'auth.resetPassword.resetting' : 'auth.resetPassword.resetAction') }}</button>
            <view class="reset-switch"><button class="reset-step-button reset-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="switchStep">{{ mobileT(step === 'request' ? 'auth.resetPassword.receivedCode' : 'auth.resetPassword.back') }}</button></view>
          </view>
        </form>
        <view class="reset-exit"><button class="reset-login-button reset-text-button" tabindex="0" role="button" :disabled="submitting" :aria-disabled="submitting" @click="returnLogin">{{ mobileT('auth.resetPassword.returnLogin') }}</button></view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.v2-reset, .yx-page.v2-reset * { box-sizing: border-box; }
.yx-page.v2-reset {
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
.reset-fx { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.reset-fx__mesh { position: absolute; left: -130px; top: -170px; }
.reset-fx__blob { position: absolute; }
.reset-fx__blob--a { left: 144px; top: -50px; }
.reset-fx__blob--b { left: 150px; top: -130px; }
.reset-fx__blob--c { left: -240px; top: -250px; }
.reset-fx__particles { position: absolute; left: 194px; top: 40px; opacity: .9; }
.v2-reset[data-motion="reduced"] .reset-fx,
.v2-reset[data-motion="off"] .reset-fx,
.v2-reset[data-theme="dark"] .reset-fx,
.v2-reset[data-theme="high-contrast"] .reset-fx,
.v2-reset[data-motion="reduced"] .reset-logo__glow,
.v2-reset[data-motion="off"] .reset-logo__glow,
.v2-reset[data-theme="dark"] .reset-logo__glow,
.v2-reset[data-theme="high-contrast"] .reset-logo__glow { display: none; }
.reset-column { position: relative; display: flex; width: 100%; max-width: 390px; margin: 0 auto; flex-direction: column; gap: 14px; }
.reset-hero { display: flex; min-width: 0; flex-direction: column; align-items: flex-start; gap: 14px; padding: 8px 24px 0; }
.reset-brand { display: flex; min-width: 0; min-height: 54px; align-items: center; gap: 10px; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 30px; font-weight: 700; line-height: 1.2; }
.reset-logo { position: relative; width: 54px; height: 54px; flex: 0 0 54px; }
.reset-logo__glow { position: absolute; left: -17px; top: -17px; }
.reset-wordmark { display: flex; min-width: 0; flex-direction: column; }
.reset-wordmark text { overflow-wrap: anywhere; }
.reset-wordmark__en { color: var(--yx-auth-wordmark, var(--yx-auth-ink)); font-size: 11px; font-weight: 500; line-height: 16px; }
.reset-title { display: block; margin: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); text-align: left; font-size: 24px; line-height: 40px; font-weight: 700; letter-spacing: .5px; overflow-wrap: anywhere; }
.reset-description, .reset-adult-note, .reset-panel__hint { display: block; color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.reset-panel { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 14px; padding: 24px; border: 1px solid var(--yx-auth-glass-border, var(--yx-border)); border-radius: 28px 28px 20px 20px; background: var(--yx-auth-glass, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-card, none); backdrop-filter: blur(var(--yx-auth-blur, 0px)); -webkit-backdrop-filter: blur(var(--yx-auth-blur, 0px)); }
.reset-panel__title { display: block; margin: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 20px; font-weight: 700; line-height: 1.4; overflow-wrap: anywhere; }
.reset-form { display: flex; min-width: 0; flex-direction: column; }
.reset-form__body, .reset-fields { display: flex; width: 100%; min-width: 0; flex-direction: column; gap: 14px; }
.reset-field { display: grid; gap: 8px; min-width: 0; }
.reset-label { color: var(--yx-auth-ink, var(--yx-text-primary)); font-size: 14px; line-height: 1.6; font-weight: 500; }
.reset-control { position: relative; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border: 1px solid var(--yx-auth-field-border, var(--yx-border)); border-radius: 14px; background: var(--yx-auth-field, var(--yx-surface-card)); box-shadow: var(--yx-auth-shadow-field, none); }
.reset-control--secret { padding-right: 4px; }
.reset-control.is-invalid { border-color: var(--yx-danger, var(--v2-bad)); }
.v2-reset .reset-input { width: auto; flex: 1 1 auto; height: 48px; min-width: 0; min-height: 48px; padding: 0; border: 0; border-radius: 0; color: var(--yx-auth-ink, var(--yx-text-primary)); background: transparent; font-size: 16px; line-height: 1.5; font-weight: 400; }
.reset-input :deep(.uni-input-input), .reset-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.reset-input :deep(.uni-input-placeholder) { color: var(--yx-auth-muted, var(--yx-text-secondary)); }
.v2-reset .reset-input.is-focused, .v2-reset .reset-input:focus-within { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 2px; }
.reset-password { position: relative; min-width: 0; }
.v2-reset .reset-password .reset-input { padding-right: 44px; }
.v2-reset .reset-password-toggle { position: absolute; top: 50%; right: 0; z-index: 1; display: flex; width: 44px; height: 44px; min-height: 44px; padding: 0; align-items: center; justify-content: center; transform: translateY(-50%); border: 0; border-radius: 8px; background: transparent; }
.v2-reset .reset-password-toggle:active:not([disabled]) { transform: translateY(-50%); background: var(--v2-soft); }
.reset-password-hint { color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 12px; line-height: 1.6; overflow-wrap: anywhere; }
.reset-privacy { display: flex; align-items: flex-start; gap: 10px; padding: 10px 14px; border-radius: 12px; background: var(--yx-auth-tip, var(--yx-surface-soft)); color: var(--yx-auth-tip-ink, var(--yx-text-primary)); font-size: 12px; line-height: 1.6; }
.reset-privacy text { min-width: 0; overflow-wrap: anywhere; }
.reset-field-error, .reset-server-error { display: block; color: var(--yx-danger, var(--v2-bad)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
.reset-field-error.is-clear, .reset-receipt.is-clear { visibility: hidden; }
.v2-reset .reset-text-button { display: inline-flex; width: auto; max-width: 100%; min-width: 44px; min-height: 44px; margin: 0; padding: 12px 8px; align-items: center; justify-content: center; border: 0; border-radius: 0; background: transparent; color: var(--yx-auth-brand, var(--yx-brand)); font-size: 14px; line-height: 1.6; font-weight: 500; text-align: center; overflow-wrap: anywhere; white-space: normal; }
.v2-reset .reset-submit { display: flex; width: 100%; min-height: 48px; margin: 0; padding: 14px 20px; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 14px; background-color: var(--yx-auth-cta-color, var(--yx-brand)); background-image: var(--yx-auth-cta-image, none); color: var(--yx-auth-on-cta, var(--yx-inverse)); box-shadow: var(--yx-auth-shadow-cta, none); font-size: 16px; line-height: 1.5; font-weight: 700; }
.v2-reset .reset-submit:active:not([disabled]) { transform: none; }
.v2-reset button[disabled] { cursor: default; }
.v2-reset .reset-submit[disabled] { opacity: .6; }
.v2-reset button:focus-visible { outline: 2px solid var(--yx-auth-brand, var(--yx-brand)); outline-offset: 3px; }
.reset-switch, .reset-exit { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; min-height: 44px; }
.reset-success, .reset-receipt { display: block; color: var(--yx-auth-muted, var(--yx-text-secondary)); font-size: 14px; line-height: 1.6; overflow-wrap: anywhere; }
@media (max-width: 359px) {
  .reset-hero { padding-right: 16px; padding-left: 16px; }
  .reset-panel { padding-right: 16px; padding-left: 16px; }
  .reset-brand { font-size: 24px; }
}
@media (prefers-reduced-motion: reduce) {
  .v2-reset .reset-fx, .v2-reset .reset-logo__glow { display: none; }
  .v2-reset * { transition: none; animation: none; }
}
</style>
