'use strict'

/**
 * One same-key placement retest replay for a fresh B141 run.
 *
 * The probe calls holdAuthorizedRetest on the Playwright request after its
 * existing retest gate has accepted that request and before route.continue.
 * confirmClicks is still 0 there: the UI assigns it only after click() returns,
 * which is after this handler. The armed flag is the gate that is already true.
 *
 * replaySameKey runs only after that browser response is a confirmed 201 with
 * a new CREATED session. It reads the current same-owner report, posts the
 * held request once to Gateway, then reads the report again. It opens no
 * database connection and issues no SQL.
 *
 * Requiring this file sends nothing. Direct execution sends nothing.
 */

const http = require('node:http')

const OPT_IN = 'MB006_PLACEMENT_RETEST_REPLAY'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const RETEST_PATH = /^\/api\/v1\/assessment\/placement\/sessions\/([A-Za-z0-9_-]{1,128})\/retest$/
const SESSION_ID = /^asess_[A-Za-z0-9]{8,128}$/
const REPORT_ID = /^rpt_[A-Za-z0-9._:-]{8,127}$/
const DIGEST = /^[0-9a-f]{64}$/
const BEARER = /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/
const JSON_TYPE = /^application\/json(?:;\s*charset=utf-8)?$/i

const slot = {
  held: false,
  replayed: false,
  url: '',
  body: '',
  contentType: '',
  authorization: '',
  idempotencyKey: '',
  completedSessionId: '',
  reportId: '',
}

function fail(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function wipeSecrets() {
  slot.url = ''
  slot.body = ''
  slot.contentType = ''
  slot.authorization = ''
  slot.idempotencyKey = ''
}

function release() {
  wipeSecrets()
  slot.held = false
  slot.replayed = false
  slot.completedSessionId = ''
  slot.reportId = ''
}

function replayOptIn() {
  const value = process.env.MB006_PLACEMENT_RETEST_REPLAY
  if (value == null || value === '') return 'off'
  if (value === OPT_IN) return 'on'
  return 'invalid'
}

function header(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  const value = headers[name] ?? headers[name.toLowerCase()] ?? ''
  return typeof value === 'string' ? value : ''
}

function emptyBody(raw) {
  if (raw == null || raw === '') return { body: '', contentType: '' }
  if (raw === '{}') return { body: '{}', contentType: 'required' }
  return null
}

function gateway(method, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    const transport = () => Object.assign(new Error('replay-transport'), { code: 'replay-transport' })
    const req = http.request({
      protocol: 'http:',
      hostname: '127.0.0.1',
      port: 18070,
      method,
      path: pathname,
      headers,
      timeout: 10000,
    }, (res) => {
      const chunks = []
      let total = 0
      res.on('data', (chunk) => {
        total += chunk.length
        if (total > 1_000_000) {
          req.destroy()
          finish(reject, transport())
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => finish(resolve, {
        status: res.statusCode,
        raw: Buffer.concat(chunks).toString('utf8'),
      }))
      res.on('error', () => finish(reject, transport()))
    })
    req.on('timeout', () => {
      req.destroy()
      finish(reject, transport())
    })
    req.on('error', () => finish(reject, transport()))
    if (body == null) req.end()
    else req.end(body)
  })
}

function reportIdentity(raw, completedSessionId, reportId) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return null }
  const data = parsed && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
    ? parsed.data
    : null
  if (!data) return null
  const nested = data.result && typeof data.result === 'object' && !Array.isArray(data.result)
    ? data.result
    : null
  const seenReportId = typeof data.reportId === 'string' ? data.reportId : (nested ? nested.reportId : '')
  const seenSessionId = typeof data.sessionId === 'string' ? data.sessionId : (nested ? nested.sessionId : '')
  const resultKind = typeof data.resultKind === 'string' ? data.resultKind : (nested ? nested.resultKind : '')
  const digest = typeof data.digest === 'string'
    ? data.digest
    : (nested && typeof nested.reportDigest === 'string' ? nested.reportDigest : '')
  if (seenReportId !== reportId || seenSessionId !== completedSessionId || resultKind !== 'ASSESSED') return null
  if (!DIGEST.test(digest)) return null
  return { reportId: seenReportId, sessionId: seenSessionId, digest }
}

async function readReport(authorization, completedSessionId, reportId) {
  const response = await gateway('GET', `/api/v1/assessment/placement/reports/${reportId}`, {
    Authorization: authorization,
  })
  if (response.status !== 200) fail('report-read')
  if (!reportIdentity(response.raw, completedSessionId, reportId)) fail('report-read')
  return response.raw
}

function assertFreshObserved(observed, completedSessionId) {
  if (!observed || typeof observed !== 'object') fail('observed-session-not-fresh')
  if (observed.status !== 201) fail('observed-session-not-fresh')
  if (typeof observed.sessionId !== 'string' || !SESSION_ID.test(observed.sessionId)) fail('observed-session-not-fresh')
  if (observed.sessionId === completedSessionId) fail('observed-session-not-fresh')
  if (observed.acceptedSequence !== 0 || observed.nextSequence !== 1 || observed.stateVersion !== 1) fail('observed-session-not-fresh')
  if (observed.contentVersionId !== 266100 || observed.itemId !== 266001 || observed.totalItemCount !== 10) fail('observed-session-not-fresh')
  return observed.sessionId
}

function sessionView(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  let data = parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data) ? parsed.data : parsed
  if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data) && !data.sessionId) data = data.data
  return data
}

function sameReplayBody(raw, expectedSessionId, observed) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return false }
  const data = sessionView(parsed)
  if (!data || data.sessionId !== expectedSessionId) return false
  if (data.status !== 'CREATED') return false
  if (data.acceptedSequence !== 0 || data.nextSequence !== 1 || data.stateVersion !== 1) return false
  if (Object.prototype.hasOwnProperty.call(data, 'completedResult')) return false
  const contentPin = data.contentPin
  const manifest = data.manifest
  const item = data.currentItem
  if (!contentPin || contentPin.contentVersionId !== observed.contentVersionId) return false
  if (!manifest || manifest.totalItemCount !== observed.totalItemCount) return false
  if (!item || item.itemId !== observed.itemId) return false
  return true
}

/**
 * @param {{ url: () => string, method: () => string, headers: () => object, postData: () => (string|null) }} request
 * @param {{ continuation: true, armed: true, responseCount: 10, ensureRequested: 1, completedSessionId: string, reportId: string }} gate
 */
function holdAuthorizedRetest(request, gate) {
  if (replayOptIn() !== 'on') fail('retest-replay-opt-in')
  if (slot.held || slot.replayed) fail('retest-capture-already-held')
  if (!gate || gate.continuation !== true || gate.armed !== true) fail('retest-gate')
  if (gate.responseCount !== 10 || gate.ensureRequested !== 1) fail('retest-gate')
  if (typeof gate.completedSessionId !== 'string' || !SESSION_ID.test(gate.completedSessionId)) fail('retest-gate')
  if (typeof gate.reportId !== 'string' || !REPORT_ID.test(gate.reportId)) fail('retest-gate')
  if (!request || request.method() !== 'POST') fail('retest-capture')

  let parsed
  try { parsed = new URL(request.url()) } catch { fail('retest-capture') }
  if (parsed.origin !== GATEWAY_ORIGIN || parsed.search || parsed.hash || parsed.username || parsed.password) fail('retest-capture')
  const match = RETEST_PATH.exec(parsed.pathname)
  if (!match || match[1] !== gate.completedSessionId) fail('retest-capture')
  if (parsed.href !== `${GATEWAY_ORIGIN}${parsed.pathname}`) fail('retest-capture')

  const headers = request.headers()
  const authorization = header(headers, 'authorization')
  const idempotencyKey = header(headers, 'idempotency-key')
  if (!BEARER.test(authorization)) fail('retest-capture')
  if (idempotencyKey.length < 16 || idempotencyKey.length > 192 || /[\r\n]/.test(idempotencyKey)) fail('retest-capture')
  let posted = null
  try { posted = request.postData() } catch { fail('retest-capture') }
  const body = emptyBody(posted)
  if (!body) fail('retest-capture')
  let contentType = ''
  if (body.contentType === 'required') {
    contentType = header(headers, 'content-type').trim()
    if (!JSON_TYPE.test(contentType)) fail('retest-capture')
  }

  slot.held = true
  slot.url = parsed.href
  slot.body = body.body
  slot.contentType = contentType
  slot.authorization = authorization
  slot.idempotencyKey = idempotencyKey
  slot.completedSessionId = gate.completedSessionId
  slot.reportId = gate.reportId
  return { held: true }
}

async function replaySameKey(observed) {
  if (replayOptIn() !== 'on') fail('retest-replay-opt-in')
  if (!slot.held || slot.replayed) fail('retest-replay-closed')
  const expectedSessionId = assertFreshObserved(observed, slot.completedSessionId)
  const authorization = slot.authorization
  const completedSessionId = slot.completedSessionId
  const reportId = slot.reportId
  const idempotencyKey = slot.idempotencyKey
  const contentType = slot.contentType
  const pathname = new URL(slot.url).pathname
  const body = slot.body
  slot.replayed = true
  try {
    const before = await readReport(authorization, completedSessionId, reportId)
    const headers = {
      Authorization: authorization,
      'Idempotency-Key': idempotencyKey,
      'Content-Length': Buffer.byteLength(body),
    }
    if (contentType) headers['Content-Type'] = contentType
    let response
    try {
      response = await gateway('POST', pathname, headers, body)
    } catch (error) {
      if (error && error.code === 'replay-transport') fail('replay-transport')
      fail('replay-transport')
    }
    if (response.status !== 201 || !sameReplayBody(response.raw, expectedSessionId, observed)) fail('replay-session-diverged')
    const after = await readReport(authorization, completedSessionId, reportId)
    if (after !== before) fail('report-changed')
    return {
      replayed: 1,
      status: 201,
      sameSession: true,
      reportUnchanged: true,
    }
  } finally {
    wipeSecrets()
  }
}

if (require.main === module) {
  process.stderr.write('placement-retest-same-key-replay: capture required; no request sent\n')
  process.exitCode = 2
}

module.exports = {
  OPT_IN,
  replayOptIn,
  holdAuthorizedRetest,
  replaySameKey,
  release,
}
