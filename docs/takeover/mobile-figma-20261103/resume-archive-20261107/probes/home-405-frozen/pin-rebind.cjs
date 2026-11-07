'use strict'

/**
 * Stage the reviewed G372 harness-source into this job's staged-harness
 * directory and apply the exact 405 pin literals. Direct execution with no
 * arguments stages. --inspect only prints the replacement table.
 * This file does not start Docker, MySQL, Chrome, or a listener.
 */

const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const HERE = path.dirname(__filename)
const PINS = JSON.parse(fs.readFileSync(path.join(HERE, 'pins.json'), 'utf8'))
const SOURCE = PINS.harnessSource
const DEST = path.join(HERE, 'staged-harness')
const RUN_DIR = PINS.runDir
const HEAD = PINS.sourceHead
const CONTENT_SHA = PINS.jars.content.sha256
const ASSESSMENT_SHA = PINS.jars.assessment.sha256
const OLD_HEAD = '3953f8b80d463f3f2a8ebba758b10a4a2610d934'
const OLD_ROOT = PINS.b96HistoricalRoot
const OLD_CONTENT = 'dfea86f0f7fa9b28074c7ccd1c79b871e8de282be999fc77bd7dc732b36c65bf'
const OLD_ASSESSMENT = 'e3f49608f3fa0364bccc0404306377ffa57766cdac38ce38b73e585b496b1239'

const FILES = [
  'acceptance-learner-target.mjs',
  'learner-target-probe.mjs',
  'placement-start-read.mjs',
  'learning-plan-ensure.mjs',
  'full-browser-owner.mjs',
  'browser-target-probe.cjs',
  'process_guard.py',
]

const REPLACEMENTS = [
  {
    file: 'acceptance-learner-target.mjs',
    pairs: [
      [`const FULL_BROWSER_COMMIT = '${OLD_HEAD}'`, `const FULL_BROWSER_COMMIT = '${HEAD}'`],
      [`const FULL_BROWSER_CONTENT_JAR_SHA256 = '${OLD_CONTENT}'`, `const FULL_BROWSER_CONTENT_JAR_SHA256 = '${CONTENT_SHA}'`],
      [`const FULL_BROWSER_ASSESSMENT_JAR_SHA256 = '${OLD_ASSESSMENT}'`, `const FULL_BROWSER_ASSESSMENT_JAR_SHA256 = '${ASSESSMENT_SHA}'`],
      [
        `    ? 'The full browser run refuses a non-\`${OLD_HEAD}\` HEAD, a dirty tracked product tree, busy fixed ports, a missing V19 migration, a non-loopback JDBC URL, or a missing disposable-MySQL confirmation. A detached author-only checkout of that commit is accepted. See \`RUNBOOK.md\` for database readiness and cleanup.'`,
        `    ? 'The full browser run refuses a non-\`${HEAD}\` HEAD, a dirty tracked product tree, busy fixed ports, a missing V19 migration, a non-loopback JDBC URL, or a missing disposable-MySQL confirmation. A detached author-only checkout of that commit is accepted. See \`RUNBOOK.md\` for database readiness and cleanup.'`,
      ],
      [
        `: '- The full H5 directory is \`MB006_FULL_BROWSER_ARTIFACT\`, already canonical, and \`MB006_FULL_BROWSER_INDEX_SHA256\` is hashed from \`index.html\` before runtime. DSH42 receives only \`full\`, \`fullArtifact\`, and \`fullIndexSha\`. \`MB033_RUN_DIRECTORY\` is the existing private \`mb006-placement-full-browser-96-root\`.')`,
        `: '- The full H5 directory is \`MB006_FULL_BROWSER_ARTIFACT\`, already canonical, and \`MB006_FULL_BROWSER_INDEX_SHA256\` is hashed from \`index.html\` before runtime. DSH42 receives only \`full\`, \`fullArtifact\`, and \`fullIndexSha\`. \`MB033_RUN_DIRECTORY\` is \`${RUN_DIR}\`.')`,
      ],
      [`: '${OLD_ROOT}'`, `: '${RUN_DIR}'`],
    ],
  },
  {
    file: 'full-browser-owner.mjs',
    pairs: [
      [`const HISTORICAL_FULL_BROWSER_ROOT = '${OLD_ROOT}'`, `const HISTORICAL_FULL_BROWSER_ROOT = '${RUN_DIR}'`],
    ],
  },
  {
    file: 'learner-target-probe.mjs',
    pairs: [
      [`const FULL_BROWSER_ROOT_ARTIFACT_DIR = '${OLD_ROOT}'`, `const FULL_BROWSER_ROOT_ARTIFACT_DIR = '${RUN_DIR}'`],
    ],
  },
  {
    file: 'placement-start-read.mjs',
    pairs: [
      [`export const CONTENT_JAR_SHA256 = '${OLD_CONTENT}'`, `export const CONTENT_JAR_SHA256 = '${CONTENT_SHA}'`],
      [`export const ASSESSMENT_JAR_SHA256 = '${OLD_ASSESSMENT}'`, `export const ASSESSMENT_JAR_SHA256 = '${ASSESSMENT_SHA}'`],
    ],
  },
]

function shaFile(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function fail(reason, detail) {
  const error = new Error(reason)
  error.reason = reason
  error.detail = detail
  throw error
}

function applyPairs(file, pairs) {
  let text = fs.readFileSync(file, 'utf8')
  const applied = []
  for (const [from, to] of pairs) {
    const count = text.split(from).length - 1
    if (count !== 1) fail('pin-rebind-count', { file: path.basename(file), from: from.slice(0, 80), count })
    text = text.replace(from, to)
    applied.push({ from: from.slice(0, 96), to: to.slice(0, 96) })
  }
  fs.writeFileSync(file, text, { mode: 0o600 })
  return applied
}

function stage() {
  if (process.env.MB006_PLACEMENT_RETEST_CONTINUATION) {
    fail('retest-env-forbidden', { present: true })
  }
  if (!fs.existsSync(SOURCE) || !fs.statSync(SOURCE).isDirectory()) fail('harness-source-missing', { source: SOURCE })
  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true })
  fs.mkdirSync(DEST, { recursive: true, mode: 0o700 })
  for (const name of FILES) {
    const src = path.join(SOURCE, name)
    if (!fs.existsSync(src) || !fs.statSync(src).isFile()) fail('harness-file-missing', { name })
    fs.copyFileSync(src, path.join(DEST, name))
    fs.chmodSync(path.join(DEST, name), 0o600)
  }
  fs.cpSync(path.join(SOURCE, 'seed'), path.join(DEST, 'seed'), { recursive: true })
  fs.cpSync(path.join(SOURCE, 'sql'), path.join(DEST, 'sql'), { recursive: true })
  const applied = []
  for (const row of REPLACEMENTS) {
    applied.push({ file: row.file, pairs: applyPairs(path.join(DEST, row.file), row.pairs) })
  }
  for (const row of REPLACEMENTS) {
    const destText = fs.readFileSync(path.join(DEST, row.file), 'utf8')
    if (destText.includes(OLD_ROOT) && row.file !== 'browser-target-probe.cjs') {
      fail('old-run-root-remains', { file: row.file })
    }
    if (row.file === 'acceptance-learner-target.mjs' && destText.includes(OLD_HEAD)) {
      fail('old-head-remains', { file: row.file })
    }
    if (row.file === 'placement-start-read.mjs' && (destText.includes(OLD_CONTENT) || destText.includes(OLD_ASSESSMENT))) {
      fail('old-jar-sha-remains', { file: row.file })
    }
  }
  const files = {}
  for (const name of FILES) files[name] = shaFile(path.join(DEST, name))
  return { status: 'STAGED', dest: DEST, runDir: RUN_DIR, head: HEAD, files, applied }
}

function inspect() {
  return {
    status: 'INSPECT',
    source: SOURCE,
    dest: DEST,
    replacements: REPLACEMENTS.map((row) => ({ file: row.file, pairCount: row.pairs.length })),
    retestContinuation: false,
  }
}

if (require.main === module) {
  const mode = process.argv[2] === '--inspect' ? 'inspect' : 'stage'
  try {
    const result = mode === 'inspect' ? inspect() : stage()
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ status: 'FAIL', reason: error.reason || 'pin-rebind', detail: error.detail || { message: String(error.message || error) } })}\n`)
    process.exit(2)
  }
}

module.exports = { stage, inspect, DEST, SOURCE, REPLACEMENTS }
