/**
 * MB-005 forbidden-page observer for one wholly synthetic under-threshold actor.
 *
 * Direct node runs local checks only. It does not listen, register, or open Chrome.
 * observeForbiddenH5 expects an owned G459 lease that already holds IAM and Gateway,
 * plus the G459 nonce for the immutable G457 H5. The browser performs
 * one register, one adult-gate denial, the forbidden-page read, and one
 * current-session logout at https://127.0.0.1:18087 with a bearer and the
 * refresh cookie. Responses are never fulfilled and auth state is never injected.
 * A Gateway logout is not an accepted path for this H5.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const JOB = '/tmp/grok-mobile-resume-h5-logout-probe-459'
const H5_ROOT = '/tmp/grok-mobile-resume-h5-logout-live-candidate-457/OUTPUT/h5'
const H5_INDEX_SHA = '8233e1edfaf8bb40489c80ce068ccc9abd6901a4fbb828bc012e999eaa91e7a3'
const B139_INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_INDEX_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const G447_INDEX_SHA = '7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8'
const REJECTED_INDEX = new Set([B139_INDEX_SHA, B116_INDEX_SHA, G447_INDEX_SHA])
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
const LOGOUT_HOST = '.forbidden-exit button.forbidden-text:not([disabled]):not([aria-disabled="true"]), .forbidden-exit uni-button.forbidden-text:not([disabled]):not([aria-disabled="true"])'
const LOGIN_TITLE = '欢迎回来'
const GATE_TITLE = '先确认你的年龄'
const UNKNOWN_TITLE = '暂时无法确认访问状态'
const COOKIE_NAME = 'yuxuexing_refresh'
const COOKIE_PATH = '/api/v1/auth'
const JOB_ID = 'MB005-H5-IAM-LOGOUT-459'
const PUBLIC_PATHS = new Set([
  '/pages/login/login',
  '/pages/forbidden/forbidden',
  '/pages/register/register',
  '/pages/reset-password/reset-password',
  '/pages/report-share/report-share',
])
const ACCOUNT_PATHS = new Set([
  '/pages/onboarding/onboarding',
  '/pages/devices/devices',
  '/pages/settings/settings',
  '/pages/profile/profile',
  '/pages/support/support',
  '/pages/b6-platform/b6-platform',
])
const KNOWN_PATHS = new Set([
  ...PUBLIC_PATHS,
  ...ACCOUNT_PATHS,
  '/pages/home/home',
  '/pages/learn/learn',
  '/pages/today/today',
  '/pages/world/world',
  '/pages/practice/practice',
  '/pages/assessment/assessment',
  '/pages/b2-practice/b2-practice',
  '/pages/b2-vocabulary/b2-vocabulary',
  '/pages/b3-grammar/b3-grammar',
  '/pages/b3-listening/b3-listening',
  '/pages/b3-reading/b3-reading',
  '/pages/b3-speaking/b3-speaking',
  '/pages/b3-writing/b3-writing',
  '/pages/b4-avatar/b4-avatar',
  '/pages/b4-games/b4-games',
  '/pages/b4-offline/b4-offline',
  '/pages/b4-social/b4-social',
  '/pages/b5-commerce/b5-commerce',
  '/pages/b10-report/b10-report',
  '/pages/b11-listening/b11-listening',
  '/pages/b11-reading/b11-reading',
  '/pages/b11-speaking/b11-speaking',
])
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
  const index = path.join(H5_ROOT, 'index.html')
  try {
    const digest = sha256(index)
    const names = fs.readdirSync(path.join(H5_ROOT, 'assets'))
    return {
      ok: digest === H5_INDEX_SHA && !REJECTED_INDEX.has(digest),
      digest,
      forbiddenChunk: names.some((name) => name.startsWith('pages-forbidden-forbidden.')),
    }
  } catch {
    return { ok: false, digest: null, forbiddenChunk: false }
  }
}

function bundleHasAdultCopy() {
  const assets = path.join(H5_ROOT, 'assets')
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

export function matchLogoutHosts(records, label) {
  if (!Array.isArray(records) || typeof label !== 'string' || label.length === 0) return { count: 0, label: '' }
  let count = 0
  for (const row of records) {
    if (!row || typeof row !== 'object') continue
    const tag = typeof row.tag === 'string' ? row.tag.toUpperCase() : ''
    if (tag !== 'BUTTON' && tag !== 'UNI-BUTTON') continue
    if (row.ariaDisabled === 'true') continue
    if (row.disabledAttr != null && row.disabledAttr !== 'false') continue
    if (tag === 'BUTTON' && row.disabled === true) continue
    if (row.text !== label) continue
    count += 1
  }
  return { count, label: count === 1 ? label : '' }
}

function logoutHostGuard() {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
  if (!source.includes(LOGOUT_HOST)) return false
  const oldHost = `${'.forbidden-exit'} button`
  if (source.split(LOGOUT_HOST).join('').includes(oldHost)) return false
  const host = { tag: 'UNI-BUTTON', text: LOGOUT_LABEL, ariaDisabled: null, disabledAttr: null, disabled: false }
  const one = matchLogoutHosts([host], LOGOUT_LABEL)
  if (one.count !== 1 || one.label !== LOGOUT_LABEL) return false
  if (matchLogoutHosts([host, { ...host, tag: 'BUTTON' }], LOGOUT_LABEL).label !== '') return false
  if (matchLogoutHosts([{ ...host, text: '帮助' }], LOGOUT_LABEL).count !== 0) return false
  if (matchLogoutHosts([{ ...host, ariaDisabled: 'true' }], LOGOUT_LABEL).count !== 0) return false
  if (matchLogoutHosts([{ ...host, disabledAttr: '' }], LOGOUT_LABEL).count !== 0) return false
  if (matchLogoutHosts([{ ...host, tag: 'DIV' }], LOGOUT_LABEL).count !== 0) return false
  if (matchLogoutHosts([{ ...host, tag: 'BUTTON', disabled: true }], LOGOUT_LABEL).count !== 0) return false
  const assets = path.join(H5_ROOT, 'assets')
  let names = []
  try { names = fs.readdirSync(assets) } catch { return false }
  const forbiddenName = names.find((name) => name.startsWith('pages-forbidden-forbidden.') && name.endsWith('.js'))
  const helperName = names.find((name) => name.startsWith('_plugin-vue_export-helper.') && name.endsWith('.js'))
  if (!forbiddenName || !helperName) return false
  const forbidden = fs.readFileSync(path.join(assets, forbiddenName), 'utf8')
  const helper = fs.readFileSync(path.join(assets, helperName), 'utf8')
  return forbidden.includes('class:"forbidden-exit"')
    && forbidden.includes('class:"forbidden-text"')
    && forbidden.includes('forbidden.logout')
    && helper.includes('name:"Button"')
    && helper.includes('U("uni-button"')
}

export function runObserverChecks() {
  const index = localIndex()
  if (!index.ok) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'h5-index' }
  if (!index.forbiddenChunk) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'forbidden-chunk' }
  if (!bundleHasAdultCopy()) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'adult-copy-missing' }
  if (!logoutHostGuard()) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'logout-selector' }
  if (!runCookieMatcherChecks()) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'cookie-matcher' }
  if (!runAllowlistChecks()) return { ok: false, status: 'OBSERVER_PREPARED', observed: false, launched: false, reason: 'logout-allowlist' }
  return {
    ok: true,
    status: 'OBSERVER_PREPARED',
    observed: false,
    launched: false,
    reason: null,
    indexSha256: H5_INDEX_SHA,
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

function headerMap(request) {
  let raw = {}
  try { raw = request && typeof request.headers === 'function' ? request.headers() || {} : {} } catch { raw = {} }
  const headers = {}
  if (!raw || typeof raw !== 'object') return headers
  for (const [key, value] of Object.entries(raw)) {
    if (typeof key === 'string' && typeof value === 'string') headers[key.toLowerCase()] = value
  }
  return headers
}

export function logoutCredentials(request) {
  const headers = headerMap(request)
  const authorization = headers.authorization || ''
  const cookie = headers.cookie || ''
  const transport = headers['x-auth-transport'] || ''
  let credentialCookie = false
  if (cookie.length > 0 && cookie.length <= 8192) {
    for (const part of cookie.split(';')) {
      const trimmed = part.trim()
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      if (trimmed.slice(0, eq) === COOKIE_NAME && trimmed.slice(eq + 1).length > 0) credentialCookie = true
    }
  }
  return {
    authorizationBearer: /^Bearer \S+$/.test(authorization),
    credentialCookie,
    transportHeader: transport.length > 0,
  }
}

function currentSessionLogout(method, url, request) {
  let parsed
  try { parsed = new URL(url) } catch { return false }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) return false
  if (parsed.origin !== IAM_ORIGIN || parsed.pathname !== '/api/v1/auth/logout' || method !== 'POST') return false
  const shape = logoutCredentials(request)
  return shape.authorizationBearer && shape.credentialCookie && !shape.transportHeader
}

function allowRequest(method, url, request) {
  const origin = originOf(url)
  const pathName = pathname(url)
  if (origin === PAGE_ORIGIN && (method === 'GET' || method === 'HEAD')) return 'continue'
  if ((origin === IAM_ORIGIN || origin === GATEWAY_ORIGIN) && method === 'OPTIONS') return 'continue'
  if (origin === IAM_ORIGIN && method === 'POST' && pathName === '/api/v1/auth/register') return 'continue'
  if (origin === IAM_ORIGIN && method === 'POST' && pathName === '/api/v1/auth/token/refresh') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'GET' && pathName === '/api/v1/iam/principal/me') return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'POST' && pathName === '/api/v1/iam/adult-gate') return 'continue'
  if (currentSessionLogout(method, url, request)) return 'continue'
  if (origin === GATEWAY_ORIGIN && method === 'GET' && pathName === '/api/v1/iam/permissions') return 'continue'
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return 'blocked-read'
  return 'blocked-write'
}

export function runAllowlistChecks() {
  const bearer = { authorization: 'Bearer opaque-token', cookie: 'yuxuexing_refresh=opaque' }
  const iamLogout = 'https://127.0.0.1:18087/api/v1/auth/logout'
  const gatewayLogout = 'http://127.0.0.1:18070/api/v1/auth/logout'
  const shaped = (headers) => ({ headers: () => headers })
  if (allowRequest('POST', iamLogout, shaped(bearer)) !== 'continue') return false
  if (allowRequest('POST', iamLogout, shaped({ authorization: 'Bearer opaque-token' })) !== 'blocked-write') return false
  if (allowRequest('POST', iamLogout, shaped({ cookie: 'yuxuexing_refresh=opaque' })) !== 'blocked-write') return false
  if (allowRequest('POST', iamLogout, shaped({ authorization: 'Bearer opaque-token', cookie: 'yuxuexing_refresh=' })) !== 'blocked-write') return false
  if (allowRequest('POST', iamLogout, shaped({ authorization: 'Bearer opaque-token', cookie: 'yuxuexing_refresh=opaque', 'x-auth-transport': 'NATIVE_SECURE_STORAGE' })) !== 'blocked-write') return false
  if (allowRequest('POST', `${iamLogout}?next=1`, shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('POST', 'https://user:pw@127.0.0.1:18087/api/v1/auth/logout', shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('POST', 'https://127.0.0.1:18087/api/v1/auth/sessions/session-1/revoke', shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('POST', 'https://127.0.0.1:18087/api/v1/iam/adult-gate', shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('GET', 'https://127.0.0.1:18087/api/v1/iam/principal/me', shaped(bearer)) !== 'blocked-read') return false
  if (allowRequest('POST', gatewayLogout, shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('POST', 'http://127.0.0.1:18070/api/v1/iam/adult-gate', null) !== 'continue') return false
  if (allowRequest('GET', 'http://127.0.0.1:18070/api/v1/iam/principal/me', null) !== 'continue') return false
  if (allowRequest('POST', 'https://127.0.0.1:18087/api/v1/auth/register', null) !== 'continue') return false
  if (allowRequest('POST', 'https://127.0.0.1:18087/api/v1/auth/token/refresh', null) !== 'continue') return false
  if (allowRequest('POST', 'http://127.0.0.1:18070/api/v1/learning/plans', null) !== 'blocked-write') return false
  if (allowRequest('POST', 'http://127.0.0.1:18070/api/v1/iam/consents', null) !== 'blocked-write') return false
  if (allowRequest('POST', 'http://127.0.0.1:18070/api/v1/learner/profile/target', null) !== 'blocked-write') return false
  if (writeClass('/api/v1/learning/plans') !== 'learning') return false
  if (writeClass('/api/v1/iam/consents') !== 'consent') return false
  if (writeClass('/api/v1/learner/profile/target') !== 'target') return false
  if (allowRequest('POST', 'https://127.0.0.1:18088/api/v1/auth/logout', shaped(bearer)) !== 'blocked-write') return false
  if (allowRequest('POST', 'http://127.0.0.1:18087/api/v1/auth/logout', shaped(bearer)) !== 'blocked-write') return false
  return true
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
    job: JOB_ID,
    status,
    reason,
    observed: false,
    launched: extra.launched === true,
    h5Started: extra.h5Started === true,
    fakedResponse: false,
    injectedAuthState: false,
    mockDocuments: 'synthetic-fixture-only',
    indexSha256: H5_INDEX_SHA,
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

function attributeTokens(headerValue) {
  if (typeof headerValue !== 'string') return []
  return headerValue.split(';').map((part) => part.trim()).filter((part) => part.length > 0)
}

export function parseClearCookie(headerValue) {
  const tokens = attributeTokens(headerValue)
  const first = tokens[0] || ''
  const splitAt = first.indexOf('=')
  const name = splitAt >= 0 ? first.slice(0, splitAt) : first
  const cookieValue = splitAt >= 0 ? first.slice(splitAt + 1) : ''
  const flags = { path: null, maxAge: null, expiresPast: false, secure: false, httpOnly: false, sameSiteNone: false, partitioned: false }
  for (const token of tokens.slice(1)) {
    const mark = token.indexOf('=')
    const key = (mark >= 0 ? token.slice(0, mark) : token).trim().toLowerCase()
    const raw = mark >= 0 ? token.slice(mark + 1).trim() : ''
    if (key === 'path') flags.path = raw
    else if (key === 'max-age' && /^-?\d+$/.test(raw)) flags.maxAge = Number(raw)
    else if (key === 'expires') {
      const parsed = Date.parse(raw)
      flags.expiresPast = Number.isFinite(parsed) && parsed <= Date.now()
    } else if (key === 'secure') flags.secure = true
    else if (key === 'httponly') flags.httpOnly = true
    else if (key === 'samesite') flags.sameSiteNone = raw.toLowerCase() === 'none'
    else if (key === 'partitioned') flags.partitioned = true
  }
  return {
    nameMatch: name === COOKIE_NAME,
    emptyValue: name === COOKIE_NAME && cookieValue.length === 0,
    pathMatch: flags.path === COOKIE_PATH,
    maxAgeZero: flags.maxAge === 0,
    expiresPast: flags.expiresPast,
    secure: flags.secure,
    httpOnly: flags.httpOnly,
    sameSiteNone: flags.sameSiteNone,
    partitioned: flags.partitioned,
  }
}

export function summarizeClearHeaders(headers) {
  const lines = Array.isArray(headers) ? headers.filter((header) => header && typeof header.name === 'string' && header.name.toLowerCase() === 'set-cookie' && typeof header.value === 'string') : []
  const parsed = lines.map((header) => parseClearCookie(header.value)).filter((row) => row.nameMatch)
  const count = Math.min(parsed.length, 8)
  const chosen = parsed.find((row) => row.maxAgeZero && row.pathMatch) || parsed[0] || null
  return {
    headerCount: count,
    headerNameMatch: Boolean(chosen?.nameMatch),
    headerEmptyValue: Boolean(chosen?.emptyValue),
    headerPathMatch: Boolean(chosen?.pathMatch),
    headerMaxAgeZero: Boolean(chosen?.maxAgeZero),
    headerExpiresPast: Boolean(chosen?.expiresPast),
    headerSecure: Boolean(chosen?.secure),
    headerHttpOnly: Boolean(chosen?.httpOnly),
    headerSameSiteNone: Boolean(chosen?.sameSiteNone),
    headerPartitioned: Boolean(chosen?.partitioned),
  }
}

function blankCookieHeader() {
  return {
    readable: false,
    overHttps: false,
    headerCount: 0,
    headerNameMatch: false,
    headerEmptyValue: false,
    headerPathMatch: false,
    headerMaxAgeZero: false,
    headerExpiresPast: false,
    headerSecure: false,
    headerHttpOnly: false,
    headerSameSiteNone: false,
    headerPartitioned: false,
  }
}

export function jarFacts(cookies, nowMs = Date.now()) {
  const rows = Array.isArray(cookies) ? cookies.filter((cookie) => cookie && cookie.name === COOKIE_NAME && typeof cookie.value === 'string' && cookie.value.length > 0) : []
  const relevant = rows.filter((cookie) => {
    if (cookie.path !== COOKIE_PATH) return false
    if (cookie.domain && cookie.domain !== '127.0.0.1') return false
    if (!cookie.expires || cookie.expires < 0) return true
    return cookie.expires * 1000 > nowMs
  })
  const row = relevant[0] || null
  return {
    present: rows.length > 0,
    count: Math.min(rows.length, 8),
    pathMatch: Boolean(row),
    unexpired: Boolean(row),
    secure: row ? row.secure === true : false,
    httpOnly: row ? row.httpOnly === true : false,
    sameSiteNone: row ? String(row.sameSite || '').toLowerCase() === 'none' : false,
    partitioned: row ? typeof row.partitionKey === 'string' && row.partitionKey.length > 0 : false,
    hostOnlyLoopback: row ? !row.domain || row.domain === '127.0.0.1' : false,
  }
}

export function cookieClearDecision(before, header, after) {
  const storedBefore = Boolean(before && before.unexpired && before.pathMatch)
  const jarRemains = Boolean(after && after.unexpired && after.pathMatch)
  const readable = Boolean(header && header.readable === true)
  const overHttps = Boolean(header && header.overHttps === true)
  const addresses = Boolean(readable && storedBefore && overHttps && header.headerNameMatch && header.headerEmptyValue && header.headerPathMatch && header.headerMaxAgeZero && header.headerExpiresPast && header.headerSecure && header.headerHttpOnly && header.headerSameSiteNone && header.headerPartitioned)
  let reason = null
  if (!readable) reason = 'cookie-header-unreadable'
  else if (!storedBefore) reason = 'cookie-not-stored'
  else if (!addresses || jarRemains) reason = 'cookie-not-cleared'
  return {
    cookieCleared: reason == null,
    reason,
    storedBefore,
    jarRemains,
    headerReadable: readable,
    headerNameMatch: Boolean(header && header.headerNameMatch),
    headerEmptyValue: Boolean(header && header.headerEmptyValue),
    headerPathMatch: Boolean(header && header.headerPathMatch),
    headerMaxAgeZero: Boolean(header && header.headerMaxAgeZero),
    headerExpiresPast: Boolean(header && header.headerExpiresPast),
    headerSecure: Boolean(header && header.headerSecure),
    headerHttpOnly: Boolean(header && header.headerHttpOnly),
    headerSameSiteNone: Boolean(header && header.headerSameSiteNone),
    headerPartitioned: Boolean(header && header.headerPartitioned),
    headerCount: header && Number.isInteger(header.headerCount) ? Math.min(Math.max(header.headerCount, 0), 8) : 0,
    clearOverHttps: overHttps,
    beforeSecure: Boolean(before && before.secure),
    beforeHttpOnly: Boolean(before && before.httpOnly),
    beforeSameSiteNone: Boolean(before && before.sameSiteNone),
    beforePartitioned: Boolean(before && before.partitioned),
    beforeHostOnlyLoopback: Boolean(before && before.hostOnlyLoopback),
  }
}

export function runCookieMatcherChecks() {
  const good = parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned')
  if (!good.nameMatch || !good.emptyValue || !good.pathMatch || !good.maxAgeZero || !good.expiresPast || !good.secure || !good.httpOnly || !good.sameSiteNone || !good.partitioned) return false
  const nonempty = parseClearCookie('yuxuexing_refresh=opaque; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned')
  if (!nonempty.nameMatch || nonempty.emptyValue || !nonempty.pathMatch) return false
  if (parseClearCookie('yuxuexing_refresh=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=None; Partitioned').pathMatch) return false
  if (parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth-extra; Max-Age=0').pathMatch) return false
  if (parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth/extra; Max-Age=0').pathMatch) return false
  if (parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=10').maxAgeZero) return false
  if (parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=01').maxAgeZero) return false
  if (parseClearCookie('other=; Path=/api/v1/auth; Max-Age=0').nameMatch) return false
  if (parseClearCookie('not_yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=0').nameMatch) return false
  const now = Date.now()
  const live = jarFacts([{ name: COOKIE_NAME, value: 'opaque', path: COOKIE_PATH, domain: '127.0.0.1', expires: Math.floor(now / 1000) + 3600, secure: true, httpOnly: true, sameSite: 'None', partitionKey: 'https://127.0.0.1' }], now)
  if (!live.unexpired || !live.pathMatch || !live.secure || !live.httpOnly || !live.sameSiteNone || !live.partitioned || !live.hostOnlyLoopback) return false
  if (jarFacts([{ name: COOKIE_NAME, value: 'opaque', path: '/', expires: Math.floor(now / 1000) + 3600 }], now).pathMatch) return false
  if (jarFacts([{ name: COOKIE_NAME, value: 'opaque', path: COOKIE_PATH, expires: 1 }], now).unexpired) return false
  if (!jarFacts([{ name: COOKIE_NAME, value: 'opaque', path: COOKIE_PATH, expires: -1 }], now).unexpired) return false
  if (jarFacts([{ name: COOKIE_NAME, value: '', path: COOKIE_PATH, expires: -1 }], now).present) return false
  const absent = jarFacts([], now)
  if (absent.present || absent.unexpired) return false
  const header = { readable: true, overHttps: true, ...summarizeClearHeaders([{ name: 'Set-Cookie', value: 'yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned' }]) }
  const cleared = cookieClearDecision(live, header, absent)
  if (!cleared.cookieCleared || cleared.jarRemains || !cleared.storedBefore || !cleared.clearOverHttps) return false
  const remains = cookieClearDecision(live, header, live)
  if (remains.cookieCleared || remains.reason !== 'cookie-not-cleared') return false
  const wrongPath = cookieClearDecision(live, { ...header, ...summarizeClearHeaders([{ name: 'Set-Cookie', value: 'yuxuexing_refresh=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned' }]) }, absent)
  if (wrongPath.cookieCleared || wrongPath.reason !== 'cookie-not-cleared') return false
  const unpartitioned = cookieClearDecision(live, { ...header, headerPartitioned: false }, absent)
  if (unpartitioned.cookieCleared || unpartitioned.reason !== 'cookie-not-cleared') return false
  const unread = cookieClearDecision(live, blankCookieHeader(), absent)
  if (unread.cookieCleared || unread.reason !== 'cookie-header-unreadable') return false
  const missing = cookieClearDecision(absent, header, absent)
  if (missing.cookieCleared || missing.reason !== 'cookie-not-stored') return false
  const httpClear = cookieClearDecision(live, { ...header, overHttps: false }, absent)
  if (httpClear.cookieCleared || httpClear.clearOverHttps || httpClear.reason !== 'cookie-not-cleared' || httpClear.jarRemains) return false
  const g444HttpJarRemains = cookieClearDecision(live, { ...header, overHttps: false }, live)
  if (
    g444HttpJarRemains.cookieCleared
    || g444HttpJarRemains.clearOverHttps
    || g444HttpJarRemains.storedBefore !== true
    || g444HttpJarRemains.jarRemains !== true
    || g444HttpJarRemains.reason !== 'cookie-not-cleared'
  ) return false
  return true
}

async function readClearHeader(response) {
  let headers = null
  try {
    const listed = response.headersArray()
    headers = listed && typeof listed.then === 'function' ? await listed : listed
  } catch {
    return blankCookieHeader()
  }
  if (!Array.isArray(headers)) return blankCookieHeader()
  let overHttps = false
  try { overHttps = new URL(response.url()).protocol === 'https:' } catch { overHttps = false }
  return { readable: true, overHttps, ...summarizeClearHeaders(headers) }
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
    logoutHeader: null,
    logoutBearer: false,
    logoutCredentials: false,
    logoutTransportHeader: false,
    cookieBefore: null,
    cookieReport: null,
    consentPosts: 0,
    learningWrites: 0,
    targetWrites: 0,
    fulfill: 0,
    rendered: null,
    latest: null,
    after: null,
  }
}

export function knownPath(hash) {
  if (typeof hash !== 'string') return null
  const trimmed = hash.startsWith('#') ? hash.slice(1) : hash
  const pathName = trimmed.split('?')[0]
  return KNOWN_PATHS.has(pathName) ? pathName : null
}

export function classify(visible) {
  if (!visible) return { surface: 'unread', title: 'unread', path: 'unread' }
  const pathName = knownPath(visible.hash)
  let title = 'other'
  if (visible.title === ADULT_TITLE && visible.description === ADULT_DESCRIPTION) title = 'adult'
  else if (visible.title === UNKNOWN_TITLE) title = 'unknown'
  else if (visible.gate === GATE_TITLE) title = 'gate'
  else if (visible.login === LOGIN_TITLE) title = 'login'
  else if (!visible.title && !visible.gate && !visible.login) title = 'none'
  let surface = 'other'
  if (pathName === '/pages/register/register') surface = 'register'
  else if (pathName === '/pages/onboarding/onboarding') surface = 'onboarding-gate'
  else if (pathName === '/pages/forbidden/forbidden') surface = 'forbidden'
  else if (pathName === '/pages/login/login') surface = 'login'
  else if (pathName && !PUBLIC_PATHS.has(pathName) && !ACCOUNT_PATHS.has(pathName)) surface = 'protected'
  return { surface, title, path: pathName || 'other' }
}

export function safeView(visible) {
  const classified = classify(visible)
  return {
    title: visible && visible.title === ADULT_TITLE ? ADULT_TITLE : visible && visible.title === UNKNOWN_TITLE ? UNKNOWN_TITLE : '',
    description: visible && visible.description === ADULT_DESCRIPTION ? ADULT_DESCRIPTION : '',
    logout: visible && visible.logout === LOGOUT_LABEL ? LOGOUT_LABEL : '',
    gate: visible && visible.gate === GATE_TITLE ? GATE_TITLE : '',
    login: visible && visible.login === LOGIN_TITLE ? LOGIN_TITLE : '',
    reason: classified.title,
    surface: classified.surface,
    path: classified.path,
  }
}

async function poll(page, state, predicate, timeoutMs) {
  const until = Date.now() + timeoutMs
  let visible = null
  while (Date.now() < until) {
    visible = await readVisible(page)
    state.latest = safeView(visible)
    if (await predicate(visible)) return true
    await sleep(100)
  }
  visible = await readVisible(page)
  state.latest = safeView(visible)
  return Boolean(await predicate(visible))
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
  if (method === 'POST' && pathName === '/api/v1/auth/logout' && via === 'iam') {
    const shape = logoutCredentials(response.request())
    state.logoutBearer = shape.authorizationBearer
    state.logoutCredentials = shape.credentialCookie
    state.logoutTransportHeader = shape.transportHeader
    const data = await readData(response)
    state.logoutHeader = await readClearHeader(response)
    state.logoutStatus = response.status()
    state.logoutRevoked = token(data?.status) === 'REVOKED'
    state.logoutScope = token(data?.revocationScope)
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
  if (logouts.length !== 1 || logouts[0].status !== 200 || logouts[0].via !== 'iam') return 'logout-not-revoked'
  if (!state.logoutRevoked || state.logoutScope !== 'CURRENT_SESSION_AND_TOKEN_FAMILY') return 'logout-not-revoked'
  if (!state.logoutBearer || !state.logoutCredentials || state.logoutTransportHeader) return 'logout-not-revoked'
  if (!state.cookieReport || state.cookieReport.cookieCleared !== true || state.cookieReport.clearOverHttps !== true || state.cookieReport.jarRemains !== false || state.cookieReport.storedBefore !== true) return state.cookieReport?.reason || 'cookie-not-cleared'
  if (state.consentPosts !== 0 || state.learningWrites !== 0 || state.targetWrites !== 0 || state.fulfill !== 0) return 'request-bound'
  if (state.blockedWrites.length !== 0) return 'request-bound'
  return null
}

async function readVisible(page) {
  const raw = await page.evaluate((selector) => {
    const title = document.querySelector('#mobile-forbidden-title')
    const description = document.querySelector('#mobile-forbidden-description')
    const login = document.querySelector('#mobile-login-title')
    const gate = document.querySelector('#mobile-onboarding-title')
    const text = (node) => (node && node.textContent ? node.textContent.trim() : '')
    const hosts = Array.from(document.querySelectorAll(selector)).map((node) => ({
      tag: node.tagName,
      text: text(node),
      ariaDisabled: node.getAttribute('aria-disabled'),
      disabledAttr: node.hasAttribute('disabled') ? node.getAttribute('disabled') : null,
      disabled: node.disabled === true,
    }))
    return {
      hash: location.hash,
      title: text(title),
      description: text(description),
      login: text(login),
      gate: text(gate),
      hosts,
    }
  }, LOGOUT_HOST).catch(() => null)
  if (!raw) return null
  const matched = matchLogoutHosts(raw.hosts, LOGOUT_LABEL)
  return {
    hash: raw.hash,
    title: raw.title,
    description: raw.description,
    logout: matched.label,
    login: raw.login,
    gate: raw.gate,
    logoutCount: matched.count,
  }
}

async function runFlow(page, state, secrets) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const decision = allowRequest(request.method(), request.url(), request)
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
  const registerReady = await poll(page, state, async () => page.locator('#mobile-register-identifier-host').count().then((count) => count > 0), 20_000)
  if (!registerReady) return 'register-form'
  await fillHost(page, 'mobile-register-identifier-host', secrets.identifier)
  await fillHost(page, 'mobile-register-password-host', secrets.password)
  await fillHost(page, 'mobile-register-confirm-host', secrets.password)
  await page.locator('.register-submit').click()
  const onboarding = await poll(page, state, (visible) => Boolean(visible && visible.gate === GATE_TITLE && knownPath(visible.hash) === ONBOARDING_HASH), 25_000)
  if (!onboarding) return 'onboarding-gate'
  await fillHost(page, 'mobile-onboarding-year-host', '2015')
  await page.locator('.onboarding-check-row').click()
  const enabled = await poll(page, state, async () => {
    const disabled = await page.locator('.onboarding-primary').first().getAttribute('aria-disabled')
    return disabled === 'false' || disabled === null
  }, 10_000)
  if (!enabled) return 'age-confirm'
  await page.locator('.onboarding-primary').first().click()
  const forbidden = await poll(page, state, (visible) => Boolean(visible && visible.title === ADULT_TITLE && visible.description === ADULT_DESCRIPTION && visible.logout === LOGOUT_LABEL && visible.logoutCount === 1), 25_000)
  state.rendered = state.latest
  if (!forbidden) return 'forbidden-reason'
  await waitFor(() => state.gate != null && state.principals.some((row) => row.http === 200 && row.status === 'RESTRICTED'), 10_000)
  const seen = await readVisible(page)
  state.rendered = safeView(seen)
  state.latest = state.rendered
  if (!seen || seen.logoutCount !== 1 || state.rendered.reason !== 'adult' || state.rendered.title !== ADULT_TITLE || state.rendered.description !== ADULT_DESCRIPTION || state.rendered.logout !== LOGOUT_LABEL) {
    return 'forbidden-reason'
  }
  if (state.requests.filter((row) => row.path === '/api/v1/auth/logout').length !== 0) return 'logout-early'
  state.cookieBefore = jarFacts(await page.context().cookies())
  await page.locator(LOGOUT_HOST).click({ clickCount: 1 })
  const signedOut = await poll(page, state, (visible) => Boolean(visible && visible.login === LOGIN_TITLE && visible.title !== ADULT_TITLE && knownPath(visible.hash) === LOGIN_HASH), 20_000)
  state.after = state.latest
  if (!signedOut) return 'logout-page'
  await waitFor(() => state.logoutStatus != null, 10_000)
  return null
}

function projected(state, flowReason) {
  const wireReason = wireHolds(state)
  const renderedView = state.rendered || state.latest
  const afterView = state.after
  const rendered = Boolean(renderedView && renderedView.title === ADULT_TITLE && renderedView.description === ADULT_DESCRIPTION && renderedView.logout === LOGOUT_LABEL && renderedView.reason === 'adult')
  const after = Boolean(afterView && afterView.login === LOGIN_TITLE && afterView.reason === 'login' && afterView.path === LOGIN_HASH)
  const principal = state.principals.filter((row) => row.http === 200).at(-1) || null
  let reason = flowReason || wireReason
  if (!reason && !rendered) reason = 'rendered-mismatch'
  if (!reason && !after) reason = 'logout-page'
  const observed = reason == null
  return {
    job: JOB_ID,
    status: observed ? 'OBSERVED' : 'FAILED',
    reason,
    observed,
    launched: true,
    h5Started: true,
    fakedResponse: false,
    injectedAuthState: false,
    mockDocuments: 'synthetic-fixture-only',
    indexSha256: H5_INDEX_SHA,
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
      reason: renderedView?.reason || 'unread',
    },
    surface: {
      surface: renderedView?.surface || 'unread',
      title: renderedView?.reason || 'unread',
      path: renderedView?.path || 'unread',
    },
    logout: {
      count: state.requests.filter((row) => row.method === 'POST' && row.path === '/api/v1/auth/logout').length,
      status: state.logoutStatus,
      revocationStatus: state.logoutRevoked ? 'REVOKED' : null,
      revocationScope: state.logoutScope,
      authorizationBearer: state.logoutBearer === true,
      credentialCookie: state.logoutCredentials === true,
      transportHeader: state.logoutTransportHeader === true,
      cookieCleared: state.cookieReport?.cookieCleared === true,
      ...(state.cookieReport || {}),
    },
    afterLogout: {
      loginTitle: afterView?.login || '',
      forbiddenTitleVisible: afterView?.reason === 'adult',
      surface: afterView?.surface || 'unread',
      title: afterView?.reason || 'unread',
      path: afterView?.path || 'unread',
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
    identifier: `g459-${crypto.randomBytes(8).toString('hex')}@example.invalid`,
    password: `G459!${crypto.randomBytes(18).toString('base64url')}`,
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
    state.cookieReport = cookieClearDecision(state.cookieBefore, state.logoutHeader, jarFacts(await context.cookies()))
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
