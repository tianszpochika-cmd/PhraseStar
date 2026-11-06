import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadClosedPage } from './closed-page-test-harness.mjs'

const root = new URL('../', import.meta.url)
const read = (file) => readFile(new URL(file, root), 'utf8')
const pagePath = 'src/pages/b4-offline/b4-offline.vue'

test('MB022 b4-offline gates unauthenticated users before loading the closed page', async () => {
  const page = loadClosedPage(pagePath, { authenticated: false })
  assert.equal(page.shown.length, 1)
  await page.shown[0]()
  assert.equal(page.calls.sessionRestore, 1)
  assert.deepEqual(page.calls.navigate, ['/pages/login/login'])
  assert.equal(page.calls.b4LoadWorld, 0)
})

test('MB022 b4-offline delegates closed UI while retaining owner recovery and no download actions', async () => {
  const page = loadClosedPage(pagePath, {
    authenticated: true,
    queueCount: 1,
    offlineRecords: [{ id: 'event-1', status: 'FAILED', lastError: 'network' }],
  })
  await page.shown[0]()
  assert.equal(page.calls.b4Restore, 1)
  assert.equal(page.calls.b4LoadWorld, 1)

  assert.match(page.template, /<MobileClosedPracticeNotice/u)
  assert.match(page.template, /variant="offline"/u)
  assert.match(page.template, /page-title-key="closed\.offline\.title"/u)
  assert.match(page.template, /title-key="closed\.offline\.cardTitle"/u)
  assert.match(page.template, /description-key="closed\.offline\.reason"/u)
  assert.match(page.template, /glow-src="\/static\/figma-closed-169-8610\/c6ebc160-a569-4d54-8b8e-1e8d8c24e667\.svg"/u)
  assert.match(page.template, /icon-src="\/static\/figma-closed-169-8610\/39d39cfd-9d9f-4a74-87dd-7d2afa230999\.svg"/u)
  assert.match(page.template, /@back="backToLearning"/u)
  assert.match(page.template, /<template #queue>/u)
  assert.match(page.template, /v-if="b4\.queueCount" class="v2-offline-queue"/u)
  assert.match(page.template, /mobileT\('closed\.offline\.queue\.title'\)/u)
  assert.match(page.template, /mobileT\('closed\.offline\.queue\.reason'\)/u)
  assert.match(page.template, /mobileT\('closed\.offline\.queue\.item'\)/u)
  assert.match(page.template, /mobileT\('closed\.offline\.queue\.syncNow'\)/u)
  assert.doesNotMatch(page.template, /<AppIcon/u)
  assert.doesNotMatch(page.template, /authorizeOfflinePackage|updateOfflineDownload|cleanupOfflineDownload/u)
  assert.doesNotMatch(page.template, /请求授权|开始下载|暂停|清理/u)
  assert.doesNotMatch(page.template, /即将开放|回到可用学习|离线下载即将开放|待同步|立即同步/u)

  page.test.syncPending()
  assert.equal(page.calls.b4Sync, 1)
  page.test.backToLearning()
  assert.deepEqual(page.calls.navigate, ['/pages/today/today'])
})

test('MB022 b4-offline keeps the offline and sync APIs closed', async () => {
  const api = await read('src/api/b4.ts')
  assert.match(api, /export async function listB4OfflinePackages\(\): Promise<unknown> \{ return unavailableOperation\(\) \}/u)
  assert.match(api, /export async function authorizeB4OfflinePackage\(packageId: string\): Promise<unknown> \{ return unavailableOperation\(\) \}/u)
  assert.match(api, /export async function updateB4OfflineDownload\(downloadId: string, action: 'PAUSE' \| 'RESUME' \| 'PART_RECEIVED', partIndex\?: number, etag\?: string\): Promise<unknown> \{ return unavailableOperation\(\) \}/u)
  assert.match(api, /export async function cleanupB4OfflineDownload\(downloadId: string\): Promise<unknown> \{ return unavailableOperation\(\) \}/u)
  assert.match(api, /export async function pushB4SyncEvents\(events: B4SyncEvent\[\]\): Promise<unknown> \{ return unavailableOperation\(\) \}/u)
})

test('MB022 b4-offline uses shared mobileT keys and semantic color variables', async () => {
  const page = loadClosedPage(pagePath, { authenticated: true })
  assert.match(page.source, /mobileT\('closed\.offline\./u)
  assert.doesNotMatch(page.source, /mobileT\('mobile\./u)
  assert.match(page.source, /interpolate\(mobileT\('closed\.offline\.queue\.count'\)/u)
  assert.match(page.source, /var\(--v2-/u)
  assert.doesNotMatch(page.source, /#[0-9a-fA-F]{3,8}\b/u)
  assert.doesNotMatch(page.source, /rgba?\(/u)
})
