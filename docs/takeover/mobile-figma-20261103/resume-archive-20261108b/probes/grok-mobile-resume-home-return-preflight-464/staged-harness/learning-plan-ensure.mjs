/**
 * MB-007 learning-plan opt-in. In-process only, after G80 completion.
 *
 * Absent MB007_LEARNING_PLAN_ENSURE, callers do not start Learning.
 * Present, and only after the verified eligible-adult report and completed
 * session, this module starts one Learning JVM on 127.0.0.1:18090 inside the
 * already-running Learner, Content, and Assessment lifetime. The bearer,
 * report id, and verified pins stay in memory. Content sealed and plan-item
 * reads stay direct. This module does not start Docker, MySQL, Kafka, or a
 * second account, and it does not replan or complete a task.
 *
 * Direct execution refuses. Import runLearningPlanEnsure from placement.
 * startOwnedLearningJvm is the full-browser holder only. It does not POST
 * plans:ensure and is not used when MB006_PLACEMENT_FULL_BROWSER is absent.
 */
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import crypto from 'node:crypto'
import { spawn, execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export const OPT_IN = 'YES_RUN_MB007_LEARNING_PLAN_ENSURE'
export const CALL_BUDGET = 3
export const LEARNING_JAR_SHA256 = '5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f'
export const CANONICAL_CONTENT_LOCALE = 'en-US'

const PORT = 18090
const GATEWAY_HOST = '127.0.0.1'
const GATEWAY_PORT = 18070
const LEARNER_PORT = 18088
const CONTENT_PORT = 18089
const ASSESSMENT_PORT = 18091
const ORIGIN = 'http://127.0.0.1:18183'
const REQUEST_TIMEOUT_MS = 20_000
const MAX_RESPONSE_BYTES = 1_048_576
const HEALTH_MS = 90_000
const JVM_MEMORY = ['-Xms64m', '-Xmx384m', '-XX:ActiveProcessorCount=2']
const ENSURE_PATH = '/api/v1/learning/plans:ensure'
const TODAY_PATH = '/api/v1/learning/today'
const TASK_TYPES = new Set(['VOCABULARY_REVIEW', 'GRAMMAR_PRACTICE', 'READING', 'LISTENING_DICTATION'])
const SAFE_MESSAGE = /^[A-Za-z0-9 _:/-]{1,180}$/u
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex')
const sha256Text = (value) => sha256(Buffer.from(value, 'utf8'))
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const RULE_DIGEST = sha256Text('P1_PLACEMENT_V1')

export function learningPlanEnabled() {
  return process.env.MB007_LEARNING_PLAN_ENSURE === OPT_IN
}

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

function sameValue(left, right) {
  const stable = (value) => {
    if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
    if (value && typeof value === 'object') {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }
  return stable(left) === stable(right)
}

function textOf(value) {
  return value === undefined || value === null ? '' : String(value)
}

function explanationFor(goalCode, minutes) {
  const code = String(goalCode || '').toLowerCase()
  const labels = {
    zero_basis: '零基础', foundation: '零基础', workplace_daily: '职场与日常',
    cet_4_6: '四六级', college_cet: '四六级', postgraduate: '考研英语', postgraduate_english: '考研英语',
  }
  return `根据目标「${labels[code] || '当前目标'}」和每日 ${minutes} 分钟，安排今天的练习。`
}

function claims(token) {
  const parts = String(token || '').split('.')
  must(parts.length === 3, 'learning.jwt', 'the in-memory learner access token is not a three-part JWT')
  const read = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
  const header = read(parts[0])
  const payload = read(parts[1])
  const list = (value) => Array.isArray(value) ? value : typeof value === 'string' ? [value] : []
  must(header.alg === 'RS256', 'learning.jwt_alg', 'the learner access token must be RS256')
  must(payload.iss === 'http://127.0.0.1:18087' && list(payload.aud).includes('yuxuexing-api'),
    'learning.jwt_audience', 'the learner access token issuer or audience is wrong')
  must(list(payload.roles).includes('learner') && payload.tenant_id === 'platform'
    && payload.adult_gate === 'PASSED' && payload.consent_state === 'GRANTED'
    && payload.phase === 'phase-1' && payload.account_status === 'ACTIVE'
    && payload.token_type === 'access',
  'learning.jwt_eligibility', 'the learner access token is not an eligible adult Phase 1 access token')
  for (const permission of ['learning.plan.write', 'learning.review.read']) {
    must(list(payload.permissions).includes(permission), 'learning.jwt_permission',
      `the learner access token is missing ${permission}`)
  }
}

function account() {
  const schema = process.env.MB007_LEARNING_SCHEMA
  const url = process.env.MB007_LEARNING_JDBC_URL
  const user = process.env.MB007_LEARNING_JDBC_USERNAME
  const password = process.env.MB007_LEARNING_JDBC_PASSWORD
  must(/^mb007_lrn_[a-z0-9]{8,24}$/u.test(String(schema || '')), 'learning.schema',
    'Learning schema must be a dedicated mb007_lrn_* schema, not learning_service')
  must(url === jdbcUrl(schema) && !url.includes('@'), 'learning.jdbc',
    'Learning JDBC URL must be the dedicated loopback schema on 127.0.0.1:13306')
  must(/^mb007l_[a-z0-9]{8,24}$/u.test(String(user || '')) && user !== 'root', 'learning.user',
    'Learning DB user must be a dedicated non-root mb007l_* account')
  must(passwordOk(password), 'learning.password', 'Learning DB password must be an unspaced secret of at least 16 characters')
  const others = [
    process.env.MB004_MYSQL_USER, process.env.MB033_LEARNER_JDBC_USERNAME,
    process.env.MB006_CONTENT_JDBC_USERNAME, process.env.MB006_ASSESSMENT_JDBC_USERNAME,
  ]
  must(others.every((other) => user !== other), 'learning.user_not_shared',
    'the Learning DB user must not reuse the IAM, Learner, Content, or Assessment account')
  const otherPasswords = [
    process.env.MB004_MYSQL_PASSWORD, process.env.MB033_LEARNER_JDBC_PASSWORD,
    process.env.MB006_CONTENT_JDBC_PASSWORD, process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
  ]
  must(otherPasswords.every((other) => !other || password !== other), 'learning.password_not_shared',
    'the Learning DB password must not reuse the IAM, Learner, Content, or Assessment password')
  const otherSchemas = [
    'iam_service', 'learner_service', 'learning_service',
    process.env.MB006_CONTENT_SCHEMA, process.env.MB006_ASSESSMENT_SCHEMA,
  ]
  must(otherSchemas.every((other) => schema !== other), 'learning.schema_not_shared',
    'the Learning schema must be a fifth owner schema')
  return { schema, url, user, password }
}

function assertJar() {
  const jar = process.env.MB007_LEARNING_JAR
  const declared = String(process.env.MB007_LEARNING_JAR_SHA256 || '').toLowerCase()
  must(typeof jar === 'string' && fs.existsSync(jar) && fs.statSync(jar).isFile(),
    'learning.jar.file', 'MB007_LEARNING_JAR must be the exact pinned jar file')
  const actual = sha256(fs.readFileSync(jar))
  must(declared === LEARNING_JAR_SHA256 && actual === LEARNING_JAR_SHA256, 'learning.jar.sha256',
    'MB007_LEARNING_JAR SHA-256 does not match the B77 owner pin')
  const checks = [
    ['BOOT-INF/classes/com/englishflow/learning/web/V2PlansController.class', 'placementReportId is required'],
    ['BOOT-INF/classes/com/englishflow/learning/web/V2PlansController.class', 'learning.plan.write'],
    ['BOOT-INF/classes/com/englishflow/learning/web/V2LearningController.class', 'learning.review.read'],
    ['BOOT-INF/classes/com/englishflow/learning/adapter/http/HttpPlanContentPort.class', '/internal/v1/content/placement-bank/plan-items'],
    ['BOOT-INF/classes/com/englishflow/learning/adapter/http/VerifiedPlacementReport.class', 'only an assessed placement can pin a plan'],
    ['BOOT-INF/classes/com/englishflow/learning/config/LearningRuntimeConfiguration.class', 'LEARNING_JDBC_URL'],
    ['BOOT-INF/classes/db/migration/V2__create_b25_learning_runtime.sql', 'b25_learning_plan'],
    ['BOOT-INF/classes/db/migration/V10__plan_input_snapshot.sql', 'learning_plan_input_snapshot'],
  ]
  for (const [entry, text] of checks) {
    must(contains(unzip(jar, entry), text), 'learning.jar.content', `MB007_LEARNING_JAR is missing ${entry} text ${text}`)
  }
  return { jar, sha256: actual }
}

export async function validateLearningPlanLaunch({ phase, gatewayJar } = {}) {
  must(learningPlanEnabled(), 'learning.opt_in', 'MB007_LEARNING_PLAN_ENSURE must be the exact opt-in token')
  must(process.env.MB006_PLACEMENT_COMPLETION === 'YES_RUN_MB006_PLACEMENT_COMPLETION'
    && process.env.MB006_PLACEMENT_CHECKPOINT === 'YES_RUN_MB006_PLACEMENT_CHECKPOINT'
    && process.env.MB006_PLACEMENT_START_READ === 'YES_RUN_MB006_PLACEMENT_START_READ',
  'learning.requires_g80', 'MB007_LEARNING_PLAN_ENSURE requires the G80 completion, checkpoint, and start/read opt-ins')
  for (const name of ['MB007_ACCESS_TOKEN', 'MB007_BEARER', 'LEARNING_ACCESS_TOKEN']) {
    must(!process.env[name], 'learning.forbidden_env', `${name} must be unset; the bearer stays in memory`)
  }
  const owned = account()
  const jar = assertJar()
  must(typeof gatewayJar === 'string' && fs.existsSync(gatewayJar), 'learning.gateway_jar',
    'the running Gateway jar path is required')
  const policy = unzip(gatewayJar, 'BOOT-INF/classes/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.class')
  must(contains(policy, 'plans-ensure') && contains(policy, 'today-v2')
    && contains(policy, 'V2PlansController.java') && contains(policy, 'V2LearningController.java'),
  'learning.gateway_routes', 'the Gateway jar does not contain plans:ensure and learning/today')
  must(!(await tcp(PORT)), 'learning.port_free', '127.0.0.1:18090 is already in use; attachment is not allowed')
  return {
    phase: phase || 'check',
    schema: owned.schema,
    user: owned.user,
    jarSha256: jar.sha256,
    port: PORT,
    route: 'TARGET',
    callBudget: CALL_BUDGET,
  }
}

function dataOf(raw) {
  let parsed = null
  try { parsed = JSON.parse(raw) } catch { parsed = null }
  must(parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).join('|') === 'data'
    && parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data),
  'learning.envelope', 'the Gateway body is not the controller {data} envelope')
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
          finish(reject, Object.assign(new Error('learning response exceeds bound'), { id: 'learning.response_bound' }))
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
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(Object.assign(new Error('learning request timed out'), { id: 'learning.timeout' })))
    req.on('error', (error) => finish(reject, error.id ? error : Object.assign(error, { id: 'learning.transport' })))
    if (payload) req.write(payload)
    req.end()
  })
}

function childEnv(scratch, extra) {
  return {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || '',
    TMPDIR: scratch,
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    OTEL_ENABLED: 'false',
    OTEL_TRACING_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
    MANAGEMENT_TRACING_EXPORT_ENABLED: 'false',
    SPRING_MAIN_BANNER_MODE: 'off',
    ...extra,
  }
}

function learningEnv(owned, scratch) {
  return {
    SERVER_ADDRESS: '127.0.0.1',
    SERVER_PORT: String(PORT),
    LEARNING_SERVICE_SERVER_ADDRESS: '127.0.0.1',
    LEARNING_SERVICE_PORT: String(PORT),
    LEARNING_PHASE: 'phase-1',
    LEARNING_PERSISTENCE_MODE: 'jdbc',
    LEARNING_FLYWAY_ENABLED: 'true',
    LEARNING_SCHEMA: owned.schema,
    LEARNING_JDBC_URL: owned.url,
    LEARNING_JDBC_USERNAME: owned.user,
    LEARNING_JDBC_PASSWORD: owned.password,
    LEARNING_JDBC_DRIVER: 'com.mysql.cj.jdbc.Driver',
    LEARNING_PORTS_MODE: 'http',
    LEARNING_PORTS_LEARNER_BASE_URL: `http://127.0.0.1:${LEARNER_PORT}`,
    LEARNING_PORTS_CONTENT_BASE_URL: `http://127.0.0.1:${CONTENT_PORT}`,
    LEARNING_PORTS_ASSESSMENT_BASE_URL: `http://127.0.0.1:${ASSESSMENT_PORT}`,
    LEARNING_RESOURCE_SERVER_ENABLED: 'true',
    LEARNING_SECURITY_ISSUER_URI: 'http://127.0.0.1:18087',
    LEARNING_SECURITY_JWK_SET_URI: 'https://127.0.0.1:18087/api/v1/auth/jwks',
    LEARNING_SECURITY_AUDIENCE: 'yuxuexing-api',
    LEARNING_EVENT_RELAY_ENABLED: 'false',
    TMPDIR: scratch,
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
      cwd: scratch, env: childEnv(scratch, extra), stdio: ['ignore', fd, fd], windowsHide: true,
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

function safeTail(logFile, secret) {
  try {
    const text = fs.readFileSync(logFile, 'utf8').slice(-500)
    if ((secret && text.includes(secret)) || /bearer|eyJ|password|secret/iu.test(text)) return 'withheld'
    return text.replace(/\s+/gu, ' ').slice(-180)
  } catch {
    return 'unavailable'
  }
}

async function waitHealthy(entry, timeoutMs, secret) {
  const deadline = Date.now() + timeoutMs
  let last = 'no response'
  while (Date.now() < deadline) {
    if (entry.spawnError) fail('learning.spawn', 'learning JVM did not start')
    if (entry.child.exitCode !== null || entry.child.signalCode !== null) {
      fail('learning.exited', `learning JVM exited before listening (${safeTail(entry.log, secret)})`)
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
  fail('learning.timeout', `learning did not become ready on 127.0.0.1:${PORT} (${last}; ${safeTail(entry.log, secret)})`)
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

function pinSame(actual, expected, fields) {
  return Boolean(actual && expected) && fields.every((field) => textOf(actual[field]) === textOf(expected[field]) && textOf(expected[field]) !== '')
}

function ensureFailures(data, memory, expectedExplanation, replayed) {
  const failures = []
  const keys = data && typeof data === 'object' ? Object.keys(data).sort().join('|') : ''
  if (keys !== 'explanation|plan|planId|planVersion|planningInput|replayed|status|targetMinutes|tasks') failures.push('keys')
  if (!/^plan-[1-9][0-9]*$/u.test(String(data?.planId || ''))) failures.push('planId')
  if (data?.status !== 'ACTIVE') failures.push('status')
  if (data?.targetMinutes !== memory.dailyQuotaMinutes) failures.push('quota')
  if (!Number.isInteger(data?.planVersion) || data.planVersion < 1) failures.push('planVersion')
  if (data?.replayed !== replayed) failures.push('replayed')
  if (data?.explanation !== expectedExplanation) failures.push('explanation')
  const input = data?.planningInput
  if (!input || input.contentLocale !== memory.contentLocale || input.dailyQuotaMinutes !== memory.dailyQuotaMinutes) failures.push('planningInput')
  if (textOf(input?.timezone) !== 'Asia/Shanghai') failures.push('timezone')
  if (textOf(input?.targetId) !== textOf(memory.targetPin.targetId)
    || textOf(input?.targetVersion) !== textOf(memory.targetPin.targetVersion)
    || textOf(input?.contentVersionId) !== textOf(memory.contentPin.contentVersionId)
    || textOf(input?.contentEpoch) !== textOf(memory.contentPin.contentEpoch)) failures.push('inputPins')
  const baseline = input?.placementBaseline
  if (!baseline || baseline.reportId !== memory.reportId || baseline.resultKind !== 'ASSESSED'
    || baseline.completionStatus !== 'COMPLETED' || baseline.placementSessionId !== memory.sessionId) failures.push('baseline')
  if (!pinSame(baseline?.targetPin, memory.targetPin, ['targetId', 'targetVersion', 'targetSnapshotDigest'])) failures.push('targetPin')
  if (!pinSame(baseline?.contentPin, memory.contentPin, ['contentVersionId', 'contentEpoch', 'snapshotId', 'snapshotHash'])) failures.push('contentPin')
  const rule = baseline?.answerRulePin
  if (!rule || rule.completionRuleVersion !== 'P1_PLACEMENT_V1' || rule.answerRuleSetVersion !== 'P1_PLACEMENT_V1'
    || rule.answerRuleVersion !== 'P1_PLACEMENT_V1' || rule.ruleDigest !== RULE_DIGEST) failures.push('rulePin')
  const plan = data?.plan
  if (!plan || plan.planId !== data?.planId || plan.planVersion !== data?.planVersion
    || textOf(plan.contentEpoch) !== textOf(memory.contentPin.contentEpoch)) failures.push('planRef')
  const tasks = Array.isArray(data?.tasks) ? data.tasks : null
  const allowed = new Set(memory.itemIds.map((itemId) => textOf(itemId)))
  if (!tasks || tasks.length < 1 || tasks.length > allowed.size) failures.push('tasks')
  const seen = new Set()
  for (const task of tasks || []) {
    const itemId = textOf(task?.itemId)
    if (!task || !Number.isInteger(task.taskId) || task.taskId < 1 || !allowed.has(itemId) || seen.has(itemId)
      || task.status !== 'PLANNED' || !TASK_TYPES.has(task.taskType)) failures.push('task')
    seen.add(itemId)
    const ref = task?.practiceRef
    if (!ref || textOf(ref.contentVersionId) !== textOf(memory.contentPin.contentVersionId)
      || typeof ref.contentCode !== 'string' || !ref.contentCode
      || typeof ref.questionItemId !== 'string' || !ref.questionItemId) failures.push('practiceRef')
  }
  return failures
}

function stableEnsure(left, right) {
  const copy = (value) => {
    const next = { ...value, replayed: undefined }
    if (next.plan) next.plan = { ...next.plan, generatedAt: undefined }
    return next
  }
  return sameValue(copy(left), copy(right))
}

function todayFailures(data, ensured) {
  const failures = []
  if (!data || typeof data.principalId !== 'string' || !data.principalId) failures.push('owner')
  if (data?.planId !== ensured.planId || data?.status !== 'ACTIVE' || data?.planVersion !== ensured.planVersion) failures.push('plan')
  if (data?.targetMinutes !== ensured.targetMinutes) failures.push('quota')
  const items = Array.isArray(data?.items) ? data.items : null
  const taskIds = new Set((ensured.tasks || []).map((task) => textOf(task.itemId)))
  if (!items || items.length !== ensured.tasks.length || data?.count !== items.length) failures.push('items')
  const seen = new Set()
  for (const item of items || []) {
    const itemId = textOf(item?.itemId)
    if (!taskIds.has(itemId) || seen.has(itemId) || item?.stage !== 'NEW') failures.push('item')
    seen.add(itemId)
    const ref = item?.practiceRef
    if (!ref || textOf(ref.contentVersionId) !== textOf(ensured.planningInput.contentVersionId)) failures.push('practiceRef')
  }
  if (data?.algorithmVersion !== 'SM2_Q03_V1') failures.push('algorithm')
  if (data?.emptyReason !== 'READY') failures.push('emptyReason')
  if (!data?.firstLearning || data.firstLearning.reason !== 'INCOMPLETE' || data.firstLearning.guideVisible !== true) failures.push('firstLearning')
  if (data?.explanation !== ensured.explanation || !Number.isInteger(data?.explanationPinVersion) || data.explanationPinVersion < 1) failures.push('explanation')
  if (typeof data?.generatedAt !== 'string' || !data.generatedAt) failures.push('generatedAt')
  if (!Number.isInteger(data?.deferredCount) || data.deferredCount < 0) failures.push('deferred')
  return failures
}

function observations(data, today, calls) {
  return {
    planId: data.planId,
    planStatus: data.status,
    planVersion: data.planVersion,
    targetMinutes: data.targetMinutes,
    contentLocale: data.planningInput.contentLocale,
    reportId: data.planningInput.placementBaseline.reportId,
    taskCount: data.tasks.length,
    practiceRefCount: data.tasks.filter((task) => task.practiceRef).length,
    todayCount: today.items.length,
    replayed: [calls[0] ? false : null, true],
    sameKeyStable: true,
    targetPinMatched: true,
    contentPinMatched: true,
    quota: data.targetMinutes,
  }
}

export async function assertFullLearningPreconditions({ gatewayJar } = {}) {
  must(process.env.MB006_PLACEMENT_FULL_BROWSER === 'MB006_PLACEMENT_FULL_BROWSER', 'learning.full_browser_opt_in',
    'MB006_PLACEMENT_FULL_BROWSER must be the exact full-browser opt-in')
  must(!process.env.MB007_LEARNING_PLAN_ENSURE, 'learning.full_browser_exclusive',
    'MB007_LEARNING_PLAN_ENSURE must be unset; full browser does not call plans:ensure')
  for (const name of ['MB007_ACCESS_TOKEN', 'MB007_BEARER', 'LEARNING_ACCESS_TOKEN', 'MB006_ACCESS_TOKEN']) {
    must(!process.env[name], 'learning.forbidden_env', `${name} must be unset; the bearer stays in the browser`)
  }
  const owned = account()
  const jar = assertJar()
  must(typeof gatewayJar === 'string' && fs.existsSync(gatewayJar), 'learning.gateway_jar',
    'the running Gateway jar path is required')
  const policy = unzip(gatewayJar, 'BOOT-INF/classes/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.class')
  must(contains(policy, 'plans-ensure') && contains(policy, 'today-v2')
    && contains(policy, 'V2PlansController.java') && contains(policy, 'V2LearningController.java'),
  'learning.gateway_routes', 'the Gateway jar does not contain plans:ensure and learning/today')
  must(!(await tcp(PORT)), 'learning.port_free', '127.0.0.1:18090 is already in use; attachment is not allowed')
  return {
    schema: owned.schema,
    user: owned.user,
    jarSha256: jar.sha256,
    port: PORT,
    route: 'TARGET',
    kafka: false,
  }
}

export async function startOwnedLearningJvm(input = {}) {
  const launch = await assertFullLearningPreconditions({ gatewayJar: input.gatewayJar })
  must(await tcp(LEARNER_PORT) && await tcp(CONTENT_PORT) && await tcp(ASSESSMENT_PORT) && await tcp(GATEWAY_PORT),
    'learning.siblings_listening', 'Learner, Content, Assessment, and Gateway must still be listening')
  must(typeof input.java === 'string' && input.java.length > 0, 'learning.java', 'the Java 25 runtime is required')
  must(input.trustStore && input.trustStorePassword && fs.existsSync(input.trustStore),
    'learning.truststore', 'the IAM TLS truststore is required')
  const scratch = input.logDirectory
  must(typeof scratch === 'string' && fs.existsSync(scratch) && fs.statSync(scratch).isDirectory()
    && (fs.statSync(scratch).mode & 0o077) === 0,
  'learning.log_directory', 'the private log directory is required')
  const ownedAccount = account()
  const env = learningEnv(ownedAccount, scratch)
  must(env.LEARNING_PORTS_MODE === 'http' && env.LEARNING_PERSISTENCE_MODE === 'jdbc'
    && env.LEARNING_FLYWAY_ENABLED === 'true' && env.LEARNING_EVENT_RELAY_ENABLED === 'false'
    && env.LEARNING_PORTS_LEARNER_BASE_URL === `http://127.0.0.1:${LEARNER_PORT}`
    && env.LEARNING_PORTS_CONTENT_BASE_URL === `http://127.0.0.1:${CONTENT_PORT}`
    && env.LEARNING_PORTS_ASSESSMENT_BASE_URL === `http://127.0.0.1:${ASSESSMENT_PORT}`
    && env.LEARNING_RESOURCE_SERVER_ENABLED === 'true',
  'learning.env', 'Learning must use JDBC, Flyway, direct HTTP owner ports, and no event relay')
  must(!Object.keys(env).some((key) => /KAFKA|BOOTSTRAP|SCORE_CLIENT_SECRET|SCORE_SERVICE_TOKEN/u.test(key)),
    'learning.kafka', 'Learning env must not enable Kafka or carry the assessment workload secret')
  const scoreSecret = process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET
  must(!scoreSecret || !Object.values(env).includes(scoreSecret), 'learning.secret_isolation',
    'the assessment workload secret must not be copied into the Learning JVM')
  const log = `${scratch}/learning-service.log`
  const child = startJvm(input.java, process.env.MB007_LEARNING_JAR,
    { store: input.trustStore, password: input.trustStorePassword }, scratch, log, env)
  const entry = { service: 'learning', port: PORT, child, log }
  child.once('error', (spawnError) => { child.spawnError = spawnError.message; entry.spawnError = spawnError.message })
  try {
    await waitHealthy(entry, HEALTH_MS, ownedAccount.password)
  } catch (caught) {
    await stopChild(child)
    throw caught
  }
  return {
    child,
    launch: {
      ...launch,
      adapters: {
        mode: 'http',
        learner: env.LEARNING_PORTS_LEARNER_BASE_URL,
        content: env.LEARNING_PORTS_CONTENT_BASE_URL,
        assessment: env.LEARNING_PORTS_ASSESSMENT_BASE_URL,
      },
      flyway: true,
      jdbc: true,
      kafka: false,
    },
  }
}

export async function runLearningPlanEnsure(input = {}) {
  const calls = []
  const owned = []
  let error = null
  let observed = null
  let jvmStarted = false
  let planEnsured = false
  let cleanup = []
  const scratch = input.logDirectory
  try {
    must(input && input.optIn === OPT_IN, 'learning.opt_in', 'exact in-process opt-in is required')
    must(input.g80 && input.g80.status === 'COMPLETED' && input.g80.reportStable === true
      && input.g80.answersSubmitted === 10 && input.g80.replays === 1
      && input.g80.reportId === input.reportId,
    'learning.g80_verified', 'learning plan continues only after the verified G80 report and completed session')
    claims(input.token)
    must(/^rpt_[0-9a-f]{32}$/u.test(String(input.reportId || '')), 'learning.report_id',
      'the verified owner report id is not the G80 report id')
    must(input.contentLocale === CANONICAL_CONTENT_LOCALE, 'learning.content_locale',
      'the verified content locale is not the canonical en-US profile locale')
    must(input.dailyQuotaMinutes === 30 && input.goalCode === 'COLLEGE_CET', 'learning.target_memory',
      'the verified target quota or goal is not the B82 COLLEGE_CET 30-minute target')
    must(Array.isArray(input.itemIds) && input.itemIds.length === 10, 'learning.items',
      'the verified placement session did not carry ten item ids')
    const launch = await validateLearningPlanLaunch({ phase: 'run', gatewayJar: input.gatewayJar })
    must(await tcp(LEARNER_PORT) && await tcp(CONTENT_PORT) && await tcp(ASSESSMENT_PORT) && await tcp(GATEWAY_PORT),
      'learning.siblings_listening', 'Learner, Content, Assessment, and Gateway must still be listening')
    must(typeof input.java === 'string' && input.java.length > 0, 'learning.java', 'the Java 25 runtime is required')
    must(input.trustStore && input.trustStorePassword && fs.existsSync(input.trustStore),
      'learning.truststore', 'the B82 IAM TLS truststore is required')
    must(typeof scratch === 'string' && fs.existsSync(scratch) && fs.statSync(scratch).isDirectory()
      && (fs.statSync(scratch).mode & 0o077) === 0,
    'learning.log_directory', 'the private log directory is required')
    const ownedAccount = account()
    const env = learningEnv(ownedAccount, scratch)
    must(env.LEARNING_PORTS_MODE === 'http' && env.LEARNING_PERSISTENCE_MODE === 'jdbc'
      && env.LEARNING_FLYWAY_ENABLED === 'true' && env.LEARNING_EVENT_RELAY_ENABLED === 'false'
      && env.LEARNING_PORTS_CONTENT_BASE_URL === `http://127.0.0.1:${CONTENT_PORT}`
      && env.LEARNING_RESOURCE_SERVER_ENABLED === 'true',
    'learning.env', 'Learning must use JDBC, Flyway, HTTP owner ports, and no event relay')
    const log = `${scratch}/learning-service.log`
    const child = startJvm(input.java, process.env.MB007_LEARNING_JAR,
      { store: input.trustStore, password: input.trustStorePassword }, scratch, log, env)
    owned.push({ service: 'learning', port: PORT, child, log })
    jvmStarted = true
    child.once('error', (spawnError) => { child.spawnError = spawnError.message })
    await waitHealthy(owned[0], HEALTH_MS, ownedAccount.password)
    const body = JSON.stringify({ placementReportId: input.reportId })
    const bodyKeys = Object.keys(JSON.parse(body))
    must(bodyKeys.length === 1 && bodyKeys[0] === 'placementReportId' && !body.includes('targetId')
      && !body.includes('dailyQuotaMinutes') && !body.includes('contentVersionId'),
    'learning.body', 'plans:ensure body must contain only the verified placementReportId')
    const key = `mb007-plan-${crypto.randomBytes(16).toString('hex')}`
    must(KEY_PATTERN.test(key), 'learning.idempotency_key', 'the learning Idempotency-Key is not 16-128 safe characters')
    const memory = input
    const expectedExplanation = explanationFor(input.goalCode, input.dailyQuotaMinutes)
    const created = await gatewayCall({ method: 'POST', path: ENSURE_PATH, token: input.token, key, body })
    calls.push({ id: 'ensure', method: 'POST', path: ENSURE_PATH, status: created.status, bodySha256: sha256Text(created.raw), keySha256: sha256Text(key) })
    must(calls.length <= CALL_BUDGET, 'learning.call_budget', 'learning plan call budget exceeded')
    must(created.status === 200, 'learning.ensure_status',
      `plans:ensure returned HTTP ${created.status}${safeMessage(created.parsed) ? `: ${safeMessage(created.parsed)}` : ''}`)
    const createdData = dataOf(created.raw)
    const createdProblems = ensureFailures(createdData, memory, expectedExplanation, false)
    must(createdProblems.length === 0, 'learning.ensure_contract', `plans:ensure failed ${createdProblems.join(',')}`)
    planEnsured = true
    const replay = await gatewayCall({ method: 'POST', path: ENSURE_PATH, token: input.token, key, body })
    calls.push({ id: 'replay', method: 'POST', path: ENSURE_PATH, status: replay.status, bodySha256: sha256Text(replay.raw), keySha256: sha256Text(key) })
    must(calls.length <= CALL_BUDGET, 'learning.call_budget', 'learning plan call budget exceeded')
    must(replay.status === 200, 'learning.replay_status',
      `plans:ensure replay returned HTTP ${replay.status}${safeMessage(replay.parsed) ? `: ${safeMessage(replay.parsed)}` : ''}`)
    const replayData = dataOf(replay.raw)
    const replayProblems = ensureFailures(replayData, memory, expectedExplanation, true)
    must(replayProblems.length === 0, 'learning.replay_contract', `plans:ensure replay failed ${replayProblems.join(',')}`)
    must(stableEnsure(createdData, replayData), 'learning.replay_stable',
      'same-key plans:ensure replay did not keep the same plan, pins, quota, and tasks')
    const today = await gatewayCall({ method: 'GET', path: TODAY_PATH, token: input.token })
    calls.push({ id: 'today', method: 'GET', path: TODAY_PATH, status: today.status, bodySha256: sha256Text(today.raw) })
    must(calls.length === CALL_BUDGET, 'learning.call_budget',
      'learning plan budget is one ensure, one same-key replay, and one today read')
    must(today.status === 200, 'learning.today_status',
      `learning/today returned HTTP ${today.status}${safeMessage(today.parsed) ? `: ${safeMessage(today.parsed)}` : ''}`)
    const todayData = dataOf(today.raw)
    const todayProblems = todayFailures(todayData, createdData)
    must(todayProblems.length === 0, 'learning.today_contract', `learning/today failed ${todayProblems.join(',')}`)
    observed = {
      ...observations(createdData, todayData, calls),
      http: { ensure: 200, replay: 200, today: 200 },
      launch,
    }
  } catch (caught) {
    error = { id: caught.id || 'learning.error', message: caught.message }
  } finally {
    for (const entry of owned.slice().reverse()) {
      let stopped = { stopped: false }
      let stopError = null
      try {
        stopped = await stopChild(entry.child)
      } catch (stopFailure) {
        stopError = stopFailure.message
      }
      const portFree = !(await tcp(entry.port))
      cleanup.push({ service: entry.service, port: entry.port, pid: entry.child.pid || null, stopped: stopped.stopped, portFree, stopError })
      if (jvmStarted && (!stopped.stopped || !portFree) && !error) {
        error = { id: 'learning.cleanup', message: 'owned Learning JVM did not stop and release 127.0.0.1:18090' }
      }
    }
  }
  return {
    kind: 'MB007_LEARNING_PLAN_ENSURE',
    schemaVersion: '1',
    generatedAt: new Date().toISOString(),
    status: error ? 'FAIL' : 'PASS',
    optIn: OPT_IN,
    requiresG80: true,
    callBudget: CALL_BUDGET,
    separateFromIamChecks: true,
    separateFromG80Calls: true,
    jvmStarted,
    planEnsured,
    kafka: false,
    replan: false,
    taskCompletion: false,
    directDbWrite: false,
    calls,
    cleanup,
    expectedOwnerRows: { queried: false },
    error,
    ...(observed || {}),
  }
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  console.error('REFUSING: MB-007 learning plan ensure is in-process only. Do not pass a bearer via the environment.')
  process.exit(2)
}
