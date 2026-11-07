'use strict'

/**
 * Classification only. Does not start Docker, MySQL, IAM, Gateway, Chrome,
 * or a static listener. Does not call Git. Exit 0 is PREFLIGHT. Exit 2 is
 * PREFLIGHT_FAIL with processesStarted false.
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { inspect, SOURCE } = require('./pin-rebind.cjs')

const HERE = __dirname
const PINS = JSON.parse(fs.readFileSync(path.join(HERE, 'pins.json'), 'utf8'))

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function existsFile(file) {
  try {
    const listed = fs.lstatSync(file)
    return listed.isFile() && !listed.isSymbolicLink()
  } catch {
    return false
  }
}

function existsDir(file) {
  try {
    return fs.statSync(file).isDirectory()
  } catch {
    return false
  }
}

function check(id, ok, detail) {
  return { id, ok: ok === true, detail: detail || {} }
}

function run() {
  const checks = []
  const processesStarted = false
  if (process.env.MB006_PLACEMENT_RETEST_CONTINUATION) {
    checks.push(check('retest.env', false, { present: true }))
  } else {
    checks.push(check('retest.env', true, { present: false }))
  }
  checks.push(check('pins.job', PINS.job === 'MB405_SAME_ACTOR_HOME_RETURN', { job: PINS.job }))
  checks.push(check('pins.head', /^[0-9a-f]{40}$/.test(PINS.sourceHead), { head: PINS.sourceHead }))
  checks.push(check('run.dir.literal', PINS.runDir === '/private/tmp/grok-mobile-resume-home-405/run', { runDir: PINS.runDir }))
  checks.push(check('repo.path', existsDir(PINS.repo), { repo: PINS.repo }))
  checks.push(check('harness.source', existsDir(SOURCE), { source: SOURCE }))
  for (const name of ['acceptance-learner-target.mjs', 'browser-target-probe.cjs', 'full-browser-owner.mjs', 'learner-target-probe.mjs', 'learning-plan-ensure.mjs', 'placement-start-read.mjs', 'process_guard.py']) {
    checks.push(check(`harness.${name}`, existsFile(path.join(SOURCE, name)), { name }))
  }
  checks.push(check('harness.seed', existsDir(path.join(SOURCE, 'seed')), {}))
  checks.push(check('harness.sql', existsDir(path.join(SOURCE, 'sql')), {}))
  const h5 = PINS.h5.root
  const index = path.join(h5, 'index.html')
  let indexSha = null
  let indexOk = false
  try {
    const realH5 = fs.realpathSync(h5)
    const listed = fs.lstatSync(index)
    indexSha = shaFile(index)
    indexOk = listed.isFile() && !listed.isSymbolicLink() && indexSha === PINS.h5.indexSha256 && indexSha !== PINS.h5.rejectIndexSha256
    checks.push(check('h5.canonical', realH5 === fs.realpathSync(PINS.h5.root), { realH5 }))
  } catch {
    checks.push(check('h5.canonical', false, { h5 }))
  }
  checks.push(check('h5.index', indexOk, { indexSha256: indexSha, expected: PINS.h5.indexSha256 }))
  for (const [name, jar] of Object.entries(PINS.jars)) {
    const present = existsFile(jar.path)
    let actual = null
    if (present) {
      try { actual = shaFile(jar.path) } catch { actual = null }
    }
    checks.push(check(`jar.${name}.path`, present, { path: jar.path }))
    checks.push(check(`jar.${name}.sha256`, actual === jar.sha256, { actual, expected: jar.sha256 }))
  }
  const fixture = path.join(PINS.repo, PINS.fixture.path)
  let fixtureSha = null
  try { fixtureSha = shaFile(fixture) } catch { fixtureSha = null }
  checks.push(check('fixture.mock-publication', fixtureSha === PINS.fixture.fileSha256, { fixtureSha, expected: PINS.fixture.fileSha256 }))
  for (const name of ['home-return-observer.cjs', 'home-return-hook.cjs', 'pin-rebind.cjs', 'wrapper.sh']) {
    checks.push(check(`artifact.${name}`, existsFile(path.join(HERE, name)), { name }))
  }
  const inspectResult = inspect()
  checks.push(check('pin-rebind.inspect', inspectResult.status === 'INSPECT' && inspectResult.retestContinuation === false, inspectResult))
  const failed = checks.filter((row) => !row.ok)
  const result = {
    status: failed.length ? 'PREFLIGHT_FAIL' : 'PREFLIGHT',
    processesStarted,
    runtime: 'NOT_RUN',
    sourceHead: PINS.sourceHead,
    runDir: PINS.runDir,
    h5IndexSha256: indexSha,
    failed: failed.map((row) => row.id),
    checks,
  }
  fs.writeFileSync(path.join(HERE, 'preflight.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ status: result.status, processesStarted, failed: result.failed, runtime: 'NOT_RUN' })}\n`)
  process.exit(failed.length ? 2 : 0)
}

if (require.main === module) {
  try {
    run()
  } catch (error) {
    const result = { status: 'PREFLIGHT_FAIL', processesStarted: false, runtime: 'NOT_RUN', reason: String(error && error.message ? error.message : error).slice(0, 120) }
    try { fs.writeFileSync(path.join(HERE, 'preflight.json'), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 }) } catch { /* classification still prints */ }
    process.stdout.write(`${JSON.stringify(result)}\n`)
    process.exit(2)
  }
}
