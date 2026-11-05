// Home H5 synthetic UI harness. Playwright route.fulfill only.
// No listener on 18183, no real IAM/Gateway, no auth body or token logs.
const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const crypto = require('node:crypto')

const ROOT = path.resolve(process.env.HOME_H5_SOURCE_ROOT || path.join(__dirname, '../../..'))
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
  'apps/mobile/src/pages/home/HomeTabletNav.vue',
  'apps/mobile/src/domain/home-page.ts',
  'apps/mobile/src/domain/home-tablet.ts',
  'apps/mobile/src/theme/figma-r4-assets.ts',
  'packages/i18n/src/mobile-experience.ts',
  'apps/mobile/tests/ui-home.e2e.cjs',
  'apps/mobile/tests/home-page.test.mjs',
  'apps/mobile/tests/home-tablet.test.mjs',
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
  acceptedFixtures: [],
  injectedFailures: [],
  reproductions: [],
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

function pageHash(state) {
  try { return state.page ? new URL(state.page.url()).hash : '' } catch { return '' }
}

function hasIdempotencyKey(request) {
  return Object.entries(request.headers()).some(([name, value]) => name.toLowerCase() === 'idempotency-key' && String(value || '').length > 0)
}

function notificationPreferenceFixture() {
  return {
    data: [{
      category: 'LEARNING',
      channel: 'IN_APP',
      enabled: true,
      locale: 'zh-CN',
      consentVersion: 1,
      dndWindow: { startLocalTime: '00:00', endLocalTime: '00:00' },
      frequencyPolicy: 'IMMEDIATE',
      version: 1,
      updatedAt: '2026-11-05T00:00:00.000Z',
    }],
    meta: { hasMore: false, nextCursor: null },
  }
}

function supportClosureFixture() {
  return {
    data: {
      privacy: {
        deletionCopy: '删除申请受理后，访问停止和各服务处理完成要分开看。',
        audioCopy: '音频保留策略尚未批准。',
        workerGap: true,
        allComplete: false,
      },
    },
  }
}

function practiceSessionFixture() {
  return {
    data: {
      sessionId: 'b10-practice-synthetic',
      status: 'IN_PROGRESS',
      mode: 'PRACTICE',
      sessionType: 'DAILY_STREAM',
      stateVersion: 1,
      contentEpoch: 1,
      lastCheckpointSeq: 0,
      startedAt: '2026-11-05T00:00:00.000Z',
      pin: { contentVersionId: 25001, contentEpoch: 1 },
      items: [],
      answerSheet: [],
    },
  }
}

function contextualFixture(state, request, url, method, mode) {
  const pathName = url.pathname
  const settingsRead = state.settingsExit === true && pageHash(state).includes('/pages/settings/settings')
  if (pathName === '/api/v1/notifications/preferences' || pathName === '/api/v1/support/tickets') {
    const preferences = pathName === '/api/v1/notifications/preferences'
    const query = preferences ? 'pageSize=100' : 'projection=it7'
    const queryOk = preferences ? url.searchParams.get('pageSize') === '100' : url.searchParams.get('projection') === 'it7'
    if (method === 'GET' && settingsRead && queryOk) {
      return {
        status: 200,
        data: preferences ? notificationPreferenceFixture() : supportClosureFixture(),
        record: { case: mode, method, path: pathName, query, status: 200, context: 'settings-exit' },
      }
    }
    return {
      status: 404,
      data: { code: 'NOT_FOUND' },
      unknown: true,
      reproduction: {
        case: mode,
        method,
        path: pathName,
        query: url.search,
        hash: pageHash(state),
        settingsExit: state.settingsExit === true,
        reason: 'settings read is only accepted as GET after the intentional settings exit',
      },
    }
  }
  if (pathName === '/api/v1/assessment/sessions') {
    const onPractice = state.practiceExit === true && pageHash(state).includes('/pages/b2-practice/b2-practice')
    let body = null
    try { body = JSON.parse(request.postData() || '') } catch { body = null }
    const contentVersionId = body && typeof body === 'object' ? body.contentVersionId : null
    const sessionMode = body && typeof body === 'object' ? body.mode : null
    const hasClientSessionRef = Boolean(body && typeof body.clientSessionRef === 'string' && body.clientSessionRef.length > 0)
    const idempotent = hasIdempotencyKey(request)
    const contract = method === 'POST' && contentVersionId === 25001 && sessionMode === 'PRACTICE' && hasClientSessionRef && idempotent
    const already = report.acceptedFixtures.some((item) => item.path === '/api/v1/assessment/sessions')
    if (onPractice && contract && !already) {
      return {
        status: 200,
        data: practiceSessionFixture(),
        record: {
          case: mode,
          method: 'POST',
          path: pathName,
          status: 200,
          context: 'practice-activation',
          contentVersionId: 25001,
          sessionMode: 'PRACTICE',
          sessionStatus: 'IN_PROGRESS',
          hasIdempotencyKey: true,
          hasClientSessionRef: true,
          writes: 1,
        },
      }
    }
    return {
      status: 404,
      data: { code: 'NOT_FOUND' },
      unknown: true,
      reproduction: {
        case: mode,
        method,
        path: pathName,
        hash: pageHash(state),
        onPractice,
        contentVersionId,
        sessionMode,
        hasClientSessionRef,
        hasIdempotencyKey: idempotent,
        extraWrite: already,
        reason: onPractice ? 'assessment session POST did not match one idempotent practice activation write' : 'assessment session POST outside practice activation',
      },
    }
  }
  return null
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
  const state = { counts: { principal: 0, home: 0, unknown: 0 }, releaseHold: null, onHeld: null, holdPath: null, holdPrincipalIndex: null, holdConsumed: false, settingsExit: false, practiceExit: false, page: null }
  if (mode === 'loading') state.holdPath = '/api/v1/learner/home'
  // Bootstrap, navigation guard, page access and resume principal reads run
  // before a private Home read; the fourth is the one that gates Home here.
  if (mode === 'late') state.holdPrincipalIndex = 4
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
    const exit = contextualFixture(state, request, url, method, mode)
    if (exit) {
      if (exit.unknown) {
        state.counts.unknown += 1
        report.unknownApi.push({ mode, method, origin: url.origin, path: url.pathname })
        report.reproductions.push(exit.reproduction)
      } else report.acceptedFixtures.push(exit.record)
      await route.fulfill({ status: exit.status, headers, body: JSON.stringify(exit.data) })
      return
    }
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
    if (status === 401 || status === 403 || status === 500) report.injectedFailures.push({ case: mode, method, path: url.pathname, status })
    await route.fulfill({ status, headers, body: JSON.stringify(data) })
  })
  const page = await context.newPage()
  state.page = page
  await page.addInitScript(() => {
    window.__yxNavWrites = []
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'yx.navigation.query.v1') {
        try { window.__yxNavWrites.push(JSON.parse(value)) } catch { window.__yxNavWrites.push(value) }
      }
      return original.call(this, key, value)
    }
  })
  const errorsBefore = report.pageErrors.length
  page.on('pageerror', (error) => report.pageErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    const matched = text.match(/status of (\d+)/)
    report.consoleErrors.push({ case: mode, status: matched ? Number(matched[1]) : null, text: text.slice(0, 180) })
  })
  await page.goto(`${PAGE_ORIGIN}/#/pages/login/login?theme=${encodeURIComponent(theme)}&uiLocale=${encodeURIComponent(locale)}&returnTo=%2Fpages%2Fhome%2Fhome`, { waitUntil: 'domcontentloaded' })
  await fillControl(page, '#mobile-login-identifier-host', SUBJECT)
  await fillControl(page, '#mobile-login-password-host', 'SyntheticOnly123')
  await page.locator('.login-submit').click()
  if (mode === 'late' || mode === 'loading') {
    await Promise.race([
      held,
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Synthetic ${mode} request was not held`)), 15000)),
    ])
  } else if (mode === 'denied') await page.waitForFunction(() => location.hash.includes('/pages/forbidden/forbidden'))
  else if (mode === 'consent') await page.waitForFunction(() => location.hash.includes('/pages/onboarding/onboarding'))
  else if (mode === 'unauthorized') {
    await page.waitForFunction(() => location.hash.includes('/pages/home/home'), null, { timeout: 15000 }).catch(() => {})
    await page.waitForFunction(() => location.hash.includes('/pages/login/login'))
  } else if (mode === 'failure') await page.locator('.home-block__title').waitFor()
  else if (mode === 'account-late') await page.waitForTimeout(4000)
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
    const tabbar = document.querySelector('uni-tabbar')
    const text = root ? root.innerText : ''
    const tabBarBox = tabbar ? tabbar.getBoundingClientRect() : null
    return {
      hash: location.hash,
      title: document.querySelector('.home-title')?.textContent || '',
      theme: document.documentElement.dataset.theme || '',
      motion: root?.getAttribute('data-motion') || '',
      columns: columns ? getComputedStyle(columns).display : '',
      width: root ? Math.round(root.getBoundingClientRect().width) : 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      rail: Boolean(document.querySelector('.home-nav--rail')),
      sidebar: Boolean(document.querySelector('.home-nav--sidebar')),
      tabbarVisible: Boolean(tabBarBox && tabBarBox.width > 0 && tabBarBox.height > 0 && getComputedStyle(tabbar).display !== 'none'),
      text,
    }
  })
}

async function ready() {
  const session = await open('ready')
  const facts = await homeFacts(session.page)
  assert.equal(facts.title, '今日学习')
  assert.equal(facts.hash, '#/')
  const route = await session.page.evaluate(() => {
    const entry = (window.__uniRoutes || []).find((item) => item.path === '/')
    return entry ? {
      path: entry.path,
      alias: entry.alias,
      metaRoute: entry.meta?.route,
      isTabBar: entry.meta?.isTabBar,
      isEntry: entry.meta?.isEntry,
      tabBarIndex: entry.meta?.tabBarIndex,
      titleText: entry.meta?.navigationBar?.titleText,
    } : null
  })
  assert.deepEqual(route, {
    path: '/',
    alias: '/pages/home/home',
    metaRoute: 'pages/home/home',
    isTabBar: true,
    isEntry: true,
    tabBarIndex: 0,
    titleText: '学习',
  })
  assert.match(facts.text, /跟读短句/)
  assert.match(facts.text, /已学 7 分钟/)
  assert.doesNotMatch(facts.text, /12天|33%|40%/)
  assert.equal(facts.overflow, false)
  assert.equal(session.state.counts.unknown, 0)
  assert.ok(session.state.counts.home >= 1)
  report.checks.push({ name: 'ready-real-minutes', homeGets: session.state.counts.home, result: 'PASS' })
  report.checks.push({ name: 'canonical-home-hash-and-router-alias', hash: facts.hash, route, result: 'PASS' })
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
  await session.page.waitForFunction(() => location.hash === '#/pages/learn/learn')
  const intent = await session.page.evaluate(() => window.__yxNavWrites[window.__yxNavWrites.length - 1])
  assert.deepEqual(intent, { path: '/pages/learn/learn', params: { contentCode: 'course-open', taskId: 'task-open' } })
  assert.equal(session.page.url().includes('contentCode=&'), false)
  assert.equal(session.page.url().includes('contentCode=course-open'), false)
  report.checks.push({ name: 'invalid-content-ref-skipped', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function denied() {
  const session = await open('denied')
  await session.page.locator('#mobile-forbidden-title').waitFor()
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
  // Home may already have read the current subject before the later principal
  // response is held. The owner guarantee is that leaving Home while that
  // response is in flight never starts another private Home read.
  const homeAtHold = session.state.counts.home
  session.state.settingsExit = true
  await session.page.evaluate(() => { window.location.hash = '#/pages/settings/settings' })
  await session.page.waitForFunction(() => location.hash.includes('/pages/settings/settings'))
  session.release()
  await session.page.waitForLoadState('networkidle')
  assert.equal(session.state.counts.home, homeAtHold)
  report.checks.push({ name: 'owner-late-no-home-get-after-leave', homeGets: session.state.counts.home, homeAtHold, result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

async function accountLate() {
  const session = await open('account-late')
  const facts = await session.page.evaluate(() => ({ hash: location.hash, text: document.body.innerText }))
  // A principal switch during the private Home entry must not paint the new
  // subject. The auth guard sends this session back to sign-in instead.
  assert.equal(facts.hash, '#/pages/login/login?returnTo=%2Fpages%2Fhome%2Fhome')
  assert.doesNotMatch(facts.text, new RegExp(FOREIGN_SUBJECT))
  report.checks.push({ name: 'mismatched-principal-does-not-paint-foreign-subject', route: facts.hash, result: 'PASS' })
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
  await session.page.waitForFunction(() => location.hash === '#/pages/learn/learn')
  const intent = await session.page.evaluate(() => window.__yxNavWrites[window.__yxNavWrites.length - 1])
  assert.equal(intent.path, '/pages/learn/learn')
  assert.equal(intent.params.contentCode, 'course-open')
  report.checks.push({ name: 'keyboard-cta', result: 'PASS' })
  assertNoNewPageErrors(session)
  await session.context.close()
}

function assertBox(actual, expected, label) {
  assert.ok(actual, `${label} is missing`)
  for (const key of ['x', 'y', 'w', 'h']) {
    assert.ok(Math.abs(actual[key] - expected[key]) <= 1.5, `${label}.${key}: expected ${expected[key]}, got ${actual[key]}`)
  }
}

async function tabletFacts(page) {
  return page.evaluate(() => {
    const rect = (selector) => {
      const node = document.querySelector(selector)
      if (!node) return null
      const box = node.getBoundingClientRect()
      return { x: +box.x.toFixed(1), y: +box.y.toFixed(1), w: +box.width.toFixed(1), h: +box.height.toFixed(1) }
    }
    const style = (selector, property) => {
      const node = document.querySelector(selector)
      return node ? getComputedStyle(node)[property] : null
    }
    const tabbar = document.querySelector('uni-tabbar')
    const tabbarBox = tabbar ? tabbar.getBoundingClientRect() : null
    return {
      hash: location.hash,
      title: document.querySelector('.home-title')?.textContent || '',
      headline: document.querySelector('.home-tablet-headline')?.textContent || '',
      theme: document.documentElement.dataset.theme || '',
      motion: document.querySelector('.home-page')?.getAttribute('data-motion') || '',
      page: rect('.home-page'),
      hero: rect('.home-hero'),
      stats: rect('.home-stats'),
      tasks: rect('.home-tasks'),
      course: rect('#course-shelf'),
      ring: rect('.home-ring'),
      cta: rect('.home-hero__cta'),
      courseCta: rect('.home-tablet-course__cta'),
      profile: rect('.home-nav__profile'),
      rail: rect('.home-nav--rail'),
      sidebar: rect('.home-nav--sidebar'),
      tabbarVisible: Boolean(tabbarBox && tabbarBox.width > 0 && tabbarBox.height > 0 && getComputedStyle(tabbar).display !== 'none'),
      scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      navItems: [...document.querySelectorAll('.home-nav__item')].map((node) => {
        const box = node.getBoundingClientRect()
        return { text: node.textContent.trim(), current: node.getAttribute('aria-current'), w: +box.width.toFixed(1), h: +box.height.toFixed(1) }
      }),
      active: document.querySelector('.home-nav__item.is-active')?.textContent.trim() || '',
      imagesOk: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
      imageCount: document.images.length,
      backgroundImage: style('.home-page', 'backgroundImage'),
      panelColor: style('.home-stats', 'backgroundColor'),
      panelBorder: style('.home-stats', 'borderColor'),
      heroBackground: style('.home-hero', 'backgroundImage'),
      text: document.querySelector('.home-page')?.innerText || '',
    }
  })
}

async function tabletProof() {
  const cases = [
    { width: 834, height: 1194, theme: 'light', variant: 'rail' },
    { width: 834, height: 1194, theme: 'dark', variant: 'rail' },
    { width: 1194, height: 834, theme: 'light', variant: 'sidebar' },
    { width: 1194, height: 834, theme: 'dark', variant: 'sidebar' },
  ]
  for (const item of cases) {
    const session = await open('ready', item.width, 'zh-CN', item.theme, 'reduce', item.height)
    await session.page.locator('.home-stats').waitFor()
    const facts = await tabletFacts(session.page)
    const label = `${item.width}x${item.height}-${item.theme}`
    assert.equal(facts.hash, '#/')
    assert.equal(facts.theme, item.theme)
    assert.equal(facts.motion === 'off' || facts.motion === 'reduced', true)
    assert.equal(facts.overflow, false)
    assert.equal(facts.tabbarVisible, false)
    assert.equal(facts.title, '今日学习')
    assert.match(facts.headline, /继续你的学习旅程/)
    assert.equal(facts.navItems.length, 5)
    assert.equal(facts.active, '学习')
    assert.equal(facts.navItems[0].current, 'page')
    for (const navItem of facts.navItems) assert.ok(navItem.w >= 44 && navItem.h >= 44, `${label} nav target ${navItem.text} is under 44px`)
    assert.ok(facts.profile && facts.profile.w >= 44 && facts.profile.h >= 44, `${label} profile target is under 44px`)
    assert.ok(facts.courseCta && facts.courseCta.w >= 44 && facts.courseCta.h >= 44, `${label} course CTA is under 44px`)
    assert.equal(facts.imagesOk, true)
    assert.ok(facts.imageCount > 10)
    assert.deepEqual(facts.scroll, [item.width, item.height])
    if (item.variant === 'rail') {
      assertBox(facts.rail, { x: 0, y: 0, w: 86, h: 1194 }, `${label} rail`)
      assert.equal(facts.sidebar, null)
      assertBox(facts.hero, { x: 116, y: 132, w: 686, h: 227 }, `${label} hero`)
      assertBox(facts.stats, { x: 116, y: 381, w: 686, h: 134 }, `${label} stats`)
      assertBox(facts.tasks, { x: 116, y: 535, w: 686, h: 343 }, `${label} tasks`)
      assertBox(facts.course, { x: 116, y: 900, w: 686, h: 266 }, `${label} course`)
      assertBox(facts.ring, { x: 669, y: 170, w: 108, h: 108 }, `${label} ring`)
      assertBox(facts.cta, { x: 145, y: 289, w: 270, h: 50 }, `${label} cta`)
      assert.match(facts.backgroundImage, item.theme === 'dark' ? /rgb\(23, 21, 39\).*rgb\(38, 32, 57\)/ : /rgb\(250, 247, 255\).*rgb\(244, 239, 252\)/)
    } else {
      assertBox(facts.sidebar, { x: 0, y: 0, w: 244, h: 834 }, `${label} sidebar`)
      assert.equal(facts.rail, null)
      assertBox(facts.hero, { x: 276, y: 124, w: 572, h: 248 }, `${label} hero`)
      assertBox(facts.stats, { x: 868, y: 124, w: 292, h: 248 }, `${label} stats`)
      assertBox(facts.tasks, { x: 276, y: 398, w: 572, h: 398 }, `${label} tasks`)
      assertBox(facts.course, { x: 868, y: 398, w: 292, h: 398 }, `${label} course`)
      assertBox(facts.ring, { x: 697, y: 177, w: 112, h: 112 }, `${label} ring`)
      assertBox(facts.cta, { x: 304, y: 298, w: 224, h: 52 }, `${label} cta`)
      assert.equal(facts.panelColor, item.theme === 'dark' ? 'rgb(46, 39, 67)' : 'rgb(255, 255, 255)')
      assert.equal(facts.panelBorder, item.theme === 'dark' ? 'rgba(107, 88, 138, 0.52)' : 'rgb(229, 219, 243)')
      assert.match(facts.heroBackground, item.theme === 'dark' ? /rgb\(92, 53, 182\).*rgb\(155, 98, 215\)/ : /rgb\(93, 53, 182\).*rgb\(162, 107, 221\)/)
      assert.match(facts.backgroundImage, item.theme === 'dark' ? /rgb\(23, 21, 39\).*rgb\(38, 32, 57\)/ : /rgb\(250, 247, 255\).*rgb\(243, 238, 250\)/)
    }
    assert.doesNotMatch(facts.text, /12天|33%|40%/)
    assert.match(facts.text, /跟读短句|已学词汇/)
    const shot = `home-tablet-${item.width}x${item.height}-${item.theme}-reduced.png`
    await session.page.screenshot({ path: path.join(OUT, shot), fullPage: true })
    report.matrix.push({ viewport: `${item.width}x${item.height}`, locale: 'zh-CN', theme: item.theme, variant: item.variant, motion: facts.motion, rail: Boolean(facts.rail), sidebar: Boolean(facts.sidebar), tabbarVisible: facts.tabbarVisible, imageCount: facts.imageCount, overflow: facts.overflow, shot, result: 'PASS' })
    report.checks.push({ name: `tablet-geometry-${label}`, hero: facts.hero, stats: facts.stats, tasks: facts.tasks, course: facts.course, ring: facts.ring, cta: facts.cta, result: 'PASS' })
    assertNoNewPageErrors(session)
    await session.context.close()
    save()
  }

  // Sidebar links and Profile use the real app routes; leaving Home restores the native bar.
  const nav = await open('ready', 1194, 'zh-CN', 'light', 'reduce', 834)
  await nav.page.locator('.home-nav--sidebar').waitFor()
  const navButton = (name) => nav.page.locator('.home-nav--sidebar .home-nav__item', { hasText: name })
  nav.state.practiceExit = true
  await navButton('练习').click()
  await nav.page.waitForFunction(() => location.hash === '#/pages/b2-practice/b2-practice')
  assert.equal(await nav.page.evaluate(() => {
    const tabbar = document.querySelector('uni-tabbar')
    const box = tabbar?.getBoundingClientRect()
    return Boolean(box && box.height > 0 && getComputedStyle(tabbar).display !== 'none')
  }), true)
  report.checks.push({ name: 'tablet-sidebar-practice-route-and-tabbar-restored', result: 'PASS' })

  await nav.page.evaluate(() => { location.hash = '#/' })
  await nav.page.locator('.home-hero').waitFor()
  await nav.page.waitForFunction(() => {
    const tabbar = document.querySelector('uni-tabbar')
    const box = tabbar?.getBoundingClientRect()
    return !box || box.height === 0 || getComputedStyle(tabbar).display === 'none'
  })
  await nav.page.locator('.home-nav__profile').click()
  await nav.page.waitForFunction(() => location.hash === '#/pages/profile/profile')
  report.checks.push({ name: 'tablet-profile-route', result: 'PASS' })
  assertNoNewPageErrors(nav)
  await nav.context.close()

  // Course CTA crosses the tab boundary through the supported intent store, not the hash.
  const course = await open('ready', 834, 'zh-CN', 'light', 'reduce', 1194)
  const courseCta = course.page.locator('.home-tablet-course__cta')
  await courseCta.focus()
  assert.equal(await courseCta.evaluate((node) => node === document.activeElement || node.contains(document.activeElement)), true)
  await course.page.keyboard.press('Enter')
  await course.page.waitForFunction(() => location.hash === '#/pages/learn/learn')
  const intent = await course.page.evaluate(() => window.__yxNavWrites[window.__yxNavWrites.length - 1])
  assert.deepEqual(intent, { path: '/pages/learn/learn', params: { contentCode: 'course-open' } })
  report.checks.push({ name: 'tablet-course-cta-keyboard-tab-intent', route: '#/pages/learn/learn', intent, result: 'PASS' })
  assertNoNewPageErrors(course)
  await course.context.close()

  // Orientation/narrow change hides and restores the native bar without a reload.
  const resize = await open('ready', 390, 'zh-CN', 'light', 'reduce', 844)
  let resized = await homeFacts(resize.page)
  assert.equal(resized.tabbarVisible, true)
  await resize.page.setViewportSize({ width: 834, height: 1194 })
  await resize.page.waitForFunction(() => {
    const tabbar = document.querySelector('uni-tabbar')
    const box = tabbar?.getBoundingClientRect()
    return Boolean(document.querySelector('.home-nav--rail') && (!box || box.height === 0 || getComputedStyle(tabbar).display === 'none'))
  })
  await resize.page.setViewportSize({ width: 390, height: 844 })
  await resize.page.waitForFunction(() => {
    const tabbar = document.querySelector('uni-tabbar')
    const box = tabbar?.getBoundingClientRect()
    return !document.querySelector('.home-nav--rail') && box && box.height > 0 && getComputedStyle(tabbar).display !== 'none'
  })
  resized = await homeFacts(resize.page)
  assert.equal(resized.rail, false)
  assert.equal(resized.tabbarVisible, true)
  report.checks.push({ name: 'tablet-orientation-narrow-restores-tabbar', result: 'PASS' })
  assertNoNewPageErrors(resize)
  await resize.context.close()

  // Empty and failure states must stay honest on tablet, with no fake 0%.
  const empty = await open('empty', 834, 'zh-CN', 'light', 'reduce', 1194)
  await empty.page.locator('.home-empty').waitFor()
  const emptyFacts = await tabletFacts(empty.page)
  assert.equal(emptyFacts.tabbarVisible, false)
  assert.equal(emptyFacts.overflow, false)
  assert.match(emptyFacts.text, /还没有学习计划/)
  assert.doesNotMatch(emptyFacts.text, /0%|12天/)
  await empty.page.screenshot({ path: path.join(OUT, 'home-tablet-834x1194-empty.png'), fullPage: true })
  report.checks.push({ name: 'tablet-empty-plan-not-fake-progress', result: 'PASS' })
  assertNoNewPageErrors(empty)
  await empty.context.close()

  const failed = await open('failure', 1194, 'zh-CN', 'light', 'reduce', 834)
  await failed.page.locator('.home-block__title').waitFor()
  const failedFacts = await tabletFacts(failed.page)
  assert.equal(failedFacts.tabbarVisible, false)
  assert.equal(failedFacts.overflow, false)
  assert.equal(failedFacts.hero, null)
  assert.equal(failedFacts.stats, null)
  assert.match(failedFacts.text, /今日任务暂不可用/)
  assert.doesNotMatch(failedFacts.text, /12天|33%|40%/)
  await failed.page.screenshot({ path: path.join(OUT, 'home-tablet-1194x834-failure.png'), fullPage: true })
  report.checks.push({ name: 'tablet-failure-not-empty', result: 'PASS' })
  assertNoNewPageErrors(failed)
  await failed.context.close()
  save()
}

async function matrix() {
  const viewports = [[320, 844], [390, 844], [834, 1194], [1194, 834]]
  for (const [width, height] of viewports) {
    for (const locale of ['zh-CN', 'en-US']) {
      for (const theme of ['light', 'dark', 'high-contrast']) {
        const session = await open('ready', width, locale, theme, 'reduce', height)
        await session.page.locator('.home-columns').waitFor()
        const facts = await homeFacts(session.page)
        assert.equal(facts.theme, theme === 'high-contrast' ? 'high-contrast' : theme)
        assert.equal(facts.overflow, false)
        assert.equal(facts.motion === 'off' || facts.motion === 'reduced', true)
        assert.equal(facts.columns, width >= 768 ? 'contents' : 'block')
        assert.equal(facts.title, locale === 'en-US' ? "Today's learning" : '今日学习')
        if (width === 834) assert.equal(facts.rail, true)
        if (width === 1194) assert.equal(facts.sidebar, true)
        if (width >= 768) assert.match(facts.text, locale === 'en-US' ? /keep going on your learning journey/ : /继续你的学习旅程/)
        if (width < 768) {
          assert.equal(facts.rail, false)
          assert.equal(facts.sidebar, false)
          assert.equal(facts.tabbarVisible, true)
        } else {
          assert.equal(facts.tabbarVisible, false)
        }
        assert.doesNotMatch(facts.text, /12天|33%|40%/)
        const shot = `home-ready-${width}-${locale}-${theme}-reduced.png`
        await session.page.screenshot({ path: path.join(OUT, shot), fullPage: true })
        report.matrix.push({ width, locale, theme, motion: facts.motion, columns: facts.columns, rail: facts.rail, sidebar: facts.sidebar, tabbarVisible: facts.tabbarVisible, overflow: facts.overflow, shot, result: 'PASS' })
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
  ready, guide, invalid, denied, consent, unauthorized, failure, empty, unavailable, partial, loading, late, 'account-late': accountLate, keyboard, tablet: tabletProof, matrix,
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
  assert.deepEqual(report.pageErrors, [])
  assert.deepEqual(report.unknownApi, [])
  assert.deepEqual(report.reproductions, [])
  assert.deepEqual(report.externalAborts, [])
  assert.deepEqual(
    report.consoleErrors.map((item) => ({ case: item.case, status: item.status })),
    report.injectedFailures.map((item) => ({ case: item.case, status: item.status })),
  )
  const settingsReads = report.acceptedFixtures.filter((item) => item.context === 'settings-exit')
  const practiceWrites = report.acceptedFixtures.filter((item) => item.context === 'practice-activation')
  if (GROUP === 'all' || GROUP === 'late') {
    assert.deepEqual(settingsReads.map((item) => [item.method, item.path, item.status, item.query]), [
      ['GET', '/api/v1/notifications/preferences', 200, 'pageSize=100'],
      ['GET', '/api/v1/support/tickets', 200, 'projection=it7'],
    ])
  } else assert.deepEqual(settingsReads, [])
  if (GROUP === 'all' || GROUP === 'tablet') {
    assert.equal(practiceWrites.length, 1)
    assert.equal(practiceWrites[0].status, 200)
    assert.equal(practiceWrites[0].writes, 1)
    assert.equal(practiceWrites[0].hasIdempotencyKey, true)
    assert.equal(practiceWrites[0].contentVersionId, 25001)
    assert.equal(practiceWrites[0].sessionMode, 'PRACTICE')
    assert.equal(practiceWrites[0].sessionStatus, 'IN_PROGRESS')
  } else assert.deepEqual(practiceWrites, [])
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
