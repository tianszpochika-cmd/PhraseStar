const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')

const appRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(appRoot, '..', '..')
const outDir = '/tmp/grok-platform-hydration-takeover-04'
const distDir = path.join(appRoot, 'dist/build/h5')
const origin = 'http://platform.test'
const sid = '785cfc0d-ffbe-4de5-ab82-73e1c124269a'

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  if (ext === '.html') return 'text/html; charset=utf-8'
  if (ext === '.js' || ext === '.mjs') return 'text/javascript; charset=utf-8'
  if (ext === '.css') return 'text/css; charset=utf-8'
  if (ext === '.json') return 'application/json; charset=utf-8'
  if (ext === '.svg') return 'image/svg+xml'
  if (ext === '.png') return 'image/png'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.woff') return 'font/woff'
  if (ext === '.woff2') return 'font/woff2'
  return 'application/octet-stream'
}

function writeResult(result) {
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'browser-canary.json'), `${JSON.stringify(result, null, 2)}\n`)
}

async function main() {
  const sourceFiles = [
    'src/pages/b6-platform/b6-platform.vue',
    'src/pages/b6-platform/platform-page.ts',
    'src/App.vue',
    'src/platform/experience.ts',
    'tests/b6-platform-page.test.mjs',
    'tests/mobile-experience-runtime-hydration.test.mjs',
    'tests/helpers/mobile-experience-runtime-loader.mjs',
  ]
  const sourceHashes = {}
  for (const relativePath of sourceFiles) {
    sourceHashes[relativePath] = sha256(fs.readFileSync(path.join(appRoot, relativePath)))
  }
  const indexPath = path.join(distDir, 'index.html')
  const artifact = { present: fs.existsSync(indexPath), origin, productServer: false, port18183: false }
  if (artifact.present) {
    const indexBytes = fs.readFileSync(indexPath)
    const artifactDir = path.join(outDir, 'artifact')
    const copyPath = path.join(artifactDir, 'index.html')
    fs.mkdirSync(artifactDir, { recursive: true })
    if (fs.existsSync(copyPath)) fs.chmodSync(copyPath, 0o644)
    fs.writeFileSync(copyPath, indexBytes)
    fs.chmodSync(copyPath, 0o444)
    artifact.indexSha256 = sha256(indexBytes)
    artifact.indexBytes = indexBytes.length
    artifact.copy = 'artifact/index.html'
    artifact.copySha256 = sha256(fs.readFileSync(copyPath))
    artifact.immutable = true
  }
  const result = {
    sid,
    harness: 'apps/mobile/tests/ui-platform.e2e.cjs',
    productServer: false,
    port18183: false,
    realNetwork: false,
    browsersProbed: [],
    sourceHashes,
    artifact,
    browser: { status: 'NOT_RUN', reason: artifact.present ? 'not-started' : 'compiled-artifact-missing' },
  }
  if (!artifact.present) {
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
    let fulfilledCount = 0
    let abortedCount = 0
    const abortedHosts = new Set()
    await page.route('**/*', async (route) => {
      let url
      try { url = new URL(route.request().url()) } catch { abortedCount += 1; return route.abort() }
      if (url.port === '18183' || url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.origin !== origin) {
        abortedCount += 1
        abortedHosts.add(url.host)
        return route.abort()
      }
      const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html'
      const safeRelative = relativePath.endsWith('/') ? `${relativePath}index.html` : relativePath
      const file = path.resolve(distDir, safeRelative)
      if (file !== distDir && !file.startsWith(`${distDir}${path.sep}`)) {
        abortedCount += 1
        return route.abort()
      }
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        abortedCount += 1
        return route.abort()
      }
      fulfilledCount += 1
      return route.fulfill({ status: 200, contentType: contentType(file), body: fs.readFileSync(file) })
    })
    await page.goto(`${origin}/index.html`, { waitUntil: 'domcontentloaded', timeout: 15000 })
    const title = await page.title()
    const locationHash = await page.evaluate(() => location.hash)
    result.browser = {
      status: 'LAUNCHED',
      reason: 'route-fulfill-compiled-index',
      productServer: false,
      port18183: false,
      titleLength: title.length,
      locationHash,
      fulfilledCount,
      abortedCount,
      abortedHosts: [...abortedHosts],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0].slice(0, 300) : 'launch-failed'
    const knownLaunchFault = message.includes('Target page, context or browser has been closed') || message.includes('browserType.launch')
    result.browser = {
      status: 'NOT_RUN',
      reason: knownLaunchFault ? 'chromium-launch-failed' : 'chromium-canary-failed',
      name: error instanceof Error ? error.name : 'Error',
      message,
    }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
  writeResult(result)
  if (result.browser.status === 'NOT_RUN' && result.browser.reason === 'chromium-launch-failed') return
  if (result.browser.status !== 'LAUNCHED') process.exitCode = 1
}

main()
