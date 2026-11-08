/**
 * MB-033 external learner-goal owner probe: real HTTP through the B72 Gateway.
 *
 * The caller passes the B72 refreshed IAM access token as an ordinary in-memory
 * parameter. It is never exported, written to an artifact, put in argv, or put
 * in the Learner JVM environment. The probe starts one owned Learner JVM on the
 * exact fixed loopback port 18088 under the exact startup opt-in, and always
 * stops it in try/finally. It writes no raw token, principal id, idempotency
 * key, password, or service-client secret to any output.
 *
 * The proof is deliberately scoped to the learner target owner path:
 *   GET  /learner/profile
 *   GET  /learner/targets
 *   GET  /learner/preferences
 *   PUT  /learner/targets         (one synthetic goal, exact prior version)
 *   PUT  /learner/targets         (same key/body only after a 200, replay only)
 *   GET  /learner/targets         (owner readback)
 *   GET  /learner/profile         (owner readback)
 *   GET  /learner/preferences     (unchanged-value readback)
 *
 * No Learning plan mutation, consent seed, target seed, policy bypass, or
 * unrelated write is performed.
 *
 * Optional MB-004 browser mode (options.browser === true) keeps the same owned
 * Learner JVM and the same profile/target/preferences pre-read, but performs no
 * programmatic PUT. It calls the root-supplied browser module in-process while
 * the Learner JVM is up, then uses the original B72 refreshed actor token for
 * the real GET readbacks. Browser/Chrome cleanup belongs to that module and the
 * root wrapper.
 *
 * Optional MB-006 placement browser mode (options.placementBrowser === true)
 * requires that browser mode. After the eligible-actor pre-read, and before
 * Chrome, it starts owned Content and Assessment through placement-start-read.
 * The same in-memory closure then calls runTargetBrowser with placement:true.
 * This probe does not POST placement and does not seed a target.
 *
 * Optional MB-006 full browser mode (MB006_PLACEMENT_FULL_BROWSER exact token)
 * requires that placement browser mode. It starts Content, Assessment, and
 * Learning through withFullBrowserServices and calls runTargetBrowser with
 * only the proven full, fullArtifact, and fullIndexSha. It does not POST a
 * target, placement, answer, or plan.
 */
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

const GATEWAY = 'http://127.0.0.1:18070/api/v1'
const ORIGIN = 'http://127.0.0.1:18183'
const PORT = 18088
const REQUEST_TIMEOUT_MS = 12_000
const MAX_RESPONSE_BYTES = 1_048_576
const MAX_REQUESTS = 10
const ROOT_ARTIFACT_DIR = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/learner-target-33-root'
const BROWSER_ROOT_ARTIFACT_DIR = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/learner-target-browser-34-root'
// Root rebinds this one literal artifact run path.
export const PLACEMENT_BROWSER_ROOT_ARTIFACT_DIR = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/mb006-placement-browser-77-root'
const FULL_BROWSER_ROOT_ARTIFACT_DIR = '/private/tmp/grok-mobile-resume-home-return-464/run'
const RETEST_CONTINUATION_OPT_IN = 'MB006_PLACEMENT_RETEST_CONTINUATION'
const RETEST_CONTINUATION_ROOT = '/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run'
const PLACEMENT_ARTIFACT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/app-plus-compiler-36-root/h5'
const PLACEMENT_INDEX_SHA = '983d33d4c7bb6ae8a9586970790d906f795ebc4cfe640c0c18166cac3837de73'
const OPT_IN = 'YES_RUN_MB033_LEARNER_TARGET_PROBE'
const BROWSER_OPT_IN = 'YES_LOCAL_H5_TARGET_SMOKE'
const PLACEMENT_BROWSER_OPT_IN = 'MB006_PLACEMENT_BROWSER'
const FULL_BROWSER_OPT_IN = 'MB006_PLACEMENT_FULL_BROWSER'
const requireFromHarness = createRequire(import.meta.url)

const GOAL_CODE = 'CET_4_6'
const EXPECTED_GOAL_CODE = 'COLLEGE_CET'
const PROFILE_GOAL_CODE = 'CET_4_6'
const TARGET_LEVEL = 'B1'
const DAILY_QUOTA_MINUTES = 30
const ALLOWED_QUOTAS = [5, 15, 30, 45]
const PREFERENCE_FIELDS = ['uiLocale', 'contentLocale', 'timezone', 'themeMode', 'highContrast', 'motionMode']

const steps = []
const assertions = []
let requests = 0
let child = null
let info = { started: false, owned: false, port: PORT, jarSha256: null }

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex')
const hashText = (value) => hash(Buffer.from(value, 'utf8'))
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const list = (value) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value) => typeof value === 'string' ? value : null
const integer = (value) => Number.isSafeInteger(value) ? value : null

function must(ok, id, message, detail = {}) {
  assertions.push({ id, ok: Boolean(ok), detail })
  if (!ok) {
    const error = new Error(message)
    error.id = id
    error.detail = detail
    throw error
  }
}

function pickPreferences(data) {
  const source = isRecord(data) ? data : {}
  return Object.fromEntries(PREFERENCE_FIELDS.map((field) => [field, source[field] ?? null]))
}

function record(id, method, requestPath, response, extra = {}) {
  steps.push({
    id, method, path: requestPath, status: response.status,
    bodySha256: hash(response.raw), ...extra,
  })
  return response
}

async function call(id, method, requestPath, options, expected, extra = {}) {
  const response = await gateway(requestPath, { ...options, method })
  record(id, method, requestPath, response, extra)
  if (expected !== null) {
    const allowed = Array.isArray(expected) ? expected : [expected]
    must(allowed.includes(response.status), `${id}.status`, `${id}: unexpected status`, {
      status: response.status, expected: allowed,
    })
  }
  return response
}

function gateway(requestPath, { method = 'GET', token, key, body } = {}) {
  if (requests >= MAX_REQUESTS) return Promise.reject(new Error('gateway request budget exceeded'))
  requests += 1
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body), 'utf8')
  const headers = { Accept: 'application/json', Origin: ORIGIN, Connection: 'close' }
  if (token) headers.Authorization = `Bearer ${token}`
  if (key) headers['Idempotency-Key'] = key
  if (payload) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(payload.length)
  }
  return new Promise((resolve, reject) => {
    let settled = false
    let bytes = 0
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    let req
    try {
      req = http.request(`${GATEWAY}${requestPath}`, { method, headers, agent: false }, (res) => {
        const chunks = []
        res.on('data', (chunk) => {
          bytes += chunk.length
          if (bytes > MAX_RESPONSE_BYTES) {
            finish(reject, new Error('gateway response exceeds bound'))
            req.destroy()
            return
          }
          chunks.push(chunk)
        })
        res.on('end', () => {
          const raw = Buffer.concat(chunks)
          let json = null
          try { json = JSON.parse(raw.toString('utf8')) } catch { /* non-JSON error body */ }
          finish(resolve, { status: res.statusCode || 0, raw, json })
        })
        res.on('aborted', () => finish(reject, new Error('gateway response aborted')))
        res.on('error', (error) => finish(reject, error))
      })
    } catch (error) {
      finish(reject, error)
      return
    }
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('gateway request timed out')))
    req.on('error', (error) => finish(reject, error))
    if (payload) req.write(payload)
    req.end()
  })
}

function health() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: PORT, path: '/actuator/health/readiness', method: 'GET',
      headers: { Accept: 'application/json' }, agent: false,
    }, (res) => {
      res.resume()
      resolve(res.statusCode || 0)
    })
    req.setTimeout(2_500, () => req.destroy(new Error('learner health timed out')))
    req.on('error', reject)
    req.end()
  })
}

function tcp() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port: PORT })
    let done = false
    const end = (value) => { if (!done) { done = true; socket.destroy(); resolve(value) } }
    socket.setTimeout(600, () => end(false))
    socket.once('connect', () => end(true))
    socket.once('error', () => end(false))
  })
}

async function waitPortFree(deadlineMs) {
  const deadline = Date.now() + deadlineMs
  while (Date.now() < deadline) {
    if (!(await tcp())) return true
    await delay(250)
  }
  return !(await tcp())
}

async function stop() {
  if (!child || !child.pid) return { stopped: true, released: await waitPortFree(5_000) }
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await Promise.race([exited, delay(12_000)])
    if (child.exitCode === null && child.signalCode === null) {
      const killed = new Promise((resolve) => child.once('exit', resolve))
      child.kill('SIGKILL')
      await Promise.race([killed, delay(5_000)])
    }
  }
  const stopped = child.exitCode !== null || child.signalCode !== null
  const released = await waitPortFree(5_000)
  return { stopped, released }
}

function claims(token) {
  const parts = token.split('.')
  must(parts.length === 3, 'jwt.shape', 'the IAM access token is not a three-part JWT')
  const read = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  return { header: read(parts[0]), payload: read(parts[1]) }
}

function jwtFacts(token) {
  const decoded = claims(token)
  const p = decoded.payload
  const roles = list(p.roles)
  const permissions = list(p.permissions)
  const facts = {
    alg: decoded.header.alg,
    issuer: p.iss,
    audience: list(p.aud),
    subjectPresent: Boolean(p.sub || p.principal_id),
    roleLearner: roles.includes('learner'),
    permissionTargetWrite: permissions.includes('learner.target.write'),
    permissionProfileRead: permissions.includes('learner.profile.read'),
    tokenType: p.token_type,
    scopePresent: Boolean(p.scope),
    adultGate: p.adult_gate,
    consentState: p.consent_state,
    phase: p.phase,
    accountStatus: p.account_status,
    tenant: p.tenant_id,
  }
  must(facts.alg === 'RS256', 'jwt.alg', 'the IAM access token must be RS256')
  must(facts.issuer === 'http://127.0.0.1:18087' && facts.audience.includes('yuxuexing-api'),
    'jwt.issuer_audience', 'the IAM token issuer/audience does not match the B72 runtime')
  must(facts.subjectPresent && facts.roleLearner && facts.permissionTargetWrite && facts.permissionProfileRead
    && facts.tokenType === 'access' && facts.scopePresent, 'jwt.authority',
  'the IAM token lacks the learner subject/target-write/profile-read/access-scope facts')
  must(facts.adultGate === 'PASSED' && facts.consentState === 'GRANTED' && facts.phase === 'phase-1'
    && facts.accountStatus === 'ACTIVE' && facts.tenant === 'platform', 'jwt.eligibility',
  'the IAM token lacks the B72 adult-gate/consent/phase/account/tenant facts')
  return facts
}

function consentSettings() {
  const secret = String(process.env.LEARNER_CONSENT_RECHECK_CLIENT_SECRET || '')
  const digest = String(process.env.IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST || '').toLowerCase()
  must(/^[0-9a-f]{64}$/u.test(digest), 'learner.consent_digest',
    'IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST must be the precomputed lowercase SHA-256 hex digest')
  must(secret.length >= 16, 'learner.consent_secret',
    'LEARNER_CONSENT_RECHECK_CLIENT_SECRET must be the freshly generated disposable secret')
  must(hashText(secret) === digest, 'learner.consent_digest_match',
    'the learner consent secret does not match the IAM service-client digest')
  const enabled = process.env.LEARNER_CONSENT_RECHECK_ENABLED
  must(enabled === undefined || /^true$/iu.test(enabled), 'learner.consent_enabled',
    'LEARNER_CONSENT_RECHECK_ENABLED must be true; the real service consent recheck cannot be disabled')
  const baseUrl = process.env.LEARNER_CONSENT_RECHECK_IAM_BASE_URL
  must(baseUrl === undefined || baseUrl.replace(/\/+$/u, '') === 'https://127.0.0.1:18087',
    'learner.consent_base_url', 'LEARNER_CONSENT_RECHECK_IAM_BASE_URL must be https://127.0.0.1:18087')
  const clientId = process.env.LEARNER_CONSENT_RECHECK_CLIENT_ID
  must(clientId === undefined || clientId === 'learner-service', 'learner.consent_client_id',
    'LEARNER_CONSENT_RECHECK_CLIENT_ID must be learner-service')
  return { secret, digest, enabled: true, baseUrl: 'https://127.0.0.1:18087', clientId: 'learner-service' }
}

function projectObserver(receipt) {
  if (!isRecord(receipt)) {
    return { status: 'FAILED', reason: null, placementOptIn: false, indexMatch: false, expectedIndexSha256: null, errorId: null, placement: null }
  }
  const placement = isRecord(receipt.expectations) && isRecord(receipt.expectations.placement)
    ? receipt.expectations.placement : null
  return {
    status: receipt.status ?? null,
    reason: typeof receipt.reason === 'string' ? receipt.reason : null,
    placementOptIn: receipt.placementOptIn === true,
    indexMatch: receipt.indexMatch === true,
    expectedIndexSha256: typeof receipt.expectedIndexSha256 === 'string' ? receipt.expectedIndexSha256 : null,
    errorId: isRecord(receipt.error) && typeof receipt.error.id === 'string' ? receipt.error.id : null,
    placement,
  }
}

function receiptForDisk(receipt, secrets) {
  const raw = JSON.stringify(receipt)
  const leaked = secrets.some((secret) => typeof secret === 'string' && secret.length > 0 && raw.includes(secret))
    || /eyJ[A-Za-z0-9_-]{8,}\./u.test(raw)
  return leaked ? projectObserver(receipt) : receipt
}

function jsonForDisk(value, secrets, redact) {
  let text = JSON.stringify(value, null, 2)
  if (redact) {
    for (const secret of secrets) {
      if (typeof secret === 'string' && secret.length > 0) text = text.split(secret).join('{redacted}')
    }
    text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '{redacted}')
  }
  return `${text}\n`
}

function observerPlacementMet(receipt) {
  const placement = isRecord(receipt) && isRecord(receipt.expectations) ? receipt.expectations.placement : null
  return Boolean(isRecord(receipt)
    && receipt.status === 'OBSERVED'
    && receipt.placementOptIn === true
    && receipt.indexMatch === true
    && isRecord(placement)
    && placement.postCount === 1
    && placement.postStatus === 201
    && placement.postAfterStart === true
    && placement.contentVersionIdMatch === true
    && placement.firstItemMatch === true
    && placement.totalItemCountMatch === true
    && placement.questionVisible === true
    && placement.submitDisabled === true
    && placement.noChoiceSelected === true
    && placement.answerWrites === 0
    && placement.planWrites === 0
    && placement.retestWrites === 0
    && placement.skipWrites === 0)
}

function publicPlacementServices(owned) {
  if (!owned) return null
  return {
    status: owned.status,
    launch: owned.launch,
    learningPortBusy: owned.learningPortBusy,
    cleanup: owned.cleanup,
    cleanupError: owned.cleanupError,
    error: owned.error,
    dec04: owned.dec04,
    answersSubmitted: owned.answersSubmitted,
    scoreRequested: owned.scoreRequested,
    retestRequested: owned.retestRequested,
    skipRequested: owned.skipRequested,
    learningStarted: false,
    programmaticPlacementPost: false,
    sealedCalledByHarness: false,
    planEnsured: false,
    bankSeededByHarness: false,
    targetSeeded: false,
    attachedToExisting: false,
    stoppedUntracked: false,
  }
}

function fullBrowserTokenSet() {
  return process.env.MB006_PLACEMENT_FULL_BROWSER === FULL_BROWSER_OPT_IN
}

function retestContinuationEnabled() {
  return process.env.MB006_PLACEMENT_RETEST_CONTINUATION === RETEST_CONTINUATION_OPT_IN
}

function fullBrowserRootDirectory() {
  return retestContinuationEnabled() ? RETEST_CONTINUATION_ROOT : FULL_BROWSER_ROOT_ARTIFACT_DIR
}

function validateRuntime(options) {
  const runDirectory = options.runDirectory
  const expectedRoot = fullBrowserTokenSet()
    ? fullBrowserRootDirectory()
    : options.placementBrowser === true
      ? PLACEMENT_BROWSER_ROOT_ARTIFACT_DIR
      : options.browser ? BROWSER_ROOT_ARTIFACT_DIR : ROOT_ARTIFACT_DIR
  must(runDirectory === expectedRoot, 'run_directory.root',
    'runDirectory must be the exact root artifact directory for the selected mode; no fallback')
  must(typeof runDirectory === 'string' && path.isAbsolute(runDirectory) && path.resolve(runDirectory) === runDirectory,
    'run_directory.exact', 'an exact absolute owner-provided runDirectory is required; no fallback')
  const runDir = path.resolve(runDirectory)
  if (!fs.existsSync(runDir)) fs.mkdirSync(runDir, { recursive: true, mode: 0o700 })
  must(fs.statSync(runDir).isDirectory(), 'run_directory.directory', 'runDirectory must be an existing directory')
  must((fs.statSync(runDir).mode & 0o077) === 0, 'run_directory.private',
    'runDirectory must not be group/world accessible')

  const jar = options.learnerJar
  must(typeof jar === 'string' && fs.existsSync(jar) && fs.statSync(jar).isFile(), 'learner.jar',
    'the exact pinned Learner jar is required')
  const expected = String(options.learnerJarSha256 || '').toLowerCase()
  const actual = hash(fs.readFileSync(jar))
  must(/^[0-9a-f]{64}$/u.test(expected) && actual === expected, 'learner.jar_sha256',
    'Learner jar SHA-256 does not match the root-provided pinned SHA-256', { actual })
  const jdbc = String(options.learnerJdbcUrl || '')
  must(/^jdbc:mysql:\/\/127\.0\.0\.1:13306\/learner_service(?:\?[^\s]*)?$/u.test(jdbc) && !jdbc.includes('@'),
    'learner.jdbc_url', 'learner JDBC URL must be the owned 127.0.0.1:13306/learner_service schema')
  must(options.learnerSchema === 'learner_service', 'learner.schema', 'learner schema must be learner_service')
  const user = options.learnerJdbcUsername
  const password = options.learnerJdbcPassword
  must(user && user !== 'root' && password, 'learner.db_user', 'an owned non-root learner DB user/password is required')

  const trust = options.trustStore
  const trustPass = options.trustStorePassword
  must(trust && trustPass && fs.existsSync(trust), 'learner.truststore',
    'the B72 CA truststore is required for the HTTPS IAM JWKS')
  must(typeof options.java === 'string' && options.java.length > 0, 'learner.java', 'the exact Java runtime is required')
  const consent = consentSettings()
  return { runDir, jar, actual, jdbc, user, password, trust, trustPass, consent }
}

async function start(options, runtime, log) {
  must(options.optIn === OPT_IN, 'learner.start_opt_in',
    'exact startup opt-in is required; attachment to an unknown process is not allowed')
  must(!(await tcp()), 'learner.port_busy', '127.0.0.1:18088 is already in use; attachment is not allowed')
  const scratch = path.dirname(log)
  fs.mkdirSync(scratch, { recursive: true, mode: 0o700 })
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || '',
    TMPDIR: scratch,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(PORT),
    LEARNER_SERVICE_PORT: String(PORT),
    LEARNER_PHASE: 'phase-1',
    LEARNER_PERSISTENCE_MODE: 'jdbc',
    LEARNER_JDBC_URL: runtime.jdbc,
    LEARNER_JDBC_USERNAME: runtime.user,
    LEARNER_JDBC_PASSWORD: runtime.password,
    LEARNER_JDBC_DRIVER: 'com.mysql.cj.jdbc.Driver',
    LEARNER_SCHEMA: 'learner_service',
    LEARNER_FLYWAY_ENABLED: 'true',
    LEARNER_RESOURCE_SERVER_ENABLED: 'true',
    LEARNER_SECURITY_ISSUER_URI: 'http://127.0.0.1:18087',
    LEARNER_SECURITY_JWK_SET_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    LEARNER_SECURITY_AUDIENCE: 'yuxuexing-api',
    // The real service PEP recheck is mandatory for this proof. No cached consent
    // result is accepted; a missing IAM answer fails closed with 403.
    LEARNER_CONSENT_RECHECK_ENABLED: 'true',
    LEARNER_CONSENT_RECHECK_IAM_BASE_URL: runtime.consent.baseUrl,
    LEARNER_CONSENT_RECHECK_CLIENT_ID: runtime.consent.clientId,
    LEARNER_CONSENT_RECHECK_CLIENT_SECRET: runtime.consent.secret,
    OTEL_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
    MANAGEMENT_TRACING_EXPORT_ENABLED: 'false',
    SPRING_MAIN_BANNER_MODE: 'off',
  }
  const args = [
    '-Xms64m', '-Xmx384m', '-XX:ActiveProcessorCount=2', '-Dfile.encoding=UTF-8',
    `-Djava.io.tmpdir=${scratch}`,
    `-Djavax.net.ssl.trustStore=${runtime.trust}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${runtime.trustPass}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ]
  const fd = fs.openSync(log, 'w', 0o600)
  try {
    child = spawn(options.java, [...args, '-jar', runtime.jar], {
      cwd: scratch, env, stdio: ['ignore', fd, fd], windowsHide: true,
    })
  } finally {
    fs.closeSync(fd)
  }
  child.once('error', (error) => { info.spawnError = error.message })
  info = {
    started: true, owned: true, port: PORT, log, jarSha256: runtime.actual,
    truststoreSha256: hash(fs.readFileSync(runtime.trust)), pid: child.pid,
  }
  fs.chmodSync(log, 0o600)
  const deadline = Date.now() + 90_000
  let last = 'no response'
  while (Date.now() < deadline) {
    if (info.spawnError) must(false, 'learner.spawn', `learner JVM did not start: ${info.spawnError}`)
    if (child.exitCode !== null || child.signalCode !== null) {
      must(false, 'learner.exited', `learner JVM exited (${child.exitCode ?? child.signalCode}) before listening`)
    }
    try {
      const status = await health()
      if (status >= 200 && status < 300) return
      last = `HTTP ${status}`
    } catch (error) {
      last = error.message
    }
    await delay(250)
  }
  must(false, 'learner.timeout', 'learner JVM did not listen on 127.0.0.1:18088 within 90s', { last })
}

/**
 * Run the full learner-target owner proof. Returns and writes one result object
 * under options.runDirectory; never writes the bearer token, principal id,
 * idempotency key, password, or service-client secret.
 */
export async function runLearnerTargetProbe(options = {}) {
  steps.length = 0
  assertions.length = 0
  requests = 0
  child = null
  info = { started: false, owned: false, port: PORT, jarSha256: null }
  const token = options.token
  const runDirectory = options.runDirectory
  const browserMode = options.browser === true
  const placementMode = options.placementBrowser === true
  const fullMode = fullBrowserTokenSet()
  let error = null
  let cleanupError = null
  let result = null
  let runtime = null
  let jwt = null
  let observations = {}
  let browserReceipt = null
  let placementOwned = null
  let placementObserverRaw = null
  let fullOwner = null
  let out = null
  try {
    must(typeof token === 'string' && token.split('.').length === 3, 'token.missing',
      'the refreshed IAM token must be passed as an in-memory parameter')
    jwt = jwtFacts(token)
    runtime = validateRuntime(options)
    if (process.env.MB006_PLACEMENT_FULL_BROWSER !== undefined && !fullMode) {
      must(false, 'placement.full_opt_in',
        'MB006_PLACEMENT_FULL_BROWSER must be the exact opt-in token or absent')
    }
    if (fullMode) {
      must(placementMode && browserMode, 'placement.full_requires_b85_b89',
        'MB006_PLACEMENT_FULL_BROWSER requires the B85 browser opt-in and MB006_PLACEMENT_BROWSER')
    }
    if (placementMode) {
      must(browserMode, 'placement.requires_browser',
        'MB006_PLACEMENT_BROWSER runs only inside the B85 browser opt-in')
      must(typeof options.gatewayJar === 'string' && options.gatewayJar.length > 0, 'placement.gateway_jar',
        'the running Gateway jar path is required')
    }
    if (browserMode) {
      must(typeof options.identifier === 'string' && options.identifier.length > 0, 'browser.identifier',
        'the B72 synthetic identifier must be passed in memory for browser mode')
      must(typeof options.password === 'string' && options.password.length > 0, 'browser.password',
        'the B72 synthetic password must be passed in memory for browser mode')
      must(typeof options.caPem === 'string' && fs.existsSync(options.caPem), 'browser.ca_pem',
        'the B72 CA PEM must be passed to the browser module')
    }
    out = path.join(runtime.runDir, browserMode ? 'browser-target-result.json' : 'learner-target-result.json')
    fs.rmSync(out, { force: true })
    const logDirectory = options.logDirectory || runtime.runDir
    fs.mkdirSync(logDirectory, { recursive: true, mode: 0o700 })
    must((fs.statSync(logDirectory).mode & 0o077) === 0, 'learner.log_directory_private',
      'the learner log directory must not be group/world accessible')
    const log = path.join(logDirectory, 'learner-service.log')
    await start(options, runtime, log)

    // 1. Anonymous public route must fail closed at the Gateway / resource server.
    const anonymous = await call('anonymous.profile', 'GET', '/learner/profile', {}, [401, 403])
    observations.anonymousStatus = anonymous.status

    // 2. Current owner reads. These establish the exact prior version and the
    // preference values that must not change. A pre-existing target is refused
    // rather than overwritten, so the proof always writes exactly one new goal.
    const profileBefore = await call('profile.before', 'GET', '/learner/profile', { token }, 200)
    const profileBeforeData = profileBefore.json?.data
    must(isRecord(profileBeforeData), 'profile.before.envelope', 'profile read did not return a data object')
    must(Boolean(profileBeforeData.principalId || profileBeforeData.principal_id), 'profile.before.subject',
      'profile read did not return an owner subject')
    const priorVersion = integer(profileBeforeData.stateVersion)
    must(priorVersion !== null && priorVersion >= 0, 'profile.before.state_version',
      'profile read did not return a non-negative integer stateVersion')
    must((profileBeforeData.targetGoal ?? null) === null, 'profile.before.no_target',
      'the synthetic principal already has a target; refusing to overwrite it', {
        targetGoalPresent: (profileBeforeData.targetGoal ?? null) !== null,
      })
    if (browserMode) {
      must(priorVersion === 0, 'profile.before.version_zero',
        'browser mode requires the fresh synthetic profile to start at stateVersion 0', { priorVersion })
    }
    observations.priorStateVersion = priorVersion
    observations.profileStatusBefore = text(profileBeforeData.status)

    const targetBefore = await call('targets.before', 'GET', '/learner/targets', { token }, [200, 404])
    must(targetBefore.status === 404, 'targets.before.fresh',
      'the synthetic principal already has a target; refusing to overwrite it', { status: targetBefore.status })
    observations.targetPresentBefore = false

    const preferencesBefore = await call('preferences.before', 'GET', '/learner/preferences', { token }, 200)
    const preferencesBeforeData = preferencesBefore.json?.data
    must(isRecord(preferencesBeforeData), 'preferences.before.envelope',
      'preferences read did not return a data object')
    const preferencesBeforeValues = pickPreferences(preferencesBeforeData)
    const preferencesVersionBefore = integer(preferencesBeforeData.stateVersion)
    must(preferencesVersionBefore === priorVersion, 'preferences.before.version',
      'preferences stateVersion did not match the exact prior profile version', {
        preferencesVersion: preferencesVersionBefore, priorVersion,
      })
    observations.preferencesBefore = preferencesBeforeValues

    // 3. Programmatic mode writes one synthetic goal. Browser mode must not
    // perform this write or any fallback write; the root-supplied browser
    // module drives the H5 UI while this exact Learner JVM remains running.
    let returnedVersion = null
    let targetRef = null
    if (!browserMode) {
      const key = `mb033-${Date.now().toString(36)}-${crypto.randomBytes(6).toString('hex')}`
      must(/^[A-Za-z0-9._:-]{16,128}$/u.test(key), 'target.key_shape', 'generated idempotency key is not contract-shaped')
      const targetBody = {
        expectedStateVersion: priorVersion,
        goalCode: GOAL_CODE,
        targetLevel: TARGET_LEVEL,
        dailyQuotaMinutes: DAILY_QUOTA_MINUTES,
        status: 'ACTIVE',
      }
      must(ALLOWED_QUOTAS.includes(DAILY_QUOTA_MINUTES), 'target.quota_allowed',
        'the synthetic quota is outside the 5/15/30/45 contract set')
      const put = await call('target.put', 'PUT', '/learner/targets', { token, key, body: targetBody }, 200, {
        keySha256: hashText(key), expectedStateVersion: priorVersion,
      })
      const putData = put.json?.data
      must(isRecord(putData), 'target.put.envelope', 'target write did not return a data object')
      returnedVersion = integer(putData.stateVersion)
      const targetVersion = integer(putData.targetVersion)
      targetRef = putData.targetId === undefined ? null : hashText(String(putData.targetId))
      must(targetRef !== null, 'target.put.target_id', 'target write did not return a target id')
      must(putData.goalCode === EXPECTED_GOAL_CODE, 'target.put.goal_code',
        'target write returned an unexpected canonical goalCode', { actual: putData.goalCode, expected: EXPECTED_GOAL_CODE })
      must(putData.targetLevel === TARGET_LEVEL, 'target.put.target_level',
        'target write returned an unexpected targetLevel', { actual: putData.targetLevel, expected: TARGET_LEVEL })
      must(putData.dailyQuotaMinutes === DAILY_QUOTA_MINUTES, 'target.put.daily_quota',
        'target write returned an unexpected dailyQuotaMinutes', {
          actual: putData.dailyQuotaMinutes, expected: DAILY_QUOTA_MINUTES,
        })
      must(putData.status === 'ACTIVE', 'target.put.status',
        'target write did not return ACTIVE', { actual: putData.status })
      must(returnedVersion === priorVersion + 1, 'target.put.version',
        'target write did not advance the profile version by exactly one', {
          priorVersion, returnedVersion,
        })
      must(targetVersion === returnedVersion, 'target.put.version_alias',
        'targetVersion did not equal stateVersion', { targetVersion, returnedVersion })
      must((putData.examCode ?? null) === null, 'target.put.no_exam_code',
        'the learner target write unexpectedly returned an examCode')
      must((putData.targetDate ?? null) === null, 'target.put.no_target_date',
        'the learner target write unexpectedly returned a targetDate')
      must(put.json?.meta?.replayed === false, 'target.put.not_replayed',
        'the first target write was unexpectedly a replay')
      Object.assign(steps.at(-1), {
        targetRefSha256: targetRef, stateVersion: returnedVersion, targetVersion,
        goalCode: putData.goalCode, targetLevel: putData.targetLevel,
        dailyQuotaMinutes: putData.dailyQuotaMinutes, status: putData.status,
      })
      observations.returnedStateVersion = returnedVersion
      observations.targetRefSha256 = targetRef

      // 4. Same-key retry is safe and useful only because the learner owner stores
      // an idempotency fingerprint and replays the response. It is performed only
      // after a 200; a real adverse first status would have thrown above.
      const replay = await call('target.put_replay', 'PUT', '/learner/targets', { token, key, body: targetBody }, 200, {
        keySha256: hashText(key), expectedStateVersion: priorVersion,
      })
      const replayData = replay.json?.data
      must(isRecord(replayData), 'target.put_replay.envelope', 'target replay did not return a data object')
      must(replay.json?.meta?.replayed === true, 'target.put_replay.replayed',
        'same-key retry was not marked replayed by the owner')
      must(integer(replayData.stateVersion) === returnedVersion, 'target.put_replay.version',
        'same-key retry returned a different stateVersion', {
          actual: integer(replayData.stateVersion), expected: returnedVersion,
        })
      must(hashText(String(replayData.targetId)) === targetRef, 'target.put_replay.target',
        'same-key retry returned a different target id')
      must(replayData.goalCode === EXPECTED_GOAL_CODE && replayData.status === 'ACTIVE',
        'target.put_replay.fields', 'same-key retry did not retain the committed goal fields')
      Object.assign(steps.at(-1), {
        targetRefSha256: targetRef, stateVersion: returnedVersion, replayed: true,
      })
    } else {
      const outDir = path.join(runtime.runDir, 'browser')
      fs.mkdirSync(outDir, { recursive: true, mode: 0o700 })
      must((fs.statSync(outDir).mode & 0o077) === 0, 'browser.out_dir_private',
        'the browser module output directory must not be group/world accessible')
      let browserModule = null
      try {
        browserModule = requireFromHarness('./browser-target-probe.cjs')
      } catch (caught) {
        must(false, 'browser.module_load', 'browser target module could not be loaded', {
          error: caught && caught.code ? caught.code : 'load_error',
        })
      }
      must(browserModule && typeof browserModule.runTargetBrowser === 'function', 'browser.module',
        'browser target module must export runTargetBrowser')
      let fullCallback = null
      if (fullMode) {
        fullOwner = await import(new URL('./full-browser-owner.mjs', import.meta.url))
        const proven = fullOwner.provenFullArtifact()
        fullCallback = fullOwner.callbackOptions()
        const callbackKeys = Object.keys(fullCallback)
        const retestOn = retestContinuationEnabled()
        const expectedCallbackKeys = retestOn
          ? ['full', 'fullArtifact', 'fullIndexSha', 'retestContinuation']
          : ['full', 'fullArtifact', 'fullIndexSha']
        must(fullCallback.full === true
          && fullCallback.fullArtifact === proven.artifact
          && fullCallback.fullIndexSha === proven.indexSha
          && (!retestOn || fullCallback.retestContinuation === true)
          && callbackKeys.length === expectedCallbackKeys.length
          && expectedCallbackKeys.every((key, index) => callbackKeys[index] === key),
        'placement.full_callback', retestOn
          ? 'DSH42 retest continuation receives the proven B100 artifact, index SHA, and retestContinuation'
          : 'DSH42 receives only the proven full artifact and index SHA')
        must(fullOwner.FULL_BROWSER_ROOT_ARTIFACT_DIR === fullBrowserRootDirectory(),
          'placement.full_owner_pin', 'the full browser run directory pin drifted from this probe')
      }
      const browserOptions = {
        identifier: options.identifier,
        password: options.password,
        caPem: options.caPem,
        outDir,
        ...(fullMode ? fullCallback : placementMode ? {
          placement: true,
          placementArtifact: PLACEMENT_ARTIFACT,
          placementIndexSha: PLACEMENT_INDEX_SHA,
        } : {}),
      }
      const invokeBrowser = async () => {
        try {
          return await browserModule.runTargetBrowser(browserOptions)
        } catch (caught) {
          const message = String(caught && caught.message ? caught.message : 'browser call failed')
            .replaceAll(String(options.password), '{redacted}')
            .replaceAll(String(options.identifier), '{redacted}')
          browserReceipt = { status: 'FAILED', error: { id: 'browser.call', message } }
          fs.writeFileSync(path.join(runtime.runDir, 'browser-target-module-result.json'),
            jsonForDisk(browserReceipt, [options.password, options.identifier, options.token], fullMode), { mode: 0o600 })
          observations.browser = { status: browserReceipt.status, outDir, receipt: 'browser-target-module-result.json' }
          must(false, 'browser.call', 'browser target smoke call failed', { status: 'FAILED' })
        }
      }
      let moduleResult = null
      if (fullMode) {
        placementOwned = await fullOwner.withFullBrowserServices({
          gatewayJar: options.gatewayJar,
          java: options.java,
          trustStore: options.trustStore,
          trustStorePassword: options.trustStorePassword,
          logDirectory: options.logDirectory || runtime.runDir,
        }, invokeBrowser)
        moduleResult = placementOwned.taskResult
      } else if (placementMode) {
        const { withPlacementBrowserServices } = await import(new URL('./placement-start-read.mjs', import.meta.url))
        placementOwned = await withPlacementBrowserServices({
          gatewayJar: options.gatewayJar,
          java: options.java,
          trustStore: options.trustStore,
          trustStorePassword: options.trustStorePassword,
          logDirectory: options.logDirectory || runtime.runDir,
        }, invokeBrowser)
        moduleResult = placementOwned.taskResult
      } else {
        moduleResult = await invokeBrowser()
      }
      if (isRecord(moduleResult)) {
        placementObserverRaw = moduleResult
        const redacted = (fullMode || placementMode)
          ? receiptForDisk(moduleResult, [options.password, options.identifier, options.token])
          : moduleResult
        browserReceipt = fullMode ? fullOwner.projectFullObserver(redacted) : redacted
        fs.writeFileSync(path.join(runtime.runDir, 'browser-target-module-result.json'),
          jsonForDisk(browserReceipt, [options.password, options.identifier, options.token], fullMode), { mode: 0o600 })
      } else if (!browserReceipt) {
        browserReceipt = fullMode
          ? fullOwner.projectFullObserver(null)
          : placementMode
            ? projectObserver(null)
            : { status: 'FAILED', error: { id: 'browser.result_shape' } }
        fs.writeFileSync(path.join(runtime.runDir, 'browser-target-module-result.json'),
          jsonForDisk(browserReceipt, [options.password, options.identifier, options.token], fullMode), { mode: 0o600 })
      }
      observations.browser = {
        status: browserReceipt.status ?? null, outDir, receipt: 'browser-target-module-result.json',
      }
      if (placementMode && (!placementOwned || placementOwned.status !== 'PASS')) {
        must(false, placementOwned?.error?.id || placementOwned?.cleanupError?.id || 'placement.services',
          placementOwned?.error?.message || placementOwned?.cleanupError?.message || 'owned Content or Assessment was not up for the browser')
      }
      must(browserReceipt.status === 'OBSERVED' || browserReceipt.status === 'FAILED',
        'browser.status_shape', 'browser module status must be OBSERVED or FAILED')
      must(browserReceipt.status === 'OBSERVED', 'browser.status',
        'browser target smoke did not observe success', { status: browserReceipt.status })
      if (fullMode) {
        must(fullOwner.observerFullScenarioMet(placementObserverRaw), 'placement.full_observer',
          'observer full placement and learning scenario is required', {
            status: browserReceipt.status ?? null,
            reason: browserReceipt.reason ?? null,
          })
      } else if (placementMode) {
        must(observerPlacementMet(placementObserverRaw), 'placement.observer',
          'observer placement success is required', {
            status: browserReceipt.status ?? null,
            reason: browserReceipt.reason ?? null,
          })
      }
      returnedVersion = 1
      observations.returnedStateVersion = returnedVersion
    }

    // 5. Owner GET readback of status/goal/level/quota/returned version.
    const targetAfter = await call('targets.after', 'GET', '/learner/targets', { token }, 200)
    const targetAfterData = targetAfter.json?.data
    must(isRecord(targetAfterData), 'targets.after.envelope', 'owner target readback did not return a data object')
    const readbackVersion = integer(targetAfterData.stateVersion)
    must(targetAfterData.status === 'ACTIVE', 'targets.after.status',
      'owner target readback was not ACTIVE', { actual: targetAfterData.status })
    must(targetAfterData.goalCode === EXPECTED_GOAL_CODE, 'targets.after.goal_code',
      'owner target readback has an unexpected goalCode', {
        actual: targetAfterData.goalCode, expected: EXPECTED_GOAL_CODE,
      })
    must(targetAfterData.targetLevel === TARGET_LEVEL, 'targets.after.target_level',
      'owner target readback has an unexpected targetLevel', {
        actual: targetAfterData.targetLevel, expected: TARGET_LEVEL,
      })
    must(targetAfterData.dailyQuotaMinutes === DAILY_QUOTA_MINUTES, 'targets.after.daily_quota',
      'owner target readback has an unexpected dailyQuotaMinutes', {
        actual: targetAfterData.dailyQuotaMinutes, expected: DAILY_QUOTA_MINUTES,
      })
    must(readbackVersion === returnedVersion, 'targets.after.version',
      'owner target readback did not return the write version', {
        actual: readbackVersion, expected: returnedVersion,
      })
    must(integer(targetAfterData.targetVersion) === readbackVersion, 'targets.after.version_alias',
      'owner target readback targetVersion did not equal stateVersion')
    if (browserMode) {
      must(readbackVersion === 1, 'targets.after.browser_version',
        'browser target readback did not return stateVersion 1', { actual: readbackVersion })
      must(integer(targetAfterData.targetVersion) === 1, 'targets.after.browser_target_version',
        'browser target readback did not return targetVersion 1', {
          actual: integer(targetAfterData.targetVersion),
        })
    } else {
      must(hashText(String(targetAfterData.targetId)) === targetRef, 'targets.after.target',
        'owner target readback returned a different target id')
    }
    Object.assign(steps.at(-1), {
      targetRefSha256: targetRef, stateVersion: readbackVersion,
      targetVersion: integer(targetAfterData.targetVersion), goalCode: targetAfterData.goalCode,
      targetLevel: targetAfterData.targetLevel, dailyQuotaMinutes: targetAfterData.dailyQuotaMinutes,
      status: targetAfterData.status,
    })

    const profileAfter = await call('profile.after', 'GET', '/learner/profile', { token }, 200)
    const profileAfterData = profileAfter.json?.data
    must(isRecord(profileAfterData), 'profile.after.envelope', 'owner profile readback did not return a data object')
    must(integer(profileAfterData.stateVersion) === returnedVersion, 'profile.after.version',
      'owner profile readback did not return the committed version')
    must(profileAfterData.targetGoal === PROFILE_GOAL_CODE, 'profile.after.target_goal',
      'owner profile readback did not project the committed goal', {
        actual: profileAfterData.targetGoal, expected: PROFILE_GOAL_CODE,
      })
    if (browserMode) {
      must(integer(profileAfterData.stateVersion) === 1, 'profile.after.browser_version',
        'browser profile readback did not return stateVersion 1')
    }
    Object.assign(steps.at(-1), {
      stateVersion: integer(profileAfterData.stateVersion), targetGoal: profileAfterData.targetGoal,
    })

    const preferencesAfter = await call('preferences.after', 'GET', '/learner/preferences', { token }, 200)
    const preferencesAfterData = preferencesAfter.json?.data
    must(isRecord(preferencesAfterData), 'preferences.after.envelope',
      'owner preferences readback did not return a data object')
    const preferencesAfterValues = pickPreferences(preferencesAfterData)
    const changedFields = PREFERENCE_FIELDS.filter((field) => preferencesAfterValues[field] !== preferencesBeforeValues[field])
    must(changedFields.length === 0, 'preferences.after.unchanged',
      'the target proof changed unrelated preference values', { changedFields })
    must(integer(preferencesAfterData.stateVersion) === returnedVersion, 'preferences.after.version',
      'owner preferences readback did not return the committed version')
    if (browserMode) {
      must(integer(preferencesAfterData.stateVersion) === 1, 'preferences.after.browser_version',
        'browser preferences readback did not return stateVersion 1')
    }
    Object.assign(steps.at(-1), { changedFields, stateVersion: integer(preferencesAfterData.stateVersion) })

    // 6. No unrelated writes. Programmatic mode has exactly the one target PUT
    // and its same-key replay; browser mode must have zero harness-target writes
    // because the module, not this probe, drove the H5 write.
    const writes = steps.filter((step) => step.method !== 'GET')
    const keys = new Set(writes.map((step) => step.keySha256))
    if (browserMode) {
      must(writes.length === 0, 'writes.none',
        'browser mode must not perform a programmatic target write or fallback write', {
          writes: writes.length,
        })
    } else {
      must(writes.length === 2, 'writes.count', 'the target proof performed an unexpected number of writes', {
        writes: writes.length,
      })
      must(writes.every((step) => step.path === '/learner/targets' && step.method === 'PUT'),
        'writes.owner_only', 'the target proof wrote outside PUT /learner/targets')
      must(keys.size === 1, 'writes.same_key', 'the target proof used more than one idempotency key')
    }
    must(!steps.some((step) => step.path.startsWith('/learning/') || step.path.startsWith('/onboarding/')),
      'writes.no_plan_or_onboarding', 'the target proof touched a Learning plan or onboarding mutation path')

    observations.target = {
      goalCodeInput: GOAL_CODE,
      goalCodeReturned: EXPECTED_GOAL_CODE,
      profileGoalCode: PROFILE_GOAL_CODE,
      targetLevel: TARGET_LEVEL,
      dailyQuotaMinutes: DAILY_QUOTA_MINUTES,
      quotaAllowed: ALLOWED_QUOTAS.includes(DAILY_QUOTA_MINUTES),
      status: 'ACTIVE',
      returnedStateVersion: readbackVersion,
      targetVersion: integer(targetAfterData.targetVersion),
      replayed: !browserMode,
      ...(browserMode ? {
        browserStatus: browserReceipt?.status ?? null,
        programmaticWrites: 0,
        ...(placementMode && !fullMode ? { programmaticPlacementPosts: 0 } : {}),
        ...(fullMode ? {
          programmaticPlacementPosts: 0,
          programmaticAnswerPosts: 0,
          programmaticPlanPosts: 0,
        } : {}),
      } : {}),
      preferencesUnchanged: changedFields.length === 0,
      writes: writes.length,
      distinctWriteKeys: keys.size,
    }
  } catch (caught) {
    error = {
      id: caught.id || 'probe.error',
      message: caught.message,
      detail: caught.detail || null,
    }
  } finally {
    const cleanup = { owned: Boolean(info.started), started: Boolean(info.started), stopped: false, released: false, portFree: null }
    try {
      const stopped = await stop()
      cleanup.stopped = stopped.stopped
      cleanup.released = stopped.released
    } catch (caught) {
      cleanup.stopError = caught.message
    }
    cleanup.portFree = !(await tcp())
    if (info.started && (!cleanup.stopped || !cleanup.released || cleanup.portFree !== true)) {
      cleanupError = { id: 'cleanup.release', message: 'owned learner JVM did not stop and release 127.0.0.1:18088', detail: cleanup }
    }
    const placementServices = publicPlacementServices(placementOwned)
    const placementMet = placementMode && !fullMode && observerPlacementMet(placementObserverRaw)
    const placementBrowser = placementMode && !fullMode ? {
      kind: 'MB006_PLACEMENT_BROWSER',
      schemaVersion: '1',
      optIn: PLACEMENT_BROWSER_OPT_IN,
      status: placementServices && placementServices.status === 'PASS' && !placementServices.cleanupError && placementMet
        ? 'PASS' : 'FAIL',
      dec04: 'NOT_ASSERTED',
      programmaticPlacementPost: false,
      targetSeeded: false,
      learningStarted: false,
      answersSubmitted: 0,
      scoreRequested: false,
      retestRequested: false,
      skipRequested: false,
      observer: placementObserverRaw
        ? projectObserver(placementObserverRaw)
        : {
          status: browserReceipt?.status ?? 'FAILED',
          reason: browserReceipt?.reason ?? null,
          placementOptIn: false,
          indexMatch: false,
          expectedIndexSha256: null,
          errorId: browserReceipt?.error?.id ?? null,
          placement: null,
        },
      services: placementServices,
    } : null
    let fullBrowser = fullMode
      ? (fullOwner
        ? fullOwner.judgeFullBrowser({ services: placementOwned, receipt: placementObserverRaw })
        : {
          kind: 'MB006_PLACEMENT_FULL_BROWSER',
          schemaVersion: '1',
          optIn: FULL_BROWSER_OPT_IN,
          status: 'FAIL',
          dec04: 'NOT_ASSERTED',
          separateFromIamChecks: true,
          scenario: 'H5_PLACEMENT_ANSWERS_ENSURE_TODAY',
          budgetMet: false,
          observer: null,
          services: null,
        })
      : null
    if (fullBrowser) {
      const secrets = [
        options.password, options.identifier, options.token,
        process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET,
        process.env.MB007_LEARNING_JDBC_PASSWORD,
        process.env.MB006_CONTENT_JDBC_PASSWORD,
        process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
        process.env.MB004_MYSQL_PASSWORD,
        process.env.MB033_LEARNER_JDBC_PASSWORD,
      ].filter((value) => typeof value === 'string' && value.length > 0)
      try {
        let text = JSON.stringify(fullBrowser)
        for (const secret of secrets) text = text.split(secret).join('{redacted}')
        text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '{redacted}')
        fullBrowser = JSON.parse(text)
      } catch {
        fullBrowser = { ...fullBrowser, status: 'FAIL', observer: null, services: null }
      }
    }
    const counters = {
      requests,
      anonymous: steps.filter((step) => step.id.startsWith('anonymous.')).length,
      reads: steps.filter((step) => step.method === 'GET').length,
      writes: steps.filter((step) => step.method !== 'GET').length,
      ...(browserMode ? {
        programmaticWrites: 0,
        browserCalls: 1,
        ...(placementMode ? { programmaticPlacementPosts: 0 } : {}),
        ...(fullMode ? { programmaticAnswerPosts: 0, programmaticPlanPosts: 0 } : {}),
      } : {}),
      replays: steps.filter((step) => step.id === 'target.put_replay').length,
      ownerReadbacks: steps.filter((step) => ['targets.after', 'profile.after', 'preferences.after'].includes(step.id)).length,
    }
    result = {
      kind: browserMode ? 'MB004_LEARNER_TARGET_BROWSER_PROBE' : 'MB033_LEARNER_TARGET_OWNER_PROBE',
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      ...(browserMode ? {
        mode: 'BROWSER',
        browserOptIn: BROWSER_OPT_IN,
        browser: browserReceipt,
        browserStatus: browserReceipt?.status ?? null,
        programmaticWrites: 0,
      } : {}),
      ...(placementBrowser ? { placementBrowser } : {}),
      ...(fullBrowser ? { fullBrowser } : {}),
      status: error || cleanupError || (placementBrowser && placementBrowser.status !== 'PASS') || (fullBrowser && fullBrowser.status !== 'PASS') ? 'FAIL' : 'PASS',
      out, runDirectory: runDirectory || null, gateway: GATEWAY, syntheticAccount: true,
      optIn: OPT_IN,
      route: fullMode
        ? {
          gatewayB14Enabled: true,
          learner: 'TARGET',
          assessment: 'TARGET',
          learning: 'TARGET',
          content: 'TARGET',
          contentBase: 'http://127.0.0.1:18089',
          contentInternal: 'DIRECT',
          otherDomains: 'LEGACY',
          learningPort: 18090,
          learningStarted: placementOwned?.learningStarted === true,
          kafka: false,
          contentDirect: true,
        }
        : placementMode
          ? {
            gatewayB14Enabled: true,
            learner: 'TARGET',
            assessment: 'TARGET',
            content: 'LEGACY',
            learning: 'LEGACY',
            otherDomains: 'LEGACY',
            learningPort: 18090,
            learningStarted: false,
          }
          : { gatewayB14Enabled: true, learner: 'TARGET', otherDomains: 'LEGACY' },
      jwt,
      learner: info,
      db: { host: '127.0.0.1', port: 13306, schema: 'learner_service', userNonRoot: true },
      request: browserMode ? null : {
        method: 'PUT', path: '/learner/targets',
        goalCode: GOAL_CODE, expectedGoalCode: EXPECTED_GOAL_CODE, targetLevel: TARGET_LEVEL,
        dailyQuotaMinutes: DAILY_QUOTA_MINUTES, allowedQuotas: ALLOWED_QUOTAS,
        status: 'ACTIVE',
      },
      observations,
      steps, assertions, counters, cleanup, cleanupError, error,
      warnings: [],
    }
    if (out) {
      let text = JSON.stringify(result, null, 2)
      if (fullMode) {
        const secrets = [
          options.password, options.identifier, options.token,
          process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET,
          process.env.LEARNER_CONSENT_RECHECK_CLIENT_SECRET,
          process.env.MB007_LEARNING_JDBC_PASSWORD,
          process.env.MB006_CONTENT_JDBC_PASSWORD,
          process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
          process.env.MB004_MYSQL_PASSWORD,
          process.env.MB033_LEARNER_JDBC_PASSWORD,
        ].filter((value) => typeof value === 'string' && value.length > 0)
        for (const secret of secrets) text = text.split(secret).join('{redacted}')
        text = text.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '{redacted}')
      }
      fs.writeFileSync(out, `${text}\n`, { mode: 0o600 })
      fs.chmodSync(out, 0o600)
    }
  }
  return result
}
