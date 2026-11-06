import type {
  M1015Entitlement,
  M1015Order,
  M1015PublicCatalog,
  M1015PublicPlan,
} from '@englishflow/contracts'

/** Canonical contract shapes used to keep legacy/runtime normalization honest. */
export type CanonicalCommercePlan = Pick<
  M1015PublicPlan,
  'planId' | 'skuId' | 'title' | 'billingPeriod' | 'currency' | 'amountMinor' | 'priceSnapshotId' | 'availability' | 'entitlementCode'
>
export type CanonicalCommerceOrder = Pick<
  M1015Order,
  'orderId' | 'skuId' | 'state' | 'channel' | 'currency' | 'amountMinor' | 'createdAt' | 'updatedAt'
>
export type CanonicalCommerceEntitlement = Pick<
  M1015Entitlement,
  'entitlementId' | 'entitlementCode' | 'state' | 'sourceRef' | 'expiresAt'
>
export type CanonicalCommerceCatalog = Pick<
  M1015PublicCatalog,
  'plans' | 'productionPaymentEnabled' | 'autoRenewalEnabled' | 'catalogVersion'
>

export type CommerceShape = 'canonical' | 'runtime' | 'unknown'
export type CommerceBillingPeriod = 'FREE' | 'MONTH' | 'QUARTER' | 'YEAR' | 'PERPETUAL' | 'ONE_TIME' | 'UNKNOWN'
export type CommerceAvailability = 'PUBLISHED' | 'COMING_SOON' | 'UNAVAILABLE' | 'UNKNOWN'
export type CommerceOrderStatus =
  | 'CREATED'
  | 'PAYMENT_PENDING'
  | 'PAID'
  | 'PAYMENT_FAILED'
  | 'REFUND_PENDING'
  | 'REFUND_FAILED'
  | 'REFUNDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'UNKNOWN'
export type CommerceEntitlementStatus = 'PENDING' | 'ACTIVE' | 'GRACE' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN'

export interface CommercePlan {
  key: string
  planId: string | null
  skuId: string
  title: string
  billingPeriod: CommerceBillingPeriod
  availability: CommerceAvailability
  amountMinor: number | null
  currency: string | null
  priceSnapshotId: string | null
  entitlementCode: string | null
  shape: CommerceShape
}

export interface CommerceCatalog {
  plans: CommercePlan[]
  invalidPlans: number
  productionPaymentEnabled: boolean | null
  autoRenewalEnabled: boolean | null
  catalogVersion: string | null
  shape: CommerceShape
}

export interface CommerceOrder {
  key: string
  orderId: string
  skuId: string | null
  status: CommerceOrderStatus
  channel: string | null
  amountMinor: number | null
  currency: string | null
  createdAt: string | null
  updatedAt: string | null
  shape: CommerceShape
}

export interface CommerceOrders {
  orders: CommerceOrder[]
  invalidOrders: number
  shape: CommerceShape
}

export interface CommerceEntitlement {
  key: string
  entitlementId: string | null
  entitlementCode: string
  skuId: string | null
  status: CommerceEntitlementStatus
  sourceRef: string | null
  sourceType: string | null
  startsAt: string | null
  expiresAt: string | null
  shape: CommerceShape
}

export interface CommerceEntitlements {
  entitlements: CommerceEntitlement[]
  invalidEntitlements: number
  shape: CommerceShape
}

export type CommerceParse<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unknown-shape' }

export interface CommerceIdentity {
  subject: string
  revision: number
}

export type CommerceFailureKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'rate-limited'
  | 'offline'
  | 'server'
  | 'unknown'

export interface CommerceFailure {
  status: number
  code: string | null
  retryable: boolean
  kind: CommerceFailureKind
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function unwrapData(value: unknown): unknown {
  const record = asRecord(value)
  return record && 'data' in record ? record.data : value
}

function stringField(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function numberField(record: Record<string, unknown>, key: string): number | null {
  const value = record[key]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function booleanField(record: Record<string, unknown>, key: string): boolean | null {
  const value = record[key]
  return typeof value === 'boolean' ? value : null
}

function dateField(record: Record<string, unknown>, key: string): string | null {
  const value = stringField(record, key)
  return value && !Number.isNaN(Date.parse(value)) ? value : null
}

function currencyField(record: Record<string, unknown>): string | null {
  const value = stringField(record, 'currency')
  return value && /^[A-Z]{3}$/.test(value) ? value : null
}

function collectionFrom(value: unknown, keys: readonly string[]): unknown[] | null {
  if (Array.isArray(value)) return value
  const root = asRecord(value)
  if (!root) return null
  for (const key of keys) {
    if (Array.isArray(root[key])) return root[key]
  }
  const data = unwrapData(value)
  if (Array.isArray(data)) return data
  const dataRecord = asRecord(data)
  if (dataRecord) {
    for (const key of keys) {
      if (Array.isArray(dataRecord[key])) return dataRecord[key]
    }
  }
  return null
}

function normalizeBilling(value: string | null): CommerceBillingPeriod {
  switch (value?.toUpperCase()) {
    case 'FREE': return 'FREE'
    case 'MONTH': return 'MONTH'
    case 'QUARTER': return 'QUARTER'
    case 'YEAR': return 'YEAR'
    case 'PERPETUAL': return 'PERPETUAL'
    case 'ONE_TIME': return 'ONE_TIME'
    default: return 'UNKNOWN'
  }
}

function normalizeAvailability(value: string | null): CommerceAvailability {
  switch (value?.toUpperCase()) {
    case 'PUBLISHED': return 'PUBLISHED'
    case 'COMING_SOON': return 'COMING_SOON'
    case 'UNAVAILABLE': return 'UNAVAILABLE'
    default: return 'UNKNOWN'
  }
}

export function normalizeOrderStatus(value: string | null): CommerceOrderStatus {
  switch (value?.toUpperCase()) {
    case 'CREATED': return 'CREATED'
    case 'PAYMENT_PENDING':
    case 'PENDING_PAYMENT': return 'PAYMENT_PENDING'
    case 'PAID': return 'PAID'
    case 'PAYMENT_FAILED':
    case 'FAILED': return 'PAYMENT_FAILED'
    case 'REFUND_PENDING': return 'REFUND_PENDING'
    case 'REFUND_FAILED': return 'REFUND_FAILED'
    case 'REFUNDED': return 'REFUNDED'
    case 'CANCELLED': return 'CANCELLED'
    case 'EXPIRED': return 'EXPIRED'
    default: return 'UNKNOWN'
  }
}

export function normalizeEntitlementStatus(value: string | null): CommerceEntitlementStatus {
  switch (value?.toUpperCase()) {
    case 'PENDING': return 'PENDING'
    case 'ACTIVE': return 'ACTIVE'
    case 'GRACE': return 'GRACE'
    case 'EXPIRED': return 'EXPIRED'
    case 'REVOKED': return 'REVOKED'
    default: return 'UNKNOWN'
  }
}

function toPlan(value: unknown, index: number): CommercePlan | null {
  const record = asRecord(value)
  if (!record) return null
  const skuId = stringField(record, 'skuId') ?? stringField(record, 'planId')
  const title = stringField(record, 'title')
  if (!skuId || !title) return null
  const planId = stringField(record, 'planId')
  const priceSnapshotId = stringField(record, 'priceSnapshotId')
  const entitlementCode = stringField(record, 'entitlementCode')
  const shape: CommerceShape = priceSnapshotId && entitlementCode ? 'canonical' : 'runtime'
  return {
    key: `${planId ?? skuId}#${index}`,
    planId,
    skuId,
    title,
    billingPeriod: normalizeBilling(stringField(record, 'billingPeriod')),
    availability: normalizeAvailability(stringField(record, 'availability')),
    amountMinor: numberField(record, 'amountMinor'),
    currency: currencyField(record),
    priceSnapshotId,
    entitlementCode,
    shape,
  }
}

function toOrder(value: unknown, index: number): CommerceOrder | null {
  const record = asRecord(value)
  if (!record) return null
  const orderId = stringField(record, 'orderId')
  if (!orderId) return null
  const state = stringField(record, 'state')
  const status = stringField(record, 'status')
  return {
    key: `${orderId}#${index}`,
    orderId,
    skuId: stringField(record, 'skuId'),
    status: normalizeOrderStatus(state ?? status),
    channel: stringField(record, 'channel') ?? stringField(record, 'channelCode'),
    amountMinor: numberField(record, 'amountMinor'),
    currency: currencyField(record),
    createdAt: dateField(record, 'createdAt'),
    updatedAt: dateField(record, 'updatedAt'),
    shape: state ? 'canonical' : status ? 'runtime' : 'unknown',
  }
}

function toEntitlement(value: unknown, index: number): CommerceEntitlement | null {
  const record = asRecord(value)
  if (!record) return null
  const entitlementId = stringField(record, 'entitlementId')
  const entitlementCode = stringField(record, 'entitlementCode')
  if (!entitlementId && !entitlementCode) return null
  const state = stringField(record, 'state')
  const status = stringField(record, 'status')
  return {
    key: entitlementId ?? `${entitlementCode ?? 'entitlement'}#${index}`,
    entitlementId,
    entitlementCode: entitlementCode ?? 'UNKNOWN',
    skuId: stringField(record, 'skuId'),
    status: normalizeEntitlementStatus(state ?? status),
    sourceRef: stringField(record, 'sourceRef'),
    sourceType: stringField(record, 'sourceType'),
    startsAt: dateField(record, 'startsAt'),
    expiresAt: dateField(record, 'expiresAt'),
    shape: state ? 'canonical' : status ? 'runtime' : 'unknown',
  }
}

export function toCommerceCatalog(value: unknown): CommerceParse<CommerceCatalog> {
  const rawPlans = collectionFrom(value, ['plans'])
  if (rawPlans === null) return { ok: false, reason: 'unknown-shape' }
  const plans = rawPlans.map(toPlan).filter((item): item is CommercePlan => item !== null)
  const source = asRecord(unwrapData(value)) ?? {}
  return {
    ok: true,
    data: {
      plans,
      invalidPlans: rawPlans.length - plans.length,
      productionPaymentEnabled: booleanField(source, 'productionPaymentEnabled'),
      autoRenewalEnabled: booleanField(source, 'autoRenewalEnabled'),
      catalogVersion: stringField(source, 'catalogVersion'),
      shape: plans.some((plan) => plan.shape === 'canonical') ? 'canonical' : plans.length ? 'runtime' : 'unknown',
    },
  }
}

export function toCommerceOrders(value: unknown): CommerceParse<CommerceOrders> {
  const rawOrders = collectionFrom(value, ['orders', 'items'])
  if (rawOrders === null) return { ok: false, reason: 'unknown-shape' }
  const orders = rawOrders.map(toOrder).filter((item): item is CommerceOrder => item !== null)
  return {
    ok: true,
    data: {
      orders,
      invalidOrders: rawOrders.length - orders.length,
      shape: orders.some((order) => order.shape === 'canonical')
        ? 'canonical'
        : orders.length ? 'runtime' : 'unknown',
    },
  }
}

export function toCommerceEntitlements(value: unknown): CommerceParse<CommerceEntitlements> {
  const rawEntitlements = collectionFrom(value, ['entitlements', 'items'])
  if (rawEntitlements === null) return { ok: false, reason: 'unknown-shape' }
  const entitlements = rawEntitlements.map(toEntitlement).filter((item): item is CommerceEntitlement => item !== null)
  return {
    ok: true,
    data: {
      entitlements,
      invalidEntitlements: rawEntitlements.length - entitlements.length,
      shape: entitlements.some((item) => item.shape === 'canonical')
        ? 'canonical'
        : entitlements.length ? 'runtime' : 'unknown',
    },
  }
}

export function orderStatusKey(status: CommerceOrderStatus): string {
  switch (status) {
    case 'CREATED': return 'orderCreated'
    case 'PAYMENT_PENDING': return 'orderPaymentPending'
    case 'PAID': return 'orderPaid'
    case 'PAYMENT_FAILED': return 'orderPaymentFailed'
    case 'REFUND_PENDING': return 'orderRefundPending'
    case 'REFUND_FAILED': return 'orderRefundFailed'
    case 'REFUNDED': return 'orderRefunded'
    case 'CANCELLED': return 'orderCancelled'
    case 'EXPIRED': return 'orderExpired'
    default: return 'orderUnknown'
  }
}

export function entitlementStatusKey(status: CommerceEntitlementStatus): string {
  switch (status) {
    case 'ACTIVE': return 'entitlementActive'
    case 'GRACE': return 'entitlementGrace'
    case 'EXPIRED': return 'entitlementExpired'
    case 'REVOKED': return 'entitlementRevoked'
    case 'PENDING': return 'entitlementPending'
    default: return 'entitlementUnknown'
  }
}

export function billingPeriodKey(period: CommerceBillingPeriod): string {
  switch (period) {
    case 'FREE': return 'billingFree'
    case 'MONTH': return 'billingMonth'
    case 'QUARTER': return 'billingQuarter'
    case 'YEAR': return 'billingYear'
    case 'PERPETUAL': return 'billingPerpetual'
    case 'ONE_TIME': return 'billingOneTime'
    default: return 'billingUnknown'
  }
}

export function availabilityKey(availability: CommerceAvailability): string {
  switch (availability) {
    case 'PUBLISHED': return 'planPublished'
    case 'COMING_SOON': return 'planComingSoon'
    case 'UNAVAILABLE': return 'planUnavailable'
    default: return 'statusUnavailable'
  }
}

export function formatCommerceDate(value: string | null, locale: string): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  try {
    return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(date)
  } catch {
    return null
  }
}

export type CommercePlanPrice =
  | { kind: 'amount'; value: string }
  | { kind: 'pending' }
  | { kind: 'unavailable' }

export function resolveCommercePlanPrice(plan: CommercePlan, locale: string): CommercePlanPrice {
  if (plan.availability === 'PUBLISHED') {
    const value = formatCommerceMoney(plan.amountMinor, plan.currency, locale)
    if (value) return { kind: 'amount', value }
  }
  if (plan.availability === 'UNAVAILABLE') return { kind: 'unavailable' }
  return { kind: 'pending' }
}

export function isActiveEntitlement(status: CommerceEntitlementStatus): boolean {
  return status === 'ACTIVE'
}

export function formatCommerceMoney(amountMinor: number | null, currency: string | null, locale: string): string | null {
  if (amountMinor === null || !Number.isFinite(amountMinor) || amountMinor < 0 || !currency || !/^[A-Z]{3}$/.test(currency)) return null
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amountMinor / 100)
  } catch {
    return null
  }
}

export function isSameCommerceIdentity(expected: CommerceIdentity | null, current: CommerceIdentity | null): boolean {
  return Boolean(expected && current && expected.subject === current.subject && expected.revision === current.revision)
}

export function isAuthFailure(failure: CommerceFailure): boolean {
  return failure.status === 401 || failure.status === 403
}

export function toCommerceFailure(error: unknown): CommerceFailure {
  const record = asRecord(error) ?? {}
  const status = numberField(record, 'status') ?? 0
  const details = asRecord(record.details)
  const nested = details ? asRecord(details.error) : null
  const code = (nested ? stringField(nested, 'code') : null) ?? (details ? stringField(details, 'code') : null)
  const retryable = (nested ? booleanField(nested, 'retryable') : null)
    ?? booleanField(record, 'retryable')
    ?? (status === 0 || status === 429 || status >= 500)
  const kind: CommerceFailureKind = status === 401
    ? 'unauthorized'
    : status === 403
      ? 'forbidden'
      : status === 404
        ? 'not-found'
        : status === 409
          ? 'conflict'
          : status === 429
            ? 'rate-limited'
            : status === 0
              ? 'offline'
              : status >= 500 ? 'server' : 'unknown'
  return { status, code, retryable, kind }
}
