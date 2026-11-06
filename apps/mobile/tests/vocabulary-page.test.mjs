import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const manifestPath = '/Users/Admin/.codex/visualizations/2026/11/03/01a1a18a-8cb9-7053-8d08-264d34af2235/mobile-supervision/figma-reference/learning-next-core-assets-manifest.json'
const staticRoot = path.join(appRoot, 'src/static/figma-vocabulary-core')

function loadTs(file) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const dirname = path.dirname(file)
  new Function('require', 'module', 'exports', compiled)((request) => {
    if (!request.startsWith('.')) throw new Error(`Unexpected import ${request} from ${file}`)
    const resolved = path.resolve(dirname, request.endsWith('.ts') ? request : `${request}.ts`)
    return loadTs(resolved)
  }, module, module.exports)
  return module.exports
}

const { mapVocabularyPage, VOCABULARY_PAGE_DEPENDENCY } = loadTs(path.join(appRoot, 'src/domain/vocabulary-page.ts'))
const { vocabularyPageCopy } = loadTs(path.join(repoRoot, 'packages/i18n/src/mobile-resources/vocabulary-page.ts'))
const page = fs.readFileSync(path.join(appRoot, 'src/pages/b2-vocabulary/b2-vocabulary.vue'), 'utf8')
const template = page.slice(page.indexOf('<template>'))

function card(overrides = {}) {
  return {
    id: 'card-1',
    title: null,
    revealed: false,
    reviewStatus: 'PENDING',
    stateVersion: 1,
    snapshotId: 9,
    sourceReason: 'NEW',
    masteryStatus: 'LEARNING',
    ...overrides,
  }
}

function stringsOf(value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((item) => stringsOf(item, out))
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => stringsOf(item, out))
  return out
}

test('missing spelling stays empty and planted answers stay out of the view', () => {
  const secret = 'SECRET-MEANING-XYZ'
  const view = mapVocabularyPage({
    status: 'ready',
    batchStatus: 'ACTIVE',
    items: [card()],
    current: card({
      meaningCn: secret,
      definitionEn: secret,
      examples: [secret],
      exampleItems: [{ sentenceEn: secret, sentenceCn: secret }],
      dueLocalDate: '2099-01-01',
      hint: secret,
      audio: { us: 'https://cdn.example/secret.mp3' },
    }),
    queueCount: 0,
    message: '复习记录不会出现在正面',
  })
  const encoded = JSON.stringify(view)
  assert.equal(view.phase, 'front')
  assert.equal(view.frontTitle, null)
  assert.equal(view.frontMissing, true)
  assert.equal(view.showAnswer, false)
  assert.equal(view.meaning, null)
  assert.equal(view.definition, null)
  assert.equal(view.examples, null)
  assert.equal(view.due, null)
  assert.equal(view.audioMode, 'silent')
  assert.equal(view.dependency, VOCABULARY_PAGE_DEPENDENCY)
  assert.equal(view.capability, 'C2_FRONT_CURRENT')
  assert.equal(encoded.includes(secret), false)
  assert.equal(encoded.includes('secret.mp3'), false)
  assert.equal(encoded.includes('学习项'), false)
  assert.equal(encoded.includes('retrieve'), false)
  assert.equal(view.revealEnabled, true)
  assert.equal(view.ratingEnabled, false)
  assert.equal(view.ratingBlock, 'not-revealed')
})

test('a real batch title and batch audio can show before reveal', () => {
  const view = mapVocabularyPage({
    status: 'ready',
    items: [card({ title: 'bridge', phonetic: '/brɪdʒ/', audioUrl: 'https://cdn.example/bridge.mp3' })],
    current: card({ title: 'bridge', phonetic: '/brɪdʒ/', audioUrl: 'https://cdn.example/bridge.mp3' }),
    queueCount: 0,
  })
  assert.equal(view.frontTitle, 'bridge')
  assert.equal(view.frontMissing, false)
  assert.equal(view.phonetic, '/brɪdʒ/')
  assert.equal(view.audioMode, 'play')
  assert.equal(JSON.stringify(view).includes('cdn.example'), false)
  assert.equal(view.meaning, null)
})

test('reveal shows only the returned back and keeps a null version from rating', () => {
  const revealed = card({
    title: 'bridge',
    revealed: true,
    meaningCn: '桥',
    definitionEn: 'a structure',
    exampleItems: [{ sentenceEn: 'Cross the bridge.', sentenceCn: '过桥。' }],
    dueLocalDate: '2026-11-20',
    stateVersion: null,
    audio: { uk: 'https://cdn.example/uk.mp3' },
  })
  const view = mapVocabularyPage({ status: 'ready', items: [revealed], current: revealed, queueCount: 0 })
  assert.equal(view.phase, 'back')
  assert.equal(view.showAnswer, true)
  assert.equal(view.meaning, '桥')
  assert.equal(view.definition, 'a structure')
  assert.deepEqual(view.examples, [{ sentenceEn: 'Cross the bridge.', sentenceCn: '过桥。' }])
  assert.equal(view.due, '2026-11-20')
  assert.equal(view.audioMode, 'play')
  assert.equal(view.ratingEnabled, false)
  assert.equal(view.ratingBlock, 'missing-version')
  assert.equal(view.completed, false)
})

test('state version zero can rate and a missing snapshot cannot', () => {
  const ready = card({ title: 'bridge', revealed: true, stateVersion: 0, snapshotId: 4 })
  const rated = mapVocabularyPage({ status: 'ready', items: [ready], current: ready, queueCount: 0 })
  assert.equal(rated.ratingEnabled, true)
  assert.equal(rated.ratingBlock, 'ready')
  const missingSnapshot = card({ title: 'bridge', revealed: true, stateVersion: 2, snapshotId: 0 })
  const blocked = mapVocabularyPage({ status: 'ready', items: [missingSnapshot], current: missingSnapshot, queueCount: 0 })
  assert.equal(blocked.ratingBlock, 'missing-snapshot')
  assert.equal(blocked.ratingEnabled, false)
})

test('recovery and untrusted evidence block the study surface without copying the store message', () => {
  const current = card({ title: 'bridge', revealed: true, meaningCn: '桥' })
  const recovery = mapVocabularyPage({
    status: 'stale',
    batchStatus: 'RECOVERY_REQUIRED',
    items: [current],
    current,
    queueCount: 0,
    message: '复习记录待核验，暂不可结算。',
  })
  assert.equal(recovery.phase, 'blocked')
  assert.equal(recovery.notice, 'recovery')
  assert.equal(recovery.ratingEnabled, false)
  assert.equal(recovery.revealEnabled, false)
  assert.equal(recovery.completed, false)
  assert.equal(recovery.showAnswer, false)
  assert.equal(stringsOf(recovery).includes('复习记录待核验，暂不可结算。'), false)
  const untrusted = mapVocabularyPage({
    status: 'error',
    items: [{ ...current, reviewStatus: 'FAILED' }],
    current: { ...current, reviewStatus: 'FAILED' },
    queueCount: 0,
    message: 'UNTRUSTED_REVIEW_EVIDENCE 这个操作现在不能用',
  })
  assert.equal(untrusted.phase, 'blocked')
  assert.equal(untrusted.notice, 'untrusted')
  assert.equal(untrusted.ratingEnabled, false)
  assert.equal(JSON.stringify(untrusted).includes('UNTRUSTED_REVIEW_EVIDENCE'), false)
  assert.equal(JSON.stringify(untrusted).includes('这个操作现在不能用'), false)
})

test('queued work is not completion and does not enable another rating', () => {
  const queued = card({ title: 'bridge', revealed: true, reviewStatus: 'QUEUED', stateVersion: 3 })
  const view = mapVocabularyPage({
    status: 'offline',
    items: [queued, card({ id: 'card-2', reviewStatus: 'ACCEPTED', revealed: true })],
    current: queued,
    queueCount: 1,
    message: '本次复习已排队待同步，服务端尚未确认掌握变化。',
  })
  assert.equal(view.completed, false)
  assert.equal(view.phase, 'blocked')
  assert.equal(view.notice, 'queued')
  assert.equal(view.ratingEnabled, false)
  assert.equal(view.ratingBlock, 'queued')
  assert.equal(view.acceptedCount, 1)
  assert.equal(view.syncWaiting, true)
  assert.equal(view.showAnswer, false)
  assert.notEqual(view.phase, 'complete')
})

test('completion requires every card accepted, an empty queue, and no current card', () => {
  const items = [card({ reviewStatus: 'ACCEPTED', revealed: true, title: 'one' }), card({ id: 'card-2', reviewStatus: 'ACCEPTED', revealed: true, title: 'two' })]
  const waiting = mapVocabularyPage({ status: 'ready', items, current: null, queueCount: 1 })
  assert.equal(waiting.completed, false)
  assert.notEqual(waiting.phase, 'complete')
  const done = mapVocabularyPage({ status: 'ready', items, current: null, queueCount: 0 })
  assert.equal(done.completed, true)
  assert.equal(done.phase, 'complete')
  assert.equal(done.acceptedCount, 2)
  assert.equal(done.ratingEnabled, false)
  assert.equal(done.showAnswer, false)
  assert.equal(done.frontTitle, null)
})

test('known source and mastery labels stay mapped and unknown codes are omitted', () => {
  const current = card({ sourceReason: 'DUE', masteryStatus: 'AT_RISK', title: 'bridge' })
  const view = mapVocabularyPage({ status: 'ready', items: [current], current, queueCount: 0 })
  assert.equal(view.source, 'review')
  assert.equal(view.mastery, 'hold')
  const unknown = card({ sourceReason: 'EXPRESSION', masteryStatus: 'CUSTOM', title: 'bridge' })
  const hidden = mapVocabularyPage({ status: 'ready', items: [unknown], current: unknown, queueCount: 0 })
  assert.equal(hidden.source, null)
  assert.equal(hidden.mastery, null)
})

test('vocabulary copy is localized and does not invent a sample word', () => {
  const zh = vocabularyPageCopy(false)
  const en = vocabularyPageCopy(true)
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.equal(zh.navTitle, '单词复习')
  assert.equal(en.navTitle, 'Word review')
  assert.equal(zh.missingFrontTitle.includes('学习项'), false)
  assert.equal(en.missingFrontTitle.toLowerCase().includes('retrieve'), false)
  assert.equal(JSON.stringify(en).includes('UNTRUSTED_REVIEW_EVIDENCE'), false)
  assert.equal(JSON.stringify(zh).includes('操作已生效'), false)
  for (const [key, value] of Object.entries(en)) {
    assert.equal(typeof value, 'string', key)
    assert.equal(/[\u4e00-\u9fff]/.test(value), false, key)
    assert.notEqual(value, zh[key], key)
  }
  const used = [...page.matchAll(/mobileT\('vocabularyPage\.([^']+)'\)/g)].map((match) => match[1])
  assert.ok(used.length > 20)
  for (const key of used) assert.equal(typeof zh[key], 'string', key)
})

test('the vocabulary page keeps the contract literals and does not own a second quality engine', () => {
  assert.match(page, /const completed = computed/)
  assert.match(page, /今日复习已完成/)
  for (const status of ['idle', 'loading', 'empty', 'offline', 'forbidden', 'stale']) {
    assert.match(page, new RegExp(`store\\.status === '${status}'`))
  }
  for (const label of ['忘了', '模糊', '记得', '很熟']) assert.match(page, new RegExp(label))
  assert.match(page, /b10-theme--/)
  assert.match(page, /contentLocale/)
  assert.match(page, /mobileExperienceEngine/)
  assert.match(page, /generation/)
  assert.match(page, /identityRevision/)
  assert.match(page, /onHide/)
  assert.match(page, /destroy\(/)
  assert.match(page, /figma-vocabulary-core/)
  assert.match(page, /data-c2-dependency="front"/)
  assert.equal((page.match(/mobileExperienceEngine\.restore\(\)/g) || []).length, 0)
  assert.match(page, /loadCurrentFront/)
  assert.match(page, /currentMobilePagePath\(''\)/)
  assert.match(page, /path === '\/'/)
  assert.match(page, /flush: 'sync'/)
  assert.match(page, /min-height: 56px/)
  assert.match(page, /min-height: 48px/)
  assert.match(page, /min-height: 44px/)
  assert.match(page, /max-width: 389px/)
  assert.match(page, /min-width: 768px/)
  assert.match(page, /prefers-reduced-motion/)
  assert.match(page, /data-motion/)
  assert.match(page, /overflow-wrap: anywhere/)
  assert.match(page, /safe-area-inset/)
  assert.doesNotMatch(page, /createAdaptivePerformanceEngine|setLevel|setMobileQuality|getVocabularyDetail|学习项|retrieve|C2_FRONT_PROJECTION_MISSING/)
  assert.doesNotMatch(template, /store\.message/)
  const rateFn = page.slice(page.indexOf('function rate('), page.indexOf('async function reload'))
  assert.ok(rateFn.indexOf('if (!view.value.ratingEnabled) return') >= 0)
  assert.ok(rateFn.indexOf('if (!view.value.ratingEnabled) return') < rateFn.indexOf('store.rateCard'))
  const identityWatch = page.slice(page.indexOf('watch(() => session.identityRevision'), page.indexOf("flush: 'sync'"))
  assert.doesNotMatch(identityWatch, /loadSrs|revealCard|rateCard/)
})

test('the glass card, hint, and bottom action dock stay separate at every listed width', () => {
  const glassStart = template.indexOf('class="vocab-card vocab-glass"')
  const tipStart = template.indexOf('class="vocab-tip"')
  const dockStart = template.indexOf('class="vocab-dock"')
  assert.ok(glassStart >= 0 && tipStart > glassStart && dockStart > tipStart)
  const glass = template.slice(glassStart, tipStart)
  const dock = template.slice(dockStart, template.lastIndexOf('</template>'))
  assert.match(glass, /vocab-back-head/)
  assert.match(glass, /vocab-sound-row/)
  assert.match(glass, /vocab-answer/)
  assert.match(glass, /vocab-silent-mark/)
  assert.doesNotMatch(glass, /vocab-cta|vocab-rate|vocab-quality|vocab-ratings/)
  assert.match(dock, /class="vocab-cta"/)
  assert.match(dock, /class="vocab-rate"/)
  assert.match(dock, /class="vocab-ratings"/)
  assert.match(page, /grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/)
  assert.match(page, /text-align: left/)
  assert.match(page, /position: fixed/)
  assert.match(page, /flex-wrap: wrap/)
  assert.match(page, /\/pages\/assessment\/assessment/)
  assert.match(page, /\/pages\/b10-report\/b10-report/)
  assert.doesNotMatch(page, /vocab-quality|syncReadyTitle|syncReadyBody|qualityLevels|function qualityText/)
  assert.doesNotMatch(template, /操作已生效|随时可以回看/)
  const narrow = page.slice(page.indexOf('@media (max-width: 389px)'), page.indexOf('@media (min-width: 768px)'))
  assert.doesNotMatch(narrow, /grid-template-columns|repeat\(2/)
  assert.match(page, /class="vocab-hero"/)
  assert.match(page, /class="vocab-ring"/)
  assert.match(page, /class="vocab-report-shortcut"/)
  assert.match(page, /\.yx-page\.vocab-page/)
  assert.match(page, /--yx-r4-home-image/)
  assert.match(page, /--yx-r4-cta-image/)
  assert.match(page, /--yx-r4-cta-color/)
  assert.match(page, /--yx-danger/)
  assert.match(page, /--yx-warning/)
  assert.match(page, /--yx-success/)
  assert.match(page, /min-height: 48px/)
  const style = page.slice(page.indexOf('<style'), page.lastIndexOf('</style>'))
  assert.doesNotMatch(style, /#[0-9a-fA-F]{3,8}\b|rgb\(|rgba\(|hsl\(/)
  const shortcut = template.slice(template.indexOf('vocab-report-shortcut'), template.indexOf('class="vocab-hero"'))
  assert.match(shortcut, /\/pages\/b10-report\/b10-report/)
  assert.doesNotMatch(shortcut, /open\('\/pages\/(?!b10-report\/b10-report)/)
})

test('a pending front hides the word and the answer until the current card is settled', () => {
  const secret = 'SECRET-BEFORE-FRONT'
  const pending = mapVocabularyPage({
    status: 'ready',
    items: [card({ title: 'bridge', meaningCn: secret, audioUrl: 'https://cdn.example/bridge.mp3' })],
    current: card({ title: 'bridge', meaningCn: secret, audioUrl: 'https://cdn.example/bridge.mp3' }),
    queueCount: 0,
    frontPending: true,
  })
  assert.equal(pending.phase, 'loading')
  assert.equal(pending.frontTitle, null)
  assert.equal(pending.showAnswer, false)
  assert.equal(pending.meaning, null)
  assert.equal(pending.audioMode, 'silent')
  assert.equal(pending.revealEnabled, false)
  assert.equal(JSON.stringify(pending).includes(secret), false)
  assert.equal(JSON.stringify(pending).includes('bridge'), false)
  const settled = mapVocabularyPage({
    status: 'ready',
    items: [card({ title: 'bridge', phonetic: '/brɪdʒ/', audioUrl: 'https://cdn.example/bridge.mp3', meaningCn: secret })],
    current: card({ title: 'bridge', phonetic: '/brɪdʒ/', audioUrl: 'https://cdn.example/bridge.mp3', meaningCn: secret }),
    queueCount: 0,
    frontPending: false,
  })
  assert.equal(settled.phase, 'front')
  assert.equal(settled.frontTitle, 'bridge')
  assert.equal(settled.showAnswer, false)
  assert.equal(settled.meaning, null)
  assert.equal(settled.audioMode, 'play')
})

test('a planted study-item label is not a front word', () => {
  const planted = mapVocabularyPage({
    status: 'ready',
    items: [card({ title: '学习项3' })],
    current: card({ title: '学习项3' }),
    queueCount: 0,
  })
  assert.equal(planted.frontTitle, null)
  assert.equal(planted.frontMissing, true)
  assert.equal(JSON.stringify(planted).includes('学习项'), false)
})

test('empty recovery with untrusted evidence stays blocked and is not an empty day', () => {
  const blocked = mapVocabularyPage({
    status: 'stale',
    batchStatus: 'RECOVERY_REQUIRED',
    reasonCode: 'UNTRUSTED_REVIEW_EVIDENCE',
    items: [],
    current: null,
    queueCount: 0,
    message: '复习记录待核验，暂不可结算。',
  })
  assert.equal(blocked.phase, 'blocked')
  assert.equal(blocked.notice, 'untrusted')
  assert.equal(blocked.completed, false)
  assert.equal(blocked.showAnswer, false)
  assert.equal(blocked.frontTitle, null)
  const empty = mapVocabularyPage({ status: 'empty', batchStatus: 'ACTIVE', items: [], current: null, queueCount: 0 })
  assert.equal(empty.phase, 'empty')
  assert.notEqual(empty.notice, 'untrusted')
  const forbidden = mapVocabularyPage({ status: 'forbidden', items: [], current: null, queueCount: 0 })
  assert.equal(forbidden.phase, 'blocked')
  assert.equal(forbidden.notice, 'forbidden')
  assert.notEqual(forbidden.phase, 'empty')
})

function compileVocabularyRoute() {
  const navigation = fs.readFileSync(path.join(appRoot, 'src/auth/navigation.ts'), 'utf8')
  const helpers = navigation.slice(navigation.indexOf('export function normalizeMobilePagePath'), navigation.indexOf('export function isMobilePublicPath')).replaceAll('export function', 'function')
  const decision = page.slice(page.indexOf('function onVocabularyRoute'), page.indexOf('const view = computed'))
  const source = `const HOME_PATH = '/pages/home/home'\nconst VOCAB_ROUTE = '/pages/b2-vocabulary/b2-vocabulary'\n${helpers}\n${decision}\nmodule.exports = { onVocabularyRoute }\n`
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('module', 'exports', compiled)(module, module.exports)
  return module.exports.onVocabularyRoute
}

function withRoute(apply) {
  const previousWindow = globalThis.window
  const previousPages = globalThis.getCurrentPages
  try {
    apply()
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
    if (previousPages === undefined) delete globalThis.getCurrentPages
    else globalThis.getCurrentPages = previousPages
  }
}

test('a hash-only H5 route is enough, a confirmed leave wins over a stale stack, and a missing hash uses the native page', () => {
  const onVocabularyRoute = compileVocabularyRoute()
  withRoute(() => {
    globalThis.window = { location: { hash: '#/pages/b2-vocabulary/b2-vocabulary' } }
    delete globalThis.getCurrentPages
    assert.equal(onVocabularyRoute(), true)
    globalThis.window = { location: { hash: '#/pages/b2-vocabulary/b2-vocabulary?from=home' } }
    assert.equal(onVocabularyRoute(), true)
    globalThis.window = { location: { hash: '#/pages/profile/profile' } }
    globalThis.getCurrentPages = () => [{ route: '/pages/b2-vocabulary/b2-vocabulary' }]
    assert.equal(onVocabularyRoute(), false)
    globalThis.window = { location: { hash: '#/' } }
    assert.equal(onVocabularyRoute(), false)
    globalThis.window = { location: { hash: '#/pages/home/home' } }
    assert.equal(onVocabularyRoute(), false)
    globalThis.window = { location: { hash: '' } }
    globalThis.getCurrentPages = () => [{ route: 'pages/b2-vocabulary/b2-vocabulary' }]
    assert.equal(onVocabularyRoute(), true)
    globalThis.getCurrentPages = () => [{ route: '/pages/home/home' }]
    assert.equal(onVocabularyRoute(), false)
    delete globalThis.window
    delete globalThis.getCurrentPages
    assert.equal(onVocabularyRoute(), false)
  })
})

test('the page awaits the current front on this route and does not restore quality on entry', () => {
  const present = page.slice(page.indexOf('async function presentFront'), page.indexOf('async function reload'))
  const reload = page.slice(page.indexOf('async function reload'), page.indexOf('function syncQueue'))
  const show = page.slice(page.indexOf('onShow(async () => {'), page.indexOf('onHide('))
  assert.equal(present.indexOf('onVocabularyRoute()') >= 0, true)
  assert.ok(present.indexOf('onVocabularyRoute()') < present.indexOf('loadCurrentFront'))
  assert.match(present, /await store\.loadCurrentFront\(card\)/)
  assert.doesNotMatch(present, /revealCard|getVocabularyDetail|restore\(|setMobileQuality|setLevel/)
  assert.ok(reload.indexOf('loadSrs') < reload.indexOf('presentFront'))
  assert.ok(reload.indexOf('onVocabularyRoute()') < reload.indexOf('loadSrs'))
  assert.doesNotMatch(reload, /revealCard|restore\(/)
  assert.match(show, /ensureMobilePageAccess\(VOCAB_ROUTE\)/)
  assert.match(show, /onVocabularyRoute\(\)/)
  assert.doesNotMatch(show, /restore\(|loadCurrentFront|setMobileQuality/)
  assert.match(page, /onHide\(\(\) => \{ generation \+= 1; clearFrontPresentation\(\) \}/)
  assert.match(page, /createInnerAudioContext/)
  assert.equal((page.match(/createInnerAudioContext/g) || []).length, 1)
  const cardWatch = page.slice(page.indexOf('watch(() => `${store.batch'), page.indexOf('watch(() => session.identityRevision'))
  assert.match(cardWatch, /presentFront/)
  assert.doesNotMatch(cardWatch, /revealCard|rateCard|loadSrs/)
})

test('vocab frame assets match the manifest bytes and grammar assets stay out', () => {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const vocab = manifest.assets.filter((asset) => String(asset.reference).startsWith('vocab-'))
  assert.equal(vocab.length, 22)
  for (const asset of vocab) {
    const filename = path.basename(asset.path)
    const copied = path.join(staticRoot, asset.reference, filename)
    const bytes = fs.readFileSync(copied)
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), asset.sha256, filename)
    assert.equal(bytes.length, asset.bytes, filename)
  }
  const copiedNames = []
  for (const reference of fs.readdirSync(staticRoot)) {
    assert.equal(reference.startsWith('vocab-'), true, reference)
    for (const filename of fs.readdirSync(path.join(staticRoot, reference))) copiedNames.push(`${reference}/${filename}`)
  }
  assert.equal(copiedNames.length, vocab.length)
  const used = [...page.matchAll(/\/static\/figma-vocabulary-core\/(vocab-[^'"\s]+)/g)].map((match) => match[1])
  assert.ok(used.length >= 16)
  for (const relative of used) assert.equal(fs.existsSync(path.join(staticRoot, relative)), true, relative)
})
