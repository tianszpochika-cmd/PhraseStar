/**
 * MB-005 forbidden-page observer for one wholly synthetic under-threshold actor.
 *
 * Direct node runs local checks only. It does not listen, register, or open Chrome.
 * observeForbiddenH5 expects an owned lease that already holds IAM and Gateway,
 * plus the G388 nonce marker for the pinned B139 index. The browser performs
 * one register, one adult-gate denial, the forbidden-page read, and one logout.
 * Responses are never fulfilled and auth state is never injected.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const JOB = '/tmp/grok-mobile-resume-forbidden-h5-413'
const B139_H5_ROOT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const B139_INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_INDEX_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const STATIC_QA_HEADER = 'x-mb004-static-qa'
const REGISTER_HASH = '/pages/register/register'
const ONBOARDING_HASH = '/pages/onboarding/onboarding'
const FORBIDDEN_HASH = '/pages/forbidden/forbidden'
const LOGIN_HASH = '/pages/login/login'
const ADULT_TITLE = '暂时无法开始学习'
const ADULT_DESCRIPTION = '当前版本仅向年满18周岁的用户开放学习。你仍可管理账号或查看帮助。'
const LOGOUT_LABEL = '退出登录'
const LOGIN_TITLE = '欢迎回来'
const GATE_TITLE = '先确认你的年龄'
const COOKIE_NAME = 'yuxuexing_refresh'
const GATE_BODY = Object.freeze({ confirmed: true, birthYear: 2015, policyVersion: 'b30-adult-v1' })
const PLAYWRIGHT_ROOTS = [
  '/Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy/package.json',
  '/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy/package.json',
  '/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/package.json',
]
const CONTEXT_OPTIONS = Object.freeze({
  viewport: { width: 390, height: 844 },
  locale: 'zh-CN',
  serviceWorkers: 'block',
  reducedMotion: 'reduce',
  ignoreHTTPSErrors: false,
})

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function localIndex() {
  const index = path.join(B139_H5_ROOT, 'index.html')
  try {
    const digest = sha256(index)
    const names = fs.readdirSync(path.join(B139_H5_ROOT, 'assets'))
    return {
      ok: digest === B139_INDEX_SHA && digest !== B116_INDEX_SHA,
      digest,
      forbiddenChunk: names.some((name) => name.startsWith('pages-forbidden-forbidden.')),
    }
  } catch {
    return { ok: false, digest: null, forbiddenChunk: false }
  }
}

function bundleHasAdultCopy() {
  const assets = path.join(B139_H5_ROOT, 'assets')
  let names = []
  try { names = fs.readdirSync(assets) } catch { return false }
  for (const name of names) {
    if (!name.endsWith('.js')) continue
    const file = path.join(assets, name)
    let stat
    try { stat = fs.statSync(file) } catch { continue }
    if (!stat.isFile() || stat.size > 4_000_000) continue
    const text = fs.readFileSync(file, 'utf8')
    if (text.includes(ADULT_TITLE) && text.includes(ADULT_DESCRIPTION) && text.includes(LOGOUT_LABEL)) return true
  }
  return false
}

export function runObserverChecks() {
  const index = localIndex()
  if (!index.ok) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'b139-index' }
  if (!index.forbiddenChunk) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'forbidden-chunk' }
  if (!bundleHasAdultCopy()) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'adult-copy-missing' }
  return {
    ok: true,
    status: 'OBSERVER_PREPARED',
    observed: false,
    launched: false,
    reason: null,
    indexSha256: B139_INDEX_SHA,
    h5: 'not-started',
  }
}

function isLearningPermission(permission) {
  return permission.startsWith('learning.')
    || permission.startsWith('assessment.')
    || permission.startsWith('content.')
    || (permission.startsWith('learner.') && !permission.startsWith('learner.profile.'))
    || permission.startsWith('gamification.')
    || permission.startsWith('social.')
    || permission.startsWith('commerce:')
    || permission.startsWith('media.')
    || permission.startsWith('media:')
    || permission.startsWith('support.')
    || permission.startsWith('notification.')
}

function token(value) {
  return typeof value === 'string' && /^[A-Z_]{1,40}$/.test(value) ? value : null
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function permissionFacts(value) {
  if (!Array.isArray(value)) return null
  const names = []
  for (const item of value) {
    if (typeof item !== 'string' || !/^[a-z0-9:._-]{1,80}$/.test(item)) return null
    names.push(item)
  }
  names.sort()
  return {
    names,
    learning: names.filter(isLearningPermission).length,
    targetWrite: names.includes('learner.target.write'),
  }
}

function gateFacts(value) {
  const data = asRecord(value)
  if (!data) return null
  return {
    status: token(data.status),
    learningAccess: token(data.learningAccess),
    evidenceStatus: token(data.evidenceStatus),
    policyVersion: data.policyVersion === GATE_BODY.policyVersion ? GATE_BODY.policyVersion : null,
    minimumAge: data.minimumAge === 18 ? 18 : null,
    retryAllowed: data.retryAllowed === true ? true : data.retryAllowed === false ? false : null,
  }
}

function sameGateBody(value) {
  const data = asRecord(value)
  if (!data) return false
  const keys = Object.keys(data)
  return keys.length === 3
    && data.confirmed === true
    && data.birthYear === 2015
    && data.policyVersion === GATE_BODY.policyVersion
}

function pathname(url) {
  try { return new URL(url).pathname } catch { return '' }
}

function originOf(url) {
  try { return new URL(url).origin } catch { return '' }
}

function allowRequest(method, url) {
  const origin = originOf(url)
  const pathName = pathname(url)
  if (origin === PAGE_ORIGIN && (method === 'GET' || method === 'HEAD')) return 'continue'
  if ((origin === IAM_ORIGIN || origin === GATEWAY_ORIGIN) && method === 'OPTIONS') return 'continue'
  if (origin === IAM_ORIGIN && method === 'POST' && pathName === '/api/v1/auth/register') return 'continue'
  if (origin === IAM_ORIGIN && method === 'POST' && pathName === '/api/v1/auth/token/refresh') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'GET' && pathName === '/api/v1/iam/principal/me') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'POST' && pathName === '/api/v1/iam/adult-gate') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'POST' && pathName === '/api/v1/auth/logout') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'GET' && pathName === '/api/v1/iam/permissions') return 'continue'
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'blocked-read'
  return 'blocked-write'
}

function writeClass(pathName) {
  if (pathName === '/api/v1/iam/consents' || pathName.startsWith('/api/v1/iam/consents/')) return 'consent'
  if (pathName.includes('/target')) return 'target'
  if (pathName.startsWith('/api/v1/learner/') || pathName.startsWith('/api/v1/learning/')) return 'learning'
  if (pathName.startsWith('/api/v1/content/') || pathName.startsWith('/api/v1/assessment/')) return 'learning'
  return 'other'
}

function blank(status, reason, extra = {}) {
  return {
    job: 'MB005-H5-FORBIDDEN-413',
    status,
    reason,
    observed: false,
    launched: extra.launched === true,
    h5Started: extra.h5Started === true,
    fakedResponse: false,
    injectedAuthState: false,
    mockDocuments: 'synthetic-fixture-only',
    indexSha256: B139_INDEX_SHA,
    passwordOmitted: true,
    identifierOmitted: true,
    nonceOmitted: true,
  }
}

function loadChromium() {
  for (const root of PLAYWRIGHT_ROOTS) {
    try {
      const playwright = createRequire(root)('playwright')
      if (playwright && playwright.chromium) return playwright.chromium
    } catch { /* next installed worktree */ }
  }
  return null
}

function browserEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/PROXY|PASSWORD|SECRET|TOKEN|CREDENTIAL|COOKIE|PASSWD/i.test(key)) delete env[key]
  }
  return env
}

function certificateSpki(pemPath) {
  const cert = new crypto.X509Certificate(fs.readFileSync(pemPath))
  const der = cert.publicKey.export({ type: 'spki', format: 'der' })
  return crypto.createHash('sha256').update(der).digest('base64')
}

function publicCert(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0')) return null
  const base = path.basename(value).toLowerCase()
  if (!(base.endsWith('.pem') || base.endsWith('.crt') || base.endsWith('.cer'))) return null
  if (base.includes('key') || base.includes('priv')) return null
  return value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitFor(predicate, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await predicate()) return true
    await sleep(100)
  }
  return predicate()
}

async function fillHost(page, hostId, value) {
  const nested = page.locator(`#${hostId} .uni-input-input`).first()
  const field = (await nested.count()) ? nested : page.locator(`#${hostId}`).first()
  await field.fill(value)
}

function hashPath(url) {
  const marker = url.indexOf('#')
  if (marker < 0) return ''
  return url.slice(marker + 1).split('?')[0]
}

function leaked(text, secrets) {
  return secrets.some((secret) => typeof secret === 'string' && secret.length > 0 && text.includes(secret))
}

function cookieClearHeader(response) {
  const lines = response.headersArray().filter((header) => header.name.toLowerCase() === 'set-cookie')
  return lines.some((header) => {
    const value = header.value.toLowerCase()
    return value.includes(`${COOKIE_NAME}=`) && value.includes('max-age=0')
  })
}

async function readData(response) {
  try {
    const text = await response.text()
    if (text.length > 200_000) return null
    return asRecord(asRecord(JSON.parse(text))?.data)
  } catch {
    return null
  }
}

function createState() {
  return {
    requests: [],
    blockedWrites: [],
    registerStatus: null,
    refreshCount: 0,
    gate: null,
    gateBodyExact: false,
    principals: [],
    permissionReads: [],
    logoutStatus: null,
    logoutRevoked: false,
    logoutScope: null,
    cookieCleared: false,
    consentPosts: 0,
    learningWrites: 0,
    targetWrites: 0,
    fulfill: 0,
    rendered: null,
    after: null,
  }
}

function note(state, method, pathName, status, via) {
  state.requests.push({ method, path: pathName, status, via })
}

async function observeResponse(response, state) {
  const method = response.request().method()
  const url = response.url()
  const pathName = pathname(url)
  const via = originOf(url) === IAM_ORIGIN ? 'iam' : originOf(url) === GATEWAY_ORIGIN ? 'gateway' : 'other'
  if (via === 'other') return
  note(state, method, pathName, response.status(), via)
  if (method === 'POST' && pathName === '/api/v1/auth/register') {
    state.registerStatus = response.status()
    return
  }
  if (method === 'POST' && pathName === '/api/v1/auth/token/refresh') {
    state.refreshCount += 1
    return
  }
  if (method === 'POST' && pathName === '/api/v1/iam/adult-gate') {
    const data = await readData(response)
    state.gate = gateFacts(data)
    let body = null
    try { body = JSON.parse(response.request().postData() || '') } catch { body = null }
    state.gateBodyExact = sameGateBody(body)
    return
  }
  if (method === 'GET' && pathName === '/api/v1/iam/principal/me') {
    const data = await readData(response)
    const permissions = permissionFacts(data?.permissions)
    const adult = gateFacts(data?.adultGate)
    state.principals.push({
      http: response.status(),
      status: token(data?.status),
      adult: adult?.status ?? null,
      access: adult?.learningAccess ?? null,
      learning: permissions ? permissions.learning : null,
      targetWrite: permissions ? permissions.targetWrite : null,
      consentAccepted: data?.consentState?.accepted === true ? true : data?.consentState?.accepted === false ? false : null,
      publishedConsentDocuments: data?.publishedConsentDocuments == null ? false : true,
    })
    return
  }
  if (method === 'GET' && pathName === '/api/v1/iam/permissions') {
    const data = await readData(response)
    const permissions = permissionFacts(data?.permissions)
    const adult = gateFacts(data?.adultGate)
    state.permissionReads.push({
      http: response.status(),
      adult: adult?.status ?? null,
      access: adult?.learningAccess ?? null,
      learning: permissions ? permissions.learning : null,
      targetWrite: permissions ? permissions.targetWrite : null,
    })
    return
  }
  if (method === 'POST' && pathName === '/api/v1/auth/logout') {
    const data = await readData(response)
    state.logoutStatus = response.status()
    state.logoutRevoked = token(data?.status) === 'REVOKED'
    state.logoutScope = token(data?.revocationScope)
    state.cookieCleared = cookieClearHeader(response)
  }
}

function wireHolds(state) {
  const gate = state.gate
  const principal = state.principals.filter((row) => row.http === 200).at(-1)
  const register = state.requests.filter((row) => row.method === 'POST' && row.path === '/api/v1/auth/register')
  const gates = state.requests.filter((row) => row.method === 'POST' && row.path === '/api/v1/iam/adult-gate')
  const logouts = state.requests.filter((row) => row.method === 'POST' && row.path === '/api/v1/auth/logout')
  const gateAt = state.requests.findIndex((row) => row.method === 'POST' && row.path === '/api/v1/iam/adult-gate')
  const principalAfterGate = gateAt >= 0 && state.requests.slice(gateAt + 1).some((row) => row.method === 'GET' && row.path === '/api/v1/iam/principal/me' && row.status === 200)
  if (register.length !== 1 || register[0].status !== 201 || register[0].via !== 'iam') return 'register-not-established'
  if (gates.length !== 1 || gates[0].status !== 200 || gates[0].via !== 'gateway') return 'gate-not-observed'
  if (!state.gateBodyExact) return 'gate-fields-not-exact'
  if (!gate || gate.status !== 'REJECTED') return 'gate-status-not-rejected'
  if (gate.learningAccess !== 'RESTRICTED' || gate.evidenceStatus !== 'REJECTED' || gate.policyVersion !== GATE_BODY.policyVersion || gate.minimumAge !== 18 || gate.retryAllowed !== true) {
    return 'gate-fields-not-exact'
  }
  if (!principalAfterGate || !principal || principal.status !== 'RESTRICTED' || principal.adult !== 'REJECTED' || principal.access !== 'RESTRICTED') {
    return 'readback-not-rejected'
  }
  if (principal.consentAccepted !== false || principal.publishedConsentDocuments !== false) return 'consent-present'
  if (principal.learning !== 0 || principal.targetWrite !== false) return 'learning-permission-present'
  for (const row of state.permissionReads) {
    if (row.http !== 200 || row.adult !== 'REJECTED' || row.access !== 'RESTRICTED' || row.learning !== 0 || row.targetWrite !== false) {
      return 'readback-not-rejected'
    }
  }
  if (logouts.length !== 1 || logouts[0].status !== 200 || logouts[0].via !== 'gateway') return 'logout-not-revoked'
  if (!state.logoutRevoked || state.logoutScope !== 'CURRENT_SESSION_AND_TOKEN_FAMILY' || state.cookieCleared !== true) {
    return 'cookie-not-cleared'
  }
  if (state.consentPosts !== 0 || state.learningWrites !== 0 || state.targetWrites !== 0 || state.fulfill !== 0) return 'request-bound'
  if (state.blockedWrites.length !== 0) return 'request-bound'
  return null
}

async function readVisible(page) {
  return page.evaluate(() => {
    const title = document.querySelector('#mobile-forbidden-title')
    const description = document.querySelector('#mobile-forbidden-description')
    const logout = document.querySelector('.forbidden-exit button')
    const login = document.querySelector('#mobile-login-title')
    const gate = document.querySelector('#mobile-onboarding-title')
    const text = (node) => (node && node.textContent ? node.textContent.trim() : '')
    return {
      hash: location.hash,
      title: text(title),
      description: text(description),
      logout: text(logout),
      login: text(login),
      gate: text(gate),
      logoutCount: document.querySelectorAll('.forbidden-exit button').length,
    }
  }).catch(() => null)
}

async function runFlow(page, state, secrets) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const decision = allowRequest(request.method(), request.url())
    if (decision === 'continue') return route.continue()
    const pathName = pathname(request.url())
    if (decision === 'blocked-write') {
      const kind = writeClass(pathName)
      if (kind === 'consent') state.consentPosts += 1
      else if (kind === 'target') state.targetWrites += 1
      else if (kind === 'learning') state.learningWrites += 1
      state.blockedWrites.push({ method: request.method(), path: pathName, kind })
    }
    return route.abort('blockedbyclient')
  })
  page.on('response', (response) => {
    void observeResponse(response, state).catch(() => { state.gate = state.gate || null })
  })
  await page.goto(`${PAGE_ORIGIN}/#${REGISTER_HASH}`, { waitUntil: 'domcontentloaded' })
  const registerReady = await waitFor(async () => page.locator('#mobile-register-identifier-host').count().then((count) => count > 0), 20_000)
  if (!registerReady) return 'register-form'
  await fillHost(page, 'mobile-register-identifier-host', secrets.identifier)
  await fillHost(page, 'mobile-register-password-host', secrets.password)
  await fillHost(page, 'mobile-register-confirm-host', secrets.password)
  await page.locator('.register-submit').click()
  const onboarding = await waitFor(async () => {
    const visible = await readVisible(page)
    return Boolean(visible && visible.gate === GATE_TITLE && hashPath(page.url()) === ONBOARDING_HASH)
  }, 25_000)
  if (!onboarding) return 'onboarding-gate'
  await fillHost(page, 'mobile-onboarding-year-host', '2015')
  await page.locator('.onboarding-check-row').click()
  const enabled = await waitFor(async () => {
    const disabled = await page.locator('.onboarding-primary').first().getAttribute('aria-disabled')
    return disabled === 'false' || disabled === null
  }, 10_000)
  if (!enabled) return 'age-confirm'
  await page.locator('.onboarding-primary').first().click()
  const forbidden = await waitFor(async () => {
    const visible = await readVisible(page)
    return Boolean(visible && visible.title === ADULT_TITLE && visible.description === ADULT_DESCRIPTION && visible.logout === LOGOUT_LABEL)
  }, 25_000)
  if (!forbidden) return 'forbidden-reason'
  await waitFor(() => state.gate != null && state.principals.some((row) => row.http === 200 && row.status === 'RESTRICTED'), 10_000)
  state.rendered = await readVisible(page)
  if (!state.rendered || state.rendered.title !== ADULT_TITLE || state.rendered.description !== ADULT_DESCRIPTION || state.rendered.logout !== LOGOUT_LABEL) {
    return 'forbidden-reason'
  }
  if (state.requests.filter((row) => row.path === '/api/v1/auth/logout').length !== 0) return 'logout-early'
  await page.locator('.forbidden-exit button').click({ clickCount: 1 })
  const signedOut = await waitFor(async () => {
    const visible = await readVisible(page)
    return Boolean(visible && visible.login === LOGIN_TITLE && visible.title !== ADULT_TITLE && hashPath(page.url()) === LOGIN_HASH)
  }, 20_000)
  state.after = await readVisible(page)
  if (!signedOut) return 'logout-page'
  await waitFor(() => state.logoutStatus != null, 10_000)
  return null
}

function projected(state, flowReason) {
  const wireReason = wireHolds(state)
  const renderedView = state.rendered
  const afterView = state.after
  const rendered = Boolean(renderedView && renderedView.title === ADULT_TITLE && renderedView.description === ADULT_DESCRIPTION && renderedView.logout === LOGOUT_LABEL)
  const after = Boolean(afterView && afterView.login === LOGIN_TITLE && afterView.title !== ADULT_TITLE && hashPath(`http://127.0.0.1${afterView.hash || ''}`) === LOGIN_HASH)
  const principal = state.principals.filter((row) => row.http === 200).at(-1) || null
  let reason = flowReason || wireReason
  if (!reason && !rendered) reason = 'rendered-mismatch'
  if (!reason && !after) reason = 'logout-page'
  const observed = reason == null
  return {
    job: 'MB005-H5-FORBIDDEN-413',
    status: observed ? 'OBSERVED' : 'FAILED',
    reason,
    observed,
    launched: true,
    h5Started: true,
    fakedResponse: false,
    injectedAuthState: false,
    mockDocuments: 'synthetic-fixture-only',
    indexSha256: B139_INDEX_SHA,
    actor: 'disposable-generated',
    domain: 'example.invalid',
    birthYear: 2015,
    policyVersion: GATE_BODY.policyVersion,
    requests: state.requests,
    gate: state.gate,
    principalStatus: principal?.status ?? null,
    principalAdultStatus: principal?.adult ?? null,
    principalLearningAccess: principal?.access ?? null,
    learningPermissionCount: principal?.learning ?? null,
    targetWritePresent: principal?.targetWrite ?? null,
    consentAccepted: principal?.consentAccepted ?? null,
    publishedConsentDocuments: principal?.publishedConsentDocuments ?? null,
    consentRequestCount: state.consentPosts,
    learningWriteCount: state.learningWrites,
    targetWriteCount: state.targetWrites,
    blockedWriteCount: state.blockedWrites.length,
    routeFulfillCount: state.fulfill,
    refreshCount: state.refreshCount,
    permissionsEndpoint: state.permissionReads.length === 0 ? 'not-called-by-h5' : 'observed',
    rendered: {
      title: renderedView?.title || '',
      description: renderedView?.description || '',
      logout: renderedView?.logout || '',
      reason: renderedView?.title === ADULT_TITLE ? 'adult' : 'other',
    },
    logout: {
      count: state.requests.filter((row) => row.method === 'POST' && row.path === '/api/v1/auth/logout').length,
      status: state.logoutStatus,
      revocationStatus: state.logoutRevoked ? 'REVOKED' : null,
      revocationScope: state.logoutScope,
      cookieCleared: state.cookieCleared,
    },
    afterLogout: {
      loginTitle: afterView?.login || '',
      forbiddenTitleVisible: afterView?.title === ADULT_TITLE,
    },
    passwordOmitted: true,
    identifierOmitted: true,
    nonceOmitted: true,
  }
}

async function runBrowser(ready) {
  const chromium = loadChromium()
  if (!chromium) return blank('BLOCKED', 'playwright-unavailable')
  const state = createState()
  const secrets = {
    identifier: `g413-${crypto.randomBytes(8).toString('hex')}@example.invalid`,
    password: `G413!${crypto.randomBytes(18).toString('base64url')}`,
    nonce: ready.nonce,
    spki: ready.spki,
  }
  if (secrets.password.length < 12 || secrets.password.length > 128) return blank('BLOCKED', 'password-shape')
  let browser = null
  try {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${secrets.spki}`, '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
      env: browserEnv(),
    })
    const context = await browser.newContext({
      ...CONTEXT_OPTIONS,
      extraHTTPHeaders: { [STATIC_QA_HEADER]: secrets.nonce },
    })
    const page = await context.newPage()
    const flowReason = await runFlow(page, state, secrets)
    const cookies = await context.cookies()
    const liveCookie = cookies.some((cookie) => {
      if (cookie.name !== COOKIE_NAME || !cookie.value) return false
      if (!cookie.expires || cookie.expires < 0) return true
      return cookie.expires * 1000 > Date.now()
    })
    if (liveCookie) state.cookieCleared = false
    secrets.password = ''
    secrets.identifier = ''
    secrets.nonce = ''
    secrets.spki = ''
    return projected(state, flowReason)
  } catch (error) {
    const text = String(error && error.message ? error.message : '')
    if (leaked(text, [secrets.password, secrets.identifier, secrets.nonce, secrets.spki])) {
      return blank('BLOCKED', 'receipt-secret', { launched: true, h5Started: true })
    }
    if (/channel|chrome/i.test(text)) return blank('BLOCKED', 'chrome-unavailable', { launched: true })
    return blank('FAILED', 'h5-proof-failed', { launched: true, h5Started: true })
  } finally {
    secrets.password = ''
    secrets.identifier = ''
    secrets.nonce = ''
    secrets.spki = ''
    if (browser) await browser.close().catch(() => {})
  }
}

export async function observeForbiddenH5(input) {
  const prepared = runObserverChecks()
  if (prepared.ok !== true) return blank('BLOCKED', prepared.reason || 'observer-check')
  if (!input || input.ownedLease !== true) return blank('BLOCKED', 'lease')
  const ca = publicCert(input.caPem)
  const nonce = typeof input.staticNonce === 'string' && /^[0-9a-f]{64}$/.test(input.staticNonce) ? input.staticNonce : ''
  if (!ca || !nonce) return blank('BLOCKED', 'lease-arm')
  let spki = ''
  try { spki = certificateSpki(ca) } catch { return blank('BLOCKED', 'ca-spki') }
  try {
    const receipt = await runBrowser({ nonce, spki })
    const encoded = JSON.stringify(receipt)
    if (leaked(encoded, [nonce, spki, input.staticNonce])) return blank('BLOCKED', 'receipt-secret', { launched: receipt.launched === true })
    return receipt
  } finally {
    spki = ''
  }
}

function isDirectRun() {
  const arg = process.argv[1]
  if (!arg) return false
  try {
    return fs.realpathSync(arg) === fs.realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return import.meta.url === pathToFileURL(arg).href
  }
}

if (isDirectRun()) {
  process.stdout.write(`${JSON.stringify(runObserverChecks())}\n`)
}
