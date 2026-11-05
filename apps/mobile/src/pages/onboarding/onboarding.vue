<script setup lang="ts">
import FigmaAsset from '../../components/FigmaAsset.vue'
import { goalArt, onboardingChrome, onboardingFrameRef } from '../../domain/onboarding-page'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import type { B8Consent, B8PublishedConsentDocument } from '@englishflow/contracts'
import { interpolate } from '@englishflow/i18n'
import { mobileI18n } from '../../platform/v2-foundation'
import { mobileApiClient } from '../../api/client'
import { consentGrantMatchesPublication, explicitIncompleteConsent, mobileLearnerContentApi } from '../../api/learner-content'
import { createClientId } from '../../platform/client-id'
import { getUniRuntime } from '../../platform/uni-runtime'
import { usePointerFeedback } from '../../platform/pointer-feedback'
import { currentBirthYearMax, isSubmittableBirthYear } from '../../domain/adult-birth-year'
import { canonicalGoalOptions, mapUiGoal, prefillSavedTarget, requiredConsentsComplete, selectOnboardingResumeStep, type OnboardingResumeStep } from '../../domain/onboarding-resume'
import { useLearnerContentStore } from '../../stores/learner-content'
import { useSessionStore } from '../../stores/session'

const { experienceStyle, experienceMotion, theme } = useMobileExperience()
const ONBOARDING_PATH = '/pages/onboarding/onboarding'
const store = useLearnerContentStore()
const session = useSessionStore()
const step = ref<OnboardingResumeStep>('gate')
const goal = ref<string | null>(null)
const quota = ref(15)
const savedGoal = ref<string | null>(null)
const savedQuota = ref<number | null>(null)
const birthYear = ref('')
const ageConfirmed = ref(false)
const yearFocused = ref(false)
const yearField = ref<{ $el?: HTMLElement } | null>(null)
const pageRoot = ref<{ $el?: HTMLElement } | null>(null)
const saving = ref(false)
const reading = ref(false)
const restoring = ref(false)
const attempted = ref(false)
const actionError = ref<string | null>(null)
const lastYearError = ref('')
const lastAgeError = ref('')
const recordsOpen = ref(false)
const recordsError = ref(false)
const accountMenuOpen = ref(false)
const publicationHold = ref(false)
const publicationStale = ref(false)
const consentRefreshPending = ref(false)
const consentWritesSettled = ref(false)
const openDocumentType = ref<B8PublishedConsentDocument['type'] | null>(null)
const reviewedDocuments = ref<Partial<Record<B8PublishedConsentDocument['type'], { version: string; digest: string; policyVersion: string; policyRef: string }>>>({})
const consentDecisionId = ref<string | null>(null)
const consentDecisionFingerprint = ref<string | null>(null)
type ConsentRecord = Pick<B8Consent, 'type' | 'purpose' | 'required' | 'document' | 'state' | 'provenance' | 'policyRef' | 'policyVersion' | 'decisionRef'>
const consentRecords = ref<ConsentRecord[]>([])
let active = false
let generation = 0
let showRequest = 0
const birthYearMax = currentBirthYearMax()
const busy = computed(() => saving.value || reading.value || restoring.value || store.onboardingStatus === 'loading')
const yearValid = computed(() => isSubmittableBirthYear(birthYear.value.trim() ? Number(birthYear.value) : null, birthYearMax))
const yearError = computed(() => attempted.value && !yearValid.value ? interpolate(mobileT('onboarding.yearError'), { max: birthYearMax }) : null)
const ageError = computed(() => attempted.value && !ageConfirmed.value ? mobileT('onboarding.ageError') : null)
const goalOptions = canonicalGoalOptions([])
const rank = computed(() => step.value === 'gate' ? 0 : step.value === 'consent' ? 1 : step.value === 'goal' ? 2 : 3)
const consentCurrent = computed(() => Boolean(store.onboardingResume && !store.onboardingResume.sessionRefreshRequired && requiredConsentsComplete(store.onboardingResume.consent) && session.adultGate === 'PASSED' && session.isLearningReady))
const targetUnreadable = computed(() => store.onboardingResume?.target.readable === false)
const primaryLabel = computed(() => mobileT(`onboarding.${saving.value ? step.value === 'goal' ? 'saving' : 'confirming' : step.value === 'gate' ? 'confirm' : step.value === 'goal' ? 'saveStart' : step.value === 'assessment' ? 'start' : 'continue'}`))
const localGoalDraft = computed(() => step.value === 'goal' && (goal.value !== savedGoal.value || quota.value !== (savedQuota.value ?? 15)))
function currentMobilePagePath(fallback: string): string {
  // Hash wins because onHide can lag it. This stays page-local so navigation.ts is unchanged.
  const normalize = (value: unknown, empty: string): string => {
    if (typeof value !== 'string' || !value.trim()) return empty
    const raw = value.trim().replace(/^https?:\/\/[^/]+/i, '')
    const path = raw.split(/[?#]/, 1)[0] || empty
    if (path === '/') return empty
    return path.startsWith('/') ? path : `/${path}`
  }
  if (typeof window !== 'undefined' && window.location) {
    const hashPath = normalize(window.location.hash.replace(/^#/, ''), '')
    if (hashPath) return hashPath
  }
  const read = (globalThis as typeof globalThis & { getCurrentPages?: () => Array<{ route?: string }> }).getCurrentPages
  return normalize(read?.()?.at(-1)?.route, fallback)
}
function stillOnOnboarding(): boolean {
  const read = (globalThis as typeof globalThis & { getCurrentPages?: () => Array<{ route?: string }> }).getCurrentPages
  if (typeof window === 'undefined' && typeof read !== 'function') return true
  return currentMobilePagePath('/pages/login/login') === ONBOARDING_PATH
}
async function closeAccountMenu(): Promise<void> {
  if (!accountMenuOpen.value) return
  accountMenuOpen.value = false
  await nextTick()
  // #ifdef H5
  pageRoot.value?.$el?.querySelector<HTMLElement>('.onboarding-more')?.focus()
  // #endif
}
async function toggleAccountMenu(): Promise<void> {
  if (busy.value) return
  if (accountMenuOpen.value) { await closeAccountMenu(); return }
  accountMenuOpen.value = true
  await nextTick()
  // #ifdef H5
  // Compiled H5 host is uni-button, so a button tag selector never receives focus.
  pageRoot.value?.$el?.querySelector<HTMLElement>('#mobile-onboarding-account-settings')?.focus()
  // #endif
}
function keepMoreKey(event: { preventDefault?: () => void }): void {
  // #ifdef H5
  event.preventDefault?.()
  // #endif
}
function openAccountMenuFromKey(event: { preventDefault?: () => void }): void {
  // #ifdef H5
  event.preventDefault?.()
  void toggleAccountMenu()
  // #endif
}
function minuteLabel(value: number | null): string { return interpolate(mobileT('onboarding.minutes'), { count: value === null ? '' : mobileI18n.formatNumber(value) }) }
function reportErrors(): void {
  if (yearError.value) lastYearError.value = yearError.value
  if (ageError.value) lastAgeError.value = ageError.value
}
watch([yearError, ageError], () => { if (!yearFocused.value) reportErrors() })
function currentFeedback() {
  return { year: yearError.value ? lastYearError.value || null : null, lastYear: lastYearError.value, age: ageError.value ? lastAgeError.value || null : null, lastAge: lastAgeError.value, action: actionError.value }
}
const pointerFeedback = usePointerFeedback({ root: () => pageRoot.value?.$el ?? null, actions: '.onboarding-primary,.onboarding-text,.onboarding-record-toggle,.onboarding-document', capture: currentFeedback, disabled: () => busy.value, afterRelease: () => { syncNativeYear() } })
const feedback = computed(() => pointerFeedback.value ?? currentFeedback())
function syncNativeYear(): void {
  // #ifdef H5
  const input = yearField.value?.$el?.querySelector<HTMLInputElement>('.uni-input-input')
  if (!input) return
  const attrs: Record<string, string | null> = { id: 'mobile-onboarding-year', name: 'birthYear', autocomplete: 'bday-year', inputmode: 'numeric', required: '', 'aria-label': mobileT('onboarding.year'), 'aria-labelledby': 'mobile-onboarding-year-label', 'aria-invalid': feedback.value.year ? 'true' : null, 'aria-describedby': feedback.value.year ? 'mobile-onboarding-year-error' : null }
  for (const [key, value] of Object.entries(attrs)) { if (value === null) input.removeAttribute(key); else input.setAttribute(key, value) }
  // #endif
}
watch([birthYear, yearFocused, feedback, busy, () => mobileT('onboarding.year')], async () => { await nextTick(); syncNativeYear() }, { flush: 'post' })
onMounted(syncNativeYear)
watch(step, async () => {
  accountMenuOpen.value = false
  const request = generation
  const revision = session.identityRevision
  await nextTick()
  if (!current(request, revision)) return
  // #ifdef H5
  const title = pageRoot.value?.$el?.querySelector<HTMLElement>('#mobile-onboarding-title')
  title?.focus({ preventScroll: true })
  title?.scrollIntoView({ block: 'start' })
  // #endif
  const report = (): void => { if (current(request, revision)) actionError.value = mobileT('onboarding.navigationFailed') }
  try {
    const result: unknown = uni.setNavigationBarTitle({ title: mobileT(`onboarding.${step.value}Title`), fail: report })
    if (result && typeof (result as Promise<unknown>).then === 'function') void (result as Promise<unknown>).then(() => undefined, report)
  } catch { report() }
})
function current(request: number, revision: number): boolean { return active && stillOnOnboarding() && request === generation && revision === session.identityRevision && session.isAuthenticated }
function clearConsentReview(): void {
  openDocumentType.value = null
  reviewedDocuments.value = {}
  consentDecisionId.value = null
  consentDecisionFingerprint.value = null
}
function clearDrafts(): void {
  birthYear.value = ''; ageConfirmed.value = false; attempted.value = false; yearFocused.value = false
  lastYearError.value = ''; lastAgeError.value = ''; consentRecords.value = []; recordsOpen.value = false; recordsError.value = false
  goal.value = savedGoal.value; quota.value = savedQuota.value ?? 15
  clearConsentReview(); consentRefreshPending.value = false; consentWritesSettled.value = false; publicationStale.value = false
}
function invalidate(): void { generation++; saving.value = false; reading.value = false; publicationHold.value = true; accountMenuOpen.value = false; clearDrafts() }
watch(() => session.identityRevision, () => {
  invalidate(); savedGoal.value = null; savedQuota.value = null; goal.value = null; quota.value = 15; step.value = 'gate'; actionError.value = null
  if (active && !restoring.value && session.isAuthenticated) void loadResume()
  else if (active && !restoring.value) {
    const request = generation
    void nextTick().then(async () => {
      if (!active || request !== generation || session.isAuthenticated) return
      try { await navigate('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding', true) }
      catch { if (active && request === generation) actionError.value = mobileT('onboarding.navigationFailed') }
    })
  }
}, { flush: 'sync' })
function object(value: unknown): Record<string, unknown> | null { return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null }
function parseRecords(raw: unknown): ConsentRecord[] {
  const envelope = object(raw), data = object(envelope?.data) ?? envelope
  if (!data || !Array.isArray(data.items) || data.hasMore === true || data.nextCursor || (typeof data.total === 'number' && data.total > data.items.length)) throw new Error('Incomplete consent records')
  const types = ['TERMS', 'PRIVACY', 'ADULT_LEARNING', 'PRODUCT_ANALYTICS', 'VOICE_RECORDING'] as const
  const purposes = ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY', 'PRODUCT_ANALYTICS', 'ADULT_VOICE_RECORDING_REMOTE_STORAGE_AND_REPLAY'] as const
  return data.items.map((rawItem: unknown) => {
    const item = object(rawItem), doc = object(item?.document), provenance = object(item?.provenance)
    const index = types.findIndex(type => type === item?.type)
    if (!item || index < 0 || item.purpose !== purposes[index] || typeof item.required !== 'boolean' || !doc || !provenance || !['GRANTED', 'WITHDRAWN'].includes(String(item.state)) || provenance.authority !== 'IAM_SERVER_RECORDED_CONSENT' || provenance.documentSource !== 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST' || provenance.policySource !== 'IAM_ACTIVE_POLICY_CONTROL_PLANE') throw new Error('Unreadable consent record')
    for (const value of [doc.version, doc.digest, doc.publishedAt, provenance.recordedAt, item.policyRef, item.policyVersion, item.decisionRef]) if (typeof value !== 'string' || !value.trim()) throw new Error('Incomplete consent record')
    return { type: types[index], purpose: purposes[index], required: item.required, state: item.state as ConsentRecord['state'], document: { version: doc.version as string, digest: doc.digest as string, publishedAt: doc.publishedAt as string }, provenance: { authority: 'IAM_SERVER_RECORDED_CONSENT', documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST', policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE', recordedAt: provenance.recordedAt as string }, policyRef: item.policyRef as string, policyVersion: item.policyVersion as string, decisionRef: item.decisionRef as string }
  })
}
async function readRecords(request: number, revision: number): Promise<void> {
  consentRecords.value = []; recordsError.value = false
  try {
    const raw = await mobileApiClient.request<unknown>('/iam/consents')
    if (current(request, revision) && step.value === 'consent') consentRecords.value = parseRecords(raw)
  } catch { if (current(request, revision) && step.value === 'consent') recordsError.value = true }
}
function applySavedTarget(facts: NonNullable<typeof store.onboardingResume>): void {
  const filled = prefillSavedTarget(facts.target)
  savedGoal.value = filled.goal; savedQuota.value = filled.quota
  goal.value = filled.goal; quota.value = filled.quota ?? 15
}
class OnboardingNavigationError extends Error {}
async function navigate(url: string, login = false): Promise<void> {
  const runtime = getUniRuntime()
  try {
    if (login && runtime.reLaunch) await runtime.reLaunch({ url })
    else await runtime.navigateTo({ url })
  } catch { throw new OnboardingNavigationError('Onboarding navigation failed') }
}
async function loadResume(): Promise<void> {
  if (!active || !stillOnOnboarding() || saving.value || reading.value) return
  if (!session.isAuthenticated) {
    try { await navigate('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding', true) }
    catch { if (active) actionError.value = mobileT('onboarding.navigationFailed') }
    return
  }
  const request = ++generation, revision = session.identityRevision
  reading.value = true; actionError.value = null; clearDrafts()
  try {
    let facts = await store.loadOnboardingResume(true)
    if (!current(request, revision)) return
    if (facts.sessionRefreshRequired || (facts.adultLearningAccess === 'ELIGIBLE' && requiredConsentsComplete(facts.consent) && !session.isLearningReady)) {
      const identity = session.getMobileApiIdentity()
      if (!identity || !await session.refreshSilentlyForIdentity(identity)) {
        if (current(request, revision)) { step.value = 'consent'; actionError.value = mobileT('onboarding.readFailed') }
        return
      }
      if (!current(request, revision)) return
      facts = await store.loadOnboardingResume(true)
      if (!current(request, revision)) return
      if (facts.sessionRefreshRequired || !session.isLearningReady) actionError.value = mobileT('onboarding.readFailed')
    }
    if (session.adultGate === 'REJECTED' || selectOnboardingResumeStep(facts) === 'rejected') { await navigate('/pages/forbidden/forbidden'); return }
    step.value = selectOnboardingResumeStep(facts); applySavedTarget(facts)
    if (step.value === 'consent') await readRecords(request, revision)
    if (current(request, revision)) publicationHold.value = false
  } catch (error) { if (current(request, revision)) { actionError.value = mobileT(error instanceof OnboardingNavigationError ? 'onboarding.navigationFailed' : 'onboarding.readFailed'); step.value = session.adultGate === 'PASSED' ? 'consent' : 'gate' } }
  finally { if (active && request === generation) reading.value = false }
}
onHide(() => { active = false; showRequest++; invalidate() })
onShow(async () => {
  active = true; const request = ++showRequest; restoring.value = true
  try {
    await session.restore()
    if (!active || request !== showRequest || !stillOnOnboarding()) return
    if (!session.isAuthenticated) { await navigate('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding', true); return }
    await loadResume()
  } catch { if (active && request === showRequest) actionError.value = mobileT('onboarding.readFailed') }
  finally {
    if (active && request === showRequest) {
      restoring.value = false
      if (!session.isAuthenticated && stillOnOnboarding()) {
        try { await navigate('/pages/login/login?returnTo=%2Fpages%2Fonboarding%2Fonboarding', true) }
        catch { if (active && request === showRequest) actionError.value = mobileT('onboarding.navigationFailed') }
      }
    }
  }
})
function syncYear(value: unknown): void { if (!busy.value && typeof value === 'string') birthYear.value = value }
function blurYear(event: { detail?: { value?: unknown } }): void { syncYear(event.detail?.value); yearFocused.value = false; reportErrors() }
function changeAge(event: { detail?: { value?: unknown } }): void {
  if (busy.value) return
  const values = event.detail?.value
  if (Array.isArray(values)) ageConfirmed.value = values.includes('adult-confirmed')
}
function activateAge(event: KeyboardEvent): void {
  if (busy.value || event.repeat) return
  // Keep the actual uni checkbox/change path; keyboard activation clicks it once.
  // #ifdef H5
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.click()
  // #endif
}
async function focusRequiredField(kind: 'year' | 'age'): Promise<void> {
  const revision = session.identityRevision
  yearFocused.value = false
  await nextTick()
  if (!active || busy.value || revision !== session.identityRevision) return
  if (kind === 'year') yearFocused.value = true
  else {
    // #ifdef H5
    pageRoot.value?.$el?.querySelector<HTMLElement>('#mobile-onboarding-age')?.focus()
    // #endif
  }
}
const signableDocuments = computed(() => {
  const facts = store.onboardingResume
  if (publicationHold.value || reading.value || restoring.value || !facts || facts.sessionRefreshRequired) return []
  if (facts.adultGate !== 'PASSED' || facts.adultLearningAccess !== 'ELIGIBLE' || session.adultGate !== 'PASSED' || session.adultLearningAccess !== 'ELIGIBLE') return []
  if (!explicitIncompleteConsent(facts.consent)) return []
  const documents = facts.consent.publishedDocuments
  return documents && documents.length === 3 ? documents : []
})
function reviewedMatch(document: B8PublishedConsentDocument): boolean {
  const mark = reviewedDocuments.value[document.type]
  return Boolean(mark && mark.version === document.documentVersion && mark.digest === document.documentDigest && mark.policyVersion === document.policyVersion && mark.policyRef === document.policyRef)
}
function recordMatches(document: B8PublishedConsentDocument): boolean {
  if (recordsError.value) return false
  return consentRecords.value.some((record) => consentGrantMatchesPublication(record, document))
}
const pendingDocumentsOpened = computed(() => signableDocuments.value.every((document) => recordMatches(document) || reviewedMatch(document)))
function documentStatus(document: B8PublishedConsentDocument): string {
  if (recordMatches(document)) return mobileT('onboarding.recorded')
  return mobileT(reviewedMatch(document) ? 'onboarding.documentOpened' : 'onboarding.documentNotOpened')
}
function focusDocument(selector: string): void {
  // #ifdef H5
  pageRoot.value?.$el?.querySelector<HTMLElement>(selector)?.focus()
  // #endif
}
function toggleDocument(document: B8PublishedConsentDocument): void {
  if (busy.value || publicationHold.value) return
  if (openDocumentType.value === document.type) {
    openDocumentType.value = null
    void nextTick(() => focusDocument(`#mobile-onboarding-doc-open-${document.type}`))
    return
  }
  openDocumentType.value = document.type
  reviewedDocuments.value = { ...reviewedDocuments.value, [document.type]: { version: document.documentVersion, digest: document.documentDigest, policyVersion: document.policyVersion, policyRef: document.policyRef } }
  void nextTick(() => focusDocument(`#mobile-onboarding-doc-${document.type}`))
}
function closeOpenDocument(): void {
  const type = openDocumentType.value
  if (!type) return
  openDocumentType.value = null
  void nextTick(() => focusDocument(`#mobile-onboarding-doc-open-${type}`))
}
function consentFingerprint(documents: readonly B8PublishedConsentDocument[]): string {
  return documents.map((document) => [document.type, document.purpose, document.documentVersion, document.documentDigest, document.policyVersion, document.policyRef].join('\n')).join('\n')
}
function consentDecisionFor(documents: readonly B8PublishedConsentDocument[]): string {
  const fingerprint = consentFingerprint(documents)
  if (!consentDecisionId.value || consentDecisionFingerprint.value !== fingerprint) {
    consentDecisionId.value = createClientId('mb004')
    consentDecisionFingerprint.value = fingerprint
  }
  return consentDecisionId.value
}
function chooseGoal(value: string): void { if (!busy.value && step.value === 'goal') goal.value = value }
function chooseQuota(value: number): void { if (!busy.value && step.value === 'goal' && store.quotas.includes(value)) quota.value = value }
function adjustGoal(): void { if (!busy.value) { goal.value = savedGoal.value; quota.value = savedQuota.value ?? 15; actionError.value = null; step.value = 'goal' } }
async function next(event?: { detail?: { value?: { birthYear?: unknown } } }): Promise<void> {
  if (busy.value) return
  syncYear(event?.detail?.value?.birthYear)
  attempted.value = true; reportErrors(); actionError.value = null
  if (step.value === 'gate' && (!yearValid.value || !ageConfirmed.value)) {
    await focusRequiredField(!yearValid.value ? 'year' : 'age')
    return
  }
  if (step.value === 'goal' && targetUnreadable.value) { actionError.value = mobileT('onboarding.targetUnreadable'); return }
  if (step.value === 'goal' && (!mapUiGoal(goal.value) || !store.quotas.includes(quota.value))) { actionError.value = mobileT('onboarding.chooseGoal'); return }
  const request = ++generation, revision = session.identityRevision, action = step.value
  const requestedGoal = mapUiGoal(goal.value), requestedQuota = quota.value
  saving.value = true
  try {
    if (action === 'gate') {
      const passed = await session.confirmAdultGate(Number(birthYear.value))
      if (!current(request, revision)) return
      if (session.adultGate === 'REJECTED') { await navigate('/pages/forbidden/forbidden'); return }
      if (!passed || session.adultGate !== 'PASSED') { actionError.value = mobileT('onboarding.confirmFailed'); return }
      birthYear.value = ''; ageConfirmed.value = false; attempted.value = false; lastYearError.value = ''; lastAgeError.value = ''
    } else if (action === 'goal') {
      const saved = await store.saveTarget(mapUiGoal(goal.value)!, quota.value)
      if (!current(request, revision)) return
      if (!saved) {
        const latest = await store.loadOnboardingResume(true)
        if (!current(request, revision)) return
        const recovered = selectOnboardingResumeStep(latest)
        if (recovered === 'consent' || recovered === 'gate') {
          step.value = recovered
          if (recovered === 'consent') await readRecords(request, revision)
          if (current(request, revision) && recovered === 'consent' && !requiredConsentsComplete(latest.consent)) {
            clearConsentReview()
            consentWritesSettled.value = false
            consentRefreshPending.value = false
          }
          if (current(request, revision)) publicationHold.value = false
          return
        }
        actionError.value = mobileT('onboarding.saveFailed'); return
      }
    } else if (action === 'consent' && !consentCurrent.value) {
      if (recordsError.value || publicationStale.value) return
      if (consentRefreshPending.value) {
        const identity = session.getMobileApiIdentity()
        const refreshed = identity ? await session.refreshSilentlyForIdentity(identity) : false
        if (!current(request, revision)) return
        if (!refreshed) { actionError.value = mobileT('onboarding.consentRefreshRetry'); return }
        consentRefreshPending.value = false
      } else if (!consentWritesSettled.value) {
        const documents = signableDocuments.value
        if (publicationHold.value || documents.length !== 3 || !pendingDocumentsOpened.value || recordsError.value) return
        const viewed = documents.map((document) => ({ ...document }))
        const result = await mobileLearnerContentApi.acceptViewedRequiredConsents({ decisionId: consentDecisionFor(viewed), viewed, isCurrent: () => current(request, revision) })
        if (!current(request, revision)) return
        if (result === 'stale') {
          publicationHold.value = true
          publicationStale.value = true
          clearConsentReview()
          consentWritesSettled.value = false
          consentRefreshPending.value = false
          actionError.value = mobileT('onboarding.consentChanged')
          return
        }
        if (result === 'closed') {
          publicationHold.value = true
          clearConsentReview()
          consentWritesSettled.value = false
          consentRefreshPending.value = false
          return
        }
        if (result === 'unreadable') {
          recordsError.value = true
          consentWritesSettled.value = false
          actionError.value = mobileT('onboarding.recordsFailed')
          return
        }
        if (result === 'malformed') {
          actionError.value = mobileT('onboarding.consentPartialFailed')
          await readRecords(request, revision)
          return
        }
        consentWritesSettled.value = true
        if (result === 'refresh-failed') {
          if (!current(request, revision)) return
          consentRefreshPending.value = true
          actionError.value = mobileT('onboarding.consentRefreshRetry')
          return
        }
      }
    }
    // The current server summary permits continuing existing consent; it is
    // never used as a catalog/version for signing unrecorded documents.
    const facts = await store.loadOnboardingResume(true)
    if (!current(request, revision)) return
    const resolved = selectOnboardingResumeStep(facts)
    if (resolved === 'rejected') { await navigate('/pages/forbidden/forbidden'); return }
    if (action === 'goal' && resolved === 'assessment' && (mapUiGoal(facts.target.goal) !== requestedGoal || facts.target.quota !== requestedQuota)) {
      const filled = prefillSavedTarget(facts.target)
      savedGoal.value = filled.goal; savedQuota.value = filled.quota
      actionError.value = mobileT('onboarding.savedReadFailed'); return
    }
    if (action === 'goal' && resolved === 'goal') { actionError.value = mobileT('onboarding.savedReadFailed'); return }
    if ((action === 'goal' || action === 'assessment') && resolved === 'assessment' && session.isLearningReady) {
      applySavedTarget(facts); await navigate('/pages/assessment/assessment'); return
    }
    applySavedTarget(facts); step.value = resolved
    if (step.value === 'consent') await readRecords(request, revision)
    if (current(request, revision)) {
      const documents = store.onboardingResume?.consent.publishedDocuments ?? []
      const fingerprint = consentFingerprint(documents)
      if (consentDecisionFingerprint.value && fingerprint !== consentDecisionFingerprint.value) {
        clearConsentReview()
        consentWritesSettled.value = false
        consentRefreshPending.value = false
      }
      publicationHold.value = false
      publicationStale.value = false
    }
  } catch (error) {
    if (current(request, revision)) {
      if (error instanceof OnboardingNavigationError) actionError.value = mobileT('onboarding.navigationFailed')
      else if (action === 'goal') actionError.value = mobileT('onboarding.saveFailed')
      else if (action === 'consent') {
        actionError.value = mobileT('onboarding.consentPartialFailed')
        await readRecords(request, revision)
      } else actionError.value = mobileT('onboarding.confirmFailed')
    }
  }
  finally { if (active && request === generation) saving.value = false }
}
async function accountSettings(): Promise<void> { if (!busy.value) { try { await navigate('/pages/settings/settings') } catch { actionError.value = mobileT('onboarding.navigationFailed') } } }
async function cancel(): Promise<void> {
  if (busy.value) return
  const request = ++generation; saving.value = true
  try { await session.logout(); if (active && request === generation) await navigate('/pages/login/login', true) }
  catch { if (active && request === generation) actionError.value = mobileT('onboarding.exitFailed') }
  finally { if (active && request === generation) saving.value = false }
}
</script>

<template>
  <view ref="pageRoot" class="yx-page yx-onboarding" :aria-busy="busy" :style="experienceStyle" :data-motion="experienceMotion" :data-theme="theme" :data-figma-ref="onboardingFrameRef(step, Boolean(goal))">
    <view class="onboarding-scene" aria-hidden="true">
      <FigmaAsset class="onboarding-blob onboarding-blob-a" :src="onboardingChrome.blob" :width="180" :height="180" />
      <FigmaAsset class="onboarding-blob onboarding-blob-b" :src="onboardingChrome.blobWide" :width="260" :height="260" />
      <FigmaAsset class="onboarding-blob onboarding-blob-c" :src="onboardingChrome.blobTall" :width="300" :height="300" />
      <FigmaAsset class="onboarding-particles" :src="onboardingChrome.particles" :width="180" :height="140" />
    </view>
    <view class="onboarding-content" :class="{ 'is-wide': step === 'goal' || step === 'consent' }">
      <view class="onboarding-hero">
        <view class="onboarding-topline">
          <view class="onboarding-brand">
            <view class="onboarding-logo">
              <FigmaAsset class="onboarding-logo-glow" :src="onboardingChrome.logoGlow" :width="64" :height="64" />
              <image class="app-icon" :src="onboardingChrome.logo" mode="aspectFit" alt="" />
            </view>
            <view class="onboarding-brand-copy">
              <text class="onboarding-brand-name">{{ mobileT('brand') }}</text>
              <text class="onboarding-mark">{{ mobileT('onboarding.mark') }}</text>
            </view>
          </view>
          <button v-if="step !== 'assessment'" class="onboarding-more" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" :aria-expanded="accountMenuOpen ? 'true' : 'false'" aria-controls="mobile-onboarding-exits" :aria-label="mobileT('onboarding.more')" @click="toggleAccountMenu" @keydown.enter="keepMoreKey" @keyup.enter="openAccountMenuFromKey" @keydown.space="keepMoreKey" @keyup.space="openAccountMenuFromKey" @keydown.escape.prevent="closeAccountMenu"><FigmaAsset :src="onboardingChrome.more" :width="22" :height="22" /></button>
          <view v-if="accountMenuOpen && step !== 'assessment'" id="mobile-onboarding-exits" class="onboarding-exits onboarding-account-menu" role="group" :aria-label="mobileT('onboarding.more')" @keydown.escape.prevent="closeAccountMenu">
            <button id="mobile-onboarding-account-settings" class="onboarding-text" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="accountSettings" @keydown.escape.prevent="closeAccountMenu">{{ mobileT('onboarding.accountSettings') }}</button>
            <button class="onboarding-text" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="cancel" @keydown.escape.prevent="closeAccountMenu">{{ mobileT('onboarding.logout') }}</button>
          </view>
        </view>
        <view class="onboarding-progress" :aria-label="mobileT('onboarding.progress')">
          <template v-for="(name, index) in ['identity', 'consents', 'target']" :key="name">
            <view v-if="index > 0" class="onboarding-step-line" aria-hidden="true" />
            <view class="onboarding-progress-item" :class="{ 'is-current': rank === index, 'is-done': rank > index }" :aria-current="rank === index ? 'step' : undefined">
              <view class="onboarding-step-number" aria-hidden="true"><text v-if="rank <= index">{{ index + 1 }}</text><FigmaAsset v-else :src="onboardingChrome.goalCheck" :width="13" :height="13" /></view>
              <text class="onboarding-step-label">{{ mobileT(`onboarding.${name}`) }}</text>
              <text class="onboarding-sr">{{ mobileT(rank > index ? 'onboarding.done' : rank === index ? 'onboarding.current' : 'onboarding.pending') }}</text>
            </view>
          </template>
        </view>
        <text id="mobile-onboarding-title" class="onboarding-title" role="heading" aria-level="1" tabindex="-1">{{ mobileT(`onboarding.${step}Title`) }}</text>
        <text class="onboarding-description">{{ mobileT(`onboarding.${step}Description`) }}</text>
      </view>
      <view class="onboarding-panel">
        <text v-if="reading || restoring" class="onboarding-status" role="status">{{ mobileT('onboarding.reading') }}</text>
        <form v-if="step === 'gate'" class="onboarding-form" @submit="next">
          <view class="onboarding-body">
          <view class="onboarding-field">
            <label id="mobile-onboarding-year-label" for="mobile-onboarding-year-host" class="onboarding-label" @click="!busy && (yearFocused = true)">{{ mobileT('onboarding.year') }}</label>
            <view class="onboarding-year-control">
              <input id="mobile-onboarding-year-host" ref="yearField" v-model="birthYear" name="birthYear" :maxlength="-1" class="onboarding-input" :class="{ 'is-invalid': feedback.year }" type="number" inputmode="numeric" :focus="yearFocused" :disabled="busy" confirm-type="go" :placeholder="mobileT('onboarding.yearPlaceholder')" @focus="yearFocused = true" @input="syncYear($event.detail?.value)" @blur="blurYear" @confirm="syncYear($event.detail?.value); next()" />
              <text v-if="mobileT('onboarding.yearUnit')" class="onboarding-year-unit">{{ mobileT('onboarding.yearUnit') }}</text>
            </view>
            <text class="onboarding-hint">{{ mobileT('onboarding.yearHint') }}</text>
            <text v-if="feedback.lastYear" :id="feedback.year ? 'mobile-onboarding-year-error' : undefined" class="onboarding-error" :class="{ 'is-clear': !feedback.year }" :role="feedback.year ? 'alert' : undefined" :aria-hidden="!feedback.year">{{ feedback.year || feedback.lastYear }}</text>
          </view>
          <checkbox-group @change="changeAge"><label class="onboarding-check-row" for="mobile-onboarding-age"><checkbox id="mobile-onboarding-age" value="adult-confirmed" role="checkbox" tabindex="0" aria-required="true" aria-labelledby="mobile-onboarding-age-label" :aria-checked="ageConfirmed" :aria-disabled="busy" :aria-invalid="feedback.age ? true : undefined" :aria-describedby="feedback.age ? 'mobile-onboarding-age-error' : undefined" :checked="ageConfirmed" :disabled="busy" :color="'var(--v2-brand)'" @keydown.enter.stop.prevent="activateAge" @keydown.space.stop.prevent="activateAge" /><text id="mobile-onboarding-age-label">{{ mobileT('onboarding.ageConfirm') }}</text></label></checkbox-group>
          <text v-if="feedback.lastAge" :id="feedback.age ? 'mobile-onboarding-age-error' : undefined" class="onboarding-error" :class="{ 'is-clear': !feedback.age }" :role="feedback.age ? 'alert' : undefined" :aria-hidden="!feedback.age">{{ feedback.age || feedback.lastAge }}</text>
          <view class="onboarding-note-card">
            <view class="onboarding-note-badge" aria-hidden="true"><FigmaAsset :src="onboardingChrome.info" :width="17" :height="17" /></view>
            <view class="onboarding-note-copy"><text class="onboarding-note-title">{{ mobileT('onboarding.whyTitle') }}</text><text class="onboarding-hint">{{ mobileT('onboarding.whyBody') }}</text></view>
          </view>
          <view class="onboarding-tip">
            <view class="onboarding-tip-row"><FigmaAsset :src="onboardingChrome.dot" :width="8" :height="8" /><text class="onboarding-note-title">{{ mobileT('onboarding.yearOnlyTitle') }}</text></view>
            <text class="onboarding-hint">{{ mobileT('onboarding.yearOnlyBody') }}</text>
          </view>
          <view class="onboarding-spacer" aria-hidden="true" />
          <text v-if="feedback.action" class="onboarding-error" role="alert">{{ feedback.action }}</text>
          <button class="onboarding-primary" form-type="submit" role="button" tabindex="0" :disabled="busy || !yearValid || !ageConfirmed" :aria-disabled="busy || !yearValid || !ageConfirmed" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ primaryLabel }}</button>
          </view>
        </form>
        <view v-else-if="step === 'consent'" class="onboarding-body">
          <text v-if="signableDocuments.length === 3" class="onboarding-hint">{{ mobileT('onboarding.firstSign') }}</text>
          <view v-if="signableDocuments.length === 3" class="onboarding-documents">
            <view v-for="published in signableDocuments" :key="published.type" class="onboarding-document-row">
              <button :id="`mobile-onboarding-doc-open-${published.type}`" class="onboarding-document" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" :aria-expanded="openDocumentType === published.type" :aria-controls="openDocumentType === published.type ? `mobile-onboarding-doc-${published.type}` : undefined" @click="toggleDocument(published)" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="toggleDocument(published)" @keydown.space.stop.prevent @keyup.space.stop.prevent="toggleDocument(published)">
                <FigmaAsset :src="onboardingChrome.file" :width="20" :height="20" />
                <view class="onboarding-record-copy">
                  <view class="onboarding-record-title"><text>{{ mobileT(`onboarding.purposes.${published.type}`) }}</text><text class="onboarding-tag">{{ mobileT('onboarding.required') }}</text></view>
                  <text class="onboarding-help">{{ mobileT('onboarding.publishedVersion') }} {{ published.documentVersion }}</text>
                  <text class="onboarding-help">{{ documentStatus(published) }}</text>
                </view>
                <text class="onboarding-document-action">{{ mobileT(openDocumentType === published.type ? 'onboarding.closeDocument' : 'onboarding.openDocument') }}</text>
              </button>
              <view v-if="openDocumentType === published.type" :id="`mobile-onboarding-doc-${published.type}`" class="onboarding-document-body" role="region" tabindex="-1" :aria-label="mobileT(`onboarding.purposes.${published.type}`)" @keydown.escape.prevent="closeOpenDocument"><text class="onboarding-document-text">{{ published.bodyText }}</text></view>
            </view>
          </view>
          <view v-for="record in consentRecords" :key="record.type" class="onboarding-record">
            <FigmaAsset :src="onboardingChrome.file" :width="20" :height="20" />
            <view class="onboarding-record-copy">
              <view class="onboarding-record-title"><text>{{ mobileT(`onboarding.purposes.${record.type}`) }}</text><text class="onboarding-tag">{{ mobileT(record.required ? 'onboarding.required' : 'onboarding.optional') }}</text></view>
              <text class="onboarding-help">{{ mobileT(record.state === 'GRANTED' ? 'onboarding.recorded' : 'onboarding.withdrawn') }}</text>
              <text class="onboarding-help">{{ mobileT('onboarding.recordVersion') }} {{ record.document.version }}</text>
              <view v-if="recordsOpen" class="onboarding-provenance"><text>{{ mobileT('onboarding.source') }}</text><text>{{ mobileT('onboarding.documentTime') }} {{ record.document.publishedAt }}</text><text>{{ mobileT('onboarding.recordTime') }} {{ record.provenance.recordedAt }}</text><text>{{ mobileT('onboarding.digest') }} {{ record.document.digest }}</text><text>{{ mobileT('onboarding.policy') }} {{ record.policyRef }} / {{ record.policyVersion }}</text><text>{{ mobileT('onboarding.decision') }} {{ record.decisionRef }}</text></view>
            </view>
          </view>
          <button v-if="consentRecords.length" class="onboarding-record-toggle onboarding-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" :aria-expanded="recordsOpen" @click="!busy && (recordsOpen = !recordsOpen)"><FigmaAsset :src="onboardingChrome.history" :width="18" :height="18" /><FigmaAsset :src="onboardingChrome.chevronDown" :width="18" :height="18" /><text>{{ mobileT(recordsOpen ? 'onboarding.hideSource' : 'onboarding.showSource') }}</text></button>
          <text v-if="recordsError" class="onboarding-error" role="alert">{{ mobileT('onboarding.recordsFailed') }}</text>
          <text v-if="publicationStale && !reading && !restoring" class="onboarding-blocked" role="status">{{ mobileT('onboarding.consentChanged') }}</text>
          <text v-else-if="consentCurrent" class="onboarding-help">{{ mobileT('onboarding.currentConsent') }}</text>
          <text v-else-if="!reading && !restoring && signableDocuments.length !== 3 && !consentRefreshPending" class="onboarding-blocked" role="status">{{ mobileT('onboarding.consentBlocked') }}</text>
          <view class="onboarding-spacer" aria-hidden="true" />
          <text class="onboarding-hint onboarding-center">{{ mobileT('onboarding.consentFooter') }}</text>
          <text v-if="feedback.action" class="onboarding-error" role="alert">{{ feedback.action }}</text>
          <button v-if="consentCurrent" class="onboarding-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="next" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ primaryLabel }}</button>
          <button v-else-if="consentRefreshPending || consentWritesSettled" class="onboarding-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="next" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ mobileT('onboarding.retrySession') }}</button>
          <button v-else-if="signableDocuments.length === 3" class="onboarding-primary" role="button" tabindex="0" :disabled="busy || recordsError || !pendingDocumentsOpened" :aria-disabled="busy || recordsError || !pendingDocumentsOpened" @click="next" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ mobileT('onboarding.agreeContinue') }}</button>
          <button class="onboarding-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="loadResume">{{ mobileT('onboarding.reload') }}</button>
        </view>
        <view v-else-if="step === 'goal'" class="onboarding-body">
          <text v-if="targetUnreadable" class="onboarding-error" role="alert">{{ mobileT('onboarding.targetUnreadable') }}</text>
          <view class="onboarding-field">
            <text class="onboarding-label">{{ mobileT('onboarding.target') }}</text>
            <view class="onboarding-choices">
              <button v-for="item in goalOptions" :key="item.value" class="onboarding-choice" :class="{ 'is-selected': goal === item.value }" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" :aria-pressed="goal === item.value" :data-goal-code="item.value" @click="chooseGoal(item.value)">
                <view v-if="goalArt(item.value)" class="onboarding-goal-art"><FigmaAsset :src="goalArt(item.value).src" :width="32" :height="32" /></view>
                <view class="onboarding-choice-copy"><text class="onboarding-choice-label">{{ mobileT(`onboarding.goals.${item.value}.label`) }}</text><text class="onboarding-help">{{ mobileT(`onboarding.goals.${item.value}.description`) }}</text></view>
                <view class="onboarding-radio" :class="{ 'is-selected': goal === item.value }"><FigmaAsset v-if="goal === item.value" :src="onboardingChrome.goalCheck" :width="13" :height="13" /></view>
              </button>
            </view>
          </view>
          <view class="onboarding-field">
            <text class="onboarding-label">{{ mobileT('onboarding.dailyTime') }}</text>
            <view class="onboarding-quotas">
              <button v-for="item in store.quotas" :key="item" class="onboarding-quota" :class="{ 'is-selected': quota === item }" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" :aria-pressed="quota === item" @click="chooseQuota(item)">{{ minuteLabel(item) }}</button>
            </view>
          </view>
          <text v-if="localGoalDraft" class="onboarding-hint">{{ mobileT('onboarding.localDraft') }}</text>
          <view class="onboarding-spacer" aria-hidden="true" />
          <text v-if="feedback.action" class="onboarding-error" role="alert">{{ feedback.action }}</text>
          <button class="onboarding-primary" role="button" tabindex="0" :disabled="busy || !goal || targetUnreadable" :aria-disabled="busy || !goal || targetUnreadable" @click="next" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ primaryLabel }}</button>
          <button class="onboarding-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="loadResume">{{ mobileT('onboarding.reload') }}</button>
        </view>
        <view v-else-if="step === 'assessment'" class="onboarding-body">
          <view class="onboarding-summary">
            <view class="onboarding-summary-head"><text class="onboarding-choice-label">{{ mobileT('onboarding.planTitle') }}</text><button class="onboarding-text" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="adjustGoal">{{ mobileT('onboarding.adjustGoal') }}</button></view>
            <view class="onboarding-summary-row">
              <view v-if="goalArt(savedGoal)" class="onboarding-goal-art"><FigmaAsset :src="goalArt(savedGoal).src" :width="32" :height="32" /></view>
              <view><text class="onboarding-help">{{ mobileT('onboarding.savedTarget') }}</text><text class="onboarding-label">{{ mobileT(`onboarding.goals.${savedGoal}.label`) }}</text></view>
            </view>
            <view class="onboarding-summary-row">
              <view class="onboarding-goal-art"><FigmaAsset :src="onboardingChrome.schedule" :width="17" :height="17" /></view>
              <view><text class="onboarding-help">{{ mobileT('onboarding.dailyShort') }}</text><text class="onboarding-label">{{ minuteLabel(savedQuota) }}</text></view>
            </view>
          </view>
          <text class="onboarding-hint">{{ mobileT('onboarding.planNote') }}</text>
          <view class="onboarding-spacer" aria-hidden="true" />
          <text v-if="feedback.action" class="onboarding-error" role="alert">{{ feedback.action }}</text>
          <button class="onboarding-primary" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="next" @keydown.enter.stop.prevent @keyup.enter.stop.prevent="next()" @keydown.space.stop.prevent @keyup.space.stop.prevent="next()">{{ primaryLabel }}</button>
          <view id="mobile-onboarding-exits" class="onboarding-exits"><button class="onboarding-text" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="accountSettings">{{ mobileT('onboarding.accountSettings') }}</button><button class="onboarding-text" type="button" role="button" tabindex="0" :disabled="busy" :aria-disabled="busy" @click="cancel">{{ mobileT('onboarding.logout') }}</button></view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.yx-page.yx-onboarding { position: relative; display: flex; flex-direction: column; box-sizing: border-box; width: 100%; max-width: none; min-height: 100vh; min-height: 100dvh; margin: 0; padding: 0; overflow-x: clip; background-color: #fbf8ff; background-image: linear-gradient(180deg, #ede6ff 0%, #f4eeff 45%, #fbf8ff 100%); color: var(--v2-ink); font-family: var(--v2-font); line-height: 1.5; }
.yx-onboarding[data-theme="dark"] { background-color: var(--yx-auth-page-color, var(--v2-bg)); background-image: var(--yx-auth-page-image, none); }
.yx-onboarding[data-theme="high-contrast"] { background-color: var(--yx-surface-page, var(--v2-bg)); background-image: none; }
.onboarding-scene { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.onboarding-blob, .onboarding-particles { position: absolute; opacity: .9; }
.onboarding-blob-a { top: 20px; right: -4px; }
.onboarding-blob-b { top: -60px; right: -80px; }
.onboarding-blob-c { top: -180px; left: -120px; }
.onboarding-particles { top: 40px; left: 194px; }
.onboarding-content { position: relative; display: flex; flex: 1 0 auto; flex-direction: column; width: 100%; max-width: 420px; min-height: 100vh; min-height: 100dvh; margin: 0 auto; }
.onboarding-content.is-wide { max-width: 560px; }
.onboarding-hero { display: grid; gap: 16px; padding: calc(4px + env(safe-area-inset-top)) 24px 24px; }
.onboarding-topline { position: relative; display: flex; align-items: center; gap: 10px; min-width: 0; }
.onboarding-brand { display: flex; min-width: 0; flex: 1; align-items: center; gap: 10px; color: var(--v2-ink); }
.onboarding-logo { position: relative; width: 40px; height: 40px; flex: none; }
.onboarding-logo-glow { position: absolute; left: -12px; top: -12px; }
.onboarding-brand .app-icon { position: relative; display: block; width: 40px; height: 40px; }
.onboarding-brand-copy { display: flex; flex-flow: row wrap; align-items: center; column-gap: 8px; min-width: 0; }
.onboarding-brand-name { font-size: 22px; font-weight: 700; line-height: 22px; white-space: nowrap; }
.onboarding-mark { color: var(--yx-auth-wordmark, #6b45b2); font-size: 11px; font-weight: 500; line-height: 15px; white-space: nowrap; }
.yx-onboarding .onboarding-more { display: inline-flex; width: 44px; height: 44px; min-width: 44px; min-height: 44px; margin: 0; padding: 0; align-items: center; justify-content: center; border: 1px solid var(--yx-auth-glass-border, rgba(255, 255, 255, 0.85)); border-radius: 14px; background: rgba(255, 255, 255, 0.55); box-shadow: 0 4px 12px rgba(89, 53, 184, 0.13); backdrop-filter: blur(var(--yx-auth-blur, 10px)); -webkit-backdrop-filter: blur(var(--yx-auth-blur, 10px)); }
.yx-onboarding[data-theme="dark"] .onboarding-more { background: var(--yx-auth-glass, rgba(43, 37, 67, 0.88)); }
.yx-onboarding[data-theme="high-contrast"] .onboarding-more { background: var(--yx-surface-card); box-shadow: none; backdrop-filter: none; }
.onboarding-account-menu { position: absolute; top: 52px; right: 0; z-index: 4; display: flex; flex-direction: column; align-items: stretch; min-width: 160px; padding: 8px; border: 1px solid var(--yx-auth-glass-border, var(--v2-line)); border-radius: 16px; background: var(--yx-auth-glass, var(--v2-card)); box-shadow: var(--yx-auth-shadow-card, var(--v2-shadow)); }
.onboarding-progress { display: flex; flex-wrap: nowrap; align-items: center; gap: 6px; width: 100%; min-width: 0; min-height: 28px; }
.onboarding-progress-item { position: relative; display: flex; flex: none; align-items: center; gap: 4px; color: var(--v2-mut); font-size: 12px; line-height: 16px; white-space: nowrap; }
.onboarding-step-label { white-space: nowrap; }
.onboarding-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }
.onboarding-step-number { display: flex; width: 24px; height: 24px; flex: none; align-items: center; justify-content: center; border: 1.5px solid var(--v2-line); border-radius: 12px; background: var(--v2-card); font-size: 12px; font-weight: 500; }
.onboarding-progress-item.is-current, .onboarding-progress-item.is-done { color: var(--v2-ink); font-weight: 500; }
.onboarding-progress-item.is-current .onboarding-step-number { border-color: transparent; background: var(--v2-brand); color: var(--v2-inverse); font-weight: 700; box-shadow: 0 3px 8px rgba(89, 53, 184, 0.25); }
.onboarding-progress-item.is-done .onboarding-step-number { border-color: transparent; background: var(--v2-brand); color: var(--v2-inverse); }
.onboarding-step-line { flex: 1 1 4px; height: 2px; min-width: 4px; border-radius: 1px; background: var(--v2-line); }
.onboarding-progress-item.is-done + .onboarding-step-line, .onboarding-step-line:has(+ .onboarding-progress-item.is-done), .onboarding-step-line:has(+ .onboarding-progress-item.is-current) { background: var(--v2-brand); }
.onboarding-title { display: block; font-size: 24px; font-weight: 700; line-height: 40px; letter-spacing: .5px; }
.onboarding-description { display: block; color: var(--v2-mut); font-size: 14px; line-height: 21px; }
.onboarding-panel { display: flex; flex-direction: column; flex: 1 1 auto; box-sizing: border-box; width: 100%; min-width: 0; margin: 0; padding: 24px 24px calc(32px + env(safe-area-inset-bottom)); border: 1px solid var(--yx-auth-glass-border, rgba(255, 255, 255, 0.72)); border-radius: 28px 28px 20px 20px; background: var(--yx-auth-glass, rgba(250, 247, 255, 0.74)); box-shadow: var(--yx-auth-shadow-card, 0 6px 16px rgba(89, 53, 184, 0.08), 0 -12px 16px -2px rgba(42, 22, 96, 0.14)); backdrop-filter: blur(var(--yx-auth-blur, 10px)); -webkit-backdrop-filter: blur(var(--yx-auth-blur, 10px)); }
.onboarding-form { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; }
/* #ifdef H5 */
/* uni-h5 Form renders uni-form > span around the slot, so this span has to carry the column. */
.onboarding-form > :deep(span) { display: flex; flex: 1 1 auto; flex-direction: column; min-width: 0; width: 100%; }
/* #endif */
.onboarding-body { display: flex; flex: 1 1 auto; flex-direction: column; row-gap: 16px; min-width: 0; }
.onboarding-spacer { flex: 1 1 auto; min-height: 16px; }
.onboarding-field, .onboarding-note-copy, .onboarding-record-copy { display: grid; gap: 8px; min-width: 0; }
.onboarding-label, .onboarding-choice-label, .onboarding-note-title { display: block; font-size: 14px; font-weight: 700; line-height: 22px; }
.onboarding-year-control { position: relative; }
.yx-onboarding .onboarding-input { width: 100%; min-height: 48px; height: 48px; padding: 0 42px 0 14px; border: 1px solid var(--v2-mut); border-radius: 14px; background: var(--v2-card); color: var(--v2-ink); font-size: 16px; font-weight: 600; line-height: 19px; }
.onboarding-input :deep(.uni-input-input), .onboarding-input :deep(.uni-input-placeholder) { font: inherit; color: inherit; }
.onboarding-input :deep(.uni-input-placeholder) { color: var(--v2-mut); font-weight: 400; }
.onboarding-year-unit { position: absolute; top: 0; right: 14px; height: 48px; display: flex; align-items: center; color: var(--v2-mut); font-size: 14px; pointer-events: none; }
.onboarding-input.is-invalid { border-color: var(--v2-bad); }
.onboarding-input:focus-within { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.onboarding-hint, .onboarding-help { color: var(--v2-mut); font-size: 13px; line-height: 18px; overflow-wrap: anywhere; }
.onboarding-center { text-align: center; }
.onboarding-check-row { display: flex; min-height: 44px; align-items: center; gap: 10px; padding: 8px 0; font-size: 13px; cursor: pointer; }
.onboarding-check-row checkbox { display: flex; flex: none; width: 44px; min-width: 44px; height: 44px; align-items: center; justify-content: center; }
.onboarding-check-row :deep(.uni-checkbox-input) { width: 20px; height: 20px; border-color: var(--v2-mut); border-radius: 6px; background-color: var(--v2-card); }
.onboarding-check-row checkbox:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; border-radius: 6px; }
.onboarding-note-card, .onboarding-tip { box-sizing: border-box; width: 100%; border: 1px solid var(--closed-card-border, rgba(255, 255, 255, 0.9)); background: var(--closed-card-bg, rgba(255, 255, 255, 0.62)); box-shadow: var(--closed-card-shadow, 0 6px 16px -2px rgba(42, 22, 96, 0.09)); }
.onboarding-note-card { display: flex; gap: 10px; align-items: flex-start; padding: 12px 8px 12px 14px; border-radius: 16px; }
.onboarding-note-badge { display: flex; width: 24px; height: 24px; flex: none; align-items: center; justify-content: center; border-radius: 8px; background: linear-gradient(135deg, #c4b5fd 0%, #5935b8 71.429%); box-shadow: inset 0 1px 1.5px rgba(255, 255, 255, 0.7), 0 3px 8px rgba(89, 53, 184, 0.5); }
.onboarding-tip { display: grid; gap: 6px; padding: 14px 16px; border-radius: 18px; }
.onboarding-tip-row { display: flex; gap: 10px; align-items: center; min-width: 0; }
.onboarding-note-title { color: var(--v2-brand); }
.onboarding-tip .onboarding-note-title { color: var(--v2-ink); }
.yx-onboarding[data-theme="high-contrast"] .onboarding-note-badge { background: var(--v2-brand); box-shadow: none; }
.yx-onboarding .onboarding-primary { display: flex; width: 100%; min-height: 48px; padding: 14px 20px; margin: 0; align-items: center; justify-content: center; border: 0; border-radius: 14px; background: var(--v2-grad); color: var(--v2-inverse); font-size: 16px; font-weight: 700; line-height: 1.5; }
.yx-onboarding .onboarding-text { display: inline-flex; min-height: 44px; min-width: 44px; padding: 8px; margin: 0; align-items: center; justify-content: center; gap: 6px; background: transparent; border: 0; color: var(--v2-brand); font-size: 14px; font-weight: 500; line-height: 20px; }
.onboarding-choices { display: grid; gap: 8px; }
.yx-onboarding .onboarding-choice { display: flex; gap: 12px; width: 100%; margin: 0; padding: 12px 16px 12px 14px; min-height: 70px; align-items: center; border: 1px solid var(--v2-mut); border-radius: 16px; background: var(--v2-card); color: var(--v2-ink); text-align: left; }
.onboarding-choice-copy { display: grid; gap: 2px; min-width: 0; flex: 1; }
.onboarding-choice-label { font-size: 16px; }
.onboarding-goal-art { display: flex; width: 44px; height: 44px; flex: none; align-items: center; justify-content: center; border-radius: 14px; background: var(--v2-soft); }
.onboarding-radio { display: flex; width: 22px; height: 22px; flex: none; align-items: center; justify-content: center; border: 1.5px solid var(--v2-mut); border-radius: 11px; background: var(--v2-card); }
.onboarding-radio.is-selected { border-color: var(--v2-brand); background: var(--v2-brand); }
.yx-onboarding .is-selected.onboarding-choice { border: 2px solid var(--v2-brand); background: var(--v2-soft); }
.onboarding-quotas { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 4px; padding: 4px; border-radius: 14px; background: var(--v2-surface); }
.yx-onboarding .onboarding-quota { display: flex; min-height: 44px; margin: 0; padding: 8px; align-items: center; justify-content: center; border: 1px solid var(--v2-mut); border-radius: 12px; background: var(--v2-card); color: var(--v2-ink); font-size: 14px; font-weight: 500; line-height: 20px; text-align: center; overflow-wrap: anywhere; }
.yx-onboarding .onboarding-quota.is-selected { border-color: transparent; background: var(--v2-grad); color: var(--v2-inverse); font-weight: 700; }
.onboarding-documents { display: grid; gap: 12px; min-width: 0; }
.onboarding-document-row { display: grid; gap: 8px; min-width: 0; }
.yx-onboarding .onboarding-document { display: flex; width: 100%; min-width: 0; min-height: 44px; margin: 0; padding: 12px 14px; align-items: flex-start; gap: 12px; border: 1px solid var(--v2-line); border-radius: 16px; background: var(--v2-card); color: var(--v2-ink); text-align: left; }
.onboarding-document-action { flex: none; max-width: 40%; color: var(--v2-brand); font-size: 13px; font-weight: 500; line-height: 18px; overflow-wrap: anywhere; }
.onboarding-document-body { box-sizing: border-box; width: 100%; min-width: 0; max-height: 40vh; overflow: auto; padding: 12px; border: 1px solid var(--v2-line); border-radius: 12px; background: var(--v2-surface); color: var(--v2-ink); }
.onboarding-document-body:focus { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.onboarding-document-text { display: block; font-size: 14px; line-height: 22px; white-space: pre-wrap; overflow-wrap: anywhere; }
.onboarding-record { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid var(--v2-line); border-radius: 16px; background: var(--v2-card); }
.onboarding-record-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 15px; font-weight: 700; line-height: 22px; }
.onboarding-tag { padding: 1px 6px; border-radius: 6px; background: var(--v2-soft); color: var(--v2-brand); font-size: 12px; font-weight: 500; line-height: 16px; }
.onboarding-provenance { display: grid; gap: 8px; font-size: 13px; color: var(--v2-mut); overflow-wrap: anywhere; }
.onboarding-blocked, .onboarding-status { display: block; color: var(--v2-mut); font-size: 14px; line-height: 21px; overflow-wrap: anywhere; }
.onboarding-error { display: block; font-size: 14px; line-height: 1.6; color: var(--v2-bad); overflow-wrap: anywhere; }
.onboarding-error.is-clear { visibility: hidden; }
.onboarding-summary { display: grid; gap: 14px; padding: 16px; border: 1px solid var(--v2-line); border-radius: 22px; background: var(--v2-card); }
.onboarding-summary-head, .onboarding-summary-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.onboarding-summary-head { justify-content: space-between; }
.onboarding-exits { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.yx-onboarding button[disabled] { opacity: .55; cursor: default; }
.yx-onboarding button:focus-visible, .yx-onboarding .onboarding-exits:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
@media (max-width: 359px) {
  /* 390 keeps the three labels on one row. Narrow frames may wrap that row; they do not add a status line. */
  .onboarding-hero { padding-left: 12px; padding-right: 12px; }
  .onboarding-panel { padding-left: 16px; padding-right: 16px; }
  .onboarding-progress { flex-wrap: wrap; row-gap: 8px; }
  .onboarding-quotas { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .onboarding-particles { left: auto; right: 0; }
  .yx-onboarding .onboarding-document { padding: 10px 12px; }
  .onboarding-document-body { max-height: 50vh; }
}
.yx-onboarding[data-theme="high-contrast"] .onboarding-progress-item.is-current .onboarding-step-number { box-shadow: none; }
.yx-onboarding[data-motion="reduced"] .onboarding-scene,
.yx-onboarding[data-motion="off"] .onboarding-scene { display: none; }
.yx-onboarding[data-motion="reduced"] .onboarding-panel,
.yx-onboarding[data-motion="off"] .onboarding-panel,
.yx-onboarding[data-motion="reduced"] .onboarding-more,
.yx-onboarding[data-motion="off"] .onboarding-more,
.yx-onboarding[data-motion="reduced"] .onboarding-note-card,
.yx-onboarding[data-motion="off"] .onboarding-note-card,
.yx-onboarding[data-motion="reduced"] .onboarding-tip,
.yx-onboarding[data-motion="off"] .onboarding-tip { backdrop-filter: none; -webkit-backdrop-filter: none; }
@media (prefers-reduced-motion: reduce) { .yx-onboarding * { transition: none; animation: none; } }
</style>
