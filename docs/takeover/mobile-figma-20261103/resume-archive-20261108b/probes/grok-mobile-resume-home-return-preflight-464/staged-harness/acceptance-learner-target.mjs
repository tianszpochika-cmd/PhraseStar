#!/usr/bin/env node
/**
 * MB-004 / R1-008 local-only HTTP acceptance harness.
 *
 * It exercises the real IAM and Gateway jars over fixed loopback ports, with a
 * synthetic eligible identity and ONLY the three synthetic documents in
 * apps/mobile/tests/fixtures/mock-consent-publication.json.
 *
 * Safety:
 *  - default mode is inspect: no server, no DB write, no HTTP, no browser, no container;
 *  - run mode requires explicit approval and an explicitly disposable MySQL at 127.0.0.1:13306;
 *  - no repository file is written by this harness;
 *  - no token, password, cookie value, or raw auth response is printed or serialized;
 *  - credential registration, login, and refresh stay on direct IAM TLS;
 *  - Gateway receives only allow-listed bearer domain calls, the anonymous probe, JWKS, and CORS preflight.
 */
import fs from 'node:fs'
import net from 'node:net'
import http from 'node:http'
import https from 'node:https'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HARNESS_DIR = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE_REL = 'apps/mobile/tests/fixtures/mock-consent-publication.json'
const CONTROLLER_REL = 'services/iam-service/src/main/java/com/englishflow/iam/web/IamProviderBoundaryController.java'
const GATEWAY_POLICY_REL = 'services/api-gateway/src/main/java/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.java'
const MOBILE_GATEWAY_REL = 'apps/mobile/src/platform/gateway.ts'
const MOBILE_AUTH_REL = 'apps/mobile/src/auth/gateway-auth.ts'
const MOBILE_SESSION_REL = 'apps/mobile/src/stores/session.ts'
const MOBILE_CLIENT_REL = 'apps/mobile/src/api/client.ts'
const MOBILE_CONTENT_REL = 'apps/mobile/src/api/learner-content.ts'
const V19_REL = 'services/iam-service/src/main/resources/db/migration/V19__add_iam_consent_document_body.sql'
const EXPECTED_COMMIT = '034bac4565d3b8bae7fa6b27499fa174fd3d3364'
const FULL_BROWSER_COMMIT = '61b9ede7c65ef065c76c846c27fb69a52cd042cd'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const GATEWAY_BASE = `${GATEWAY_ORIGIN}/api/v1`
const IAM_ORIGIN = 'https://127.0.0.1:18087'
const IAM_BASE = `${IAM_ORIGIN}/api/v1`
const MOBILE_ORIGIN = 'http://127.0.0.1:18183'
const MOBILE_REFERER = `${MOBILE_ORIGIN}/`
const MYSQL_HOST = '127.0.0.1'
const MYSQL_PORT = 13306
const MYSQL_SCHEMA = 'iam_service'
const JDBC_URL = `jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_SCHEMA}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`
const RUN_APPROVAL = 'YES_RUN_MB004_LOCAL_ACCEPTANCE'
const DISPOSABLE_APPROVAL = 'YES_DISPOSABLE_MYSQL_13306_IAM_SERVICE'
const FIXTURE_IDS = Object.freeze({
  TERMS: 'b0040000-0000-4000-8000-000000000001',
  PRIVACY: 'b0040000-0000-4000-8000-000000000002',
  ADULT_LEARNING: 'b0040000-0000-4000-8000-000000000003',
})
const STORAGE = Object.freeze({
  TERMS: { type: 'TERMS_OF_SERVICE', purpose: 'ACCOUNT_TERMS', requirement: 'BASE_REQUIRED', capabilities: '["ACCOUNT","LEARNING"]', effect: 'RESTRICT_ALL_LEARNING_ACCESS', revoke: 1 },
  PRIVACY: { type: 'PRIVACY_NOTICE', purpose: 'PRIVACY_NOTICE', requirement: 'BASE_REQUIRED', capabilities: '["ACCOUNT","LEARNING"]', effect: 'RESTRICT_ALL_LEARNING_ACCESS', revoke: 1 },
  ADULT_LEARNING: { type: 'ADULT_LEARNING', purpose: 'ADULT_LEARNING_ELIGIBILITY', requirement: 'LEARNING_REQUIRED', capabilities: '["LEARNING"]', effect: 'RESTRICT_ALL_LEARNING_ACCESS', revoke: 1 },
})
const CHILD_JVM_MEMORY = Object.freeze(['-Xms64m', '-Xmx384m', '-XX:ActiveProcessorCount=2'])
const GATEWAY_ALLOW_LIST = new Set(['/iam/principal/me', '/iam/adult-gate', '/iam/consents', '/auth/jwks'])
// MB-033 opt-in. With this variable absent, every B72 default (including the
// disabled B14 strangler) is unchanged. With it set, only the learner B14
// domain is TARGET; every other domain stays LEGACY, so no other service is
// reachable through this run. MB006_PLACEMENT_BROWSER additionally sets
// assessment TARGET beside learner. Content and learning stay LEGACY, and
// nothing is started on 18090. Without that opt-in, assessment stays LEGACY.
// MB006_PLACEMENT_FULL_BROWSER requires those flags and also sets learning
// TARGET on 18090 and content TARGET on 18089. Content internal reads stay
// direct. Other domains stay LEGACY. Absent that token, this block is unchanged.
const TARGET_PROBE_OPT_IN = 'YES_RUN_MB033_LEARNER_TARGET_PROBE'
const TARGET_PROBE_MODULE = path.join(HARNESS_DIR, 'learner-target-probe.mjs')
const TARGET_PROBE_RUN_DIRECTORY = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/learner-target-33-root'
const TARGET_BROWSER_RUN_DIRECTORY = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/learner-target-browser-34-root'
const BROWSER_PROBE_OPT_IN = 'YES_LOCAL_H5_TARGET_SMOKE'
const BROWSER_PROBE_MODULE = path.join(HARNESS_DIR, 'browser-target-probe.cjs')
const PLACEMENT_BROWSER_OPT_IN = 'MB006_PLACEMENT_BROWSER'
const FULL_BROWSER_OPT_IN = 'MB006_PLACEMENT_FULL_BROWSER'
const FULL_BROWSER_CONTENT_JAR_SHA256 = '852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
const FULL_BROWSER_ASSESSMENT_JAR_SHA256 = '467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'
const FULL_BROWSER_LEARNING_JAR_SHA256 = '5eff984611443d2cf842eb5887fdabc160c4c87faff5fd77c471ab510d0a444f'
const RETEST_CONTENT_JAR_SHA256 = '852578df43b40fdc45569a6e60c074c3561c0b43bf8e7bd6b8acafd51e2f3eb2'
const RETEST_ASSESSMENT_JAR_SHA256 = '467fb91b9299c0569f48d52b482be580a18b6a9b90bd74aa523659e16fed6912'
const RETEST_CONTINUATION_OPT_IN = 'MB006_PLACEMENT_RETEST_CONTINUATION'
const TARGET_PROBE_OTHER_MODES = ['CONTENT', 'LEARNING', 'ASSESSMENT', 'MEDIA', 'GAMIFICATION', 'SOCIAL', 'COMMERCE']

function targetProbeEnabled() {
  return process.env.MB033_LEARNER_TARGET_PROBE === TARGET_PROBE_OPT_IN
}

function browserProbeEnabled() {
  return process.env.MB004_TARGET_BROWSER_PROBE === BROWSER_PROBE_OPT_IN
}

function placementBrowserEnabled() {
  return process.env.MB006_PLACEMENT_BROWSER === PLACEMENT_BROWSER_OPT_IN
}

function fullBrowserEnabled() {
  return process.env.MB006_PLACEMENT_FULL_BROWSER === FULL_BROWSER_OPT_IN
}

function retestContinuationEnabled() {
  return process.env.MB006_PLACEMENT_RETEST_CONTINUATION === RETEST_CONTINUATION_OPT_IN
}

function expectedServiceCommit() {
  return fullBrowserEnabled() ? FULL_BROWSER_COMMIT : EXPECTED_COMMIT
}

function targetConfigError(id, message, detail = {}) {
  const error = new Error(message)
  error.id = id
  error.detail = detail
  throw error
}

function targetConfigMust(ok, id, message, detail = {}) {
  if (!ok) targetConfigError(id, message, detail)
}

const checks = []
let run = null

function log(message) {
  process.stdout.write(`${message}\n`)
}

function isoNow() {
  return new Date().toISOString()
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function sha256Utf8(text) {
  return sha256(Buffer.from(text, 'utf8'))
}

function codePoints(text) {
  return [...text].length
}

function readUtf8(file) {
  return fs.readFileSync(file, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function check(id, ok, required = true, detail = {}) {
  const entry = { id, ok: Boolean(ok), required: Boolean(required), detail }
  checks.push(entry)
  log(`${entry.ok ? 'PASS' : required ? 'FAIL' : 'WARN'} ${id}`)
  return entry.ok
}

function must(condition, id, message, detail = {}) {
  if (!check(id, condition, true, detail)) throw new Error(message || id)
}

function parseArgs(argv) {
  const result = { mode: 'inspect', repo: process.cwd(), out: path.join(HARNESS_DIR, 'result.json'), report: path.join(HARNESS_DIR, 'REPORT.md'), outSet: false, reportSet: false }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--mode' && argv[index + 1]) { result.mode = argv[++index]; continue }
    if (value === '--repo' && argv[index + 1]) { result.repo = path.resolve(argv[++index]); continue }
    if (value === '--out' && argv[index + 1]) { result.out = path.resolve(argv[++index]); result.outSet = true; continue }
    if (value === '--report' && argv[index + 1]) { result.report = path.resolve(argv[++index]); result.reportSet = true; continue }
    if (value === '--help' || value === '-h') { result.help = true; continue }
    throw new Error(`unknown argument: ${value}`)
  }
  if (result.mode !== 'inspect' && result.mode !== 'run') throw new Error('--mode must be inspect or run')
  return result
}

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function gitStatus(repo) {
  return git(repo, ['status', '--porcelain=v1', '--untracked-files=no'])
}

function newestMtime(root) {
  let newest = fs.statSync(path.join(root, 'pom.xml')).mtimeMs
  const pending = [path.join(root, 'src', 'main')]
  while (pending.length) {
    const current = pending.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) pending.push(absolute)
      else if (entry.isFile()) newest = Math.max(newest, fs.statSync(absolute).mtimeMs)
    }
  }
  return newest
}

function unzipEntry(jar, entry) {
  try {
    return execFileSync('unzip', ['-p', jar, entry], { maxBuffer: 8 * 1024 * 1024 })
  } catch {
    return null
  }
}

function verifyJarContent(repo, service, jar) {
  if (service === 'iam-service') {
    const v19 = unzipEntry(jar, 'BOOT-INF/classes/db/migration/V19__add_iam_consent_document_body.sql')
    const expectedV19 = fs.readFileSync(path.join(repo, V19_REL))
    const consentService = unzipEntry(jar, 'BOOT-INF/classes/com/englishflow/iam/domain/ConsentService.class')
    const controller = unzipEntry(jar, 'BOOT-INF/classes/com/englishflow/iam/web/IamAuthenticationController$PrincipalResponse.class')
    const facts = {
      v19: Boolean(v19 && v19.equals(expectedV19)),
      firstConsentProjection: Boolean(consentService && consentService.includes('projectFirstConsentDocuments')),
      principalProjection: Boolean(controller && controller.includes('publishedConsentDocuments')),
    }
    return { ...facts, ok: facts.v19 && facts.firstConsentProjection && facts.principalProjection }
  }
  const routePolicy = unzipEntry(jar, 'BOOT-INF/classes/com/englishflow/gateway/policy/GatewayRouteExecutionPolicy.class')
  const facts = {
    principalRoute: Boolean(routePolicy && routePolicy.includes('/api/v1/iam/principal/me')),
    consentRoute: Boolean(routePolicy && routePolicy.includes('/api/v1/iam/consents')),
  }
  return { ...facts, ok: facts.principalRoute && facts.consentRoute }
}

function resolveJar(repo, service, prefix) {
  const target = path.join(repo, 'services', service, 'target')
  if (!fs.existsSync(target)) return { ok: false, reason: 'target directory missing' }
  const candidates = fs.readdirSync(target)
    .filter((name) => name.startsWith(prefix) && name.endsWith('.jar'))
    .filter((name) => !/(?:-sources|-javadoc|\.original)\.jar$/u.test(name))
    .map((name) => path.join(target, name))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
  if (candidates.length !== 1) return { ok: false, reason: `expected one runnable jar, found ${candidates.length}` }
  const jar = candidates[0]
  const sourceRoot = path.join(repo, 'services', service)
  // Boot may write a reproducible 1980 timestamp, so mtime alone cannot prove staleness.
  // Content checks below prove the candidate V19 migration and B69 classes are packaged.
  const stale = fs.statSync(jar).mtimeMs < newestMtime(sourceRoot)
  const content = verifyJarContent(repo, service, jar)
  return { ok: true, jar, stale, content, digest: sha256(fs.readFileSync(jar)), relative: path.relative(repo, jar) }
}

function javaTool(name) {
  const javaHome = process.env.JAVA_HOME
  if (javaHome) {
    const candidate = path.join(javaHome, 'bin', name)
    if (fs.existsSync(candidate)) return candidate
  }
  return name
}

function javaVersion() {
  const result = spawnSync(javaTool('java'), ['-version'], { encoding: 'utf8' })
  return `${result.stdout || ''}\n${result.stderr || ''}`.trim()
}

function java25() {
  try {
    const text = javaVersion()
    const match = text.match(/version\s+"(\d+)/i)
    return { ok: Boolean(match && Number(match[1]) === 25), text: match ? `Java ${match[1]}` : 'unknown' }
  } catch {
    return { ok: false, text: 'java unavailable' }
  }
}

async function probeTcp(host, port, timeoutMs = 600) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port })
    let settled = false
    const finish = (value) => {
      if (settled) return
      settled = true
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

function prepareTls(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 })
  fs.chmodSync(directory, 0o700)
  const cert = path.join(directory, 'test-ca.pem')
  const key = path.join(directory, 'test-key.pem')
  const keyStore = path.join(directory, 'iam-server.p12')
  const trustStore = path.join(directory, 'trust.p12')
  const signer = path.join(directory, 'iam-signer.pem')
  const files = [cert, key, keyStore, trustStore, signer]
  if (files.every((file) => fs.existsSync(file))) {
    log('reuse existing disposable TLS material')
    return {
      directory, caPem: cert, keyStore, trustStore, signerPem: signer, keyAlias: 'mb004-iam',
      keyStorePassword: readSecret(path.join(directory, 'key-store.pass')),
      trustStorePassword: readSecret(path.join(directory, 'trust-store.pass')),
    }
  }
  if (files.some((file) => fs.existsSync(file))) {
    throw new Error(`partial TLS material in ${directory}; remove that directory before retrying`)
  }
  const keyStorePassword = crypto.randomBytes(24).toString('hex')
  const trustStorePassword = crypto.randomBytes(24).toString('hex')
  const env = { ...process.env, MB004_KEYSTORE_PASSWORD: keyStorePassword, MB004_TRUSTSTORE_PASSWORD: trustStorePassword }
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '2',
    '-subj', '/CN=mb004 local IAM loopback', '-addext', 'subjectAltName=IP:127.0.0.1,DNS:localhost',
    '-keyout', key, '-out', cert], { env, stdio: 'ignore' })
  fs.chmodSync(key, 0o600)
  fs.chmodSync(cert, 0o600)
  execFileSync('openssl', ['pkcs12', '-export', '-in', cert, '-inkey', key, '-out', keyStore,
    '-name', 'mb004-iam', '-passout', 'env:MB004_KEYSTORE_PASSWORD'], { env, stdio: 'ignore' })
  fs.chmodSync(keyStore, 0o600)
  execFileSync(javaTool('keytool'), ['-importcert', '-noprompt', '-alias', 'mb004-iam', '-file', cert,
    '-keystore', trustStore, '-storetype', 'PKCS12', '-storepass:env', 'MB004_TRUSTSTORE_PASSWORD'], { env, stdio: 'ignore' })
  fs.chmodSync(trustStore, 0o600)
  execFileSync('openssl', ['genpkey', '-algorithm', 'RSA', '-pkeyopt', 'rsa_keygen_bits:3072', '-out', signer], { env, stdio: 'ignore' })
  fs.chmodSync(signer, 0o600)
  fs.writeFileSync(path.join(directory, 'key-store.pass'), `${keyStorePassword}\n`, { mode: 0o600 })
  fs.writeFileSync(path.join(directory, 'trust-store.pass'), `${trustStorePassword}\n`, { mode: 0o600 })
  return {
    directory, caPem: cert, keyStore, trustStore, signerPem: signer, keyAlias: 'mb004-iam',
    keyStorePassword, trustStorePassword,
  }
}

function readSecret(file) {
  if (!fs.existsSync(file)) throw new Error('TLS password file missing; remove the TLS directory and retry')
  const value = fs.readFileSync(file, 'utf8').trim()
  if (!value) throw new Error('TLS password file is empty; remove the TLS directory and retry')
  return value
}

function resolveConnectorJar(iamJar, runDirectory) {
  const explicit = process.env.MB004_MYSQL_CONNECTOR_JAR
  if (explicit) {
    const absolute = path.resolve(explicit)
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error('MB004_MYSQL_CONNECTOR_JAR is not a file')
    return absolute
  }
  const m2 = path.join(os.homedir(), '.m2', 'repository', 'com', 'mysql', 'mysql-connector-j')
  if (fs.existsSync(m2)) {
    const versions = fs.readdirSync(m2)
      .map((name) => path.join(m2, name))
      .filter((dir) => fs.statSync(dir).isDirectory())
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)
    for (const directory of versions) {
      const jar = fs.readdirSync(directory).find((name) => /^mysql-connector-j-.*\.jar$/u.test(name) && !name.endsWith('-sources.jar'))
      if (jar) return path.join(directory, jar)
    }
  }
  const listing = execFileSync('unzip', ['-l', iamJar], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const entry = listing.split(/\r?\n/u)
    .map((line) => line.trim().split(/\s+/u).pop())
    .find((name) => name && name.startsWith('BOOT-INF/lib/mysql-connector-j-') && name.endsWith('.jar'))
  if (!entry) throw new Error('MySQL connector is not in the IAM jar or the local Maven repository')
  const target = path.join(runDirectory, 'mysql-connector-j.jar')
  fs.writeFileSync(target, execFileSync('unzip', ['-p', iamJar, entry], { maxBuffer: 64 * 1024 * 1024 }), { mode: 0o600 })
  return target
}

function compileSeed(runDirectory) {
  const classes = path.join(runDirectory, 'seed-classes')
  fs.mkdirSync(classes, { recursive: true, mode: 0o700 })
  execFileSync(javaTool('javac'), ['-encoding', 'UTF-8', '-d', classes, path.join(HARNESS_DIR, 'seed', 'Seed.java')],
    { stdio: ['ignore', 'pipe', 'pipe'] })
  return classes
}

function runSeed(java, classes, connector, sqlFile, user, password, errorFile) {
  fs.rmSync(errorFile, { force: true })
  const env = {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || '',
    TMPDIR: process.env.TMPDIR || '/tmp',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    MB004_DB_PASSWORD: password,
    MB004_SEED_ERROR_FILE: errorFile,
  }
  try {
    const output = execFileSync(java, [...CHILD_JVM_MEMORY, '-cp', `${connector}${path.delimiter}${classes}`, 'Seed',
      '--url', JDBC_URL, '--user', user, '--sql', sqlFile], {
      cwd: HARNESS_DIR, env, encoding: 'utf8', timeout: 45_000, stdio: ['ignore', 'pipe', 'pipe'],
    })
    const line = output.trim().split(/\r?\n/u).pop()
    const parsed = JSON.parse(line)
    if (!parsed.ok) throw new Error(parsed.error || 'seed failed')
    return parsed
  } catch (error) {
    if (fs.existsSync(errorFile)) {
      const detail = fs.readFileSync(errorFile, 'utf8').trim()
      throw new Error(`seed failed; diagnostic=${detail.replace(/\s+/gu, ' ').slice(0, 240)}`)
    }
    throw new Error('seed failed without a diagnostic')
  }
}

function startService(java, jar, args, environment, logFile, applicationArgs = []) {
  const fd = fs.openSync(logFile, 'a', 0o600)
  const child = spawn(java, [...CHILD_JVM_MEMORY, ...args, '-jar', jar, ...applicationArgs], {
    cwd: HARNESS_DIR,
    env: environment,
    stdio: ['ignore', fd, fd],
    windowsHide: true,
  })
  fs.closeSync(fd)
  child.once('exit', () => { child.__mb004Exited = true })
  child.once('error', (error) => { child.__mb004Error = error })
  return child
}

async function stopService(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 12_000)
    child.once('exit', () => { clearTimeout(timer); resolve() })
    child.kill('SIGTERM')
  })
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
    })
  }
}

function request(base, requestPath, options = {}) {
  const url = new URL(base + requestPath)
  const transport = url.protocol === 'https:' ? https : http
  const bodyBuffer = options.body === undefined ? null : Buffer.from(JSON.stringify(options.body), 'utf8')
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'dsh-mb004-acceptance/1',
    ...(options.headers || {}),
  }
  if (bodyBuffer) {
    headers['Content-Type'] = 'application/json'
    headers['Content-Length'] = String(bodyBuffer.length)
  } else if (options.method && options.method !== 'GET') {
    headers['Content-Length'] = '0'
  }
  return new Promise((resolve, reject) => {
    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: options.method || 'GET',
      headers,
      ca: options.ca === undefined ? undefined : fs.readFileSync(options.ca),
      rejectUnauthorized: true,
      agent: false,
    }, (response) => {
      const chunks = []
      let total = 0
      response.on('data', (chunk) => {
        total += chunk.length
        if (total > 2 * 1024 * 1024) {
          response.destroy(new Error('response too large'))
          return
        }
        chunks.push(chunk)
      })
      response.once('end', () => {
        const raw = Buffer.concat(chunks)
        let text = ''
        let utf8Error = null
        try {
          text = new TextDecoder('utf-8', { fatal: true }).decode(raw)
        } catch {
          utf8Error = 'invalid_utf8'
        }
        let json = null
        try { json = text ? JSON.parse(text) : null } catch { json = null }
        const rawSetCookie = response.headers['set-cookie']
        const setCookies = Array.isArray(rawSetCookie) ? rawSetCookie : rawSetCookie ? [rawSetCookie] : []
        resolve({ status: response.statusCode || 0, headers: response.headers, raw, text, json, utf8Error, setCookies })
      })
      response.once('error', reject)
    })
    req.setTimeout(options.timeoutMs || 12_000, () => req.destroy(new Error('request timeout')))
    req.once('error', reject)
    if (bodyBuffer) req.write(bodyBuffer)
    req.end()
  })
}

async function waitForHealth(base, child, ca, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  let last = 'no response'
  while (Date.now() < deadline) {
    if (child.__mb004Error) throw new Error(`service failed to start: ${child.__mb004Error.code || 'spawn error'}`)
    if (child.exitCode !== null) throw new Error(`service exited before health (code=${child.exitCode})`)
    try {
      const response = await request(base, '/actuator/health/readiness', { ca, timeoutMs: 2500 })
      if (response.status >= 200 && response.status < 300) return
      last = `HTTP ${response.status}`
    } catch (error) {
      last = error.message
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(`health timeout: ${last}`)
}

function parseRefreshCookie(setCookies, name = 'yuxuexing_refresh') {
  const line = setCookies.find((cookie) => cookie.startsWith(`${name}=`))
  if (!line) return null
  const parts = line.split(';').map((part) => part.trim()).filter(Boolean)
  const pair = parts.shift()
  const value = pair.slice(name.length + 1)
  const attributes = new Map()
  for (const part of parts) {
    const index = part.indexOf('=')
    if (index < 0) attributes.set(part.toLowerCase(), true)
    else attributes.set(part.slice(0, index).toLowerCase(), part.slice(index + 1))
  }
  return {
    value,
    httpOnly: attributes.has('httponly'),
    secure: attributes.has('secure'),
    sameSite: attributes.get('samesite') || null,
    partitioned: attributes.has('partitioned'),
    path: attributes.get('path') || null,
    maxAge: Number(attributes.get('max-age') || 0),
  }
}

function cookieHeader(cookie) {
  return cookie ? { Cookie: `yuxuexing_refresh=${cookie.value}` } : {}
}

function cookieChecks(id, cookie, required = true) {
  return check(id, Boolean(cookie && cookie.httpOnly && cookie.secure && cookie.sameSite === 'None'
    && cookie.partitioned && cookie.path === '/api/v1/auth' && cookie.maxAge > 0), required, {
    present: Boolean(cookie), httpOnly: cookie?.httpOnly, secure: cookie?.secure, sameSite: cookie?.sameSite,
    partitioned: cookie?.partitioned, path: cookie?.path, maxAgePositive: Boolean(cookie && cookie.maxAge > 0),
  })
}

function decodeJwtPart(segment) {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'))
}

function verifyJwt(token, jwks) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('token is not a compact JWT')
  const header = decodeJwtPart(parts[0])
  const payload = decodeJwtPart(parts[1])
  const key = jwks.find((candidate) => candidate.kid === header.kid)
  if (!key) throw new Error('JWT kid is absent from the gateway JWKS')
  const publicKey = crypto.createPublicKey({ key, format: 'jwk' })
  const verified = crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'), publicKey,
    Buffer.from(parts[2], 'base64url'))
  return { header, payload, verified }
}

function audienceValues(payload) {
  const value = payload.aud
  if (Array.isArray(value)) return value
  return typeof value === 'string' ? [value] : []
}

function tokenBody(response) {
  const data = response.json?.data
  if (!data || typeof data !== 'object') throw new Error('auth response has no data object')
  return data
}

function tokenCheck(id, data, required = true) {
  return check(id, typeof data.accessToken === 'string' && data.accessToken.split('.').length === 3
    && data.authTransport === 'WEB_COOKIE' && data.tokenType === 'Bearer'
    && data.refreshToken === undefined && data.sessionId && data.deviceId, required, {
    authTransport: data.authTransport, tokenType: data.tokenType, hasAccessToken: Boolean(data.accessToken),
    refreshTokenInBody: data.refreshToken !== undefined && data.refreshToken !== null,
    hasSessionId: Boolean(data.sessionId), hasDeviceId: Boolean(data.deviceId),
  })
}

function noStore(response) {
  const value = String(response.headers['cache-control'] || '').toLowerCase()
  return value.includes('no-store')
}

function authResponseChecks(prefix, response) {
  check(`${prefix}.status`, response.status === 200 || response.status === 201, true, { status: response.status })
  check(`${prefix}.no_store`, noStore(response), true, { cacheControl: response.headers['cache-control'] || null })
  check(`${prefix}.content_type`, String(response.headers['content-type'] || '').includes('application/json'), true, {
    contentType: response.headers['content-type'] || null,
  })
}

function assertStatus(response, expected, id, detail = {}) {
  must(response.status === expected, id, `${id}: expected HTTP ${expected}, got ${response.status}`, {
    status: response.status, expected, ...detail,
  })
}

function authPayload(identifier, password) {
  return {
    identifier,
    password,
    device: { deviceType: 'H5', clientVersion: 'local-dev', deviceName: '语学星移动端' },
  }
}

function idempotencyKey(prefix, runId, suffix) {
  return `mb004-${prefix}-${runId}-${suffix}`.slice(0, 128)
}

function errorCode(response) {
  return response.json?.error?.errorCode || null
}

function errorMessage(response) {
  return response.json?.error?.message || null
}

function loadFixture(repo) {
  const file = path.join(repo, FIXTURE_REL)
  const raw = fs.readFileSync(file)
  const fixture = JSON.parse(raw.toString('utf8'))
  const documents = fixture.documents || []
  return { file, raw, fixture, documents }
}

function fixtureMap(documents) {
  return new Map(documents.map((document) => [document.type, document]))
}

function validateFixture(fixture, documents, raw) {
  check('fixture.scope', fixture.fixtureScope === 'SYNTHETIC_TEST_ONLY', true, { fixtureScope: fixture.fixtureScope })
  check('fixture.count', documents.length === 3, true, { count: documents.length })
  const expected = ['TERMS', 'PRIVACY', 'ADULT_LEARNING']
  check('fixture.order', documents.map((document) => document.type).join(',') === expected.join(','), true, {
    order: documents.map((document) => document.type),
  })
  for (const document of documents) {
    const digest = sha256Utf8(document.bodyText)
    check(`fixture.${document.type}.digest`, digest === document.documentDigest, true, {
      digest, codePoints: codePoints(document.bodyText), bytes: Buffer.byteLength(document.bodyText, 'utf8'),
    })
    check(`fixture.${document.type}.no_nul`, !document.bodyText.includes('\u0000'), true)
    check(`fixture.${document.type}.published_at`, document.publishedAt === '2026-11-05T00:00:00Z', true, {
      publishedAt: document.publishedAt,
    })
  }
  check('fixture.file_sha256', /^[0-9a-f]{64}$/u.test(sha256(raw)), true, { fileSha256: sha256(raw) })
}

function sourceRoutes(repo) {
  const controller = readUtf8(path.join(repo, CONTROLLER_REL))
  const gateway = readUtf8(path.join(repo, GATEWAY_POLICY_REL))
  const requiredIam = [
    '@PostMapping("/auth/register")', '@PostMapping("/auth/login")', '@PostMapping("/auth/token/refresh")',
    '@GetMapping("/iam/principal/me")', '@PostMapping("/iam/adult-gate")',
    '@GetMapping("/iam/consents")', '@PutMapping("/iam/consents")',
  ]
  const requiredGateway = [
    '"/api/v1/auth/register"', '"/api/v1/auth/login"', '"/api/v1/auth/token/refresh"',
    '"/api/v1/iam/principal/me"', '"/api/v1/iam/adult-gate"', '"/api/v1/iam/consents"',
  ]
  return {
    iam: requiredIam.every((token) => controller.includes(token)),
    gateway: requiredGateway.every((token) => gateway.includes(token)),
    missingIam: requiredIam.filter((token) => !controller.includes(token)),
    missingGateway: requiredGateway.filter((token) => !gateway.includes(token)),
  }
}

function validateSource(repo) {
  const routes = sourceRoutes(repo)
  check('routes.iam', routes.iam, true, { missing: routes.missingIam })
  check('routes.gateway', routes.gateway, true, { missing: routes.missingGateway })
  const gatewayTs = readUtf8(path.join(repo, MOBILE_GATEWAY_REL))
  const authTs = readUtf8(path.join(repo, MOBILE_AUTH_REL))
  const sessionTs = readUtf8(path.join(repo, MOBILE_SESSION_REL))
  const clientTs = readUtf8(path.join(repo, MOBILE_CLIENT_REL))
  const contentTs = readUtf8(path.join(repo, MOBILE_CONTENT_REL))
  const transport = {
    directIamHttps: gatewayTs.includes("DEFAULT_IAM_AUTH_BASE_URL = 'https://127.0.0.1:18087/api/v1'"),
    gatewayLoopback: gatewayTs.includes("DEFAULT_GATEWAY_BASE_URL = 'http://127.0.0.1:18070/api/v1'"),
    h5Device: sessionTs.includes("return 'H5'") && sessionTs.includes('deviceType()'),
    passwordPosts: authTs.includes("'/auth/login'") && authTs.includes("'/auth/register'"),
    refreshPath: authTs.includes("'/auth/token/refresh'"),
    principalPath: authTs.includes("'/iam/principal/me'"),
    adultGatePath: authTs.includes("'/iam/adult-gate'"),
    idempotencyHeader: clientTs.includes('Idempotency-Key') || authTs.includes('Idempotency-Key'),
    expectedDigest: contentTs.includes('expectedDocumentDigest'),
    publishedDocuments: contentTs.includes('publishedConsentDocuments'),
    withCredentials: clientTs.includes('withCredentials: true'),
  }
  check('mobile.transport', Object.values(transport).every(Boolean), true, transport)
  const v19 = readUtf8(path.join(repo, V19_REL))
  check('migration.v19', v19.includes('ADD COLUMN document_body') && v19.includes('CHECK'), true, { path: V19_REL })
  const application = readUtf8(path.join(repo, 'services/iam-service/src/main/resources/application.yaml'))
  check('owner.schema', application.includes('schema: ${IAM_PERSISTENCE_SCHEMA:iam_service}'), true, { schema: MYSQL_SCHEMA })
}

function validateSql(repo, fixture) {
  const byType = fixtureMap(fixture.documents)
  const full = readUtf8(path.join(HARNESS_DIR, 'sql', 'seed-full.sql'))
  const partial = readUtf8(path.join(HARNESS_DIR, 'sql', 'seed-partial.sql'))
  const cleanup = readUtf8(path.join(HARNESS_DIR, 'sql', 'cleanup-fixtures.sql'))
  check('sql.use_iam_service', [full, partial, cleanup].every((sql) => sql.includes('USE iam_service;')), true)
  check('sql.only_fixture_versions', [full, partial].every((sql) => sql.includes('mock-mb004-terms-v1')
    && sql.includes('mock-mb004-privacy-v1') && sql.includes('mock-mb004-adult-v1')), true)
  check('sql.full.three', full.includes(FIXTURE_IDS.TERMS) && full.includes(FIXTURE_IDS.PRIVACY)
    && full.includes(FIXTURE_IDS.ADULT_LEARNING), true)
  const partialInsertValues = partial.slice(partial.indexOf('VALUES'), partial.indexOf('COMMIT;'))
  check('sql.partial.two', partialInsertValues.includes(FIXTURE_IDS.TERMS) && partialInsertValues.includes(FIXTURE_IDS.PRIVACY)
    && !partialInsertValues.includes(FIXTURE_IDS.ADULT_LEARNING), true, {
    hasTerms: partialInsertValues.includes(FIXTURE_IDS.TERMS),
    hasPrivacy: partialInsertValues.includes(FIXTURE_IDS.PRIVACY),
    hasAdult: partialInsertValues.includes(FIXTURE_IDS.ADULT_LEARNING),
  })
  check('sql.cleanup.scoped', cleanup.includes('consent_document_id IN') && cleanup.includes('mock-mb004-terms-v1'), true)
  check('sql.runtime_status', full.includes("'NOT_RUNTIME_VERIFIED'") && partial.includes("'NOT_RUNTIME_VERIFIED'"), true)
  for (const document of fixture.documents) {
    const bodyExpectedInPartial = document.type !== 'ADULT_LEARNING'
    check(`sql.${document.type}.body`, full.includes(document.bodyText)
      && (!bodyExpectedInPartial || partial.includes(document.bodyText)), true)
    check(`sql.${document.type}.digest`, full.includes(document.documentDigest), true)
    check(`sql.${document.type}.storage`, full.includes(STORAGE[document.type].type)
      && full.includes(STORAGE[document.type].purpose), true)
  }
  const byId = [FIXTURE_IDS.TERMS, FIXTURE_IDS.PRIVACY, FIXTURE_IDS.ADULT_LEARNING]
  check('sql.fixture_ids', byId.every((id) => full.includes(id)), true, { ids: byId })
}

function validateSeedHelper() {
  const file = path.join(HARNESS_DIR, 'seed', 'Seed.java')
  check('seed.helper.exists', fs.existsSync(file), true, { path: file })
  check('seed.helper.guard', readUtf8(file).includes('JDBC_URL_NOT_DISPOSABLE_IAM_SERVICE'), true)
}

function infrastructureComparison(repo) {
  const r1 = path.join(repo, 'scripts/redesign/r1-iam-lifecycle/iam-lifecycle-runtime.mjs')
  const gw = path.join(repo, 'services/api-gateway/src/test/runtime/p1r-m2-001-runtime.mjs')
  const launcher = path.join(repo, 'scripts/runtime/run-v2-services.mjs')
  const r1Text = fs.existsSync(r1) ? readUtf8(r1) : ''
  const gwText = fs.existsSync(gw) ? readUtf8(gw) : ''
  return {
    r1IamLifecycle: {
      path: path.relative(repo, r1),
      exists: fs.existsSync(r1),
      coversR1008: r1Text.includes('R1-008') || r1Text.includes('r1008'),
      coversPublishedConsentDocuments: r1Text.includes('publishedConsentDocuments'),
      coversGateway18070: r1Text.includes('18070'),
      conclusion: 'R1-008 consent writes exist, but no B69 publishedConsentDocuments projection and no Gateway 18070 path.',
    },
    gatewayRuntime: {
      path: path.relative(repo, gw),
      exists: fs.existsSync(gw),
      coversFixturePublication: gwText.includes('mock-consent-publication') || gwText.includes('publishedConsentDocuments'),
      conclusion: 'Real Gateway/IAM boundary exists, but it does not seed or assert the B69 first-consent fixture documents.',
    },
    standardLauncher: {
      path: path.relative(repo, launcher),
      exists: fs.existsSync(launcher),
      conclusion: 'The standard local launcher starts the full stack and does not seed or assert B69 fixture projection; its loopback/profile/TLS environment shape is reused here, not the full stack.',
    },
    chosen: 'A minimal harness under /tmp because no existing runner covers the B69 fixture projection through Gateway with an isolated MySQL control plane.',
  }
}

function validateRepo(repo) {
  let head = ''
  let branch = ''
  let dirty = ''
  try {
    head = git(repo, ['rev-parse', 'HEAD'])
    branch = git(repo, ['branch', '--show-current'])
    dirty = gitStatus(repo)
  } catch {
    must(false, 'repo.git', 'not a git repository')
  }
  const expected = expectedServiceCommit()
  must(head === expected, 'repo.candidate', `candidate mismatch: ${head}`, { head, expected })
  must(dirty === '', 'repo.clean', 'tracked product tree is dirty', { dirty: dirty.split(/\r?\n/u).filter(Boolean).slice(0, 12) })
  const authorOnly = fullBrowserEnabled() && branch === ''
  check('repo.branch', authorOnly || Boolean(branch), false, authorOnly ? { branch: null, authorOnly: true } : { branch })
  return { head, branch: authorOnly ? null : branch, trackedClean: dirty === '', ...(authorOnly ? { authorOnly: true } : {}) }
}

function resultBase(mode, repo) {
  return {
    kind: 'MB004_R1_008_LOCAL_HTTP_ACCEPTANCE',
    schemaVersion: '1',
    generatedAt: isoNow(),
    mode,
    status: mode === 'inspect' ? 'NOT_RUN' : 'FAIL',
    preflightStatus: 'UNKNOWN',
    candidate: { repo, expectedCommit: expectedServiceCommit(), head: null, branch: null, trackedClean: null },
    fixture: null,
    runtime: {
      status: mode === 'inspect' ? 'NOT_RUN' : 'PENDING',
      reason: mode === 'inspect' ? 'inspect mode: no server, database, browser, container, migration or HTTP request was started' : null,
      gateway: `${GATEWAY_ORIGIN}/api/v1`,
      iam: `${IAM_ORIGIN}/api/v1`,
      mysql: `${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_SCHEMA}`,
      profiles: ['local'],
      policySource: 'control-plane',
      fixtureRuntimeStatus: 'NOT_RUNTIME_VERIFIED',
    },
    checks,
    counts: { total: 0, passed: 0, failed: 0, warned: 0, requiredFailed: 0 },
    coverage: { covered: [], notCovered: [] },
    infrastructureComparison: infrastructureComparison(repo),
    cleanup: { performed: false, preferred: 'Drop the disposable iam_service database/container after review.' },
  }
}

function finalizeCounts(result) {
  const total = checks.length
  const passed = checks.filter((entry) => entry.ok).length
  const failed = checks.filter((entry) => !entry.ok && entry.required).length
  const warned = checks.filter((entry) => !entry.ok && !entry.required).length
  result.counts = { total, passed, failed, warned, requiredFailed: failed }
  return result
}

function coverageForRun() {
  return {
    covered: [
      'real IAM HTTPS on 127.0.0.1:18087 with local profile, MySQL iam_service, Flyway V19, control-plane policy source',
      'real Gateway HTTP on 127.0.0.1:18070 for bearer domain calls, the anonymous protected probe, JWKS, and CORS preflight only',
      'partial control-plane publication fails closed before account creation',
      'direct IAM mobile-H5 registration/login/refresh transport with secure HttpOnly SameSite=None Partitioned cookie',
      'authenticated principal before adult gate omits publishedConsentDocuments',
      'local adult gate PASSED/ELIGIBLE',
      'three exact fixture documents in publishedConsentDocuments with UTF-8 hashes, versions, purposes, policy refs and no-store',
      'JWT RS256 signature and access-token profile verified from Gateway JWKS',
      'consent missing-key 400, stale-version 409, exact-document-digest writes, idempotent replay',
      'GET /iam/consents grant evidence with provenance and no document body',
      'completed signatures remove publishedConsentDocuments and bodyText from principal and consent list',
    ],
    notCovered: [
      'Gateway password registration or login; no prior runtime is treated as evidence',
      'formal legal publication, authorizer approval, deployed Gateway/IAM, production rollout',
      'actual mobile H5/browser or native app, device secure storage, screen reader, real device',
      'browser-enforced CORS, cookie partitioning, and certificate UX (only HTTP-level preflight/cookie attributes are checked)',
      'withdrawal, logout, refresh-token replay detection, multi-device kickout',
      'invalid body digest, missing body, oversize body, NUL body or partial projection over HTTP (unit/JDBC tests exist, not repeated here)',
      'durable audit-service ingest and database-level audit row assertions',
      'visual onboarding UI, navigation, i18n and responsive behavior',
    ],
  }
}

function cleanupInstructions(runDirectory, principalId) {
  const lines = [
    '# MB-004 acceptance cleanup',
    '',
    'Preferred: remove the whole disposable MySQL instance/database and the /tmp run directory.',
    'If the disposable iam_service database must be retained for inspection, apply cleanup.sql once.',
    '',
    `Run directory: ${runDirectory}`,
    'The harness already stops the IAM and Gateway child processes in its finally block.',
    'It never starts MySQL, a container, a browser, or a migration by itself beyond the IAM jar Flyway startup.',
  ]
  if (principalId && /^[0-9a-f-]{36}$/u.test(principalId)) {
    lines.push('', `Synthetic principal: ${principalId}`)
  }
  return lines.join('\n') + '\n'
}

function writeCleanupSql(runDirectory, principalId) {
  const fixtureIds = `${FIXTURE_IDS.TERMS}','${FIXTURE_IDS.PRIVACY}','${FIXTURE_IDS.ADULT_LEARNING}`
  const safePrincipal = principalId && /^[0-9a-f-]{36}$/u.test(principalId) ? principalId : null
  const statements = [
    '-- MB-004 acceptance cleanup. DISPOSABLE iam_service ONLY.',
    '-- Prefer dropping the disposable database/container instead of retaining any of these rows.',
    'USE iam_service;',
    'START TRANSACTION;',
  ]
  if (safePrincipal) {
    statements.push(
      `DELETE FROM iam_refresh_token_history WHERE session_id IN (SELECT session_id FROM iam_session WHERE principal_id='${safePrincipal}');`,
      `DELETE FROM iam_session WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_device WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_consent_current WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_consent_lock WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_consent WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_decision_audit WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_principal_role WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_principal WHERE principal_id='${safePrincipal}';`,
      `DELETE FROM iam_account WHERE principal_id='${safePrincipal}';`,
    )
  }
  statements.push(
    `DELETE FROM iam_consent_document_version WHERE tenant_id='platform' AND (consent_document_id IN ('${fixtureIds}') OR document_version IN ('mock-mb004-terms-v1','mock-mb004-privacy-v1','mock-mb004-adult-v1'));`,
    'COMMIT;',
    '-- iam_idempotency_record is intentionally not deleted row-by-row; dropping the disposable schema is preferred.',
    '',
  )
  fs.writeFileSync(path.join(runDirectory, 'cleanup.sql'), statements.join('\n'), { mode: 0o600 })
}

function renderReport(result) {
  const lines = []
  const failures = result.checks.filter((entry) => !entry.ok)
  const runtimeChecks = result.checks.filter((entry) => !entry.id.startsWith('fixture.') && !entry.id.startsWith('sql.')
    && !entry.id.startsWith('repo.') && entry.id !== 'mobile.transport' && entry.id !== 'routes.iam'
    && entry.id !== 'routes.gateway' && entry.id !== 'migration.v19' && entry.id !== 'owner.schema'
    && entry.id !== 'seed.helper.exists' && entry.id !== 'seed.helper.guard' && entry.id !== 'java.25'
    && !entry.id.startsWith('jars.') && !entry.id.startsWith('inspect.'))
  const staticCore = result.checks.filter((entry) => ['repo.candidate', 'repo.clean', 'repo.branch', 'fixture.file_sha256',
    'mobile.transport', 'routes.iam', 'routes.gateway', 'migration.v19', 'owner.schema', 'sql.use_iam_service',
    'sql.only_fixture_versions', 'sql.full.three', 'sql.partial.two', 'sql.cleanup.scoped', 'sql.runtime_status',
    'seed.helper.exists', 'seed.helper.guard', 'java.25'].includes(entry.id))
  lines.push('# MB-004 / R1-008 local IAM HTTP acceptance', '')
  lines.push(`Status: **${result.status}**${result.preflightStatus ? ` · preflight **${result.preflightStatus}**` : ''}`, '')
  lines.push(`Generated: ${result.generatedAt}`, '')
  lines.push('> This file is generated by `acceptance.mjs`. `result.json` is the machine-readable record. No token, password, cookie value, or raw auth response is written here.', '')
  lines.push('## Candidate and fixture', '')
  lines.push(`- Candidate: \`${result.candidate.expectedCommit}\``)
  lines.push(`- HEAD: \`${result.candidate.head ?? 'not checked'}\` · branch: \`${result.candidate.authorOnly ? 'author-only' : (result.candidate.branch ?? 'n/a')}\` · tracked tree clean: ${result.candidate.trackedClean}`)
  if (result.fixture) {
    lines.push(`- Fixture: \`${result.fixture.path}\` · file SHA-256 \`${result.fixture.fileSha256}\``)
    lines.push(`- Documents: ${result.fixture.documents.map((document) => `${document.type}/${document.digest.slice(0, 12)}… (${document.codePoints} code points)`).join(', ')}`)
  }
  lines.push('')
  lines.push('## Result summary', '')
  lines.push(`- Checks: **${result.counts.passed}/${result.counts.total}** passed; required failures **${result.counts.requiredFailed}**; optional warnings **${result.counts.warned}**.`)
  if (result.status === 'NOT_RUN') {
    lines.push('- Runtime was **not executed** in inspect mode. The PASS below is a readiness check only, not an acceptance claim.')
  }
  lines.push('')
  lines.push('## Runtime path', '')
  lines.push('- IAM: `https://127.0.0.1:18087/api/v1` (local profile, MySQL `iam_service`, Flyway V19, `iam.consent.policy-source=control-plane`)')
  lines.push('- Gateway: `http://127.0.0.1:18070/api/v1`')
  lines.push('- Password registration, login, and refresh: direct IAM HTTPS only, strict scoped CA, matching the mobile H5 client. Gateway allow-list: bearer `/iam/principal/me`, `/iam/adult-gate`, `/iam/consents`, the anonymous protected probe, `/auth/jwks`, and CORS preflight on `/iam/principal/me`.')
  lines.push('- IAM, Gateway, and seed child JVMs only: `-Xms64m -Xmx384m -XX:ActiveProcessorCount=2`. Gateway Redis health is disabled in this local limiter runtime. Readiness HTTP and protected JWT validation stay required. No prior runtime result is claimed.')
  lines.push('- MySQL is external to this harness and must already be an isolated disposable instance at `127.0.0.1:13306`; the harness never starts it.')
  lines.push('')
  if (failures.length) {
    lines.push('## Failures and warnings', '')
    lines.push('| Check | Required | Result | Detail |')
    lines.push('| --- | --- | --- | --- |')
    for (const entry of failures) {
      const detail = entry.detail && Object.keys(entry.detail).length ? JSON.stringify(entry.detail).slice(0, 260) : ''
      lines.push(`| \`${entry.id}\` | ${entry.required ? 'yes' : 'no'} | ${entry.required ? 'FAIL' : 'WARN'} | ${detail.replaceAll('|', '\\|')} |`)
    }
    lines.push('')
  }
  lines.push('## Static preflight', '')
  lines.push('| Check | Result | Detail |')
  lines.push('| --- | --- | --- |')
  for (const entry of staticCore) {
    const detail = entry.detail && Object.keys(entry.detail).length ? JSON.stringify(entry.detail).slice(0, 180) : ''
    lines.push(`| \`${entry.id}\` | ${entry.ok ? 'PASS' : entry.required ? 'FAIL' : 'WARN'} | ${detail.replaceAll('|', '\\|')} |`)
  }
  lines.push('')
  lines.push('## Runtime checks', '')
  if (!runtimeChecks.length) {
    lines.push('- None: inspect mode only.')
  } else {
    lines.push('| Check | Result | Detail |')
    lines.push('| --- | --- | --- |')
    for (const entry of runtimeChecks) {
      const detail = entry.detail && Object.keys(entry.detail).length ? JSON.stringify(entry.detail).slice(0, 220) : ''
      lines.push(`| \`${entry.id}\` | ${entry.ok ? 'PASS' : entry.required ? 'FAIL' : 'WARN'} | ${detail.replaceAll('|', '\\|')} |`)
    }
  }
  lines.push('')
  lines.push('## Mobile transport comparison', '')
  lines.push('| Mobile source fact | Harness behaviour |')
  lines.push('| --- | --- |')
  lines.push('| `apps/mobile/src/platform/gateway.ts:2` uses `https://127.0.0.1:18087/api/v1` for password posts | Direct IAM HTTPS `/auth/register`, `/auth/login`, `/auth/token/refresh` with no bearer |')
  lines.push('| `gateway.ts:1` uses `http://127.0.0.1:18070/api/v1` for domain calls | Gateway bearer `/iam/principal/me`, `/iam/adult-gate`, `/iam/consents`; anonymous probe, `GET /auth/jwks`, and CORS preflight on `/iam/principal/me` |')
  lines.push('| `stores/session.ts:47` sends `deviceType: H5`, `clientVersion: local-dev`, `deviceName: 语学星移动端` | Same synthetic device body; no `deviceId` |')
  lines.push('| `auth/gateway-auth.ts:157-170` sends `Idempotency-Key`, no `X-Auth-Transport`, no Authorization on auth posts | Same; default transport is `WEB_COOKIE` |')
  lines.push('| `api/client.ts` sets `withCredentials: true`; refresh is the Secure IAM cookie | Node captures and replays `Set-Cookie` manually; attributes checked |')
  lines.push('| `api/learner-content.ts:810` sends `expectedDocumentDigest` on consent PUT | Same, plus exact version/type/decision and per-body idempotency key |')
  lines.push('| `api/learner-content.ts:536-541` reads `publishedConsentDocuments` only as a root sibling | Harness reads the root `data.publishedConsentDocuments` and rejects state nesting |')
  lines.push('')
  lines.push('Differences: this is a Node HTTP client, not a browser or uni-app runtime. It does not prove browser cookie partitioning, browser trust UX, UI state, native secure storage, or device behaviour. The CORS OPTIONS checks are HTTP-level, not a browser run.')
  lines.push('')
  lines.push('## Handler constraints traced', '')
  lines.push('- `IamProviderBoundaryController.java:133,152,180` calls `requirePublishedPoliciesForAuthentication()` before register/login/refresh credential work; the canonical LEARNING set is TERMS + PRIVACY + ADULT_LEARNING (`ConsentService.java:339`). Partial publication therefore fails closed with 503 before an account is created.')
  lines.push('- `parseTransport` defaults an absent `X-Auth-Transport` to `WEB_COOKIE` (`:1004`); H5 uses that path. Native transports require `NATIVE_SECURE_STORAGE` and the explicit local/test trust policy (`:1009`).')
  lines.push('- `refreshCookieBuilder` (`:912`) sets HttpOnly, Secure when configured, SameSite=None, Partitioned, and Path=/api/v1/auth. The disposable loopback TLS IAM process is started with `--iam.jwt.refresh-cookie-secure=true`, and the harness checks all attributes.')
  lines.push('- Refresh has an exact Origin/Referer filter (`IamRefreshCookieOriginFilter.java`); the harness sends the mobile origin and matching referer for the cookie refresh.')
  lines.push('- Adult gate (`:360`) requires `confirmed=true`, `birthYear`, literal `policyVersion=b30-adult-v1`, and `IAM_LOCAL_ADULT_GATE_ENABLED=true`; the harness sets the explicit local switch and uses a synthetic adult birth year.')
  lines.push('- Consent PUT (`:425`) requires an `Idempotency-Key` of 16-128 safe characters; a missing key is 400, a stale version is 409, and `expectedDocumentDigest` is checked against the published digest. The harness exercises all three.')
  lines.push('- Principal projection (`:1064-1076`) reads bodies only when the adult gate is ELIGIBLE and required consent is incomplete. It is all-or-nothing; completed signatures remove the whole `publishedConsentDocuments` property, not just the body.')
  lines.push('- Gateway route policy (`GatewayRouteExecutionPolicy.java:470`) preserves all used IAM paths; Gateway performs JWT prevalidation/resource-server checks against IAM JWKS. The harness verifies the RS256 signature and access-token profile from the gateway JWKS.')
  lines.push('')
  lines.push('## Prepared SQL and seeding', '')
  lines.push('- `sql/seed-partial.sql`: only TERMS and PRIVACY `b004*` rows. The harness applies it first and expects a 503 from register before account creation.')
  lines.push('- `sql/seed-full.sql`: all three exact fixture rows with the fixture versions/digests/bodies, `NOT_RUNTIME_VERIFIED`, `USE iam_service`, and scoped deletes/inserts only.')
  lines.push('- `sql/cleanup-fixtures.sql`: removes only the three fixture rows. `run/cleanup.sql` additionally removes the synthetic principal’s IAM rows if retention is required.')
  lines.push('- `seed/Seed.java` refuses any JDBC URL other than the fixed loopback `iam_service` URL and reads the password only from `MB004_DB_PASSWORD`.')
  lines.push('')
  lines.push('## Not covered', '')
  for (const item of result.coverage.notCovered) lines.push(`- ${item}`)
  lines.push('')
  lines.push('## Cleanup', '')
  lines.push('- In run mode, the harness stops its IAM and Gateway children in `finally` and checks both fixed ports are free before writing this report.')
  lines.push('- Preferred: drop the disposable `iam_service` database/container and remove `/tmp/dsh-mobile-iam-http-24/run`.')
  lines.push('- If the disposable database is retained, apply `run/cleanup.sql`; it deletes only the synthetic principal and the three `b004*` fixture rows. `iam_idempotency_record` is intentionally left for a schema drop.')
  lines.push('- Do not delete global IAM policy/role rows, other principals, or any non-fixture consent-document row.')
  lines.push('')
  lines.push('## Reproduce', '')
  lines.push('```sh')
  lines.push('mvn -q -pl services/iam-service,services/api-gateway -am package -DskipTests')
  lines.push('MB004_RUN_APPROVAL=YES_RUN_MB004_LOCAL_ACCEPTANCE \\')
  lines.push('MB004_MYSQL_DISPOSABLE=YES_DISPOSABLE_MYSQL_13306_IAM_SERVICE \\')
  lines.push('MB004_MYSQL_USER=<disposable-user> MB004_MYSQL_PASSWORD=<disposable-password> \\')
  lines.push(`node ${path.join(HARNESS_DIR, 'acceptance.mjs')} --mode run --repo <repo-root>`)
  lines.push('```')
  lines.push('')
  lines.push(fullBrowserEnabled()
    ? 'The full browser run refuses a non-`61b9ede7c65ef065c76c846c27fb69a52cd042cd` HEAD, a dirty tracked product tree, busy fixed ports, a missing V19 migration, a non-loopback JDBC URL, or a missing disposable-MySQL confirmation. A detached author-only checkout of that commit is accepted. See `RUNBOOK.md` for database readiness and cleanup.'
    : 'The run refuses a non-`034bac45` HEAD, a dirty tracked product tree, busy fixed ports, a missing V19 migration, a non-loopback JDBC URL, or a missing disposable-MySQL confirmation. See `RUNBOOK.md` for database readiness and cleanup.')
  lines.push('')
  if (result.browserTargetProbe) {
    const probe = result.browserTargetProbe
    lines.push('## MB-004 local H5 browser learner-target extension', '')
    lines.push(`- Probe status: \`${probe.status}\`; mode: \`${probe.mode}\`; browser module outcome: \`${probe.browserStatus}\`.`)
    if (result.fullBrowser) {
      lines.push('- Gateway B14 for the full browser: learner `TARGET`, assessment `TARGET`, learning `TARGET` at `http://127.0.0.1:18090`, and content `TARGET` at `http://127.0.0.1:18089`. Content internal reads stay direct at `http://127.0.0.1:18089`. The browser catalog route stays exact GET-only through the DSH allowlist. Other domains stay `LEGACY`. Kafka is disabled.')
    } else if (result.placementBrowser) {
      lines.push('- Gateway B14 for MB-006: learner `TARGET` and assessment `TARGET`. Content, learning, media, gamification, social, and commerce stay `LEGACY`. Learning `127.0.0.1:18090` is not started.')
    } else {
      lines.push('- Gateway B14: learner `TARGET`; content/learning/assessment/media/gamification/social/commerce `LEGACY`. Only the learner domain has a route.')
    }
    lines.push('- Proof scope: fresh pre-read confirms `stateVersion 0` and no target; the root-supplied `browser-target-probe.cjs` drives the H5 target write while the exact owned Learner JVM remains up; the harness performs no programmatic target PUT and no fallback write; the original B72 refreshed actor then performs real GET target/profile/preferences readback and checks `COLLEGE_CET`/`B1`/30/`ACTIVE`/`targetVersion 1`, unchanged preferences, and profile pointer/version.')
    lines.push('- Browser/Chrome/loopback cleanup belongs to the browser module and the root wrapper. The probe still stops its owned Learner JVM and checks `127.0.0.1:18088` in `finally`.')
    lines.push('- No token, principal id, idempotency key, password, or service-client secret is written. The browser module outcome is preserved separately in `browser-target-module-result.json`; the B72 result uses `principalIdSha256` instead of the raw id under this opt-in.')
    lines.push(result.fullBrowser
      ? '- No `run/cleanup.sql` was written under this opt-in because it would contain the synthetic principal id. Drop the disposable iam_service, learner_service, dedicated mb006 content and assessment schemas and accounts, and the fifth mb007_lrn_* learning schema and account instead.'
      : result.placementBrowser
        ? '- No `run/cleanup.sql` was written under this opt-in because it would contain the synthetic principal id. Drop the disposable iam_service, learner_service, and dedicated mb006 content and assessment schemas and accounts instead.'
        : '- No `run/cleanup.sql` was written under this opt-in because it would contain the synthetic principal id. Drop the disposable `iam_service` and `learner_service` schemas/accounts instead.')
    lines.push('')
    if (result.fullBrowser) {
      const full = result.fullBrowser
      lines.push('## MB-006 full H5 placement and learning-plan browser', '')
      lines.push(`- Full browser status: \`${full.status}\`; scenario: \`${full.scenario ?? 'absent'}\`; budget met: \`${full.budgetMet === true}\`; observer: \`${full.observer?.status ?? 'absent'}\`; owned services: \`${full.services?.status ?? 'absent'}\`.`)
      lines.push('- This is not a B72 checks[] entry and it is not the B89 first-question placementBrowser result. The harness does not POST a target, placement, answer, or plan. The DSH observer owns those UI actions. Observer budgets are required for the overall result.')
      lines.push('- Owned Content `127.0.0.1:18089`, Assessment `127.0.0.1:18091`, and Learning `127.0.0.1:18090` start after the eligible-actor pre-read and stop in their own finally. Gateway content TARGET is `http://127.0.0.1:18089` for the browser catalog GET. Assessment and Learning still read Content directly at that same port. IAM receives only the assessment-service digest. The raw workload secret is placed only on the Assessment JVM. Learning uses the fifth mb007_lrn_* JDBC account. Kafka stays disabled.')
      lines.push(process.env.MB006_PLACEMENT_RETEST_CONTINUATION === 'MB006_PLACEMENT_RETEST_CONTINUATION'
        ? '- The full H5 directory is the B100 assessment theme directory, already canonical, and `MB006_FULL_BROWSER_INDEX_SHA256` is hashed from `index.html` before runtime. DSH42 receives `full`, `fullArtifact`, `fullIndexSha`, and `retestContinuation`. `MB033_RUN_DIRECTORY` is `/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run`.'
        : '- The full H5 directory is `MB006_FULL_BROWSER_ARTIFACT`, already canonical, and `MB006_FULL_BROWSER_INDEX_SHA256` is hashed from `index.html` before runtime. DSH42 receives only `full`, `fullArtifact`, and `fullIndexSha`. `MB033_RUN_DIRECTORY` is `/private/tmp/grok-mobile-resume-home-return-464/run`.')
      lines.push('- No bypass score token is set. DEC-04 stays NOT_ASSERTED. No bearer or database password is written.')
      lines.push('')
    } else if (result.placementBrowser) {
      const placement = result.placementBrowser
      lines.push('## MB-006 placement browser extension', '')
      lines.push(`- Placement status: \`${placement.status}\`; observer: \`${placement.observer?.status ?? 'absent'}\`; Content/Assessment services: \`${placement.services?.status ?? 'absent'}\`.`)
      lines.push('- This is not a B72 checks[] entry. The harness does not POST placement or seed a target. The DSH observer creates the route after its browser target readback and guide tap. Observer placement success is required for the overall result.')
      lines.push('- Owned Content `127.0.0.1:18089` and Assessment `127.0.0.1:18091` start after the eligible-actor pre-read and stop in their own finally. That cleanup is `placementBrowser.services.cleanup`, separate from the Learner cleanup.')
      lines.push('- No answer, plan, score, retest, skip, or DEC-04 assertion is added. No bearer or database password is written.')
      lines.push('')
    }
  } else if (result.learnerTargetProbe) {
    const probe = result.learnerTargetProbe
    lines.push('## MB-033 learner-target extension', '')
    lines.push(`- Probe status: \`${probe.status}\`; kind: \`${probe.kind}\`.`)
    lines.push('- Gateway B14: learner `TARGET`; content/learning/assessment/media/gamification/social/commerce `LEGACY`. Only the learner domain has a route.')
    lines.push('- Proof scope: anonymous deny; prior profile/target/preferences reads; one `PUT /learner/targets` with the exact prior `expectedStateVersion`, `CET_4_6`/`B1`/30 minutes/`ACTIVE`; one same-key replay only after a 200; owner target, profile, and preferences readback; no preferences write; no Learning plan mutation.')
    lines.push('- The probe starts and stops its own bounded Learner JVM on `127.0.0.1:18088` and validates the root-pinned jar SHA-256. No token, principal id, idempotency key, password, or service-client secret is written; the B72 result uses `principalIdSha256` instead of the raw id under this opt-in.')
    lines.push('- No `run/cleanup.sql` was written under this opt-in because it would contain the synthetic principal id. Drop the disposable `iam_service` and `learner_service` schemas/accounts instead.')
    lines.push('')
  }
  return lines.join('\n')
}

function writeArtifacts(result, outFile, reportFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true })
  let body = JSON.stringify(result, null, 2)
  if (fullBrowserEnabled()) {
    const secrets = [
      process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET,
      process.env.LEARNER_CONSENT_RECHECK_CLIENT_SECRET,
      process.env.MB007_LEARNING_JDBC_PASSWORD,
      process.env.MB006_CONTENT_JDBC_PASSWORD,
      process.env.MB006_ASSESSMENT_JDBC_PASSWORD,
      process.env.MB004_MYSQL_PASSWORD,
      process.env.MB033_LEARNER_JDBC_PASSWORD,
    ].filter((value) => typeof value === 'string' && value.length > 0)
    for (const secret of secrets) body = body.split(secret).join('{redacted}')
    body = body.replace(/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gu, '{redacted}')
  }
  fs.writeFileSync(outFile, `${body}\n`, { mode: 0o600 })
  fs.writeFileSync(reportFile, renderReport(result), { mode: 0o644 })
}

async function inspectPreflight(repo, parsed) {
  const base = resultBase('inspect', repo)
  try {
    const repoFacts = validateRepo(repo)
    base.candidate = { ...base.candidate, ...repoFacts }
    const fixture = loadFixture(repo)
    base.fixture = {
      path: FIXTURE_REL,
      fileSha256: sha256(fixture.raw),
      documents: fixture.documents.map((document) => ({
        type: document.type, purpose: document.purpose, documentVersion: document.documentVersion,
        digest: document.documentDigest, codePoints: codePoints(document.bodyText),
        bytes: Buffer.byteLength(document.bodyText, 'utf8'),
      })),
    }
    validateFixture(fixture.fixture, fixture.documents, fixture.raw)
    validateSource(repo)
    validateSql(repo, fixture.fixture)
    validateSeedHelper()
    const iamJar = resolveJar(repo, 'iam-service', 'iam-service-')
    const gatewayJar = resolveJar(repo, 'api-gateway', 'api-gateway-')
    check('jars.iam.present', iamJar.ok && iamJar.content?.ok, false, iamJar.ok ? { stale: iamJar.stale, content: iamJar.content, digest: iamJar.digest } : { reason: iamJar.reason })
    check('jars.gateway.present', gatewayJar.ok && gatewayJar.content?.ok, false, gatewayJar.ok ? { stale: gatewayJar.stale, content: gatewayJar.content, digest: gatewayJar.digest } : { reason: gatewayJar.reason })
    const java = java25()
    check('java.25', java.ok, true, { version: java.text })
    const [mysql, gateway, iam] = await Promise.all([
      probeTcp(MYSQL_HOST, MYSQL_PORT),
      probeTcp('127.0.0.1', 18070),
      probeTcp('127.0.0.1', 18087),
    ])
    check('inspect.mysql_listening', mysql, false, { host: MYSQL_HOST, port: MYSQL_PORT })
    check('inspect.gateway_port_free', !gateway, false, { port: 18070 })
    check('inspect.iam_port_free', !iam, false, { port: 18087 })
    base.coverage = { covered: [], notCovered: ['inspect mode did not start IAM, Gateway, MySQL, a browser, a container, a migration, or any HTTP request.', ...coverageForRun().notCovered] }
  } catch (error) {
    check('harness.fatal', false, true, { error: error.message })
  }
  base.preflightStatus = base.checks.some((entry) => entry.required && !entry.ok) ? 'FAIL' : 'PASS'
  base.runtime.reason = 'inspect mode: no server, database, browser, container, migration or HTTP request was started'
  base.cleanup = { performed: false, preferred: 'Drop the disposable iam_service database/container after the supervised run.' }
  finalizeCounts(base)
  writeArtifacts(base, parsed.out, parsed.report)
  log(`inspect complete: ${base.counts.passed}/${base.counts.total} checks passed, required failures=${base.counts.requiredFailed}`)
  log(`wrote ${parsed.out}`)
  log(`wrote ${parsed.report}`)
  if (base.preflightStatus === 'FAIL') process.exitCode = 1
}

async function validateTargetProbeConfig() {
  const runDir = process.env.MB033_RUN_DIRECTORY
  let expectedRunDirectory = browserProbeEnabled() ? TARGET_BROWSER_RUN_DIRECTORY : TARGET_PROBE_RUN_DIRECTORY
  if (fullBrowserEnabled()) {
    const ownerModule = await import(pathToFileURL(path.join(HARNESS_DIR, 'full-browser-owner.mjs')).href)
    expectedRunDirectory = ownerModule.FULL_BROWSER_ROOT_ARTIFACT_DIR
    const proven = ownerModule.provenFullArtifact()
    const callback = ownerModule.callbackOptions()
    const callbackKeys = Object.keys(callback)
    const retestOn = process.env.MB006_PLACEMENT_RETEST_CONTINUATION === 'MB006_PLACEMENT_RETEST_CONTINUATION'
    const expectedLiteral = retestOn
      ? '/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run'
      : '/private/tmp/grok-mobile-resume-home-return-464/run'
    const expectedCallbackKeys = retestOn
      ? ['full', 'fullArtifact', 'fullIndexSha', 'retestContinuation']
      : ['full', 'fullArtifact', 'fullIndexSha']
    targetConfigMust(expectedRunDirectory === expectedLiteral,
      'placement.full_run_directory_literal', 'the full browser artifact run path literal must be the owner path')
    targetConfigMust(callback.full === true
      && callback.fullArtifact === proven.artifact
      && callback.fullIndexSha === proven.indexSha
      && (!retestOn || callback.retestContinuation === true)
      && callbackKeys.length === expectedCallbackKeys.length
      && expectedCallbackKeys.every((key, index) => callbackKeys[index] === key),
    'placement.full_callback', retestOn
      ? 'the retest continuation callback must pass the proven B100 artifact, index SHA, and retestContinuation'
      : 'the full browser callback must pass only the proven full artifact and index SHA')
    targetConfigMust(fs.existsSync(path.join(HARNESS_DIR, 'placement-start-read.mjs'))
      && fs.existsSync(path.join(HARNESS_DIR, 'learning-plan-ensure.mjs'))
      && fs.existsSync(path.join(HARNESS_DIR, 'full-browser-owner.mjs')),
    'placement.full_modules', 'the full browser owner modules must be beside the harness')
  } else if (placementBrowserEnabled()) {
    const probeModule = await import(pathToFileURL(TARGET_PROBE_MODULE).href)
    expectedRunDirectory = probeModule.PLACEMENT_BROWSER_ROOT_ARTIFACT_DIR
    targetConfigMust(typeof expectedRunDirectory === 'string' && path.isAbsolute(expectedRunDirectory),
      'placement.run_directory_literal', 'the MB-006 artifact run path literal must be one absolute path')
    targetConfigMust(fs.existsSync(path.join(HARNESS_DIR, 'placement-start-read.mjs')),
      'placement.module', 'placement-start-read.mjs must be beside the harness')
  }
  targetConfigMust(runDir === expectedRunDirectory, 'target.run_directory',
    'MB033_RUN_DIRECTORY must be the exact root artifact directory for the selected mode; no fallback')
  targetConfigMust(typeof runDir === 'string' && path.isAbsolute(runDir) && path.resolve(runDir) === runDir,
    'target.run_directory_exact', 'MB033_RUN_DIRECTORY must be an exact absolute path')
  targetConfigMust(fs.existsSync(runDir) && fs.statSync(runDir).isDirectory(), 'target.run_directory_exists',
    'MB033_RUN_DIRECTORY must already exist as an owner-created directory')
  targetConfigMust((fs.statSync(runDir).mode & 0o077) === 0, 'target.run_directory_private',
    'MB033_RUN_DIRECTORY must not be group/world accessible')
  if (fullBrowserEnabled()) {
    const listed = fs.lstatSync(runDir)
    targetConfigMust(!listed.isSymbolicLink() && listed.isDirectory() && fs.realpathSync(runDir) === runDir,
      'placement.full_run_directory_canonical',
      'MB033_RUN_DIRECTORY must be the exact canonical private directory, not a symlink or shared writable path')
  }
  targetConfigMust(fs.existsSync(TARGET_PROBE_MODULE) && fs.statSync(TARGET_PROBE_MODULE).isFile(),
    'target.probe_module', 'the in-process learner-target-probe.mjs must be beside the harness')
  if (browserProbeEnabled()) {
    targetConfigMust(fs.existsSync(BROWSER_PROBE_MODULE) && fs.statSync(BROWSER_PROBE_MODULE).isFile(),
      'target.browser_module', 'browser-target-probe.cjs must be beside the harness for MB-004 browser mode')
  }

  const learnerJar = process.env.MB033_LEARNER_JAR
  targetConfigMust(typeof learnerJar === 'string' && fs.existsSync(learnerJar) && fs.statSync(learnerJar).isFile(),
    'target.learner_jar', 'MB033_LEARNER_JAR must be the exact pinned Learner jar')
  const expectedSha = String(process.env.MB033_LEARNER_JAR_SHA256 || '').toLowerCase()
  const actualSha = sha256(fs.readFileSync(learnerJar))
  targetConfigMust(/^[0-9a-f]{64}$/u.test(expectedSha) && actualSha === expectedSha, 'target.learner_jar_sha256',
    'MB033_LEARNER_JAR_SHA256 must be the pinned lowercase SHA-256 of MB033_LEARNER_JAR', { actual: actualSha })
  const controller = unzipEntry(learnerJar, 'BOOT-INF/classes/com/englishflow/learner/web/LearnerHttpController.class')
  const recheck = unzipEntry(learnerJar, 'BOOT-INF/classes/com/englishflow/learner/web/IamLearningConsentRecheck.class')
  targetConfigMust(Boolean(controller && recheck), 'target.learner_jar_content',
    'the pinned Learner jar lacks the target owner controller or the live consent recheck class')

  const jdbc = String(process.env.MB033_LEARNER_JDBC_URL || '')
  targetConfigMust(/^jdbc:mysql:\/\/127\.0\.0\.1:13306\/learner_service(?:\?[^\s]*)?$/u.test(jdbc) && !jdbc.includes('@'),
    'target.learner_jdbc_url', 'MB033_LEARNER_JDBC_URL must be the owned 127.0.0.1:13306/learner_service schema')
  targetConfigMust(process.env.MB033_LEARNER_SCHEMA === 'learner_service', 'target.learner_schema',
    'MB033_LEARNER_SCHEMA must be learner_service')
  const user = process.env.MB033_LEARNER_JDBC_USERNAME
  targetConfigMust(user && user !== 'root' && process.env.MB033_LEARNER_JDBC_PASSWORD, 'target.learner_db_user',
    'MB033_LEARNER_JDBC_USERNAME/PASSWORD must be an owned non-root learner DB account')

  const digest = String(process.env.IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST || '').toLowerCase()
  const secret = String(process.env.LEARNER_CONSENT_RECHECK_CLIENT_SECRET || '')
  targetConfigMust(/^[0-9a-f]{64}$/u.test(digest), 'target.iam_client_digest',
    'IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST must be the precomputed lowercase SHA-256 hex digest')
  targetConfigMust(secret.length >= 16, 'target.consent_secret',
    'LEARNER_CONSENT_RECHECK_CLIENT_SECRET must be the freshly generated disposable secret')
  targetConfigMust(sha256Utf8(secret) === digest, 'target.consent_digest_match',
    'LEARNER_CONSENT_RECHECK_CLIENT_SECRET does not match IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST')
  const enabled = process.env.LEARNER_CONSENT_RECHECK_ENABLED
  targetConfigMust(enabled === undefined || /^true$/iu.test(enabled), 'target.consent_enabled',
    'LEARNER_CONSENT_RECHECK_ENABLED must be true; the real service consent recheck cannot be disabled')
  const baseUrl = process.env.LEARNER_CONSENT_RECHECK_IAM_BASE_URL
  targetConfigMust(baseUrl === undefined || baseUrl.replace(/\/+$/u, '') === 'https://127.0.0.1:18087',
    'target.consent_base_url', 'LEARNER_CONSENT_RECHECK_IAM_BASE_URL must be https://127.0.0.1:18087')
  const clientId = process.env.LEARNER_CONSENT_RECHECK_CLIENT_ID
  targetConfigMust(clientId === undefined || clientId === 'learner-service', 'target.consent_client_id',
    'LEARNER_CONSENT_RECHECK_CLIENT_ID must be learner-service')
  const learnerBusy = await probeTcp('127.0.0.1', 18088)
  targetConfigMust(!learnerBusy, 'target.port_free',
    'Port 18088 is already in use; stop its owner rather than changing the port')

  return {
    enabled: true,
    ...(browserProbeEnabled() ? {
      mode: 'BROWSER',
      browserModule: path.basename(BROWSER_PROBE_MODULE),
    } : {}),
    runDirectory: runDir,
    learnerJar: path.basename(learnerJar),
    learnerJarSha256: actualSha,
    jdbc: { host: '127.0.0.1', port: 13306, schema: 'learner_service' },
    dbUserNonRoot: true,
    consentRecheck: { enabled: true, iamBaseUrl: 'https://127.0.0.1:18087', clientId: 'learner-service', digestMatched: true },
    route: fullBrowserEnabled()
      ? {
        gatewayB14Enabled: true,
        learner: 'TARGET',
        assessment: 'TARGET',
        learning: 'TARGET',
        content: 'TARGET',
        contentBase: 'http://127.0.0.1:18089',
        contentInternal: 'DIRECT',
        otherDomains: 'LEGACY',
        learningPort: 18090,
        kafka: false,
        contentDirect: true,
      }
      : placementBrowserEnabled()
        ? {
          gatewayB14Enabled: true,
          learner: 'TARGET',
          assessment: 'TARGET',
          content: 'LEGACY',
          learning: 'LEGACY',
          otherDomains: 'LEGACY',
          learningPort: 18090,
          learningStarted: false,
        }
        : { gatewayB14Enabled: true, learner: 'TARGET', otherDomains: 'LEGACY' },
    port18088Free: true,
  }
}

async function runPreflight(repo, base) {
  if (process.env.MB033_LEARNER_TARGET_PROBE !== undefined && !targetProbeEnabled()) {
    targetConfigError('target.opt_in', 'MB033_LEARNER_TARGET_PROBE must be the exact opt-in token or absent')
  }
  if (process.env.MB004_TARGET_BROWSER_PROBE !== undefined && !browserProbeEnabled()) {
    targetConfigError('target.browser_opt_in',
      'MB004_TARGET_BROWSER_PROBE must be the exact browser opt-in token or absent')
  }
  if (browserProbeEnabled() && !targetProbeEnabled()) {
    targetConfigError('target.browser_b14_flag',
      'MB004_TARGET_BROWSER_PROBE requires MB033_LEARNER_TARGET_PROBE=YES_RUN_MB033_LEARNER_TARGET_PROBE')
  }
  if (process.env.MB006_PLACEMENT_BROWSER !== undefined && !placementBrowserEnabled()) {
    targetConfigError('placement.browser_opt_in',
      'MB006_PLACEMENT_BROWSER must be the exact opt-in token or absent')
  }
  if (placementBrowserEnabled() && (!browserProbeEnabled() || !targetProbeEnabled())) {
    targetConfigError('placement.requires_b85',
      'MB006_PLACEMENT_BROWSER requires MB004_TARGET_BROWSER_PROBE=YES_LOCAL_H5_TARGET_SMOKE and MB033_LEARNER_TARGET_PROBE=YES_RUN_MB033_LEARNER_TARGET_PROBE')
  }
  if (process.env.MB006_PLACEMENT_FULL_BROWSER !== undefined && !fullBrowserEnabled()) {
    targetConfigError('placement.full_opt_in',
      'MB006_PLACEMENT_FULL_BROWSER must be the exact opt-in token or absent')
  }
  if (fullBrowserEnabled() && (!placementBrowserEnabled() || !browserProbeEnabled() || !targetProbeEnabled())) {
    targetConfigError('placement.full_requires_flags',
      'MB006_PLACEMENT_FULL_BROWSER requires MB004_TARGET_BROWSER_PROBE, MB033_LEARNER_TARGET_PROBE, and MB006_PLACEMENT_BROWSER')
  }
  if (fullBrowserEnabled()) {
    for (const name of [
      'MB006_PLACEMENT_START_READ', 'MB006_PLACEMENT_CHECKPOINT', 'MB006_PLACEMENT_COMPLETION',
      'MB007_LEARNING_PLAN_ENSURE', 'MB006_ACCESS_TOKEN', 'ASSESSMENT_PLACEMENT_SCORE_SERVICE_TOKEN',
    ]) {
      if (process.env[name]) targetConfigError('placement.full_exclusive', `${name} must be unset for full browser mode`)
    }
    const digest = String(process.env.IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST || '').toLowerCase()
    const secret = String(process.env.ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET || '')
    targetConfigMust(/^[0-9a-f]{64}$/u.test(digest), 'placement.full_digest',
      'IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST must be lowercase SHA-256 hex')
    targetConfigMust(secret.length >= 16 && !/\s/u.test(secret), 'placement.full_secret',
      'ASSESSMENT_PLACEMENT_SCORE_CLIENT_SECRET must be an unspaced secret of at least 16 characters')
    targetConfigMust(sha256Utf8(secret) === digest, 'placement.full_digest_match',
      'the assessment workload secret does not match the IAM assessment-service digest')
    const schema = String(process.env.MB007_LEARNING_SCHEMA || '')
    targetConfigMust(/^mb007_lrn_[a-z0-9]{8,24}$/u.test(schema), 'placement.full_learning_schema',
      'MB007_LEARNING_SCHEMA must be a dedicated mb007_lrn_* schema')
    targetConfigMust(process.env.MB007_LEARNING_JDBC_URL === `jdbc:mysql://127.0.0.1:13306/${schema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
      'placement.full_learning_jdbc', 'MB007_LEARNING_JDBC_URL must be the dedicated loopback schema')
    targetConfigMust(/^mb007l_[a-z0-9]{8,24}$/u.test(String(process.env.MB007_LEARNING_JDBC_USERNAME || '')),
      'placement.full_learning_user', 'MB007_LEARNING_JDBC_USERNAME must be a dedicated mb007l_* account')
    const learningPassword = String(process.env.MB007_LEARNING_JDBC_PASSWORD || '')
    targetConfigMust(learningPassword.length >= 16 && !/\s/u.test(learningPassword), 'placement.full_learning_password',
      'MB007_LEARNING_JDBC_PASSWORD must be an unspaced secret of at least 16 characters')
    const learnerPin = '62b9dda75ec2547a32ef55b99fe6821fdcfe4e65841bf77d54e28289fc5c4733'
    const learnerJar = process.env.MB033_LEARNER_JAR
    targetConfigMust(String(process.env.MB033_LEARNER_JAR_SHA256 || '').toLowerCase() === learnerPin
      && typeof learnerJar === 'string' && fs.existsSync(learnerJar) && fs.statSync(learnerJar).isFile()
      && sha256(fs.readFileSync(learnerJar)) === learnerPin,
    'placement.full_learner_jar', 'MB033_LEARNER_JAR must be the B91 learner pin')
    for (const account of [
      ['MB006_CONTENT_SCHEMA', /^mb006_cnt_[a-z0-9]{8,24}$/u, 'MB006_CONTENT_JDBC_USERNAME', /^mb006c_[a-z0-9]{8,24}$/u, 'MB006_CONTENT_JDBC_URL', 'MB006_CONTENT_JDBC_PASSWORD'],
      ['MB006_ASSESSMENT_SCHEMA', /^mb006_asm_[a-z0-9]{8,24}$/u, 'MB006_ASSESSMENT_JDBC_USERNAME', /^mb006a_[a-z0-9]{8,24}$/u, 'MB006_ASSESSMENT_JDBC_URL', 'MB006_ASSESSMENT_JDBC_PASSWORD'],
    ]) {
      const [schemaName, schemaPattern, userName, userPattern, urlName, passwordName] = account
      const accountSchema = String(process.env[schemaName] || '')
      const accountPassword = String(process.env[passwordName] || '')
      targetConfigMust(schemaPattern.test(accountSchema), 'placement.full_account_schema', `${schemaName} must be a dedicated schema`)
      targetConfigMust(userPattern.test(String(process.env[userName] || '')), 'placement.full_account_user', `${userName} must be a dedicated account`)
      targetConfigMust(process.env[urlName] === `jdbc:mysql://127.0.0.1:13306/${accountSchema}?useUnicode=true&characterEncoding=utf8&serverTimezone=UTC&useSSL=false&allowPublicKeyRetrieval=true`,
        'placement.full_account_jdbc', `${urlName} must be the dedicated loopback schema`)
      targetConfigMust(accountPassword.length >= 16 && !/\s/u.test(accountPassword), 'placement.full_account_password',
        `${passwordName} must be an unspaced secret of at least 16 characters`)
    }
    const pins = {
      MB006_CONTENT_JAR: retestContinuationEnabled() ? RETEST_CONTENT_JAR_SHA256 : FULL_BROWSER_CONTENT_JAR_SHA256,
      MB006_ASSESSMENT_JAR: retestContinuationEnabled() ? RETEST_ASSESSMENT_JAR_SHA256 : FULL_BROWSER_ASSESSMENT_JAR_SHA256,
      MB007_LEARNING_JAR: FULL_BROWSER_LEARNING_JAR_SHA256,
    }
    for (const [name, pin] of Object.entries(pins)) {
      const jar = process.env[name]
      targetConfigMust(typeof jar === 'string' && fs.existsSync(jar) && fs.statSync(jar).isFile(),
        'placement.full_jar', `${name} must be the pinned jar file`)
      targetConfigMust(String(process.env[`${name}_SHA256`] || '').toLowerCase() === pin && sha256(fs.readFileSync(jar)) === pin,
        'placement.full_jar_sha', `${name} SHA-256 does not match the owner pin`)
    }
    for (const port of [18089, 18090, 18091, 18183]) {
      targetConfigMust(!(await probeTcp('127.0.0.1', port)), 'placement.full_port_free',
        `127.0.0.1:${port} is already in use; attachment is not allowed`)
    }
  }
  must(process.env.MB004_RUN_APPROVAL === RUN_APPROVAL, 'run.approval', 'MB004_RUN_APPROVAL is not the exact approval token')
  must(process.env.MB004_MYSQL_DISPOSABLE === DISPOSABLE_APPROVAL, 'run.disposable_confirmation', 'MB004_MYSQL_DISPOSABLE is not the exact disposable confirmation')
  must(Boolean(process.env.MB004_MYSQL_USER), 'run.mysql_user', 'MB004_MYSQL_USER is required')
  must(Boolean(process.env.MB004_MYSQL_PASSWORD), 'run.mysql_password', 'MB004_MYSQL_PASSWORD is required')
  const repoFacts = validateRepo(repo)
  base.candidate = { ...base.candidate, ...repoFacts }
  const fixture = loadFixture(repo)
  base.fixture = {
    path: FIXTURE_REL,
    fileSha256: sha256(fixture.raw),
    documents: fixture.documents.map((document) => ({
      type: document.type, purpose: document.purpose, documentVersion: document.documentVersion,
      digest: document.documentDigest, codePoints: codePoints(document.bodyText),
      bytes: Buffer.byteLength(document.bodyText, 'utf8'),
    })),
  }
  validateFixture(fixture.fixture, fixture.documents, fixture.raw)
  validateSource(repo)
  validateSql(repo, fixture.fixture)
  validateSeedHelper()
  const java = java25()
  must(java.ok, 'java.25', 'Java 25 is required')
  const iamJar = resolveJar(repo, 'iam-service', 'iam-service-')
  must(iamJar.ok && iamJar.content?.ok, 'jars.iam', `IAM jar is missing or lacks the candidate V19/B69 classes: ${iamJar.reason || JSON.stringify(iamJar.content || {})}`)
  const gatewayJar = resolveJar(repo, 'api-gateway', 'api-gateway-')
  must(gatewayJar.ok && gatewayJar.content?.ok, 'jars.gateway', `Gateway jar is missing or lacks the candidate IAM routes: ${gatewayJar.reason || JSON.stringify(gatewayJar.content || {})}`)
  check('jars.iam.digest', /^[0-9a-f]{64}$/u.test(iamJar.digest), true, { digest: iamJar.digest })
  check('jars.gateway.digest', /^[0-9a-f]{64}$/u.test(gatewayJar.digest), true, { digest: gatewayJar.digest })
  const mysqlOpen = await probeTcp(MYSQL_HOST, MYSQL_PORT)
  must(mysqlOpen, 'mysql.reachable', `disposable MySQL is not listening at ${MYSQL_HOST}:${MYSQL_PORT}`)
  const gatewayBusy = await probeTcp('127.0.0.1', 18070)
  const iamBusy = await probeTcp('127.0.0.1', 18087)
  must(!gatewayBusy, 'ports.gateway_free', 'Port 18070 is already in use; stop its owner rather than changing the port')
  must(!iamBusy, 'ports.iam_free', 'Port 18087 is already in use; stop its owner rather than changing the port')
  if (targetProbeEnabled()) base.targetProbe = await validateTargetProbeConfig()
  const runId = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`
  // Under MB-033, keep IAM/Gateway/Learner JVM logs and TLS material in a
  // private temp run directory, not in the artifact root. The artifact root
  // then carries only the sanitized result/report/source. With the opt-in
  // absent, B72 keeps its original HARNESS_DIR/run location.
  const runDirectory = targetProbeEnabled()
    ? path.join(os.tmpdir(), `dsh-mb033-b72-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`)
    : path.join(HARNESS_DIR, 'run')
  fs.mkdirSync(runDirectory, { recursive: true, mode: 0o700 })
  fs.chmodSync(runDirectory, 0o700)
  const tls = prepareTls(path.join(runDirectory, 'tls'))
  const connector = resolveConnectorJar(iamJar.jar, runDirectory)
  const classes = compileSeed(runDirectory)
  const idempotencyReplaySecret = crypto.randomBytes(32).toString('hex')
  let idempotencyFingerprintSecret = crypto.randomBytes(32).toString('hex')
  if (idempotencyFingerprintSecret === idempotencyReplaySecret) idempotencyFingerprintSecret = crypto.randomBytes(32).toString('hex')
  base.preflightStatus = base.checks.some((entry) => entry.required && !entry.ok) ? 'FAIL' : 'PASS'
  return {
    base, fixture, java: javaTool('java'), iamJar, gatewayJar, tls, connector, classes, runDirectory, runId,
    idempotencyReplaySecret, idempotencyFingerprintSecret,
  }
}

function serviceEnvironment(name, ctx) {
  const base = {
    PATH: process.env.PATH || '/usr/bin:/bin:/usr/sbin:/sbin',
    HOME: process.env.HOME || '',
    TMPDIR: process.env.TMPDIR || '/tmp',
    LANG: 'C.UTF-8',
    LC_ALL: 'C.UTF-8',
    OTEL_ENABLED: 'false',
    MANAGEMENT_OTLP_METRICS_EXPORT_ENABLED: 'false',
    MANAGEMENT_TRACING_EXPORT_ENABLED: 'false',
  }
  if (name === 'iam') {
    const environment = {
      ...base,
      SPRING_PROFILES_ACTIVE: 'local',
      SERVER_ADDRESS: '127.0.0.1',
      SERVER_PORT: '18087',
      SERVER_SSL_ENABLED: 'true',
      SERVER_SSL_KEYSTORETYPE: 'PKCS12',
      SERVER_SSL_KEY_STORE_TYPE: 'PKCS12',
      SERVER_SSL_KEYALIAS: ctx.tls.keyAlias,
      SERVER_SSL_KEY_ALIAS: ctx.tls.keyAlias,
      SERVER_SSL_KEYSTORE: ctx.tls.keyStore,
      SERVER_SSL_KEY_STORE: ctx.tls.keyStore,
      SERVER_SSL_KEYSTOREPASSWORD: ctx.tls.keyStorePassword,
      SERVER_SSL_KEY_STORE_PASSWORD: ctx.tls.keyStorePassword,
      IAM_PERSISTENCE_ENABLED: 'true',
      IAM_FLYWAY_ENABLED: 'true',
      IAM_PERSISTENCE_SCHEMA: MYSQL_SCHEMA,
      // application.yaml placeholders. Same disposable JDBC_URL and MB004_MYSQL_* values; no literals.
      IAM_JDBC_URL: JDBC_URL,
      IAM_JDBC_USERNAME: process.env.MB004_MYSQL_USER,
      IAM_JDBC_PASSWORD: process.env.MB004_MYSQL_PASSWORD,
      IAM_CONSENT_POLICY_SOURCE: 'control-plane',
      IAM_LOCAL_ADULT_GATE_ENABLED: 'true',
      // Spring Boot's canonical environment spelling removes dashes; the underscore
      // spelling is also emitted because the existing local launcher uses it. Both resolve
      // to the same properties on the supported Spring Boot line.
      IAM_IDEMPOTENCY_REPLAYSECRET: ctx.idempotencyReplaySecret,
      IAM_IDEMPOTENCY_REPLAY_SECRET: ctx.idempotencyReplaySecret,
      IAM_IDEMPOTENCY_FINGERPRINTSECRET: ctx.idempotencyFingerprintSecret,
      IAM_IDEMPOTENCY_FINGERPRINT_SECRET: ctx.idempotencyFingerprintSecret,
      IAM_IDEMPOTENCY_V13WRITERSDRAINED: 'true',
      IAM_IDEMPOTENCY_V13_WRITERS_DRAINED: 'true',
      IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
      IAM_JWT_AUDIENCE: 'yuxuexing-api',
      IAM_JWT_ALGORITHM: 'RS256',
      IAM_JWT_PRIVATEKEYFILE: ctx.tls.signerPem,
      IAM_JWT_PRIVATE_KEY_FILE: ctx.tls.signerPem,
      IAM_JWT_EPHEMERALKEYSALLOWED: 'false',
      IAM_JWT_EPHEMERAL_KEYS_ALLOWED: 'false',
      IAM_JWT_REFRESHCOOKIESECURE: 'true',
      IAM_JWT_REFRESH_COOKIE_SECURE: 'true',
      IAM_POLICY_BOOTSTRAP_ENABLED: 'false',
      SPRING_MAIN_BANNER_MODE: 'off',
    }
    if (targetProbeEnabled()) {
      // Digest only. The raw learner service-client secret stays in the
      // Learner JVM environment and is never passed to IAM or written.
      environment.IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST = process.env.IAM_SERVICE_CLIENT_LEARNER_SECRET_DIGEST
    }
    if (fullBrowserEnabled()) {
      environment.IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST = process.env.IAM_SERVICE_CLIENT_ASSESSMENT_SECRET_DIGEST
    }
    return environment
  }
  const environment = {
    ...base,
    SPRING_PROFILES_ACTIVE: 'local',
    SERVER_ADDRESS: '127.0.0.1',
    API_GATEWAY_PORT: '18070',
    IAM_SERVICE_BASE_URL: IAM_ORIGIN,
    IAM_ROUTE_ENABLED: 'true',
    IAM_JWT_ISSUER: 'http://127.0.0.1:18087',
    IAM_JWT_JWKS_URI: `${IAM_ORIGIN}/api/v1/auth/jwks`,
    IAM_JWT_AUDIENCE: 'yuxuexing-api',
    GATEWAY_RESOURCE_SERVER_ENABLED: 'true',
    GATEWAY_JWT_PREVALIDATION_ENABLED: 'true',
    GATEWAY_RATE_LIMIT_ENABLED: 'true',
    GATEWAY_RATE_LIMIT_BACKEND: 'memory',
    GATEWAY_RATE_LIMIT_FAIL_OPEN: 'false',
    GATEWAY_SECURITY_AUDIT_ENABLED: 'true',
    // Local memory-limiter runtime only. Readiness HTTP and JWT validation stay required.
    MANAGEMENT_HEALTH_REDIS_ENABLED: 'false',
    B12_SERVICES_ENABLED: 'false',
    B13_SERVICES_ENABLED: 'false',
    B14_STRANGLER_ENABLED: targetProbeEnabled() ? 'true' : 'false',
    WORKFLOW_SERVICES_ENABLED: 'false',
    SPRING_MAIN_BANNER_MODE: 'off',
  }
  if (targetProbeEnabled()) {
    // Learner is TARGET. MB-006 also sets assessment TARGET. Full browser also
    // sets learning and content TARGET. Every other domain stays LEGACY.
    // Without the full token, content and learning stay LEGACY.
    environment.B14_ROUTE_MODE_LEARNER = 'TARGET'
    for (const domain of TARGET_PROBE_OTHER_MODES) {
      environment[`B14_ROUTE_MODE_${domain}`] = placementBrowserEnabled() && domain === 'ASSESSMENT'
        ? 'TARGET'
        : fullBrowserEnabled() && (domain === 'LEARNING' || domain === 'CONTENT')
          ? 'TARGET'
          : 'LEGACY'
    }
    environment.LEARNER_SERVICE_BASE_URL = 'http://127.0.0.1:18088'
    if (placementBrowserEnabled()) environment.ASSESSMENT_SERVICE_BASE_URL = 'http://127.0.0.1:18091'
    if (fullBrowserEnabled()) {
      environment.LEARNING_SERVICE_BASE_URL = 'http://127.0.0.1:18090'
      environment.CONTENT_SERVICE_BASE_URL = 'http://127.0.0.1:18089'
    }
  }
  return environment
}

function jvmArgs(tls, name) {
  if (name === 'iam') return []
  return [
    `-Djavax.net.ssl.trustStore=${tls.trustStore}`,
    '-Djavax.net.ssl.trustStoreType=PKCS12',
    `-Djavax.net.ssl.trustStorePassword=${tls.trustStorePassword}`,
    '-Dio.netty.handler.ssl.noOpenSsl=true',
  ]
}

async function gatewayRequest(requestPath, options = {}) {
  if (!GATEWAY_ALLOW_LIST.has(requestPath)) {
    throw new Error('gatewayRequest refused a path outside the bearer, anonymous probe, JWKS, and CORS allow-list')
  }
  return request(GATEWAY_BASE, requestPath, {
    ...options,
    headers: { Origin: MOBILE_ORIGIN, ...(options.headers || {}) },
  })
}

async function iamRequest(requestPath, options = {}) {
  return request(IAM_BASE, requestPath, {
    ...options,
    ca: run.tls.caPem,
    headers: { Origin: MOBILE_ORIGIN, Referer: MOBILE_REFERER, ...(options.headers || {}) },
  })
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` }
}

function consentPayload(document) {
  return {
    type: document.type,
    version: document.documentVersion,
    decision: 'ACCEPTED',
    expectedDocumentDigest: document.documentDigest,
  }
}

function principalDocuments(response) {
  return response.json?.data?.publishedConsentDocuments
}

function checkPrincipalDocs(response, documents, prefix) {
  const actual = principalDocuments(response)
  if (!Array.isArray(actual) || actual.length !== 3) {
    check(`${prefix}.count`, false, true, { count: Array.isArray(actual) ? actual.length : null })
    throw new Error(`${prefix}: expected exactly three published documents`)
  }
  check(`${prefix}.count`, true, true, { count: actual.length })
  const byType = new Map(actual.map((document) => [document.type, document]))
  for (const expected of documents) {
    const document = byType.get(expected.type)
    const exact = Boolean(document
      && document.purpose === expected.purpose
      && document.documentVersion === expected.documentVersion
      && document.documentDigest === expected.documentDigest
      && document.bodyText === expected.bodyText
      && document.policyVersion === expected.policyVersion
      && document.policyRef === expected.policyRef)
    check(`${prefix}.${expected.type}.exact`, exact, true, {
      type: document?.type || null, purpose: document?.purpose || null,
      codePoints: document?.bodyText ? codePoints(document.bodyText) : null,
      digest: document?.documentDigest || null,
    })
    check(`${prefix}.${expected.type}.published_at`, document?.publishedAt === expected.publishedAt, false, {
      actual: document?.publishedAt || null, expected: expected.publishedAt,
    })
    check(`${prefix}.${expected.type}.hash`, document?.bodyText ? sha256Utf8(document.bodyText) === expected.documentDigest : false,
      true, { recomputed: document?.bodyText ? sha256Utf8(document.bodyText) : null })
    check(`${prefix}.${expected.type}.no_nul`, document?.bodyText ? !document.bodyText.includes('\u0000') : false, true)
  }
  check(`${prefix}.no_state_body`, !Object.prototype.hasOwnProperty.call(response.json?.data?.consentState || {}, 'bodyText'), true)
  check(`${prefix}.no_state_docs`, !Object.prototype.hasOwnProperty.call(response.json?.data?.consentState || {}, 'publishedConsentDocuments'), true)
  check(`${prefix}.wire_literal`, documents.every((document) => response.text.includes(JSON.stringify(document.bodyText))), false, {
    allBodiesLiteralInWireJson: documents.every((document) => response.text.includes(JSON.stringify(document.bodyText))),
  })
}

function checkPrincipalNoDocs(response, prefix) {
  const data = response.json?.data
  check(`${prefix}.key_absent`, data && !Object.prototype.hasOwnProperty.call(data, 'publishedConsentDocuments'), true, {
    keyPresent: Boolean(data && Object.prototype.hasOwnProperty.call(data, 'publishedConsentDocuments')),
  })
  check(`${prefix}.wire_absent`, !response.text.includes('"publishedConsentDocuments"'), true)
  check(`${prefix}.body_absent`, !response.text.includes('模拟文档') && !response.text.includes('账号条款样本'), true)
}

function checkConsentResponse(response, expected, prefix) {
  assertStatus(response, 200, `${prefix}.status`)
  check(`${prefix}.no_store`, noStore(response), true, { cacheControl: response.headers['cache-control'] || null })
  const data = response.json?.data
  check(`${prefix}.shape`, Boolean(data && data.type === expected.type && data.purpose === expected.purpose
    && data.state === 'GRANTED' && data.decision === 'ACCEPTED' && data.required === true), true, {
    type: data?.type || null, purpose: data?.purpose || null, state: data?.state || null, decision: data?.decision || null,
  })
  check(`${prefix}.document`, Boolean(data?.document && data.document.version === expected.documentVersion
    && data.document.digest === expected.documentDigest), true, {
    version: data?.document?.version || null, digest: data?.document?.digest || null,
  })
  check(`${prefix}.policy`, Boolean(data && data.policyVersion === expected.policyVersion && data.policyRef === expected.policyRef), true, {
    policyVersion: data?.policyVersion || null, policyRef: data?.policyRef || null,
  })
  check(`${prefix}.provenance`, Boolean(data?.provenance
    && data.provenance.authority === 'IAM_SERVER_RECORDED_CONSENT'
    && data.provenance.documentSource === 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST'
    && data.provenance.policySource === 'IAM_ACTIVE_POLICY_CONTROL_PLANE'), true, data?.provenance || null)
  check(`${prefix}.no_body`, !response.text.includes('模拟文档') && !response.text.includes('"bodyText"'), true)
}

function checkConsentList(response, documents) {
  assertStatus(response, 200, 'consents.get.status')
  check('consents.get.no_store', noStore(response), true, { cacheControl: response.headers['cache-control'] || null })
  const items = response.json?.data?.items
  check('consents.get.count', Array.isArray(items) && items.length === 3, true, { count: Array.isArray(items) ? items.length : null })
  if (!Array.isArray(items)) throw new Error('consent list has no items array')
  for (const expected of documents) {
    const matches = items.filter((item) => item.type === expected.type)
    check(`consents.get.${expected.type}.one`, matches.length === 1, true, { count: matches.length })
    const item = matches[0]
    check(`consents.get.${expected.type}.grant`, Boolean(item && item.purpose === expected.purpose
      && item.state === 'GRANTED' && item.decision === 'ACCEPTED' && item.required === true
      && item.document?.version === expected.documentVersion
      && item.document?.digest === expected.documentDigest
      && item.policyVersion === expected.policyVersion
      && item.policyRef === expected.policyRef
      && item.provenance?.authority === 'IAM_SERVER_RECORDED_CONSENT'
      && item.provenance?.documentSource === 'PUBLISHED_DOCUMENT_VERSION_AND_DIGEST'
      && item.provenance?.policySource === 'IAM_ACTIVE_POLICY_CONTROL_PLANE'), true, {
      type: item?.type || null, state: item?.state || null, decision: item?.decision || null,
      digest: item?.document?.digest || null,
    })
  }
  check('consents.get.no_body', !response.text.includes('模拟文档') && !response.text.includes('"bodyText"')
    && !response.text.includes('"publishedConsentDocuments"'), true)
}

function checkJwt(token, jwks, publicData, prefix) {
  const verified = verifyJwt(token, jwks)
  check(`${prefix}.signature`, verified.verified && verified.header.alg === 'RS256' && verified.header.typ === 'JWT', true, {
    alg: verified.header.alg, typ: verified.header.typ, kid: verified.header.kid || null,
  })
  const payload = verified.payload
  const aud = audienceValues(payload)
  const now = Math.floor(Date.now() / 1000)
  check(`${prefix}.claims`, payload.iss === 'http://127.0.0.1:18087'
    && aud.includes('yuxuexing-api')
    && payload.token_type === 'access'
    && /^[0-9a-f-]{36}$/u.test(String(payload.sub))
    && /^[0-9a-f-]{36}$/u.test(String(payload.session_id))
    && /^[0-9a-f-]{36}$/u.test(String(payload.device_id))
    && payload.tenant_id === 'platform'
    && typeof payload.exp === 'number' && payload.exp > now
    && typeof payload.iat === 'number' && payload.iat <= now + 60
    && typeof payload.nbf === 'number' && payload.nbf <= now + 60
    && typeof payload.jti === 'string' && payload.jti.length > 0, true, {
    issuer: payload.iss || null, audience: aud, tokenType: payload.token_type || null,
    hasSubject: Boolean(payload.sub), hasSession: Boolean(payload.session_id), hasDevice: Boolean(payload.device_id),
    tenant: payload.tenant_id || null, exp: payload.exp || null,
  })
  check(`${prefix}.principal_binding`, Boolean(publicData && payload.sub === publicData.principalId
    && payload.session_id === publicData.sessionId && payload.device_id === publicData.deviceId), true, {
    subjectMatchesPrincipal: payload.sub === publicData?.principalId,
    sessionMatchesPrincipal: payload.session_id === publicData?.sessionId,
    deviceMatchesPrincipal: payload.device_id === publicData?.deviceId,
  })
}

async function jwksFromGateway() {
  // gatewayRequest adds MOBILE_ORIGIN. IAMAuthCorsConfiguration allows cross-origin POST/OPTIONS
  // for /api/v1/auth/ (including a proxied origin), so this GET is not a browser JWKS fetch.
  // Status only: required known sample 403. ok stays true for that sample, so the run does not
  // become PARTIAL. The historical jwks.status failure is archived on this detail root.
  // This check does not claim browser public-JWKS acceptance.
  const browserOrigin = await gatewayRequest('/auth/jwks', { method: 'GET' })
  const browserOriginStatus = browserOrigin.status
  check('jwks.mobile_origin.diagnostic', browserOriginStatus === 403, true, {
    historicalFailedResult: { archived: true, check: 'jwks.status', status: 403 },
    knownSample: 403,
    status: browserOriginStatus,
    browserPublicJwksAccepted: false,
  })

  // Required lookup, same shape as ordinaryRuntimeChecks: GET GATEWAY_BASE + '/auth/jwks'
  // through request(). No Origin, Referer, Authorization, or cookie.
  const response = await request(GATEWAY_BASE, '/auth/jwks', { method: 'GET' })
  assertStatus(response, 200, 'jwks.status')
  const keys = response.json?.data?.keys || response.json?.keys
  const publicRs256 = Array.isArray(keys)
    ? keys.filter((item) => item
      && item.alg === 'RS256'
      && item.use === 'sig'
      && typeof item.kid === 'string'
      && !('d' in item))
    : []
  check('jwks.keys', Array.isArray(keys) && keys.length > 0, true, { count: Array.isArray(keys) ? keys.length : 0 })
  check('jwks.public_rs256', publicRs256.length > 0, true, { count: publicRs256.length })
  check('jwks.no_store', noStore(response) || String(response.headers['cache-control'] || '').includes('max-age'), false, {
    cacheControl: response.headers['cache-control'] || null,
  })
  return keys || []
}

async function runAcceptance(repo, parsed) {
  const base = resultBase('run', repo)
  let ctx
  try {
    ctx = await runPreflight(repo, base)
  } catch (error) {
    base.status = 'FAIL'
    base.preflightStatus = 'FAIL'
    base.runtime = { ...base.runtime, status: 'FAIL', error: error.message }
    check('harness.preflight', false, true, { error: error.message })
    base.coverage = coverageForRun()
    finalizeCounts(base)
    writeArtifacts(base, parsed.out, parsed.report)
    log(`run preflight failed: ${error.message}`)
    process.exitCode = 1
    return
  }
  run = ctx
  const documents = ctx.fixture.documents
  const byType = fixtureMap(documents)
  const identifier = `mb004-${ctx.runId}@example.invalid`
  const password = `Mb004!${crypto.randomBytes(24).toString('base64url')}`
  const runDirectory = ctx.runDirectory
  const logDirectory = path.join(runDirectory, 'logs')
  fs.mkdirSync(logDirectory, { recursive: true, mode: 0o700 })
  const iamLog = path.join(logDirectory, 'iam.log')
  const gatewayLog = path.join(logDirectory, 'gateway.log')
  let iam = null
  let gateway = null
  let principalId = null
  let targetProbeResult = null
  const browserMode = browserProbeEnabled()
  try {
    iam = startService(ctx.java, ctx.iamJar.jar, ['-Dfile.encoding=UTF-8'], serviceEnvironment('iam', ctx), iamLog, ['--iam.jwt.refresh-cookie-secure=true'])
    check('iam.started', true, true, { port: 18087, pid: iam.pid })
    await waitForHealth(IAM_ORIGIN, iam, ctx.tls.caPem)
    check('iam.ready', true, true, { port: 18087 })
    gateway = startService(ctx.java, ctx.gatewayJar.jar, [...jvmArgs(ctx.tls, 'gateway'), '-Dfile.encoding=UTF-8'], serviceEnvironment('gateway', ctx), gatewayLog)
    check('gateway.started', true, true, { port: 18070, pid: gateway.pid })
    await waitForHealth(GATEWAY_ORIGIN, gateway)
    check('gateway.ready', true, true, { port: 18070 })

    const errorFile = path.join(runDirectory, 'seed-error.log')
    const partial = runSeed(ctx.java, ctx.classes, ctx.connector, path.join(HARNESS_DIR, 'sql', 'seed-partial.sql'),
      process.env.MB004_MYSQL_USER, process.env.MB004_MYSQL_PASSWORD, errorFile)
    check('seed.partial', partial.fixtureRows === 2 && partial.documentBodyColumn === true, true, {
      fixtureRows: partial.fixtureRows, documentBodyColumn: partial.documentBodyColumn,
    })

    const partialProbe = await iamRequest('/auth/register', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('partial-register', ctx.runId, '1') },
      body: authPayload(identifier, password),
    })
    check('partial.register.503', partialProbe.status === 503, true, { status: partialProbe.status })
    check('partial.register.error', errorCode(partialProbe) === 'SERVICE_UNAVAILABLE'
      && errorMessage(partialProbe) === 'iam.consent.version_unavailable', true, {
      errorCode: errorCode(partialProbe), message: errorMessage(partialProbe),
    })
    check('partial.register.no_token', !partialProbe.json?.data?.accessToken, true)
    if (partialProbe.status !== 503) throw new Error('partial publication did not fail closed before account creation')

    const full = runSeed(ctx.java, ctx.classes, ctx.connector, path.join(HARNESS_DIR, 'sql', 'seed-full.sql'),
      process.env.MB004_MYSQL_USER, process.env.MB004_MYSQL_PASSWORD, errorFile)
    check('seed.full', full.fixtureRows === 3 && full.documentBodyColumn === true, true, {
      fixtureRows: full.fixtureRows, documentBodyColumn: full.documentBodyColumn,
    })

    const register = await iamRequest('/auth/register', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('register', ctx.runId, '1') },
      body: authPayload(identifier, password),
    })
    assertStatus(register, 201, 'auth.register.direct.status')
    authResponseChecks('auth.register.direct', register)
    const registered = tokenBody(register)
    tokenCheck('auth.register.direct.token', registered)
    cookieChecks('auth.register.direct.cookie', parseRefreshCookie(register.setCookies))
    const initialToken = registered.accessToken

    const anonymous = await gatewayRequest('/iam/principal/me', { method: 'GET' })
    check('principal.anonymous.denied', anonymous.status === 401 || anonymous.status === 403, true, { status: anonymous.status })
    check('principal.anonymous.no_token', !anonymous.json?.data?.accessToken, true)

    const beforeGate = await gatewayRequest('/iam/principal/me', { method: 'GET', headers: bearer(initialToken) })
    assertStatus(beforeGate, 200, 'principal.pre_gate.status')
    check('principal.pre_gate.no_store', noStore(beforeGate), true, { cacheControl: beforeGate.headers['cache-control'] || null })
    checkPrincipalNoDocs(beforeGate, 'principal.pre_gate')
    check('principal.pre_gate.restricted', beforeGate.json?.data?.status === 'RESTRICTED'
      && beforeGate.json?.data?.consentState?.accepted === false, true, {
      status: beforeGate.json?.data?.status || null, accepted: beforeGate.json?.data?.consentState?.accepted ?? null,
    })
    principalId = beforeGate.json?.data?.principalId || null

    const adultGate = await gatewayRequest('/iam/adult-gate', {
      method: 'POST',
      headers: { ...bearer(initialToken), 'Idempotency-Key': idempotencyKey('adult-gate', ctx.runId, '1') },
      body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
    })
    assertStatus(adultGate, 200, 'adult_gate.status')
    check('adult_gate.no_store', noStore(adultGate), true, { cacheControl: adultGate.headers['cache-control'] || null })
    check('adult_gate.passed', adultGate.json?.data?.status === 'PASSED'
      && adultGate.json?.data?.learningAccess === 'ELIGIBLE'
      && adultGate.json?.data?.evidenceStatus === 'SERVER_VERIFIED', true, {
      status: adultGate.json?.data?.status || null, learningAccess: adultGate.json?.data?.learningAccess || null,
      evidenceStatus: adultGate.json?.data?.evidenceStatus || null,
    })

    const afterGate = await gatewayRequest('/iam/principal/me', { method: 'GET', headers: bearer(initialToken) })
    assertStatus(afterGate, 200, 'principal.docs.status')
    check('principal.docs.no_store', noStore(afterGate), true, { cacheControl: afterGate.headers['cache-control'] || null })
    check('principal.docs.content_type', String(afterGate.headers['content-type'] || '').includes('application/json'), true)
    check('principal.docs.utf8', afterGate.utf8Error === null, true, { utf8Error: afterGate.utf8Error })
    check('principal.docs.restricted_until_consent', afterGate.json?.data?.status === 'RESTRICTED'
      && afterGate.json?.data?.adultGate?.learningAccess === 'ELIGIBLE'
      && afterGate.json?.data?.consentState?.accepted === false, true, {
      status: afterGate.json?.data?.status || null,
      learningAccess: afterGate.json?.data?.adultGate?.learningAccess || null,
      accepted: afterGate.json?.data?.consentState?.accepted ?? null,
    })
    checkPrincipalDocs(afterGate, documents, 'principal.docs')

    const jwks = await jwksFromGateway()
    checkJwt(initialToken, jwks, afterGate.json?.data, 'jwt.initial')

    const missingKey = await gatewayRequest('/iam/consents', {
      method: 'PUT', headers: bearer(initialToken), body: consentPayload(byType.get('PRIVACY')),
    })
    check('consent.missing_key.400', missingKey.status === 400 && errorCode(missingKey) === 'VALIDATION_ERROR'
      && errorMessage(missingKey) === 'iam.idempotency.invalid', true, {
      status: missingKey.status, errorCode: errorCode(missingKey), message: errorMessage(missingKey),
    })

    const stale = await gatewayRequest('/iam/consents', {
      method: 'PUT',
      headers: { ...bearer(initialToken), 'Idempotency-Key': idempotencyKey('consent-stale', ctx.runId, '1') },
      body: { type: 'PRIVACY', version: 'stale-version-999', decision: 'ACCEPTED', expectedDocumentDigest: byType.get('PRIVACY').documentDigest },
    })
    check('consent.stale.409', stale.status === 409 && errorCode(stale) === 'CONFLICT'
      && errorMessage(stale) === 'iam.consent.version_mismatch', true, {
      status: stale.status, errorCode: errorCode(stale), message: errorMessage(stale),
    })
    check('consent.stale.no_store', noStore(stale), true, { cacheControl: stale.headers['cache-control'] || null })
    const afterStale = await gatewayRequest('/iam/consents', { method: 'GET', headers: bearer(initialToken) })
    assertStatus(afterStale, 200, 'consents.after_stale.status')
    check('consents.after_stale.empty', Array.isArray(afterStale.json?.data?.items) && afterStale.json.data.items.length === 0, true, {
      count: Array.isArray(afterStale.json?.data?.items) ? afterStale.json.data.items.length : null,
    })

    const termsKey = idempotencyKey('consent-terms', ctx.runId, '1')
    const termsBody = consentPayload(byType.get('TERMS'))
    const terms = await gatewayRequest('/iam/consents', {
      method: 'PUT', headers: { ...bearer(initialToken), 'Idempotency-Key': termsKey }, body: termsBody,
    })
    checkConsentResponse(terms, byType.get('TERMS'), 'consent.terms')
    const termsDecisionRef = terms.json?.data?.decisionRef || null
    check('consent.terms.decision_ref', Boolean(termsDecisionRef), true, { present: Boolean(termsDecisionRef) })

    const replay = await gatewayRequest('/iam/consents', {
      method: 'PUT', headers: { ...bearer(initialToken), 'Idempotency-Key': termsKey }, body: termsBody,
    })
    checkConsentResponse(replay, byType.get('TERMS'), 'consent.terms_replay')
    check('consent.terms_replay.same_record', Boolean(termsDecisionRef && replay.json?.data?.decisionRef === termsDecisionRef), true, {
      sameDecisionRef: Boolean(termsDecisionRef && replay.json?.data?.decisionRef === termsDecisionRef),
    })
    const afterTerms = await gatewayRequest('/iam/consents', { method: 'GET', headers: bearer(initialToken) })
    assertStatus(afterTerms, 200, 'consents.after_terms.status')
    check('consents.after_terms.one', Array.isArray(afterTerms.json?.data?.items) && afterTerms.json.data.items.length === 1, true, {
      count: Array.isArray(afterTerms.json?.data?.items) ? afterTerms.json.data.items.length : null,
    })

    const privacy = await gatewayRequest('/iam/consents', {
      method: 'PUT',
      headers: { ...bearer(initialToken), 'Idempotency-Key': idempotencyKey('consent-privacy', ctx.runId, '1') },
      body: consentPayload(byType.get('PRIVACY')),
    })
    checkConsentResponse(privacy, byType.get('PRIVACY'), 'consent.privacy')

    const adult = await gatewayRequest('/iam/consents', {
      method: 'PUT',
      headers: { ...bearer(initialToken), 'Idempotency-Key': idempotencyKey('consent-adult', ctx.runId, '1') },
      body: consentPayload(byType.get('ADULT_LEARNING')),
    })
    checkConsentResponse(adult, byType.get('ADULT_LEARNING'), 'consent.adult')

    const consents = await gatewayRequest('/iam/consents', { method: 'GET', headers: bearer(initialToken) })
    checkConsentList(consents, documents)

    const completed = await gatewayRequest('/iam/principal/me', { method: 'GET', headers: bearer(initialToken) })
    assertStatus(completed, 200, 'principal.completed.status')
    check('principal.completed.no_store', noStore(completed), true, { cacheControl: completed.headers['cache-control'] || null })
    checkPrincipalNoDocs(completed, 'principal.completed')
    check('principal.completed.active', completed.json?.data?.status === 'ACTIVE'
      && completed.json?.data?.consentState?.accepted === true
      && completed.json?.data?.adultGate?.learningAccess === 'ELIGIBLE', true, {
      status: completed.json?.data?.status || null,
      accepted: completed.json?.data?.consentState?.accepted ?? null,
      learningAccess: completed.json?.data?.adultGate?.learningAccess || null,
    })
    check('principal.completed.no_consent_body', !completed.text.includes('模拟文档') && !completed.text.includes('账号条款样本'), true)

    const directLogin = await iamRequest('/auth/login', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('direct-login', ctx.runId, '1') },
      body: authPayload(identifier, password),
    })
    assertStatus(directLogin, 200, 'auth.login.direct.status')
    authResponseChecks('auth.login.direct', directLogin)
    const directTokenData = tokenBody(directLogin)
    tokenCheck('auth.login.direct.token', directTokenData)
    const directCookie = parseRefreshCookie(directLogin.setCookies)
    cookieChecks('auth.login.direct.cookie', directCookie)
    const directPrincipal = await gatewayRequest('/iam/principal/me', { method: 'GET', headers: bearer(directTokenData.accessToken) })
    assertStatus(directPrincipal, 200, 'auth.login.direct.principal.status')
    check('auth.login.direct.principal.completed', directPrincipal.json?.data?.consentState?.accepted === true
      && !Object.prototype.hasOwnProperty.call(directPrincipal.json?.data || {}, 'publishedConsentDocuments'), true)

    const refresh = await iamRequest('/auth/token/refresh', {
      method: 'POST',
      headers: { 'Idempotency-Key': idempotencyKey('direct-refresh', ctx.runId, '1'), ...cookieHeader(directCookie) },
    })
    assertStatus(refresh, 200, 'auth.refresh.direct.status')
    authResponseChecks('auth.refresh.direct', refresh)
    const refreshedData = tokenBody(refresh)
    tokenCheck('auth.refresh.direct.token', refreshedData)
    const refreshedCookie = parseRefreshCookie(refresh.setCookies)
    cookieChecks('auth.refresh.direct.cookie', refreshedCookie)
    check('auth.refresh.rotated', Boolean(refreshedData.accessToken && refreshedData.accessToken !== directTokenData.accessToken)
      && Boolean(refreshedCookie && directCookie && refreshedCookie.value !== directCookie.value), true, {
      accessTokenChanged: Boolean(refreshedData.accessToken && refreshedData.accessToken !== directTokenData.accessToken),
      cookieChanged: Boolean(refreshedCookie && directCookie && refreshedCookie.value !== directCookie.value),
    })
    const refreshedPrincipal = await gatewayRequest('/iam/principal/me', { method: 'GET', headers: bearer(refreshedData.accessToken) })
    assertStatus(refreshedPrincipal, 200, 'auth.refresh.principal.status')
    check('auth.refresh.principal.completed', refreshedPrincipal.json?.data?.consentState?.accepted === true
      && !Object.prototype.hasOwnProperty.call(refreshedPrincipal.json?.data || {}, 'publishedConsentDocuments'), true)
    checkJwt(refreshedData.accessToken, jwks, refreshedPrincipal.json?.data, 'jwt.refreshed')

    // MB-033: import the optional extension in-process only after the real B72
    // signing flow has produced its refreshed access token. The token is passed
    // as an ordinary in-memory argument; no token-bearing Node subprocess is
    // spawned. The extension adds no checks[] entry, so B72's 184-check scope
    // remains separate. MB-006 placement evidence stays on placementBrowser.
    if (targetProbeEnabled()) {
      const { runLearnerTargetProbe } = await import(pathToFileURL(TARGET_PROBE_MODULE).href)
      targetProbeResult = await runLearnerTargetProbe({
        token: refreshedData.accessToken,
        optIn: process.env.MB033_LEARNER_TARGET_PROBE,
        runDirectory: process.env.MB033_RUN_DIRECTORY,
        learnerJar: process.env.MB033_LEARNER_JAR,
        learnerJarSha256: process.env.MB033_LEARNER_JAR_SHA256,
        learnerJdbcUrl: process.env.MB033_LEARNER_JDBC_URL,
        learnerJdbcUsername: process.env.MB033_LEARNER_JDBC_USERNAME,
        learnerJdbcPassword: process.env.MB033_LEARNER_JDBC_PASSWORD,
        learnerSchema: process.env.MB033_LEARNER_SCHEMA,
        logDirectory: ctx.runDirectory,
        trustStore: ctx.tls.trustStore,
        trustStorePassword: ctx.tls.trustStorePassword,
        java: ctx.java,
        ...(browserMode ? {
          browser: true,
          identifier,
          password,
          caPem: ctx.tls.caPem,
          ...(placementBrowserEnabled() ? {
            placementBrowser: true,
            gatewayJar: ctx.gatewayJar.jar,
          } : {}),
        } : {}),
      })
      // The root QA wrapper reads the existing learnerTargetProbe slot; in
      // browser mode that slot holds the browser result, and the additional
      // browserTargetProbe slot keeps the separate MB-004 outcome explicit.
      base.learnerTargetProbe = targetProbeResult
      if (browserMode) base.browserTargetProbe = targetProbeResult
    }

    const corsGateway = await gatewayRequest('/iam/principal/me', {
      method: 'OPTIONS',
      headers: {
        Origin: MOBILE_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
    check('cors.gateway.preflight', corsGateway.status >= 200 && corsGateway.status < 400
      && String(corsGateway.headers['access-control-allow-origin'] || '') === MOBILE_ORIGIN, false, {
      status: corsGateway.status, allowOrigin: corsGateway.headers['access-control-allow-origin'] || null,
    })
    const corsIam = await request(IAM_BASE, '/auth/login', {
      method: 'OPTIONS',
      ca: ctx.tls.caPem,
      headers: {
        Origin: MOBILE_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,idempotency-key',
      },
    })
    check('cors.iam.preflight', corsIam.status >= 200 && corsIam.status < 400
      && String(corsIam.headers['access-control-allow-origin'] || '') === MOBILE_ORIGIN, false, {
      status: corsIam.status, allowOrigin: corsIam.headers['access-control-allow-origin'] || null,
    })

    check('gateway.request_headers', Boolean(afterGate.headers['x-request-id'] || afterGate.headers['x-trace-id']), false, {
      requestId: Boolean(afterGate.headers['x-request-id']), traceId: Boolean(afterGate.headers['x-trace-id']),
    })

    base.preflightStatus = base.checks.some((entry) => entry.required && !entry.ok) ? 'FAIL' : 'PASS'
    const principalFacts = targetProbeEnabled()
      ? { principalIdPresent: Boolean(principalId), principalIdSha256: principalId ? sha256Utf8(principalId) : null }
      : { principalId }
    base.runtime = {
      ...base.runtime,
      status: 'COMPLETED',
      runId: ctx.runId,
      ...principalFacts,
      seed: { fixtureRows: full.fixtureRows, documentBodyColumn: full.documentBodyColumn, runtimeStatus: 'NOT_RUNTIME_VERIFIED' },
      jars: { iam: ctx.iamJar.digest, gateway: ctx.gatewayJar.digest },
      tls: { material: path.relative(HARNESS_DIR, ctx.tls.directory), caSha256: sha256(fs.readFileSync(ctx.tls.caPem)) },
      logs: { iam: path.relative(HARNESS_DIR, iamLog), gateway: path.relative(HARNESS_DIR, gatewayLog) },
    }
    base.coverage = coverageForRun()
    if (targetProbeResult) {
      if (browserMode) {
        base.coverage.covered.push('MB-004 local H5 browser target smoke and real Gateway owner target/profile/preferences readback after B72 signing')
        if (fullBrowserEnabled()) {
          base.coverage.covered.push('MB-006 full H5 observer while owned Content, Assessment, and Learning are up, with learner, assessment, learning, and content B14 TARGET')
          base.coverage.notCovered.push('The harness does not POST a target, placement, answer, or plan. Content internal reads stay direct on 18089. The browser catalog GET uses Gateway content TARGET. Kafka stays disabled. DEC-04 and DB rows are not asserted here.')
        } else if (placementBrowserEnabled()) {
          base.coverage.covered.push('MB-006 Chrome placement observer while owned Content and Assessment are up, with learner and assessment B14 TARGET')
          base.coverage.notCovered.push('Programmatic placement POST, target seed, answers, plan, score, retest, skip, and DEC-04 are not performed by this harness')
        }
        base.coverage.notCovered.push('Browser/Chrome internals, H5 rendering, visual assertions, and the browser module receipt content are owned by browser-target-probe.cjs and the root wrapper, not by this harness')
      } else {
        base.coverage.covered.push('Gateway B14 learner TARGET owner target PUT/readback over real HTTP after B72 signing')
        base.coverage.notCovered.push('Learning plan mutation, consent/target seeding, policy bypass, preference write, and cross-principal access are deliberately not exercised by MB-033')
      }
    }
    base.cleanup = {
      performed: false,
      preferred: targetProbeEnabled()
        ? (fullBrowserEnabled()
          ? 'Drop the disposable iam_service, learner_service, dedicated mb006 content and assessment schemas/accounts, and the fifth mb007_lrn_* learning schema/account; do not retain them.'
          : placementBrowserEnabled()
            ? 'Drop the disposable iam_service, learner_service, and dedicated mb006 content and assessment schemas/accounts; do not retain them.'
            : 'Drop the disposable iam_service and learner_service schemas/accounts; do not retain either.')
        : 'Drop the disposable iam_service database/container and remove the /tmp run directory.',
      cleanupSql: targetProbeEnabled() ? null : 'run/cleanup.sql',
      processesStopped: false,
    }
    if (targetProbeEnabled()) {
      // A cleanup.sql would necessarily contain the synthetic principal id,
      // which this proof is not allowed to publish. Drop the disposable
      // schemas/accounts instead.
      base.cleanupInstructions = fullBrowserEnabled()
        ? 'Drop the disposable iam_service, learner_service, dedicated mb006 content and assessment schemas and accounts, and the fifth mb007_lrn_* learning schema and account. No run/cleanup.sql was written because it would contain the synthetic principal id; the target proof never publishes that id.'
        : placementBrowserEnabled()
          ? 'Drop the disposable iam_service, learner_service, and dedicated mb006 content and assessment schemas and accounts. No run/cleanup.sql was written because it would contain the synthetic principal id; the target proof never publishes that id.'
          : 'Drop the disposable iam_service and learner_service schemas and accounts. No run/cleanup.sql was written because it would contain the synthetic principal id; the target proof never publishes that id.'
    } else {
      writeCleanupSql(runDirectory, principalId)
      base.cleanupInstructions = cleanupInstructions(runDirectory, principalId)
    }
    if (fullBrowserEnabled()) {
      base.fullBrowser = targetProbeResult?.fullBrowser
        || { kind: 'MB006_PLACEMENT_FULL_BROWSER', schemaVersion: '1', optIn: FULL_BROWSER_OPT_IN, status: 'FAIL' }
    } else if (placementBrowserEnabled()) {
      base.placementBrowser = targetProbeResult?.placementBrowser
        || { kind: 'MB006_PLACEMENT_BROWSER', schemaVersion: '1', optIn: PLACEMENT_BROWSER_OPT_IN, status: 'FAIL' }
    }
    base.status = base.checks.some((entry) => entry.required && !entry.ok) ? 'FAIL'
      : targetProbeResult && targetProbeResult.status !== 'PASS' ? 'FAIL'
        : base.fullBrowser && base.fullBrowser.status !== 'PASS' ? 'FAIL'
          : base.placementBrowser && base.placementBrowser.status !== 'PASS' ? 'FAIL' : 'PASS'
    if (base.status === 'PASS' && base.checks.some((entry) => !entry.ok && !entry.required)) base.status = 'PARTIAL'
  } catch (error) {
    base.status = 'FAIL'
    base.runtime = { ...base.runtime, status: 'FAIL', error: error.message }
    base.coverage = coverageForRun()
    if (targetProbeEnabled()) {
      base.cleanupInstructions = fullBrowserEnabled()
        ? 'Drop the disposable iam_service, learner_service, dedicated mb006 content and assessment schemas and accounts, and the fifth mb007_lrn_* learning schema and account. No run/cleanup.sql was written because it would contain the synthetic principal id.'
        : placementBrowserEnabled()
          ? 'Drop the disposable iam_service, learner_service, and dedicated mb006 content and assessment schemas and accounts. No run/cleanup.sql was written because it would contain the synthetic principal id.'
          : 'Drop the disposable iam_service and learner_service schemas and accounts. No run/cleanup.sql was written because it would contain the synthetic principal id.'
    } else if (principalId) {
      writeCleanupSql(runDirectory, principalId)
      base.cleanupInstructions = cleanupInstructions(runDirectory, principalId)
    }
    check('harness.runtime', false, true, { error: error.message })
  } finally {
    await stopService(gateway)
    await stopService(iam)
    const gatewayFree = !(await probeTcp('127.0.0.1', 18070))
    const iamFree = !(await probeTcp('127.0.0.1', 18087))
    check('cleanup.processes_stopped', gatewayFree && iamFree, true, { gatewayFree, iamFree })
    base.cleanup = { ...base.cleanup, performed: true, processesStopped: gatewayFree && iamFree }
    if (fullBrowserEnabled()) {
      base.fullBrowser = targetProbeResult?.fullBrowser
        || { kind: 'MB006_PLACEMENT_FULL_BROWSER', schemaVersion: '1', optIn: FULL_BROWSER_OPT_IN, status: 'FAIL' }
    } else if (placementBrowserEnabled()) {
      base.placementBrowser = targetProbeResult?.placementBrowser
        || { kind: 'MB006_PLACEMENT_BROWSER', schemaVersion: '1', optIn: PLACEMENT_BROWSER_OPT_IN, status: 'FAIL' }
    }
    base.status = base.checks.some((entry) => entry.required && !entry.ok)
      ? 'FAIL'
      : base.learnerTargetProbe && base.learnerTargetProbe.status !== 'PASS' ? 'FAIL'
        : base.browserTargetProbe && base.browserTargetProbe.status !== 'PASS' ? 'FAIL'
          : base.fullBrowser && base.fullBrowser.status !== 'PASS' ? 'FAIL'
            : base.placementBrowser && base.placementBrowser.status !== 'PASS' ? 'FAIL'
              : base.checks.some((entry) => !entry.ok && !entry.required) ? 'PARTIAL' : 'PASS'
    finalizeCounts(base)
    writeArtifacts(base, parsed.out, parsed.report)
    log(`run complete: status=${base.status}, passed=${base.counts.passed}/${base.counts.total}, required failures=${base.counts.requiredFailed}`)
    log(`wrote ${parsed.out}`)
    log(`wrote ${parsed.report}`)
    if (base.status === 'FAIL') process.exitCode = 1
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))
  if (parsed.help) {
    log('Usage: node acceptance.mjs [--mode inspect|run] [--repo <repo>] [--out <result.json>] [--report <REPORT.md>]')
    return
  }
  if (!fs.existsSync(path.join(parsed.repo, 'AGENTS.md')) || !fs.existsSync(path.join(parsed.repo, FIXTURE_REL))) {
    throw new Error(`repo root does not look like CloudStudy: ${parsed.repo}`)
  }
  if (fullBrowserEnabled()) {
    if (!parsed.outSet) parsed.out = path.join(HARNESS_DIR, 'full-browser-result.json')
    if (!parsed.reportSet) parsed.report = path.join(HARNESS_DIR, 'full-browser-run-report.md')
  }
  if (parsed.mode === 'inspect') {
    await inspectPreflight(parsed.repo, parsed)
    return
  }
  await runAcceptance(parsed.repo, parsed)
}

main().catch((error) => {
  log(`fatal: ${error.message}`)
  const parsed = (() => { try { return parseArgs(process.argv.slice(2)) } catch { return { out: path.join(HARNESS_DIR, 'result.json'), report: path.join(HARNESS_DIR, 'REPORT.md') } } })()
  const result = {
    kind: 'MB004_R1_008_LOCAL_HTTP_ACCEPTANCE', schemaVersion: '1', generatedAt: isoNow(),
    mode: parsed.mode || 'unknown', status: 'FAIL', preflightStatus: 'FAIL',
    candidate: { expectedCommit: expectedServiceCommit() }, fixture: null,
    runtime: { status: 'FAIL', reason: error.message },
    checks: checks.length ? checks : [{ id: 'harness.fatal', ok: false, required: true, detail: { error: error.message } }],
    counts: { total: 1, passed: 0, failed: 1, warned: 0, requiredFailed: 1 },
    coverage: { covered: [], notCovered: [] },
    cleanup: { performed: false, preferred: 'Drop the disposable iam_service database/container after review.' },
  }
  finalizeCounts(result)
  writeArtifacts(result, parsed.out, parsed.report)
  process.exitCode = 1
})
