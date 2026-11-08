/**
 * MB455_READING_LIVE_HOOK.
 * One fresh synthetic adult: IAM register and login, Gateway adult gate and
 * three consent grants, then the one learner target the practice returnTo
 * gate needs. Password is read from the 0600 credential file and posted only
 * to IAM TLS. No argv, no reading call, no assessment call, no learning
 * progress call, and no browser route response substitution.
 */
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'

const IAM = 'https://127.0.0.1:18087'
const GATEWAY = 'http://127.0.0.1:18070'
const ORIGIN = 'http://127.0.0.1:18183'
const DOCUMENTS = Object.freeze([
  { type: 'TERMS', documentVersion: 'mock-mb004-terms-v1', documentDigest: 'd89f227f3d2a43a165b2a6899110fc608b2bc5b7bc0e5ce2a604de32f9802411' },
  { type: 'PRIVACY', documentVersion: 'mock-mb004-privacy-v1', documentDigest: '1b4baa000763f9f5021e311387b924442730bbb479961f644a1aa7f79ddff451' },
  { type: 'ADULT_LEARNING', documentVersion: 'mock-mb004-adult-v1', documentDigest: 'e5e814e6dbc377d1f2ccc6a423c4eff7dcf684df462594da7b5ae438419a7c15' },
])

function fail(reason, extra = {}) {
  process.stdout.write(`${JSON.stringify({ ok: false, reason, ...extra })}\n`)
  process.exitCode = 1
}

function absoluteRegular(raw) {
  if (typeof raw !== 'string' || !raw.startsWith('/') || raw.includes('\0')) return null
  let listed
  let real
  try {
    listed = fs.lstatSync(raw)
    real = fs.realpathSync(raw)
  } catch {
    return null
  }
  if (listed.isSymbolicLink() || real !== raw || !listed.isFile()) return null
  return listed
}

function readCredential(file) {
  const listed = absoluteRegular(file)
  if (!listed) return null
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

function request(base, requestPath, { method = 'GET', body = undefined, headers = {}, ca = undefined, timeoutMs = 12000 } = {}) {
  const url = new URL(base + requestPath)
  const transport = url.protocol === 'https:' ? https : http
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body))
  const idempotent = requestPath === '/api/v1/auth/register' || requestPath === '/api/v1/auth/login'
  if (idempotent) {
    const idempotency = headers['Idempotency-Key']
    if (typeof idempotency !== 'string' || idempotency.length < 8 || idempotency.length > 128 || /[\r\n\0]/.test(idempotency)) {
      return Promise.reject(new Error('idempotency-key-missing'))
    }
  }
  const sent = {
    Accept: 'application/json',
    'User-Agent': 'mb455-reading-live-hook/1',
    ...headers,
  }
  if (payload) {
    sent['Content-Type'] = 'application/json'
    sent['Content-Length'] = String(payload.length)
  } else if (method !== 'GET') {
    sent['Content-Length'] = '0'
  }
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn) => {
      if (settled) return
      settled = true
      fn()
    }
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
      let ended = false
      response.on('data', (chunk) => {
        total += chunk.length
        if (total > 1024 * 1024) {
          response.destroy()
          finish(() => reject(new Error('response-bound')))
          return
        }
        chunks.push(chunk)
      })
      response.once('end', () => {
        ended = true
        const status = response.statusCode
        if (!Number.isInteger(status) || status < 100) {
          finish(() => reject(new Error('status-before-response')))
          return
        }
        const raw = Buffer.concat(chunks).toString('utf8')
        let json = null
        try { json = raw ? JSON.parse(raw) : null } catch { json = null }
        const setCookie = response.headers['set-cookie']
        finish(() => resolve({
          complete: ended,
          status,
          json,
          setCookies: Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [],
        }))
      })
      response.once('error', (error) => finish(() => reject(error)))
    })
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')))
    req.once('error', (error) => finish(() => reject(error)))
    if (payload) req.write(payload)
    req.end()
  })
}

function statusOf(response) {
  if (!response || response.complete !== true || !Number.isInteger(response.status) || response.status < 100) {
    throw new Error('status-before-response')
  }
  return response.status
}

function dataOf(response) {
  const data = response.json && response.json.data
  return data && typeof data === 'object' && !Array.isArray(data) ? data : null
}

function claims(token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return null
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    const roles = Array.isArray(payload.roles) ? payload.roles : []
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : []
    const audience = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : []
    return { header, payload, roles, permissions, audience }
  } catch {
    return null
  }
}

function eligible(token) {
  const decoded = claims(token)
  if (!decoded || decoded.header.alg !== 'RS256') return false
  const payload = decoded.payload
  return Boolean(payload.sub || payload.principal_id)
    && payload.iss === 'http://127.0.0.1:18087'
    && decoded.audience.includes('yuxuexing-api')
    && payload.token_type === 'access'
    && decoded.roles.includes('learner')
    && decoded.permissions.includes('learner.target.write')
    && decoded.permissions.includes('learner.profile.read')
    && decoded.permissions.includes('content.read')
    && decoded.permissions.includes('assessment.session.read')
    && decoded.permissions.includes('assessment.session.write')
    && Boolean(payload.scope)
    && payload.adult_gate === 'PASSED'
    && payload.consent_state === 'GRANTED'
    && payload.phase === 'phase-1'
    && payload.account_status === 'ACTIVE'
    && payload.tenant_id === 'platform'
}

function refreshCookie(setCookies) {
  const line = setCookies.find((cookie) => cookie.startsWith('yuxuexing_refresh='))
  if (!line) return null
  const pair = line.split(';', 1)[0]
  const value = pair.slice('yuxuexing_refresh='.length)
  if (!value) return null
  return `yuxuexing_refresh=${value}`
}

async function main() {
  if (process.argv.length > 2) return fail('argv-rejected')
  const credentialFile = process.env.MB014_CREDENTIAL_FILE
  const certFile = process.env.MB014_IAM_CERT
  const runId = process.env.MB455_RUN_ID
  if (!credentialFile || !certFile || !/^[0-9a-f]{12}$/.test(runId || '')) return fail('env-missing')
  const credential = readCredential(credentialFile)
  if (!credential) return fail('credential-file')
  let token = ''
  try {
    const certListed = absoluteRegular(certFile)
    if (!certListed || certListed.size < 32 || certListed.size > 65536) return fail('iam-cert')
    const ca = fs.readFileSync(certFile)
    const key = (suffix) => `mb455-${suffix}-${runId}-1`.slice(0, 128)
    const authBody = () => ({
      identifier: credential.identifier,
      password: credential.password,
      device: { deviceType: 'H5', clientVersion: 'local-dev', deviceName: '语学星移动端' },
    })
    const iamHeaders = { Origin: ORIGIN, Referer: `${ORIGIN}/` }
    const registered = await request(IAM, '/api/v1/auth/register', {
      method: 'POST', ca, body: authBody(),
      headers: { ...iamHeaders, 'Idempotency-Key': key('register') },
    })
    const registeredData = dataOf(registered)
    if (statusOf(registered) !== 201 || !registeredData || typeof registeredData.accessToken !== 'string') {
      return fail('register-status', { status: statusOf(registered) })
    }
    token = registeredData.accessToken
    const bearer = { Authorization: `Bearer ${token}`, Origin: ORIGIN }
    const adult = await request(GATEWAY, '/api/v1/iam/adult-gate', {
      method: 'POST',
      headers: { ...bearer, 'Idempotency-Key': key('adult-gate') },
      body: { confirmed: true, birthYear: 1995, policyVersion: 'b30-adult-v1' },
    })
    const adultData = dataOf(adult)
    if (statusOf(adult) !== 200 || !adultData || adultData.status !== 'PASSED' || adultData.learningAccess !== 'ELIGIBLE') {
      return fail('adult-gate', { status: statusOf(adult) })
    }
    for (const document of DOCUMENTS) {
      const consent = await request(GATEWAY, '/api/v1/iam/consents', {
        method: 'PUT',
        headers: { ...bearer, 'Idempotency-Key': key(`consent-${document.type.toLowerCase()}`) },
        body: {
          type: document.type,
          version: document.documentVersion,
          decision: 'ACCEPTED',
          expectedDocumentDigest: document.documentDigest,
        },
      })
      const consentData = dataOf(consent)
      if (statusOf(consent) !== 200 || !consentData || consentData.decision !== 'ACCEPTED' || consentData.state !== 'GRANTED') {
        return fail('consent-status', { status: statusOf(consent), type: document.type })
      }
    }
    const principal = await request(GATEWAY, '/api/v1/iam/principal/me', { headers: bearer })
    const principalData = dataOf(principal)
    if (statusOf(principal) !== 200 || !principalData || principalData.status !== 'ACTIVE'
      || principalData.consentState?.accepted !== true
      || principalData.adultGate?.learningAccess !== 'ELIGIBLE') {
      return fail('principal-inactive', { status: statusOf(principal) })
    }
    const login = await request(IAM, '/api/v1/auth/login', {
      method: 'POST', ca, body: authBody(),
      headers: { ...iamHeaders, 'Idempotency-Key': key('login') },
    })
    const loginData = dataOf(login)
    if (statusOf(login) !== 200 || !loginData || typeof loginData.accessToken !== 'string') {
      return fail('login-status', { status: statusOf(login) })
    }
    token = loginData.accessToken
    if (!eligible(token)) {
      const cookie = refreshCookie(login.setCookies)
      if (!cookie) return fail('token-claims')
      const refreshed = await request(IAM, '/api/v1/auth/token/refresh', {
        method: 'POST', ca,
        headers: { ...iamHeaders, Cookie: cookie, 'Idempotency-Key': key('refresh') },
      })
      const refreshedData = dataOf(refreshed)
      if (statusOf(refreshed) !== 200 || !refreshedData || typeof refreshedData.accessToken !== 'string' || !eligible(refreshedData.accessToken)) {
        return fail('token-claims', { status: statusOf(refreshed) })
      }
      token = refreshedData.accessToken
    }
    const auth = { Authorization: `Bearer ${token}`, Origin: ORIGIN }
    const profile = await request(GATEWAY, '/api/v1/learner/profile', { headers: auth })
    const profileData = dataOf(profile)
    if (statusOf(profile) !== 200 || !profileData || !Number.isSafeInteger(profileData.stateVersion)) {
      return fail('profile-shape', { status: statusOf(profile) })
    }
    if (profileData.stateVersion !== 0 || (profileData.targetGoal ?? null) !== null) {
      return fail('profile-not-fresh', { status: statusOf(profile), stateVersion: profileData.stateVersion })
    }
    const before = await request(GATEWAY, '/api/v1/learner/targets', { headers: auth })
    if (statusOf(before) !== 404) return fail('target-not-absent', { status: statusOf(before) })
    const written = await request(GATEWAY, '/api/v1/learner/targets', {
      method: 'PUT',
      headers: { ...auth, 'Idempotency-Key': key('target') },
      body: {
        expectedStateVersion: 0,
        goalCode: 'CET_4_6',
        targetLevel: 'B1',
        dailyQuotaMinutes: 30,
        status: 'ACTIVE',
      },
    })
    const writtenData = dataOf(written)
    if (statusOf(written) !== 200 || !writtenData || writtenData.status !== 'ACTIVE'
      || writtenData.goalCode !== 'COLLEGE_CET' || writtenData.targetLevel !== 'B1'
      || writtenData.dailyQuotaMinutes !== 30 || writtenData.stateVersion !== 1) {
      return fail('target-write', { status: statusOf(written) })
    }
    const after = await request(GATEWAY, '/api/v1/learner/targets', { headers: auth })
    const afterData = dataOf(after)
    if (statusOf(after) !== 200 || !afterData || afterData.status !== 'ACTIVE'
      || afterData.goalCode !== 'COLLEGE_CET' || afterData.targetLevel !== 'B1'
      || afterData.stateVersion !== 1) {
      return fail('target-readback', { status: statusOf(after) })
    }
    process.stdout.write(`${JSON.stringify({
      ok: true,
      register: 201,
      login: 200,
      consents: DOCUMENTS.length,
      principal: 'ACTIVE',
      contentRead: true,
      profileWrite: false,
      profileVersion: 0,
      targetWrite: true,
      targetVersion: 1,
      assessmentWrites: 0,
      learningProgressWrites: 0,
    })}\n`)
  } catch {
    fail('hook-failed')
  } finally {
    credential.identifier = ''
    credential.password = ''
    token = ''
  }
}

main()
