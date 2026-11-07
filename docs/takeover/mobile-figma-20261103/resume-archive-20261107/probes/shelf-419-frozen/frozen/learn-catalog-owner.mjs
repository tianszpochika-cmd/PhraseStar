/**
 * MB009 catalog shelf owner wire.
 *
 * Reads one already approved synthetic actor through the fixed loopback
 * Gateway, takes contentLocale from the live preference GET (alias 0 is
 * valid), then reads GET /api/v1/learner/home and
 * GET /api/v1/content/learner/catalog. No catalog fixture is substituted.
 * Root starts the B126 owner runtime and invokes this file. This file does
 * not start services, publish content, or write a preference.
 */
import { randomBytes } from 'node:crypto'
import { chmodSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = '/tmp/grok-mobile-learn-catalog-real-owner-probe-329'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const GATEWAY_HOST = '127.0.0.1'
const GATEWAY_PORT = 18070
const LOCALE = /^[a-z]{2,3}-[A-Z]{2,3}$/
const SAFE_CODE = /^[A-Z0-9_]{1,64}$/
const INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,9})?Z$/

const secrets = new Set()
const counts = { get: 0, post: 0, other: 0 }

function remember(value) {
  if (typeof value === 'string' && value.length > 0) secrets.add(value)
}

function forgetSecrets() {
  secrets.clear()
}

function fail(outcome, stage, extra = {}) {
  const error = new Error(outcome)
  error.outcome = outcome
  error.stage = stage
  error.extra = extra
  throw error
}

function assertOwned() {
  const root = realpathSync(OUT_DIR)
  const parent = path.dirname(root)
  if (path.basename(root) !== path.basename(OUT_DIR) || (parent !== '/tmp' && parent !== '/private/tmp')) {
    fail('intake', 'path')
  }
  const self = realpathSync(fileURLToPath(import.meta.url))
  if (self !== path.join(root, 'learn-catalog-owner.mjs')) fail('intake', 'path')
  return root
}

function intake() {
  if (process.argv.length > 2) fail('intake', 'argv')
  const origin = process.env.LC_OWNER_GATEWAY_ORIGIN
  if (origin !== undefined && origin !== GATEWAY_ORIGIN) fail('intake', 'gateway')
  const token = process.env.LC_OWNER_ACCESS_TOKEN
  if (token !== undefined) {
    delete process.env.LC_OWNER_ACCESS_TOKEN
    if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
      fail('intake', 'token')
    }
    remember(token)
    return { token, login: false }
  }
  const file = process.env.MB014_CREDENTIAL_FILE
  if (typeof file !== 'string' || file.length === 0) fail('intake', 'actor')
  return { token: '', login: true, credentialFile: file }
}

function readCredential(file) {
  if (typeof file !== 'string' || !file.startsWith('/') || file.includes('\0')) fail('intake', 'credential-file')
  let listed
  try { listed = lstatSync(file) } catch { fail('intake', 'credential-file') }
  if (listed.isSymbolicLink() || !listed.isFile()) fail('intake', 'credential-file')
  if ((listed.mode & 0o077) !== 0 || listed.size < 16 || listed.size > 4096) fail('intake', 'credential-file')
  let real
  try { real = realpathSync(file) } catch { fail('intake', 'credential-file') }
  if (real !== file) fail('intake', 'credential-file')
  let parsed
  try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { fail('intake', 'credential-file') }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail('intake', 'credential-file')
  const keys = Object.keys(parsed).sort()
  if (keys.length !== 2 || keys[0] !== 'identifier' || keys[1] !== 'password') fail('intake', 'credential-file')
  const { identifier, password } = parsed
  if (typeof identifier !== 'string' || identifier.length < 3 || identifier.length > 254 || /[\r\n\0]/.test(identifier)) {
    fail('intake', 'credential-file')
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 256 || /[\r\n\0]/.test(password)) {
    fail('intake', 'credential-file')
  }
  remember(identifier)
  remember(password)
  return { identifier, password }
}

function send({ method, requestPath, token, body, caseId }) {
  const queryAt = requestPath.indexOf('?')
  const pathname = queryAt < 0 ? requestPath : requestPath.slice(0, queryAt)
  const query = queryAt < 0 ? '' : requestPath.slice(queryAt + 1)
  const paired = pathname === '/api/v1/learner/home' || pathname === '/api/v1/content/learner/catalog'
  if (paired) {
    if (!/^contentLocale=[a-z]{2,3}-[A-Z]{2,3}$/.test(query)) fail('route', caseId)
  } else if (query !== '') {
    fail('route', caseId)
  }
  const allowed = new Set([
    'POST /api/v1/auth/login',
    'GET /api/v1/iam/principal/me',
    'GET /api/v1/learner/preferences',
    'GET /api/v1/learner/home',
    'GET /api/v1/content/learner/catalog',
  ])
  if (!allowed.has(`${method} ${pathname}`)) fail('route', caseId)
  if (method === 'GET') counts.get += 1
  else if (method === 'POST') counts.post += 1
  else {
    counts.other += 1
    fail('route', caseId)
  }
  if (counts.post > 1 || counts.other > 0) fail('route', caseId)
  const payload = body === undefined ? null : Buffer.from(body)
  const headers = {
    Accept: 'application/json',
    Connection: 'close',
    'User-Agent': 'mb009-learn-catalog-owner/1',
  }
  if (token) headers.Authorization = `Bearer ${token}`
  if (payload) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(payload.length)
    headers['Idempotency-Key'] = `lc329-${randomBytes(16).toString('hex')}`
  }
  return new Promise((resolve) => {
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      resolve(value)
    }
    const req = http.request({
      host: GATEWAY_HOST,
      port: GATEWAY_PORT,
      family: 4,
      method,
      path: requestPath,
      headers,
      timeout: 10000,
      lookup(hostname, options, callback) {
        const done = typeof options === 'function' ? options : callback
        if (hostname !== GATEWAY_HOST) {
          done(new Error('lookup'))
          return
        }
        done(null, GATEWAY_HOST, 4)
      },
    }, (res) => {
      const remote = res.socket && res.socket.remoteAddress
      if (remote !== '127.0.0.1' && remote !== '::ffff:127.0.0.1') {
        req.destroy()
        finish({ status: null, json: null, raw: '', transport: 'offline' })
        return
      }
      const chunks = []
      let size = 0
      res.on('data', (chunk) => {
        size += chunk.length
        if (size > 1048576) {
          req.destroy()
          finish({ status: null, json: null, raw: '', transport: 'offline' })
          return
        }
        chunks.push(chunk)
      })
      res.once('end', () => {
        const status = res.statusCode
        if (!Number.isInteger(status)) {
          finish({ status: null, json: null, raw: '', transport: 'offline' })
          return
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        const declared = res.headers['content-length']
        if (declared !== undefined && Number(declared) !== Buffer.byteLength(raw)) {
          finish({ status, json: null, raw: '', transport: 'offline' })
          return
        }
        let json = null
        if (raw.length > 0) {
          try { json = JSON.parse(raw) } catch { json = null }
        }
        finish({ status, json, raw, transport: 'application' })
      })
    })
    req.once('timeout', () => {
      req.destroy()
      finish({ status: null, json: null, raw: '', transport: 'offline' })
    })
    req.once('error', () => finish({ status: null, json: null, raw: '', transport: 'offline' }))
    if (payload) req.write(payload)
    req.end()
  })
}

function httpClass(response) {
  if (!response || response.transport !== 'application' || !Number.isInteger(response.status)) return 'offline'
  if (response.status === 401) return '401'
  if (response.status === 403) return '403'
  if (response.status >= 500) return 'offline'
  if (response.status === 200) return 'ok'
  return 'other'
}

function dataOf(response) {
  const data = response && response.json && response.json.data
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

function decimalField(raw, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*(0|[1-9]\\d{0,18})(?![\\d.eE])`, 'g')
  const values = [...String(raw).matchAll(re)].map((match) => match[1])
  if (values.length !== 1) return null
  if (BigInt(values[0]) > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return values[0]
}

function claims(token) {
  const parts = String(token).split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    const roles = Array.isArray(payload.roles) ? payload.roles : []
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : []
    const audience = Array.isArray(payload.aud) ? payload.aud : (payload.aud ? [payload.aud] : [])
    const subject = typeof payload.sub === 'string' && payload.sub
      ? payload.sub
      : (typeof payload.principal_id === 'string' ? payload.principal_id : '')
    const approved = header.alg === 'RS256'
      && subject.length > 0
      && payload.iss === 'http://127.0.0.1:18087'
      && audience.includes('yuxuexing-api')
      && payload.token_type === 'access'
      && roles.includes('learner')
      && permissions.includes('learner.target.write')
      && permissions.includes('learner.profile.read')
      && permissions.includes('content.read')
      && Boolean(payload.scope)
      && payload.adult_gate === 'PASSED'
      && payload.consent_state === 'GRANTED'
      && payload.phase === 'phase-1'
      && payload.account_status === 'ACTIVE'
      && payload.tenant_id === 'platform'
    return { approved, subject }
  } catch {
    return null
  }
}

function principalAgrees(response, subject) {
  if (httpClass(response) !== 'ok') return false
  const data = dataOf(response)
  if (!data) return false
  const gate = data.adultGate
  const consent = data.consentState
  const roles = Array.isArray(data.roles) ? data.roles : []
  const permissions = Array.isArray(data.permissions) ? data.permissions : []
  return data.status === 'ACTIVE'
    && data.tenantId === 'platform'
    && data.authMode === 'self-owned-jwt'
    && data.policyVersion === 'b30-rbac-v1'
    && typeof data.principalId === 'string'
    && data.principalId === subject
    && roles.includes('learner')
    && permissions.includes('content.read')
    && gate && gate.status === 'PASSED' && gate.learningAccess === 'ELIGIBLE'
    && consent && consent.accepted === true && consent.learningAccess === 'ELIGIBLE'
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

function preferenceView(response) {
  if (httpClass(response) !== 'ok') return null
  const data = dataOf(response)
  const meta = response.json && response.json.meta
  if (!data || !meta || meta.source !== 'LEARNER_SERVICE' || meta.stale !== false || meta.replayed !== false) return null
  const stateText = decimalField(response.raw, 'stateVersion')
  const aliasText = decimalField(response.raw, 'preferenceVersion')
  if (stateText === null || aliasText === null || stateText !== aliasText) return null
  if (typeof data.contentLocale !== 'string' || !LOCALE.test(data.contentLocale)) return null
  if (data.stateVersion !== Number(stateText) || data.preferenceVersion !== Number(aliasText)) return null
  return {
    contentLocale: data.contentLocale,
    stateVersion: Number(stateText),
    preferenceVersion: Number(aliasText),
    freshAlias0: stateText === '0',
  }
}

function safeCode(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128 || value.trim() !== value) return null
  if (/[\u0000-\u001f\u007f]/.test(value)) return null
  return value
}

function ownerCard(item, locale) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null
  const contentCode = safeCode(item.contentCode)
  const contentType = safeCode(item.contentType)
  const targetLevel = safeCode(item.targetLevel)
  if (!contentCode || !contentType || !targetLevel) return null
  if (typeof item.title !== 'string' || item.title.trim() === '' || item.title.length > 255) return null
  if (typeof item.summary !== 'string' || item.summary.length > 512) return null
  if (item.contentLocale !== locale) return null
  if (item.availability !== 'PUBLISHED') return null
  if (item.status !== undefined && item.status !== 'PUBLISHED') return null
  if (typeof item.contentVersionId !== 'number' || !Number.isSafeInteger(item.contentVersionId) || item.contentVersionId <= 0) {
    return null
  }
  return {
    contentCode,
    contentType,
    contentLocale: item.contentLocale,
    targetLevel,
    contentVersionId: item.contentVersionId,
    availability: 'PUBLISHED',
    titlePresent: true,
    summaryPresent: item.summary.length > 0,
  }
}

function homeView(response) {
  if (httpClass(response) !== 'ok') return null
  const data = dataOf(response)
  const meta = response.json && response.json.meta
  if (!data || !meta || meta.source !== 'LEARNER_SERVICE' || typeof meta.stale !== 'boolean') return null
  const firstDay = data.firstDay
  if (!firstDay || typeof firstDay !== 'object' || Array.isArray(firstDay)) return null
  if (!Array.isArray(data.tasks) || !Array.isArray(firstDay.tasks)) return null
  if (data.tasks.length !== firstDay.tasks.length) return null
  if (typeof firstDay.taskCount !== 'number' || firstDay.taskCount !== firstDay.tasks.length) return null
  if (typeof data.projectionVersion !== 'number' || !Number.isSafeInteger(data.projectionVersion)) return null
  if (typeof data.contentEpoch !== 'number' || !Number.isSafeInteger(data.contentEpoch)) return null
  if (!validInstant(data.generatedAt) || !validInstant(firstDay.generatedAt)) return null
  if (typeof firstDay.state !== 'string' || !SAFE_CODE.test(firstDay.state)) return null
  const blocker = firstDay.blocker
  if (!(blocker === null || blocker === undefined || (typeof blocker === 'string' && SAFE_CODE.test(blocker)))) return null
  const contentStatus = typeof data.contentStatus === 'string' ? data.contentStatus : ''
  return {
    projectionVersion: data.projectionVersion,
    contentEpoch: data.contentEpoch,
    taskCount: data.tasks.length,
    firstDayState: firstDay.state,
    blocker: typeof blocker === 'string' ? blocker : null,
    stale: meta.stale === true,
    contentStatus,
  }
}

function catalogView(response, locale) {
  if (httpClass(response) !== 'ok') return null
  const data = dataOf(response)
  const meta = response.json && response.json.meta
  if (!data || Array.isArray(response.json.data) || !meta) return null
  if (meta.source !== 'CONTENT_SERVICE' || typeof meta.stale !== 'boolean') return null
  if (!Array.isArray(data.items)) return null
  if (typeof data.contentEpoch !== 'number' || !Number.isSafeInteger(data.contentEpoch) || data.contentEpoch < 1) return null
  if (typeof data.projectionVersion !== 'number' || !Number.isSafeInteger(data.projectionVersion) || data.projectionVersion < 1) return null
  const cards = []
  for (const item of data.items) {
    const card = ownerCard(item, locale)
    if (!card) return { shape: false, itemCount: data.items.length, cards: [] }
    cards.push(card)
  }
  return {
    shape: true,
    itemCount: data.items.length,
    contentEpoch: data.contentEpoch,
    projectionVersion: data.projectionVersion,
    stale: meta.stale === true,
    cards,
  }
}

function pageOf(home, catalog) {
  const accessible = catalog.cards.length
  const derived = accessible > 0 ? 'READY' : (home.contentStatus === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'EMPTY')
  if (derived === 'UNAVAILABLE') {
    return { homeStatus: 'unavailable', page: 'unavailable', contentStatus: derived, accessible }
  }
  if (accessible === 0) {
    return {
      homeStatus: home.taskCount > 0 ? 'ready' : 'empty',
      page: 'catalog-empty',
      contentStatus: derived,
      accessible,
    }
  }
  return { homeStatus: 'ready', page: 'results', contentStatus: derived, accessible }
}

function pairGuard(homeClass, catalogClass) {
  const classes = [homeClass, catalogClass]
  if (classes.every((item) => item === 'ok')) {
    return { applied: false, httpClass: 'ok', clearsPreviousHome: false, planQueueRead: false }
  }
  const denied = classes.some((item) => item === '401' || item === '403')
  const offline = classes.some((item) => item === 'offline')
  const other = classes.some((item) => item === 'other')
  if (denied && !offline && !other) {
    const tags = [...new Set(classes.filter((item) => item === '401' || item === '403'))].sort()
    return { applied: true, httpClass: tags.join('+'), clearsPreviousHome: true, planQueueRead: false }
  }
  if (denied) return { applied: false, httpClass: 'mixed', clearsPreviousHome: false, planQueueRead: false }
  if (offline) return { applied: false, httpClass: 'offline', clearsPreviousHome: false, planQueueRead: true }
  return { applied: false, httpClass: 'other', clearsPreviousHome: false, planQueueRead: true }
}

function dropResponse(response) {
  if (!response) return
  response.raw = ''
  response.json = null
}

function writeReceipt(root, report, held) {
  const text = `${JSON.stringify(report, null, 2)}\n`
  for (const secret of held) {
    if (secret && text.includes(secret)) {
      const blocked = `${JSON.stringify({ pass: false, outcome: 'receipt-redacted', unrelatedWrites: counts.other + Math.max(0, counts.post - (report.gatewayLogin ? 1 : 0)) })}\n`
      writeFileSync(path.join(root, 'actual-receipt.json'), blocked, { mode: 0o600 })
      chmodSync(path.join(root, 'actual-receipt.json'), 0o600)
      return false
    }
  }
  const partial = path.join(root, 'actual-receipt.json.partial')
  const finalPath = path.join(root, 'actual-receipt.json')
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeFileSync(partial, text, { mode: 0o600 })
  renameSync(partial, finalPath)
  chmodSync(finalPath, 0o600)
  return true
}

function emit(report) {
  const line = {
    status: report.pass ? 'OBSERVED' : 'BLOCKED',
    pass: report.pass === true,
    outcome: report.outcome,
    stage: report.stage,
    contentLocale: report.contentLocale || null,
    freshAlias0: report.freshAlias0 === true,
    itemCount: Number.isInteger(report.itemCount) ? report.itemCount : null,
    separated: report.separated,
    b326: report.b326 && report.b326.applied ? 'denial' : 'not-applied',
    unrelatedWrites: report.unrelatedWrites,
  }
  process.stdout.write(`${JSON.stringify(line)}\n`)
  process.exitCode = report.pass ? 0 : 1
}

function baseReport(extra) {
  return {
    probe: 'mb009-learn-catalog-owner',
    gateway: GATEWAY_ORIGIN,
    pass: false,
    outcome: extra.outcome,
    stage: extra.stage,
    separated: extra.separated || null,
    contentLocale: extra.contentLocale || null,
    freshAlias0: extra.freshAlias0 === true,
    preferenceVersion: Number.isInteger(extra.preferenceVersion) ? extra.preferenceVersion : null,
    stageStatus: Number.isInteger(extra.stageStatus) ? extra.stageStatus : null,
    itemCount: Number.isInteger(extra.itemCount) ? extra.itemCount : null,
    gatewayLogin: extra.gatewayLogin === true,
    unrelatedWrites: counts.other + Math.max(0, counts.post - (extra.gatewayLogin ? 1 : 0)),
    planReads: 0,
    b326: extra.b326 || { applied: false, httpClass: null, page: null, clearsPreviousHome: false, planQueueRead: false },
    home: extra.home || null,
    catalog: extra.catalog || null,
    page: extra.page || null,
  }
}

async function main() {
  let root = ''
  let actor = null
  let token = ''
  let credential = null
  const held = []
  try {
    root = assertOwned()
    actor = intake()
    token = actor.token
    if (token) held.push(token)
    if (actor.login) {
      credential = readCredential(actor.credentialFile)
      held.push(credential.identifier, credential.password)
      let body = JSON.stringify({
        identifier: credential.identifier,
        password: credential.password,
        device: { deviceType: 'H5', clientVersion: 'local-dev', deviceName: '语学星移动端' },
      })
      const logged = await send({ method: 'POST', requestPath: '/api/v1/auth/login', body, caseId: 'login' })
      body = ''
      const loginClass = httpClass(logged)
      const access = logged.json && logged.json.data && typeof logged.json.data.accessToken === 'string'
        ? logged.json.data.accessToken
        : ''
      dropResponse(logged)
      if (loginClass !== 'ok') fail(loginClass, 'login', { separated: loginClass, stageStatus: logged.status })
      if (access.length === 0) fail('actor', 'login', { separated: 'ok', stageStatus: logged.status })
      token = access
      remember(token)
      held.push(token)
    }
    const decoded = claims(token)
    if (!decoded || !decoded.approved) fail('actor', 'claims', { separated: null })
    const principal = await send({
      method: 'GET',
      requestPath: '/api/v1/iam/principal/me',
      token,
      caseId: 'principal',
    })
    const principalClass = httpClass(principal)
    const agreed = principalAgrees(principal, decoded.subject)
    dropResponse(principal)
    if (principalClass !== 'ok') fail(principalClass, 'principal', { separated: principalClass, stageStatus: principal.status })
    if (!agreed) fail('actor', 'principal', { separated: 'ok', stageStatus: principal.status })
    const preference = await send({
      method: 'GET',
      requestPath: '/api/v1/learner/preferences',
      token,
      caseId: 'preferences',
    })
    const preferenceClass = httpClass(preference)
    const view = preferenceView(preference)
    dropResponse(preference)
    if (preferenceClass !== 'ok') fail(preferenceClass, 'preferences', { separated: preferenceClass, stageStatus: preference.status })
    if (!view) fail('preference-shape', 'preferences', { separated: 'ok', stageStatus: preference.status })
    const query = `contentLocale=${encodeURIComponent(view.contentLocale)}`
    const [homeResponse, catalogResponse] = await Promise.all([
      send({ method: 'GET', requestPath: `/api/v1/learner/home?${query}`, token, caseId: 'home' }),
      send({ method: 'GET', requestPath: `/api/v1/content/learner/catalog?${query}`, token, caseId: 'catalog' }),
    ])
    const homeClass = httpClass(homeResponse)
    const catalogClass = httpClass(catalogResponse)
    const guard = pairGuard(homeClass, catalogClass)
    const home = homeClass === 'ok' ? homeView(homeResponse) : null
    const catalog = catalogClass === 'ok' ? catalogView(catalogResponse, view.contentLocale) : null
    dropResponse(homeResponse)
    dropResponse(catalogResponse)
    const routeHome = { class: homeClass, status: homeResponse.status }
    const routeCatalog = { class: catalogClass, status: catalogResponse.status }
    if (guard.httpClass !== 'ok') {
      const separated = guard.httpClass === 'mixed' ? 'mixed' : guard.httpClass
      const outcome = guard.applied ? guard.httpClass : separated
      const report = baseReport({
        outcome,
        stage: 'pair',
        separated,
        contentLocale: view.contentLocale,
        freshAlias0: view.freshAlias0,
        preferenceVersion: view.preferenceVersion,
        gatewayLogin: actor.login,
        b326: {
          applied: guard.applied,
          httpClass: guard.httpClass,
          page: guard.applied ? 'denial' : 'error',
          homeStatus: guard.applied ? 'forbidden' : 'offline',
          clearsPreviousHome: guard.clearsPreviousHome,
          planQueueRead: guard.planQueueRead,
          productCatch: 'offline',
        },
        home: routeHome,
        catalog: routeCatalog,
      })
      writeReceipt(root, report, held)
      emit(report)
      return
    }
    if (!home || !catalog || catalog.shape !== true) {
      const report = baseReport({
        outcome: 'shape',
        stage: 'pair',
        separated: 'ok',
        contentLocale: view.contentLocale,
        freshAlias0: view.freshAlias0,
        preferenceVersion: view.preferenceVersion,
        itemCount: catalog ? catalog.itemCount : null,
        gatewayLogin: actor.login,
        b326: { applied: false, httpClass: 'ok', page: null, clearsPreviousHome: false, planQueueRead: false },
        home,
        catalog: catalog ? { itemCount: catalog.itemCount, shape: false } : null,
      })
      writeReceipt(root, report, held)
      emit(report)
      return
    }
    const page = pageOf(home, catalog)
    let outcome = 'shape'
    let pass = false
    if (page.page === 'unavailable') outcome = 'unavailable'
    else if (page.page === 'catalog-empty' && catalog.itemCount === 0) {
      outcome = 'empty'
      pass = true
    } else if (page.page === 'results' && catalog.itemCount > 0 && catalog.cards.length === catalog.itemCount) {
      outcome = 'positive'
      pass = counts.other === 0 && counts.post <= (actor.login ? 1 : 0)
    }
    const report = baseReport({
      outcome,
      stage: 'pair',
      separated: 'ok',
      contentLocale: view.contentLocale,
      freshAlias0: view.freshAlias0,
      preferenceVersion: view.preferenceVersion,
      itemCount: catalog.itemCount,
      gatewayLogin: actor.login,
      b326: {
        applied: false,
        httpClass: 'ok',
        page: page.page,
        homeStatus: page.homeStatus,
        clearsPreviousHome: false,
        planQueueRead: false,
      },
      home: {
        projectionVersion: home.projectionVersion,
        contentEpoch: home.contentEpoch,
        taskCount: home.taskCount,
        firstDayState: home.firstDayState,
        blocker: home.blocker,
        stale: home.stale,
        contentStatus: page.contentStatus,
      },
      catalog: {
        itemCount: catalog.itemCount,
        contentEpoch: catalog.contentEpoch,
        projectionVersion: catalog.projectionVersion,
        stale: catalog.stale,
        cards: catalog.cards,
      },
      page,
    })
    report.pass = pass && report.unrelatedWrites === 0
    if (!report.pass && (outcome === 'positive' || outcome === 'empty')) report.outcome = 'writes'
    writeReceipt(root, report, held)
    emit(report)
  } catch (error) {
    const outcome = error && error.outcome ? error.outcome : 'run'
    const stage = error && error.stage ? error.stage : 'run'
    const extra = error && error.extra ? error.extra : {}
    const report = baseReport({
      outcome,
      stage,
      separated: extra.separated || (outcome === '401' || outcome === '403' || outcome === 'offline' ? outcome : null),
      stageStatus: extra.stageStatus,
      gatewayLogin: Boolean(actor && actor.login && counts.post > 0),
      b326: { applied: false, httpClass: null, page: null, clearsPreviousHome: false, planQueueRead: false },
    })
    if (root) {
      try { writeReceipt(root, report, held) } catch { /* receipt stays unwritten when the prefix cannot be written */ }
    }
    emit(report)
  } finally {
    if (credential) {
      credential.identifier = ''
      credential.password = ''
    }
    token = ''
    held.length = 0
    forgetSecrets()
  }
}

main()
