import type { B10AssessmentSession, B10GrammarPoint, B10SyntaxGraph } from './b10'

export type GrammarGraphState = 'READY' | 'UNAVAILABLE' | 'MISSING'

/** The grammar session is a local exercise bundle, not a persisted server session. */
export function isLocalGrammarSession(session: Pick<B10AssessmentSession, 'sessionType' | 'sessionId'> | null): boolean {
  if (!session) return false
  return session.sessionType === 'GRAMMAR_LOCAL_PREVIEW' || session.sessionId.startsWith('local-grammar_')
}

/** Only a parsed server graph is displayable; a closed read must remain unavailable. */
export function grammarGraphState(graph: B10SyntaxGraph | null, sentenceId: number | null, readFailed: boolean): GrammarGraphState {
  if (graph) return 'READY'
  if (readFailed) return 'UNAVAILABLE'
  return sentenceId ? 'MISSING' : 'MISSING'
}

export function grammarPointMeta(point: Pick<B10GrammarPoint, 'cefrLevel' | 'masteryPercent'>): { level: string; mastery: number | null } {
  return { level: point.cefrLevel, mastery: point.masteryPercent }
}

export function grammarExerciseProgress(index: number, total: number): string {
  if (total <= 0) return '0 / 0'
  return `${Math.min(Math.max(index + 1, 1), total)} / ${total}`
}

export {
  grammarClosedDraftKey,
  grammarPointExamples,
  grammarPreviewItems,
  grammarPromptText,
  grammarQuestionItemId,
  parseGrammarPointContent,
} from './grammar-page-contract.mjs'
