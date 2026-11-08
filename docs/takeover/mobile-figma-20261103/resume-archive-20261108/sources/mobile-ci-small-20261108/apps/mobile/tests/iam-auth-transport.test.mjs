import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadEsm(relativePath) {
  const filename = path.join(appRoot, relativePath)
  const source = fs.readFileSync(filename, 'utf8')
  const transpiled = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true },
  }).outputText
  return import(`data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled)}`)
}

function loadCjs(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`unexpected import ${name} from ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

test('mobile IAM auth base stays on TLS and rejects an http override', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  assert.equal(gateway.getIamAuthBaseUrl({}), 'https://127.0.0.1:18087/api/v1')
  assert.equal(gateway.getGatewayBaseUrl({}), 'http://127.0.0.1:18070/api/v1')
  assert.equal(gateway.getIamAuthBaseUrl({ VITE_IAM_AUTH_BASE_URL: 'http://127.0.0.1:18070/api/v1' }), 'https://127.0.0.1:18087/api/v1')
  assert.throws(() => gateway.requireIamAuthBaseUrl('http://127.0.0.1:18087/api/v1'), /HTTPS/)
})

function headerOf(call, name) {
  const header = call.options?.header ?? {}
  const match = Object.keys(header).find((key) => key.toLowerCase() === name.toLowerCase())
  return match ? header[match] : undefined
}

function loadAuthAdapter(calls, native) {
  function client(name, url) {
    return {
      async request(path, options = {}) {
        calls.push({ name, url: `${url}${path}`, path, options })
        if (path.includes('password-reset')) return { accepted: true }
        return { accessToken: 'token-1', sessionId: 'session-1' }
      },
    }
  }
  const auth = loadCjs('src/auth/gateway-auth.ts', {
    '../api/client': {
      MobileApiError: class MobileApiError extends Error { constructor(message, status) { super(message); this.status = status } },
      mobileApiClient: client('gateway', 'http://127.0.0.1:18070/api/v1'),
      mobileIamAuthClient: client('iam', 'https://127.0.0.1:18087/api/v1'),
      mobileIamBearerClient: client('iam-bearer', 'https://127.0.0.1:18087/api/v1'),
    },
    '../platform/gateway': { safeInternalReturnTo: (value, fallback) => (typeof value === 'string' ? value : fallback) },
    '../platform/uni-runtime': { isNativeAppRuntime: () => native },
  })
  return auth.createGatewayMobileAuthAdapter()
}

test('mobile password posts and refresh use bearer-less IAM TLS; H5 logout and current-session revoke use the in-memory bearer IAM client', async () => {
  const calls = []
  const adapter = loadAuthAdapter(calls, false)
  const password = 'fixture-password'
  const credentials = { identifier: 'learner@example.com', password, device: { deviceType: 'MOBILE', clientVersion: 'test' } }
  await adapter.login(credentials)
  await adapter.register(credentials)
  await adapter.requestPasswordReset({ identifier: 'learner@example.com' })
  await adapter.confirmPasswordReset({ identifier: 'learner@example.com', resetToken: 'reset-token', newPassword: password })
  await adapter.getPermissions()
  await adapter.refresh()
  await adapter.logout()
  await adapter.revoke('session-1')

  const sequence = calls.map((call) => ({
    name: call.name,
    url: call.url,
    method: call.options.method ?? 'GET',
  }))
  // getPermissions reads /iam/principal/me. That principal contract carries the
  // current permissions and adult eligibility. The old fixed calls[4] expected
  // /iam/permissions; the Gateway client route for that path stays in the next test.
  assert.deepEqual(sequence, [
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/login', method: 'POST' },
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/register', method: 'POST' },
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/password-reset/request', method: 'POST' },
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/password-reset/confirm', method: 'POST' },
    { name: 'gateway', url: 'http://127.0.0.1:18070/api/v1/iam/principal/me', method: 'GET' },
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/token/refresh', method: 'POST' },
    { name: 'iam-bearer', url: 'https://127.0.0.1:18087/api/v1/auth/logout', method: 'POST' },
    { name: 'iam-bearer', url: 'https://127.0.0.1:18087/api/v1/auth/sessions/session-1/revoke', method: 'POST' },
  ])
  const secretPosts = calls.filter((call) => (
    call.url.endsWith('/auth/login')
    || call.url.endsWith('/auth/register')
    || call.url.endsWith('/auth/password-reset/confirm')
  ))
  assert.equal(secretPosts.length, 3)
  assert.ok(secretPosts.every((call) => call.name === 'iam' && call.url.startsWith('https://') && JSON.stringify(call.options.data).includes(password)))
  assert.equal(calls.some((call) => call.name !== 'iam' && JSON.stringify(call.options.data ?? {}).includes(password)), false)
  assert.ok(calls.filter((call) => call.name === 'iam' || call.name === 'iam-bearer').every((call) => call.url.startsWith('https://127.0.0.1:18087/')))
  assert.ok(calls.filter((call) => call.name === 'gateway').every((call) => call.url.startsWith('http://127.0.0.1:18070/')))
  const h5SessionPosts = calls.filter((call) => call.name === 'iam-bearer')
  assert.equal(h5SessionPosts.length, 2)
  assert.ok(h5SessionPosts.every((call) => headerOf(call, 'X-Auth-Transport') === undefined))
})

test('native logout and current-session revoke stay on the Gateway client', async () => {
  const calls = []
  const adapter = loadAuthAdapter(calls, true)
  const password = 'fixture-password'
  await adapter.login({ identifier: 'learner@example.com', password, device: { deviceType: 'IOS', clientVersion: 'test' } })
  await adapter.logout()
  await adapter.revoke('session-1')
  assert.deepEqual(calls.map((call) => ({ name: call.name, url: call.url, method: call.options.method ?? 'GET' })), [
    { name: 'iam', url: 'https://127.0.0.1:18087/api/v1/auth/login', method: 'POST' },
    { name: 'gateway', url: 'http://127.0.0.1:18070/api/v1/auth/logout', method: 'POST' },
    { name: 'gateway', url: 'http://127.0.0.1:18070/api/v1/auth/sessions/session-1/revoke', method: 'POST' },
  ])
  assert.equal(JSON.stringify(calls[0].options.data).includes(password), true)
  assert.equal(calls.some((call) => call.name === 'iam-bearer'), false)
  assert.ok(calls.slice(1).every((call) => call.name === 'gateway' && headerOf(call, 'X-Auth-Transport') === undefined))
})

test('mobile IAM client posts the password to TLS without the current bearer', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  const requests = []
  const api = loadCjs('src/api/client.ts', {
    '../platform/gateway': gateway,
    '../platform/uni-runtime': {
      getUniRuntime: () => ({
        request(options) {
          requests.push(options)
          options.success({ statusCode: 201, data: { accessToken: 'token-1' } })
        },
      }),
    },
    '../auth/access-token': {
      getInMemoryAuthRequestSnapshot: () => ({
        accessToken: 'stale-bearer',
        identity: { subject: 'A', revision: 3 },
        revision: 3,
      }),
    },
  })
  await api.mobileIamAuthClient.request('/auth/login', {
    method: 'POST',
    data: { identifier: 'learner@example.com', password: 'fixture-password' },
    skipAuthRetry: true,
  })
  assert.equal(requests[0].url, 'https://127.0.0.1:18087/api/v1/auth/login')
  assert.equal(requests[0].header.Authorization, undefined)
  assert.equal(requests[0].withCredentials, true)
  assert.equal(requests[0].data.password, 'fixture-password')

  requests.length = 0
  await api.mobileApiClient.request('/iam/permissions', { skipAuthRetry: true, authBootstrap: 'identity' })
  assert.equal(requests[0].url, 'http://127.0.0.1:18070/api/v1/iam/permissions')
  assert.equal(requests[0].header.Authorization, 'Bearer stale-bearer')
})

test('mobile IAM bearer client posts H5 logout to TLS with the in-memory bearer and credentials', async () => {
  const gateway = await loadEsm('src/platform/gateway.ts')
  const requests = []
  const snapshot = {
    accessToken: 'memory-bearer',
    identity: { subject: 'A', revision: 3 },
    revision: 3,
  }
  const api = loadCjs('src/api/client.ts', {
    '../platform/gateway': gateway,
    '../platform/uni-runtime': {
      getUniRuntime: () => ({
        request(options) {
          requests.push(options)
          options.success({ statusCode: 200, data: { status: 'REVOKED' } })
        },
      }),
    },
    '../auth/access-token': {
      getInMemoryAuthRequestSnapshot: () => snapshot,
    },
  })
  await api.mobileIamBearerClient.request('/auth/logout', {
    method: 'POST',
    data: {},
    skipAuthRetry: true,
    authBootstrap: 'logout',
  })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, 'https://127.0.0.1:18087/api/v1/auth/logout')
  assert.equal(requests[0].withCredentials, true)
  assert.equal(requests[0].header.Authorization, `Bearer ${snapshot.accessToken}`)
  assert.equal(requests[0].header['X-Auth-Transport'], undefined)
  assert.equal(Object.keys(requests[0].header).some((key) => key.toLowerCase() === 'x-auth-transport'), false)

  requests.length = 0
  await api.mobileIamAuthClient.request('/auth/login', {
    method: 'POST',
    data: { identifier: 'learner@example.com', password: 'fixture-password' },
    skipAuthRetry: true,
  })
  assert.equal(requests[0].url, 'https://127.0.0.1:18087/api/v1/auth/login')
  assert.equal(requests[0].header.Authorization, undefined)
  assert.equal(requests[0].withCredentials, true)
})
