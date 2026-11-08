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
