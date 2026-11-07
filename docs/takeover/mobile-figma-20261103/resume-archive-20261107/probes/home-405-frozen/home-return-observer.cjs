'use strict'

/**
 * Same-actor login returnTo=/pages/home/home after a real B96/G372 placement
 * and plans:ensure. In-process only. Direct execution prints usage.
 *
 * The observer opens a fresh non-persistent Chrome document. It does not
 * assign location, storage, or the return path. Static GET/HEAD continue
 * with x-mb004-static-qa. No route.fulfill. No domain-table seed.
 */

const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const crypto = require('node:crypto')
const { createRequire } = require('node:module')
const { execFileSync } = require('node:child_process')

const PINS = JSON.parse(fs.readFileSync(path.join(__dirname, 'pins.json'), 'utf8'))
const ARM = 'YES_ONE_SAME_ACTOR_HOME_RETURN'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const STATIC_BIND = '127.0.0.1'
const STATIC_PORT = 18183
const STATIC_HOST = '127.0.0.1:18183'
const STATIC_QA_HEADER = 'x-mb004-static-qa'
const LOGIN_PATH = '/api/v1/auth/login'
const REFRESH_PATH = '/api/v1/auth/token/refresh'
const HOME_PATH = '/api/v1/learner/home'
const CATALOG_PATH = '/api/v1/content/learner/catalog'
const HOME_HASH = '/pages/home/home'
const LOGIN_HASH = '/pages/login/login'
const ONBOARDING_HASH = '/pages/onboarding/onboarding'
const CONTENT_LOCALE_QUERY = '?contentLocale=en-US'
const DEADLINE_MS = 90_000
const B139_H5_ROOT = PINS.h5.root
const B139_INDEX_SHA = PINS.h5.indexSha256
const B116_INDEX_SHA = PINS.h5.rejectIndexSha256
const PLAYWRIGHT_ROOTS = PINS.playwrightRoots
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

const IAM_CONTINUE = new Set([
  `POST ${LOGIN_PATH}`,
  `OPTIONS ${LOGIN_PATH}`,
  `POST ${REFRESH_PATH}`,
  `OPTIONS ${REFRESH_PATH}`,
])

const GATEWAY_GET = new Set([
  '/api/v1/iam/principal/me',
  '/api/v1/iam/permissions',
  '/api/v1/iam/consents',
  '/api/v1/learner/profile',
  '/api/v1/learner/targets',
  '/api/v1/learner/preferences',
  '/api/v1/onboarding/options',
  HOME_PATH,
  CATALOG_PATH,
  '/api/v1/learning/today',
  '/api/v1/learner/first-day',
])

const LOCALE_PATHS = new Set([
  '/api/v1/learner/profile',
  '/api/v1/learner/targets',
  '/api/v1/onboarding/options',
  HOME_PATH,
  CATALOG_PATH,
  '/api/v1/learner/first-day',
])

const USAGE = [
  'home-return-observer.cjs is in-memory only.',
  'The 405 hook calls afterPlacementJourney({ identifier, password, caPem, outDir }, placementReceipt).',
  'A fresh document loads #/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome.',
  'The page submits the password. This file does not assign location, storage, or returnTo.',
  'Direct execution does not open Chrome, bind 18183, or start IAM.',
].join('\n')

function tokenOf(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 80) return null
  if (/[@\s]|eyJ|bearer/i.test(value)) return null
  return value
}

function httpOf(value) {
  return Number.isInteger(value) && value >= 100 && value <= 599 ? value : null
}

function countOf(value) {
  return Number.isInteger(value) && value >= 0 && value <= 80 ? value : null
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function sameMarker(presented, marker) {
  if (typeof presented !== 'string' || typeof marker !== 'string' || marker.length === 0) return false
  const given = Buffer.from(presented)
  const expected = Buffer.from(marker)
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(given, expected)
}

function frozenAsset(pathname, artifactRoot) {
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

function serveFrozen(req, res, marker, artifactRoot) {
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

function listenFrozenStatic(marker, artifactRoot) {
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
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      try { server.close() } catch { /* already closing */ }
      reject(error)
    }
    server.once('error', onError)
    server.listen({ host: STATIC_BIND, port: STATIC_PORT, exclusive: true }, () => {
      server.removeListener('error', onError)
      server.on('error', () => {})
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

function proveB139(artifactRoot, expectedIndexSha) {
  if (typeof artifactRoot !== 'string' || !path.isAbsolute(artifactRoot)) return { ok: false, reason: 'frozen-root-required' }
  if (typeof expectedIndexSha !== 'string' || !/^[0-9a-f]{64}$/.test(expectedIndexSha)) return { ok: false, reason: 'frozen-sha-required' }
  if (expectedIndexSha === B116_INDEX_SHA || expectedIndexSha !== B139_INDEX_SHA) return { ok: false, reason: 'frozen-sha-not-canonical' }
  let supplied
  let canonical
  try {
    supplied = fs.realpathSync(artifactRoot)
    canonical = fs.realpathSync(B139_H5_ROOT)
  } catch {
    return { ok: false, reason: 'frozen-root-unavailable' }
  }
  if (supplied !== canonical) return { ok: false, reason: 'frozen-root-not-canonical' }
  const indexFile = path.join(supplied, 'index.html')
  let indexSha256
  try { indexSha256 = shaFile(indexFile) } catch { return { ok: false, reason: 'frozen-index-unreadable' } }
  if (indexSha256 !== B139_INDEX_SHA) return { ok: false, reason: 'index-sha-mismatch', indexSha256 }
  return { ok: true, root: supplied, indexSha256 }
}

function certificateSpkiHash(pemPath) {
  const publicKeyPem = execFileSync('openssl', ['x509', '-in', pemPath, '-pubkey', '-noout'], { encoding: 'utf8' })
  const publicKeyDer = execFileSync('openssl', ['pkey', '-pubin', '-outform', 'der'], { input: publicKeyPem })
  return crypto.createHash('sha256').update(publicKeyDer).digest('base64')
}

function loadPlaywright() {
  for (const root of PLAYWRIGHT_ROOTS) {
    try {
      return createRequire(root)('playwright')
    } catch { /* try next reviewed worktree */ }
  }
  return null
}

function queryClass(url) {
  if (url.hash || url.username || url.password) return 'reject'
  if (!url.search) return 'none'
  return url.search === CONTENT_LOCALE_QUERY ? 'content-locale' : 'reject'
}

function classify(url, method) {
  if (url.origin === PAGE_ORIGIN) {
    if (method === 'GET' || method === 'HEAD') return { action: 'artifact', type: 'h5-static' }
    return { action: 'abort', type: 'excluded-write', reason: 'non-get-static' }
  }
  const query = queryClass(url)
  if (query === 'reject') return { action: 'abort', type: 'unexpected', reason: 'unexpected-query-or-userinfo' }
  const key = `${method} ${url.pathname}`
  if (url.origin === IAM_ORIGIN) {
    if (IAM_CONTINUE.has(key) && query === 'none') return { action: 'continue', type: url.pathname === LOGIN_PATH ? 'iam-login' : 'iam-refresh', query }
    return { action: 'abort', type: method === 'GET' || method === 'HEAD' || method === 'OPTIONS' ? 'unexpected' : 'excluded-write', reason: 'outside-home-return-allow-list' }
  }
  if (url.origin !== GATEWAY_ORIGIN) {
    return { action: 'abort', type: 'unexpected', reason: 'foreign-origin' }
  }
  if (url.pathname === LOGIN_PATH || url.pathname === REFRESH_PATH) {
    return { action: 'abort', type: 'excluded-write', reason: 'credential-route-not-on-gateway' }
  }
  if ((method === 'GET' || method === 'OPTIONS') && GATEWAY_GET.has(url.pathname)) {
    if (query === 'none' || (query === 'content-locale' && LOCALE_PATHS.has(url.pathname))) {
      const type = url.pathname === HOME_PATH ? 'gateway-learner-home'
        : url.pathname === CATALOG_PATH ? 'gateway-content-catalog'
          : url.pathname.startsWith('/api/v1/iam/') ? 'gateway-iam-read'
            : 'gateway-learner-read'
      return { action: 'continue', type, query }
    }
  }
  const write = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS'
  return { action: 'abort', type: write ? 'excluded-write' : 'unexpected', reason: write ? 'outside-home-return-allow-list' : 'unexpected-route' }
}

function safeHash(href) {
  try {
    const url = new URL(href)
    const hash = url.hash.replace(/^#/, '').split('?')[0]
    return hash.startsWith('/') ? hash : null
  } catch {
    return null
  }
}

function unwrap(value) {
  if (!isRecord(value)) return null
  if (isRecord(value.data)) return value.data
  return value
}

function projectHomeBody(raw) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return { ok: false, reason: 'home-body-unreadable' } }
  const data = unwrap(parsed)
  if (!data) return { ok: false, reason: 'home-envelope' }
  const firstDay = isRecord(data.firstDay) ? data.firstDay : null
  if (!firstDay) return { ok: false, reason: 'home-first-day-missing' }
  const tasks = Array.isArray(firstDay.tasks) ? firstDay.tasks : Array.isArray(data.tasks) ? data.tasks : []
  const blocker = typeof firstDay.blocker === 'string' && firstDay.blocker.trim() ? firstDay.blocker.trim() : null
  const plan = isRecord(firstDay.plan) ? firstDay.plan : null
  const planningInput = isRecord(firstDay.planningInput) ? firstDay.planningInput : null
  const planVersion = Number.isInteger(plan && plan.planVersion) ? plan.planVersion
    : Number.isInteger(firstDay.projectionVersion) ? firstDay.projectionVersion
      : null
  return {
    ok: true,
    state: tokenOf(firstDay.state),
    profileReady: firstDay.profileReady === true,
    targetReady: firstDay.targetReady === true,
    placementStatus: tokenOf(firstDay.placementStatus),
    blocker,
    taskCount: Number.isInteger(firstDay.taskCount) ? firstDay.taskCount : tasks.length,
    tasksLength: tasks.length,
    hasPlanningInput: Boolean(planningInput),
    hasPlan: Boolean(plan),
    planVersion,
  }
}

function projectPrincipal(raw) {
  let parsed
  try { parsed = JSON.parse(raw) } catch { return { ok: false } }
  const data = unwrap(parsed) || parsed
  const record = isRecord(data) ? data : {}
  const adult = isRecord(record.adultGate) ? record.adultGate : record
  const status = tokenOf(adult.status || adult.adultGate || record.adultGateStatus)
  const access = tokenOf(adult.learningAccess || record.learningAccess)
  const permissions = Array.isArray(record.permissions) ? record.permissions : []
  return {
    ok: true,
    serverAdultStatus: status,
    learningAccess: access,
    learningPlanRead: permissions.includes('learning.plan.read'),
  }
}

function placementFull(receipt) {
  if (!isRecord(receipt) || receipt.status !== 'OBSERVED') return null
  const expectations = isRecord(receipt.expectations) ? receipt.expectations : null
  const full = expectations && isRecord(expectations.full) ? expectations.full : null
  if (!full) return null
  if (full.planEnsureCount !== 1 || full.planEnsureStatus !== 200 || full.planEnsurePlanPresent !== true) return null
  if (full.responseCount !== 10) return null
  return full
}

function secretHits(published, secrets) {
  if (Array.isArray(secrets)) {
    for (const item of secrets) {
      if (typeof item === 'string' && item.length > 8 && published.includes(item)) return true
    }
  }
  return /[@]|eyJ|bearer|Mb336!|Mb004!|Mb318!/i.test(published)
}

function receiptPath() {
  const raw = process.env.MB405_HOME_RETURN_RECEIPT
  if (typeof raw === 'string' && raw.startsWith('/') && raw.endsWith('home-return-receipt.json')) return raw
  return path.join(PINS.runDir, 'home-return-receipt.json')
}

function writeReceipt(receipt, secrets) {
  const target = receiptPath()
  const body = { ...receipt, job: 'MB405_SAME_ACTOR_HOME_RETURN' }
  const published = JSON.stringify(body)
  const safe = secretHits(published, secrets)
    ? { job: 'MB405_SAME_ACTOR_HOME_RETURN', status: 'FAILED', reason: 'secret-in-receipt', indexSha256: B139_INDEX_SHA }
    : body
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 })
  fs.writeFileSync(target, `${JSON.stringify(safe)}\n`, { mode: 0o600 })
  return safe
}

function baseReceipt() {
  return {
    job: 'MB405_SAME_ACTOR_HOME_RETURN',
    status: 'FAILED',
    reason: null,
    launched: false,
    browserClosed: true,
    routeFulfill: false,
    storageInjection: false,
    locationAssign: false,
    retestWrites: 0,
    skipWrites: 0,
    planWrites: 0,
    indexSha256: B139_INDEX_SHA,
    origin: PAGE_ORIGIN,
    loginReturnTo: HOME_HASH,
  }
}

async function fillLogin(page, identifier, password) {
  const submit = page.getByRole('button', { name: '登录并继续' }).first()
  const submitReady = await submit.waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)
  if (!submitReady) await page.locator('.login-submit').first().waitFor({ timeout: 20000 })
  const idHost = page.locator('#mobile-login-identifier-host .uni-input-input').first()
  const pwHost = page.locator('#mobile-login-password-host .uni-input-input').first()
  const id = (await idHost.count()) ? idHost : page.locator('#mobile-login-identifier').first()
  const pw = (await pwHost.count()) ? pwHost : page.locator('#mobile-login-password').first()
  await id.fill(identifier)
  await pw.fill(password)
  if (submitReady) await submit.click()
  else await page.locator('.login-submit').first().click()
}

async function observeHomeReturn(opts, placementReceipt) {
  const receipt = baseReceipt()
  const secrets = [opts && opts.identifier, opts && opts.password].filter((item) => typeof item === 'string')
  const proven = proveB139(process.env.MB006_FULL_BROWSER_ARTIFACT || B139_H5_ROOT, process.env.MB006_FULL_BROWSER_INDEX_SHA256 || B139_INDEX_SHA)
  receipt.indexSha256 = proven.indexSha256 || B139_INDEX_SHA
  receipt.indexMatch = proven.ok === true
  if (!proven.ok) {
    receipt.reason = proven.reason
    return writeReceipt(receipt, secrets)
  }
  if (typeof opts?.caPem !== 'string' || !fs.existsSync(opts.caPem)) {
    receipt.reason = 'spki-unavailable'
    return writeReceipt(receipt, secrets)
  }
  let spki
  try { spki = certificateSpkiHash(opts.caPem) } catch {
    receipt.reason = 'spki-unavailable'
    return writeReceipt(receipt, secrets)
  }
  const playwright = loadPlaywright()
  if (!playwright) {
    receipt.reason = 'playwright-unavailable'
    return writeReceipt(receipt, secrets)
  }
  const expectedPlanVersion = placementFull(placementReceipt) ? placementFull(placementReceipt).planEnsurePlanVersion : null
  receipt.expectedPlanVersion = Number.isInteger(expectedPlanVersion) ? expectedPlanVersion : null
  const marker = crypto.randomBytes(32).toString('hex')
  let server = null
  let browser = null
  const traffic = []
  let login = { status: null, count: 0 }
  let refreshCount = 0
  let principal = { status: null, body: null }
  let home = { status: null, body: null, count: 0 }
  let extraWrites = 0
  let fulfills = 0
  const deadline = Date.now() + DEADLINE_MS
  try {
    server = await listenFrozenStatic(marker, proven.root)
    browser = await playwright.chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${spki}`],
    })
    receipt.launched = true
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      serviceWorkers: 'block',
    })
    const page = await context.newPage()
    await page.route('**/*', async (route) => {
      let url
      try { url = new URL(route.request().url()) } catch {
        await route.abort()
        return
      }
      const method = route.request().method()
      const decision = classify(url, method)
      if (decision.action === 'artifact') {
        const headers = { ...route.request().headers(), [STATIC_QA_HEADER]: marker }
        await route.continue({ headers })
        return
      }
      if (decision.action !== 'continue') {
        if (decision.type === 'excluded-write') extraWrites += 1
        traffic.push({ method, path: url.pathname, type: decision.type, disposition: 'abort', reason: decision.reason })
        await route.abort()
        return
      }
      traffic.push({ method, path: url.pathname, type: decision.type, disposition: 'continue', query: decision.query || 'none' })
      await route.continue()
    })
    page.on('response', (response) => {
      let parsed
      try { parsed = new URL(response.url()) } catch { return }
      const method = response.request().method()
      if (parsed.origin === IAM_ORIGIN && parsed.pathname === LOGIN_PATH && method === 'POST') {
        login.status = response.status()
        login.count += 1
      }
      if (parsed.origin === IAM_ORIGIN && parsed.pathname === REFRESH_PATH && method === 'POST') refreshCount += 1
      if (parsed.origin === GATEWAY_ORIGIN && parsed.pathname === '/api/v1/iam/principal/me' && method === 'GET') {
        principal.status = response.status()
        void response.text().then((text) => { principal.body = text }).catch(() => {})
      }
      if (parsed.origin === GATEWAY_ORIGIN && parsed.pathname === HOME_PATH && method === 'GET') {
        home.status = response.status()
        home.count += 1
        void response.text().then((text) => { home.body = text }).catch(() => {})
      }
    })
    const loginUrl = `${PAGE_ORIGIN}/#${LOGIN_HASH}?returnTo=${encodeURIComponent(HOME_HASH)}`
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
    const openedHash = safeHash(page.url())
    if (openedHash !== LOGIN_HASH) {
      receipt.reason = 'not-login'
      receipt.finalHash = openedHash
      return writeReceipt(receipt, secrets)
    }
    await fillLogin(page, opts.identifier, opts.password)
    const leftLogin = await page.waitForFunction(() => !location.hash.includes('/pages/login/login'), null, { timeout: 25000 }).then(() => true).catch(() => false)
    const until = Math.min(deadline, Date.now() + 20000)
    while (Date.now() < until && (home.count < 1 || !home.body || !principal.body)) {
      await page.waitForTimeout(150)
    }
    receipt.originFixed = page.url().startsWith(PAGE_ORIGIN)
    receipt.finalHash = safeHash(page.url())
    receipt.loginHttp = httpOf(login.status)
    receipt.loginCount = countOf(login.count)
    receipt.refreshPosts = countOf(refreshCount)
    receipt.principalHttp = httpOf(principal.status)
    receipt.homeHttp = httpOf(home.status)
    receipt.homeCount = countOf(home.count)
    receipt.extraWrites = countOf(extraWrites)
    receipt.fulfills = countOf(fulfills)
    receipt.leftLogin = leftLogin === true
    const principalFact = principal.body ? projectPrincipal(principal.body) : { ok: false }
    receipt.serverAdultStatus = principalFact.ok ? principalFact.serverAdultStatus : null
    receipt.learningAccess = principalFact.ok ? principalFact.learningAccess : null
    receipt.learningPlanRead = principalFact.ok ? principalFact.learningPlanRead === true : false
    const homeFact = home.body ? projectHomeBody(home.body) : { ok: false, reason: 'home-body-missing' }
    receipt.home = homeFact.ok
      ? {
        state: homeFact.state,
        profileReady: homeFact.profileReady,
        targetReady: homeFact.targetReady,
        placementStatus: homeFact.placementStatus,
        blocker: homeFact.blocker,
        taskCount: homeFact.taskCount,
        tasksLength: homeFact.tasksLength,
        hasPlanningInput: homeFact.hasPlanningInput,
        hasPlan: homeFact.hasPlan,
        planVersion: homeFact.planVersion,
        planVersionMatch: receipt.expectedPlanVersion == null ? false : homeFact.planVersion === receipt.expectedPlanVersion,
      }
      : { ok: false, reason: homeFact.reason || 'home-body-missing' }
    if (receipt.finalHash === ONBOARDING_HASH) receipt.reason = 'landed-onboarding'
    else if (receipt.finalHash !== HOME_HASH) receipt.reason = 'final-hash'
    else if (receipt.loginHttp !== 200 || receipt.loginCount !== 1) receipt.reason = 'login-http'
    else if (receipt.principalHttp !== 200) receipt.reason = 'principal-http'
    else if (receipt.learningAccess !== 'ELIGIBLE' || receipt.serverAdultStatus !== 'PASSED' || receipt.learningPlanRead !== true) {
      receipt.reason = 'learning-not-eligible'
    } else if (receipt.homeHttp !== 200 || receipt.homeCount < 1) receipt.reason = 'home-http'
    else if (!homeFact.ok) receipt.reason = homeFact.reason
    else if (homeFact.state === 'NOT_READY' && homeFact.blocker === 'PLACEMENT_REQUIRED') receipt.reason = 'placement-required'
    else if (homeFact.state !== 'READY') receipt.reason = 'home-not-ready'
    else if (homeFact.targetReady !== true) receipt.reason = 'target-not-ready'
    else if (homeFact.blocker != null) receipt.reason = 'home-blocker'
    else if (!(homeFact.taskCount >= 1) || homeFact.taskCount !== homeFact.tasksLength) receipt.reason = 'home-task-count'
    else if (homeFact.hasPlanningInput !== true || homeFact.hasPlan !== true) receipt.reason = 'home-plan-missing'
    else if (receipt.expectedPlanVersion != null && homeFact.planVersion !== receipt.expectedPlanVersion) receipt.reason = 'plan-version-mismatch'
    else if (receipt.extraWrites > 0) receipt.reason = 'extra-writes'
    else if (receipt.originFixed !== true) receipt.reason = 'origin'
    else receipt.status = 'OBSERVED'
    if (receipt.status === 'OBSERVED') receipt.reason = null
    return writeReceipt(receipt, secrets)
  } catch (error) {
    receipt.reason = Date.now() > deadline ? 'deadline' : 'observer-error'
    receipt.errorClass = error && error.code ? String(error.code).slice(0, 40) : 'observer-error'
    return writeReceipt(receipt, secrets)
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (server) await closeOwnedServer(server).catch(() => {})
  }
}

async function afterPlacementJourney(opts, placementReceipt) {
  const secrets = [opts && opts.identifier, opts && opts.password].filter((item) => typeof item === 'string')
  if (process.env.MB405_HOME_RETURN !== ARM) {
    return writeReceipt({ ...baseReceipt(), status: 'FAILED', reason: 'home-return-arm-missing' }, secrets)
  }
  if (process.env.MB006_PLACEMENT_RETEST_CONTINUATION) {
    return writeReceipt({ ...baseReceipt(), status: 'FAILED', reason: 'retest-env-forbidden' }, secrets)
  }
  const full = placementFull(placementReceipt)
  if (!full) {
    const skipped = writeReceipt({
      ...baseReceipt(),
      status: 'SKIPPED',
      reason: 'placement-journey-not-observed',
      placementStatus: isRecord(placementReceipt) ? tokenOf(placementReceipt.status) : null,
    }, secrets)
    return placementReceipt
  }
  const home = await observeHomeReturn(opts, placementReceipt)
  if (home.status !== 'OBSERVED') {
    const failed = isRecord(placementReceipt) ? { ...placementReceipt } : { status: 'FAILED' }
    failed.status = 'FAILED'
    failed.reason = `home-return-${home.reason || 'failed'}`
    failed.homeReturn = {
      status: home.status,
      reason: home.reason,
      finalHash: home.finalHash || null,
      homeState: home.home && home.home.state ? home.home.state : null,
    }
    return failed
  }
  if (isRecord(placementReceipt)) {
    return { ...placementReceipt, homeReturn: { status: home.status, reason: null, finalHash: HOME_HASH, homeState: 'READY' } }
  }
  return placementReceipt
}

if (require.main === module) {
  process.stdout.write(`${USAGE}\n`)
}

module.exports = { afterPlacementJourney, observeHomeReturn, proveB139 }
