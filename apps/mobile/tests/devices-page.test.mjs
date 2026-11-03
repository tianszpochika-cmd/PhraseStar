import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const vue = require('vue')
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')

const appRoot = path.resolve(import.meta.dirname, '..')
const PAGE = 'src/pages/devices/devices.vue'
const COPY_MODULE = '../../packages/i18n/src/mobile-resources/devices-page.ts'

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTsModule(relativePath) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function flush() { return new Promise((resolve) => setTimeout(resolve, 0)) }

function interpolate(message, values = {}) {
  return String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key]))
}

const deviceA = { deviceId: 'device-current', deviceType: 'IOS', status: 'ACTIVE', lastActiveAt: '2026-11-04T00:12:00Z', isCurrent: true }
const deviceB = { deviceId: 'device-tablet', deviceType: 'WEB', status: 'ACTIVE', lastActiveAt: '2026-10-16T13:40:00Z', isCurrent: false }
const deviceC = { deviceId: 'device-android', deviceType: 'ANDROID', status: 'ACTIVE', lastActiveAt: '2026-10-12T23:55:00Z', isCurrent: false }
const deviceRevoked = { ...deviceB, status: 'REVOKED' }

function apiError(status, message = `HTTP ${status}`) {
  const error = new Error(message)
  error.status = status
  return error
}

/* Executes the real <script setup> of devices.vue with mocked contracts.
   The page's own functions and refs are exported through a fixture block so
   tests drive real state transitions instead of matching source text. */
function loadDevicesPage(options = {}) {
  const calls = { access: [], list: 0, kickout: [], reloads: 0 }
  const lifecycle = {}
  const listQueue = []
  const kickoutBehavior = options.kickout ?? (async () => undefined)
  const accessBehavior = options.access ?? (async () => true)

  const session = vue.reactive({
    deviceId: 'device-current',
    identityRevision: 1,
    subject: 'subject-a',
    getMobileApiIdentity() { return { subject: this.subject, revision: this.identityRevision } },
  })

  const theme = vue.reactive({ resolvedTheme: 'light' })
  let themeListener = null
  const mobileThemeController = {
    get resolvedTheme() { return theme.resolvedTheme },
    subscribe(listener) { themeListener = listener; listener({ resolvedTheme: theme.resolvedTheme }); return () => { themeListener = null } },
  }

  const zh = loadTsModule(COPY_MODULE).devicesPageCopy(false)
  const en = loadTsModule(COPY_MODULE).devicesPageCopy(true)
  const locale = options.locale ?? 'zh'
  const copy = locale === 'en' ? en : zh
  const mobileT = (key) => {
    const bare = key.replace(/^mobile\./, '')
    if (bare.startsWith('devicesPage.')) return copy[bare.slice('devicesPage.'.length)] ?? key
    return key
  }

  const source = read(PAGE)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'devices.vue exposes a script setup block')
  const fixtureExports = `
module.exports.__fixture = {
  devices, status, errorKind, errorMessage, actionError, busyAction, outcome, pendingIds,
  revocableDevices, noIdentity, busy, dialogBusy, notice, glowSrc, confirmOpen, confirmBulk,
  confirmTarget, resolvedTheme, loadDevices, retryLoad, refreshList, refreshFromNotice,
  openConfirm, openBulkConfirm, closeConfirm, confirmAndRevoke, onDocumentKeydown,
  lastLoginLabel, deviceTypeLabel, rowTag, showExit, shortDeviceId
}
`
  const compiled = ts.transpileModule(`${script}\n${fixtureExports}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const domain = loadTsModule('src/domain/devices.ts')
  const sync = loadTsModule('src/domain/mobile-preference-sync.ts')
  const module = { exports: {} }
  const vuePort = { ...vue, onMounted() {}, onBeforeUnmount() {} }
  const scope = vue.effectScope()
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        vue: vuePort,
        '@dcloudio/uni-app': {
          onShow(callback) { lifecycle.show = callback },
          onHide(callback) { lifecycle.hide = callback },
        },
        '@englishflow/i18n': { interpolate },
        '@englishflow/contracts': {},
        '../../components/MobilePageHeader.vue': { default: {} },
        '../../auth/navigation': {
          ensureMobilePageAccess: async (target) => { calls.access.push(target); return accessBehavior(target) },
        },
        '../../api/devices': {
          listMobileDevices: async () => {
            calls.list += 1
            const next = listQueue.length > 0 ? listQueue.shift() : [deviceA, deviceB, deviceC]
            if (next instanceof Error) throw next
            if (typeof next === 'function') return next()
            if (next && next.promise) return next.promise
            return next
          },
          kickoutMobileDevice: async (deviceId) => {
            calls.kickout.push(deviceId)
            return kickoutBehavior(deviceId)
          },
        },
        '../../domain/devices': domain,
        '../../stores/session': { useSessionStore: () => session },
        '../../platform/experience': {
          mobileT,
          useMobileExperience: () => ({ experienceStyle: vue.ref({}), experienceMotion: vue.ref('on') }),
        },
        '../../platform/v2-foundation': {
          mobileI18n: {
            formatNumber: (value) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'zh-CN').format(value),
            formatDate: (value, dateOptions) => new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'zh-CN', dateOptions).format(new Date(value)),
          },
          mobileThemeController,
        },
        '../../domain/mobile-preference-sync': sync,
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name} in ${PAGE}`)
      return modules[name]
    }, module, module.exports)
  })

  return {
    fixture: module.exports.__fixture,
    session,
    calls,
    lifecycle,
    listQueue,
    copy,
    setTheme(value) { theme.resolvedTheme = value; themeListener?.({ resolvedTheme: value }) },
    dispose() { scope.stop() },
  }
}

/* Mounts the compiled SFC with a deterministic, DOM-free renderer and returns
   helpers that read the rendered text and click real rendered buttons. */
function makeHost() {
  function node(type) {
    return { type, children: [], props: {}, parent: null, text: undefined, focus() {}, querySelectorAll() { return [] } }
  }
  function detach(current) {
    if (!current.parent) return
    const index = current.parent.children.indexOf(current)
    if (index >= 0) current.parent.children.splice(index, 1)
    current.parent = null
  }
  const host = {
    createElement: node,
    createText: (text) => ({ text, parent: null, children: [] }),
    createComment: (comment) => ({ comment, parent: null, children: [] }),
    setText: (target, text) => { target.text = text },
    setElementText: (target, text) => { target.children = []; target.text = text },
    insert: (child, parent, anchor) => {
      detach(child)
      child.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index >= 0) parent.children.splice(index, 0, child)
      else parent.children.push(child)
    },
    remove: (child) => { detach(child) },
    parentNode: (child) => child.parent,
    nextSibling: (child) => {
      if (!child.parent) return null
      const index = child.parent.children.indexOf(child)
      return index >= 0 ? (child.parent.children[index + 1] ?? null) : null
    },
    patchProp: (target, key, previous, next) => { target.props[key] = next },
    setScopeId: () => {},
    cloneNode: (source) => { const clone = node(source.type); clone.props = { ...source.props }; return clone },
    insertStaticContent: () => [node('static'), node('static')],
  }
  return { host, node }
}

function loadRenderedPage(options = {}) {
  const { host, node } = makeHost()
  const renderer = vue.createRenderer(host)
  const calls = { list: 0, kickout: [] }
  const lifecycle = {}
  const listQueue = (options.lists ?? [[deviceA, deviceB, deviceC]]).map((entry) => entry)
  const kickoutBehavior = options.kickout ?? (async () => undefined)
  const session = vue.reactive({
    deviceId: 'device-current',
    identityRevision: 1,
    subject: 'subject-a',
    getMobileApiIdentity() { return { subject: this.subject, revision: this.identityRevision } },
  })
  const theme = vue.reactive({ resolvedTheme: 'light' })
  let themeListener = null
  const zh = loadTsModule(COPY_MODULE).devicesPageCopy(options.locale === 'en')
  const mobileT = (key) => {
    const bare = String(key).replace(/^mobile\./, '')
    if (bare.startsWith('devicesPage.')) return zh[bare.slice('devicesPage.'.length)] ?? key
    return key
  }
  const domain = loadTsModule('src/domain/devices.ts')
  const sync = loadTsModule('src/domain/mobile-preference-sync.ts')

  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename: PAGE })
  assert.deepEqual(errors, [])
  const compiled = compileScript(descriptor, { id: 'devices-page', inlineTemplate: true })
  const js = ts.transpileModule(compiled.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const module = { exports: {} }
  new Function('require', 'module', 'exports', js)((name) => {
    const modules = {
      vue,
      '@dcloudio/uni-app': {
        onShow(callback) { lifecycle.show = callback },
        onHide(callback) { lifecycle.hide = callback },
      },
      '@englishflow/i18n': { interpolate },
      '@englishflow/contracts': {},
      '../../components/MobilePageHeader.vue': { default: { render: () => null } },
      '../../auth/navigation': { ensureMobilePageAccess: async () => true },
      '../../api/devices': {
        listMobileDevices: async () => {
          calls.list += 1
          const next = listQueue.length > 0 ? listQueue.shift() : [deviceA]
          if (next instanceof Error) throw next
          return next
        },
        kickoutMobileDevice: async (deviceId) => {
          calls.kickout.push(deviceId)
          return kickoutBehavior(deviceId)
        },
      },
      '../../domain/devices': domain,
      '../../stores/session': { useSessionStore: () => session },
      '../../platform/experience': {
        mobileT,
        useMobileExperience: () => ({ experienceStyle: vue.ref({}), experienceMotion: vue.ref('on') }),
      },
      '../../platform/v2-foundation': {
        mobileI18n: {
          formatNumber: (value) => new Intl.NumberFormat('zh-CN').format(value),
          formatDate: (value) => new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)),
        },
        mobileThemeController: {
          get resolvedTheme() { return theme.resolvedTheme },
          subscribe(listener) { themeListener = listener; listener({ resolvedTheme: theme.resolvedTheme }); return () => { themeListener = null } },
        },
      },
      '../../domain/mobile-preference-sync': sync,
    }
    if (!(name in modules)) throw new Error(`unexpected import ${name} in ${PAGE}`)
    return modules[name]
  }, module, module.exports)

  const app = renderer.createApp(module.exports.default)
  const warnings = []
  app.config.warnHandler = (message) => { warnings.push(message) }
  const root = node('root')
  app.mount(root)

  function collectText(target, out = []) {
    if (!target || typeof target !== 'object') return out
    if (typeof target.text === 'string') out.push(target.text)
    if (Array.isArray(target.children)) for (const child of target.children) collectText(child, out)
    return out
  }
  function collectNodes(target, out = []) {
    if (!target || typeof target !== 'object') return out
    out.push(target)
    if (Array.isArray(target.children)) for (const child of target.children) collectNodes(child, out)
    return out
  }
  function text() { return collectText(root).join(' ') }
  function buttons() {
    return collectNodes(root).filter((entry) => entry.type === 'button')
  }
  function buttonByText(label) {
    return buttons().find((entry) => collectText(entry).join(' ').includes(label))
  }
  async function settle() {
    await vue.nextTick()
    await flush()
    await vue.nextTick()
  }
  return { root, app, text, buttons, buttonByText, settle, calls, lifecycle, warnings, copy: zh, session }
}

test('devices copy module carries complete, non-empty bilingual copy with matching placeholders', () => {
  const { devicesPageCopy } = loadTsModule(COPY_MODULE)
  const zh = devicesPageCopy(false)
  const en = devicesPageCopy(true)
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.ok(zhKeys.length >= 80, `expected a full copy set, got ${zhKeys.length}`)
  assert.deepEqual(zhKeys, enKeys)
  assert.ok(Object.values(zh).every((value) => typeof value === 'string' && value.trim()))
  assert.ok(Object.values(en).every((value) => typeof value === 'string' && value.trim()))
  const placeholders = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
  for (const key of zhKeys) assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), `placeholders differ for ${key}`)
  assert.equal(zh.tagCurrent, '当前设备')
  assert.equal(en.tagCurrent, 'Current device')
  assert.equal(zh.confirmSingleTitle, '退出这台设备？')
  assert.equal(en.confirmSingleTitle, 'Sign out this device?')
  assert.equal(zh.sessionExpired, '登录状态已失效，请重新登录后再管理设备。')
  assert.equal(en.sessionExpired, 'Your session has expired. Sign in again to manage devices.')
})

test('devices SFC parses, compiles script/template/style, and only references cached original assets', () => {
  const filename = path.join(appRoot, PAGE)
  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup)
  assert.equal(descriptor.styles.length, 1)
  const script = compileScript(descriptor, { id: 'devices-page' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'devices-page',
    scoped: true,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  assert.ok(template.code.includes('createElementVNode'))
  const style = compileStyle({ source: descriptor.styles[0].content, filename, id: 'devices-page', scoped: true })
  assert.deepEqual(style.errors, [])

  const refs = new Set([...source.matchAll(/\/static\/figma-devices-[a-z0-9-]+\/[0-9a-f-]+\.svg/g)].map((match) => match[0]))
  assert.ok(refs.size >= 12, `expected the cached device assets, got ${refs.size}`)
  for (const ref of refs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    assert.ok(fs.existsSync(file), `referenced static asset exists: ${ref}`)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<svg[^>]*width="[\d.]+"[^>]*height="[\d.]+"/, `SVG root keeps width/height: ${ref}`)
    assert.doesNotMatch(svg, /<image\b|data:image\//, `asset is not a whole-page bitmap: ${ref}`)
  }
  const glow = fs.readFileSync(path.join(appRoot, 'src/static/figma-devices-358-6788/1c011da0-ff9e-4bc0-bb25-789d6d65bac1.svg'), 'utf8')
  assert.match(glow, /width="540"[^>]*height="480"/, 'glow keeps its native 540x480 box')
  assert.match(source, /\.dev-glow \{ position: absolute; left: 60px; top: -230px; width: 540px; height: 480px;/)

  const rgbaOutsideVar = [...descriptor.styles[0].content.matchAll(/rgba?\([^)]*\)/g)]
    .filter((match) => {
      const before = descriptor.styles[0].content.slice(0, match.index)
      return !/var\([^)]*$/u.test(before)
    })
  assert.deepEqual(rgbaOutsideVar.map((match) => match[0]), [], 'no raw colour literals outside token fallbacks')
  assert.match(source, /:data-resolved-theme="resolvedTheme"/)
  assert.match(source, /data-resolved-theme="high-contrast"/)
  assert.match(source, /data-motion="reduced"/)
})

test('initial load shows the ready list, protects the current device, and counts only revocable sessions', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    assert.deepEqual(page.calls.access, ['/pages/devices/devices'])
    assert.equal(page.fixture.status.value, 'ready')
    assert.equal(page.fixture.devices.value.length, 3)
    assert.equal(page.fixture.revocableDevices.value.length, 2)
    assert.equal(page.fixture.noIdentity.value, false)
    assert.equal(page.fixture.showExit(deviceA), false, 'current device exposes no exit action')
    assert.equal(page.fixture.showExit(deviceB), true)
    assert.equal(page.fixture.rowTag(deviceA).label, '当前设备')
    assert.equal(page.fixture.rowTag(deviceB), null, 'other active devices render the exit action')
    assert.equal(page.fixture.rowTag(deviceRevoked).label, '已退出')
  } finally {
    page.dispose()
  }
})

test('empty and failed loads are distinct states, and retry reads the list again', async () => {
  const page = loadDevicesPage()
  try {
    page.listQueue.push([])
    await page.lifecycle.show()
    assert.equal(page.fixture.status.value, 'empty')
    assert.equal(page.fixture.devices.value.length, 0)

    page.listQueue.push(apiError(500, 'boom'))
    await page.fixture.retryLoad()
    assert.equal(page.fixture.status.value, 'error')
    assert.equal(page.fixture.errorMessage.value, '设备列表暂时无法读取，请重试。')
    assert.equal(page.fixture.devices.value.length, 0)

    page.listQueue.push([deviceA, deviceB])
    await page.fixture.retryLoad()
    assert.equal(page.fixture.status.value, 'ready')
    assert.equal(page.fixture.devices.value.length, 2)
    assert.ok(page.calls.list >= 3)
  } finally {
    page.dispose()
  }
})

test('401 and 403 surface session/forbidden errors instead of an empty list', async () => {
  const expired = loadDevicesPage()
  try {
    expired.listQueue.push(apiError(401))
    await expired.lifecycle.show()
    assert.equal(expired.fixture.status.value, 'error')
    assert.equal(expired.fixture.errorKind.value, 'session')
    assert.equal(expired.fixture.errorMessage.value, '登录状态已失效，请重新登录后再管理设备。')
    assert.notEqual(expired.fixture.status.value, 'empty')
  } finally {
    expired.dispose()
  }

  const forbidden = loadDevicesPage()
  try {
    forbidden.listQueue.push(apiError(403))
    await forbidden.lifecycle.show()
    assert.equal(forbidden.fixture.status.value, 'error')
    assert.equal(forbidden.fixture.errorKind.value, 'forbidden')
    assert.equal(forbidden.fixture.errorMessage.value, '当前账号无权管理这些设备。')
    assert.notEqual(forbidden.fixture.status.value, 'empty')
  } finally {
    forbidden.dispose()
  }
})

test('single-device cancel sends no request and closing restores the previous focus', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.fixture.openConfirm(deviceB)
    assert.equal(page.fixture.confirmOpen.value, true)
    assert.equal(page.fixture.confirmBulk.value, false)
    assert.equal(page.fixture.confirmTarget.value.deviceId, 'device-tablet')
    page.fixture.closeConfirm()
    assert.equal(page.fixture.confirmOpen.value, false)
    assert.equal(page.fixture.confirmTarget.value, null)
    assert.deepEqual(page.calls.kickout, [])
    assert.equal(page.fixture.outcome.value, null)
  } finally {
    page.dispose()
  }
})

test('confirming a single revoke posts once, then confirms with a real list read-back', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA, deviceC])
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.deepEqual(page.calls.kickout, ['device-tablet'])
    assert.equal(page.calls.list, 2, 'one initial list plus one confirmation read-back')
    assert.equal(page.fixture.confirmOpen.value, false)
    assert.equal(page.fixture.outcome.value.kind, 'revoked')
    assert.equal(page.fixture.devices.value.length, 2)
    assert.equal(page.fixture.status.value, 'ready')
    assert.equal(page.fixture.busyAction.value, null)
  } finally {
    page.dispose()
  }
})

test('a read-back that still lists the device is reported as still signed in, not success', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA, deviceB, deviceC])
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'still-active')
    assert.deepEqual(page.fixture.pendingIds.value, ['device-tablet'])
    assert.equal(page.fixture.rowTag(deviceB).label, '状态待确认')
    assert.equal(page.fixture.showExit(deviceB), false, 'pending device is not immediately retried')
    assert.match(page.fixture.notice.value.text, /平板|网页浏览器/)

    page.listQueue.push([deviceA, deviceC])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'revoked', 'a confirmed read-back reports the confirmed exit')
    assert.match(page.fixture.notice.value.text, /已退出/)
    assert.deepEqual(page.fixture.pendingIds.value, [])
  } finally {
    page.dispose()
  }
})

test('an unreadable read-back after kickout is reported, and the request is not replayed', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push(apiError(502, 'gateway'))
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'readback-failed')
    assert.deepEqual(page.calls.kickout, ['device-tablet'])
    assert.equal(page.calls.list, 2)

    page.listQueue.push(apiError(503, 'still down'))
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'query-failed')
    assert.deepEqual(page.calls.kickout, ['device-tablet'], 'a failed refresh never repeats the write')
  } finally {
    page.dispose()
  }
})

test('bulk revoke reports per-device failures and re-verifies through the list', async () => {
  const page = loadDevicesPage({
    kickout: async (deviceId) => {
      if (deviceId === 'device-android') throw apiError(500, 'kickout failed')
    },
  })
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA, deviceB])
    page.fixture.openBulkConfirm()
    assert.equal(page.fixture.confirmBulk.value, true)
    await page.fixture.confirmAndRevoke()
    assert.deepEqual(page.calls.kickout, ['device-tablet', 'device-android'])
    const outcome = page.fixture.outcome.value
    assert.equal(outcome.kind, 'bulk-partial')
    assert.equal(outcome.revoked, 1)
    assert.equal(outcome.failed, 1)
    assert.equal(page.fixture.devices.value.length, 2)
    assert.match(page.fixture.notice.value.text, /已确认退出 1 台/)
    assert.match(page.fixture.notice.value.text, /1 台请求未完成/)
  } finally {
    page.dispose()
  }
})

test('bulk confirm excludes the current device from the target set', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    assert.equal(page.fixture.revocableDevices.value.length, 2)
    page.listQueue.push([deviceA])
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    assert.deepEqual(page.calls.kickout, ['device-tablet', 'device-android'])
    assert.ok(!page.calls.kickout.includes('device-current'))
    assert.equal(page.fixture.outcome.value.kind, 'bulk-revoked')
  } finally {
    page.dispose()
  }
})

test('a kickout that expires the session stops with a session error and no false result', async () => {
  const page = loadDevicesPage({ kickout: async () => { throw apiError(401) } })
  try {
    await page.lifecycle.show()
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.status.value, 'error')
    assert.equal(page.fixture.errorKind.value, 'session')
    assert.equal(page.fixture.outcome.value, null)
    assert.equal(page.fixture.devices.value.length, 0, 'expired state is not shown as an empty list')
  } finally {
    page.dispose()
  }
})

test('an account switch clears devices and drops the in-flight response for the old account', async () => {
  const page = loadDevicesPage()
  const stale = deferred()
  try {
    await page.lifecycle.show()
    assert.equal(page.fixture.status.value, 'ready')

    page.listQueue.push(stale.promise)
    const stalePending = page.fixture.loadDevices(false)
    page.session.subject = 'subject-b'
    page.session.identityRevision = 2
    // The identity watcher is sync: it clears the old account immediately.
    assert.equal(page.fixture.devices.value.length, 0)
    await vue.nextTick()

    await flush()
    assert.equal(page.fixture.devices.value.length, 3, 'the new account list is loaded')
    stale.resolve([deviceA, deviceB])
    await stalePending
    await flush()
    assert.equal(page.fixture.devices.value.length, 3, 'only the new account list is applied')
    assert.equal(page.fixture.status.value, 'ready')
  } finally {
    page.dispose()
  }
})

test('leaving the page invalidates a late list response and closes any confirm dialog', async () => {
  const page = loadDevicesPage()
  const late = deferred()
  try {
    await page.lifecycle.show()
    page.fixture.openConfirm(deviceB)
    assert.equal(page.fixture.confirmOpen.value, true)

    page.listQueue.push(late.promise)
    const pending = page.fixture.loadDevices(false)
    page.lifecycle.hide()
    assert.equal(page.fixture.confirmOpen.value, false)

    late.resolve([deviceA, deviceB])
    await pending
    await flush()
    assert.equal(page.fixture.devices.value.length, 0, 'response after page hide is not applied')
  } finally {
    page.dispose()
  }
})

test('rendered list uses copy from the resource module and only offers exit for other devices', async () => {
  const page = loadRenderedPage()
  try {
    await page.lifecycle.show()
    await page.settle()
    const text = page.text()
    assert.match(text, /设备与会话/)
    assert.match(text, /已登录设备/)
    assert.match(text, /当前设备/)
    assert.match(text, /退出其他设备（2）/)
    const exitButtons = page.buttons().filter((entry) => (entry.props['aria-label'] ?? '').startsWith('退出 '))
    assert.equal(exitButtons.length, 2, 'one exit action per other active device')
    assert.ok(!exitButtons.some((entry) => String(entry.props['aria-label']).includes('iPhone')))
    assert.deepEqual(page.warnings, [], 'the compiled template renders without warnings')
  } finally {
    page.app.unmount()
  }
})

test('rendered empty and error states keep distinct copy and actions', async () => {
  const empty = loadRenderedPage({ lists: [[]] })
  try {
    await empty.lifecycle.show()
    await empty.settle()
    assert.match(empty.text(), /当前账号还没有设备记录/)
    assert.equal(empty.buttons().filter((entry) => String(entry.props.class ?? '').includes('dev-cta')).length, 0)
  } finally {
    empty.app.unmount()
  }

  const failed = loadRenderedPage({ lists: [apiError(500, 'boom')] })
  try {
    await failed.lifecycle.show()
    await failed.settle()
    assert.match(failed.text(), /设备列表暂时读不出来/)
    assert.ok(failed.buttonByText('重试'), 'error state offers a retry action')
  } finally {
    failed.app.unmount()
  }
})

test('clicking exit opens the accessible dialog; cancel closes it without a request', async () => {
  const page = loadRenderedPage()
  try {
    await page.lifecycle.show()
    await page.settle()
    const exit = page.buttons().find((entry) => entry.props['aria-label'] === '退出 网页浏览器')
    assert.ok(exit, 'other device exposes an exit control')
    exit.props.onClick()
    await page.settle()
    assert.match(page.text(), /退出这台设备？/)
    assert.match(page.text(), /确认退出/)
    assert.match(page.text(), /取消/)
    const cancel = page.buttonByText('取消')
    assert.ok(cancel, 'dialog offers cancel')
    cancel.props.onClick()
    await page.settle()
    assert.doesNotMatch(page.text(), /退出这台设备？/)
    assert.deepEqual(page.calls.kickout, [])
  } finally {
    page.app.unmount()
  }
})

test('confirming from the rendered dialog posts once and shows the read-back success line', async () => {
  const page = loadRenderedPage({ lists: [[deviceA, deviceB, deviceC], [deviceA, deviceC]] })
  try {
    await page.lifecycle.show()
    await page.settle()
    const exit = page.buttons().find((entry) => entry.props['aria-label'] === '退出 网页浏览器')
    exit.props.onClick()
    await page.settle()
    const confirm = page.buttonByText('确认退出')
    confirm.props.onClick()
    await page.settle()
    assert.deepEqual(page.calls.kickout, ['device-tablet'])
    assert.match(page.text(), /已退出 网页浏览器/)
    assert.doesNotMatch(page.text(), /退出这台设备？/)
    assert.match(page.text(), /退出其他设备（1）/)
  } finally {
    page.app.unmount()
  }
})

test('rendered still-signed-in result shows the pending tag and refresh action, not success', async () => {
  const page = loadRenderedPage({ lists: [[deviceA, deviceB], [deviceA, deviceB]] })
  try {
    await page.lifecycle.show()
    await page.settle()
    const exit = page.buttons().find((entry) => entry.props['aria-label'] === '退出 网页浏览器')
    exit.props.onClick()
    await page.settle()
    page.buttonByText('确认退出').props.onClick()
    await page.settle()
    assert.match(page.text(), /状态待确认/)
    assert.match(page.text(), /退出结果待确认/)
    assert.doesNotMatch(page.text(), /已退出 网页浏览器/)
    const refresh = page.buttonByText('刷新列表')
    assert.ok(refresh, 'pending result offers a real re-query action')
    assert.deepEqual(page.calls.kickout, ['device-tablet'])
  } finally {
    page.app.unmount()
  }
})

/* --- regressions for batch-04 review: busy release, confirmed-only counts, pending retention --- */

test('bulk success releases busy so the page can be refreshed and used again', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA])
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    assert.deepEqual(page.calls.kickout, ['device-tablet', 'device-android'])
    assert.equal(page.fixture.outcome.value.kind, 'bulk-revoked')
    assert.equal(page.fixture.busyAction.value, null, 'bulk action must release busy on success')

    page.listQueue.push([deviceA])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.busyAction.value, null)
    assert.equal(page.fixture.status.value, 'ready')
  } finally {
    page.dispose()
  }
})

test('bulk partial failure releases busy and keeps the rejected count separate from confirmed exits', async () => {
  const page = loadDevicesPage({
    kickout: async (deviceId) => { if (deviceId === 'device-android') throw apiError(500, 'nope') },
  })
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA, deviceB])
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.busyAction.value, null, 'bulk action must release busy on partial failure')
    const outcome = page.fixture.outcome.value
    assert.equal(outcome.kind, 'bulk-partial')
    assert.equal(outcome.revoked, 1, 'only the read-back-confirmed exit is counted')
    assert.equal(outcome.failed, 1)
    assert.match(page.fixture.notice.value.text, /已确认退出 1 台/)
    assert.match(page.fixture.notice.value.text, /1 台请求未完成/)

    page.listQueue.push([deviceA, deviceB])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.busyAction.value, null, 'follow-up refresh is not blocked')
  } finally {
    page.dispose()
  }
})

test('two accepted kickouts with one device still active are not reported as two confirmed exits', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    // Both POSTs resolve, but the read-back still shows device-android as ACTIVE.
    page.listQueue.push([deviceA, deviceC])
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    const outcome = page.fixture.outcome.value
    assert.equal(page.calls.kickout.length, 2, 'both requests were accepted')
    assert.equal(outcome.kind, 'bulk-partial')
    assert.equal(outcome.revoked, 1, 'accepted requests are not confirmed exits')
    assert.equal(outcome.stillActive, 1)
    assert.doesNotMatch(page.fixture.notice.value.text, /已确认退出 2 台/)
    assert.match(page.fixture.notice.value.text, /1 台设备仍显示登录/)
    assert.deepEqual(page.fixture.pendingIds.value, ['device-android'])
    assert.equal(page.fixture.rowTag(deviceC).label, '状态待确认')
  } finally {
    page.dispose()
  }
})

test('bulk read-back failure releases busy, keeps pending targets, and later confirms them', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push(apiError(502, 'gateway'))
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.busyAction.value, null, 'bulk action must release busy when the read-back fails')
    assert.equal(page.fixture.outcome.value.kind, 'readback-failed')
    assert.deepEqual(page.fixture.pendingIds.value.slice().sort(), ['device-android', 'device-tablet'])
    assert.match(page.fixture.notice.value.text, /状态未知/)

    // A successful refresh that no longer lists the targets confirms the exits.
    page.listQueue.push([deviceA])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'bulk-revoked')
    assert.equal(page.fixture.outcome.value.revoked, 2)
    assert.deepEqual(page.fixture.pendingIds.value, [])
    assert.equal(page.fixture.busyAction.value, null)
  } finally {
    page.dispose()
  }
})

test('a failed re-query keeps the pending targets and unknown state instead of claiming success', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push(apiError(502, 'gateway'))
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'readback-failed')
    assert.deepEqual(page.fixture.pendingIds.value, ['device-tablet'])

    page.listQueue.push(apiError(503, 'still down'))
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'query-failed')
    assert.deepEqual(page.fixture.pendingIds.value, ['device-tablet'], 'unknown targets survive a failed re-query')

    page.listQueue.push([deviceA, deviceB])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'still-active')
    assert.deepEqual(page.fixture.pendingIds.value, ['device-tablet'])

    page.listQueue.push([deviceA])
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.outcome.value.kind, 'revoked')
    assert.deepEqual(page.fixture.pendingIds.value, [])
  } finally {
    page.dispose()
  }
})

test('a read-back that still marks the target as current is never reported as signed out', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    // Server read-back insists the target is both ACTIVE and the current device.
    page.listQueue.push([deviceA, { ...deviceB, isCurrent: true }])
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'still-active')
    assert.notEqual(page.fixture.outcome.value.kind, 'revoked')
    assert.equal(page.fixture.busyAction.value, null)
  } finally {
    page.dispose()
  }
})

test('403 during a re-query becomes an explicit forbidden state, not a silent empty or success', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push(apiError(502, 'gateway'))
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'readback-failed')

    page.listQueue.push(apiError(403))
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.status.value, 'error')
    assert.equal(page.fixture.errorKind.value, 'forbidden')
    assert.notEqual(page.fixture.status.value, 'empty')
    assert.equal(page.fixture.outcome.value, null)
    assert.equal(page.fixture.busyAction.value, null)
  } finally {
    page.dispose()
  }
})

test('403 on kickout and 403 on read-back both become explicit forbidden states', async () => {
  const kickoutForbidden = loadDevicesPage({ kickout: async () => { throw apiError(403) } })
  try {
    await kickoutForbidden.lifecycle.show()
    kickoutForbidden.fixture.openConfirm(deviceB)
    await kickoutForbidden.fixture.confirmAndRevoke()
    assert.equal(kickoutForbidden.fixture.status.value, 'error')
    assert.equal(kickoutForbidden.fixture.errorKind.value, 'forbidden')
    assert.equal(kickoutForbidden.fixture.busyAction.value, null)
  } finally {
    kickoutForbidden.dispose()
  }

  const readBackForbidden = loadDevicesPage()
  try {
    await readBackForbidden.lifecycle.show()
    readBackForbidden.listQueue.push(apiError(403))
    readBackForbidden.fixture.openConfirm(deviceB)
    await readBackForbidden.fixture.confirmAndRevoke()
    assert.equal(readBackForbidden.fixture.status.value, 'error')
    assert.equal(readBackForbidden.fixture.errorKind.value, 'forbidden')
    assert.equal(readBackForbidden.fixture.busyAction.value, null)
  } finally {
    readBackForbidden.dispose()
  }
})

test('bulk never reports overall success while any target is still ACTIVE, even one flagged current', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    // Both POSTs accepted; the read-back shows one target REVOKED and the other
    // still ACTIVE with the server marking it current.
    page.listQueue.push([deviceA, { ...deviceB, status: 'REVOKED' }, { ...deviceC, isCurrent: true }])
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    const outcome = page.fixture.outcome.value
    assert.notEqual(outcome.kind, 'bulk-revoked', 'an ACTIVE target must block a green success result')
    assert.equal(outcome.kind, 'bulk-partial')
    assert.equal(outcome.revoked, 1)
    assert.equal(outcome.stillActive, 1)
    assert.match(page.fixture.notice.value.text, /已确认退出 1 台/)
    assert.match(page.fixture.notice.value.text, /1 台设备仍显示登录/)
    assert.deepEqual(page.fixture.pendingIds.value, [], 'a current-flagged target is never queued for revoke')
    assert.equal(page.fixture.busyAction.value, null)
    assert.equal(page.fixture.showExit({ ...deviceC, isCurrent: true }), false, 'current device stays protected')
  } finally {
    page.dispose()
  }
})

test('a re-query reports confirmed and still-active counts from the real read-back', async () => {
  const page = loadDevicesPage()
  try {
    await page.lifecycle.show()
    page.listQueue.push(apiError(502, 'gateway'))
    page.fixture.openBulkConfirm()
    await page.fixture.confirmAndRevoke()
    assert.deepEqual(page.fixture.pendingIds.value.slice().sort(), ['device-android', 'device-tablet'])

    // One target is absent (confirmed gone); the other is still ACTIVE.
    page.listQueue.push([deviceA, { ...deviceC }])
    await page.fixture.refreshFromNotice()
    let outcome = page.fixture.outcome.value
    assert.equal(outcome.kind, 'bulk-partial')
    assert.equal(outcome.revoked, 1, 'the confirmed target must be counted, not reported as 0')
    assert.equal(outcome.stillActive, 1)
    assert.equal(outcome.failed, 0)
    assert.deepEqual(page.fixture.pendingIds.value, ['device-android'])

    // Now the remaining target is gone too: report the confirmed count instead of clearing silently.
    page.listQueue.push([deviceA])
    await page.fixture.refreshFromNotice()
    outcome = page.fixture.outcome.value
    assert.ok(outcome, 'a confirmed result is reported rather than dropped')
    assert.equal(outcome.kind, 'bulk-revoked')
    assert.equal(outcome.revoked, 1)
    assert.deepEqual(page.fixture.pendingIds.value, [])
    assert.deepEqual(page.calls.kickout, ['device-tablet', 'device-android'], 'no kickout is replayed')
  } finally {
    page.dispose()
  }
})


test('English load failure ignores a Chinese adapter message and uses page locale copy', async () => {
  const page = loadDevicesPage({ locale: 'en' })
  try {
    page.listQueue.push(apiError(500, '服务暂时不可用，请稍后重试。'))
    await page.lifecycle.show()
    assert.equal(page.fixture.status.value, 'error')
    assert.equal(page.fixture.errorMessage.value, 'The device list could not be read. Try again.')
    assert.doesNotMatch(page.fixture.errorMessage.value, /[\u4e00-\u9fff]/)
    assert.equal(page.fixture.errorMessage.value.includes('服务暂时不可用'), false)
  } finally {
    page.dispose()
  }
})

test('English load failure maps an unknown non-Error rejection to page locale copy', async () => {
  const page = loadDevicesPage({ locale: 'en' })
  try {
    page.listQueue.push(new Error('未知网络错误'))
    await page.lifecycle.show()
    assert.equal(page.fixture.status.value, 'error')
    assert.equal(page.fixture.errorMessage.value, 'The device list could not be read. Try again.')
    assert.doesNotMatch(page.fixture.errorMessage.value, /[\u4e00-\u9fff]/)
  } finally {
    page.dispose()
  }
})

test('English single kickout failure ignores the adapter message and uses page locale copy', async () => {
  const page = loadDevicesPage({ locale: 'en', kickout: async () => { throw apiError(500, '服务暂时不可用，请稍后重试。') } })
  try {
    await page.lifecycle.show()
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.actionError.value, 'Signing out the device did not complete. Try again.')
    assert.doesNotMatch(page.fixture.actionError.value, /[\u4e00-\u9fff]/)
    assert.equal(page.fixture.actionError.value.includes('服务暂时不可用'), false)
    assert.equal(page.fixture.outcome.value, null)
    assert.deepEqual(page.calls.kickout, ['device-tablet'])
  } finally {
    page.dispose()
  }
})

test('English inline refresh failure uses page locale copy and never replays the POST', async () => {
  const page = loadDevicesPage({ locale: 'en' })
  try {
    await page.lifecycle.show()
    page.listQueue.push([deviceA, deviceB, deviceC])
    page.fixture.openConfirm(deviceB)
    await page.fixture.confirmAndRevoke()
    assert.equal(page.fixture.outcome.value.kind, 'still-active')
    assert.deepEqual(page.calls.kickout, ['device-tablet'])

    page.listQueue.push(apiError(502, 'gateway'))
    await page.fixture.refreshFromNotice()
    assert.equal(page.fixture.actionError.value, 'The device list could not be refreshed. Try again.')
    assert.equal(page.fixture.outcome.value.kind, 'query-failed')
    assert.doesNotMatch(page.fixture.actionError.value, /[\u4e00-\u9fff]/)
    assert.deepEqual(page.calls.kickout, ['device-tablet'], 'a failed refresh must not replay the write')
  } finally {
    page.dispose()
  }
})
