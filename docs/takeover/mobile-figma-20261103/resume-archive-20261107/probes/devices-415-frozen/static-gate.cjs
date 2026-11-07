'use strict'

/**
 * Offline static gate for the 415 devices bulk candidates.
 *
 * Compiles the CommonJS sources with vm.Script (parse only) and checks the
 * required locator, nonce, B139, and bulk-only strings. It does not listen,
 * spawn Chrome, open a socket, start MySQL, IAM, Gateway, or the lease.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const PREFIX = '/tmp/grok-mobile-resume-devices-repair-415'
const PRIVATE_PREFIX = '/private/tmp/grok-mobile-resume-devices-repair-415'
const B139_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B116_SHA = '94047adfbea64364b32e0b6f700caf74d8a3b19cd165c4095c43cd39a3c44520'
const G331_SHA = '704943be048fda4933327ca91e6870b08eb8fa70557ff3d0908c0591aa4ba6af'

const FILES = Object.freeze([
  'pinned-static-nonce.cjs',
  'device-others-owner-415.cjs',
  'static-gate.cjs',
])

function fail(code) {
  process.stderr.write(`${code}\n`)
  process.exit(2)
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

function assertPrefix() {
  const real = fs.realpathSync(PREFIX)
  if (real !== PREFIX && real !== PRIVATE_PREFIX) fail('prefix')
  return real
}

function readRegular(file) {
  const st = fs.lstatSync(file)
  if (!st.isFile() || st.isSymbolicLink()) fail(`not-regular:${path.basename(file)}`)
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0))
  try {
    return fs.readFileSync(fd, 'utf8')
  } finally {
    fs.closeSync(fd)
  }
}

function compile(name, text) {
  try {
    new vm.Script(text, { filename: name })
  } catch (error) {
    fail(`syntax:${name}`)
  }
}

function gateNonce(text) {
  if (count(text, B139_SHA) < 1) fail('nonce-b139')
  if (count(text, B116_SHA) < 1) fail('nonce-b116-pin')
  if (count(text, "const STATIC_QA_HEADER = 'x-mb004-static-qa'") !== 1) fail('nonce-header')
  if (count(text, 'expectedIndexSha === B116_INDEX_SHA || expectedIndexSha !== B139_INDEX_SHA') !== 1) fail('nonce-fail-closed')
  if (count(text, 'sameMarker(presented, marker)') < 1) fail('nonce-required')
  if (text.includes('headerFree')) fail('header-free')
}

function gateObserver(text) {
  if (count(text, "page.locator('button.dev-cta')") !== 0) fail('old-locator')
  if (count(text, 'button.dev-cta') !== 0) fail('old-locator')
  if (count(text, '.isDisabled(') !== 0) fail('old-disabled')
  if (count(text, 'uni-button') !== 0) fail('broad-fallback')
  if (count(text, 'page.locator(\'.dev-cta[role="button"]\')') !== 1) fail('locator-count')
  if (count(text, 'await surface.cta.click()') !== 1) fail('click-locator')
  if (count(text, 'ctaEnabledExact: one && ctaDisabled === false && ctaText === COPY.cta') !== 1) fail('prior-match')
  if (count(text, 'ctaDisabledExact: one && ctaDisabled === true && ctaText === COPY.ctaDisabled') !== 1) fail('after-match')
  if (count(text, 'surface.ctaEnabledExact === true') !== 2) fail('bulk-gate')
  if (count(text, "ui.mode = 'sequential'") !== 1) fail('sequential-record')
  if (count(text, "return finishBrowser(ui, traffic, staticFulfills, 'sequential-not-bulk-proof')") !== 1) fail('sequential-not-proof')
  if (count(text, 'ui.rowExitClicks += 1') !== 0) fail('sequential-click')
  if (count(text, 'for (const cookie of [memory.actor.cookie, memory.second.cookie])') !== 1) fail('refresh-loop')
  if (count(text, 'twoKicks === true') < 1) fail('independent-refresh')
  if (count(text, 'evidence.oldRefreshDenied === 2') !== 1) fail('refresh-gate')
  if (count(text, 'evidence.ownerUnchanged === true') < 1) fail('foreign-gate')
  if (count(text, 'evidence.actorStillAccepted === true') !== 1) fail('current-gate')
  if (count(text, "const STATIC_QA_HEADER = 'x-mb004-static-qa'") !== 1) fail('observer-nonce-header')
  if (count(text, '[STATIC_QA_HEADER]: nonce') < 1) fail('observer-nonce-continue')
  if (count(text, B139_SHA) !== 1) fail('observer-b139')
  if (count(text, 'B116_INDEX_SHA') < 1 || count(text, B116_SHA) < 1) fail('observer-b116')
  if (count(text, 'B139_INDEX_SHA === B116_INDEX_SHA') !== 1) fail('observer-b116-fail-closed')
  if (text.includes('/tmp/grok-mobile-device-others-revoke-h5-probe-331')) fail('prior-dir')
  if (text.includes('/tmp/grok-mobile-device-guard-source-directory-383')) fail('g383-dir')
  if (!text.includes("const OUT_DIR = '/tmp/grok-mobile-resume-devices-repair-415'")) fail('out-dir')
  if (count(text, "const bulkExact = ui.mode === 'bulk' && ui.bulkClicks === 1 && ui.confirmClicks === 1 && ui.rowExitClicks === 0 && ui.cancelClicks === 0") !== 1) fail('bulk-exact')
}

function gateWrapper(text) {
  if (!text.startsWith('#!/bin/bash\n# Supervisor lease for the MB025 devices bulk CTA. Identity 415.\n')) fail('wrapper-identity')
  if (count(text, "PREFIX='/tmp/grok-mobile-resume-devices-repair-415'") !== 1) fail('wrapper-prefix')
  if (count(text, `B139_SHA='${B139_SHA}'`) !== 1) fail('wrapper-b139')
  if (count(text, `B116_SHA='${B116_SHA}'`) !== 1) fail('wrapper-b116')
  if (count(text, `G331_SHA='${G331_SHA}'`) !== 1) fail('wrapper-g331')
  if (count(text, "ui.mode === 'bulk'") < 1) fail('wrapper-bulk-gate')
  if (count(text, "ui.mode === 'sequential'") < 1) fail('wrapper-sequential-fail')
  if (text.includes('headerFree')) fail('wrapper-header-free')
  if (count(text, 'openPinnedNonceStatic') < 1) fail('wrapper-nonce-open')
  if (count(text, "STATIC_QA_HEADER") < 1 && count(text, 'x-mb004-static-qa') < 1) fail('wrapper-nonce-header')
  if (count(text, 'mock-consent-publication.json') < 1) fail('wrapper-consent-fixture')
  if (count(text, '13306') < 1 || count(text, '18070') < 1 || count(text, '18087') < 1 || count(text, '18183') < 1) fail('wrapper-ports')
  if (text.includes('18088') || text.includes('18089') || text.includes('18091')) fail('wrapper-extra-ports')
  if (count(text, 'persist_diagnosis') < 1) fail('wrapper-diagnosis')
  if (count(text, 'parentErrorCategory') < 1) fail('wrapper-parent-category')
  if (count(text, 'childErrorCategory') < 1) fail('wrapper-child-category')
  if (count(text, 'probe-not-started') < 1) fail('wrapper-probe-absent')
  if (count(text, "REPO='/Users/Admin/.codex/worktrees/mobile-iam-http-acceptance-20261105/cloudstudy'") !== 1) fail('wrapper-g318-repo')
  if (count(text, 'writeStage') < 1) fail('wrapper-hook-stage')
  if (count(text, "stdio: 'ignore'") !== 0) fail('wrapper-probe-stdio')
}

function main() {
  if (process.env.MB025_OTHERS_H5) fail('runtime-refused')
  assertPrefix()
  for (const name of FILES) {
    const file = path.join(PREFIX, name)
    const text = readRegular(file)
    compile(name, text)
    if (name === 'pinned-static-nonce.cjs') gateNonce(text)
    if (name === 'device-others-owner-415.cjs') gateObserver(text)
  }
  const wrapper = readRegular(path.join(PREFIX, 'device-others-runtime.sh'))
  if (!wrapper.startsWith('#!/bin/bash\n')) fail('wrapper-shebang')
  gateWrapper(wrapper)
  process.stdout.write(`${JSON.stringify({
    status: 'STATIC_GATE',
    executed: false,
    syntax: 'compiled',
    locator: '.dev-cta[role="button"]',
    nonceHeader: 'x-mb004-static-qa',
    b139IndexSha256: B139_SHA,
    sequentialCountedAsProof: false,
  }, null, 2)}\n`)
}

if (require.main === module) main()

module.exports = { PREFIX, B139_SHA, B116_SHA }
