// Scoped H5 login UI regression. Every API is intercepted: rejection fixtures,
// plus an in-memory dummy first response followed by a permission-service outage.
// Never inspect authentication storage, cookies, token values or request bodies.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:18183';
const PAGE_PATH = '/pages/login/login';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/mobile-login-' + Date.now());
const report = { scope: 'MOBILE_LOGIN_H5_UI_ONLY_SYNTHETIC_AUTH_FAILURES', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], layoutDiagnostics: [], legalObservations: [], checks: [], pageErrors: [], consoleErrors: [], consoleAll: [], shots: [], fixtureRequests: [], unhandledRejections: [], visibleSvgs: [], lease: { pid: 55957, port: 18183, policy: 'visit only' } };
fs.mkdirSync(OUT, { recursive: true });
const sources = ['apps/mobile/src/pages/login/login.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'packages/i18n/src/mobile-experience.ts', 'packages/design-tokens/src/mobile.ts', 'apps/mobile/src/theme/figma-r4-assets.ts', 'apps/mobile/src/platform/experience.ts', 'apps/mobile/src/platform/public-documents.ts', 'apps/mobile/src/platform/uni-runtime.ts', 'apps/mobile/src/env.d.ts', 'apps/mobile/tests/ui-login.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
let browser;
const pending = new Set();
const labels = {
  'zh-CN': { account: '账号', password: '密码', title: '欢迎回来', submit: '登录并继续', terms: '用户协议', privacy: '隐私政策', show: '显示密码', hide: '隐藏密码' },
  'en-US': { account: 'Account', password: 'Password', title: 'Welcome back', submit: 'Sign in and continue', terms: 'Terms', privacy: 'Privacy policy', show: 'Show password', hide: 'Hide password' },
};
function redact(text) {
  return String(text)
    .replace(/bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/access[_-]?token["']?\s*[:=]\s*["'][^"']*["']/gi, 'accessToken:[redacted]')
    .replace(/password["']?\s*[:=]\s*["'][^"']*["']/gi, 'password:[redacted]')
    .replace(/authorization["']?\s*[:=]\s*["'][^"']*["']/gi, 'authorization:[redacted]')
    .slice(0, 400);
}
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', height = 844, scenario = 'rejection', motion = 'reduce', returnTo = '') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
  let hold = false, loginCount = 0, release, loginStarted = 0, permissionStarted = 0, loginFulfilled = false;
  await context.addInitScript(() => {
    window.__yxUnhandled = [];
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      const errMsg = reason && typeof reason === 'object' && reason.errMsg ? String(reason.errMsg) : (reason && reason.message ? String(reason.message) : 'unknown');
      window.__yxUnhandled.push({ errMsg: errMsg.slice(0, 180), route: location.hash });
    });
  });
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/login') {
      assert.equal(url.protocol, 'https:', 'Password request must remain on IAM TLS');
      loginCount++;
      loginStarted = Date.now();
      if (hold) await new Promise(resolve => { release = resolve; pending.add(resolve); });
      if (scenario === 'two-stage-unavailable' || scenario === 'adult-gate') {
        if (scenario === 'two-stage-unavailable') await new Promise(resolve => setTimeout(resolve, 5100));
        loginFulfilled = true;
        // Synthetic fixture only. The response is not recorded, persisted, or a credential.
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: 'REQUIRED' }) });
        return;
      }
      await route.fulfill({ status: 401, headers, body: JSON.stringify({ code: 'iam.credentials.invalid', message: 'Synthetic rejection' }) });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/iam/principal/me' && scenario === 'two-stage-unavailable' && loginFulfilled) {
      permissionStarted = Date.now();
      await new Promise(resolve => setTimeout(resolve, 5900));
      await route.fulfill({ status: 503, headers, body: JSON.stringify({ code: 'SERVICE_UNAVAILABLE', message: 'Synthetic permission outage' }) });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/iam/principal/me' && scenario === 'adult-gate' && loginFulfilled) {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          principal: { subject: 'synthetic-ui-subject', roles: [], permissions: [], adultGate: 'REQUIRED' },
          roles: [],
          permissions: [],
          adultGate: 'REQUIRED',
        }),
      });
      return;
    }
    await route.fulfill({
      status: request.method() === 'OPTIONS' ? 204 : 404,
      headers,
      body: request.method() === 'OPTIONS' ? '' : JSON.stringify({ code: 'SYNTHETIC_UI_UNKNOWN', message: 'Synthetic unknown route' }),
    });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(redact(error.message)));
  page.on('console', message => {
    const entry = { type: message.type(), text: redact(message.text()) };
    report.consoleAll.push(entry);
    if (message.type() === 'error') report.consoleErrors.push(entry.text);
  });
  const returnQuery = returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : '';
  await page.goto(`${BASE}/#${PAGE_PATH}?theme=${theme}&uiLocale=${locale}${returnQuery}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-login-title').waitFor();
  await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  return { context, page, hold: () => { hold = true; }, release: () => { if (release) { pending.delete(release); release(); } }, count: () => loginCount, latency: () => ({ loginStarted, permissionStarted }) };
}
async function facts(page) {
  return page.evaluate(() => {
    const bg = element => {
      for (let current = element; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor;
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color;
      }
      return 'rgb(255, 255, 255)';
    };
    const rgb = color => color.match(/[\d.]+/g).slice(0, 3).map(Number);
    const luminance = color => rgb(color).map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const contrast = element => {
      const a = luminance(getComputedStyle(element).color), b = luminance(bg(element));
      return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    };
    const dimensions = element => { const r = element.getBoundingClientRect(); return { width: r.width, height: r.height }; };
    const root = document.querySelector('.v2-login'), title = document.querySelector('.login-title'), submit = document.querySelector('.login-submit');
    const fields = [...document.querySelector('.login-fields').children].filter(element => element.classList.contains('login-field'));
    const fieldRects = fields.map(element => element.getBoundingClientRect());
    const privacyRect = document.querySelector('.login-privacy').getBoundingClientRect();
    const submitRect = submit.getBoundingClientRect();
    return {
      url: location.href, title: document.title, theme: document.documentElement.dataset.theme,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      contentWidth: document.querySelector('.login-content').getBoundingClientRect().width,
      background: getComputedStyle(root).backgroundColor,
      titleFont: getComputedStyle(title).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.login-description')),
      submitFont: getComputedStyle(submit).fontSize, submitContrast: contrast(submit),
      inputFonts: [...document.querySelectorAll('.login-input input')].map(element => getComputedStyle(element).fontSize),
      fieldGap: fieldRects[1].top - fieldRects[0].bottom,
      privacyBeforeSubmit: privacyRect.bottom <= submitRect.top + 0.5,
      privacyGap: submitRect.top - privacyRect.bottom,
      targets: [...document.querySelectorAll('.login-password-toggle,.login-text-button,.login-submit')].map(element => ({ label: element.getAttribute('aria-label') || element.textContent.trim(), ...dimensions(element) })),
    };
  });
}
function consoleClass() {
  const counts = {};
  for (const entry of report.consoleAll) counts[entry.type] = (counts[entry.type] || 0) + 1;
  return counts;
}
async function rememberLayout(page, label, actual) {
  const state = await page.evaluate(() => ({
    href: location.href,
    hash: location.hash.split('?')[0],
    theme: document.documentElement.dataset.theme || null,
    viewport: { width: innerWidth, height: innerHeight },
    dpr: window.devicePixelRatio,
  }));
  const record = {
    label,
    actual,
    state,
    viewport: state.viewport,
    sourceSha: report.sourceHashes['apps/mobile/src/pages/login/login.vue'],
    e2eSha: report.sourceHashes['apps/mobile/tests/ui-login.e2e.cjs'],
    networkRequests: report.fixtureRequests.length,
    pageErrors: report.pageErrors.length,
    consoleErrors: report.consoleErrors.length,
    consoleClass: consoleClass(),
  };
  report.layoutDiagnostics.push(record);
  save();
  return record;
}
async function keepFailureShot(page, fileName, record, error) {
  await page.screenshot({ path: path.join(OUT, fileName), fullPage: true }).catch(() => {});
  report.matrix.push({
    ...record,
    ...record.actual,
    file: fileName,
    status: 'FAIL',
    failure: redact(error && error.message || error),
    networkRequests: report.fixtureRequests.length,
    pageErrors: report.pageErrors.length,
    consoleErrors: report.consoleErrors.length,
    consoleClass: consoleClass(),
  });
  save();
}
async function finish(current) {
  const unhandled = await current.page.evaluate(() => (window.__yxUnhandled || []).map(item => ({ errMsg: String(item.errMsg || '').slice(0, 180), route: String(item.route || '') }))).catch(() => []);
  if (unhandled.length) report.unhandledRejections.push(...unhandled);
  await current.context.close();
}
async function shoot(page, fileName, expected = {}) {
  const state = await page.evaluate(() => {
    const root = document.querySelector('.v2-login');
    const title = document.querySelector('#mobile-login-title');
    const fx = document.querySelector('.login-fx');
    return {
      href: location.href,
      hash: location.hash.split('?')[0],
      theme: document.documentElement.dataset.theme || null,
      pageTheme: root ? root.getAttribute('data-theme') : null,
      motion: root ? root.getAttribute('data-motion') : null,
      viewport: { width: innerWidth, height: innerHeight },
      dpr: window.devicePixelRatio,
      titleText: title ? title.textContent : '',
      titleFont: title ? getComputedStyle(title).fontSize : '',
      fxDisplay: fx ? getComputedStyle(fx).display : null,
      loginVisible: Boolean(root && title),
    };
  });
  if (expected.hash) assert.equal(state.hash, expected.hash, fileName);
  if (expected.theme) assert.equal(state.pageTheme || state.theme, expected.theme, fileName);
  if (expected.title) assert.equal(state.titleText, expected.title, fileName);
  if (expected.motion) assert.equal(state.motion, expected.motion, fileName);
  if (expected.fx) assert.equal(state.fxDisplay, expected.fx, fileName);
  if (expected.login) assert.equal(state.loginVisible, true, fileName);
  assert.equal(state.dpr, 1, `${fileName} dpr`);
  if (expected.width) assert.equal(state.viewport.width, expected.width, fileName);
  const unhandled = await page.evaluate(() => (window.__yxUnhandled || []).map(item => ({ errMsg: String(item.errMsg || '').slice(0, 180), route: String(item.route || '') })));
  report.shots.push({
    file: fileName,
    state,
    viewport: state.viewport,
    dpr: state.dpr,
    theme: state.pageTheme || state.theme,
    locale: expected.locale || null,
    sourceShaStart: report.sourceHashes['apps/mobile/src/pages/login/login.vue'],
    networkRequests: report.fixtureRequests.length,
    pageErrors: report.pageErrors.length,
    unhandled,
    consoleClass: consoleClass(),
  });
  await page.screenshot({ path: path.join(OUT, fileName), fullPage: true });
  save();
}
function svgRoot(file) {
  const text = fs.readFileSync(file, 'utf8');
  const start = text.indexOf('<svg');
  if (start < 0) return null;
  const tag = text.slice(start, text.indexOf('>', start));
  const attr = name => {
    const match = new RegExp(`${name}="([^"]*)"`).exec(tag);
    return match ? match[1] : null;
  };
  return { width: attr('width'), height: attr('height'), viewBox: attr('viewBox') };
}
function resolveStatic(src) {
  let pathname = src;
  try { pathname = new URL(src, BASE).pathname; } catch { return null; }
  const decoded = decodeURIComponent(pathname).replace(/^\/+/, '');
  return [path.join(ROOT, 'apps/mobile/src', decoded), path.join(ROOT, 'apps/mobile', decoded)].find(file => fs.existsSync(file) && fs.statSync(file).isFile()) || null;
}
async function recordVisibleSvgs(page, label) {
  const nodes = await page.evaluate(() => [...document.querySelectorAll('.figma-asset, img, image')].map(element => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      src: element.getAttribute('src') || '',
      slot: String(element.parentElement ? element.parentElement.className || '' : '').slice(0, 160),
      rendered: { width: rect.width, height: rect.height },
      css: { width: style.width, height: style.height },
      objectFit: style.objectFit,
      visible: rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none',
    };
  }));
  const rows = [];
  for (const node of nodes) {
    if (!node.visible || !node.src.toLowerCase().includes('.svg')) continue;
    const file = resolveStatic(node.src);
    const nonempty = Boolean(file && fs.statSync(file).size > 0);
    const root = file ? svgRoot(file) : null;
    const cssWidth = parseFloat(node.css.width);
    const cssHeight = parseFloat(node.css.height);
    const rootWidth = root ? parseFloat(root.width) : NaN;
    const rootHeight = root ? parseFloat(root.height) : NaN;
    const rootAspect = rootWidth > 0 && rootHeight > 0 ? rootWidth / rootHeight : null;
    const renderedAspect = node.rendered.width > 0 && node.rendered.height > 0 ? node.rendered.width / node.rendered.height : null;
    const distorted = node.objectFit === 'fill' && rootAspect && renderedAspect && Math.abs(rootAspect - renderedAspect) / rootAspect > 0.08;
    rows.push({
      label,
      src: node.src.split('?')[0],
      slot: node.slot,
      sha256: file ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') : null,
      nonempty,
      localFile: file ? path.relative(ROOT, file) : null,
      root,
      rendered: node.rendered,
      css: node.css,
      objectFit: node.objectFit,
      frameMatchesRendered: Math.abs(cssWidth - node.rendered.width) <= 1 && Math.abs(cssHeight - node.rendered.height) <= 1,
      distorted,
    });
    assert.ok(nonempty, `Visible SVG must be a local non-empty file: ${node.src}`);
    assert.ok(root, `Visible SVG needs a root tag: ${node.src}`);
    assert.equal(distorted, false, `Visible SVG root is stretched: ${node.slot}`);
  }
  report.visibleSvgs.push(...rows);
  return rows;
}
async function immediateInputCase(kind, activation) {
  const current = await newPage(), { page } = current;
  const observed = await page.evaluate(({ kind, activation }) => {
    let instance = document.querySelector('.v2-login').__vueParentComponent;
    while (instance && !('password' in instance.setupState)) instance = instance.parent;
    if (!instance) throw new Error('Login page state not found');
    const state = instance.setupState;
    const account = document.querySelector('#mobile-login-identifier');
    const password = document.querySelector('#mobile-login-password');
    const expectedAccount = 'ui-input-synthetic-account';
    const first = 'ui-input-synthetic-first';
    const expectedPassword = kind === 'clear' ? '' : kind === 'last-character' ? first + '-final' : 'ui-input-synthetic-replacement';
    const calls = [];
    // Failure probe only. This isolated stub returns false and must stay a
    // stale-input security check. Do not rewrite it into a success injection.
    // No request body, credential storage, token, or authenticated session is created.
    state.session.login = async (identifier, value) => {
      calls.push({ identifierMatches: identifier === expectedAccount, passwordMatchesLatest: value === expectedPassword });
      state.session.lastError = 'iam.credentials.invalid';
      return false;
    };
    account.value = expectedAccount;
    account.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    password.focus();
    const started = performance.now();
    password.value = first;
    password.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
    password.value = expectedPassword;
    password.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: kind === 'clear' ? 'deleteContentBackward' : 'insertText' }));
    const modelAlreadyCurrent = state.password === expectedPassword;
    if (activation === 'Enter') password.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }));
    else {
      password.blur();
      document.querySelector('.login-submit').click();
    }
    return { kind, activation, elapsedMs: performance.now() - started, modelAlreadyCurrent, calls };
  }, { kind, activation });
  assert.ok(observed.elapsedMs < 100, 'Exercise submission before uni model throttle can expire');
  assert.equal(observed.modelAlreadyCurrent, false, 'The reproduction must enter the stale model window');
  if (kind === 'clear') {
    assert.equal(observed.calls.length, 0, 'Cleared password must not reach login');
    await page.getByRole('alert').waitFor();
    await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
    assert.equal(await page.getByLabel('密码', { exact: true }).getAttribute('aria-invalid'), 'true');
    await shoot(page, `login-immediate-${kind}-${activation}.png`, { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  } else {
    assert.equal(observed.calls.length, 1);
    assert.ok(observed.calls.every(call => call.identifierMatches && call.passwordMatchesLatest), 'Login consumes the current event value');
    await page.getByRole('alert').waitFor();
  }
  assert.equal(current.count(), 0, 'Pure action stub must not reach IAM');
  (report.inputTiming ||= []).push(observed);
  save();
  await finish(current);
}
async function launchBrowser() {
  const candidates = [
    '/Users/Admin/Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Users/Admin/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    '/Users/Admin/Library/Caches/ms-playwright/chromium-1140/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  ];
  const attempts = [];
  for (const executablePath of candidates) {
    if (!fs.existsSync(executablePath)) {
      attempts.push({ executablePath, error: 'missing' });
      continue;
    }
    try {
      const launched = await chromium.launch({ headless: true, executablePath, args: ['--disable-gpu'] });
      report.browserLaunch = { executablePath, attempts };
      return launched;
    } catch (error) {
      attempts.push({ executablePath, error: redact(String(error && error.message || error)).slice(0, 300) });
    }
  }
  try {
    const launched = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-gpu'] });
    report.browserLaunch = { channel: 'chrome', attempts };
    return launched;
  } catch (error) {
    attempts.push({ channel: 'chrome', error: redact(String(error && error.message || error)).slice(0, 300) });
    report.browserLaunch = { attempts };
    throw error;
  }
}
(async () => {
  browser = await launchBrowser();
  for (const kind of ['clear', 'last-character', 'replacement']) {
    for (const activation of ['click', 'Enter']) await immediateInputCase(kind, activation);
  }
  report.checks.push('Six sub-100ms native input cases: clearing blocks login and focuses password; final character/replacement with click or Enter consumes the current event value; boolean-only isolated action stubs make zero IAM requests');
  for (const width of [320, 390, 768]) {
    for (const locale of ['zh-CN', 'en-US']) {
      for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
        const current = await newPage(width, theme, locale), { page } = current;
        const actual = await facts(page);
        const layoutRecord = await rememberLayout(page, `${width}/${locale}/${theme}`, actual);
        const layoutFile = `login-${width}-${locale}-${theme}.png`;
        try {
        assert.equal(await page.getByRole('heading', { name: labels[locale].title, exact: true }).count(), 1);
        assert.equal(await page.getByRole('heading').count(), 1, 'Only one main heading');
        assert.equal(await page.locator('.yx-card,.v2-login-brand,.mobile-page-header,.login-error').count(), 0, 'No decorative card, duplicate headline or idle status');
        assert.equal(actual.overflow, false, `${width}/${theme}/${locale}: overflow`);
        assert.ok(actual.contentWidth <= 420.1);
        assert.equal(actual.titleFont, '24px');
        assert.equal(actual.submitFont, '16px');
        assert.deepEqual(actual.inputFonts, ['16px', '16px']);
        assert.ok(actual.fieldGap >= 17.5 && actual.fieldGap <= 18.5, 'Account and password rows keep the 18px field gap');
        assert.equal(actual.privacyBeforeSubmit, true, 'Privacy note stays above the submit button');
        assert.ok(actual.privacyGap >= 17.5 && actual.privacyGap <= 18.5, 'Privacy note and submit keep the 18px form gap');
        assert.equal(await page.getByRole('button', { name: labels[locale].submit, exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: labels[locale].terms, exact: true }).count(), 1);
        assert.equal(await page.getByRole('button', { name: labels[locale].privacy, exact: true }).count(), 1);
        assert.equal(await page.locator('.login-adult-note').count(), 0);
        assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily));
        assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
        assert.ok(actual.titleContrast >= 4.5 && actual.descriptionContrast >= 4.5 && actual.submitContrast >= 4.5, 'Readable text in every theme');
        assert.equal(await page.locator('#mobile-login-identifier').getAttribute('autocomplete'), 'username');
        assert.equal(await page.locator('#mobile-login-password').getAttribute('autocomplete'), 'current-password');
        assert.equal(await page.getByLabel(labels[locale].password, { exact: true }).count(), 1);
        assert.equal(await page.locator('.login-form').getAttribute('aria-busy'), 'false');
        } catch (error) {
          await keepFailureShot(page, layoutFile, layoutRecord, error);
          throw error;
        }
        if (theme === 'system') {
          await page.emulateMedia({ colorScheme: 'dark' });
          await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
          await page.emulateMedia({ colorScheme: 'light' });
          await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        }
        if ((locale === 'zh-CN' && theme !== 'system') || (width === 390 && locale === 'en-US' && theme === 'light')) {
          await shoot(page, `login-${width}-${locale}-${theme}.png`, { hash: '#/pages/login/login', title: labels[locale].title, theme, width, locale, login: true });
        }
        report.matrix.push({ width, locale, requestedTheme: theme, ...actual, status: 'PASS' });
        save();
        await finish(current);
      }
    }
  }
  report.checks.push('24 isolated viewport/locale/theme combinations; system preference responds live; true inputs labelled and autocomplete intact');
  const current = await newPage(), { page } = current;
  const account = page.getByRole('textbox', { name: '账号', exact: true });
  const password = page.getByLabel('密码', { exact: true });
  const submit = page.getByRole('button', { name: '登录并继续', exact: true });
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-identifier');
  const focus = await account.evaluate(element => { const wrapper = element.closest('uni-input'); return { outline: getComputedStyle(wrapper).outlineStyle, width: getComputedStyle(wrapper).outlineWidth }; });
  assert.equal(focus.outline, 'solid');
  assert.ok(parseFloat(focus.width) >= 2);
  report.checks.push('Native input node receives visible focus; account and password rows keep the 18px gap and the privacy note stays above submit');
  await shoot(page, 'login-keyboard-focus.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  await submit.click();
  await page.getByRole('alert').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-identifier');
  assert.equal(await account.getAttribute('aria-invalid'), 'true');
  assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await account.getAttribute('aria-describedby'), 'mobile-login-error');
  assert.equal(current.count(), 0);
  await shoot(page, 'login-required-error.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  await account.fill('ui-login-synthetic');
  await password.focus();
  await page.waitForFunction(() => !document.querySelector('#mobile-login-identifier').hasAttribute('aria-invalid'));
  assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await password.getAttribute('aria-describedby'), 'mobile-login-error');
  await submit.click();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-login-password');
  assert.equal(await account.getAttribute('aria-invalid'), null);
  await password.fill('SyntheticOnly123');
  await page.waitForFunction(() => !document.querySelector('#mobile-login-error'));
  assert.equal(await password.getAttribute('aria-invalid'), null);
  assert.equal(await password.getAttribute('aria-describedby'), null);
  const passwordControls = await page.locator('.login-password-toggle').getAttribute('aria-controls');
  assert.equal(passwordControls, 'mobile-login-password');
  assert.equal(await page.locator('#' + passwordControls).count(), 1);
  // UI-locale adapter fixture: no auth/session state or storage is inspected.
  await page.evaluate(async () => {
    const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts');
    mobileI18nAdapter.setLocale('en-US');
  });
  await page.getByRole('textbox', { name: 'Account', exact: true }).waitFor();
  assert.equal(await page.getByLabel('Password', { exact: true }).getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.locator('#mobile-login-password').getAttribute('aria-label'), 'Password');
  await page.evaluate(async () => {
    const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts');
    mobileI18nAdapter.setLocale('zh-CN');
  });
  await account.waitFor();
  assert.equal(await password.getAttribute('autocomplete'), 'current-password');
  await account.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.activeElement.id === 'mobile-login-password');
  assert.equal(current.count(), 0, 'Account confirm moves to password without submitting');
  const show = page.getByRole('button', { name: '显示密码', exact: true });
  await show.focus();
  await page.keyboard.press('Enter');
  assert.equal(await password.getAttribute('type'), 'text');
  assert.equal(await password.getAttribute('aria-label'), '密码');
  assert.equal(await password.getAttribute('autocomplete'), 'current-password');
  assert.equal(await page.getByRole('button', { name: '隐藏密码', exact: true }).getAttribute('aria-pressed'), 'true');
  await page.keyboard.press('Space');
  assert.equal(await password.getAttribute('type'), 'password');
  current.hold();
  await password.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.equal(await password.isDisabled(), true);
  assert.equal(await account.isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: '显示密码', exact: true }).isDisabled(), true);
  for (const button of await page.locator('.login-text-button').all()) assert.equal(await button.isDisabled(), true);
  await page.locator('.login-submit').click({ force: true });
  await page.waitForTimeout(100);
  assert.equal(current.count(), 1);
  await shoot(page, 'login-busy.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  current.release();
  await page.locator('.login-form[aria-busy=false]').waitFor();
  await page.getByRole('alert').waitFor();
  assert.ok((await page.getByRole('alert').innerText()).includes('账号或密码'));
  assert.equal(await password.isEnabled(), true);
  assert.equal(await password.getAttribute('aria-invalid'), null, 'Server rejection must not pretend a field syntax error');
  await account.fill('ui-login-synthetic-edited');
  assert.equal(await page.getByRole('alert').count(), 1, 'Editing does not hide an unhandled server rejection');
  await password.fill('');
  await shoot(page, 'login-server-rejection.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  report.checks.push('Visible Tab focus; empty submit associates errors and focuses first missing input; account Enter goes to password');
  report.checks.push('Eye Enter/Space toggle preserves labels; password Enter submits; busy disables controls and prevents duplicate IAM request; rejection allows retry');
  report.checks.push('Typing/blur clear only resolved required errors; live locale-adapter change updates true input labels; eye controls point at the actual input');
  await finish(current);
  const delayed = await newPage();
  await delayed.page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-login-slow-synthetic');
  await delayed.page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
  delayed.hold();
  const firstValidSubmitTop = (await delayed.page.getByRole('button', { name: '登录并继续', exact: true }).boundingBox()).y;
  await delayed.page.getByRole('button', { name: '登录并继续', exact: true }).click();
  await delayed.page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  const firstValidBusyTop = (await delayed.page.locator('.login-submit').boundingBox()).y;
  assert.equal(firstValidBusyTop, firstValidSubmitTop, 'First valid submission adds no hidden feedback row or button movement');
  report.firstValidBusyGeometry = { beforeTop: firstValidSubmitTop, busyTop: firstValidBusyTop };
  await delayed.page.waitForTimeout(6000);
  assert.equal(await delayed.page.locator('.login-form').getAttribute('aria-busy'), 'true');
  assert.equal(await delayed.page.getByRole('alert').count(), 0);
  assert.equal(delayed.count(), 1);
  await shoot(delayed.page, 'login-delayed-busy.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  delayed.release();
  await delayed.page.getByRole('alert').waitFor();
  assert.equal(await delayed.page.locator('.login-form').getAttribute('aria-busy'), 'false');
  assert.equal(await delayed.page.getByLabel('密码', { exact: true }).getAttribute('autocomplete'), 'current-password');
  report.checks.push('Synthetic IAM rejection held for six seconds keeps busy truthful, sends one request and restores native input semantics after rejection');
  await finish(delayed);
  const sequential = await newPage(390, 'light', 'zh-CN', 844, 'two-stage-unavailable');
  await sequential.page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-login-two-stage-synthetic');
  await sequential.page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
  await sequential.page.getByRole('button', { name: '登录并继续', exact: true }).click();
  await sequential.page.waitForFunction(() => document.querySelector('.login-form').getAttribute('aria-busy') === 'true');
  assert.ok(sequential.latency().loginStarted > 0);
  await sequential.page.waitForTimeout(Math.max(0, 10050 - (Date.now() - sequential.latency().loginStarted)));
  assert.ok(sequential.latency().permissionStarted > sequential.latency().loginStarted);
  const observedAtMs = Date.now() - sequential.latency().loginStarted;
  assert.equal(await sequential.page.locator('.login-form').getAttribute('aria-busy'), 'true', 'Two individually bounded requests may remain pending beyond the old page deadline');
  assert.equal(await sequential.page.getByRole('alert').count(), 0, 'No premature ten-second failure');
  await sequential.page.getByRole('alert').waitFor();
  assert.equal(await sequential.page.locator('.login-form').getAttribute('aria-busy'), 'false');
  const finalMessage = await sequential.page.getByRole('alert').innerText();
  assert.ok(finalMessage.length > 0 && !/(账号或密码不正确|账号不存在|未注册)/.test(finalMessage), 'Permission outage keeps a neutral error');
  assert.equal(sequential.count(), 1);
  assert.equal(new URL(sequential.page.url()).hash.split('?')[0], '#/pages/login/login');
  report.twoStageDelay = { fixture: '5100ms login response then 5900ms principal/me 503; body not recorded; no real credential or authenticated session', observedAtMs, elapsedMs: Date.now() - sequential.latency().loginStarted, finalMessage };
  await shoot(sequential.page, 'login-two-stage-neutral-error.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'light', width: 390, locale: 'zh-CN', login: true });
  report.checks.push('Two-stage synthetic 5.1s + 5.9s principal lookup outage remains busy beyond ten seconds then shows neutral failure; no early page race');
  await finish(sequential);
  for (const locale of ['zh-CN', 'en-US']) {
    const enlarged = await newPage(390, 'light', locale);
    await enlarged.page.evaluate(() => {
      for (const element of document.querySelectorAll('.login-brand,.login-title,.login-description,.login-panel__title,.login-label,.login-input,.login-privacy,.login-submit,.login-text-button,.login-register,.login-legal__lead')) {
        element.style.fontSize = (parseFloat(getComputedStyle(element).fontSize) * 2) + 'px';
      }
    });
    const actual = await facts(enlarged.page);
    const layoutRecord = await rememberLayout(enlarged.page, `200/${locale}`, actual);
    try {
    assert.equal(actual.overflow, false, '200% text stays within viewport');
    assert.deepEqual(actual.inputFonts, ['32px', '32px']);
    assert.ok(actual.targets.every(target => target.height >= 44));
    const clipped = await enlarged.page.evaluate(() => [...document.querySelectorAll('.login-title,.login-description,.login-submit,.login-text-button,.login-privacy')].filter(element => {
      const style = getComputedStyle(element);
      return (style.overflow === 'hidden' || style.overflowY === 'hidden') && element.scrollHeight > element.clientHeight + 2;
    }).map(element => element.textContent.trim().slice(0, 40)));
    assert.deepEqual(clipped, [], '200% text is clipped');
    for (const selector of ['.login-submit', '.login-password-toggle', '.login-legal .login-text-button']) {
      const target = enlarged.page.locator(selector).first();
      await target.scrollIntoViewIfNeeded();
      assert.equal(await target.isVisible(), true, selector);
    }
    } catch (error) {
      await keepFailureShot(enlarged.page, `login-390-${locale}-text-200.png`, layoutRecord, error);
      throw error;
    }
    await shoot(enlarged.page, `login-390-${locale}-text-200.png`, { hash: '#/pages/login/login', title: labels[locale].title, theme: 'light', width: 390, locale, login: true });
    report.matrix.push({ width: 390, locale, requestedTheme: 'light', textScale: 2, ...actual, status: 'PASS' });
    await finish(enlarged);
  }
  const short = await newPage(320, 'light', 'en-US', 460);
  await short.page.locator('.login-register').scrollIntoViewIfNeeded();
  const shortActual = await facts(short.page);
  const shortRecord = await rememberLayout(short.page, '320/en-US/short', shortActual);
  try {
  assert.equal(await short.page.locator('.login-register').isVisible(), true);
  assert.equal(shortActual.overflow, false);
  } catch (error) {
    await keepFailureShot(short.page, 'login-320-english-short-viewport.png', shortRecord, error);
    throw error;
  }
  await shoot(short.page, 'login-320-english-short-viewport.png', { hash: '#/pages/login/login', title: 'Welcome back', theme: 'light', width: 320, locale: 'en-US', login: true });
  await finish(short);
  report.checks.push('Chinese/English 200% text and short viewport scroll checks; no physical OS soft-keyboard claim');
  for (const spec of [
    { width: 430, height: 932, locale: 'zh-CN', theme: 'light', file: 'login-430-zh-CN-light.png' },
    { width: 430, height: 932, locale: 'en-US', theme: 'light', file: 'login-430-en-US-light.png' },
    { width: 834, height: 1194, locale: 'zh-CN', theme: 'dark', file: 'login-ipad-834-zh-CN-dark.png' },
    { width: 834, height: 1194, locale: 'en-US', theme: 'light', file: 'login-ipad-834-en-US-light.png' },
  ]) {
    const current = await newPage(spec.width, spec.theme, spec.locale, spec.height);
    const actual = await facts(current.page);
    const layoutRecord = await rememberLayout(current.page, spec.file, actual);
    try {
    assert.equal(await current.page.getByRole('heading', { name: labels[spec.locale].title, exact: true }).count(), 1);
    assert.equal(actual.overflow, false, spec.file);
    assert.ok(actual.contentWidth <= 420.1, spec.file);
    assert.equal(actual.titleFont, '24px', spec.file);
    assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44), spec.file);
    } catch (error) {
      await keepFailureShot(current.page, spec.file, layoutRecord, error);
      throw error;
    }
    await shoot(current.page, spec.file, { hash: '#/pages/login/login', title: labels[spec.locale].title, theme: spec.theme, width: spec.width, locale: spec.locale, login: true });
    report.matrix.push({ width: spec.width, height: spec.height, locale: spec.locale, requestedTheme: spec.theme, device: spec.width === 834 ? 'ipad' : 'phone', ...actual, status: 'PASS' });
    await finish(current);
  }
  report.checks.push('430 and distinct iPad 834 layouts keep the 24px title, 390 column, and 44px targets');
  const references = {};
  for (const theme of ['light', 'dark']) {
    const current = await newPage(390, theme, 'zh-CN', 844, 'rejection', 'no-preference');
    const motion = await current.page.locator('.v2-login').getAttribute('data-motion');
    const fx = await current.page.locator('.login-fx').evaluate(element => getComputedStyle(element).display);
    report.referenceMotion = report.referenceMotion || {};
    report.referenceMotion[theme] = { motion, fx };
    assert.equal(motion, 'on', `${theme} reference motion`);
    assert.notEqual(fx, 'none', `${theme} reference decorations`);
    references[theme] = await recordVisibleSvgs(current.page, `reference-${theme}`);
    await shoot(current.page, `login-390-zh-CN-${theme}-reference.png`, { hash: '#/pages/login/login', title: '欢迎回来', theme, motion: 'on', width: 390, locale: 'zh-CN', login: true });
    await finish(current);
  }
  assert.ok(references.light.some(row => row.src.includes('/figma-login-98-1182/')), 'Light reference uses the light asset directory');
  assert.ok(references.dark.some(row => row.src.includes('/figma-login-dark-248-1391/')), 'Dark reference uses the original dark asset directory');
  assert.equal(references.light.some(row => row.src.includes('/figma-login-dark-248-1391/')), false);
  assert.equal(references.dark.some(row => row.src.includes('/figma-login-98-1182/')), false);
  const reduced = await newPage(390, 'dark', 'zh-CN', 844, 'rejection', 'reduce');
  const reducedMotion = await reduced.page.locator('.v2-login').getAttribute('data-motion');
  const reducedFx = await reduced.page.locator('.login-fx').evaluate(element => getComputedStyle(element).display);
  report.reducedMotion = { motion: reducedMotion, fx: reducedFx };
  assert.ok(reducedMotion === 'reduced' || reducedMotion === 'off', 'Reduced motion uses the existing motion attribute');
  assert.equal(reducedFx, 'none');
  await shoot(reduced.page, 'login-390-zh-CN-dark-reduced-motion.png', { hash: '#/pages/login/login', title: '欢迎回来', theme: 'dark', width: 390, locale: 'zh-CN', login: true });
  await finish(reduced);
  const contrast = await newPage(390, 'high-contrast', 'en-US');
  const contrastRows = await recordVisibleSvgs(contrast.page, 'high-contrast-en');
  assert.ok(contrastRows.some(row => row.src.includes('/figma-login-dark-248-1391/')), 'High contrast keeps the original dark assets');
  await shoot(contrast.page, 'login-390-en-US-high-contrast-assets.png', { hash: '#/pages/login/login', title: 'Welcome back', theme: 'high-contrast', width: 390, locale: 'en-US', login: true });
  await finish(contrast);
  report.checks.push('390 light/dark references show decorations and switch original dark assets; reduced motion hides decorations; high contrast keeps dark assets');
  const unknown = await newPage();
  const unknownStatus = await unknown.page.evaluate(async () => (await fetch('/api/v1/synthetic-ui-unknown')).status);
  assert.equal(unknownStatus, 404);
  await finish(unknown);
  report.checks.push('Unknown /api/v1 route returns 404. Login rejection stays 401 and the principal outage stays 503');
  const LEGAL_ORIGIN = 'http://127.0.0.1:18182';
  function parsedHttpUrl(value) {
    const href = typeof value === 'string' ? value : value && value.href;
    if (typeof href !== 'string' || !href) return null;
    try { return new URL(href); } catch { return null; }
  }
  function isDevLegalDocument(value) {
    const url = parsedHttpUrl(value);
    return Boolean(url && url.protocol === 'http:' && url.origin === LEGAL_ORIGIN && (url.pathname === '/terms' || url.pathname === '/privacy') && url.username === '' && url.password === '' && url.search === '' && url.hash === '');
  }
  function safeNavigation(request) {
    if (!request.isNavigationRequest()) return null;
    const url = parsedHttpUrl(request.url());
    if (!url || url.origin !== LEGAL_ORIGIN) return null;
    return { method: request.method(), protocol: url.protocol, origin: url.origin, path: url.pathname };
  }
  async function fulfillDevLegalTarget(route) {
    const request = route.request();
    if (request.method() !== 'GET' || !isDevLegalDocument(request.url())) {
      await route.abort();
      return;
    }
    const targetPath = new URL(request.url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html><head><meta charset="utf-8"><title>SYNTHETIC_LEGAL_TARGET</title></head><body><p>SYNTHETIC_LEGAL_TARGET ${targetPath}</p></body></html>`,
    });
  }
  async function openLegal(page, name, pathname) {
    const context = page.context();
    const observed = [];
    const onRequest = request => {
      const record = safeNavigation(request);
      if (record) observed.push(record);
    };
    // Exact dev legal routes and the context observer exist before the popup page event.
    await context.route(`${LEGAL_ORIGIN}/terms`, fulfillDevLegalTarget);
    await context.route(`${LEGAL_ORIGIN}/privacy`, fulfillDevLegalTarget);
    context.on('request', onRequest);
    const record = { name, expectedPath: pathname, requests: [], current: null, openerPresent: null, popupSeen: false, fixture: 'SYNTHETIC_LEGAL_TARGET', officialSiteService: 'NOT_RUN', kind: 'popup-dispatch-synthetic-target' };
    report.legalObservations.push(record);
    save();
    const popupPromise = page.waitForEvent('popup', { timeout: 8000 });
    try {
      await page.getByRole('button', { name, exact: true }).click();
      const popup = await popupPromise;
      record.popupSeen = true;
      await popup.waitForURL(url => {
        const parsed = parsedHttpUrl(url);
        return Boolean(parsed && parsed.origin === LEGAL_ORIGIN && parsed.pathname === pathname);
      }, { timeout: 8000 });
      const current = parsedHttpUrl(popup.url());
      record.current = current ? { protocol: current.protocol, origin: current.origin, path: current.pathname } : null;
      record.requests = observed.slice();
      record.openerPresent = await popup.evaluate(() => window.opener !== null).catch(() => null);
      record.noopenerIsolated = record.openerPresent === false;
      const opener = parsedHttpUrl(page.url());
      record.opener = opener ? { origin: opener.origin, hashPath: opener.hash.split('?')[0] } : null;
      save();
      await popup.close().catch(() => {});
    } catch (error) {
      record.requests = observed.slice();
      record.error = redact(error.message || error);
      save();
      throw error;
    } finally {
      context.off('request', onRequest);
      await context.unroute(`${LEGAL_ORIGIN}/terms`, fulfillDevLegalTarget).catch(() => {});
      await context.unroute(`${LEGAL_ORIGIN}/privacy`, fulfillDevLegalTarget).catch(() => {});
    }
    return record;
  }
  const legal = await newPage();
  const legalResults = [await openLegal(legal.page, '用户协议', '/terms'), await openLegal(legal.page, '隐私政策', '/privacy')];
  for (const item of legalResults) {
    assert.equal(item.popupSeen, true, `${item.name} opens a real popup`);
    assert.equal(item.noopenerIsolated, true, `${item.name} popup keeps noopener isolation`);
    assert.equal(item.current && item.current.origin, LEGAL_ORIGIN, `${item.name} committed origin`);
    assert.equal(item.current && item.current.path, item.expectedPath, `${item.name} committed path`);
    assert.equal(item.requests[0] && item.requests[0].method, 'GET', `${item.name} first document method`);
    assert.equal(item.requests[0] && item.requests[0].protocol, 'http:', `${item.name} first document protocol`);
    assert.equal(item.requests[0] && item.requests[0].origin, LEGAL_ORIGIN, `${item.name} first document origin`);
    assert.equal(item.requests[0] && item.requests[0].path, item.expectedPath, `${item.name} first document path`);
    assert.ok(item.requests.every(entry => entry.origin === LEGAL_ORIGIN && (entry.path === '/terms' || entry.path === '/privacy')), `${item.name} observed only the dev legal documents`);
    assert.equal(item.opener && item.opener.origin, BASE, `${item.name} leaves the mobile page in place`);
    assert.equal(item.opener && item.opener.hashPath, '#/pages/login/login', `${item.name} leaves the login route in place`);
  }
  assert.equal(new URL(legal.page.url()).origin, BASE);
  assert.equal(new URL(legal.page.url()).hash.split('?')[0], '#/pages/login/login');
  report.legalPopups = legalResults.map(item => ({ name: item.name, kind: item.kind, fixture: item.fixture, current: item.current, requests: item.requests, openerPresent: item.openerPresent, officialSiteService: 'NOT_RUN' }));
  report.checks.push('Terms and privacy dispatch a real noopener popup. The first document is the dev legal origin served by SYNTHETIC_LEGAL_TARGET. Official site content is NOT_RUN');
  await finish(legal);
  async function submitAdult(current) {
    await current.page.getByRole('textbox', { name: '账号', exact: true }).fill('ui-login-synthetic-adult');
    await current.page.getByLabel('密码', { exact: true }).fill('SyntheticOnly123');
    await current.page.getByRole('button', { name: '登录并继续', exact: true }).click();
  }
  const unsafe = await newPage(390, 'light', 'zh-CN', 844, 'adult-gate', 'reduce', 'https://evil.example/phish');
  await submitAdult(unsafe);
  await unsafe.page.waitForFunction(() => location.hash.split('?')[0] === '#/pages/onboarding/onboarding', null, { timeout: 15000 });
  assert.equal(new URL(unsafe.page.url()).origin, BASE);
  assert.equal(unsafe.page.url().includes('evil.example'), false, 'Unsafe returnTo stays inside the app');
  assert.equal(unsafe.count(), 1);
  await shoot(unsafe.page, 'login-adult-gate-onboarding.png', { hash: '#/pages/onboarding/onboarding', width: 390 });
  await finish(unsafe);
  const safeReturn = await newPage(390, 'light', 'zh-CN', 844, 'adult-gate', 'reduce', '/pages/register/register');
  await submitAdult(safeReturn);
  await safeReturn.page.waitForFunction(() => location.hash.split('?')[0] === '#/pages/register/register', null, { timeout: 15000 });
  assert.equal(new URL(safeReturn.page.url()).origin, BASE);
  assert.equal(safeReturn.count(), 1);
  await shoot(safeReturn.page, 'login-safe-return-register.png', { hash: '#/pages/register/register', width: 390 });
  await finish(safeReturn);
  report.checks.push('Synthetic adult gate REQUIRED follows the existing gate: unsafe returnTo reaches onboarding, and a safe public returnTo stays on that internal route. No setupState success injection');
  report.notRun = ['Official site http://127.0.0.1:18182 live document and content; the popup target is SYNTHETIC_LEGAL_TARGET only', 'Native openURL capability; node public-documents tests still cover the missing-capability failure', 'Closed, games, and social page UI in this tree'];
  assert.equal(report.pageErrors.length, 0);
  const unexpectedConsole = report.consoleAll.filter(entry => entry.type === 'error' && !/401|404|503/.test(entry.text));
  report.consoleClassification = { counts: consoleClass(), unexpectedErrors: unexpectedConsole, note: 'Fixture 401, 404, and 503 may be logged. Other console errors fail. The console is not claimed clean.' };
  assert.deepEqual(unexpectedConsole, [], 'Unexpected console errors');
  report.sourceHashesEnd = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
  report.sourceHashDrift = sources.filter(file => report.sourceHashesEnd[file] !== report.sourceHashes[file]);
  report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE';
  save();
  console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks.length, shots: report.shots.length, visibleSvgs: report.visibleSvgs.length, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, unhandled: report.unhandledRejections.length, output: OUT }, null, 2));
})().catch(error => {
  report.status = 'FAIL'; report.failure = redact(error.stack || error); save(); console.error(redact(error.stack || error)); process.exitCode = 1;
}).finally(async () => {
  for (const resolve of pending) resolve();
  await browser?.close();
});
