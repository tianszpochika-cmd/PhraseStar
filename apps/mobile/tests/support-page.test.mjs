import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const pagePath = 'src/pages/support/support.vue'
const req = createRequire(path.join(appRoot, 'package.json'))
const { parse, compileScript, compileTemplate } = req('@vue/compiler-sfc')

function loadPage({ authenticated = true, allowed = true, desk = null, detail = null, deskStatus = 0, detailStatus = 0, deskLoader = null, detailLoader = null } = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'Missing support page script setup')
  const calls = { loadDesk: 0, readDetail: [], navigate: [], restore: 0, deskArgs: [] }
  const session = { isAuthenticated: authenticated, verifiedSubject: 'subject-1', identityRevision: 1, status: 'authenticated' }
  const shown = []; const hidden = []; const mounted = []; const unmounted = []; const watchers = []
  const themeListeners = []; let themeUnsubscribed = 0
  const themeController = {
    resolvedTheme: 'light',
    subscribe(listener) { listener({ resolvedTheme: themeController.resolvedTheme }); themeListeners.push(listener); return () => { themeUnsubscribed += 1 } },
  }
  class MobileApiError extends Error { constructor(status) { super(String(status)); this.status = status } }
  const api = {
    async loadMobileSupportDesk(cursor, size) {
      calls.loadDesk += 1
      calls.deskArgs.push([cursor ?? null, size ?? null])
      if (deskStatus) throw new MobileApiError(deskStatus)
      if (deskLoader) return deskLoader(calls.loadDesk, cursor, size, (status) => new MobileApiError(status))
      if (desk instanceof Error) throw desk
      return desk ?? { tickets: [], board: null, legacy: false, meta: {}, nextCursor: null, hasMore: false, pageSize: 20 }
    },
    async readMobileSupportTicket(id) {
      calls.readDetail.push(id)
      if (detailStatus) throw new MobileApiError(detailStatus)
      if (detailLoader) return detailLoader(id, calls.readDetail.length)
      if (detail instanceof Error) throw detail
      if (detail) return detail
      return { ticketId: id, categoryCode: 'MEDIA_DEVICE', state: 'OPEN', priority: 'NORMAL', stateVersion: 1, createdAt: '2026-11-03T08:30:00Z', queueId: 'queue-1', assigneeRef: null, slaStatus: 'ON_TRACK', resolutionCode: null }
    },
  }
  const modules = {
    vue: {
      ref: (value) => ({ value }),
      computed: (getter) => ({ get value() { return getter() } }),
      watch: (getter, callback) => { watchers.push(callback); return () => {} },
      onMounted: (callback) => mounted.push(callback),
      onUnmounted: (callback) => unmounted.push(callback),
    },
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback), onHide: (callback) => hidden.push(callback) },
    '@englishflow/i18n': { interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_m, key) => String(values[key] ?? `{${key}}`)) },
    '../../components/MobilePageHeader.vue': {},
    '../../components/AppIcon.vue': {},
    '../../platform/experience': { mobileT: (key) => `mobile.${key}`, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }) },
    '../../auth/navigation': { ensureMobilePageAccess: async () => allowed },
    '../../api/client': { MobileApiError },
    '../../api/support': api,
    '../../domain/it7-closure': {},
    '../../platform/b10-foundation': { b10ThemeMode: { value: 'light' } },
    '../../platform/v2-foundation': { mobileI18n: { formatDate: () => 'DATE', formatNumber: (v) => String(v) }, mobileThemeController: themeController },
    '../../platform/uni-runtime': { openUniPage: async (url) => { calls.navigate.push(url) } },
    '../../stores/session': { useSessionStore: () => session },
  }
  const names = ['loadList', 'loadMore', 'openTicket', 'backToList', 'retry', 'openLogin']
  const refs = ['tickets', 'board', 'listState', 'listErrorKind', 'hasMore', 'nextCursor', 'pageSize', 'moreState', 'moreErrorKind', 'moreErrorText', 'detailId', 'detailState', 'detailErrorKind', 'selectedTicket', 'stateName', 'detailOpen', 'detailErrorText', 'resolvedTheme']
  const exported = `${script}\nexport const __test = { ${names.join(', ')} };\nexport const __refs = { ${refs.join(', ')} };\n`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
    return modules[name]
  }, module, module.exports)
  return { source, calls, session, shown, hidden, mounted, unmounted, watchers, themeListeners, themeUnsubscribed: () => themeUnsubscribed, test: module.exports.__test ?? {}, refs: module.exports.__refs ?? {} }
}
const ticket = (id = 'ticket-1') => ({ ticketId: id, categoryCode: 'MEDIA_DEVICE', state: 'OPEN', priority: 'NORMAL', stateVersion: 1, createdAt: '2026-11-03T08:30:00Z', queueId: 'queue-1', assigneeRef: null, slaStatus: 'ON_TRACK', resolutionCode: null })
const deskWith = (tickets, supportNumber, extra = {}) => ({ tickets, board: supportNumber ? { supportNumber } : null, legacy: false, meta: {}, nextCursor: null, hasMore: false, pageSize: 20, ...extra })
const cursor2 = 'opaque.cursor:page-2'
const pageOne = () => deskWith([ticket('ticket-1'), ticket('ticket-2')], 'YS-ONE', { hasMore: true, nextCursor: cursor2, pageSize: 10 })
const pageTwo = () => deskWith([ticket('ticket-2'), ticket('ticket-3')], null, { hasMore: false, nextCursor: null, pageSize: 10 })
function deferred() {
  let resolve; let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

test('support page loads formal list and opens/refreshes one read-only detail', async () => {
  const page = loadPage({ desk: { tickets: [ticket('ticket-1'), ticket('ticket-2')], board: null, legacy: false, meta: {} }, detail: ticket('ticket-1') })
  await page.shown[0]()
  assert.equal(page.refs.listState.value, 'ready')
  assert.equal(page.refs.tickets.value.length, 2)
  await page.test.openTicket('ticket-1')
  assert.equal(page.refs.detailState.value, 'ready')
  assert.equal(page.refs.selectedTicket.value.ticketId, 'ticket-1')
  assert.deepEqual(page.calls.readDetail, ['ticket-1'])
  await page.test.openTicket('ticket-1')
  assert.deepEqual(page.calls.readDetail, ['ticket-1', 'ticket-1'])
  page.test.backToList()
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.listState.value, 'ready')
})

test('support page distinguishes empty, loading error/retry, unauthorized and forbidden', async () => {
  const empty = loadPage({ desk: { tickets: [], board: null, legacy: false, meta: {} } })
  await empty.shown[0]()
  assert.equal(empty.refs.listState.value, 'empty')

  const failure = loadPage({ desk: new (class extends Error { constructor() { super('503'); this.status = 503 } })() })
  await failure.shown[0]()
  assert.equal(failure.refs.listState.value, 'error')
  assert.equal(failure.refs.listErrorKind.value, 'error')

  const unauthorized = loadPage({ deskStatus: 401 })
  await unauthorized.shown[0]()
  assert.equal(unauthorized.refs.listState.value, 'error')
  assert.equal(unauthorized.refs.listErrorKind.value, 'unauthorized')
  unauthorized.test.openLogin()
  assert.deepEqual(unauthorized.calls.navigate, ['/pages/login/login'])
  const forbidden = loadPage({ deskStatus: 403 })
  await forbidden.shown[0]()
  assert.equal(forbidden.refs.listErrorKind.value, 'forbidden')
})

test('support page detail error states do not fabricate ticket content', async () => {
  class ApiError extends Error { constructor(status) { super(String(status)); this.status = status } }
  const page = loadPage({ detailStatus: 403 })
  await page.test.openTicket('ticket-403')
  assert.equal(page.refs.detailState.value, 'forbidden')
  assert.equal(page.refs.selectedTicket.value, null)
  const missing = loadPage({ detailStatus: 404 })
  await missing.test.openTicket('ticket-404')
  assert.equal(missing.refs.detailState.value, 'notfound')
  assert.equal(missing.refs.selectedTicket.value, null)
})

test('support page identity loss clears every private/continuation field, marks unauthorized and issues no private read', async () => {
  const page = loadPage({ desk: deskWith([ticket('ticket-a')], 'YS-A'), detail: ticket('ticket-a') })
  await page.shown[0]()
  await page.test.openTicket('ticket-a')
  assert.equal(page.refs.detailState.value, 'ready')
  const deskReads = page.calls.loadDesk
  const detailReads = page.calls.readDetail.length
  page.session.isAuthenticated = false
  page.session.verifiedSubject = null
  page.session.identityRevision = 2
  page.watchers[0]()
  assert.equal(page.refs.listState.value, 'error')
  assert.equal(page.refs.listErrorKind.value, 'unauthorized')
  assert.deepEqual(page.refs.tickets.value, [])
  assert.equal(page.refs.board.value, null)
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.detailState.value, 'idle')
  assert.equal(page.refs.selectedTicket.value, null)
  assert.equal(page.refs.stateName.value, 'error')
  assert.equal(page.calls.loadDesk, deskReads)
  assert.equal(page.calls.readDetail.length, detailReads)
})

test('support page switch A->B discards late A list/detail responses and accepts only B reads', async () => {
  const listA = deferred(); const listB = deferred(); const detailA = deferred(); const detailB = deferred()
  let detailCount = 0
  const page = loadPage({
    deskLoader: (count) => (count === 1 ? listA.promise : listB.promise),
    detailLoader: () => { detailCount += 1; return detailCount === 1 ? detailA.promise : detailB.promise },
  })
  const aShown = page.shown[0]()
  await flush()
  assert.equal(page.calls.loadDesk, 1)
  const aDetail = page.test.openTicket('ticket-a')
  assert.equal(page.refs.detailState.value, 'loading')
  page.session.verifiedSubject = 'subject-b'
  page.session.identityRevision = 2
  page.watchers[0]()
  assert.equal(page.calls.loadDesk, 2)
  assert.deepEqual(page.refs.tickets.value, [])
  assert.equal(page.refs.board.value, null)
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.detailState.value, 'idle')
  assert.equal(page.refs.listState.value, 'loading')
  listA.resolve(deskWith([ticket('ticket-a')], 'YS-A'))
  detailA.resolve(ticket('ticket-a'))
  await Promise.all([aShown, aDetail])
  await flush()
  assert.equal(page.refs.listState.value, 'loading')
  assert.deepEqual(page.refs.tickets.value, [])
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.selectedTicket.value, null)
  listB.resolve(deskWith([ticket('ticket-b')], 'YS-B'))
  await flush()
  assert.equal(page.refs.listState.value, 'ready')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-b'])
  assert.equal(page.refs.board.value.supportNumber, 'YS-B')
  const bDetail = page.test.openTicket('ticket-b')
  detailB.resolve(ticket('ticket-b'))
  await bDetail
  assert.equal(page.refs.detailState.value, 'ready')
  assert.equal(page.refs.selectedTicket.value.ticketId, 'ticket-b')
})

test('support page onHide invalidates an in-flight detail and never reappears', async () => {
  const late = deferred()
  const page = loadPage({ desk: deskWith([ticket('ticket-1')]), detailLoader: () => late.promise })
  await page.shown[0]()
  const reading = page.test.openTicket('ticket-1')
  assert.equal(page.refs.detailState.value, 'loading')
  page.hidden[0]()
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.detailState.value, 'idle')
  late.resolve(ticket('ticket-1'))
  await reading
  await flush()
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.detailState.value, 'idle')
  assert.equal(page.refs.selectedTicket.value, null)
})

test('support page turns a mismatched detail ticketId into an explicit error and shows no ticket', async () => {
  const page = loadPage({ detail: ticket('ticket-other') })
  await page.test.openTicket('ticket-requested')
  assert.equal(page.refs.detailId.value, 'ticket-requested')
  assert.equal(page.refs.detailState.value, 'error')
  assert.equal(page.refs.detailErrorKind.value, 'error')
  assert.equal(page.refs.selectedTicket.value, null)
  assert.equal(page.refs.detailErrorText.value, 'mobile.supportPage.unavailable')
  assert.equal(page.refs.stateName.value, 'detail-error')
})

test('support page loads the next page on click, dedupes ticket ids and stops when hasMore is false', async () => {
  const page = loadPage({ deskLoader: (count) => count % 2 === 1 ? pageOne() : pageTwo() })
  await page.shown[0]()
  assert.equal(page.refs.listState.value, 'ready')
  assert.equal(page.refs.hasMore.value, true)
  assert.equal(page.refs.nextCursor.value, cursor2)
  assert.equal(page.refs.pageSize.value, 10)
  assert.deepEqual(page.calls.deskArgs, [[null, 20]])
  await page.test.loadMore()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.refs.nextCursor.value, null)
  assert.equal(page.refs.moreState.value, 'idle')
  assert.deepEqual(page.calls.deskArgs, [[null, 20], [cursor2, 10]])
  const reads = page.calls.loadDesk
  await page.test.loadMore()
  assert.equal(page.calls.loadDesk, reads)
  assert.equal(page.refs.tickets.value.length, 3)
  await page.test.loadList()
  assert.equal(page.refs.hasMore.value, true)
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2'])
  await page.test.loadMore()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.calls.deskArgs.length, 4)
  assert.match(page.source, /v-if="hasMore && moreState !== 'error'"/u)
})

test('support page ignores repeated load-more clicks while a page request is in flight', async () => {
  const pending = deferred()
  const page = loadPage({ deskLoader: (count) => count === 1 ? pageOne() : pending.promise })
  await page.shown[0]()
  const first = page.test.loadMore()
  const second = page.test.loadMore()
  await second
  assert.equal(page.calls.loadDesk, 2)
  assert.equal(page.refs.moreState.value, 'loading')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2'])
  pending.resolve(pageTwo())
  await first
  assert.equal(page.refs.moreState.value, 'idle')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(page.calls.loadDesk, 2)
})

test('support page keeps verified pages on pagination failure and retries the same cursor', async () => {
  const page = loadPage({ deskLoader: (count, cursor, size, apiError) => {
    if (count === 1) return pageOne()
    if (count === 2) throw apiError(500)
    if (count === 3) throw new Error('network down')
    return pageTwo()
  } })
  await page.shown[0]()
  await page.test.loadMore()
  assert.equal(page.refs.moreState.value, 'error')
  assert.equal(page.refs.moreErrorKind.value, 'error')
  assert.equal(page.refs.moreErrorText.value, 'mobile.supportPage.moreError')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2'])
  assert.equal(page.refs.hasMore.value, true)
  assert.equal(page.refs.nextCursor.value, cursor2)
  await page.test.loadMore()
  assert.equal(page.refs.moreState.value, 'error')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2'])
  await page.test.loadMore()
  assert.equal(page.refs.moreState.value, 'idle')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(page.refs.hasMore.value, false)
  assert.deepEqual(page.calls.deskArgs, [[null, 20], [cursor2, 10], [cursor2, 10], [cursor2, 10]])
})

test('support page clears private and continuation state when load-more returns 401 or 403', async () => {
  for (const status of [401, 403]) {
    const page = loadPage({ detail: ticket('ticket-1'), deskLoader: (count, cursor, size, apiError) => {
      if (count === 1) return pageOne()
      throw apiError(status)
    } })
    await page.shown[0]()
    await page.test.openTicket('ticket-1')
    assert.equal(page.refs.detailState.value, 'ready')
    await page.test.loadMore()
    assert.equal(page.refs.listState.value, 'error')
    assert.equal(page.refs.listErrorKind.value, status === 401 ? 'unauthorized' : 'forbidden')
    assert.deepEqual(page.refs.tickets.value, [])
    assert.equal(page.refs.board.value, null)
    assert.equal(page.refs.hasMore.value, false)
    assert.equal(page.refs.nextCursor.value, null)
    assert.equal(page.refs.moreState.value, 'idle')
    assert.equal(page.refs.detailId.value, null)
    assert.equal(page.refs.selectedTicket.value, null)
    assert.equal(page.refs.stateName.value, 'error')
    assert.equal(page.calls.loadDesk, 2)
  }
})

test('support page fails explicitly on repeated or missing cursors without looping requests', async () => {
  const loopPage = deskWith([ticket('ticket-3')], null, { hasMore: true, nextCursor: cursor2 })
  const loop = loadPage({ deskLoader: (count) => count === 1 ? pageOne() : loopPage })
  await loop.shown[0]()
  await loop.test.loadMore()
  assert.equal(loop.refs.moreState.value, 'error')
  assert.equal(loop.refs.moreErrorKind.value, 'cursor')
  assert.equal(loop.refs.moreErrorText.value, 'mobile.supportPage.moreStale')
  assert.deepEqual(loop.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(loop.refs.hasMore.value, true)
  const reads = loop.calls.loadDesk
  await loop.test.loadMore()
  assert.equal(loop.calls.loadDesk, reads)

  const missing = loadPage({ desk: deskWith([ticket('ticket-1')], null, { hasMore: true, nextCursor: null }) })
  await missing.shown[0]()
  assert.equal(missing.refs.hasMore.value, true)
  assert.equal(missing.refs.listState.value, 'ready')
  await missing.test.loadMore()
  assert.equal(missing.refs.moreState.value, 'error')
  assert.equal(missing.refs.moreErrorKind.value, 'cursor')
  assert.equal(missing.calls.loadDesk, 1)

  const missingAfterPage = loadPage({ deskLoader: (count) => count === 1 ? pageOne() : deskWith([ticket('ticket-3')], null, { hasMore: true, nextCursor: null }) })
  await missingAfterPage.shown[0]()
  await missingAfterPage.test.loadMore()
  assert.equal(missingAfterPage.refs.moreState.value, 'error')
  assert.equal(missingAfterPage.refs.moreErrorKind.value, 'cursor')
  assert.deepEqual(missingAfterPage.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2', 'ticket-3'])
  assert.equal(missingAfterPage.calls.loadDesk, 2)
})

test('support page detects an A->B->A cursor cycle and stops requesting', async () => {
  const cursorA = 'opaque.cursor:cycle-a'
  const cursorB = 'opaque.cursor:cycle-b'
  const first = deskWith([ticket('cycle-1')], null, { hasMore: true, nextCursor: cursorA, pageSize: 10 })
  const second = deskWith([ticket('cycle-2')], null, { hasMore: true, nextCursor: cursorB, pageSize: 10 })
  const third = deskWith([ticket('cycle-3')], null, { hasMore: true, nextCursor: cursorA, pageSize: 10 })
  const page = loadPage({ deskLoader: (count) => count === 1 ? first : count === 2 ? second : third })
  await page.shown[0]()
  await page.test.loadMore()
  assert.equal(page.refs.hasMore.value, true)
  assert.equal(page.refs.nextCursor.value, cursorB)
  await page.test.loadMore()
  assert.equal(page.refs.moreState.value, 'error')
  assert.equal(page.refs.moreErrorKind.value, 'cursor')
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['cycle-1', 'cycle-2', 'cycle-3'])
  const reads = page.calls.loadDesk
  await page.test.loadMore()
  assert.equal(page.calls.loadDesk, reads)
})

test('support page does not call an empty first page complete when hasMore is true', async () => {
  const page = loadPage({ desk: deskWith([], null, { hasMore: true, nextCursor: 'cursor-empty' }) })
  await page.shown[0]()
  assert.equal(page.refs.listState.value, 'ready')
  assert.equal(page.refs.stateName.value, 'ready')
  assert.equal(page.refs.tickets.value.length, 0)
  assert.equal(page.refs.hasMore.value, true)
  assert.match(page.source, /moreAvailable/u)
})

test('support page keeps the legacy no-meta response as one single page', async () => {
  const legacyTicket = { ...ticket('legacy-1'), legacy: true, categoryCode: 'TECHNICAL', state: 'OPEN', stateVersion: null, createdAt: null, queueId: null, assigneeRef: null, slaStatus: null, resolutionCode: null }
  const page = loadPage({ desk: { tickets: [legacyTicket], board: { supportNumber: 'LEGACY-1' }, legacy: true, meta: {}, nextCursor: null, hasMore: false, pageSize: 20 } })
  await page.shown[0]()
  assert.equal(page.refs.listState.value, 'ready')
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.refs.nextCursor.value, null)
  await page.test.loadMore()
  assert.equal(page.calls.loadDesk, 1)
})

test('support page does not let a late A pagination response write into B or a fresh A chain', async () => {
  const lateA = deferred()
  const bPage = deskWith([ticket('ticket-b')], 'YS-B')
  const aAgain = deskWith([ticket('ticket-a2')], 'YS-A2')
  const page = loadPage({ deskLoader: (count) => {
    if (count === 1) return pageOne()
    if (count === 2) return lateA.promise
    if (count === 3) return bPage
    return aAgain
  } })
  await page.shown[0]()
  const late = page.test.loadMore()
  assert.equal(page.calls.deskArgs[1][0], cursor2)
  page.session.verifiedSubject = 'subject-b'
  page.session.identityRevision = 2
  page.watchers[0]()
  await flush()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-b'])
  assert.equal(page.refs.hasMore.value, false)
  lateA.resolve(pageTwo())
  await late
  await flush()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-b'])
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.refs.nextCursor.value, null)
  page.session.verifiedSubject = 'subject-a'
  page.session.identityRevision = 3
  page.watchers[0]()
  await flush()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-a2'])
  assert.equal(page.calls.deskArgs[3][0], null)
})

test('support page invalidates an in-flight load-more on hide without appending late data', async () => {
  const pending = deferred()
  const page = loadPage({ deskLoader: (count) => count === 1 ? pageOne() : pending.promise })
  await page.shown[0]()
  const late = page.test.loadMore()
  page.hidden[0]()
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.refs.nextCursor.value, null)
  assert.equal(page.refs.moreState.value, 'idle')
  pending.resolve(pageTwo())
  await late
  await flush()
  assert.deepEqual(page.refs.tickets.value.map((entry) => entry.ticketId), ['ticket-1', 'ticket-2'])
  assert.equal(page.refs.hasMore.value, false)
  assert.equal(page.refs.nextCursor.value, null)
})

test('support page keeps pagination continuation after opening and returning from a detail', async () => {
  const page = loadPage({ desk: pageOne(), detail: ticket('ticket-1') })
  await page.shown[0]()
  await page.test.openTicket('ticket-1')
  page.test.backToList()
  assert.equal(page.refs.listState.value, 'ready')
  assert.equal(page.refs.hasMore.value, true)
  assert.equal(page.refs.nextCursor.value, cursor2)
  assert.equal(page.refs.pageSize.value, 10)
  assert.equal(page.refs.tickets.value.length, 2)
})

test('support page does not issue a private load-more read without an authenticated subject', async () => {
  const page = loadPage({ desk: pageOne() })
  await page.shown[0]()
  const reads = page.calls.loadDesk
  page.session.isAuthenticated = false
  page.session.verifiedSubject = null
  await page.test.loadMore()
  assert.equal(page.calls.loadDesk, reads)
  assert.equal(page.refs.listState.value, 'error')
  assert.equal(page.refs.listErrorKind.value, 'unauthorized')
  assert.deepEqual(page.refs.tickets.value, [])
  assert.equal(page.refs.hasMore.value, false)
})

test('support page hides detail on onHide and observes theme subscription', async () => {
  const page = loadPage({ detail: ticket('ticket-1') })
  page.mounted.forEach((callback) => callback())
  assert.equal(page.refs.resolvedTheme.value, 'light')
  page.themeListeners[0]({ resolvedTheme: 'high-contrast' })
  assert.equal(page.refs.resolvedTheme.value, 'high-contrast')
  await page.test.openTicket('ticket-1')
  page.hidden[0]()
  assert.equal(page.refs.detailId.value, null)
  assert.equal(page.refs.detailState.value, 'idle')
  page.unmounted.forEach((callback) => callback())
  assert.equal(page.themeUnsubscribed(), 1)
})

test('support page SFC script and template compile without errors', () => {
  const filename = path.join(appRoot, pagePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup, 'Missing support page script setup block')
  const id = 'support-page-sfc'
  const script = compileScript(descriptor, { id })
  assert.match(script.content, /resetPrivateState/u)
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id,
    compilerOptions: { isCustomElement: () => true, bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
})

test('support page exposes no create form, upload, or write action', () => {
  const page = loadPage()
  assert.doesNotMatch(page.source, /<textarea|<form|type=["']file["']|createM1016SupportTicket|method:\s*['"]POST['"]/iu)
  assert.match(page.source, /loadMobileSupportDesk/u)
  assert.match(page.source, /readMobileSupportTicket/u)
})
