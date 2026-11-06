/** Pure grammar contract helpers. No network, storage, or grading. */

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredText(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Positive integer ids from the Java payload (number or decimal string). */
export function grammarQuestionItemId(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value
  if (typeof value === 'string' && /^[1-9]\d*$/u.test(value.trim())) {
    const parsed = Number(value.trim())
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
  }
  return null
}

/**
 * Published grammar point. Missing required contract fields stay closed.
 * Titles, formulas, levels, and examples are never invented.
 */
export function parseGrammarPointContent(value) {
  if (!isRecord(value)) return null
  const grammarPointId = grammarQuestionItemId(value.grammarPointId)
  const code = requiredText(value.code)
  const title = requiredText(value.title)
  const ruleFormula = requiredText(value.ruleFormula)
  const contentVersionId = grammarQuestionItemId(value.contentVersionId)
  if (!grammarPointId || !code || !title || !ruleFormula || !contentVersionId) return null
  const masterySource = value.masteryPercent
  const masteryPercent = typeof masterySource === 'number' && Number.isFinite(masterySource)
    ? Math.round(masterySource * (masterySource <= 1 ? 100 : 1))
    : null
  return {
    grammarPointId,
    code,
    title,
    ruleFormula,
    meaningCn: requiredText(value.meaningCn) ?? '',
    cefrLevel: requiredText(value.cefrLevel) ?? '',
    trapTags: Array.isArray(value.trapTags) ? value.trapTags.filter((entry) => typeof entry === 'string') : [],
    prerequisites: Array.isArray(value.prerequisites) ? value.prerequisites.flatMap((entry) => {
      const id = grammarQuestionItemId(entry)
      return id ? [id] : []
    }) : [],
    sentenceId: grammarQuestionItemId(value.sentenceId ?? value.exampleSentenceId),
    masteryPercent,
    contentVersionId,
    examples: Array.isArray(value.examples) ? value.examples.flatMap((entry) => {
      const text = requiredText(entry)
      return text ? [text] : []
    }) : [],
  }
}

export function grammarPointExamples(point) {
  if (!point || !Array.isArray(point.examples)) return []
  return point.examples.flatMap((entry) => {
    const text = requiredText(entry)
    return text ? [text] : []
  })
}

/** Contract promptText, then a string prompt on the published payload. Never invents a stem. */
export function grammarPromptText(value) {
  if (!isRecord(value)) return ''
  for (const candidate of [value.promptText, value.stemText, value.stem]) {
    const text = requiredText(candidate)
    if (text) return text
  }
  const prompt = requiredText(value.prompt)
  if (prompt) return prompt
  if (isRecord(value.prompt)) return requiredText(value.prompt.text ?? value.prompt.stemText) ?? ''
  return ''
}

/** grammarPointId <= 0 keeps the published exercise catalog. A chosen point filters to that id. */
export function grammarPreviewItems(items, grammarPointId) {
  if (!Array.isArray(items)) return []
  const selected = grammarQuestionItemId(grammarPointId) ?? 0
  const preview = []
  for (const item of items) {
    if (!isRecord(item)) continue
    const pointId = grammarQuestionItemId(item.grammarPointId)
    if (selected > 0 && pointId !== null && pointId !== selected) continue
    const promptText = grammarPromptText(item)
    if (!promptText) continue
    preview.push({ ...item, promptText })
  }
  return preview
}

/** Saved-order copy only when this device actually holds an order. */
export function grammarClosedDraftKey(draft) {
  const ids = draft && Array.isArray(draft.orderedTokenIds) ? draft.orderedTokenIds : []
  return ids.some((entry) => typeof entry === 'string' && entry.trim()) ? 'graphClosedSaved' : 'graphClosedBody'
}
