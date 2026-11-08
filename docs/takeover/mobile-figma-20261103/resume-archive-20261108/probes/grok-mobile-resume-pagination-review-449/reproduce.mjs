/**
 * Offline reproduction of G442 pagination behavior.
 * Reads the frozen candidate. Does not import product modules or open sockets.
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'

const FROZEN = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/pagination-442-reviewed-source'
const OUT = '/tmp/grok-mobile-resume-pagination-review-449'

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function readFrozen(rel) {
  return readFileSync(`${FROZEN}/${rel}`, 'utf8')
}

const manifest = JSON.parse(readFrozen('MANIFEST.json'))
const hashCheck = Object.entries(manifest).map(([rel, expected]) => {
  const actual = sha256(readFrozen(rel))
  return { rel, expected, actual, match: actual === expected }
})

function loadRecoveryWalker() {
  const source = readFrozen('apps/admin-web/src/api/recovery.ts')
  const required = [
    'for (let page = 0; page < 50; page += 1)',
    'const result = await listUnfinishedSagas({ cursor, pageSize: 100 })',
    'if (!result.hasMore || !result.nextCursor) break',
    'return sagaIds',
  ]
  for (const snippet of required) {
    if (!source.includes(snippet)) throw new Error(`frozen recovery.ts missing: ${snippet}`)
  }
  const requests = []
  let queue = []
  function isRecord(value) {
    return typeof value === 'object' && value !== null
  }
  function unwrap(value) {
    if (!isRecord(value)) return value
    return 'data' in value ? value.data : value
  }
  const adminClient = {
    async request(requestPath) {
      requests.push(requestPath)
      if (queue.length === 0) throw new Error('fixture queue empty')
      const next = queue.shift()
      if (next && next.throw) throw next.throw
      return next
    },
  }
  async function listUnfinishedSagas(input) {
    const params = new URLSearchParams()
    if (input?.cursor) params.set('cursor', input.cursor)
    if (input?.pageSize != null) params.set('pageSize', String(input.pageSize))
    const query = params.toString()
    const raw = await adminClient.request(`/admin/recovery/sagas/unfinished${query ? `?${query}` : ''}`)
    const data = unwrap(raw)
    const sagaIds = Array.isArray(data) ? data.filter((value) => typeof value === 'string') : []
    const meta = isRecord(raw) && isRecord(raw.meta) ? raw.meta : {}
    const nextCursor = typeof meta.nextCursor === 'string' && meta.nextCursor.trim() ? meta.nextCursor : null
    return {
      sagaIds,
      hasMore: meta.hasMore === true,
      nextCursor,
      pageSize: typeof meta.pageSize === 'number' ? meta.pageSize : sagaIds.length,
    }
  }
  async function listAllUnfinishedSagaIds() {
    const sagaIds = []
    let cursor
    for (let page = 0; page < 50; page += 1) {
      const result = await listUnfinishedSagas({ cursor, pageSize: 100 })
      sagaIds.push(...result.sagaIds)
      if (!result.hasMore || !result.nextCursor) break
      cursor = result.nextCursor
    }
    return sagaIds
  }
  return {
    requests,
    queue(next) { queue = next.slice() },
    runAll() { return listAllUnfinishedSagaIds() },
    sourceHasCap: true,
  }
}

function feedList(pages) {
  // Transcription of HttpAssessmentMistakeFeed.list + parsePage, frozen lines 39-109.
  const calls = []
  const facts = []
  let cursor = null
  try {
    for (let page = 0; page < 100; page++) {
      calls.push({ page, cursor })
      const response = pages(page, cursor)
      if (response.statusCode !== 200) {
        return {
          calls,
          returned: page === 0 ? [] : facts.slice(),
          outcome: page === 0 ? 'empty-on-non-200' : 'partial-on-later-non-200',
          status: response.statusCode,
        }
      }
      const parsed = parsePage(response.body)
      facts.push(...parsed.facts)
      if (!parsed.hasMore || parsed.nextCursor == null || parsed.nextCursor === '') break
      cursor = parsed.nextCursor
    }
    return { calls, returned: facts.slice(), outcome: 'returned-after-loop', status: 200 }
  } catch (exception) {
    return {
      calls,
      returned: facts.length === 0 ? [] : facts.slice(),
      outcome: facts.length === 0 ? 'empty-on-throw' : 'partial-on-throw',
      error: exception.name,
    }
  }
}

function parsePage(body) {
  try {
    const parsed = JSON.parse(body)
    if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) return emptyPage()
    const data = parsed.data
    const items = data && typeof data === 'object' ? data.items : null
    if (!Array.isArray(items)) return emptyPage()
    const facts = items.map((raw) => ({
      itemId: raw.itemId,
      scoreBucket: raw.scoreBucket == null ? 'ZERO' : raw.scoreBucket,
    }))
    const meta = parsed.meta
    const hasMore = !!(meta && meta.hasMore === true)
    let nextCursor = null
    if (meta && typeof meta.nextCursor === 'string' && meta.nextCursor.trim()) nextCursor = meta.nextCursor
    if (!hasMore) nextCursor = null
    return { facts, hasMore, nextCursor }
  } catch {
    return emptyPage()
  }
}

function emptyPage() {
  return { facts: [], hasMore: false, nextCursor: null }
}

function pageBody(ids, nextCursor, hasMore) {
  return JSON.stringify({
    data: { items: ids.map((itemId) => ({ itemId, scoreBucket: 'ZERO' })), count: ids.length },
    meta: { hasMore, nextCursor, pageSize: ids.length },
  })
}

function keysetWalk(options) {
  const rows = options.rows.map((row) => ({ ...row }))
  const seen = []
  let cursor = null
  const pages = []
  for (let page = 0; page < options.maxPages; page++) {
    const ordered = rows
      .filter((row) => !row.terminal)
      .slice()
      .sort((a, b) => a.updatedAt - b.updatedAt || (a.sagaId < b.sagaId ? -1 : a.sagaId > b.sagaId ? 1 : 0))
    const remaining = ordered.filter((row) => {
      if (!cursor) return true
      if (row.updatedAt > cursor.updatedAt) return true
      if (row.updatedAt === cursor.updatedAt && row.sagaId > cursor.sagaId) return true
      return false
    })
    const size = options.pageSize
    const hasMore = remaining.length > size
    const items = remaining.slice(0, size)
    pages.push(items.map((row) => row.sagaId))
    for (const row of items) seen.push(row.sagaId)
    const last = items[items.length - 1]
    const frozenCursor = last ? { updatedAt: last.updatedAt, sagaId: last.sagaId } : null
    if (options.afterPage) options.afterPage(page, rows, items)
    if (!hasMore || items.length === 0) break
    cursor = frozenCursor
  }
  return { pages, seen, unique: [...new Set(seen)] }
}

function mistakeKeyset(rows, cursorId) {
  return rows
    .filter((row) => row.tenantId === 'platform' && row.subjectId === 'owner-b')
    .filter((row) => cursorId == null || row.mistakeId > cursorId)
    .sort((a, b) => a.mistakeId - b.mistakeId)
}

function cursorRoundTrip() {
  const samples = [
    'asm.v1|1',
    'asm.v1|9007199254740991',
    'v1|2026-11-08T00:00:00Z|aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'v1|2026-11-08T00:00:00.100Z|aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'v1|2026-11-08T00:00:00.123456Z|aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  ]
  return samples.map((payload) => {
    const cursor = Buffer.from(payload, 'utf8').toString('base64url')
    const back = Buffer.from(cursor, 'base64url').toString('utf8')
    const pattern = /^[A-Za-z0-9._:-]{8,512}$/
    return {
      payload,
      cursor,
      roundTrip: back === payload,
      matchesCanonicalPattern: pattern.test(cursor),
      length: cursor.length,
    }
  })
}

const feedSource = readFrozen('services/learning-service/src/main/java/com/englishflow/learning/adapter/http/HttpAssessmentMistakeFeed.java')
for (const snippet of [
  'for (int page = 0; page < 100; page++)',
  'return page == 0 ? List.of() : List.copyOf(facts);',
  'return facts.isEmpty() ? List.of() : List.copyOf(facts);',
  'return Page.empty();',
]) {
  if (!feedSource.includes(snippet)) throw new Error(`frozen feed missing: ${snippet}`)
}
const jdbcSource = readFrozen('services/workflow-service/src/main/java/com/englishflow/workflow/adapter/jdbc/JdbcSagaStore.java')
for (const snippet of [
  'ORDER BY updated_at, saga_id LIMIT ?',
  '(updated_at > ? OR (updated_at = ? AND saga_id > ?))',
  "status NOT IN ('COMPLETED','COMPENSATED','COMPENSATION_FAILED')",
]) {
  if (!jdbcSource.includes(snippet)) throw new Error(`frozen jdbc missing: ${snippet}`)
}

const walker = loadRecoveryWalker()
if (!walker.sourceHasCap) throw new Error('frozen walker cap not found')

const ids = Array.from({ length: 5100 }, (_, index) => `saga-${String(index).padStart(4, '0')}-aaaa-aaaa-aaaaaaaaaaaa`)
const pages = []
for (let offset = 0; offset < ids.length; offset += 100) {
  const slice = ids.slice(offset, offset + 100)
  const more = offset + 100 < ids.length
  pages.push({
    data: slice,
    meta: { hasMore: more, pageSize: 100, nextCursor: more ? `cursor-${offset + 100}` : null },
  })
}
walker.requests.length = 0
walker.queue(pages)
const capped = await walker.runAll()
const capRequests = walker.requests.slice()

walker.requests.length = 0
walker.queue([
  { data: ['saga-page-0-aaaa-aaaa-aaaa-aaaaaaaaaaaa'], meta: { hasMore: true, pageSize: 100, nextCursor: 'cursor-next' } },
  { throw: Object.assign(new Error('cursor is invalid'), { status: 400 }) },
])
let walkerPage2 = { threw: false, message: null }
try {
  await walker.runAll()
} catch (error) {
  walkerPage2 = { threw: true, message: error.message }
}

const ownerFacts = Array.from({ length: 150 }, (_, index) => index + 1)
const feedLater401 = feedList((page) => {
  if (page === 0) return { statusCode: 200, body: pageBody(ownerFacts.slice(0, 100), 'cursor-100', true) }
  return { statusCode: 401, body: '{"error":{"code":"unauthorized"}}' }
})
const feedLater500 = feedList((page) => {
  if (page === 0) return { statusCode: 200, body: pageBody(ownerFacts.slice(0, 100), 'cursor-100', true) }
  return { statusCode: 500, body: 'unavailable' }
})
const feedMalformed = feedList((page) => {
  if (page === 0) return { statusCode: 200, body: pageBody(ownerFacts.slice(0, 100), 'cursor-100', true) }
  return { statusCode: 200, body: '{not-json' }
})
const feedRepeated = feedList((page) => {
  if (page < 100) return { statusCode: 200, body: pageBody(ownerFacts.slice(0, 100), 'cursor-stuck', true) }
  return { statusCode: 200, body: pageBody(ownerFacts.slice(100), null, false) }
})
const feedPage0Auth = feedList(() => ({ statusCode: 403, body: '{"error":{"code":"forbidden"}}' }))
const feedTimeout = feedList((page) => {
  if (page === 0) return { statusCode: 200, body: pageBody(ownerFacts.slice(0, 100), 'cursor-100', true) }
  throw new Error('TimeoutException')
})

const duplicateWalk = keysetWalk({
  pageSize: 1,
  maxPages: 6,
  rows: [
    { sagaId: 'saga-a', updatedAt: 1, terminal: false },
    { sagaId: 'saga-b', updatedAt: 2, terminal: false },
    { sagaId: 'saga-c', updatedAt: 3, terminal: false },
  ],
  afterPage(_page, rows, items) {
    if (items.some((row) => row.sagaId === 'saga-a')) {
      const row = rows.find((candidate) => candidate.sagaId === 'saga-a')
      row.updatedAt = 10
    }
  },
})

const stableStartedAt = [
  { sagaId: 'saga-a', startedAt: 1 },
  { sagaId: 'saga-b', startedAt: 2 },
  { sagaId: 'saga-c', startedAt: 3 },
]
function startedAtWalk() {
  const rows = stableStartedAt.map((row) => ({ ...row, terminal: false }))
  const seen = []
  let cursor = null
  for (let page = 0; page < 6; page++) {
    const remaining = rows
      .filter((row) => !row.terminal)
      .filter((row) => !cursor || row.startedAt > cursor.startedAt || (row.startedAt === cursor.startedAt && row.sagaId > cursor.sagaId))
      .sort((a, b) => a.startedAt - b.startedAt || (a.sagaId < b.sagaId ? -1 : 1))
    const items = remaining.slice(0, 1)
    if (items.length === 0) break
    seen.push(items[0].sagaId)
    if (items[0].sagaId === 'saga-a') {
      const row = rows.find((candidate) => candidate.sagaId === 'saga-a')
      row.updatedAt = 10
    }
    if (remaining.length <= 1) break
    cursor = { startedAt: items[0].startedAt, sagaId: items[0].sagaId }
  }
  return seen
}

const foreignCursor = mistakeKeyset([
  { tenantId: 'platform', subjectId: 'owner-a', mistakeId: 500 },
  { tenantId: 'platform', subjectId: 'owner-b', mistakeId: 100 },
  { tenantId: 'platform', subjectId: 'owner-b', mistakeId: 200 },
  { tenantId: 'platform', subjectId: 'owner-b', mistakeId: 600 },
  { tenantId: 'other', subjectId: 'owner-b', mistakeId: 700 },
], 500)

const sameMicrosecondSkip = keysetWalk({
  pageSize: 1,
  maxPages: 4,
  rows: [{ sagaId: 'saga-m', updatedAt: 5, terminal: false }],
  afterPage(page, rows) {
    if (page === 0) rows.push({ sagaId: 'saga-a', updatedAt: 5, terminal: false })
  },
})

const results = {
  hashCheck: {
    files: hashCheck.length,
    mismatches: hashCheck.filter((row) => !row.match).map((row) => row.rel),
  },
  sagaWalker: {
    sourceCapPresent: walker.sourceHasCap,
    inputIds: ids.length,
    returned: capped.length,
    omitted: ids.length - capped.length,
    requests: capRequests.length,
    lastRequest: capRequests.at(-1),
    firstOmitted: ids[capped.length] ?? null,
    returnedIsPrefixOfOldest: capped.every((id, index) => id === ids[index]),
    page50ResponseStillHasMore: pages[49].meta.hasMore,
    page50NextCursor: pages[49].meta.nextCursor,
    page2HttpFailureThrows: walkerPage2,
  },
  mistakeFeed: {
    later401: {
      outcome: feedLater401.outcome,
      status: feedLater401.status,
      returned: feedLater401.returned.length,
      calls: feedLater401.calls.length,
      unique: new Set(feedLater401.returned.map((row) => row.itemId)).size,
    },
    later500: {
      outcome: feedLater500.outcome,
      returned: feedLater500.returned.length,
    },
    malformedSecondPage: {
      outcome: feedMalformed.outcome,
      returned: feedMalformed.returned.length,
      calls: feedMalformed.calls.length,
    },
    repeatedCursor: {
      outcome: feedRepeated.outcome,
      calls: feedRepeated.calls.length,
      returnedFacts: feedRepeated.returned.length,
      unique: new Set(feedRepeated.returned.map((row) => row.itemId)).size,
      sawTail: feedRepeated.returned.some((row) => row.itemId > 100),
    },
    page0Forbidden: {
      outcome: feedPage0Auth.outcome,
      returned: feedPage0Auth.returned.length,
    },
    timeoutAfterFirstPage: {
      outcome: feedTimeout.outcome,
      returned: feedTimeout.returned.length,
    },
  },
  updatedAtKeyset: {
    duplicateWalk: {
      pages: duplicateWalk.pages,
      seen: duplicateWalk.seen,
      unique: duplicateWalk.unique,
    },
    sameMicrosecondSmallerIdSkip: {
      pages: sameMicrosecondSkip.pages,
      seen: sameMicrosecondSkip.seen,
    },
    startedAtControl: startedAtWalk(),
  },
  ownerCursor: {
    foreignCursorMistakeIdsVisibleToOwnerB: foreignCursor.map((row) => row.mistakeId),
  },
  cursorRoundTrip: cursorRoundTrip(),
}

writeFileSync(`${OUT}/reproduction-results.json`, `${JSON.stringify(results, null, 2)}\n`)
console.log(JSON.stringify({
  mismatches: results.hashCheck.mismatches,
  sagaReturned: results.sagaWalker.returned,
  sagaRequests: results.sagaWalker.requests,
  sagaThrowsOnPage2: results.sagaWalker.page2HttpFailureThrows,
  feed401: results.mistakeFeed.later401,
  feedMalformed: results.mistakeFeed.malformedSecondPage,
  feedRepeated: results.mistakeFeed.repeatedCursor,
  feedTimeout: results.mistakeFeed.timeoutAfterFirstPage,
  duplicateSeen: results.updatedAtKeyset.duplicateWalk.seen,
  skipSeen: results.updatedAtKeyset.sameMicrosecondSmallerIdSkip.seen,
  startedAt: results.updatedAtKeyset.startedAtControl,
  foreign: results.ownerCursor.foreignCursorMistakeIdsVisibleToOwnerB,
  cursors: results.cursorRoundTrip.map((row) => ({ length: row.length, roundTrip: row.roundTrip, pattern: row.matchesCanonicalPattern })),
}, null, 2))
