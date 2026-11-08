'use strict'

/**
 * Wrapper gate for a future Root run. Reads one receipt path. Does not
 * launch a browser or bind a port. Prints a reason token only.
 */

const fs = require('node:fs')
const { decideHomeReturn, ENTRY_PATH, HOME_ALIAS } = require('./oracle.cjs')

const file = process.argv[2]
if (typeof file !== 'string' || !file.startsWith('/') || !file.endsWith('home-return-receipt.json')) {
  process.stderr.write('G454_GATE_FAIL receipt-path\n')
  process.exit(2)
}

let receipt
try {
  receipt = JSON.parse(fs.readFileSync(file, 'utf8'))
} catch {
  process.stderr.write('G454_GATE_FAIL receipt-unreadable\n')
  process.exit(2)
}

const decision = decideHomeReturn(receipt)
const aliasAccepted = receipt && receipt.finalHash === HOME_ALIAS
const ok = receipt
  && receipt.job === 'MB454_FRESH_ACTOR_HOME_RETURN'
  && receipt.status === 'OBSERVED'
  && receipt.reason == null
  && decision.status === 'OBSERVED'
  && decision.reason == null
  && receipt.finalHash === ENTRY_PATH
  && receipt.entryPath === ENTRY_PATH
  && receipt.entry
  && receipt.entry.alias === HOME_ALIAS
  && aliasAccepted === false

if (!ok) {
  const reason = decision.reason || receipt?.reason || 'gate'
  process.stderr.write(`G454_GATE_FAIL ${String(reason).slice(0, 80)}\n`)
  process.exit(2)
}

process.stdout.write('G454_GATE_OBSERVED\n')
