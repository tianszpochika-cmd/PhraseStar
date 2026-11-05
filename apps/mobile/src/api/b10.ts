import { unavailableOperation } from './unavailable'
import { mobileApiClient, MobileApiError } from './client'
import { mentionsClosedMissing, PACK_CLOSED_COPY } from '../domain/grammar-reading-pack'
import { listGrammarExercises as listB3GrammarExercises } from './b3'
import { grammarPreviewItems, grammarQuestionItemId, parseGrammarPointContent } from '../domain/grammar-page'
import { createClientId } from '../platform/client-id'
import type {
  B10AnswerInput,
  B10AnswerResult,
  B10AssessmentSession,
  B10ContentVersionContext,
  B10Exercise,
  B10GrammarPoint,
  B10ItemType,
  B10Mistake,
  B10ReadingArticle,
  B10ReadingAttempt,
  B10ReadingQuestion,
  B10Report,
  B10RequestContext,
  B10RuleFeedback,
  B10SrsBatch,
  B10SrsCard,
  B10SrsReviewResult,
  B10SrsState,
  B10SrsSyncResult,
  B10SyntaxGraph,
  B10Verification,
  B10VocabAudio,
  B10VocabDefinition,
  B10VocabExample,
  B10VocabularyDetail,
  B10VocabularyFront,
  B10WritingPrompt,
} from '../domain/b10'

type RecordValue = Record<string, unknown>

/**
 * These are Gateway routes, not service URLs. Gateway owns the public prefix;
 * the mobile app never selects a learner/content/assessment service directly.
 */
export const B10_GATEWAY_PATHS = {
  content: {
    catalog: '/content/learner/catalog',
    projection: '/content/learner',
    vocabularyDetail: '/content/learner/vocabulary',
    grammarPoints: '/grammar/points',
    readingArticles: '/reading/articles',
    readingQuestions: '/reading/questions',
    writingPrompts: '/writing/prompts',
  },
  learning: {
    srsBatch: '/learning/srs/batches',
    srsReview: '/learning/srs/reviews',
    srsSync: '/learning/srs/reviews:sync',
    readingProgress: '/reading/progress',
  },
  assessment: {
    dailyStream: '/assessment/daily-stream',
    sessions: '/assessment/sessions',
    masteryMistakes: '/mastery/mistakes',
    masteryVerifications: '/mastery/verifications',
    dailyReport: '/learning/stats/daily-report',
    reportShare: '/learning/reports',
    reportShareRevoke: '/learning/report-shares',
    weeklyReport: '/learning/stats/weekly-report',
    readingMining: '/reading/mining',
  },
} as const

export interface B10ErrorInfo {
  status: number
  message: string
  retryable: boolean
  kind: 'offline' | 'forbidden' | 'stale' | 'error'
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrap(value: unknown): unknown {
  if (!isRecord(value)) return value
  if ('data' in value) return value.data
  if ('result' in value) return value.result
  return value
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function number(value: unknown, fallback = 0): number {
  const candidate = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN
  return Number.isFinite(candidate) ? candidate : fallback
}

function nullableNumber(value: unknown): number | null {
  const candidate = number(value, NaN)
  return Number.isFinite(candidate) && candidate > 0 ? candidate : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function query(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const params = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  return params.length ? `${path}${path.includes('?') ? '&' : '?'}${params.join('&')}` : path
}

function idempotencyKey(clientEventId: string): string {
  return `b10-${clientEventId}`.slice(0, 120)
}

function headers(context: B10RequestContext, clientEventId?: string): Record<string, string> {
  return {
    'Accept-Language': context.uiLocale,
    ...(clientEventId ? { 'Idempotency-Key': idempotencyKey(clientEventId) } : {}),
  }
}

function contentContext(context: B10RequestContext, extra: Record<string, string | number | boolean | undefined> = {}): string {
  return query('', { contentLocale: context.contentLocale, ...extra }).replace(/^\?/, '')
}

function listFrom(value: unknown): unknown[] {
  const source = unwrap(value)
  if (Array.isArray(source)) return source
  if (!isRecord(source)) return []
  if (Array.isArray(source.items)) return source.items
  if (Array.isArray(source.cards)) return source.cards
  if (Array.isArray(source.exercises)) return source.exercises
  if (Array.isArray(source.mistakes)) return source.mistakes
  if (Array.isArray(source.questions)) return source.questions
  return []
}

function mapError(error: unknown, fallback: string): B10ErrorInfo {
  const apiError = error instanceof MobileApiError ? error : null
  const status = apiError?.status ?? 0
  const details = apiError?.details
  const detailRecord = isRecord(details) ? details : {}
  const nestedError = isRecord(detailRecord.error) ? detailRecord.error : {}
  const message = text(nestedError.message ?? detailRecord.message, error instanceof Error ? error.message : fallback) || fallback
  if (mentionsClosedMissing(error) || mentionsClosedMissing(detailRecord)) return { status, message: PACK_CLOSED_COPY, retryable: false, kind: 'error' }
  if (status === 401) return { status, message: '请先登录后再继续学习。', retryable: false, kind: 'forbidden' }
  if (status === 403) return { status, message, retryable: false, kind: 'forbidden' }
  if (status === 404 || status === 410) return { status, message: status === 410 ? '内容版本已失效，请重新读取当前版本。' : message, retryable: false, kind: 'stale' }
  if (status === 0 || status >= 500) return { status, message, retryable: true, kind: 'offline' }
  return { status, message, retryable: false, kind: 'error' }
}

function srsError(): Error {
  return new Error('复习服务返回的数据不符合接口契约，已停止显示。')
}

function vocabError(): Error {
  return new Error('词汇服务返回的数据不符合接口契约，已停止显示。')
}

function contractRecord(value: unknown, fail: () => Error): RecordValue {
  if (!isRecord(value)) throw fail()
  return value
}

function contractText(value: unknown, fail: () => Error): string {
  if (typeof value !== 'string' || !value.trim()) throw fail()
  return value.trim()
}

function contractOptionalText(value: unknown, fail: () => Error): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') throw fail()
  return value.trim() || null
}

function contractInteger(value: unknown, fail: () => Error, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum) throw fail()
  return value
}

function contractOptionalInteger(value: unknown, fail: () => Error, minimum = 0): number | null {
  if (value === undefined || value === null) return null
  return contractInteger(value, fail, minimum)
}

function contractNumber(value: unknown, fail: () => Error): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw fail()
  return value
}

function contractEnum<T extends string>(value: unknown, allowed: readonly T[], fail: () => Error): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) throw fail()
  return value as T
}

function contractOptionalEnum<T extends string>(value: unknown, allowed: readonly T[], fail: () => Error): T | null {
  if (value === undefined || value === null) return null
  return contractEnum(value, allowed, fail)
}

const SRS_ITEM_TYPES = ['VOCAB', 'CHUNK', 'EXPRESSION'] as const
type SrsRefItemType = (typeof SRS_ITEM_TYPES)[number]
const SRS_ITEM_ID_FIELDS: Record<SrsRefItemType, keyof RecordValue> = { VOCAB: 'vocabId', CHUNK: 'chunkId', EXPRESSION: 'expressionId' }
const SRS_SOURCE_REASONS = ['NEW', 'DUE', 'OVERDUE_SMOOTHING', 'D1_VERIFY', 'D7_VERIFY', 'MISTAKE_REPAIR', 'EXPRESSION'] as const
const SRS_ITEM_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'EXPIRED', 'RISK_FILTERED'] as const
const MASTERY_STATUSES_FULL = ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED', 'SHORT_TERM', 'CONSOLIDATING', 'AT_RISK', 'SUSPENDED'] as const
const DELAYED_VERIFY_STAGES = ['NONE', 'D1_PENDING', 'D7_PENDING', 'PASSED', 'FAILED'] as const
const RISK_BANDS = ['LOW', 'MEDIUM', 'HIGH'] as const
const REVIEW_EVENT_STATUSES = ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED', 'CONFLICT', 'REJECTED', 'EXPIRED'] as const
const REVIEW_RISK_DECISIONS = ['ALLOW', 'ACCEPT_NO_REWARD', 'THROTTLE', 'REJECT', 'REVIEW'] as const
const REVIEW_REWARD_STATUSES = ['PENDING', 'SETTLED', 'NOT_ELIGIBLE', 'DUPLICATE'] as const
const REVIEW_ANSWER_OUTCOMES = ['CORRECT', 'INCORRECT', 'UNANSWERED', 'REVEALED_WITHOUT_ANSWER'] as const
const REVIEW_EVENT_KEYS = ['snapshotId', 'snapshotItemId', 'item', 'rawQuality', 'answerOutcome', 'responseTimeMs', 'revealElapsedMs', 'attemptNo', 'clientEventId', 'clientOccurredAt', 'baseStateVersion'] as const

function parseSrsItemRef(value: unknown, fail: () => Error): { itemType: SrsRefItemType; itemId: number } {
  const source = contractRecord(value, fail)
  const itemType = contractEnum(source.itemType, SRS_ITEM_TYPES, fail)
  for (const type of SRS_ITEM_TYPES) {
    if (type !== itemType && source[SRS_ITEM_ID_FIELDS[type]] !== undefined) throw fail()
  }
  const itemId = contractInteger(source[SRS_ITEM_ID_FIELDS[itemType]], fail, 1)
  return { itemType, itemId }
}

function srsItemRef(itemType: B10ItemType, itemId: number): RecordValue {
  if (itemType === 'VOCAB') return { itemType, vocabId: itemId }
  if (itemType === 'CHUNK') return { itemType, chunkId: itemId }
  if (itemType === 'EXPRESSION') return { itemType, expressionId: itemId }
  // PHRASE has no LearningItemRef id field in the published contract.
  throw srsError()
}

function parseSrsState(value: unknown, fail: () => Error): B10SrsState {
  const source = contractRecord(value, fail)
  const ref = parseSrsItemRef(source.item, fail)
  if (source.explanation !== undefined && !Array.isArray(source.explanation)) throw fail()
  const explanation = Array.isArray(source.explanation) ? source.explanation.map((entry) => contractText(entry, fail)) : []
  return {
    srsStateId: contractInteger(source.srsStateId, fail, 1),
    itemType: ref.itemType,
    itemId: ref.itemId,
    repetitionCount: contractInteger(source.repetitionCount, fail, 0),
    easeFactor: contractNumber(source.easeFactor, fail),
    intervalDays: contractInteger(source.intervalDays, fail, 0),
    dueAt: contractText(source.dueAt, fail),
    dueLocalDate: contractText(source.dueLocalDate, fail),
    masteryStatus: contractEnum(source.masteryStatus, MASTERY_STATUSES_FULL, fail),
    delayedVerifyStage: contractOptionalEnum(source.delayedVerifyStage, DELAYED_VERIFY_STAGES, fail),
    stateVersion: contractInteger(source.stateVersion, fail, 0),
    riskBand: contractOptionalEnum(source.riskBand, RISK_BANDS, fail),
    explanation,
  }
}

function parseSrsCard(value: unknown, snapshotId: number): B10SrsCard {
  const fail = srsError
  const source = contractRecord(value, fail)
  const snapshotItemId = contractInteger(source.snapshotItemId, fail, 1)
  const sequenceNo = contractInteger(source.sequenceNo, fail, 1)
  const ref = parseSrsItemRef(source.item, fail)
  const sourceReason = contractEnum(source.sourceReason, SRS_SOURCE_REASONS, fail)
  contractText(source.plannedLocalDate, fail)
  contractEnum(source.status, SRS_ITEM_STATUSES, fail)
  const contentVersion = contractOptionalText(source.contentVersion, fail)
  const srs = source.srsState !== undefined && source.srsState !== null ? parseSrsState(source.srsState, fail) : null
  const explicitStateVersion = contractOptionalInteger(source.stateVersion ?? source.stateVersionAtSnapshot, fail, 0)
  // The published SRS batch item carries no state version. Only a NEW item may legitimately start at 0.
  const stateVersion = srs ? srs.stateVersion : explicitStateVersion ?? (sourceReason === 'NEW' ? 0 : null)
  return {
    id: `${snapshotId}-${snapshotItemId}`,
    snapshotId,
    snapshotItemId,
    sequenceNo,
    itemType: ref.itemType,
    itemId: ref.itemId,
    title: contractOptionalText(source.title ?? source.word ?? source.canonicalText ?? source.sentenceText, fail),
    sourceReason,
    contentVersion,
    contentVersionId: contractOptionalInteger(source.contentVersionId, fail, 1),
    phoneticUs: contractOptionalText(source.phoneticUs, fail),
    phoneticUk: contractOptionalText(source.phoneticUk, fail),
    phonetic: contractOptionalText(source.phoneticUs, fail) ?? contractOptionalText(source.phoneticUk, fail),
    audio: null,
    audioUrl: contractOptionalText(source.audioUrl ?? source.pronunciationUrl, fail),
    hint: contractOptionalText(source.frontHint ?? source.prompt, fail),
    meaningCn: null,
    definitionEn: null,
    definitions: [],
    examples: [],
    exampleItems: [],
    masteryStatus: srs ? srs.masteryStatus : null,
    dueLocalDate: srs ? srs.dueLocalDate : contractOptionalText(source.dueLocalDate, fail),
    stateVersion,
    revealed: false,
    reviewStatus: 'PENDING',
  }
}

function parseSrsBatch(value: unknown): B10SrsBatch {
  const fail = srsError
  const source = contractRecord(unwrap(value), fail)
  const snapshotId = contractInteger(source.snapshotId, fail, 1)
  if (!Array.isArray(source.items)) throw fail()
  return {
    snapshotId,
    localDate: contractText(source.localDate, fail),
    timezone: contractOptionalText(source.timezone, fail) ?? 'Asia/Shanghai',
    status: contractText(source.status, fail),
    algorithmVersion: contractOptionalText(source.algorithmVersion, fail),
    rulesVersion: contractOptionalText(source.rulesVersion, fail),
    contentVersion: contractOptionalText(source.contentVersion, fail),
    contentEpoch: contractOptionalInteger(source.contentEpoch, fail, 0) ?? 0,
    items: source.items.map((item) => parseSrsCard(item, snapshotId)),
    reasonCode: contractOptionalText(source.reasonCode, fail),
  }
}

function parseVocabDefinition(value: unknown): B10VocabDefinition {
  const fail = vocabError
  const source = contractRecord(value, fail)
  const definition: B10VocabDefinition = {
    definitionId: contractOptionalInteger(source.definitionId, fail, 1),
    partOfSpeech: contractOptionalText(source.partOfSpeech, fail),
    meaningCn: contractOptionalText(source.meaningCn, fail),
    definitionEn: contractOptionalText(source.definitionEn, fail),
  }
  if (!definition.meaningCn && !definition.definitionEn) throw fail()
  return definition
}

function parseVocabExample(value: unknown): B10VocabExample {
  const fail = vocabError
  const source = contractRecord(value, fail)
  const example: B10VocabExample = {
    exampleId: contractOptionalInteger(source.exampleId, fail, 1),
    // content-service V5 examples_json uses the explicit legacy {sentence, translation} keys.
    sentenceEn: contractOptionalText(source.sentenceEn, fail) ?? contractOptionalText(source.sentence, fail),
    sentenceCn: contractOptionalText(source.sentenceCn, fail) ?? contractOptionalText(source.translation, fail),
  }
  if (!example.sentenceEn && !example.sentenceCn) throw fail()
  return example
}

function parseVocabAudio(value: unknown): B10VocabAudio | null {
  if (value === undefined || value === null) return null
  const fail = vocabError
  const source = contractRecord(value, fail)
  const us = contractOptionalText(source.us, fail)
  const uk = contractOptionalText(source.uk, fail)
  return us || uk ? { us, uk } : null
}

function parseVocabularyId(value: unknown, fail: () => Error): number | string {
  if (typeof value !== 'string') return contractInteger(value, fail, 1)
  // content-service V5 stores vocabulary_id as a VARCHAR slug (b25-item-001).
  // A numeric string is still rejected: it is neither the int64 contract id nor a live slug.
  const id = contractText(value, fail)
  if (!/^[A-Za-z][A-Za-z0-9._:-]*$/.test(id)) throw fail()
  return id
}

function parseVocabularyDetail(value: unknown): B10VocabularyDetail {
  const fail = vocabError
  const source = contractRecord(unwrap(value), fail)
  const vocabId = parseVocabularyId(source.vocabId ?? source.vocabularyId ?? source.itemId, fail)
  const word = contractText(source.word, fail)
  const topDefinitions = source.definitions
  if (topDefinitions !== undefined && topDefinitions !== null && !Array.isArray(topDefinitions)) throw fail()
  const back = source.back === undefined || source.back === null ? null : contractRecord(source.back, fail)
  let definitions: B10VocabDefinition[]
  if (Array.isArray(topDefinitions) && topDefinitions.length) definitions = topDefinitions.map(parseVocabDefinition)
  else if (back) definitions = [parseVocabDefinition(back)]
  else if (Array.isArray(topDefinitions) || source.answerAvailable === false) definitions = []
  else throw fail()

  const topExamples = source.examples
  if (topExamples !== undefined && topExamples !== null && !Array.isArray(topExamples)) throw fail()
  const backExamples = back ? back.examples : undefined
  if (backExamples !== undefined && backExamples !== null && !Array.isArray(backExamples)) throw fail()
  const rawExamples = Array.isArray(topExamples) && topExamples.length ? topExamples : Array.isArray(backExamples) ? backExamples : []
  const exampleItems = rawExamples.map(parseVocabExample)

  const contentVersion = contractOptionalText(source.contentVersion, fail)
  const contentVersionId = contractOptionalInteger(source.contentVersionId, fail, 1)
  if (!contentVersion && contentVersionId === null) throw fail()

  const audio = parseVocabAudio(source.audio)
  const audioUrl = audio?.us ?? audio?.uk ?? contractOptionalText(source.audioRef, fail) ?? contractOptionalText(source.audioUrl, fail) ?? contractOptionalText(source.pronunciationUrl, fail)
  const phoneticUs = contractOptionalText(source.phoneticUs, fail)
  const phoneticUk = contractOptionalText(source.phoneticUk, fail)
  const srsState = source.srsState === undefined || source.srsState === null ? null : parseSrsState(source.srsState, fail)
  let meaningCn: string | null = null
  let definitionEn: string | null = null
  for (const definition of definitions) {
    meaningCn ??= definition.meaningCn
    definitionEn ??= definition.definitionEn
  }
  const examples = exampleItems.flatMap((example) => {
    const sentence = example.sentenceEn ?? example.sentenceCn
    return sentence ? [sentence] : []
  })
  return {
    vocabId,
    word,
    title: word,
    phoneticUs,
    phoneticUk,
    phonetic: phoneticUs ?? phoneticUk,
    audio,
    audioUrl,
    hint: contractOptionalText(source.frontHint ?? source.prompt, fail),
    meaningCn,
    definitionEn,
    definitions,
    examples,
    exampleItems,
    contentVersion,
    contentVersionId,
    srsState,
  }
}

function parseVocabularyFront(value: unknown): B10VocabularyFront {
  const fail = vocabError
  const source = contractRecord(unwrap(value), fail)
  const vocabId = parseVocabularyId(source.vocabId ?? source.vocabularyId ?? source.itemId, fail)
  const word = contractText(source.word, fail)
  const availabilityText = contractOptionalText(source.availability, fail)
  if (availabilityText && availabilityText !== 'PUBLISHED') throw fail()
  const contentVersion = contractOptionalText(source.contentVersion, fail)
  const contentVersionId = contractOptionalInteger(source.contentVersionId, fail, 1)
  if (!contentVersion && contentVersionId === null) throw fail()
  const audio = parseVocabAudio(source.audio)
  const audioUrl = audio?.us ?? audio?.uk ?? contractOptionalText(source.audioRef, fail) ?? contractOptionalText(source.audioUrl, fail) ?? contractOptionalText(source.pronunciationUrl, fail)
  const phoneticUs = contractOptionalText(source.phoneticUs, fail)
  const phoneticUk = contractOptionalText(source.phoneticUk, fail)
  return {
    vocabId,
    word,
    phoneticUs,
    phoneticUk,
    phonetic: phoneticUs ?? phoneticUk,
    audio,
    audioUrl,
    contentVersion,
    contentVersionId,
    availability: availabilityText === 'PUBLISHED' ? 'PUBLISHED' : null,
  }
}

function reviewItemMatches(item: unknown, card: B10SrsCard): boolean {
  if (!isRecord(item)) return false
  if (card.itemType === 'VOCAB') return item.itemType === 'VOCAB' && item.vocabId === card.itemId
  if (card.itemType === 'CHUNK') return item.itemType === 'CHUNK' && item.chunkId === card.itemId
  if (card.itemType === 'EXPRESSION') return item.itemType === 'EXPRESSION' && item.expressionId === card.itemId
  return false
}

function acceptCapturedReviewEvent(capturedEvent: Record<string, unknown>, card: B10SrsCard, quality: 0 | 1 | 2 | 3, clientEventId: string): RecordValue {
  const event = parseReviewEvent(capturedEvent)
  if (event.clientEventId !== clientEventId) throw srsError()
  if (event.rawQuality !== quality) throw srsError()
  if (event.baseStateVersion !== card.stateVersion) throw srsError()
  if (event.snapshotItemId !== card.snapshotItemId) throw srsError()
  if (event.snapshotId !== card.snapshotId) throw srsError()
  if (!reviewItemMatches(event.item, card)) throw srsError()
  return event
}

function parseReviewEvent(value: unknown): RecordValue {
  const fail = srsError
  const source = contractRecord(value, fail)
  for (const key of Object.keys(source)) {
    // itemId is the historical client-only mirror; it is removed, never forwarded.
    if (key !== 'itemId' && !(REVIEW_EVENT_KEYS as readonly string[]).includes(key)) throw fail()
  }
  const ref = parseSrsItemRef(source.item, fail)
  const rawQuality = contractInteger(source.rawQuality, fail, 0)
  if (rawQuality > 3) throw fail()
  const clientEventId = contractText(source.clientEventId, fail)
  if (clientEventId.length < 8 || clientEventId.length > 96) throw fail()
  const event: RecordValue = {
    item: srsItemRef(ref.itemType, ref.itemId),
    rawQuality,
    answerOutcome: contractEnum(source.answerOutcome, REVIEW_ANSWER_OUTCOMES, fail),
    clientEventId,
    clientOccurredAt: contractText(source.clientOccurredAt, fail),
    baseStateVersion: contractInteger(source.baseStateVersion, fail, 0),
    snapshotItemId: contractInteger(source.snapshotItemId, fail, 1),
  }
  const snapshotId = contractOptionalInteger(source.snapshotId, fail, 1)
  if (snapshotId !== null) event.snapshotId = snapshotId
  const responseTimeMs = contractOptionalInteger(source.responseTimeMs, fail, 0)
  if (responseTimeMs !== null) event.responseTimeMs = responseTimeMs
  const revealElapsedMs = contractOptionalInteger(source.revealElapsedMs, fail, 0)
  if (revealElapsedMs !== null) event.revealElapsedMs = revealElapsedMs
  const attemptNo = contractOptionalInteger(source.attemptNo, fail, 1)
  if (attemptNo !== null) event.attemptNo = attemptNo
  return event
}

function parseReviewResult(value: unknown): B10SrsReviewResult {
  const fail = srsError
  const source = contractRecord(unwrap(value), fail)
  const effectiveQuality = contractOptionalInteger(source.effectiveQuality, fail, 0)
  if (effectiveQuality !== null && effectiveQuality > 3) throw fail()
  if (source.reconciled !== undefined && typeof source.reconciled !== 'boolean') throw fail()
  return {
    reviewEventId: contractInteger(source.reviewEventId, fail, 0),
    eventStatus: contractEnum(source.eventStatus, REVIEW_EVENT_STATUSES, fail),
    riskDecision: contractEnum(source.riskDecision, REVIEW_RISK_DECISIONS, fail),
    effectiveQuality: effectiveQuality as 0 | 1 | 2 | 3 | null,
    reconciled: source.reconciled === true,
    stateVersion: contractInteger(source.stateVersion, fail, 0),
    srsState: source.srsState === undefined || source.srsState === null ? null : parseSrsState(source.srsState, fail),
    rewardSettlementStatus: contractOptionalEnum(source.rewardSettlementStatus, REVIEW_REWARD_STATUSES, fail),
    nextSnapshotItemId: contractOptionalInteger(source.nextSnapshotItemId, fail, 1),
  }
}

function parseSrsSync(value: unknown): { results: B10SrsSyncResult[] } {
  const fail = srsError
  const source = contractRecord(unwrap(value), fail)
  if (!Array.isArray(source.results)) throw fail()
  const results = source.results.map((entry): B10SrsSyncResult => {
    const result = contractRecord(entry, fail)
    const status = contractEnum(result.status, REVIEW_EVENT_STATUSES, fail)
    const nested = result.result === undefined || result.result === null ? null : parseReviewResult(result.result)
    return {
      clientEventId: contractOptionalText(result.clientEventId, fail),
      status,
      result: nested,
      errorCode: contractOptionalText(result.errorCode, fail),
    }
  })
  return { results }
}

function parseExercise(value: unknown, sessionId: string): B10Exercise | null {
  if (!isRecord(value)) return null
  const exerciseId = nullableNumber(value.exerciseId ?? value.itemId)
  const questionId = nullableNumber(value.questionId) ?? exerciseId
  if (!exerciseId || !questionId) return null
  const promptValue = isRecord(value.prompt) ? value.prompt : {}
  const interaction = isRecord(value.interaction) ? value.interaction : {}
  const rawType = text(value.questionType ?? value.type, 'CHOICE')
  const questionTypes = ['CHOICE', 'CONNECT_LINE', 'DRAG_SORTER', 'FILL_BLANK', 'SPELL_INPUT', 'LISTEN_CHOICE', 'ERROR_CORRECTION', 'TRANSLATION_INPUT']
  const questionType = questionTypes.includes(rawType) ? rawType as B10Exercise['questionType'] : 'CHOICE'
  const optionsValue = Array.isArray(interaction.options) ? interaction.options : Array.isArray(value.options) ? value.options : []
  const tokensValue = Array.isArray(interaction.tokens) ? interaction.tokens : Array.isArray(value.tokens) ? value.tokens : []
  return {
    sessionId,
    exerciseId,
    questionId,
    itemId: nullableNumber(value.itemId),
    questionType,
    position: number(value.position, 0),
    prompt: text(promptValue.text ?? promptValue.stemText ?? value.promptText ?? value.stemText ?? value.stem, '请完成本题。'),
    sourceText: text(promptValue.sourceText ?? value.sourceText) || null,
    options: optionsValue.flatMap((entry): Array<{ key: string; text: string }> => {
      if (!isRecord(entry)) return []
      const key = text(entry.optionCode ?? entry.key ?? entry.optionId)
      const label = text(entry.label ?? entry.text)
      return key && label ? [{ key, text: label }] : []
    }),
    tokens: tokensValue.flatMap((entry): Array<{ tokenId: string; text: string }> => {
      if (!isRecord(entry)) return []
      const tokenId = text(entry.tokenId ?? entry.id)
      const label = text(entry.text ?? entry.label)
      return tokenId && label ? [{ tokenId, text: label }] : []
    }),
    blankIds: Array.isArray(interaction.blankIds) ? interaction.blankIds.filter((entry): entry is string => typeof entry === 'string') : [],
    sourceBucket: ['NEW', 'REVIEW', 'MISTAKE', 'EXAM'].includes(text(value.sourceBucket)) ? text(value.sourceBucket) as B10Exercise['sourceBucket'] : null,
    verificationStage: ['D0', 'D1', 'D7'].includes(text(value.verificationStage)) ? text(value.verificationStage) as B10Exercise['verificationStage'] : null,
    feedbackPolicy: ['IMMEDIATE', 'AFTER_SUBMIT', 'PENDING_MANUAL'].includes(text(value.feedbackPolicy)) ? text(value.feedbackPolicy) as B10Exercise['feedbackPolicy'] : 'AFTER_SUBMIT',
    contentVersionId: nullableNumber(value.contentVersionId ?? (isRecord(value.pin) ? value.pin.contentVersionId : null)),
    ruleVersion: text(value.ruleVersion) || null,
  }
}

function parseAssessmentSession(value: unknown): B10AssessmentSession {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const sessionId = text(source.sessionId ?? source.id, 'unknown-session')
  const exercises = listFrom(source.items ?? source).flatMap((item) => {
    const exercise = parseExercise(item, sessionId)
    return exercise ? [exercise] : []
  })
  const answerSheet = Array.isArray(source.answerSheet) ? source.answerSheet.flatMap((item): Array<{ exerciseId: number; saved: boolean; revision: number }> => {
    if (!isRecord(item)) return []
    const exerciseId = nullableNumber(item.exerciseId)
    return exerciseId ? [{ exerciseId, saved: item.saved === true, revision: number(item.revision, 0) }] : []
  }) : []
  const pin = isRecord(source.pin) ? source.pin : {}
  return {
    sessionId,
    sessionType: text(source.sessionType ?? source.mode, 'DAILY_STREAM'),
    status: text(source.status, 'IN_PROGRESS'),
    serverNow: text(source.serverNow) || null,
    deadlineAt: text(source.deadlineAt) || null,
    remainingSec: nullableNumber(source.remainingSec),
    lastCheckpointSeq: number(source.lastCheckpointSeq, 0),
    exercises: exercises.sort((left, right) => left.position - right.position),
    answerSheet,
    contentEpoch: number(source.contentEpoch ?? pin.contentEpoch, 0),
    degraded: source.degraded === true,
    stateVersion: number(source.stateVersion, 1),
    lastAttemptId: text(source.lastAttemptId) || null,
    reportId: text(source.reportId) || null,
    resumeIndex: nullableNumber(source.resumeIndex),
    resumeCopy: text(source.resumeCopy) || null,
    contentOffline: source.contentOffline === true,
    exitCopy: text(source.exitCopy) || null,
  }
}

function parseAnswerResult(value: unknown, exerciseId: number): B10AnswerResult {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  return {
    requestId: text(source.requestId ?? source.attemptId) || null,
    exerciseId: number(source.exerciseId, exerciseId),
    accepted: source.accepted !== false && !['REJECTED', 'COMPENSATED'].includes(text(source.status)),
    revision: nullableNumber(source.revision ?? source.attemptVersion),
    scoringStatus: ['SCORED', 'PENDING_MANUAL', 'REJECTED', 'LATE', 'ACCEPTED'].includes(text(source.scoringStatus)) ? text(source.scoringStatus) as B10AnswerResult['scoringStatus'] : 'ACCEPTED',
    isCorrect: booleanOrNull(source.isCorrect) ?? (text(source.scoreBucket) === 'FULL' ? true : text(source.scoreBucket) === 'ZERO' ? false : null),
    savedReceipt: text(source.savedReceipt) || null,
    feedbackText: text(source.feedbackText) || null,
    nextQuestion: text(source.nextQuestion) || null,
    scoreBucket: text(source.scoreBucket) || null,
    score: typeof source.score === 'number' ? source.score : null,
    maxScore: typeof source.maxScore === 'number' ? source.maxScore : null,
    errorCauseCandidates: Array.isArray(source.errorCauseCandidates) ? source.errorCauseCandidates.filter((entry): entry is string => typeof entry === 'string') : [],
    masteryEffect: text(source.masteryEffect) || null,
    deduplicated: source.deduplicated === true,
    contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE',
    attemptId: text(source.attemptId) || null,
    reportId: text(source.reportId) || null,
  }
}

function parseRuleFeedback(value: unknown): B10RuleFeedback {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const rawCauses = Array.isArray(source.errorCauses) ? source.errorCauses : Array.isArray(source.errorCauseCandidates) ? source.errorCauseCandidates : []
  const evidence = Array.isArray(source.evidence) ? source.evidence.flatMap((item): Array<{ label: string; sourceText?: string; explanation: string }> => {
    if (!isRecord(item)) return []
    const label = text(item.label ?? item.code)
    const explanation = text(item.explanation ?? item.detail)
    return label && explanation ? [{ label, explanation, ...(text(item.sourceText) ? { sourceText: text(item.sourceText) } : {}) }] : []
  }) : []
  return {
    accepted: source.accepted !== false,
    score: typeof source.score === 'number' ? source.score : null,
    ruleVersion: text(source.ruleVersion) || null,
    feedbackCode: text(source.feedbackCode) || null,
    errorCauses: rawCauses.filter((entry): entry is string => typeof entry === 'string'),
    evidence,
    nextAction: text(source.nextAction) || null,
    aiScoringAvailable: false,
    deduplicated: source.deduplicated === true,
    contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE',
    savedReceipt: text(source.savedReceipt) || null,
    feedbackText: text(source.feedbackText) || null,
    nextQuestion: text(source.nextQuestion) || null,
    scoreBucket: text(source.scoreBucket) || null,
    correct: booleanOrNull(source.correct ?? source.isCorrect) ?? (text(source.scoreBucket) === 'FULL' ? true : text(source.scoreBucket) === 'ZERO' ? false : null),
  }
}

function parseGrammarPoint(value: unknown): B10GrammarPoint | null {
  return parseGrammarPointContent(value)
}

function parseSyntaxGraph(value: unknown): B10SyntaxGraph | null {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const sentenceId = nullableNumber(source.sentenceId)
  if (!sentenceId) return null
  const slices = Array.isArray(source.slices) ? source.slices.flatMap((item): Array<B10SyntaxGraph['slices'][number]> => {
    if (!isRecord(item)) return []
    const sliceId = text(item.sliceId ?? item.id)
    const sliceText = text(item.text)
    return sliceId && sliceText ? [{ sliceId, sliceCode: text(item.sliceCode, sliceId), role: text(item.role, '句法片段'), text: sliceText, startToken: number(item.startToken), endToken: number(item.endToken) }] : []
  }) : []
  const imitationSlots: Record<string, string> = {}
  if (isRecord(source.imitationSlots)) for (const [key, item] of Object.entries(source.imitationSlots)) if (typeof item === 'string') imitationSlots[key] = item
  return {
    sentenceId,
    text: text(source.text ?? source.sentenceText, '长难句内容暂不可用。'),
    translation: text(source.translation) || null,
    nodes: Array.isArray(source.nodes) ? source.nodes.flatMap((item): Array<{ nodeId: string; role: string; text: string }> => {
      if (!isRecord(item)) return []
      const nodeId = text(item.nodeId ?? item.id)
      const nodeText = text(item.text)
      return nodeId && nodeText ? [{ nodeId, role: text(item.role, '节点'), text: nodeText }] : []
    }) : [],
    edges: Array.isArray(source.edges) ? source.edges.flatMap((item): Array<{ fromNodeId: string; toNodeId: string; relation: string }> => {
      if (!isRecord(item)) return []
      const fromNodeId = text(item.fromNodeId)
      const toNodeId = text(item.toNodeId)
      return fromNodeId && toNodeId ? [{ fromNodeId, toNodeId, relation: text(item.relation, '依存') }] : []
    }) : [],
    slices,
    blockOrder: Array.isArray(source.blockOrder) ? source.blockOrder.filter((entry): entry is string => typeof entry === 'string') : slices.map((item) => item.sliceId),
    imitationSlots,
    contentVersionId: nullableNumber(source.contentVersionId),
    graphStatus: source.graphStatus === 'FAILED' ? 'FAILED' : source.graphStatus === 'DEGRADED' ? 'DEGRADED' : 'READY',
  }
}

function parseReadingArticle(value: unknown): B10ReadingArticle | null {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const articleId = nullableNumber(source.articleId)
  if (!articleId) return null
  const blocks = Array.isArray(source.blocks) ? source.blocks.flatMap((item, index): Array<B10ReadingArticle['blocks'][number]> => {
    if (!isRecord(item)) return []
    const textValue = text(item.text)
    return textValue ? [{ blockId: text(item.blockId, `block-${index + 1}`), blockIndex: number(item.blockIndex, index), text: textValue, translation: text(item.translation) || null }] : []
  }) : []
  return {
    articleId,
    title: text(source.title, '分级阅读'),
    cefrLevel: text(source.cefrLevel, 'B1'),
    wordCount: number(source.wordCount, 0),
    estimatedMinutes: number(source.estimatedMinutes, 5),
    blocks,
    rightsStatus: source.rightsStatus === 'REVOKED' ? 'REVOKED' : 'AUTHORIZED',
    contentVersionId: nullableNumber(source.contentVersionId),
    contentEpoch: number(source.contentEpoch, 0),
  }
}

function parseReadingQuestion(value: unknown): B10ReadingQuestion | null {
  if (!isRecord(value)) return null
  const questionId = nullableNumber(value.questionId)
  const articleId = nullableNumber(value.articleId)
  if (!questionId || !articleId) return null
  const rawType = text(value.questionType, 'DETAIL')
  const questionType = ['MAIN_IDEA', 'DETAIL', 'INFERENCE', 'VOCABULARY'].includes(rawType) ? rawType as B10ReadingQuestion['questionType'] : 'DETAIL'
  return {
    questionId,
    articleId,
    questionType,
    stemText: text(value.stemText, '请选择最符合文章信息的答案。'),
    options: Array.isArray(value.options) ? value.options.flatMap((item): Array<{ optionCode: string; label: string }> => {
      if (!isRecord(item)) return []
      const optionCode = text(item.optionCode ?? item.key)
      const label = text(item.label ?? item.text)
      return optionCode && label ? [{ optionCode, label }] : []
    }) : [],
    contentVersionId: nullableNumber(value.contentVersionId),
  }
}

function parseWritingPrompt(value: unknown): B10WritingPrompt | null {
  if (!isRecord(value)) return null
  const promptId = nullableNumber(value.promptId)
  if (!promptId) return null
  const promptType = ['TRANSLATION', 'CORRECTION', 'ESSAY', 'LETTER'].includes(text(value.promptType)) ? text(value.promptType) as B10WritingPrompt['promptType'] : 'TRANSLATION'
  return {
    promptId,
    promptType,
    title: text(value.title, '规则写作练习'),
    taskText: text(value.taskText, '请根据题目完成练习。'),
    sourceText: text(value.sourceText ?? value.taskText) || null,
    targetStructure: Array.isArray(value.targetStructure) ? value.targetStructure.filter((entry): entry is string => typeof entry === 'string') : [],
    contentVersionId: nullableNumber(value.contentVersionId),
    ruleVersion: text(value.ruleVersion) || null,
  }
}

const MISTAKE_STATUSES = ['PENDING_RETRY', 'DELAY_VERIFY_D1', 'DELAY_VERIFY_D7', 'MASTERED', 'REOPENED'] as const
const MASTERY_STATUSES = ['NEW', 'LEARNING', 'MASTERED', 'CONSOLIDATED'] as const

function protocolError(): Error {
  return new Error('错题服务返回的数据不符合接口契约，已停止显示。')
}

function requiredInteger(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw protocolError()
  return value
}

function optionalInteger(value: unknown): number | null {
  if (value === undefined) return null
  return requiredInteger(value)
}

function requiredExactString(value: unknown): string {
  if (typeof value !== 'string') throw protocolError()
  return value
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string') throw protocolError()
  return value.trim()
}

function mistakeRows(value: unknown): unknown[] {
  const source = unwrap(value)
  if (Array.isArray(source)) return source
  if (!isRecord(source)) throw protocolError()
  if (Array.isArray(source.items)) return source.items
  if (Array.isArray(source.mistakes)) return source.mistakes
  throw protocolError()
}

function parseMistake(value: unknown): B10Mistake {
  if (!isRecord(value)) throw protocolError()
  const mistakeId = requiredInteger(value.mistakeId)
  const itemId = requiredInteger(value.itemId)
  const rawStatus = requiredExactString(value.mistakeStatus)
  const rawMastery = requiredExactString(value.masteryStatus)
  if (!(MISTAKE_STATUSES as readonly string[]).includes(rawStatus)) throw protocolError()
  if (!(MASTERY_STATUSES as readonly string[]).includes(rawMastery)) throw protocolError()
  if (value.reasonTrace !== undefined && !Array.isArray(value.reasonTrace)) throw protocolError()
  return {
    mistakeId,
    itemId,
    questionId: optionalInteger(value.questionId),
    mistakeStatus: rawStatus as B10Mistake['mistakeStatus'],
    masteryStatus: rawMastery as B10Mistake['masteryStatus'],
    errorCategory: requiredString(value.errorCategory),
    reasonTrace: Array.isArray(value.reasonTrace) ? value.reasonTrace.flatMap((item): Array<{ code: string; label: string; evidence?: string }> => {
      if (!isRecord(item)) return []
      const code = text(item.code)
      const label = text(item.label ?? item.explanation)
      return code && label ? [{ code, label, ...(text(item.evidence) ? { evidence: text(item.evidence) } : {}) }] : []
    }) : [],
    prompt: text(value.prompt) || null,
    questionType: ['CHOICE', 'CONNECT_LINE', 'DRAG_SORTER', 'FILL_BLANK', 'SPELL_INPUT', 'LISTEN_CHOICE', 'ERROR_CORRECTION', 'TRANSLATION_INPUT'].includes(text(value.questionType)) ? text(value.questionType) as B10Mistake['questionType'] : null,
    contentVersionId: nullableNumber(value.contentVersionId),
    verificationId: nullableNumber(value.verificationId),
    remediationId: nullableNumber(value.remediationId),
    closureCopy: text(value.closureCopy) || null,
    variantStatus: text(value.variantStatus) || null,
  }
}

function parseVerification(value: unknown): B10Verification | null {
  if (!isRecord(value)) return null
  const verificationId = nullableNumber(value.verificationId)
  const mistakeId = nullableNumber(value.mistakeId)
  if (!verificationId || !mistakeId) return null
  const stage = ['D0', 'D1', 'D7'].includes(text(value.stage)) ? text(value.stage) as B10Verification['stage'] : 'D0'
  const result = ['PENDING', 'PASSED', 'FAILED', 'NOT_DUE', 'EXPIRED'].includes(text(value.result)) ? text(value.result) as B10Verification['result'] : 'PENDING'
  return { verificationId, mistakeId, stage, result, dueAt: text(value.dueAt, new Date().toISOString()), score: typeof value.score === 'number' ? value.score : null, maxScore: typeof value.maxScore === 'number' ? value.maxScore : null, nextState: text(value.nextState) || null, remediationId: nullableNumber(value.remediationId) ?? verificationId }
}

function parseReport(value: unknown, fallbackType: B10Report['reportType']): B10Report {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  const reportType = ['EXAM_DIAGNOSTIC', 'DAILY', 'WEEKLY'].includes(text(source.reportType)) ? text(source.reportType) as B10Report['reportType'] : fallbackType
  const scoreBucket = text(source.scoreBucket)
  const canonicalMetrics = scoreBucket ? [{ code: 'scoreBucket', label: '评测结果', value: scoreBucket === 'FULL' ? 1 : scoreBucket === 'PARTIAL' ? 0.5 : 0, max: 1 }] : []
  const canonicalEvidence = Array.isArray(source.mistakeCodes) ? source.mistakeCodes.filter((entry): entry is string => typeof entry === 'string').map((entry) => ({ label: entry, detail: '服务端记录为待复习项。' })) : []
  return {
    reportId: text(source.reportId) || number(source.reportId, 0),
    reportType,
    status: ['GENERATING', 'READY', 'PARTIAL', 'FAILED'].includes(text(source.status)) ? text(source.status) as B10Report['status'] : 'PARTIAL',
    score: typeof source.score === 'number' ? source.score : null,
    reportedMaxScore: typeof source.reportedMaxScore === 'number' ? source.reportedMaxScore : null,
    percentile: typeof source.percentile === 'number' ? source.percentile : null,
    calculationVersion: text(source.calculationVersion, 'server-rule'),
    metrics: Array.isArray(source.metrics) ? source.metrics.flatMap((item): Array<{ code: string; label: string; value: number; max?: number }> => {
      if (!isRecord(item)) return []
      const code = text(item.code)
      return code ? [{ code, label: text(item.label, code), value: number(item.value), ...(typeof item.max === 'number' ? { max: item.max } : {}) }] : []
    }) : Object.keys(isRecord(source.metrics) ? source.metrics : {}).length ? Object.entries(isRecord(source.metrics) ? source.metrics : {}).map(([code, value]) => ({ code, label: code, value: number(value) })) : canonicalMetrics,
    evidence: Array.isArray(source.evidence) ? source.evidence.flatMap((item): Array<{ exerciseId?: number; mistakeId?: number; label: string; detail: string }> => {
      if (!isRecord(item)) return []
      const label = text(item.label ?? item.code)
      const detail = text(item.detail ?? item.explanation)
      return label && detail ? [{ label, detail, ...(nullableNumber(item.exerciseId) ? { exerciseId: nullableNumber(item.exerciseId) as number } : {}), ...(nullableNumber(item.mistakeId) ? { mistakeId: nullableNumber(item.mistakeId) as number } : {}) }] : []
    }) : canonicalEvidence,
    explanation: Array.isArray(source.explanation) ? source.explanation.filter((entry): entry is string => typeof entry === 'string') : Object.values(isRecord(source.explanation) ? source.explanation : {}).filter((entry): entry is string => typeof entry === 'string').concat(scoreBucket ? [`服务端报告：${scoreBucket}`] : []),
    period: parsePeriod(source.period),
  }
}

function parsePeriod(value: unknown): B10Report['period'] {
  if (!isRecord(value)) return null
  const availability = text(value.availability)
  if (!availability) return null
  return {
    availability,
    copy: text(value.copy),
    periodStart: text(value.periodStart),
    periodEndExclusive: text(value.periodEndExclusive),
    learningDayZone: text(value.learningDayZone, 'Asia/Shanghai'),
    updatedAt: text(value.updatedAt),
    newItems: typeof value.newItems === 'number' ? value.newItems : null,
    reviewItems: typeof value.reviewItems === 'number' ? value.reviewItems : null,
    accuracy: typeof value.accuracy === 'number' ? value.accuracy : null,
    activeMillis: typeof value.activeMillis === 'number' ? value.activeMillis : null,
    durationStatus: text(value.durationStatus, 'NOT_RECORDED'),
    durationCopy: text(value.durationCopy),
    suggestion: text(value.suggestion),
    suggestionBasis: text(value.suggestionBasis),
    reportVersion: typeof value.reportVersion === 'number' ? value.reportVersion : null,
    officialScore: value.officialScore === true,
  }
}

function parseContentVersion(value: unknown): B10ContentVersionContext {
  const source = isRecord(unwrap(value)) ? unwrap(value) as RecordValue : {}
  return { contentVersionId: nullableNumber(source.contentVersionId), contentEpoch: number(source.contentEpoch, 0), projectionVersion: number(source.projectionVersion, 1), contentLocale: text(source.contentLocale, 'en-US') }
}

export function createB10ClientEventId(prefix: string): string {
  return createClientId(`b10-${prefix}`)
}

export function classifyB10Error(error: unknown, fallback = '服务暂时不可用，请稍后重试。'): B10ErrorInfo {
  return mapError(error, fallback)
}

export const b10LearningApi = {
  async createSrsBatch(context: B10RequestContext, clientEventId: string): Promise<B10SrsBatch> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.learning.srsBatch, { contentLocale: context.contentLocale }), {
      method: 'POST',
      data: { localDate: new Date().toISOString().slice(0, 10), timezone: 'Asia/Shanghai', dailyNewTarget: 20, maxDailyReview: 50, scheduleType: 'DAILY' },
      header: headers(context, clientEventId),
    })
    return parseSrsBatch(response)
  },

  async getSrsBatch(context: B10RequestContext, snapshotId: number): Promise<B10SrsBatch> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.learning.srsBatch}/${encodeURIComponent(String(snapshotId))}`, { contentLocale: context.contentLocale }))
    return parseSrsBatch(response)
  },

  async getVocabularyDetail(context: B10RequestContext, itemId: number | string, contentVersion?: string | null): Promise<B10VocabularyDetail> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.content.vocabularyDetail}/${encodeURIComponent(String(itemId))}`, { contentLocale: context.contentLocale, contentVersion: contentVersion ?? undefined }))
    return parseVocabularyDetail(response)
  },

  async getVocabularyFront(context: B10RequestContext, itemId: number | string, contentVersion?: string | null): Promise<B10VocabularyFront> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.content.vocabularyDetail}/${encodeURIComponent(String(itemId))}`, { contentLocale: context.contentLocale, projection: 'front', contentVersion: contentVersion ?? undefined }))
    return parseVocabularyFront(response)
  },

  async submitSrsReview(context: B10RequestContext, card: B10SrsCard, quality: 0 | 1 | 2 | 3, clientEventId: string, capturedEvent?: Record<string, unknown>): Promise<B10SrsReviewResult> {
    if (!card.snapshotId || card.stateVersion === null) throw srsError()
    const event = capturedEvent === undefined
      ? parseReviewEvent({
        snapshotId: card.snapshotId,
        snapshotItemId: card.snapshotItemId,
        item: srsItemRef(card.itemType, card.itemId),
        rawQuality: quality,
        answerOutcome: 'REVEALED_WITHOUT_ANSWER',
        responseTimeMs: 0,
        revealElapsedMs: 0,
        clientEventId,
        clientOccurredAt: new Date().toISOString(),
        baseStateVersion: card.stateVersion,
      })
      : acceptCapturedReviewEvent(capturedEvent, card, quality, clientEventId)
    const response = await mobileApiClient.request<unknown>(B10_GATEWAY_PATHS.learning.srsReview, {
      method: 'POST',
      data: event,
      header: { ...headers(context, clientEventId), 'X-Content-Version': card.contentVersion ?? '' },
    })
    return parseReviewResult(response)
  },

  async syncSrsReviews(context: B10RequestContext, events: readonly Record<string, unknown>[], clientEventId: string): Promise<{ results: B10SrsSyncResult[] }> {
    const normalized = events.map((event) => parseReviewEvent(event))
    const response = await mobileApiClient.request<unknown>(B10_GATEWAY_PATHS.learning.srsSync, { method: 'POST', data: { events: normalized }, header: headers(context, clientEventId) })
    return parseSrsSync(response)
  },

  async createAssessmentSession(context: B10RequestContext, input: { sessionType: 'DAILY_STREAM' | 'QUICK_PRACTICE' | 'CHECKPOINT'; targetCount?: number }, clientEventId: string): Promise<B10AssessmentSession> {
    const mode = input.sessionType === 'QUICK_PRACTICE' ? 'REVIEW' : input.sessionType === 'CHECKPOINT' ? 'MOCK' : 'PRACTICE'
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.sessions, { contentLocale: context.contentLocale }), { method: 'POST', data: { contentVersionId: 25001, mode, clientSessionRef: clientEventId }, header: headers(context, clientEventId) })
    return parseAssessmentSession(response)
  },

  async readAssessmentSession(context: B10RequestContext, sessionId: string): Promise<B10AssessmentSession> {
    const response = await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}`, { contentLocale: context.contentLocale }))
    return parseAssessmentSession(response)
  },

  async submitAssessmentAnswer(context: B10RequestContext, sessionId: string, exerciseId: number, answer: B10AnswerInput, revision: number, checkpointSeq: number, clientEventId: string, expectedStateVersion = 1): Promise<B10AnswerResult> {
    const submissionId = `sub_${clientEventId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 112)}`
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts`, { method: 'POST', data: { expectedStateVersion, submissionId, items: [{ itemId: exerciseId, sequence: 0, response: answer, clientSubmissionId: clientEventId }], clientEventId }, header: headers(context, clientEventId) })
    return parseAnswerResult(response, exerciseId)
  },

  async saveAssessmentCheckpoint(context: B10RequestContext, sessionId: string, attemptId: string, checkpointSeq: number, currentExerciseId: number | null, clientStateHash: string, clientEventId: string): Promise<unknown> {
    return mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(sessionId)}/attempts/${encodeURIComponent(attemptId)}/checkpoint`, { method: 'PUT', data: { checkpointVersion: Math.max(1, checkpointSeq), itemCursor: Math.max(0, currentExerciseId ?? 0), completedItemIds: [], checkpointDigest: clientStateHash }, header: headers(context, clientEventId) })
  },

  async completeAssessmentSession(context: B10RequestContext, sessionId: string, clientEventId: string): Promise<B10Report> {
    const session = await this.readAssessmentSession(context, sessionId)
    if (!session.reportId) throw new Error('当前练习尚未生成服务端报告，请先提交至少一道题。')
    const response = await mobileApiClient.request<unknown>(`/assessment/reports/${encodeURIComponent(session.reportId)}`, { header: headers(context, clientEventId) })
    return parseReport(response, 'DAILY')
  },

  async listMistakes(context: B10RequestContext): Promise<B10Mistake[]> {
    return (await this.listMistakeBook(context)).items
  },

  async getMistakeDetail(context: B10RequestContext, mistakeId: number): Promise<B10Mistake> {
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.masteryMistakes}/${encodeURIComponent(String(mistakeId))}`, { header: headers(context) })
    return parseMistake(unwrap(response))
  },

  async listMistakeBook(context: B10RequestContext): Promise<{ items: B10Mistake[]; attemptCount: number; mistakeCount: number; emptyStatus: string; emptyCopy: string; projectionVersion: string }> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.masteryMistakes, { contentLocale: context.contentLocale }))
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    const items = mistakeRows(response).map((item) => parseMistake(item))
    return {
      items,
      attemptCount: number(source.attemptCount, 0),
      mistakeCount: number(source.mistakeCount, items.length),
      emptyStatus: text(source.emptyStatus),
      emptyCopy: text(source.emptyCopy),
      projectionVersion: text(source.projectionVersion, 'IT4-MISTAKE-1'),
    }
  },

  async startMistakeRetry(context: B10RequestContext, mistakeId: number, clientEventId: string): Promise<B10Verification> {
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.masteryMistakes}/${encodeURIComponent(String(mistakeId))}/retry`, { method: 'POST', header: headers(context, clientEventId) })
    const verification = parseVerification(response)
    if (!verification) throw new Error('错题服务没有返回可恢复的订正会话。')
    return verification
  },

  async listVerifications(context: B10RequestContext): Promise<B10Verification[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.masteryVerifications, { contentLocale: context.contentLocale }))
    return listFrom(response).flatMap((item) => { const verification = parseVerification(item); return verification ? [verification] : [] })
  },

  async submitVerification(context: B10RequestContext, verificationId: number, answer: B10AnswerInput, clientEventId: string): Promise<B10Verification> {
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.masteryVerifications}/${encodeURIComponent(String(verificationId))}/submit`, { method: 'POST', data: { ...answer, clientSubmissionId: clientEventId, revision: 1 }, header: headers(context, clientEventId) })
    const verification = parseVerification(response)
    if (!verification) throw new Error('验证服务没有返回状态。')
    return verification
  },

  async issueReportShare(period: 'daily' | 'weekly'): Promise<{ ref: string; publicPath: string }> {
    const type = period === 'weekly' ? 'WEEKLY' : 'DAILY'
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.reportShare}/${type}/shares`, { method: 'POST', data: {} })
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    const ref = typeof source.ref === 'string' ? source.ref : ''
    if (!/^[0-9a-f]{32}$/.test(ref)) throw new Error('分享链接没有生成。')
    return { ref, publicPath: typeof source.publicPath === 'string' ? source.publicPath : `/api/v1/public/learning/report-shares/${ref}` }
  },

  async revokeReportShare(ref: string): Promise<void> {
    await mobileApiClient.request(`${B10_GATEWAY_PATHS.assessment.reportShareRevoke}/${encodeURIComponent(ref)}/revoke`, { method: 'POST', data: {} })
  },

  async readReport(context: B10RequestContext, period: 'daily' | 'weekly'): Promise<B10Report> {
    const path = period === 'daily' ? B10_GATEWAY_PATHS.assessment.dailyReport : B10_GATEWAY_PATHS.assessment.weeklyReport
    return parseReport(await mobileApiClient.request<unknown>(query(path, { contentLocale: context.contentLocale })), period === 'daily' ? 'DAILY' : 'WEEKLY')
  },

  async listGrammarPoints(context: B10RequestContext): Promise<B10GrammarPoint[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.grammarPoints, { pageSize: 50 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const point = parseGrammarPoint(item); return point ? [point] : [] })
  },

  async getSentenceGraph(context: B10RequestContext, sentenceId: number): Promise<B10SyntaxGraph> {
    const graph = parseSyntaxGraph(await unavailableOperation<unknown>())
    if (!graph) throw new Error('句法服务没有返回可解析的结构图。')
    return graph
  },

  async createGrammarSession(context: B10RequestContext, grammarPointId: number, contentVersionId: number | null, clientEventId: string): Promise<B10AssessmentSession> {
    const rawExercises = await listB3GrammarExercises()
    const exercises = grammarPreviewItems(rawExercises, grammarPointId)
    return parseAssessmentSession({
      sessionId: `local-grammar_${grammarPointId}_${clientEventId}`,
      sessionType: 'GRAMMAR_LOCAL_PREVIEW',
      status: 'IN_PROGRESS',
      contentEpoch: 1,
      stateVersion: 1,
      items: exercises,
    })
  },

  async submitGrammarAnswer(context: B10RequestContext, sessionId: string, exerciseId: number, answer: B10AnswerInput, contentVersionId: number | null, clientEventId: string): Promise<B10RuleFeedback> {
    const rawExercises = await listB3GrammarExercises()
    const raw = rawExercises.find((item) => isRecord(item) && number(item.exerciseId, 0) === exerciseId)
    const ref = raw && isRecord(raw.practiceRef) ? raw.practiceRef : null
    const contentCode = ref ? text(ref.contentCode) : ''
    const version = ref ? nullableNumber(ref.contentVersionId) : contentVersionId
    const questionItemId = ref ? grammarQuestionItemId(ref.questionItemId) : null
    if (!contentCode || version == null || questionItemId == null) {
      throw new MobileApiError('该练习没有可提交的服务端题目编号。', 422, { code: 'GRAMMAR_PRACTICE_REF_MISSING' })
    }
    const sessionKey = `h5-grammar-${questionItemId}`
    const opened = parseAssessmentSession(await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.assessment.sessions, { contentLocale: context.contentLocale }), {
      method: 'POST',
      data: { contentCode, contentVersionId: version, mode: 'PRACTICE', itemIds: [questionItemId], clientSessionRef: sessionKey },
      header: headers(context, sessionKey),
    }))
    if (!opened.sessionId || opened.sessionId === 'unknown-session') throw new MobileApiError('练习服务没有返回可继续的会话。', 422, { code: 'GRAMMAR_ASSESSMENT_SESSION_MISSING' })
    const submissionId = `sub_${clientEventId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 112)}`
    const response = await mobileApiClient.request<unknown>(`${B10_GATEWAY_PATHS.assessment.sessions}/${encodeURIComponent(opened.sessionId)}/attempts`, {
      method: 'POST',
      data: {
        expectedStateVersion: opened.stateVersion,
        submissionId,
        items: [{ itemId: questionItemId, sequence: 0, response: answer, clientSubmissionId: clientEventId }],
        clientEventId,
      },
      header: headers(context, clientEventId),
    })
    void sessionId
    const feedback = parseRuleFeedback(response)
    if (!feedback.savedReceipt) throw new MobileApiError('练习服务没有返回可核对的判分回执。', 422, { code: 'GRAMMAR_ASSESSMENT_RECEIPT_MISSING' })
    return feedback
  },

  async listReadingArticles(context: B10RequestContext): Promise<B10ReadingArticle[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.readingArticles, { contentLocale: context.contentLocale, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const article = parseReadingArticle(item); return article ? [article] : [] })
  },

  async getReadingArticle(context: B10RequestContext, articleId: number): Promise<B10ReadingArticle> {
    const article = parseReadingArticle(await mobileApiClient.request<unknown>(query(`${B10_GATEWAY_PATHS.content.readingArticles}/${encodeURIComponent(String(articleId))}`, { contentLocale: context.contentLocale }), { header: headers(context) }))
    if (!article) throw new Error('阅读服务没有返回可用文章。')
    return article
  },

  async saveReadingProgress(context: B10RequestContext, article: B10ReadingArticle, blockId: string, progressPercent: number, positionVersion: number, clientEventId: string): Promise<void> {
    await mobileApiClient.request(B10_GATEWAY_PATHS.learning.readingProgress, { method: 'PUT', data: { articleId: article.articleId, blockId, progressPercent, positionVersion, contentVersionId: article.contentVersionId, clientEventId }, header: headers(context, clientEventId) })
  },

  async listReadingQuestions(context: B10RequestContext, articleId: number): Promise<B10ReadingQuestion[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.readingQuestions, { contentLocale: context.contentLocale, articleId, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const question = parseReadingQuestion(item); return question ? [question] : [] })
  },

  async submitReadingAttempt(context: B10RequestContext, question: B10ReadingQuestion, answer: B10AnswerInput, clientEventId: string): Promise<B10ReadingAttempt> {
    const response = await unavailableOperation<unknown>()
    const source = isRecord(unwrap(response)) ? unwrap(response) as RecordValue : {}
    return { attemptId: nullableNumber(source.attemptId), questionId: question.questionId, correct: booleanOrNull(source.correct ?? source.isCorrect), score: typeof source.score === 'number' ? source.score : null, feedbackCode: text(source.feedbackCode) || null, reviewSignal: text(source.reviewSignal) || null, ruleVersion: text(source.ruleVersion) || null, contentVersionStale: source.contentVersionStale === true || source.status === 'CONTENT_VERSION_STALE' }
  },

  async mineReadingExpression(context: B10RequestContext, article: B10ReadingArticle, blockId: string, selectedText: string, clientEventId: string): Promise<unknown> {
    return mobileApiClient.request(B10_GATEWAY_PATHS.assessment.readingMining, { method: 'POST', data: { articleId: article.articleId, blockId, selectedText, contentVersionId: article.contentVersionId, clientEventId }, header: headers(context, clientEventId) })
  },

  async listWritingPrompts(context: B10RequestContext, promptType?: B10WritingPrompt['promptType']): Promise<B10WritingPrompt[]> {
    const response = await mobileApiClient.request<unknown>(query(B10_GATEWAY_PATHS.content.writingPrompts, { contentLocale: context.contentLocale, promptType, limit: 20 }), { header: headers(context) })
    return listFrom(response).flatMap((item) => { const prompt = parseWritingPrompt(item); return prompt ? [prompt] : [] })
  },

  async submitWriting(context: B10RequestContext, prompt: B10WritingPrompt, answer: string, mode: 'TRANSLATION' | 'CORRECTION' | 'WRITING', clientEventId: string): Promise<B10RuleFeedback> {
    const response = await unavailableOperation<unknown>()
    return parseRuleFeedback(response)
  },

  async submitCorrection(context: B10RequestContext, prompt: B10WritingPrompt, answer: string, clientEventId: string): Promise<B10RuleFeedback> {
    const response = await unavailableOperation<unknown>()
    return parseRuleFeedback(response)
  },

  parseContentVersion,
}

export function b10ErrorInfo(error: unknown, fallback?: string): B10ErrorInfo {
  return mapError(error, fallback ?? '学习服务暂时不可用，请稍后重试。')
}
