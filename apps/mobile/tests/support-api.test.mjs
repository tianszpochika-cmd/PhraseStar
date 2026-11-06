import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const apiPath = 'src/api/support.ts'

function loadApi(request = async () => { throw new Error('network is not used by this parser test') }) {
  const source = fs.readFileSync(path.join(appRoot, apiPath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name === '@englishflow/contracts') return {}
    if (name === './client') return { mobileApiClient: { request }, MobileApiError: class extends Error { constructor(status) { super(String(status)); this.status = status } } }
    if (name === '../domain/it7-closure') return {}
    throw new Error(`Unexpected import ${name}`)
  }, module, module.exports)
  return module.exports
}
const meta = (overrides = {}) => ({ hasMore: false, pageSize: 20, nextCursor: null, ...overrides })
const ticket = (overrides = {}) => ({
  ticketId: 'ticket-101', tenantId: 'tenant-1', requesterSubjectId: 'subject-1',
  categoryCode: 'MEDIA_DEVICE', resourceRef: 'resource-1',
  descriptionContentRef: { contentRef: 'redacted-1' }, priority: 'NORMAL', state: 'OPEN', stateVersion: 3,
  assignment: { queueId: 'queue-1', assigneeRef: null, assignmentVersion: 1, assignedAt: null, history: [] },
  sla: { policyRef: 'sla-1', policyVersion: 1, dueAt: '2026-11-05T00:00:00Z', status: 'ON_TRACK', history: [] },
  retention: { retentionPolicyRef: 'retention-1', retentionPolicyVersion: 1, retentionUntil: '2027-01-01T00:00:00Z', legalHold: 'CLEAR', ownerReceiptRef: 'receipt-1' },
  createdAt: '2026-11-03T08:30:00Z', lastAuditId: 'audit-1', ...overrides,
})
const legacyMinimal = () => ({ ticketId: 'synthetic-legacy-1', categoryCode: 'TECHNICAL', state: 'IN_PROGRESS', priority: 'NORMAL', slaState: null })

test('support API parses canonical cursor data array and preserves formal fields', () => {
  const api = loadApi()
  const parsed = api.parseSupportListResponse({ data: [ticket(), ticket({ ticketId: 'ticket-102', categoryCode: 'CONTENT_CORRECTION', state: 'ASSIGNED', assignment: { queueId: 'queue-2', assigneeRef: 'agent-1', assignmentVersion: 2, assignedAt: '2026-11-03T09:00:00Z', history: [] } })], meta: meta() })
  assert.equal(parsed.tickets.length, 2)
  assert.equal(parsed.tickets[0].categoryCode, 'MEDIA_DEVICE')
  assert.equal(parsed.tickets[0].state, 'OPEN')
  assert.equal(parsed.tickets[1].categoryCode, 'CONTENT_CORRECTION')
  assert.equal(parsed.tickets[1].assigneeRef, 'agent-1')
  assert.equal(parsed.legacy, false)
  assert.equal(parsed.hasMore, false)
})

test('support API accepts the exact legacy minimal projection without formal defaults', () => {
  const api = loadApi()
  const parsed = api.parseSupportListResponse({ data: { items: [legacyMinimal()], ticketCopy: 'synthetic legacy board' } })
  assert.equal(parsed.legacy, true)
  assert.equal(parsed.tickets[0].ticketId, 'synthetic-legacy-1')
  assert.equal(parsed.tickets[0].categoryCode, 'TECHNICAL')
  assert.equal(parsed.tickets[0].state, 'IN_PROGRESS')
  assert.equal(parsed.tickets[0].slaStatus, null)
  assert.equal(parsed.tickets[0].createdAt, null)
  assert.equal(parsed.tickets[0].queueId, null)
  assert.equal(parsed.board.ticketCopy, 'synthetic legacy board')
  assert.equal(parsed.hasMore, false)
})

test('support API does not downgrade malformed formal array data to legacy', () => {
  const api = loadApi()
  assert.throws(() => api.parseSupportListResponse({ data: [legacyMinimal()], meta: meta() }), /missing tenantId/u)
  assert.throws(() => api.parseSupportListResponse({ data: [ticket({ state: 'FUTURE' })], meta: meta() }), /invalid state/u)
  assert.throws(() => api.parseSupportListResponse({ data: { items: [{ ticketId: 'x' }] } }), /missing|invalid/u)
  assert.throws(() => api.parseSupportListResponse({ data: {} }), /supported data array/u)
})

test('support cursor meta enforces hasMore/nextCursor agreement and bounds', () => {
  const api = loadApi()
  assert.deepEqual(api.parseCursorMeta(meta({ hasMore: true, nextCursor: 'cursor-page-2' })), { hasMore: true, nextCursor: 'cursor-page-2', pageSize: 20 })
  assert.throws(() => api.parseCursorMeta(meta({ hasMore: true, nextCursor: null })), /hasMore without nextCursor/u)
  assert.throws(() => api.parseCursorMeta(meta({ hasMore: false, nextCursor: 'cursor-page-2' })), /nextCursor while hasMore is false/u)
  assert.throws(() => api.parseCursorMeta(meta({ hasMore: false, nextCursor: 'short' })), /invalid nextCursor/u)
  assert.throws(() => api.parseCursorMeta(meta({ pageSize: 0 })), /invalid pageSize/u)
  assert.throws(() => api.parseCursorMeta(meta({ pageSize: 101 })), /invalid pageSize/u)
  assert.throws(() => api.parseSupportListResponse({ data: [ticket()] }), /missing meta/u)
  assert.deepEqual(api.parseSupportListResponse({ data: [], meta: meta() }).tickets, [])
})

test('support API reads raw and wrapped IT7 board while preserving privacy fields', async () => {
  const board = { supportNumber: 'YS-2026-1042', ticketCopy: 'legacy copy', privacy: { deletionCopy: 'deletion', audioCopy: 'audio', sessionCopy: 'session', workerGap: false, allComplete: true } }
  const raw = loadApi(async () => board)
  assert.deepEqual(await raw.readMobileClosureBoard(), board)
  const wrapped = loadApi(async () => ({ data: board }))
  assert.deepEqual(await wrapped.readMobileClosureBoard(), board)
  const malformed = loadApi(async () => ({ data: { supportNumber: 3 } }))
  await assert.rejects(() => malformed.readMobileClosureBoard(), /invalid board.supportNumber/u)
})

test('support API passes cursor/pageSize query for two real page loads', async () => {
  const paths = []
  const api = loadApi(async (url) => {
    paths.push(url)
    if (url.includes('cursor=cursor-page-2')) return { data: [ticket({ ticketId: 'ticket-202' })], meta: meta({ hasMore: false, nextCursor: null }) }
    return { data: [ticket({ ticketId: 'ticket-101' })], meta: meta({ hasMore: true, nextCursor: 'cursor-page-2' }) }
  })
  const first = await api.loadMobileSupportDesk()
  const second = await api.loadMobileSupportDesk(first.nextCursor, 20)
  assert.equal(first.tickets[0].ticketId, 'ticket-101')
  assert.equal(first.hasMore, true)
  assert.equal(second.tickets[0].ticketId, 'ticket-202')
  assert.equal(second.hasMore, false)
  assert.match(paths[0], /\/support\/tickets\?pageSize=20$/u)
  assert.match(paths[1], /pageSize=20/u)
  assert.match(paths[1], /cursor=cursor-page-2/u)
})

test('support API rejects a repeated cursor without advancing', async () => {
  const repeated = loadApi(async () => ({ data: [ticket()], meta: meta({ hasMore: true, nextCursor: 'cursor-page-2' }) }))
  await assert.rejects(() => repeated.loadMobileSupportDesk('cursor-page-2'), /did not advance|repeated|same cursor/iu)
})

test('support API rejects invalid cursor and pageSize boundaries', async () => {
  const invalid = loadApi()
  await assert.rejects(() => invalid.loadMobileSupportDesk('short'), /cursor is invalid/u)
  await assert.rejects(() => invalid.loadMobileSupportDesk(undefined, 0), /pageSize/u)
  await assert.rejects(() => invalid.loadMobileSupportDesk(undefined, 101), /pageSize/u)
})

test('support API preserves mid-page 401 and 403 failures', async () => {
  const unauthorized = loadApi(async () => { const error = new Error('401'); error.status = 401; throw error })
  await assert.rejects(() => unauthorized.loadMobileSupportDesk('cursor-page-2'), (error) => error.status === 401)
  const forbidden = loadApi(async () => { const error = new Error('403'); error.status = 403; throw error })
  await assert.rejects(() => forbidden.loadMobileSupportDesk('cursor-page-2'), (error) => error.status === 403)
})

test('support detail parser reads one strict entity and rejects missing/invalid data', () => {
  const api = loadApi()
  assert.equal(api.parseSupportDetailResponse({ data: ticket() }).ticketId, 'ticket-101')
  assert.throws(() => api.parseSupportDetailResponse({}), /missing data/u)
  assert.throws(() => api.parseSupportDetailResponse({ data: { ...ticket(), state: 'FUTURE' } }), /invalid state/u)
})

test('support read-only surface has no create/post/upload implementation', () => {
  const source = fs.readFileSync(path.join(appRoot, apiPath), 'utf8')
  const page = fs.readFileSync(path.join(appRoot, 'src/pages/support/support.vue'), 'utf8')
  assert.doesNotMatch(source, /createM1016SupportTicket|method:\s*['"]POST['"]|upload/iu)
  assert.doesNotMatch(page, /<textarea|<form|createM1016SupportTicket|type=["']file["']/iu)
})
