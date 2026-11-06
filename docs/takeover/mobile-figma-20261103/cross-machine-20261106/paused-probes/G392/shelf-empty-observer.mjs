/**
 * MB009 course-shelf empty H5 observer.
 *
 * Copy for the B139 H5 lease. Receipts stay in this directory.
 * The empty-pair gate still reads the G361 wire receipts.
 * The live catalog body is accepted only when it matches that G329 empty
 * contract. This file does not listen, does not start services, and does not
 * substitute a response. Direct execution prints the gate and returns.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const JOB = '/tmp/grok-mobile-learn-shelf-rebind-runner-392'
const WIRE_DIR = '/tmp/grok-mobile-learn-catalog-preference-jar-rebind-361'
const H5_DIR = '/LOCAL_HANDOFF_HOME/supervision-root/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const H5_INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_INDEX_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const PLAYWRIGHT_ROOT = '/LOCAL_HANDOFF_HOME/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/package.json'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const STATIC_QA_HEADER = 'x-mb004-static-qa'
const LOGIN_PATH = '/api/v1/auth/login'
const LEARN_RETURN = '/pages/learn/learn'
const LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/
const SAFE_CODE = /^[A-Z0-9_]{1,64}$/
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?Z$/
const NEEDLE = 'zz-no-course'
const COPY = {
  empty: ['书架里还没有可学习的内容。', 'There is no course you can open yet.'],
  noHit: ['没有匹配的课程。', 'No course matches.'],
  error: ['课程暂时没能加载。', 'Courses did not load.'],
  denial: ['当前账号不能查看课程。', 'This account cannot view courses.'],
  unavailable: ['课程列表暂不可用。', 'The course list is unavailable.'],
}
const PREREQUISITE = 'G361 runtime-receipt.json status PASS, learnerVisiblePublished 0, probeOutcome empty, probeItemCount 0, plus G361 actual-receipt.json outcome empty, stage pair, itemCount 0, page catalog-empty, catalog itemCount 0, home contentStatus EMPTY, unrelatedWrites 0, planReads 0'

function classifyShelf(input) {
  if (input.denied) return 'denial'
  if (input.offline) return 'error'
  if (input.unavailable) return 'unavailable'
  if (input.accessibleCount <= 0) return 'catalog-empty'
  if (input.matchCount <= 0) return 'no-matches'
  return 'results'
}

function validInstant(value) {
  const match = INSTANT.exec(value)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false
  const utc = Date.UTC(year, month - 1, day)
  const back = new Date(utc)
  return back.getUTCFullYear() === year && back.getUTCMonth() === month - 1 && back.getUTCDate() === day
}

function dataOf(json) {
  const data = json && json.data
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

function homeEmptyContract(status, json) {
  if (status !== 200) return { ok: false, reason: 'status' }
  const data = dataOf(json)
  const meta = json && json.meta
  if (!data) return { ok: false, reason: 'data' }
  if (!meta || meta.source !== 'LEARNER_SERVICE' || typeof meta.stale !== 'boolean') return { ok: false, reason: 'meta' }
  const firstDay = data.firstDay
  if (!firstDay || typeof firstDay !== 'object' || Array.isArray(firstDay)) return { ok: false, reason: 'firstDay' }
  if (!Array.isArray(data.tasks) || !Array.isArray(firstDay.tasks)) return { ok: false, reason: 'tasks' }
  if (data.tasks.length !== firstDay.tasks.length) return { ok: false, reason: 'tasks' }
  if (typeof firstDay.taskCount !== 'number' || firstDay.taskCount !== firstDay.tasks.length) return { ok: false, reason: 'taskCount' }
  if (typeof data.projectionVersion !== 'number' || !Number.isSafeInteger(data.projectionVersion)) return { ok: false, reason: 'projection' }
  if (typeof data.contentEpoch !== 'number' || !Number.isSafeInteger(data.contentEpoch)) return { ok: false, reason: 'epoch' }
  if (!validInstant(data.generatedAt) || !validInstant(firstDay.generatedAt)) return { ok: false, reason: 'generatedAt' }
  if (typeof firstDay.state !== 'string' || !SAFE_CODE.test(firstDay.state)) return { ok: false, reason: 'state' }
  const blocker = firstDay.blocker
  if (!(blocker === null || blocker === undefined || (typeof blocker === 'string' && SAFE_CODE.test(blocker)))) {
    return { ok: false, reason: 'blocker' }
  }
  if (data.contentStatus === 'UNAVAILABLE') return { ok: false, reason: 'unavailable' }
  return { ok: true, reason: null, taskCount: data.tasks.length }
}

function catalogEmptyContract(status, json, locale) {
  if (status !== 200) return { ok: false, reason: 'status' }
  if (json && Array.isArray(json.data)) return { ok: false, reason: 'data-array' }
  const data = dataOf(json)
  const meta = json && json.meta
  if (!data || !meta) return { ok: false, reason: 'data' }
  if (meta.source !== 'CONTENT_SERVICE' || typeof meta.stale !== 'boolean') return { ok: false, reason: 'meta' }
  if (!Array.isArray(data.items)) return { ok: false, reason: 'items' }
  if (data.items.length !== 0) return { ok: false, reason: 'items-present' }
  if (typeof data.contentEpoch !== 'number' || !Number.isSafeInteger(data.contentEpoch) || data.contentEpoch < 1) {
    return { ok: false, reason: 'epoch' }
  }
  if (typeof data.projectionVersion !== 'number' || !Number.isSafeInteger(data.projectionVersion) || data.projectionVersion < 1) {
    return { ok: false, reason: 'projection' }
  }
  if (locale && data.items.some((item) => item && item.contentLocale !== locale)) return { ok: false, reason: 'locale' }
  return { ok: true, reason: null, itemCount: 0 }
}

function keysOf(url) {
  return [...url.searchParams.keys()]
}

function oneLocale(url) {
  const keys = keysOf(url)
  if (keys.length !== 1 || keys[0] !== 'contentLocale') return null
  const value = url.searchParams.get('contentLocale')
  return LOCALE.test(value || '') ? value : null
}

function classifyRequest(url, method) {
  const closed = { action: 'abort', kind: 'closed', type: 'closed', counter: 'closed' }
  if (url.origin === PAGE_ORIGIN && (method === 'GET' || method === 'HEAD')) {
    return { action: 'continue', kind: 'page', type: 'static', counter: 'static' }
  }
  if (url.origin === IAM_ORIGIN && url.pathname === LOGIN_PATH && (method === 'POST' || method === 'OPTIONS')) {
    return { action: 'continue', kind: method === 'POST' ? 'login' : 'options', type: 'login', counter: method === 'POST' ? 'loginPost' : 'loginOptions' }
  }
  if (url.origin !== GATEWAY_ORIGIN) return closed
  const pathName = url.pathname
  const read = (type, queryClass) => ({ action: 'continue', kind: method === 'OPTIONS' ? 'options' : 'read', type, counter: method === 'GET' ? type : 'options', queryClass })
  if (method !== 'GET' && method !== 'OPTIONS') return { ...closed, type: 'mutation' }
  if (pathName === '/api/v1/iam/principal/me' && url.search === '') return read('principal', 'none')
  if (pathName === '/api/v1/learner/profile' && url.search === '') return read('profile', 'none')
  if (pathName === '/api/v1/learner/targets' && url.search === '') return read('targets', 'none')
  if (pathName === '/api/v1/learner/preferences' && url.search === '') return read('preferences', 'none')
  if (pathName === '/api/v1/learner/home' && oneLocale(url)) return read('home', 'contentLocale')
  if (pathName === '/api/v1/content/learner/catalog' && oneLocale(url)) return read('catalog', 'contentLocale')
  if (pathName === '/api/v1/learning/today' && url.search === '') return read('today', 'none')
  if (pathName === '/api/v1/learning/review-queue') {
    const keys = keysOf(url).sort().join(',')
    if (keys === 'contentLocale,limit' && url.searchParams.get('limit') === '20' && LOCALE.test(url.searchParams.get('contentLocale') || '')) {
      return read('review', 'limit-20')
    }
  }
  return closed
}

function regularFile(file) {
  try {
    const listed = fs.lstatSync(file)
    if (!listed.isFile() || listed.isSymbolicLink()) return null
    const real = fs.realpathSync(file)
    const stated = fs.lstatSync(real)
    if (!stated.isFile() || stated.isSymbolicLink()) return null
    return real
  } catch {
    return null
  }
}

function wireRoot() {
  try {
    const real = fs.realpathSync(WIRE_DIR)
    const parent = path.dirname(real)
    if (path.basename(real) !== path.basename(WIRE_DIR)) return null
    if (parent !== '/tmp' && parent !== '/private/tmp') return null
    return real
  } catch {
    return null
  }
}

function readJsonFile(file, root) {
  const real = regularFile(file)
  if (!real || path.dirname(real) !== root) return null
  try {
    return JSON.parse(fs.readFileSync(real, 'utf8'))
  } catch {
    return null
  }
}

function readWireGate() {
  const root = wireRoot()
  const missing = {
    ok: false,
    reason: 'g329-contract-unresolved',
    prerequisite: PREREQUISITE,
    learnerVisiblePublished: null,
    contentLocale: null,
  }
  if (!root) return missing
  const runtime = readJsonFile(path.join(root, 'runtime-receipt.json'), root)
  const probe = readJsonFile(path.join(root, 'actual-receipt.json'), root)
  if (!runtime || !probe) return missing
  if (typeof runtime.learnerVisiblePublished === 'number' && runtime.learnerVisiblePublished !== 0) {
    return { ...missing, reason: 'published-count-not-zero', learnerVisiblePublished: runtime.learnerVisiblePublished }
  }
  const runtimeOk = runtime.kind === 'MB009_LEARN_CATALOG_RUNTIME_361'
    && runtime.status === 'PASS'
    && runtime.preflightOnly === false
    && runtime.h5Started === false
    && runtime.publication === 'skipped'
    && runtime.runnerBusinessInserts === 0
    && runtime.learnerVisiblePublished === 0
    && runtime.probeStatus === 'OBSERVED'
    && runtime.probeOutcome === 'empty'
    && runtime.probeItemCount === 0
    && typeof runtime.contentLocale === 'string'
    && LOCALE.test(runtime.contentLocale)
  const page = probe.page && typeof probe.page === 'object' ? probe.page : null
  const catalog = probe.catalog && typeof probe.catalog === 'object' ? probe.catalog : null
  const home = probe.home && typeof probe.home === 'object' ? probe.home : null
  const probeOk = probe.pass === true
    && probe.outcome === 'empty'
    && probe.stage === 'pair'
    && probe.itemCount === 0
    && probe.unrelatedWrites === 0
    && probe.planReads === 0
    && probe.gatewayLogin === true
    && probe.contentLocale === runtime.contentLocale
    && page && page.page === 'catalog-empty' && page.accessible === 0 && page.contentStatus === 'EMPTY'
    && catalog && catalog.itemCount === 0 && Array.isArray(catalog.cards) && catalog.cards.length === 0 && catalog.shape !== false
    && home && home.contentStatus === 'EMPTY'
    && probe.b326 && probe.b326.applied === false && probe.b326.planQueueRead === false
  if (!runtimeOk || !probeOk) return missing
  return { ok: true, reason: null, prerequisite: PREREQUISITE, learnerVisiblePublished: 0, contentLocale: runtime.contentLocale }
}

function acceptable(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max && !/[\u0000-\u001F\u007F\s]/.test(value)
}

function argvCarries(secret) {
  return typeof secret === 'string' && secret.length > 0 && process.argv.some((arg) => typeof arg === 'string' && arg.includes(secret))
}

function publicCertPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null
  if (!path.isAbsolute(value) || value.includes('\0') || /[\r\n]/.test(value)) return null
  const base = path.basename(value).toLowerCase()
  if (base.includes('key') || base.includes('priv') || base.endsWith('.p12') || base.endsWith('.pfx')) return null
  if (!base.endsWith('.pem') && !base.endsWith('.crt') && !base.endsWith('.cer')) return null
  const real = regularFile(value)
  if (!real) return null
  const parent = path.dirname(real)
  if (parent !== '/tmp' && !parent.startsWith('/tmp/') && parent !== '/private/tmp' && !parent.startsWith('/private/tmp/')) return null
  return real
}

function certificateSpki(pemPath) {
  const pem = fs.readFileSync(pemPath)
  const cert = new crypto.X509Certificate(pem)
  const der = cert.publicKey.export({ type: 'spki', format: 'der' })
  const spki = crypto.createHash('sha256').update(der).digest('base64')
  if (!/^[A-Za-z0-9+/]+=*$/.test(spki) || spki.length > 128) throw new Error('spki-shape')
  return spki
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function subjectOf(data) {
  if (!data || typeof data !== 'object') return ''
  const principal = data.principal && typeof data.principal === 'object' ? data.principal : data
  const found = principal.subject || principal.sub || principal.principalId || ''
  return typeof found === 'string' ? found : ''
}

function principalAgrees(json, subject) {
  const data = json && json.data
  if (!data || typeof data !== 'object') return false
  const gate = data.adultGate
  const consent = data.consentState
  const roles = Array.isArray(data.roles) ? data.roles : []
  const permissions = Array.isArray(data.permissions) ? data.permissions : []
  return data.status === 'ACTIVE'
    && data.tenantId === 'platform'
    && data.authMode === 'self-owned-jwt'
    && data.policyVersion === 'b30-rbac-v1'
    && subjectOf(data) === subject
    && roles.includes('learner')
    && permissions.includes('content.read')
    && gate && gate.status === 'PASSED' && gate.learningAccess === 'ELIGIBLE'
    && consent && consent.accepted === true && consent.learningAccess === 'ELIGIBLE'
}

function blankCounts() {
  return {
    loginPost: 0,
    loginOptions: 0,
    principal: 0,
    profile: 0,
    targets: 0,
    preferences: 0,
    home: 0,
    catalog: 0,
    today: 0,
    review: 0,
    static: 0,
    options: 0,
    closed: 0,
    mutation: 0,
    missingAuthorization: 0,
  }
}

function stagedReceipt(gate) {
  return {
    status: 'STAGED',
    reason: gate.reason,
    prerequisite: gate.prerequisite,
    shelfEmptyReady: false,
    launched: false,
    observed: false,
    outcome: null,
    indexPin: 'integrated',
    indexSha: H5_INDEX_SHA,
    learnerVisiblePublished: gate.learnerVisiblePublished,
    emptyStaysEmpty: null,
    noHitOnEmpty: null,
    passwordOmitted: true,
    nonceValueOmitted: true,
    subjectOmitted: true,
    identifierOmitted: true,
    valueOmitted: true,
  }
}

function leaked(text, secrets) {
  if (text.includes('Bearer ') || /eyJ[A-Za-z0-9_-]{8,}/.test(text)) return true
  if (COPY.empty.concat(COPY.noHit, COPY.error, COPY.denial, COPY.unavailable).some((line) => text.includes(line))) return true
  return secrets.some((secret) => typeof secret === 'string' && secret.length >= 8 && text.includes(secret))
}

function writeReceipt(payload, secrets) {
  let text = `${JSON.stringify(payload, null, 2)}\n`
  if (leaked(text, secrets)) {
    text = `${JSON.stringify({ status: 'BLOCKED', reason: 'receipt-secret', shelfEmptyReady: false, launched: payload.launched === true, passwordOmitted: true, nonceValueOmitted: true, subjectOmitted: true, identifierOmitted: true, valueOmitted: true }, null, 2)}\n`
  }
  const realJob = wireStyleJob()
  if (!realJob) return
  const target = path.join(realJob, 'shelf-receipt.json')
  fs.writeFileSync(target, text, { mode: 0o600 })
  fs.chmodSync(target, 0o600)
}

function wireStyleJob() {
  try {
    const real = fs.realpathSync(JOB)
    const parent = path.dirname(real)
    if (path.basename(real) !== path.basename(JOB)) return null
    if (parent !== '/tmp' && parent !== '/private/tmp') return null
    return real
  } catch {
    return null
  }
}

function hasAuthorization(request) {
  const value = String((request.headers() || {}).authorization || '')
  return value.startsWith('Bearer ') && value.length > 'Bearer '.length
}

function loadChromium() {
  try {
    const playwright = createRequire(PLAYWRIGHT_ROOT)('playwright')
    if (playwright && playwright.chromium) return playwright.chromium
  } catch {
    return null
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

async function fillHost(page, hostId, bareId, value) {
  const host = page.locator(`#${hostId} .uni-input-input`).first()
  const field = (await host.count()) ? host : page.locator(`#${bareId}`).first()
  await field.fill(value)
}

async function readShelf(page) {
  return page.evaluate((copy) => {
    const shell = document.querySelector('#learn-shell')
    if (!shell) return { present: false }
    const text = shell.innerText || ''
    return {
      present: true,
      surface: shell.getAttribute('data-learn-surface'),
      shelfState: shell.getAttribute('data-shelf-state'),
      empty: copy.empty.some((line) => text.includes(line)),
      noHit: copy.noHit.some((line) => text.includes(line)),
      error: copy.error.some((line) => text.includes(line)),
      denial: copy.denial.some((line) => text.includes(line)),
      unavailable: copy.unavailable.some((line) => text.includes(line)),
    }
  }, COPY)
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

function prepareLease(input, gate) {
  const source = input && typeof input === 'object' ? input : null
  if (!source || source.ownedLease !== true) return { ok: false, reason: 'live-lease-required' }
  const caPem = publicCertPath(source.caPem)
  if (!caPem) return { ok: false, reason: 'tls-path' }
  if (typeof source.staticNonce !== 'string' || !/^[0-9a-f]{64}$/.test(source.staticNonce)) return { ok: false, reason: 'nonce' }
  const approved = source.approved && typeof source.approved === 'object' ? source.approved : null
  if (!approved || !acceptable(approved.identifier, 3, 128) || !acceptable(approved.password, 12, 128) || !acceptable(approved.subject, 3, 128)) {
    return { ok: false, reason: 'actor' }
  }
  if (argvCarries(approved.identifier) || argvCarries(approved.password) || argvCarries(approved.subject) || argvCarries(source.staticNonce)) {
    return { ok: false, reason: 'argv-secret' }
  }
  const index = regularFile(path.join(H5_DIR, 'index.html'))
  if (!index || sha256File(index) !== H5_INDEX_SHA || H5_INDEX_SHA === B116_INDEX_SHA) return { ok: false, reason: 'h5-index-mismatch' }
  let spki = ''
  try { spki = certificateSpki(caPem) } catch { return { ok: false, reason: 'tls-spki' } }
  return {
    ok: true,
    caPem,
    nonce: source.staticNonce,
    identifier: approved.identifier,
    password: approved.password,
    subject: approved.subject,
    spki,
    contentLocale: gate.contentLocale,
  }
}

async function observeShelfEmpty(input) {
  const gate = readWireGate()
  if (!gate.ok) {
    const receipt = stagedReceipt(gate)
    writeReceipt(receipt, [])
    return receipt
  }
  const ready = prepareLease(input, gate)
  if (!ready.ok) {
    const receipt = { ...stagedReceipt({ ...gate, reason: ready.reason }), status: 'BLOCKED' }
    writeReceipt(receipt, [])
    return receipt
  }
  const secrets = [ready.password, ready.identifier, ready.subject, ready.nonce, ready.spki]
  const state = {
    counts: blankCounts(),
    loginStatus: null,
    principalOk: null,
    home: null,
    catalog: null,
    locales: [],
    indexMatch: null,
    indexChecked: false,
    denialStatus: false,
    todayAfterDenial: false,
    infra: null,
  }
  const phase = { allowLogin: false, stop: false }
  const chromium = loadChromium()
  if (!chromium) {
    const receipt = { ...stagedReceipt(gate), status: 'BLOCKED', reason: 'playwright-unavailable' }
    writeReceipt(receipt, secrets)
    return receipt
  }
  let browser = null
  try {
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      ignoreHTTPSErrors: false,
      env: browserEnv(),
      args: [
        `--ignore-certificate-errors-spki-list=${ready.spki}`,
        '--no-proxy-server',
        '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
      ],
    })
    const context = await browser.newContext({ ignoreHTTPSErrors: false })
    const page = await context.newPage()
    page.setDefaultTimeout(20_000)
    await context.route('**/*', async (route) => {
      const request = route.request()
      let url
      try { url = new URL(request.url()) } catch {
        await route.abort().catch(() => {})
        return
      }
      const method = request.method()
      try {
        const decision = classifyRequest(url, method)
        if (decision.action !== 'continue') {
          state.counts[decision.type === 'mutation' ? 'mutation' : 'closed'] += 1
          await route.abort()
          return
        }
        if (decision.kind === 'page') {
          state.counts.static += 1
          const headers = { ...request.headers(), [STATIC_QA_HEADER]: ready.nonce }
          await route.continue({ headers })
          return
        }
        if (decision.kind === 'login' && !phase.allowLogin) {
          state.counts.closed += 1
          await route.abort()
          return
        }
        if (decision.kind === 'login') state.counts.loginPost += 1
        if (decision.kind === 'options') state.counts.loginOptions += method === 'OPTIONS' && url.origin === IAM_ORIGIN ? 1 : 0
        if (decision.kind === 'read') {
          if (!hasAuthorization(request)) {
            state.counts.missingAuthorization += 1
            await route.abort()
            return
          }
          state.counts[decision.type] += 1
          if (decision.type === 'home' || decision.type === 'catalog') {
            const locale = oneLocale(url)
            if (locale) state.locales.push(locale)
          }
          if (state.denialStatus && decision.type === 'today') state.todayAfterDenial = true
        }
        if (decision.kind === 'options' && decision.type !== 'login') state.counts.options += 1
        await route.continue()
      } catch {
        await route.abort().catch(() => {})
      }
    })
    page.on('response', (response) => {
      void (async () => {
        try {
          const url = new URL(response.url())
          const method = response.request().method()
          const status = response.status()
          if (url.origin === PAGE_ORIGIN && (url.pathname === '/' || url.pathname === '/index.html') && method === 'GET') {
            const matched = status === 200 && crypto.createHash('sha256').update(await response.body()).digest('hex') === H5_INDEX_SHA
            state.indexChecked = true
            state.indexMatch = matched
            return
          }
          if (method !== 'GET' && !(method === 'POST' && url.pathname === LOGIN_PATH)) return
          if (method === 'POST' && url.origin === IAM_ORIGIN && url.pathname === LOGIN_PATH) {
            state.loginStatus = status
            return
          }
          if (url.origin !== GATEWAY_ORIGIN || status === 0) return
          if (status === 401 || status === 403) state.denialStatus = true
          const raw = await response.body()
          if (raw.length > 65536) {
            if (url.pathname === '/api/v1/learner/home') state.home = { ok: false, reason: 'truncated' }
            if (url.pathname === '/api/v1/content/learner/catalog') state.catalog = { ok: false, reason: 'truncated' }
            return
          }
          const json = JSON.parse(raw.toString('utf8'))
          if (url.pathname === '/api/v1/iam/principal/me') {
            const agreed = status === 200 && principalAgrees(json, ready.subject)
            state.principalOk = state.principalOk === null ? agreed : state.principalOk === true && agreed
            return
          }
          if (url.pathname === '/api/v1/learner/home') {
            const next = homeEmptyContract(status, json)
            if (!state.home || state.home.ok === true) state.home = next
            return
          }
          if (url.pathname === '/api/v1/content/learner/catalog') {
            const next = catalogEmptyContract(status, json, ready.contentLocale)
            if (!state.catalog || state.catalog.ok === true) state.catalog = next
          }
        } catch { /* keep the last safe classification */ }
      })()
    })
    page.on('requestfailed', (request) => {
      try {
        const url = new URL(request.url())
        const text = request.failure() && request.failure().errorText
        if (typeof text !== 'string') return
        if (/ERR_CERT|CERT_|SSL/.test(text) && url.origin === IAM_ORIGIN) state.infra = 'tls-rejected'
        else if (/ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET/.test(text)) {
          if (url.origin === IAM_ORIGIN) state.infra = 'iam-unavailable'
          else if (url.origin === GATEWAY_ORIGIN) state.infra = 'gateway-unavailable'
          else if (url.origin === PAGE_ORIGIN) state.infra = 'h5-unavailable'
        }
      } catch { /* keep the last safe infra mark */ }
    })
    const loginUrl = `${PAGE_ORIGIN}/#/pages/login/login?returnTo=${encodeURIComponent(LEARN_RETURN)}`
    try {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    } catch {
      return finish(state, gate, secrets, 'BLOCKED', state.infra || 'h5-unavailable', null)
    }
    const indexed = await waitFor(() => state.indexChecked === true, 10_000)
    if (!indexed || state.indexMatch !== true) return finish(state, gate, secrets, 'BLOCKED', 'h5-index-mismatch', null)
    const form = await page.locator('.login-submit').first().waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
    if (!form) return finish(state, gate, secrets, 'BLOCKED', 'login-missing', null)
    phase.allowLogin = true
    await fillHost(page, 'mobile-login-identifier-host', 'mobile-login-identifier', ready.identifier)
    await fillHost(page, 'mobile-login-password-host', 'mobile-login-password', ready.password)
    await page.locator('.login-submit').first().click()
    const loggedIn = await waitFor(() => state.loginStatus != null, 20_000)
    phase.allowLogin = false
    if (!loggedIn || state.loginStatus !== 200 || state.counts.loginPost !== 1) {
      return finish(state, gate, secrets, 'FAILED', 'login', null)
    }
    const settled = await waitFor(async () => {
      if (!(state.home && state.home.ok && state.catalog && state.catalog.ok && state.principalOk === true)) return false
      const visible = await readShelf(page)
      return Boolean(visible && visible.present && visible.surface === 'shelf' && visible.shelfState === 'catalog-empty' && visible.empty === true)
    }, 20_000)
    if (!settled) {
      const visible = await readShelf(page).catch(() => null)
      return finish(state, gate, secrets, 'FAILED', outcomeFor(state, visible), visible)
    }
    const beforeCatalog = state.counts.catalog
    const search = page.locator('[data-learn-query] .uni-input-input').first()
    const searchField = (await search.count()) ? search : page.locator('[data-learn-query]').first()
    await searchField.fill(NEEDLE)
    await sleep(300)
    const after = await readShelf(page)
    const noExtraCatalog = state.counts.catalog === beforeCatalog
    const stays = Boolean(after && after.shelfState === 'catalog-empty' && after.empty === true && after.noHit === false && after.error === false && after.denial === false && after.unavailable === false)
    if (!noExtraCatalog) return finish(state, gate, secrets, 'FAILED', 'extra-catalog', after)
    if (!stays) return finish(state, gate, secrets, 'FAILED', after && after.noHit ? 'no-hit-on-empty' : outcomeFor(state, after), after)
    return finish(state, gate, secrets, 'OBSERVED', 'empty', after)
  } catch (error) {
    return finish(state, gate, secrets, 'FAILED', state.infra || 'observer', null, error)
  } finally {
    phase.stop = true
    if (browser) await browser.close().catch(() => {})
  }
}

function outcomeFor(state, visible) {
  if (state.infra) return state.infra
  if (state.denialStatus || (visible && visible.denial)) return 'denial'
  if (state.todayAfterDenial) return 'queue-after-denial'
  if (visible && visible.unavailable) return 'unavailable'
  if (visible && visible.error) return 'error'
  if (visible && visible.noHit) return 'no-hit-on-empty'
  if (state.catalog && state.catalog.reason === 'items-present') return 'not-empty'
  if ((state.home && state.home.ok === false) || (state.catalog && state.catalog.ok === false)) return 'contract-unresolved'
  if (!visible || visible.present !== true) return 'shell-unreadable'
  return 'visible-mismatch'
}

function finish(state, gate, secrets, status, reason, visible) {
  const locales = [...new Set(state.locales)]
  const localeOk = locales.length === 1 && locales[0] === gate.contentLocale
  const pairOk = state.counts.home >= 1 && state.counts.catalog >= 1 && state.counts.home === state.counts.catalog
  const writesClear = state.counts.mutation === 0 && state.counts.closed === 0 && state.counts.missingAuthorization === 0 && state.counts.loginPost === 1
  const positive = status === 'OBSERVED'
    && reason === 'empty'
    && state.home && state.home.ok === true
    && state.catalog && state.catalog.ok === true && state.catalog.itemCount === 0
    && state.principalOk === true
    && localeOk
    && pairOk
    && writesClear
    && state.todayAfterDenial === false
    && state.denialStatus === false
    && visible && visible.shelfState === 'catalog-empty' && visible.empty === true && visible.noHit === false && visible.error === false
  let finalReason = reason
  if (!positive && reason === 'empty') {
    if (state.counts.mutation > 0) finalReason = 'mutation'
    else if (state.counts.closed > 0) finalReason = 'closed-call'
    else if (state.counts.missingAuthorization > 0) finalReason = 'missing-authorization'
    else if (!localeOk) finalReason = 'locale-drift'
    else if (!pairOk) finalReason = 'pair-split'
    else if (state.todayAfterDenial) finalReason = 'queue-after-denial'
    else finalReason = 'visible-mismatch'
  }
  const receipt = {
    status: positive ? 'OBSERVED' : (status === 'BLOCKED' ? 'BLOCKED' : 'FAILED'),
    reason: positive ? 'empty' : finalReason,
    prerequisite: gate.prerequisite,
    shelfEmptyReady: positive,
    launched: true,
    observed: positive,
    outcome: positive ? 'empty' : finalReason,
    indexPin: 'pinned',
    indexSha: H5_INDEX_SHA,
    indexMatch: state.indexMatch === true,
    learnerVisiblePublished: 0,
    contentLocale: gate.contentLocale,
    loginStatus: state.loginStatus,
    principalOk: state.principalOk === true,
    homeContract: state.home ? state.home.ok === true : false,
    homeReason: state.home ? state.home.reason : null,
    catalogContract: state.catalog ? state.catalog.ok === true : false,
    catalogReason: state.catalog ? state.catalog.reason : null,
    catalogItemCount: state.catalog && state.catalog.ok ? 0 : null,
    localeOk,
    pairOk,
    emptyStaysEmpty: positive,
    noHitOnEmpty: reason === 'no-hit-on-empty',
    shelfState: visible && visible.shelfState ? visible.shelfState : null,
    counts: state.counts,
    passwordOmitted: true,
    nonceValueOmitted: true,
    subjectOmitted: true,
    identifierOmitted: true,
    valueOmitted: true,
  }
  writeReceipt(receipt, secrets)
  readyClear(secrets)
  return receipt
}

function readyClear(secrets) {
  for (let index = 0; index < secrets.length; index += 1) secrets[index] = ''
}

function selfCheck() {
  const failed = []
  const expect = (name, value) => { if (!value) failed.push(name) }
  expect('empty', classifyShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 0, matchCount: 0 }) === 'catalog-empty')
  expect('empty-query', classifyShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 0, matchCount: 0 }) === 'catalog-empty')
  expect('no-hit', classifyShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 2, matchCount: 0 }) === 'no-matches')
  expect('results', classifyShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 2, matchCount: 1 }) === 'results')
  expect('denial', classifyShelf({ denied: true, offline: true, unavailable: false, accessibleCount: 0, matchCount: 0 }) === 'denial')
  expect('offline', classifyShelf({ denied: false, offline: true, unavailable: false, accessibleCount: 0, matchCount: 0 }) === 'error')
  expect('unavailable', classifyShelf({ denied: false, offline: false, unavailable: true, accessibleCount: 0, matchCount: 0 }) === 'unavailable')
  const home = {
    data: {
      firstDay: { tasks: [], taskCount: 0, state: 'NOT_READY', blocker: null, generatedAt: '2026-11-06T00:00:00Z' },
      tasks: [],
      projectionVersion: 1,
      contentEpoch: 1,
      generatedAt: '2026-11-06T00:00:00Z',
    },
    meta: { source: 'LEARNER_SERVICE', stale: false },
  }
  const catalog = { data: { items: [], contentEpoch: 1, projectionVersion: 1 }, meta: { source: 'CONTENT_SERVICE', stale: false } }
  expect('home-ok', homeEmptyContract(200, home).ok === true)
  expect('home-unavailable', homeEmptyContract(200, { ...home, data: { ...home.data, contentStatus: 'UNAVAILABLE' } }).reason === 'unavailable')
  expect('catalog-ok', catalogEmptyContract(200, catalog, 'en-US').ok === true)
  expect('catalog-array', catalogEmptyContract(200, { data: [] }, 'en-US').reason === 'data-array')
  expect('catalog-items', catalogEmptyContract(200, { data: { items: [{ contentCode: 'c' }], contentEpoch: 1, projectionVersion: 1 }, meta: catalog.meta }, 'en-US').reason === 'items-present')
  const catalogUrl = new URL('http://127.0.0.1:18070/api/v1/content/learner/catalog?contentLocale=en-US')
  const searchUrl = new URL('http://127.0.0.1:18070/api/v1/content/learner/catalog?contentLocale=en-US&q=zz')
  const purchase = new URL('http://127.0.0.1:18070/api/v1/commerce/orders')
  const replan = new URL('http://127.0.0.1:18070/api/v1/learning/plans:replan')
  expect('allow-catalog', classifyRequest(catalogUrl, 'GET').type === 'catalog')
  expect('reject-search', classifyRequest(searchUrl, 'GET').action === 'abort')
  expect('reject-purchase', classifyRequest(purchase, 'POST').type === 'mutation')
  expect('reject-replan', classifyRequest(replan, 'POST').type === 'mutation')
  expect('pin', H5_INDEX_SHA !== B116_INDEX_SHA && H5_INDEX_SHA.length === 64)
  return { ok: failed.length === 0, failed }
}

export {
  observeShelfEmpty,
  readWireGate,
  classifyShelf,
  catalogEmptyContract,
  homeEmptyContract,
  classifyRequest,
  selfCheck,
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
  const check = selfCheck()
  if (!check.ok) {
    process.stdout.write(`${JSON.stringify({ status: 'SELF_CHECK', ok: false, failed: check.failed })}\n`)
    process.exitCode = 2
  } else {
    const gate = readWireGate()
    const line = gate.ok
      ? { status: 'USAGE', shelfEmptyReady: false, launched: false, reason: 'call-observeShelfEmpty' }
      : { status: 'STAGED', reason: gate.reason, prerequisite: gate.prerequisite, shelfEmptyReady: false, launched: false, learnerVisiblePublished: gate.learnerVisiblePublished }
    process.stdout.write(`${JSON.stringify(line)}\n`)
  }
}
