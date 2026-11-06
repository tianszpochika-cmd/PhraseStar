/** Pure reading-page decisions. Server save, submit and mining stay closed. */

export type ReadingRouteId = 'b3-reading' | 'b11-reading'

export type ReadingViewState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'empty'
  | 'offline'
  | 'auth-401'
  | 'auth-403'
  | 'stale'
  | 'revoked'
  | 'unpublished'
  | 'unauthorized-content'
  | 'error'

export type ReadingShell = 'idle' | 'loading' | 'ready' | 'empty' | 'restricted' | 'withdrawn' | 'error'

export interface ReadingBlockInput {
  blockId: string
  blockIndex: number
  text: string
  translation: string | null
}

export interface ReadingArticleInput {
  articleId: number
  title: string
  cefrLevel: string
  wordCount: number
  estimatedMinutes: number
  blocks: ReadingBlockInput[]
  rightsStatus: string
  availability?: string | null
  contentVersionId: number | null
  contentEpoch: number
  practiceRef?: unknown
}

export interface ReadingPracticePin {
  contentCode: string
  contentVersionId: number
  questionItemId: number
}

export interface ReadPermit {
  visible: boolean
  epoch: number
  requestEpoch: number
  requestId: number
  activeRequestId: number
  subject: string
  liveSubject: string
  revision: number
  liveRevision: number
  adultPassed: boolean
  consentAllowsLearning: boolean
  learningReady: boolean
}

export interface LocalWordSelection {
  generation: number
  blockId: string
  word: string
  persisted: false
}

export interface ReadingScope {
  routeId: ReadingRouteId
  subject: string
  articleId: number
  contentVersionId: number | null
  contentEpoch: number
}

export const READING_FONT_MIN_PERCENT = 100
export const READING_FONT_MAX_PERCENT = 200
export const READING_FONT_STEP_PERCENT = 10
export const READING_BODY_BASE_PX = 17
export const READING_BODY_MAX_PX = 34
export const READING_TRANSLATION_BASE_PX = 15
export const READING_TRANSLATION_MAX_PX = 24

/** Live client methods still exist for two of these. This card does not call them. */
export const READING_SERVER_WRITES = {
  saveReadingProgress: 'closed',
  submitReadingAttempt: 'closed',
  mineReadingExpression: 'closed',
} as const

export function readingStorageKey(routeId: ReadingRouteId): string {
  return `yx.mobile.reading.local.v1.${routeId}`
}

export function readingShell(state: ReadingViewState): ReadingShell {
  if (state === 'idle') return 'idle'
  if (state === 'loading') return 'loading'
  if (state === 'ready') return 'ready'
  if (state === 'empty') return 'empty'
  if (state === 'revoked') return 'withdrawn'
  if (state === 'error') return 'error'
  return 'restricted'
}

export function classifyReadingStatus(status: number): ReadingViewState {
  if (status === 401) return 'auth-401'
  if (status === 403) return 'auth-403'
  if (status === 404 || status === 409 || status === 410) return 'stale'
  if (status === 0) return 'offline'
  return 'error'
}

export function readingMessageKey(state: ReadingViewState): string {
  if (state === 'auth-401') return 'auth401'
  if (state === 'auth-403') return 'auth403'
  if (state === 'offline') return 'offline'
  if (state === 'stale') return 'stale'
  if (state === 'unpublished') return 'unpublished'
  if (state === 'unauthorized-content') return 'unauthorized'
  if (state === 'revoked') return 'revoked'
  if (state === 'empty') return 'empty'
  if (state === 'error') return 'error'
  if (state === 'loading' || state === 'idle') return 'loading'
  return 'ready'
}

export function articleViewState(article: ReadingArticleInput | null): 'ready' | 'empty' | 'revoked' | 'unpublished' | 'unauthorized-content' {
  if (!article) return 'empty'
  const availability = typeof article.availability === 'string' ? article.availability : ''
  if (article.rightsStatus === 'REVOKED' || availability === 'RIGHTS_EXPIRED' || availability === 'RIGHTS_PENDING') return 'revoked'
  if (availability === 'UNPUBLISHED' || availability === 'NOT_READY') return 'unpublished'
  if (article.rightsStatus !== 'AUTHORIZED') return 'unauthorized-content'
  return article.blocks.some((block) => block.text.trim().length > 0) ? 'ready' : 'empty'
}

export function visibleBlocks(article: ReadingArticleInput | null, state: ReadingViewState): ReadingBlockInput[] {
  if (state !== 'ready' || !article || article.rightsStatus !== 'AUTHORIZED') return []
  return article.blocks.filter((block) => block.text.trim().length > 0)
}

export function readStillCurrent(permit: ReadPermit): boolean {
  return permit.visible
    && permit.epoch === permit.requestEpoch
    && permit.requestId === permit.activeRequestId
    && permit.subject !== ''
    && permit.subject === permit.liveSubject
    && permit.revision === permit.liveRevision
    && permit.adultPassed
    && permit.consentAllowsLearning
    && permit.learningReady
}

/** A denial has no article body, so it can render after the shared 401 clear. */
export function denialCanRender(permit: ReadPermit): boolean {
  return permit.visible && permit.epoch === permit.requestEpoch && permit.requestId === permit.activeRequestId
}

export function chooseListedArticleId(articles: Array<{ articleId: number; rightsStatus?: string }>): number | null {
  if (!articles.length) return null
  const authorized = articles.find((item) => item.rightsStatus !== 'REVOKED')
  return (authorized ?? articles[0]).articleId
}

export function readableQuestionCount(value: unknown): number {
  if (!Array.isArray(value)) return 0
  return value.filter((item) => {
    if (!item || typeof item !== 'object') return false
    const id = (item as { questionId?: unknown }).questionId
    return typeof id === 'number' && Number.isSafeInteger(id) && id > 0
  }).length
}

export function clampReadingFont(percent: number): number {
  if (!Number.isFinite(percent)) return READING_FONT_MIN_PERCENT
  const stepped = Math.round(percent / READING_FONT_STEP_PERCENT) * READING_FONT_STEP_PERCENT
  return Math.min(READING_FONT_MAX_PERCENT, Math.max(READING_FONT_MIN_PERCENT, stepped))
}

export function stepReadingFont(percent: number, direction: -1 | 1): number {
  return clampReadingFont(clampReadingFont(percent) + direction * READING_FONT_STEP_PERCENT)
}

export function readingFontPx(percent: number, basePx: number, maxPx: number): number {
  const size = basePx * (clampReadingFont(percent) / 100)
  return Math.round(Math.min(maxPx, size) * 100) / 100
}

export function clampBlockIndex(index: number, count: number): number {
  if (count <= 0 || !Number.isFinite(index)) return 0
  return Math.min(count - 1, Math.max(0, Math.trunc(index)))
}

export function localReadPercent(index: number, count: number): number {
  if (count <= 0) return 0
  return Math.round(((clampBlockIndex(index, count) + 1) / count) * 100)
}

export function paragraphPieces(text: string): Array<{ kind: 'word' | 'space'; value: string }> {
  return text.split(/(\s+)/).filter((part) => part.length > 0).map((value) => ({
    kind: /^\s+$/.test(value) ? 'space' as const : 'word' as const,
    value,
  }))
}

export function nextWordSelection(previousGeneration: number, blockId: string, word: string): LocalWordSelection | null {
  const clean = word.trim()
  if (!clean || !blockId.trim()) return null
  const generation = Number.isSafeInteger(previousGeneration) && previousGeneration >= 0 ? previousGeneration + 1 : 1
  return { generation, blockId, word: clean, persisted: false }
}

export function selectionMatches(selection: LocalWordSelection | null, generation: number): boolean {
  return Boolean(selection && selection.generation === generation && selection.persisted === false)
}

export function restoreLocalPosition(raw: unknown, scope: ReadingScope): { blockIndex: number; serverReceipt: null } | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  if (value.routeId !== scope.routeId || value.subject !== scope.subject) return null
  if (value.articleId !== scope.articleId || value.contentVersionId !== scope.contentVersionId) return null
  if (value.contentEpoch !== scope.contentEpoch) return null
  const blockIndex = typeof value.blockIndex === 'number' && Number.isSafeInteger(value.blockIndex) && value.blockIndex >= 0 ? value.blockIndex : 0
  return { blockIndex, serverReceipt: null }
}

export function localPositionRecord(scope: ReadingScope, blockIndex: number): Record<string, string | number | null> {
  return {
    routeId: scope.routeId,
    subject: scope.subject,
    articleId: scope.articleId,
    contentVersionId: scope.contentVersionId,
    contentEpoch: scope.contentEpoch,
    blockIndex,
  }
}

/** Fail closed when the hash or top page is empty or is a different route. */
export function readingRouteActive(currentPath: string, routePath: string): boolean {
  const normalize = (value: string) => {
    const path = value.split(/[?#]/, 1)[0].trim()
    if (!path) return ''
    const slashed = path.startsWith('/') ? path : `/${path}`
    return slashed.replace(/\/+$/, '') || '/'
  }
  const current = normalize(currentPath)
  const route = normalize(routePath)
  return current !== '' && current === route
}

/** Sealed P1 placement bank. It is not a published reading practice pin. */
const SEALED_PLACEMENT_CONTENT_CODE = 'p1.placement.v1'
const READING_CONTENT_CODE = /^[a-z][a-z0-9._:-]{1,127}$/u
const READING_ANSWER_KEY = /^(correctoptions?|acceptedkeys|correctkey|answerkeys?|answerrule)$/i

function readingRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exactSafePositive(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null
}

/** Same acceptance as grammarQuestionItemId: a safe integer, or a decimal string. */
function publishedQuestionItemId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[1-9]\d*$/u.test(value.trim())) {
    const parsed = Number(value.trim())
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

function publishedContentCode(value: unknown): string | null {
  if (typeof value !== 'string' || !READING_CONTENT_CODE.test(value) || value === SEALED_PLACEMENT_CONTENT_CODE) return null
  return value
}

function unwrapReadingRecord(value: unknown): Record<string, unknown> | null {
  if (!readingRecord(value)) return null
  if ('data' in value && readingRecord(value.data)) return value.data
  if ('result' in value && readingRecord(value.result)) return value.result
  return value
}

function hasReadingAnswerMaterial(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((entry) => hasReadingAnswerMaterial(entry))
  if (!readingRecord(value)) return false
  for (const [key, nested] of Object.entries(value)) {
    if (READING_ANSWER_KEY.test(key.replace(/[_\-\s]/g, ''))) return true
    if (nested && typeof nested === 'object' && hasReadingAnswerMaterial(nested)) return true
  }
  return false
}

/** Detail practiceRef only. A string version, the sealed placement code, or the article id is dropped. */
export function coherentReadingPracticeRef(articleId: number, articleVersion: unknown, raw: unknown): ReadingPracticePin | null {
  const version = exactSafePositive(articleVersion)
  const article = exactSafePositive(articleId)
  if (version == null || article == null || !readingRecord(raw)) return null
  const contentCode = publishedContentCode(raw.contentCode)
  const refVersion = exactSafePositive(raw.contentVersionId)
  const questionItemId = publishedQuestionItemId(raw.questionItemId)
  if (!contentCode || refVersion !== version || questionItemId == null || questionItemId === article) return null
  return { contentCode, contentVersionId: version, questionItemId }
}

export function readingPracticePin(article: ReadingArticleInput | null): ReadingPracticePin | null {
  if (!article || articleViewState(article) !== 'ready') return null
  return coherentReadingPracticeRef(article.articleId, article.contentVersionId, article.practiceRef)
}

export function readingPracticeReady(article: ReadingArticleInput | null, permit: ReadPermit): boolean {
  return readingPracticePin(article) !== null && readStillCurrent(permit)
}

export function readingPracticeSessionBody(pin: ReadingPracticePin): {
  contentCode: string
  contentVersionId: number
  mode: 'PRACTICE'
  itemIds: [number]
  clientSessionRef: string
} | null {
  const contentCode = publishedContentCode(pin.contentCode)
  const contentVersionId = exactSafePositive(pin.contentVersionId)
  const questionItemId = exactSafePositive(pin.questionItemId)
  if (!contentCode || contentVersionId == null || questionItemId == null) return null
  if (contentCode !== pin.contentCode || contentVersionId !== pin.contentVersionId || questionItemId !== pin.questionItemId) return null
  return {
    contentCode,
    contentVersionId,
    mode: 'PRACTICE',
    itemIds: [questionItemId],
    clientSessionRef: `h5-reading-${contentVersionId}-${questionItemId}`,
  }
}

export function readingPracticeResponseAccepted(value: unknown, pin: ReadingPracticePin): boolean {
  const source = unwrapReadingRecord(value)
  if (!source || !readingPracticeSessionBody(pin)) return false
  if (source.mode !== 'PRACTICE' || source.status !== 'IN_PROGRESS') return false
  if (typeof source.sessionId !== 'string' || !source.sessionId.startsWith('asess_') || source.sessionId.length <= 'asess_'.length) return false
  if ('score' in source || 'scoreBucket' in source || 'savedReceipt' in source || 'correct' in source || 'isCorrect' in source) return false
  const pinned = readingRecord(source.pin) ? source.pin : null
  if (!pinned || pinned.contentCode !== pin.contentCode || pinned.pinStatus !== 'PINNED') return false
  if (pinned.contentVersionId !== pin.contentVersionId || !exactSafePositive(pinned.contentVersionId)) return false
  if ('alternativeContentVersionId' in pinned || 'alternativeContentCode' in pinned || 'alternativeReasonCode' in pinned) return false
  if (!Array.isArray(source.items) || source.items.length !== 1 || !readingRecord(source.items[0])) return false
  const item = source.items[0]
  if (item.itemId !== pin.questionItemId || !exactSafePositive(item.itemId)) return false
  if (hasReadingAnswerMaterial(item)) return false
  return true
}

export function readingPracticeParsedAccepted(session: { sessionId?: unknown; sessionType?: unknown; status?: unknown; exercises?: unknown } | null, pin: ReadingPracticePin): boolean {
  if (!session || !readingRecord(session) || !readingPracticeSessionBody(pin)) return false
  if (typeof session.sessionId !== 'string' || !session.sessionId.startsWith('asess_') || session.sessionId.length <= 'asess_'.length) return false
  if (session.sessionType !== 'PRACTICE' || session.status !== 'IN_PROGRESS') return false
  if ('score' in session || 'scoreBucket' in session || 'savedReceipt' in session) return false
  if (!Array.isArray(session.exercises) || session.exercises.length !== 1 || !readingRecord(session.exercises[0])) return false
  const exercise = session.exercises[0]
  if (exercise.exerciseId !== pin.questionItemId) return false
  if (exercise.itemId != null && exercise.itemId !== pin.questionItemId) return false
  if (exercise.contentVersionId != null && exercise.contentVersionId !== pin.contentVersionId) return false
  return true
}

/** Non-sensitive tab marker. The session id never travels in the query. */
export const READING_PRACTICE_ENTRY_MARKER = 'reading'
export const READING_PRACTICE_ENTRY_PATH = '/pages/b2-practice/b2-practice?entry=reading'
export const READING_PRACTICE_ENTRY_MS = 120_000

export interface ReadingPracticeEntry {
  sessionId: string
  contentCode: string
  contentVersionId: number
  questionItemId: number
}

export function readingPracticeEntry(sessionId: unknown, pin: ReadingPracticePin | null): ReadingPracticeEntry | null {
  if (!pin || !readingPracticeSessionBody(pin)) return null
  if (typeof sessionId !== 'string' || !sessionId.startsWith('asess_') || sessionId.length <= 'asess_'.length) return null
  return { sessionId, contentCode: pin.contentCode, contentVersionId: pin.contentVersionId, questionItemId: pin.questionItemId }
}

/** Marker only. A session id or any other query field is not authority. */
export function readingPracticeEntryMarked(query: unknown): boolean {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return false
  return (query as Record<string, unknown>).entry === READING_PRACTICE_ENTRY_MARKER
}

export function readingPracticeEntryFresh(issuedAt: unknown, now: unknown): boolean {
  if (typeof issuedAt !== 'number' || typeof now !== 'number') return false
  if (!Number.isSafeInteger(issuedAt) || !Number.isFinite(now) || now < issuedAt) return false
  return now - issuedAt < READING_PRACTICE_ENTRY_MS
}

/** Same raw pin acceptance, plus equality with the verified session id. */
export function readingPracticeReadbackAccepted(value: unknown, entry: ReadingPracticeEntry): boolean {
  if (!readingPracticeEntry(entry.sessionId, entry)) return false
  if (!readingPracticeResponseAccepted(value, entry)) return false
  const source = unwrapReadingRecord(value)
  return Boolean(source && source.sessionId === entry.sessionId)
}
