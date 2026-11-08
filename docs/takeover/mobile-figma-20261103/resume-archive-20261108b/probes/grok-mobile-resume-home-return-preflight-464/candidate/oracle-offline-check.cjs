'use strict'

/**
 * Offline checks for the G464 candidate. Decision rules are the G454 oracle.
 * No browser, Docker, Java, Git, or listener.
 * Does not rewrite the G405 receipt or the G454 failure artifacts.
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { decideHomeReturn, hashPath, originalG405Decision, ENTRY_PATH, HOME_ALIAS } = require('./oracle.cjs')

const ACTUAL = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/home-405-ready-root/home-return-receipt.json'
const H5 = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const STAGED = '/tmp/grok-mobile-resume-home-405/staged-harness'
const STAGED_SHA = {
  'acceptance-learner-target.mjs': '3fd052ee1e0482d37bc992565c245b0f256f41e967245c598c84ef895276ce86',
  'browser-target-probe.cjs': 'b2736bdc0db251af44217f143fe242a32f9fe1c643dd64b718a73430a5162754',
  'full-browser-owner.mjs': '8453b6b68805a89401f123f0d9216c5835531dd0726462d7a67052d5ed7a8885',
  'learner-target-probe.mjs': '08cb0bff2f1d5a7773c18cd9531bdf02809dc440a5e05c620283895821cfd5c2',
  'learning-plan-ensure.mjs': '3988fa963a049b4d4393f54630a790de91cb443f3b1118a2e9b78f71b04f7fac',
  'placement-start-read.mjs': '60c716290f184d24a7dd0f0957a3719593e0d9f44f10253d2959a7d27c2dbbea',
  'process_guard.py': '0cd650b637208940f6c82ec4dc1228df5a576913445aa6f9772a5f232f351068',
  'seed/Seed.java': 'fde6075e353fec4e12385e6e66bc1a74cece280289210adea9906c99cfa3cb9a',
  'sql/cleanup-fixtures.sql': '57c586ba0eb70ccfaf7d4463edcb570303d96e320a07dcca40a822a725e004d4',
  'sql/seed-full.sql': 'c507b3fe1c8078700e177d4a168619e69c1c5f7136243e6a98f72d412403fbd9',
  'sql/seed-partial.sql': '3ae0a3d00c0dd0578497872714a1db60bd4536fc6e800d6449058acdd9615216',
}

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function assert(id, ok, detail) {
  if (!ok) {
    const body = { id, ok: false, detail: detail || null }
    process.stderr.write(`${JSON.stringify(body)}\n`)
    process.exit(2)
  }
  return { id, ok: true }
}

function withProof(base, patch) {
  return {
    ...base,
    job: 'MB464_FRESH_ACTOR_HOME_RETURN',
    status: 'FAILED',
    reason: null,
    hashStable: true,
    hashSamples: [ENTRY_PATH, ENTRY_PATH, ENTRY_PATH],
    entry: {
      count: 1,
      path: ENTRY_PATH,
      alias: HOME_ALIAS,
      isTabBar: true,
      tabBarIndex: 0,
      titleText: '学习',
    },
    entryPath: ENTRY_PATH,
    pageRoute: 'pages/home/home',
    homeVisible: true,
    loginVisible: false,
    leftLogin: true,
    ...patch,
  }
}

const before = sha(ACTUAL)
const actual = JSON.parse(fs.readFileSync(ACTUAL, 'utf8'))
const checks = []
checks.push(assert('g405.preserved-fail', actual.status === 'FAILED' && actual.reason === 'final-hash' && actual.finalHash === '/' && actual.home && actual.home.state === 'READY' && actual.home.planVersion === 2 && actual.home.planVersionMatch === true && actual.loginCount === 1 && actual.homeCount === 1))
const original = originalG405Decision(actual)
checks.push(assert('g405.original-rule', original.status === 'FAILED' && original.reason === 'final-hash', original))
const upgraded = decideHomeReturn(actual)
checks.push(assert('g405.not-upgraded', upgraded.status === 'FAILED' && upgraded.reason === 'entry-proof-missing' && upgraded.status !== 'OBSERVED', upgraded))

const ready = withProof(actual, { finalHash: ENTRY_PATH })
const passed = decideHomeReturn(ready)
checks.push(assert('synthetic.entry-home', passed.status === 'OBSERVED' && passed.reason == null, passed))

const alias = decideHomeReturn(withProof(actual, { finalHash: HOME_ALIAS, hashSamples: [HOME_ALIAS, HOME_ALIAS, HOME_ALIAS] }))
checks.push(assert('synthetic.alias-rejected', alias.status === 'FAILED' && alias.reason === 'hash-not-entry-path', alias))

const onboarding = decideHomeReturn(withProof(actual, { finalHash: '/pages/onboarding/onboarding', hashSamples: ['/pages/onboarding/onboarding', '/pages/onboarding/onboarding', '/pages/onboarding/onboarding'] }))
checks.push(assert('synthetic.onboarding', onboarding.reason === 'landed-onboarding', onboarding))

const today = decideHomeReturn(withProof(actual, { finalHash: '/pages/today/today', hashSamples: ['/pages/today/today', '/pages/today/today', '/pages/today/today'] }))
checks.push(assert('synthetic.today', today.reason === 'landed-today', today))

const unstable = decideHomeReturn(withProof(actual, { hashStable: false, hashSamples: [ENTRY_PATH, HOME_ALIAS, ENTRY_PATH] }))
checks.push(assert('synthetic.unstable', unstable.reason === 'hash-unstable', unstable))

const hidden = decideHomeReturn(withProof(actual, { homeVisible: false }))
checks.push(assert('synthetic.hidden-home', hidden.reason === 'home-not-visible', hidden))

const wrongRoute = decideHomeReturn(withProof(actual, { pageRoute: 'pages/today/today' }))
checks.push(assert('synthetic.page-route', wrongRoute.reason === 'page-route', wrongRoute))

const notReady = decideHomeReturn(withProof(actual, { home: { ...actual.home, state: 'NOT_READY', blocker: 'PLACEMENT_REQUIRED', planVersionMatch: false } }))
checks.push(assert('synthetic.placement-required', notReady.reason === 'placement-required', notReady))

const version = decideHomeReturn(withProof(actual, { home: { ...actual.home, planVersion: 9, planVersionMatch: false } }))
checks.push(assert('synthetic.version', version.reason === 'plan-version-mismatch', version))

checks.push(assert('hash.slash', hashPath('http://127.0.0.1:18183/#/') === ENTRY_PATH))
checks.push(assert('hash.alias', hashPath('http://127.0.0.1:18183/#/pages/home/home') === HOME_ALIAS))
checks.push(assert('hash.constructed', hashPath(`http://127.0.0.1:18183/${'#/'}`) === ENTRY_PATH))

const indexSha = sha(path.join(H5, 'index.html'))
checks.push(assert('h5.index', indexSha === INDEX_SHA, { indexSha }))
const routeFile = fs.readFileSync(path.join(H5, 'assets/index-CyPYQAYX.js'), 'utf8')
checks.push(assert('h5.route', routeFile.includes('path:"/",alias:"/pages/home/home"') && routeFile.includes('isEntry:!0') && routeFile.includes('isTabBar:!0') && routeFile.includes('tabBarIndex:0') && routeFile.includes('titleText:"学习"')))
const runtimeFile = fs.readFileSync(path.join(H5, 'assets/_plugin-vue_export-helper.B5ssqoSF.js'), 'utf8')
checks.push(assert('h5.rewrite', runtimeFile.includes('a.meta.isEntry&&(n=n.replace(a.alias,"/"))')))
const gatewayFile = fs.readFileSync(path.join(H5, 'assets/gateway.CdAddI9b.js'), 'utf8')
checks.push(assert('h5.switchTab', gatewayFile.includes('return n.switchTab({url:o})') && gatewayFile.includes('"/pages/home/home"')))
const homeJs = fs.readFileSync(path.join(H5, 'assets/pages-home-home.CUSHTSq3.js'), 'utf8')
const todayJs = fs.readFileSync(path.join(H5, 'assets/pages-today-today.Ekm60u9Y.js'), 'utf8')
const learnJs = fs.readFileSync(path.join(H5, 'assets/pages-learn-learn.CDJVev45.js'), 'utf8')
checks.push(assert('h5.home-marker', homeJs.includes('home-page') && homeJs.includes('home-title') && !todayJs.includes('home-page') && !learnJs.includes('home-page')))
const loginJs = fs.readFileSync(path.join(H5, 'assets/pages-login-login.CtHiC6sh.js'), 'utf8')
checks.push(assert('h5.login-continue', loginJs.includes('consumeReturnTo') && loginJs.includes('/pages/home/home')))

for (const [name, digest] of Object.entries(STAGED_SHA)) {
  const actualDigest = sha(path.join(STAGED, name))
  checks.push(assert(`staged.${name}`, actualDigest === digest, { actualDigest }))
}
const acceptance = fs.readFileSync(path.join(STAGED, 'acceptance-learner-target.mjs'), 'utf8')
checks.push(assert('identity.mint', acceptance.includes('const identifier = `mb004-${ctx.runId}@example.invalid`') && acceptance.includes('crypto.randomBytes(24)')))

const after = sha(ACTUAL)
checks.push(assert('g405.receipt-unchanged', before === after))

const summary = {
  status: 'OFFLINE_PASS',
  checks: checks.length,
  g405: { status: actual.status, reason: actual.reason, finalHash: actual.finalHash, homeState: actual.home.state, planVersion: actual.home.planVersion },
  originalRule: original,
  newRuleOnHistoricalReceipt: upgraded,
  syntheticEntryPass: passed.status,
  aliasRejected: alias.reason,
  indexSha256: indexSha,
}
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
