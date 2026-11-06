import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue = require('vue')
const pinia = require('pinia')
const appRoot = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/stores/session.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
let token = null
let identity = null
let adapter = null
const storage = new Map()
function makeAdapter(subject = 'subject-A') {
  return {
    async login() { return { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', deviceId: 'synthetic-device', sessionId: 'synthetic-session', adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } } },
    async register() { throw new Error('unused') },
    async refresh() { return { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' } },
    async getPermissions() { return { principal: { subject }, permissions: ['learning.plan.read'], adultGate: 'PASSED', adultLearningAccess: 'ELIGIBLE' } },
    async logout() {},
    async revoke() {},
  }
}
const clientRequests = []
const runtime = { request(options) { clientRequests.push(options) }, getStorageSync: (key) => storage.get(key) ?? '', setStorageSync: (key, value) => storage.set(key, value), removeStorageSync: (key) => storage.delete(key) }
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  if (name === 'vue') return vue
  if (name === 'pinia') return pinia
  if (name === '../auth/access-token') return {
    getInMemoryAccessToken: () => token,
    setInMemoryAccessToken: (value) => { token = value },
    setInMemoryRequestIdentity: (value) => { identity = value },
  }
  if (name === '../auth/auth-failure-copy') return { mobileAuthFailureMarker: () => 'failed' }
  if (name === '../auth/gateway-auth') return { createGatewayMobileAuthAdapter: () => adapter, safeMobileReturnTo: (value) => value }
  if (name === '../platform/uni-runtime') return { getUniRuntime: () => runtime, isNativeAppRuntime: () => false }
  if (name === './learning-cache') return { removeAllLearningCaches() {} }
  throw new Error(`unexpected import ${name}`)
}, module, module.exports)
const clientSource = fs.readFileSync(path.join(appRoot, 'src/api/client.ts'), 'utf8')
const clientCompiled = ts.transpileModule(clientSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const clientModule = { exports: {} }
new Function('require', 'module', 'exports', clientCompiled)((name) => {
  if (name === '../auth/access-token') return { getInMemoryAuthRequestSnapshot: () => ({ accessToken: token, identity, revision: identity?.revision ?? 0 }) }
  if (name === '../platform/uni-runtime') return { getUniRuntime: () => runtime }
  if (name === '../platform/gateway') return { getGatewayBaseUrl: () => 'https://gateway.test', getIamAuthBaseUrl: () => 'https://iam.test/api/v1', requireIamAuthBaseUrl: (value) => value }
  throw new Error(`unexpected client import ${name}`)
}, clientModule, clientModule.exports)
const { createMobileApiClient, setMobileApiErrorHandler } = clientModule.exports
const { useSessionStore } = module.exports
function makeStore(subject = 'subject-A') {
  pinia.setActivePinia(pinia.createPinia())
  token = null; identity = null; storage.clear(); adapter = makeAdapter(subject)
  const session = useSessionStore()
  session.setAuthAdapter(adapter)
  return session
}
function settle(promise) { return promise.then(value => ({ value }), error => ({ error })) }
function liveClient(session) {
  return createMobileApiClient('https://gateway.test', async (id) => session.refreshForIdentity(id), () => ({ accessToken: token, identity: session.getMobileApiIdentity(), revision: session.identityRevision }))
}
function heldRefresh(outcome) {
  const heldAdapter = adapter
  let release
  let calls = 0
  heldAdapter.refresh = () => {
    calls += 1
    return new Promise((resolve, reject) => {
      release = () => outcome === 'success'
        ? resolve({ accessToken: 'synthetic-refreshed', refreshToken: 'synthetic-refresh' })
        : reject(Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }))
    })
  }
  return { get calls() { return calls }, release: () => release && release() }
}
function expiredRefresh(session) {
  adapter.refresh = async () => { throw Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }) }
  return session.refreshForIdentity(session.getMobileApiIdentity())
}
test('actual client + actual store: two parallel 401s share one refresh and one global route', async () => {
  const session = makeStore()
  await session.login('A', 'synthetic-password')
  const identity = session.getMobileApiIdentity()
  let refreshCalls = 0
  let rejectRefresh
  adapter.refresh = () => { refreshCalls += 1; return new Promise((_, reject) => { rejectRefresh = reject }) }
  let routed = 0
  setMobileApiErrorHandler((status) => { if (status === 401) routed += 1 })
  clientRequests.length = 0
  const client = liveClient(session)
  const settle = p => p.then(value => ({ value }), error => ({ error }))
  const first = settle(client.request('/protected/a', { timeout: 1000 }))
  const second = settle(client.request('/protected/b', { timeout: 1000 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(clientRequests.length, 2)
  clientRequests[0].success({ statusCode: 401, data: {} })
  clientRequests[1].success({ statusCode: 401, data: {} })
  await new Promise(resolve => setImmediate(resolve))
  rejectRefresh(Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }))
  const [a, b] = await Promise.all([first, second])
  assert.equal(refreshCalls, 1)
  assert.equal(routed, 1)
  assert.equal(a.error.status, 401)
  assert.equal(b.error.status, 401)
  setMobileApiErrorHandler(undefined)
})

test('two waiters sharing one refresh401 mint one expiry fact', async () => {
  const session = makeStore()
  assert.equal(await session.login('A', 'synthetic-password'), true)
  const identity = session.getMobileApiIdentity()
  let refreshCalls = 0
  let rejectRefresh
  adapter.refresh = () => { refreshCalls += 1; return new Promise((_, reject) => { rejectRefresh = reject }) }
  const first = session.refreshForIdentity(identity)
  const second = session.refreshForIdentity(identity)
  await new Promise(resolve => setImmediate(resolve))
  rejectRefresh(Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }))
  const [a, b] = await Promise.all([first, second])
  assert.equal(refreshCalls, 1)
  assert.equal(a.expired, true)
  assert.equal(b.expired, true)
  assert.equal(a.consume(), true)
  assert.equal(b.consume(), false)
  assert.equal(session.status, 'unauthenticated')
})

test('old refresh expiry cannot rearm after explicit logout', async () => {
  const session = makeStore()
  await session.login('A', 'synthetic-password')
  const identity = session.getMobileApiIdentity()
  let rejectRefresh
  adapter.refresh = () => new Promise((_, reject) => { rejectRefresh = reject })
  const pending = session.refreshForIdentity(identity)
  await session.logout()
  rejectRefresh(Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }))
  const result = await pending
  assert.equal(result.expired, undefined)
  assert.equal(result.consume, undefined)
  assert.equal(session.status, 'unauthenticated')
})

test('old refresh expiry cannot rearm after same-subject new login revision', async () => {
  const session = makeStore()
  await session.login('A', 'synthetic-password')
  const firstIdentity = session.getMobileApiIdentity()
  let rejectRefresh
  adapter.refresh = () => new Promise((_, reject) => { rejectRefresh = reject })
  const pending = session.refreshForIdentity(firstIdentity)
  assert.equal(await session.login('A2', 'synthetic-password'), true)
  const secondIdentity = session.getMobileApiIdentity()
  assert.equal(secondIdentity.subject, firstIdentity.subject)
  assert.notEqual(secondIdentity.revision, firstIdentity.revision)
  rejectRefresh(Object.assign(new Error('SESSION_EXPIRED'), { status: 401 }))
  const result = await pending
  assert.equal(result.expired, undefined)
  assert.equal(session.status, 'authenticated')
})

test('separate expiry episodes each route once; previous pending cannot consume next session', async () => {
  const session = makeStore()
  await session.login('A', 'synthetic-password')
  const first = await expiredRefresh(session)
  assert.equal(first.expired, true)
  assert.equal(first.consume(), true)
  assert.equal(await session.login('A', 'synthetic-password'), true)
  assert.equal(first.consume(), false)
  const second = await expiredRefresh(session)
  assert.equal(second.expired, true)
  assert.notEqual(second.expiryId, first.expiryId)
  assert.equal(second.consume(), true)
  assert.equal(session.status, 'unauthenticated')
})

for (const outcome of ['success', 'failure']) {
  for (const target of ['different-subject', 'same-subject-new-revision', 'logout-guest']) {
    test(`held A refresh ${outcome} across ${target} does not retry/route/clear B`, async () => {
      const session = makeStore('subject-A')
      await session.login('A', 'synthetic-password')
      const oldClient = liveClient(session)
      const held = heldRefresh(outcome)
      let routed = 0
      setMobileApiErrorHandler(() => { routed += 1 })
      clientRequests.length = 0
      const pending = settle(oldClient.request('/protected/held-refresh', { timeout: 2000 }))
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(clientRequests.length, 1)
      clientRequests[0].success({ statusCode: 401, data: {} })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(held.calls, 1)
      if (target === 'different-subject') {
        adapter = makeAdapter('subject-B')
        session.setAuthAdapter(adapter)
        assert.equal(await session.login('B', 'synthetic-password'), true)
        assert.equal(session.getMobileApiIdentity().subject, 'subject-B')
      } else if (target === 'same-subject-new-revision') {
        const before = session.getMobileApiIdentity()
        assert.equal(await session.login('A2', 'synthetic-password'), true)
        const after = session.getMobileApiIdentity()
        assert.equal(after.subject, before.subject)
        assert.notEqual(after.revision, before.revision)
      } else {
        assert.equal(await session.logout(), true)
        assert.equal(session.status, 'unauthenticated')
        assert.equal(session.getMobileApiIdentity(), null)
      }
      held.release()
      const result = await pending
      assert.equal(result.error.status, 401)
      assert.equal(routed, 0)
      assert.equal(clientRequests.length, 1)
      if (target === 'logout-guest') {
        assert.equal(session.status, 'unauthenticated')
        assert.equal(session.getMobileApiIdentity(), null)
      } else {
        assert.equal(session.isAuthenticated, true)
        assert.equal(session.getMobileApiIdentity().subject, 'subject-' + (target === 'different-subject' ? 'B' : 'A'))
      }
      setMobileApiErrorHandler(undefined)
    })
  }
}

test('actual refresh success current A retries once; second 401 routes existing once', async () => {
  const session = makeStore('subject-A')
  await session.login('A', 'synthetic-password')
  adapter.refresh = async () => ({ accessToken: 'synthetic-refreshed', refreshToken: 'synthetic-refresh' })
  const client = liveClient(session)
  let routed = 0
  setMobileApiErrorHandler(() => { routed += 1 })
  clientRequests.length = 0
  const pending = settle(client.request('/protected/retry-after-refresh', { timeout: 2000 }))
  await new Promise(resolve => setImmediate(resolve))
  clientRequests[0].success({ statusCode: 401, data: {} })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(clientRequests.length, 2)
  clientRequests[1].success({ statusCode: 401, data: {} })
  const result = await pending
  assert.equal(result.error.status, 401)
  assert.equal(clientRequests.length, 2)
  assert.equal(routed, 1)
  assert.equal(session.isAuthenticated, true)
  setMobileApiErrorHandler(undefined)
})

test('public guest request never invokes refresh or global 401 route', async () => {
  const session = makeStore('subject-A')
  assert.equal(session.status, 'unknown')
  const client = liveClient(session)
  let routed = 0
  setMobileApiErrorHandler(() => { routed += 1 })
  clientRequests.length = 0
  const pending = settle(client.request('/public/guest', { timeout: 2000 }))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(clientRequests.length, 1)
  clientRequests[0].success({ statusCode: 401, data: {} })
  const result = await pending
  assert.equal(result.error.status, 401)
  assert.equal(routed, 0)
  assert.equal(session.getMobileApiIdentity(), null)
  setMobileApiErrorHandler(undefined)
})
