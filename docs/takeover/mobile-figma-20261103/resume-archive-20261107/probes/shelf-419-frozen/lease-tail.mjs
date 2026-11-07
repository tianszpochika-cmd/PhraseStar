/**
 * run_probe tail for the B139 course-shelf H5 lease (G419).
 *
 * The frozen hook success line has no subject. This process logs the same
 * approved owner in once over IAM TLS, reads GET /api/v1/iam/principal/me with
 * that bearer, and keeps the subject only long enough to call the observer.
 * Identifier, password, subject, nonce, and bearer stay off stdout and argv.
 * Importing this file does not listen or log in. A direct run without the
 * credential and certificate env prints a usage line and returns.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { observeShelfEmpty } from './shelf-empty-observer.mjs'
import { B139_H5_ROOT, B139_INDEX_SHA, openPinnedNonceStatic } from './pinned-static-nonce.mjs'

const IAM_ORIGIN = 'https://127.0.0.1:18087'
const GATEWAY_ORIGIN = 'http://127.0.0.1:18070'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'

function emit(fields) {
  const outcome = typeof fields.outcome === 'string' ? fields.outcome : null
  process.stdout.write(`${JSON.stringify({
    status: fields.status,
    reason: fields.reason,
    launched: fields.launched === true,
    h5Started: fields.h5Started === true,
    shelfEmptyReady: fields.shelfEmptyReady === true,
    observed: fields.observed === true,
    outcome,
    subjectPrinted: false,
    passwordOmitted: true,
    identifierOmitted: true,
    nonceValueOmitted: true,
    subjectOmitted: true,
  })}\n`)
}

function safeReason(value, fallback) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 40) return fallback
  return /^[a-z0-9-]+$/.test(value) ? value : fallback
}

function underTmp(real) {
  const parent = path.dirname(real)
  return parent === '/tmp' || parent.startsWith('/tmp/') || parent === '/private/tmp' || parent.startsWith('/private/tmp/')
}

function readCredential(file) {
  if (typeof file !== 'string' || !file.startsWith('/') || file.includes('\0')) return null
  let listed
  let real
  try {
    listed = fs.lstatSync(file)
    real = fs.realpathSync(file)
  } catch {
    return null
  }
  if (listed.isSymbolicLink() || real !== file || !listed.isFile() || !underTmp(real)) return null
  if ((listed.mode & 0o077) !== 0 || listed.size < 16 || listed.size > 4096) return null
  let parsed
  try { parsed = JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const keys = Object.keys(parsed).sort()
  if (keys.length !== 2 || keys[0] !== 'identifier' || keys[1] !== 'password') return null
  const { identifier, password } = parsed
  if (typeof identifier !== 'string' || identifier.length < 3 || identifier.length > 254 || /[\r\n\0]/.test(identifier)) return null
  if (typeof password !== 'string' || password.length < 8 || password.length > 256 || /[\r\n\0]/.test(password)) return null
  return { identifier, password }
}

function certReadable(file) {
  if (typeof file !== 'string' || !path.isAbsolute(file) || file.includes('\0') || /[\r\n]/.test(file)) return false
  const base = path.basename(file).toLowerCase()
  if (base.includes('key') || base.includes('priv') || base.endsWith('.p12') || base.endsWith('.pfx')) return false
  if (!base.endsWith('.pem') && !base.endsWith('.crt') && !base.endsWith('.cer')) return false
  let listed
  let real
  try {
    listed = fs.lstatSync(file)
    real = fs.realpathSync(file)
  } catch {
    return false
  }
  if (listed.isSymbolicLink() || !listed.isFile() || !underTmp(real)) return false
  return listed.size >= 32 && listed.size <= 65536
}

function request(base, requestPath, { method = 'GET', body = undefined, headers = {}, ca = undefined } = {}) {
  const url = new URL(base + requestPath)
  const transport = url.protocol === 'https:' ? https : http
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  const sent = {
    Accept: 'application/json',
    'User-Agent': 'mb009-learn-shelf-lease-419/1',
    ...headers,
  }
  if (payload) {
    sent['Content-Type'] = 'application/json'
    sent['Content-Length'] = String(payload.length)
  }
  return new Promise((resolve, reject) => {
    const req = transport.request({
      protocol: url.protocol,
      hostname: '127.0.0.1',
      port: url.port,
      path: `${url.pathname}${url.search}`,
      method,
      headers: sent,
      ca,
      servername: '127.0.0.1',
      rejectUnauthorized: true,
      agent: false,
    }, (response) => {
      const chunks = []
      let total = 0
      response.on('data', (chunk) => {
        total += chunk.length
        if (total > 1024 * 1024) {
          response.destroy()
          reject(new Error('response-bound'))
        } else {
          chunks.push(chunk)
        }
      })
      response.once('end', () => {
        const status = response.statusCode
        let json = null
        try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { json = null }
        resolve({ status, json })
      })
      response.once('error', reject)
    })
    req.setTimeout(12000, () => req.destroy(new Error('timeout')))
    req.once('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

function dataOf(json) {
  const data = json && json.data
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

function subjectOf(data) {
  if (!data || typeof data !== 'object') return ''
  const principal = data.principal && typeof data.principal === 'object' ? data.principal : data
  const found = principal.subject || principal.sub || principal.principalId || ''
  return typeof found === 'string' ? found : ''
}

function tokenSubject(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return ''
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (header.alg !== 'RS256' || payload.token_type !== 'access') return ''
    if (payload.iss !== 'http://127.0.0.1:18087') return ''
    const audience = Array.isArray(payload.aud) ? payload.aud : (payload.aud ? [payload.aud] : [])
    if (!audience.includes('yuxuexing-api')) return ''
    if (typeof payload.sub === 'string' && payload.sub) return payload.sub
    return typeof payload.principal_id === 'string' ? payload.principal_id : ''
  } catch {
    return ''
  }
}

function approvedPrincipal(data, subject) {
  if (!data || typeof data !== 'object') return false
  const gate = data.adultGate
  const consent = data.consentState
  const roles = Array.isArray(data.roles) ? data.roles : []
  const permissions = Array.isArray(data.permissions) ? data.permissions : []
  return data.status === 'ACTIVE'
    && data.tenantId === 'platform'
    && data.authMode === 'self-owned-jwt'
    && data.policyVersion === 'b30-rbac-v1'
    && subjectOf(data) === subject
    && roles.includes('learner')
    && permissions.includes('content.read')
    && gate && gate.status === 'PASSED' && gate.learningAccess === 'ELIGIBLE'
    && consent && consent.accepted === true && consent.learningAccess === 'ELIGIBLE'
}

function acceptable(value, min, max) {
  return typeof value === 'string' && value.length >= min && value.length <= max && !/[\u0000-\u001F\u007F\s]/.test(value)
}

function argvCarries(secret) {
  return typeof secret === 'string' && secret.length > 0 && process.argv.some((arg) => typeof arg === 'string' && arg.includes(secret))
}

async function readApprovedSubject(credential, certFile) {
  let token = ''
  try {
    const ca = fs.readFileSync(certFile)
    const logged = await request(IAM_ORIGIN, '/api/v1/auth/login', {
      method: 'POST',
      ca,
      headers: {
        Origin: PAGE_ORIGIN,
        Referer: `${PAGE_ORIGIN}/`,
        'Idempotency-Key': `mb419-login-${crypto.randomBytes(8).toString('hex')}`,
      },
      body: {
        identifier: credential.identifier,
        password: credential.password,
        device: { deviceType: 'H5', clientVersion: 'local-dev', deviceName: '语学星移动端' },
      },
    })
    const loggedData = dataOf(logged.json)
    token = logged.status === 200 && loggedData && typeof loggedData.accessToken === 'string' ? loggedData.accessToken : ''
    if (!token) return { ok: false, reason: 'login-status' }
    const principal = await request(GATEWAY_ORIGIN, '/api/v1/iam/principal/me', {
      headers: { Authorization: `Bearer ${token}`, Origin: PAGE_ORIGIN },
    })
    const data = dataOf(principal.json)
    const bodySubject = subjectOf(data)
    const bearerSubject = tokenSubject(token)
    if (principal.status !== 200 || !data) return { ok: false, reason: 'principal-unapproved' }
    if (!acceptable(bodySubject, 3, 128)) return { ok: false, reason: 'subject-missing' }
    if (!bearerSubject || bearerSubject !== bodySubject) return { ok: false, reason: 'subject-mismatch' }
    if (!approvedPrincipal(data, bodySubject)) return { ok: false, reason: 'principal-unapproved' }
    return { ok: true, subject: bodySubject }
  } catch {
    return { ok: false, reason: 'login-status' }
  } finally {
    token = ''
  }
}

async function main() {
  if (process.argv.length > 2) {
    emit({ status: 'USAGE', reason: 'argv-rejected', launched: false, h5Started: false })
    process.exitCode = 2
    return
  }
  delete process.env.LC_OWNER_ACCESS_TOKEN
  const credentialFile = process.env.MB014_CREDENTIAL_FILE
  const certFile = process.env.MB014_IAM_CERT
  if (!credentialFile || !certFile) {
    emit({ status: 'USAGE', reason: 'call-after-approved-owner', launched: false, h5Started: false })
    return
  }
  const credential = readCredential(credentialFile)
  if (!credential) {
    emit({ status: 'FAILED', reason: 'credential-file', launched: false, h5Started: false })
    process.exitCode = 1
    return
  }
  if (!certReadable(certFile)) {
    credential.identifier = ''
    credential.password = ''
    emit({ status: 'FAILED', reason: 'iam-cert', launched: false, h5Started: false })
    process.exitCode = 1
    return
  }
  let subject = ''
  let session = null
  let h5Started = false
  try {
    const approved = await readApprovedSubject(credential, certFile)
    if (!approved.ok) {
      emit({ status: 'FAILED', reason: safeReason(approved.reason, 'subject-missing'), launched: false, h5Started: false })
      process.exitCode = 1
      return
    }
    subject = approved.subject
    session = await openPinnedNonceStatic({ artifactRoot: B139_H5_ROOT, expectedIndexSha: B139_INDEX_SHA })
    if (!session || session.ok !== true || !acceptable(session.marker, 64, 64)) {
      emit({
        status: 'FAILED',
        reason: safeReason(session && session.reason, 'static-listen-failed'),
        launched: false,
        h5Started: false,
      })
      process.exitCode = 1
      return
    }
    h5Started = true
    if (argvCarries(credential.identifier) || argvCarries(credential.password) || argvCarries(subject) || argvCarries(session.marker)) {
      emit({ status: 'FAILED', reason: 'argv-secret', launched: false, h5Started: true })
      process.exitCode = 1
      return
    }
    const receipt = await observeShelfEmpty({
      ownedLease: true,
      caPem: certFile,
      staticNonce: session.marker,
      approved: {
        identifier: credential.identifier,
        password: credential.password,
        subject,
      },
    })
    const observed = receipt
      && receipt.status === 'OBSERVED'
      && receipt.reason === 'empty'
      && receipt.shelfEmptyReady === true
      && receipt.observed === true
      && receipt.placementRequired === true
    if (observed) {
      emit({
        status: 'OBSERVED',
        reason: 'empty',
        launched: true,
        h5Started: true,
        shelfEmptyReady: true,
        observed: true,
        outcome: 'empty',
      })
      return
    }
    emit({
      status: receipt && receipt.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED',
      reason: safeReason(receipt && receipt.reason, 'shelf-not-empty'),
      launched: receipt ? receipt.launched === true : false,
      h5Started: true,
      shelfEmptyReady: false,
      observed: false,
      outcome: safeReason(receipt && receipt.outcome, 'shelf-not-empty'),
    })
    process.exitCode = 1
  } catch {
    emit({ status: 'FAILED', reason: 'observer-failed', launched: h5Started, h5Started })
    process.exitCode = 1
  } finally {
    credential.identifier = ''
    credential.password = ''
    subject = ''
    if (session && typeof session.close === 'function') await session.close().catch(() => {})
    session = null
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
  main().catch(() => {
    emit({ status: 'FAILED', reason: 'observer-failed', launched: false, h5Started: false })
    process.exitCode = 1
  })
}
