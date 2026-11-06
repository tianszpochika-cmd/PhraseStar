import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const vue = require('vue')
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const appRoot = path.resolve(import.meta.dirname, '..')

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}
function loadTsModule(relativePath) {
  const source = read(relativePath)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error(`unexpected import in ${relativePath}`) }, module, module.exports)
  return module.exports
}
function flatten(value, prefix = '', out = {}) {
  for (const [key, item] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key
    if (item && typeof item === 'object') flatten(item, next, out)
    else out[next] = item
  }
  return out
}
function deferred() {
  let resolve
  let reject
  const promise = new Promise((ok, no) => { resolve = ok; reject = no })
  return { promise, resolve, reject }
}
async function settle() {
  for (let i = 0; i < 40; i += 1) {
    await Promise.resolve()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

const domain = loadTsModule('src/domain/reading-page.ts')
const copyZh = flatten(loadTsModule('../../packages/i18n/src/mobile-resources/reading-page.ts').readingPageCopy(false))
const copyEn = flatten(loadTsModule('../../packages/i18n/src/mobile-resources/reading-page.ts').readingPageCopy(true))

test('reading decisions keep font, owner, version and closed writes honest', () => {
  assert.equal(domain.readingShell('idle'), 'idle')
  assert.equal(domain.readingShell('loading'), 'loading')
  assert.equal(domain.readingShell('revoked'), 'withdrawn')
  assert.equal(domain.READING_SERVER_WRITES.saveReadingProgress, 'closed')
  assert.equal(domain.READING_SERVER_WRITES.submitReadingAttempt, 'closed')
  assert.equal(domain.READING_SERVER_WRITES.mineReadingExpression, 'closed')
  assert.equal(domain.stepReadingFont(100, 1), 110)
  assert.equal(domain.stepReadingFont(200, 1), 200)
  assert.equal(domain.stepReadingFont(100, -1), 100)
  assert.equal(domain.clampReadingFont(95), 100)
  assert.equal(domain.readingFontPx(200, 17, 34), 34)
  assert.equal(domain.readingFontPx(200, 15, 24), 24)
  assert.equal(domain.readingFontPx(100, 15, 24), 15)
  assert.equal(domain.localReadPercent(0, 3), 33)
  assert.equal(domain.clampBlockIndex(9, 2), 1)
  assert.deepEqual(domain.classifyReadingStatus(401), 'auth-401')
  assert.deepEqual(domain.classifyReadingStatus(403), 'auth-403')
  assert.deepEqual(domain.classifyReadingStatus(404), 'stale')
  assert.deepEqual(domain.classifyReadingStatus(409), 'stale')
  assert.deepEqual(domain.classifyReadingStatus(410), 'stale')
  assert.deepEqual(domain.classifyReadingStatus(0), 'offline')
  assert.deepEqual(domain.classifyReadingStatus(500), 'error')
  assert.deepEqual(domain.classifyReadingStatus(-1), 'error')

  const article = {
    articleId: 11,
    title: 'Server article',
    cefrLevel: 'B1',
    wordCount: 2,
    estimatedMinutes: 1,
    blocks: [{ blockId: 'p1', blockIndex: 0, text: 'Visible sentence.', translation: null }],
    rightsStatus: 'AUTHORIZED',
    availability: null,
    contentVersionId: 7,
    contentEpoch: 3,
  }
  assert.equal(domain.articleViewState(article), 'ready')
  assert.equal(domain.articleViewState({ ...article, rightsStatus: 'REVOKED' }), 'revoked')
  assert.equal(domain.articleViewState({ ...article, availability: 'RIGHTS_EXPIRED' }), 'revoked')
  assert.equal(domain.articleViewState({ ...article, availability: 'UNPUBLISHED' }), 'unpublished')
  assert.equal(domain.articleViewState({ ...article, rightsStatus: 'PENDING' }), 'unauthorized-content')
  assert.equal(domain.articleViewState({ ...article, blocks: [{ blockId: 'p1', blockIndex: 0, text: '  ', translation: null }] }), 'empty')
  assert.equal(domain.visibleBlocks({ ...article, rightsStatus: 'REVOKED' }, 'ready').length, 0)
  assert.equal(domain.visibleBlocks(article, 'revoked').length, 0)
  assert.equal(domain.visibleBlocks(article, 'ready').length, 1)
  assert.equal(domain.chooseListedArticleId([{ articleId: 1, rightsStatus: 'REVOKED' }, { articleId: 2, rightsStatus: 'AUTHORIZED' }]), 2)
  assert.equal(domain.chooseListedArticleId([{ articleId: 1, rightsStatus: 'REVOKED' }]), 1)
  assert.equal(domain.readableQuestionCount([{ questionId: 4, stem: 'secret', options: ['a'], correctAnswer: 'a' }, { stem: 'only' }, { questionId: 0 }]), 1)

  const scope = { routeId: 'b3-reading', subject: 'owner-a', articleId: 11, contentVersionId: 7, contentEpoch: 3 }
  const record = domain.localPositionRecord(scope, 1)
  assert.equal(Object.hasOwn(record, 'saved'), false)
  assert.equal(domain.restoreLocalPosition({ ...record, saved: true, blockIndex: 1 }, scope).serverReceipt, null)
  assert.equal(domain.restoreLocalPosition({ ...record, saved: true, blockIndex: 1 }, scope).blockIndex, 1)
  assert.equal(domain.restoreLocalPosition({ ...record, subject: 'other' }, scope), null)
  assert.equal(domain.restoreLocalPosition({ ...record, routeId: 'b11-reading' }, scope), null)
  assert.equal(domain.restoreLocalPosition({ ...record, contentVersionId: 8 }, scope), null)
  assert.equal(domain.restoreLocalPosition({ ...record, contentEpoch: 4 }, scope), null)
  assert.equal(domain.restoreLocalPosition({ ...record, articleId: 12 }, scope), null)

  const permit = {
    visible: true, epoch: 2, requestEpoch: 2, requestId: 5, activeRequestId: 5,
    subject: 'owner-a', liveSubject: 'owner-a', revision: 4, liveRevision: 4,
    adultPassed: true, consentAllowsLearning: true, learningReady: true,
  }
  assert.equal(domain.readStillCurrent(permit), true)
  assert.equal(domain.readStillCurrent({ ...permit, liveRevision: 5 }), false)
  assert.equal(domain.readStillCurrent({ ...permit, subject: '' }), false)
  assert.equal(domain.readStillCurrent({ ...permit, adultPassed: false }), false)
  assert.equal(domain.denialCanRender({ ...permit, adultPassed: false, subject: '' }), true)
  assert.equal(domain.denialCanRender({ ...permit, visible: false }), false)
  const picked = domain.nextWordSelection(1, 'p1', ' Visible ')
  assert.equal(picked.persisted, false)
  assert.equal(picked.generation, 2)
  assert.equal(domain.selectionMatches(picked, 2), true)
  assert.equal(domain.selectionMatches(picked, 1), false)
  assert.equal(domain.readingRouteActive('/pages/b3-reading/b3-reading', '/pages/b3-reading/b3-reading'), true)
  assert.equal(domain.readingRouteActive('pages/b3-reading/b3-reading?from=home', '/pages/b3-reading/b3-reading/'), true)
  assert.equal(domain.readingRouteActive('', '/pages/b3-reading/b3-reading'), false)
  assert.equal(domain.readingRouteActive('/pages/home/home', '/pages/b3-reading/b3-reading'), false)
  assert.equal(domain.readingRouteActive('/pages/b11-reading/b11-reading', '/pages/b3-reading/b3-reading'), false)
})

test('reading copy keeps both locales aligned and does not claim a server receipt', () => {
  assert.deepEqual(Object.keys(copyZh).sort(), Object.keys(copyEn).sort())
  assert.equal(copyZh.titlePractice, '阅读精练')
  assert.equal(copyZh.titleGraded, '分级阅读')
  assert.equal(copyEn.titlePractice, 'Reading practice')
  assert.equal(copyZh.reread, '重新读取文章')
  assert.equal(copyZh.emptyTitle, '暂时没有可读的文章')
  assert.match(copyZh.writesClosed, /没有开放/)
  assert.match(copyZh.noServerReceipt, /没有服务器保存回执/)
  const joined = `${Object.values(copyZh).join('\n')}\n${Object.values(copyEn).join('\n')}`
  assert.doesNotMatch(joined, /已保存的进度以记录为准|已同步|挖掘成功|回答正确|The Quiet Power of Small Habits|A City That Learned to Slow Down/)
})

test('reading ready pages keep one H5 word bypass before paragraph navigation', () => {
  assert.equal(copyZh.skipWords, '跳到上一段和下一段')
  assert.equal(copyEn.skipWords, 'Skip to previous and next paragraph')
  assert.equal(copyZh.paragraphNav, '上一段和下一段')
  assert.equal(copyEn.paragraphNav, 'Previous and next paragraph')
  for (const relative of ['src/pages/b3-reading/b3-reading.vue', 'src/pages/b11-reading/b11-reading.vue']) {
    const page = read(relative)
    const bypass = page.indexOf('class="reading-word-bypass"')
    const words = page.indexOf('<view class="reading-body"')
    const target = page.indexOf('data-reading-paragraph-target')
    const prev = page.indexOf('data-action="prev"')
    const next = page.indexOf('data-action="next"')
    assert.ok(bypass > 0 && bypass < words && words < target && target < prev && prev < next, relative)
    assert.equal(page.split('class="reading-word-bypass"').length, 2)
    assert.equal(page.split('data-reading-paragraph-target').length, 2)
    assert.match(page, /<!-- #ifdef H5 -->\s*<button type="button" class="reading-word-bypass" tabindex="0" role="button"[\s\S]*@keyup\.enter\.stop\.prevent="focusParagraphNav"[\s\S]*@keyup\.space\.stop\.prevent="focusParagraphNav"/)
    assert.match(page, /data-reading-paragraph-target="" tabindex="-1" role="navigation" :aria-label="t\('paragraphNav'\)"/)
    assert.match(page, /data-action="select-word"[\s\S]*:tabindex="h5TabIndex\(true\)"\s+:role="h5ButtonRole\(\)"[\s\S]*@click="chooseWord\(current\.blockId, piece\.value\)"[\s\S]*@keydown\.enter\.stop\.prevent[\s\S]*@keyup\.enter\.stop\.prevent="activateWord\(current\.blockId, piece\.value\)"[\s\S]*@keydown\.space\.stop\.prevent[\s\S]*@keyup\.space\.stop\.prevent="activateWord\(current\.blockId, piece\.value\)"/)
    assert.match(page, /data-action="prev" :tabindex="h5TabIndex\(safeIndex > 0\)" :role="h5ButtonRole\(\)" :aria-disabled="h5AriaDisabled\(safeIndex > 0\)" :disabled="safeIndex <= 0" @click="moveParagraph\(-1\)" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateParagraph\(-1\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateParagraph\(-1\)"/)
    assert.match(page, /data-action="next" :tabindex="h5TabIndex\(safeIndex < blocks\.length - 1\)" :role="h5ButtonRole\(\)" :aria-disabled="h5AriaDisabled\(safeIndex < blocks\.length - 1\)" :disabled="safeIndex >= blocks\.length - 1" @click="moveParagraph\(1\)" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateParagraph\(1\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateParagraph\(1\)"/)
    assert.match(page, /data-action="back" :aria-label="t\('back'\)" :tabindex="h5TabIndex\(true\)" :role="h5ButtonRole\(\)" @click="backMobile" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateBack" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateBack"/)
    for (const action of ['refresh', 'reread', 'retry']) {
      assert.match(page, new RegExp(`data-action="${action}" :tabindex="h5TabIndex\\(true\\)" :role="h5ButtonRole\\(\\)" @click="load" @keydown\\.enter\\.stop\\.prevent @keyup\\.enter\\.stop\\.prevent="activateLoad"`))
    }
    assert.match(page, /data-action="back-practice" :tabindex="h5TabIndex\(true\)" :role="h5ButtonRole\(\)" @click="backToPractice" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activatePractice" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activatePractice"/)
    const fontDown = page.slice(page.indexOf('data-action="font-down"'), page.indexOf('data-action="font-up"'))
    const fontUp = page.slice(page.indexOf('data-action="font-up"'), page.indexOf('class="reading-tools-gap"'))
    const translationStart = page.indexOf('data-action="translation"')
    const translation = page.slice(translationStart, page.indexOf('class="reading-track"', translationStart))
    const original = page.slice(page.indexOf('data-action="original"'), page.indexOf('data-action="bilingual"'))
    const bilingual = page.slice(page.indexOf('data-action="bilingual"'), page.indexOf('class="reading-word-bypass"', page.indexOf('data-action="bilingual"')))
    assert.doesNotMatch(translation, /h5TabIndex|h5ButtonRole|tabindex=/)
    assert.match(translation, /:aria-label="showTranslation \? t\('translationHide'\) : t\('translationShow'\)"/)
    assert.match(fontDown, /:aria-label="t\('fontDown'\)"/)
    assert.match(fontDown, /:disabled="fontPercent <= READING_FONT_MIN_PERCENT"/)
    assert.match(fontDown, />A−<\/button>/)
    assert.match(fontUp, /:aria-label="t\('fontUp'\)"/)
    assert.match(fontUp, /:disabled="fontPercent >= READING_FONT_MAX_PERCENT"/)
    assert.match(fontUp, />A＋<\/button>/)
    assert.match(page, /<text class="reading-font-value">\{\{ fontPercent \}\}%<\/text>/)
    assert.doesNotMatch(page.slice(page.indexOf('<text class="reading-font-value">'), page.indexOf('</text>', page.indexOf('<text class="reading-font-value">'))), /tabindex|h5TabIndex|@keydown|@click/)
    assert.match(original, /:aria-pressed="showTranslation \? 'false' : 'true'"/)
    assert.match(original, />\{\{ t\('original'\) \}\}<\/button>/)
    assert.match(bilingual, /:aria-pressed="showTranslation \? 'true' : 'false'"/)
    assert.match(bilingual, />\{\{ t\('bilingual'\) \}\}<\/button>/)
    if (relative.endsWith('b11-reading.vue')) {
      assert.match(fontDown, /data-action="font-down" :aria-label="t\('fontDown'\)" :tabindex="h5TabIndex\(fontPercent > READING_FONT_MIN_PERCENT\)" :role="h5ButtonRole\(\)" :aria-disabled="h5AriaDisabled\(fontPercent > READING_FONT_MIN_PERCENT\)" :disabled="fontPercent <= READING_FONT_MIN_PERCENT" @click="changeFont\(-1\)" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateFont\(-1\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateFont\(-1\)">A−<\/button>/)
      assert.match(fontUp, /data-action="font-up" :aria-label="t\('fontUp'\)" :tabindex="h5TabIndex\(fontPercent < READING_FONT_MAX_PERCENT\)" :role="h5ButtonRole\(\)" :aria-disabled="h5AriaDisabled\(fontPercent < READING_FONT_MAX_PERCENT\)" :disabled="fontPercent >= READING_FONT_MAX_PERCENT" @click="changeFont\(1\)" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateFont\(1\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateFont\(1\)">A＋<\/button>/)
      assert.match(original, /data-action="original" :aria-pressed="showTranslation \? 'false' : 'true'" :tabindex="h5TabIndex\(true\)" :role="h5ButtonRole\(\)" @click="showTranslation = false" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateSegment\(false\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateSegment\(false\)">\{\{ t\('original'\) \}\}<\/button>/)
      assert.match(bilingual, /data-action="bilingual" :aria-pressed="showTranslation \? 'true' : 'false'" :tabindex="h5TabIndex\(true\)" :role="h5ButtonRole\(\)" @click="showTranslation = true" @keydown\.enter\.stop\.prevent @keyup\.enter\.stop\.prevent="activateSegment\(true\)" @keydown\.space\.stop\.prevent @keyup\.space\.stop\.prevent="activateSegment\(true\)">\{\{ t\('bilingual'\) \}\}<\/button>/)
      assert.ok(page.indexOf('data-action="font-down"') < page.indexOf('data-action="font-up"') && page.indexOf('data-action="font-up"') < page.indexOf('data-action="original"') && page.indexOf('data-action="original"') < page.indexOf('data-action="bilingual"') && page.indexOf('data-action="bilingual"') < bypass && bypass < words, relative)
      assert.match(page, /<view v-if="graded" class="reading-check" role="status">/)
      assert.doesNotMatch(page.slice(page.indexOf('class="reading-check"'), page.indexOf('class="reading-closed"')), /<button|@click|@keydown|tabindex/)
    } else {
      assert.doesNotMatch(fontDown, /h5TabIndex|h5ButtonRole|tabindex=/)
      assert.doesNotMatch(fontUp, /h5TabIndex|h5ButtonRole|tabindex=/)
      assert.doesNotMatch(original, /h5TabIndex|h5ButtonRole|tabindex=/)
      assert.doesNotMatch(bilingual, /h5TabIndex|h5ButtonRole|tabindex=/)
    }
    const helpers = page.slice(page.indexOf('function h5TabIndex'), page.indexOf('function focusParagraphNav'))
    assert.match(helpers, /\/\/ #ifdef H5[\s\S]*return enabled \? '0' : '-1'[\s\S]*\/\/ #ifndef H5[\s\S]*return enabled \? undefined : undefined/)
    assert.match(helpers, /return 'button'[\s\S]*\/\/ #ifndef H5[\s\S]*return undefined/)
    assert.match(helpers, /return enabled \? undefined : 'true'/)
    assert.match(helpers, /function readingKeysReady\(\): boolean \{[\s\S]*\/\/ #ifdef H5[\s\S]*return pageVisible\.value && !documentHidden\(\) && routeStillCurrent\(\)[\s\S]*\/\/ #ifndef H5[\s\S]*return false/)
    assert.match(helpers, /function activateWord\(blockId: string, word: string\): void \{[\s\S]*\/\/ #ifdef H5[\s\S]*if \(!readingKeysReady\(\)\) return[\s\S]*chooseWord\(blockId, word\)[\s\S]*\/\/ #endif/)
    assert.match(helpers, /function activateParagraph\(direction: -1 \| 1\): void \{[\s\S]*if \(!enabled\) return[\s\S]*moveParagraph\(direction\)/)
    assert.doesNotMatch(helpers, /b10LearningApi|saveReading|submitReading|mineReading|openUniPage|setStorage|getStorage|document\.|window\./)
    if (relative.endsWith('b11-reading.vue')) {
      assert.match(helpers, /function activateFont\(direction: -1 \| 1\): void \{[\s\S]*\/\/ #ifdef H5[\s\S]*if \(!readingKeysReady\(\)\) return[\s\S]*const enabled = direction < 0 \? fontPercent\.value > READING_FONT_MIN_PERCENT : fontPercent\.value < READING_FONT_MAX_PERCENT[\s\S]*if \(!enabled\) return[\s\S]*changeFont\(direction\)[\s\S]*\/\/ #endif/)
      assert.match(helpers, /function activateSegment\(translated: boolean\): void \{[\s\S]*\/\/ #ifdef H5[\s\S]*if \(!readingKeysReady\(\)\) return[\s\S]*showTranslation\.value = translated[\s\S]*\/\/ #endif/)
      assert.doesNotMatch(helpers.slice(helpers.indexOf('function activateFont')), /persistLocal|load\(|backMobile|backToPractice|chooseWord|moveParagraph|openUniPage|submitReading|saveReading|mineReading/)
    } else {
      assert.doesNotMatch(helpers, /activateFont|activateSegment/)
    }
    const fn = page.slice(page.indexOf('function focusParagraphNav'), page.indexOf('function backToPractice'))
    assert.match(fn, /\/\/ #ifdef H5[\s\S]*!pageVisible\.value \|\| documentHidden\(\) \|\| !routeStillCurrent\(\)[\s\S]*pageRoot\.value\?\.\$el\?\.querySelector<HTMLElement>\('#' \+ paragraphNavId\)\?\.focus\(\)[\s\S]*\/\/ #endif/)
    assert.doesNotMatch(fn, /document\.|window\.|getElementById|setStorage|getStorage|moveParagraph|chooseWord|openUniPage|location|hash/)
    const focused = page.slice(page.indexOf('.reading-word-bypass:focus,'), page.indexOf('.reading-paragraph-target'))
    assert.match(focused, /position: absolute/)
    assert.match(focused, /top: 16px/)
    assert.match(focused, /right: 16px/)
    assert.match(focused, /left: 16px/)
    assert.match(focused, /height: auto/)
    assert.match(focused, /min-height: 44px/)
    assert.match(focused, /min-width: 44px/)
    assert.match(focused, /white-space: normal/)
    assert.match(focused, /overflow-wrap: anywhere/)
    assert.doesNotMatch(focused, /(?:^|[\s;{])height:\s*44px/)
    assert.doesNotMatch(focused, /max-height:\s*44px/)
    assert.doesNotMatch(focused, /height:\s*100%/)
    assert.doesNotMatch(focused, /inset:\s*0/)
    assert.doesNotMatch(focused, /text-overflow:\s*ellipsis/)
    assert.doesNotMatch(focused, /white-space:\s*nowrap/)
    assert.match(focused, /margin: 0/)
    assert.match(focused, /color: var\(--yx-text-primary\)/)
    assert.match(focused, /background: var\(--yx-surface-card\)/)
    assert.doesNotMatch(focused, /position:\s*static|position:\s*fixed/)
    assert.match(page, /data-theme="high-contrast"\] \.reading-word-bypass:focus/)
  }
})

test('reading pages keep two route identities, original assets and closed-write markup', () => {
  const b3 = read('src/pages/b3-reading/b3-reading.vue')
  const b11 = read('src/pages/b11-reading/b11-reading.vue')
  assert.match(b3, /const graded = false/)
  assert.match(b3, /const ROUTE_ID = 'b3-reading'/)
  assert.match(b3, /const titleKey = 'titlePractice'/)
  assert.match(b3, /v-if="!graded"/)
  assert.match(b11, /const graded = true/)
  assert.match(b11, /const ROUTE_ID = 'b11-reading'/)
  assert.match(b11, /const ROUTE_PATH = '\/pages\/b11-reading\/b11-reading'/)
  assert.match(b11, /const titleKey = 'titleGraded'/)
  assert.doesNotMatch(b11, /b3-reading/)
  for (const page of [b3, b11]) {
    assert.match(page, /currentMobilePagePath\(\)/)
    assert.match(page, /readingRouteActive/)
    assert.match(page, /addEventListener\('hashchange', onRouteChange\)/)
    assert.match(page, /data-write-capability="closed"/)
    assert.match(page, /data-server-receipt="none"/)
    assert.match(page, /data-selection-persisted="false"/)
    assert.match(page, /mode="aspectFit"/)
    assert.doesNotMatch(page, /scaleToFill|createAdaptivePerformanceEngine|B11StatusPanel|B10StatusPanel|MobilePageHeader|error\.message/)
    assert.doesNotMatch(page, /saveReadingProgress|submitReadingAttempt|mineReadingExpression|saveReadingPosition/)
    assert.doesNotMatch(page, /The Quiet Power of Small Habits|A City That Learned to Slow Down|已保存的进度以记录为准/)
    const { descriptor, errors } = parse(page, { filename: 'reading.vue' })
    assert.deepEqual(errors, [])
    const script = compileScript(descriptor, { id: 'reading-page' })
    const template = compileTemplate({ source: descriptor.template.content, filename: 'reading.vue', id: 'reading-page', scoped: true, compilerOptions: { bindingMetadata: script.bindings } })
    assert.deepEqual(template.errors, [])
    const style = compileStyle({ source: descriptor.styles[0].content, filename: 'reading.vue', id: 'reading-page', scoped: true })
    assert.deepEqual(style.errors, [])
  }
  assert.match(b3, /data-action="translation"/)
  assert.match(b11, /data-action="bilingual"/)
  assert.match(b11, /imgIconMore\.svg/)
  assert.match(b11, /comprehensionClosed/)
  const refs = new Set([...`${b3}\n${b11}`.matchAll(/\/static\/figma-reading-core\/[A-Za-z0-9-]+\/[A-Za-z0-9]+\.svg/g)].map((match) => match[0]))
  assert.ok(refs.size >= 12, String(refs.size))
  for (const ref of refs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    const bytes = fs.readFileSync(file)
    assert.ok(bytes.length > 32, ref)
    assert.match(bytes.subarray(0, 80).toString('utf8'), /<svg/)
  }
  const assetRoot = path.join(appRoot, 'src/static/figma-reading-core')
  const files = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(child)
      else if (entry.name.endsWith('.svg')) files.push(child)
    }
  }
  walk(assetRoot)
  assert.equal(files.length, 22)
})

function article(title, overrides = {}) {
  return {
    articleId: overrides.articleId ?? 11,
    title,
    cefrLevel: 'B1',
    wordCount: 4,
    estimatedMinutes: 1,
    blocks: overrides.blocks ?? [{ blockId: 'p1', blockIndex: 0, text: title, translation: 'local gloss' }, { blockId: 'p2', blockIndex: 1, text: 'Second paragraph.', translation: 'second gloss' }],
    rightsStatus: overrides.rightsStatus ?? 'AUTHORIZED',
    contentVersionId: overrides.contentVersionId ?? 7,
    contentEpoch: overrides.contentEpoch ?? 3,
  }
}

function loadPage(relativePage, hash) {
  const calls = { list: 0, get: 0, questions: 0, save: 0, submit: 0, mine: 0, access: [], pathReads: [] }
  const storage = new Map()
  const hostListeners = new Map()
  const location = { hash }
  let topPages = []
  const previous = { window: globalThis.window, document: globalThis.document, getCurrentPages: globalThis.getCurrentPages }
  function listen(type, cb) {
    const list = hostListeners.get(type) ?? []
    list.push(cb)
    hostListeners.set(type, list)
  }
  function unlisten(type, cb) {
    hostListeners.set(type, (hostListeners.get(type) ?? []).filter((item) => item !== cb))
  }
  const documentHost = { hidden: false, addEventListener: listen, removeEventListener: unlisten }
  const windowHost = { location, addEventListener: listen, removeEventListener: unlisten }
  globalThis.window = windowHost
  globalThis.document = documentHost
  globalThis.getCurrentPages = () => topPages
  const behaviors = {
    allowed: true,
    listImpl: async () => [article('Server article')],
    getImpl: async () => article('Server article'),
    questionImpl: async () => [{ questionId: 9, stem: 'SECRET STEM', options: ['SECRET OPTION'], correctAnswer: 'SECRET ANSWER' }],
    gate: Promise.resolve(),
  }
  class MobileApiError extends Error {
    constructor(message, status, details) {
      super(message)
      this.status = status
      this.details = details
    }
  }
  const session = vue.reactive({
    verifiedSubject: 'owner-a',
    identityRevision: 4,
    isAuthenticated: true,
    adultGate: 'PASSED',
    adultLearningAccess: 'ELIGIBLE',
    learningConsentWithdrawn: false,
    isLearningReady: true,
    async restore() { return undefined },
  })
  const b10UiLocale = vue.ref('zh-CN')
  const b10ContentLocale = vue.ref('ja-JP')
  const b10ThemeMode = vue.ref('light')
  const lifecycle = {}
  const source = read(relativePage)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, `${relativePage} script`)
  const compiled = ts.transpileModule(`${script}
module.exports.__fixture = { state, article, questionCount, blockIndex, fontPercent, bodyPx, translationPx, selection, graded, routeId: ROUTE_ID, routePath: ROUTE_PATH, load, changeFont, moveParagraph, chooseWord }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        vue: { ...vue, onBeforeUnmount() {} },
        '@dcloudio/uni-app': { onShow(cb) { lifecycle.show = cb }, onHide(cb) { lifecycle.hide = cb } },
        '@englishflow/i18n': { interpolate(message, values = {}) { return String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key])) } },
        '../../domain/reading-page': domain,
        '../../api/b10': {
          b10LearningApi: {
            listReadingArticles: (...args) => { calls.list += 1; return behaviors.listImpl(...args) },
            getReadingArticle: (...args) => { calls.get += 1; return behaviors.getImpl(...args) },
            listReadingQuestions: (...args) => { calls.questions += 1; return behaviors.questionImpl(...args) },
            saveReadingProgress: async () => { calls.save += 1 },
            submitReadingAttempt: async () => { calls.submit += 1 },
            mineReadingExpression: async () => { calls.mine += 1 },
          },
        },
        '../../api/client': { MobileApiError },
        '../../auth/navigation': {
          currentMobilePagePath(fallback = '/pages/home/home') {
            calls.pathReads.push(fallback)
            const hashPath = String(location.hash || '').replace(/^#/, '').split(/[?#]/, 1)[0].trim()
            if (hashPath) return hashPath.startsWith('/') ? hashPath : `/${hashPath}`
            const route = topPages.at(-1)?.route
            if (typeof route === 'string' && route.trim()) {
              const path = route.split(/[?#]/, 1)[0].trim()
              return path.startsWith('/') ? path : `/${path}`
            }
            return fallback
          },
          ensureMobilePageAccess: async (url) => {
            calls.access.push(url)
            await behaviors.gate
            return behaviors.allowed
          },
        },
        '../../platform/b10-foundation': { b10ContentLocale, b10UiLocale, b10ThemeMode },
        '../../platform/experience': {
          mobileExperienceEngine: { state: { level: 'High' }, subscribe(listener) { listener({ level: 'High' }); return () => {} } },
          mobileT(key) { return copyZh[key.replace(/^readingPage\./, '')] ?? key },
          backMobile() {},
          useMobileExperience: () => ({ experienceStyle: vue.ref({}), experienceMotion: vue.ref('on'), theme: vue.ref('light') }),
        },
        '../../platform/uni-runtime': {
          getUniRuntime: () => ({
            getStorageSync(key) { return storage.has(key) ? storage.get(key) : '' },
            setStorageSync(key, value) { storage.set(key, value) },
            removeStorageSync(key) { storage.delete(key) },
          }),
          openUniPage() {},
        },
        '../../platform/v2-foundation': { mobileI18n: {} },
        '../../stores/session': { useSessionStore: () => session },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  return {
    fixture: module.exports.__fixture,
    calls,
    lifecycle,
    behaviors,
    session,
    storage,
    location,
    b10UiLocale,
    b10ContentLocale,
    MobileApiError,
    setPages(pages) { topPages = pages },
    setHidden(hidden) { documentHost.hidden = hidden },
    dispatch(type) { for (const cb of hostListeners.get(type) ?? []) cb() },
    dispose() {
      scope.stop()
      globalThis.window = previous.window
      globalThis.document = previous.document
      globalThis.getCurrentPages = previous.getCurrentPages
    },
  }
}

test('reading runtime refuses unsupported writes, foreign receipts and private reads after leaving the route', async () => {
  const opened = []
  try {
    const ready = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(ready)
    const storageKey = 'yx.mobile.reading.local.v1.b3-reading'
    ready.storage.set(storageKey, JSON.stringify({ routeId: 'b3-reading', subject: 'owner-a', articleId: 11, contentVersionId: 7, contentEpoch: 3, blockIndex: 1, saved: true }))
    ready.lifecycle.show()
    await settle()
    assert.equal(ready.fixture.state.value, 'ready')
    assert.equal(ready.fixture.blockIndex.value, 1)
    assert.equal(ready.fixture.article.value.title, 'Server article')
    assert.equal(ready.fixture.questionCount.value, 1)
    assert.equal(JSON.stringify(ready.fixture.article.value).includes('SECRET'), false)
    assert.deepEqual(ready.calls.access, ['/pages/b3-reading/b3-reading'])
    assert.equal(ready.calls.list, 1)
    assert.equal(ready.calls.get, 1)
    assert.equal(ready.calls.questions, 1)
    assert.equal(ready.calls.save, 0)
    assert.equal(ready.calls.submit, 0)
    assert.equal(ready.calls.mine, 0)
    assert.ok(ready.calls.pathReads.every((fallback) => fallback === '/pages/home/home'))
    const stored = JSON.parse(ready.storage.get(storageKey))
    assert.equal(Object.hasOwn(stored, 'saved'), false)
    assert.equal(stored.blockIndex, 1)
    assert.equal(stored.subject, 'owner-a')
    for (let i = 0; i < 15; i += 1) ready.fixture.changeFont(1)
    ready.fixture.changeFont(-1)
    ready.fixture.moveParagraph(-1)
    ready.fixture.chooseWord('p1', 'Server')
    assert.equal(ready.fixture.fontPercent.value, 190)
    assert.equal(ready.fixture.bodyPx.value, 32.3)
    assert.equal(ready.fixture.translationPx.value, 24)
    assert.equal(ready.fixture.selection.value.persisted, false)
    assert.equal(ready.fixture.selection.value.word, 'Server')
    assert.equal(ready.calls.save + ready.calls.submit + ready.calls.mine, 0)
    assert.equal(Object.hasOwn(JSON.parse(ready.storage.get(storageKey)), 'saved'), false)
    const seenContext = []
    ready.behaviors.listImpl = async (context) => { seenContext.push(context); return [] }
    ready.lifecycle.show()
    await settle()
    assert.equal(ready.fixture.state.value, 'empty')
    assert.deepEqual(seenContext.at(-1), { uiLocale: 'zh-CN', contentLocale: 'ja-JP' })

    const mismatch = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(mismatch)
    mismatch.storage.set(storageKey, JSON.stringify({ routeId: 'b3-reading', subject: 'other-owner', articleId: 11, contentVersionId: 7, contentEpoch: 3, blockIndex: 1, saved: true }))
    mismatch.lifecycle.show()
    await settle()
    assert.equal(mismatch.fixture.state.value, 'ready')
    assert.equal(mismatch.fixture.blockIndex.value, 0)
    const rewritten = JSON.parse(mismatch.storage.get(storageKey))
    assert.equal(rewritten.subject, 'owner-a')
    assert.equal(Object.hasOwn(rewritten, 'saved'), false)
    assert.equal(mismatch.calls.save, 0)

    const duringEnsure = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(duringEnsure)
    duringEnsure.behaviors.ensure = null
    duringEnsure.behaviors.gate = Promise.resolve()
    const ensureGate = deferred()
    duringEnsure.behaviors.gate = ensureGate.promise
    duringEnsure.lifecycle.show()
    await settle()
    assert.equal(duringEnsure.calls.access.length, 1)
    assert.equal(duringEnsure.calls.list, 0)
    duringEnsure.location.hash = '#/pages/home/home'
    duringEnsure.dispatch('hashchange')
    ensureGate.resolve()
    await settle()
    assert.equal(duringEnsure.calls.list, 0)
    assert.equal(duringEnsure.calls.get, 0)
    assert.equal(duringEnsure.fixture.article.value, null)
    assert.equal(duringEnsure.calls.save + duringEnsure.calls.submit + duringEnsure.calls.mine, 0)

    const duringList = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(duringList)
    duringList.behaviors.listImpl = async () => {
      duringList.location.hash = '#/pages/home/home'
      return [article('LATE PRIVATE TITLE')]
    }
    duringList.lifecycle.show()
    await settle()
    assert.equal(duringList.calls.list, 1)
    assert.equal(duringList.calls.get, 0)
    assert.equal(duringList.fixture.article.value, null)
    assert.equal(JSON.stringify(duringList.fixture.article.value ?? '').includes('LATE PRIVATE TITLE'), false)

    const duringGet = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(duringGet)
    duringGet.behaviors.getImpl = async () => {
      duringGet.location.hash = '#/pages/practice/practice'
      return article('LATE PRIVATE TITLE')
    }
    duringGet.lifecycle.show()
    await settle()
    assert.equal(duringGet.calls.get, 1)
    assert.equal(duringGet.calls.questions, 0)
    assert.equal(duringGet.fixture.article.value, null)

    const hidden = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(hidden)
    const hiddenList = deferred()
    hidden.behaviors.listImpl = () => hiddenList.promise
    hidden.lifecycle.show()
    await settle()
    assert.equal(hidden.calls.list, 1)
    hidden.setHidden(true)
    hidden.dispatch('visibilitychange')
    hiddenList.resolve([article('HIDDEN PRIVATE')])
    await settle()
    assert.equal(hidden.calls.get, 0)
    assert.equal(hidden.fixture.article.value, null)
    assert.equal(hidden.fixture.state.value, 'idle')

    const late = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(late)
    const firstList = deferred()
    late.behaviors.listImpl = () => {
      if (late.calls.list === 1) {
        late.session.identityRevision += 1
        return firstList.promise
      }
      return Promise.resolve([article('CURRENT TITLE')])
    }
    late.behaviors.getImpl = async () => article('CURRENT TITLE')
    late.lifecycle.show()
    await settle()
    assert.equal(late.calls.list >= 2, true)
    assert.equal(late.fixture.article.value?.title, 'CURRENT TITLE')
    firstList.resolve([article('LATE PRIVATE TITLE')])
    await settle()
    assert.equal(late.fixture.article.value?.title, 'CURRENT TITLE')
    assert.equal(JSON.stringify(late.fixture.article.value).includes('LATE PRIVATE TITLE'), false)
    assert.equal(late.calls.save + late.calls.submit + late.calls.mine, 0)

    const topPage = loadPage('src/pages/b11-reading/b11-reading.vue', '')
    opened.push(topPage)
    topPage.setPages([{ route: 'pages/b11-reading/b11-reading' }])
    topPage.lifecycle.show()
    await settle()
    assert.equal(topPage.fixture.graded, true)
    assert.equal(topPage.fixture.routeId, 'b11-reading')
    assert.deepEqual(topPage.calls.access, ['/pages/b11-reading/b11-reading'])
    assert.equal(topPage.calls.list, 1)
    assert.equal(topPage.calls.save + topPage.calls.submit + topPage.calls.mine, 0)

    const wrongRoute = loadPage('src/pages/b11-reading/b11-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(wrongRoute)
    wrongRoute.lifecycle.show()
    await settle()
    assert.equal(wrongRoute.calls.list, 0)
    assert.equal(wrongRoute.calls.get, 0)
    assert.equal(wrongRoute.fixture.article.value, null)

    const offline = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(offline)
    offline.behaviors.listImpl = async () => { throw new offline.MobileApiError('socket raw', 0, null) }
    offline.lifecycle.show()
    await settle()
    assert.equal(offline.fixture.state.value, 'offline')
    assert.equal(offline.fixture.article.value, null)

    const stale = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(stale)
    stale.behaviors.listImpl = async () => { throw new stale.MobileApiError('version raw', 410, null) }
    stale.lifecycle.show()
    await settle()
    assert.equal(stale.fixture.state.value, 'stale')

    const denied = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(denied)
    denied.behaviors.allowed = false
    denied.session.isAuthenticated = false
    denied.session.verifiedSubject = ''
    denied.session.adultGate = 'UNKNOWN'
    denied.session.isLearningReady = false
    denied.lifecycle.show()
    await settle()
    assert.equal(denied.fixture.state.value, 'auth-401')
    assert.equal(denied.calls.list, 0)
    assert.equal(denied.fixture.article.value, null)

    const forbidden = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(forbidden)
    forbidden.behaviors.allowed = false
    forbidden.lifecycle.show()
    await settle()
    assert.equal(forbidden.fixture.state.value, 'auth-403')
    assert.equal(forbidden.calls.list, 0)

    const revoked = loadPage('src/pages/b11-reading/b11-reading.vue', '#/pages/b11-reading/b11-reading')
    opened.push(revoked)
    revoked.behaviors.listImpl = async () => [article('HIDDEN BODY', { rightsStatus: 'REVOKED' })]
    revoked.behaviors.getImpl = async () => article('HIDDEN BODY', { rightsStatus: 'REVOKED' })
    revoked.lifecycle.show()
    await settle()
    assert.equal(revoked.calls.get, 1)
    assert.equal(revoked.calls.questions, 0)
    assert.equal(revoked.fixture.state.value, 'revoked')
    assert.equal(revoked.fixture.article.value, null)

    const failed = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading')
    opened.push(failed)
    failed.behaviors.listImpl = async () => { throw new failed.MobileApiError('internal detail', 500, null) }
    failed.lifecycle.show()
    await settle()
    assert.equal(failed.fixture.state.value, 'error')
    assert.equal(failed.fixture.article.value, null)
    assert.equal(failed.calls.save + failed.calls.submit + failed.calls.mine, 0)
  } finally {
    for (const page of opened) page.dispose()
    delete globalThis.window
    delete globalThis.document
    delete globalThis.getCurrentPages
  }
})
