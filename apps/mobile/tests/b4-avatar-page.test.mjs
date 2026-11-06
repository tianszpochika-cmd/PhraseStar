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

function loadPage({ allowed = true, api = {}, performanceLevel = 'High', liveWatch = false } = {}) {
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
  const vue = req('vue')
  const modules = {
    vue: {
      ...vue,
      ...(liveWatch ? {} : { watch: (getter, callback) => { watchers.push(callback); return () => {} } }),
      onMounted: (callback) => mounted.push(callback),
      onUnmounted: (callback) => unmounted.push(callback),
    },
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
  const execute = () => {
    const module = { exports: {} }
    new Function('require', 'module', 'exports', compiled)((name) => {
      if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
      return modules[name]
    }, module, module.exports)
    return module
  }
  const scope = liveWatch ? vue.effectScope() : null
  const module = scope ? scope.run(execute) : execute()
  return { source, calls, session, b4, shown, hidden, mounted, unmounted, watchers, themeListeners, scope, mobileApiError: (status) => new MobileApiError(status), test: module.exports.__test ?? {}, refs: module.exports.__refs ?? {} }
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

test('avatar page onHide during held gate refresh releases with zero private reads', async () => {
  const gate = deferred()
  let refreshCalls = 0
  const page = loadPage()
  page.session.refreshGateFromServer = async () => { refreshCalls += 1; await gate.promise }
  const shown = page.shown[0]()
  await flush()
  page.hidden[0]()
  gate.resolve()
  await shown
  await flush()
  assert.equal(refreshCalls, 1)
  assert.equal(page.calls.profile, 0)
  assert.equal(page.calls.items, 0)
  assert.equal(page.calls.loadouts, 0)
  assert.equal(page.calls.resources, 0)
  assert.equal(page.refs.pageState.value, 'loading')
  assert.equal(page.refs.profile.value, null)
})

test('avatar page hidden A-to-B identity change clears but never refreshes or reads; opening B is fresh', async () => {
  const a = [deferred(), deferred(), deferred(), deferred()]
  const b = [deferred(), deferred(), deferred(), deferred()]
  let batch = 1
  let refreshCalls = 0
  const page = loadPage({ api: {
    getB4AvatarProfile: async () => { page.calls.profile += 1; return (batch === 1 ? a[0] : b[0]).promise },
    listB4AvatarItems: async () => { page.calls.items += 1; return (batch === 1 ? a[1] : b[1]).promise },
    listB4Loadouts: async () => { page.calls.loadouts += 1; return (batch === 1 ? a[2] : b[2]).promise },
    getB4AvatarResources: async () => { page.calls.resources += 1; return (batch === 1 ? a[3] : b[3]).promise },
  } })
  page.session.refreshGateFromServer = async () => { refreshCalls += 1 }
  const aLoad = page.shown[0]()
  await flush()
  page.hidden[0]()
  const refreshBeforeHidden = refreshCalls
  page.session.verifiedSubject = 'B'; page.session.identityRevision = 2; batch = 2
  page.watchers[0]()
  await flush()
  assert.equal(refreshCalls, refreshBeforeHidden)
  assert.equal(page.calls.profile, 1)
  assert.equal(page.calls.items, 1)
  a[0].resolve(profile({ loadoutId: 'A' })); a[1].resolve({ items: [item('a')] }); a[2].resolve({ items: [loadout('A')] }); a[3].resolve({})
  await aLoad; await flush()
  assert.equal(page.refs.profile.value, null)
  assert.equal(page.refs.items.value.length, 0)
  const bLoad = page.shown[0]()
  await flush()
  assert.equal(refreshCalls, refreshBeforeHidden + 1)
  assert.equal(page.calls.profile, 2)
  b[0].resolve(profile({ loadoutId: 'B' })); b[1].resolve({ items: [item('b')] }); b[2].resolve({ items: [loadout('B')] }); b[3].resolve({})
  await bLoad; await flush()
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.profile.value.loadoutId, 'B')
  assert.deepEqual(page.refs.items.value.map((entry) => entry.itemCode), ['b'])
})

test('avatar page retry during an active load is single-flight', async () => {
  const profileGate = deferred()
  const page = loadPage({ api: { getB4AvatarProfile: async () => { page.calls.profile += 1; return profileGate.promise } } })
  const shown = page.shown[0]()
  await flush()
  const first = page.calls.profile
  page.test.retry(); page.test.retry()
  await flush()
  assert.equal(page.calls.profile, first)
  profileGate.resolve(profile({ loadoutId: 'A' }))
  await shown; await flush()
  assert.equal(page.refs.pageState.value, 'ready')
})

test('avatar onShow adopts the owner when restore moves identity before auth is ready', async () => {
  const holder = {}
  const page = loadPage({ liveWatch: true, api: {
    getB4AvatarProfile: async () => { holder.calls.profile += 1; return profile({ loadoutId: holder.session.verifiedSubject || 'none' }) },
    listB4AvatarItems: async () => { holder.calls.items += 1; return { items: [item(holder.session.verifiedSubject || 'x')] } },
    listB4Loadouts: async () => { holder.calls.loadouts += 1; return { items: [loadout(holder.session.verifiedSubject || 'x', { equipped: true, name: `${holder.session.verifiedSubject} Set` })] } },
    getB4AvatarResources: async () => { holder.calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] } },
  } })
  holder.calls = page.calls
  holder.session = page.session
  page.refreshCalls = 0
  page.session.refreshGateFromServer = async () => { page.refreshCalls += 1 }
  let restored = false
  page.session.restore = async () => {
    if (restored) return
    restored = true
    page.session.isAuthenticated = false
    page.session.verifiedSubject = null
    page.session.status = 'restoring'
    page.session.identityRevision += 1
    page.mid = {
      state: page.refs.pageState.value,
      profile: page.calls.profile,
      refresh: page.refreshCalls,
    }
    page.session.verifiedSubject = 'B'
    page.session.isAuthenticated = true
    page.session.status = 'authenticated'
    page.session.adultGate = 'PASSED'
    page.session.isLearningReady = true
  }
  await page.shown[0]()
  await flush()
  assert.equal(page.mid.refresh, 0)
  assert.equal(page.mid.profile, 0)
  assert.notEqual(page.mid.state, 'ready')
  assert.equal(page.refreshCalls, 1)
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.profile.value.loadoutId, 'B')
  assert.equal(page.refs.currentName.value, 'B Set')
  assert.equal(page.calls.profile, 1)
  assert.equal(page.calls.items, 1)
  assert.equal(page.calls.loadouts, 1)
  assert.equal(page.calls.resources, 1)
  const same = page.calls.profile
  page.session.identityRevision = page.session.identityRevision
  await flush()
  assert.equal(page.calls.profile, same)
  page.session.verifiedSubject = 'C'
  page.session.identityRevision += 1
  await flush()
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.profile.value.loadoutId, 'C')
  assert.equal(page.calls.profile, same + 1)
  assert.equal(page.refreshCalls, 2)
  const hiddenGets = page.calls.profile
  const hiddenRefresh = page.refreshCalls
  page.hidden[0]()
  page.session.verifiedSubject = 'D'
  page.session.identityRevision += 1
  await flush()
  assert.equal(page.calls.profile, hiddenGets)
  assert.equal(page.calls.items, hiddenGets)
  assert.equal(page.calls.loadouts, hiddenGets)
  assert.equal(page.calls.resources, hiddenGets)
  assert.equal(page.refreshCalls, hiddenRefresh)
  assert.equal(page.refs.profile.value, null)
  assert.equal(page.refs.items.value.length, 0)
  assert.equal(page.refs.loadouts.value.length, 0)
  await page.shown[0]()
  await flush()
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.profile.value.loadoutId, 'D')
  assert.equal(page.calls.profile, hiddenGets + 1)
  page.scope?.stop()
})

test('avatar unmount drops a late private read and adult denial never reads', async () => {
  const gate = deferred()
  const page = loadPage({ api: {
    getB4AvatarProfile: async () => { page.calls.profile += 1; return gate.promise },
    listB4AvatarItems: async () => { page.calls.items += 1; return gate.promise },
    listB4Loadouts: async () => { page.calls.loadouts += 1; return gate.promise },
    getB4AvatarResources: async () => { page.calls.resources += 1; return gate.promise },
  } })
  const shown = page.shown[0]()
  await flush()
  assert.equal(page.calls.profile, 1)
  page.unmounted[0]()
  gate.resolve(profile({ loadoutId: 'A' }))
  await shown
  await flush()
  assert.equal(page.refs.profile.value, null)
  assert.equal(page.refs.items.value.length, 0)
  assert.notEqual(page.refs.pageState.value, 'ready')
  for (const adultGate of ['REQUIRED', 'REJECTED']) {
    const denied = loadPage()
    denied.session.refreshGateFromServer = async () => { denied.session.adultGate = adultGate; denied.session.isLearningReady = false }
    await denied.shown[0]()
    assert.equal(denied.refs.pageState.value, 'permission')
    assert.equal(denied.refs.permissionForbidden.value, false)
    assert.equal(denied.calls.profile, 0)
    assert.equal(denied.calls.items, 0)
    assert.equal(denied.calls.loadouts, 0)
    assert.equal(denied.calls.resources, 0)
  }
})

test('avatar retry after unavailable starts one fresh read', async () => {
  let open = false
  const page = loadPage({ api: {
    getB4AvatarProfile: async () => { page.calls.profile += 1; if (!open) throw page.mobileApiError(503); return profile({ loadoutId: 'A' }) },
    listB4AvatarItems: async () => { page.calls.items += 1; if (!open) throw page.mobileApiError(503); return { items: [] } },
    listB4Loadouts: async () => { page.calls.loadouts += 1; if (!open) throw page.mobileApiError(503); return { items: [] } },
    getB4AvatarResources: async () => { page.calls.resources += 1; if (!open) throw page.mobileApiError(503); return { fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] } },
  } })
  await page.shown[0]()
  assert.equal(page.refs.pageState.value, 'unavailable')
  const first = page.calls.profile
  open = true
  page.test.retry()
  await flush()
  assert.equal(page.calls.profile, first + 1)
  assert.equal(page.calls.items, first + 1)
  assert.equal(page.refs.pageState.value, 'ready')
  assert.equal(page.refs.profile.value.loadoutId, 'A')
})

test('avatar lifecycle source has visible/epoch/owner rechecks and no hidden refresh/load', () => {
  const page = loadPage()
  assert.match(page.source, /let visible = false/u)
  assert.match(page.source, /let activeLoad/u)
  assert.match(page.source, /if \(!visible\) return/u)
  assert.match(page.source, /pageEpochCurrent\(runEpoch\)/u)
  assert.match(page.source, /isCurrent\(runEpoch, owner\)/u)
  assert.match(page.source, /observedTopPath|routeStillThisPage|dropIfRouteLeft/u)
  assert.match(page.source, /onHide\(\(\) => \{[\s\S]*?visible = false[\s\S]*?epoch \+= 1/u)
  assert.equal((page.source.match(/onShow\(/gu) || []).length, 1)
  assert.equal((page.source.match(/onHide\(/gu) || []).length, 1)
  assert.equal((page.source.match(/watch\(\(\) => session\.identityRevision/gu) || []).length, 1)
})

function routeBox() {
  const previousWindow = globalThis.window
  const previousPages = globalThis.getCurrentPages
  return {
    hash(value) {
      globalThis.window = { location: { hash: value } }
      delete globalThis.getCurrentPages
    },
    pages(routes) {
      delete globalThis.window
      globalThis.getCurrentPages = () => routes.map((route) => ({ route }))
    },
    clear() {
      delete globalThis.window
      delete globalThis.getCurrentPages
    },
    restore() {
      if (previousWindow === undefined) delete globalThis.window
      else globalThis.window = previousWindow
      if (previousPages === undefined) delete globalThis.getCurrentPages
      else globalThis.getCurrentPages = previousPages
    },
  }
}

test('avatar held gate then hash leaves before load issues zero private reads and reopen is one batch', async () => {
  const route = routeBox()
  try {
    const gate = deferred()
    const page = loadPage()
    route.hash('#/pages/b4-avatar/b4-avatar')
    page.session.refreshGateFromServer = async () => { await gate.promise }
    const shown = page.shown[0]()
    await flush()
    route.hash('#/pages/profile/profile')
    gate.resolve()
    await shown
    await flush()
    assert.equal(page.calls.profile, 0)
    assert.equal(page.calls.items, 0)
    assert.equal(page.calls.loadouts, 0)
    assert.equal(page.calls.resources, 0)
    assert.equal(page.refs.profile.value, null)
    assert.equal(page.refs.items.value.length, 0)
    assert.notEqual(page.refs.pageState.value, 'ready')
    route.hash('#/pages/b4-avatar/b4-avatar')
    await page.shown[0]()
    await flush()
    assert.equal(page.calls.profile, 1)
    assert.equal(page.calls.items, 1)
    assert.equal(page.calls.loadouts, 1)
    assert.equal(page.calls.resources, 1)
    assert.equal(page.refs.pageState.value, 'ready')
  } finally {
    route.restore()
  }
})

test('avatar native top page change blocks the held gate and a missing stack still honors onHide', async () => {
  const route = routeBox()
  try {
    const gate = deferred()
    const page = loadPage()
    route.pages(['pages/b4-avatar/b4-avatar'])
    page.session.refreshGateFromServer = async () => { await gate.promise }
    const shown = page.shown[0]()
    await flush()
    route.pages(['pages/profile/profile'])
    gate.resolve()
    await shown
    await flush()
    assert.equal(page.calls.profile, 0)
    assert.equal(page.calls.items, 0)
    assert.equal(page.calls.loadouts, 0)
    assert.equal(page.calls.resources, 0)
    assert.equal(page.refs.profile.value, null)
    route.pages(['pages/b4-avatar/b4-avatar'])
    await page.shown[0]()
    await flush()
    assert.equal(page.calls.profile, 1)
    assert.equal(page.refs.pageState.value, 'ready')

    route.clear()
    const hiddenGate = deferred()
    const hidden = loadPage()
    hidden.session.refreshGateFromServer = async () => { await hiddenGate.promise }
    const hiddenShow = hidden.shown[0]()
    await flush()
    hidden.hidden[0]()
    hiddenGate.resolve()
    await hiddenShow
    await flush()
    assert.equal(hidden.calls.profile, 0)
    assert.equal(hidden.calls.items, 0)
    assert.equal(hidden.calls.loadouts, 0)
    assert.equal(hidden.calls.resources, 0)
    assert.equal(hidden.refs.profile.value, null)
    assert.equal(globalThis.window, undefined)
    assert.equal(typeof globalThis.getCurrentPages, 'undefined')
  } finally {
    route.restore()
  }
})

test('avatar held gate adopts one batch for a same-owner revision and for a changed owner', async () => {
  const sameGate = deferred()
  const same = loadPage({ api: {
    getB4AvatarProfile: async () => { same.calls.profile += 1; return profile({ loadoutId: same.session.verifiedSubject }) },
    listB4AvatarItems: async () => { same.calls.items += 1; return { items: [item(same.session.verifiedSubject)] } },
    listB4Loadouts: async () => { same.calls.loadouts += 1; return { items: [loadout(same.session.verifiedSubject, { equipped: true, name: `${same.session.verifiedSubject} Set` })] } },
    getB4AvatarResources: async () => { same.calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] } },
  } })
  same.session.refreshGateFromServer = async () => { await sameGate.promise }
  const sameShow = same.shown[0]()
  await flush()
  same.session.identityRevision += 1
  same.watchers[0]()
  sameGate.resolve()
  await sameShow
  await flush()
  assert.equal(same.calls.profile, 1)
  assert.equal(same.calls.items, 1)
  assert.equal(same.calls.loadouts, 1)
  assert.equal(same.calls.resources, 1)
  assert.equal(same.refs.pageState.value, 'ready')
  assert.equal(same.refs.profile.value.loadoutId, 'A')

  const nextGate = deferred()
  const next = loadPage({ api: {
    getB4AvatarProfile: async () => { next.calls.profile += 1; return profile({ loadoutId: next.session.verifiedSubject }) },
    listB4AvatarItems: async () => { next.calls.items += 1; return { items: [item(next.session.verifiedSubject)] } },
    listB4Loadouts: async () => { next.calls.loadouts += 1; return { items: [loadout(next.session.verifiedSubject, { equipped: true, name: `${next.session.verifiedSubject} Set` })] } },
    getB4AvatarResources: async () => { next.calls.resources += 1; return { fallbackMode: '2D_FALLBACK', performanceTiers: ['High'] } },
  } })
  next.session.refreshGateFromServer = async () => { await nextGate.promise }
  const nextShow = next.shown[0]()
  await flush()
  next.session.verifiedSubject = 'B'
  next.session.identityRevision += 1
  next.watchers[0]()
  nextGate.resolve()
  await nextShow
  await flush()
  assert.equal(next.calls.profile, 1)
  assert.equal(next.refs.pageState.value, 'ready')
  assert.equal(next.refs.profile.value.loadoutId, 'B')
  assert.equal(next.refs.currentName.value, 'B Set')
  assert.deepEqual(next.refs.items.value.map((entry) => entry.itemCode), ['B'])
})

test('avatar watcher held gate drops the read when the route leaves before load', async () => {
  const route = routeBox()
  try {
    const page = loadPage({ api: {
      getB4AvatarProfile: async () => { page.calls.profile += 1; return profile({ loadoutId: page.session.verifiedSubject }) },
    } })
    route.hash('#/pages/b4-avatar/b4-avatar')
    await page.shown[0]()
    await flush()
    assert.equal(page.calls.profile, 1)
    const held = deferred()
    page.session.refreshGateFromServer = async () => { await held.promise }
    page.session.verifiedSubject = 'B'
    page.session.identityRevision += 1
    page.watchers[0]()
    await flush()
    route.hash('#/pages/profile/profile')
    held.resolve()
    await flush()
    await flush()
    assert.equal(page.calls.profile, 1)
    assert.equal(page.calls.items, 1)
    assert.equal(page.calls.loadouts, 1)
    assert.equal(page.calls.resources, 1)
    assert.equal(page.refs.profile.value, null)
    assert.notEqual(page.refs.pageState.value, 'ready')
  } finally {
    route.restore()
  }
})
