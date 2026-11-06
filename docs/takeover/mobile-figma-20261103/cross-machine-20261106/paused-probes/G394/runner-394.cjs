'use strict'

/**
 * Offline deriver for the 394 uni-button CTA oracle.
 *
 * Running this file hashes the preseeded G331 observer in this directory,
 * requires the reviewed pin, applies the surgical locator patch, and writes
 * device-others-owner-394.cjs plus derived-pin.json. It does not open a
 * socket, start Chrome, MySQL, IAM, Gateway, or the H5 listener, and it does
 * not write the preseeded observer, the preseeded wrapper, REPORT.md,
 * pin.json, output.json, or any path outside this prefix.
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const PREFIX = '/tmp/grok-mobile-device-bulk-unibutton-oracle-394'
const PRIVATE_PREFIX = '/private/tmp/grok-mobile-device-bulk-unibutton-oracle-394'
const OBSERVER_NAME = 'device-others-owner.cjs'
const WRAPPER_NAME = 'device-others-runtime.sh'
const DERIVED_NAME = 'device-others-owner-394.cjs'
const DERIVED_PIN_NAME = 'derived-pin.json'
const OBSERVER = path.join(PREFIX, OBSERVER_NAME)
const WRAPPER = path.join(PREFIX, WRAPPER_NAME)
const DERIVED = path.join(PREFIX, DERIVED_NAME)
const DERIVED_PIN = path.join(PREFIX, DERIVED_PIN_NAME)

const REVIEWED = Object.freeze({
  g331ObserverBytes: 43416,
  g331ObserverSha256: '704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af',
  g331ReportSha256: '527843fef5fa89868d1ac4e8d99f7c4a9f77e1654dfa0aa3a214eb389186d795',
  b116IndexSha256: '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520',
})

const FROZEN = new Set([
  OBSERVER_NAME,
  WRAPPER_NAME,
  'REPORT.md',
  'pin.json',
  'output.json',
  'runner-394.cjs',
])

const PATCHES = [
  [
    "const OUT_DIR = '/tmp/grok-mobile-device-others-revoke-h5-probe-331'",
    "const OUT_DIR = '/tmp/grok-mobile-device-bulk-unibutton-oracle-394'",
  ],
  [
    'async function readUi(page) {',
    `async function genuineDisabled(locator) {
  const value = await locator.evaluate((element) => {
    const propertyDisabled = element.disabled === true
    const attribute = element.getAttribute('disabled')
    const attributeDisabled = attribute !== null && attribute !== 'false'
    return propertyDisabled || attributeDisabled
  }).catch(() => null)
  return value === true
}

async function readUi(page) {`,
  ],
  [
    `  const cta = page.locator('button.dev-cta').first()
  const ctaCount = await page.locator('button.dev-cta').count()
  return {
    safety,
    rowCount,
    currentRows,
    currentExit,
    otherExit,
    currentTitleOk,
    otherTitleOk,
    ctaCount,
    ctaText: ctaCount === 1 ? await textOf(cta) : '',
    ctaDisabled: ctaCount === 1 ? await cta.isDisabled().catch(() => true) : true,
  }
}`,
    `  const cta = page.locator('.dev-cta[role="button"]')
  const ctaCount = await cta.count()
  const one = ctaCount === 1
  const ctaText = one ? await textOf(cta) : ''
  const ctaDisabled = one ? await genuineDisabled(cta) : false
  return {
    safety,
    rowCount,
    currentRows,
    currentExit,
    otherExit,
    currentTitleOk,
    otherTitleOk,
    cta,
    ctaCount,
    ctaText,
    ctaDisabled,
    ctaEnabledExact: one && ctaDisabled === false && ctaText === COPY.cta,
    ctaDisabledExact: one && ctaDisabled === true && ctaText === COPY.ctaDisabled,
  }
}`,
  ],
  [
    `    if (!surface.ctaDisabled && surface.ctaText === COPY.cta) {
      ui.mode = 'bulk'
      await page.locator('button.dev-cta').click()
      ui.bulkClicks += 1`,
    `    if (surface.ctaEnabledExact === true) {
      ui.mode = 'bulk'
      await surface.cta.click()
      ui.bulkClicks += 1`,
  ],
  [
    `    } else if (surface.ctaDisabled && surface.otherExit === 2) {
      ui.mode = 'sequential'`,
    `    } else if (surface.ctaCount === 1 && surface.ctaDisabled === true && surface.otherExit === 2) {
      ui.mode = 'sequential'`,
  ],
  [
    '    ui.ctaDisabledAfter = afterUi.ctaDisabled === true && afterUi.ctaText === COPY.ctaDisabled',
    '    ui.ctaDisabledAfter = afterUi.ctaDisabledExact === true',
  ],
  [
    `    if (!ui.successAfterReadback || !ui.currentTaggedAfter || ui.revokedTagsAfter !== 2 || !ui.ctaDisabledAfter || !readbackOk || !pathsExact || ui.rowExitClicks !== (ui.mode === 'sequential' ? 2 : 0) || ui.bulkClicks !== (ui.mode === 'bulk' ? 1 : 0)) {
      return finishBrowser(ui, traffic, staticFulfills, 'readback-mismatch')
    }`,
    `    const bulkExact = ui.mode === 'bulk' && ui.bulkClicks === 1 && ui.confirmClicks === 1 && ui.rowExitClicks === 0 && ui.cancelClicks === 0
    const sequentialExact = ui.mode === 'sequential' && ui.bulkClicks === 0 && ui.confirmClicks === 2 && ui.rowExitClicks === 2 && ui.cancelClicks === 0
    if (!ui.successAfterReadback || !ui.currentTaggedAfter || ui.revokedTagsAfter !== 2 || !ui.ctaDisabledAfter || !readbackOk || !pathsExact || !(bulkExact || sequentialExact)) {
      return finishBrowser(ui, traffic, staticFulfills, 'readback-mismatch')
    }`,
  ],
  [
    `function writeResult(result) {
  if (path.resolve(OUT_DIR) !== OUT_DIR) throw new Error('output-dir')
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 })
  const file = path.join(OUT_DIR, 'result.json')
  if (!file.startsWith(\`\${OUT_DIR}/\`)) throw new Error('output-file')
  fs.writeFileSync(file, \`\${JSON.stringify(publicResult(result), null, 2)}\\n\`, { mode: 0o600 })
}`,
    `function writeResult(result) {
  if (OUT_DIR !== '/tmp/grok-mobile-device-bulk-unibutton-oracle-394') throw new Error('output-dir')
  if (path.resolve(OUT_DIR) !== OUT_DIR) throw new Error('output-dir')
  const file = path.join(OUT_DIR, 'oracle-result.json')
  if (file !== '/tmp/grok-mobile-device-bulk-unibutton-oracle-394/oracle-result.json') throw new Error('output-file')
  fs.mkdirSync(OUT_DIR, { recursive: true, mode: 0o700 })
  fs.writeFileSync(file, \`\${JSON.stringify(publicResult(result), null, 2)}\\n\`, { mode: 0o600 })
}`,
  ],
]

function fail(code) {
  process.stderr.write(`${code}\n`)
  process.exit(2)
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function assertPrefix() {
  const real = fs.realpathSync(PREFIX)
  if (real !== PREFIX && real !== PRIVATE_PREFIX) fail('prefix')
  return real
}

function readRegular(file) {
  const st = fs.lstatSync(file)
  if (!st.isFile() || st.isSymbolicLink()) fail('not-regular')
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
  try {
    return fs.readFileSync(fd)
  } finally {
    fs.closeSync(fd)
  }
}

function writeNew(file, buffer) {
  const base = path.basename(file)
  if (FROZEN.has(base)) fail('frozen-output')
  if (path.resolve(file) !== file || path.dirname(file) !== PREFIX) fail('output-path')
  if (fs.realpathSync(path.dirname(file)) !== assertPrefix()) fail('output-path')
  if (fs.existsSync(file)) {
    const st = fs.lstatSync(file)
    if (!st.isFile() || st.isSymbolicLink()) fail('output-symlink')
  }
  let flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC
  if (typeof fs.constants.O_NOFOLLOW === 'number') flags |= fs.constants.O_NOFOLLOW
  const fd = fs.openSync(file, flags, 0o600)
  try {
    fs.writeFileSync(fd, buffer)
    fs.fchmodSync(fd, 0o600)
  } finally {
    fs.closeSync(fd)
  }
}

function count(text, needle) {
  let found = 0
  let from = 0
  while (from <= text.length) {
    const at = text.indexOf(needle, from)
    if (at < 0) break
    found += 1
    from = at + needle.length
  }
  return found
}

function applyPatches(source) {
  let text = source
  for (const [before, after] of PATCHES) {
    if (before === after) fail('empty-patch')
    if (count(text, before) !== 1) fail('patch-count')
    text = text.replace(before, after)
  }
  return text
}

function acceptDerived(text) {
  if (count(text, "page.locator('button.dev-cta')") !== 0) fail('old-locator')
  if (count(text, 'button.dev-cta') !== 0) fail('old-locator')
  if (count(text, '.isDisabled(') !== 0) fail('old-disabled')
  if (count(text, 'uni-button') !== 0) fail('broad-fallback')
  if (count(text, 'page.locator(\'.dev-cta[role="button"]\')') !== 1) fail('locator-count')
  if (count(text, 'await surface.cta.click()') !== 1) fail('click-locator')
  if (count(text, 'ctaEnabledExact: one && ctaDisabled === false && ctaText === COPY.cta') !== 1) fail('prior-match')
  if (count(text, 'ctaDisabledExact: one && ctaDisabled === true && ctaText === COPY.ctaDisabled') !== 1) fail('after-match')
  if (count(text, 'surface.ctaEnabledExact === true') !== 1) fail('bulk-gate')
  if (count(text, 'surface.ctaCount === 1 && surface.ctaDisabled === true && surface.otherExit === 2') !== 1) fail('sequential-gate')
  if (count(text, 'const bulkExact = ui.mode === \'bulk\' && ui.bulkClicks === 1 && ui.confirmClicks === 1 && ui.rowExitClicks === 0 && ui.cancelClicks === 0') !== 1) fail('bulk-exact')
  if (count(text, 'const sequentialExact = ui.mode === \'sequential\' && ui.bulkClicks === 0 && ui.confirmClicks === 2 && ui.rowExitClicks === 2 && ui.cancelClicks === 0') !== 1) fail('sequential-exact')
  if (count(text, 'for (const cookie of [memory.actor.cookie, memory.second.cookie])') !== 1) fail('refresh-loop')
  if (count(text, 'evidence.oldRefreshDenied === 2') !== 1) fail('refresh-gate')
  if (count(text, 'evidence.ownerUnchanged === true') < 1) fail('foreign-gate')
  if (count(text, 'evidence.actorStillAccepted === true') !== 1) fail('current-gate')
  if (!text.includes("const OUT_DIR = '/tmp/grok-mobile-device-bulk-unibutton-oracle-394'")) fail('out-dir')
  if (text.includes('/tmp/grok-mobile-device-others-revoke-h5-probe-331')) fail('prior-dir')
  if (text.includes("path.join(OUT_DIR, 'result.json')")) fail('prior-result')
  if (!text.includes("path.join(OUT_DIR, 'oracle-result.json')")) fail('oracle-result')
}

function derive() {
  if (process.env.MB025_OTHERS_H5) fail('runtime-refused')
  assertPrefix()
  const observer = readRegular(OBSERVER)
  const wrapper = readRegular(WRAPPER)
  if (observer.length !== REVIEWED.g331ObserverBytes) fail('observer-bytes')
  const observerSha = sha256(observer)
  if (observerSha !== REVIEWED.g331ObserverSha256) fail('observer-pin')
  const wrapperText = wrapper.toString('utf8')
  if (!wrapperText.includes(`G331_SHA='${REVIEWED.g331ObserverSha256}'`)) fail('wrapper-pin')
  if (!wrapperText.includes(`B116_SHA='${REVIEWED.b116IndexSha256}'`)) fail('b116-pin')
  if (!wrapperText.includes("ui.mode === 'bulk'")) fail('wrapper-bulk-gate')
  if (!wrapperText.startsWith('#!/bin/bash\n# Supervisor lease for the frozen G331 other-sessions probe. Identity 383.\n')) fail('wrapper-identity')
  const derived = applyPatches(observer.toString('utf8'))
  acceptDerived(derived)
  const body = Buffer.from(derived, 'utf8')
  writeNew(DERIVED, body)
  const pin = {
    status: 'DERIVED',
    recomputed: true,
    reviewed: REVIEWED,
    observerBytes: observer.length,
    observerSha256: observerSha,
    wrapperBytes: wrapper.length,
    wrapperSha256: sha256(wrapper),
    derivedBytes: body.length,
    derivedSha256: sha256(body),
    locator: '.dev-cta[role="button"]',
    derivedObserver: DERIVED_NAME,
    oracleResult: 'oracle-result.json',
    bulk: { bulkClicks: 1, confirmClicks: 1, rowExitClicks: 0, cancelClicks: 0 },
    sequential: { bulkClicks: 0, confirmClicks: 2, rowExitClicks: 2, cancelClicks: 0 },
    oldRefresh: [401, 401],
    currentStays: true,
    foreignUnchanged: true,
  }
  writeNew(DERIVED_PIN, Buffer.from(`${JSON.stringify(pin, null, 2)}\n`, 'utf8'))
  process.stdout.write('derived\n')
}

if (require.main === module) derive()

module.exports = { REVIEWED, PREFIX, DERIVED_NAME }
