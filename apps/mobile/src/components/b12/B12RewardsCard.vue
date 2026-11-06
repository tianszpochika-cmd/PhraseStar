<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { MobileApiError } from '../../api/client'
import { claimB12Reward, getB12RewardProbability, listB12RewardGrants, type B12RewardClaim, type B12RewardGrant, type B12RewardProbability } from '../../api/b12'
import { b12T } from '../../platform/b12-i18n'
import { openUniPage } from '../../platform/uni-runtime'
import { useSessionStore } from '../../stores/session'

type B12ViewStatus = 'idle' | 'loading' | 'success' | 'empty' | 'unauthenticated' | 'permission' | 'offline' | 'recovery' | 'error'
const chests = ref<B12RewardGrant[]>([]); const chestProbability = ref<B12RewardProbability | null>(null); const lastChestResult = ref<B12RewardClaim | null>(null); const status = ref<B12ViewStatus>('idle'); const actionKey = ref<string | null>(null); const lastError = ref<string | null>(null); const online = ref(true)
const session = useSessionStore()
type Owner = { subject: string; revision: number }
let requestGeneration = 0
function currentOwner(): Owner | null { return session.isAuthenticated && session.verifiedSubject ? { subject: session.verifiedSubject, revision: session.identityRevision } : null }
function stillCurrent(owner: Owner | null, generation: number): boolean { return Boolean(owner && session.isAuthenticated && session.verifiedSubject === owner.subject && session.identityRevision === owner.revision && generation === requestGeneration) }
function clearRewards(): void { chests.value = []; chestProbability.value = null; lastChestResult.value = null }
function fail(error: unknown, fallback: string): void {
  const next = errorStatus(error)
  clearRewards()
  status.value = next
  online.value = next !== 'offline'
  lastError.value = errorMessage(error, fallback)
}
watch([() => session.verifiedSubject, () => session.identityRevision, () => session.isAuthenticated], ([subject, revision, authenticated], [previousSubject, previousRevision, previousAuthenticated]) => {
  if (subject === previousSubject && revision === previousRevision && authenticated === previousAuthenticated) return
  requestGeneration += 1
  clearRewards(); actionKey.value = null; status.value = authenticated && subject ? 'loading' : authenticated ? 'permission' : 'unauthenticated'; lastError.value = authenticated && !subject ? b12T('status.permission') : authenticated ? null : '请先登录后查看奖励数据。'; online.value = true
  if (authenticated && subject) void loadRewards()
}, { flush: 'sync' })
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function sourceOf(value: unknown): Record<string, unknown> { const root = isRecord(value) && isRecord(value.data) ? value.data : value; return isRecord(root) ? root : {} }
function text(value: unknown, fallback: string): string { return typeof value === 'string' && value.trim() ? value : fallback }
function number(value: unknown, fallback = 0): number { return typeof value === 'number' && Number.isFinite(value) ? value : fallback }
function errorStatus(error: unknown): B12ViewStatus { if (error instanceof MobileApiError) return error.status === 0 ? 'offline' : error.status === 401 ? 'unauthenticated' : error.status === 403 ? 'permission' : error.status === 409 ? 'recovery' : 'error'; return 'error' }
function errorMessage(error: unknown, fallback: string): string { if (error instanceof MobileApiError && error.status === 401) return '请先登录后查看奖励数据。'; return error instanceof Error && error.message ? error.message : fallback }
function parseGrants(value: unknown): B12RewardGrant[] { const root = sourceOf(value); const raw = Array.isArray(root.grants) ? root.grants : Array.isArray(root.items) ? root.items : []; return raw.filter(isRecord).map((item): B12RewardGrant => ({ grantId: text(item.grantId, ''), rewardCode: text(item.rewardCode, 'LEARNING_REWARD'), status: (item.status ?? item.state) === 'CLAIMED' ? 'CLAIMED' : 'GRANTED', probabilityVersion: text(item.probabilityVersion, 'SERVER_RULE'), outcomeCode: typeof item.outcomeCode === 'string' ? item.outcomeCode : undefined, grantedAt: typeof item.grantedAt === 'string' ? item.grantedAt : undefined, claimedAt: typeof item.claimedAt === 'string' ? item.claimedAt : undefined })).filter((item) => Boolean(item.grantId)) }
function parseProbability(value: unknown): B12RewardProbability | null { const root = sourceOf(value); const rawOutcomes = Array.isArray(root.outcomes) ? root.outcomes : Array.isArray(root.tiers) ? root.tiers : []; if (!root.grantId || !rawOutcomes.length) return null; return { grantId: text(root.grantId, ''), rewardCode: text(root.rewardCode, 'LEARNING_REWARD'), probabilityVersion: text(root.probabilityVersion, 'SERVER_RULE'), outcomes: rawOutcomes.filter(isRecord).map((item) => ({ outcomeCode: text(item.outcomeCode ?? item.tierCode, 'UNKNOWN'), probability: typeof item.probability === 'number' ? item.probability : number(item.basisPoints) / 10000 })), totalProbability: number(root.totalProbability, 1), disclosedBeforeClaim: root.disclosedBeforeClaim !== false, probabilitySnapshotHash: typeof root.probabilitySnapshotHash === 'string' ? root.probabilitySnapshotHash : undefined } }
function parseClaim(value: unknown): B12RewardClaim | null { const root = sourceOf(value); if (!root.grantId || (root.claimed !== true && root.state !== 'CLAIMED' && root.state !== 'ALREADY_CLAIMED')) return null; return { grantId: text(root.grantId, ''), claimed: true, replayed: root.replayed === true || root.state === 'ALREADY_CLAIMED', outcomeCode: typeof root.outcomeCode === 'string' ? root.outcomeCode : undefined, probabilityVersion: typeof root.probabilityVersion === 'string' ? root.probabilityVersion : undefined, claimedAt: typeof root.claimedAt === 'string' ? root.claimedAt : undefined } }
async function loadRewards(): Promise<void> {
  const owner = currentOwner()
  if (!owner) { clearRewards(); status.value = session.isAuthenticated ? 'permission' : 'unauthenticated'; lastError.value = session.isAuthenticated ? b12T('status.permission') : '请先登录后查看奖励数据。'; return }
  if (actionKey.value) return
  const generation = ++requestGeneration
  clearRewards(); status.value = 'loading'; actionKey.value = 'rewards.load'; lastError.value = null
  try {
    const result = await listB12RewardGrants()
    if (!stillCurrent(owner, generation)) return
    chests.value = parseGrants(result)
    status.value = chests.value.length ? 'success' : 'empty'
    const first = chests.value.find((item) => item.status === 'GRANTED')
    if (first) await loadProbability(first.grantId)
  } catch (error) { if (stillCurrent(owner, generation)) { clearRewards(); fail(error, '奖励读取失败。') } }
  finally { if (stillCurrent(owner, generation) && actionKey.value === 'rewards.load') actionKey.value = null }
}
async function loadProbability(grantId: string): Promise<void> {
  const owner = currentOwner()
  if (!owner || (actionKey.value && actionKey.value !== 'rewards.load')) return
  const generation = requestGeneration
  const key = `probability.${grantId}`
  actionKey.value = key; chestProbability.value = null
  try {
    const result = await getB12RewardProbability(grantId)
    if (!stillCurrent(owner, generation)) return
    chestProbability.value = parseProbability(result)
    if (!chestProbability.value) throw new Error('服务端未返回概率快照。')
    status.value = 'success'; lastError.value = null
  } catch (error) { if (stillCurrent(owner, generation)) fail(error, '概率读取失败。') }
  finally { if (stillCurrent(owner, generation) && actionKey.value === key) actionKey.value = null }
}
async function openChest(grantId: string): Promise<void> {
  const owner = currentOwner()
  if (!owner || actionKey.value) return
  const generation = requestGeneration
  const key = `claim.${grantId}`
  actionKey.value = key; lastChestResult.value = null
  try {
    const result = await claimB12Reward(grantId)
    if (!stillCurrent(owner, generation)) return
    lastChestResult.value = parseClaim(result)
    if (!lastChestResult.value) throw new Error('服务端未返回奖励领取结果。')
    chests.value = chests.value.map((item) => item.grantId === grantId ? { ...item, status: 'CLAIMED', outcomeCode: lastChestResult.value?.outcomeCode, claimedAt: lastChestResult.value?.claimedAt } : item)
    status.value = 'success'; lastError.value = null
  } catch (error) { if (stillCurrent(owner, generation)) fail(error, '奖励领取失败。') }
  finally { if (stillCurrent(owner, generation) && actionKey.value === key) actionKey.value = null }
}
function summary(): string | number {
  if (status.value === 'unauthenticated') return lastError.value ?? '请先登录后查看奖励数据。'
  if (status.value === 'permission') return b12T('status.permission')
  if (status.value === 'loading') return b12T('status.loading')
  if (status.value === 'offline') return b12T('status.offline')
  if (status.value === 'recovery') return b12T('status.recovery')
  if (status.value === 'error') return b12T('status.error')
  return chests.value.length || b12T('status.empty')
}
function openLogin(): void { openUniPage('/pages/login/login') }
function percent(probability: number, total: number): string { return `${((probability / (total > 0 ? total : 1)) * 100).toFixed(2)}%` }
onMounted(() => { void loadRewards() })
</script>

<template>
  <view class="b12-card" data-b12-rewards>
    <view class="b12-heading">
      <view class="b12-heading-copy">
        <text class="b12-title">{{ b12T('rewards.title') }}</text>
        <text class="b12-notice">{{ b12T('rewards.freeNotice') }}</text>
      </view>
      <text v-if="status === 'success'" class="b12-count">{{ chests.length }}</text>
    </view>

    <view v-if="status === 'loading'" class="b12-state-box" role="status">{{ b12T('status.loading') }}</view>
    <view v-else-if="chests.length && status !== 'permission' && status !== 'unauthenticated'" class="b12-list">
      <view v-for="chest in chests" :key="chest.grantId" class="b12-chest" :data-grant-id="chest.grantId">
        <view class="b12-tile" aria-hidden="true"><image class="b12-tile-icon" src="/static/figma-world-core/imgIconGift-b89f33ab.svg" mode="aspectFit" /></view>
        <view class="b12-chest-copy">
          <view class="b12-chest-head">
            <text class="b12-strong">{{ chest.status === 'CLAIMED' ? b12T('rewards.opened') : b12T('rewards.granted') }}</text>
          </view>
          <text class="b12-meta">{{ chest.rewardCode }} · {{ chest.probabilityVersion }}</text>
        </view>
        <button tabindex="0" role="button" class="b12-link" type="button" :disabled="Boolean(actionKey) || !online" @click="loadProbability(chest.grantId)">
          {{ actionKey === `probability.${chest.grantId}` ? b12T('status.loading') : b12T('rewards.probability') }}
        </button>
        <button tabindex="0" role="button" class="b12-button b12-button--primary" type="button" :disabled="chest.status !== 'GRANTED' || Boolean(actionKey) || !online" @click="openChest(chest.grantId)">
          {{ actionKey === `claim.${chest.grantId}` ? b12T('rewards.opening') : chest.status === 'CLAIMED' ? b12T('rewards.opened') : b12T('rewards.open') }}
        </button>
      </view>
    </view>
    <text v-else-if="status === 'empty'" class="b12-state-box">{{ b12T('rewards.empty') }}</text>

    <view v-if="chestProbability" class="b12-probability">
      <text class="b12-panel-title">{{ b12T('rewards.rule') }} · {{ chestProbability.probabilityVersion }}</text>
      <view v-for="outcome in chestProbability.outcomes" :key="outcome.outcomeCode" class="b12-outcome">
        <text class="b12-meta">{{ b12T('rewards.tier') }} {{ outcome.outcomeCode }}</text>
        <text class="b12-outcome-value">{{ percent(outcome.probability, chestProbability.totalProbability) }}</text>
      </view>
      <text class="b12-meta">{{ chestProbability.disclosedBeforeClaim ? '服务端已在领取前披露规则' : '服务端规则未披露' }} · {{ chestProbability.probabilitySnapshotHash ?? '服务端快照' }}</text>
    </view>

    <view v-if="lastChestResult" class="b12-result">
      <text class="b12-panel-title">{{ b12T('rewards.confirmed') }}</text>
      <text class="b12-meta">{{ lastChestResult.outcomeCode ?? '结果未返回' }} · {{ lastChestResult.replayed ? '幂等重放' : '首次返回' }}</text>
      <text class="b12-meta">{{ b12T('rewards.audit') }}：{{ lastChestResult.grantId }} · {{ b12T('rewards.rule') }}：{{ lastChestResult.probabilityVersion ?? '未返回' }}</text>
    </view>

    <text v-if="status === 'unauthenticated'" class="b12-state-box">{{ lastError ?? '请先登录后查看奖励数据。' }}</text>
    <button v-if="status === 'unauthenticated'" tabindex="0" role="button" class="b12-button b12-button--secondary" type="button" @click="openLogin">{{ b12T('status.login') }}</button>
    <text v-else-if="status === 'permission'" class="b12-state-box">{{ lastError ?? b12T('status.permission') }}</text>
    <text v-else-if="status === 'offline'" class="b12-state-box">{{ b12T('status.offline') }}</text>
    <text v-else-if="status === 'recovery'" class="b12-state-box">{{ b12T('status.recovery') }}</text>
    <text v-else-if="lastError" class="b12-state-box">{{ lastError }}</text>
  </view>
</template>

<style scoped lang="scss">
.b12-card{position:relative;display:grid;gap:12px;box-sizing:border-box;min-width:0;width:100%;padding:20px;border:1px solid var(--v2-line);border-radius:24px;background:var(--v2-card);box-shadow:var(--v2-shadow);font-family:var(--v2-font);overflow:hidden}
.b12-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;min-width:0}
.b12-heading-copy{display:grid;gap:4px;min-width:0}
.b12-title{display:block;color:var(--v2-ink);font-size:18px;font-weight:700;line-height:26px;overflow-wrap:anywhere}
.b12-notice{display:block;color:var(--v2-mut);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.b12-count{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:28px;min-height:28px;padding:2px 8px;border-radius:999px;background:var(--v2-soft);color:var(--v2-brand);font-size:12px;font-weight:700}
.b12-list{display:grid;gap:0;min-width:0}
.b12-chest{display:grid;grid-template-columns:56px minmax(0,1fr) auto;grid-template-areas:"tile copy link" "tile cta cta";align-items:center;gap:10px 12px;min-width:0;padding:12px 0 14px;border-top:1px solid var(--v2-line)}
.b12-chest:first-child{border-top:0;padding-top:2px}
.b12-tile{grid-area:tile;display:flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:18px;background:linear-gradient(128.66deg,var(--v2-brand2,var(--v2-brand)) 7.4%,var(--v2-brand) 81.5%)}
.b12-tile-icon{display:block;width:28px;height:28px}
.b12-chest-copy{grid-area:copy;display:grid;gap:2px;min-width:0}
.b12-chest-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
.b12-strong{display:block;color:var(--v2-ink);font-size:16px;font-weight:700;line-height:22px;overflow-wrap:anywhere}
.b12-tag{display:inline-flex;align-items:center;flex:none;padding:3px 10px;border-radius:999px;background:var(--v2-soft);color:var(--v2-brand);font-size:12px;font-weight:700;line-height:18px;white-space:nowrap}
.b12-meta{display:block;color:var(--v2-mut);font-size:12px;line-height:18px;overflow-wrap:anywhere}
.b12-link{grid-area:link;display:inline-flex;align-items:center;justify-content:center;min-height:44px;margin:0;padding:10px 8px;border:0!important;border-radius:12px;background:transparent!important;color:var(--v2-brand)!important;font:inherit;font-size:14px;font-weight:600;line-height:20px;text-align:center;white-space:normal}
.b12-button{grid-area:cta;display:flex;align-items:center;justify-content:center;box-sizing:border-box;width:100%;min-height:48px;margin:0;padding:12px 20px;border:1px solid transparent;border-radius:14px;font:inherit;font-size:16px;font-weight:700;line-height:1.4;text-align:center;white-space:normal}
.b12-button--primary{background:var(--v2-brand)!important;color:var(--v2-inverse,#fff)!important;border-color:transparent!important;box-shadow:var(--v2-shadow)}
.b12-button--secondary{border-color:var(--v2-line)!important;background:var(--v2-card)!important;color:var(--v2-brand)!important}
.b12-button:disabled{opacity:.55;box-shadow:none}
.b12-link:disabled{opacity:.55}
.b12-link:focus-visible,.b12-button:focus-visible{outline:2px solid var(--v2-brand);outline-offset:2px}
.b12-state-box{display:block;padding:14px;border:1px dashed var(--v2-line);border-radius:14px;color:var(--v2-mut);font-size:13px;line-height:1.6;overflow-wrap:anywhere}
.b12-probability,.b12-result{display:grid;gap:6px;padding:14px;border:1px solid var(--v2-line);border-radius:16px;background:var(--v2-soft);min-width:0}
.b12-result{background:var(--v2-card)}
.b12-panel-title{display:block;color:var(--v2-ink);font-size:14px;font-weight:700;line-height:20px;overflow-wrap:anywhere}
.b12-outcome{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0;padding:2px 0}
.b12-outcome-value{flex:none;color:var(--v2-ink);font-size:13px;font-weight:700;line-height:18px}
@media(max-width:420px){.b12-chest{grid-template-columns:56px minmax(0,1fr);grid-template-areas:"tile copy" "link link" "cta cta"}.b12-link{justify-self:start;text-align:left}.b12-tile{width:52px;height:52px;border-radius:16px}.b12-tile-icon{width:26px;height:26px}}
@media(prefers-reduced-motion:reduce){.b12-button:active{transform:none}}
</style>
