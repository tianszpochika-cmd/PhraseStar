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
const PAGE = 'src/pages/profile/profile.vue'

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function flush() { return new Promise((resolve) => setTimeout(resolve, 0)) }

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function loadTsModule(relativePath) {
  const source = fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error(`unexpected import in ${relativePath}`) }, module, module.exports)
  return module.exports
}

const messages = {
  'profile.minutesPerDay': '{count} 分钟/天',
  'profile.loading': '正在读取学习资料…',
  'profile.errorFallback': '请稍后重试。',
  'onboarding.goals.FOUNDATION.label': '成人零基础',
  'onboarding.goals.COLLEGE_CET.label': '四六级备考',
  'onboarding.goals.POSTGRADUATE_ENGLISH.label': '考研英语',
  'onboarding.goals.WORKPLACE_DAILY.label': '职场与日常',
  'pages.profile.short': '我的',
  'pages.b10-report.short': '学习报告',
  'pages.today.short': '今日任务',
  'pages.b5-commerce.short': '学习权益',
  'pages.b4-offline.short': '离线学习',
  'pages.b4-avatar.short': '我的形象',
  'pages.b6-platform.short': '画质与设备',
  'pages.settings.short': '设置',
  'pages.support.short': '帮助中心',
}

function mobileT(key) {
  return messages[key] ?? key
}

function authT(key) {
  return key === 'session.logout' ? '退出登录' : key
}

function interpolate(message, values = {}) {
  return String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key]))
}

function loadProfile() {
  const calls = { access: [], pages: [], loads: 0, logouts: 0, returnTo: [] }
  const lifecycle = {}
  const behaviors = {
    access: async () => true,
    load: async () => { store.accountStatus = 'ready' },
    logout: async () => true,
    open: async () => undefined,
  }
  const session = vue.reactive({
    status: 'authenticated',
    isAuthenticated: true,
    verifiedSubject: 'subject-a',
    identityRevision: 1,
    adultGate: 'PASSED',
    async logout() { calls.logouts += 1; return behaviors.logout() },
    setReturnTo(value) { calls.returnTo.push(value) },
  })
  const store = vue.reactive({
    account: { goal: 'COLLEGE_CET', quota: 15, uiLocale: 'zh-CN', contentLocale: 'en-US' },
    accountStatus: 'idle',
    goals: [
      { value: 'FOUNDATION', label: '成人零基础' },
      { value: 'COLLEGE_CET', label: '四六级备考' },
      { value: 'POSTGRADUATE_ENGLISH', label: '考研英语' },
      { value: 'WORKPLACE_DAILY', label: '职场与日常' },
    ],
    lastError: null,
    async loadAccount() { calls.loads += 1; return behaviors.load() },
  })

  const theme = vue.reactive({ resolvedTheme: 'light' })
  let themeListener = null
  const mobileThemeController = {
    get resolvedTheme() { return theme.resolvedTheme },
    subscribe(listener) { themeListener = listener; listener({ resolvedTheme: theme.resolvedTheme }); return () => {} },
  }

  const source = read(PAGE)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'profile.vue exposes a script setup block')
  const fixtureExports = `
module.exports.__fixture = {
  pageTitle, pageSubtitle, goalLabel, goalMeta, uiLocaleLabel, contentLocaleLabel,
  adultStatus, adultNote, initialized, hasLoadedAccount, accountError, retrying,
  navError, activeRow, goalBusy, navBusy, logoutOpen, logoutBusy, logoutError,
  showLoading, showError, showGuest, showReady, primaryServices, settingsServices,
  refreshAccount, retryAccount, showProfile, openLogout, closeLogout, confirmLogout,
  openPath, openGoal, openLogin, onDocumentKeydown, resolvedTheme
}
`
  const compiled = ts.transpileModule(`${script}\n${fixtureExports}`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const vuePort = { ...vue, onMounted() {}, onUnmounted() {} }
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
        '../../components/AppIcon.vue': {},
        '../../auth/navigation': { ensureMobilePageAccess: async (path) => { calls.access.push(path); return behaviors.access(path) } },
        '../../auth/i18n': { authT },
        '../../platform/experience': { mobileT, useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }) },
        '../../platform/v2-foundation': { mobileI18n: { formatNumber: (value) => new Intl.NumberFormat('en-US').format(value) }, mobileThemeController },
        '../../platform/uni-runtime': { openUniPage: (url) => { calls.pages.push(url); return behaviors.open(url) } },
        '../../stores/learner-content': { useLearnerContentStore: () => store },
        '../../stores/session': { useSessionStore: () => session },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name} in ${PAGE}`)
      return modules[name]
    }, module, module.exports)
  })
  return { fixture: module.exports.__fixture, session, store, calls, lifecycle, behaviors, theme, setTheme: (value) => { theme.resolvedTheme = value; themeListener?.({ resolvedTheme: value }) }, dispose: () => scope.stop() }
}

test('profile resource module carries the complete 47-key bilingual copy', () => {
  const { profileCopy } = loadTsModule('../../packages/i18n/src/mobile-resources/profile.ts')
  const zh = profileCopy(false)
  const en = profileCopy(true)
  const zhKeys = Object.keys(zh).sort()
  const enKeys = Object.keys(en).sort()
  assert.equal(zhKeys.length, 47)
  assert.equal(enKeys.length, 47)
  assert.deepEqual(zhKeys, enKeys)
  assert.equal(zh.pageSubtitle, '管理资料与设置')
  assert.equal(en.pageSubtitle, 'Manage your profile and settings')
  assert.equal(zh.minutesPerDay, '{count} 分钟/天')
  assert.equal(en.minutesPerDay, '{count} min/day')
  assert.equal(interpolate(zh.minutesPerDay, { count: '1,000' }), '1,000 分钟/天')
  assert.equal(interpolate(en.minutesPerDay, { count: '1,000' }), '1,000 min/day')
  assert.ok(Object.values(zh).every((value) => typeof value === 'string' && value.trim()))
  assert.ok(Object.values(en).every((value) => typeof value === 'string' && value.trim()))
  assert.equal(Object.values(zh).filter((value) => value.includes('{')).join(','), '{count} 分钟/天')
  assert.equal(Object.values(en).filter((value) => value.includes('{')).join(','), '{count} min/day')
})

test('profile binds resolved theme locally and does not hide html via malformed global selectors', async () => {
  const source = read(PAGE)
  assert.match(source, /:data-resolved-theme="resolvedTheme"/)
  assert.match(source, /#profile-shell\[data-resolved-theme="dark"\] \.profile-glow--light/)
  assert.match(source, /#profile-shell\[data-resolved-theme="dark"\] \.profile-glow--dark/)
  assert.match(source, /#profile-shell\[data-resolved-theme="high-contrast"\] \.profile-glow-wrap/)
  assert.doesNotMatch(source, /:global\(/)

  const page = loadProfile()
  try {
    await page.fixture.showProfile()
    assert.equal(page.fixture.resolvedTheme.value, 'light')
    page.setTheme('dark')
    await vue.nextTick()
    assert.equal(page.fixture.resolvedTheme.value, 'dark')
    page.setTheme('high-contrast')
    await vue.nextTick()
    assert.equal(page.fixture.resolvedTheme.value, 'high-contrast')
  } finally {
    page.dispose()
  }
})

test('profile SFC parses, compiles template/script/style, and keeps Figma asset roots', () => {
  const filename = path.join(appRoot, PAGE)
  const source = read(PAGE)
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup)
  assert.equal(descriptor.styles.length, 1)

  const script = compileScript(descriptor, { id: 'profile-page' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename,
    id: 'profile-page',
    scoped: true,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename, id: 'profile-page', scoped: true })
  assert.deepEqual(style.errors, [])

  const page = `${descriptor.scriptSetup.content}\n${descriptor.template.content}\n${descriptor.styles[0].content}`
  for (const pagePath of [
    '/pages/b10-report/b10-report',
    '/pages/today/today',
    '/pages/b5-commerce/b5-commerce',
    '/pages/b4-offline/b4-offline',
    '/pages/b4-avatar/b4-avatar',
    '/pages/settings/settings',
    '/pages/b6-platform/b6-platform',
    '/pages/support/support',
  ]) assert.ok(page.includes(pagePath), `keeps the existing service entry ${pagePath}`)
  assert.match(page, /ensureMobilePageAccess\(PROFILE_PATH\)/)
  assert.match(page, /session\.logout\(\)/)
  assert.match(page, /role="dialog"/)
  assert.match(page, /v-if="showGuest" class="profile-card profile-guest-alert/)
  assert.match(page, /v-else class="profile-card profile-account/)
  assert.match(page, /v-if="showReady" class="profile-logout-wrap/)
  assert.match(page, /v-if="showGuest && logoutError"/)
  assert.match(page, /aria-modal="true"/)
  assert.match(page, /--yx-r4-page-image/)
  assert.match(page, /--yx-r4-glass/)
  assert.match(page, /--v2-warn-soft/)
  assert.match(page, /data-resolved-theme="dark"/)
  assert.match(page, /data-resolved-theme="high-contrast"/)
  assert.match(page, /grid-template-areas/)
  assert.match(page, /@media \(min-width: 700px\)/)
  assert.match(page, /@media \(prefers-reduced-motion: reduce\)/)
  assert.doesNotMatch(descriptor.styles[0].content, /#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/)
  assert.doesNotMatch(descriptor.styles[0].content, /rgba?\(|hsla?\(/)

  const assetRefs = new Set([...page.matchAll(/\/static\/figma-profile-[a-z0-9-]+\/[A-Za-z0-9]+\.svg/g)].map((match) => match[0]))
  assert.ok(assetRefs.size >= 8)
  for (const ref of assetRefs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    assert.ok(fs.existsSync(file), `referenced static asset exists: ${ref}`)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<svg[^>]+width="[\d.]+"[^>]+height="[\d.]+"/, `SVG root keeps width/height: ${ref}`)
  }
})

test('profile waits for the page guard, reads account once, and renders only server goal/locale facts', async () => {
  const page = loadProfile()
  try {
    assert.equal(typeof page.lifecycle.show, 'function')
    await page.fixture.showProfile()
    assert.deepEqual(page.calls.access, ['/pages/profile/profile'])
    assert.equal(page.calls.loads, 1)
    assert.equal(page.fixture.initialized.value, true)
    assert.equal(page.fixture.showReady.value, true)
    assert.equal(page.fixture.showLoading.value, false)
    assert.equal(page.fixture.pageTitle.value, '我的')
    assert.equal(page.fixture.goalMeta.value, '四六级备考 · 15 分钟/天')
    assert.equal(page.fixture.uiLocaleLabel.value, 'profile.localeZhCN')
    assert.equal(page.fixture.contentLocaleLabel.value, 'profile.localeEnUS')
    assert.equal(page.fixture.adultStatus.value.tone, 'ok')

    page.store.account.goal = 'POSTGRADUATE'
    page.store.account.quota = 30
    await vue.nextTick()
    assert.equal(page.fixture.goalMeta.value, '考研英语 · 30 分钟/天')

    page.store.account.quota = 1000
    await vue.nextTick()
    assert.equal(page.fixture.goalMeta.value, '考研英语 · 1,000 分钟/天')

    page.store.account.goal = 'WORKPLACE_DAILY'
    page.store.account.quota = null
    await vue.nextTick()
    assert.equal(page.fixture.goalMeta.value, '职场与日常')

    page.store.account.uiLocale = 'zh-CN'
    page.store.account.contentLocale = 'de-DE'
    await vue.nextTick()
    assert.equal(page.fixture.uiLocaleLabel.value, 'profile.localeZhCN')
    assert.equal(page.fixture.contentLocaleLabel.value, 'profile.localeDeDE')

    page.store.account.goal = null
    page.store.account.quota = null
    page.store.account.uiLocale = 'xx-XX'
    await vue.nextTick()
    assert.equal(page.fixture.goalLabel.value, 'profile.goalUnset')
    assert.equal(page.fixture.uiLocaleLabel.value, 'profile.localeUnknown')
  } finally {
    page.dispose()
  }
})

test('profile guard rejection does not read private account data and guest state stays closed', async () => {
  const page = loadProfile()
  page.session.isAuthenticated = false
  page.session.status = 'unauthenticated'
  page.behaviors.access = async () => false
  try {
    await vue.nextTick()
    await page.fixture.showProfile()
    assert.equal(page.calls.loads, 0)
    assert.equal(page.fixture.showGuest.value, true)
    assert.equal(page.fixture.showReady.value, false)
    assert.equal(page.fixture.showError.value, false)
    assert.deepEqual(page.calls.pages, [])
  } finally {
    page.dispose()
  }
})

test('profile account failures show the server message, retry is busy, and recovery is honest', async () => {
  const page = loadProfile()
  page.behaviors.load = async () => {
    page.store.accountStatus = 'offline'
    page.store.lastError = '账号资料服务暂不可用。'
  }
  try {
    await page.fixture.showProfile()
    assert.equal(page.fixture.showError.value, true)
    assert.equal(page.fixture.accountError.value, '账号资料服务暂不可用。')
    assert.equal(page.fixture.showReady.value, false)

    const pending = deferred()
    let resolves = 0
    page.behaviors.load = async () => {
      resolves += 1
      page.store.accountStatus = 'loading'
      await pending.promise
      page.store.accountStatus = 'ready'
      page.store.lastError = null
    }
    const retry = page.fixture.retryAccount()
    await vue.nextTick()
    assert.equal(page.fixture.retrying.value, true)
    assert.equal(page.fixture.showLoading.value, true)
    pending.resolve()
    await retry
    assert.equal(resolves, 1)
    assert.equal(page.fixture.retrying.value, false)
    assert.equal(page.fixture.showReady.value, true)
    assert.equal(page.fixture.accountError.value, '')
  } finally {
    page.dispose()
  }
})

test('profile ignores a late A account read after the verified identity moves to B', async () => {
  const page = loadProfile()
  const first = deferred()
  const second = deferred()
  let load = 0
  page.behaviors.load = async () => {
    load += 1
    page.store.accountStatus = 'loading'
    if (load === 1) {
      await first.promise
      page.store.account = { goal: 'COLLEGE_CET', quota: 15, uiLocale: 'zh-CN', contentLocale: 'en-US' }
      page.store.accountStatus = 'ready'
      return
    }
    await second.promise
    page.store.account = { goal: 'POSTGRADUATE', quota: 30, uiLocale: 'en-US', contentLocale: 'en-US' }
    page.store.accountStatus = 'ready'
  }
  try {
    const showing = page.fixture.showProfile()
    await flush()
    assert.equal(page.calls.loads, 1)

    page.session.verifiedSubject = 'subject-b'
    page.session.identityRevision = 2
    await vue.nextTick()
    assert.equal(page.fixture.hasLoadedAccount.value, false)
    assert.equal(page.fixture.showReady.value, false)
    assert.equal(page.calls.loads, 2)

    first.resolve()
    await showing
    await vue.nextTick()
    assert.equal(page.fixture.hasLoadedAccount.value, false, 'late A data must not open the B account page')
    assert.equal(page.fixture.showReady.value, false)
    assert.equal(page.store.account.goal, 'COLLEGE_CET')

    second.resolve()
    await flush()
    await vue.nextTick()
    assert.equal(page.fixture.hasLoadedAccount.value, true)
    assert.equal(page.fixture.showReady.value, true)
    assert.equal(page.fixture.goalMeta.value, '考研英语 · 30 分钟/天')
    assert.equal(page.fixture.uiLocaleLabel.value, 'profile.localeEnUS')
  } finally {
    page.dispose()
  }
})

test('profile invalidates an in-flight account read when the page hides', async () => {
  const page = loadProfile()
  const pending = deferred()
  page.behaviors.load = async () => {
    page.store.accountStatus = 'loading'
    await pending.promise
    page.store.accountStatus = 'ready'
  }
  try {
    const showing = page.fixture.showProfile()
    await flush()
    assert.equal(page.calls.loads, 1)
    assert.equal(page.lifecycle.hide instanceof Function, true)
    page.lifecycle.hide()
    pending.resolve()
    await showing
    await flush()
    assert.equal(page.fixture.hasLoadedAccount.value, false)
    assert.equal(page.fixture.showReady.value, false)
    assert.equal(page.fixture.initialized.value, false)
  } finally {
    page.dispose()
  }
})

test('profile logout requires confirmation, reports failure, and never fakes success', async () => {
  const page = loadProfile()
  try {
    await page.fixture.showProfile()
    page.fixture.openLogout()
    assert.equal(page.fixture.logoutOpen.value, true)
    let prevented = 0
    page.fixture.onDocumentKeydown({ key: 'Escape', preventDefault() { prevented += 1 } })
    assert.equal(page.fixture.logoutOpen.value, false)
    assert.equal(prevented, 1)

    page.behaviors.logout = async () => {
      page.session.isAuthenticated = false
      page.session.status = 'unauthenticated'
      return false
    }
    page.fixture.openLogout()
    await page.fixture.confirmLogout()
    assert.equal(page.calls.logouts, 1)
    assert.equal(page.fixture.logoutOpen.value, false)
    assert.equal(page.fixture.logoutError.value, 'forbidden.logoutFailed')
    assert.deepEqual(page.calls.pages, [])
    assert.equal(page.fixture.showReady.value, false)
    assert.equal(page.fixture.showGuest.value, true)
  } finally {
    page.dispose()
  }
})

test('profile logout confirmation waits for the real session result before navigation', async () => {
  const page = loadProfile()
  const pending = deferred()
  page.behaviors.logout = async () => pending.promise
  try {
    await page.fixture.showProfile()
    page.fixture.openLogout()
    const first = page.fixture.confirmLogout()
    await vue.nextTick()
    assert.equal(page.fixture.logoutBusy.value, true)
    const second = page.fixture.confirmLogout()
    await second
    assert.equal(page.calls.logouts, 1, 'a busy confirmation cannot submit twice')
    page.fixture.closeLogout()
    assert.equal(page.fixture.logoutOpen.value, true, 'cannot dismiss while the revoke request is in flight')

    pending.resolve(true)
    await first
    assert.equal(page.fixture.logoutBusy.value, false)
    assert.equal(page.fixture.logoutOpen.value, false)
    assert.deepEqual(page.calls.pages, ['/pages/login/login'])
    assert.equal(page.fixture.logoutError.value, '')
  } finally {
    page.dispose()
  }
})

test('profile service rows keep every existing entry and guard double navigation', async () => {
  const page = loadProfile()
  try {
    await page.fixture.showProfile()
    const paths = [...page.fixture.primaryServices, ...page.fixture.settingsServices].map((row) => row.path)
    assert.deepEqual(paths, [
      '/pages/b10-report/b10-report',
      '/pages/b5-commerce/b5-commerce',
      '/pages/b4-avatar/b4-avatar',
      '/pages/today/today',
      '/pages/b4-offline/b4-offline',
      '/pages/b6-platform/b6-platform',
      '/pages/settings/settings',
      '/pages/support/support',
    ])

    const pending = deferred()
    page.behaviors.open = async (url) => { if (url.includes('b10-report')) await pending.promise }
    const first = page.fixture.openPath('/pages/b10-report/b10-report', 'report')
    await vue.nextTick()
    assert.equal(page.fixture.navBusy.value, true)
    assert.equal(page.fixture.activeRow.value, 'report')
    await page.fixture.openPath('/pages/settings/settings', 'settings')
    assert.deepEqual(page.calls.pages, ['/pages/b10-report/b10-report'])
    pending.resolve()
    await first
    assert.equal(page.fixture.navBusy.value, false)
    assert.equal(page.fixture.activeRow.value, '')

    await page.fixture.openGoal()
    assert.equal(page.calls.pages.at(-1), '/pages/onboarding/onboarding')
    assert.equal(page.fixture.goalBusy.value, false)

    page.session.isAuthenticated = false
    await page.fixture.openLogin()
    assert.deepEqual(page.calls.returnTo, ['/pages/profile/profile'])
    assert.equal(page.calls.pages.at(-1), '/pages/login/login')
  } finally {
    page.dispose()
  }
})

test('profile navigation failure is visible and a later action clears it', async () => {
  const page = loadProfile()
  try {
    await page.fixture.showProfile()
    page.behaviors.open = async () => { throw new Error('navigation rejected') }
    await page.fixture.openPath('/pages/support/support', 'support')
    assert.equal(page.fixture.navError.value, 'forbidden.navigationFailed')
    assert.equal(page.fixture.navBusy.value, false)
    page.behaviors.open = async () => undefined
    await page.fixture.openPath('/pages/settings/settings', 'settings')
    assert.equal(page.fixture.navError.value, '')
  } finally {
    page.dispose()
  }
})

test('profile adult state maps to text, tone, and the correct recovery entry', async () => {
  const page = loadProfile()
  try {
    await page.fixture.showProfile()
    assert.equal(page.fixture.adultStatus.value.tone, 'ok')
    assert.equal(page.fixture.adultNote.value, null)

    page.session.adultGate = 'REQUIRED'
    await vue.nextTick()
    assert.equal(page.fixture.adultStatus.value.tone, 'warn')
    assert.equal(page.fixture.adultNote.value.path, '/pages/onboarding/onboarding')
    assert.equal(page.fixture.adultNote.value.action, 'profile.verify')

    page.session.adultGate = 'REJECTED'
    await vue.nextTick()
    assert.equal(page.fixture.adultStatus.value.tone, 'bad')
    assert.equal(page.fixture.adultNote.value.path, '/pages/support/support')
    assert.equal(page.fixture.adultNote.value.action, 'profile.viewHelp')
  } finally {
    page.dispose()
  }
})
