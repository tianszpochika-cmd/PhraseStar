#!/usr/bin/env node
/**
 * Guarded anonymous H5 smoke for the frozen G447 artifact.
 *
 * Default (no flags): prepare/check only. No listen, no browser, no HTTP to 18183.
 * --run: Root serialized lease starts 127.0.0.1:18183 + Chrome. Collision fails
 * without increment or kill.
 *
 * No mocked response/token/cookie injection. Nonstatic requests are aborted
 * and counted without bodies. Own PIDs only are closed in finally.
 */
import http from 'node:http'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT = process.env.OUTPUT ? path.resolve(process.env.OUTPUT) : HERE
const PINS_PATH = path.join(OUTPUT, 'pins.json')
const CHECKOUT = '/Users/Admin/.codex/worktrees/mobile-deps-20261108/cloudstudy'
const HOST = '127.0.0.1'
const PORT = 18183
const BUDGET_MS = 180000
const PHONE = { width: 390, height: 844 }
const NONCE_HEADER = 'x-g447-h5-nonce'
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
const PUBLIC = new Set([
  'pages/login/login',
  'pages/register/register',
  'pages/reset-password/reset-password',
  'pages/forbidden/forbidden',
  'pages/report-share/report-share',
])
const LAYOUT_PAGES = ['pages/login/login', 'pages/register/register', 'pages/reset-password/reset-password']
const CHROME_CANDIDATES = [
  '/Users/Admin/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Users/Admin/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  '/Users/Admin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
]
const SYSTEM_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const requireFromCheckout = createRequire(path.join(CHECKOUT, 'package.json'))

function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}
function sha256File(file) {
  return sha256Buf(fs.readFileSync(file))
}
function posixRel(root, abs) {
  return path.relative(root, abs).split(path.sep).join('/')
}
function treeFingerprint(root) {
  const hash = crypto.createHash('sha256')
  let files = 0
  const walk = (dir) => {
    const names = fs.readdirSync(dir).sort()
    const subdirs = []
    for (const name of names) {
      const abs = path.join(dir, name)
      let st
      try { st = fs.lstatSync(abs) } catch { continue }
      if (st.isSymbolicLink()) {
        let target
        try { target = fs.statSync(abs) } catch { continue }
        if (target.isFile()) {
          hash.update(posixRel(root, abs), 'utf8')
          hash.update('\0')
          hash.update(sha256File(abs), 'utf8')
          hash.update('\n')
          files += 1
        }
        continue
      }
      if (st.isFile()) {
        hash.update(posixRel(root, abs), 'utf8')
        hash.update('\0')
        hash.update(sha256File(abs), 'utf8')
        hash.update('\n')
        files += 1
      } else if (st.isDirectory()) subdirs.push(abs)
    }
    for (const sub of subdirs) walk(sub)
  }
  walk(root)
  return { sha256: hash.digest('hex'), files }
}
function snapshotH5(h5Root) {
  const real = fs.realpathSync(h5Root)
  const index = path.join(real, 'index.html')
  const indexReal = fs.realpathSync(index)
  if (indexReal !== path.join(real, 'index.html') && !indexReal.startsWith(real + path.sep)) {
    throw new Error('index.html realpath escaped H5 root')
  }
  const tree = treeFingerprint(real)
  return {
    h5_realpath: real,
    index_html_realpath: indexReal,
    index_sha256: sha256File(index),
    index_bytes: fs.statSync(index).size,
    tree_fingerprint_sha256: tree.sha256,
    file_count: tree.files,
  }
}
function readPins() {
  return JSON.parse(fs.readFileSync(PINS_PATH, 'utf8'))
}
function loadRequestedRoutes(pins) {
  const pagesPath = path.join(CHECKOUT, pins.pages_json)
  const pagesSha = sha256File(pagesPath)
  if (pagesSha !== pins.pages_json_sha256) {
    throw new Error(`pages.json hash drift: ${pagesSha} vs pin ${pins.pages_json_sha256}`)
  }
  const pages = JSON.parse(fs.readFileSync(pagesPath, 'utf8')).pages
  const routes = pages.map((entry) => entry.path)
  if (routes.length !== 33) throw new Error(`expected 33 official routes, got ${routes.length}`)
  if (new Set(routes).size !== 33) throw new Error('duplicate routes in pages.json')
  if (JSON.stringify(routes) !== JSON.stringify(pins.requested_routes)) {
    throw new Error('pages.json route list does not match pins.requested_routes')
  }
  return routes
}
function parsePagesMd() {
  const text = fs.readFileSync(path.join(CHECKOUT, 'docs/design/mobile-uispec-v2/PAGES.md'), 'utf8')
  const found = text.match(/pages\/[a-z0-9-]+\/[a-z0-9-]+/g) || []
  return [...new Set(found)]
}
function verifyPins(pins) {
  const live = snapshotH5(pins.h5_root)
  const mismatches = []
  for (const key of ['h5_realpath', 'index_html_realpath', 'index_sha256', 'index_bytes', 'tree_fingerprint_sha256', 'file_count']) {
    if (live[key] !== pins[key]) mismatches.push({ key, live: live[key], pin: pins[key] })
  }
  if (mismatches.length) {
    const err = new Error('H5 pin mismatch (index can stay while chunks change; tree fingerprint is required)')
    err.mismatches = mismatches
    err.live = live
    throw err
  }
  return live
}
function listenHolders(port) {
  const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' })
  if (result.status !== 0 && !result.stdout) return []
  const lines = (result.stdout || '').trim().split('\n').filter(Boolean)
  if (lines.length <= 1) return []
  return lines.slice(1).map((line) => {
    const parts = line.split(/\s+/)
    return { command: parts[0], pid: Number(parts[1]), name: parts.slice(8).join(' ') }
  }).filter((row) => Number.isFinite(row.pid))
}
function chromeCandidatesExist() {
  return {
    testing: CHROME_CANDIDATES.map((p) => ({ path: p, exists: fs.existsSync(p) })),
    system: { path: SYSTEM_CHROME, exists: fs.existsSync(SYSTEM_CHROME) },
  }
}
function resolvePlaywright() {
  const id = requireFromCheckout.resolve('playwright')
  const playwright = requireFromCheckout('playwright')
  if (!playwright?.chromium?.launch) throw new Error(`playwright.chromium.launch missing at ${id}`)
  return { id, chromium: playwright.chromium }
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
function originOf(url) {
  return `${url.protocol}//${url.host}`
}
function isOurOrigin(url) {
  return url.hostname === HOST && Number(url.port || (url.protocol === 'https:' ? 443 : 80)) === PORT
}
function isStaticPath(pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/favicon.ico') return true
  if (pathname.startsWith('/assets/') || pathname.startsWith('/static/')) return true
  return false
}
function isStaticRequest(url, method) {
  if (!['GET', 'HEAD'].includes(method)) return false
  if (!isOurOrigin(url)) return false
  if (pathnameEscapes(url.pathname)) return false
  return isStaticPath(url.pathname)
}
function pathnameEscapes(pathname) {
  let decoded = pathname
  try { decoded = decodeURIComponent(pathname) } catch { return true }
  if (decoded.includes('\0') || decoded.split('/').includes('..')) return true
  return false
}
function routeFromHash(hash) {
  const raw = String(hash || '').replace(/^#/, '')
  const pathOnly = raw.split(/[?#]/, 1)[0] || ''
  return pathOnly.replace(/^\//, '')
}
function expectedLanding(route) {
  if (PUBLIC.has(route)) return route
  return 'pages/login/login'
}
function landingText(route) {
  return {
    'pages/login/login': '欢迎回来',
    'pages/register/register': '创建账号',
    'pages/reset-password/reset-password': '忘记密码',
    'pages/forbidden/forbidden': '暂时无法确认访问状态',
    'pages/report-share/report-share': '分享的学习报告',
  }[route] || '欢迎回来'
}
function landingSelector(route) {
  return {
    'pages/login/login': '.login-submit',
    'pages/register/register': '.register-form',
    'pages/reset-password/reset-password': '.reset-form',
    'pages/forbidden/forbidden': '.forbidden-page',
    'pages/report-share/report-share': '#report-share-page',
  }[route] || '.login-submit'
}

async function launchChrome(chromium) {
  const attempts = []
  for (const executablePath of CHROME_CANDIDATES) {
    if (!fs.existsSync(executablePath)) {
      attempts.push({ executablePath, error: 'missing' })
      continue
    }
    try {
      const browser = await chromium.launch({ headless: true, executablePath, args: ['--disable-gpu'] })
      return { browser, launch: { executablePath, attempts } }
    } catch (error) {
      attempts.push({ executablePath, error: String(error && error.message || error).slice(0, 300) })
    }
  }
  try {
    const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-gpu'] })
    return { browser, launch: { channel: 'chrome', attempts } }
  } catch (error) {
    attempts.push({ channel: 'chrome', error: String(error && error.message || error).slice(0, 300) })
  }
  if (fs.existsSync(SYSTEM_CHROME)) {
    try {
      const browser = await chromium.launch({ headless: true, executablePath: SYSTEM_CHROME, args: ['--disable-gpu'] })
      return { browser, launch: { executablePath: SYSTEM_CHROME, attempts } }
    } catch (error) {
      attempts.push({ executablePath: SYSTEM_CHROME, error: String(error && error.message || error).slice(0, 300) })
    }
  }
  const err = new Error('chrome launch failed')
  err.attempts = attempts
  throw err
}

function serveHandler(h5Real, nonce, counts) {
  return (req, res) => {
    const method = req.method || 'GET'
    let url
    try { url = new URL(req.url || '/', `http://${HOST}:${PORT}`) } catch {
      counts.nonstatic += 1
      counts.nonstaticByKind.badUrl += 1
      res.statusCode = 444
      res.end()
      return
    }
    if (!isStaticRequest(url, method)) {
      counts.nonstatic += 1
      counts.nonstaticByKind.server += 1
      counts.nonstaticSamples.push({ via: 'server', method, path: url.pathname })
      res.statusCode = 444
      res.end()
      return
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '')
    const abs = path.resolve(h5Real, rel)
    let real
    try { real = fs.realpathSync(abs) } catch {
      counts.staticMiss += 1
      res.statusCode = 404
      res.end()
      return
    }
    if (!(real === path.join(h5Real, 'index.html') || real.startsWith(h5Real + path.sep)) || !fs.statSync(real).isFile()) {
      counts.staticMiss += 1
      res.statusCode = 404
      res.end()
      return
    }
    const headers = {
      'content-type': MIME[path.extname(real).toLowerCase()] || 'application/octet-stream',
      [NONCE_HEADER]: nonce,
      'cache-control': 'no-store',
      'access-control-expose-headers': NONCE_HEADER,
    }
    counts.static += 1
    if (method === 'HEAD') {
      res.writeHead(200, headers)
      res.end()
      return
    }
    res.writeHead(200, headers)
    fs.createReadStream(real).pipe(res)
  }
}

async function listenExclusive(handler) {
  const holders = listenHolders(PORT)
  if (holders.length) {
    const err = new Error('PORT_COLLISION')
    err.code = 'PORT_COLLISION'
    err.holders = holders
    throw err
  }
  const server = http.createServer(handler)
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListen)
      if (error && error.code === 'EADDRINUSE') {
        const wrapped = new Error('PORT_COLLISION')
        wrapped.code = 'PORT_COLLISION'
        wrapped.holders = listenHolders(PORT)
        wrapped.cause = error
        reject(wrapped)
        return
      }
      reject(error)
    }
    const onListen = () => {
      server.off('error', onError)
      resolve()
    }
    server.once('error', onError)
    server.once('listening', onListen)
    server.listen({ host: HOST, port: PORT, exclusive: true })
  })
  return server
}

async function closeServer(server) {
  if (!server) return
  await new Promise((resolve) => server.close(() => resolve()))
}

async function waitOursReleased(ourPids, timeoutMs) {
  const started = Date.now()
  let holders = []
  while (Date.now() - started < timeoutMs) {
    holders = listenHolders(PORT)
    const ours = holders.filter((row) => ourPids.includes(row.pid))
    if (ours.length === 0) {
      return { freeOfOurs: true, holders, elapsedMs: Date.now() - started }
    }
    await sleep(50)
  }
  return { freeOfOurs: false, holders, elapsedMs: Date.now() - started }
}

function terminateOwn(pid, reason, log) {
  if (!pid || pid === process.pid) return { pid, reason, sent: false }
  try {
    process.kill(pid, 0)
  } catch {
    return { pid, reason, sent: false, alreadyGone: true }
  }
  try {
    process.kill(pid, 'SIGTERM')
    log.push({ pid, signal: 'SIGTERM', reason })
    return { pid, reason, sent: 'SIGTERM' }
  } catch (error) {
    return { pid, reason, sent: false, error: String(error && error.message || error).slice(0, 200) }
  }
}

function failRow(row, name, expected, actual) {
  row.checks.push({ name, ok: false, expected, actual })
  row.failures.push({ name, expected, actual })
}
function passRow(row, name, actual) {
  row.checks.push({ name, ok: true, actual })
}
function finishRow(row) {
  const skipped = row.checks.filter((c) => c.skipped)
  if (skipped.length) {
    row.status = 'FAIL'
    row.failures.push({ name: 'skipped-marked-pass-forbidden', expected: 0, actual: skipped.length })
    return row
  }
  row.status = row.failures.length === 0 ? 'PASS' : 'FAIL'
  return row
}

async function attachAbort(context, box) {
  await context.route('**/*', async (route) => {
    const req = route.request()
    let url
    try { url = new URL(req.url()) } catch {
      box.totals.nonstatic += 1
      if (box.row) box.row.nonstatic += 1
      return route.abort('blockedbyclient')
    }
    const method = req.method()
    if (isStaticRequest(url, method)) return route.continue()
    const sample = { method, origin: originOf(url), path: url.pathname }
    if (box.row) {
      box.row.nonstatic += 1
      if (box.row.nonstaticSamples.length < 8) box.row.nonstaticSamples.push(sample)
    }
    box.totals.nonstatic += 1
    box.totals.nonstaticByKind.playwright += 1
    if (box.totals.nonstaticSamples.length < 40) box.totals.nonstaticSamples.push({ via: 'playwright', ...sample })
    return route.abort('blockedbyclient')
  })
}

async function pageFacts(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app')
    const text = (app && (app.innerText || app.textContent) || '').replace(/\s+/g, ' ').trim()
    const scripts = [...document.querySelectorAll('script[src]')].map((el) => el.getAttribute('src'))
    const css = [...document.querySelectorAll('link[rel="stylesheet"]')].map((el) => el.getAttribute('href'))
    const failed = performance.getEntriesByType('resource').filter((entry) => entry.transferSize === 0 && entry.decodedBodySize === 0 && /\.(js|css)(\?|$)/.test(entry.name)).map((entry) => entry.name)
    return {
      hash: location.hash,
      title: document.title,
      theme: document.documentElement.dataset.theme || '',
      colorScheme: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      appChildren: app ? app.childElementCount : 0,
      appText: text.slice(0, 400),
      appBlank: !app || (app.childElementCount === 0 && text.length === 0),
      nonceHeader: null,
      scripts,
      css,
      failedJsCss: failed.slice(0, 20),
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      activeTag: document.activeElement ? document.activeElement.tagName : '',
      activeType: document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('type') : '',
      viewport: { width: window.innerWidth, height: window.innerHeight },
    }
  })
}

async function readNonceInPage(page) {
  return page.evaluate(async (headerName) => {
    const res = await fetch('/', { method: 'HEAD', cache: 'no-store' })
    return res.headers.get(headerName)
  }, NONCE_HEADER)
}

async function waitBoot(page, route, timeoutMs) {
  const expected = expectedLanding(route)
  const selector = landingSelector(expected)
  await page.waitForFunction((sel) => {
    const app = document.querySelector('#app')
    if (!app || app.childElementCount === 0) return false
    return Boolean(document.querySelector(sel))
  }, selector, { timeout: timeoutMs }).catch(() => {})
}

async function screenshotPublic(page, name) {
  await page.evaluate(() => {
    document.querySelectorAll('input, textarea').forEach((el) => {
      el.value = ''
      el.removeAttribute('value')
    })
  })
  const file = path.join(OUTPUT, 'shots', `${name}.png`)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: false })
  return file
}

function shotName(route, extra) {
  return `${route.replaceAll('/', '-')}${extra}`
}

async function exerciseRoute(page, box, route, theme, viewport, nonce, opts = {}) {
  const row = {
    requestedRoute: route,
    theme,
    viewport,
    fontScale: opts.fontScale || 1,
    kind: opts.kind || 'anonymous-phone',
    checks: [],
    failures: [],
    nonstatic: 0,
    nonstaticSamples: [],
    pageErrors: [],
    rejections: [],
    missingStatic: [],
    screenshot: null,
    requested: route,
    finalRoute: null,
  }
  const onError = (error) => row.pageErrors.push(String(error && error.message || error).slice(0, 400))
  const onFailed = (request) => {
    let url
    try { url = new URL(request.url()) } catch { return }
    if (isStaticRequest(url, request.method())) {
      row.missingStatic.push({ method: request.method(), path: url.pathname, reason: request.failure()?.errorText || 'failed' })
    }
  }
  page.on('pageerror', onError)
  page.on('requestfailed', onFailed)
  box.row = row
  try {
    const target = `http://${HOST}:${PORT}/#/${route}?theme=${theme}&uiLocale=zh-CN`
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const navNonce = response ? response.headers()[NONCE_HEADER] : null
    if (navNonce === nonce) passRow(row, 'nonce-nav-header', navNonce)
    else failRow(row, 'nonce-nav-header', nonce, navNonce)
    await waitBoot(page, route, 8000)
    if (opts.fontScale === 2) {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    }
    const facts = await pageFacts(page)
    const pageNonce = await readNonceInPage(page).catch((error) => `error:${String(error && error.message || error).slice(0, 120)}`)
    if (pageNonce === nonce) passRow(row, 'nonce-in-page-head', pageNonce)
    else failRow(row, 'nonce-in-page-head', nonce, pageNonce)
    row.finalRoute = routeFromHash(facts.hash)
    row.facts = {
      hash: facts.hash,
      theme: facts.theme,
      appChildren: facts.appChildren,
      appText: facts.appText,
      overflow: facts.overflow,
      colorScheme: facts.colorScheme,
    }
    const expected = expectedLanding(route)
    if (row.finalRoute === expected) passRow(row, 'expected-anonymous-landing', row.finalRoute)
    else failRow(row, 'expected-anonymous-landing', expected, row.finalRoute)
    if (PUBLIC.has(route) && row.finalRoute !== route) {
      failRow(row, 'public-route-stayed-public', route, row.finalRoute)
    }
    if (!PUBLIC.has(route) && row.finalRoute !== 'pages/login/login') {
      failRow(row, 'protected-did-not-authenticate', 'pages/login/login', row.finalRoute)
    }
    if (facts.appBlank) failRow(row, 'nonblank-#app', 'children or text', facts.appText)
    else passRow(row, 'nonblank-#app', { children: facts.appChildren, textLen: facts.appText.length })
    if (row.pageErrors.length) failRow(row, 'no-uncaught-js', [], row.pageErrors)
    else passRow(row, 'no-uncaught-js', [])
    const rejections = await page.evaluate(() => Array.isArray(window.__yxSmokeRejections) ? window.__yxSmokeRejections.slice(0, 8) : [])
    row.rejections = rejections
    if (rejections.length) failRow(row, 'no-unhandled-rejection', [], rejections)
    else passRow(row, 'no-unhandled-rejection', [])
    if (row.missingStatic.length) failRow(row, 'no-missing-js-css', [], row.missingStatic)
    else passRow(row, 'no-missing-js-css', [])
    const expectedText = landingText(expected)
    if (facts.appText.includes(expectedText)) passRow(row, 'landing-copy', expectedText)
    else failRow(row, 'landing-copy', expectedText, facts.appText.slice(0, 160))
    if (opts.layout) {
      if (facts.overflow) failRow(row, 'no-horizontal-overflow', false, true)
      else passRow(row, 'no-horizontal-overflow', false)
      let reached = false
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press('Tab')
        const active = await page.evaluate(() => ({
          tag: document.activeElement ? document.activeElement.tagName : '',
          type: document.activeElement && document.activeElement.getAttribute ? document.activeElement.getAttribute('type') : '',
        }))
        if (active.tag === 'INPUT' || active.tag === 'TEXTAREA') {
          reached = true
          passRow(row, 'keyboard-reached-field', active)
          break
        }
      }
      if (!reached) failRow(row, 'keyboard-reached-field', 'INPUT/TEXTAREA', 'none')
      const submitted = await page.evaluate(() => Boolean(document.querySelector('form[data-yx-submitted="1"]')))
      if (submitted) failRow(row, 'no-credential-submission', false, true)
      else passRow(row, 'no-credential-submission', false)
    }
    if (LAYOUT_PAGES.includes(route) && opts.screenshot) {
      row.screenshot = await screenshotPublic(page, shotName(route, opts.shotSuffix || ''))
    }
  } catch (error) {
    failRow(row, 'navigation', 'ok', String(error && error.message || error).slice(0, 400))
  } finally {
    page.off('pageerror', onError)
    page.off('requestfailed', onFailed)
    box.row = null
  }
  return finishRow(row)
}

async function prepare() {
  await fsp.mkdir(OUTPUT, { recursive: true })
  const pins = readPins()
  const live = verifyPins(pins)
  const routes = loadRequestedRoutes(pins)
  const mdRoutes = parsePagesMd()
  const mdEqual = mdRoutes.length === 33 && mdRoutes.every((route) => routes.includes(route)) && routes.every((route) => mdRoutes.includes(route))
  const playwright = (() => {
    try { return { ok: true, ...resolvePlaywright() } } catch (error) {
      return { ok: false, error: String(error && error.message || error) }
    }
  })()
  const receipt = {
    mode: 'prepare',
    at: new Date().toISOString(),
    node: process.version,
    pid: process.pid,
    output: OUTPUT,
    pinsPath: PINS_PATH,
    live,
    routes: {
      requested: routes,
      requestedCount: routes.length,
      pagesMdCount: mdRoutes.length,
      pagesMdSetEqualsPagesJson: mdEqual,
      publicCount: routes.filter((route) => PUBLIC.has(route)).length,
      protectedCount: routes.filter((route) => !PUBLIC.has(route)).length,
    },
    chrome: chromeCandidatesExist(),
    playwright: { ok: playwright.ok, id: playwright.id || null, error: playwright.error || null },
    port18183: { policy: 'do-not-bind-in-prepare', holders: listenHolders(PORT) },
    matrixDenominator: pins.matrix.denominator,
    notRun: pins.not_run.concat(['--run-browser-smoke']),
    bind: false,
    browser: false,
  }
  const receiptPath = path.join(OUTPUT, 'prepare-receipt.json')
  await fsp.writeFile(receiptPath, JSON.stringify(receipt, null, 2))
  return { pins, routes, receipt, receiptPath }
}

async function run() {
  const started = Date.now()
  const budget = () => {
    if (Date.now() - started > BUDGET_MS) {
      const err = new Error('RUNTIME_BUDGET')
      err.code = 'RUNTIME_BUDGET'
      throw err
    }
  }
  const { pins, routes, receipt: prepareReceipt } = await prepare()
  const before = verifyPins(pins)
  const { chromium } = resolvePlaywright()
  const nonce = crypto.randomBytes(16).toString('hex')
  const counts = { static: 0, staticMiss: 0, nonstatic: 0, nonstaticByKind: { server: 0, playwright: 0, badUrl: 0 }, nonstaticSamples: [] }
  const ownership = { parentPid: process.pid, serverPid: process.pid, browserPid: null, signals: [] }
  let server
  let browser
  let launchMeta
  const rows = []
  const shotsDir = path.join(OUTPUT, 'shots')
  await fsp.mkdir(shotsDir, { recursive: true })
  try {
    budget()
    server = await listenExclusive(serveHandler(before.h5_realpath, nonce, counts))
    ownership.serverAddress = server.address()
    const launched = await launchChrome(chromium)
    browser = launched.browser
    launchMeta = launched.launch
    ownership.browserPid = browser.process()?.pid || null
    for (const theme of ['light', 'dark']) {
      budget()
      const context = await browser.newContext({
        viewport: PHONE,
        locale: 'zh-CN',
        colorScheme: theme,
        reducedMotion: 'reduce',
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
      })
      await context.addInitScript((selected) => {
        window.__yxSmokeRejections = []
        window.addEventListener('unhandledrejection', (event) => {
          const reason = event.reason
          window.__yxSmokeRejections.push(reason && typeof reason === 'object'
            ? String(reason.message || reason.errMsg || reason).slice(0, 300)
            : String(reason).slice(0, 300))
        })
        try { localStorage.setItem('ef.theme', JSON.stringify({ type: 'string', data: selected })) } catch {}
      }, theme)
      const page = await context.newPage()
      const box = { row: null, totals: counts }
      await attachAbort(context, box)
      for (const route of routes) {
        budget()
        rows.push(await exerciseRoute(page, box, route, theme, PHONE, nonce, {
          screenshot: theme === 'light' && LAYOUT_PAGES.includes(route),
          shotSuffix: `__${theme}-390`,
        }))
      }
      await context.close()
    }
    for (const width of [320, 768]) {
      for (const route of LAYOUT_PAGES) {
        budget()
        const context = await browser.newContext({
          viewport: { width, height: 844 },
          locale: 'zh-CN',
          colorScheme: 'light',
          reducedMotion: 'reduce',
          deviceScaleFactor: 1,
          serviceWorkers: 'block',
        })
        await context.addInitScript(() => {
          window.__yxSmokeRejections = []
          window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason
            window.__yxSmokeRejections.push(String(reason && reason.message || reason).slice(0, 300))
          })
        })
        const page = await context.newPage()
        const box = { row: null, totals: counts }
        await attachAbort(context, box)
        rows.push(await exerciseRoute(page, box, route, 'light', { width, height: 844 }, nonce, {
          kind: 'public-layout',
          layout: true,
          screenshot: true,
          shotSuffix: `__light-${width}`,
        }))
        await context.close()
      }
    }
    for (const route of LAYOUT_PAGES) {
      budget()
      const context = await browser.newContext({
        viewport: PHONE,
        locale: 'zh-CN',
        colorScheme: 'light',
        reducedMotion: 'reduce',
        deviceScaleFactor: 1,
        serviceWorkers: 'block',
      })
      await context.addInitScript(() => {
        window.__yxSmokeRejections = []
        window.addEventListener('unhandledrejection', (event) => {
          const reason = event.reason
          window.__yxSmokeRejections.push(String(reason && reason.message || reason).slice(0, 300))
        })
      })
      const page = await context.newPage()
      const box = { row: null, totals: counts }
      await attachAbort(context, box)
      rows.push(await exerciseRoute(page, box, route, 'light', PHONE, nonce, {
        kind: 'public-font-200',
        layout: true,
        fontScale: 2,
        screenshot: true,
        shotSuffix: '__light-390-font200',
      }))
      await context.close()
    }
  } finally {
    if (browser) {
      try { await browser.close() } catch {}
      if (ownership.browserPid) terminateOwn(ownership.browserPid, 'finally-browser', ownership.signals)
    }
    await closeServer(server)
    ownership.portAfterClose = await waitOursReleased([ownership.parentPid, ownership.browserPid].filter(Boolean), 4000)
  }
  const after = verifyPins(pins)
  const anonymousRows = rows.filter((row) => row.kind === 'anonymous-phone')
  const layoutRows = rows.filter((row) => row.kind !== 'anonymous-phone')
  const requestedVsFinal = anonymousRows.map((row) => ({
    requested: row.requestedRoute,
    theme: row.theme,
    final: row.finalRoute,
    expected: expectedLanding(row.requestedRoute),
    status: row.status,
  }))
  const failed = rows.filter((row) => row.status !== 'PASS')
  const skippedPass = rows.some((row) => row.checks.some((c) => c.skipped && c.ok))
  if (skippedPass) failed.push({ requestedRoute: '*', status: 'FAIL', failures: [{ name: 'skipped-as-pass' }] })
  const authenticatedClaim = anonymousRows.filter((row) => !PUBLIC.has(row.requestedRoute) && row.finalRoute && row.finalRoute !== 'pages/login/login')
  const result = {
    mode: 'run',
    at: new Date().toISOString(),
    elapsedMs: Date.now() - started,
    budgetMs: BUDGET_MS,
    nonceHeader: NONCE_HEADER,
    noncePresent: Boolean(nonce),
    launch: launchMeta,
    ownership,
    before,
    after,
    treeUnchanged: before.tree_fingerprint_sha256 === after.tree_fingerprint_sha256 && before.index_sha256 === after.index_sha256,
    counts: {
      static: counts.static,
      staticMiss: counts.staticMiss,
      nonstatic: counts.nonstatic,
      nonstaticByKind: counts.nonstaticByKind,
      nonstaticSamples: counts.nonstaticSamples.slice(0, 40),
    },
    matrix: {
      denominator: pins.matrix.denominator,
      anonymousCells: anonymousRows.length,
      layoutCells: layoutRows.length,
      totalNavigations: rows.length,
      expectedAnonymousCells: 66,
      expectedLayoutCells: 9,
      expectedTotal: 75,
    },
    requestedRoutes: routes,
    requestedVsFinal,
    doNotCall: '33 authenticated pages passed',
    summary: {
      total: rows.length,
      pass: rows.filter((row) => row.status === 'PASS').length,
      fail: failed.length,
      failed: failed.map((row) => ({ requested: row.requestedRoute, kind: row.kind, theme: row.theme, failures: row.failures })),
    },
    authenticatedPagesObserved: authenticatedClaim.length,
    notRun: pins.not_run,
    prepare: { portHoldersThen: prepareReceipt.port18183 },
  }
  const resultPath = path.join(OUTPUT, 'run-receipt.json')
  await fsp.writeFile(resultPath, JSON.stringify({ ...result, rows }, null, 2))
  const ok = failed.length === 0 &&
    anonymousRows.length === 66 &&
    layoutRows.length === 9 &&
    result.treeUnchanged &&
    authenticatedClaim.length === 0 &&
    Date.now() - started <= BUDGET_MS
  result.status = ok ? 'PASS' : 'FAIL'
  await fsp.writeFile(resultPath, JSON.stringify({ ...result, rows }, null, 2))
  return { result, resultPath }
}

function printPrepare(payload) {
  const { receipt, receiptPath } = payload
  console.log(JSON.stringify({
    mode: 'prepare',
    ok: true,
    receipt: receiptPath,
    index_sha256: receipt.live.index_sha256,
    tree_fingerprint_sha256: receipt.live.tree_fingerprint_sha256,
    h5_realpath: receipt.live.h5_realpath,
    requestedRoutes: receipt.routes.requestedCount,
    pagesMdSetEqualsPagesJson: receipt.routes.pagesMdSetEqualsPagesJson,
    port18183Holders: receipt.port18183.holders,
    bind: false,
    browser: false,
    invocationRun: `OUTPUT=${OUTPUT} node ${path.join(OUTPUT, 'run-current-h5.mjs')} --run`,
  }, null, 2))
}

const wantRun = process.argv.includes('--run')
try {
  if (wantRun) {
    const { result, resultPath } = await run()
    console.log(JSON.stringify({
      mode: 'run',
      status: result.status,
      receipt: resultPath,
      elapsedMs: result.elapsedMs,
      matrix: result.matrix,
      summary: result.summary,
      nonstatic: result.counts.nonstatic,
      treeUnchanged: result.treeUnchanged,
      portAfterClose: result.ownership.portAfterClose,
    }, null, 2))
    process.exitCode = result.status === 'PASS' ? 0 : 1
  } else {
    printPrepare(await prepare())
  }
} catch (error) {
  const payload = {
    mode: wantRun ? 'run' : 'prepare',
    status: 'FAIL',
    error: String(error && error.message || error),
    code: error && error.code || null,
    holders: error && error.holders || undefined,
    mismatches: error && error.mismatches || undefined,
  }
  await fsp.mkdir(OUTPUT, { recursive: true }).catch(() => {})
  await fsp.writeFile(path.join(OUTPUT, wantRun ? 'run-receipt.json' : 'prepare-receipt.json'), JSON.stringify(payload, null, 2)).catch(() => {})
  console.error(JSON.stringify(payload, null, 2))
  process.exitCode = error && error.code === 'PORT_COLLISION' ? 3 : 1
}
