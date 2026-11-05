import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')

function read(relativePath, root = appRoot) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function loadTs(relativePath, root = appRoot) {
  const source = read(relativePath, root)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const localRequire = (request) => {
    if (request === '../../domain/plan-today') return loadTs('src/domain/plan-today.ts')
    throw new Error(`unexpected import ${request} from ${relativePath}`)
  }
  new Function('require', 'module', 'exports', compiled)(localRequire, module, module.exports)
  return module.exports
}

const api = loadTs('src/pages/learn/learn-page.ts')
const copy = loadTs('src/mobile-resources/learn-page.ts', path.join(repoRoot, 'packages/i18n'))
const page = read('src/pages/learn/learn.vue')

test('shelf and detail stay mutually exclusive and use real catalog facts', () => {
  assert.equal(api.learnSurface(''), 'shelf')
  assert.equal(api.learnSurface('  '), 'shelf')
  assert.equal(api.learnSurface('ui-coffee'), 'detail')
  const cards = [
    { contentCode: 'published', title: 'Real course', summary: 'A real summary', availability: 'PUBLISHED' },
    { contentCode: 'pending', title: 'Hidden rights', summary: 'secret body', availability: 'RIGHTS_PENDING' },
    { contentCode: 'expired', title: 'Expired', summary: 'old', availability: 'RIGHTS_EXPIRED' },
    { contentCode: 'offline', title: 'Offline', summary: 'gone', availability: 'UNPUBLISHED' },
    { contentCode: '', title: 'Blank', summary: 'no', availability: 'PUBLISHED' },
  ]
  const open = api.accessibleShelf(cards)
  assert.deepEqual(open.map((item) => item.contentCode), ['published'])
  assert.deepEqual(api.matchShelf(open, 'real').map((item) => item.contentCode), ['published'])
  assert.equal(api.classifyLearnShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 1, matchCount: 1 }), 'results')
  assert.equal(api.classifyLearnShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 0, matchCount: 0 }), 'catalog-empty')
  assert.equal(api.classifyLearnShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 0, matchCount: 0 }), 'catalog-empty')
  assert.equal(api.classifyLearnShelf({ denied: false, offline: false, unavailable: false, accessibleCount: 2, matchCount: 0 }), 'no-matches')
  assert.equal(api.classifyLearnShelf({ denied: true, offline: true, unavailable: true, accessibleCount: 0, matchCount: 0 }), 'denial')
  assert.equal(api.classifyLearnShelf({ denied: false, offline: true, unavailable: true, accessibleCount: 1, matchCount: 1 }), 'error')
  assert.equal(api.classifyLearnShelf({ denied: false, offline: false, unavailable: true, accessibleCount: 1, matchCount: 0 }), 'unavailable')
})

test('detail gates hide answers, mismatched versions, and closed rights', () => {
  assert.equal(api.readStatusKind(401), 'auth')
  assert.equal(api.readStatusKind(403), 'denial')
  assert.equal(api.readStatusKind(404), 'unavailable')
  assert.equal(api.readStatusKind(500), 'error')
  assert.equal(api.readStatusKind(null), null)
  assert.equal(api.rightsBlocked('RIGHTS_PENDING'), true)
  assert.equal(api.rightsBlocked('PUBLISHED'), false)
  assert.equal(api.rightsBlocked(undefined), false)
  assert.equal(api.versionBlocked(3, 4), true)
  assert.equal(api.versionBlocked(3, 3), false)
  assert.equal(api.versionBlocked(null, 3), false)
  assert.equal(api.versionBlocked(3, null), false)
  const units = api.learnerUnits([
    { itemId: 'unit-1', text: 'Could I have a latte, please?', options: [{ key: 'A', text: 'SECRET ANSWER' }] },
    { itemId: 'blank', text: '', options: [{ key: 'B', text: 'HIDDEN' }] },
  ])
  assert.deepEqual(units, [{ itemId: 'unit-1', text: 'Could I have a latte, please?', mark: 'neutral' }])
  assert.equal(JSON.stringify(units).includes('SECRET'), false)
  assert.equal(api.resumeCheckpoint({ status: 'ACTIVE', lessonId: 'published', stepIndex: 2 })?.contentId, 'published')
  assert.equal(api.resumeCheckpoint({ status: 'EXPIRED', lessonId: 'published', stepIndex: 2 }), null)
  assert.equal(api.resumeCheckpoint(null), null)
  assert.equal(api.contentMetaLabel('en-US', 'COURSE_UNIT', false), '英语 · 课程单元')
  assert.equal(api.contentMetaLabel('en-US', 'COURSE_UNIT', true), 'English · Course unit')
  assert.equal(api.contentMetaLabel('xx', 'NOPE', false), '')
  assert.equal(api.reviewFacing('REVIEW', 'LEARNING', false), '复习 · 巩固中')
  assert.equal(api.stageFacing('LEARNING', false), '巩固中')
})

test('learn copy stays bilingual and does not ship sample courses', () => {
  const zh = copy.learnPageCopy(false)
  const en = copy.learnPageCopy(true)
  assert.equal(zh.title, '课程')
  assert.equal(en.title, 'Courses')
  assert.equal(zh.taskClosed, '可浏览课程，完成记录暂不可用。')
  assert.equal(zh.reviewCount, '待复习 {count} 项')
  assert.equal(zh.retry, '重试')
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const table of [zh, en]) {
    const blob = Object.values(table).join('\n')
    assert.equal(blob.includes('日常英语'), false)
    assert.equal(blob.includes('听力入门'), false)
    assert.equal(blob.includes('约 2 小时'), false)
    assert.equal(blob.includes('打招呼'), false)
    assert.equal(blob.includes('{count}'), true)
  }
})

test('learn page keeps the closed read path and does not render hidden answers', () => {
  assert.match(page, /mobileLearnerContentApi\.readContent\(normalized/)
  assert.doesNotMatch(page, /learnerContent\.completeTask\(/)
  assert.doesNotMatch(page, /option\.key/)
  assert.doesNotMatch(page, /option\.text/)
  assert.match(page, /data-learn-surface/)
  assert.match(page, /data-learn-shelf/)
  assert.match(page, /data-learn-detail/)
  assert.match(page, /v-if="surface === 'shelf'"/)
  assert.match(page, /v-else class="learn-detail"/)
  assert.match(page, /consumePendingNavigationQuery\('\/pages\/learn\/learn'\)/)
  assert.match(page, /ensureMobilePageAccess\('\/pages\/learn\/learn'\)/)
  assert.doesNotMatch(page, /getUniRuntime\(/)
  assert.doesNotMatch(page, /navigateTo\(/)
  const sync = page.slice(page.indexOf('async function syncPage'), page.indexOf('function invalidateOwner'))
  const ensureAt = sync.indexOf("ensureMobilePageAccess('/pages/learn/learn')")
  const ownerAt = sync.indexOf('if (!currentOwner()) return')
  const shelfAt = sync.indexOf('await loadShelf()')
  const intentAt = sync.indexOf('takeIntent()')
  assert.ok(ensureAt >= 0)
  assert.ok(ownerAt > ensureAt)
  assert.ok(shelfAt > ownerAt)
  assert.ok(intentAt > shelfAt)
  assert.equal(sync.includes('navigateTo'), false)
  assert.match(page, /data-review-empty/)
  assert.match(page, /data-review-history/)
  assert.match(page, /reviewEmpty/)
  assert.match(page, /data-stage-projection/)
  assert.match(page, /data-stage/)
  assert.match(page, /STAGE_PROJECTION/)
  assert.match(page, /data-weakness-unknown/)
  assert.match(page, /data-weakness-evidence/)
  assert.match(page, /weaknessView/)
  assert.match(page, /reviewFailureCopy/)
  assert.doesNotMatch(page, /b11-listening/)
  assert.doesNotMatch(page, /b11-speaking/)
  assert.doesNotMatch(page, />UNTRUSTED_REVIEW_EVIDENCE</)
  assert.doesNotMatch(page, /日常英语/)
  assert.doesNotMatch(page, /约 2 小时/)
  assert.doesNotMatch(page, /imgIconClock/)
  assert.doesNotMatch(page, /imgIconCheckCircle/)
  assert.doesNotMatch(page, /imgIconHouse/)
  assert.doesNotMatch(page, /imgIconUser/)
})
