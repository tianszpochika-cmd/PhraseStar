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
  assert.equal(copyZh.continuePublished, '继续这版已发布练习')
  assert.equal(copyEn.continuePublished, 'Continue this published practice')
  assert.doesNotMatch(`${copyZh.continuePublished}\n${copyEn.continuePublished}`, /FULL|ZERO|%|\d/)
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
    const translationStart = page.indexOf('data-action="translation"')
    const translation = page.slice(translationStart, page.indexOf('class="reading-track"', translationStart))
    const original = page.slice(page.indexOf('data-action="original"'), page.indexOf('data-action="bilingual"'))
    assert.doesNotMatch(fontDown, /h5TabIndex|h5ButtonRole|tabindex=/)
    assert.doesNotMatch(translation, /h5TabIndex|h5ButtonRole|tabindex=/)
    assert.doesNotMatch(original, /h5TabIndex|h5ButtonRole|tabindex=/)
    assert.match(translation, /:aria-label="showTranslation \? t\('translationHide'\) : t\('translationShow'\)"/)
    assert.match(fontDown, /:aria-label="t\('fontDown'\)"/)
    const helpers = page.slice(page.indexOf('function h5TabIndex'), page.indexOf('function focusParagraphNav'))
    assert.match(helpers, /\/\/ #ifdef H5[\s\S]*return enabled \? '0' : '-1'[\s\S]*\/\/ #ifndef H5[\s\S]*return enabled \? undefined : undefined/)
    assert.match(helpers, /return 'button'[\s\S]*\/\/ #ifndef H5[\s\S]*return undefined/)
    assert.match(helpers, /return enabled \? undefined : 'true'/)
    assert.match(helpers, /function readingKeysReady\(\): boolean \{[\s\S]*\/\/ #ifdef H5[\s\S]*return pageVisible\.value && !documentHidden\(\) && routeStillCurrent\(\)[\s\S]*\/\/ #ifndef H5[\s\S]*return false/)
    assert.match(helpers, /function activateWord\(blockId: string, word: string\): void \{[\s\S]*\/\/ #ifdef H5[\s\S]*if \(!readingKeysReady\(\)\) return[\s\S]*chooseWord\(blockId, word\)[\s\S]*\/\/ #endif/)
    assert.match(helpers, /function activateParagraph\(direction: -1 \| 1\): void \{[\s\S]*if \(!enabled\) return[\s\S]*moveParagraph\(direction\)/)
    assert.doesNotMatch(helpers, /b10LearningApi|saveReading|submitReading|mineReading|openUniPage|setStorage|getStorage|document\.|window\./)
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
    ...(Object.hasOwn(overrides, 'practiceRef') ? { practiceRef: overrides.practiceRef } : {}),
  }
}

function loadPage(relativePage, hash, extras = []) {
  const calls = { list: 0, get: 0, questions: 0, save: 0, submit: 0, mine: 0, created: 0, sessions: [], navigation: [], access: [], pathReads: [] }
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
    sessionImpl: async () => { throw new Error('unexpected reading practice session') },
    gate: Promise.resolve(),
  }
  const practiceHold = vue.reactive({
    practice: null,
    remembered: null,
    forgotten: 0,
    rememberReadingPractice(session, pin) {
      const entry = domain.readingPracticeEntry(session?.sessionId, pin)
      if (!entry || !domain.readingPracticeParsedAccepted(session, pin)) return false
      practiceHold.remembered = { ...entry }
      return true
    },
    forgetReadingPractice() {
      practiceHold.forgotten += 1
      practiceHold.remembered = null
    },
  })
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
  const extraFields = extras.length ? `, ${extras.join(', ')}` : ''
  const compiled = ts.transpileModule(`${script}
module.exports.__fixture = { state, article, questionCount, blockIndex, fontPercent, bodyPx, translationPx, selection, graded, routeId: ROUTE_ID, routePath: ROUTE_PATH, load, changeFont, moveParagraph, chooseWord${extraFields} }
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
            openReadingPracticeSession: async (context, contentCode, contentVersionId, questionItemId) => {
              calls.sessions.push({
                context,
                contentCode,
                contentVersionId,
                questionItemId,
                body: domain.readingPracticeSessionBody({ contentCode, contentVersionId, questionItemId }),
              })
              return behaviors.sessionImpl(context, contentCode, contentVersionId, questionItemId)
            },
            createAssessmentSession: async () => { calls.created += 1; throw new Error('createAssessmentSession fallback') },
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
          openUniPage(url) { calls.navigation.push(url) },
        },
        '../../platform/v2-foundation': { mobileI18n: {} },
        '../../stores/b10-learning': { useB10LearningStore: () => practiceHold },
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
    practiceHold,
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

const PRACTICE_FIELDS = ['practiceReady', 'practiceLabel', 'continuePublishedPractice']
const READING_LOCAL_KEY = 'yx.mobile.reading.local.v1.b3-reading'
const PUBLISHED_PIN = { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: 9 }

function publishedPracticeSession(overrides = {}) {
  return {
    sessionId: 'asess_reading_1001_9',
    sessionType: 'PRACTICE',
    status: 'IN_PROGRESS',
    exercises: [{ exerciseId: 9, itemId: 9, contentVersionId: null }],
    ...overrides,
  }
}

function presetReadingPosition(page, contentVersionId = 1001) {
  page.storage.set(READING_LOCAL_KEY, JSON.stringify({
    routeId: 'b3-reading',
    subject: 'owner-a',
    articleId: 11,
    contentVersionId,
    contentEpoch: 3,
    blockIndex: 1,
    saved: true,
  }))
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

    const detailRef = { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: '9' }
    const handoff = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(handoff)
    presetReadingPosition(handoff)
    handoff.behaviors.listImpl = async () => [article('Listed only', {
      contentVersionId: 1001,
      practiceRef: { contentCode: 'p1.placement.v1', contentVersionId: 1001, questionItemId: 4 },
    })]
    handoff.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    handoff.behaviors.questionImpl = async () => [{
      questionId: 4,
      stem: 'SECRET STEM',
      options: ['SECRET OPTION'],
      correctAnswer: 'SECRET ANSWER',
      practiceRef: { contentCode: 'p1.placement.v1', contentVersionId: 1001, questionItemId: 4 },
    }]
    handoff.lifecycle.show()
    await settle()
    assert.equal(handoff.fixture.state.value, 'ready')
    assert.equal(handoff.fixture.article.value.title, 'Server article')
    assert.equal(handoff.fixture.article.value.practiceRef.contentCode, 'reading.unit.one')
    assert.equal(handoff.fixture.questionCount.value, 1)
    assert.equal(handoff.fixture.blockIndex.value, 1)
    assert.equal(handoff.fixture.practiceReady.value, true)
    assert.equal(handoff.fixture.practiceLabel.value, '继续这版已发布练习')
    assert.equal(handoff.calls.list, 1)
    assert.equal(handoff.calls.get, 1)
    assert.equal(handoff.calls.questions, 1)
    assert.equal(handoff.calls.sessions.length, 0)
    assert.equal(handoff.calls.created, 0)
    assert.equal(JSON.stringify(handoff.fixture.article.value).includes('SECRET'), false)
    assert.equal(JSON.stringify(handoff.fixture.article.value).includes('p1.placement'), false)
    const handoffStored = handoff.storage.get(READING_LOCAL_KEY)
    const handoffGate = deferred()
    const openedSession = publishedPracticeSession()
    assert.equal(domain.readingPracticeParsedAccepted(openedSession, PUBLISHED_PIN), true)
    handoff.behaviors.sessionImpl = () => handoffGate.promise
    const pendingHandoff = handoff.fixture.continuePublishedPractice()
    const skippedHandoff = handoff.fixture.continuePublishedPractice()
    assert.equal(handoff.calls.sessions.length, 1)
    handoffGate.resolve(openedSession)
    await pendingHandoff
    await skippedHandoff
    await settle()
    assert.equal(handoff.calls.sessions.length, 1)
    assert.deepEqual(handoff.calls.sessions[0].context, { uiLocale: 'zh-CN', contentLocale: 'ja-JP' })
    assert.equal(handoff.calls.sessions[0].contentCode, 'reading.unit.one')
    assert.equal(handoff.calls.sessions[0].contentVersionId, 1001)
    assert.equal(handoff.calls.sessions[0].questionItemId, 9)
    assert.deepEqual(handoff.calls.sessions[0].body, {
      contentCode: 'reading.unit.one',
      contentVersionId: 1001,
      mode: 'PRACTICE',
      itemIds: [9],
      clientSessionRef: 'h5-reading-1001-9',
    })
    assert.equal(handoff.calls.created, 0)
    assert.equal(handoff.calls.save + handoff.calls.submit + handoff.calls.mine, 0)
    assert.equal(handoff.calls.questions, 1)
    assert.deepEqual(handoff.calls.navigation, [domain.READING_PRACTICE_ENTRY_PATH])
    assert.equal(handoff.calls.navigation[0].includes('asess_'), false)
    assert.equal(handoff.calls.navigation[0].includes('sessionId'), false)
    assert.equal(handoff.practiceHold.practice, null)
    assert.equal(handoff.practiceHold.forgotten, 0)
    assert.deepEqual(handoff.practiceHold.remembered, {
      sessionId: 'asess_reading_1001_9',
      contentCode: 'reading.unit.one',
      contentVersionId: 1001,
      questionItemId: 9,
    })
    assert.equal(JSON.stringify(handoff.practiceHold.remembered).includes('SECRET'), false)
    assert.equal(handoff.fixture.blockIndex.value, 1)
    const handoffAfter = JSON.parse(handoff.storage.get(READING_LOCAL_KEY))
    assert.equal(handoffAfter.blockIndex, 1)
    assert.equal(handoffAfter.subject, 'owner-a')
    assert.equal(handoffAfter.contentVersionId, 1001)
    assert.equal(Object.hasOwn(handoffAfter, 'saved'), false)
    assert.equal(handoff.storage.get(READING_LOCAL_KEY), handoffStored)

    const refusals = [
      ['omitted', article('Server article', { contentVersionId: 1001 })],
      ['string version', article('Server article', { contentVersionId: 1001, practiceRef: { contentCode: 'reading.unit.one', contentVersionId: '1001', questionItemId: '9' } })],
      ['article id', article('Server article', { contentVersionId: 1001, practiceRef: { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: 11 } })],
      ['sealed code', article('Server article', { contentVersionId: 1001, practiceRef: { contentCode: 'p1.placement.v1', contentVersionId: 1001, questionItemId: '9' } })],
    ]
    for (const [name, detail] of refusals) {
      const refused = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
      opened.push(refused)
      presetReadingPosition(refused)
      refused.behaviors.getImpl = async () => detail
      refused.lifecycle.show()
      await settle()
      const stored = refused.storage.get(READING_LOCAL_KEY)
      assert.equal(refused.fixture.state.value, 'ready', name)
      assert.equal(refused.fixture.practiceReady.value, false, name)
      assert.equal(refused.fixture.practiceLabel.value, copyZh.writesClosed, name)
      assert.equal(refused.fixture.blockIndex.value, 1, name)
      await refused.fixture.continuePublishedPractice()
      await settle()
      assert.equal(refused.calls.sessions.length, 0, name)
      assert.equal(refused.calls.created, 0, name)
      assert.deepEqual(refused.calls.navigation, [], name)
      assert.equal(refused.practiceHold.practice, null, name)
      assert.equal(refused.practiceHold.remembered, null, name)
      assert.equal(refused.storage.get(READING_LOCAL_KEY), stored, name)
      assert.equal(refused.calls.save + refused.calls.submit + refused.calls.mine, 0, name)
    }

    const switched = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(switched)
    presetReadingPosition(switched)
    switched.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    switched.lifecycle.show()
    await settle()
    const switchedStored = switched.storage.get(READING_LOCAL_KEY)
    const switchedGate = deferred()
    switched.behaviors.sessionImpl = () => switchedGate.promise
    const pendingSwitch = switched.fixture.continuePublishedPractice()
    switched.location.hash = '#/pages/b11-reading/b11-reading'
    switched.dispatch('hashchange')
    switchedGate.resolve(publishedPracticeSession())
    await pendingSwitch
    await settle()
    assert.equal(switched.calls.sessions.length, 1)
    assert.deepEqual(switched.calls.navigation, [])
    assert.equal(switched.practiceHold.practice, null)
    assert.equal(switched.practiceHold.remembered, null)
    assert.equal(switched.calls.created, 0)
    assert.equal(switched.storage.get(READING_LOCAL_KEY), switchedStored)
    assert.equal(switched.fixture.article.value, null)

    const hiddenPractice = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(hiddenPractice)
    presetReadingPosition(hiddenPractice)
    hiddenPractice.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    hiddenPractice.lifecycle.show()
    await settle()
    const hiddenStored = hiddenPractice.storage.get(READING_LOCAL_KEY)
    const hiddenGate = deferred()
    hiddenPractice.behaviors.sessionImpl = () => hiddenGate.promise
    const pendingHidden = hiddenPractice.fixture.continuePublishedPractice()
    hiddenPractice.setHidden(true)
    hiddenPractice.dispatch('visibilitychange')
    hiddenGate.resolve(publishedPracticeSession())
    await pendingHidden
    await settle()
    assert.equal(hiddenPractice.fixture.state.value, 'idle')
    assert.deepEqual(hiddenPractice.calls.navigation, [])
    assert.equal(hiddenPractice.practiceHold.practice, null)
    assert.equal(hiddenPractice.storage.get(READING_LOCAL_KEY), hiddenStored)
    assert.equal(hiddenPractice.calls.created, 0)

    const versionDrop = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(versionDrop)
    presetReadingPosition(versionDrop)
    versionDrop.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    versionDrop.lifecycle.show()
    await settle()
    const versionStored = versionDrop.storage.get(READING_LOCAL_KEY)
    const versionGate = deferred()
    versionDrop.behaviors.sessionImpl = () => versionGate.promise
    const pendingVersion = versionDrop.fixture.continuePublishedPractice()
    versionDrop.fixture.article.value = { ...versionDrop.fixture.article.value, contentVersionId: 1002 }
    versionGate.resolve(publishedPracticeSession())
    await pendingVersion
    await settle()
    assert.equal(versionDrop.fixture.state.value, 'ready')
    assert.equal(versionDrop.fixture.article.value.title, 'Server article')
    assert.deepEqual(versionDrop.calls.navigation, [])
    assert.equal(versionDrop.practiceHold.practice, null)
    assert.equal(versionDrop.storage.get(READING_LOCAL_KEY), versionStored)
    assert.equal(versionDrop.calls.created, 0)

    const actorDrop = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(actorDrop)
    presetReadingPosition(actorDrop)
    actorDrop.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    actorDrop.lifecycle.show()
    await settle()
    const actorGate = deferred()
    actorDrop.behaviors.sessionImpl = () => actorGate.promise
    const pendingActor = actorDrop.fixture.continuePublishedPractice()
    actorDrop.session.identityRevision += 1
    actorGate.resolve(publishedPracticeSession())
    await pendingActor
    await settle()
    assert.equal(actorDrop.fixture.state.value, 'ready')
    assert.equal(actorDrop.fixture.article.value.title, 'Server article')
    assert.deepEqual(actorDrop.calls.navigation, [])
    assert.equal(actorDrop.practiceHold.practice, null)
    assert.equal(actorDrop.calls.sessions.length, 1)
    assert.equal(actorDrop.calls.created, 0)
    assert.equal(JSON.parse(actorDrop.storage.get(READING_LOCAL_KEY)).blockIndex, 1)

    const authDrop = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(authDrop)
    presetReadingPosition(authDrop)
    authDrop.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    authDrop.lifecycle.show()
    await settle()
    const authStored = authDrop.storage.get(READING_LOCAL_KEY)
    const authGate = deferred()
    authDrop.behaviors.sessionImpl = () => authGate.promise
    const pendingAuth = authDrop.fixture.continuePublishedPractice()
    authDrop.session.adultGate = 'UNKNOWN'
    authGate.resolve(publishedPracticeSession())
    await pendingAuth
    await settle()
    assert.equal(authDrop.fixture.state.value, 'auth-403')
    assert.equal(authDrop.fixture.article.value, null)
    assert.deepEqual(authDrop.calls.navigation, [])
    assert.equal(authDrop.practiceHold.practice, null)
    assert.equal(authDrop.storage.get(READING_LOCAL_KEY), authStored)
    assert.equal(authDrop.calls.created, 0)

    const badSession = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(badSession)
    presetReadingPosition(badSession)
    badSession.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    badSession.behaviors.sessionImpl = async () => publishedPracticeSession({
      exercises: [{ exerciseId: 4, itemId: 4, contentVersionId: 1002 }],
    })
    badSession.lifecycle.show()
    await settle()
    const badStored = badSession.storage.get(READING_LOCAL_KEY)
    await badSession.fixture.continuePublishedPractice()
    await settle()
    assert.equal(badSession.fixture.state.value, 'error')
    assert.equal(badSession.fixture.article.value, null)
    assert.equal(badSession.calls.sessions.length, 1)
    assert.equal(badSession.calls.created, 0)
    assert.deepEqual(badSession.calls.navigation, [])
    assert.equal(badSession.practiceHold.practice, null)
    assert.equal(badSession.storage.get(READING_LOCAL_KEY), badStored)
    assert.equal(badSession.calls.save + badSession.calls.submit + badSession.calls.mine, 0)

    const staleSession = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(staleSession)
    presetReadingPosition(staleSession)
    staleSession.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    staleSession.behaviors.sessionImpl = async () => { throw new staleSession.MobileApiError('version raw', 410, null) }
    staleSession.lifecycle.show()
    await settle()
    const staleStored = staleSession.storage.get(READING_LOCAL_KEY)
    await staleSession.fixture.continuePublishedPractice()
    await settle()
    assert.equal(staleSession.fixture.state.value, 'stale')
    assert.equal(staleSession.fixture.article.value, null)
    assert.deepEqual(staleSession.calls.navigation, [])
    assert.equal(staleSession.practiceHold.practice, null)
    assert.equal(staleSession.storage.get(READING_LOCAL_KEY), staleStored)

    const deniedSession = loadPage('src/pages/b3-reading/b3-reading.vue', '#/pages/b3-reading/b3-reading', PRACTICE_FIELDS)
    opened.push(deniedSession)
    presetReadingPosition(deniedSession)
    deniedSession.behaviors.getImpl = async () => article('Server article', { contentVersionId: 1001, practiceRef: detailRef })
    deniedSession.behaviors.sessionImpl = async () => { throw new deniedSession.MobileApiError('signed out', 401, null) }
    deniedSession.lifecycle.show()
    await settle()
    await deniedSession.fixture.continuePublishedPractice()
    await settle()
    assert.equal(deniedSession.fixture.state.value, 'auth-401')
    assert.equal(deniedSession.fixture.article.value, null)
    assert.deepEqual(deniedSession.calls.navigation, [])
    assert.equal(deniedSession.practiceHold.practice, null)
    assert.equal(deniedSession.calls.created, 0)

    const gradedPage = loadPage('src/pages/b11-reading/b11-reading.vue', '#/pages/b11-reading/b11-reading')
    opened.push(gradedPage)
    gradedPage.lifecycle.show()
    await settle()
    assert.equal(gradedPage.fixture.graded, true)
    assert.equal(gradedPage.calls.sessions.length, 0)
    assert.equal(gradedPage.calls.created, 0)
    assert.equal(gradedPage.calls.save + gradedPage.calls.submit + gradedPage.calls.mine, 0)
    assert.equal(copyZh.comprehensionClosed, '理解检查尚未开放')
  } finally {
    for (const page of opened) page.dispose()
    delete globalThis.window
    delete globalThis.document
    delete globalThis.getCurrentPages
  }
})

test('published reading practice keeps the detail pin and drops a substituted session', () => {
  const permit = {
    visible: true, epoch: 2, requestEpoch: 2, requestId: 5, activeRequestId: 5,
    subject: 'owner-a', liveSubject: 'owner-a', revision: 4, liveRevision: 4,
    adultPassed: true, consentAllowsLearning: true, learningReady: true,
  }
  const ready = (overrides = {}) => ({
    articleId: 11,
    title: 'Server article',
    cefrLevel: 'B1',
    wordCount: 2,
    estimatedMinutes: 1,
    blocks: [{ blockId: 'p1', blockIndex: 0, text: 'Visible sentence.', translation: null }],
    rightsStatus: 'AUTHORIZED',
    availability: null,
    contentVersionId: 1001,
    contentEpoch: 3,
    practiceRef: { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: '9' },
    ...overrides,
  })
  assert.deepEqual(domain.readingPracticePin(ready()), PUBLISHED_PIN)
  assert.equal(domain.readingPracticeReady(ready(), permit), true)
  assert.equal(domain.readingPracticeReady(ready(), { ...permit, visible: false }), false)
  assert.equal(domain.readingPracticeReady(ready(), { ...permit, adultPassed: false }), false)
  assert.equal(domain.readingPracticePin(ready({ practiceRef: undefined })), null)
  assert.equal(domain.readingPracticePin(ready({ practiceRef: { contentCode: 'reading.unit.one', contentVersionId: '1001', questionItemId: '9' } })), null)
  assert.equal(domain.readingPracticePin(ready({ practiceRef: { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: 11 } })), null)
  assert.equal(domain.readingPracticePin(ready({ practiceRef: { contentCode: 'p1.placement.v1', contentVersionId: 1001, questionItemId: '9' } })), null)
  assert.equal(domain.readingPracticePin(ready({ contentVersionId: '1001' })), null)
  assert.equal(domain.readingPracticePin(ready({ practiceRef: { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: '09' } })), null)
  assert.deepEqual(domain.readingPracticePin(ready({ practiceRef: { contentCode: 'reading.unit.one', contentVersionId: 1001, questionItemId: ' 9 ' } })), PUBLISHED_PIN)
  assert.equal(domain.readingPracticeSessionBody({ ...PUBLISHED_PIN, contentCode: 'p1.placement.v1' }), null)
  assert.deepEqual(domain.readingPracticeSessionBody(PUBLISHED_PIN), {
    contentCode: 'reading.unit.one',
    contentVersionId: 1001,
    mode: 'PRACTICE',
    itemIds: [9],
    clientSessionRef: 'h5-reading-1001-9',
  })

  const raw = (mutate) => {
    const body = {
      sessionId: 'asess_reading_1001_9',
      status: 'IN_PROGRESS',
      mode: 'PRACTICE',
      pin: { contentCode: 'reading.unit.one', contentVersionId: 1001, pinStatus: 'PINNED' },
      items: [{ itemId: 9, stem: 'A published stem', options: [{ optionId: 'a', label: 'Alpha' }] }],
    }
    if (mutate) mutate(body)
    return { data: body }
  }
  assert.equal(domain.readingPracticeResponseAccepted(raw(), PUBLISHED_PIN), true)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.pinStatus = 'SUBSTITUTED' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.contentVersionId = 1002 }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.contentVersionId = '1001' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.items.push({ itemId: 10 }) }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.score = 1 }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.scoreBucket = 'FULL' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.savedReceipt = 'saved' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.correct = true }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.isCorrect = false }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.items[0].itemId = '9' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { delete body.pin.pinStatus }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.alternativeContentVersionId = 25001 }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.alternativeContentCode = 'course-b25-basics' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.mode = 'PLACEMENT' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.pin.contentCode = 'p1.placement.v1' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw(), { ...PUBLISHED_PIN, contentCode: 'p1.placement.v1' }), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.items[0].correctOption = 'a' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeResponseAccepted(raw((body) => { body.sessionId = 'sess_reading' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession(), PUBLISHED_PIN), true)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ exercises: [{ exerciseId: 9, itemId: 9, contentVersionId: 1001 }] }), PUBLISHED_PIN), true)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ exercises: [{ exerciseId: 9, itemId: 9, contentVersionId: 1002 }] }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ exercises: [{ exerciseId: 4, itemId: 4, contentVersionId: null }] }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ exercises: [{ exerciseId: 9, itemId: 9, contentVersionId: null }, { exerciseId: 10, itemId: 10, contentVersionId: null }] }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ sessionType: 'PLACEMENT' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ status: 'CREATED' }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ score: 1 }), PUBLISHED_PIN), false)
  assert.equal(domain.readingPracticeParsedAccepted(publishedPracticeSession({ sessionId: 'unknown-session' }), PUBLISHED_PIN), false)
  const readbackEntry = { sessionId: 'asess_reading_1001_9', ...PUBLISHED_PIN }
  assert.equal(domain.READING_PRACTICE_ENTRY_PATH, '/pages/b2-practice/b2-practice?entry=reading')
  assert.equal(domain.READING_PRACTICE_ENTRY_PATH.includes('asess_'), false)
  assert.equal(domain.READING_PRACTICE_ENTRY_PATH.includes('sessionId'), false)
  assert.equal(domain.readingPracticeEntryMarked({ entry: 'reading', sessionId: 'asess_forged', id: 'asess_forged' }), true)
  assert.equal(domain.readingPracticeEntryMarked({ sessionId: 'asess_forged' }), false)
  assert.equal(domain.readingPracticeEntryMarked(null), false)
  assert.equal(domain.readingPracticeEntryFresh(1000, 1000), true)
  assert.equal(domain.readingPracticeEntryFresh(1000, 1000 + domain.READING_PRACTICE_ENTRY_MS - 1), true)
  assert.equal(domain.readingPracticeEntryFresh(1000, 1000 + domain.READING_PRACTICE_ENTRY_MS), false)
  assert.equal(domain.readingPracticeEntryFresh(1000, 999), false)
  assert.equal(domain.readingPracticeReadbackAccepted(raw(), readbackEntry), true)
  assert.equal(domain.readingPracticeReadbackAccepted(raw((body) => { body.sessionId = 'asess_other_session' }), readbackEntry), false)
  assert.equal(domain.readingPracticeReadbackAccepted(raw((body) => { body.pin.contentVersionId = 1002 }), readbackEntry), false)
  assert.equal(domain.readingPracticeReadbackAccepted(raw((body) => { body.items[0].itemId = 10 }), readbackEntry), false)
  assert.equal(domain.readingPracticeReadbackAccepted(raw((body) => { body.pin.contentCode = 'reading.other' }), readbackEntry), false)
  assert.equal(domain.readingPracticeEntry('asess_reading_1001_9', PUBLISHED_PIN).sessionId, 'asess_reading_1001_9')
  assert.equal(domain.readingPracticeEntry('sess_reading', PUBLISHED_PIN), null)

  const b3 = read('src/pages/b3-reading/b3-reading.vue')
  const b11 = read('src/pages/b11-reading/b11-reading.vue')
  const closedStart = b3.indexOf('<view class="reading-closed"')
  const closed = b3.slice(closedStart, b3.indexOf('</view>', closedStart))
  assert.match(closed, /data-action="published-practice"/)
  assert.match(closed, /\{\{ practiceLabel \}\}/)
  assert.doesNotMatch(closed, /writesClosed/)
  assert.match(closed, /v-if="!practiceReady"/)
  assert.match(closed, /noServerReceipt/)
  assert.match(closed, /:disabled="!practiceReady"/)
  assert.match(closed, /:aria-disabled="h5AriaDisabled\(practiceReady\)"/)
  assert.match(closed, /:tabindex="h5TabIndex\(practiceReady\)"/)
  assert.match(closed, /@keyup\.enter\.stop\.prevent="activatePublishedPractice"/)
  assert.match(closed, /@keyup\.space\.stop\.prevent="activatePublishedPractice"/)
  const check = b3.slice(b3.indexOf('class="reading-check"'), b3.indexOf('class="reading-closed"'))
  assert.doesNotMatch(check, /published-practice|continuePublishedPractice|openReadingPracticeSession/)
  assert.match(b3, /v-if="graded" class="reading-check"/)
  assert.match(b3, /openUniPage\(READING_PRACTICE_ENTRY_PATH\)/)
  assert.doesNotMatch(b3, /useB10LearningStore\(\)\.practice = opened/)
  assert.match(b3, /openUniPage\('\/pages\/practice\/practice'\)/)
  assert.match(b3, /practiceRef: source\.practiceRef/)
  assert.ok(b3.indexOf('function activatePublishedPractice') < b3.indexOf('function focusParagraphNav'))
  assert.ok(b3.indexOf('function focusParagraphNav') < b3.indexOf('function backToPractice'))
  assert.ok(b3.indexOf('function backToPractice') < b3.indexOf('async function continuePublishedPractice'))
  assert.doesNotMatch(b3, /createAssessmentSession|\/attempts|25001|scoreBucket|FULL|ZERO|data-save-receipt|data-pack-notice|packNotice\(/)
  assert.match(b3, /data-write-capability="closed"/)
  assert.match(b3, /data-server-receipt="none"/)
  assert.match(b11, /const graded = true/)
  assert.match(b11, /v-if="graded" class="reading-check"/)
  assert.match(b11, /comprehensionClosed/)
  assert.match(b11, /<text>\{\{ t\('writesClosed'\) \}\}<\/text>/)
  assert.doesNotMatch(b11, /published-practice|continuePublished|openReadingPracticeSession|practiceReady/)

  const api = read('src/api/b10.ts')
  const listAt = api.indexOf('async listReadingArticles')
  const getAt = api.indexOf('async getReadingArticle')
  const openAt = api.indexOf('async openReadingPracticeSession')
  const saveAt = api.indexOf('async saveReadingProgress')
  assert.ok(listAt < getAt && getAt < openAt && openAt < saveAt)
  assert.doesNotMatch(api.slice(listAt, getAt), /retainPracticeRef/)
  assert.match(api.slice(getAt, openAt), /retainPracticeRef:\s*true/)
  assert.equal((api.match(/retainPracticeRef:\s*true/g) ?? []).length, 1)
  const openSlice = api.slice(openAt, saveAt)
  assert.doesNotMatch(openSlice, /\/attempts|25001|createAssessmentSession|submitReading|scoreBucket|FULL|ZERO/)
  assert.match(openSlice, /headers\(context, body\.clientSessionRef\)/)
  assert.match(openSlice, /B10_GATEWAY_PATHS\.assessment\.sessions/)
  assert.match(openSlice, /method:\s*'POST'/)
  assert.equal((openSlice.match(/method:\s*'POST'/g) ?? []).length, 1)
  assert.ok(api.indexOf('async readPinnedReadingSession') > openAt)
  assert.ok(api.indexOf('async readPinnedReadingSession') < saveAt)
  assert.match(api, /function publishedReadingResponseMatches/)
  assert.match(api, /pinStatus !== 'PINNED'/)
  assert.match(api, /alternativeContentVersionId/)
  assert.match(api, /SEALED_PLACEMENT_CONTENT_CODE = 'p1\.placement\.v1'/)
  assert.match(api, /startsWith\('asess_'\)/)
  assert.match(api, /publishedReadingPracticeRef\(articleId, source\.contentVersionId, source\.practiceRef\)/)
  assert.match(api, /contentVersionId: nullableNumber\(source\.contentVersionId\)/)
  const createAt = api.indexOf('async createAssessmentSession')
  const readAt = api.indexOf('async readAssessmentSession')
  assert.match(api.slice(createAt, readAt), /contentVersionId: 25001/)
})

const B10_KEY = 'yx.b10.mobile.learning.v1'
const NAV_KEY = 'yx.navigation.query.v1'
const PIN_URL = '/assessment/sessions/asess_reading_1001_9?contentLocale=ja-JP'
const OLD_URL = '/assessment/sessions/asess_old_daily?contentLocale=ja-JP'
const CREATE_URL = '/assessment/sessions?contentLocale=ja-JP'
const ENTRY_MISMATCH = '练习会话没有对上当前文章版本。'
const ENTRY_UNVERIFIED = '这次阅读练习入口无法核对，请从文章重新打开。'

function oldPractice() {
  return {
    sessionId: 'asess_old_daily',
    sessionType: 'DAILY_STREAM',
    status: 'IN_PROGRESS',
    exercises: [{ exerciseId: 4, questionId: 4, prompt: 'OLD STEM', questionType: 'CHOICE', options: [{ key: 'a', text: 'Old option' }] }],
    answerSheet: [],
    lastCheckpointSeq: 0,
    stateVersion: 1,
  }
}

function oldSaved() {
  return {
    subject: 'owner-a',
    revision: 4,
    sessionId: 'iam-1',
    practice: oldPractice(),
    answers: { '4': { selectedKey: 'a' } },
    answerResults: { '4': { exerciseId: 4, isCorrect: true, savedReceipt: 'old-receipt', scoringStatus: 'SCORED' } },
  }
}

function readingWire(sessionId = 'asess_reading_1001_9', mutate) {
  const body = {
    sessionId,
    status: 'IN_PROGRESS',
    mode: 'PRACTICE',
    pin: { contentCode: 'reading.unit.one', contentVersionId: 1001, pinStatus: 'PINNED' },
    items: [{ itemId: 9, stem: 'A published stem', options: [{ optionId: 'a', label: 'Alpha' }] }],
  }
  if (mutate) mutate(body)
  return { data: body }
}

function tallyOf(list) {
  return {
    pinned: list.filter((item) => item.url === PIN_URL && item.options == null).length,
    created: list.filter((item) => item.options?.method === 'POST' && item.url === CREATE_URL).length,
    readOld: list.filter((item) => item.url === OLD_URL && item.options == null).length,
    submits: list.filter((item) => String(item.url).includes('/attempts') || item.options?.method === 'PUT' || item.options?.method === 'PATCH').length,
    other: list.filter((item) => item.url !== PIN_URL && item.url !== OLD_URL && !(item.options?.method === 'POST' && item.url === CREATE_URL)).length,
  }
}

function compileModule(relativePath, modules) {
  const source = read(relativePath)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

test('reading practice entry reads one pinned session and leaves legacy load on its own route', async () => {
  const previousUni = globalThis.uni
  const previousNow = Date.now
  let clock = 1_700_000_000_000
  Date.now = () => clock
  const requests = []
  let requestSink = async () => { throw new Error('assessment request before a harness') }
  const opened = []
  class MobileApiError extends Error {
    constructor(message, status, details) {
      super(message)
      this.name = 'MobileApiError'
      this.status = status
      this.details = details
    }
  }
  const api = compileModule('src/api/b10.ts', {
    './unavailable': { unavailableOperation: async () => { throw new Error('closed') } },
    './client': { MobileApiError, mobileApiClient: { request: (url, options) => requestSink(url, options) } },
    '../domain/grammar-reading-pack': { mentionsClosedMissing: () => false, PACK_CLOSED_COPY: 'closed' },
    './b3': { listGrammarExercises: async () => [] },
    '../domain/grammar-page': {
      grammarPreviewItems: () => [],
      grammarQuestionItemId(value) { return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null },
      parseGrammarPointContent: () => null,
    },
    '../platform/client-id': { createClientId: (prefix) => `${prefix}-1` },
  })
  const uniRuntime = loadTsModule('src/platform/uni-runtime.ts')
  const practiceLoop = loadTsModule('src/domain/practice-loop.ts')
  const dailyWire = { sessionId: 'asess_daily_created', sessionType: 'DAILY_STREAM', status: 'IN_PROGRESS', items: [{ itemId: 3, stem: 'Daily stem', options: [{ optionId: 'a', label: 'A' }] }] }
  const oldWire = { sessionId: 'asess_old_daily', sessionType: 'DAILY_STREAM', status: 'IN_PROGRESS', items: [{ itemId: 4, stem: 'OLD STEM', options: [{ optionId: 'a', label: 'Old option' }] }] }
  let pinResult = () => readingWire()
  async function respond(url, options) {
    requests.push({ url, options: options ?? null })
    if (options?.method === 'POST' && url === CREATE_URL) return { data: dailyWire }
    if (url === OLD_URL && (options == null || options.method == null)) return { data: oldWire }
    if (url === PIN_URL && (options == null || options.method == null)) return pinResult()
    throw new Error(`unexpected ${options?.method ?? 'GET'} ${url}`)
  }
  requestSink = respond
  function holdNext() {
    const gate = deferred()
    const next = requestSink
    requestSink = (url, options) => {
      requests.push({ url, options: options ?? null })
      requestSink = next
      return gate.promise
    }
    return gate
  }
  function b10Writes(writes) { return writes.filter((item) => item.key === B10_KEY) }
  function loadStore(session) {
    const b10UiLocale = vue.ref('zh-CN')
    const b10ContentLocale = vue.ref('ja-JP')
    const scope = vue.effectScope()
    let setupState = null
    const loaded = compileModule('src/stores/b10-learning.ts', {
      vue,
      pinia: {
        defineStore(_id, setup) {
          scope.run(() => { setupState = setup() })
          const store = {}
          for (const [key, value] of Object.entries(setupState)) {
            if (vue.isRef(value)) {
              Object.defineProperty(store, key, {
                enumerable: true,
                get() { return value.value },
                set(next) { value.value = next },
              })
            } else store[key] = value
          }
          return () => store
        },
      },
      '../api/b10': api,
      '../platform/b10-foundation': { b10UiLocale, b10ContentLocale },
      '../platform/uni-runtime': uniRuntime,
      './session': { useSessionStore: () => session },
      './learning-cache': {
        B10_LEARNING_STORAGE_KEY: B10_KEY,
        removeLearningCache(key) { try { uniRuntime.getUniRuntime().removeStorageSync(key) } catch { /* runtime may be absent */ } },
      },
    })
    return { store: loaded.useB10LearningStore(), scope }
  }
  function mountPage(store, session) {
    const lifecycle = {}
    const source = read('src/pages/b2-practice/b2-practice.vue')
    const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    const compiled = ts.transpileModule(`${script}
module.exports.__fixture = { viewState, exercise, accessGranted, load, retryLegacyLoad }
`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }
    const scope = vue.effectScope()
    const quality = { state: { level: 'High' }, subscribe(listener) { listener(this.state); return () => {} } }
    try {
      scope.run(() => {
        new Function('require', 'module', 'exports', compiled)((name) => {
          const modules = {
            vue: { ...vue, onUnmounted() {} },
            '@dcloudio/uni-app': {
              onShow(callback) { lifecycle.show = callback },
              onHide(callback) { lifecycle.hide = callback },
            },
            '../../components/MobilePageHeader.vue': {},
            '../../components/AppIcon.vue': {},
            '../../components/b10/B10ExerciseCard.vue': {},
            '../../components/b10/B10StatusPanel.vue': {},
            '../../domain/practice-loop': practiceLoop,
            '../../auth/navigation': { ensureMobilePageAccess: async () => true },
            '../../platform/experience': {
              mobileExperienceEngine: quality,
              mobileT: (key) => key,
              setMobileQuality() {},
              useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }),
            },
            '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light'), b10T: (key) => key },
            '../../stores/b10-learning': { useB10LearningStore: () => store },
            '../../platform/uni-runtime': uniRuntime,
            '../../stores/session': { useSessionStore: () => session },
          }
          if (!(name in modules)) throw new Error(`unexpected import ${name}`)
          return modules[name]
        }, module, module.exports)
      })
    } catch (error) {
      scope.stop()
      throw error
    }
    return { fixture: module.exports.__fixture, lifecycle, dispose() { scope.stop() } }
  }
  function createHarness(saved) {
    const storage = new Map()
    const writes = []
    const tabs = []
    if (saved) storage.set(B10_KEY, JSON.stringify(saved))
    globalThis.uni = {
      getStorageSync(key) { return storage.has(key) ? storage.get(key) : '' },
      setStorageSync(key, value) {
        const text = String(value)
        writes.push({ key, value: text })
        storage.set(key, text)
      },
      removeStorageSync(key) { storage.delete(key) },
      navigateTo() {},
      switchTab(options) { tabs.push(options.url) },
      request() {},
      showToast() {},
    }
    const session = vue.reactive({ verifiedSubject: 'owner-a', identityRevision: 4, isAuthenticated: true, sessionId: 'iam-1' })
    const loaded = loadStore(session)
    try {
      const page = mountPage(loaded.store, session)
      return {
        storage, writes, tabs, session, store: loaded.store, page,
        dispose() { page.dispose(); loaded.scope.stop() },
      }
    } catch (error) {
      loaded.scope.stop()
      throw error
    }
  }
  try {
    const storeSource = read('src/stores/b10-learning.ts')
    const b2 = read('src/pages/b2-practice/b2-practice.vue')
    const b11 = read('src/pages/b11-reading/b11-reading.vue')
    const readingFn = storeSource.slice(storeSource.indexOf('async function loadReadingPractice'), storeSource.indexOf('async function loadPractice'))
    const legacyFn = storeSource.slice(storeSource.indexOf('async function loadPractice'), storeSource.indexOf('async function submitAnswer'))
    assert.equal(domain.READING_PRACTICE_ENTRY_MS, 120_000)
    assert.match(storeSource, /const READING_PRACTICE_ENTRY_MS = 120_000/)
    assert.match(readingFn, /readPinnedReadingSession/)
    assert.doesNotMatch(readingFn, /persist\(|restore\(|DAILY_STREAM|25001|createAssessmentSession|readAssessmentSession|submitAssessment|saveAssessment|completeAssessment/)
    assert.match(legacyFn, /restore\(\); practiceStatus\.value = 'loading'/)
    assert.match(legacyFn, /sessionType: 'DAILY_STREAM'/)
    assert.match(legacyFn, /contentVersionId: 25001|createAssessmentSession/)
    assert.doesNotMatch(legacyFn, /readPinnedReadingSession|rememberReadingPractice/)
    assert.match(b2, /consumePendingNavigationQuery\('\/pages\/b2-practice\/b2-practice'\)/)
    assert.match(b2, /query\.entry === 'reading'/)
    assert.match(b2, /@retry="load"/)
    assert.doesNotMatch(b2, /domain\/reading-page|query\.sessionId|query\.id|asess_/)
    assert.doesNotMatch(b11, /readPinnedReadingSession|rememberReadingPractice|READING_PRACTICE_ENTRY_PATH|published-practice/)
    assert.equal(api.acceptPinnedReadingSession(publishedPracticeSession(), 'asess_reading_1001_9', PUBLISHED_PIN), true)
    assert.equal(api.acceptPinnedReadingSession(publishedPracticeSession(), 'asess_other_session', PUBLISHED_PIN), false)
    assert.equal(api.acceptPinnedReadingSession(publishedPracticeSession({ exercises: [{ exerciseId: 4, itemId: 4, contentVersionId: null }] }), 'asess_reading_1001_9', PUBLISHED_PIN), false)

    const seen = []
    requestSink = async (url, options) => {
      seen.push({ url, options: options ?? null })
      return readingWire()
    }
    const context = { uiLocale: 'zh-CN', contentLocale: 'ja-JP' }
    const beforeBadId = seen.length
    await assert.rejects(() => api.b10LearningApi.readPinnedReadingSession(context, 'asess_', PUBLISHED_PIN), (error) => error.status === 422)
    await assert.rejects(() => api.b10LearningApi.readPinnedReadingSession(context, 'sess_forged', PUBLISHED_PIN), (error) => error.status === 422)
    assert.equal(seen.length, beforeBadId)
    requestSink = async (url, options) => {
      seen.push({ url, options: options ?? null })
      return readingWire('asess_other_session')
    }
    await assert.rejects(() => api.b10LearningApi.readPinnedReadingSession(context, 'asess_reading_1001_9', PUBLISHED_PIN), (error) => error.status === 422 && error.message === ENTRY_MISMATCH)
    requestSink = async (url, options) => {
      seen.push({ url, options: options ?? null })
      return readingWire('asess_reading_1001_9', (body) => { body.pin.contentVersionId = 1002 })
    }
    await assert.rejects(() => api.b10LearningApi.readPinnedReadingSession(context, 'asess_reading_1001_9', PUBLISHED_PIN), (error) => error.status === 422)
    requestSink = async (url, options) => {
      seen.push({ url, options: options ?? null })
      return readingWire('asess_reading_1001_9', (body) => { body.items[0].correctOption = 'a' })
    }
    await assert.rejects(() => api.b10LearningApi.readPinnedReadingSession(context, 'asess_reading_1001_9', PUBLISHED_PIN), (error) => error.status === 422)
    assert.deepEqual(seen.map((item) => item.url), [PIN_URL, PIN_URL, PIN_URL])
    assert.deepEqual(seen.map((item) => item.options), [null, null, null])
    requestSink = respond
    requests.length = 0

    const handoff = createHarness(oldSaved())
    opened.push(handoff)
    handoff.store.practice = oldPractice()
    handoff.store.answers = { '4': { selectedKey: 'a' } }
    handoff.store.answerResults = { '4': { exerciseId: 4, isCorrect: true, savedReceipt: 'old-receipt', scoringStatus: 'SCORED' } }
    handoff.store.practiceStatus = 'ready'
    handoff.page.fixture.accessGranted.value = true
    assert.equal(handoff.page.fixture.viewState.value, 'finished')
    assert.equal(handoff.store.answerResults['4'].savedReceipt, 'old-receipt')
    const issued = clock
    assert.equal(handoff.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    assert.equal(handoff.store.practice.sessionId, 'asess_old_daily')
    assert.equal(handoff.store.readingPracticeEntryOpen(), true)
    const stored = handoff.storage.get(B10_KEY)
    uniRuntime.openUniPage(`${domain.READING_PRACTICE_ENTRY_PATH}&sessionId=asess_forged`)
    assert.deepEqual(handoff.tabs, ['/pages/b2-practice/b2-practice'])
    assert.deepEqual(JSON.parse(handoff.storage.get(NAV_KEY)), { path: '/pages/b2-practice/b2-practice', params: { entry: 'reading', sessionId: 'asess_forged' } })
    const firstRead = holdNext()
    await handoff.page.lifecycle.show()
    assert.equal(handoff.store.practice, null)
    assert.deepEqual(handoff.store.answers, {})
    assert.deepEqual(handoff.store.answerResults, {})
    assert.equal(handoff.page.fixture.exercise.value, null)
    assert.equal(handoff.page.fixture.viewState.value, 'loading')
    assert.equal(handoff.store.practiceStatus, 'loading')
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })
    assert.equal(requests[0].url, PIN_URL)
    assert.equal(requests[0].options, null)
    assert.equal(requests.some((item) => String(item.url).includes('asess_forged')), false)
    assert.equal(handoff.storage.get(B10_KEY), stored)
    assert.equal(b10Writes(handoff.writes).length, 0)
    firstRead.resolve(readingWire())
    await settle()
    assert.equal(handoff.store.practice.sessionId, 'asess_reading_1001_9')
    assert.equal(handoff.store.practice.sessionType, 'PRACTICE')
    assert.equal(handoff.store.practice.status, 'IN_PROGRESS')
    assert.equal(handoff.store.practice.exercises.length, 1)
    assert.equal(handoff.store.practice.exercises[0].exerciseId, 9)
    assert.equal(handoff.store.practice.exercises[0].prompt, 'A published stem')
    assert.equal(JSON.stringify(handoff.store.practice).includes('OLD STEM'), false)
    assert.equal(JSON.stringify(handoff.store.practice).includes('old-receipt'), false)
    assert.deepEqual(handoff.store.answers, {})
    assert.deepEqual(handoff.store.answerResults, {})
    assert.equal(handoff.page.fixture.viewState.value, 'exercise')
    assert.equal(handoff.page.fixture.exercise.value.exerciseId, 9)
    assert.equal(handoff.store.practiceMessage, null)
    assert.equal(handoff.store.readingPracticeVisible(), true)
    assert.equal(handoff.storage.get(B10_KEY), stored)
    assert.equal(stored.includes('asess_reading_1001_9'), false)
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })

    await handoff.page.lifecycle.show()
    await settle()
    assert.equal(handoff.page.fixture.exercise.value.exerciseId, 9)
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })
    assert.equal(handoff.storage.get(B10_KEY), stored)

    uniRuntime.openUniPage(`${domain.READING_PRACTICE_ENTRY_PATH}&sessionId=asess_forged`)
    const markedAgain = holdNext()
    await handoff.page.lifecycle.show()
    assert.equal(handoff.store.practice, null)
    assert.equal(handoff.page.fixture.exercise.value, null)
    assert.equal(requests[requests.length - 1].url, PIN_URL)
    assert.equal(requests[requests.length - 1].options, null)
    assert.deepEqual(tallyOf(requests), { pinned: 2, created: 0, readOld: 0, submits: 0, other: 0 })
    markedAgain.resolve(readingWire())
    await settle()
    assert.equal(handoff.page.fixture.exercise.value.exerciseId, 9)
    assert.equal(handoff.storage.get(B10_KEY), stored)
    assert.equal(b10Writes(handoff.writes).length, 0)

    clock = issued + domain.READING_PRACTICE_ENTRY_MS - 1
    await handoff.page.lifecycle.show()
    await settle()
    assert.equal(handoff.store.readingPracticeEntryOpen(), true)
    assert.equal(handoff.page.fixture.exercise.value.exerciseId, 9)
    assert.deepEqual(tallyOf(requests), { pinned: 2, created: 0, readOld: 0, submits: 0, other: 0 })
    clock = issued + domain.READING_PRACTICE_ENTRY_MS
    assert.equal(handoff.store.readingPracticeEntryOpen(), false)
    await handoff.page.lifecycle.show()
    await settle()
    assert.equal(handoff.store.practice.sessionId, 'asess_old_daily')
    assert.deepEqual(tallyOf(requests), { pinned: 2, created: 0, readOld: 1, submits: 0, other: 0 })
    assert.equal(b10Writes(handoff.writes).length, 1)
    assert.equal(b10Writes(handoff.writes)[0].value.includes('asess_reading_1001_9'), false)
    assert.equal(b10Writes(handoff.writes)[0].value.includes('reading.unit.one'), false)
    assert.equal(b10Writes(handoff.writes)[0].value.includes('asess_old_daily'), true)

    requests.length = 0
    clock = 1_700_000_000_000
    const legacyRead = createHarness(oldSaved())
    opened.push(legacyRead)
    assert.equal(legacyRead.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    assert.equal(legacyRead.store.readingPracticeEntryOpen(), true)
    await legacyRead.page.lifecycle.show()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, OLD_URL)
    assert.equal(requests[0].options, null)
    assert.equal(legacyRead.store.practice.sessionId, 'asess_old_daily')
    await settle()
    assert.equal(legacyRead.store.practice.sessionId, 'asess_old_daily')
    assert.equal(legacyRead.store.readingPracticeEntryOpen(), true)
    assert.deepEqual(tallyOf(requests), { pinned: 0, created: 0, readOld: 1, submits: 0, other: 0 })
    assert.equal(legacyRead.storage.get(B10_KEY).includes('asess_reading_1001_9'), false)

    requests.length = 0
    const legacyCreate = createHarness()
    opened.push(legacyCreate)
    assert.equal(legacyCreate.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    await legacyCreate.page.lifecycle.show()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, CREATE_URL)
    assert.equal(requests[0].options.method, 'POST')
    assert.equal(requests[0].options.data.contentVersionId, 25001)
    assert.equal(requests[0].options.data.mode, 'PRACTICE')
    assert.equal(requests[0].options.data.clientSessionRef, 'b10-assessment-session-1')
    await settle()
    assert.equal(legacyCreate.store.practice.sessionId, 'asess_daily_created')
    assert.equal(legacyCreate.store.readingPracticeEntryOpen(), true)
    assert.deepEqual(tallyOf(requests), { pinned: 0, created: 1, readOld: 0, submits: 0, other: 0 })
    assert.equal(legacyCreate.storage.get(B10_KEY).includes('asess_daily_created'), true)
    assert.equal(legacyCreate.storage.get(B10_KEY).includes('asess_reading_1001_9'), false)

    requests.length = 0
    const conflict = createHarness(oldSaved())
    opened.push(conflict)
    conflict.store.practice = oldPractice()
    conflict.store.answers = { '4': { selectedKey: 'a' } }
    conflict.store.answerResults = { '4': { exerciseId: 4, isCorrect: true, savedReceipt: 'old-receipt' } }
    const conflictStored = conflict.storage.get(B10_KEY)
    assert.equal(conflict.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    uniRuntime.openUniPage(domain.READING_PRACTICE_ENTRY_PATH)
    pinResult = () => readingWire('asess_other_session')
    await conflict.page.lifecycle.show()
    await settle()
    assert.equal(conflict.store.practice, null)
    assert.deepEqual(conflict.store.answers, {})
    assert.deepEqual(conflict.store.answerResults, {})
    assert.equal(conflict.page.fixture.exercise.value, null)
    assert.equal(conflict.page.fixture.viewState.value, 'unavailable')
    assert.equal(conflict.store.practiceStatus, 'error')
    assert.equal(conflict.store.practiceMessage, ENTRY_MISMATCH)
    assert.equal(conflict.store.readingPracticeEntryOpen(), true)
    assert.equal(conflict.storage.get(B10_KEY), conflictStored)
    assert.equal(b10Writes(conflict.writes).length, 0)
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })
    pinResult = () => readingWire()
    const conflictRetry = holdNext()
    conflict.page.fixture.retryLegacyLoad()
    assert.equal(conflict.store.practice, null)
    assert.equal(requests.length, 2)
    assert.equal(requests[1].url, PIN_URL)
    assert.equal(requests[1].options, null)
    conflictRetry.resolve(readingWire())
    await settle()
    assert.equal(conflict.page.fixture.viewState.value, 'exercise')
    assert.equal(conflict.page.fixture.exercise.value.exerciseId, 9)
    assert.equal(conflict.store.practice.sessionId, 'asess_reading_1001_9')
    assert.equal(conflict.storage.get(B10_KEY), conflictStored)
    assert.deepEqual(tallyOf(requests), { pinned: 2, created: 0, readOld: 0, submits: 0, other: 0 })

    requests.length = 0
    const forged = createHarness(oldSaved())
    opened.push(forged)
    forged.store.practice = oldPractice()
    forged.store.answers = { '4': { selectedKey: 'a' } }
    forged.store.answerResults = { '4': { savedReceipt: 'old-receipt' } }
    forged.page.fixture.accessGranted.value = true
    const forgedStored = forged.storage.get(B10_KEY)
    uniRuntime.openUniPage(`${domain.READING_PRACTICE_ENTRY_PATH}&sessionId=asess_forged`)
    await forged.page.lifecycle.show()
    await settle()
    assert.equal(forged.store.practice, null)
    assert.deepEqual(forged.store.answers, {})
    assert.equal(forged.page.fixture.exercise.value, null)
    assert.equal(forged.page.fixture.viewState.value, 'unavailable')
    assert.equal(forged.store.practiceMessage, ENTRY_UNVERIFIED)
    assert.equal(forged.storage.get(B10_KEY), forgedStored)
    assert.equal(b10Writes(forged.writes).length, 0)
    assert.deepEqual(tallyOf(requests), { pinned: 0, created: 0, readOld: 0, submits: 0, other: 0 })
    forged.page.fixture.retryLegacyLoad()
    await settle()
    assert.equal(forged.store.practice, null)
    assert.equal(forged.store.practiceMessage, ENTRY_UNVERIFIED)
    assert.deepEqual(tallyOf(requests), { pinned: 0, created: 0, readOld: 0, submits: 0, other: 0 })

    requests.length = 0
    const actor = createHarness(oldSaved())
    opened.push(actor)
    actor.store.practice = oldPractice()
    assert.equal(actor.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    uniRuntime.openUniPage(domain.READING_PRACTICE_ENTRY_PATH)
    const actorRead = holdNext()
    await actor.page.lifecycle.show()
    assert.equal(requests.length, 1)
    assert.equal(requests[0].url, PIN_URL)
    assert.equal(actor.store.practice, null)
    actor.session.verifiedSubject = 'owner-b'
    assert.equal(actor.store.practice, null)
    assert.equal(actor.store.readingPracticeEntryOpen(), false)
    assert.equal(actor.storage.has(B10_KEY), false)
    actorRead.resolve(readingWire())
    await settle()
    assert.equal(actor.store.practice, null)
    assert.equal(actor.store.practiceStatus === 'ready', false)
    assert.equal(actor.page.fixture.exercise.value, null)
    assert.equal(actor.storage.has(B10_KEY), false)
    assert.equal(b10Writes(actor.writes).some((item) => item.value.includes('asess_reading_1001_9')), false)
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })

    requests.length = 0
    const hidden = createHarness(oldSaved())
    opened.push(hidden)
    hidden.store.practice = oldPractice()
    hidden.store.answerResults = { '4': { savedReceipt: 'old-receipt' } }
    const hiddenStored = hidden.storage.get(B10_KEY)
    assert.equal(hidden.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    uniRuntime.openUniPage(domain.READING_PRACTICE_ENTRY_PATH)
    const hiddenRead = holdNext()
    await hidden.page.lifecycle.show()
    assert.equal(hidden.store.practice, null)
    assert.equal(requests.length, 1)
    hidden.page.lifecycle.hide()
    hiddenRead.resolve(readingWire())
    await settle()
    assert.equal(hidden.store.practice, null)
    assert.equal(hidden.page.fixture.exercise.value, null)
    assert.equal(hidden.store.readingPracticeEntryOpen(), true)
    assert.equal(hidden.storage.get(B10_KEY), hiddenStored)
    assert.equal(b10Writes(hidden.writes).length, 0)
    assert.deepEqual(tallyOf(requests), { pinned: 1, created: 0, readOld: 0, submits: 0, other: 0 })
    const hiddenRetry = holdNext()
    await hidden.page.lifecycle.show()
    assert.equal(hidden.store.practice, null)
    assert.equal(requests.length, 2)
    assert.equal(requests[1].url, PIN_URL)
    assert.equal(requests[1].options, null)
    hiddenRetry.resolve(readingWire())
    await settle()
    assert.equal(hidden.page.fixture.exercise.value.exerciseId, 9)
    assert.equal(hidden.store.practice.sessionId, 'asess_reading_1001_9')
    assert.equal(hidden.storage.get(B10_KEY), hiddenStored)
    assert.deepEqual(tallyOf(requests), { pinned: 2, created: 0, readOld: 0, submits: 0, other: 0 })

    requests.length = 0
    clock = 1_700_000_000_000
    const expired = createHarness(oldSaved())
    opened.push(expired)
    expired.store.practice = oldPractice()
    expired.store.answers = { '4': { selectedKey: 'a' } }
    expired.store.answerResults = { '4': { savedReceipt: 'old-receipt' } }
    const expiredStored = expired.storage.get(B10_KEY)
    const expiredIssued = clock
    assert.equal(expired.store.rememberReadingPractice(publishedPracticeSession(), PUBLISHED_PIN), true)
    clock = expiredIssued + domain.READING_PRACTICE_ENTRY_MS
    assert.equal(expired.store.readingPracticeEntryOpen(), false)
    uniRuntime.openUniPage(domain.READING_PRACTICE_ENTRY_PATH)
    await expired.page.lifecycle.show()
    await settle()
    assert.equal(expired.store.practice, null)
    assert.deepEqual(expired.store.answers, {})
    assert.deepEqual(expired.store.answerResults, {})
    assert.equal(expired.page.fixture.exercise.value, null)
    assert.equal(expired.page.fixture.viewState.value, 'unavailable')
    assert.equal(expired.store.practiceStatus, 'error')
    assert.equal(expired.store.practiceMessage, ENTRY_UNVERIFIED)
    assert.equal(expired.storage.get(B10_KEY), expiredStored)
    assert.equal(b10Writes(expired.writes).length, 0)
    assert.deepEqual(tallyOf(requests), { pinned: 0, created: 0, readOld: 0, submits: 0, other: 0 })

    const calls = { load: 0 }
    const shown = []
    const requestsBeforeReplica = requests.length
    const replicaStore = vue.reactive({
      practiceStatus: 'idle',
      practiceMessage: null,
      practice: null,
      answerResults: {},
      async loadPractice() { calls.load += 1 },
    })
    const replicaSession = vue.reactive({ identityRevision: 1, isAuthenticated: true })
    const replicaSource = read('src/pages/b2-practice/b2-practice.vue')
    const replicaScript = replicaSource.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
    const replicaCompiled = ts.transpileModule(replicaScript, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const replicaModule = { exports: {} }
    new Function('require', 'module', 'exports', replicaCompiled)((name) => {
      const modules = {
        vue: { ...vue, onUnmounted() {} },
        '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback) },
        '../../components/MobilePageHeader.vue': {},
        '../../components/AppIcon.vue': {},
        '../../components/b10/B10ExerciseCard.vue': {},
        '../../components/b10/B10StatusPanel.vue': {},
        '../../domain/practice-loop': practiceLoop,
        '../../auth/navigation': { ensureMobilePageAccess: async () => true },
        '../../platform/experience': {
          mobileExperienceEngine: { state: { level: 'High' }, subscribe(listener) { listener({ level: 'High' }); return () => {} } },
          mobileT: (key) => key,
          setMobileQuality() {},
          useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on', theme: 'light' }),
        },
        '../../platform/b10-foundation': { b10ThemeMode: vue.ref('light'), b10T: (key) => key },
        '../../stores/b10-learning': { useB10LearningStore: () => replicaStore },
        '../../platform/uni-runtime': { openUniPage() {}, getUniRuntime: () => ({ navigateTo() {} }) },
        '../../stores/session': { useSessionStore: () => replicaSession },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, replicaModule, replicaModule.exports)
    await shown[0]()
    assert.equal(calls.load, 1)
    await shown[0]()
    assert.equal(calls.load, 2)
    assert.equal(requests.length, requestsBeforeReplica)
  } finally {
    for (const item of opened) item.dispose()
    Date.now = previousNow
    if (previousUni === undefined) delete globalThis.uni
    else globalThis.uni = previousUni
  }
})
