import assert from 'node:assert/strict'
import test from 'node:test'
import { loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b3-speaking/b3-speaking.vue'

function noticeRegion(template) {
  const start = template.indexOf('<MobileClosedPracticeNotice')
  const end = template.indexOf('/>', start)
  assert.ok(start >= 0 && end > start)
  return template.slice(start, end)
}

test('MB031 b3-speaking gates unauthenticated users without requesting recording services', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  await page.mounted[0]()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.ensure, ['/pages/b3-speaking/b3-speaking'])
  assert.deepEqual(page.calls.navigate, [])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.equal(page.calls.permissions, 0)
})

test('MB031 b3-speaking delegates l01 assets and keeps recording disabled', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.ensure, ['/pages/b3-speaking/b3-speaking'])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.equal(page.calls.permissions, 0)

  const notice = noticeRegion(page.template)
  assert.match(notice, /variant="speaking"/u)
  assert.match(notice, /title-key="closed\.b3Speaking\.title"/u)
  assert.match(notice, /description-key="closed\.b3Speaking\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-5501\/abaf7a75-11e2-4a95-b329-8bc1452320fe\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-5501\/679cf7aa-0ce1-4ae7-8caf-70db9789cc07\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(page.template, /<AppIcon|B2StatusPanel|@click=/u)
  assert.doesNotMatch(page.source, /function\s+(?:load|loadDemoAudio|playDemoAudio|startRecording|stopRecording|saveRecording|openRoleplay|advanceRoleplay|setRating|playLocal)\s*\(/u)
  assert.match(page.source, /mobileT\('closed\.b3Speaking\.navTitle'\)/u)
  assert.match(page.source, /2873e8dd-acf2-4903-a2e0-e1046ba5166d\.svg/u)
  assert.match(page.source, /7f0256b5-f3cd-4635-b4d3-3d4b7045a127\.svg/u)
  assert.match(page.source, /261b7c3f-f474-4abd-9e23-dff819c47d2b\.svg/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)
  assert.equal(typeof page.test.startRecording, 'undefined')
  assert.equal(typeof page.test.playDemoAudio, 'undefined')
  assert.equal(typeof page.test.load, 'undefined')

  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.equal(page.calls.permissions, 0)
})
