import assert from 'node:assert/strict'
import test from 'node:test'
import {
  grammarClosedDraftKey,
  grammarPointExamples,
  grammarPreviewItems,
  grammarPromptText,
  grammarQuestionItemId,
  parseGrammarPointContent,
} from '../src/domain/grammar-page-contract.mjs'

const publishedPoint = {
  grammarPointId: 701,
  code: 'GP_701',
  title: '定语从句: that 与 which',
  ruleFormula: '名词 + that/which + 不完整从句',
  meaningCn: '用从句补充说明前面的名词。',
  cefrLevel: 'B2',
  trapTags: ['THAT_WHICH'],
  prerequisites: [],
  sentenceId: 9001,
  masteryPercent: 62,
  contentVersionId: 3001,
  examples: ['The book that you lent me is on the desk.'],
}

const exercise = {
  grammarPointId: 701,
  exerciseId: 8801,
  questionId: 7701,
  questionType: 'CHOICE',
  prompt: '选择正确的词补全句子：The book ___ you lent me is on the desk.',
  sourceText: 'The book ___ you lent me is on the desk.',
  options: [{ optionCode: 'A', label: 'that' }],
  practiceRef: { contentCode: 'grammar-701', contentVersionId: 3001, questionItemId: 7701 },
}

test('published grammar point keeps contract fields and examples', () => {
  const point = parseGrammarPointContent(publishedPoint)
  assert.ok(point)
  assert.equal(point.title, publishedPoint.title)
  assert.equal(point.ruleFormula, publishedPoint.ruleFormula)
  assert.equal(point.meaningCn, publishedPoint.meaningCn)
  assert.equal(point.cefrLevel, 'B2')
  assert.equal(point.masteryPercent, 62)
  assert.equal(point.sentenceId, 9001)
  assert.deepEqual(grammarPointExamples(point), ['The book that you lent me is on the desk.'])
  assert.equal(JSON.stringify(point).includes('语法知识点'), false)
  assert.equal(JSON.stringify(point).includes('按服务端规则完成练习'), false)
})

test('missing required grammar fields stay closed instead of a fake point', () => {
  assert.equal(parseGrammarPointContent({ ...publishedPoint, title: '  ' }), null)
  assert.equal(parseGrammarPointContent({ ...publishedPoint, ruleFormula: '' }), null)
  assert.equal(parseGrammarPointContent({ ...publishedPoint, contentVersionId: null }), null)
  assert.equal(parseGrammarPointContent({ ...publishedPoint, grammarPointId: 0 }), null)
  const partial = parseGrammarPointContent({ ...publishedPoint, meaningCn: undefined, cefrLevel: undefined, masteryPercent: undefined, examples: undefined })
  assert.ok(partial)
  assert.equal(partial.meaningCn, '')
  assert.equal(partial.cefrLevel, '')
  assert.equal(partial.masteryPercent, null)
  assert.deepEqual(partial.examples, [])
})

test('mastery fraction from the contract scales once and integers stay integers', () => {
  assert.equal(parseGrammarPointContent({ ...publishedPoint, masteryPercent: 0.62 }).masteryPercent, 62)
  assert.equal(parseGrammarPointContent({ ...publishedPoint, masteryPercent: 0 }).masteryPercent, 0)
})

test('java string question ids and numeric payload ids both parse', () => {
  assert.equal(grammarQuestionItemId(7701), 7701)
  assert.equal(grammarQuestionItemId('7701'), 7701)
  assert.equal(grammarQuestionItemId(' 8801 '), 8801)
  assert.equal(grammarQuestionItemId(0), null)
  assert.equal(grammarQuestionItemId('0'), null)
  assert.equal(grammarQuestionItemId('item-1'), null)
  assert.equal(grammarQuestionItemId(''), null)
})

test('exercise prompt comes from promptText or the published prompt string', () => {
  assert.equal(grammarPromptText({ promptText: ' 选择正确的词补全句子 ', prompt: 'ignored' }), '选择正确的词补全句子')
  assert.equal(grammarPromptText(exercise).includes('选择正确的词补全句子'), true)
  assert.equal(grammarPromptText({}), '')
  assert.equal(grammarPromptText({ prompt: { text: '从句填空' } }), '从句填空')
  assert.equal(grammarPromptText({ stem: '请完成本题。' }), '请完成本题。')
})

test('unbound catalog keeps real exercises and a chosen point filters them', () => {
  const unbound = grammarPreviewItems([exercise, { grammarPointId: 702, promptText: '另一题' }, { grammarPointId: 703 }], 0)
  assert.equal(unbound.length, 2)
  assert.equal(unbound[0].promptText.includes('选择正确的词补全句子'), true)
  assert.equal(unbound[0].exerciseId, 8801)
  const selected = grammarPreviewItems([exercise, { grammarPointId: 702, prompt: '另一题' }], 701)
  assert.deepEqual(selected.map((item) => item.grammarPointId), [701])
  assert.equal(grammarPreviewItems([{ grammarPointId: 701, options: [] }], 701).length, 0)
})

test('closed-graph copy claims a saved order only when an order exists', () => {
  assert.equal(grammarClosedDraftKey(null), 'graphClosedBody')
  assert.equal(grammarClosedDraftKey({}), 'graphClosedBody')
  assert.equal(grammarClosedDraftKey({ orderedTokenIds: [] }), 'graphClosedBody')
  assert.equal(grammarClosedDraftKey({ orderedTokenIds: ['  '] }), 'graphClosedBody')
  assert.equal(grammarClosedDraftKey({ selectedPointId: 701 }), 'graphClosedBody')
  assert.equal(grammarClosedDraftKey({ orderedTokenIds: ['slice-1'] }), 'graphClosedSaved')
})
