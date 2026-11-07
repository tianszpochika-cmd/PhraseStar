/**
 * Opens the frozen G388 nonce listener, runs one forbidden-page observation,
 * then closes the listener. Importing this file does not listen. A TTY run
 * prints usage and does not bind 18183.
 */
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openPinnedNonceStatic, B139_H5_ROOT, B139_INDEX_SHA, STATIC_QA_HEADER } from '/tmp/grok-mobile-learn-shelf-derived-current-h5-lease-388/pinned-static-nonce.mjs'
import { observeForbiddenH5, runObserverChecks } from '/tmp/grok-mobile-resume-forbidden-h5-413/forbidden-h5-observer.mjs'

const USAGE = {
  status: 'USAGE',
  launched: false,
  observed: false,
  reason: 'stdin-owned-lease',
  nonceHeader: STATIC_QA_HEADER,
  indexSha256: B139_INDEX_SHA,
  h5Root: B139_H5_ROOT,
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    process.stdin.on('data', (chunk) => {
      total += chunk.length
      if (total > 8192) {
        reject(new Error('stdin-too-large'))
        return
      }
      chunks.push(chunk)
    })
    process.stdin.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8').trim()
      if (!text) {
        resolve(null)
        return
      }
      try { resolve(JSON.parse(text)) } catch { reject(new Error('stdin-json')) }
    })
    process.stdin.on('error', () => reject(new Error('stdin')))
  })
}

function blocked(reason) {
  return {
    job: 'MB005-H5-FORBIDDEN-413',
    status: 'BLOCKED',
    reason,
    observed: false,
    launched: false,
    h5Started: false,
    nonceClosed: true,
    fakedResponse: false,
    injectedAuthState: false,
    passwordOmitted: true,
    identifierOmitted: true,
    nonceOmitted: true,
  }
}

async function runTail(input) {
  if (!input || input.ownedLease !== true || typeof input.caPem !== 'string') return blocked('lease')
  const prepared = runObserverChecks()
  if (prepared.ok !== true) return blocked(prepared.reason || 'observer-check')
  const session = await openPinnedNonceStatic({
    artifactRoot: B139_H5_ROOT,
    expectedIndexSha: B139_INDEX_SHA,
  })
  if (!session || session.ok !== true || !/^[0-9a-f]{64}$/.test(session.marker || '')) {
    return blocked((session && session.reason) || 'static-listen-failed')
  }
  let receipt
  try {
    receipt = await observeForbiddenH5({
      ownedLease: true,
      caPem: input.caPem,
      staticNonce: session.marker,
    })
  } finally {
    await session.close()
    session.marker = ''
  }
  if (!receipt || typeof receipt !== 'object') return blocked('observer')
  return { ...receipt, nonceClosed: true, nonceHeader: STATIC_QA_HEADER }
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
  if (process.stdin.isTTY) {
    process.stdout.write(`${JSON.stringify(USAGE)}\n`)
  } else {
    readStdin().then(async (input) => {
      if (!input) {
        process.stdout.write(`${JSON.stringify(USAGE)}\n`)
        return
      }
      const receipt = await runTail(input)
      process.stdout.write(`${JSON.stringify(receipt)}\n`)
      process.exit(receipt.status === 'OBSERVED' ? 0 : 1)
    }).catch(() => {
      process.stdout.write(`${JSON.stringify(blocked('stdin'))}\n`)
      process.exit(1)
    })
  }
}
