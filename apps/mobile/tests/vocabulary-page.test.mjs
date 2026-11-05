import test from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
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
  const hide = page.slice(page.indexOf('onHide('), page.indexOf('onUnmounted('))
  const unmount = page.slice(page.indexOf('onUnmounted('), page.indexOf('</script>'))
  const identityStart = page.indexOf('watch(() => session.identityRevision')
  const identityBody = page.slice(identityStart, page.indexOf('onShow(async () => {'))
  assert.equal(present.indexOf('onVocabularyRoute()') >= 0, true)
  assert.ok(present.indexOf('onVocabularyRoute()') < present.indexOf('loadCurrentFront'))
  assert.match(present, /await store\.loadCurrentFront\(card\)/)
  assert.doesNotMatch(present, /revealCard|getVocabularyDetail|restore\(|setMobileQuality|setLevel/)
  assert.ok(reload.indexOf('loadSrs') < reload.indexOf('presentFront'))
  assert.ok(reload.indexOf('onVocabularyRoute()') < reload.indexOf('loadSrs'))
  assert.ok(reload.indexOf('activeEpoch !== showEpoch') < reload.indexOf('loadSrs'))
  assert.ok(reload.indexOf('verifiedOwner()') < reload.indexOf('loadSrs'))
  assert.doesNotMatch(reload, /revealCard|restore\(/)
  assert.match(show, /ensureMobilePageAccess\(VOCAB_ROUTE\)/)
  assert.match(show, /onVocabularyRoute\(\)/)
  const gateAt = show.indexOf('await ensureMobilePageAccess(VOCAB_ROUTE)')
  assert.ok(gateAt > show.indexOf('++showEpoch'))
  assert.ok(gateAt > show.indexOf('const prior = verifiedOwner()'))
  const accepted = show.slice(gateAt)
  assert.match(accepted, /epoch !== showEpoch/)
  assert.match(accepted, /!allowed/)
  assert.match(accepted, /onVocabularyRoute\(\)/)
  assert.match(accepted, /const owner = verifiedOwner\(\)/)
  assert.match(accepted, /if \(!owner\) return/)
  assert.match(accepted, /prior\.subject !== owner\.subject/)
  assert.match(accepted, /prior\.revision !== owner\.revision/)
  assert.ok(accepted.indexOf('if (!owner) return') < accepted.indexOf('reloadOwned(epoch, owner)'))
  assert.ok(accepted.indexOf('prior.revision !== owner.revision') < accepted.indexOf('reloadOwned(epoch, owner)'))
  assert.doesNotMatch(show, /const request = generation|sameOwner\(|restore\(|loadCurrentFront|setMobileQuality|loadSrs/)
  assert.match(identityBody, /generation\s*\+=\s*1/)
  assert.doesNotMatch(identityBody, /showEpoch|loadSrs|reloadOwned/)
  for (const lifecycle of [hide, unmount]) {
    assert.match(lifecycle, /showEpoch\s*\+=\s*1/)
    assert.match(lifecycle, /generation\s*\+=\s*1/)
    assert.match(lifecycle, /clearFrontPresentation\(\)/)
    assert.doesNotMatch(lifecycle, /loadSrs|revealCard|rateCard/)
  }
  assert.match(page, /createInnerAudioContext/)
  assert.equal((page.match(/createInnerAudioContext/g) || []).length, 1)
  const cardWatch = page.slice(page.indexOf('watch(() => `${store.batch'), page.indexOf('watch(() => session.identityRevision'))
  assert.match(cardWatch, /presentFront/)
  assert.doesNotMatch(cardWatch, /revealCard|rateCard|loadSrs/)
})

test('vocab frame assets match the manifest bytes and grammar assets stay out', () => {
  const vocabPrefix = 'apps/mobile/src/static/figma-vocabulary-core/'
  const vocab = [
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-audio-167-6316/5d4371f4-7ffa-4533-bd86-2e0c20b19328.svg', sha256: 'd0ae6293f1fe6e8c0520372241fa81bb618bafaa4877c422075158e68dc42c41', bytes: 1413 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-audio-167-6316/64a0971a-8939-41cc-8d71-da6ee23a676e.svg', sha256: 'dc07b1cbedd928261790ce09fbc8b23c840cfd5fd214124ceac10bd4ff30e274', bytes: 223 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-audio-167-6316/6604364c-8fb0-4ad6-9be2-15dda01af4e1.svg', sha256: 'cbdb6a618dc4dc2fbbb595a90530229d961c2884997c7a6b468ef1bc1baeeaee', bytes: 671 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-audio-167-6316/e516f758-8835-4c7e-8b09-6020faf2ad26.svg', sha256: 'c7b88cc39c611f508d30b35543fa8fc5cc3b3f8a2cfb4d44a9ca64c18eaf1a2e', bytes: 1059 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-back-167-6396/105f1e1d-8a0b-4bbb-802d-f0280a27c185.svg', sha256: '2020e6a5b862275a4e81592563f5e43fc5c3ab30dec9608bc84def5e97b05b1b', bytes: 930 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-back-167-6396/123337de-a571-469c-81d7-46d763dd9135.svg', sha256: '3ee59986c5a070468507af076bde68ece657b598e9c7949334213f4052e13cef', bytes: 671 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-back-167-6396/3fdb6f26-b853-4e11-9dd7-c3d983d7ec85.svg', sha256: 'bc4956982d0e5e00851880192a2f0f5dfbbb4ed17d4833446b5c6fbc4654949b', bytes: 1661 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-back-167-6396/79df3e3a-6339-461d-8961-aece0f974e30.svg', sha256: 'c7b88cc39c611f508d30b35543fa8fc5cc3b3f8a2cfb4d44a9ca64c18eaf1a2e', bytes: 1059 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-back-167-6396/8486098e-e285-4cbf-bf51-032efaa58746.svg', sha256: 'dc07b1cbedd928261790ce09fbc8b23c840cfd5fd214124ceac10bd4ff30e274', bytes: 223 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/37d4406e-cf0b-4245-98a6-292a407c70f1.svg', sha256: 'c7b88cc39c611f508d30b35543fa8fc5cc3b3f8a2cfb4d44a9ca64c18eaf1a2e', bytes: 1059 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/5f5a80c3-c2ea-4eea-9403-c7b2634b6bb0.svg', sha256: '0b015a81c7ff411b7a0f11e0d6cee1a04e514ae98aead444c80fef12024b91cf', bytes: 472 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/a4cfe528-73e0-4035-9e86-be19a2826e43.svg', sha256: '404a3754c7054e96443c359a9846af71a63d9040081e22e72480910f475bb141', bytes: 331 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/b9a6b0b4-7e51-482f-af9d-271990e14dd4.svg', sha256: '80f2e7e311c11871771d523ff73650bfcebfa95c099c91d7a56e34e30acacf1e', bytes: 975 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/c27a197c-0abe-4272-a96e-29532bb973a6.svg', sha256: '8a20771c33521a32eae490cdc6d748a2e35cbdf5e0bf8cab9964bf3cddf004be', bytes: 223 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/c6ec15d8-f987-40a0-9cda-232e90222e5e.svg', sha256: 'efeff703eb6b829e5925e18ac7ebe9518e39672239a2614ec415368f99394965', bytes: 671 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/c9666ad3-f22f-44ae-b401-37f1e5c2fdc0.svg', sha256: '108e55c9f0b90015b8d3bd925fcde72adb48c0bff779341eb2518e2ffa3cf753', bytes: 498 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/d802b28d-9a6e-4900-990a-6135ceb64f42.svg', sha256: 'dc07b1cbedd928261790ce09fbc8b23c840cfd5fd214124ceac10bd4ff30e274', bytes: 223 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-complete-167-6927/ec034b5f-f7ea-4dbb-b837-35d2943c09b3.svg', sha256: 'bf42fb6a37a2ddf539e6314b11e1bbe42605ffb2326001838927e1ab2aba0ecb', bytes: 740 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-front-167-6151/5049469a-71df-4f14-a6d6-5578f1ef0e8f.svg', sha256: 'cbdb6a618dc4dc2fbbb595a90530229d961c2884997c7a6b468ef1bc1baeeaee', bytes: 671 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-front-167-6151/56241daf-28ee-4ed6-95c7-f9e8a7ab7eac.svg', sha256: 'c7b88cc39c611f508d30b35543fa8fc5cc3b3f8a2cfb4d44a9ca64c18eaf1a2e', bytes: 1059 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-front-167-6151/603828ac-fbae-4fc2-9643-8185f44cd4c8.svg', sha256: 'bc4956982d0e5e00851880192a2f0f5dfbbb4ed17d4833446b5c6fbc4654949b', bytes: 1661 },
    { path: 'apps/mobile/src/static/figma-vocabulary-core/vocab-front-167-6151/8c893a6b-672e-4bd2-a608-b76b63a49ad8.svg', sha256: 'dc07b1cbedd928261790ce09fbc8b23c840cfd5fd214124ceac10bd4ff30e274', bytes: 223 },
  ]
  assert.equal(vocab.length, 22)
  for (const asset of vocab) {
    const relative = String(asset.path).slice(vocabPrefix.length)
    const reference = relative.split('/')[0]
    const filename = path.basename(asset.path)
    assert.equal(reference.startsWith('vocab-'), true, relative)
    assert.equal(asset.path, `${vocabPrefix}${reference}/${filename}`)
    const copied = path.join(staticRoot, reference, filename)
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
