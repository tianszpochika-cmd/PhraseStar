'use strict'
/* Today H5 observer. One Chromium launch, three synthetic origins, route.fulfill only.
 * Does not bind 18183 or any other port. Root runs this file.
 * A sandbox launch fault is NOT_RUN_SANDBOX, not a product failure.
 */
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const REPO = path.resolve(__dirname, '..', '..', '..')
const ART = path.join(REPO, 'apps/mobile/dist/build/h5')
const OUT = process.env.TODAY_E2E_OUT || '/tmp/grok-today-figma-layout-09'
const BASE = 'https://b4-ui.synthetic.invalid'
const IAM = 'https://127.0.0.1:18087'
const GATEWAY = 'http://127.0.0.1:18070'
const RESULT = path.join(OUT, 'browser.json')

function shaFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') }
function loadPlaywright() {
  const roots = [REPO, path.join(REPO, 'apps/mobile')]
  for (const root of roots) {
    try { return createRequire(path.join(root, 'package.json'))('playwright') } catch { /* next */ }
  }
  throw new Error('playwright module not found')
}
const CORS = {
  'access-control-allow-origin': BASE,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PUT,PATCH,DELETE',
  'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-request-id,accept-language,x-content-locale',
  'access-control-max-age': '600',
  vary: 'Origin',
}
function headers(extra = {}) { return { ...CORS, 'cache-control': 'no-store', ...extra } }
function json(route, status, body) {
  return route.fulfill({ status, headers: headers({ 'content-type': 'application/json; charset=utf-8' }), body: JSON.stringify(body) })
}
function typeFor(file) {
  return ({
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json; charset=utf-8',
    '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream'
}
function principalBody() {
  return { data: { principal: { subject: 'subject-a' }, permissions: ['learning.plan.read'], roles: ['LEARNER'], adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' }, consentState: { accepted: true, readable: true, version: 'synthetic-v1', unsatisfiedPurposes: [] } } }
}
function tokenBody() {
  return { data: { accessToken: 'synthetic-access-token', refreshToken: 'synthetic-refresh-token', deviceId: 'synthetic-device', sessionId: 'synthetic-session', adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } } }
}
function homeBody(scenario) {
  if (scenario === 'no-plan') {
    return { data: { projectionVersion: 3, contentEpoch: 2, stale: false, completedMinutes: 0, targetMinutes: 20, tasks: [] } }
  }
  return {
    data: {
      projectionVersion: 3,
      contentEpoch: 2,
      stale: false,
      completedMinutes: 8,
      targetMinutes: 20,
      tasks: [
        { id: 't-done', title: '问候复习', description: '服务端说明甲', minutes: 5, status: 'COMPLETED', contentCode: 'greet' },
        { id: 't-live', title: '服务端进行中的课', description: '服务端说明乙', minutes: 8, status: 'IN_PROGRESS', contentCode: 'live-1' },
        { id: 't-blank', title: '没有内容指针', description: '服务端说明丙', minutes: 4, status: 'AVAILABLE', practiceRef: 'dropped-ref' },
      ],
    },
  }
}
function planBody(scenario) {
  if (scenario === 'no-plan') {
    return { data: { planId: '', status: 'EMPTY', planVersion: 0, targetMinutes: 20, emptyReason: 'NO_PLAN', itemCount: 0, deferredCount: 0, items: [] } }
  }
  return { data: { planId: 'plan-1', status: 'ACTIVE', planVersion: 2, targetMinutes: 20, emptyReason: 'READY', itemCount: 2, deferredCount: 2, items: [] } }
}
function catalogBody(scenario) {
  if (scenario === 'no-plan' || scenario === 'offline') return { data: { items: [] } }
  return { data: { items: [{ contentCode: 'live-1', contentType: 'COURSE', title: '服务端进行中的课', summary: '服务端目录', contentLocale: 'en-US', availability: 'PUBLISHED' }] } }
}

function check(result, name, ok, expected, actual) {
  result.assertions.push({ name, ok: Boolean(ok), expected, actual })
  if (!ok) result.failed += 1
}

async function createContext(browser, scenario) {
  const state = { scenario, requests: [], unknown: [], pageErrors: [] }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true, locale: 'zh-CN' })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.origin === BASE) {
      const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const file = path.resolve(ART, rel)
      if (!(file === path.join(ART, 'index.html') || file.startsWith(ART + path.sep)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' })
        return route.fulfill({ status: 404, body: 'not found' })
      }
      return route.fulfill({ status: 200, contentType: typeFor(file), body: fs.readFileSync(file) })
    }
    if ((url.origin === IAM || url.origin === GATEWAY) && url.pathname.startsWith('/api/v1/')) return handleApi(route, url, state)
    return route.abort('blockedbyclient')
  })
  const page = await context.newPage()
  page.on('pageerror', (error) => state.pageErrors.push(String(error && error.message || error).slice(0, 300)))
  return { context, page, state }
}

async function handleApi(route, url, state) {
  const method = route.request().method()
  const pathname = url.pathname
  state.requests.push({ method, path: pathname })
  if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: headers(), body: '' })
  if (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/token/refresh') return json(route, 200, tokenBody())
  if (pathname === '/api/v1/auth/logout') return route.fulfill({ status: 204, headers: headers(), body: '' })
  if (pathname === '/api/v1/iam/principal/me' || pathname === '/api/v1/iam/permissions') return json(route, 200, principalBody())
  if (pathname === '/api/v1/learner/profile') return json(route, 200, { data: { profile: { principalId: 'subject-a', status: 'ACTIVE', uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', stateVersion: 1 } } })
  if (pathname === '/api/v1/learner/preferences') return json(route, 200, { data: { stateVersion: 1, uiLocale: 'zh-CN', contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL' } })
  if (pathname === '/api/v1/learner/targets') return json(route, 200, { data: { goalCode: 'COLLEGE_CET', dailyQuotaMinutes: 15 } })
  if (pathname === '/api/v1/learner/home') {
    if (state.scenario === 'offline') return json(route, 500, { error: { code: 'SYNTHETIC_HOME_FAILED' } })
    return json(route, 200, homeBody(state.scenario))
  }
  if (pathname === '/api/v1/content/learner/catalog') return json(route, 200, catalogBody(state.scenario))
  if (pathname === '/api/v1/learning/today') return json(route, 200, planBody(state.scenario))
  if (method === 'GET' && ['/api/v1/content/learner/live-1', '/api/v1/learning/review-queue'].includes(pathname)) {
    return json(route, 503, { error: { code: 'SYNTHETIC_LEARN_DESTINATION_NOT_UNDER_TEST' } })
  }
  state.unknown.push({ method, path: pathname })
  return json(route, 404, { error: { code: 'SYNTHETIC_NOT_CONFIGURED', path: pathname } })
}

async function login(page) {
  await page.waitForSelector('.login-submit', { timeout: 20000 })
  let identifier = page.locator('#mobile-login-identifier-host .uni-input-input')
  if (!(await identifier.count())) identifier = page.locator('input[name="identifier"]')
  let password = page.locator('#mobile-login-password-host .uni-input-input')
  if (!(await password.count())) password = page.locator('input[name="password"]')
  await identifier.first().fill('a@example.invalid')
  await password.first().fill('synthetic-password')
  await page.locator('.login-submit').click()
}

async function openToday(page) {
  await page.goto(`${BASE}/#/pages/today/today`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await login(page)
  await page.waitForSelector('.today', { timeout: 20000 })
}

function writeResult(payload) {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(RESULT, `${JSON.stringify(payload, null, 2)}\n`)
}

async function main() {
  const result = {
    session: '0b845774-2301-4f47-a75a-312ab4afff1c',
    kind: 'GROK_TODAY_H5_08',
    at: new Date().toISOString(),
    classification: 'NOT_RUN',
    productFailure: false,
    failed: 0,
    assertions: [],
    cases: {},
  }
  if (!fs.existsSync(path.join(ART, 'index.html'))) {
    result.classification = 'ARTIFACT_MISSING'
    result.productFailure = false
    result.error = `missing ${path.join(ART, 'index.html')}`
    writeResult(result)
    process.exit(2)
  }
  let browser = null
  try {
    browser = await loadPlaywright().chromium.launch({ headless: true, args: ['--allow-running-insecure-content'] })
    const signedOut = await createContext(browser, 'ready')
    try {
      await signedOut.page.goto(`${BASE}/#/pages/today/today`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await signedOut.page.waitForSelector('.login-submit', { timeout: 20000 })
      const signedOutText = await signedOut.page.locator('body').innerText()
      const signedOutHash = await signedOut.page.evaluate(() => location.hash)
      check(result, 'signed-out today redirects to login', String(signedOutHash).includes('/pages/login/login'), '/pages/login/login', signedOutHash)
      check(result, 'signed-out today does not paint the login-required frame', !signedOutText.includes('登录状态已失效'), 'absent', signedOutText.includes('登录状态已失效'))
      result.cases.signedOut = { hash: signedOutHash, unknown: signedOut.state.unknown, pageErrors: signedOut.state.pageErrors }
    } finally { await signedOut.context.close() }

    const ready = await createContext(browser, 'ready')
    try {
      await ready.page.addInitScript(() => {
        const original = Storage.prototype.setItem
        window.__todayNavIntent = []
        Storage.prototype.setItem = function (key, value) {
          if (key === 'yx.navigation.query.v1') {
            try {
              const parsed = JSON.parse(value)
              window.__todayNavIntent.push({ path: parsed.path, contentCode: parsed.params?.contentCode, taskId: parsed.params?.taskId })
            } catch { /* fixture intent must be valid JSON */ }
          }
          return original.call(this, key, value)
        }
      })
      await openToday(ready.page)
      await ready.page.waitForSelector('[data-visual="ready"]', { timeout: 20000 })
      const text = await ready.page.locator('body').innerText()
      check(result, 'ready shows the server task title', text.includes('服务端进行中的课'), true, text.includes('服务端进行中的课'))
      check(result, 'ready percent comes from 8/20', text.includes('40%'), '40%', text.includes('40%'))
      check(result, 'ready omits the sample arc percent', !text.includes('67%'), 'absent', text.includes('67%'))
      check(result, 'ready omits the sample task title', !text.includes('一般现在时'), 'absent', text.includes('一般现在时'))
      check(result, 'blank pointer is not a continue target', !text.includes('继续：没有内容指针'), 'absent', text.includes('继续：没有内容指针'))
      check(result, 'ready does not paint the raw algorithm version', !text.includes('SM2_Q03_V1'), 'absent', text.includes('SM2_Q03_V1'))
      await ready.page.getByText('继续：服务端进行中的课', { exact: false }).click()
      await ready.page.waitForFunction(() => location.hash === '#/pages/learn/learn', null, { timeout: 5000 })
      await ready.page.waitForTimeout(300)
      const observed = await ready.page.evaluate(() => ({ hash: location.hash, intent: window.__todayNavIntent }))
      const target = observed.intent.find(item => item.path === '/pages/learn/learn')
      check(result, 'continue opens Learn with exact tab intent and content read', observed.hash === '#/pages/learn/learn' && target?.contentCode === 'live-1' && target?.taskId === 't-live' && ready.state.requests.some(item => item.method === 'GET' && item.path === '/api/v1/content/learner/live-1') && ready.state.unknown.length === 0, { hash: '#/pages/learn/learn', contentCode: 'live-1', taskId: 't-live' }, { ...observed, unknown: ready.state.unknown })
      result.cases.ready = { ...observed, unknown: ready.state.unknown, pageErrors: ready.state.pageErrors }
    } finally { await ready.context.close() }

    const noPlan = await createContext(browser, 'no-plan')
    try {
      await openToday(noPlan.page)
      await noPlan.page.waitForSelector('[data-visual="no-plan"]', { timeout: 20000 })
      const text = await noPlan.page.locator('body').innerText()
      check(result, 'no-plan shows the contract title', text.includes('还没有学习计划'), true, text.includes('还没有学习计划'))
      check(result, 'no-plan action is setup', text.includes('开始设置'), true, text.includes('开始设置'))
      check(result, 'no-plan does not use the rejected placement label', !text.includes('去做定级测评'), 'absent', text.includes('去做定级测评'))
      check(result, 'no-plan does not show the generic empty line', !text.includes('今天还没有安排任务。'), 'absent', text.includes('今天还没有安排任务。'))
      check(result, 'no-plan does not paint the raw algorithm version', !text.includes('SM2_Q03_V1'), 'absent', text.includes('SM2_Q03_V1'))
      await noPlan.page.getByText('开始设置', { exact: true }).click()
      await noPlan.page.waitForTimeout(300)
      const hash = await noPlan.page.evaluate(() => location.hash)
      check(result, 'no-plan opens onboarding', hash.includes('/pages/onboarding/onboarding'), '/pages/onboarding/onboarding', hash)
      result.cases.noPlan = { hash, unknown: noPlan.state.unknown, pageErrors: noPlan.state.pageErrors }
    } finally { await noPlan.context.close() }

    const offline = await createContext(browser, 'offline')
    try {
      await openToday(offline.page)
      await offline.page.waitForSelector('[data-visual="offline"]', { timeout: 20000 })
      const text = await offline.page.locator('body').innerText()
      check(result, 'home failure shows the retained offline copy', text.includes('今日任务暂时无法读取'), true, text.includes('今日任务暂时无法读取'))
      check(result, 'home failure is not an empty task list', !text.includes('今天还没有安排任务。'), 'absent', text.includes('今天还没有安排任务。'))
      check(result, 'home failure offers retry', text.includes('重试'), true, text.includes('重试'))
      result.cases.offline = { unknown: offline.state.unknown, pageErrors: offline.state.pageErrors }
    } finally { await offline.context.close() }

    result.classification = result.failed === 0 ? 'PASS' : 'FAIL'
    result.productFailure = result.failed > 0
  } catch (error) {
    const text = String(error && error.stack || error)
    const sandbox = /SEGV_ACCERR|signal 11|Target page, context or browser has been closed|bootstrap_check_in|Operation not permitted/i.test(text)
    result.classification = sandbox ? 'NOT_RUN_SANDBOX' : 'FAIL'
    result.productFailure = sandbox ? false : true
    result.error = text.slice(0, 800)
  } finally {
    if (browser) await browser.close().catch(() => {})
    writeResult(result)
  }
  if (result.classification !== 'PASS') process.exit(result.classification === 'NOT_RUN_SANDBOX' ? 0 : 1)
}

main()
