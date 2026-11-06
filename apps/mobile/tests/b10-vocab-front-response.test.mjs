import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const { reactive, ref } = require('vue')
const appRoot = path.resolve(import.meta.dirname, '..')

function realGrammarModule() {
  const dir = path.join(appRoot, 'src/domain')
  const source = fs.readFileSync(path.join(dir, 'grammar-page.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name !== './grammar-page-contract.mjs') throw new Error(`Unexpected grammar import ${name}`)
    return require(path.join(dir, 'grammar-page-contract.mjs'))
  }, module, module.exports)
  return module.exports
}

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

function loadB10(responses) {
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
  const apiModule = load('src/api/b10.ts', {
    './unavailable': { unavailableOperation: async () => { throw new Error('unavailable fixture') } },
    './client': { mobileApiClient, MobileApiError },
    '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
    './b3': { listGrammarExercises: async () => [] },
    '../domain/grammar-page': realGrammarModule(),
    '../platform/client-id': { createClientId: () => 'fixture-client-event' },
  })
  return { api: apiModule.b10LearningApi, requests }
}

const context = { uiLocale: 'zh-CN', contentLocale: 'en-US' }
const rejectsContract = (promise) => assert.rejects(promise, (error) => {
  assert.match(error.message, /接口契约/)
  return true
})

function frontPayload(overrides = {}) {
  return {
    data: {
      vocabularyId: 1,
      itemId: 1,
      title: 'learn',
      word: 'learn',
      frontHint: 'A1',
      contentLocale: 'en-US',
      contentVersion: 'v1',
      contentVersionId: 25001,
      availability: 'PUBLISHED',
      audioRef: '/audio/learn.mp3',
      phoneticUs: 'liːrn',
      phoneticUk: 'lɜːn',
      answerAvailable: false,
      meaningCn: '学习',
      definitionEn: 'to learn',
      definitions: [{ meaningCn: '学习', definitionEn: 'to learn' }],
      examples: [{ sentenceEn: 'I learn.', sentenceCn: '我学习。' }],
      back: {
        meaningCn: '学习',
        definitionEn: 'to learn',
        partOfSpeech: 'V',
        examples: [{ sentence: 'I learn.', translation: '我学习。' }],
        collocations: ['learn from'],
      },
      collocations: ['learn from'],
      srsState: { masteryStatus: 'LEARNING' },
      source: 'mysql',
      ...overrides,
    },
  }
}

function reviewCard(overrides = {}) {
  return {
    id: '9001-11',
    snapshotId: 9001,
    snapshotItemId: 11,
    sequenceNo: 1,
    itemType: 'VOCAB',
    itemId: 1,
    title: null,
    sourceReason: 'NEW',
    contentVersion: 'v1',
    contentVersionId: null,
    phoneticUs: null,
    phoneticUk: null,
    phonetic: null,
    audio: null,
    audioUrl: null,
    hint: null,
    meaningCn: null,
    definitionEn: null,
    definitions: [],
    examples: [],
    exampleItems: [],
    masteryStatus: null,
    dueLocalDate: null,
    stateVersion: 0,
    revealed: true,
    reviewStatus: 'PENDING',
    ...overrides,
  }
}

function capturedEvent(overrides = {}) {
  return {
    snapshotId: 9001,
    snapshotItemId: 11,
    item: { itemType: 'VOCAB', vocabId: 1 },
    rawQuality: 3,
    answerOutcome: 'REVEALED_WITHOUT_ANSWER',
    responseTimeMs: 0,
    revealElapsedMs: 0,
    clientEventId: 'captured-event-01',
    clientOccurredAt: '2026-11-04T00:00:00.000Z',
    baseStateVersion: 0,
    ...overrides,
  }
}

const reviewReceipt = {
  data: {
    reviewEventId: 501,
    eventStatus: 'ACCEPTED',
    riskDecision: 'ALLOW',
    effectiveQuality: 3,
    reconciled: false,
    stateVersion: 1,
    srsState: {
      srsStateId: 44,
      item: { itemType: 'VOCAB', vocabId: 1 },
      repetitionCount: 1,
      easeFactor: 2.5,
      intervalDays: 1,
      dueAt: '2026-11-05T00:00:00Z',
      dueLocalDate: '2026-11-05',
      masteryStatus: 'LEARNING',
      delayedVerifyStage: 'NONE',
      stateVersion: 1,
      riskBand: 'LOW',
      explanation: [],
    },
    rewardSettlementStatus: 'SETTLED',
    nextSnapshotItemId: null,
  },
}

test('vocabulary front keeps word, phonetics, audio, and version and drops answer fields', async () => {
  const page = loadB10([frontPayload({ audio: { us: '/audio/learn-us.mp3', uk: '/audio/learn-uk.mp3', bytes: 'AAAA' } })])
  const front = await page.api.getVocabularyFront(context, 1, 'v1')
  assert.deepEqual(Object.keys(front).sort(), ['audio', 'audioUrl', 'availability', 'contentVersion', 'contentVersionId', 'phonetic', 'phoneticUk', 'phoneticUs', 'vocabId', 'word'])
  assert.equal(front.word, 'learn')
  assert.equal(front.phoneticUs, 'liːrn')
  assert.equal(front.phoneticUk, 'lɜːn')
  assert.deepEqual(front.audio, { us: '/audio/learn-us.mp3', uk: '/audio/learn-uk.mp3' })
  assert.equal(front.audioUrl, '/audio/learn-us.mp3')
  assert.equal(front.contentVersion, 'v1')
  assert.equal(front.contentVersionId, 25001)
  assert.equal(front.availability, 'PUBLISHED')
  assert.equal(front.meaningCn, undefined)
  assert.equal(front.definitions, undefined)
  assert.equal(front.examples, undefined)
  assert.equal(front.back, undefined)
  assert.equal(front.collocations, undefined)
  assert.equal(front.srsState, undefined)
  assert.equal(front.answerAvailable, undefined)
  assert.equal(front.title, undefined)
  assert.equal(page.requests[0].path, '/content/learner/vocabulary/1?contentLocale=en-US&projection=front&contentVersion=v1')
  assert.equal(page.requests[0].options, undefined)
})

test('vocabulary front accepts the published B25 word and audio ref without meanings', async () => {
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
      answerAvailable: false,
      back: { meaningCn: '你好', definitionEn: 'greeting', examples: [{ sentence: 'Hello.', translation: '你好。' }], collocations: ['say hello'] },
      source: 'mysql',
    },
  }])
  const front = await page.api.getVocabularyFront(context, 'b25-item-001')
  assert.equal(front.vocabId, 'b25-item-001')
  assert.equal(front.word, 'hello')
  assert.equal(front.audio, null)
  assert.equal(front.audioUrl, 'fixture/core-foundation/audio-placeholder-v1')
  assert.equal(front.phoneticUs, null)
  assert.equal(front.contentVersion, null)
  assert.equal(front.contentVersionId, 25001)
  assert.equal(front.availability, 'PUBLISHED')
  assert.equal(page.requests[0].path, '/content/learner/vocabulary/b25-item-001?contentLocale=en-US&projection=front')
  assert.equal(JSON.stringify(front).includes('你好'), false)
})

test('vocabulary front rejects a missing word, unpublished availability, missing version, and numeric string id', async () => {
  const noWord = frontPayload(); delete noWord.data.word
  const revoked = frontPayload({ availability: 'REVOKED' })
  const noVersion = frontPayload(); delete noVersion.data.contentVersion; delete noVersion.data.contentVersionId
  const numericString = frontPayload({ vocabId: '1', vocabularyId: '1', itemId: '1' })
  for (const payload of [noWord, revoked, noVersion, numericString]) {
    const page = loadB10([payload])
    await rejectsContract(page.api.getVocabularyFront(context, 1, 'v1'))
  }
})

test('vocabulary detail stays on the back projection when front is requested separately', async () => {
  const page = loadB10([{
    data: {
      vocabId: 1,
      word: 'learn',
      definitions: [{ partOfSpeech: 'N', meaningCn: '学习', definitionEn: 'to learn' }],
      contentVersion: 'v1',
    },
  }])
  await page.api.getVocabularyDetail(context, 1, 'v1')
  assert.equal(page.requests[0].path, '/content/learner/vocabulary/1?contentLocale=en-US&contentVersion=v1')
  assert.equal(page.requests[0].path.includes('projection'), false)
})

test('captured review event is posted exactly and mismatches never reach the wire', async () => {
  const page = loadB10([reviewReceipt])
  await page.api.submitSrsReview(context, reviewCard(), 3, 'captured-event-01', capturedEvent())
  const request = page.requests[0]
  assert.equal(request.path, '/learning/srs/reviews')
  assert.equal(request.options.data.clientOccurredAt, '2026-11-04T00:00:00.000Z')
  assert.equal(request.options.data.clientEventId, 'captured-event-01')
  assert.equal(request.options.header['Idempotency-Key'], 'b10-captured-event-01')
  assert.equal(request.options.header['Accept-Language'], 'zh-CN')
  assert.equal(request.options.header['X-Content-Version'], 'v1')

  const mismatches = [
    capturedEvent({ clientEventId: 'other-event-id-01' }),
    capturedEvent({ rawQuality: 1 }),
    capturedEvent({ baseStateVersion: null }),
    capturedEvent({ snapshotId: 9002 }),
    capturedEvent({ item: { itemType: 'VOCAB', vocabId: 9 } }),
    capturedEvent({ forgedMastery: true }),
  ]
  for (const event of mismatches) {
    const rejected = loadB10([reviewReceipt])
    await rejectsContract(rejected.api.submitSrsReview(context, reviewCard(), 3, 'captured-event-01', event))
    assert.equal(rejected.requests.length, 0)
  }
  const untrusted = loadB10([reviewReceipt])
  await rejectsContract(untrusted.api.submitSrsReview(context, reviewCard({ stateVersion: null }), 3, 'captured-event-01', capturedEvent()))
  assert.equal(untrusted.requests.length, 0)
})

function deferred() {
  let resolve
  const promise = new Promise((yes) => { resolve = yes })
  return { promise, resolve }
}

function batchData(snapshotId = 9001) {
  return {
    data: {
      snapshotId,
      localDate: '2026-11-04',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      algorithmVersion: 'SRS-2',
      rulesVersion: 'RULES-1',
      contentVersion: 'v1',
      items: [
        { snapshotItemId: 11, sequenceNo: 1, item: { itemType: 'VOCAB', vocabId: 1 }, sourceReason: 'NEW', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1' },
        { snapshotItemId: 12, sequenceNo: 2, item: { itemType: 'VOCAB', vocabId: 2 }, sourceReason: 'DUE', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1' },
      ],
    },
  }
}

function recoveryBatch() {
  return {
    data: {
      snapshotId: 9001,
      localDate: '2026-11-04',
      contentEpoch: 1,
      cards: [],
      items: [],
      status: 'RECOVERY_REQUIRED',
      reasonCode: 'UNTRUSTED_REVIEW_EVIDENCE',
      source: 'learning-service',
    },
  }
}

const backVocab = (vocabId) => ({
  data: {
    vocabId,
    word: `back-${vocabId}`,
    definitions: [{ partOfSpeech: 'N', meaningCn: '释义', definitionEn: 'definition' }],
    examples: [{ sentenceEn: 'Example.', sentenceCn: '例句。' }],
    contentVersion: 'v1',
  },
})

function environment() {
  setActivePinia(createPinia())
  const storage = new Map()
  const runtime = {
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  }
  const session = reactive({ isAuthenticated: false, verifiedSubject: null, identityRevision: 0 })
  let sequence = 0
  const transport = {
    queue: [],
    requests: [],
    async request(requestPath, options) {
      transport.requests.push({ path: requestPath, options })
      const next = transport.queue.shift()
      if (next === undefined) throw new Error(`No fixture response for ${requestPath}`)
      if (next instanceof Error) throw next
      return typeof next === 'function' ? next({ path: requestPath, options }) : next
    },
  }
  class MobileApiError extends Error {
    constructor(message, status = 0, details = null) { super(message); this.status = status; this.details = details }
  }
  const apiModule = load('src/api/b10.ts', {
    './unavailable': { unavailableOperation: async () => { throw new Error('unavailable fixture') } },
    './client': { mobileApiClient: { request: transport.request }, MobileApiError },
    '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
    './b3': { listGrammarExercises: async () => [] },
    '../domain/grammar-page': realGrammarModule(),
    '../platform/client-id': { createClientId: () => `evt-${String(++sequence).padStart(4, '0')}` },
  })
  const cache = load('src/stores/learning-cache.ts', { '../platform/uni-runtime': { getUniRuntime: () => runtime } })
  const storeModule = load('src/stores/b10-learning.ts', {
    vue: require('vue'),
    pinia: require('pinia'),
    '../api/b10': apiModule,
    '../platform/b10-foundation': { b10ContentLocale: ref('en-US'), b10UiLocale: ref('zh-CN') },
    '../platform/uni-runtime': { getUniRuntime: () => runtime },
    './session': { useSessionStore: () => session },
    './learning-cache': cache,
  })
  const store = storeModule.useB10LearningStore()
  function login(subject, revision = 1) {
    session.isAuthenticated = true
    session.verifiedSubject = subject
    session.identityRevision = revision
  }
  function switchIdentity(subject, revision) {
    session.verifiedSubject = subject
    session.identityRevision = revision
  }
  return { store, login, switchIdentity, transport, MobileApiError }
}

function vocabularyRequests(env) {
  return env.transport.requests.filter((request) => request.path.includes('/content/learner/vocabulary/'))
}

async function loadReady(env, payload = batchData()) {
  env.login('front-owner')
  env.transport.queue.push(payload)
  await env.store.loadSrs()
  return env.store.batch
}

test('front query precedes back intent and answer fields stay off the front card', async () => {
  const env = environment()
  const batch = await loadReady(env)
  const card = batch.items[0]
  const versionBefore = card.stateVersion
  env.transport.queue.push(frontPayload())
  await env.store.loadCurrentFront()
  assert.equal(vocabularyRequests(env).length, 1)
  const front = vocabularyRequests(env)[0]
  assert.equal(front.path, '/content/learner/vocabulary/1?contentLocale=en-US&projection=front&contentVersion=v1')
  assert.doesNotMatch(front.path, /meaning|definition|example|collocation|answer|back/i)
  assert.equal(front.options, undefined)
  assert.equal(card.title, 'learn')
  assert.equal(card.phoneticUs, 'liːrn')
  assert.equal(card.audio, null)
  assert.equal(card.audioUrl, '/audio/learn.mp3')
  assert.equal(card.contentVersion, 'v1')
  assert.equal(card.contentVersionId, 25001)
  assert.equal(card.meaningCn, null)
  assert.equal(card.definitionEn, null)
  assert.deepEqual(card.definitions, [])
  assert.deepEqual(card.examples, [])
  assert.equal(card.hint, null)
  assert.equal(card.revealed, false)
  assert.equal(card.stateVersion, versionBefore)
  assert.equal(JSON.stringify(card).includes('学习'), false)
  assert.equal(card.title.includes('学习项'), false)

  env.transport.queue.push(backVocab(1))
  await env.store.revealCard(card)
  assert.equal(vocabularyRequests(env).length, 2)
  const back = vocabularyRequests(env)[1]
  assert.equal(back.path, '/content/learner/vocabulary/1?contentLocale=en-US&contentVersion=v1')
  assert.equal(back.path.includes('projection'), false)
  assert.equal(card.revealed, true)
  assert.equal(card.meaningCn, '释义')
})

test('duplicate front calls issue one request and a later card does not reuse the previous front', async () => {
  const env = environment()
  const batch = await loadReady(env)
  const first = batch.items[0]
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const left = env.store.loadCurrentFront()
  const right = env.store.loadCurrentFront()
  assert.equal(vocabularyRequests(env).length, 1)
  held.resolve(frontPayload())
  await Promise.all([left, right])
  assert.equal(vocabularyRequests(env).length, 1)
  await env.store.loadCurrentFront()
  assert.equal(vocabularyRequests(env).length, 1)

  env.store.currentIndex = 1
  const second = batch.items[1]
  assert.equal(second.title, null)
  assert.equal(second.stateVersion, null)
  env.transport.queue.push(frontPayload({ vocabularyId: 2, itemId: 2, word: 'recall', audioRef: null, phoneticUs: null, phoneticUk: null }))
  await env.store.loadCurrentFront()
  assert.equal(vocabularyRequests(env).length, 2)
  assert.equal(vocabularyRequests(env)[1].path, '/content/learner/vocabulary/2?contentLocale=en-US&projection=front&contentVersion=v1')
  assert.equal(second.title, 'recall')
  assert.equal(second.audioUrl, null)
  assert.equal(second.stateVersion, null)
  assert.equal(second.meaningCn, null)
  assert.equal(first.title, 'learn')
  assert.equal(first.itemId === second.itemId, false)
})

test('front 401, 403, stale, and missing fields leave the card closed', async () => {
  for (const [status, kind] of [[401, 'forbidden'], [403, 'forbidden'], [410, 'stale']]) {
    const env = environment()
    const batch = await loadReady(env)
    const card = batch.items[0]
    env.transport.queue.push(new env.MobileApiError('closed', status, null))
    await env.store.loadCurrentFront()
    assert.equal(card.title, null)
    assert.equal(card.meaningCn, null)
    assert.equal(card.revealed, false)
    assert.equal(env.store.status, kind)
    if (status === 410) assert.equal(card.reviewStatus, 'STALE')
  }
  const env = environment()
  const batch = await loadReady(env)
  const card = batch.items[0]
  const missing = frontPayload(); delete missing.data.word
  env.transport.queue.push(missing)
  await env.store.loadCurrentFront()
  assert.equal(card.title, null)
  assert.equal(card.meaningCn, null)
  assert.equal(env.store.status, 'stale')
  assert.match(env.store.message, /契约/)
})

test('a held front cannot populate a replaced batch or a new subject revision', async () => {
  const env = environment()
  const batch = await loadReady(env)
  const oldCard = batch.items[0]
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const pending = env.store.loadCurrentFront(oldCard)
  env.transport.queue.push(batchData(9002))
  await env.store.loadSrs()
  const replaced = env.store.batch.items[0]
  held.resolve(frontPayload({ word: 'secret-a' }))
  await pending
  assert.notEqual(replaced, oldCard)
  assert.equal(replaced.title, null)
  assert.equal(replaced.meaningCn, null)
  assert.deepEqual(replaced.definitions, [])
  assert.equal(oldCard.title, null)

  const revision = environment()
  await loadReady(revision)
  const previous = revision.store.batch.items[0]
  const heldRevision = deferred()
  revision.transport.queue.push(() => heldRevision.promise)
  const revisionPending = revision.store.loadCurrentFront(previous)
  revision.switchIdentity('front-owner', 2)
  revision.transport.queue.push(batchData(9003))
  await revision.store.loadSrs()
  heldRevision.resolve(frontPayload({ word: 'secret-b', meaningCn: '泄漏' }))
  await revisionPending
  assert.equal(revision.store.batch.items[0].title, null)
  assert.equal(revision.store.batch.items[0].meaningCn, null)
  assert.equal(previous.title, null)

  const other = environment()
  await loadReady(other)
  const foreign = other.store.batch.items[0]
  const heldOther = deferred()
  other.transport.queue.push(() => heldOther.promise)
  const otherPending = other.store.loadCurrentFront(foreign)
  other.switchIdentity('other-owner', 1)
  other.transport.queue.push(batchData(9004))
  await other.store.loadSrs()
  heldOther.resolve(frontPayload({ word: 'secret-c' }))
  await otherPending
  assert.equal(other.store.batch.items[0].title, null)
  assert.equal(foreign.title, null)
})

test('front version or vocabulary id mismatches do not write the card', async () => {
  const mismatch = environment()
  const batch = await loadReady(mismatch)
  const card = batch.items[0]
  mismatch.transport.queue.push(frontPayload({ contentVersion: 'v2', word: 'other' }))
  await mismatch.store.loadCurrentFront()
  assert.equal(card.title, null)
  assert.equal(card.contentVersion, 'v1')
  assert.equal(mismatch.store.status, 'stale')

  const wrongId = environment()
  const wrongBatch = await loadReady(wrongId)
  const wrongCard = wrongBatch.items[0]
  wrongId.transport.queue.push(frontPayload({ vocabularyId: 99, itemId: 99, vocabId: 99, word: 'other' }))
  await wrongId.store.loadCurrentFront()
  assert.equal(wrongCard.title, null)
  assert.equal(wrongCard.meaningCn, null)
  assert.equal(wrongId.store.status, 'stale')
})

test('an empty recovery batch keeps its reason and does not fetch a front', async () => {
  const env = environment()
  const batch = await loadReady(env, recoveryBatch())
  assert.equal(env.store.status, 'stale')
  assert.equal(env.store.message, '复习记录待核验，暂不可结算。')
  assert.notEqual(env.store.status, 'empty')
  assert.equal(batch.status, 'RECOVERY_REQUIRED')
  assert.equal(batch.reasonCode, 'UNTRUSTED_REVIEW_EVIDENCE')
  assert.equal(batch.items.length, 0)
  await env.store.loadCurrentFront()
  assert.equal(vocabularyRequests(env).length, 0)
  assert.equal(env.store.currentCard, null)
})
