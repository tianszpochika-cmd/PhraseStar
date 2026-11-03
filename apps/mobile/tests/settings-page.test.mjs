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
const PAGE = 'src/pages/settings/settings.vue'

function read(relativePath) { return fs.readFileSync(path.join(appRoot, relativePath), 'utf8') }
function loadTsModule(relativePath) {
  const source = read(relativePath)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => { throw new Error(`unexpected import in ${relativePath}`) }, module, module.exports)
  return module.exports
}
function deferred() { let resolve, reject; const promise = new Promise((y, n) => { resolve = y; reject = n }); return { promise, resolve, reject } }
function flush() { return new Promise((resolve) => setTimeout(resolve, 0)) }
function getPath(root, key) { let value = root; for (const part of key.split('.')) value = value?.[part]; return value }

const copyZh = loadTsModule('../../packages/i18n/src/mobile-resources/settings-page.ts').settingsPageCopy(false)
const copyEn = loadTsModule('../../packages/i18n/src/mobile-resources/settings-page.ts').settingsPageCopy(true)
const preferenceSync = loadTsModule('src/domain/mobile-preference-sync.ts')
const notificationDomain = loadTsModule('src/domain/notification-preferences.ts')

function loadPage(options = {}) {
  let locale = options.locale || 'zh-CN'
  const copy = locale === 'en-US' ? copyEn : copyZh
  const goalLabels = {
    'zh-CN': { FOUNDATION: '成人零基础', COLLEGE_CET: '四六级备考', POSTGRADUATE_ENGLISH: '考研英语', WORKPLACE_DAILY: '职场与日常' },
    'en-US': { FOUNDATION: 'Adult foundations', COLLEGE_CET: 'CET-4 and CET-6', POSTGRADUATE_ENGLISH: 'Postgraduate English', WORKPLACE_DAILY: 'Work and daily life' },
  }
  function mobileT(key) {
    if (key === 'settings') return locale === 'en-US' ? 'Settings' : '设置'
    if (key.startsWith('onboarding.goals.') && key.endsWith('.label')) {
      const goal = key.split('.')[2]
      return goalLabels[locale === 'en-US' ? 'en-US' : 'zh-CN'][goal] || key
    }
    if (key === 'profile.goalUnknown') return locale === 'en-US' ? 'Goal not recognized' : '目标暂未识别'
    if (key === 'forbidden.navigationFailed') return locale === 'en-US' ? 'The page could not be opened. Try again.' : '页面未能打开，请重试。'
    const value = getPath(copy, key.replace(/^settingsPage\./, ''))
    return typeof value === 'string' ? value : key
  }
  function interpolate(message, values = {}) { return String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key])) }
  const calls = { access: [], pages: [], save: [], locale: [], notificationUpdates: [], formatNumbers: [], notifications: 0, withdraw: 0, mark: 0, forget: 0 }
  const lifecycle = {}
  const storage = new Map()
  const storageApi = {
    getStorageSync(key) { return storage.get(key) || '' },
    setStorageSync(key, value) { storage.set(key, value) },
    removeStorageSync(key) { storage.delete(key) },
  }
  const behaviors = {
    access: async () => true,
    accountError: false,
    saveMode: 'ok',
    saveDeferred: null,
    localeMode: 'ok',
    notificationsMode: 'ok',
    notificationReject: null,
    withdraw: { withdrawn: true, targetsStatus: 403, notice: 'server notice', version: 'v1' },
    withdrawReject: false,
    navReject: false,
    privacyLines: ['隐私说明来自服务端投影。'],
  }
  const b10ContentLocale = vue.ref(options.contentLocale || 'en-US')
  const b10UiLocale = vue.ref('zh-CN')
  const mobileMotionMode = vue.ref('FULL')
  const themeState = vue.reactive({ theme: 'system', resolvedTheme: 'light' })
  let themeListener = null
  const mobileThemeController = {
    get theme() { return themeState.theme },
    get resolvedTheme() { return themeState.resolvedTheme },
    subscribe(listener) { themeListener = listener; listener({ resolvedTheme: themeState.resolvedTheme }); return () => {} },
    setTheme(value) {
      themeState.theme = value
      themeState.resolvedTheme = value === 'system' ? 'light' : value
      themeListener?.({ resolvedTheme: themeState.resolvedTheme })
    },
  }
  const engine = { state: { level: 'High' }, subscribe() { return () => {} } }
  const selectedQuality = []
  const session = vue.reactive({
    verifiedSubject: 'subject-a',
    identityRevision: 1,
    isAuthenticated: true,
    status: 'authenticated',
    learningConsentWithdrawn: false,
    getMobileApiIdentity() { return { subject: session.verifiedSubject, revision: session.identityRevision } },
    markLearningConsentWithdrawn() { calls.mark += 1; session.learningConsentWithdrawn = true },
  })
  const store = vue.reactive({
    account: { themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: 'COLLEGE_CET', quota: 15, contentLocale: options.contentLocale || 'en-US', uiLocale: 'zh-CN' },
    accountStatus: 'ready',
    goals: [{ value: 'COLLEGE_CET', label: '四六级备考' }],
    lastError: null,
    async loadAccount() {
      calls.account = (calls.account || 0) + 1
      if (behaviors.accountError) { store.accountStatus = 'offline'; store.lastError = '账户读取失败。'; return }
      store.accountStatus = 'ready'; store.lastError = null
    },
    async savePreferences(input) {
      calls.save.push(input)
      if (behaviors.saveDeferred) await behaviors.saveDeferred.promise
      if (behaviors.saveMode === 'fail') { store.accountStatus = 'offline'; store.lastError = '保存失败。'; return }
      store.account = { ...store.account, ...input }
      store.accountStatus = 'ready'; store.lastError = null
    },
    async saveContentLocale(next) {
      calls.locale.push(next)
      if (behaviors.localeMode === 'fail') { store.accountStatus = 'offline'; store.lastError = '语言保存失败。'; return false }
      store.account = { ...store.account, contentLocale: next }
      b10ContentLocale.value = next
      store.accountStatus = 'ready'; store.lastError = null
      return true
    },
    forgetOnboardingResume() { calls.forget += 1 },
  })
  const source = read(PAGE)
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'settings.vue exposes script setup')
  const exports = `
module.exports.__fixture = {
  themeMode, motionMode, highContrast, qualityLevel, preferenceDraftDirty, saving, saved, saveError,
  localeSaving, localeSaved, localeError, notificationStatus, notificationSettings, notificationRows,
  notificationBusy, notificationError, notificationSuccess, notificationDndEnabled, notificationDndStart,
  notificationDndEnd, notificationDndConflict, notificationDndDirty, notificationDndRetryPending,
  withdrawConfirming, withdrawing, withdrawSucceeded, withdrawNotice, privacyLines, accountLoading, accountError,
  goalLabel, quotaLabel, restoreNotice, resolvedTheme, profileNavError, profileNavBusy, settingsT, chooseTheme, chooseMotion, toggleHighContrast,
  save, retryContentLocale, selectContentLocale, loadAccountPreferences, loadNotificationSettings,
  confirmWithdrawLearningConsent, restoreDisplayDefaults, toggleNotification, saveNotificationDnd,
  openWithdrawConfirm, cancelWithdraw, returnToProfile, settingsBackFrom, applyBackFocus, restoreBackFocus, cleanupFocusDecorations
}
`
  const compiled = ts.transpileModule(`${script}\n${exports}`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const vuePort = { ...vue, onBeforeUnmount() {}, onMounted() {} }
  const scope = vue.effectScope()
  const notificationRows = () => [
    { category: 'LEARNING', channel: 'IN_APP', enabled: true, frequencyPolicy: 'IMMEDIATE', dndWindow: { startLocalTime: '22:00', endLocalTime: '07:00' }, version: 1, consentVersion: 1, locale: 'zh-CN' },
    { category: 'REWARDS', channel: 'IN_APP', enabled: false, frequencyPolicy: 'IMMEDIATE', dndWindow: { startLocalTime: '23:00', endLocalTime: '08:00' }, version: 1, consentVersion: 1, locale: 'zh-CN' },
    { category: 'SYSTEM', channel: 'IN_APP', enabled: true, frequencyPolicy: 'IMMEDIATE', dndWindow: { startLocalTime: '22:00', endLocalTime: '07:00' }, version: 1, consentVersion: 1, locale: 'zh-CN' },
  ]
  scope.run(() => {
    new Function('require', 'module', 'exports', compiled)((name) => {
      const modules = {
        vue: vuePort,
        '@dcloudio/uni-app': { onShow(cb) { lifecycle.show = cb }, onHide(cb) { lifecycle.hide = cb } },
        '../../components/MobilePageHeader.vue': {},
        '../../platform/v2-foundation': { mobileThemeController, mobileI18n: { formatNumber: (value) => { calls.formatNumbers.push(value); return new Intl.NumberFormat(locale === 'en-US' ? 'en-US' : 'zh-CN').format(value) } } },
        '../../platform/b10-foundation': { b10ContentLocale, b10UiLocale },
        '../../platform/experience': {
          mobileExperienceEngine: engine,
          mobileMotionMode,
          mobileT,
          restoreMobileQualityDefault() { selectedQuality.push('default'); return 'Medium' },
          setMobileMotion(value) { mobileMotionMode.value = value },
          setMobileQuality(value) { selectedQuality.push(value) },
          useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
        },
        '../../platform/uni-runtime': { getUniRuntime: () => storageApi, openUniPage: (url) => { calls.pages.push(url); return behaviors.navReject ? Promise.reject(new Error('navigation failed')) : undefined } },
        '../../auth/navigation': { ensureMobilePageAccess: async (url) => { calls.access.push(url); return behaviors.access(url) } },
        '../../domain/it7-closure': { privacyNotices: () => behaviors.privacyLines },
        '../../api/support': { readMobileClosureBoard: async () => ({ privacy: {} }) },
        '../../api/learning-consent-withdrawal': { withdrawLearningConsent: async () => { calls.withdraw += 1; if (behaviors.withdrawReject) throw new Error('withdraw network failure'); return behaviors.withdraw } },
        '../../api/b12': {
          listB12NotificationPreferences: async () => { calls.notifications += 1; if (behaviors.notificationsMode === 'fail') throw new Error('notifications failed'); return notificationRows() },
          updateB12NotificationPreference: async (category, channel, command) => { calls.notificationUpdates.push({ category, channel, command }); if (behaviors.notificationReject === category) throw new Error('update failed'); return { category, channel, ...command } },
        },
        '../../stores/learner-content': { useLearnerContentStore: () => store },
        '../../stores/session': { useSessionStore: () => session },
        '../../domain/notification-preferences': notificationDomain,
        '../../domain/mobile-preference-sync': preferenceSync,
        '@englishflow/i18n': { interpolate },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name} in ${PAGE}`)
      return modules[name]
    }, module, module.exports)
  })
  return { fixture: module.exports.__fixture, calls, lifecycle, behaviors, session, store, b10ContentLocale, themeState, setTheme(value) { themeState.theme = value; themeState.resolvedTheme = value; themeListener?.({ resolvedTheme: value }) }, setLocale(value) { locale = value }, dispose: () => scope.stop() }
}

test('settings resource module has the complete bilingual key set', () => {
  const flat = (value, prefix = '', out = {}) => { for (const [key, item] of Object.entries(value)) { const next = prefix ? `${prefix}.${key}` : key; if (item && typeof item === 'object') flat(item, next, out); else out[next] = item } return out }
  const zh = flat(copyZh), en = flat(copyEn)
  assert.equal(Object.keys(zh).length, 176)
  assert.equal(Object.keys(en).length, 176)
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  assert.equal(zh['appearance.themeSystem'], '跟随系统')
  assert.equal(en['appearance.themeSystem'], 'Follow system')
  assert.equal(zh['notifications.partial'], '{saved} 项已保存，{failed} 项未保存。')
  assert.equal(en['notifications.partial'], '{saved} saved, {failed} not saved.')
  assert.equal(zh['privacy.revokeFailed'], '尚未确认撤回，请重试或联系支持。')
  assert.equal(en['privacy.revokeFailed'], 'Withdrawal is not confirmed. Try again or contact support.')
  const used = [...new Set([...read(PAGE).matchAll(/settingsT\('([^']+)'/g)].map((match) => match[1]))]
  assert.ok(used.length >= 80, String(used.length))
  for (const key of used) assert.equal(typeof zh[key], 'string', `missing zh settingsPage.${key}`)
  for (const key of ['notifications.category.learning','notifications.category.review','notifications.category.streak','notifications.category.exam','notifications.category.checkpoint','notifications.category.studyRoom','notifications.category.rewards','notifications.category.course','notifications.category.membership','notifications.category.marketing','notifications.category.security','notifications.category.account','notifications.category.payment','notifications.category.system']) assert.equal(typeof zh[key], 'string', `missing category ${key}`)
})

test('settings SFC compiles and all referenced static assets are non-empty with their root geometry', () => {
  const source = read(PAGE)
  const filename = path.join(appRoot, PAGE)
  const { descriptor, errors } = parse(source, { filename })
  assert.deepEqual(errors, [])
  const script = compileScript(descriptor, { id: 'settings-page' })
  const template = compileTemplate({ source: descriptor.template.content, filename, id: 'settings-page', scoped: true, compilerOptions: { bindingMetadata: script.bindings } })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename, id: 'settings-page', scoped: true })
  assert.deepEqual(style.errors, [])

  const refs = new Set([...source.matchAll(/\/static\/figma-settings-[a-z0-9-]+\/[A-Za-z0-9]+\.svg/g)].map((match) => match[0]))
  assert.ok(refs.size >= 8, `expected settings assets, got ${refs.size}`)
  for (const ref of refs) {
    const file = path.join(appRoot, 'src', ref.replace(/^\//, ''))
    assert.ok(fs.existsSync(file), `missing static asset ${ref}`)
    const bytes = fs.statSync(file).size
    assert.ok(bytes > 0, `empty static asset ${ref}`)
    const svg = fs.readFileSync(file, 'utf8')
    assert.match(svg, /<svg[^>]+width="[\d.]+"[^>]+height="[\d.]+"/, `root geometry lost: ${ref}`)
    if (ref.includes('imgGlow')) assert.match(svg, /width="540"[^>]+height="480"/, 'glow must retain 540x480 root')
  }
})

test('settings loads account, privacy, and notification facts through existing store/API state', async () => {
  const page = loadPage()
  try {
    await page.lifecycle.show()
    await flush()
    assert.equal(page.fixture.accountLoading.value, false)
    assert.equal(page.fixture.accountError.value, false)
    assert.equal(page.fixture.themeMode.value, 'SYSTEM')
    assert.equal(page.fixture.highContrast.value, false)
    assert.equal(page.fixture.motionMode.value, 'FULL')
    assert.equal(page.fixture.preferenceDraftDirty.value, false)
    assert.equal(page.fixture.goalLabel.value, '四六级备考')
    assert.equal(page.fixture.quotaLabel.value, '15 分钟')
    page.store.account.quota = 1000
    await vue.nextTick()
    assert.equal(page.fixture.quotaLabel.value, '1,000 分钟')
    assert.deepEqual(page.fixture.privacyLines.value, ['隐私说明来自服务端投影。'])
    assert.equal(page.fixture.notificationStatus.value, 'ready')
    assert.equal(page.fixture.notificationSettings.value.length, 14)
    assert.equal(page.fixture.notificationDndConflict.value, true)
  } finally {
    page.dispose()
  }
})

test('settings account error is explicit and does not fake ready preferences', async () => {
  const page = loadPage()
  page.behaviors.accountError = true
  try {
    await page.fixture.loadAccountPreferences()
    assert.equal(page.fixture.accountError.value, true)
    assert.equal(page.fixture.accountLoading.value, false)
    assert.equal(page.store.accountStatus, 'offline')
    assert.equal(page.fixture.saveError.value, '')
  } finally {
    page.dispose()
  }
})

test('settings goal aliases use shared onboarding labels; unknown labels never show internal codes', async () => {
  const page = loadPage()
  try {
    await page.fixture.loadAccountPreferences()
    const cases = [['ZERO_BASIS', '成人零基础'], ['CET_4_6', '四六级备考'], ['POSTGRADUATE', '考研英语'], ['WORKPLACE_DAILY', '职场与日常'], ['COLLEGE_CET', '四六级备考']]
    for (const [code, expected] of cases) {
      page.store.account.goal = code
      await vue.nextTick()
      assert.equal(page.fixture.goalLabel.value, expected)
    }
    page.store.goals = [{ value: 'CUSTOM', label: '自定义目标' }]
    page.store.account.goal = 'CUSTOM'
    await vue.nextTick()
    assert.equal(page.fixture.goalLabel.value, '自定义目标')
    page.store.account.goal = 'UNKNOWN_CODE'
    page.store.goals = []
    await vue.nextTick()
    assert.equal(page.fixture.goalLabel.value, '目标暂未识别')
    page.store.account.goal = ''
    await vue.nextTick()
    assert.equal(page.fixture.goalLabel.value, '尚未设置')

    const english = loadPage({ locale: 'en-US' })
    try {
      await english.fixture.loadAccountPreferences()
      english.store.account.goal = 'COLLEGE_CET'
      await vue.nextTick()
      assert.equal(english.fixture.goalLabel.value, 'CET-4 and CET-6')
      english.store.account.quota = 1000
      await vue.nextTick()
      assert.equal(english.fixture.quotaLabel.value, '1,000 minutes')
    } finally { english.dispose() }
  } finally {
    page.dispose()
  }
})

test('settings dirty appearance saves only theme/highContrast/motion and confirms readback', async () => {
  const page = loadPage()
  try {
    await page.fixture.loadAccountPreferences()
    page.fixture.chooseTheme('DARK')
    page.fixture.toggleHighContrast()
    page.fixture.chooseMotion('REDUCED')
    assert.equal(page.fixture.preferenceDraftDirty.value, true)
    await page.fixture.save()
    assert.equal(page.calls.save.length, 1)
    assert.deepEqual(page.calls.save[0], { themeMode: 'DARK', highContrast: true, motionMode: 'REDUCED' })
    assert.equal(page.fixture.saved.value, true)
    assert.equal(page.fixture.preferenceDraftDirty.value, false)
    assert.equal(page.fixture.saveError.value, '')
  } finally {
    page.dispose()
  }
})

test('settings save failure keeps the local preview and never reports saved', async () => {
  const page = loadPage()
  page.behaviors.saveMode = 'fail'
  try {
    await page.fixture.loadAccountPreferences()
    page.fixture.chooseTheme('DARK')
    await page.fixture.save()
    assert.equal(page.fixture.saved.value, false)
    assert.equal(page.fixture.preferenceDraftDirty.value, true)
    assert.equal(page.fixture.saveError.value, page.fixture.settingsT('appearance.saveFailedLocalDetail'))
    assert.equal(page.fixture.accountError.value, false, 'a save failure must not be presented as an account-read failure')
    assert.equal(page.store.accountStatus, 'offline')
  } finally {
    page.dispose()
  }
})

test('settings late save after account switch cannot mark saved or clear the new draft', async () => {
  const page = loadPage()
  const pending = deferred()
  page.behaviors.saveDeferred = pending
  try {
    await page.fixture.loadAccountPreferences()
    page.fixture.chooseTheme('DARK')
    const saving = page.fixture.save()
    await flush()
    page.session.verifiedSubject = 'subject-b'
    page.session.identityRevision = 2
    await vue.nextTick()
    pending.resolve()
    await saving
    assert.equal(page.fixture.saved.value, false)
    assert.equal(page.fixture.saveError.value, '')
    assert.equal(page.calls.save.length, 1)
  } finally {
    page.dispose()
  }
})

test('settings content language failure exposes retry and can recover without losing saved facts', async () => {
  const page = loadPage({ contentLocale: 'zh-CN' })
  page.behaviors.localeMode = 'fail'
  try {
    await page.fixture.selectContentLocale(0)
    assert.equal(page.fixture.localeError.value, page.fixture.settingsT('language.contentFailedDetail'))
    assert.equal(page.fixture.localeSaved.value, false)
    page.behaviors.localeMode = 'ok'
    await page.fixture.retryContentLocale()
    assert.equal(page.fixture.localeSaved.value, true)
    assert.equal(page.fixture.localeError.value, '')
    assert.equal(page.b10ContentLocale.value, 'en-US')
    assert.deepEqual(page.calls.locale, ['en-US', 'en-US'])
  } finally {
    page.dispose()
  }
})

test('settings withdrawal success only after a withdrawn result, failure stays failure', async () => {
  const page = loadPage()
  try {
    page.fixture.withdrawConfirming.value = true
    page.behaviors.withdraw = { withdrawn: true, targetsStatus: 403, notice: 'ignored server notice', version: 'v1' }
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.fixture.withdrawSucceeded.value, true)
    assert.equal(page.fixture.withdrawConfirming.value, false)
    assert.equal(page.fixture.withdrawNotice.value, page.fixture.settingsT('privacy.revoked'))
    assert.equal(page.calls.mark, 1)

    page.fixture.withdrawSucceeded.value = false
    page.fixture.withdrawNotice.value = ''
    page.fixture.withdrawConfirming.value = true
    page.behaviors.withdraw = { withdrawn: false, targetsStatus: 200, notice: 'still there', version: 'v1' }
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.fixture.withdrawSucceeded.value, false)
    assert.equal(page.fixture.withdrawNotice.value, page.fixture.settingsT('privacy.revokeFailed'))
    assert.doesNotMatch(page.fixture.withdrawNotice.value, /仍在|remains/)
    assert.equal(page.calls.mark, 1)
    assert.equal(page.fixture.withdrawConfirming.value, true)

    page.fixture.withdrawSucceeded.value = false
    page.fixture.withdrawNotice.value = ''
    page.behaviors.withdraw = { withdrawn: false, targetsStatus: null, notice: 'unconfirmed', version: 'v1' }
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.fixture.withdrawSucceeded.value, false)
    assert.equal(page.fixture.withdrawNotice.value, page.fixture.settingsT('privacy.revokeFailed'))
    assert.doesNotMatch(page.fixture.withdrawNotice.value, /仍在|remains/)

    page.fixture.withdrawSucceeded.value = false
    page.fixture.withdrawNotice.value = ''
    page.behaviors.withdrawReject = true
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.fixture.withdrawSucceeded.value, false)
    assert.equal(page.fixture.withdrawNotice.value, page.fixture.settingsT('privacy.revokeFailed'))
    assert.doesNotMatch(page.fixture.withdrawNotice.value, /仍在|remains/)
    assert.equal(page.fixture.withdrawing.value, false)
  } finally {
    page.dispose()
  }
})

function fakeStyle(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getPropertyValue(name) { return values.get(name) || '' },
    getPropertyPriority(name) { return values.get(`${name}:priority`) || '' },
    setProperty(name, value, priority = '') { values.set(name, value); values.set(`${name}:priority`, priority) },
    removeProperty(name) { values.delete(name); values.delete(`${name}:priority`) },
    value(name) { return values.get(name) || '' },
    priority(name) { return values.get(`${name}:priority`) || '' },
  }
}
function fakeBack(icon, rootContains = true) {
  return {
    classList: { contains: (name) => name === 'mobile-back' },
    contains: () => rootContains,
    querySelector: () => icon,
  }
}

test('settings focus decoration is scoped, hidden-safe, and restores author inline values', () => {
  const page = loadPage()
  const pageSettingsBack = page.fixture.settingsBackFrom
  const applyBackFocus = page.fixture.applyBackFocus
  const restoreBackFocus = page.fixture.restoreBackFocus
  const cleanupFocusDecorations = page.fixture.cleanupFocusDecorations
  const style = fakeStyle({ outline: '1px dotted rgb(1, 2, 3)', 'outline:priority': 'important', 'border-radius': '4px', 'border-radius:priority': 'important' })
  const icon = { style }
  const back = fakeBack(icon)
  const otherRoot = { isConnected: true, contains: () => false }
  const hiddenRoot = { isConnected: false, contains: () => true }
  try {
    assert.equal(pageSettingsBack(back, otherRoot), null)
    assert.equal(pageSettingsBack(back, hiddenRoot), null)
    assert.equal(style.value('outline'), '1px dotted rgb(1, 2, 3)')

    const root = { isConnected: true, contains: (node) => node === back }
    assert.equal(pageSettingsBack(back, root), back)
    applyBackFocus(back)
    assert.equal(style.value('outline'), '2px solid currentColor')
    assert.equal(style.priority('outline'), 'important')
    assert.equal(style.value('border-radius'), '50%')

    cleanupFocusDecorations()
    assert.equal(style.value('outline'), '1px dotted rgb(1, 2, 3)')
    assert.equal(style.priority('outline'), 'important')
    assert.equal(style.value('border-radius'), '4px')
    assert.equal(style.priority('border-radius'), 'important')

    applyBackFocus(back)
    restoreBackFocus(back)
    assert.equal(style.value('outline'), '1px dotted rgb(1, 2, 3)')
  } finally {
    cleanupFocusDecorations()
    page.dispose()
  }
})
test('settings navigation failure is visible and retry never re-sends consent', async () => {
  const page = loadPage()
  page.behaviors.navReject = true
  try {
    await page.fixture.returnToProfile()
    assert.equal(page.fixture.profileNavError.value, '页面未能打开，请重试。')
    assert.equal(page.fixture.profileNavBusy.value, false)
    assert.equal(page.calls.pages.length, 1)
    assert.equal(page.calls.withdraw, 0)
    page.behaviors.navReject = false
    await page.fixture.returnToProfile()
    assert.equal(page.fixture.profileNavError.value, '')
    assert.equal(page.calls.pages.length, 2)
    assert.equal(page.calls.withdraw, 0)
  } finally {
    page.dispose()
  }
})

test('settings withdraw dialog is not cancellable or resubmitted while busy', async () => {
  const page = loadPage()
  try {
    page.fixture.withdrawConfirming.value = true
    page.fixture.withdrawing.value = true
    page.fixture.cancelWithdraw()
    assert.equal(page.fixture.withdrawConfirming.value, true)
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.calls.withdraw, 0)
  } finally {
    page.dispose()
  }
})

test('settings notification DND conflict and partial failure preserve retry state', async () => {
  const page = loadPage()
  try {
    await page.fixture.loadNotificationSettings()
    assert.equal(page.fixture.notificationDndConflict.value, true)
    page.behaviors.notificationReject = 'REWARDS'
    await page.fixture.saveNotificationDnd(true)
    assert.equal(page.calls.notificationUpdates.length, 14)
    assert.equal(page.fixture.notificationDndRetryPending.value, true)
    assert.match(page.fixture.notificationError.value, /13 项已保存，1 项未保存/)
    assert.ok(page.calls.formatNumbers.includes(13) && page.calls.formatNumbers.includes(1), JSON.stringify(page.calls.formatNumbers))
    assert.equal(page.fixture.notificationBusy.value, null)
  } finally {
    page.dispose()
  }
})

test('settings notification read error is explicit and retryable', async () => {
  const page = loadPage()
  page.behaviors.notificationsMode = 'fail'
  try {
    await page.fixture.loadNotificationSettings()
    assert.equal(page.fixture.notificationStatus.value, 'error')
    assert.equal(page.fixture.notificationSettings.value.length, 0)
    assert.equal(page.fixture.notificationError.value, page.fixture.settingsT('notifications.errorInline'))
  } finally {
    page.dispose()
  }
})

test('settings restore resets appearance/quality locally and tells the user it needs saving', async () => {
  const page = loadPage()
  try {
    await page.fixture.loadAccountPreferences()
    page.fixture.chooseTheme('DARK')
    page.fixture.toggleHighContrast()
    page.fixture.restoreDisplayDefaults()
    assert.equal(page.fixture.themeMode.value, 'SYSTEM')
    assert.equal(page.fixture.highContrast.value, false)
    assert.equal(page.fixture.motionMode.value, 'FULL')
    assert.equal(page.fixture.restoreNotice.value, page.fixture.settingsT('appearance.restored'))
    assert.equal(page.fixture.preferenceDraftDirty.value, true)
  } finally {
    page.dispose()
  }
})
