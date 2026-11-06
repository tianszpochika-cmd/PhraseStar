'use strict'

/**
 * Root-runnable grammar view observer.
 * Serves one built H5 tree from three synthetic origins. It does not start port 18183,
 * call a live backend, or read production setupState hooks.
 * An author canary is not browser acceptance. Root reruns this file against the immutable H5 tree.
 * The grammar-03 combined-page harness is obsolete for this flow and is not modified.
 */

const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const ROOT = path.resolve(__dirname, '../../..')
const BASE = 'https://b4-ui.synthetic.invalid'
const IAM = 'https://127.0.0.1:18087'
const GW = 'http://127.0.0.1:18070'
const ART = process.env.GRAMMAR_H5_ARTIFACT || path.join(ROOT, 'apps/mobile/dist/build/h5')
const OUT = process.env.GRAMMAR_E2E_OUT || '/tmp/grok-grammar-layout-10/browser'
const ROOT_COMMAND = 'GRAMMAR_H5_ARTIFACT=/tmp/grok-grammar-layout-10/h5 GRAMMAR_E2E_OUT=/tmp/grok-grammar-layout-10/browser node apps/mobile/tests/ui-grammar.e2e.cjs'
const SHOTS = path.join(OUT, 'screenshots')
const { chromium } = createRequire(path.join(ROOT, 'package.json'))('playwright')

const PROMPT = '选择正确的词补全句子：The book ___ you lent me is on the desk.'
const EXAMPLE = 'The book that you lent me is on the desk.'
const POINT_TITLE = '定语从句: that 与 which'
const FORMULA = '名词 + that/which + 不完整从句'
const CORS = {
  'access-control-allow-origin': BASE,
  'access-control-allow-credentials': 'true',
  'access-control-allow-methods': 'GET,POST,OPTIONS,PUT,PATCH,DELETE',
  'access-control-allow-headers': 'authorization,content-type,idempotency-key,x-request-id,accept-language,x-content-locale',
  'access-control-max-age': '600',
  vary: 'Origin',
}
const principal = {
  data: {
    principal: { subject: 'grammar-subject' },
    permissions: ['learning.plan.read'],
    roles: ['LEARNER'],
    adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' },
    consentState: { accepted: true, unsatisfiedPurposes: [] },
  },
}
const profile = {
  data: {
    profile: {
      principalId: 'grammar-subject',
      status: 'ACTIVE',
      uiLocale: 'zh-CN',
      contentLocale: 'en-US',
      timezone: 'Asia/Shanghai',
      stateVersion: 1,
    },
  },
}
const preferences = {
  data: {
    stateVersion: 1,
    uiLocale: 'zh-CN',
    contentLocale: 'en-US',
    timezone: 'Asia/Shanghai',
    themeMode: 'SYSTEM',
    highContrast: false,
    motionMode: 'FULL',
  },
}
const target = { data: { goalCode: 'COLLEGE_CET', dailyQuotaMinutes: 15, status: 'ACTIVE' } }
const publishedPoint = {
  grammarPointId: 701,
  code: 'GP_701',
  title: POINT_TITLE,
  ruleFormula: FORMULA,
  meaningCn: '用从句补充说明前面的名词。',
  cefrLevel: 'B2',
  trapTags: ['THAT_WHICH'],
  prerequisites: [],
  sentenceId: 9001,
  masteryPercent: 62,
  contentVersionId: 3001,
  examples: [EXAMPLE],
}
const exercise = {
  grammarPointId: 701,
  exerciseId: 8801,
  questionId: 7701,
  position: 0,
  questionType: 'CHOICE',
  type: 'CHOICE',
  promptText: PROMPT,
  prompt: PROMPT,
  sourceText: 'The book ___ you lent me is on the desk.',
  options: [
    { optionCode: 'A', label: 'that' },
    { optionCode: 'B', label: 'what' },
    { optionCode: 'C', label: 'who' },
    { optionCode: 'D', label: 'where' },
  ],
  practiceRef: { contentCode: 'grammar-701', contentVersionId: 3001, questionItemId: 7701 },
}

function scrub(value) {
  return String(value)
    .replace(/Bearer\s+\S+/giu, 'Bearer [redacted]')
    .replace(/accessToken\\?":\\?"[^"]+"/giu, 'accessToken:[redacted]')
    .replace(/refreshToken\\?":\\?"[^"]+"/giu, 'refreshToken:[redacted]')
    .replace(/Idempotency-Key\\?":\\?"[^"]+"/giu, 'Idempotency-Key:[redacted]')
    .slice(0, 300)
}
function headers(extra = {}) { return { ...CORS, 'cache-control': 'no-store', ...extra } }
function json(route, status, body) {
  return route.fulfill({ status, headers: headers({ 'content-type': 'application/json; charset=utf-8' }), body: JSON.stringify(body) })
}
function typeFor(file) {
  return ({
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.json': 'application/json',
  })[path.extname(file).toLowerCase()] || 'application/octet-stream'
}
function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}
function machFault(error) {
  const text = String(error && (error.stack || error.message) || error)
  return /SIGSEGV|Mach|Permission denied|code 1100|\b1100\b|SEGV_ACCERR|crashpad/iu.test(text)
}
function resourceStatus(text) {
  const match = String(text).match(/status of (\d+)/u)
  return match ? Number(match[1]) : null
}
function grammarPhase(state) {
  try {
    const url = state.page.url()
    if (url.includes('/pages/b3-grammar/b3-grammar')) {
      state.seenGrammar = true
      return 'on'
    }
    return state.seenGrammar ? 'left' : 'boot'
  } catch {
    return 'boot'
  }
}
function notePost(state, kind, request) {
  let numericItemId = false
  try {
    const body = JSON.parse(request.postData() || '')
    if (kind === 'session') {
      numericItemId = Array.isArray(body.itemIds) && body.itemIds.length === 1 && Number.isInteger(body.itemIds[0]) && body.itemIds[0] > 0
    } else {
      numericItemId = Array.isArray(body.items) && Number.isInteger(body.items[0]?.itemId) && body.items[0].itemId > 0
    }
  } catch {
    numericItemId = false
  }
  const rawHeaders = request.headers()
  const hasIdempotencyKey = Object.entries(rawHeaders).some(([name, value]) => name.toLowerCase() === 'idempotency-key' && String(value || '').length > 0)
  const entry = { kind, numericItemId, hasIdempotencyKey }
  if (kind === 'session') state.sessionPosts.push(entry)
  else state.attemptPosts.push(entry)
}

async function handleApi(route, url, state) {
  const request = route.request()
  if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: headers(), body: '' })
  const phase = grammarPhase(state)
  if (phase === 'left') {
    state.departed.push({ method: request.method(), path: url.pathname })
    return json(route, 200, { data: {} })
  }
  const pathname = url.pathname
  state.requests.push({ origin: url.origin, method: request.method(), path: pathname, status: 200 })
  if (url.origin === IAM) {
    if (pathname.endsWith('/auth/token/refresh')) {
      if (state.mode === 'auth401') return json(route, 401, { error: { code: 'SESSION_EXPIRED' } })
      return json(route, 200, { data: { accessToken: 'synthetic-access', refreshToken: 'synthetic-refresh', deviceId: 'device', sessionId: 'session', adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE' } } })
    }
    state.unknown.push({ method: request.method(), path: pathname })
    return json(route, 404, { error: { code: 'SYNTHETIC_IAM' } })
  }
  if (pathname.endsWith('/iam/principal/me') || pathname.endsWith('/iam/permissions')) return json(route, 200, principal)
  if (pathname.endsWith('/learner/profile')) return json(route, 200, profile)
  if (pathname.endsWith('/learner/preferences')) return json(route, 200, preferences)
  if (pathname.endsWith('/learner/targets')) return json(route, 200, target)
  if (pathname.endsWith('/iam/consents')) return json(route, 200, { data: { items: [] } })
  if (pathname.endsWith('/grammar/points')) {
    state.pointGets += 1
    if (state.hold) await state.hold
    if (grammarPhase(state) === 'left') {
      state.departed.push({ method: request.method(), path: pathname })
      return json(route, 200, { data: { items: [] } })
    }
    if (state.mode === 'error') return json(route, 503, { error: { code: 'SYNTHETIC_GRAMMAR_DOWN' } })
    if (state.mode === 'stale') return json(route, 410, { error: { code: 'CONTENT_VERSION_STALE' } })
    if (state.mode === 'auth403') return json(route, 403, { error: { code: 'FORBIDDEN' } })
    if (state.mode === 'empty' || state.mode === 'unbound') return json(route, 200, { data: { items: [] } })
    return json(route, 200, { data: { items: [publishedPoint] } })
  }
  if (pathname.includes('/grammar/sentences') || pathname.includes('/syntax')) {
    state.graphRequests += 1
    return json(route, 503, { error: { code: 'SYNTHETIC_GRAPH_CLOSED' } })
  }
  if (pathname.endsWith('/grammar/exercises')) {
    state.exerciseGets += 1
    if (state.mode === 'empty') return json(route, 200, { data: { items: [] } })
    return json(route, 200, { data: { items: [exercise] } })
  }
  if (pathname.endsWith('/assessment/sessions') && request.method() === 'POST') {
    notePost(state, 'session', request)
    return json(route, 200, { data: { sessionId: 'assess-grammar-1', stateVersion: 1, items: [] } })
  }
  if (pathname.endsWith('/assessment/sessions/assess-grammar-1/attempts') && request.method() === 'POST') {
    notePost(state, 'attempt', request)
    if (state.mode === 'receipt-missing') return json(route, 200, { data: { accepted: true, correct: true, score: 1 } })
    return json(route, 200, { data: { accepted: true, correct: true, score: 1, savedReceipt: 'receipt-1', feedbackText: '服务端已判定为正确。', scoreBucket: 'FULL' } })
  }
  state.unknown.push({ method: request.method(), path: pathname })
  return json(route, 404, { error: { code: 'SYNTHETIC_NOT_CONFIGURED' } })
}

async function createContext(browser, options = {}) {
  const state = {
    mode: options.mode || 'normal',
    page: null,
    seenGrammar: false,
    requests: [],
    unknown: [],
    blocked: [],
    departed: [],
    console: [],
    pageErrors: [],
    pointGets: 0,
    exerciseGets: 0,
    graphRequests: 0,
    sessionPosts: [],
    attemptPosts: [],
    hold: null,
    release() {},
  }
  if (options.holdPoints) {
    state.hold = new Promise((resolve) => {
      const timer = setTimeout(resolve, 15000)
      state.release = () => { clearTimeout(timer); resolve() }
    })
  }
  const context = await browser.newContext({
    viewport: { width: options.width || 390, height: options.height || 844 },
    locale: options.uiLocale || 'zh-CN',
    colorScheme: options.colorScheme || 'light',
    reducedMotion: options.reducedMotion || 'no-preference',
    ignoreHTTPSErrors: true,
  })
  await context.route('**/*', async (route) => {
    const request = route.request()
    let url
    try { url = new URL(request.url()) } catch { state.blocked.push({ origin: 'invalid', path: request.url().slice(0, 120) }); return route.abort('blockedbyclient') }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return route.continue()
    if (url.origin === BASE) {
      if (url.pathname.startsWith('/api/')) {
        state.unknown.push({ method: request.method(), path: url.pathname })
        return json(route, 404, { error: { code: 'SYNTHETIC_NOT_CONFIGURED' } })
      }
      const rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '')
      const file = path.resolve(ART, rel)
      const rooted = file === path.join(ART, 'index.html') || file.startsWith(ART + path.sep)
      if (!rooted || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (url.pathname === '/favicon.ico') return route.fulfill({ status: 204, body: '' })
        return route.fulfill({ status: 404, body: 'not found' })
      }
      return route.fulfill({ status: 200, contentType: typeFor(file), body: fs.readFileSync(file) })
    }
    if ((url.origin === IAM || url.origin === GW) && url.pathname.startsWith('/api/v1/')) return handleApi(route, url, state)
    state.blocked.push({ origin: url.origin, path: url.pathname })
    return route.abort('blockedbyclient')
  })
  await context.addInitScript(({ theme, uiLocale, motion }) => {
    try {
      localStorage.setItem('yx.auth.mobile.session-hint', '1')
      localStorage.setItem('ef.theme', theme)
      localStorage.setItem('ef.ui-locale', uiLocale)
      if (motion) localStorage.setItem('yx.mobile.motion', motion)
    } catch { /* synthetic storage is not recorded */ }
  }, { theme: options.theme || 'light', uiLocale: options.uiLocale || 'zh-CN', motion: options.motion || '' })
  const page = await context.newPage()
  state.page = page
  page.on('console', (message) => { if (message.type() === 'error') state.console.push(scrub(message.text())) })
  page.on('pageerror', (error) => state.pageErrors.push(scrub(error.message)))
  return { context, page, state }
}

const results = {
  kind: 'SYNTHETIC_UI_BUILT_ARTIFACT',
  batch: 'grok-grammar-layout-10',
  acceptance: 'AUTHOR_CANARY_NOT_BROWSER_ACCEPTANCE',
  flow: 'list -> click real point -> detail -> structure -> header back -> Start -> question -> choose -> submit -> server receipt -> back -> reopen',
  obsoleteHarness: 'grammar-03-root-preliminary assumed one combined page and is left unchanged',
  fidelityLimits: [
    'Published fixture has one example, so the detail pager and a second example are omitted.',
    'No example translation or prerequisite title is invented; both are absent from this payload.',
    'Figma shows three sample rows. This payload has the one published point and the same list layout.',
    'Closed graph and the no-graph entry share the structure view because the read stays unavailable.',
    'The pencil asset stays unused so structure does not duplicate the Start action.',
  ],
  status: 'RUNNING',
  at: new Date().toISOString(),
  base: BASE,
  origins: [BASE, IAM, GW],
  artifactRoot: ART,
  browser: null,
  checks: [],
  screenshots: [],
  classifications: [],
  consoleErrors: [],
  pageErrors: [],
  unknown: [],
  blocked: [],
  firstFailure: null,
}
function save() {
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n')
}
function check(name, ok, detail) {
  const item = { name, ok: Boolean(ok), detail: scrub(detail ?? '') }
  results.checks.push(item)
  if (!ok && !results.firstFailure) results.firstFailure = { name, detail: item.detail }
  return Boolean(ok)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function goto(page, hash = '#/pages/b3-grammar/b3-grammar') {
  await page.goto(`${BASE}/${hash}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForSelector('.v2-grammar-page', { timeout: 20000 })
  await sleep(400)
}
async function shot(page, name) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false })
  results.screenshots.push({ name, file, bytes: fs.statSync(file).size, url: page.url().split('?')[0] })
}
async function bodyText(page) {
  return page.locator('.v2-grammar-page').innerText()
}
async function viewOf(page) {
  return page.locator('.v2-grammar-page').getAttribute('data-grammar-view')
}
function posts(state) {
  return { sessions: state.sessionPosts.length, attempts: state.attemptPosts.length, exercises: state.exerciseGets, points: state.pointGets, graphs: state.graphRequests }
}
async function openDetail(page) {
  await page.locator('.grammar-point').first().click()
  await page.waitForSelector('[data-grammar-view="detail"]', { timeout: 10000 })
}
async function openPractice(page) {
  await page.locator('.grammar-button.grammar-primary').click()
  await page.waitForSelector('#grammar-exercise', { timeout: 20000 })
}
async function scaleText(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('.v2-grammar-page text, .v2-grammar-page uni-text, .v2-grammar-page button, .v2-grammar-page uni-button')) {
      const size = Number.parseFloat(getComputedStyle(el).fontSize)
      if (Number.isFinite(size)) {
        el.style.fontSize = `${size * 2}px`
        el.style.lineHeight = '1.4'
      }
    }
  })
  await sleep(200)
}
async function audit(page, label) {
  const measured = await page.evaluate(() => {
    const rect = (el) => el ? el.getBoundingClientRect().toJSON() : null
    const root = document.querySelector('.v2-grammar-page')
    const controls = [...document.querySelectorAll('.v2-grammar-page .grammar-button,.v2-grammar-page .grammar-option,.v2-grammar-page .grammar-point,.v2-grammar-page .grammar-structure')].map((el) => {
      const style = getComputedStyle(el)
      return { text: el.textContent.trim().slice(0, 40), rect: rect(el), font: style.fontSize, cursor: style.cursor, disabled: el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled') }
    })
    const texts = [...document.querySelectorAll('.v2-grammar-page text,.v2-grammar-page uni-text')].map((el) => ({ text: el.textContent.trim().slice(0, 40), font: getComputedStyle(el).fontSize }))
    const titles = [...document.querySelectorAll('.grammar-point-title,.grammar-detail-title,.grammar-formula,.grammar-example,.grammar-question')].map((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth, wrap: getComputedStyle(el).overflowWrap }))
    return { scrollWidth: document.documentElement.scrollWidth, bodyScrollWidth: document.body.scrollWidth, innerWidth, controls, texts, titles }
  })
  check(`${label}: no horizontal overflow`, measured.scrollWidth <= measured.innerWidth + 1 && measured.bodyScrollWidth <= measured.innerWidth + 1, JSON.stringify({ scrollWidth: measured.scrollWidth, innerWidth: measured.innerWidth }))
  check(`${label}: controls >=44`, measured.controls.length > 0 && measured.controls.every((item) => item.rect.height >= 44 && item.rect.width >= 44), JSON.stringify(measured.controls.map((item) => ({ text: item.text, height: item.rect.height, width: item.rect.width }))))
  const enabled = measured.controls.filter((item) => !item.disabled)
  const disabled = measured.controls.filter((item) => item.disabled)
  check(`${label}: pointer controls`, enabled.length > 0 && enabled.every((item) => item.cursor === 'pointer'), JSON.stringify(enabled.map((item) => item.cursor)))
  check(`${label}: disabled controls`, disabled.every((item) => item.cursor === 'default'), JSON.stringify(disabled.map((item) => ({ text: item.text, cursor: item.cursor }))))
  check(`${label}: no <12px text`, measured.texts.every((item) => Number.parseFloat(item.font) >= 12), JSON.stringify(measured.texts.filter((item) => Number.parseFloat(item.font) < 12)))
  check(`${label}: long copy wraps`, measured.titles.every((item) => item.scrollWidth <= item.clientWidth + 1), JSON.stringify(measured.titles))
  for (let i = 0; i < 16; i += 1) {
    await page.keyboard.press('Tab')
    const hit = await page.evaluate(() => Boolean(document.activeElement?.closest?.('.v2-grammar-page') && document.activeElement.matches('.grammar-button,.grammar-option,.grammar-point,.grammar-structure')))
    if (hit) break
  }
  const focus = await page.evaluate(() => {
    const el = document.activeElement
    const style = el ? getComputedStyle(el) : null
    return { tag: el?.tagName || '', className: String(el?.className || ''), visible: Boolean(el?.matches?.(':focus-visible')), outline: style?.outlineWidth || '0' }
  })
  check(`${label}: keyboard focus visible`, focus.visible && Number.parseFloat(focus.outline || '0') > 0, JSON.stringify(focus))
}
async function contrast(page, label, requireOption) {
  const sample = await page.evaluate(() => {
    const read = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const style = getComputedStyle(el)
      const layers = []
      let node = el
      while (node) {
        const color = getComputedStyle(node).backgroundColor
        if (color && color !== 'rgba(0, 0, 0, 0)') layers.push(color)
        node = node.parentElement
      }
      return { color: style.color, background: style.backgroundColor, image: style.backgroundImage, layers: layers.reverse() }
    }
    return { primary: read('.grammar-button.grammar-primary'), option: read('.grammar-option') }
  })
  const parse = (value) => {
    const match = String(value || '').match(/rgba?\(([^)]+)\)/u)
    if (!match) return null
    const parts = match[1].split(',').map((item) => Number(item.trim()))
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 }
  }
  const blend = (front, back) => {
    const alpha = front.a + back.a * (1 - front.a)
    return {
      r: (front.r * front.a + back.r * back.a * (1 - front.a)) / alpha,
      g: (front.g * front.a + back.g * back.a * (1 - front.a)) / alpha,
      b: (front.b * front.a + back.b * back.a * (1 - front.a)) / alpha,
      a: alpha,
    }
  }
  const lum = (color) => {
    const f = (value) => { const x = value / 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * f(color.r) + 0.7152 * f(color.g) + 0.0722 * f(color.b)
  }
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)
  const calc = (item) => {
    if (!item) return 0
    const fg = parse(item.color)
    if (!fg) return 0
    let base = { r: 255, g: 255, b: 255, a: 1 }
    for (const layer of (item.layers || []).map(parse).filter(Boolean)) base = blend(layer, base)
    const candidates = []
    const bg = parse(item.background)
    if (bg && bg.a > 0) candidates.push(blend(bg, base))
    for (const match of String(item.image || '').matchAll(/rgba?\([^)]+\)/giu)) {
      const color = parse(match[0])
      if (color) candidates.push(blend(color, base))
    }
    if (!candidates.length) candidates.push(base)
    const paints = candidates.map((back) => {
      const front = blend(fg, back)
      return { ratio: ratio(front, back), foreground: front, background: back }
    })
    return paints.reduce((worst, paint) => paint.ratio < worst.ratio ? paint : worst)
  }
  const hex = (color) => `#${[color.r, color.g, color.b].map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
  const paint = (item) => item ? { ratio: item.ratio, foreground: hex(item.foreground), background: hex(item.background) } : null
  const primary = calc(sample.primary)
  const option = sample.option ? calc(sample.option) : null
  const out = { primary: primary ? primary.ratio : 0, option: option ? option.ratio : null, primaryPaint: paint(primary), optionPaint: paint(option) }
  const ok = out.primary >= 4.5 && (!requireOption || (out.option !== null && out.option >= 4.5))
  check(`${label}: text contrast >=4.5`, ok, JSON.stringify(out))
}
async function footerFits(page, label) {
  const measured = await page.evaluate(() => {
    const footer = document.querySelector('.grammar-footer')
    const scroll = document.querySelector('.grammar-scroll')
    if (!footer || !scroll) return { present: false }
    scroll.scrollTop = scroll.scrollHeight
    const last = scroll.lastElementChild
    const lastRect = last ? last.getBoundingClientRect() : null
    const scrollRect = scroll.getBoundingClientRect()
    const footerRect = footer.getBoundingClientRect()
    const footerStyle = getComputedStyle(footer)
    return {
      present: true,
      position: footerStyle.position,
      insideScroll: scroll.contains(footer),
      footerTop: footerRect.top,
      scrollBottom: scrollRect.bottom,
      lastBottom: lastRect ? lastRect.bottom : null,
      scrollPortBottom: scrollRect.bottom,
      innerHeight,
      canScroll: scroll.scrollHeight > scroll.clientHeight + 1,
    }
  })
  check(`${label}: footer is outside the scroll region`, measured.present && measured.insideScroll === false && measured.position !== 'fixed' && measured.position !== 'absolute' && measured.scrollBottom <= measured.footerTop + 1, JSON.stringify(measured))
  check(`${label}: scrolled content stays in the scrollport`, measured.present && measured.lastBottom !== null && measured.lastBottom <= measured.scrollPortBottom + 2, JSON.stringify(measured))
}
function classifyConsole(label, state, allowed) {
  const resource = state.console.filter((text) => allowed.includes(resourceStatus(text)))
  const other = state.console.filter((text) => !allowed.includes(resourceStatus(text)))
  if (resource.length) results.classifications.push({ name: `${label}: expected http`, classification: 'fixture', allowedResourceStatuses: allowed, evidence: resource })
  return state.pageErrors.length === 0 && other.length === 0
}
async function mainCase(browser, label, options, fn) {
  const opened = await createContext(browser, options)
  try {
    await fn(opened.page, opened.state)
    const consoleOk = classifyConsole(label, opened.state, options.allowedResourceStatuses || [])
    check(`${label}: no console/page errors`, consoleOk, JSON.stringify({ console: opened.state.console, pageErrors: opened.state.pageErrors }))
    check(`${label}: no unknown/blocked`, opened.state.unknown.length === 0 && opened.state.blocked.length === 0, JSON.stringify({ unknown: opened.state.unknown, blocked: opened.state.blocked, departed: opened.state.departed.length }))
    results.consoleErrors.push(...opened.state.console.map((text) => ({ label, text })))
    results.pageErrors.push(...opened.state.pageErrors.map((message) => ({ label, message })))
    results.unknown.push(...opened.state.unknown)
    results.blocked.push(...opened.state.blocked)
  } catch (error) {
    check(`${label}: scenario completed`, false, String(error && error.stack || error))
    await shot(opened.page, `failure-${label}`).catch(() => {})
  } finally {
    opened.state.release()
    await opened.context.close()
    save()
  }
}

async function run() {
  if (!fs.existsSync(path.join(ART, 'index.html'))) {
    results.status = 'ARTIFACT_MISSING'
    results.error = `H5 artifact is missing: ${ART}`
    save()
    process.exitCode = 2
    return
  }
  fs.mkdirSync(SHOTS, { recursive: true })
  let browser
  try {
    browser = await chromium.launch({ headless: true, args: ['--allow-running-insecure-content'] })
  } catch (error) {
    if (machFault(error)) {
      results.status = 'NOT_RUN'
      results.browserFault = scrub(error && error.stack || error)
      results.rootCommand = ROOT_COMMAND
      save()
      process.stdout.write(JSON.stringify({ status: 'NOT_RUN' }) + '\n')
      return
    }
    throw error
  }
  try {
    results.browser = { name: 'chromium', version: browser.version() }
    await mainCase(browser, '390-list-detail-practice', {}, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      const list = await bodyText(page)
      check('390: list shows the real point, count, and three notes', list.includes(POINT_TITLE) && list.includes('1 个') && list.includes('句子实验室') && list.includes('拆解结构、调整语序，把语法变成表达的底气。') && list.includes('从掌握度低的开始') && list.includes('每个语法点都包含') && list.includes('掌握度会随练习更新'), list.slice(0, 400))
      check('390: list hides detail, practice, and answers', !list.includes(FORMULA) && !list.includes(PROMPT) && !list.includes('本地练习预览') && !list.includes('服务端已确认') && await page.locator('#grammar-exercise,.grammar-option').count() === 0, list.slice(0, 300))
      check('390: list has not fetched exercises, graph, or assessment', state.exerciseGets === 0 && state.graphRequests === 0 && state.sessionPosts.length === 0, JSON.stringify(posts(state)))
      await audit(page, '390-list')
      await shot(page, '01-list')
      await openDetail(page)
      const detail = await bodyText(page)
      check('390: detail replaces the list', await viewOf(page) === 'detail' && detail.includes(FORMULA) && detail.includes('掌握程度') && detail.includes('62%') && detail.includes(EXAMPLE) && !detail.includes('选择要拆解的语法点') && !detail.includes('句子实验室') && !detail.includes('拆解结构、调整语序，把语法变成表达的底气。'), detail.slice(0, 500))
      check('390: one real example has no invented pager, translation, or practice', !detail.includes('上一条例句') && !detail.includes('1 / 2') && !detail.includes(PROMPT) && await page.locator('#grammar-exercise,.grammar-option').count() === 0 && state.exerciseGets === 0, detail.slice(0, 400))
      await footerFits(page, '390-detail')
      await contrast(page, '390-detail', false)
      await shot(page, '01-detail')
      await page.locator('.grammar-structure').click()
      await page.waitForSelector('[data-grammar-view="structure"]', { timeout: 10000 })
      const structure = await bodyText(page)
      check('390: structure stays closed without a graph request', structure.includes('拼句练习即将开放') && structure.includes('尚未开始排序') && !structure.includes('你的排序已保存在本机') && !structure.includes('句子实验室') && state.graphRequests === 0, JSON.stringify({ graphs: state.graphRequests, structure: structure.slice(0, 300) }))
      await shot(page, '01-structure')
      const beforeBack = posts(state)
      await page.locator('.mobile-back').click()
      await page.waitForSelector('[data-grammar-view="detail"]', { timeout: 10000 })
      check('390: structure back returns to detail without a session', await viewOf(page) === 'detail' && state.exerciseGets === beforeBack.exercises && state.sessionPosts.length === 0, JSON.stringify(posts(state)))
      await openPractice(page)
      const practice = await bodyText(page)
      check('390: start reveals the real prompt once', practice.includes(PROMPT) && practice.includes('本地练习预览') && !practice.includes('句子实验室') && await page.locator('.grammar-option').count() === 4 && state.exerciseGets === 1 && state.sessionPosts.length === 0, JSON.stringify(posts(state)))
      await audit(page, '390-practice')
      await contrast(page, '390-practice', true)
      await shot(page, '01-practice')
      const submit = page.locator('.grammar-button.grammar-primary')
      await submit.focus()
      const blocked = await submit.evaluate((el) => ({ ariaDisabled: el.getAttribute('aria-disabled'), cursor: getComputedStyle(el).cursor }))
      check('390: submit is disabled before a choice', blocked.ariaDisabled === 'true' && blocked.cursor === 'default', JSON.stringify(blocked))
      await page.keyboard.press('Enter')
      await page.keyboard.press('Space')
      await sleep(300)
      const afterKey = await submit.evaluate((el) => ({ ariaDisabled: el.getAttribute('aria-disabled'), text: document.body.innerText.includes('服务端已确认') }))
      check('390: empty submit does not post assessment', afterKey.ariaDisabled === 'true' && afterKey.text === false && state.sessionPosts.length === 0 && state.attemptPosts.length === 0, JSON.stringify(posts(state)))
      await page.locator('.grammar-option').first().click()
      const chosen = await page.evaluate(() => {
        const option = document.querySelector('.grammar-option')
        const button = document.querySelector('.grammar-button.grammar-primary')
        return {
          selected: option?.classList.contains('selected') === true,
          pressed: option?.getAttribute('aria-pressed') || '',
          ariaDisabled: button?.getAttribute('aria-disabled'),
          cursor: button ? getComputedStyle(button).cursor : '',
        }
      })
      check('390: chosen option enables submit', chosen.selected && chosen.pressed === 'true' && chosen.ariaDisabled !== 'true' && chosen.cursor === 'pointer', JSON.stringify(chosen))
      await submit.click()
      await page.waitForSelector('.grammar-feedback', { timeout: 10000 })
      const feedback = await bodyText(page)
      const sessionOk = state.sessionPosts.length === 1 && state.sessionPosts[0].numericItemId && state.sessionPosts[0].hasIdempotencyKey
      const attemptOk = state.attemptPosts.length === 1 && state.attemptPosts[0].numericItemId && state.attemptPosts[0].hasIdempotencyKey
      check('390: server receipt is shown after one numeric idempotent post', feedback.includes('服务端已确认') && feedback.includes('receipt-1') && feedback.includes('服务端已判定为正确') && sessionOk && attemptOk, JSON.stringify(posts(state)))
      await shot(page, '01-receipt')
      const posted = posts(state)
      await page.locator('.mobile-back').click()
      await page.waitForSelector('[data-grammar-view="detail"]', { timeout: 10000 })
      check('390: practice back does not post again', state.sessionPosts.length === posted.sessions && state.attemptPosts.length === posted.attempts && state.exerciseGets === posted.exercises, JSON.stringify(posts(state)))
      await openPractice(page)
      check('390: reopen uses the cached preview and does not post', await page.locator('#grammar-exercise').count() === 1 && state.exerciseGets === posted.exercises && state.sessionPosts.length === posted.sessions && state.attemptPosts.length === posted.attempts, JSON.stringify(posts(state)))
    })

    await mainCase(browser, '390-deeplink', {}, async (page, state) => {
      await goto(page, '#/pages/b3-grammar/b3-grammar?grammarPointId=701')
      await page.waitForSelector('[data-grammar-view="detail"]', { timeout: 20000 })
      check('390-deeplink: matching point opens detail without a session', await viewOf(page) === 'detail' && (await bodyText(page)).includes(FORMULA) && state.exerciseGets === 0 && state.sessionPosts.length === 0, JSON.stringify(posts(state)))
      await page.locator('.mobile-back').click()
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 10000 })
      check('390-deeplink: back returns to the list', await viewOf(page) === 'list' && state.sessionPosts.length === 0, await viewOf(page))
    })

    await mainCase(browser, '390-deeplink-miss', {}, async (page, state) => {
      await goto(page, '#/pages/b3-grammar/b3-grammar?grammarPointId=999')
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      check('390-deeplink-miss: unknown id stays on the real list', (await bodyText(page)).includes(POINT_TITLE) && await page.locator('.grammar-point').count() === 1 && state.exerciseGets === 0, await viewOf(page))
    })

    await mainCase(browser, '390-draft', {}, async (page, state) => {
      await page.addInitScript(() => {
        const raw = JSON.stringify({ subject: 'grammar-subject', selectedPointId: 701, contentVersions: {} })
        localStorage.setItem('yx.b10.mobile.grammar-draft.v1', raw)
        localStorage.setItem('yx.b10.mobile.grammar-draft.v1.wrapped', JSON.stringify({ type: 'string', data: raw }))
      })
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      check('390-draft: stored point does not auto-open detail', await viewOf(page) === 'list' && await page.locator('#grammar-exercise').count() === 0 && state.exerciseGets === 0, await viewOf(page))
    })

    await mainCase(browser, '390-leave-during-load', { holdPoints: true }, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-state="loading"]', { timeout: 20000 })
      await page.evaluate(() => { window.location.hash = '#/pages/login/login' })
      await page.waitForFunction(() => location.hash.includes('/pages/login/login'), { timeout: 10000 })
      state.release()
      await sleep(800)
      const leaked = await page.evaluate(() => location.hash.includes('b3-grammar') && Boolean(document.querySelector('.grammar-point')))
      check('390-leave: late grammar payload does not paint after the route changes', leaked === false, page.url())
    })

    await mainCase(browser, '390-list-back', {}, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await page.evaluate(() => {
        document.addEventListener('click', (event) => {
          const target = event.target
          if (target instanceof Element && target.closest('.mobile-back')) window.__grammarBackPrevented = event.defaultPrevented
        }, false)
      })
      await page.locator('.mobile-back').click()
      await page.waitForFunction(() => !location.hash.includes('/pages/b3-grammar/b3-grammar'), { timeout: 10000 })
      const prevented = await page.evaluate(() => window.__grammarBackPrevented === true)
      check('390-list-back: native back is not cancelled and opens no assessment', prevented === false && !page.url().includes('/pages/b3-grammar/b3-grammar') && state.sessionPosts.length === 0 && state.exerciseGets === 0, page.url())
    })

    await mainCase(browser, '390-empty', { mode: 'empty' }, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-state="empty"]', { timeout: 20000 })
      const text = await bodyText(page)
      check('390-empty: true empty catalog has no preview or prompt', text.includes('暂无可练习的语法内容') && !text.includes('本地练习预览') && !text.includes(PROMPT) && state.sessionPosts.length === 0, text.slice(0, 240))
      await shot(page, '01-empty')
    })

    await mainCase(browser, '390-unbound', { mode: 'unbound' }, async (page, state) => {
      await goto(page)
      await page.waitForSelector('#grammar-exercise', { timeout: 20000 })
      const text = await bodyText(page)
      const catalog = await page.locator('.v2-grammar-page').getAttribute('data-grammar-catalog')
      check('390-unbound: catalog practice keeps the real prompt', catalog === 'true' && text.includes(PROMPT) && text.includes('本地练习预览') && await page.locator('.grammar-point').count() === 0, text.slice(0, 300))
      await page.locator('.grammar-option').first().click()
      await page.locator('.grammar-button.grammar-primary').click()
      await page.waitForSelector('.grammar-feedback', { timeout: 10000 })
      const posted = posts(state)
      check('390-unbound: catalog submit uses one server receipt', (await bodyText(page)).includes('receipt-1') && posted.sessions === 1 && posted.attempts === 1, JSON.stringify(posted))
      await page.locator('.mobile-back').click()
      await page.waitForFunction(() => !location.hash.includes('/pages/b3-grammar/b3-grammar'), { timeout: 10000 })
      check('390-unbound: native back adds no assessment post', state.sessionPosts.length === 1 && state.attemptPosts.length === 1, JSON.stringify(posts(state)))
    })

    await mainCase(browser, '390-service-error', { mode: 'error', allowedResourceStatuses: [503] }, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-state="offline"],[data-grammar-state="error"]', { timeout: 20000 })
      check('390-service-error: unavailable copy and no assessment', (await bodyText(page)).includes('网络不可用') && state.sessionPosts.length === 0, await bodyText(page))
      await page.locator('.grammar-button').click()
      await sleep(500)
      check('390-service-error: retry reads points again and does not post', state.pointGets >= 2 && state.sessionPosts.length === 0 && state.attemptPosts.length === 0, JSON.stringify(posts(state)))
      await shot(page, '01-service-error')
    })

    await mainCase(browser, '390-stale', { mode: 'stale', allowedResourceStatuses: [410] }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-state="stale"]', { timeout: 20000 })
      check('390-stale: content changed retry', (await bodyText(page)).includes('内容已更新，请重试。'), await bodyText(page))
      await shot(page, '01-stale')
    })

    await mainCase(browser, '390-receipt-missing', { mode: 'receipt-missing' }, async (page, state) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await openDetail(page)
      await openPractice(page)
      await page.locator('.grammar-option').first().click()
      await page.locator('.grammar-button.grammar-primary').click()
      await page.waitForSelector('[data-grammar-state="error"],[data-grammar-state="offline"]', { timeout: 10000 })
      const text = await bodyText(page)
      check('390-receipt-missing: unconfirmed feedback stays hidden', !text.includes('服务端已确认') && !text.includes('receipt-1') && await page.locator('.grammar-feedback').count() === 0 && state.attemptPosts.length === 1, text.slice(0, 300))
    })

    await mainCase(browser, '390-auth401', { mode: 'auth401', allowedResourceStatuses: [401] }, async (page) => {
      await page.goto(`${BASE}/#/pages/b3-grammar/b3-grammar`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForFunction(() => location.hash.includes('/pages/login/login'), { timeout: 20000 })
      check('390-auth401: unauthenticated leaves grammar', page.url().includes('/pages/login/login'), page.url())
    })

    await mainCase(browser, '390-auth403', { mode: 'auth403', allowedResourceStatuses: [403] }, async (page) => {
      await page.goto(`${BASE}/#/pages/b3-grammar/b3-grammar`, { waitUntil: 'domcontentloaded', timeout: 30000 })
      await page.waitForFunction(() => location.hash.includes('/pages/forbidden/forbidden') || document.body.innerText.includes('无法访问') || document.body.innerText.includes('没有'), { timeout: 20000 })
      const hash = page.url()
      const text = await page.evaluate(() => document.body.innerText.slice(0, 300))
      check('390-auth403: forbidden is visible', hash.includes('/pages/forbidden/forbidden') || text.includes('无法访问') || text.includes('没有'), JSON.stringify({ hash, text }))
    })

    await mainCase(browser, '320-short', { width: 320, height: 568 }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await audit(page, '320-list')
      await openDetail(page)
      await footerFits(page, '320-detail')
      await audit(page, '320-detail')
      await shot(page, '01-320')
    })

    await mainCase(browser, '768', { width: 768, height: 1024 }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await openDetail(page)
      await footerFits(page, '768-detail')
      await audit(page, '768-detail')
      await shot(page, '01-768')
    })

    await mainCase(browser, '390-en-200', { uiLocale: 'en-US' }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      check('390-en: English list copy', (await bodyText(page)).includes('Sentence lab') && (await bodyText(page)).includes('1 points'), await bodyText(page))
      await openDetail(page)
      check('390-en: detail omits the list hero', !(await bodyText(page)).includes('Sentence lab') && (await bodyText(page)).includes(FORMULA), await bodyText(page))
      await scaleText(page)
      await footerFits(page, '390-en-200')
      await audit(page, '390-en-200')
      await shot(page, '01-en-200')
    })

    await mainCase(browser, '390-dark', { theme: 'dark', colorScheme: 'dark' }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await openDetail(page)
      check('390-dark: dark class', await page.evaluate(() => document.querySelector('.v2-grammar-page')?.className.includes('b10-theme--dark')), await page.evaluate(() => document.querySelector('.v2-grammar-page')?.className || ''))
      await openPractice(page)
      await contrast(page, '390-dark', true)
      await shot(page, '01-dark')
    })

    await mainCase(browser, '390-hc-200', { theme: 'high-contrast' }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      await openDetail(page)
      check('390-hc: high contrast class', await page.evaluate(() => document.querySelector('.v2-grammar-page')?.className.includes('b10-theme--high-contrast')), await page.evaluate(() => document.querySelector('.v2-grammar-page')?.className || ''))
      await scaleText(page)
      await footerFits(page, '390-hc-200')
      await contrast(page, '390-hc-200', false)
      await shot(page, '01-hc-200')
    })

    await mainCase(browser, '390-reduced-motion', { reducedMotion: 'reduce', motion: 'REDUCED' }, async (page) => {
      await goto(page)
      await page.waitForSelector('[data-grammar-view="list"]', { timeout: 20000 })
      const motion = await page.evaluate(() => {
        const root = document.querySelector('.v2-grammar-page')
        const button = document.querySelector('.grammar-point')
        return { data: root?.getAttribute('data-motion') || '', duration: button ? getComputedStyle(button).transitionDuration : '' }
      })
      check('390-reduced: motion is reduced and transitions are off', (motion.data === 'off' || motion.data === 'reduced') && (motion.duration === '0s' || motion.duration === '0ms'), JSON.stringify(motion))
      await shot(page, '01-reduced')
    })

    results.indexSha256 = shaFile(path.join(ART, 'index.html'))
    results.status = results.checks.every((item) => item.ok) ? 'PASS' : 'COMPLETED_WITH_FAILURES'
    results.finishedAt = new Date().toISOString()
    results.rootCommand = ROOT_COMMAND
    save()
    process.stdout.write(JSON.stringify({ status: results.status, checks: results.checks.length, failed: results.checks.filter((item) => !item.ok).length, screenshots: results.screenshots.length, firstFailure: results.firstFailure }) + '\n')
    process.exitCode = results.status === 'PASS' ? 0 : 1
  } catch (error) {
    if (machFault(error)) {
      results.status = 'NOT_RUN'
      results.browserFault = scrub(error && error.stack || error)
    } else {
      results.status = 'COMPLETED_WITH_FAILURES'
      results.error = scrub(error && error.stack || error)
      process.exitCode = 1
    }
    results.rootCommand = ROOT_COMMAND
    save()
    process.stdout.write(JSON.stringify({ status: results.status, error: results.error || results.browserFault }) + '\n')
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}

run()
