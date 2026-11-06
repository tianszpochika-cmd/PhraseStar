const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const outDir = '/tmp/grok-vocabulary-front-integration-06'
const distDir = path.join(appRoot, 'dist/build/h5')
const artifactDir = path.join(outDir, 'artifact/h5')
const appOrigin = 'http://vocab.test'
const gatewayOrigin = 'http://127.0.0.1:18070'
const iamOrigin = 'https://127.0.0.1:18087'
const sid = '785cfc0d-ffbe-4de5-ab82-73e1c124269a'
const vocabRoute = '/pages/b2-vocabulary/b2-vocabulary'

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(absolute, files)
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.woff2') return 'font/woff2'
  return 'application/octet-stream'
}

function freezeArtifact() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) return null
  fs.mkdirSync(path.dirname(artifactDir), { recursive: true })
  for (const file of walk(artifactDir)) fs.chmodSync(file, 0o644)
  fs.cpSync(distDir, artifactDir, { recursive: true, force: true })
  const files = walk(artifactDir).map((file) => {
    fs.chmodSync(file, 0o444)
    const relative = path.relative(artifactDir, file)
    const bytes = fs.readFileSync(file)
    return { path: relative, sha256: sha256(bytes), bytes: bytes.length }
  })
  const index = files.find((file) => file.path === 'index.html')
  return { files, index, count: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }
}

function sourceHashes() {
  const relativePaths = [
    'apps/mobile/src/pages/b2-vocabulary/b2-vocabulary.vue',
    'apps/mobile/src/domain/vocabulary-page.ts',
    'apps/mobile/tests/vocabulary-page.test.mjs',
    'apps/mobile/tests/ui-vocabulary.e2e.cjs',
    'packages/i18n/src/mobile-resources/vocabulary-page.ts',
    'apps/mobile/src/api/b10.ts',
    'apps/mobile/src/stores/b10-learning.ts',
    'apps/mobile/src/domain/b10.ts',
  ]
  return Object.fromEntries(relativePaths.map((relativePath) => [relativePath, sha256(fs.readFileSync(path.join(repoRoot, relativePath)))]))
}

function writeResult(result) {
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'browser-canary.json'), `${JSON.stringify(result, null, 2)}\n`)
}

function syntheticBody(pathname) {
  if (pathname.endsWith('/auth/token/refresh') || pathname.endsWith('/auth/login')) {
    return { accessToken: 'synthetic-ui-fixture-not-a-valid-credential', tokenType: 'Bearer', expiresIn: 900, adultGate: 'PASSED' }
  }
  if (pathname.endsWith('/iam/principal/me') || pathname.endsWith('/iam/me')) {
    return { adultGate: { status: 'PASSED', learningAccess: 'ELIGIBLE', minimumAge: 18 }, consentState: { accepted: true, unsatisfiedPurposes: [] }, permissions: ['learning.plan.read'] }
  }
  if (pathname.endsWith('/learning/srs/batches')) {
    return {
      snapshotId: 9,
      localDate: '2026-11-04',
      timezone: 'Asia/Shanghai',
      status: 'ACTIVE',
      items: [{
        snapshotItemId: 1,
        sequenceNo: 1,
        item: { itemType: 'VOCAB', vocabId: 42 },
        sourceReason: 'NEW',
        plannedLocalDate: '2026-11-04',
        status: 'PENDING',
        contentVersion: 'cv-front-1',
        contentVersionId: 7,
        stateVersion: 1,
      }],
    }
  }
  if (pathname.includes('/content/learner/vocabulary/')) {
    return {
      vocabId: 42,
      word: 'bridge',
      availability: 'PUBLISHED',
      contentVersion: 'cv-front-1',
      contentVersionId: 7,
      phoneticUs: '/brɪdʒ/',
      audio: { us: 'https://cdn.example/bridge.mp3' },
      answerAvailable: false,
    }
  }
  return null
}

async function main() {
  const artifact = freezeArtifact()
  const result = {
    sid,
    harness: 'apps/mobile/tests/ui-vocabulary.e2e.cjs',
    origins: [appOrigin, gatewayOrigin, iamOrigin],
    productServer: false,
    port18183: false,
    realNetwork: false,
    browsersProbed: [],
    sourceHashes: sourceHashes(),
    artifact: artifact ? { count: artifact.count, bytes: artifact.bytes, index: artifact.index } : { count: 0 },
    counts: { asset: 0, knownApi: 0, unknown404: 0, outsideAbort: 0 },
    browser: { status: 'NOT_RUN', reason: artifact ? 'not-started' : 'compiled-artifact-missing' },
  }
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'artifact-files.json'), `${JSON.stringify({ sid, files: artifact ? artifact.files : [] }, null, 2)}\n`)
  if (!artifact) {
    writeResult(result)
    process.exitCode = 1
    return
  }

  const requireRoot = createRequire(path.join(repoRoot, 'package.json'))
  let chromium
  try {
    ;({ chromium } = requireRoot('playwright'))
  } catch (error) {
    result.browser = { status: 'NOT_RUN', reason: 'playwright-unavailable', name: error.name }
    writeResult(result)
    return
  }

  result.browsersProbed = ['chromium']
  let browser
  try {
    browser = await chromium.launch({ headless: true, timeout: 20000 })
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.route('**/*', async (route) => {
      let url
      try { url = new URL(route.request().url()) } catch { result.counts.outsideAbort += 1; return route.abort() }
      const origin = url.origin
      if (origin !== appOrigin && origin !== gatewayOrigin && origin !== iamOrigin) {
        result.counts.outsideAbort += 1
        return route.abort()
      }
      if (origin === appOrigin) {
        const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
        const safe = relative.endsWith('/') ? `${relative}index.html` : relative
        const file = path.resolve(artifactDir, safe)
        if (!file.startsWith(`${artifactDir}${path.sep}`) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          result.counts.unknown404 += 1
          return route.fulfill({ status: 404, contentType: 'text/plain; charset=utf-8', body: 'missing' })
        }
        result.counts.asset += 1
        return route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(file) })
      }
      const body = syntheticBody(url.pathname)
      if (!body) {
        result.counts.unknown404 += 1
        return route.fulfill({ status: 404, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ code: 'NOT_FOUND' }) })
      }
      result.counts.knownApi += 1
      return route.fulfill({ status: 200, contentType: 'application/json; charset=utf-8', body: JSON.stringify({ data: body }) })
    })
    await page.goto(`${appOrigin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const navigation = await page.evaluate(async (route) => {
      const runtime = globalThis.uni
      if (!runtime || typeof runtime.navigateTo !== 'function' || typeof getCurrentPages !== 'function') return { navigation: 'missing' }
      await new Promise((resolve) => runtime.navigateTo({ url: route, complete: () => resolve(true) }))
      const stack = getCurrentPages().map((item) => typeof item.route === 'string' ? item.route.split('?')[0] : '')
      return { navigation: 'navigateTo', stack }
    }, vocabRoute)
    const beforeReveal = await page.evaluate(() => {
      const root = document.querySelector('.vocab-page')
      const text = root ? root.innerText : ''
      return {
        hasPage: Boolean(root),
        hasStudyItem: text.includes('学习项'),
        hasAnswer: Boolean(root && root.querySelector('.vocab-answer')),
        word: root ? (root.querySelector('.vocab-word')?.textContent || '') : '',
      }
    })
    if (beforeReveal.hasPage && !beforeReveal.hasAnswer) {
      const button = page.locator('.vocab-page button', { hasText: '显示答案' })
      if (await button.count()) {
        await button.first().focus()
        await page.keyboard.press('Enter')
      }
    }
    const afterKeyboard = await page.evaluate(() => {
      const root = document.querySelector('.vocab-page')
      return { hasAnswer: Boolean(root && root.querySelector('.vocab-answer')) }
    })
    const back = await page.evaluate(async () => {
      const runtime = globalThis.uni
      if (!runtime || typeof runtime.navigateBack !== 'function' || typeof getCurrentPages !== 'function') return { navigation: 'missing' }
      await new Promise((resolve) => runtime.navigateBack({ delta: 1, complete: () => resolve(true) }))
      return { navigation: 'navigateBack', stack: getCurrentPages().map((item) => typeof item.route === 'string' ? item.route.split('?')[0] : '') }
    })
    result.browser = {
      status: 'LAUNCHED',
      reason: 'compiled-ui-three-origin',
      productServer: false,
      port18183: false,
      navigation,
      back,
      beforeReveal: { hasPage: beforeReveal.hasPage, hasStudyItem: beforeReveal.hasStudyItem, hasAnswer: beforeReveal.hasAnswer, wordLength: beforeReveal.word.length },
      afterKeyboard,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0].slice(0, 300) : 'launch-failed'
    const known = message.includes('Target page, context or browser has been closed') || message.includes('browserType.launch')
    result.browser = { status: 'NOT_RUN', reason: known ? 'chromium-launch-failed' : 'chromium-canary-failed', name: error instanceof Error ? error.name : 'Error', message }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
  writeResult(result)
  if (result.browser.status === 'NOT_RUN' && result.browser.reason === 'chromium-launch-failed') return
  if (result.browser.status !== 'LAUNCHED') process.exitCode = 1
}

main()
