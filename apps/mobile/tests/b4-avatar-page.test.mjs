import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const pagePath = 'src/pages/b4-avatar/b4-avatar.vue'
const mapperPath = 'src/pages/b4-avatar/avatar-page.ts'
const req = createRequire(path.join(appRoot, 'package.json'))
const { parse, compileScript, compileTemplate } = req('@vue/compiler-sfc')
const { reactive } = req('vue')

function load(relativePath, modules) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${relativePath}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}
function deferred() { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const profile = (over = {}) => ({ profile: { renderMode: '2D_FALLBACK', ...over } })
const loadout = (id, over = {}) => ({ loadoutId: id, name: `Set ${id}`, equipped: false, items: [], ...over })
const item = (code, over = {}) => ({ itemCode: code, quality: 'COMMON', slot: 'HEAD', resourceVersion: 'v1', ...over })

function loadPage({ allowed = true, api = {}, performanceLevel = 'High' } = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'Missing avatar page script setup')
  const calls = { profile: 0, items: 0, loadouts: 0, resources: 0, navigate: [], restore: 0, quality: [] }
  const session = reactive({ isAuthenticated: true, verifiedSubject: 'A', identityRevision: 1, status: 'authenticated', restore: async () => {}, adultGate: 'PASSED', isLearningReady: true, refreshGateFromServer: async () => {} })
  const b4 = { performanceLevel, setPerformance(level) { this.performanceLevel = level; calls.quality.push(level) }, restore() { calls.restore += 1 } }
  const shown = []; const hidden = []; const mounted = []; const unmounted = []; const watchers = []
  const themeListeners = []
  class MobileApiError extends Error { constructor(status, message = String(status)) { super(message); this.status = status } }
  const apiImpl = {
    getB4AvatarProfile: async () => { calls.profile += 1; return profile() },
    listB4AvatarItems: async () => { calls.items += 1; return { items: [] } },
    listB4AvatarResources: async () => { calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['Ultra', 'High', 'Medium', 'Performance'] } },
    getB4AvatarResources: async () => { calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['Ultra', 'High', 'Medium', 'Performance'] } },
    listB4Loadouts: async () => { calls.loadouts += 1; return { items: [] } },
    ...api,
  }
  const mapper = load(mapperPath, {})
  const modules = {
    vue: { ...req('vue'), watch: (getter, callback) => { watchers.push(callback); return () => {} }, onMounted: (callback) => mounted.push(callback), onUnmounted: (callback) => unmounted.push(callback) },
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback), onHide: (callback) => hidden.push(callback) },
    '@englishflow/i18n': { interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_m, key) => String(values[key] ?? `{${key}}`)) },
    '../../components/MobilePageHeader.vue': {},
    '../../api/client': { MobileApiError },
    '../../api/b4': apiImpl,
    '../../auth/navigation': { ensureMobilePageAccess: async () => allowed },
    '../../domain/b4': { B4_PERFORMANCE_LEVELS: ['Ultra', 'High', 'Medium', 'Performance'] },
    '../../platform/experience': { mobileT: (key) => `mobile.${key}`, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }) },
    '../../platform/uni-runtime': { openUniPage: async (url) => { calls.navigate.push(url) } },
    '../../platform/b10-foundation': { b10ThemeMode: { value: 'light' } },
    '../../platform/v2-foundation': { mobileThemeController: { resolvedTheme: 'light', subscribe(listener) { listener({ resolvedTheme: 'light' }); themeListeners.push(listener); return () => {} } } },
    '../../stores/b4': { useB4Store: () => b4 },
    '../../stores/session': { useSessionStore: () => session },
    './avatar-page': mapper,
  }
  const names = ['loadAvatarPage', 'selectPerformance', 'openPreview', 'closePreview', 'retry', 'goWardrobe', 'backToGrowth', 'openLogin']
  const refs = ['pageState', 'permissionForbidden', 'profile', 'items', 'loadouts', 'resources', 'loadoutsError', 'itemsError', 'previewLoadout', 'currentId', 'currentName', 'previewSlots', 'manifestReady', 'qualityLabels', 'qualityIndex', 'resolvedTheme']
  const exported = `${script}\nexport const __test = { ${names.join(', ')} };\nexport const __refs = { ${refs.join(', ')} };\n`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
    return modules[name]
  }, module, module.exports)
  return { source, calls, session, b4, shown, hidden, mounted, unmounted, watchers, themeListeners, mobileApiError: (status) => new MobileApiError(status), test: module.exports.__test ?? {}, refs: module.exports.__refs ?? {} }
}

test('avatar mapper keeps unknown facts unknown and current is explicit only', () => {
  const mapper = load(mapperPath, {})
  const parsedProfile = mapper.parseAvatarProfile({ profile: { renderMode: '2D_FALLBACK' } })
  assert.deepEqual(parsedProfile, { avatarId: null, resourceVersion: null, loadoutId: null, renderMode: '2D_FALLBACK' })
  const parsedItems = mapper.parseAvatarItems({ items: [item('owned', { owned: true }), item('locked', { owned: false }), item('unknown'), { quality: 'RARE' }] })
  assert.equal(parsedItems.length, 3)
  assert.equal(parsedItems[0].owned, true)
  assert.equal(parsedItems[1].owned, false)
  assert.equal(parsedItems[2].owned, null)
  const loadouts = mapper.parseAvatarLoadouts({ items: [loadout('one'), loadout('two', { equipped: true })] })
  assert.equal(mapper.currentLoadoutId(parsedProfile, loadouts), 'two')
  assert.equal(mapper.currentLoadoutId(null, [loadout('a', { equipped: true }), loadout('b', { equipped: true })]), null)
  assert.equal(mapper.currentLoadoutId({ ...parsedProfile, loadoutId: 'one' }, loadouts), 'one')
  const resources = mapper.parseAvatarResources({ fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] })
  assert.equal(resources.manifestAvailable, false)
  assert.equal(resources.resourceVersion, null)
  assert.equal(mapper.qualityKey('UNKNOWN'), 'qualityUnknown')
  assert.equal(mapper.slotKey(null), 'slotUnknown')
  assert.equal(mapper.ownedKey(null), 'unknownOwnership')
})

test('avatar page guard denies private reads and shows permission', async () => {
  const page = loadPage({ allowed: false })
  await page.shown[0]()
  assert.equal(page.refs.pageState.value, 'permission')
  assert.equal(page.calls.profile, 0)
  assert.equal(page.calls.items, 0)
  assert.equal(page.calls.loadouts, 0)
  assert.equal(page.refs.items.value.length, 0)
})

test('avatar page refuses reads when adult gate is not learning-ready even if guard says allowed', async () => {
  const page = loadPage({ allowed: true })
  page.session.status = 'restoring'
  page.session.refreshGateFromServer = async () => { page.session.adultGate = 'REQUIRED'; page.session.isLearningReady = false }
  page.session.adultGate = 'PASSED'
  page.session.isLearningReady = true
  await page.shown[0]()
  assert.equal(page.refs.pageState.value, 'permission')
  assert.equal(page.calls.profile, 0)
  assert.equal(page.calls.items, 0)
  assert.equal(page.calls.loadouts, 0)
  assert.equal(page.calls.resources, 0)
})

test('avatar page maps real reads, unknown ownership and explicit current set', async () => {
  const page = loadPage({ api: {
    getB4AvatarProfile: async () => { page.calls.profile += 1; return profile({ loadoutId: 'two' }) },
    listB4AvatarItems: async () => { page.calls.items += 1; return { items: [item('a', { owned: true }), item('b', { owned: false }), item('c')] } },
    getB4AvatarResources: async () => { page.calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] } },
    listB4Loadouts: async () => { page.calls.loadouts += 1; return { items: [loadout('one'), loadout('two', { equipped: true })] } },
  } })
  await page.shown[0]()
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.currentId.value, 'two')
  assert.equal(page.refs.currentName.value, 'Set two')
  assert.deepEqual(page.refs.items.value.map((entry) => entry.owned), [true, false, null])
  assert.equal(page.refs.manifestReady.value, false)
  assert.equal(page.refs.profile.value.loadoutId, 'two')
})

test('avatar page 403 is explicit permission, not empty', async () => {
  const page = loadPage({ api: { getB4AvatarProfile: async () => { throw page.mobileApiError(403) } } })
  await page.shown[0]()
  assert.equal(page.refs.pageState.value, 'permission')
  assert.equal(page.refs.permissionForbidden.value, true)
  assert.equal(page.refs.items.value.length, 0)
})

test('avatar page late A reads cannot overwrite B and onHide clears private state', async () => {
  const aProfile = deferred(); const bProfile = deferred()
  const aItems = deferred(); const bItems = deferred()
  const aLoadouts = deferred(); const bLoadouts = deferred()
  const aResources = deferred(); const bResources = deferred()
  let batch = 1
  const page = loadPage({ api: {
    getB4AvatarProfile: async () => { page.calls.profile += 1; return (batch === 1 ? aProfile : bProfile).promise },
    listB4AvatarItems: async () => { page.calls.items += 1; return (batch === 1 ? aItems : bItems).promise },
    listB4Loadouts: async () => { page.calls.loadouts += 1; return (batch === 1 ? aLoadouts : bLoadouts).promise },
    getB4AvatarResources: async () => { page.calls.resources += 1; return (batch === 1 ? aResources : bResources).promise },
  } })
  const aLoad = page.shown[0]()
  await flush()
  page.session.verifiedSubject = 'B'; page.session.identityRevision = 2; batch = 2
  page.watchers[0]()
  await flush()
  aProfile.resolve(profile({ loadoutId: 'A' })); aItems.resolve({ items: [item('a')] }); aLoadouts.resolve({ items: [loadout('A')] }); aResources.resolve({})
  await aLoad; await flush()
  assert.equal(page.refs.profile.value, null)
  assert.equal(page.refs.items.value.length, 0)
  bProfile.resolve(profile({ loadoutId: 'B' })); bItems.resolve({ items: [item('b')] }); bLoadouts.resolve({ items: [loadout('B')] }); bResources.resolve({})
  await flush()
  assert.equal(page.refs.profile.value.loadoutId, 'B')
  assert.deepEqual(page.refs.items.value.map((entry) => entry.itemCode), ['b'])
  const bLoadout = page.refs.loadouts.value[0]
  page.test.openPreview(bLoadout)
  assert.equal(page.refs.previewLoadout.value.loadoutId, 'B')
  assert.equal(page.calls.profile, 2)
  page.test.closePreview()
  assert.equal(page.refs.previewLoadout.value, null)
  page.hidden[0]()
  assert.equal(page.refs.pageState.value, 'loading')
  assert.equal(page.refs.profile.value, null)
  assert.equal(page.refs.items.value.length, 0)
})

test('avatar page has no write action, local engine or local dictionary', () => {
  const page = loadPage()
  assert.doesNotMatch(page.source, /equipLoadout|saveB4AvatarProfile|createAdaptivePerformanceEngine|<AppIcon|✦/u)
  assert.doesNotMatch(page.source, /avatarText|const labels: Record<string, string> = \{ HEAD:/u)
  assert.match(page.source, /getB4AvatarProfile|listB4AvatarItems|listB4Loadouts|getB4AvatarResources/u)
  assert.match(page.source, /qualityHint/u); assert.match(page.source, /v2-avatar-muted/u)
  assert.match(page.source, /aria-modal="true"/u)
  assert.match(page.source, /disabled aria-disabled/u)
})

test('avatar page uses original SVG slots and avatarPage keys only', () => {
  const page = loadPage()
  const copy = load('../../packages/i18n/src/mobile-resources/avatar-page.ts', {}).avatarPageCopy
  const en = Object.keys(copy(true)).sort()
  const zh = Object.keys(copy(false)).sort()
  assert.deepEqual(en, zh)
  assert.ok(en.length >= 45)
  const assetPaths = [...page.source.matchAll(/\/static\/(figma-avatar-[^"']+\.svg)/g)].map((match) => match[1])
  assert.ok(assetPaths.length >= 5)
  for (const asset of assetPaths) assert.ok(fs.existsSync(path.join(appRoot, 'src/static', asset)), asset)
  assert.doesNotMatch(page.source, /[\u4e00-\u9fff]/u)
  assert.doesNotMatch(page.source, /AppIcon|✦|\.png/u)
})

test('avatar page SFC script and template compile', () => {
  const filename = path.join(appRoot, pagePath)
  const source = fs.readFileSync(filename, 'utf8')
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup)
  const id = 'avatar-page-sfc'
  const script = compileScript(descriptor, { id })
  assert.match(script.content, /loadAvatarPage/u)
  const template = compileTemplate({ source: descriptor.template.content, filename, id, compilerOptions: { isCustomElement: () => true, bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
})
