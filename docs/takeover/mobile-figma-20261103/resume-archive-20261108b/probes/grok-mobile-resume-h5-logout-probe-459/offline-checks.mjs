/**
 * G459 OFFLINE matcher and guard checks. Importing does not listen.
 * Direct node run exits 0 only when every check holds. No browser, HTTP
 * client, Docker, or JVM. The immutable G457 H5 is read as files only.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  runObserverChecks,
  runCookieMatcherChecks,
  runAllowlistChecks,
  cookieClearDecision,
  jarFacts,
  parseClearCookie,
  summarizeClearHeaders,
  logoutCredentials,
  matchLogoutHosts,
  classify,
  knownPath,
} from '/tmp/grok-mobile-resume-h5-logout-probe-459/forbidden-h5-observer.mjs'
import {
  provePinnedH5Root,
  H5_ROOT,
  H5_INDEX_SHA,
  STATIC_QA_HEADER,
} from '/tmp/grok-mobile-resume-h5-logout-probe-459/pinned-static-nonce.mjs'

const JOB = '/tmp/grok-mobile-resume-h5-logout-probe-459'
const G457_H5 = '/tmp/grok-mobile-resume-h5-logout-live-candidate-457/OUTPUT/h5'
const B139_H5 = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const B139_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const G447_SHA = '7622ab9cc7ceeaf68fa009921bb0187232b4cc7a1dcd0913b16f560cbaf4a9d8'
const COOKIE_NAME = 'yuxuexing_refresh'
const COOKIE_PATH = '/api/v1/auth'
const LOGOUT_LABEL = '退出登录'
const ADULT_TITLE = '暂时无法开始学习'
const BANS = ['route.fulfill(', 'addCookies(', 'clearCookies(', 'addInitScript(', 'localStorage.setItem']

function fail(name, detail) {
  return { ok: false, name, detail }
}

function pass(name) {
  return { ok: true, name }
}

function shaped(headers) {
  return { headers: () => headers }
}

function read(file) {
  return fs.readFileSync(file, 'utf8')
}

function runGuards() {
  const rows = []
  const observer = read(path.join(JOB, 'forbidden-h5-observer.mjs'))
  const tail = read(path.join(JOB, 'h5-lease-tail.mjs'))
  const nonce = read(path.join(JOB, 'pinned-static-nonce.mjs'))
  const wrapper = read(path.join(JOB, 'forbidden-h5-wrapper.py'))

  rows.push(H5_ROOT === G457_H5 && H5_INDEX_SHA.length === 64 ? pass('h5-root-is-g457') : fail('h5-root-is-g457', H5_ROOT))
  rows.push(STATIC_QA_HEADER === 'x-mb004-static-qa' ? pass('nonce-header') : fail('nonce-header', STATIC_QA_HEADER))

  const proven = provePinnedH5Root(H5_ROOT, H5_INDEX_SHA)
  rows.push(proven.ok === true && proven.indexSha256 === H5_INDEX_SHA ? pass('prove-canonical-h5') : fail('prove-canonical-h5', proven.reason))
  rows.push(provePinnedH5Root(H5_ROOT, B139_SHA).ok === false ? pass('reject-b139-sha') : fail('reject-b139-sha', 'accepted'))
  rows.push(provePinnedH5Root(H5_ROOT, B116_SHA).ok === false ? pass('reject-b116-sha') : fail('reject-b116-sha', 'accepted'))
  rows.push(provePinnedH5Root(H5_ROOT, G447_SHA).ok === false ? pass('reject-g447-sha') : fail('reject-g447-sha', 'accepted'))
  const b139 = provePinnedH5Root(B139_H5, H5_INDEX_SHA)
  rows.push(b139.ok === false ? pass('reject-b139-root') : fail('reject-b139-root', 'accepted'))

  const prepared = runObserverChecks()
  rows.push(prepared.ok === true && prepared.observed === false && prepared.launched === false ? pass('observer-prepared') : fail('observer-prepared', prepared.reason))
  rows.push(runCookieMatcherChecks() ? pass('cookie-matcher') : fail('cookie-matcher', 'false'))
  rows.push(runAllowlistChecks() ? pass('allowlist') : fail('allowlist', 'false'))

  const now = Date.now()
  const live = jarFacts([{
    name: COOKIE_NAME,
    value: 'opaque',
    path: COOKIE_PATH,
    domain: '127.0.0.1',
    expires: Math.floor(now / 1000) + 3600,
    secure: true,
    httpOnly: true,
    sameSite: 'None',
    partitionKey: 'https://127.0.0.1',
  }], now)
  const absent = jarFacts([], now)
  const header = {
    readable: true,
    overHttps: true,
    ...summarizeClearHeaders([{
      name: 'Set-Cookie',
      value: 'yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned',
    }]),
  }
  const g444 = cookieClearDecision(live, { ...header, overHttps: false }, live)
  rows.push(
    g444.cookieCleared === false
      && g444.clearOverHttps === false
      && g444.storedBefore === true
      && g444.jarRemains === true
      && g444.reason === 'cookie-not-cleared'
      ? pass('g444-http-clear-jar-remains')
      : fail('g444-http-clear-jar-remains', JSON.stringify({
        cookieCleared: g444.cookieCleared,
        clearOverHttps: g444.clearOverHttps,
        storedBefore: g444.storedBefore,
        jarRemains: g444.jarRemains,
        reason: g444.reason,
      })),
  )
  const iamClear = cookieClearDecision(live, header, absent)
  rows.push(
    iamClear.cookieCleared === true
      && iamClear.clearOverHttps === true
      && iamClear.storedBefore === true
      && iamClear.jarRemains === false
      ? pass('iam-https-clear-jar-absent')
      : fail('iam-https-clear-jar-absent', iamClear.reason || 'not-cleared'),
  )
  const parsed = parseClearCookie('yuxuexing_refresh=; Path=/api/v1/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; HttpOnly; SameSite=None; Partitioned')
  rows.push(parsed.nameMatch && parsed.emptyValue && parsed.pathMatch && parsed.maxAgeZero && parsed.partitioned ? pass('clear-header-attrs') : fail('clear-header-attrs', 'mismatch'))

  const bearer = { authorization: 'Bearer opaque-token', cookie: 'yuxuexing_refresh=opaque' }
  const creds = logoutCredentials(shaped(bearer))
  rows.push(creds.authorizationBearer && creds.credentialCookie && !creds.transportHeader ? pass('logout-credentials') : fail('logout-credentials', JSON.stringify(creds)))

  const host = { tag: 'UNI-BUTTON', text: LOGOUT_LABEL, ariaDisabled: null, disabledAttr: null, disabled: false }
  const matched = matchLogoutHosts([host], LOGOUT_LABEL)
  rows.push(matched.count === 1 && matched.label === LOGOUT_LABEL ? pass('logout-host') : fail('logout-host', JSON.stringify(matched)))
  rows.push(matchLogoutHosts([{ ...host, tag: 'BUTTON', disabled: true }], LOGOUT_LABEL).count === 0 ? pass('logout-host-disabled') : fail('logout-host-disabled', 'counted'))

  const adult = classify({ title: ADULT_TITLE, description: '当前版本仅向年满18周岁的用户开放学习。你仍可管理账号或查看帮助。', hash: '#/pages/forbidden/forbidden', logout: LOGOUT_LABEL, login: '', gate: '' })
  rows.push(adult.surface === 'forbidden' && adult.title === 'adult' ? pass('classify-adult') : fail('classify-adult', JSON.stringify(adult)))
  const login = classify({ title: '', description: '', hash: '#/pages/login/login', logout: '', login: '欢迎回来', gate: '' })
  rows.push(login.surface === 'login' && login.title === 'login' ? pass('classify-login') : fail('classify-login', JSON.stringify(login)))
  rows.push(knownPath('/pages/forbidden/forbidden') === '/pages/forbidden/forbidden' ? pass('known-forbidden') : fail('known-forbidden', 'missing'))

  for (const ban of BANS) {
    const hit = observer.includes(ban) || tail.includes(ban)
    rows.push(!hit ? pass(`ban-${ban}`) : fail(`ban-${ban}`, 'present'))
  }
  rows.push(observer.includes('g459-') && observer.includes('G459!') ? pass('actor-g459') : fail('actor-g459', 'missing'))
  rows.push(!observer.includes('g457-') && !observer.includes('G457!') ? pass('actor-not-g457') : fail('actor-not-g457', 'stale-actor'))
  rows.push(observer.includes('MB005-H5-IAM-LOGOUT-459') ? pass('job-id-observer') : fail('job-id-observer', 'missing'))
  rows.push(tail.includes('MB005-H5-IAM-LOGOUT-459') ? pass('job-id-tail') : fail('job-id-tail', 'missing'))
  rows.push(tail.includes(`${JOB}/pinned-static-nonce.mjs`) && tail.includes(`${JOB}/forbidden-h5-observer.mjs`) ? pass('tail-imports-g459') : fail('tail-imports-g459', 'stale-import'))
  rows.push(!tail.includes('/tmp/grok-mobile-resume-h5-logout-live-candidate-457/pinned-static-nonce.mjs') ? pass('tail-not-g457-modules') : fail('tail-not-g457-modules', 'stale-import'))
  rows.push(wrapper.includes('MB005-H5-IAM-LOGOUT-459') && wrapper.includes('cloudstudy-mobile-h5-logout-459') ? pass('wrapper-identity') : fail('wrapper-identity', 'missing'))
  rows.push(wrapper.includes('g459-') && wrapper.includes('G459!') ? pass('wrapper-actor') : fail('wrapper-actor', 'missing'))
  rows.push(wrapper.includes('--offline-only') ? pass('wrapper-offline-flag') : fail('wrapper-offline-flag', 'missing'))
  rows.push(nonce.includes(G457_H5) && nonce.includes(H5_INDEX_SHA) ? pass('nonce-pins-g457-h5') : fail('nonce-pins-g457-h5', 'missing'))
  rows.push(observer.includes('https://127.0.0.1:18087') && observer.includes('/api/v1/auth/logout') ? pass('observer-iam-logout') : fail('observer-iam-logout', 'missing'))
  rows.push(!observer.includes('end.sessionId') && !wrapper.includes('end.sessionId') ? pass('no-guessed-session') : fail('no-guessed-session', 'present'))
  return rows
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
  const rows = runGuards()
  const failed = rows.filter((row) => row.ok !== true)
  const receipt = {
    job: 'MB005-H5-IAM-LOGOUT-459',
    status: failed.length === 0 ? 'OFFLINE' : 'FAILED',
    live: 'NOT_RUN',
    observed: false,
    launched: false,
    count: rows.length,
    passed: rows.filter((row) => row.ok).length,
    failed: failed.map((row) => row.name),
    h5Root: H5_ROOT,
    indexSha256: H5_INDEX_SHA,
  }
  process.stdout.write(`${JSON.stringify(receipt)}\n`)
  process.exit(failed.length === 0 ? 0 : 1)
}

export { runGuards }
