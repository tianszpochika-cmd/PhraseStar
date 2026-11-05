import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { closedNoticeRegion, loadClosedPage } from './closed-page-test-harness.mjs'

const root = new URL('../', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')
const pagePath = 'src/pages/b3-writing/b3-writing.vue'

test('B3 mobile writing does not render taskText twice when sourceText falls back to it', async () => {
  const source = await read(pagePath)
  assert.match(source, /const sourceText = computed\(\(\) => \{/u)
  assert.match(source, /if \(!prompt\?\.sourceText \|\| prompt\.sourceText === prompt\.taskText\) return null/u)
  assert.match(source, /<text v-if="sourceText" class="b10-writing-card__source">\{\{ sourceText \}\}<\/text>/u)
  assert.doesNotMatch(source, /v-if="selectedPrompt\?\.sourceText"[^>]*>\{\{ selectedPrompt\.sourceText \}\}/u)
})

test('B3 mobile writing keeps the authenticated recovery and draft-preservation seams', async () => {
  const source = await read(pagePath)
  assert.match(source, /await session\.restore\(\)/u)
  assert.match(source, /persistDraft\(\)/u)
  assert.match(source, /写作提交失败，草稿仍保留/u)
  assert.match(source, /yx\.b10\.mobile\.writing\.draft\.v1/u)
  assert.match(source, /closed practice: no live load/u)
})

test('B3 mobile writing delegates the m01 closed body and keeps manifest assets', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  const notice = closedNoticeRegion(page.template, '<B10StatusPanel')
  assert.match(notice, /variant="writing"/u)
  assert.match(notice, /title-key="closed\.writing\.title"/u)
  assert.match(notice, /description-key="closed\.writing\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /\/static\/figma-closed-168-6945\/b58014db-d97f-4102-b67a-add6a602160c\.svg/u)
  assert.match(notice, /\/static\/figma-closed-168-6945\/3cfa29d3-5518-43db-9c68-8ddefe5c9e9a\.svg/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(notice, /<textarea/u)
  assert.doesNotMatch(notice, /@click="submit"/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/160841d4-c5ed-477c-889d-09d66d800524\.svg/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/a2fb823f-a42c-4ae9-9e76-da240a0d712a\.svg/u)
  assert.match(page.source, /\/static\/figma-closed-168-6945\/3c5187e8-0de1-47b7-a99f-096226453a9f\.svg/u)
  assert.match(page.source, /target: '\/pages\/b2-vocabulary\/b2-vocabulary'/u)
  assert.match(page.source, /target: '\/pages\/b3-reading\/b3-reading'/u)
  assert.equal(page.calls.api.length, 0)
})

test('B3 mobile writing routes unauthenticated users to login and keeps both exits working', async () => {
  const unauth = loadClosedPage(pagePath, { authenticated: false })
  await unauth.mounted[0]()
  assert.deepEqual(unauth.calls.ensure, ['/pages/b3-writing/b3-writing'])
  assert.deepEqual(unauth.calls.navigate, [])
  assert.equal(unauth.calls.api.length, 0)

  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.equal(page.calls.api.length, 0)
  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
})

test('B3 mobile writing uses shared mobileT keys and no hardcoded decorative colors', async () => {
  const source = await read(pagePath)
  assert.match(source, /mobileT\('closed\.writing\.navTitle'\)/u)
  assert.match(source, /mobileT\('closed\.(?:writing|alternatives)\./u)
  assert.doesNotMatch(source, /mobileT\('mobile\./u)
  assert.doesNotMatch(source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(source, /rgba?\(/u)
})
