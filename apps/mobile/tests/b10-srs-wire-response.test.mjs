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
const STATUS_WORDS = new Set(['QUEUED', 'FAILED', 'STALE', 'ACCEPTED', 'PENDING', 'SUBMITTING', 'offline', 'error', 'stale', 'ready', 'loading', 'idle', 'empty', 'forbidden'])

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

function wireLog(summary) {
  const safe = {}
  for (const [key, value] of Object.entries(summary)) {
    if (typeof value === 'boolean' || typeof value === 'number') safe[key] = value
    else if (typeof value === 'string' && STATUS_WORDS.has(value)) safe[key] = value
  }
  console.log(`WIRE ${JSON.stringify(safe)}`)
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
      ],
    },
  }
}

const vocabData = (vocabId) => ({
  data: { vocabId, word: `word-${vocabId}`, definitions: [{ partOfSpeech: 'N', meaningCn: '释义', definitionEn: 'definition' }], examples: [{ sentenceEn: 'Example.', sentenceCn: '例句。' }], contentVersion: 'v1' },
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
  return { store, login, transport, MobileApiError }
}

async function prepare(env) {
  env.login('wire-owner')
  env.transport.queue.push(batchData())
  await env.store.loadSrs()
  const card = env.store.batch.items[0]
  env.transport.queue.push(vocabData(card.itemId))
  await env.store.revealCard(card)
  return card
}

const REVIEW_EVENT_KEYS = ['snapshotId', 'snapshotItemId', 'item', 'rawQuality', 'answerOutcome', 'responseTimeMs', 'revealElapsedMs', 'attemptNo', 'clientEventId', 'clientOccurredAt', 'baseStateVersion']

function stableString(value) {
  if (Array.isArray(value)) return `[${value.map((entry) => stableString(entry)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableString(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sameBody(left, right) {
  return stableString(left) === stableString(right)
}

function bodyDiff(left, right, prefix) {
  const keys = new Set([...Object.keys(left || {}), ...Object.keys(right || {})])
  const summary = { [`${prefix}DiffCount`]: 0, [`${prefix}UnexpectedDiffCount`]: 0 }
  for (const key of keys) {
    if (stableString(left?.[key]) === stableString(right?.[key])) continue
    summary[`${prefix}DiffCount`] += 1
    if (REVIEW_EVENT_KEYS.includes(key)) summary[`${prefix}Diff_${key}`] = true
    else summary[`${prefix}UnexpectedDiffCount`] += 1
  }
  return summary
}

function reviewPosts(env) {
  return env.transport.requests.filter((request) => request.path === '/learning/srs/reviews')
}

function syncPosts(env) {
  return env.transport.requests.filter((request) => request.path === '/learning/srs/reviews:sync')
}

function installSteppingClock(isoTimes) {
  const RealDate = Date
  let steps = 0
  class SteppingDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        const iso = isoTimes[Math.min(steps, isoTimes.length - 1)]
        steps += 1
        super(iso)
        return
      }
      super(...args)
    }
  }
  SteppingDate.now = () => {
    const iso = isoTimes[Math.min(steps, isoTimes.length - 1)]
    steps += 1
    return RealDate.parse(iso)
  }
  globalThis.Date = SteppingDate
  return { restore() { globalThis.Date = RealDate }, steps: () => steps }
}

async function ambiguous(status, label) {
  const env = environment()
  const card = await prepare(env)
  const versionBefore = card.stateVersion
  const masteryBefore = card.masteryStatus
  env.transport.queue.push(new env.MobileApiError('unavailable', status, null))
  await env.store.rateCard(3, card)
  const first = reviewPosts(env)[0]
  const queued = env.store.queuedReviews[0]
  const postedId = first?.options?.data?.clientEventId ?? null
  const queuedId = queued?.clientEventId ?? null
  const payloadBefore = queued ? JSON.stringify(queued.payload) : null
  const postsAfterFirst = reviewPosts(env).length
  env.transport.queue.push(new env.MobileApiError('unavailable', status, null))
  await env.store.rateCard(1, card)
  const summary = {
    caseCode: label,
    errorStatus: status,
    reviewStatus: card.reviewStatus,
    storeStatus: env.store.status,
    queueCount: env.store.queuedReviews.length,
    reviewPostCount: reviewPosts(env).length,
    secondTapNewPost: reviewPosts(env).length > postsAfterFirst,
    sameEventId: Boolean(postedId && queuedId && postedId === queuedId),
    accepted: card.reviewStatus === 'ACCEPTED',
    masteryUnchanged: card.masteryStatus === masteryBefore && card.stateVersion === versionBefore,
    payloadUnchangedAfterSecondTap: Boolean(queued) && JSON.stringify(env.store.queuedReviews[0]?.payload) === payloadBefore,
    queueStillSameId: Boolean(queuedId) && env.store.queuedReviews[0]?.clientEventId === queuedId,
  }
  wireLog(summary)
  return summary
}

test('ambiguous 500 preserves the first event id and does not settle', async () => {
  const summary = await ambiguous(500, 500)
  assert.equal(summary.reviewStatus, 'QUEUED')
  assert.equal(summary.queueCount, 1)
  assert.equal(summary.sameEventId, true)
  assert.equal(summary.secondTapNewPost, false)
  assert.equal(summary.accepted, false)
  assert.equal(summary.masteryUnchanged, true)
  assert.equal(summary.payloadUnchangedAfterSecondTap, true)
  assert.equal(summary.queueStillSameId, true)
  assert.equal(summary.reviewPostCount, 1)
})

test('ambiguous 503 preserves the first event id and does not settle', async () => {
  const summary = await ambiguous(503, 503)
  assert.equal(summary.reviewStatus, 'QUEUED')
  assert.equal(summary.queueCount, 1)
  assert.equal(summary.sameEventId, true)
  assert.equal(summary.secondTapNewPost, false)
  assert.equal(summary.accepted, false)
  assert.equal(summary.masteryUnchanged, true)
  assert.equal(summary.payloadUnchangedAfterSecondTap, true)
  assert.equal(summary.queueStillSameId, true)
  assert.equal(summary.reviewPostCount, 1)
})

test('timeout status 0 preserves the first event id and does not settle', async () => {
  const summary = await ambiguous(0, 0)
  assert.equal(summary.reviewStatus, 'QUEUED')
  assert.equal(summary.queueCount, 1)
  assert.equal(summary.sameEventId, true)
  assert.equal(summary.secondTapNewPost, false)
  assert.equal(summary.accepted, false)
  assert.equal(summary.masteryUnchanged, true)
  assert.equal(summary.payloadUnchangedAfterSecondTap, true)
  assert.equal(summary.queueStillSameId, true)
  assert.equal(summary.reviewPostCount, 1)
})

test('authoritative 409 stays failed and is not queued as an unconfirmed review', async () => {
  const env = environment()
  const card = await prepare(env)
  env.transport.queue.push(new env.MobileApiError('unavailable', 409, null))
  await env.store.rateCard(3, card)
  const postsAfterFirst = reviewPosts(env).length
  env.transport.queue.push(new env.MobileApiError('unavailable', 409, null))
  await env.store.rateCard(3, card)
  const summary = {
    errorStatus: 409,
    reviewStatus: card.reviewStatus,
    storeStatus: env.store.status,
    queueCount: env.store.queuedReviews.length,
    reviewPostCount: reviewPosts(env).length,
    secondTapNewPost: reviewPosts(env).length > postsAfterFirst,
    accepted: card.reviewStatus === 'ACCEPTED',
    masteryUnchanged: card.masteryStatus === null,
  }
  wireLog(summary)
  assert.equal(summary.reviewStatus, 'FAILED')
  assert.equal(summary.queueCount, 0)
  assert.equal(summary.accepted, false)
  assert.equal(summary.masteryUnchanged, true)
  assert.equal(summary.storeStatus, 'error')
})

// The store captures clientOccurredAt once. submitSrsReview posts that event and does not construct another timestamp.
test('first POST body deep-equals the queued retry body when the clock advances', async () => {
  const env = environment()
  const card = await prepare(env)
  const clock = installSteppingClock(['2026-11-04T00:00:00.000Z', '2026-11-04T00:00:01.000Z'])
  try {
    env.transport.queue.push(new env.MobileApiError('unavailable', 503, null))
    await env.store.rateCard(3, card)
    const queued = env.store.queuedReviews[0]
    env.transport.queue.push({ data: {} })
    await env.store.syncSrs()
    const posted = reviewPosts(env)[0]?.options?.data ?? null
    const retried = syncPosts(env)[0]?.options?.data?.events?.[0] ?? null
    const summary = {
      reviewStatus: card.reviewStatus,
      storeStatus: env.store.status,
      queueCount: env.store.queuedReviews.length,
      reviewPostCount: reviewPosts(env).length,
      syncPostCount: syncPosts(env).length,
      dateSteps: clock.steps(),
      sameEventId: Boolean(posted && queued && posted.clientEventId === queued.clientEventId && retried && retried.clientEventId === queued.clientEventId),
      occurredAtDiffers: Boolean(posted && queued && posted.clientOccurredAt !== queued.payload.clientOccurredAt),
      postedMatchesQueued: Boolean(posted && queued) && sameBody(posted, queued.payload),
      postedMatchesRetry: Boolean(posted && retried) && sameBody(posted, retried),
      retryMatchesQueued: Boolean(retried && queued) && sameBody(retried, queued.payload),
      accepted: card.reviewStatus === 'ACCEPTED',
      ...bodyDiff(posted, queued?.payload, 'postedQueued'),
      ...bodyDiff(posted, retried, 'postedRetry'),
      ...bodyDiff(retried, queued?.payload, 'retryQueued'),
    }
    wireLog(summary)
    assert.equal(summary.dateSteps, 1)
    assert.equal(summary.sameEventId, true)
    assert.equal(summary.reviewPostCount, 1)
    assert.equal(summary.syncPostCount, 1)
    assert.equal(summary.accepted, false)
    assert.equal(summary.postedMatchesQueued, true)
    assert.equal(summary.postedMatchesRetry, true)
  } finally {
    clock.restore()
  }
})
