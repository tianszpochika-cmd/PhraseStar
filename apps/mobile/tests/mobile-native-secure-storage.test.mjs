import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const appRoot = path.resolve(import.meta.dirname, '..')
const bridgePath = path.join(appRoot, 'src/platform/native-secure-storage.ts')
const providerPath = path.join(appRoot, 'src/platform/secure-storage-provider.ts')
const REFRESH_KEY = 'yx.auth.mobile.refresh-token'

function envelope(overrides = {}) {
  return JSON.stringify({
    ok: true,
    value: null,
    code: '',
    osStatus: 0,
    message: '',
    ...overrides,
  })
}

function loadModule(file, resolveImport) {
  const source = fs.readFileSync(file, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)((name) => {
    const resolved = resolveImport(name)
    if (resolved !== undefined) return resolved
    throw new Error(`unexpected module import ${name}`)
  }, module, module.exports)
  return module.exports
}

function loadProvider() {
  return loadModule(providerPath, (name) => {
    throw new Error(`unexpected provider import ${name}`)
  })
}

function loadBridge(uts, provider = loadProvider()) {
  return loadModule(bridgePath, (name) => {
    if (name === '../uni_modules/yx-secure-storage') return uts
    if (name === './secure-storage-provider') return provider
    throw new Error(`unexpected bridge import ${name}`)
  })
}

function withUni(value, run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'uni')
  Object.defineProperty(globalThis, 'uni', { configurable: true, writable: true, value })
  try { return run() } finally {
    if (descriptor) Object.defineProperty(globalThis, 'uni', descriptor)
    else Reflect.deleteProperty(globalThis, 'uni')
  }
}

function withoutUni(run) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'uni')
  Reflect.deleteProperty(globalThis, 'uni')
  try { return run() } finally {
    if (descriptor) Object.defineProperty(globalThis, 'uni', descriptor)
    else Reflect.deleteProperty(globalThis, 'uni')
  }
}

function syntheticUts(overrides = {}) {
  const calls = []
  const uts = {
    readSecureItem(key) { calls.push(['read', key]); return envelope({ value: 'synthetic-refresh-token' }) },
    writeSecureItem(key, value) { calls.push(['write', key, value]); return envelope() },
    removeSecureItem(key) { calls.push(['remove', key]); return envelope() },
    ...overrides,
  }
  return { uts, calls }
}

test('App bootstrap registers the real adapter when the vendor object is frozen', () => {
  const { uts, calls } = syntheticUts()
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  withUni(Object.freeze({}), () => {
    assert.doesNotThrow(() => bridge.installNativeSecureStorage())
    const storage = provider.resolveSecureStorage()
    assert.equal(typeof storage?.getItem, 'function')
    assert.equal(storage.getItem(REFRESH_KEY), 'synthetic-refresh-token')
    storage.setItem(REFRESH_KEY, 'synthetic-next-token')
    storage.removeItem(REFRESH_KEY)
  })
  assert.deepEqual(calls, [
    ['read', REFRESH_KEY],
    ['write', REFRESH_KEY, 'synthetic-next-token'],
    ['remove', REFRESH_KEY],
  ])
})

test('App bootstrap registers the real adapter while the vendor object is absent', () => {
  const { uts, calls } = syntheticUts()
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  withoutUni(() => {
    assert.equal('uni' in globalThis, false)
    assert.doesNotThrow(() => bridge.installNativeSecureStorage())
    assert.equal('uni' in globalThis, false)
    assert.equal(provider.resolveSecureStorage().getItem(REFRESH_KEY), 'synthetic-refresh-token')
  })
  assert.deepEqual(calls, [['read', REFRESH_KEY]])
})

test('App bootstrap never writes a read-only vendor capability', () => {
  const { uts } = syntheticUts()
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  const vendor = {}
  Object.defineProperty(vendor, 'getSecureStorage', {
    configurable: false,
    enumerable: true,
    writable: false,
    value: undefined,
  })
  Object.freeze(vendor)
  withUni(vendor, () => {
    assert.doesNotThrow(() => bridge.installNativeSecureStorage())
    const descriptor = Object.getOwnPropertyDescriptor(vendor, 'getSecureStorage')
    assert.equal(descriptor.writable, false)
    assert.equal(descriptor.value, undefined)
    assert.equal(vendor.getSecureStorage, undefined)
    assert.equal(provider.resolveSecureStorage().getItem(REFRESH_KEY), 'synthetic-refresh-token')
  })
})

test('an existing injected provider is preserved and wins after registration', () => {
  const { uts, calls } = syntheticUts()
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  const existingStorage = { getItem: () => 'in-memory-test-token', setItem() {}, removeItem() {} }
  const receivers = []
  let mode = 'value'
  const runtime = {
    getSecureStorage() {
      receivers.push(this)
      if (this !== runtime) return undefined
      if (mode === 'throw') throw new Error('synthetic injected failure')
      return mode === 'value' ? existingStorage : undefined
    },
  }
  withUni(runtime, () => {
    bridge.installNativeSecureStorage()
    assert.equal(globalThis.uni.getSecureStorage, runtime.getSecureStorage)
    assert.equal(globalThis.uni.getSecureStorage(), existingStorage)
    assert.equal(provider.resolveSecureStorage(), existingStorage)
    assert.deepEqual(receivers, [runtime, runtime])
    mode = 'empty'
    assert.equal(provider.resolveSecureStorage(), undefined)
    mode = 'throw'
    assert.throws(() => provider.resolveSecureStorage(), (error) => {
      assert.equal(error.message, 'synthetic injected failure')
      return true
    })
    assert.deepEqual(receivers, [runtime, runtime, runtime, runtime])
  })
  assert.deepEqual(calls, [])
})

test('nothing registered and no vendor capability stays fail-closed', () => {
  const provider = loadProvider()
  withUni({}, () => assert.equal(provider.resolveSecureStorage(), undefined))
  withoutUni(() => assert.equal(provider.resolveSecureStorage(), undefined))
})

test('native failure envelopes become typed errors and never fall back to plain storage', () => {
  const { uts } = syntheticUts({
    readSecureItem() {
      return envelope({ ok: false, value: null, code: 'keychain_osstatus', osStatus: -25300, message: 'Keychain read failed.' })
    },
  })
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  withUni({ getStorageSync: () => 'ordinary-storage-token' }, () => {
    bridge.installNativeSecureStorage()
    const storage = provider.resolveSecureStorage()
    assert.throws(() => storage.getItem(REFRESH_KEY), (error) => {
      assert.equal(error instanceof bridge.NativeSecureStorageError, true)
      assert.equal(error.code, 'keychain_osstatus')
      assert.equal(error.osStatus, -25300)
      return true
    })
  })
})

test('malformed envelopes and native-call failures fail closed as invalid envelopes', () => {
  for (const readSecureItem of [
    () => 'not-json',
    () => JSON.stringify({ ok: true, value: 7, code: '', osStatus: 0, message: '' }),
    () => envelope({ osStatus: 1.5 }),
    () => { throw new Error('native bridge unavailable') },
  ]) {
    const provider = loadProvider()
    const bridge = loadBridge(syntheticUts({ readSecureItem }).uts, provider)
    withUni({}, () => {
      bridge.installNativeSecureStorage()
      const storage = provider.resolveSecureStorage()
      assert.throws(() => storage.getItem(REFRESH_KEY), (error) => {
        assert.equal(error instanceof bridge.NativeSecureStorageError, true)
        assert.ok(['invalid_envelope', 'native_call_failed'].includes(error.code))
        return true
      })
    })
  }
})

test('bridge and native key scope reject every other key without a native call', () => {
  const { uts, calls } = syntheticUts()
  const provider = loadProvider()
  const bridge = loadBridge(uts, provider)
  withUni({}, () => {
    bridge.installNativeSecureStorage()
    const storage = provider.resolveSecureStorage()
    for (const key of ['yx.auth.mobile.other', '', 'yx.auth.mobile.refresh-token ']) {
      assert.throws(() => storage.getItem(key), (error) => error.code === 'invalid_key')
      assert.throws(() => storage.setItem(key, 'synthetic'), (error) => error.code === 'invalid_key')
      assert.throws(() => storage.removeItem(key), (error) => error.code === 'invalid_key')
    }
  })
  assert.deepEqual(calls, [])
})
