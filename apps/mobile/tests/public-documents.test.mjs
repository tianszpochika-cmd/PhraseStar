import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

const loaderDir = '/tmp/grok-mobile-auth-align-20261104'
register(path.join(loaderDir, 'loader.mjs'), pathToFileURL(`${loaderDir}/`))

const appRoot = path.resolve(import.meta.dirname, '..')
const documentsUrl = pathToFileURL(path.join(appRoot, 'src/platform/public-documents.ts')).href
const runtimeUrl = pathToFileURL(path.join(appRoot, 'src/platform/uni-runtime.ts')).href

async function loadDocuments() {
  return import(documentsUrl)
}

async function loadRuntime() {
  return import(runtimeUrl)
}

function installWindow() {
  const calls = []
  const previous = globalThis.window
  globalThis.window = {
    open(url, target, features) {
      calls.push({ url, target, features })
      return null
    },
  }
  return {
    calls,
    restore() {
      if (previous === undefined) delete globalThis.window
      else globalThis.window = previous
    },
  }
}

test('production and native release without a public origin stay unavailable and do not open localhost', async () => {
  const documents = await loadDocuments()
  const runtime = await loadRuntime()
  const windowStub = installWindow()
  try {
    assert.equal(documents.publicSiteOrigin(), null)
    assert.throws(() => documents.publicDocumentUrl('terms'), /尚未配置/)
    assert.equal(documents.publicSiteOrigin({ DEV: false }), null)
    assert.equal(documents.publicSiteOrigin({ DEV: false, VITE_PUBLIC_SITE_ORIGIN: '   ' }), null)
    assert.throws(() => documents.publicDocumentUrl('terms', { DEV: false }), /尚未配置/)
    assert.throws(() => documents.openPublicDocument('privacy', { DEV: false }), /尚未配置/)
    assert.throws(() => runtime.openExternalUrl('http://127.0.0.1:18182/terms', { DEV: false }), /HTTPS/)
    assert.equal(windowStub.calls.length, 0)
  } finally {
    windowStub.restore()
  }
})

test('development without a setting uses only the local official origin', async () => {
  const documents = await loadDocuments()
  const windowStub = installWindow()
  try {
    assert.equal(documents.publicSiteOrigin({ DEV: true }), 'http://127.0.0.1:18182')
    assert.equal(documents.publicDocumentUrl('terms', { DEV: true }), 'http://127.0.0.1:18182/terms')
    assert.equal(documents.publicDocumentUrl('privacy', { DEV: true }), 'http://127.0.0.1:18182/privacy')
    documents.openPublicDocument('terms', { DEV: true })
    assert.deepEqual(windowStub.calls, [{
      url: 'http://127.0.0.1:18182/terms',
      target: '_blank',
      features: 'noopener,noreferrer',
    }])
  } finally {
    windowStub.restore()
  }
})

test('configured https opens and drops query, hash, and a trailing slash', async () => {
  const documents = await loadDocuments()
  const windowStub = installWindow()
  try {
    const env = { DEV: false, VITE_PUBLIC_SITE_ORIGIN: 'https://legal.example/ignored/?token=secret#frag' }
    assert.equal(documents.publicDocumentUrl('privacy', env), 'https://legal.example/privacy')
    documents.openPublicDocument('terms', env)
    assert.equal(windowStub.calls[0].url, 'https://legal.example/terms')
    assert.equal(windowStub.calls[0].features, 'noopener,noreferrer')
  } finally {
    windowStub.restore()
  }
})

test('illegal http and credential URLs fail before any popup', async () => {
  const documents = await loadDocuments()
  const runtime = await loadRuntime()
  const windowStub = installWindow()
  try {
    assert.throws(() => documents.publicDocumentUrl('terms', { DEV: true, VITE_PUBLIC_SITE_ORIGIN: 'http://example.com' }), /HTTPS/)
    assert.throws(() => documents.publicDocumentUrl('terms', { DEV: false, VITE_PUBLIC_SITE_ORIGIN: 'http://127.0.0.1:18182' }), /HTTPS/)
    assert.throws(() => documents.publicDocumentUrl('privacy', { DEV: false, VITE_PUBLIC_SITE_ORIGIN: 'https://user:secret@legal.example' }), /凭据/)
    assert.throws(() => runtime.openExternalUrl('http://203.0.113.10/terms', { DEV: true }), /HTTPS/)
    assert.throws(() => runtime.openExternalUrl('https://user:secret@legal.example/terms', { DEV: false }), /凭据/)
    assert.equal(windowStub.calls.length, 0)
  } finally {
    windowStub.restore()
  }
})

test('noopener popup that returns null is a successful open', async () => {
  const runtime = await loadRuntime()
  const windowStub = installWindow()
  try {
    assert.doesNotThrow(() => runtime.openExternalUrl('https://legal.example/terms', { DEV: false }))
    assert.equal(windowStub.calls.length, 1)
    assert.equal(windowStub.calls[0].target, '_blank')
    assert.equal(windowStub.calls[0].features, 'noopener,noreferrer')
    assert.equal(windowStub.calls[0].url, 'https://legal.example/terms')
  } finally {
    windowStub.restore()
  }
})

test('native release without an opener fails and does not use window.open', async () => {
  const runtime = await loadRuntime()
  const windowStub = installWindow()
  const previous = globalThis.plus
  globalThis.plus = {}
  try {
    assert.throws(() => runtime.openExternalUrl('https://legal.example/privacy', { DEV: false }), /不能打开/)
    assert.equal(windowStub.calls.length, 0)
  } finally {
    if (previous === undefined) delete globalThis.plus
    else globalThis.plus = previous
    windowStub.restore()
  }
})

test('native opener is used when present and the browser popup is not', async () => {
  const runtime = await loadRuntime()
  const windowStub = installWindow()
  const opened = []
  const previous = globalThis.plus
  globalThis.plus = { runtime: { openURL(url) { opened.push(url) } } }
  try {
    runtime.openExternalUrl('https://legal.example/terms?token=secret#frag', { DEV: false })
    assert.deepEqual(opened, ['https://legal.example/terms'])
    assert.equal(windowStub.calls.length, 0)
  } finally {
    if (previous === undefined) delete globalThis.plus
    else globalThis.plus = previous
    windowStub.restore()
  }
})
