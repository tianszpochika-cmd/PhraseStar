// Formal Mobile H5 reset UI. All IAM/Gateway API requests are intercepted.
// Never read authentication storage, cookies, token values, request body/header.
// DSH Root-reset B08 QA observer candidate. Product readonly; compiled artifact only.
// Writes evidence only under /tmp/dsh-root-reset-qa-batch-08/. Never reads tokens/headers/body/storage.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const PROJECT_ROOT = path.resolve(process.env.UI_RESET_PROJECT_ROOT || path.join(__dirname, '../../..'));
const ARTIFACT = process.env.UI_RESET_ARTIFACT ? path.resolve(process.env.UI_RESET_ARTIFACT) : null;
const H5 = ARTIFACT ? path.join(ARTIFACT, 'h5') : path.join(PROJECT_ROOT, 'apps/mobile/dist/build/h5');
const SOURCE_ROOT = ARTIFACT ? path.join(ARTIFACT, 'sources') : PROJECT_ROOT;
const OUT = process.env.UI_AUDIT_OUTPUT ? path.resolve(process.env.UI_AUDIT_OUTPUT) : fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-root-reset-qa-'));
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.UI_RESET_ORIGIN || 'https://reset-ui.synthetic.invalid';
const IAM = process.env.UI_RESET_IAM || 'https://127.0.0.1:18087';
const GATEWAY = process.env.UI_RESET_GATEWAY || 'http://127.0.0.1:18070';
const REQUIRED_SOURCES = [
  'apps/mobile/src/pages/reset-password/reset-password.vue',
  'apps/mobile/src/auth/access-token.ts',
  'apps/mobile/src/auth/gateway-auth.ts',
  'apps/mobile/src/auth/auth-failure-copy.ts',
  'apps/mobile/src/auth/navigation.ts',
  'apps/mobile/src/stores/session.ts',
  'apps/mobile/src/App.vue',
  'packages/i18n/src/mobile-experience.ts',
];
function shaFile(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function treeSha(dir) { const rows = []; (function walk(current) { for (const entry of fs.readdirSync(current, { withFileTypes: true })) { const full = path.join(current, entry.name); if (entry.isDirectory()) walk(full); else if (entry.isFile()) rows.push(`${path.relative(dir, full)}:${shaFile(full)}`); } })(dir); return crypto.createHash('sha256').update(rows.sort().join('\n')).digest('hex'); }
function manifestSourceMap(manifest) {
  const raw = manifest.source ?? manifest.sources;
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((item) => [item.path, item.sha256]));
  if (raw && typeof raw === 'object') return Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, typeof value === 'string' ? value : value?.sha256]).filter(([, value]) => typeof value === 'string'));
  throw new Error('manifest source/sources missing');
}
function verifyArtifact() {
  if (!fs.existsSync(path.join(H5, 'index.html'))) throw new Error(`index missing ${H5}`);
  const buildSha = treeSha(H5);
  const indexSha = shaFile(path.join(H5, 'index.html'));
  if (ARTIFACT) {
    const manifestFile = path.join(ARTIFACT, 'manifest.json');
    if (!fs.existsSync(manifestFile)) throw new Error('artifact manifest missing');
    const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    const sourceMap = manifestSourceMap(manifest);
    for (const [rel, expected] of Object.entries(sourceMap)) {
      const file = path.join(SOURCE_ROOT, rel);
      if (!fs.existsSync(file)) throw new Error(`manifest source missing ${rel}`);
      if (shaFile(file) !== expected) throw new Error(`manifest source hash mismatch ${rel}`);
    }
    for (const rel of REQUIRED_SOURCES) if (!(rel in sourceMap)) throw new Error(`required reset/auth source absent ${rel}`);
    if (typeof manifest.buildFiles === 'number') {
      let count = 0; (function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else count += 1; } })(H5);
      if (count !== manifest.buildFiles) throw new Error(`manifest buildFiles ${manifest.buildFiles} != actual ${count}`);
    }
    if (manifest.index && manifest.index !== indexSha) throw new Error('manifest index hash mismatch');
    return { mode: 'manifest', root: ARTIFACT, index: indexSha, buildFiles: manifest.buildFiles ?? null, sourceCount: Object.keys(sourceMap).length, sourceHashes: sourceMap, buildSha, requiredSources: REQUIRED_SOURCES };
  }
  const sourceHashes = {};
  for (const rel of REQUIRED_SOURCES) { const file = path.join(SOURCE_ROOT, rel); if (!fs.existsSync(file)) throw new Error(`required source missing ${rel}`); sourceHashes[rel] = shaFile(file); }
  return { mode: 'h5', root: PROJECT_ROOT, h5: H5, index: indexSha, buildFiles: null, sourceCount: Object.keys(sourceHashes).length, sourceHashes, buildSha, requiredSources: REQUIRED_SOURCES };
}
const artifactStart = verifyArtifact();
const report = { scope: 'MOBILE_RESET_H5_UI_ONLY_SYNTHETIC_FIXTURES', at: new Date().toISOString(), browserPlugin: 'Playwright Chromium', candidate: 'ui-reset.e2e.cjs', artifact: artifactStart, origins: { base: BASE, iam: IAM, gateway: GATEWAY }, matrix: [], checks: [], pageErrors: [], consoleErrors: [], fixtureRequests: [], unknownApi: [], externalAborts: [], screenshots: [], immediateInput: {}, assetWaits: [], localeSwitch: [] };
report.sourceHashes = artifactStart.sourceHashes;
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(report, null, 2));
const labels = {
  'zh-CN': { request: '忘记密码', confirm: '设置新密码', account: '账号', token: '重置码', password: '新密码', send: '发送重置说明', reset: '确认重置', switch: '已有重置码？去确认', back: '返回申请', login: '返回登录', show: '显示新密码', hide: '隐藏新密码', receipt: '如果该账号可接收重置通知，我们会发送操作说明。', completed: '密码已重置。请返回登录。' },
  'en-US': { request: 'Forgot password', confirm: 'Set a new password', account: 'Account', token: 'Reset code', password: 'New password', send: 'Send reset instructions', reset: 'Confirm reset', switch: 'Already have a reset code? Confirm', back: 'Back to request', login: 'Return to sign in', show: 'Show new password', hide: 'Hide new password', receipt: 'If this account can receive a reset notice, we will send instructions.', completed: 'Password reset. Return to sign in.' },
};
let browser;
const pending = new Set();
const syntheticCode = () => 'ui-fixture-'.padEnd(32, 'x');
function resetBodyIsExactFinal(kind, data, expected) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !expected) return false;
  const keys = Object.keys(data);
  if (kind === 'request') return keys.length === 1 && keys[0] === 'identifier' && data.identifier === expected.identifier;
  return keys.length === 3 && keys.includes('identifier') && keys.includes('resetToken') && keys.includes('newPassword') && data.identifier === expected.identifier && data.resetToken === expected.resetToken && data.newPassword === expected.newPassword;
}
function mime(file) { switch (path.extname(file).toLowerCase()) { case '.html': return 'text/html; charset=utf-8'; case '.js': return 'text/javascript; charset=utf-8'; case '.css': return 'text/css; charset=utf-8'; case '.svg': return 'image/svg+xml'; case '.png': return 'image/png'; case '.json': return 'application/json; charset=utf-8'; case '.woff2': return 'font/woff2'; default: return 'application/octet-stream' } }
async function serveStatic(route) {
  const url = new URL(route.request().url());
  let p = decodeURIComponent(url.pathname); if (!p || p === '/') p = '/index.html';
  const file = path.resolve(H5, `.${p}`);
  if ((file === H5 || file.startsWith(`${H5}${path.sep}`)) && fs.existsSync(file) && fs.statSync(file).isFile()) {
    await route.fulfill({ status: 200, headers: { 'content-type': mime(file), 'cache-control': 'no-store' }, body: fs.readFileSync(file) }); return;
  }
  if (String(route.request().headers().accept || '').includes('text/html')) {
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: fs.readFileSync(path.join(H5, 'index.html')) }); return;
  }
  await route.fulfill({ status: 404, body: 'not found' });
}
async function newPage(width = 390, theme = 'light', locale = 'zh-CN', step = 'request', height = 844, query = '', motion = 'reduce') {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference', ignoreHTTPSErrors: true });
  let scenario = 'unavailable', hold = false, release, counts = { request: 0, confirm: 0 }, expectedPost = null, postMatch = { request: false, confirm: false };
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (![BASE, IAM, GATEWAY].includes(url.origin)) { report.externalAborts = (report.externalAborts || []).concat([{ method: request.method(), origin: url.origin, path: url.pathname }]); return route.abort(); }
    if (url.origin === BASE && !url.pathname.startsWith('/api/')) return serveStatic(route);
    report.fixtureRequests.push({ method: request.method(), origin: url.origin, path: url.pathname });
    const headers = { 'content-type': 'application/json', 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true' };
    if (request.method() === 'OPTIONS') { await route.fulfill({ status: 204, headers, body: '' }); return; }
    if (request.method() === 'POST' && /\/auth\/password-reset\/(request|confirm)$/.test(url.pathname)) {
      assert.equal(url.origin, IAM, 'Password/reset code request stays on IAM origin');
      assert.equal(url.protocol, 'https:', 'Password/reset code request stays on IAM TLS');
      const kind = url.pathname.endsWith('/request') ? 'request' : 'confirm'; counts[kind]++;
      if (expectedPost && expectedPost.kind === kind) {
        try {
          // Exact client fields in memory: request {identifier}; confirm {identifier, resetToken, newPassword}. Boolean only.
          postMatch[kind] = resetBodyIsExactFinal(kind, request.postDataJSON(), expectedPost);
        } catch { postMatch[kind] = false; }
      }
      if (scenario === 'offline') { await route.abort('failed'); return; }
      if (hold) await new Promise(resolve => { release = resolve; pending.add(resolve); });
      const fixture = scenario === 'accepted' ? { status: 202, code: 'ACCEPTED' } : scenario === 'success' ? { status: 204, code: '' } : scenario === 'rate-limit' ? { status: 429, code: 'RATE_LIMITED' } : scenario === 'invalid' ? { status: 401, code: 'iam.password_reset.invalid' } : scenario === 'unknown401' ? { status: 401, code: 'UNKNOWN_AUTH_ERROR' } : { status: 503, code: 'SERVICE_UNAVAILABLE' };
      await route.fulfill({ status: fixture.status, headers, body: fixture.status === 204 ? '' : JSON.stringify(fixture.status === 202 ? { accepted: true } : { code: fixture.code, message: 'Synthetic reset response' }) }); return;
    }
    report.unknownApi.push({ method: request.method(), origin: url.origin, path: url.pathname });
    await route.fulfill({ status: 404, headers, body: JSON.stringify({ code: 'SYNTHETIC_UNKNOWN_API' }) });
  });
  const page = await context.newPage();
  page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${BASE}/#/pages/reset-password/reset-password?theme=${theme}&uiLocale=${locale}${query}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-reset-title').waitFor(); await page.getByRole('textbox', { name: labels[locale].account, exact: true }).waitFor();
  if (step === 'confirm' && !query.includes('&token=')) { await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: labels[locale].confirm, exact: true }).waitFor(); }
  return { context, page, scenario: value => { scenario = value; }, expectPost: value => { expectedPost = value; }, postMatch: () => ({ request: postMatch.request === true, confirm: postMatch.confirm === true }), hold: () => { hold = true; }, release: () => { hold = false; if (release) { pending.delete(release); release(); } }, counts: () => ({ ...counts }) };
}
async function facts(page) {
  return page.evaluate(() => {
    const background = element => { for (let node = element; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color; } return 'rgb(255, 255, 255)'; };
    const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const value = n / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4; }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
    const contrast = element => { const a = luminance(getComputedStyle(element).color), b = luminance(background(element)); return (Math.max(a, b) + .05) / (Math.min(a, b) + .05); };
    const title = document.querySelector('.reset-title'), submit = document.querySelector('.reset-submit');
    const panel = document.querySelector('.reset-panel'), control = document.querySelector('.reset-control'), privacy = document.querySelector('.reset-privacy');
    const fields = [...document.querySelector('.reset-fields').children].filter(node => node.classList.contains('reset-field')).map(node => node.getBoundingClientRect());
    const prefs = new URLSearchParams(location.hash.split('?')[1]);
    const panelStyle = panel ? getComputedStyle(panel) : null, controlStyle = control ? getComputedStyle(control) : null;
    return { route: location.hash.split('?')[0], uiLocale: prefs.get('uiLocale'), title: document.title, theme: document.documentElement.dataset.theme, motion: document.querySelector('.v2-reset').getAttribute('data-motion'),
      overflow: document.documentElement.scrollWidth > innerWidth + 1, contentWidth: document.querySelector('.reset-content').getBoundingClientRect().width, hasPanel: Boolean(panel),
      titleFont: getComputedStyle(title).fontSize, descriptionFont: getComputedStyle(document.querySelector('.reset-description')).fontSize, panelTitleFont: getComputedStyle(document.querySelector('.reset-panel__title')).fontSize, titleFontFamily: getComputedStyle(title).fontFamily,
      titleContrast: contrast(title), descriptionContrast: contrast(document.querySelector('.reset-description')), submitContrast: contrast(submit), submitFont: getComputedStyle(submit).fontSize, submitBottom: submit.getBoundingClientRect().bottom,
      panelRadius: panelStyle ? [panelStyle.borderTopLeftRadius, panelStyle.borderTopRightRadius, panelStyle.borderBottomRightRadius, panelStyle.borderBottomLeftRadius] : [],
      controlMinHeight: controlStyle ? parseFloat(controlStyle.minHeight) : 0, controlRadius: controlStyle ? controlStyle.borderTopLeftRadius : '', submitRadius: getComputedStyle(submit).borderTopLeftRadius,
      privacyFont: privacy ? getComputedStyle(privacy).fontSize : '', fxDisplay: getComputedStyle(document.querySelector('.reset-fx')).display,
      inputFonts: [...document.querySelectorAll('.reset-input input')].map(node => getComputedStyle(node).fontSize), fieldGaps: fields.slice(1).map((r, i) => r.top - fields[i].bottom), actionGap: fields.length ? submit.getBoundingClientRect().top - fields.at(-1).bottom : 0,
      targets: [...document.querySelectorAll('.reset-password-toggle,.reset-text-button,.reset-submit')].map(node => { const r = node.getBoundingClientRect(); return { label: node.getAttribute('aria-label') || node.textContent.trim(), width: r.width, height: r.height }; }) };
  });
}
async function semantics(page, step = 'request', locale = 'zh-CN', invalid = []) {
  for (const kind of step === 'request' ? ['identifier'] : ['identifier', 'token', 'newPassword']) {
    const input = page.locator(`#mobile-reset-${kind}`);
    assert.equal(await input.getAttribute('name'), kind); assert.equal(await input.getAttribute('autocomplete'), kind === 'identifier' ? 'username' : kind === 'token' ? 'one-time-code' : 'new-password');
    assert.equal(await input.getAttribute('aria-label'), labels[locale][kind === 'identifier' ? 'account' : kind === 'newPassword' ? 'password' : 'token']);
    assert.equal(await input.getAttribute('aria-labelledby'), `mobile-reset-${kind}-label`); assert.equal(await input.getAttribute('aria-invalid'), invalid.includes(kind) ? 'true' : null);
    assert.equal(await input.getAttribute('aria-describedby'), [kind === 'newPassword' ? 'mobile-reset-password-hint' : null, invalid.includes(kind) ? `mobile-reset-${kind}-error` : null].filter(Boolean).join(' ') || null);
  }
}
async function fillConfirm(page) {
  await page.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await page.locator('#mobile-reset-token').fill(syntheticCode()); await page.locator('#mobile-reset-newPassword').fill('SyntheticOnly123');
}
async function readGate(page) {
  return page.evaluate(() => {
    const appEl = [...document.querySelectorAll('*')].find(el => el.__vue_app__); const app = appEl ? appEl.__vue_app__ : null; const seen = new Set(); let found = null;
    const check = (component) => { if (!component || seen.has(component)) return; seen.add(component); if ((component.setupState && 'session' in component.setupState) || (component.ctx && 'session' in component.ctx)) found = component; };
    const visit = (vnode) => { if (!vnode || found) return; if (vnode.component) { check(vnode.component); visit(vnode.component.subTree); } if (Array.isArray(vnode.children)) for (const child of vnode.children) visit(child); else if (vnode.children && typeof vnode.children === 'object' && vnode.children.component) visit(vnode.children); };
    if (app && app._instance) { check(app._instance); visit(app._instance.subTree); }
    if (!found) return { adultGate: null, adultLearningAccess: null, status: null, learningReady: false, unavailable: true, components: seen.size };
    const session = found.setupState?.session ?? found.ctx?.session;
    const read = (key) => { const value = session[key]; return value && typeof value === 'object' && 'value' in value ? value.value : value; };
    return { adultGate: read('adultGate') ?? null, adultLearningAccess: read('adultLearningAccess') ?? null, status: read('status') ?? null, learningReady: Boolean(read('isLearningReady')) };
  });
}
async function readLengths(page) {
  return page.evaluate(() => {
    const appEl = [...document.querySelectorAll('*')].find(el => el.__vue_app__); const app = appEl ? appEl.__vue_app__ : null; const seen = new Set(); let found = null;
    const check = (component) => { if (!component || seen.has(component)) return; seen.add(component); if ((component.setupState && 'identifier' in component.setupState) || (component.ctx && 'identifier' in component.ctx)) found = component; };
    const visit = (vnode) => { if (!vnode || found) return; if (vnode.component) { check(vnode.component); visit(vnode.component.subTree); } if (Array.isArray(vnode.children)) for (const child of vnode.children) visit(child); else if (vnode.children && typeof vnode.children === 'object' && vnode.children.component) visit(vnode.children); };
    if (app && app._instance) { check(app._instance); visit(app._instance.subTree); }
    if (!found) return { identifierLength: 0, tokenLength: 0, passwordLength: 0, internalStateUnavailable: true, components: seen.size };
    const state = found.setupState ?? found.ctx;
    const text = (key) => { const value = state[key]; return typeof value === 'string' ? value : value && typeof value.value === 'string' ? value.value : ''; };
    return { identifierLength: text('identifier').length, tokenLength: text('token').length, passwordLength: text('newPassword').length };
  });
}
async function readAssets(page) {
  return page.evaluate(async () => {
    const hex = buffer => [...new Uint8Array(buffer)].map(value => value.toString(16).padStart(2, '0')).join('');
    const parseColor = value => { const nums = String(value || '').match(/[\d.]+/g); if (!nums || nums.length < 3) return null; return { r: Number(nums[0]), g: Number(nums[1]), b: Number(nums[2]), a: nums.length > 3 ? Number(nums[3]) : 1 }; };
    const composite = (fg, bg) => { const a = fg.a + bg.a * (1 - fg.a); const mix = (front, back) => a === 0 ? 0 : (front * fg.a + back * bg.a * (1 - fg.a)) / a; return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a }; };
    const luminance = color => [color.r, color.g, color.b].map(value => { const n = value / 255; return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }).reduce((sum, n, index) => sum + n * [0.2126, 0.7152, 0.0722][index], 0);
    const contrast = (fg, bg) => { const a = luminance(fg), b = luminance(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const paintedBackground = element => {
      const layers = [];
      for (let current = element; current; current = current.parentElement) { const color = parseColor(getComputedStyle(current).backgroundColor); if (!color || color.a <= 0) continue; layers.push(color); if (color.a >= 0.999) break; }
      if (!layers.length) return { r: 255, g: 255, b: 255 };
      let acc = layers[layers.length - 1];
      acc = acc.a >= 0.999 ? { r: acc.r, g: acc.g, b: acc.b, a: 1 } : composite(acc, { r: 255, g: 255, b: 255, a: 1 });
      for (let index = layers.length - 2; index >= 0; index -= 1) acc = composite(layers[index], acc);
      return { r: Math.round(acc.r), g: Math.round(acc.g), b: Math.round(acc.b) };
    };
    const rows = [];
    for (const element of document.querySelectorAll('.figma-asset')) {
      const img = element.querySelector('img');
      const painted = element.querySelector(':scope > div');
      const control = element.closest('.reset-control');
      const rect = element.getBoundingClientRect();
      const currentSrc = img && img.currentSrc ? img.currentSrc : '';
      const paintedImage = painted ? getComputedStyle(painted).backgroundImage : '';
      let pathname = '', sourceSha256 = '', sourceStatus = 0, pigments = [];
      if (img && img.decode) await img.decode().catch(() => {});
      if (currentSrc) {
        pathname = new URL(currentSrc, location.href).pathname;
        const response = await fetch(currentSrc);
        sourceStatus = response.status;
        if (response.ok) {
          const bytes = await response.arrayBuffer();
          sourceSha256 = hex(await crypto.subtle.digest('SHA-256', bytes.slice(0)));
          pigments = [...new TextDecoder().decode(bytes).matchAll(/fill=["']#([0-9A-Fa-f]{6})["']/g)].map(match => `#${match[1].toUpperCase()}`);
        }
      }
      const rawBackground = control ? getComputedStyle(control).backgroundColor : '';
      const own = control ? parseColor(rawBackground) : null;
      const paintedRgb = control ? paintedBackground(control) : null;
      const fg = pigments[0] ? { r: parseInt(pigments[0].slice(1, 3), 16), g: parseInt(pigments[0].slice(3, 5), 16), b: parseInt(pigments[0].slice(5, 7), 16) } : null;
      rows.push({
        role: !control ? 'decor' : element.closest('.reset-password-toggle') ? 'eye' : control.classList.contains('reset-control--secret') ? 'lock' : control.classList.contains('reset-control--token') ? 'shield' : 'user',
        file: pathname.split('/').pop() || '', pathname, paintedImage, imgOpacity: img ? getComputedStyle(img).opacity : '', assetOpacity: getComputedStyle(element).opacity, assetFilter: getComputedStyle(element).filter,
        slotWidth: rect.width, slotHeight: rect.height, naturalWidth: img ? img.naturalWidth : 0, naturalHeight: img ? img.naturalHeight : 0,
        sourceStatus, sourceSha256, pigments, rawBackground, paintedBackground: paintedRgb,
        contrastOnPainted: fg && paintedRgb ? contrast(fg, paintedRgb) : 0, contrastOnComputedRgb: fg && own ? contrast(fg, own) : 0,
      });
    }
    return rows;
  });
}
const REQUEST_ROOT = '/static/figma-reset-request-98-3187/';
const CONFIRM_ROOT = '/static/figma-reset-confirm-98-3496/';
const LOGIN_ROOT = '/static/figma-login-98-1182/';
const DARK_ROOT = '/static/figma-login-dark-248-1391/';
const LIGHT_EYE = { role: 'eye', file: '8927e61b-9aec-4e2c-93fd-4d3f2a998de5.svg', root: LOGIN_ROOT, sha256: '11d13fe935a8c2e78bb0f5f5c4f3eb97c6a1c0d4f00ab6c60de1b0d3c3666c6d', pigment: '#1C1633', natural: [24, 24], slot: [20, 20] };
const DARK_USER = { role: 'user', file: '003efa13-eff2-4c8e-9eda-2238d6117c21.svg', root: DARK_ROOT, sha256: '6010f361747a10d88ed7d9e28589043a38f3fa8b1718da1f2ba50a1a67c3f6ef', pigment: '#BAB8CF', natural: [20, 20], slot: [20, 20], contrast: true };
const DARK_LOCK = { role: 'lock', file: 'eb84fb33-631b-48b5-ae4f-6b2c957e14c5.svg', root: DARK_ROOT, sha256: 'f1bad49af8a526ef41ed6da76c0899a080772b126b3c647766b9a8cc3fd34a0d', pigment: '#BAB8CF', natural: [20, 20], slot: [20, 20], contrast: true };
const DARK_EYE = { role: 'eye', file: '97c4b589-54f5-4111-8972-f5882100ee73.svg', root: DARK_ROOT, sha256: '77daf676a1ce57a9e521a5bea211829b2d1c40aeab7a5e530c31a375e4f149bc', pigment: '#BCABFF', natural: [20, 20], slot: [20, 20], contrast: true };
function decor(root, file, sha256, slot, visible = true) {
  return { role: 'decor', file, root, sha256, slot, natural: slot, visible };
}
const REQUEST_DECOR = [
  decor(REQUEST_ROOT, '24ba3707-5595-45e0-8071-77974a83c135.svg', 'e7ab492e353254b9eacf6dfc576c9367fd3cdb6d924fc7963368233a660fdcbd', [630, 615]),
  decor(REQUEST_ROOT, '6e250af8-330c-474d-a954-30ab74ad665e.svg', '8e1fae2736f39ce74c5719d77bac1e151386d7ed961b0441031046137b79aebe', [320, 320]),
  decor(REQUEST_ROOT, 'fed73ed8-3c36-42c5-bcc2-ef2558a04904.svg', '0851af0927de488991dbea3169650d48db1cf7e5897f1c8ef029c81b1578c49b', [400, 400]),
  decor(REQUEST_ROOT, 'c3c1ce6a-1c7e-44b1-98b3-a99e23149ee2.svg', '292e1e8afa9febab56c2305ee887341f9faba27c86067ede83ee205058160335', [440, 440]),
  decor(REQUEST_ROOT, 'b514a046-f64e-420f-9807-7670bd14cf22.svg', 'd9f012e3939a45ae98469bec747a22595d6e02576ab2f9e41dcfb7a0f1858c08', [180, 140]),
  decor(REQUEST_ROOT, '656c9112-1523-4f77-94a4-5003d2ce1090.svg', '25b494a6149a4cc811d49e15c3302fd6dd842d91b49d790527826b0953936371', [88, 88]),
  { role: 'decor', file: 'c6b72e83-7579-49a6-8f77-93d0cf7a32b9.png', root: REQUEST_ROOT, sha256: '7ddbe6d5fda3398113bdad40bb75170b03c7d003be7d1f7abb44fcbeef014be2', slot: [54, 54], natural: [512, 512], visible: true },
];
const CONFIRM_DECOR = [
  decor(CONFIRM_ROOT, '77f1647d-4413-4f8e-9f1c-85668a1f02a5.svg', '8392aebc50bc3c96224c3f9dd016bde183b2c125d01a958e30cef556acf65076', [630, 615]),
  decor(CONFIRM_ROOT, 'd942ba15-6d1f-4d90-88a0-52e0d00336de.svg', '2559c046172750a7507f730563d69e8d861dfdf8cf173d6aa0e611a5dcf8e304', [320, 320]),
  decor(CONFIRM_ROOT, 'cb97f0f2-6667-44b2-be3d-155535a4cd6f.svg', 'f736b8d06f0a68c8315f9702b7f74ecd284f2fbe5b6be01a4a474c0143656fc3', [400, 400]),
  decor(CONFIRM_ROOT, 'e9fb5194-39d2-4ad5-bbcd-88a2d81d5833.svg', '1d53fe3575acdf8d5ad1b8e81d388994e91c4f8f8297bb8150145562f3a1e6d4', [440, 440]),
  decor(CONFIRM_ROOT, 'ff4f2f62-94a5-4562-9839-bcbbc39da0a1.svg', 'd9f012e3939a45ae98469bec747a22595d6e02576ab2f9e41dcfb7a0f1858c08', [180, 140]),
  decor(CONFIRM_ROOT, '50303499-2f0b-48b3-8a7a-faee5d8366ed.svg', 'a24af57f4346b700e7bf289f4bdc29f358dcc364a2e321d77da6338b3ffe5771', [88, 88]),
  { role: 'decor', file: 'd4fd84fd-04b3-4a40-a677-cf3fb16e078e.png', root: CONFIRM_ROOT, sha256: '7ddbe6d5fda3398113bdad40bb75170b03c7d003be7d1f7abb44fcbeef014be2', slot: [54, 54], natural: [512, 512], visible: true },
];
const REQUEST_USER = { role: 'user', file: 'f183c114-f721-41cb-84f2-976e7007f9f7.svg', root: REQUEST_ROOT, sha256: '556b91f750b403987c0f58233df50fdafff2b943b08ea0482fc0080102fbac14', pigment: '#606277', natural: [20, 20], slot: [20, 20], contrast: true };
const REQUEST_DOT = { role: 'decor', file: '06e3c1bf-175f-498b-82ed-b595f062df16.svg', root: REQUEST_ROOT, sha256: '649257ee650e6d3225edc19fc2999723cdfb0d4d8414cf813e09bf8e221b2757', pigment: '#5935B8', natural: [8, 8], slot: [8, 8] };
const CONFIRM_USER = { role: 'user', file: '5e30a043-b716-4efd-8a7b-3339c910a35d.svg', root: CONFIRM_ROOT, sha256: '556b91f750b403987c0f58233df50fdafff2b943b08ea0482fc0080102fbac14', pigment: '#606277', natural: [20, 20], slot: [20, 20], contrast: true };
const CONFIRM_LOCK = { role: 'lock', file: '2506ca91-7ee3-45d9-821c-61518014dcb3.svg', root: CONFIRM_ROOT, sha256: '184bcbfb04190803cabbfd5ee27b19ddc9b327ce547385a22db68c765988d197', pigment: '#606277', natural: [20, 20], slot: [20, 20], contrast: true };
const CONFIRM_SHIELD = { role: 'shield', file: 'ba66caf5-da10-4df3-806b-d921328d3ef2.svg', root: CONFIRM_ROOT, sha256: '25bc4f48eff6f17fed8c44fc55776ddcc883b0b16c937bc56af503fd455552ba', pigment: '#1C1633', natural: [24, 24], slot: [20, 20], contrast: true };
function hiddenDecor(specs) { return specs.map(spec => spec.file.endsWith('.png') ? spec : { ...spec, visible: false }); }
function assertAssetRows(rows, specs, allowLightGlyphs) {
  assert.equal(rows.length, specs.length, `asset count ${rows.length}`);
  const used = new Set();
  for (const spec of specs) {
    const index = rows.findIndex((row, rowIndex) => !used.has(rowIndex) && row.file === spec.file && row.role === spec.role);
    assert.ok(index >= 0, spec.file);
    used.add(index);
    const row = rows[index];
    assert.equal(row.pathname, `${spec.root}${spec.file}`, spec.file);
    assert.equal(row.sourceStatus, 200, spec.file);
    assert.equal(row.sourceSha256, spec.sha256, spec.file);
    if (spec.visible !== false) {
      assert.ok(row.paintedImage.includes(spec.file), `${spec.file} painted ${row.paintedImage}`);
      assert.ok(Math.abs(row.slotWidth - spec.slot[0]) <= 1 && Math.abs(row.slotHeight - spec.slot[1]) <= 1, `${spec.file} slot ${row.slotWidth}x${row.slotHeight}`);
      assert.equal(row.imgOpacity, '0', 'nested img opacity 0 is uni-image paint, not a missing icon');
      if (spec.natural) { assert.equal(row.naturalWidth, spec.natural[0], spec.file); assert.equal(row.naturalHeight, spec.natural[1], spec.file); }
    }
    if (spec.pigment) assert.deepEqual(row.pigments, [spec.pigment], spec.file);
    if (spec.contrast) assert.ok(row.contrastOnPainted >= 3, `${spec.role} painted contrast ${row.contrastOnPainted} on ${JSON.stringify(row.paintedBackground)}`);
  }
  if (!allowLightGlyphs) {
    for (const row of rows) {
      if (row.role === 'decor') continue;
      assert.notEqual(row.pigments[0], '#1C1633', row.role);
      assert.equal(row.pathname.includes('/figma-login-98-1182/'), false, row.file);
    }
    assert.equal(rows.some(row => row.file.startsWith('ba66caf5') || row.file.startsWith('8927e61b') || row.file.startsWith('2506ca91') || row.file.startsWith('5e30a043') || row.file.startsWith('f183c114')), false);
  }
}
function assetMetric(row) {
  return { role: row.role, file: row.file, sha256: row.sourceSha256, slot: [Math.round(row.slotWidth), Math.round(row.slotHeight)], natural: [row.naturalWidth, row.naturalHeight], pigments: row.pigments, contrastOnPainted: Math.round(row.contrastOnPainted * 1000) / 1000, imgOpacity: row.imgOpacity, sourceStatus: row.sourceStatus };
}
async function waitForAssets(page, specs) {
  const files = specs.filter(spec => spec.visible !== false).map(spec => spec.file);
  const started = Date.now();
  await page.waitForFunction((expected) => expected.every(file => [...document.querySelectorAll('.figma-asset img')].some(img => (img.currentSrc || '').includes(file) && img.complete && img.naturalWidth > 0)), files, { timeout: 15000 });
  await page.waitForFunction((expected) => expected.every(file => [...document.querySelectorAll('.figma-asset')].some(el => { const paint = el.querySelector(':scope > div'); return paint && getComputedStyle(paint).backgroundImage.includes(file); })), files, { timeout: 15000 });
  const elapsed = Date.now() - started;
  report.assetWaits.push({ files: files.length, elapsedMs: elapsed });
  return elapsed;
}
async function observeIcons(label, page, specs, allowLightGlyphs) {
  await waitForAssets(page, specs);
  const rows = await readAssets(page);
  const fx = await facts(page);
  report.iconObservations.push({ label, theme: fx.theme, motion: fx.motion, fxDisplay: fx.fxDisplay, count: rows.length, rows: rows.map(assetMetric) });
  save();
  assertAssetRows(rows, specs, allowLightGlyphs);
  return fx;
}
async function hashPresence(page) {
  return page.evaluate(() => {
    const params = new URLSearchParams((location.hash.split('?')[1] || ''));
    return { hasTokenParam: params.has('token'), tokenLength: (params.get('token') || '').length, route: location.hash.split('?')[0], returnTo: params.get('returnTo') };
  });
}
async function waitModelLength(page, key, expected, timeout) {
  await page.waitForFunction(({ key, expected }) => {
    let component = document.querySelector('.v2-reset').__vueParentComponent;
    while (component && !(component.setupState && key in component.setupState)) component = component.parent;
    const state = component.setupState;
    const value = state[key];
    const text = typeof value === 'string' ? value : value && typeof value.value === 'string' ? value.value : '';
    return text.length === expected;
  }, { key, expected }, { timeout });
}
const IMMEDIATE_WINDOW_MS = 100;
const IMMEDIATE_ATTEMPTS = 5;
const IMMEDIATE_PASSWORD = 'SyntheticOnly123';
function namedProbeError(name, detail) {
  const error = new Error(`${name} ${JSON.stringify(detail)}`);
  error.name = name;
  error.detail = detail;
  return error;
}
async function armImmediateProbe(page, finalValue) {
  await page.evaluate(({ windowMs, finalValue }) => {
    const probe = { inputAt: 0, actionAt: 0, inputTrusted: false, actionTrusted: false, inputNativeFinal: false, clickNativeFinal: false, windowMs };
    window.__immediateProbe = probe;
    const nativeFinal = (node) => !!node && node.value === finalValue;
    document.addEventListener('input', (event) => {
      if (!event.isTrusted || event.target?.id !== 'mobile-reset-identifier' || probe.inputTrusted) return;
      probe.inputAt = performance.now();
      probe.inputTrusted = true;
      probe.inputNativeFinal = nativeFinal(event.target);
    }, true);
    document.addEventListener('click', (event) => {
      if (!event.isTrusted || !event.target?.closest?.('.reset-submit') || probe.actionTrusted) return;
      probe.actionAt = performance.now();
      probe.actionTrusted = true;
      probe.clickNativeFinal = nativeFinal(document.getElementById('mobile-reset-identifier'));
    }, true);
  }, { windowMs: IMMEDIATE_WINDOW_MS, finalValue });
}
async function dispatchFinalAndActivate(page, key, finalValue) {
  await page.locator('.reset-submit').scrollIntoViewIfNeeded();
  const box = await page.locator('.reset-submit').boundingBox();
  if (!box) throw namedProbeError('MB003_IMMEDIATE_ACTION_UNAVAILABLE', { hasPrimaryBox: false });
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.locator('#mobile-reset-identifier').evaluate((node) => {
    node.focus({ preventScroll: true });
    const end = node.value.length;
    node.setSelectionRange(end, end);
  });
  await armImmediateProbe(page, finalValue);
  const cdp = await page.context().newCDPSession(page);
  try {
    if (key === 'Backspace') {
      await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
      const press = cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      const release = cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
      await press; await release;
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8, nativeVirtualKeyCode: 8 });
    } else {
      await cdp.send('Input.insertText', { text: key });
      const press = cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
      const release = cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
      await press; await release;
    }
  } finally { await cdp.detach(); }
  return page.evaluate(() => {
    const probe = window.__immediateProbe;
    const deltaMs = probe && probe.inputTrusted && probe.actionTrusted ? probe.actionAt - probe.inputAt : null;
    return { deltaMs, inputTrusted: probe?.inputTrusted === true, actionTrusted: probe?.actionTrusted === true, underWindow: typeof deltaMs === 'number' && deltaMs >= 0 && deltaMs < probe.windowMs, nativeIsFinal: probe?.inputNativeFinal === true && probe?.clickNativeFinal === true };
  });
}
async function waitResetCount(host) {
  const started = Date.now();
  let counts = host.counts();
  while (counts.request + counts.confirm === 0 && Date.now() - started < 500) { await host.page.waitForTimeout(20); counts = host.counts(); }
  return counts;
}
async function proveImmediate(spec) {
  let last = null;
  for (let attempt = 1; attempt <= IMMEDIATE_ATTEMPTS; attempt += 1) {
    const host = await newPage(390, 'light', 'zh-CN', spec.step);
    try {
      if (spec.confirmFields) {
        await host.page.locator('#mobile-reset-token').fill(syntheticCode());
        await host.page.locator('#mobile-reset-newPassword').fill(IMMEDIATE_PASSWORD);
      }
      await host.page.locator('#mobile-reset-identifier').fill(spec.stableIdentifier);
      await host.page.waitForTimeout(200); // Stable prefix only. The final key has no blur or wait before the primary click.
      if (spec.scenario) host.scenario(spec.scenario);
      if (spec.expectPost) host.expectPost(spec.expectPost());
      const measured = await dispatchFinalAndActivate(host.page, spec.key, spec.finalIdentifier);
      const counts = await waitResetCount(host);
      const match = host.postMatch();
      const primaryCount = spec.endpoint === 'request' ? counts.request : counts.confirm;
      const otherCount = spec.endpoint === 'request' ? counts.confirm : counts.request;
      last = { attempt, ...measured, requestCount: counts.request, confirmCount: counts.confirm, requestCountIsOne: counts.request === 1, confirmCountIsOne: counts.confirm === 1, requestCountIsZero: counts.request === 0, confirmCountIsZero: counts.confirm === 0, requestMatchedFinal: match.request, confirmMatchedFinal: match.confirm, primaryCountIsOne: primaryCount === 1, primaryCountIsZero: primaryCount === 0, primaryMatchedFinal: spec.endpoint === 'request' ? match.request : match.confirm, otherCountIsZero: otherCount === 0 };
      const windowReached = last.inputTrusted && last.actionTrusted && last.underWindow;
      if (windowReached && !last.nativeIsFinal) throw namedProbeError('MB003_IMMEDIATE_INVALID_SAMPLE', { step: spec.step, mode: spec.mode, endpoint: spec.endpoint, attempts: attempt, last });
      if (windowReached) return last;
    } finally { await host.context.close(); }
  }
  throw namedProbeError('MB003_IMMEDIATE_WINDOW_NOT_REACHED', { step: spec.step, mode: spec.mode, endpoint: spec.endpoint, attempts: IMMEDIATE_ATTEMPTS, last });
}
function assertImmediate(spec, facts) {
  const primary = spec.endpoint === 'request' ? facts.requestCount : facts.confirmCount;
  const other = spec.endpoint === 'request' ? facts.confirmCount : facts.requestCount;
  const matched = spec.endpoint === 'request' ? facts.requestMatchedFinal : facts.confirmMatchedFinal;
  const tag = spec.endpoint === 'request' ? 'REQUEST' : 'CONFIRM';
  if (!spec.expectRequest) { if (primary !== 0 || other !== 0) throw namedProbeError(`MB003_IMMEDIATE_INVALID_${tag}_SENT`, facts); return; }
  if (other !== 0) throw namedProbeError(`MB003_IMMEDIATE_${tag}_WRONG_ENDPOINT`, facts);
  if (primary === 0) throw namedProbeError(`MB003_IMMEDIATE_${tag}_NOT_SENT`, facts);
  if (primary > 1) throw namedProbeError(`MB003_IMMEDIATE_${tag}_REPEATED`, facts);
  if (primary !== 1 || matched !== true) throw namedProbeError(`MB003_IMMEDIATE_${tag}_NOT_FINAL`, facts);
}
async function runImmediateCases() {
  const cases = [
    { step: 'request', mode: 'valid', endpoint: 'request', expectRequest: true, stableIdentifier: 'ab', finalIdentifier: 'abc', key: 'c', scenario: 'accepted', expectPost: () => ({ kind: 'request', identifier: 'abc' }) },
    { step: 'request', mode: 'cleared', endpoint: 'request', expectRequest: false, stableIdentifier: 'abc', finalIdentifier: 'ab', key: 'Backspace' },
    { step: 'confirm', mode: 'valid', endpoint: 'confirm', expectRequest: true, confirmFields: true, stableIdentifier: 'ab', finalIdentifier: 'abc', key: 'c', scenario: 'success', expectPost: () => ({ kind: 'confirm', identifier: 'abc', resetToken: syntheticCode(), newPassword: IMMEDIATE_PASSWORD }) },
    { step: 'confirm', mode: 'cleared', endpoint: 'confirm', expectRequest: false, confirmFields: true, stableIdentifier: 'abc', finalIdentifier: 'ab', key: 'Backspace' },
  ];
  const results = [], failures = [];
  for (const spec of cases) {
    try {
      const facts = await proveImmediate(spec);
      let failure = null;
      try { assertImmediate(spec, facts); } catch (error) { failure = error; }
      results.push({ step: spec.step, mode: spec.mode, endpoint: spec.endpoint, failure: failure ? failure.name : null, ...facts });
      if (failure) failures.push(failure);
    } catch (error) {
      if (!String(error.name || '').startsWith('MB003_IMMEDIATE_')) throw error;
      results.push({ step: spec.step, mode: spec.mode, endpoint: spec.endpoint, failure: error.name, detail: error.detail || null });
      failures.push(error);
    }
  }
  return { results, failures };
}
async function switchLocale(page, locale) {
  const hash = new URL(page.url()).hash;
  const [pathname, query = ''] = hash.split('?');
  const params = new URLSearchParams(query); params.set('uiLocale', locale);
  await page.addInitScript(({ locale }) => { try { localStorage.setItem('ef.ui-locale', locale); } catch {} }, { locale });
  await page.goto(`${BASE}/${pathname}?${params}`, { waitUntil: 'networkidle' });
  await page.locator('#mobile-reset-title').waitFor();
  const beforeHeadings = await page.getByRole('heading').allInnerTexts();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await page.getByRole('heading', { name: labels[locale].confirm, exact: true }).count() > 0) break;
    await page.locator('.reset-step-button').click();
    await page.waitForTimeout(300);
  }
  const afterHeadings = await page.getByRole('heading').allInnerTexts();
  report.localeSwitch.push({ locale, url: page.url().replace(/[?#].*$/, ''), hash: new URL(page.url()).hash, beforeHeadings, afterHeadings, body: (await page.locator('body').innerText()).slice(0, 300) });
  await page.getByRole('heading', { name: labels[locale].confirm, exact: true }).waitFor();
  await fillConfirm(page);
  await page.getByRole('heading', { name: labels[locale].confirm, exact: true }).waitFor();
}
(async () => {
  browser = await chromium.launch();
  for (const width of [320, 390, 768, 1280]) for (const locale of ['zh-CN', 'en-US']) for (const theme of ['light', 'dark', 'high-contrast', 'system']) for (const step of ['request', 'confirm']) {
    const current = await newPage(width, theme, locale, step), { page } = current;
    assert.equal(await page.getByRole('heading', { name: labels[locale][step], exact: true }).count(), 1); assert.equal(await page.getByRole('heading').count(), 1);
    assert.equal(await page.locator('.yx-card,.mobile-page-header,.v2-reset-brand,.reset-field-error,.reset-server-error,[role=status],vite-error-overlay').count(), 0);
    const actual = await facts(page); report.matrix.push({ width, locale, requestedTheme: theme, step, ...actual, status: 'PENDING' }); save();
    assert.equal(actual.overflow, false); assert.ok(actual.contentWidth <= 390.1); assert.equal(actual.hasPanel, true); assert.equal(actual.titleFont, '24px'); assert.equal(actual.descriptionFont, '13px'); assert.equal(actual.panelTitleFont, '20px'); assert.equal(actual.submitFont, '16px'); assert.deepEqual(actual.inputFonts, step === 'request' ? ['16px'] : ['16px', '16px', '16px']);
    assert.deepEqual(actual.panelRadius, ['28px', '28px', '20px', '20px']); assert.ok(actual.controlMinHeight >= 48); assert.equal(actual.controlRadius, '14px'); assert.equal(actual.submitRadius, '14px'); if (step === 'request') assert.equal(actual.privacyFont, '12px');
    assert.ok(actual.fieldGaps.every(gap => Math.abs(gap - 14) < .2)); assert.ok(actual.targets.every(target => target.width >= 44 && target.height >= 44)); assert.ok([actual.titleContrast, actual.descriptionContrast, actual.submitContrast].every(value => value >= 4.5)); assert.ok(!/Georgia|Times New Roman/.test(actual.titleFontFamily)); assert.equal(actual.fxDisplay, 'none');
    await semantics(page, step, locale); assert.equal(await page.locator('.reset-form').getAttribute('aria-busy'), 'false');
    if (theme === 'system') { await page.emulateMedia({ colorScheme: 'dark' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark'); await page.emulateMedia({ colorScheme: 'light' }); await page.waitForFunction(() => document.documentElement.dataset.theme === 'light'); }
    if ((locale === 'zh-CN' && theme !== 'system') || (width === 390 && locale === 'en-US' && theme === 'light')) await page.screenshot({ path: path.join(OUT, `reset-${step}-${width}-${locale}-${theme}.png`), fullPage: true });
    report.matrix[report.matrix.length - 1].status = 'PASS'; save(); await current.context.close();
  }
  report.checks.push('64 isolated two-step width/locale/theme combinations; actual 24px titles, 13px subtitles, 16px inputs, 14px field gaps, 28/20 card, 44px targets, contrast and reduced-motion fx hidden');
  const request = await newPage(), { page } = request;
  const account = page.locator('#mobile-reset-identifier'), submit = page.locator('.reset-submit');
  await page.locator('body').click({ position: { x: 5, y: 5 } }); await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-identifier');
  assert.equal(await account.evaluate(node => getComputedStyle(node.closest('uni-input')).outlineStyle), 'solid'); await submit.click(); await page.locator('#mobile-reset-identifier-error').waitFor(); await semantics(page, 'request', 'zh-CN', ['identifier']); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-identifier'); assert.equal(request.counts().request, 0);
  await page.screenshot({ path: path.join(OUT, 'reset-request-required.png'), fullPage: true });
  await account.fill('ui-reset-synthetic'); await account.fill(''); await submit.click(); assert.equal(request.counts().request, 0);
  await account.fill('ui-reset-synthetic'); request.scenario('accepted'); request.hold(); await account.focus(); await page.keyboard.press('Enter'); await page.locator('.reset-form[aria-busy=true]').waitFor();
  for (const control of await page.locator('.reset-input input,.reset-submit,.reset-text-button').all()) assert.equal(await control.isDisabled(), true);
  await page.locator('.reset-step-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await page.locator('.reset-login-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await submit.click({ force: true });
  assert.equal(await page.getByRole('heading', { name: '忘记密码', exact: true }).count(), 1); assert.ok(page.url().includes('/pages/reset-password/reset-password')); assert.equal(request.counts().request, 1);
  await page.screenshot({ path: path.join(OUT, 'reset-request-busy.png'), fullPage: true }); request.release(); await page.locator('.reset-receipt').waitFor();
  const receiptText = await page.locator('.reset-receipt').innerText(); report.receiptCopy = { zh: receiptText, accountEcho: receiptText.includes('ui-reset-synthetic') }; save(); assert.equal(receiptText, labels['zh-CN'].receipt); assert.equal(report.receiptCopy.accountEcho, false); await semantics(page); await page.screenshot({ path: path.join(OUT, 'reset-request-accepted.png'), fullPage: true });
  await account.fill('ui-reset-other-synthetic'); await account.blur(); assert.equal(await page.getByRole('status').count(), 0); assert.equal(await page.locator('.reset-receipt').isVisible(), false);
  for (const [scenario, expected] of [['rate-limit', '操作过于频繁，请稍后再试。'], ['unavailable', '发送没有完成，请稍后再试。']]) { request.scenario(scenario); await submit.click(); await page.locator('.reset-server-error').waitFor(); assert.equal(await page.locator('.reset-server-error').innerText(), expected); assert.equal(await page.locator('.reset-receipt').count(), 0); }
  await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); assert.equal(await page.getByRole('alert').count(), 0); await semantics(page, 'confirm'); assert.equal(await page.evaluate(() => document.activeElement.id), 'mobile-reset-token');
  await page.locator('.reset-step-button').click(); await page.getByRole('heading', { name: '忘记密码', exact: true }).waitFor(); assert.equal(await account.inputValue(), 'ui-reset-other-synthetic'); await semantics(page); await request.context.close();
  report.checks.push('Request blank/rapid clear/Enter, busy direct-dispatch guards, single request, 202 conditional receipt, edited-account receipt cleanup and 429/503 truthful failures');
  const confirmation = await newPage(390, 'light', 'zh-CN', 'confirm'), p = confirmation.page;
  const code = p.locator('#mobile-reset-token'), password = p.locator('#mobile-reset-newPassword'), action = p.locator('.reset-submit');
  await action.click(); await semantics(p, 'confirm', 'zh-CN', ['identifier', 'token', 'newPassword']); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-identifier');
  await p.screenshot({ path: path.join(OUT, 'reset-confirm-required.png'), fullPage: true });
  await p.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await code.fill(syntheticCode()); await password.fill('short'); await action.click(); assert.equal(await p.locator('#mobile-reset-newPassword-error').innerText(), '新密码至少 12 位。'); assert.equal(confirmation.counts().confirm, 0);
  await password.fill('SyntheticOnly123'); confirmation.scenario('invalid'); await action.click(); await p.locator('.reset-server-error').waitFor(); assert.equal(await p.locator('.reset-server-error').innerText(), '重置口令无效或已过期，请重新申请。'); assert.equal(confirmation.counts().confirm, 1); await semantics(p, 'confirm');
  await password.fill(''); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-newPassword'); await semantics(p, 'confirm', 'zh-CN', ['newPassword']);
  await password.fill('SyntheticOnly123'); await code.fill(''); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-token'); await semantics(p, 'confirm', 'zh-CN', ['token']);
  const longCode = 'x'.repeat(512); await code.fill(longCode); await code.blur(); assert.equal(await code.evaluate((node, expected) => node.value === expected, longCode), true); report.longCode = { characters: 512, preserved: true, default140Truncation: false }; // Store only length/boolean, never the code.
  await password.fill('x'.repeat(129)); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.equal(await password.evaluate(node => node.value.length), 129); assert.ok((await p.locator('#mobile-reset-newPassword-error').innerText()).includes('128'));
  await password.fill('SyntheticOnly123'); await code.fill('x'.repeat(513)); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.ok((await p.locator('#mobile-reset-token-error').innerText()).includes('512'));
  await code.fill(syntheticCode()); await p.locator('#mobile-reset-identifier').fill('ab'); await action.click(); assert.equal(confirmation.counts().confirm, 1); assert.ok((await p.locator('#mobile-reset-identifier-error').innerText()).includes('128'));
  await p.locator('#mobile-reset-identifier').fill('ui-reset-synthetic'); await p.locator('#mobile-reset-identifier').blur(); await semantics(p, 'confirm');
  const enConfirm = await newPage(390, 'light', 'en-US', 'confirm');
  await semantics(enConfirm.page, 'confirm', 'en-US');
  report.localeSwitch.push({ mechanism: 'compiled-artifact isolated en-US page; source dynamic import unavailable', status: 'PASS' });
  await enConfirm.context.close();
  await fillConfirm(p); await p.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); await semantics(p, 'confirm');
  await p.locator('#mobile-reset-identifier').focus(); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-token'); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(() => document.activeElement.id), 'mobile-reset-newPassword');
  await p.getByRole('button', { name: '显示新密码', exact: true }).focus(); await p.keyboard.press('Enter'); assert.equal(await password.getAttribute('type'), 'text'); assert.equal(await password.inputValue(), 'SyntheticOnly123'); await semantics(p, 'confirm'); await p.keyboard.press('Space'); assert.equal(await password.getAttribute('type'), 'password');
  confirmation.scenario('unknown401'); confirmation.hold(); await password.focus(); await p.keyboard.press('Enter'); await p.locator('.reset-form[aria-busy=true]').waitFor();
  for (const control of await p.locator('.reset-input input,.reset-submit,.reset-text-button,.reset-password-toggle').all()) assert.equal(await control.isDisabled(), true);
  await p.locator('.reset-step-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await p.locator('.reset-login-button').evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); await action.click({ force: true }); assert.equal(confirmation.counts().confirm, 2); assert.equal(await p.getByRole('heading', { name: '设置新密码', exact: true }).count(), 1);
  confirmation.release(); await p.locator('.reset-server-error').waitFor(); assert.equal(await p.locator('.reset-server-error').innerText(), '重置没有完成，请稍后再试。'); await semantics(p, 'confirm');
  await password.fill('SyntheticOnly124'); await password.blur(); assert.equal(await p.locator('.reset-server-error').count(), 1); await p.locator('.reset-step-button').click(); await p.getByRole('heading', { name: '忘记密码', exact: true }).waitFor(); assert.equal(await p.getByRole('alert').count(), 0); await p.locator('.reset-step-button').click(); await p.getByRole('heading', { name: '设置新密码', exact: true }).waitFor(); assert.equal(await code.inputValue(), ''); assert.equal(await password.inputValue(), ''); assert.equal(await password.getAttribute('type'), 'password'); await semantics(p, 'confirm');
  const gateBefore = await readGate(p);
  await fillConfirm(p); confirmation.scenario('success'); await action.click(); await p.locator('.reset-success').waitFor();
  const completedText = await p.locator('.reset-success').innerText();
  const gateAfter = await readGate(p);
  const clearedRaw = await readLengths(p); const cleared = { identifierLength: clearedRaw.identifierLength, tokenLength: clearedRaw.tokenLength, passwordLength: clearedRaw.passwordLength };
  report.confirmCompletion = { completedText, continuesLearning: completedText.includes('继续学习'), claimsRevocation: completedText.includes('撤销'), gateBefore, gateAfter, gateAccess: gateAfter.unavailable ? 'UNAVAILABLE_IN_PRODUCTION_BUILD' : 'OBSERVED', learningReady: gateAfter.learningReady, cleared, clearedInternalStateUnavailable: Boolean(clearedRaw.internalStateUnavailable), requests: confirmation.counts().confirm, route: await p.evaluate(() => location.hash.split('?')[0]) };
  save();
  assert.equal(await p.locator('.reset-form,input,.reset-password-toggle,.reset-step-button').count(), 0);
  assert.equal(confirmation.counts().confirm, 3);
  assert.equal(completedText, labels['zh-CN'].completed);
  assert.equal(report.confirmCompletion.continuesLearning, false);
  assert.equal(report.confirmCompletion.claimsRevocation, false);
  assert.equal(gateAfter.learningReady, false);
  assert.deepEqual(gateAfter, gateBefore);
  assert.deepEqual(cleared, { identifierLength: 0, tokenLength: 0, passwordLength: 0 });
  assert.equal(report.confirmCompletion.route, '#/pages/reset-password/reset-password');
  await p.screenshot({ path: path.join(OUT, 'reset-synthetic-completed.png'), fullPage: true });
  await confirmation.context.close();
  report.checks.push('Confirm required/short/maximum contract bounds and immediate corrections/clears, true 512-character code preservation, keyboard flow and eye semantics');
  report.checks.push('Allowlisted invalid-code 401 differs from unknown401; pending direct clicks cannot switch/leave/duplicate; back clears code/password/show/errors; synthetic204 completes and removes inputs');
  for (const step of ['request', 'confirm']) for (const locale of ['zh-CN', 'en-US']) {
    const next = await newPage(390, 'light', locale, step); await next.page.evaluate(() => { for (const node of document.querySelectorAll('.reset-brand,.reset-adult-note,.reset-title,.reset-description,.reset-label,.reset-input,.reset-password-hint,.reset-submit,.reset-text-button,.reset-exit')) node.style.fontSize = parseFloat(getComputedStyle(node).fontSize) * 2 + 'px'; });
    const actual = await facts(next.page); assert.equal(actual.overflow, false); assert.deepEqual(actual.inputFonts, step === 'request' ? ['32px'] : ['32px', '32px', '32px']); await next.page.locator('.reset-exit').scrollIntoViewIfNeeded(); await next.page.screenshot({ path: path.join(OUT, `reset-${step}-390-${locale}-text-200.png`), fullPage: true }); report.matrix.push({ width: 390, locale, requestedTheme: 'light', step, textScale: 2, ...actual, status: 'PASS' }); await next.context.close();
  }
  const short = await newPage(320, 'light', 'en-US', 'confirm', 460); await short.page.locator('.reset-exit').scrollIntoViewIfNeeded(); assert.equal((await facts(short.page)).overflow, false); await short.page.screenshot({ path: path.join(OUT, 'reset-confirm-320-short-viewport.png'), fullPage: true }); await short.context.close();
  const deep = '/pages/b3-reading/b3-reading?practiceId=ui-synthetic';
  for (const value of [encodeURIComponent(deep), encodeURIComponent(encodeURIComponent(deep)), encodeURIComponent('https://external.invalid/path')]) {
    const next = await newPage(390, 'light', 'zh-CN', 'confirm', 844, `&token=${encodeURIComponent(syntheticCode())}&returnTo=${value}`); assert.equal(await next.page.locator('#mobile-reset-token').evaluate(node => node.value.length === 32), true); await next.page.locator('.reset-login-button').click(); await next.page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
    let decoded = new URLSearchParams(next.page.url().split('?').slice(1).join('?')).get('returnTo'); for (let i = 0; i < 2 && decoded?.startsWith('%'); i++) decoded = decodeURIComponent(decoded); assert.equal(decoded, value.includes('external.invalid') ? '/pages/home/home' : deep); await next.context.close();
  }
  report.checks.push('Two-step Chinese/English 200% text and short screen scrolling, reset-code deep link, safe single/double encoded return and external fallback; no raw reset code in result URLs');
  report.pointer = [];
  for (const ending of ['click', 'drag-away', 'cancel']) {
    const next = await newPage(390, 'light', 'zh-CN', 'confirm'), target = next.page;
    await target.locator('#mobile-reset-identifier').fill('ui-reset-pointer'); await target.locator('#mobile-reset-identifier').blur(); await target.locator('.reset-submit').click();
    await target.locator('#mobile-reset-token').fill(syntheticCode()); await target.locator('#mobile-reset-newPassword').fill('SyntheticOnly123'); await target.locator('#mobile-reset-newPassword').blur(); await target.locator('.reset-submit').scrollIntoViewIfNeeded();
    const point = await target.locator('.reset-submit').evaluate(node => { const r=node.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY}; });
    // Place the pointer before creating the rapid model window, not after it.
    await target.mouse.move(point.x, point.y);
    await target.evaluate(() => {
      const input=document.getElementById('mobile-reset-identifier'),button=document.querySelector('.reset-submit');
      window.__resetPointer={clicks:0,pressedAction:false};
      button.addEventListener('click',e=>{if(e.isTrusted)window.__resetPointer.clicks++;});
      document.addEventListener('pointerdown',e=>{window.__resetPointer.pressedAction=!!e.target.closest('.reset-submit');},true);
      input.focus({preventScroll:true}); input.value='ui-reset-pointer'; input.dispatchEvent(new InputEvent('input',{bubbles:true})); input.value='x'.repeat(129); input.dispatchEvent(new InputEvent('input',{bubbles:true}));
    });
    const cdp = ending === 'cancel' ? await next.context.newCDPSession(target) : null;
    if (cdp) await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:point.x,y:point.y,id:1}]}); else await target.mouse.down();
    await target.waitForTimeout(160); // Intentional long gesture past uni's model throttle, never an application workaround.
    assert.equal(await target.evaluate(()=>window.__resetPointer.pressedAction),true,'Actual press must hit the original action');
    const heldTop=await target.locator('.reset-submit').evaluate(node=>node.getBoundingClientRect().top+scrollY);
    assert.equal(heldTop,point.top,'First new error stays out of the action geometry until gesture completes');
    assert.equal(next.counts().confirm,0); assert.equal(await target.locator('#mobile-reset-identifier-error').count(),0);
    if (ending==='drag-away') await target.mouse.move(5,5);
    if (cdp) { await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]}); await cdp.detach(); } else await target.mouse.up();
    await target.waitForTimeout(50);
    assert.equal(await target.evaluate(()=>window.__resetPointer.clicks),ending==='click'?1:0); assert.equal(next.counts().confirm,0);
    if (ending==='click') assert.equal(await target.evaluate(()=>document.activeElement.id),'mobile-reset-identifier');
    if (ending==='cancel') await target.locator('#mobile-reset-identifier').blur(); // Normal blur without a click reports the deferred first error.
    await target.locator('#mobile-reset-identifier-error').waitFor(); await semantics(target,'confirm','zh-CN',['identifier']);
    report.pointer.push({ending,actualPressOnAction:true,heldMs:160,beforeTop:point.top,heldTop,trustedClicks:await target.evaluate(()=>window.__resetPointer.clicks),snapshotReleased:'UNAVAILABLE_IN_PRODUCTION_BUILD',requests:next.counts().confirm});
    await next.context.close();
  }
  const keyboard = await newPage(390,'light','zh-CN','confirm'), k=keyboard.page;
  await k.locator('#mobile-reset-newPassword').fill('SyntheticOnly123'); await k.locator('#mobile-reset-newPassword').blur(); await k.locator('.reset-submit').click();
  await k.locator('#mobile-reset-identifier').fill('ui-reset-keyboard'); await k.locator('#mobile-reset-token').fill(syntheticCode()); await k.locator('#mobile-reset-token').blur();
  await k.locator('#mobile-reset-newPassword').fill('x'.repeat(129)); await k.keyboard.press('Enter');
  await k.locator('#mobile-reset-newPassword-error').waitFor(); assert.equal(await k.evaluate(()=>document.activeElement.id),'mobile-reset-newPassword'); assert.equal(keyboard.counts().confirm,0); await semantics(k,'confirm','zh-CN',['newPassword']);
  await keyboard.context.close();
  report.checks.push('True old-center 160ms press hits action with first new error deferred; click reports/focuses it, drag-away and native touchCancel release without submit; ordinary blur and direct password Enter still report errors');
  report.reportedErrorPointer=[];
  for(const kind of ['long-to-empty','empty-to-long','empty-to-valid']){
    const next=await newPage(390,'light','en-US','confirm'),t=next.page; await fillConfirm(t);
    await t.evaluate(()=>{const sizes=[...document.querySelectorAll('.v2-reset,.v2-reset *')].map(e=>[e,parseFloat(getComputedStyle(e).fontSize)]);for(const [e,n]of sizes)if(n)e.style.setProperty('font-size',n*2+'px','important');const style=document.createElement('style');style.textContent='.v2-reset .reset-field-error,.v2-reset .reset-server-error{font-size:28px!important}';document.head.append(style);});
    await t.locator('#mobile-reset-identifier').fill(kind==='long-to-empty'?'x'.repeat(129):''); await t.locator('#mobile-reset-identifier').blur(); await t.locator('.reset-submit').click(); await t.locator('#mobile-reset-identifier-error').waitFor(); await t.locator('.reset-submit').scrollIntoViewIfNeeded(); await t.locator('#mobile-reset-identifier').focus();
    const point=await t.locator('.reset-submit').evaluate(e=>{const r=e.getBoundingClientRect();window.__reportedProbe={clicks:0,hit:false};e.addEventListener('click',x=>{if(x.isTrusted)window.__reportedProbe.clicks++;});document.addEventListener('pointerdown',x=>{window.__reportedProbe.hit=!!x.target.closest('.reset-submit');},{once:true,capture:true});return{x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY};}); await t.mouse.move(point.x,point.y);
    await t.evaluate(kind=>{const e=document.getElementById('mobile-reset-identifier');e.dispatchEvent(new InputEvent('input',{bubbles:true}));e.value=kind==='long-to-empty'?'':kind==='empty-to-long'?'x'.repeat(129):'ui-reset-valid';e.dispatchEvent(new InputEvent('input',{bubbles:true}));},kind); await t.waitForTimeout(160);
    const settledTop=await t.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY); assert.equal(settledTop,point.top,'Reported error text/space stays stable before pointerdown after the model settles'); await t.mouse.down(); await t.waitForTimeout(160); assert.equal(await t.evaluate(()=>window.__reportedProbe.hit),true); assert.equal(await t.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY),point.top); await t.mouse.up();
    assert.equal(await t.evaluate(()=>window.__reportedProbe.clicks),1); if(kind==='empty-to-valid'){await t.locator('.reset-server-error').waitFor();assert.equal(next.counts().confirm,1);}else{assert.equal(next.counts().confirm,0);assert.equal(await t.evaluate(()=>document.activeElement.id),'mobile-reset-identifier');await semantics(t,'confirm','en-US',['identifier']);}
    report.reportedErrorPointer.push({kind,textScale:2,settleMs:160,holdMs:160,beforeTop:point.top,settledTop,trustedClicks:1,requests:next.counts().confirm}); await next.context.close();
  }
  const receipt=await newPage(),rpage=receipt.page; receipt.scenario('accepted'); await rpage.locator('#mobile-reset-identifier').fill('ui-receipt-alpha'); await rpage.locator('#mobile-reset-identifier').blur(); await rpage.locator('.reset-submit').click(); await rpage.getByRole('status').waitFor(); await rpage.locator('#mobile-reset-identifier').focus();
  const rp=await rpage.locator('.reset-submit').evaluate(e=>{const r=e.getBoundingClientRect();window.__receiptPress={clicks:0,hit:false};e.addEventListener('click',x=>{if(x.isTrusted)window.__receiptPress.clicks++;});document.addEventListener('pointerdown',x=>{window.__receiptPress.hit=!!x.target.closest('.reset-submit');},{once:true,capture:true});return{x:r.x+r.width/2,y:r.y+r.height/2,top:r.top+scrollY};}); await rpage.mouse.move(rp.x,rp.y);
  await rpage.evaluate(()=>{const e=document.getElementById('mobile-reset-identifier');e.dispatchEvent(new InputEvent('input',{bubbles:true}));e.value='ui-receipt-beta';e.dispatchEvent(new InputEvent('input',{bubbles:true}));}); await rpage.waitForTimeout(160); assert.equal(await rpage.getByRole('status').count(),0); assert.equal(await rpage.locator('.reset-receipt').isVisible(),false); assert.equal(await rpage.locator('.reset-submit').evaluate(e=>e.getBoundingClientRect().top+scrollY),rp.top); await rpage.mouse.down(); await rpage.waitForTimeout(160); await rpage.mouse.up(); await rpage.getByRole('status').waitFor(); assert.equal(receipt.counts().request,2); assert.equal(await rpage.getByRole('heading',{name:'忘记密码',exact:true}).count(),1); assert.equal(await rpage.evaluate(()=>window.__receiptPress.hit&&window.__receiptPress.clicks===1),true); report.receiptPointer={settleMs:160,holdMs:160,beforeTop:rp.top,oldReceiptHidden:true,trustedClicks:1,requests:2,remainedOnRequest:true}; await receipt.context.close();
  report.checks.push('English200 existing error long/short/valid changes preserve geometry after160ms before actual down and during160ms hold; edited accepted receipt hides truthfully while preserving natural space, and old center sends another request rather than switching step');
  const english = await newPage(390, 'light', 'en-US', 'request');
  english.scenario('accepted');
  await english.page.locator('#mobile-reset-identifier').fill('ui-reset-synthetic');
  await english.page.locator('.reset-submit').click();
  await english.page.locator('.reset-receipt').waitFor();
  const englishReceipt = await english.page.locator('.reset-receipt').innerText();
  report.receiptCopy.en = englishReceipt;
  report.receiptCopy.enAccountEcho = englishReceipt.includes('ui-reset-synthetic');
  save();
  assert.equal(englishReceipt, labels['en-US'].receipt);
  assert.equal(report.receiptCopy.enAccountEcho, false);
  await english.context.close();
  report.iconObservations = [];
  const lightRequest = await newPage(390, 'light', 'zh-CN', 'request', 844, '', 'full');
  const lightRequestFacts = await observeIcons('request-light-full', lightRequest.page, [...REQUEST_DECOR, REQUEST_USER, REQUEST_DOT], true);
  assert.equal(lightRequestFacts.motion, 'on');
  assert.notEqual(lightRequestFacts.fxDisplay, 'none');
  await lightRequest.context.close();
  const lightConfirm = await newPage(390, 'light', 'zh-CN', 'confirm', 844, '', 'full');
  const lightConfirmFacts = await observeIcons('confirm-light-full', lightConfirm.page, [...CONFIRM_DECOR, CONFIRM_USER, CONFIRM_SHIELD, CONFIRM_LOCK, LIGHT_EYE], true);
  const toggleBox = await lightConfirm.page.locator('.reset-password-toggle').boundingBox();
  report.iconObservations[report.iconObservations.length - 1].eyeToggle = toggleBox ? { width: Math.round(toggleBox.width), height: Math.round(toggleBox.height) } : null;
  save();
  assert.equal(lightConfirmFacts.motion, 'on');
  assert.notEqual(lightConfirmFacts.fxDisplay, 'none');
  assert.ok(toggleBox && Math.abs(toggleBox.width - 44) <= 1 && Math.abs(toggleBox.height - 44) <= 1);
  await lightConfirm.context.close();
  const darkRequest = await newPage(390, 'dark', 'zh-CN', 'request', 844, '', 'full');
  const darkRequestFacts = await observeIcons('request-dark-full', darkRequest.page, [...hiddenDecor(REQUEST_DECOR), DARK_USER], false);
  assert.equal(darkRequestFacts.motion, 'on');
  assert.equal(darkRequestFacts.fxDisplay, 'none');
  await darkRequest.context.close();
  const darkConfirm = await newPage(390, 'dark', 'zh-CN', 'confirm', 844, '', 'full');
  const darkConfirmFacts = await observeIcons('confirm-dark-full', darkConfirm.page, [...hiddenDecor(CONFIRM_DECOR), DARK_USER, DARK_LOCK, DARK_EYE], false);
  assert.equal(darkConfirmFacts.motion, 'on');
  assert.equal(darkConfirmFacts.fxDisplay, 'none');
  await darkConfirm.context.close();
  const contrastConfirm = await newPage(390, 'high-contrast', 'zh-CN', 'confirm', 844, '', 'reduce');
  const contrastFacts = await observeIcons('confirm-high-contrast-reduced', contrastConfirm.page, [...hiddenDecor(CONFIRM_DECOR), DARK_USER, DARK_LOCK, DARK_EYE], false);
  assert.equal(contrastFacts.fxDisplay, 'none');
  await contrastConfirm.context.close();
  const system = await newPage(390, 'system', 'zh-CN', 'confirm', 844, '', 'full');
  await system.page.emulateMedia({ colorScheme: 'dark' });
  await system.page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await system.page.waitForFunction(file => [...document.querySelectorAll('.reset-password-toggle img')].some(img => (img.currentSrc || '').includes(file)), DARK_EYE.file);
  const systemDark = await observeIcons('confirm-system-dark', system.page, [...hiddenDecor(CONFIRM_DECOR), DARK_USER, DARK_LOCK, DARK_EYE], false);
  assert.equal(systemDark.theme, 'dark');
  assert.equal(systemDark.fxDisplay, 'none');
  await system.page.emulateMedia({ colorScheme: 'light' });
  await system.page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await system.page.waitForFunction(file => [...document.querySelectorAll('.reset-password-toggle img')].some(img => (img.currentSrc || '').includes(file)), LIGHT_EYE.file);
  const systemLight = await observeIcons('confirm-system-light', system.page, [...CONFIRM_DECOR, CONFIRM_USER, CONFIRM_SHIELD, CONFIRM_LOCK, LIGHT_EYE], true);
  assert.equal(systemLight.theme, 'light');
  assert.notEqual(systemLight.fxDisplay, 'none');
  await system.context.close();
  const immediate = await runImmediateCases();
  report.immediateInput = {
    documentedBoundMs: 200,
    boundReason: 'Prefix settle is the existing 200ms bound before the measured key. The final key and primary click have no blur or wait. The fast window is 100ms.',
    internalModelObservable: false,
    fast: immediate.results,
    fastFailureNames: immediate.failures.map((error) => error.name),
  };
  save();
  if (immediate.failures.length) throw namedProbeError(immediate.failures[0].name, { failures: immediate.failures.map((error) => ({ name: error.name, detail: error.detail })) });
  report.checks.push('Immediate request and confirm: one trusted final key, primary click inside 100ms, one matching endpoint post and final-value equality; cleared identifier sends none');
  const typed = await newPage(390, 'light', 'zh-CN', 'request');
  await typed.page.locator('#mobile-reset-identifier').click();
  const typedAt = Date.now();
  await typed.page.keyboard.type('abcd');
  const typedNative = await typed.page.locator('#mobile-reset-identifier').inputValue();
  report.immediateInput.nativeLength = typedNative.length;
  report.immediateInput.identifierFocusedAtBound = true;
  await typed.page.waitForTimeout(200);
  const focusAtBound = await typed.page.evaluate(() => document.activeElement.id === 'mobile-reset-identifier');
  report.immediateInput.identifierFocusedAtBound = focusAtBound;
  report.immediateInput.elapsedToBoundMs = Date.now() - typedAt;
  save();
  assert.equal(typedNative.length, 4);
  assert.equal(focusAtBound, true);
  typed.scenario('accepted');
  await typed.page.locator('.reset-submit').click();
  await typed.page.locator('.reset-receipt').waitFor();
  report.immediateInput.submitRequests = typed.counts().request;
  report.immediateInput.submitNativeLength = typedNative.length;
  report.immediateInput.noBlurBeforeSubmit = focusAtBound;
  save();
  assert.equal(report.immediateInput.submitRequests, 1);
  assert.equal(report.immediateInput.submitNativeLength, 4);
  await typed.context.close();
  const typedPassword = await newPage(390, 'light', 'zh-CN', 'confirm');
  await typedPassword.page.locator('#mobile-reset-newPassword').click();
  const passwordAt = Date.now();
  await typedPassword.page.keyboard.type('twelve-chars');
  const passwordNative = await typedPassword.page.locator('#mobile-reset-newPassword').inputValue();
  await typedPassword.page.waitForTimeout(200);
  const passwordFocused = await typedPassword.page.evaluate(() => document.activeElement.id === 'mobile-reset-newPassword');
  const tokenNative = await typedPassword.page.locator('#mobile-reset-token').inputValue();
  report.immediateInput.password = { nativeLength: passwordNative.length, elapsedToBoundMs: Date.now() - passwordAt, focusedAtBound: passwordFocused, tokenLength: tokenNative.length, documentedBoundMs: 200 };
  save();
  assert.equal(passwordNative.length, 12);
  assert.equal(passwordFocused, true);
  assert.equal(tokenNative.length, 0);
  await typedPassword.context.close();
  const home = '/pages/home/home';
  const linked = await newPage(390, 'light', 'zh-CN', 'confirm', 844, `&token=${encodeURIComponent(syntheticCode())}&returnTo=${encodeURIComponent(home)}`);
  await linked.page.getByRole('heading', { name: '设置新密码', exact: true }).waitFor();
  const linkedBefore = await hashPresence(linked.page);
  const linkedGateBefore = await readGate(linked.page);
  report.hashLink = { before: { hasTokenParam: linkedBefore.hasTokenParam, tokenLength: linkedBefore.tokenLength, route: linkedBefore.route } };
  save();
  assert.equal(linkedBefore.hasTokenParam, true);
  assert.equal(linkedBefore.tokenLength, 32);
  assert.equal(linkedBefore.route, '#/pages/reset-password/reset-password');
  await fillConfirm(linked.page);
  linked.scenario('success');
  await linked.page.locator('.reset-submit').click();
  await linked.page.locator('.reset-success').waitFor();
  const linkedAfter = await hashPresence(linked.page);
  const linkedGateAfter = await readGate(linked.page);
  const linkedText = await linked.page.locator('.reset-success').innerText();
  report.hashLink.after = { hasTokenParam: linkedAfter.hasTokenParam, route: linkedAfter.route, returnTo: linkedAfter.returnTo, completedText: linkedText, gateBefore: linkedGateBefore, gateAfter: linkedGateAfter, learningReady: linkedGateAfter.learningReady };
  save();
  assert.equal(linkedAfter.hasTokenParam, false);
  assert.equal(linkedAfter.route, '#/pages/reset-password/reset-password');
  assert.equal(linkedAfter.returnTo, home);
  assert.equal(linkedText, labels['zh-CN'].completed);
  assert.equal(linkedGateAfter.learningReady, false);
  assert.deepEqual(linkedGateAfter, linkedGateBefore);
  await linked.page.screenshot({ path: path.join(OUT, 'reset-confirm-link-completed.png'), fullPage: true });
  await linked.page.locator('.reset-login-button').click();
  await linked.page.waitForURL(url => url.hash.startsWith('#/pages/login/login'));
  let decodedReturn = new URLSearchParams(linked.page.url().split('?').slice(1).join('?')).get('returnTo');
  for (let i = 0; i < 2 && decodedReturn?.startsWith('%'); i++) decodedReturn = decodeURIComponent(decodedReturn);
  assert.equal(decodedReturn, home);
  await linked.context.close();
  const offline = await newPage();
  const consoleBeforeOffline = report.consoleErrors.length;
  offline.scenario('offline');
  await offline.page.locator('#mobile-reset-identifier').fill('ui-reset-offline');
  await offline.page.locator('.reset-submit').click();
  await offline.page.locator('.reset-server-error').waitFor();
  const offlineText = await offline.page.locator('.reset-server-error').innerText();
  report.offline = { copy: offlineText, receiptCount: await offline.page.locator('.reset-receipt').count(), requests: offline.counts().request };
  save();
  assert.equal(offlineText, '发送没有完成，请稍后再试。');
  assert.equal(report.offline.receiptCount, 0);
  assert.equal(report.offline.requests, 1);
  const offlineErrors = report.consoleErrors.slice(consoleBeforeOffline);
  assert.ok(offlineErrors.every(message => !/ui-fixture-|SyntheticOnly|token=|newPassword|password=/i.test(message)));
  await offline.context.close();
  report.checks.push('Light full-motion original slots and hashes, dark/high-contrast/system functional icons at 3:1, immediate native lengths + bounded emitting submit, offline failure, completion removes form/no learning CTA, and page-only token removal');
  assert.equal(report.pageErrors.length, 0);
  assert.ok(report.consoleErrors.slice(0, consoleBeforeOffline).every(message => /401|429|503/.test(message)));
  assert.equal(report.unknownApi.length, 0);
  report.artifactEnd = verifyArtifact();
  report.artifactStable = JSON.stringify(report.artifact) === JSON.stringify(report.artifactEnd);
  assert.equal(report.artifactStable, true);
  report.qaInternalStateGap = {
    adultGate: report.confirmCompletion.gateAccess,
    model: 'No Vue setupState in the production artifact; native DOM length plus accepted submit is the observable evidence.',
    pointerFeedback: 'No Vue setupState in the production artifact; actual pointer geometry/click/request behavior is asserted.',
  };
  report.screenshots = fs.readdirSync(OUT).filter(name => name.endsWith('.png'));
  report.candidateSha256 = shaFile(__filename);
  report.status = 'PASS_UI_SCOPED_NOT_BUSINESS_ACCEPTANCE';
  fs.writeFileSync(path.join(OUT, 'firstfailures.json'), JSON.stringify({ at: new Date().toISOString(), candidateImmediate: report.immediateInput.fast, internalStateGap: report.qaInternalStateGap, rootHistoricalEvidence: 'Root supervision evidence supplied separately; no absolute path dependency in candidate' }, null, 2) + '\n');
  save();
  console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, checks: report.checks, pageErrors: report.pageErrors.length, consoleErrors: report.consoleErrors.length, output: OUT }, null, 2));
})().catch(error => { report.status = 'FAIL'; report.failure = error.stack; fs.writeFileSync(path.join(OUT, 'firstfailure.json'), JSON.stringify({ at: new Date().toISOString(), failure: error.stack, matrix: report.matrix, immediateInput: report.immediateInput, artifact: report.artifact }, null, 2) + '\n'); save(); fs.copyFileSync(path.join(OUT, 'results.json'), path.join(OUT, `results-failed-${Date.now()}.json`)); console.error(error.stack); process.exitCode = 1; }).finally(async () => { for (const resolve of pending) resolve(); await browser?.close(); });
