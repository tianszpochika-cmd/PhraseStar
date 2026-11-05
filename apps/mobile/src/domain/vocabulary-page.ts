import { vocabPlayable } from './closed-practice'

/** The page renders a spelling only after loadCurrentFront settles for the current card. */
export const VOCABULARY_PAGE_DEPENDENCY = 'C2_FRONT_CURRENT' as const

export type VocabularyPagePhase = 'idle' | 'loading' | 'empty' | 'blocked' | 'front' | 'back' | 'complete'
export type VocabularyAudioMode = 'play' | 'silent' | 'failed'
export type VocabularyNotice =
  | 'none'
  | 'recovery'
  | 'untrusted'
  | 'queued'
  | 'offline'
  | 'forbidden'
  | 'stale'
  | 'error'
  | 'failed'
  | 'missing-version'
  | 'missing-snapshot'
  | 'submitting'
export type VocabularyRatingBlock =
  | 'recovery'
  | 'untrusted'
  | 'not-revealed'
  | 'queued'
  | 'submitting'
  | 'accepted'
  | 'stale'
  | 'failed'
  | 'missing-version'
  | 'missing-snapshot'
  | 'ready'
export type VocabularySourceKind = 'new' | 'review'
export type VocabularyMasteryKind = 'new' | 'learning' | 'mastered' | 'hold'

export interface VocabularyPageExample {
  sentenceEn: string | null
  sentenceCn: string | null
}

export interface VocabularyPageCardInput {
  id?: string
  title?: string | null
  phonetic?: string | null
  phoneticUs?: string | null
  phoneticUk?: string | null
  audioUrl?: string | null
  audio?: { us?: string | null; uk?: string | null } | null
  meaningCn?: string | null
  definitionEn?: string | null
  examples?: string[] | null
  exampleItems?: Array<{ sentenceEn?: string | null; sentenceCn?: string | null }> | null
  masteryStatus?: string | null
  sourceReason?: string | null
  dueLocalDate?: string | null
  stateVersion?: number | null
  snapshotId?: number | string | null
  revealed?: boolean
  reviewStatus?: string | null
}

export interface VocabularyPageInput {
  status: string
  batchStatus?: string | null
  items?: VocabularyPageCardInput[] | null
  current?: VocabularyPageCardInput | null
  queueCount?: number
  message?: string | null
  audioFailed?: boolean
  reasonCode?: string | null
  frontPending?: boolean
  frontBlocked?: boolean
}

export interface VocabularyPageView {
  phase: VocabularyPagePhase
  dependency: typeof VOCABULARY_PAGE_DEPENDENCY
  capability: typeof VOCABULARY_PAGE_DEPENDENCY
  frontTitle: string | null
  frontMissing: boolean
  phonetic: string | null
  showAnswer: boolean
  meaning: string | null
  definition: string | null
  examples: VocabularyPageExample[] | null
  due: string | null
  acceptedCount: number
  totalCount: number
  queueCount: number
  syncWaiting: boolean
  ratingEnabled: boolean
  ratingBlock: VocabularyRatingBlock | null
  audioMode: VocabularyAudioMode
  notice: VocabularyNotice
  completed: boolean
  source: VocabularySourceKind | null
  mastery: VocabularyMasteryKind | null
  revealEnabled: boolean
}

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function classifyMessage(message: string | null | undefined): VocabularyNotice | null {
  if (!message) return null
  if (message.includes('UNTRUSTED_REVIEW_EVIDENCE') || message.includes('这个操作现在不能用')) return 'untrusted'
  if (message.includes('RECOVERY_REQUIRED') || message.includes('复习记录待核验')) return 'recovery'
  if (message.includes('待同步队列') || message.includes('已排队待同步') || message.includes('待同步事件')) return 'queued'
  if (message.includes('缺少可信 SRS 状态版本') || message.includes('缺少可核验的状态版本')) return 'missing-version'
  if (message.includes('缺少服务端批次标识') || message.includes('没有可提交的合同项标识')) return 'missing-snapshot'
  return null
}

function sourceKind(value: string | null | undefined): VocabularySourceKind | null {
  if (value === 'NEW') return 'new'
  if (value === 'DUE' || value === 'OVERDUE_SMOOTHING' || value === 'D1_VERIFY' || value === 'D7_VERIFY' || value === 'MISTAKE_REPAIR') return 'review'
  return null
}

function masteryKind(value: string | null | undefined): VocabularyMasteryKind | null {
  if (value === 'NEW') return 'new'
  if (value === 'LEARNING' || value === 'SHORT_TERM' || value === 'CONSOLIDATING') return 'learning'
  if (value === 'MASTERED' || value === 'CONSOLIDATED') return 'mastered'
  if (value === 'AT_RISK' || value === 'SUSPENDED') return 'hold'
  return null
}

function examplesOf(card: VocabularyPageCardInput): VocabularyPageExample[] {
  const paired = Array.isArray(card.exampleItems)
    ? card.exampleItems
      .map((item) => ({ sentenceEn: clean(item?.sentenceEn), sentenceCn: clean(item?.sentenceCn) }))
      .filter((item) => item.sentenceEn || item.sentenceCn)
    : []
  if (paired.length) return paired
  if (!Array.isArray(card.examples)) return []
  return card.examples
    .map((sentence) => ({ sentenceEn: clean(sentence), sentenceCn: null }))
    .filter((item) => item.sentenceEn || item.sentenceCn)
}

function permittedAudio(value: string | null): string | null {
  if (!value || !vocabPlayable(value)) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return value
  } catch {
    return null
  }
}

function frontSpelling(value: unknown): string | null {
  const text = clean(value)
  if (!text || text.includes('学习项')) return null
  return text
}

function playableUrl(card: VocabularyPageCardInput, revealed: boolean): string | null {
  const direct = permittedAudio(clean(card.audioUrl))
  if (direct) return direct
  if (!revealed || !card.audio) return null
  return permittedAudio(clean(card.audio.us) ?? clean(card.audio.uk))
}

function ratingBlockFor(
  card: VocabularyPageCardInput,
  revealed: boolean,
  recovery: boolean,
  untrusted: boolean,
): VocabularyRatingBlock {
  if (recovery) return 'recovery'
  if (untrusted) return 'untrusted'
  if (!revealed) return 'not-revealed'
  const reviewStatus = card.reviewStatus
  if (reviewStatus === 'QUEUED') return 'queued'
  if (reviewStatus === 'SUBMITTING') return 'submitting'
  if (reviewStatus === 'ACCEPTED') return 'accepted'
  if (reviewStatus === 'STALE') return 'stale'
  if (reviewStatus === 'FAILED') return 'failed'
  if (card.stateVersion === null || card.stateVersion === undefined) return 'missing-version'
  if (!card.snapshotId) return 'missing-snapshot'
  return 'ready'
}

function noticeFor(input: VocabularyPageInput, card: VocabularyPageCardInput | null, recovery: boolean, untrusted: boolean): VocabularyNotice {
  if (untrusted) return 'untrusted'
  if (recovery) return 'recovery'
  const fromMessage = classifyMessage(input.message)
  if (card?.reviewStatus === 'QUEUED' || fromMessage === 'queued') return 'queued'
  if (card?.reviewStatus === 'SUBMITTING') return 'submitting'
  if (card?.reviewStatus === 'FAILED') return 'failed'
  if (fromMessage === 'missing-version' || fromMessage === 'missing-snapshot') return fromMessage
  if (card?.reviewStatus === 'STALE') return 'stale'
  if (input.status === 'offline') return 'offline'
  if (input.status === 'forbidden') return 'forbidden'
  if (input.status === 'stale') return 'stale'
  if (input.status === 'error') return 'error'
  return 'none'
}

export function mapVocabularyPage(input: VocabularyPageInput): VocabularyPageView {
  const items = Array.isArray(input.items) ? input.items : []
  const current = input.current ?? null
  const queueCount = input.queueCount ?? 0
  const acceptedCount = items.filter((item) => item.reviewStatus === 'ACCEPTED').length
  const totalCount = items.length
  const fromMessage = classifyMessage(input.message)
  const recovery = input.batchStatus === 'RECOVERY_REQUIRED' || fromMessage === 'recovery'
  const untrusted = fromMessage === 'untrusted' || input.reasonCode === 'UNTRUSTED_REVIEW_EVIDENCE'
  const notice = noticeFor(input, current, recovery, untrusted)
  const completed = totalCount > 0 && acceptedCount === totalCount && queueCount === 0 && !current && !recovery && !untrusted
  const blocked = notice === 'recovery' || notice === 'untrusted' || input.status === 'forbidden' || input.status === 'offline' || input.status === 'error'
    || (!current && input.status === 'stale')
  let phase: VocabularyPagePhase
  if (blocked) phase = 'blocked'
  else if (completed) phase = 'complete'
  else if (!current && input.status === 'loading') phase = 'loading'
  else if (!current && input.status === 'empty') phase = 'empty'
  else if (!current && (input.status === 'idle' || input.status === 'ready')) phase = input.status === 'ready' ? 'blocked' : 'idle'
  else if (!current) phase = 'blocked'
  else if (current.revealed === true) phase = 'back'
  else phase = 'front'
  let visibleNotice: VocabularyNotice = phase === 'blocked' && notice === 'none' ? 'stale' : notice
  if (input.frontBlocked && phase === 'front') {
    phase = 'blocked'
    if (visibleNotice === 'none') visibleNotice = input.status === 'forbidden' ? 'forbidden' : input.status === 'offline' ? 'offline' : input.status === 'error' ? 'error' : 'stale'
  }
  if (input.frontPending && phase === 'front') phase = 'loading'

  const revealed = current?.revealed === true
  const showAnswer = phase === 'back'
  const frontTitle = phase === 'front' || phase === 'back' ? frontSpelling(current?.title) : null
  const ratingBlock = current && phase !== 'complete' ? ratingBlockFor(current, revealed, recovery, untrusted) : null
  const ratingEnabled = phase === 'back' && ratingBlock === 'ready' && input.status !== 'loading'
  const url = current && (phase === 'front' || phase === 'back') ? playableUrl(current, revealed) : null
  const audioMode: VocabularyAudioMode = !url ? 'silent' : input.audioFailed ? 'failed' : 'play'

  return {
    phase,
    dependency: VOCABULARY_PAGE_DEPENDENCY,
    capability: VOCABULARY_PAGE_DEPENDENCY,
    frontTitle,
    frontMissing: (phase === 'front' || phase === 'back') && !frontTitle,
    phonetic: phase === 'front' || phase === 'back' ? clean(current?.phonetic) ?? clean(current?.phoneticUs) ?? clean(current?.phoneticUk) : null,
    showAnswer,
    meaning: showAnswer ? clean(current?.meaningCn) : null,
    definition: showAnswer ? clean(current?.definitionEn) : null,
    examples: showAnswer ? examplesOf(current ?? {}) : null,
    due: showAnswer ? clean(current?.dueLocalDate) : null,
    acceptedCount,
    totalCount,
    queueCount,
    syncWaiting: queueCount > 0 && !completed,
    ratingEnabled,
    ratingBlock,
    audioMode,
    notice: visibleNotice,
    completed,
    source: phase === 'front' || phase === 'back' ? sourceKind(current?.sourceReason) : null,
    mastery: phase === 'front' || phase === 'back' ? masteryKind(current?.masteryStatus) : null,
    revealEnabled: phase === 'front' && input.status !== 'loading' && current?.reviewStatus !== 'SUBMITTING' && current?.reviewStatus !== 'ACCEPTED',
  }
}
