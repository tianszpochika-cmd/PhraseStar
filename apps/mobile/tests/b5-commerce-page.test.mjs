import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const { parse, compileScript, compileTemplate, compileStyle } = require('@vue/compiler-sfc')
const appRoot = path.resolve(import.meta.dirname, '..')
const PAGE = 'src/pages/b5-commerce/b5-commerce.vue'
const MODULE = 'src/pages/b5-commerce/commerce-page.ts'
const COPY = '../../packages/i18n/src/mobile-resources/commerce-page.ts'

function source(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8')
}

function loadTs(relativePath) {
  const compiled = ts.transpileModule(source(relativePath), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    if (name === '@englishflow/contracts') return {}
    throw new Error(`Unexpected import ${name} in ${relativePath}`)
  }, module, module.exports)
  return module.exports
}

const commerce = loadTs(MODULE)
const copy = loadTs(COPY)
const zh = copy.commercePageCopy(false)
const en = copy.commercePageCopy(true)
const pageSource = source(PAGE)
const moduleSource = source(MODULE)

test('bilingual commerce copy exposes identical non-empty keys and all mapped status labels', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const key of Object.keys(zh)) {
    assert.equal(typeof zh[key], 'string', key)
    assert.equal(typeof en[key], 'string', key)
    assert.ok(zh[key].trim().length > 0, `zh ${key} must not be empty`)
    assert.ok(en[key].trim().length > 0, `en ${key} must not be empty`)
  }
  for (const status of ['CREATED', 'PAYMENT_PENDING', 'PAID', 'PAYMENT_FAILED', 'REFUND_PENDING', 'REFUND_FAILED', 'REFUNDED', 'CANCELLED', 'EXPIRED', 'UNKNOWN']) {
    assert.ok(zh[commerce.orderStatusKey(status)], `missing order label ${status}`)
    assert.ok(en[commerce.orderStatusKey(status)], `missing en order label ${status}`)
  }
  for (const status of ['PENDING', 'ACTIVE', 'GRACE', 'EXPIRED', 'REVOKED', 'UNKNOWN']) {
    assert.ok(zh[commerce.entitlementStatusKey(status)], `missing entitlement label ${status}`)
    assert.ok(en[commerce.entitlementStatusKey(status)], `missing en entitlement label ${status}`)
  }
})

test('catalog parser preserves canonical fields and resolves PUBLISHED price from server facts', () => {
  const parsed = commerce.toCommerceCatalog({
    catalogVersion: 'v1',
    productionPaymentEnabled: false,
    autoRenewalEnabled: false,
    plans: [{
      planId: 'plan-1',
      skuId: 'sku-1',
      title: 'Canonical plan',
      billingPeriod: 'MONTH',
      currency: 'CNY',
      amountMinor: 9900,
      priceSnapshotId: 'price-1',
      availability: 'PUBLISHED',
      entitlementCode: 'PREMIUM_MONTHLY',
    }],
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.data.shape, 'canonical')
  assert.equal(parsed.data.plans.length, 1)
  assert.equal(parsed.data.invalidPlans, 0)
  assert.equal(parsed.data.productionPaymentEnabled, false)
  const plan = parsed.data.plans[0]
  assert.equal(plan.amountMinor, 9900)
  assert.equal(plan.priceSnapshotId, 'price-1')
  assert.equal(plan.entitlementCode, 'PREMIUM_MONTHLY')
  const price = commerce.resolveCommercePlanPrice(plan, 'zh-CN')
  assert.equal(price.kind, 'amount')
  assert.ok(price.value.includes('99'))
})

test('catalog parser accepts runtime COMING_SOON plans and never converts them into a price or purchase', () => {
  const parsed = commerce.toCommerceCatalog({
    catalogVersion: 'commerce-public-v1',
    productionPaymentEnabled: false,
    plans: [{
      planId: 'sku-2',
      skuId: 'sku-2',
      title: 'Runtime plan',
      billingPeriod: 'PERPETUAL',
      currency: 'CNY',
      amountMinor: 0,
      priceSnapshotId: 'sku-2-v1',
      availability: 'COMING_SOON',
      entitlementCode: 'PREMIUM',
    }],
  })
  assert.equal(parsed.ok, true)
  assert.equal(parsed.data.plans[0].availability, 'COMING_SOON')
  assert.equal(parsed.data.plans[0].billingPeriod, 'PERPETUAL')
  assert.equal(commerce.billingPeriodKey(parsed.data.plans[0].billingPeriod), 'billingPerpetual')
  assert.equal(commerce.resolveCommercePlanPrice(parsed.data.plans[0], 'zh-CN').kind, 'pending')
})

test('catalog parser distinguishes valid empty, unknown shape, and invalid rows', () => {
  const empty = commerce.toCommerceCatalog({ plans: [] })
  assert.equal(empty.ok, true)
  assert.equal(empty.data.plans.length, 0)
  assert.equal(empty.data.invalidPlans, 0)

  assert.equal(commerce.toCommerceCatalog({}).ok, false)
  assert.equal(commerce.toCommerceCatalog(null).ok, false)

  const partial = commerce.toCommerceCatalog({ plans: [{ planId: 'p', skuId: 's' }] })
  assert.equal(partial.ok, true)
  assert.equal(partial.data.plans.length, 0)
  assert.equal(partial.data.invalidPlans, 1)
})

test('order parser accepts canonical state, runtime status, legacy aliases, envelopes and invalid rows', () => {
  const canonical = commerce.toCommerceOrders({
    data: [{
      orderId: 'order-1',
      skuId: 'sku-1',
      state: 'PAID',
      channel: 'SANDBOX_HMAC',
      currency: 'CNY',
      amountMinor: 9900,
      createdAt: '2026-11-30T00:00:00Z',
      updatedAt: '2026-11-30T00:01:00Z',
    }],
  })
  assert.equal(canonical.ok, true)
  assert.equal(canonical.data.shape, 'canonical')
  assert.equal(canonical.data.orders[0].status, 'PAID')
  assert.equal(canonical.data.orders[0].channel, 'SANDBOX_HMAC')

  const runtime = commerce.toCommerceOrders([
    { orderId: 'order-2', skuId: 'sku-2', status: 'PENDING_PAYMENT', provider: 'SANDBOX', currency: 'CNY', amountMinor: 0 },
    { orderId: 'order-3', status: 'FAILED' },
  ])
  assert.equal(runtime.ok, true)
  assert.equal(runtime.data.orders[0].status, 'PAYMENT_PENDING')
  assert.equal(runtime.data.orders[1].status, 'PAYMENT_FAILED')
  assert.equal(runtime.data.shape, 'runtime')

  const partial = commerce.toCommerceOrders({ items: [{ orderId: 'valid' }, { skuId: 'missing-id' }] })
  assert.equal(partial.ok, true)
  assert.equal(partial.data.orders.length, 1)
  assert.equal(partial.data.invalidOrders, 1)

  assert.equal(commerce.toCommerceOrders({ orders: 'not-an-array' }).ok, false)
})

test('entitlement parser accepts canonical state, runtime status, stable keys and invalid rows', () => {
  const canonical = commerce.toCommerceEntitlements({
    data: [{
      entitlementId: 'ent-1',
      entitlementCode: 'PREMIUM_MONTHLY',
      skuId: 'sku-1',
      state: 'ACTIVE',
      sourceRef: 'payment-ref:1',
      expiresAt: '2026-11-30T00:00:00Z',
    }],
  })
  assert.equal(canonical.ok, true)
  assert.equal(canonical.data.shape, 'canonical')
  assert.equal(canonical.data.entitlements[0].key, 'ent-1')
  assert.equal(canonical.data.entitlements[0].status, 'ACTIVE')

  const runtime = commerce.toCommerceEntitlements([
    { entitlementCode: 'PREMIUM', status: 'GRACE', expiresAt: null },
  ])
  assert.equal(runtime.ok, true)
  assert.equal(runtime.data.entitlements[0].key, 'PREMIUM#0')
  assert.equal(runtime.data.entitlements[0].status, 'GRACE')
  assert.equal(runtime.data.entitlements[0].expiresAt, null)
  assert.equal(runtime.data.shape, 'runtime')

  const partial = commerce.toCommerceEntitlements([{}, { entitlementId: 'ent-2', state: 'REVOKED' }])
  assert.equal(partial.ok, true)
  assert.equal(partial.data.entitlements.length, 1)
  assert.equal(partial.data.invalidEntitlements, 1)

  assert.equal(commerce.toCommerceEntitlements({ entitlements: 'bad' }).ok, false)
})

test('status/billing/availability keys always map to copy keys, never raw enums', () => {
  const expectedOrder = {
    CREATED: 'orderCreated',
    PAYMENT_PENDING: 'orderPaymentPending',
    PAID: 'orderPaid',
    PAYMENT_FAILED: 'orderPaymentFailed',
    REFUND_PENDING: 'orderRefundPending',
    REFUND_FAILED: 'orderRefundFailed',
    REFUNDED: 'orderRefunded',
    CANCELLED: 'orderCancelled',
    EXPIRED: 'orderExpired',
    UNKNOWN: 'orderUnknown',
  }
  for (const [status, key] of Object.entries(expectedOrder)) assert.equal(commerce.orderStatusKey(status), key)
  assert.equal(commerce.normalizeOrderStatus('PENDING_PAYMENT'), 'PAYMENT_PENDING')
  assert.equal(commerce.normalizeOrderStatus('FAILED'), 'PAYMENT_FAILED')
  assert.equal(commerce.normalizeEntitlementStatus('ACTIVE'), 'ACTIVE')
  assert.equal(commerce.normalizeEntitlementStatus('SOMETHING_ELSE'), 'UNKNOWN')
  assert.equal(commerce.billingPeriodKey('PERPETUAL'), 'billingPerpetual')
  assert.equal(commerce.billingPeriodKey('SOMETHING'), 'billingUnknown')
  assert.equal(commerce.availabilityKey('COMING_SOON'), 'planComingSoon')
  assert.equal(commerce.availabilityKey('SOMETHING'), 'statusUnavailable')
  for (const key of Object.values(expectedOrder)) assert.ok(zh[key] && en[key], key)
})

test('Intl formatting rejects invalid values and never defaults a missing price to zero', () => {
  const zhDate = commerce.formatCommerceDate('2026-11-30T00:00:00Z', 'zh-CN')
  const enDate = commerce.formatCommerceDate('2026-11-30T00:00:00Z', 'en-US')
  assert.ok(zhDate && zhDate.includes('11') && zhDate.includes('30'))
  assert.ok(enDate && enDate.includes('30'))
  assert.equal(commerce.formatCommerceDate('not-a-date', 'zh-CN'), null)
  assert.equal(commerce.formatCommerceDate(null, 'zh-CN'), null)

  const cny = commerce.formatCommerceMoney(9900, 'CNY', 'zh-CN')
  assert.ok(cny && cny.includes('99'))
  assert.equal(commerce.formatCommerceMoney(null, 'CNY', 'zh-CN'), null)
  assert.equal(commerce.formatCommerceMoney(0, 'cny', 'zh-CN'), null)
  assert.equal(commerce.resolveCommercePlanPrice({ availability: 'UNKNOWN', amountMinor: 0, currency: 'CNY' }, 'zh-CN').kind, 'pending')
})

test('identity comparison isolates A/B late responses', () => {
  assert.equal(commerce.isSameCommerceIdentity({ subject: 'a', revision: 1 }, { subject: 'a', revision: 1 }), true)
  assert.equal(commerce.isSameCommerceIdentity({ subject: 'a', revision: 1 }, { subject: 'b', revision: 1 }), false)
  assert.equal(commerce.isSameCommerceIdentity({ subject: 'a', revision: 1 }, { subject: 'a', revision: 2 }), false)
  assert.equal(commerce.isSameCommerceIdentity(null, { subject: 'a', revision: 1 }), false)
})

test('failure mapping separates 401/403/offline/server and retryability', () => {
  const unauthorized = Object.assign(new Error('unauthorized'), { status: 401, details: { error: { code: 'UNAUTHORIZED', retryable: false } } })
  const forbidden = Object.assign(new Error('forbidden'), { status: 403, details: { error: { code: 'FORBIDDEN' } } })
  const offline = Object.assign(new Error('offline'), { status: 0 })
  const server = Object.assign(new Error('server'), { status: 503, details: { error: { retryable: true } } })
  assert.deepEqual(commerce.toCommerceFailure(unauthorized), { status: 401, code: 'UNAUTHORIZED', retryable: false, kind: 'unauthorized' })
  assert.equal(commerce.toCommerceFailure(forbidden).kind, 'forbidden')
  assert.equal(commerce.toCommerceFailure(offline).kind, 'offline')
  assert.equal(commerce.toCommerceFailure(server).kind, 'server')
  assert.equal(commerce.toCommerceFailure(server).retryable, true)
  assert.equal(commerce.isAuthFailure(commerce.toCommerceFailure(unauthorized)), true)
  assert.equal(commerce.isAuthFailure(commerce.toCommerceFailure(server)), false)
})

test('SFC compiles and the page keeps a read-only closed purchase/redemption surface', () => {
  const { descriptor, errors } = parse(pageSource, { filename: PAGE })
  assert.deepEqual(errors, [])
  assert.ok(descriptor.scriptSetup)
  assert.ok(descriptor.template)
  assert.equal(descriptor.styles.length, 1)
  const script = compileScript(descriptor, { id: 'b5-commerce-page' })
  const template = compileTemplate({
    source: descriptor.template.content,
    filename: PAGE,
    id: 'b5-commerce-page',
    scoped: true,
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
  const style = compileStyle({ source: descriptor.styles[0].content, filename: PAGE, id: 'b5-commerce-page', scoped: true })
  assert.deepEqual(style.errors, [])

  const page = `${descriptor.scriptSetup.content}\n${descriptor.template.content}\n${descriptor.styles[0].content}`
  assert.doesNotMatch(page, /createMobileB5Order|prepareMobileB5Payment|createB13Order|prepareB13Payment/)
  assert.doesNotMatch(page, /method:\s*['"]POST/)
  assert.doesNotMatch(page, /<input|<textarea/)
  assert.doesNotMatch(descriptor.template.content, /@click="[^"]*(create|pay|redeem)/i)
  assert.doesNotMatch(descriptor.template.content, /<AppIcon/)
  assert.doesNotMatch(descriptor.styles[0].content, /#[0-9a-fA-F]{3,8}\b/)
  assert.doesNotMatch(moduleSource, /:\s*any\b|<any>|as any/)

  assert.match(script.content, /ensureMobilePageAccess\(PAGE_PATH\)/)
  assert.match(script.content, /!session\.isLearningReady/)
  assert.match(script.content, /currentIdentity\(\)/)
  assert.match(script.content, /listMobileB5Orders\(\)/)
  assert.match(script.content, /isSameCommerceIdentity/)
  assert.match(script.content, /Promise\.allSettled/)
  assert.match(script.content, /invalidPlans/)
  assert.match(script.content, /invalidOrders/)
  assert.match(script.content, /accessBlocked\.value = true/)
  assert.match(script.content, /ordersRefreshErrorKey/)
  assert.doesNotMatch(script.content, /filter\([^)]*PUBLISHED/)
  assert.match(descriptor.template.content, /partialNotice/)
  assert.match(descriptor.template.content, /statusUnavailable/)
  assert.doesNotMatch(descriptor.template.content, /order\.status/)
  assert.doesNotMatch(page, /订单已恢复|已恢复/)

  assert.match(descriptor.template.content, /compact/)
  assert.match(descriptor.template.content, /:show-settings="false"/)
  assert.match(descriptor.template.content, /figma-commerce-core\/chevron-22\.svg/)
  assert.match(descriptor.template.content, /figma-commerce-core\/glow-540\.svg/)
  assert.match(descriptor.template.content, /figma-commerce-core\/crown-22\.svg/)
  assert.match(descriptor.template.content, /figma-commerce-core\/ticket-20\.svg/)
  assert.match(descriptor.template.content, /figma-commerce-core\/receipt-22\.svg/)
  assert.match(descriptor.template.content, /figma-commerce-core\/error-17\.svg/)
  assert.match(script.content, /figma-commerce-core\/dot-brand-8\.svg/)
  assert.match(script.content, /figma-commerce-core\/dot-info-8\.svg/)
  assert.match(descriptor.template.content, /:src="tip\.dot"/)
  assert.match(descriptor.template.content, /role="alert"/)
  assert.match(descriptor.template.content, /commerce-tag/)
  assert.match(descriptor.template.content, /commerce-cta--disabled[\s\S]{0,200}?disabled/)
  assert.match(page, /\.commerce-page\.b10-theme--high-contrast \.commerce-cta\s*\{[^}]*color:\s*var\(--v2-inverse\)/)
  assert.match(descriptor.template.content, /aria-disabled="true"/)
  assert.match(descriptor.template.content, /purchaseUnavailable/)
  assert.match(descriptor.template.content, /continueLearning/)
  assert.match(descriptor.template.content, /returnToLearning/)
})
