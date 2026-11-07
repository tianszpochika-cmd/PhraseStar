/**
 * Pinned static nonce listener derived from G265 openOwnedNonceStatic.
 * G388 helper copied into G433. Serves one H5 tree on 127.0.0.1:18183.
 * The only accepted index digest is the literal B139 pin. The request
 * header is x-mb004-static-qa. This module does not launch a browser,
 * does not fulfill a response, and does not write a receipt. Importing
 * it does not listen. A direct run prints a usage line and returns.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const B139_H5_ROOT = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const B139_INDEX_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_INDEX_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const PAGE_ORIGIN = 'http://127.0.0.1:18183'
const STATIC_BIND = '127.0.0.1'
const STATIC_PORT = 18183
const STATIC_HOST = '127.0.0.1:18183'
const STATIC_QA_HEADER = 'x-mb004-static-qa'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
}

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function sameMarker(presented, marker) {
  if (typeof presented !== 'string' || typeof marker !== 'string' || marker.length === 0) return false
  const given = Buffer.from(presented)
  const expected = Buffer.from(marker)
  if (given.length !== expected.length) return false
  return crypto.timingSafeEqual(given, expected)
}

function frozenAsset(pathname, artifactRoot) {
  let decoded = '/'
  try { decoded = decodeURIComponent(pathname) } catch { return null }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '')
  if (!relative || relative.includes('\0') || path.isAbsolute(relative)) return null
  const root = path.resolve(artifactRoot)
  const file = path.resolve(root, relative)
  if (!(file === path.join(root, 'index.html') || file.startsWith(`${root}${path.sep}`))) return null
  let canonicalRoot
  let canonicalFile
  try {
    canonicalRoot = fs.realpathSync(root)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return null
    canonicalFile = fs.realpathSync(file)
  } catch {
    return null
  }
  if (!(canonicalFile === path.join(canonicalRoot, 'index.html') || canonicalFile.startsWith(`${canonicalRoot}${path.sep}`))) return null
  try {
    if (!fs.statSync(canonicalFile).isFile()) return null
  } catch {
    return null
  }
  return canonicalFile
}

function sendEmpty(res, status) {
  if (!res || res.headersSent || res.writableEnded) return
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': '0',
    'x-content-type-options': 'nosniff',
  })
  res.end()
}

function serveFrozen(req, res, marker, artifactRoot) {
  if (!req || (req.method !== 'GET' && req.method !== 'HEAD')) return sendEmpty(res, 404)
  const host = req.headers && req.headers.host
  if (host !== STATIC_HOST) return sendEmpty(res, 404)
  const presented = req.headers && req.headers[STATIC_QA_HEADER]
  if (typeof presented !== 'string' || !sameMarker(presented, marker)) return sendEmpty(res, 404)
  if (typeof req.url !== 'string' || req.url.length === 0 || req.url.length > 2048 || req.url.includes('://') || req.url.startsWith('//')) {
    return sendEmpty(res, 404)
  }
  let pathname
  try { pathname = new URL(req.url, PAGE_ORIGIN).pathname } catch { return sendEmpty(res, 404) }
  const file = frozenAsset(pathname, artifactRoot)
  if (!file) return sendEmpty(res, 404)
  let body
  try { body = fs.readFileSync(file) } catch { return sendEmpty(res, 404) }
  res.writeHead(200, {
    'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'content-length': String(body.length),
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  if (req.method === 'HEAD') res.end()
  else res.end(body)
}

function listenFrozenStatic(marker, artifactRoot) {
  const server = http.createServer((req, res) => {
    req.on('error', () => {})
    res.on('error', () => {})
    try { serveFrozen(req, res, marker, artifactRoot) } catch { sendEmpty(res, 404) }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 5_000
  server.keepAliveTimeout = 1_000
  server.maxHeadersCount = 40
  server.on('connect', (_request, socket) => { socket.destroy() })
  server.on('upgrade', (_request, socket) => { socket.destroy() })
  server.on('clientError', (_error, socket) => {
    if (!socket || socket.destroyed) return
    try {
      socket.end('HTTP/1.1 400\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    } catch {
      try { socket.destroy() } catch { /* already closed */ }
    }
  })
  return new Promise((resolve, reject) => {
    let settled = false
    let closing = false
    let giveUp
    const rejectOnce = (error) => {
      if (settled) return
      settled = true
      clearTimeout(giveUp)
      reject(error)
    }
    const onError = (error) => {
      if (settled || closing) return
      closing = true
      clearTimeout(giveUp)
      server.removeListener('error', onError)
      server.on('error', () => {})
      const timer = setTimeout(() => rejectOnce(error), 800)
      try {
        server.close(() => {
          clearTimeout(timer)
          rejectOnce(error)
        })
      } catch {
        clearTimeout(timer)
        rejectOnce(error)
      }
    }
    server.once('error', onError)
    giveUp = setTimeout(() => {
      const error = new Error('static-listen-timeout')
      error.code = 'ETIMEDOUT'
      onError(error)
    }, 5_000)
    server.listen({ host: STATIC_BIND, port: STATIC_PORT, exclusive: true }, () => {
      clearTimeout(giveUp)
      if (settled || closing) return
      server.removeListener('error', onError)
      server.on('error', () => {})
      const address = server.address()
      if (!address || typeof address === 'string' || address.address !== STATIC_BIND || address.port !== STATIC_PORT) {
        const error = new Error('static-port-mismatch')
        error.code = 'EPORT'
        onError(error)
        return
      }
      settled = true
      resolve(server)
    })
  })
}

function closeOwnedServer(server) {
  return new Promise((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      resolve()
    }
    const force = setTimeout(() => {
      try {
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections()
      } catch { /* already closing */ }
      setTimeout(finish, 250)
    }, 800)
    try {
      server.close(() => {
        clearTimeout(force)
        finish()
      })
    } catch {
      clearTimeout(force)
      finish()
    }
  })
}

function provePinnedB139Root(artifactRoot, expectedIndexSha) {
  if (typeof artifactRoot !== 'string' || artifactRoot.length === 0 || artifactRoot.length > 512) return { ok: false, reason: 'frozen-root-required' }
  if (!path.isAbsolute(artifactRoot) || artifactRoot.includes('\0') || /[\r\n]/.test(artifactRoot)) return { ok: false, reason: 'frozen-root-required' }
  if (typeof expectedIndexSha !== 'string' || !/^[0-9a-f]{64}$/.test(expectedIndexSha)) return { ok: false, reason: 'frozen-sha-required' }
  if (expectedIndexSha === B116_INDEX_SHA || expectedIndexSha !== B139_INDEX_SHA) return { ok: false, reason: 'frozen-sha-not-canonical' }
  let supplied = null
  let canonical = null
  try {
    supplied = fs.realpathSync(artifactRoot)
    canonical = fs.realpathSync(B139_H5_ROOT)
  } catch {
    return { ok: false, reason: 'frozen-root-unavailable' }
  }
  if (supplied !== canonical) return { ok: false, reason: 'frozen-root-not-canonical' }
  const indexFile = path.join(supplied, 'index.html')
  let indexSha256 = null
  try { indexSha256 = shaFile(indexFile) } catch { return { ok: false, reason: 'frozen-index-unreadable' } }
  if (indexSha256 !== B139_INDEX_SHA) return { ok: false, reason: 'index-sha-mismatch', indexSha256, expectedIndexSha256: B139_INDEX_SHA }
  return { ok: true, root: supplied, indexSha256, expectedIndexSha256: B139_INDEX_SHA }
}

async function openPinnedNonceStatic({ artifactRoot, expectedIndexSha } = {}) {
  const proven = provePinnedB139Root(artifactRoot, expectedIndexSha)
  const base = {
    ok: false,
    reason: proven.reason || 'frozen-root-required',
    marker: '',
    indexSha256: proven.indexSha256 || null,
    expectedIndexSha256: B139_INDEX_SHA,
    indexMatch: proven.ok === true,
    header: STATIC_QA_HEADER,
    async close() {},
  }
  if (!proven.ok) return base
  let server = null
  let marker = ''
  try {
    marker = crypto.randomBytes(32).toString('hex')
    server = await listenFrozenStatic(marker, proven.root)
    let closed = false
    const session = {
      ok: true,
      reason: null,
      marker,
      indexSha256: proven.indexSha256,
      expectedIndexSha256: B139_INDEX_SHA,
      indexMatch: true,
      header: STATIC_QA_HEADER,
      async close() {
        if (closed) return
        closed = true
        session.marker = ''
        marker = ''
        const owned = server
        server = null
        if (owned) await closeOwnedServer(owned)
      },
    }
    return session
  } catch (error) {
    if (server) await closeOwnedServer(server).catch(() => {})
    server = null
    marker = ''
    return {
      ...base,
      reason: error && error.code === 'EADDRINUSE' ? 'static-port-busy' : 'static-listen-failed',
      indexSha256: proven.indexSha256,
      indexMatch: true,
    }
  }
}

export {
  openPinnedNonceStatic,
  B139_H5_ROOT,
  B139_INDEX_SHA,
  STATIC_QA_HEADER,
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
  process.stdout.write(`${JSON.stringify({
    status: 'USAGE',
    launched: false,
    reason: 'call-openPinnedNonceStatic',
    indexSha: B139_INDEX_SHA,
    header: STATIC_QA_HEADER,
  })}\n`)
}
