'use strict'

/**
 * MB-025 next H5 proof: revoke only the other sessions of one disposable actor.
 *
 * Prepared only. Loading this file does not open a socket. A run starts only
 * when this file is the main module and MB025_OTHERS_H5 is exactly
 * YES_LOCAL_OTHERS_REVOKE. It then uses one fixed loopback lease and writes
 * redacted counts beside itself. Tokens, cookies, passwords, principal ids,
 * device ids, and session ids stay in memory and are wiped before exit.
 *
 * The batch control is the existing devices-page button. It is not a second
 * IAM operation: the page loops POST /api/v1/iam/devices/{deviceId}/kickout.
 * Logout-all and POST /api/v1/auth/sessions/{sessionId}/revoke are aborted.
 */

const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')

const OUT_DIR = '/tmp/grok-mobile-device-others-revoke-h5-probe-331'
const RUN_FLAG = 'YES_LOCAL_OTHERS_REVOKE'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const REFRESH_COOKIE = 'yuxuexing_refresh'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const FIXTURE = Object.freeze({
  birthYear: 1995,
  adultPolicy: 'b30-adult-v1',
  identifierDomain: 'example.invalid',
  passwordMinLength: 12,
  actorOtherDevice: Object.freeze({
    deviceType: 'WEB',
    clientVersion: 'local-dev',
    deviceName: '语学星网页',
  }),
  ownerDevice: Object.freeze({
    deviceType: 'H5',
    clientVersion: 'local-dev',
    deviceName: '语学星移动端',
  }),
  // The H5 page sends this body itself. The script does not register it.
  browserDevice: Object.freeze({
    deviceType: 'H5',
    clientVersion: 'local-dev',
    deviceName: '语学星移动端',
  }),
})

const COPY = Object.freeze({
  currentTitle: '移动网页',
  otherTitle: '网页浏览器',
  currentTag: '当前设备',
  revokedTag: '已退出',
  rowExit: '退出',
  cta: '退出其他设备（2）',
  ctaDisabled: '退出其他设备',
  bulkTitle: '退出其他设备？',
  bulkText: '将结束其他 2 台设备的登录；当前设备会保留。',
  bulkSuccess: '其他 2 台设备已退出。',
  singleTitle: '退出这台设备？',
  singleSuccess: '已退出 网页浏览器。',
  noIdentityTitle: '暂时认不出哪台是本机',
})

function scrub(value) {
  return String(value == null ? '' : value)
    .replace(/bearer\s+\S+/gi, 'bearer [redacted]')
    .replace(/yuxuexing_refresh=[^;\s]+/gi, 'refresh=[redacted]')
    .replace(/mb025-others-[^\s@]+@example\.invalid/gi, '[redacted-actor]')
    .replace(UUID_RE, '[redacted]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi, '[redacted]')
    .slice(0, 240)
}

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value)
}

function privateKey(purpose) {
  const key = `mb025-others-${purpose}-${crypto.randomBytes(12).toString('base64url')}`
  if (key.length < 16 || key.length > 128) throw new Error('idempotency-key-length')
  return key
}

function privatePassword() {
  const password = `Mb025!${crypto.randomBytes(18).toString('base64url')}`
  if (password.length < FIXTURE.passwordMinLength || password.length > 128) throw new Error('password-length')
  if (/[\u0000-\u001f\u007f]/.test(password)) throw new Error('password-control')
  return password
}

function privateIdentifier(role) {
  const identifier = `mb025-others-${role}-${crypto.randomBytes(4).toString('hex')}@${FIXTURE.identifierDomain}`
  if (identifier.length < 3 || identifier.length > 128) throw new Error('identifier-length')
  return identifier
}

function wipe(slot) {
  if (!slot) return
  for (const key of Object.keys(slot)) {
    if (typeof slot[key] === 'string') slot[key] = ''
    else if (slot[key] && typeof slot[key] === 'object') wipe(slot[key])
  }
}

function fixedOrigin(value) {
  const url = new URL(value)
  if (url.hostname !== '127.0.0.1') throw new Error('lease-host')
  if (url.origin !== IAM_ORIGIN && url.origin !== GATEWAY_ORIGIN && url.origin !== PAGE_ORIGIN) {
    throw new Error('lease-origin')
  }
  return url
}

function requestOnce(origin, method, pathname, { ca, headers, body } = {}) {
  const url = fixedOrigin(origin)
  if (pathname.includes('?') || pathname.includes('#')) return Promise.reject(new Error('query-closed'))
  const lib = url.protocol === 'https:' ? https : http
  const payload = body == null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))
  const hostHeader = `${url.hostname}:${url.port}`
  return new Promise((resolve, reject) => {
    const req = lib.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      servername: url.protocol === 'https:' ? 'localhost' : undefined,
      method,
      path: pathname,
      ca: ca || undefined,
      rejectUnauthorized: true,
      timeout: 20000,
      headers: {
        Host: hostHeader,
        Accept: 'application/json',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}),
        ...(headers || {}),
      },
    }, (res) => {
      const chunks = []
      let size = 0
      res.on('data', (chunk) => {
        size += chunk.length
        if (size <= 1024 * 1024) chunks.push(chunk)
      })
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        const type = String(res.headers['content-type'] || '')
        let json = null
        if (type.includes('application/json') && raw) {
          try { json = JSON.parse(raw) } catch { json = null }
        }
        resolve({
          status: res.statusCode || 0,
          headers: res.headers,
          json,
        })
      })
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', (error) => reject(error))
    if (payload) req.end(payload)
    else req.end()
  })
}

function headerList(headers, name) {
  const value = headers && headers[name]
  if (Array.isArray(value)) return value
  return value == null ? [] : [String(value)]
}

function parseRefreshCookie(headers) {
  const lines = headerList(headers, 'set-cookie')
  for (const line of lines) {
    const parts = String(line).split(';').map((part) => part.trim())
    const [name, ...rest] = parts[0].split('=')
    if (name !== REFRESH_COOKIE) continue
    const value = rest.join('=')
    let maxAge = null
    for (const part of parts.slice(1)) {
      const [attr, attrValue] = part.split('=')
      if (attr.toLowerCase() === 'max-age') maxAge = Number(attrValue)
    }
    return { value, maxAge }
  }
  return null
}

function noStore(response) {
  return headerList(response.headers, 'cache-control').join(',').toLowerCase().includes('no-store')
}

function accessTokenPresent(response) {
  const data = response && response.json && response.json.data
  return Boolean(data && typeof data.accessToken === 'string' && data.accessToken.length > 0)
}

function takeIssued(response) {
  const data = response && response.json && response.json.data
  const issued = {
    accessToken: data && typeof data.accessToken === 'string' ? data.accessToken : '',
    deviceId: data && typeof data.deviceId === 'string' ? data.deviceId : '',
    webCookie: Boolean(data && data.authTransport === 'WEB_COOKIE' && data.tokenType === 'Bearer' && !data.refreshToken),
  }
  if (data && typeof data === 'object') {
    data.accessToken = undefined
    data.refreshToken = undefined
    data.sessionId = undefined
    data.deviceId = undefined
  }
  return issued
}

function devicesFrom(json) {
  const data = json && json.data
  return data && Array.isArray(data.devices) ? data.devices : null
}

function countDevices(devices, deviceId) {
  const counts = { total: 0, active: 0, revoked: 0, current: 0, matched: false, matchedActive: false, matchedCurrent: false, matchedType: '' }
  if (!Array.isArray(devices)) return counts
  for (const device of devices) {
    if (!device || typeof device !== 'object') continue
    counts.total += 1
    if (device.status === 'ACTIVE') counts.active += 1
    if (device.status === 'REVOKED') counts.revoked += 1
    if (device.isCurrent === true) counts.current += 1
    if (device.deviceId === deviceId) {
      counts.matched = true
      counts.matchedActive = device.status === 'ACTIVE'
      counts.matchedCurrent = device.isCurrent === true
      counts.matchedType = typeof device.deviceType === 'string' ? device.deviceType : ''
    }
  }
  return counts
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` }
}

async function iam(pathname, options, ca) {
  return requestOnce(IAM_ORIGIN, options.method || 'GET', pathname, { ...options, ca })
}

async function gateway(pathname, options) {
  return requestOnce(GATEWAY_ORIGIN, options.method || 'GET', pathname, options)
}

async function establish(role, device, ca) {
  const identifier = privateIdentifier(role)
  const password = privatePassword()
  const slot = {
    identifier,
    password,
    accessToken: '',
    deviceId: '',
    cookie: '',
    principalId: '',
  }
  try {
    const registered = await iam('/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Idempotency-Key': privateKey(`${role}-register`) },
      body: { identifier, password, device },
    }, ca)
    const issued = takeIssued(registered)
    const cookie = parseRefreshCookie(registered.headers)
    slot.accessToken = issued.accessToken
    slot.deviceId = issued.deviceId
    slot.cookie = cookie && cookie.value ? cookie.value : ''
    if (registered.status !== 201 || !issued.webCookie || !isUuid(slot.deviceId) || !slot.cookie || !noStore(registered)) {
      return { ok: false, reason: 'register-rejected', status: registered.status, slot }
    }
    const gate = await gateway('/api/v1/iam/adult-gate', {
      method: 'POST',
      headers: { ...bearer(slot.accessToken), 'Idempotency-Key': privateKey(`${role}-gate`) },
      body: { confirmed: true, birthYear: FIXTURE.birthYear, policyVersion: FIXTURE.adultPolicy },
    })
    const gateStatus = gate.json && gate.json.data ? gate.json.data.status : null
    if (gate.status !== 200 || gateStatus !== 'PASSED' || !noStore(gate)) {
      return { ok: false, reason: 'adult-gate-not-passed', status: gate.status, slot }
    }
    return { ok: true, reason: null, status: registered.status, slot }
  } catch (error) {
    return { ok: false, reason: scrub(error && error.message), status: 0, slot }
  }
}

async function loginOther(slot, ca) {
  const logged = await iam('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Idempotency-Key': privateKey('actor-web-login') },
    body: { identifier: slot.identifier, password: slot.password, device: FIXTURE.actorOtherDevice },
  }, ca)
  const issued = takeIssued(logged)
  const cookie = parseRefreshCookie(logged.headers)
  const other = {
    accessToken: issued.accessToken,
    deviceId: issued.deviceId,
    cookie: cookie && cookie.value ? cookie.value : '',
  }
  if (logged.status !== 200 || !issued.webCookie || !isUuid(other.deviceId) || !other.cookie || other.deviceId === slot.deviceId || !noStore(logged)) {
    other.accessToken = ''
    other.cookie = ''
    return { ok: false, reason: 'web-login-rejected', status: logged.status, other }
  }
  other.accessToken = ''
  return { ok: true, reason: null, status: logged.status, other }
}

async function principalFacts(token) {
  const response = await gateway('/api/v1/iam/principal/me', { method: 'GET', headers: bearer(token) })
  const principalId = response.json && response.json.data && typeof response.json.data.principalId === 'string'
    ? response.json.data.principalId
    : ''
  return {
    status: response.status,
    accepted: response.status === 200 && principalId.length > 0 && !accessTokenPresent(response),
    principalId,
    noStore: noStore(response),
  }
}

async function deviceFacts(token, deviceId) {
  const response = await gateway('/api/v1/iam/devices', { method: 'GET', headers: bearer(token) })
  const devices = devicesFrom(response.json)
  return {
    status: response.status,
    noStore: noStore(response),
    devices,
    counts: countDevices(devices, deviceId),
  }
}

function ownerSnapshot(facts) {
  const counts = facts.counts
  return {
    status: facts.status,
    noStore: facts.noStore === true,
    total: counts.total,
    active: counts.active,
    revoked: counts.revoked,
    current: counts.current,
    ownerActive: counts.matchedActive === true,
    ownerCurrent: counts.matchedCurrent === true,
    ownerTypeH5: counts.matchedType === 'H5',
  }
}

function sameSnapshot(before, after) {
  if (!before || !after) return false
  return before.status === after.status
    && before.total === after.total
    && before.active === after.active
    && before.revoked === after.revoked
    && before.current === after.current
    && before.ownerActive === after.ownerActive
    && before.ownerCurrent === after.ownerCurrent
    && before.ownerTypeH5 === after.ownerTypeH5
}

async function refreshDenial(cookie, ca) {
  const response = await iam('/api/v1/auth/token/refresh', {
    method: 'POST',
    headers: {
      'Idempotency-Key': privateKey('old-refresh'),
      Cookie: `${REFRESH_COOKIE}=${cookie}`,
    },
    body: {},
  }, ca)
  const issued = parseRefreshCookie(response.headers)
  const denied = response.status === 401 && !accessTokenPresent(response) && !(issued && issued.maxAge > 0)
  return { status: response.status, denied }
}

function redactPath(pathname, memory) {
  const match = /^\/api\/v1\/iam\/devices\/([^/]+)\/kickout$/.exec(pathname)
  if (!match) return pathname
  if (memory.otherIds.includes(match[1])) return '/api/v1/iam/devices/<other>/kickout'
  if (match[1] === memory.currentDeviceId) return '/api/v1/iam/devices/<current>/kickout'
  if (match[1] === memory.ownerDeviceId) return '/api/v1/iam/devices/<owner>/kickout'
  return '/api/v1/iam/devices/<unexpected>/kickout'
}

function explicitHost(url) {
  const host = `${url.hostname}:${url.port}`
  if (host === '127.0.0.1:18087' || host === '127.0.0.1:18070' || host === '127.0.0.1:18183') return host
  return 'closed-host'
}

function classify(url, method, memory) {
  if (url.username || url.password || (url.origin !== PAGE_ORIGIN && (url.search || url.hash))) {
    return { action: 'abort', type: 'unexpected', reason: 'query-or-userinfo' }
  }
  if (url.origin === PAGE_ORIGIN) {
    if (method === 'GET' || method === 'HEAD') return { action: 'continue', type: 'h5-static' }
    return { action: 'abort', type: 'excluded-write', reason: 'non-get-static' }
  }
  if (url.origin === IAM_ORIGIN) {
    if ((method === 'POST' || method === 'OPTIONS') && url.pathname === '/api/v1/auth/login') {
      return { action: 'continue', type: 'iam-login' }
    }
    return { action: 'abort', type: 'excluded-write', reason: 'iam-path-closed' }
  }
  if (url.origin !== GATEWAY_ORIGIN) return { action: 'abort', type: 'unexpected', reason: 'origin-closed' }
  if (url.pathname === '/api/v1/auth/login' || url.pathname === '/api/v1/auth/register' || url.pathname === '/api/v1/auth/token/refresh') {
    return { action: 'abort', type: 'excluded-write', reason: 'credential-via-gateway' }
  }
  if (url.pathname === '/api/v1/auth/logout' || /^\/api\/v1\/auth\/sessions\/[^/]+\/revoke$/.test(url.pathname)) {
    return { action: 'abort', type: 'excluded-write', reason: 'logout-or-session-revoke-closed' }
  }
  if (url.pathname === '/api/v1/iam/principal/me' && (method === 'GET' || method === 'OPTIONS')) {
    return { action: 'continue', type: 'gateway-principal' }
  }
  if (url.pathname === '/api/v1/iam/devices' && (method === 'GET' || method === 'OPTIONS')) {
    return { action: 'continue', type: 'gateway-devices' }
  }
  const kick = /^\/api\/v1\/iam\/devices\/([^/]+)\/kickout$/.exec(url.pathname)
  if (kick && (method === 'POST' || method === 'OPTIONS')) {
    const id = kick[1]
    if (id === memory.currentDeviceId) return { action: 'abort', type: 'excluded-write', reason: 'current-kickout' }
    if (id === memory.ownerDeviceId) return { action: 'abort', type: 'excluded-write', reason: 'owner-kickout' }
    if (!memory.otherIds.includes(id)) return { action: 'abort', type: 'excluded-write', reason: 'kickout-not-other' }
    return { action: 'continue', type: 'gateway-kickout' }
  }
  if (url.pathname === '/api/v1/learner/targets' && (method === 'GET' || method === 'OPTIONS')) {
    return { action: 'synthetic-targets', type: 'synthetic-learner-targets' }
  }
  return { action: 'abort', type: 'unexpected', reason: 'path-closed' }
}

function hasAuthorization(request) {
  const value = request.headers().authorization || request.headers().Authorization || ''
  return /^Bearer\s+\S+$/.test(value)
}

function nonemptyKey(request) {
  const value = request.headers()['idempotency-key'] || ''
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 128
}

async function textOf(locator) {
  const value = await locator.innerText().catch(() => '')
  return value.replace(/\s+/g, ' ').trim()
}

async function readUi(page) {
  const safety = await page.locator('.dev-safety-card').count()
  const rows = page.locator('.dev-row')
  const rowCount = await rows.count()
  let currentRows = 0
  let currentExit = 0
  let otherExit = 0
  let currentTitleOk = 0
  let otherTitleOk = 0
  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index)
    const title = await textOf(row.locator('.dev-row-title'))
    const current = await row.evaluate((element) => String(element.className || '').includes('dev-row--current')).catch(() => false)
    const exits = await row.locator('.dev-row-action').count()
    if (current) {
      currentRows += 1
      currentExit += exits
      if (title === COPY.currentTitle) currentTitleOk += 1
    } else if (title === COPY.otherTitle && exits === 1) {
      otherExit += 1
      otherTitleOk += 1
    }
  }
  const cta = page.locator('button.dev-cta').first()
  const ctaCount = await page.locator('button.dev-cta').count()
  return {
    safety,
    rowCount,
    currentRows,
    currentExit,
    otherExit,
    currentTitleOk,
    otherTitleOk,
    ctaCount,
    ctaText: ctaCount === 1 ? await textOf(cta) : '',
    ctaDisabled: ctaCount === 1 ? await cta.isDisabled().catch(() => true) : true,
  }
}

async function confirmDialog(page, title, textIncludes) {
  const dialog = page.locator('.dev-dialog')
  const visible = await dialog.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
  if (!visible) return false
  const heading = await textOf(dialog.locator('.dev-dialog-title'))
  const body = await textOf(dialog.locator('.dev-dialog-text'))
  if (heading !== title || !body.includes(textIncludes)) return false
  await dialog.locator('.dev-danger').click()
  return true
}

function exactList(devices, memory) {
  if (!Array.isArray(devices) || devices.length !== 3) return false
  let current = 0
  let others = 0
  const seen = new Set()
  for (const device of devices) {
    if (!device || !isUuid(device.deviceId) || seen.has(device.deviceId)) return false
    seen.add(device.deviceId)
    if (device.deviceId === memory.ownerDeviceId) return false
    if (device.deviceId === memory.currentDeviceId) {
      if (device.deviceType !== 'H5' || device.status !== 'ACTIVE' || device.isCurrent !== true) return false
      current += 1
    } else if (memory.otherIds.includes(device.deviceId)) {
      if (device.deviceType !== 'WEB' || device.status !== 'ACTIVE' || device.isCurrent === true) return false
      others += 1
    } else {
      return false
    }
  }
  return current === 1 && others === 2
}

function othersRevoked(devices, memory) {
  if (!Array.isArray(devices)) return false
  let currentOk = false
  let revoked = 0
  for (const device of devices) {
    if (!device) continue
    if (device.deviceId === memory.currentDeviceId) {
      currentOk = device.deviceType === 'H5' && device.status === 'ACTIVE' && device.isCurrent === true
    } else if (memory.otherIds.includes(device.deviceId) && device.status === 'REVOKED' && device.isCurrent !== true) {
      revoked += 1
    }
  }
  return currentOk && revoked === 2
}

async function runBrowser(memory, caPem) {
  const ui = {
    mode: null,
    reachedDevices: false,
    exactBeforeClick: false,
    currentExitBefore: null,
    otherExitBefore: null,
    bulkClicks: 0,
    confirmClicks: 0,
    rowExitClicks: 0,
    cancelClicks: 0,
    successAfterReadback: false,
    successBeforeReadback: false,
    currentTaggedAfter: false,
    revokedTagsAfter: null,
    ctaDisabledAfter: false,
    dialogMatched: false,
  }
  const traffic = []
  const kickKeys = []
  let kicksDone = 0
  let deviceReads = 0
  let readbackStarted = false
  let readbackDevices = null
  let listBefore = null
  let staticFulfills = 0
  let browser = null
  const note = (method, pathname, host, outcome) => {
    if (traffic.length >= 160) return
    traffic.push({
      method,
      path: redactPath(pathname, memory),
      host,
      status: outcome.status ?? null,
      type: outcome.type,
      disposition: outcome.disposition,
      reason: outcome.reason || null,
      idempotencyKeyNonempty: outcome.idempotencyKeyNonempty === true,
      listPhase: outcome.listPhase || null,
    })
  }
  try {
    const playwrightRoot = process.env.MB025_PLAYWRIGHT_ROOT
    const loaded = playwrightRoot
      ? require(path.join(playwrightRoot, 'node_modules', 'playwright'))
      : require('playwright')
    const spki = crypto.createHash('sha256').update(crypto.createPublicKey(caPem).export({ type: 'spki', format: 'der' })).digest('base64')
    browser = await loaded.chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${spki}`],
    })
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      locale: 'zh-CN',
      serviceWorkers: 'block',
    })
    context.setDefaultTimeout(20000)
    const page = await context.newPage()
    page.on('response', (response) => {
      let parsed
      try { parsed = new URL(response.url()) } catch { return }
      const method = response.request().method()
      if (parsed.origin === PAGE_ORIGIN) {
        if ((method === 'GET' || method === 'HEAD') && response.status() === 200) staticFulfills += 1
        return
      }
      const row = traffic.find((item) => item.status == null && item.method === method && item.path === redactPath(parsed.pathname, memory) && item.disposition === 'continue')
      if (row) row.status = response.status()
      if (parsed.origin === IAM_ORIGIN && method === 'POST' && parsed.pathname === '/api/v1/auth/login' && response.status() === 200) {
        void response.json().then((json) => {
          const issued = takeIssued({ json })
          if (!isUuid(issued.deviceId) || !issued.accessToken || !issued.webCookie) return
          if (!memory.currentDeviceId) {
            memory.currentDeviceId = issued.deviceId
            memory.currentAccessToken = issued.accessToken
          }
        }).catch(() => {})
      }
      if (parsed.origin === GATEWAY_ORIGIN && method === 'POST' && /\/kickout$/.test(parsed.pathname) && response.status() === 200) {
        kicksDone += 1
      }
      if (parsed.origin === GATEWAY_ORIGIN && method === 'GET' && parsed.pathname === '/api/v1/iam/devices' && response.status() === 200) {
        const after = kicksDone >= 2
        if (after) readbackStarted = true
        deviceReads += 1
        void response.json().then((json) => {
          const devices = devicesFrom(json)
          if (after) readbackDevices = devices
          else listBefore = devices
        }).catch(() => {})
      }
    })
    await context.route('**/*', async (route) => {
      const request = route.request()
      let url
      try { url = new URL(request.url()) } catch { await route.abort(); return }
      const method = request.method()
      const decision = classify(url, method, memory)
      try {
        if (decision.action === 'synthetic-targets') {
          const status = method === 'OPTIONS' ? 204 : 404
          note(method, url.pathname, explicitHost(url), { status, type: decision.type, disposition: 'fulfill', reason: 'not-gateway' })
          await route.fulfill({ status, body: status === 404 ? '{"error":"not-this-proof"}' : '' })
          return
        }
        if (decision.action === 'continue') {
          const kickout = decision.type === 'gateway-kickout' && method === 'POST'
          const domainRead = method === 'GET' && decision.type.startsWith('gateway-')
          if ((domainRead || kickout) && !hasAuthorization(request)) {
            note(method, url.pathname, explicitHost(url), { type: decision.type, disposition: 'abort', reason: 'missing-authorization' })
            await route.abort()
            return
          }
          if (kickout && !nonemptyKey(request)) {
            note(method, url.pathname, explicitHost(url), { type: decision.type, disposition: 'abort', reason: 'missing-idempotency-key' })
            await route.abort()
            return
          }
          if (kickout) {
            const key = request.headers()['idempotency-key']
            if (kickKeys.includes(key)) {
              note(method, url.pathname, explicitHost(url), { type: decision.type, disposition: 'abort', reason: 'repeat-key' })
              await route.abort()
              return
            }
            kickKeys.push(key)
          }
          note(method, url.pathname, explicitHost(url), {
            type: decision.type,
            disposition: 'continue',
            idempotencyKeyNonempty: kickout,
            listPhase: decision.type === 'gateway-devices' && method === 'GET'
              ? (kicksDone >= 2 ? 'after' : kicksDone === 1 ? 'between' : 'before')
              : null,
          })
          await route.continue()
          return
        }
        note(method, url.pathname, explicitHost(url), { type: decision.type, disposition: 'abort', reason: decision.reason })
        await route.abort()
      } catch {
        note(method, url.pathname, explicitHost(url), { type: 'unexpected', disposition: 'abort', reason: 'route-handler-failed' })
        try { await route.abort() } catch { /* already settled */ }
      }
    })

    await page.goto(`${PAGE_ORIGIN}/#/pages/login/login?returnTo=${encodeURIComponent('/pages/devices/devices')}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    })
    await page.locator('.login-submit').first().waitFor({ timeout: 20000 })
    const idHost = page.locator('#mobile-login-identifier-host .uni-input-input').first()
    const pwHost = page.locator('#mobile-login-password-host .uni-input-input').first()
    const id = (await idHost.count()) ? idHost : page.locator('#mobile-login-identifier').first()
    const pw = (await pwHost.count()) ? pwHost : page.locator('#mobile-login-password').first()
    await id.fill(memory.actor.identifier)
    await pw.fill(memory.actor.password)
    await page.locator('.login-submit').first().click()
    const onDevices = await page.waitForFunction(() => location.hash.includes('/pages/devices/devices'), null, { timeout: 20000 }).then(() => true).catch(() => false)
    if (!onDevices) return finishBrowser(ui, traffic, staticFulfills, 'returnTo-not-devices')
    const ready = await page.locator('#devices-shell[data-devices-state="ready"]').waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)
    ui.reachedDevices = ready
    if (!ready) return finishBrowser(ui, traffic, staticFulfills, 'devices-not-ready')
    const listedDeadline = Date.now() + 10000
    while (Date.now() < listedDeadline && (!listBefore || !memory.currentDeviceId)) {
      await page.waitForTimeout(200)
    }
    const surface = await readUi(page)
    ui.currentExitBefore = surface.currentExit
    ui.otherExitBefore = surface.otherExit
    ui.exactBeforeClick = exactList(listBefore, memory)
      && surface.safety === 0
      && surface.rowCount === 3
      && surface.currentRows === 1
      && surface.currentExit === 0
      && surface.currentTitleOk === 1
      && surface.otherExit === 2
      && surface.otherTitleOk === 2
    if (surface.safety > 0 && surface.ctaDisabled && surface.currentExit === 0 && surface.otherExit === 0) {
      ui.mode = 'guard-no-current'
      return finishBrowser(ui, traffic, staticFulfills, 'no-current-guard')
    }
    if (!ui.exactBeforeClick) return finishBrowser(ui, traffic, staticFulfills, 'list-not-exact')
    if (!surface.ctaDisabled && surface.ctaText === COPY.cta) {
      ui.mode = 'bulk'
      await page.locator('button.dev-cta').click()
      ui.bulkClicks += 1
      const confirmed = await confirmDialog(page, COPY.bulkTitle, COPY.bulkText)
      ui.dialogMatched = confirmed
      if (!confirmed) return finishBrowser(ui, traffic, staticFulfills, 'bulk-dialog')
      ui.confirmClicks += 1
    } else if (surface.ctaDisabled && surface.otherExit === 2) {
      ui.mode = 'sequential'
      for (let step = 0; step < 2; step += 1) {
        const exits = page.locator('.dev-row:not(.dev-row--current) .dev-row-action')
        if (await exits.count() !== (2 - step)) return finishBrowser(ui, traffic, staticFulfills, 'row-exit-count')
        await exits.first().click()
        ui.rowExitClicks += 1
        const kicksAtStart = kicksDone
        const readsAtStart = deviceReads
        const confirmed = await confirmDialog(page, COPY.singleTitle, COPY.otherTitle)
        if (!confirmed) return finishBrowser(ui, traffic, staticFulfills, 'single-dialog')
        ui.confirmClicks += 1
        ui.dialogMatched = true
        const deadline = Date.now() + 20000
        while (Date.now() < deadline && !(kicksDone >= kicksAtStart + 1 && deviceReads >= readsAtStart + 1)) {
          await page.waitForTimeout(200)
        }
        const notice = await textOf(page.locator('.dev-notice-text'))
        if (kicksDone < kicksAtStart + 1 || deviceReads < readsAtStart + 1 || !notice.includes(COPY.singleSuccess)) {
          return finishBrowser(ui, traffic, staticFulfills, 'single-readback')
        }
      }
    } else {
      ui.mode = 'closed'
      return finishBrowser(ui, traffic, staticFulfills, 'no-authorized-button')
    }

    if (ui.mode === 'bulk') {
      const saw = await page.locator('.dev-notice-text').filter({ hasText: COPY.bulkSuccess }).waitFor({ state: 'visible', timeout: 20000 }).then(() => true).catch(() => false)
      if (saw && !readbackStarted) ui.successBeforeReadback = true
      ui.successAfterReadback = saw && readbackStarted && !ui.successBeforeReadback
    } else {
      ui.successAfterReadback = kicksDone === 2 && readbackStarted
    }
    const afterUi = await readUi(page)
    const currentTag = await textOf(page.locator('.dev-row--current .dev-tag'))
    ui.currentTaggedAfter = currentTag === COPY.currentTag && afterUi.currentExit === 0 && afterUi.currentRows === 1
    ui.revokedTagsAfter = await page.locator('.dev-tag', { hasText: COPY.revokedTag }).count()
    ui.ctaDisabledAfter = afterUi.ctaDisabled === true && afterUi.ctaText === COPY.ctaDisabled
    const readbackOk = othersRevoked(readbackDevices, memory)
    const kickPosts = traffic.filter((row) => row.type === 'gateway-kickout' && row.method === 'POST' && row.disposition === 'continue')
    const pathsExact = kickPosts.length === 2 && kickPosts.every((row) => row.path === '/api/v1/iam/devices/<other>/kickout' && row.status === 200 && row.idempotencyKeyNonempty)
    if (!ui.successAfterReadback || !ui.currentTaggedAfter || ui.revokedTagsAfter !== 2 || !ui.ctaDisabledAfter || !readbackOk || !pathsExact || ui.rowExitClicks !== (ui.mode === 'sequential' ? 2 : 0) || ui.bulkClicks !== (ui.mode === 'bulk' ? 1 : 0)) {
      return finishBrowser(ui, traffic, staticFulfills, 'readback-mismatch')
    }
    return finishBrowser(ui, traffic, staticFulfills, null)
  } catch (error) {
    return finishBrowser(ui, traffic, staticFulfills, scrub(error && error.message) || 'browser-failed')
  } finally {
    kickKeys.splice(0, kickKeys.length)
    if (browser) {
      try { await browser.close() } catch { /* closed */ }
    }
  }
}

function countTraffic(traffic, type, method, disposition = 'continue') {
  return traffic.filter((row) => row.type === type && row.method === method && row.disposition === disposition).length
}

function finishBrowser(ui, traffic, staticFulfills, reason) {
  const kickPosts = traffic.filter((row) => row.type === 'gateway-kickout' && row.method === 'POST' && row.disposition === 'continue')
  return {
    reason,
    ui: {
      mode: ui.mode,
      reachedDevices: ui.reachedDevices === true,
      exactBeforeClick: ui.exactBeforeClick === true,
      currentExitBefore: ui.currentExitBefore,
      otherExitBefore: ui.otherExitBefore,
      bulkClicks: ui.bulkClicks,
      confirmClicks: ui.confirmClicks,
      rowExitClicks: ui.rowExitClicks,
      cancelClicks: ui.cancelClicks,
      successAfterReadback: ui.successAfterReadback === true,
      successBeforeReadback: ui.successBeforeReadback === true,
      currentTaggedAfter: ui.currentTaggedAfter === true,
      revokedTagsAfter: ui.revokedTagsAfter,
      ctaDisabledAfter: ui.ctaDisabledAfter === true,
      dialogMatched: ui.dialogMatched === true,
    },
    api: {
      loginPosts: countTraffic(traffic, 'iam-login', 'POST'),
      deviceGets: countTraffic(traffic, 'gateway-devices', 'GET'),
      deviceGetsBefore: traffic.filter((row) => row.type === 'gateway-devices' && row.method === 'GET' && row.disposition === 'continue' && row.listPhase === 'before').length,
      deviceGetsAfterKicks: traffic.filter((row) => row.type === 'gateway-devices' && row.method === 'GET' && row.disposition === 'continue' && row.listPhase === 'after').length,
      principalGets: countTraffic(traffic, 'gateway-principal', 'GET'),
      kickoutPosts: kickPosts.length,
      kickoutStatuses: kickPosts.map((row) => row.status),
      kickoutPathsExact: kickPosts.length > 0 && kickPosts.every((row) => row.path === '/api/v1/iam/devices/<other>/kickout'),
      idempotencyKeysNonempty: kickPosts.length > 0 && kickPosts.every((row) => row.idempotencyKeyNonempty),
      refreshPostsInBrowser: countTraffic(traffic, 'iam-refresh', 'POST'),
      logoutAborts: traffic.filter((row) => row.reason === 'logout-or-session-revoke-closed').length,
      currentKickoutAborts: traffic.filter((row) => row.reason === 'current-kickout').length,
      ownerKickoutAborts: traffic.filter((row) => row.reason === 'owner-kickout').length,
      unexpectedAborts: traffic.filter((row) => row.type === 'unexpected' || row.reason === 'route-handler-failed').length,
      syntheticTargetGets: traffic.filter((row) => row.type === 'synthetic-learner-targets' && row.method === 'GET').length,
      staticFulfills,
    },
  }
}

function publicResult(source) {
  const clone = JSON.parse(JSON.stringify(source))
  const drop = /token|cookie|password|session|deviceid|authorization|identifier|principal|bearer|secret/i
  const visit = (value) => {
    if (Array.isArray(value)) return value.map(visit)
    if (!value || typeof value !== 'object') {
      if (typeof value === 'string' && UUID_RE.test(value)) return '[redacted]'
      return value
    }
    const next = {}
    for (const [key, entry] of Object.entries(value)) {
      if (drop.test(key)) continue
      next[key] = visit(entry)
    }
    return next
  }
  return visit(clone)
}

function writeResult(result) {
  if (path.resolve(OUT_DIR) !== OUT_DIR) throw new Error('output-dir')
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 })
  const file = path.join(OUT_DIR, 'result.json')
  if (!file.startsWith(`${OUT_DIR}/`)) throw new Error('output-file')
  fs.writeFileSync(file, `${JSON.stringify(publicResult(result), null, 2)}\n`, { mode: 0o600 })
}

async function health(ca) {
  const iamHealth = await iam('/actuator/health/readiness', { method: 'GET' }, ca).catch(() => null)
  const gatewayHealth = await gateway('/actuator/health/readiness', { method: 'GET' }).catch(() => null)
  const page = await requestOnce(PAGE_ORIGIN, 'GET', '/').catch(() => null)
  return {
    iam: Boolean(iamHealth && iamHealth.status === 200),
    gateway: Boolean(gatewayHealth && gatewayHealth.status === 200),
    page: Boolean(page && page.status === 200),
  }
}

async function run() {
  const caFile = process.env.MB025_IAM_CA_FILE
  if (!caFile || !path.isAbsolute(caFile)) {
    writeResult({ status: 'BLOCKED', reason: 'ca-file-missing', executed: false })
    return 2
  }
  const ca = fs.readFileSync(caFile)
  let playwrightOk = true
  try {
    if (process.env.MB025_PLAYWRIGHT_ROOT) require(path.join(process.env.MB025_PLAYWRIGHT_ROOT, 'node_modules', 'playwright'))
    else require('playwright')
  } catch {
    playwrightOk = false
  }
  if (!playwrightOk) {
    writeResult({ status: 'BLOCKED', reason: 'playwright-unavailable', executed: false })
    return 2
  }
  const ready = await health(ca)
  if (!ready.iam || !ready.gateway || !ready.page) {
    writeResult({ status: 'BLOCKED', reason: 'fixed-lease-unavailable', lease: ready, executed: false })
    return 2
  }

  const memory = {
    actor: null,
    owner: null,
    second: null,
    otherIds: [],
    ownerDeviceId: '',
    currentDeviceId: '',
    currentAccessToken: '',
    ownerPrincipalId: '',
    actorPrincipalId: '',
  }
  const evidence = {
    status: 'FAILED',
    reason: null,
    executed: true,
    bulkClosedInSource: false,
    operation: null,
    lease: { iam: '127.0.0.1:18087', gateway: '127.0.0.1:18070', page: '127.0.0.1:18183' },
    fixture: {
      birthYear: FIXTURE.birthYear,
      adultPolicy: FIXTURE.adultPolicy,
      actorOtherType: FIXTURE.actorOtherDevice.deviceType,
      ownerType: FIXTURE.ownerDevice.deviceType,
      browserType: FIXTURE.browserDevice.deviceType,
      actorSessionsBeforeBrowser: 2,
      expectedRows: 3,
    },
    ownerBefore: null,
    ownerAfter: null,
    ownerUnchanged: false,
    actorStillAccepted: false,
    actorDistinctFromOwner: false,
    oldRefreshDenied: 0,
    oldRefreshAccepted: 0,
    oldRefreshStatuses: [],
    browser: null,
  }
  try {
    const owner = await establish('owner', FIXTURE.ownerDevice, ca)
    memory.owner = owner.slot
    if (!owner.ok) {
      evidence.reason = owner.reason
      return 2
    }
    memory.ownerDeviceId = owner.slot.deviceId
    const ownerPrincipal = await principalFacts(owner.slot.accessToken)
    const ownerList = await deviceFacts(owner.slot.accessToken, owner.slot.deviceId)
    memory.ownerPrincipalId = ownerPrincipal.principalId
    evidence.ownerBefore = ownerSnapshot(ownerList)
    if (!ownerPrincipal.accepted || evidence.ownerBefore.total !== 1 || !evidence.ownerBefore.ownerActive || !evidence.ownerBefore.ownerCurrent) {
      evidence.reason = 'owner-baseline'
      return 2
    }

    const actor = await establish('actor', FIXTURE.actorOtherDevice, ca)
    memory.actor = actor.slot
    if (!actor.ok) {
      evidence.reason = actor.reason
      return 2
    }
    const second = await loginOther(actor.slot, ca)
    memory.second = second.other
    if (!second.ok) {
      evidence.reason = second.reason
      return 2
    }
    memory.otherIds = [actor.slot.deviceId, second.other.deviceId]
    const actorPrincipal = await principalFacts(actor.slot.accessToken)
    memory.actorPrincipalId = actorPrincipal.principalId
    const actorList = await deviceFacts(actor.slot.accessToken, actor.slot.deviceId)
    const twoWeb = Array.isArray(actorList.devices) && actorList.devices.length === 2
      && actorList.devices.every((device) => device.deviceType === 'WEB' && device.status === 'ACTIVE')
      && actorList.counts.current === 1
    if (!actorPrincipal.accepted || actorPrincipal.principalId === memory.ownerPrincipalId || !twoWeb) {
      evidence.reason = 'actor-baseline'
      return 2
    }

    const browser = await runBrowser(memory, ca)
    evidence.browser = browser
    evidence.operation = browser.ui && browser.ui.mode
    evidence.reason = browser.reason
    const kicked = browser.api && browser.api.kickoutPosts === 2 && browser.api.kickoutPathsExact === true && !browser.reason
    if (kicked) {
      const refreshes = []
      for (const cookie of [memory.actor.cookie, memory.second.cookie]) {
        const denial = await refreshDenial(cookie, ca)
        refreshes.push(denial)
        if (denial.denied) evidence.oldRefreshDenied += 1
        else evidence.oldRefreshAccepted += 1
        evidence.oldRefreshStatuses.push(denial.status)
      }
    }
    if (memory.currentAccessToken) {
      const still = await principalFacts(memory.currentAccessToken)
      evidence.actorStillAccepted = still.accepted === true
      evidence.actorDistinctFromOwner = Boolean(still.principalId) && still.principalId !== memory.ownerPrincipalId
    }
    if (memory.owner && memory.owner.accessToken) {
      const after = await deviceFacts(memory.owner.accessToken, memory.ownerDeviceId)
      const afterPrincipal = await principalFacts(memory.owner.accessToken)
      evidence.ownerAfter = ownerSnapshot(after)
      evidence.ownerUnchanged = sameSnapshot(evidence.ownerBefore, evidence.ownerAfter)
        && afterPrincipal.accepted === true
        && afterPrincipal.principalId === memory.ownerPrincipalId
    }
    const passed = kicked
      && evidence.oldRefreshDenied === 2
      && evidence.oldRefreshAccepted === 0
      && evidence.actorStillAccepted === true
      && evidence.actorDistinctFromOwner === true
      && evidence.ownerUnchanged === true
      && browser.api.refreshPostsInBrowser === 0
      && browser.api.logoutAborts === 0
      && browser.api.currentKickoutAborts === 0
      && browser.api.ownerKickoutAborts === 0
      && browser.api.unexpectedAborts === 0
      && browser.api.syntheticTargetGets === 0
      && browser.api.deviceGetsBefore >= 1
      && browser.api.deviceGetsAfterKicks >= 1
      && browser.ui.successBeforeReadback !== true
    if (passed) {
      evidence.status = 'OBSERVED'
      evidence.reason = null
    } else if (browser && browser.reason === 'no-current-guard' && browser.api.kickoutPosts === 0 && browser.ui.bulkClicks === 0 && browser.ui.rowExitClicks === 0 && evidence.ownerUnchanged === true) {
      evidence.status = 'GUARD_NO_CURRENT'
      evidence.reason = 'no-current-guard'
    } else {
      evidence.status = 'FAILED'
    }
    return passed ? 0 : 2
  } catch (error) {
    evidence.reason = scrub(error && error.message) || 'run-failed'
    evidence.status = 'FAILED'
    return 2
  } finally {
    wipe(memory.actor)
    wipe(memory.owner)
    wipe(memory.second)
    memory.currentAccessToken = ''
    memory.currentDeviceId = ''
    memory.ownerDeviceId = ''
    memory.ownerPrincipalId = ''
    memory.actorPrincipalId = ''
    memory.otherIds = []
    writeResult(evidence)
  }
}

if (require.main === module) {
  if (process.env.MB025_OTHERS_H5 !== RUN_FLAG) {
    process.stdout.write('MB025 others H5 proof is prepared and was not started.\n')
    process.exit(0)
  }
  run().then((code) => { process.exitCode = code }).catch(() => { process.exitCode = 2 })
}

module.exports = { FIXTURE, COPY, OUT_DIR }
