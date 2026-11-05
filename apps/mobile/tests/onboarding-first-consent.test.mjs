import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/mock-consent-publication.json', import.meta.url), 'utf8'))
const source = fs.readFileSync(new URL('../src/api/learner-content.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
class MobileApiError extends Error { constructor(message, status, details) { super(String(message)); this.status = status; this.details = details } }

const docs = fixture.documents.map((doc) => ({
  type: doc.type, purpose: doc.purpose, documentVersion: doc.documentVersion, documentDigest: doc.documentDigest,
  bodyText: doc.bodyText, publishedAt: doc.publishedAt, policyVersion: doc.policyVersion, policyRef: doc.policyRef,
}))
const required = [
  ['TERMS', 'ACCOUNT_TERMS'], ['PRIVACY', 'PRIVACY_NOTICE'], ['ADULT_LEARNING', 'ADULT_LEARNING_ELIGIBILITY'],
]
const exactRecord = (doc, overrides = {}) => ({
  type: doc.type, version: doc.documentVersion, purpose: doc.purpose, required: true, state: 'GRANTED',
  document: { version: doc.documentVersion, digest: doc.documentDigest, publishedAt: doc.publishedAt },
  provenance: { authority: 'IAM_SERVER_RECORDED_CONSENT', recordedAt: '2026-11-05T00:00:00Z', documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST', policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE' },
  policyRef: doc.policyRef, policyVersion: doc.policyVersion, decisionRef: `decision-${doc.type.toLowerCase()}`, ...overrides,
})
const putBody = (doc) => ({ type: doc.type, version: doc.documentVersion, decision: 'ACCEPTED', expectedDocumentDigest: doc.documentDigest })
const principal = (published = docs, overrides = {}) => ({
  adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' }, learningAccess: 'RESTRICTED',
  permissions: ['iam.consent.read', 'iam.consent.write'], publishedConsentDocuments: published,
  consentState: { accepted: false, requiredPurposes: required.map(([, purpose]) => purpose), unsatisfiedPurposes: required.map(([, purpose]) => purpose) },
  ...overrides,
})
function setup({ published = docs, records = [], responses = {}, current = () => true, refresh = true } = {}) {
  const calls = [], grants = [...records]
  let refreshCalls = 0
  const request = async (url, options = {}) => {
    const method = options.method || 'GET', path = String(url).split('?')[0]
    calls.push({ method, path, body: options.data })
    if (method === 'GET' && path === '/iam/principal/me') return principal(published)
    if (method === 'GET' && path === '/iam/consents') return { items: grants }
    if (method === 'PUT' && path === '/iam/consents') {
      const response = responses[options.data.type] ?? (() => exactRecord(docs.find((doc) => doc.type === options.data.type)))
      const value = typeof response === 'function' ? response(options.data) : response
      if (value instanceof Error) throw value
      if (value && value.state === 'GRANTED') grants.push(value)
      return value
    }
    throw new Error(`Unexpected ${method} ${path}`)
  }
  const session = { getMobileApiIdentity: () => ({ subject: 'owner-a', revision: 1 }), refreshSilentlyForIdentity: async () => { refreshCalls += 1; calls.push({ method: 'REFRESH', path: 'session' }); return refresh } }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name === './client') return { mobileApiClient: { request }, MobileApiError }
    if (name === '../stores/session') return { useSessionStore: () => session }
    if (name === '../stores/pinia') return { pinia: {} }
    throw new Error(`Unexpected require ${name}`)
  }, module, module.exports)
  return { api: module.exports.mobileLearnerContentApi, calls, isCurrent: current, refreshCalls: () => refreshCalls, puts: () => calls.filter((call) => call.method === 'PUT') }
}
const accept = (s, input = {}) => s.api.acceptViewedRequiredConsents({ decisionId: 'owner-decision-1', viewed: docs, isCurrent: s.isCurrent, ...input })

test('accepted path writes only the three exact required docs, then refreshes after a verified owner read', async () => {
  const s = setup()
  assert.equal(await accept(s), 'accepted')
  assert.deepEqual(s.puts().map((call) => call.body), docs.map((doc) => putBody(doc)))
  assert.equal(s.refreshCalls(), 1)
  assert.deepEqual(s.calls.map((call) => `${call.method} ${call.path}`), [
    'GET /iam/principal/me', 'GET /iam/consents',
    'PUT /iam/consents', 'PUT /iam/consents', 'PUT /iam/consents',
    'GET /iam/consents', 'REFRESH session',
  ])
})

test('existing exact required records skip every write but still refresh once', async () => {
  const s = setup({ records: docs.map((doc) => exactRecord(doc)) })
  assert.equal(await accept(s), 'accepted')
  assert.equal(s.puts().length, 0)
  assert.equal(s.refreshCalls(), 1)
})

test('wrong own purpose or provenance is unreadable and writes nothing', async () => {
  const wrongPurpose = docs.map((doc) => exactRecord(doc))
  wrongPurpose[0] = exactRecord(docs[0], { purpose: 'PRIVACY_NOTICE' })
  const wrongProvenance = docs.map((doc) => exactRecord(doc))
  wrongProvenance[0] = exactRecord(docs[0], {
    provenance: {
      authority: 'CLIENT_ASSERTED',
      recordedAt: '2026-11-05T00:00:00Z',
      documentSource: 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST',
      policySource: 'IAM_ACTIVE_POLICY_CONTROL_PLANE',
    },
  })
  for (const records of [wrongPurpose, wrongProvenance]) {
    const s = setup({ records })
    assert.equal(await accept(s), 'unreadable')
    assert.equal(s.puts().length, 0)
    assert.equal(s.refreshCalls(), 0)
  }
})

test('a well-formed grant with the wrong policy does not count as accepted', async () => {
  const records = docs.map((doc) => exactRecord(doc))
  records[0] = exactRecord(docs[0], { policyRef: 'iam://wrong/policy', policyVersion: 'wrong-policy' })
  const s = setup({ records })
  assert.equal(await accept(s), 'accepted')
  assert.deepEqual(s.puts().map((call) => call.body), [putBody(docs[0])])
  assert.equal(s.refreshCalls(), 1)
})

test('malformed first PUT receipt and an exact-shaped wrong document abort later documents', async () => {
  for (const [receipt, expected] of [[ {}, 'malformed' ], [ exactRecord(docs[1]), 'stale' ]]) {
    const s = setup({ responses: { TERMS: receipt } })
    assert.equal(await accept(s), expected)
    assert.deepEqual(s.puts().map((call) => call.body), [putBody(docs[0])])
    assert.equal(s.refreshCalls(), 0)
  }
})

test('lost page or changed owner during the first request prevents subsequent writes', async () => {
  const s = setup({ current: () => false })
  await assert.rejects(accept(s))
  assert.equal(s.puts().length, 0)
})

test('owner loss after the first accepted write prevents every later write', async () => {
  const s = setup()
  await assert.rejects(accept(s, { isCurrent: () => s.puts().length === 0 }))
  assert.equal(s.puts().length, 1)
})

test('stale preflight revision refuses all writes', async () => {
  const s = setup()
  await assert.rejects(accept(s, { isCurrent: () => s.calls.filter((call) => call.method === 'GET' && call.path === '/iam/principal/me').length === 0 }))
  assert.equal(s.puts().length, 0)
  assert.equal(s.refreshCalls(), 0)
})

test('invalid viewed body digest is closed before signing', async () => {
  const viewed = docs.map((doc) => doc.type === 'TERMS' ? { ...doc, documentDigest: 'f'.repeat(64) } : doc)
  const s = setup()
  assert.equal(await accept(s, { viewed }), 'closed')
  assert.equal(s.puts().length, 0)
  assert.equal(s.refreshCalls(), 0)
})

test('valid viewed documents with an invalid published digest are blocked', async () => {
  const published = docs.map((doc) => doc.type === 'TERMS' ? { ...doc, documentDigest: 'f'.repeat(64) } : doc)
  const s = setup({ published })
  assert.equal(await accept(s), 'stale')
  assert.equal(s.puts().length, 0)
  assert.equal(s.refreshCalls(), 0)
})
