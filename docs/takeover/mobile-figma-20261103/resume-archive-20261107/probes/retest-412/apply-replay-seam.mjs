/**
 * Patch only the G372 retest continuation seam for identity 412.
 *
 * Reads a staged copy. Does not read or write the frozen G372 or G391 trees.
 * Direct use: node apply-replay-seam.mjs <staged-directory>
 */
import fs from 'node:fs'
import path from 'node:path'

const staged = process.argv[2]
if (!staged || process.argv.length !== 3) {
  process.stderr.write('apply-replay-seam: staged directory required\n')
  process.exit(2)
}

const RUN_ROOT = '/private/tmp/grok-mobile-resume-retest-replay-412/run'
const OLD_RUN_ROOT = '/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run'
const B139_H5 = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/reading-practice-integrated-g351-root/h5'
const B100_H5 = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/resume-20261105/assessment-theme-111-root/h5'
const B139_SHA = '706fffb7517121d6a43b6e23e483afa0c1fcc3d7e32a95a0938cc584be66ae32'
const B100_SHA = '6416f7f58a19b9cf7821288e5ada237f236009ec04f9b19b8e0bdc02d9433519'
const OLD_COMMIT = '3953f8b80d463f3f2a8ebba758b10a4a2610d934'
const NEW_COMMIT = '61b9ede7c65ef065c76c846c27fb69a52cd042cd'

function read(name) {
  return fs.readFileSync(path.join(staged, name), 'utf8')
}

function write(name, text) {
  fs.writeFileSync(path.join(staged, name), text)
}

function replaceOnce(name, text, old, next, label) {
  const count = text.split(old).length - 1
  if (count !== 1) {
    process.stderr.write(`apply-replay-seam: ${name} ${label} matched ${count}\n`)
    process.exit(2)
  }
  return text.replace(old, next)
}

function replaceCount(name, text, old, next, expected, label) {
  const count = text.split(old).length - 1
  if (count !== expected) {
    process.stderr.write(`apply-replay-seam: ${name} ${label} matched ${count}, expected ${expected}\n`)
    process.exit(2)
  }
  return text.split(old).join(next)
}

let wrapper = read('wrapper.sh')
wrapper = replaceOnce('wrapper.sh', wrapper,
  "  qa_name='cloudstudy-mobile-placement-retest-372-20261106'\n  qa_label='cloudstudy.qa.mobile-placement-retest-372-20261106'\n",
  "  qa_name='cloudstudy-mobile-placement-retest-412-20261107'\n  qa_label='cloudstudy.qa.mobile-placement-retest-412-20261107'\n",
  'container')
wrapper = replaceOnce('wrapper.sh', wrapper,
  `qa_retest_root='${OLD_RUN_ROOT}'\nqa_b100_h5='${B100_H5}'\nqa_b100_sha='${B100_SHA}'\n`,
  `qa_retest_root='${RUN_ROOT}'\nqa_b100_h5='${B139_H5}'\nqa_b100_sha='${B139_SHA}'\n`,
  'pins')
wrapper = replaceOnce('wrapper.sh', wrapper,
  '  test "$qa_h5_sha" = "$qa_b100_sha"\n',
  '  test "$qa_h5_sha" = "$qa_b100_sha"\n  test "${MB006_PLACEMENT_RETEST_REPLAY:-}" = \'MB006_PLACEMENT_RETEST_REPLAY\'\n',
  'replay-opt-in')
wrapper = replaceOnce('wrapper.sh', wrapper,
  `test "$(git -C "$qa_repo" rev-parse HEAD)" = ${OLD_COMMIT}\n`,
  `test "$(git -C "$qa_repo" rev-parse HEAD)" = ${NEW_COMMIT}\n`,
  'commit')
wrapper = replaceOnce('wrapper.sh', wrapper,
  'node --check "$qa_source/browser-target-probe.cjs"\n',
  'node --check "$qa_source/browser-target-probe.cjs"\nnode --check "$qa_source/placement-retest-same-key-replay.cjs"\n',
  'syntax')
wrapper = replaceOnce('wrapper.sh', wrapper,
  '"$qa_source/browser-target-probe.cjs" "$qa_source/process_guard.py"',
  '"$qa_source/browser-target-probe.cjs" "$qa_source/placement-retest-same-key-replay.cjs" "$qa_source/process_guard.py"',
  'copy')
wrapper = replaceOnce('wrapper.sh', wrapper,
  'MB006_PLACEMENT_RETEST_CONTINUATION="${MB006_PLACEMENT_RETEST_CONTINUATION:-}" \\\n',
  'MB006_PLACEMENT_RETEST_CONTINUATION="${MB006_PLACEMENT_RETEST_CONTINUATION:-}" \\\nMB006_PLACEMENT_RETEST_REPLAY="${MB006_PLACEMENT_RETEST_REPLAY:-}" \\\n',
  'env')
write('wrapper.sh', wrapper)

let acceptance = read('acceptance-learner-target.mjs')
acceptance = replaceCount('acceptance-learner-target.mjs', acceptance, OLD_COMMIT, NEW_COMMIT, 2, 'commit')
acceptance = replaceOnce('acceptance-learner-target.mjs', acceptance,
  "        ? '- The full H5 directory is the B100 assessment theme directory, already canonical, and `MB006_FULL_BROWSER_INDEX_SHA256` is hashed from `index.html` before runtime. DSH42 receives `full`, `fullArtifact`, `fullIndexSha`, and `retestContinuation`. `MB033_RUN_DIRECTORY` is `/private/tmp/grok-mobile-placement-retest-canonical-macos-run-372/run`.'\n",
  `        ? '- The full H5 directory is the B139 integrated H5, already canonical, and \`MB006_FULL_BROWSER_INDEX_SHA256\` is hashed from \`index.html\` before runtime. DSH42 receives \`full\`, \`fullArtifact\`, \`fullIndexSha\`, and \`retestContinuation\`. The same-key replay is \`MB006_PLACEMENT_RETEST_REPLAY\`. \`MB033_RUN_DIRECTORY\` is \`${RUN_ROOT}\`. DEC-04 stays NOT_ASSERTED. No skip control is clicked.'\n`,
  'h5-sentence')
acceptance = replaceOnce('acceptance-learner-target.mjs', acceptance, OLD_RUN_ROOT, RUN_ROOT, 'run-root')
acceptance = replaceOnce('acceptance-learner-target.mjs', acceptance,
  "? 'the retest continuation callback must pass the proven B100 artifact, index SHA, and retestContinuation'\n",
  "? 'the retest continuation callback must pass the proven B139 artifact, index SHA, and retestContinuation'\n",
  'callback-message')
write('acceptance-learner-target.mjs', acceptance)

let learner = read('learner-target-probe.mjs')
learner = replaceOnce('learner-target-probe.mjs', learner,
  `const RETEST_CONTINUATION_ROOT = '${OLD_RUN_ROOT}'\n`,
  `const RETEST_CONTINUATION_ROOT = '${RUN_ROOT}'\n`,
  'run-root')
learner = replaceOnce('learner-target-probe.mjs', learner,
  "? 'DSH42 retest continuation receives the proven B100 artifact, index SHA, and retestContinuation'\n",
  "? 'DSH42 retest continuation receives the proven B139 artifact, index SHA, and retestContinuation'\n",
  'callback-message')
write('learner-target-probe.mjs', learner)

let probe = read('browser-target-probe.cjs')
probe = replaceOnce('browser-target-probe.cjs', probe,
  "const { execFileSync } = require('node:child_process')\n",
  `const { execFileSync } = require('node:child_process')
const { holdAuthorizedRetest, replaySameKey, release: releaseRetestReplay } = require('./placement-retest-same-key-replay.cjs')

function retestReplayRequested() {
  const value = process.env.MB006_PLACEMENT_RETEST_REPLAY
  if (value == null || value === '') return false
  if (value === 'MB006_PLACEMENT_RETEST_REPLAY') return true
  return null
}
`,
  'require')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `            if (!((bodyText === '' || bodyText === '{}') && idempotencyPresent(request))) {
              failFull(fullState, 'full-retest-body')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-body', query: decision.query })
              return
            }
            fullState.retest.requested = 1
`,
  `            if (!((bodyText === '' || bodyText === '{}') && idempotencyPresent(request))) {
              failFull(fullState, 'full-retest-body')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-body', query: decision.query })
              return
            }
            if (retestReplayRequested() === null) {
              failFull(fullState, 'full-retest-replay-opt-in')
              await route.abort()
              note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-replay-opt-in', query: decision.query })
              return
            }
            if (retestReplayRequested() === true) {
              try {
                holdAuthorizedRetest(request, {
                  continuation: true,
                  armed: fullState.retest.armed === true,
                  responseCount: fullState.responses.length,
                  ensureRequested: fullState.ensure.requested,
                  completedSessionId: placementState.sessionId,
                  reportId: fullState.final && typeof fullState.final.reportId === 'string' ? fullState.final.reportId : '',
                })
              } catch {
                failFull(fullState, 'full-retest-capture')
                await route.abort()
                note(method, url.pathname, { status: null, type: decision.type, disposition: 'abort', reason: 'full-retest-capture', query: decision.query })
                return
              }
            }
            fullState.retest.requested = 1
`,
  'capture')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `    if (!before || before.retestVisible !== true || before.retestDisabled === true || before.reportVisible !== true || before.dialogVisible === true) {
      return stop('full-retest-ui')
    }
    await page.locator('#assessment-retest').click()
`,
  `    if (!before || before.retestVisible !== true || before.retestDisabled === true || before.reportVisible !== true || before.dialogVisible === true) {
      return stop('full-retest-ui')
    }
    const skipCtaCount = await page.locator('#assessment-skip').count().catch(() => 1)
    if (skipCtaCount !== 0) return stop('full-skip-cta-present')
    full.retest.skipCta = 'ABSENT'
    full.retest.dec04 = 'NOT_ASSERTED'
    await page.locator('#assessment-retest').click()
`,
  'skip-cta')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `    full.retest.questionVisible = true
    full.retest.reportScreenLeft = true
    full.retest.submitStillDisabled = true
    full.retest.noChoice = true
    full.retest.firstItem = true
    full.retest.opened = null
    return { met: true, reason: null }
`,
  `    full.retest.questionVisible = true
    full.retest.reportScreenLeft = true
    full.retest.submitStillDisabled = true
    full.retest.noChoice = true
    full.retest.firstItem = true
    full.retest.opened = null
    if (retestReplayRequested() === null) return stop('full-retest-replay-opt-in')
    if (retestReplayRequested() === true) {
      let replayed = null
      try {
        replayed = await replaySameKey({
          status: full.retest.status,
          sessionId: full.retest.sessionId,
          acceptedSequence: 0,
          nextSequence: 1,
          stateVersion: 1,
          contentVersionId: PLACEMENT_CONTENT_VERSION_ID,
          itemId: PLACEMENT_FIRST_ITEM_ID,
          totalItemCount: PLACEMENT_TOTAL_ITEMS,
        })
      } catch (error) {
        releaseRetestReplay()
        return stop(error && typeof error.code === 'string' ? error.code : 'full-retest-replay')
      }
      if (!replayed || replayed.replayed !== 1 || replayed.status !== 201 || replayed.sessionReadStatus !== 200
        || replayed.sameSession !== true || replayed.reportUnchanged !== true || replayed.sessionStillFresh !== true
        || replayed.extraReport !== 0 || replayed.extraAnswer !== 0 || replayed.extraCheckpoint !== 0) {
        releaseRetestReplay()
        return stop('full-retest-replay')
      }
      full.retest.replay = replayed
    }
    return { met: true, reason: null }
`,
  'replay-call')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `  const retestPosts = continued.filter((row) => row.type === 'gateway-placement-retest' && row.method === 'POST')
  const retestState = full.retest && typeof full.retest === 'object' ? full.retest : null
  const retestOk = retest && retestPosts.length === 1 && retestPosts[0].status === 201 && retestWrites.length === 1
    && retestState && retestState.requested === 1 && retestState.status === 201
    && retestState.bodyEmpty === true && retestState.idempotency === true && retestState.authorized === true
    && retestState.sessionNew === true && retestState.questionVisible === true && retestState.reportScreenLeft === true
    && retestState.confirmClicks === 1 && retestState.submitStillDisabled === true && retestState.noChoice === true
    && retestState.firstItem === true && full.todayUiClickedAt == null && full.today.afterUi.length === 0
    && full.home.requested === 0 && full.catalog.requested === 0
`,
  `  const retestPosts = continued.filter((row) => row.type === 'gateway-placement-retest' && row.method === 'POST')
  const retestState = full.retest && typeof full.retest === 'object' ? full.retest : null
  const replayRequested = retestReplayRequested()
  const replayRow = retestState && retestState.replay && typeof retestState.replay === 'object' ? retestState.replay : null
  const replayOk = replayRequested === false || (replayRequested === true && replayRow
    && replayRow.replayed === 1 && replayRow.status === 201 && replayRow.sessionReadStatus === 200
    && replayRow.sameSession === true && replayRow.reportUnchanged === true && replayRow.sessionStillFresh === true
    && replayRow.extraReport === 0 && replayRow.extraAnswer === 0 && replayRow.extraCheckpoint === 0)
  const retestOk = retest && replayOk && retestPosts.length === 1 && retestPosts[0].status === 201 && retestWrites.length === 1
    && retestState && retestState.requested === 1 && retestState.status === 201
    && retestState.bodyEmpty === true && retestState.idempotency === true && retestState.authorized === true
    && retestState.sessionNew === true && retestState.questionVisible === true && retestState.reportScreenLeft === true
    && retestState.confirmClicks === 1 && retestState.submitStillDisabled === true && retestState.noChoice === true
    && retestState.firstItem === true && full.todayUiClickedAt == null && full.today.afterUi.length === 0
    && full.home.requested === 0 && full.catalog.requested === 0
    && (replayRequested !== true || retestState.skipCta === 'ABSENT')
`,
  'retest-ok')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `      retestFirstItem: Boolean(retestState && retestState.firstItem === true),
      skipWrites: skipWrites.length,
`,
  `      retestFirstItem: Boolean(retestState && retestState.firstItem === true),
      retestReplay: replayRow ? replayRow.replayed : 0,
      retestReplayStatus: replayRow ? replayRow.status : null,
      retestReplaySessionReadStatus: replayRow ? replayRow.sessionReadStatus : null,
      retestReplaySameSession: Boolean(replayRow && replayRow.sameSession === true),
      retestReportUnchanged: Boolean(replayRow && replayRow.reportUnchanged === true),
      retestReplaySessionStillFresh: Boolean(replayRow && replayRow.sessionStillFresh === true),
      retestReplayExtraReport: replayRow ? replayRow.extraReport : null,
      retestReplayExtraAnswer: replayRow ? replayRow.extraAnswer : null,
      retestReplayExtraCheckpoint: replayRow ? replayRow.extraCheckpoint : null,
      skipCta: retestState && retestState.skipCta === 'ABSENT' ? 'ABSENT' : null,
      dec04: 'NOT_ASSERTED',
      skipWrites: skipWrites.length,
`,
  'expectations')
probe = replaceOnce('browser-target-probe.cjs', probe,
  `  const finish = (status, reason) => {
    obs.staticFulfills = staticFulfills
`,
  `  const finish = (status, reason) => {
    try { releaseRetestReplay() } catch { /* capture slot is already empty when replay did not arm */ }
    obs.staticFulfills = staticFulfills
`,
  'release')
write('browser-target-probe.cjs', probe)

const owner = read('full-browser-owner.mjs')
const replay = read('placement-retest-same-key-replay.cjs')
const untouched = read('placement-start-read.mjs')
if (!owner.includes(RUN_ROOT) || !owner.includes(B139_SHA) || !owner.includes("full.retestReplayStatus !== 201")) {
  process.stderr.write('apply-replay-seam: observer overlay missing\n')
  process.exit(2)
}
if (!replay.includes("fail('replay-status')") || !replay.includes("fail('replay-session-read')")) {
  process.stderr.write('apply-replay-seam: replay module missing\n')
  process.exit(2)
}
if (untouched.includes('grok-mobile-resume-retest-replay-412')) {
  process.stderr.write('apply-replay-seam: placement-start-read.mjs was patched\n')
  process.exit(2)
}
if (probe.split('holdAuthorizedRetest').length - 1 !== 2 || probe.split('replaySameKey').length - 1 !== 2) {
  process.stderr.write('apply-replay-seam: replay calls drifted\n')
  process.exit(2)
}
if (wrapper.includes(OLD_RUN_ROOT) || wrapper.includes(B100_SHA) || wrapper.includes('retest-372')) {
  process.stderr.write('apply-replay-seam: wrapper still has the 372 pin\n')
  process.exit(2)
}
