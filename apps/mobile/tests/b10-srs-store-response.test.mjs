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

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

const srsState = (card, overrides = {}) => ({
  srsStateId: 44,
  item: { itemType: card.itemType, vocabId: card.itemId },
  repetitionCount: 1,
  easeFactor: 2.5,
  intervalDays: 1,
  dueAt: '2026-11-05T00:00:00Z',
  dueLocalDate: '2026-11-05',
  masteryStatus: 'LEARNING',
  delayedVerifyStage: 'D1_PENDING',
  stateVersion: (card.stateVersion ?? 0) + 1,
  riskBand: 'LOW',
  explanation: ['algorithm=SRS-2'],
  ...overrides,
})

const receipt = (card, overrides = {}) => {
  const state = overrides.srsState === undefined ? srsState(card) : overrides.srsState
  const stateVersion = overrides.stateVersion === undefined ? (state?.stateVersion ?? (card.stateVersion ?? 0) + 1) : overrides.stateVersion
  const value = {
    reviewEventId: 501,
    eventStatus: 'ACCEPTED',
    riskDecision: 'ALLOW',
    effectiveQuality: 3,
    reconciled: false,
    stateVersion,
    srsState: state,
    rewardSettlementStatus: 'SETTLED',
    nextSnapshotItemId: null,
    ...overrides,
  }
  return value
}

function batchData() {
  return {
    data: {
      snapshotId: 9001,
      localDate: '2026-11-04',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      algorithmVersion: 'SRS-2',
      rulesVersion: 'RULES-1',
      contentVersion: 'v1',
      items: [
        { snapshotItemId: 11, sequenceNo: 1, item: { itemType: 'VOCAB', vocabId: 1 }, sourceReason: 'NEW', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1' },
        { snapshotItemId: 12, sequenceNo: 2, item: { itemType: 'VOCAB', vocabId: 2 }, sourceReason: 'NEW', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1', srsState: { srsStateId: 40, item: { itemType: 'VOCAB', vocabId: 2 }, repetitionCount: 2, easeFactor: 2.5, intervalDays: 3, dueAt: '2026-11-04T00:00:00Z', dueLocalDate: '2026-11-04', masteryStatus: 'LEARNING', stateVersion: 5, riskBand: 'LOW', explanation: [] } },
        { snapshotItemId: 13, sequenceNo: 3, item: { itemType: 'VOCAB', vocabId: 3 }, sourceReason: 'NEW', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1' },
        { snapshotItemId: 14, sequenceNo: 4, item: { itemType: 'VOCAB', vocabId: 4 }, sourceReason: 'DUE', plannedLocalDate: '2026-11-04', status: 'PENDING', contentVersion: 'v1' },
      ],
    },
  }
}

const vocabData = (vocabId, word = `word-${vocabId}`) => ({
  data: { vocabId, word, definitions: [{ partOfSpeech: 'N', meaningCn: '释义', definitionEn: 'definition' }], examples: [{ sentenceEn: 'Example.', sentenceCn: '例句。' }], contentVersion: 'v1' },
})

function environment(initialStorage) {
  setActivePinia(createPinia())
  const storage = initialStorage instanceof Map ? initialStorage : new Map()
  const runtime = {
    getStorageSync: (key) => storage.get(key) ?? '',
    setStorageSync: (key, value) => storage.set(key, value),
    removeStorageSync: (key) => storage.delete(key),
  }
  const platform = { getUniRuntime: () => runtime }
  const session = reactive({ isAuthenticated: false, verifiedSubject: null, identityRevision: 0, sessionId: null })
  const sessionModule = { useSessionStore: () => session }
  let sequence = 0
  const createClientId = () => `evt-${String(++sequence).padStart(4, '0')}`
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
    '../platform/client-id': { createClientId },
  })
  const cache = load('src/stores/learning-cache.ts', { '../platform/uni-runtime': platform })
  const storeModule = load('src/stores/b10-learning.ts', {
    vue: require('vue'),
    pinia: require('pinia'),
    '../api/b10': apiModule,
    '../platform/b10-foundation': { b10ContentLocale: ref('en-US'), b10UiLocale: ref('zh-CN') },
    '../platform/uni-runtime': platform,
    './session': sessionModule,
    './learning-cache': cache,
  })
  const store = storeModule.useB10LearningStore()
  function login(subject, revision = 1, sessionId = null) {
    // acceptPermissions publishes subject, sessionId, and revision before status becomes authenticated.
    session.verifiedSubject = subject
    if (sessionId !== null) session.sessionId = sessionId
    session.identityRevision = revision
    session.isAuthenticated = true
  }
  function switchIdentity(subject, revision) {
    session.verifiedSubject = subject
    session.identityRevision = revision
  }
  return { store, session, login, switchIdentity, transport, storage, cache, apiModule, storeModule, MobileApiError, setActivePinia, createPinia }
}

async function loadBatch(env) {
  env.transport.queue.push(batchData())
  await env.store.loadSrs()
  return env.store.batch
}

async function reveal(env, card) {
  env.transport.queue.push(vocabData(card.itemId))
  await env.store.revealCard(card)
}

function requestsTo(env, suffix) {
  return env.transport.requests.filter((request) => request.path.endsWith(suffix))
}

test('ACCEPTED is settled only from a matching nested srsState receipt', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push({ data: receipt(card) })
  await env.store.rateCard(3, card)
  assert.equal(env.store.queueCount ?? env.store.srsQueueCount, 0)
  assert.equal(card.reviewStatus, 'ACCEPTED')
  assert.equal(card.masteryStatus, 'LEARNING')
  assert.equal(card.dueLocalDate, '2026-11-05')
  assert.equal(card.stateVersion, 1)
  assert.equal(env.store.currentIndex, 1)
  const request = requestsTo(env, '/learning/srs/reviews')[0]
  assert.equal(request.options.data.baseStateVersion, 0)
  assert.equal('itemId' in request.options.data, false)
  assert.deepEqual(request.options.data.item, { itemType: 'VOCAB', vocabId: 1 })
})

test('DUPLICATE with matching receipt id settles once without a second score mutation', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push({ data: receipt(card, { eventStatus: 'DUPLICATE' }) })
  await env.store.rateCard(2, card)
  assert.equal(card.reviewStatus, 'ACCEPTED')
  assert.equal(card.stateVersion, 1)
  assert.equal(env.store.currentIndex, 1)
  await env.store.rateCard(3, card)
  assert.equal(requestsTo(env, '/learning/srs/reviews').length, 1)
})

test('missing/mismatched receipt state stays stale and never advances or updates mastery', async () => {
  const cases = [
    { srsState: null },
    { srsState: srsState({ vocabId: 999 }, { item: { itemType: 'VOCAB', vocabId: 999 } }) },
    { srsState: srsState({ itemId: 1 }, { stateVersion: 9 }), stateVersion: 1 },
  ]
  for (const patch of cases) {
    const env = environment()
    env.login('A')
    const batch = await loadBatch(env)
    const card = batch.items[0]
    await reveal(env, card)
    env.transport.queue.push({ data: receipt(card, patch) })
    await env.store.rateCard(3, card)
    assert.notEqual(card.reviewStatus, 'ACCEPTED')
    assert.equal(card.masteryStatus, null)
    assert.equal(card.stateVersion, 0)
    assert.equal(env.store.currentIndex, 0)
    assert.equal(env.store.srsQueueCount, 0)
  }
})

test('CONFLICT/EXPIRED/RISK_FILTERED/REJECTED never settle or advance', async () => {
  for (const eventStatus of ['CONFLICT', 'EXPIRED', 'RISK_FILTERED', 'REJECTED']) {
    const env = environment()
    env.login('A')
    const batch = await loadBatch(env)
    const card = batch.items[0]
    await reveal(env, card)
    env.transport.queue.push({ data: receipt(card, { eventStatus }) })
    await env.store.rateCard(3, card)
    assert.notEqual(card.reviewStatus, 'ACCEPTED')
    assert.equal(card.masteryStatus, null)
    assert.equal(env.store.currentIndex, 0)
    assert.equal(env.store.srsQueueCount, 0)
  }
})

test('unknown eventStatus and missing/version-null receipts are blocked as stale', async () => {
  const variants = [
    { eventStatus: 'NOT_A_STATUS' },
    { reviewEventId: undefined },
    { stateVersion: undefined },
    { stateVersion: null },
    { srsState: srsState({}, { stateVersion: null }), stateVersion: null },
  ]
  for (const patch of variants) {
    const env = environment()
    env.login('A')
    const batch = await loadBatch(env)
    const card = batch.items[0]
    await reveal(env, card)
    env.transport.queue.push({ data: receipt(card, patch) })
    await env.store.rateCard(3, card)
    assert.equal(card.reviewStatus, 'STALE')
    assert.equal(card.masteryStatus, null)
    assert.equal(env.store.currentIndex, 0)
  }
})

test('a card without a trusted state version is blocked before the wire', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[3]
  await reveal(env, card)
  await env.store.rateCard(3, card)
  assert.equal(requestsTo(env, '/learning/srs/reviews').length, 0)
  assert.equal(card.reviewStatus, 'STALE')
  assert.equal(card.masteryStatus, null)
  assert.equal(env.store.currentIndex, 0)
})

test('offline queues the exact payload/clientEventId and a different rating cannot mutate it', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, card)
  assert.equal(card.reviewStatus, 'QUEUED')
  assert.equal(card.masteryStatus, null)
  assert.equal(card.stateVersion, 0)
  assert.equal(env.store.currentIndex, 0)
  assert.equal(env.store.srsQueueCount, 1)
  const queued = env.store.queuedReviews[0]
  const originalPayload = JSON.stringify(queued.payload)
  const originalId = queued.clientEventId
  await env.store.rateCard(0, card)
  await env.store.rateCard(3, card)
  assert.equal(env.store.queuedReviews[0].clientEventId, originalId)
  assert.equal(JSON.stringify(env.store.queuedReviews[0].payload), originalPayload)
  assert.equal(env.store.currentIndex, 0)

  env.transport.queue.push({ data: { results: [{ clientEventId: originalId, status: 'ACCEPTED', result: { data: receipt(card) } }] } })
  await env.store.syncSrs()
  const syncRequest = requestsTo(env, ':sync')[0]
  assert.equal(syncRequest.options.data.events[0].clientEventId, originalId)
  assert.equal(syncRequest.options.data.events[0].rawQuality, 3)
  assert.equal('itemId' in syncRequest.options.data.events[0], false)
  assert.equal(card.reviewStatus, 'ACCEPTED')
  assert.equal(env.store.srsQueueCount, 0)
})

test('sync settles by clientEventId even when results are reordered, partial or duplicated', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  for (const index of [0, 1]) {
    const card = batch.items[index]
    await reveal(env, card)
    env.transport.queue.push(new TypeError('offline'))
    await env.store.rateCard(3, card)
  }
  const [first, second] = env.store.queuedReviews
  env.transport.queue.push({
    data: {
      results: [
        { clientEventId: second.clientEventId, status: 'ACCEPTED', result: { data: receipt(batch.items[1]) } },
        { clientEventId: first.clientEventId, status: 'ACCEPTED', result: { data: receipt(batch.items[0]) } },
      ],
    },
  })
  await env.store.syncSrs()
  assert.equal(env.store.srsQueueCount, 0)
  assert.equal(batch.items[0].reviewStatus, 'ACCEPTED')
  assert.equal(batch.items[1].reviewStatus, 'ACCEPTED')
  assert.equal(batch.items[0].stateVersion, 1)
  assert.equal(batch.items[1].stateVersion, 6)

  const duplicateEnv = environment()
  duplicateEnv.login('A')
  const duplicateBatch = await loadBatch(duplicateEnv)
  for (const index of [0, 1]) {
    await reveal(duplicateEnv, duplicateBatch.items[index])
    duplicateEnv.transport.queue.push(new TypeError('offline'))
    await duplicateEnv.store.rateCard(3, duplicateBatch.items[index])
  }
  const [dupFirst, dupSecond] = duplicateEnv.store.queuedReviews
  duplicateEnv.transport.queue.push({
    data: {
      results: [
        { clientEventId: dupFirst.clientEventId, status: 'ACCEPTED', result: { data: receipt(duplicateBatch.items[0]) } },
        { clientEventId: dupFirst.clientEventId, status: 'ACCEPTED', result: { data: receipt(duplicateBatch.items[0]) } },
      ],
    },
  })
  await duplicateEnv.store.syncSrs()
  assert.equal(duplicateEnv.store.srsQueueCount, 2)
  assert.notEqual(duplicateBatch.items[0].reviewStatus, 'ACCEPTED')
  assert.equal(duplicateBatch.items[1].reviewStatus, 'QUEUED')

  const missingEnv = environment()
  missingEnv.login('A')
  const missingBatch = await loadBatch(missingEnv)
  for (const index of [0, 1]) {
    await reveal(missingEnv, missingBatch.items[index])
    missingEnv.transport.queue.push(new TypeError('offline'))
    await missingEnv.store.rateCard(3, missingBatch.items[index])
  }
  missingEnv.transport.queue.push({ data: { results: [{ clientEventId: missingBatch.items[0] && missingEnv.store.queuedReviews[1].clientEventId, status: 'ACCEPTED', result: { data: receipt(missingBatch.items[1]) } }] } })
  await missingEnv.store.syncSrs()
  assert.equal(missingEnv.store.srsQueueCount, 1)
  assert.equal(missingBatch.items[1].reviewStatus, 'ACCEPTED')
  assert.equal(missingBatch.items[0].reviewStatus, 'QUEUED')
})

test('unknown sync status and a lower receipt version keep the event pending', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[1]
  await reveal(env, card)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, card)
  const id = env.store.queuedReviews[0].clientEventId
  env.transport.queue.push({ data: { results: [{ clientEventId: id, status: 'PENDING_SYNC' }] } })
  await env.store.syncSrs()
  assert.equal(env.store.srsQueueCount, 1)
  assert.notEqual(card.reviewStatus, 'ACCEPTED')
  assert.equal(card.stateVersion, 5)

  env.transport.queue.push({ data: { results: [{ clientEventId: id, status: 'ACCEPTED', result: { data: receipt(card, { stateVersion: 4 }) } }] } })
  await env.store.syncSrs()
  assert.equal(env.store.srsQueueCount, 1)
  assert.notEqual(card.reviewStatus, 'ACCEPTED')
  assert.equal(card.stateVersion, 5)
})

test('sync wrapper ACCEPTED without a verified nested receipt keeps the event pending', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, card)
  env.transport.queue.push({ data: { results: [{ clientEventId: env.store.queuedReviews[0].clientEventId, status: 'ACCEPTED', result: null }] } })
  await env.store.syncSrs()
  assert.equal(env.store.srsQueueCount, 1)
  assert.notEqual(card.reviewStatus, 'ACCEPTED')
  assert.equal(card.stateVersion, 0)
  assert.equal(card.masteryStatus, null)
})

test('a held sync response across an identity change cannot settle or persist under the new identity', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, card)
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const pending = env.store.syncSrs()
  env.switchIdentity('A', 2)
  held.resolve({ data: { results: [{ clientEventId: 'evt-0001', status: 'ACCEPTED', result: { data: receipt(card) } }] } })
  await pending
  assert.equal(env.store.srsQueueCount, 0)
  assert.equal(env.store.batch, null)
  assert.equal(env.storage.get('yx.b10.mobile.learning.v1'), undefined)
  assert.notEqual(card.reviewStatus, 'ACCEPTED')
})

test('a new event queued while sync is in flight is never deleted', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  await reveal(env, batch.items[0])
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, batch.items[0])
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const sync = env.store.syncSrs()
  await reveal(env, batch.items[1])
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, batch.items[1])
  assert.equal(env.store.srsQueueCount, 2)
  held.resolve({ data: { results: [{ clientEventId: env.store.queuedReviews[0].clientEventId, status: 'ACCEPTED', result: { data: receipt(batch.items[0]) } }] } })
  await sync
  assert.equal(env.store.srsQueueCount, 1)
  assert.equal(env.store.queuedReviews[0].cardId, batch.items[1].id)
})

test('old identity queue is private, cleared on revision/subject change and never synced under B', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  await reveal(env, batch.items[0])
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, batch.items[0])
  assert.equal(env.store.srsQueueCount, 1)
  assert.ok(env.storage.get('yx.b10.mobile.learning.v1'))
  const requestsBefore = env.transport.requests.length
  env.switchIdentity('A', 2)
  assert.equal(env.store.srsQueueCount, 0)
  assert.equal(env.store.batch, null)
  assert.equal(env.storage.get('yx.b10.mobile.learning.v1'), undefined)
  await env.store.syncSrs()
  assert.equal(env.transport.requests.length, requestsBefore)

  const other = environment()
  other.login('A')
  const otherBatch = await loadBatch(other)
  await reveal(other, otherBatch.items[0])
  other.transport.queue.push(new TypeError('offline'))
  await other.store.rateCard(3, otherBatch.items[0])
  other.switchIdentity('B', 1)
  assert.equal(other.store.srsQueueCount, 0)
  assert.equal(other.store.batch, null)
  assert.equal(other.storage.get('yx.b10.mobile.learning.v1'), undefined)
  await other.store.syncSrs()
  assert.equal(other.transport.requests.filter((request) => request.path.endsWith(':sync')).length, 0)
})

test('restore drops a queue persisted for an older identity revision', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, card)
  const saved = env.storage.get('yx.b10.mobile.learning.v1')
  assert.ok(saved)
  env.switchIdentity('A', 2)
  env.storage.set('yx.b10.mobile.learning.v1', saved)
  env.setActivePinia(env.createPinia())
  const restoredStore = env.storeModule.useB10LearningStore()
  restoredStore.restore()
  assert.equal(restoredStore.srsQueueCount, 0)
  assert.equal(restoredStore.batch, null)
  assert.equal(env.storage.get('yx.b10.mobile.learning.v1'), undefined)
})

test('a held rate response across an identity change cannot settle or persist under the new identity', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const pending = env.store.rateCard(3, card)
  env.switchIdentity('A', 2)
  held.resolve({ data: receipt(card) })
  await pending
  assert.equal(env.store.srsQueueCount, 0)
  assert.equal(env.store.batch, null)
  assert.equal(env.storage.get('yx.b10.mobile.learning.v1'), undefined)
  assert.notEqual(card.reviewStatus, 'ACCEPTED')
})

test('repeated card taps issue one review request and one settle', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  await reveal(env, card)
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const first = env.store.rateCard(3, card)
  const second = env.store.rateCard(2, card)
  assert.equal(requestsTo(env, '/learning/srs/reviews').length, 1)
  held.resolve({ data: receipt(card) })
  await Promise.all([first, second])
  assert.equal(requestsTo(env, '/learning/srs/reviews').length, 1)
  assert.equal(card.reviewStatus, 'ACCEPTED')
  assert.equal(env.store.currentIndex, 1)
})

test('repeated sync taps and repeated reveal taps issue one request each', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  await reveal(env, batch.items[0])
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, batch.items[0])
  const syncHeld = deferred()
  env.transport.queue.push(() => syncHeld.promise)
  const firstSync = env.store.syncSrs()
  const secondSync = env.store.syncSrs()
  assert.equal(requestsTo(env, ':sync').length, 1)
  syncHeld.resolve({ data: { results: [{ clientEventId: env.store.queuedReviews[0].clientEventId, status: 'ACCEPTED', result: { data: receipt(batch.items[0]) } }] } })
  await Promise.all([firstSync, secondSync])
  assert.equal(requestsTo(env, ':sync').length, 1)

  const revealHeld = deferred()
  env.transport.queue.push(() => revealHeld.promise)
  const firstReveal = env.store.revealCard(batch.items[1])
  const secondReveal = env.store.revealCard(batch.items[1])
  assert.equal(env.transport.requests.filter((request) => request.path.includes('/content/learner/vocabulary/2')).length, 1)
  revealHeld.resolve(vocabData(2))
  await Promise.all([firstReveal, secondReveal])
  assert.equal(batch.items[1].revealed, true)
})

test('current batch replacement during reveal cannot mutate the new page', async () => {
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const card = batch.items[0]
  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const pending = env.store.revealCard(card)
  env.transport.queue.push(batchData())
  await env.store.loadSrs()
  held.resolve(vocabData(1))
  await pending
  assert.notEqual(env.store.batch.items[0], card)
  assert.equal(env.store.batch.items[0].revealed, false)
})

const STORAGE_KEY = 'yx.b10.mobile.learning.v1'

test('cold verified same-owner restore keeps the queued payload when the new revision differs', async () => {
  const before = environment()
  before.login('A', 4)
  const batch = await loadBatch(before)
  await reveal(before, batch.items[0])
  before.transport.queue.push(new TypeError('offline'))
  await before.store.rateCard(3, batch.items[0])
  assert.equal(before.store.srsQueueCount, 1)
  const queued = before.store.queuedReviews[0]
  before.store.currentIndex = 2
  before.store.practice = { sessionId: 'practice-A', status: 'IN_PROGRESS', exercises: [], answerSheet: [], lastCheckpointSeq: 0, stateVersion: 2 }
  before.store.report = { reportId: 'report-A', status: 'READY' }
  before.store.persist()
  const saved = JSON.parse(before.storage.get(STORAGE_KEY))
  assert.equal(saved.revision, 4)
  assert.equal(saved.sessionId, undefined)
  assert.equal(Object.hasOwn(saved, 'accessToken'), false)

  const after = environment(before.storage)
  assert.ok(after.storage.has(STORAGE_KEY))
  after.login('A', 1)
  after.store.restore()
  assert.equal(after.store.srsQueueCount, 1)
  assert.equal(after.store.queuedReviews[0].clientEventId, queued.clientEventId)
  assert.equal(JSON.stringify(after.store.queuedReviews[0].payload), JSON.stringify(queued.payload))
  assert.equal(after.store.practice.sessionId, 'practice-A')
  assert.equal(after.store.report.reportId, 'report-A')
  assert.equal(after.store.batch.snapshotId, 9001)
  assert.equal(after.store.currentIndex, 2)
  assert.equal(after.storage.has(STORAGE_KEY), true)
})

test('matching sessionId keeps a queued payload when a new process revision differs', async () => {
  const before = environment()
  before.login('A', 7, 'sess-same')
  const batch = await loadBatch(before)
  await reveal(before, batch.items[0])
  before.transport.queue.push(new TypeError('offline'))
  await before.store.rateCard(3, batch.items[0])
  const queued = before.store.queuedReviews[0]
  const saved = JSON.parse(before.storage.get(STORAGE_KEY))
  assert.equal(saved.sessionId, 'sess-same')
  assert.equal(saved.revision, 7)

  const after = environment(before.storage)
  after.login('A', 2, 'sess-same')
  after.setActivePinia(after.createPinia())
  const restoredStore = after.storeModule.useB10LearningStore()
  restoredStore.restore()
  assert.equal(restoredStore.srsQueueCount, 1)
  assert.equal(restoredStore.queuedReviews[0].clientEventId, queued.clientEventId)
  assert.equal(JSON.stringify(restoredStore.queuedReviews[0].payload), JSON.stringify(queued.payload))
  assert.equal(after.storage.has(STORAGE_KEY), true)
})

test('a different sessionId drops the previous owner cache', async () => {
  const before = environment()
  before.login('A', 3, 'sess-a')
  const batch = await loadBatch(before)
  await reveal(before, batch.items[0])
  before.transport.queue.push(new TypeError('offline'))
  await before.store.rateCard(3, batch.items[0])
  const saved = JSON.parse(before.storage.get(STORAGE_KEY))
  saved.practice = { sessionId: 'practice-A', status: 'IN_PROGRESS', exercises: [], answerSheet: [], lastCheckpointSeq: 0, stateVersion: 1 }
  before.storage.set(STORAGE_KEY, JSON.stringify(saved))

  const after = environment(before.storage)
  after.login('A', 3, 'sess-b')
  after.store.restore()
  assert.equal(after.store.srsQueueCount, 0)
  assert.equal(after.store.batch, null)
  assert.equal(after.store.practice, null)
  assert.equal(after.storage.get(STORAGE_KEY), undefined)
})

test('legacy pre-revision cache migrates exact wire events and owner facts without a cursor', async () => {
  const env = environment()
  env.login('A', 1)
  const wirePayload = {
    snapshotId: 9001,
    snapshotItemId: 11,
    item: { itemType: 'VOCAB', vocabId: 1 },
    rawQuality: 3,
    answerOutcome: 'REVEALED_WITHOUT_ANSWER',
    responseTimeMs: 0,
    revealElapsedMs: 0,
    clientEventId: 'evt-legacy-1',
    clientOccurredAt: '2026-11-04T00:00:00.000Z',
    baseStateVersion: 0,
  }
  const wire = { clientEventId: 'evt-legacy-1', cardId: '9001-11', payload: wirePayload }
  const duplicate = { clientEventId: 'evt-legacy-1', cardId: '9001-11', payload: { ...wirePayload } }
  const unsupported = { clientEventId: 'evt-unsupported', cardId: '9001-12', payload: { clientEventId: 'evt-unsupported', itemId: 12, eventStatus: 'ACCEPTED' } }
  const missingVersion = { clientEventId: 'evt-no-version', cardId: '9001-13', payload: { clientEventId: 'evt-no-version', snapshotId: 9001, snapshotItemId: 13, item: { itemType: 'VOCAB', vocabId: 3 }, rawQuality: 2, answerOutcome: 'UNANSWERED', clientOccurredAt: '2026-11-04T00:00:00.000Z' } }
  env.storage.set(STORAGE_KEY, JSON.stringify({
    subject: 'A',
    batch: { snapshotId: 9001, items: [{ id: '9001-11', reviewStatus: 'ACCEPTED' }] },
    currentIndex: 3,
    queuedReviews: [wire, duplicate, unsupported, missingVersion],
    practice: { sessionId: 'legacy-practice', status: 'IN_PROGRESS', exercises: [], answerSheet: [], lastCheckpointSeq: 0, stateVersion: 1 },
    answers: { 42: { selectedKey: 'A' } },
    mistakes: [{ mistakeId: 7 }],
    report: { reportId: 'legacy-report', status: 'READY' },
  }))
  env.store.restore()
  assert.equal(env.store.srsQueueCount, 1)
  assert.equal(env.store.queuedReviews[0].clientEventId, 'evt-legacy-1')
  assert.equal(JSON.stringify(env.store.queuedReviews[0].payload), JSON.stringify(wirePayload))
  assert.equal(env.store.batch, null)
  assert.equal(env.store.currentIndex, 0)
  assert.equal(env.store.practice.sessionId, 'legacy-practice')
  assert.deepEqual(env.store.answers[42], { selectedKey: 'A' })
  assert.equal(env.store.mistakes[0].mistakeId, 7)
  assert.equal(env.store.report.reportId, 'legacy-report')
  const disk = JSON.parse(env.storage.get(STORAGE_KEY))
  assert.equal(disk.revision, undefined)
  assert.equal(disk.queuedReviews.length, 4)
  assert.equal(disk.queuedReviews[2].payload.eventStatus, 'ACCEPTED')
  assert.equal(env.store.batch, null)
})

test('new authoritative snapshot starts at its first eligible card', async () => {
  const env = environment()
  env.login('A', 1)
  const batch = await loadBatch(env)
  const first = batch.items[0]
  await reveal(env, first)
  env.transport.queue.push({ data: receipt(first) })
  await env.store.rateCard(3, first)
  assert.equal(env.store.currentIndex, 1)

  env.transport.queue.push(batchData())
  await env.store.loadSrs()
  assert.equal(env.store.batch.snapshotId, 9001)
  assert.equal(env.store.currentIndex, 1)

  const fresh = batchData()
  fresh.data.snapshotId = 9002
  for (const item of fresh.data.items) item.snapshotItemId += 10
  env.transport.queue.push(fresh)
  await env.store.loadSrs()
  assert.equal(env.store.batch.items[0].id, '9002-21')
  assert.equal(env.store.batch.items[0].reviewStatus, 'PENDING')
  assert.equal(env.store.currentIndex, 0)
  assert.equal(env.store.currentCard.id, '9002-21')
})

test('real auth order keeps a same-owner refresh and clears mounted A before B', async () => {
  const env = environment()
  const { session, store, storage } = env
  session.sessionId = 'synthetic-A'
  session.verifiedSubject = 'A'
  session.identityRevision += 1
  session.isAuthenticated = true
  const batch = await loadBatch(env)
  await reveal(env, batch.items[0])
  env.transport.queue.push(new TypeError('offline'))
  await store.rateCard(3, batch.items[0])
  const queued = store.queuedReviews[0]
  assert.equal(store.srsQueueCount, 1)
  store.practice = { sessionId: 'practice-A', status: 'IN_PROGRESS', exercises: [], answerSheet: [], lastCheckpointSeq: 0, stateVersion: 1 }
  store.report = { reportId: 'report-A', status: 'READY' }
  store.answers = { 42: { selectedKey: 'A' } }
  store.mistakes = [{ mistakeId: 7 }]
  store.persist()
  assert.equal(JSON.parse(storage.get(STORAGE_KEY)).subject, 'A')
  assert.equal(store.batch.snapshotId, 9001)

  const requestsBeforeRefresh = env.transport.requests.length
  session.isAuthenticated = false
  assert.equal(store.srsQueueCount, 1)
  assert.equal(store.queuedReviews[0].clientEventId, queued.clientEventId)
  assert.equal(store.practice.sessionId, 'practice-A')
  assert.equal(store.report.reportId, 'report-A')
  assert.equal(store.batch.snapshotId, 9001)
  session.isAuthenticated = true
  assert.equal(JSON.stringify(store.queuedReviews[0].payload), JSON.stringify(queued.payload))
  assert.equal(env.transport.requests.length, requestsBeforeRefresh)
  assert.equal(JSON.parse(storage.get(STORAGE_KEY)).queuedReviews[0].clientEventId, queued.clientEventId)

  const held = deferred()
  env.transport.queue.push(() => held.promise)
  const pending = store.syncSrs()
  const requestsDuringSync = env.transport.requests.length
  session.verifiedSubject = null
  session.identityRevision += 1
  session.sessionId = null
  session.isAuthenticated = false
  assert.equal(store.srsQueueCount, 0)
  assert.equal(store.batch, null)
  assert.equal(store.practice, null)
  assert.equal(store.report, null)
  assert.deepEqual(store.answers, {})
  assert.deepEqual(store.mistakes, [])
  assert.equal(storage.get(STORAGE_KEY), undefined)
  held.resolve({ data: { results: [{ clientEventId: queued.clientEventId, status: 'ACCEPTED', result: { data: receipt(batch.items[0]) } }] } })
  await pending
  assert.notEqual(batch.items[0].reviewStatus, 'ACCEPTED')
  assert.equal(storage.get(STORAGE_KEY), undefined)
  assert.equal(env.transport.requests.length, requestsDuringSync)

  session.verifiedSubject = 'B'
  session.sessionId = 'synthetic-B'
  session.identityRevision += 1
  session.isAuthenticated = true
  store.restore()
  await store.syncSrs()
  assert.equal(session.verifiedSubject, 'B')
  assert.equal(store.srsQueueCount, 0)
  assert.equal(store.batch, null)
  assert.equal(store.practice, null)
  assert.equal(store.report, null)
  assert.deepEqual(store.answers, {})
  assert.equal(storage.get(STORAGE_KEY), undefined)
  assert.equal(env.transport.requests.length, requestsDuringSync)
})

test('held reply from the previous sessionId cannot publish or unlock the new sync', async () => {
  const env = environment()
  const { session, store } = env
  env.login('A', 1, 'sess-1')
  const oldBatch = await loadBatch(env)
  await reveal(env, oldBatch.items[0])
  env.transport.queue.push(new TypeError('offline'))
  await store.rateCard(3, oldBatch.items[0])
  const oldEvent = store.queuedReviews[0].clientEventId
  const oldSync = deferred()
  const oldReport = deferred()
  env.transport.queue.push(() => oldSync.promise)
  env.transport.queue.push(() => oldReport.promise)
  const syncing = store.syncSrs()
  const reporting = store.loadReport('daily')
  assert.equal(session.identityRevision, 1)
  session.sessionId = 'sess-2'
  assert.equal(session.verifiedSubject, 'A')
  assert.equal(session.identityRevision, 1)
  assert.equal(store.srsQueueCount, 0)
  assert.equal(store.batch, null)
  assert.equal(store.report, null)
  assert.equal(store.practice, null)
  assert.equal(store.reportStatus, 'idle')
  assert.equal(env.storage.get(STORAGE_KEY), undefined)

  const nextBatch = await loadBatch(env)
  const nextCard = nextBatch.items[0]
  await reveal(env, nextCard)
  env.transport.queue.push(new TypeError('offline'))
  await store.rateCard(3, nextCard)
  const nextEvent = store.queuedReviews[0].clientEventId
  const nextSync = deferred()
  const nextReport = deferred()
  env.transport.queue.push(() => nextSync.promise)
  env.transport.queue.push(() => nextReport.promise)
  const syncingNext = store.syncSrs()
  const reportingNext = store.loadReport('daily')
  const syncsAtHandoff = requestsTo(env, ':sync').length
  oldSync.resolve({ data: { results: [{ clientEventId: oldEvent, status: 'ACCEPTED', result: { data: receipt(oldBatch.items[0]) } }] } })
  oldReport.resolve({ data: { reportId: 'report-old', status: 'READY' } })
  await Promise.all([syncing, reporting])
  assert.equal(store.report, null)
  assert.notEqual(nextCard.reviewStatus, 'ACCEPTED')
  assert.equal(store.queuedReviews[0].clientEventId, nextEvent)
  await store.syncSrs()
  assert.equal(requestsTo(env, ':sync').length, syncsAtHandoff)
  nextSync.resolve({ data: { results: [{ clientEventId: nextEvent, status: 'ACCEPTED', result: { data: receipt(nextCard) } }] } })
  nextReport.resolve({ data: { reportId: 'report-new', status: 'READY' } })
  await Promise.all([syncingNext, reportingNext])
  assert.equal(nextCard.reviewStatus, 'ACCEPTED')
  assert.equal(store.srsQueueCount, 0)
  assert.equal(store.report.reportId, 'report-new')
  assert.equal(store.reportStatus, 'ready')
  assert.notEqual(store.status, 'loading')
})

test('a retained pending review blocks a second wire submission after authoritative reread', async () => {
  const before = environment()
  before.login('A', 3)
  const beforeBatch = await loadBatch(before)
  await reveal(before, beforeBatch.items[0])
  before.transport.queue.push(new TypeError('offline'))
  await before.store.rateCard(3, beforeBatch.items[0])
  const original = before.store.queuedReviews[0]
  assert.equal(before.store.srsQueueCount, 1)
  assert.equal(beforeBatch.items[0].id, '9001-11')

  const after = environment(before.storage)
  after.login('A', 1)
  const loaded = await loadBatch(after)
  const card = loaded.items[0]
  assert.equal(loaded.snapshotId, 9001)
  assert.equal(card.id, original.cardId)
  assert.equal(card.reviewStatus, 'QUEUED')
  assert.equal(loaded.items[1].reviewStatus, 'PENDING')
  assert.equal(after.store.srsQueueCount, 1)
  assert.equal(after.store.queuedReviews[0].clientEventId, original.clientEventId)
  assert.equal(JSON.stringify(after.store.queuedReviews[0].payload), JSON.stringify(original.payload))
  if (!card.revealed) await reveal(after, card)
  assert.equal(card.reviewStatus, 'QUEUED')
  card.reviewStatus = 'PENDING'
  const beforeAttempts = requestsTo(after, '/learning/srs/reviews').length
  await after.store.rateCard(0, card)
  assert.equal(requestsTo(after, '/learning/srs/reviews').length, beforeAttempts)
  assert.equal(card.reviewStatus, 'QUEUED')
  assert.equal(after.store.srsQueueCount, 1)
  assert.equal(after.store.queuedReviews[0].clientEventId, original.clientEventId)
  assert.equal(after.store.queuedReviews[0].payload.rawQuality, 3)

  after.transport.queue.push({ data: { results: [{ clientEventId: original.clientEventId, status: 'ACCEPTED', result: { data: receipt(card) } }] } })
  await after.store.syncSrs()
  assert.equal(card.reviewStatus, 'ACCEPTED')
  assert.equal(loaded.items[1].reviewStatus, 'PENDING')
  assert.equal(after.store.srsQueueCount, 0)
  assert.equal(after.store.currentIndex, 1)
})

test('matching sync receipt advances the current card only after status is ready', async () => {
  const { watch } = require('vue')
  const env = environment()
  env.login('A')
  const batch = await loadBatch(env)
  const first = batch.items[0]
  const next = batch.items[1]
  await reveal(env, first)
  env.transport.queue.push(new TypeError('offline'))
  await env.store.rateCard(3, first)
  const eventId = env.store.queuedReviews[0].clientEventId
  const transitions = []
  const stop = watch(() => env.store.currentCard, (card) => {
    transitions.push({ id: card?.id ?? null, status: env.store.status })
  }, { flush: 'sync' })
  env.transport.queue.push({ data: { results: [{ clientEventId: eventId, status: 'ACCEPTED', result: { data: receipt(first) } }] } })
  await env.store.syncSrs()
  stop()
  assert.equal(first.reviewStatus, 'ACCEPTED')
  assert.equal(env.store.srsQueueCount, 0)
  assert.equal(env.store.currentCard.id, next.id)
  assert.equal(env.store.status, 'ready')
  const nextSeen = transitions.filter((entry) => entry.id === next.id)
  assert.equal(nextSeen.length, 1)
  assert.equal(nextSeen[0].status, 'ready')
})
