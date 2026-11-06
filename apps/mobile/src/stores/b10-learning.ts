import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import type { B10AnswerInput, B10AnswerResult, B10AssessmentSession, B10Mistake, B10Report, B10RequestContext, B10SrsBatch, B10SrsCard, B10SrsMasteryStatus } from '../domain/b10'
import { acceptPinnedReadingSession, b10LearningApi, b10ErrorInfo, createB10ClientEventId } from '../api/b10'
import { b10ContentLocale, b10UiLocale } from '../platform/b10-foundation'
import { getUniRuntime } from '../platform/uni-runtime'
import { useSessionStore } from './session'
import { B10_LEARNING_STORAGE_KEY, removeLearningCache } from './learning-cache'

const STORAGE_KEY = B10_LEARNING_STORAGE_KEY

interface QueuedReview { clientEventId: string; payload: Record<string, unknown>; cardId: string }
interface VerifiedSrsReceipt { reviewEventId: number; eventStatus: 'ACCEPTED' | 'DUPLICATE'; stateVersion: number; masteryStatus: B10SrsMasteryStatus; dueLocalDate: string }
interface PersistedState {
  subject: string
  revision?: number
  sessionId?: string
  batch?: B10SrsBatch | null
  currentIndex?: number
  queuedReviews?: QueuedReview[]
  practice?: B10AssessmentSession | null
  answers?: Record<string, B10AnswerInput>
  answerResults?: Record<string, B10AnswerResult>
  mistakes?: B10Mistake[]
  report?: B10Report | null
}

function context(): B10RequestContext { return { uiLocale: b10UiLocale.value, contentLocale: b10ContentLocale.value } }
function nowId(prefix: string): string { return createB10ClientEventId(prefix) }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
const SETTLED_SRS_STATUSES = ['ACCEPTED', 'DUPLICATE'] as const
const TERMINAL_SRS_STATUSES = ['CONFLICT', 'EXPIRED', 'REJECTED', 'RISK_FILTERED'] as const
const SRS_MASTERY_STATUSES = ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED', 'SHORT_TERM', 'CONSOLIDATING', 'AT_RISK', 'SUSPENDED'] as const

function responseRecord(value: unknown): Record<string, unknown> {
  let source = value
  for (let depth = 0; depth < 3; depth += 1) {
    if (!isRecord(source)) return {}
    if (isRecord(source.data)) { source = source.data; continue }
    if (isRecord(source.result)) { source = source.result; continue }
    break
  }
  return isRecord(source) ? source : {}
}

function responseStatus(value: unknown): string | null {
  const direct = isRecord(value) ? value : {}
  const status = direct.eventStatus ?? direct.status
  if (typeof status === 'string' && status.trim()) return status.trim().toUpperCase()
  const nested = responseRecord(value)
  const nestedStatus = nested.eventStatus ?? nested.status
  return typeof nestedStatus === 'string' && nestedStatus.trim() ? nestedStatus.trim().toUpperCase() : null
}

function responseClientEventId(value: unknown): string | null {
  const id = isRecord(value) ? value.clientEventId : null
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

function isSettledSrsStatus(status: string | null): status is 'ACCEPTED' | 'DUPLICATE' {
  return status !== null && (SETTLED_SRS_STATUSES as readonly string[]).includes(status)
}

function isTerminalSrsStatus(status: string | null): boolean {
  return status !== null && (TERMINAL_SRS_STATUSES as readonly string[]).includes(status)
}

function verifiedSrsReceipt(value: unknown, card: B10SrsCard): VerifiedSrsReceipt | null {
  const source = responseRecord(value)
  const eventStatus = source.eventStatus
  if (eventStatus !== 'ACCEPTED' && eventStatus !== 'DUPLICATE') return null
  const reviewEventId = source.reviewEventId
  if (typeof reviewEventId !== 'number' || !Number.isInteger(reviewEventId) || reviewEventId < 1) return null
  if (card.stateVersion === null) return null
  const stateVersion = source.stateVersion
  if (typeof stateVersion !== 'number' || !Number.isInteger(stateVersion) || stateVersion < 0) return null
  const state = source.srsState
  if (!isRecord(state)) return null
  if (state.itemType !== card.itemType || state.itemId !== card.itemId) return null
  if (typeof state.stateVersion !== 'number' || state.stateVersion !== stateVersion) return null
  const masteryStatus = state.masteryStatus
  if (typeof masteryStatus !== 'string' || !(SRS_MASTERY_STATUSES as readonly string[]).includes(masteryStatus)) return null
  const dueLocalDate = state.dueLocalDate
  if (typeof dueLocalDate !== 'string' || !dueLocalDate.trim()) return null
  if (stateVersion < card.stateVersion) return null
  return { reviewEventId, eventStatus, stateVersion, masteryStatus: masteryStatus as B10SrsMasteryStatus, dueLocalDate: dueLocalDate.trim() }
}

function applyVerifiedSrsReceipt(card: B10SrsCard, receipt: VerifiedSrsReceipt): void {
  if (card.stateVersion !== null && receipt.stateVersion < card.stateVersion) return
  card.masteryStatus = receipt.masteryStatus
  card.dueLocalDate = receipt.dueLocalDate
  card.stateVersion = receipt.stateVersion
}

const REVIEW_WIRE_KEYS = ['snapshotId', 'snapshotItemId', 'item', 'rawQuality', 'answerOutcome', 'responseTimeMs', 'revealElapsedMs', 'attemptNo', 'clientEventId', 'clientOccurredAt', 'baseStateVersion'] as const
const REVIEW_OUTCOMES = ['CORRECT', 'INCORRECT', 'UNANSWERED', 'REVEALED_WITHOUT_ANSWER'] as const

function wholeNumber(value: unknown, min: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min
}

function wireItemRef(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length !== 2) return false
  if (value.itemType === 'VOCAB') return wholeNumber(value.vocabId, 1)
  if (value.itemType === 'CHUNK') return wholeNumber(value.chunkId, 1)
  if (value.itemType === 'EXPRESSION') return wholeNumber(value.expressionId, 1)
  return false
}

function isExactWireReviewPayload(payload: Record<string, unknown>, clientEventId: string): boolean {
  if (clientEventId.length < 8 || clientEventId.length > 96) return false
  for (const key of Object.keys(payload)) {
    if (!(REVIEW_WIRE_KEYS as readonly string[]).includes(key)) return false
  }
  if (payload.clientEventId !== clientEventId) return false
  if (!wholeNumber(payload.snapshotId, 1) || !wholeNumber(payload.snapshotItemId, 1) || !wireItemRef(payload.item)) return false
  if (!wholeNumber(payload.rawQuality, 0) || payload.rawQuality > 3) return false
  if (typeof payload.answerOutcome !== 'string' || !(REVIEW_OUTCOMES as readonly string[]).includes(payload.answerOutcome)) return false
  if (typeof payload.clientOccurredAt !== 'string' || !payload.clientOccurredAt.trim() || !wholeNumber(payload.baseStateVersion, 0)) return false
  if (payload.responseTimeMs !== undefined && !wholeNumber(payload.responseTimeMs, 0)) return false
  if (payload.revealElapsedMs !== undefined && !wholeNumber(payload.revealElapsedMs, 0)) return false
  if (payload.attemptNo !== undefined && !wholeNumber(payload.attemptNo, 1)) return false
  return true
}

function queuedReview(item: unknown, legacy: boolean): QueuedReview | null {
  if (!isRecord(item) || typeof item.clientEventId !== 'string' || typeof item.cardId !== 'string' || !isRecord(item.payload)) return null
  if (!item.clientEventId || !item.cardId || item.payload.clientEventId !== item.clientEventId) return null
  if (legacy && !isExactWireReviewPayload(item.payload, item.clientEventId)) return null
  return { clientEventId: item.clientEventId, payload: item.payload, cardId: item.cardId }
}

function readQueuedReviews(saved: PersistedState, legacy: boolean): QueuedReview[] | null {
  if (!Array.isArray(saved.queuedReviews)) return null
  const seen = new Set<string>()
  const queue: QueuedReview[] = []
  for (const item of saved.queuedReviews) {
    const parsed = queuedReview(item, legacy)
    if (!parsed || seen.has(parsed.clientEventId)) continue
    seen.add(parsed.clientEventId)
    queue.push(parsed)
  }
  return queue
}

function textId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function firstEligibleIndex(items: readonly B10SrsCard[]): number {
  const index = items.findIndex((card) => card.reviewStatus !== 'ACCEPTED')
  return index < 0 ? items.length : index
}

function reviewItemRef(card: B10SrsCard): Record<string, unknown> | null {
  if (card.itemType === 'VOCAB') return { itemType: 'VOCAB', vocabId: card.itemId }
  if (card.itemType === 'CHUNK') return { itemType: 'CHUNK', chunkId: card.itemId }
  if (card.itemType === 'EXPRESSION') return { itemType: 'EXPRESSION', expressionId: card.itemId }
  return null
}

function responseItems(value: unknown): unknown[] {
  const source = responseRecord(value)
  const items = source.results ?? source.items
  return Array.isArray(items) ? items : []
}

async function hashState(value: unknown): Promise<string> {
  const serialized = JSON.stringify(value)
  const cryptoValue = (globalThis as typeof globalThis & { crypto?: Crypto }).crypto
  if (cryptoValue?.subtle) {
    const digest = await cryptoValue.subtle.digest('SHA-256', new TextEncoder().encode(serialized))
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let hash = 2166136261
  for (const char of serialized) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `${Math.abs(hash).toString(16).padStart(8, '0')}${'0'.repeat(56)}`
}

export const useB10LearningStore = defineStore('mobile-b10-learning', () => {
  const session = useSessionStore()
  const restored = ref(false)
  const status = ref<'idle' | 'loading' | 'ready' | 'empty' | 'offline' | 'forbidden' | 'stale' | 'error'>('idle')
  const message = ref<string | null>(null)
  const batch = ref<B10SrsBatch | null>(null)
  const currentIndex = ref(0)
  const queuedReviews = ref<QueuedReview[]>([])
  const practice = ref<B10AssessmentSession | null>(null)
  const answers = ref<Record<string, B10AnswerInput>>({})
  const answerResults = ref<Record<string, B10AnswerResult>>({})
  const mistakes = ref<B10Mistake[]>([])
  const attemptCount = ref(0)
  const emptyCopy = ref('')
  const projectionVersion = ref('IT4-MISTAKE-1')
  const remediationId = ref<number | null>(null)
  const report = ref<B10Report | null>(null)
  const reportStatus = ref<typeof status.value>('idle')
  const practiceStatus = ref<typeof status.value>('idle')
  const practiceMessage = ref<string | null>(null)
  const srsQueueCount = computed(() => queuedReviews.value.length)
  const currentCard = computed(() => batch.value?.items[currentIndex.value] ?? null)
  const currentExercise = computed(() => practice.value?.exercises.find((exercise) => !answerResults.value[String(exercise.exerciseId)]) ?? practice.value?.exercises[0] ?? null)
  let syncingSrs = false
  let syncToken = 0
  let srsLoadSeq = 0
  const revealInFlight = new Set<string>()
  const frontReady = new Set<string>()
  const frontInFlight = new Map<string, Promise<void>>()

  type Scope = { subject: string; revision: number; sessionId: string | null }
  function trustedSessionId(): string | null { return textId(session.sessionId) }
  function scope(): Scope | null {
    return session.isAuthenticated && session.verifiedSubject
      ? { subject: session.verifiedSubject, revision: session.identityRevision, sessionId: trustedSessionId() } : null
  }
  function stillCurrent(value: Scope | null): boolean {
    const current = scope()
    return Boolean(value && current && current.subject === value.subject && current.revision === value.revision && current.sessionId === value.sessionId)
  }
  function reset(): void {
    restored.value = false
    status.value = 'idle'; message.value = null
    batch.value = null; currentIndex.value = 0; queuedReviews.value = []
    practice.value = null; answers.value = {}; answerResults.value = {}; mistakes.value = []; attemptCount.value = 0; emptyCopy.value = ''; projectionVersion.value = 'IT4-MISTAKE-1'; remediationId.value = null; report.value = null
    reportStatus.value = 'idle'; practiceStatus.value = 'idle'; practiceMessage.value = null
    clearReadingMemory()
  }
  let boundOwner: Scope | null = scope()
  let coldSameOwner = false
  const READING_PRACTICE_ENTRY_MS = 120_000
  const READING_ENTRY_UNVERIFIED = '这次阅读练习入口无法核对，请从文章重新打开。'
  const READING_ENTRY_INELIGIBLE = '当前账号还不能继续这次阅读练习。'
  interface ReadingPracticeMemory {
    subject: string
    revision: number
    authSessionId: string | null
    sessionId: string
    contentCode: string
    contentVersionId: number
    questionItemId: number
    issuedAt: number
  }
  let readingEntry: ReadingPracticeMemory | null = null
  let readingVerifiedId: string | null = null
  let readingReadSeq = 0
  function clearReadingMemory(): void {
    readingEntry = null
    readingVerifiedId = null
    readingReadSeq += 1
  }
  function releaseOwner(): void {
    srsLoadSeq += 1
    syncToken += 1
    syncingSrs = false
    revealInFlight.clear()
    frontReady.clear()
    frontInFlight.clear()
    reset()
    removeLearningCache(STORAGE_KEY)
    coldSameOwner = false
    boundOwner = null
  }
  watch(() => `${session.verifiedSubject ?? ''}:${session.identityRevision}:${session.isAuthenticated ? 1 : 0}:${trustedSessionId() ?? ''}`, () => {
    const next = scope()
    if (!boundOwner) {
      if (!next) return
      boundOwner = next
      coldSameOwner = true
      return
    }
    if (!next) {
      const subjectNow = session.verifiedSubject ?? null
      const transient = subjectNow === boundOwner.subject && session.identityRevision === boundOwner.revision && trustedSessionId() === boundOwner.sessionId
      if (transient) return
      releaseOwner()
      return
    }
    if (next.subject !== boundOwner.subject || next.revision !== boundOwner.revision || next.sessionId !== boundOwner.sessionId) {
      releaseOwner()
      boundOwner = next
    }
  }, { flush: 'sync' })

  function persist(): void {
    const owner = scope()
    if (!owner) return
    const sessionId = trustedSessionId()
    const saved: PersistedState = { subject: owner.subject, revision: owner.revision, batch: batch.value, currentIndex: currentIndex.value, queuedReviews: queuedReviews.value, practice: practice.value, answers: answers.value, answerResults: answerResults.value, mistakes: mistakes.value, report: report.value }
    if (sessionId) saved.sessionId = sessionId
    getUniRuntime().setStorageSync(STORAGE_KEY, JSON.stringify(saved))
  }

  function restoreOwnerFacts(saved: PersistedState): void {
    if (saved.practice) practice.value = saved.practice
    if (isRecord(saved.answers)) answers.value = saved.answers as Record<string, B10AnswerInput>
    if (isRecord(saved.answerResults)) answerResults.value = saved.answerResults as Record<string, B10AnswerResult>
    if (Array.isArray(saved.mistakes)) mistakes.value = saved.mistakes
    if (saved.report) report.value = saved.report
  }

  function restore(): void {
    const owner = scope()
    if (!owner || restored.value) return
    const raw = getUniRuntime().getStorageSync(STORAGE_KEY)
    if (typeof raw === 'string' && raw) {
      try {
        const saved = JSON.parse(raw) as PersistedState
        const liveSession = trustedSessionId()
        const storedSession = textId(saved.sessionId)
        const hasRevision = typeof saved.revision === 'number' && Number.isFinite(saved.revision)
        const sameSession = Boolean(liveSession && storedSession && liveSession === storedSession)
        if (saved.subject !== owner.subject || (liveSession && storedSession && liveSession !== storedSession)) {
          removeLearningCache(STORAGE_KEY); restored.value = true; return
        }
        const trusted = sameSession || (hasRevision && saved.revision === owner.revision) || (coldSameOwner && hasRevision)
        if (hasRevision && !trusted) { removeLearningCache(STORAGE_KEY); restored.value = true; return }
        if (trusted) {
          if (isRecord(saved.batch)) batch.value = saved.batch as B10SrsBatch
          if (typeof saved.currentIndex === 'number') currentIndex.value = Math.max(0, saved.currentIndex)
          const queue = readQueuedReviews(saved, false)
          if (queue) queuedReviews.value = queue
        } else {
          // No numeric revision: owner drafts stay. Only an already wire-complete pending event is migrated, and the SRS cursor is not.
          const queue = readQueuedReviews(saved, true)
          if (queue) queuedReviews.value = queue
        }
        restoreOwnerFacts(saved)
      } catch { removeLearningCache(STORAGE_KEY) }
    }
    restored.value = true
  }

  function advanceSettledCards(): void {
    const items = batch.value?.items
    if (!items) return
    while (currentIndex.value < items.length && items[currentIndex.value]?.reviewStatus === 'ACCEPTED') currentIndex.value += 1
  }

  function enqueueReview(card: B10SrsCard, payload: Record<string, unknown>, clientEventId: string): boolean {
    const existingId = queuedReviews.value.find((item) => item.clientEventId === clientEventId)
    if (existingId) return existingId.cardId === card.id
    if (queuedReviews.value.some((item) => item.cardId === card.id)) return false
    queuedReviews.value.push({ clientEventId, payload, cardId: card.id })
    return true
  }

  function queuedItemIdentity(payload: Record<string, unknown>): { snapshotId: number; snapshotItemId: number; itemType: string; itemId: number } | null {
    if (!wholeNumber(payload.snapshotId, 1) || !wholeNumber(payload.snapshotItemId, 1) || !isRecord(payload.item)) return null
    const item = payload.item
    let itemType: string | null = null
    let itemId: unknown = null
    if (item.itemType === 'VOCAB') { itemType = 'VOCAB'; itemId = item.vocabId }
    else if (item.itemType === 'CHUNK') { itemType = 'CHUNK'; itemId = item.chunkId }
    else if (item.itemType === 'EXPRESSION') { itemType = 'EXPRESSION'; itemId = item.expressionId }
    if (!itemType || !wholeNumber(itemId, 1)) return null
    return { snapshotId: payload.snapshotId, snapshotItemId: payload.snapshotItemId, itemType, itemId }
  }

  // Identity is the authoritative snapshot item plus its item ref. A later snapshot is a different card.
  function sameQueuedCard(entry: QueuedReview, card: B10SrsCard): boolean {
    if (card.snapshotId === null) return false
    const canonicalId = `${card.snapshotId}-${card.snapshotItemId}`
    if (card.id !== canonicalId || entry.cardId !== canonicalId) return false
    const identity = queuedItemIdentity(entry.payload)
    return Boolean(identity && identity.snapshotId === card.snapshotId && identity.snapshotItemId === card.snapshotItemId && identity.itemType === card.itemType && identity.itemId === card.itemId)
  }

  function markAuthoritativeQueuedCards(items: readonly B10SrsCard[]): void {
    for (const card of items) {
      if (queuedReviews.value.some((entry) => sameQueuedCard(entry, card))) card.reviewStatus = 'QUEUED'
    }
  }

  async function loadSrs(): Promise<void> {
    const owner = scope()
    if (!owner) { srsLoadSeq += 1; reset(); status.value = 'forbidden'; return }
    const requestSeq = ++srsLoadSeq
    restore(); status.value = 'loading'; message.value = null
    try {
      const remote = await b10LearningApi.createSrsBatch(context(), nowId('srs-batch'))
      if (!stillCurrent(owner) || requestSeq !== srsLoadSeq) return
      const previousSnapshotId = batch.value?.snapshotId ?? null
      frontReady.clear()
      frontInFlight.clear()
      batch.value = remote
      if (batch.value.status === 'RECOVERY_REQUIRED') {
        status.value = 'stale'; message.value = '复习记录待核验，暂不可结算。'; persist(); return
      }
      const nextSnapshotId = batch.value.snapshotId
      if (previousSnapshotId === null || nextSnapshotId === null || previousSnapshotId !== nextSnapshotId) currentIndex.value = firstEligibleIndex(batch.value.items)
      else currentIndex.value = Math.min(Math.max(0, currentIndex.value), batch.value.items.length)
      markAuthoritativeQueuedCards(batch.value.items)
      advanceSettledCards()
      status.value = batch.value.items.length ? 'ready' : 'empty'
      persist()
    } catch (error) {
      if (!stillCurrent(owner) || requestSeq !== srsLoadSeq) return
      const info = b10ErrorInfo(error, '词汇批次暂时无法加载。')
      status.value = info.kind; message.value = info.message; persist()
    }
  }

  async function revealCard(card = currentCard.value): Promise<void> {
    const owner = scope()
    const selectedBatch = batch.value
    if (!owner || !card || !selectedBatch?.items.includes(card) || card.revealed || card.reviewStatus === 'SUBMITTING' || revealInFlight.has(card.id)) return
    revealInFlight.add(card.id)
    status.value = 'loading'; message.value = null
    try {
      const detail = await b10LearningApi.getVocabularyDetail(context(), card.itemId, card.contentVersion)
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card)) return
      Object.assign(card, detail)
      card.revealed = true
      if (card.reviewStatus === 'PENDING' || card.reviewStatus === 'FAILED') card.reviewStatus = 'PENDING'
      status.value = 'ready'; persist()
    } catch (error) {
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card)) return
      const info = b10ErrorInfo(error, '词卡背面暂时无法加载，答案未被伪造。')
      status.value = info.kind; message.value = info.message
      if (info.kind === 'stale') card.reviewStatus = 'STALE'
      persist()
    } finally {
      revealInFlight.delete(card.id)
    }
  }

  // Device calls this after loadSrs for the current card only. loadSrs, revealCard, and rateCard do not call it.
  async function loadCurrentFront(card = currentCard.value): Promise<void> {
    const owner = scope()
    const selectedBatch = batch.value
    if (!owner || !card || currentCard.value !== card || !selectedBatch?.items.includes(card)) return
    if (card.itemType !== 'VOCAB' || card.revealed || selectedBatch.status === 'RECOVERY_REQUIRED' || selectedBatch.items.length === 0) return
    const flightKey = `${selectedBatch.snapshotId}:${card.id}`
    if (frontReady.has(flightKey)) return
    const pending = frontInFlight.get(flightKey)
    if (pending) { await pending; return }
    let finishFlight: () => void = () => {}
    const flight = new Promise<void>((resolve) => { finishFlight = resolve })
    frontInFlight.set(flightKey, flight)
    try {
      const front = await b10LearningApi.getVocabularyFront(context(), card.itemId, card.contentVersion)
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card) || currentCard.value !== card) return
      if (String(front.vocabId) !== String(card.itemId)) {
        status.value = 'stale'; message.value = '词汇正面与当前卡片不一致，未显示。'; persist(); return
      }
      if ((front.contentVersion && card.contentVersion && front.contentVersion !== card.contentVersion) || (front.contentVersionId !== null && card.contentVersionId !== null && front.contentVersionId !== card.contentVersionId)) {
        status.value = 'stale'; message.value = '词汇正面版本与当前卡片不一致，未写入。'; persist(); return
      }
      card.title = front.word
      card.phoneticUs = front.phoneticUs
      card.phoneticUk = front.phoneticUk
      card.phonetic = front.phonetic
      card.audio = front.audio
      card.audioUrl = front.audioUrl
      if (card.contentVersion === null && front.contentVersion) card.contentVersion = front.contentVersion
      if (card.contentVersionId === null && front.contentVersionId !== null) card.contentVersionId = front.contentVersionId
      card.meaningCn = null
      card.definitionEn = null
      card.definitions = []
      card.examples = []
      card.exampleItems = []
      card.hint = null
      frontReady.add(flightKey)
      status.value = 'ready'; message.value = null; persist()
    } catch (error) {
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card) || currentCard.value !== card) return
      if (error instanceof Error && error.message.includes('接口契约')) {
        status.value = 'stale'; message.value = '词汇正面不符合契约，未显示答案或自造词。'; persist(); return
      }
      const info = b10ErrorInfo(error, '词汇正面暂时无法加载。')
      status.value = info.kind; message.value = info.message
      if (info.kind === 'stale') card.reviewStatus = 'STALE'
      persist()
    } finally {
      if (frontInFlight.get(flightKey) === flight) frontInFlight.delete(flightKey)
      finishFlight()
    }
  }

  function reviewPayload(card: B10SrsCard, quality: 0 | 1 | 2 | 3, clientEventId: string): Record<string, unknown> | null {
    if (!card.snapshotId || !card.snapshotItemId || card.stateVersion === null) return null
    const item = reviewItemRef(card)
    if (!item) return null
    return { snapshotId: card.snapshotId, snapshotItemId: card.snapshotItemId, item, rawQuality: quality, answerOutcome: 'REVEALED_WITHOUT_ANSWER', responseTimeMs: 0, revealElapsedMs: 0, clientEventId, clientOccurredAt: new Date().toISOString(), baseStateVersion: card.stateVersion }
  }

  async function rateCard(quality: 0 | 1 | 2 | 3, card = currentCard.value): Promise<void> {
    const owner = scope()
    const selectedBatch = batch.value
    if (!owner || !card || !selectedBatch?.items.includes(card) || !card.revealed || card.reviewStatus === 'SUBMITTING' || card.reviewStatus === 'ACCEPTED') return
    const pendingReview = queuedReviews.value.find((entry) => sameQueuedCard(entry, card))
    if (card.reviewStatus === 'QUEUED' || pendingReview) {
      if (pendingReview) card.reviewStatus = 'QUEUED'
      status.value = 'offline'; message.value = '该卡片已在待同步队列，评分不会改写已排队事件。'; return
    }
    if (card.reviewStatus === 'STALE') { status.value = 'stale'; message.value = '当前卡片未获可信回执，请重新读取复习批次。'; return }
    if (!card.snapshotId || !card.snapshotItemId) { card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '当前卡片缺少服务端批次标识，不能提交复习事件。'; persist(); return }
    if (card.stateVersion === null) { card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '当前卡片缺少可信 SRS 状态版本，暂不可结算。'; persist(); return }
    const clientEventId = nowId(`srs-review-${card.id}`)
    const payload = reviewPayload(card, quality, clientEventId)
    if (!payload) { card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '当前卡片没有可提交的合同项标识，暂不可结算。'; persist(); return }
    card.reviewStatus = 'SUBMITTING'; status.value = 'loading'; message.value = null
    try {
      const response = await b10LearningApi.submitSrsReview(context(), card, quality, clientEventId, payload)
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card)) return
      const remoteStatus = responseStatus(response)
      if (remoteStatus === 'PENDING_SYNC') {
        if (enqueueReview(card, payload, clientEventId)) { card.reviewStatus = 'QUEUED'; status.value = 'offline'; message.value = '本次复习已排队待同步，服务端尚未确认掌握变化。' }
        else { card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '该卡片已有待同步事件，未生成新的复习 ID。' }
        persist(); return
      }
      const verified = verifiedSrsReceipt(response, card)
      if (verified) {
        applyVerifiedSrsReceipt(card, verified)
        card.reviewStatus = 'ACCEPTED'; status.value = 'ready'; message.value = '复习已记录。'
        advanceSettledCards(); persist(); return
      }
      const stale = remoteStatus === 'CONFLICT' || remoteStatus === 'EXPIRED' || !isTerminalSrsStatus(remoteStatus)
      card.reviewStatus = stale ? 'STALE' : 'FAILED'
      status.value = stale ? 'stale' : 'error'
      message.value = remoteStatus === 'CONFLICT' || remoteStatus === 'EXPIRED'
        ? '服务端状态已冲突或过期，请重新读取复习批次。'
        : isTerminalSrsStatus(remoteStatus) ? '服务端未接受本次复习，未更新掌握度。' : '服务端回执缺少可核验的状态版本，当前卡片未推进。'
      persist()
    } catch (error) {
      if (!stillCurrent(owner) || batch.value !== selectedBatch || !selectedBatch.items.includes(card)) return
      if (error instanceof Error && error.message.includes('接口契约')) {
        card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '复习服务回执不符合契约，当前卡片未推进。'; persist(); return
      }
      const info = b10ErrorInfo(error, '复习提交失败。')
      if (info.kind === 'offline') {
        if (enqueueReview(card, payload, clientEventId)) { card.reviewStatus = 'QUEUED'; status.value = 'offline'; message.value = '本次复习已排队待同步，服务端尚未确认掌握变化。' }
        else { card.reviewStatus = 'STALE'; status.value = 'stale'; message.value = '该卡片已有待同步事件，未生成新的复习 ID。' }
      } else { card.reviewStatus = info.kind === 'stale' ? 'STALE' : 'FAILED'; status.value = info.kind; message.value = info.message }
      persist()
    }
  }

  async function syncSrs(): Promise<void> {
    const owner = scope()
    if (!owner || syncingSrs || !queuedReviews.value.length) return
    const token = ++syncToken
    const selectedBatch = batch.value
    const queued = [...queuedReviews.value]
    syncingSrs = true; status.value = 'loading'; message.value = null
    try {
      const response = await b10LearningApi.syncSrsReviews(context(), queued.map((item) => item.payload), nowId('srs-sync'))
      if (!stillCurrent(owner) || batch.value !== selectedBatch) return
      const results = responseItems(response)
      const grouped = new Map<string, unknown[]>()
      let malformedResult = false
      for (const result of results) {
        const id = responseClientEventId(result)
        if (!id) { malformedResult = true; continue }
        const bucket = grouped.get(id) ?? []
        bucket.push(result)
        grouped.set(id, bucket)
      }
      const removable = new Set<string>()
      let stale = malformedResult
      let refused = false
      for (const item of queued) {
        const card = selectedBatch?.items.find((entry) => entry.id === item.cardId && sameQueuedCard(item, entry))
        const matches = grouped.get(item.clientEventId) ?? []
        if (matches.length === 0) { if (card) card.reviewStatus = 'QUEUED'; continue }
        if (matches.length > 1) { if (card) card.reviewStatus = 'STALE'; stale = true; continue }
        const result = matches[0]
        const remoteStatus = responseStatus(result)
        if (isSettledSrsStatus(remoteStatus)) {
          const verified = card ? verifiedSrsReceipt(result, card) : null
          if (!verified || !card) { if (card) card.reviewStatus = 'STALE'; stale = true; continue }
          applyVerifiedSrsReceipt(card, verified)
          card.reviewStatus = 'ACCEPTED'
          removable.add(item.clientEventId)
        } else if (remoteStatus === 'CONFLICT' || remoteStatus === 'EXPIRED') {
          if (card) { card.reviewStatus = 'STALE'; removable.add(item.clientEventId) }
          stale = true
        } else if (isTerminalSrsStatus(remoteStatus)) {
          if (card) { card.reviewStatus = 'FAILED'; removable.add(item.clientEventId) }
          refused = true
        } else {
          if (card) card.reviewStatus = 'QUEUED'
        }
      }
      if (removable.size) queuedReviews.value = queuedReviews.value.filter((item) => !removable.has(item.clientEventId))
      if (queuedReviews.value.length) {
        status.value = stale ? 'stale' : 'offline'
        message.value = stale ? '部分复习回执无法核验，未结算项仍保留。' : '部分复习尚未获得服务端确认，队列仍保留。'
      } else if (stale) {
        status.value = 'stale'; message.value = '复习回执无法核验，未标记为已掌握。'
      } else if (refused) {
        status.value = 'error'; message.value = '服务端拒绝了部分复习，未标记为已掌握。'
      } else {
        status.value = 'ready'; message.value = '待同步复习已结算。'
      }
      advanceSettledCards()
      persist()
    } catch (error) {
      if (!stillCurrent(owner) || batch.value !== selectedBatch) return
      if (error instanceof Error && error.message.includes('接口契约')) {
        status.value = 'stale'; message.value = '同步回执不符合契约，队列仍保留。'; persist(); return
      }
      const info = b10ErrorInfo(error, '同步失败，队列仍保留。'); status.value = info.kind; message.value = info.message; persist()
    } finally {
      if (token === syncToken) syncingSrs = false
    }
  }

  function readingEntryMatched(now = Date.now()): ReadingPracticeMemory | null {
    const owner = scope()
    const entry = readingEntry
    if (!owner || !entry) return null
    if (entry.subject !== owner.subject || entry.revision !== owner.revision || entry.authSessionId !== owner.sessionId) return null
    if (!Number.isSafeInteger(entry.issuedAt) || !Number.isFinite(now) || now < entry.issuedAt) return null
    return entry
  }

  function readingEntryFresh(entry: ReadingPracticeMemory, now: number): boolean {
    return now - entry.issuedAt < READING_PRACTICE_ENTRY_MS
  }

  function readingEntryCurrent(now = Date.now()): ReadingPracticeMemory | null {
    const entry = readingEntryMatched(now)
    if (!entry || !readingEntryFresh(entry, now)) return null
    return entry
  }

  function liveLearningEligible(): boolean {
    if (!scope()) return false
    if (session.learningConsentWithdrawn === true) return false
    if (typeof session.adultGate === 'string' && session.adultGate !== 'PASSED') return false
    if (typeof session.adultLearningAccess === 'string' && session.adultLearningAccess !== 'ELIGIBLE') return false
    if (session.isLearningReady === false) return false
    return true
  }

  function readingPinOf(entry: ReadingPracticeMemory): { contentCode: string; contentVersionId: number; questionItemId: number } {
    return { contentCode: entry.contentCode, contentVersionId: entry.contentVersionId, questionItemId: entry.questionItemId }
  }

  function hideReadingSurface(): void {
    practice.value = null
    answers.value = {}
    answerResults.value = {}
    readingVerifiedId = null
  }

  function rememberReadingPractice(session: B10AssessmentSession, pin: { contentCode: string; contentVersionId: number; questionItemId: number }): boolean {
    const owner = scope()
    if (!owner || !session || typeof acceptPinnedReadingSession !== 'function' || !acceptPinnedReadingSession(session, session.sessionId, pin)) return false
    readingReadSeq += 1
    readingVerifiedId = null
    readingEntry = {
      subject: owner.subject,
      revision: owner.revision,
      authSessionId: owner.sessionId,
      sessionId: session.sessionId,
      contentCode: pin.contentCode,
      contentVersionId: pin.contentVersionId,
      questionItemId: pin.questionItemId,
      issuedAt: Date.now(),
    }
    return true
  }

  function forgetReadingPractice(): void {
    clearReadingMemory()
  }

  function abandonReadingPracticeRead(): void {
    readingReadSeq += 1
  }

  function readingPracticeEntryOpen(): boolean {
    return readingEntryCurrent() !== null
  }

  function readingOwned(entry: ReadingPracticeMemory | null): boolean {
    return Boolean(entry && readingVerifiedId === entry.sessionId)
  }

  function readingPracticeVisible(): boolean {
    const entry = readingEntryMatched()
    const current = practice.value
    if (!entry || !current || !readingOwned(entry) || current.sessionId !== entry.sessionId || practiceStatus.value !== 'ready' || !liveLearningEligible()) return false
    return typeof acceptPinnedReadingSession === 'function' && acceptPinnedReadingSession(current, entry.sessionId, readingPinOf(entry))
  }

  function closeReadingRead(seq: number, owner: Scope, kind: 'error' | 'forbidden', message: string): void {
    if (seq !== readingReadSeq || !stillCurrent(owner)) return
    hideReadingSurface()
    practiceStatus.value = kind
    practiceMessage.value = message
  }

  async function loadReadingPractice(): Promise<void> {
    const owner = scope()
    const seq = ++readingReadSeq
    if (!owner) { reset(); practiceStatus.value = 'forbidden'; return }
    const matched = readingEntryMatched()
    const eligible = liveLearningEligible()
    const verifiedBefore = Boolean(matched && readingOwned(matched) && eligible)
    const entry = matched && (verifiedBefore || (readingEntryFresh(matched, Date.now()) && eligible)) ? matched : null
    hideReadingSurface()
    if (!entry) {
      closeReadingRead(seq, owner, matched && !eligible ? 'forbidden' : 'error', matched && !eligible ? READING_ENTRY_INELIGIBLE : READING_ENTRY_UNVERIFIED)
      return
    }
    const pin = readingPinOf(entry)
    practiceStatus.value = 'loading'
    practiceMessage.value = null
    try {
      const remote = await b10LearningApi.readPinnedReadingSession(context(), entry.sessionId, pin)
      if (seq !== readingReadSeq || !stillCurrent(owner)) return
      const live = readingEntryMatched()
      if (!live || live.sessionId !== entry.sessionId || live.contentCode !== pin.contentCode || live.contentVersionId !== pin.contentVersionId || live.questionItemId !== pin.questionItemId) return
      if (!liveLearningEligible()) {
        closeReadingRead(seq, owner, 'forbidden', READING_ENTRY_INELIGIBLE)
        return
      }
      if (!verifiedBefore && !readingEntryFresh(live, Date.now())) {
        closeReadingRead(seq, owner, 'error', READING_ENTRY_UNVERIFIED)
        return
      }
      if (typeof acceptPinnedReadingSession !== 'function' || remote.sessionId !== entry.sessionId || !acceptPinnedReadingSession(remote, entry.sessionId, pin)) {
        hideReadingSurface()
        practiceStatus.value = 'error'
        practiceMessage.value = '练习会话没有对上当前文章版本。'
        return
      }
      practice.value = remote
      answers.value = {}
      answerResults.value = {}
      readingVerifiedId = entry.sessionId
      practiceStatus.value = 'ready'
      practiceMessage.value = null
    } catch (error) {
      if (seq !== readingReadSeq || !stillCurrent(owner)) return
      hideReadingSurface()
      const info = b10ErrorInfo(error, '这次阅读练习暂时没有读取成功。')
      practiceStatus.value = info.kind
      practiceMessage.value = info.message
    }
  }

  async function loadPractice(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); practiceStatus.value = 'forbidden'; return }
    restore(); practiceStatus.value = 'loading'; practiceMessage.value = null
    try {
      const remote = practice.value?.sessionId && ['IN_PROGRESS', 'INTERRUPTED', 'CREATED'].includes(practice.value.status)
        ? await b10LearningApi.readAssessmentSession(context(), practice.value.sessionId)
        : await b10LearningApi.createAssessmentSession(context(), { sessionType: 'DAILY_STREAM', targetCount: 15 }, nowId('assessment-session'))
      if (!stillCurrent(owner)) return
      practice.value = remote
      practiceStatus.value = practice.value.exercises.length ? 'ready' : 'empty'; persist()
    } catch (error) {
      if (!stillCurrent(owner)) return
      // 410 = this legacy fixed content version has no gradable items left; say so and point to the live entry.
      if ((error as { status?: unknown } | null)?.status === 410) { practiceStatus.value = 'empty'; practiceMessage.value = '这个旧版练习入口的题组已下线，请从底部「练习」进入今天的练习。'; persist(); return }
      const info = b10ErrorInfo(error, '练习会话暂时无法创建。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist()
    }
  }

  async function submitAnswer(exerciseId: number, answer: B10AnswerInput): Promise<B10AnswerResult | null> {
    const owner = scope()
    if (!owner) return null
    if (!practice.value || answerResults.value[String(exerciseId)]) return answerResults.value[String(exerciseId)] ?? null
    const selectedPractice = practice.value
    answers.value[String(exerciseId)] = answer; practiceStatus.value = 'loading'; practiceMessage.value = null
    const revision = (practice.value.answerSheet.find((item) => item.exerciseId === exerciseId)?.revision ?? 0) + 1
    const clientEventId = nowId(`assessment-answer-${exerciseId}`)
    try {
      const result = await b10LearningApi.submitAssessmentAnswer(context(), practice.value.sessionId, exerciseId, answer, revision, practice.value.lastCheckpointSeq, clientEventId, practice.value.stateVersion)
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return null
      answerResults.value[String(exerciseId)] = result
      if (result.attemptId) practice.value.lastAttemptId = result.attemptId
      if (result.reportId) practice.value.reportId = result.reportId
      practice.value.stateVersion += 1
      practiceStatus.value = result.contentVersionStale ? 'stale' : 'ready'; practiceMessage.value = result.contentVersionStale ? '题目版本已失效，请重新读取会话。' : null; persist(); return result
    } catch (error) {
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return null
      const info = b10ErrorInfo(error, '答案提交失败，当前答案已保留。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist(); return null
    }
  }

  async function saveCheckpoint(exerciseId: number | null): Promise<void> {
    const owner = scope()
    if (!owner || !practice.value) return
    const selectedPractice = practice.value
    practice.value.lastCheckpointSeq += 1; const clientEventId = nowId(`assessment-checkpoint-${practice.value.lastCheckpointSeq}`)
    if (!practice.value.lastAttemptId) return
    try {
      const digest = await hashState({ exerciseId, answeredExerciseIds: Object.keys(answers.value).map(Number).sort() })
      if (!stillCurrent(owner) || practice.value !== selectedPractice) return
      await b10LearningApi.saveAssessmentCheckpoint(context(), selectedPractice.sessionId, selectedPractice.lastAttemptId!, selectedPractice.lastCheckpointSeq, exerciseId, digest, clientEventId)
      if (stillCurrent(owner) && practice.value === selectedPractice) persist()
    }
    catch (error) { if (!stillCurrent(owner) || practice.value !== selectedPractice) return; const info = b10ErrorInfo(error, '断点保存失败，当前作答仍保留在本机。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function completePractice(): Promise<void> {
    const owner = scope()
    if (!owner || !practice.value) return
    const selectedPractice = practice.value
    practiceStatus.value = 'loading'; practiceMessage.value = null
    try { const remote = await b10LearningApi.completeAssessmentSession(context(), selectedPractice.sessionId, nowId('assessment-complete')); if (!stillCurrent(owner) || practice.value !== selectedPractice) return; report.value = remote; practiceStatus.value = 'ready'; persist() }
    catch (error) { if (!stillCurrent(owner) || practice.value !== selectedPractice) return; const info = b10ErrorInfo(error, '提交结算失败，未伪造报告。'); practiceStatus.value = info.kind; practiceMessage.value = info.message; persist() }
  }

  async function loadMistakes(): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); status.value = 'forbidden'; return }
    status.value = 'loading'; message.value = null
    try { const remote = await b10LearningApi.listMistakeBook(context()); if (!stillCurrent(owner)) return; mistakes.value = remote.items; attemptCount.value = remote.attemptCount; emptyCopy.value = remote.emptyCopy; projectionVersion.value = remote.projectionVersion || 'IT4-MISTAKE-1'; const listed = remote.items.find((item) => item.remediationId)?.remediationId ?? null; if (listed) remediationId.value = listed; status.value = mistakes.value.length ? 'ready' : 'empty'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '错题服务暂时不可用。'); status.value = info.kind; message.value = info.message; persist() }
  }

  async function startMistakeRetry(mistakeId: number): Promise<void> {
    const owner = scope()
    if (!owner || !mistakes.value.some((item) => item.mistakeId === mistakeId)) return
    status.value = 'loading'; message.value = null
    try { const verification = await b10LearningApi.startMistakeRetry(context(), mistakeId, nowId(`mistake-retry-${mistakeId}`)); if (!stillCurrent(owner)) return; remediationId.value = verification.remediationId ?? verification.verificationId; status.value = 'ready'; message.value = '订正会话已创建。'; await loadMistakes() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '错题订正暂时不可用。'); status.value = info.kind; message.value = info.message }
  }

  async function loadReport(period: 'daily' | 'weekly' = 'daily'): Promise<void> {
    const owner = scope()
    if (!owner) { reset(); reportStatus.value = 'forbidden'; return }
    reportStatus.value = 'loading'
    try { const remote = await b10LearningApi.readReport(context(), period); if (!stillCurrent(owner)) return; report.value = remote; reportStatus.value = report.value.status === 'FAILED' ? 'error' : report.value.status === 'GENERATING' ? 'loading' : 'ready'; persist() }
    catch (error) { if (!stillCurrent(owner)) return; const info = b10ErrorInfo(error, '报告暂时不可用。'); reportStatus.value = info.kind; message.value = info.message; persist() }
  }

  return { restored, status, message, batch, currentIndex, queuedReviews, practice, answers, answerResults, mistakes, attemptCount, emptyCopy, projectionVersion, remediationId, report, reportStatus, practiceStatus, practiceMessage, srsQueueCount, currentCard, currentExercise, restore, persist, loadSrs, loadCurrentFront, revealCard, rateCard, syncSrs, loadPractice, rememberReadingPractice, forgetReadingPractice, abandonReadingPracticeRead, readingPracticeEntryOpen, readingPracticeVisible, loadReadingPractice, submitAnswer, saveCheckpoint, completePractice, loadMistakes, startMistakeRetry, loadReport }
})
