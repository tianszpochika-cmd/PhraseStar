// Home H5 synthetic UI harness. Playwright route.fulfill only.
// No listener on 18183, no real IAM/Gateway, no auth body or token logs.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(__dirname, '../../..')
const ARTIFACT = path.resolve(process.env.HOME_H5_ARTIFACT || path.join(ROOT, 'apps/mobile/dist/build/h5'))
const PAGE_ORIGIN = 'http://synthetic.invalid'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const TOKEN = 'ui-synthetic-not-a-valid-credential'
const SUBJECT = 'ui-home-synthetic'
const FOREIGN_SUBJECT = 'ui-home-other-account'
const ALLOWED = new Set([
  '/api/v1/auth/login',
  '/api/v1/auth/token/refresh',
  '/api/v1/auth/logout',
  '/api/v1/iam/principal/me',
  '/api/v1/iam/permissions',
  '/api/v1/learner/targets',
  '/api/v1/learner/profile',
  '/api/v1/learner/preferences',
  '/api/v1/learner/home',
  '/api/v1/content/learner/catalog',
  '/api/v1/learning/today',
])

function auditOutput() {
  const requested = process.env.UI_AUDIT_OUTPUT
  if (typeof requested === 'string' && requested.length > 0) {
    if (!path.isAbsolute(requested)) throw new Error('UI_AUDIT_OUTPUT must be an absolute path')
    fs.mkdirSync(requested, { recursive: true })
    return requested
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), 'home-ui-'))
}

const OUT = auditOutput()
const GROUP = process.env.UI_AUDIT_GROUP || 'all'
const sources = [
  'apps/mobile/src/pages/home/home.vue',
  'apps/mobile/src/domain/home-page.ts',
  'apps/mobile/src/theme/figma-r4-assets.ts',
  'packages/i18n/src/mobile-experience.ts',
  'apps/mobile/tests/ui-home.e2e.cjs',
  'apps/mobile/tests/home-page.test.mjs',
  'apps/mobile/tests/onboarding-resume-step.test.mjs',
]
const hashFile = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const sourceHashes = Object.fromEntries(sources.map((file) => [file, hashFile(path.join(ROOT, file))]))
const indexPath = path.join(ARTIFACT, 'index.html')
const report = {
  at: new Date().toISOString(),
  scope: 'MB007_HOME_SYNTHETIC_UI_ONLY',
  sid: '91c9ab9d-03da-4d4f-a8b4-3ea04dda4bf3',
  group: GROUP,
  transport: 'playwright route.fulfill',
  origins: { page: PAGE_ORIGIN, iam: IAM_ORIGIN, gateway: GATEWAY_ORIGIN },
  artifact: ARTIFACT,
  artifactIndexSha256: fs.existsSync(indexPath) ? hashFile(indexPath) : null,
  realHttp: 'NOT_RUN',
  browser: 'PENDING',
  dod: false,
  sourceHashes,
  checks: [],
  matrix: [],
  pageErrors: [],
  consoleErrors: [],
  fixtureRequests: [],
  unknownApi: [],
  externalAborts: [],
}
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2))
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.json': 'application/json',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
}
let browser

function corsHeaders(request) {
  const requested = typeof request.headerValue === 'function' ? request.headerValue('access-control-request-headers') : undefined
  return {
    'access-control-allow-origin': PAGE_ORIGIN,
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': requested || 'authorization,content-type,idempotency-key,if-match,accept-language',
    vary: 'origin',
  }
}

function serveArtifact(route, url) {
  const relative = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
  const root = path.resolve(ARTIFACT)
  const direct = path.resolve(root, relative)
  if (direct !== root && !direct.startsWith(root + path.sep)) return route.abort()
  const file = fs.existsSync(direct) && fs.statSync(direct).isFile()
    ? direct
    : (!path.extname(relative) && fs.existsSync(path.join(root, 'index.html')) ? path.join(root, 'index.html') : '')
  if (!file) return route.fulfill({ status: 404, contentType: 'text/plain', body: 'missing artifact' })
  return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) })
}

function principal(subject = SUBJECT) {
  const permissions = ['learning.plan.read', 'learner.target.read', 'learner.profile.read', 'learner.preference.read']
  const adultGate = { status: 'PASSED', learningAccess: 'ELIGIBLE' }
  return {
    principal: { subject, roles: [], permissions, adultGate },
    roles: [],
    permissions,
    adultGate,
    learningAccess: 'ELIGIBLE',
    consentState: { accepted: true, unsatisfiedPurposes: [], requiredPurposes: ['ACCOUNT_TERMS', 'PRIVACY_NOTICE', 'ADULT_LEARNING_ELIGIBILITY'] },
  }
}

function tasksFor(mode) {
  const longTitle = '这是一条很长的服务端任务标题，用来检查三百二十和三百九十宽度下换行后仍然留在列内并且不出现横向滚动。'
  if (mode === 'invalid') {
    return [
      { id: 'task-blank', title: '缺少内容引用', description: '没有内容编号', minutes: 5, status: 'AVAILABLE', contentCode: '' },
      { id: 'task-open', title: '有效练习', description: '服务端内容', minutes: 8, status: 'AVAILABLE', contentCode: 'course-open' },
    ]
  }
  if (mode === 'partial') {
    return [
      { id: 'task-block', title: '暂时打不开的任务', description: '服务端未提供可学内容', minutes: 5, status: 'UNAVAILABLE', contentCode: 'course-blocked', unavailableReason: '内容暂不可用' },
      { id: 'task-open', title: '有效练习', description: '服务端内容', minutes: 8, status: 'IN_PROGRESS', contentCode: 'course-open' },
    ]
  }
  if (mode === 'guide' || mode === 'empty') return []
  if (mode === 'long') {
    return [{ id: 'task-long', title: longTitle, description: longTitle, minutes: 8, status: 'AVAILABLE', contentCode: 'course-open' }]
  }
  return [
    { id: 'task-open', title: '跟读短句', description: '服务端任务', minutes: 8, status: 'AVAILABLE', contentCode: 'course-open' },
    { id: 'task-done', title: '已学词汇', description: '已完成', minutes: 7, status: 'COMPLETED', contentCode: 'course-done' },
  ]
}

function homeBody(mode) {
  const tasks = tasksFor(mode)
  const completed = tasks.filter((task) => task.status === 'COMPLETED').reduce((sum, task) => sum + task.minutes, 0)
  return {
    projectionVersion: 1,
    tasks,
    completedMinutes: mode === 'stale' ? 0 : completed,
    targetMinutes: 15,
    stale: mode === 'stale',
    contentStatus: mode === 'unavailable' ? 'UNAVAILABLE' : 'READY',
  }
}

function catalogBody(mode) {
  if (mode === 'unavailable' || mode === 'empty' || mode === 'guide') return { items: [] }
  const summary = mode === 'long'
    ? '这是一条很长的课程简介，用来确认书架卡片在窄宽度下换行，而不是把页面撑出横向滚动。'
    : '服务端课程简介'
  return { items: [{ contentCode: 'course-open', contentType: 'COURSE', title: mode === 'long' ? '很长的课程名称用于换行检查' : '入门短句', summary, availability: 'PUBLISHED', contentLocale: 'en-US' }] }
}

function todayBody(mode) {
  if (mode === 'guide' || mode === 'empty') return { items: [], planVersion: 0, emptyReason: 'NO_PLAN', targetMinutes: 15 }
  return { planId: 'plan-synthetic', items: [{ itemId: 'item-1', arrangement: 'DUE' }], planVersion: 1, targetMinutes: 15, status: 'ACTIVE' }
}

async function fillControl(page, selector, value) {
  const host = page.locator(selector)
  await host.waitFor()
  const inner = host.locator('input')
  if (await inner.count()) await inner.first().fill(value)
  else await host.fill(value)
}

async function open(mode, width = 390, locale = 'zh-CN', theme = 'light', motion = 'reduce', height = 844) {
  const context = await browser.newContext({
    viewport: { width, height },
    reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
    locale,
  })
  const state = { counts: { principal: 0, home: 0, unknown: 0 }, releaseHold: null, onHeld: null, holdPath: null, holdPrincipalIndex: null, holdConsumed: false }
  if (mode === 'loading') state.holdPath = '/api/v1/learner/home'
  if (mode === 'late') state.holdPrincipalIndex = 2
  const held = new Promise((resolve) => { state.onHeld = resolve })
  await context.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    if (url.origin === PAGE_ORIGIN) {
      if (url.pathname.startsWith('/api/v1/')) {
        report.unknownApi.push({ mode, method, origin: url.origin, path: url.pathname })
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ code: 'NOT_FOUND' }) })
      }
      return serveArtifact(route, url)
    }
    if (url.origin !== IAM_ORIGIN && url.origin !== GATEWAY_ORIGIN) {
      report.externalAborts.push({ mode, method, origin: url.origin, path: url.pathname })
      return route.abort()
    }
    const headers = { ...corsHeaders(request), 'content-type': 'application/json' }
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders(request), body: '' })
      return
    }
    report.fixtureRequests.push({ mode, method, origin: url.origin, path: url.pathname })
    if (!ALLOWED.has(url.pathname)) {
      state.counts.unknown += 1
      report.unknownApi.push({ mode, method, origin: url.origin, path: url.pathname })
      await route.fulfill({ status: 404, headers, body: JSON.stringify({ code: 'NOT_FOUND' }) })
      return
    }
    if (method === 'GET' && url.pathname === '/api/v1/iam/principal/me') {
      state.counts.principal += 1
      if (state.holdPrincipalIndex && state.counts.principal === state.holdPrincipalIndex) {
        await new Promise((resolve) => { state.releaseHold = resolve; state.onHeld?.(); state.onHeld = null })
      }
    }
    if (state.holdPath && method === 'GET' && url.pathname === state.holdPath && !state.holdConsumed) {
      state.holdConsumed = true
      await new Promise((resolve) => { state.releaseHold = resolve; state.onHeld?.(); state.onHeld = null })
    }
    if (method === 'GET' && url.pathname === '/api/v1/learner/home') state.counts.home += 1
    let status = 200
    let data = {}
    if (url.origin === IAM_ORIGIN) {
      if (method === 'POST' && url.pathname === '/api/v1/auth/login') data = { accessToken: TOKEN, adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } }
      else if (method === 'POST' && url.pathname === '/api/v1/auth/token/refresh') {
        status = mode === 'unauthorized' ? 401 : 200
        data = status === 200 ? { accessToken: TOKEN, adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } } : { code: 'INVALID_REFRESH_TOKEN' }
      } else { status = 404; data = { code: 'NOT_FOUND' }; state.counts.unknown += 1; report.unknownApi.push({ mode, method, origin: url.origin, path: url.pathname }) }
    } else if (url.pathname === '/api/v1/iam/principal/me' || url.pathname === '/api/v1/iam/permissions') {
      const switched = mode === 'account-late' && state.counts.principal >= 2
      data = principal(switched ? FOREIGN_SUBJECT : SUBJECT)
    } else if (url.pathname === '/api/v1/learner/targets') data = { goalCode: 'FOUNDATION', dailyQuotaMinutes: 15, stateVersion: 1 }
    else if (url.pathname === '/api/v1/learner/profile') data = { stateVersion: 0 }
    else if (url.pathname === '/api/v1/learner/preferences') {
      data = { stateVersion: 0, uiLocale: locale, contentLocale: 'en-US', timezone: 'Asia/Shanghai', themeMode: 'SYSTEM', highContrast: false, motionMode: motion === 'reduce' ? 'REDUCED' : 'FULL' }
    } else if (url.pathname === '/api/v1/learner/home') {
      if (mode === 'denied') { status = 403; data = { code: 'ACCESS_DENIED' } }
      else if (mode === 'consent') { status = 403; data = { code: 'CONSENT_REQUIRED' } }
      else if (mode === 'unauthorized') { status = 401; data = { code: 'UNAUTHORIZED' } }
      else if (mode === 'failure') { status = 500; data = { code: 'SERVICE_UNAVAILABLE' } }
      else data = homeBody(mode)
    } else if (url.pathname === '/api/v1/content/learner/catalog') data = catalogBody(mode)
    else if (url.pathname === '/api/v1/learning/today') data = todayBody(mode)
    else if (url.pathname === '/api/v1/auth/logout') data = { success: true }
    else { status = 404; data = { code: 'NOT_FOUND' } }
    await route.fulfill({ status, headers, body: JSON.stringify(data) })
  })
  const page = await context.newPage()
  const errorsBefore = report.pageErrors.length
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()) })
  await page.goto(`${PAGE_ORIGIN}/#/pages/login/login?theme=${encodeURIComponent(theme)}&uiLocale=${encodeURIComponent(locale)}&returnTo=%2Fpages%2Fhome%2Fhome`, { waitUntil: 'domcontentloaded' })
  await fillControl(page, '#mobile-login-identifier-host', SUBJECT)
  await fillControl(page, '#mobile-login-password-host', 'SyntheticOnly123')
  await page.locator('.login-submit').click()
  const heldOrTimeout = Promise.race([
    held,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Synthetic ${mode} request was not held`)), 15000)),
  ])
  if (mode === 'late' || mode === 'loading') await heldOrTimeout
  else if (mode === 'denied') await page.waitForFunction(() => location.hash.includes('/pages/forbidden/forbidden'))
  else if (mode === 'consent') await page.waitForFunction(() => location.hash.includes('/pages/onboarding/onboarding'))
  else if (mode === 'unauthorized') {
    await page.waitForFunction(() => location.hash.includes('/pages/home/home'), null, { timeout: 15000 }).catch(() => {})
    await page.waitForFunction(() => location.hash.includes('/pages/login/login'))
  } else if (mode === 'failure') await page.locator('.home-block__title').waitFor()
  else await page.locator('.home-title').waitFor()
  return {
    context,
    page,
    state,
    errorsBefore,
    release() { const resolve = state.releaseHold; state.releaseHold = null; if (resolve) resolve() },
  }
}

function assertNoNewPageErrors(session) {
  assert.deepEqual(report.pageErrors.slice(session.errorsBefore), [])
}

async function homeFacts(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.home-page')
    const columns = document.querySelector('.home-columns')
    const text = root ? root.innerText : ''
    return {
      hash: location.hash,
      title: document.querySelector('.home-title')?.textContent || '',
      theme: document.documentElement.dataset.theme || '',
      motion: root?.getAttribute('data-motion') || '',
      columns: columns ? getComputedStyle(columns).display : '',
      width: root ? Math.round(root.getBoundingClientRect().width) : 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      text,
    }
  })
}

async function ready() {
  const session = await open('ready')
  const facts = await homeFacts(session.page)
  assert.equal(facts.title, '今日学习')
  assert.equal(facts.hash.startsWith('#/pages/home/home'), true)
  assert.match(facts.text, /跟读短句/)
  assert.match(facts.text, /已学 7 分钟/)
  assert.doesNotMatch(facts.text, /12天|33%|40%/)
  assert.equal(facts.overflow, false)
  assert.equal(session.state.counts.unknown, 0)
  assert.ok(session.state.counts.home >= 1)
  report.checks.push({ name: 'ready-real-minutes', homeGets: session.state.counts.home, result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function guide() {
  const session = await open('guide')
  const button = session.page.getByRole('button', { name: '进入测评' })
  await button.waitFor()
  const text = await session.page.locator('.home-page').innerText()
  assert.doesNotMatch(text, /剩余步骤/)
  assert.doesNotMatch(text, /定级/)
  await button.click()
  await session.page.waitForFunction(() => location.hash.includes('/pages/assessment/assessment'))
  report.checks.push({ name: 'guide-cta-assessment', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function invalid() {
  const session = await open('invalid')
  assert.equal(await session.page.getByRole('button', { name: /缺少内容引用/ }).count(), 0)
  await session.page.getByRole('button', { name: /有效练习/ }).click()
  await session.page.waitForFunction(() => location.hash.includes('/pages/learn/learn') && location.hash.includes('contentCode=course-open') && location.hash.includes('taskId=task-open'))
  assert.equal(session.page.url().includes('contentCode=&'), false)
  report.checks.push({ name: 'invalid-content-ref-skipped', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function denied() {
  const session = await open('denied')
  assert.equal(await session.page.locator('#mobile-forbidden-title').count(), 1)
  assert.equal(session.page.url().includes('/pages/home/home'), false)
  report.checks.push({ name: 'access-denied-forbidden', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function consent() {
  const session = await open('consent')
  assert.equal(session.page.url().includes('/pages/onboarding/onboarding'), true)
  report.checks.push({ name: 'consent-required-onboarding', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function unauthorized() {
  const session = await open('unauthorized')
  assert.equal(session.page.url().includes('/pages/login/login'), true)
  assert.ok(session.state.counts.home >= 1)
  report.checks.push({ name: 'home-401-returns-login', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function failure() {
  const session = await open('failure')
  const title = await session.page.locator('.home-block__title').innerText()
  assert.equal(title, '今日任务暂不可用')
  const text = await session.page.locator('.home-page').innerText()
  assert.doesNotMatch(text, /还没有学习计划|书架里还没有/)
  report.checks.push({ name: 'home-failure-not-empty', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function empty() {
  const session = await open('empty')
  const text = await session.page.locator('.home-page').innerText()
  assert.match(text, /还没有学习计划/)
  assert.doesNotMatch(text, /0%|12天|0 项/)
  report.checks.push({ name: 'empty-plan-no-fake-progress', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function unavailable() {
  const session = await open('unavailable')
  const text = await session.page.locator('.home-page').innerText()
  assert.match(text, /课程列表暂不可用/)
  assert.doesNotMatch(text, /书架里还没有可学习的内容/)
  report.checks.push({ name: 'shelf-unavailable', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function partial() {
  const session = await open('partial')
  assert.equal(await session.page.getByRole('button', { name: /暂时打不开的任务/ }).count(), 0)
  const text = await session.page.locator('.home-page').innerText()
  assert.match(text, /内容暂不可用/)
  report.checks.push({ name: 'partial-task-not-linked', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function loading() {
  const session = await open('loading')
  const text = await session.page.locator('.home-page').innerText()
  assert.match(text, /正在读取今日任务|正在确认学习状态/)
  assert.doesNotMatch(text, /书架里还没有|今天还没有安排任务|还没有学习计划/)
  session.release()
  await session.page.getByText('跟读短句').waitFor()
  report.checks.push({ name: 'loading-not-empty', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function late() {
  const session = await open('late')
  assert.equal(session.state.counts.home, 0)
  await session.page.evaluate(() => { window.location.hash = '#/pages/settings/settings' })
  await session.page.waitForFunction(() => location.hash.includes('/pages/settings/settings'))
  session.release()
  await session.page.waitForLoadState('networkidle')
  assert.equal(session.state.counts.home, 0)
  report.checks.push({ name: 'owner-late-no-home-get', homeGets: session.state.counts.home, result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function accountLate() {
  const session = await open('account-late')
  await session.page.locator('.home-title').waitFor()
  const text = await session.page.locator('.home-page').innerText()
  assert.doesNotMatch(text, new RegExp(FOREIGN_SUBJECT))
  report.checks.push({ name: 'mismatched-principal-does-not-paint-foreign-subject', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function keyboard() {
  const session = await open('ready')
  const cta = session.page.locator('.home-hero__cta')
  await cta.focus()
  const focused = await cta.evaluate((node) => node === document.activeElement || node.contains(document.activeElement))
  assert.equal(focused, true)
  await session.page.keyboard.press('Enter')
  await session.page.waitForFunction(() => location.hash.includes('/pages/learn/learn') && location.hash.includes('contentCode=course-open'))
  report.checks.push({ name: 'keyboard-cta', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function matrix() {
  const widths = [320, 390, 768, 1024]
  for (const width of widths) {
    for (const locale of ['zh-CN', 'en-US']) {
      for (const theme of ['light', 'dark', 'high-contrast']) {
        const height = width >= 768 ? 1024 : 844
        const session = await open('ready', width, locale, theme, 'reduce', height)
        const facts = await homeFacts(session.page)
        assert.equal(facts.theme, theme === 'high-contrast' ? 'high-contrast' : theme)
        assert.equal(facts.overflow, false)
        assert.equal(facts.motion === 'off' || facts.motion === 'reduced', true)
        assert.equal(facts.columns, width >= 768 ? 'grid' : 'block')
        assert.equal(facts.title, locale === 'en-US' ? "Today's learning" : '今日学习')
        assert.doesNotMatch(facts.text, /12天|33%|40%/)
        const shot = `home-ready-${width}-${locale}-${theme}-reduced.png`
        await session.page.screenshot({ path: path.join(OUT, shot), fullPage: true })
        report.matrix.push({ width, locale, theme, motion: facts.motion, columns: facts.columns, overflow: facts.overflow, shot, result: 'PASS' })
        assertNoNewPageErrors(session)
        await session.context.close()
        save()
      }
    }
  }
  for (const width of [320, 390]) {
    const session = await open('long', width, 'zh-CN', 'light', 'reduce', 844)
    const facts = await homeFacts(session.page)
    assert.equal(facts.overflow, false)
    assert.match(facts.text, /很长的服务端任务标题/)
    const shot = `home-long-${width}-zh-CN-light-reduced.png`
    await session.page.screenshot({ path: path.join(OUT, shot), fullPage: true })
    report.matrix.push({ width, locale: 'zh-CN', theme: 'light', copy: 'long', overflow: facts.overflow, shot, result: 'PASS' })
    assertNoNewPageErrors(session)
    await session.context.close()
  }
  const full = await open('ready', 390, 'zh-CN', 'light', 'full', 844)
  const fullFacts = await homeFacts(full.page)
  await full.page.screenshot({ path: path.join(OUT, 'home-ready-390-zh-CN-light-full-motion.png'), fullPage: true })
  report.matrix.push({ width: 390, locale: 'zh-CN', theme: 'light', motion: fullFacts.motion, shot: 'home-ready-390-zh-CN-light-full-motion.png', result: 'PASS' })
  assertNoNewPageErrors(full)
  await full.context.close()
}

function assertCleanReport() {
  const blob = JSON.stringify(report)
  assert.equal(blob.includes(TOKEN), false)
  assert.equal(blob.toLowerCase().includes('syntheticonly'), false)
  assert.equal(blob.toLowerCase().includes('authorization'), false)
}

const groups = {
  ready, guide, invalid, denied, consent, unauthorized, failure, empty, unavailable, partial, loading, late, 'account-late': accountLate, keyboard, matrix,
}

;(async () => {
  if (!fs.existsSync(indexPath)) throw new Error(`Compiled H5 index is missing at ${indexPath}`)
  browser = await chromium.launch()
  report.browser = 'LAUNCHED'
  const selected = GROUP === 'all' ? Object.keys(groups) : [GROUP]
  for (const name of selected) {
    if (!groups[name]) throw new Error(`Unknown UI_AUDIT_GROUP ${name}`)
    await groups[name]()
    save()
  }
  assert.equal(report.pageErrors.length, 0)
  assertCleanReport()
  report.status = 'PASS_SYNTHETIC_UI_NOT_DOD'
  report.dod = false
  save()
  console.log(JSON.stringify({ status: report.status, group: GROUP, checks: report.checks.length, matrix: report.matrix.length, output: OUT }))
})().catch(async (error) => {
  report.status = 'FAIL'
  report.dod = false
  report.failure = String(error && error.stack || error)
  save()
  console.error(report.failure)
  process.exitCode = 1
}).finally(async () => { if (browser) await browser.close() })
