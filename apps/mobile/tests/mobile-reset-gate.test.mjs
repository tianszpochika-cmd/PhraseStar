// Standard node --test portable reset gate regression. Copy to apps/mobile/tests later.
// Executes the real useSessionStore with a controlled MobileAuthAdapter and Pinia.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const appRoot = process.env.UI_RESET_PROJECT_ROOT
  ? path.join(process.env.UI_RESET_PROJECT_ROOT, 'apps/mobile')
  : path.resolve(import.meta.dirname, '..')
const require = createRequire(path.join(appRoot, 'package.json'))
const { createPinia, setActivePinia } = require('pinia')

function loadTs(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name in modules) return modules[name]
    return require(name)
  }, module, module.exports)
  return module.exports
}

const tokenModule = loadTs('src/auth/access-token.ts', {})
const failureModule = loadTs('src/auth/auth-failure-copy.ts', {})
const storage = new Map()
globalThis.window = { localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } }
globalThis.sessionStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }

function adapterFor(gate, access) {
  const calls = { login: 0, refresh: 0, restore: 0, permissions: 0, request: 0, confirm: 0, requestStatus: 202, confirmStatus: 204 }
  let requestError = null
  let confirmError = null
  const snapshot = (subject = 'subject-a') => ({
    principal: { subject, roles: ['LEARNER'], permissions: gate === 'PASSED' && access === 'ELIGIBLE' ? ['learning.plan.read'] : [], adultGate: gate, adultLearningAccess: access },
    permissions: gate === 'PASSED' && access === 'ELIGIBLE' ? ['learning.plan.read'] : [],
    adultGate: gate,
    adultLearningAccess: access,
    tokenPair: { accessToken: 'synthetic-access', refreshToken: null, deviceId: 'synthetic-device', sessionId: 'synthetic-session', adultGate: gate, adultLearningAccess: access },
  })
  return {
    calls,
    snapshot,
    setRequestError(value) { requestError = value },
    setConfirmError(value) { confirmError = value },
    async login() { calls.login += 1; return snapshot().tokenPair },
    async register() { return snapshot().tokenPair },
    async requestPasswordReset() { calls.request += 1; if (requestError) throw requestError; return { accepted: true, status: calls.requestStatus } },
    async confirmPasswordReset() { calls.confirm += 1; if (confirmError) throw confirmError; return { status: calls.confirmStatus } },
    async restoreSession() { calls.restore += 1; return snapshot() },
    async refresh() { calls.refresh += 1; return snapshot().tokenPair },
    async getPermissions() { calls.permissions += 1; return snapshot() },
    async confirmAdultGate() { return snapshot() },
    async logout() {},
    async revoke() {},
  }
}

function sessionFactory() {
  setActivePinia(createPinia())
  const gateway = { createGatewayMobileAuthAdapter: () => { throw new Error('controlled adapter must be set') }, safeMobileReturnTo: (value, fallback = '/pages/home/home') => typeof value === 'string' && /^\/pages\//.test(value) ? value : fallback }
  const uni = { isNativeAppRuntime: () => false, getUniRuntime: () => ({}) }
  const cache = { removeAllLearningCaches: () => {} }
  const secureStorageProvider = loadTs('src/platform/secure-storage-provider.ts', { './uni-runtime': uni })
  const sessionModule = loadTs('src/stores/session.ts', {
    vue: require('vue'), pinia: require('pinia'),
    '../auth/access-token': tokenModule,
    '../auth/auth-failure-copy': failureModule,
    '../auth/gateway-auth': gateway,
    '../platform/uni-runtime': uni,
    '../platform/secure-storage-provider': secureStorageProvider,
    './learning-cache': cache,
  })
  tokenModule.setInMemoryAccessToken(null)
  const store = sessionModule.useSessionStore()
  return store
}

function authFacts(store) {
  return {
    status: store.status,
    authenticated: store.isAuthenticated,
    restored: store.restored,
    subjectPresent: Boolean(store.verifiedSubject),
    identityRevision: store.identityRevision,
    tokenPresent: Boolean(store.accessToken),
    adultGate: store.adultGate,
    adultLearningAccess: store.adultLearningAccess,
    learningReady: store.isLearningReady,
  }
}

async function setup(kind, gate, access) {
  const session = sessionFactory()
  const adapter = adapterFor(gate, access)
  session.setAuthAdapter(adapter)
  if (kind === 'restore') {
    tokenModule.setInMemoryAccessToken('synthetic-access')
    await session.restore()
  } else {
    assert.equal(await session.login('synthetic-account', 'synthetic-password'), true)
  }
  return { session, adapter }
}

for (const [gate, access, kind] of [
  ['PASSED', 'ELIGIBLE', 'restore'],
  ['REQUIRED', 'RESTRICTED', 'login'],
  ['REJECTED', 'RESTRICTED', 'login'],
]) {
  test(`reset request 202 + confirm 204 does not change adultGate ${gate} (${kind})`, async () => {
    const { session, adapter } = await setup(kind, gate, access)
    const before = authFacts(session)
    if (kind === 'restore') assert.equal(adapter.calls.restore, 1); else assert.equal(adapter.calls.login, 1)
    const loginBefore = adapter.calls.login
    const refreshBefore = adapter.calls.refresh
    const restoreBefore = adapter.calls.restore
    assert.equal(await session.requestPasswordReset('synthetic-account'), true)
    assert.equal(adapter.calls.request, 1)
    assert.equal(adapter.calls.requestStatus, 202)
    assert.equal(await session.confirmPasswordReset('synthetic-account', 'synthetic-reset-code', 'SyntheticOnly123'), true)
    assert.equal(adapter.calls.confirm, 1)
    assert.equal(adapter.calls.confirmStatus, 204)
    const after = authFacts(session)
    assert.deepEqual(after, before)
    assert.equal(adapter.calls.login, loginBefore)
    assert.equal(adapter.calls.refresh, refreshBefore)
    assert.equal(adapter.calls.restore, restoreBefore)
    assert.equal(after.adultGate, gate)
    assert.equal(after.adultLearningAccess, access)
    assert.equal(after.learningReady, gate === 'PASSED' && access === 'ELIGIBLE')
  })
}

test('reset request 202/confirm 204 preserve PASSED learning readiness and do not issue tokens', async () => {
  const { session, adapter } = await setup('login', 'PASSED', 'ELIGIBLE')
  const before = authFacts(session)
  assert.equal(before.learningReady, true)
  assert.equal(await session.requestPasswordReset('synthetic-account'), true)
  assert.equal(await session.confirmPasswordReset('synthetic-account', 'synthetic-reset-code', 'SyntheticOnly123'), true)
  assert.deepEqual(authFacts(session), before)
  assert.equal(adapter.calls.login, 1)
  assert.equal(adapter.calls.refresh, 0)
})

for (const status of [401, 429, 503]) {
  test(`reset request ${status} fails truthfully without changing gate or issuing auth`, async () => {
    const { session, adapter } = await setup('login', 'PASSED', 'ELIGIBLE')
    const before = authFacts(session)
    adapter.setRequestError(Object.assign(new Error(`synthetic-${status}`), { status }))
    assert.equal(await session.requestPasswordReset('synthetic-account'), false)
    assert.deepEqual(authFacts(session), before)
    assert.equal(adapter.calls.request, 1)
    assert.equal(adapter.calls.login, 1)
    assert.equal(adapter.calls.refresh, 0)
    assert.ok(typeof session.lastError === 'string' && session.lastError.length > 0)
  })
}

test('reset confirm invalid 401 fails truthfully without changing gate or issuing auth', async () => {
  const { session, adapter } = await setup('login', 'REQUIRED', 'RESTRICTED')
  const before = authFacts(session)
  adapter.setConfirmError(Object.assign(new Error('synthetic-invalid'), { status: 401, code: 'iam.password_reset.invalid' }))
  assert.equal(await session.confirmPasswordReset('synthetic-account', 'synthetic-reset-code', 'SyntheticOnly123'), false)
  assert.deepEqual(authFacts(session), before)
  assert.equal(adapter.calls.confirm, 1)
  assert.equal(adapter.calls.login, 1)
  assert.equal(adapter.calls.refresh, 0)
  assert.ok(typeof session.lastError === 'string' && session.lastError.length > 0)
})
