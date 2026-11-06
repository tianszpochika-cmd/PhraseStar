#!/usr/bin/env node
/**
 * Current H5 experience entry: built artifact only, no server and no real network.
 *
 * Scope:
 *  1. Anonymous access for every route declared in apps/mobile/src/pages.json.
 *     Public routes must stay public; protected routes must land on login with
 *     the exact returnTo intent. Zero private, unexpected or page errors.
 *  2. Signed-in closed listening/speaking/writing workspaces at three
 *     representative theme/viewport combinations: exact closed copy, two real
 *     alternatives, one keyboard-operable "回到可用学习" exit, no media/writes.
 *
 * Transport is Playwright route.fulfill only. The page origin and the
 * synthetic IAM/Gateway origins are intercepted before any socket is opened.
 *
 * Usage:
 *   node apps/mobile/tests/mobile-experience.e2e.mjs
 *   MOBILE_E2E_ARTIFACT=/absolute/path/to/h5 node apps/mobile/tests/mobile-experience.e2e.mjs
 */
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const output = process.env.MOBILE_E2E_OUTPUT
  ? path.resolve(process.env.MOBILE_E2E_OUTPUT)
  : fs.mkdtempSync(path.join(os.tmpdir(), 'cloudstudy-mobile-experience-'))
const shotsDir = path.join(output, 'shots')
const require = createRequire(import.meta.url)

const PAGE = 'https://mobile-e2e.invalid'
const IAM = 'https://127.0.0.1:18087'
const GATEWAY = 'http://127.0.0.1:18070'
const SHARE_REF = '0123456789abcdef0123456789abcdef'
const SHARE_PATH = `/api/v1/public/learning/report-shares/${SHARE_REF}`
const PUBLIC = new Set([
  'pages/login/login',
  'pages/register/register',
  'pages/reset-password/reset-password',
  'pages/forbidden/forbidden',
  'pages/report-share/report-share',
])
const PRIVATE_API = /^\/api\/v1\/(learner|learning|assessment|mastery|notifications|support|iam\/consents|content\/learner|reading|avatar|games|social|writing|gamification|commerce|devices)/
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.map': 'application/json; charset=utf-8',
}
const MATRIX = [
  { theme: 'light', width: 390, height: 844, colorScheme: 'light' },
  { theme: 'dark', width: 390, height: 844, colorScheme: 'dark' },
  { theme: 'high-contrast', width: 320, height: 568, colorScheme: 'light' },
]
const CLOSED = {
  'pages/b11-listening/b11-listening': {
    page: 'b11-listening',
    navTitle: '听力与片段',
    title: '听力与片段即将开放',
    reason: '听力素材还在准备中，上线后可以分段听、循环听，再写下听到的内容。',
    legacy: ['.b11-status', '.v2-b11listen-status'],
  },
  'pages/b11-speaking/b11-speaking': {
    page: 'b11-speaking',
    navTitle: '影子跟读',
    title: '影子跟读即将开放',
    reason: '录音评分还在准备中，上线后可以跟读示范、录下自己的声音并回听对比。',
    legacy: ['.b11-status', '.v2-b11speak-status'],
  },
  'pages/b3-writing/b3-writing': {
    page: 'b3-writing',
    navTitle: '写作练习',
    title: '写作自练暂未开放',
    reason: '将提供翻译、仿写与参考答案对照；当前不提供 AI 批改。',
    legacy: ['.b10-empty', '.b10-writing-card', '.b10-textarea', '.b10-prompt-picker'],
    writing: true,
  },
}
const MEDIA_REQUEST = /\/api\/v1\/(media|record|microphone|audio|download|writing|prompts)/i

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function readHead() {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}
function cors(req) {
  const requested = req.headers()['access-control-request-headers']
  return {
    'access-control-allow-origin': PAGE,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': requested || 'authorization,content-type,idempotency-key,if-match,accept-language,x-content-locale,x-request-id',
    vary: 'Origin',
  }
}
async function json(route, req, status, body) {
  await route.fulfill({
    status,
    headers: { ...cors(req), 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify(body),
  })
}
function check(row, name, ok, expected, actual) {
  row.checks.push({ name, ok: Boolean(ok), expected, actual })
  if (!ok) row.failures.push({ name, expected, actual })
}
function makeRow(route, kind, extra = {}) {
  return {
    route,
    kind,
    ...extra,
    status: 'RUNNING',
    checks: [],
    failures: [],
    requests: [],
    writes: [],
    unexpected: [],
    outside: [],
    privateTraffic: [],
    pageErrors: [],
    consoleErrors: [],
    requestFailures: [],
    artifactMisses: [],
    preAuthPrivate: [],
    authSeen: false,
    preflight: 0,
    pageRequests: 0,
    postExit: [],
  }
}
function finish(row) {
  row.status = row.failures.length === 0 ? 'PASS' : 'FAIL'
  row.checkCount = row.checks.length
  row.failedChecks = row.failures.length
  return row
}
function routePath(route) {
  return route.startsWith('/') ? route.slice(1) : route
}
function expectedReturn(route) {
  const normalized = routePath(route)
  return normalized === 'pages/home/home' ? '/pages/home/home' : `/${normalized}`
}
function decodeReturnTo(hash) {
  const queryIndex = hash.indexOf('?')
  if (queryIndex < 0) return { raw: null, decoded: null, path: null }
  const raw = new URLSearchParams(hash.slice(queryIndex + 1)).get('returnTo')
  if (raw == null) return { raw: null, decoded: null, path: null }
  let decoded = raw
  if (decoded.includes('%')) {
    try { decoded = decodeURIComponent(decoded) } catch { return { raw, decoded: null, path: null } }
  }
  return { raw, decoded, path: decoded.split(/[?#]/, 1)[0] || null }
}
function pageFacts() {
  const text = (el) => (el ? (el.innerText || el.textContent || '').trim() : '')
  const visible = (el) => Boolean(el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
  return {
    hash: location.hash,
    theme: document.documentElement.dataset.theme || '',
    title: text(document.querySelector('.mobile-page-title')),
    bodyText: (document.body.innerText || '').slice(0, 1600),
    login: Boolean(document.querySelector('.login-submit')),
    register: Boolean(document.querySelector('.register-form')),
    reset: Boolean(document.querySelector('.reset-form')),
    forbidden: Boolean(document.querySelector('.forbidden-page')),
    forbiddenReady: document.querySelector('.forbidden-page')?.getAttribute('aria-busy') === 'false',
    reportShare: Boolean(document.querySelector('#report-share-page')),
    shareStatus: document.querySelector('#report-share-page')?.getAttribute('data-share-status') || '',
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    rejections: Array.isArray(window.__e2eRejections) ? window.__e2eRejections.slice(0, 5) : [],
  }
}
function closedFacts(selectors) {
  const text = (el) => (el ? (el.innerText || el.textContent || '').trim() : '')
  const visible = (el) => Boolean(el && el.getClientRects().length > 0 && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).opacity !== '0')
  const buttons = [...document.querySelectorAll('uni-button, button, [role="button"]')]
  const cta = document.querySelector('[data-closed-back]')
  const rows = [...document.querySelectorAll('.v2-closed-notice__row')].filter(visible)
  const rootNode = document.querySelector('.yx-page') || document.querySelector('[data-closed-practice]')
  const legacy = selectors.map((selector) => ({ selector, count: document.querySelectorAll(selector).length }))
  return {
    hash: location.hash,
    theme: document.documentElement.dataset.theme || '',
    navTitle: [...document.querySelectorAll('.mobile-nav-title, .mobile-page-title')].map(text).find(Boolean) || '',
    noticeVisible: Boolean(rootNode && visible(rootNode)),
    noticeTitle: text(document.querySelector('.v2-closed-notice__title')),
    noticeReason: text(document.querySelector('[data-closed-reason]')),
    noticeTag: text(document.querySelector('[data-coming-soon]')),
    alternativesTitle: text(document.querySelector('.v2-closed-notice__alt-title')),
    alternatives: rows.map(text),
    ctaCount: document.querySelectorAll('[data-closed-back]').length,
    ctaVisible: Boolean(cta && visible(cta)),
    ctaText: text(cta),
    ctaFocusable: (() => { if (!cta) return false; try { cta.focus(); const ok = document.activeElement === cta; cta.blur(); return ok } catch { return false } })(),
    legacy,
    retryButtons: buttons.filter((el) => visible(el) && /重试/.test(text(el))).length,
    mediaElements: [...document.querySelectorAll('audio, video, input[type=file], [data-recorder]')].filter(visible).length,
    dataMotion: rootNode ? rootNode.getAttribute('data-motion') : null,
    bodyText: (document.body.textContent || '').replace(/\s+/g, ' ').slice(0, 2200),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    rejections: Array.isArray(window.__e2eRejections) ? window.__e2eRejections.slice(0, 5) : [],
  }
}

let artifact
function resolveArtifact() {
  const override = (process.env.MOBILE_E2E_ARTIFACT || '').trim()
  if (override && !path.isAbsolute(override)) {
    throw new Error(`MOBILE_E2E_ARTIFACT must be an absolute directory path, got: ${override}`)
  }
  const dir = path.resolve(override || path.join(root, 'apps/mobile/dist/build/h5'))
  const index = path.join(dir, 'index.html')
  if (!fs.existsSync(index) || !fs.statSync(index).isFile()) {
    throw new Error(
      `Built H5 index not found at ${index}. Run "pnpm --filter @englishflow/mobile build:h5" ` +
      'or set MOBILE_E2E_ARTIFACT to an absolute H5 directory.',
    )
  }
  const realDir = fs.realpathSync(dir)
  const realIndex = fs.realpathSync(index)
  if (!realIndex.startsWith(realDir + path.sep)) {
    throw new Error(`Built H5 index resolves outside the artifact directory: ${realIndex}`)
  }
  return {
    dir,
    index,
    realDir,
    realIndex,
    indexSha256: sha256(index),
    source: override ? 'MOBILE_E2E_ARTIFACT' : 'default dist/build/h5',
  }
}
function serve(route, url, row) {
  let pathname
  try { pathname = decodeURIComponent(url.pathname) } catch { row.artifactMisses.push({ path: url.pathname, reason: 'bad-encoding' }); return route.fulfill({ status: 400, body: '' }) }
  if (pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' })
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const file = path.resolve(artifact.dir, rel)
  let real
  try {
    real = fs.realpathSync(file)
  } catch {
    row.artifactMisses.push({ path: pathname, reason: 'missing-artifact' })
    return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'missing artifact file' })
  }
  if (!(real === artifact.realIndex || real.startsWith(artifact.realDir + path.sep)) || !fs.statSync(real).isFile()) {
    row.artifactMisses.push({ path: pathname, reason: 'missing-artifact' })
    return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'missing artifact file' })
  }
  row.pageRequests += 1
  return route.fulfill({
    status: 200,
    contentType: MIME[path.extname(real).toLowerCase()] || 'application/octet-stream',
    body: fs.readFileSync(real),
  })
}

function principal() {
  const permissions = ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read', 'iam.consent.read']
  return {
    principal: { subject: 'synthetic-e2e', permissions, roles: [], adultGate: 'PASSED' },
    adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
    learningAccess: 'ELIGIBLE',
    permissions,
    consentState: {
      accepted: true,
      required: true,
      learningAccess: 'ELIGIBLE',
      requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'],
      unsatisfiedPurposes: [],
      evaluatedAt: '2026-11-05T00:00:00Z',
    },
  }
}
function shareSummary() {
  return {
    status: 'ACTIVE',
    availability: 'READY',
    copy: '本周学习摘要已准备好。',
    periodStart: '2026-11-01',
    periodEndExclusive: '2026-11-08',
    newItems: 2,
    reviewItems: 1,
    durationStatus: 'COUNTED',
    durationCopy: '12 分钟',
    activeMillis: 720000,
    suggestion: '继续保持每周复习。',
    suggestionBasis: '本周有新学和复习记录。',
  }
}

async function anonymousApi(route, req, row, url, method, pathname) {
  if (url.origin === IAM) {
    if (method === 'POST' && (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/token/refresh')) {
      return json(route, req, 401, { error: { code: 'UNAUTHENTICATED' } })
    }
    row.unexpected.push({ origin: url.origin, method, path: pathname, reason: 'iam-unexpected' })
    return json(route, req, 404, { error: { code: 'E2E_NOT_CONFIGURED' } })
  }
  if (method === 'GET' && pathname === '/api/v1/iam/principal/me') {
    return json(route, req, 401, { error: { code: 'UNAUTHENTICATED' } })
  }
  if (method === 'GET' && pathname === '/api/v1/iam/permissions') {
    return json(route, req, 401, { error: { code: 'UNAUTHENTICATED' } })
  }
  if (method === 'GET' && pathname === SHARE_PATH) {
    return json(route, req, 200, shareSummary())
  }
  row.unexpected.push({ origin: url.origin, method, path: pathname, reason: 'gateway-unexpected' })
  return json(route, req, 404, { error: { code: 'E2E_NOT_CONFIGURED' } })
}

async function signedInApi(route, req, row, url, method, pathname) {
  if (row.boundaryClosed) {
    row.postExit.push({ method, path: pathname })
    return json(route, req, 200, {})
  }
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: cors(req), body: '' })
  const authorized = Boolean(req.headers().authorization)
  const isAuthWrite = url.origin === IAM && method === 'POST' && (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/token/refresh')
  if (!authorized && !isAuthWrite) {
    if (PRIVATE_API.test(pathname)) row.preAuthPrivate.push({ method, path: pathname })
    return json(route, req, 401, { error: { code: 'UNAUTHENTICATED' } })
  }
  if (!['GET', 'HEAD'].includes(method) && !isAuthWrite) {
    row.writes.push({ method, path: pathname })
    return json(route, req, 400, { error: { code: 'E2E_WRITE_BLOCKED' } })
  }
  if (req.headers().authorization) row.authSeen = true
  if (url.origin === IAM) {
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      return json(route, req, 200, {
        accessToken: 'synthetic-e2e-not-a-real-token',
        adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
        deviceId: 'synthetic-e2e-device',
        sessionId: 'synthetic-e2e-session',
      })
    }
    if (method === 'POST' && pathname === '/api/v1/auth/token/refresh') {
      return json(route, req, 200, {
        accessToken: 'synthetic-e2e-not-a-real-token',
        adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
      })
    }
  }
  if (method === 'GET' && (pathname === '/api/v1/iam/principal/me' || pathname === '/api/v1/iam/permissions')) {
    return json(route, req, 200, principal())
  }
  if (method === 'GET' && pathname === '/api/v1/iam/consents') return json(route, req, 200, { items: [] })
  if (method === 'GET' && pathname === '/api/v1/learner/profile') {
    return json(route, req, 200, { stateVersion: 0, status: 'ACTIVE', uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai' })
  }
  if (method === 'GET' && pathname === '/api/v1/learner/targets') {
    return json(route, req, 200, { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, targetLevel: 'A1', status: 'ACTIVE', stateVersion: 0 })
  }
  if (method === 'GET' && pathname === '/api/v1/learner/preferences') {
    return json(route, req, 200, { uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', stateVersion: 0 })
  }
  if (method === 'GET' && pathname === '/api/v1/learner/home') return json(route, req, 200, { items: [], planVersion: 0 })
  if (method === 'GET' && pathname === '/api/v1/learner/first-day') return json(route, req, 200, { state: 'READY', taskCount: 0 })
  if (method === 'GET' && pathname === '/api/v1/learning/today') return json(route, req, 200, { items: [], planVersion: 0 })
  if (method === 'GET' && pathname === '/api/v1/content/learner/catalog') return json(route, req, 200, { items: [] })
  if (method === 'GET' && pathname === '/api/v1/onboarding/options') return json(route, req, 200, { goals: [], dailyQuotaMinutes: [5, 15, 30, 45] })
  if (method === 'GET' && (pathname === '/api/v1/writing/prompts' || pathname === '/api/v1/content/learner/writing/prompts')) {
    return json(route, req, 200, { items: [] })
  }
  row.unexpected.push({ origin: url.origin, method, path: pathname, reason: 'signed-in-unexpected' })
  return json(route, req, 404, { error: { code: 'E2E_NOT_CONFIGURED' } })
}

function attach(page, row) {
  page.on('pageerror', (error) => row.pageErrors.push({
    message: String(error && error.message || error).slice(0, 500),
    stack: String(error && error.stack || '').slice(0, 800),
    url: page.url(),
  }))
  page.on('console', (message) => {
    if (message.type() === 'error') row.consoleErrors.push({ text: message.text().slice(0, 400), url: page.url() })
  })
  page.on('requestfailed', (request) => row.requestFailures.push({
    method: request.method(),
    path: new URL(request.url()).pathname,
    reason: request.failure()?.errorText || 'unknown',
  }))
}
async function installRoutes(context, row, mode) {
  await context.route('**/*', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const method = req.method()
    const pathname = url.pathname
    if (url.origin !== PAGE && url.origin !== IAM && url.origin !== GATEWAY) {
      row.outside.push({ origin: url.origin, method, path: pathname })
      return route.abort('blockedbyclient')
    }
    if (method === 'OPTIONS') {
      row.preflight += 1
      return route.fulfill({ status: 204, headers: cors(req), body: '' })
    }
    if (url.origin === PAGE) {
      if (pathname.startsWith('/api/')) {
        row.unexpected.push({ origin: url.origin, method, path: pathname, reason: 'page-origin-api' })
        return json(route, req, 404, { error: { code: 'E2E_NOT_CONFIGURED' } })
      }
      return serve(route, url, row)
    }
    row.requests.push({ method, origin: url.origin, path: pathname })
    if (mode === 'anonymous' && PRIVATE_API.test(pathname)) row.privateTraffic.push({ method, origin: url.origin, path: pathname })
    if (mode === 'anonymous') return anonymousApi(route, req, row, url, method, pathname)
    return signedInApi(route, req, row, url, method, pathname)
  })
}
async function newContext(browser, { theme = 'light', width = 390, height = 844, colorScheme = 'light' } = {}) {
  const context = await browser.newContext({
    viewport: { width, height },
    locale: 'zh-CN',
    colorScheme,
    reducedMotion: 'reduce',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  })
  context.setDefaultTimeout(20000)
  await context.addInitScript(({ theme }) => {
    localStorage.setItem('ef.theme', JSON.stringify({ type: 'string', data: theme }))
    window.__e2eRejections = []
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason
      try {
        window.__e2eRejections.push(reason && typeof reason === 'object'
          ? { name: String(reason.name || ''), message: String(reason.message || ''), text: String(reason).slice(0, 400) }
          : { text: String(reason).slice(0, 400) })
      } catch { window.__e2eRejections.push({ text: 'unserializable rejection' }) }
    })
  }, { theme })
  return context
}
function rejectionsFailRow(row, facts) {
  check(row, 'no-unhandled-rejections', facts.rejections.length === 0, [], facts.rejections)
}
function commonFailures(row, { privateTraffic = false } = {}) {
  check(row, 'zero-page-errors', row.pageErrors.length === 0, [], row.pageErrors)
  check(row, 'zero-unexpected-requests', row.unexpected.length === 0, [], row.unexpected)
  check(row, 'zero-outside-requests', row.outside.length === 0, [], row.outside)
  check(row, 'zero-missing-artifact-files', row.artifactMisses.length === 0, [], row.artifactMisses)
  if (privateTraffic) check(row, 'zero-private-traffic', row.privateTraffic.length === 0, [], row.privateTraffic)
}
async function screenshot(page, name) {
  try {
    const file = path.join(shotsDir, `${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    return file
  } catch { return null }
}

async function anonymousAttempt(browser, route, target, expectedPath) {
  const row = makeRow(route, 'anonymous', { target, expectedPath })
  const isPublic = PUBLIC.has(route)
  const context = await newContext(browser)
  const page = await context.newPage()
  attach(page, row)
  await installRoutes(context, row, 'anonymous')
  try {
    await page.goto(`${PAGE}/${target}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (isPublic) {
      if (route === 'pages/login/login') await page.locator('.login-submit').first().waitFor({ timeout: 20000 })
      if (route === 'pages/register/register') await page.locator('.register-form').first().waitFor({ timeout: 20000 })
      if (route === 'pages/reset-password/reset-password') await page.locator('.reset-form').first().waitFor({ timeout: 20000 })
      if (route === 'pages/forbidden/forbidden') {
        await page.locator('.forbidden-page').first().waitFor({ timeout: 20000 })
        await page.waitForFunction(() => document.querySelector('.forbidden-page')?.getAttribute('aria-busy') === 'false', null, { timeout: 20000 })
      }
      if (route === 'pages/report-share/report-share') {
        await page.locator('#report-share-page').first().waitFor({ timeout: 20000 })
        await page.waitForFunction(() => {
          const status = document.querySelector('#report-share-page')?.getAttribute('data-share-status')
          return status === 'ACTIVE' || status === 'ERROR' || status === 'NOT_FOUND'
        }, null, { timeout: 20000 })
      }
    } else {
      await page.waitForFunction(() => location.hash.includes('/pages/login/login') && Boolean(document.querySelector('.login-submit')), null, { timeout: 20000 })
    }
    await page.waitForTimeout(150)
    const facts = await page.evaluate(pageFacts)
    row.actual = {
      hash: facts.hash,
      title: facts.title,
      theme: facts.theme,
      overflow: facts.overflow,
      login: facts.login,
      register: facts.register,
      reset: facts.reset,
      forbidden: facts.forbidden,
      forbiddenReady: facts.forbiddenReady,
      reportShare: facts.reportShare,
      shareStatus: facts.shareStatus,
    }
    if (isPublic) {
      const marker = route === 'pages/login/login' ? facts.login
        : route === 'pages/register/register' ? facts.register
          : route === 'pages/reset-password/reset-password' ? facts.reset
            : route === 'pages/forbidden/forbidden' ? facts.forbidden && facts.forbiddenReady
              : facts.reportShare && facts.shareStatus === 'ACTIVE'
      check(row, 'safe-public-stay', facts.hash.startsWith(`#/${route}`), `#/${route}`, facts.hash)
      check(row, 'public-page-marker', marker, true, row.actual)
    } else {
      const intent = decodeReturnTo(facts.hash)
      row.actual.returnTo = intent
      check(row, 'login-return-intent', facts.login && intent.path === expectedPath, expectedPath, intent)
    }
    rejectionsFailRow(row, facts)
    commonFailures(row, { privateTraffic: true })
    if (isPublic && row.failures.length === 0) {
      row.screenshot = await screenshot(page, `anonymous-${route.replaceAll('/', '-')}`)
    }
  } catch (error) {
    row.failures.push({ name: 'exception', expected: 'route checked', actual: String(error && (error.stack || error.message) || error).slice(0, 1200) })
    row.error = String(error && (error.message || error) || error).slice(0, 1200)
    try { row.actual = await page.evaluate(pageFacts) } catch { /* page did not initialize */ }
  } finally {
    await context.close()
  }
  return finish(row)
}

async function runAnonymous(browser, routes) {
  const rows = []
  for (const route of routes) {
    const target = route === 'pages/home/home' ? '#/' : `#/${route}${route === 'pages/report-share/report-share' ? `?ref=${SHARE_REF}` : ''}`
    rows.push(await anonymousAttempt(browser, route, target, expectedReturn(route)))
    if (route === 'pages/home/home') {
      rows.push(await anonymousAttempt(browser, route, `#/${route}`, expectedReturn(route)))
    }
  }
  return rows
}

async function submitLogin(page) {
  await page.locator('.login-submit').first().waitFor({ timeout: 20000 })
  const idHost = page.locator('#mobile-login-identifier-host .uni-input-input').first()
  const passwordHost = page.locator('#mobile-login-password-host .uni-input-input').first()
  const identifier = (await idHost.count()) ? idHost : page.locator('#mobile-login-identifier').first()
  const password = (await passwordHost.count()) ? passwordHost : page.locator('#mobile-login-password').first()
  await identifier.fill('synthetic-e2e@example.invalid')
  await password.fill('SyntheticOnly123')
  await page.locator('.login-submit').first().click()
}

async function signedAttempt(browser, route, combo) {
  const expected = CLOSED[route]
  const row = makeRow(route, 'signed-closed', { theme: combo.theme, width: combo.width, height: combo.height })
  const context = await newContext(browser, { ...combo })
  const page = await context.newPage()
  attach(page, row)
  await installRoutes(context, row, 'signed')
  try {
    // Deep link first: the real guard redirects to login and preserves the
    // exact session return intent, then the form signs in.
    await page.goto(`${PAGE}/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForFunction(() => location.hash.includes('/pages/login/login') && Boolean(document.querySelector('.login-submit')), null, { timeout: 20000 })
    await submitLogin(page)
    await page.waitForFunction((target) => location.hash.includes(target), route, { timeout: 25000 })
    await page.locator('[data-closed-practice]').first().waitFor({ state: 'visible', timeout: 20000 })
    await page.waitForTimeout(250)
    const facts = await page.evaluate(closedFacts, expected.legacy)
    row.actual = {
      hash: facts.hash,
      theme: facts.theme,
      navTitle: facts.navTitle,
      noticeTitle: facts.noticeTitle,
      noticeReason: facts.noticeReason,
      noticeTag: facts.noticeTag,
      alternativesTitle: facts.alternativesTitle,
      alternatives: facts.alternatives,
      ctaText: facts.ctaText,
      legacy: facts.legacy,
      retryButtons: facts.retryButtons,
      mediaElements: facts.mediaElements,
      dataMotion: facts.dataMotion,
      overflow: facts.overflow,
    }
    check(row, 'target-route', facts.hash.startsWith(`#/${route}`), `#/${route}`, facts.hash)
    check(row, 'theme-applied', facts.theme === combo.theme, combo.theme, facts.theme)
    check(row, 'closed-notice-visible', facts.noticeVisible, true, facts.noticeVisible)
    check(row, 'closed-nav-title', facts.navTitle === expected.navTitle, expected.navTitle, facts.navTitle)
    check(row, 'closed-title', facts.noticeTitle === expected.title, expected.title, facts.noticeTitle)
    check(row, 'closed-reason', facts.noticeReason === expected.reason, expected.reason, facts.noticeReason)
    check(row, 'closed-tag', facts.noticeTag === '即将开放', '即将开放', facts.noticeTag)
    check(row, 'alternatives-heading', facts.alternativesTitle === '可以先练这些', '可以先练这些', facts.alternativesTitle)
    check(row, 'two-alternatives', facts.alternatives.length === 2, 2, facts.alternatives)
    check(row, 'alternative-copy', facts.alternatives[0]?.includes('先做一组单词复习') && facts.alternatives[1]?.includes('读一篇短文'), ['先做一组单词复习', '读一篇短文'], facts.alternatives)
    check(row, 'one-closed-cta', facts.ctaCount === 1 && facts.ctaVisible, '1 visible', { count: facts.ctaCount, visible: facts.ctaVisible })
    check(row, 'closed-cta-copy', facts.ctaText === '回到可用学习', '回到可用学习', facts.ctaText)
    check(row, 'closed-cta-focusable', facts.ctaFocusable, true, facts.ctaFocusable)
    check(row, 'no-legacy-workspace', facts.legacy.every((item) => item.count === 0), expected.legacy.map(() => 0), facts.legacy)
    check(row, 'no-legacy-retry', facts.retryButtons === 0, 0, facts.retryButtons)
    check(row, 'no-media-elements', facts.mediaElements === 0, 0, facts.mediaElements)
    check(row, 'no-media-requests', row.requests.filter((item) => MEDIA_REQUEST.test(item.path)).length === 0, [], row.requests.filter((item) => MEDIA_REQUEST.test(item.path)))
    check(row, 'zero-writes-before-exit', row.writes.length === 0, [], row.writes)
    check(row, 'zero-pre-auth-private', row.preAuthPrivate.length === 0, [], row.preAuthPrivate)
    check(row, 'auth-login-observed', row.authSeen, true, row.authSeen)
    rejectionsFailRow(row, facts)
    commonFailures(row)
    row.screenshot = await screenshot(page, `closed-${expected.page}-${combo.theme}-${combo.width}`)
    const cta = page.locator('[data-closed-back]').first()
    await cta.focus()
    row.boundaryClosed = true
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => location.hash.includes('/pages/today/today'), null, { timeout: 15000 })
    const exitHash = await page.evaluate(() => location.hash)
    row.exit = { hash: exitHash, expected: '#/pages/today/today', ok: exitHash === '#/pages/today/today' }
    check(row, 'today-exit', row.exit.ok, '#/pages/today/today', exitHash)
    await screenshot(page, `closed-${expected.page}-${combo.theme}-${combo.width}-today`)
  } catch (error) {
    row.failures.push({ name: 'exception', expected: 'closed workspace checked', actual: String(error && (error.stack || error.message) || error).slice(0, 1200) })
    row.error = String(error && (error.message || error) || error).slice(0, 1200)
    try { row.actual = { ...(row.actual || {}), ...(await page.evaluate(pageFacts)) } } catch { /* page unavailable */ }
    row.failureScreenshot = await screenshot(page, `failed-closed-${expected.page}-${combo.theme}-${combo.width}`)
  } finally {
    await context.close()
  }
  return finish(row)
}

async function runSignedIn(browser, routes) {
  const rows = []
  for (const route of Object.keys(CLOSED)) {
    if (!routes.includes(route)) continue
    for (const combo of MATRIX) rows.push(await signedAttempt(browser, route, combo))
  }
  return rows
}

function summarize(rows) {
  return {
    total: rows.length,
    pass: rows.filter((row) => row.status === 'PASS').length,
    fail: rows.filter((row) => row.status === 'FAIL').length,
    failed: rows.filter((row) => row.status !== 'PASS').map((row) => ({
      route: row.route,
      kind: row.kind,
      theme: row.theme,
      width: row.width,
      failures: row.failures,
    })),
  }
}

async function main() {
  await fsp.mkdir(shotsDir, { recursive: true })
  artifact = resolveArtifact()
  const pages = JSON.parse(fs.readFileSync(path.join(root, 'apps/mobile/src/pages.json'), 'utf8')).pages
  if (!Array.isArray(pages) || pages.length !== 33) throw new Error(`expected 33 official routes in pages.json, got ${pages?.length}`)
  const routes = pages.map((entry) => entry.path)
  if (new Set(routes).size !== routes.length) throw new Error('pages.json contains duplicate routes')
  const { chromium } = require('playwright')
  const browser = await chromium.launch({ headless: true })
  const started = new Date().toISOString()
  try {
    const anonymous = await runAnonymous(browser, routes)
    const signedIn = await runSignedIn(browser, routes)
    const all = [...anonymous, ...signedIn]
    const privateTraffic = all.flatMap((row) => row.privateTraffic.map((item) => ({ route: row.route, ...item })))
    const unexpected = all.flatMap((row) => row.unexpected.map((item) => ({ route: row.route, ...item })))
    const pageErrors = all.flatMap((row) => row.pageErrors.map((item) => ({ route: row.route, ...item })))
    const outside = all.flatMap((row) => row.outside.map((item) => ({ route: row.route, ...item })))
    const writes = all.flatMap((row) => row.writes.map((item) => ({ route: row.route, ...item })))
    const artifactMisses = all.flatMap((row) => row.artifactMisses.map((item) => ({ route: row.route, ...item })))
    const preAuthPrivate = all.flatMap((row) => row.preAuthPrivate.map((item) => ({ route: row.route, ...item })))
    const consoleErrors = all.flatMap((row) => row.consoleErrors.map((item) => ({ route: row.route, ...item })))
    const passed = all.every((row) => row.status === 'PASS') &&
      privateTraffic.length === 0 && unexpected.length === 0 && pageErrors.length === 0 &&
      outside.length === 0 && writes.length === 0 && artifactMisses.length === 0 && preAuthPrivate.length === 0
    const result = {
      kind: 'CURRENT_MOBILE_H5_EXPERIENCE_ENTRY',
      status: passed ? 'PASS' : 'FAIL',
      at: new Date().toISOString(),
      source: { root, head: readHead(), pagesJson: 'apps/mobile/src/pages.json' },
      artifact: { path: artifact.dir, indexSha256: artifact.indexSha256, resolvedFrom: artifact.source },
      transport: {
        mode: 'Playwright route.fulfill only',
        server: false,
        listener: false,
        port: false,
        realNetwork: false,
        pageOrigin: PAGE,
        syntheticOrigins: [IAM, GATEWAY],
      },
      inventory: { routeCount: routes.length, publicRoutes: [...PUBLIC], protectedRouteCount: routes.filter((route) => !PUBLIC.has(route)).length },
      matrix: MATRIX,
      anonymous: { summary: summarize(anonymous), rows: anonymous },
      signedIn: { summary: summarize(signedIn), rows: signedIn },
      summary: {
        ...summarize(all),
        privateTraffic,
        unexpected,
        pageErrors,
        outside,
        writes,
        artifactMisses,
        preAuthPrivate,
        consoleErrors,
      },
      limitations: [
        'Synthetic IAM/Gateway fixtures only; route.fulfill intercepts every request and no real service is contacted.',
        'No server, listener, port or real network is started or used by this entry.',
        'Signed-in proof uses the login form with a synthetic token and closed workspaces only; no product writes, active media, recorder or microphone permission.',
        `The artifact index SHA-256 is ${artifact.indexSha256}; route inventory and expectations are read from HEAD ${readHead() || 'unknown'}, so an artifact built from another source may not match that source.`,
        'No native device, real mobile hardware, browser reader or screen reader evidence.',
        'The historical September 31-page x 5 matrix and legacy reading interactions are not claimed by this entry.',
        'Only anonymous route access and the three closed workspaces are covered; targeted login/register/reset and detailed UI suites remain separate files.',
      ],
      checks: {
        allRoutesAnonymous: anonymous.length === routes.length + 1,
        allClosedWorkspaces: signedIn.length === Object.keys(CLOSED).length * MATRIX.length,
        zeroPrivateTraffic: privateTraffic.length === 0,
        zeroUnexpected: unexpected.length === 0,
        zeroPageErrors: pageErrors.length === 0,
        zeroOutside: outside.length === 0,
        zeroWrites: writes.length === 0,
        zeroArtifactMisses: artifactMisses.length === 0,
        zeroPreAuthPrivate: preAuthPrivate.length === 0,
      },
      output,
      startedAt: started,
    }
    await fsp.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify({
      status: result.status,
      anonymous: result.anonymous.summary,
      signedIn: result.signedIn.summary,
      privateTraffic: privateTraffic.length,
      unexpected: unexpected.length,
      pageErrors: pageErrors.length,
      writes: writes.length,
      output: path.join(output, 'result.json'),
    }))
    process.exitCode = result.status === 'PASS' ? 0 : 1
  } finally {
    await browser.close()
  }
}

try {
  await main()
} catch (error) {
  await fsp.mkdir(output, { recursive: true })
  await fsp.writeFile(path.join(output, 'result.json'), JSON.stringify({
    kind: 'CURRENT_MOBILE_H5_EXPERIENCE_ENTRY',
    status: 'ERROR',
    at: new Date().toISOString(),
    error: String(error && (error.stack || error.message) || error).slice(0, 2000),
    limitations: ['Entry aborted before producing a usable candidate.'],
  }, null, 2))
  console.error(error)
  process.exitCode = 1
}
