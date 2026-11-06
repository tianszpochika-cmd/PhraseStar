// Formal Mobile H5 registration UI. Every API request is intercepted.
// No real accounts; never inspect auth storage, cookies, bodies or headers.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '../../..');
const BASE = 'http://127.0.0.1:18183';
const OUT = path.resolve(ROOT, process.env.UI_AUDIT_OUTPUT || '.git/codex-local-backups/mobile-register-' + Date.now());
fs.mkdirSync(OUT, { recursive: true });
const report = { scope: 'MOBILE_REGISTER_H5_UI_ONLY_SYNTHETIC_FIXTURES', at: new Date().toISOString(), browserPlugin: 'unavailable; Playwright Chromium', matrix: [], layoutDiagnostics: [], fieldIconChecks: [], legalObservations: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [], notRun: ['Official site http://127.0.0.1:18182 live document and content; the popup target is SYNTHETIC_LEGAL_TARGET only', 'Separate dark decoration frame. Dark and high contrast still hide the light-only FX'] };
const sources = ['apps/mobile/src/pages/register/register.vue', 'apps/mobile/src/theme/v2-tokens.scss', 'apps/mobile/src/theme/v2-icons.ts', 'apps/mobile/src/uni.scss', 'apps/mobile/src/platform/v2-foundation.ts', 'apps/mobile/src/platform/pointer-feedback.ts', 'packages/i18n/src/mobile-experience.ts', 'apps/mobile/src/auth/gateway-auth.ts', 'apps/mobile/src/auth/auth-failure-copy.ts', 'apps/mobile/src/stores/session.ts', 'apps/mobile/tests/ui-register.e2e.cjs'];
report.sourceHashes = Object.fromEntries(sources.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')]));
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { account: '账号', password: '密码', confirm: '确认密码', title: '创建账号', submit: '注册并继续', signin: '返回登录', terms: '用户协议', privacy: '隐私政策', show: '显示密码', hide: '隐藏密码', showConfirm: '显示确认密码', hideConfirm: '隐藏确认密码' },
  'en-US': { account: 'Account', password: 'Password', confirm: 'Confirm password', title: 'Create account', submit: 'Register and continue', signin: 'Back to sign in', terms: 'Terms', privacy: 'Privacy policy', show: 'Show password', hide: 'Hide password', showConfirm: 'Show confirmation password', hideConfirm: 'Hide confirmation password' },
};
let browser;
let lastPage = null;
const pending = new Set();
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', height = 844, scenario = 'conflict', returnQuery = '', motion = 'show') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference' });
  let held = false, release, count = 0;
  await context.route('**/api/v1/**', async route => {
    const request = route.request(), url = new URL(request.url());
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (request.method() === 'POST' && url.pathname === '/api/v1/auth/register') {
      assert.equal(url.protocol, 'https:', 'Password request stays on IAM TLS');
      count++;
      if (held) await new Promise(resolve => { release = resolve; pending.add(resolve); });
      if (scenario === 'adult-required') {
        // Invalid dummy credential is only accepted by intercepted UI fixtures.
        // No response body, auth header or token is logged or persisted by this test.
        await route.fulfill({ status: 200, headers, body: JSON.stringify({ accessToken: 'ui-synthetic-not-a-valid-credential', adultGate: 'REQUIRED' }) });
        return;
      }
      const failure = scenario === 'rate-limit' ? { status: 429, code: 'RATE_LIMITED' } : scenario === 'unavailable' ? { status: 503, code: 'SERVICE_UNAVAILABLE' } : { status: 409, code: 'iam.account.already_exists' };
      await route.fulfill({ status: failure.status, headers, body: JSON.stringify({ code: failure.code, message: 'Synthetic registration failure' }) });
      return;
    }
    if (request.method() === 'GET' && url.pathname === '/api/v1/iam/principal/me' && scenario === 'adult-required') {
      await route.fulfill({ status: 200, headers, body: JSON.stringify({ principal: { subject: 'ui-registration-synthetic', roles: [], permissions: [], adultGate: 'REQUIRED' }, roles: [], permissions: [], adultGate: 'REQUIRED' }) });
      return;
    }
    await route.fulfill({ status: 404, headers, body: JSON.stringify({ code: 'NOT_FOUND', message: 'Synthetic unknown route' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/register/register?theme=${theme}&uiLocale=${locale}${returnQuery}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-register-title').waitFor();
  await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  return { context, page, hold: () => { held = true; }, release: () => { if (release) { pending.delete(release); release(); } }, count: () => count };
}
async function facts(page) {
  return page.evaluate(() => {
    const background = element => {
      for (let current = element; current; current = current.parentElement) {
        const value = getComputedStyle(current).backgroundColor;
        if (value !== 'rgba(0, 0, 0, 0)' && value !== 'transparent') return value;
      }
      return 'rgb(255, 255, 255)';
    };
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => { const n = value / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0);
    const contrast = element => { const a = luminance(getComputedStyle(element).color), b = luminance(background(element)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const root = document.querySelector('.v2-register'), title = document.querySelector('.register-title'), submit = document.querySelector('.register-submit');
    const fields = [...document.querySelector('.register-fields').children].filter(element => element.classList.contains('register-field')).map(element => element.getBoundingClientRect());
    const audience = document.querySelector('.register-audience');
    return {
      url: location.href, title: document.title, theme: document.documentElement.dataset.theme,
      motion: root.getAttribute('data-motion'), fx: getComputedStyle(document.querySelector('.register-fx')).display,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      contentWidth: document.querySelector('.register-column').getBoundingClientRect().width,
      titleFont: getComputedStyle(title).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      audienceFont: getComputedStyle(audience).fontSize,
      panelFont: getComputedStyle(document.querySelector('.register-panel__title')).fontSize,
      titleContrast: contrast(title), audienceContrast: contrast(audience), hintContrast: contrast(document.querySelector('.register-password-hint')),
      submitFont: getComputedStyle(submit).fontSize, submitContrast: contrast(submit), submitTop: submit.getBoundingClientRect().top,
      bodyGap: getComputedStyle(document.querySelector('.register-form__body')).gap,
      inputFonts: [...document.querySelectorAll('.register-input input')].map(element => getComputedStyle(element).fontSize),
      fieldGaps: [fields[1].top - fields[0].bottom, fields[2].top - fields[1].bottom],
      submitBelowFields: submit.getBoundingClientRect().top >= fields[2].bottom - 0.5,
      targets: [...document.querySelectorAll('.register-password-toggle,.register-text-button,.register-submit')].map(element => { const r = element.getBoundingClientRect(); return { label: element.getAttribute('aria-label') || element.textContent.trim(), width: r.width, height: r.height }; }),
    };
  });
}
const REGISTER_ASSETS = {
  '4f1867c9-6a7e-489a-b45e-af8fb3387e68.svg': { count: 1, slot: [630, 615], natural: [630, 615], sha256: '1b6fc6c1c0722c94e96dcf84230e335d6367320f566186233e12a7c33ccaaf94' },
  'f7b499cc-fd9c-4bee-81ce-5b57d696273a.svg': { count: 1, slot: [320, 320], natural: [320, 320], sha256: '78b5db16ebeda74266c645d96b011a671541d8cb59cd58441e2832c6a4536985' },
  'f29df247-3aff-43a8-8a3d-b680bc23c3ae.svg': { count: 1, slot: [400, 400], natural: [400, 400], sha256: '0100771405921168c0744889ec38151ce87f15704eab75bf868a2abff79cd24d' },
  'd032a755-ad2f-4d83-87ae-80c7aa616f58.svg': { count: 1, slot: [440, 440], natural: [440, 440], sha256: '5f04a5eae394d4e72aa0b7f70af8b5f15392ae7a511193b015f08e045a2614a6' },
  'bd178784-7408-4045-8893-5b82830e0c42.svg': { count: 1, slot: [180, 140], natural: [180, 140], sha256: 'd9f012e3939a45ae98469bec747a22595d6e02576ab2f9e41dcfb7a0f1858c08' },
  'cda03eb9-6976-4787-9637-6ffe089f9949.svg': { count: 1, slot: [88, 88], natural: [88, 88], sha256: '13296cd5eb4abd53b21f4c68d296159ad796a327377d04ec3a648905161e3db5' },
  '02775667-c477-47ad-8c16-e40ab684d37d.png': { count: 1, slot: [54, 54], natural: [512, 512], sha256: '7ddbe6d5fda3398113bdad40bb75170b03c7d003be7d1f7abb44fcbeef014be2' },
  '5994b664-5600-4a49-85dc-1ae42b4fb6d1.svg': { count: 1, slot: [20, 20], natural: [20, 20], sha256: '556b91f750b403987c0f58233df50fdafff2b943b08ea0482fc0080102fbac14' },
  'a294dcef-2313-4614-a958-99fce5503507.svg': { count: 2, slot: [20, 20], natural: [20, 20], sha256: '184bcbfb04190803cabbfd5ee27b19ddc9b327ce547385a22db68c765988d197' },
  '2bc6b8cc-1111-461e-974a-a1acbdfe4c31.svg': { count: 2, slot: [20, 20], natural: [24, 24], sha256: '11d13fe935a8c2e78bb0f5f5c4f3eb97c6a1c0d4f00ab6c60de1b0d3c3666c6d' },
};
async function readNativeAssets(page) {
  // uni-image root getAttribute('src') is null. The file and its decode live on the nested img.
  return page.evaluate(async () => {
    const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');
    const rows = [];
    for (const element of document.querySelectorAll('.figma-asset')) {
      const img = element.querySelector('img');
      const rect = element.getBoundingClientRect();
      const currentSrc = img && img.currentSrc ? img.currentSrc : '';
      let pathname = '';
      let sourceSha256 = '';
      let sourceStatus = 0;
      if (img && img.decode) await img.decode().catch(() => {});
      if (currentSrc) {
        const parsed = new URL(currentSrc, location.href);
        pathname = parsed.pathname;
        const response = await fetch(currentSrc);
        sourceStatus = response.status;
        if (response.ok) sourceSha256 = hex(await crypto.subtle.digest('SHA-256', await response.arrayBuffer()));
      }
      rows.push({
        file: pathname.split('/').pop() || '',
        pathname,
        rootSrc: element.getAttribute('src'),
        slotWidth: rect.width,
        slotHeight: rect.height,
        naturalWidth: img ? img.naturalWidth : 0,
        naturalHeight: img ? img.naturalHeight : 0,
        decoded: Boolean(img && img.complete && img.naturalWidth > 0),
        sourceStatus,
        sourceSha256,
      });
    }
    return rows;
  });
}
function assertRegisterAssets(assets) {
  assert.equal(assets.length, 12, 'Light 390 shows twelve instances of the ten original files');
  const counts = {};
  for (const asset of assets) {
    assert.match(asset.pathname, /^\/static\/figma-register-98-2169\/[^/]+$/);
    const spec = REGISTER_ASSETS[asset.file];
    assert.ok(spec, asset.pathname || asset.file);
    assert.equal(asset.sourceStatus, 200, asset.file);
    assert.equal(asset.sourceSha256, spec.sha256, asset.file);
    assert.equal(asset.naturalWidth, spec.natural[0], `${asset.file} natural width`);
    assert.equal(asset.naturalHeight, spec.natural[1], `${asset.file} natural height`);
    assert.ok(Math.abs(asset.slotWidth - spec.slot[0]) <= 1 && Math.abs(asset.slotHeight - spec.slot[1]) <= 1, `${asset.file} slot ${asset.slotWidth}x${asset.slotHeight}`);
    assert.equal(asset.decoded, true, asset.file);
    counts[asset.file] = (counts[asset.file] || 0) + 1;
  }
  const expectedFiles = Object.keys(REGISTER_ASSETS).sort();
  assert.deepEqual(Object.keys(counts).sort(), expectedFiles);
  for (const file of expectedFiles) assert.equal(counts[file], REGISTER_ASSETS[file].count, file);
  assert.equal(counts['a294dcef-2313-4614-a958-99fce5503507.svg'], 2, 'lock appears twice');
  assert.equal(counts['2bc6b8cc-1111-461e-974a-a1acbdfe4c31.svg'], 2, 'eye appears twice');
}
const LIGHT_FIELD_FILES = {
  user: '5994b664-5600-4a49-85dc-1ae42b4fb6d1.svg',
  lock: 'a294dcef-2313-4614-a958-99fce5503507.svg',
  eye: '2bc6b8cc-1111-461e-974a-a1acbdfe4c31.svg',
};
const DARK_ICON_ROOT = '/static/figma-login-dark-248-1391/';
const DARK_FIELD_ICONS = {
  user: { file: '003efa13-eff2-4c8e-9eda-2238d6117c21.svg', count: 1, slot: [20, 20], natural: [20, 20], sha256: '6010f361747a10d88ed7d9e28589043a38f3fa8b1718da1f2ba50a1a67c3f6ef', pigment: '#BAB8CF' },
  lock: { file: 'eb84fb33-631b-48b5-ae4f-6b2c957e14c5.svg', count: 2, slot: [20, 20], natural: [20, 20], sha256: 'f1bad49af8a526ef41ed6da76c0899a080772b126b3c647766b9a8cc3fd34a0d', pigment: '#BAB8CF' },
  eye: { file: '97c4b589-54f5-4111-8972-f5882100ee73.svg', count: 2, slot: [20, 20], natural: [20, 20], sha256: '77daf676a1ce57a9e521a5bea211829b2d1c40aeab7a5e530c31a375e4f149bc', pigment: '#BCABFF' },
};
const DECORATIVE_FILES = [
  '4f1867c9-6a7e-489a-b45e-af8fb3387e68.svg',
  'f7b499cc-fd9c-4bee-81ce-5b57d696273a.svg',
  'f29df247-3aff-43a8-8a3d-b680bc23c3ae.svg',
  'd032a755-ad2f-4d83-87ae-80c7aa616f58.svg',
  'bd178784-7408-4045-8893-5b82830e0c42.svg',
  'cda03eb9-6976-4787-9637-6ffe089f9949.svg',
  '02775667-c477-47ad-8c16-e40ab684d37d.png',
];
function fieldIconSpec(theme) {
  if (theme === 'light') {
    return {
      user: { file: LIGHT_FIELD_FILES.user, root: '/static/figma-register-98-2169/', pigment: '#606277', ...REGISTER_ASSETS[LIGHT_FIELD_FILES.user] },
      lock: { file: LIGHT_FIELD_FILES.lock, root: '/static/figma-register-98-2169/', pigment: '#606277', ...REGISTER_ASSETS[LIGHT_FIELD_FILES.lock] },
      eye: { file: LIGHT_FIELD_FILES.eye, root: '/static/figma-register-98-2169/', pigment: '#1C1633', ...REGISTER_ASSETS[LIGHT_FIELD_FILES.eye] },
    };
  }
  return Object.fromEntries(Object.entries(DARK_FIELD_ICONS).map(([role, spec]) => [role, { ...spec, root: DARK_ICON_ROOT }]));
}
async function readFieldIcons(page) {
  // uni-image paints the direct child div background. The nested img stays at opacity 0 and is still the byte source.
  return page.evaluate(async () => {
    const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');
    const parseColor = value => {
      const nums = String(value || '').match(/[\d.]+/g);
      if (!nums || nums.length < 3) return null;
      return { r: Number(nums[0]), g: Number(nums[1]), b: Number(nums[2]), a: nums.length > 3 ? Number(nums[3]) : 1 };
    };
    const composite = (fg, bg) => {
      const a = fg.a + bg.a * (1 - fg.a);
      const mix = (front, back) => a === 0 ? 0 : (front * fg.a + back * bg.a * (1 - fg.a)) / a;
      return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a };
    };
    const luminance = color => [color.r, color.g, color.b].map(value => { const n = value / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }).reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (fg, bg) => { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const paintedBackground = element => {
      const layers = [];
      for (let current = element; current; current = current.parentElement) {
        const color = parseColor(getComputedStyle(current).backgroundColor);
        if (!color || color.a <= 0) continue;
        layers.push(color);
        if (color.a >= 0.999) break;
      }
      if (!layers.length) return { r: 255, g: 255, b: 255 };
      let acc = layers[layers.length - 1];
      acc = acc.a >= 0.999 ? { r: acc.r, g: acc.g, b: acc.b, a: 1 } : composite(acc, { r: 255, g: 255, b: 255, a: 1 });
      for (let index = layers.length - 2; index >= 0; index -= 1) acc = composite(layers[index], acc);
      return { r: Math.round(acc.r), g: Math.round(acc.g), b: Math.round(acc.b) };
    };
    const rows = [];
    for (const control of document.querySelectorAll('.register-control')) {
      for (const element of control.querySelectorAll('.figma-asset')) {
        const img = element.querySelector('img');
        const painted = element.querySelector(':scope > div');
        const role = element.closest('.register-password-toggle') ? 'eye' : control.classList.contains('register-control--secret') ? 'lock' : 'user';
        const rect = element.getBoundingClientRect();
        const currentSrc = img && img.currentSrc ? img.currentSrc : '';
        const paintedImage = painted ? getComputedStyle(painted).backgroundImage : '';
        let pathname = '';
        let sourceSha256 = '';
        let sourceStatus = 0;
        let pigments = [];
        if (img && img.decode) await img.decode().catch(() => {});
        if (currentSrc) {
          pathname = new URL(currentSrc, location.href).pathname;
          const response = await fetch(currentSrc);
          sourceStatus = response.status;
          if (response.ok) {
            const bytes = await response.arrayBuffer();
            const copy = bytes.slice(0);
            sourceSha256 = hex(await crypto.subtle.digest('SHA-256', bytes));
            pigments = [...new TextDecoder().decode(copy).matchAll(/fill=["']#([0-9A-Fa-f]{6})["']/g)].map(match => `#${match[1].toUpperCase()}`);
          }
        }
        const rawBackground = getComputedStyle(control).backgroundColor;
        const own = parseColor(rawBackground);
        const paintedRgb = paintedBackground(control);
        const fg = pigments[0] ? { r: parseInt(pigments[0].slice(1, 3), 16), g: parseInt(pigments[0].slice(3, 5), 16), b: parseInt(pigments[0].slice(5, 7), 16) } : null;
        rows.push({
          role,
          file: pathname.split('/').pop() || '',
          pathname,
          paintedImage,
          imgOpacity: img ? getComputedStyle(img).opacity : '',
          assetOpacity: getComputedStyle(element).opacity,
          assetFilter: getComputedStyle(element).filter,
          paintedFilter: painted ? getComputedStyle(painted).filter : '',
          slotWidth: rect.width,
          slotHeight: rect.height,
          naturalWidth: img ? img.naturalWidth : 0,
          naturalHeight: img ? img.naturalHeight : 0,
          decoded: Boolean(img && img.complete && img.naturalWidth > 0),
          sourceStatus,
          sourceSha256,
          pigments,
          rawBackground,
          paintedBackground: paintedRgb,
          contrastOnPainted: fg ? contrast(fg, paintedRgb) : 0,
          contrastOnComputedRgb: fg && own ? contrast(fg, own) : 0,
        });
      }
    }
    return rows;
  });
}
function assertFieldIcons(rows, theme) {
  const specs = fieldIconSpec(theme);
  assert.equal(rows.length, 5, `${theme} shows user, two locks and two eyes`);
  const counts = {};
  for (const row of rows) {
    const spec = specs[row.role];
    assert.ok(spec, row.role);
    assert.equal(row.file, spec.file, row.role);
    assert.equal(row.pathname, `${spec.root}${spec.file}`, row.role);
    assert.ok(row.paintedImage.includes(spec.file), `${row.role} painted background ${row.paintedImage}`);
    assert.equal(row.sourceStatus, 200, row.role);
    assert.equal(row.sourceSha256, spec.sha256, row.role);
    assert.deepEqual(row.pigments, [spec.pigment], `${row.role} file pigment`);
    assert.equal(row.naturalWidth, spec.natural[0], `${row.role} natural width`);
    assert.equal(row.naturalHeight, spec.natural[1], `${row.role} natural height`);
    assert.ok(Math.abs(row.slotWidth - spec.slot[0]) <= 1 && Math.abs(row.slotHeight - spec.slot[1]) <= 1, `${row.role} slot ${row.slotWidth}x${row.slotHeight}`);
    assert.equal(row.decoded, true, row.role);
    assert.equal(row.imgOpacity, '0', 'nested img opacity 0 is uni-image paint, not a missing icon');
    assert.equal(row.assetOpacity, '1', row.role);
    assert.equal(row.assetFilter, 'none', row.role);
    assert.equal(row.paintedFilter, 'none', row.role);
    if (theme !== 'light') {
      assert.ok(row.contrastOnPainted >= 3, `${row.role} painted contrast ${row.contrastOnPainted} on ${JSON.stringify(row.paintedBackground)}`);
      assert.ok(row.contrastOnComputedRgb >= 3, `${row.role} computed contrast ${row.contrastOnComputedRgb} on ${row.rawBackground}`);
    }
    counts[row.role] = (counts[row.role] || 0) + 1;
  }
  assert.equal(counts.user, 1);
  assert.equal(counts.lock, 2);
  assert.equal(counts.eye, 2);
}
function assertDarkThemeAssets(assets) {
  assert.equal(assets.length, 12, 'Dark and high contrast keep twelve instances without using the light icon files');
  const counts = {};
  for (const asset of assets) {
    counts[asset.file] = (counts[asset.file] || 0) + 1;
    if (DECORATIVE_FILES.includes(asset.file)) {
      assert.equal(asset.pathname, `/static/figma-register-98-2169/${asset.file}`);
      assert.equal(asset.sourceStatus, 200, asset.file);
      assert.equal(asset.sourceSha256, REGISTER_ASSETS[asset.file].sha256, asset.file);
    }
  }
  for (const file of DECORATIVE_FILES) assert.equal(counts[file], REGISTER_ASSETS[file].count, file);
  for (const file of Object.values(LIGHT_FIELD_FILES)) assert.equal(counts[file] || 0, 0, `${file} is the light theme file`);
  for (const spec of Object.values(DARK_FIELD_ICONS)) assert.equal(counts[spec.file], spec.count, spec.file);
  assert.equal(Object.keys(counts).length, 10, 'seven register decorations plus three dark icons');
}
async function waitForPaintedIcon(page, file) {
  await page.waitForFunction(expected => {
    const asset = document.querySelector('.register-password-toggle .figma-asset');
    const img = asset && asset.querySelector('img');
    const painted = asset && asset.querySelector(':scope > div');
    const image = painted ? getComputedStyle(painted).backgroundImage : '';
    return Boolean(img && img.currentSrc.includes(expected) && image.includes(expected));
  }, file);
}
async function keepVisual(label, payload) {
  report.layoutDiagnostics.push({ label, ...payload, at: new Date().toISOString() });
  save();
}
async function shotOnFail(page, name, work) {
  try { return await work(); }
  catch (error) {
    await page.screenshot({ path: path.join(OUT, name), fullPage: true }).catch(() => {});
    report.failureShot = name;
    save();
    throw error;
  }
}
async function nativeSemantics(page, locale = 'zh-CN', invalid = []) {
  const names = ['identifier', 'password', 'confirm'];
  for (const [index, kind] of names.entries()) {
    const input = page.locator(`#mobile-register-${kind}`);
    assert.equal(await input.getAttribute('name'), kind);
    assert.equal(await input.getAttribute('maxlength'), '-1', 'Preserve the full entry for explicit contract validation');
    assert.equal(await input.getAttribute('minlength'), kind === 'identifier' ? '3' : kind === 'password' ? '12' : null);
    assert.equal(await input.getAttribute('autocomplete'), index ? 'new-password' : 'username');
    assert.equal(await input.getAttribute('aria-labelledby'), `mobile-register-${kind}-label`);
    assert.equal(await input.getAttribute('aria-label'), labels[locale][index ? kind : 'account']);
    assert.equal(await input.getAttribute('aria-invalid'), invalid.includes(kind) ? 'true' : null);
    const description = [kind === 'password' ? 'mobile-register-password-hint' : null, invalid.includes(kind) ? `mobile-register-${kind}-error` : null].filter(Boolean).join(' ') || null;
    assert.equal(await input.getAttribute('aria-describedby'), description);
  }
}
async function fillValid(page) {
  await page.locator('#mobile-register-identifier').fill('ui-register-synthetic');
  await page.locator('#mobile-register-password').fill('SyntheticOnly123');
  await page.locator('#mobile-register-confirm').fill('SyntheticOnly123');
}
(async () => {
  browser = await chromium.launch();
  for (const width of [320, 390, 430, 768, 834, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) {
    const height = width === 834 ? 1194 : 844;
    const current = await newPage(width, theme, locale, height), { page } = current;
    lastPage = page;
    await shotOnFail(page, `register-fail-${width}-${locale}-${theme}.png`, async () => {
      const assetCell = width === 390 && locale === 'zh-CN' && theme === 'light';
      const iconCell = width === 390 && locale === 'zh-CN' && (theme === 'dark' || theme === 'high-contrast');
      let actual = null;
      let assets = null;
      let fieldIcons = null;
      let observationError = null;
      try { actual = await facts(page); }
      catch (error) { observationError = error; }
      if (!observationError && (assetCell || iconCell)) {
        try { assets = await readNativeAssets(page); }
        catch (error) { observationError = error; }
      }
      if (!observationError && iconCell) {
        try { fieldIcons = await readFieldIcons(page); }
        catch (error) { observationError = error; }
      }
      await keepVisual(`${width}-${locale}-${theme}`, {
        viewport: { width, height },
        theme: { requested: theme, resolved: actual && actual.theme },
        sourceSHA: report.sourceHashes['apps/mobile/src/pages/register/register.vue'],
        actual,
        assets,
        fieldIcons,
      });
      if (observationError) throw observationError;
      assert.equal(await page.getByRole('heading', { name: labels[locale].title, exact: true }).count(), 1);
      assert.equal(await page.getByRole('heading').count(), 1);
      assert.equal(await page.locator('.yx-card,.mobile-page-header,.v2-register-brand,.register-field-error,.register-server-error,[role=status],vite-error-overlay').count(), 0, 'No decorative card, duplicated hero, idle error/status or framework overlay');
      assert.equal(actual.overflow, false, `${width}/${locale}/${theme}`);
      assert.ok(actual.contentWidth <= 390.1, `${width} column ${actual.contentWidth}`);
      assert.equal(actual.titleFont, '24px'); assert.equal(actual.audienceFont, '13px'); assert.equal(actual.panelFont, '20px'); assert.equal(actual.submitFont, '16px');
      assert.deepEqual(actual.inputFonts, ['16px', '16px', '16px']);
      assert.match(actual.bodyGap, /^14px(?: 14px)?$/, actual.bodyGap);
      assert.ok(actual.fieldGaps.every(gap => Math.abs(gap - 14) < .2), `field gaps ${actual.fieldGaps.join(',')}`);
      assert.equal(actual.submitBelowFields, true);
      assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
      assert.ok([actual.titleContrast, actual.audienceContrast, actual.hintContrast, actual.submitContrast].every(value => value >= 4.5), `${width}/${locale}/${theme} contrast`);
      assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily));
      if (theme === 'light') { assert.equal(actual.motion, 'on'); assert.notEqual(actual.fx, 'none'); }
      if (theme === 'dark' || theme === 'high-contrast') assert.equal(actual.fx, 'none');
      await nativeSemantics(page, locale);
      assert.equal(await page.locator('.register-form').getAttribute('aria-busy'), 'false');
      if (assetCell) {
        assertRegisterAssets(assets);
        report.visibleAssets = assets;
      }
      if (iconCell) {
        assertFieldIcons(fieldIcons, theme);
        assertDarkThemeAssets(assets);
        report.fieldIconChecks.push({ requested: theme, resolved: actual.theme, icons: fieldIcons });
        save();
      }
      if (theme === 'system') {
        await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
        assert.equal((await facts(page)).fx, 'none');
        if (width === 390 && locale === 'zh-CN') {
          await waitForPaintedIcon(page, DARK_FIELD_ICONS.eye.file);
          const darkIcons = await readFieldIcons(page);
          const darkAssets = await readNativeAssets(page);
          report.fieldIconChecks.push({ requested: 'system', resolved: 'dark', icons: darkIcons });
          save();
          assertFieldIcons(darkIcons, 'dark');
          assertDarkThemeAssets(darkAssets);
        }
        await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
        assert.notEqual((await facts(page)).fx, 'none');
        if (width === 390 && locale === 'zh-CN') {
          await waitForPaintedIcon(page, LIGHT_FIELD_FILES.eye);
          const lightIcons = await readFieldIcons(page);
          const lightAssets = await readNativeAssets(page);
          report.fieldIconChecks.push({ requested: 'system', resolved: 'light', icons: lightIcons });
          save();
          assertFieldIcons(lightIcons, 'light');
          assertRegisterAssets(lightAssets);
        }
      }
      const referenceShot = (locale === 'zh-CN' && theme !== 'system') || (locale === 'en-US' && theme === 'light' && (width === 390 || width === 430 || width === 834));
      if (referenceShot) await page.screenshot({ path: path.join(OUT, `register-${width}-${locale}-${theme}.png`), fullPage: true });
      report.matrix.push({ width, height, locale, requestedTheme: theme, ...actual, status: 'PASS' }); save();
    });
    await current.context.close();
  }
  report.checks.push('48 isolated width/locale/theme combinations at 320/390/430/768/834x1194/1280; 24px title, 13px audience, 16px fields, measured 14px body and field gaps; light FX on, dark and high contrast FX hidden');
  report.checks.push('390 zh-CN dark and high-contrast field icons use the published login dark user, lock and eye bytes; the uni-image div background matches the nested img; file pigment contrast against the computed and composited control background is at least 3:1. System dark and light switch those sources without reload. The light cell stays ten unique files and twelve instances');
  const current = await newPage(), { page } = current;
  const account = page.locator('#mobile-register-identifier'), password = page.locator('#mobile-register-password'), confirm = page.locator('#mobile-register-confirm'), submit = page.locator('.register-submit');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
  assert.equal(await account.evaluate(element => getComputedStyle(element.closest('uni-input')).outlineStyle), 'solid');
  await page.screenshot({ path: path.join(OUT, 'register-keyboard-focus.png'), fullPage: true });
  await submit.click(); await page.locator('#mobile-register-identifier-error').waitFor();
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
  await nativeSemantics(page, 'zh-CN', ['identifier', 'password', 'confirm']); assert.equal(current.count(), 0);
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  await page.screenshot({ path: path.join(OUT, 'register-required.png'), fullPage: true });
  await account.fill('ui-register-synthetic'); await password.fill('short'); await submit.click();
  await page.locator('#mobile-register-password-error').waitFor(); assert.equal(await password.getAttribute('aria-invalid'), 'true');
  assert.equal(await page.locator('#mobile-register-password-error').innerText(), '密码至少 12 位。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await password.fill('SyntheticOnly123'); await submit.click();
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm');
  await confirm.fill('DifferentOnly123'); await submit.click();
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '两次输入的密码不一致。');
  await nativeSemantics(page, 'zh-CN', ['confirm']); await page.screenshot({ path: path.join(OUT, 'register-mismatch.png'), fullPage: true });
  await confirm.fill('SyntheticOnly123'); await account.focus(); await account.blur();
  await nativeSemantics(page); assert.equal(await page.getByRole('alert').count(), 0);
  await password.fill(''); await submit.click();
  assert.equal(current.count(), 0, 'Rapidly clearing a previously valid password must never send its stale model value');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await nativeSemantics(page, 'zh-CN', ['password', 'confirm']);
  await password.fill('SyntheticOnly123'); await confirm.fill(''); await submit.click();
  assert.equal(current.count(), 0, 'Rapidly clearing confirmation prevents registration');
  assert.equal(await page.locator('#mobile-register-confirm-error').innerText(), '请再输入一次密码。');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm');
  await confirm.fill('SyntheticOnly123'); await confirm.blur(); await nativeSemantics(page);
  await page.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('en-US'); });
  await page.getByRole('heading', { name: 'Create account', exact: true }).waitFor(); await nativeSemantics(page, 'en-US');
  await page.evaluate(async () => { const { mobileI18nAdapter } = await import('/src/platform/v2-foundation.ts'); mobileI18nAdapter.setLocale('zh-CN'); });
  await page.getByRole('heading', { name: '创建账号', exact: true }).waitFor(); await nativeSemantics(page);
  await page.locator('#mobile-register-password-label').click(); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await account.focus(); await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-password');
  await page.keyboard.press('Enter'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-register-confirm'); assert.equal(current.count(), 0);
  for (const [kind, show, hide] of [['password', '显示密码', '隐藏密码'], ['confirm', '显示确认密码', '隐藏确认密码']]) {
    const toggle = page.getByRole('button', { name: show, exact: true }), input = page.locator(`#mobile-register-${kind}`);
    assert.equal(await toggle.getAttribute('aria-controls'), `mobile-register-${kind}`);
    await toggle.focus(); await page.keyboard.press('Enter'); assert.equal(await input.getAttribute('type'), 'text');
    assert.equal(await page.getByRole('button', { name: hide, exact: true }).getAttribute('aria-pressed'), 'true');
    await nativeSemantics(page);
    await page.keyboard.press('Space'); assert.equal(await input.getAttribute('type'), 'password'); await nativeSemantics(page);
  }
  current.hold(); await confirm.focus(); await page.keyboard.press('Enter');
  await page.locator('.register-form[aria-busy=true]').waitFor();
  for (const control of await page.locator('.register-input input,.register-password-toggle,.register-text-button,.register-submit').all()) assert.equal(await control.isDisabled(), true);
  await page.locator('#mobile-register-password-label').click(); assert.equal(await page.locator('.register-input.is-focused').count(), 0, 'Busy label click cannot fake focus');
  await submit.click({ force: true }); await page.waitForTimeout(100); assert.equal(current.count(), 1);
  await page.screenshot({ path: path.join(OUT, 'register-busy.png'), fullPage: true }); current.release();
  await page.locator('.register-server-error').waitFor(); await page.locator('.register-form[aria-busy=false]').waitFor();
  assert.equal(await page.locator('.register-server-error').innerText(), '注册没有完成。请尝试登录或找回密码。');
  await nativeSemantics(page); await account.fill('ui-register-synthetic-edited'); assert.equal(await page.locator('.register-server-error').count(), 1);
  await page.screenshot({ path: path.join(OUT, 'register-conflict-neutral.png'), fullPage: true });
  await submit.click(); await page.locator('.register-server-error').waitFor(); assert.equal(current.count(), 2, 'Failure can be retried'); await nativeSemantics(page);
  await current.context.close(); report.checks.push('Per-field required/length/mismatch, correction, first-error focus, live locale semantics, labels, Tab/Enter/Space and both password visibility controls');
  report.checks.push('Immediate short-to-valid correction and valid-to-empty password/confirmation submission use current component values, not throttled old models');
  report.checks.push('Busy locks every input/button/exit, duplicate submit prevented; neutral conflict survives edit and permits retry');
  for (const [scenario, text] of [['rate-limit', '操作过于频繁，请稍后再试。'], ['unavailable', '注册没有完成，请稍后再试。']]) {
    const next = await newPage(390, 'light', 'zh-CN', 844, scenario); await fillValid(next.page); await next.page.locator('.register-submit').click();
    await next.page.locator('.register-server-error').waitFor(); assert.equal(await next.page.locator('.register-server-error').innerText(), text);
    assert.equal(next.count(), 1); await nativeSemantics(next.page); await next.context.close();
  }
  for (const locale of ['zh-CN', 'en-US']) {
    const next = await newPage(390, 'light', locale);
    await next.page.evaluate(() => { for (const element of document.querySelectorAll('.register-brand,.register-audience,.register-title,.register-panel__title,.register-label,.register-input,.register-password-hint,.register-legal-note,.register-submit,.register-text-button,.register-signin')) element.style.fontSize = parseFloat(getComputedStyle(element).fontSize) * 2 + 'px'; });
    const actual = await facts(next.page); assert.equal(actual.overflow, false); assert.deepEqual(actual.inputFonts, ['32px', '32px', '32px']); assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44));
    await next.page.locator('.register-signin').scrollIntoViewIfNeeded(); await next.page.screenshot({ path: path.join(OUT, `register-390-${locale}-text-200.png`), fullPage: true });
    report.matrix.push({ width: 390, locale, requestedTheme: 'light', textScale: 2, ...actual, status: 'PASS' }); await next.context.close();
  }
  const short = await newPage(320, 'light', 'en-US', 460); await short.page.locator('.register-signin').scrollIntoViewIfNeeded(); assert.equal((await facts(short.page)).overflow, false); await short.page.screenshot({ path: path.join(OUT, 'register-320-short-viewport.png'), fullPage: true }); await short.context.close();
  const deep = '/pages/b3-reading/b3-reading?practiceId=ui-synthetic';
  for (const value of [encodeURIComponent(deep), encodeURIComponent(encodeURIComponent(deep)), encodeURIComponent('https://external.invalid/path')]) {
    const next = await newPage(390, 'light', 'zh-CN', 844, 'conflict', `&returnTo=${value}`);
    await next.page.locator('.register-signin .register-text-button').click(); await next.page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
    const result = new URLSearchParams(next.page.url().split('?').slice(1).join('?')).get('returnTo');
    // uni H5 may serialize the query a second time; decode at most two levels.
    let decoded = result; for (let i = 0; i < 2 && decoded?.startsWith('%'); i++) decoded = decodeURIComponent(decoded);
    assert.equal(decoded, value.includes('external.invalid') ? '/pages/home/home' : deep); await next.context.close();
  }
  report.checks.push('Registration login exit preserves singly/doubly encoded safe deep link; external URL falls back to home');
  const adultBefore = report.fixtureRequests.length;
  const adult = await newPage(390, 'light', 'zh-CN', 844, 'adult-required', `&returnTo=${encodeURIComponent(deep)}`); await fillValid(adult.page); await adult.page.locator('.register-submit').click();
  await adult.page.waitForURL(url => url.hash.startsWith('#/pages/onboarding/onboarding'));
  assert.equal(adult.count(), 1);
  assert.equal(new URL(adult.page.url()).origin, BASE);
  assert.equal(adult.page.url().includes('#/pages/home/home'), false, 'A 200 registration token is not learning eligibility');
  const adultRequests = report.fixtureRequests.slice(adultBefore);
  assert.equal(adultRequests.filter(entry => entry.method === 'POST' && entry.path === '/api/v1/auth/register').length, 1);
  assert.equal(adultRequests.some(entry => entry.method === 'GET' && entry.path === '/api/v1/iam/principal/me'), true);
  assert.equal(adultRequests.some(entry => entry.path === '/api/v1/iam/permissions'), false);
  await adult.page.screenshot({ path: path.join(OUT, 'register-synthetic-adult-gate-route.png'), fullPage: true }); await adult.context.close();
  report.checks.push('Synthetic registration with REQUIRED adult gate reads principal/me and routes to existing onboarding rather than a learning page; 200 is not eligibility; UI fixture only');
  report.checks.push('Rate-limit/unavailable neutral feedback, Chinese/English 200% text and short viewport scroll; no physical keyboard or real IAM claim');
  report.contractBoundaries = [];
  const boundaryCases = [
    ...[0, 2, 3, 128, 129, 141].map(length => ({ field: 'identifier', name: `identifier-${length}`, value: 'a'.repeat(length) })),
    ...[2, 3, 128, 129].map(length => ({ field: 'identifier', name: `identifier-trim-${length}`, value: ' ' + 'a'.repeat(length) + ' ' })),
    ...[0, 11, 12, 128, 129, 141].map(length => ({ field: 'password', name: `password-${length}`, value: 'p'.repeat(length) })),
    { field: 'password', name: 'password-raw-padded-12', value: ' ' + 'p'.repeat(10) + ' ' },
  ];
  for (const boundary of boundaryCases) {
    const next = await newPage(), target = next.page;
    const accountValue = boundary.field === 'identifier' ? boundary.value : 'ui-contract-synthetic';
    const passwordValue = boundary.field === 'password' ? boundary.value : 'SyntheticOnly123';
    await target.locator('#mobile-register-identifier').fill(accountValue);
    await target.locator('#mobile-register-password').fill(passwordValue);
    await target.locator('#mobile-register-confirm').fill(passwordValue); await target.locator('#mobile-register-confirm').blur();
    const lengths = await target.evaluate(() => {
      let component = document.querySelector('.v2-register').__vueParentComponent;
      while (component && !('identifier' in component.setupState)) component = component.parent;
      const state = component.setupState;
      return { identifierRaw: state.identifier.length, identifierTrimmed: state.identifier.trim().length, password: state.password.length, confirm: state.confirm.length };
    });
    assert.equal(lengths.identifierRaw, accountValue.length); assert.equal(lengths.identifierTrimmed, accountValue.trim().length);
    assert.equal(lengths.password, passwordValue.length); assert.equal(lengths.confirm, passwordValue.length);
    const length = boundary.field === 'identifier' ? accountValue.trim().length : passwordValue.length;
    const valid = boundary.field === 'identifier' ? length >= 3 && length <= 128 : length >= 12 && length <= 128;
    await target.locator('.register-submit').click();
    if (valid) {
      await target.locator('.register-server-error').waitFor(); assert.equal(next.count(), 1); await nativeSemantics(target);
    } else {
      const expected = boundary.field === 'identifier' ? !length ? '请输入账号。' : '账号长度需为 3 至 128 位。' : !length ? '请输入密码。' : length < 12 ? '密码至少 12 位。' : '密码最多 128 位。';
      await target.locator(`#mobile-register-${boundary.field}-error`).waitFor();
      assert.equal(await target.locator(`#mobile-register-${boundary.field}-error`).innerText(), expected);
      assert.equal(await target.evaluate(() => document.activeElement.id), `mobile-register-${boundary.field}`);
      const invalid = [boundary.field]; if (boundary.field === 'password' && !length) invalid.push('confirm');
      await nativeSemantics(target, 'zh-CN', invalid); assert.equal(next.count(), 0);
    }
    report.contractBoundaries.push({ name: boundary.name, field: boundary.field, lengths, valid, requests: next.count(), result: 'PASS' });
    if (length === 141) await target.screenshot({ path: path.join(OUT, `register-contract-${boundary.field}-141.png`), fullPage: true });
    save(); await next.context.close();
  }
  report.checks.push('Identifier trim3..128 and password raw12..128 boundary gates; maxlength=-1 on all fields retains141-character entries with zero invalid requests, including untrimmed12-character padded password');
  report.pointer = [];
  for (const [ending, heldMs] of [['click', 0], ['click', 160], ['drag-away', 160], ['cancel', 160]]) {
    const next = await newPage(), target = next.page;
    await fillValid(target); await target.locator('#mobile-register-confirm').blur(); await target.locator('.register-submit').click();
    await target.locator('.register-server-error').waitFor(); await target.locator('.register-submit').scrollIntoViewIfNeeded();
    assert.equal(await target.locator('#mobile-register-identifier-error').count(), 0);
    const point = await target.locator('.register-submit').evaluate(node => {
      const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY };
    });
    await target.mouse.move(point.x, point.y);
    await target.evaluate(() => {
      let component = document.querySelector('.v2-register').__vueParentComponent;
      while (component && !('pointerFeedback' in component.setupState)) component = component.parent;
      const state = component.setupState, input = document.getElementById('mobile-register-identifier');
      window.__pointerSnapshot = () => !!state.pointerFeedback;
      window.__registerPointer = { clicks: 0, pressedAction: false, staleAtPointer: null, elapsedMs: null };
      document.querySelector('.register-submit').addEventListener('click', event => { if (event.isTrusted) window.__registerPointer.clicks++; });
      let started;
      document.addEventListener('pointerdown', event => {
        window.__registerPointer.pressedAction = !!event.target.closest('.register-submit');
        window.__registerPointer.staleAtPointer = state.identifier !== '';
        window.__registerPointer.elapsedMs = performance.now() - started;
      }, { once: true, capture: true });
      input.focus({ preventScroll: true });
      input.value = 'ui-register-synthetic'; input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      started = performance.now(); input.value = ''; input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    });
    const cdp = ending === 'cancel' ? await next.context.newCDPSession(target) : null;
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y, id: 1 }] });
    else if (!heldMs) await target.mouse.click(point.x, point.y);
    else await target.mouse.down();
    let heldTop = point.top;
    if (heldMs) {
      await target.waitForTimeout(heldMs); // Deliberate gesture longer than uni's throttle, never an application workaround.
      assert.equal(await target.evaluate(() => window.__pointerSnapshot()), true);
      heldTop = await target.locator('.register-submit').evaluate(node => node.getBoundingClientRect().top + scrollY);
      assert.equal(heldTop, point.top, 'First new error cannot move the pressed action');
      assert.equal(await target.locator('#mobile-register-identifier-error').count(), 0);
      assert.equal(next.count(), 1, 'A pointerdown never submits');
      if (ending === 'drag-away') await target.mouse.move(5, 5);
      if (cdp) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); await cdp.detach(); }
      else await target.mouse.up();
    }
    await target.waitForFunction(() => !window.__pointerSnapshot());
    const probe = await target.evaluate(() => window.__registerPointer);
    assert.equal(probe.pressedAction, true, 'Real pointerdown must hit the old action center');
    if (ending === 'click') assert.equal(probe.staleAtPointer, true, 'Exercise the actual stale-model window');
    assert.equal(probe.clicks, ending === 'click' ? 1 : 0); assert.equal(next.count(), 1);
    if (ending === 'cancel') await target.locator('#mobile-register-identifier').blur();
    await target.locator('#mobile-register-identifier-error').waitFor(); await nativeSemantics(target, 'zh-CN', ['identifier']);
    if (ending === 'click') assert.equal(await target.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
    report.pointer.push({ ending, heldMs, beforeTop: point.top, heldTop, ...probe, snapshotReleased: true, requests: next.count() });
    await target.screenshot({ path: path.join(OUT, `register-pointer-${ending}-${heldMs}.png`), fullPage: true }); save(); await next.context.close();
  }
  report.reportedErrorPointer = [];
  for (const spec of [
    { kind: 'short-to-empty', field: 'password', initial: 'short', replacement: '', invalid: ['password', 'confirm'], message: 'Enter your password.' },
    { kind: 'empty-to-short', field: 'password', initial: '', replacement: 'short', invalid: ['password', 'confirm'], message: 'Use at least 12 characters.' },
    { kind: 'short-to-valid', field: 'password', initial: 'short', replacement: 'SyntheticOnly123', invalid: [], message: null },
    { kind: 'length-to-empty', field: 'identifier', initial: 'a'.repeat(129), replacement: '', invalid: ['identifier'], message: 'Enter your account.' },
    { kind: 'empty-to-length', field: 'identifier', initial: '', replacement: 'a'.repeat(129), invalid: ['identifier'], message: 'Use an account with 3 to 128 characters.' },
    { kind: 'length-to-valid', field: 'identifier', initial: 'a'.repeat(129), replacement: 'ui-contract-valid', invalid: [], message: null },
  ]) {
    const { kind, field, initial, replacement, invalid, message } = spec;
    const next = await newPage(390, 'light', 'en-US'), target = next.page;
    await fillValid(target);
    await target.evaluate(() => {
      const sizes = [...document.querySelectorAll('.v2-register,.v2-register *')].map(element => [element, parseFloat(getComputedStyle(element).fontSize)]);
      for (const [element, size] of sizes) if (size) element.style.setProperty('font-size', size * 2 + 'px', 'important');
      const style = document.createElement('style'); style.textContent = '.v2-register .register-field-error,.v2-register .register-server-error{font-size:28px!important}'; document.head.append(style);
    });
    await target.locator(`#mobile-register-${field}`).fill(initial);
    await target.locator(`#mobile-register-${field}`).blur(); await target.locator('.register-submit').click();
    await target.locator(`#mobile-register-${field}-error`).waitFor(); await target.locator('.register-submit').scrollIntoViewIfNeeded();
    await target.locator(`#mobile-register-${field}`).focus();
    const before = await target.locator('.register-submit').evaluate((node, field) => {
      const r = node.getBoundingClientRect(), error = document.getElementById(`mobile-register-${field}-error`);
      window.__reportedProbe = { clicks: 0, pressedAction: false };
      node.addEventListener('click', event => { if (event.isTrusted) window.__reportedProbe.clicks++; });
      document.addEventListener('pointerdown', event => { window.__reportedProbe.pressedAction = !!event.target.closest('.register-submit'); }, { once: true, capture: true });
      return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top + scrollY, errorText: error.textContent, errorHeight: error.getBoundingClientRect().height };
    }, field);
    await target.mouse.move(before.x, before.y);
    await target.evaluate(({ field, replacement }) => {
      const input = document.getElementById(`mobile-register-${field}`);
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
      input.value = replacement;
      input.dispatchEvent(new InputEvent('input', { bubbles: true }));
    }, { field, replacement });
    await target.waitForTimeout(160); // Assert stability after the model settles, before pointerdown.
    const settled = await target.locator('.register-submit').evaluate((node, field) => {
      const error = document.getElementById(`mobile-register-${field}-error`);
      return { top: node.getBoundingClientRect().top + scrollY, errorText: error.textContent, errorHeight: error.getBoundingClientRect().height, hidden: error.getAttribute('aria-hidden') };
    }, field);
    assert.equal(settled.top, before.top); assert.equal(settled.errorText, before.errorText); assert.equal(settled.errorHeight, before.errorHeight);
    assert.equal(settled.hidden, invalid.length ? 'false' : 'true');
    await target.mouse.down(); await target.waitForTimeout(160);
    assert.equal(await target.locator('.register-submit').evaluate(node => node.getBoundingClientRect().top + scrollY), before.top);
    await target.mouse.up(); assert.equal(await target.evaluate(() => window.__reportedProbe.pressedAction && window.__reportedProbe.clicks === 1), true);
    if (!invalid.length) { await target.locator('.register-server-error').waitFor(); assert.equal(next.count(), 1); await nativeSemantics(target, 'en-US'); }
    else {
      assert.equal(next.count(), 0); assert.equal(await target.evaluate(() => document.activeElement.id), `mobile-register-${field}`);
      await nativeSemantics(target, 'en-US', invalid);
      assert.equal(await target.locator(`#mobile-register-${field}-error`).innerText(), message);
    }
    report.reportedErrorPointer.push({ kind, field, textScale: 2, settleMs: 160, holdMs: 160, before, settled, trustedClicks: 1, requests: next.count() });
    await target.screenshot({ path: path.join(OUT, `register-reported-error-${kind}-en200.png`), fullPage: true }); save(); await next.context.close();
  }
  for (const key of ['Enter', 'Space']) {
    const next = await newPage(); await next.page.locator('.register-submit').focus(); await next.page.keyboard.press(key);
    await next.page.locator('#mobile-register-identifier-error').waitFor();
    assert.equal(await next.page.evaluate(() => document.activeElement.id), 'mobile-register-identifier');
    await nativeSemantics(next.page, 'zh-CN', ['identifier', 'password', 'confirm']); assert.equal(next.count(), 0); await next.context.close();
  }
  report.checks.push('True old-center rapid click and 160ms gesture after 409 defer first new error; drag-away/native touchCancel release without submit; Enter/Space report first-error ARIA immediately');
  report.checks.push('390px English200 reported password short/empty/valid and account length/empty/valid changes retain natural error text/height after160ms before down and during160ms hold; dependent confirmation feedback stays stable');
  const reduced = await newPage(390, 'light', 'zh-CN', 844, 'conflict', '', 'reduce');
  lastPage = reduced.page;
  const reducedFacts = await facts(reduced.page);
  assert.ok(reducedFacts.motion === 'reduced' || reducedFacts.motion === 'off', reducedFacts.motion);
  assert.equal(reducedFacts.fx, 'none');
  await reduced.page.screenshot({ path: path.join(OUT, 'register-390-zh-CN-reduced-motion.png'), fullPage: true });
  report.matrix.push({ width: 390, locale: 'zh-CN', requestedTheme: 'light', motion: reducedFacts.motion, fx: reducedFacts.fx, status: 'PASS' });
  await reduced.context.close();
  report.checks.push('Reduced motion resolves to reduced or off and hides the light-only decorations');
  const unknown = await newPage();
  lastPage = unknown.page;
  const unknownStatus = await unknown.page.evaluate(async () => (await fetch('/api/v1/synthetic-ui-unknown')).status);
  assert.equal(unknownStatus, 404);
  await unknown.context.close();
  report.checks.push('Unknown /api/v1 route returns 404. Registration failures stay on their intercepted status codes');
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
    await context.route(`${LEGAL_ORIGIN}/terms`, fulfillDevLegalTarget);
    await context.route(`${LEGAL_ORIGIN}/privacy`, fulfillDevLegalTarget);
    context.on('request', onRequest);
    save();
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
      record.error = String(error && error.message ? error.message : error).replace(/bearer\s+[a-z0-9._~+/-]+=*/gi, 'bearer [redacted]').replace(/accessToken/gi, 'accessToken');
      save();
      await page.screenshot({ path: path.join(OUT, 'register-legal-failure.png'), fullPage: true }).catch(() => {});
      report.failureShot = 'register-legal-failure.png';
      save();
      throw error;
    } finally {
      context.off('request', onRequest);
      await context.unroute(`${LEGAL_ORIGIN}/terms`, fulfillDevLegalTarget).catch(() => {});
      await context.unroute(`${LEGAL_ORIGIN}/privacy`, fulfillDevLegalTarget).catch(() => {});
    }
    return record;
  }
  const legalCases = [['zh-CN', '用户协议', '隐私政策'], ['en-US', 'Terms', 'Privacy policy']];
  const legalResults = [];
  for (const [locale, termsName, privacyName] of legalCases) {
    const legal = await newPage(390, 'light', locale);
    lastPage = legal.page;
    legalResults.push(await openLegal(legal.page, termsName, '/terms'));
    legalResults.push(await openLegal(legal.page, privacyName, '/privacy'));
    assert.equal(new URL(legal.page.url()).origin, BASE);
    assert.equal(new URL(legal.page.url()).hash.split('?')[0], '#/pages/register/register');
    await legal.context.close();
  }
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
    assert.equal(item.opener && item.opener.hashPath, '#/pages/register/register', `${item.name} leaves the register route in place`);
    assert.equal(item.kind, 'popup-dispatch-synthetic-target');
    assert.equal(item.officialSiteService, 'NOT_RUN');
  }
  report.legalPopups = legalResults.map(item => ({ name: item.name, kind: item.kind, fixture: item.fixture, current: item.current, requests: item.requests, openerPresent: item.openerPresent, officialSiteService: 'NOT_RUN' }));
  report.checks.push('Chinese and English terms and privacy dispatch a real noopener popup. The first document is the dev legal origin served by SYNTHETIC_LEGAL_TARGET. Official site content is NOT_RUN');
  assert.equal(report.pageErrors.length, 0); assert.ok(report.consoleErrors.every(message => /401|404|409|429|503/.test(message)), 'Only intercepted API status errors allowed');
  report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE'; save(); console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, output: OUT }, null, 2));
})().catch(async error => {
  report.status = 'FAIL';
  report.failure = error.stack;
  if (lastPage) {
    await lastPage.screenshot({ path: path.join(OUT, 'register-failure.png'), fullPage: true }).catch(() => {});
    report.failureShot = report.failureShot || 'register-failure.png';
  }
  save();
  console.error(error.stack);
  process.exitCode = 1;
}).finally(async () => { for (const resolve of pending) resolve(); await browser?.close(); });
