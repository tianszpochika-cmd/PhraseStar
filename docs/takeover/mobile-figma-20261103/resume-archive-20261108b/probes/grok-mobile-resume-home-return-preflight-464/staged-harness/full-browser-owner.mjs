/**
 * MB-006 full H5 placement + learning-plan browser opt-in.
 *
 * In-process only. Requires the existing B85 browser flag, the B89 placement
 * browser flag, and the learner-target flag. It does not POST a target,
 * placement, answer, or plan. DSH42 owns the Chrome callback. Direct
 * execution refuses.
 */
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { FULL_BROWSER_OPT_IN, withFullBrowserServices } from './placement-start-read.mjs'

export { FULL_BROWSER_OPT_IN, withFullBrowserServices }

const HISTORICAL_FULL_BROWSER_ROOT = '/private/tmp/grok-mobile-resume-home-return-464/run'
export const RETEST_CONTINUATION_OPT_IN = 'MB006_PLACEMENT_RETEST_CONTINUATION'
export const RETEST_CONTINUATION_ROOT = '/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run'
export const RETEST_H5_DIRECTORY = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/assessment-theme-111-root/h5'
export const RETEST_H5_INDEX_SHA256 = '6416f7f58a19b9cf7821288e5ada237f236009ec04f9b19b8e0bdc02d9433519'

export function retestContinuationEnabled() {
  return process.env.MB006_PLACEMENT_RETEST_CONTINUATION === RETEST_CONTINUATION_OPT_IN
}

export const FULL_BROWSER_ROOT_ARTIFACT_DIR = retestContinuationEnabled()
  ? RETEST_CONTINUATION_ROOT
  : HISTORICAL_FULL_BROWSER_ROOT
export const FULL_SCENARIO = 'H5_PLACEMENT_ANSWERS_ENSURE_TODAY'
export const RETEST_SCENARIO = 'H5_PLACEMENT_ANSWERS_ENSURE_VISIBLE_RETEST'
const FULL_ARTIFACT_ENV = 'MB006_FULL_BROWSER_ARTIFACT'
const FULL_INDEX_SHA_ENV = 'MB006_FULL_BROWSER_INDEX_SHA256'

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export function fullBrowserEnabled() {
  return process.env.MB006_PLACEMENT_FULL_BROWSER === FULL_BROWSER_OPT_IN
}

function artifactError(id, message) {
  const error = new Error(message)
  error.id = id
  return error
}

/**
 * Full-mode H5 root. There is no default directory and no B86 path.
 * The env value must already be the absolute canonical directory. index.html
 * is hashed here, before Chrome, and that same digest is the only SHA passed
 * to DSH42 and checked on the observer receipt.
 */
export function provenFullArtifact() {
  const raw = process.env[FULL_ARTIFACT_ENV]
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096 || raw.includes('\0')
    || !path.isAbsolute(raw) || path.resolve(raw) !== raw) {
    throw artifactError('placement.full_artifact_env',
      'MB006_FULL_BROWSER_ARTIFACT must be an absolute canonical frozen directory')
  }
  let listed
  let real
  try {
    listed = fs.lstatSync(raw)
    real = fs.realpathSync(raw)
  } catch {
    throw artifactError('placement.full_artifact_missing',
      'MB006_FULL_BROWSER_ARTIFACT must already exist')
  }
  if (listed.isSymbolicLink() || !listed.isDirectory() || real !== raw) {
    throw artifactError('placement.full_artifact_canonical',
      'MB006_FULL_BROWSER_ARTIFACT must be the canonical directory, not a symlink or other path')
  }
  const declared = process.env[FULL_INDEX_SHA_ENV]
  if (typeof declared !== 'string' || !/^[0-9a-f]{64}$/u.test(declared)) {
    throw artifactError('placement.full_index_sha_env',
      'MB006_FULL_BROWSER_INDEX_SHA256 must be exact lowercase SHA-256 hex')
  }
  const indexFile = path.join(raw, 'index.html')
  let indexListed
  try {
    indexListed = fs.lstatSync(indexFile)
  } catch {
    throw artifactError('placement.full_index_missing',
      'the frozen H5 index.html must exist before runtime')
  }
  if (indexListed.isSymbolicLink() || !indexListed.isFile()) {
    throw artifactError('placement.full_index_file',
      'index.html must be a regular file in the frozen directory')
  }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(indexFile)).digest('hex')
  if (actual !== declared) {
    throw artifactError('placement.full_index_sha',
      'index.html SHA-256 does not match MB006_FULL_BROWSER_INDEX_SHA256')
  }
  return { artifact: raw, indexSha: actual }
}

function provenFullArtifactOrNull() {
  try {
    return provenFullArtifact()
  } catch {
    return null
  }
}

/**
 * Options added to the existing runTargetBrowser call. Credentials stay
 * outside this object. DSH42 full mode reads only full, fullArtifact, and
 * fullIndexSha unless the retest continuation opt-in adds retestContinuation.
 * This object does not carry a placement artifact pin.
 */
export function callbackOptions() {
  const proven = provenFullArtifact()
  const options = {
    full: true,
    fullArtifact: proven.artifact,
    fullIndexSha: proven.indexSha,
  }
  if (!retestContinuationEnabled()) return options
  if (proven.artifact !== RETEST_H5_DIRECTORY || proven.indexSha !== RETEST_H5_INDEX_SHA256) {
    throw artifactError('placement.retest_h5', 'retest continuation requires the B100 assessment H5 directory and index SHA')
  }
  options.retestContinuation = true
  return options
}

function continued(requests, type, method) {
  return requests.filter((row) => isRecord(row) && row.disposition === 'continue' && row.type === type && row.method === method)
}

function statusesOk(count, statuses, exact) {
  if (count !== exact || !Array.isArray(statuses) || statuses.length !== exact) return false
  return statuses.every((status) => status === 200)
}

export function observerFullScenarioMet(receipt) {
  const proven = provenFullArtifactOrNull()
  if (!proven) return false
  if (!isRecord(receipt)) return false
  if (receipt.status !== 'OBSERVED' || receipt.fullOptIn !== true || receipt.placementOptIn !== true) return false
  if (receipt.indexMatch !== true || receipt.expectedIndexSha256 !== proven.indexSha) return false
  const expectations = receipt.expectations
  if (!isRecord(expectations)) return false
  if (expectations.targetPutCount !== 1 || expectations.targetPutStatus !== 200) return false
  if (expectations.targetPutBodyMatch !== true || expectations.targetReadbackMatch !== true) return false
  if (expectations.preferenceWrites !== 0 || expectations.consentWrites !== 0) return false
  if (expectations.extraContinuedWrites !== 0 || expectations.syntheticResponses !== 0 || expectations.unknownContinued !== 0) return false
  if (!Array.isArray(receipt.requests)) return false
  const creates = continued(receipt.requests, 'gateway-placement-create', 'POST')
  if (creates.length !== 1 || creates[0].status !== 201) return false
  const sessionReads = continued(receipt.requests, 'gateway-placement-read', 'GET')
  const retestOn = retestContinuationEnabled()
  if (sessionReads.length > (retestOn ? 2 : 1)) return false
  if (sessionReads.some((row) => row.status !== 200)) return false
  const full = expectations.full
  if (!isRecord(full)) return false
  if (full.responseCount !== 10 || !Array.isArray(full.responses) || full.responses.length !== 10) return false
  for (let index = 0; index < 10; index += 1) {
    const row = full.responses[index]
    const sequence = index + 1
    if (!isRecord(row) || row.sequence !== sequence || row.status !== 200) return false
    if (row.acceptedSequence !== sequence || row.nextSequence !== sequence + 1) return false
    if (row.versionOk !== true || row.itemOk !== true || row.bodyOk !== true || row.idempotency !== true) return false
    if (row.feedbackPresent !== true) return false
    if (sequence < 10 && row.nextItemOk !== true) return false
    if (sequence === 10 && row.finalOk !== true) return false
  }
  if (full.finalReportPresent !== true || full.reportVisible !== true || full.reportLevelMatch !== true) return false
  if (full.reportScoreMatch !== true || full.reportSavedVisible !== true || full.reportPlanError !== false) return false
  if (full.reportTodayButton !== true) return false
  if (full.finalReportItemCount != null && full.finalReportItemCount !== 10) return false
  if (full.planEnsureCount !== 1 || full.planEnsureStatus !== 200 || full.planEnsureBodyOk !== true) return false
  if (full.planEnsureIdempotency !== true || full.planEnsurePlanPresent !== true || full.duplicateEnsureAttempts !== 0) return false
  if (full.duplicateResponseAttempts !== 0 || full.prematureResponseAttempts !== 0 || full.earlyEnsureAttempts !== 0) return false
  if (full.wrongSequenceAttempts !== 0 || full.wrongVersionAttempts !== 0 || full.wrongItemAttempts !== 0) return false
  if (full.wrongOptionAttempts !== 0 || full.wrongBodyAttempts !== 0 || full.wrongSessionAttempts !== 0) return false
  if (!Array.isArray(full.todayAfterEnsureStatuses) || full.todayAfterEnsureCount !== full.todayAfterEnsureStatuses.length) return false
  if (full.todayAfterEnsureCount < 1 || full.todayAfterEnsureStatuses.some((status) => status !== 200)) return false
  if (full.todayAfterEnsurePlanMatch !== true) return false
  if (retestOn) {
    if (proven.indexSha !== RETEST_H5_INDEX_SHA256) return false
    if (full.retestContinuation !== true || full.retestWrites !== 1 || full.retestStatus !== 201) return false
    if (full.retestBodyEmpty !== true || full.retestIdempotency !== true || full.retestAuthorized !== true) return false
    if (full.retestSessionNew !== true || full.retestQuestionVisible !== true || full.retestReportScreenLeft !== true) return false
    if (full.retestConfirmClicks !== 1 || full.retestSubmitStillDisabled !== true || full.retestNoChoice !== true) return false
    if (full.retestFirstItem !== true || full.todayUiClicked !== false || full.todayAfterUiCount !== 0) return false
    if (full.homeCount !== 0 || full.homeRequests !== 0 || full.catalogCount !== 0 || full.catalogRequests !== 0) return false
    if (full.skipWrites !== 0 || full.unexpectedPlanWrites !== 0 || full.extraContinuedWrites !== 0) return false
  } else {
    if (full.retestContinuation === true) return false
    if (!Array.isArray(full.todayAfterUiStatuses) || full.todayAfterUiCount !== full.todayAfterUiStatuses.length) return false
    if (full.todayAfterUiCount < 1 || full.todayAfterUiStatuses.some((status) => status !== 200)) return false
    if (full.todayUiClicked !== true || full.todayUiAlgorithmVersionMatch !== true) return false
    if (full.todayReadCount < full.todayAfterEnsureCount + full.todayAfterUiCount) return false
    if (!statusesOk(full.homeCount, full.homeStatuses, 1) || full.homeRequests !== 1) return false
    if (!statusesOk(full.catalogCount, full.catalogStatuses, 1) || full.catalogRequests !== 1) return false
    if (full.retestWrites !== 0 || full.skipWrites !== 0 || full.unexpectedPlanWrites !== 0 || full.extraContinuedWrites !== 0) return false
  }
  if (full.submitClicks !== 10) return false
  if (full.syntheticResponses !== 0 || full.unknownContinued !== 0 || full.missingAuthorization !== 0) return false
  return true
}

export function projectFullObserver(receipt) {
  if (!isRecord(receipt)) {
    return {
      status: 'FAILED', reason: null, placementOptIn: false, fullOptIn: false,
      indexMatch: false, expectedIndexSha256: null, errorId: null, full: null,
    }
  }
  const expectations = isRecord(receipt.expectations) ? receipt.expectations : null
  const full = expectations && isRecord(expectations.full) ? expectations.full : null
  const requests = Array.isArray(receipt.requests) ? receipt.requests : []
  return {
    status: receipt.status ?? null,
    reason: typeof receipt.reason === 'string' ? receipt.reason : null,
    placementOptIn: receipt.placementOptIn === true,
    fullOptIn: receipt.fullOptIn === true,
    indexMatch: receipt.indexMatch === true,
    expectedIndexSha256: typeof receipt.expectedIndexSha256 === 'string' ? receipt.expectedIndexSha256 : null,
    targetPutCount: expectations ? expectations.targetPutCount ?? null : null,
    targetPutStatus: expectations ? expectations.targetPutStatus ?? null : null,
    preferenceWrites: expectations ? expectations.preferenceWrites ?? null : null,
    consentWrites: expectations ? expectations.consentWrites ?? null : null,
    placementCreateCount: continued(requests, 'gateway-placement-create', 'POST').length,
    sessionReadCount: continued(requests, 'gateway-placement-read', 'GET').length,
    errorId: isRecord(receipt.error) && typeof receipt.error.id === 'string' ? receipt.error.id : null,
    full,
  }
}

export function serviceFacts(owned) {
  if (!owned) return null
  return {
    status: owned.status,
    launch: owned.launch ?? null,
    learningLaunch: owned.learningLaunch ?? null,
    learningPortBusy: owned.learningPortBusy ?? null,
    cleanup: owned.cleanup ?? null,
    cleanupError: owned.cleanupError ?? null,
    error: owned.error ?? null,
    dec04: 'NOT_ASSERTED',
    answersSubmittedByHarness: 0,
    scoreRequestedByHarness: false,
    scoreToken: 'UNSET',
    scoreExchange: 'IAM_CLIENT_CREDENTIALS',
    serviceTokenHeldByCaller: false,
    learningStarted: owned.learningStarted === true,
    programmaticPlacementPost: false,
    programmaticAnswerPost: false,
    programmaticPlanPost: false,
    planEnsuredByHarness: false,
    targetSeeded: false,
    harnessCalls: 0,
    kafka: false,
    contentDirect: true,
    attachedToExisting: false,
    stoppedUntracked: false,
  }
}

export function judgeFullBrowser({ services, receipt }) {
  const proven = provenFullArtifactOrNull()
  const met = observerFullScenarioMet(receipt)
  const facts = serviceFacts(services)
  const servicesOk = Boolean(facts && facts.status === 'PASS' && !facts.cleanupError && !facts.error)
  return {
    kind: 'MB006_PLACEMENT_FULL_BROWSER',
    schemaVersion: '1',
    optIn: FULL_BROWSER_OPT_IN,
    status: servicesOk && met ? 'PASS' : 'FAIL',
    dec04: 'NOT_ASSERTED',
    separateFromIamChecks: true,
    scenario: retestContinuationEnabled() ? RETEST_SCENARIO : FULL_SCENARIO,
    budgetMet: met,
    fullArtifact: proven ? proven.artifact : null,
    fullIndexSha: proven ? proven.indexSha : null,
    programmaticTargetWrite: false,
    programmaticPlacementPost: false,
    programmaticAnswerPost: false,
    programmaticPlanPost: false,
    scoreToken: 'UNSET',
    scoreExchange: 'IAM_CLIENT_CREDENTIALS',
    serviceTokenHeldByCaller: false,
    kafka: false,
    contentRoute: 'TARGET',
    contentBase: 'http://127.0.0.1:18089',
    contentInternal: 'DIRECT',
    observer: projectFullObserver(receipt),
    services: facts,
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  console.error('REFUSING: MB-006 full browser wiring is in-process only. Do not pass a bearer or workload secret via argv.')
  process.exit(2)
}
