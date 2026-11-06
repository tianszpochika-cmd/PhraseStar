import assert from 'node:assert/strict'
import test from 'node:test'
import { closedNoticeRegion, loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b3-speaking/b3-speaking.vue'

test('MB031 b3-speaking gates unauthenticated users without requesting recording services', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  await page.mounted[0]()
  assert.deepEqual(page.calls.navigate, ['/pages/login/login'])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
})

test('MB031 b3-speaking delegates l01 assets and keeps recording disabled', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.equal(page.calls.api.length, 0)

  const notice = closedNoticeRegion(page.template, '<B2StatusPanel')
  assert.match(notice, /variant="speaking"/u)
  assert.match(notice, /title-key="closed\.b3Speaking\.title"/u)
  assert.match(notice, /description-key="closed\.b3Speaking\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-5501\/abaf7a75-11e2-4a95-b329-8bc1452320fe\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-5501\/679cf7aa-0ce1-4ae7-8caf-70db9789cc07\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(notice, /B2StatusPanel/u)
  assert.match(page.source, /mobileT\('closed\.b3Speaking\.navTitle'\)/u)
  assert.match(page.source, /2873e8dd-acf2-4903-a2e0-e1046ba5166d\.svg/u)
  assert.match(page.source, /7f0256b5-f3cd-4635-b4d3-3d4b7045a127\.svg/u)
  assert.match(page.source, /261b7c3f-f474-4abd-9e23-dff819c47d2b\.svg/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)

  page.test.startRecording()
  assert.equal(page.calls.api.filter((call) => call.name === 'createRecording').length, 0)
  assert.match(page.refs.message.value, /没有可用录音管理器/u)
  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
})
