import assert from 'node:assert/strict'
import test from 'node:test'
import { loadClosedPage } from './closed-page-test-harness.mjs'

const pagePath = 'src/pages/b11-listening/b11-listening.vue'

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

test('MB030 b11-listening does not add a route-level session fallback or media access', async () => {
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
  assert.doesNotMatch(page.source, /ensureMobilePageAccess|useSessionStore|loadB11ListeningMaterials|authorizeB11Playback|createInnerAudioContext|enableUniAudioPitchPreservation/u)
  assert.doesNotMatch(page.source, /\bstore\.(?:restore|loadListening|loadPhonetics|loadReading|saveMediaProgress|setPerformance|setMotionDisabled)\s*\(/u)
})

test('MB030 b11-listening delegates k08 assets and exposes only the closed exits', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  assert.equal(page.mounted.length, 0)
  assert.deepEqual(page.calls.store, [])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.equal(page.calls.permissions, 0)
  assert.deepEqual(page.calls.ensure, [])

  const notice = noticeRegion(page.template)
  assert.match(notice, /variant="listening"/u)
  assert.match(notice, /title-key="closed\.b11Listening\.title"/u)
  assert.match(notice, /description-key="closed\.listening\.reason"/u)
  assert.match(notice, /:alternatives="alternatives"/u)
  assert.match(notice, /@back="backToLearning"/u)
  assert.match(notice, /@select="openRelated"/u)
  assert.match(notice, /glow-src="\/static\/figma-closed-168-4327\/235a9127-86dc-4f14-b784-028d2b50ce74\.svg"/u)
  assert.match(notice, /icon-src="\/static\/figma-closed-168-4327\/39e8258c-9396-4ce3-8d3b-286415020f26\.svg"/u)
  assert.doesNotMatch(notice, /<AppIcon/u)
  assert.doesNotMatch(page.template, /<AppIcon|B11StatusPanel|@click=/u)
  assert.doesNotMatch(page.source, /function\s+(?:load|play|pause|setRate|setA|setB|selectClip)\s*\(/u)
  assert.match(page.source, /mobileT\('closed\.b11Listening\.navTitle'\)/u)
  assert.match(page.source, /d91329fd-0c05-46c3-9a5d-f300190c7d9b\.svg/u)
  assert.match(page.source, /050695e7-7f3d-4007-9760-3d89c94e6725\.svg/u)
  assert.match(page.source, /4e7c093b-c2f2-44c5-b33b-4f4877a79499\.svg/u)
  assert.match(page.source, /target: '\/pages\/b2-vocabulary\/b2-vocabulary'/u)
  assert.match(page.source, /target: '\/pages\/b3-reading\/b3-reading'/u)
  assert.match(page.source, /navigateTo\(\{ url: '\/pages\/today\/today' \}\)/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)
  assert.equal(typeof page.test.load, 'undefined')
  assert.equal(typeof page.test.play, 'undefined')

  page.test.backToLearning()
  page.test.openRelated('/pages/b2-vocabulary/b2-vocabulary')
  assert.deepEqual(page.calls.navigate, ['/pages/today/today', '/pages/b2-vocabulary/b2-vocabulary'])
  assert.equal(page.calls.api.length, 0)
  assert.equal(page.calls.audioContexts, 0)
  assert.deepEqual(page.calls.store, [])
})
