import { continueCheckpoint, isAccessibleContent, shelfSearchState } from '../../domain/plan-today'

export type LearnSurface = 'shelf' | 'detail'
export type LearnShelfKind = 'denial' | 'error' | 'unavailable' | 'catalog-empty' | 'no-matches' | 'results'
export type LearnReadKind = 'auth' | 'denial' | 'unavailable' | 'error'
export type LearnUnitMark = 'neutral'

export interface LearnShelfCard {
  contentCode: string
  title: string
  summary: string
  availability?: string
  status?: string
  contentVersionId?: number | null
}

export interface LearnUnit {
  itemId: string
  text: string
  mark: LearnUnitMark
}

const ZH_LOCALE: Record<string, string> = {
  'en-US': '英语',
  'en-GB': '英语',
  'zh-CN': '中文',
  'de-DE': '德语',
  'fr-FR': '法语',
  'es-ES': '西班牙语',
}
const EN_LOCALE: Record<string, string> = {
  'en-US': 'English',
  'en-GB': 'English',
  'zh-CN': 'Chinese',
  'de-DE': 'German',
  'fr-FR': 'French',
  'es-ES': 'Spanish',
}
const ZH_TYPE: Record<string, string> = {
  COURSE: '课程',
  COURSE_UNIT: '课程单元',
  VOCABULARY: '词汇',
  PHRASE: '短语',
  GRAMMAR: '语法',
  SENTENCE: '句子',
  MEDIA: '音视频',
  QUESTION: '练习',
}
const EN_TYPE: Record<string, string> = {
  COURSE: 'Course',
  COURSE_UNIT: 'Course unit',
  VOCABULARY: 'Vocabulary',
  PHRASE: 'Phrase',
  GRAMMAR: 'Grammar',
  SENTENCE: 'Sentence',
  MEDIA: 'Media',
  QUESTION: 'Practice',
}
const ZH_SOURCE: Record<string, string> = { NEW: '新内容', REVIEW: '复习', MISTAKE: '错题', RETRY: '重练', UNKNOWN: '复习项' }
const EN_SOURCE: Record<string, string> = { NEW: 'New', REVIEW: 'Review', MISTAKE: 'Mistake', RETRY: 'Retry', UNKNOWN: 'Review item' }
const ZH_STAGE: Record<string, string> = { NEW: '初学', LEARNING: '巩固中', REVIEW: '待复习', MASTERED: '已掌握' }
const EN_STAGE: Record<string, string> = { NEW: 'Starting', LEARNING: 'In progress', REVIEW: 'Due', MASTERED: 'Mastered' }

/** Shelf and detail are two views of the same registered page. */
export function learnSurface(contentCode: string): LearnSurface {
  return contentCode.trim() ? 'detail' : 'shelf'
}

export function accessibleShelf<T extends { contentCode?: string; availability?: string; status?: string }>(items: readonly T[]): T[] {
  return items.filter((item) => Boolean(item.contentCode?.trim()) && isAccessibleContent(item))
}

export function matchShelf<T extends { title?: string; summary?: string }>(items: readonly T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...items]
  return items.filter((item) => `${item.title ?? ''} ${item.summary ?? ''}`.toLowerCase().includes(needle))
}

/** Empty catalog stays empty even when a query is typed. Failure, denial and unavailability stay separate. */
export function classifyLearnShelf(input: {
  denied: boolean
  offline: boolean
  unavailable: boolean
  accessibleCount: number
  matchCount: number
}): LearnShelfKind {
  if (input.denied) return 'denial'
  if (input.offline) return 'error'
  if (input.unavailable) return 'unavailable'
  const state = shelfSearchState(input.accessibleCount, input.matchCount, false)
  return state === 'error' ? 'catalog-empty' : state
}

export function readStatusKind(status: number | null): LearnReadKind | null {
  if (status === 401) return 'auth'
  if (status === 403) return 'denial'
  if (status === 404) return 'unavailable'
  if (status === null) return null
  return 'error'
}

/** A catalog card that is not published blocks the body. A missing card does not invent a right. */
export function rightsBlocked(availability: string | null | undefined): boolean {
  if (!availability) return false
  return !isAccessibleContent({ availability })
}

/** A pinned task version blocks the body only when both versions are real and differ. */
export function versionBlocked(pin: number | null | undefined, actual: number | null | undefined): boolean {
  return typeof pin === 'number' && typeof actual === 'number' && pin !== actual
}

/** Resume only an ACTIVE checkpoint. Anything else cannot enter by resume. */
export function resumeCheckpoint(context: { status?: string; lessonId?: string; stepIndex?: number } | null): { contentId: string; step: string } | null {
  return continueCheckpoint(context)
}

/** Learner-facing unit text only. Options are answers and are not copied. There is no per-unit completion receipt on this payload. */
export function learnerUnits(items: readonly { itemId?: string; text?: string; options?: unknown }[]): LearnUnit[] {
  return items.flatMap((item, index) => {
    const text = typeof item.text === 'string' ? item.text : ''
    if (!text) return []
    const itemId = typeof item.itemId === 'string' && item.itemId.trim() ? item.itemId : `unit-${index + 1}`
    return [{ itemId, text, mark: 'neutral' as const }]
  })
}

export function contentMetaLabel(contentLocale: string, contentType: string, en: boolean): string {
  const locales = en ? EN_LOCALE : ZH_LOCALE
  const types = en ? EN_TYPE : ZH_TYPE
  return [locales[contentLocale], types[contentType]].filter(Boolean).join(' · ')
}

export function reviewFacing(source: string, state: string, en: boolean): string {
  const sources = en ? EN_SOURCE : ZH_SOURCE
  const stages = en ? EN_STAGE : ZH_STAGE
  const sourceLabel = sources[source] ?? (en ? 'Review item' : '复习项')
  const stageLabel = stages[state] ?? (en ? 'Reviewing' : '复习中')
  if (!en && sourceLabel === '复习' && stageLabel === '待复习') return sourceLabel
  if (en && source === 'REVIEW' && state === 'REVIEW') return sourceLabel
  return [sourceLabel, stageLabel].filter(Boolean).join(' · ')
}

export function stageFacing(state: string, en: boolean): string {
  const stages = en ? EN_STAGE : ZH_STAGE
  return stages[state] ?? (en ? 'Reviewing' : '复习中')
}
