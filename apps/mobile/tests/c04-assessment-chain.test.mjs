import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..', '..', '..')
const read = (path) => readFile(join(root, path), 'utf8')

test('mobile placement mutations use Gateway paths and idempotency keys', async () => {
  const api = await read('apps/mobile/src/api/learner-content.ts')
  const store = await read('apps/mobile/src/stores/learner-content.ts')
  assert.match(api, /'\/assessment\/placement\/sessions'/)
  assert.match(api, /\/assessment\/placement\/sessions\/\$\{encodeURIComponent\(input\.sessionId\)\}\/responses/)
  assert.match(api, /'Idempotency-Key': idempotencyKey/)
  assert.match(store, /mobileLearnerContentApi\.submitPlacementAnswer/)
  assert.match(store, /placementStatus\.value === 'loading'/)
})

test('mobile assessment and report pages keep loading and error states visible', async () => {
  const assessment = await read('apps/mobile/src/pages/assessment/assessment.vue')
  const locale = await read('packages/i18n/src/mobile-experience.ts')
  const practice = await read('apps/mobile/src/pages/b2-practice/b2-practice.vue')
  const report = await read('apps/mobile/src/pages/b10-report/b10-report.vue')
  assert.match(assessment, /store\.placementStatus === 'loading'/)
  assert.match(assessment, /mobileT\(store\.placement\.sessionId\?\.startsWith\('asess_'\) \? 'assessment\.reload' : 'assessment\.retryStart'\)/)
  assert.match(assessment, /mobileT\('assessment\.introduction'\)/)
  assert.match(assessment, /mobileT\('assessment\.completed'\)/)
  assert.match(assessment, /mobileT\('assessment\.unverified'\)/)
  assert.match(assessment, /mobileT\('assessment\.retest'\)/)
  assert.match(assessment, /@click="askRetest"/)
  assert.match(assessment, /@click="retest"/)
  assert.match(assessment, /role="heading"/)
  assert.match(assessment, /role="progressbar"/)
  assert.match(assessment, /responseOutcome === 'FULL' \? mobileT\('assessment\.correct'\) : store\.placement\.responseOutcome === 'ZERO' \? mobileT\('assessment\.incorrect'\)/)
  assert.match(locale, /reload: 'Read again'/)
  assert.match(locale, /reload: '重新读取'/)
  assert.match(locale, /introduction: 'Answer 10 questions to understand your current English starting point\.'/)
  assert.match(locale, /introduction: '共 10 道题，了解你现在的英语起点。'/)
  assert.match(locale, /completed: 'Completed'/)
  assert.match(locale, /completed: '已完成'/)
  assert.match(locale, /retest: 'Take assessment again'/)
  assert.match(locale, /retest: '重新测评'/)
  assert.match(locale, /unverified: 'Level not verified'/)
  assert.match(locale, /unverified: '水平尚未验证'/)
  assert.match(locale, /correct: 'Your last answer was correct\.'/)
  assert.match(locale, /correct: '刚才提交的这题答对了。'/)
  assert.match(locale, /incorrect: 'Your last answer was incorrect\.'/)
  assert.match(locale, /incorrect: '刚才提交的这题没有答对。'/)
  assert.doesNotMatch(assessment, /重测尚未接通/)
  assert.doesNotMatch(assessment, /历史两题练习结果|正确选项|3 分钟|已存本机|可离线答完/)
  assert.doesNotMatch(locale, /报告已生成|方便安排后面的学习|重测尚未接通|已存本机|可离线答完/)
  assert.match(practice, /store\.practiceStatus === 'loading'/)
  assert.match(practice, /status\.retry/)
  assert.match(practice, /store\.submitAnswer/)
  assert.match(practice, /规则命中/)
  assert.match(practice, /lastResult\.scoringStatus/)
  assertReportSurface(report)
})

function assertReportSurface(report) {
  const integrated = [
    "type View = 'mistakes' | 'daily' | 'weekly'",
    'store.loadMistakes()',
    'store.loadReport(view.value)',
    "store.loadReport(view.value === 'weekly' ? 'weekly' : 'daily')",
    'store.loadReport(next)',
    "view === 'daily'",
    "view === 'weekly'",
    "store.reportStatus === 'loading'",
    'mistake.masteryStatus',
    'reason.evidence',
    'function retryPage()',
    'function retryMistake(mistake: B10Mistake)',
    'store.startMistakeRetry(mistake.mistakeId)',
    'retryMistake(mistake)',
  ]
  const released = [
    "const reportPeriod = ref<'daily' | 'weekly'>('daily')",
    'store.loadMistakes()',
    'store.loadReport(reportPeriod.value)',
    "reportPeriod === 'daily'",
    "reportPeriod === 'weekly'",
    "store.reportStatus !== 'idle' && store.reportStatus !== 'ready'",
    "store.reportStatus === 'loading'",
    'mistake.masteryStatus',
    'reason.evidence',
    'store.report.evidence',
    'function retry(mistakeId: number)',
    'store.startMistakeRetry(mistakeId)',
    'retry(mistake.mistakeId)',
    '@retry="load"',
  ]
  const complete = (needles) => needles.every((item) => report.includes(item))
  assert.equal(complete(integrated) || complete(released), true)
}
