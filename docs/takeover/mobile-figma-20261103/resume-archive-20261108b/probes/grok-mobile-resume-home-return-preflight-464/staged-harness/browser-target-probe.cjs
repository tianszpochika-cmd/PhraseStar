'use strict'
/**
 * In-process MB-004 H5 browser observers.
 *
 * runConsentBrowserSmoke is the approved B75 consent smoke. runTargetBrowser is
 * the B81 learning-target observer. runTargetBrowser defaults to the B85 target
 * behavior; with placement: true it serves the frozen app-plus-compiler-36-root
 * H5 and adds the MB-006 first-item placement stage after the same real target
 * save and readback. With full: true plus a caller-supplied absolute frozen H5
 * path and exact index SHA, it keeps the same target + first-item stages and
 * adds the opt-in ten-item placement, real report, automatic plans:ensure and
 * today readback stage. retestContinuation true keeps that stage through the automatic plans:ensure and today read, then confirms #assessment-retest once and stops on the new question. Full mode compares the three visible read-only Today
 * due rows with that run's after-UI /learning/today item ids in process and
 * emits only counts and booleans. Neither reads credentials from argv or the
 * environment, and neither prints them. While an observer runs it listens only
 * on 127.0.0.1:18183 and serves its frozen H5 to continued same-origin GET/HEAD
 * requests. Allow-listed IAM and Gateway calls use route.continue so the browser
 * enforces CORS and cookies. The target observer does not synthesize a business
 * response.
 */
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const { execFileSync } = require('node:child_process')

const ARTIFACT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/report-client-57-root/h5'
const EXPECTED_INDEX_SHA = '1a76e5ba2f09234e58704512785628251a386b3e66e9b9de5cb48635965e23fc'
const TARGET_ARTIFACT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/practice-shared-performance-71-root/h5'
const TARGET_INDEX_SHA = '3d97632ece70cc3ffb00b6d2c296bbc63f77cb252b3f93bdc7bac4b7333b1c6e'
const PLACEMENT_ARTIFACT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/app-plus-compiler-36-root/h5'
const PLACEMENT_INDEX_SHA = '983d33d4c7bb6ae8a9586970790d906f795ebc4cfe640c0c18166cac3837de73'
const PLACEMENT_CREATE_PATH = '/api/v1/assessment/placement/sessions'
const PLACEMENT_SESSION_PREFIX = `${PLACEMENT_CREATE_PATH}/`
const PLACEMENT_CONTENT_VERSION_ID = 266100
const PLACEMENT_FIRST_ITEM_ID = 266001
const PLACEMENT_TOTAL_ITEMS = 10
const PLACEMENT_DEADLINE_MS = 180_000
const FULL_DEADLINE_MS = 420_000
const PLAN_ENSURE_PATH = '/api/v1/learning/plans:ensure'
const LEARNER_HOME_PATH = '/api/v1/learner/home'
const CONTENT_CATALOG_PATH = '/api/v1/content/learner/catalog'
const TARGET_RETURN_TO = '/pages/onboarding/onboarding'
const TARGET_DEADLINE_MS = 120_000
const TODAY_PLAN_PATH = '/api/v1/learning/today'
const TARGET_PUT_PATH = '/api/v1/learner/targets'
const CONTENT_LOCALE_QUERY = '?contentLocale=en-US'
const TARGET_CAVEAT = 'SPKI trust uses Chrome --ignore-certificate-errors-spki-list from the supplied IAM cert, computed like certificateSpkiHash in scripts/redesign/r3-local-https/prepare-iam-tls.mjs. ignoreHTTPSErrors is unset. The flag is not host-scoped; the route table aborts every other origin. IAM TLS continues only iam- login/refresh. HTTP Gateway continues only the exact learner-target allow list and cannot continue /api/v1/auth/login or /api/v1/auth/token/refresh. No business response is synthesized. The single learner-target PUT and its readback GET are the real Gateway responses. GET /api/v1/learning/today, and the OPTIONS preflight for that exact path, continue to the real Gateway while Learning stays disabled; plan writes are aborted. Installed system channel chrome is launched headless with only that SPKI flag, in an independent non-persistent context, so the profile stays ephemeral. A TLS rejection is recorded and trust is not widened. A failed allow-listed call records sanitized net::ERR_* or the existing stable code, and may append a bounded Network.loadingFailed cors or blocked reason. No request or response bodies, headers, identifiers, tokens, or credentials are recorded. PAGE_ORIGIN GET and HEAD continue to a probe-owned listener on 127.0.0.1:18183 that serves only the frozen H5, so Chrome sees those responses on the loopback address. The listener accepts only that Host and GET or HEAD, requires the in-memory static QA header added only on those continuations, and resolves a canonical file inside the artifact. Any other request, including ordinary browsing, is an empty 404. The header value is not recorded. The listener is closed after the browser. Chrome local-network access and CORS are left unchanged.'
const PLAYWRIGHT_ROOT = '/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/package.json'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const STATIC_BIND = '127.0.0.1'
const STATIC_PORT = 18183
const STATIC_HOST = '127.0.0.1:18183'
const STATIC_QA_HEADER = 'x-mb004-static-qa'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const TYPES = ['TERMS', 'PRIVACY', 'ADULT_LEARNING']
const DEADLINE_MS = 90_000
const CAVEAT = 'SPKI trust uses Chrome --ignore-certificate-errors-spki-list from the B72 IAM cert, computed like certificateSpkiHash in scripts/redesign/r3-local-https/prepare-iam-tls.mjs. ignoreHTTPSErrors is unset. The flag is not host-scoped; the route table aborts every other origin. IAM TLS continues only iam- login/refresh. HTTP Gateway continues only gateway- principal/permissions/consents and cannot continue /api/v1/auth/login or /api/v1/auth/token/refresh. Installed system channel chrome is launched headless with only that SPKI flag, in an independent non-persistent context, so the profile stays ephemeral. A TLS rejection is recorded and trust is not widened. A failed allow-listed call records sanitized net::ERR_* or the existing stable code, and may append a bounded Network.loadingFailed cors or blocked reason. No request or response bodies, headers, or credentials are recorded. PAGE_ORIGIN GET and HEAD continue to a probe-owned listener on 127.0.0.1:18183 that serves only the frozen H5, so Chrome sees those responses on the loopback address. The listener accepts only that Host and GET or HEAD, requires the in-memory static QA header added only on those continuations, and resolves a canonical file inside the artifact. Any other request, including ordinary browsing, is an empty 404. The header value is not recorded. The listener is closed after the browser. Chrome local-network access and CORS are left unchanged. The learner-targets 404, and its OPTIONS companion, are synthetic fulfills because that service is not running; they are not Gateway responses.'

const PLACEMENT_CAVEAT = 'Opt-in placement uses only the frozen app-plus-compiler-36-root H5 at index SHA 983d33d4c7bb6ae8a9586970790d906f795ebc4cfe640c0c18166cac3837de73. The target phase keeps the B85 Gateway and IAM allow lists. The placement phase continues exactly one POST /api/v1/assessment/placement/sessions and its exact OPTIONS, plus at most one exact GET of the server-created session and its exact OPTIONS. All answer, plan, retest and skip writes are aborted; the current H5 natural post-save /learning/plans:replan attempt is aborted and counted as an attempt, not a continued plan write. The POST must be bodyless or an empty JSON object with Idempotency-Key. The 201 response must pin contentVersionId 266100, itemId 266001, and manifest totalItemCount 10; the rendered stem and options must match that response. The observer keyboard-activates #assessment-guide #assessment-start once after confirming the source selector, reads the localized Question 1 of 10 eyebrow and the accepted-progress bar (0 accepted of 10 for a fresh session), and requires #assessment-submit disabled before any choice. No business response is synthesized. Tokens stay in the existing browser closures and are not read from argv or the environment. The static listener and SPKI trust are unchanged. The receipt records no request or response bodies, headers, identifiers, tokens, or credentials. No reload or programmatic write is added.'

const FULL_CAVEAT = 'Opt-in full mode requires an explicit caller-supplied absolute frozen H5 path and its exact 64-hex index SHA; the file at that path must hash to that SHA before Chrome starts. It reuses the same in-process eligible synthetic actor, headless installed Chrome channel, non-persistent context, strict in-memory static marker, SPKI trust from the supplied IAM cert, and exact Host checks as the target observer. It does not synthesize any business response. After the already-verified B89 first real item, it clicks the browser first rendered option and #assessment-submit once for each of the ten sequential items. Each POST /api/v1/assessment/placement/sessions/{the exact server session}/responses must be armed by that UI submit, carry the current observed expectedStateVersion, itemId and itemSequence, one CHOICE selectedOptionIds entry equal to the clicked public option key, a 64-hex digest, a timeSpentSec integer, and Idempotency-Key; the real response must be 200 with the exact session, acceptedSequence, nextSequence and stateVersion increment, plus feedback and nextItem (the real report/finalResult on ten). A duplicate, pre-armed, stale-version, wrong-item or wrong-option response is aborted, not retried. At item ten the real report/finalResult must be ASSESSED with a reportId and the visible #assessment-report level/score must match; the application automatic POST /api/v1/learning/plans:ensure is continued once only after that report, with body keys exactly placementReportId and the observed report id, and must return real 200. The application automatic GET /api/v1/learning/today is continued, then #assessment-today is clicked and the today page exact GET /api/v1/learner/home, GET /api/v1/content/learner/catalog and GET /api/v1/learning/today are continued after that UI action; a real 200/readback is required. Only those exact owner routes plus the existing target/IAM reads are on the Gateway allow list. Replan, retest, skip, additional actions and unknown writes stay aborted. The receipt contains no request or response bodies, headers, option texts, item ids, report ids, session ids, tokens or credentials.'

const RETEST_CAVEAT = 'Opt-in retest continuation is full mode plus retestContinuation true. It uses the caller-supplied B100 H5 and its exact index SHA. It keeps the ten real UI answers, the visible assessed report, the one automatic plans:ensure, and the one automatic learning/today read. It then clicks #assessment-retest and #assessment-retest-confirm once. Exactly one authorized bodyless POST /api/v1/assessment/placement/sessions/{the completed owner session}/retest with Idempotency-Key is continued with route.continue. P1PlacementJdbcController.retest returns HTTP 201 Created and body {"data": sessionView}; the new session is CREATED at acceptedSequence 0, nextSequence 1, stateVersion 1, with the current bank pin. The harness accepts only that 201 and that body: contentVersionId 266100, itemId 266001, totalItemCount 10, a stem, and options. A 200 retest response is not success. No response is fulfilled. No eleventh answer, skip, DEC-04 choice, consent write, today click, home GET, or catalog GET is allowed. The receipt stores booleans and counts only.'

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon', '.map': 'application/json',
}

const CREDENTIAL_PATHS = new Set(['/api/v1/auth/login', '/api/v1/auth/token/refresh'])

const IAM_CONTINUE = new Map([
  ['POST /api/v1/auth/login', 'iam-login'],
  ['OPTIONS /api/v1/auth/login', 'iam-login'],
  ['POST /api/v1/auth/token/refresh', 'iam-refresh'],
  ['OPTIONS /api/v1/auth/token/refresh', 'iam-refresh'],
])

const GATEWAY_CONTINUE = new Map([
  ['GET /api/v1/iam/principal/me', 'gateway-principal'],
  ['OPTIONS /api/v1/iam/principal/me', 'gateway-principal'],
  ['GET /api/v1/iam/permissions', 'gateway-permissions'],
  ['OPTIONS /api/v1/iam/permissions', 'gateway-permissions'],
  ['GET /api/v1/iam/consents', 'gateway-consents'],
  ['PUT /api/v1/iam/consents', 'gateway-consents'],
  ['OPTIONS /api/v1/iam/consents', 'gateway-consents'],
])

const TARGET_READS = new Map([
  ['/api/v1/iam/principal/me', 'gateway-principal'],
  ['/api/v1/iam/permissions', 'gateway-permissions'],
  ['/api/v1/iam/consents', 'gateway-consents'],
  ['/api/v1/learner/profile', 'gateway-profile'],
  ['/api/v1/learner/targets', 'gateway-targets'],
  ['/api/v1/learner/preferences', 'gateway-preferences'],
  ['/api/v1/onboarding/options', 'gateway-options'],
])

const TARGET_LOCALE_PATHS = new Set([
  '/api/v1/learner/profile',
  '/api/v1/learner/targets',
  '/api/v1/onboarding/options',
])

function allowedType(table, key, prefix) {
  const type = table.get(key)
  return typeof type === 'string' && type.startsWith(prefix) ? type : null
}

function certificateSpkiHash(pemPath) {
  const publicKeyPem = execFileSync('openssl', ['x509', '-in', pemPath, '-pubkey', '-noout'], { encoding: 'utf8' })
  const publicKeyDer = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: publicKeyPem })
  return crypto.createHash('sha256').update(publicKeyDer).digest('base64')
}

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

const BLOCKED_REASONS = new Set([
  'other', 'csp', 'mixed-content', 'origin', 'inspector', 'integrity', 'subresource-filter', 'content-type',
  'coep-frame-resource-needs-coep-header', 'coop-sandboxed-iframe-cannot-navigate-to-coop-page',
  'corp-not-same-origin', 'corp-not-same-origin-after-defaulted-to-same-origin-by-coep', 'corp-not-same-site',
  'sri-message-signature-mismatch',
])

function sanitizedNetError(errorText) {
  if (typeof errorText !== 'string' || errorText.length > 180) return null
  const match = /net::ERR_[A-Z0-9_]+/.exec(errorText)
  const code = match && match[0]
  return code && code.length <= 64 ? code : null
}

function boundedCorsError(value) {
  return typeof value === 'string' && value.length <= 64 && /^[A-Z][A-Za-z0-9]+$/.test(value) ? value : null
}

function boundedBlockedReason(value) {
  return typeof value === 'string' && BLOCKED_REASONS.has(value) ? value : null
}

function reasonPart(reason, prefix, accept) {
  if (typeof reason !== 'string') return null
  const part = reason.split(' ').find((item) => item.startsWith(prefix))
  const value = part ? part.slice(prefix.length) : ''
  return accept(value)
}

function isDiagnosticReason(reason) {
  if (typeof reason !== 'string' || reason.length === 0 || reason.length > 80) return false
  const parts = reason.split(' ')
  return parts.every((part, index) => {
    if (index === 0 && (part === 'tls-rejected' || part === 'timeout' || part === 'request-failed' || /^net::ERR_[A-Z0-9_]+$/.test(part))) return true
    if (part.startsWith('cors:')) return Boolean(boundedCorsError(part.slice(5)))
    if (part.startsWith('blocked:')) return Boolean(boundedBlockedReason(part.slice(8)))
    return false
  })
}

function mergeDiagnostic(current, extra) {
  const net = (extra && extra.netError) || (typeof current === 'string' ? sanitizedNetError(current.split(' ')[0]) : null)
  const cors = (extra && extra.corsError) || reasonPart(current, 'cors:', boundedCorsError)
  const blocked = (extra && extra.blockedReason) || reasonPart(current, 'blocked:', boundedBlockedReason)
  let head = net
  if (!head && typeof current === 'string') {
    const first = current.split(' ')[0]
    if (first === 'tls-rejected' || first === 'timeout' || first === 'request-failed') head = first
  }
  if (!head && extra && (extra.stable === 'tls-rejected' || extra.stable === 'timeout' || extra.stable === 'request-failed')) head = extra.stable
  const parts = []
  if (head) parts.push(head)
  if (cors) parts.push(`cors:${cors}`)
  if (blocked) parts.push(`blocked:${blocked}`)
  let reason = ''
  for (const part of parts) {
    const next = reason ? `${reason} ${part}` : part
    if (next.length > 80) break
    reason = next
  }
  return reason || 'request-failed'
}

function safeFailure(error) {
  const errorText = error && typeof error === 'object' && typeof error.errorText === 'string' ? error.errorText : ''
  const net = sanitizedNetError(errorText)
  if (net) return net
  const text = typeof error === 'string' ? error : (error && typeof error.message === 'string' ? error.message : '')
  if (/CERT|SSL|TLS/i.test(text) || /CERT|SSL|TLS/i.test(errorText)) return 'tls-rejected'
  if (/Timeout/i.test(text) || /Timeout/i.test(errorText)) return 'timeout'
  return 'request-failed'
}

function continuedApi(url, method) {
  if (url.search || url.hash || url.username || url.password) return false
  const key = `${method} ${url.pathname}`
  if (url.origin === IAM_ORIGIN) return Boolean(allowedType(IAM_CONTINUE, key, 'iam-'))
  if (url.origin === GATEWAY_ORIGIN) return Boolean(allowedType(GATEWAY_CONTINUE, key, 'gateway-'))
  return false
}

function loadObservation(event) {
  if (!event || typeof event !== 'object') return null
  const netError = sanitizedNetError(event.errorText)
  const blockedReason = boundedBlockedReason(event.blockedReason)
  const corsStatus = event.corsErrorStatus
  const corsError = corsStatus && typeof corsStatus === 'object' ? boundedCorsError(corsStatus.corsError) : null
  if (!netError && !blockedReason && !corsError) return null
  if ((netError === 'net::ERR_ABORTED' || netError === 'net::ERR_BLOCKED_BY_CLIENT') && !corsError && !blockedReason) return null
  return { netError, blockedReason, corsError }
}

function uniqueOpenContinue(traffic, method, requestPath) {
  let found = null
  for (const row of traffic) {
    if (row.method !== method || row.path !== requestPath || row.disposition !== 'continue' || row.status != null) continue
    if (found) return null
    found = row
  }
  return found
}

async function watchAllowlistedLoadFailures(page, traffic, allow = continuedApi) {
  const watched = new Map()
  let session
  try {
    session = await page.context().newCDPSession(page)
    await session.send('Network.enable')
  } catch {
    return
  }
  session.on('Network.requestWillBeSent', (event) => {
    try {
      const requestId = event && typeof event.requestId === 'string' ? event.requestId : ''
      const request = event && event.request
      if (!requestId || requestId.length > 128 || !request || typeof request.url !== 'string' || typeof request.method !== 'string') return
      if (request.method.length > 16) return
      let url
      try { url = new URL(request.url) } catch { return }
      if (!allow(url, request.method)) return
      if (watched.size >= 80) watched.delete(watched.keys().next().value)
      watched.set(requestId, { method: request.method, path: url.pathname })
    } catch { /* observation only */ }
  })
  session.on('Network.loadingFailed', (event) => {
    try {
      const requestId = event && typeof event.requestId === 'string' ? event.requestId : ''
      const tracked = requestId ? watched.get(requestId) : null
      if (!tracked) return
      watched.delete(requestId)
      const observation = loadObservation(event)
      if (!observation) return
      const row = uniqueOpenContinue(traffic, tracked.method, tracked.path)
      if (!row) return
      row.reason = mergeDiagnostic(row.reason, observation)
    } catch { /* observation only */ }
  })
}

function classify(url, method) {
  if (url.origin === PAGE_ORIGIN) return { action: 'artifact', type: 'h5-static' }
  const key = `${method} ${url.pathname}`
  if (url.search || url.hash || url.username || url.password) return { action: 'abort', type: 'unexpected', reason: 'unexpected-query-or-userinfo' }
  if (url.origin === GATEWAY_ORIGIN && url.pathname === '/api/v1/learner/targets' && (method === 'GET' || method === 'OPTIONS')) {
    return { action: 'synthetic-targets', type: 'synthetic-learner-targets', reason: 'unavailable-non-iam' }
  }
  if (url.origin === IAM_ORIGIN && CREDENTIAL_PATHS.has(url.pathname)) {
    const type = allowedType(IAM_CONTINUE, key, 'iam-')
    if (type) return { action: 'continue', type, reason: null }
  }
  if (url.origin === GATEWAY_ORIGIN && !CREDENTIAL_PATHS.has(url.pathname)) {
    const type = allowedType(GATEWAY_CONTINUE, key, 'gateway-')
    if (type) return { action: 'continue', type, reason: null }
  }
  const write = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  return { action: 'abort', type: write ? 'excluded-write' : 'unexpected', reason: write ? 'outside-consent-allow-list' : 'unexpected-route' }
}

function hasAuthorization(request) {
  const value = request.headers().authorization
  return typeof value === 'string' && value.length > 0
}

function sameMarker(presented, marker) {
  if (typeof presented !== 'string' || typeof marker !== 'string' || marker.length === 0) return false
  const given = Buffer.from(presented)
  const expected = Buffer.from(marker)
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(given, expected)
}

function frozenAsset(pathname, artifactRoot = ARTIFACT) {
  let decoded = '/'
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) return null
  const root = path.resolve(artifactRoot)
  const file = path.resolve(root, relative)
  if (!(file === path.join(root, 'index.html') || file.startsWith(`${root}${path.sep}`))) return null
  let canonicalRoot
  let canonicalFile
  try {
    canonicalRoot = fs.realpathSync(root)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null
    canonicalFile = fs.realpathSync(file)
  } catch {
    return null
  }
  if (!(canonicalFile === path.join(canonicalRoot, 'index.html') || canonicalFile.startsWith(`${canonicalRoot}${path.sep}`))) return null
  try {
    if (!fs.statSync(canonicalFile).isFile()) return null
  } catch {
    return null
  }
  return canonicalFile
}

function sendEmpty(res, status) {
  if (!res || res.headersSent || res.writableEnded) return
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': '0',
    'x-content-type-options': 'nosniff',
  })
  res.end()
}

function serveFrozen(req, res, marker, artifactRoot = ARTIFACT) {
  if (!req || (req.method !== 'GET' && req.method !== 'HEAD')) return sendEmpty(res, 404)
  const host = req.headers && req.headers.host
  if (host !== STATIC_HOST) return sendEmpty(res, 404)
  const presented = req.headers && req.headers[STATIC_QA_HEADER]
  if (typeof presented !== 'string' || !sameMarker(presented, marker)) return sendEmpty(res, 404)
  if (typeof req.url !== 'string' || req.url.length === 0 || req.url.length > 2048 || req.url.includes('://') || req.url.startsWith('//')) {
    return sendEmpty(res, 404)
  }
  let pathname
  try { pathname = new URL(req.url, PAGE_ORIGIN).pathname } catch { return sendEmpty(res, 404) }
  const file = frozenAsset(pathname, artifactRoot)
  if (!file) return sendEmpty(res, 404)
  let body
  try { body = fs.readFileSync(file) } catch { return sendEmpty(res, 404) }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  if (req.method === 'HEAD') res.end()
  else res.end(body)
}

function listenFrozenStatic(marker, artifactRoot = ARTIFACT) {
  const server = http.createServer((req, res) => {
    req.on('error', () => {})
    res.on('error', () => {})
    try { serveFrozen(req, res, marker, artifactRoot) } catch { sendEmpty(res, 404) }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 5_000
  server.keepAliveTimeout = 1_000
  server.maxHeadersCount = 40
  server.on('connect', (_request, socket) => { socket.destroy() })
  server.on('upgrade', (_request, socket) => { socket.destroy() })
  server.on('clientError', (_error, socket) => {
    if (!socket || socket.destroyed) return
    try {
      socket.end('HTTP/1.1 400\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    } catch {
      try { socket.destroy() } catch { /* already closed */ }
    }
  })
  return new Promise((resolve, reject) => {
    let settled = false
    let closing = false
    let giveUp
    const rejectOnce = (error) => {
      if (settled) return
      settled = true
      clearTimeout(giveUp)
      reject(error)
    }
    const onError = (error) => {
      if (settled || closing) return
      closing = true
      clearTimeout(giveUp)
      server.removeListener('error', onError)
      server.on('error', () => {})
      const timer = setTimeout(() => rejectOnce(error), 800)
      try {
        server.close(() => {
          clearTimeout(timer)
          rejectOnce(error)
        })
      } catch {
        clearTimeout(timer)
        rejectOnce(error)
      }
    }
    server.once('error', onError)
    giveUp = setTimeout(() => {
      const error = new Error('static-listen-timeout')
      error.code = 'ETIMEDOUT'
      onError(error)
    }, 5_000)
    server.listen({ host: STATIC_BIND, port: STATIC_PORT, exclusive: true }, () => {
      clearTimeout(giveUp)
      if (settled || closing) return
      server.removeListener('error', onError)
      server.on('error', () => {})
      const address = server.address()
      if (!address || typeof address === 'string' || address.address !== STATIC_BIND || address.port !== STATIC_PORT) {
        const error = new Error('static-port-mismatch')
        error.code = 'EPORT'
        onError(error)
        return
      }
      settled = true
      resolve(server)
    })
  })
}

function closeOwnedServer(server) {
  return new Promise((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      resolve()
    }
    const force = setTimeout(() => {
      try {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      } catch { /* already closing */ }
      setTimeout(finish, 250)
    }, 800)
    try {
      server.close(() => {
        clearTimeout(force)
        finish()
      })
    } catch {
      clearTimeout(force)
      finish()
    }
  })
}

function staticEndpointRegistered() {
  try {
    const parsed = new URL(PAGE_ORIGIN)
    return parsed.protocol === 'http:' && parsed.hostname === STATIC_BIND && Number(parsed.port) === STATIC_PORT && STATIC_PORT === 18183 && STATIC_HOST === `${STATIC_BIND}:${STATIC_PORT}`
  } catch {
    return false
  }
}

function syntheticHeaders(request) {
  const requested = request.headers()['access-control-request-headers'] || ''
  const headers = {
    'access-control-allow-origin': PAGE_ORIGIN,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET, OPTIONS',
    vary: 'Origin',
    'cache-control': 'no-store',
    'x-mb004-synthetic': 'learner-targets',
  }
  if (/^[a-z0-9-,]+$/i.test(requested)) headers['access-control-allow-headers'] = requested
  return headers
}

async function fulfillTargets(route, method) {
  const request = route.request()
  if (method === 'OPTIONS') {
    await route.fulfill({ status: 204, headers: syntheticHeaders(request), body: '' })
    return { status: 204, disposition: 'fulfill', reason: 'synthetic-preflight-for-labeled-404' }
  }
  await route.fulfill({
    status: 404,
    headers: { ...syntheticHeaders(request), 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ synthetic: true, code: 'LEARNER_TARGETS_UNAVAILABLE' }),
  })
  return { status: 404, disposition: 'fulfill', reason: 'unavailable-non-iam' }
}

function safeHash(pageUrl) {
  try {
    const hash = new URL(pageUrl).hash.replace(/^#/, '')
    return hash.split('?')[0] || '/'
  } catch {
    return null
  }
}

async function fillLogin(page, identifier, password) {
  // Known compiled-H5 login selectors used by the closed-workspace probes:
  // the uni-app host input, with the bare id as fallback, then .login-submit.
  await page.locator('.login-submit').first().waitFor({ timeout: 20000 })
  const idHost = page.locator('#mobile-login-identifier-host .uni-input-input').first()
  const pwHost = page.locator('#mobile-login-password-host .uni-input-input').first()
  const id = (await idHost.count()) ? idHost : page.locator('#mobile-login-identifier').first()
  const pw = (await pwHost.count()) ? pwHost : page.locator('#mobile-login-password').first()
  await id.fill(identifier)
  await pw.fill(password)
  await page.locator('.login-submit').first().click()
}

async function regionVisible(region) {
  return region.waitFor({ state: 'visible', timeout: 1500 }).then(() => true).catch(() => false)
}

async function openDocument(page, type) {
  const trigger = page.locator(`#mobile-onboarding-doc-open-${type}`)
  const region = page.locator(`#mobile-onboarding-doc-${type}`)
  await trigger.focus()
  await page.keyboard.press('Enter')
  if (await regionVisible(region)) return 'keyboard'
  await trigger.click()
  if (await regionVisible(region)) return 'click'
  return null
}

function renderedConsentDocument(element, expected) {
  const htmlNs = 'http://www.w3.org/1999/xhtml'
  const rejected = { contentMatch: false, visibleCodePoints: null, observedBreaks: null }
  const concealed = (node) => {
    if (!node || node.nodeType !== 1) return true
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true
    const view = node.ownerDocument && node.ownerDocument.defaultView
    const style = view && view.getComputedStyle(node)
    if (!style) return true
    return style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
  }
  if (typeof expected !== 'string' || !element || element.nodeType !== 1 || !element.isConnected) return rejected
  if (element.namespaceURI !== htmlNs || element.tagName !== 'UNI-TEXT' || element.shadowRoot || concealed(element)) return rejected
  if (element.childNodes.length !== 1) return rejected
  const span = element.childNodes[0]
  if (!span || span.nodeType !== 1 || span.namespaceURI !== htmlNs || span.tagName !== 'SPAN' || span.shadowRoot || concealed(span)) return rejected
  let rendered = ''
  let plain = ''
  let breaks = 0
  for (let index = 0; index < span.childNodes.length; index += 1) {
    const node = span.childNodes[index]
    if (node.nodeType === 3) {
      if (typeof node.data !== 'string') return rejected
      rendered += node.data
      plain += node.data
      continue
    }
    if (node.nodeType !== 1 || node.namespaceURI !== htmlNs || node.tagName !== 'BR') return rejected
    if (node.shadowRoot || node.childNodes.length !== 0 || node.attributes.length !== 0 || concealed(node)) return rejected
    rendered += '\n'
    breaks += 1
  }
  if (element.textContent !== plain) return rejected
  return {
    contentMatch: rendered === expected,
    visibleCodePoints: [...rendered].length,
    observedBreaks: breaks,
  }
}

async function readRenderedConsent(page, type, expectedBody) {
  const locator = page.locator(`#mobile-onboarding-doc-${type} .onboarding-document-text`)
  const count = await locator.count().catch(() => 0)
  if (count !== 1 || typeof expectedBody !== 'string') {
    return { contentMatch: false, visibleCodePoints: count === 0 ? 0 : null, observedBreaks: null }
  }
  const reading = await locator.evaluate(renderedConsentDocument, expectedBody).catch(() => null)
  if (!reading || (reading.contentMatch !== true && reading.contentMatch !== false)) {
    return { contentMatch: false, visibleCodePoints: 0, observedBreaks: null }
  }
  const visibleCodePoints = Number.isInteger(reading.visibleCodePoints) ? reading.visibleCodePoints : null
  const observedBreaks = Number.isInteger(reading.observedBreaks) ? reading.observedBreaks : null
  return {
    contentMatch: reading.contentMatch === true && visibleCodePoints === [...expectedBody].length && observedBreaks !== null,
    visibleCodePoints,
    observedBreaks,
  }
}

function exactVersion(lines, version) {
  if (typeof version !== 'string' || version.length === 0) return false
  return lines.some((line) => {
    const parts = String(line ?? '').trim().split(/\s+/)
    return parts.length > 0 && parts[parts.length - 1] === version
  })
}

function httpSuccess(row) {
  return Number.isInteger(row.status) && row.status >= 200 && row.status < 300
}

function summarize(traffic, ui) {
  const continued = traffic.filter((row) => row.disposition === 'continue')
  const puts = traffic.filter((row) => row.type === 'gateway-consents' && row.method === 'PUT')
  const successfulPuts = puts.filter((row) => row.disposition === 'continue' && httpSuccess(row))
  const getsAfter = (() => {
    const third = successfulPuts[2]
    if (!third) return 0
    return continued.filter((row) => row.type === 'gateway-consents' && row.method === 'GET' && row.order > third.order && httpSuccess(row)).length
  })()
  const refreshes = continued.filter((row) => row.type === 'iam-refresh' && row.method === 'POST')
  const refreshAccepted = refreshes.filter((row) => httpSuccess(row))
  const extraWrites = continued.filter((row) => row.method !== 'GET' && row.method !== 'HEAD' && row.method !== 'OPTIONS'
    && !(row.type === 'iam-login' && row.method === 'POST')
    && !(row.type === 'iam-refresh' && row.method === 'POST')
    && !(row.type === 'gateway-consents' && row.method === 'PUT'))
  const abortedWrites = traffic.filter((row) => row.disposition === 'abort' && row.type === 'excluded-write')
  const blockedWrites = traffic.filter((row) => row.disposition === 'abort' && (
    row.type === 'excluded-write'
    || row.reason === 'unauthenticated-consent-write'
    || row.reason === 'non-get-static'
  ))
  const unknownApi = traffic.filter((row) => row.type === 'unexpected' || row.reason === 'route-handler-failed')
  const syntheticRows = traffic.filter((row) => row.type === 'synthetic-learner-targets')
  const syntheticGets = syntheticRows.filter((row) => row.method === 'GET' && row.status === 404)
  const syntheticOptions = syntheticRows.filter((row) => row.method === 'OPTIONS' && row.status === 204)
  const syntheticOk = syntheticRows.every((row) => (row.method === 'GET' && row.status === 404) || (row.method === 'OPTIONS' && row.status === 204))
  const opened = ui.opened || []
  const documentsMatch = TYPES.every((type) => opened.some((row) => row.type === type && row.versionMatch === true && row.contentMatch === true))
  const openedByUi = TYPES.every((type) => opened.some((row) => row.type === type && (row.via === 'keyboard' || row.via === 'click')))
  const towardGoal = ui.toward === 'goal-title' || ui.toward === 'goal-choices'
  const refreshOk = refreshes.length > 0 && refreshAccepted.length === refreshes.length
  const putsOk = puts.length === 3 && successfulPuts.length === 3
  const met = ui.bodyControls === 3 && openedByUi && documentsMatch && ui.agreeClicks === 1
    && putsOk && extraWrites.length === 0 && blockedWrites.length === 0 && unknownApi.length === 0
    && syntheticOk && towardGoal && refreshOk
  return {
    met,
    expectations: {
      separateFromHttpChecks: true,
      bodyControls: ui.bodyControls,
      opened: opened.map((row) => ({
        type: row.type,
        via: row.via,
        versionMatch: row.versionMatch === true,
        contentMatch: row.contentMatch === true,
        visibleCodePoints: row.visibleCodePoints,
        expectedCodePoints: row.expectedCodePoints,
        observedBreaks: Number.isInteger(row.observedBreaks) ? row.observedBreaks : null,
      })),
      openedByUi,
      documentsMatch,
      agreeClicks: ui.agreeClicks,
      successfulConsentPuts: successfulPuts.length,
      consentPutStatuses: puts.map((row) => row.status),
      consentGetsAfterPuts: getsAfter,
      extraContinuedWrites: extraWrites.length,
      abortedWriteCount: abortedWrites.length,
      blockedWriteCount: blockedWrites.length,
      unknownApiCount: unknownApi.length,
      syntheticTarget404s: syntheticGets.length,
      syntheticTargetOptions: syntheticOptions.length,
      staticFulfills: ui.staticFulfills,
      refreshObserved: refreshes.length,
      refreshAcceptedCount: refreshAccepted.length,
      towardGoal,
      toward: ui.toward,
      quotaClicks: 0,
    },
  }
}

async function runConsentBrowserSmoke({ identifier, password, caPem, documents, shotFile }) {
  const indexFile = path.join(ARTIFACT, 'index.html')
  const indexSha256 = fs.existsSync(indexFile) ? shaFile(indexFile) : null
  const base = {
    launched: false,
    indexSha256,
    expectedIndexSha256: EXPECTED_INDEX_SHA,
    indexMatch: indexSha256 === EXPECTED_INDEX_SHA,
    spkiSha256: null,
    ignoreHTTPSErrors: false,
    persistentProfile: false,
    serviceWorkers: 'block',
    screenshot: null,
    requests: [],
    expectations: null,
    caveat: CAVEAT,
  }
  if (!base.indexMatch) return { ...base, status: 'BLOCKED', reason: 'index-sha-mismatch' }
  if (!Array.isArray(documents) || TYPES.some((type) => !documents.some((document) => document && document.type === type && document.documentVersion && document.bodyText))) {
    return { ...base, status: 'BLOCKED', reason: 'fixture-incomplete' }
  }
  let spki = null
  try { spki = certificateSpkiHash(caPem) } catch { return { ...base, status: 'BLOCKED', reason: 'spki-unavailable' } }
  base.spkiSha256 = spki

  let chromium
  try {
    ;({ chromium } = createRequire(PLAYWRIGHT_ROOT)('playwright'))
  } catch {
    return { ...base, status: 'BLOCKED', reason: 'playwright-unavailable' }
  }

  const deadline = Date.now() + DEADLINE_MS
  const traffic = []
  let order = 0
  let staticFulfills = 0
  let staticDiagnostics = 0
  const note = (method, requestPath, outcome) => {
    if (traffic.length >= 120) return null
    const row = {
      order: ++order,
      method,
      path: requestPath,
      status: outcome.status ?? null,
      type: outcome.type,
      disposition: outcome.disposition,
      reason: outcome.reason || null,
    }
    traffic.push(row)
    return row
  }
  const noteStatic = (method, requestPath, outcome) => {
    if (staticDiagnostics >= 8) return
    staticDiagnostics += 1
    note(method, requestPath, outcome)
  }
  const pending = new Map()
  let browser = null
  let staticServer = null
  let staticMarker = ''
  const ui = { bodyControls: 0, opened: [], agreeClicks: 0, toward: 'not-started', staticFulfills: 0 }
  try {
    if (!staticEndpointRegistered()) return { ...base, status: 'BLOCKED', reason: 'static-port-not-registered' }
    staticMarker = crypto.randomBytes(32).toString('hex')
    try {
      staticServer = await listenFrozenStatic(staticMarker)
    } catch (error) {
      const reason = error && error.code === 'EADDRINUSE' ? 'static-port-busy' : 'static-listen-failed'
      return { ...base, status: 'BLOCKED', reason }
    }
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${spki}`],
    })
    base.launched = true
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      serviceWorkers: 'block',
    })
    context.setDefaultTimeout(20000)
    const page = await context.newPage()
    await watchAllowlistedLoadFailures(page, traffic)
    page.on('response', (response) => {
      let parsed
      try { parsed = new URL(response.url()) } catch { return }
      const method = response.request().method()
      if (parsed.origin === PAGE_ORIGIN) {
        if (method !== 'GET' && method !== 'HEAD') return
        if (response.status() === 200) {
          staticFulfills += 1
          ui.staticFulfills = staticFulfills
        } else if (response.status() > 0) {
          noteStatic(method, parsed.pathname, { status: response.status(), type: 'h5-static', disposition: 'continue', reason: 'missing-asset' })
        }
        return
      }
      const queue = pending.get(`${method} ${parsed.pathname}`)
      const row = queue && queue.shift()
      if (!row) return
      row.status = response.status()
      if (isDiagnosticReason(row.reason)) row.reason = null
    })
    page.on('requestfailed', (request) => {
      let parsed
      try { parsed = new URL(request.url()) } catch { return }
      const method = request.method()
      if (parsed.origin === PAGE_ORIGIN) {
        if (method !== 'GET' && method !== 'HEAD') return
        const failure = request.failure()
        const netError = sanitizedNetError(failure && failure.errorText)
        noteStatic(method, parsed.pathname, {
          status: null, type: 'h5-static', disposition: 'continue', reason: netError || safeFailure(failure),
        })
        return
      }
      const queue = pending.get(`${method} ${parsed.pathname}`)
      const row = queue && queue.shift()
      if (!row || row.status != null) return
      const failure = request.failure()
      const netError = sanitizedNetError(failure && failure.errorText)
      row.reason = mergeDiagnostic(row.reason, { netError, stable: netError ? null : safeFailure(failure) })
    })
    await context.route('**/*', async (route) => {
      const request = route.request()
      let url
      try { url = new URL(request.url()) } catch { await route.abort(); return }
      const method = request.method()
      const decision = classify(url, method)
      try {
        if (decision.action === 'artifact') {
          if (method !== 'GET' && method !== 'HEAD') {
            await route.abort()
            note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'non-get-static' })
            return
          }
          const headers = { ...request.headers(), [STATIC_QA_HEADER]: staticMarker }
          await route.continue({ headers })
          return
        }
        if (decision.action === 'synthetic-targets') {
          const outcome = await fulfillTargets(route, method)
          note(method, url.pathname, { ...outcome, type: decision.type })
          return
        }
        if (decision.action === 'continue') {
          const needsAuth = method === 'GET' || method === 'PUT'
          if (needsAuth && !hasAuthorization(request)) {
            await route.abort()
            note(method, url.pathname, {
              status: null, type: decision.type, disposition: 'abort',
              reason: method === 'PUT' ? 'unauthenticated-consent-write' : 'missing-authorization',
            })
            return
          }
          const row = note(method, url.pathname, { status: null, type: decision.type, disposition: 'continue', reason: null })
          if (row) {
            const queueKey = `${method} ${url.pathname}`
            const queue = pending.get(queueKey) || []
            queue.push(row)
            pending.set(queueKey, queue)
          }
          await route.continue()
          return
        }
        await route.abort()
        note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: decision.reason })
      } catch {
        note(method, url.pathname, { status: null, type: decision.type || 'unexpected', disposition: 'abort', reason: 'route-handler-failed' })
        try { await route.abort() } catch { /* already settled */ }
      }
    })

    if (Date.now() > deadline) {
      ui.staticFulfills = staticFulfills
      return { ...base, status: 'TIMEOUT', reason: 'deadline', requests: traffic, expectations: summarize(traffic, ui).expectations }
    }
    await page.goto(`${PAGE_ORIGIN}/#/pages/login/login?returnTo=${encodeURIComponent('/pages/onboarding/onboarding')}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await fillLogin(page, identifier, password)
    const leftLogin = await page.waitForFunction(() => !location.hash.includes('/pages/login/login'), null, { timeout: 20000 }).then(() => true).catch(() => false)
    if (!leftLogin) {
      ui.toward = 'login'
      ui.staticFulfills = staticFulfills
      const summary = summarize(traffic, ui)
      return { ...base, status: 'FAILED', reason: 'still-on-login', requests: traffic, expectations: summary.expectations }
    }
    const passwordVisible = await page.locator('input[type="password"]').first().isVisible().catch(() => false)
    if (!passwordVisible && shotFile) {
      await page.screenshot({ path: shotFile, fullPage: false }).then(() => { base.screenshot = shotFile }).catch(() => {})
    }
    const controls = []
    for (const type of TYPES) controls.push(page.locator(`#mobile-onboarding-doc-open-${type}`))
    const visible = await Promise.all(controls.map((locator) => locator.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)))
    ui.bodyControls = visible.filter(Boolean).length
    if (ui.bodyControls !== 3) {
      ui.toward = safeHash(page.url())
      ui.staticFulfills = staticFulfills
      const summary = summarize(traffic, ui)
      return { ...base, status: 'FAILED', reason: 'body-controls-missing', requests: traffic, expectations: summary.expectations }
    }
    for (const type of TYPES) {
      const document = documents.find((item) => item.type === type)
      const via = await openDocument(page, type)
      const versionLines = await page.locator(`#mobile-onboarding-doc-open-${type} .onboarding-help`).evaluateAll((nodes) => nodes.map((node) => node.textContent ?? '')).catch(() => [])
      const reading = await readRenderedConsent(page, type, document.bodyText)
      ui.opened.push({
        type,
        via,
        versionMatch: exactVersion(versionLines, document.documentVersion),
        contentMatch: reading.contentMatch === true,
        visibleCodePoints: reading.visibleCodePoints,
        expectedCodePoints: [...document.bodyText].length,
        observedBreaks: reading.observedBreaks,
      })
    }
    const agree = page.getByRole('button', { name: '同意并继续' })
    const agreeCount = await agree.count()
    const disabled = agreeCount === 0 || await agree.first().isDisabled().catch(() => true) || (await agree.first().getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (!disabled) {
      await agree.first().click()
      ui.agreeClicks = 1
    }
    const goalDeadline = Date.now() + Math.min(20000, Math.max(1000, deadline - Date.now()))
    while (Date.now() < goalDeadline) {
      const title = await page.locator('#mobile-onboarding-title').innerText().catch(() => '')
      const choices = await page.locator('.onboarding-choice').count().catch(() => 0)
      if (title.includes('你想先达成什么')) { ui.toward = 'goal-title'; break }
      if (choices > 0) { ui.toward = 'goal-choices'; break }
      const retry = await page.getByRole('button', { name: '重试' }).isVisible().catch(() => false)
      if (retry) { ui.toward = 'consent-refresh-retry'; break }
      await page.waitForTimeout(300)
    }
    if (ui.toward === 'not-started') ui.toward = safeHash(page.url()) || 'not-goal'
    await page.waitForTimeout(500)
    ui.staticFulfills = staticFulfills
    const summary = summarize(traffic, ui)
    const reason = summary.met ? null : (ui.agreeClicks === 0 ? 'agree-not-clicked' : 'expectations-unmet')
    return {
      ...base,
      status: summary.met ? 'OBSERVED' : 'FAILED',
      reason,
      requests: traffic,
      expectations: summary.expectations,
    }
  } catch (error) {
    ui.staticFulfills = staticFulfills
    const summary = summarize(traffic, ui)
    return {
      ...base,
      status: Date.now() > deadline ? 'TIMEOUT' : 'FAILED',
      reason: safeFailure(error),
      requests: traffic,
      expectations: summary.expectations,
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
    browser = null
    if (staticServer) await closeOwnedServer(staticServer).catch(() => {})
    staticServer = null
    staticMarker = ''
  }
}

function targetQuery(url) {
  if (url.hash || url.username || url.password) return 'reject'
  if (!url.search) return 'none'
  return url.search === CONTENT_LOCALE_QUERY ? 'content-locale' : 'reject'
}

function safeQueryLabel(query) {
  if (query === 'none') return 'none'
  if (query === 'content-locale') return 'content-locale'
  return null
}

function placementSessionIdFromPath(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(PLACEMENT_SESSION_PREFIX)) return null
  const sessionId = pathname.slice(PLACEMENT_SESSION_PREFIX.length)
  return /^[A-Za-z0-9_-]{1,128}$/.test(sessionId) ? sessionId : null
}

function sanitizePlacementPath(requestPath) {
  if (typeof requestPath !== 'string' || requestPath.length === 0 || requestPath.length > 2048) return null
  return requestPath.replace(/^(\/api\/v1\/assessment\/placement\/sessions)\/[^/]+/, '$1/{sessionId}')
}

function placementResponseSessionId(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(PLACEMENT_SESSION_PREFIX)) return null
  const rest = pathname.slice(PLACEMENT_SESSION_PREFIX.length)
  const match = /^([A-Za-z0-9_-]{1,128})\/responses$/.exec(rest)
  return match ? match[1] : null
}

function placementRetestSessionId(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith(PLACEMENT_SESSION_PREFIX)) return null
  const rest = pathname.slice(PLACEMENT_SESSION_PREFIX.length)
  const match = /^([A-Za-z0-9_-]{1,128})\/retest$/.exec(rest)
  return match ? match[1] : null
}

function sha256Hex(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
}

function fullIndexShaValue(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) ? value : null
}

function fullArtifactPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.includes('\0')) return null
  if (!path.isAbsolute(value)) return null
  try {
    if (!fs.statSync(value).isDirectory()) return null
    return fs.realpathSync(value)
  } catch {
    return null
  }
}

function classifyTarget(url, method, placement = false, full = false, retest = false) {
  if (url.origin === PAGE_ORIGIN) return { action: 'artifact', type: 'h5-static', query: 'none' }
  const query = targetQuery(url)
  const write = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  if (query === 'reject') return { action: 'abort', type: write ? 'excluded-write' : 'unexpected', reason: 'unexpected-query-or-userinfo', query: null }
  if (url.origin === IAM_ORIGIN) {
    if (query !== 'none') return { action: 'abort', type: 'unexpected', reason: 'unexpected-query-or-userinfo', query: null }
    const type = allowedType(IAM_CONTINUE, `${method} ${url.pathname}`, 'iam-')
    if (type && CREDENTIAL_PATHS.has(url.pathname)) return { action: 'continue', type, reason: null, query }
    return { action: 'abort', type: write ? 'excluded-write' : 'unexpected', reason: write ? 'outside-target-allow-list' : 'unexpected-route', query }
  }
  if (url.origin !== GATEWAY_ORIGIN || CREDENTIAL_PATHS.has(url.pathname)) {
    return {
      action: 'abort',
      type: write || CREDENTIAL_PATHS.has(url.pathname) ? 'excluded-write' : 'unexpected',
      reason: CREDENTIAL_PATHS.has(url.pathname) ? 'credential-route-not-on-gateway' : (write ? 'outside-target-allow-list' : 'unexpected-route'),
      query: safeQueryLabel(query),
    }
  }
  if (placement && query === 'none') {
    if ((method === 'POST' || method === 'OPTIONS') && url.pathname === PLACEMENT_CREATE_PATH) {
      return { action: 'continue', type: 'gateway-placement-create', reason: null, query }
    }
    if ((method === 'GET' || method === 'OPTIONS') && placementSessionIdFromPath(url.pathname)) {
      return { action: 'continue', type: 'gateway-placement-read', reason: null, query }
    }
  }
  if (full && query === 'none') {
    if ((method === 'POST' || method === 'OPTIONS') && placementResponseSessionId(url.pathname)) {
      return { action: 'continue', type: 'gateway-placement-response', reason: null, query }
    }
    if ((method === 'POST' || method === 'OPTIONS') && url.pathname === PLAN_ENSURE_PATH) {
      return { action: 'continue', type: 'gateway-plan-ensure', reason: null, query }
    }
    if (retest && (method === 'POST' || method === 'OPTIONS') && placementRetestSessionId(url.pathname)) {
      return { action: 'continue', type: 'gateway-placement-retest', reason: null, query }
    }
  }
  if (full && query === 'content-locale' && (method === 'GET' || method === 'OPTIONS')
    && (url.pathname === LEARNER_HOME_PATH || url.pathname === CONTENT_CATALOG_PATH)) {
    return {
      action: 'continue',
      type: url.pathname === LEARNER_HOME_PATH ? 'gateway-learner-home' : 'gateway-content-catalog',
      reason: null,
      query,
    }
  }
  if (method === 'PUT' && url.pathname === TARGET_PUT_PATH && query === 'none') {
    return { action: 'continue', type: 'gateway-target-put', reason: null, query }
  }
  if ((method === 'GET' || method === 'OPTIONS') && url.pathname === TODAY_PLAN_PATH && query === 'none') {
    return { action: 'continue', type: 'gateway-today-plan', reason: null, query }
  }
  if (method === 'GET' || method === 'OPTIONS') {
    const type = TARGET_READS.get(url.pathname)
    if (type && (query === 'none' || (query === 'content-locale' && TARGET_LOCALE_PATHS.has(url.pathname)))) {
      return { action: 'continue', type, reason: null, query }
    }
  }
  return { action: 'abort', type: write ? 'excluded-write' : 'unexpected', reason: write ? 'outside-target-allow-list' : 'unexpected-route', query: safeQueryLabel(query) }
}

function targetContinued(url, method, placement = false, full = false, retest = false) {
  return classifyTarget(url, method, placement, full, retest).action === 'continue'
}

function usableOutDir(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 4096 && !value.includes('\0')
}

function jsonObject(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 20000) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function unwrapData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  if (value.data && typeof value.data === 'object' && !Array.isArray(value.data)) return value.data
  if (value.result && typeof value.result === 'object' && !Array.isArray(value.result)) return value.result
  return value
}

function placementJson(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 1_000_000) return null
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function placementInteger(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value
  if (typeof value === 'string' && /^-?\d{1,16}$/.test(value)) {
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : null
  }
  return null
}

function placementToken(value) {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value)
  if (typeof value !== 'string') return null
  const token = value.trim()
  return token.length > 0 && token.length <= 128 ? token : null
}

function placementText(value, max) {
  if (typeof value !== 'string') return null
  const text = value.trim()
  return text.length > 0 && text.length <= max ? text : null
}

function placementOptionList(item) {
  if (!item || !Array.isArray(item.options) || item.options.length === 0 || item.options.length > 32) return null
  const options = []
  for (const option of item.options) {
    if (!option || typeof option !== 'object' || Array.isArray(option)) return null
    const key = placementToken(option.key) || placementToken(option.optionId) || placementToken(option.optionCode)
    const text = placementText(option.text, 4096) || placementText(option.label, 4096)
    if (!key || !text) return null
    options.push({ key, text })
  }
  return options
}

function parsePlacementSession(raw) {
  const envelope = placementJson(raw)
  if (!envelope) return null
  let data = unwrapData(envelope)
  if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data) && !data.sessionId) {
    data = unwrapData(data)
  }
  if (!data) return null
  const sessionId = placementToken(data.sessionId)
  if (!sessionId || !/^asess_[A-Za-z0-9]{8,128}$/.test(sessionId)) return null
  const contentPin = data.contentPin && typeof data.contentPin === 'object' && !Array.isArray(data.contentPin) ? data.contentPin : null
  const manifest = data.manifest && typeof data.manifest === 'object' && !Array.isArray(data.manifest) ? data.manifest : null
  const item = data.currentItem && typeof data.currentItem === 'object' && !Array.isArray(data.currentItem) ? data.currentItem : null
  return {
    sessionId,
    acceptedSequence: placementInteger(data.acceptedSequence),
    nextSequence: placementInteger(data.nextSequence),
    stateVersion: placementInteger(data.stateVersion),
    contentVersionId: contentPin ? placementInteger(contentPin.contentVersionId) : null,
    totalItemCount: manifest ? placementInteger(manifest.totalItemCount) : null,
    itemId: item ? placementInteger(item.itemId) : null,
    stem: item ? (placementText(item.stemText, 4096) || placementText(item.stem, 4096) || placementText(item.prompt, 4096)) : null,
    options: item ? placementOptionList(item) : null,
  }
}

function parsePlacementItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const itemId = placementInteger(value.itemId)
  const stem = placementText(value.stemText, 4096) || placementText(value.stem, 4096) || placementText(value.prompt, 4096)
  const options = placementOptionList(value)
  if (!itemId || !stem || !options) return null
  return { itemId, stem, options }
}

function parsePlacementReportResult(value, expectedSessionId) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const result = value.result && typeof value.result === 'object' && !Array.isArray(value.result) ? value.result : value
  const summary = value.summary && typeof value.summary === 'object' && !Array.isArray(value.summary) ? value.summary : null
  const reportId = placementToken(result.reportId) || (summary ? placementToken(summary.reportId) : null)
  const sessionId = placementToken(result.sessionId)
  const resultKind = placementText(result.resultKind, 32)
  const completionStatus = placementText(result.completionStatus, 32)
  const referenceLevel = placementText(result.referenceLevel, 8)
  const aggregateScore = placementInteger(result.aggregateScore)
  const reportVersion = placementInteger(result.reportVersion)
  const resultVersion = placementInteger(result.resultVersion)
  const resultDigest = placementText(result.resultDigest, 64)
  const reportDigest = placementText(result.reportDigest, 64)
  const coverageRatio = typeof result.coverageRatio === 'number' && Number.isFinite(result.coverageRatio) && result.coverageRatio >= 0 && result.coverageRatio <= 1 ? result.coverageRatio : null
  const itemCount = summary ? placementInteger(summary.itemCount) : null
  const fullCount = summary ? placementInteger(summary.fullCount) : null
  const zeroCount = summary ? placementInteger(summary.zeroCount) : null
  if (!reportId || !/^rpt_[A-Za-z0-9._:-]{8,127}$/.test(reportId)) return null
  if (!sessionId || sessionId !== expectedSessionId) return null
  if (resultKind !== 'ASSESSED') return null
  if (completionStatus != null && completionStatus !== 'COMPLETED') return null
  if (!referenceLevel || !/^(A1|A2|B1|B2|C1|C2)$/.test(referenceLevel)) return null
  if (aggregateScore == null || aggregateScore < 0 || aggregateScore > 100) return null
  if (reportVersion != null && reportVersion < 1) return null
  if (resultVersion != null && resultVersion < 1) return null
  if (resultDigest != null && !sha256Hex(resultDigest)) return null
  if (reportDigest != null && !sha256Hex(reportDigest)) return null
  if (coverageRatio == null && (resultDigest != null || reportDigest != null)) return null
  if (itemCount != null && itemCount !== PLACEMENT_TOTAL_ITEMS) return null
  if (fullCount != null && (fullCount < 0 || fullCount > PLACEMENT_TOTAL_ITEMS)) return null
  if (zeroCount != null && (zeroCount < 0 || zeroCount > PLACEMENT_TOTAL_ITEMS)) return null
  if (fullCount != null && zeroCount != null && fullCount + zeroCount !== PLACEMENT_TOTAL_ITEMS) return null
  return {
    reportId, sessionId, resultKind, completionStatus: completionStatus || 'COMPLETED',
    referenceLevel, aggregateScore, reportVersion, resultVersion, resultDigest, reportDigest,
    coverageRatio, itemCount, fullCount, zeroCount,
  }
}

function parsePlacementReceipt(raw, expectedSessionId) {
  const envelope = placementJson(raw)
  if (!envelope) return null
  let data = unwrapData(envelope)
  if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data) && !data.sessionId) data = unwrapData(data)
  if (!data) return null
  const sessionId = placementToken(data.sessionId)
  const stateVersion = placementInteger(data.stateVersion)
  const acceptedSequence = placementInteger(data.acceptedSequence)
  const nextSequence = placementInteger(data.nextSequence)
  const status = placementText(data.status, 32)
  const outcome = data.outcome === 'FULL' || data.outcome === 'ZERO' ? data.outcome : null
  if (!sessionId || sessionId !== expectedSessionId || stateVersion == null || stateVersion < 1) return null
  if (acceptedSequence == null || acceptedSequence < 1 || acceptedSequence > PLACEMENT_TOTAL_ITEMS) return null
  if (nextSequence == null || nextSequence !== acceptedSequence + 1) return null
  if (!status) return null
  const nextItem = parsePlacementItem(data.nextItem)
  const finalResult = data.finalResult
    ? parsePlacementReportResult(data.finalResult, expectedSessionId)
    : (data.report ? parsePlacementReportResult(data.report, expectedSessionId) : null)
  return { sessionId, stateVersion, acceptedSequence, nextSequence, status, outcome, nextItem, finalResult }
}

function parsePlanEnsure(raw) {
  const envelope = placementJson(raw)
  if (!envelope) return null
  const data = unwrapData(envelope)
  if (!data) return null
  const nested = data.plan && typeof data.plan === 'object' && !Array.isArray(data.plan) ? data.plan : null
  const planId = placementToken(data.planId) || (nested ? placementToken(nested.planId) : null)
  const planVersion = placementInteger(data.planVersion) ?? (nested ? placementInteger(nested.planVersion) : null)
  const status = placementText(data.status, 32) || (nested ? placementText(nested.status, 32) : null)
  if (!planId || planVersion == null || planVersion < 1) return null
  return { planId, planVersion, status }
}

function realNestedPracticeRef(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const contentCode = placementToken(value.contentCode)
  const questionItemId = placementToken(value.questionItemId)
  const contentVersionId = placementInteger(value.contentVersionId)
  return Boolean(contentCode && questionItemId && contentVersionId != null && contentVersionId >= 1)
}

function confirmedDueItemIds(items) {
  if (!Array.isArray(items) || items.length > 64) return []
  const ids = []
  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue
    if (item.arrangement !== 'DUE') continue
    if (!realNestedPracticeRef(item.practiceRef)) continue
    const itemId = placementToken(item.itemId)
    if (!itemId) continue
    ids.push(itemId)
  }
  return ids
}

function parseTodayReadback(raw) {
  const envelope = placementJson(raw)
  if (!envelope) return null
  const data = unwrapData(envelope)
  if (!data) return null
  const planId = placementToken(data.planId)
  const planVersion = placementInteger(data.planVersion)
  const algorithmVersion = placementText(data.algorithmVersion, 64)
  const status = placementText(data.status, 32)
  const items = Array.isArray(data.items) ? data.items.length : null
  const count = placementInteger(data.count)
  if (!planId || planVersion == null || planVersion < 1) return null
  if (!algorithmVersion || !status) return null
  return { planId, planVersion, algorithmVersion, status, itemCount: items ?? count ?? 0, dueItemIds: confirmedDueItemIds(data.items) }
}

function targetPutMatches(value) {
  if (!value) return false
  const keys = Object.keys(value)
  return keys.length === 5
    && value.goalCode === 'CET_4_6'
    && value.targetLevel === 'B1'
    && value.dailyQuotaMinutes === 30
    && value.expectedStateVersion === 0
    && value.status === 'ACTIVE'
}

function targetReadbackMatches(value) {
  const record = unwrapData(value)
  if (!record) return false
  return record.goalCode === 'COLLEGE_CET'
    && record.targetLevel === 'B1'
    && record.dailyQuotaMinutes === 30
    && record.status === 'ACTIVE'
    && record.stateVersion === 1
    && record.targetVersion === 1
}

function idempotencyPresent(request) {
  const value = request.headers()['idempotency-key']
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\r\n]/.test(value)
}

async function controlSelected(locator) {
  const until = Date.now() + 3000
  while (Date.now() < until) {
    const pressed = await locator.getAttribute('aria-pressed').catch(() => null)
    const selected = await locator.evaluate((element) => element.classList.contains('is-selected')).catch(() => false)
    if (pressed === 'true' || selected === true) return true
    await locator.page().waitForTimeout(50)
  }
  return false
}

async function savedSummaryVisible(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.onboarding-summary')
    if (!root || !root.isConnected) return false
    const view = root.ownerDocument && root.ownerDocument.defaultView
    const hidden = (node) => {
      if (!node || node.nodeType !== 1) return false
      const style = view && view.getComputedStyle(node)
      return Boolean(style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'))
    }
    if (hidden(root)) return false
    const read = (node) => {
      if (!node) return ''
      if (node.nodeType === 3) return typeof node.data === 'string' ? node.data : ''
      if (node.nodeType !== 1 && node.nodeType !== 11) return ''
      if (node.nodeType === 1 && hidden(node)) return ''
      let text = ''
      if (node.shadowRoot) text += read(node.shadowRoot)
      const children = node.childNodes
      for (let index = 0; index < children.length; index += 1) text += read(children[index])
      return text
    }
    const text = read(root).replace(/\s+/g, '')
    return text.includes('已保存学习目标') && text.includes('四六级备考') && text.includes('30分钟')
  }).catch(() => false)
}

async function postSaveSurface(page) {
  if (await savedSummaryVisible(page)) return 'summary'
  const onAssessment = await page.evaluate(() => {
    const path = (location.hash || '').replace(/^#/, '').split('?')[0]
    return path === '/pages/assessment/assessment'
  }).catch(() => false)
  return onAssessment ? 'assessment' : 'none'
}

function isWriteMethod(method) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
}

function summarizeTarget(traffic, ui, placement = false, full = false, retest = false) {
  const continued = traffic.filter((row) => row.disposition === 'continue')
  const puts = continued.filter((row) => row.type === 'gateway-target-put' && row.method === 'PUT')
  const putOk = puts.length === 1 && puts[0].status === 200 && ui.putBodyMatch === true && ui.idempotencyPresent === true
  const preferenceWrites = traffic.filter((row) => row.path === '/api/v1/learner/preferences' && isWriteMethod(row.method))
  const consentWrites = traffic.filter((row) => row.path === '/api/v1/iam/consents' && isWriteMethod(row.method))
  const planGets = continued.filter((row) => row.type === 'gateway-today-plan' && row.method === 'GET')
  const planWrites = traffic.filter((row) => (
    (row.path === TODAY_PLAN_PATH && isWriteMethod(row.method))
    || (row.path.startsWith('/api/v1/learning/') && isWriteMethod(row.method))
  ))
  const continuedPlanWrites = planWrites.filter((row) => row.disposition === 'continue')
  const planEnsureWrites = continuedPlanWrites.filter((row) => row.type === 'gateway-plan-ensure' && row.method === 'POST')
  const unexpectedPlanWrites = full
    ? continuedPlanWrites.filter((row) => !(row.type === 'gateway-plan-ensure' && row.method === 'POST'))
    : continuedPlanWrites
  const extraWrites = continued.filter((row) => isWriteMethod(row.method)
    && !(row.type === 'iam-login' && row.method === 'POST')
    && !(row.type === 'iam-refresh' && row.method === 'POST')
    && !(row.type === 'gateway-target-put' && row.method === 'PUT')
    && !(placement && row.type === 'gateway-placement-create' && row.method === 'POST')
    && !(full && row.type === 'gateway-placement-response' && row.method === 'POST')
    && !(full && row.type === 'gateway-plan-ensure' && row.method === 'POST')
    && !(retest && row.type === 'gateway-placement-retest' && row.method === 'POST'))
  const unknownContinued = traffic.filter((row) => (row.disposition === 'continue' && row.type === 'unexpected') || row.reason === 'route-handler-failed')
  const synthetic = traffic.filter((row) => row.disposition === 'fulfill' || row.type === 'synthetic-learner-targets')
  const planStatuses = planGets.map((row) => (Number.isInteger(row.status) ? row.status : null))
  const savedAfter = ui.readbackMatched === true && ui.savedBefore !== true && ui.savedUiAt != null && ui.readbackAt != null && ui.savedUiAt >= ui.readbackAt && ui.savedVisible === true
  const planOk = full
    ? unexpectedPlanWrites.length === 0 && planEnsureWrites.length <= 1
    : (placement ? continuedPlanWrites.length === 0 : planWrites.length === 0)
  const met = ui.goalStep === true && ui.cetSelected === true && ui.quotaSelected === true && ui.saveClicks === 1
    && putOk && ui.readbackMatched === true && savedAfter && ui.savedBefore !== true
    && preferenceWrites.length === 0 && consentWrites.length === 0
    && planOk
    && extraWrites.length === 0 && unknownContinued.length === 0 && synthetic.length === 0
  return {
    met,
    expectations: {
      goalStep: ui.goalStep === true,
      cetSelected: ui.cetSelected === true,
      quotaSelected: ui.quotaSelected === true,
      saveClicks: ui.saveClicks,
      targetPutCount: puts.length,
      targetPutStatus: puts.length === 1 ? puts[0].status : null,
      targetPutBodyMatch: ui.putBodyMatch === true && puts.length === 1,
      idempotencyKeyPresent: ui.idempotencyPresent === true && puts.length === 1,
      targetReadbackMatch: ui.readbackMatched === true,
      savedUiAfterReadback: savedAfter,
      savedSurface: ui.savedSurface === 'summary' || ui.savedSurface === 'assessment' ? ui.savedSurface : 'none',
      savedUiBeforeReadback: ui.savedBefore === true,
      preferenceWrites: preferenceWrites.length,
      consentWrites: consentWrites.length,
      planGetCount: planGets.length,
      planGetStatus: planStatuses.length === 1 ? planStatuses[0] : null,
      planGetStatuses: planStatuses,
      planWriteCount: planWrites.length,
      ...(placement ? { planContinuedWrites: continuedPlanWrites.length } : {}),
      ...(full ? { planEnsureContinuedWrites: planEnsureWrites.length, unexpectedPlanWrites: unexpectedPlanWrites.length } : {}),
      extraContinuedWrites: extraWrites.length,
      unknownContinued: unknownContinued.length,
      syntheticResponses: synthetic.length,
      staticFulfills: ui.staticFulfills,
    },
  }
}

function summarizePlacement(traffic, obs) {
  const continued = traffic.filter((row) => row.disposition === 'continue')
  const posts = continued.filter((row) => row.type === 'gateway-placement-create' && row.method === 'POST')
  const createOptions = continued.filter((row) => row.type === 'gateway-placement-create' && row.method === 'OPTIONS')
  const reads = continued.filter((row) => row.type === 'gateway-placement-read' && row.method === 'GET')
  const readOptions = continued.filter((row) => row.type === 'gateway-placement-read' && row.method === 'OPTIONS')
  const post = posts.length === 1 ? posts[0] : null
  const answerWrites = traffic.filter((row) => isWriteMethod(row.method) && /^\/api\/v1\/assessment\/placement\/sessions\/\{sessionId\}\/responses$/.test(row.path))
  const planWriteAttempts = traffic.filter((row) => isWriteMethod(row.method) && (
    row.path === TODAY_PLAN_PATH || row.path.startsWith('/api/v1/learning/') || row.path.startsWith('/api/v1/learner/plan')
  ))
  const planWrites = planWriteAttempts.filter((row) => row.disposition === 'continue')
  const retestWrites = traffic.filter((row) => isWriteMethod(row.method) && /^\/api\/v1\/assessment\/placement\/sessions\/\{sessionId\}\/retest$/.test(row.path))
  const skipWrites = traffic.filter((row) => isWriteMethod(row.method) && /\/skip$/.test(row.path))
  const extraWrites = continued.filter((row) => isWriteMethod(row.method)
    && !(row.type === 'iam-login' && row.method === 'POST')
    && !(row.type === 'iam-refresh' && row.method === 'POST')
    && !(row.type === 'gateway-target-put' && row.method === 'PUT')
    && !(row.type === 'gateway-placement-create' && row.method === 'POST'))
  const synthetic = traffic.filter((row) => row.disposition === 'fulfill')
  const unknownContinued = traffic.filter((row) => (row.disposition === 'continue' && row.type === 'unexpected') || row.reason === 'route-handler-failed')
  const missingAuthorization = traffic.filter((row) => row.reason === 'missing-authorization')
  const prematurePosts = traffic.filter((row) => row.reason === 'placement-post-before-start')
  const duplicatePosts = traffic.filter((row) => row.reason === 'duplicate-placement-post')
  const duplicateReads = traffic.filter((row) => row.reason === 'duplicate-placement-read')
  const unauthorizedReads = traffic.filter((row) => row.reason === 'placement-session-not-owned')

  const postOk = Boolean(post && post.status === 201)
  const bodyOk = obs.placementPostBodyEmpty === true
  const idempotencyOk = obs.placementPostIdempotency === true
  const pinsOk = obs.placementOwnerSession === true && obs.placementContentVersionId === true
    && obs.placementFirstItem === true && obs.placementTotalItems === true
  const startOk = obs.placementAssessmentRoute === true && obs.placementGuideVisible === true
    && obs.placementStartSelectorConfirmed === true && obs.placementStartActivated === true
    && obs.placementStartFocused === true && obs.placementStartPresses === 1 && obs.placementPostAfterStart === true
  const questionOk = obs.placementQuestionVisible === true
  const stemOk = obs.placementStemMatch === true
  const optionsOk = obs.placementOptionsMatch === true && Number.isInteger(obs.placementOptionCount) && obs.placementOptionCount > 0
  const progressOk = obs.placementQuestionCountMatch === true && obs.placementProgressAcceptedMatch === true
    && obs.placementProgressTextPresent === true && obs.placementProgressMax === PLACEMENT_TOTAL_ITEMS
  const submitOk = obs.placementSubmitVisible === true && obs.placementSubmitDisabled === true && obs.placementNoChoiceSelected === true
  const readOk = reads.length <= 1 && reads.every((row) => row.status === 200)
    && (reads.length === 0 || obs.placementReadAfterPost === true)
  const writesOk = answerWrites.length === 0 && planWrites.length === 0 && retestWrites.length === 0
    && skipWrites.length === 0 && extraWrites.length === 0
  const responsesOk = synthetic.length === 0 && unknownContinued.length === 0 && missingAuthorization.length === 0
    && prematurePosts.length === 0 && duplicatePosts.length === 0 && duplicateReads.length === 0 && unauthorizedReads.length === 0

  let reason = null
  if (posts.length !== 1) reason = 'placement-post-count'
  else if (!postOk) reason = 'placement-post-status'
  else if (!bodyOk) reason = 'placement-post-body'
  else if (!idempotencyOk) reason = 'placement-post-idempotency'
  else if (!startOk) reason = 'placement-start'
  else if (!questionOk) reason = 'placement-question'
  else if (!pinsOk) reason = 'placement-pins'
  else if (!stemOk) reason = 'placement-stem'
  else if (!optionsOk) reason = 'placement-options'
  else if (!progressOk) reason = 'placement-progress'
  else if (!submitOk) reason = 'placement-submit'
  else if (!readOk) reason = 'placement-read'
  else if (answerWrites.length) reason = 'placement-answer-write'
  else if (planWrites.length) reason = 'placement-plan-write'
  else if (retestWrites.length) reason = 'placement-retest-write'
  else if (skipWrites.length) reason = 'placement-skip-write'
  else if (extraWrites.length) reason = 'placement-extra-write'
  else if (synthetic.length) reason = 'placement-synthetic-response'
  else if (unknownContinued.length) reason = 'placement-unknown-continued'
  else if (missingAuthorization.length) reason = 'placement-missing-authorization'
  else if (prematurePosts.length) reason = 'placement-post-before-start'
  else if (duplicatePosts.length) reason = 'placement-duplicate-post'
  else if (duplicateReads.length) reason = 'placement-duplicate-read'
  else if (unauthorizedReads.length) reason = 'placement-session-not-owned'
  else if (!writesOk) reason = 'placement-write'
  else if (!responsesOk) reason = 'placement-response'

  return {
    met: reason === null,
    reason,
    expectations: {
      assessmentRoute: obs.placementAssessmentRoute === true,
      guideVisible: obs.placementGuideVisible === true,
      startSelectorConfirmed: obs.placementStartSelectorConfirmed === true,
      startFocused: obs.placementStartFocused === true,
      startPresses: obs.placementStartPresses,
      questionVisible: obs.placementQuestionVisible === true,
      postCount: posts.length,
      postStatus: post ? post.status : null,
      postBodyEmpty: obs.placementPostBodyEmpty === true,
      postBodyKind: obs.placementPostBodyKind || null,
      postIdempotency: obs.placementPostIdempotency === true,
      postAfterStart: obs.placementPostAfterStart === true,
      ownerSession: obs.placementOwnerSession === true,
      acceptedSequence: obs.placementAcceptedSequence ?? null,
      nextSequence: obs.placementNextSequence ?? null,
      contentVersionIdMatch: obs.placementContentVersionId === true,
      firstItemMatch: obs.placementFirstItem === true,
      totalItemCountMatch: obs.placementTotalItems === true,
      stemMatch: obs.placementStemMatch === true,
      optionCount: Number.isInteger(obs.placementOptionCount) ? obs.placementOptionCount : 0,
      optionsMatch: obs.placementOptionsMatch === true,
      noChoiceSelected: obs.placementNoChoiceSelected === true,
      questionNow: obs.placementQuestionNow ?? null,
      questionTotal: obs.placementQuestionTotal ?? null,
      questionCountMatch: obs.placementQuestionCountMatch === true,
      progressAcceptedNow: obs.placementProgressNow ?? null,
      progressMax: obs.placementProgressMax ?? null,
      progressAcceptedMatch: obs.placementProgressAcceptedMatch === true,
      progressTextPresent: obs.placementProgressTextPresent === true,
      submitVisible: obs.placementSubmitVisible === true,
      submitDisabled: obs.placementSubmitDisabled === true,
      sessionReadCount: reads.length,
      sessionReadStatus: reads.length === 1 ? reads[0].status : null,
      sessionReadAfterPost: obs.placementReadAfterPost === true,
      createOptions: createOptions.length,
      readOptions: readOptions.length,
      answerWrites: answerWrites.length,
      planWrites: planWrites.length,
      planWriteAttempts: planWriteAttempts.length,
      retestWrites: retestWrites.length,
      skipWrites: skipWrites.length,
      extraContinuedWrites: extraWrites.length,
      syntheticResponses: synthetic.length,
      unknownContinued: unknownContinued.length,
      missingAuthorization: missingAuthorization.length,
      prematurePosts: prematurePosts.length,
      duplicatePosts: duplicatePosts.length,
      duplicateReads: duplicateReads.length,
      unauthorizedReads: unauthorizedReads.length,
      foreignOriginAttempts: Number.isInteger(obs.foreignOriginAttempts) ? obs.foreignOriginAttempts : 0,
    },
  }
}


function summarizeFull(traffic, obs, full, retest = false) {
  const dropDueIds = (row) => {
    if (row && Object.prototype.hasOwnProperty.call(row, 'dueItemIds')) delete row.dueItemIds
  }
  if (full && full.today && Array.isArray(full.today.afterEnsure)) full.today.afterEnsure.forEach(dropDueIds)
  if (full && full.today && Array.isArray(full.today.afterUi)) full.today.afterUi.forEach(dropDueIds)
  const continued = traffic.filter((row) => row.disposition === 'continue')
  const responseRows = continued.filter((row) => row.type === 'gateway-placement-response' && row.method === 'POST')
  const ensureRows = continued.filter((row) => row.type === 'gateway-plan-ensure' && row.method === 'POST')
  const todayRows = continued.filter((row) => row.type === 'gateway-today-plan' && row.method === 'GET')
  const homeRows = continued.filter((row) => row.type === 'gateway-learner-home' && row.method === 'GET')
  const catalogRows = continued.filter((row) => row.type === 'gateway-content-catalog' && row.method === 'GET')
  const answerWrites = traffic.filter((row) => isWriteMethod(row.method) && /^\/api\/v1\/assessment\/placement\/sessions\/\{sessionId\}\/responses$/.test(row.path))
  const unexpectedAnswerWrites = answerWrites.filter((row) => row.disposition !== 'continue')
  const retestWrites = traffic.filter((row) => isWriteMethod(row.method) && /^\/api\/v1\/assessment\/placement\/sessions\/\{sessionId\}\/retest$/.test(row.path))
  const skipWrites = traffic.filter((row) => isWriteMethod(row.method) && /\/skip$/.test(row.path))
  const planWrites = traffic.filter((row) => isWriteMethod(row.method) && (
    row.path === TODAY_PLAN_PATH || row.path.startsWith('/api/v1/learning/') || row.path.startsWith('/api/v1/learner/plan')
  ))
  const continuedPlanWrites = planWrites.filter((row) => row.disposition === 'continue')
  const unexpectedPlanWrites = continuedPlanWrites.filter((row) => !(row.type === 'gateway-plan-ensure' && row.method === 'POST'))
  const extraWrites = continued.filter((row) => isWriteMethod(row.method)
    && !(row.type === 'iam-login' && row.method === 'POST')
    && !(row.type === 'iam-refresh' && row.method === 'POST')
    && !(row.type === 'gateway-target-put' && row.method === 'PUT')
    && !(row.type === 'gateway-placement-create' && row.method === 'POST')
    && !(row.type === 'gateway-placement-response' && row.method === 'POST')
    && !(row.type === 'gateway-plan-ensure' && row.method === 'POST')
    && !(retest && row.type === 'gateway-placement-retest' && row.method === 'POST'))
  const synthetic = traffic.filter((row) => row.disposition === 'fulfill')
  const unknownContinued = traffic.filter((row) => (row.disposition === 'continue' && row.type === 'unexpected') || row.reason === 'route-handler-failed')
  const missingAuthorization = traffic.filter((row) => row.reason === 'missing-authorization')
  const duplicateResponses = traffic.filter((row) => row.reason === 'full-duplicate-response')
  const prematureResponses = traffic.filter((row) => row.reason === 'full-response-before-ui')
  const wrongSequence = traffic.filter((row) => row.reason === 'full-response-sequence')
  const wrongVersion = traffic.filter((row) => row.reason === 'full-response-version')
  const wrongItem = traffic.filter((row) => row.reason === 'full-response-item')
  const wrongOption = traffic.filter((row) => row.reason === 'full-response-option')
  const wrongBody = traffic.filter((row) => row.reason === 'full-response-body')
  const wrongDigest = traffic.filter((row) => row.reason === 'full-response-digest')
  const wrongSession = traffic.filter((row) => row.reason === 'full-session-not-owned')
  const duplicateEnsure = traffic.filter((row) => row.reason === 'full-duplicate-plan-ensure')
  const earlyEnsure = traffic.filter((row) => row.reason === 'full-plan-ensure-before-report')
  const earlyHome = traffic.filter((row) => row.reason === 'full-home-before-ui')
  const duplicateHome = traffic.filter((row) => row.reason === 'full-home-duplicate')
  const allResponses = responseRows.length === PLACEMENT_TOTAL_ITEMS
    && responseRows.every((row) => row.status === 200)
    && full.responses.length === PLACEMENT_TOTAL_ITEMS
    && full.responses.every((row) => row.status === 200 && row.accepted === row.sequence
      && row.nextSequence === row.sequence + 1 && row.versionOk === true
      && row.itemOk === true && row.bodyOk === true && row.idempotency === true
      && (row.sequence === PLACEMENT_TOTAL_ITEMS ? row.finalOk === true : (row.feedbackPresent === true && row.nextItemOk === true)))
  const reportOk = Boolean(full.final) && full.reportVisible === true && full.reportCard === true && full.reportComplete === true
    && full.reportLevelMatch === true && full.reportScoreMatch === true
    && full.reportSaved === true && full.reportPlanError !== true
    && full.reportTodayButton === true
  const ensureOk = ensureRows.length === 1 && ensureRows[0].status === 200
    && full.ensure.requested === 1 && full.ensure.status === 200
    && full.ensure.bodyOk === true && full.ensure.idempotency === true
    && Boolean(full.ensure.result) && Boolean(full.final)
  const todayAfterEnsure = full.today.afterEnsure.filter((row) => row.status === 200 && row.parsed)
  const todayAfterUi = full.today.afterUi.filter((row) => row.status === 200 && row.parsed)
  const planMatches = Boolean(full.ensure.result)
    && todayAfterEnsure.some((row) => row.planId === full.ensure.result.planId
      && row.planVersion >= full.ensure.result.planVersion)
  const todayOk = todayAfterEnsure.length >= 1 && planMatches
  const dueRowsOk = full.today.dueRowsCount === 3
    && full.today.dueRowsMatch === true
    && full.today.falseEmptyVisible !== true
    && full.today.dueRowsReadOnly === true
  const todayUiOk = full.todayUiClickedAt != null && todayAfterUi.length >= 1
    && full.today.uiVisible === true && full.today.uiVisual !== true
    && typeof full.today.uiAlgorithmVersion === 'string' && full.today.uiAlgorithmVersion.length > 0
    && todayAfterUi.some((row) => row.algorithmVersion === full.today.uiAlgorithmVersion)
  const homeOk = full.home.requested === 1 && homeRows.length === 1 && homeRows.every((row) => row.status === 200) && full.home.statuses.length === 1 && full.home.statuses.every((status) => status === 200)
  const catalogOk = full.catalog.requested === 1 && catalogRows.length === 1 && catalogRows.every((row) => row.status === 200) && full.catalog.statuses.length === 1 && full.catalog.statuses.every((status) => status === 200)
  const retestPosts = continued.filter((row) => row.type === 'gateway-placement-retest' && row.method === 'POST')
  const retestState = full.retest && typeof full.retest === 'object' ? full.retest : null
  const retestOk = retest && retestPosts.length === 1 && retestPosts[0].status === 201 && retestWrites.length === 1
    && retestState && retestState.requested === 1 && retestState.status === 201
    && retestState.bodyEmpty === true && retestState.idempotency === true && retestState.authorized === true
    && retestState.sessionNew === true && retestState.questionVisible === true && retestState.reportScreenLeft === true
    && retestState.confirmClicks === 1 && retestState.submitStillDisabled === true && retestState.noChoice === true
    && retestState.firstItem === true && full.todayUiClickedAt == null && full.today.afterUi.length === 0
    && full.home.requested === 0 && full.catalog.requested === 0
  const writesOk = (retest ? retestOk : retestWrites.length === 0) && skipWrites.length === 0
    && unexpectedAnswerWrites.length === 0
    && unexpectedPlanWrites.length === 0 && extraWrites.length === 0
  const uiOk = full.ui.submitClicks === PLACEMENT_TOTAL_ITEMS
  const abortsOk = duplicateResponses.length === 0 && prematureResponses.length === 0
    && wrongSequence.length === 0 && wrongVersion.length === 0 && wrongItem.length === 0
    && wrongOption.length === 0 && wrongBody.length === 0 && wrongDigest.length === 0 && wrongSession.length === 0
    && duplicateEnsure.length === 0 && earlyEnsure.length === 0 && earlyHome.length === 0
    && duplicateHome.length === 0
  const clean = synthetic.length === 0 && unknownContinued.length === 0 && missingAuthorization.length === 0

  let reason = full.failure || null
  if (!reason) {
    if (responseRows.length !== PLACEMENT_TOTAL_ITEMS) reason = 'full-response-count'
    else if (!allResponses) reason = 'full-response'
    else if (!full.final) reason = 'full-report-missing'
    else if (!reportOk) reason = 'full-report'
    else if (!ensureOk) reason = 'full-plan-ensure'
    else if (!todayOk) reason = 'full-today'
    else if (retest && (full.todayUiClickedAt != null || full.today.afterUi.length !== 0 || full.home.requested !== 0 || full.catalog.requested !== 0)) reason = 'full-retest-left-report'
    else if (retest && !retestOk) reason = 'full-retest'
    else if (!retest && (!todayUiOk || !dueRowsOk)) reason = 'full-today-ui'
    else if (!retest && !homeOk) reason = 'full-home'
    else if (!retest && !catalogOk) reason = 'full-catalog'
    else if (!uiOk) reason = 'full-ui'
    else if (!writesOk) reason = 'full-write'
    else if (!abortsOk) reason = 'full-abort'
    else if (!clean) reason = 'full-response-integrity'
  }

  return {
    met: reason === null,
    reason,
    expectations: {
      responses: full.responses.map((row) => ({
        sequence: row.sequence,
        status: row.status,
        acceptedSequence: row.accepted,
        nextSequence: row.nextSequence,
        versionOk: row.versionOk === true,
        itemOk: row.itemOk === true,
        bodyOk: row.bodyOk === true,
        idempotency: row.idempotency === true,
        feedbackPresent: row.feedbackPresent === true,
        nextItemOk: row.nextItemOk === true,
        finalOk: row.finalOk === true,
        firstOptionIndex: row.firstOptionIndex,
      })),
      responseCount: responseRows.length,
      finalReportPresent: Boolean(full.final),
      finalReportKind: full.final ? full.final.resultKind : null,
      finalReportLevelPresent: Boolean(full.final && full.final.referenceLevel),
      finalReportScorePresent: Boolean(full.final && Number.isInteger(full.final.aggregateScore)),
      finalReportItemCount: full.final && Number.isInteger(full.final.itemCount) ? full.final.itemCount : null,
      finalReportFullCount: full.final && Number.isInteger(full.final.fullCount) ? full.final.fullCount : null,
      finalReportDigestPresent: Boolean(full.final && (sha256Hex(full.final.reportDigest) || (full.final.coverageRatio != null))),
      reportVisible: full.reportVisible === true,
      reportCardVisible: full.reportCard === true,
      reportCompleteVisible: full.reportComplete === true,
      reportLevelMatch: full.reportLevelMatch === true,
      reportScoreMatch: full.reportScoreMatch === true,
      reportSavedVisible: full.reportSaved === true,
      reportPlanError: full.reportPlanError === true,
      reportTodayButton: full.reportTodayButton === true,
      planEnsureCount: ensureRows.length,
      planEnsureStatus: ensureRows.length === 1 ? ensureRows[0].status : null,
      planEnsureBodyOk: full.ensure.bodyOk === true,
      planEnsureIdempotency: full.ensure.idempotency === true,
      planEnsurePlanPresent: Boolean(full.ensure.result),
      planEnsurePlanVersion: full.ensure.result ? full.ensure.result.planVersion : null,
      todayReadCount: todayRows.length,
      todayAfterEnsureCount: full.today.afterEnsure.length,
      todayAfterEnsureStatuses: full.today.afterEnsure.map((row) => row.status),
      todayAfterEnsurePlanMatch: planMatches,
      todayAfterUiCount: full.today.afterUi.length,
      todayAfterUiStatuses: full.today.afterUi.map((row) => row.status),
      todayUiClicked: full.todayUiClickedAt != null,
      todayUiVisible: full.today.uiVisible === true,
      todayUiVisual: full.today.uiVisual === true,
      todayUiAlgorithmVersionPresent: typeof full.today.uiAlgorithmVersion === 'string' && full.today.uiAlgorithmVersion.length > 0,
      todayUiAlgorithmVersionMatch: todayUiOk,
      todayDueRowsCount: Number.isInteger(full.today.dueRowsCount) && full.today.dueRowsCount >= 0 && full.today.dueRowsCount <= 64 ? full.today.dueRowsCount : 0,
      todayDueRowsMatch: full.today.dueRowsMatch === true,
      todayFalseEmptyVisible: full.today.falseEmptyVisible === true,
      todayDueRowsReadOnly: full.today.dueRowsReadOnly === true,
      homeCount: homeRows.length,
      homeRequests: full.home.requested,
      homeStatuses: homeRows.map((row) => row.status),
      catalogCount: catalogRows.length,
      catalogRequests: full.catalog.requested,
      catalogStatuses: catalogRows.map((row) => row.status),
      submitClicks: full.ui.submitClicks,
      retestContinuation: retest === true,
      retestWrites: retestWrites.length,
      retestStatus: retest && retestPosts.length === 1 ? retestPosts[0].status : null,
      retestBodyEmpty: Boolean(retestState && retestState.bodyEmpty === true),
      retestIdempotency: Boolean(retestState && retestState.idempotency === true),
      retestAuthorized: Boolean(retestState && retestState.authorized === true),
      retestSessionNew: Boolean(retestState && retestState.sessionNew === true),
      retestQuestionVisible: Boolean(retestState && retestState.questionVisible === true),
      retestReportScreenLeft: Boolean(retestState && retestState.reportScreenLeft === true),
      retestConfirmClicks: retestState && Number.isInteger(retestState.confirmClicks) ? retestState.confirmClicks : 0,
      retestSubmitStillDisabled: Boolean(retestState && retestState.submitStillDisabled === true),
      retestNoChoice: Boolean(retestState && retestState.noChoice === true),
      retestFirstItem: Boolean(retestState && retestState.firstItem === true),
      skipWrites: skipWrites.length,
      unexpectedPlanWrites: unexpectedPlanWrites.length,
      extraContinuedWrites: extraWrites.length,
      duplicateResponseAttempts: duplicateResponses.length,
      prematureResponseAttempts: prematureResponses.length,
      wrongSequenceAttempts: wrongSequence.length,
      wrongVersionAttempts: wrongVersion.length,
      wrongItemAttempts: wrongItem.length,
      wrongOptionAttempts: wrongOption.length,
      wrongBodyAttempts: wrongBody.length,
      wrongDigestAttempts: wrongDigest.length,
      wrongSessionAttempts: wrongSession.length,
      duplicateEnsureAttempts: duplicateEnsure.length,
      earlyEnsureAttempts: earlyEnsure.length,
      earlyHomeAttempts: earlyHome.length,
      duplicateHomeAttempts: duplicateHome.length,
      syntheticResponses: synthetic.length,
      unknownContinued: unknownContinued.length,
      missingAuthorization: missingAuthorization.length,
      foreignOriginAttempts: Number.isInteger(obs.foreignOriginAttempts) ? obs.foreignOriginAttempts : 0,
    },
  }
}

async function waitForPlacementPostSettled(state, until) {
  if (!state || !state.postSettled) return
  const remaining = Math.max(0, until - Date.now())
  if (remaining === 0) return
  await Promise.race([state.postSettled, new Promise((resolve) => setTimeout(resolve, remaining))])
}

async function waitForPlacementPost(obs, deadline) {
  const until = Math.min(deadline, Date.now() + 15000)
  while (obs.placementPostCount === 0 && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  return obs.placementPostCount
}

async function waitForAssessmentRoute(page, deadline) {
  const until = Math.min(deadline, Date.now() + 20000)
  while (Date.now() < until) {
    if (await postSaveSurface(page) === 'assessment') return true
    await page.waitForTimeout(200)
  }
  return (await postSaveSurface(page)) === 'assessment'
}

async function waitForPlacementGuide(page, deadline) {
  const until = Math.min(deadline, Date.now() + 20000)
  while (Date.now() < until) {
    if (await page.locator('#assessment-guide').isVisible().catch(() => false)) return true
    if (await page.locator('#assessment-question').isVisible().catch(() => false)) return false
    if (await page.locator('#assessment-error').isVisible().catch(() => false)) return false
    await page.waitForTimeout(150)
  }
  return page.locator('#assessment-guide').isVisible().catch(() => false)
}

async function waitForPlacementQuestion(page, deadline) {
  const until = Math.min(deadline, Date.now() + 20000)
  while (Date.now() < until) {
    if (await page.locator('#assessment-question').isVisible().catch(() => false)) return true
    if (await page.locator('#assessment-error').isVisible().catch(() => false)) return false
    await page.waitForTimeout(150)
  }
  return page.locator('#assessment-question').isVisible().catch(() => false)
}

async function readPlacementSurface(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#assessment-question')
    const view = root && root.ownerDocument && root.ownerDocument.defaultView
    const visible = (node) => {
      if (!node || node.nodeType !== 1) return false
      const style = view && view.getComputedStyle(node)
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    const text = (node) => node && typeof node.textContent === 'string' ? node.textContent : null
    const numbers = (value) => (typeof value === 'string' ? (value.match(/\d+/g) || []).map(Number) : [])
    const stem = root ? root.querySelector('.assessment-stem') : null
    const eyebrow = root ? root.querySelector('.assessment-eyebrow') : null
    const optionNodes = root ? Array.from(root.querySelectorAll('.assessment-option')) : []
    const progress = root ? root.querySelector('.assessment-progress') : null
    const submit = root ? root.querySelector('#assessment-submit') : null
    return {
      questionVisible: visible(root),
      stem: text(stem),
      questionNumbers: numbers(text(eyebrow)),
      options: optionNodes.map((option) => ({
        key: text(option.querySelector('.assessment-option-key')),
        text: text(option.querySelector('.assessment-option-text')),
        pressed: option.getAttribute('aria-pressed') === 'true',
        selected: option.classList.contains('is-selected'),
      })),
      progressNow: progress ? progress.getAttribute('aria-valuenow') : null,
      progressMax: progress ? progress.getAttribute('aria-valuemax') : null,
      progressTextPresent: Boolean(progress && typeof progress.getAttribute('aria-valuetext') === 'string' && progress.getAttribute('aria-valuetext').length > 0),
      submitVisible: visible(submit),
      submitDisabled: submit ? (submit.hasAttribute('disabled') || submit.getAttribute('aria-disabled') === 'true') : false,
    }
  })
}

function fullDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fullScorePercent(score) {
  if (typeof score !== 'number' || !Number.isFinite(score) || score < 0) return null
  return Math.round(score <= 1 ? score * 100 : Math.min(score, 100))
}

function makeFullPending(full, sequence) {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  full.pending = { sequence, promise, resolve }
}

function settleFullPending(full, value) {
  const pending = full.pending
  if (!pending) return null
  full.pending = null
  pending.resolve(value)
  return value
}

function makeFullEnsure(full) {
  let resolve
  full.ensure.settled = new Promise((done) => { resolve = done })
  full.ensure.resolve = resolve
}

function settleFullEnsure(full) {
  if (!full.ensure.resolve) return
  const resolve = full.ensure.resolve
  full.ensure.resolve = null
  resolve()
}

function failFull(full, reason) {
  if (!full.failure) full.failure = reason
  settleFullPending(full, null)
  settleFullEnsure(full)
  settleFullRetest(full)
}

function settleFullRetest(full) {
  if (!full || !full.retest || !full.retest.resolve) return
  const resolve = full.retest.resolve
  full.retest.resolve = null
  resolve()
}

const FULL_OBSERVE_FAILURE = 'full-observe-failed'

function failFullObserved(full) {
  try { failFull(full, FULL_OBSERVE_FAILURE) } catch { /* reason stays a fixed token; error text is not stored */ }
}

function watchFullObservation(full, work) {
  let observed
  try {
    observed = work()
  } catch {
    failFullObserved(full)
    return Promise.resolve()
  }
  if (!observed || typeof observed.then !== 'function') return Promise.resolve(observed)
  return observed.catch(() => { failFullObserved(full) })
}

async function waitForFullPending(full, sequence, deadline) {
  const pending = full.pending
  if (!pending || pending.sequence !== sequence) return null
  const wait = Math.max(0, Math.min(deadline - Date.now(), 30000))
  if (wait === 0) return null
  return Promise.race([pending.promise, fullDelay(wait).then(() => null)])
}

async function waitForFullReport(page, full, deadline) {
  const until = Math.min(deadline, Date.now() + 30000)
  let reading = null
  while (Date.now() < until) {
    if (full.failure) return false
    reading = await readFullReportSurface(page).catch(() => null)
    if (reading && reading.reportVisible === true && reading.card === true && reading.complete === true) break
    await page.waitForTimeout(150)
  }
  if (!reading || reading.reportVisible !== true || reading.card !== true || reading.complete !== true) return false
  full.reportVisible = true
  full.reportCard = true
  full.reportComplete = true
  full.reportSaved = typeof reading.saved === 'string' && reading.saved.trim().length > 0
  full.reportPlanError = reading.planError === true
  full.reportTodayButton = reading.todayVisible === true && reading.todayDisabled !== true
  const level = typeof reading.level === 'string' ? reading.level.trim() : ''
  const scoreText = typeof reading.score === 'string' ? reading.score : ''
  const percent = full.final ? fullScorePercent(full.final.aggregateScore) : null
  full.reportLevelMatch = Boolean(full.final && level === full.final.referenceLevel)
  full.reportScoreMatch = Boolean(percent != null && new RegExp(`(^|\\D)${percent}(\\D|$)`).test(scoreText))
  return true
}

function readFullReportSurface(page) {
  return page.evaluate(() => {
    const root = document.querySelector('#assessment-report')
    const view = root && root.ownerDocument && root.ownerDocument.defaultView
    const visible = (node) => {
      if (!node || node.nodeType !== 1) return false
      const style = view && view.getComputedStyle(node)
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    const text = (node) => node && typeof node.textContent === 'string' ? node.textContent : null
    const today = document.querySelector('#assessment-today')
    return {
      reportVisible: visible(root),
      card: root ? visible(root.querySelector('[data-placement-card]')) : false,
      complete: root ? visible(root.querySelector('.assessment-complete')) : false,
      level: root ? text(root.querySelector('.assessment-level')) : null,
      score: root ? text(root.querySelector('.assessment-score')) : null,
      saved: root ? text(root.querySelector('.assessment-saved')) : null,
      planError: root ? visible(root.querySelector('.assessment-error')) : false,
      todayVisible: visible(today),
      todayDisabled: today ? (today.hasAttribute('disabled') || today.getAttribute('aria-disabled') === 'true') : true,
    }
  })
}

function readTodaySurface(page, expectedDueIds) {
  const expected = Array.isArray(expectedDueIds)
    ? expectedDueIds.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128).slice(0, 8)
    : []
  return page.evaluate((ids) => {
    const root = document.querySelector('.today')
    const view = root && root.ownerDocument && root.ownerDocument.defaultView
    const shown = (node) => {
      if (!node || node.nodeType !== 1) return false
      const style = view && view.getComputedStyle(node)
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    const visible = shown(root)
    const algorithmVersion = root ? root.getAttribute('data-algorithm-version') : null
    const visual = root ? root.getAttribute('data-visual') : null
    const expectedIds = Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 128) : []
    const expectedDistinct = new Set(expectedIds)
    const candidates = root ? Array.from(root.querySelectorAll('[data-due-item-id]')) : []
    const visibleRows = candidates.filter((node) => {
      if (!shown(node) || !node.classList || !node.classList.contains('today-row')) return false
      if (node.classList.contains('today-card')) return true
      return Boolean(node.closest && node.closest('.today-card'))
    })
    const rowIds = visibleRows.map((node) => {
      const raw = node.getAttribute('data-due-item-id')
      return typeof raw === 'string' ? raw.trim() : ''
    })
    const seen = new Set(rowIds.filter((id) => id.length > 0 && id.length <= 128))
    const dueRowsCount = visibleRows.length > 64 ? 64 : visibleRows.length
    const dueRowsMatch = expectedIds.length === 3
      && expectedDistinct.size === 3
      && visibleRows.length === 3
      && seen.size === 3
      && rowIds.every((id) => id.length > 0 && id.length <= 128 && expectedDistinct.has(id))
      && expectedIds.every((id) => seen.has(id))
    const activates = (node) => {
      if (!node || node.nodeType !== 1) return false
      const tag = typeof node.tagName === 'string' ? node.tagName.toUpperCase() : ''
      const role = (node.getAttribute('role') || '').toLowerCase()
      if (tag === 'BUTTON' || tag === 'A' || tag === 'UNI-BUTTON') return true
      if (role === 'button' || role === 'link') return true
      if (node.hasAttribute('href')) return true
      const tab = node.getAttribute('tabindex')
      if (tab != null && tab !== '' && Number(tab) >= 0) return true
      return false
    }
    const dueRowsReadOnly = visibleRows.length === 3 && visibleRows.every((node) => {
      if (activates(node)) return false
      return !node.querySelector('button, a, uni-button, [role="button"], [role="link"]')
    })
    const falseEmptyVisible = root ? Array.from(root.querySelectorAll('.empty')).some(shown) : false
    const baseBad = visual === 'loading' || visual === 'offline' || visual === 'error' || visual === 'forbidden' || visual === 'plan-failed'
    // no-tasks is an internal visual, not proof. Rows and .empty are observed separately. ready stays outside this list.
    const noTasksProven = visual === 'no-tasks' && dueRowsMatch === true && falseEmptyVisible === false
    const badVisual = baseBad || (visual === 'no-tasks' && !noTasksProven)
    return { visible, algorithmVersion, visual, badVisual, dueRowsCount, dueRowsMatch, falseEmptyVisible, dueRowsReadOnly }
  }, expected)
}

async function waitForFullEnsure(full, deadline) {
  const until = Math.min(deadline, Date.now() + 20000)
  while (!full.ensure.settledAt && !full.failure && Date.now() < until) await fullDelay(50)
  if (full.failure || full.ensure.settledAt == null) return false
  return full.ensure.status === 200 && Boolean(full.ensure.result)
}

async function waitForFullToday(full, deadline, afterUi) {
  const until = Math.min(deadline, Date.now() + 20000)
  const list = afterUi ? full.today.afterUi : full.today.afterEnsure
  while (list.length === 0 && !full.failure && Date.now() < until) await fullDelay(50)
  if (full.failure) return false
  return list.some((row) => row.status === 200 && row.parsed)
}

async function runPlacementStage(page, obs, placementState, deadline) {
  const routeReached = await waitForAssessmentRoute(page, deadline)
  obs.placementAssessmentRoute = routeReached
  if (!routeReached) return { met: false, reason: 'placement-route-not-reached' }

  const guideVisible = await waitForPlacementGuide(page, deadline)
  obs.placementGuideVisible = guideVisible
  if (!guideVisible) return { met: false, reason: 'placement-guide-not-visible' }

  const guide = page.locator('#assessment-guide')
  const start = guide.locator('#assessment-start')
  await start.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
  const startCount = await start.count().catch(() => 0)
  const startVisible = startCount === 1 && await start.isVisible().catch(() => false)
  const descriptor = startCount === 1 ? await start.evaluate((element) => ({
    tag: element.tagName,
    role: element.getAttribute('role'),
    tabIndex: element.getAttribute('tabindex'),
  })).catch(() => null) : null
  const disabledAttr = startCount === 1 ? await start.getAttribute('disabled').catch(() => null) : null
  const ariaDisabled = startCount === 1 ? await start.getAttribute('aria-disabled').catch(() => null) : null
  const startDisabled = disabledAttr !== null || ariaDisabled === 'true'
  obs.placementStartSelectorConfirmed = Boolean(
    startCount === 1 && startVisible && !startDisabled && descriptor
    && (descriptor.tag === 'BUTTON' || descriptor.tag === 'UNI-BUTTON')
    && descriptor.role === 'button' && descriptor.tabIndex === '0'
  )
  if (!obs.placementStartSelectorConfirmed) return { met: false, reason: 'placement-start-selector-unconfirmed' }

  obs.placementStartActivated = true
  obs.placementStartAt = Date.now()
  try {
    await start.focus()
    obs.placementStartFocused = await start.evaluate((element) => element.ownerDocument.activeElement === element).catch(() => false)
    if (!obs.placementStartFocused) return { met: false, reason: 'placement-start-focus-failed' }
    await page.keyboard.press('Enter')
    obs.placementStartPresses = 1
  } catch {
    obs.placementStartPresses = 0
    return { met: false, reason: 'placement-start-keyboard-failed' }
  }

  await waitForPlacementPost(obs, deadline)
  obs.placementPostAfterStart = obs.placementStartAt != null && obs.placementPostAt != null && obs.placementPostAt >= obs.placementStartAt
  if (obs.placementPostCount !== 1) return { met: false, reason: 'placement-post-count' }
  await waitForPlacementPostSettled(placementState, Math.min(deadline, Date.now() + 5000))
  if (obs.placementPostStatus !== 201) return { met: false, reason: 'placement-post-status' }

  const questionVisible = await waitForPlacementQuestion(page, deadline)
  obs.placementQuestionVisible = questionVisible
  if (!questionVisible) return { met: false, reason: 'placement-question-not-visible' }

  await waitForPlacementPostSettled(placementState, Math.min(deadline, Date.now() + 3000))
  await page.waitForFunction(() => document.querySelectorAll('#assessment-question .assessment-option').length > 0, null, { timeout: 5000 }).catch(() => {})
  const reading = await readPlacementSurface(page).catch(() => null)
  if (!reading) return { met: false, reason: 'placement-surface-unreadable' }

  const session = placementState.session
  obs.placementStemMatch = Boolean(session && typeof reading.stem === 'string' && session.stem === reading.stem)
  obs.placementOptionCount = reading.options.length
  obs.placementOptionsMatch = Boolean(session && session.options && session.options.length === reading.options.length
    && session.options.every((option, index) => reading.options[index]
      && reading.options[index].key === option.key && reading.options[index].text === option.text))
  obs.placementNoChoiceSelected = reading.options.every((option) => option.pressed !== true && option.selected !== true)
  const questionNumbers = Array.isArray(reading.questionNumbers) ? reading.questionNumbers : []
  obs.placementQuestionNow = questionNumbers.length >= 1 ? questionNumbers[0] : null
  obs.placementQuestionTotal = questionNumbers.length >= 2 ? questionNumbers[1] : null
  obs.placementProgressNow = typeof reading.progressNow === 'string' && reading.progressNow.length > 0 && Number.isFinite(Number(reading.progressNow))
    ? Number(reading.progressNow) : null
  obs.placementProgressMax = typeof reading.progressMax === 'string' && reading.progressMax.length > 0 && Number.isFinite(Number(reading.progressMax))
    ? Number(reading.progressMax) : null
  obs.placementProgressTextPresent = reading.progressTextPresent === true
  const expectedQuestionNow = session && Number.isSafeInteger(session.nextSequence) ? session.nextSequence : 1
  const expectedQuestionTotal = session && Number.isSafeInteger(session.totalItemCount) ? session.totalItemCount : PLACEMENT_TOTAL_ITEMS
  const expectedAccepted = session && Number.isSafeInteger(session.acceptedSequence) ? session.acceptedSequence : 0
  obs.placementQuestionCountMatch = obs.placementQuestionNow === expectedQuestionNow && obs.placementQuestionTotal === expectedQuestionTotal
  obs.placementProgressAcceptedMatch = obs.placementProgressNow === expectedAccepted && obs.placementProgressMax === expectedQuestionTotal
  obs.placementSubmitVisible = reading.submitVisible === true
  obs.placementSubmitDisabled = reading.submitDisabled === true
  await page.waitForTimeout(750)
  return { met: true, reason: null }
}

function fullQuestionMatches(reading, item) {
  if (!reading || reading.questionVisible !== true || !item || !Array.isArray(item.options)) return false
  if (reading.stem !== item.stem) return false
  if (reading.options.length !== item.options.length) return false
  return item.options.every((option, index) => reading.options[index]
    && reading.options[index].key === option.key && reading.options[index].text === option.text)
}

async function waitForFullQuestion(page, item, deadline, allowReport = false) {
  const until = Math.min(deadline, Date.now() + 20000)
  while (Date.now() < until) {
    if (await page.locator('#assessment-error').isVisible().catch(() => false)) return null
    const reading = await readPlacementSurface(page).catch(() => null)
    if (fullQuestionMatches(reading, item)) return reading
    if (!allowReport && await page.locator('#assessment-report').isVisible().catch(() => false)) return null
    await page.waitForTimeout(100)
  }
  return null
}

async function waitForFullReportEnabled(page, deadline) {
  const until = Math.min(deadline, Date.now() + 30000)
  const button = page.locator('#assessment-today')
  while (Date.now() < until) {
    const visible = await button.isVisible().catch(() => false)
    const disabled = !visible || await button.isDisabled().catch(() => true) || (await button.getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (visible && !disabled) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function waitForTodayPage(page, full, deadline) {
  const until = Math.min(deadline, Date.now() + 20000)
  let stable = false
  while (Date.now() < until) {
    const confirmed = full.today.afterUi.filter((row) => row.status === 200 && row.parsed && Array.isArray(row.dueItemIds))
    const source = confirmed.length > 0 ? confirmed[confirmed.length - 1] : null
    const reading = await readTodaySurface(page, source ? source.dueItemIds : []).catch(() => null)
    if (!reading) {
      stable = false
    } else {
      const count = Number.isInteger(reading.dueRowsCount) && reading.dueRowsCount >= 0 && reading.dueRowsCount <= 64 ? reading.dueRowsCount : 0
      full.today.dueRowsCount = count
      full.today.dueRowsMatch = reading.dueRowsMatch === true
      full.today.falseEmptyVisible = reading.falseEmptyVisible === true
      full.today.dueRowsReadOnly = reading.dueRowsReadOnly === true
      if (reading.visible) {
        full.today.uiVisible = true
        full.today.uiVisual = reading.badVisual === true
        if (typeof reading.algorithmVersion === 'string' && reading.algorithmVersion.length > 0) {
          full.today.uiAlgorithmVersion = reading.algorithmVersion
        }
      }
      const versionMatch = Boolean(source && typeof source.algorithmVersion === 'string' && source.algorithmVersion === reading.algorithmVersion)
      const settled = reading.visible === true && reading.badVisual !== true && versionMatch
        && count === 3 && reading.dueRowsMatch === true
        && reading.falseEmptyVisible !== true && reading.dueRowsReadOnly === true
      if (settled && stable) return reading
      stable = settled
    }
    await page.waitForTimeout(150)
  }
  return null
}

async function waitForFullIdle(page, deadline) {
  const until = Math.min(deadline, Date.now() + 8000)
  while (Date.now() < until) {
    const busy = await page.locator('#assessment-page').getAttribute('aria-busy').catch(() => null)
    if (busy !== 'true') return true
    await page.waitForTimeout(50)
  }
  return false
}

async function waitForFullSubmitEnabled(page, deadline) {
  const until = Math.min(deadline, Date.now() + 5000)
  const submit = page.locator('#assessment-submit')
  while (Date.now() < until) {
    const visible = await submit.isVisible().catch(() => false)
    const disabled = !visible || await submit.isDisabled().catch(() => true) || (await submit.getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (visible && !disabled) return true
    await page.waitForTimeout(50)
  }
  return false
}

function readRetestSurface(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      if (!node || node.nodeType !== 1) return false
      const view = node.ownerDocument && node.ownerDocument.defaultView
      const style = view && view.getComputedStyle(node)
      if (!style || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false
      const rect = node.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    }
    const retest = document.querySelector('#assessment-retest')
    const dialog = document.querySelector('#assessment-retest-confirmation')
    const report = document.querySelector('#assessment-report')
    return {
      retestVisible: visible(retest),
      retestDisabled: retest ? (retest.hasAttribute('disabled') || retest.getAttribute('aria-disabled') === 'true') : true,
      dialogVisible: visible(dialog),
      reportVisible: visible(report),
    }
  })
}

async function waitForRetestEnabled(page, deadline) {
  const until = Math.min(deadline, Date.now() + 30000)
  const button = page.locator('#assessment-retest')
  while (Date.now() < until) {
    const visible = await button.isVisible().catch(() => false)
    const disabled = !visible || await button.isDisabled().catch(() => true) || (await button.getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (visible && !disabled) return true
    await page.waitForTimeout(100)
  }
  return false
}

async function runFullPlacementStage(page, obs, placementState, full, deadline, retestOptIn = false) {
  if (!full || !placementState || !placementState.session) return { met: false, reason: 'full-session' }
  const session = placementState.session
  const stop = (reason) => {
    failFull(full, reason)
    return { met: false, reason }
  }
  full.sessionId = session.sessionId
  full.accepted = Number.isSafeInteger(session.acceptedSequence) ? session.acceptedSequence : null
  full.stateVersion = Number.isSafeInteger(session.stateVersion) ? session.stateVersion : null
  full.currentItem = {
    itemId: session.itemId,
    stem: session.stem,
    options: session.options,
  }
  if (!full.sessionId || full.accepted !== 0 || session.nextSequence !== 1
    || !Number.isSafeInteger(full.stateVersion) || !full.currentItem.itemId
    || typeof full.currentItem.stem !== 'string' || !Array.isArray(full.currentItem.options) || full.currentItem.options.length === 0) {
    return stop('full-session')
  }

  for (let sequence = 1; sequence <= PLACEMENT_TOTAL_ITEMS; sequence += 1) {
    if (full.failure) return { met: false, reason: full.failure }
    if (Date.now() > deadline) return stop('full-deadline')
    const item = full.currentItem
    const reading = await waitForFullQuestion(page, item, deadline)
    if (!reading) return stop('full-question')
    if (!(await waitForFullIdle(page, deadline))) return stop('full-busy')
    const stable = await readPlacementSurface(page).catch(() => null)
    if (!fullQuestionMatches(stable, item)) return stop('full-question')
    if (stable.options.some((option) => option.pressed === true || option.selected === true)) return stop('full-draft')
    if (stable.submitVisible !== true || stable.submitDisabled !== true) return stop('full-submit-before-choice')

    const firstOption = page.locator('#assessment-question .assessment-option').first()
    if (await firstOption.count().catch(() => 0) !== 1) return stop('full-option')
    await firstOption.click()
    if (!(await controlSelected(firstOption))) return stop('full-option-selected')
    if (!(await waitForFullSubmitEnabled(page, deadline))) return stop('full-submit-disabled')
    const chosen = await readPlacementSurface(page).catch(() => null)
    if (!chosen || !chosen.options[0] || chosen.options[0].pressed !== true || chosen.options[0].selected !== true
      || chosen.options.some((option, index) => index > 0 && (option.pressed === true || option.selected === true))) {
      return stop('full-option-selected')
    }
    if (chosen.submitVisible !== true || chosen.submitDisabled === true) return stop('full-submit-disabled')
    const selectedControlId = await firstOption.getAttribute('id').catch(() => null)
    if (selectedControlId !== `assessment-option-${item.options[0].key}`) return stop('full-option')

    full.armed = { sessionId: full.sessionId, sequence, itemId: item.itemId, stateVersion: full.stateVersion, optionKey: item.options[0].key }
    makeFullPending(full, sequence)
    full.ui.submitClicks += 1
    await page.locator('#assessment-submit').click()
    const receipt = await waitForFullPending(full, sequence, deadline)
    full.armed = null
    if (!receipt) return stop(full.failure || 'full-response-timeout')
    if (!receipt.check || receipt.check.bodyOk !== true || receipt.check.idempotency !== true) return stop('full-response-body')
    if (receipt.status !== 200) return stop('full-response-status')
    const parsed = receipt.receipt
    if (!parsed) return stop('full-response-body')
    if (parsed.sessionId !== full.sessionId) return stop('full-session-not-owned')
    if (!Number.isSafeInteger(full.stateVersion) || parsed.stateVersion !== full.stateVersion + 1) return stop('full-response-version')
    if (parsed.acceptedSequence !== sequence || parsed.nextSequence !== sequence + 1) return stop('full-response-sequence')
    if (!parsed.outcome) return stop('full-feedback')
    if (!receipt.check.itemOk) return stop('full-response-item')

    const row = {
      sequence,
      status: receipt.status,
      accepted: parsed.acceptedSequence,
      nextSequence: parsed.nextSequence,
      versionOk: true,
      itemOk: true,
      bodyOk: true,
      idempotency: true,
      feedbackPresent: true,
      nextItemOk: sequence === PLACEMENT_TOTAL_ITEMS ? true : Boolean(parsed.nextItem),
      finalOk: sequence === PLACEMENT_TOTAL_ITEMS ? Boolean(parsed.finalResult) : false,
      firstOptionIndex: 0,
    }
    if (sequence < PLACEMENT_TOTAL_ITEMS) {
      if (parsed.status !== 'IN_PROGRESS' || !parsed.nextItem) return stop('full-next-item')
      full.currentItem = parsed.nextItem
    } else {
      if (parsed.status !== 'COMPLETED' && parsed.status !== 'AUTO_SUBMITTED') return stop('full-status')
      if (!parsed.finalResult) return stop('full-report-missing')
      full.final = parsed.finalResult
    }
    full.responses.push(row)
    full.accepted = parsed.acceptedSequence
    full.stateVersion = parsed.stateVersion
  }

  if (!full.final) return stop('full-report-missing')
  if (!(await waitForFullReport(page, full, deadline))) return stop(full.failure || 'full-report')
  if (full.reportVisible !== true || full.reportCard !== true || full.reportComplete !== true) return stop('full-report')
  if (full.reportLevelMatch !== true) return stop('full-report-level')
  if (full.reportScoreMatch !== true) return stop('full-report-score')
  if (full.reportSaved !== true || full.reportPlanError === true) return stop('full-report')
  if (!(await waitForFullEnsure(full, deadline))) return stop(full.failure || 'full-plan-ensure')
  if (full.ensure.status !== 200 || !full.ensure.result) return stop('full-plan-ensure-status')
  if (full.ensure.bodyOk !== true || full.ensure.idempotency !== true) return stop('full-plan-ensure-body')

  if (!(await waitForFullToday(full, deadline, false))) return stop(full.failure || 'full-today')
  const autoToday = full.today.afterEnsure.filter((row) => row.status === 200 && row.parsed)
  const planMatch = autoToday.find((row) => row.planId === full.ensure.result.planId
    && row.planVersion >= full.ensure.result.planVersion)
  if (!planMatch) return stop('full-today-readback')

  if (!(await waitForFullReportEnabled(page, deadline))) return stop('full-today-ui')
  const reportAgain = await readFullReportSurface(page).catch(() => null)
  if (!reportAgain || reportAgain.todayVisible !== true || reportAgain.todayDisabled === true) return stop('full-today-ui')
  full.reportTodayButton = true
  if (reportAgain.planError === true) return stop('full-report')
  if (retestOptIn) {
    if (!(await waitForRetestEnabled(page, deadline))) return stop('full-retest-ui')
    const before = await readRetestSurface(page).catch(() => null)
    if (!before || before.retestVisible !== true || before.retestDisabled === true || before.reportVisible !== true || before.dialogVisible === true) {
      return stop('full-retest-ui')
    }
    await page.locator('#assessment-retest').click()
    const dialog = page.locator('#assessment-retest-confirmation')
    const dialogVisible = await dialog.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    if (!dialogVisible) return stop('full-retest-ui')
    const confirm = page.locator('#assessment-retest-confirm')
    const confirmVisible = await confirm.isVisible().catch(() => false)
    const confirmDisabled = !confirmVisible || await confirm.isDisabled().catch(() => true) || (await confirm.getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (confirmDisabled) return stop('full-retest-ui')
    full.retest.armed = true
    try {
      await confirm.click()
    } catch {
      full.retest.armed = false
      return stop('full-retest-ui')
    }
    full.retest.confirmClicks = 1
    const until = Math.min(deadline, Date.now() + 20000)
    while (full.retest.resolve && !full.failure && Date.now() < until) await fullDelay(50)
    if (full.failure || full.retest.status !== 201 || full.retest.sessionNew !== true || !full.retest.opened) {
      return stop(full.failure || 'full-retest-status')
    }
    const reading = await waitForFullQuestion(page, full.retest.opened, deadline, true)
    if (!reading) return stop('full-retest-question')
    const stable = await readPlacementSurface(page).catch(() => null)
    if (!stable || !fullQuestionMatches(stable, full.retest.opened)) return stop('full-retest-question')
    if (stable.submitVisible !== true || stable.submitDisabled !== true) return stop('full-retest-no-answer')
    if (stable.options.some((option) => option.pressed === true || option.selected === true)) return stop('full-retest-no-answer')
    const after = await readRetestSurface(page).catch(() => null)
    if (!after || after.reportVisible === true) return stop('full-retest-report-still-active')
    full.retest.questionVisible = true
    full.retest.reportScreenLeft = true
    full.retest.submitStillDisabled = true
    full.retest.noChoice = true
    full.retest.firstItem = true
    full.retest.opened = null
    return { met: true, reason: null }
  }
  full.todayUiClickedAt = Date.now()
  try {
    await page.locator('#assessment-today').click()
  } catch {
    return stop('full-today-ui')
  }
  const todayReading = await waitForTodayPage(page, full, deadline)
  if (!todayReading) return stop('full-today-ui')
  if (!(await waitForFullToday(full, deadline, true))) return stop(full.failure || 'full-today-ui')
  const uiToday = full.today.afterUi.filter((row) => row.status === 200 && row.parsed)
  const uiMatch = uiToday.find((row) => row.algorithmVersion === full.today.uiAlgorithmVersion)
  if (!uiMatch) return stop('full-today-ui')
  if (full.today.dueRowsCount !== 3 || full.today.dueRowsMatch !== true
    || full.today.falseEmptyVisible === true || full.today.dueRowsReadOnly !== true) {
    return stop('full-today-ui')
  }
  if (!full.home.statuses.length || full.home.statuses.some((status) => status !== 200)) return stop('full-home')
  if (!full.catalog.statuses.length || full.catalog.statuses.some((status) => status !== 200)) return stop('full-catalog')
  return { met: true, reason: null }
}

function validatePlacementResponseBody(raw, expected) {
  const body = jsonObject(raw)
  if (!body) return { ok: false, reason: 'full-response-body' }
  const keys = Object.keys(body)
  const exact = ['expectedStateVersion', 'itemId', 'itemSequence', 'candidateResponse', 'responseDigest', 'timeSpentSec']
  if (keys.length !== exact.length || exact.some((key) => !Object.prototype.hasOwnProperty.call(body, key))) {
    return { ok: false, reason: 'full-response-body' }
  }
  if (body.expectedStateVersion !== expected.stateVersion) return { ok: false, reason: 'full-response-version' }
  if (body.itemId !== expected.itemId) return { ok: false, reason: 'full-response-item' }
  if (body.itemSequence !== expected.sequence) return { ok: false, reason: 'full-response-sequence' }
  if (!sha256Hex(body.responseDigest)) return { ok: false, reason: 'full-response-body' }
  const digestMaterial = JSON.stringify([expected.sessionId, body.itemId, body.itemSequence, { responseType: 'CHOICE', selectedOptionIds: [expected.optionKey] }])
  const expectedDigest = crypto.createHash('sha256').update(digestMaterial).digest('hex')
  if (body.responseDigest !== expectedDigest) return { ok: false, reason: 'full-response-digest' }
  if (!Number.isSafeInteger(body.timeSpentSec) || body.timeSpentSec < 0 || body.timeSpentSec > 3600) {
    return { ok: false, reason: 'full-response-body' }
  }
  const candidate = body.candidateResponse
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return { ok: false, reason: 'full-response-body' }
  const candidateKeys = Object.keys(candidate)
  if (candidateKeys.length !== 2 || candidateKeys.some((key) => key !== 'responseType' && key !== 'selectedOptionIds')) {
    return { ok: false, reason: 'full-response-body' }
  }
  if (candidate.responseType !== 'CHOICE') return { ok: false, reason: 'full-response-body' }
  if (!Array.isArray(candidate.selectedOptionIds) || candidate.selectedOptionIds.length !== 1) {
    return { ok: false, reason: 'full-response-body' }
  }
  if (candidate.selectedOptionIds[0] !== expected.optionKey) return { ok: false, reason: 'full-response-option' }
  return { ok: true, reason: null }
}

function planEnsureBodyMatches(raw, reportId) {
  const body = jsonObject(raw)
  if (!body || typeof reportId !== 'string' || reportId.length === 0) return false
  const keys = Object.keys(body)
  return keys.length === 1 && keys[0] === 'placementReportId' && body.placementReportId === reportId
}

async function runTargetBrowser({ identifier, password, caPem, outDir, placement = false, placementArtifact, placementIndexSha, full = false, fullArtifact, fullIndexSha, retestContinuation = false }) {
  const placementRequested = placement === true
  const fullOptIn = full === true
  const retestOptIn = retestContinuation === true
  const placementOptIn = placementRequested || fullOptIn
  const fullRoot = fullOptIn ? fullArtifactPath(fullArtifact) : null
  const requestedFullSha = fullOptIn ? fullIndexShaValue(fullIndexSha) : null
  const artifact = fullOptIn ? (fullRoot || '') : (placementRequested ? PLACEMENT_ARTIFACT : TARGET_ARTIFACT)
  const expectedIndexSha = fullOptIn ? requestedFullSha : (placementRequested ? PLACEMENT_INDEX_SHA : TARGET_INDEX_SHA)
  const indexFile = artifact ? path.join(artifact, 'index.html') : null
  const indexSha256 = indexFile && fs.existsSync(indexFile) ? shaFile(indexFile) : null
  const base = {
    launched: false,
    indexSha256,
    expectedIndexSha256: expectedIndexSha,
    indexMatch: indexSha256 === expectedIndexSha,
    spkiSha256: null,
    ignoreHTTPSErrors: false,
    persistentProfile: false,
    serviceWorkers: 'block',
    requests: [],
    expectations: null,
    caveat: retestOptIn ? RETEST_CAVEAT : (fullOptIn ? FULL_CAVEAT : (placementRequested ? PLACEMENT_CAVEAT : TARGET_CAVEAT)),
    ...(fullOptIn ? { fullOptIn: true, placementOptIn: true } : (placementRequested ? { placementOptIn: true } : {})),
  }
  if (!usableOutDir(outDir)) return { ...base, status: 'FAILED', reason: 'out-dir-missing' }
  if (placement !== undefined && placement !== false && placement !== true) {
    return { ...base, status: 'FAILED', reason: 'placement-option-invalid' }
  }
  if (full !== undefined && full !== false && full !== true) {
    return { ...base, status: 'FAILED', reason: 'full-option-invalid' }
  }
  if (retestContinuation !== false && retestContinuation !== true) return { ...base, status: 'FAILED', reason: 'retest-option-invalid' }
  if (retestOptIn && !fullOptIn) return { ...base, status: 'FAILED', reason: 'retest-requires-full' }
  if (fullOptIn && !fullRoot) return { ...base, status: 'FAILED', reason: 'full-artifact-missing' }
  if (fullOptIn && !requestedFullSha) return { ...base, status: 'FAILED', reason: 'full-index-sha-invalid' }
  if (!fullOptIn && placementOptIn && (placementArtifact != null || placementIndexSha != null)
    && (placementArtifact !== PLACEMENT_ARTIFACT || placementIndexSha !== PLACEMENT_INDEX_SHA)) {
    return { ...base, status: 'FAILED', reason: 'placement-artifact-mismatch' }
  }
  if (!base.indexMatch) return { ...base, status: 'FAILED', reason: fullOptIn ? 'full-index-sha-mismatch' : 'index-sha-mismatch' }
  let spki = null
  try { spki = certificateSpkiHash(caPem) } catch { return { ...base, status: 'FAILED', reason: 'spki-unavailable' } }
  base.spkiSha256 = spki

  let chromium
  try {
    ;({ chromium } = createRequire(PLAYWRIGHT_ROOT)('playwright'))
  } catch {
    return { ...base, status: 'FAILED', reason: 'playwright-unavailable' }
  }

  const deadline = Date.now() + (fullOptIn ? FULL_DEADLINE_MS : (placementRequested ? PLACEMENT_DEADLINE_MS : TARGET_DEADLINE_MS))
  const traffic = []
  let order = 0
  let staticFulfills = 0
  let staticDiagnostics = 0
  const obs = {
    goalStep: false,
    cetSelected: false,
    quotaSelected: false,
    saveClicks: 0,
    putContinued: 0,
    putBodyMatch: false,
    idempotencyPresent: false,
    readbackMatched: false,
    readbackAt: null,
    readbackPending: 0,
    savedUiAt: null,
    savedBefore: false,
    savedVisible: false,
    savedSurface: 'none',
    placementAssessmentRoute: false,
    placementGuideVisible: false,
    placementStartSelectorConfirmed: false,
    placementStartActivated: false,
    placementStartAt: null,
    placementStartPresses: 0,
    placementStartFocused: false,
    placementQuestionVisible: false,
    placementPostCount: 0,
    placementPostStatus: null,
    placementPostAt: null,
    placementPostBodyEmpty: false,
    placementPostBodyKind: null,
    placementPostIdempotency: false,
    placementPostAfterStart: false,
    placementContentVersionId: false,
    placementFirstItem: false,
    placementTotalItems: false,
    placementOwnerSession: false,
    placementAcceptedSequence: null,
    placementNextSequence: null,
    placementStemMatch: false,
    placementOptionsMatch: false,
    placementOptionCount: 0,
    placementNoChoiceSelected: false,
    placementQuestionNow: null,
    placementQuestionTotal: null,
    placementQuestionCountMatch: false,
    placementProgressNow: null,
    placementProgressMax: null,
    placementProgressAcceptedMatch: false,
    placementProgressTextPresent: false,
    placementSubmitVisible: false,
    placementSubmitDisabled: false,
    placementReadCount: 0,
    placementReadAt: null,
    placementReadAfterPost: false,
    foreignOriginAttempts: 0,
    staticFulfills: 0,
  }
  const note = (method, requestPath, outcome) => {
    if (traffic.length >= (fullOptIn ? 260 : 160)) return null
    const safePath = sanitizePlacementPath(requestPath)
    if (!safePath) return null
    const row = {
      order: ++order,
      method,
      path: safePath,
      query: safeQueryLabel(outcome.query),
      status: outcome.status ?? null,
      type: outcome.type,
      disposition: outcome.disposition,
      reason: outcome.reason || null,
    }
    traffic.push(row)
    return row
  }
  const noteStatic = (method, requestPath, outcome) => {
    if (staticDiagnostics >= 8) return
    staticDiagnostics += 1
    note(method, requestPath, outcome)
  }
  const pending = new Map()
  const placementState = placementOptIn ? { sessionId: null, session: null, postSettled: null, resolvePost: null } : null
  if (placementState) {
    placementState.postSettled = new Promise((resolve) => { placementState.resolvePost = resolve })
  }
  const fullState = fullOptIn ? {
    sessionId: null,
    accepted: null,
    stateVersion: null,
    currentItem: null,
    final: null,
    responses: [],
    armed: null,
    pending: null,
    inFlight: null,
    ensure: { requested: 0, status: null, bodyOk: false, idempotency: false, result: null, requestAt: null, settledAt: null, settled: null, resolve: null },
    today: { afterEnsure: [], afterUi: [], uiVisible: false, uiVisual: true, uiAlgorithmVersion: null, dueRowsCount: 0, dueRowsMatch: false, falseEmptyVisible: false, dueRowsReadOnly: false },
    home: { requested: 0, statuses: [] },
    catalog: { requested: 0, statuses: [] },
    reportVisible: false,
    reportCard: false,
    reportComplete: false,
    reportLevelMatch: false,
    reportScoreMatch: false,
    reportSaved: false,
    reportPlanError: false,
    reportTodayButton: false,
    todayUiClickedAt: null,
    ui: { submitClicks: 0 },
    failure: null,
    ...(retestOptIn ? {
      retest: {
        requested: 0, status: null, bodyEmpty: false, idempotency: false, authorized: false,
        sessionNew: false, questionVisible: false, reportScreenLeft: false, confirmClicks: 0,
        submitStillDisabled: false, noChoice: false, firstItem: false, readCount: 0,
        armed: false, opened: null, sessionId: null, settled: null, resolve: null,
      },
    } : {}),
  } : null
  if (fullState) makeFullEnsure(fullState)
  if (retestOptIn && fullState) {
    let resolveRetest
    fullState.retest.settled = new Promise((done) => { resolveRetest = done })
    fullState.retest.resolve = resolveRetest
  }
  const settlePlacementPost = () => {
    if (!placementState || !placementState.resolvePost) return
    const resolve = placementState.resolvePost
    placementState.resolvePost = null
    resolve()
  }
  let browser = null
  let staticServer = null
  let staticMarker = ''
  const finish = (status, reason) => {
    obs.staticFulfills = staticFulfills
    const summary = summarizeTarget(traffic, obs, placementOptIn, fullOptIn, retestOptIn)
    const placementSummary = placementOptIn && !fullOptIn ? summarizePlacement(traffic, obs) : null
    const fullSummary = fullOptIn ? summarizeFull(traffic, obs, fullState, retestOptIn) : null
    const met = summary.met && (fullOptIn ? Boolean(fullSummary && fullSummary.met) : (!placementOptIn || Boolean(placementSummary && placementSummary.met)))
    let finalReason = met ? null : reason
    if (!met && !finalReason && fullSummary && !fullSummary.met) finalReason = fullSummary.reason
    if (!met && !finalReason && placementSummary && !placementSummary.met) finalReason = placementSummary.reason
    if (!met && !finalReason) finalReason = 'expectations-unmet'
    return {
      ...base,
      status: met ? 'OBSERVED' : (status === 'OBSERVED' ? 'FAILED' : status),
      reason: finalReason,
      requests: traffic,
      expectations: fullOptIn
        ? { ...summary.expectations, full: fullSummary.expectations }
        : (placementOptIn ? { ...summary.expectations, placement: placementSummary.expectations } : summary.expectations),
    }
  }
  try {
    if (!staticEndpointRegistered()) return finish('FAILED', 'static-port-not-registered')
    staticMarker = crypto.randomBytes(32).toString('hex')
    try {
      staticServer = await listenFrozenStatic(staticMarker, artifact)
    } catch (error) {
      const reason = error && error.code === 'EADDRINUSE' ? 'static-port-busy' : 'static-listen-failed'
      return finish('FAILED', reason)
    }
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${spki}`],
    })
    base.launched = true
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      serviceWorkers: 'block',
    })
    context.setDefaultTimeout(20000)
    const page = await context.newPage()
    await watchAllowlistedLoadFailures(page, traffic, (url, method) => targetContinued(url, method, placementOptIn, fullOptIn, retestOptIn))
    page.on('response', (response) => {
      let parsed
      try { parsed = new URL(response.url()) } catch { return }
      const method = response.request().method()
      if (parsed.origin === PAGE_ORIGIN) {
        if (method !== 'GET' && method !== 'HEAD') return
        if (response.status() === 200) {
          staticFulfills += 1
          obs.staticFulfills = staticFulfills
        } else if (response.status() > 0) {
          noteStatic(method, parsed.pathname, { status: response.status(), type: 'h5-static', disposition: 'continue', reason: 'missing-asset', query: 'none' })
        }
        return
      }
      const queue = pending.get(`${method} ${parsed.pathname}`)
      const row = queue && queue.shift()
      if (row) {
        row.status = response.status()
        if (isDiagnosticReason(row.reason)) row.reason = null
      }
      if (placementOptIn && method === 'POST' && parsed.pathname === PLACEMENT_CREATE_PATH) {
        obs.placementPostStatus = response.status()
        void (async () => {
          let session = null
          try { session = parsePlacementSession(await response.text()) } catch { session = null }
          if (session) {
            placementState.sessionId = session.sessionId
            placementState.session = session
            obs.placementContentVersionId = session.contentVersionId === PLACEMENT_CONTENT_VERSION_ID
            obs.placementFirstItem = session.itemId === PLACEMENT_FIRST_ITEM_ID
            obs.placementTotalItems = session.totalItemCount === PLACEMENT_TOTAL_ITEMS
            obs.placementOwnerSession = true
            obs.placementAcceptedSequence = session.acceptedSequence
            obs.placementNextSequence = session.nextSequence
          }
          settlePlacementPost()
        })()
      }
      if (fullOptIn && method === 'POST' && placementResponseSessionId(parsed.pathname)) {
        const inFlight = fullState.inFlight
        fullState.inFlight = null
        const status = response.status()
        void watchFullObservation(fullState, async () => {
          let receipt = null
          if (status === 200) {
            try { receipt = parsePlacementReceipt(await response.text(), fullState.sessionId) } catch { receipt = null }
          }
          settleFullPending(fullState, { status, receipt, check: inFlight ? inFlight.check : null })
        })
      }
      if (fullOptIn && method === 'POST' && parsed.pathname === PLAN_ENSURE_PATH) {
        fullState.ensure.status = response.status()
        void watchFullObservation(fullState, async () => {
          let result = null
          if (response.status() === 200) {
            try { result = parsePlanEnsure(await response.text()) } catch { result = null }
          }
          fullState.ensure.result = result
          fullState.ensure.settledAt = Date.now()
          settleFullEnsure(fullState)
        })
      }
      if (retestOptIn && method === 'POST' && placementRetestSessionId(parsed.pathname)) {
        const status = response.status()
        fullState.retest.status = status
        void watchFullObservation(fullState, async () => {
          let session = null
          let created = false
          if (status === 201) {
            try {
              const raw = await response.text()
              session = parsePlacementSession(raw)
              const envelope = placementJson(raw)
              let data = envelope ? unwrapData(envelope) : null
              if (data && data.data && typeof data.data === 'object' && !Array.isArray(data.data) && !data.sessionId) data = unwrapData(data)
              created = Boolean(data && data.status === 'CREATED')
            } catch {
              session = null
              created = false
            }
          }
          const completed = placementState.sessionId
          const distinct = Boolean(session && completed && session.sessionId !== completed)
          const fresh = Boolean(created && session && distinct
            && session.acceptedSequence === 0 && session.nextSequence === 1 && session.stateVersion === 1
            && session.contentVersionId === PLACEMENT_CONTENT_VERSION_ID
            && session.itemId === PLACEMENT_FIRST_ITEM_ID && session.totalItemCount === PLACEMENT_TOTAL_ITEMS
            && typeof session.stem === 'string' && Array.isArray(session.options) && session.options.length > 0)
          fullState.retest.sessionNew = fresh
          if (fresh) {
            fullState.retest.sessionId = session.sessionId
            fullState.retest.opened = { itemId: session.itemId, stem: session.stem, options: session.options }
          }
          settleFullRetest(fullState)
        })
      }
      if (fullOptIn && method === 'GET' && parsed.pathname === TODAY_PLAN_PATH) {
        const meta = row && row.fullToday ? row.fullToday : null
        void watchFullObservation(fullState, async () => {
          let parsed = null
          if (response.status() === 200) {
            try { parsed = parseTodayReadback(await response.text()) } catch { parsed = null }
          }
          const today = {
            status: response.status(),
            parsed: Boolean(parsed),
            planId: parsed ? parsed.planId : null,
            planVersion: parsed ? parsed.planVersion : null,
            algorithmVersion: parsed ? parsed.algorithmVersion : null,
            dueItemIds: parsed && Array.isArray(parsed.dueItemIds) ? parsed.dueItemIds.slice() : null,
            at: Date.now(),
          }
          if (meta && meta.afterEnsure) fullState.today.afterEnsure.push(today)
          if (meta && meta.afterUi) fullState.today.afterUi.push(today)
        })
      }
      if (fullOptIn && method === 'GET' && parsed.pathname === LEARNER_HOME_PATH) fullState.home.statuses.push(response.status())
      if (fullOptIn && method === 'GET' && parsed.pathname === CONTENT_CATALOG_PATH) fullState.catalog.statuses.push(response.status())
      if (method === 'GET' && parsed.pathname === TARGET_PUT_PATH && response.status() === 200 && obs.putContinued > 0) {
        const seenAt = Date.now()
        obs.readbackPending += 1
        void (async () => {
          let matched = false
          try {
            const body = await response.text()
            matched = targetReadbackMatches(jsonObject(body))
          } catch { matched = false } finally {
            obs.readbackPending = Math.max(0, obs.readbackPending - 1)
          }
          if (!matched) return
          if (obs.readbackAt == null || seenAt < obs.readbackAt) obs.readbackAt = seenAt
          obs.readbackMatched = true
          if (obs.savedUiAt != null) obs.savedBefore = obs.savedUiAt < obs.readbackAt
        })()
      }
    })
    page.on('requestfailed', (request) => {
      let parsed
      try { parsed = new URL(request.url()) } catch { return }
      const method = request.method()
      if (parsed.origin === PAGE_ORIGIN) {
        if (method !== 'GET' && method !== 'HEAD') return
        const failure = request.failure()
        const netError = sanitizedNetError(failure && failure.errorText)
        noteStatic(method, parsed.pathname, {
          status: null, type: 'h5-static', disposition: 'continue', reason: netError || safeFailure(failure), query: 'none',
        })
        return
      }
      const queue = pending.get(`${method} ${parsed.pathname}`)
      const row = queue && queue.shift()
      if (placementOptIn && method === 'POST' && parsed.pathname === PLACEMENT_CREATE_PATH) {
        obs.placementPostStatus = null
        settlePlacementPost()
      }
      if (fullOptIn && method === 'POST' && placementResponseSessionId(parsed.pathname)) {
        fullState.inFlight = null
        failFull(fullState, 'full-response-failed')
      }
      if (fullOptIn && method === 'POST' && parsed.pathname === PLAN_ENSURE_PATH) {
        fullState.ensure.status = null
        fullState.ensure.settledAt = Date.now()
        failFull(fullState, 'full-plan-ensure-failed')
      }
      if (retestOptIn && method === 'POST' && placementRetestSessionId(parsed.pathname)) {
        fullState.retest.status = null
        failFull(fullState, 'full-retest-failed')
      }
      if (!row || row.status != null) return
      const failure = request.failure()
      const netError = sanitizedNetError(failure && failure.errorText)
      row.reason = mergeDiagnostic(row.reason, { netError, stable: netError ? null : safeFailure(failure) })
    })
    await context.route('**/*', async (route) => {
      const request = route.request()
      let url
      try { url = new URL(request.url()) } catch { await route.abort(); return }
      const method = request.method()
      if (url.origin !== PAGE_ORIGIN && url.origin !== IAM_ORIGIN && url.origin !== GATEWAY_ORIGIN) obs.foreignOriginAttempts += 1
      const decision = classifyTarget(url, method, placementOptIn, fullOptIn, retestOptIn)
      try {
        if (decision.action === 'artifact') {
          if (method !== 'GET' && method !== 'HEAD') {
            await route.abort()
            note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'non-get-static', query: decision.query })
            return
          }
          const headers = { ...request.headers(), [STATIC_QA_HEADER]: staticMarker }
          await route.continue({ headers })
          return
        }
        if (decision.action === 'continue') {
          if (placementOptIn && decision.type === 'gateway-placement-create' && method === 'POST') {
            if (!obs.placementStartActivated) {
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'placement-post-before-start', query: decision.query })
              return
            }
            if (obs.placementPostCount >= 1) {
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'duplicate-placement-post', query: decision.query })
              return
            }
            let bodyText = ''
            try {
              const body = request.postData()
              bodyText = typeof body === 'string' ? body : ''
            } catch { bodyText = '' }
            obs.placementPostCount = 1
            obs.placementPostAt = Date.now()
            obs.placementPostBodyKind = bodyText === '' ? 'zero-length' : (bodyText === '{}' ? 'empty-object' : 'nonempty')
            obs.placementPostBodyEmpty = bodyText === '' || bodyText === '{}'
            obs.placementPostIdempotency = idempotencyPresent(request)
          }
          if (fullOptIn && decision.type === 'gateway-placement-response' && method === 'POST') {
            const sessionId = placementResponseSessionId(url.pathname)
            if (!sessionId || !placementState.sessionId || sessionId !== placementState.sessionId) {
              failFull(fullState, 'full-session-not-owned')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-session-not-owned', query: decision.query })
              return
            }
            if (!hasAuthorization(request)) {
              failFull(fullState, 'missing-authorization')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'missing-authorization', query: decision.query })
              return
            }
            const armed = fullState.armed
            if (!armed) {
              failFull(fullState, 'full-response-before-ui')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-response-before-ui', query: decision.query })
              return
            }
            if (armed.sequence !== (fullState.accepted ?? 0) + 1) {
              failFull(fullState, 'full-response-sequence')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-response-sequence', query: decision.query })
              return
            }
            if (fullState.responses.length >= PLACEMENT_TOTAL_ITEMS || fullState.inFlight) {
              failFull(fullState, 'full-duplicate-response')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-duplicate-response', query: decision.query })
              return
            }
            const check = validatePlacementResponseBody(request.postData(), armed)
            if (!check.ok) {
              failFull(fullState, check.reason)
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: check.reason, query: decision.query })
              return
            }
            if (!idempotencyPresent(request)) {
              failFull(fullState, 'full-response-body')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-response-body', query: decision.query })
              return
            }
            fullState.inFlight = { sequence: armed.sequence, check: { bodyOk: true, itemOk: true, idempotency: true } }
            fullState.armed = null
          }
          if (fullOptIn && decision.type === 'gateway-plan-ensure' && method === 'POST') {
            if (!hasAuthorization(request)) {
              failFull(fullState, 'missing-authorization')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'missing-authorization', query: decision.query })
              return
            }
            const until = Math.min(deadline, Date.now() + 10000)
            while (!fullState.final && !fullState.failure && Date.now() < until) await fullDelay(25)
            if (!fullState.final || fullState.responses.length !== PLACEMENT_TOTAL_ITEMS) {
              failFull(fullState, 'full-plan-ensure-before-report')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-plan-ensure-before-report', query: decision.query })
              return
            }
            if (fullState.ensure.requested >= 1) {
              failFull(fullState, 'full-duplicate-plan-ensure')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-duplicate-plan-ensure', query: decision.query })
              return
            }
            if (!planEnsureBodyMatches(request.postData(), fullState.final.reportId) || !idempotencyPresent(request)) {
              failFull(fullState, 'full-plan-ensure-body')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-plan-ensure-body', query: decision.query })
              return
            }
            fullState.ensure.requested = 1
            fullState.ensure.requestAt = Date.now()
            fullState.ensure.bodyOk = true
            fullState.ensure.idempotency = true
          }
          if (retestOptIn && decision.type === 'gateway-placement-retest' && method === 'POST') {
            const sessionId = placementRetestSessionId(url.pathname)
            if (!hasAuthorization(request)) {
              failFull(fullState, 'missing-authorization')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'missing-authorization', query: decision.query })
              return
            }
            if (!sessionId || !placementState.sessionId || sessionId !== placementState.sessionId
              || !fullState.final || fullState.responses.length !== PLACEMENT_TOTAL_ITEMS
              || fullState.ensure.requested !== 1) {
              failFull(fullState, 'full-retest-before-report')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-before-report', query: decision.query })
              return
            }
            if (!fullState.retest.armed) {
              failFull(fullState, 'full-retest-before-ui')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-before-ui', query: decision.query })
              return
            }
            if (fullState.retest.requested >= 1) {
              failFull(fullState, 'full-retest-duplicate')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-duplicate', query: decision.query })
              return
            }
            let bodyText = ''
            try {
              const body = request.postData()
              bodyText = typeof body === 'string' ? body : ''
            } catch { bodyText = '' }
            if (!((bodyText === '' || bodyText === '{}') && idempotencyPresent(request))) {
              failFull(fullState, 'full-retest-body')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-body', query: decision.query })
              return
            }
            fullState.retest.requested = 1
            fullState.retest.bodyEmpty = true
            fullState.retest.idempotency = true
            fullState.retest.authorized = true
            fullState.retest.armed = false
          }
          if (fullOptIn && (decision.type === 'gateway-learner-home' || decision.type === 'gateway-content-catalog')) {
            if (fullState.todayUiClickedAt == null) {
              failFull(fullState, 'full-home-before-ui')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-home-before-ui', query: decision.query })
              return
            }
            if (method === 'GET') {
              const target = decision.type === 'gateway-learner-home' ? fullState.home : fullState.catalog
              if (target.requested >= 1) {
                failFull(fullState, 'full-home-duplicate')
                await route.abort()
                note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-home-duplicate', query: decision.query })
                return
              }
              target.requested += 1
            }
          }
          if (placementOptIn && decision.type === 'gateway-placement-read') {
            const sessionId = placementSessionIdFromPath(url.pathname)
            const gateUntil = Date.now() + 5000
            while (!placementState.sessionId && Date.now() < gateUntil) {
              await new Promise((resolve) => setTimeout(resolve, 25))
            }
            const retestSessionId = retestOptIn && fullState && fullState.retest ? fullState.retest.sessionId : null
            const ownedCompleted = Boolean(sessionId && placementState.sessionId && sessionId === placementState.sessionId)
            const ownedRetest = Boolean(sessionId && retestSessionId && sessionId === retestSessionId)
            if (!ownedCompleted && !ownedRetest) {
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'placement-session-not-owned', query: decision.query })
              return
            }
            if (method === 'GET') {
              if (ownedRetest) {
                if (fullState.retest.readCount >= 1) {
                  await route.abort()
                  note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'duplicate-placement-read', query: decision.query })
                  return
                }
                fullState.retest.readCount = 1
              } else {
                if (obs.placementReadCount >= 1) {
                  await route.abort()
                  note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'duplicate-placement-read', query: decision.query })
                  return
                }
                obs.placementReadCount = 1
                obs.placementReadAt = Date.now()
                obs.placementReadAfterPost = obs.placementPostAt != null && obs.placementReadAt >= obs.placementPostAt
              }
            }
          }
          const needsAuth = method === 'GET' || method === 'PUT'
            || (placementOptIn && decision.type === 'gateway-placement-create' && method === 'POST')
            || (fullOptIn && decision.type === 'gateway-placement-response' && method === 'POST')
            || (fullOptIn && decision.type === 'gateway-plan-ensure' && method === 'POST')
            || (retestOptIn && decision.type === 'gateway-placement-retest' && method === 'POST')
          if (needsAuth && !hasAuthorization(request)) {
            await route.abort()
            note(method, url.pathname, {
              status: null, type: decision.type, disposition: 'abort', reason: 'missing-authorization', query: decision.query,
            })
            return
          }
          if (decision.type === 'gateway-target-put') {
            let bodyMatch = false
            let keyPresent = false
            try {
              bodyMatch = targetPutMatches(jsonObject(request.postData()))
              keyPresent = idempotencyPresent(request)
            } catch { bodyMatch = false; keyPresent = false }
            obs.putContinued += 1
            if (obs.putContinued === 1) {
              obs.putBodyMatch = bodyMatch
              obs.idempotencyPresent = keyPresent
            } else {
              obs.putBodyMatch = false
              obs.idempotencyPresent = false
            }
          }
          const row = note(method, url.pathname, { status: null, type: decision.type, disposition: 'continue', reason: null, query: decision.query })
          if (row && fullOptIn && decision.type === 'gateway-today-plan' && method === 'GET') {
            row.fullToday = {
              afterEnsure: fullState.ensure.requestAt != null,
              afterUi: fullState.todayUiClickedAt != null,
            }
          }
          if (row) {
            const queueKey = `${method} ${url.pathname}`
            const queue = pending.get(queueKey) || []
            queue.push(row)
            pending.set(queueKey, queue)
          }
          await route.continue()
          return
        }
        await route.abort()
        note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: decision.reason, query: decision.query })
      } catch {
        note(method, url.pathname, { status: null, type: decision.type || 'unexpected', disposition: 'abort', reason: 'route-handler-failed', query: decision.query })
        try { await route.abort() } catch { /* already settled */ }
      }
    })

    if (Date.now() > deadline) return finish('FAILED', 'deadline')
    await page.goto(`${PAGE_ORIGIN}/#/pages/login/login?returnTo=${encodeURIComponent(TARGET_RETURN_TO)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await fillLogin(page, identifier, password)
    const leftLogin = await page.waitForFunction(() => !location.hash.includes('/pages/login/login'), null, { timeout: 20000 }).then(() => true).catch(() => false)
    if (!leftLogin) return finish('FAILED', 'still-on-login')
    const goalChoice = page.locator('.onboarding-choice[data-goal-code="COLLEGE_CET"]').first()
    const goalVisible = await goalChoice.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)
    const title = goalVisible ? await page.locator('#mobile-onboarding-title').innerText().catch(() => '') : ''
    obs.goalStep = goalVisible && title.includes('你想先达成什么')
    if (!obs.goalStep) return finish('FAILED', 'not-goal-step')
    if (await postSaveSurface(page) !== 'none') {
      obs.savedBefore = true
      obs.savedUiAt = Date.now()
      return finish('FAILED', 'saved-ui-before-save')
    }
    await goalChoice.click()
    obs.cetSelected = await controlSelected(goalChoice)
    if (!obs.cetSelected) return finish('FAILED', 'goal-not-selected')
    const quotas = page.locator('.onboarding-quota')
    const quotaCount = await quotas.count()
    let quota = null
    for (let index = 0; index < quotaCount; index += 1) {
      const label = (await quotas.nth(index).innerText().catch(() => '')).replace(/\s+/g, '')
      if (label === '30分钟') { quota = quotas.nth(index); break }
    }
    if (!quota) return finish('FAILED', 'quota-not-selected')
    await quota.click()
    obs.quotaSelected = await controlSelected(quota)
    if (!obs.quotaSelected) return finish('FAILED', 'quota-not-selected')
    const save = page.locator('.onboarding-primary').filter({ hasText: '保存并继续' }).first()
    const saveReady = await save.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
    const saveDisabled = !saveReady || await save.isDisabled().catch(() => true) || (await save.getAttribute('aria-disabled').catch(() => null)) === 'true'
    if (saveDisabled) return finish('FAILED', 'save-not-clicked')
    await save.click()
    obs.saveClicks = 1
    const until = Math.min(deadline, Date.now() + 30000)
    while (Date.now() < until) {
      if (!obs.savedUiAt && await postSaveSurface(page) !== 'none') obs.savedUiAt = Date.now()
      if (obs.savedUiAt != null && !obs.readbackMatched && obs.readbackPending === 0) obs.savedBefore = true
      if (obs.readbackMatched && obs.savedUiAt != null && obs.savedBefore !== true) break
      if (obs.savedBefore) break
      await page.waitForTimeout(150)
    }
    const drainUntil = Math.min(deadline, Date.now() + 2000)
    while (obs.readbackPending > 0 && Date.now() < drainUntil) await page.waitForTimeout(50)
    obs.savedSurface = await postSaveSurface(page)
    obs.savedVisible = obs.savedSurface === 'summary' || obs.savedSurface === 'assessment'
    if (obs.savedVisible && obs.savedUiAt == null) obs.savedUiAt = Date.now()
    if (obs.savedUiAt != null && obs.readbackAt != null && obs.savedUiAt < obs.readbackAt) obs.savedBefore = true
    if (obs.savedVisible && !obs.readbackMatched && obs.readbackPending === 0) obs.savedBefore = true
    const targetSummary = summarizeTarget(traffic, obs, placementOptIn, fullOptIn, retestOptIn)
    if (!targetSummary.met) {
      if (Date.now() > deadline) return finish('FAILED', 'deadline')
      return finish('FAILED', 'expectations-unmet')
    }
    if (fullOptIn) {
      const placement = await runPlacementStage(page, obs, placementState, deadline)
      if (!placement.met) return finish('FAILED', placement.reason)
      const fullResult = await runFullPlacementStage(page, obs, placementState, fullState, deadline, retestOptIn)
      if (!fullResult.met) return finish('FAILED', fullResult.reason)
      return finish('OBSERVED', null)
    }
    if (placementOptIn) {
      const placement = await runPlacementStage(page, obs, placementState, deadline)
      if (!placement.met) return finish('FAILED', placement.reason)
      return finish('FAILED', null)
    }
    return finish('OBSERVED', null)
  } catch (error) {
    return finish(Date.now() > deadline ? 'FAILED' : 'FAILED', Date.now() > deadline ? 'deadline' : safeFailure(error))
  } finally {
    if (browser) await browser.close().catch(() => {})
    browser = null
    if (staticServer) await closeOwnedServer(staticServer).catch(() => {})
    staticServer = null
    staticMarker = ''
  }
}

if (require.main === module) {
  process.stdout.write('browser-target-probe.cjs is invoked in memory. runConsentBrowserSmoke and runTargetBrowser do not read credentials from argv or the environment, and this file does not launch a browser or listen by itself.\n')
}

module.exports = { runConsentBrowserSmoke, runTargetBrowser }
