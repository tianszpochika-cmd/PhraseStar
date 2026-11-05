import assert from 'node:assert/strict'
import test from 'node:test'
import { closedNoticeRegion, loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b3-listening/b3-listening.vue'

test('MB029 b3-listening gates unauthenticated users before rendering closed content', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  assert.equal(page.mounted.length, 1)
  await page.mounted[0]()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.ensure, ['/pages/b3-listening/b3-listening'])
  assert.deepEqual(page.calls.navigate, [])
  assert.equal(page.calls.api.length, 0)
})

test('MB029 b3-listening delegates k01 assets and never opens the player', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  await page.mounted[0]()
  const notice = closedNoticeRegion(page.template, '<B2StatusPanel')
  assert.match(notice, /variant="listening"/u)
  assert.match(notice, /title-key="closed\.b3Listening\.title"/u)
  assert.match(notice, /description-key="closed\.listening\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-3746\/055e2e46-2327-4a80-8732-dc6ba0135825\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-3746\/7473ba78-43b2-49ac-949f-bf252f5b027c\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(notice, /B2StatusPanel/u)
  assert.match(page.source, /mobileT\('closed\.b3Listening\.navTitle'\)/u)
  assert.match(page.source, /c783b91a-2153-42e2-acc6-7d5c181423e8\.svg/u)
  assert.match(page.source, /afc85b52-a417-48b4-a07c-4f301dc9a259\.svg/u)
  assert.match(page.source, /1ad156ec-6c46-46a7-afde-69003eae8577\.svg/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)

  assert.equal(page.calls.api.length, 0)
  page.test.playAudio()
  assert.equal(page.calls.audioContexts, 0)
  assert.match(page.refs.message.value, /未伪造/u)
  await page.test.submit()
  assert.equal(page.calls.api.filter((call) => call.name === 'submitDictation').length, 0)
  page.test.backToLearning()
  page.test.openRelated('/pages/b3-reading/b3-reading')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b3-reading/b3-reading'])
})
