<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onHide, onShow } from '@dcloudio/uni-app'
import MobilePageHeader from '../../components/MobilePageHeader.vue'
import { ensureMobilePageAccess } from '../../auth/navigation'
import { getMobileB5PublicCatalog, listMobileB5Entitlements, listMobileB5Orders } from '../../api/b5'
import { b10ThemeMode, b10UiLocale } from '../../platform/b10-foundation'
import { mobileT, useMobileExperience } from '../../platform/experience'
import { openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'
import {
  availabilityKey,
  billingPeriodKey,
  entitlementStatusKey,
  formatCommerceDate,
  isActiveEntitlement,
  isAuthFailure,
  isSameCommerceIdentity,
  orderStatusKey,
  resolveCommercePlanPrice,
  toCommerceCatalog,
  toCommerceEntitlements,
  toCommerceFailure,
  toCommerceOrders,
  type CommerceEntitlement,
  type CommerceOrder,
  type CommercePlan,
} from './commerce-page'

const PAGE_PATH = '/pages/b5-commerce/b5-commerce'
const { experienceStyle, experienceMotion } = useMobileExperience()
const session = useSessionStore()
const themeClass = computed(() => `b10-theme--${b10ThemeMode.value}`)
const uiLocale = computed(() => b10UiLocale.value)

type SectionState = 'idle' | 'loading' | 'ready' | 'error'
type Tip = { title: string; body: string; dot: string; showExit: boolean }

const catalogState = ref<SectionState>('idle')
const entitlementsState = ref<SectionState>('idle')
const ordersState = ref<SectionState>('idle')
const plans = ref<CommercePlan[]>([])
const entitlements = ref<CommerceEntitlement[]>([])
const orders = ref<CommerceOrder[]>([])
const invalidPlans = ref(0)
const invalidEntitlements = ref(0)
const invalidOrders = ref(0)
const catalogErrorKey = ref('')
const entitlementsErrorKey = ref('')
const ordersErrorKey = ref('')
const ordersRefreshErrorKey = ref('')
const accessBlocked = ref(false)
const ordersRefreshing = ref(false)

let visible = false
let pageEpoch = 0
let ordersEpoch = 0
let showEpoch = 0

const activeEntitlements = computed(() => entitlements.value.filter((item) => isActiveEntitlement(item.status)))
const planTitleBySku = computed(() => {
  const titles = new Map<string, string>()
  for (const plan of plans.value) titles.set(plan.skuId, plan.title)
  return titles
})
const hasAnyError = computed(() => catalogState.value === 'error' || entitlementsState.value === 'error' || ordersState.value === 'error')
const isLoading = computed(() => catalogState.value === 'loading' || entitlementsState.value === 'loading' || ordersState.value === 'loading')
const showInitialSkeleton = computed(() => catalogState.value === 'loading' && entitlementsState.value === 'loading' && ordersState.value === 'loading')
const globalError = computed(() => catalogState.value === 'error' && entitlementsState.value === 'error' && ordersState.value === 'error')
const tip = computed<Tip | null>(() => {
  if (accessBlocked.value) return null
  if (hasAnyError.value) {
    return { title: 'retryTipTitle', body: 'retryTipBody', dot: '/static/figma-commerce-core/dot-info-8.svg', showExit: true }
  }
  if (isLoading.value) {
    return { title: 'tipLoadingTitle', body: 'tipLoadingBody', dot: '/static/figma-commerce-core/dot-brand-8.svg', showExit: false }
  }
  if (!activeEntitlements.value.length) {
    return { title: 'tipFreeTitle', body: 'tipFreeBody', dot: '/static/figma-commerce-core/dot-brand-8.svg', showExit: true }
  }
  return null
})

function ct(key: string, values: Record<string, string | number> = {}): string {
  return mobileT(`commercePage.${key}`).replace(/\{(\w+)\}/g, (_, name: string) => (
    values[name] === undefined ? `{${name}}` : String(values[name])
  ))
}

function resetData(): void {
  catalogState.value = 'idle'
  entitlementsState.value = 'idle'
  ordersState.value = 'idle'
  plans.value = []
  entitlements.value = []
  orders.value = []
  invalidPlans.value = 0
  invalidEntitlements.value = 0
  invalidOrders.value = 0
  catalogErrorKey.value = ''
  entitlementsErrorKey.value = ''
  ordersErrorKey.value = ''
  ordersRefreshErrorKey.value = ''
  ordersRefreshing.value = false
  accessBlocked.value = false
}

function currentIdentity(): { subject: string; revision: number } | null {
  return session.getMobileApiIdentity()
}

function isCurrentPage(run: number, identity: { subject: string; revision: number } | null): boolean {
  return visible
    && pageEpoch === run
    && session.isAuthenticated
    && session.isLearningReady
    && isSameCommerceIdentity(identity, session.getMobileApiIdentity())
}

function isCurrentOrders(run: number, identity: { subject: string; revision: number } | null): boolean {
  return visible
    && ordersEpoch === run
    && session.isAuthenticated
    && session.isLearningReady
    && isSameCommerceIdentity(identity, session.getMobileApiIdentity())
}

function sectionErrorKey(error: unknown, fallbackKey: string): string {
  const failure = toCommerceFailure(error)
  if (isAuthFailure(failure)) {
    accessBlocked.value = true
    return 'noPermission'
  }
  return fallbackKey
}

function applyCatalog(result: PromiseSettledResult<unknown>): void {
  if (result.status === 'rejected') {
    catalogState.value = 'error'
    catalogErrorKey.value = sectionErrorKey(result.reason, 'plansError')
    return
  }
  const parsed = toCommerceCatalog(result.value)
  if (!parsed.ok) {
    catalogState.value = 'error'
    catalogErrorKey.value = 'plansError'
    return
  }
  plans.value = parsed.data.plans
  invalidPlans.value = parsed.data.invalidPlans
  catalogState.value = parsed.data.plans.length === 0 && parsed.data.invalidPlans > 0 ? 'error' : 'ready'
  catalogErrorKey.value = catalogState.value === 'error' ? 'plansError' : ''
}

function applyEntitlements(result: PromiseSettledResult<unknown>): void {
  if (result.status === 'rejected') {
    entitlementsState.value = 'error'
    entitlementsErrorKey.value = sectionErrorKey(result.reason, 'entitlementsError')
    return
  }
  const parsed = toCommerceEntitlements(result.value)
  if (!parsed.ok) {
    entitlementsState.value = 'error'
    entitlementsErrorKey.value = 'entitlementsError'
    return
  }
  entitlements.value = parsed.data.entitlements
  invalidEntitlements.value = parsed.data.invalidEntitlements
  entitlementsState.value = parsed.data.entitlements.length === 0 && parsed.data.invalidEntitlements > 0 ? 'error' : 'ready'
  entitlementsErrorKey.value = entitlementsState.value === 'error' ? 'entitlementsError' : ''
}

function applyOrders(result: PromiseSettledResult<unknown>, refresh: boolean): void {
  if (result.status === 'rejected') {
    if (refresh && orders.value.length) {
      ordersRefreshErrorKey.value = sectionErrorKey(result.reason, 'ordersError')
      return
    }
    ordersState.value = 'error'
    ordersErrorKey.value = sectionErrorKey(result.reason, 'ordersError')
    return
  }
  const parsed = toCommerceOrders(result.value)
  if (!parsed.ok) {
    if (refresh && orders.value.length) {
      ordersRefreshErrorKey.value = 'ordersError'
      return
    }
    ordersState.value = 'error'
    ordersErrorKey.value = 'ordersError'
    return
  }
  if (refresh && orders.value.length && parsed.data.orders.length === 0 && parsed.data.invalidOrders > 0) {
    ordersRefreshErrorKey.value = 'ordersError'
    return
  }
  orders.value = parsed.data.orders
  invalidOrders.value = parsed.data.invalidOrders
  ordersState.value = parsed.data.orders.length === 0 && parsed.data.invalidOrders > 0 ? 'error' : 'ready'
  ordersErrorKey.value = ordersState.value === 'error' ? 'ordersError' : ''
}

async function loadAll(): Promise<void> {
  if (!visible) return
  const identity = currentIdentity()
  if (!session.isAuthenticated || !session.isLearningReady || !identity) {
    accessBlocked.value = true
    return
  }
  const run = ++pageEpoch
  ordersEpoch += 1
  accessBlocked.value = false
  ordersRefreshing.value = false
  ordersRefreshErrorKey.value = ''
  catalogState.value = 'loading'
  entitlementsState.value = 'loading'
  ordersState.value = 'loading'
  plans.value = []
  entitlements.value = []
  orders.value = []
  invalidPlans.value = 0
  invalidEntitlements.value = 0
  invalidOrders.value = 0
  catalogErrorKey.value = ''
  entitlementsErrorKey.value = ''
  ordersErrorKey.value = ''
  const [catalogResult, entitlementsResult, ordersResult] = await Promise.allSettled([
    getMobileB5PublicCatalog(),
    listMobileB5Entitlements(),
    listMobileB5Orders(),
  ])
  if (!isCurrentPage(run, identity)) return
  applyCatalog(catalogResult)
  applyEntitlements(entitlementsResult)
  applyOrders(ordersResult, false)
}

async function refreshOrders(): Promise<void> {
  if (!visible || ordersRefreshing.value) return
  const identity = currentIdentity()
  if (!session.isAuthenticated || !session.isLearningReady || !identity) {
    accessBlocked.value = true
    return
  }
  const run = ++ordersEpoch
  ordersRefreshing.value = true
  ordersRefreshErrorKey.value = ''
  try {
    const value = await listMobileB5Orders()
    if (!isCurrentOrders(run, identity)) return
    applyOrders({ status: 'fulfilled', value }, true)
  } catch (error) {
    if (!isCurrentOrders(run, identity)) return
    ordersRefreshErrorKey.value = sectionErrorKey(error, 'ordersError')
    if (!orders.value.length) ordersState.value = 'error'
  } finally {
    if (isCurrentOrders(run, identity)) ordersRefreshing.value = false
  }
}

async function initialise(token: number): Promise<void> {
  const allowed = await ensureMobilePageAccess(PAGE_PATH)
  if (token !== showEpoch || !visible) return
  if (!allowed) {
    accessBlocked.value = true
    return
  }
  if (!session.isAuthenticated || !session.isLearningReady || !currentIdentity()) {
    accessBlocked.value = true
    return
  }
  await loadAll()
}

onShow(() => {
  visible = true
  const token = ++showEpoch
  void initialise(token)
})

onHide(() => {
  visible = false
  showEpoch += 1
  pageEpoch += 1
  ordersEpoch += 1
  ordersRefreshing.value = false
})

watch(() => session.identityRevision, () => {
  if (!visible) return
  pageEpoch += 1
  ordersEpoch += 1
  resetData()
  if (!session.isAuthenticated) {
    accessBlocked.value = true
    return
  }
  void initialise(++showEpoch)
})

function planTitle(plan: CommercePlan): string {
  return plan.title
}

function planBilling(plan: CommercePlan): string {
  return ct(billingPeriodKey(plan.billingPeriod))
}

function planPrice(plan: CommercePlan): string {
  const resolved = resolveCommercePlanPrice(plan, uiLocale.value)
  if (resolved.kind === 'amount') return resolved.value
  return ct(resolved.kind === 'unavailable' ? 'planPriceUnavailable' : 'planPricePending')
}

function planAvailabilityLabel(plan: CommercePlan): string {
  return ct(availabilityKey(plan.availability))
}

function entitlementTitle(item: CommerceEntitlement): string {
  const code = item.entitlementCode.toUpperCase()
  if (code === 'PREMIUM_MONTHLY') return ct('entitlementPremiumMonthly')
  if (code === 'PREMIUM_YEARLY') return ct('entitlementPremiumYearly')
  if (item.skuId) {
    const title = planTitleBySku.value.get(item.skuId)
    if (title) return title
  }
  return ct('entitlementFallback')
}

function entitlementDate(item: CommerceEntitlement): string {
  const date = formatCommerceDate(item.expiresAt, uiLocale.value)
  return date ? ct('entitlementUntil', { date }) : ct('entitlementNoExpiry')
}

function entitlementStatusLabel(item: CommerceEntitlement): string {
  return ct(entitlementStatusKey(item.status))
}

function entitlementTagClass(item: CommerceEntitlement): string {
  if (item.status === 'ACTIVE') return 'commerce-tag--ok'
  if (item.status === 'GRACE' || item.status === 'PENDING') return 'commerce-tag--warn'
  return 'commerce-tag--mute'
}

function orderTitle(order: CommerceOrder): string {
  if (order.skuId) {
    const title = planTitleBySku.value.get(order.skuId)
    if (title) return title
  }
  return ct('orderSkuFallback')
}

function orderDate(order: CommerceOrder): string {
  const date = formatCommerceDate(order.createdAt, uiLocale.value)
  return date ? ct('orderCreatedAt', { date }) : ct('orderDateUnavailable')
}

function orderStatusLabel(order: CommerceOrder): string {
  return ct(orderStatusKey(order.status))
}

function orderTagClass(order: CommerceOrder): string {
  if (order.status === 'PAID') return 'commerce-tag--ok'
  if (order.status === 'PAYMENT_FAILED' || order.status === 'REFUND_FAILED') return 'commerce-tag--err'
  if (order.status === 'CANCELLED' || order.status === 'REFUNDED' || order.status === 'EXPIRED') return 'commerce-tag--mute'
  return 'commerce-tag--warn'
}

function returnToLearning(): void {
  openUniPage('/pages/home/home')
}
</script>

<template>
  <view class="commerce-page yx-page" :class="themeClass" :style="experienceStyle" :data-motion="experienceMotion">
    <view v-if="b10ThemeMode !== 'high-contrast'" class="commerce-glow" aria-hidden="true">
      <image class="commerce-glow-image" src="/static/figma-commerce-core/glow-540.svg" mode="scaleToFill" />
    </view>
    <view class="commerce-header">
      <MobilePageHeader
        page="b5-commerce"
        compact
        :title="ct('navTitle')"
        back-icon-src="/static/figma-commerce-core/chevron-22.svg"
        :show-settings="false"
      />
    </view>

    <view v-if="accessBlocked" class="commerce-body">
      <view class="commerce-alert" role="alert">
        <view class="commerce-alert-icon">
          <image class="commerce-error-icon" src="/static/figma-commerce-core/error-17.svg" mode="aspectFit" aria-hidden="true" />
        </view>
        <view class="commerce-alert-copy">
          <text class="commerce-alert-title">{{ ct('accessErrorTitle') }}</text>
          <text class="commerce-alert-body">{{ ct('accessErrorBody') }}</text>
        </view>
        <view class="commerce-alert-actions">
          <button class="commerce-link" type="button" @click="returnToLearning">{{ ct('secureExit') }}</button>
        </view>
      </view>
    </view>

    <view v-else class="commerce-body">
      <view class="commerce-hero">
        <text class="commerce-hero-title" role="heading" aria-level="1">{{ ct('heroTitle') }}</text>
        <text class="commerce-hero-subtitle">{{ ct('heroSubtitle') }}</text>
      </view>

      <view v-if="globalError" class="commerce-alert" role="alert">
        <view class="commerce-alert-icon">
          <image class="commerce-error-icon" src="/static/figma-commerce-core/error-17.svg" mode="aspectFit" aria-hidden="true" />
        </view>
        <view class="commerce-alert-copy">
          <text class="commerce-alert-title">{{ ct('loadErrorTitle') }}</text>
          <text class="commerce-alert-body">{{ ct('loadErrorBody') }}</text>
        </view>
        <view class="commerce-alert-actions">
          <button class="commerce-link" type="button" @click="loadAll">{{ ct('retry') }}</button>
          <button class="commerce-link" type="button" @click="returnToLearning">{{ ct('secureExit') }}</button>
        </view>
      </view>

      <template v-if="showInitialSkeleton">
        <text class="commerce-loading-text" role="status">{{ ct('loading') }}</text>
        <view class="commerce-skeleton commerce-skeleton--90" aria-hidden="true" />
        <view class="commerce-skeleton commerce-skeleton--190" aria-hidden="true" />
        <view class="commerce-skeleton commerce-skeleton--110" aria-hidden="true" />
      </template>

      <template v-else>
        <view class="commerce-card">
          <view class="commerce-card-head">
            <text class="commerce-card-title" role="heading" aria-level="2">{{ ct('entitlementsTitle') }}</text>
            <text v-if="entitlementsState === 'ready'" class="commerce-card-meta">{{ ct('entitlementCount', { count: activeEntitlements.length }) }}</text>
          </view>
          <view v-if="entitlementsState === 'loading'" class="commerce-loading-text" role="status">{{ ct('loading') }}</view>
          <view v-else-if="entitlementsState === 'error' && !globalError" class="commerce-section-error" role="alert">
            <text class="commerce-section-error-text">{{ ct(entitlementsErrorKey || 'entitlementsError') }}</text>
            <button class="commerce-link" type="button" @click="loadAll">{{ ct('retry') }}</button>
          </view>
          <text v-else-if="entitlementsState === 'error'" class="commerce-empty">{{ ct('statusUnavailable') }}</text>
          <template v-else>
            <view v-if="invalidEntitlements" class="commerce-partial" role="status">{{ ct('partialNotice', { count: invalidEntitlements }) }}</view>
            <view v-if="activeEntitlements.length" class="commerce-list">
              <view v-for="item in activeEntitlements" :key="item.key" class="commerce-row">
                <view class="commerce-tile">
                  <image class="commerce-icon" src="/static/figma-commerce-core/crown-22.svg" mode="aspectFit" aria-hidden="true" />
                </view>
                <view class="commerce-copy">
                  <text class="commerce-name">{{ entitlementTitle(item) }}</text>
                  <text class="commerce-meta">{{ entitlementDate(item) }}</text>
                </view>
                <text class="commerce-tag" :class="entitlementTagClass(item)">{{ entitlementStatusLabel(item) }}</text>
              </view>
            </view>
            <text v-else class="commerce-empty">{{ ct('entitlementEmpty') }}</text>
          </template>
        </view>

        <view class="commerce-card">
          <view class="commerce-card-head">
            <text class="commerce-card-title" role="heading" aria-level="2">{{ ct('plansTitle') }}</text>
          </view>
          <view v-if="catalogState === 'loading'" class="commerce-loading-text" role="status">{{ ct('loading') }}</view>
          <view v-else-if="catalogState === 'error' && !globalError" class="commerce-section-error" role="alert">
            <text class="commerce-section-error-text">{{ ct(catalogErrorKey || 'plansError') }}</text>
            <button class="commerce-link" type="button" @click="loadAll">{{ ct('retry') }}</button>
          </view>
          <text v-else-if="catalogState === 'error'" class="commerce-empty">{{ ct('statusUnavailable') }}</text>
          <template v-else>
            <view v-if="invalidPlans" class="commerce-partial" role="status">{{ ct('partialNotice', { count: invalidPlans }) }}</view>
            <view v-if="plans.length" class="commerce-plan-list">
              <view v-for="plan in plans" :key="plan.key" class="commerce-plan">
                <view class="commerce-plan-tile">
                  <image class="commerce-icon commerce-icon--20" src="/static/figma-commerce-core/ticket-20.svg" mode="aspectFit" aria-hidden="true" />
                </view>
                <view class="commerce-plan-copy">
                  <text class="commerce-name">{{ planTitle(plan) }}</text>
                  <text class="commerce-plan-meta">{{ planBilling(plan) }}</text>
                </view>
                <view class="commerce-plan-price-wrap">
                  <text class="commerce-plan-price">{{ planPrice(plan) }}</text>
                  <text class="commerce-plan-state">{{ planAvailabilityLabel(plan) }}</text>
                </view>
              </view>
              <text class="commerce-note">{{ ct('purchaseClosedHint') }}</text>
            </view>
            <template v-else>
              <text class="commerce-empty">{{ ct('plansEmpty') }}</text>
              <text class="commerce-note">{{ ct('plansEmptyHint') }}</text>
            </template>
          </template>
        </view>

        <view class="commerce-card">
          <view class="commerce-card-head">
            <text class="commerce-card-title" role="heading" aria-level="2">{{ ct('ordersTitle') }}</text>
            <button
              v-if="ordersState === 'ready'"
              class="commerce-refresh"
              type="button"
              :disabled="ordersRefreshing"
              :aria-busy="ordersRefreshing ? 'true' : 'false'"
              @click="refreshOrders"
            >{{ ordersRefreshing ? ct('refreshing') : ct('refreshOrders') }}</button>
            <text v-else class="commerce-card-meta">{{ ct('ordersProgress') }}</text>
          </view>
          <view v-if="ordersState === 'loading'" class="commerce-loading-text" role="status">{{ ct('loading') }}</view>
          <view v-else-if="ordersState === 'error' && !globalError" class="commerce-section-error" role="alert">
            <text class="commerce-section-error-text">{{ ct(ordersErrorKey || 'ordersError') }}</text>
            <button class="commerce-link" type="button" @click="refreshOrders">{{ ct('retry') }}</button>
          </view>
          <text v-else-if="ordersState === 'error'" class="commerce-empty">{{ ct('statusUnavailable') }}</text>
          <template v-else>
            <view v-if="ordersRefreshErrorKey" class="commerce-partial" role="alert">{{ ct('refreshFailed') }}</view>
            <view v-if="invalidOrders" class="commerce-partial" role="status">{{ ct('partialNotice', { count: invalidOrders }) }}</view>
            <view v-if="orders.length" class="commerce-list">
              <view v-for="order in orders" :key="order.key" class="commerce-row commerce-order-row">
                <view class="commerce-tile commerce-tile--neutral">
                  <image class="commerce-icon" src="/static/figma-commerce-core/receipt-22.svg" mode="aspectFit" aria-hidden="true" />
                </view>
                <view class="commerce-copy">
                  <text class="commerce-name">{{ orderTitle(order) }}</text>
                  <text class="commerce-meta">{{ orderDate(order) }}</text>
                </view>
                <text class="commerce-tag" :class="orderTagClass(order)">{{ orderStatusLabel(order) }}</text>
              </view>
            </view>
            <text v-else class="commerce-empty">{{ ct('ordersEmpty') }}</text>
          </template>
        </view>

        <view class="commerce-card commerce-redeem-card">
          <view class="commerce-card-head">
            <text class="commerce-card-title" role="heading" aria-level="2">{{ ct('redeemTitle') }}</text>
          </view>
          <text class="commerce-redeem-title">{{ ct('redeemClosedTitle') }}</text>
          <text class="commerce-note">{{ ct('redeemClosedBody') }}</text>
          <button class="commerce-link commerce-link--start" type="button" @click="returnToLearning">{{ ct('secureExit') }}</button>
        </view>

      </template>

      <view v-if="tip" class="commerce-tip">
        <view class="commerce-tip-row">
          <image class="commerce-dot" :src="tip.dot" mode="aspectFit" aria-hidden="true" />
          <text class="commerce-tip-title">{{ ct(tip.title) }}</text>
        </view>
        <text class="commerce-tip-body">{{ ct(tip.body) }}</text>
        <button v-if="tip.showExit" class="commerce-link commerce-link--start" type="button" @click="returnToLearning">{{ ct('secureExit') }}</button>
      </view>
    </view>

    <view class="commerce-bottom-bar">
      <view class="commerce-bottom-inner">
        <button
          v-if="activeEntitlements.length && !accessBlocked"
          class="commerce-cta"
          type="button"
          @click="returnToLearning"
        >{{ ct('continueLearning') }}</button>
        <button
          v-else
          class="commerce-cta commerce-cta--disabled"
          type="button"
          disabled
          aria-disabled="true"
        >{{ ct('purchaseUnavailable') }}</button>
      </view>
    </view>
  </view>
</template>

<style scoped lang="scss">
.commerce-page.yx-page.yx-page {
  position: relative;
  box-sizing: border-box;
  max-width: 860px;
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 0 calc(112px + env(safe-area-inset-bottom));
  overflow-x: hidden;
  color: var(--yx-r4-ink, var(--yx-text-primary));
  background-color: var(--yx-surface-page);
  background-image: var(--yx-r4-home-image);
  background-repeat: no-repeat;
  background-size: cover;
  font-family: var(--v2-font);
}
.commerce-glow {
  position: absolute;
  top: -140px;
  right: -120px;
  width: min(360px, 92vw);
  height: 300px;
  overflow: hidden;
  pointer-events: none;
}
.commerce-glow-image { display: block; width: 100%; height: 100%; }
.commerce-header {
  position: relative;
  z-index: 2;
  padding: calc(18px + env(safe-area-inset-top)) 16px 0 8px;
}
.commerce-body {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 24px 0;
}
.commerce-hero { display: grid; gap: 4px; padding-top: 8px; }
.commerce-hero-title {
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-size: 28px;
  font-weight: 700;
  line-height: 36px;
  overflow-wrap: anywhere;
}
.commerce-hero-subtitle {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.commerce-card {
  position: relative;
  display: grid;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  padding: 18px 20px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 24px;
  background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 10px));
  -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
@supports (background: color-mix(in srgb, white 50%, transparent)) {
  .commerce-card {
    background: color-mix(in srgb, var(--v2-card) 62%, transparent);
    border-color: color-mix(in srgb, var(--v2-card) 90%, transparent);
  }
}
.commerce-card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 30px;
}
.commerce-card-title {
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-size: 18px;
  font-weight: 700;
  line-height: 26px;
  overflow-wrap: anywhere;
}
.commerce-card-meta {
  margin-left: auto;
  flex: 0 0 auto;
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 12px;
  line-height: 18px;
}
.commerce-list { display: grid; gap: 0; }
.commerce-row {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-width: 0;
  min-height: 56px;
  padding: 10px 0;
}
.commerce-order-row + .commerce-order-row { border-top: 1px solid var(--v2-line); }
.commerce-tile {
  display: flex;
  flex: 0 0 44px;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: var(--v2-warn-soft);
}
.commerce-tile--neutral { background: var(--v2-surface); }
.commerce-icon { display: block; width: 22px; height: 22px; }
.commerce-icon--20 { width: 20px; height: 20px; }
.commerce-copy { display: grid; flex: 1 1 auto; gap: 2px; min-width: 0; }
.commerce-name {
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.commerce-meta {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.commerce-tag {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  line-height: 18px;
  white-space: nowrap;
}
.commerce-tag--ok { color: var(--v2-ok); background: var(--v2-ok-soft); }
.commerce-tag--warn { color: var(--v2-warn); background: var(--v2-warn-soft); }
.commerce-tag--err { color: var(--v2-bad); background: var(--v2-bad-soft); }
.commerce-tag--mute { color: var(--v2-mut); background: var(--v2-surface); }
.commerce-plan-list { display: grid; gap: 10px; }
.commerce-plan {
  display: flex;
  align-items: center;
  gap: 12px;
  box-sizing: border-box;
  min-width: 0;
  padding: 14px;
  border-radius: 18px;
  background: var(--yx-r4-field, var(--v2-card));
}
@supports (background: color-mix(in srgb, white 50%, transparent)) {
  .commerce-plan { background: color-mix(in srgb, var(--v2-card) 50%, transparent); }
}
.commerce-plan-tile {
  display: flex;
  flex: 0 0 40px;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 13px;
  background: var(--v2-soft);
}
.commerce-plan-copy { display: grid; flex: 1 1 auto; gap: 2px; min-width: 0; }
.commerce-plan-meta {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.commerce-plan-price-wrap { display: grid; flex: 0 0 auto; gap: 2px; justify-items: end; max-width: 42%; }
.commerce-plan-price {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  text-align: right;
  overflow-wrap: anywhere;
}
.commerce-plan-state {
  color: var(--v2-mut);
  font-size: 11px;
  line-height: 17px;
  text-align: right;
  white-space: nowrap;
}
.commerce-note {
  display: block;
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.commerce-empty {
  display: block;
  padding: 6px 0;
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 14px;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.commerce-loading-text {
  display: block;
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 12px;
  line-height: 18px;
}
.commerce-skeleton {
  width: 100%;
  border-radius: 24px;
  background: var(--v2-surface);
}
.commerce-skeleton--90 { height: 90px; }
.commerce-skeleton--190 { height: 190px; }
.commerce-skeleton--110 { height: 110px; }
.commerce-section-error {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding: 8px 0;
}
.commerce-section-error-text {
  flex: 1 1 160px;
  color: var(--v2-bad);
  font-size: 13px;
  line-height: 20px;
}
.commerce-partial {
  color: var(--v2-warn);
  background: var(--v2-warn-soft);
  border-radius: 10px;
  padding: 6px 10px;
  font-size: 12px;
  line-height: 18px;
}
.commerce-alert {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  box-sizing: border-box;
  padding: 12px 8px 12px 14px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 18px;
  background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 10px));
  -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
.commerce-alert-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--v2-bad);
}
.commerce-error-icon { display: block; width: 17px; height: 17px; }
.commerce-alert-copy { display: grid; gap: 2px; min-width: 0; }
.commerce-alert-title {
  color: var(--v2-bad);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.commerce-alert-body {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 13px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
.commerce-alert-actions { display: flex; grid-column: 1 / -1; gap: 8px; flex-wrap: wrap; }
.commerce-page .commerce-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  margin: 0;
  padding: 8px 4px;
  border: 0;
  border-radius: 8px;
  color: var(--v2-brand);
  background: transparent;
  font-family: var(--v2-font);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.4;
  text-align: center;
}
.commerce-page .commerce-link::after { border: 0; }
.commerce-page .commerce-link:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 2px; }
.commerce-page .commerce-link--start { justify-self: start; padding-left: 0; }
.commerce-page .commerce-refresh {
  min-height: 44px;
  margin: 0 0 0 auto;
  padding: 6px 0 6px 8px;
  border: 0;
  color: var(--v2-brand);
  background: transparent;
  font-family: var(--v2-font);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  white-space: nowrap;
}
.commerce-page .commerce-refresh::after { border: 0; }
.commerce-page .commerce-refresh[disabled] { color: var(--v2-mut); opacity: .7; }
.commerce-redeem-card { gap: 6px; }
.commerce-redeem-title {
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
  overflow-wrap: anywhere;
}
.commerce-tip {
  display: grid;
  gap: 6px;
  box-sizing: border-box;
  padding: 14px 16px;
  border: 1px solid var(--yx-r4-glass-border, var(--yx-border));
  border-radius: 18px;
  background: var(--yx-r4-glass, var(--v2-card));
  box-shadow: var(--yx-r4-shadow-card, var(--v2-shadow));
  backdrop-filter: blur(var(--yx-r4-blur, 10px));
  -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
.commerce-tip-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
.commerce-dot { display: block; flex: 0 0 8px; width: 8px; height: 8px; }
.commerce-tip-title {
  color: var(--yx-r4-ink, var(--yx-text-primary));
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.commerce-tip-body {
  color: var(--yx-r4-muted, var(--yx-text-secondary));
  font-size: 13px;
  line-height: 19px;
  overflow-wrap: anywhere;
}
.commerce-bottom-bar {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 20;
  display: flex;
  justify-content: center;
  background: var(--v2-card);
  border-top: 1px solid var(--v2-line);
  box-shadow: 0 -4px 16px color-mix(in srgb, var(--v2-ink) 8%, transparent);
  backdrop-filter: blur(var(--yx-r4-blur, 10px));
  -webkit-backdrop-filter: blur(var(--yx-r4-blur, 10px));
}
.commerce-bottom-inner {
  box-sizing: border-box;
  width: 100%;
  max-width: 860px;
  padding: 12px 24px calc(12px + env(safe-area-inset-bottom));
}
.commerce-page .commerce-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 14px 20px;
  border: 1px solid transparent;
  border-radius: 14px;
  color: var(--yx-r4-on-cta, var(--v2-inverse));
  background-color: var(--v2-brand);
  background-image: var(--yx-r4-cta-image);
  box-shadow: var(--yx-r4-shadow-cta, var(--v2-shadow));
  font-family: var(--v2-font);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.5;
  text-align: center;
}
.commerce-page .commerce-cta::after { border: 0; }
.commerce-page .commerce-cta:focus-visible { outline: 2px solid var(--v2-brand); outline-offset: 3px; }
.commerce-page .commerce-cta--disabled,
.commerce-page .commerce-cta[disabled] {
  opacity: .55;
  cursor: default;
  box-shadow: var(--yx-r4-shadow-cta, var(--v2-shadow));
}
.commerce-page .commerce-cta--disabled:active,
.commerce-page .commerce-cta[disabled]:active { transform: none; }
@media (max-width: 360px) {
  .commerce-body { padding-right: 16px; padding-left: 16px; }
  .commerce-header { padding-right: 12px; padding-left: 8px; }
  .commerce-bottom-inner { padding-right: 16px; padding-left: 16px; }
  .commerce-hero-title { font-size: 26px; line-height: 34px; }
}
:global(.b10-theme--high-contrast) .commerce-card,
:global(.b10-theme--high-contrast) .commerce-alert,
:global(.b10-theme--high-contrast) .commerce-tip {
  background: var(--v2-card);
  border-color: var(--v2-line);
  box-shadow: none;
}
@supports (background: color-mix(in srgb, white 50%, transparent)) {
  :global(.b10-theme--high-contrast) .commerce-card,
  :global(.b10-theme--high-contrast) .commerce-alert,
  :global(.b10-theme--high-contrast) .commerce-tip {
    background: var(--v2-card);
  }
}
@media (prefers-contrast: more) {
  .commerce-card,
  .commerce-alert,
  .commerce-tip,
  .commerce-bottom-bar { backdrop-filter: none; -webkit-backdrop-filter: none; }
  .commerce-tag { outline: 1px solid currentColor; }
}
.commerce-page.b10-theme--high-contrast .commerce-cta {
  color: var(--v2-inverse);
}
</style>
