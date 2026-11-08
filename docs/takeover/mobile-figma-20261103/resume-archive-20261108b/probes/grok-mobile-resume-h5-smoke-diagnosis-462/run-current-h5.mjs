#!/usr/bin/env node
/**
 * G462 STRICT anonymous H5 smoke for the immutable G447 artifact.
 *
 * G456 live matrix: 75/75 FAIL, cleanup PASS. Preserve that FAIL. Do not edit
 * G456 receipts. This runner is a new candidate; Root runs one matrix later.
 *
 * G456 causes, from Playwright 1.63 types + frozen receipt:
 * 1) page.goto to the same URL with a different hash succeeds and returns null
 *    (types.d.ts Page.goto NOTE). G456 treated that null as missing
 *    nonce-nav-header (64/75). First document load in each context (11/75)
 *    had the nonce. Same-document hash transitions cannot invent a Response.
 * 2) in-page fetch HEAD / was classified as missing JS/CSS because
 *    requestfailed net::ERR_ABORTED matched isStaticRequest(HEAD, /). The
 *    Node static server HEAD implementation returned 200 + nonce (in-page
 *    nonce-in-page-head 75/75; staticMiss 0). Playwright page-network HEAD
 *    through route intercept is not the server HEAD implementation.
 *
 * G462: nonce + index/tree pins on actual document load; hash-router
 * transitions validated by finalRoute + visible UI and inherited document
 * nonce; HEAD proven on the static handler with a fake req/res (no listen);
 * missing JS/CSS only GET .js/.css failures; cannot ignore real document
 * missing nonce, server HEAD failure, or route-guard errors.
 *
 * Ownership remains G456: Playwright Browser.close(), OS descendant identity,
 * durable FAIL+cleanup on early exception. Not Puppeteer browser.process().
 *
 * Default: prepare/check only. --offline-fixtures: HTTP-free. --run: Root only.
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
function lineOf(text, index) {
  if (index < 0) return null
  return text.slice(0, index).split('\n').length
}
function playwrightTypeFacts() {
  try {
    const playwrightId = requireFromCheckout.resolve('playwright')
    const fromPlaywright = createRequire(playwrightId)
    const pkgPath = fromPlaywright.resolve('playwright-core/package.json')
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    const typesPath = path.join(path.dirname(pkgPath), 'types/types.d.ts')
    const text = fs.readFileSync(typesPath, 'utf8')
    const browserStart = text.indexOf('export interface Browser {')
    const workerStart = text.indexOf('\nexport interface Worker {')
    const serverStart = text.indexOf('export interface BrowserServer {')
    const clockStart = text.indexOf('export interface Clock {')
    const electronStart = text.indexOf('export interface ElectronApplication {')
    const browserSlice = text.slice(browserStart, workerStart)
    const serverSlice = text.slice(serverStart, clockStart)
    const electronSlice = text.slice(electronStart, serverStart > electronStart ? serverStart : electronStart + 20000)
    const methodRe = /^  ([A-Za-z_][A-Za-z0-9_]*)(?:<[^>]*>)?\(/gm
    const browserMethods = [...new Set([...browserSlice.matchAll(methodRe)].map((m) => m[1]))].sort()
    return {
      ok: true,
      playwrightCoreVersion: pkg.version,
      packageJson: pkgPath,
      typesPath,
      browserInterface: {
        startLine: lineOf(text, browserStart),
        endLine: lineOf(text, workerStart),
        declaresProcess: /(?:^|\n)\s+process\s*\(/.test(browserSlice),
        declaresClose: /(?:^|\n)\s+close\s*\(/.test(browserSlice),
        methods: browserMethods,
      },
      browserServer: {
        startLine: lineOf(text, serverStart),
        declaresProcessChildProcess: /process\(\):\s*ChildProcess/.test(serverSlice),
        processLine: lineOf(text, serverStart + serverSlice.indexOf('process(): ChildProcess')),
      },
      electronApplication: {
        startLine: lineOf(text, electronStart),
        declaresProcessChildProcess: /process\(\):\s*ChildProcess/.test(electronSlice),
        processLine: lineOf(text, electronStart + electronSlice.indexOf('process(): ChildProcess')),
      },
      launchReturnsBrowser: /chromium\.launch\(\)/.test(text) || browserStart >= 0,
      note: 'chromium.launch returns Browser. process() is on BrowserServer and ElectronApplication only.',
    }
  } catch (error) {
    return { ok: false, error: String(error && error.message || error).slice(0, 400) }
  }
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
function isJsCssPath(pathname) {
  return /\.(js|css)(\?|$)/i.test(String(pathname || ''))
}

/**
 * Playwright 1.63 Page.goto: navigation to the same URL with a different hash
 * succeeds and returns null. A null return is not a missing document nonce.
 * A same-document transition cannot invent a Response.
 */
export function classifyPlaywrightNavigation(response, priorDocument) {
  if (response) {
    const headers = typeof response.headers === 'function' ? response.headers() : (response.headers || {})
    const nonce = headers[NONCE_HEADER] || headers['X-G447-H5-Nonce'] || null
    return {
      kind: 'document-load',
      inventedResponse: false,
      responsePresent: true,
      nonce: nonce || null,
      status: typeof response.status === 'function' ? response.status() : response.status || null,
      url: typeof response.url === 'function' ? response.url() : response.url || null,
    }
  }
  if (priorDocument && priorDocument.verified && priorDocument.nonce) {
    return {
      kind: 'same-document-hash',
      inventedResponse: false,
      responsePresent: false,
      nonce: priorDocument.nonce,
      inheritedFrom: priorDocument.url || 'prior-document-load',
    }
  }
  return {
    kind: 'missing-document',
    inventedResponse: false,
    responsePresent: false,
    nonce: null,
    fail: true,
  }
}

export function g456WouldFailNonceNav(response) {
  const navNonce = response ? (typeof response.headers === 'function' ? response.headers()[NONCE_HEADER] : response.headers && response.headers[NONCE_HEADER]) : null
  return navNonce == null
}

export function classifyRequestFailed(url, method, reason) {
  const staticReq = isStaticRequest(url, method)
  const jsCss = method === 'GET' && isJsCssPath(url.pathname)
  const headProbe = method === 'HEAD' && (url.pathname === '/' || url.pathname === '/index.html')
  if (headProbe) {
    return { bucket: 'page-network-head-probe', missingJsCss: false, serverHeadFailure: false, reason }
  }
  if (jsCss && staticReq) {
    return { bucket: 'missing-js-css', missingJsCss: true, serverHeadFailure: false, reason }
  }
  if (staticReq) {
    return { bucket: 'static-aborted-non-js-css', missingJsCss: false, serverHeadFailure: false, reason }
  }
  return { bucket: 'nonstatic-aborted', missingJsCss: false, serverHeadFailure: false, reason }
}

export function invokeServeHandler(handler, { method, url, headers = {} } = {}) {
  const chunks = []
  const outHeaders = {}
  let statusCode = 200
  let ended = false
  const req = { method: method || 'GET', url: url || '/', headers }
  const res = {
    statusCode: 200,
    writeHead(code, headerMap) {
      statusCode = code
      this.statusCode = code
      if (headerMap) Object.assign(outHeaders, headerMap)
    },
    setHeader(key, value) { outHeaders[key] = value },
    write(buf) { if (buf != null) chunks.push(Buffer.from(buf)) },
    end(buf) {
      if (buf != null) chunks.push(Buffer.from(buf))
      ended = true
    },
    on() { return this },
    once() { return this },
    emit() { return false },
    pipe() { return this },
  }
  handler(req, res)
  return {
    statusCode: res.statusCode || statusCode,
    headers: outHeaders,
    body: Buffer.concat(chunks),
    ended,
  }
}

export function evaluateServerHead(handler, nonce) {
  const result = invokeServeHandler(handler, { method: 'HEAD', url: '/' })
  const got = result.headers[NONCE_HEADER] || result.headers['x-g447-h5-nonce'] || null
  const ok = result.statusCode === 200 && got === nonce && result.body.length === 0 && result.ended
  return {
    ok,
    statusCode: result.statusCode,
    nonce: got,
    bodyBytes: result.body.length,
    ended: result.ended,
    failure: ok ? null : (result.statusCode !== 200 ? 'head-status' : got !== nonce ? 'head-missing-or-wrong-nonce' : 'head-had-body-or-not-ended'),
  }
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

function normalizeStartTime(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function identityKey(row) {
  return `${Number(row.pid)}|${Number(row.ppid)}|${normalizeStartTime(row.startTime)}|${row.command}`
}

export function parsePsTable(text) {
  const rows = []
  for (const line of String(text || '').split('\n')) {
    if (!line.trim()) continue
    if (/^\s*PID\b/.test(line)) continue
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\w{3}\s+\w{3}\s+\d{1,2}\s+\d{1,2}:\d{2}:\d{2}\s+\d{4})\s+(.*)$/)
    if (!match) continue
    rows.push({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      startTime: normalizeStartTime(match[3]),
      command: match[4],
    })
  }
  return rows
}

export function isChromeCommand(command) {
  const value = String(command || '')
  if (/Google Chrome for Testing/i.test(value)) return true
  if (/Google Chrome Helper/i.test(value)) return true
  if (/Google Chrome\.app\/Contents\/MacOS\/Google Chrome/i.test(value)) return true
  if (/chrome-mac-arm64/i.test(value)) return true
  if (/Chromium(?:\.app)?/i.test(value) && !/node\s/i.test(value)) return true
  if (/(?:^|[\/ ])(?:chrome|chromium|headless_shell)(?:\s|$)/i.test(value) && !/node\s/i.test(value)) return true
  return false
}

export function descendantsOf(rows, rootPid) {
  const byParent = new Map()
  for (const row of rows || []) {
    const list = byParent.get(row.ppid) || []
    list.push(row)
    byParent.set(row.ppid, list)
  }
  const out = []
  const stack = [...(byParent.get(rootPid) || [])]
  const seen = new Set()
  while (stack.length) {
    const current = stack.pop()
    if (seen.has(current.pid)) continue
    seen.add(current.pid)
    out.push(current)
    stack.push(...(byParent.get(current.pid) || []))
  }
  return out
}

export function normalizeProcessTable(result) {
  if (!result) return { ok: false, rows: [], error: 'empty-process-table' }
  if (Array.isArray(result)) return { ok: true, rows: result, error: null }
  if (typeof result === 'object' && Array.isArray(result.rows)) {
    return { ok: result.ok !== false, rows: result.rows, error: result.error || null }
  }
  return { ok: false, rows: [], error: 'invalid-process-table' }
}

export function listProcessesViaPs() {
  const result = spawnSync('ps', ['-axo', 'pid=,ppid=,lstart=,command='], { encoding: 'utf8', timeout: 5000 })
  if (result.error || (result.status !== 0 && !(result.stdout || '').trim())) {
    return {
      ok: false,
      rows: [],
      error: String(result.error || result.stderr || `ps-status-${result.status}`).slice(0, 300),
    }
  }
  return { ok: true, rows: parsePsTable(result.stdout || ''), error: (result.stderr || '').trim() || null }
}

export function captureOwnChrome({ parentPid, beforeRows, afterRows }) {
  const beforeKeys = new Set((beforeRows || []).map(identityKey))
  const desc = descendantsOf(afterRows || [], parentPid)
  return desc
    .filter((row) => isChromeCommand(row.command) && !beforeKeys.has(identityKey(row)))
    .map((row) => ({
      pid: row.pid,
      ppid: row.ppid,
      startTime: normalizeStartTime(row.startTime),
      command: row.command,
      directChild: row.ppid === parentPid,
    }))
}

export function captureOwnChromeWithRetry({ parentPid, before, listProcessesFn, attempts = 5, delayMs = 0 }) {
  const beforeNorm = normalizeProcessTable(before)
  let last = beforeNorm
  let owned = []
  for (let i = 0; i < attempts; i += 1) {
    last = normalizeProcessTable(listProcessesFn())
    owned = captureOwnChrome({ parentPid, beforeRows: beforeNorm.rows, afterRows: last.rows })
    if (owned.length) {
      return {
        identityEstablished: true,
        ownedChrome: owned,
        after: last,
        attempts: i + 1,
        reason: null,
      }
    }
    if (delayMs) { /* fixtures use delayMs 0 */ }
  }
  if (!last.ok) {
    return {
      identityEstablished: false,
      ownedChrome: [],
      after: last,
      attempts,
      reason: 'process-table-unavailable',
    }
  }
  return {
    identityEstablished: false,
    ownedChrome: [],
    after: last,
    attempts,
    reason: 'no-chrome-descendants-of-own-node',
  }
}

export function revalidateIdentity(owned, currentRows) {
  const byPid = new Map((currentRows || []).map((row) => [row.pid, row]))
  return (owned || []).map((expected) => {
    const found = byPid.get(expected.pid)
    if (!found) return { expected, found: null, gone: true, exactMatch: false, reuse: false, mismatch: false }
    const same = identityKey(found) === identityKey(expected)
    return {
      expected,
      found,
      gone: false,
      exactMatch: same,
      reuse: !same,
      mismatch: !same,
    }
  })
}

export function probeG451ProcessPid(browser) {
  try {
    const pid = browser.process()?.pid || null
    return { threw: false, pid }
  } catch (error) {
    return {
      threw: true,
      name: error && error.name || 'Error',
      message: String(error && error.message || error).slice(0, 240),
    }
  }
}

export function inspectPlaywrightBrowserApi(browser, { probeG451 = false } = {}) {
  if (!browser || (typeof browser !== 'object' && typeof browser !== 'function')) {
    return { ok: false, error: 'no-browser-object' }
  }
  const typeofProcess = typeof browser.process
  const ownNames = Object.getOwnPropertyNames(browser).sort()
  const protoNames = []
  let proto = Object.getPrototypeOf(browser)
  let depth = 0
  while (proto && proto !== Object.prototype && depth < 8) {
    protoNames.push(...Object.getOwnPropertyNames(proto))
    proto = Object.getPrototypeOf(proto)
    depth += 1
  }
  return {
    ok: true,
    hasProcessMethod: typeofProcess === 'function',
    typeofProcess,
    ownNames,
    protoNames: [...new Set(protoNames)].sort(),
    close: typeof browser.close,
    isConnected: typeof browser.isConnected,
    newContext: typeof browser.newContext,
    g451BrowserProcessProbe: probeG451 ? probeG451ProcessPid(browser) : { skipped: true, note: 'live path does not call process()' },
    note: 'Playwright 1.63 Browser from chromium.launch() has no process(); ownership uses OS descendant snapshot',
  }
}

export function createFakePlaywrightBrowser(hooks = {}) {
  const browser = {
    _closed: false,
    isConnected() { return !this._closed },
    async close() {
      this._closed = true
      if (hooks.onClose) await hooks.onClose()
    },
    contexts() { return [] },
    version() { return 'fixture-no-process' },
    async newContext() {
      if (hooks.newContext) return hooks.newContext()
      return {
        async addInitScript() {},
        async route() {},
        async newPage() {
          return {
            async goto(url) {
              if (hooks.goto) return hooks.goto(url)
              const err = new Error('fixture-navigation-not-implemented')
              err.code = 'FIXTURE_NAV'
              throw err
            },
            on() {},
            off() {},
            async evaluate() { return {} },
            async addStyleTag() {},
            async screenshot() { return Buffer.from([]) },
            async waitForFunction() {},
            keyboard: { press: async () => {} },
          }
        },
        async close() {},
      }
    },
  }
  return browser
}

export function scriptedProcessList(snapshots) {
  let index = 0
  const calls = []
  const fn = () => {
    const snap = snapshots[Math.min(index, snapshots.length - 1)]
    index += 1
    const norm = normalizeProcessTable(snap)
    calls.push({ n: index, ok: norm.ok, rows: norm.rows.length })
    return norm
  }
  fn.calls = calls
  return fn
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
  await new Promise((resolve) => {
    try {
      server.close(() => resolve())
    } catch {
      resolve()
    }
  })
}

async function waitOursReleased(ourPids, timeoutMs, listenHoldersFn = listenHolders) {
  const started = Date.now()
  let holders = []
  while (Date.now() - started < timeoutMs) {
    holders = listenHoldersFn(PORT)
    const ours = holders.filter((row) => ourPids.includes(row.pid))
    if (ours.length === 0) {
      return { freeOfOurs: true, holders, elapsedMs: Date.now() - started }
    }
    await sleep(50)
  }
  return { freeOfOurs: false, holders, elapsedMs: Date.now() - started }
}

function defaultKill(pid, signal) {
  process.kill(pid, signal)
}

export async function cleanupOwnResources({
  browser,
  server,
  ownership,
  listProcessesFn,
  killFn = defaultKill,
  listenHoldersFn = listenHolders,
  closeServerFn = closeServer,
}) {
  const cleanup = {
    browserClose: { attempted: false, ok: false, error: null, connectedAfter: null },
    serverClose: { attempted: false, ok: false, error: null },
    signals: [],
    refusedSignals: [],
    leftoversAfterClose: [],
    identityEstablished: Boolean(ownership && ownership.identityEstablished),
    resourceUnreleased: false,
    resourceUnreleasedReasons: [],
    portAfterClose: null,
    passBecauseProcessMissing: false,
    failClosed: false,
    cleanupPassReason: null,
    ok: false,
  }
  const parentPid = ownership && ownership.parentPid
  const owned = (ownership && ownership.ownedChrome) || []

  if (browser) {
    cleanup.browserClose.attempted = true
    try {
      await browser.close({ reason: 'g462-cleanup' })
      cleanup.browserClose.ok = true
    } catch (error) {
      try { await browser.close() } catch (inner) {
        cleanup.browserClose.error = String(inner && inner.message || error && error.message || error).slice(0, 300)
      }
      if (!cleanup.browserClose.error) cleanup.browserClose.ok = true
    }
    try {
      cleanup.browserClose.connectedAfter = typeof browser.isConnected === 'function' ? browser.isConnected() : null
    } catch {
      cleanup.browserClose.connectedAfter = 'probe-failed'
    }
  }

  let current = { ok: false, rows: [], error: 'not-listed' }
  try { current = normalizeProcessTable(listProcessesFn()) } catch (error) {
    current = { ok: false, rows: [], error: String(error && error.message || error).slice(0, 200) }
  }

  if (browser && !cleanup.identityEstablished) {
    cleanup.resourceUnreleased = true
    cleanup.failClosed = true
    cleanup.resourceUnreleasedReasons.push(ownership && ownership.capture && ownership.capture.reason || 'chrome-os-identity-not-established')
    cleanup.refusedSignals.push({ reason: 'identity-not-established', sent: false })
  } else if (owned.length) {
    const reviewed = revalidateIdentity(owned, current.rows)
    cleanup.revalidation = reviewed.map((item) => ({
      pid: item.expected.pid,
      gone: item.gone,
      exactMatch: item.exactMatch,
      reuse: item.reuse,
      foundStartTime: item.found ? item.found.startTime : null,
      foundCommand: item.found ? item.found.command : null,
    }))
    for (const item of reviewed) {
      if (item.gone) continue
      if (item.reuse || item.mismatch) {
        cleanup.refusedSignals.push({
          pid: item.expected.pid,
          reason: 'pid-reuse-or-identity-mismatch',
          expected: item.expected,
          found: item.found,
          sent: false,
        })
        cleanup.resourceUnreleased = true
        cleanup.failClosed = true
        cleanup.resourceUnreleasedReasons.push('pid-reuse-or-identity-mismatch')
        continue
      }
      if (!item.exactMatch) continue
      cleanup.leftoversAfterClose.push(item.expected)
      if (item.found.pid === process.pid || item.found.pid === parentPid) {
        cleanup.refusedSignals.push({ pid: item.found.pid, reason: 'refuse-self', sent: false })
        continue
      }
      let fresh
      try { fresh = normalizeProcessTable(listProcessesFn()) } catch (error) {
        fresh = { ok: false, rows: [], error: String(error && error.message || error).slice(0, 200) }
      }
      const again = (fresh.rows || []).find((row) => row.pid === item.expected.pid)
      if (!again) {
        cleanup.refusedSignals.push({ pid: item.expected.pid, reason: 'gone-at-signal-time', sent: false })
        continue
      }
      if (identityKey(again) !== identityKey(item.expected)) {
        cleanup.refusedSignals.push({
          pid: item.expected.pid,
          reason: 'pid-reuse-at-signal-time',
          found: again,
          sent: false,
        })
        cleanup.resourceUnreleased = true
        cleanup.failClosed = true
        cleanup.resourceUnreleasedReasons.push('pid-reuse-at-signal-time')
        continue
      }
      try {
        killFn(again.pid, 'SIGTERM')
        cleanup.signals.push({
          pid: again.pid,
          signal: 'SIGTERM',
          identity: item.expected,
          reason: 'leftover-after-browser-close-exact-revalidated',
          sent: true,
        })
      } catch (error) {
        cleanup.signals.push({
          pid: again.pid,
          sent: false,
          error: String(error && error.message || error).slice(0, 200),
        })
        cleanup.resourceUnreleased = true
        cleanup.failClosed = true
        cleanup.resourceUnreleasedReasons.push('signal-failed')
      }
    }
    let afterSignal
    try { afterSignal = normalizeProcessTable(listProcessesFn()) } catch {
      afterSignal = { ok: false, rows: [] }
    }
    const still = revalidateIdentity(owned, afterSignal.rows || []).filter((item) => item.exactMatch)
    if (still.length) {
      cleanup.resourceUnreleased = true
      cleanup.failClosed = true
      cleanup.resourceUnreleasedReasons.push('owned-chrome-still-alive-after-sigterm-no-sigkill')
      cleanup.stillAliveAfterSignal = still.map((item) => item.expected)
    }
  }

  if (server) {
    cleanup.serverClose.attempted = true
    try {
      await closeServerFn(server)
      cleanup.serverClose.ok = true
    } catch (error) {
      cleanup.serverClose.error = String(error && error.message || error).slice(0, 300)
    }
  }

  const ourPids = [parentPid, ownership && ownership.serverPid].filter(Boolean)
  cleanup.portAfterClose = await waitOursReleased(ourPids, 4000, listenHoldersFn)

  if (cleanup.browserClose.connectedAfter === true) {
    cleanup.resourceUnreleased = true
    cleanup.failClosed = true
    cleanup.resourceUnreleasedReasons.push('browser-still-connected-after-close')
  }

  cleanup.passBecauseProcessMissing = false
  const browserOk = !browser || cleanup.browserClose.ok
  const serverOk = !server || cleanup.serverClose.ok
  const portOk = cleanup.portAfterClose && cleanup.portAfterClose.freeOfOurs !== false
  cleanup.ok = browserOk && serverOk && portOk && !cleanup.resourceUnreleased && !cleanup.failClosed
  if (cleanup.ok) {
    if (owned.length) cleanup.cleanupPassReason = 'owned-chrome-gone-after-browser-close-and-optional-exact-sigterm'
    else if (browser) cleanup.cleanupPassReason = 'browser-closed-identity-established-empty-owned-set'
    else cleanup.cleanupPassReason = 'no-browser-launched'
  } else {
    cleanup.cleanupPassReason = null
  }
  if (ownership) ownership.signals = cleanup.signals
  return cleanup
}

async function writeJson(file, payload) {
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await fsp.writeFile(file, JSON.stringify(payload, null, 2))
}

async function emitDurableReceipts(outputDir, payload) {
  const runPath = path.join(outputDir, 'run-receipt.json')
  const cleanPath = path.join(outputDir, 'cleanup-receipt.json')
  const cleanupPayload = {
    at: payload.at,
    status: payload.status,
    failedStage: payload.failedStage,
    error: payload.error || null,
    code: payload.code || null,
    cleanup: payload.cleanup,
    identityEstablished: payload.ownership && payload.ownership.identityEstablished,
    playwrightProcessMethodUsed: payload.ownership && payload.ownership.playwrightProcessMethodUsed,
    passBecauseProcessMissing: payload.cleanup && payload.cleanup.passBecauseProcessMissing,
  }
  try {
    await writeJson(runPath, payload)
  } catch (error) {
    await writeJson(runPath, {
      mode: payload.mode,
      status: 'FAIL',
      failedStage: payload.failedStage,
      error: 'run-receipt-serialize',
      serializeError: String(error && error.message || error).slice(0, 300),
      originalError: payload.error || null,
    })
  }
  await writeJson(cleanPath, cleanupPayload)
  return { runPath, cleanPath }
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

async function waitBoot(page, route, timeoutMs) {
  const expected = expectedLanding(route)
  const selector = landingSelector(expected)
  await page.waitForFunction((sel) => {
    const app = document.querySelector('#app')
    if (!app || app.childElementCount === 0) return false
    return Boolean(document.querySelector(sel))
  }, selector, { timeout: timeoutMs }).catch(() => {})
}

async function screenshotPublic(page, name, outputDir) {
  await page.evaluate(() => {
    document.querySelectorAll('input, textarea').forEach((el) => {
      el.value = ''
      el.removeAttribute('value')
    })
  })
  const file = path.join(outputDir, 'shots', `${name}.png`)
  await fsp.mkdir(path.dirname(file), { recursive: true })
  await page.screenshot({ path: file, fullPage: false })
  return file
}

function shotName(route, extra) {
  return `${route.replaceAll('/', '-')}${extra}`
}

async function exerciseRoute(page, box, route, theme, viewport, nonce, opts = {}) {
  const documentState = opts.documentState || { verified: false, nonce: null, url: null }
  const pins = opts.pins || null
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
    missingJsCss: [],
    pageHeadProbesAborted: [],
    staticAbortedOther: [],
    screenshot: null,
    requested: route,
    finalRoute: null,
    navigationKind: null,
    inventedResponse: false,
    playwrightResponsePresent: null,
  }
  const onError = (error) => row.pageErrors.push(String(error && error.message || error).slice(0, 400))
  const onFailed = (request) => {
    let url
    try { url = new URL(request.url()) } catch { return }
    const classified = classifyRequestFailed(url, request.method(), request.failure()?.errorText || 'failed')
    const sample = { method: request.method(), path: url.pathname, reason: classified.reason, bucket: classified.bucket }
    if (classified.bucket === 'missing-js-css') row.missingJsCss.push(sample)
    else if (classified.bucket === 'page-network-head-probe') row.pageHeadProbesAborted.push(sample)
    else if (classified.bucket === 'static-aborted-non-js-css') row.staticAbortedOther.push(sample)
  }
  page.on('pageerror', onError)
  page.on('requestfailed', onFailed)
  box.row = row
  try {
    const target = `http://${HOST}:${PORT}/#/${route}?theme=${theme}&uiLocale=zh-CN`
    const response = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const classified = classifyPlaywrightNavigation(response, documentState)
    row.navigationKind = classified.kind
    row.inventedResponse = classified.inventedResponse
    row.playwrightResponsePresent = classified.responsePresent
    row.g456WouldFailNonceNav = g456WouldFailNonceNav(response)
    if (classified.kind === 'document-load') {
      if (classified.nonce === nonce) passRow(row, 'document-nonce', classified.nonce)
      else failRow(row, 'document-nonce', nonce, classified.nonce)
      documentState.verified = classified.nonce === nonce
      documentState.nonce = classified.nonce
      documentState.url = classified.url
      if (pins) {
        const liveIndex = sha256File(path.join(pins.h5_realpath, 'index.html'))
        if (liveIndex === pins.index_sha256) passRow(row, 'document-index-fingerprint', liveIndex)
        else failRow(row, 'document-index-fingerprint', pins.index_sha256, liveIndex)
        if (opts.treeFingerprint === pins.tree_fingerprint_sha256) passRow(row, 'document-tree-fingerprint', opts.treeFingerprint)
        else failRow(row, 'document-tree-fingerprint', pins.tree_fingerprint_sha256, opts.treeFingerprint)
      }
    } else if (classified.kind === 'same-document-hash') {
      passRow(row, 'same-document-hash-null-response', { inventedResponse: false, inheritedFrom: classified.inheritedFrom })
      if (classified.nonce === nonce) passRow(row, 'inherited-document-nonce', classified.nonce)
      else failRow(row, 'inherited-document-nonce', nonce, classified.nonce)
    } else {
      failRow(row, 'document-load-required', 'document response or prior verified document', classified.kind)
    }
    await waitBoot(page, route, 8000)
    if (opts.fontScale === 2) {
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
    }
    const facts = await pageFacts(page)
    if (classified.kind === 'document-load' && pins && pins.index_js) {
      const hasEntry = (facts.scripts || []).some((src) => src && String(src).includes(String(pins.index_js).replace(/^\//, '')))
      if (hasEntry) passRow(row, 'document-index-js-pin', pins.index_js)
      else failRow(row, 'document-index-js-pin', pins.index_js, (facts.scripts || []).slice(0, 6))
    }
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
    if (!PUBLIC.has(route) && row.finalRoute === 'pages/login/login') {
      passRow(row, 'protected-anonymous-redirect-not-authenticated-pass', row.finalRoute)
    }
    if (facts.appBlank) failRow(row, 'nonblank-#app', 'children or text', facts.appText)
    else passRow(row, 'nonblank-#app', { children: facts.appChildren, textLen: facts.appText.length })
    if (row.pageErrors.length) failRow(row, 'no-uncaught-js', [], row.pageErrors)
    else passRow(row, 'no-uncaught-js', [])
    const rejections = await page.evaluate(() => Array.isArray(window.__yxSmokeRejections) ? window.__yxSmokeRejections.slice(0, 8) : [])
    row.rejections = rejections
    if (rejections.length) failRow(row, 'no-unhandled-rejection', [], rejections)
    else passRow(row, 'no-unhandled-rejection', [])
    if (row.missingJsCss.length) failRow(row, 'no-missing-js-css', [], row.missingJsCss)
    else passRow(row, 'no-missing-js-css', [])
    if (row.pageHeadProbesAborted.length) {
      passRow(row, 'page-head-err-aborted-not-server-head-failure', row.pageHeadProbesAborted.length)
    }
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
      row.screenshot = await screenshotPublic(page, shotName(route, opts.shotSuffix || ''), opts.outputDir || OUTPUT)
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

async function runMatrix({ browser, routes, nonce, counts, budget, outputDir, pins, treeFingerprint }) {
  const rows = []
  const routeOpts = { outputDir, pins, treeFingerprint }
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
    const documentState = { verified: false, nonce: null, url: null }
    for (const route of routes) {
      budget()
      rows.push(await exerciseRoute(page, box, route, theme, PHONE, nonce, {
        screenshot: theme === 'light' && LAYOUT_PAGES.includes(route),
        shotSuffix: `__${theme}-390`,
        documentState,
        ...routeOpts,
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
        documentState: { verified: false, nonce: null, url: null },
        ...routeOpts,
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
      documentState: { verified: false, nonce: null, url: null },
      ...routeOpts,
    }))
    await context.close()
  }
  return rows
}

export async function prepare(opts = {}) {
  const out = opts.outputDir || OUTPUT
  await fsp.mkdir(out, { recursive: true })
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
  const typeFacts = playwrightTypeFacts()
  const receipt = {
    mode: 'prepare',
    at: new Date().toISOString(),
    node: process.version,
    pid: process.pid,
    output: out,
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
    playwrightTypeFacts: typeFacts,
    ownershipPolicy: pins.ownership_policy,
    g451Defect: pins.g451_defect,
    port18183: { policy: 'do-not-bind-in-prepare', holders: listenHolders(PORT) },
    matrixDenominator: pins.matrix.denominator,
    notRun: pins.not_run.concat(['--run-browser-smoke']),
    bind: false,
    browser: false,
  }
  const receiptPath = path.join(out, 'prepare-receipt.json')
  if (opts.writeReceipt !== false) await writeJson(receiptPath, receipt)
  return { pins, routes, receipt, receiptPath }
}

export async function run(options = {}) {
  const started = Date.now()
  const outputDir = options.outputDir || OUTPUT
  const parentPid = options.parentPid || process.pid
  const listProcessesFn = options.listProcessesFn || listProcessesViaPs
  const killFn = options.killFn || defaultKill
  const listenHoldersFn = options.listenHoldersFn || listenHolders
  const listenFn = options.listenFn || listenExclusive
  const launchFn = options.launchFn || ((chromium) => launchChrome(chromium))
  const closeServerFn = options.closeServerFn || closeServer
  const skipBind = Boolean(options.skipBind)
  const skipPinsAfter = Boolean(options.skipPinsAfter)
  const successWithoutMatrix = Boolean(options.successWithoutMatrix)
  const probeG451 = Boolean(options.probeG451)
  let failedStage = 'init'
  let thrown = null
  let status = 'FAIL'
  let server
  let browser
  let launchMeta
  let pins
  let routes
  let prepareReceipt
  let before
  let after
  let cleanup
  let durable
  const nonce = crypto.randomBytes(16).toString('hex')
  const counts = { static: 0, staticMiss: 0, nonstatic: 0, nonstaticByKind: { server: 0, playwright: 0, badUrl: 0 }, nonstaticSamples: [] }
  const rows = []
  const ownership = {
    parentPid,
    serverPid: parentPid,
    identityEstablished: false,
    ownedChrome: [],
    capture: null,
    playwrightBrowserApi: null,
    playwrightProcessMethodUsed: false,
    browserPidFromPlaywrightProcess: null,
    signals: [],
  }
  const budget = () => {
    if (Date.now() - started > BUDGET_MS) {
      const err = new Error('RUNTIME_BUDGET')
      err.code = 'RUNTIME_BUDGET'
      throw err
    }
  }

  const buildPayload = () => {
    const anonymousRows = rows.filter((row) => row.kind === 'anonymous-phone')
    const layoutRows = rows.filter((row) => row.kind && row.kind !== 'anonymous-phone')
    const requestedVsFinal = anonymousRows.map((row) => ({
      requested: row.requestedRoute,
      theme: row.theme,
      final: row.finalRoute,
      expected: expectedLanding(row.requestedRoute),
      status: row.status,
    }))
    const failed = rows.filter((row) => row.status !== 'PASS')
    const skippedPass = rows.some((row) => row.checks && row.checks.some((c) => c.skipped && c.ok))
    if (skippedPass) failed.push({ requestedRoute: '*', status: 'FAIL', failures: [{ name: 'skipped-as-pass' }] })
    const authenticatedClaim = anonymousRows.filter((row) => !PUBLIC.has(row.requestedRoute) && row.finalRoute && row.finalRoute !== 'pages/login/login')
    return {
      mode: options.fixtureName ? `fixture:${options.fixtureName}` : 'run',
      at: new Date().toISOString(),
      elapsedMs: Date.now() - started,
      budgetMs: BUDGET_MS,
      status,
      failedStage,
      error: thrown ? String(thrown && thrown.message || thrown) : null,
      code: thrown && thrown.code || null,
      nonceHeader: NONCE_HEADER,
      noncePresent: Boolean(nonce),
      launch: launchMeta || null,
      ownership,
      cleanup,
      before: before || null,
      after: after || null,
      treeUnchanged: Boolean(before && after && before.tree_fingerprint_sha256 === after.tree_fingerprint_sha256 && before.index_sha256 === after.index_sha256),
      counts: {
        static: counts.static,
        staticMiss: counts.staticMiss,
        nonstatic: counts.nonstatic,
        nonstaticByKind: counts.nonstaticByKind,
        nonstaticSamples: counts.nonstaticSamples.slice(0, 40),
      },
      matrix: {
        denominator: pins && pins.matrix ? pins.matrix.denominator : null,
        anonymousCells: anonymousRows.length,
        layoutCells: layoutRows.length,
        totalNavigations: rows.length,
        expectedAnonymousCells: 66,
        expectedLayoutCells: 9,
        expectedTotal: 75,
      },
      requestedRoutes: routes || null,
      requestedVsFinal,
      doNotCall: '33 authenticated pages passed',
      summary: {
        total: rows.length,
        pass: rows.filter((row) => row.status === 'PASS').length,
        fail: failed.length,
        failed: failed.map((row) => ({ requested: row.requestedRoute, kind: row.kind, theme: row.theme, failures: row.failures })),
      },
      authenticatedPagesObserved: authenticatedClaim.length,
      notRun: pins && pins.not_run || [],
      skipBind,
      bind: Boolean(server) && !skipBind,
      passBecauseProcessMissing: cleanup && cleanup.passBecauseProcessMissing,
    }
  }

  try {
    failedStage = 'prepare'
    await fsp.mkdir(outputDir, { recursive: true })
    if (options.skipPrepare) {
      pins = options.pins || readPins()
      routes = options.routes || loadRequestedRoutes(pins)
      prepareReceipt = null
    } else {
      const prepared = await prepare({ outputDir, writeReceipt: options.writePrepareReceipt !== false && outputDir === OUTPUT })
      pins = prepared.pins
      routes = prepared.routes
      prepareReceipt = prepared.receipt
    }

    failedStage = 'pin-verify-before'
    before = options.skipPinVerify ? snapshotH5(pins.h5_root) : verifyPins(pins)

    failedStage = 'resolve-playwright'
    const chromium = options.chromium || (options.launchFn ? null : resolvePlaywright().chromium)

    failedStage = 'server-head-self-check'
    const handler = options.serveHandler || serveHandler(before.h5_realpath, nonce, counts)
    const headCheck = options.skipHeadCheck ? { skipped: true, ok: true } : evaluateServerHead(handler, nonce)
    ownership.serverHead = headCheck
    if (!headCheck.ok) {
      const err = new Error('SERVER_HEAD_FAILURE')
      err.code = 'SERVER_HEAD_FAILURE'
      err.headCheck = headCheck
      throw err
    }

    failedStage = 'listen'
    if (skipBind) {
      server = options.fakeServer || { close(cb) { if (cb) cb() }, address: () => ({ address: HOST, port: PORT, skipped: true }) }
      ownership.serverAddress = { skippedBind: true, host: HOST, port: PORT }
    } else {
      server = await listenFn(handler)
      ownership.serverAddress = server.address()
    }

    failedStage = 'snapshot-before-launch'
    const beforeProcs = normalizeProcessTable(listProcessesFn())
    ownership.beforeProcessTableOk = beforeProcs.ok

    failedStage = 'launch-chrome'
    const launched = await launchFn(chromium)
    browser = launched.browser
    launchMeta = launched.launch || { fixture: Boolean(options.fixtureName) }

    failedStage = 'inspect-browser-api'
    ownership.playwrightBrowserApi = inspectPlaywrightBrowserApi(browser, { probeG451 })
    if (ownership.playwrightBrowserApi.hasProcessMethod) ownership.ignoredProcessMethod = true

    failedStage = 'capture-own-chrome'
    const captured = captureOwnChromeWithRetry({
      parentPid,
      before: beforeProcs,
      listProcessesFn,
      attempts: options.captureAttempts || 5,
      delayMs: 0,
    })
    ownership.identityEstablished = captured.identityEstablished
    ownership.ownedChrome = captured.ownedChrome
    ownership.capture = {
      attempts: captured.attempts,
      reason: captured.reason,
      afterOk: captured.after && captured.after.ok,
    }
    ownership.playwrightProcessMethodUsed = false
    ownership.browserPidFromPlaywrightProcess = null

    failedStage = 'navigation'
    if (typeof options.beforeMatrix === 'function') {
      await options.beforeMatrix({ browser, ownership })
    }

    failedStage = 'matrix-anonymous'
    if (typeof options.exerciseFn === 'function') {
      const produced = await options.exerciseFn({ browser, nonce, routes, pins, counts, rows })
      if (Array.isArray(produced)) rows.push(...produced)
    } else {
      const produced = await runMatrix({
        browser,
        routes,
        nonce,
        counts,
        budget,
        outputDir,
        pins,
        treeFingerprint: before.tree_fingerprint_sha256,
      })
      rows.push(...produced)
    }

    failedStage = 'pin-verify-after'
    after = skipPinsAfter ? before : verifyPins(pins)

    const payloadPreview = {
      rows,
    }
    const anonymousRows = rows.filter((row) => row.kind === 'anonymous-phone')
    const layoutRows = rows.filter((row) => row.kind && row.kind !== 'anonymous-phone')
    const failed = rows.filter((row) => row.status !== 'PASS')
    const authenticatedClaim = anonymousRows.filter((row) => !PUBLIC.has(row.requestedRoute) && row.finalRoute && row.finalRoute !== 'pages/login/login')
    const matrixOk = successWithoutMatrix || (
      failed.length === 0 &&
      anonymousRows.length === 66 &&
      layoutRows.length === 9 &&
      authenticatedClaim.length === 0 &&
      Date.now() - started <= BUDGET_MS &&
      Boolean(after && before && after.tree_fingerprint_sha256 === before.tree_fingerprint_sha256)
    )
    status = matrixOk ? 'PASS' : 'FAIL'
    failedStage = 'complete'
    void payloadPreview
    void prepareReceipt
  } catch (error) {
    thrown = error
    status = 'FAIL'
  } finally {
    try {
      cleanup = await cleanupOwnResources({
        browser,
        server,
        ownership,
        listProcessesFn,
        killFn,
        listenHoldersFn,
        closeServerFn,
      })
      ownership.cleanup = {
        ok: cleanup.ok,
        failClosed: cleanup.failClosed,
        resourceUnreleased: cleanup.resourceUnreleased,
        reasons: cleanup.resourceUnreleasedReasons,
      }
      if (cleanup.resourceUnreleased || cleanup.ok === false) {
        status = 'FAIL'
        if (failedStage === 'complete') failedStage = 'cleanup-fail-closed'
      }
    } catch (cleanupError) {
      status = 'FAIL'
      cleanup = {
        ok: false,
        failClosed: true,
        error: String(cleanupError && cleanupError.message || cleanupError).slice(0, 400),
        passBecauseProcessMissing: false,
        resourceUnreleased: true,
        resourceUnreleasedReasons: ['cleanup-threw'],
      }
      if (!thrown) thrown = cleanupError
    }
    const payload = buildPayload()
    if (options.includeRows) payload.rows = rows
    else if (!options.fixtureName) payload.rows = rows
    try {
      durable = await emitDurableReceipts(outputDir, payload)
    } catch (emitError) {
      try {
        durable = await emitDurableReceipts(outputDir, {
          mode: 'run',
          status: 'FAIL',
          failedStage,
          error: payload.error,
          emitError: String(emitError && emitError.message || emitError).slice(0, 300),
          cleanup,
        })
      } catch {
        durable = { runPath: null, cleanPath: null }
      }
    }
  }

  const result = buildPayload()
  result.receipts = durable
  if (!options.fixtureName) result.rows = rows
  return { result, resultPath: durable && durable.runPath, cleanupReceiptPath: durable && durable.cleanPath, thrown }
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
    playwrightTypeFacts: receipt.playwrightTypeFacts && receipt.playwrightTypeFacts.ok
      ? {
        ok: true,
        version: receipt.playwrightTypeFacts.playwrightCoreVersion,
        browserDeclaresProcess: receipt.playwrightTypeFacts.browserInterface.declaresProcess,
        browserMethods: receipt.playwrightTypeFacts.browserInterface.methods,
        browserServerDeclaresProcess: receipt.playwrightTypeFacts.browserServer.declaresProcessChildProcess,
        electronDeclaresProcess: receipt.playwrightTypeFacts.electronApplication.declaresProcessChildProcess,
      }
      : receipt.playwrightTypeFacts,
    port18183Holders: receipt.port18183.holders,
    bind: false,
    browser: false,
    invocationRun: `OUTPUT=${OUTPUT} node ${path.join(OUTPUT, 'run-current-h5.mjs')} --run`,
    invocationFixtures: `OUTPUT=${OUTPUT} node ${path.join(OUTPUT, 'run-current-h5.mjs')} --offline-fixtures`,
  }, null, 2))
}

function chromeRow({ pid, ppid, startTime, command }) {
  return { pid, ppid, startTime, command }
}

function nodeRow(pid, startTime) {
  return { pid, ppid: 1, startTime, command: `node ${path.join(OUTPUT, 'run-current-h5.mjs')} --offline-fixtures` }
}

function assert(condition, name, detail) {
  return { name, ok: Boolean(condition), detail: detail || null }
}

export async function runOfflineFixtures() {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
  const parentPid = 1000
  const chromePid = 4242
  const t1 = 'Sat Nov 8 01:10:00 2026'
  const t2 = 'Sat Nov 8 01:12:00 2026'
  const chromeCmd = '/Users/Admin/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing --headless=new --disable-gpu'
  const pins = readPins()
  const routes = loadRequestedRoutes(pins)
  const common = {
    skipPrepare: true,
    skipPinVerify: false,
    skipPinsAfter: true,
    skipBind: true,
    successWithoutMatrix: true,
    writePrepareReceipt: false,
    pins,
    routes,
    parentPid,
    probeG451: true,
    captureAttempts: 1,
    listenHoldersFn: () => [],
    chromium: null,
  }

  const fakeA = createFakePlaywrightBrowser()
  const killsA = []
  const listA = scriptedProcessList([
    { ok: true, rows: [nodeRow(parentPid, t1)] },
    { ok: true, rows: [nodeRow(parentPid, t1), chromeRow({ pid: chromePid, ppid: parentPid, startTime: t1, command: chromeCmd })] },
    { ok: true, rows: [nodeRow(parentPid, t1)] },
  ])
  const aDir = path.join(OUTPUT, 'offline-fixtures', 'fake-browser-no-process')
  const a = await run({
    ...common,
    fixtureName: 'fake-browser-no-process',
    outputDir: aDir,
    launchFn: async () => ({ browser: fakeA, launch: { fixture: 'fake-browser-no-process' } }),
    listProcessesFn: listA,
    killFn: (pid, signal) => { killsA.push({ pid, signal }) },
    exerciseFn: async () => [],
  })

  const fakeB = createFakePlaywrightBrowser()
  const killsB = []
  const reused = chromeRow({ pid: chromePid, ppid: 1, startTime: t2, command: '/usr/sbin/unrelated-after-reuse --not-chrome' })
  const listB = scriptedProcessList([
    { ok: true, rows: [nodeRow(parentPid, t1)] },
    { ok: true, rows: [nodeRow(parentPid, t1), chromeRow({ pid: chromePid, ppid: parentPid, startTime: t1, command: chromeCmd })] },
    { ok: true, rows: [nodeRow(parentPid, t1), reused] },
    { ok: true, rows: [nodeRow(parentPid, t1), reused] },
    { ok: true, rows: [nodeRow(parentPid, t1), reused] },
  ])
  const bDir = path.join(OUTPUT, 'offline-fixtures', 'pid-reuse-mismatch')
  const b = await run({
    ...common,
    fixtureName: 'pid-reuse-mismatch',
    outputDir: bDir,
    launchFn: async () => ({ browser: fakeB, launch: { fixture: 'pid-reuse-mismatch' } }),
    listProcessesFn: listB,
    killFn: (pid, signal) => { killsB.push({ pid, signal }) },
    exerciseFn: async () => [],
  })

  const fakeC = createFakePlaywrightBrowser()
  const killsC = []
  const listC = scriptedProcessList([
    { ok: true, rows: [nodeRow(parentPid, t1)] },
    { ok: true, rows: [nodeRow(parentPid, t1), chromeRow({ pid: chromePid, ppid: parentPid, startTime: t1, command: chromeCmd })] },
    { ok: true, rows: [nodeRow(parentPid, t1)] },
  ])
  const cDir = path.join(OUTPUT, 'offline-fixtures', 'thrown-navigation')
  const c = await run({
    ...common,
    fixtureName: 'thrown-navigation',
    outputDir: cDir,
    launchFn: async () => ({ browser: fakeC, launch: { fixture: 'thrown-navigation' } }),
    listProcessesFn: listC,
    killFn: (pid, signal) => { killsC.push({ pid, signal }) },
    beforeMatrix: async () => {
      const err = new Error('NAVIGATION_THROWN_BEFORE_MATRIX')
      err.code = 'NAVIGATION_THROWN_BEFORE_MATRIX'
      throw err
    },
  })

  const checks = {
    sourceForbidsG451Ownership: assert(!/(?:^|\n)\s*ownership\.browserPid\s*=\s*browser\.process/.test(source), 'source-forbids-g451-ownership-assignment'),
    fakeBrowserHasNoProcess: assert(!('process' in fakeA) && typeof fakeA.process !== 'function', 'fake-browser-has-no-process'),
    aProbeThrows: assert(a.result.ownership.playwrightBrowserApi.g451BrowserProcessProbe.threw === true, 'a-g451-expression-throws', a.result.ownership.playwrightBrowserApi.g451BrowserProcessProbe),
    aNoProcessMethod: assert(a.result.ownership.playwrightBrowserApi.hasProcessMethod === false, 'a-hasProcessMethod-false'),
    aDidNotUseProcess: assert(a.result.ownership.playwrightProcessMethodUsed === false, 'a-playwrightProcessMethodUsed-false'),
    aIdentity: assert(a.result.ownership.identityEstablished === true && a.result.ownership.ownedChrome.length === 1 && a.result.ownership.ownedChrome[0].pid === chromePid, 'a-captured-own-chrome', a.result.ownership.ownedChrome),
    aCleanupOk: assert(a.result.cleanup.ok === true, 'a-cleanup-ok', a.result.cleanup),
    aNotFakePass: assert(a.result.cleanup.passBecauseProcessMissing === false, 'a-not-pass-because-missing-process'),
    aNoKill: assert(killsA.length === 0, 'a-no-signal-when-chrome-gone', killsA),
    aDurable: assert(fs.existsSync(path.join(aDir, 'run-receipt.json')) && fs.existsSync(path.join(aDir, 'cleanup-receipt.json')), 'a-durable-receipts'),
    aStatusPass: assert(a.result.status === 'PASS', 'a-status-pass', a.result.status),
    bStatusFail: assert(b.result.status === 'FAIL', 'b-status-fail', b.result.status),
    bReuseRefused: assert((b.result.cleanup.refusedSignals || []).some((row) => row.reason === 'pid-reuse-or-identity-mismatch'), 'b-refused-pid-reuse', b.result.cleanup.refusedSignals),
    bNoKill: assert(killsB.length === 0, 'b-never-kill-reused-pid', killsB),
    bFailClosed: assert(b.result.cleanup.failClosed === true && b.result.cleanup.resourceUnreleased === true, 'b-fail-closed-unreleased', b.result.cleanup),
    bNotFakePass: assert(b.result.cleanup.passBecauseProcessMissing === false, 'b-not-pass-because-missing-process'),
    bDurable: assert(fs.existsSync(path.join(bDir, 'run-receipt.json')) && fs.existsSync(path.join(bDir, 'cleanup-receipt.json')), 'b-durable-receipts'),
    cStatusFail: assert(c.result.status === 'FAIL', 'c-status-fail', c.result.status),
    cStage: assert(c.result.failedStage === 'navigation', 'c-failed-stage-navigation', c.result.failedStage),
    cError: assert(c.result.code === 'NAVIGATION_THROWN_BEFORE_MATRIX', 'c-error-code', c.result.error),
    cCleanupPresent: assert(Boolean(c.result.cleanup) && c.result.cleanup.browserClose && c.result.cleanup.browserClose.attempted === true, 'c-cleanup-attempted', c.result.cleanup),
    cCleanupOk: assert(c.result.cleanup.ok === true, 'c-cleanup-ok-after-throw', c.result.cleanup),
    cDurableFail: assert(JSON.parse(fs.readFileSync(path.join(cDir, 'run-receipt.json'), 'utf8')).status === 'FAIL', 'c-durable-run-fail'),
    cDurableCleanup: assert(JSON.parse(fs.readFileSync(path.join(cDir, 'cleanup-receipt.json'), 'utf8')).failedStage === 'navigation', 'c-durable-cleanup-stage'),
    cClosedBrowser: assert(fakeC.isConnected() === false, 'c-browser-closed'),
    noBind: assert(a.result.skipBind && b.result.skipBind && c.result.skipBind, 'fixtures-skip-bind'),
    sourceForbidsInPageHeadProbe: assert(!/fetch\('\/', \{ method: 'HEAD'/.test(source) && !/passRow\(row, 'nonce-in-page-head'/.test(source) && !/failRow\(row, 'nonce-nav-header'/.test(source), 'source-forbids-g456-in-page-head-and-null-goto-nonce-assert'),
    sourceHasHeadBranch: assert(/if \(method === 'HEAD'\) \{\s*res\.writeHead\(200, headers\)\s*res\.end\(\)\s*return/.test(source), 'source-static-server-head-empty-body'),
  }

  const nonce = 'fixture-nonce-g462-aaaaaaaaaaaaaaaa'
  const liveHandler = serveHandler(pins.h5_realpath, nonce, { static: 0, staticMiss: 0, nonstatic: 0, nonstaticByKind: { server: 0, playwright: 0, badUrl: 0 }, nonstaticSamples: [] })
  const serverHead = evaluateServerHead(liveHandler, nonce)
  const headPost = invokeServeHandler(liveHandler, { method: 'POST', url: '/' })
  const prior = { verified: true, nonce, url: 'http://127.0.0.1:18183/' }
  const hashNav = classifyPlaywrightNavigation(null, prior)
  const firstDoc = classifyPlaywrightNavigation({
    headers: () => ({ [NONCE_HEADER]: nonce }),
    status: () => 200,
    url: () => 'http://127.0.0.1:18183/',
  }, { verified: false, nonce: null })
  const missingDocNonce = classifyPlaywrightNavigation({
    headers: () => ({ 'content-type': 'text/html' }),
    status: () => 200,
    url: () => 'http://127.0.0.1:18183/',
  }, { verified: false, nonce: null })
  const hashWithoutPrior = classifyPlaywrightNavigation(null, { verified: false, nonce: null })
  const headAbort = classifyRequestFailed(new URL('http://127.0.0.1:18183/'), 'HEAD', 'net::ERR_ABORTED')
  const jsAbort = classifyRequestFailed(new URL('http://127.0.0.1:18183/assets/index-J7t0zLiz.js'), 'GET', 'net::ERR_ABORTED')
  const apiAbort = classifyRequestFailed(new URL('https://127.0.0.1:18087/api/v1/auth/login'), 'POST', 'net::ERR_ABORTED')
  const svgAbort = classifyRequestFailed(new URL('http://127.0.0.1:18183/static/figma-profile-169-9356/imgGlow.svg'), 'GET', 'net::ERR_ABORTED')
  const headWithBody = evaluateServerHead((req, res) => {
    res.writeHead(200, { [NONCE_HEADER]: nonce })
    res.end('oops')
  }, nonce)
  const head405 = evaluateServerHead((req, res) => {
    res.writeHead(405, { allow: 'GET' })
    res.end()
  }, nonce)
  let wrongTree
  try {
    verifyPins({ ...pins, tree_fingerprint_sha256: '0'.repeat(64) })
    wrongTree = { threw: false }
  } catch (error) {
    wrongTree = { threw: true, message: String(error && error.message || error), mismatches: error.mismatches || null }
  }

  const scriptedChrome = () => scriptedProcessList([
    { ok: true, rows: [nodeRow(parentPid, t1)] },
    { ok: true, rows: [nodeRow(parentPid, t1), chromeRow({ pid: chromePid, ppid: parentPid, startTime: t1, command: chromeCmd })] },
    { ok: true, rows: [nodeRow(parentPid, t1)] },
  ])
  const noNonceHandler = () => (req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end()
  }
  const dDir = path.join(OUTPUT, 'offline-fixtures', 'document-missing-nonce')
  const d = await run({
    ...common,
    fixtureName: 'document-missing-nonce',
    outputDir: dDir,
    serveHandler: noNonceHandler(),
    launchFn: async () => ({ browser: createFakePlaywrightBrowser(), launch: { fixture: 'document-missing-nonce' } }),
    listProcessesFn: scriptedChrome(),
    killFn: () => {},
    exerciseFn: async () => [],
  })

  const eDir = path.join(OUTPUT, 'offline-fixtures', 'wrong-tree')
  const e = await run({
    ...common,
    fixtureName: 'wrong-tree',
    outputDir: eDir,
    pins: { ...pins, tree_fingerprint_sha256: '0'.repeat(64) },
    launchFn: async () => ({ browser: createFakePlaywrightBrowser(), launch: { fixture: 'wrong-tree' } }),
    listProcessesFn: scriptedChrome(),
    killFn: () => {},
    exerciseFn: async () => [],
  })

  const fDir = path.join(OUTPUT, 'offline-fixtures', 'route-guard-js-error')
  const f = await run({
    ...common,
    fixtureName: 'route-guard-js-error',
    outputDir: fDir,
    successWithoutMatrix: false,
    launchFn: async () => ({ browser: createFakePlaywrightBrowser(), launch: { fixture: 'route-guard-js-error' } }),
    listProcessesFn: scriptedChrome(),
    killFn: () => {},
    exerciseFn: async () => {
      const classified = classifyRequestFailed(new URL('http://127.0.0.1:18183/assets/index-J7t0zLiz.js'), 'GET', 'net::ERR_ABORTED')
      const row = {
        requestedRoute: 'pages/home/home',
        kind: 'anonymous-phone',
        theme: 'light',
        checks: [],
        failures: [],
        missingJsCss: classified.missingJsCss ? [{ method: 'GET', path: '/assets/index-J7t0zLiz.js', reason: classified.reason, bucket: classified.bucket }] : [],
      }
      if (row.missingJsCss.length) failRow(row, 'no-missing-js-css', [], row.missingJsCss)
      else passRow(row, 'no-missing-js-css', [])
      return [finishRow(row)]
    },
  })

  const gDir = path.join(OUTPUT, 'offline-fixtures', 'hash-route-legitimate')
  await fsp.mkdir(gDir, { recursive: true })
  const hashLegitimatePayload = {
    kind: hashNav.kind,
    inventedResponse: hashNav.inventedResponse,
    responsePresent: hashNav.responsePresent,
    nonce: hashNav.nonce,
    g456WouldFailNonceNav: g456WouldFailNonceNav(null),
    note: 'same-document hash goto returns null; G462 inherits prior document nonce and does not invent a Response',
  }
  await writeJson(path.join(gDir, 'classification.json'), hashLegitimatePayload)

  Object.assign(checks, {
    serverHeadOk: assert(serverHead.ok === true && serverHead.bodyBytes === 0 && serverHead.statusCode === 200 && serverHead.nonce === nonce, 'server-head-ok', serverHead),
    serverHeadNotListen: assert(true, 'server-head-http-free-fake-req-res'),
    serverPostRejected: assert(headPost.statusCode === 444, 'server-post-nonstatic-444', headPost.statusCode),
    headBodyFails: assert(headWithBody.ok === false && headWithBody.failure === 'head-had-body-or-not-ended', 'head-with-body-is-server-head-failure', headWithBody),
    head405Fails: assert(head405.ok === false && head405.failure === 'head-status', 'head-405-is-server-head-failure', head405),
    hashLegitimate: assert(hashNav.kind === 'same-document-hash' && hashNav.inventedResponse === false && hashNav.responsePresent === false && hashNav.nonce === nonce, 'hash-route-legitimate', hashNav),
    firstDocument: assert(firstDoc.kind === 'document-load' && firstDoc.nonce === nonce && firstDoc.inventedResponse === false, 'first-document-load', firstDoc),
    g456NullWouldFail: assert(g456WouldFailNonceNav(null) === true && hashNav.kind === 'same-document-hash', 'g456-null-response-misread', { g456Fail: true, g462Kind: hashNav.kind }),
    missingNonceIsFail: assert(missingDocNonce.kind === 'document-load' && !missingDocNonce.nonce, 'document-missing-nonce-detected', missingDocNonce),
    hashWithoutPriorFails: assert(hashWithoutPrior.kind === 'missing-document' && hashWithoutPrior.fail === true, 'hash-without-prior-document-fails', hashWithoutPrior),
    headAbortNotJsCss: assert(headAbort.missingJsCss === false && headAbort.bucket === 'page-network-head-probe', 'page-head-err-aborted-not-missing-js-css', headAbort),
    jsAbortIsMissing: assert(jsAbort.missingJsCss === true && jsAbort.bucket === 'missing-js-css', 'route-guard-js-aborted-is-error', jsAbort),
    svgAbortNotJsCss: assert(svgAbort.missingJsCss === false && svgAbort.bucket === 'static-aborted-non-js-css', 'aborted-svg-not-missing-js-css', svgAbort),
    apiAbortNotJsCss: assert(apiAbort.missingJsCss === false && apiAbort.bucket === 'nonstatic-aborted', 'auth-post-aborted-not-js-css', apiAbort),
    wrongTreeThrows: assert(wrongTree.threw === true && Array.isArray(wrongTree.mismatches) && wrongTree.mismatches.some((row) => row.key === 'tree_fingerprint_sha256'), 'wrong-tree-fails', wrongTree),
    realHeadMissingNonceFailsClosed: assert(d.result.status === 'FAIL' && d.result.code === 'SERVER_HEAD_FAILURE' && d.result.failedStage === 'server-head-self-check', 'real-missing-nonce-head-fail-closed', { status: d.result.status, code: d.result.code, stage: d.result.failedStage }),
    realHeadMissingDurable: assert(fs.existsSync(path.join(dDir, 'run-receipt.json')) && JSON.parse(fs.readFileSync(path.join(dDir, 'cleanup-receipt.json'), 'utf8')).failedStage === 'server-head-self-check', 'real-missing-nonce-durable'),
    wrongTreeDurable: assert(e.result.status === 'FAIL' && e.result.failedStage === 'pin-verify-before' && fs.existsSync(path.join(eDir, 'run-receipt.json')), 'wrong-tree-durable-fail', { status: e.result.status, stage: e.result.failedStage, error: e.result.error }),
    routeGuardDurable: assert(f.result.status === 'FAIL' && f.result.summary.fail >= 1 && (f.result.summary.failed || []).some((row) => (row.failures || []).some((item) => item.name === 'no-missing-js-css')), 'route-guard-js-error-durable-fail', f.result.summary),
    cannotInventResponse: assert(hashNav.inventedResponse === false && firstDoc.inventedResponse === false, 'cannot-invent-response'),
  })
  const failed = Object.values(checks).filter((row) => !row.ok)
  const summary = {
    mode: 'offline-fixtures',
    at: new Date().toISOString(),
    ok: failed.length === 0,
    failed: failed.map((row) => ({ name: row.name, detail: row.detail })),
    checks,
    fixtures: {
      'fake-browser-no-process': { status: a.result.status, failedStage: a.result.failedStage, receipts: a.result.receipts, cleanupOk: a.result.cleanup.ok },
      'pid-reuse-mismatch': { status: b.result.status, failedStage: b.result.failedStage, receipts: b.result.receipts, cleanupOk: b.result.cleanup.ok, refused: b.result.cleanup.refusedSignals },
      'thrown-navigation': { status: c.result.status, failedStage: c.result.failedStage, error: c.result.error, receipts: c.result.receipts, cleanupOk: c.result.cleanup.ok },
      'document-missing-nonce': { status: d.result.status, failedStage: d.result.failedStage, error: d.result.error, code: d.result.code, receipts: d.result.receipts },
      'wrong-tree': { status: e.result.status, failedStage: e.result.failedStage, error: e.result.error, receipts: e.result.receipts },
      'route-guard-js-error': { status: f.result.status, failedStage: f.result.failedStage, summary: f.result.summary, receipts: f.result.receipts },
      'hash-route-legitimate': hashLegitimatePayload,
    },
    diagnosis: {
      serverHead,
      headWithBody,
      head405,
      hashNav,
      firstDoc,
      missingDocNonce,
      headAbort,
      jsAbort,
      svgAbort,
      wrongTree: { threw: wrongTree.threw, keys: (wrongTree.mismatches || []).map((row) => row.key) },
      g456WouldFailNullGoto: g456WouldFailNonceNav(null),
      playwrightGotoHashNote: 'Playwright 1.63 Page.goto types.d.ts 7740-7741: navigation to the same URL with a different hash succeeds and returns null',
    },
    bind: false,
    browser: false,
    liveRun: false,
  }
  const receiptPath = path.join(OUTPUT, 'offline-fixtures-receipt.json')
  await writeJson(receiptPath, summary)
  return { summary, receiptPath }
}

async function main() {
  const wantRun = process.argv.includes('--run')
  const wantFixtures = process.argv.includes('--offline-fixtures')
  const wantPrepare = process.argv.includes('--prepare') || (!wantRun && !wantFixtures)
  try {
    if (wantRun && (wantFixtures || process.argv.includes('--prepare'))) {
      throw new Error('pass only one of --run, --offline-fixtures, or --prepare')
    }
    if (wantFixtures) {
      const { summary, receiptPath } = await runOfflineFixtures()
      console.log(JSON.stringify({
        mode: 'offline-fixtures',
        ok: summary.ok,
        receipt: receiptPath,
        failed: summary.failed,
        fixtures: summary.fixtures,
        bind: false,
        browser: false,
      }, null, 2))
      process.exitCode = summary.ok ? 0 : 1
      return
    }
    if (wantRun) {
      const { result, resultPath } = await run()
      console.log(JSON.stringify({
        mode: 'run',
        status: result.status,
        failedStage: result.failedStage,
        receipt: resultPath,
        cleanupReceipt: result.receipts && result.receipts.cleanPath,
        elapsedMs: result.elapsedMs,
        matrix: result.matrix,
        summary: result.summary,
        nonstatic: result.counts.nonstatic,
        treeUnchanged: result.treeUnchanged,
        identityEstablished: result.ownership.identityEstablished,
        cleanupOk: result.cleanup && result.cleanup.ok,
        passBecauseProcessMissing: result.cleanup && result.cleanup.passBecauseProcessMissing,
        portAfterClose: result.cleanup && result.cleanup.portAfterClose,
      }, null, 2))
      process.exitCode = result.status === 'PASS' ? 0 : 1
      return
    }
    printPrepare(await prepare())
  } catch (error) {
    const payload = {
      mode: wantRun ? 'run' : wantFixtures ? 'offline-fixtures' : 'prepare',
      status: 'FAIL',
      failedStage: 'main-catch',
      error: String(error && error.message || error),
      code: error && error.code || null,
      holders: error && error.holders || undefined,
      mismatches: error && error.mismatches || undefined,
      passBecauseProcessMissing: false,
    }
    await fsp.mkdir(OUTPUT, { recursive: true }).catch(() => {})
    const name = wantRun ? 'run-receipt.json' : wantFixtures ? 'offline-fixtures-receipt.json' : 'prepare-receipt.json'
    await writeJson(path.join(OUTPUT, name), payload).catch(() => {})
    if (wantRun) {
      await writeJson(path.join(OUTPUT, 'cleanup-receipt.json'), {
        at: new Date().toISOString(),
        status: 'FAIL',
        failedStage: 'main-catch',
        error: payload.error,
        cleanup: { ok: false, passBecauseProcessMissing: false, note: 'exception before run() finally; see whether inner receipts exist' },
      }).catch(() => {})
    }
    console.error(JSON.stringify(payload, null, 2))
    process.exitCode = error && error.code === 'PORT_COLLISION' ? 3 : 1
  }
}

function invokedAsMainScript() {
  if (!process.argv[1]) return false
  const self = fileURLToPath(import.meta.url)
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(self)
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(self)
  }
}
if (invokedAsMainScript()) {
  await main()
}
