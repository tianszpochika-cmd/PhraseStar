import assert from 'node:assert/strict'
import test from 'node:test'
import { closedNoticeRegion, loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b11-listening/b11-listening.vue'

test('MB030 b11-listening keeps the closed page from loading media without a session', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  await page.test.load()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.navigate, ['/pages/login/login'])
  assert.deepEqual(page.calls.store, [])
})

test('MB030 b11-listening delegates k08 assets and blocks revoked playback', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.deepEqual(page.calls.store, [])
  assert.equal(page.calls.permissions, 0)

  const notice = closedNoticeRegion(page.template, '<B11StatusPanel')
  assert.match(notice, /variant="listening"/u)
  assert.match(notice, /title-key="closed\.b11Listening\.title"/u)
  assert.match(notice, /description-key="closed\.listening\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-4327\/235a9127-86dc-4f14-b784-028d2b50ce74\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-4327\/39e8258c-9396-4ce3-8d3b-286415020f26\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(notice, /B11StatusPanel/u)
  assert.match(page.source, /mobileT\('closed\.b11Listening\.navTitle'\)/u)
  assert.match(page.source, /d91329fd-0c05-46c3-9a5d-f300190c7d9b\.svg/u)
  assert.match(page.source, /050695e7-7f3d-4007-9760-3d89c94e6725\.svg/u)
  assert.match(page.source, /4e7c093b-c2f2-44c5-b33b-4f4877a79499\.svg/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)

  page.store.mediaRightsState = 'REVOKED'
  page.test.play()
  assert.equal(page.calls.audioContexts, 0)
  assert.match(page.refs.pageMessage.value, /listening\.revoked/u)

  await page.test.load()
  assert.deepEqual(page.calls.store, ['loadListening'])
  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
})
