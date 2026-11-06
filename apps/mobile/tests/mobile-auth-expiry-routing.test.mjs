import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const source = fs.readFileSync(path.join(appRoot, 'src/api/client.ts'), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', compiled)((name) => {
  const snapshot = { accessToken: 'synthetic-access', identity: { subject: 'subject-A', revision: 7 }, revision: 7 }
  if (name === '../auth/access-token') return { getInMemoryAuthRequestSnapshot: () => snapshot }
  if (name === '../platform/uni-runtime') return { getUniRuntime: () => ({ request: (options) => { requests.push(options) } }) }
  if (name === '../platform/gateway') return { getGatewayBaseUrl: () => 'https://gateway.test', getIamAuthBaseUrl: () => 'https://iam.test/api/v1', requireIamAuthBaseUrl: (value) => value }
  throw new Error(`unexpected import ${name}`)
}, module, module.exports)
const requests = []
const { createMobileApiClient, setMobileApiErrorHandler, MobileApiError } = module.exports
const context = { uiLocale: 'zh-CN', contentLocale: 'en-US' }
function makeClient(onUnauthorized) { return createMobileApiClient('https://gateway.test', onUnauthorized, () => ({ accessToken: 'synthetic-access', identity: { subject: 'subject-A', revision: 7 }, revision: 7 })) }
function settle(promise) { return promise.then(value => ({ value }), error => ({ error })) }
function reply(index, status) { requests[index].success({ statusCode: status, data: status === 401 ? { code: 'UNAUTHORIZED' } : { data: 'ok' } }) }
function reset() { requests.length = 0; setMobileApiErrorHandler(undefined) }

test('expired refresh routes global 401 once and does not retry', async () => {
  reset()
  let routed = 0
  setMobileApiErrorHandler((status) => { if (status === 401) routed += 1 })
  const client = makeClient(async () => ({ refreshed: false, expired: true, consume: () => true }))
  const pending = settle(client.request('/protected/mistakes', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 401)
  const result = await pending
  assert.equal(routed, 1)
  assert.equal(requests.length, 1)
  assert.equal(result.error.status, 401)
  setMobileApiErrorHandler(undefined)
})

test('concurrent expired refreshes share one routing event', async () => {
  reset()
  let routed = 0
  let consumed = 0
  const outcome = { refreshed: false, expired: true, consume: () => { consumed += 1; return consumed === 1 } }
  setMobileApiErrorHandler((status) => { if (status === 401) routed += 1 })
  const client = makeClient(async () => outcome)
  const first = settle(client.request('/protected/one', { timeout: 1000 }))
  const second = settle(client.request('/protected/two', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 401); reply(1, 401)
  const [one, two] = await Promise.all([first, second])
  assert.equal(routed, 1)
  assert.equal(consumed, 2)
  assert.equal(one.error.status, 401)
  assert.equal(two.error.status, 401)
  setMobileApiErrorHandler(undefined)
})

test('refreshed true retries the original request exactly once', async () => {
  reset()
  let called = 0
  const client = makeClient(async () => { called += 1; return true })
  const pending = settle(client.request('/protected/retry', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 401); await Promise.resolve(); reply(1, 200)
  const result = await pending
  assert.equal(called, 1)
  assert.equal(requests.length, 2)
  assert.deepEqual(result.value, { data: 'ok' })
})

test('403 still uses the shared forbidden handler and does not retry', async () => {
  reset()
  let routed = 0
  setMobileApiErrorHandler((status) => { if (status === 403) routed += 1 })
  const client = makeClient(async () => { throw new Error('must not refresh on 403') })
  const pending = settle(client.request('/protected/forbidden', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 403)
  const result = await pending
  assert.equal(routed, 1)
  assert.equal(requests.length, 1)
  assert.equal(result.error.status, 403)
  setMobileApiErrorHandler(undefined)
})

test('expired outcome without ownership consumption never routes another account', async () => {
  reset()
  let routed = 0
  setMobileApiErrorHandler(() => { routed += 1 })
  const client = makeClient(async () => ({ refreshed: false, expired: true, consume: () => false }))
  const pending = settle(client.request('/protected/stale', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 401)
  const result = await pending
  assert.equal(routed, 0)
  assert.equal(requests.length, 1)
  assert.equal(result.error.status, 401)
  setMobileApiErrorHandler(undefined)
})

test('legacy boolean false preserves current-owner 401 notification and no retry', async () => {
  reset()
  let routed = 0
  setMobileApiErrorHandler(() => { routed += 1 })
  const client = makeClient(async () => false)
  const pending = settle(client.request('/protected/legacy-false', { timeout: 1000 }))
  await Promise.resolve(); reply(0, 401)
  const result = await pending
  assert.equal(routed, 1)
  assert.equal(requests.length, 1)
  assert.equal(result.error.status, 401)
  setMobileApiErrorHandler(undefined)
})

test('legacy boolean false ignores a request whose owner changed', async () => {
  reset()
  let routed = 0
  let current = { accessToken: 'synthetic-access', identity: { subject: 'subject-A', revision: 7 }, revision: 7 }
  setMobileApiErrorHandler(() => { routed += 1 })
  const client = createMobileApiClient('https://gateway.test', async () => false, () => current)
  const pending = settle(client.request('/protected/legacy-owner-change', { timeout: 1000 }))
  await Promise.resolve()
  current = { accessToken: 'synthetic-other', identity: { subject: 'subject-B', revision: 8 }, revision: 8 }
  reply(0, 401)
  const result = await pending
  assert.equal(routed, 0)
  assert.equal(requests.length, 1)
  assert.equal(result.error.status, 401)
  setMobileApiErrorHandler(undefined)
})
