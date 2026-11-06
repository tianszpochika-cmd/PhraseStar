import type { B10GrammarPoint } from './b10'

export interface GrammarPointContent extends B10GrammarPoint {
  examples: string[]
}

export function grammarQuestionItemId(value: unknown): number | null
export function parseGrammarPointContent(value: unknown): GrammarPointContent | null
export function grammarPointExamples(point: (B10GrammarPoint & { examples?: readonly string[] }) | null | undefined): string[]
export function grammarPromptText(value: unknown): string
export function grammarPreviewItems(items: readonly unknown[], grammarPointId: number): Array<Record<string, unknown>>
export function grammarClosedDraftKey(draft: { orderedTokenIds?: readonly string[] | null } | null | undefined): 'graphClosedBody' | 'graphClosedSaved'
