import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadB10(responses) {
  const source = fs.readFileSync(path.join(appRoot, 'src/api/b10.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const requests = []
  class MobileApiError extends Error {
    constructor(message, status = 0, details = null) { super(message); this.status = status; this.details = details }
  }
  const mobileApiClient = {
    async request(requestPath, options) {
      requests.push({ path: requestPath, options })
      const next = responses.shift()
      if (next instanceof Error) throw next
      if (next === undefined) throw new Error('No fixture response queued')
      return next
    },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      './unavailable': { unavailableOperation: async () => { throw new Error('unavailable fixture') } },
      './client': { mobileApiClient, MobileApiError },
      '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
      './b3': { listGrammarExercises: async () => [] },
      '../platform/client-id': { createClientId: () => 'fixture-client-event' },
    }
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  return { api: module.exports.b10LearningApi, requests }
}

const context = { uiLocale: 'zh-CN', contentLocale: 'en-US' }
const rejectsContract = (promise) => assert.rejects(promise, (error) => {
  assert.match(error.message, /接口契约/)
  return true
})

const srsState = (overrides = {}) => ({
  srsStateId: 44,
  item: { itemType: 'VOCAB', vocabId: 1 },
  repetitionCount: 2,
  easeFactor: 2.5,
  intervalDays: 3,
  dueAt: '2026-11-06T00:00:00Z',
  dueLocalDate: '2026-11-06',
  masteryStatus: 'LEARNING',
  delayedVerifyStage: 'D1_PENDING',
  stateVersion: 4,
  riskBand: 'LOW',
  explanation: ['algorithm=SRS-2'],
  ...overrides,
})

const reviewData = (overrides = {}) => ({
  reviewEventId: 501,
  eventStatus: 'ACCEPTED',
  riskDecision: 'ALLOW',
  effectiveQuality: 3,
  reconciled: false,
  stateVersion: 4,
  srsState: srsState(),
  rewardSettlementStatus: 'SETTLED',
  nextSnapshotItemId: 12,
  ...overrides,
})

const coreVocab = () => ({
  data: {
    vocabId: 1,
    word: 'learn',
    phoneticUs: 'liːrn',
    phoneticUk: 'lɜːn',
    audio: { us: '/audio/learn-us.mp3', uk: '/audio/learn-uk.mp3' },
    cefrLevel: 'A1',
    frequencyRank: 12,
    definitions: [
      { definitionId: 101, senseNo: 1, partOfSpeech: 'V', meaningCn: '学习；学会', definitionEn: 'to gain knowledge', contentVersion: 'v1' },
      { definitionId: 102, senseNo: 2, partOfSpeech: 'N', meaningCn: '学问', definitionEn: 'knowledge', contentVersion: 'v1' },
    ],
    examples: [
      { exampleId: 201, sentenceEn: 'I learn English every day.', sentenceCn: '我每天学习英语。', contentVersion: 'v1' },
      { exampleId: 202, sentenceEn: 'We learn from mistakes.', sentenceCn: '我们从错误中学习。' },
    ],
    srsState: srsState(),
    contentVersion: 'v1',
  },
})

const backVocab = () => ({
  data: {
    vocabularyId: 7,
    itemId: 7,
    title: 'make progress',
    word: 'make progress',
    frontHint: 'B1',
    contentLocale: 'en-US',
    contentVersionId: 25001,
    availability: 'PUBLISHED',
    audioRef: '/audio/make-progress.mp3',
    back: {
      meaningCn: '取得进步',
      definitionEn: 'to improve',
      partOfSpeech: 'PHRASE',
      examples: [{ exampleId: 301, sentenceEn: 'Small steps make progress.', sentenceCn: '小步积累带来进步。' }],
      collocations: [],
    },
    answerAvailable: true,
    source: 'mysql',
  },
})

const batch = () => ({
  data: {
    snapshotId: 9001,
    localDate: '2026-11-04',
    timezone: 'Asia/Shanghai',
    status: 'ACTIVE',
    algorithmVersion: 'SRS-2',
    rulesVersion: 'RULES-1',
    contentVersion: 'book-v1',
    items: [
      { snapshotItemId: 11, sequenceNo: 1, item: { itemType: 'VOCAB', vocabId: 1 }, sourceReason: 'NEW', plannedLocalDate: '2026-11-04', dueAtAtSnapshot: null, priorityScore: 0, status: 'PENDING', contentVersion: 'v1' },
      { snapshotItemId: 12, sequenceNo: 2, item: { itemType: 'CHUNK', chunkId: 11 }, sourceReason: 'DUE', plannedLocalDate: '2026-11-04', status: 'PENDING' },
      { snapshotItemId: 13, sequenceNo: 3, item: { itemType: 'EXPRESSION', expressionId: 5 }, sourceReason: 'EXPRESSION', plannedLocalDate: '2026-11-04', status: 'IN_PROGRESS', srsState: srsState({ item: { itemType: 'EXPRESSION', expressionId: 5 }, masteryStatus: 'CONSOLIDATING', stateVersion: 9 }) },
    ],
  },
})

test('vocabulary detail maps formal definitions/POS, bilingual examples, audio pair and content version', async () => {
  const page = loadB10([coreVocab()])
  const detail = await page.api.getVocabularyDetail(context, 1, 'v1')
  assert.equal(detail.vocabId, 1)
  assert.equal(detail.word, 'learn')
  assert.equal(detail.title, 'learn')
  assert.equal(detail.phoneticUs, 'liːrn')
  assert.equal(detail.phoneticUk, 'lɜːn')
  assert.equal(detail.phonetic, 'liːrn')
  assert.deepEqual(detail.audio, { us: '/audio/learn-us.mp3', uk: '/audio/learn-uk.mp3' })
  assert.equal(detail.audioUrl, '/audio/learn-us.mp3')
  assert.equal(detail.meaningCn, '学习；学会')
  assert.equal(detail.definitionEn, 'to gain knowledge')
  assert.equal(detail.definitions.length, 2)
  assert.equal(detail.definitions[1].partOfSpeech, 'N')
  assert.equal(detail.definitions[1].meaningCn, '学问')
  assert.equal(detail.exampleItems.length, 2)
  assert.equal(detail.exampleItems[0].sentenceEn, 'I learn English every day.')
  assert.equal(detail.exampleItems[0].sentenceCn, '我每天学习英语。')
  assert.deepEqual(detail.examples, ['I learn English every day.', 'We learn from mistakes.'])
  assert.equal(detail.contentVersion, 'v1')
  assert.equal(detail.srsState.masteryStatus, 'LEARNING')
  assert.equal(detail.srsState.itemType, 'VOCAB')
  assert.equal(page.requests.length, 1)
  assert.equal(page.requests[0].path, '/content/learner/vocabulary/1?contentLocale=en-US&contentVersion=v1')
})

test('vocabulary detail accepts the explicit content-service back projection without inventing a word', async () => {
  const page = loadB10([backVocab()])
  const detail = await page.api.getVocabularyDetail(context, 7)
  assert.equal(detail.vocabId, 7)
  assert.equal(detail.word, 'make progress')
  assert.equal(detail.audio, null)
  assert.equal(detail.audioUrl, '/audio/make-progress.mp3')
  assert.equal(detail.definitions.length, 1)
  assert.equal(detail.definitions[0].partOfSpeech, 'PHRASE')
  assert.equal(detail.definitions[0].meaningCn, '取得进步')
  assert.equal(detail.exampleItems[0].sentenceCn, '小步积累带来进步。')
  assert.equal(detail.contentVersion, null)
  assert.equal(detail.contentVersionId, 25001)
})

test('vocabulary detail accepts the live content-service string id and legacy {sentence,translation} examples', async () => {
  const page = loadB10([{
    data: {
      vocabularyId: 'b25-item-001',
      itemId: 'b25-item-001',
      title: 'hello',
      word: 'hello',
      frontHint: 'A1',
      contentLocale: 'en-US',
      contentVersionId: 25001,
      availability: 'PUBLISHED',
      audioRef: 'fixture/core-foundation/audio-placeholder-v1',
      back: {
        meaningCn: '你好；问候',
        definitionEn: 'A word used when meeting or greeting someone.',
        partOfSpeech: 'interjection',
        examples: [{ sentence: 'Hello, it is nice to meet you.', translation: '你好，很高兴认识你。' }],
        collocations: ['say hello', 'hello again'],
      },
      answerAvailable: true,
      source: 'mysql',
    },
  }])
  const detail = await page.api.getVocabularyDetail(context, 'b25-item-001')
  assert.equal(detail.vocabId, 'b25-item-001')
  assert.equal(detail.itemId, undefined)
  assert.equal(detail.word, 'hello')
  assert.equal(detail.definitions[0].partOfSpeech, 'interjection')
  assert.equal(detail.exampleItems[0].sentenceEn, 'Hello, it is nice to meet you.')
  assert.equal(detail.exampleItems[0].sentenceCn, '你好，很高兴认识你。')
  assert.deepEqual(detail.examples, ['Hello, it is nice to meet you.'])
  assert.equal(detail.contentVersionId, 25001)
  assert.equal(detail.audioUrl, 'fixture/core-foundation/audio-placeholder-v1')
})

test('vocabulary detail keeps audio optional and never fabricates pronunciation URLs', async () => {
  const payload = coreVocab()
  delete payload.data.audio
  const page = loadB10([payload])
  const detail = await page.api.getVocabularyDetail(context, 1)
  assert.equal(detail.audio, null)
  assert.equal(detail.audioUrl, null)
  assert.equal(page.requests.length, 1)
})

test('vocabulary detail rejects unknown or missing shapes instead of substituting empty answer copy', async () => {
  const variants = []
  const noWord = coreVocab(); delete noWord.data.word; variants.push(noWord)
  const noId = coreVocab(); delete noId.data.vocabId; variants.push(noId)
  const stringId = coreVocab(); stringId.data.vocabId = '1'; variants.push(stringId)
  const noVersion = coreVocab(); delete noVersion.data.contentVersion; variants.push(noVersion)
  const badDefinitions = coreVocab(); badDefinitions.data.definitions = 'oops'; variants.push(badDefinitions)
  const emptyDefinition = coreVocab(); emptyDefinition.data.definitions = [{ partOfSpeech: 'V' }]; variants.push(emptyDefinition)
  const badExample = coreVocab(); badExample.data.examples = ['I learn English every day.']; variants.push(badExample)
  const stringAudio = coreVocab(); stringAudio.data.audio = '/audio/learn-us.mp3'; variants.push(stringAudio)
  const missingDefinitions = coreVocab(); delete missingDefinitions.data.definitions; variants.push(missingDefinitions)
  const nullPayload = { data: null }; variants.push(nullPayload)
  for (const payload of variants) {
    const page = loadB10([payload])
    await rejectsContract(page.api.getVocabularyDetail(context, 1))
  }
})

test('SRS batch maps vocab/chunk/expression item refs and validates snapshot enums', async () => {
  const page = loadB10([batch()])
  const value = await page.api.createSrsBatch(context, 'srs-batch-1')
  assert.equal(value.snapshotId, 9001)
  assert.equal(value.status, 'ACTIVE')
  assert.equal(value.contentVersion, 'book-v1')
  assert.equal(value.items.length, 3)
  assert.deepEqual(value.items.map((card) => [card.itemType, card.itemId]), [['VOCAB', 1], ['CHUNK', 11], ['EXPRESSION', 5]])
  assert.deepEqual(value.items.map((card) => card.sourceReason), ['NEW', 'DUE', 'EXPRESSION'])
  assert.deepEqual(value.items.map((card) => card.title), [null, null, null])
  assert.equal(value.items[0].stateVersion, 0)
  assert.equal(value.items[1].stateVersion, null)
  assert.equal(value.items[2].stateVersion, 9)
  assert.equal(value.items[2].masteryStatus, 'CONSOLIDATING')
  assert.equal(value.items[0].snapshotItemId, 11)
  assert.equal(value.items[0].contentVersion, 'v1')
  assert.match(page.requests[0].path, /^\/learning\/srs\/batches\?contentLocale=en-US$/)
  assert.deepEqual(page.requests[0].options.data, { localDate: new Date().toISOString().slice(0, 10), timezone: 'Asia/Shanghai', dailyNewTarget: 20, maxDailyReview: 50, scheduleType: 'DAILY' })
})

test('SRS batch rejects missing refs, unknown item types/enums and non-formal flat items', async () => {
  const cases = []
  const clone = () => JSON.parse(JSON.stringify(batch()))
  let value = clone(); delete value.data.snapshotId; cases.push(value)
  value = clone(); delete value.data.localDate; cases.push(value)
  value = clone(); delete value.data.status; cases.push(value)
  value = clone(); delete value.data.items; cases.push(value)
  value = clone(); delete value.data.items[0].snapshotItemId; cases.push(value)
  value = clone(); delete value.data.items[0].item; value.data.items[0].vocabId = 1; cases.push(value)
  value = clone(); value.data.items[0].item = { itemType: 'PHRASE', phraseId: 1 }; cases.push(value)
  value = clone(); value.data.items[0].item = { itemType: 'VOCAB' }; cases.push(value)
  value = clone(); value.data.items[0].item.vocabId = '1'; cases.push(value)
  value = clone(); value.data.items[0].item.chunkId = 11; cases.push(value)
  value = clone(); value.data.items[0].sourceReason = 'REVIEW'; cases.push(value)
  value = clone(); value.data.items[0].status = 'READY'; cases.push(value)
  value = clone(); value.data.items[0].srsState = { masteryStatus: 'LEARNING' }; cases.push(value)
  for (const payload of cases) {
    const page = loadB10([payload])
    await rejectsContract(page.api.createSrsBatch(context, 'srs-batch-1'))
  }
})

test('review response maps eventStatus and nested srsState for accepted and duplicate outcomes', async () => {
  for (const eventStatus of ['ACCEPTED', 'DUPLICATE', 'RISK_FILTERED', 'CONFLICT', 'EXPIRED']) {
    const page = loadB10([{ data: reviewData({ eventStatus }) }])
    const result = await page.api.submitSrsReview(context, {
      id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
      title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
      hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
      stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
    }, 3, 'srs-review-1')
    assert.equal(result.eventStatus, eventStatus)
    assert.equal(result.reviewEventId, 501)
    assert.equal(result.riskDecision, 'ALLOW')
    assert.equal(result.stateVersion, 4)
    assert.equal(result.srsState.masteryStatus, 'LEARNING')
    assert.equal(result.srsState.stateVersion, 4)
    assert.equal(result.srsState.dueLocalDate, '2026-11-06')
    assert.equal(result.rewardSettlementStatus, 'SETTLED')
  }
})

test('review failure propagates and unknown/PENDING_SYNC eventStatus never becomes a fake accepted state', async () => {
  const offline = loadB10([new Error('network down')])
  await assert.rejects(offline.api.submitSrsReview(context, {
    id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
    title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
    hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
    stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
  }, 3, 'srs-review-1'), /network down/)
  assert.equal(offline.requests.length, 1)
  for (const eventStatus of ['PENDING_SYNC', 'PAUSED', 'ACCEPTED_BUT_UNKNOWN', '']) {
    const page = loadB10([{ data: reviewData({ eventStatus }) }])
    await rejectsContract(page.api.submitSrsReview(context, {
      id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
      title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
      hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
      stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
    }, 3, 'srs-review-1'))
  }
  const legacyStatus = loadB10([{ data: { status: 'ACCEPTED', reviewEventId: 1 } }])
  await rejectsContract(legacyStatus.api.submitSrsReview(context, {
    id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
    title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
    hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
    stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
  }, 3, 'srs-review-1'))
})

test('review request drops forbidden itemId and emits only contract fields', async () => {
  const page = loadB10([{ data: reviewData() }])
  const card = {
    id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
    title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
    hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
    stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
  }
  await page.api.submitSrsReview(context, card, 2, 'srs-review-abc')
  const request = page.requests[0]
  assert.equal(request.path, '/learning/srs/reviews')
  assert.deepEqual(Object.keys(request.options.data).sort(), [
    'answerOutcome', 'baseStateVersion', 'clientEventId', 'clientOccurredAt', 'item',
    'rawQuality', 'responseTimeMs', 'revealElapsedMs', 'snapshotId', 'snapshotItemId',
  ])
  assert.equal('itemId' in request.options.data, false)
  assert.deepEqual(request.options.data.item, { itemType: 'VOCAB', vocabId: 1 })
  assert.equal(request.options.data.rawQuality, 2)
  assert.equal(request.options.data.answerOutcome, 'REVEALED_WITHOUT_ANSWER')
  assert.equal(request.options.data.baseStateVersion, 0)
  assert.equal(request.options.header['Idempotency-Key'], 'b10-srs-review-abc')
  assert.equal(request.options.header['Accept-Language'], 'zh-CN')
  assert.equal(request.options.header['X-Content-Version'], 'v1')
})

test('review request rejects missing snapshot/version identifiers before touching the wire', async () => {
  for (const patch of [{ snapshotId: null }, { stateVersion: null }, { itemType: 'PHRASE' }, { itemId: '1' }]) {
    const page = loadB10([{ data: reviewData() }])
    const card = {
      id: '9001-11', snapshotId: 9001, snapshotItemId: 11, sequenceNo: 1, itemType: 'VOCAB', itemId: 1,
      title: null, sourceReason: 'NEW', contentVersion: 'v1', contentVersionId: null, phonetic: null,
      hint: null, meaningCn: null, definitionEn: null, examples: [], masteryStatus: null, dueLocalDate: null,
      stateVersion: 0, revealed: true, reviewStatus: 'PENDING',
      ...patch,
    }
    await rejectsContract(page.api.submitSrsReview(context, card, 2, 'srs-review-abc'))
    assert.equal(page.requests.length, 0)
  }
})

test('sync envelope preserves per-event status/result and removes the legacy itemId before send', async () => {
  const page = loadB10([{
    data: {
      results: [
        { clientEventId: 'evt-0001', status: 'ACCEPTED', result: { data: reviewData() } },
        { clientEventId: 'evt-0002', status: 'REJECTED', errorCode: 'SRS_VERSION_CONFLICT' },
        { clientEventId: 'evt-0003', status: 'EXPIRED', result: { data: reviewData({ eventStatus: 'EXPIRED', stateVersion: 1 }) } },
      ],
    },
  }])
  const legacyEvent = {
    itemId: 1,
    snapshotId: 9001,
    snapshotItemId: 11,
    item: { itemType: 'VOCAB', vocabId: 1 },
    rawQuality: 3,
    answerOutcome: 'REVEALED_WITHOUT_ANSWER',
    responseTimeMs: 0,
    revealElapsedMs: 0,
    clientEventId: 'evt-0001',
    clientOccurredAt: '2026-11-04T00:00:00.000Z',
    baseStateVersion: 0,
  }
  const value = await page.api.syncSrsReviews(context, [legacyEvent], 'srs-sync-1')
  assert.equal(value.results.length, 3)
  assert.deepEqual(value.results.map((item) => item.status), ['ACCEPTED', 'REJECTED', 'EXPIRED'])
  assert.equal(value.results[0].result.eventStatus, 'ACCEPTED')
  assert.equal(value.results[0].result.srsState.stateVersion, 4)
  assert.equal(value.results[1].result, null)
  assert.equal(value.results[1].errorCode, 'SRS_VERSION_CONFLICT')
  assert.equal(value.results[2].result.eventStatus, 'EXPIRED')
  const sent = page.requests[0].options.data.events[0]
  assert.equal('itemId' in sent, false)
  assert.deepEqual(Object.keys(sent).sort(), [
    'answerOutcome', 'baseStateVersion', 'clientEventId', 'clientOccurredAt', 'item',
    'rawQuality', 'responseTimeMs', 'revealElapsedMs', 'snapshotId', 'snapshotItemId',
  ])
  assert.equal(page.requests[0].path, '/learning/srs/reviews:sync')
  assert.equal(page.requests[0].options.header['Idempotency-Key'], 'b10-srs-sync-1')
})

test('sync rejects unknown status, missing results and malformed nested review envelopes', async () => {
  const cases = [
    { data: {} },
    { data: { results: 'oops' } },
    { data: { results: [{ clientEventId: 'evt-0001', status: 'PENDING_SYNC' }] } },
    { data: { results: [{ clientEventId: 'evt-0001', status: 'ACCEPTED', result: { data: { status: 'ACCEPTED' } } }] } },
    { data: { results: [{ clientEventId: 'evt-0001', status: 'ACCEPTED', result: 7 }] } },
  ]
  for (const payload of cases) {
    const page = loadB10([payload])
    await rejectsContract(page.api.syncSrsReviews(context, [{
      snapshotId: 9001,
      snapshotItemId: 11,
      item: { itemType: 'VOCAB', vocabId: 1 },
      rawQuality: 3,
      answerOutcome: 'REVEALED_WITHOUT_ANSWER',
      clientEventId: 'evt-0001',
      clientOccurredAt: '2026-11-04T00:00:00.000Z',
      baseStateVersion: 0,
    }], 'srs-sync-1'))
  }
})

test('sync rejects non-contract event fields instead of silently accepting a schema edit', async () => {
  const page = loadB10([{ data: { results: [] } }])
  await rejectsContract(page.api.syncSrsReviews(context, [{
    snapshotId: 9001,
    snapshotItemId: 11,
    item: { itemType: 'VOCAB', vocabId: 1 },
    rawQuality: 3,
    answerOutcome: 'REVEALED_WITHOUT_ANSWER',
    quality: 3,
    clientEventId: 'evt-0001',
    clientOccurredAt: '2026-11-04T00:00:00.000Z',
    baseStateVersion: 0,
  }], 'srs-sync-1'))
  assert.equal(page.requests.length, 0)
})
