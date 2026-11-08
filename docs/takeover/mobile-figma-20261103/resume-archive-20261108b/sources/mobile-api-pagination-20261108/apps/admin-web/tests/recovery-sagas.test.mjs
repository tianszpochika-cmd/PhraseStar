import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')

function loadRecovery(responses) {
  const source = fs.readFileSync(path.join(appRoot, 'src/api/recovery.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const requests = []
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      './client': {
        adminClient: {
          async request(requestPath) {
            requests.push(requestPath)
            const next = responses.shift()
            if (next === undefined) throw new Error('No fixture response queued')
            if (next && next.throw) throw next.throw
            return next
          },
        },
      },
      '../platform/client-id': { createClientId: () => 'recovery-fixture-key-0001' },
    }
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  return { api: module.exports, requests }
}

function sagaId(index) {
  return `saga-${String(index).padStart(4, '0')}-aaaa-aaaa-aaaaaaaaaaaa`
}

test('unfinished saga list reads canonical envelope data and meta', async () => {
  const page = loadRecovery([
    {
      data: ['11111111-1111-1111-1111-111111111111'],
      meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.cursor1' },
    },
  ])
  const result = await page.api.listUnfinishedSagas({ cursor: 'v1.saga.prev', pageSize: 1 })
  assert.deepEqual(result.sagaIds, ['11111111-1111-1111-1111-111111111111'])
  assert.equal(result.hasMore, true)
  assert.equal(result.nextCursor, 'v1.saga.cursor1')
  assert.equal(result.pageSize, 1)
  assert.match(page.requests[0], /\/admin\/recovery\/sagas\/unfinished\?/)
  assert.match(page.requests[0], /cursor=v1\.saga\.prev/)
  assert.match(page.requests[0], /pageSize=1/)
})

test('unfinished saga walker follows nextCursor and stops', async () => {
  const page = loadRecovery([
    { data: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1'], meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.two' } },
    { data: ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2'], meta: { hasMore: false, pageSize: 1, nextCursor: null } },
  ])
  const ids = await page.api.listAllUnfinishedSagaIds()
  assert.deepEqual(ids, [
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  ])
  assert.equal(page.requests.length, 2)
  assert.match(page.requests[1], /cursor=v1\.saga\.two/)
})

test('walker completes 5100 ids across 51 pages instead of silently stopping at 5000', async () => {
  const pages = []
  const expected = []
  for (let page = 0; page < 51; page += 1) {
    const data = []
    for (let i = 0; i < 100; i += 1) {
      const id = sagaId(page * 100 + i)
      data.push(id)
      expected.push(id)
    }
    const hasMore = page < 50
    pages.push({
      data,
      meta: { hasMore, pageSize: 100, nextCursor: hasMore ? `cursor-${(page + 1) * 100}-xxxxxxxx` : null },
    })
  }
  const loaded = loadRecovery(pages)
  const ids = await loaded.api.listAllUnfinishedSagaIds()
  assert.equal(ids.length, 5100)
  assert.equal(ids[0], expected[0])
  assert.equal(ids[4999], expected[4999])
  assert.equal(ids[5099], expected[5099])
  assert.equal(loaded.requests.length, 51)
})

test('walker completes 5100 pages', async () => {
  const pages = []
  const expected = []
  for (let i = 0; i < 5100; i += 1) {
    const id = sagaId(i)
    expected.push(id)
    const hasMore = i < 5099
    pages.push({
      data: [id],
      meta: { hasMore, pageSize: 1, nextCursor: hasMore ? `cursor-${i + 1}-xxxxxxxx` : null },
    })
  }
  const loaded = loadRecovery(pages)
  const ids = await loaded.api.listAllUnfinishedSagaIds()
  assert.equal(ids.length, 5100)
  assert.deepEqual(ids, expected)
  assert.equal(loaded.requests.length, 5100)
})

test('walker fails on a repeated cursor instead of looping facts', async () => {
  const loaded = loadRecovery([
    { data: [sagaId(1)], meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.samexx' } },
    { data: [sagaId(2)], meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.samexx' } },
  ])
  await assert.rejects(() => loaded.api.listAllUnfinishedSagaIds(), /repeated a cursor/)
  assert.equal(loaded.requests.length, 2)
})

test('walker fails on a duplicated id', async () => {
  const loaded = loadRecovery([
    { data: [sagaId(1)], meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.two' } },
    { data: [sagaId(1)], meta: { hasMore: false, pageSize: 1, nextCursor: null } },
  ])
  await assert.rejects(() => loaded.api.listAllUnfinishedSagaIds(), /duplicated an id/)
})

test('walker fails when the page budget ends with hasMore', async () => {
  const budget = loadRecovery([]).api.UNFINISHED_SAGA_PAGE_BUDGET
  assert.equal(budget, 10_000)
  const pages = []
  for (let i = 0; i < budget; i += 1) {
    pages.push({
      data: [sagaId(i)],
      meta: { hasMore: true, pageSize: 1, nextCursor: `cursor-${i + 1}-xxxxxxxx` },
    })
  }
  const loaded = loadRecovery(pages)
  await assert.rejects(() => loaded.api.listAllUnfinishedSagaIds(), /exceeded the page budget/)
  assert.equal(loaded.requests.length, budget)
})

test('a later HTTP failure throws and does not return the first page', async () => {
  const loaded = loadRecovery([
    { data: [sagaId(1)], meta: { hasMore: true, pageSize: 1, nextCursor: 'v1.saga.two' } },
    { throw: Object.assign(new Error('cursor is invalid'), { status: 400 }) },
  ])
  await assert.rejects(() => loaded.api.listAllUnfinishedSagaIds(), /cursor is invalid/)
  assert.equal(loaded.requests.length, 2)
})

function loadRecoveryView(listAll) {
  const source = fs.readFileSync(path.join(appRoot, 'src/views/AdminRecoveryView.vue'), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
    + '\nexport { load, state, sagas, lastError }\n'
  const compiled = ts.transpileModule(script, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const session = {
    can(permission) { return permission === 'admin.recovery.read' },
  }
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const modules = {
      vue: { onMounted() {}, ref(value) { return { value } } },
      '../platform/experience': { ui: (key) => key },
      '../components/AdminPageIntro.vue': {},
      'element-plus': { ElMessage: { error() {}, success() {} }, ElMessageBox: { confirm: async () => {} } },
      '../api/client': { AdminApiError: class AdminApiError extends Error { constructor(message, status) { super(message); this.status = status } } },
      '../api/recovery': {
        listAllUnfinishedSagaIds: listAll,
        requestRecovery: async () => null,
        approveRecovery: async () => null,
        rejectRecovery: async () => null,
        executeRecovery: async () => null,
      },
      '../stores/admin': { useAdminStore: () => session },
    }
    if (!(name in modules)) throw new Error(`Unexpected import ${name}`)
    return modules[name]
  }, module, module.exports)
  return module.exports
}

test('recovery view is ready only after a complete walk and clears sagas on error', async () => {
  const viewSource = fs.readFileSync(path.join(appRoot, 'src/views/AdminRecoveryView.vue'), 'utf8')
  assert.match(viewSource, /const ids = await listAllUnfinishedSagaIds\(\)/)
  assert.match(viewSource, /sagas\.value = ids/)
  assert.match(viewSource, /sagas\.value = \[\]/)
  assert.doesNotMatch(viewSource, /for \(let page = 0; page < 50; page \+= 1\)/)

  let resolveWalk
  const pending = new Promise((resolve) => { resolveWalk = resolve })
  const complete = loadRecoveryView(async () => pending)
  complete.state.value = 'loading'
  const walking = complete.load()
  assert.equal(complete.state.value, 'loading')
  assert.deepEqual(complete.sagas.value, [])
  resolveWalk([sagaId(0), sagaId(1)])
  await walking
  assert.equal(complete.state.value, 'ready')
  assert.deepEqual(complete.sagas.value, [sagaId(0), sagaId(1)])

  const failing = loadRecoveryView(async () => {
    throw new Error('unfinished saga walk exceeded the page budget')
  })
  failing.sagas.value = [sagaId(9)]
  await failing.load()
  assert.equal(failing.state.value, 'error')
  assert.deepEqual(failing.sagas.value, [])
  assert.match(failing.lastError.value, /exceeded the page budget/)
})
