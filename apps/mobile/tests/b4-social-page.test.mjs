import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const pagePath = 'src/pages/b4-social/b4-social.vue'

function loadPage({ authenticated = true, allowed = true } = {}) {
  const source = fs.readFileSync(path.join(appRoot, pagePath), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'Missing B4 social page script setup')
  const templateStart = source.indexOf('<template>')
  const templateEnd = source.lastIndexOf('</template>')
  const template = templateStart >= 0 && templateEnd > templateStart ? source.slice(templateStart + '<template>'.length, templateEnd) : ''
  const calls = { navigate: [], restore: 0, loadWorld: 0, read: [], readAll: 0, join: [], leave: [], startFocus: [], updateFocus: [], interaction: [], sync: 0, performance: [] }
  const session = { isAuthenticated: authenticated, verifiedSubject: 'subject-1', identityRevision: 1, permissions: [] }
  const b4 = {
    status: 'ready', online: true, lastError: null, queueCount: 0, performanceLevel: 'High',
    notifications: [], notificationStatus: 'ready', rooms: [], activeFocus: null,
    restore() { calls.restore += 1 },
    loadWorld() { calls.loadWorld += 1; return Promise.resolve() },
    readNotification(id) { calls.read.push(id); return Promise.resolve() },
    readAllNotifications() { calls.readAll += 1; return Promise.resolve() },
    joinRoom(id) { calls.join.push(id); return Promise.resolve() },
    leaveRoom(id) { calls.leave.push(id); return Promise.resolve() },
    startFocus(id, minutes) { calls.startFocus.push([id, minutes]); return Promise.resolve() },
    updateFocus(action) { calls.updateFocus.push(action); return Promise.resolve() },
    sendInteraction(id, code) { calls.interaction.push([id, code]); return Promise.resolve() },
    syncOffline() { calls.sync += 1; return Promise.resolve() },
    setPerformance(level) { calls.performance.push(level); b4.performanceLevel = level },
  }
  const mounted = []
  const shown = []
  const unmounted = []
  const themeListeners = []
  let themeUnsubscribed = 0
  const themeController = {
    resolvedTheme: 'light',
    subscribe(listener) { listener({ resolvedTheme: themeController.resolvedTheme }); themeListeners.push(listener); return () => { themeUnsubscribed += 1 } },
  }
  const modules = {
    vue: {
      ref: (value) => ({ value }),
      computed: (getter) => ({ get value() { return getter() } }),
      watch: () => () => {},
      onMounted: (callback) => mounted.push(callback),
      onUnmounted: (callback) => unmounted.push(callback),
    },
    '@dcloudio/uni-app': { onShow: (callback) => shown.push(callback) },
    '@englishflow/i18n': {
      interpolate: (message, values = {}) => message.replace(/\{(\w+)\}/g, (_match, key) => String(values[key] ?? `{${key}}`)),
    },
    '../../components/MobilePageHeader.vue': {},
    '../../components/b12/B12SocialExtensions.vue': {},
    '../../platform/experience': {
      mobileT: (key) => `mobile.${key}`,
      useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
    },
    '../../platform/v2-foundation': { mobileI18n: { formatNumber: (value) => String(value), formatDate: (value) => String(value) }, mobileThemeController: themeController },
    '../../auth/navigation': { ensureMobilePageAccess: async () => allowed },
    '../../domain/b4': { B4_PERFORMANCE_LEVELS: ['Ultra', 'High', 'Medium', 'Performance'], formatSeconds: (seconds) => String(seconds) },
    '../../platform/b10-foundation': { b10ThemeMode: { value: 'light' } },
    '../../platform/uni-runtime': { getUniRuntime: () => ({ navigateTo(options) { calls.navigate.push(options.url) } }) },
    '../../stores/session': { useSessionStore: () => session },
    '../../stores/b4': { useB4Store: () => b4 },
  }
  const names = ['selectPerformance', 'syncQueue', 'openLogin', 'openPractice', 'noticeType', 'roomTemplate', 'roomChat', 'roomMeta', 'focusStatus', 'interactionLabel', 'send', 'finishFocus', 'backToRooms', 'markRead', 'markAllRead']
  const refs = ['stateName', 'showGated', 'showLoading', 'showFatalError', 'showNoRooms', 'showContent', 'showFocusPanel', 'focusCompleted', 'unreadCount', 'joinedRoom', 'focusRoom', 'focusSeconds', 'completedDismissed', 'resolvedTheme']
  const exported = `${script}\nexport const __test = { ${names.join(', ')} };\nexport const __refs = { ${refs.join(', ')} };\n`
  const compiled = ts.transpileModule(exported, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (!(name in modules)) throw new Error(`Unexpected import ${name} in ${pagePath}`)
    return modules[name]
  }, module, module.exports)
  return { source, template, calls, session, b4, mounted, shown, unmounted, themeListeners, themeUnsubscribed: () => themeUnsubscribed, test: module.exports.__test ?? {}, refs: module.exports.__refs ?? {} }
}

test('B4 social keeps gated, loading and fatal states honest', async () => {
  const gated = loadPage({ authenticated: false, allowed: false })
  await gated.shown[0]()
  assert.equal(gated.refs.showGated.value, true)
  assert.equal(gated.refs.stateName.value, 'gated')
  assert.equal(gated.calls.restore, 0)

  const loading = loadPage()
  loading.b4.status = 'loading'
  assert.equal(loading.refs.stateName.value, 'loading')

  const fatal = loadPage()
  fatal.b4.status = 'error'
  assert.equal(fatal.refs.stateName.value, 'error')
  await fatal.shown[0]()
  assert.equal(fatal.calls.loadWorld, 1)
})

test('B4 social maps no-rooms, rooms, joined, focus, paused and completed states', () => {
  const page = loadPage()
  assert.equal(page.refs.stateName.value, 'no-rooms')
  page.b4.rooms = [{ roomId: 'r1', name: 'Room A', templateCode: 'FOCUS', capacity: 20, memberCount: 3, joined: false, chatMode: 'PRESET_ONLY' }]
  assert.equal(page.refs.stateName.value, 'rooms')
  page.b4.rooms[0].joined = true
  assert.equal(page.refs.stateName.value, 'joined')
  page.b4.activeFocus = { sessionId: 'f1', roomId: 'r1', status: 'RUNNING', startedAt: null, serverDurationSeconds: 90 }
  assert.equal(page.refs.stateName.value, 'focus')
  page.b4.activeFocus.status = 'PAUSED'
  assert.equal(page.refs.stateName.value, 'paused')
  page.b4.activeFocus.status = 'COMPLETED'
  assert.equal(page.refs.stateName.value, 'completed')
  assert.equal(page.refs.showFocusPanel.value, true)
  page.test.backToRooms()
  assert.equal(page.refs.showFocusPanel.value, false)
})

test('B4 social wires notification, room, focus and safe exits to stores', async () => {
  const page = loadPage()
  await page.shown[0]()
  assert.equal(page.calls.restore, 1)
  assert.equal(page.calls.loadWorld, 1)
  page.test.markRead('m1')
  page.test.markAllRead()
  assert.deepEqual(page.calls.read, ['m1'])
  assert.equal(page.calls.readAll, 1)
  page.b4.rooms = [{ roomId: 'r1', name: 'Room A', templateCode: 'FOCUS', capacity: 20, memberCount: 3, joined: false, chatMode: 'PRESET_ONLY' }]
  page.test.send('r1')
  assert.deepEqual(page.calls.interaction, [['r1', 'CHEER_UP']])
  page.test.finishFocus()
  assert.deepEqual(page.calls.updateFocus, ['COMPLETE'])
  page.test.syncQueue()
  assert.equal(page.calls.sync, 1)
  page.test.selectPerformance({ detail: { value: 2 } })
  assert.deepEqual(page.calls.performance, ['Medium'])
  page.test.openPractice()
  page.test.openLogin()
  assert.deepEqual(page.calls.navigate, ['/pages/practice/practice', '/pages/login/login'])
  assert.match(page.template, /room\.joined \? b4\.leaveRoom\(room\.roomId\) : b4\.joinRoom\(room\.roomId\)/u)
  assert.match(page.template, /@click="b4\.startFocus\(joinedRoom\.roomId, focusMinutes\)"/u)
  assert.match(page.template, /@click="b4\.updateFocus\(/u)
  assert.match(page.template, /<B12SocialExtensions/u)
})

test('B4 social does not hardcode design sample members, ranks, timers or report evidence', () => {
  const page = loadPage()
  assert.doesNotMatch(page.template, /晚间专注房|早起读书会|考前冲刺|12 人|5 人|8 人/u)
  assert.doesNotMatch(page.template, /18:42|09:30|86%|860 分钟|学友 · · · 7/u)
  assert.doesNotMatch(page.template, /发送不当互动|长时间挂机占位/u)
  assert.match(page.template, /b4\.rooms/u)
  assert.match(page.template, /b4\.notifications/u)
  assert.match(page.template, /b4\.activeFocus/u)
  assert.match(page.template, /B12SocialExtensions/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /mobileT\('mobile\./u)
})

test('B4 social observes resolved theme and releases controller subscription', () => {
  const page = loadPage()
  assert.equal(page.refs.resolvedTheme.value, 'light')
  page.mounted.forEach((callback) => callback())
  assert.equal(page.themeListeners.length, 1)
  page.themeListeners[0]({ resolvedTheme: 'high-contrast' })
  assert.equal(page.refs.resolvedTheme.value, 'high-contrast')
  page.unmounted.forEach((callback) => callback())
  assert.equal(page.themeUnsubscribed(), 1)
})
