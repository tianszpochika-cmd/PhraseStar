import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

function load(path) {
  const source = readFileSync(resolve(path), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error('closed-practice must stay dependency free')
  }, module, module.exports)
  return module.exports
}

const web = load('apps/learner-web/src/domain/closed-practice.ts')
const mobile = load('apps/mobile/src/domain/closed-practice.ts')

for (const [name, api] of [['web', web], ['mobile', mobile]]) {
  test(`${name} hides a play control without audio and names closed skills`, () => {
    assert.equal(api.vocabPlayable(null), false)
    assert.equal(api.vocabPlayable('  '), false)
    assert.equal(api.vocabPlayable('https://cdn.example/a.mp3'), true)
    assert.equal(api.closedPracticeCopy('listening'), '听力练习即将开放：音频素材尚未上传到媒体库，播放地址无法签发；素材上线后即可在这里播放并听写')
    assert.equal(api.closedPracticeCopy('speaking'), '跟读练习即将开放：跟读需要录音上传和发音评分服务，目前尚未接入，无法给出真实评分')
    assert.equal(api.closedPracticeCopy('writing'), '写作练习即将开放：作文批改服务尚未接入，现在提交只能得到占位分数，不能作为真实反馈')
  })
}

test('main navigation drops closed skills and old pages explain how to leave', () => {
  const shell = readFileSync(resolve('apps/learner-web/src/layouts/AppShell.vue'), 'utf8')
  const home = readFileSync(resolve('apps/learner-web/src/pages/HomePage.vue'), 'utf8')
  const grid = readFileSync(resolve('apps/mobile/src/components/MobileFeatureGrid.vue'), 'utf8')
  const learn = readFileSync(resolve('apps/mobile/src/pages/learn/learn.vue'), 'utf8')
  for (const source of [shell, home]) {
    assert.doesNotMatch(source, /b3-listening/)
    assert.doesNotMatch(source, /b3-speaking/)
    assert.doesNotMatch(source, /b3-writing/)
  }
  assert.doesNotMatch(grid, /b11-listening/)
  assert.doesNotMatch(grid, /b11-speaking/)
  assert.doesNotMatch(grid, /b3-writing/)
  assert.doesNotMatch(learn, /b11-listening/)
  assert.doesNotMatch(learn, /b11-speaking/)
  for (const path of [
    'apps/learner-web/src/pages/B3ListeningPage.vue',
    'apps/learner-web/src/pages/B3SpeakingPage.vue',
    'apps/learner-web/src/pages/B3WritingPage.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /data-closed-practice/)
    assert.match(source, /data-closed-back/)
    assert.match(source, /data-coming-soon[^>]*>即将开放</)
    assert.match(source, /data-closed-reason/)
  }
  const notice = readFileSync(resolve('apps/mobile/src/components/MobileClosedPracticeNotice.vue'), 'utf8')
  assert.match(notice, /data-closed-practice/)
  assert.match(notice, /data-closed-back/)
  assert.match(notice, /data-closed-reason/)
  assert.match(notice, /data-coming-soon/)
  assert.match(notice, /mobileT\(props\.badgeKey \?\? 'closed\.comingSoon'\)/)
  assert.match(notice, /mobileT\(props\.ctaKey \?\? 'closed\.backToAvailableLearning'\)/)
  for (const path of [
    'apps/mobile/src/pages/b3-listening/b3-listening.vue',
    'apps/mobile/src/pages/b3-speaking/b3-speaking.vue',
    'apps/mobile/src/pages/b3-writing/b3-writing.vue',
    'apps/mobile/src/pages/b11-listening/b11-listening.vue',
    'apps/mobile/src/pages/b11-speaking/b11-speaking.vue',
  ]) {
    const source = readFileSync(resolve(path), 'utf8')
    assert.match(source, /<MobileClosedPracticeNotice/)
    assert.match(source, /@back="backToLearning"/)
    assert.match(source, /@select="openRelated"/)
    assert.match(source, /navigateTo\(\{ url: '\/pages\/today\/today' \}\)/)
    assert.match(source, /target: '\/pages\/b2-vocabulary\/b2-vocabulary'/)
    assert.match(source, /target: '\/pages\/b3-reading\/b3-reading'/)
  }
  const listening = readFileSync(resolve('apps/learner-web/src/pages/B3ListeningPage.vue'), 'utf8')
  assert.match(listening, /class="waveform"/)
  const webVocab = readFileSync(resolve('apps/learner-web/src/pages/VocabularyPage.vue'), 'utf8')
  assert.match(webVocab, /vocabPlayable/)
  assert.match(webVocab, /data-vocab-play/)
  assert.match(webVocab, /data-vocab-silent/)
  const mobileVocab = readFileSync(resolve('apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue'), 'utf8')
  assert.match(mobileVocab, /vocabPlayable/)
  assert.match(mobileVocab, /v-if="view\.audioMode === 'play'"/)
  assert.match(mobileVocab, /@click="playAudio"/)
  assert.match(mobileVocab, /mobileT\('vocabularyPage\.noAudio'\)/)
  assert.match(mobileVocab, /mobileT\('vocabularyPage\.audioFailed'\)/)
  assert.doesNotMatch(mobileVocab, /data-vocab-play|data-vocab-silent/)
})
