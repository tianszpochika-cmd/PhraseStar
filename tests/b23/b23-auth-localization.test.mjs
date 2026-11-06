import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import ts from 'typescript'

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..')
const read = (path) => readFileSync(join(root, path), 'utf8')
const loaderReady = register(new URL('../../apps/official-site/tests/website-typescript-loader.mjs', import.meta.url), import.meta.url)
if (loaderReady && typeof loaderReady.then === 'function') await loaderReady

async function loadTypeScriptMessages(path) {
  const source = read(path)
  const { diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  })
  const errors = diagnostics.filter((item) => item.category === ts.DiagnosticCategory.Error)
  assert.deepEqual(errors, [], `${path} should transpile for locale assertions`)
  return import(pathToFileURL(join(root, path)).href)
}

const [learnerI18n, mobileI18n] = await Promise.all([
  loadTypeScriptMessages('packages/i18n/src/learner-base.ts'),
  loadTypeScriptMessages('packages/i18n/src/mobile-experience.ts'),
])
const [learnerFailureCopy, mobileFailureCopy] = await Promise.all([
  loadTypeScriptMessages('apps/learner-web/src/auth/auth-failure-copy.ts'),
  loadTypeScriptMessages('apps/mobile/src/auth/auth-failure-copy.ts'),
])

test('registration and password reset messages cover Chinese and English labels, states, and recovery copy', () => {
  const learner = learnerI18n.learnerBaseMessages
  const mobile = mobileI18n.mobileExperienceMessages
  const webGroups = ['register', 'passwordReset']
  const mobileGroups = ['register', 'resetPassword']

  for (const locale of ['zh-CN', 'en-US']) {
    for (const group of webGroups) {
      const messages = learner[locale].auth[group]
      assert.ok(messages && Object.values(messages).every((value) => typeof value === 'string' && value.length > 0), `${locale} web ${group} messages should be complete`)
    }
    for (const group of mobileGroups) {
      const messages = mobile[locale].mobile.auth[group]
      assert.ok(messages && Object.values(messages).every((value) => typeof value === 'string' && value.length > 0), `${locale} mobile ${group} messages should be complete`)
    }
    assert.doesNotMatch(mobile[locale].mobile.auth.register.accountConflict, /已注册|账号已存在|already be registered|already exists|account exists/i)
  }

  assert.equal(learner['zh-CN'].auth.register.identifier, '账号')
  assert.equal(learner['en-US'].auth.register.identifier, 'Account')
  assert.equal(learner['zh-CN'].auth.register.accountConflict, learner['zh-CN'].auth.register.failed)
  assert.equal(learner['en-US'].auth.register.accountConflict, learner['en-US'].auth.register.failed)
  assert.doesNotMatch(learner['zh-CN'].auth.register.accountConflict, /已注册|账号已存在/)
  assert.doesNotMatch(learner['en-US'].auth.register.accountConflict, /already be registered|already exists|account exists/i)
  assert.equal(learner['zh-CN'].auth.passwordReset.requestSent, '如果该账号可接收重置通知，我们会发送操作说明。')
  assert.equal(learner['en-US'].auth.passwordReset.requestSent, 'If this account can receive a reset notice, we will send instructions.')
  assert.doesNotMatch(learner['zh-CN'].auth.passwordReset.requestSent, /如果账号存在/)
  assert.doesNotMatch(learner['en-US'].auth.passwordReset.requestSent, /if the account exists/i)
  assert.match(mobile['zh-CN'].mobile.auth.resetPassword.requiredFields, /重置口令/)
  assert.match(mobile['en-US'].mobile.auth.resetPassword.requiredFields, /reset code/)
  assert.match(learner['en-US'].auth.register.validationTitle, /Check your details/)
  assert.match(learner['en-US'].auth.passwordReset.validationTitle, /Check your details/)
  assert.match(learner['en-US'].auth.passwordReset.invalidCode, /invalid or expired/)
})

test('auth pages keep concise guidance while retaining password and account recovery requirements', () => {
  const learner = learnerI18n.learnerBaseMessages
  const mobile = mobileI18n.mobileExperienceMessages
  const registerPage = read('apps/learner-web/src/pages/RegisterPage.vue')
  const mobileRegisterPage = read('apps/mobile/src/pages/register/register.vue')

  assert.match(registerPage, /<nav\b[^>]*aria-label="authT\('register\.existingAccount'\)"/)
  assert.match(mobileRegisterPage, /mobileT\('auth\.register\.passwordHint'\)/)

  for (const locale of ['zh-CN', 'en-US']) {
    const webReset = learner[locale].auth.passwordReset
    const mobileMessages = mobile[locale].mobile
    const mobileReset = mobileMessages.auth.resetPassword
    assert.match(mobileMessages.auth.register.passwordHint, /12/)
    assert.doesNotMatch(mobileMessages.auth.register.password, /12/)
    assert.match(mobileMessages.auth.register.shortPassword, /12/)
    assert.notEqual(webReset.description, webReset.requestHint)
    assert.notEqual(mobileMessages.pages['reset-password'].description, mobileReset.requestHint)
    assert.match(webReset.requestSent, /可接收重置通知|can receive a reset notice/)
    assert.doesNotMatch(webReset.requestSent, /账号存在|account exists|if the account exists/i)
    assert.equal(mobileMessages.resetSent, webReset.requestSent)
    for (const copy of [webReset.requestFailed, mobileReset.failedRequest]) assert.notEqual(copy, webReset.requestSent)
  }
})

test('auth failure copy localizes known conflicts and rate limits and hides unknown diagnostics', () => {
  const web = learnerFailureCopy.learnerAuthFailureCopy
  const mobile = mobileFailureCopy.mobileAuthFailureCopy
  const t = (key) => key
  const leaked = '数据库连接池异常：secret-token'

  assert.equal(web('register', '该账号已存在，请直接登录或走密码重置。（iam.account.already_exists）', t), 'register.failed')
  assert.equal(web('register', '请求过于频繁，请稍后再试。', t), 'register.rateLimited')
  assert.equal(web('resetConfirm', 'iam.password_reset.invalid', t), 'passwordReset.invalidCode')
  assert.equal(web('resetRequest', '请求过于频繁，请稍后再试。', t), 'passwordReset.rateLimited')
  for (const [copy, failureKey] of [[web, 'passwordReset.requestFailed'], [mobile, 'auth.resetPassword.failedRequest']]) {
    assert.equal(copy('resetRequest', leaked, t), failureKey)
    assert.equal(copy('resetRequest', 'iam.account.already_exists', t), failureKey)
    assert.doesNotMatch(copy('resetRequest', leaked, t), /secret-token|数据库连接池/)
  }
  assert.equal(web('login', 'CONSENT_WITHDRAWN', t), 'login.consentWithdrawn')
  assert.equal(web('login', '资格不足', t), 'login.eligibilityInsufficient')
  assert.equal(web('login', 'iam.credentials.invalid', t), 'login.invalidCredentials')
  assert.equal(mobile('register', '内容或进度已更新，请刷新后重试。', t), 'auth.register.failed')
  assert.equal(mobile('register', 'iam.account.already_exists', t), 'auth.register.accountConflict')
  assert.equal(mobile('resetRequest', '操作太频繁，请稍后重试。', t), 'auth.resetPassword.rateLimited')
  assert.equal(mobile('resetConfirm', 'network ECONNREFUSED', t), 'auth.resetPassword.failedConfirm')
})

test('all four auth page templates render their user copy through the locale adapters', () => {
  const pagePaths = [
    'apps/learner-web/src/pages/RegisterPage.vue',
    'apps/learner-web/src/pages/PasswordResetPage.vue',
    'apps/mobile/src/pages/register/register.vue',
    'apps/mobile/src/pages/reset-password/reset-password.vue',
  ]
  for (const path of pagePaths) {
    const source = read(path)
    const template = source.match(/<template>([\s\S]*?)<\/template>/)?.[1]
    assert.ok(template, `${path} should have a template`)
    const withoutBrand = template.replace(/<span>语学星<\/span>/g, '')
    assert.doesNotMatch(withoutBrand, /[\u3400-\u9fff]/, `${path} template should not contain hardcoded Chinese UI copy`)
    assert.match(template, /aria-label/, `${path} should expose localized input labels to assistive technology`)
  }
})

test('registration keeps local validation before registration and preserves return-to navigation', () => {
  const web = read('apps/learner-web/src/pages/RegisterPage.vue')
  const mobile = read('apps/mobile/src/pages/register/register.vue')
  for (const [source, prefix] of [[web, 'register.'], [mobile, 'auth.register.']]) {
    const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    const registerAt = script.indexOf('session.register(')
    for (const pattern of [/identifier\.value\.trim\(\)/, /password\.value\.length\s*<\s*12/, /password\.value\s*!==\s*confirm\.value/]) {
      const at = script.search(pattern)
      assert.ok(at >= 0 && at < registerAt)
    }
    for (const key of ['shortPassword', 'mismatch']) assert.ok((script.indexOf(prefix + key) >= 0) && script.indexOf(prefix + key) < registerAt)
    const guardAt = script.search(/if \(firstValidationError\.value\)|if \(firstError\)/)
    assert.ok(guardAt >= 0 && guardAt < registerAt && /\breturn\b/.test(script.slice(guardAt, registerAt)))
  }

  assert.match(web, /safeReturnTo\(route\.query\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(web, /query: \{ redirect: redirectTarget \}/)
  assert.match(web, /session\.consumeReturnTo\(\)/)
  assert.match(mobile, /safeMobileRouteReturnTo\(options\?\.returnTo \?\? options\?\.redirect, ''\)[\s\S]*safeMobileRouteReturnTo\(session\.peekReturnTo\(\)\)/)
  assert.match(mobile, /session\.setReturnTo\(returnTo\.value\)/)
  assert.match(mobile, /continueAfterLogin\(session\.consumeReturnTo\(\)\)/)
  assert.match(web, /errorKind === 'validation' \? 'register\.validationTitle' : 'register\.errorTitle'/)
})

test('password reset keeps request and confirmation route behavior with localized local validation', () => {
  const web = read('apps/learner-web/src/pages/PasswordResetPage.vue')
  const mobile = read('apps/mobile/src/pages/reset-password/reset-password.vue')
  for (const source of [web, mobile]) {
    const script = source.match(/<script setup[^>]*>([\s\S]*?)<\/script>/)?.[1]
    assert.ok(script)
    const confirmAt = script.indexOf('session.confirmPasswordReset(identifier.value, token.value, newPassword.value)')
    const requestAt = script.indexOf('session.requestPasswordReset(identifier.value)')
    const guardAt = script.search(/if \(!await validate\(\)|if \(firstError\)/)
    assert.ok(guardAt >= 0 && guardAt < requestAt && requestAt < confirmAt && /\breturn\b/.test(script.slice(guardAt, requestAt)))
    for (const token of ['identifier.value.trim()', 'token.value.trim()', 'newPassword.value.length < 12', 'requiredToken', 'shortPassword']) {
      const at = script.indexOf(token)
      assert.ok(at >= 0 && at < requestAt)
    }
  }

  assert.match(web, /safeReturnTo\(route\.query\.redirect \?\? session\.peekReturnTo\(\)\)/)
  assert.match(web, /router\.replace\(\{ name: 'login', query: \{ redirect: redirectTarget\.value \} \}\)/)
  assert.match(web, /session\.requestPasswordReset\(identifier\.value\)/)
  assert.match(web, /if \(!ok\) \{\s*requestSent\.value = false/)
  assert.match(web, /errorKind === 'server' \? 'alert' : 'status'/)
  assert.match(mobile, /safeMobileRouteReturnTo\(options\?\.returnTo \?\? options\?\.redirect, ''\)/)
  assert.match(mobile, /options\.token\.trim\(\)[\s\S]{0,160}token\.value = options\.token\s+step\.value = 'confirm'/)
  assert.match(mobile, /session\.requestPasswordReset\(identifier\.value\)/)
  assert.match(mobile, /if \(!success\) \{[^}]*return \}[\s\S]*requestSent\.value = true/)
  assert.match(mobile, /v-if="resetCompleted"[^>]*role="status"[\s\S]*<form v-else[\s\S]*requestSent \? 'status'[\s\S]*mobileT\('resetSent'\)/)
})
