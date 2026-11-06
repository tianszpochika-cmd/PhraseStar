import assert from 'node:assert/strict'
import test from 'node:test'
import { loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b11-speaking/b11-speaking.vue'

function noticeRegion(template) {
  const start = template.indexOf('<MobileClosedPracticeNotice')
  const end = template.indexOf('/>', start)
  assert.ok(start >= 0 && end > start)
  return template.slice(start, end)
}

const motionExpression = "store.motionDisabled || store.performanceLevel === 'Performance' ? 'off' : experienceMotion"

function liveMotion(store, experienceMotion = 'on') {
  return new Function('store', 'experienceMotion', `return ${motionExpression}`)(store, experienceMotion)
}

test('MB032 b11-speaking does not add a route-level session fallback or recorder access', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  assert.equal(page.mounted.length, 0)
  assert.equal(page.calls.sessionRestore, 0)
  assert.deepEqual(page.calls.ensure, [])
  assert.deepEqual(page.calls.navigate, [])
  assert.deepEqual(page.calls.store, [])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.equal(page.calls.permissions, 0)
  assert.match(page.source, /import \{ useB11LearningStore \} from '\.\.\/\.\.\/stores\/b11-learning'/u)
  assert.match(page.source, /const store = useB11LearningStore\(\)/u)
  assert.match(page.template, new RegExp(`:data-motion="${motionExpression.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'u'))
  assert.equal(liveMotion(page.store), 'on')
  const motionOff = loadClosedPage(pagePath, { store: { motionDisabled: true, performanceLevel: 'High' } })
  const performanceOff = loadClosedPage(pagePath, { store: { motionDisabled: false, performanceLevel: 'Performance' } })
  assert.equal(liveMotion(motionOff.store), 'off')
  assert.equal(liveMotion(performanceOff.store), 'off')
  assert.equal(motionOff.mounted.length, 0)
  assert.equal(performanceOff.mounted.length, 0)
  assert.deepEqual(motionOff.calls.store, [])
  assert.deepEqual(performanceOff.calls.store, [])
  assert.deepEqual(motionOff.calls.ensure, [])
  assert.deepEqual(performanceOff.calls.ensure, [])
  assert.doesNotMatch(page.source, /ensureMobilePageAccess|useSessionStore|requestMicrophonePermission|protectRecording|recorderManager|authorizeB11Playback|createInnerAudioContext/u)
  assert.doesNotMatch(page.source, /\bstore\.(?:restore|loadListening|loadPhonetics|loadReading|saveMediaProgress|setPerformance|setMotionDisabled)\s*\(/u)
})

test('MB032 b11-speaking delegates l09 assets and exposes only the closed exits', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  assert.equal(page.mounted.length, 0)
  assert.equal(page.calls.permissions, 0)
  assert.deepEqual(page.calls.store, [])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.deepEqual(page.calls.ensure, [])

  const notice = noticeRegion(page.template)
  assert.match(notice, /variant="speaking"/u)
  assert.match(notice, /title-key="closed\.b11Speaking\.title"/u)
  assert.match(notice, /description-key="closed\.b11Speaking\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-6160\/88a1fd7a-bbb3-4189-a4b9-e4faf5e11822\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-6160\/3d832733-5146-41f7-b495-52259359d487\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(page.template, /<AppIcon|B11StatusPanel|@click=/u)
  assert.doesNotMatch(page.source, /function\s+(?:load|loadDemoAudio|playDemoAudio|startRecording|stopRecording|requestPermission|playLocal|retake|register|rate)\s*\(/u)
  assert.match(page.source, /mobileT\('closed\.b11Speaking\.navTitle'\)/u)
  assert.match(page.source, /237c0686-acee-476b-97dd-0743926e7055\.svg/u)
  assert.match(page.source, /76a0b677-f745-483d-801f-87719e42e7f9\.svg/u)
  assert.match(page.source, /a24dc873-e7f9-49c5-b94e-e6f758ccf2ba\.svg/u)
  assert.match(page.source, /target: '\/pages\/b2-vocabulary\/b2-vocabulary'/u)
  assert.match(page.source, /target: '\/pages\/b3-reading\/b3-reading'/u)
  assert.match(page.source, /navigateTo\(\{ url: '\/pages\/today\/today' \}\)/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)
  assert.equal(typeof page.test.startRecording, 'undefined')
  assert.equal(typeof page.test.playDemoAudio, 'undefined')
  assert.equal(typeof page.test.load, 'undefined')

  page.test.backToLearning()
  page.test.openRelated('/pages/b3-reading/b3-reading')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b3-reading/b3-reading'])
  assert.equal(page.calls.permissions, 0)
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.deepEqual(page.calls.store, [])
})
