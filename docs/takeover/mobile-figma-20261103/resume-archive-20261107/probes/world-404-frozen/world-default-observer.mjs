/**
 * MB018 default/empty H5 observer for G404.
 *
 * An owned lease that already holds loopback IAM/Gateway/gamification, the
 * IAM TLS CA, the G388 nonce listener on 18183, and one approved synthetic
 * adult calls observeWorldDefault in memory. This file does not listen, does
 * not start a server, and does not substitute a response. Direct node runs
 * in-process checks only.
 *
 * Wire classification reuses G368 classifyRead/bundleReady/guardRequest
 * read-only. observeWorldOwner stays unused for the live result because it
 * still requires the B116 index digest. Rendered labels are a separate
 * surface from that wire class.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const JOB = '/tmp/grok-mobile-resume-world-404'
const CLASSIFIER = '/tmp/grok-mobile-world-real-owner-read-h5-probe-368/world-empty-owner.cjs'
const B139_H5_ROOT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const B139_INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_INDEX_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const WORLD_CHUNK = 'pages-world-world.12rRwasU.js'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const STATIC_QA_HEADER = 'x-mb004-static-qa'
const WORLD_HASH = '/pages/world/world'
const LOGIN_HASH = '/pages/login/login'
const HOME_HASH = '/pages/home/home'
const ONBOARDING_HASH = '/pages/onboarding/onboarding'
const FORBIDDEN_HASH = '/pages/forbidden/forbidden'
const LOGIN_PATH = '/api/v1/auth/login'
const PRINCIPAL_PATH = '/api/v1/iam/principal/me'
const PERMISSIONS_PATH = '/api/v1/iam/permissions'
const READ_PATHS = Object.freeze({
  '/api/v1/gamification/me/summary': 'summary',
  '/api/v1/gamification/streak': 'streak',
  '/api/v1/gamification/season': 'season',
  '/api/v1/gamification/quests': 'quests',
  '/api/v1/gamification/me/rewards': 'rewards',
})
const EXPECTED_CLASSES = Object.freeze({
  summary: 'DEFAULT_PROJECTION',
  streak: 'DEFAULT_ZERO',
  season: 'DEFAULT_CALENDAR_SHELL',
  quests: 'IMPLEMENTED_EMPTY_LIST',
  rewards: 'EMPTY_GRANT_LIST',
})
const CIVIL_TODAY = '2026-11-07'
const DEADLINE_MS = 120_000
const RESPONSE_WAIT_MS = 25_000
const BODY_CAP = 16384
const PRINCIPAL_GET_BUDGET = 6
const PERMISSIONS_GET_BUDGET = 2
const READ_BUDGET = 1
const PLAYWRIGHT_ROOTS = [
  '/Users/Admin/.codex/worktrees/mobile-resume-reference-20261107/cloudstudy/package.json',
  '/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy/package.json',
  '/Users/Admin/.codex/worktrees/mobile-figma-integration-20261103/cloudstudy/package.json',
]
const CONTEXT_OPTIONS = Object.freeze({
  viewport: { width: 390, height: 844 },
  locale: 'zh-CN',
  serviceWorkers: 'block',
  reducedMotion: 'no-preference',
  ignoreHTTPSErrors: false,
})
const REJECTED_INPUT = [
  'baseUrl', 'gateway', 'host', 'port', 'url', 'proxy', 'fulfill', 'listen',
  'seedSku', 'claim', 'reward', 'probability', 'fixture',
]
const COPY = Object.freeze({
  zh: Object.freeze({
    title: '成长',
    subtitle: '查看进度、奖励与自习室',
    level: 'Lv.1',
    xp: '0 XP',
    days: '0 天',
    streakUnknown: '状态待确认',
    zone: 'Asia/Shanghai',
    dateUnknown: '日期未提供',
    calendar: '每日记录暂未提供',
    map: '成长地图暂未提供',
    seasonId: 'SEASON_2026_Q4',
    seasonPoints: '0 赛季点',
    noQuests: '暂无成长任务。',
    rewardsEmpty: '当前没有待开启奖励箱。',
    lastUpdated: '已读取服务端事实',
  }),
  en: Object.freeze({
    title: 'Growth',
    subtitle: 'Review progress, rewards and study rooms',
    level: 'Lv.1',
    xp: '0 XP',
    days: '0 days',
    streakUnknown: 'Status pending',
    zone: 'Asia/Shanghai',
    dateUnknown: 'Date not provided',
    calendar: 'Daily calendar is not provided yet.',
    map: 'Growth map is not provided yet.',
    seasonId: 'SEASON_2026_Q4',
    seasonPoints: '0 season points',
    noQuests: 'No growth quests yet.',
    rewardsEmpty: 'There are no reward chests to open.',
    lastUpdated: 'Server facts loaded',
  }),
})
const FORBIDDEN = Object.freeze({
  zh: Object.freeze({
    streakEmpty: '还没有连续学习记录，从今天开始积累吧。',
    seasonEmpty: '当前暂无赛季活动。',
    closed: '成长世界暂未开放',
    claim: '开启奖励箱',
    granted: '待开启',
  }),
  en: Object.freeze({
    streakEmpty: 'No streak yet. Start one today.',
    seasonEmpty: 'No season activity right now.',
    closed: 'Growth world is not open yet',
    claim: 'Open chest',
    granted: 'Ready to open',
  }),
})

const owner = createRequire(import.meta.url)(CLASSIFIER)

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function acceptableSecret(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max && !/[\u0000-\u001F\u007F\s]/.test(value)
}

function argvCarries(secret) {
  if (typeof secret !== 'string' || secret.length === 0) return false
  return process.argv.some((arg) => typeof arg === 'string' && arg.includes(secret))
}

function publicCertPath(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 512) return null
  if (!path.isAbsolute(value) || value.includes('\0') || /[\r\n]/.test(value)) return null
  const base = path.basename(value).toLowerCase()
  if (base.includes('key') || base.includes('priv') || base.endsWith('.p12') || base.endsWith('.pfx')) return null
  if (!base.endsWith('.pem') && !base.endsWith('.crt') && !base.endsWith('.cer')) return null
  return value
}

function certificateSpki(pemPath) {
  const pem = fs.readFileSync(pemPath)
  const cert = new crypto.X509Certificate(pem)
  const der = cert.publicKey.export({ type: 'spki', format: 'der' })
  const spki = crypto.createHash('sha256').update(der).digest('base64')
  if (!/^[A-Za-z0-9+/]+=*$/.test(spki) || spki.length > 128) throw new Error('spki-shape')
  return spki
}

function browserEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/PROXY|PASSWORD|SECRET|TOKEN|CREDENTIAL|COOKIE|PASSWD/i.test(key)) delete env[key]
  }
  return env
}

function loadChromium() {
  for (const root of PLAYWRIGHT_ROOTS) {
    try {
      const playwright = createRequire(root)('playwright')
      if (playwright && playwright.chromium) return playwright.chromium
    } catch { /* try the next installed worktree */ }
  }
  return null
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function dataOf(parsed) {
  const record = asRecord(parsed)
  if (!record) return null
  return asRecord(record.data) || record
}

function expectedSeasonId() {
  const pinned = owner.seasonIdFor(owner.SERVICE_DATE)
  const today = owner.seasonIdFor(CIVIL_TODAY)
  if (pinned !== today || pinned !== 'SEASON_2026_Q4') return null
  return pinned
}

function localIndex() {
  try {
    const index = path.join(B139_H5_ROOT, 'index.html')
    const digest = sha256(fs.readFileSync(index))
    const chunk = path.join(B139_H5_ROOT, 'assets', WORLD_CHUNK)
    const worldPresent = fs.existsSync(chunk) && fs.statSync(chunk).isFile()
    return { ok: digest === B139_INDEX_SHA && worldPresent, digest, worldPresent }
  } catch {
    return { ok: false, digest: null, worldPresent: false }
  }
}

function emptyCounts() {
  return {
    static: 0,
    loginPost: 0,
    loginOptions: 0,
    principal: 0,
    permissions: 0,
    summary: 0,
    streak: 0,
    season: 0,
    quests: 0,
    rewards: 0,
    options: 0,
    write: 0,
    closed: 0,
    claim: 0,
    probability: 0,
    bootAborted: 0,
    missingAuthorization: 0,
    fulfill: 0,
  }
}

function blankReceipt(status, reason, extra = {}) {
  return {
    job: 'MB018-H5-DEFAULT-404',
    status,
    reason,
    observed: false,
    worldEmptyReady: false,
    launched: extra.launched === true,
    h5Started: extra.h5Started === true,
    indexMatch: extra.indexMatch === true ? true : extra.indexMatch === false ? false : null,
    expectedIndexSha256: B139_INDEX_SHA,
    b116Rejected: true,
    wire: extra.wire || null,
    rendered: extra.rendered || null,
    counts: extra.counts || emptyCounts(),
    writes: extra.writes == null ? 0 : extra.writes,
    claimClicks: 0,
    fulfilled: 0,
    historicalReceiptUsed: false,
    classifierFile: CLASSIFIER,
    nonceHeader: STATIC_QA_HEADER,
    nonceValueOmitted: true,
    passwordOmitted: true,
    subjectOmitted: true,
    identifierOmitted: true,
    valueOmitted: true,
    domTextOmitted: true,
    routeFulfill: false,
    ...extra.public,
  }
}

function leaked(text, secrets) {
  if (typeof text !== 'string') return true
  if (/Bearer\s+[A-Za-z0-9\-._~+/]+=*/.test(text)) return true
  if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) return true
  return secrets.some((secret) => typeof secret === 'string' && secret.length >= 8 && text.includes(secret))
}

function classifyBrowser(method, rawUrl) {
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return { action: 'abort', kind: 'other', name: 'url' }
  }
  const verb = String(method || '').toUpperCase()
  if (url.origin === PAGE_ORIGIN && (verb === 'GET' || verb === 'HEAD')) {
    return { action: 'continue', kind: 'static', name: 'h5' }
  }
  if (url.origin === PAGE_ORIGIN) return { action: 'abort', kind: 'write', name: url.pathname }
  if (verb === 'OPTIONS' && (url.origin === IAM_ORIGIN || url.origin === GATEWAY_ORIGIN)) {
    if (url.origin === IAM_ORIGIN && url.pathname === LOGIN_PATH) {
      return { action: 'continue', kind: 'options', name: 'login' }
    }
    if (url.origin === GATEWAY_ORIGIN && (READ_PATHS[url.pathname] || url.pathname === PRINCIPAL_PATH || url.pathname === PERMISSIONS_PATH)) {
      return { action: 'continue', kind: 'options', name: READ_PATHS[url.pathname] || 'principal' }
    }
    return { action: 'abort', kind: 'closed', name: url.pathname }
  }
  if (url.origin === IAM_ORIGIN && verb === 'POST' && url.pathname === LOGIN_PATH) {
    return { action: 'continue', kind: 'signin', name: 'login' }
  }
  if (url.origin === GATEWAY_ORIGIN && verb === 'GET' && url.pathname === PERMISSIONS_PATH && url.search === '') {
    return { action: 'continue', kind: 'boot', name: 'permissions' }
  }
  const guarded = owner.guardRequest(verb, rawUrl)
  if (guarded.kind === 'write' || (url.pathname && /\/(claim|probability|rescue|settings)$/.test(url.pathname))) {
    const claim = /\/claim$/.test(url.pathname)
    const probability = /\/probability$/.test(url.pathname)
    return { action: 'abort', kind: claim ? 'claim' : probability ? 'probability' : 'write', name: url.pathname }
  }
  return guarded
}

function bump(state, name) {
  if (!Object.prototype.hasOwnProperty.call(state.counts, name)) state.counts.closed += 1
  else state.counts[name] += 1
}

function overBudget(state, name, method) {
  if (name === 'login' && method === 'POST') return state.counts.loginPost >= 1
  if (name === 'principal' && method === 'GET') return state.counts.principal >= PRINCIPAL_GET_BUDGET
  if (name === 'permissions' && method === 'GET') return state.counts.permissions >= PERMISSIONS_GET_BUDGET
  if (READ_PATHS[`/api/v1/gamification/${name === 'summary' ? 'me/summary' : name === 'rewards' ? 'me/rewards' : name}`] || ['summary', 'streak', 'season', 'quests', 'rewards'].includes(name)) {
    return method === 'GET' && state.counts[name] >= READ_BUDGET
  }
  return false
}

function captureBody(text) {
  if (typeof text !== 'string' || text.length === 0) return null
  if (text.length > BODY_CAP) return { overflow: true }
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function subjectOf(parsed) {
  const data = dataOf(parsed)
  if (!data) return ''
  const principal = asRecord(data.principal) || data
  const found = principal.subject || principal.sub || principal.principalId || ''
  return typeof found === 'string' ? found : ''
}

function permissionList(parsed) {
  const data = dataOf(parsed)
  if (!data) return []
  const found = []
  if (Array.isArray(data.permissions)) found.push(...data.permissions.filter((item) => typeof item === 'string'))
  const principal = asRecord(data.principal)
  if (principal && Array.isArray(principal.permissions)) {
    found.push(...principal.permissions.filter((item) => typeof item === 'string'))
  }
  return found
}

function adultOf(parsed) {
  const data = dataOf(parsed)
  if (!data) return { status: null, learningAccess: null, accepted: null }
  const adult = asRecord(data.adultGate) || {}
  const consent = asRecord(data.consentState) || {}
  return {
    status: typeof adult.status === 'string' ? adult.status : null,
    learningAccess: typeof adult.learningAccess === 'string' ? adult.learningAccess : null,
    accepted: consent.accepted === true,
    account: data.status === 'ACTIVE',
  }
}

function classifyWire(state, subject) {
  const seasonId = expectedSeasonId()
  const bodies = {}
  for (const name of ['summary', 'streak', 'season', 'quests', 'rewards']) {
    bodies[name] = state.bodies[name]
  }
  const classified = owner.bundleReady(bodies, subject)
  const once = ['summary', 'streak', 'season', 'quests', 'rewards'].every((name) => state.counts[name] === 1)
  const holds = classified.holds === true
    && classified.className === 'DEFAULT_OWNER_EMPTY'
    && once
    && state.counts.write === 0
    && state.counts.claim === 0
    && state.counts.probability === 0
    && state.counts.fulfill === 0
    && state.counts.loginPost === 1
    && state.counts.principal >= 1
    && state.loginStatus === 200
    && state.principalStatus === 200
    && seasonId === COPY.zh.seasonId
  return {
    surface: 'wire',
    holds,
    className: classified.className,
    classes: classified.classes,
    page: classified.page,
    seasonId,
    once,
    loginStatus: state.loginStatus,
    principalStatus: state.principalStatus,
    classifierStatus: holds ? 'WIRE_SHAPE' : 'FAIL',
    classifierReason: holds ? 'default-owner-empty' : 'shape',
    observed: false,
    worldEmptyReady: false,
  }
}

function classifyRendered(visible) {
  const packName = visible && visible.copy
  const pack = packName === 'en' ? COPY.en : packName === 'zh' ? COPY.zh : null
  const forbiddenPack = packName === 'en' ? FORBIDDEN.en : packName === 'zh' ? FORBIDDEN.zh : null
  const missing = []
  const presentForbidden = []
  if (!visible || visible.present !== true || !pack || !forbiddenPack) {
    return {
      surface: 'rendered',
      holds: false,
      copy: packName || null,
      missing: ['page'],
      presentForbidden,
      questRows: visible && visible.questRows,
      rewardRows: visible && visible.rewardRows,
      claimButtons: visible && visible.claimButtons,
      entries: visible && visible.entries,
      route: visible && visible.route,
    }
  }
  const got = {
    title: visible.title,
    subtitle: visible.subtitle,
    level: visible.level,
    xp: visible.xp,
    days: visible.streakNumber,
    streakUnknown: visible.streakTag,
    zone: Array.isArray(visible.zone) ? visible.zone.join(' ') : '',
    dateUnknown: Array.isArray(visible.zone) ? visible.zone.join(' ') : '',
    calendar: visible.calendar,
    map: visible.map,
    seasonId: visible.seasonTitle,
    seasonPoints: visible.seasonMeta,
    noQuests: visible.questsEmpty,
    rewardsEmpty: visible.rewardsEmpty,
    lastUpdated: visible.statusText,
  }
  for (const key of Object.keys(pack)) {
    const expected = pack[key]
    const actual = got[key]
    if (typeof actual !== 'string' || !actual.includes(expected)) missing.push(key)
  }
  for (const key of Object.keys(forbiddenPack)) {
    const line = forbiddenPack[key]
    const blob = [
      visible.title, visible.subtitle, visible.level, visible.xp, visible.streakNumber,
      visible.streakTag, visible.calendar, visible.map, visible.seasonTitle, visible.seasonMeta,
      visible.questsEmpty, visible.rewardsEmpty, visible.closed, visible.statusText,
      ...(Array.isArray(visible.zone) ? visible.zone : []),
    ].join('\n')
    if (blob.includes(line)) presentForbidden.push(key)
  }
  const holds = missing.length === 0
    && presentForbidden.length === 0
    && visible.questRows === 0
    && visible.rewardRows === 0
    && visible.claimButtons === 0
    && visible.entries === 4
    && visible.route === WORLD_HASH
  return {
    surface: 'rendered',
    holds,
    copy: packName,
    missing,
    presentForbidden,
    questRows: visible.questRows,
    rewardRows: visible.rewardRows,
    claimButtons: visible.claimButtons,
    entries: visible.entries,
    route: visible.route,
    level: visible.level,
    xp: visible.xp,
    streakNumber: visible.streakNumber,
    seasonTitle: visible.seasonTitle,
  }
}

async function readVisible(page) {
  try {
    return await page.evaluate(({ worldHash, copy, forbidden }) => {
      const root = document.querySelector('.world-page')
      const textOf = (sel) => {
        const node = document.querySelector(sel)
        return node && typeof node.textContent === 'string' ? node.textContent.trim() : ''
      }
      const texts = (sel) => [...document.querySelectorAll(sel)].map((node) => node.textContent.trim()).filter(Boolean)
      const blob = root && typeof root.innerText === 'string' ? root.innerText : ''
      let copyName = null
      if (blob.includes(copy.zh.subtitle) && blob.includes(copy.zh.noQuests)) copyName = 'zh'
      else if (blob.includes(copy.en.subtitle) && blob.includes(copy.en.noQuests)) copyName = 'en'
      const hash = String(location.hash || '').replace(/^#/, '').split('?')[0] || '/'
      return {
        present: Boolean(root),
        copy: copyName,
        title: textOf('.mobile-page-title'),
        subtitle: textOf('.mobile-page-description'),
        level: textOf('.world-hero-level'),
        xp: textOf('.world-hero-xp'),
        streakNumber: textOf('.world-streak-number'),
        streakTag: textOf('.world-streak-card .world-tag'),
        zone: texts('.world-streak-card .world-meta'),
        calendar: texts('.world-streak-card .world-note').join('\n'),
        map: textOf('.world-head-note'),
        seasonTitle: textOf('.world-season-title'),
        seasonMeta: textOf('.world-season-meta'),
        questsEmpty: textOf('.world-quests-card .world-empty'),
        rewardsEmpty: textOf('[data-b12-rewards] .b12-state-box'),
        statusText: textOf('.world-live'),
        closed: textOf('.world-closed-title'),
        questRows: document.querySelectorAll('.world-quest').length,
        rewardRows: document.querySelectorAll('.b12-chest').length,
        claimButtons: document.querySelectorAll('.b12-button--primary').length,
        entries: document.querySelectorAll('.world-entry').length,
        route: hash.startsWith('/') ? hash : `/${hash}`,
        worldHash,
        forbiddenProbe: Boolean(blob.includes(forbidden.zh.claim) || blob.includes(forbidden.en.claim)),
      }
    }, { worldHash: WORLD_HASH, copy: COPY, forbidden: FORBIDDEN })
  } catch {
    return null
  }
}

function hashPath(pageUrl) {
  let url
  try { url = new URL(pageUrl) } catch { return '/' }
  return url.hash.replace(/^#/, '').split('?')[0] || '/'
}

function noteRoute(state, pageUrl) {
  let url
  try { url = new URL(pageUrl) } catch { return }
  if (url.origin !== PAGE_ORIGIN) return
  const hash = hashPath(pageUrl)
  state.route = hash.startsWith('/') ? hash : `/${hash}`
  if (state.route === HOME_HASH) state.homeOpened = true
  if (state.route === ONBOARDING_HASH) state.onboardingOpened = true
  if (state.route === FORBIDDEN_HASH) state.forbiddenOpened = true
  if (state.route === WORLD_HASH) state.worldOpened = true
}

function createState() {
  return {
    counts: emptyCounts(),
    bodies: {},
    route: null,
    worldOpened: false,
    homeOpened: false,
    onboardingOpened: false,
    forbiddenOpened: false,
    indexChecked: false,
    indexMatch: null,
    infra: null,
    loginStatus: null,
    principalStatus: null,
    principalOk: false,
    subject: '',
    permissions: [],
    clickedClaim: false,
  }
}

function createPhase() {
  return { stop: false, allowLogin: false }
}

function preflight(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { blocked: blankReceipt('BLOCKED', 'lease') }
  }
  if (input.ownedLease !== true) return { blocked: blankReceipt('BLOCKED', 'lease') }
  if (input.profile !== 'local-real' || input.seeded !== false) {
    return { blocked: blankReceipt('BLOCKED', 'profile') }
  }
  if (input.ignoreHTTPSErrors === true || Object.prototype.hasOwnProperty.call(input, 'proxy')) {
    return { blocked: blankReceipt('BLOCKED', input.ignoreHTTPSErrors === true ? 'https-errors-refused' : 'proxy-refused') }
  }
  for (const key of REJECTED_INPUT) {
    if (Object.prototype.hasOwnProperty.call(input, key)) return { blocked: blankReceipt('BLOCKED', 'target-rejected') }
  }
  if (typeof input.staticNonce !== 'string' || !/^[0-9a-f]{64}$/.test(input.staticNonce)) {
    return { blocked: blankReceipt('BLOCKED', 'nonce') }
  }
  if (argvCarries(input.staticNonce)) return { blocked: blankReceipt('BLOCKED', 'argv-secret') }
  const cert = publicCertPath(input.caPem)
  if (!cert) return { blocked: blankReceipt('BLOCKED', 'tls-path') }
  let spki = null
  try { spki = certificateSpki(cert) } catch { return { blocked: blankReceipt('BLOCKED', 'spki-unavailable') } }
  const approved = input.approved && typeof input.approved === 'object' ? input.approved : null
  if (!approved || !acceptableSecret(approved.identifier, 3, 128) || !acceptableSecret(approved.password, 12, 128)) {
    return { blocked: blankReceipt('BLOCKED', 'actor') }
  }
  if (argvCarries(approved.identifier) || argvCarries(approved.password)) {
    return { blocked: blankReceipt('BLOCKED', 'argv-secret') }
  }
  const index = localIndex()
  if (!index.ok) return { blocked: blankReceipt('BLOCKED', index.digest && index.digest !== B139_INDEX_SHA ? 'h5-not-b139' : 'h5-unavailable') }
  if (!expectedSeasonId()) return { blocked: blankReceipt('BLOCKED', 'season-date') }
  if (owner.B116_SHA !== B116_INDEX_SHA) return { blocked: blankReceipt('BLOCKED', 'classifier-pin') }
  return {
    blocked: null,
    spki,
    nonce: input.staticNonce,
    identifier: approved.identifier,
    password: approved.password,
    caPem: cert,
  }
}

function wirePage(page, state, phase, ready) {
  page.on('framenavigated', (frame) => {
    try {
      if (frame !== page.mainFrame()) return
      noteRoute(state, frame.url())
    } catch { /* keep last route */ }
  })
  page.on('response', async (response) => {
    let url
    try { url = new URL(response.url()) } catch { return }
    const method = response.request().method()
    if (url.origin === PAGE_ORIGIN && (url.pathname === '/' || url.pathname === '/index.html')) {
      state.indexChecked = true
      state.indexMatch = localIndex().ok
    }
    const decision = classifyBrowser(method, response.url())
    if (decision.name === 'login' && method === 'POST') state.loginStatus = response.status()
    if (decision.name === 'principal' && method === 'GET') {
      state.principalStatus = response.status()
      if (response.status() === 200) {
        try {
          const parsed = captureBody(await response.text())
          const subject = subjectOf(parsed)
          if (subject) state.subject = subject
          state.permissions = permissionList(parsed)
          const adult = adultOf(parsed)
          state.principalOk = adult.account === true && adult.status === 'PASSED' && adult.learningAccess === 'ELIGIBLE' && adult.accepted === true && state.permissions.includes('gamification.read')
        } catch { /* keep last principal snapshot */ }
      }
    }
    if (decision.kind === 'read' && method === 'GET' && response.status() === 200) {
      try {
        const parsed = captureBody(await response.text())
        if (parsed && parsed.overflow !== true) state.bodies[decision.name] = parsed
      } catch { /* keep last body */ }
    }
  })
  page.route('**/*', async (route) => {
    const request = route.request()
    const method = request.method()
    let url
    try { url = new URL(request.url()) } catch {
      await route.abort()
      return
    }
    try {
      if (request.isNavigationRequest() === false && request.resourceType() === 'ping') {
        await route.abort()
        return
      }
      const decision = classifyBrowser(method, request.url())
      if (decision.action === 'continue' && decision.kind === 'static') {
        bump(state, 'static')
        const headers = { ...request.headers(), [STATIC_QA_HEADER]: ready.nonce }
        await route.continue({ headers })
        return
      }
      if (decision.action === 'continue') {
        if (decision.kind === 'signin' && method === 'POST' && !phase.allowLogin) {
          bump(state, 'write')
          await route.abort()
          return
        }
        if ((decision.kind === 'read' || decision.name === 'principal' || decision.name === 'permissions') && method === 'GET') {
          const headerBag = request.headers()
          const authorized = typeof headerBag.authorization === 'string' && headerBag.authorization.startsWith('Bearer ')
          if (!authorized) {
            state.counts.missingAuthorization += 1
            await route.abort()
            return
          }
        }
        if (overBudget(state, decision.name, method)) {
          bump(state, 'write')
          await route.abort()
          return
        }
        if (decision.name === 'login' && method === 'POST') bump(state, 'loginPost')
        else if (decision.kind === 'options') bump(state, 'options')
        else if (decision.name === 'permissions') bump(state, 'permissions')
        else bump(state, decision.name)
        await route.continue()
        return
      }
      if (decision.kind === 'claim') {
        bump(state, 'claim')
        await route.abort()
        return
      }
      if (decision.kind === 'probability') {
        bump(state, 'probability')
        await route.abort()
        return
      }
      if (decision.kind === 'write') bump(state, 'write')
      else bump(state, 'bootAborted')
      await route.abort()
    } catch {
      await route.abort().catch(() => {})
    }
  })
}

async function fillHost(page, hostId, bareId, value) {
  const host = page.locator(`#${hostId} .uni-input-input`).first()
  const field = (await host.count()) ? host : page.locator(`#${bareId}`).first()
  await field.fill(value)
}

async function waitFor(predicate, timeoutMs) {
  const until = Date.now() + timeoutMs
  while (Date.now() < until) {
    if (await predicate()) return true
    await sleep(100)
  }
  return predicate()
}

function finish(state, visible, status, reason) {
  const wire = classifyWire(state, state.subject)
  const rendered = classifyRendered(visible)
  const observed = status === 'OBSERVED' && reason === 'default-owner-empty' && wire.holds === true && rendered.holds === true
  return blankReceipt(observed ? 'OBSERVED' : status, observed ? 'default-owner-empty' : reason, {
    launched: true,
    h5Started: true,
    indexMatch: state.indexMatch === true,
    counts: state.counts,
    writes: state.counts.write + state.counts.claim + state.counts.probability + state.counts.fulfill,
    wire: {
      surface: 'wire',
      holds: wire.holds,
      className: wire.className,
      classes: wire.classes,
      page: wire.page,
      seasonId: wire.seasonId,
      classifierStatus: wire.classifierStatus,
      classifierReason: wire.classifierReason,
      loginStatus: wire.loginStatus,
      principalStatus: wire.principalStatus,
      once: wire.once,
      observed: false,
      worldEmptyReady: false,
      g368ObserveWorldOwner: 'unused-for-live-b139',
    },
    rendered: {
      surface: 'rendered',
      holds: rendered.holds,
      copy: rendered.copy,
      missing: rendered.missing,
      presentForbidden: rendered.presentForbidden,
      questRows: rendered.questRows,
      rewardRows: rendered.rewardRows,
      claimButtons: rendered.claimButtons,
      entries: rendered.entries,
      route: rendered.route,
      level: rendered.level,
      xp: rendered.xp,
      streakNumber: rendered.streakNumber,
      seasonTitle: rendered.seasonTitle,
    },
    public: {
      observed,
      worldEmptyReady: observed,
      principalEligible: state.principalOk === true,
      onboardingOpened: state.onboardingOpened === true,
      forbiddenOpened: state.forbiddenOpened === true,
      clickedClaim: state.clickedClaim === true,
    },
  })
}

async function runOwner(page, state, phase, ready) {
  const loginUrl = `${PAGE_ORIGIN}/#${LOGIN_HASH}?returnTo=${encodeURIComponent(WORLD_HASH)}`
  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  } catch {
    return finish(state, null, 'BLOCKED', state.infra || 'h5-unavailable')
  }
  noteRoute(state, page.url())
  const indexed = await waitFor(() => state.indexChecked === true || phase.stop === true, 10_000)
  if (phase.stop) return finish(state, null, 'TIMEOUT', 'timeout')
  if (!indexed || state.indexMatch !== true) {
    return finish(state, null, 'BLOCKED', state.indexMatch === false ? 'h5-not-b139' : 'h5-unavailable')
  }
  const form = await page.locator('.login-submit').first().waitFor({ state: 'visible', timeout: 20_000 }).then(() => true).catch(() => false)
  if (!form) return finish(state, await readVisible(page), 'BLOCKED', 'login-missing')
  phase.allowLogin = true
  await fillHost(page, 'mobile-login-identifier-host', 'mobile-login-identifier', ready.identifier)
  await fillHost(page, 'mobile-login-password-host', 'mobile-login-password', ready.password)
  await page.locator('.login-submit').first().click()
  const loggedIn = await waitFor(() => state.loginStatus != null || phase.stop === true, 20_000)
  phase.allowLogin = false
  if (phase.stop) return finish(state, await readVisible(page), 'TIMEOUT', 'timeout')
  if (!loggedIn || state.loginStatus !== 200) return finish(state, await readVisible(page), 'FAILED', 'login')
  const settled = await waitFor(async () => {
    if (phase.stop) return true
    noteRoute(state, page.url())
    if (state.onboardingOpened || state.forbiddenOpened) return true
    if (!(state.bodies.summary && state.bodies.streak && state.bodies.season && state.bodies.quests && state.bodies.rewards)) return false
    const visible = await readVisible(page)
    if (!visible || visible.present !== true) return false
    if (visible.route !== WORLD_HASH) return false
    if (visible.copy === 'zh' || visible.copy === 'en') return true
    return visible.closed.length > 0
  }, RESPONSE_WAIT_MS)
  if (phase.stop) return finish(state, await readVisible(page), 'TIMEOUT', 'timeout')
  noteRoute(state, page.url())
  const visible = await readVisible(page)
  if (state.onboardingOpened) return finish(state, visible, 'FAILED', 'onboarding')
  if (state.forbiddenOpened) return finish(state, visible, 'FAILED', 'forbidden')
  if (!settled) return finish(state, visible, 'FAILED', 'response-timeout')
  if (!state.principalOk) return finish(state, visible, 'FAILED', 'principal-rejected')
  const wire = classifyWire(state, state.subject)
  const rendered = classifyRendered(visible)
  if (wire.holds && rendered.holds && state.counts.claim === 0 && state.counts.write === 0) {
    return finish(state, visible, 'OBSERVED', 'default-owner-empty')
  }
  if (wire.holds && !rendered.holds) return finish(state, visible, 'FAILED', 'rendered-mismatch')
  if (!wire.holds && rendered.holds) return finish(state, visible, 'FAILED', 'wire-mismatch')
  return finish(state, visible, 'FAILED', 'shape')
}

async function runBrowser(ready) {
  const chromium = loadChromium()
  if (!chromium) return blankReceipt('BLOCKED', 'playwright-unavailable')
  const state = createState()
  const phase = createPhase()
  let browser = null
  let scenario = null
  try {
    browser = await chromium.launch({
      headless: true,
      channel: 'chrome',
      args: [`--ignore-certificate-errors-spki-list=${ready.spki}`, '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'],
      env: browserEnv(),
    })
    const context = await browser.newContext(CONTEXT_OPTIONS)
    context.setDefaultTimeout(20_000)
    const page = await context.newPage()
    wirePage(page, state, phase, ready)
    scenario = runOwner(page, state, phase, ready).finally(() => context.close().catch(() => {}))
    const timeout = sleep(DEADLINE_MS).then(() => ({ timedOut: true }))
    const outcome = await Promise.race([scenario.then((value) => ({ timedOut: false, value })), timeout])
    if (outcome.timedOut) {
      phase.stop = true
      if (browser) await browser.close().catch(() => {})
      browser = null
      return finish(state, null, 'TIMEOUT', 'timeout')
    }
    return outcome.value
  } catch (error) {
    const text = String(error && error.message ? error.message : '')
    if (text.includes(ready.password) || text.includes(ready.identifier) || text.includes(ready.nonce)) {
      return blankReceipt('BLOCKED', 'receipt-secret', { launched: true })
    }
    if (/channel|chrome/i.test(text)) return blankReceipt('BLOCKED', 'chrome-unavailable')
    return blankReceipt('BLOCKED', state.infra || 'world-proof-failed', { launched: true })
  } finally {
    if (browser) await browser.close().catch(() => {})
    if (scenario) await Promise.race([scenario.catch(() => null), sleep(4_000)])
  }
}

export async function observeWorldDefault(input) {
  const ready = preflight(input)
  if (ready.blocked) return ready.blocked
  try {
    const receipt = await runBrowser(ready)
    const encoded = JSON.stringify(receipt)
    if (leaked(encoded, [ready.password, ready.identifier, ready.nonce, ready.spki, ready.caPem])) {
      return blankReceipt('BLOCKED', 'receipt-secret', { launched: receipt.launched === true })
    }
    return receipt
  } finally {
    ready.password = ''
    ready.identifier = ''
    ready.nonce = ''
    ready.spki = ''
  }
}

function check(condition, reason) {
  if (!condition) {
    const error = new Error(reason)
    error.reason = reason
    throw error
  }
}

export function runObserverChecks() {
  check(owner.B116_SHA === B116_INDEX_SHA, 'classifier-pin')
  check(typeof owner.classifyRead === 'function' && typeof owner.bundleReady === 'function', 'classifier-exports')
  check(typeof owner.guardRequest === 'function' && typeof owner.observeWorldOwner === 'function', 'classifier-exports')
  const seasonId = expectedSeasonId()
  check(seasonId === 'SEASON_2026_Q4', 'season-date')
  const classified = owner.runClassifier()
  check(classified.status === 'CLASSIFIER_READY' && classified.observed === false, 'classifier-ready')
  check(classified.worldEmptyReady === false, 'classifier-not-h5')
  const index = localIndex()
  check(index.ok === true && index.digest === B139_INDEX_SHA, 'b139-index')
  check(index.worldPresent === true, 'world-chunk')
  const blockedB139 = owner.observeWorldOwner({
    ownedLease: true,
    seeded: false,
    profile: 'local-real',
    fulfilled: false,
    capturedOnWire: true,
    indexSha: B139_INDEX_SHA,
    actor: { approved: true, adult: 'PASSED', learningAccess: 'ELIGIBLE', permissions: ['gamification.read'], subject: 'prn_g404-unused' },
  })
  check(blockedB139.reason === 'b116-index' && blockedB139.observed === false, 'b139-not-g368-observe')
  const bodies = owner.defaultBodies('prn_g342-subject-b-0002')
  const bundle = owner.bundleReady(bodies, 'prn_g342-subject-b-0002')
  check(bundle.className === 'DEFAULT_OWNER_EMPTY' && bundle.holds === true, 'default-class')
  check(bundle.page.rewardsMounted === true && bundle.page.quests === 'empty', 'page-branch')
  check(owner.guardRequest('POST', 'http://127.0.0.1:18070/api/v1/gamification/me/rewards/grant-1/claim').kind === 'write', 'claim-write')
  check(owner.guardRequest('GET', 'http://127.0.0.1:18070/api/v1/gamification/me/rewards/grant-1/probability').kind === 'closed', 'probability-closed')
  const options = classifyBrowser('OPTIONS', 'http://127.0.0.1:18070/api/v1/gamification/me/summary')
  check(options.action === 'continue' && options.kind === 'options', 'options-not-write')
  const visible = {
    present: true,
    copy: 'zh',
    title: COPY.zh.title,
    subtitle: COPY.zh.subtitle,
    level: COPY.zh.level,
    xp: COPY.zh.xp,
    streakNumber: COPY.zh.days,
    streakTag: COPY.zh.streakUnknown,
    zone: [COPY.zh.zone, COPY.zh.dateUnknown],
    calendar: COPY.zh.calendar,
    map: COPY.zh.map,
    seasonTitle: COPY.zh.seasonId,
    seasonMeta: `${COPY.zh.seasonPoints} · ${COPY.zh.streakUnknown}`,
    questsEmpty: COPY.zh.noQuests,
    rewardsEmpty: COPY.zh.rewardsEmpty,
    statusText: COPY.zh.lastUpdated,
    closed: '',
    questRows: 0,
    rewardRows: 0,
    claimButtons: 0,
    entries: 4,
    route: WORLD_HASH,
  }
  const rendered = classifyRendered(visible)
  check(rendered.holds === true && rendered.surface === 'rendered', 'rendered-pack')
  const populated = { ...visible, xp: '20 XP', questRows: 1, rewardsEmpty: '' }
  check(classifyRendered(populated).holds === false, 'populated-rejected')
  return {
    ok: true,
    job: 'MB018-H5-DEFAULT-404',
    status: 'OBSERVER_PREPARED',
    observed: false,
    worldEmptyReady: false,
    launched: false,
    runtimeRoutes: false,
    indexSha: B139_INDEX_SHA,
    b116Rejected: true,
    seasonId,
    classifier: CLASSIFIER,
    worldChunk: WORLD_CHUNK,
    g368ObserveWorldOwner: 'unused-for-live-b139',
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
  try {
    process.stdout.write(`${JSON.stringify(runObserverChecks())}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      status: 'OBSERVER_FAILED',
      observed: false,
      worldEmptyReady: false,
      launched: false,
      reason: error.reason || 'observer-check',
    })}\n`)
    process.exitCode = 1
  }
}
