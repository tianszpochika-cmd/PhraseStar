/**
 * MB-006 Gateway placement create/read. In-process only.
 *
 * Called after the B82 learner probe has already proved an eligible adult,
 * an ACTIVE target write, owner readback, and a stable same-key retry.
 * The learner bearer and the raw target id/version stay in memory. This
 * module does not read a bearer from the environment, does not write answer
 * material, and does not start Learning, Docker, or a second MySQL.
 *
 * Direct execution refuses. Import runPlacementStartRead from the B82 probe.
 * withPlacementBrowserServices reuses this jar preflight and the owned
 * Content/Assessment start/finally for the MB-006 Chrome opt-in. It does not
 * POST a placement session. withFullBrowserServices is the separate opt-in
 * that also starts Learning and passes the assessment workload secret only
 * into the Assessment JVM. It still does not POST placement, answers, or plans.
 */
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const OPT_IN = 'YES_RUN_MB006_PLACEMENT_START_READ'
export const PLACEMENT_BROWSER_OPT_IN = 'MB006_PLACEMENT_BROWSER'
export const FULL_BROWSER_OPT_IN = 'MB006_PLACEMENT_FULL_BROWSER'
const IAM_SCORE_ORIGIN = 'https://127.0.0.1:18087'
const SCORE_CLIENT_ID = 'assessment-service'
const LEARNER_OPT_IN = 'YES_RUN_MB033_LEARNER_TARGET_PROBE'
const BROWSER_OPT_IN = 'YES_LOCAL_H5_TARGET_SMOKE'
export const CONTENT_JAR_SHA256 = '852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
export const ASSESSMENT_JAR_SHA256 = '467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'
const RETEST_CONTINUATION_OPT_IN = 'MB006_PLACEMENT_RETEST_CONTINUATION'
const RETEST_CONTENT_JAR_SHA256 = '852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
const RETEST_ASSESSMENT_JAR_SHA256 = '467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'

function retestContinuationEnabled() {
  return process.env.MB006_PLACEMENT_RETEST_CONTINUATION === RETEST_CONTINUATION_OPT_IN
}

function expectedContentJarSha256() {
  return retestContinuationEnabled() ? RETEST_CONTENT_JAR_SHA256 : CONTENT_JAR_SHA256
}

function expectedAssessmentJarSha256() {
  return retestContinuationEnabled() ? RETEST_ASSESSMENT_JAR_SHA256 : ASSESSMENT_JAR_SHA256
}

const GATEWAY_HOST = '127.0.0.1'
const GATEWAY_PORT = 18070
const LEARNER_PORT = 18088
const CONTENT_PORT = 18089
const LEARNING_PORT = 18090
const ASSESSMENT_PORT = 18091
const ORIGIN = 'http://127.0.0.1:18183'
const CONTENT_BASE = `http://127.0.0.1:${CONTENT_PORT}`
const LEARNER_BASE = `http://127.0.0.1:${LEARNER_PORT}`
const REQUEST_TIMEOUT_MS = 20_000
const MAX_RESPONSE_BYTES = 1_048_576
const MAX_CALLS = 2
const CONTENT_HEALTH_MS = 120_000
const ASSESSMENT_HEALTH_MS = 90_000
const JVM_MEMORY = ['-Xms64m', '-Xmx384m', '-XX:ActiveProcessorCount=2']
const ITEM_SPECS = Object.freeze([
  [266001, 'p1.place.vocab.01', 'VOCABULARY', 1],
  [266002, 'p1.place.vocab.02', 'VOCABULARY', 2],
  [266003, 'p1.place.vocab.03', 'VOCABULARY', 3],
  [266004, 'p1.place.grammar.01', 'GRAMMAR', 4],
  [266005, 'p1.place.grammar.02', 'GRAMMAR', 5],
  [266006, 'p1.place.grammar.03', 'GRAMMAR', 6],
  [266007, 'p1.place.reading.01', 'READING', 7],
  [266008, 'p1.place.reading.02', 'READING', 8],
  [266009, 'p1.place.listening.01', 'LISTENING', 9],
  [266010, 'p1.place.listening.02', 'LISTENING', 10],
])
const SESSION_KEYS = Object.freeze([
  'acceptedSequence', 'answerRulePin', 'contentPin', 'currentItem', 'items', 'manifest',
  'nextSequence', 'sessionId', 'sessionSnapshotDigest', 'startedAt', 'stateVersion',
  'status', 'targetPin', 'updatedAt',
])
const LEAK = /correctOption|answer_rule|correctAnswer|answerRules|"explanation"/u
const SAFE_MESSAGE = /^[A-Za-z0-9 _:/-]{1,180}$/u

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const sha256Text = (value) => sha256(Buffer.from(value, 'utf8'))
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function fail(id, message) {
  const error = new Error(message)
  error.id = id
  throw error
}

function must(ok, id, message) {
  if (!ok) fail(id, message)
}

function jdbcUrl(schema) {
  return `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`
}

function tcp(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    let done = false
    const end = (value) => { if (!done) { done = true; socket.destroy(); resolve(value) } }
    socket.setTimeout(600, () => end(false))
    socket.once('connect', () => end(true))
    socket.once('error', () => end(false))
  })
}

function unzip(jar, entry) {
  try {
    return execFileSync('unzip', ['-p', jar, entry], { maxBuffer: 8 * 1024 * 1024 })
  } catch {
    return null
  }
}

function contains(buffer, text) {
  return Boolean(buffer && buffer.includes(text))
}

function passwordOk(value) {
  return typeof value === 'string' && value.length >= 16 && !/\s/u.test(value)
}

function readEnvAccount(prefix) {
  const schema = process.env[`MB006_${prefix}_SCHEMA`]
  const url = process.env[`MB006_${prefix}_JDBC_URL`]
  const user = process.env[`MB006_${prefix}_JDBC_USERNAME`]
  const password = process.env[`MB006_${prefix}_JDBC_PASSWORD`]
  return { schema, url, user, password }
}

function assertAccount(prefix, pattern, userPattern, account) {
  must(typeof account.schema === 'string' && pattern.test(account.schema),
    `placement.${prefix}.schema`, `${prefix} schema must be a dedicated mb006 schema, not a default service schema`)
  must(account.url === jdbcUrl(account.schema) && !account.url.includes('@'),
    `placement.${prefix}.jdbc`, `${prefix} JDBC URL must be the dedicated loopback schema on 127.0.0.1:13306`)
  must(typeof account.user === 'string' && userPattern.test(account.user) && account.user !== 'root',
    `placement.${prefix}.user`, `${prefix} DB user must be a dedicated non-root account`)
  must(passwordOk(account.password), `placement.${prefix}.password`, `${prefix} DB password must be an unspaced secret of at least 16 characters`)
}

function assessmentWorkloadSecret() {
  const secret = process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET
  const digest = String(process.env.IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST || '').toLowerCase()
  must(/^[0-9a-f]{64}$/u.test(digest), 'placement.full_browser_digest',
    'IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST must be the precomputed lowercase SHA-256 hex digest')
  must(typeof secret === 'string' && secret.length >= 16 && !/\s/u.test(secret), 'placement.full_browser_secret',
    'ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET must be the root-provided unspaced secret of at least 16 characters')
  must(sha256Text(secret) === digest, 'placement.full_browser_digest_match',
    'the assessment client secret does not match the IAM assessment-service digest')
  const iamBase = process.env.ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL
  must(iamBase === undefined || iamBase.replace(/\/+$/u, '') === IAM_SCORE_ORIGIN, 'placement.full_browser_iam_base',
    'ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL must be https://127.0.0.1:18087 when set')
  const clientId = process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_ID
  must(clientId === undefined || clientId === SCORE_CLIENT_ID, 'placement.full_browser_client_id',
    'ASSESSMENT_PLACEMENT_SCORE_CLIENT_ID must be assessment-service when set')
  const contentBase = process.env.ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL
  must(contentBase === undefined || contentBase.replace(/\/+$/u, '') === CONTENT_BASE, 'placement.full_browser_content_base',
    'ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL must be http://127.0.0.1:18089 when set')
  for (const other of [
    process.env.MB004_MYSQL_PASSWORD, process.env.MB033_LEARNER_JDBC_PASSWORD,
    process.env.MB006_CONTENT_JDBC_PASSWORD, process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
    process.env.MB007_LEARNING_JDBC_PASSWORD,
  ]) {
    must(!other || secret !== other, 'placement.full_browser_secret_not_shared',
      'the assessment workload secret must not reuse an owner DB password')
  }
  return secret
}

function assertJar(pathEnv, expected, checks) {
  const jar = process.env[pathEnv]
  const declared = String(process.env[`${pathEnv}_SHA256`] || '').toLowerCase()
  must(typeof jar === 'string' && fs.existsSync(jar) && fs.statSync(jar).isFile(),
    `placement.${pathEnv}.file`, `${pathEnv} must be the exact pinned jar file`)
  const actual = sha256(fs.readFileSync(jar))
  must(declared === expected && actual === expected, `placement.${pathEnv}.sha256`,
    `${pathEnv} SHA-256 does not match the owner pin`)
  for (const check of checks) {
    const bytes = unzip(jar, check.entry)
    must(contains(bytes, check.text), `placement.${pathEnv}.content`,
      `${pathEnv} is missing ${check.entry} text ${check.text}`)
  }
  return { jar, sha256: actual }
}

export async function validatePlacementLaunch({ phase, gatewayJar, browser = false, fullLearning = false } = {}) {
  if (browser) {
    must(process.env.MB006_PLACEMENT_BROWSER === PLACEMENT_BROWSER_OPT_IN, 'placement.browser_opt_in',
      'MB006_PLACEMENT_BROWSER must be the exact browser opt-in token')
    must(process.env.MB004_TARGET_BROWSER_PROBE === BROWSER_OPT_IN, 'placement.requires_b85',
      'the placement browser opt-in requires the B85 browser opt-in')
    must(process.env.MB033_LEARNER_TARGET_PROBE === LEARNER_OPT_IN, 'placement.requires_b82',
      'the placement browser opt-in requires the B82 learner-target opt-in')
    must(!process.env.MB006_PLACEMENT_START_READ, 'placement.browser_exclusive',
      'MB006_PLACEMENT_START_READ must be unset; browser mode does not POST placement')
    if (fullLearning) {
      must(process.env.MB006_PLACEMENT_FULL_BROWSER === FULL_BROWSER_OPT_IN, 'placement.full_browser_opt_in',
        'MB006_PLACEMENT_FULL_BROWSER must be the exact full-browser opt-in')
      must(!process.env.MB006_PLACEMENT_CHECKPOINT && !process.env.MB006_PLACEMENT_COMPLETION
        && !process.env.MB007_LEARNING_PLAN_ENSURE,
      'placement.full_browser_exclusive', 'full browser mode requires the programmatic G80 and G83 opt-ins to stay unset')
    } else {
      must(!process.env.MB006_PLACEMENT_FULL_BROWSER, 'placement.b89_not_full',
        'MB006_PLACEMENT_FULL_BROWSER must be unset on the B89 first-question browser path')
    }
  } else {
    must(!fullLearning, 'placement.full_browser_browser_only', 'full browser launch is browser-only')
    must(!process.env.MB006_PLACEMENT_FULL_BROWSER, 'placement.start_read_not_full',
      'MB006_PLACEMENT_FULL_BROWSER must be unset on the programmatic start/read path')
    must(process.env.MB006_PLACEMENT_START_READ === OPT_IN, 'placement.opt_in',
      'MB006_PLACEMENT_START_READ must be the exact opt-in token')
    must(process.env.MB033_LEARNER_TARGET_PROBE === LEARNER_OPT_IN,
      'placement.requires_b82', 'the placement opt-in requires the B82 learner-target opt-in')
    must(!process.env.MB006_PLACEMENT_BROWSER, 'placement.start_read_exclusive',
      'MB006_PLACEMENT_BROWSER must be unset on the programmatic start/read path')
  }
  const forbiddenEnv = [
    'MB006_ACCESS_TOKEN',
    'ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN',
  ]
  if (!(browser && fullLearning)) {
    forbiddenEnv.push('ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET', 'ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL')
  }
  for (const name of forbiddenEnv) {
    must(!process.env[name], 'placement.forbidden_env', `${name} must be unset; authorization and score tokens are not taken from the environment`)
  }
  if (browser && fullLearning) assessmentWorkloadSecret()
  const content = readEnvAccount('CONTENT')
  const assessment = readEnvAccount('ASSESSMENT')
  assertAccount('content', /^mb006_cnt_[a-z0-9]{8,24}$/u, /^mb006c_[a-z0-9]{8,24}$/u, content)
  assertAccount('assessment', /^mb006_asm_[a-z0-9]{8,24}$/u, /^mb006a_[a-z0-9]{8,24}$/u, assessment)
  must(content.schema !== assessment.schema && content.user !== assessment.user && content.password !== assessment.password,
    'placement.accounts_distinct', 'Content and Assessment need different schemas, users, and passwords')
  for (const other of [process.env.MB004_MYSQL_USER, process.env.MB033_LEARNER_JDBC_USERNAME]) {
    must(content.user !== other && assessment.user !== other, 'placement.user_not_shared',
      'Content and Assessment DB users must not reuse the IAM or Learner account')
  }
  for (const other of [process.env.MB004_MYSQL_PASSWORD, process.env.MB033_LEARNER_JDBC_PASSWORD]) {
    must(!other || (content.password !== other && assessment.password !== other), 'placement.password_not_shared',
      'Content and Assessment DB passwords must not reuse the IAM or Learner password')
  }
  const contentJar = assertJar('MB006_CONTENT_JAR', expectedContentJarSha256(), [
    { entry: 'BOOT-INF/classes/db/migration/V28__seed_placement_item_bank.sql', text: 'p1-placement-bank-v1' },
    { entry: 'BOOT-INF/classes/db/migration/V28__seed_placement_item_bank.sql', text: '266100' },
    { entry: 'BOOT-INF/classes/com/englishflow/content/web/PlacementBankSealedController.class', text: 'P1_PLACEMENT_V1' },
    { entry: 'BOOT-INF/classes/com/englishflow/content/web/PlacementBankSealedController.class', text: 'snap_p1.placement.v1-' },
  ])
  const assessmentJar = assertJar('MB006_ASSESSMENT_JAR', expectedAssessmentJarSha256(), [
    { entry: 'BOOT-INF/classes/db/migration/V8__create_p1_placement_owner_runtime.sql', text: 'p1_placement_session' },
    { entry: 'BOOT-INF/classes/com/englishflow/assessment/web/P1PlacementJdbcController.class', text: 'placement start has no client authority fields' },
    { entry: 'BOOT-INF/classes/com/englishflow/assessment/web/P1PlacementJdbcController.class', text: 'P1_PLACEMENT_V1' },
    { entry: 'BOOT-INF/classes/com/englishflow/assessment/adapter/content/HttpPlacementBankPort.class', text: '/internal/v1/content/placement-bank/sealed' },
    { entry: 'BOOT-INF/classes/com/englishflow/assessment/adapter/content/HttpPlacementBankPort.class', text: '/api/v1/learner/targets' },
  ])
  if (browser && fullLearning) {
    assertJar('MB006_CONTENT_JAR', expectedContentJarSha256(), [
      { entry: 'BOOT-INF/classes/com/englishflow/content/web/PlacementBankSealedController.class', text: 'Selected option equals the stored answer rule.' },
      { entry: 'BOOT-INF/classes/com/englishflow/content/web/ContentHttpPrincipals.class', text: 'content:answer-rules:read' },
    ])
    assertJar('MB006_ASSESSMENT_JAR', expectedAssessmentJarSha256(), [
      { entry: 'BOOT-INF/classes/com/englishflow/assessment/web/P1PlacementJdbcController.class', text: 'assessment.placement.response.submit' },
      { entry: 'BOOT-INF/classes/com/englishflow/assessment/adapter/content/IamServiceTokenSupplier.class', text: '/internal/v1/iam/service-token' },
      { entry: 'BOOT-INF/classes/com/englishflow/assessment/adapter/content/HttpPlacementRuleScorePort.class', text: '/internal/v1/content/placement-bank/score' },
      { entry: 'BOOT-INF/classes/com/englishflow/assessment/web/P1PlacementJdbcController.class', text: 'fullCount' },
      { entry: 'BOOT-INF/classes/com/englishflow/assessment/web/P1PlacementJdbcController.class', text: 'assessment.placement.report.read' },
    ])
  }
  must(typeof gatewayJar === 'string' && fs.existsSync(gatewayJar), 'placement.gateway_jar',
    'the running Gateway jar path is required')
  const gatewayPolicy = unzip(gatewayJar, 'BOOT-INF/classes/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.class')
  must(contains(gatewayPolicy, 'p1-placement-session-create') && contains(gatewayPolicy, 'P1PlacementJdbcController'),
    'placement.gateway_routes', 'the Gateway jar does not contain the ASSESSMENT_P1 placement create/read projection')
  if (browser && fullLearning) {
    must(contains(gatewayPolicy, 'p1-placement-response'), 'placement.gateway_response_route',
      'the Gateway jar does not contain the ASSESSMENT_P1 placement response route')
    must(contains(gatewayPolicy, 'plans-ensure') && contains(gatewayPolicy, 'today-v2'),
      'placement.gateway_learning_routes', 'the Gateway jar does not contain plans:ensure and learning/today')
  }
  const contentBusy = await tcp(CONTENT_PORT)
  const assessmentBusy = await tcp(ASSESSMENT_PORT)
  must(!contentBusy, 'placement.content_port_free', '127.0.0.1:18089 is already in use; attachment is not allowed')
  must(!assessmentBusy, 'placement.assessment_port_free', '127.0.0.1:18091 is already in use; attachment is not allowed')
  if (phase === 'run') {
    must(await tcp(LEARNER_PORT), 'placement.learner_listening', 'Learner must still be listening on 127.0.0.1:18088')
    must(await tcp(GATEWAY_PORT), 'placement.gateway_listening', 'Gateway must still be listening on 127.0.0.1:18070')
  }
  return {
    phase: phase || 'check',
    ...(browser ? { mode: 'BROWSER', programmaticPlacementPost: false } : {}),
    content: { schema: content.schema, user: content.user, jarSha256: contentJar.sha256, port: CONTENT_PORT },
    assessment: { schema: assessment.schema, user: assessment.user, jarSha256: assessmentJar.sha256, port: ASSESSMENT_PORT },
    gateway: {
      assessmentRoute: 'TARGET',
      learnerRoute: 'TARGET',
      contentRoute: browser && fullLearning ? 'TARGET' : 'LEGACY',
      learningRoute: browser && fullLearning ? 'TARGET' : 'LEGACY',
      ...(browser && fullLearning ? {
        contentBase: 'http://127.0.0.1:18089',
        contentInternal: 'DIRECT',
      } : {}),
    },
    scoreToken: 'UNSET',
    ...(browser && fullLearning ? { scoreExchange: 'IAM_CLIENT_CREDENTIALS', fullLearning: true } : {}),
    learningStarted: false,
    attachedToExisting: false,
  }
}

function claims(token) {
  const parts = String(token || '').split('.')
  must(parts.length === 3, 'placement.jwt', 'the in-memory learner access token is not a three-part JWT')
  const read = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  const header = read(parts[0])
  const payload = read(parts[1])
  const list = (value) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  const permissions = list(payload.permissions)
  must(header.alg === 'RS256', 'placement.jwt_alg', 'the learner access token must be RS256')
  must(payload.iss === 'http://127.0.0.1:18087' && list(payload.aud).includes('yuxuexing-api'),
    'placement.jwt_audience', 'the learner access token issuer or audience is wrong')
  must(list(payload.roles).includes('learner') && payload.tenant_id === 'platform'
    && payload.adult_gate === 'PASSED' && payload.consent_state === 'GRANTED'
    && payload.phase === 'phase-1' && payload.account_status === 'ACTIVE'
    && payload.token_type === 'access',
  'placement.jwt_eligibility', 'the learner access token is not an eligible adult Phase 1 access token')
  must(permissions.includes('assessment.placement.session.create')
    && permissions.includes('assessment.placement.session.read')
    && permissions.includes('content.read'),
  'placement.jwt_permissions', 'the learner access token is missing placement create/read or content.read')
}

function soleDigits(raw, field) {
  const found = [...raw.matchAll(new RegExp(`"${field}"\\s*:\\s*(\\d+)`, 'gu'))].map((match) => match[1])
  return found.length === 1 ? found[0] : null
}

function soleString(raw, field) {
  const found = [...raw.matchAll(new RegExp(`"${field}"\\s*:\\s*"([^"\\\\]*)"`, 'gu'))].map((match) => match[1])
  return found.length === 1 ? found[0] : null
}

function learnerPin(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : ''
  const targetId = soleDigits(text, 'targetId')
  const targetVersion = soleDigits(text, 'targetVersion')
  const stateVersion = soleDigits(text, 'stateVersion')
  const updatedAt = soleString(text, 'updatedAt')
  must(targetId && targetVersion && stateVersion && targetVersion === stateVersion,
    'placement.target_digits', 'the ACTIVE target readback does not expose one exact target id and version')
  must(updatedAt && updatedAt.length <= 80, 'placement.target_updated_at',
    'the ACTIVE target readback does not expose one updatedAt string')
  let parsed = null
  try { parsed = JSON.parse(text) } catch { parsed = null }
  const data = parsed && parsed.data && typeof parsed.data === 'object' ? parsed.data : null
  must(data && data.goalCode === 'COLLEGE_CET' && data.targetLevel === 'B1'
    && data.dailyQuotaMinutes === 30 && data.status === 'ACTIVE',
  'placement.target_fields', 'the ACTIVE target readback is not the fresh B82 COLLEGE_CET goal')
  const digest = sha256Text(`p1-target-pin|${targetId}|${data.goalCode}|${data.targetLevel}|${data.dailyQuotaMinutes}|${data.status}|${stateVersion}|${updatedAt}`)
  return { targetId, targetVersion, digest }
}

function manifestDigest(text) {
  return sha256Text(text)
}

function sameKeys(value, expected) {
  return value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).sort().join('|') === [...expected].sort().join('|')
}

function contractFailures(data, raw, pin) {
  const failures = []
  if (!sameKeys(data, SESSION_KEYS)) failures.push('sessionKeys')
  if (!/^asess_[0-9a-f]{32}$/u.test(String(data?.sessionId || ''))) failures.push('sessionId')
  if (data?.status !== 'CREATED') failures.push('status')
  if (data?.stateVersion !== 1) failures.push('stateVersion')
  if (typeof data?.sessionSnapshotDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(data.sessionSnapshotDigest)) failures.push('sessionSnapshotDigest')
  const manifest = data?.manifest
  if (!manifest || manifest.placementManifestId !== 'P1_PLACEMENT_V1'
    || manifest.placementManifestVersion !== 'P1_PLACEMENT_V1'
    || manifest.totalItemCount !== 10
    || manifest.placementManifestDigest !== manifestDigest('P1_PLACEMENT_V1|3/3/2/2|25/25/25/25|HALF_UP')
    || manifest.dimensionSetDigest !== manifestDigest('VOCABULARY|BASIC_GRAMMAR|READING|LISTENING')) failures.push('manifest')
  const dimensions = Array.isArray(manifest?.dimensions) ? manifest.dimensions : []
  const expectedDimensions = [
    ['VOCABULARY', 3, 1], ['BASIC_GRAMMAR', 3, 2], ['READING', 2, 3], ['LISTENING', 2, 4],
  ]
  if (dimensions.length !== 4 || expectedDimensions.some(([dimension, count, order], index) => {
    const item = dimensions[index]
    return !item || Object.keys(item).sort().join('|') !== 'dimension|displayOrder|requiredItemCount|weight'
      || item.dimension !== dimension || item.weight !== 25 || item.requiredItemCount !== count || item.displayOrder !== order
  })) failures.push('dimensions')
  const contentPin = data?.contentPin
  if (!contentPin || contentPin.contentVersionId !== 266100 || contentPin.contentEpoch !== 1
    || contentPin.snapshotId !== 'snap_p1.placement.v1-266100'
    || !/^[a-f0-9]{64}$/u.test(String(contentPin.snapshotHash || ''))
    || Object.keys(contentPin).sort().join('|') !== 'contentEpoch|contentVersionId|snapshotHash|snapshotId') failures.push('contentPin')
  const answerRulePin = data?.answerRulePin
  if (!answerRulePin || Object.keys(answerRulePin).join('|') !== 'completionRuleVersion'
    || answerRulePin.completionRuleVersion !== 'P1_PLACEMENT_V1') failures.push('answerRulePin')
  const targetPin = data?.targetPin
  const targetId = soleDigits(raw, 'targetId')
  const targetVersion = soleDigits(raw, 'targetVersion')
  if (!targetPin || targetId !== pin.targetId || targetVersion !== pin.targetVersion
    || targetPin.targetSnapshotDigest !== pin.digest
    || Object.keys(targetPin).sort().join('|') !== 'targetId|targetSnapshotDigest|targetVersion') failures.push('targetPin')
  const items = Array.isArray(data?.items) ? data.items : []
  if (items.length !== 10 || items.some((item, index) => {
    const [itemId, itemCode, itemType, displayOrder] = ITEM_SPECS[index]
    const options = item?.options
    return !item || Object.keys(item).sort().join('|') !== 'displayOrder|itemCode|itemId|itemType|options|stem'
      || item.itemId !== itemId || item.itemCode !== itemCode || item.itemType !== itemType
      || item.displayOrder !== displayOrder || typeof item.stem !== 'string' || item.stem.length < 1
      || !Array.isArray(options) || options.length < 2 || options.length > 32
      || options.some((option) => !option || Object.keys(option).sort().join('|') !== 'label|optionId'
        || typeof option.optionId !== 'string' || typeof option.label !== 'string' || !option.label)
  })) failures.push('items')
  if (data?.acceptedSequence !== 0 || data?.nextSequence !== 1) failures.push('cursor')
  if (!items[0] || JSON.stringify(data?.currentItem) !== JSON.stringify(items[0])) failures.push('currentItem')
  if (typeof data?.startedAt !== 'string' || typeof data?.updatedAt !== 'string') failures.push('timestamps')
  return failures
}

function dataOf(raw) {
  let parsed = null
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  must(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).join('|') === 'data'
    && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data),
  'placement.envelope', 'the Gateway body is not the controller {data} envelope')
  must(!LEAK.test(raw), 'placement.answer_leak', 'the Gateway body contains answer material')
  return parsed.data
}

function safeMessage(parsed) {
  const message = parsed && typeof parsed === 'object' ? parsed.message || parsed.error : null
  return typeof message === 'string' && SAFE_MESSAGE.test(message) ? message : null
}

function gatewayCall(call) {
  const payload = call.body === undefined ? null : Buffer.from(call.body, 'utf8')
  const headers = {
    Accept: 'application/json',
    Origin: ORIGIN,
    Connection: 'close',
    Authorization: `Bearer ${call.token}`,
  }
  if (call.key) headers['Idempotency-Key'] = call.key
  if (payload) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(payload.length)
  }
  return new Promise((resolve, reject) => {
    let settled = false
    let bytes = 0
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    const req = http.request({
      host: GATEWAY_HOST, port: GATEWAY_PORT, path: call.path, method: call.method, headers, agent: false,
    }, (res) => {
      const chunks = []
      res.on('data', (chunk) => {
        bytes += chunk.length
        if (bytes > MAX_RESPONSE_BYTES) {
          finish(reject, Object.assign(new Error('placement response exceeds bound'), { id: 'placement.response_bound' }))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8')
        let parsed = null
        try { parsed = JSON.parse(raw) } catch { parsed = null }
        finish(resolve, { status: res.statusCode || 0, raw, parsed })
      })
    })
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(Object.assign(new Error('placement request timed out'), { id: 'placement.timeout' })))
    req.on('error', (error) => finish(reject, error))
    if (payload) req.write(payload)
    req.end()
  })
}

function childEnv(base) {
  return {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || '',
    TMPDIR: base.scratch,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    OTEL_ENABLED: 'false',
    OTEL_TRACING_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
    MANAGEMENT_TRACING_EXPORT_ENABLED: 'false',
    SPRING_MAIN_BANNER_MODE: 'off',
    ...base.extra,
  }
}

function startJvm(java, jar, trust, scratch, log, extra) {
  const args = [
    ...JVM_MEMORY,
    '-Dfile.encoding=UTF-8',
    `-Djava.io.tmpdir=${scratch}`,
    `-Djavax.net.ssl.trustStore=${trust.store}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${trust.password}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ]
  const fd = fs.openSync(log, 'w', 0o600)
  let child = null
  try {
    child = spawn(java, [...args, '-jar', jar], {
      cwd: scratch,
      env: childEnv({ scratch, extra }),
      stdio: ['ignore', fd, fd],
      windowsHide: true,
    })
  } finally {
    fs.closeSync(fd)
  }
  fs.chmodSync(log, 0o600)
  return child
}

function health(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, path: '/actuator/health/readiness', method: 'GET',
      headers: { Accept: 'application/json' }, agent: false,
    }, (res) => {
      res.resume()
      resolve(res.statusCode || 0)
    })
    req.setTimeout(2_500, () => req.destroy(new Error('health timed out')))
    req.on('error', reject)
    req.end()
  })
}

async function waitHealthy(entry, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = 'no response'
  while (Date.now() < deadline) {
    if (entry.spawnError) fail(`${entry.service}.spawn`, `${entry.service} JVM did not start`)
    if (entry.child.exitCode !== null || entry.child.signalCode !== null) {
      fail(`${entry.service}.exited`, `${entry.service} JVM exited before listening`)
    }
    try {
      const status = await health(entry.port)
      if (status >= 200 && status < 300) return
      last = `HTTP ${status}`
    } catch (error) {
      last = error.message
    }
    await delay(250)
  }
  const detail = typeof last === 'string' && last.length <= 120 && !/bearer|eyJ/iu.test(last) ? ` (${last})` : ''
  fail(`${entry.service}.timeout`, `${entry.service} did not become ready on 127.0.0.1:${entry.port}${detail}`)
}

async function stopChild(child) {
  if (!child || !child.pid) return { stopped: false }
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once('exit', resolve))
    child.kill('SIGTERM')
    await Promise.race([exited, delay(12_000)])
    if (child.exitCode === null && child.signalCode === null) {
      const killed = new Promise((resolve) => child.once('exit', resolve))
      child.kill('SIGKILL')
      await Promise.race([killed, delay(5_000)])
    }
  }
  return { stopped: child.exitCode !== null || child.signalCode !== null }
}

async function stopOwned(owned) {
  const rows = []
  for (const entry of owned.slice().reverse()) {
    let stopped = { stopped: false }
    let stopError = null
    try {
      stopped = await stopChild(entry.child)
    } catch (error) {
      stopError = error.message
    }
    const portFree = !(await tcp(entry.port))
    rows.push({
      service: entry.service, port: entry.port, pid: entry.child.pid || null,
      stopped: stopped.stopped, portFree, stopError,
    })
  }
  return rows.reverse()
}

function contentEnv(account, scratch) {
  return {
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(CONTENT_PORT),
    CONTENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    CONTENT_SERVICE_PORT: String(CONTENT_PORT),
    CONTENT_PERSISTENCE_MODE: 'jdbc',
    CONTENT_FLYWAY_ENABLED: 'true',
    CONTENT_SERVICE_SCHEMA: account.schema,
    CONTENT_JDBC_URL: account.url,
    CONTENT_JDBC_USERNAME: account.user,
    CONTENT_JDBC_PASSWORD: account.password,
    CONTENT_JDBC_DRIVER: 'com.mysql.cj.jdbc.Driver',
    CONTENT_EVENT_RELAY_ENABLED: 'false',
    CONTENT_EVENT_CONSUMER_ENABLED: 'false',
    CONTENT_SERVICE_RESOURCE_SERVER_ENABLED: 'true',
    CONTENT_SERVICE_SECURITY_ISSUER_URI: 'http://127.0.0.1:18087',
    CONTENT_SERVICE_SECURITY_JWK_SET_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    CONTENT_SERVICE_SECURITY_AUDIENCE: 'yuxuexing-api',
    TMPDIR: scratch,
  }
}

function assessmentEnv(account, scratch) {
  return {
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(ASSESSMENT_PORT),
    ASSESSMENT_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    ASSESSMENT_SERVICE_PORT: String(ASSESSMENT_PORT),
    ASSESSMENT_PHASE: 'phase-1',
    ASSESSMENT_PERSISTENCE_ENABLED: 'true',
    ASSESSMENT_FLYWAY_ENABLED: 'true',
    ASSESSMENT_SCHEMA: account.schema,
    ASSESSMENT_DB_URL: account.url,
    ASSESSMENT_DB_USERNAME: account.user,
    ASSESSMENT_DB_PASSWORD: account.password,
    ASSESSMENT_DB_DRIVER: 'com.mysql.cj.jdbc.Driver',
    ASSESSMENT_DB_CREATE_SCHEMA: 'false',
    ASSESSMENT_PLACEMENT_BANK_ENABLED: 'true',
    ASSESSMENT_PLACEMENT_BANK_CONTENT_BASE_URL: CONTENT_BASE,
    ASSESSMENT_PLACEMENT_BANK_LEARNER_BASE_URL: LEARNER_BASE,
    ASSESSMENT_RESOURCE_SERVER_ENABLED: 'true',
    ASSESSMENT_SECURITY_ISSUER_URI: 'http://127.0.0.1:18087',
    ASSESSMENT_SECURITY_JWK_SET_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    ASSESSMENT_SECURITY_AUDIENCE: 'yuxuexing-api',
    TMPDIR: scratch,
  }
}

export async function runPlacementStartRead(input = {}) {
  const owned = []
  let error = null
  let calls = []
  let session = null
  let launch = null
  let learningPortBusy = null
  let cleanupError = null
  try {
    must(input && input.optIn === OPT_IN, 'placement.opt_in', 'exact in-process opt-in is required')
    must(input.b82 && input.b82.eligibleAdult === true && input.b82.targetWrite === true
      && input.b82.readback === true && input.b82.stableRetry === true,
    'placement.b82_gate', 'placement continues only after the B82 eligible-adult target write, readback, and stable retry')
    must(typeof input.token === 'string', 'placement.token', 'the learner bearer must be passed in memory')
    claims(input.token)
    const pin = learnerPin(input.targetRaw)
    must(input.target && input.target.targetIdDigits === pin.targetId
      && input.target.targetVersionDigits === pin.targetVersion
      && input.target.stateVersionDigits === pin.targetVersion,
    'placement.target_memory', 'the in-memory target id/version does not match the ACTIVE readback')
    launch = await validatePlacementLaunch({ phase: 'run', gatewayJar: input.gatewayJar })
    must(typeof input.java === 'string' && input.java.length > 0, 'placement.java', 'the Java 25 runtime is required')
    must(input.trustStore && input.trustStorePassword && fs.existsSync(input.trustStore),
      'placement.truststore', 'the IAM TLS truststore is required')
    const scratch = input.logDirectory
    must(typeof scratch === 'string' && fs.existsSync(scratch) && fs.statSync(scratch).isDirectory()
      && (fs.statSync(scratch).mode & 0o077) === 0,
    'placement.log_directory', 'the private log directory is required')
    const trust = { store: input.trustStore, password: input.trustStorePassword }
    const contentAccount = readEnvAccount('CONTENT')
    const assessmentAccount = readEnvAccount('ASSESSMENT')
    const contentChild = startJvm(input.java, process.env.MB006_CONTENT_JAR, trust, scratch,
      `${scratch}/content-service.log`, contentEnv(contentAccount, scratch))
    owned.push({ service: 'content', port: CONTENT_PORT, child: contentChild })
    contentChild.once('error', (spawnError) => { contentChild.spawnError = spawnError.message; owned[0].spawnError = spawnError.message })
    await waitHealthy(owned[0], CONTENT_HEALTH_MS)
    const assessmentChild = startJvm(input.java, process.env.MB006_ASSESSMENT_JAR, trust, scratch,
      `${scratch}/assessment-service.log`, assessmentEnv(assessmentAccount, scratch))
    owned.push({ service: 'assessment', port: ASSESSMENT_PORT, child: assessmentChild })
    assessmentChild.once('error', (spawnError) => { assessmentChild.spawnError = spawnError.message; owned[1].spawnError = spawnError.message })
    await waitHealthy(owned[1], ASSESSMENT_HEALTH_MS)
    must(await tcp(LEARNER_PORT), 'placement.learner_still_listening', 'Learner stopped before the placement pair')
    learningPortBusy = await tcp(LEARNING_PORT)
    const key = `mb006-${crypto.randomBytes(16).toString('hex')}`
    must(key.length >= 16 && key.length <= 192 && !/[\r\n]/u.test(key), 'placement.idempotency_key',
      'the generated Idempotency-Key is not contract-shaped')
    const created = await gatewayCall({
      method: 'POST', path: '/api/v1/assessment/placement/sessions', token: input.token, key, body: '{}',
    })
    calls.push({ id: 'create', method: 'POST', path: '/api/v1/assessment/placement/sessions', status: created.status, bodySha256: sha256Text(created.raw), keySha256: sha256Text(key) })
    must(calls.length <= MAX_CALLS, 'placement.call_budget', 'placement call budget exceeded')
    must(created.status === 201, 'placement.create_status', `placement create returned HTTP ${created.status}${safeMessage(created.parsed) ? `: ${safeMessage(created.parsed)}` : ''}`)
    const createdData = dataOf(created.raw)
    const createdFailures = contractFailures(createdData, created.raw, pin)
    must(createdFailures.length === 0, 'placement.create_contract', `placement create failed ${createdFailures.join(',')}`)
    const sessionId = createdData.sessionId
    const read = await gatewayCall({
      method: 'GET', path: `/api/v1/assessment/placement/sessions/${encodeURIComponent(sessionId)}`, token: input.token,
    })
    calls.push({ id: 'read', method: 'GET', path: '/api/v1/assessment/placement/sessions/{sessionId}', status: read.status, bodySha256: sha256Text(read.raw) })
    must(calls.length === MAX_CALLS, 'placement.call_budget', 'placement pair must be exactly one POST and one GET')
    must(read.status === 200, 'placement.read_status', `placement read returned HTTP ${read.status}${safeMessage(read.parsed) ? `: ${safeMessage(read.parsed)}` : ''}`)
    const readData = dataOf(read.raw)
    const readFailures = contractFailures(readData, read.raw, pin)
    must(readFailures.length === 0, 'placement.read_contract', `placement read failed ${readFailures.join(',')}`)
    must(JSON.stringify(readData) === JSON.stringify(createdData), 'placement.readback',
      'placement read did not return the created session')
    session = {
      sessionId,
      status: 'CREATED',
      stateVersion: 1,
      http: { create: 201, read: 200 },
      manifestId: 'P1_PLACEMENT_V1',
      contentVersionId: 266100,
      contentEpoch: 1,
      snapshotId: 'snap_p1.placement.v1-266100',
      itemIds: ITEM_SPECS.map((item) => item[0]),
      itemCodes: ITEM_SPECS.map((item) => item[1]),
      itemTypes: ITEM_SPECS.map((item) => item[2]),
      acceptedSequence: 0,
      nextSequence: 1,
      currentItemId: 266001,
      targetPinMatched: true,
      answerRulePin: 'completionRuleVersion-only',
      answerLeak: false,
    }
  } catch (caught) {
    error = { id: caught.id || 'placement.error', message: caught.message }
  } finally {
    const cleanup = await stopOwned(owned)
    const ownedPorts = cleanup.filter((row) => row.service === 'content' || row.service === 'assessment')
    if (owned.length > 0 && ownedPorts.some((row) => row.stopped !== true || row.portFree !== true)) {
      cleanupError = { id: 'placement.cleanup', message: 'owned Content or Assessment JVM did not stop and release its port' }
    }
    const result = {
      kind: 'MB006_PLACEMENT_START_READ',
      schemaVersion: '1',
      generatedAt: new Date().toISOString(),
      status: error || cleanupError ? 'FAIL' : 'PASS',
      optIn: OPT_IN,
      dec04: 'NOT_ASSERTED',
      answersSubmitted: 0,
      scoreRequested: false,
      retestRequested: false,
      skipRequested: false,
      learningStarted: false,
      sealedCalledByHarness: false,
      planEnsured: false,
      bankSeededByHarness: false,
      schemaRowCount: 'NOT_QUERIED',
      attachedToExisting: false,
      stoppedUntracked: false,
      calls,
      session,
      launch,
      learningPortBusy,
      cleanup: {
        trackedOnly: true,
        owned: owned.length,
        services: cleanup,
        learningPort: LEARNING_PORT,
        learningStarted: false,
      },
      cleanupError,
      error,
    }
    return result
  }
}

function safePlacementMessage(message) {
  const text = String(message || 'placement browser services failed')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '{redacted}')
  if (/\/\/[^/\s]*:[^/\s]*@/u.test(text) || /Bearer\s+/iu.test(text)) return 'placement browser services failed'
  return text.length > 300 ? text.slice(0, 300) : text
}

/**
 * Start the owned Content and Assessment JVMs, run task while they are up,
 * and always stop only those two. No placement POST and no bearer argument.
 */
export async function withPlacementBrowserServices(input = {}, task) {
  const owned = []
  let error = null
  let launch = null
  let learningPortBusy = null
  let cleanupError = null
  let taskResult = null
  try {
    must(input && typeof task === 'function', 'placement.browser_task', 'the browser task callback is required')
    must(!Object.prototype.hasOwnProperty.call(input, 'token'), 'placement.browser_token',
      'browser mode does not accept a placement bearer')
    launch = await validatePlacementLaunch({ phase: 'run', gatewayJar: input.gatewayJar, browser: true })
    must(typeof input.java === 'string' && input.java.length > 0, 'placement.java', 'the Java 25 runtime is required')
    must(input.trustStore && input.trustStorePassword && fs.existsSync(input.trustStore),
      'placement.truststore', 'the IAM TLS truststore is required')
    const scratch = input.logDirectory
    must(typeof scratch === 'string' && fs.existsSync(scratch) && fs.statSync(scratch).isDirectory()
      && (fs.statSync(scratch).mode & 0o077) === 0,
    'placement.log_directory', 'the private log directory is required')
    const trust = { store: input.trustStore, password: input.trustStorePassword }
    const contentAccount = readEnvAccount('CONTENT')
    const assessmentAccount = readEnvAccount('ASSESSMENT')
    const contentChild = startJvm(input.java, process.env.MB006_CONTENT_JAR, trust, scratch,
      `${scratch}/content-service.log`, contentEnv(contentAccount, scratch))
    owned.push({ service: 'content', port: CONTENT_PORT, child: contentChild })
    contentChild.once('error', (spawnError) => { contentChild.spawnError = spawnError.message; owned[0].spawnError = spawnError.message })
    await waitHealthy(owned[0], CONTENT_HEALTH_MS)
    const assessmentChild = startJvm(input.java, process.env.MB006_ASSESSMENT_JAR, trust, scratch,
      `${scratch}/assessment-service.log`, assessmentEnv(assessmentAccount, scratch))
    owned.push({ service: 'assessment', port: ASSESSMENT_PORT, child: assessmentChild })
    assessmentChild.once('error', (spawnError) => { assessmentChild.spawnError = spawnError.message; owned[1].spawnError = spawnError.message })
    await waitHealthy(owned[1], ASSESSMENT_HEALTH_MS)
    must(await tcp(LEARNER_PORT), 'placement.learner_still_listening', 'Learner stopped before the placement browser')
    must(await tcp(GATEWAY_PORT), 'placement.gateway_still_listening', 'Gateway stopped before the placement browser')
    learningPortBusy = await tcp(LEARNING_PORT)
    must(!learningPortBusy, 'placement.learning_unstarted', '127.0.0.1:18090 must stay unstarted; attachment is not allowed')
    taskResult = await task({ launch })
  } catch (caught) {
    error = { id: caught.id || 'placement.error', message: safePlacementMessage(caught.message) }
  } finally {
    const cleanup = await stopOwned(owned)
    const ownedPorts = cleanup.filter((row) => row.service === 'content' || row.service === 'assessment')
    if (owned.length > 0 && ownedPorts.some((row) => row.stopped !== true || row.portFree !== true)) {
      cleanupError = { id: 'placement.cleanup', message: 'owned Content or Assessment JVM did not stop and release its port' }
    }
    return {
      status: error || cleanupError ? 'FAIL' : 'PASS',
      taskResult,
      launch,
      learningPortBusy,
      cleanup: {
        trackedOnly: true,
        owned: owned.length,
        services: cleanup,
        learningPort: LEARNING_PORT,
        learningStarted: false,
      },
      cleanupError,
      error,
      dec04: 'NOT_ASSERTED',
      answersSubmitted: 0,
      scoreRequested: false,
      retestRequested: false,
      skipRequested: false,
      learningStarted: false,
      programmaticPlacementPost: false,
      sealedCalledByHarness: false,
      planEnsured: false,
      bankSeededByHarness: false,
      targetSeeded: false,
      attachedToExisting: false,
      stoppedUntracked: false,
    }
  }
}

function safeFullMessage(message) {
  const secrets = [
    process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET,
    process.env.MB007_LEARNING_JDBC_PASSWORD,
    process.env.MB006_CONTENT_JDBC_PASSWORD,
    process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
    process.env.MB004_MYSQL_PASSWORD,
    process.env.MB033_LEARNER_JDBC_PASSWORD,
  ].filter((value) => typeof value === 'string' && value.length > 0)
  const text = safePlacementMessage(message)
  for (const secret of secrets) {
    if (text.includes(secret)) return 'full browser services failed'
  }
  return text
}

function assessmentScoreEnv(secret) {
  return {
    ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL: CONTENT_BASE,
    ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL: IAM_SCORE_ORIGIN,
    ASSESSMENT_PLACEMENT_SCORE_CLIENT_ID: SCORE_CLIENT_ID,
    ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET: secret,
  }
}

/**
 * Start owned Content, then Assessment with the workload secret only in that
 * JVM, then Learning. Hold all three until task returns. Stop only those
 * children. No placement, answer, or plan POST.
 */
export async function withFullBrowserServices(input = {}, task) {
  const owned = []
  let error = null
  let launch = null
  let learningLaunch = null
  let learningPortBusy = null
  let cleanupError = null
  let taskResult = null
  let learningStarted = false
  try {
    must(input && typeof task === 'function', 'placement.full_browser_task', 'the browser task callback is required')
    must(!Object.prototype.hasOwnProperty.call(input, 'token'), 'placement.full_browser_token',
      'full browser mode does not accept a placement bearer')
    const { assertFullLearningPreconditions, startOwnedLearningJvm } = await import(new URL('./learning-plan-ensure.mjs', import.meta.url))
    await assertFullLearningPreconditions({ gatewayJar: input.gatewayJar })
    launch = await validatePlacementLaunch({ phase: 'run', gatewayJar: input.gatewayJar, browser: true, fullLearning: true })
    must(typeof input.java === 'string' && input.java.length > 0, 'placement.java', 'the Java 25 runtime is required')
    must(input.trustStore && input.trustStorePassword && fs.existsSync(input.trustStore),
      'placement.truststore', 'the IAM TLS truststore is required')
    const scratch = input.logDirectory
    must(typeof scratch === 'string' && fs.existsSync(scratch) && fs.statSync(scratch).isDirectory()
      && (fs.statSync(scratch).mode & 0o077) === 0,
    'placement.log_directory', 'the private log directory is required')
    const trust = { store: input.trustStore, password: input.trustStorePassword }
    const contentAccount = readEnvAccount('CONTENT')
    const assessmentAccount = readEnvAccount('ASSESSMENT')
    const contentExtra = contentEnv(contentAccount, scratch)
    must(contentExtra.CONTENT_EVENT_RELAY_ENABLED === 'false' && contentExtra.CONTENT_EVENT_CONSUMER_ENABLED === 'false',
      'placement.full_browser_content_events', 'Content event relay and consumer stay disabled')
    must(!Object.keys(contentExtra).some((key) => /KAFKA|BOOTSTRAP|SCORE_CLIENT_SECRET|SCORE_SERVICE_TOKEN/u.test(key)),
      'placement.full_browser_content_env', 'Content env must not carry Kafka or the assessment workload secret')
    const contentChild = startJvm(input.java, process.env.MB006_CONTENT_JAR, trust, scratch,
      `${scratch}/content-service.log`, contentExtra)
    owned.push({ service: 'content', port: CONTENT_PORT, child: contentChild })
    contentChild.once('error', (spawnError) => { contentChild.spawnError = spawnError.message; owned[0].spawnError = spawnError.message })
    await waitHealthy(owned[0], CONTENT_HEALTH_MS)
    const scoreSecret = assessmentWorkloadSecret()
    const assessmentExtra = { ...assessmentEnv(assessmentAccount, scratch), ...assessmentScoreEnv(scoreSecret) }
    must(assessmentExtra.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET === scoreSecret
      && assessmentExtra.ASSESSMENT_PLACEMENT_SCORE_CLIENT_ID === SCORE_CLIENT_ID
      && assessmentExtra.ASSESSMENT_PLACEMENT_SCORE_IAM_BASE_URL === IAM_SCORE_ORIGIN
      && assessmentExtra.ASSESSMENT_PLACEMENT_SCORE_CONTENT_BASE_URL === CONTENT_BASE,
    'placement.full_browser_score_env', 'Assessment receives the workload secret only on its own JVM env')
    must(!Object.keys(assessmentExtra).some((key) => /KAFKA|BOOTSTRAP|SCORE_SERVICE_TOKEN/u.test(key)),
      'placement.full_browser_assessment_kafka', 'Assessment env must not enable Kafka or a score bypass token')
    const assessmentChild = startJvm(input.java, process.env.MB006_ASSESSMENT_JAR, trust, scratch,
      `${scratch}/assessment-service.log`, assessmentExtra)
    owned.push({ service: 'assessment', port: ASSESSMENT_PORT, child: assessmentChild })
    assessmentChild.once('error', (spawnError) => { assessmentChild.spawnError = spawnError.message; owned[1].spawnError = spawnError.message })
    await waitHealthy(owned[1], ASSESSMENT_HEALTH_MS)
    must(await tcp(LEARNER_PORT), 'placement.learner_still_listening', 'Learner stopped before the full browser')
    must(await tcp(GATEWAY_PORT), 'placement.gateway_still_listening', 'Gateway stopped before the full browser')
    learningPortBusy = await tcp(LEARNING_PORT)
    must(!learningPortBusy, 'placement.learning_port_free', '127.0.0.1:18090 is already in use; attachment is not allowed')
    const learning = await startOwnedLearningJvm({
      java: input.java,
      trustStore: input.trustStore,
      trustStorePassword: input.trustStorePassword,
      logDirectory: scratch,
      gatewayJar: input.gatewayJar,
    })
    learningLaunch = learning.launch
    learningStarted = true
    owned.push({ service: 'learning', port: LEARNING_PORT, child: learning.child })
    launch = {
      ...launch,
      learning: learningLaunch,
      learningStarted: true,
      contentDirect: true,
      kafka: false,
    }
    taskResult = await task({ launch })
  } catch (caught) {
    error = { id: caught.id || 'placement.error', message: safeFullMessage(caught.message) }
  } finally {
    const cleanup = await stopOwned(owned)
    const ownedPorts = cleanup.filter((row) => row.service === 'content' || row.service === 'assessment' || row.service === 'learning')
    if (owned.length > 0 && ownedPorts.some((row) => row.stopped !== true || row.portFree !== true)) {
      cleanupError = { id: 'placement.cleanup', message: 'an owned Content, Assessment, or Learning JVM did not stop and release its port' }
    }
    return {
      status: error || cleanupError ? 'FAIL' : 'PASS',
      taskResult,
      launch,
      learningLaunch,
      learningPortBusy,
      cleanup: {
        trackedOnly: true,
        owned: owned.length,
        services: cleanup,
        learningPort: LEARNING_PORT,
        learningStarted,
      },
      cleanupError,
      error,
      dec04: 'NOT_ASSERTED',
      answersSubmittedByHarness: 0,
      scoreRequestedByHarness: false,
      scoreToken: 'UNSET',
      scoreExchange: 'IAM_CLIENT_CREDENTIALS',
      serviceTokenHeldByCaller: false,
      retestRequested: false,
      skipRequested: false,
      learningStarted,
      programmaticPlacementPost: false,
      programmaticAnswerPost: false,
      programmaticPlanPost: false,
      sealedCalledByHarness: false,
      planEnsuredByHarness: false,
      bankSeededByHarness: false,
      targetSeeded: false,
      attachedToExisting: false,
      stoppedUntracked: false,
      harnessCalls: 0,
      kafka: false,
    }
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  console.error('REFUSING: MB-006 placement start/read is in-process only. Do not pass a bearer via the environment.')
  process.exit(2)
}

