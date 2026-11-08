/**
 * Stage-only proof for the G464 rebound closure.
 * Reads files, imports the harness modules, and rejects bad wrapper arguments.
 * Does not open a database, browser, socket listener, Docker container, or actor.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const OUT = '/tmp/grok-mobile-resume-home-return-preflight-464'
const CANDIDATE = path.join(OUT, 'candidate')
const HARNESS = path.join(OUT, 'staged-harness')
const SOURCE_HARNESS = '/tmp/grok-mobile-resume-home-405/staged-harness'
const SOURCE_CANDIDATE = '/tmp/grok-mobile-resume-home-return-diagnosis-454/candidate'
const OLD_PATH = '/private/tmp/grok-mobile-resume-home-405/run'
const NEW_PATH = '/private/tmp/grok-mobile-resume-home-return-464/run'
const RETEST_PATH = '/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run'
const PATH_454 = '/private/tmp/grok-mobile-resume-home-return-454/run'
const SCRATCH = '/private/tmp/grok-g464-stage-reject'
const RUN_DIR = NEW_PATH
const OLD_BUF = Buffer.from(OLD_PATH)
const NEW_BUF = Buffer.from(NEW_PATH)
const RETEST_BUF = Buffer.from(RETEST_PATH)

const PINS = JSON.parse(fs.readFileSync(path.join(CANDIDATE, 'pins.json'), 'utf8'))
const H5 = PINS.h5.root
const INDEX_SHA = PINS.h5.indexSha256
const checks = []

const EXTERNAL = {
  g405Receipt: '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108/home-405-ready-root/home-return-receipt.json',
  g454Exit: '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108b/home-454-root/EXIT.json',
  g454Result: '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108b/home-454-root/result.json',
  g454Release: '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261108b/home-454-root/INDEPENDENT-RELEASE.json',
  g454Runner: '/private/tmp/grok-mobile-resume-home-return-454/run/runner.log',
}

const UNCHANGED_SHA = {
  'browser-target-probe.cjs': 'b2736bdc0db251af44217f143fe242a32f9fe1c643dd64b718a73430a5162754',
  'learning-plan-ensure.mjs': '3988fa963a049b4d4393f54630a790de91cb443f3b1118a2e9b78f71b04f7fac',
  'placement-start-read.mjs': '60c716290f184d24a7dd0f0957a3719593e0d9f44f10253d2959a7d27c2dbbea',
  'process_guard.py': '0cd650b637208940f6c82ec4dc1228df5a576913445aa6f9772a5f232f351068',
  'seed/Seed.java': 'fde6075e353fec4e12385e6e66bc1a74cece280289210adea9906c99cfa3cb9a',
  'sql/cleanup-fixtures.sql': '57c586ba0eb70ccfaf7d4463edcb570303d96e320a07dcca40a822a725e004d4',
  'sql/seed-full.sql': 'c507b3fe1c8078700e177d4a168619e69c1c5f7136243e6a98f72d412403fbd9',
  'sql/seed-partial.sql': '3ae0a3d00c0dd0578497872714a1db60bd4536fc6e800d6449058acdd9615216',
}

const OWNER_EXPORTS = [
  'FULL_BROWSER_OPT_IN', 'FULL_BROWSER_ROOT_ARTIFACT_DIR', 'FULL_SCENARIO',
  'RETEST_CONTINUATION_OPT_IN', 'RETEST_CONTINUATION_ROOT', 'RETEST_H5_DIRECTORY',
  'RETEST_H5_INDEX_SHA256', 'RETEST_SCENARIO', 'callbackOptions', 'fullBrowserEnabled',
  'judgeFullBrowser', 'observerFullScenarioMet', 'projectFullObserver', 'provenFullArtifact',
  'retestContinuationEnabled', 'serviceFacts', 'withFullBrowserServices',
]
const PLACEMENT_EXPORTS = [
  'ASSESSMENT_JAR_SHA256', 'CONTENT_JAR_SHA256', 'FULL_BROWSER_OPT_IN', 'OPT_IN',
  'PLACEMENT_BROWSER_OPT_IN', 'runPlacementStartRead', 'validatePlacementLaunch',
  'withFullBrowserServices', 'withPlacementBrowserServices',
]
const LEARNING_EXPORTS = [
  'CALL_BUDGET', 'CANONICAL_CONTENT_LOCALE', 'LEARNING_JAR_SHA256', 'OPT_IN',
  'assertFullLearningPreconditions', 'learningPlanEnabled', 'runLearningPlanEnsure',
  'startOwnedLearningJvm', 'validateLearningPlanLaunch',
]
const PROBE_EXPORTS = ['PLACEMENT_BROWSER_ROOT_ARTIFACT_DIR', 'runLearnerTargetProbe']
const BROWSER_EXPORTS = ['runConsentBrowserSmoke', 'runTargetBrowser']

function cleanup() {
  fs.rmSync(SCRATCH, { recursive: true, force: true })
}

function assert(id, ok, detail) {
  if (!ok) {
    cleanup()
    process.stderr.write(`${JSON.stringify({ id, ok: false, detail: detail ?? null })}\n`)
    process.exit(2)
  }
  checks.push({ id, ok: true })
}

function shaFile(file) {
  const listed = fs.lstatSync(file)
  if (listed.isSymbolicLink() || !listed.isFile()) throw new Error(`not a regular file: ${file}`)
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function countBuf(buf, needle) {
  let n = 0
  let from = 0
  while (from <= buf.length) {
    const at = buf.indexOf(needle, from)
    if (at < 0) return n
    n += 1
    from = at + needle.length
  }
  return n
}

function replaced(buf) {
  const parts = []
  let from = 0
  while (from <= buf.length) {
    const at = buf.indexOf(OLD_BUF, from)
    if (at < 0) {
      parts.push(buf.subarray(from))
      break
    }
    parts.push(buf.subarray(from, at))
    parts.push(NEW_BUF)
    from = at + OLD_BUF.length
  }
  return Buffer.concat(parts)
}

function walk(root) {
  const found = []
  const visit = (dir) => {
    for (const name of fs.readdirSync(dir).sort()) {
      const full = path.join(dir, name)
      const listed = fs.lstatSync(full)
      if (listed.isSymbolicLink()) throw new Error(`symlink in closure: ${full}`)
      if (listed.isDirectory()) visit(full)
      else found.push(path.relative(root, full))
    }
  }
  visit(root)
  return found
}

function snapshotRun() {
  if (!fs.existsSync(RUN_DIR)) return { exists: false }
  const listed = fs.lstatSync(RUN_DIR)
  return {
    exists: true,
    symlink: listed.isSymbolicLink(),
    names: listed.isDirectory() && !listed.isSymbolicLink() ? fs.readdirSync(RUN_DIR).sort() : null,
  }
}

function baseEnv(extra = {}) {
  return {
    PATH: process.env.PATH,
    HOME: process.env.HOME || '/var/empty',
    TMPDIR: '/tmp',
    LANG: 'C',
    NODE_OPTIONS: '',
    ...extra,
  }
}

function runBash(args, env) {
  if (env.G464_ROOT_LEASE === 'YES_RUN_G464_HOME_RETURN' && args.includes(NEW_PATH)) {
    throw new Error('stage mode refuses to lease the canonical run directory')
  }
  const result = spawnSync('bash', args, { env, encoding: 'utf8', timeout: 8000 })
  return {
    status: result.status,
    signal: result.signal || null,
    out: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  }
}

function keysOf(mod) {
  return Object.keys(mod).sort()
}

delete process.env.MB006_PLACEMENT_RETEST_CONTINUATION
process.env.MB006_FULL_BROWSER_ARTIFACT = H5
process.env.MB006_FULL_BROWSER_INDEX_SHA256 = INDEX_SHA

const externalBefore = Object.fromEntries(Object.entries(EXTERNAL).map(([id, file]) => [id, shaFile(file)]))
const runBefore = snapshotRun()
const wrapper = fs.readFileSync(path.join(CANDIDATE, 'wrapper.sh'), 'utf8')
const guardAt = wrapper.indexOf('# G464_PATH_GUARD_END')
const gitAt = wrapper.indexOf('git -C')
const dockerAt = wrapper.indexOf('docker run')
const stageAt = wrapper.indexOf("'--stage-only'")
const leaseAt = wrapper.indexOf('G464_ROOT_LEASE')

try {
  assert('pins.runDir', PINS.runDir === NEW_PATH && PINS.stagedHarness === HARNESS && PINS.job === 'MB464_FRESH_ACTOR_HOME_RETURN')
  assert('pins.identity', PINS.container === 'cloudstudy-mobile-home-return-464-20261108' && PINS.label === 'cloudstudy.qa.mobile-home-return-464-20261108' && PINS.retestContinuation === false)
  assert('wrapper.order', stageAt > 0 && leaseAt > stageAt && guardAt > leaseAt && gitAt > guardAt && dockerAt > gitAt, { stageAt, leaseAt, guardAt, gitAt, dockerAt })
  assert('wrapper.pin', wrapper.includes(`qa_pinned_source='${HARNESS}'`) && !wrapper.includes("qa_pinned_source='/tmp/grok-mobile-resume-home-405/staged-harness'"))
  assert('wrapper.root', wrapper.includes(`qa_run_root='${NEW_PATH}'`) && wrapper.includes(`qa_out="\${3:-${NEW_PATH}}"`) && wrapper.includes('MB033_RUN_DIRECTORY="$qa_out"'))
  assert('wrapper.optin', wrapper.includes("G464_ROOT_LEASE:-}") && wrapper.includes('YES_RUN_G464_HOME_RETURN') && wrapper.includes('MB464_HOME_RETURN=YES_ONE_FRESH_ACTOR_HOME_RETURN'))
  assert('wrapper.refuse-paths', ['cannot reuse the G405', 'cannot reuse the G454', 'must not be a symlink', 'exact canonical path'].every((item) => wrapper.includes(item)))
  assert('wrapper.no-rebind-tool', !wrapper.includes('pin-rebind'))
  assert('wrapper.preserved-budget', wrapper.includes('assessment_responses\\t10') && wrapper.includes('$2==10 && $3==1 && $4==$2') && wrapper.includes('node "$here/oracle-live-gate.cjs"'))
  assert('wrapper.preserved-pins', [
    "qa_head='61b9ede7c65ef065c76c846c27fb69a52cd042cd'",
    "qa_learner_sha='62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733'",
    "qa_learning_sha='5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f'",
    "qa_content_sha='852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'",
    "qa_assessment_sha='467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'",
    "qa_b139_sha='706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'",
    '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520',
  ].every((item) => wrapper.includes(item)))

  const sourceFiles = walk(SOURCE_HARNESS)
  const copyFiles = walk(HARNESS)
  assert('harness.file-set', JSON.stringify(sourceFiles) === JSON.stringify(copyFiles), { sourceFiles, copyFiles })
  const manifestFiles = []
  let oldBefore = 0
  let oldAfter = 0
  let newAfter = 0
  let retestBefore = 0
  let retestAfter = 0
  for (const rel of sourceFiles) {
    const before = fs.readFileSync(path.join(SOURCE_HARNESS, rel))
    const after = fs.readFileSync(path.join(HARNESS, rel))
    const expected = replaced(before)
    const beforeOld = countBuf(before, OLD_BUF)
    const afterOld = countBuf(after, OLD_BUF)
    const afterNew = countBuf(after, NEW_BUF)
    const beforeRetest = countBuf(before, RETEST_BUF)
    const afterRetest = countBuf(after, RETEST_BUF)
    oldBefore += beforeOld
    oldAfter += afterOld
    newAfter += afterNew
    retestBefore += beforeRetest
    retestAfter += afterRetest
    assert(`rebind.${rel}`, after.equals(expected) && afterOld === 0 && afterNew === beforeOld && afterRetest === beforeRetest, {
      beforeOld, afterOld, afterNew, beforeRetest, afterRetest,
    })
    manifestFiles.push({
      file: rel,
      beforeSha256: shaFile(path.join(SOURCE_HARNESS, rel)),
      afterSha256: shaFile(path.join(HARNESS, rel)),
      oldPathBefore: beforeOld,
      oldPathAfter: afterOld,
      newPathAfter: afterNew,
      retestPathBefore: beforeRetest,
      retestPathAfter: afterRetest,
      changed: !after.equals(before),
    })
  }
  assert('cardinality.total', oldBefore === 4 && oldAfter === 0 && newAfter === 4 && retestBefore === retestAfter, {
    oldBefore, oldAfter, newAfter, retestBefore, retestAfter,
  })
  const changed = manifestFiles.filter((row) => row.changed).map((row) => row.file).sort()
  assert('cardinality.files', JSON.stringify(changed) === JSON.stringify([
    'acceptance-learner-target.mjs', 'full-browser-owner.mjs', 'learner-target-probe.mjs',
  ]), { changed })
  for (const [rel, digest] of Object.entries(UNCHANGED_SHA)) {
    assert(`unchanged.${rel}`, shaFile(path.join(SOURCE_HARNESS, rel)) === digest && shaFile(path.join(HARNESS, rel)) === digest)
  }

  const acceptance = fs.readFileSync(path.join(HARNESS, 'acceptance-learner-target.mjs'), 'utf8')
  const ownerText = fs.readFileSync(path.join(HARNESS, 'full-browser-owner.mjs'), 'utf8')
  const probeText = fs.readFileSync(path.join(HARNESS, 'learner-target-probe.mjs'), 'utf8')
  const placementText = fs.readFileSync(path.join(HARNESS, 'placement-start-read.mjs'), 'utf8')
  const learningText = fs.readFileSync(path.join(HARNESS, 'learning-plan-ensure.mjs'), 'utf8')
  const browserText = fs.readFileSync(path.join(HARNESS, 'browser-target-probe.cjs'), 'utf8')
  const literal = acceptance.match(/const expectedLiteral = retestOn\n +\? '([^']+)'\n +: '([^']+)'/)
  assert('acceptance.expectedLiteral', Boolean(literal) && literal[1] === RETEST_PATH && literal[2] === NEW_PATH, { literal })
  assert('acceptance.markdown', acceptance.includes(`\`MB033_RUN_DIRECTORY\` is \`${RETEST_PATH}\`.`) && acceptance.includes(`\`MB033_RUN_DIRECTORY\` is \`${NEW_PATH}\`.`))
  assert('acceptance.nofallback', acceptance.includes('MB033_RUN_DIRECTORY must be the exact root artifact directory for the selected mode; no fallback'))
  assert('acceptance.private', acceptance.includes('targetConfigMust((fs.statSync(runDir).mode & 0o077) === 0'))
  assert('acceptance.symlink', acceptance.includes('!listed.isSymbolicLink() && listed.isDirectory() && fs.realpathSync(runDir) === runDir'))
  assert('acceptance.callback-keys', acceptance.includes("['full', 'fullArtifact', 'fullIndexSha']") && acceptance.includes("['full', 'fullArtifact', 'fullIndexSha', 'retestContinuation']"))
  assert('acceptance.identity', acceptance.includes('const identifier = `mb004-${ctx.runId}@example.invalid`') && acceptance.includes('crypto.randomBytes(24)'))
  assert('owner.historical', ownerText.includes(`const HISTORICAL_FULL_BROWSER_ROOT = '${NEW_PATH}'`) && ownerText.includes(`export const RETEST_CONTINUATION_ROOT = '${RETEST_PATH}'`))
  assert('owner.rules', ownerText.includes('expectations.targetPutCount !== 1') && ownerText.includes('full.responseCount !== 10') && ownerText.includes('full.planEnsureCount !== 1') && ownerText.includes('full.retestWrites !== 0'))
  assert('probe.const', probeText.includes(`const FULL_BROWSER_ROOT_ARTIFACT_DIR = '${NEW_PATH}'`) && !probeText.includes('export const FULL_BROWSER_ROOT_ARTIFACT_DIR'))
  assert('probe.guard', probeText.includes('runDirectory must be the exact root artifact directory for the selected mode; no fallback') && probeText.includes('function fullBrowserRootDirectory()'))
  assert('signatures.placement', [
    'export async function validatePlacementLaunch({ phase, gatewayJar, browser = false, fullLearning = false } = {})',
    'export async function runPlacementStartRead(input = {})',
    'export async function withPlacementBrowserServices(input = {}, task)',
    'export async function withFullBrowserServices(input = {}, task)',
  ].every((item) => placementText.includes(item)))
  assert('signatures.learning', [
    'export function learningPlanEnabled()',
    'export async function validateLearningPlanLaunch({ phase, gatewayJar } = {})',
    'export async function assertFullLearningPreconditions({ gatewayJar } = {})',
    'export async function startOwnedLearningJvm(input = {})',
    'export async function runLearningPlanEnsure(input = {})',
  ].every((item) => learningText.includes(item)))
  assert('signatures.browser', browserText.includes('async function runTargetBrowser({ identifier, password, caPem, outDir, placement = false, placementArtifact, placementIndexSha, full = false, fullArtifact, fullIndexSha, retestContinuation = false })') && browserText.includes('module.exports = { runConsentBrowserSmoke, runTargetBrowser }'))

  const oracleNow = fs.readFileSync(path.join(CANDIDATE, 'oracle.cjs'), 'utf8')
  const oracleWas = fs.readFileSync(path.join(SOURCE_CANDIDATE, 'oracle.cjs'), 'utf8')
  const oracleMark = 'const HOME_ALIAS'
  assert('oracle.rules-unchanged', oracleNow.slice(oracleNow.indexOf(oracleMark)) === oracleWas.slice(oracleWas.indexOf(oracleMark)))
  const offlineNow = fs.readFileSync(path.join(CANDIDATE, 'oracle-offline-check.cjs'), 'utf8')
  const offlineWas = fs.readFileSync(path.join(SOURCE_CANDIDATE, 'oracle-offline-check.cjs'), 'utf8')
  const offlineMark = 'const ACTUAL = '
  assert('offline.rules-unchanged', offlineNow.slice(offlineNow.indexOf(offlineMark)) === offlineWas.slice(offlineWas.indexOf(offlineMark)).replaceAll('MB454_FRESH_ACTOR_HOME_RETURN', 'MB464_FRESH_ACTOR_HOME_RETURN'))
  const gateNow = fs.readFileSync(path.join(CANDIDATE, 'oracle-live-gate.cjs'), 'utf8')
  const gateWas = fs.readFileSync(path.join(SOURCE_CANDIDATE, 'oracle-live-gate.cjs'), 'utf8')
  assert('gate.identity-only', gateNow === gateWas.replaceAll('G454_', 'G464_').replaceAll('MB454_', 'MB464_'))
  const observerNow = fs.readFileSync(path.join(CANDIDATE, 'home-return-observer.cjs'), 'utf8')
  const observerWas = fs.readFileSync(path.join(SOURCE_CANDIDATE, 'home-return-observer.cjs'), 'utf8')
  const normObserver = (text) => text.replaceAll('MB464_', 'MB454_').replaceAll('G464 fresh-actor', 'G454 fresh-actor').replaceAll('The 464 hook', 'The 454 hook')
  assert('observer.identity-only', normObserver(observerNow) === observerWas)
  assert('observer.budget', observerNow.includes('full.responseCount !== 10') && observerNow.includes('full.planEnsureCount !== 1') && observerNow.includes("reason: 'retest-env-forbidden'"))
  const hookNow = fs.readFileSync(path.join(CANDIDATE, 'home-return-hook.cjs'), 'utf8')
  const hookWas = fs.readFileSync(path.join(SOURCE_CANDIDATE, 'home-return-hook.cjs'), 'utf8')
  const normHook = (text) => text.replaceAll('the 464 home-return', 'the 454 home-return').replaceAll('The 464 wrapper', 'The 454 wrapper').replaceAll('MB464_', 'MB454_')
  assert('hook.identity-only', normHook(hookNow) === hookWas && hookNow.includes('module.exports = { wrap }') && hookNow.includes('observer.afterPlacementJourney'))

  const owner = await import(pathToFileURL(path.join(HARNESS, 'full-browser-owner.mjs')).href)
  const placement = await import(pathToFileURL(path.join(HARNESS, 'placement-start-read.mjs')).href)
  const learning = await import(pathToFileURL(path.join(HARNESS, 'learning-plan-ensure.mjs')).href)
  const probe = await import(pathToFileURL(path.join(HARNESS, 'learner-target-probe.mjs')).href)
  const browser = require(path.join(HARNESS, 'browser-target-probe.cjs'))
  assert('exports.owner', JSON.stringify(keysOf(owner)) === JSON.stringify(OWNER_EXPORTS), { actual: keysOf(owner) })
  assert('exports.placement', JSON.stringify(keysOf(placement)) === JSON.stringify(PLACEMENT_EXPORTS), { actual: keysOf(placement) })
  assert('exports.learning', JSON.stringify(keysOf(learning)) === JSON.stringify(LEARNING_EXPORTS), { actual: keysOf(learning) })
  assert('exports.probe', JSON.stringify(keysOf(probe)) === JSON.stringify(PROBE_EXPORTS) && !Object.hasOwn(probe, 'FULL_BROWSER_ROOT_ARTIFACT_DIR'), { actual: keysOf(probe) })
  assert('exports.browser', JSON.stringify(keysOf(browser)) === JSON.stringify(BROWSER_EXPORTS) && typeof browser.runTargetBrowser === 'function', { actual: keysOf(browser) })
  assert('exports.values', owner.FULL_BROWSER_OPT_IN === 'MB006_PLACEMENT_FULL_BROWSER'
    && owner.FULL_BROWSER_OPT_IN === placement.FULL_BROWSER_OPT_IN
    && owner.RETEST_CONTINUATION_OPT_IN === 'MB006_PLACEMENT_RETEST_CONTINUATION'
    && owner.RETEST_CONTINUATION_ROOT === RETEST_PATH
    && owner.FULL_SCENARIO === 'H5_PLACEMENT_ANSWERS_ENSURE_TODAY'
    && owner.FULL_BROWSER_ROOT_ARTIFACT_DIR === NEW_PATH
    && owner.retestContinuationEnabled() === false
    && placement.OPT_IN === 'YES_RUN_MB006_PLACEMENT_START_READ'
    && placement.CONTENT_JAR_SHA256 === '852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
    && placement.ASSESSMENT_JAR_SHA256 === '467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'
    && learning.OPT_IN === 'YES_RUN_MB007_LEARNING_PLAN_ENSURE'
    && learning.LEARNING_JAR_SHA256 === '5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f'
    && learning.CALL_BUDGET === 3
    && learning.CANONICAL_CONTENT_LOCALE === 'en-US'
    && typeof owner.callbackOptions === 'function'
    && typeof owner.provenFullArtifact === 'function'
    && typeof owner.withFullBrowserServices === 'function'
    && typeof placement.withFullBrowserServices === 'function'
    && typeof learning.runLearningPlanEnsure === 'function'
    && typeof probe.runLearnerTargetProbe === 'function')
  const proven = owner.provenFullArtifact()
  const callback = owner.callbackOptions()
  const callbackKeys = Object.keys(callback)
  assert('callback.shape', JSON.stringify(callbackKeys) === JSON.stringify(['full', 'fullArtifact', 'fullIndexSha'])
    && callback.full === true
    && callback.fullArtifact === proven.artifact
    && callback.fullArtifact === H5
    && callback.fullIndexSha === proven.indexSha
    && callback.fullIndexSha === INDEX_SHA
    && !Object.hasOwn(callback, 'retestContinuation'), { callbackKeys, artifact: callback.fullArtifact, indexSha: callback.fullIndexSha })
  assert('modules.beside', [
    'placement-start-read.mjs', 'learning-plan-ensure.mjs', 'full-browser-owner.mjs',
    'learner-target-probe.mjs', 'browser-target-probe.cjs', 'acceptance-learner-target.mjs',
  ].every((name) => {
    const listed = fs.lstatSync(path.join(HARNESS, name))
    return listed.isFile() && !listed.isSymbolicLink()
  }))
  assert('agreement.root', owner.FULL_BROWSER_ROOT_ARTIFACT_DIR === literal[2]
    && literal[2] === NEW_PATH
    && probeText.includes(`const FULL_BROWSER_ROOT_ARTIFACT_DIR = '${owner.FULL_BROWSER_ROOT_ARTIFACT_DIR}'`)
    && owner.FULL_BROWSER_ROOT_ARTIFACT_DIR !== OLD_PATH
    && owner.FULL_BROWSER_ROOT_ARTIFACT_DIR !== PATH_454
    && owner.FULL_BROWSER_ROOT_ARTIFACT_DIR !== RETEST_PATH
    && owner.FULL_BROWSER_ROOT_ARTIFACT_DIR !== '/tmp/not-the-g464-run')

  const retestChild = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const mod = await import(process.env.G464_OWNER_URL)
    if (mod.retestContinuationEnabled() !== true) process.exit(3)
    if (mod.FULL_BROWSER_ROOT_ARTIFACT_DIR !== mod.RETEST_CONTINUATION_ROOT) process.exit(4)
    if (mod.FULL_BROWSER_ROOT_ARTIFACT_DIR !== ${JSON.stringify(RETEST_PATH)}) process.exit(5)
    process.stdout.write('RETEST_BRANCH_STILL_372\\n')
  `], {
    env: baseEnv({
      G464_OWNER_URL: pathToFileURL(path.join(HARNESS, 'full-browser-owner.mjs')).href,
      MB006_PLACEMENT_RETEST_CONTINUATION: 'MB006_PLACEMENT_RETEST_CONTINUATION',
    }),
    encoding: 'utf8',
    timeout: 8000,
  })
  assert('retest.branch-preserved', retestChild.status === 0 && (retestChild.stdout || '').includes('RETEST_BRANCH_STILL_372'), {
    status: retestChild.status, out: `${retestChild.stdout || ''}${retestChild.stderr || ''}`.trim(),
  })

  cleanup()
  fs.mkdirSync(path.join(SCRATCH, 'real'), { recursive: true, mode: 0o700 })
  fs.chmodSync(path.join(SCRATCH, 'real'), 0o700)
  fs.mkdirSync(path.join(SCRATCH, 'arbitrary'), { recursive: true, mode: 0o700 })
  fs.chmodSync(path.join(SCRATCH, 'arbitrary'), 0o700)
  fs.mkdirSync(path.join(SCRATCH, 'wide'), { recursive: true, mode: 0o700 })
  fs.chmodSync(path.join(SCRATCH, 'wide'), 0o777)
  fs.symlinkSync(path.join(SCRATCH, 'real'), path.join(SCRATCH, 'link'))
  const predicate = (dir) => {
    const listed = fs.lstatSync(dir)
    return {
      privateMode: (fs.statSync(dir).mode & 0o077) === 0,
      canonical: !listed.isSymbolicLink() && listed.isDirectory() && fs.realpathSync(dir) === path.resolve(dir),
    }
  }
  const wide = predicate(path.join(SCRATCH, 'wide'))
  const arbitrary = predicate(path.join(SCRATCH, 'arbitrary'))
  const link = predicate(path.join(SCRATCH, 'link'))
  assert('predicate.private', wide.privateMode === false && arbitrary.privateMode === true && arbitrary.canonical === true)
  assert('predicate.symlink', link.canonical === false && fs.lstatSync(path.join(SCRATCH, 'link')).isSymbolicLink())
  assert('predicate.path', path.join(SCRATCH, 'arbitrary') !== NEW_PATH && OLD_PATH !== NEW_PATH && PATH_454 !== NEW_PATH)

  const checkTargets = [
    ...walk(CANDIDATE).filter((rel) => rel.endsWith('.cjs') || rel.endsWith('.mjs')).map((rel) => path.join(CANDIDATE, rel)),
    ...walk(HARNESS).filter((rel) => rel.endsWith('.cjs') || rel.endsWith('.mjs')).map((rel) => path.join(HARNESS, rel)),
  ]
  for (const file of checkTargets) {
    const parsed = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 8000 })
    assert(`syntax.${path.relative(OUT, file)}`, parsed.status === 0, { status: parsed.status, err: parsed.stderr })
  }
  const bashN = spawnSync('bash', ['-n', path.join(CANDIDATE, 'wrapper.sh')], { encoding: 'utf8', timeout: 8000 })
  assert('syntax.wrapper', bashN.status === 0, { status: bashN.status, err: bashN.stderr })

  const wrapperPath = path.join(CANDIDATE, 'wrapper.sh')
  const fakeRepo = path.join(SCRATCH, 'not-a-repo')
  const arbitraryDir = path.join(SCRATCH, 'arbitrary')
  const linkDir = path.join(SCRATCH, 'link')
  const rejections = []
  const cases = [
    {
      id: 'reject.missing-optin',
      args: [wrapperPath],
      env: baseEnv(),
      text: 'G464_ROOT_LEASE',
    },
    {
      id: 'reject.retest-optin',
      args: [wrapperPath, fakeRepo, HARNESS, arbitraryDir],
      env: baseEnv({
        G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN',
        MB006_PLACEMENT_RETEST_CONTINUATION: 'MB006_PLACEMENT_RETEST_CONTINUATION',
      }),
      text: 'MB006_PLACEMENT_RETEST_CONTINUATION must be unset',
    },
    {
      id: 'reject.symlink',
      args: [wrapperPath, fakeRepo, HARNESS, linkDir],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'must not be a symlink',
    },
    {
      id: 'reject.old-405',
      args: [wrapperPath, fakeRepo, HARNESS, OLD_PATH],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'cannot reuse the G405',
    },
    {
      id: 'reject.old-405-tmp',
      args: [wrapperPath, fakeRepo, HARNESS, '/tmp/grok-mobile-resume-home-405/run'],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'cannot reuse the G405',
    },
    {
      id: 'reject.old-454',
      args: [wrapperPath, fakeRepo, HARNESS, PATH_454],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'cannot reuse the G454',
    },
    {
      id: 'reject.arbitrary',
      args: [wrapperPath, fakeRepo, HARNESS, arbitraryDir],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'exact canonical path',
    },
    {
      id: 'reject.other-source',
      args: [wrapperPath, fakeRepo, '/tmp/grok-g464-not-harness', arbitraryDir],
      env: baseEnv({ G464_ROOT_LEASE: 'YES_RUN_G464_HOME_RETURN' }),
      text: 'rebound staged harness',
    },
  ]
  for (const item of cases) {
    if (item.id === 'reject.old-405' || item.id === 'reject.old-405-tmp' || item.id === 'reject.old-454') {
      try {
        if (fs.lstatSync(item.args[3]).isSymbolicLink()) item.text = 'must not be a symlink'
      } catch { /* a missing path is still refused by the string guard */ }
    }
    const result = runBash(item.args, item.env)
    assert(item.id, result.status === 2 && result.signal === null && result.out.includes(item.text), result)
    rejections.push({ id: item.id, status: result.status, out: result.out })
  }

  const externalAfter = Object.fromEntries(Object.entries(EXTERNAL).map(([id, file]) => [id, shaFile(file)]))
  assert('external.unchanged', JSON.stringify(externalBefore) === JSON.stringify(externalAfter))
  const g405 = JSON.parse(fs.readFileSync(EXTERNAL.g405Receipt, 'utf8'))
  const g454Exit = JSON.parse(fs.readFileSync(EXTERNAL.g454Exit, 'utf8'))
  const g454Result = JSON.parse(fs.readFileSync(EXTERNAL.g454Result, 'utf8'))
  const g454Release = JSON.parse(fs.readFileSync(EXTERNAL.g454Release, 'utf8'))
  const g454Runner = fs.readFileSync(EXTERNAL.g454Runner, 'utf8')
  assert('g405.still-fail', g405.status === 'FAILED' && g405.reason === 'final-hash' && g405.finalHash === '/')
  assert('g454.still-preflight-fail', g454Exit.exit === 1 && g454Result.status === 'FAIL' && g454Result.preflightStatus === 'FAIL' && g454Release.businessJourney === 'NOT_RUN' && g454Release.harnessPreflight === 'FAIL_RUN_DIRECTORY_GUARD' && g454Runner.includes('MB033_RUN_DIRECTORY must be the exact root artifact directory for the selected mode; no fallback'))
  assert('run-dir.untouched', JSON.stringify(snapshotRun()) === JSON.stringify(runBefore), { before: runBefore, after: snapshotRun() })
  assert('no-observed-receipt', !fs.existsSync(path.join(OUT, 'home-return-receipt.json')) && !fs.existsSync(path.join(CANDIDATE, 'home-return-receipt.json')))

  const candidateFiles = walk(CANDIDATE).map((rel) => ({
    file: rel,
    sha256: shaFile(path.join(CANDIDATE, rel)),
  }))
  const hashManifest = {
    kind: 'G464_HARNESS_REBIND',
    oldPath: OLD_PATH,
    newPath: NEW_PATH,
    retestPathUnchanged: RETEST_PATH,
    cardinality: { oldBefore, oldAfter, newAfter, retestBefore, retestAfter },
    files: manifestFiles,
    candidate: candidateFiles,
  }
  const pathRebind = {
    oldPath: OLD_PATH,
    newPath: NEW_PATH,
    retestPathUnchanged: RETEST_PATH,
    cardinality: hashManifest.cardinality,
    sites: manifestFiles.filter((row) => row.oldPathBefore > 0 || row.newPathAfter > 0).map((row) => ({
      file: row.file,
      oldPathBefore: row.oldPathBefore,
      oldPathAfter: row.oldPathAfter,
      newPathAfter: row.newPathAfter,
      beforeSha256: row.beforeSha256,
      afterSha256: row.afterSha256,
    })),
  }
  const provenance = {
    sourceCandidate: SOURCE_CANDIDATE,
    sourceHarness: SOURCE_HARNESS,
    reboundHarness: HARNESS,
    authorDir: CANDIDATE,
    runDir: NEW_PATH,
    runDirCreatedByStage: false,
    gitExecuted: false,
    runtimeStarted: false,
    sourceHeadPinned: PINS.sourceHead,
    h5: { root: H5, indexSha256: shaFile(path.join(H5, 'index.html')) },
    external: externalAfter,
    sourceCandidateFiles: walk(SOURCE_CANDIDATE).map((rel) => ({ file: rel, sha256: shaFile(path.join(SOURCE_CANDIDATE, rel)) })),
  }
  assert('h5.index', provenance.h5.indexSha256 === INDEX_SHA, provenance.h5)
  fs.writeFileSync(path.join(OUT, 'HASH-MANIFEST.json'), `${JSON.stringify(hashManifest, null, 2)}\n`, { mode: 0o644 })
  fs.writeFileSync(path.join(OUT, 'PATH-REBIND.json'), `${JSON.stringify(pathRebind, null, 2)}\n`, { mode: 0o644 })
  fs.writeFileSync(path.join(OUT, 'PROVENANCE.json'), `${JSON.stringify(provenance, null, 2)}\n`, { mode: 0o644 })
  cleanup()
  process.stdout.write(`${JSON.stringify({
    status: 'STAGE_PASS',
    checks: checks.length,
    root: owner.FULL_BROWSER_ROOT_ARTIFACT_DIR,
    callbackKeys,
    cardinality: hashManifest.cardinality,
    rejections,
  }, null, 2)}\n`)
} catch (error) {
  cleanup()
  if (error && error.code === 'ERR_ASSERTION') throw error
  process.stderr.write(`${JSON.stringify({ id: 'stage.fatal', ok: false, detail: String(error && error.stack ? error.stack : error) })}\n`)
  process.exit(2)
}
