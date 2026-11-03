import assert from 'node:assert/strict'
import test from 'node:test'
import { closedNoticeRegion, loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b11-speaking/b11-speaking.vue'

test('MB032 b11-speaking gates the hidden load path and does not request the microphone', async () => {
  const unauth = loadClosedPage(pagePath, { authenticated: false })
  await unauth.test.load()
  assert.deepEqual(unauth.calls.navigate, ['/pages/login/login'])
  assert.deepEqual(unauth.calls.store, [])

  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.equal(page.calls.permissions, 0)
  assert.deepEqual(page.calls.store, [])
})

test('MB032 b11-speaking delegates l09 assets and keeps recording disabled', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  const notice = closedNoticeRegion(page.template, '<B11StatusPanel')
  assert.match(notice, /variant="speaking"/u)
  assert.match(notice, /title-key="closed\.b11Speaking\.title"/u)
  assert.match(notice, /description-key="closed\.b11Speaking\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-6160\/88a1fd7a-bbb3-4189-a4b9-e4faf5e11822\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-6160\/3d832733-5146-41f7-b495-52259359d487\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(notice, /B11StatusPanel/u)
  assert.match(page.source, /mobileT\('closed\.b11Speaking\.navTitle'\)/u)
  assert.match(page.source, /237c0686-acee-476b-97dd-0743926e7055\.svg/u)
  assert.match(page.source, /76a0b677-f745-483d-801f-87719e42e7f9\.svg/u)
  assert.match(page.source, /a24dc873-e7f9-49c5-b94e-e6f758ccf2ba\.svg/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)

  page.test.startRecording()
  assert.equal(page.calls.permissions, 0)
  assert.match(page.calls.storeMessages.at(-1) ?? '', /暂无可练习的跟读片段/u)
  page.test.backToLearning()
  page.test.openRelated('/pages/b3-reading/b3-reading')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b3-reading/b3-reading'])

  await page.test.load()
  assert.deepEqual(page.calls.store, ['loadPhonetics'])
})
