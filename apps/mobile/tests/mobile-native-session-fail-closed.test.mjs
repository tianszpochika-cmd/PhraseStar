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
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

const REFRESH_KEY = 'yx.auth.mobile.refresh-token'
let token = null
let identity = null
let adapter = null
let runtime = null
let refreshCalls = 0
let secure = null
let registeredSecure = null

function makeAdapter() {
  return {
    async login() {
      return {
        accessToken: 'synthetic-access',
        refreshToken: 'synthetic-refresh',
        deviceId: 'synthetic-device',
        sessionId: 'synthetic-session',
        adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
      }
    },
    async register() { throw new Error('unused') },
    async refresh() { refreshCalls += 1; return { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh' } },
    async getPermissions() {
      return { principal: { subject: 'subject-A' }, permissions: ['learning.plan.read'], adultGate: 'PASSED', adultLearningAccess: 'ELIGIBLE' }
    },
    async logout() {},
    async revoke() {},
  }
}

const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  if (name === 'vue') return vue
  if (name === 'pinia') return pinia
  if (name === '../auth/access-token') return {
    getInMemoryAccessToken: () => token,
    setInMemoryAccessToken: (value) => { token = value },
    setInMemoryRequestIdentity: (value) => { identity = value },
  }
  if (name === '../auth/auth-failure-copy') return { mobileAuthFailureMarker: (error) => error instanceof Error ? error.message : 'failed' }
  if (name === '../auth/gateway-auth') return { createGatewayMobileAuthAdapter: () => adapter, safeMobileReturnTo: (value) => value }
  if (name === '../platform/uni-runtime') return {
    getUniRuntime: () => runtime,
    isNativeAppRuntime: () => true,
  }
  if (name === '../platform/secure-storage-provider') return {
    resolveSecureStorage: () => (
      typeof runtime?.getSecureStorage === 'function' ? runtime.getSecureStorage() : registeredSecure ?? undefined
    ),
  }
  if (name === './learning-cache') return { removeAllLearningCaches() {} }
  throw new Error(`unexpected import ${name}`)
}, module, module.exports)

const { useSessionStore } = module.exports

function load() {
  pinia.setActivePinia(pinia.createPinia())
  token = null; identity = null; refreshCalls = 0
  registeredSecure = null
  adapter = makeAdapter()
  runtime = {
    request() {},
    getStorageSync: () => '',
    setStorageSync() {},
    removeStorageSync() {},
  }
  if (secure) runtime.getSecureStorage = () => secure
  const session = useSessionStore()
  session.setAuthAdapter(adapter)
  return session
}

test('native session login stays fail-closed when no secure provider exists', async () => {
  secure = null
  const session = load()
  assert.equal(await session.login('A', 'synthetic-password'), false)
  assert.equal(session.status, 'error')
  assert.match(session.lastError, /安全存储不可用/)
  assert.equal(session.accessToken, null)
  assert.equal(token, null)
})

test('native session login clears the in-memory session when secure write fails', async () => {
  secure = {
    getItem: () => null,
    setItem: () => { throw new Error('synthetic keychain write failure') },
    removeItem() {},
  }
  const session = load()
  assert.equal(await session.login('A', 'synthetic-password'), false)
  assert.equal(session.status, 'error')
  assert.match(session.lastError, /安全存储写入失败/)
  assert.equal(session.$state.accessToken, null)
  assert.equal(token, null)
})

test('a platform-registered provider is wired into the session boundary', async () => {
  const values = new Map()
  secure = null
  const session = load()
  registeredSecure = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }
  assert.equal(await session.login('A', 'synthetic-password'), true, session.lastError ?? 'login failed')
  assert.equal(session.status, 'authenticated')
  assert.equal(values.get(REFRESH_KEY), 'synthetic-refresh')
  session.clear()
  assert.equal(values.has(REFRESH_KEY), false)
})

test('an existing optional provider is used without an ordinary-storage fallback', async () => {
  const values = new Map()
  secure = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, value) { values.set(key, value) },
    removeItem(key) { values.delete(key) },
  }
  const session = load()
  assert.equal(await session.login('A', 'synthetic-password'), true)
  assert.equal(session.status, 'authenticated')
  assert.equal(values.get(REFRESH_KEY), 'synthetic-refresh')
  assert.equal(session.$state.accessToken, 'synthetic-access')
  session.clear()
  assert.equal(values.has(REFRESH_KEY), false)
  assert.equal(session.status, 'unauthenticated')
})

test('secure read failure restores to unauthenticated without a plain-storage or network fallback', async () => {
  secure = {
    getItem: () => { throw new Error('synthetic keychain read failure') },
    setItem() {},
    removeItem() {},
  }
  const session = load()
  await session.restore()
  assert.equal(session.status, 'unauthenticated')
  assert.equal(session.$state.accessToken, null)
  assert.equal(refreshCalls, 0)
})
