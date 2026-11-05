import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const vue = createRequire(import.meta.url)('vue')

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath) {
  const compiled = ts.transpileModule(read(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(() => {
    throw new Error(`unexpected import in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

function getPath(root, key) {
  let value = root
  for (const part of key.split('.')) value = value?.[part]
  return value
}

const withdrawal = loadTs('src/domain/learning-consent-withdrawal.ts')
const copyZh = loadTs('../../packages/i18n/src/mobile-resources/settings-page.ts').settingsPageCopy(false)
const preferenceSync = loadTs('src/domain/mobile-preference-sync.ts')
const notificationDomain = loadTs('src/domain/notification-preferences.ts')

const withdrawalCopy = {
  'privacy.revoke': '撤回学习同意',
  'privacy.revokeSummary': '撤回后，学习功能会停用，账号仍会保留。',
  'privacy.revokeConfirmTitle': '确定撤回学习同意？',
  'privacy.revokeConfirm': '确认撤回',
  'privacy.withdrawing': '正在撤回…',
  'privacy.revoked': '学习同意已撤回。学习功能已停用，账号仍保留。',
  'privacy.revokeFailed': '尚未确认撤回，请重试或联系支持。',
  'privacy.retry': '重试',
  'common.cancel': '取消',
}

function consentTransport(calls) {
  return async (requestPath, init) => {
    calls.push({ path: requestPath, body: init.body, method: init.method, idempotencyKey: init.idempotencyKey })
    if (requestPath === '/iam/principal/me') return { data: { principal: { consentState: { version: 'ctl-consent-doc-v1' } } } }
    if (requestPath === '/learner/targets') throw new withdrawal.ConsentHttpError(403)
    return {}
  }
}

function loadSettings() {
  const calls = { access: [], pages: [], withdraw: 0 }
  const gateMarks = []
  const lifecycle = {}
  const storage = new Map()
  const storageApi = {
    getStorageSync(key) { return storage.get(key) || '' },
    setStorageSync(key, value) { storage.set(key, value) },
    removeStorageSync(key) { storage.delete(key) },
  }
  function mobileT(key) {
    if (key === 'forbidden.navigationFailed') return '页面未能打开，请重试。'
    const value = getPath(copyZh, key.replace(/^settingsPage\./, ''))
    return typeof value === 'string' ? value : key
  }
  function interpolate(message, values = {}) {
    return String(message).replace(/\{(\w+)\}/g, (_, key) => values[key] === undefined ? `{${key}}` : String(values[key]))
  }
  const session = vue.reactive({
    verifiedSubject: 'learner-a',
    identityRevision: 1,
    isAuthenticated: true,
    isLearningReady: true,
    adultGate: 'PASSED',
    learningConsentWithdrawn: false,
    getMobileApiIdentity: () => ({ subject: session.verifiedSubject, revision: session.identityRevision }),
    async restore() {},
    markLearningConsentWithdrawn() {
      gateMarks.push('withdrawn')
      session.learningConsentWithdrawn = true
    },
  })
  const store = vue.reactive({
    account: { themeMode: 'SYSTEM', highContrast: false, motionMode: 'FULL', goal: 'COLLEGE_CET', quota: 15, contentLocale: 'en-US', uiLocale: 'zh-CN' },
    accountStatus: 'ready',
    goals: [{ value: 'COLLEGE_CET', label: '四六级备考' }],
    lastError: null,
    onboardingResume: { saved: true, goal: 'COLLEGE_CET', quota: 15 },
    async loadAccount() { store.accountStatus = 'ready'; store.lastError = null },
    forgetOnboardingResume() {
      gateMarks.push('resume')
      store.onboardingResume = null
    },
  })
  const source = read('src/pages/settings/settings.vue')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)?.[1]
  assert.ok(script, 'settings.vue exposes script setup')
  const compiled = ts.transpileModule(`${script}\nmodule.exports.__fixture = { withdrawConfirming, withdrawing, withdrawSucceeded, withdrawNotice, confirmWithdrawLearningConsent, settingsT }\n`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
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
        '../../platform/v2-foundation': { mobileThemeController: { theme: 'system', resolvedTheme: 'light', subscribe(listener) { listener({ resolvedTheme: 'light' }); return () => {} }, setTheme() {} }, mobileI18n: { formatNumber: (value) => String(value) } },
        '../../platform/b10-foundation': { b10ContentLocale: vue.ref('en-US'), b10UiLocale: vue.ref('zh-CN') },
        '../../platform/experience': {
          mobileExperienceEngine: { state: { level: 'High' }, subscribe() { return () => {} } },
          mobileMotionMode: vue.ref('FULL'),
          mobileT,
          restoreMobileQualityDefault() { return 'Medium' },
          setMobileMotion() {},
          setMobileQuality() {},
          useMobileExperience: () => ({ experienceStyle: {}, experienceMotion: 'on' }),
        },
        '../../platform/uni-runtime': {
          getUniRuntime: () => storageApi,
          openUniPage(url) { calls.pages.push(url) },
        },
        '../../auth/navigation': { ensureMobilePageAccess: async (url) => { calls.access.push(url); return true } },
        '../../domain/it7-closure': { privacyNotices: () => ['隐私说明来自服务端投影。'] },
        '../../api/support': { readMobileClosureBoard: async () => ({ privacy: {} }) },
        '../../api/learning-consent-withdrawal': {
          withdrawLearningConsent: async (idempotencyKey) => {
            calls.withdraw += 1
            return withdrawal.runLearningConsentWithdrawal(consentTransport(calls.consent ??= []), idempotencyKey)
          },
        },
        '../../api/b12': {
          listB12NotificationPreferences: async () => notificationRows(),
          updateB12NotificationPreference: async (category, channel, command) => ({ category, channel, ...command }),
        },
        '../../stores/learner-content': { useLearnerContentStore: () => store },
        '../../stores/session': { useSessionStore: () => session },
        '../../domain/notification-preferences': notificationDomain,
        '../../domain/mobile-preference-sync': preferenceSync,
        '@englishflow/i18n': { interpolate },
      }
      if (!(name in modules)) throw new Error(`unexpected import ${name}`)
      return modules[name]
    }, module, module.exports)
  })
  return {
    fixture: module.exports.__fixture,
    calls,
    gateMarks,
    lifecycle,
    session,
    store,
    dispose: () => scope.stop(),
  }
}

function loadNavigation(session, store) {
  const opened = []
  const compiled = ts.transpileModule(read('src/auth/navigation.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      '../api/client': { setMobileApiErrorHandler() {} },
      './gateway-auth': { safeMobileReturnTo: (value) => typeof value === 'string' && value.startsWith('/pages/') ? value.split(/[?#]/, 1)[0] : '/pages/home/home' },
      '../domain/onboarding-resume': { selectOnboardingResumeStep: () => 'assessment' },
      '../platform/uni-runtime': {
        getUniRuntime: () => ({ reLaunch() {}, navigateTo() {} }),
        openUniPage(url) { opened.push(url) },
      },
      '../stores/pinia': { pinia: {} },
      '../stores/learner-content': { useLearnerContentStore: () => store },
      '../stores/session': { useSessionStore: () => session },
    }
    if (!(name in modules)) throw new Error(`unexpected navigation import ${name}`)
    return modules[name]
  }, module, module.exports)
  return { navigation: module.exports, opened }
}

test('mobile withdrawal marks ADULT_LEARNING withdrawn and keeps the settings notice', async () => {
  const pageSource = read('src/pages/settings/settings.vue')
  const api = read('src/api/learning-consent-withdrawal.ts')
  assert.equal(withdrawal.WITHDRAW_BUTTON_LABEL, '撤回学习同意')
  assert.equal(withdrawal.WITHDRAW_CONFIRM_COPY, '确认撤回后，学习能力会收回。账号仍会保留。')
  assert.equal(withdrawal.WITHDRAW_DONE_COPY, '学习同意已撤回。学习能力已收回，账号仍保留。')
  assert.equal(withdrawal.WITHDRAW_FAILED_COPY, '撤回没有完成。学习同意仍在。')
  for (const [key, text] of Object.entries(withdrawalCopy)) {
    assert.equal(getPath(copyZh, key), text, key)
    assert.match(pageSource, new RegExp(`settingsT\\('${key.replace('.', '\\.')}'\\)`), key)
  }
  assert.match(pageSource, /confirmWithdrawLearningConsent/)
  assert.match(pageSource, /onShow\(/)
  assert.match(pageSource, /onHide\(/)
  assert.match(pageSource, /markLearningConsentWithdrawn/)
  assert.match(pageSource, /forgetOnboardingResume/)
  assert.match(api, /skipAuthRetry: true/)
  assert.match(api, /\/iam\/consents|runLearningConsentWithdrawal/)

  const directCalls = []
  const result = await withdrawal.runLearningConsentWithdrawal(consentTransport(directCalls), 'mobile-withdraw')
  assert.equal(directCalls[0].path, '/iam/principal/me')
  assert.equal(directCalls[0].method, 'GET')
  assert.equal(directCalls[1].path, '/iam/consents')
  assert.equal(directCalls[1].method, 'PUT')
  assert.equal(directCalls[1].body.type, 'ADULT_LEARNING')
  assert.equal(directCalls[1].body.decision, 'WITHDRAWN')
  assert.equal(directCalls[1].body.version, 'ctl-consent-doc-v1')
  assert.equal(directCalls[1].idempotencyKey, 'mobile-withdraw')
  assert.equal(directCalls[2].path, '/learner/targets')
  assert.equal(result.targetsStatus, 403)
  assert.equal(result.withdrawn, true)
  assert.equal(result.notice, withdrawal.WITHDRAW_DONE_COPY)

  const page = loadSettings()
  const navigation = loadNavigation(page.session, page.store)
  try {
    await page.lifecycle.show()
    await new Promise((resolve) => setTimeout(resolve, 0))
    assert.deepEqual(page.calls.access, ['/pages/settings/settings'])
    page.fixture.withdrawConfirming.value = true
    await page.fixture.confirmWithdrawLearningConsent()
    assert.equal(page.calls.withdraw, 1)
    assert.equal(page.calls.consent[1].body.type, 'ADULT_LEARNING')
    assert.equal(page.calls.consent[1].body.decision, 'WITHDRAWN')
    assert.equal(page.calls.consent[1].body.version, 'ctl-consent-doc-v1')
    assert.match(page.calls.consent[1].idempotencyKey, /^withdraw-adult-learning-/)
    assert.equal(page.fixture.withdrawSucceeded.value, true)
    assert.equal(page.fixture.withdrawNotice.value, withdrawalCopy['privacy.revoked'])
    assert.equal(page.fixture.settingsT('privacy.revoked'), withdrawalCopy['privacy.revoked'])
    assert.equal(page.fixture.withdrawConfirming.value, false)
    assert.equal(page.fixture.withdrawing.value, false)
    assert.deepEqual(page.calls.pages, [])
    assert.equal(page.store.onboardingResume, null)
    assert.deepEqual(page.gateMarks, ['withdrawn', 'resume'])
    assert.equal(page.session.learningConsentWithdrawn, true)

    const settingsAllowed = await navigation.navigation.ensureMobilePageAccess('/pages/settings/settings')
    const profileAllowed = await navigation.navigation.ensureMobilePageAccess('/pages/profile/profile')
    const practiceAllowed = await navigation.navigation.ensureMobilePageAccess('/pages/practice/practice')
    const onboardingAllowed = await navigation.navigation.ensureMobilePageAccess('/pages/onboarding/onboarding')
    assert.equal(settingsAllowed, true)
    assert.equal(profileAllowed, true)
    assert.equal(practiceAllowed, false)
    assert.equal(onboardingAllowed, false)
    assert.equal(navigation.navigation.FORBIDDEN_PATH, '/pages/forbidden/forbidden')
    assert.deepEqual(navigation.opened, [navigation.navigation.FORBIDDEN_PATH, navigation.navigation.FORBIDDEN_PATH])
  } finally {
    page.dispose()
  }
})
