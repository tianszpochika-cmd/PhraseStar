/**
 * G404 H5 tail. Opens the G388 pinned nonce listener, calls observeWorldDefault,
 * then closes the listener. Importing this file does not listen. Direct node
 * without stdin prints USAGE and returns.
 */
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openPinnedNonceStatic, B139_H5_ROOT, B139_INDEX_SHA, STATIC_QA_HEADER } from '/tmp/grok-mobile-learn-shelf-derived-current-h5-lease-388/pinned-static-nonce.mjs'
import { observeWorldDefault, runObserverChecks } from '/tmp/grok-mobile-resume-world-404/world-default-observer.mjs'

const JOB = '/tmp/grok-mobile-resume-world-404'
const USAGE = {
  status: 'USAGE',
  launched: false,
  observed: false,
  worldEmptyReady: false,
  reason: 'stdin-owned-lease',
  nonceHeader: STATIC_QA_HEADER,
  indexSha: B139_INDEX_SHA,
}

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = []
    let total = 0
    process.stdin.on('data', (chunk) => {
      total += chunk.length
      if (total > 64 * 1024) {
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
      try {
        resolve(JSON.parse(text))
      } catch {
        reject(new Error('stdin-json'))
      }
    })
    process.stdin.on('error', () => reject(new Error('stdin')))
  })
}

function publicFailure(reason) {
  return {
    job: 'MB018-H5-DEFAULT-404',
    status: 'BLOCKED',
    reason,
    observed: false,
    worldEmptyReady: false,
    launched: false,
    h5Started: false,
    nonceClosed: true,
    passwordOmitted: true,
    subjectOmitted: true,
    identifierOmitted: true,
    nonceValueOmitted: true,
  }
}

async function runTail(input) {
  if (!input || input.ownedLease !== true) return publicFailure('lease')
  const prepared = runObserverChecks()
  if (prepared.ok !== true || prepared.status !== 'OBSERVER_PREPARED') {
    return publicFailure(prepared.reason || 'observer-check')
  }
  const session = await openPinnedNonceStatic({
    artifactRoot: B139_H5_ROOT,
    expectedIndexSha: B139_INDEX_SHA,
  })
  if (!session || session.ok !== true || typeof session.marker !== 'string') {
    return publicFailure((session && session.reason) || 'static-listen-failed')
  }
  let receipt
  try {
    receipt = await observeWorldDefault({
      ownedLease: true,
      profile: 'local-real',
      seeded: false,
      caPem: input.caPem,
      staticNonce: session.marker,
      approved: input.approved,
    })
  } finally {
    await session.close()
    session.marker = ''
  }
  if (!receipt || typeof receipt !== 'object') return publicFailure('observer')
  return {
    ...receipt,
    h5Started: receipt.h5Started === true,
    nonceClosed: true,
    nonceHeader: STATIC_QA_HEADER,
    g388: '/tmp/grok-mobile-learn-shelf-derived-current-h5-lease-388/pinned-static-nonce.mjs',
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
      if (receipt.status !== 'OBSERVED') process.exitCode = 2
    }).catch((error) => {
      process.stdout.write(`${JSON.stringify(publicFailure(error && error.message ? error.message : 'tail'))}\n`)
      process.exitCode = 1
    })
  }
}
