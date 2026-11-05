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
