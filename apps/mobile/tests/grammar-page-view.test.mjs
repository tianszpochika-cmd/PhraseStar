import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const ts = require('typescript')
const root = path.resolve(import.meta.dirname, '../../..')
const viewPath = path.join(root, 'apps/mobile/src/domain/grammar-view.ts')
const pagePath = path.join(root, 'apps/mobile/src/pages/b3-grammar/b3-grammar.vue')
const copyPath = path.join(root, 'packages/i18n/src/mobile-resources/grammar-page.ts')
const assetDir = path.join(root, 'apps/mobile/src/static/figma-grammar-core')

const transpiled = ts.transpileModule(fs.readFileSync(viewPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  fileName: viewPath,
}).outputText
const transpiledPath = path.join(os.tmpdir(), `grammar-view-${process.pid}.mjs`)
fs.writeFileSync(transpiledPath, transpiled)
const view = await import(pathToFileURL(transpiledPath).href)
const page = fs.readFileSync(pagePath, 'utf8')
const copy = fs.readFileSync(copyPath, 'utf8')
const template = page.slice(page.indexOf('<template>'), page.lastIndexOf('</template>'))
const practiceAt = template.indexOf('v-else-if="practiceVisible && exercise"')
const exerciseAt = template.indexOf('id="grammar-exercise"')
const optionAt = template.indexOf('class="grammar-option"')

test('grammar view starts on the list and back tracks the real screen', () => {
  assert.equal(view.grammarInitialView(), 'list')
  assert.equal(view.grammarViewBack('list', false), 'navigate')
  assert.equal(view.grammarViewBack('detail', false), 'list')
  assert.equal(view.grammarViewBack('structure', false), 'detail')
  assert.equal(view.grammarViewBack('practice', false), 'detail')
  assert.equal(view.grammarViewBack('practice', true), 'navigate')
  assert.equal(view.grammarViewBack('list', true), 'navigate')
  assert.equal(view.grammarShowsPractice('practice'), true)
  assert.equal(view.grammarShowsPractice('detail'), false)
  assert.equal(view.grammarShowsPractice('list'), false)
  assert.equal(view.grammarShowsPractice('structure'), false)
})

test('example paging uses only real examples', () => {
  const one = view.grammarExamplePage(['The book that you lent me is on the desk.'], 0)
  assert.deepEqual(one, { text: 'The book that you lent me is on the desk.', index: 0, total: 1 })
  assert.equal(view.grammarExamplePage(['  ', ''], 0), null)
  assert.equal(view.grammarExamplePage([], 0), null)
  const two = view.grammarExamplePage([' first ', 'second'], 1)
  assert.equal(two.total, 2)
  assert.equal(two.text, 'second')
  assert.equal(view.grammarExamplePage(['only'], 4).total, 1)
})

test('prerequisite titles come only from loaded points', () => {
  const points = [{ grammarPointId: 701, title: '定语从句: that 与 which' }]
  assert.deepEqual(view.grammarPrerequisiteTitles([], points), [])
  assert.deepEqual(view.grammarPrerequisiteTitles([0, -1, 1.5, 999], points), [])
  assert.deepEqual(view.grammarPrerequisiteTitles([701], points), ['定语从句: that 与 which'])
  assert.deepEqual(view.grammarPrerequisiteTitles([701, 701], [{ grammarPointId: 701, title: '  ' }]), [])
})

test('route match accepts the live page path and rejects an empty stack', () => {
  const pagePath = '/pages/b3-grammar/b3-grammar'
  assert.equal(view.grammarRouteMatches(''), false)
  assert.equal(view.grammarRouteMatches(null), false)
  assert.equal(view.grammarRouteMatches('   '), false)
  assert.equal(view.grammarRouteMatches(pagePath), true)
  assert.equal(view.grammarRouteMatches('pages/b3-grammar/b3-grammar'), true)
  assert.equal(view.grammarRouteMatches(`${pagePath}?grammarPointId=701`), true)
  assert.equal(view.grammarRouteMatches(`${pagePath}#ready`), true)
  assert.equal(view.grammarRouteMatches(`/prefix${pagePath}`), true)
  assert.equal(view.grammarRouteMatches('/pages/home/home'), false)
})

test('view assets are the original 18 grammar files and nothing else', () => {
  const disk = fs.readdirSync(assetDir).filter((name) => name.endsWith('.svg')).sort()
  const referenced = Object.values(view.grammarAssets).map((item) => path.basename(item)).sort()
  assert.equal(disk.length, 18)
  assert.deepEqual(referenced, disk)
  for (const file of Object.values(view.grammarAssets)) {
    assert.equal(file.startsWith('/static/figma-grammar-core/'), true)
    assert.equal(fs.existsSync(path.join(root, 'apps/mobile/src', file)), true)
  }
  assert.equal(view.grammarGlowAsset('list', false).endsWith('7d8ddd9f-8e44-4606-803d-fb095892e35b.svg'), true)
  assert.equal(view.grammarGlowAsset('detail', false).endsWith('c3f87348-fdf4-4f20-9e16-f6796a5648e0.svg'), true)
  assert.equal(view.grammarGlowAsset('structure', false).endsWith('324455d9-9454-4818-91d6-1c5e12fc6ef7.svg'), true)
  assert.equal(view.grammarGlowAsset('practice', false).endsWith('811a170a-2446-4896-9b5a-72a281e74550.svg'), true)
  assert.equal(view.grammarGlowAsset('detail', true).endsWith('b1d0c25e-0343-4bd3-9d78-7bf60fdc0c40.svg'), true)
  assert.equal(new Set([view.grammarPointIcon(0), view.grammarPointIcon(1), view.grammarPointIcon(2)]).size, 3)
})

test('the page keeps list, detail, and practice as separate states', () => {
  assert.equal(page.includes('points.value[0]'), false)
  assert.equal(page.includes("screen.value = 'detail'"), true)
  assert.equal(page.includes('grammarInitialView()'), true)
  assert.match(page, /data-grammar-view="screen"/u)
  assert.ok(practiceAt > 0)
  assert.ok(exerciseAt > practiceAt)
  assert.ok(optionAt > exerciseAt)
  assert.equal(template.indexOf('class="grammar-option"'), optionAt)
  assert.equal(template.slice(0, practiceAt).includes('grammar-option'), false)
  assert.equal(template.slice(0, practiceAt).includes('id="grammar-exercise"'), false)
  assert.match(page, /v-if="screen === 'list' && points\.length"/u)
  assert.match(page, /v-else-if="screen === 'detail' && activePoint"/u)
  assert.match(page, /v-else-if="screen === 'structure' && activePoint"/u)
  assert.match(page, /examplePage && examplePage\.total > 1/u)
  assert.doesNotMatch(page, /position:\s*fixed/u)
  assert.match(page, /class="grammar-footer"/u)
  assert.match(page, /<view class="grammar-scroll">/u)
  assert.match(page, /\.v2-grammar-page\.b10-theme--high-contrast \.grammar-button\.grammar-primary\{background-color:var\(--closed-cta-background\);background-image:none;color:var\(--closed-cta-on\);box-shadow:none\}/u)
  const listBranch = template.slice(template.indexOf("screen === 'list' && points.length"), template.indexOf("screen === 'detail'"))
  assert.match(listBranch, /class="grammar-hero"/u)
  assert.equal(template.replace(listBranch, '').includes('class="grammar-hero"'), false)
  assert.equal((template.match(/class="grammar-detail-title grammar-heading" role="heading" aria-level="2" tabindex="-1"/g) ?? []).length, 2)
  assert.match(template, /class="grammar-question grammar-heading" role="heading" aria-level="2" tabindex="-1"/u)
  assert.match(page, /querySelector\('\.v2-grammar-page \.grammar-heading'\)/u)
})

test('practice still requires an explicit start and a saved receipt', () => {
  assert.match(page, /if \(!isCurrent\(scope\) \|\| !activePoint\.value \|\| screen\.value === 'list'\) return/u)
  assert.match(page, /sessionCache\.get\(point\.grammarPointId\)/u)
  assert.match(page, /await b10LearningApi\.createGrammarSession\(context\.value, point\.grammarPointId, point\.contentVersionId/u)
  assert.match(page, /await b10LearningApi\.submitGrammarAnswer[\s\S]{0,280}!result\.savedReceipt/u)
  assert.equal((page.match(/!result\.savedReceipt/g) ?? []).length >= 2, true)
  assert.match(page, /if \(!selectedOption\.value\) \{ message\.value = grammarT\('answerRequired'\)/u)
  assert.equal(page.includes('grammar-unbound'), true)
  assert.match(page, /createGrammarSession\(context\.value, 0, null, createB10ClientEventId\('grammar-unbound'\)\)/u)
  assert.match(page, /loose\.exercises\.length \? 'ready' : 'empty'/u)
  assert.match(page, /const nextGraph = await b10LearningApi\.getSentenceGraph/u)
})

test('owner and route are checked after each await, and hide stays page-local', () => {
  for (const call of ['listGrammarPoints', 'getSentenceGraph', 'createGrammarSession', 'submitGrammarAnswer']) {
    assert.match(page, new RegExp(`await b10LearningApi\\.${call}[\\s\\S]{0,320}requestId !== grammarSelectionRequest`, 'u'))
  }
  assert.match(page, /function routeAllowsPaint\(\): boolean/u)
  assert.match(page, /grammarRouteMatches\(typeof route === 'string' \? route : '', PAGE_PATH\)/u)
  assert.match(page, /onHide\(\(\) => \{ visible\.value = false; unbindBackCapture\(\); grammarSelectionRequest \+= 1; sessionCache\.clear\(\); clearTransient\(\)/u)
  assert.equal(page.includes('getCurrentPages ='), false)
  assert.equal(page.includes('HTMLElement.prototype'), false)
  assert.match(page, /deeplinkPointId = null/u)
  assert.equal(page.includes('draft.selectedPointId') && page.includes('openDetail(linked)'), true)
  assert.equal(page.includes('points.value.find((point) => point.grammarPointId === draft'), false)
})

test('header back retreats inside the page and does not open another session', () => {
  assert.match(page, /function retreat\(\): void/u)
  assert.match(page, /grammarSelectionRequest \+= 1/u)
  assert.match(page, /document\.addEventListener\('click', interceptHeaderBack, true\)/u)
  assert.match(page, /if \(grammarViewBack\(screen\.value, catalogOnly\.value\) === 'navigate'\) return/u)
  assert.equal(page.slice(page.indexOf('function retreat'), page.indexOf('function interceptHeaderBack')).includes('createGrammarSession'), false)
  assert.equal(page.slice(page.indexOf('function retreat'), page.indexOf('function interceptHeaderBack')).includes('submitGrammarAnswer'), false)
})

test('copy adds the three help notes without a fabricated example or lesson', () => {
  for (const key of ['tipLowTitle', 'tipContainsTitle', 'tipUpdatesTitle', 'masteryLabel', 'masteryValue', 'examplePage', 'examplePrevious', 'exampleNext']) {
    assert.equal((copy.match(new RegExp(`${key}:`, 'g')) ?? []).length, 2)
  }
  assert.equal(copy.includes('从掌握度低的开始'), true)
  assert.equal(copy.includes('Sentence lab'), true)
  assert.equal(copy.includes('3 道题'), false)
  assert.equal(copy.includes('The book that'), false)
  assert.equal(copy.includes('语法知识点'), false)
})
