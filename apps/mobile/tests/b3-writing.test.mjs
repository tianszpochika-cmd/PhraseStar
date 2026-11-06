import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadClosedPage } from './closed-page-test-harness.mjs'

const root = new URL('../', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')
const pagePath = 'src/pages/b3-writing/b3-writing.vue'

function noticeRegion(template) {
  const start = template.indexOf('<MobileClosedPracticeNotice')
  const end = template.indexOf('/>', start)
  assert.ok(start >= 0 && end > start)
  return template.slice(start, end)
}

test('MB033 b3-writing leaves retained drafts untouched and does not call writing APIs', async () => {
  const source = await read(pagePath)
  assert.match(source, /await session\.restore\(\)/u)
  assert.match(source, /ensureMobilePageAccess\('\/pages\/b3-writing\/b3-writing'\)/u)
  assert.match(source, /closed practice: no live load/u)
  assert.doesNotMatch(source, /yx\.b10\.mobile\.writing\.draft\.v1/u)
  assert.doesNotMatch(source, /getStorageSync|setStorageSync|removeStorageSync|persistDraft|restoreDraft|discardDraft/u)
  assert.doesNotMatch(source, /listWritingPrompts|submitWriting|submitCorrection|b10LearningApi/u)
  assert.doesNotMatch(source, /function\s+(?:load|submit|selectPrompt|onInput|persistDraft|restoreDraft|discardDraft)\s*\(/u)
})

test('MB033 b3-writing delegates the m01 closed body and keeps manifest assets', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  const notice = noticeRegion(page.template)
  assert.match(notice, /variant="writing"/u)
  assert.match(notice, /title-key="closed\.writing\.title"/u)
  assert.match(notice, /description-key="closed\.writing\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /\/static\/figma-closed-168-6945\/b58014db-d97f-4102-b67a-add6a602160c\.svg/u)
  assert.match(notice, /\/static\/figma-closed-168-6945\/3cfa29d3-5518-43db-9c68-8ddefe5c9e9a\.svg/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(page.template, /<AppIcon|B10StatusPanel|B10FeedbackCard|<textarea|@click="submit"|@click="load"|重试/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/160841d4-c5ed-477c-889d-09d66d800524\.svg/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/a2fb823f-a42c-4ae9-9e76-da240a0d712a\.svg/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/3c5187e8-0de1-47b7-a99f-096226453a9f\.svg/u)
  assert.match(page.source, /target: '\/pages\/b2-vocabulary\/b2-vocabulary'/u)
  assert.match(page.source, /target: '\/pages\/b3-reading\/b3-reading'/u)
  assert.equal(page.calls.api.length, 0)
  assert.equal(typeof page.test.load, 'undefined')
  assert.equal(typeof page.test.submit, 'undefined')
})

test('MB033 b3-writing routes unauthenticated users to login and keeps both exits working', async () => {
  const unauth = loadClosedPage(pagePath, { authenticated: false })
  await unauth.mounted[0]()
  assert.equal(unauth.calls.sessionRestore, 1)
  assert.deepEqual(unauth.calls.ensure, ['/pages/b3-writing/b3-writing'])
  assert.deepEqual(unauth.calls.navigate, [])
  assert.equal(unauth.calls.api.length, 0)

  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.ensure, ['/pages/b3-writing/b3-writing'])
  assert.equal(page.calls.api.length, 0)
  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
  assert.equal(page.calls.api.length, 0)
})

test('MB033 b3-writing uses shared mobileT keys and no hardcoded decorative colors', async () => {
  const source = await read(pagePath)
  assert.match(source, /mobileT\('closed\.writing\.navTitle'\)/u)
  assert.match(source, /mobileT\('closed\.(?:writing|alternatives)\./u)
  assert.doesNotMatch(source, /mobileT\('mobile\./u)
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(source, /rgba?\(/u)
})
