import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadShareApi() {
  const requests = []
  let sequence = 0
  let respond = async () => ({ ref: 'a'.repeat(32), expiresAt: '2026-10-18T00:00:00Z', publicPath: `/api/v1/public/learning/report-shares/${'a'.repeat(32)}` })
  const compiled = ts.transpileModule(read('src/api/b10.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  class ApiError extends Error {
    constructor(message, status, details) {
      super(message)
      this.status = status
      this.details = details
    }
  }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name === './client') {
      return {
        ApiError,
        apiClient: {
          post: async (requestPath, body, options) => {
            requests.push({ path: requestPath, body, options })
            return respond()
          },
        },
      }
    }
    if (name === './unavailable') return { unavailableOperation: async () => { throw new Error('closed') } }
    if (name === '../domain/grammar-reading-pack') return { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' }
    if (name === '../platform/v2-foundation') return { learnerI18n: { locale: 'zh-CN', contentLocale: 'en-US' } }
    if (name === '../platform/client-id') return { createClientId: (prefix = 'client') => `${prefix}-test-${String(++sequence).padStart(2, '0')}` }
    throw new Error(`unexpected import ${name}`)
  }, module, module.exports)
  return {
    api: module.exports,
    requests,
    ApiError,
    setRespond(next) { respond = next },
  }
}

function headerKey(request) {
  return request.options.headers.get('Idempotency-Key')
}

test('learner-web share writes send one generated key per intent and reuse it on transient retry', async () => {
  const loaded = loadShareApi()
  const key = 'lw-report-share-1234567'
  const first = await loaded.api.issueReportShare('DAILY')
  const second = await loaded.api.issueReportShare('DAILY')
  assert.equal(first.ref, 'a'.repeat(32))
  assert.equal(loaded.requests[0].path, '/learning/reports/DAILY/shares')
  assert.match(headerKey(loaded.requests[0]), /^lw-report-share-test-01$/)
  assert.match(headerKey(loaded.requests[1]), /^lw-report-share-test-02$/)
  assert.notEqual(headerKey(loaded.requests[0]), headerKey(loaded.requests[1]))
  assert.equal(second.ref, first.ref)

  await loaded.api.issueReportShare('WEEKLY', { idempotencyKey: key })
  assert.equal(headerKey(loaded.requests[2]), key)

  const beforeReject = loaded.requests.length
  await assert.rejects(
    () => loaded.api.issueReportShare('DAILY', { idempotencyKey: 'short' }),
    (error) => error instanceof loaded.ApiError && error.status === 400 && error.details.code === 'IDEMPOTENCY_KEY_INVALID',
  )
  await assert.rejects(() => loaded.api.issueReportShare('DAILY', { idempotencyKey: '' }), (error) => error.status === 400)
  await assert.rejects(() => loaded.api.revokeReportShare('b'.repeat(32), { idempotencyKey: 'short' }), (error) => error.status === 400)
  assert.equal(loaded.requests.length, beforeReject)

  let failures = 1
  loaded.setRespond(async () => {
    if (failures > 0) {
      failures -= 1
      throw Object.assign(new Error('unavailable'), { status: 503 })
    }
    return { ref: 'a'.repeat(32), expiresAt: '2026-10-18T00:00:00Z', publicPath: `/api/v1/public/learning/report-shares/${'a'.repeat(32)}` }
  })
  await loaded.api.issueReportShare('DAILY', { idempotencyKey: key })
  assert.equal(loaded.requests.length, beforeReject + 2)
  assert.equal(headerKey(loaded.requests[beforeReject]), key)
  assert.equal(headerKey(loaded.requests[beforeReject + 1]), key)

  loaded.setRespond(async () => ({ ref: 'a'.repeat(32), expiresAt: '2026-10-18T00:00:00Z', publicPath: `/api/v1/public/learning/report-shares/${'a'.repeat(32)}` }))
  const revokeRef = 'c'.repeat(32)
  await loaded.api.revokeReportShare(revokeRef)
  await loaded.api.revokeReportShare(revokeRef, { idempotencyKey: 'lw-report-share-revk1' })
  const revokeRequests = loaded.requests.slice(-2)
  assert.equal(revokeRequests[0].path, `/learning/report-shares/${revokeRef}/revoke`)
  assert.match(headerKey(revokeRequests[0]), /^lw-report-share-revoke-test-03$/)
  assert.equal(headerKey(revokeRequests[1]), 'lw-report-share-revk1')
})

test('learner-web report page caches one issue key per type and sends a revoke key', () => {
  const source = read('src/pages/B2ReportPage.vue')
  assert.match(source, /createClientId\('lw-report-share'\)/)
  assert.match(source, /createClientId\('lw-report-share-revoke'\)/)
  assert.match(source, /issueShareKeys\.get\(type\)/)
  assert.match(source, /revokeShareKeys\.get\(ref\)/)
  assert.match(source, /issueReportShare\(type, \{ idempotencyKey: key \}\)/)
  assert.match(source, /revokeReportShare\(ref, \{ idempotencyKey: key \}\)/)
})
